# Mapa do código

Índice de âncoras (funções/consts) por área funcional, pra achar código rápido
nos arquivos grandes deste repo (`kanban.html`/`kanban-dev.html` têm ~28.2k
linhas / até ~1.1MB) sem precisar ler o arquivo inteiro.

**Como usar:** os números de linha abaixo são um retrato de um commit
específico (ver rodapé) e ficam desatualizados a cada edição no arquivo —
**sempre confirme com `grep -n "nomeDaFuncao" arquivo.html` antes de confiar
neles pra uma edição**. O valor real deste arquivo é a lista de nomes
(âncoras estáveis), não os números de linha em si.

`kanban.html` e `kanban-dev.html` estão hoje byte-idênticos exceto 2 linhas
(string de versão + `VERSION_KEY`) — os números abaixo valem pros dois. Isso
pode mudar a qualquer momento que uma feature nova entrar em dev antes de ir
pra prod (ver "Release process" no `CLAUDE.md`) — se os tamanhos dos arquivos
divergirem, refaça o grep no arquivo específico que você está editando.
`painel.html`/`painel-dev.html` **divergem de verdade** (dev tem
instrumentação extra) — os números da seção painel abaixo são de
`painel.html` (prod).

## kanban.html / kanban-dev.html

### Papéis & autenticação
- `ADM_EMAILS` (let) — L5605
- `getEffectiveRole()` — L5643 — papel efetivo, ADMs hardcoded não são rebaixáveis
- `loadSquadsFromFirebase()` / `SQUAD_META_LIVE` — L5704 / L5686
- `resolveSquadAndShow()` — L8644 — resolve squad da URL, decide o que mostrar
- `autoRegistrar()` — L8797 — cria/atualiza o doc do usuário no login

### Card — estrutura & modal
- `CARD_SECTIONS` — L6089 — seções do modal (Conteúdo, Vínculos, Colaboração...)
- `openCard()` — L10790
- `saveCard()` — L11206 — auto-save (debounce 800ms) passa por aqui
- `_finishCloseOv()` — L25054 — fechamento do modal, reset de estado pendente

### Board & render
- `renderNormal()` — L9404
- `renderRaiaOwner()` — L9462
- `renderRaiaTag()` — L9513
- `toggleRaia()` — L9792
- `passesFilter()` — L9749
- `handleDragStart/End/Over/Leave()` — L23324–L23374
- `addTouchDnD()` — L23512 — drag-and-drop por toque (mobile)

### Busca (Ctrl+K + "Ver no board")
- `openSearch()` — L25569
- `renderSearchResults()` — L25581
- `verNoBoardFromSearch()` — L25648
- `_scheduleTextFilterApply()` — L9702 — debounce do filtro `#f-texto`

### Checklist (com grupos colapsáveis)
- `renderCL()` — L11624
- `_clGroupsInit()` — L11589
- `toggleChecklistGroupCollapse()` — L11602

### Supercards / Ficha Técnica
- `_crvAutoTitle()` — L12054 — título automático do filho a partir da Ficha Técnica
- `searchSuperChildren()` — L20895 — busca de cards existentes ao criar um filho
- `_mergeModeloEmCardObj()` — L23852
- `_applyFanoutTemplate()` — L23821 — cria os filhos de uma receita de fan-out

### Card lock / "Pedir o card"
- `CARD_LOCK_REQUEST_GRACE_MS` — L10311
- `_cardLockRequestPath()` — L10318
- `pedirCard()` — L10328
- `liberarCardAgora()` — L10342
- `_renderLockRequestUI()` — L10346
- `_handleLockRequest()` — L10381

### Notificações in-app
- `createNotif()` — L21047
- `loadNotifs()` — L21308
- `checkDueNotifs()` — L21691 — due_today/due_overdue, 1x/dia

### Notas
- `toggleNotas()` — L14144, `setNotasScope()` — L14157
- `renderNotasList()` — L14192, `createNota()` — L14224
- `openNota()`/`closeNotaEditor()` — L14240/L14241
- `renderNotaEditor()` — L14502, `toggleNotaModo()` — L14800 (livre/estruturado)
- `renderNotaLinkedCards()` — L14267, `notaSearchCards()`/`notaAddCardLink()`/`notaRemoveCardLink()` — L14285/L14308/L14317
- `renderNotasVinculadasNoCard()` — L14337 — seção "Vínculos" dentro do card

