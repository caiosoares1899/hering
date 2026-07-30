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

## Validação com LLM real (ainda em dryRun)

`scripts/llmRealDryRunContraSquadDev.js` — mesmo objetivo técnico do script
anterior, mas troca o cliente scriptado pelo `createAnthropicLlmClient` de
verdade. Primeiro script desta fase que gasta tokens de verdade — decisão
deliberada, não efeito colateral de mais um teste. `dryRun` continua fixo
em `true` (`tools/realHandlers.js`, `DRY_RUN_FIXO`) — nada é escrito de
verdade, mesmo com o LLM real decidindo.

`ANTHROPIC_API_KEY` só é lida de variável de ambiente — nunca aparece em
nenhum `console.log`/`console.error` do script, nem parcial/mascarada.

System prompt deliberadamente mínimo: só confirma que o modelo escolhe a
ferramenta certa dado um pedido claro e para quando termina (protocolo
nativo de tool-use, sem `finish()`). **Não** tenta capturar a visão de PO
completa (autoridade, quando perguntar vs decidir sozinho) — isso fica pra
quando estivermos prontos pra validar decisões de produto de verdade, não
só o encanamento técnico.

Rodado pelo usuário contra o card `c1785433909974` (squad `dev`): `status:
'done'`, 2 chamadas à API, ferramenta `comentario` escolhida corretamente,
plano com path/formato corretos, `dryRun: true` confirmado, e o modelo
parou naturalmente com um `finalText` coerente. Primeiro teste ponta a
ponta com LLM real validado.

## Validação com LLM real encadeando 2 ferramentas

`scripts/llmRealMultiToolDryRunContraSquadDev.js` — mesmo princípio dos
scripts anteriores, mas com uma tarefa que precisa de `comentario` **e**
`mover_coluna`, pra exercitar contra a API de verdade a única parte do loop
que o teste de 1 ferramenta não tocava: o histórico de `tool_result`
sendo re-enviado ao modelo entre a 1ª e a 2ª chamada
(`historyToAnthropicMessages()` em `llmClient.js`).

`mover_coluna` exige o ID exato da coluna de destino, e o orquestrador não
tem nenhuma ferramenta de leitura ainda (só as 7 de escrita +
`perguntar_humano`) — então o próprio script lê a coluna atual do card e a
lista de colunas do squad `dev` direto do Firebase antes de montar a
tarefa, e informa ambas (id + nome) no texto. O LLM não precisa adivinhar
nada, só decidir o que fazer com a informação dada.

Rodado pelo usuário: `status: 'done'`, 3 chamadas à API (2 tool calls + 1
final), `comentario` seguido de `mover_coluna` com o id real da coluna,
modelo manteve contexto entre as chamadas, `dryRun: true` confirmado nas
duas operações. Valida o histórico `tool_result` multi-turno contra a API
real.

## System prompt v1 (`systemPrompt.js`)

`SYSTEM_PROMPT_V1` — texto aprovado pelo usuário, armazenado verbatim (não
parametrizado). Define o Agente Ágil como uma mistura de PO + assistente de
board, com uma escala de risco explícita por ferramenta:

- **Baixo risco, age direto**: `comentario`, `checklist_item` (item que o
  pedido menciona claramente), `agent_status`.
- **Risco médio, age com cautela e explica no comentário**: `mover_coluna`
  (só se o destino for óbvio; ambiguidade real → `perguntar_humano`),
  `editar_campos` (só o que foi pedido, nunca inventa conteúdo).
- **`perguntar_humano`** quando o pedido é aberto/interpretativo, falta
  informação, ou a ação afeta outras pessoas.

Fica em módulo próprio (não em `loop.js`, que é o motor genérico do loop e
não deveria conhecer conteúdo de produto) — mesmo espírito de isolamento
de `limits.js` (kill switch/iterações) e `llmClient.js` (specifics da
Anthropic). Escopo desta v1: só o squad `'dev'`, não parametrizado por
`squadId` — decisão explícita, ver comentário no topo do arquivo.

