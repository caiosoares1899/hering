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

- **2026-08-30, área nomeada explicitamente — "processos de criar
  card"**: pedido direto do usuário, mais amplo que só `saveCard()`
  (já revisado na rodada anterior). Mapeados TODOS os `cards.push(...)`
  do arquivo (técnica 1) — `saveCard()`, `bulkDuplicate()`,
  `_duplicarCardObj()`/`_duplicarComFilhos()`, `_criarCardRecorrente()`,
  `_criarCardAgendado()`, `_applyFanoutTemplate()`/
  `_blankSuperChildCard()`, `quickCreateSuperChild()`,
  `doTrelloImport()`, `_inserirCardsRestaurados()` — e comparado o que
  cada um dispara em Automações. 1 achado real, reportado como pergunta
  de produto antes de implementar (Passo 3 — não era óbvio se era
  decisão deliberada, como já tinha sido o caso de "duplicar não
  dispara `card_created`" numa rodada anterior): "Agendamentos" (cards
  únicos programados) é o par exato de "Recorrentes" (mesma tela de
  Quick List, mesmo padrão `processX()`/`_criarCardX()`), mas nunca
  ganhou o trigger de Automação equivalente a "Card recorrente criado"
  — confirmado via `git log -S` que a lacuna existe desde a origem da
  feature (commit que adicionou `recorrente_created` nunca cobriu
  Agendamentos), não é regressão. Usuário confirmou que é bug real e
  pediu o mesmo padrão de `recorrente_created`. Fix: novo trigger
  `agendado_created` em `AUTO_TRIGGERS` — `card.agendadoDe` (slug via
  `_slugifyRecorrente()`, reaproveitada) como identificador, disparado
  de `processAgendamentos()` do mesmo jeito que `processRecorrentes()`
  já dispara o seu; `valueType:'agendado'` novo em
  `_autoValLabel()`/`_autoRenderValueOptions()`, espelhando
  `'recorrente'` (dev v8.30.507-dev). Descartado (checado, sem achado):
  `bulkDuplicate()`/`_duplicarCardObj()`/`_applyFanoutTemplate()`/
  `quickCreateSuperChild()`/`_inserirCardsRestaurados()` — nenhum
  dispara `card_created` nem nenhum outro trigger, mas isso já é
  consistente com a decisão registrada na rodada de 2026-08-27
  (operações DERIVADAS/em massa ficam de fora de propósito), não é uma
  inconsistência nova.

- **2026-09-01, pedido genérico — áreas escolhidas por prioridade 1
  (`git log --oneline -20 -- kanban-dev.html`)**: duas áreas frescas
  desta mesma sessão, nunca auditadas: cluster "Agente Ágil como
  Responsável/Participante" (`_dispatchAgenteAgilComment`,
  `_reagirSeAgenteAgilAtribuido`, `AGENTE_AGIL_ASSIGNEE_ENTRY`/
  `_SQUADS`) e o re-sync periódico de cards (`_reconcileCardsUpdatedAtPeriodic`,
  v8.30.515-dev). Cluster do Agente Ágil: técnica 1 aplicada a fundo —
  mapeados TODOS os call sites que escrevem `c.owner`/`c.participants`
  no arquivo (`_doBulkAssign`, ação de Automação `assign_owner`,
  `ctxAssignMe`, `executarReatribuir`/`editarInicial`, o `input.novo_owner`
  do painel de chat antigo/morto, recorrência/agendamento via
  `rec-owner`, Padrões de card via `_mergeModeloEmCardObj`, o tool
  `editar_campos` do orquestrador real) — em TODOS eles, o valor
  possível de owner/participants vem de `members`/validação de membro
  real, nunca de `allIdentities()`/do init especial `'🤖'` do agente;
  **sem achados** (só os dois call sites do modal — autosave e Salvar
  manual — conseguem atribuir o agente de verdade, e os dois já chamam
  `_reagirSeAgenteAgilAtribuido` corretamente). Re-sync periódico: 1
  achado real, severo — técnica 3 (confrontar comentário vs. código):
  o polling (`if(key==null) continue`, linha do `_reconcileCardsUpdatedAtPeriodic`)
  pulava qualquer card sem posição resolvida em `_liveCardsIndexById`,
  contando com o comentário "`_reconcileCardsIndexOnce` cuida disso" —
  só que essa reconciliação roda 1x só (500ms após a carga inicial,
  `_cardsIndexReconciled` trava reruns). Se o `child_added` de
  `/cards_index` de um card NOVO se perde (mesma classe de evento
  perdido que motivou o fix v8.30.515-dev), o card fica invisível pro
  RESTO da sessão da pessoa, sem aviso — pior que o bug original que
  motivou o polling. Fix: busca `/cards_index` em paralelo e faz
  backfill de `_liveCardsIndexById` na hora, em vez de pular (dev
  v8.30.517-dev).

