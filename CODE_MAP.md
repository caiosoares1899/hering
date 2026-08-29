# Mapa do código

Índice de âncoras (funções/consts) por área funcional, pra achar código rápido
nos arquivos grandes deste repo (`kanban.html`/`kanban-dev.html` têm ~28.2k
linhas / até ~1.1MB) sem precisar ler o arquivo inteiro.

**Como usar:** os números de linha abaixo são um retrato de um commit
específico (ver rodapé) e ficam desatualizados a cada edição no arquivo —
**sempre confirme com `grep -n "nomeDaFuncao" arquivo.html` antes de confiar
neles pra uma edição**. O valor real deste arquivo é a lista de nomes
(âncoras estáveis), não os números de linha em si.

`kanban.html` e `kanban-dev.html` estão hoje byte-idênticos exceto 2
linhas (string de versão + `VERSION_KEY`) — os números abaixo valem pros
dois (retrato deste rodapé: promoção da v8.30.487 confirmada, ver
`CHANGELOG.md`). Isso pode mudar a qualquer momento que uma feature nova
entrar em dev antes de ir pra prod (ver "Release process" no
`CLAUDE.md`) — se os tamanhos dos arquivos divergirem, refaça o grep no
arquivo específico que você está editando.
`painel.html`/`painel-dev.html` **divergem de verdade** (dev tem
instrumentação extra) — os números da seção painel abaixo são de
`painel.html` (prod).

## kanban.html / kanban-dev.html

### Papéis & autenticação
- `ADM_EMAILS` (let) — L5743
- `getEffectiveRole()` — L5781 — papel efetivo, ADMs hardcoded não são rebaixáveis
- `loadSquadsFromFirebase()` / `SQUAD_META_LIVE` — L5860 / L5829
- `resolveSquadAndShow()` — L8947 — resolve squad da URL, decide o que mostrar
- `autoRegistrar()` — L9100 — cria/atualiza o doc do usuário no login

