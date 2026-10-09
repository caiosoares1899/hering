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

- **2026-09-11, "comentários que dizem ter resolvido bugs mas há uma
  inconsistência" (pedido explícito, técnica dirigida: "roda um
  monitorarbugs parecido com esse" — logo após o achado do
  `_onRealAuthChange`/`kanban-dev.html`, procurando a MESMA classe de bug
  em outros lugares)**: 1 achado real, via técnica 1 (grep por
  `auth-change` fora de `kanban-dev.html`, comparando contra o padrão
  agora sabido ser quebrado). `painel-dev.html`/`painel.html` têm seu
  próprio `onAuthStateChanged`/`auth-change`, independente do kanban — e
  `checkOverdueGlobalBackup()` (checagem "backup global atrasado?" ao
  abrir o painel) usava o EXATO mesmo padrão frágil
  (`addEventListener('auth-change', e=>{if(e.detail){...}}, {once:true})`)
  corrigido no dia anterior em `kanban-dev.html` — código duplicado
  independentemente em 2 arquivos diferentes, mesma causa raiz, mesmo
  sintoma (o disparo `null` que o Firebase manda antes do login
  interativo terminar consumia o listener `{once:true}`, o disparo real
  nunca tinha mais ninguém escutando). Impacto: o backup semanal
  automático do painel podia silenciosamente parar de disparar por
  semanas. Checado e sem achado: o OUTRO listener de `auth-change` em
  `painel-dev.html` (`_finishPainelLogin`, guarda `_currentUser`/decide
  visualizador externo) é persistente (sem `{once:true}`), correto desde
  sempre; `_seedComunicadoRascunhos()` roda de dentro desse listener
  seguro, não do vulnerável. Fix: mesma `_onRealAuthChange(fn)`, agora
  também em `painel-dev.html`. dev v3.40·painel-dev. **Lição pra próxima
  vez**: um bug de "padrão de código frágil" (não um bug de lógica de
  produto) tende a ter sido copiado em qualquer outro arquivo que
  resolve o MESMO problema de infraestrutura (aqui: esperar o login
  antes de rodar algo) de forma independente — vale grepar o MESMO
  padrão nos arquivos irmãos (`kanban-dev.html`↔`painel-dev.html`) assim
  que uma classe nova de bug é confirmada, não só dentro do arquivo onde
  foi achada.

- **2026-09-11, `_onRealAuthChange`/5 pontos (fix do dia, board branco
  pós-login) + exclusão da coluna "Impedimentos" (#840)**: pedido
  genérico, escopo escolhido por prioridade 1 (código mais recente).
  Sem achado em nenhuma das duas áreas — 2 hipóteses investigadas a
  fundo e descartadas com evidência, não só por inspeção rápida: (1)
  listener de presença em `fbLoadAll()` parecia "registrado tarde
  demais" pra pegar o auth-change real que o disparou — descartado ao
  confirmar que o heartbeat (`setInterval` de 15s, independente do
  listener) é quem de fato garante a própria presença, o listener é só
  bônus pra reconexões; (2) `window.addEventListener('fb-ready',
  _initBackupCfgListener, {once:true})` bare (sem passar por
  `_onFbReady()`) parecia vulnerável à mesma classe de bug do
  auth-change — descartado ao confirmar a ordem de execução real
  `<script type="module">` (deferred, roda só depois do documento
  inteiro parseado) vs `<script>` clássico (síncrono, roda primeiro):
  o registro acontece cedo o bastante sempre. Pra Impedimentos: os 3
  guards irmãos que a #840 dependia (`ctxMove`/`ctxBlock`,
  `_doBulkBlockCol`, `saveBlockerMode`) já existiam de rodadas
  anteriores (26-27/08) e seguem corretos; `parseTrelloJSON()` (import)
  também já se autoprotege via fallback pra `columns[0]` quando
  `'blocker'` não resolve. **Lição**: nem toda hipótese promissora
  vira achado — confirmar com leitura da ordem de execução/do
  mecanismo redundante antes de reportar evita falso positivo.

- **2026-09-11, "Dados do Board" — Submarca/Canal por coluna +
  "🤖 Ponto de vista" lendo CFD/Burndown (#0a28d37) + fix do fallback de
  `comunicados` (`window._query`/`_orderByChild`/`_equalTo`, #e7aab50)**:
  pedido genérico, escolhido por prioridade 1 (código mais recente sem
  rodada própria). **Sem achados** em nenhuma das duas áreas, depois de
  investigação real: (1) `_boardDataSmCvPorColuna()`/`_pedirAnaliseBoardInsights()`
  — confirmado que os 3 `activeCards` irmãos (Visão Geral, tabela nova,
  Insights) usam exatamente os mesmos filtros documentados (a diferença
  entre eles — Insights exclui coluna "done", Visão Geral não — é
  intencional, não bug); confirmado via leitura de HTML que
  `#boarddata-cfd`/`#boarddata-burndown` são estáticos (só o PAI tem
  `display:none`, não o próprio elemento), então `_renderCFD()`/
  `_renderBurndown()` sempre acham o elemento mesmo se a aba Fluxo nunca
  foi aberta — a suposição inicial de "DOM lazy, resumo ficaria
  undefined" não se confirmou; (2) a partir do fix real de `comunicados`
  (bare `query()`/`orderByChild()`/`equalTo()` no `<script>` clássico —
  binding de import de módulo ES não atravessa esse limite), grep por
  TODOS os outros nomes importados no módulo (`signInWithPopup`,
  `onAuthStateChanged`, `getMessaging`, `runTransaction`, `onChildAdded`
  etc.) usados bare no restante do arquivo — nenhum achado (o único
  "quase-achado", `set('m-crv-campanha-nome',...)` dentro de
  `setCriativoFields()`, é uma `const set=(id,val)=>...` LOCAL que
  sombra de propósito, sem ambiguidade de escopo). **Lição pra próxima
  vez**: depois de confirmar um bug de "nome importado só existe no
  módulo, chamado bare no script clássico", grepar TODOS os nomes
  daquele `import {...}` (não só o que quebrou) é rápido e já provou
  valer a pena antes (mesma técnica do achado de `auth-change`
  duplicado em `painel-dev.html`) — aqui não achou nada NOVO, mas é
  precisamente o tipo de checagem que só vale a pena fazer, não pular.

- **2026-09-12, "modal do card" (pedido explícito, escopo nomeado —
  comentários: `submitComment()`/`saveEditComment()`/`deleteComment()`/
  reações)**: 1 achado real, técnica 1 (comparar `submitComment()` vs.
  `saveEditComment()`, mesma operação — mencionar alguém num
  comentário). Editar um comentário pra ADICIONAR `@Agente Ágil` ficava
  em silêncio total: `saveEditComment()` já tinha o fix de
  `parseMentions()` (@menção humana), mas nunca ganhou o equivalente
  pro agente — e o gatilho real (`mentionTrigger.js`, backend) é
  `onValueCreated`, nunca dispara em `window._update()` (edição usada
  por `saveEditComment()`), então nem um fix client-side conseguiria
  fazer o agente responder de verdade. Fix aplicado: toast avisando que
  editar não notifica o agente (poste um comentário novo); o fix
  arquitetural de verdade (`onValueWritten` + diff antes/depois em
  `functions/`) documentado como recomendação separada, não
  implementado. dev v8.30.642. Checado e sem achado: permissão de
  editar/excluir (`canEdit`/`canDel`) consistente com o resto do app
  (client-gated, mesmo padrão de outras ações); reações
  (`toggleReaction()`) notificam o autor certo, sem duplicar.

- **2026-09-12, ⏸ Pausar card (pedido genérico, escopo escolhido via
  prioridade 1 — feature recente sem rodada dedicada,
  `git log --oneline -40 -- kanban-dev.html`)**: 1 achado real, técnica
  2 (comparar contra o padrão irmão já resolvido: `blockedMs`/
  `atrasadoMs`, auditado em 2026-09-06). `_cardTempos()` (lead/cycle
  time total do Relatório Tempo por Tag) já descontava
  `_cardPausedMs()` corretamente; `_cardTempoPorColuna()` — o
  detalhamento por coluna do MESMO relatório — não descontava pausa
  nenhuma, deixando os dois números do mesmo card inconsistentes entre
  si e contradizendo a Central de Ajuda. Fix (3 opções apresentadas via
  `AskUserQuestion`, usuário escolheu best-effort): desconta a pausa
  ATIVA agora do último trecho aberto do `flow.log`; pausas passadas já
  encerradas ficam fora (limitação aceita — `card.pausedMs` é soma
  total, não intervalos por coluna; corrigir de verdade exigiria
  schema novo, registrado como recomendação futura, não implementado).
  dev v8.30.643, PR #879.

- **2026-09-12, 🗄 Arquivamento automático por idade (#827) (pedido
  genérico, escopo escolhido via prioridade 1 — feature de 2026-09-08
  sem rodada própria, `git log --oneline -40 -- kanban-dev.html`)**: 1
  achado real, técnica 3 (confrontar comportamento contra a própria
  promessa "checa 1x/dia por navegador"). `maybeAutoArchiveOldCards()`
  gravava a flag "já rodei hoje" (`localStorage`) ANTES de checar
  `cfg.enabled` — como a função roda 3s após todo load do board, ligar a
  regra pela 1ª vez sempre caía num dia já "consumido" pela mesma aba
  (que a pessoa usou pra abrir ⚙ Config e ativar), empurrando o sweep
  pro dia seguinte em silêncio. Fix: checa `enabled` antes de tocar no
  `localStorage`. Checado e sem achado: filtro por coluna nos Arquivados
  (`_renderArquivadosBody()`, lida bem com coluna excluída depois);
  `excludedCols`/config UI consistentes; rótulo "Sem edição há (dias)"
  já é honesto sobre rastrear só edições de campo, não toda atividade
  (comentário não bumpa `editedAt` de propósito, arquitetura separada —
  não é bug). dev v8.30.644, PR #881.

- **2026-09-14, ↺ Desfazer / Ctrl+Z (pedido genérico, "roda mais um
  /monitorarbugs nas principais partes do código" — escolhido por ser um
  mecanismo central usado em ~21 call sites, nunca auditado)**: 2
  achados. PR #882. (1) **severo**, técnica 2 (comparar contra o padrão
  irmão já resolvido no mesmo arquivo — `_notasPushUndo()`/`notasUndo()`
  em Notas, que escreve só o node específico tocado): `doUndo()`
  restaurava o array `cards` INTEIRO via `fbSaveAll()` (reescreve a
  árvore `/cards` completa), sem limite de tempo (pilha guarda até 10
  estados, Ctrl+Z funciona bem depois do toast de 6s sumir) — qualquer
  card criado/editado por OUTRA pessoa depois do `saveUndo()`
  correspondente era apagado/revertido em silêncio. Fix (3 opções via
  `AskUserQuestion`, usuário escolheu "escrita cirúrgica por card"):
  `doUndo()` calcula só os cards que de fato mudam vs. o estado ATUAL ao
  vivo e escreve cada um via `fbSaveCard()` (mesma proteção contra
  pisar em edição concorrente que esse helper já dá em qualquer outro
  lugar do app); risco residual (editar o MESMO card tocado pelo undo,
  no mesmo instante) documentado, não eliminado — undo por card de
  verdade nos ~21 call sites fica como recomendação futura. (2) claro,
  técnica 3 (comportamento vs. o que o label promete): "reordenar
  colunas" (2 call sites) chamava `saveUndo()` depois de mutar
  `columns[]`, mas o snapshot só guardava `cards` — Ctrl+Z mostrava "↩
  Desfeito: reordenar colunas" mas a ordem nunca voltava. Fix: snapshot
  passa a guardar `columns` também. dev v8.30.645.

- **2026-09-14, motor de Automações (`runAutoRules()`/`checkAgingAutomations()`)
  (pedido genérico, "roda mais um /monitorarbugs" — escolhido por ser o
  motor central de Automações, já auditado por partes em várias rodadas
  passadas mas nunca de ponta a ponta)**: 1 achado real, técnica 2
  (comparar contra o padrão irmão já resolvido — `maybeAutoArchiveOldCards()`,
  fix de 2 dias antes). `checkAgingAutomations()` gravava a flag "já rodei
  hoje" (`localStorage`) ANTES de checar se existia regra "aging" ativa —
  mesmo bug do arquivamento automático, mas PIOR: o trigger "aging" só
  dispara no dia EXATO em que um card cruza o limiar de idade (não
  repete depois), então ligar a 1ª regra no mesmo dia em que algum card
  cruzava o limiar perdia esse card PRA SEMPRE, não só adiado. Fix: checa
  a regra ativa antes de tocar no `localStorage`. Checado e sem achado
  (revisão extensa, a maior parte já auditada em rodadas anteriores):
  `runAutoRules()`/`_runAutoRuleAction()` (re-busca o card fresco no
  `setTimeout`, sem race entre regras da mesma execução); todos os 15
  `AUTO_ACTIONS` (`move_card`/`set_cover`/`apply_fanout` já tinham fixes
  documentados de rodadas passadas; `add_tag`/`remove_tag`/
  `set_submarca`/`set_canal_venda`/`set_tamanho` usam `getCardTags()`
  consistentemente); todos os 19 `AUTO_TRIGGERS.matches()`;
  `checkDueNotifs()` (não tem o mesmo bug — devido/atrasado não é
  opt-in via regra, não tem checagem "existe regra?" equivalente antes
  da flag). dev v8.30.646, PR #883.

- **2026-09-14, Timeline (kanban) — collapse dos buckets (feature nova,
  não `/monitorarbugs`, checada de passagem no início da rodada seguinte
  por prioridade 1)**: sem achados — double-click em Hoje/Amanhã se
  resolve sozinho (2 toggles nativos do `<details>` se cancelam), critério
  de "Expandir/Recolher tudo" herdado fielmente do painel, reset de
  scroll ao re-renderizar é característica pré-existente de toda a
  Timeline (não uma regressão nova desta feature).
- **2026-09-14, 🕐 Tema automático (pedido genérico, "roda mais um
  /monitorarbugs" — área escolhida por prioridade 2, nunca tinha rodada
  própria, só o help content tinha sido sincronizado)**: 1 achado real, 4
  call sites, técnica 3 (um valor com 2 origens tratado como se fosse
  1 só). `_currentTheme()==='vice'` é escrito tanto pelo easter egg manual
  🌴 Vice City (`toggleViceCity()`, long-press) quanto pela banda normal
  das 12h-18h do Tema automático (`_applyAutoTheme()`) — os handlers do
  botão de tema (`onThemeBtnClick`/`onThemeBtnDblClick`/
  `_mobileThemeRowClick`/`toggleViceCity`) usavam só isso pra decidir "sai
  do easter egg", então clicar no botão durante a banda automática da
  tarde desligava o automático sem pedir e mostrava um toast confuso de
  "De volta pra...". Fix: `_isViceCityEasterEggAtivo()` — só considera
  easter egg de verdade quando vice + automático DESLIGADO (seguro,
  `toggleViceCity()` sempre desliga o automático ao entrar). dev
  v8.30.648, PR #885.

- **2026-09-14, "Dados do Board" (pedido explícito, escopo nomeado —
  rodada de acompanhamento da auditoria de 2026-09-11, que tinha ficado
  restrita a Submarca/Canal por coluna + CFD/Burndown)**: 1 achado real,
  4 call sites, técnica 3 (comportamento vs. promessa explícita da
  Central de Ajuda). ⏸ Pausar card promete "não conta contra as
  métricas de tempo... NEM APARECE COMO ALARME pro resto do board", mas
  nenhum dos 4 lugares que calculam "card parado há muito tempo" a
  partir do mesmo `editedAt` excluía card pausado: esmaecimento visual
  `aged-1`/`aged-2`+💤 (`makeCardEl()`), badge `⏳` de aging por coluna
  (mesma função, Fase 5.2), trigger `'aging'` de Automações
  (`checkAgingAutomations()`), lista "Cards parados" da aba 💡 Insights
  (`renderBoardDataInsights()`). Fix: os 4 passaram a checar
  `!card.paused` também. Checado e sem achado (revisão extensa do
  restante da área): `renderBoardDataGrid()` (Visão Geral — WIP/
  Throughput/Bloqueios/Cards ativos/Intake), `_bdHiddenCols` (consistente
  nos 4 lugares que já usam: Grid, Insights, CFD, Burndown),
  `_boardDataSwitchTab()`/`openBoardData()` (troca de aba, reset de
  filtros de período/tag), `_pedirAnaliseBoardInsights()` (só manda
  resumo de CFD/burndown pro Agente Ágil, não o resto de Insights —
  consistente com o que a função já promete). dev v8.30.649, PR #886.

- **2026-09-14, OKR (painel-dev.html) (pedido explícito, escopo nomeado)**:
  **sem achados**, depois de investigação real (não superficial) em
  sub-áreas específicas ainda não cobertas por rodadas anteriores (Fase 1/
  extensão/4 achados em prod/histórico semanal/excluir Objetivo já tinham
  suas próprias rodadas — ver entradas anteriores). Checado: (1) fórmula
  do 🗓️ Bloco quinzenal (`_okrProximaReuniaoDoBloco()` no cliente vs.
  `ehDiaDeReuniao()` em `functions/okr/dailyScan.js`) — testada à mão
  contra várias datas reais, paridade/período batem exatamente nos dois
  lados; achado incidental NÃO corrigido (comentário desatualizado, não
  bug de comportamento): os 2 arquivos ainda citam `_okrBlocoNaData()`
  como "o mirror a manter em sincronia", mas essa função foi removida
  como código morto em 2026-09-06 — o mirror real e correto hoje é
  `_okrProximaReuniaoDoBloco()`; (2) `_okrExcluirObjetivo()` — cascade de
  Marco+comentários completo, sem órfão; (3) 📈 Histórico semanal —
  `OKR_STATUS` (cliente) e as chaves de `resumoGeral` gravadas por
  `weeklySnapshot.js` batem exatamente; (4) disciplina "sincroniza o
  draft antes de re-renderizar" (`_okrSyncObjDraftFromDom()`/
  `_okrSyncMarcoDraftFromDom()`) — confirmada em TODOS os call sites de
  `renderOkrObjBody()`/`renderOkrMarcoBody()`, incluindo o gatilho por
  listener ao vivo (`loadOkr()`, marco de QUALQUER Objetivo mudando
  enquanto outro está aberto) — já tinha sido corrigido numa rodada
  anterior não registrada explicitamente nesta lista; (5) notificação
  `_okrNotifyEditado()` (client) e o equivalente server-side
  (`agenteHelpers.js`, 3 handlers do Agente Ágil) — mesmo formato/path,
  testes automatizados cobrindo os 2; (6) filtro de trimestre na lista de
  Objetivos usa `_okrTrimestresOf()` (array-aware), não o campo legado.

- **2026-09-14, criar card / openCard (pedido explícito, escopo
  nomeado)**: 2 achados reais (mesma causa raiz), técnica 2 (comparar
  contra `fbSaveCard()`, que já documenta e evita exatamente este
  anti-padrão). `openCard()` (marcar `_autoVisto:true` na 1ª abertura de
  card recorrente/agendado) e `processRelembreteAuto()` (marcar
  `_autoRelembradoEm`) escreviam via `fbSet(FB+'/cards/'+
  cards.findIndex(...)+'/campo', valor)` — posição LOCAL do array como
  chave do Firebase, que pode desalinhar da chave real se outra pessoa
  criar/excluir/reordenar algo nesse meio-tempo, gravando o campo no
  card ERRADO em silêncio. Fix: os 2 passaram a usar `fbSaveCard(card)`.
  Checado e sem achado: `openNewCard()` (já tem os fixes documentados de
  rodadas anteriores — vazamento de comentário, seções herdadas do card
  anterior); `_criarCardRecorrente()`/`_criarCardAgendado()`/
  `processRecorrentes()`/`processAgendamentos()` (usam `fbSaveAll()`
  pra criação em lote — padrão correto pra operação estrutural, sem o
  anti-padrão de índice). dev v8.30.650, PR #888.

- **2026-09-14, saveCard() (pedido explícito, escopo nomeado)**: 1
  achado real severo, técnica 3 (comportamento vs. o que o campo deveria
  representar em cada modo). `c.blocker` era derivado da visibilidade
  CSS de `#m-blocker-row`, que fica visível também com `blockerReason`
  residual (nunca limpo em modo COLUNA ao sair da coluna Impedimentos —
  só o auto-desimpedimento em modo TAG, dentro de `recordMove()`, limpa
  isso). Card que passa pela coluna Impedimentos com motivo digitado
  ficava com `c.blocker` travado em `true` pra sempre depois de
  resolvido — sem nenhum indício visível no board (`_cardIsBlocked()`
  ignora `c.blocker` em modo coluna) — e `_settleBlockedTag()` abria um
  episódio de "tempo bloqueado" que nunca fechava, inflando ⏱️ Tempo
  bloqueado (Insights) em silêncio. Fix: `c.blocker` só é derivado/
  atualizado em modo tag; `_settleBlockedTag()` só roda em modo tag
  também. Achado incidental documentado, não corrigido (assimetria
  pré-existente, fora do escopo desta rodada): `scheduleAutoSave()`
  nunca grava `c.blocker` (só `blockerReason`), então marcar/desmarcar
  impedimento por tag só surte efeito via Salvar manual/os botões da
  própria linha — não é alcançável via autosave hoje (nenhum controle
  de UI liga blocker a `scheduleAutoSave()`), então não corrigido por
  não ter cenário real que dispare. dev v8.30.651, PR #889.

- **2026-09-14, board de colunas / tela inicial (pedido explícito,
  escopo nomeado)**: 1 achado real, técnica 2 (comparar contra padrão
  irmão já resolvido na mesma função). `renderBoard()` já ignorava o
  filtro de Responsável na raia por pessoa e o de Tag na raia por tipo
  (mesma dimensão que a raia organiza), mas nunca ganhou o equivalente
  pra raia por subtime — ativar raia+filtro de Subtime ao mesmo tempo
  colapsava a raia pra mostrar só 1 subtime. Fix: `passesFilter()` ganha
  `ignoreSubteam` (4º parâmetro), aplicado quando `raiaMode==='subteam'`.
  Checado e sem achado: `renderNormal()` (render das colunas em si —
  drag and drop, WIP, "ver mais" paginado, colapsar coluna); `_applyBoardPrefsSquad()`/
  `visao_inicial` (guard 1x-por-sessão correto, `ACTIVE_SQUAD` é `const`
  fixado no boot — trocar de squad sempre recarrega a página, não há
  cenário de reaproveitar `window._visaoInicialAplicada` entre squads).
  dev v8.30.652, PR #890.

- **2026-09-14, 📢 Comunicados/Mural (pedido explícito, escopo nomeado)**:
  **sem achados**, depois de investigação real cobrindo o ciclo completo
  — painel-dev.html (`loadComunicados()`, seed de rascunhos, lista/
  arquivados/rascunhos, arquivar/reativar, compose/`_ccTogglePrioridadeUI()`,
  `saveComunicado()`/`deleteComunicado()`, `_sanitizeComunicadoHtml()`) e
  kanban-dev.html (elegibilidade de popup vs. Mural em `_refreshComunicados()`,
  `_talvezMostrarComunicado()`/insistente, badge, `renderMuralLista()`).
  Quase-achado que NÃO se confirmou: `_muralTodos` (painel→kanban) não
  filtra `expiraEm` como `_comunicadosAtivos` (popup) filtra — parecia gap
  à primeira vista, mas é design intencional confirmado lendo os 3
  consumidores junto: Mural é "história completa" de propósito (mostra
  expirados com badge "expirado", `renderMuralLista()`), só
  `_updateMuralBadge()` (contagem de não-lidos) reaplica o filtro de
  expiração por cima — os 3 pontos already são consistentes entre si.
  Também checado: `saveComunicado()` sempre reativa (`ativo:true`) ao
  clicar "Publicar", mesmo editando um arquivado — não é bug, o botão é
  sempre rotulado "Publicar" (nunca "Salvar"), expectativa correta;
  `_isPOOuMais()` (client) bate com `canBulkDelete()`/papéis
  po/organizador/adm, mesmo critério dos dois lados.

- **2026-09-14, filtro de tags (pedido explícito, escopo nomeado)**:
  **sem achados**, depois de investigação real — técnica 1 aplicada a
  TODA a família de implementações paralelas de "filtrar por tag"
  espalhadas pelo arquivo, não só o filtro genérico principal
  (`#f-tag`/`applyFilters()`/`clearFilters()`/`applyFilterPreset()` — os
  3 sincronizam `activeFilters.tag` e o `<select>` corretamente,
  diferente do gap já corrigido de Submarca/Canal em rodadas passadas).
  Checado também: `cardHasTag()` (usa `getCardTags()`, multi-tag-aware,
  sem o bug legado de `card.tag`); os quick-filters de Submarca/Canal
  (`renderSubmarcaQuickFilters()`/`toggleSubmarcaDropdownItem()`/
  `setSubmarcaFromDrawer()`/`setSubmarcaDropdownTodos()` e os
  equivalentes de Canal) — todos os pontos de mutação já sincronizam
  `<select>`+render+`_applyFiltrosBtnUI()`; filtro de tag do Calendário
  (`cal-f-tag`, dentro de `makeDayEl()`) e dos Arquivados (`arch-f-tag`,
  já auditado antes) — ambos usam `cardHasTag()`/`getCardTags()`
  corretamente, não a versão legada. Nenhum ponto de mutação de
  `activeFilters.tag` encontrado fora dos 3 já checados.