- **2026-09-01, área nomeada explicitamente — "pontos de criação de
  card, duplicação"**: pedido direto do usuário. Técnica 1 (caminhos
  paralelos) aplicada a "duplicar um card": grep de todo
  `JSON.parse(JSON.stringify(` do arquivo achou 2 clones de card
  inteiro — `_duplicarCardObj()` (usado pelo modal individual e por
  `_duplicarComFilhos()`) e uma cópia própria dentro de
  `bulkDuplicate()` (seleção múltipla). 1 achado real: `bulkDuplicate()`
  nunca resetava `childCardIds` nem `pinned`/`pinnedAt` (este último,
  campo novíssimo da mesma sessão) — `_duplicarCardObj()` já fazia os
  dois, com comentário explícito no código sobre por quê. Cenário
  concreto: duplicar em massa um supercard fazia a cópia reivindicar os
  MESMOS filhos do original (2 pais pro mesmo filho); duplicar em massa
  um card fixado criava um 2º "fixado" na mesma coluna. Fix:
  `bulkDuplicate()` passa a reusar `_duplicarCardObj()` (com
  `comments:false`, preservando o comportamento de sempre de não copiar
  comentário em massa) em vez de manter uma 2ª cópia da lógica de clone
  (dev v8.30.522-dev). Demais pontos de criação citados pelo usuário —
  `_criarCardRecorrente`, `_criarCardAgendado`, `_blankSuperChildCard`/
  `quickCreateSuperChild`/`_applyFanoutTemplate` — checados e **sem
  achados**: todos constroem o card via objeto literal explícito (cada
  campo listado à mão), nunca clonando/espalhando um card existente
  inteiro, então imunes a essa classe específica de bug.

- **2026-09-01, área nomeada explicitamente — "pontos críticos de uso
  (comentários, checklist, acesso, descrições, tags)"**: pedido direto,
  5 sub-áreas de uma vez. Comentários: revisão de
  `replyToComment`/`deleteComment`/`startEditComment`/`saveEditComment`/
  `cancelEditComment`/`toggleReaction` — todos já consistentes com o fix
  de `_commentCardId` desta mesma sessão, **sem achados novos**
  (permissão de excluir/editar é só client-side — mesmo modelo de
  confiança do resto do app, que também não tem ACL de campo no
  Firebase; não é uma inconsistência LOCAL, então não reportado como
  achado). Checklist: `renderCL()` inteira lida — **sem achados** (toggle
  de "concluído" sem `saveUndo()` é intencional, reversível com 1
  clique, diferente de deletar/reordenar/editar texto que já têm undo).
  Tags: `_doBulkTagMulti`/`_doBulkTagClear`/`addCardTag`/`removeCardTag`
  — **sem achados**, todos disparam `runAutoRules('tag_added'/
  'tag_removed'/'submarca_set', ...)` consistentemente. Descrições:
  proteção "Demandante" (`_descProtViolada` no autosave,
  `_cDemProtBefore`/`_cDemProtAfter` no `saveCard()` manual) — **sem
  achados**, os dois caminhos usam a MESMA condição
  (`.includes()`+`canBulkDelete()`) e o comentário do autosave documenta
  de propósito por que o campo do DOM não é revertido ali (corrida
  contra a digitação) vs. no manual (onde é seguro).
  Acesso: 3 achados reais, técnica 2 (comparar contra padrão já
  resolvido) — grep de todo `==='po'` do arquivo achou 3 checagens de
  papel feitas na mão em vez de usar o helper canônico `_isPOorOrg()`
  (já usado certo em 7+ lugares), cada uma esquecendo um papel
  diferente:
  1. `openCal()` — `isPO` sem `adm`: ADM não via o botão "+" de criar
     evento no Calendário.
  2. `editEvent()` — mesmo esquecimento, pior: com `isPO` falso,
     `readOnly=!isPO` trava TODOS os campos do evento — ADM podia
     EXCLUIR um evento (canDelete sempre incluiu adm, com comentário
     explícito no código) mas não editar o conteúdo dele.
  3. `_renderEntrada()` (Campanhas) — o oposto: `podeApagar` esquecia
     `organizador`, que não conseguia apagar entrada de outra pessoa.
  Fix: as 3 passam a usar `_isPOorOrg()` (dev v8.30.523-dev).