### Card — estrutura & modal
- `CARD_SECTIONS` — L6257 — seções do modal (Conteúdo, Vínculos, Colaboração...)
- `openCard()` — L11255
- `openAgenteHotline()` — L11181 — card especial fixo por squad "🤖 Converse
  com o Agente Ágil" (`AGENTE_AGIL_HOTLINE_SQUADS` — L5813, hoje `dev`/
  `dados`, os únicos com escrita real do agente), pra pedido solto que não
  precisa ficar ligado a um card real. É um card de VERDADE no Firebase
  (`agenteHotline:true`, criado sob demanda por `fbCreateCard`, achado via
  `_findAgenteHotlineCard()`) — reusa 100% do mecanismo de `@menção`
  existente, só some do board normal (filtro em `renderBoard()`'s
  `activeCards`) e o modal ganha tema cinza/robô + atalhos
  (`_applyAgenteHotlineSkin()` — L11157, chamado por `openCard()`/
  `openNewCard()`). `_cardSectionVisible()` esconde toda seção exceto
  comentários pra esse card. Botão de acesso: `#fab-agente-hotline-btn`,
  visível pra todo mundo (não só PO/Organizador) nos squads habilitados —
  ver `_applyRoleVisibility()`. Guard equivalente no backend:
  `functions/agente-agil-orquestrador/systemPrompt.js` (seção "Card
  especial") instrui o modelo a nunca chamar mover_coluna/editar_campos/
  checklist_item/agent_status nesse card, reconhecendo-o só pelo título.
  Modal do card hotline esconde TUDO exceto a seção de comentários (título,
  grid de atributos, conteúdo/vínculos, meta, histórico, extras de
  header/rodapé — via CSS `#card-ov.agente-hotline`, não só
  `_cardSectionVisible()`) e tem tema robô/terminal (fonte monoespaçada do
  sistema). `refreshAgenteHotline()` — logo abaixo de `openAgenteHotline()`
  — botão "🔄 Limpar conversa": apaga `card_comments/{cardId}` inteiro
  (com confirmação nativa, irreversível), já que o card é compartilhado
  entre qualquer pessoa e acumula assuntos sem relação com o tempo.
  `#m-agente-hotline-info` — bloco explicando o que o card faz + aviso de
  que cada mensagem processada consome tokens pagos (uso com moderação),
  toggled junto no mesmo `_applyAgenteHotlineSkin()`. Colapsável via
  `toggleAgenteHotlineInfo()` — mesmo padrão de `toggleHistory()`.
  Comentário já abre com `@Agente Ágil ` pré-preenchido (dentro do
  `setTimeout()` de `openCard()`, logo depois de `initMentionDropdown(
  'm-comment-inp')`, só se o campo ainda estiver vazio).
  `_attachAgenteHotlineCommentsListener()`/
  `_detachAgenteHotlineCommentsListener()` — logo acima de
  `toggleAgenteHotlineInfo()` — listener ao vivo (`window._onValue`) nos
  comentários desse card específico, pra resposta do agente aparecer sem
  sair/voltar do card (`loadComments()` normal é leitura pontual, não
  serviria); detach chamado em `_finishCloseOv()` e toda vez que
  `openCard()`/`openNewCard()` abre outro card. Comentários do card
  hotline têm tema visual de terminal (fundo escuro, mensagem do agente
  em verde vs. humana em ciano — classes `comment-agent`/`comment-human`
  em `renderCommentList()`, estilo em `#card-ov.agente-hotline`).
  Achado real 2026-08-26 (skill `/monitorarbugs`): `renderBoard()` excluía
  o card hotline dos cards ativos, mas outras 4 agregações/buscas de
  "todos os cards" não tinham essa mesma exclusão (`!c.agenteHotline`) —
  corrigido em `renderBoardDataGrid()`/`renderBoardDataInsights()`/
  `_boardDataBarChart()` (painel "📊 Dados do Board") e nas 3 buscas de
  card (`@card:` em comentários/descrição, `notaSearchCards()`,
  `searchSuperChildren()`). Qualquer nova agregação "todos os cards"
  precisa lembrar dessa exclusão também. 2ª rodada, 2026-08-28: achado o
  mesmo gap em `renderMeuDia()` (painel "🌅 Meu Dia", ver linha abaixo) —
  não tinha passado pela varredura original porque usa `_meuDiaAllCards()`
  em vez de um `cards.filter(...)` direto (não pega num grep simples do
  padrão). Hoje não é explorável pela UI normal (o card hotline nasce com
  `owner`/`participants` sempre vazios, e o modal trava a edição desses
  campos pra ele), mas ficava inconsistente com a regra escrita acima.
- `saveCard()` — L11689 — auto-save (debounce 800ms) passa por aqui
- `_finishCloseOv()` — L26003 — fechamento do modal, reset de estado pendente
- `_newCardHasContent()`/`_newCardGuardOff` — L10571/L10545 — card ainda sem
  `editingId` (criação em andamento): se título/descrição/tags/checklist/
  riscos/PO/comentário têm algo preenchido, `closeOv('card-ov')` avisa
  antes de descartar (fora, Cancelar, ✕, arrastar no mobile — os 4 já
  passavam por `closeOv`). Não conta responsável/coluna/prazo, que vêm
  com valor padrão só de abrir o modal. `_newCardGuardOff` desarma o
  aviso nos 2 pontos em que o fechamento é legítimo mesmo com
  `editingId` ainda null (sucesso de `saveCard()`, e o fechamento do
  modal reaproveitado pra editar item de Recorrente/Modelo/Agendamento)

### Escrita de card no Firebase — 3 primitivas (não intercambiáveis)
- `fbSaveAll()` — L7461 — reescreve `/cards` INTEIRO (só pra operações
  estruturais em lote: duplicar/arquivar em massa, reordenar, importar,
  recorrências/agendamentos) — **nunca usar pra 1 card só**, arrisca
  sobrescrever o array com o estado local de outra pessoa
- `fbCreateCard()` — L7593 — cria 1 card NOVO com escrita pontual,
  posição alocada via `transaction()` no `cards_index` (atômico contra
  criações concorrentes) — achado real 2026-08-24 (squad
  `midiacriativa`, "cards sumindo"): `fbSaveAll()` na criação
  colidia com o mesmo tipo de ação concorrente e apagava cards de
  outras pessoas. Usar sempre pra criar 1 card (modal, duplicar, filho
  de supercard, fan-out)
- `fbSaveCard()` — L7646 — edita 1 card EXISTENTE, escrita pontual
  (usada por drag-and-drop, autosave, etc.)

### Rede de segurança — detecção ao vivo de card sumido inesperadamente
- `_reportUnexpectedCardDisappearance()` — L7633 — dispara toast +
  `console.error` + grava `cards_incidentes_sumico/{incId}` quando um id
  some de `/cards_index` sem ter passado por `cards_deleted_intentionally`
  — "ponto 2" da rede de segurança pras ~46 chamadas de `fbSaveAll()` que
  ainda reescrevem o array inteiro (fora do escopo do fix de
  `fbCreateCard()` acima, que só cobre a CRIAÇÃO de 1 card). Não recupera
  o card — só avisa na hora, em vez de descobrir dias depois.
- `_intentionalDeleteIds` (Set) — populado por um listener `onChildAdded`
  em `cards_deleted_intentionally` — grep `_delRef` dentro de `fbLoadAll()`
  pra achar o listener; o `onChildRemoved` de `/cards_index` (mesmo escopo,
  grep `window._onChildRemoved(_idxRef`) faz um debounce de ~3s checando
  esse Set antes de chamar `_reportUnexpectedCardDisappearance()`
- Os 5 pontos reais de exclusão gravam `cards_deleted_intentionally/{id}:
  true` como `extra` na MESMA chamada `fbSaveAll()` que já fazem —
  `bulkDeleteSelected()`, `deleteCard()`, `excluirArquivado()`,
  `ctxDelete()`, e a limpeza de filhos órfãos em `_finishCloseOv()`. Grep o
  nome da função + `cards_deleted_intentionally` pra achar a linha atual
  de cada um — não repetido aqui pra não ficar obsoleto a cada edição
  nessas funções.

### Board & render
- `renderNormal()` — L9703
- `renderRaiaOwner()` — L9761
- `renderRaiaTag()` — L9812
- `toggleRaia()` — L10091
- `passesFilter()` — L10048
- `handleDragStart/End/Over/Leave()` — L24117/L24128/L24139/L24167
- `addTouchDnD()` — L24305 — drag-and-drop por toque (mobile)

### Busca (Ctrl+K + "Ver no board")
- `openSearch()` — L26521
- `renderSearchResults()` — L26533
- `verNoBoardFromSearch()` — L26600
- `_scheduleTextFilterApply()` — L10001 — debounce do filtro `#f-texto`

### Checklist (com grupos colapsáveis)
- `renderCL()` — L12169
- `_clGroupsInit()` — L12134
- `toggleChecklistGroupCollapse()` — L12147

### Campanhas (`openCamp()`, botão "📣 Campanhas")
- `renderCampDashboard()` — L17089 — aba "📊 Dados de Produção" do detalhe
  de campanha, alimentada por `window._campVinculados` (cards com a(s)
  tag(s) da campanha — setado em `renderCampDetalhe()`). Checkbox "🧩
  Incluir supercards" (estado em `window._campDashIncludeSuper`, não no
  DOM — o corpo inteiro é `innerHTML=` a cada render) — mesmo padrão já
  usado em `renderCriativosDashboard()`/`crv-df-supercard-incluir`
  (Controle de Criativos, também sem seção própria neste mapa ainda).
- (Seção nunca indexada antes — só a âncora tocada nesta rodada foi
  adicionada; o resto de `openCamp()`/`renderCampDetalhe()`/etc. ainda
  não tem entrada própria aqui.)

### Supercards / Ficha Técnica
- `_crvAutoTitle()` — L12599 — título automático do filho a partir da Ficha Técnica
- `searchSuperChildren()` — L21648 — busca de cards existentes ao criar um filho
- `_mergeModeloEmCardObj()` — L24663
- `_applyFanoutTemplate()` — L24632 — cria os filhos de uma receita de fan-out
- Nesting de 2 níveis (campanha → criativo → versão): `editingSuperParentIsChild`
  (global, L21404) + `initSuperChildren()` — L21424 — calcula se o card
  aberto já seria uma "versão" (teto real do 2º nível)
- `_crvOwnSummary()` — L21519 — resumo dos campos próprios do criativo,
  usado no card de versão (2º nível)
- `_checkSupercardAutoComplete()` — L25172 — conclui o supercard sozinho
  quando todos os filhos ativos chegam numa coluna de fim; cascateia
  filho→pai→avô recursivamente. `_isColCancelLike()` — L25158, logo acima —
  se TODOS os filhos ativos terminaram cancelados, o pai NÃO conclui
  sozinho, fica onde está
