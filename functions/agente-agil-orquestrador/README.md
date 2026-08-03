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
tags/priority (cenário dedicado + canário) → `editar_campos` desc como
sub-passo separado → `relatorio_html` só quando houver necessidade real
(desenhado originalmente pro especialista Databricks via `http.js`, não
óbvio que seja uma ação natural do orquestrador).

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
mudança em código de produção — só o script). Ainda não rodado contra o
Firebase real.

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
ferramenta escolhida. 133 testes continuam passando. Ainda não rodado
contra LLM real com o cenário corrigido.

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

**Estado atual**: escrita real validada ponta a ponta pras duas ações já
testadas (`comentario`, `mover_coluna`), restrita ao squad `dev`,
invocação sempre manual (scripts standalone, nunca gatilho automático).
Qualquer expansão — mais ferramentas em modo real, squad `dev` sem
restrição de toolset, gatilho automático, ou qualquer squad além de
`dev` (`ecomm` = produção) — é uma decisão nova, separada, ainda não
tomada.