- **2026-09-01, pedido genérico — área escolhida por prioridade 1
  (`git log --oneline -20 -- kanban-dev.html`)**: indicador "🤖
  pensando..." (v8.30.524-dev) — a feature mais fresca da sessão, nunca
  auditada, e a de maior risco (estado assíncrono com listener/timeout).
  3 achados reais: (1) técnica 1 (caminhos paralelos) — o card hotline
  tem seu PRÓPRIO listener permanente de comentários
  (`_attachAgenteHotlineCommentsListener`), diferente do listener
  temporário que `_startAgenteAgilThinking()` cria pra qualquer outro
  card; o permanente nunca checava se a resposta tinha chegado, então
  "pensando..." ficava preso 120s (timeout de segurança) até em vez de
  sumir na hora, justamente no card feito pra conversar com o agente.
  (2) técnica 4 (checagem incompleta) — tanto o listener temporário
  quanto o hook do achado #1 checavam só "existe algum comentário do
  agente?" em vez de "existe uma resposta NOVA?" — reabrir qualquer
  conversa já respondida (o normal) fazia o indicador aparecer e sumir
  instantaneamente. Fix: `window._agenteAgilThinking[cardId]` virou
  timestamp de início (não boolean), `_agenteAgilRespondeuDesde()`
  compara `ts`. (3) `notify_all` (a ação "Notificar todos" da mesma
  sessão) reusa `parseMentions()`, que sempre exclui
  `window._currentUser?.uid` — pra @menção humana faz sentido, pra
  automação não (é só quem por acaso processa o disparo, não quem
  deveria ficar de fora de um "todos"). Reportado como pergunta de
  produto (Passo 3) — usuário confirmou "todos deveria ser literal".
  Fix: `parseMentions()` ganhou `opts.includeSelf`, só `notify_all` usa
  (dev v8.30.527-dev).

- **2026-09-01, pedido genérico — área escolhida por prioridade 1, mas
  estendida pra `painel-dev.html`**: o código mais fresco da sessão não
  estava em `kanban-dev.html` (última mudança lá foi só o fix cosmético
  do Milanote) e sim a aba "🤖 Agentes" recém-criada no painel
  (`loadAgentesTabData()`/`renderAgentesAtivosGrid()`/
  `renderAgentesLogCross()`/`renderAgentesExternosPainel()` movida pra
  lá) — nunca tinha passado por essa revisão. 1 achado real, técnica 1
  (comparar caminhos paralelos) aplicada ao consumidor do link que eu
  mesmo tinha acabado de adicionar: o novo "abrir card ↗" do Histórico
  cross-squad (`renderAgentesLogCross()`) aponta pra `kanban.html?
  squad=X&card=Y`; se o card já foi arquivado/excluído (cenário que
  `renderAgenteLog()`, dentro do próprio board, já trata mostrando texto
  de fallback), `_openCardFromUrl()` (kanban-dev.html) tentava achar o
  card por ~6s e **desistia em silêncio** — clique não fazia nada,
  zero explicação. `openNotif()` (clique em notificação) tinha o MESMO
  gap, apesar de já tratar o caso irmão "comentário referenciado foi
  excluído" com toast + limpeza da notificação. Não era um bug
  introduzido pela aba Agentes — é uma lacuna pré-existente que outros
  3 lugares do painel (`squadBoardUrl()`: modal de push, calendário ×2)
  também já herdavam; meu link novo só foi mais um chamador exposto a
  ela. Fix: as 2 funções, ao esgotar as tentativas, mostram toast
  explicando que o card não foi encontrado; `openNotif()` também remove
  a notificação órfã, mesmo padrão que já usava pro comentário excluído
  (dev v8.30.536-dev). Lição: ao revisar uma área nova que só
  *referencia* dado de outro lugar (aqui: card ids num log), vale seguir
  o link até o destino real em vez de parar na borda da área nomeada —
  foi isso que expôs o bug de verdade, que não estava no código que
  acabou de ser escrito, mas no que ele passou a alcançar.

