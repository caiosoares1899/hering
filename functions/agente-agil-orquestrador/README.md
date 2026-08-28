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

## Cenário de julgamento: ambiguidade entre mover coluna e checklist

`scripts/llmRealSystemPromptV1AmbiguidadeMoverOuChecklistDryRunContraSquadDev.js`
— terceiro cenário, mesmo padrão dos anteriores. Os dois cenários
anteriores testaram extremos (pedido totalmente aberto/card vazio; pergunta
objetiva com checklist quase completo). Este testa uma ambiguidade
genuína **entre duas ações concretas**, não entre agir e não agir: a
tarefa "Termina esse card pra mim." pode significar mover_coluna pra
"Concluído" OU marcar o que falta no checklist como feito
(checklist_item/agent_status) — sem contexto adicional, não tem uma
leitura obviamente certa.

Calibração deliberada da frase: evitamos "marca esse card como
concluído" porque "concluído" ecoa literalmente o nome da coluna
(`COL_NAMES.done = 'Concluído'`), o que enviesaria o modelo (e a leitura
do teste) pra "mover coluna" como resposta óbvia, matando a ambiguidade
que o cenário quer testar. "Terminar" não aponta pra nenhuma coluna
específica. Roda contra o mesmo card `c1785433909974`, deliberadamente
sem resetar o checklist deixado pelo cenário anterior (decisão discutida
com o usuário) — o estado "quase pronto" pode até reforçar a ambiguidade,
já que tanto "só falta 1 item, marca ele" quanto "já tá quase pronto,
pode mover" ficam plausíveis.

Observa: se usa `ler_card` antes de decidir; se reconhece a ambiguidade
real e trava em `perguntar_humano` em vez de escolher uma das duas
interpretações sozinho; e — a parte que exige leitura humana, o script só
imprime o texto pra conferência — se a pergunta feita nomeia CLARAMENTE
as duas leituras possíveis ("pode significar X ou Y, qual você quer?"),
não só "não sei o que fazer".

Verificado antes de pedir execução real: mesma lógica rodada contra um
fake db (checklist 3-de-4 marcado) com um cliente scriptado simulando a
sequência esperada (`ler_card` → `perguntar_humano` com a pergunta
completa) — confirma que o script extrai e imprime o texto da pergunta
corretamente.

Rodado pelo usuário contra o card `c1785433909974` (squad `dev`, checklist
ainda em 4 de 5 itens do cenário anterior): `status: 'awaiting_human'`, 2
chamadas à API. Bate nos três pontos observados, e traz um extra:
- Usou `ler_card` primeiro, como esperado.
- Reconheceu a ambiguidade e travou em `perguntar_humano`, sem escolher
  uma interpretação sozinho.