- `_duplicarComFilhos()` — L12046 — duplicar um supercard com opção de
  duplicar os filhos junto (checkbox opt-in no modal de duplicar, só
  aparece se `_cardIsSupercard()`). Recursivo (cobre netos, 3 níveis
  campanha→criativo→versão), religa `childCardIds` pros ids NOVOS, filhos
  mantêm a própria coluna (não herdam `opts.col` do card raiz), filhos
  arquivados ficam de fora, `visited` protege contra ciclo corrompido nos
  dados

### Card lock / "Pedir o card"
- `CARD_LOCK_REQUEST_GRACE_MS` — L10656
- `_cardLockRequestPath()` — L10663
- `pedirCard()` — L10673
- `liberarCardAgora()` — L10687
- `_renderLockRequestUI()` — L10691
- `_handleLockRequest()` — L10726

### Notificações in-app
- `createNotif()` — L21808
- `loadNotifs()` — L22069
- `checkDueNotifs()` — L22461 — due_today/due_overdue, 1x/dia

### Notas
- `toggleNotas()` — L14718, `setNotasScope()` — L14731
- `renderNotasList()` — L14766, `createNota()` — L14798
- `openNota()`/`closeNotaEditor()` — L14814/L14815
- `renderNotaEditor()` — L15078, `toggleNotaModo()` — L15376 (livre/estruturado)
- `renderNotaLinkedCards()` — L14841, `notaSearchCards()`/`notaAddCardLink()`/`notaRemoveCardLink()` — L14859/L14884/L14893
- `renderNotasVinculadasNoCard()` — L14913 — seção "Vínculos" dentro do card

### Automações (Butler-style)
- `AUTO_TRIGGERS` — L24778 (20 triggers)
- `AUTO_ACTIONS` — L24846 (14 ações)
- `runAutoRules()` — L25232 — só decide QUAIS regras batem (síncrono);
  `_runAutoRuleAction()`/`AUTO_RULE_DELAY_MS` (logo acima) aplicam o efeito
  de verdade depois de ~1.2s (pedido direto: dar um respiro visual antes do
  efeito da automação, e mostrar toast "⚡ Automação ... foi aplicada" —
  antes era instantâneo e silencioso) — re-busca o card no momento de
  aplicar (guarda contra card excluído/arquivado durante o delay)
- `_autoTrigger()`/`_autoAction()` — L24933/L24934
- `_autoValLabel()`/`_autoRenderValueOptions()` — L24937/L24959
- **Acesso à tela de Automações** (achado real 2026-08-24: só existia via
  `⚙ Configurações → aba ⚡ Auto`, e o botão de Configurações fica
  escondido de quem não é PO/Organizador/ADM — `_applyRoleVisibility()`,
  L9091 — mesmo sem nenhuma trava de permissão nas ações em si) —
  `openAutoOv()` — L18785 — abre o overlay `#auto-ov` (fora de `#cfg-ov`), acessível
  tanto por um atalho em ⚡ Funções de card (`#card-fn-ov`, visível pra
  qualquer papel) quanto pela aba "⚡ Auto" em Configurações (que virou
  um redirecionamento pro mesmo overlay, não mais uma aba inline)
- `fanoutTemplates` — receitas de fan-out (supercard); `renderFanoutCfg()`
  edita, incluindo o campo `tags` por receita (`setFanoutTags()`) usado só
  pra filtrar no dropdown abaixo — não afeta os cards gerados
- `toggleFanoutApplyMenu()`/`_renderFanoutApplyList()` — dropdown "🧩
  Aplicar receita" dentro do card, com filtro por nome+tag (mesmo padrão
  de "📥 Usar modelo"/`_renderUsarModeloList()`)
- **Fila de Automações pendentes do Agente Ágil** (2026-08-29, achado real
  `/monitorarbugs`: AUTO_TRIGGERS só existe aqui no cliente — uma mutação
  do orquestrador via Admin SDK, ex. `mover_coluna`, nunca disparava
  nenhuma Automação). Backend enfileira em `kanban/squads/{squad}/dados/
  agente_pending_auto` (ver `enqueuePendingAutoFromDiff()` em
  `functions/agente-agil-orquestrador/pendingAuto.js`, chamado de dentro
  de `runWritePlan()` em `tools/realHandlers.js`) — cliente escuta com
  `window._onChildAdded` (L8816) e reivindica cada entrada via
  `window._runTransaction()` antes de processar, garantindo exatamente 1
  disparo mesmo com várias pessoas com o board aberto ao mesmo tempo.
  `_claimPendingAuto()` — L25437 / `_refreshCardFromFirebase()` — L25455
  (força `cards` a refletir o estado mais recente do card antes de rodar
  `runAutoRules()`, já que a sincronização granular normal tem debounce de
  150ms e correria o risco de ler/resalvar um snapshot desatualizado por
  cima da própria mudança que disparou o evento). `criar_card` não
  precisa desse mecanismo — nunca cria card direto, só um rascunho em
  `intake_pending` que um humano confirma pelo modal normal (mesmo
  `saveCard()` que já dispara tudo certo).

### Impedimentos (modo coluna vs. tag)
- `blockerMode` (let) — L25291 — carregado de `config/blockerMode`, `'col'`
  (default) ou `'tag'`
- `_cardIsBlocked(card)` — L25301 — fonte única de verdade pro "está
  impedido?": modo `col` → `card.col==='blocker'`; modo `tag` →
  `!!card.blocker` (ignora o campo que não é da modalidade ativa)
- `saveBlockerMode(mode)` — L25306 — acionado em ⚙ Configurações →
  Impedimentos. Achado real 2026-08-26 (squad `midiacriativa`, incidente
  em produção — 64 cards sumidos do board): agora valida ANTES de trocar
  pra `'col'` se existe uma coluna com id `blocker`; se não existir,
  bloqueia a troca com aviso em vez de deixar a squad num estado onde
  cards já impedidos ficam invisíveis
- `ctxMove(colId)`/`ctxBlock()` — L25572/L25599 — `ctxBlock()` é só
  `ctxMove('blocker')`. Mesmo incidente: `ctxMove()` agora aborta com
  aviso se `colId` não bater com nenhuma coluna existente, em vez de
  gravar um `card.col` órfão — `renderNormal()` só mostra um card na
  coluna cujo id bate exatamente com `card.col`, então um id órfão faz o
  card sumir do board inteiro, intacto mas invisível (achável só via
  painel)