- **2026-09-01, área nomeada explicitamente — "nessa parte de agentes"
  (2ª rodada seguida na mesma área)**: usuário pediu revisão dedicada do
  CRUD de Agentes Externos (`criarAgenteExternoPainel()`/
  `salvarAgenteExternoPainel()`/`toggleAgenteExternoSquad()`/
  `renderAgentesExternosPainel()`, `painel-dev.html`) — funções que a
  rodada anterior só tinha MOVIDO de lugar (do modal "Configurar" pra
  aba própria), sem auditar a lógica de verdade. 2 achados reais:
  1. Técnica 4 (checagem incompleta) — `salvarAgenteExternoPainel()`/
     `toggleAgenteExternoSquad()` já liam fresco do Firebase antes de
     escrever (padrão correto, evita reverter mudança concorrente), mas
     o `if(!a) return;` pro caso "registro já não existe mais" era mudo
     — sem toast, clique não fazia nada visível. Encadeado com um 2º
     problema: `criarAgenteExternoPainel()` faz update otimista do cache
     local ANTES da escrita confirmar; um identificador com caractere
     inválido pra chave do Firebase (ex.: um ponto) fazia a escrita
     falhar mas deixava uma entrada "fantasma" só local, pra sempre —
     qualquer ação nela caía no mesmo retorno silencioso. Fix: toast nas
     2 funções + reversão do cache local quando a criação falha de
     verdade.
  2. Achado reportado primeiro como recomendação arquitetural (Passo 3/4
     — "não é fix pequeno"), IMPLEMENTADO depois que o usuário pediu
     explicitamente ("implementa os dois"): o listener de
     `kanban/config/agentesExternos` reconstrói a lista INTEIRA a cada
     mudança no nó — editar o Agente Y destruía o formulário aberto do
     Agente X (texto ainda não salvo), sem aviso. Mesmo padrão já
     existia em `renderAgentesList()` (Agentes de IA, kanban.html),
     pré-existente — não introduzido pela aba nova, só mais exposto por
     ela ser mais visível/persistente. Fix aplicado (escopo maior que o
     normal, mas pedido explicitamente): `renderAgentesExternosPainel()`
     captura os valores da linha aberta antes de reconstruir o HTML e
     restaura depois — não tentou resolver o padrão geral (patch
     incremental de DOM), só esse caso específico. `renderAgentesList()`
     não foi tocado (fora do escopo "aba agentes").
  Testado via Playwright headless com Firebase mockado — 4 cenários, os
  2 achados confirmados corrigidos (dev v3.07 · painel-dev). Lição: um
  "achado B" classificado como "só recomendação" na hora do relatório
  pode virar implementação na mesma rodada se o usuário pedir
  explicitamente — a regra "não é licença pra refatorar" é sobre NÃO
  tomar essa decisão sozinho, não sobre recusar quando pedido.

- **2026-09-01, área nomeada explicitamente — "pin do card"**: pedido
  direto. Feature pequena e contida (só ~12 referências a `pinned`/
  `pinnedAt`/`togglePinCard` no arquivo todo) — leitura completa de
  todas. Estado (1 fixado por coluna, reset ao duplicar — inclusive
  filhos de supercard, imunidade de recorrência/agendamento/import)
  **sem achados**, tudo correto; o caso "2 pinned na mesma coluna depois
  de mover" é decisão documentada de propósito no comentário de
  `_sortCards()`, não bug. 1 achado real, técnica 1 (comparar caminhos
  paralelos): `togglePinCard()` só tinha 1 call site — o botão 📌 no
  canto do card, `opacity:0` por padrão, só visível via `:hover`, sem
  NENHUM fallback pra toque (`@media (hover:none)` não existe em lugar
  nenhum do arquivo) nem atalho de teclado. Comparado contra o menu de
  contexto do card (`showCtxMenu()`), que já lista toda ação rápida
  equivalente de card único (mover, prioridade, atribuir a mim, OKR,
  duplicar, arquivar, excluir) — pin nunca tinha entrado lá, apesar de
  ser exatamente esse tipo de ação. Sem o menu, quem usa celular/tablet
  não tinha NENHUM jeito visual de descobrir a feature. Fix: item novo
  no menu de contexto, mesmo padrão de `ctxToggleOKR()`, chamando
  `togglePinCard()` direto — dá um 2º caminho sem mexer no botão hover
  nem no padrão CSS compartilhado com outros elementos (`.notif-dismiss`
  usa o mesmo esquema — não é bug exclusivo do pin, ficou fora do
  escopo). `HELP_CONTENT` também ganhou uma frase sobre o caminho novo,
  no mesmo commit (dev v8.30.537-dev). Testado via Playwright headless:
  item aparece com label certo, clique chama `togglePinCard()` de
  verdade, menu reflete o novo estado ao reabrir.

