# CODE_MAP_FAST.md — Índice Compacto de Navegação Rápida

> Gerado automaticamente por `node scripts/mare-cli.js map` em 2026-11-11.
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
  - **L1983**: 📅 Calendários (Google Calendar) — nunca teve seção própria até 2026-09-18
  - **L2014**: Notas
  - **L2022**: Automações (Butler-style)
  - **L2096**: Campos dedicados por squad: Submarca / Canal de venda
  - **L2154**: Botões exclusivos por squad na toolbar — 2 padrões diferentes, escolha proposital
  - **L2172**: Impedimentos (modo coluna vs. tag)
  - **L2388**: ⏸ Pausar card (tempo/métricas — 2026-09-03)
  - **L2420**: ⏱️ Tempo em atraso/bloqueado (arquivado — 2026-09-06)
  - **L2508**: Padrões de card (cardPatterns) — never indexado antes desta rodada
  - **L2540**: Agente Ágil (client-side — atalhos que postam @menção real)
  - **L2633**: Externos / segurança
  - **L2646**: Intake (pedidos pendentes — formulário público E `criar_card` do Agente Ágil)
  - **L2683**: Backup
  - **L2696**: 📊 Central de Dados (aba lateral `#dados-tab` → `#dados-drawer`) — captação digital, só leitura no board
  - **L2700**: Links / Modelos-Recorrentes-Agendamentos (`qlItems`) — escrita concorrente
  - **L2721**: Marcadores `// --- X ---` já existentes no código
