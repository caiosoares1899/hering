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
dois (retrato deste rodapé: promoção da v8.30.460 confirmada, ver
`CHANGELOG.md`). Isso pode mudar a qualquer momento que uma feature nova
entrar em dev antes de ir pra prod (ver "Release process" no
`CLAUDE.md`) — se os tamanhos dos arquivos divergirem, refaça o grep no
arquivo específico que você está editando.
`painel.html`/`painel-dev.html` **divergem de verdade** (dev tem
instrumentação extra) — os números da seção painel abaixo são de
`painel.html` (prod).

## kanban.html / kanban-dev.html

### Papéis & autenticação
- `ADM_EMAILS` (let) — L5642
- `getEffectiveRole()` — L5680 — papel efetivo, ADMs hardcoded não são rebaixáveis
- `loadSquadsFromFirebase()` / `SQUAD_META_LIVE` — L5754 / L5723
- `resolveSquadAndShow()` — L8822 — resolve squad da URL, decide o que mostrar
- `autoRegistrar()` — L8975 — cria/atualiza o doc do usuário no login

### Card — estrutura & modal
- `CARD_SECTIONS` — L6139 — seções do modal (Conteúdo, Vínculos, Colaboração...)
- `openCard()` — L11015
- `saveCard()` — L11432 — auto-save (debounce 800ms) passa por aqui
- `_finishCloseOv()` — L25531 — fechamento do modal, reset de estado pendente
- `_newCardHasContent()`/`_newCardGuardOff` — L10439/L10413 — card ainda sem
  `editingId` (criação em andamento): se título/descrição/tags/checklist/
  riscos/PO/comentário têm algo preenchido, `closeOv('card-ov')` avisa
  antes de descartar (fora, Cancelar, ✕, arrastar no mobile — os 4 já
  passavam por `closeOv`). Não conta responsável/coluna/prazo, que vêm
  com valor padrão só de abrir o modal. `_newCardGuardOff` desarma o
  aviso nos 2 pontos em que o fechamento é legítimo mesmo com
  `editingId` ainda null (sucesso de `saveCard()`, e o fechamento do
  modal reaproveitado pra editar item de Recorrente/Modelo/Agendamento)

### Escrita de card no Firebase — 3 primitivas (não intercambiáveis)
- `fbSaveAll()` — L7336 — reescreve `/cards` INTEIRO (só pra operações
  estruturais em lote: duplicar/arquivar em massa, reordenar, importar,
  recorrências/agendamentos) — **nunca usar pra 1 card só**, arrisca
  sobrescrever o array com o estado local de outra pessoa
- `fbCreateCard()` — L7468 — cria 1 card NOVO com escrita pontual,
  posição alocada via `transaction()` no `cards_index` (atômico contra
  criações concorrentes) — achado real 2026-08-24 (squad
  `midiacriativa`, "cards sumindo"): `fbSaveAll()` na criação
  colidia com o mesmo tipo de ação concorrente e apagava cards de
  outras pessoas. Usar sempre pra criar 1 card (modal, duplicar, filho
  de supercard, fan-out)
- `fbSaveCard()` — L7521 — edita 1 card EXISTENTE, escrita pontual
  (usada por drag-and-drop, autosave, etc.)

### Rede de segurança — detecção ao vivo de card sumido inesperadamente
- `_reportUnexpectedCardDisappearance()` — L7508 — dispara toast +
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
- `renderNormal()` — L9582
- `renderRaiaOwner()` — L9640
- `renderRaiaTag()` — L9691
- `toggleRaia()` — L9970
- `passesFilter()` — L9927
- `handleDragStart/End/Over/Leave()` — L23682/L23693/L23704/L23732
- `addTouchDnD()` — L23870 — drag-and-drop por toque (mobile)

### Busca (Ctrl+K + "Ver no board")
- `openSearch()` — L26048
- `renderSearchResults()` — L26060
- `verNoBoardFromSearch()` — L26127
- `_scheduleTextFilterApply()` — L9880 — debounce do filtro `#f-texto`

### Checklist (com grupos colapsáveis)
- `renderCL()` — L11859
- `_clGroupsInit()` — L11824
- `toggleChecklistGroupCollapse()` — L11837

### Supercards / Ficha Técnica
- `_crvAutoTitle()` — L12289 — título automático do filho a partir da Ficha Técnica
- `searchSuperChildren()` — L21240 — busca de cards existentes ao criar um filho
- `_mergeModeloEmCardObj()` — L24228
- `_applyFanoutTemplate()` — L24197 — cria os filhos de uma receita de fan-out
- Nesting de 2 níveis (campanha → criativo → versão): `editingSuperParentIsChild`
  (global, L20996) + `initSuperChildren()` — L21016 — calcula se o card
  aberto já seria uma "versão" (teto real do 2º nível)