- **2026-09-02, pedido genérico — prioridade 1 (redesenho mobile do
  cabeçalho/modal do card, 3 commits mais recentes) sem novos achados,
  estendida pra "Card lock / Pedir o card" (nunca coberta antes)**:
  releitura completa de `_checkCardLock()`/`_handleLockRequest()`/
  `_renderLockRequestUI()`/`_releaseCardLock()`/`_setCardLockUI()` —
  mecanismo já muito bem documentado, com vários bugs anteriores citados
  inline nos próprios comentários (corrida de duas abas, editar em cima
  de dado velho ao herdar lock). 1 achado real, técnica 1 (comparar
  caminhos paralelos): `openAgenteHotline()` abre o card hotline
  chamando o MESMO `openCard(id)` de qualquer card normal — que sempre
  chama `_checkCardLock(id)` — mesmo o próprio comentário do código
  dizendo que esse card é "compartilhado entre QUALQUER pessoa que
  queira falar com o Agente Ágil" ao mesmo tempo. Pessoa A abre e
  mantém o modal aberto → vira dona do lock; pessoa B abre o MESMO card
  hotline → `.locked-ro` (`pointer-events:none` no `.modal-body`
  inteiro) trava até a caixa de comentário (`#m-comment-inp` não está
  na lista de exceções que continuam clicáveis, só anexos/links) — B
  fica impedida de falar com o agente, justo o cenário que a feature
  foi desenhada pra suportar. Como os campos que o lock protege
  (título/tags/coluna) já ficam todos escondidos nesse card, não havia
  nada ali pra proteger — fix: early-return em `_checkCardLock()` pra
  cards `agenteHotline` (ainda limpa timers/listener/UI de um card
  anterior, só não adquire/checa lock nenhum) (dev v8.30.543-dev).
  Lição: ao auditar uma feature "compartilhada por design" (comentário
  explícito no código dizendo isso), vale checar se ela herda algum
  mecanismo de outro fluxo (aqui: `openCard()`) pensado pra uso
  exclusivo de 1 pessoa por vez — a inconsistência não estava na
  feature nova em si, mas em reusar demais um caminho já existente sem
  considerar a premissa diferente.

- **2026-09-02, área nomeada explicitamente — "áreas sensíveis (cards,
  automações, multiselects...)"**: cards e automações já com histórico
  extenso de rodadas anteriores; foco em Multiselects (seleção
  múltipla/ações em massa) — nunca auditada como área própria antes
  (rodadas passadas só tinham revisado se os bulk actions disparavam
  Automação, não a lógica de dados dos próprios bulk actions). Leitura
  completa de `toggleSelectMode`/`toggleCardSelection`/
  `selectAllInColumn`/`updateBulkBar`/`_bulkFinish` + todas as ações
  (`bulkMove`/`bulkAssign`/`bulkDueDate`/`bulkTag`/`bulkBlocker`/
  `bulkDuplicate`/`bulkArchive`/`bulkDeleteSelected`). 1 achado real,
  técnica 2 (comparar contra padrão já resolvido em outro lugar do
  arquivo): `setCardTamanho()`/`setCardSubmarca()` (card individual)
  sempre removem qualquer tag antiga do MESMO grupo (👕 Tamanho: P/M/G/
  GG; Submarca: Adulto/Kids/Sports...) antes de adicionar a nova —
  impossível um card ter 2 tamanhos ou 2 submarcas ao mesmo tempo pela
  tela do card. Mas o picker de "🏷 Tag" da seleção múltipla
  (`_renderBulkTagPicker`) lista todas as tags do squad sem distinguir
  grupo — dava pra marcar "👕 P" e "👕 G" juntas e clicar "Adicionar"/
  "Substituir", deixando os cards com 2 tags do mesmo grupo ao mesmo
  tempo (acabava de ficar mais relevante ainda: o pin-por-submarca
  implementado nesta mesma sessão depende de um card ter só 1
  submarca). Fix em 2 pontos: o picker (`_bulkToggleTag`) desmarca a
  tag conflitante do mesmo grupo na hora do clique; `_doBulkTagMulti()`
  também garante isso no resultado final (defesa em profundidade, pro
  caso de o card já ter uma tag do grupo de antes) (dev v8.30.545-dev).
  Descartado (checado, sem achado): permissão de entrada
  (`toggleSelectMode`/`canBulkDelete` — mesma trava usada em todos os
  pontos, sem checagem feita na mão que pudesse divergir);
  `checkEditPermission()` não é chamado em NENHUM bulk action, mas é um
  stub documentado que sempre retorna `true` (não uma trava real hoje),
  então não é uma inconsistência entre bulk e single-card; disparo de
  Automação em cada bulk action já tinha sido coberto em rodadas
  anteriores (2026-08-27/29), sem achado novo aqui; `tag_added`/
  `tag_removed`/`submarca_set` no autosave (`scheduleAutoSave()`) já
  batem exatamente com o que o bulk dispara.