- `_doBulkBlockCol()`/`_doBulkUnblockCol(colId)` — L6703/L6720 —
  versões em massa do mesmo par; `_doBulkBlockCol()` ganhou o mesmo
  guard de existência da coluna
- `delColumn(i)` — L18904 — editor de colunas em ⚙ Configurações.
  Bloqueia incondicionalmente excluir a coluna com id `blocker` (não só
  quando `blockerMode==='col'` — cards antigos podem carregar esse id
  independente do modo atual da squad; excluir a coluna em modo `tag` e
  só voltar pra `col` depois já causou o incidente uma 2ª vez)
- Ação de Automação "Mover card para coluna" (`AUTO_ACTIONS`, ver seção
  Automações acima) tem o mesmo guard de existência de coluna
- `_meuDiaIsBlocked(card)` — L17308 (dentro da seção "Meu Dia", ver
  `renderMeuDia()`/`_meuDiaCrossData` acima) — achado real 2026-08-28
  (`/monitorarbugs`): checava `card.blocker===true || card.col==='blocker'`
  incondicionalmente, dando falso-positivo pra squads em modo `col` com
  cards que ainda carregavam `blocker:true` de um período anterior em modo
  `tag`. Agora despacha por `blockerMode` de cada squad (ativo via
  `blockerMode` live; cruzado via `_meuDiaCrossData[sq].blockerMode`, que
  vem de graça do mesmo fetch de `/dados` que já trazia `doneCols`) —
  mesmo padrão de `_cardIsBlocked()`/`_meuDiaIsDone()`

### Agente Ágil (client-side — atalhos que postam @menção real)
- `AGENTE_AGIL_MENTION_SQUADS` — L6349 — squads onde os atalhos abaixo
  estão ativos: `'dev'` e `'dados'` (2026-08-24) — precisa ter uma Cloud
  Function de verdade escutando o squad (ver seção `agente-agil-
  orquestrador/` abaixo), senão a sugestão aparece sem nada escutando
- `_askAgenteAgilNoCard(card, pergunta)` — L6363 — posta
  `@Agente Ágil <pergunta>` como comentário real do card, mesmo pipeline
  do `@menção` manual (`functions/agente-agil-orquestrador/mentionTrigger.js`)
- `insightsCard()` — L14038 — botão "🤖 Insights" no rodapé do card
- `ctxInsights()` — L25631 — opção "Insights" no menu de contexto do card
- `_pedirResumoMeuDia()` — L17371 — botão "🤖 Resumo do Agente Ágil"
  dentro do painel "🌅 Meu Dia" (`openMeuDia()` L17281/`renderMeuDia()`
  L17307) — chama `agenteAgilResumoMeuDia` (onRequest, ver seção
  `agente-agil-orquestrador/` abaixo) com `Bearer <idToken>`, mostra o
  texto retornado numa caixinha (`#meudia-resumo-box`). Único ponto do
  Agente Ágil que NÃO escreve nada no board — só lê e mostra texto
- Painel de chat antigo (`openAgent()`/`qa()`, `AGENTE_AGIL_ATIVO`) — os 2
  botões de entrada (FAB, nav mobile) foram removidos de vez (2026-08-25,
  pedido direto do usuário — "já morreu"), já que dependia de um Worker
  externo fora do ar. `openAgent()`/`#ag-ov`/`AGENTE_AGIL_ATIVO` seguem no
  arquivo (inacessíveis pela UI agora) por causa dos outros 2 pontos que
  ainda chamam `openAgent()` sem card real (AutoLab, alerta de WIP
  excedido) — não removidos nesta rodada, fora do escopo pedido
- `renderAgenteLog()` — L18862 — aba "🤖 Histórico do Agente" em
  ⚙ Configurações (pedido direto: "quero uma area q guarde todas as
  alterações nos cards que ele faça naquela squad, para servir de
  historico para o PO"). Leitura pontual (`window._get`, não um listener
  ao vivo) de `FB+'/agente_log'`, escrito pelo backend em
  `functions/agente-agil-orquestrador/agenteLog.js` (ver seção
  `agente-agil-orquestrador/` abaixo) — cada entrada já vem com `origem`
  (`mencao`/`automacao`/`especialista`, 2026-08-27 — antes disso só
  `autonomous` binário, achado real via `/monitorarbugs` no mesmo dia
  que `especialista` passou a existir: exibia "pediu via menção" pra
  ações vindas de especialista externo) e a lista de ações em português
  simples. Aba só aparece pra squads com escrita real do orquestrador
  (`AGENTE_AGIL_MENTION_SQUADS`, gate em `openCfg()` — L18809);
  Configurações inteiro já é PO/Organizador/ADM-only (`#fab-cfg-btn`, ver
  `_applyRoleVisibility()`), não precisa de
  gate de papel próprio aqui.

### Externos / segurança
- `_extKey()` — L27999 — chave de e-mail sanitizada (`.` → `,`)
- `salvarExterno()` — L28000

### Intake (pedidos pendentes — formulário público E `criar_card` do Agente Ágil)
- `renderIntakeBody()` — L17457 — lista de `intakePendentes`
  (`_intakeBucket`, alimentado por listeners granulares em
  `intake_pending`, ver comentário na declaração). 2026-08-27: mostra
  `🤖` no título + linha "🏷 Submarca sugerida" quando o item veio do
  `criar_card` do Agente Ágil (campos `origem`/`submarca`, ver
  `functions/agente-agil-orquestrador/tools/criarCard.js`) — antes
  desses campos existirem, a tela só sabia renderizar pedidos do
  formulário público.
- `_intakeCriarCard(id)` — L17479 — abre o modal de novo card pré-
  preenchido; casa `squadDemandante` E (2026-08-27) `submarca` contra
  tags reais por label (case/acento-insensitive, `_norm()`), pré-
  marcando a tag — mesmo cuidado do bugfix de "usar modelo" (saveCard()
  valida submarca lendo o VALOR do `<select id="m-submarca">`, não
  `editingTags`, então os dois precisam ser setados).

### Backup
- `exportBackupJSON()` — L28101
- `maybeSnapshot()` — L10327
- `_applyRestorePayload(payload)` — L28746 — "🧯 Restaurar backup". Achado
  real 2026-08-28 (squad midiacriativa, `/monitorarbugs`): era a ÚNICA
  atribuição de `cards`/`columns`/`tags` a partir de dado externo no
  arquivo sem `.filter(Boolean)` (as 6 outras, todas `fbListen`/`fbGet` de
  `/columns`, filtram) — um backup com entrada nula em `columns` (ex.: o
  `weeklyBackup.js` abaixo, que lia o node cru via Admin SDK) propagava a
  sujeira pro estado ao vivo, travando `renderNormal()`/`renderColEditor()`
  (`col.name`/`col.id` de undefined). Agora normaliza igual ao client
  (`Array.isArray?:Object.values`, depois `filter(Boolean)`)

