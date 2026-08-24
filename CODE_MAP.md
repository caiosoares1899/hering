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
dois (retrato deste rodapé: promoção da v8.30.457 confirmada, ver
`CHANGELOG.md`). Isso pode mudar a qualquer momento que uma feature nova
entrar em dev antes de ir pra prod (ver "Release process" no
`CLAUDE.md`) — se os tamanhos dos arquivos divergirem, refaça o grep no
arquivo específico que você está editando.
`painel.html`/`painel-dev.html` **divergem de verdade** (dev tem
instrumentação extra) — os números da seção painel abaixo são de
`painel.html` (prod).

## kanban.html / kanban-dev.html

### Papéis & autenticação
- `ADM_EMAILS` (let) — L5609
- `getEffectiveRole()` — L5647 — papel efetivo, ADMs hardcoded não são rebaixáveis
- `loadSquadsFromFirebase()` / `SQUAD_META_LIVE` — L5708 / L5690
- `resolveSquadAndShow()` — L8675 — resolve squad da URL, decide o que mostrar
- `autoRegistrar()` — L8828 — cria/atualiza o doc do usuário no login

### Card — estrutura & modal
- `CARD_SECTIONS` — L6093 — seções do modal (Conteúdo, Vínculos, Colaboração...)
- `openCard()` — L10839
- `saveCard()` — L11309 — auto-save (debounce 800ms) passa por aqui
- `_finishCloseOv()` — L25263 — fechamento do modal, reset de estado pendente

### Escrita de card no Firebase — 3 primitivas (não intercambiáveis)
- `fbSaveAll()` — L7286 — reescreve `/cards` INTEIRO (só pra operações
  estruturais em lote: duplicar/arquivar em massa, reordenar, importar,
  recorrências/agendamentos) — **nunca usar pra 1 card só**, arrisca
  sobrescrever o array com o estado local de outra pessoa
- `fbCreateCard()` — L7418 — cria 1 card NOVO com escrita pontual,
  posição alocada via `transaction()` no `cards_index` (atômico contra
  criações concorrentes) — achado real 2026-08-24 (squad
  `midiacriativa`, "cards sumindo"): `fbSaveAll()` na criação
  colidia com o mesmo tipo de ação concorrente e apagava cards de
  outras pessoas. Usar sempre pra criar 1 card (modal, duplicar, filho
  de supercard, fan-out)
- `fbSaveCard()` — L7449 — edita 1 card EXISTENTE, escrita pontual
  (usada por drag-and-drop, autosave, etc.)

### Board & render
- `renderNormal()` — L9435
- `renderRaiaOwner()` — L9493
- `renderRaiaTag()` — L9544
- `toggleRaia()` — L9823
- `passesFilter()` — L9780
- `handleDragStart/End/Over/Leave()` — L23472/L23483/L23494/L23522
- `addTouchDnD()` — L23660 — drag-and-drop por toque (mobile)

### Busca (Ctrl+K + "Ver no board")
- `openSearch()` — L25778
- `renderSearchResults()` — L25790
- `verNoBoardFromSearch()` — L25857
- `_scheduleTextFilterApply()` — L9733 — debounce do filtro `#f-texto`

### Checklist (com grupos colapsáveis)
- `renderCL()` — L11680
- `_clGroupsInit()` — L11645
- `toggleChecklistGroupCollapse()` — L11658

### Supercards / Ficha Técnica
- `_crvAutoTitle()` — L12110 — título automático do filho a partir da Ficha Técnica
- `searchSuperChildren()` — L21039 — busca de cards existentes ao criar um filho
- `_mergeModeloEmCardObj()` — L24000
- `_applyFanoutTemplate()` — L23969 — cria os filhos de uma receita de fan-out
- Nesting de 2 níveis (campanha → criativo → versão): `editingSuperParentIsChild`
  (global, L20806) + `initSuperChildren()` — L20826 — calcula se o card
  aberto já seria uma "versão" (teto real do 2º nível)
- `_crvOwnSummary()` — L20910 — resumo dos campos próprios do criativo,
  usado no card de versão (2º nível)
- `_checkSupercardAutoComplete()` — L24474 — conclui o supercard sozinho
  quando todos os filhos ativos chegam numa coluna de fim; cascateia
  filho→pai→avô recursivamente. `_isColCancelLike()` — L24460, logo acima —
  se TODOS os filhos ativos terminaram cancelados, o pai NÃO conclui
  sozinho, fica onde está

### Card lock / "Pedir o card"
- `CARD_LOCK_REQUEST_GRACE_MS` — L10342
- `_cardLockRequestPath()` — L10349
- `pedirCard()` — L10359
- `liberarCardAgora()` — L10373
- `_renderLockRequestUI()` — L10377
- `_handleLockRequest()` — L10412

### Notificações in-app
- `createNotif()` — L21195
- `loadNotifs()` — L21456
- `checkDueNotifs()` — L21839 — due_today/due_overdue, 1x/dia

### Notas
- `toggleNotas()` — L14218, `setNotasScope()` — L14231
- `renderNotasList()` — L14266, `createNota()` — L14298
- `openNota()`/`closeNotaEditor()` — L14314/L14315
- `renderNotaEditor()` — L14576, `toggleNotaModo()` — L14874 (livre/estruturado)
- `renderNotaLinkedCards()` — L14341, `notaSearchCards()`/`notaAddCardLink()`/`notaRemoveCardLink()` — L14359/L14382/L14391
- `renderNotasVinculadasNoCard()` — L14411 — seção "Vínculos" dentro do card