- **2026-09-14, modal do card e suas funções (pedido explícito, escopo
  nomeado, amplo — "faz uma rodada no modal do card e suas funções")**:
  1 achado real, na área de Dependências entre cards, técnica 2
  (comparar contra `unlinkDependsOn()`, padrão irmão já resolvido no
  mesmo arquivo). `setDependsOn()` serve tanto pra vincular quanto pra
  TROCAR de pai (menu "🔗 Vincular a outro card" continua disponível
  mesmo já vinculado), mas só atualizava o pai NOVO — nunca limpava a
  referência no pai ANTIGO, diferente de `unlinkDependsOn()`. Card
  trocado de pai ficava listado como dependente do pai antigo pra
  sempre, corrompendo `buildDepChains()`/⛓ Mapa de dependências (card
  aparecia como filho de 2 pais) e bloqueando vínculos futuros
  legítimos via `_dependsDescendants()`. Fix: remove do pai antigo antes
  de vincular ao novo. Checado e sem achado (achado ainda parcial, área
  ampla — não esgotada nesta rodada, ver "Próximo": anexos/links do
  card (`attachSave()`/`attachRemove()`) usam `fbSaveCard()` sem
  `.catch()` — mesma classe de silêncio já corrigida em autosave/
  descrição extra/estado do agente via `_saveCardWithRetry()`, mas essa
  ausência de retry é um padrão espalhado em DEZENAS de outros call
  sites de `fbSaveCard()` no arquivo (pin, arquivar, etc.) — não é um
  gap NOVO nem isolado o bastante pra corrigir só em 1 lugar sem tocar
  os outros, registrado como observação, não como achado desta rodada.
  dev v8.30.653, PR #893.

- **2026-09-14, 🌅 Meu Dia (pedido explícito, escopo nomeado)**: 2
  achados reais. (1) técnica 3 (confrontar comportamento com a promessa
  da própria tela) — `_loadMeuDiaCrossSquads()` só buscava cada squad de
  fora do ativo na 1ª vez (`!_meuDiaCrossData[sq]`), mesmo `openMeuDia()`
  mostrando "⏳ Carregando..." e chamando essa função de novo em TODA
  abertura do painel; card concluído/reatribuído por outra pessoa em
  outro squad ficava desatualizado no Meu Dia pelo resto da sessão,
  reabrir quantas vezes fosse. Ambíguo (freshness vs. custo de leitura
  Firebase) — perguntado ao usuário via `AskUserQuestion` (3 opções:
  sempre recarregar / TTL / só corrigir a mensagem); escolheu "sempre
  recarregar ao abrir". (2) técnica 2 (comparar contra padrão irmão já
  resolvido) — `renderMeuDia()` filtrava "meus cards" só por
  `card.participants`, sem o fallback pro campo legado `participantes`
  que `passesFilter()` (~L12606), o autocomplete de @menção (~L17509) e
  o `lerCard.js` do orquestrador (server-side, `functions/`) já tratam
  como dado vivo — confirmado que não é campo morto antes de corrigir
  (`lerCard.js` usa o MESMO fallback pra montar o resumo que o Agente
  Ágil lê). Card só com o campo legado preenchido sumia do Meu Dia de
  quem estava nele. dev v8.30.654, PR #894.