- **2026-09-02, área nomeada explicitamente — "ali em campanhas/
  coleções"**: primeira revisão dedicada do módulo Campanhas
  (`openCamp()`/`renderCampList()`/`openCampDetalhe()`/
  `renderCampDetalhe()`/`_renderEntrada()`/`openCampEdit()`/
  `openCampCardsGrid()`) — CODE_MAP.md só tinha 1 anchor nessa área
  (`renderCampDashboard()`), o resto nunca tinha entrada própria.
  "Coleção" não é área separada — é só um `tipo` de campanha
  (`c.tipo==='colecao'`), mesmo módulo. 1 achado real, técnica 2
  (comparar contra padrão já resolvido em outro lugar do arquivo):
  `renderCampList()` conta cards vinculados com o helper canônico
  `getCardTags(card).includes(t)` (só cai no campo legado `card.tag`
  quando `card.tags` nem existe como array); `_filterCards()` dentro de
  `renderCampDetalhe()` (alimenta a sidebar + a grade de cards da MESMA
  campanha) reimplementava a checagem na mão —
  `(card.tags||[]).includes(t)||(card.tag===t)`, sempre olhando os dois
  campos incondicionalmente. Card com `tags:[]` válido (sem a tag da
  campanha) + `card.tag` legado ainda igual à tag da campanha (resquício
  de antes da migração pra tags múltiplas) ficava fora da badge da
  lista mas aparecia no detalhe da mesma campanha — os 2 números nunca
  batiam. Fix: `_filterCards()` passa a usar `getCardTags()` (dev
  v8.30.546-dev). Testado com chamada real de `renderCampDetalhe()`
  (não só a expressão isolada) — confirmado 2→1 card no detalhe após o
  fix, batendo com a badge da lista. Demais funções lidas
  (`_renderEntrada`/`delCampEntrada`/`editEntradaData`/
  `openCampCardsGrid`) sem achados novos — `_renderEntrada` já reflete
  o fix de permissão (`_isPOorOrg()`) de uma rodada anterior
  (2026-09-01), e a exclusão/edição de entrada segue o mesmo modelo de
  confiança client-side-only já estabelecido no resto do app (não é uma
  inconsistência local).

- **2026-09-02, área nomeada explicitamente — "ali em funções de
  card"**: menu "⚡ Funções de card" (Automações/Recorrentes/
  Agendamentos/Modelos/Arquivados/Cards antigos) — Automações e a
  criação de card (Recorrentes/Agendamentos/Modelos) já tinham
  histórico extenso de rodadas anteriores; foco nos 3 itens menos
  auditados: Arquivados, Cards antigos, e a lista compartilhada
  Modelos/Recorrentes/Agendamentos (`renderQLBody()`). 1 achado real
  (mesma causa raiz em 3 lugares), técnica 2 (comparar contra padrão já
  resolvido — no caso de `renderQLBody()`, resolvido na MESMA função,
  poucas linhas acima): `_renderArquivadosBody()`/`renderCleanupList()`/
  `renderQLBody()` montavam o selo de tag de cada linha lendo
  `card.tag`/`item.tag` (campo legado) direto, enquanto o FILTRO por
  tag da mesma função já usava `getCardTags()` (multi-tag-aware) —
  card/item com `tags:['X']` mas `tag` vazio/desatualizado era achado
  certinho pelo filtro mas mostrava selo em branco na lista. Fix: as 3
  passam a usar `getTag(getCardTags(x)[0])` (dev v8.30.547-dev).
  Testado com card/item tendo `tags` populado e `tag` vazio nas 3
  telas — selo correto nas 3 depois do fix. Achado de passagem, FORA
  do escopo pedido (não implementado): `openSearch()` (Busca Ctrl+K,
  ~L28105) tem o mesmo padrão (`getTag(c.tag)`) — Busca não é "Funções
  de card", registrado aqui pra não esquecer numa rodada futura.