### Automações (Butler-style)
- `AUTO_TRIGGERS` — L24089 (20 triggers)
- `AUTO_ACTIONS` — L24152 (14 ações)
- `runAutoRules()` — L24511
- `_autoTrigger()`/`_autoAction()` — L24235/L24236
- `_autoValLabel()`/`_autoRenderValueOptions()` — L24239/L24261

### Agente Ágil (client-side — atalhos que postam @menção real)
- `AGENTE_AGIL_MENTION_SQUADS` — L6182 — squads onde os atalhos abaixo
  estão ativos: `'dev'` e `'dados'` (2026-08-24) — precisa ter uma Cloud
  Function de verdade escutando o squad (ver seção `agente-agil-
  orquestrador/` abaixo), senão a sugestão aparece sem nada escutando
- `_askAgenteAgilNoCard(card, pergunta)` — L6196 — posta
  `@Agente Ágil <pergunta>` como comentário real do card, mesmo pipeline
  do `@menção` manual (`functions/agente-agil-orquestrador/mentionTrigger.js`)
- `insightsCard()` — L13538 — botão "🤖 Insights" no rodapé do card
- `ctxInsights()` — L24905 — opção "Insights" no menu de contexto do card
- Painel de chat antigo (`openAgent()`/`qa()`, `AGENTE_AGIL_ATIVO`) segue
  desativado nos 4 pontos sem card real (FAB, nav mobile, AutoLab, alerta
  de WIP) — depende de um Worker externo fora do ar, não faz parte deste
  fluxo

### Externos / segurança
- `_extKey()` — L27254 — chave de e-mail sanitizada (`.` → `,`)
- `salvarExterno()` — L27255

### Backup
- `exportBackupJSON()` — L27356
- `maybeSnapshot()` — L10053

### Marcadores `// --- X ---` já existentes no código
Só existem para um subconjunto pequeno de áreas — não é uma convenção
aplicada no arquivo inteiro, não confie neles como única forma de navegar:
- L18216 Ágil, L18301 Col editor, L18345 Usuários, L18530 Tags,
  L18900 "Worker / Firebase" (nome do comentário é antigo — hoje é
  config/legado de Firebase, **não** tem relação com o Cloudflare Worker,
  que não existe mais na arquitetura atual)
- L23402 D&D das colunas, L23471 D&D dos cards

## painel.html (prod — painel-dev.html diverge, confira com `diff` antes de assumir paridade)

### Dashboard consolidado
- `loadAll()` — L8016 / `renderAll()` — L8037
- `renderOKR()` — L3925
- `renderBlockers()` — L8590 / `resolveAllBlockers()` — L8520
- `renderRiscos()` — L3960
- `renderTrend()` — L8628 (throughput)
- `renderColDist()` — L8651
- `renderComparison()` — L8467
- `loadAgentUsage()` — L4354
- `renderGerenciaBar()` — L2427 / `gerenciaSquadIds()` — L2420 (Insights por Gerência)

### Board Setup
- `openBoardSetup()` — L8686

### Usuários
- `openGlobalUsersModal()` — L7620
- `initHiddenCols()` — L7335

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
- `agenteAgilDueOverdueScan` — L212 → `agente-agil-orquestrador/dueOverdueTrigger.js`,
  scan diário (`onSchedule`), item 5 do roadmap — squad `dev`, gatilho
  `due_overdue` só (ver seção abaixo)

### agente-agil-orquestrador/ (orquestrador novo — este é o documentado em `maredigital.html`)
- `tools/index.js` — `buildTools()`, registro das 11 ferramentas reais (`comentario`, `link`, `relatorio_html`, `checklist_item`, `agent_status`, `mover_coluna`, `editar_campos`, `perguntar_humano`, `ler_card`, `visao_board`, `biblioteca_agil`)
- `tools/lerCard.js` — inclui `colunas_disponiveis` no retorno (mapa
  id↔nome↔fim de TODAS as colunas do board) — `mover_coluna` precisa do
  ID, não do nome de exibição; achado real 2026-08-21 (agente chutou
  "Concluído"/"Concludo", ambos erraram, corretamente pausou com
  `perguntar_humano` antes deste fix)
- `mentionTrigger.js` — `createMentionTrigger({squadId, dryRun})` (L126)
  é uma FÁBRICA multi-squad (2026-08-21) — cada squad suportado vira sua
  própria Cloud Function com path LITERAL no trigger (não wildcard, por
  custo). Instâncias hoje: `dev` (dryRun:false) e `dados` (dryRun:false,
  2026-08-24) — ambas em escrita real. `processarMencao()` — L129
  (dentro da fábrica, por instância)
- `escolheClienteParaTarefa.js` — roteamento de modelo real (Item 7 do
  roadmap, 2026-08-21): `classificaComplexidade()` — L70 — heurística de
  texto que manda perguntas curtas/conceituais pro `haiku`, tudo o resto
  (qualquer pedido de ação) pro `sonnet`; sem caminho automático pro
  `opus` em v1, só override manual via
  `kanban/config/agente_agil_orquestrador/model_tier_override`
  (fail-safe: erro/ausente cai pra heurística). `MODEL_BY_TIER` — L27
- `dueOverdueTrigger.js` — item 5 do roadmap (gatilho automático em
  mudança de card), v1 (2026-08-24): `onSchedule` diário, squad `dev`
  só, gatilho `due_overdue` só — `runDueOverdueScan()` reusa a mesma
  rota da @menção (escreve comentário, `agenteAgilMencao` processa),
  só age se o ADM já tiver configurado a Automação correspondente
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

*Retrato do commit `0b97e99` (2026-08-24).*
