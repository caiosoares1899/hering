---
name: monitorarbugs
description: Varre o código do Maré Digital (kanban.html/kanban-dev.html principalmente, e por extensão painel.html/painel-dev.html, functions/ e database.rules.json quando a área tocar lá) como um engenheiro de arquitetura revisando o próprio sistema — procura bugs reais, inconsistências entre caminhos que deveriam se comportar igual, e código que sobrou de refactors incompletos, e corrige o que for claro. Use sempre que o usuário pedir "monitora bugs", "roda o monitorarbugs", "varre o código", "procura inconsistências", "audita o código atrás de bugs", "revisa essa área do código", "dá uma conferida se tem bug", ou invocar /monitorarbugs diretamente — mesmo que a frase não diga "bug" explicitamente (ex.: "dá uma olhada nessa parte, quero saber se tem algo pra corrigir"). Diferente de /otimizaçãoderotina (que é sobre bytes/performance/mobile, não correção de comportamento) e de /atualizarhelpcontent (documentação, não código).
---

# Monitorar Bugs — Maré Digital

Nasceu de uma revisão pedida direto pelo usuário na área de Supercards (2
níveis: campanha → criativo → versão) logo depois dela ir ao ar — usando o
`CODE_MAP.md` pra pular direto pras funções certas e lendo cada uma por
inteiro, 4 bugs reais apareceram em pouco tempo, sem chute. Esta skill
existe pra repetir esse método sempre que pedido, em vez de reconstruir a
abordagem do zero a cada vez.

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

- **Usuário nomeou uma área**: escopo só nela. Usa o `CODE_MAP.md` pra
  achar as âncoras da área — ele é um retrato, não live, então **sempre
  re-`grep` cada nome antes de confiar na linha**.
- **Pedido genérico** ("varre tudo", sem especificar onde): não tenta ler
  o arquivo inteiro (~28k linhas) numa passada só. Escolhe 1-2 áreas por
  rodada, nesta ordem de prioridade:
  1. áreas alteradas mais recentemente (`git log --oneline -20 --
     kanban-dev.html`) — código fresco é o de maior risco;
  2. áreas que o "Histórico de achados" abaixo ainda não cobre;
  3. se nada se destacar, pergunta ao usuário qual área focar.
- Arquivo padrão: `kanban-dev.html`. Estende pra `painel.html`/
  `painel-dev.html`, `functions/`, `database.rules.json` só se a área
  escopada morar lá ou o pedido for amplo o bastante pra justificar.

## Passo 1 — Reconstituir o entry point

