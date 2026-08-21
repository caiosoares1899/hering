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
- `ADM_EMAILS` (let) — L5609
- `getEffectiveRole()` — L5647 — papel efetivo, ADMs hardcoded não são rebaixáveis
- `loadSquadsFromFirebase()` / `SQUAD_META_LIVE` — L5708 / L5690
- `resolveSquadAndShow()` — L8648 — resolve squad da URL, decide o que mostrar
- `autoRegistrar()` — L8801 — cria/atualiza o doc do usuário no login

### Card — estrutura & modal
- `CARD_SECTIONS` — L6093 — seções do modal (Conteúdo, Vínculos, Colaboração...)
- `openCard()` — L10812
- `saveCard()` — L11228 — auto-save (debounce 800ms) passa por aqui
- `_finishCloseOv()` — L25228 — fechamento do modal, reset de estado pendente

### Board & render
- `renderNormal()` — L9408
- `renderRaiaOwner()` — L9466
- `renderRaiaTag()` — L9517
- `toggleRaia()` — L9796
- `passesFilter()` — L9753
- `handleDragStart/End/Over/Leave()` — L23439–L23489
- `addTouchDnD()` — L23627 — drag-and-drop por toque (mobile)

### Busca (Ctrl+K + "Ver no board")
- `openSearch()` — L25743
- `renderSearchResults()` — L25755
- `verNoBoardFromSearch()` — L25822
- `_scheduleTextFilterApply()` — L9706 — debounce do filtro `#f-texto`

### Checklist (com grupos colapsáveis)
- `renderCL()` — L11653
- `_clGroupsInit()` — L11618
- `toggleChecklistGroupCollapse()` — L11631

### Supercards / Ficha Técnica
- `_crvAutoTitle()` — L12083 — título automático do filho a partir da Ficha Técnica
- `searchSuperChildren()` — L21006 — busca de cards existentes ao criar um filho
- `_mergeModeloEmCardObj()` — L23967
- `_applyFanoutTemplate()` — L23936 — cria os filhos de uma receita de fan-out
- Nesting de 2 níveis (campanha → criativo → versão): `editingSuperParentIsChild`
  (global, L20773) + `initSuperChildren()` — L20793 — calcula se o card
  aberto já seria uma "versão" (teto real do 2º nível)
- `_crvOwnSummary()` — L20877 — resumo dos campos próprios do criativo,
  usado no card de versão (2º nível)
- `_checkSupercardAutoComplete()` — L24437 — conclui o supercard sozinho
  quando todos os filhos ativos chegam numa coluna de fim; cascateia
  filho→pai→avô recursivamente. `_isColCancelLike()` — L24423, logo acima —
  se TODOS os filhos ativos terminaram cancelados, o pai NÃO conclui
  sozinho, fica onde está

### Card lock / "Pedir o card"
- `CARD_LOCK_REQUEST_GRACE_MS` — L10315
- `_cardLockRequestPath()` — L10322
- `pedirCard()` — L10332
- `liberarCardAgora()` — L10346
- `_renderLockRequestUI()` — L10350
- `_handleLockRequest()` — L10385

### Notificações in-app
- `createNotif()` — L21162
- `loadNotifs()` — L21423
- `checkDueNotifs()` — L21806 — due_today/due_overdue, 1x/dia

### Notas
- `toggleNotas()` — L14185, `setNotasScope()` — L14198
- `renderNotasList()` — L14233, `createNota()` — L14265
- `openNota()`/`closeNotaEditor()` — L14281/L14282
- `renderNotaEditor()` — L14543, `toggleNotaModo()` — L14841 (livre/estruturado)
- `renderNotaLinkedCards()` — L14308, `notaSearchCards()`/`notaAddCardLink()`/`notaRemoveCardLink()` — L14326/L14349/L14358
- `renderNotasVinculadasNoCard()` — L14378 — seção "Vínculos" dentro do card

### Automações (Butler-style)
- `AUTO_TRIGGERS` — L24056 (20 triggers)
- `AUTO_ACTIONS` — L24119 (14 ações)
- `runAutoRules()` — L24474
- `_autoTrigger()`/`_autoAction()` — L24199/L24200
- `_autoValLabel()`/`_autoRenderValueOptions()` — L24203/L24225

### Externos / segurança
- `_extKey()` — L27219 — chave de e-mail sanitizada (`.` → `,`)
- `salvarExterno()` — L27220

### Backup
- `exportBackupJSON()` — L27321
- `maybeSnapshot()` — L10026

### Marcadores `// --- X ---` já existentes no código
Só existem para um subconjunto pequeno de áreas — não é uma convenção
aplicada no arquivo inteiro, não confie neles como única forma de navegar:
- L18183 Ágil, L18268 Col editor, L18312 Usuários, L18497 Tags,
  L18867 "Worker / Firebase" (nome do comentário é antigo — hoje é
  config/legado de Firebase, **não** tem relação com o Cloudflare Worker,
  que não existe mais na arquitetura atual)
- L23369 D&D das colunas, L23438 D&D dos cards

## painel.html (prod — painel-dev.html diverge, confira com `diff` antes de assumir paridade)

### Dashboard consolidado
- `loadAll()` — L8005 / `renderAll()` — L8026
- `renderOKR()` — L3925
- `renderBlockers()` — L8579 / `resolveAllBlockers()` — L8509
- `renderRiscos()` — L3960
- `renderTrend()` — L8617 (throughput)
- `renderColDist()` — L8640
- `renderComparison()` — L8456
- `loadAgentUsage()` — L4354
- `renderGerenciaBar()` — L2427 / `gerenciaSquadIds()` — L2420 (Insights por Gerência)

### Board Setup
- `openBoardSetup()` — L8675

### Usuários
- `openGlobalUsersModal()` — L7609
- `initHiddenCols()` — L7324

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

*Retrato do commit `49bd2c1` (2026-08-21).*