### Automações (Butler-style)
- `AUTO_TRIGGERS` — L23940 (20 triggers)
- `AUTO_ACTIONS` — L24003 (14 ações)
- `runAutoRules()` — L24301
- `_autoTrigger()`/`_autoAction()` — L24078/L24079
- `_autoValLabel()`/`_autoRenderValueOptions()` — L24082/L24104

### Externos / segurança
- `_extKey()` — L27045 — chave de e-mail sanitizada (`.` → `,`)
- `salvarExterno()` — L27046

### Backup
- `exportBackupJSON()` — L27147
- `maybeSnapshot()` — L10022

### Marcadores `// --- X ---` já existentes no código
Só existem para um subconjunto pequeno de áreas — não é uma convenção
aplicada no arquivo inteiro, não confie neles como única forma de navegar:
- L18142 Ágil, L18227 Col editor, L18271 Usuários, L18456 Tags,
  L18826 "Worker / Firebase" (nome do comentário é antigo — hoje é
  config/legado de Firebase, **não** tem relação com o Cloudflare Worker,
  que não existe mais na arquitetura atual)
- L23254 D&D das colunas, L23323 D&D dos cards

## painel.html (prod — painel-dev.html diverge, confira com `diff` antes de assumir paridade)

### Dashboard consolidado
- `loadAll()` — L7971 / `renderAll()` — L7992
- `renderOKR()` — L3925
- `renderBlockers()` — L8545 / `resolveAllBlockers()` — L8475
- `renderRiscos()` — L3960
- `renderTrend()` — L8583 (throughput)
- `renderColDist()` — L8606
- `renderComparison()` — L8422
- `loadAgentUsage()` — L4354
- `renderGerenciaBar()` — L2427 / `gerenciaSquadIds()` — L2420 (Insights por Gerência)

### Board Setup
- `openBoardSetup()` — L8641

### Usuários
- `openGlobalUsersModal()` — L7575
- `initHiddenCols()` — L7290

## functions/ (Cloud Functions — deploy manual, sempre resincronizar antes, ver `CLAUDE.md`)

### index.js — registro de exports
- `PUSH_TYPES` (allow-list de push) — L23
- `sendPushOnNotification` — L25
- `agenteAgil` (HTTP, agente v0-v3 mais antigo) — L119 → `agente-agil/http.js`
- `spotifyOauthCallback`/`Disconnect`/`SyncNow`/`Playback`/`RadioOwnerCallback`/`RadioSearch`/`RadioSuggest` — L123–L162 → `spotify/*.js`
- `intakeSubmit` — L168 → `intake/submit.js`
- `weeklyBackup` — L173 → `backup/weeklyBackup.js`
- `agenteAgilMencao` — L187 → `agente-agil-orquestrador/mentionTrigger.js` (orquestrador novo, gatilho por @menção)

### agente-agil-orquestrador/ (orquestrador novo — este é o documentado em `maredigital.html`)
- `tools/index.js` — `buildTools()`, registro das 11 ferramentas reais (`comentario`, `link`, `relatorio_html`, `checklist_item`, `agent_status`, `mover_coluna`, `editar_campos`, `perguntar_humano`, `ler_card`, `visao_board`, `biblioteca_agil`)
- `mentionTrigger.js` — gatilho @menção, `processarMencao()` L82
- `systemPrompt.js`, `loop.js`, `limits.js`, `detectaMencao.js`

### agente-agil/ (agente v0-v3, HTTP, mais antigo — ainda deployado como `exports.agenteAgil`, mas não é o orquestrador documentado em `maredigital.html`)
- `http.js`, `schema.js`, `board.js`, `flow.js`, `members.js`, `notifications.js`, `resolver.js`, `storage.js`

### spotify/, intake/, backup/
Existem e estão deployados (7 exports de Spotify + intake + backup semanal),
mas **ainda não foram investigados/documentados** — este mapa só lista os
arquivos pelo nome, não confere o comportamento. Ver observação abaixo.

---

## Observação em aberto

Ao levantar este mapa, descobri que `functions/index.js` exporta bem mais do
que o `maredigital.html` documenta hoje: uma integração inteira com Spotify
(`functions/spotify/`, 7 exports — oauth, disconnect, sync, playback, rádio),
além de `intakeSubmit` e `weeklyBackup`. Não fazia parte do pedido que gerou
este mapa, então não investiguei o que cada uma faz — só sinalizando que
existe uma lacuna de documentação aí, caso valha a pena olhar depois.

*Retrato do commit `e5c52af` (2026-08-20).*