- **L2730**: painel-dev.html / painel.html (âncoras de dev; confira o `diff` antes de editar prod)
  - **L2732**: Papel de usuário (2 mecanismos — `squads_roles` é o correto/atual)
  - **L2762**: 👥 Online no board × 🖥️ Online no painel (aba Visão) — 2 presenças distintas, nunca indexadas antes
  - **L2791**: 🔔 Central de Notificações (aba "Notificações" do painel-dev + catálogo em `mare-notif-dev.js`, 2026-10-10)
  - **L2797**: 🔋 Aba Status — Monitores do GitHub Pages e do Firebase (`painel.html` v5.68 / `painel-dev.html` v5.71, 2026-10-14)
  - **L2801**: Sino de notificações do PAINEL (`loadPainelNotifs()`/`renderPainelNotifs()`)
  - **L2840**: Aba "🛤️ Timeline" (criada 2026-09-04, presente nos dois arquivos —
- **L3007**: okr-dev.html / okr.html — Radar (Objetivos/Marcos; antiga aba do Painel)
  - **L3522**: 🎯 `okr-dev.html` — OKR em página própria (2026-10-06, v1.0 · okr-dev; promovido como `okr.html` v1.0 · okr)
  - **L3567**: Calendário de gestão — entregas, agenda do agente e cobrança
- **L3578**: painel-dev.html / painel.html — demais áreas
  - **L3580**: Tema claro/escuro/🌴 Vice City (2026-09-03, presente nos dois arquivos — promovido pra prod v3.08)
  - **L3633**: Visualizador externo (2026-08-27, promovido pra prod 2026-08-28 — presente nos dois arquivos)
  - **L3694**: Agentes Externos (2026-08-28/29, presente em painel.html e painel-dev.html;
  - **L3746**: Aba "🤖 Agentes" (2026-09-01, presente em painel.html e painel-dev.html;
  - **L3782**: Dashboard consolidado
  - **L3801**: Saúde dos cards no Painel
  - **L3809**: Agente Ágil no Painel — conversa só de leitura
  - **L3820**: Board Setup
  - **L3823**: Usuários
- **L3828**: oceano-dev.html / oceano.html (lobby da família Oceano — âncoras de dev; arquivo único, 2 `<script>`: módulo Firebase + IIFE)
- **L3840**: okr-apresentacao.slide.html — 🎙️ Apresentação ao vivo (2026-10-09; controle ADM em 2026-10-15): `liveInit()` (idempotente: `_liveIniciado`) ouve `kanban/okr/apresentacao_live`; `_isAdmOkr()`/`liveSouAdm()`/`livePodeControlar()` (host ou ADM tem controle total de moderação: laser, caneta, limpar traços, passar/aceitar/recusar controle, assumir a qualquer momento, sincronizar slide e encerrar); `_liveComecar`/`_liveEncerrar`/`_livePassar`/`_livePedir`/`_liveAssumir`/`_livePuxarSlide`/`_liveFerr` (laser/caneta)/`liveAplicar(forcar)` (acompanhar; `forcar` = apresentador que recarregou retoma a posição, 1x — `_liveRetomar`)/`liveAposNavegar()` (envolve `_okrGoTo`/`_okrOpenDetail`/`_okrCloseDetail`)/`liveRender()`/`liveDesenhar()` (canvas dos traços + ponto do laser).
- **L3842**: okr-apresentacao.slide.html (raiz do repo, sem `-dev` — nunca teve
- **L3993**: travessia-dev.html / travessia.html — desenvolvimento de pessoas
  - **L3995**: Travessia — Baú, Diário, faróis, Frota e avaliação
- **L4007**: minipainel.html — resumo operacional
  - **L4009**: Mini painel — página e endpoint oceanoResumo
- **L4018**: functions/ (Cloud Functions — deploy manual, sempre resincronizar antes, ver `CLAUDE.md`)
  - **L4020**: index.js — registro de exports
  - **L4088**: cards/ — Guardião dos cards
  - **L4097**: Intake no Agente Ágil — origem externa do card
  - **L4102**: agente-agil-orquestrador/ (orquestrador novo — este é o documentado em `maredigital.html`)
  - **L4412**: agente-agil/ (agente v0-v3, HTTP, mais antigo — ainda deployado como `exports.agenteAgil`, mas não é o orquestrador documentado em `maredigital.html`)
  - **L4474**: intake/ e backup/ — online
  - **L4499**: okr/ — 2026-09-04, novo (+ `weeklySnapshot.js` e `agenteChat.js`/`agenteTools.js`/`agenteHelpers.js`/`agentePrompt.js` em 2026-09-05)
  - **L4601**: spotify/ — PAUSADO (2026-08-04)
  - **L4620**: painel — consumo de banda (cards incrementais, `usuarios` sob demanda) — v3.93
  - **L4630**: Segurança — handlers inline, identidade do rate limit, redirect (2026-10-05)
  - **L4636**: 💬 Indicador de comentários na face do card (2026-10-05)
  - **L4647**: 🧠 Conhecimento do Agente Ágil (`functions/agente-agil-orquestrador/conhecimento/`, 2026-10-10)
  - **L4652**: 💡 Dicas (mini popups) — `mare-dicas-dev.js` (módulo compartilhado, `?v=5`; em prod `mare-dicas.js?v=5` desde 2026-10-14: kanban v8.30.822, okr v2.78, oceano v1.34, painel v5.68)

## 2. Principais Âncoras Curadas por Arquivo (`-dev`)

### `kanban-dev.html` (206 âncoras curadas)
- `ADM_EMAILS` (L7215) · `getEffectiveRole` (L7350) · `SQUAD_META_LIVE` (L7412) · `resolveSquadAndShow` (L12136) · `autoRegistrar` (L12526) · `_claimUserInit` (L12362)
- `_ensureInitRegistryBackfilled` (L12405) · `doSignIn` (L12023) · `_syncAuthProfileToFirebase` (L12429) · `showApp` (L12194) · `_onRealAuthChange` (L36951) · `agentes` (L8116)
- `allIdentities` (L8128) · `renderAgentesList` (L27038) · `fecharAddAgente` (L27079) · `salvarAgente` (L27083) · `excluirAgente` (L27110) · `CARD_SECTIONS` (L8051)
- `openCard` (L16898) · `openAgenteHotline` (L16777) · `_applyAgenteHotlineSkin` (L16753) · `saveCard` (L17429) · `_finishCloseOv` (L36274) · `_newCardGuardOff` (L15951)
- `fbSaveAll` (L10098) · `fbCreateCard` (L10341) · `fbSaveCard` (L10407) · `_applyCardsSync` (L10802) · `_notasUpdate` (L21465) · `_saveCardWithRetry` (L10553)
- `saveExtraDesc` (L16497) · `openNewCard` (L17338) · `backfillFlow` (L9544) · `recordMove` (L9418) · `_reportUnexpectedCardDisappearance` (L10394) · `searchDependsCards` (L37463)
- `_currentTheme` (L36521) · `toggleTheme` (L36583) · `toggleThemeAuto` (L36679) · `exitViceCity` (L36757) · `_isViceCityEasterEggAtivo` (L36860) · `toggleBlackFriday` (L36781)
- `exitBlackFriday` (L36792) · `_themeBtnRightClick` (L36804) · `_isBlackFridayAtivo` (L36780) · `maybeAutoArchiveOldCards` (L15523) · `_renderArquivadosBody` (L25611) · `openArquivados` (L25676)
- *... (+158 em docs/CODE_SYMBOLS.md)*

### `painel-dev.html` (58 âncoras curadas)
- `getEffectiveRole` (L7177) · `updateSquadUserRole` (L11230) · `openGlobalUsersModal` (L10822) · `updateUserRole` (L10203) · `_limparHtmlStatus` (L7189) · `_linkSeguroStatus` (L7202)
- `_statusIncidenteRecente` (L7210) · `_setStatusPill` (L7217) · `initGithubStatusMonitor` (L7172) · `loadGithubStatus` (L7226) · `renderGithubStatusUI` (L7276) · `_fbMatchServicos` (L7477)
- `initFirebaseStatusMonitor` (L7507) · `loadFirebaseStatus` (L7521) · `renderFirebaseStatusUI` (L7588) · `loadAgentesExternosPainel` (L9382) · `renderAgentesExternosPainel` (L9394) · `criarAgenteExternoPainel` (L9462)
- `toggleAgenteExternoSquad` (L9519) · `_fillAgentesLogSquadFilter` (L9551) · `loadAgentesTabData` (L9558) · `renderAgentesAtivosGrid` (L9582) · `renderAgentesLogCross` (L9607) · `closeAgentesHelp` (L9641)
- *... (+34 em docs/CODE_SYMBOLS.md)*

### `okr-dev.html` (9 âncoras curadas)
- `_okrObjUltimaAtividade` (L5264) · `_okrObjParadoDias` (L5276) · `_renderMd` (L2535) · `_okrToggleNotas` (L3895) · `loadOkrReuniaoNotas` (L3182) · `renderOkrNotas` (L3215)
- `_okrAgendaCartoes` (L3061) · `_okrAgendaConfirmar` (L3084) · `_okrAgendaAplicar` (L3099)

### `travessia-dev.html` (9 âncoras curadas)
- `abrirApp` (L879) · `farol` (L380) · `termometro` (L391) · `viewBau` (L526) · `viewDiario` (L472) · `viewAval` (L558)
- `viewFrota` (L596) · `guardarBau` (L722) · `demoDados` (L813)

### `okr-apresentacao.slide.html` (12 âncoras curadas)
- `buildSlides` (L1234) · `startListeners` (L2111) · `rebuild` (L1349) · `fitSlideContent` (L1509) · `_okrFitDetailSections` (L1769) · `objMarcos` (L913)
- `_okrViewerKey` (L2465) · `_okrShowApp` (L2436) · `_hojeStr` (L1848) · `renderNotas` (L1888) · `_okrAgendaHoje` (L2023) · `_okrRenderCountdown` (L2052)

### `mare-notif-dev.js` (9 âncoras curadas)
- `AREAS` (L56) · `PUSH_PADRAO` (L66) · `TIPOS` (L68) · `renderNotifCentral` (L12801) · `ncSet` (L12909) · `_ncPapelGrava` (L12895)
- `ncRestaurarTudo` (L12923) · `_ncUso` (L12787) · `_ncDnd` (L12779)
