---
name: monitorarbugs
description: Varre o código do Maré Digital (kanban.html/kanban-dev.html principalmente, e por extensão painel.html/painel-dev.html, functions/ e database.rules.json quando a área tocar lá) como um engenheiro de arquitetura revisando o próprio sistema — procura bugs reais, inconsistências entre caminhos que deveriam se comportar igual, e código que sobrou de refactors incompletos, e corrige o que for claro. Use sempre que o usuário pedir "monitora bugs", "roda o monitorarbugs", "varre o código", "procura inconsistências", "audita o código atrás de bugs", "revisa essa área do código", "dá uma conferida se tem bug", ou invocar /monitorarbugs diretamente — mesmo que a frase não diga "bug" explicitamente (ex.: "dá uma olhada nessa parte, quero saber se tem algo pra corrigir"). Diferente de /otimizaçãoderotina (que é sobre bytes/performance/mobile, não correção de comportamento) e de /atualizarhelpcontent (documentação, não código).
---

# Monitorar Bugs — Maré Digital

Nasceu de uma revisão pedida direto pelo usuário na área de Supercards (2
níveis: campanha → criativo → versão) logo depois dela ir ao ar — usando o
`CODE_MAP.md` pra pular direto pras funções certas e lendo cada uma por
inteiro, 4 bugs reais apareceram em pouco tempo, sem chute: um contradizia
o próprio comentário da função, outro só existia porque dois caminhos
diferentes pra mesma operação (botão manual vs. Automação) faziam coisas
diferentes, outro era a mesma "campo vazio?" resolvida certo em um lugar do
arquivo e errado em outro. Esta skill existe pra repetir esse método
sempre que pedido, em vez de reconstruir a abordagem do zero a cada vez.

## O que esta rotina NÃO é

- **Não é `/otimizaçãoderotina`** — aquela é sobre bytes de download,
  performance e mobile, sem mudar comportamento. Esta é sobre
  comportamento ERRADO ou INCONSISTENTE — corrigir, não emagrecer.
- **Não é `/atualizarhelpcontent`** — aquela sincroniza texto/documentação
  in-app. Esta mexe em lógica.
- **Não é licença pra refatorar/redesenhar.** A correção certa pra um bug
  costuma ser pequena e local. Se o jeito certo de corrigir exige mudar
  arquitetura (não só a função com o bug), **reporte como recomendação
  separada, não implemente de bandeja** — mesma regra que
  `/otimizaçãoderotina` já aplica pra "quebrar o script em arquivo
  externo".

## Escopo de cada rodada