- **2026-09-02, área nomeada explicitamente — "ali na área de
  supercards e filhos" (revisita a área que deu origem à skill,
  2026-08-21)**: releitura completa de `_cardIsSupercard`/
  `_cardIsSuperChild`/`initSuperChildren`/`searchSuperChildren`/
  `addSuperChild`/`_blankSuperChildCard`/`quickCreateSuperChild`/
  `persistSuperChildren`/`_checkSupercardAutoComplete`/
  `_isColCancelLike` — muita coisa mudou desde a origem (2 níveis, pin,
  duplicar com filhos, card hotline), nunca revisitada como um todo. 1
  achado real, técnica 5 (recursão/cascata: teto só na UI, não no
  código) + técnica 2 (padrão já resolvido numa função irmã):
  `_checkSupercardAutoComplete()` (cascata filho→pai→avô de conclusão
  automática) nunca ganhou proteção contra ciclo corrompido nos dados —
  `_duplicarComFilhos()` (mesmo grafo `childCardIds`) já tem um
  `visited` explícito, com o próprio CODE_MAP documentando o motivo. A
  única barreira contra ciclo hoje é client-side, na hora de ADICIONAR
  um filho (`searchSuperChildren` só oferece candidato sem pai ainda) —
  não protege dado corrompido chegando por outro caminho (Firebase/
  console direto, corrida entre abas). Ciclo de verdade nos dados
  travaria a aba (recursão infinita). Cuidado na correção: um `Set`
  COMPARTILHADO entre chamadas-irmãs (cópia exata do padrão de
  `_duplicarComFilhos()`) quebraria um caso legítimo que o comentário da
  própria função já prevê — card com 2 pais (avô compartilhado). Fix:
  cada chamada recebe sua PRÓPRIA cópia do caminho de ancestrais, não
  um Set global — só bloqueia ciclo de verdade, preserva cascata
  legítima entre irmãos (dev v8.30.548-dev). Testado com Playwright: (1)
  ciclo corrompido A↔B — antes travaria, agora 0ms sem estourar pilha;
  (2) card com 2 pais compartilhando avô — os 3 níveis concluem
  corretamente, confirmando que a proteção não quebrou o caso legítimo.
  Achado descartado (checado, ambíguo, não implementado):
  `initSuperChildren()` acha o pai do card aberto sem excluir pai
  arquivado, enquanto `_cardIsSuperChild()` (helper canônico usado em
  outros lugares) exclui — pode ser intencional (mostrar "filho de X"
  mesmo com X arquivado é uma leitura razoável) ou pode ser gap; não
  óbvio pela leitura do código, fica registrado pra confirmar numa
  rodada futura se ficar relevante.

- **2026-09-02, área nomeada explicitamente — "área de colocar capa no
  card"**: primeira revisão dedicada da feature de capa (cor + imagem,
  mutuamente exclusivas — `CARD_COVER_COLORS`/`setCardCover()`/
  `setCardCoverImage()`/ação de Automação `set_cover`). Mapeados TODOS
  os pontos de escrita em `coverColor`/`coverImageUrl` do arquivo
  (técnica 1) — só 3 existem, e 2 tinham problema. 2 achados reais:
  1. `setCardCoverImage()` (card existente) zera `card.coverColor`
     silenciosamente ao escolher uma imagem, mas nunca chamava
     `runAutoRules('cover_set', ...)` — diferente de `setCardCover()`,
     que dispara sempre que a cor muda (inclusive indo pra "sem capa").
     Uma automação escutando "capa de cor → sem capa" nunca disparava
     se a remoção viesse por esse caminho. Fix: mesmo guard
     antes/depois que `setCardCover()` já usa.
  2. Ação de Automação `set_cover` ("Definir capa de cor") setava
     `card.coverColor` sem limpar `card.coverImageUrl` — quebra a
     exclusividade mútua documentada no próprio código
     ("escolher uma limpa a outra") e respeitada pelos 2 caminhos
     manuais. Card com capa de imagem + automação "Definir capa de
     cor": a cor muda nos bastidores mas a imagem (que tem prioridade
     no render) continua aparecendo — automação "sem efeito nenhum" até
     alguém trocar a capa manualmente depois e a cor fantasma aparecer.
     Fix: ação também limpa `coverImageUrl`.
  Testado com Playwright exercitando as funções reais (não só a
  expressão isolada): achado 1 dispara `cover_set` com valor vazio
  quando havia cor prévia, e corretamente NÃO dispara quando não havia
  (evita falso-positivo); achado 2 confirma `coverImageUrl` limpo após
  rodar a ação (dev v8.30.554-dev). Duplicação (`_duplicarCardObj()`) e
  a construção do `_newCard` (branch de criação de `saveCard()`)
  checados e **sem achados** — ambos herdam corretamente o estado já
  exclusivo de `_pendingCoverColor`/`_pendingCoverImageUrl` ou do card
  original, sem nenhuma escrita direta própria nos 2 campos.

