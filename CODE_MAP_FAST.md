# CODE_MAP_FAST.md — Índice Compacto de Navegação Rápida

> Gerado automaticamente por `node scripts/mare-cli.js map` em 2026-11-10.
> Use este índice para localizar rapidamente a linha no `CODE_MAP.md` ou as âncoras `Lxxxx` diretas nos arquivos `-dev`.

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
  - **L1212**: Busca (🔍 Sonar `Ctrl+K` + `openSearch` + Busca nos Comentários do Card)
  - **L1230**: ⌨️ Atalhos de teclado personalizáveis (2026-09-07)
  - **L1292**: 🎛️ board_prefs — preferências pessoais do board sincronizadas por conta (2026-09-07, rodadas 1-5 de 5 — completo)
  - **L1458**: 🔀 Reorganizar barra de ferramentas (2026-09-07)
  - **L1502**: 💡 Personalização baseada em rotina (2026-09-11)
  - **L1579**: 👤 Minhas Preferências (2026-09-28)
  - **L1706**: ⎋ Esc fecha a tela aberta (2026-09-07)
  - **L1774**: Checklist (com grupos colapsáveis)
  - **L1780**: Campanhas (`openCamp()`, botão "📣 Campanhas")
  - **L1792**: Supercards / Ficha Técnica
  - **L1893**: Card lock / "Pedir o card"
  - **L1912**: Notificações in-app
  - **L1966**: ⏲ Timer e Produtividade (2026-11-01; promovido em 02/11; lógica extraída para `mare-timer-dev.js` `?v=1` + 🏝️ Ilha Dinâmica em 2026-11-10)
  - **L1984**: 📅 Calendários (Google Calendar) — nunca teve seção própria até 2026-09-18
  - **L2015**: Notas
  - **L2023**: Automações (Butler-style)
  - **L2097**: Campos dedicados por squad: Submarca / Canal de venda
  - **L2155**: Botões exclusivos por squad na toolbar — 2 padrões diferentes, escolha proposital
  - **L2173**: Impedimentos (modo coluna vs. tag)
  - **L2389**: ⏸ Pausar card (tempo/métricas — 2026-09-03)
  - **L2421**: ⏱️ Tempo em atraso/bloqueado (arquivado — 2026-09-06)
  - **L2509**: Padrões de card (cardPatterns) — never indexado antes desta rodada
  - **L2541**: Agente Ágil (client-side — atalhos que postam @menção real)
  - **L2634**: Externos / segurança
  - **L2647**: Intake (pedidos pendentes — formulário público E `criar_card` do Agente Ágil)
  - **L2684**: Backup
  - **L2697**: 📊 Central de Dados (aba lateral `#dados-tab` → `#dados-drawer`) — captação digital, só leitura no board
  - **L2701**: Links / Modelos-Recorrentes-Agendamentos (`qlItems`) — escrita concorrente
  - **L2722**: Marcadores `// --- X ---` já existentes no código