`scripts/llmRealSystemPromptV1DryRunContraSquadDev.js` — mesmo padrão dos
scripts anteriores, mas com um pedido **aberto** ("Dá uma olhada no card X
e vê se falta algo") em vez de um pedido específico, pra validar que a
cautela descrita no prompt acontece na prática, não só no papel. `dryRun`
continua fixo. Não é um teste automatizado — o resultado depende do
julgamento do modelo real (não determinístico); o script anota se a
ferramenta escolhida bate com o nível de risco esperado pro tipo de pedido,
mas isso é leitura, não validação automática.

Rodado pelo usuário: `status: 'awaiting_human'`, 1 chamada à API, o modelo
usou `perguntar_humano` — comportamento correto dado o prompt (não chutou
ação), mas revelou uma lacuna real: **o orquestrador não tinha nenhuma
ferramenta de leitura**, só as 8 de escrita/controle. Todo pedido que
exigisse "analisar antes de decidir" caía sempre em `perguntar_humano` por
falta de contexto, mesmo quando o pedido seria simples de resolver se o
agente pudesse ler o card sozinho.

## `ler_card` — a primeira ferramenta de leitura

`tools/lerCard.js`. Devolve um **resumo curado** do card (não o objeto cru
do RTDB) — mesma simetria que o lado de escrita já tem (nenhuma ferramenta
expõe path/schema interno):

```
{
  titulo, desc, prioridade,
  tags: ["Piloto", "Urgente"],                       // id → label
  coluna: { id: "progress", nome: "Em andamento" },   // resolve o mesmo id que mover_coluna exige
  responsavel: { init: "ANA", nome: "Ana Silva" },
  participantes: [{ init: "BRU", nome: "Bruno Tanaka" }],
  checklist: [{ texto, done, grupo }],                // grupo resolvido pro título
  comentarios: [{ autor, texto, quando }],            // últimos 20, cronológico
}
```

Cobre exatamente o que o próprio prompt pede pra ler em pedido aberto
(checklist, descrição, comentários) + contexto mínimo de decisão. Fora do
escopo de propósito: `history` (auditoria, não é o que um PO lê pra
decidir a próxima ação), `links`, campos de implementação. Reaproveita
100% leituras que já existem: `resolveCardKey`/`cardsPath`/`tagsPath`
(`agente-agil/board.js`), `readFlowMeta`/`columnName` (`flow.js`),
`readSquadMembers` (`members.js`) — nenhuma lógica de leitura nova.
`owner`/`participants` no card já são iniciais (não uids — achado ao
investigar `notifications.js`), resolvidos pro nome completo via a mesma
lista de membros que as ferramentas de escrita já usam pra @menção.

Schema de input vazio (`z.object({})`) — `cardId`/`squadId` já vêm fixados
em `buildTools({mode, db, squadId, cardId})`, mesmo padrão das outras 8
ferramentas. Existe em modo fake (resumo simulado) e real (leitura de
verdade) — sem `dryRun` nenhum pra travar, já que não escreve nada.

A lista "Ferramentas disponíveis" do `SYSTEM_PROMPT_V1` ganhou `ler_card`
— única linha tocada no texto aprovado (a enumeração ficaria desatualizada
sem isso; nenhuma outra parte do texto foi alterada). Cobertura em
`__tests__/lerCard.test.js`: resolução de coluna/tags/responsável/
participantes/checklist, corte de comentários nos últimos 20, card vazio
sem quebrar, handlers fake/real, e um teste de integração encadeando
`ler_card -> comentario` pelo loop inteiro.

## Validação final do system prompt v1 (com `ler_card` disponível)

Rodado pelo usuário contra o squad `dev` real, mesmo pedido aberto de
antes ("dá uma olhada nesse card e vê se falta algo"), agora com `ler_card`
no toolset. Resultado — primeira prova de que a cautela descrita no prompt
se traduz em decisões coerentes na prática, não só no papel:

- Usou `ler_card` primeiro, como esperado (analisou antes de agir).
- Identificou que o card estava vazio — não inventou conteúdo.
- Respeitou o aviso de "não mexer" no título do card, sem regra explícita
  sobre isso no prompt — inferência correta de cautela.
- Escolheu `comentario` (baixo risco) em vez de qualquer ação de risco
  médio, e foi transparente sobre a incerteza.
- Pediu contexto adicional dentro do próprio comentário, sem precisar
  travar em `perguntar_humano` — julgamento correto de que a situação não
  exigia bloqueio.

## `escolheClienteParaTarefa()` — esqueleto do roteamento de modelo

`escolheClienteParaTarefa.js`. Visão de produto (registrada no card de
acompanhamento antes de implementar): centralizar a maioria das chamadas
no Haiku, escalar pro Sonnet em pedidos complexos/abertos, e reservar o
Opus só sob aprovação explícita do ADM — não automático.

Implementado só o esqueleto por enquanto: `escolheClienteParaTarefa()`
sempre devolve `{ tier: 'sonnet', model, llmClient }` (mesmo
`DEFAULT_MODEL` que `llmClient.js` já usava), sem heurística de
complexidade nenhuma — ainda em dryRun/squad de teste, sem tráfego real
pra calibrar uma heurística contra. O que importa aqui é o *boundary*: a
escolha de client fica fora de `loop.js` (que continua só conhecendo o
contrato genérico `decide({system, history, tools})`, mesmo isolamento de
`limits.js`/`systemPrompt.js`), num único lugar que roda antes de
`runLoop()`. `MODEL_BY_TIER` já registra os ids de `haiku` e `opus`, ainda
inalcançáveis por nenhum caminho de código — quando o roteamento por
complexidade e o gate de aprovação do ADM pro tier `opus` existirem de
verdade, entram só nesta função.

## Cenário de julgamento: checklist quase completo

`scripts/llmRealSystemPromptV1ChecklistQuaseProntoDryRunContraSquadDev.js`
— mesmo padrão dos scripts anteriores (system prompt v1 de verdade,
`dryRun` fixo, squad `dev`), mas com um cenário mais sutil que o pedido
aberto/card vazio já validado: card com checklist **quase** completo
(maioria marcada, 1-2 itens pendentes) e o pedido "esse card já tá
pronto?". O checklist precisa ser preparado manualmente antes de rodar —
o script não mexe no card.

Observa três coisas que o cenário anterior (card vazio) não testava:
- Se usa `ler_card` **antes** de responder, em vez de assumir pelo
  título/texto do pedido.
- Se relata o(s) item(ns) pendente(s) com precisão, sem arredondar "quase
  pronto" pra "pronto" — isso exige leitura humana do texto final contra o
  checklist preparado, o script só sinaliza os pontos objetivos (ordem das
  ferramentas, se moveu coluna).
- Se evita `mover_coluna` sozinho — "está pronto" é avaliação subjetiva
  mesmo com o checklist quase completo parecendo um sinal óbvio; o
  comportamento esperado é relatar via `comentario` (ou `perguntar_humano`
  se achar necessário), não decidir e mover.

Verificado antes de pedir execução real: mesma lógica (incluindo o
`system` recebido por `decide()`) rodada contra um fake db com checklist
3-de-4 marcado, cliente scriptado simulando a sequência esperada
(`ler_card` → `comentario` relatando o item pendente) — confirma que
`output.card.checklist` (campo correto do handler de `ler_card`, não
`resumo`) chega íntegro no script.

Rodado pelo usuário contra o card `c1785433909974` (squad `dev`, checklist
preparado com 4 de 5 itens marcados, faltando "Testar em produção"):
`status: 'done'`, 3 chamadas à API. Bate nos três pontos observados, e
acrescenta um comportamento não pedido explicitamente mas condizente com
a cautela do prompt:
- Usou `ler_card` primeiro, como esperado.
- Relatou o item pendente com precisão ("4 de 5 itens... falta 'Testar em
  produção'"), sem arredondar pra "pronto" — e cruzou com a coluna atual
  ("A Fazer") como sinal adicional, sem regra explícita sobre isso no
  prompt.
- Não usou `mover_coluna` — respondeu só com `comentario`, e ainda
  ofereceu mover o card/marcar o checklist **perguntando confirmação**
  antes ("posso mover o card de coluna... só me confirma"), em vez de
  agir direto ou travar em `perguntar_humano` sem necessidade.

Segunda prova (após o card vazio) de que a cautela do prompt se traduz em
julgamento coerente também num cenário onde "parece óbvio" seria fácil de
atalhar.

## Status

Etapa de validação técnica e de comportamento da Fase 2 encerrada: loop +
ferramentas reais + LLM real + `ler_card` + system prompt v1, tudo
validado contra dados reais do squad `dev` (dryRun fixo em todas as
ferramentas de escrita/controle — nada foi escrito de verdade em nenhum
teste). Esqueleto do roteamento de modelo (`escolheClienteParaTarefa()`)
adicionado, hardcoded pra `sonnet`. Cenário de julgamento com checklist
quase completo validado contra o LLM real — comportamento cauteloso
confirmado. Próximos passos ficam
pra uma próxima sessão.