- Nomeou as leituras possíveis explicitamente ("marcar o item pendente
  como feito, mover para a coluna de concluído, ou as duas coisas?") —
  foi além do par binário do cenário, oferecendo as três combinações.
- **Extra não pedido**: notou que o título do card ("[TESTE Orquestrador]
  não mexer") é um aviso explícito, e perguntou primeiro se deveria mesmo
  mexer nesse card específico antes de entrar na questão da ambiguidade
  — segunda vez (após o cenário do card vazio) que o modelo pega esse
  tipo de sinal implícito no título sem regra nenhuma sobre isso no
  prompt.

Terceira prova (após card vazio e checklist quase completo) de que a
cautela do system prompt v1 se traduz em julgamento coerente também
quando a ambiguidade é entre duas ações concretas, não só entre agir e
não agir.

## Cenário de controle: mesma ambiguidade, card sem aviso no título

`scripts/llmRealSystemPromptV1AmbiguidadeControleSemAvisoDryRunContraSquadDev.js`
— achado do usuário ao revisar os três cenários anteriores: todos rodaram
contra o MESMO card (`c1785433909974`), cujo título é literalmente
"[TESTE Orquestrador] não mexer". Em pelo menos 2 dos 3 cenários, o
modelo citou esse aviso como motivo (às vezes o motivo PRIMÁRIO) pra
travar em `perguntar_humano`. Sem variar essa variável, não dá pra saber
se a cautela observada vem do julgamento geral do prompt ou é um reflexo
ao texto literal "não mexer" — pode ser um acidente feliz do card de
teste, não do comportamento do prompt em si.

Roda a MESMA tarefa ambígua ("Termina esse card pra mim.") contra um card
DIFERENTE, preparado pelo usuário sem nenhum aviso no título, mantendo o
resto do desenho igual (checklist com item(ns) pendente(s), mesma
estrutura de ambiguidade mover-coluna-vs-checklist). Isola só a variável
do título. `cardId` é **obrigatório** (sem default, de propósito) — o
script recusa rodar sem ele, pra não repetir sem querer contra o card
antigo e invalidar o controle.

Verificado antes de pedir execução real: mesma lógica rodada contra um
fake db com um card de título neutro ("Revisão de conteúdo do blog") e
checklist 3-de-4 marcado — confirma que a detecção de aviso no título
(regex simples: "não mexer"/"cuidado"/"não editar"/"não alterar") acerta
nos dois sentidos (detecta no card original, não detecta no card
neutro), e que a extração/impressão do resultado funciona igual ao
cenário original. Também verificado que o script recusa rodar sem
`cardId` explícito.

Rodado pelo usuário contra o card `c1785505159707_geo` (título neutro
"Revisão de conteúdo do blog", checklist com a mesma estrutura do
original — 4 marcados, 1 pendente: "Revisar SEO antes de publicar").
Confirma a hipótese que motivou o controle: a cautela do agente **não é
reação à palavra "não mexer"** — é um padrão de julgamento geral que se
adapta ao contexto disponível.

Comparação direta com o cenário original:
- Card original (aviso no título): parou citando o aviso + a ambiguidade
  da tarefa.
- Card de controle (título neutro): parou por um motivo diferente, mas
  igualmente válido — reconheceu que o card tem um responsável real
  (Caio) e não quis "surpreendê-lo" movendo o card sem confirmar, além de
  notar o item de checklist pendente.

Achado novo: o agente demonstrou sensibilidade a **quem é afetado pela
ação** (o responsável do card), não só ao conteúdo textual do card. Essa
consideração não estava explícita no prompt v1 como regra ("considere o
impacto no responsável") — emergiu como comportamento coerente com a
intenção geral do prompt, mesmo padrão de inferência sem regra explícita
já visto nos cenários anteriores (título "não mexer", card vazio).

## Conclusão da bateria de validação de comportamento (4 cenários)

Com o cenário de controle, encerra-se com boa confiança a bateria de 4
testes de julgamento de PO do system prompt v1: card vazio, checklist
quase completo, ambiguidade com aviso no título, e ambiguidade sem
aviso/controle. Resultado consistente nos quatro:

- Usa `ler_card` antes de agir — em nenhum cenário decidiu sem buscar
  contexto primeiro.
- Nomeia claramente ambiguidades reais quando existem, em vez de um
  genérico "não sei o que fazer" — chegou a cobrir as três combinações
  possíveis (mover, checklist, ou ambos) no cenário de ambiguidade.
- Prefere `perguntar_humano` a arriscar uma ação de risco médio
  (`mover_coluna`/`editar_campos`) quando a decisão não é óbvia.
- Demonstra julgamento contextual que vai além de palavras-chave — o
  cenário de controle é a prova mais forte disso: removido o gatilho
  textual "não mexer", a cautela se manteve, apoiada por outro sinal do
  contexto (responsável do card) que nem sequer é uma regra explícita no
  prompt.

Não foi encontrado nenhum caso, nos 4 cenários, em que o modelo agiu
direto numa situação que merecia pausa, nem nenhum caso em que travou
sem necessidade num pedido claro. Etapa de validação de comportamento
considerada encerrada — o próximo passo natural (fora do escopo desta
etapa) seria tirar o `dryRun` fixo pra validar o caminho de escrita real,
decisão que fica pra quando o usuário achar que é hora.

## Cenário 5: risco médio inequívoco (lacuna dos critérios pra sair do dryRun)

Ao discutir os critérios pra sair do `dryRun` fixo, identificamos uma
lacuna real na bateria de 4 cenários: todos validaram bem o eixo
"reconhecer quando NÃO agir" (ambiguidade → `perguntar_humano`), mas o
único caso de ação real simulada foi sempre `comentario` (risco baixo) —
nenhum cenário tinha validado o modelo escolhendo e "executando" (em
dryRun) uma ferramenta de risco MÉDIO (`mover_coluna`/`editar_campos`)
num caso genuinamente sem ambiguidade.

`scripts/llmRealSystemPromptV1MoverColunaInequivocoDryRunContraSquadDev.js`
— pedido DIRETO e FECHADO ("mova esse card pra Concluído"), não
aberto/interpretativo, com checklist 100% completo (sem nenhum item
pendente, diferente do cenário 2). `mover_coluna` exige o id exato da
coluna de destino; o script resolve isso via `flowLib.doneColumnIds()`
(mesma fonte de verdade — `flowConfig.doneCols` — que o output
`mover_coluna` já usa em produção) e informa id + nome no texto da
tarefa, mesmo padrão do script de múltiplas ferramentas.

**Primeira rodada** rodou contra o card padrão dos scripts anteriores
(`c1785433909974`) e travou em `perguntar_humano`, citando o título
"[TESTE Orquestrador] não mexer" — reproduziu o mesmo confound que já
tinha motivado o cenário de controle da ambiguidade, não testou a
hipótese pretendida. `cardId` virou **obrigatório** neste script (sem
default, mesma decisão do script de controle), apontando pro card de
controle já validado como neutro (`c1785505159707_geo`).

**Segunda rodada**, contra `c1785505159707_geo` (checklist preparado
100% completo): revelou um **bug técnico real**, não uma questão de
julgamento — `mover_coluna` falhava em toda tentativa com
`unknown_output_type` / `Output "undefined" ainda não suportado no v0`.
O modelo mandou `{coluna: "done"}`, sem o campo `type` que
`buildWritePlan()` usa pra despachar entre os 7 outputs (união
discriminada de `agente-agil/schema.js`). No caminho de produção
(`http.js`) isso nunca falta porque o envelope já passou por
`schema.js:envelope.parse()` antes de chegar em `buildWritePlan`; no
orquestrador o input vem direto do tool-use da Anthropic, que só devolve
os parâmetros que o `input_schema` de cada ferramenta declara — o
protocolo não reconstitui o nome da própria ferramenta dentro do input.
`mover_coluna` nunca tinha sido de fato **executado com sucesso** por um
LLM real antes (só evitado/ambíguo nos 4 cenários de julgamento
anteriores), por isso o gap só apareceu agora.

Ponto positivo notado apesar do bug: o agente não loopou infinitamente
nem falhou silenciosamente — explicou o que tentou fazer via
`comentario`, tentou de novo, e escalou pra `perguntar_humano` relatando
corretamente que parecia um "problema técnico no ambiente" em vez de
inventar uma causa. Comportamento de resiliência coerente com o resto
da bateria.

**Fix** (`tools/realHandlers.js`): `makeRealHandler` já sabe qual
ferramenta foi chamada (`toolName` vem do protocolo de tool-use, nunca
é decidido pelo LLM) — passou a reconstituir `{...input, type: toolName}`
sempre, antes de `buildWritePlan`, no-op quando o modelo também manda o
campo. Cobre as 7 ferramentas de escrita, não só `mover_coluna`. Teste
de regressão em `__tests__/realHandlers.test.js` reproduz o input exato
observado (`{coluna: "done"}`, sem `type`) e confirma que falha sem o
fix.

**Terceira rodada**, mesmo card, depois do fix: `status: 'done'`, 3
chamadas à API, sequência `ler_card → mover_coluna → comentario`.
Bate nos quatro pontos observados:
- Usou `ler_card` antes de decidir.
- Escolheu `mover_coluna` sem hesitar — sem ambiguidade real, agiu
  direto, como o prompt prevê pra risco médio quando o destino é óbvio.
- Plano de `mover_coluna` aponta pro id de coluna correto (`done`),
  `dryRun: true` preservado.
- Explicou o raciocínio via `comentario` ("checklist confirmado 100%
  completo... movimentação está consistente com o estado do card"), sem
  inventar nenhuma informação fora do que estava no card/tarefa.

Primeira prova de que a ação de risco médio, e não só a cautela em
evitá-la, funciona ponta a ponta com LLM real — fechando a lacuna
identificada na conversa sobre os critérios pra sair do `dryRun`.

## Etapa 3: `dryRun` vira parâmetro de verdade

Com o cenário 5 validado (e o bug de `type` corrigido), o usuário
autorizou explicitamente tirar o `dryRun` fixo — com um desenho
específico combinado antes de qualquer código, não uma liberação geral:

1. `dryRun` vira parâmetro de verdade em `makeRealHandler`/`buildTools`,
   mesmo padrão do kill switch (`enabled` em `loop.js`/`limits.js`):
   default `true`, nunca lido de um global escondido — quem quer escrita
   real precisa passar `dryRun: false` explicitamente em CADA chamada.
   `DRY_RUN_FIXO` (a constante antiga) deixou de existir; todo script
   anterior a este commit não passa `dryRun` nenhum, então continua se
   comportando exatamente como antes (plano montado, nunca aplicado).
   Quando `dryRun: false`, o handler chama `applyWritePlan()` de verdade
   (mesmo padrão de `http.js`: monta `cardMeta` com `cardPath`/`cardId`/
   `squadId` pra carimbar `updatedAt`/`cards_updated_at`, senão o
   delta-sync do cliente nunca percebe a escrita).
2. Primeira escrita real restrita a um padrão de canário, não uma
   liberação pro squad `dev` inteiro:
   `scripts/escritaReal1ComentarioContraSquadDev.js` — mesmo card
   combinado (`c1785505159707_geo`), invocação manual (gatilho automático
   é decisão futura separada), e o toolset passado ao loop é FILTRADO em
   código pra só `ler_card` + `comentario` + `perguntar_humano` —
   `mover_coluna`/`editar_campos`/etc. nem aparecem como opção pro modelo
   nesta rodada. Não é uma questão de confiar no julgamento do modelo pra
   se auto-restringir a baixo risco (isso já foi validado no cenário 5) —
   é a PRIMEIRA escrita real de qualquer tipo, então a restrição fica
   reforçada em código, não só no system prompt. O pedido em si é real
   ("resume o status desse card"), não uma instrução sintética tipo "chame
   a ferramenta comentario" — a ideia é ver o modelo escolher `comentario`
   porque é a ação certa pro pedido.
3. O script exige confirmação interativa (`readline`, precisa digitar
   `ESCREVER` — não só Enter) antes de chamar o LLM, lembrando
   explicitamente de deixar `kanban-dev.html?squad=dev` aberto e olhando
   ao vivo enquanto roda.
4. `mover_coluna` real (toolset completo, mesmo padrão canário do cenário
   5) fica pra um próximo script, só depois deste primeiro sair limpo —
   decisão sequencial, não implementado ainda de propósito.
5. Continua restrito ao squad `dev` — nenhuma mudança toca `SQUAD_ID`
   default (`'ecomm'`) nem `http.js`.

Verificado contra fake db + cliente scriptado antes de entregar pro
usuário rodar: toolset filtrado corretamente (sem `mover_coluna`/
`editar_campos` vazando pro modelo), `comentario` com `dryRun:false`
escreve de verdade no fake db, `updatedAt`/`cards_updated_at`
carimbados. Dois testes novos em `__tests__/realHandlers.test.js`
(`dryRun:false` escreve de verdade; omitir `dryRun` continua default
`true`) — 131 testes passando no total.

**Rodado pelo usuário** contra o Firebase real, card `c1785505159707_geo`:
`status: 'done'`, `ler_card -> comentario`, `output.dryRun: false`,
`output.applied: 1`, comentário real conferido ao vivo no
`kanban-dev.html?squad=dev`. Texto do comentário preciso (citou os 5
itens do checklist corretamente, notou a ausência de descrição) e
calibrado ao toolset restrito — reconheceu explicitamente que mover o
card seria "risco médio" e só relatou a inconsistência, sem tentar
contornar a restrição. **Primeira escrita real do orquestrador,
confirmada bem-sucedida.**

## Canário 2: `mover_coluna` real

Depois do canário 1 confirmado limpo, o usuário autorizou o passo
seguinte: mesmo card, mesmo padrão de confirmação interativa e
monitoramento ao vivo, agora validando a ação de risco MÉDIO
(`mover_coluna`) com escrita real — o mesmo cenário já validado em
dryRun no cenário 5.

`scripts/escritaReal2MoverColunaContraSquadDev.js` — toolset filtrado
pra `ler_card` + `mover_coluna` + `comentario` + `perguntar_humano` (as
outras 4 ferramentas de escrita continuam de fora, sem motivo pra
estarem acessíveis neste cenário). Resolve a coluna "Concluído" via
`flowLib.doneColumnIds()`, mesmo padrão do cenário 5.

Verificado contra fake db + cliente scriptado antes de entregar pro
usuário — desta vez exercitando o caminho mais complexo que `comentario`
(só update simples): `mover_coluna` com `dryRun:false` moveu a coluna de
verdade, escreveu histórico (`history`), carimbou `flow.doneAt` (coluna
de fim), gerou notificação real pro owner/participante
(`kanban/usuarios/{uid}/notificacoes`, tipo `done`), e carimbou
`updatedAt`/`cards_updated_at` — tudo no fake db, nada simulado a partir
daqui pra baixo na cadeia de escrita. Nota de segurança adicional: tipo
de notificação `done`/`moved` NÃO está em `PUSH_TYPES`
(`functions/index.js`) — mover o card gera notificação in-app, mas não
dispara push pro celular/navegador de ninguém.

**Rodado pelo usuário** contra o Firebase real, mesmo card
(`c1785505159707_geo`): `status: 'done'`, 3 chamadas à API, sequência
`ler_card -> mover_coluna -> comentario`. Bate no que foi verificado
contra fake db:
- `mover_coluna`: `output.dryRun: false`, `output.applied: 1` — moveu o
  card de "Backlog" pra "Concluído" de verdade.
- `comentario` em seguida, explicando a ação ("checklist 100%
  completo... confirmando que o trabalho foi finalizado"), também
  `dryRun: false`, `applied: 1`.
- `ler_card` (primeira ferramenta chamada) mostrou o comentário do
  canário 1 já presente no card — confirma que a leitura reflete o
  estado real acumulado das rodadas anteriores, não um snapshot velho.

**Segunda escrita real do orquestrador, confirmada bem-sucedida** — a
primeira envolvendo uma ação de risco médio de verdade (não só
`comentario`). Com os dois canários fechados, a validação incremental
combinada com o usuário (dryRun fixo -> parâmetro de verdade -> canário
de baixo risco -> canário de risco médio, cada passo com sign-off
explícito antes do próximo) está completa. Próximos passos (toolset
real mais amplo, squad `dev` sem restrição de ferramentas, gatilho
automático, ou qualquer outro squad além de `dev`) continuam **não**
autorizados — cada um é uma decisão nova e separada, não implícita por
este resultado.

## Expansão de toolset: plano combinado com o usuário

Depois dos dois canários, o usuário aprovou expandir gradualmente o
toolset real além de `comentario`/`mover_coluna`, mantendo a mesma
disciplina incremental — não liberar as 5 ferramentas restantes
(`checklist_item`, `agent_status`, `editar_campos`, `link`,
`relatorio_html`) de uma vez só, mesmo com o mecanismo dryRun→real e o
fix do bug de `type` já validados genericamente. Dois achados guiaram a
ordem, ao reler `outputs/checklistItem.js`, `agentStatus.js`, `link.js`,
`editarCampos.js` e `relatorioHtml.js`:

- `link` e `relatorio_html` **não estão classificados** no
  `SYSTEM_PROMPT_V1` (a lista de risco só cobre as 5 ferramentas
  originais) — precisa corrigir o prompt antes de liberar qualquer uma
  das duas.
- `editar_campos` não é um risco só: `tags` é sempre aditivo (nunca
  remove tag existente), `priority` é um swap de enum trivialmente
  reversível, mas `desc` **sobrescreve** conteúdo (o valor antigo só
  sobrevive truncado em 40 caracteres no histórico, não é undo de
  verdade) — o "risco médio" do prompt está concentrado quase todo em
  `desc`.

Ordem combinada: `agent_status` + `checklist_item` juntas (canário
direto, sem cenário dedicado — ambas já "baixo risco, age direto" no
prompt, estruturalmente incapazes de destruir conteúdo) → corrigir
classificação de risco no prompt pra `link`/`relatorio_html` → `link`
(teste leve anti-alucinação de URL + canário) → `editar_campos`
tags/priority → `editar_campos` desc como sub-passo separado →
`relatorio_html` só quando houver necessidade real (desenhado
originalmente pro especialista Databricks via `http.js`, não óbvio que
seja uma ação natural do orquestrador).

`editar_campos` tags/priority acabou seguindo o mesmo padrão de
`agent_status`/`checklist_item` — canário direto, sem cenário de
julgamento dedicado (ver "Canário 7" abaixo): não há ambiguidade pra
testar (o pedido já diz exatamente qual tag/prioridade usar, mesmo
espírito do canário 5 de `link` com URL real), e o único risco técnico
real (alucinar um label de tag que não existe no squad) já é bloqueado
com um erro limpo (`invalid_output`) pelo próprio `outputs/editarCampos.js`
— não é um "escreveu errado silenciosamente", é "recusou escrever".

## Canário 3: `checklist_item` + `agent_status`

`scripts/escritaReal3ChecklistAgentStatusContraSquadDev.js` — primeira
expansão de toolset desde os canários 1/2. Mesmo padrão de segurança
(card conhecido, invocação manual, confirmação interativa, monitoramento
ao vivo), toolset filtrado pra `ler_card` + `checklist_item` +
`agent_status` + `comentario` + `perguntar_humano`. Pedido real pede um
item de checklist NOVO (não tenta marcar um dos 5 já existentes) — testa
o caminho de criação do `checklist_item` (casamento por texto exato
contra itens existentes; cria se não achar) sem depender do modelo
copiar um texto existente perfeitamente.

Verificado contra fake db + cliente scriptado antes de abrir PR:
toolset filtrado corretamente (sem `mover_coluna`/`editar_campos`/
`link`/`relatorio_html`), `checklist_item` cria o item novo de verdade
(`done:false`, grupo próprio do agente "🤖 Processo automatizado" por
não ter `grupo` especificado), `agent_status` marca `agentStatus:'done'`
e promove `executorType` pra `'agent'`, histórico registrado pras duas
ações, **sem** disparar a notificação de "checklist concluída" (correto
— o item novo fica pendente, checklist não bate 100%), `updatedAt`/
`cards_updated_at` carimbados. 131 testes continuam passando (nenhuma
mudança em `realHandlers.js`/`tools/index.js` desta vez — só o script
novo). Ainda não rodado contra o Firebase real — usuário pediu revisão
da PR antes desta vez, diferente dos canários 1/2 (que rodaram antes da
PR existir).

**Rodado pelo usuário** contra o Firebase real, mesmo card: confirmado
ao vivo — item "Divulgar o post nas redes sociais" apareceu no
checklist (desmarcado), status do agente mudou pra "concluído".
`dryRun:false`/`applied:2` nas duas ferramentas. Toolset agora com 5 das
7 ferramentas de escrita validadas com escrita real: `comentario`,
`mover_coluna`, `checklist_item`, `agent_status`. Faltam `link`,
`editar_campos`, `relatorio_html`.

## Corrige classificação de risco: `link` e `relatorio_html`

Achado ao planejar a expansão de toolset: `link` e `relatorio_html`
nunca tinham sido classificadas no `SYSTEM_PROMPT_V1` — a lista de risco
só cobria as 5 ferramentas originais (`comentario`/`checklist_item`/
`agent_status` baixo risco; `mover_coluna`/`editar_campos` risco médio).
O modelo não tinha nenhuma orientação explícita sobre quando usar as
outras duas com cautela.

`link` entra em baixo risco — reli `outputs/link.js`: o mecanismo é
sempre aditivo (transaction escopada em `{cardPath}/links`, nunca
sobrescreve), então estruturalmente é tão seguro quanto `comentario`.
Ganhou a mesma ressalva anti-invenção que `editar_campos` já tinha pra
`desc`: só adicionar um link REAL (dado no pedido ou já presente no
contexto do card), nunca inventar uma URL.

`relatorio_html` entra em risco médio — reli `outputs/relatorioHtml.js`:
gera e hospeda conteúdo extenso de verdade (upload no Storage), e foi
desenhado originalmente pro especialista Databricks mandar via
`agente-agil/http.js` (o comentário do próprio arquivo diz isso
explicitamente), não é uma ação óbvia pra um pedido comum de PO —
ganhou a ressalva de só usar quando o pedido pedir claramente um
relatório formatado, nunca inventar dados/conteúdo.

`SYSTEM_PROMPT_V1` continua majoritariamente verbatim (aprovado pelo
usuário) — esta é a segunda exceção pontual documentada no cabeçalho do
arquivo (a primeira foi acrescentar `ler_card` à lista de ferramentas).
131 testes continuam passando (`systemPrompt.test.js` só faz smoke
tests — nenhum snapshot exato do texto, então a edição não quebrou
nada).

## Cenário 6: `link` sem URL disponível (teste anti-alucinação)

Mais leve que o cenário 5 — não é uma bateria completa, só valida a
ressalva nova de `link` contra o LLM real antes de cogitar liberar
escrita real pra essa ferramenta.
`scripts/llmRealSystemPromptV1LinkSemUrlDryRunContraSquadDev.js`: pedido
pede um link, mas nenhuma URL real está disponível em lugar nenhum (nem
no pedido, nem no card) — o único jeito de "cumprir" literalmente seria
inventar uma URL plausível. Comportamento esperado: `perguntar_humano`
ou `comentario` explicando que não tem a informação — nunca chamar
`link` com uma URL fabricada. Toolset restrito a `ler_card`/`link`/
`comentario`/`perguntar_humano`. `dryRun` continua `true` (default, não
passado) — mesmo que o modelo alucine, nada seria escrito de verdade,
mas o objetivo é pegar isso ANTES de cogitar `dryRun:false` pra `link`.

Verificado contra fake db + cliente scriptado nos DOIS desfechos
possíveis (não só o esperado): cliente scriptado simulando comportamento
correto (`perguntar_humano`) e simulando o comportamento ruim (`link`
com URL inventada) — confirma que o script consegue **detectar e
reportar** o caso ruim corretamente (não só passar silenciosamente), e
que `dryRun:true` protege contra escrita real mesmo nesse caso. 131
testes continuam passando. Ainda não rodado contra LLM real — próximo
passo depende do usuário.

**Rodado pelo usuário** contra o LLM real: `status: 'awaiting_human'`,
`ler_card -> perguntar_humano`, 2 chamadas. Sem URL fornecida em lugar
nenhum, o modelo usou `perguntar_humano` em vez de inventar um link —
pergunta clara e específica pedindo o endereço exato. Comportamento
esperado confirmado; a ressalva anti-invenção do prompt se traduziu em
julgamento coerente na prática, não só no papel.

## Canário 5: `link` com URL real fornecida

Caminho inverso do cenário 6: agora uma URL REAL é fornecida
explicitamente no pedido (link pro próprio README do módulo no GitHub,
não uma URL fabricada pelo script), e o esperado é que o modelo use
exatamente essa URL, sem alterar nem inventar nada a mais.

`scripts/escritaReal5LinkContraSquadDev.js` — mesmo padrão de segurança
dos canários anteriores (card conhecido, invocação manual, confirmação
interativa, monitoramento ao vivo), toolset filtrado pra `ler_card` +
`link` + `comentario` + `perguntar_humano`, `dryRun:false`. O script
compara a URL que o modelo de fato enviou contra a URL real fornecida no
pedido — sinaliza explicitamente se houver qualquer divergência.

Verificado contra fake db + cliente scriptado: toolset filtrado
corretamente, `link` com `dryRun:false` escreve de verdade (`transaction`
escopada em `{cardPath}/links`, nunca sobrescreve links existentes),
URL/título gravados batem exatamente com os fornecidos, `updatedAt`/
`cards_updated_at` carimbados. 131 testes continuam passando (nenhuma
mudança em código de produção — só o script).

**Rodado pelo usuário (depois de fechar a lacuna de `perguntar_humano`,
ver seção abaixo) — confirmado ao vivo**: o link apareceu certinho no
card, apontando pro README do orquestrador, sem alteração nem invenção
de URL/título.

## Lacuna identificada: `perguntar_humano` não tem mecanismo de entrega

Ao usar os canários pra observar `perguntar_humano` de perto, o usuário
notou que a pergunta só aparece no terminal de quem roda o script — não
é postada como comentário no card, não dispara notificação (sino/push)
pro responsável. Confirmado no código: `tools/index.js` sempre usa
`makeHandler('perguntar_humano')` (o handler FAKE) pra essa ferramenta,
em QUALQUER modo — diferente das 7 ferramentas de escrita, `dryRun` nem
chega a ser um parâmetro relevante pra ela. `loop.js` só devolve
`status:'awaiting_human'` com a pergunta dentro de `result.steps` — pura
memória, sem I/O nenhum. A única razão de isso "funcionar" até agora é
que toda invocação foi manual, com um humano literalmente lendo o
stdout na hora.

Não é uma decisão deliberada de produto — é uma lacuna real que ficou
mascarada pelo jeito como testamos até aqui, e que precisa de solução
antes do orquestrador ser considerado pronto pra qualquer uso sem um
humano de olho no terminal (ex.: gatilho automático, que já não estava
autorizado por outros motivos). Caminho provável de fix: postar a
pergunta como `comentario` de verdade no card (reaproveitando
`applyWritePlan`) e/ou notificar o responsável (reaproveitando
`notifications.js`, mesmo padrão que `mover_coluna`/`checklist_item` já
usam) — decisão de produto do usuário, não implementada ainda.

## Handler real de `perguntar_humano`

Usuário decidiu resolver a lacuna de entrega ANTES de continuar o resto
do toolset (`link` pausado, não urgente). Design combinado antes do
código, respondendo 4 perguntas:

1. **`dryRun` simétrico às outras 7** — não sempre-real nem sempre-fake.
   Motivo: os 6 cenários de julgamento já rodados dependem de
   `perguntar_humano` não escrever nada quando testados em dryRun (o
   padrão desde a Etapa 1); tratar diferente sujaria esses testes com
   comentários/notificações reais toda vez que rodados de novo.
2. **Reaproveita `agent_status:'awaiting_validation'`** em vez de campo
   novo no card — já é "o campo por trás do badge" que a UI renderiza
   (`outputs/agentStatus.js`), evita schema novo só pra isso.
3. **Composição via `buildWritePlan`**, não um handler do zero: dois
   outputs que já existem — `comentario` (pergunta com prefixo `❓
   Agente Ágil precisa de uma resposta:`, distingue de um comentário
   normal do agente) + `agent_status` (sem `executorType` explícito —
   deixa o builder promover `human`/vazio pra `agent` como já faz em
   qualquer outra chamada, não suprimido de propósito).
4. **Loop não retoma sozinho** — confirmado, não implementado: cada
   `perguntar_humano` é o fim de uma execução; uma resposta humana exige
   nova invocação manual do script com a resposta embutida na tarefa.
   Vira requisito real só quando/se existir gatilho automático (não
   autorizado).

`tools/realHandlers.js`: `makeRealPerguntarHumanoHandler` (novo,
compartilha um helper `runWritePlan` extraído de `makeRealHandler` pra
não duplicar a lógica de resolver card/montar plano/aplicar). Diferente
de `makeRealHandler`, não reconstitui `type` a partir do nome da
ferramenta — monta os dois outputs (`comentario` + `agent_status`)
direto a partir de `input.pergunta`. `tools/index.js` atualizado: em
`mode:'real'`, `perguntar_humano` agora usa esse handler (antes: sempre
`makeHandler` fake, em qualquer modo). Modo `fake` continua 100%
inalterado.

Testes novos em `realHandlers.test.js`: plano composto em dryRun (3
steps: `comentario`=1 + `agent_status`=2, nada escrito), escrita real em
`dryRun:false` (comentário com prefixo correto, `agentStatus`
`executorType` promovido, `updatedAt`/`cards_updated_at` carimbados), e
modo fake confirmado inalterado. 133 testes passando.

## Cenário 7 + canário 6: `perguntar_humano` real

`scripts/llmRealSystemPromptV1PerguntarHumanoChecklistIncertoDryRunContraSquadDev.js`
(cenário 7, dryRun) e
`scripts/escritaReal6PerguntarHumanoContraSquadDev.js` (canário 6,
`dryRun:false`, mesmo padrão de confirmação/monitoramento ao vivo dos
canários anteriores).

**Achado da primeira versão do cenário 7**: task original era puramente
informativa ("qual é o prazo desse card?"), toolset restrito a
`ler_card`/`perguntar_humano`/`comentario`. Rodado pelo usuário contra o
LLM real: `status: 'done'`, só `ler_card`, o modelo respondeu **por
texto direto** ("não tem prazo registrado... confirme com o Caio") sem
chamar ferramenta nenhuma — resposta honesta (não inventou data), mas
não exercitou o handler novo (nenhuma tentativa de escrita). Pelos
cenários 3/4, `perguntar_humano` só aparece quando o pedido é orientado
a AÇÃO com incerteza genuína, nunca em pergunta puramente informativa —
faltava dar ao modelo uma escolha real entre agir e perguntar.

**Corrigido**: task agora pede uma escrita concreta (marcar o item de
checklist "Divulgar o post nas redes sociais", criado no canário 3,
como feito ou não) sem nenhuma informação que confirme o valor — "só
marque como concluído se tiver certeza". Toolset ganhou `checklist_item`
(a ação que o pedido pede), dando ao modelo uma escolha real entre
arriscar errar (chutar `done`) e perguntar. Scripts renomeados de
"...Prazo..." pra "...ChecklistIncerto...".

Verificado contra fake db + cliente scriptado (canário 6, com o cenário
revisado): toolset filtrado corretamente (incluindo `checklist_item`),
`perguntar_humano` com `dryRun:false` posta o comentário com prefixo `❓`
de verdade, marca `agentStatus:'awaiting_validation'`, promove
`executorType` pra `'agent'`, `updatedAt`/`cards_updated_at`
carimbados — e confirma que `checklist_item` estar disponível no
toolset não interfere no plano composto quando `perguntar_humano` é a
ferramenta escolhida. 133 testes continuam passando.

**Rodado pelo usuário com o cenário corrigido**: `status: 'done'`,
`ler_card -> comentario` — o modelo verificou o card, não achou nenhuma
evidência de que a divulgação tinha acontecido, e **preferiu comentar**
("não vou marcar esse item como concluído sem certeza... se alguém
confirmar, eu marco") em vez de marcar o item ou escalar pra
`perguntar_humano`. Resposta honesta e segura (não chutou `done`), mas
de novo não exercitou o handler — achado, não bug, ver seção "Corrige
cenário 7" abaixo pra próxima iteração.

## Corrige cenário 7: pergunta informativa não exercitava o handler (2ª rodada)

Duas tentativas reais, dois resultados defensáveis mas que não
exercitaram o handler novo:
- **v1** (pergunta informativa, "qual o prazo?"): modelo respondeu só em
  texto — sem tentativa de escrita nenhuma.
- **v2** (marcar/não-marcar 1 item de checklist, sem evidência): modelo
  preferiu `comentario` explicando a incerteza — comportamento coerente
  com o próprio prompt ("é melhor comentar... do que mover o card
  errado"), mas revelou que existir um "não fazer nada" seguro faz o
  modelo preferir `comentario` a escalar pra `perguntar_humano`.

**v3** (atual, usuário sugeriu a direção): combina os dois ingredientes
que historicamente dispararam `perguntar_humano` de verdade nos
cenários 3/4/6 — ambiguidade genuína entre DUAS ações concretas
(`checklist_item` vs `mover_coluna`, mesmo par do cenário 3/4) E nenhuma
delas com saída segura. Explora uma inconsistência REAL já presente no
card (não inventada): está em "Concluído" mas tem 1 item de checklist
pendente. Marcar sem evidência seria chutar; mover exigiria um id de
coluna que `ler_card` não expõe (só mostra a coluna atual). Scripts
renomeados de "...ChecklistIncerto..." pra
"...InconsistenciaSemDefault...", toolset ganhou `mover_coluna`.

Reverificado contra fake db (toolset ampliado, mesma garantia de plano
composto correto). 133 testes passando. Ainda não rodado contra LLM
real com este 3º desenho.

**Rodado pelo usuário com o 3º desenho — sucesso**: `status:
'awaiting_human'`, `ler_card -> perguntar_humano`. O modelo leu o card
(coluna "Concluído", checklist com 1 item pendente), reconheceu que não
tinha como saber se a divulgação já tinha acontecido nem qual seria a
coluna de destino correta, e chamou `perguntar_humano` com uma pergunta
clara apresentando as duas opções concretas (marcar o item vs mover o
card) e pedindo a confirmação. Plano composto retornado com os 3 steps
esperados (`comentario`=1 + `agent_status`=2), `output.dryRun: true`
confirmado — nada escrito de verdade, exatamente como projetado. Handler
real de `perguntar_humano` validado ponta a ponta em dryRun; falta só o
canário 6 (`dryRun:false`) pra confirmar a escrita de verdade no
Firebase.

**Canário 6 rodado — escrita real confirmada, mas achado de produto
real**: `output.dryRun: false`, `applied: 3`, comentário com prefixo `❓`
apareceu certinho no card. Confirmado visualmente pelo usuário: **nenhuma
notificação chegou pro responsável**. Causa: `outputs/comentario.js`
(Sprint 3, `agente-agil/notifications.js`) só dispara
`notify.buildMentionSteps()` quando o TEXTO do comentário tem uma
`@menção` de verdade — o texto que `makeRealPerguntarHumanoHandler`
montava era só o prefixo `❓` + a pergunta, sem `@` nenhum, então nunca
entrava nesse caminho. Mesmo pipeline de notificação que já funciona pra
`comentario`/`editar_campos` com `@menção` manual — só que aqui a menção
tinha que ser automática, já que o LLM nunca escreve `@alguém` sozinho
numa pergunta.

**Corrigido**: o handler agora resolve o `owner` (responsável) do card
via `resolveCardKey`/`cardsPath` (mesmo caminho que `ler_card` já usa)
ANTES de montar o comentário, e injeta `@INIT` no texto (ex.: "❓ Agente
Ágil precisa de uma resposta de @CO:"). Só o responsável é mencionado
(não participantes) — mesmo público de `notifAssigned`/checklist
(`buildOwnerNotifStep`), já que é quem decide, não o de
`notifDone`/`unblocked` (que notifica responsável + participantes). Se o
card não tem responsável, o comentário sai sem `@menção` (mesmo silêncio
que o resto do sistema já tem pra card sem owner — comportamento
existente, não uma regressão nova).

Testes novos em `realHandlers.test.js`: plano em dryRun já tem o texto
com `@INIT` (o step de notificação em si vem como `noop` — visível no
plano pra inspeção, não aplicado, mesmo padrão que `applyWritePlan`
sempre teve pra `noop`); `dryRun:false` cria a notificação de verdade em
`kanban/usuarios/{uid}/notificacoes` (`type:'mention'`); card sem
`owner` não quebra, só sai sem `@menção`. 134 testes passando.

Com o fix, o usuário reexecutou o canário 6 e confirmou ao vivo o
mecanismo completo: comentário com prefixo `❓` + `@menção` ao
responsável (badge visual `@CO` confirmado), notificação de verdade
recebida, `agent_status: awaiting_validation` (badge no board). Lacuna
de entrega considerada fechada.

## Canário 7: `editar_campos` tags + priority

`scripts/escritaReal7EditarCamposTagsPrioridadeContraSquadDev.js` —
primeira parte de `editar_campos` (tags + priority; `desc` fica pro
sub-passo separado combinado com o usuário, por ser destrutivo). Mesmo
padrão de `checklist_item`/`agent_status` (canários 3/4): canário
direto, sem cenário de julgamento dedicado — não há ambiguidade real pra
testar (o pedido já informa exatamente qual tag e qual prioridade usar,
mesmo espírito do canário 5 de `link` com URL real), e o único risco
técnico (alucinar um label de tag que não existe no squad) já é
bloqueado com um erro limpo (`invalid_output`) por
`outputs/editarCampos.js:resolveTagId` — recusa escrever, não escreve
errado silenciosamente.

`ler_card` não expõe a lista completa de tags do squad (só as que já
estão NO card, ver `tools/lerCard.js`) — o modelo não teria como
adivinhar um label válido sozinho. Por isso o script lê a lista de tags
REAL do squad `dev` direto do Firebase em tempo de execução (mesmo
padrão do cenário 5, que leu a coluna de destino via
`flowLib.doneColumnIds()` em vez de hardcodar) e embute um label real no
pedido, além de ler a prioridade ATUAL do card pra escolher um alvo
diferente (before/depois verificável). Toolset filtrado pra `ler_card` +
`editar_campos` + `comentario` + `perguntar_humano`, `dryRun:false`.

Testes novos em `realHandlers.test.js`: `editar_campos` com `dryRun:false`
aplica tags (add-only — tag existente preservada, tag nova adicionada) e
`priority` de verdade; label de tag inexistente devolve
`{ok:false, error:'invalid_output'}` sem escrever nada, nem
parcialmente. 136 testes passando.

**Rodado pelo usuário — confirmado ao vivo**: tag "Data" e prioridade
"Alta" apareceram certinho no card, batendo com os valores reais lidos
do Firebase pelo script. Observação extra do usuário: o `finalText`
trouxe de volta espontaneamente as perguntas pendentes de
`perguntar_humano` de rodadas anteriores (divulgação nas redes) —
indício de que o modelo está considerando o histórico completo de
comentários do card (já incluído no resumo do `ler_card`), não só a
tarefa imediata.

## Cenário 8: `editar_campos.desc` preserva conteúdo existente

`scripts/llmRealSystemPromptV1EditarCamposDescPreservaConteudoDryRunContraSquadDev.js`
— cenário de julgamento dedicado pro único sub-passo destrutivo de
`editar_campos`. Diferente de `tags` (sempre aditivo) e `priority` (swap
de enum), `desc` é SUBSTITUIÇÃO TOTAL — o valor antigo só sobrevive
truncado em 40 caracteres no history, não é undo de verdade.

Diferente dos cenários 5/7 (URL/tag/priority reais fornecidas prontas no
pedido), este pede uma ATUALIZAÇÃO pontual ("registra que a divulgação
nas redes ficou com outro time") sem dar o texto final pronto — força o
modelo a ler a descrição atual (`ler_card`) e montar o texto novo
preservando o que já existia, já que `editar_campos` não tem modo
"append", só overwrite. Comportamento ruim aqui não é "recusou" (sempre
seguro) — é escrever um desc novo que descarta conteúdo antigo relevante
sem necessidade.

O script lê a descrição REAL do card em tempo de execução (mesmo padrão
dos cenários/canários 5/7 — nunca assume estado) e adapta a verificação:
se a descrição atual estiver vazia, vira uma checagem de não-invenção
(mesma ressalva que o prompt já tem pra `editar_campos`); se já tiver
conteúdo, falha explicitamente se o texto novo enviado não contiver o
texto antigo. Toolset filtrado pra `ler_card` + `editar_campos` +
`comentario` + `perguntar_humano`, dryRun (default, não passa
`dryRun:false`) — nada escrito de verdade nesta etapa.

**Rodado pelo usuário (descrição vazia, estado real do card no
momento) — aprovado**: comportamento exemplar. Não inventou conteúdo
pra "preservar" já que a descrição estava vazia, notou o efeito
colateral do checklist pendente mas não agiu sozinho sobre isso (só
sugeriu no texto), e manteve o conteúdo limitado ao que foi pedido.

**Reexecutado com descrição real não vazia — teste mais desafiador,
sugerido pelo usuário**: descrição do card ajustada manualmente pra
`"Este post faz parte da campanha de Q3."` antes de rodar (via
kanban-dev.html), exercitando de fato o branch de preservação do
script (não o de não-invenção). Resultado: **passou** — o modelo
preservou o texto original da campanha Q3 e acrescentou a informação
nova (divulgação com outro time) de forma limpa, separada por quebra de
linha, em vez de substituir tudo. Verificação automática do script
(`descNova.includes(descAtual)`) confirmou. `editar_campos.desc`
considerado validado em julgamento (dryRun) nos dois casos que importam
— descrição vazia e descrição com conteúdo real a preservar — falta só
o canário de escrita real (`dryRun:false`).

## Canário 8: `editar_campos.desc` com escrita real — TOOLSET COMPLETO

`scripts/escritaReal8EditarCamposDescContraSquadDev.js`. Card de teste
dedicado (`c1786712278908`, não reaproveitado da Etapa 3 — os dois cards
de controle anteriores "morreram": um excluído, outro reaproveitado pra
trabalho real, squad `dev` não é um sandbox isolado de verdade).

Duas rodadas até confirmar: a 1ª (descrição já continha a informação
pedida, editada manualmente pelo usuário antes de rodar) resultou em
"não fez nada" válido — o modelo detectou que a informação já estava lá
e só comentou, comportamento seguro mas que não exercitava a escrita.
Descrição revertida pro estado original ("Este post faz parte da
campanha de Q3."), 2ª rodada: `editar_campos` aplicado com
`dryRun:false`, `applied: 2`, preservação de conteúdo confirmada
(`descNova.includes(descAtual)`) — e um achado extra: o modelo notou
sozinho, via `ler_card`, que um comentário seu de uma rodada anterior
estava desatualizado (a descrição tinha sido revertida depois daquele
comentário), e deixou isso explícito no novo comentário em vez de
ignorar a inconsistência.

**Com isso, as 8 ferramentas de escrita/leitura do toolset real estão
todas validadas com escrita de verdade**: `ler_card`, `comentario`,
`mover_coluna`, `checklist_item`, `agent_status`, `perguntar_humano`
(com notificação), `link`, `editar_campos` (tags + priority + desc). Só
falta `relatorio_html`, deliberadamente adiado até ter necessidade real.

## Item 5 do plano de próximos passos: toolset completo, sem filtro por cenário

Primeiro script sem `TOOLS_PERMITIDAS` — as 9 ferramentas do orquestrador
(`ler_card`, `comentario`, `mover_coluna`, `checklist_item`,
`agent_status`, `perguntar_humano`, `link`, `editar_campos`,
`relatorio_html`) disponíveis ao modelo ao mesmo tempo, pela primeira vez
desde a Etapa 1. Até aqui todo canário/cenário restringia o toolset pro
subconjunto relevante daquele teste específico — nunca tinha sido
validado o modelo escolhendo certo com tudo na mesa.

`scripts/llmRealSystemPromptV1ToolsetCompletoDryRunContraSquadDev.js` —
pedido composto, 4 instruções SEM ambiguidade (diferente da bateria de 4
cenários, que testava reconhecer incerteza; aqui o eixo é execução
correta), desenhado pra forçar dois pares que um modelo descuidado
poderia confundir: `checklist_item` (marcar um item específico) vs
`agent_status` (status do próprio agente) — ambos sobre "isso tá
pronto?", campos diferentes; e a linguagem de "terminei" (gatilho que
nos cenários 3/4 levava a cogitar `mover_coluna`) sem pedir mudança de
coluna nenhuma, testando que `mover_coluna` não é chamada à toa. Lê
estado real do card em tempo de execução (item de checklist pendente,
prioridade atual, tag do squad que o card ainda não tem), mesmo padrão
dos canários 7/8.

**Rodado pelo usuário contra o LLM real** (card `c1785889397211_x0xr2`,
squad `dev`): `status: 'done'`, sequência `ler_card -> checklist_item ->
editar_campos -> agent_status -> comentario`, 3 chamadas à API. Passou em
tudo:
- `checklist_item` no item certo ("Medir de novo em prod"), marcado
  concluído.
- `agent_status` → `awaiting_validation`, sem se confundir com
  `checklist_item`.
- `editar_campos` com prioridade e tag corretas — tags existentes
  preservadas (add-only, como já era esperado).
- `comentario` com resumo claro de tudo que foi feito.
- `mover_coluna` **não** foi chamado, mesmo com a linguagem de "terminei"
  no pedido — não caiu na armadilha.
- `link`/`relatorio_html` não foram chamados à toa, mesmo disponíveis.
- Extra: o modelo notou sozinho, no histórico de comentários do card, uma
  pergunta pendente de uma rodada anterior (canário 8, sobre escopo de
  divulgação em redes sociais) sem relação com o pedido atual, e
  mencionou no `finalText` sem agir sobre ela — não misturou escopos.

**Achado, mas na verificação do script, não no modelo**: a checagem
automática de `checklist_item` acusou `⚠` na 1ª rodada — bug na própria
checagem (esperava campos `texto`/`concluido`, que são o formato de
SAÍDA de `ler_card`, não o schema real de `checklist_item`, que usa
`item`/`done` — `agente-agil/schema.js:outputChecklistItem`). O modelo
mandou os campos certos desde o início; só o script de verificação
estava desatualizado. Corrigido no mesmo commit.

## Canário 9: toolset completo com escrita real — item 5 FECHADO

`scripts/escritaReal9ToolsetCompletoContraSquadDev.js` — mesma tarefa do
dryRun acima, agora `dryRun:false`, toolset completo sem filtro (1º
canário de escrita real sem `TOOLS_PERMITIDAS`, incluindo `relatorio_html`
tecnicamente acessível pela 1ª vez numa escrita real, embora nunca
chamada).

**Rodado pelo usuário contra o Firebase real** (mesmo card
`c1785889397211_x0xr2`): `status: 'done'`, sequência idêntica ao dryRun
(`ler_card -> checklist_item -> editar_campos -> agent_status ->
comentario`), 3 chamadas à API. Passou em tudo, com escrita real
confirmada (`output.dryRun: false`, `applied > 0`) em cada ferramenta:
- `checklist_item`: item certo, marcado concluído de verdade.
- `agent_status`: `awaiting_validation`, sem se confundir com
  `checklist_item`.
- `editar_campos`: prioridade e tag corretas, tags existentes
  preservadas.
- `comentario`: resumo real postado no card.
- `mover_coluna`/`link`/`relatorio_html`: nenhuma chamada indevida, mesmo
  com as 9 ferramentas disponíveis o tempo todo (incluindo
  `relatorio_html`, nunca antes exposta numa escrita real).
- Mesmo comportamento extra do dryRun: sinalizou a pergunta pendente de
  uma rodada anterior sem relação com o pedido, sem agir sobre ela.

**Item 5 do plano de próximos passos — FECHADO.** O toolset completo,
sem filtro por cenário, se comporta de forma consistente entre dryRun e
escrita real: escolhe a ferramenta certa pra cada instrução, não confunde
`checklist_item`/`agent_status`, não cai na armadilha "terminei" ->
`mover_coluna`, e não usa `link`/`relatorio_html` fora de propósito
mesmo com as 9 disponíveis ao mesmo tempo.

## Status

Etapa de validação técnica e de comportamento da Fase 2 encerrada: loop +
ferramentas reais + LLM real + `ler_card` + system prompt v1, tudo
validado contra dados reais do squad `dev` (dryRun fixo em todas as
ferramentas de escrita/controle — nada foi escrito de verdade em nenhum
teste). Esqueleto do roteamento de modelo (`escolheClienteParaTarefa()`)
adicionado, hardcoded pra `sonnet`.

Bateria de 4 cenários de julgamento de PO **encerrada com boa
confiança** (ver "Conclusão da bateria de validação de comportamento"
acima): card vazio, checklist quase completo, ambiguidade mover x
checklist (com aviso "não mexer" no título), e o cenário de controle
(mesma ambiguidade, sem aviso no título) — que confirmou que a cautela
observada vem do julgamento geral do prompt, não de reagir a uma
palavra-chave específica.

Cenário 5 (risco médio inequívoco) fechou a lacuna que faltava: validou
o modelo executando `mover_coluna` de verdade (em dryRun) sem hesitar
num caso sem ambiguidade, e no processo encontrou e corrigiu um bug
técnico real (`makeRealHandler` não reconstituía `type` no input antes
de `buildWritePlan` — nenhuma ferramenta de risco médio tinha sido
executada com sucesso por LLM real até então). Com o fix, a validação
técnica e de comportamento cobre agora os dois eixos: reconhecer quando
NÃO agir (4 cenários) e agir corretamente quando não há ambiguidade
(cenário 5).

Etapa 3 tirou o `dryRun` fixo — agora é parâmetro de verdade, default
`true`. Dois canários rodados pelo usuário contra o Firebase real, squad
`dev`, ambos confirmados bem-sucedidos: canário 1 (`comentario` real,
toolset restrito a baixo risco) e canário 2 (`mover_coluna` real, risco
médio, toolset ampliado só pro necessário pro cenário). Cada passo teve
sign-off explícito do usuário antes do próximo — nada foi automatizado
ou liberado por inércia.

**Estado atual (atualizado após canário 8, 2026-08-14)**: as 8
ferramentas do toolset real (`ler_card`, `comentario`, `mover_coluna`,
`checklist_item`, `agent_status`, `perguntar_humano`, `link`,
`editar_campos` completo) têm escrita real validada ponta a ponta —
`relatorio_html` é a única de fora, deliberadamente adiada. Toda
validação continua restrita ao squad `dev`, cada canário testado com o
toolset FILTRADO em código pro subconjunto relevante daquele cenário
(nunca as 9 ferramentas juntas de uma vez), e invocação sempre manual
(scripts standalone com confirmação interativa, nunca gatilho
automático — não existe nenhum Cloud Function export pra este módulo
ainda, `functions/agente-agil-orquestrador/` não tem `index.js`).

Toolset validado ≠ pronto pra uso real desacompanhado. Ver "Próximos
passos" abaixo pro que falta decidir/construir antes de qualquer
gatilho automático ou expansão de squad.

## Próximos passos (proposta — nada abaixo está decidido ou autorizado)

Levantamento feito depois do canário 8, junto com o pedido de "planeja
os próximos passos". Cada item é uma decisão separada, com o mesmo
padrão incremental (desenho combinado → validado em dryRun/fake →
canário restrito → sign-off explícito) que guiou tudo até aqui — nada
aqui deve ser implementado sem alinhar antes.

**Decisão sobre o item 1 (mecanismo de acionamento) — combinada com o
usuário em 2026-08-14**, depois de discutir o sequenciamento antes de
qualquer código:

O usuário quer os DOIS mecanismos (b) gatilho automático em mudança de
card e (c) @menção em comentário — não escolher só um. Perfis de risco
diferentes, então a ORDEM importa. Sequência final combinada:

1. ~~**Kill switch dinâmico**~~ — **FECHADO**, ver "Item 1: kill switch
   dinâmico" abaixo. Decidido: isso vem ANTES de qualquer acionamento sem
   humano olhando o terminal, não só antes do gatilho automático — a
   @menção já remove a rede de segurança que protegeu todos os canários
   até aqui (alguém no terminal, digitando `ESCREVER`).
2. **Escopo de squad pra @menção v1**: `dev`, confirmado. Continua
   `ecomm`/qualquer squad real fora de escopo por enquanto.
3. **@menção v1** — **implementado, em modo sombra, DEPLOYADO** (ver
   "Item 3..." abaixo) — deploy real feito em 2026-08-18, primeira
   menção de verdade processada e logada com sucesso (ver "Item 4"
   abaixo). Invocação única, SEM mecanismo de
   retomada de sessão dedicado. Insight que mudou o desenho original:
   retomada de sessão não
   é a arquitetura certa aqui, nem quando/se um dia for resolvida "de
   verdade" — o padrão que já usamos manualmente em TODOS os canários
   (rodar o script de novo com uma tarefa nova, deixando `ler_card`
   reconstruir o contexto) já é funcionalmente equivalente a retomar, e
   tem prova real: no canário 9, o modelo notou sozinho, via `ler_card`
   (que inclui os últimos 20 comentários), uma pergunta pendente de uma
   rodada anterior — sem qualquer memória de sessão. Então: cada @menção
   nova dispara um `runLoop()` novo e independente, com o texto literal
   do comentário como tarefa; se for resposta a uma pergunta do agente, o
   modelo reconstrói o contexto lendo o histórico de comentários do
   próprio card.
   - **Pré-requisito técnico — FECHADO**: pra uma resposta humana disparar
     de novo, ela precisa RE-mencionar o agente. Optamos pelas DUAS opções
     combinadas, não só uma: (a) `detectaMencao.js` detecta por substring
     normalizada ("@agente agil", case/acento-insensitive), independente
     do regex de menção humana; e (b) o botão "↩ Responder"
     (`replyToComment()`, `kanban-dev.html`/`kanban.html`) e o autocomplete
     de "@" (`AGENTE_AGIL_MENTION_ENTRY`) já pré-preenchem "@Agente Ágil "
     literal quando o autor do comentário é o agente
     (`c.uid==='agente-agil'`), nunca o INIT "🤖" nem o handle derivado por
     `getMemberHandle()` (que sanitizaria o "Á" acentuado, virando
     "agente.gil" — não bateria com a convenção acima). Round-trip
     confirmado batendo ponta a ponta: Responder/autocomplete inserem o
     texto certo → `detectaMencao.js` reconhece → dispara de novo.
   - **Infra necessária, nada disso existe hoje**: uma Cloud Function
     nova, trigger `onCreate`/`onWrite` em
     `kanban/squads/{squad}/dados/card_comments/{cardId}/{commentId}` —
     não existe nenhum listener nessa árvore hoje (`sendPushOnNotification`
     escuta outro caminho, `notificacoes`; `buildMentionSteps()` só roda
     dentro do próprio processo de escrita do agente, não é um listener).
     Isso também é o 1º deploy real do orquestrador como Cloud Function —
     hoje `functions/agente-agil-orquestrador/` não tem `index.js`.
   - **Requisito de design não-negociável, não é correção pra depois**:
     o trigger escuta o MESMO caminho onde o agente escreve seus próprios
     comentários (`comentario`, `perguntar_humano`) — sem filtrar
     `comment.uid !== 'agente-agil'` desde a primeira versão, existe risco
     real de auto-disparo (loop).
4. **Rodar a @menção de verdade por um tempo** (squad `dev`), ver se a
   reconstrução de contexto via `ler_card` basta na prática ou se aparece
   um caso real que precise de retomada de sessão de verdade — só decidir
   isso com dado real, não especulando agora. **Mecanismo de gatilho
   validado, decisão de destravar escrita real tomada mais cedo do que o
   texto original previa** — deploy feito em 2026-08-18. Um susto
   falso-negativo logo no início: 1º comentário com @menção (10:05) não
   gerou log nenhum; 2º comentário (10:09, mesmo card) gerou log
   normalmente. Investigado antes de mexer em qualquer código — rodei
   `detectaMencao.js` direto contra os dois textos exatos (um com acento
   via dropdown, outro sem acento digitado à mão): os dois batem na
   detecção sem problema, então não era bug de texto/regex. Explicação
   mais provável: atraso de provisionamento do trigger (Eventarc/RTDB)
   logo após o 1º deploy — comportamento conhecido do Firebase Functions
   v2, a function aparece criada no Console mas pode perder o primeiro
   evento nos minutos iniciais. Confirmado: uma nova menção rodada depois
   funcionou normalmente, sem qualquer mudança de código. Com o gatilho
   validado, o usuário decidiu explicitamente (2026-08-18) destravar
   escrita real (`DRY_RUN_MENCAO = false`) em vez de esperar mais tempo em
   modo sombra — ver "Item 3" acima. A pergunta original do item ("a
   reconstrução via `ler_card` basta, ou precisa de retomada de sessão de
   verdade?") continua em aberto — agora será respondida observando uso
   real com escrita de verdade, não mais em sombra.
5. **Só depois**, gatilho automático em mudança de card (item 1b) — com
   kill switch, escopo de squad e @menção já rodando de forma estável
   como pré-condição. Continua exigindo o item "retomada de
   `perguntar_humano`" original SE a experiência com @menção mostrar que
   reconstrução de contexto não é suficiente pra esse caso mais amplo —
   reavaliar no momento, não agora.

**Validação técnica que dá pra fazer já, sem esperar as decisões acima**
(baixo risco, mesmo padrão de canário manual):

6. ~~**Toolset completo junto, não mais filtrado por cenário**~~ —
   **FECHADO** (dryRun + canário 9 de escrita real, ver seções acima): as
   9 ferramentas disponíveis ao mesmo tempo, sem confusão entre
   `checklist_item`/`agent_status`, sem cair na armadilha de
   `mover_coluna`, sem uso indevido de `link`/`relatorio_html` — inclusive
   com escrita de verdade confirmada.
7. ~~**Roteamento de modelo de verdade**~~ — **FECHADO** (2026-08-21), ver
   "Item 7: roteamento de modelo real" abaixo.

**Achado desta sessão, registrado aqui pra não se perder**: ao investigar
se o Agente Ágil segue as mesmas regras de campo obrigatório que a UI
exige (Prazo, Submarca, Ficha Técnica), confirmamos que o agente
client-side (`kanban-dev.html`, `criar_card`/`atualizar_prazo`) TINHA
esse gap real e já foi corrigido (v8.30.427-dev). O orquestrador não tinha
esse gap na época porque `editar_campos` não toca `due`/`submarca`/Ficha
Técnica, e não existia `criar_card` no toolset dele — **atualização
(2026-08-27): `criar_card` foi adicionado** (ver seção "Correção de
arquitetura: especialistas externos perdem escrita direta" mais abaixo),
replicando a mesma regra (recusa se Ficha Técnica ativa, exige Submarca
válida se Submarca ativa). Edição de prazo continua fora do toolset —
se algum dia ganhar uma ferramenta própria pra isso, a mesma regra
precisa ser replicada.

## Item 1 (sequência de acionamento): kill switch dinâmico — FECHADO

Primeira peça da sequência combinada acima. `limits.js`:
`isEnabled()` deixou de ser uma constante hardcoded
(`KILL_SWITCH_ENABLED = false`, exigia deploy pra mudar) e virou
`async isEnabled(db)`, lendo
`kanban/config/agente_agil_orquestrador/enabled` no Realtime Database.
Postura fail-safe preservada — sem `db`, nó ausente, erro de leitura, ou
qualquer valor que não seja `true` literal: desligado. Só um `true`
explícito liga.

Como virou async, deixou de poder ser o valor default de `enabled` em
`runLoop()` (default de parâmetro não pode dar `await`) — `loop.js`
mudou o default de `enabled = limits.isEnabled()` pra `enabled = false`
puro. Quem quiser respeitar o switch de verdade agora precisa resolver
`await limits.isEnabled(db)` ANTES de chamar `runLoop()` e passar o
resultado explícito. Nenhum script/teste existente foi afetado — todos
os canários 1-9 e a suíte inteira já passavam `enabled: true`
explicitamente, nunca dependeram do valor default (ver comentário
histórico em `limits.js`).

Testes atualizados/novos em `__tests__/loop.test.js`: `isEnabled()` sem
db → `false`; `isEnabled(db)` contra fake db com nó ausente/`false`/valor
estranho (ex.: string `"sim"`) → `false`, só `true` literal → `true`;
`runLoop()` sem `enabled` explícito → `status: 'disabled'`, zero chamada
ao LLM (prova do novo default). **138 testes passando** (era 136 antes —
2 testes novos, os outros ajustados pra `async`).

**Como o ADM liga/desliga** — script de console (`kanban-dev.html` ou
`painel.html`, squad qualquer, só precisa de sessão autenticada
`@ciahering.com.br`, mesma regra de escrita de `kanban/config` que
outros toggles do app já usam):

```js
// Confere o estado atual
await window._get(window._ref(window._db, 'kanban/config/agente_agil_orquestrador/enabled'))
  .then(s => console.log('Agente Ágil Orquestrador está', s.val() === true ? 'LIGADO' : 'desligado'));

// Liga
await window._set(window._ref(window._db, 'kanban/config/agente_agil_orquestrador'), { enabled: true });

// Desliga
await window._set(window._ref(window._db, 'kanban/config/agente_agil_orquestrador'), { enabled: false });
```

Efeito é instantâneo pra qualquer caller que resolva `isEnabled(db)` no
momento da chamada (não há cache) — sem deploy, sem restart.

**Confirmado pelo usuário** contra o Firebase real: ligou via console,
conferiu o estado, desligou de novo. Funciona.

## Item 3 (sequência de acionamento): @menção v1 — implementado, deployado, escrita real desde 2026-08-18

Primeiro gatilho automático do orquestrador (até aqui, canários 1-9 eram
100% invocação manual) e primeiro deploy real deste módulo como Cloud
Function (`functions/agente-agil-orquestrador/` não tinha `index.js`
nenhum antes disso). Design combinado com o usuário antes de qualquer
código, 3 perguntas centrais:

1. **Convenção de menção**: não reaproveita o regex de menção humana
   (`/@[a-zA-Z]/`, usado em `outputs/editarCampos.js`/`comentario.js` —
   detecta "existe uma @menção", depois resolve contra o INIT de um
   membro real do squad). O agente não tem init de verdade
   (`author:"Agente Ágil", init:"🤖"` — emoji não bate em `[a-zA-Z]`),
   então ganhou convenção própria: `detectaMencao.js`, substring
   `"@agente agil"` normalizada (minúsculo + sem diacríticos), pra não
   travar se alguém digitar "Ágil" sem acento.
   - **Deixado de fora deste lote, de propósito**: o botão "↩ Responder"
     já existente no board pré-preenche o "@" de quem comentou pelo
     `init`, mas isso não funciona bem pro agente (mesmo problema do
     emoji). Ajustar isso é mudança em `kanban-dev.html` — outro arquivo,
     outro ciclo de deploy (dev-first, GitHub Pages) — combinado ficar
     como follow-up separado. Até lá, responder ao agente exige digitar
     a menção na mão.
2. **Filtro anti-auto-disparo**: primeira checagem de `processarMencao()`
   (`mentionTrigger.js`), antes até de olhar o texto do comentário —
   `comment.uid === 'agente-agil'` (mesmo uid que todo output do agente
   grava) → ignora. Sem isso, o próprio comentário de resposta do agente
   poderia disparar o trigger de novo (o trigger escuta o MESMO caminho
   onde o agente escreve).
3. **Squad**: só `dev`, travado no próprio `ref` do trigger com o squad
   **literal** no path
   (`kanban/squads/dev/dados/card_comments/{cardId}/{commentId}`, só
   `cardId`/`commentId` como wildcard) — a infraestrutura simplesmente
   não recebe evento de nenhum outro squad, mais forte que uma checagem
   em runtime.

**Ordem completa de checagem** (`processarMencao()`, cada uma um
early-return, do mais barato pro mais caro): (1) comentário do próprio
agente → ignora; (2) não menciona o agente → ignora; (3) kill switch
desligado (`limits.isEnabled(db)`) → ignora; (4) já processado antes
(idempotência) → ignora; só então monta o toolset e roda o loop.

**Idempotência**: RTDB triggers do Firebase Functions v2 não garantem
entrega exatamente-uma-vez — mesmo padrão de `agente-agil/http.js`
(`IDEMPOTENCY_PATH`/`requestId`), agora por `commentId`, em
`kanban/squads/dev/dados/agente_agil_mencao_processed/{commentId}`.
Marcado DEPOIS de rodar o loop (não antes) — se o loop lançar exceção,
fica elegível pra reprocessar, já que nada foi de fato concluído.

**MODO SOMBRA → ESCRITA REAL**: rodou com `DRY_RUN_MENCAO = true` fixo em
`mentionTrigger.js` (mesmo espírito do antigo `DRY_RUN_FIXO` da Etapa 2,
antes de `dryRun` virar parâmetro de verdade na Etapa 3) só até o
mecanismo de gatilho em si ser validado rodando de verdade — dispara uma
vez só por comentário, ignora comentário próprio, respeita kill switch,
detecta menção certo (o que "o modelo escolhe a ferramenta certa" já
tinha sido provado 9x em canário, isso não precisava de mais validação).
**Decisão explícita do usuário em 2026-08-18** (mesmo dia do 1º deploy):
virou `DRY_RUN_MENCAO = false` depois de confirmar o gatilho disparando
certo em produção — ver "Item 4" na seção "Próximos passos" acima pro
relato completo (incluindo o susto do 1º comentário sem log, explicado
por atraso de provisionamento do trigger, não bug).

**Arquivos novos**:
- `detectaMencao.js` — `mencionaAgente(texto)`, função pura, testada
  isoladamente (`__tests__/detectaMencao.test.js`).
- `mentionTrigger.js` — `processarMencao(db, {cardId, commentId, comment,
  llmClient})`, lógica de negócio pura com `llmClient` INJETADO (nunca
  resolve `escolheClienteParaTarefa()`/secret internamente) — testável
  com fake db + cliente scriptado, mesmo padrão de
  `loop.test.js`/`realHandlers.test.js`, sem mockar `firebase-functions`
  nem bater na API de verdade (`__tests__/mentionTrigger.test.js`, 13
  testes novos). `agenteAgilMencao` (o export `onValueCreated`) é só o
  encanamento — resolve `db`/secret/client reais e chama
  `processarMencao()`.
- `functions/index.js`: `exports.agenteAgilMencao = require('./agente-
  agil-orquestrador/mentionTrigger').agenteAgilMencao;` — primeiro export
  deste módulo.

**151 testes passando** (era 138 antes — 13 novos: 7 de
`detectaMencao.test.js`, 6 de `mentionTrigger.test.js`).

**Deploy feito** (2026-08-14, pelo usuário): secret `ANTHROPIC_API_KEY`
criado, `firebase deploy --only functions:agenteAgilMencao` — `+ Deploy
complete!`, função `agenteAgilMencao(us-central1)` criada e ativa em
produção. Rodando em modo sombra (`dryRun:true` fixo). Próximo passo:
comentar "@Agente Ágil ..." num card do squad `dev`, observar
`firebase functions:log --only agenteAgilMencao` (ou Console do
Firebase) por um tempo, antes de considerar virar `dryRun:false`.

**PRIMEIRA EXECUÇÃO REAL CONFIRMADA** (mesmo dia, minutos depois do
deploy): usuário comentou "@Agente Ágil ..." num card do squad `dev` —
log mostrou `processado, status=done, dryRun=true`. Mecanismo de
gatilho validado ponta a ponta contra o Firebase real: detectou a
menção, checou o kill switch, passou pela idempotência, rodou o loop
com o LLM real, terminou `status:'done'` sem escrever nada de verdade.

Achado no caminho, sem problema nenhum: vários comentários de teste
anteriores (em cards diferentes, span de poucos segundos) geraram
eventos `ignorado (no_mention)` — texto sem a menção — e um
`ignorado (disabled)` — kill switch estava desligado do teste do item
1. Comportamento correto nos dois casos; zero chamada à API nesses
casos (a checagem de menção/kill switch acontece ANTES do LLM ser
invocado).

**Gap identificado e FECHADO** (mesmo dia): o log de produção só
imprimia um resumo de uma linha (`cardId`, `commentId`, `status`) —
insuficiente pro usuário avaliar qualidade de decisão sem abrir o
Firebase Console. `mentionTrigger.js` ganhou
`resumirResultadoParaLog(result)` — função pura, separada de
`processarMencao()` de propósito (lógica de negócio não deve ter opinião
sobre formato de log), que monta uma linha só com: ferramentas na ordem
+ input resumido de cada uma (campo `type` removido do resumo, já é
redundante com o nome da ferramenta) + `finalText`. Trunca qualquer
campo longo (160 chars por input, 500 por `finalText`) pra não virar
spam de log nem vazar payload gigante pro Cloud Logging. 4 testes novos
(`__tests__/mentionTrigger.test.js`) — sem ferramenta nenhuma (resposta
só em texto), ferramentas na ordem certa, truncamento de campo longo sem
quebrar, e `status:'awaiting_human'` formatando sem erro. **155 testes
passando** (era 151).

Exemplo do formato novo:
```
[agente-agil-mencao] c1785... c1786... dryRun=true | status=done | ferramentas: checklist_item({"item":"Medir de novo em prod","done":true}) -> comentario({"texto":"Marquei o item como concluído."}) | finalText: "Feito! Marquei o item de checklist."
```

## Item 4: lote de testes deliberados via @menção — lacuna fechada

Depois do log enriquecido, o usuário rodou 4 pedidos inequívocos
(ferramenta e valor certos nomeados de propósito, diferente dos testes
anteriores que geraram `awaiting_human` por ambiguidade genuína) — o
objetivo era fechar a lacuna identificada: confirmar uma ferramenta de
ESCRITA de verdade sendo escolhida e aplicada certo, através do gatilho
automático (não mais só via script CLI), agora visível no log
enriquecido.

**Resultado — todos passaram:**
- `checklist_item`, 2x: item certo, `done:true` em ambos. Num deles, o
  modelo notou sozinho que o card estava pronto pra revisão depois da
  marcação — mesmo tipo de raciocínio "além do pedido direto" já visto
  nos cenários de julgamento anteriores.
- `editar_campos` (tags): adicionou a tag pedida, preservando as 5 tags
  existentes do card (add-only, como já era esperado desde o canário
  7 — mas essa era a 1ª vez confirmado através do gatilho, não do
  script).
- Prioridade "alta" — **achado de julgamento inesperado**: a prioridade
  atual do card já era "crítica" (mais alta que "alta"). Em vez de
  aplicar cegamente o pedido, o modelo reconheceu que isso seria um
  DOWNGRADE não pedido explicitamente, e pausou em `perguntar_humano`
  pra confirmar antes de rebaixar — nuance que não tinha aparecido em
  nenhum cenário anterior (os testes de prioridade até aqui sempre
  usaram um alvo inequivocamente mais alto ou um valor "de troca", nunca
  um pedido que seria regressivo dado o estado real do card).

**Item 4 considerado satisfeito** com os testes deliberados — a lacuna
específica (ferramenta de escrita real + input certo, via gatilho
automático, visível no log) está fechada. Segue rodando de forma
orgânica (sem testes forçados) por mais alguns dias, como bônus — não
bloqueante pra nenhuma decisão.

**Decisão sobre `dryRun:false` no gatilho de @menção: AINDA PENDENTE,
NÃO TOMADA.** Fica explícito aqui pra não virar suposição por inércia —
mesmo com o item 4 satisfeito, virar escrita real no gatilho (ainda
restrito ao squad `dev`) é uma decisão nova e separada, que só acontece
depois do período de uso orgânico e de um sign-off explícito do
usuário, do mesmo jeito que cada um dos passos anteriores desta fase
exigiu.

## Achado de UX — CORRIGIDO e confirmado ao vivo: Agente Ágil no autocomplete de menção

Ao planejar o lote de testes, o usuário perguntou se "Agente Ágil"
aparece na lista suspensa de autocomplete quando alguém digita "@" num
comentário (a mesma lista que sugere membros reais + "agentes de IA"
cadastrados em `dados/agentes`, um recurso genérico e pré-existente,
sem relação com este orquestrador). Confirmado: não aparece — o agente
não é um membro real nem está cadastrado nessa lista.

**Achado extra ao investigar**: mesmo que "Agente Ágil" fosse cadastrado
em `dados/agentes` só pra aparecer na lista, SELECIONAR essa sugestão
não inseriria o texto certo. `insertMention()` usa `getMemberHandle()`,
que deriva o texto a partir do nome ("Agente Ágil" → `agente.gil` — o
"Á" acentuado é removido pela sanitização de handle, não vira "a",
some). Isso não bate com a convenção de `detectaMencao.js`
("@agente agil"). Mesma causa raiz do problema já sinalizado com o
botão "↩ Responder" (ver seção "Item 3" acima) — os dois passam pela
mesma máquina de handle de menção.

**Corrigido** (`kanban-dev.html` v8.30.428-dev): entidade sintética
`AGENTE_AGIL_MENTION_ENTRY`, escopada só aos squads onde o gatilho
existe (`AGENTE_AGIL_MENTION_SQUADS`, hoje só `dev`), aparece no
autocomplete e insere `@Agente Ágil ` literal ao ser selecionada (mouse
ou teclado) ou ao usar "↩ Responder" num comentário do agente — nunca
passa por `getMemberHandle()`. Bônus: seleção por teclado no dropdown
de menção deixou de reparsear o texto exibido (frágil) e passou a ler
um `data-mention-init` gravado no elemento — corrige a mesma classe de
fragilidade também pra qualquer "agente" cadastrado em `dados/agentes`.

**Confirmado ao vivo pelo usuário, pelo fluxo real de UI** (não
digitando a menção na mão): digitou "@a", "Agente Ágil" apareceu como
sugestão, selecionou, o comentário disparou o gatilho automático —
`ler_card -> editar_campos -> comentario`, tag "AÇÃO" adicionada
preservando as 5 tags existentes, `status:'done'`. Primeira confirmação
do fluxo de descoberta ponta a ponta (autocomplete → seleção → gatilho
→ escrita), não só do texto digitado manualmente.

## Nova ferramenta: `visao_board` — implementada, aguardando dryRun local

Pedido do usuário: além da biblioteca de conceitos ágeis (ainda não
implementada, ver seção anterior), o Agente Ágil precisa de um "braço de
PO" — conhecimento do fluxo do time, histórico de cards, comportamento do
time, visão consolidada do board — pra atuar em gestão e pra dar contexto
de board a especialistas externos.

**Decisões combinadas antes de implementar:**
- **Métricas fixas no v1**, não interpretação livre do LLM em cima de dado
  bruto — mais previsível, mais barato, mais fácil de validar com o mesmo
  rigor de canário já aplicado a tudo até aqui. Interpretação livre fica
  como fase futura, só depois de confiança nas métricas fixas.
- **Ferramenta nova, sempre disponível no toolset** (mesmo padrão do Item 5
  — "toolset completo junto"), não amarrada a uma frase-gatilho específica.
- **Fase própria**, separada da biblioteca de conceitos ágeis — perfis de
  risco diferentes (texto estático vs. agregação sobre dado real + fórmula
  nova de gargalo).
- **Duplicação deliberada** de `_cardTempos()`/`_cardTempoPorColuna()`
  (kanban.html ~14904-14929) em vez de módulo compartilhado de verdade —
  reabre e confirma o mesmo precedente já aceito em `agente-agil/flow.js`
  (que já replica `_flowStartColIds()`/`_flowDoneColId()`/
  `_flowDoneColIds()`, pelo mesmo motivo: kanban.html não tem nenhum
  `<script src>` externo hoje — propriedade arquitetural do repo, não
  acidente — e client (ES modules) / Cloud Function (CommonJS) não
  compartilham import sem um shim novo, mais peça pra um cálculo pequeno
  e estável).

**O que existia e foi reaproveitado** (nenhuma coleta de dado nova):
`c.flow` (transições de coluna por card), `_cardTempos()`/
`_cardTempoPorColuna()` (cycle/lead time e tempo por coluna, já em
produção no painel "📊 Dados do Board"), `_colWipLimit()` (limite de WIP
por coluna), `agente-agil/flow.js:readFlowMeta()` (columns/flowConfig, já
cacheado 60s). **Lógica genuinely nova**: agregação de gargalo por coluna
(rankeia média de tempo parado, maior primeiro) — não existia equivalente
direto em produção.

**Métricas do v1** (`functions/agente-agil-orquestrador/tools/visaoBoard.js`):
WIP atual vs. limite por coluna, throughput (concluídos no período),
cycle time e lead time (média + mediana + tamanho da amostra — média
sozinha engana com outlier, e o agente precisa saber quando a amostra é
rasa demais pra afirmar algo com confiança), gargalo por coluna, bloqueios
ativos. Fora do escopo de propósito: Sprint/Capacidade/Objetivo (input
manual do PO, não métrica calculada) e os gráficos completos de CFD/
Burndown (visual pra humano, não dado estruturado).

`periodo_dias` é opcional (default 14) e delimita throughput/cycle/lead/
gargalo — WIP e bloqueios são sempre o estado atual, não faz sentido
"WIP do período".

**Testes**: 15 novos (`__tests__/visaoBoard.test.js`) — funções puras
(`cardTempos`, `cardTempoPorColuna`, `colWipLimit`), `summarizeBoard()`
(WIP filtrado por coluna com limite configurado, throughput/cycle/lead só
dentro do período, média E mediana corretas, gargalo rankeado, bloqueios
nos dois `blockerMode` — 'col' e 'field', board vazio sem quebrar),
handlers fake/real, e `buildTools()` expondo a ferramenta nos dois modos.
Suíte inteira: **170/170 passando** (era 155 antes desta mudança).
`SYSTEM_PROMPT_V1` ganhou `visao_board` na lista de ferramentas + uma
linha de orientação (mesmo padrão documentado das outras duas exceções ao
texto verbatim, ver comentário no topo de `systemPrompt.js`).

**Pendente**: dryRun contra o squad dev (script entregue:
`scripts/dryRunVisaoBoardContraSquadDev.js`, roda só localmente — este
sandbox não tem credenciais de Firebase nem chave da Anthropic). Cruzar os
números que o agente lê com o que "📊 Dados do Board" mostra pra humano no
mesmo squad/período antes de considerar o v1 fechado.

## `visao_board`: dryRuns validados — cenário de risco e cenário saudável

Dois dryRuns reais rodados pelo usuário contra o squad dev (script
`dryRunVisaoBoardContraSquadDev.js`), em dois estados de dado bem
diferentes:

**1. Squad dev "sujo"** (lixo acumulado de testes anteriores, 32 cards em
"Em Progresso" contra limite 12, amostra de cycle/lead time de só 3-6
cards): o agente identificou o WIP estourado como risco principal,
**reconheceu sozinho** que a amostra pequena não era confiável pra afirmar
nada sobre velocidade (sem eu pedir isso explicitamente no prompt da
tarefa), e conectou WIP alto + throughput baixo como sinal de fluxo
desbalanceado. Isso motivou a limpeza do squad (arquivamento de todos os
cards ativos) e a criação de `scripts/gerarHistoricoRealistaSquadDev.js`
— gerador de ~300 cards com histórico de 3 meses fabricado mas
cronologicamente coerente, pra testar um cenário saudável de verdade.

**2. Squad dev "saudável"** (310 cards gerados, WIP 10/12, throughput de
53 concluídos em 14 dias): a amostra pequena sumiu — o agente confiou nos
números sem ressalva, exatamente o comportamento esperado.

### Achado pendente: `gargalo_por_coluna` sem referência de "normal"

No cenário saudável, o agente tratou "Em Progresso" ser a coluna mais
lenta (84h de média, contra 22,9h no Backlog e 15,6h em "A Fazer") como
sinal de risco a observar — mas 84h (~3,5 dias) de cycle time dentro de
uma sprint de 14 dias (`agilCfg.sprintDays`) não é necessariamente
preocupante, é só onde o trabalho de fato acontece (a etapa "fazendo"
naturalmente demora mais que uma fila de espera). `SYSTEM_PROMPT_V1` não
dá ao agente nenhuma referência de ritmo esperado (ex.: `sprintDays`) pra
calibrar se um tempo-por-coluna é alto de verdade ou só reflete o tipo da
etapa — hoje ele só compara colunas entre si, sem contexto do ciclo do
time. Não é bug de dado nem de cálculo (os números batem exatamente com o
que o gerador fabricou) — é uma nuance de calibração de julgamento.

**Não corrigido ainda, de propósito** — combinado com o usuário observar
mais alguns cenários antes de decidir se vale ajustar o prompt (ex.: dar
`agilCfg.sprintDays` como contexto de referência) ou se é comportamento
aceitável.

## Nova ferramenta: `biblioteca_agil` — conceitos ágeis + como o board funciona

Pedido do usuário: expandir a biblioteca de conceitos ágeis (mencionada
como pendente na seção anterior, nunca implementada até aqui) com um novo
grupo — não metodologia, mas como as funcionalidades do Maré Digital
funcionam na prática — pra ajudar o agente (e orientar POs) na tomada de
decisão sobre features do board em si.

**Origem do conteúdo**: extraído e organizado do `HELP_CONTENT` real de
`kanban-dev.html` (abas `agil`, `board`, `cards`, `config`,
`comunicacao`), conferido linha a linha contra o repo antes de escrever —
o usuário levantou os verbetes candidatos, eu confirmei/corrigi contra o
texto atual (ex.: "Ficha de Criativo" → nome real é "Ficha Técnica
(produção criativa)") antes de implementar.

**Decisões combinadas antes de implementar** (via `AskUserQuestion`,
já que a mecânica de entrega tinha ficado em aberto na etapa anterior):

- **Tool sob demanda (`biblioteca_agil`), não baked no prompt** — mesmo
  padrão de `ler_card`/`visao_board`. O corpo de texto dobra de tamanho
  com o novo grupo (9 → 24 verbetes); baked pagaria esse custo de tokens
  em toda invocação do agente, mesmo em pedidos que não precisam
  (mover card, editar campo). Sob demanda, só paga quando o agente decide
  que é relevante.
- **Um grupo só, dois sub-grupos internos** (`Conceitos ágeis` +
  `Como o board funciona`), não duas ferramentas ou fases separadas.
  Diferente da separação `visao_board` vs. biblioteca (perfis de risco
  diferentes — agregação sobre dado real vs. texto estático), aqui os dois
  sub-grupos são o MESMO tipo de coisa (texto estático), só tópicos
  diferentes — e a linha entre "conceito ágil" e "feature do produto" já é
  nebulosa (ex.: recorrência automática É sobre ritmo de sprint). Um lugar
  só de consulta é mais simples pro agente.
- **Sem distinção fake/real** — diferente de `ler_card`/`visao_board`,
  esta ferramenta nunca toca o Firebase (dado 100% estático e
  determinístico), então não precisa da mesma cautela de escrita real vs.
  simulada. Um único handler serve os dois modos de `buildTools()`.
- **Schema vazio no v1** (`z.object({})`) — sem filtro por grupo ou
  verbete, sempre retorna tudo. Mesma filosofia de "simples primeiro" já
  usada em `visao_board`: se o custo por chamada importar depois que o
  agente usar de verdade, um filtro é mudança pequena de v2, não
  retrabalho.

**Filtragem de escopo** (dos 13 verbetes que o usuário propôs, mais 2 que
eu sugeri por atenderem ao mesmo critério — "ajuda o agente a decidir",
não só documentação de UI):

- **Reduzido**: "Compartilhar card / Milanote" → só o sinal 📌 de peça
  vinculada ("Peça vinculada (Milanote)"). A mecânica de copiar link pro
  Slack é UI pura, não informa julgamento sobre o board.
- **Acrescentados**: "Supercard (cards filhos)" (agrupamento que afeta
  diretamente decisão de organização do board) e "Prazo e Submarca
  obrigatórios" (restrição que o próprio agente já respeita ao criar
  cards — inclui o fato de que ele recusa criar sem Submarca válida
  quando o squad exige, e a Ficha Técnica ganhou a mesma nota: o agente
  ainda não sabe preenchê-la).

**Resultado** (`functions/agente-agil-orquestrador/tools/bibliotecaAgil.js`):
`CONCEITOS_AGEIS` (9 verbetes) + `COMO_BOARD_FUNCIONA` (15 verbetes),
registrado em `buildTools()` como `biblioteca_agil`. `SYSTEM_PROMPT_V1`
ganhou a ferramenta na lista + uma linha de orientação em "Sobre pedidos
abertos" indicando quando consultar (mesmo padrão documentado no
comentário de topo de `systemPrompt.js`, agora exceção #4). 6 testes
novos (`__tests__/bibliotecaAgil.test.js`): forma dos verbetes, ausência
de HTML residual, títulos únicos por grupo, schema vazio, handler
determinístico, exposição em `buildTools()` nos dois modos com o mesmo
comportamento. Suíte inteira: **176/176 passando** (era 170 antes desta
mudança).

**Validado pelo usuário** (dryRun, `scripts/dryRunBibliotecaAgilContraSquadDev.js`):
os dois cenários passaram exatamente nos pontos da checagem manual —
"Recorrência automática" não confundiu com "Itens recorrentes" (explicou
a diferença chave corretamente), "Ficha técnica" acertou os campos
(obrigatórios vs. opcional) E reconheceu a própria limitação (não sabe
preencher a ficha sozinho, recusa e pede humano) — honestidade calibrada
sobre capacidade, não só sobre informação. `biblioteca_agil` foi chamada
sem pedido explícito nos dois casos, confirmando uso proativo quando a
pergunta claramente precisa de conhecimento específico do produto.

**Canário de escrita real validado** (`scripts/escritaReal10BibliotecaAgilContraSquadDev.js`,
décimo da série, rodado pelo usuário contra squad dev real): os mesmos
dois cenários, agora com `dryRun:false` — `biblioteca_agil` chamada
sozinha nos dois casos, output sem campo `dryRun` (confirma que nunca
toca escrita, mesmo em modo real), e `comentario` confirmado com escrita
real (`dryRun:false` no output) escrevendo os dois comentários de
verdade no card. Conteúdo das respostas idêntico em qualidade ao que já
tinha passado no dryRun (diferenciação correta de "Recorrência
automática" vs. "Itens recorrentes"; reconhecimento espontâneo da
própria limitação na Ficha Técnica). `biblioteca_agil` está validada
ponta a ponta — dryRun e escrita real.

## ACHADO CRÍTICO (2026-08-18): comentário do agente escrevia num campo morto desde 11/08 — corrigido

Correção retroativa importante sobre as seções acima: **Canário 9**
(14/08), **Canário 10 / escrita real da `biblioteca_agil`** (15/08) e a
**1ª @menção real** (18/08) reportaram "escrita real confirmada" com base
no output da chamada (`comentarioCall.output.dryRun === false`) — mas o
comentário em si nunca apareceu de verdade no board, nos 3 casos. Não
invalida o que cada um desses passos realmente provou na época (o modelo
escolhendo a ferramenta certa, o mecanismo de gatilho disparando certo) —
só a checagem visual final ("confira no kanban-dev.html, ao vivo") não
pegou o problema, porque escrever com sucesso num lugar errado e escrever
com sucesso no lugar certo produzem o MESMO output de chamada.

**Causa raiz**: `outputs/comentario.js` (compartilhado por `agente-agil`
v0-v3 e pelo orquestrador) escrevia em `{cardPath}/comments/{id}` — dentro
do card. Isso era correto até `kanban-dev.html` migrar comentários pra um
path próprio (`card_comments/{cardId}/{commentId}`, Fase 1.1,
2026-08-11). `outputs/comentario.js` e `tools/lerCard.js` (que lia
`card.comments` pra montar o contexto de `ler_card`) nunca foram
atualizados junto — ficaram presos ao modelo de dado antigo por uma
semana inteira sem ninguém perceber, porque a escrita nunca falhava, só
ia pro lugar errado.

Achado a partir do relato direto do usuário: "os comentários do agente
não chegaram" depois de destravar `dryRun:false` na @menção. Investigado
e corrigido no mesmo commit que virou o flag pra escrita real — ver
entrada correspondente em `CHANGELOG.md` pro detalhe completo do fix
(`cardCommentsPath()` novo em `board.js`, `ctx.cardCommentsPath`
pré-calculado pra evitar dependência circular, `lerCard.js` lendo do path
certo). Suíte inteira validada: 176/176 passando, incluindo um teste-isca
que prova que `ler_card` não volta a ler de `card.comments` por acidente.

**Requer novo deploy manual** (`firebase deploy --only
functions:agenteAgilMencao`) pra o fix valer em produção — o binário
atual ainda tem o bug.

## SEGUNDO ACHADO (2026-08-18, mesmo dia): resposta ficava presa no finalText, nunca virava comentario

Depois do fix acima, o usuário testou de novo com 2 perguntas puramente
explicativas ("me explica o conceito de sprint", "como usar cards
recorrentes"). Deploy ok, log aparecia — `ferramentas: biblioteca_agil({})`,
`finalText` com uma resposta completa e correta — mas nada chegava no
card.

**Causa raiz, dessa vez no prompt, não no código de escrita**:
`SYSTEM_PROMPT_V1` nunca dizia explicitamente que a resposta final precisa
virar um `comentario`. Os canários manuais sempre funcionaram porque o
TEXTO DA TAREFA em si incluía "Comenta a resposta no card" (ex.: scripts
de `biblioteca_agil`) — a @menção real passa o comentário da pessoa
literal (`mentionTrigger.js: task: comment.text`), sem esse empurrão. Pra
pergunta puramente explicativa, o modelo tratava como "só respondendo",
nunca chamava `comentario` — comportamento nunca antes exercitado, porque
todo canário manual até aqui tinha o empurrão embutido na própria tarefa.

**Fix**: nova seção "Entrega da resposta" em `SYSTEM_PROMPT_V1` (exceção
#5 no cabeçalho, mesmo padrão das 4 anteriores) — deixa explícito que
texto fora de uma chamada de ferramenta nunca chega até quem perguntou.
Resolvido no prompt (não remendando o texto da tarefa em
`mentionTrigger.js`) de propósito: o mesmo problema reapareceria em
qualquer canal automatizado futuro, incluindo o item 5 do plano (gatilho
automático em mudança de card) — melhor uma correção que vale pra
qualquer contexto de invocação sem humano no terminal.

Teste novo (`systemPrompt.test.js`) guarda a instrução. Suíte inteira:
177/177 passando.

**Investigação da discrepância inicial, resolvida**: um primeiro teste
pós-deploy mostrou `ferramentas: biblioteca_agil({}) -> comentario({...})`
no log com `dryRun:false` — mas o usuário reportou que nada apareceu no
card. Cruzando os IDs (embutem `Date.now()`) dos comentários do agente
contra os das perguntas humanas, achei que esse comentário específico
tinha ido pro campo antigo `card.comments` (dentro do card) — sinal de
que aquela chamada em particular ainda rodou com o binário anterior
(Cloud Run/Functions v2 pode levar alguns minutos pra migrar 100% do
tráfego pra uma revisão nova; instâncias mornas da revisão antiga podem
processar mais uma chamada nesse meio-tempo). Um teste novo, feito minutos
depois na MESMA revisão já estabilizada (`agenteagilmencao-00007-com`),
revelou o achado real — ver "TERCEIRO ACHADO" abaixo.

## TERCEIRO ACHADO (2026-08-18, mesmo dia): instrução no prompt não é garantia — rede de segurança no código

Testando de novo, na mesma revisão já estabilizada, duas perguntas
explicativas seguidas tiveram resultado DIFERENTE: uma gerou
`biblioteca_agil -> comentario` (funcionou), a próxima gerou só
`biblioteca_agil` (voltou a falhar) — mesma revisão, mesmo prompt,
mesmo tipo de pergunta. Não é bug de deploy nem de path (já descartados
pelos IDs/timestamps): é **não-determinismo do LLM** — a instrução
"Entrega da resposta" em `SYSTEM_PROMPT_V1` reduz a frequência do
problema, mas nunca foi (e não pode ser, pedindo só no prompt) uma
garantia.

**Fix**: rede de segurança no código, não só no prompt.
`processarMencao()` (`mentionTrigger.js`) passa a checar, depois do
`runLoop()`, se alguma chamada de `comentario` aconteceu; se não, e existe
`finalText`, posta ele mesmo automaticamente — reaproveitando a mesma
ferramenta `comentario` (mesmo dryRun/squad/card que o modelo usaria).
Registrado tanto no log de produção (`FALLBACK: finalText postado como
comentario...`) quanto no registro de idempotência
(`fallbackComentario: true/false`), pra dar pra medir com que frequência
isso dispara ao longo do tempo — número alto sinalizaria que vale
reforçar o prompt mais, número baixo confirma que é só uma rede de
segurança ocasional.

2 testes novos em `mentionTrigger.test.js`: fallback dispara quando o
modelo não chama `comentario`; NÃO duplica quando `comentario` já foi
chamado. Suíte inteira: **179/179 passando**.

**Requer novo deploy manual** (`firebase deploy --only
functions:agenteAgilMencao`) pra valer em produção — com os TRÊS achados
deste dia (path morto, resposta presa no prompt, rede de segurança no
código) juntos, a @menção real deveria entregar resposta no card em
100% dos casos, não só na maioria.

**VALIDADO EM PRODUÇÃO**: usuário confirmou a resposta aparecendo
certinho no card (comentário do "Agente Ágil", texto formatado, batendo
com a pergunta sobre Modelos de card) — os três fixes deste dia
funcionaram juntos.

## QUARTO AJUSTE (2026-08-18, mesmo dia): notifica quem fez a @menção original

Pergunta direta do usuário depois de ver a resposta funcionando: "não
deveria me mencionar pra aparecer notificação pra mim?". Resposta: sim,
e não estava acontecendo — `comentario` só dispara notificação quando o
TEXTO da resposta tem uma @menção reconhecível (heurística pra menção
humana escrevendo o texto), e a resposta do agente normalmente não
menciona ninguém. Quem perguntou nunca era avisado, mesmo sendo resposta
direta a ela.

**Fix**: `processarMencao()` notifica explicitamente quem fez a @menção
original, direto por `comment.uid` (já em mãos), reaproveitando
`buildNotifStep()` (mesmo módulo de notificações de `agente-agil` v0-v3).
Mesmo esquema de id determinístico que @menção-no-texto usa
(`mention_{cardId}_{uid}`) — sem duplicar se o texto por acaso também
mencionar a pessoa.

2 testes novos, suíte inteira 181/181 passando.

**VALIDADO EM PRODUÇÃO**: usuário confirmou a notificação "🤖 Agente Ágil
respondeu sua menção" aparecendo no sininho depois do deploy — os quatro
ajustes deste dia (path morto, resposta presa no prompt, rede de
segurança, notificação) estão todos funcionando juntos, ponta a ponta.
Item 4 do plano de acionamento (@menção real rodando de verdade) pode ser
considerado validado a partir daqui.

## Item 5 (sequência de acionamento): gatilho automático plugado nas Automações — implementado (2026-08-20)

Com o item 4 validado em produção, o usuário confirmou seguir pro item 5
("Só depois, gatilho automático em mudança de card"). Decisão de desenho
combinada antes do código: em vez de um listener novo pra "qualquer
mudança de card" (superfície de risco maior, precisaria replicar o
filtro anti-loop desde o zero), reusar o sistema de **Automações** que
já existe no board (`AUTO_TRIGGERS`/`AUTO_ACTIONS` em `kanban-dev.html`)
— gatilhos já validados há semanas em produção (`due_today`,
`due_overdue`, `aging`, `unblocked`, `checklist_complete`, `blocked`,
`tag_added`, movimentação de coluna, etc.), cada um já com sua própria
proteção contra reexecução (ver `checkDueNotifs()`/`checkAgingAutomations()`).

Achado que destravou isso: a ação `notify_agent` ("Notificar Agente
Ágil") já existia nas Automações, mas apontava só pro agente ANTIGO
client-side (`functions/agente-agil/`, painel de chat manual —
`openAgent()`/`qa()`), não pro orquestrador novo. Ganhou uma 3ª opção,
**"🤖 Modo autônomo"**, só visível quando o squad ativo é `dev` (o path
do trigger do `agenteAgilMencao` tem esse squad travado, literal, não
`{squadId}`). Selecionada, a automação escreve um comentário de verdade
em `card_comments/{cardId}` contendo `@Agente Ágil` — entra no MESMO
pipeline do item 3/4 (já em produção), **sem nenhuma Cloud Function
nova**. `uid` do comentário é `'automacao'` (nunca `'agente-agil'`, que
o filtro anti-auto-disparo de `processarMencao()` trataria como
comentário do próprio agente e ignoraria silenciosamente).

Mudança 100% client-side (`kanban-dev.html`, v8.30.446-dev) — nada
mudou em `functions/agente-agil-orquestrador/`.

**Achado ao validar**: a ação inteira estava invisível mesmo no squad
`dev` — `AGENTE_AGIL_ATIVO` (kill switch do painel ANTIGO, `false` de
propósito) controlava a visibilidade de `notify_agent` como um todo,
escondendo o "Modo autônomo" novo junto, mesmo ele não dependendo desse
painel. Corrigido em v8.30.447-dev: a ação aparece se o painel antigo
estiver ligado OU o squad for `dev`; o dropdown de opções só oferece o
que funciona em cada contexto.

**VALIDADO EM PRODUÇÃO (2026-08-20)**: primeira regra de teste criada no
squad `dev` (gatilho "Tag adicionada ao card (CONCEPT)" → "Notificar
Agente Ágil (🤖 Modo autônomo)"). Disparo real: tag adicionada a um card
("Briefing de fotos — coleção Hering Teens"), automação escreveu o
comentário `@Agente Ágil — [Automação] ...`, orquestrador processou e
respondeu no card em ~1min. Resposta analisou o card de verdade
(descrição quase vazia, tag "Bloqueio" sem motivo registrado, checklist
com item de teste, sem responsável real) e **não executou nenhuma ação**
por falta de informação suficiente — pediu esclarecimento à pessoa
mencionada na descrição em vez de chutar mover coluna/editar campo.
Comportamento de julgamento consistente com os canários manuais originais
(cenários 1-4), agora confirmado também no caminho 100% autônomo. Item 5
do plano de acionamento pode ser considerado validado a partir daqui.

## Item 7: roteamento de modelo real — implementado (2026-08-21)

Com os itens 1-5 (sequência de acionamento) e 6 (toolset completo)
fechados, o usuário pediu pra avançar o item 7. Desenho combinado ANTES
do código (mesmo padrão de todo o resto deste roadmap): a pergunta-chave
era se o tier `opus` deveria ter algum caminho AUTOMÁTICO já nesta
primeira versão. Decisão explícita: **não** — fica só atrás de um
override manual do ADM, sem heurística nenhuma escolhendo `opus` sozinha,
até existir volume real de uso pra calibrar um critério (mesmo raciocínio
que já adiou a heurística por LLM: "perguntar pro Haiku se é simples"
somaria custo/latência/erro de julgamento sem dado real pra validar).

**`escolheClienteParaTarefa({ apiKey, taskText, db })`** (assíncrona
agora, antes era síncrona — único caller de produção, `mentionTrigger.js`,
atualizado junto) decide em 2 passos:

1. **Override manual do ADM** — `kanban/config/agente_agil_orquestrador/
   model_tier_override`, mesmo padrão fail-safe de `limits.isEnabled()`:
   só um valor LITERAL entre `haiku`/`sonnet`/`opus` força a escolha;
   sem `db`, erro de leitura, nó ausente ou valor fora desse conjunto
   ignora o override silenciosamente e cai no passo 2. Único jeito de
   rodar em `opus` hoje — nenhum caminho automático chega lá. Sem UI
   dedicada (mesmo padrão do kill switch) — seta via console script.
2. **Heurística de texto** (`classificaComplexidade(taskText)`, pura,
   sem rede/LLM) — rebaixa pra `haiku` só quando a tarefa tem cara de
   pergunta puramente conceitual: começa com um marcador tipo "o que é",
   "como funciona", "por que", "me explica" (normalizado igual
   `detectaMencao.js` — minúsculo, sem acento) E tem no máximo 20
   palavras. O mesmo tipo de tarefa já validada nos canários rodando só
   `biblioteca_agil`, sem tocar o board ("me explica o conceito de
   sprint", "como usar cards recorrentes", ver seção "Achado de UX"
   acima). Qualquer coisa fora desse padrão estreito — pedido de ação
   (mover/editar/criar), pergunta longa/composta, texto vazio — cai no
   default seguro `sonnet`, que continua sendo o piso de todo o resto.
   `opus` nunca é alcançado por aqui.

Log de produção ganhou o tier escolhido (`mentionTrigger.js`:
`dryRun=... | tier=... | ...`) — dá pra medir na prática quantas tarefas
reais caem em cada tier antes de decidir calibrar mais.

13 testes novos em `escolheClienteParaTarefa.test.js` (heurística pura +
override fail-safe, usando o mesmo `makeFakeDb` de `agente-agil/`).
Suíte inteira: **193/193 passando**.

**Deployado em produção (2026-08-21)** — `firebase deploy --only
functions:agenteAgilMencao` rodado pelo usuário na própria máquina.
Roteamento real vale a partir daqui; `opus` continua só atrás do
override manual, sem tráfego real ainda pra decidir calibrar um
critério automático.

## Achado real ao validar o item 7 em produção: `mover_coluna` não sabia o ID da coluna — corrigido (2026-08-21)

Teste do roteamento (pedido de ação, "move esse card pra Concluído")
confirmou `tier=sonnet` certinho, mas revelou um bug funcional
pré-existente, sem relação com o item 7: o agente tentou `mover_coluna`
com `coluna:"Concluído"` (nome de exibição real da coluna nesse squad),
depois `coluna:"Concludo"` (sem acento), os dois falharam
(`flow.columnExists()` valida contra o ID), e só então pausou com
`perguntar_humano` — julgamento correto (não chutou um 3º valor), mas
por FALTA de informação que deveria estar disponível.

**Causa raiz**: `mover_coluna` sempre esperou o ID da coluna
(`outputs/moverColuna.js`), nunca o nome — mas nenhuma ferramenta do
toolset expunha o mapa id↔nome de TODAS as colunas do board. `ler_card`
só devolvia a coluna ATUAL do card; `visao_board` só lista colunas com
WIP configurado (Backlog/Concluído tipicamente não têm limite).

**Fix**: `ler_card` (`tools/lerCard.js`) ganhou `colunas_disponiveis` —
lista completa `{id, nome, fim}` de todas as colunas do board (`fim`
usa a mesma fonte de verdade que `mover_coluna` já usa pra decidir
notificação, `flow.doneColumnIds()`). `SYSTEM_PROMPT_V1` e a descrição
da ferramenta `ler_card` foram atualizados pra deixar explícito que
`mover_coluna` espera ID (não nome) e que `ler_card` é onde resolver
isso antes de agir.

7 testes novos/atualizados (`lerCard.test.js`, `systemPrompt.test.js`).
Suíte inteira: **196/196 passando**.

**Deployado em produção (2026-08-21)** — `firebase deploy --only
functions:agenteAgilMencao` rodado pelo usuário na própria máquina.

**VALIDADO EM PRODUÇÃO (2026-08-21)**: mesmo pedido de antes ("move
esse card pra Concluído") rodado de novo contra um card novo — o agente
resolveu o ID sozinho via `colunas_disponiveis` e moveu de verdade,
sem parar em `perguntar_humano`. Resposta: `"Movido para 'Concluído'
conforme solicitado. Só um alerta: o card estava no Backlog, sem
checklist e sem descrição preenchida — vale conferir se realmente está
tudo pronto antes de considerá-lo finalizado de fato."` — mesmo
julgamento de PO de sempre preservado (avisa em vez de assumir que
"mover pra Concluído" = "está pronto de verdade"), agora sem o bug.
Achado do teste do item 7 considerado fechado.

## Expansão pro squad `dados` — ativado em modo sombra (2026-08-23)

Primeiro passo real na direção do item "expandir pra um squad de
produção real" do roadmap — pedido explícito do usuário: preparar o
código, mas **não subir pra produção em horário de trabalho**. Ativação
fica pra uma decisão separada, feita depois.

**Refactor**: `mentionTrigger.js` deixou de ter `SQUAD_ID`/`DRY_RUN_MENCAO`
fixos no módulo — virou uma fábrica, `createMentionTrigger({squadId,
dryRun})`, que cada squad suportado chama uma vez pra virar uma Cloud
Function própria. Cada squad continua sendo escutado por um path LITERAL
no trigger (`kanban/squads/{squadId}/dados/card_comments/...`), não um
wildcard `{squadId}` genérico — deliberado: um wildcard ouviria TODO
comentário de TODO squad do sistema, cobrando invocação mesmo pra
descartar a maioria em runtime (trade-off de custo real, dado o quanto
esse projeto já investiu em reduzir consumo de Firebase). Mais squads =
mais uma linha de export em `functions/index.js`, não mudança de
arquitetura.

A instância `dev` (`agenteAgilMencao`, `processarMencao`, `SQUAD_ID`,
`IDEMPOTENCY_PATH`, `DRY_RUN_MENCAO`) continua exportada com os MESMOS
nomes de sempre no topo do módulo — zero mudança de comportamento ou de
import pra quem já usava. Nova instância `dados`
(`agenteAgilMencaoDados`/`processarMencaoDados`), em **modo sombra por
padrão** (`dryRun:true`) — mesma disciplina que o squad `dev` seguiu:
mecanismo de gatilho primeiro, decisão de escrita real depois, separada.

**Ficou de fora de propósito, pra não vazar antes da hora**: qualquer
mudança em `kanban-dev.html` (autocomplete `AGENTE_AGIL_MENTION_SQUADS`,
opção "🤖 Modo autônomo" nas Automações) — diferente de `functions/`
(deploy manual), o board publica sozinho no merge (GitHub Pages), então
qualquer alteração ali ficaria visível pro squad `dados` IMEDIATAMENTE,
mesmo com o backend pausado. Fica pra quando a ativação for decidida de
verdade — nesse momento, os dois lados (client + deploy da function)
precisam andar juntos.

**Como está "guardado"**: `functions/index.js` tem a linha
`exports.agenteAgilMencaoDados = ...` **comentada**, mesmo padrão do
`spotifySync` pausado — existir no código não é o mesmo que estar no ar.
Ativar exige duas ações deliberadas, nenhuma acidental: descomentar a
linha + `firebase deploy --only functions:agenteAgilMencaoDados`.

6 testes novos (`mentionTrigger.test.js`) cobrindo a fábrica em si
(paths escopados por squad, modo sombra por padrão) e a instância
`dados` respeitando `dryRun:true` de verdade (não escreve comentário
real mesmo processando com sucesso). Suíte inteira: **201/201
passando**.

**Ativação (2026-08-23)**: já fora de horário de trabalho, o usuário
confirmou subir — PR #480 descomentou `exports.agenteAgilMencaoDados`
em `functions/index.js` (nenhuma mudança de código além disso, a
fábrica já existia pronta desde a estruturação acima) e o deploy
(`firebase deploy --only functions:agenteAgilMencaoDados`) foi
confirmado feito pelo usuário. O gatilho passou a rodar de verdade em
produção pro squad `dados`, em modo sombra (`dryRun:true`): processa
`@menções` reais e loga o resultado, sem escrever o comentário de
resposta no card ainda — mesma disciplina que o squad `dev` seguiu
antes de virar escrita real.

**Validado em produção e escrita real ativada (2026-08-24)**: usuário
colou os logs reais do Cloud Function mostrando 2 disparos consecutivos
no mesmo card — `dryRun=true | tier=sonnet | status=done`, sem erro, com
a idempotência segurando certo entre as duas menções (não reprocessou a
mesma). Mecanismo de gatilho validado em produção; decisão explícita do
usuário: `dryRun` virou `false` (código: `dadosInstance` em
`mentionTrigger.js`). Squad `dados` agora tem escrita real de verdade,
igual ao squad `dev` — 2 testes atualizados pra refletir o novo
comportamento (o que antes provava "não escreve em dryRun:true" agora
prova "escreve de verdade em dryRun:false"). Suíte inteira: ainda
**201/201 passando** (não foram testes novos, os 2 existentes mudaram de
asserção).

**Client-side liberado também (2026-08-24, `kanban-dev.html` v8.30.457-dev,
ainda não promovido pra prod)**: `AGENTE_AGIL_MENTION_SQUADS` ganhou
`'dados'` — autocomplete de `@menção` já sugere o Agente Ágil nesse squad,
e os 3 atalhos com card (Insights/menu de contexto/automação) postam de
verdade em vez de mostrar o toast "ainda não está disponível". Mesma
rodada corrigiu um bug real encontrado incidentalmente: o dropdown "🤖
Modo autônomo" da automação ainda checava `ACTIVE_SQUAD==='dev'`
hardcoded, separado da fonte que a ação usa em `visible:` — squad `dados`
via a ação mas o dropdown vinha vazio (ver `CHANGELOG.md`
v8.30.458-dev). A detecção em si (`detectaMencao.js`) sempre foi por
texto puro (`"@agente agil"` como substring) — não dependia da entidade
sintética do autocomplete, então digitar a menção na mão já funcionava
mesmo antes desse ajuste de UI.

## Item 5: gatilho automático em mudança de card — v1 (due_overdue, squad `dev`, 2026-08-24)

Desenho combinado com o usuário antes do código (mesmo padrão de todo
este roadmap), a partir de uma pergunta aberta: "qual o próximo passo do
Agente Ágil?".

**Achado que motivou revisitar o item**: `runAutoRules()`
(`kanban-dev.html`) é 100% client-side, disparado só pela ação de quem
está com o board aberto (mover card, salvar, etc.). Dos 20 gatilhos de
`AUTO_TRIGGERS`, 4 são "ambientais" — nascem do TEMPO passando, não de
uma edição: `due_today`, `due_overdue`, `wip_exceeded`, `aging` (card
parado sem edição). Hoje eles só avaliam porque alguma aba tem um
`setInterval` rodando a checagem 1x/dia (`checkDueNotifs()`/
`checkAgingAutomations()`). **Se ninguém abrir o board, nada dispara** —
um card pode ficar atrasado um fim de semana inteiro sem ninguém, nem o
Agente Ágil, notar. Essa é exatamente a lacuna que o item 5 original
("gatilho automático em mudança de card", item "1b" na sequência
combinada em 2026-08-14) visava fechar — e as pré-condições que o
texto original exigia (kill switch + escopo de squad + @menção estável)
já estavam satisfeitas nos dois squads.

**Escopo v1, decidido via `AskUserQuestion` (não deduzido)**:
- **Gatilho**: só `due_overdue` ("card atrasado, 1º dia") — dos 4
  ambientais, o mais valioso pro time perceber sem precisar abrir o
  board. `due_today`/`wip_exceeded`/`aging` ficam de fora de propósito,
  cada um seria uma decisão separada depois.
- **Squad**: só `dev` — mesma disciplina sequencial de sempre (valida
  num squad de teste antes de considerar `dados`).
- **Cadência**: 1x/dia — mesma que `checkDueNotifs()` já usa no client,
  suficiente dado que `due_overdue` é auto-dedupe por construção (só
  bate no dia EXATO em que o card cruza de "vence hoje" pra "atrasado
  1 dia" — `card.due === ontem`, nunca "due <= ontem" — nunca bate 2
  dias seguidos pro mesmo card).

**Implementação** (`dueOverdueTrigger.js`): Cloud Function `onSchedule`
nova (mesmo padrão de `weeklyBackup`, `schedule: 'every day 09:05'`,
`timeZone: 'America/Sao_Paulo'`), squad `dev` hardcoded (sem fábrica
ainda — mesma disciplina incremental que `mentionTrigger.js` seguiu:
construir pra 1 squad primeiro, só virar fábrica quando um 2º squad for
pedido de verdade). Reusa a MESMA rota já validada da `@menção`, não
inventa caminho novo: quando `due_overdue` bate E existe uma Automação
"Notificar Agente Ágil" ativa nesse squad com esse gatilho, escreve o
MESMO formato de comentário que `AUTO_ACTIONS.notify_agent.run()` já
escreve no client — cai direto no listener de `mentionTrigger.js`
(`agenteAgilMencao`), que já filtra auto-comentário e respeita o kill
switch. **Opt-in, não liga sozinho pra ninguém**: só age se o ADM já
tiver configurado a Automação — o scan em si não cria nenhuma regra.
Não replica nenhuma OUTRA ação de uma regra due_overdue (mover coluna,
tag, etc.) — só a ação `notify_agent`; as outras continuam dependendo
de alguém abrir o board, fora de escopo v1.

14 testes novos (`dueOverdueTrigger.test.js`) — matching de regra (array
de ações, formato legado, inativa, trigger errado, sem ação
`notify_agent`, várias ações), e o scan em si (posta comentário real,
ignora card não atrasado/arquivado/já numa coluna de fim, respeita
`condTag`, vários cards na mesma varredura, `auto_rules` salvo como
objeto). Suíte inteira: **215/215 passando**.

**Deploy confirmado (2026-08-24, PR #488 mergeado)**: usuário rodou
`firebase deploy --only functions:agenteAgilDueOverdueScan` na própria
máquina. Cloud Scheduler passa a rodar o scan diariamente às 09:05
(`America/Sao_Paulo`) — ainda não age de fato pra ninguém enquanto não
existir uma Automação "Notificar Agente Ágil" com o gatilho "Card
atrasado (1º dia)" configurada no squad `dev` (opt-in, por desenho).

**Validado em produção (2026-08-24)**: usuário configurou a Automação e
forçou o Cloud Scheduler a rodar na hora (Google Cloud Console →
"Forçar execução"), sem esperar o agendamento diário. Log real do scan:
`[agente-agil-due-overdue] squad=dev cards=591 notificados=2` — achou 2
cards de verdade batendo `due_overdue` num board de produção (591 cards
escaneados). Log real do `agenteAgilMencao` processando o 1º card
notificado: `dryRun=false | tier=sonnet | status=done | ferramentas:
ler_card({}) -> comentario(...)`, `finalText`: "...venceu ontem, mas não
tem descrição, checklist nem qualquer comentário que indique o real
andamento do trabalho... não tomei ação de mover coluna ou alterar
prazo" — mesmo julgamento cuidadoso de sempre (recomenda em vez de agir
sem evidência). Pipeline ponta a ponta confirmado: scan → comentário da
Automação → `agenteAgilMencao` processa → agente responde de verdade no
card, sem loop (a própria resposta do agente foi corretamente ignorada
pelo filtro `self_comment` quando reprocessada pelo listener).

**Item 5 v1 — FECHADO.** Próximos passos possíveis levantados na época:
portar `wip_exceeded`/`aging` pro mesmo mecanismo, e/ou expandir o scan
pro squad `dados` — cada um, decisão separada.

**`wip_exceeded`/`aging` — decisão do usuário: NÃO portar, não sobe pra
prod.** Ficam de fora do mecanismo de scan diário; só `due_overdue` e
`due_today` continuam ativos.

**Expandir o scan pro squad `dados` — FEITO (2026-08-25).** Ver seção
"Scan de due_overdue/due_today expandido pro squad dados" mais abaixo.

## Item 5: `due_today` adicionado ao mesmo scan (2026-08-24, mesmo dia)

Pedido direto do usuário, no mesmo dia da validação do item 5 v1: "só
precisa esse mesmo, os outros 2 acho que não precisam" — respondendo a
uma pergunta sobre o que `due_today` significa (o par do `due_overdue`
já implementado: "card vence hoje", não "atrasado"). `wip_exceeded` e
`aging` ficaram de fora, decisão explícita.

**Implementação**: `runDueOverdueScan()` (mesmo arquivo,
`dueOverdueTrigger.js`) passou a checar os dois gatilhos numa única
passada pelos cards — `card.due===hoje` vira `due_today`,
`card.due===ontem` vira `due_overdue` (mutuamente exclusivos, mesmo
card nunca bate os dois no mesmo dia). Cada gatilho tem seu próprio
texto de comentário ("vence hoje" vs. "está atrasado, venceu ontem") e
sua própria lista de regras Automação correspondentes — devido a `notify_agent`
continuar sendo a única ação replicada, e `condTag` continuar valendo
por regra, como no v1. **Não renomeei** a Cloud Function exportada
(`agenteAgilDueOverdueScan`) nem o nome do arquivo — o nome ficou de
quando cobria só `due_overdue`, mas renomear exigiria um 2º deploy +
apagar a function antiga na máquina do usuário, custo desproporcional
pra um nome mais preciso; documentado no comentário do topo do arquivo
e em `functions/index.js` pra quem for procurar não estranhar.

5 testes novos (`ruleMatchesDueToday`, card `due===hoje` notificando com
o texto certo, ausência de regra `due_today` não notificando, os dois
gatilhos juntos numa mesma varredura com texto correto cada). Suíte
inteira: **220/220 passando**.

**Deploy confirmado (2026-08-24, PR #491 mergeado)**: usuário rodou
`firebase deploy --only functions:agenteAgilDueOverdueScan` de novo —
mesma function, código atualizado. `due_today` fica no ar junto com
`due_overdue` a partir do próximo scan (09:05 `America/Sao_Paulo`),
mesma disciplina opt-in: só age se o ADM configurar a Automação
"Notificar Agente Ágil" com o gatilho "Card vence hoje" no squad `dev`.

**Validado em produção (2026-08-24, mesmo dia)**: Automação criada via
script de console (mesmo padrão dos scripts de log já usados nesta
sessão — `autoRules.push(...)` + `fbSet(FB+'/auto_rules', autoRules)`),
card de teste "teste duetoday" criado com Prazo=hoje no squad `dev`,
scan forçado manualmente (Cloud Console → Cloud Scheduler → "Forçar
execução", sem esperar 09:05). Log real:
`[agente-agil-due-overdue] squad=dev cards=591 notificados=2`. Resposta
real do agente sobre o card de teste: leu o card (sem descrição,
checklist ou comentário de andamento), reconheceu que não dava pra
saber se estava travado/pronto, e usou `perguntar_humano` (notificando
`@CO`, o responsável) em vez de mover a coluna sem evidência — mesmo
julgamento cuidadoso de sempre.

**Achado incidental da própria sessão de teste, não um bug**: forçar o
scan manualmente várias vezes no MESMO dia (foi forçado 3x testando o
`due_overdue` antes do `due_today`) reprocessa o(s) mesmo(s) card(s)
atrasado(s) TODA vez, já que "due === ontem" continua verdadeiro o dia
inteiro — cada força é uma chamada real ao LLM, não simulada. O agente
lidou bem (reconheceu "sem mudança desde as análises anteriores" e não
reagiu de novo), mas o custo de tokens é real a cada força manual. Em
produção normal isso não se repete (só 1x/dia via Cloud Scheduler) —
vale só como lembrete pra ir com parcimônia ao forçar execução manual
em testes futuros.

**Item 5 (due_today + due_overdue) — FECHADO, validado em produção.**

## Achado real na validação do item 5: 1º comentário automático saía sem notificação (2026-08-24)

Reportado pelo usuário direto na validação em produção: o card "teste
duetoday" recebeu 2 comentários do agente (1º: análise, sem @menção no
texto; 2º: `perguntar_humano`, @mencionando `@CO`) — só o 2º gerou
notificação de verdade. "Se não os usuários não vão saber que ele
comentou."

**Causa raiz**: `processarMencao()` notifica quem "mencionou" o agente
usando `targetUid: comment.uid` — funciona pra @menção humana de
verdade, mas quando o disparo vem da Automação (`comment.uid ===
'automacao'`, ver `AUTO_ACTIONS.notify_agent`/`dueOverdueTrigger.js`),
isso grava a notificação em `kanban/usuarios/automacao/notificacoes/...`
— um caminho que ninguém lê, porque `'automacao'` não é um uid de
usuário de verdade. `buildNotifStep()` não valida se o `targetUid`
corresponde a alguém real, só escreve. O 2º comentário só notificou
porque `perguntar_humano` monta um texto com @menção explícita
(`@CO`), que passa pelo caminho JÁ existente e correto de
`buildMentionSteps()` (`outputs/comentario.js`) — caminho totalmente
separado do `targetUid: comment.uid` que falhou no 1º.

**Fix** (`mentionTrigger.js`): quando `comment.uid === 'automacao'`,
resolve o RESPONSÁVEL do card (`card.owner`, um init) contra
`kanban/usuarios_publicos` (`membersLib.getUidByInit()`, mesmo padrão
que `checkDueNotifs()` já usa no client) e notifica esse uid em vez de
`comment.uid`. Card sem responsável, ou `owner` que não resolve pra
nenhum membro real do squad → não notifica ninguém (mesmo
comportamento do client: melhor não notificar do que notificar
errado). Título da notificação também muda pra deixar claro que veio
de uma Automação, não de uma @menção manual.

3 testes novos (notifica o responsável de verdade / não escreve nada
no uid fantasma `automacao`; card sem responsável não notifica, mas
processa normal; `owner` sem membro correspondente não notifica).
Suíte inteira: **223/223 passando**.

**Deploy confirmado (2026-08-24, PR #494 mergeado)**: usuário rodou
`firebase deploy --only functions:agenteAgilMencao,functions:agenteAgilMencaoDados`
— as duas instâncias precisam do redeploy porque compartilham o mesmo
`mentionTrigger.js`.

## Segundo achado real, MESMO dia: fix do notifStep ainda falhava em cards com histórico

Validação ao vivo revelou que o fix acima **não bastava**: em "teste
duetoday" e "teste duetoday 2" (cards que já tinham recebido alguma
notificação antes — de um teste anterior ou de um `perguntar_humano`
na MESMA invocação), o comentário automático continuou sem notificar.
Só um card **novo** ("teste duetoday 3", sem histórico nenhum)
notificou de primeira.

**Causa raiz confirmada via script de console** (leitura direta de
`kanban/usuarios/{uid}/notificacoes`, comparando timestamps): o fix
usava o MESMO `idOverride` (`mention_{cardId}_{uid}`) que os outros 2
caminhos de notificação já usam (notifica quem perguntou / notifica
quem foi @mencionado no texto). Uma notificação ANTIGA nesse mesmo
slot (de 12:37, de um teste anterior) bloqueava silenciosamente os
disparos novos de Automação às 12:57/12:58 no mesmo card —
`buildNotifStep()` via que o slot já existia e pulava, mesmo sendo uma
invocação nova, com informação nova, dias/minutos depois. O dedupe
por card+pessoa fazia sentido pro caso original (mesma pessoa
perguntando de novo não precisa de notificação duplicada), mas quebra
o da Automação, que precisa notificar de novo a cada disparo real.

**Fix (2ª rodada)**: `idOverride` da Automação passa a incluir
`commentId` (`mention_auto_{cardId}_{uid}_{commentId}`) — único por
disparo de verdade, sem colidir com os outros 2 caminhos nem se
auto-bloquear pra sempre. Continua idempotente pra reentrega do MESMO
`commentId` (mesmo padrão de sempre). 1 teste novo, reproduzindo
exatamente o cenário encontrado (notificação antiga pré-existente no
slot antigo, confirma que uma nova é criada mesmo assim). Suíte
inteira: **224/224 passando**.

**Deploy confirmado e validado em produção (2026-08-24, PR #496
mergeado, mesmo dia)**: usuário redeployou as duas instâncias e forçou
o scan de novo no card "teste duetoday" — o mesmo card que estava
falhando antes, com histórico (notificação de `12:37` de um teste
anterior). Confirmado por leitura direta do Firebase (script de
console): a notificação antiga continuou lá, E uma nova foi criada
(`id: mention_auto_{cardId}_{uid}_{commentId}`, título "🤖 Agente Ágil
comentou no seu card (Automação)") — exatamente o comportamento
esperado. **Os dois achados de notificação do item 5 estão fechados de
vez.**

## "🤖 Resumo do Agente Ágil" dentro de "Meu Dia" (2026-08-25)

Pedido direto do usuário: "acho que o 'Meu Dia' é uma oportunidade legal
pro Agente Ágil... ele fazer um grande levantamento e resumo do board
pra o usuário! cards incompletos, faltando coisa, atrasado, bloqueado".

**Desenho combinado antes do código** (mesmo processo de todo o resto
deste roadmap — 2 decisões tomadas explicitamente com o usuário):

1. **Sob demanda e pessoal**, dentro de "Meu Dia" ("Meu Dia" existente,
   `kanban-dev.html`) — não um digest automático do board inteiro por
   squad. Modelo mais barato possível (zero custo se ninguém clicar) e
   evita a categoria de risco que um gatilho automático amplo exigiria
   gerenciar (auto-disparo, escopo, etc. — tudo que os itens 1-5 acima
   já tiveram que resolver com tanto cuidado).
2. **Escopo de squad**: só `dev`/`dados` (mesmo escopo de
   `AGENTE_AGIL_MENTION_SQUADS` no client) — cards de outros squads da
   pessoa continuam aparecendo normal na lista determinística de "Meu
   Dia", só ficam de fora do resumo do agente. Um 3º "próximo passo"
   que apareceu nesta mesma conversa (portar `wip_exceeded`/`aging` pro
   scan diário) foi descartado explicitamente pelo usuário — ver seção
   "Item 5" acima.

**Diferente de TUDO que veio antes deste ponto**: não escreve nada no
board. Nenhum comentário, nenhuma mudança de coluna, nenhuma edição de
campo. Isso não é uma limitação de v1 — é uma escolha de desenho
deliberada, porque simplifica a categoria de risco inteira que todo o
resto deste documento gerenciou com tanto cuidado (auto-disparo, kill
switch como única rede de segurança pra escrita sem supervisão, etc.):
sem escrita, não tem o que dar errado no board, mesmo que o LLM
"alucine" alguma coisa no texto — o pior caso é um resumo ruim, não um
card corrompido. `tools: []` no `llmClient.decide()` garante isso em
código, não só em prompt: não existe NENHUMA ferramenta de ação
disponível pro modelo nesta chamada.

**Como funciona** (`resumoMeuDia.js`):
- `collectPendingCards(db, uid)`: lê `kanban/usuarios_publicos/{uid}`
  pra saber squads + `init` da pessoa, filtra pra `SQUADS_ATIVOS`
  (`dev`, `dados`) onde ela é membro de fato, e pra cada squad lê
  `/cards` + `flowLib.readFlowMeta()` (mesmo helper que `visao_board`
  já usa) pra filtrar só cards ATIVOS (não arquivados, não numa coluna
  de fim) onde a pessoa é `owner` OU está em `participants`.
- `sinaisDoCard()`: calcula, em código determinístico (não pelo LLM),
  os sinais de cada card — atrasado + dias de atraso, vence hoje, sem
  prazo, bloqueado (`card.blocker===true` ou coluna `blocker`), sem
  descrição, checklist vazio, quantos itens do checklist ainda faltam.
  Mesmo espírito de `visao_board` (métricas fixas, LLM só interpreta
  dado já pronto, nunca decide "isso conta como atrasado?" sozinho).
- `gerarResumoMeuDia()`: se não tem card pendente nenhum, devolve uma
  mensagem fixa SEM chamar o LLM (custo zero pro caso comum de "tudo em
  dia"). Com cards, monta o histórico (`system` + 1 mensagem `user` com
  a lista de sinais em JSON compacto) e chama `llmClient.decide()` com
  `tools: []` — tier sempre `sonnet` (via `escolheClienteParaTarefa`
  com `taskText: ''`, que cai direto no default seguro; o override
  manual de tier continua valendo se o ADM configurar).

**Cloud Function (`agenteAgilResumoMeuDia`)**: primeira invocação SOB
DEMANDA do orquestrador — todo o resto até aqui é `onValueCreated`
(evento de escrita) ou `onSchedule` (agendado). Usa `onRequest`, não
`onCall`/`httpsCallable` — mesmo motivo de `spotify/disconnect.js`:
nenhuma página do app importa o SDK de Functions hoje, então verifica
`Authorization: Bearer <idToken>` manualmente (`getAuth().verifyIdToken()`)
e confere o domínio `@ciahering.com.br`, mesma disciplina de segurança
do resto do projeto. Respeita o MESMO kill switch dinâmico
(`limits.isEnabled`) que protege @menção e o scan diário — desligar o
orquestrador desliga isto também. Rate limit de 2 minutos por pessoa
(gravado ANTES de chamar o LLM, pra barrar uma 2ª requisição que chegue
enquanto a 1ª ainda está em voo) — não é proteção de segurança, é só
pra clique duplo/repetido não gerar custo à toa.

**Client** (`kanban-dev.html` v8.30.465-dev): botão "🤖 Resumo do Agente
Ágil" dentro do painel "🌅 Meu Dia", chama a function com o idToken da
pessoa (`cu.getIdToken()`, mesmo padrão já usado pelas functions do
Spotify) e mostra o texto retornado numa caixinha. Reseta a cada
abertura do painel — não mostra resumo de uma sessão anterior.

10 testes novos em `__tests__/resumoMeuDia.test.js` (sinais calculados
certo; junta cards de dev+dados; ignora squad fora do escopo mesmo
sendo membro; só squads onde a pessoa é membro de fato; owner OU
participante; exclui arquivado/concluído; sem init ou sem squad
relevante não quebra; sem cards pendentes não chama o LLM; chama com
`tools: []`; resposta vazia do LLM cai num fallback). Suíte inteira:
**234/234 passando**.

**Ainda não deployado** — depende do usuário rodar
`firebase deploy --only functions:agenteAgilResumoMeuDia` na própria
máquina (ver nota de resync no `CLAUDE.md`).

## Orquestrador recebendo/organizando input de especialistas externos (proposta, 2026-08-25)

Pergunta direta do usuário: "o ponto dele receber as informações de
outros agentes externos e organizá-las dentro do board, está no
mapeamento?". Resposta na hora: **não estava** — é extensão nova da
visão "PO+orquestrador" já declarada no topo deste README ("um loop com
LLM e ferramentas decidindo sozinho o que fazer"), sem desenho nem
decisão tomada até aqui.

### Contexto — o que já existe vs. o que é novo

**Já existe e está estável**: `functions/agente-agil/http.js` (agente
v0-v3) — a porta de entrada onde especialistas externos (hoje:
Databricks) mandam outputs (comentário, link, relatório, mover card,
editar campo) que alguém/algo mais decidiu. Continua sendo o canal de
escrita, não precisa de nada novo aqui.

**O que não existe**: o orquestrador usando esse fluxo como insumo pro
PRÓPRIO julgamento — hoje ele só reage a @menção (uma pessoa pedindo
algo) ou ao scan diário. Não tem mecanismo de "vários especialistas
disseram coisas diferentes sobre o mesmo card, preciso ler isso e
decidir como sintetizar/priorizar/consolidar".

### 2 achados que reencaixaram o desenho, antes de qualquer decisão de arquitetura

**Achado 1 — colisão de identidade (bloqueava até a LEITURA).** Todo
output que sai de `http.js` era gravado com `uid:'agente-agil'`/
`author:'Agente Ágil'` (comentário, `card_comments`) ou
`who:'Agente Ágil'` (os outros 6 outputs, `card.history`) — o MESMO
ator que `agente-agil-orquestrador/tools/realHandlers.js` usa pra si
mesmo (reusa os mesmos builders de `agente-agil/outputs/`). O filtro
anti-auto-disparo de `mentionTrigger.js` (ignora
`comment.uid===AGENTE_UID`, primeira checagem, não-negociável desde o
item 3) engolia comentário de especialista igual a comentário próprio
— não dava pra simplesmente tirar esse filtro (risco real de loop).
**Corrigido nesta rodada** — ver entrada completa em "Agente Ágil
(`functions/agente-agil/`)" no `CHANGELOG.md`: `board.js` ganhou
`resolveActor(especialistaId)`/`ctx.actor`, dando identidade própria
(`uid:'especialista:databricks'`, `author:'🔌 Databricks'`) pro
especialista sem tocar em nada do comportamento do orquestrador
(`realHandlers.js` nunca passa `especialista`, continua exatamente como
sempre foi).

**Achado 2 — o canal de especialistas rodava num squad onde o
orquestrador não existia.** `http.js` nunca recebeu `squadId` no
payload — sempre usava o default de `board.js`, squad `ecomm`,
travado, sem nenhum overlap com `dev`/`dados` (onde o orquestrador
roda). **Corrigido nesta rodada, por decisão direta do usuário**:
`ecomm` foi descontinuado (squad apagado do Realtime Database — decisão
dele, não uma migração de dados) e o default de `board.js` virou
`SQUAD_ID='dev'`. Especialista externo (`http.js`) e orquestrador
(`@menção` + scan diário) agora escrevem/leem no MESMO squad — zero
simulação necessária pra validar o resto deste desenho, tráfego real de
especialista (quando/se vier) já vai cair onde o orquestrador consegue
ver.

### Desenho combinado (proposta — nada aqui além dos Achados 1 e 2 está implementado ainda)

1. **De onde vem o sinal**: reaproveita 100% do que já existe, sem
   registro novo — `comentario` já vai pra `card_comments` (que
   `ler_card` já lê, últimos 20); os outros 6 outputs já vão pra
   `card.history` (que `ler_card` exclui de propósito hoje, "trilha de
   auditoria, não é o que um PO lê pra decidir"). Com o Achado 1
   corrigido, os dois já carregam identidade distinguível.
2. **Reativo primeiro, proativo é Fase B separada**: alguém @menciona
   pedindo o resumo (zero infra nova, reusa 100% do pipeline de
   @menção já validado) — mesma sequência que a própria @menção seguiu
   (manual → sombra → reativo → só depois, separadamente, scheduled).
   Proativo (notar sozinho que N especialistas escreveram recente)
   exigiria um gatilho novo com a mesma disciplina de opt-in via
   Automação que due_overdue/due_today já usam — decisão separada, não
   decidida agora.
3. **"Julgamento de PO" = resumir e atribuir, nunca reconciliar
   sozinho.** Se dois especialistas parecem se contradizer, o
   orquestrador não escolhe quem tem razão — sinaliza a contradição
   explicitamente no texto e para por aí. Sem `mover_coluna`/
   `editar_campos` disparados por essa leitura em v1 — ferramenta de
   leitura+síntese, não de ação, mesmo espírito de `visao_board`/
   `ler_card` hoje.
4. **Sem ferramenta nova** — em vez de um `ler_historico_especialistas`
   dedicado (fragmentaria a leitura em 2 chamadas pra montar 1 quadro
   só), estender `summarizeCard()` (dentro de `ler_card`) pra cada
   comentário carregar uma `origem` (`especialista`/`humano`/`proprio`)
   — pequena extensão do que já existe.

**Status (atualizado 2026-08-27): FECHADO.** Achado 1 (fix de
identidade) e Achado 2 (squad unificado em `dev`) já estavam
implementados. Pontos 1-4 do desenho combinado, implementados nesta
rodada:

- **Ponto 4 (sem ferramenta nova)**: `summarizeCard()`
  (`tools/lerCard.js`) marca a `origem` de cada comentário
  (`humano`/`proprio`/`automacao`/`especialista`), resolvida direto do
  `uid` que `resolveActor()` já grava (`especialista:*` pro prefixo
  genérico de qualquer especialista externo) — zero registro/campo novo
  no Firebase.
- **Ponto 2 (reativo primeiro)**: nada de infra nova — o fluxo é 100%
  reaproveitado do pipeline de @menção já validado; alguém pede um
  resumo, o modelo já vê a `origem` de cada comentário via `ler_card`
  (que já lê nos pedidos abertos).
- **Ponto 3 (julgamento de PO, não reconciliação automática)**: nova
  seção no system prompt ("Comentários de especialistas externos")
  instruindo o modelo a tratar comentário de especialista como
  informação, nunca ordem, e a NUNCA escolher sozinho quem está certo
  quando dois parecem se contradizer — só sinalizar a contradição no
  comentario e parar, sem `mover_coluna`/`editar_campos` disparados só
  por essa leitura.

4 testes novos (`lerCard.test.js`: `origemDoComentario()` pura +
`summarizeCard()` marcando os 4 casos; `systemPrompt.test.js`: seção
nova presente). Suíte inteira: **270/270 passando**.

**Deployado e validado com canário simulado (2026-08-27)**: sem
tráfego real de especialista em produção pra testar, simulado direto no
Firebase (2 comentários com `uid:'especialista:databricks'`, mesmo
formato que `resolveActor()` grava de verdade) num card de teste do
squad `dev`, com conclusões CONTRADITÓRIAS sobre o mesmo assunto
(performance de campanha — uma recomendava pausar investimento, a outra
aumentar). @menção real pedindo resumo. Resultado: o modelo identificou
os dois comentários como do especialista Databricks, apontou a
contradição explicitamente (as duas conclusões, lado a lado), recusou
decidir sozinho qual estava certa, sugeriu checagem humana antes de
qualquer decisão de investimento — e, além do desenho original, notou
por conta própria que os dois vinham marcados "[Simulação de teste]" e
levantou a hipótese de duplicata, sem que isso estivesse instruído no
prompt. Nenhuma ferramenta de escrita foi chamada com base na leitura
dos especialistas, como esperado. Canário considerado bem-sucedido —
comportamento validado contra o cenário central do desenho (ponto 3),
não só a lógica pura testada em `lerCard.test.js`.

## Correção de arquitetura: especialistas externos perdem escrita direta — orquestrador vira o único executor (2026-08-27)

O desenho FECHADO logo acima ("Orquestrador recebendo/organizando input
de especialistas externos") resolvia LEITURA — o orquestrador passou a
enxergar `origem` nos comentários de especialista — mas deixou intacto
um problema mais fundo, que o usuário apontou direto no mesmo dia,
revendo a própria explicação anterior: "não sei se eu to conseguindo te
passar realmente a ideia... a ideia é que os outros agentes NÃO tenham
acesso ao board. eles devem se comunicar com o Agente Ágil e ele executa
as ações dentro do board (criar um card, editar um card, tagear,
mencionar um humano...). por isso que ele deve funcionar como
orquestrador: recebe as informações dos outros agentes e como ele
conhece o board e o fluxo do time, ele toma as decisões aqui dentro".

Até esta correção, `agente-agil/http.js` (o canal de especialistas
externos) aplicava a ação que o especialista mandava (`mover_coluna`,
`editar_campos`, etc. — o mesmo vocabulário de `outputs` do orquestrador)
DIRETO no board via `buildWritePlan`/`applyWritePlan`, sem o orquestrador
participar da decisão em nenhum momento — exatamente o oposto do que a
palavra "orquestrador" deveria significar. Reforçado com uma segunda
observação, ao ser perguntado se o novo contrato deveria manter o
vocabulário estruturado de `outputs` ou simplificar: "a ideia nao é só
ter o databricks, é expandir para outros agentes e subagentes que
possam vir mais pra frente. Inclusive por isso q eu quero um
orquestrador, que saiba ler as informações que vao vim, que nem sempre
vamos conseguir adaptar, e a partir delas organizar dentro do board" —
ou seja, o contrato de entrada precisa caber formato que "nem sempre
vamos conseguir adaptar" pro vocabulário fixo de ações, não só o
Databricks de hoje. Confirmado também, via pergunta direta: o
orquestrador deve agir automático nesse canal (sem precisar de
@menção), igual já foi decidido pro scan de due_overdue/due_today.

**Status: FECHADO, escrita real destravada (squad `dev`, 2026-08-27) —
ver "5º/6º teste" mais abaixo pro fechamento completo.**

- **Contrato de entrada trocado**: `agente-agil/schema.js` ganhou
  `intakeEnvelope` — só `requestId` + `texto` livre são obrigatórios;
  `cardId`/`referencia` viram DICA opcional (nenhum dos dois é exigido
  mais); `especialista` continua opcional. O `envelope`/`output`
  antigos (vocabulário de ações) ficam só como contrato legado,
  documentado em schema.js, não lido mais por `http.js`.
- **`http.js` parou de decidir**: só valida e enfileira em
  `kanban/squads/{squad}/dados/agente_intake_pending/{id}` — mesmo
  espírito de segurança que `intake_pending` (formulário público) já
  usa, chaveado por push-id (nunca um array).
- **Gatilho novo, `intakeTrigger.js`** — o 2º gatilho automático do
  orquestrador (depois de @menção): escuta `agente_intake_pending/{id}`.
  Se `cardId`/`referencia` resolve pra um card real, monta o MESMO
  toolset de sempre; se não resolve (ou não veio), monta um toolset
  restrito (`semCard:true`) com só `criar_card`, `visao_board` e
  `biblioteca_agil` — as 3 únicas que não precisam de um card já
  resolvido. Resultado gravado de volta no próprio item da fila
  (`resultText`, `pendingIdCriado`), já que não existe card nenhum pra
  comentar nesse caminho. Mesma disciplina de sempre — kill switch,
  idempotência, squad literal no path — e **modo sombra por padrão**:
  ao contrário de @menção (10 canários manuais antes de destravar
  escrita real), este mecanismo ainda não rodou nem uma vez contra
  produção.
- **Tool novo, `criar_card`** (`tools/criarCard.js`) — fecha o gap já
  registrado mais acima neste README ("não existe `criar_card` no
  toolset dele"). NÃO escreve direto em `/cards` — mesmo risco de perda
  silenciosa documentado no topo de `functions/intake/submit.js`
  (`/cards` é um array reescrito por INTEIRO a cada `fbSaveAll()` do
  cliente; um card inserido por fora seria apagado no primeiro
  `fbSaveAll()` de qualquer pessoa do squad). Reusa o mesmo caminho
  seguro do formulário público de intake — grava um rascunho em
  `intake_pending`, revisável por um humano pela tela que já existe
  (`renderIntakeBody()`/`_intakeCriarCard()`), zero código novo no
  cliente. Réplica das mesmas regras obrigatórias do `criar_card`
  client-side (recusa se Ficha Técnica ativa; exige Submarca válida se
  Submarca ativa).
- **`criar_card` entra no toolset PADRÃO**, não só no caminho sem card
  — o orquestrador pode decidir criar um card novo mesmo numa conversa
  de @menção normal, se fizer sentido pro pedido.

24 testes novos + 1 atualizado (toolset ganhou `criar_card`). Suíte
inteira: 297/297 passando.

**Deliberadamente fora de escopo desta rodada** (sinalizado ao usuário,
não esquecido) — **atualização (2026-08-27, mesmo dia): a tela de
Pedidos de Intake foi atualizada** pra exibir/usar `submarca`/`origem`
(ver `CODE_MAP.md`, seção "Intake" de `kanban-dev.html`, e
`CHANGELOG.md` v8.30.492-dev) — não é mais uma pendência. Continua fora
de escopo: migração do lado do Databricks pro `intakeEnvelope` novo (o
contrato antigo de `outputs` parou de ser lido) não foi coordenada
ainda.

**Validado com canário simulado após o deploy (2026-08-27), squad `dev`**:
2 cenários, direto no Firebase real (mesmo padrão dos canários
anteriores — grava um item em `agente_intake_pending` simulando o que
`http.js` escreveria). Cenário 1 (informação sobre um card existente,
já concluído): o modelo leu o card, viu que já estava resolvido, e
registrou só um comentário informativo, sem mexer em mais nada —
correto. Cenário 2 (informação sem nenhum card associado, squad `dev`
com Ficha Técnica ativa): 1ª tentativa esbarrou numa instabilidade
momentânea da API da Anthropic (erro 529 "overloaded", não relacionado
ao código — mas revelou que um item que falha nessa etapa ficava preso
em "pending" pra sempre, sem sinalização nenhuma pra um humano notar,
mesma lacuna que a @menção normal já tinha, só que mais escondida aqui
por não ter ninguém esperando resposta num card — **corrigido no mesmo
dia**: `runLoop()` agora roda dentro de um try/catch, item vira
`status:'failed'` com o erro registrado em vez de ficar invisível, ver
`CHANGELOG.md`); 2ª tentativa processou normal — `criar_card` recusou
corretamente (Ficha Técnica obrigatória), só que o comentário final
narrou "tentei no squad dados" (squad que a ferramenta nem alcança) —
achado real de um problema de clareza (task text não dizia o squad ao
modelo), também corrigido no mesmo dia, e **reconfirmado com um 3º
teste simulado**: com o fix aplicado, o modelo passou a explicar
corretamente que só tinha acesso ao squad `dev`.

**4º teste, decisivo, pré-destravar escrita real**: com o mecanismo já
validado, o usuário perguntou diretamente "vamos destravar escrita real
no intake?" — antes de decidir, rodamos um teste específico pra ver
`criar_card` COMPLETAR uma criação de verdade (os 3 testes anteriores
sempre bateram em recusa por Ficha Técnica). Squad `dev` teve
`criativos_ativo`/`submarca_ativo` desligados temporariamente só pro
teste (religados logo depois). Achado real: o modelo narrou "Criado o
rascunho do card..." com total confiança, mas `pendingIdCriado` veio
vazio — nada foi escrito, porque a instância `dev` segue em
`dryRun:true` (modo sombra) de propósito. Causa: `criar_card` era a
ÚNICA das 9 ferramentas reais cuja descrição não avisava o modelo sobre
dryRun (mesma classe do bug "finge que deu certo" já corrigido antes,
sintoma novo). Corrigido (ver `CHANGELOG.md`) — descrição agora segue o
mesmo padrão das outras 8.

**5º teste, repetindo o cenário depois do redeploy do fix acima**: mesma
sequência (desligar Ficha Técnica/Submarca, disparar, religar depois) —
resultado: o modelo CONTINUOU narrando "Criei um rascunho de card..."
com total confiança, `pendingIdCriado` de novo vazio. O fix na
`description` de uma ferramenta só não bastou — o modelo simplesmente
não deu peso suficiente àquela instrução isolada dentro do schema.
Fix v2: regra genérica no `systemPrompt.js` (não mais escondida numa
description de tool), nova seção "Ferramenta em modo de teste (dryRun)"
— qualquer resultado com `dryRun:true` é simulação, nunca ação real,
mesmo com `ok:true` (ver `CHANGELOG.md`).

**6º teste, repetindo mais uma vez**: o modelo CONTINUOU narrando
sucesso, `pendingIdCriado` vazio outra vez — mas desta vez a causa não
era o prompt. Comparando o `firebase-functions-hash` de deploys
consecutivos (visível em `firebase functions:log`), o deploy do fix v2
saiu com o MESMO hash do deploy anterior — sinal de que rodou com
código desatualizado, porque o clone local não tinha sido
resincronizado antes (`git fetch`/`git reset --hard` — falha silenciosa
já documentada no `CLAUDE.md`, "funcionar sem erro nenhum, só com
código velho"). Resincronizado e redeployado de verdade (hash mudou), o
**7º teste** finalmente passou: o modelo relatou corretamente *"isso
foi apenas uma simulação (dryRun). Nenhum card foi criado de verdade
ainda"*.

Com os dois caminhos (com/sem card) validados, as travas de segurança
confirmadas, e a comunicação de dryRun corrigida de ponta a ponta, o
usuário confirmou explicitamente: **"sim, pode destravar"**. `dryRun`
virou `false` pra instância `dev` (ver `CHANGELOG.md`, mesmo dia) —
mesma decisão e mesmo nível de confiança que a @menção teve em
2026-08-18, só que aqui com o histórico completo de 7 rodadas de teste
documentado, não só a decisão final.

## Scan de due_overdue/due_today expandido pro squad `dados` (2026-08-25)

Único item que sobrou em aberto do fechamento do item 5 — o outro
(`wip_exceeded`/`aging`) já tinha sido descartado explicitamente pelo
usuário (ver acima). Pedido direto: "pode expandir o scan pro squad
dados".

**`dueOverdueTrigger.js`**: `SQUADS = ['dev', 'dados']` — a Cloud
Function `agenteAgilDueOverdueScan` (`onSchedule`, 1x/dia) agora itera
os dois squads na mesma invocação, cada um em seu próprio try/catch (um
squad falhando não bloqueia o outro nem derruba o scan inteiro).
`runDueOverdueScan(db, squadId)` já era squad-agnóstica desde o v1 — só
o array de squads escaneados mudou, zero mudança na lógica de scan em
si.

**Deliberadamente diferente do padrão de `mentionTrigger.js`** (onde
cada squad vira uma Cloud Function DEPLOYADA SEPARADAMENTE, com path
literal no trigger): aquele desenho existe pra evitar o custo de
escutar TODO evento de escrita de comentário de TODO squad só pra
descartar a maioria em runtime — motivo que não existe aqui.
`onSchedule` não escuta evento de squad nenhum, só dispara 1x/dia
independente de quantos squads existirem; rodar os dois numa função só
é mais simples, mais barato (1 Cloud Scheduler em vez de 2, 1 cold
start em vez de 2) e não perde nada em isolamento — o try/catch por
squad já dá o mesmo isolamento de falha que 2 functions separadas
dariam.

2 testes novos (`SQUADS` cobre `dev`+`dados`; `runDueOverdueScan`
funciona igual pro squad `dados`, provando que a lógica não é
hardcoded pra um squad só). Suíte inteira: **243/243 passando** (re-
verificada após rebase em cima do que já entrou no `main` desde a
abertura desta PR).

**Ainda não deployado** — mesmo passo do "Resumo do Agente Ágil" acima:
depende do usuário rodar `firebase deploy --only
functions:agenteAgilDueOverdueScan` na própria máquina, depois de
resincronizar o clone local.

## Ferramenta nova: `risco` (2026-08-28)

Pedido direto, numa conversa sobre como o orquestrador escala pra
projetos grandes: "o agente ágil consegue preencher checklist, colocar
risco também?". Checklist já existia (`checklist_item`); risco não —
lacuna real, não uma decisão deliberada de deixar de fora.

`card.riscos` é um array de STRINGS puras no cliente (`addRisco()`/
`getRiscos()` em `kanban-dev.html`, sem id nem metadado por item, sem
conceito de "resolver"/"concluir" um risco — só uma lista de avisos
visível na tela do card). Implementação seguiu o MESMO molde das outras
7 ferramentas reaproveitadas do vocabulário de outputs:

- **`agente-agil/schema.js`**: `outputRisco` (Zod) — só `texto`
  obrigatório, mesmo shape de `outputComentario`. Entrou no
  `discriminatedUnion` `output` (contrato legado, mas compartilhado).
- **`agente-agil/outputs/risco.js`** (novo): builder — transaction
  escopada em `{cardPath}/riscos`, mesmo raciocínio de concorrência de
  `outputs/link.js` (nunca um `update()` direto que pudesse pisar num
  risco adicionado ao mesmo tempo por um humano). Sem entrada em
  `card.history`, de propósito, mesma escolha de `link.js` — a própria
  lista de riscos já é o registro visível; diferente de
  `checklist_item`/`editar_campos`/`mover_coluna`, que mudam um ESTADO
  existente.
- **`agente-agil/outputs/index.js`**: registra `risco: risco.build`.
- **`agente-agil-orquestrador/tools/index.js`**: `outputRisco` entra em
  `REUSED_OUTPUT_SCHEMAS` — isso sozinho já basta pra `risco` aparecer
  no toolset (fake E real, incl. `dryRun`), porque `buildTools()`/
  `makeHandler()`/`makeRealHandler()` são 100% genéricos a partir desse
  mapa. Nenhuma outra mudança de código em `tools/index.js`/
  `realHandlers.js`/`loop.js`.
- **`systemPrompt.js`**: `risco` entra na lista de ferramentas
  disponíveis, no bucket de "baixo risco" (só adiciona, nunca
  sobrescreve — mesma classe de `comentario`/`checklist_item`/`link`),
  com a mesma cautela anti-alucinação que `link` já tem ("só registre um
  risco que o pedido/informação realmente descreveu"), e na lista de
  ferramentas indisponíveis no caminho sem card (`semCard:true`).

**Nível de confiança herdado, não revalidado do zero**: estruturalmente
é quase idêntico a `checklist_item` (mesmo padrão de transaction
escopada, array simples, já em produção com escrita real desde
2026-08-18) — não passou por uma nova rodada de canários manuais como
`criar_card` passou (aquele mexia com entidades novas e validação de
Ficha Técnica/Submarca, risco bem mais alto). Coberto por testes
automatizados (`agente-agil/__tests__/board.test.js` — construção da
transaction; `agente-agil-orquestrador/__tests__/realHandlers.test.js`
— escrita real ponta a ponta contra o fake db; `loop.test.js` —
toolset completo). Suíte inteira: 306/306 passando.

**Requer redeploy** das 3 Cloud Functions que usam `buildTools()`/
`realHandlers.js` pra pegar a ferramenta nova: `agenteAgilMencao`,
`agenteAgilMencaoDados`, `agenteAgilIntake` — mesmo passo de sempre
(resincronizar o clone local antes).

## Notifica PO/ADM quando o intake não vira ação nenhuma (2026-08-28)

Achado ao testar o intake pela primeira vez via HTTPS de verdade (`curl`
direto contra `agenteAgil`, simulando o Databricks). Cenário: texto
solto, sem card associado ("queda de 18% no volume de pedidos") — o
modelo tentou `criar_card`, mas o squad `dev` exige Ficha Técnica, então
a ferramenta recusou. Resultado: uma explicação clara gravada em
`resultText`, no item da fila — mas **ninguém foi avisado**. A única
forma de descobrir era abrir "Pedidos de Intake" por conta própria.
Pedido direto do usuário: "ele precisa notificar alguém que isso
aconteceu... sempre que esse tipo de erro acontecer, precisa relatar
pro humano (PO e ADM)".

**Escopo**: só dispara quando `semCard === true` E nada de acionável
nasceu (`!pendingIdCriado`) — ou seja, a recusa/decisão de não agir
aconteceu no caminho "informação solta, sem card nenhum". Quando existe
um `cardId` real, o comentário já fica visível no próprio card (mesma
cobertura de uma @menção normal); quando `criar_card` teve sucesso, o
rascunho já aparece com o badge 🤖 em Pedidos de Intake.

**Implementação** (`notificarFalhaSemCard()`/`acharCardHotline()` em
`intakeTrigger.js`):
- Procura o card hotline "🤖 Converse com o Agente Ágil"
  (`agenteHotline:true`) da squad. **Só lê — nunca cria um card novo**:
  escrever em `/cards` direto arrisca a mesma perda silenciosa que
  `criarCard.js`/`intake/submit.js` já contornam (o cliente reescreve o
  array inteiro em `fbSaveAll()`, sem transaction).
- Se existe: posta um comentário explicando o que aconteceu (texto
  original + `resultText`) e notifica quem tem papel `po`/`adm` na
  squad com `type:'mention'` apontando pro card hotline.
- Se não existe ainda: pula o comentário, mas AINDA notifica PO/ADM —
  com `type:'intake'`/`cardId:null`, o mesmo tipo que `openNotif()`
  (kanban-dev.html) já trata especificamente pra abrir o painel de
  Pedidos de Intake em vez de tentar navegar pra um card que não
  existe (achado incidental: esse tratamento já existia no cliente,
  só nunca tinha sido usado por nada server-side).
- `members.js` ganhou um campo `role` por membro (mesmo fallback de
  `getEffectiveRole()` do cliente: `squads_roles[squadId] || u.role ||
  'membro'`) — **não replica** o allowlist de e-mail fixo de
  `isAdmUser()` (só existe no cliente); quem precisar dessa cobertura
  extra sabe da lacuna.
- Respeita `dryRun` como todo o resto do módulo — nada escreve de
  verdade em modo sombra.

3 testes novos em `intakeTrigger.test.js` (hotline existe/notifica;
sem hotline/notifica com fallback; dryRun não escreve nada). Suíte
inteira: 309/309 passando.

**Requer redeploy** (mesmas 3 functions de sempre que usam este
módulo): `firebase deploy --only functions:agenteAgilMencao,functions:agenteAgilMencaoDados,functions:agenteAgilIntake`

## Fix de prompt: @menção com nome completo não notificava ninguém (2026-08-28)

Achado ao vivo, testando o cenário "épico" (4 especialistas diferentes
mandando informação pro mesmo card, simulando um projeto real): pedido
pro modelo avisar diretamente o responsável do card sobre um risco.
Resultado: o comentário saiu com `@Caio Oliveira Dos Santos Soares`
(nome completo) — parece uma menção, mas `MENTION_RE`
(`agente-agil/notifications.js`) só casa `@` seguido de
`[a-zA-Z0-9._-]` (sem espaço), então isso nunca virou uma notificação
de verdade nem um link clicável no cliente. O modelo TINHA o valor
certo disponível — `ler_card` devolve `responsavel: {init, nome}` — só
usou `nome` em vez de `init` ao escrever o texto, e nada no prompt
dizia explicitamente qual dos dois usar numa @menção.

Fix: nova seção "Menções (@) dentro de um comentário" no
`systemPrompt.js`, logo depois de "Entrega da resposta" — instrui
explicitamente a usar `@` + `init` (nunca o nome completo), com
exemplo do formato errado pra deixar claro o que NÃO fazer.

1 teste novo em `systemPrompt.test.js`. Suíte inteira: 310/310
passando.

**Requer redeploy** (mesmas 3 functions de sempre):
`firebase deploy --only functions:agenteAgilMencao,functions:agenteAgilMencaoDados,functions:agenteAgilIntake`

## Contexto sobre especialistas externos (2026-08-28)

Pedido direto do usuário, ainda no mesmo teste "épico" via HTTPS: "acho
que vale uma área em configurações para os ADM's/PO também explicarem
as funções dos outros agentes, para o nosso também usar como contexto
na hora de tomar ações". Antes disso, o Agente Ágil só tinha o texto
isolado de cada mensagem — sem saber, por exemplo, que
"agente-dados-concorrencia" é um sistema que coleta dados públicos de
mídia paga semanalmente, tinha que inferir isso só pelo conteúdo de
cada mensagem, sempre do zero.

**Client (kanban-dev.html)**: nova aba "🔌 Agentes Externos" em
⚙ Configurações (mesmo gate de visibilidade que "🤖 Histórico do
Agente" — só aparece em squads com escrita real do orquestrador,
`AGENTE_AGIL_MENTION_SQUADS`). ADM/PO cadastra um identificador (que
precisa bater com o campo `especialista` do envelope HTTP) + uma
descrição livre do que aquele sistema faz. CRUD simples, mesmo padrão
visual/de código de "Padrões de card" (lista expansível, cada item com
editar/excluir). Salvo em `config/agentesExternos` (mesmo squad-scoped
`FB` de sempre).

**Backend (`intakeTrigger.js`)**: `lerDescricaoEspecialista()` lê
`kanban/squads/{squad}/dados/config/agentesExternos/{especialista}` —
leitura pontual, sem cache (mesmo espírito de baixo volume do resto do
módulo) — e, se existir, prepend a descrição no `task` antes do texto
da mensagem em si, nos dois caminhos (com card e sem card/semCard).
Sem entrada cadastrada (especialista desconhecido, ou nenhum
`especialista` no envelope), nada muda — mesmo comportamento de antes.

2 testes novos em `intakeTrigger.test.js` (injeta quando cadastrado;
não injeta nada quando não cadastrado). Suíte inteira: 312/312
passando.

**Requer redeploy** (mesmas 3 functions de sempre):
`firebase deploy --only functions:agenteAgilMencao,functions:agenteAgilMencaoDados,functions:agenteAgilIntake`