- **L2731**: painel-dev.html / painel.html (âncoras de dev; confira o `diff` antes de editar prod)
  - **L2733**: Papel de usuário (2 mecanismos — `squads_roles` é o correto/atual)
  - **L2763**: 👥 Online no board × 🖥️ Online no painel (aba Visão) — 2 presenças distintas, nunca indexadas antes
  - **L2792**: 🔔 Central de Notificações (aba "Notificações" do painel-dev + catálogo em `mare-notif-dev.js`, 2026-10-10)
  - **L2798**: 🔋 Aba Status — Monitores do GitHub Pages e do Firebase (`painel.html` v5.68 / `painel-dev.html` v5.71, 2026-10-14)
  - **L2802**: Sino de notificações do PAINEL (`loadPainelNotifs()`/`renderPainelNotifs()`)
  - **L2841**: Aba "🛤️ Timeline" (criada 2026-09-04, presente nos dois arquivos —
- **L3008**: okr-dev.html / okr.html — Radar (Objetivos/Marcos; antiga aba do Painel)
  - **L3523**: 🎯 `okr-dev.html` — OKR em página própria (2026-10-06, v1.0 · okr-dev; promovido como `okr.html` v1.0 · okr)
  - **L3570**: Calendário de gestão — entregas, agenda do agente e cobrança
- **L3581**: painel-dev.html / painel.html — demais áreas
  - **L3583**: Tema claro/escuro/🌴 Vice City (2026-09-03, presente nos dois arquivos — promovido pra prod v3.08)
  - **L3636**: Visualizador externo (2026-08-27, promovido pra prod 2026-08-28 — presente nos dois arquivos)
  - **L3697**: Agentes Externos (2026-08-28/29, presente em painel.html e painel-dev.html;
  - **L3749**: Aba "🤖 Agentes" (2026-09-01, presente em painel.html e painel-dev.html;
  - **L3785**: Dashboard consolidado
  - **L3804**: Saúde dos cards no Painel
  - **L3812**: Agente Ágil no Painel — conversa só de leitura
  - **L3823**: Board Setup
  - **L3826**: Usuários
- **L3831**: oceano-dev.html / oceano.html (lobby da família Oceano — âncoras de dev; arquivo único, 2 `<script>`: módulo Firebase + IIFE)
- **L3845**: okr-apresentacao.slide.html — 🎙️ Apresentação ao vivo (2026-10-09; controle ADM em 2026-10-15): `liveInit()` (idempotente: `_liveIniciado`) ouve `kanban/okr/apresentacao_live`; `_isAdmOkr()`/`liveSouAdm()`/`livePodeControlar()` (host ou ADM tem controle total de moderação: laser, caneta, limpar traços, passar/aceitar/recusar controle, assumir a qualquer momento, sincronizar slide e encerrar); `_liveComecar`/`_liveEncerrar`/`_livePassar`/`_livePedir`/`_liveAssumir`/`_livePuxarSlide`/`_liveFerr` (laser/caneta)/`liveAplicar(forcar)` (acompanhar; `forcar` = apresentador que recarregou retoma a posição, 1x — `_liveRetomar`)/`liveAposNavegar()` (envolve `_okrGoTo`/`_okrOpenDetail`/`_okrCloseDetail`)/`liveRender()`/`liveDesenhar()` (canvas dos traços + ponto do laser).
- **L3847**: okr-apresentacao.slide.html (raiz do repo, sem `-dev` — nunca teve
- **L3998**: travessia-dev.html / travessia.html — desenvolvimento de pessoas
  - **L4000**: Travessia — Baú, Diário, faróis, Frota e avaliação
- **L4012**: minipainel.html — resumo operacional
  - **L4014**: Mini painel — página e endpoint oceanoResumo
- **L4023**: functions/ (Cloud Functions — deploy manual, sempre resincronizar antes, ver `CLAUDE.md`)
  - **L4025**: index.js — registro de exports
  - **L4093**: cards/ — Guardião dos cards
  - **L4102**: Intake no Agente Ágil — origem externa do card
  - **L4107**: agente-agil-orquestrador/ (orquestrador novo — este é o documentado em `maredigital.html`)
  - **L4417**: agente-agil/ (agente v0-v3, HTTP, mais antigo — ainda deployado como `exports.agenteAgil`, mas não é o orquestrador documentado em `maredigital.html`)
  - **L4479**: intake/ e backup/ — online
  - **L4504**: okr/ — 2026-09-04, novo (+ `weeklySnapshot.js` e `agenteChat.js`/`agenteTools.js`/`agenteHelpers.js`/`agentePrompt.js` em 2026-09-05)
  - **L4606**: spotify/ — PAUSADO (2026-08-04)
  - **L4625**: painel — consumo de banda (cards incrementais, `usuarios` sob demanda) — v3.93
  - **L4635**: Segurança — handlers inline, identidade do rate limit, redirect (2026-10-05)
  - **L4641**: 💬 Indicador de comentários na face do card (2026-10-05)
  - **L4652**: 🧠 Conhecimento do Agente Ágil (`functions/agente-agil-orquestrador/conhecimento/`, 2026-10-10)
  - **L4657**: 💡 Dicas (mini popups) — `mare-dicas-dev.js` (módulo compartilhado, `?v=12`; em prod `mare-dicas.js?v=10`: kanban v8.30.923, okr v2.105, oceano v1.69, painel v5.96)

## 2. Principais Âncoras por Arquivo (`-dev`)

### `kanban-dev.html` (7 símbolos mapeados)
- `_applyCardsSync` (L10766) · `_notasUpdate` (L21425) · `saveExtraDesc` (L16460) · `openNewCard` (L17301) · `backfillFlow` (L9508) · `recordMove` (L9382)
- `openCard` (L16861)