- **Usuário nomeou uma área** ("supercards", "notificações", "ficha
  técnica", "checklist", "automações"...): escopo só nela. Usa o
  `CODE_MAP.md` pra achar as âncoras da área — ele é um retrato, não
  live, então **sempre re-`grep` cada nome antes de confiar na linha**
  (mesma regra que o próprio `CODE_MAP.md`/`CLAUDE.md` já deixam
  explícita).
- **Pedido genérico** ("varre tudo", "roda a rotina de bugs", sem
  especificar onde): não tenta ler o arquivo inteiro (~28k linhas) numa
  passada só. Escolhe 1-2 áreas por rodada, nesta ordem de prioridade:
  1. áreas alteradas mais recentemente (`git log --oneline -20 --
     kanban-dev.html`) — código fresco é o de maior risco;
  2. áreas que a seção "Histórico de achados" abaixo ainda não cobre;
  3. se nada se destacar, pergunta ao usuário qual área focar em vez de
     escolher às cegas.
- Arquivo padrão: `kanban-dev.html` (superfície viva de dev). Estende
  pra `painel.html`/`painel-dev.html`, `functions/`,
  `database.rules.json` só se a área escopada morar lá ou o pedido for
  amplo o bastante pra justificar.

## Passo 1 — Reconstituir o entry point

Ache as âncoras da área no `CODE_MAP.md`, re-`grep` cada nome (arquivos
deste repo têm emoji/unicode — se `grep -n` disser "binary file
matches", usa `grep -na`) pra confirmar a linha atual, e **leia as
funções INTEIRAS**, não trechos isolados — um bug de estado/condicional
normalmente só aparece olhando a função de ponta a ponta de uma vez, não
num grep pontual.

## Passo 2 — Técnicas que já renderam achados reais (nesta ordem de custo/benefício)

1. **Comparar caminhos paralelos pra mesma operação.** Toda vez que
   existe mais de um jeito de disparar a mesma mutação — botão manual
   dentro do modal vs. ação de Automação vs. import/bulk vs. chamada do
   Agente Ágil — os dois quase sempre deviam fazer exatamente a mesma
   coisa. Ache TODOS os call sites da função que persiste o dado
   (`grep -na "nomeDaFuncao("`) e compare linha a linha o que cada um
   faz antes/depois de chamá-la. Foi assim que se achou: fan-out
   disparado por Automação não propagava a Ficha Técnica pros filhos,
   porque só o botão manual chamava `_crvPropagateToChildren()` depois.
2. **Comparar contra um padrão já resolvido em outro lugar do arquivo.**
   Se uma checagem se repete em mais de uma função (ex.: "esse campo tá
   vazio?"), grepe por implementações irmãs da mesma checagem (nomes
   tipo `isEmpty`, ou o padrão `!campo`/`.length===0` espalhado) e
   compare. Foi assim que se achou: `_crvPropagateToChildren` usava
   `!crv[k]` (que NÃO pega array vazio `[]` — truthy em JS) enquanto
   `_mergeModeloEmCardObj`, resolvendo o mesmo tipo de problema, já
   tinha um helper `isEmpty()` correto.
3. **Confrontar o comportamento com o comentário da própria função.**
   Quando uma função documenta um "mapa de estados" no comentário (ex.:
   "N estados possíveis: ..."), percorra CADA estado descrito e
   confirme no código que ele realmente resulta no comportamento
   prometido — um estado esquecido na condicional é o tipo de bug mais
   fácil de nunca aparecer em teste manual (ninguém testa o estado que
   não sabe que existe). Foi assim que se achou: o comentário de
   `_crvUpdateFichaSecVisibility` descrevia que uma "versão" (2º nível)
   deveria esconder todos os campos próprios da ficha, mas a condicional
   só cobria o caso "campanha".
4. **Pegadinhas de JS em checagem de vazio/falsy.** `[]` e `{}` são
   truthy; `0`/`''`/`NaN` são falsy mas podem ser dado válido (ex.: um
   campo numérico zerado de propósito, não "vazio"). Qualquer
   `if(!campo)`/`if(campo)` decidindo entre "vazio" e "preenchido"
   merece essa checagem específica.
5. **Rastrear recursão/cascata por ciclo e profundidade.** Funções
   recursivas sobre relação pai-filho (conclusão em cascata, cópia
   recursiva, propagação) — confirme que o teto de profundidade
   documentado é aplicado no CÓDIGO, não só bloqueado na UI (uma
   checagem de UI que impede criar um estado não protege se o dado
   chegar por outro caminho — import, script de console, corrida de
   concorrência entre duas abas).
6. **Código morto / nunca chamado.** Uma função definida mas sem
   nenhum call site real (`grep -nac "nomeDaFuncao("` deve dar mais que
   1 — a própria declaração já conta uma vez) é sinal de refactor
   incompleto ou feature abandonada. Reporte, não delete sem confirmar
   — pode ser chamada só via `onclick="..."` inline no HTML (esse grep
   já pega) ou só existir pra uso futuro documentado.

## Passo 3 — Classificar antes de corrigir

- **Bug claro, sem ambiguidade de comportamento esperado** (ex.: os 4
  achados de exemplo acima): corrige direto, sem perguntar.
- **Ambíguo / decisão de produto** (a pergunta "o que deveria acontecer
  quando X?" não tem resposta óbvia só lendo o código): **pergunta antes
  de implementar** — mesmo padrão usado pra "supercard deveria concluir
  sozinho se todos os filhos forem cancelados?" antes de mexer nisso.
- Nunca refatore/redesenhe além do necessário pra corrigir o achado
  específico — ver "O que esta rotina NÃO é" acima.

## Passo 4 — Reportar achados

Pra cada achado: arquivo + função/linha, o cenário concreto que expõe o
bug (input/estado → resultado errado, não só "isso parece estranho"), e
a severidade. **Apresente a lista antes de sair corrigindo tudo**, a
menos que o pedido original já tenha sido "corrige tudo que achar" —
fluxo já validado: reportar achados, usuário responder "resolve!" +
esclarecer o caso ambíguo, só então implementar.

## Passo 5 — Corrigir + checks de rotina + release

Mesma disciplina de sempre neste repo:
1. Corrige só no arquivo `-dev`/de teste da área tocada (nunca
   `kanban.html` direto — segue o "Release process" do `CLAUDE.md`).
2. `node --check` no maior bloco `<script>` + balanço de chaves/
   parênteses do arquivo inteiro contra o baseline conhecido da sessão.
3. Se a correção criou uma função/helper novo, confere se o
   `CODE_MAP.md` precisa de anchor novo — atualiza no mesmo commit ou
   roda `/atualizarcodemap` depois.
4. Bump de versão + entrada em `CHANGELOG.md`, explicando o bug real
   com o cenário concreto que ele causava — não só "corrige
   inconsistência".
5. Commit → `git fetch origin main -q && git rebase origin/main -q` →
   push → PR (nunca self-merge sem checar CI).
6. Promoção pra prod é etapa separada (`/subirproprod`), só depois de
   validação explícita de quem pediu a revisão.

## Histórico de achados (não repetir análise já feita)

- **2026-08-21, área Supercards (2 níveis) — origem desta skill**:
  revisão pedida direto pelo usuário logo após a v8.30.454 (encadeamento
  campanha→criativo→versão) ir ao ar. 4 bugs reais achados e corrigidos
  (dev v8.30.454-dev, PR #466 → prod v8.30.455, PR #467):
  1. `_crvUpdateFichaSecVisibility` — versão (2º nível) mostrava campos
     próprios como editáveis, contradizendo a própria nota do card
     (achado via técnica 3, comentário vs. código).
  2. `apply_fanout` (ação de Automação) não chamava
     `_crvPropagateToChildren()` como o caminho manual chama (achado
     via técnica 1, caminhos paralelos).
  3. `_crvPropagateToChildren` usava `!crv[k]` em vez de checar array
     vazio de verdade (achado via técnica 2, comparação com
     `_mergeModeloEmCardObj`/`isEmpty()`).
  4. `_checkSupercardAutoComplete` concluía o supercard sozinho mesmo
     com todos os filhos cancelados — achado reportado como pergunta de
     produto (Passo 3), confirmado pelo usuário como bug real antes de
     implementar `_isColCancelLike()`.

- **2026-08-26, área Automações (`AUTO_TRIGGERS`/`runAutoRules`)**:
  não veio de pedido explícito de área — o usuário reportou "automações
  não estão funcionando" ao vivo, a investigação achou o 1º bug fora do
  fluxo desta skill, e o 2º veio de rodar a técnica 1 (caminhos
  paralelos) contra o achado do 1º. 2 bugs reais, mesma classe os dois:
  um evento de trigger disparava por alguns caminhos (arrastar, atalhos
  de contexto/bulk) mas não pelo modal do card (Salvar/autosave), porque
  o wrapper de notificações em `saveCard()`/`scheduleAutoSave()`
  disparava a notificação (`notifX()`) mas esquecia o `runAutoRules()`
  irmão — diferente dos outros blocos do mesmo wrapper, que sempre
  disparam os dois juntos.
  1. `assigned` ("Card atribuído a X") não disparava ao trocar
     responsável pelo dropdown do modal + Salvar (dev v8.30.474-dev,
     PR #533 → prod v8.30.474, PR #534).
  2. `move` ("Card movido para coluna") não disparava ao trocar a
     coluna pelo dropdown do modal + Salvar OU autosave — só
     arrastar/`ctxMove()` disparavam (dev v8.30.476-dev, PR aberta
     nesta rodada). Achado ao comparar TODOS os call sites de
     `runAutoRules('move', ...)` contra o padrão que causou o bug #1.

- **2026-08-26, áreas card hotline "Converse com o Agente Ágil" +
  checkbox "Incluir supercards" em Campanhas**: pedido genérico (sem
  área especificada) — escolhidas as 2 áreas mudadas mais recentemente
  no histórico (`git log --oneline -25 -- kanban-dev.html`, prioridade
  1 do "Escopo de cada rodada"). Campanhas: comparada contra o padrão
  já resolvido em Criativos (técnica 2) — implementação correta e bem
  justificada (usa variável em vez de DOM porque o HTML do checkbox é
  reconstruído a cada render ali; em Criativos o checkbox é estático),
  **sem achados**. Card hotline: 2 achados reais, mesma causa raiz — o
  card foi desenhado pra ficar fora do grafo normal de cards (sem dono,
  sem prazo, excluído do board via `renderBoard()`), mas várias outras
  agregações/buscas de "todos os cards" nunca ganharam essa mesma
  exclusão (dev v8.30.487-dev):
  1. `renderBoardDataGrid()`, `renderBoardDataInsights()` e
     `_boardDataBarChart()` (painel "📊 Dados do Board") não excluíam
     `agenteHotline` — "Cards ativos"/"Sem responsável" ficavam
     permanentemente +1 em qualquer squad com o recurso. Achado via
     técnica 1 (comparação com o filtro já correto de `renderBoard()`).
  2. O card hotline aparecia em 3 buscas/pickers de card que não
     deveriam listá-lo: menção `@card:` em comentários/descrição, busca
     de cards pra vincular numa Nota, e busca de filhos de supercard
     (esse último dava pra transformar o card hotline em filho de outro
     card). Achado ao grepar todo `cards.filter(c=>!c.archived...)` do
     arquivo e conferir cada um contra a mesma exclusão.

- **2026-08-27, áreas Automações (ações em massa) + `_duplicarComFilhos()`**:
  pedido genérico de novo — nenhum código novo em `kanban-dev.html`
  desde a rodada anterior (só doc), então a prioridade 1 (área mudada
  mais recentemente) não mudou; escolhida a prioridade 2 (áreas não
  cobertas), com extensão direta de um achado já confirmado. 5 achados
  reais em Automações, mesma causa raiz dos 2 bugs de 2026-08-26
  ('assigned'/'move' não disparando via modal): dessa vez em **ações em
  massa** (seleção múltipla) — `_doBulkMove()`, `_doBulkBlockCol()`/
  `_doBulkUnblockCol()` e `_doBulkBlockTag()`/`_doBulkUnblockTag()`
  nunca disparavam `runAutoRules('move'/'blocked'/'unblocked', ...)`,
  só as ações de 1 card por vez disparavam (dev v8.30.488-dev). Achado
  ao comparar TODOS os call sites de `runAutoRules('move', ...)` — a
  rodada anterior já tinha feito essa comparação, mas não tinha
  alcançado as funções de bulk action. `_duplicarComFilhos()`: sem
  achados — a dúvida óbvia ("duplicar deveria disparar 'card_created'?")
  já tinha sido decidida explicitamente pelo usuário no mesmo dia
  anterior (só `criar_card` do Agente Ágil dispara esse trigger, de
  propósito) — comentário no código (L19603-19606) evitou reabrir uma
  pergunta já respondida.

- **2026-08-27, pedido direto do usuário — "ações desse tipo que
  rolaram ontem com a coluna de impedimento"**: não foi escolha de área
  por prioridade (1 ou 2 do "Escopo de cada rodada") — usuário pediu
  pra achar OUTRAS mutações que repitam o padrão do incidente de
  2026-08-26 (card criado/movido pra um id de coluna que não existe
  mais). Técnica usada: grep de TODO `.col=`/`col:` do arquivo com
  string literal ou vindo de config salva (não só os call sites de uma
  função específica). 3 achados reais, mesma causa raiz, pior que o
  caso original — o card órfão nasce sozinho, sem ninguém olhando, a
  cada disparo (dev v8.30.489-dev):
  1. `_criarCardRecorrente()` — cards recorrentes guardam `item.col`
     (escolhido na configuração) sem revalidar se a coluna ainda existe
     no momento em que o card nasce, dias/semanas depois.
  2. `_criarCardAgendado()` — mesmo padrão, cards agendados.
  3. `openQLEdit()` — mesmo padrão na tela de edição do modelo/
     recorrente/agendamento (sintoma: campo "Coluna" em branco).
  `parseTrelloJSON()` (import) já tinha proteção equivalente
  (`SEMANTIC_TO_REAL`) — usado como referência do padrão de fix
  (`(item.col && columns.some(c=>c.id===item.col)) ? item.col :
  (columns[0]?.id||'backlog')`), aplicado nos 3 achados.

- **2026-08-27, área Agente Ágil (Histórico do Agente + Pedidos de
  Intake)**: pedido genérico — escolhida a prioridade 1 (área alterada
  mais recentemente, `git log --oneline -20 -- kanban-dev.html`: submarca/
  origem em Pedidos de Intake, feito no mesmo dia). 2 achados reais,
  mesmo dia da própria feature que os introduziu (dev v8.30.493-dev):
  1. `renderAgenteLog()`/`agenteLog.js` — `autonomous` nasceu binário
     (`comment.uid==='automacao'` ou não), assumindo só 2 origens
     possíveis (@menção humana, Automação/scan diário). `intakeTrigger.js`
     (mesmo dia) introduziu uma 3ª — `comment.uid` no formato
     `especialista:*` — que caía no braço "não é automação" e virava
     `autonomous:false`, fazendo o Histórico do Agente exibir "👤
     Databricks pediu via menção" pra uma ação disparada automaticamente
     por informação de especialista externo, frase falsa (achado via
     técnica 3, confrontando o comentário do módulo — que documentava
     "3 gatilhos" — contra o código, que só tratava 2 origens de fato).
     Fix: `classificarOrigem()`/campo `origem` novo (3 valores), com
     fallback no cliente pra entradas antigas sem o campo.
  2. `_intakeCriarCard()` — pré-marcava a tag de Submarca sugerida sem
     checar `submarcaAtivo` (o backend só exige/valida submarca quando a
     feature está ligada, mas não impede o campo vir preenchido mesmo
     desligada) — achado via técnica 4 (checagem de campo sem considerar
     o estado que o torna relevante), guard adicionado.

- **2026-08-29, área Agentes Externos no painel (`painel-dev.html`)**:
  pedido genérico — prioridade 1 (área alterada mais recentemente),
  cobrindo o próprio trabalho desta sessão (migração de registro por
  squad, dentro do kanban, pra registro global no painel, PR #598). 1
  bug real, achado via técnica 2 (comparação com padrão já resolvido em
  outro lugar do arquivo): `toggleAgenteExternoSquad()` e
  `salvarAgenteExternoPainel()` faziam merge a partir do cache local
  (`agentesExternosCfg[id]`) antes de escrever, em vez de ler fresco do
  Firebase — `painel.html` (prod) já tinha esse exato padrão resolvido
  em outro lugar (comentário "Lê fresco do Firebase antes de
  escrever... evita reverter mudanças concorrentes"), o código novo não
  seguiu. Cenário concreto: marcar 2 squads em sequência rápida pro
  mesmo agente podia apagar silenciosamente a 1ª marcação, se o 2º
  clique chegasse antes do round-trip do 1º atualizar o cache local
  (dev v3.02 · painel-dev).

- **2026-08-29, área Automações (`AUTO_TRIGGERS`/`saveCard()` branch de
  criação)**: pedido genérico — nenhum código novo tocou kanban-dev.html
  desde a rodada anterior (que cobriu painel-dev.html), então voltei à
  prioridade 1 de verdade: mapeei TODOS os call sites de
  `runAutoRules()` do arquivo (técnica 1) e cruzei contra os campos que
  o branch de criação de `saveCard()` já grava no `_newCard`. 3 achados
  reais, mesma causa raiz (e mesma classe dos achados de 2026-08-26/27
  — trigger disparando em alguns caminhos mas não em outros pra mesma
  mutação conceitual), desta vez no eixo "campo definido AO CRIAR o
  card" vs. "campo definido depois, editando um card já existente" (dev
  v8.30.502-dev):
  1. `cover_set` ("Capa de cor definida como") — `setCardCover()` só
     dispara no branch de card existente; `_pendingCoverColor` vira
     `_newCard.coverColor` sem disparo no branch de criação.
  2. `padrao_set` ("Padrão de card definido como") — mesmo padrão em
     `setCardPattern()`/`_newCardPadraoId`. Achado incidental: é a
     MESMA feature do fix #590 (v8.30.500-dev, que corrigiu "escolher
     um padrão ao criar" não aplicar nada) — a automação correspondente
     tinha ficado pra trás no mesmo fix.
  3. `tag_added`/`submarca_set` — branch de edição faz diff de tags e
     dispara por tag nova; branch de criação nunca disparava nada pras
     tags já escolhidas antes do 1º Salvar.
  Descartado (checado, sem achado): `marked_okr` na criação — o
  checkbox `#m-is-okr` é só armazenamento interno (`display:none`
  sempre), a única forma real de marcar OKR é via menu de contexto num
  card já existente (`ctxToggleOKR()`) — não é um caminho de criação
  que existe de verdade, então não há gap nenhum aí.

- **2026-08-29, área Automações × Agente Ágil (backend orquestrador)**:
  continuando a auditar Automações no mesmo dia, técnica 1 aplicada num
  nível acima — não só "todo call site de `runAutoRules()` no cliente
  dispara certo?" (já coberto), mas "existe algum caminho de MUTAÇÃO
  que nunca passa por `runAutoRules()` nenhum?". Achado: mutações do
  orquestrador real (`mover_coluna`/`editar_campos`/`checklist_item`/
  `risco`, via `functions/agente-agil-orquestrador/tools/realHandlers.js`)
  escrevem direto no Firebase via Admin SDK, sem passar por NENHUM
  caminho client-side que dispara Automação — checagem inicial (achou
  o painel de chat morto `qa()`/`executeTool()`, mas era kill switch
  documentado, `AGENTE_AGIL_ATIVO=false`, não bug) levou a essa
  descoberta maior. Diferente dos achados anteriores (uma chamada de
  `runAutoRules()` faltando num call site que já existia), este é
  ARQUITETURAL — reportado como recomendação primeiro (Passo 3/4), só
  implementado depois de "pode tratar" do usuário. Solução: fila
  `agente_pending_auto` (backend enfileira o que mudou, comparando
  card antes/depois — `pendingAuto.js`) + reivindicação via
  `transaction()` no cliente (`_claimPendingAuto()`, evita disparo
  duplicado com várias abas abertas) — ver `functions/agente-agil-
  orquestrador/README.md` ("Mutações do orquestrador passam a
  disparar Automações") pro desenho completo. `criar_card` não
  precisava do fix — nunca cria card direto, só um rascunho que um
  humano confirma pelo `saveCard()` normal. Achado colateral ao
  escrever os testes: um fake db de teste devolvia a MESMA referência
  de objeto em `get()` (não uma cópia imutável como o SDK real
  garante), fazendo um snapshot "antes" mudar sozinho quando o
  "depois" era escrito — mascarava qualquer diff. 8 testes novos, dev
  v8.30.503-dev.

- **2026-08-29, área Padrões de card (`cardPatterns`) — varredura
  completa, fora do ângulo de Automação**: nenhum código novo desde a
  rodada anterior, prioridade 1 não mudou; escolhida a prioridade 2, mas
  não uma área qualquer — "Padrão de card" já tinha 3 bugs reais em
  dias recentes (#589, #590, e `padrao_set` corrigido ontem), sinal de
  risco concentrado ali. 1 achado real via técnica 2 (comparação de
  funções irmãs): de 5 funções que mexem em `cardPatterns`, só
  `togglePadraoSecao()` atualizava um card já ABERTO na hora
  (`_applyCardSectionsVisibility()`); `criarPadraoCard()`/
  `renomearPadraoCard()`/`definirPadraoDefault()`/`excluirPadraoCard()`
  dependiam só do round-trip do Firebase — janela real de
  inconsistência, alcançável de verdade (`mnavGo('cfg')` no nav mobile
  abre Configurações sem fechar um card já aberto). Fix: helper
  `_refreshOpenCardPattern()` chamado pelas 4 funções que estavam sem
  isso (dev v8.30.504-dev).

- **2026-08-30, área Notificações in-app (client-side)**: pedido
  genérico — nenhuma área coberta ainda pela skill, escolhida por estar
  ligada ao mesmo padrão de bug já achado 2x no backend (`idOverride`
  de menção não cobrindo todos os caminhos, `mentionTrigger.js`). 1
  achado real via técnica 1 (comparando caminhos paralelos pra mesma
  operação): o wrapper de notificações em torno de `saveCard()` manual
  já disparava `parseMentions()` nos itens de checklist, mas o bloco
  equivalente em `scheduleAutoSave()` (autosave) não — e editar um item
  de checklist já existente só passa pelo autosave (blur/Enter do
  textarea chama `scheduleAutoSave()` direto, nunca `saveCard()`), então
  uma `@menção` digitada num item de checklist só notificava se a
  pessoa clicasse em "Salvar" por outro motivo depois. Mesma classe já
  corrigida aqui pra descrição/PO/motivo de bloqueio — só não foi
  estendida quando a menção em checklist foi adicionada depois (commit
  `c134ccd`). Fix: mesma chamada de `parseMentions()` adicionada no
  bloco de notificações do autosave (dev v8.30.505-dev).

- **2026-08-30, área Notas (lista + editor de blocos em árvore + vínculo
  com cards)**: pedido genérico — nenhum código novo desde a rodada
  anterior, prioridade 1 não mudou (mesma área/fix já coberto);
  escolhida a prioridade 2 (área nunca varrida). Leitura completa de
  `toggleNotas()`/`renderNotasList()`/`renderNotaEditor()`/
  `criarBlocoIrmao()`/`indentBloco()`/`outdentBloco()`/
  `mergeComAnterior()`/`toggleNotaModo()`/vínculo nota↔card nos dois
  sentidos (`notaAddCardLink`/`cardAddNotaLink` etc.). **Sem achados**:
  indent/outdent/merge são estruturalmente à prova de ciclo (indentar só
  vira filho do irmão imediatamente anterior; outdent só sobe ao nível
  do avô; merge só junta com irmão anterior ou pai — nunca um
  descendente); os vínculos nota↔card usam `_update()` cirúrgico por
  chave (`cardIds/{id}: true|null`), não o padrão merge-a-partir-do-
  cache-local que já causou bug em Agentes Externos e quase causou em
  Padrões de card; `toggleNotaModo()` de fato empurra undo antes de
  cada troca destrutiva, como o comentário promete.

- **2026-08-30, área nomeada explicitamente — `saveCard()`**: pedido
  direto do usuário ("foca no saveCard"), não escolha por prioridade.
  Leitura completa da função (branch de edição, branch de criação,
  `.then()`/`.catch()` de confirmação do Firebase). 1 achado real,
  severo: a trava de reentrância `_savingCard` (impede clique duplo
  criando cards repetidos) é armada — e o botão vira "💾 Salvando…"
  desabilitado — ANTES de confirmar que o card sendo editado ainda
  existe em `cards[]`. Se sumiu (`if(!c) return;`, alcançável de
  verdade: card excluído/arquivado em massa por outra aba enquanto o
  modal segue aberto), a função saía sem desarmar nada — diferente de
  toda falha de validação anterior, que já retorna cedo sem tocar na
  trava (comportamento documentado na própria declaração de
  `_savingCard`). Resultado: botão preso pra sempre, e todo clique
  futuro em Salvar — de QUALQUER card — virava no-op silencioso (mesmo
  guard no topo da função), sem nenhum erro visível; só reload
  destravava. Achado via técnica 3 (confrontando o comportamento
  prometido pelo comentário da declaração contra o código de verdade).
  Fix: toast explicando que o card não existe mais + `_finishCloseOv()`
  direto (não `closeOv()`, que perguntaria "alterações não salvas?"
  sem sentido aqui) — já reseta a trava/botão como rede de segurança
  (dev v8.30.506-dev).

Atualize esta seção a cada rodada nova (área coberta, achados, PRs) —
isso evita reanalisar do zero uma área que já foi varrida e está limpa,
e documenta o "por quê" de cada correção pra quem ler depois.