### Marcadores `// --- X ---` já existentes no código
Só existem para um subconjunto pequeno de áreas — não é uma convenção
aplicada no arquivo inteiro, não confie neles como única forma de navegar:
- L18797 Ágil, L18882 Col editor, L18940 Usuários, L19125 Tags,
  L19495 "Worker / Firebase" (nome do comentário é antigo — hoje é
  config/legado de Firebase, **não** tem relação com o Cloudflare Worker,
  que não existe mais na arquitetura atual)
- L24047 D&D das colunas, L24116 D&D dos cards

## painel.html (prod — painel-dev.html diverge, confira com `diff` antes de assumir paridade)

### Visualizador externo (2026-08-27, promovido pra prod 2026-08-28 — presente nos dois arquivos)
- `_finishPainelLogin(user)`/`_painelViewerKey(email)` — dentro do
  listener `auth-change` (perto de `doSignIn()`/`isAdmUser()`) — pedido
  direto: dar acesso de SÓ LEITURA ao painel pra alguém fora de
  `@ciahering.com.br`. Novo node `kanban/painel_viewers/{emailKey}`
  (whitelist, mesmo padrão de `externos` do kanban) — segurança de
  verdade fica em `database.rules.json` (write nunca libera pra quem
  não é `@ciahering.com.br`, em nenhum node do painel; visualizador só
  ganha exceção de READ nos nodes que o painel lê: `painel`,
  `squads_meta`, `config`, `feedback`, e por squad — `dados`,
  `presence`, `snapshots`, `error_logs`, `error_stats`, `agent_usage`).
- `window._isPainelViewer` / `_blockIfPainelViewer()` — flag + guard
  chamado no topo de toda função que abre modal de edição (`openCfg`,
  `openComunicadoCompose`, `openCampEdit`, `openPevModal`,
  `openGlobalBackup`, `openBoardSetup`, `openGlobalUsersModal`,
  `openPainelCampMsEdit`) — mostra toast em vez de abrir. CSS
  `body.painel-viewer-mode` esconde `.hd-btn-adm`/`[data-sqid]` (botões
  de admin do header + ⚙ Config de cada squad).
- `renderPainelViewers()`/`addPainelViewer()`/`removePainelViewer()` —
  gestão da whitelist, dentro da aba "🔑 ADMs" de `openCfg()` (seção
  "👁 Visualizadores externos do painel").
- Limitação conhecida: `openPevModal` (evento do calendário) é sempre
  um formulário editável, mesmo pra só VER um evento existente —
  bloqueá-lo pro visualizador também tira a visão de detalhe de um
  evento específico (a grade do calendário continua visível). Não
  corrigido — sinalizado no `CHANGELOG.md`.

