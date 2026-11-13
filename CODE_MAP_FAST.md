# CODE_MAP_FAST.md — Índice Compacto de Navegação Rápida

> Gerado automaticamente por `node scripts/mare-cli.js map` em 2026-11-13.
> Para o índice **completo** de todos os `<style>`, `<script>`, `const`s e funções de cada página `-dev` e módulo `mare-*-dev.js`, consulte [`docs/CODE_SYMBOLS.md`](docs/CODE_SYMBOLS.md).

## 1. Sumário de Seções (`CODE_MAP.md`)

- **L37**: kanban.html / kanban-dev.html
  - **L39**: Papéis & autenticação
  - **L226**: Agentes de IA (cadastro — piloto híbrido humano+agente)
  - **L300**: Card — estrutura & modal
  - **L505**: Escrita de card no Firebase — 3 primitivas (não intercambiáveis)
  - **L624**: Rede de segurança — detecção ao vivo de card sumido inesperadamente
  - **L662**: ⛓ Dependências entre cards (bloqueio/ordem, não hierarquia — diferente de supercard)
  - **L687**: Tema (claro/escuro + 🌴 Vice City + 🕐 automático)
  - **L752**: Arquivados / arquivamento automático
  - **L800**: Comunicados / Mural (popup + badge + Mural)
  - **L869**: Modal do card no mobile — redesenho estilo Trello (2026-09-02, CSS puro, sem função nova)
  - **L883**: Cabeçalho mobile — menu "⋯" (2026-09-02)
  - **L896**: Board & render
  - **L1132**: `/monitorarbugs`: coluna "concluído" hardcoded em 9 funções (2026-09-04)
  - **L1204**: 📜 Histórico: data em período de vários dias (2026-09-04)
  - **L1212**: Busca (Ctrl+K + "Ver no board" + Busca nos Comentários do Card)
  - **L1229**: ⌨️ Atalhos de teclado personalizáveis (2026-09-07)
  - **L1291**: 🎛️ board_prefs — preferências pessoais do board sincronizadas por conta (2026-09-07, rodadas 1-5 de 5 — completo)
  - **L1457**: 🔀 Reorganizar barra de ferramentas (2026-09-07)
  - **L1501**: 💡 Personalização baseada em rotina (2026-09-11)
  - **L1578**: 👤 Minhas Preferências (2026-09-28)
  - **L1705**: ⎋ Esc fecha a tela aberta (2026-09-07)
  - **L1773**: Checklist (com grupos colapsáveis)
  - **L1779**: Campanhas (`openCamp()`, botão "📣 Campanhas")
  - **L1791**: Supercards / Ficha Técnica
  - **L1892**: Card lock / "Pedir o card"
  - **L1911**: Notificações in-app
  - **L1965**: ⏲ Timer e Produtividade (2026-11-01; promovido em 02/11)
  - **L1983**: 🏝️ Ilha Dinâmica V1/V2 & `mare-timer.js` (`kanban-dev.html` v8.30.925–v8.30.941-dev · prod v8.30.932)
  - **L1988**: 🔍 Sonar — Busca unificada (`mare-sonar.js` / `mare-sonar-dev.js` `?v=8`, 2026-11-10)
  - **L1992**: 📅 Calendários (Google Calendar) — nunca teve seção própria até 2026-09-18
  - **L2023**: Notas
  - **L2031**: Automações (Butler-style)
  - **L2105**: Campos dedicados por squad: Submarca / Canal de venda
  - **L2163**: Botões exclusivos por squad na toolbar — 2 padrões diferentes, escolha proposital
  - **L2181**: Impedimentos (modo coluna vs. tag)
  - **L2397**: ⏸ Pausar card (tempo/métricas — 2026-09-03)
  - **L2429**: ⏱️ Tempo em atraso/bloqueado (arquivado — 2026-09-06)
  - **L2517**: Padrões de card (cardPatterns) — never indexado antes desta rodada
  - **L2549**: Agente Ágil (client-side — atalhos que postam @menção real)
  - **L2642**: Externos / segurança
  - **L2655**: Intake (pedidos pendentes — formulário público E `criar_card` do Agente Ágil)
  - **L2692**: Backup
  - **L2705**: 📊 Central de Dados (aba lateral `#dados-tab` → `#dados-drawer`) — captação digital, só leitura no board
  - **L2709**: Links / Modelos-Recorrentes-Agendamentos (`qlItems`) — escrita concorrente
  - **L2730**: Marcadores `// --- X ---` já existentes no código