- `_crvOwnSummary()` — L21111 — resumo dos campos próprios do criativo,
  usado no card de versão (2º nível)
- `_checkSupercardAutoComplete()` — L24728 — conclui o supercard sozinho
  quando todos os filhos ativos chegam numa coluna de fim; cascateia
  filho→pai→avô recursivamente. `_isColCancelLike()` — L24714, logo acima —
  se TODOS os filhos ativos terminaram cancelados, o pai NÃO conclui
  sozinho, fica onde está
- `_duplicarComFilhos()` — L11803 — duplicar um supercard com opção de
  duplicar os filhos junto (checkbox opt-in no modal de duplicar, só
  aparece se `_cardIsSupercard()`). Recursivo (cobre netos, 3 níveis
  campanha→criativo→versão), religa `childCardIds` pros ids NOVOS, filhos
  mantêm a própria coluna (não herdam `opts.col` do card raiz), filhos
  arquivados ficam de fora, `visited` protege contra ciclo corrompido nos
  dados

### Card lock / "Pedir o card"
- `CARD_LOCK_REQUEST_GRACE_MS` — L10518
- `_cardLockRequestPath()` — L10525
- `pedirCard()` — L10535
- `liberarCardAgora()` — L10549
- `_renderLockRequestUI()` — L10553
- `_handleLockRequest()` — L10588

### Notificações in-app
- `createNotif()` — L21396
- `loadNotifs()` — L21657
- `checkDueNotifs()` — L22049 — due_today/due_overdue, 1x/dia

### Notas
- `toggleNotas()` — L14397, `setNotasScope()` — L14410
- `renderNotasList()` — L14445, `createNota()` — L14477
- `openNota()`/`closeNotaEditor()` — L14493/L14494
- `renderNotaEditor()` — L14755, `toggleNotaModo()` — L15053 (livre/estruturado)
- `renderNotaLinkedCards()` — L14520, `notaSearchCards()`/`notaAddCardLink()`/`notaRemoveCardLink()` — L14538/L14561/L14570
- `renderNotasVinculadasNoCard()` — L14590 — seção "Vínculos" dentro do card

### Automações (Butler-style)
- `AUTO_TRIGGERS` — L24343 (20 triggers)
- `AUTO_ACTIONS` — L24406 (14 ações)
- `runAutoRules()` — L24765 — só decide QUAIS regras batem (síncrono);
  `_runAutoRuleAction()`/`AUTO_RULE_DELAY_MS` (logo acima) aplicam o efeito
  de verdade depois de ~1.2s (pedido direto: dar um respiro visual antes do
  efeito da automação, e mostrar toast "⚡ Automação ... foi aplicada" —
  antes era instantâneo e silencioso) — re-busca o card no momento de
  aplicar (guarda contra card excluído/arquivado durante o delay)
- `_autoTrigger()`/`_autoAction()` — L24489/L24490
- `_autoValLabel()`/`_autoRenderValueOptions()` — L24493/L24515
- **Acesso à tela de Automações** (achado real 2026-08-24: só existia via
  `⚙ Configurações → aba ⚡ Auto`, e o botão de Configurações fica
  escondido de quem não é PO/Organizador/ADM — `_applyRoleVisibility()`,
  L8966 — mesmo sem nenhuma trava de permissão nas ações em si) —
  `openAutoOv()` — L18394 — abre o overlay `#auto-ov` (fora de `#cfg-ov`), acessível
  tanto por um atalho em ⚡ Funções de card (`#card-fn-ov`, visível pra
  qualquer papel) quanto pela aba "⚡ Auto" em Configurações (que virou
  um redirecionamento pro mesmo overlay, não mais uma aba inline)
- `fanoutTemplates` — receitas de fan-out (supercard); `renderFanoutCfg()`
  edita, incluindo o campo `tags` por receita (`setFanoutTags()`) usado só
  pra filtrar no dropdown abaixo — não afeta os cards gerados
- `toggleFanoutApplyMenu()`/`_renderFanoutApplyList()` — dropdown "🧩
  Aplicar receita" dentro do card, com filtro por nome+tag (mesmo padrão
  de "📥 Usar modelo"/`_renderUsarModeloList()`)

