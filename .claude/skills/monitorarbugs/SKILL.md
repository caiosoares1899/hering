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

Atualize esta seção a cada rodada nova (1-3 linhas: área, achados,
versão/PR) — o objetivo é não reanalisar do zero uma área já varrida,
não preservar a narrativa completa de cada investigação.