Ache as âncoras da área no `CODE_MAP.md`, re-`grep` cada nome (`-a`
sempre — emoji/unicode fazem `grep -n` sem `-a` reportar "binary file
matches") pra confirmar a linha atual, e **leia as funções INTEIRAS**,
não trechos isolados — um bug de estado/condicional normalmente só
aparece olhando a função de ponta a ponta.

## Passo 2 — Técnicas que já renderam achados reais (nesta ordem de custo/benefício)

1. **Comparar caminhos paralelos pra mesma operação.** Toda vez que
   existe mais de um jeito de disparar a mesma mutação — botão manual vs.
   Automação vs. import/bulk vs. Agente Ágil — os dois deviam fazer
   exatamente a mesma coisa. Ache TODOS os call sites da função que
   persiste o dado (`grep -na "nomeDaFuncao("`) e compare o que cada um
   faz antes/depois. É a técnica de maior retorno — a maioria dos achados
   reais desta skill veio daqui (ver histórico abaixo).
2. **Comparar contra um padrão já resolvido em outro lugar do arquivo.**
   Se uma checagem se repete em mais de uma função (ex.: "isso é
   vazio?", "essa pessoa pode editar?"), grepe implementações irmãs e
   compare — uma pode ter o bug que a outra já resolveu.
3. **Confrontar o comportamento com o comentário da própria função.**
   Quando um comentário documenta um "mapa de estados", percorra CADA
   estado e confirme no código — um estado esquecido na condicional é o
   tipo de bug mais fácil de nunca aparecer em teste manual.
4. **Pegadinhas de JS em checagem de vazio/falsy.** `[]`/`{}` são
   truthy; `0`/`''`/`NaN` são falsy mas podem ser dado válido. Qualquer
   `if(!campo)` decidindo "vazio vs. preenchido" merece essa checagem.
5. **Rastrear recursão/cascata por ciclo e profundidade.** Confirme que
   proteção contra ciclo/profundidade documentada existe no CÓDIGO, não
   só bloqueada na UI (dado corrompido pode chegar por outro caminho —
   Firebase direto, corrida entre abas).
6. **Código morto / nunca chamado.** `grep -nac "nomeDaFuncao("` = 1 (só
   a declaração) é sinal de refactor incompleto. Reporte, não delete sem
   confirmar.

## Passo 3 — Classificar antes de corrigir

- **Bug claro, sem ambiguidade**: corrige direto, sem perguntar.
- **Ambíguo / decisão de produto**: pergunta antes de implementar.
- Nunca refatore/redesenhe além do necessário pra corrigir o achado
  específico — ver "O que esta rotina NÃO é" acima.

## Passo 4 — Reportar achados

Pra cada achado: arquivo + função/linha, o cenário concreto que expõe o
bug (input/estado → resultado errado), e a severidade. **Apresente a
lista antes de sair corrigindo tudo**, a menos que o pedido original já
tenha sido "corrige tudo que achar".

## Passo 5 — Corrigir + checks de rotina + release

1. Corrige só no arquivo `-dev`/de teste da área tocada (nunca
   `kanban.html` direto — "Release process" do `CLAUDE.md`).
2. `node --check` no maior bloco `<script>` + balanço de chaves/
   parênteses contra o baseline conhecido da sessão.
3. Função/helper novo → confere se o `CODE_MAP.md` precisa de anchor
   novo (mesmo commit, ou `/atualizarcodemap` depois).
4. Bump de versão + entrada em `CHANGELOG.md` com o cenário concreto do
   bug — não só "corrige inconsistência".
5. Commit → rebase em `origin/main` → push → PR (nunca self-merge sem
   checar CI).
6. Promoção pra prod é etapa separada (`/subirproprod`), só depois de
   validação explícita.

## Passo 6 — Sempre entregar um teste de console em português

**Regra fixa, todo pedido**: ao final de CADA rodada, entregue um script
pronto pra colar no console (`kanban-dev.html`, DevTools → Console) —
em português, testando cada achado corrigido.

Regras pro script:
- **Chame as funções DE VERDADE da página**, nunca uma reimplementação —
  senão o teste valida a cópia, não o arquivo real.
- `kanban-dev.html`/`kanban.html` são `<script>` clássico: `function
  nome(){}` de nível superior vira `window.nome` sozinha. `let`/`const`
  de nível superior fica só no escopo do script, mas o console avalia no
  MESMO escopo — reatribua com `_var = 'x'`, nunca `window._var = 'x'`
  (propriedade solta que o app nunca lê) nem `let _var = 'x'`
  (redeclaração, erro ou no-op).
- **Nunca crie elemento DOM com o MESMO id de um já existente na
  página** (`document.getElementById()` acha o real primeiro, teste lê/
  escreve numa cópia solta).
- **Guarde resultados numa variável que sobrevive fora do script**
  (`window._resultadosTeste = linhas`, não só `let` dentro de uma IIFE).
- Entregue o script COMPLETO e visível na resposta — nunca só um
  caminho de arquivo salvo em disco.
- `console.table(linhas)` no final, nome do teste + ✅/❌ + detalhe.

## Histórico de achados (não repetir análise já feita)

Formato: data — área — achados reais (gist) — versão/PR. Áreas
"sem achados" ficam registradas só quando relevante evitar reanálise.

- **2026-08-21, Supercards (origem)**: 4 bugs — visibilidade do 2º
  nível contradizia comentário; fan-out por Automação não propagava
  Ficha Técnica; `!crv[k]` não pegava array vazio; supercard concluía
  sozinho com filhos cancelados. PR #466/#467.
- **2026-08-26, Automações (`assigned`/`move`)**: 2 bugs — não
  disparavam via modal (Salvar/autosave), só arrastar/atalho. PR
  #533/#534.
- **2026-08-26, card hotline + Campanhas**: 2 bugs no hotline (métricas
  do board não excluíam; aparecia em 3 buscas de card) — Campanhas sem
  achado. dev v8.30.487.
- **2026-08-27, Automações bulk + `_duplicarComFilhos()`**: 5 bugs —
  bulk move/block/tag nunca disparavam Automação; duplicar sem achado
  (decisão já registrada em comentário). dev v8.30.488.
- **2026-08-27, coluna de impedimento**: 3 bugs — recorrente/agendado/
  edição de QL gravavam `col` sem revalidar se ainda existe. dev
  v8.30.489.
- **2026-08-27, Agente Ágil (Histórico + Intake)**: 2 bugs —
  `autonomous` binário não cobria origem "especialista"; tag de
  Submarca pré-marcada sem checar feature ligada. dev v8.30.493.
- **2026-08-29, Agentes Externos (painel)**: 1 bug — merge a partir de
  cache local em vez de ler fresco (perda em corrida). dev v3.02·painel-dev.
- **2026-08-29, Automações — `saveCard()` criação**: 3 bugs —
  `cover_set`/`padrao_set`/`tag_added` não disparavam no branch de
  criação. dev v8.30.502.
- **2026-08-29, Automações × orquestrador (arquitetural)**: mutação real
  do orquestrador nunca disparava Automação — fila `agente_pending_auto`
  + `_claimPendingAuto()`. 8 testes novos. dev v8.30.503.
- **2026-08-29, Padrões de card**: 1 bug — só 1 de 5 funções atualizava
  card já aberto. dev v8.30.504.
- **2026-08-30, Notificações in-app**: 1 bug — @menção em checklist só
  notificava via Salvar manual, não autosave. dev v8.30.505.
- **2026-08-30, Notas**: sem achados.
- **2026-08-30, `saveCard()`**: 1 bug severo — trava de reentrância
  armada antes de confirmar que o card ainda existe; card sumido
  travava Salvar pra SEMPRE. dev v8.30.506.
- **2026-08-30, processos de criar card**: 1 bug — Agendamentos nunca
  ganhou trigger `_created` equivalente a Recorrentes. dev v8.30.507.
- **2026-09-01, Agente Ágil owner/participant + resync periódico**: sem
  achados no cluster owner; 1 bug severo no resync (pulava card sem
  posição resolvida, ficava invisível a sessão toda). dev v8.30.517.
- **2026-09-01, duplicação**: 1 bug — `bulkDuplicate()` não resetava
  `childCardIds`/`pinned`. dev v8.30.522.
- **2026-09-01, pontos críticos (comentários/checklist/tags/desc/acesso)**:
  3 bugs em Acesso — 3 telas com checagem de papel na mão em vez de
  `_isPOorOrg()`. Resto sem achados. dev v8.30.523.
- **2026-09-01, indicador "🤖 pensando..."**: 3 bugs — hotline preso
  120s; indicador reaparecia em conversa já respondida; `notify_all`
  excluía o próprio autor sem sentido. dev v8.30.527.
- **2026-09-01, aba Agentes (painel)**: 1 bug — link "abrir card" sem
  fallback quando o card sumiu (mesmo gap em `openNotif()`). dev v8.30.536.
- **2026-09-01, Agentes Externos CRUD (2ª rodada)**: 2 bugs — erro
  silencioso ao editar registro sumido + cache fantasma; listener
  reconstruía a lista inteira destruindo form aberto. dev v3.07·painel-dev.
- **2026-09-01, pin do card**: 1 bug — sem fallback pra toque/teclado,
  adicionado ao menu de contexto. dev v8.30.537.
- **2026-09-02, redesenho mobile + card lock**: mobile sem achado; 1 bug
  no lock — card hotline herdava lock exclusivo de 1 pessoa. dev v8.30.543.
- **2026-09-02, multiselects**: 1 bug — bulk tag picker permitia 2 tags
  do mesmo grupo (tamanho/submarca) ao mesmo tempo. dev v8.30.545.
- **2026-09-02, campanhas/coleções**: 1 bug — `_filterCards()` não usava
  `getCardTags()`, badge da lista e do detalhe divergiam. dev v8.30.546.
- **2026-09-02, funções de card (Arquivados/Cards antigos/QL)**: 1 bug
  (3 lugares) — selo de tag lia campo legado. dev v8.30.547. (Achado de
  passagem, fora do escopo: mesmo padrão em `openSearch()`.)
- **2026-09-02, supercards (revisita)**: 1 bug — cascata de
  auto-conclusão sem proteção contra ciclo corrompido nos dados. dev
  v8.30.548.
- **2026-09-02, capa do card**: 2 bugs — `setCardCoverImage()` não
  disparava Automação; ação `set_cover` não limpava a imagem. dev
  v8.30.554.
- **2026-09-03, card sumido / QL temp**: 6 caminhos irmãos do mesmo gap
  — guard movido pras 3 primitivas de escrita (`fbSaveCard`/
  `fbCreateCard`/`fbSaveAll`). dev v8.30.561.
- **2026-09-03, dependências entre cards**: 2 bugs — exclusão de
  descendentes nunca implementada (ciclo fechável de verdade); badge
  "pai atual" comparava campo errado (`parentId`, de Nota). dev v8.30.563.
- **2026-09-03, modal do card (navegação)**: 1 bug — pilha de "← Voltar"
  mutada antes do gate assíncrono cancelável de fechar. dev v8.30.564.
- **2026-09-03, modal do card (lock, 2ª rodada)**: 1 bug — card
  `_isQLTemp` também vazava lock fantasma. dev v8.30.565.
- **2026-09-03, agente ágil orquestrador**: 1 bug — ferramenta de
  notificar especialista não checava o toggle por squad que o gatilho
  determinístico gêmeo já checava. Suíte 284/284.
- **2026-09-04, Timeline**: 3 bugs — `doneAt` só olhava 1ª coluna de
  fim; Feed perdia marco quando prioridade era removida; collapse não
  guardava estado aberto. dev v8.30.581, PR #723.
- **2026-09-04, Relatório de Tempo/CFD/Throughput (2ª rodada)**: achado
  grande — 9 funções reimplementavam `col==='done'` em vez de
  `_isColDone()`; 2 liam `c.doneAt` (campo que nunca existiu). dev v8.30.582.
- **2026-09-04, CFD/Burndown (3ª rodada)**: 1 bug (2 ocorrências) — sem
  fallback pra `createdAt` ausente, sumia dos gráficos. dev v8.30.585.
  Pedido do usuário virou o Passo 6 (sempre entregar teste de console).
- **2026-09-05, OKR — chat do Agente Ágil**: 1 bug — edição via chat
  nunca notificava o Responsável do Objetivo (só a edição manual
  disparava). PR #756, suíte 468/468.
- **2026-09-06, OKR bloco quinzenal (rodada 1) + todas as notificações
  (rodada 2, pedido explícito "faz um /monitorarbugs em todas
  notificações")**: 6 achados reais, todos mesma classe — clicar numa
  notificação não navegava a lugar nenhum, porque só `cardId`/`intake`
  tinham tratamento em `openNotif()`. PR #763: (1) 4 tipos `okr_*`
  sem navegação → redirecionam pra `painel(-dev).html?okr=<id>`; (2)
  `_okrBlocoNaData()` código morto removida + `Math.floor`→`Math.round`;
  (3) **mais severo** — sino PRÓPRIO do painel (`renderPainelNotifs()`,
  nunca auditado antes, UI separada do sino do kanban) tinha `n.link`
  descartado no mapeamento de `loadPainelNotifs()` — "rascunho
  aguardando revisão" nunca navegou desde que a feature existe, apesar
  do código já prometer isso (comentário + toast); (4) "🎥 Reunião em X
  min" não abria o link (só a notificação nativa abria) —
  `createNotif()` ganhou parâmetro `extra` opcional; (5) "📅 agenda
  pendente" não processava a fila ao clicar; (6) feedback do Mural pro
  ADM não navegava — novo deep-link genérico `?tab=<id>`
  (`_painelTryOpenTabFromUrl()`, complementar ao `?okr=<id>`). Achado
  incidental documentado, não corrigido: `_restoreTab()` também é
  código morto (painel sempre abre na aba Visão). PR #764: promoção
  isolada do achado 3 pra prod (só 1 linha, resto do lote de dev ainda
  não validado). Suíte de backend 475/475, 21 cenários Playwright.
  **Lição pra próxima vez**: antes de assumir "não existe X", grep pelo
  NOME GENÉRICO do conceito (`notif`, `link`) em vez de só pelos nomes
  já conhecidos de uma tela (`openNotif`/`NOTIF_ICONS` são do kanban;
  o painel tem seu próprio `loadPainelNotifs`/`renderPainelNotifs`,
  quase invisível na 1ª rodada por causa disso).
- **2026-09-06, avisos do Mural (pedido explícito, escopo nomeado)**: 2
  achados. PR #766: (1) **severo** — comunicado "Insistente (reaparece
  até expirar)" reabria sozinho ~400ms depois de dispensado, em loop,
  pelo resto da sessão — `dismissComunicado()` reagenda
  `_talvezMostrarComunicado()` em 400ms pra checar a fila, e o próprio
  insistente sempre contava como "pendente" de novo mesmo recém-fechado
  (`#comunicado-ov` só fecha via `dismissComunicado()`, sem
  clique-fora — sem saída pra quem fosse atingido). Achado via técnica
  3 (o que a opção promete na tela — "até EXPIRAR" — vs. o que o código
  fazia — reabre 400ms depois de fechar). Fix: `_comunicadoDismissedSession`
  (`Set` em memória, reseta a cada load de página) guarda ids
  dispensados NA SESSÃO; (2) menor — `_ccTogglePrioridadeUI()`
  desmarcava o checkbox Insistente ao trocar pra mural sem restaurar ao
  voltar pra popup, perdendo o valor original em silêncio — corrigido
  pra só desabilitar. 8 cenários Playwright.
- **2026-09-06, históricos (pedido explícito, escopo nomeado)**: 1
  achado, comparando os 2 sistemas de histórico paralelos do repo
  (card no kanban-dev.html vs. OKR no painel-dev.html, este último
  documentado no `CODE_MAP.md` como "porta" de propósito do primeiro).
  PR #768: `_okrArquivarMarco()` não registrava NENHUM histórico — nem
  no próprio Marco, nem o resumo no Objetivo pai que `saveOkrMarco()`
  sempre empurra em toda outra edição — diferente de
  `_okrArquivarObjetivo()`, que já grava `"arquivou o Objetivo"`.
  Achado via técnica 2 (comparar contra `_okrArquivarObjetivo()`/
  `saveOkrMarco()` no mesmo arquivo), confirmado com o usuário antes de
  implementar. Checado e sem achado: formato do Agente Ágil server-side
  (`pushHistory()`) bate exatamente com o do cliente. Achado incidental
  documentado, não corrigido (decisão do usuário — escopo menor):
  arquivar Marco continua irreversível pela UI, sem
  `_okrDesarquivarMarco()`/tela "Ver arquivados" pra Marcos (diferente
  de Objetivo, que tem os dois). 5 cenários Playwright.
- **2026-09-06, histórico de cards (pedido explícito, escopo nomeado)**:
  1 achado, mapeando os ~50 call sites de `recordHistory()`/
  `_histDiff()` no arquivo. PR #770: `_histDiff()` só rastreava
  `card.tag` (campo legado, 1ª tag do array — mantido só por
  compatibilidade), nunca `card.tags[]` inteiro — adicionar uma 2ª/3ª
  tag ou remover uma tag que não fosse a 1ª nunca gerava entrada de
  histórico, nem via autosave nem via Salvar manual (os 2 caminhos mais
  comuns de edição, ambos chamando a mesma `_histDiff()`). Ações em
  massa nunca tiveram o bug, porque já chamavam `recordHistory()` com
  mensagem própria, sem depender do diff genérico. Achado via técnica 4
  (campo "proxy" tratado como se refletisse o array inteiro, quando só
  reflete o 1º elemento). Fix: diff dedicado Set-based pra `tags[]`,
  fora do loop genérico de `HIST_FIELDS`. 4 cenários Playwright.
- **2026-09-06, ⏱️ tempo em atraso/bloqueado (pedido explícito, "nessas
  áreas implementadas hj")**: 1 achado, mapeando todos os call sites de
  `recordMove()`/`_settleBlockedTag()`/`card.blocker=`. `ctxMove()`
  (menu de contexto — submenu "↦ Mover para" e `ctxBlock()`) era o
  ÚNICO caminho de movimentação que nunca chamava `recordMove()` —
  `handleDrop()`/`_doBulkMove()`/`saveCard()` sempre chamavam. Gap
  PRÉ-EXISTENTE (não introduzido pela feature do dia), só ficou visível
  porque a feature nova depende de `recordMove()` rodar em toda
  movimentação — deixava cycle/lead time, CFD, Timeline e Throughput
  cegos pra esse caminho, o auto-desimpedimento não disparava, e a rede
  de segurança do tempo em atraso/bloqueado ficava sem cobertura. Fix:
  `recordMove(card, colId)` adicionado, mesmo padrão de
  `_doBulkMove()`. PR #776 (mesmo PR da feature, ainda não mergeado).
- **2026-09-06, 📜 Histórico do card visual rico (pedido genérico, "nas
  construções de hj" — área escolhida por ser a mais recente ainda não
  auditada)**: 2 achados, mapeando todos os ~50 call sites de
  `recordHistory()` e testando 48 padrões de texto contra
  `_histAvatarHtml()`/`_histTipo()`. PR #778: (1) `_applyFanoutTemplate()`
  (fan-out manual "🧩 Aplicar receita" E automação) passava o nome de
  uma pessoa real como `whoOverride` pro `recordHistory()` — mas
  `whoOverride` truthy é o próprio sinal que zera `init` (sem avatar
  com foto), documentado pra Automação/Agente Ágil/Supercard "que não
  têm pessoa nenhuma". Aplicar receita na mão sempre mostrava iniciais
  genéricas, nunca a foto de quem fez. Fix: só passa o override quando
  o ator é o robô; pra pessoa real, omite e deixa o default (mesmo
  texto + `init` certo); (2) **mais severo, técnica 3** — "impedimento
  removido automaticamente" (auto-desbloqueio em `recordMove()`) caía
  no grupo `impedido` (🚧 vermelho) só por compartilhar a palavra com
  "marcou como impedido" — ícone de BLOQUEIO pro evento oposto
  (desbloqueio), contradizendo o comentário da própria chamada
  ("indistinguível de uma remoção manual"). Achado incidental corrigido
  junto (mesma causa raiz): 10 frases de recorrência/agendamento/
  arquivamento automático/reatribuição de responsável/ações de
  Automação sem regex próprio, caindo no ícone genérico ✏️.
- **2026-09-06, OKR — vínculo de cards (pedido genérico, "roda mais um
  /monitorarbugs" — área escolhida por ser explicitamente modelada num
  padrão já existente e nunca ter tido rodada própria)**: 1 achado, 4
  call sites. PR #779. `_okrCardSearchResults()`, `renderOKR()`
  (lista "🎯 Cards do board com badge OKR"), o agregador "OKR por
  coluna" dos Insights, e o badge dentro de `openPcModal()` (o modal
  que "🔗 Cards vinculados" abre) detectavam "card é OKR" olhando só
  `card.tag` (1ª tag, campo legado), nunca `card.tags[]` inteiro —
  mesma classe de bug do PR #770 (`_histDiff()`, kanban-dev.html),
  copiada 4 vezes em painel-dev.html. Achado via técnica 2 (comparado
  contra `getCardTags()`/`isOKR_` do kanban-dev.html, a fonte de
  verdade — o próprio comentário do código já dizia "mesmo padrão de
  notaSearchCards()/notaAddCardLink() do kanban-dev.html", mas o
  padrão copiado usava a versão ANTIGA/legada da checagem de tag).
  Fix: os 4 usam `_pGetCardTags()` (helper que já existia em
  painel-dev.html, equivalente ao `getCardTags()` do kanban). 7 casos
  testados isoladamente contra a lógica de detecção.
- **2026-09-07, Feed de marcos do painel (pedido genérico, "roda um
  /monitorarbugs geral" — área escolhida por ter várias iterações de
  feature desde 2026-09-03 sem nunca ter tido rodada própria, e por ser
  explicitamente portada do Feed de marcos do kanban)**: 1 achado,
  comparando `_ptMarcosNoPeriodo()`/`_ptFeedRow()`/`_ptFeedFilter`
  ponto a ponto contra `_marcosNoPeriodo()`/`_timelineFeedRow()`/
  `_timelineFeedFilter` (kanban-dev.html, o original de que foi
  portado). `renderPainelTimeline()` já tinha uma proteção documentada
  (reseta filtro de responsável/tag se a opção some ao trocar de
  squad/gerência — comentário dela cita literalmente "o Feed de marcos
  do kanban.html" como precedente) e o Feed do painel já tinha essa
  mesma cautela pra troca de PERÍODO — só faltava pra troca de SQUAD
  dentro do próprio filtro do Feed, deixando `f.owner`/`f.tagLabel`
  presos num valor morto da squad anterior, zerando a lista sem
  nenhuma pista visual do motivo. Achado via técnica 2. Fix: mesmo
  check de 2 linhas em `_renderPtFeed()`. Checado e sem achado:
  classificação de tipo idêntica nos dois arquivos (incluindo o fix de
  "removeu prioridade" de 2026-09-04, já portado); `col==='done'` no
  painel é simplificação já documentada, não bug; ausência de badge de
  supercard no Feed do painel é consistente com o resto do arquivo
  (conceito não existe em painel-dev.html em lugar nenhum).
- **2026-09-07, implementações do dia — Atalhos de teclado/Esc fecha
  tela/Reorganizar barra (pedido explícito, "roda um /monitorarbugs
  nessas implementações" — ANTES de promover pro prod)**: 3 achados,
  auditando o próprio código escrito nesta sessão. Mapeados TODOS os
  handlers de `Escape` do arquivo (técnica 1) e confrontado o
  comportamento contra as promessas de design das features novas
  (técnica 3). (1) a 1ª leva de `stopPropagation()` (feita junto com o
  "Esc fecha tela") cobriu só os handlers já conhecidos, esquecendo 6
  DENTRO do `card-ov` (Descrição, anexo, busca de Notas, busca de
  Supercard, comentário novo, comentário em edição) — cancelar
  qualquer um deles com Esc fechava o card inteiro; (2) o modo "🔀
  Reorganizar barra" nunca ganhou o bloqueador de clique que o próprio
  desenho combinado com o usuário prometia — clique rápido sem
  arrastar abria o painel do botão no meio da reorganização; (3) Esc
  não cancelava o modo de reorganizar, inconsistente com a PRÓPRIA
  feature de Esc lançada no mesmo lote. **Lição pra próxima vez**: ao
  adicionar um handler global novo que interage com padrões já
  espalhados pelo arquivo (aqui, Esc), grep pelo evento/tecla INTEIRO
  (`key==='Escape'`) antes de assumir que já mapeou todos os pontos de
  contato — não só os que a memória da sessão lembra de ter tocado.
- **2026-09-07, Visualizador externo do painel (pedido genérico, "/monitorarbugs"
  sem escopo — área escolhida por prioridade 2: nunca teve rodada
  própria, e é a única seção do `CODE_MAP.md` explicitamente
  security-adjacent (acesso de convidado fora de `@ciahering.com.br`)
  ainda sem auditoria)**: **sem achados**, depois de investigação real
  (técnica 1 — mapeados TODOS os `function open*` de `painel-dev.html`,
  17 no total, comparando os 8 que já têm `_blockIfPainelViewer()`
  contra os 9 que não têm). Quase-achado que NÃO se confirmou, vale
  registrar pra não reabrir a mesma linha de investigação: `openOkrObjetivo()`/
  `openOkrMarco()` (e as escritas `saveOkrObjetivo()`/`saveOkrMarco()`/
  arquivar/desarquivar/excluir) não têm o guard `_blockIfPainelViewer()`
  que os outros 8 (`openCfg`, `openCampEdit`, `openPainelCampMsEdit`,
  `openPevModal`, `openComunicadoCompose`, `openGlobalUsersModal`,
  `openBoardSetup`, `openGlobalBackup`) têm — mas isso não é um gap de
  verdade: o formulário editável do OKR só renderiza quando
  `_okrCanEdit(obj)`/`_okrCanCreate()` (`isAdmUser()` ou
  `obj.responsaveis.includes(uid)`) é `true`, e um visualizador externo
  nunca aparece em `_okrPessoaOptions()` (fonte dos "responsáveis"
  selecionáveis — filtra por `inscrito`/`squads`/`role==='adm'`, nenhum
  dos quais um convidado tem) nem em `ADM_EMAILS`. Ou seja, o gate do
  OKR é role-based (por objetivo) em vez de flag-based
  (`_isPainelViewer`), mas já exclui o visualizador na prática — os 2
  mecanismos coexistem sem lacuna real. Resto do arquivo checado e
  também sem achado: os 9 `open*` restantes sem o guard são views
  puramente de leitura (`openCampLogs`, `openCampDetalhe`,
  `openCampCardsGrid`, `openPcModal`, `openPcalDayPopover`,
  `openAgentesHelp`, `openOkrHelp`, `openPainelHistorico`) ou já caem
  atrás de outro gate próprio (`_isAdmPainel()`/`isAdmUser()`, usado em
  ~25 pontos espalhados pelo arquivo pra ações admin-only, todos
  conferidos consistentes). `painel.html`/`painel-dev.html` batem 1:1
  nos 8 pontos guardados (mesmas funções, sem divergência introduzida
  por edições recentes). Limitação já conhecida e documentada no
  `CODE_MAP.md` (não é achado novo): `openPevModal` sempre abre editável
  mesmo só pra ver um evento existente.
- **2026-09-07, board_prefs (pedido genérico — área mais recentemente
  alterada, lote de 5 rodadas + 3 fixes + brilho neon, nunca tinha tido
  rodada própria)**: 1 achado. PR #809. `toggleSubmarcaDropdownItem()`,
  `setSubmarcaDropdownTodos()` e `setSubmarcaFromDrawer()` mudavam
  `activeFilters.submarca` (que `_hasActiveFilters()` já considera
  filtro ativo) sem chamar `_applyFiltrosBtnUI()` — o fix do PR #800
  cobriu `applyFilters()`/`clearFilters()`/`applyFilterPreset()`, mas
  esqueceu esses 3 pontos que mudam o mesmo estado por fora. Filtrar só
  por submarca escondia a maioria dos cards sem o botão "🔭 Filtros"
  acender. Achado via técnica 1 (grep em todos os call sites de
  `_applyFiltrosBtnUI()`). Checado e sem achado: raia/colunas
  colapsadas/col_sort/view_mode/densidade/squad padrão (único ponto de
  mutação cada); presets de filtro.
- **2026-09-07, CFD — crosshair/tooltip do hover (pedido genérico — área
  mais recentemente alterada, feature nova do mesmo dia, PR #808)**:
  **sem achados**. Investigado `_renderCFD()`/`_cfdHover()`/
  `_cfdHoverOut()`/`window._cfdChartState` de ponta a ponta: guard
  contra divisão por zero (`stepX||1`), índice sempre clampado dentro
  de `dias.length`, `getScreenCTM()`/`createSVGPoint()` cobre a
  transformação de coordenada tanto pra dentro (posição do hover)
  quanto pra fora (posição da tooltip) sem depender de cálculo manual
  de escala, `pointer-events:none` na linha/marcadores evita que eles
  interceptem o próprio `mousemove` do SVG, tooltip clampada nos 2
  lados. `_bdToggleCol()` (achado real de rodadas anteriores, único
  ponto de mutação de `_bdHiddenCols`) já re-renderiza Fluxo/Insights/
  Visão Geral de forma consistente quando cada uma está visível — sem
  divergência entre os 3. Limitação conhecida, não é bug: hover não
  tem equivalente por toque (mobile), fora de escopo de correção de
  comportamento (seria feature nova, não um "errado/inconsistente").
- **2026-09-07, filtros do board (pedido explícito, escopo nomeado)**: 1
  achado. `applyFilterPreset()` nunca sincronizava `<select
  id="f-submarca">` (campo de Submarca do painel de Filtros) com o
  preset aplicado — os outros 3 pontos que mudam
  `activeFilters.submarca` (`clearFilters()`,
  `toggleSubmarcaDropdownItem()`, `setSubmarcaFromDrawer()`) sempre
  sincronizavam. O filtro por baixo aplicava certo; só o campo do
  drawer ficava com o valor de uma seleção manual anterior. Achado via
  técnica 1. Checado e sem achado: os 13 campos de
  `FILTER_PRESET_CAMPOS` batem exatamente com `_hasActiveFilters()` e
  `passesFilter()`, nenhum campo esquecido em nenhuma das 3 listas.
- **2026-09-07, salvar card (pedido explícito, escopo nomeado)**: 1
  achado real + 1 código morto. Comparando `saveCard()` (manual) com
  `scheduleAutoSave()` campo a campo (técnica 1): `executorType`/
  `agentStatus` disparavam autosave (`onchange="scheduleAutoSave()"`
  nos `<select>` correspondentes) mas nunca eram persistidos por ele —
  só `saveCard()` gravava os 2. Trocar o dropdown sem clicar Salvar (ou
  sem usar um dos 3 botões de simulação do agente, que já commitam
  sozinhos) mostrava "✓ Salvo" mas a mudança se perdia; `_manualFieldsNow()`
  também não cobria os 2 campos, então nem o aviso de "não salvo"
  disparava. Fix: mesmo padrão da correção anterior de `blockerReason`.
  Achado incidental, não corrigido (código morto, decisão de produto):
  todo o mecanismo antigo `editingLinkedCards`/`addLinkedCard()`/
  `searchLinkedCards()` depende de elementos que não existem no HTML
  estático — `searchLinkedCards(` só aparece 1x no arquivo (técnica 6).
- **2026-09-07, `openCard()` (pedido explícito, escopo nomeado)**: 1
  achado. `addBlockerTag(cardId)` (atalho "🚧 Marcar impedimento" do
  menu de contexto) chama `openCard(cardId)` e agenda seu próprio
  `setTimeout(...,100)` de acompanhamento sem o guard de corrida
  `editingId !== cardId` que o `setTimeout` INTERNO do próprio
  `openCard()` já tem (e documenta o motivo: card antigo vazando pro
  formulário do card novo se a pessoa abrir outro card dentro da
  janela). Achado via técnica 3 (comparar contra o guard já resolvido
  no mesmo arquivo). Fix: mesmo guard adicionado. Checado e sem achado:
  os ~40 outros call sites de `openCard()` não agendam setTimeout
  próprio; cross-check campo a campo write→read entre
  `saveCard()`/`scheduleAutoSave()` e o que `openCard()` lê de volta —
  sem gap.
- **2026-09-07, autosave (pedido explícito, escopo nomeado)**: 1 achado.
  Dos 3 caminhos que levam um checklist a 100% (autosave, botão
  "💾 Salvar", e "▶ Avançar etapa" da simulação client-side do Agente
  Ágil), só a simulação nunca disparava `notifChecklistDone()`/
  `runAutoRules('checklist_complete', ...)` — `_agentAdvanceStep()`
  detecta a transição pra "checklist zerado" (`remaining===0`) mas nunca
  chamava os 2. Achado via técnica 1. Fix: mesma chamada adicionada no
  ponto exato da transição. Checado e sem achado (mecanismo do
  `_autoSaveTimer` em si): sempre limpo antes de escrita concorrente
  (wrapper de `saveCard`); callback do `setTimeout` sempre relê
  `editingId`/`cards.find()` fresco (não usa closure stale, diferente
  do padrão que causou o bug de `addBlockerTag()` da rodada anterior);
  `_saveCardWithRetry()` consistente nos 3 call sites.
- **2026-09-08, Histórico do card (pedido explícito, relato direto de
  usuário — "André... teve mudanças que ele realizou em uns cards e
  que não apareceu ali no histórico")**: 4 achados, comparando
  `HIST_FIELDS`/`_histSnapshot()`/`_histDiff()` contra todos os campos
  que `saveCard()`/`scheduleAutoSave()` de fato gravam (técnica 1 —
  mesma técnica que já achou o gap de `tags[]` no PR #770).
  Participantes, Riscos e Demandante eram persistidos normalmente mas
  nunca tinham diff nenhum (Demandante nem estava no `HIST_FIELDS`,
  diferente de Responsável); motivo do impedimento só virava entrada
  quando o `blocker` booleano mudava, nunca quando só o TEXTO do
  motivo era editado com o impedimento já marcado. Fix: mesma técnica
  Set-based do `tags[]` pra participantes/riscos; `demandante` no
  `HIST_FIELDS` genérico; diff dedicado pro motivo, só quando o
  impedimento continua marcado antes e depois (evita duplicar a
  entrada de marcar/desmarcar). dev v8.30.620.
- **2026-09-09, "Enviar card pra outro squad" (pedido explícito, "tudo
  certo! só por garantia, roda um /monitorarbugs" logo após validar a
  feature na UI — escopo: a própria feature do dia)**: 2 achados +
  1 polish. `_dupOnSquadChange()` desmarcava Responsável/Participantes/
  Comentários ao entrar no modo cross-squad mas nunca remarcava ao
  voltar pra "Este squad" dentro da mesma abertura do modal (técnica 3
  — UI parecia ter voltado ao normal, campos ficavam de fora em
  silêncio). `_dupPopulateSquadSelect()` não atualizava a lista de
  squads como o seletor do header já faz (técnica 2 — squad recém-
  criado no painel ficava invisível como destino). Corrigir o achado 2
  quase introduziu uma regressão nova (preservar seleção durante o
  refresh assíncrono vazava a seleção de squad de uma sessão do modal
  pra outra, reabrir pra um card diferente já vinha com squad
  escolhido) — pego só porque o teste da própria correção cobriu
  "abrir pra um 2º card depois" explicitamente. **Lição pra próxima
  vez**: ao corrigir um achado que envolve estado assíncrono
  preservado entre re-renders, sempre testar o cenário "abre de novo,
  do zero, pra uma entidade diferente" — não só o cenário que o achado
  original descreveu. dev v8.30.624.
- **2026-09-10, campo "🛒 Canal" (pedido genérico, "roda um
  /monitorarbugs aqui" — área escolhida por prioridade 1: código mais
  recente da sessão, criado minutos antes espelhando a Submarca)**: 3
  achados, todos via técnica 2 (comparar ponto a ponto contra o padrão já
  resolvido de Submarca no mesmo arquivo). `swCfgTab('tags')` não
  re-sincronizava os 2 checkboxes de Canal nem chamava
  `renderCanalVendaCfgList()` ao reabrir a aba — único toggle da aba Tags
  sem esse re-sync defensivo que Tamanho/Submarca/Criativos/Padrões já
  têm. `_hasActiveFilters()` não checava `f.canalVenda` — mesma classe de
  bug já corrigida 2x antes pra Submarca (PR #800/#809), filtrar só por
  Canal escondia cards sem o botão "🔭 Filtros" acender. **Mais sério**:
  import do Trello não tinha a "Prioridade 1" de match exato por nome que
  Submarca tem — labels "Amazon"/"Shopee"/"Mercado Livre" caindo no fuzzy
  `includes()` genérico corriam risco real de colar no canal errado por
  substring (ex.: "Amazon" → "Amazon (FBA)"), dependendo só da ordem do
  array. dev v8.30.628. **Lição pra próxima vez**: ao construir um campo
  novo "na mesma pegada" de um já existente, `grep` por TODA referência ao
  nome do campo original (`submarcaAtivo`, `SUBMARCA_TAGS`,
  `f.submarca`) antes de considerar a réplica completa — mesmo depois de
  uma implementação cuidadosa cobrindo ~20 pontos de integração, ainda
  sobraram 3 (2 pequenos + 1 sério) só visíveis fazendo essa varredura
  find-all, não relendo a própria implementação de memória.
- **2026-09-10, 🐛 Monitor do painel (pedido explícito, "roda um
  /monitorarbugs na pagina monitor no painel, incluindo prod" — checagem
  de acompanhamento do próprio fix promovido minutos antes)**: 1 achado
  severo, técnica 2 (comparado contra `loadPresence()`, padrão irmão já
  resolvido no mesmo arquivo desde 2026-08-25). O fix anterior (v3.37)
  pôs `loadErrorLogs()` dentro do `else if(changed)` de
  `loadExtraSquads()` — mas esse branch nunca roda no 1º carregamento da
  página (`if(firstRun)` sempre captura o fluxo primeiro), então squad
  extra que JÁ EXISTIA antes da sessão abrir (o caso mais comum — squad
  criado ontem, board aberto do zero hoje) continuava sem listener de
  erro, mesmo já em prod. `loadPresence()` já evita essa mesma armadilha
  chamando incondicionalmente, fora do if/else — `loadErrorLogs()`
  passou a fazer o mesmo. Validado via Playwright reproduzindo a race de
  verdade (registra listener, chama antes do Firebase responder, só
  depois dispara com o squad já presente) — testado lado a lado contra
  o código da v3.37 pra confirmar que o bug era real antes do fix. dev
  v3.38/prod v3.38. **Lição pra próxima vez**: ao corrigir um bug de
  "código roda 1x só no boot, precisa ser idempotente + rechamado", não
  basta rechamar só no branch de MUDANÇA — checar se existe um caminho
  IRMÃO já resolvido (aqui, `loadPresence()`) e replicar exatamente ONDE
  ele chama, não só COMO.

- **2026-09-11, `functions/` — endpoints HTTP sensíveis (pedido explícito,
  "roda um /monitorarbugs nas areas sensiveis")**: 2 achados reais, os 2
  race conditions, achados via técnica 2 (comparar contra
  `functions/agente-agil/board.js`, que já usa `.transaction()` pro mesmo
  tipo de operação — `board.js` era o padrão irmão já resolvido, os 2
  endpoints HTTP ainda faziam `get()`+`update()`/`set()` sem transação).
  (1) `functions/intake/submit.js` — rate limiter por IP (único freio do
  formulário público sem CAPTCHA) não era atômico: 2 requisições
  concorrentes liam o mesmo `count` antes de escrever, incrementos se
  perdiam, um script conseguia furar o limite de 5/hora por um fator
  arbitrário; (2) `functions/agente-agil/http.js` — idempotência por
  `requestId` (proteção contra retry duplicado do especialista externo)
  tinha o mesmo padrão: `get()` no início, `set()` só no final, deixando
  uma janela onde 2 requisições com o mesmo `requestId` criavam 2 entradas
  pendentes processadas 2x pelo orquestrador. Fix nos 2: `.transaction()`.
  Como `http.js`/`submit.js` não têm teste de handler próprio (só as
  dependências puras — o próprio repo documenta isso como "fica pro
  Firebase Emulator Suite"), validado com um fake db escrito na hora que
  implementa compare-and-swap + retry (semântica real de transaction() do
  Firebase, não a versão simplificada de `fakeDb.js` que não simula
  concorrência de verdade) rodando o CÓDIGO REAL extraído dos 2 arquivos —
  10 requisições concorrentes: código antigo deixava passar 10/10 (rate
  limit) e criava 10 entradas duplicadas (idempotência); código novo trava
  em exatamente 5/10 e cria só 1 entrada. Suíte formal 475/475, sem
  regressão. Requer `firebase deploy --only functions:intakeSubmit` e
  `--only functions:agenteAgil` manuais (resync antes, ver `CLAUDE.md`).
  **Lição pra próxima vez**: "áreas sensíveis" sem escopo nomeado —
  interpretado como qualquer ponto de entrada que aceita escrita de fora
  do fluxo normal de auth do Firebase (aqui: os 2 endpoints HTTP públicos/
  semi-públicos do Agente Ágil). A whitelist de `externos`
  (`_extKey()`/`salvarExterno()`/`removerExterno()`, kanban-dev.html) foi
  auditada na mesma rodada e NÃO teve achado — grant/revoke simétricos,
  `removerMembro()` já limpa a entrada de externos junto; o cap de 8 replaces
  em `database.rules.json` pra sanitizar `.`→`,` (linguagem de regras do
  Firebase não tem regex/replace global) é limitação conhecida e aceita,
  não um bug novo.

- **2026-09-11, implementações recentes: "Próximo objetivo"/quebra de texto
  do Marco (okr-apresentacao.slide.html, #841) + exclusão da coluna
  "Impedimentos" vazia (kanban-dev.html, #840) (pedido genérico, "roda
  outro nas implementações recentes" — as 2 áreas de código mais
  recentemente alteradas em kanban-dev.html/painel-dev.html/
  okr-apresentacao.slide.html ainda sem rodada própria)**: **sem achados**
  nas 2, depois de investigação real (não superficial). (1) `_okrGerenciaObjetivos()`/botão
  "Próximo →": confirmado que o filtro+sort bate EXATAMENTE com
  `buildSlides()` (mesma ordem que a pessoa já viu na grade, conforme o
  comentário promete — técnica 3); confirmado que `_okrOpenDetail()` só é
  alcançável com objetivos não-arquivados nos 2 call sites (clique no
  card e o próprio botão "Próximo", ambos vindos de listas já
  filtradas) — o branch "desabilitado" nunca dispara incorretamente pra
  um objetivo arquivado; confirmado que `_zoomFitToHeight()` mede
  `scrollHeight` (não `clientHeight`) a `zoom:1`, então a promessa do
  comentário ("o encolhimento automático já cobre o texto quebrando em
  mais linhas") é real, não só alegada. (2) `delColumn()`: confirmado
  que os 3 guards irmãos que o comentário cita
  (`saveBlockerMode()`/`_doBulkBlockCol()`/`ctxMove()`) TODOS recusam de
  fato mover/reativar cards pra uma coluna `'blocker'` inexistente
  (técnica 3, comentário vs. código real, não assumido). Achado
  incidental que NÃO virou bug: `parseTrelloJSON()` (import) tem um 4º
  caminho que também toca `col:'blocker'`, não citado no comentário do
  fix — mas tem sua PRÓPRIA proteção independente (fallback pra
  `columns[0]` quando a coluna não existe), então continua seguro mesmo
  sem estar na lista dos "3 guards"; só a enumeração do comentário ficou
  incompleta, o comportamento não.

- **2026-09-11, boot/auth-change (pedido explícito, relato direto do
  usuário: "aquele lance do board abrir pós login todo em branco ainda ta
  rolando... tem q dar um f5 pros cards aparecerem")**: 1 achado severo,
  em 5 lugares. `fbLoadAll()`/`loadNotifs()`/`checkOverdueBackup()`/
  lembrete do sino/`_initComunicados()` esperavam o login via
  `addEventListener('auth-change', e=>{if(e.detail){...}}, {once:true})`
  — mas `{once:true}` remove o listener no PRIMEIRO disparo do evento,
  não no primeiro disparo VERDADEIRO. `onAuthStateChanged` dispara
  `auth-change` assim que registrado (quase sempre com `null`, ninguém
  logado ainda) e de novo quando o login popup termina — o `null` sozinho
  já consumia o listener `{once:true}`, o disparo real nunca tinha mais
  ninguém escutando. Achado via técnica 3 (confrontar o comportamento
  contra o que um comentário JÁ existente promete — havia um comentário
  documentando um fix anterior pra esse MESMO sintoma, que resolvia uma
  race diferente mas reintroduzia esta um nível abaixo) + técnica 1
  (grep por todo `auth-change`, achando os outros 4 call sites com o
  MESMO padrão frágil, não só o dos cards). Fix: `_onRealAuthChange(fn)`
  nova (mesmo espírito de `_onFbReady()`), espera o primeiro disparo com
  `detail` truthy, ignora `null`. Validado via Playwright rodando a
  função REAL extraída do arquivo, simulando o disparo duplo exato
  (null→real): código antigo nunca chamava o callback; código novo
  chama certo. dev v8.30.629. **Lição pra próxima vez**: um comentário
  dizendo "já corrigido" não é prova de que o sintoma sumiu de verdade —
  vale reler o fix documentado linha a linha quando o MESMO sintoma for
  relatado de novo, em vez de assumir que é uma causa nova.

Atualize esta seção a cada rodada nova (1-3 linhas: área, achados,
versão/PR) — o objetivo é não reanalisar do zero uma área já varrida,
não preservar a narrativa completa de cada investigação.
