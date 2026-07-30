# Agente Ágil Orquestrador (Fase 2)

Projeto novo e isolado, separado de `functions/agente-agil/` (que fica
intocado e estável — segue recebendo `POST` de especialistas externos
normalmente). Aqui é onde o Agente Ágil passa de "executor de outputs que
alguém mais decidiu" pra "PO+orquestrador": um loop com LLM e ferramentas
decidindo sozinho o que fazer.

## Etapa 1 (este commit)

Só o esqueleto do loop, com ferramentas **falsas** — nada aqui escreve no
board de verdade ainda:

- `limits.js` — kill switch (`KILL_SWITCH_ENABLED = false`, `isEnabled()`) e
  `MAX_ITERATIONS = 8`. Único lugar que sabe esses dois valores.
- `llmClient.js` — `createAnthropicLlmClient()`, chama a API da Anthropic via
  `fetch()` direto (sem SDK novo). Não é exercitado pelos testes (que usam um
  cliente 100% falso) — só entra em uso quando o orquestrador for chamado de
  verdade.
- `tools/index.js` — monta as ferramentas a partir dos MESMOS schemas Zod que
  `agente-agil/schema.js` usa pros outputs (`comentario`, `link`,
  `relatorio_html`, `checklist_item`, `agent_status`, `mover_coluna`,
  `editar_campos`), via `zodToJsonSchema(schema)` sem nome (produz um objeto
  plano, compatível com `input_schema` da Anthropic). Acrescenta
  `perguntar_humano`, que não existe no vocabulário de outputs — central pra
  visão de produto do orquestrador poder pausar e perguntar quando não sabe o
  que fazer.
- `tools/fakeHandlers.js` — cada ferramenta só confirma o input recebido e
  devolve `{ ok: true, simulated: true, tool, wouldHaveExecuted: input }`.
  Trocar por execução real (Etapa 3, reaproveitando
  `buildWritePlan()`/`applyWritePlan()` de `agente-agil/board.js`) é só trocar
  o handler — schema e nome da ferramenta não mudam.
- `loop.js` — `runLoop({ llmClient, tools, system, task, enabled, maxIterations })`.
  Usa o protocolo nativo de tool-use do Claude pra parada natural (continua
  enquanto a resposta trouxer tool calls, para com `status: 'done'` quando for
  só texto) — sem ferramenta `finish()` customizada. `enabled` é sempre
  recebido como parâmetro explícito, nunca lido como global escondida; quem
  chama em produção usa `limits.isEnabled()` como valor padrão quando omite o
  parâmetro. A suíte de testes sempre passa `enabled: true` e por isso nunca
  fica bloqueada pelo valor real do kill switch.

## Etapa 2 (este commit)

Handlers reais, ainda travados em `dryRun` — nada escreve no board de
verdade, mas o plano de escrita agora é montado pelo MESMO código de
produção, contra um squad de teste real:

- **`SQUAD_ID` configurável** (`agente-agil/board.js`): `resolveCardKey()`,
  `buildWritePlan()` e `applyWritePlan()` passam a aceitar `squadId`/
  `cardMeta.squadId` como parâmetro explícito, com default `SQUAD_ID='ecomm'`
  preservado — `agente-agil/http.js` não muda uma linha e os 57 testes
  originais de `agente-agil/__tests__/` continuam passando sem alteração.
  De passagem, corrige um bug latente: a lista `notificar` do envelope
  estava montando os steps de notificação com o `SQUAD_ID` fixo do módulo em
  vez do `squadId` de quem chamou — inofensivo hoje (só existe um squad em
  uso), mas ficaria errado assim que outro squad passasse a escrever de
  verdade. Cobertura nova em `agente-agil/__tests__/squadIdParam.test.js`
  (arquivo novo, não mexe nos 4 arquivos de teste já existentes).
- **`tools/realHandlers.js`** — `makeRealHandler(toolName, {db, squadId,
  cardId})` chama `resolveCardKey`/`buildWritePlan` de verdade (mesmo caminho
  que `http.js` usa em produção), mas com `dryRun` **fixo em `true`**
  (`DRY_RUN_FIXO`, não é parâmetro aceito) — o plano é sempre montado (dá pra
  inspecionar o que seria escrito) mas `applyWritePlan()` nunca é chamado.
  Não exposto como opção ainda de propósito: só vira parâmetro de verdade
  depois que esse caminho for validado ponta a ponta.
- **`tools/index.js`** — `buildTools({mode:'real', db, squadId, cardId})`
  monta as 7 ferramentas com handlers reais; `mode:'fake'` (default) continua
  igual à Etapa 1. `perguntar_humano` nunca tem handler real em nenhum modo —
  não existe escrita associada a ela, é só o sinal que para o loop.
- Squad de teste: `'dev'`, que já existe no projeto como squad fictício
  (`SQUADS_FICTICIOS` em `kanban-dev.html`, criado via painel-dev) — nenhum
  squad novo precisou ser criado.
- 14 testes novos (5 em `squadIdParam.test.js` + 5 em `realHandlers.test.js`
  + validação de que o loop inteiro, ponta a ponta, nunca muta o fake db).
  **76 testes passando no total.**

## Validação contra o Firebase real (squad `dev`)

`scripts/dryRunContraSquadDev.js` — script standalone (não faz parte de
`npm test` nem de deploy nenhum), roda localmente com credenciais reais
(Application Default Credentials). Ainda usa o cliente LLM scriptado
(mesma decisão deliberada da Etapa 2: não gastar tokens de verdade até ser
uma escolha explícita) — o que valida aqui é o encanamento LLM decide → tool
call → handler real → `buildWritePlan` contra o FORMATO REAL de um card do
squad `dev`, não um fake db montado à mão.

Rodado contra o card `c1785433909974` (squad `dev`): `status: 'done'`,
plano corretamente montado (`path` certo, formato certo — `id`, `uid`,
`author`, `init`, `text`, `ts`), `output.dryRun: true`, nenhuma escrita real.
Caminho técnico validado ponta a ponta.

## Próximas etapas (não implementadas ainda)

1. Ligar o cliente LLM real (`createAnthropicLlmClient`) contra o mesmo squad
   `dev`, ainda em `dryRun` — com um system prompt inicial simples (não a
   visão de PO completa ainda, que só faz sentido testar com decisões de
   verdade em jogo). Pré-requisitos: `DEFAULT_MODEL` em `llmClient.js` foi
   atualizado (estava com um snapshot antigo, nunca exercitado contra a API
   de verdade); falta decidir de onde a `apiKey` vem nesse script (variável
   de ambiente, nunca hardcoded/logada).
2. Tirar o `dryRun` fixo — vira parâmetro de verdade só depois do passo 1.