- **2026-09-03, pedido direto do usuário — "nessa linha ai" (continuação
  da investigação de um alerta real de produção "[card sumiu
  inesperadamente]")**: não veio de escolha de área por prioridade — o
  usuário colou um log de erro real de produção numa conversa normal
  (fora do fluxo desta skill), a investigação achou a causa raiz
  (`scheduleAutoSave()` sem o mesmo guard `_editingQLItem` que
  `saveCard()` já tinha, escrevendo um card fantasma ao editar Modelo/
  Recorrente/Agendamento) e corrigiu na hora — só DEPOIS o usuário
  invocou `/monitorarbugs "nessa linha ai"` pra varrer a mesma área
  atrás de irmãos do mesmo bug. Técnica 1 (mapear TODOS os call sites
  de `cards.find(x=>x.id===editingId)` seguidos de escrita no Firebase)
  achou **6 caminhos adicionais** com o mesmo gap: `setCardCover()`/
  `setCardCoverImage()` (capa), `setCardPattern()` (Padrão), 
  `removeBlockerTag()` (impedimento), `persistSuperChildren()` (vincular
  filho de supercard — o pior caso, criava um card filho REAL órfão), e
  qualquer uma das ~50 chamadas de `fbSaveAll()` do arquivo (a mais
  insidiosa: arquivamento automático por idade roda em BACKGROUND, sem
  clique nenhum da pessoa editando o modelo). Decisão de fix: em vez de
  blindar os 6 call sites um por um (frágil — call site novo reabre o
  buraco), o guard foi pra dentro das 3 PRIMITIVAS de escrita que todo
  código, presente e futuro, obrigatoriamente passa —
  `fbSaveCard()`/`fbCreateCard()` recusam `card._isQLTemp`; `fbSaveAll()`
  filtra `_isQLTemp` do array antes de montar o índice/escrever. Mais 1
  guard pontual em `quickCreateSuperChild()` (bloqueia a ação inteira,
  evita o card órfão real). Testado com Playwright contra as funções
  reais: os 6 caminhos resultam em 0 escritas com um card `_isQLTemp`;
  card normal continua salvando normalmente nos 2 primitivos (dev
  v8.30.561-dev). **Lição pra próxima vez que um fix pontual for feito
  fora do fluxo desta skill** (ex.: resolvendo um relato ao vivo, como
  aqui): vale considerar já varrer os call sites irmãos na mesma hora,
  em vez de esperar um `/monitorarbugs` explícito depois — neste caso
  o fix inicial (só `scheduleAutoSave()`) tinha sido promovido pra prod
  ANTES da varredura achar os outros 6, exigindo uma 2ª promoção.

- **2026-09-03, pedido genérico — prioridade 1 já toda coberta pela
  própria investigação desta sessão (card fantasma + comparação com
  backup), escolhida a prioridade 2**: "⛓ Dependências entre cards"
  (`setDependsOn()`/`unlinkDependsOn()`/`searchDependsCards()`) —
  nunca tinha entrada no `CODE_MAP.md`, cruzada só de passagem na
  investigação anterior. 2 achados reais, os dois na mesma função
  (`searchDependsCards()`):
  1. Técnica 3 (comentário vs. código) — o comentário `// Also exclude
     cards that have this card as parent (prevent cycles)` nunca foi
     implementado de verdade: `exclude` só continha o próprio card,
     nunca os descendentes. `dependsOn` é single-valued (mesmo shape
     do supercard, 1 pai só), então qualquer descendente escolhido como
     novo "pai" fecha um ciclo de verdade. `buildDepChains()` já tinha
     `visited` (não trava com ciclo corrompido), mas o resultado ficava
     truncado/errado, escondendo metade do ciclo sem aviso nenhum. Fix:
     helper `_dependsDescendants()` (BFS por `dependents`), aplicado em
     2 níveis — `searchDependsCards()` tira os descendentes da lista
     mostrada, `setDependsOn()` também recusa com toast (defesa em
     profundidade — mesma lição do fix de cascata do supercard, dev
     v8.30.548-dev: proteção só na UI de adicionar nunca é suficiente
     sozinha).
  2. `isCurrentParent = currentCard?.parentId===card.id` — `parentId`
     é campo exclusivo de blocos de Nota (`nota.blocos[x].parentId`),
     nunca existe em card (campo certo é `dependsOn`) — o badge "✓ pai
     atual" no picker nunca aparecia, pra nenhum card, desde sempre.
  Testado com Playwright, cadeia real A→B→C: comparação antes/depois
  do fix confirma os 2 bugs na versão antiga (picker de C mostrava A e
  B como opção válida; completar o ciclo funcionava sem aviso; badge
  nunca aparecia) e os 2 corrigidos na nova, sem regressão no caso
  legítimo sem relação nenhuma (dev v8.30.563-dev).

Atualize esta seção a cada rodada nova (área coberta, achados, PRs) —
isso evita reanalisar do zero uma área que já foi varrida e está limpa,
e documenta o "por quê" de cada correção pra quem ler depois.
