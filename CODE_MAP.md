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
- Nesting de 2 níveis (campanha → criativo → versão): `editingSuperParentIsChild`
  (global, L20765) + `initSuperChildren()` — L20785 — calcula se o card
  aberto já seria uma "versão" (teto real do 2º nível)
- `_crvOwnSummary()` — L20869 — resumo dos campos próprios do criativo,
  usado no card de versão (2º nível)
- `_checkSupercardAutoComplete()` — L24402 — conclui o supercard sozinho
  quando todos os filhos ativos chegam numa coluna de fim; cascateia
  filho→pai→avô recursivamente

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

*Retrato do commit `e5c52af` (2026-08-20).*
