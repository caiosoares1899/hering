# CODE_MAP_FAST.md — Índice Compacto de Navegação Rápida

> Gerado automaticamente por `node scripts/mare-cli.js map` em 2026-11-21.
> Para o índice **completo** de todos os `<style>`, `<script>`, `const`s e funções de cada página `-dev` e módulo `mare-*-dev.js`, consulte [`docs/CODE_SYMBOLS.md`](docs/CODE_SYMBOLS.md).

## 1. Sumário de Seções (`CODE_MAP.md`)

- [L24](CODE_MAP.md#L24) kanban.html / kanban-dev.html
  - [L26](CODE_MAP.md#L26) Papéis & autenticação
  - [L213](CODE_MAP.md#L213) Agentes de IA (cadastro — piloto híbrido humano+agente)
  - [L287](CODE_MAP.md#L287) Card — estrutura & modal
  - [L492](CODE_MAP.md#L492) Escrita de card no Firebase — 3 primitivas (não intercambiáveis)
  - [L611](CODE_MAP.md#L611) Rede de segurança — detecção ao vivo de card sumido inesperadamente
  - [L649](CODE_MAP.md#L649) ⛓ Dependências entre cards (bloqueio/ordem, não hierarquia — diferente de supercard)
  - [L674](CODE_MAP.md#L674) Tema (claro/escuro + 🌴 Vice City + 🕐 automático)
  - [L744](CODE_MAP.md#L744) Arquivados / arquivamento automático
  - [L792](CODE_MAP.md#L792) Comunicados / Mural (popup + badge + Mural)
  - [L861](CODE_MAP.md#L861) Modal do card no mobile — redesenho estilo Trello (2026-09-02, CSS puro, sem função nova)
  - [L875](CODE_MAP.md#L875) Cabeçalho mobile — menu "⋯" (2026-09-02)
  - [L888](CODE_MAP.md#L888) Board & render
  - [L1124](CODE_MAP.md#L1124) `/monitorarbugs`: coluna "concluído" hardcoded em 9 funções (2026-09-04)
  - [L1196](CODE_MAP.md#L1196) 📜 Histórico: data em período de vários dias (2026-09-04)
  - [L1204](CODE_MAP.md#L1204) Busca (Ctrl+K + "Ver no board" + Busca nos Comentários do Card)
  - [L1221](CODE_MAP.md#L1221) ⌨️ Atalhos de teclado personalizáveis (2026-09-07)
  - [L1283](CODE_MAP.md#L1283) 🎛️ board_prefs — preferências pessoais do board sincronizadas por conta (2026-09-07, rodadas 1-5 de 5 — completo)
  - [L1449](CODE_MAP.md#L1449) 🔀 Reorganizar barra de ferramentas (2026-09-07)
  - [L1493](CODE_MAP.md#L1493) 💡 Personalização baseada em rotina (2026-09-11)
  - [L1570](CODE_MAP.md#L1570) 👤 Minhas Preferências (2026-09-28)
  - [L1697](CODE_MAP.md#L1697) ⎋ Esc fecha a tela aberta (2026-09-07)
  - [L1765](CODE_MAP.md#L1765) Checklist (com grupos colapsáveis)
  - [L1771](CODE_MAP.md#L1771) Campanhas (`openCamp()`, botão "📣 Campanhas")
  - [L1783](CODE_MAP.md#L1783) Supercards / Ficha Técnica
  - [L1885](CODE_MAP.md#L1885) Card lock / "Pedir o card"
  - [L1904](CODE_MAP.md#L1904) Notificações in-app
  - [L1958](CODE_MAP.md#L1958) ⏲ Timer e Produtividade (2026-11-01; promovido em 02/11)
  - [L1976](CODE_MAP.md#L1976) 🏝️ Ilha Dinâmica V1/V2 & `mare-timer.js` (`kanban-dev.html` v8.30.925–v8.30.941-dev · prod v8.30.932)
  - [L1981](CODE_MAP.md#L1981) 🔍 Sonar — Busca unificada (`mare-sonar.js` / `mare-sonar-dev.js` `?v=8`, 2026-11-10)
  - [L1985](CODE_MAP.md#L1985) 📅 Calendários (Google Calendar) — nunca teve seção própria até 2026-09-18
  - [L2016](CODE_MAP.md#L2016) Notas
  - [L2024](CODE_MAP.md#L2024) Automações (Butler-style)
  - [L2098](CODE_MAP.md#L2098) Campos dedicados por squad: Submarca / Canal de venda
  - [L2156](CODE_MAP.md#L2156) Botões exclusivos por squad na toolbar — 2 padrões diferentes, escolha proposital
  - [L2174](CODE_MAP.md#L2174) Impedimentos (modo coluna vs. tag)
  - [L2390](CODE_MAP.md#L2390) ⏸ Pausar card (tempo/métricas — 2026-09-03)
  - [L2422](CODE_MAP.md#L2422) ⏱️ Tempo em atraso/bloqueado (arquivado — 2026-09-06)
  - [L2510](CODE_MAP.md#L2510) Padrões de card (cardPatterns) — never indexado antes desta rodada
  - [L2542](CODE_MAP.md#L2542) Agente Ágil (client-side — atalhos que postam @menção real)
  - [L2635](CODE_MAP.md#L2635) Externos / segurança
  - [L2648](CODE_MAP.md#L2648) Intake (pedidos pendentes — formulário público E `criar_card` do Agente Ágil)
  - [L2685](CODE_MAP.md#L2685) Backup
  - [L2698](CODE_MAP.md#L2698) 📊 Central de Dados (aba lateral `#dados-tab` → `#dados-drawer`) — captação digital, só leitura no board
  - [L2702](CODE_MAP.md#L2702) Links / Modelos-Recorrentes-Agendamentos (`qlItems`) — escrita concorrente
  - [L2723](CODE_MAP.md#L2723) Marcadores `// --- X ---` já existentes no código
- [L2732](CODE_MAP.md#L2732) painel-dev.html / painel.html (âncoras de dev; confira o `diff` antes de editar prod)
  - [L2734](CODE_MAP.md#L2734) Papel de usuário (2 mecanismos — `squads_roles` é o correto/atual)
  - [L2764](CODE_MAP.md#L2764) 👥 Online no board × 🖥️ Online no painel (aba Visão) — 2 presenças distintas, nunca indexadas antes
  - [L2793](CODE_MAP.md#L2793) 🔔 Central de Notificações (aba "Notificações" do painel-dev + catálogo em `mare-notif-dev.js`, 2026-10-10)
  - [L2799](CODE_MAP.md#L2799) 🔋 Aba Status — Monitores do GitHub Pages e do Firebase (`painel.html` v5.68 / `painel-dev.html` v5.71, 2026-10-14)
  - [L2803](CODE_MAP.md#L2803) Sino de notificações do PAINEL (`loadPainelNotifs()`/`renderPainelNotifs()`)
  - [L2842](CODE_MAP.md#L2842) Aba "🛤️ Timeline" (criada 2026-09-04, presente nos dois arquivos —
- [L3009](CODE_MAP.md#L3009) okr-dev.html / okr.html — Radar (Objetivos/Marcos; antiga aba do Painel)
  - [L3524](CODE_MAP.md#L3524) 🎯 `okr-dev.html` — OKR em página própria (2026-10-06, v1.0 · okr-dev; promovido como `okr.html` v1.0 · okr)
  - [L3569](CODE_MAP.md#L3569) Calendário de gestão — entregas, agenda do agente e cobrança
- [L3580](CODE_MAP.md#L3580) painel-dev.html / painel.html — demais áreas
  - [L3582](CODE_MAP.md#L3582) Tema claro/escuro/🌴 Vice City (2026-09-03, presente nos dois arquivos — promovido pra prod v3.08)
  - [L3635](CODE_MAP.md#L3635) Visualizador externo (2026-08-27, promovido pra prod 2026-08-28 — presente nos dois arquivos)
  - [L3696](CODE_MAP.md#L3696) Agentes Externos (2026-08-28/29, presente em painel.html e painel-dev.html;
  - [L3748](CODE_MAP.md#L3748) Aba "🤖 Agentes" (2026-09-01, presente em painel.html e painel-dev.html;
  - [L3784](CODE_MAP.md#L3784) Dashboard consolidado
  - [L3803](CODE_MAP.md#L3803) Fluxo — Quando termina? (piloto Monte Carlo, só dev)
  - [L3810](CODE_MAP.md#L3810) Saúde dos cards no Painel
  - [L3818](CODE_MAP.md#L3818) Agente Ágil no Painel — conversa só de leitura
  - [L3829](CODE_MAP.md#L3829) Board Setup
  - [L3832](CODE_MAP.md#L3832) Usuários
- [L3837](CODE_MAP.md#L3837) oceano-dev.html / oceano.html (lobby da família Oceano — âncoras de dev; arquivo único, 2 `<script>`: módulo Firebase + IIFE)
- [L3849](CODE_MAP.md#L3849) okr-apresentacao.slide.html — 🎙️ Apresentação ao vivo (2026-10-09; controle ADM em 2026-10-15): `liveInit()` (idempotente: `_liveIniciado`) ouve `kanban/okr/apresentacao_live`; `_isAdmOkr()`/`liveSouAdm()`/`livePodeControlar()` (host ou ADM tem controle total de moderação: laser, caneta, limpar traços, passar/aceitar/recusar controle, assumir a qualquer momento, sincronizar slide e encerrar); `_liveComecar`/`_liveEncerrar`/`_livePassar`/`_livePedir`/`_liveAssumir`/`_livePuxarSlide`/`_liveFerr` (laser/caneta)/`liveAplicar(forcar)` (acompanhar; `forcar` = apresentador que recarregou retoma a posição, 1x — `_liveRetomar`)/`liveAposNavegar()` (envolve `_okrGoTo`/`_okrOpenDetail`/`_okrCloseDetail`)/`liveRender()`/`liveDesenhar()` (canvas dos traços + ponto do laser).
- [L3851](CODE_MAP.md#L3851) okr-apresentacao.slide.html (raiz do repo, sem `-dev` — nunca teve
- [L4002](CODE_MAP.md#L4002) travessia-dev.html / travessia.html — desenvolvimento de pessoas
  - [L4004](CODE_MAP.md#L4004) Travessia — Baú, Diário, faróis, Frota e avaliação
- [L4016](CODE_MAP.md#L4016) minipainel.html — resumo operacional
  - [L4018](CODE_MAP.md#L4018) Mini painel — página e endpoint oceanoResumo
- [L4027](CODE_MAP.md#L4027) functions/ (Cloud Functions — deploy manual, sempre resincronizar antes, ver `CLAUDE.md`)
  - [L4029](CODE_MAP.md#L4029) index.js — registro de exports
  - [L4098](CODE_MAP.md#L4098) cards/ — Guardião dos cards
  - [L4107](CODE_MAP.md#L4107) Intake no Agente Ágil — origem externa do card
  - [L4112](CODE_MAP.md#L4112) agente-agil-orquestrador/ (orquestrador novo — este é o documentado em `maredigital.html`)
  - [L4422](CODE_MAP.md#L4422) agente-agil/ (agente v0-v3, HTTP, mais antigo — ainda deployado como `exports.agenteAgil`, mas não é o orquestrador documentado em `maredigital.html`)
  - [L4484](CODE_MAP.md#L4484) intake/ e backup/ — online
  - [L4509](CODE_MAP.md#L4509) okr/ — 2026-09-04, novo (+ `weeklySnapshot.js` e `agenteChat.js`/`agenteTools.js`/`agenteHelpers.js`/`agentePrompt.js` em 2026-09-05)
  - [L4611](CODE_MAP.md#L4611) spotify/ — PAUSADO (2026-08-04)
  - [L4630](CODE_MAP.md#L4630) painel — consumo de banda (cards incrementais, `usuarios` sob demanda) — v3.93
  - [L4640](CODE_MAP.md#L4640) Segurança — handlers inline, identidade do rate limit, redirect (2026-10-05)
  - [L4646](CODE_MAP.md#L4646) 💬 Indicador de comentários na face do card (2026-10-05)
  - [L4657](CODE_MAP.md#L4657) 🧠 Conhecimento do Agente Ágil (`functions/agente-agil-orquestrador/conhecimento/`, 2026-10-10)
  - [L4662](CODE_MAP.md#L4662) 💡 Dicas (mini popups) — `mare-dicas-dev.js` (módulo compartilhado, `?v=5`; em prod `mare-dicas.js?v=5` desde 2026-10-14: kanban v8.30.822, okr v2.78, oceano v1.34, painel v5.68)
  - [L4667](CODE_MAP.md#L4667) 🛡️ Painel — Sanitização DOM/CSS e trava C1/C2 de papéis (`painel-dev.html` v5.100–v5.102, 2026-11-11)
  - [L4671](CODE_MAP.md#L4671) 📊 Gantt dos calendários — `mare-gcal(-dev).js` (`v7` prod · `v9`-dev) & `mare-gxl(-dev).js` (`v2`) (2026-11-16)
  - [L4676](CODE_MAP.md#L4676) 🏖️ Modo Férias — `mare-ferias(-dev).js` (`v4` prod · `v5`-dev) (2026-11-16)

## 2. Principais Âncoras Curadas por Arquivo (`-dev`)

### `kanban-dev.html` (209 âncoras verificadas)
- [`ADM_EMAILS`](kanban-dev.html#L8180) · [`agentes`](kanban-dev.html#L9092) · [`CARD_SECTIONS`](kanban-dev.html#L9017) · [`fbSaveAll`](kanban-dev.html#L11111) · [`_reportUnexpectedCardDisappearance`](kanban-dev.html#L11419) · [`searchDependsCards`](kanban-dev.html#L40721)
- [`_currentTheme`](kanban-dev.html#L39722) · [`_bfSemanaInfo`](kanban-dev.html#L4719) · [`maybeAutoArchiveOldCards`](kanban-dev.html#L17983) · [`_refreshComunicados`](kanban-dev.html#L44258) · [`renderHdMoreDD`](kanban-dev.html#L8531) · [`renderNormal`](kanban-dev.html#L16611)
- [`updateMetrics`](kanban-dev.html#L17770) · [`openSearch`](kanban-dev.html#L40549) · [`_tbHandleDrop`](kanban-dev.html#L33620) · [`_sugestaoRecusarPermanente`](kanban-dev.html#L17264) · [`openMinhasPrefs`](kanban-dev.html#L17419) · [`renderCL`](kanban-dev.html#L21149)
- [`renderCampDashboard`](kanban-dev.html#L27011) · [`_superPodeGerarFilhos`](kanban-dev.html#L37270) · [`CARD_LOCK_REQUEST_GRACE_MS`](kanban-dev.html#L18590) · [`loadNotifs`](kanban-dev.html#L33865) · [`_tmEscrever`](kanban-dev.html#L40872) · [`addCalendarToList`](kanban-dev.html#L36002)
- [`toggleNotas`](kanban-dev.html#L24219) · [`AUTO_TRIGGERS`](kanban-dev.html#L37436) · [`blockerMode`](kanban-dev.html#L38203) · [`_cardDataCriacaoStr`](kanban-dev.html#L25421) · [`_settleBlockedTag`](kanban-dev.html#L38255) · [`excluirPadraoCard`](kanban-dev.html#L30304)
- [`AGENTE_AGIL_MENTION_SQUADS`](kanban-dev.html#L9154) · [`_extKey`](kanban-dev.html#L43375) · [`renderIntakeBody`](kanban-dev.html#L27637) · [`exportBackupJSON`](kanban-dev.html#L43477) · [`delLink`](kanban-dev.html#L29304) · [`getEffectiveRole`](kanban-dev.html#L8315)
- [`allIdentities`](kanban-dev.html#L9104) · [`openCard`](kanban-dev.html#L19572) · [`fbCreateCard`](kanban-dev.html#L11354) · [`toggleTheme`](kanban-dev.html#L39784) · [`_bfUpdateCountdown`](kanban-dev.html#L40067) · [`_renderArquivadosBody`](kanban-dev.html#L28345)
- [`COMUNICADOS_POLL_MS`](kanban-dev.html#L44240) · [`renderRaiaOwner`](kanban-dev.html#L16669) · [`renderBoardDataGrid`](kanban-dev.html#L17797) · [`renderSearchResults`](kanban-dev.html#L40563) · [`SUGESTAO_TIMELINE_JANELA_SESSOES`](kanban-dev.html#L15905) · [`renderMinhasPrefsBody`](kanban-dev.html#L17424)
- *[+161 no mapa completo](CODE_MAP.md)*

### `painel-dev.html` (66 âncoras verificadas)
- [`updateSquadUserRole`](painel-dev.html#L11663) · [`_limparHtmlStatus`](painel-dev.html#L7316) · [`loadAgentesExternosPainel`](painel-dev.html#L9603) · [`_fillAgentesLogSquadFilter`](painel-dev.html#L9772) · [`loadAll`](painel-dev.html#L11966) · [`_renderFlowForecast`](painel-dev.html#L12266)
- [`loadSaudeCards`](painel-dev.html#L8041) · [`agIniciar`](painel-dev.html#L3265) · [`openBoardSetup`](painel-dev.html#L13689) · [`initHiddenCols`](painel-dev.html#L10570) · [`_pollSquadDados`](painel-dev.html#L11921) · [`_hrefOk`](painel-dev.html#L3755)
- [`openGlobalUsersModal`](painel-dev.html#L11130) · [`_linkSeguroStatus`](painel-dev.html#L7329) · [`renderAgentesExternosPainel`](painel-dev.html#L9615) · [`loadAgentesTabData`](painel-dev.html#L9779) · [`renderAll`](painel-dev.html#L11988) · [`_forecastHasFreshData`](painel-dev.html#L12260)
- [`_scMontarEventos`](painel-dev.html#L7932) · [`agContexto`](painel-dev.html#L3289) · [`_corCssOk`](painel-dev.html#L3756) · [`updateUserRole`](painel-dev.html#L10511) · [`_statusIncidenteRecente`](painel-dev.html#L7337) · [`criarAgenteExternoPainel`](painel-dev.html#L9683)
- *[+42 no mapa completo](CODE_MAP.md)*

### `okr-dev.html` (9 âncoras verificadas)
- [`_okrObjUltimaAtividade`](okr-dev.html#L5431) · [`_renderMd`](okr-dev.html#L2610) · [`_okrToggleNotas`](okr-dev.html#L3996) · [`_okrAgendaCartoes`](okr-dev.html#L3139) · [`_okrObjParadoDias`](okr-dev.html#L5443) · [`loadOkrReuniaoNotas`](okr-dev.html#L3262)
- [`_okrAgendaConfirmar`](okr-dev.html#L3162) · [`renderOkrNotas`](okr-dev.html#L3295) · [`_okrAgendaAplicar`](okr-dev.html#L3177)

### `travessia-dev.html` (9 âncoras verificadas)
- [`abrirApp`](travessia-dev.html#L1131) · [`farol`](travessia-dev.html#L451) · [`termometro`](travessia-dev.html#L462) · [`viewBau`](travessia-dev.html#L650) · [`viewDiario`](travessia-dev.html#L576) · [`viewAval`](travessia-dev.html#L705)
- [`viewFrota`](travessia-dev.html#L775) · [`guardarBau`](travessia-dev.html#L903) · [`demoDados`](travessia-dev.html#L1038)

### `okr-apresentacao.slide.html` (12 âncoras verificadas)
- [`buildSlides`](okr-apresentacao.slide.html#L1527) · [`startListeners`](okr-apresentacao.slide.html#L2542) · [`rebuild`](okr-apresentacao.slide.html#L1647) · [`fitSlideContent`](okr-apresentacao.slide.html#L1807) · [`_okrFitDetailSections`](okr-apresentacao.slide.html#L2140) · [`objMarcos`](okr-apresentacao.slide.html#L1105)
- [`_okrViewerKey`](okr-apresentacao.slide.html#L3513) · [`_okrShowApp`](okr-apresentacao.slide.html#L3484) · [`_hojeStr`](okr-apresentacao.slide.html#L2215) · [`renderNotas`](okr-apresentacao.slide.html#L2273) · [`_okrAgendaHoje`](okr-apresentacao.slide.html#L2412) · [`_okrRenderCountdown`](okr-apresentacao.slide.html#L2458)

### `mare-notif-dev.js` (3 âncoras verificadas)
- [`AREAS`](mare-notif-dev.js#L56) · [`PUSH_PADRAO`](mare-notif-dev.js#L66) · [`TIPOS`](mare-notif-dev.js#L68)