### Agente Ágil (client-side — atalhos que postam @menção real)
- `AGENTE_AGIL_MENTION_SQUADS` — L6232 — squads onde os atalhos abaixo
  estão ativos: `'dev'` e `'dados'` (2026-08-24) — precisa ter uma Cloud
  Function de verdade escutando o squad (ver seção `agente-agil-
  orquestrador/` abaixo), senão a sugestão aparece sem nada escutando
- `_askAgenteAgilNoCard(card, pergunta)` — L6246 — posta
  `@Agente Ágil <pergunta>` como comentário real do card, mesmo pipeline
  do `@menção` manual (`functions/agente-agil-orquestrador/mentionTrigger.js`)
- `insightsCard()` — L13721 — botão "🤖 Insights" no rodapé do card
- `ctxInsights()` — L25213 — opção "Insights" no menu de contexto do card
- `_pedirResumoMeuDia()` — L17034 — botão "🤖 Resumo do Agente Ágil"
  dentro do painel "🌅 Meu Dia" (`openMeuDia()` L16944/`renderMeuDia()`
  L16970) — chama `agenteAgilResumoMeuDia` (onRequest, ver seção
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

### Externos / segurança
- `_extKey()` — L27524 — chave de e-mail sanitizada (`.` → `,`)
- `salvarExterno()` — L27525

### Backup
- `exportBackupJSON()` — L27626
- `maybeSnapshot()` — L10200

### Marcadores `// --- X ---` já existentes no código
Só existem para um subconjunto pequeno de áreas — não é uma convenção
aplicada no arquivo inteiro, não confie neles como única forma de navegar:
- L18406 Ágil, L18491 Col editor, L18535 Usuários, L18720 Tags,
  L19090 "Worker / Firebase" (nome do comentário é antigo — hoje é
  config/legado de Firebase, **não** tem relação com o Cloudflare Worker,
  que não existe mais na arquitetura atual)
- L23612 D&D das colunas, L23681 D&D dos cards

## painel.html (prod — painel-dev.html diverge, confira com `diff` antes de assumir paridade)

### Dashboard consolidado
- `loadAll()` — L8051 / `renderAll()` — L8072
- `renderOKR()` — L3925
- `renderBlockers()` — L8625 / `resolveAllBlockers()` — L8555
- `renderRiscos()` — L3960
- `renderTrend()` — L8663 (throughput)
- `renderColDist()` — L8686
- `renderComparison()` — L8502
- `loadAgentUsage()` — L4354
- `renderGerenciaBar()` — L2427 / `gerenciaSquadIds()` — L2420 (Insights por Gerência)

### Board Setup
- `openBoardSetup()` — L8721

### Usuários
- `openGlobalUsersModal()` — L7655
- `initHiddenCols()` — L7370

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

### agente-agil-orquestrador/ (orquestrador novo — este é o documentado em `maredigital.html`)
- `tools/index.js` — `buildTools()`, registro das 11 ferramentas reais (`comentario`, `link`, `relatorio_html`, `checklist_item`, `agent_status`, `mover_coluna`, `editar_campos`, `perguntar_humano`, `ler_card`, `visao_board`, `biblioteca_agil`)
- `tools/lerCard.js` — inclui `colunas_disponiveis` no retorno (mapa
  id↔nome↔fim de TODAS as colunas do board) — `mover_coluna` precisa do
  ID, não do nome de exibição; achado real 2026-08-21 (agente chutou
  "Concluído"/"Concludo", ambos erraram, corretamente pausou com
  `perguntar_humano` antes deste fix)
- `mentionTrigger.js` — `createMentionTrigger({squadId, dryRun})` (L129)
  é uma FÁBRICA multi-squad (2026-08-21) — cada squad suportado vira sua
  própria Cloud Function com path LITERAL no trigger (não wildcard, por
  custo). Instâncias hoje: `dev` (dryRun:false) e `dados` (dryRun:false,
  2026-08-24) — ambas em escrita real. `processarMencao()` — L132
  (dentro da fábrica, por instância). 2 fixes reais achados validando o
  item 5 (due_overdue/due_today) em produção, 2026-08-24: (1) disparo
  por Automação (`comment.uid==='automacao'`, ator sintético) não
  notificava ninguém — agora resolve e notifica o responsável do card
  (`card.owner`) nesse caso; (2) o `idOverride` da notificação por
  Automação colidia com o de outros caminhos de notificação do mesmo
  card — passou a incluir `commentId` (`mention_auto_{cardId}_{uid}_
  {commentId}`) pra não bloquear disparos novos com uma notificação
  antiga no mesmo slot.
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
  identidade de sempre

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

*Retrato do commit `61d2d4a` (2026-08-25).*