- **2026-09-14, prazos em dias úteis (feature nova) + ⭐ Kudos (pedido
  genérico, "roda mais um /monitorarbugs")**: código mais fresco
  auditado primeiro (feature "Xd atrasado em dias úteis", PR #895) —
  `_diasUteisEntre()` e os 3 call sites revisados, sem achado (todos
  corretamente gated pra d1<d2, sem mistura de fuso/hora entre os
  sites). Em seguida, área nunca coberta pela skill: ⭐ Estrelas do Mar
  (Kudos). 1 achado real e severo, técnica 1 — mesma classe já corrigida
  em Agentes Externos (2026-08-29: "merge a partir de cache local em vez
  de ler fresco"), só que com janela de corrida MUITO maior aqui:
  `addKudos()`/`delKudos()`/`toggleKudosReaction()` liam
  `kudosSquad`/`kudosGeral` (array local, só atualizado por poll a cada
  3min desde que o `onValue` foi trocado por poll por custo de Firebase —
  ver comentário em `_listenKudos()`) e escreviam ele INTEIRO de volta
  com `window._set()`. Estrela adicionada por outra pessoa durante essa
  janela de até 3min sumia silenciosamente do Firebase no próximo write
  de qualquer outra pessoa (reagir, mandar Estrela nova, ou apagar uma
  antiga — as 3 ações tinham o bug). Fix: os 3 pontos de escrita passam a
  usar `window._runTransaction()` (já usada em `fbCreateCard()`/fila do
  orquestrador) — mutação recalculada sobre o valor fresco do servidor a
  cada tentativa, UI continua otimista. dev v8.30.656, PR #896.

- **2026-09-14, notificações (pedido explícito, "roda /monitorarbugs nas
  notificações", aproveitando o fix de push do "Fale com o ADM")**: 2
  achados reais. (1) técnica 1/comparação com a mega-rodada de
  2026-09-06 — `openNotif()` não tratava `kudos`/`kudos_monitor`/
  `gcal_approved` (todos com `cardId:null`), clicar não navegava pra
  lugar nenhum, mesma classe de bug já corrigida em outros tipos naquela
  rodada, só que estes 3 são mais novos e passaram batido. Fix:
  `gcal_approved`→`openCal()`, `kudos`/`kudos_monitor`→`openKudos()`, +
  `extra:{link:'pessoas'}` nos 3 `createNotif()` de kudos (pro sino
  próprio do painel navegar também, mesmo padrão de `rascunho`). (2)
  **achado incidental, severo** — comparando os 4 arquivos que mexem em
  Kudos "Geral": `painel-dev.html` lia/escrevia `kudos_dev`, caminho
  órfão que NENHUM board lê (`kanban.html`/`kanban-dev.html`/`painel.html`
  sempre usaram `kudos_geral`) — Estrela enviada pelo painel-dev sumia
  (invisível em todo lugar), mesmo a notificação de recebimento sendo
  criada normalmente — notificação fantasma. Confirmado com o usuário
  antes de corrigir (dev tocando um caminho compartilhado). dev
  v8.30.657/painel-dev v3.46, PR #899.

- **2026-09-14, Presença online (pedido genérico, "roda mais um
  /monitorarbugs")**: sem achados — os 3 consumidores
  (`_renderPresenceFromMap()` do kanban, `loadPresence()` do painel,
  "👥 Equipe do quadro") usam consistentemente o mesmo timeout de 30s.
  Observação de baixo risco documentada, não corrigida: presença de um
  squad anterior (após trocar de squad na mesma sessão sem reload) nunca
  é explicitamente removida do Firebase ao trocar — só fica inerte
  (nunca aparece como "online" pra ninguém, já que os 3 consumidores
  filtram por `ts` recente), então não é bug de comportamento, só bytes
  parados (mais perto de `/otimizaçãoderotina`, não implementado aqui).
- **2026-09-14, Lembretes (mesma rodada, achado real)**: técnica 1
  (comparar caminhos paralelos de mutação do mesmo dado) —
  `delLembrete()`/`dismissLembrete()` já liam o Firebase fresco antes de
  escrever `lembretes_prop/{uid}` (comentário citando o "bug dos
  fantasmas"), mas `addLembrete()` (mesmo dado, tipo `'proprio'`)
  escrevia o array local direto. Pessoa com 2 abas/aparelhos podia
  perder um lembrete adicionado numa aba se adicionasse outro na outra
  antes do listener em tempo real propagar. Fix: mesmo padrão dos 2
  irmãos. dev v8.30.658, PR #900.

- **2026-09-14, validação de arquivamento automático (pedido explícito,
  logo após implementar a feature — "garante que as exceções salvas
  estejam funcionando... que as ações dentro do card estejam sendo
  lidas")**: 2 achados reais. (1) técnica 3 (confrontar comportamento
  com a promessa da própria tela) — a fila acumulada (`archive_pending`)
  só checava `excludedCols` quando um card ENTRAVA como candidato novo,
  não ao revalidar a fila já acumulada — card pendente movido pra coluna
  excluída (ex.: Backlog) nunca saía da lista, contradizendo "nunca
  arquivar automaticamente cards nestas colunas". Fix: revalida
  `excludedCols` também na limpeza da fila. (2) achado maior, técnica 1 —
  o cálculo de "sem atividade" olhava só `card.editedAt`, que só é
  setado por quem lembra (`scheduleAutoSave()`/`handleDrop()`/
  `ctxMove()`); `togglePinCard()`/`attachSave()`/`attachRemove()` (entre
  outros) chamam `fbSaveCard()` puro sem tocar `editedAt`. Fix: passa a
  considerar `card.updatedAt` também — confirmado no código que
  `fbSaveCard()`/`fbSaveAll()` JÁ garantem esse campo centralizado em
  TODA escrita pontual (nenhum `fbSet()` cru em `/cards/` sobrevive),
  então é um sinal muito mais confiável que `editedAt` isolado. Achado
  incidental, não corrigido: a mesma limitação existe nos badges de
  "card parado" e em `checkAgingAutomations()` — mesma solução
  (considerar `updatedAt`) resolveria os dois, fica pra rodada própria.
  dev v8.30.661, PR #905.
- **2026-09-15, Intake (vincular/guardar) + Arquivados (abrir card)**:
  pedido explícito, escopo nomeado ("essas áreas que mexemos hoje") logo
  depois de construir as 2 features. 1 achado real — abrir um card
  ARQUIVADO (só ficou fácil hoje, via `_renderArquivadosBody()`; antes só
  dava via `?opencard=` direto, pouco alcançado) expôs que o botão
  "📦 Arquivar" do modal nunca checava `c.archived` — clicar de novo num
  card já arquivado só regravava os mesmos campos, sem servir pra nada, e
  sem opção de restaurar dali. Fix: `openCard()` alterna o botão pra
  "♻️ Restaurar" quando arquivado; `desarquivar()` ganhou checagem pra só
  reabrir a tela de Arquivados se ela já estava aberta (senão criava
  overlay novo por baixo do modal do card). Checagem limpa (técnica 1,
  escritores paralelos): os 2 pontos que criam `intake_pending`
  (`functions/intake/submit.js` e `.../tools/criarCard.js` do Agente
  Ágil) gravam `id: pendingRef.key` certinho nos dois — sem esse campo
  TODOS os botões do item ficam mudos (reproduzido sem querer num script
  de teste manual pro usuário, sem afetar produção). dev v8.30.665.

- **2026-09-15, menu de contexto — submenus hover (pedido genérico, "roda
  um /monitorarbugs" — área escolhida por ser o código mais recente da
  sessão, v8.30.676 recém-validado)**: 1 achado real, técnica 3
  (confrontar com a própria promessa da feature — atraso de 120ms pra
  abrir). `_ctxSubmenuHoverEnter()` agenda `_ctxOpenSubmenuAt()` 120ms no
  futuro; nem `hideCtxMenu()` (clique fora/Esc) nem `showCtxMenu()`
  (trocar de card) cancelavam esse timer. Fechar o menu ou abrir outro
  card com o timer ainda pendente fazia o flyout reabrir sozinho ~120ms
  depois, grudado no canto superior esquerdo (trigger desanexado/
  `display:none` → `getBoundingClientRect()` zerado), com `_ctxCardId`
  já `null` ou apontando pro card errado — clique numa opção do flyout
  fantasma não fazia nada. Fix: `clearTimeout(_ctxHoverTimer)` nas duas
  funções. PR #925, dev v8.30.677.

- **2026-09-16, Notas (pedido genérico, "roda um /monitorarbugs" —
  área escolhida por ser o código mais recente da sessão, nunca
  auditado dedicadamente antes)**: 2 achados. PR #933: (1) **severo**,
  técnica 3 — `saveBlocoTexto()` escreve no Firebase com debounce de
  700ms, mas `onBlocoBlur()` re-renderiza a nota NA HORA ao sair do
  campo sem sincronizar o modelo local antes — digitar rápido e clicar
  fora/Tab antes do debounce fazia o texto recém-digitado sumir
  visualmente da tela por até 700ms (a escrita em si não se perdia, só
  a UI mentia por um instante). Fix: `onBlocoInput()` atualiza o
  modelo local na hora, além de continuar agendando o debounce; (2)
  menor, técnica 1 — vincular/desvincular card do lado da NOTA
  (`notaAddCardLink`/`notaRemoveCardLink`) nunca atualizava cache local
  nem repintava, diferente do lado do CARD (que já fazia isso, com
  comentário explícito sobre não esperar o listener). Mesmo padrão
  aplicado nos dois. Achado de passagem, não é bug: a feature usa
  `update()` multi-path com ref crua — mesma classe de risco já
  corrigida em `_notasUpdate()` (PR #932, rodada anterior), confirmado
  que os 13 call sites já usam o helper novo, nenhum escapou.

- **2026-09-16, 🔥 Black Friday (pedido genérico — área escolhida por
  ser substancial e nunca ter recebido auditoria sistemática, só
  correção reativa de bugs visuais reportados ao vivo)**: 1 achado
  real, técnica 3 — `toggleBlackFriday()` de propósito nunca chama
  `_recordThemeDiscovered()` ("é um teste, sem sentido contar
  métrica"), mas o listener global `auth-change` chamava
  `_recordThemeDiscovered(_currentTheme())` sem nenhuma exceção — se
  esse evento refirasse com a pessoa ativamente no modo BF (SDK do
  Firebase Auth já tem histórico documentado de refirar sozinho por
  instabilidade), gravava `temasDescobertos/blackfriday` mesmo assim,
  furando a própria regra da feature. Fix: listener exclui
  `'blackfriday'` explicitamente. Checado e sem achado: interação
  `--fish-op` (tema) × `fish_bg_off` (preferência pessoal) — mecanismos
  independentes (opacity via CSS var vs. `display:none` via JS no
  elemento), um não fura o outro. PR #935, dev v8.30.682.

- **2026-09-16, painel.html (pedido genérico — área escolhida por
  verificar se algo mais vazou na mesma promoção v3.47 que causou o
  incidente do `loadExtraSquads()`, PR #931)**: 1 achado real, técnica
  2 (comparar contra `painel-dev.html`) — `COMUNICADO_RASCUNHOS_SEED`
  de produção tinha a entrada `seed_teste_comunicados_dev_2026_07`
  ("rascunho de teste do AMBIENTE DEV"), mesma classe de vazamento,
  mesma promoção culpada. `_seedComunicadoRascunhos()` roda sozinha pra
  qualquer ADM que abre a página e grava cada entrada direto no
  Firebase de produção — esse rascunho provavelmente já estava sentado
  lá desde 14/09. Removido de `painel.html`, continua em
  `painel-dev.html`. Checagem de passagem, sem achado: buscas por
  outros `_dev` suffixed paths / comentários "painel-dev" soltos em
  `painel.html` não acharam mais nada (banner, Push manual, GERENCIAS,
  `squadBoardUrl()` — todos corretamente divergentes de propósito). PR
  #937.

- **2026-09-16, `saveCard()`/`fbSaveAll()`/`fbSaveCard()` (investigação
  de erro real no painel, 2ª ocorrência do mesmo padrão "update
  failed... undefined in property 'k...")**: em vez de chutar entre
  ~13 candidatos como na 1ª ocorrência (PR #932), busquei o texto
  COMPLETO direto no Firebase (`error_logs`, campo `msg` guarda até
  300 chars, a tela só mostra 80) — achei 155+ ocorrências reais, 3
  usuários, squad `outlet-crm`, desde 14/09: `cards.<índice>.blocker`.
  Causa raiz: `saveCard()` grava `c.blocker` cru em modo coluna — cards
  antigos sem esse campo têm `c.blocker` `undefined` de verdade, não
  `false`; `update()` do Firebase é tudo-ou-nada, então isso derrubava
  a escrita do card INTEIRO, e como `fbSaveAll()` reescreve `/cards`
  inteiro, um card "envenenado" em memória travava o save de QUALQUER
  card até recarregar a página. Fix na origem (`!!c.blocker`) + rede de
  segurança (`_stripUndefinedDeep()`, mesmo padrão do PR #932) em
  `fbSaveAll()`/`fbSaveCard()` (as 2 vias centrais de escrita de
  cards, ~50 call sites combinados). Aplicado direto em prod pela
  gravidade. PR #939. **Lição pra próxima vez**: quando a mensagem de
  erro do card do painel vier cortada, busque o campo `msg` completo
  direto no Firebase (`kanban/squads/{sq}/error_logs`, precisa
  descobrir squads via `squads_meta` — não assuma só dados/prf/
  midiacriativa) ANTES de tentar adivinhar pela lista de call sites —
  muito mais rápido e preciso que análise estática às cegas.

- **2026-09-17, Estrela do Mar/Kudos (pedido genérico — área nunca
  auditada dedicadamente, já bem hardened de rodadas anteriores contra
  corrida de escrita mas nunca verificada ponta a ponta)**: 1 achado
  real, técnica 1 — `_populateKudosPara()` excluía a própria pessoa do
  dropdown no escopo Cardume (squad), mas não no escopo Geral — dava
  pra mandar Estrela pra si mesmo em "🌊 Geral" (`addKudos()` só evita
  a NOTIFICAÇÃO de auto-envio, o card do kudos era criado normalmente).
  Checado e sem achado: nenhum ranking/leaderboard usa contagem de
  kudos (não era vetor de métrica). Fix: mesmo filtro aplicado nos dois
  escopos. Baixa severidade — fica só em dev (não justificou hotfix
  direto em prod, diferente das rodadas anteriores dessa semana). PR
  #943, dev v8.30.685.

- **2026-09-17, Spotify (pedido genérico — área nunca auditada, sem
  git log recente; escolhida por eliminação depois de esgotar as áreas
  recentemente alteradas)**: Spotify em si sem achado (código já bem
  defensivo). Mas achou de passagem 1 bug real e abrangente, técnica 1
  — os 5 drawers laterais (Lembretes/Dados/Kudos/Spotify/Notas)
  compartilham a mesma classe CSS `.lem-drawer` (mesma posição/
  z-index, 4 deles do mesmo lado da tela), e cada `toggleXxx()` mantinha
  sua própria lista solta de "que outros fechar ao abrir" — as 5
  listas tinham divergido: só `toggleNotas()` fechava os 4 outros
  certinho; `toggleDados()`/`toggleLembretes()` não fechavam NENHUM
  outro. Abrir 2 drawers em sequência (ex. Dados depois de Lembretes)
  deixava os dois `.open` ao mesmo tempo, exatamente na mesma posição
  da tela. Fix: centralizado em `_DRAWER_IDS`/`_closeOtherDrawers()`,
  usado pelos 5 toggles + `abrirNotaVinculada()`. Achado proativo, sem
  risco de dado — fica em dev. PR #945, dev v8.30.686. **Lição pra
  próxima vez**: ao investigar uma área e não achar nada nela mesma,
  vale olhar pro que ela COMPARTILHA com áreas vizinhas (aqui, a classe
  CSS base de todos os drawers) — a técnica 1 às vezes rende mais
  quando comparada entre features DIFERENTES que uma alheia acabou de
  revelar, não só dentro da mesma feature.

- **2026-09-17, áreas críticas do board — `handleDrop()` (pedido
  explícito do usuário, escopo nomeado "áreas críticas")**: 1 achado
  real, severo, técnica 3 — o `.catch()` de `handleDrop()` promete
  "reverte o estado local se o Firebase falhou", mas o update otimista
  antes dele muta bem mais que só `card.col`/`card.edited`: `editedAt`/
  `updatedAt`/`updatedBy`, uma entrada em `card.history[]`
  (`recordHistory()`), e `recordMove()` reescreve `card.flow` inteiro
  (log/enteredAt/firstStartAt/doneAt) + `blocker`/`blockedAt`/
  `blockedMs`. O catch só revertia 2 desses campos (e um deles,
  `card.edited`, nem revertia de verdade — usava `card._prevEdited`,
  nunca setado em lugar nenhum, um no-op disfarçado). Save falho =
  corrupção silenciosa de métricas de fluxo (cycle time/CFD/Throughput)
  + histórico fantasma. Fix: snapshot completo (JSON round-trip) antes
  da mutação, restauração total no catch — em vez de lista de campos
  manual (já ficou desatualizada 1x). Aplicado direto em prod pela
  gravidade (corrupção de dado, ainda que só no caminho de falha).
  Checado e sem achado adicional: nenhum outro lugar do arquivo tem o
  mesmo padrão "otimista + revert no catch" pra cards. PR #947, prod
  v8.30.686.

- **2026-09-17, tags (pedido explícito, escopo nomeado)**: 2 achados
  reais, mesma causa raiz, técnica 1 — Tamanho (`SIZE_TAGS`), Submarca
  (`SUBMARCA_TAGS`) e Canal de venda (`CANAL_VENDA_TAGS`) são grupos de
  tags mutuamente exclusivas (nunca 2 do mesmo grupo no mesmo card), já
  garantido em 3 lugares (campos dedicados do modal, `_doBulkTagMulti()`,
  ações de Automação `set_tamanho`/`set_submarca`/`set_canal_venda`) —
  mas um caminho GENÉRICO de mexer em tags nunca tinha essa checagem:
  (1) dropdown "+ Adicionar tag…" do modal (`_tagAddAvail()`) listava
  as tags de grupo junto com as demais, sem checar exclusividade nem a
  visibilidade por tag que o PO configura (`_submarcaIsVisivel()`/
  `_canalVendaIsVisivel()`, também ignoradas) — dava pra somar "👕 P" +
  "👕 G" no mesmo card por ali; (2) **mais severo, achado incidental**
  — a ação de Automação "Adicionar tag" (`add_tag`, genérica) aceita
  qualquer tag no seletor, incluindo as de grupo, e seu `run()` só
  empurrava a nova sem tirar a antiga do mesmo grupo — regra configurada
  assim corrompia o card silenciosamente (roda sozinha, sem tela, só
  aparece num relatório depois). Fix: dropdown genérico exclui os 3
  grupos (usa o campo dedicado); `add_tag.run()` ganhou a mesma
  exclusividade que as ações dedicadas já tinham. Decisão deliberada:
  o seletor `case 'tag'` de `_autoRenderValueOptions()` (compartilhado
  com os TRIGGERS "tag adicionada/removida") foi mantido intacto —
  excluir os grupos dali quebraria configs de trigger legítimas; fix
  ficou só no ponto de mutação. Checado e sem achado: picker de tags de
  Campanha (`campToggleTag()`) é multi-select livre pra categorizar a
  Campanha, não o card — invariante não se aplica. PR #952, dev
  v8.30.691-dev. **Lição pra próxima vez**: quando uma invariante
  (exclusividade de grupo, visibilidade, etc.) já está garantida em
  vários pontos "dedicados", vale procurar explicitamente por um ponto
  "genérico" que trabalhe no mesmo dado sem saber da regra — é onde a
  invariante mais escapa, e o de Automação é sempre o mais perigoso
  desses por rodar sem ninguém olhando.

- **2026-09-17, automações — `AUTO_ACTIONS` (pedido genérico, "roda
  outro" — área escolhida por ser a mais recentemente alterada, logo
  depois de adicionar `notify_po_org`)**: 1 achado real, técnica 1 —
  `card.owner` muda em 4 lugares já documentados (comentário na
  declaração de `runAutoRules()`) que sempre fazem
  `notifAssigned()`+`runAutoRules('assigned',...)` junto; a ação de
  Automação "Atribuir responsável" (`assign_owner`) era um 5º lugar que
  mudava `card.owner` sem fazer nem uma coisa nem outra — ninguém
  avisado no sino, nenhuma regra encadeada em "atribuído a X"
  disparava. Faltava também o guard de no-op que `add_tag`/`toggle_okr`
  já têm. Fix: `assign_owner.run()` ganhou os dois. PR #955, dev
  v8.30.693-dev. **Achado maior reportado, NÃO corrigido** (decisão de
  produto): nenhuma OUTRA ação de `AUTO_ACTIONS` re-dispara
  `runAutoRules()` após aplicar seu efeito — hoje automação nenhuma
  encadeia em outra automação. Diferente do gap do `assign_owner`
  (tinha 4 precedentes prontos pra copiar), isso seria construir
  encadeamento pela primeira vez, sem promessa existente no código, e
  precisa de proteção deliberada contra loop entre regras — documentado
  como recomendação, não implementado de bandeja.

- **2026-09-17, painel-dev.html — Dashboard consolidado (pedido
  genérico, "roda outro" — área escolhida por prioridade 2, nunca tinha
  tido rodada própria)**: 2 achados reais, mesma causa raiz, técnica 1
  (comparar TODOS os lugares que escrevem `/cards` de volta no
  Firebase em `painel-dev.html` — só existiam 2). `loadAll()` removeu
  o polling automático de `squadData` de propósito (custo de Firebase)
  — o cache local só atualiza ao abrir a página/voltar pra aba/clicar
  em "Atualizar dados". `resolveAllBlockers()` ("✅ Resolver todos" dos
  Bloqueios) e `resetSquadFlow()` (⚙ Config → "Zerar contagem de
  fluxo") mutavam esse cache e escreviam a árvore `/cards` INTEIRA do
  squad de volta — deixar o painel aberto em foco por um tempo (uso
  normal de dashboard) e clicar em qualquer um dos dois apagava
  silenciosamente qualquer card criado/editado/excluído por qualquer
  pessoa nesse intervalo. Mesma classe de bug já corrigida em Kudos (PR
  #896, via transação) e Lembretes (PR #900), aqui com blast radius
  maior (sobrescreve `/cards` inteiro do squad, não um campo). Fix:
  os 2 releem `/cards` fresco do Firebase antes de escrever. Checado e
  sem achado: `buildGlobalPayload()`/`exportEachSquadJSON()` também
  leem `d.cards`, mas é export de backup em JSON, nunca escrevem de
  volta — staleness ali não é perda de dado real. PR #957, dev
  v3.48·painel-dev. **Lição pra próxima vez**: "área nunca auditada"
  não precisa ser uma feature nova — `resolveAllBlockers()`/
  `resetSquadFlow()` existem há semanas; a técnica 1 aplicada de forma
  sistemática ("grep TODOS os writers de um node específico, não só o
  que motivou a rodada") ainda rende achado sério em código antigo,
  especialmente em `painel-dev.html`, que tem muito menos rodadas
  dedicadas que `kanban-dev.html` até agora.

- **2026-09-17, automações (pedido explícito, escopo nomeado — 2ª
  rodada seguida em Automações no mesmo dia)**: 1 achado real, técnica
  1 (comparar `add_checklist_item` — único `AUTO_ACTIONS` com
  `valueType:'text'`, texto livre — contra os outros lugares que
  escaneiam @menção). Edição manual de item de checklist já escaneia
  `@menção` desde 2026-08-30 (`scheduleAutoSave()`); as outras ações
  que geram texto por conta própria (`notify_all`/`notify_po_org`/
  `notify_agent`) sempre chamam `parseMentions()` no próprio texto.
  `add_checklist_item` nunca chamava — regra "Adicionar item 'Avisar
  @fulano'" nunca notificava @fulano, mesmo sendo literalmente texto
  livre pra isso (o próprio exemplo da Central de Ajuda). Fix:
  `parseMentions()` no texto configurado, `includeSelf:true`. PR #960,
  dev v8.30.695-dev. **CORRIGIDO na rodada seguinte**: o achado
  incidental registrado aqui ("`saveCard()` não tem NENHUMA chamada de
  `parseMentions()`, card novo nunca é escaneado por menção") estava
  ERRADO — não considerei que `saveCard` é reatribuído mais adiante no
  arquivo ("── Hook no saveCard para disparar notificações ──"), e é
  esse wrapper que chama `parseMentions()`, cobrindo criação E edição.
  Ver entrada de 2026-09-17 (rodada seguinte) pro achado real que essa
  investigação (equivocada) acabou revelando ali. **Lição pra próxima
  vez**: antes de declarar "função X nunca faz Y" baseado em ler o
  corpo de `function X(){...}`, `grep` pelo NOME da função sendo
  REATRIBUÍDO (`nomeDaFuncao = function` ou `nomeDaFuncao=`) em outro
  lugar do arquivo — um wrapper/monkey-patch depois da declaração
  original muda o que `X()` faz de verdade em tempo de execução, e a
  declaração original sozinha não conta a história completa.
  **Reconfirmado, não implementado**: `toggle_okr`/
  `set_priority` são mais 2 casos do mesmo gap arquitetural já
  reportado na rodada anterior do mesmo dia (nenhuma ação de
  `AUTO_ACTIONS` re-dispara `runAutoRules()` pra encadear em outra
  automação) — mesmo achado, não uma lista nova a cada rodada.

- **2026-09-17, `saveCard()` — wrapper de notificações (pedido
  genérico, "roda outro" — motivada por corrigir um erro meu na rodada
  anterior, ver correção lá)**: 1 achado real, técnica 3. O wrapper
  (`── Hook no saveCard para disparar notificações ──`, reatribui
  `saveCard` global) deriva `prevCol` de `prevCard` (`null` ao criar um
  card) — o bloco "card mudou de coluna" nunca checava se havia um
  `prevCard` de verdade, só `prevCol!==card.col` (`''!==` qualquer
  coluna real é sempre `true`). Criar um card já com Responsável/
  Participantes preenchidos (comum — o dropdown já aparece na tela de
  criação) disparava "Card movido para X"/"Card concluído 🎉" pra essas
  pessoas, e `runAutoRules('move',...)` — trigger dedicado, distinto de
  "Card criado em X" (`card_created`) — disparando errado em toda
  criação na coluna X. Fix: guarda o bloco com `prevCard &&`. Outros
  blocos do mesmo wrapper (responsável/desbloqueado/risco/checklist
  100%) revisados e mantidos — continuam verdadeiros seja criação ou
  edição, diferente de "moveu" (implica transição inexistente na
  criação). PR #962, dev v8.30.696-dev. **Lição pra próxima vez**:
  antes de declarar "função X nunca faz Y" só de ler
  `function X(){...}`, `grep` pelo NOME sendo REATRIBUÍDO em outro
  lugar do arquivo (`nomeDaFuncao = function`/`nomeDaFuncao=`) — um
  wrapper depois da declaração original muda o que `X()` faz de
  verdade em runtime, e ignorar isso já gerou um achado FALSO
  registrado (e agora corrigido) na entrada anterior desta mesma lista.

- **2026-09-17, Backup (pedido genérico, "roda outro" — área nunca
  auditada, prioridade 2)**: **sem achados**, depois de investigação
  real nos 2 mecanismos — `functions/backup/weeklyBackup.js` (Cloud
  Function, real fonte de verdade — roda sozinha, sem depender do
  board aberto) e `checkOverdueBackup()`/`sendBackupEmail()`
  (kanban-dev.html, lembrete client-side best-effort). Checado: (1)
  `DEFAULT_SQUADS`/`SQUADS_IGNORADOS` do Cloud Function batem
  exatamente com `SQUAD_META_DEFAULT`/`SQUADS_FICTICIOS` do client (5
  declarações independentes do mesmo conjunto `{dev,omnichannel}`
  espalhadas por `kanban-dev.html`×2/`painel.html`×2/
  `weeklyBackup.js`×1, todas consistentes — sem drift); (2)
  `storage-lifecycle.json` tem mesmo a regra de retenção de 60 dias
  pro prefixo `backups/` que o comentário do Cloud Function promete;
  (3) `sendBackupEmail()` só grava `cfg.lastRun` DEPOIS do
  `emailjs.send()` resolver com sucesso (dentro do `try`), sem o
  padrão "grava flag antes de confirmar" que já causou bug em
  `maybeAutoArchiveOldCards()`/`checkAgingAutomations()` (rodadas de
  2026-09-12/14). Achado incidental NÃO corrigido (limitação já
  conhecida e superada pelo próprio Cloud Function, não é bug novo):
  `checkOverdueBackup()` só roda 1x por sessão (login), sem
  `setInterval` — diferente de `checkAgingAutomations()`, que reroda a
  cada 5min — mas o comentário na declaração de `weeklyBackup.js` já
  documenta essa fragilidade do lembrete por e-mail como motivação
  EXPLÍCITA pra ter construído o Cloud Function como rede de segurança
  de verdade.

- **2026-09-17, `resolveOwnerName()` — Histórico/Feed do painel (relato
  direto do usuário, com prints: card de "Marina Saran Bernardo"
  aparecia como se fosse de "Marciel Santos")**: 1 achado real, técnica
  4 (pegadinha de matching — condição OR combinando um match EXATO com
  um fallback FROUXO, sem prioridade entre os dois). `resolveOwnerName()`
  buscava `x.init===init||x.email?.startsWith(init.toLowerCase())` num
  único `.find()` — iniciais curtas (2-3 letras) colidem fácil com o
  começo do email de gente diferente; se essa pessoa aparecesse ANTES
  na lista (ordem não-determinística), o `.find()` parava nela e nunca
  chegava no match exato de verdade. Fix: tenta o match exato isolado
  primeiro, só cai no fallback por email se não achar. Aplicado direto
  em `painel.html`+`painel-dev.html` (bug já confirmado ativo em
  produção pelos prints do usuário — não é promoção dev→prod normal).
  Checado e sem achado: `_painelOwnerAvatarHtml()` (avatar ao lado) já
  usa só match exato; `kanban-dev.html` não tem função equivalente com
  esse fallback frágil (Histórico do modal do card sempre mostrou a
  pessoa certa, confirmado no print do usuário). PR #965, painel
  v3.53/painel-dev v3.49. **Lição pra próxima vez**: uma condição
  `A||B` dentro de um `.find()`/`.filter()` onde A é um match EXATO e B
  é um match APROXIMADO/frouxo é sempre suspeita — sem prioridade
  explícita entre os dois, a ORDEM DO ARRAY decide silenciosamente qual
  ganha, não a precisão do critério. **CORREÇÃO (usuário testou em
  prod, não funcionou)**: o fix acima estava incompleto — continua
  válido (risco real de colisão de init), mas não era a causa raiz
  DESTE relato. Causa real: `squadData[sq].cards` (fonte de
  `card.owner`) só atualiza no login/troca de aba/clique manual em
  "Atualizar dados" — diferente de `squadData[sq].members` (`onValue`,
  sempre ao vivo). Com a aba aberta em foco por um tempo, `card.owner`
  cacheado ficava várias edições atrás do responsável real —
  `resolveOwnerName()` resolvia CERTO pra pessoa ERRADA, porque o
  `init` em si já chegava velho. Fix de verdade:
  `openPainelHistorico()` dispara `_pollSquadDados()` ao abrir (ação
  explícita = bom gatilho pra dado fresco); `_applySquadDados()` ganhou
  re-render do Feed quando o overlay já está aberto (`renderAll()`
  nunca incluía `_renderPtFeed()` — dado chegava fresco mas a tela
  ficava com o HTML velho). PR #967, painel v3.54/painel-dev v3.50.
  **Lição pra próxima vez**: "achei uma explicação plausível e
  code-verificável" não é o mesmo que "achei a causa raiz" —
  `resolveOwnerName()` era um bug real e válido, mas eu não conferi se
  o DADO DE ENTRADA (`card.owner`) também podia estar errado por outro
  motivo (staleness) antes de assumir que só a lógica de resolução
  explicava o sintoma. Rodadas anteriores no mesmo dia (Dashboard
  consolidado, v3.48/v3.49) já tinham confirmado que `squadData.cards`
  é stale-by-design no painel — deveria ter cruzado essa informação
  ANTES de propor o primeiro fix, não só depois de ele falhar.

- **2026-09-17, `okr-apresentacao.slide.html` — Anotações da reunião +
  ⏱ Agenda (pedido genérico, "roda um /monitorarbugs" — área escolhida
  por prioridade 1: todo o recurso construído nesta sessão, nunca tinha
  tido rodada própria da skill)**: 1 achado real, técnica 2 (comparar
  contra o padrão irmão já resolvido no mesmo arquivo —
  `#notes-fab[hidden]`/`#login-ov[hidden]`, fix de uma rodada anterior
  no mesmo dia). `.notes-compose` (barra de compor anotação) tem
  `display:flex` numa regra de CLASSE; `renderNotas()` esconde ela via
  `.hidden = !isHoje` (atributo), mas sem `.notes-compose[hidden]
  {display:none;}` a regra de autor sempre vence o `[hidden]` padrão do
  navegador — a barra nunca sumia de verdade numa reunião passada (só
  leitura). Pior: `window._okrAddNota()` sempre grava no bucket de
  HOJE independente da data sendo vista, então digitar ali por engano
  fazia a nota parar silenciosamente no dia errado, sem aviso nenhum.
  Fix: mesmo override `[hidden]` aplicado. Checado e confirmado sem o
  mesmo bug: `painel.html`/`painel-dev.html` (mesma feature, aba OKR)
  usa `style.display='none'` direto — sempre vence qualquer regra de
  classe, não precisou de fix lá. PR #981.

- **2026-09-17, Controle de Criativos — tempo médio/motivo do bloqueio
  (pedido genérico, "roda um /monitorarbugs mais um pouco" — área
  escolhida por prioridade 1: feature mais recente, v8.30.699-dev,
  nunca tinha tido rodada própria)**: 1 achado real, técnica 1 (mapear
  todo call site que mexe no mesmo campo) + técnica 3 (comportamento
  vs. a própria promessa da feature, "motivo dos bloqueados, caso as
  pessoas tenham preenchido"). Em squads com `blockerMode==='tag'`,
  `card.blockerReason` é zerado no instante em que o card é
  desbloqueado (3 pontos: `_doBulkUnblockTag()`, auto-desimpedimento em
  `recordMove()`, `removeBlockerTag()`) — todo card já RESOLVIDO
  aparecia em "Mais tempo bloqueado" sem motivo, mesmo preenchido. Modo
  coluna (padrão) não tinha o bug, porque nada limpa esse campo lá
  (assimetria já documentada num achado anterior, 2026-09-14, mas nunca
  antes cruzada com uma feature que LÊ blockerReason de cards já
  resolvidos). Ambíguo o bastante pra perguntar antes de corrigir
  (usuário escolheu opção b: campo novo em vez de parar de limpar o
  original) — `card.lastBlockerReason` guarda o texto antes de cada
  limpeza, `crvBlockRow()`/cache do Agente Ágil caem pra ele.
  `_duplicarCardObj()` também passou a resetá-lo. dev v8.30.701-dev.

- **2026-09-17, `flow.enteredAt`/`_stripUndefinedDeep()` (achado
  incidental — apareceu como erro real no console ao rodar o script de
  teste da rodada anterior, "Uncaught... invalid key () in property
  '...flow.enteredAt'")**: 1 achado severo, confirmado com dado real
  (`console.log` do card corrompido) antes de qualquer fix, mesmo método
  do bug do atraso (2026-09-17, `atrasadoMs`). Causa raiz:
  `backfillFlow()` fazia `card.flow.enteredAt[card.col] = created` sem
  checar `card.col` vazio — um card de teste manual
  (`c_teste_exectype_...`, `col:""`) virou chave literalmente vazia,
  proibida pelo Realtime Database. Como `fbSaveAll()` reescreve `/cards`
  por COMPLETO a cada chamada, esse 1 card corrompido travava
  (`Uncaught`, sem toast — a maioria dos ~49 call sites de `fbSaveAll()`
  não tem `.catch()` próprio) QUALQUER operação em lote da squad
  inteira, não só o card em si — mesma classe "tudo-ou-nada" do achado
  de campo `undefined` de 2026-09-16. Fix em 2 camadas: guard na origem
  (`backfillFlow()`/`recordMove()` só gravam a chave quando não-vazia) +
  `_stripUndefinedDeep()` (já a rede de segurança central pras 3
  primitivas de escrita de card + Notas) estendida pra também remover
  chaves inválidas de RTDB (vazia ou com `.#$/[]`), não só valores
  `undefined`. dev v8.30.702-dev. **Lição pra próxima vez**: "tudo-ou-
  nada" na escrita multi-path do Firebase não é só sobre VALOR
  (`undefined`) — CHAVE inválida quebra do mesmo jeito, e um card de
  teste isolado esquecido em produção pode travar toda a squad em
  silêncio até alguém tropeçar nele.

- **2026-09-17, `kanban/init_registry`/reivindicação de sigla (pedido
  genérico, "roda outro" — área escolhida por prioridade 1: código mais
  recente sem rodada própria, PR #969, mesmo dia)**: 1 achado real,
  técnica 1 (mapear TODOS os pontos que mutam `.init` de um usuário —
  achou 3, não 2). O PR #969 corrigiu a corrida de colisão de sigla
  ("MS"/"MS") em `autoRegistrar()` (1º login) e `editarInicial()`
  (edição manual pelo ADM), via `runTransaction()` em
  `kanban/init_registry`. `confirmarInscricao()` (tela "Confirmar
  inscrição" — pessoa edita a própria sigla, pré-preenchida mas
  alterável, antes de confirmar) fazia a MESMA mutação com o padrão
  antigo (ler `usuarios_publicos` → checar conflito local → escrever),
  sem passar pelo registry — mesma corrida exata, só que numa 3ª tela
  que ficou de fora do fix original. Fix: mesmo padrão de
  `editarInicial()` (reivindica antes de gravar, libera a sigla
  anterior se a pessoa editou o campo). dev v8.30.703-dev. **Lição pra
  próxima vez**: depois de corrigir uma classe de bug em N lugares
  "conhecidos", a técnica 1 aplicada de forma EXAUSTIVA (grep por todo
  ponto que MUTA o mesmo campo, não só os pontos já sabidos) continua
  valendo a pena mesmo no mesmo dia do fix original — aqui achou um 3º
  ponto que nem o autor do fix original tinha listado.

- **2026-09-18, `painel.html` — 🐛 Monitor não mostrava 5 squads
  (relato direto do usuário, print: só 3 cards de squad na aba
  Monitor)**: investigação real, mas **inconclusiva** — sem fix
  aplicado, registrado aqui pra não repetir o caminho de diagnóstico do
  zero se voltar a acontecer. `squads_meta` tinha 8 squads (3 nativos +
  `app`/`mktplace`/`outlet`/`outlet-crm`/`site`), mas `SQUADS` (array em
  memória) só tinha os 3 nativos — `_errLogSquadsAttached` confirmava
  que `loadErrorLogs()` nunca tinha rodado pros 5 extras. Descartado:
  bug de lógica (`loadExtraSquads()`/`loadErrorLogs()` lidos de ponta a
  ponta, código idêntico ao já corrigido em PR #931/#933, sem
  regressão); label ausente em `squads_meta` (todos os 5 tinham `label`
  válido); exceção no `forEach` (isolado com try/catch por entrada, sem
  erro). Chamar `loadExtraSquads()` manualmente no console, na mesma
  aba, funcionou na hora (8/8 squads, com contagens reais — `outlet-crm`
  sozinho tinha 183 erros invisíveis até então). Hipótese mais forte,
  NÃO confirmada com certeza: corrida entre o evento `fb-ready`
  (dispara assim que o SDK carrega, independente de autenticação) e a
  restauração da sessão do Firebase Auth — `kanban/squads_meta` exige
  `auth != null` pra ler, e se o primeiro `onValue()` for registrado
  antes do token de auth estar pronto, a leitura pode ser negada sem
  retry automático. Não reproduzido de novo no mesmo dia (F5 sozinho
  resolveu, sem erro nenhum no console) — evidência insuficiente pra
  aplicar um fix (`_onRealAuthChange()`, já usado em
  `checkOverdueGlobalBackup()` no mesmo arquivo, seria o candidato
  óbvio se reconfirmado). Se voltar a acontecer, capturar o console
  ANTES do F5 é o próximo passo, não repetir o diagnóstico desde o
  início.

- **2026-09-18, `database.rules.json` — os outros 10 nodes do fix de
  segurança de 2026-09-17 (continuação direta do fix urgente do dia:
  login de freelancer travado pelos 4 nodes já corrigidos)**: técnica 1
  aplicada aos 10 nodes RESTANTES do mesmo PR (#983) — nenhum trava
  login (todos degradam graciosamente: `onValue`/`get()` com
  `.catch(()=>{})` ou sem callback de erro), mas `campanhas`/
  `dados_diarios`/`comunicados` alimentam 3 telas (📣 Campanhas, 📊
  Dados do Board, 📢 Mural) que continuam VISÍVEIS pra qualquer papel
  — `_applyRoleVisibility()` só controla o FAB de Configurações e o
  hotline do Agente Ágil, nada esconde essas 3 abas de um `convidado`.
  Resultado: uma freelancer vê as abas normalmente, mas ficam vazias em
  silêncio (permissão negada, sem nenhum aviso). Apresentado ao usuário
  como decisão de produto (não bug claro) — **decisão: deixar como
  está**, freelancers desta empresa só usam o board pra cards mesmo,
  não precisam dessas 3 áreas. Não implementado. Revisitar só se um
  convidado precisar de fato dessas telas no futuro.

- **2026-09-18, `PUSH_TYPES` (`functions/index.js`) (pedido genérico,
  "roda mais um /monitorarbugs" — área escolhida por ser continuação
  direta do fix de `feedback`/14-09, código mais recente de
  `functions/` sem rodada dedicada)**: 1 achado real + 1 secundário
  aplicado a pedido, técnica 1 (mapear TODOS os tipos de
  `createNotif()` contra `PUSH_TYPES`, mesma técnica do achado de
  `feedback`). `reuniao` (lembrete de reunião do calendário) tinha a
  MESMA assimetria que causou o bug do `feedback` — irmão quase
  idêntico `okr_reuniao` já tinha push desde 2026-09-04, `reuniao`
  (o mais usado dos dois) nunca entrou. `due_today`/`due_overdue`
  (achado secundário, mais ambíguo — podia ser decisão deliberada de
  não interromper a cada prazo vencido) confirmados com o usuário antes
  de aplicar. `PUSH_TYPES` ganha os 3. Suíte 476/476. Requer
  `firebase deploy --only functions:sendPushOnNotification` manual.
  **Lição pra próxima vez**: depois de corrigir um "tipo X esquecido de
  um allow-list", vale comparar TODOS os tipos existentes contra a
  lista de novo (mesma disciplina já aplicada a `init_registry`
  2026-09-17/PUSH_TYPES agora) — allow-lists que crescem por adição
  manual, uma de cada vez, tendem a acumular mais de um esquecimento.
  **Follow-up de validação (mesmo dia)**: push não chegava no celular
  mesmo após o deploy — sessão de debug ao vivo com o usuário
  (`firebase functions:log`) confirmou que a causa era só TIMING de
  propagação do deploy (Cloud Run demora alguns minutos pra migrar
  100% do tráfego pra revisão nova; testar cedo demais bate na versão
  ANTIGA da função, que rejeita os tipos corretamente). Achado
  incidental real na investigação: todos os `return` antecipados de
  `sendPushOnNotification` eram silenciosos, sem log — tornava
  impossível diferenciar "ainda propagando" de "tipo fora da lista"/
  "Não Perturbe"/"sem token" sem um ciclo inteiro de deploy+teste por
  hipótese. Corrigido (cada `return` loga o motivo). Confirmado
  funcionando ponta a ponta no 2º deploy. **Lição pra próxima vez**:
  depois de QUALQUER deploy de `functions/`, esperar ~1-2min antes de
  testar (Cloud Run/Functions Gen2 não troca de revisão instantaneamente,
  mesmo com o comando já tendo retornado sucesso) — e funções com
  múltiplos `return` antecipados deveriam nascer já logando o motivo de
  cada um, não só descobrir isso na hora que precisa debugar ao vivo.

- **2026-09-18, Google Calendar (pedido genérico, área nunca auditada
  antes)**: 1 achado (3 sites) — os 3 pontos de dedup de eventos
  (`_fetchAndCacheGcalForSquad()`/`_mergeGcalSources()` em
  kanban-dev.html + fetch global em painel-dev.html) usavam chave
  `data+título normalizado`, sem o id da agenda — colidia eventos
  DIFERENTES de calendários DIFERENTES com título genérico igual na
  mesma data (não só o mesmo feriado repetido, caso que a chave foi
  desenhada pra cobrir). Mais grave em `_mergeGcalSources()`: regrava o
  resultado deduplicado no `gcal_cache`, então a colisão apagava o
  evento de verdade do Firebase, não só escondia da tela. Fix: inclui
  `ev._calId` na chave nos 3 sites. dev kanban v8.30.704-dev/painel-dev
  v3.53.
- **2026-09-18, Supercard — contagem no modal (pedido direto, print
  mostrando "8/9" fora do card vs. "10/19" dentro do modal)**: 1
  achado, técnica 2 (comparar contra padrão já resolvido). O rollup de
  fora do card (`_superChildren`, dentro de `makeCardEl()`) já filtra
  filhos arquivados (mesmo padrão de `_duplicarComFilhos()`);
  `initSuperChildren()` (popula `editingSuperChildren`, usado pelo
  modal) fazia a mesma busca em `card.childCardIds` sem esse filtro —
  10 filhos arquivados (versões antigas) continuavam contando no total
  do modal, alguns inflando até o numerador de "concluído(s)". Fix:
  mesmo filtro `!c.archived`. dev v8.30.704-dev. **Follow-up no mesmo
  dia (pergunta direta do usuário: "só mexeu na visualização, não
  desvinculou nada?")**: o filtro resolveu a contagem mas
  `persistSuperChildren()`/`saveCard()` escrevem `childCardIds` DIRETO a
  partir da mesma `editingSuperChildren` filtrada — qualquer salvamento
  seguinte do card (não só mexer nos filhos) desvincularia os
  arquivados de verdade do Firebase. Lição: filtrar uma lista que
  alimenta TANTO exibição quanto persistência exige separar as duas
  antes de aplicar o filtro, não filtrar a fonte única. Fix: lista
  separada `editingSuperArchivedIds`, exibição só com ativos,
  persistência sempre com os dois juntos. dev v8.30.705-dev. **Follow-up
  2 (pergunta direta, não achado de varredura)**: "colocar e tirar
  filhos pode entrar no histórico?" — checado: não entrava
  (`addSuperChild()`/`removeSuperChild()` nunca gravavam nada no pai;
  só `quickCreateSuperChild()` gravava, e só no FILHO). Implementado a
  pedido: `persistSuperChildren(histWhat)` grava no pai antes de salvar,
  chamado pelos 3 sites + ícone próprio (🧩) agrupando com o "aplicou
  fan-out..." que já existia. dev v8.30.706-dev. **Follow-up 3 (pedido
  "roda um /monitorarbugs nisso" — auditoria completa das ~16 funções
  da área, não só pergunta pontual)**: 1 achado real, técnica 2 —
  `editingSuperParent` (busca reversa "quem é meu pai?", dentro de
  `initSuperChildren()`) não filtrava pai arquivado, diferente do
  helper irmão `_cardIsSuperChild()` (usado em `searchSuperChildren()`)
  E do cálculo do AVÔ 2 linhas abaixo, NA MESMA função, que já filtra.
  Campanha arquivada deixava o criativo-filho ainda ativo "preso" a
  ela: Ficha Técnica própria escondida, nota apontando pro pai morto —
  mas `searchSuperChildren()` já considerava esse filho livre pra
  adotar em outro supercard, uma contradição real entre 2 pontos do
  mesmo arquivo. Fix: mesmo filtro `!c.archived`. Resto da área (9
  funções + os 2 badges de Timeline) auditado e sem achado — cascata de
  auto-conclusão, fan-out, duplicar com filhos, tudo já correto.
  Achado incidental reportado, não implementado (ambíguo): vincular/
  criar filho grava histórico no PAI (fix anterior), nunca no FILHO
  ("fui vinculado a X"). dev v8.30.707-dev.

- **2026-09-18, Controle de Criativos — tempo médio por categoria/
  tempo em atraso-bloqueado (pedido genérico, "roda outro" — área
  escolhida por prioridade 1, feat e45e8ee/#986/ebdae2d, mesmo dia,
  só o achado de `blockerReason` de 2026-09-17 tinha rodada própria)**:
  **sem achados**, investigação real e exaustiva, não superficial.
  Confirmado via grep exaustivo (técnica 1) que o fix do #986 (bug de
  concatenação de string) já cobre TODOS os 6 pontos de escrita de
  `atrasadoMs`/`blockedMs`/`pausedMs` (`Number(x)||0` em todos) e as 3
  funções de leitura seguras (`_cardAtrasadoMs`/`_cardBlockedMs`/
  `_cardPausedMs`) — nenhum consumidor lê os campos crus sem passar por
  elas. `avgTempoBy()` reusa `_cardTempos()`, que já depende de
  `flow.doneAt` setado via `_isColDone()` (não um hardcode de coluna
  única — mesmo padrão corrigido em 2026-09-04). Cards cancelados
  entram na média de "tempo médio de produção" junto com concluídos —
  não é bug, é o mesmo comportamento estabelecido de `_isColDone()`
  (junta Concluído+Cancelado) usado em CFD/Throughput/Relatório de
  Tempo há semanas, não uma divergência desta feature. `_criativosRows()`/
  `_crvDashFilteredRows()` já filtram arquivados e usam `getCardTags()`/
  `_cardIsSupercard()`/`_cardIsSuperChild()` corretamente (não o campo
  legado `card.tag`). `_crvCardCountBreakdown()` também usa os helpers
  certos.

- **2026-09-18, ⏸ Pausar card (pedido explícito, escopo nomeado — 2ª
  rodada, 1ª foi 2026-09-12/`_cardTempoPorColuna()`)**: 1 achado real,
  técnica 2 (mesma classe já corrigida 2x — `blockedMs`/`atrasadoMs`
  — episódio aberto nunca fechado no desfecho "card concluído").
  `togglePauseCard()` é o único ponto que mexe em `paused`/`pausedAt`/
  `pausedMs` (sem duplicação entre modal/menu de contexto/atalho), mas
  nada nunca desmarcava `paused` quando o card conclui — diferente do
  impedimento em modo tag, que já tem "auto-desimpedimento" documentado
  em `recordMove()`. `_cardPausedMs()` soma o episódio aberto com
  `Date.now()`, mas `_cardTempos()` usa `doneMs` FIXO — card concluído
  ainda pausado tinha o lead time encolhendo em silêncio a cada dia até
  saturar em zero. Alcançável por 2 caminhos (pausar→concluir sem save
  no meio; concluir→pausar depois, nada impede). Fix: `recordMove()`
  fecha a pausa na transição pra coluna de fim (mesmo padrão do
  auto-desimpedimento);  `_settleCardTimeTrackingLazy()` ganha a mesma
  rede de segurança pro 2º caminho. dev v8.30.711-dev. **Follow-up no
  mesmo dia (relato de usuário, via outro usuário: "pausei um card, mas
  vi que estava contando os dias ainda")**: achado real DIFERENTE do
  anterior — `getDue()` (selo "⚠ Xd atrasado" no card, no board) nunca
  checava `card.paused`, mesmo gap do aging de 2026-09-14 mas pra
  "atrasado" (prazo vencido), conceito que aquela rodada não cobriu.
  `_timelineCardRow()` tinha o mesmo gap. Fix: os 2 ganham fallback
  neutro (só a data, sem alarme) quando pausado. Escopo confirmado com
  o usuário: só os 2 lugares "por card" — contadores agregados (Dados
  do Board, Criativos, Meu Dia, sino) ficaram de fora, registrados como
  recomendação, não corrigidos. dev v8.30.712-dev.

- **2026-09-18, 📋 Anotações da reunião (painel-dev.html, aba 🎯 OKR)
  (pedido genérico, "outra área" — área escolhida por ter só um spot-check
  parcial, nunca uma rodada dedicada)**: sem achados, confirmado por 2
  vias independentes. Leitura completa de `renderOkrNotas()`/
  `window._okrNotaAdd()`/`window._okrNotaDel()` (L4975-5045): apesar de
  escrever/apagar sempre no bucket de HOJE (`hoje=_todayStr()`, hardcoded,
  igual ao padrão que causou bug na versão irmã), aqui a caixa de compor
  (`#okr-notas-compose`) e o botão de excluir só existem no DOM quando
  `isHoje` é true — via `.style.display='none'` (inline, sempre vence, não
  a classe CSS que causou o bug em `okr-apresentacao.slide.html`) — sem
  caminho de UI pra escrever/apagar contra uma data que não seja hoje. O
  commit `2a14449` (fix da versão irmã) já tinha confirmado isso
  explicitamente ("painel.html/painel-dev.html… não tem o bug — usa
  style.display='none' direto"); esta rodada releu as funções inteiras e
  confirma de novo, independente. Nenhuma mudança feita.
- **2026-09-18, Cloud Function `visao_board` (réplica server-side de
  `_cardPausedMs()`/`_cardTempos()`) (pedido genérico, "outra área")**: 1
  achado real, técnica 1 (comparar caminhos paralelos — aqui client vs.
  réplica server documentada no próprio arquivo). O fix de
  concatenação-de-string em `pausedMs`/`blockedMs`/`atrasadoMs`
  (2026-09-17, PR #986, `Number(x)||0` em vez de `(x||0)`) foi aplicado só
  no client; `functions/agente-agil-orquestrador/tools/visaoBoard.js`
  `cardPausedMs()` — que o próprio comentário do arquivo documenta como
  "réplica deliberada, replicar manualmente se mudar no client" — ficou
  pra trás com `card.pausedMs || 0` puro, sujeito à mesma corrupção se
  algum card tiver (ou vier a ter) o campo salvo como string. Fix +1 teste
  novo em `__tests__/visaoBoard.test.js` (20/20 no arquivo, 477/477 em
  `functions/`). **Requer redeploy manual** (`functions/` não republica
  sozinho, ver `CLAUDE.md`) — `agenteAgilMencao`, `agenteAgilMencaoDados`,
  `agenteAgilIntake`, `agenteAgilAnalisePO` (todas usam o toolset
  completo). Nenhum outro campo (`atrasadoMs`/`blockedMs`) é lido nesta
  réplica — só `pausedMs`.

- **2026-09-21, painel-dev.html — papel de usuário via aba "👥 Usuários"
  (pedido genérico, "roda um /monitorarbugs" — logo após a promoção em
  lote pra prod; área escolhida por prioridade 2, gerenciamento de
  usuários/papéis nunca tinha rodada própria)**: 1 achado real, técnica
  1 (comparar `updateUserRole()` contra `updateSquadUserRole()`, mesma
  operação) + técnica 3 (rótulo "Membros do Squad" promete escopo por
  squad). `updateUserRole()`/`loadPcfgUsers()` liam/gravavam o campo
  GLOBAL legado `kanban/usuarios/{uid}/role`, ignorando
  `squads_roles/{squadId}` — o mecanismo que `kanban-dev.html` de fato
  prioriza em `getEffectiveRole()` (~8 call sites) e que o modal irmão
  "👥 Global Users" (`updateSquadUserRole()`) já usa corretamente.
  Dropdown mostrava o papel ERRADO quando já existia override por
  squad, e trocar o papel ali podia ser um NO-OP silencioso (toast de
  sucesso, papel efetivo sem mudar). Confirmado com o usuário via
  `AskUserQuestion` antes de corrigir (permission-sensitive) — escolheu
  alinhar com `squads_roles`. Fix: os 2 passam a ler/gravar
  `squads_roles[cfgSquadId]`. dev v3.54·painel-dev. Novo anchor em
  `CODE_MAP.md` ("Papel de usuário — 2 mecanismos").

- **2026-09-21, "🔁 Reatribuir cards" (⚙ Config) (pedido genérico, "roda
  outro" — área escolhida por prioridade 2, ferramenta administrativa
  de reatribuição em massa nunca teve rodada própria)**: 1 achado real,
  técnica 1 (comparar `executarReatribuir()` contra o padrão irmão já
  resolvido `_doBulkAssign()`, bulk assign do board). Os 2 mutam
  `card.owner` em lote, mas só `_doBulkAssign()` chamava
  `recordHistory()`+`runAutoRules('assigned',...)` — reatribuir os
  cards de alguém que saiu do time (o caso de uso típico da
  ferramenta) não deixava rastro NENHUM no Histórico de nenhum card
  afetado, e nenhuma Automação com gatilho "atribuído a X" disparava.
  Fix: os 2 adicionados, só quando `c.owner` muda de fato.
  `notifAssigned()` continua de fora de propósito (mesma escolha de
  `_doBulkAssign()`, evita inundar com 1 notificação por card num lote
  grande). Bônus: `runAutoRules('assigned',...)` já alimenta o funil
  `_registrarSinalAtribuicao()` (sugestão de atalho de atribuição),
  então a ferramenta passa a contar pra essa feature também, de graça.
  dev v8.30.713-dev.

- **2026-09-21, 📣 Campanhas (pedido genérico, "roda outro" — área
  escolhida por prioridade 2, só tinha sido checada superficialmente
  1x em 2026-08-26 junto com outra área)**: **sem achados**, depois de
  investigação real. Checado: (1) os 2 caminhos de exclusão
  (`campDeleteFromDetail()`/`campDeleteCurrent()`) e os 2 de criação/
  edição (`saveCamp()`) são simétricos — mesma checagem `_isPOorOrg()`,
  mesmo `_logCampAction()`, sem drift; (2) `saveCamp()` faz spread de
  `existing=_campanhas[id]` antes de gravar — parecia o mesmo padrão
  de sobrescrita com cache velho já corrigido em Kudos/Lembretes/
  Dashboard consolidado (rodadas anteriores), mas `_campanhas` é
  populado via `onValue` (tempo real), não poll — `existing` reflete o
  estado mais recente do servidor no momento do save, não um snapshot
  velho de quando o modal abriu; risco não se confirma; (3)
  `campAddFixedLink()`/`campDelFixedLink()`/`saveCampEntrada()`/
  `delCampEntrada()` não têm `_isPOorOrg()` — parecia gap comparado às
  4 funções que têm (criar/editar/excluir campanha/ver logs), mas é
  design deliberado: `_applyCampPerms()` só esconde os 4 botões de
  gestão estrutural da campanha, nunca os de KV/link/registro — esses
  são conteúdo colaborativo aberto a qualquer membro do squad, não
  gestão da campanha em si; (4) `_campRef()`/`_campLogRef()` do
  `kanban-dev.html` apontam pro node de PRODUÇÃO (`kanban/campanhas`,
  sem sufixo `_dev`) — à primeira vista parecia contradizer o
  `CLAUDE.md` ("campanhas_log/campanhas_log_dev... usado pelas páginas
  dev"), mas confirmado que isso é característica JÁ CONHECIDA e
  aceita de `kanban-dev.html` (diferente de `painel-dev.html`, que
  separa quase tudo por sufixo `_dev`) — `dados_diarios` (outro node
  checado de passagem) tem exatamente o mesmo padrão, e o próprio
  `CLAUDE.md` já documenta `kanban-dev.html` como "atualmente
  byte-idêntico a `kanban.html`", implicando dado compartilhado por
  design, não um bug novo desta área.

- **2026-09-21, cancelar acesso de usuários excluídos (pedido
  explícito, escopo nomeado)**: 1 achado real severo, técnica 3
  (confrontar comportamento com o que "excluir"/"remover" promete).
  Confirmado antes, sem achado: `removerMembro()`/`deleteGlobalUser()`
  já limpam consistentemente `squads`/`squads_roles`/
  `usuarios_publicos`/whitelist `externos`, sem divergência entre os
  2; pra `@ciahering.com.br` o acesso é por domínio nas
  `database.rules.json` (já documentado no `CLAUDE.md`), squad é só
  organizacional pra interno, nunca foi fronteira de segurança — não é
  achado novo. **O achado real**: a checagem da whitelist `externos`
  (o que de fato barra um externo removido) só roda no `auth-change`,
  cacheada no `localStorage` do navegador da PESSOA por 24h
  (`ext_ok_{email}`) — remover um externo não tinha efeito prático
  algum por até 1 dia inteiro se ela ainda tivesse esse cache válido:
  um F5 pulava a checagem e chamava `autoRegistrar(user)` direto. Com
  `deleteGlobalUser()` (apaga `kanban/usuarios/{uid}` inteiro) ainda
  pior — `autoRegistrar()` caía no branch de "usuário novo" e RECRIAVA
  o cadastro do zero, `squads[ACTIVE_SQUAD]=true` de novo, a pessoa
  "excluída" se auto-reinscrevendo sozinha. Confirmado com o usuário
  via `AskUserQuestion` (trade-off segurança vs. o bug original que
  motivou o cache — SDK do Firebase Auth redisparando `auth-change`
  sozinho por instabilidade) — escolheu a opção recomendada: TTL
  24h→15min, absorve o re-disparo rápido (segundos) mas corta a janela
  de acesso pós-remoção pra 15min. dev v8.30.714-dev.

- **2026-09-21, login e segurança (pedido explícito, escopo nomeado,
  continuação da rodada de "cancelar acesso de usuários excluídos")**:
  3 achados reais, os 3 primeiros via técnica 1. (1)+(3) mesmo bug de
  cache 24h já corrigido em `kanban-dev.html` (`externos`), duplicado
  de forma independente em MAIS DE UM lugar que consulta a whitelist
  `painel_viewers`: `painel-dev.html` (o comentário do próprio código
  já dizia "mesmo padrão de resiliência que kanban-dev.html usa") E
  `okr-apresentacao.slide.html` (`_okrHandleAuth()`, achado ao notar a
  entrada de CHANGELOG de 2026-09-17 que introduziu esse mesmo cache —
  achado por extensão, não fazia parte do escopo original até então).
  Exposição de `painel_viewers` é arguível MAIOR que a do `externos` do
  kanban: libera leitura de `squads_meta`/`config`/`squads/{id}/dados`
  de TODOS os squads (não só 1) + `presence`/`snapshots`/`error_logs`/
  `error_stats`/`agent_usage`/`feedback`, e no caso do OKR, todos os
  dados de Objetivos/Marcos/Anotações/reunião. Mesmo fix nos 2 lugares,
  TTL 24h→15min — trade-off já aprovado pelo usuário na correção
  paralela do kanban momentos antes, não re-perguntado (a 3ª ocorrência
  também não, por ser exatamente o mesmo padrão). **Lição**: ao achar
  um padrão duplicado, sempre `grep` o padrão específico (aqui,
  `painel_viewers`) no repo TODO, não só nos 2 arquivos óbvios do
  escopo nomeado — o 3º caso só apareceu ao revisar o `CODE_MAP.md` de
  passagem. (2) **mais sutil, achado novo**: comparando
  `addAdmEmail()`/`removeAdmEmail()` (par add/remove da mesma relação
  ADM), `addAdmEmail()` sincroniza `kanban/usuarios/{uid}/role='adm'`
  ao promover, mas `removeAdmEmail()` nunca desfazia — só limpava
  `ADM_EMAILS`. `getEffectiveRole()` (`kanban-dev.html`) prioriza
  `isAdmUser()` (corretamente vira `false`), mas cai pro campo `role`
  legado em seguida — um ADM "removido" continuava com papel `adm`
  efetivo no board (`canBulkDelete()` etc.) via esse resquício. Fix:
  `removeAdmEmail()` ganhou o mesmo lookup por e-mail que
  `addAdmEmail()` já usa, rebaixa `role` pra `'membro'` se ainda
  `'adm'`. dev v3.55·painel-dev + `okr-apresentacao.slide.html` (sem
  versão própria).

- **2026-09-21, login e segurança (3ª rodada, cobrindo os 3 ângulos
  pendentes da rodada anterior)**: 1 achado real severo (técnica 1 +
  técnica 3), 2 ângulos confirmados sem achado. **Achado**:
  `force_logout_after` EXISTE e está funcional em produção, mas
  `kanban-dev.html` escutava a mesma chave sem sufixo que `kanban.html`
  escuta (`kanban/global/force_logout_after`), enquanto
  `painel-dev.html` grava em `force_logout_after_dev` — ninguém
  escutava essa 2ª chave. Resultado: (1) botão "Deslogar todos (dev)"
  em `painel-dev.html` sempre foi um no-op silencioso, com toast de
  sucesso mentindo; (2) **mais grave** — o botão de `painel.html`
  (produção) tinha texto de confirmação dizendo "[AMBIENTE DE
  TESTES]... não afeta produção", mas SEMPRE gravou na chave que
  `kanban.html` escuta de verdade — ou seja, sempre deslogava a
  produção inteira, mentindo pro ADM sobre o próprio efeito da ação.
  Perguntado ao usuário via `AskUserQuestion` como resolver a
  divergência de chaves (dar a `kanban-dev.html` uma chave própria,
  quebrando a característica "byte-idêntico a kanban.html" documentada
  no `CLAUDE.md`, vs. remover o botão do dev, vs. só corrigir o texto)
  — escolheu dar chave própria. Fix: `kanban-dev.html` passa a escutar
  `force_logout_after_dev` (3ª linha que diverge deliberadamente de
  `kanban.html` na promoção, documentado no `CODE_MAP.md` pra não ser
  copiada por engano); texto de `painel.html` corrigido pra descrever
  a ação real — **exceção deliberada ao fluxo dev-first**, aplicada
  direto em produção por ser correção pura de texto (zero mudança de
  lógica/escrita), justificada pelo risco de um ADM confiar no aviso
  errado e deslogar produção sem querer. **Sem achado**:
  `confirmarInscricao()` expõe leitura de dados antes de confirmar,
  mas é consistente com o modelo de acesso por domínio já documentado
  (não é fronteira de segurança, nunca foi); timeout de inatividade
  chama o `signOut()` real do SDK do Firebase Auth (import verificado),
  não uma reimplementação local — encerra a sessão de fato, sem gap.
  dev v8.30.715-dev + painel v3.57 + painel-dev v3.56.

- **2026-09-21, "✓ Salvo"/"✅" mentindo sobre confirmação real (relato
  direto de usuária, não pedido genérico)**: usuária reportou "subo 3
  cards, salvo beleza, mas se atualizo a página some o que eu tinha
  feito" ao criar descrição num card existente. Investigação por
  técnica 3 (confrontar o que o toast promete vs. o que o código
  confirma): `_saveCardWithRetry()` (usada por `scheduleAutoSave()`,
  `saveExtraDesc()`, simulação de agente) sempre foi fire-and-forget —
  nenhum call site esperava a escrita confirmar antes de mostrar
  sucesso. `saveExtraDesc()` mostrava "✅ Descrição salva!" e
  `scheduleAutoSave()` trocava o botão pra "✓ Salvo" NA MESMA HORA que
  chamavam a função, não quando ela de fato confirmava — numa conexão
  instável onde as 2 tentativas internas falhassem (~3+ segundos), o
  único aviso de erro real vinha DEPOIS do sucesso falso já ter
  aparecido e sumido, fácil de não notar passando rápido por vários
  cards. Fix: `_saveCardWithRetry()` retorna a promise de verdade; os 3
  call sites só mostram feedback de sucesso depois da confirmação real.
  dev v8.30.717-dev.

- **2026-09-21, MESMO relato, causa raiz REAL (o fix acima não
  resolveu — usuária confirmou "o erro continua... tá sem salvar NADA")**:
  diagnóstico ao vivo via scripts de console (interceptar
  `window._update`, reler direto do Firebase sem cache) — a escrita
  CONFIRMAVA sucesso, o dado só nunca era escrito porque
  `scheduleAutoSave()` (debounce de 800ms) nunca tinha como ser
  "flushada" antes do modal fechar ou trocar de card. `_finishCloseOv()`
  nunca cancelava o timer pendente; quando disparava depois, `editingId`
  já era `null` (perde em silêncio) ou já apontava pro PRÓXIMO card
  (`openCard()` reatribui synchronously) — escrevia no card errado,
  mascarando o problema. `_cardIsDirty()` não cobre esses campos de
  propósito (assume que autosave já resolve). Achado por técnica 5
  (rastrear a mutação até a origem, ao vivo, em vez de só ler código) —
  os scripts de diagnóstico ao vivo (interceptar window._update/_set,
  reler direto do Firebase) resolveram o que a leitura de código sozinha
  não tinha pego na 1ª rodada. Fix: `_flushAutoSave()` cancela e roda a
  escrita pendente na hora, chamada no topo de `_finishCloseOv()` e
  `openCard()`. dev v8.30.718-dev. **Lição pra próxima vez**: quando um
  relato de usuário persiste depois de um fix que parecia certo pela
  leitura de código, não assumir que o fix estava errado — pode ser um
  2º bug diferente na mesma área (aqui, 2 bugs reais e distintos no
  mesmo fluxo de autosave). Diagnóstico ao vivo (scripts de console que
  a própria pessoa afetada roda) é muito mais rápido que só ler código
  quando o sintoma é "intermitente"/difícil de reproduzir de cabeça.

- **2026-09-21, MESMO relato, 3ª e causa raiz DEFINITIVA (os 2 fixes
  acima eram reais mas ainda não resolviam — usuária confirmou sintoma
  persistindo num teste 100% manual, sem console)**: diagnóstico ao vivo
  com log embutido direto em `fbSaveCard()` (sem interceptor, pra
  eliminar ambiguidade de timing) confirmou o cenário mais grave
  possível: a escrita ia com a chave certa, payload certo (cross-
  checado contra `cards_index`), a promise resolvia SEM ERRO — e mesmo
  assim uma leitura crua (`window._get()`) no mesmo path, LOGO em
  seguida, mostrava dado de mais de um MÊS atrás. Achado via técnica 2
  (comparar contra um padrão já resolvido em outro lugar do arquivo):
  `fbSaveAll()`/`fbCreateCard()` já tinham sido corrigidos (2026-08-04 e
  2026-09-03) pra popular `window._cardsByKey[key]` de forma SÍNCRONA
  antes de escrever — o comentário em `fbCreateCard()` inclusive já
  avisava "fbSaveCard() usa window._cardsByKey pra achar a chave real de
  um card", mas ninguém nunca tinha voltado pra aplicar a MESMA correção
  dentro do próprio `fbSaveCard()`. Sem o espelho síncrono,
  `_applyCardsSync()` (que reconstrói TODO `cards` a partir de
  `window._cardsByKey` toda vez que QUALQUER card muda, protegido só por
  uma janela fixa de 2s desde `_lastLocalSave` carimbado no INÍCIO da
  tentativa) podia reverter — e às vezes regravar no Firebase por cima —
  uma escrita que tinha acabado de confirmar sucesso, sempre que ela
  demorasse mais que 2s (retry, `_waitForFirebaseReady()`, latência).
  Fix: mesma linha de `fbSaveAll()`/`fbCreateCard()`, replicada em
  `fbSaveCard()`. dev v8.30.721-dev. **Lição pra próxima vez**: quando um
  comentário em UMA função avisa "função X depende disso", vale grepar
  se X de fato tem a mesma proteção — não assumir que sim só porque o
  comentário fala como se fosse óbvio. E: 3 fixes reais e distintos
  coexistindo no mesmo fluxo (autosave/confirmação/persistência) não é
  incomum quando a área nunca tinha passado por uma auditoria de ponta a
  ponta — não parar no 1º nem no 2º achado só porque cada um, isolado,
  parecia justificar o sintoma.

- **2026-09-21, MESMO relato, 4ª e causa raiz REAL/FINAL (as 3 anteriores,
  incluindo o espelho síncrono de `window._cardsByKey`, eram achados
  reais mas nenhuma era ISTO — usuária confirmou o sintoma persistindo
  de novo)**: diagnóstico ao vivo com interceptors em TODA a cadeia
  (`scheduleAutoSave()`→`_performAutoSave()`→`_saveCardWithRetry()`→
  `fbSaveCard()`) mostrou tudo disparando certo, payload certo,
  `fbSaveCard()` resolvendo sem erro — e uma leitura crua, pelo MESMO
  SDK, na MESMA sessão, imediatamente depois, mostrando o card
  intocado. Confirmado também direto no Console do Firebase (fora de
  qualquer código nosso). Achado via reprodução isolada em Node do
  helper `_stripUndefinedDeep()`: `fbSaveCard()`/`fbCreateCard()`
  chamavam essa função no objeto de update MULTI-PATH inteiro, cujas
  chaves de nível superior são de propósito caminhos com barra
  (`'cards/'+key`) — a validação de chave inválida (`INVALID_FB_KEY_RE`,
  adicionada em 17/09 pra outro bug) rejeita `/`, então TODA chave do
  update era descartada, virando `{}`, e `window._update(ref,{})`
  resolve como sucesso sem escrever nada. `fbSaveCard()`/`fbCreateCard()`
  ficaram completamente quebrados desde 17/09 — qualquer edição/criação
  de card de QUALQUER pessoa, não só de quem reportou. Fix:
  `_stripUndefinedMultiPath()`, aplica o strip por VALOR, não no objeto
  inteiro. dev v8.30.722-dev. **Lição pra próxima vez**: quando um
  helper genérico (`_stripUndefinedDeep`) é reaproveitado num call site
  novo, testar ISOLADO (Node, sem o app) contra o formato REAL do
  argumento daquele call site específico — um objeto de update
  multi-path (chaves com `/` de propósito) não é o mesmo formato que um
  valor aninhado (chaves com `/` sempre inválidas), mesmo passando pela
  mesma função. E: quando 3 fixes reais seguidos não resolvem o
  sintoma, a técnica mais eficiente deixou de ser ler código e virou
  rastrear a cadeia INTEIRA ao vivo com interceptors em cada função,
  até o ponto exato onde "sucesso relatado" e "efeito real" divergem —
  esse é o ponto onde a causa raiz de verdade sempre está.

- **2026-09-22, pipeline de salvamento de card (pedido genérico, "roda
  um /monitorarbugs sem quebrar o código" — área escolhida por
  prioridade 1: código mais recente, mexido sob pressão ontem durante o
  incidente de perda de dados, nunca lido com calma de ponta a ponta)**:
  3 achados reais, todos da mesma classe já validada como real na
  investigação de ontem. (1) **severo**, técnica 1 — `openNewCard()`
  nunca ganhou o `_flushAutoSave()` que `openCard()` ganhou ontem;
  `usarQLItem()`/`_intakeCriarCard()` chamam `openNewCard()` fechando só
  `ql-ov`/`intake-ov` (overlays que ficam empilhados por cima de um card
  já aberto — o comentário do próprio código já confirmava esse
  cenário), sem nunca fechar `#card-ov` — mesma perda silenciosa de
  edição dentro da janela de 800ms do debounce, achada só porque
  procurei TODOS os call sites que reatribuem `editingId`/abrem o modal,
  não só os dois já corrigidos ontem. (2)+(3) técnica 2 (comparar contra
  o padrão que a própria correção de ontem estabeleceu) — nas 3
  primitivas, `_lastLocalSave` era carimbado ANTES de esperar
  `_fbReady`, mas o espelho `window._cardsByKey`/cálculo local só era
  populado DEPOIS — reabrindo a mesma janela de ontem especificamente
  quando `_fbReady` começa `false` e a espera passa de 2s; e a escrita
  de backfill de `_applyCardsSync()` nunca tinha ganho a proteção contra
  campo `undefined` que as outras 3 vias já têm desde 16/09, falhando
  100% em silêncio. dev v8.30.723-dev. **Lição pra próxima vez**: depois
  de corrigir um incidente sob pressão, vale voltar com calma pra
  auditar a MESMA área com o método sistemático da skill — código
  mexido durante um incidente ao vivo tende a corrigir só o caminho
  exato que estava sendo testado, deixando irmãos próximos (aqui:
  `openNewCard()`, o mesmo padrão "carimba antes de esperar" replicado
  nas 3 primitivas, uma 4ª via de escrita nunca coberta) sem a mesma
  correção.

- **2026-09-22, WIP (pedido genérico, "roda outro" — área nunca
  auditada, escolhida por eliminação já que o pipeline de salvamento
  tinha acabado de passar por 2 rodadas seguidas)**: 1 achado real, 3
  call sites, técnica 2+3 combinadas — `updateMetrics()`/
  `renderBoardDataGrid()`/`maybeSnapshot()` calculavam WIP com
  `c.col==='progress'` (string fixa), exatamente a mesma classe de bug
  já corrigida em 2026-09-04 pro campo IRMÃO `done` (`_isColDone()`)
  NESSAS MESMAS 3 FUNÇÕES — o comentário da correção antiga estava
  literalmente do lado da linha do `wip` nunca corrigida. Squad que
  recriou/renomeou a coluna "Em andamento" sempre via WIP=0.
  `maybeSnapshot()` grava isso permanente no Firebase 1x/dia. Fix:
  `_flowStartColIds()` (já o resolvedor canônico do conceito "coluna de
  início", usado pelas Métricas de Fluxo). Achado incidental reportado,
  não corrigido (ambíguo, decisão de produto): o "limite" mostrado
  junto (`agilCfg.wip`) ignora `_colWipLimit()`, que já suporta limite
  por coluna — sem forma óbvia de agregar se `_flowStartColIds()`
  devolver mais de 1 coluna. dev v8.30.724-dev. **Lição pra próxima
  vez**: quando uma função já documenta ter corrigido um campo pra usar
  um resolvedor canônico (aqui, `done`→`_isColDone()`), vale checar se
  TODOS os campos irmãos da mesma função (aqui, `wip`) receberam a
  mesma correção — o comentário do fix antigo geralmente está a poucas
  linhas do bug ainda vivo, tornando a técnica 3 (comentário vs.
  código) quase automática de aplicar.

- **2026-09-22, "roda mais um" (genérico — grep sistemático de todo
  `fbSet(FB+'/...` do arquivo, técnica 1 aplicada de forma exaustiva em
  vez de escopo por feature)**: 1 achado real em 2 áreas pequenas nunca
  auditadas, mesma classe já corrigida em Kudos (2026-09-14)/Lembretes/
  Dashboard consolidado (2026-09-17) — array sincronizado por listener
  AO VIVO (não poll) ainda assim reescrito inteiro a partir do estado
  local, perdendo em silêncio o que outra pessoa adicionou/removeu na
  janela entre o eco do listener e o clique. `addLink()`/`delLink()`
  ("🔗 Links") e `addQLItem()`/`delQLItem()` (Modelos/Recorrentes/
  Agendamentos) corrigidos com `window._runTransaction()`. Achado maior,
  reportado e NÃO corrigido: outros 6 call sites de `qlItems` que editam
  um item ESPECÍFICO por posição no array (não só adicionar/remover) têm
  o mesmo risco, mas `qlItems` não tem `id` por item — consertar direito
  exige mudança de modelo de dado, fora do escopo de um fix pontual. dev
  v8.30.725-dev. **Lição pra próxima vez**: a técnica 1 ("grep TODOS os
  writers do mesmo padrão") rende achado mesmo sem escopo de feature
  nenhum — aqui bastou grepar `fbSet(FB+'/` inteiro e comparar cada
  resultado contra o padrão de bug já conhecido (array local reescrito
  sem reler fresco), achando 2 features pequenas que nunca tinham tido
  nome numa rodada anterior. E: quando o fix certo esbarra numa
  limitação de MODELO DE DADO (aqui, falta de `id` estável), a linha
  certa é corrigir só os call sites onde isso não importa (adicionar,
  puramente append) e reportar o resto — não forçar um id-by-content
  frágil em 6 lugares diferentes só pra "corrigir tudo".

- **2026-09-22, "mover card, alterar data, escrever descrições,
  comentários, checklist" (pedido explícito, escopo nomeado nas ações
  mais usadas do card)**: checklist (`getCL()`/`renderCL()`/`delCI()`/
  grupos), descrição (`saveCard()` vs. autosave — proteção de
  demandante consistente nos 2), prazo (incluindo os atalhos inline
  "+1d"/"+1 sem" da Timeline) e comentários (`submitComment()`/
  `saveEditComment()`/`deleteComment()`/reações, já tinham rodada
  própria em 2026-09-12) revisados de ponta a ponta — sem achado novo,
  já bem cobertos. 2 achados reais em "mover card", técnica 1 (comparar
  contra `handleDrop()`, que ganhou snapshot+revert completo em 17/09,
  PR #947, aplicado direto em prod pela gravidade). (1) `ctxMove()`
  (menu de contexto — "↦ Mover para"/`ctxBlock()`) nunca tinha ganho a
  mesma proteção — falha de escrita deixava o card visualmente movido,
  com flow/histórico/blocker corrompidos em memória, sem aviso nenhum.
  Mesmo padrão de snapshot completo/revert replicado. (2) `_bulkFinish()`
  — finalizador COMPARTILHADO de toda ação em massa (mover, atribuir,
  tag, bloquear...) — chamava a escrita sem `then()`/`catch()`: toast
  de sucesso sempre aparecia, mesmo com falha real. Reverter N cards de
  uma vez exigiria snapshot em cada chamador antes de mutar (maior,
  reportado, não implementado) — corrigido o mais direto: aviso real em
  vez do toast de sucesso mentiroso. dev v8.30.726-dev. **Lição pra
  próxima vez**: um pedido nomeando várias "ações do card" de uma vez
  vale a pena auditar TODAS mesmo que algumas pareçam já bem cobertas
  por rodadas passadas — aqui 3 das 5 áreas pedidas não renderam nada
  de novo, mas "mover card" (que já tinha tido MAIS rodadas anteriores
  que as outras 4 juntas) ainda escondia 2 achados reais, exatamente
  porque o fix crítico mais recente (`handleDrop()`, 17/09) nunca tinha
  sido comparado contra os caminhos irmãos daquela MESMA correção.

- **2026-09-22, 🔍 Busca/Ctrl+K (pedido genérico, "roda mais um" — área
  escolhida por ter um achado de passagem PENDENTE desde 2026-09-02,
  registrado como "fora de escopo" naquela rodada)**: 1 achado real,
  fechando exatamente o que tinha ficado anotado — `renderSearchResults()`
  mostrava o selo de tag lendo `c.tag` (campo legado), mesma classe já
  corrigida em 3 lugares em 2026-09-02 (Arquivados/Cards antigos/QL),
  nunca aplicada à Busca. Fix: `getCardTags(c)[0]`. dev v8.30.727-dev.
  **Lição pra próxima vez**: um achado registrado como "de passagem, fora
  de escopo" não é o mesmo que "sem achado" — vale grepar o histórico por
  "fora de escopo"/"achado de passagem" de vez em quando pra achar esses
  pendentes antes de escolher uma área nova do zero.

- **2026-09-22, aba 🎯 OKR — painel-dev.html (pedido explícito, "roda
  mais um dentro de okr no painel")**: checado e sem achado —
  `_okrTagCriar()`/`_okrTagApagar()` (escrita escopada por tag id,
  `okrTags` é objeto keyed, não array — sem o risco de "escrever array
  local inteiro" já corrigido hoje em Links/qlItems); `_okrCommentSend()`
  (escrita escopada por comentário, mesmo padrão correto); cascade de
  `_okrExcluirObjetivo()` (já limpa `marco_comments` junto). 1 achado
  real, técnica 2 (comparar contra o modal de card do kanban.html) —
  fechar os modais de Objetivo/Marco (✕/clique fora/"Cancelar") nunca
  avisava sobre alteração não salva, diferente de `_cardIsDirty()` no
  kanban.html. Ambíguo o bastante pra perguntar antes (`AskUserQuestion`)
  — usuário confirmou implementar. Fix: `_okrTryCloseObjetivo()`/
  `_okrTryCloseMarco()`, snapshot do rascunho ao abrir vs. estado atual
  ao tentar fechar, só pedindo confirmação se algo mudou; fluxos que já
  persistiram/descartaram de propósito (salvar/arquivar/excluir)
  continuam fechando direto. painel-dev v3.57. **Lição pra próxima
  vez**: nem todo achado real é "bug claro" — uma proteção que existe
  numa feature irmã (aqui, o card) e falta noutra pode ser tanto
  inconsistência real quanto escolha de escopo da 1ª versão da feature
  mais nova; perguntar antes evita implementar uma feature nova (não um
  fix) sem sinal verde.

- **2026-09-22, "roda mais um" (genérico — grep de `PUSH_TYPES` contra
  quem de fato cria cada tipo, técnica 6 aplicada pela via inversa:
  infraestrutura pronta pra um tipo nunca criado)**: 1 achado real e
  grande — `painel_broadcast` já existia em `PUSH_TYPES`
  (`functions/index.js`) e `NOTIF_ICONS` (`kanban-dev.html`), mas NADA
  no repo jamais criava esse tipo de notificação. Publicar um
  Comunicado (`saveComunicado()`, `painel-dev.html`) sempre escreveu só
  em `kanban/comunicados/{id}` — quem não estivesse com o board aberto
  nunca ficava sabendo, nem de um "🚨 Urgente". Confirmado o escopo com
  o usuário via `AskUserQuestion` antes de implementar (feature real
  faltando — dispara só pra tipo urgente/popup insistente, só na
  transição pra publicado). Fix: `_painelResolveComunicadoAlvos()`/
  `_painelNotifyBroadcast()` (painel-dev.html, mesmo padrão de
  `_okrNotifyEditado()`) + `openNotif()` ganhou o tratamento de
  navegação pro tipo (`kanban-dev.html`, mesma classe de gap já
  corrigida 6x em 2026-09-06) + sino próprio do painel navega via
  `link:'pessoas'` (mesmo mecanismo daquela rodada). dev
  v8.30.728-dev/painel-dev v3.58. **Lição pra próxima vez**: depois de
  qualquer achado "tipo X esquecido de um allow-list" (aqui, o
  antecedente foi o achado de `reuniao`/`due_today` em 2026-09-18),
  vale inverter a pergunta — não só "todo tipo criado está na
  allow-list?", mas "todo tipo na allow-list é criado por alguém de
  verdade?". Os dois sentidos já renderam achado real em rodadas
  diferentes.

- **2026-09-22, "notificações do kanban" (escopo nomeado) — leitura
  ponta a ponta de `createNotif()`/`loadNotifs()`/`openNotif()`/
  `NOTIF_ICONS`/som/todos os call sites de `createNotif(`**: 1 achado
  real — a dedupeKey de 5s de `createNotif()`
  (`targetUid+type+(cardId||idOverride)`) é grossa demais pra tipos sem
  `cardId` próprio (`kudos`/`kudos_monitor`/`gcal_pending`/`feedback`,
  sempre `cardId=null`) ou que compartilham o MESMO `cardId` entre
  eventos distintos (`reacao` — reações a comentários diferentes do
  mesmo card): 2 eventos REAIS e diferentes pro mesmo destinatário
  dentro da mesma janela de 5s colidiam na chave e o 2º era descartado
  em silêncio, como se fosse repetição do 1º disparo. Achado via
  releitura de TODOS os ~17 call sites de `createNotif(` comparando o
  que cada um passa como `cardId`/`idOverride` (técnica 1, mas aplicada
  contra a própria função de baixo nível, não entre call sites
  irmãos de uma mutação). Fix: novo parâmetro opcional `dedupeExtra`,
  dedupeKey passou a somar `commentId||dedupeExtra` (o `commentId` já
  existia como parâmetro do createNotif, só nunca entrava na conta).
  Aplicado nos 6 call sites afetados: `toggleReaction` (`cid`),
  `addKudos` -- Estrela recebida + monitoramento ADM/PO (`obj.id`),
  `toggleKudosReaction` (`k.id`), `_queueGcalRequest` (`reqId`),
  feedback do Mural (`id`). dev v8.30.729-dev. Achado incidental
  registrado, não corrigido (baixo valor): `NOTIF_ICONS.due_soon`
  definido mas nunca emitido por nenhum `createNotif()` — código morto
  inofensivo (comentário já deixado no `CODE_MAP.md`).
  **Lição pra próxima vez**: além de comparar call sites IRMÃOS entre
  si (técnica 1 clássica), vale às vezes comparar todos os call sites
  de uma função de baixo nível contra os PRÓPRIOS parâmetros dela — um
  parâmetro que só alguns call sites conseguem preencher bem (aqui,
  `cardId`) pode esconder um bug na função em si, não nos call sites.

- **2026-09-22, "dentro de notificações" (continuação — cobrindo os
  ângulos que a rodada anterior, "notificações do kanban", tinha
  deixado de fora: sino próprio do painel, notificações nativas do
  navegador, push/DND/poda de token)**: 1 achado real severo, técnica 1
  (mesmo padrão já corrigido 3x antes em outros nodes —
  Kudos/Lembretes/Dashboard consolidado do painel). `markAllPainelNotifsRead()`/
  `clearReadPainelNotifs()` (o sino PRÓPRIO do painel, nunca auditado
  nesse ângulo antes — só a navegação ao clicar tinha tido rodada, em
  2026-09-06) liam o node INTEIRO de `.../notificacoes` (`get()`),
  mutavam localmente e regravavam ele inteiro de volta (`set()`) —
  notificação nova chegando nessa janela (menção, prazo, push de outra
  aba) sumia em silêncio a cada "Marcar todas como lidas"/"Limpar
  antigas". Fix: `window._runTransaction()`, mesmo padrão dos 3
  precedentes — só que `painel-dev.html` nunca tinha `runTransaction`
  importado do SDK nem exposto em `window.`, precisou dos 2 (import +
  `window._runTransaction=runTransaction`). painel-dev v3.59. Checado e
  sem achado: `checkUpcomingMeetings()` (dedup por `Set`+`tag`, respeita
  DND, limpeza de ids expirados — já bem hardened); `PUSH_TYPES`
  (`functions/index.js`) comparado contra todos os tipos que
  `createNotif()` cria — vários tipos de fora da lista
  (`checklist`/`done`/`moved`/`kudos`/`kudos_monitor`/`gcal_pending`/
  `gcal_approved`/`reacao`/`rascunho`), mas o comentário da própria
  declaração já documenta a lista como curadoria deliberada e ajustável
  ("ajuste conforme o time for testando"), não um allow-list esquecido
  — diferente dos achados reais de `painel_broadcast`/`reuniao`/
  `due_today` (2026-09-18/22), aqui não há nenhum sinal de que algum
  desses tipos DEVERIA empurrar push e simplesmente foi esquecido, fica
  como observação, não como achado; checagem de Não Perturbe no
  servidor (`dnd.on`/`dnd.until`) comparada campo a campo contra
  `isDndActive()` do cliente — mesma semântica exata; poda de tokens
  FCM só remove nos 2 códigos de erro corretos
  (`registration-token-not-registered`/`invalid-argument`), sem
  over-pruning.

- **2026-09-23, menu de contexto do card por toque/duplo-clique (pedido
  genérico, "roda um /monitorarbugs" — área escolhida por prioridade 1:
  os 5 commits seguidos do rework de duplo-toque/duplo-clique,
  v8.30.734-dev a v8.30.739-dev, mexido sob pressão em iteração ao vivo
  com o usuário no iPad — mesmo padrão de "revisitar com calma depois
  de um incidente" que já rendeu achado em 2026-09-22)**: 1 achado
  real, técnica 1 (comparar os 2 caminhos paralelos — mouse em
  `makeCardEl()` e toque em `addTouchDnD()` — que reimplementam a MESMA
  lógica de "2 toques/clicks dentro de 350ms = menu"). Depois de
  reconhecer um duplo, um 3º toque/clique chegando rápido em seguida
  (contato "quicando" na tela, ou hábito de tocar/clicar 3x) era lido
  como o "1º toque" de um par NOVO — reabria o card por cima do menu
  que tinha acabado de mostrar. Fix: lockout de 400ms após reconhecer
  um duplo, espelhado nos 2 caminhos. Achado secundário corrigido
  junto: comentário em `makeCardEl()` ainda descrevia touch como
  dependente do `click`+timestamp, desatualizado desde a v8.30.739-dev
  (touch é tratado só em `addTouchDnD()` desde então). dev
  v8.30.740-dev. Checado e sem achado: `addTouchColDnD()` (colunas não
  têm menu de contexto, sem risco equivalente); `_renderArquivadosBody()`
  usa template próprio, sem `makeCardEl()`; `showCtxMenu()` só usa
  `clientX`/`clientY`/`preventDefault`/`stopPropagation` — o shim de
  evento do caminho de toque já cobre os 4; `addTouchDnD()` só tem 1
  call site no arquivo.

- **2026-09-23, prazo automático da Recorrência (pedido genérico, "roda
  outro /monitorarbugs" — área escolhida por prioridade 1: código mais
  recente, v8.30.741-dev/v8.30.742-dev, nunca tinha rodada própria)**:
  1 achado real, técnica 6 (código morto) via técnica 1 (comparar
  caminhos paralelos — Recorrência vs. Agendamentos, mesma família de
  "criação automática de card"). `_criarCardAgendado()` já usava
  `due:item.dueCard||''`, mas `dueCard` nunca era escrito em NENHUM
  lugar do repo — todo card criado por Agendamento sempre nasceu sem
  prazo, apesar do código parecer suportar isso. Confirmado que o
  campo "Prazo" do modal compartilhado de editar conteúdo já era
  ignorado no salvamento DE PROPÓSITO (comentário já documentava essa
  limitação) — não é o mesmo achado, só uma pista que não se confirmou
  como bug novo. Ambíguo (decisão de produto: UI nova vs. limpar código
  morto) — perguntado via `AskUserQuestion`, usuário escolheu
  implementar a UI de verdade. Fix: campo "Prazo do card (opcional)"
  (data absoluta) na tela de configurar o Agendamento — mesmo espírito
  da feature de prazo automático da Recorrência (que usa offset
  relativo, já que dispara repetidamente, diferente de Agendamento que
  dispara 1x só). dev v8.30.743-dev.

- **2026-09-24, painel mudando de tema sozinho (relato direto do
  usuário, escopo nomeado)**: 1 achado real severo. `mare_theme`/
  `mare_theme_auto` são chaves de `localStorage` compartilhadas (sem
  sufixo `_dev`) entre `kanban.html`/`kanban-dev.html`/`painel.html`/
  `painel-dev.html`. `_startThemeAutoWatch()` agenda um `setInterval`
  de 1min que sobrescreve `mare_theme` conforme a banda do horário, mas
  nunca re-checava `_isThemeAutoOn()` a cada disparo —
  `_disableThemeAutoIfOn()` só limpa o timer na MESMA aba/instância que
  desligou; com mais de uma aba aberta (confirmado pelo usuário: "liguei
  hoje pra testar, já desliguei e mesmo assim tá alternando"), desligar
  numa não parava o timer já rodando na outra, que seguia sobrescrevendo
  `mare_theme` — vazando pro painel no próximo reload (que só lê a
  chave no boot, sem a feature nem indicação na tela). Fix: o callback
  do `setInterval` relê a flag a cada disparo e se autodesliga. Varredura
  nos outros ~19 `setInterval()` do arquivo: nenhum outro combina
  toggle compartilhado + escrita em chave lida por outra página — caso
  isolado. dev v8.30.746-dev, PR #1061.

- **2026-09-24, "mover card" (3º caminho: toque/mobile) + "reordenar
  colunas" (Ctrl+Z) (pedido genérico, "roda outro /monitorarbugs" —
  área escolhida por prioridade 2, sem código novo desde as 2 rodadas
  anteriores do dia)**: 2 achados reais, ambos severos. (1) técnica 1
  (comparar os 3 caminhos paralelos que movem um card — `handleDrop()`/
  `ctxMove()`, já com snapshot+revert de rodadas de 17/09 e 22/09 —
  `addTouchDnD()`, nunca comparado) — arrastar card por TOQUE (o mais
  comum em tablet) mutava `card.col` direto, sem `recordMove()`
  (cycle/lead time, CFD, Throughput e auto-desimpedimento cegos pra
  todo drag por toque), sem `recordHistory()`/`saveUndo()`, `fbSaveCard()`
  sem `.then()`/`.catch()`. Fix: mesmo padrão replicado. (2) técnica 3
  (confrontar um fix anterior "corrigido" vs. código real) — o fix de
  Ctrl+Z de 2026-09-14 só corrigiu O QUE o snapshot de "reordenar
  colunas" guarda (`columns`), nunca QUANDO `saveUndo()` é chamado —
  continuava depois do `columns.splice()` nos 2 call sites (mouse e
  touch), a "foto" já era a ordem NOVA, `doUndo()` nunca via diferença
  pra restaurar — Ctrl+Z de reordenar colunas continuava um no-op
  completo, o MESMO sintoma que aquele fix achava ter resolvido.
  Confirmado grepando todos os ~20 call sites de `saveUndo()` — só
  esses 2 chamavam depois de mutar. Fix: `saveUndo()` movido pra antes
  do `splice()` nos 2 lugares. dev v8.30.747-dev, PR #1062. **Lição pra
  próxima vez**: um comentário dizendo "já corrigido" (mesmo com o
  próprio código do fix ao lado) merece releitura linha a linha do QUE
  mudou vs. o QUE o sintoma original precisava — corrigir o formato do
  dado guardado não é o mesmo que corrigir a ORDEM em que ele é
  capturado.

- **2026-09-24, "+ Usar" (Modelos/Recorrentes) (relato direto do
  usuário, com prints, durante validação da rodada anterior)**: 1
  achado real, técnica 2 (comparar contra o padrão já resolvido em
  `_criarCardRecorrente()`/`_criarCardAgendado()`/`openQLEdit()` pro
  mesmo campo `item.col`). `usarQLItem()` (botão "+ Usar", Modelos e
  Recorrentes) chama `openNewCard()` sem argumento — cai no fallback
  `columns[0]?.id` — nunca repassava `item.col`, então o card sempre
  nascia na 1ª coluna do board, ignorando a coluna configurada no item
  (visível/certa na tela de editar o item, errada só na criação de
  verdade). Fix: `openNewCard(item.col validado : undefined)`, mesma
  checagem de coluna excluída que os 3 irmãos já usam. dev v8.30.748-dev,
  PR #1063.

- **2026-09-24, continuação do "+ Usar" (pedido genérico — área
  escolhida por continuidade direta do achado anterior)**: 2 achados
  reais, técnica 1. (1) `ctxModel()`/`salvarComoModeloModal()` (os 2
  pontos que criam um Modelo) nunca capturavam `col`/`owner`, diferente
  de `ctxRecorrente()` (mesmo menu, mesma operação) — mesmo com o fix
  anterior, um Modelo nunca tinha o que aplicar. Fix: os 2 passam a
  capturar, mesmo padrão do irmão. (2) `usarQLItem()` nunca aplicava
  `item.owner`, diferente de `_criarCardRecorrente()`/
  `_criarCardAgendado()` (criação automática, já aplicam há semanas) —
  Responsável configurado sempre sobrescrito por quem clicasse "+
  Usar". Fix: aplica `item.owner` quando presente. Achado incidental,
  não corrigido: `descsExtra` do Modelo é write-only (nunca lido de
  volta por `usarQLItem()`/`_mergeModeloEmCardObj()`) — precisa de
  decisão de semântica de merge, fora do escopo. dev v8.30.749-dev,
  PR #1064.

- **2026-09-24, ❓ Central de Ajuda (pedido genérico — área nunca tinha
  tido rodada dedicada, prioridade 2)**: 1 achado real, técnica 3
  (comentário vs. código). A aba "🎵 Spotify" foi removida do DOM da
  Central de Ajuda (feature pausada), mas `swHelpTab()` continuou com
  uma `TABS` local de 9 nomes (incluindo `'spotify'`) contra os 8
  `.ag-tab` reais — o destaque da aba ativa é por POSIÇÃO
  (`forEach((t,i) => t.classList.toggle('on', TABS[i]===tab))`), então
  clicar em "Conceitos Ágeis" acendia "⚡ Automações", e clicar em
  "⚡ Automações" não acendia nenhuma aba (conteúdo sempre correto, só
  o indicador visual). `ALL_TABS` de `renderHelp()` (busca global,
  itera chaves de `HELP_CONTENT`) não tem o mesmo bug —
  `HELP_CONTENT.spotify` segue buscável, só sem aba dedicada
  (intencional). Fix: removido `'spotify'` da `TABS` local, realinhando
  1:1 com o DOM. dev v8.30.750-dev, PR #1065.

- **2026-09-25, aba 🎯 OKR — painel-dev.html (pedido explícito, "roda
  outro /monitorarbugs no okr" — escopo: Configurações/Reordenar/
  Duplicar, os 3 recursos mais recentes, nunca tinham tido rodada
  própria)**: 1 achado real, técnica 3 (comentário vs. código) —
  `_okrDuplicarObjetivo()` documenta no próprio comentário que a cópia
  zera "prazo/progresso/histórico/responsável do marco", mas o código
  copiava `m.responsavel` pro marco duplicado. Fix: `responsavel:''`.
  1 achado secundário reportado, não corrigido (ambíguo/arquitetural):
  `_okrMarcoMover()` (reordenar ▲/▼) escreve `ordem` de todos os marcos
  ativos a partir de um snapshot local do listener — 2 pessoas
  reordenando o mesmo Objetivo quase ao mesmo tempo podem se
  sobrescrever; corrigir de verdade exigiria reler valores frescos
  antes do swap (multi-path, `runTransaction()` não se aplica direto).
  PR #1076, dev v3.66·painel-dev.

- **2026-09-25, `functions/okr/` (continuação direta da rodada
  anterior, agora no backend — `agenteTools.js`/`agenteHelpers.js`/
  `agenteChat.js`/`dailyScan.js`)**: 1 achado real, técnica 2 (comparar
  os 2 gatilhos do mesmo arquivo) — `runOkrDailyScan()`: o gatilho
  "véspera de reunião" já pula Objetivo arquivado, o gatilho "prazo de
  marco chegando" só checava a flag do próprio Marco. Arquivar um
  Objetivo nunca cascateia pros Marcos, então um Marco ativo de um
  Objetivo já arquivado continuava notificando prazo normalmente. Fix +
  teste novo (478/478 em `functions/`). Resto da área (permissão ADM/
  Responsável, formato de histórico, `okrObjId` na notificação,
  PUSH_TYPES/NOTIF_ICONS) auditado, sem achado — consistente com o
  client. PR #1077. **Requer redeploy manual**
  (`functions:okrDailyScan`) — já confirmado feito pelo usuário.

- **2026-09-25, Raia por responsável/tipo/subtime (pedido genérico,
  "roda mais um /monitorarbugs" — área escolhida por prioridade 1:
  código mais recente do arquivo, o próprio fix de drag/criar em Raia
  do início da sessão, nunca auditado depois de corrigido)**: fix
  anterior (drag/criar não funcionava, ver entrada de CHANGELOG
  v8.30.751-dev) revisado e confirmado consistente nas 3 variantes. 1
  achado ambíguo, confirmado com o usuário antes de implementar
  (opção 2 de 2 apresentadas): o botão "+ Card" dentro de uma Raia
  chamava `openNewCard(col.id)` sem contexto — card novo nascia sem o
  responsável/tag daquela raia, aparecendo em "Sem responsável"/"Sem
  tipo" em vez da raia clicada. Fix: `openNewCard(col, prefillOwner,
  prefillTagId)`, aplicado em `renderRaiaOwner()`/`renderRaiaTag()`.
  `renderRaiaSubteam()` fica de fora de propósito — subtime é
  DERIVADO de owner/participants (`cardInSubteam()`), sem um único
  membro "certo" pra pré-selecionar sem chutar. dev v8.30.752-dev.

- **2026-09-25, 📅 Google Calendar (pedido genérico, "roda um
  /monitorarbugs" — área escolhida por prioridade 2, só tinha tido o
  fix de dedup de 2026-09-18, nunca uma auditoria da fila de aprovação
  em si)**: 1 achado real — `processGcalQueueForAdmin()` (fila global
  de pedidos de conexão de agenda, processada em lote por squad)
  apagava CADA entrada da fila incondicionalmente, mesmo quando
  `_fetchAndCacheGcalForSquad()` retornava `ok:false` (token do Google
  expira em ~1h; um lote com vários squads pode atravessar essa borda
  no meio do processamento — a própria função já tem um aviso de "~55
  min" pra esse cenário). Pedido sumia da fila em silêncio, sem
  notificar sucesso nem falha, sem nunca ser reprocessado. Fix: só
  limpa a fila/notifica quando `result.ok`; toast final avisa se algum
  squad falhou. Checado e sem achado equivalente no lado do painel —
  calendários globais não têm fila/aprovação (ADM configura direto),
  sem o mesmo padrão de risco. dev v8.30.753-dev.

- **2026-09-25, "Board Setup" (painel-dev.html) (pedido genérico, "roda
  outro /monitorarbugs" — área escolhida por prioridade 2, nunca tinha
  tido rodada própria, 1 âncora só no `CODE_MAP.md`)**: 1 achado real
  severo — `saveNewBoard()` recusa criar squad com ID duplicado só
  checando o array local `SQUADS`, mas `loadExtraSquads()` (o listener
  que populariza `SQUADS` com squads extras de `squads_meta`) é código
  morto em `painel-dev.html` (early-return deliberado) — `SQUADS` nesse
  arquivo NUNCA inclui um squad extra já existente. Criar um board daqui
  com o mesmo id de um squad de produção sobrescrevia nome/cor/emoji/WIP
  dele em silêncio. Fix: confirma direto no Firebase (`squads_meta/{id}`)
  antes de gravar. Achado secundário, reportado e não corrigido (exige
  editar o listener ao vivo em `painel.html`/prod, `painel-dev.html`
  nunca exercitaria o fix): `loadExtraSquads()` (prod) só adiciona
  squads que aparecem em `squads_meta`, nunca remove os que somem —
  excluir um board não reflete ao vivo pras outras abas/sessões já
  abertas (autocorrige só no F5). dev v3.67·painel-dev.

- **2026-09-28, 💡 Personalização baseada em rotina (pedido genérico,
  "roda um /monitorarbugs de rotina" — área escolhida por prioridade 2,
  os 5 casos nunca tinham tido rodada própria desde que a feature
  nasceu em 2026-09-11)**: 1 achado real, técnica 2 (comparar contra um
  padrão irmão já corrigido no mesmo arquivo — Caso #5/PR #867, que já
  tinha passado por essa mesma classe de bug). Casos #1 (Timeline visão
  inicial) e #3 ("Meus cards" fixado) contavam "sessões" cruas — 1x a
  cada BOOT do script — em vez de dias distintos (como #2/#5 já fazem);
  como o auto-update força reload de toda aba a cada versão nova
  publicada (`CHECK_INTERVAL_MS`, já registrado até 13 reloads em ~40h
  num dia de promoções em lote), um único dia de trabalho normal podia
  sozinho preencher a janela de 5 "sessões" e disparar a sugestão sem a
  pessoa ter repetido o padrão em mais de 1 dia real. Fix:
  `_iniciarSessaoTimeline()`/`_iniciarSessaoMeusCards()` idempotentes
  por dia calendário, não por boot. Checado e sem achado: Caso #2/#5 já
  contam por dias distintos; Caso #4 conta AÇÕES reais (atribuição de
  card), imune a esse tipo de inflação; aplicação no boot
  (`_applyBoardPrefsSquad()`) já auditada em 2026-09-11, confirmada de
  novo correta. dev v8.30.754-dev.

- **2026-09-28, 👤 Minhas Preferências (pedido explícito, "roda um
  /monitorarbugs de rotina nessa area" — painel novo, v8.30.755-dev,
  nunca tinha tido rodada própria)**: 3 achados reais. (1) **mais
  severo, técnica 3** — ligar Timeline-visão-inicial/filtro de
  atrasados pelo painel NO MEIO da sessão mudava `boardView`/
  `activeFilters.due` sem `renderBoard()` — o board só trocava sozinho
  na PRÓXIMA ação que re-renderizasse por outro motivo, sem a pessoa
  ter clicado em nada, contradizendo o comentário do Caso #1 ("nunca
  muda a interface sem a pessoa pedir"). Causa: os guards "1x por
  sessão" travavam a CONDIÇÃO, não a CHAMADA — `_applyBoardPrefsSquad()`
  reroda a cada mudança de qualquer `board_pref` (listener ao vivo).
  Fix: `_isFirstApply`, os 2 blocos só avaliam na 1ª chamada real da
  função na sessão. (2) técnica 1 — `_applyAtribuicaoRapidaAcoes()` só
  adicionava, nunca removia entradas de `ATALHO_ACOES` — remover um
  atalho de atribuição pelo painel numa aba deixava a ação fantasma
  (com tecla funcionando) em OUTRA aba da mesma conta até recarregar.
  Fix: poda `atribuir_*` que não esteja mais em `atribuicao_rapida`
  antes de readicionar. (3) técnica 3 — botão "Ver meus presets de
  filtro" chamava `toggleFilters()` direto; se a barra já estivesse
  aberta antes de abrir o painel, FECHAVA em vez de mostrar. Fix:
  `_prefsOpenFilters()` só abre se ainda fechada. Validado com
  Playwright (mesmo harness de mock da rodada de construção) — os 3
  cenários reproduzidos e confirmados. dev v8.30.756-dev.

- **2026-09-28, 👥 Gerenciamento global de usuários (pedido genérico,
  "Roda outro" — `painel-dev.html`, `openGlobalUsersModal()`/
  `updateSquadUserRole()`/`deleteGlobalUser()` + aba "Membros do Squad"
  (`updateUserRole()`/`addGuestByEmail()`), área nunca tinha rodada
  própria — só citada de passagem na rodada de 2026-09-21 sobre papel de
  usuário)**: 1 achado real (3 ocorrências da mesma causa), técnica 2
  (comparar contra padrão-irmão já resolvido). `toggleUserSquad()`
  (mesmo modal) e `alterarRole()` (`kanban-dev.html`, mesma operação
  feita a partir do board) sempre espelham a escrita em
  `kanban/usuarios/{uid}` também em `kanban/usuarios_publicos/{uid}` —
  o node que `kanban.html` escuta ao vivo pra montar `members`
  (papel/squad de cada pessoa, usado por @menção, filtros e automações
  como "Notificar PO/Organizador"). `updateSquadUserRole()`,
  `updateUserRole()` e `addGuestByEmail()` gravavam só no 1º node —
  promover alguém a PO/Organizador (ou convidar pra um squad) por
  qualquer uma dessas 3 telas não refletia em nenhuma aba de
  `kanban.html` já aberta até a pessoa relogar. Fix: as 3 agora
  espelham em `usuarios_publicos` logo após a escrita original. dev
  v3.68 · painel-dev.

- **2026-09-29, 🌴 Vice City — atalho em "Minhas Preferências" (pedido
  genérico, "Roda um /monitorarbugs de rotina" — área escolhida por ser
  a mais recente ainda não auditada, `toggleViceCity()`/
  `temasDescobertos`, 2026-09-28)**: 1 achado real, técnica 3
  (confrontar comportamento com a promessa do comentário — "nunca
  revela a existência dele pra quem nunca achou"). O gate do atalho
  usava `temasDescobertos.vice`, campo também gravado por
  `_applyAutoTheme()` (tema automático, banda 12h-18h) sem nenhuma ação
  manual — vazava o easter egg pra quem nunca fez o long-press de
  verdade. Fix: campo novo `vice_manual`, gravado só por
  `_recordViceCityManualDiscovery()` (chamada de dentro de
  `toggleViceCity()`); gate passa a checar `vice_manual`. dev
  v8.30.759-dev, PR #1096.

- **2026-09-29, `functions/agente-agil/http.js` +
  `agente-agil-orquestrador/intakeTrigger.js` (pedido explícito, "roda
  outro em uma área sensível e bastante utilizada" — endpoint HTTP
  auth-por-secret, único ponto de contato entre especialistas externos e
  o board)**: 1 achado severo, técnica 3 (comentário/promessa vs. código
  real) + confirmado contra o código-fonte real do
  `@firebase/database-compat` instalado (não suposição). `entry.especialista`
  (texto livre do envelope HTTP) era usado direto em 2 lugares
  (`lerDescricaoEspecialista()`, `tools/notificarEspecialistaExterno.js`)
  pra montar `kanban/config/agentesExternos/${especialista}` — chaves do
  RTDB não podem conter `.`/`#`/`$`/`[`/`]`, `db.ref()` real lança
  exceção SÍNCRONA nesse caso (`makeFakeDb()` dos testes não reproduz
  essa validação, por isso a suíte de 518 nunca pegou isso). Um valor
  plausível como `"databricks.ai"` derrubava `lerDescricaoEspecialista()`
  ANTES do try/catch que `runLoop()` já tem — item ficava travado pra
  sempre em `status:'pending'`, sem NENHUM sinal de falha, o exato
  cenário que o resto do arquivo trabalha duro pra evitar.
  `notificarEspecialistaExterno.js` quebrava sua própria promessa
  documentada ("NUNCA lança exceção pro loop acima"). Fix:
  `isValidFirebaseKey()` nova em `agente-agil/board.js`, checada nos 2
  pontos antes de montar qualquer `ref()`. Lado de ESCRITA
  (`criarAgenteExternoPainel()`, painel-dev.html) já tinha o mesmo
  problema documentado desde 2026-09-01, mas lá existe uma promise que
  rejeita — aqui, do lado de LEITURA, não existia nada pra reverter. 3
  testes novos, suíte 521/521. PR #1098. **Lição pra próxima vez**:
  quando o fake db dos testes é mais permissivo que o Firebase real
  (aqui: não valida caracteres de chave), vale confirmar hipóteses de
  segurança direto contra o código-fonte da lib real instalada
  (`node_modules/`) em vez de só confiar na suíte "verde".

- **2026-09-29, ♾️ Contínuo (pedido genérico, "roda um /monitorarbugs" —
  área escolhida por prioridade 1: código mais recente da sessão, PRs
  #1100-#1103, construída E já teve 2 rodadas de bugfix reativo — via
  relato direto do usuário com screenshot, não via `/monitorarbugs` —
  nunca uma auditoria sistemática de ponta a ponta)**: **sem achados
  novos**, depois de investigação real, não superficial. Confirmado:
  (1) `_duplicarCardObj()` não reseta `card.continuo` (mesmo espírito
  de `card.isOKR`, categoria e não estado acumulado — correto, não
  precisa de reset); (2) grep exaustivo de TODO `position:absolute`
  escopado a `.card` no arquivo (técnica 1) — só `.card-mine::before`
  tinha offset negativo (`top:-9px`), já corrigido nas 2 rodadas
  anteriores; os outros 3 (`.card-selbox`/`.card-pin-btn`/
  `.aged-2::after`) usam offsets positivos, dentro dos limites, sem
  risco de colisão com o `clip-path` novo; (3) `_boardDataBarChart()`/
  `_boardDataSmCvPorColuna()` (candidatos a precisar da mesma exclusão
  de CFD/Burndown) são snapshots do estado ATUAL por coluna, mesma
  categoria de WIP/Throughput — corretamente NÃO excluem `continuo`,
  consistente com a decisão do usuário; (4) densidade compacta
  (`#board.card-compact`) não esconde a fita ♾️ (nenhuma regra
  `display:none` a alcança) — mesmo tratamento de "info primária" que
  🎯 OKR/🔥 OFERTA já recebem (nem uma nem outra são escondidas em modo
  compacto), consistente, não uma omissão; geometria de
  `position:absolute` relativa à PADDING box (não border box) 
  conferida à mão pra confirmar que o fix `top:0` do `.card-mine`
  continua seguro em qualquer densidade (offset sempre positivo
  relativo à borda visível, nunca cai fora do clip). Não fica um
  achado formal registrado aqui pros 2 bugs de CSS já corrigidos
  reativamente (`::before`→`::after`, depois `top:0` no selo "seu
  card") por não terem vindo de uma rodada da skill — só a confirmação
  de que a área está limpa agora fica registrada, pra não reabrir a
  mesma investigação à toa numa rodada futura.

- **2026-09-30, lote do dia no OKR (pedido explícito, "roda um
  /monitorarbugs nas coisas q mexemos hj", 5 áreas nomeadas)**: 1 achado
  real, 4 áreas limpas. PR #1126: `_okrListEditStart()`/
  `_okrChecklistEditStart()` (painel-dev.html) só chamavam
  `_okrSyncObjDraftFromDom()`/`_okrSyncMarcoDraftFromDom()` no branch de
  SALVAR, nunca no de cancelar (Esc) — cancelar editar um item de
  lista/checklist re-renderizava a tela a partir de um draft
  desatualizado, descartando em silêncio qualquer edição pendente em
  campos-irmãos da mesma tela (título/gerência/pilar/descrição do
  Objetivo; nome/responsável/prazo/descrição/mostrarApresentacao do
  Marco). Achado via técnica 2 (comparado contra `_okrListAdd()`/
  `_okrListRemove()`, mesmo arquivo, que já sincronizavam
  incondicionalmente). Sem achado: reorder/drag-drop de Objetivos
  (`_okrObjMover`/`_okrObjReorderTo`/`_okrObjDrag*`, mesmo padrão já
  validado de `_okrMarcoMover`); permissão Gestor OKR
  (`_isGestorOkr`/`_okrCanEdit`/`_okrCanCreate`, sem bypass ad-hoc
  fora desses 3 pontos); "Online no painel"
  (`_painelSendHeartbeat`/`loadPainelPresence`/`renderPainelOnline`,
  heartbeat idempotente, nó separado do presence do board);
  `okr-apresentacao.slide.html` (filtro `mostrarApresentacao` num único
  choke-point em `objMarcos()`, `_okrFitDetailSections()` corretamente
  fora do orçamento de altura do botão "Colapsar concluídos", validando
  o fix de 2 rodadas feito mais cedo no mesmo dia); botão exclusivo
  🐟 Cardume Criativo em `kanban-dev.html` (gate `ACTIVE_SQUAD` no boot,
  sobrevive a reorganizar toolbar); auto-scroll da toolbar perto da
  borda (`_initToolbarEdgeAutoScroll`, máquina de estados `rafId`/`dir`
  autolimpa em 1 frame, `.crv-dragging` evita disputa com o scroll
  manual, `dragleave` com guard `e.target===tb` evita falso-stop ao
  cruzar filhos).

- **2026-09-30, "roda outro mais geral" (genérico, sem área nomeada —
  escolhida por prioridade 1: código mais recente sem rodada própria,
  o fallback de login por redirect do PR #1105, área de login/
  segurança)**: 1 achado real severo, técnica 3 (comentário vs. código
  — o comentário de `doSignIn()` no `<script type="module">` já
  documentava e evitava exatamente essa classe de colisão, mas o
  código 2 linhas abaixo cometia ela mesma pra `doSignOut()`).
  `window.doSignOut = () => window._signOut('manual');` no módulo
  (sempre deferred, roda DEPOIS de qualquer `<script>` clássico, mesmo
  aparecendo antes no HTML) sobrescrevia em silêncio a `function
  doSignOut(){...}` real, no `<script>` clássico mais abaixo — a única
  que de fato limpa `gcal_token` do `localStorage` (achado via `grep`
  dos 2 call sites de `doSignOut()`, ambos bare, ambos resolvendo via
  `window.doSignOut` no clique). Clicar em "🚪 Sair" nunca limpava o
  token de acesso do Google Calendar; em computador compartilhado, a
  próxima pessoa a logar com OUTRA conta Google podia herdar o token
  de calendário de quem saiu antes. Fix: removida a reatribuição
  redundante no módulo. PR #1128, dev v8.30.767-dev.

- **2026-10-01, Automações (escopo nomeado, pedido explícito "roda outro
  /monitorarbugs em automações", continuação direta do fix de corrida de
  escrita em `saveAutoRule()`/`toggleAutoRule()`/`delAutoRule()`, PR
  #1137)**: 2 técnicas, 9 achados reais. Técnica 1 (comparar caminhos
  paralelos) aplicada aos 16 `AUTO_ACTIONS` contra o padrão de "no-op
  guard" (`assign_owner`/`toggle_okr`, 2026-09-17) — 7 sem o guard
  (`set_priority`/`set_submarca`/`set_canal_venda`/`set_tamanho`/
  `set_demandante`/`set_padrao`/`set_cover`): regra re-disparando num
  card já no valor-alvo gravava histórico/salvava/mostrava toast à toa.
  Técnica 1 aplicada de novo a todos os call sites que mudam
  `card.blocker` (modo tag), comparando contra `_doBulkBlockTag()`/
  `_doBulkUnblockTag()` (2026-08-27, já corretos) — achado mais severo,
  2 caminhos sem disparo: botão "✕ Remover impedimento"
  (`removeBlockerTag()`, salva direto sem passar por `saveCard()`) e
  marcar/desmarcar a linha de impedimento no modal + 💾 Salvar (linha
  usa `style.display` direto, não dispara `input`/`change`, autosave
  nunca pegava) — mesma classe de 2026-08-26/2026-08-27/2026-08-29
  (mais de um caminho pra mesma mutação, nem todos disparavam).
  Checado e sem achado: `_runAutoRuleAction()` (já correto, re-busca
  card fresco antes de aplicar); `fanoutTemplates`/`apply_fanout`
  (fixes documentados de 2026-09-06 confirmados intactos); fila de
  pendentes do Agente Ágil (`_claimPendingAuto()`/
  `_refreshCardFromFirebase()`, consistente com o fix de 2026-08-29);
  dispatch `runAutoRules(editingId?'edit':'create',...)` no fim de
  `saveCard()` É código vestigial conhecido e documentado (`'edit'` não
  bate com nenhum trigger) — não é bug, os triggers que importam
  (priority/marked_okr/tags) já têm dispatch dedicado logo acima, por
  design (ver comentário na própria função). PR #1138, dev
  v8.30.770-dev → v8.30.771-dev.

- **2026-10-01, implementações do dia — OKR (preview 👁, contadores,
  UI/UX da aba/modal), apresentação (descrição + comentários do Marco),
  `_relerFotoGoogle()` (pedido explícito, "roda um /monitorarbugs nas coisas
  q fizemos hj")**: 4 achados reais. (1) técnica 3 — `_okrOpenMarcoComments()`
  (apresentação) sem guarda contra resposta assíncrona atrasada: o
  comentário do código dizia "painel fechado antes da leitura voltar" mas o
  `if(!list)` nunca dispara (o elemento sempre existe); clicar em outro
  Marco rápido mostrava os comentários do anterior sob o título novo.
  (2) técnica 3 — as seções `<details>` do modal OKR (v3.86) perdiam o estado
  aberto a cada re-render do corpo (todo "+ Add" reconstrói o modal). (3)+(4)
  `_relerFotoGoogle()`: lia `providerData` do objeto capturado ANTES do popup
  (login devolve objeto novo — descartava a fonte mais fresca) e o motivo
  "mesma foto" mentia quando a People API falhava. Checado e sem achado: stats
  strip/filtros (contagem antes do filtro de status, `podeReordenar`), `?preview=`
  (consumo único em `rebuild()`), contadores (`oninput` + render inicial),
  borda de status do Marco. Dev: kanban v8.30.775, painel v3.87.
  **Lição**: toda leitura assíncrona disparada por clique precisa de guarda
  "ainda é a minha vez?"; e todo estado de UI que mora só no HTML gerado se
  perde quando o container é reconstruído.

- **2026-10-01, login com Microsoft — kanban/painel + regras (pedido
  genérico, "roda outro /monitorarbugs" — área escolhida por prioridade 1:
  código de hoje, security-adjacent, sem rodada própria)**: 3 achados,
  técnica 2 (comparar o gate do client contra o das regras) + técnica 3.
  (1) o pin de provedor das regras (#1152) deixou as regras MAIS estritas
  que o gate do client (`_isTrustedDomainEmail`, só domínio): conta
  `@ciahering.com.br` clicando em "Entrar com Microsoft" (ou `@arezzo` no
  Google) entrava num app em que toda leitura/escrita é negada — board em
  branco sem explicação. (2) `if(user.email && !confiável)` tratava e-mail
  vazio como "ok" — comum em Microsoft sem atributo `mail`. (3) a mensagem de
  recusa ("Acesso restrito... peça ao PO") nunca era lida em kanban:
  `_signOut()` faz `location.reload()` logo depois de escrevê-la em
  `#login-err`. Fix: `_loginProviderMismatchMsg()` nos 2 arquivos +
  `_rejectLoginAfterReload()`/`_showLoginNotice()` no kanban. dev kanban
  v8.30.776, painel v3.88. Reconfirmado, NÃO corrigido (decisão do usuário em
  2026-10-01): o `email` do Entra não é verificado (nOAuth) — quem tem tenant
  próprio consegue emitir um token com `email` terminando em
  `@arezzo.com.br`; a mitigação real (checar `tid`/exigir e-mail verificado)
  foi adiada. **Lição**: ao endurecer as regras do banco, procurar TODOS os
  gates do client que decidem "pode entrar" e alinhar — regra mais estrita
  que o client vira tela vazia, não erro.

- **2026-10-01, seletor de squad pós-login (#1148) + correções de OKR do dia
  (#1147/#1150/#1151) (pedido genérico, "roda mais um")**: 2 achados reais.
  (1) **severo, técnica 1** — `saveOkrMarco()`/`_okrArquivarMarco()` gravam um
  resumo no `history[]` do Objetivo PAI (Firebase + cache), mas o Objetivo
  segue aberto por baixo com `_okrObjDraft` desatualizado; o 💾 Salvar do
  Objetivo grava `{...draft}` por cima do nó inteiro e apagava a entrada do
  Marco, em silêncio (fluxo comum: editar Marco dentro do Objetivo e salvar o
  Objetivo). Fix: `_okrSyncObjDraftHistory()` (rascunho + snapshot do
  dirty-check). 8 cenários em Node. (2) técnica 2 — `renderSelectorGrid()`
  (kanban) injetava label/subtitle/emoji/id de `squads_meta` crus; o seletor
  do header já usava `esc()`/`encodeURIComponent()`. dev kanban v8.30.777,
  painel v3.89. Texto digitado em uma caixa "+ Add" se perdia ao confirmar OUTRA lista
  ou ao ir pra ⚙ Config/Marco e voltar — CORRIGIDO na sequência (v3.90,
  `_okrReadPending()`/`_okrWritePending()` + corpo do modal limpo ao
  abrir/fechar a sessão pra não vazar entre Objetivos; 12 cenários em
  Chromium/Playwright com as funções reais, 6 falham sem o fix). Checado e sem achado: `resolveSquadAndShow()` (ADM/1 squad/N squads/padrão),
  `_okrTryCloseMarco()`, DnD de Marcos, `openOkrConfig()` pós-fix.
  **Lição**: quando uma tela filha (Marco) grava no pai (Objetivo) enquanto o
  pai está aberto com rascunho em memória, o salvar do pai sobrescreve o que a
  filha escreveu — sincronizar o rascunho depois de toda escrita do filho no pai.

- **2026-10-02, downloads de bytes do painel — v3.93 recém-promovido (pedido
  explícito, "roda um /monitorarbugs nessa area de downloads de bytes")**:
  4 achados reais, técnica 3 (o que a feature promete vs. o que ela deixa
  acontecer nas bordas). (1) cache de cards em IndexedDB sobrevivia ao logout
  e não separava usuários — dado de cards de uma conta ficava no disco de um
  computador compartilhado (chave agora com `uid`, limpo no `auth-change`
  null, store recriado na v2); (2) recarga completa (Shift+clique em 🔄) pedida
  durante um fetch em andamento era engolida em silêncio; (3) `loadGlobalUsers()`:
  releitura forçada durante outra em andamento descartada (papel antigo na
  tela depois de editar) e sem retry na falha da 1ª leitura (o `onValue`
  antigo reconectava sozinho — avatares/OKR vazios a sessão toda); (4)
  `leavesP` sem `.catch` (rejeição sem tratamento quando cards falha). Confirmado
  e sem achado: `fbSaveAll()` carimba `cards_updated_at` (tocados novos, demais
  com o próprio; sem `touchedIds` carimba todos → recarga completa, seguro); o
  painel não muta objetos de cards em cache. Residual reportado, não corrigido:
  `loadPcfgUsers()`/`addGuestByEmail()`/ações de ADM ainda leem `kanban/usuarios`
  inteiro (1,1 MB) por ação — admin-only e raro, e usar o cache ali mostraria
  papel antigo logo depois de uma troca. **Lição**: ao trocar "listener ao vivo"
  por "leitura sob demanda", o que o listener fazia DE GRAÇA (reconectar,
  entregar o dado mais novo depois de uma escrita) vira responsabilidade
  explícita — checar retry e fila de releitura; e todo cache persistente no
  navegador precisa nascer com chave por usuário e limpeza no logout.

- **2026-10-05, áreas sensíveis (pedido genérico, "roda um /monitorarbugs nas
  áreas sensíveis" — priorizado o que o histórico ainda NÃO cobria: lado de
  ESCRITA das regras, formulário público de intake de ponta a ponta,
  `functions/spotify/`)**: 3 achados reais + 1 decisão adiada. (1) **severo,
  técnica 3** — `on*="f('${esc(x)}')"` não é seguro (`esc()` → `&#39;`, decodificado
  antes do JS do atributo): XSS armazenado reproduzido no Chromium com o
  `_intakeItemHtml()` real; qualquer membro/freelancer com escrita em
  `intake_pending` roda JS na sessão de quem abrir a tela (inclusive ADM). 332
  interpolações (195 kanban + 137 painel; ~110 NEM passavam por `esc()`) + 4
  (`okr-apresentacao`) + 1 (`onboarding`, sem `esc()` na página) convertidas pra
  `jsq()`; 5.020 textos hostis, 0 falhas. (2) rate limit de `intakeSubmit` e
  `agenteAgil` usava `fastly-client-ip`/1º `x-forwarded-for` — o cliente escolhe
  os dois (function chamada direto, sem Hosting); rotacionar o cabeçalho
  contornava o limite de 5/h e o de 20 tentativas/h de auth. Fix: `clientIp()`
  (mais à direita, pula interno) + teto por squad de 40/h; teste com o handler real.
  (3) `spotifyOauthCallback` redirecionava pra `pending.returnUrl` (gravado pelo
  cliente) sem validar — redirecionamento aberto servido de domínio confiável; a
  function segue no ar com o Spotify pausado. Fix: `isAllowedReturnUrl()`. **Decisão
  (aprovada pelo usuário, mesmo dia)**: `usuarios.read` e `notificacoes.write` abertos a
  qualquer conta autenticada — juntos permitiam ler todos os uids/e-mails/tokens e criar
  notificação com título/texto arbitrários que a function transforma em push (a URL
  do clique é fixa, então não há redirect, mas é phishing por push); `feedback`/
  `access_log` `.write: auth != null`. Regras novas preparadas (aguardam o deploy manual
  do usuário): leitura de `usuarios` só pra empresa/visualizador + cada um lê o próprio
  registro; criar notificação em caixa alheia só membro real, com `type`, e
  `painel_broadcast` só PO/ADM (restringir TODA notificação a ADM quebraria
  @menção/atribuição — o app cria no navegador de quem age); `feedback`/`access_log`
  só membro. Verificado com simulador de regras novo (`functions/rules/`): 1.012
  combinações antigo × novo, nada ficou mais permissivo; vira teste permanente.
  **Lição**: `esc()` é escape de HTML, não de string JS — qualquer valor que vá
  PARA DENTRO de um literal JS num atributo precisa de `JSON.stringify` + `esc`;
  e quando o fix de uma rodada anterior dá "atômico" a um rate limiter, perguntar
  também de ONDE vem a identidade que ele conta.

- **2026-10-05, login/cadastro do dia — v8.30.781–785 (pedido genérico, "roda um
  /monitorarbugs" — área escolhida por prioridade 1: código escrito sob iteração ao vivo, algumas
  horas antes, sem rodada própria)**: 5 achados, o mais sério é REGRESSÃO MINHA da v8.30.784,
  técnica 3 (o que o código promete vs. o que as regras permitem). Ao trocar a gravação do cadastro de
  fire-and-forget por `await` + `return` na falha, um caso que antes falhava em silêncio e deixava o
  app abrir passou a travar o login: ADM por e-mail (não-Caio) no 1º login grava `role:'adm'`, e as regras
  (`usuarios/$uid/role` `.validate`) só deixam po/adm/Caio atribuir `adm` — NEGADO, cadastro inteiro
  recusado. Validado avaliando a expressão REAL da regra (o simulador `functions/rules/` só avalia
  `.read`/`.write`, não `.validate` — um "NEGA esperado" dele passou por engano e quase virou falso
  OK). Fix: grava `membro` (ADM segue ADM por `isAdmUser()`), falha de gravação avisa mas não trava.
  Também: `confirmarInscricao()` regravava `role` (recusa o update inteiro, iniciais perdidas); cache
  `ext_ok_` do gate vale pro e-mail e não pro squad; auth-change refirado abria 2 telas/2 reivindicações.
  dev v8.30.786-dev. **Lição**: ao transformar uma escrita silenciosa em escrita que BLOQUEIA o fluxo na
  falha, listar primeiro TODO caso que hoje falha em silêncio de propósito (ou por acidente) — "falhar em
  silêncio" e "funcionar" são indistinguíveis até alguém passar a olhar o resultado. E o simulador de
  regras precisa avaliar `.validate`, não só `.read`/`.write`, antes de ser tratado como prova.
- **2026-10-05, 📈 Atingimento + modal do OKR (v3.98–3.100, pedido "ficou MUITO foda... roda um
  /monitorarbugs", minutos depois de a feature ir ao ar)**: 4 achados, 2 reproduzidos em Playwright
  ANTES de corrigir. (1) `change` num campo de config re-renderizava a seção inteira no blur — comeu o
  clique do botão que a pessoa ia apertar (`+ Registrar`/`+ Adicionar data`): precisava de 2 cliques;
  (2) digitar valor + Salvar dizia "salvo" e descartava o valor (nunca virou registro); (3) Salvar grava o
  rascunho inteiro → registro lançado por OUTRO responsável com o modal aberto era sobrescrito
  (lista colaborativa em save de documento inteiro → merge de 3 vias com o snapshot de abertura);
  (4) `undefined` no rascunho faz o RTDB recusar o objeto todo. painel-dev v3.101. **Lição**: handler
  `change` que re-renderiza no blur come o clique do botão seguinte (atualizar no lugar, não redesenhar);
  valor digitado e ainda não "adicionado" precisa ser registrado/confirmado no Salvar; save de
  documento inteiro precisa mesclar listas que mais de uma pessoa acrescenta.

- **2026-10-05, 📈 gráfico de evolução + ♾️ Perene + emoji do tipo (v3.102–3.104, pedido "roda um
  /monitorarbugs nisso tudo", horas depois de irem ao ar)**: 3 achados reproduzidos antes de corrigir.
  (1) apresentação mostrava o botão "Evolução" também pra Perene (abria painel sem gráfico) — o gate era
  `_okrAtingConfigurado` (tipo válido) em vez de "tem % de atingimento"; (2) dica por clique/toque nunca
  sumia em tela de toque (não há `mouseleave`) — toque em área vazia agora esconde; (3) "📈 Gráfico" do
  modal dependia de `_okrEditingObjId` e não abria em Objetivo sem id. Sem achado: fuzz de 600 casos
  (valores/datas estranhos + HTML hostil), 12 funções + bloco do gráfico idênticos nos 2 arquivos (teste de
  paridade). painel-dev v3.105. **Lição**: ao introduzir um tipo "especial" numa enumeração (Perene), grepar
  TODO lugar que testa "está configurado" e perguntar se a decisão ali é "tem tipo" ou "tem valor a mostrar";
  e todo tooltip por hover precisa de equivalente de toque (fechar ao tocar fora).

- **2026-10-06, toque no card no mobile (relato direto: "passo o dedo rápido na lista e abre um card")**: 1 achado
  real, técnica 3 + regressão de rework. `addTouchDnD()` (v8.30.739, duplo-toque contado no `touchend`) tratava todo gesto
  que não virou arrasto como toque simples — o `touchmove` só cancelava o long-press e nunca marcava "foi rolagem". A proteção
  que o navegador dava de graça (não gera `click` depois de scroll) se perdeu ao contar os toques à mão. Também abria o card
  ao tocar pra PARAR a inércia de um flick. Fix: `moved` (>10 px) + `ignoreTap` (toque até 160 ms depois do último `scroll`).
  Reproduzido em Chromium com toque emulado antes de corrigir (3 de 9 cenários falhavam). dev v8.30.787. **Lição**: ao
  substituir um evento nativo (`click`) por detecção manual (`touchstart/touchend`), listar tudo que o navegador filtrava
  sozinho — movimento, rolagem em curso, long-press — e reimplementar cada um; "toque" não é "touchend sem arrasto".

- **2026-10-06, OKR antes de reunião importante (apresentação)**: 1 achado real, técnica 1 (caminhos paralelos) —
  `okr-apresentacao.slide.html` ordenava Objetivos sempre por título, ignorando `ordem` manual que o painel respeita
  (`_okrObjetivosSorted`); grade, slides e "Próximo objetivo" saíam em ordem diferente da montada pro encontro. Fix: cópia da
  função do painel + `_okrGerenciaObjetivos`. Achado de layout (CORRIGIDO na 2ª passada do mesmo dia, piso de 30% pro rodapé em `_okrFitDetailSections`): no modal de detalhe, com
  >=14-16 marcos em tela 1366x768 (>=24 em 1920x1080) o rodapé (Progressos/Próximos passos/Riscos/Planos) encolhe via
  `_zoomFitToHeight` até ficar ilegível; mitigação: "Colapsar concluídos" / "Aparecer na apresentação" por Marco.

- **2026-10-06 (2ª), OKR pré-reunião — tags (painel-dev v3.108/3.109) (pedido "roda outro /monitorarbugs")**: 1 achado real, técnica 1
  (varrer o MESMO padrão de uma rodada antiga no código escrito depois dela). `_okrTagPickerHtml()` montava `onclick="…('${id}')"` e
  `<option value="${id}">` crus — XSS armazenado pela chave de `kanban/okr/tags` (a varredura de 05/10 já tinha convertido 332
  pontos, mas a feature de tags nasceu depois). Reproduzido no Chromium antes (JS rodou, `<img>` injetado). Fix: `jsq(id)`/`esc(id)`
  (+ `o.id` no seletor do Feed). Varredura automática de todo `on*="…${x}…"` sem `jsq/esc` em painel-dev e okr-apresentacao: só sobraram
  constantes. Sem achado: apresentação (tags só mostram `esc(label)`), filtro por tag, formulário de tag. Código morto reportado:
  `_okrTagApagar()` (sem UI pra apagar tag). painel-dev v3.110. **Lição**: depois de uma varredura em lote de uma classe de bug, a
  PRÓXIMA feature escrita já nasce com o padrão antigo — reexecutar o grep da classe a cada feature nova.

- **2026-10-06 (3ª), apresentação — colunas STATUS/PRAZO desalinhadas (relato direto do usuário na manhã da reunião)**: 1 achado real. `_zoomFitToHeight()`
  setava `align-self:start` antes de medir `targetW`; em `.d2-table-rows` (item de flex em COLUNA) o eixo cruzado é o horizontal, então a tabela
  encolhia pra largura do conteúdo e esse valor virava a largura "a manter" (767 vs 908px). Só dispara quando a tabela precisa encolher (≥14 Marcos
  em 1366x768), por isso "uns objetivos". Fix: medir a largura antes + cabeçalho com o mesmo zoom das linhas. **Lição**: `align-self` muda de eixo
  conforme a direção do flex pai — ao desligar esticamento, medir antes de mexer; e teste de alinhamento deve comparar coordenadas reais (cabeçalho × linha),
  não só "sem overflow" (o teste da rodada anterior passou com o bug presente).

- **2026-10-06 (4ª, "um último só pra garantir"), apresentação — botão Anterior + filtro por tag (#1202, código de minutos antes)**: 1 achado real, técnica 3
  (o que a tela promete vs. o que acontece ao vivo). `rebuild()` roda a cada atualização do Firebase e `_okrAtualizaFiltroTag()` refazia o `innerHTML` do
  `<select>` toda vez: dropdown aberto fechava no meio da escolha enquanto o time editava o painel. Reproduzido (nó `<option>` novo a cada rebuild) e corrigido
  com assinatura do conteúdo. Sem achado: Anterior/Próximo seguem a mesma lista filtrada/ordenada da grade, teclado no select, tag apagada, filtro sem resultado,
  barra superior em 1366/1024 px. **Lição**: todo controle que vive FORA da área que o rebuild redesenha (barra, filtros) e é preenchido por ele precisa de
  "só mexe no DOM se mudou" — senão o estado nativo (dropdown aberto, foco, seleção) se perde a cada evento ao vivo.

- **2026-10-06 (5ª), ordenação do kanban — por data e por movimentação (relato de usuários)**: 3 achados reais, reproduzidos no Chromium antes (6/6 cenários falhavam).
  (1) **severo, técnica 1/3** — `_lastFlowCol` é PERSISTIDO com o card, mas o Agente Ágil move cards no servidor (`moverColuna.js` atualiza col/flow/log) sem conhecer o campo; o client só o repunha
  quando vinha vazio, então um card movido pelo agente chegava com o valor velho e `recordMove()` ("from===toCol && enteredAt[toCol]") saía sem atualizar `enteredAt`/log ao arrastar de volta pra
  coluna antiga — não subia em "Movimentação", métricas de fluxo paradas; pra uma 3ª coluna, `from` errado no log. Fix: `_syncLastFlowCol()` repõe a partir de `card.col` do banco depois de toda sync.
  (2) `createdAt` (só o dia) — card sem data vinha primeiro, e empates do mesmo dia na ordem do array; fix: sem data no fim + desempate pela hora do id (`_cardIdTs()`). (3) Prazo com mesma data sem
  desempate; fix: prioridade. dev v8.30.788. "Data de criação" só ia do mais antigo pro mais novo (inverso de "Movimentação") — opção "mais recentes primeiro" adicionada a pedido (dev v8.30.789). **Lição**: campo de controle gravado junto com o dado
  e escrito por DOIS escritores (client e Cloud Function) só é confiável se o escritor que o desconhece for compensado na leitura — reidratar a partir da fonte de verdade a cada sync.


- **2026-10-06 (6ª), OKR — menu de contexto (⋯/clique direito) + modal rápido de atingimento (painel-dev v3.111, pedido "roda um /monitorarbugs nos okrs")**: 1 achado real, técnica 1/3 (o que o botão promete — 1 clique = 1 registro — vs. o que o código deixa acontecer com cliques repetidos). `_okrAtingQuickSalvar()` gera um id novo por chamada e não tinha trava durante a transação: duplo clique em "Registrar" ou Enter repetido gravava 2 registros iguais (+2 linhas de histórico, +2 notificações). Reproduzido com transação de 200 ms antes de corrigir (2 e 4 registros). Fix: `_okrAQBusy` + botão desabilitado. Sem achado: ações do menu que fecham o menu ao disparar (tag/status/apresentação/mover/arquivar — não repetem), gating de permissão igual ao do modal (menu só mais estrito), `_okrTx` com dado ausente, Esc em camadas (menu → modal rápido → gráfico), "Ver evolução" em Objetivo sem registros. painel-dev v3.112. **Lição**: todo botão que gera um id novo a cada chamada e grava de forma assíncrona precisa de trava "em andamento" — o clique repetido é o caso comum, não o raro.

- **2026-10-07, página própria do OKR (okr-dev.html/okr.html) + colar lista em checklist/"+ Add" (pedido genérico, "roda um /monitorarbugs" — área escolhida por prioridade 1: código escrito horas antes, nunca auditado)**: 3 achados na página nova + 1 no parser, todos reproduzidos antes de corrigir. (1) técnica 3 — `?okr=<id>` abria o Objetivo antes de ADMs/usuários chegarem; a permissão de editar é calculada UMA vez ao abrir o modal, então PO/Organizador/🎯 Gestor OKR/ADM extra via o modal sem 💾 Salvar mesmo depois (o link vem das notificações — caminho mais comum); o fake de teste instantâneo escondia isso, só apareceu ao atrasar a leitura de usuários em 500 ms. (2) técnica 3 — sair e entrar de novo com a mesma conta não reanexava os listeners (`_okrBootedUid` igual, e o RTDB cancela listeners ao perder acesso): agora recarrega ao sair. (3) leitura de título de card vinculado repetida a cada re-render (sem rastrear "em andamento"). (4) parser de colagem (kanban v8.30.794/painel v4.10): marcador de letra aceitava `A.` e comia iniciais de nome ("J. Silva enviou" → "Silva enviou"). dev okr v1.2. **Lição**: estado que é calculado UMA vez ao abrir uma tela (permissão, papel) precisa esperar os dados de que depende — e fake de Firebase instantâneo esconde corrida: testar também com leitura atrasada; e todo listener "1x por usuário" precisa de plano pro logout (RTDB cancela listeners sem acesso).

- **2026-10-07 (2ª), página própria do OKR — auditoria completa de ponta a ponta (pedido "audita mais essa nova página de okr")**: 2 achados reais, reproduzidos antes de corrigir; resto limpo com evidência. (1) técnica 3 — visualizador externo via as caixas de Anotações/Central Agente Ágil habilitadas: digitava, o campo limpava, a gravação era negada em silêncio (texto perdido); agora desabilitadas com explicação. (2) técnica 2 (comparar contra o painel) — o `visibilitychange` que renova usuários/retoma 1ª leitura falha não veio na extração (varredura por listeners globais NÃO-OKR do painel: 11 achados, só esse era relevante). Sem achado: ids de DOM (checagem automática), efeitos colaterais do painel não extraídos (21 declarações com "okr" fora da extração), regras dos 7 caminhos `kanban/okr`, notificações pra quem só usa o OKR, SW network-first, `?card=` do kanban, 390 px, CRUD completo ao vivo, pixel-diff painel×okr = 0 em 9 componentes × 3 temas. **Lição**: ao EXTRAIR código de uma página, além das funções, varrer os listeners globais (`document.addEventListener`) do original — comportamento "de graça" mora neles; e provar que a extração não perdeu CSS por pixel-diff do original contra a cópia, não por inspeção visual.

- **2026-10-07 (3ª), painel-dev v5.0 — a aba OKR virou redirecionador e o painel inteiro redirecionava sozinho (relato direto do usuário, minutos depois do deploy em dev)**: 1 achado severo, reproduzido antes de corrigir, regressão MINHA. `_restoreTab()` restaura a aba salva em `localStorage` (`_painel_tab`) 300 ms depois do `fb-ready`; quem usava a aba OKR tinha `okr` salvo → `swPtab('okr')` (agora navega) mandava o painel todo pra `okr-dev.html` a cada carregamento. Dois erros meus: (a) tinha registrado `_restoreTab()` como "código morto" em 2026-09-06 sem checar o `setTimeout(_restoreTab, 300)` no `fb-ready`; (b) o teste da v5.0 rodou em navegador limpo (sem estado salvo). Fix: descarta `okr` salvo. **Lição**: ao fazer uma função com efeito colateral GRANDE (navegar pra outra página) responder a um valor que o app já guarda e reaplica sozinho (`localStorage`, URL, preferência), grepar TODO caller automático dessa função (restauração, boot, listeners) — não só os cliques; e todo teste de uma mudança que mexe em estado persistido precisa de um cenário com o estado ANTIGO já salvo no navegador. E "achado incidental: código morto" só vale depois de grepar o NOME da função inteira, inclusive chamadas por `setTimeout`/eventos.

- **2026-10-07 (4ª), Torres do OKR + flag de torre + inscrição (pedido "roda um /monitorarbugs em tudo q temos hoje")**: 3 achados reais + 2 de infraestrutura de testes, reproduzidos antes de corrigir. (1) técnica 3 — filtro de período (`_okrFilter.trimestre`) sobrevivia à troca de torre: nova torre sem aquele período = lista vazia com o select em "Todos" (filtro invisível); okr-dev v2.1 (zera ao trocar + o escolhido entra sempre nas opções). (2) técnica 1 (todo consumidor de `objetivo.areaId` fora da página) — `functions/okr/dailyScan.js` mandava "reunião amanhã" do bloco quinzenal (Digital) pros responsáveis de Objetivos de Comercial/Corporativa (`'geral'` cai no bloco 1); agora pula `torre` ≠ digital (+2 testes, **requer deploy de `okrDailyScan`**). (3) técnica 1 do 05/10 reaplicada (grep de `u.nome` cru em `innerHTML`) — `renderOnline()`/`renderPainelOnline()` do painel injetavam o nome da presença como HTML: XSS armazenado reproduzido (2 execuções em `painel.html` de prod; 0 após `esc()` no dev v5.3); prod aguarda sinal verde. Infra: `atingimento.test.js` falhava desde a v5.0 do painel (lia o motor de `painel-dev.html`, de onde o OKR saiu — nenhum CI avisava) e comparava texto bruto (a extração dobrou linhas em branco); 2 testes do `dailyScan` dependiam da data real (falhavam na véspera de uma quinta de bloco). Sem achado: permissões por torre em todos os writers (`saveOkrObjetivo`/duplicar/arquivar/menu de contexto/marcos, todos atrás de `_okrCanEdit`), prompt de torre (relê usuários depois do cadastro), inscrição do kanban (só cadastro novo; "Primeira vez?" não pergunta; torre só em `usuarios`), seletor do Global Users (grava só `{torre}`). Pendente conhecido da fase 2 (não é bug novo): Agente Ágil `criar_objetivo` e snapshot semanal ainda não conhecem torre (objetivo criado pelo agente = Digital). **Lição**: ao introduzir um novo eixo (torre) num recurso que também é lido por Cloud Functions, grepar TODO consumidor server-side do campo vizinho (`areaId`) — o client já está certo e o backend continua tratando o eixo novo como "tudo é Digital"; e teste que lê código de uma página precisa ser revisto quando o código muda de página (falha silenciosa por semanas se ninguém roda a suíte).

- **2026-10-07 (5ª), Torres — filtros que sobrevivem à troca de contexto (pedido "roda outro", continuação direta da 4ª)**: 1 achado, técnica 1 (mesmo padrão do achado da rodada anterior em OUTRA tela): o filtro de gerência da tabela do 📈 Histórico (`_okrHistFiltro.area`) não era zerado em `_okrEntrarTorre()` — Digital/"CX" → Comercial deixava a tabela vazia com o select em "Todas" (okr-dev v2.2, reproduzido antes). Sem achado: gráfico/"Como cada Objetivo contribui" (`_okrHistMArea` já se autocura quando a gerência some). Observação registrada (não é bug): na visão global o Histórico agrupa por `areaId`, então o "Geral" das 3 torres aparece junto; snapshot semanal ainda não grava `torre` (Objetivo apagado volta pra Digital no histórico) — ambos da fase 2. **Lição**: ao achar "estado de filtro preso à lista de opções do contexto anterior" numa tela, procurar TODA outra tela com filtro que dependa do mesmo contexto (aqui: lista de Objetivos × Histórico) — e a regra é sempre "zerar ao trocar de contexto OU incluir o valor escolhido nas opções".

- **2026-10-07 (6ª), o que subiu hoje pra prod (painel v5.6/okr v2.6, regras de `usuarios`, apresentação) (pedido "roda um monitorarbugs no que subimos hoje")**: 1 achado de precaução + 1 lacuna reportada. (1) técnica 3/2 — a lista de visualizadores grava a chave com TODOS os pontos trocados por vírgula, mas as regras só trocam até 8 (limite documentado); e-mail com >8 pontos ficava autorizado e barrado em silêncio. Agora o "+ Visualizador" (OKR e painel) recusa com explicação — okr-dev v2.7/painel-dev v5.7; incerteza registrada: não consegui confirmar se `replace` das regras troca só a 1ª ocorrência (a premissa do repo) ou todas, então é precaução. (2) **lacuna, não corrigida (decisão de produto)**: `okr-apresentacao.slide.html` só tem login Google e só trata `@ciahering.com.br` como empresa — quem é `@arezzo.com.br` (Microsoft) não consegue abrir a apresentação, ao contrário de okr.html/kanban/painel (Integração Arezzo 2026-10-01). Sem achado: visualizador × todos os leitores de `kanban/usuarios` (okr-dev, painel-dev `loadGlobalUsers`/membros por squad, apresentação — admin-only os demais), "Online no OKR" do painel (escape de nome/foto, corte 30 s, relógio 10 s, sem escrita), botão 👁 (só ADM, ADM_EMAILS assíncrono re-aplicado a cada render), regras do visualizador (lê OKR/diretório público, não lê/escreve o resto — simulador 22/22). **Lição**: ao fechar uma leitura nas regras, listar TODOS os clientes (inclusive páginas compartilhadas sem cópia dev, como a apresentação) que liam aquele nó — foi o que evitou derrubar a apresentação do externo; e ao copiar um login de uma página pra outra, conferir quais PROVEDORES a cópia suporta.

- **2026-10-07 (7ª), relato direto: botão 👁 "não faz nada" em 👥 Global Users (painel v5.6, prod)**: 1 achado, reproduzido antes de corrigir, regressão MINHA da v5.5. O modal novo (`#viewers-ov`) abria, mas POR BAIXO do 👥 Global Users: ambos são `.cfg-ov` (`z-index:9100`) e o novo vem antes no HTML — empate de empilhamento resolvido pela ordem do DOM. O teste da v5.5 só checava `classList.contains('open')`, que passa com o modal invisível. Fix: `z-index:9200` (painel-dev v5.8); o teste agora confere que o campo de e-mail é o elemento do TOPO (`elementFromPoint`) — o OKR (`z-index:300`) foi checado nas 3 telas e estava certo. **Lição**: todo teste de "abre o modal" deve provar que ele está VISÍVEL e por cima (`elementFromPoint` num campo dele), não só que a classe `open` foi aplicada; e todo modal aberto a partir de OUTRO modal precisa de z-index maior que o do pai (ou vir depois dele no HTML) — grepar o z-index do pai antes de criar o filho.

- **2026-10-07 (8ª), Mural + sino + @menção do OKR (okr-dev v2.10, pedido "antes roda um /monitorarbugs", minutos depois de ir pro dev)**: 4 achados reais, reproduzidos antes de corrigir (5 de 6 cenários falhavam). (1) técnica 1/3 — "📢 Publicar" gera id novo a cada chamada e grava de forma assíncrona: duplo clique = 2 avisos + 2 eventos no sino (mesma lição de 2026-10-06 sobre `_okrAtingQuickSalvar`, esquecida ao escrever o botão novo); (2) técnica 2 — as outras janelas da página já fecham com Esc (capture + `stopPropagation`), as 3 camadas novas (publicar, aviso em destaque, sino) não: Esc não fechava e ainda chegava no modal de baixo; (3) técnica 1 — o evento "Objetivo criado" só saía de `saveOkrObjetivo()`; o outro caminho que cria Objetivo (`_okrDuplicarObjetivo()`) ficou de fora; (4) técnica 2 — o sino PRÓPRIO do painel nunca levou a lugar nenhum nas notificações `okr_*` (`okrObjId` descartado no mapeamento, mesma classe do achado de 2026-09-06 só no kanban). Sem achado: permissões por torre/papel, visibilidade por torre, popup (visto por pessoa), escape de HTML em título/corpo/nomes, externo sem escrita no Firebase, "lido" por item e "marcar tudo", parser de menção (nome completo, sem acento/caixa, consome o trecho). Reportado, não corrigido: Agente Ágil (servidor) cria Objetivo e conclui Marco sem gerar o evento do feed (fase 2, junto com torre/gerência); push de menção/aviso fora de `PUSH_TYPES`. okr-dev v2.11/painel-dev v5.10. **Lição**: ao escrever um botão que grava com id novo a cada clique, já nascer com a trava de "em andamento"; ao criar camadas novas (modal/popup/dropdown) numa página que tem handler de Esc por camada, registrar o dela na hora; e todo evento "X foi criado" precisa sair de TODOS os caminhos que criam X (grepar quem escreve o nó, não só o botão óbvio).

- **2026-10-07 (9ª), SINO ÚNICO — `mare-notif-dev.js` + sino do kanban/painel/OKR + feed + regras (pedido "notificações são sensíveis, roda um bom /monitorarbugs", horas depois de ir pro dev)**: 5 achados reais, reproduzidos antes de corrigir. (1) **severo, técnica 1** — `i.icon` do evento do feed entrava SEM `esc()` no sino do OKR (kanban/painel já escapavam): XSS armazenado por qualquer pessoa da empresa que grave em `kanban/notif_feed` — o mesmo erro que a rodada de 05/10 já tinha achado, repetido ao escrever o render novo; (2) `meetingLink` com `javascript:` aberto por `window.open()` (módulo novo + `openNotif()` do kanban); (3) técnica 2 — kanban aplica TTL (3 dias lida/30 não lida), OKR e painel não: o selo e a lista divergiam; (4) técnica 3 — "marcar tudo" avançava o watermark pra "agora" e comparava com o relógio de quem PUBLICOU: evento publicado antes do clique mas entregue depois nascia lido (control no teste: o comportamento antigo falha, o novo passa); (5) endurecimento — gravação do "lido" cortada pela navegação imediata. Sem achado: regras de `notificacoes`/`notif_feed` (OKR-only usuários escrevem pelo domínio), permissões por torre/papel no feed, escape de título/sub/autor nos 3 sinos, externo sem escrita, `_activeNotifsCache` do kanban intacto (só pessoais), ring/som, lembretes do painel (guarda própria roda de novo quando a lista de ADMs chega), `markAll` de kanban/painel não apagam o que não é do feed. Reportado, não corrigido: `kanban/notif_feed` nunca é podado (a leitura é limitada a 60, só cresce em disco); `painel_broadcast` clicado no OKR/painel abre o kanban sem abrir o Mural; Agente Ágil (servidor) ainda não publica no feed. okr-dev v2.13/painel-dev v5.12/kanban-dev v8.30.798-dev. **Lição**: ao escrever UM render novo de lista a partir de dados do banco, grepar na hora todo `${...}` dele sem `esc()` — o campo "decorativo" (ícone, cor, emoji) é onde a sanitização esquece; e todo "lido até agora" baseado em relógio precisa comparar relógios do MESMO lado (ids/ordem do servidor), nunca o relógio de quem publica com o de quem lê.

- **2026-10-07 (10ª), OKR — o que subiu depois da 9ª (rodapé do sino, push do Mural, presença de externos, ponto ao vivo do Dashboard, símbolos) (pedido "roda um /monitorarbugs principalmente em OKR")**: 3 achados reais, reproduzidos antes de corrigir. (1) técnica 3 — `MareNotif.novas()` (ding) roda no boot mas o Não Perturbe só carregava ao abrir o sino (`rodapeRender()`): no OKR o ding ignorava o modo ligado pelo kanban até o 1º clique no 🔔 (o painel renderiza o rodapé no boot e não tinha o bug); (2) técnica 2 (comparar o que o push alcança com o que as regras protegem) — `sendPushOnMural` enviava pra todo `usuarios_publicos` com push: freelancer/parceiro recebia o título de aviso interno do OKR (agora só domínio da empresa/ADM); (3) técnica 1 (todo consumidor de `client.url.includes('okr')`) — o clique no push reaproveitava a aba da apresentação (`okr-apresentacao.slide.html`) e a navegava pro OKR. Sem achado: ponto ao vivo do Dashboard (nada gravado, sem recursão em `_okrHistDatas`, arquivado/perene/sem registro fora, snapshot de hoje vale), presença de externos (`.validate` aceita o formato do heartbeat da empresa e do externo; XSS no nome escapado), rodapé (menu fixo, Esc em camadas), símbolos. Reportado, não corrigido: som de notificação na carga em conexão lenta (>3 s até a lista pessoal chegar) — o navegador bloqueia áudio sem gesto, então na prática não toca. okr-dev v2.20/painel-dev v5.17. **Lição**: ao escrever um push, comparar o público dele com a regra de leitura do dado que ele anuncia — a regra protege a leitura, não o push; e toda preferência que o som/aviso respeita (Não Perturbe) precisa estar carregada ANTES do primeiro disparo, não só quando a tela dela é aberta.

- **2026-10-07 (11ª), trava de edição do Objetivo (okr-dev v2.22) — achado pelo TESTE DE CONSOLE do usuário no Firebase real, não por rodada**: `closeOkrObjetivo()` chamava `_okrLockSoltar()` antes de zerar `_okrEditingObjId`; o `remove()` do RTDB dispara o `onValue` local **síncrono**, `_okrLockOnChange()` achou "Objetivo aberto + sem dono" e retomou a trava (heartbeat eterno). Corrigido com ordem (encerrar sessão → soltar) + flag `_okrLockSolto` + `pageshow`. **Lição**: fake de banco com ouvintes assíncronos esconde reentrância — o RTDB real notifica ouvintes locais dentro da própria escrita; todo teste de código que escreve e reage ao próprio eco precisa rodar com `__fireSync`. E: quem libera um recurso deve encerrar o estado que o reconciliador consulta ANTES de escrever a liberação.

- **2026-10-07 (12ª), calendário do OKR e o que mais foi feito no dia (okr-dev v2.31, pedido "vamos rodar um /monitorarbugs nos feitos de hj")**: 4 achados reais, reproduzidos no Chromium antes de corrigir. (1) **XSS armazenado** — `ev.torre` (do banco, gravável por qualquer pessoa da empresa) entrava cru em `class="…"` de itens/chips/pontos do calendário (mesma classe da varredura de 05/10, repetida no render novo); `_okrCalCls()` só aceita torre conhecida. (2) técnica 1 (todo consumidor de `okrEventoId`) — `urlDoPush()` só entendia `okrObjId`: o clique no push de reunião caía na home do OKR (agora `?evento=&data=`; **requer deploy de `sendPushOnNotification`**). (3) técnica 3 — excluir a "toda a série" estando numa ocorrência PASSADA não avisava convidados/sino (a condição era `data>=hoje`); agora usa a próxima ocorrência. (4) mudar de mês deixava `_okrCalSel` no mês antigo e o painel do dia dizia "Nada marcado". Sem achado: paridade `_okrCalOcorrencia*`↔`calendario.js`, `abrange`, dailyScan gatilho 3, regras de `acesso`, aviso ao excluir gerência, apresentação por torre, trava, cabeçalho. Reportado: anotações/vínculos de evento apagado ficam órfãos. **Lição**: depois de uma varredura em lote de uma classe de bug (XSS por `${}` em atributo), a PRÓXIMA feature já nasce com o padrão — e todo campo "decorativo" que vem do banco (torre, ícone, cor) entra em `class`/`style` sem esc; e quem adiciona um campo novo a uma notificação (`okrEventoId`) precisa grepar TODO roteador de URL (sino, painel, kanban, **push**), não só os de tela.

- **2026-10-07 (13ª), editor de eventos e diálogos do calendário (okr-dev v2.32, pedido "roda outro")**: 3 achados reais, reproduzidos com `__setDelay` (rede lenta) no Chromium. (1) técnica 3 — duplo clique em 💾 Salvar de evento NOVO criava 2 eventos + 2 avisos (id novo por chamada, sem trava; a 3ª vez que essa lição aparece: toda gravação assíncrona com id novo nasce com trava `_xSalvando`). (2) técnica 2 — Esc com `uiConfirm`/`_okrCalEscolha` aberto fechava o detalhe/editor por baixo e deixava o diálogo órfão (só o `<input>` do prompt tratava Esc); `_uiEscFecha()` na `window` em captura roda antes dos ouvintes de `document`. (3) salvar editor aberto sobre evento apagado por outra pessoa o ressuscitava como "novo" — `saveOkrEvento` agora recusa. Sem achado: `_okrGerNova` (a checagem de nome duplicado dentro da transação barra o 2º clique), `_okrEvdNotaAdd` (limpa o campo de forma síncrona), `_okrCalImportarBloco` (ids fixos, idempotente). **Lição**: diálogo empilhado precisa dono do Esc — registrar na `window` em captura, não no `document`, quando já existem ouvintes de Esc nas janelas de baixo; e teste de gravação sempre com latência simulada, o fake instantâneo esconde o clique repetido.

- **2026-10-08 (14ª), botão flutuante do Agente Ágil + o que subiu hoje (okr-dev v2.41, pedido "roda um /monitorarbugs" a partir de um print: o botão cobria o número da versão)**: 3 achados reais, 2 reproduzidos antes de corrigir. (1) o rótulo da versão (9 px, cinza) dividia o canto com o botão — a versão passou a aparecer também no menu ⋯ Mais, na Ajuda e no tooltip do botão (lugares que nada cobre); (2) técnica 3 — "💬 Perguntar ao Agente" (menu de contexto) com o modal do Objetivo aberto abria o painel POR BAIXO do modal: o painel morava dentro do `#app-root`, que é um contexto de empilhamento menor que o dos modais (z-index maior não resolve dentro dele) — moveu pro nível do body; (3) o botão podia esconder o fim da lista (folga de 6 rem). Sem achado: links em aba nova (chamada síncrona no clique, fallback se o popup for bloqueado), ocultar Objetivo da apresentação (todos os leitores usam `_okrObjetivosAtivos()`), filtro/histórico/menu, ajuda (busca, Esc em camadas), faixas das gerências. **Lição**: elemento `position:fixed` que precisa ficar acima/abaixo de modais tem de estar no MESMO contexto de empilhamento deles (checar onde o pai cria `z-index`/`transform`), e teste de "abre" precisa conferir QUEM está no topo (`elementFromPoint`), não só que abriu — mesma lição de 2026-10-07 (7ª), repetida ao escrever o painel novo.

- **2026-10-08 (15ª), edição do OKR no modal — Objetivo, ⚙ Configurações e Marco (okr-dev v2.42, pedido "roda um /monitorarbugs na edição de okr, no modal")**: 5 achados reais, todos reproduzidos no Chromium (banco com 300 ms de latência) antes de corrigir — 18 de 26 verificações falham no código da v2.41. (1) técnica 1/3 — duplo clique em 💾 Salvar de Objetivo/Marco NOVO criava 2 (id novo por chamada + gravação assíncrona; 4ª vez que a lição aparece) e, em Objetivo existente, duplicava a linha de histórico; trava `_okrSalvandoObj`/`_okrSalvandoMarco` + botão desabilitado + `catch` com aviso e restauro do `history`. (2) salvar item apagado por outra pessoa o ressuscitava (Marco novo sob Objetivo apagado virava órfão) — agora recusa. (3) **técnica 4 (undefined × valor padrão do formulário)** — o dirty-check comparava JSON cru: todo Marco sem `mostrarApresentacao`/responsável/descrição (anteriores ao botão 🎬, do Agente ou duplicados) e todo Objetivo aberto na ⚙ Config acusava "alterações não salvas" sem a pessoa mexer em nada; `_okrDirtyStr()` normaliza os dois lados. (4) técnica 1 (todo re-render ASSÍNCRONO do corpo do modal) — comentários do Marco chegando, listeners de tags/gerências e reordenar Marcos redesenhavam sem sincronizar o rascunho: título/pilar/nome/descrição digitados sumiam sozinhos (`_okrRerenderObjModalSync()` + sync nos 4 pontos). (5) Esc não fechava o modal de edição (única janela da página sem Esc): keydown em BORBULHA + `defaultPrevented`, pra camadas de cima (captura + stopPropagation) e a edição de item da lista (preventDefault) continuarem na frente. Sem achado: trava de edição (heartbeat/RO/pedir), `_okrListEditStart`/`_okrChecklistEditStart` (Esc cancela sem perder campos-irmãos), `_okrPessoaAdd/Remove`, tags no rascunho, `_okrSyncObjDraftHistory`, `openOkrConfig`/`closeOkrConfigBack`. Com o modal aberto o botão do sino/Agente não alcançam outro Objetivo (nada abre um 2º rascunho por cima do sujo). **Lição**: dirty-check por JSON cru contra um formulário que devolve `''`/`true` onde o dado antigo não tem o campo é falso-positivo garantido em dado legado — normalizar os dois lados e testar com dado ANTIGO, não só com o recém-criado; e todo `.then()` que re-renderiza um modal precisa sincronizar o rascunho antes, não só os handlers de clique.

- **2026-10-08 (16ª), modo "só Hering" — Arezzo/Microsoft, torres e menção desligados por interruptor (kanban-dev v8.30.803, painel-dev v5.22, okr-dev v2.44, funções; pedido "roda um /monitorarbugs pra ver se n excluiu coisas demais ou esqueceu de algo")**: 3 achados reais, 2 reproduzidos antes de corrigir. (1) técnica 1 (todo consumidor da MESMA flag em outro arquivo) — `pushMural.deveReceber()` ainda lia `usuarios/{uid}/torre` cru: no modo só Hering o sino (cliente) já tratava todo mundo como Digital, mas o push (servidor) não — pessoa com a flag antiga `comercial` via o aviso e nunca recebia o push; (2) técnica 3 — `_loginProviderMismatchMsg()` mandava conta `@arezzo` entrando pelo Google pro botão "Entrar com Microsoft", escondido pelo próprio interruptor (3 páginas); (3) técnica 4 — o filtro de torre inativa escondia QUALQUER valor fora de `digital` (inclusive torre desconhecida/corrompida, que antes valia como Digital); agora só some o que é de Comercial/Corporativa de verdade. Sem achado: Agente (`editar_marco` por `marco_id` de Objetivo oculto é barrado pela checagem do Objetivo), `resumoGeral` do Histórico (recontado), Marcos de Objetivo oculto no Calendário/Histórico, `paraMim()` do sino, religar (suítes antigas passam com os interruptores virados). **Lição**: ao colocar um comportamento atrás de interruptor, grepar TODOS os consumidores do dado que o interruptor reinterpreta (aqui, o campo `torre` da pessoa lido no cliente E no servidor) — o lado que o autor testou fica certo e o espelho do outro lado continua com a regra antiga; e mensagens de erro/ajuda que apontam pra um controle (botão) precisam respeitar o mesmo interruptor que esconde o controle.

- **2026-10-09, apresentação do OKR/Radar (`okr-apresentacao.slide.html`) antes de uma reunião (pedido explícito, "roda um /monitorarbugs na apresentação, tem reunião hoje")**: 6 achados reais, reproduzidos no Chromium nos 2 modos do interruptor antes de corrigir. (1) técnica 2/3 — o filtro de tag contava Objetivos de torres escondidas no modo só Hering (tag fantasma + "(3)" que mostrava 2) e ignorava o filtro de torre; agora usa `_okrObjetivosAtivos(false,true)`; (2) rebuild ao vivo voltava pra capa quando o slide atual sumia; agora fica na posição; (3) visualizador externo digitava anotação e perdia (regras negam; mesmo achado de 2026-10-07 no okr-dev, esquecido na cópia); (4) falha de gravação da anotação apagava o texto; (5) renumeração ao colapsar concluídos; (6) torre única sem ícone deixava recuo. Sem achado: teclado/Esc em camadas/Anterior-Próximo/ocultos. **Lição**: ao corrigir um achado numa página, grepar o MESMO comportamento nas páginas irmãs/cópias (aqui, visualizador × escrita já corrigido no okr-dev e esquecido na apresentação); e contador de filtro precisa contar o mesmo universo que a tela mostra, não o banco inteiro.

Atualize esta seção a cada rodada nova (1-3 linhas: área, achados,
versão/PR) — o objetivo é não reanalisar do zero uma área já varrida,
não preservar a narrativa completa de cada investigação.