- **L2739**: painel-dev.html / painel.html (âncoras de dev; confira o `diff` antes de editar prod)
  - **L2741**: Papel de usuário (2 mecanismos — `squads_roles` é o correto/atual)
  - **L2771**: 👥 Online no board × 🖥️ Online no painel (aba Visão) — 2 presenças distintas, nunca indexadas antes
  - **L2800**: 🔔 Central de Notificações (aba "Notificações" do painel-dev + catálogo em `mare-notif-dev.js`, 2026-10-10)
  - **L2806**: 🔋 Aba Status — Monitores do GitHub Pages e do Firebase (`painel.html` v5.68 / `painel-dev.html` v5.71, 2026-10-14)
  - **L2810**: Sino de notificações do PAINEL (`loadPainelNotifs()`/`renderPainelNotifs()`)
  - **L2849**: Aba "🛤️ Timeline" (criada 2026-09-04, presente nos dois arquivos —
- **L3016**: okr-dev.html / okr.html — Radar (Objetivos/Marcos; antiga aba do Painel)
  - **L3531**: 🎯 `okr-dev.html` — OKR em página própria (2026-10-06, v1.0 · okr-dev; promovido como `okr.html` v1.0 · okr)
  - **L3576**: Calendário de gestão — entregas, agenda do agente e cobrança
- **L3587**: painel-dev.html / painel.html — demais áreas
  - **L3589**: Tema claro/escuro/🌴 Vice City (2026-09-03, presente nos dois arquivos — promovido pra prod v3.08)
  - **L3642**: Visualizador externo (2026-08-27, promovido pra prod 2026-08-28 — presente nos dois arquivos)
  - **L3703**: Agentes Externos (2026-08-28/29, presente em painel.html e painel-dev.html;
  - **L3755**: Aba "🤖 Agentes" (2026-09-01, presente em painel.html e painel-dev.html;
  - **L3791**: Dashboard consolidado
  - **L3810**: Saúde dos cards no Painel
  - **L3818**: Agente Ágil no Painel — conversa só de leitura
  - **L3829**: Board Setup
  - **L3832**: Usuários
- **L3837**: oceano-dev.html / oceano.html (lobby da família Oceano — âncoras de dev; arquivo único, 2 `<script>`: módulo Firebase + IIFE)
- **L3849**: okr-apresentacao.slide.html — 🎙️ Apresentação ao vivo (2026-10-09; controle ADM em 2026-10-15): `liveInit()` (idempotente: `_liveIniciado`) ouve `kanban/okr/apresentacao_live`; `_isAdmOkr()`/`liveSouAdm()`/`livePodeControlar()` (host ou ADM tem controle total de moderação: laser, caneta, limpar traços, passar/aceitar/recusar controle, assumir a qualquer momento, sincronizar slide e encerrar); `_liveComecar`/`_liveEncerrar`/`_livePassar`/`_livePedir`/`_liveAssumir`/`_livePuxarSlide`/`_liveFerr` (laser/caneta)/`liveAplicar(forcar)` (acompanhar; `forcar` = apresentador que recarregou retoma a posição, 1x — `_liveRetomar`)/`liveAposNavegar()` (envolve `_okrGoTo`/`_okrOpenDetail`/`_okrCloseDetail`)/`liveRender()`/`liveDesenhar()` (canvas dos traços + ponto do laser).
- **L3851**: okr-apresentacao.slide.html (raiz do repo, sem `-dev` — nunca teve
- **L4002**: travessia-dev.html / travessia.html — desenvolvimento de pessoas
  - **L4004**: Travessia — Baú, Diário, faróis, Frota e avaliação
- **L4016**: minipainel.html — resumo operacional
  - **L4018**: Mini painel — página e endpoint oceanoResumo
- **L4027**: functions/ (Cloud Functions — deploy manual, sempre resincronizar antes, ver `CLAUDE.md`)
  - **L4029**: index.js — registro de exports
  - **L4098**: cards/ — Guardião dos cards
  - **L4107**: Intake no Agente Ágil — origem externa do card
  - **L4112**: agente-agil-orquestrador/ (orquestrador novo — este é o documentado em `maredigital.html`)
  - **L4422**: agente-agil/ (agente v0-v3, HTTP, mais antigo — ainda deployado como `exports.agenteAgil`, mas não é o orquestrador documentado em `maredigital.html`)
  - **L4484**: intake/ e backup/ — online
  - **L4509**: okr/ — 2026-09-04, novo (+ `weeklySnapshot.js` e `agenteChat.js`/`agenteTools.js`/`agenteHelpers.js`/`agentePrompt.js` em 2026-09-05)
  - **L4611**: spotify/ — PAUSADO (2026-08-04)
  - **L4630**: painel — consumo de banda (cards incrementais, `usuarios` sob demanda) — v3.93
  - **L4640**: Segurança — handlers inline, identidade do rate limit, redirect (2026-10-05)
  - **L4646**: 💬 Indicador de comentários na face do card (2026-10-05)
  - **L4657**: 🧠 Conhecimento do Agente Ágil (`functions/agente-agil-orquestrador/conhecimento/`, 2026-10-10)
  - **L4662**: 💡 Dicas (mini popups) — `mare-dicas-dev.js` (módulo compartilhado, `?v=5`; em prod `mare-dicas.js?v=5` desde 2026-10-14: kanban v8.30.822, okr v2.78, oceano v1.34, painel v5.68)
  - **L4667**: 🛡️ Painel — Sanitização DOM/CSS e trava C1/C2 de papéis (`painel-dev.html` v5.100–v5.102, 2026-11-11)
  - **L4671**: 📊 Gantt dos calendários — `mare-gcal(-dev).js` (`v2` prod · `v5`-dev) & `mare-gxl(-dev).js` (`v2`) (2026-11-13)

## 2. Principais Âncoras Curadas por Arquivo (`-dev`)

### `kanban-dev.html` (141 âncoras curadas)
- `ADM_EMAILS` (L8038) · `getEffectiveRole` (L8173) · `SQUAD_META_LIVE` (L8235) · `resolveSquadAndShow` (L12990) · `autoRegistrar` (L13527) · `_claimUserInit` (L13363)
- `_ensureInitRegistryBackfilled` (L13406) · `doSignIn` (L12877) · `_syncAuthProfileToFirebase` (L13430) · `showApp` (L13048) · `_onRealAuthChange` (L39414) · `agentes` (L8950)
- `allIdentities` (L8962) · `renderAgentesList` (L29284) · `fecharAddAgente` (L29325) · `salvarAgente` (L29329) · `excluirAgente` (L29356) · `CARD_SECTIONS` (L8875)
- `openCard` (L19132) · `openAgenteHotline` (L19011) · `_applyAgenteHotlineSkin` (L18987) · `saveCard` (L19669) · `_finishCloseOv` (L38737) · `_newCardGuardOff` (L18174)
- `fbSaveAll` (L10935) · `fbCreateCard` (L11178) · `fbSaveCard` (L11256) · `_applyCardsSync` (L11656) · `_notasUpdate` (L23710) · `_saveCardWithRetry` (L11407)
- `saveExtraDesc` (L18731) · `openNewCard` (L19575) · `backfillFlow` (L10378) · `recordMove` (L10252) · `_reportUnexpectedCardDisappearance` (L11243) · `searchDependsCards` (L39926)
- `_currentTheme` (L38984) · `toggleTheme` (L39046) · `toggleThemeAuto` (L39142) · `exitViceCity` (L39220) · `_isViceCityEasterEggAtivo` (L39323) · `toggleBlackFriday` (L39244)
- `exitBlackFriday` (L39255) · `_themeBtnRightClick` (L39267) · `_isBlackFridayAtivo` (L39243) · `maybeAutoArchiveOldCards` (L17699) · `_renderArquivadosBody` (L27856) · `openArquivados` (L27921)
- *... (+93 em docs/CODE_SYMBOLS.md)*

### `painel-dev.html` (65 âncoras curadas)
- `getEffectiveRole` (L7177) · `updateSquadUserRole` (L11430) · `openGlobalUsersModal` (L11022) · `updateUserRole` (L10403) · `_limparHtmlStatus` (L7208) · `_linkSeguroStatus` (L7221)
- `_statusIncidenteRecente` (L7229) · `_setStatusPill` (L7236) · `initGithubStatusMonitor` (L7191) · `loadGithubStatus` (L7245) · `renderGithubStatusUI` (L7295) · `_fbMatchServicos` (L7496)
- `initFirebaseStatusMonitor` (L7526) · `loadFirebaseStatus` (L7540) · `renderFirebaseStatusUI` (L7607) · `loadAgentesExternosPainel` (L9495) · `renderAgentesExternosPainel` (L9507) · `criarAgenteExternoPainel` (L9575)
- `toggleAgenteExternoSquad` (L9632) · `_fillAgentesLogSquadFilter` (L9664) · `loadAgentesTabData` (L9671) · `renderAgentesAtivosGrid` (L9695) · `renderAgentesLogCross` (L9720) · `closeAgentesHelp` (L9754)
- *... (+41 em docs/CODE_SYMBOLS.md)*

### `okr-dev.html` (9 âncoras curadas)
- `_okrObjUltimaAtividade` (L5368) · `_okrObjParadoDias` (L5380) · `_renderMd` (L2553) · `_okrToggleNotas` (L3935) · `loadOkrReuniaoNotas` (L3203) · `renderOkrNotas` (L3236)
- `_okrAgendaCartoes` (L3082) · `_okrAgendaConfirmar` (L3105) · `_okrAgendaAplicar` (L3120)

### `travessia-dev.html` (9 âncoras curadas)
- `abrirApp` (L1130) · `farol` (L450) · `termometro` (L461) · `viewBau` (L649) · `viewDiario` (L575) · `viewAval` (L704)
- `viewFrota` (L774) · `guardarBau` (L902) · `demoDados` (L1037)

### `okr-apresentacao.slide.html` (12 âncoras curadas)
- `buildSlides` (L1241) · `startListeners` (L2119) · `rebuild` (L1356) · `fitSlideContent` (L1516) · `_okrFitDetailSections` (L1777) · `objMarcos` (L920)
- `_okrViewerKey` (L2473) · `_okrShowApp` (L2444) · `_hojeStr` (L1856) · `renderNotas` (L1896) · `_okrAgendaHoje` (L2031) · `_okrRenderCountdown` (L2060)

### `mare-notif-dev.js` (9 âncoras curadas)
- `AREAS` (L56) · `PUSH_PADRAO` (L66) · `TIPOS` (L68) · `renderNotifCentral` (L12801) · `ncSet` (L12909) · `_ncPapelGrava` (L12895)
- `ncRestaurarTudo` (L12923) · `_ncUso` (L12787) · `_ncDnd` (L12779)

### `mare-sonar-dev.js` (68 âncoras curadas)
- `addCalendarToList` (L32629) · `_queueGcalRequest` (L32654) · `processGcalQueueForAdmin` (L32880) · `_fetchAndCacheGcalForSquad` (L32781) · `_mergeGcalSources` (L32434) · `toggleNotas` (L21265)
- `setNotasScope` (L21278) · `renderNotasList` (L21313) · `createNota` (L21345) · `closeNotaEditor` (L21361) · `renderNotaEditor` (L21638) · `toggleNotaModo` (L21950)
- `renderNotaLinkedCards` (L21388) · `notaRemoveCardLink` (L21406) · `renderNotasVinculadasNoCard` (L21473) · `AUTO_TRIGGERS` (L34030) · `AUTO_ACTIONS` (L34107) · `runAutoRules` (L34734)
- `_autoAction` (L34332) · `_autoRenderValueOptions` (L34336) · `removeBlockerTag` (L35070) · `openAutoOv` (L26475) · `_claimPendingAuto` (L34669) · `_refreshCardFromFirebase` (L34687)
- *... (+44 em docs/CODE_SYMBOLS.md)*

### `mare-timer-dev.js` (7 âncoras curadas)
- `_ilhaPrefs` (L37912) · `_ilhaPilula` (L37973) · `_ilhaResumo` (L38026) · `_ilhaPainel` (L38062) · `_ilhaPainelLugar` (L38111) · `_ilhaRender` (L38120)
- `_ilhaFechar` (L38145)