### Agentes Externos (2026-08-28, só em painel-dev.html — ainda não
promovido pra prod; linhas abaixo são de painel-dev.html)
Registro global (não mais por squad) de sistemas externos que mandam
mensagens pro Agente Ágil via API — ADM/PO documenta o que cada um faz
e em quais squads a descrição vale. Migrado pra cá a partir de uma
versão anterior por squad dentro do próprio kanban.html/kanban-dev.html
(removida na mesma migração — pedido direto: "tem q ter uma area no
painel de configuração desses agentes plugados! listar todos eles...
setar em quais squads ele vai ficar"). Lido pelo backend em
`kanban/config/agentesExternos/{especialista}` — ver
`lerDescricaoEspecialista()` na seção "Cloud Functions" abaixo.
- `loadAgentesExternosPainel()` — L6714 — registra o listener em
  `kanban/config/agentesExternos`, chamado no boot (`fb-ready`).
- `renderAgentesExternosPainel()` — L6721 — lista expansível na aba
  "🔌 Agentes Externos" de `openCfg()`; cada item mostra descrição
  (textarea) + chips de squad (`SQUADS`, checkbox por squad).
- `criarAgenteExternoPainel()` — L6758 / `salvarAgenteExternoPainel(id)`
  — L6771 / `toggleAgenteExternoSquad(id,squadId,checked)` — L6781
  (grava na hora, sem precisar de "Salvar") / `excluirAgenteExternoPainel(id)`
  — L6790. Todas as escritas gateadas por `_isAdmPainel()`.

### Dashboard consolidado
- `loadAll()` — L8158 / `renderAll()` — L8179
- `renderOKR()` — L3935
- `renderBlockers()` — L8732 / `resolveAllBlockers()` — L8662
- `renderRiscos()` — L3970
- `renderTrend()` — L8770 (throughput)
- `renderColDist()` — L8793
- `renderComparison()` — L8609
- `loadAgentUsage()` — L4364
- `renderGerenciaBar()` — L2427 / `gerenciaSquadIds()` — L2420 (Insights por Gerência)

### Board Setup
- `openBoardSetup()` — L8828

### Usuários
- `openGlobalUsersModal()` — L7762
- `initHiddenCols()` — L7476

## functions/ (Cloud Functions — deploy manual, sempre resincronizar antes, ver `CLAUDE.md`)

### index.js — registro de exports
- `PUSH_TYPES` (allow-list de push, hoje: assigned/mention/unblocked/risk/
  recorrente/painel_broadcast/intake) — L23
- `sendPushOnNotification` — L25
- `agenteAgil` (HTTP, agente v0-v3 mais antigo) — L119 → `agente-agil/http.js`
- `spotifyOauthCallback`/`Disconnect`/`SyncNow`/`Playback`/`RadioOwnerCallback`/`RadioSearch`/`RadioSuggest` — L123–L162 → `spotify/*.js`
- `intakeSubmit` — L168 → `intake/submit.js`
- `weeklyBackup` — L173 → `backup/weeklyBackup.js`
- `agenteAgilMencao` — L187 → `agente-agil-orquestrador/mentionTrigger.js` (orquestrador novo, gatilho por @menção, squad `dev`)
- `agenteAgilMencaoDados` — L198 → mesma fábrica, squad `dados`, ativado em
  escrita real 2026-08-24 (ver seção abaixo)
- `agenteAgilDueOverdueScan` — L217 → `agente-agil-orquestrador/dueOverdueTrigger.js`,
  scan diário (`onSchedule`), item 5 do roadmap — squads `dev` **e**
  `dados` (dados adicionado 2026-08-25), cobre `due_overdue` **e**
  `due_today` (nome ficou de v1, só due_overdue/squad dev — ver seção
  abaixo)
- `agenteAgilResumoMeuDia` — L228 → `agente-agil-orquestrador/resumoMeuDia.js`,
  `onRequest` (não gatilho por evento) — "🤖 Resumo do Agente Ágil"
  dentro de "Meu Dia", 2026-08-25, ver seção abaixo
- `agenteAgilIntake` — 2026-08-27 → `agente-agil-orquestrador/intakeTrigger.js`,
  squad `dev`, MODO SOMBRA (nunca validado em produção) — 2º gatilho
  automático do orquestrador, escuta `agente_intake_pending/{id}` (ver
  `agente-agil/http.js` abaixo pro porquê de existir)

### agente-agil-orquestrador/ (orquestrador novo — este é o documentado em `maredigital.html`)
- `tools/index.js` — `buildTools()`, registro das 13 ferramentas reais (`comentario`, `link`, `relatorio_html`, `checklist_item`, `agent_status`, `mover_coluna`, `editar_campos`, `risco`, `perguntar_humano`, `ler_card`, `visao_board`, `biblioteca_agil`, `criar_card`). `semCard:true` (2026-08-27) — variante restrita pra quando não há cardId fixo (ver `intakeTrigger.js`): só `criar_card`/`visao_board`/`biblioteca_agil` sobrevivem, as demais exigem card já resolvido.
  `risco` (2026-08-28, pedido direto — "pensando em grandes projetos, pode
  ser legal") — só adiciona (`card.riscos` é array de strings puras,
  sem id/estado, sem "resolver"); reusa o mesmo par schema Zod
  (`agente-agil/schema.js`) + builder (`agente-agil/outputs/risco.js`,
  mesmo padrão transacional de `outputs/link.js`) que as outras 7
  ferramentas reaproveitadas já usam — nenhum código novo em
  `tools/index.js`/`realHandlers.js` além de registrar o schema em
  `REUSED_OUTPUT_SCHEMAS`, tudo genérico a partir daí.
- `tools/criarCard.js` — `criar_card` (2026-08-27, fecha o gap "não existe
  criar_card no toolset dele" registrado no README). NÃO escreve em
  `/cards` direto (mesmo risco de perda silenciosa de `intake/submit.js`
  — array reescrito por inteiro a cada `fbSaveAll()`) — grava rascunho em
  `intake_pending`, revisável na tela que já existe
  (`renderIntakeBody()`/`_intakeCriarCard()` em kanban-dev.html — ver
  seção "Intake" abaixo). Replica as regras obrigatórias do `criar_card`
  client-side (Ficha Técnica recusa, Submarca exige opção válida —
  `SUBMARCA_LABELS`, cópia fixa de `SUBMARCA_TAGS` do kanban-dev.html).
- `pendingAuto.js` — `enqueuePendingAuto()`/`enqueuePendingAutoFromDiff()`
  (2026-08-29, achado real `/monitorarbugs`: Automações client-side nunca
  disparavam pra mutação do orquestrador). Chamado de dentro de
  `runWritePlan()` em `tools/realHandlers.js` — lê o card antes/depois de
  `applyWritePlan()` (clone via `JSON.parse(JSON.stringify(...))`, não
  spread — achado ao rodar o teste de `mover_coluna`: um fake db de teste
  que devolve a MESMA referência de objeto em `get()` fazia o snapshot
  "antes" mudar sozinho quando o depois era escrito) e enfileira só os
  eventos que mudaram de verdade (`move`/`priority`/`tag_added`/
  `tag_removed`/`checklist_complete`/`risk_added` — os únicos campos que
  `mover_coluna`/`editar_campos`/`checklist_item`/`risco` conseguem
  tocar). Ver seção "Automações (Butler-style)" (kanban-dev.html) acima
  pro lado que consome a fila.
- `tools/lerCard.js` — inclui `colunas_disponiveis` no retorno (mapa
  id↔nome↔fim de TODAS as colunas do board) — `mover_coluna` precisa do
  ID, não do nome de exibição; achado real 2026-08-21 (agente chutou
  "Concluído"/"Concludo", ambos erraram, corretamente pausou com
  `perguntar_humano` antes deste fix). `origemDoComentario(uid)` —
  2026-08-27, "orquestrador lendo input de especialistas externos" (ver
  README.md) — cada comentário que `summarizeCard()` devolve ganha
  `origem` (`humano`/`proprio`/`automacao`/`especialista`), resolvida do
  mesmo `uid` que `resolveActor()` (`agente-agil/board.js`) já grava;
  zero campo novo no Firebase. `systemPrompt.js` ganhou seção instruindo
  o modelo a nunca reconciliar especialistas que se contradizem sozinho
  — só sinalizar.
- `mentionTrigger.js` — `createMentionTrigger({squadId, dryRun})` (L130)
  é uma FÁBRICA multi-squad (2026-08-21) — cada squad suportado vira sua
  própria Cloud Function com path LITERAL no trigger (não wildcard, por
  custo). Instâncias hoje: `dev` (dryRun:false) e `dados` (dryRun:false,
  2026-08-24) — ambas em escrita real. `processarMencao()` — L133
  (dentro da fábrica, por instância). 2 fixes reais achados validando o
  item 5 (due_overdue/due_today) em produção, 2026-08-24: (1) disparo
  por Automação (`comment.uid==='automacao'`, ator sintético) não
  notificava ninguém — agora resolve e notifica o responsável do card
  (`card.owner`) nesse caso; (2) o `idOverride` da notificação por
  Automação colidia com o de outros caminhos de notificação do mesmo
  card — passou a incluir `commentId` (`mention_auto_{cardId}_{uid}_
  {commentId}`) pra não bloquear disparos novos com uma notificação
  antiga no mesmo slot. 3º fix real, achado ao vivo (2026-08-27): o
  MESMO problema do 2º fix, nunca replicado pro caso "original" — a
  notificação de @menção HUMANA usava `mention_{cardId}_{uid}` (sem
  `commentId`), então uma 2ª @menção da mesma pessoa no mesmo card
  (pergunta nova, não reprocessamento) nunca notificava, o slot já
  estava ocupado pela 1ª. Mesmo fix: `commentId` no idOverride.
- `intakeTrigger.js` — `createIntakeTrigger({squadId, dryRun})` (2026-08-27,
  fábrica no mesmo padrão de `mentionTrigger.js`) — 2º gatilho automático
  do orquestrador, o 1º que não depende de card existente. Escuta
  `agente_intake_pending/{id}` (escrito por `agente-agil/http.js`, ver
  seção abaixo). `processarIntake()` resolve `cardId`/`referencia` de
  novo (o card pode ter sumido entre o especialista mandar e o trigger
  rodar); se resolve, monta o toolset normal (igual @menção); se não,
  monta `semCard:true` (só `criar_card`/`visao_board`/`biblioteca_agil`).
  Resultado gravado de volta no próprio item da fila (`resultText`,
  `pendingIdCriado`) — sem card pra comentar nesse caminho. Só a
  instância `dev` existe hoje, com escrita real desde 2026-08-27
  (`DRY_RUN_INTAKE:false` — validada com 7 rodadas de teste, ver
  `README.md`; squad `dados` ainda não tem instância deployada).
  `notificarFalhaSemCard()`/`acharCardHotline()` (2026-08-28, pedido
  direto após um teste real via HTTPS): quando `semCard` e nada de
  acionável nasceu (`criar_card` recusou, ou o modelo decidiu não
  criar), comenta no card hotline "🤖 Converse com o Agente Ágil" (só
  LÊ — nunca cria um card novo em `/cards`, mesmo risco de perda
  silenciosa que `criarCard.js` já contorna) e notifica quem tem papel
  `po`/`adm` na squad (`members.js` ganhou o campo `role` por membro,
  mesmo fallback de `getEffectiveRole()` do cliente, sem replicar o
  allowlist de super-admin `isAdmUser()`). Sem card hotline ainda,
  notifica do mesmo jeito com `type:'intake'`/`cardId:null` (mesmo tipo
  que `openNotif()` já trata pra abrir Pedidos de Intake em vez de
  navegar pra um card inexistente). Sem isso, uma recusa (ex.: Ficha
  Técnica obrigatória) ficava visível só pra quem abrisse Pedidos de
  Intake por conta própria.
  `lerDescricaoEspecialista()` (2026-08-28, pedido direto: "área em
  configurações para os ADM's/PO explicarem as funções dos outros
  agentes... pra ele usar como contexto"; migrado pra registro GLOBAL no
  mesmo dia, pedido direto: "listar todos eles... setar em quais squads
  ele vai ficar") — lê `kanban/config/agentesExternos/{especialista}`
  (editado em painel.html/painel-dev.html, ⚙ Config → 🔌 Agentes
  Externos, ver `agentesExternosCfg`/`renderAgentesExternosPainel()`,
  chave = mesmo valor do campo `especialista` do envelope) e injeta a
  descrição no início do `task` só se `squads[squadId]===true` na
  entrada — sem o squad atual marcado ali, trata como especialista
  desconhecido (não injeta nada). Não existe mais UI equivalente dentro
  do kanban (removida na mesma migração).
- `agenteLog.js` — histórico do Agente Ágil por squad, 2026-08-27, pedido
  direto ("quero uma area q guarde todas as alterações nos cards que ele
  faça naquela squad, para servir de historico para o PO... pode ate
  gravar quem pediu, se for o caso, ou se foi autonomo"). Chamado de 2
  pontos: `processarMencao()` (mentionTrigger.js, cobre @menção manual/
  Automação/scan diário — os 3 passam pela mesma rota, escrevem um
  comentário `@Agente Ágil` real) e `processarIntake()`
  (intakeTrigger.js, informação de especialista externo, sem comentário
  nenhum). `coletarAcoesAgente(steps)` achata `result.steps` (ver
  `loop.js`) numa lista de frases em português, só das tools que mudam
  algo de verdade (`ler_card`/`visao_board`/`biblioteca_agil` ficam de
  fora, e chamadas em `dryRun`/que falharam também). `registrarLogAgente
  (db, {squadId, cardId, comment, acoes})` grava em `kanban/squads/
  {squadId}/dados/agente_log/{logId}` — `classificarOrigem(comment)`
  (2026-08-27, achado real via `/monitorarbugs`: binário antigo
  `autonomous` fazia `comment.uid==='especialista:*'` virar
  `autonomous:false`/exibir "pediu via menção" no cliente, frase falsa)
  resolve `origem: 'mencao'|'automacao'|'especialista'` a partir do
  `uid` — `automacao` é o único caso sem `requestedBy` (null); `mencao`
  e `especialista` preenchem `requestedBy` com autor/uid. Sem entrada se
  nenhuma ação mutante rodou (não polui o log com "só leu o card").
  Lido pelo client em `renderAgenteLog()` (kanban.html, ver seção
  "Agente Ágil" acima) — aba "🤖 Histórico do Agente" em
  ⚙ Configurações, com fallback pra derivar `origem` de `autonomous` em
  entradas gravadas antes deste fix. `database.rules.json` não precisou
  de regra nova — `agente_log` já cai dentro do `.read`/`.write` amplo de
  `squads/$squadId/dados` (mesmo nível de acesso de `cards`/
  `card_comments`; a visibilidade de fato fica só na UI, PO/Organizador/
  ADM, mesmo padrão do resto do app).
- `escolheClienteParaTarefa.js` — roteamento de modelo real (Item 7 do
  roadmap, 2026-08-21): `classificaComplexidade()` — L70 — heurística de
  texto que manda perguntas curtas/conceituais pro `haiku`, tudo o resto
  (qualquer pedido de ação) pro `sonnet`; sem caminho automático pro
  `opus` em v1, só override manual via
  `kanban/config/agente_agil_orquestrador/model_tier_override`
  (fail-safe: erro/ausente cai pra heurística). `MODEL_BY_TIER` — L27
- `dueOverdueTrigger.js` — item 5 do roadmap, v1 (2026-08-24):
  `onSchedule` diário, cobre `due_overdue` **e** `due_today` (due_today
  adicionado no mesmo dia, ao mesmo scan — nome da function ficou de
  quando era só due_overdue, não renomeado pra não exigir apagar/
  recriar). `SQUADS` — array de squads escaneados (`['dev','dados']`,
  `dados` adicionado 2026-08-25) — 1 Cloud Function só, itera os squads
  em sequência (cada um em try/catch próprio); diferente de
  `mentionTrigger.js`, aqui NÃO faz sentido 1 function por squad (só se
  justifica pra escutar evento com path literal — `onSchedule` não
  escuta squad nenhum, só dispara 1x/dia). `runDueOverdueScan(db,
  squadId)` — L108 — squad-agnóstica, reusa a mesma rota da @menção
  (escreve comentário, `agenteAgilMencao` processa), só age se o ADM já
  tiver configurado a Automação correspondente pro gatilho ("Card vence
  hoje"/"Card atrasado (1º dia)") NAQUELE squad
- `systemPrompt.js`, `loop.js`, `limits.js`, `detectaMencao.js`
- `llmClient.js` — única camada que fala o formato Anthropic
  (`createAnthropicLlmClient()`). Prompt caching (2026-08-26, achado
  direto no Console: sem cache, um único acionamento do loop com 6
  iterações cobrou ~50k tokens de entrada em preço cheio, já que cada
  iteração reenvia o histórico acumulado do zero) — `withSystemCacheControl()`
  marca o bloco de `system` (cobre tools+system juntos, TTL 1h — prefixo
  reusado entre tarefas diferentes, não só iterações do mesmo loop) e
  `withMessagesCacheControl()` marca o último bloco de `messages` (TTL
  padrão 5min — prefixo específico da tarefa em andamento). `decide()`
  agora também repassa `usage` (inclui `cache_read_input_tokens`/
  `cache_creation_input_tokens`) pra quem chamar poder verificar hit
  rate.
- `resumoMeuDia.js` — "🤖 Resumo do Agente Ágil" (2026-08-25), primeira
  invocação SOB DEMANDA do orquestrador (`onRequest`, não gatilho por
  evento) e a única que NÃO ESCREVE NADA no board — só lê os cards
  ativos da pessoa (responsável/participante, squads `dev`/`dados` que
  ela participa) e devolve texto interpretado pelo LLM (`tools: []`,
  sem nenhuma ferramenta de ação). `collectPendingCards()`/
  `sinaisDoCard()` — L111/pura, calculam os sinais objetivos (atrasado,
  bloqueado, sem descrição, checklist vazio/pendente) ANTES do LLM ver
  qualquer coisa. `gerarResumoMeuDia()` — L174 — lógica pura testável
  (llmClient injetado). Sem cards pendentes, não chama o LLM (custo
  zero). Auth via `Bearer <idToken>` verificado manualmente (mesmo
  padrão de `spotify/disconnect.js`), kill switch dinâmico do resto do
  orquestrador respeitado, rate limit de 2min/pessoa

### agente-agil/ (agente v0-v3, HTTP, mais antigo — ainda deployado como `exports.agenteAgil`, mas não é o orquestrador documentado em `maredigital.html`)
- `http.js`, `schema.js`, `board.js`, `flow.js`, `members.js`, `notifications.js`, `resolver.js`, `storage.js`
- `http.js` — CORREÇÃO DE ARQUITETURA (2026-08-27, pedido direto do
  usuário): parou de aplicar a ação do especialista direto no board.
  Agora só valida `schema.js:intakeEnvelope` (texto livre obrigatório;
  `cardId`/`referencia` viram dica opcional) e enfileira em
  `agente_intake_pending/{id}` — quem decide é sempre
  `agente-agil-orquestrador/intakeTrigger.js`. `schema.js:envelope`/
  `output` (vocabulário de ações antigo) ficam só como contrato legado,
  não lidos mais aqui.
- `board.js` — `resolveActor(especialistaId)`/`ctx.actor` (2026-08-25): identidade
  (`uid`/`author`/`who`/`init`) creditada em todo output — achado real: antes,
  todo output (especialista externo via `http.js` OU o próprio orquestrador via
  `agente-agil-orquestrador/tools/realHandlers.js`, que reusa os MESMOS
  builders) gravava sempre `uid:'agente-agil'`, o mesmo ator, tornando
  estruturalmente impossível o orquestrador diferenciar "especialista escreveu"
  de "eu mesmo escrevi" (o filtro anti-auto-disparo de `mentionTrigger.js`
  engolia os dois igual). `extra.especialista` em `buildWritePlan()` só vem
  preenchido quando quem chama é `http.js` (default `'databricks'`, único
  especialista real hoje) — `realHandlers.js` nunca passa isso, mantém a
  identidade de sempre. `SQUAD_ID` default trocado de `'ecomm'` (squad
  descontinuado, apagado do Realtime Database) pra `'dev'` (2026-08-25) —
  agora tem overlap real com o orquestrador, que só existe em `dev`/
  `dados`; `http.js` (canal do especialista externo) segue esse default
  automaticamente

### intake/ e backup/ — online
- `intake/submit.js` — `intakeSubmit`, HTTP público sem login, único ponto de
  escrita anônima do sistema. Grava em `intake_pending` (nunca em `/cards`
  direto — ver comentário no topo do arquivo pro porquê). Honeypot + rate
  limit por IP.
- `backup/weeklyBackup.js` — `weeklyBackup`, `onSchedule` todo domingo 04:00
  (Brasília), backup de cada squad pro Cloud Storage
  (`backups/{squadId}/{data}.json`), independente de alguém abrir o board.
  Retenção automática de 60 dias via `storage-lifecycle.json` (~8-9 backups
  semanais mantidos por squad).

### spotify/ — PAUSADO (2026-08-04)
"Ouvindo agora" (presença ao vivo, opt-in) + "Rádio do Maré" (playlist
colaborativa). Completo e validado em produção, mas o sync periódico
(`spotify/sync.js`, `spotifySync`) era a única function agendada de todo o
projeto — rodava 24h/dia mesmo sem ninguém conectado — e custou mais do que
o esperado. Pausado desligando só essa function (linha comentada em
`functions/index.js`, L129-L140) e escondendo a aba `#spotify-tab` no board.
As outras 6 functions da integração continuam deployadas normalmente:
- `oauth.js` (`spotifyOauthCallback`) — conexão por pessoa (opt-in)
- `disconnect.js` (`spotifyDisconnect`) — apaga o refresh_token de verdade
- `syncNow.js` (`spotifySyncNow`) — sync sob demanda ao abrir o painel
- `playback.js` (`spotifyPlayback`) — play/pause/próxima pessoal
- `radioOwnerCallback.js` / `radioSearch.js` / `radioSuggest.js` — playlist
  colaborativa (Rádio do Maré), não depende do sync pausado
- Ver `functions/spotify/README.md` pro desenho completo. Pra religar o
  sync: ver o comentário em `functions/index.js` sobre custo antes.

---

*Retrato do commit `307e6d9` (2026-08-26).*
