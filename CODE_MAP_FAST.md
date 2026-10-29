# CODE_MAP_FAST.md — Índice Compacto de Navegação Rápida

> Gerado automaticamente por `node scripts/mare-cli.js map` em 2026-10-28.
> Use este índice para localizar rapidamente a linha no `CODE_MAP.md` ou as âncoras `Lxxxx` diretas nos arquivos `-dev`.

## 1. Sumário de Seções (`CODE_MAP.md`)

- **L37**: kanban.html / kanban-dev.html
  - **L39**: Papéis & autenticação
  - **L227**: Agentes de IA (cadastro — piloto híbrido humano+agente)
  - **L302**: Card — estrutura & modal
  - **L508**: Escrita de card no Firebase — 3 primitivas (não intercambiáveis)
  - **L627**: Rede de segurança — detecção ao vivo de card sumido inesperadamente
  - **L665**: ⛓ Dependências entre cards (bloqueio/ordem, não hierarquia — diferente de supercard)
  - **L690**: Tema (claro/escuro + 🌴 Vice City + 🕐 automático)
  - **L755**: Arquivados / arquivamento automático
  - **L803**: Comunicados / Mural (popup + badge + Mural)
  - **L872**: Modal do card no mobile — redesenho estilo Trello (2026-09-02, CSS puro, sem função nova)
  - **L886**: Cabeçalho mobile — menu "⋯" (2026-09-02)
  - **L899**: Board & render
  - **L1136**: `/monitorarbugs`: coluna "concluído" hardcoded em 9 funções (2026-09-04)
  - **L1208**: 📜 Histórico: data em período de vários dias (2026-09-04)
  - **L1216**: Busca (Ctrl+K + "Ver no board" + Busca nos Comentários do Card)
  - **L1233**: ⌨️ Atalhos de teclado personalizáveis (2026-09-07)
  - **L1295**: 🎛️ board_prefs — preferências pessoais do board sincronizadas por conta (2026-09-07, rodadas 1-5 de 5 — completo)
  - **L1462**: 🔀 Reorganizar barra de ferramentas (2026-09-07)
  - **L1506**: 💡 Personalização baseada em rotina (2026-09-11)
  - **L1583**: 👤 Minhas Preferências (2026-09-28)
  - **L1710**: ⎋ Esc fecha a tela aberta (2026-09-07)
  - **L1778**: Checklist (com grupos colapsáveis)
  - **L1784**: Campanhas (`openCamp()`, botão "📣 Campanhas")
  - **L1796**: Supercards / Ficha Técnica
  - **L1896**: Card lock / "Pedir o card"
  - **L1915**: Notificações in-app
  - **L1969**: 📅 Calendários (Google Calendar) — nunca teve seção própria até 2026-09-18
  - **L2000**: Notas
  - **L2008**: Automações (Butler-style)
  - **L2082**: Campos dedicados por squad: Submarca / Canal de venda
  - **L2140**: Botões exclusivos por squad na toolbar — 2 padrões diferentes, escolha proposital
  - **L2158**: Impedimentos (modo coluna vs. tag)
  - **L2374**: ⏸ Pausar card (tempo/métricas — 2026-09-03)
  - **L2406**: ⏱️ Tempo em atraso/bloqueado (arquivado — 2026-09-06)
  - **L2495**: Padrões de card (cardPatterns) — never indexado antes desta rodada
  - **L2527**: Agente Ágil (client-side — atalhos que postam @menção real)
  - **L2620**: Externos / segurança
  - **L2632**: Intake (pedidos pendentes — formulário público E `criar_card` do Agente Ágil)
  - **L2669**: Backup
  - **L2682**: 📊 Central de Dados (aba lateral `#dados-tab` → `#dados-drawer`) — captação digital, só leitura no board
  - **L2686**: Links / Modelos-Recorrentes-Agendamentos (`qlItems`) — escrita concorrente
  - **L2707**: Marcadores `// --- X ---` já existentes no código
- **L2716**: painel.html (prod — painel-dev.html diverge, confira com `diff` antes de assumir paridade)
  - **L2718**: Papel de usuário (2 mecanismos — `squads_roles` é o correto/atual)
  - **L2748**: 👥 Online no board × 🖥️ Online no painel (aba Visão) — 2 presenças distintas, nunca indexadas antes
  - **L2777**: 🔔 Central de Notificações (aba "Notificações" do painel-dev + catálogo em `mare-notif-dev.js`, 2026-10-10)
  - **L2783**: 🔋 Aba Status — Monitores do GitHub Pages e do Firebase (`painel.html` v5.68 / `painel-dev.html` v5.71, 2026-10-14)
  - **L2787**: Sino de notificações do PAINEL (`loadPainelNotifs()`/`renderPainelNotifs()`)
  - **L2826**: Aba "🛤️ Timeline" (criada 2026-09-04, presente nos dois arquivos —
  - **L2993**: Aba "🎯 OKR" (Objetivos/Marcos, Fase 1 — 2026-09-04, presente nos dois arquivos — promovido pra prod v3.18)
  - **L3508**: 🎯 `okr-dev.html` — OKR em página própria (2026-10-06, v1.0 · okr-dev; promovido como `okr.html` v1.0 · okr)
  - **L3553**: Tema claro/escuro/🌴 Vice City (2026-09-03, presente nos dois arquivos — promovido pra prod v3.08)
  - **L3606**: Visualizador externo (2026-08-27, promovido pra prod 2026-08-28 — presente nos dois arquivos)
  - **L3667**: Agentes Externos (2026-08-28/29, presente em painel.html e painel-dev.html;
  - **L3719**: Aba "🤖 Agentes" (2026-09-01, presente em painel.html e painel-dev.html;
  - **L3755**: Dashboard consolidado
  - **L3774**: Board Setup
  - **L3777**: Usuários
- **L3781**: oceano-dev.html (lobby da família Oceano — 2026-10-09, só dev; arquivo único, 2 `<script>`: módulo Firebase + IIFE)
- **L3793**: okr-apresentacao.slide.html — 🎙️ Apresentação ao vivo (2026-10-09; controle ADM em 2026-10-15): `liveInit()` (idempotente: `_liveIniciado`) ouve `kanban/okr/apresentacao_live`; `_isAdmOkr()`/`liveSouAdm()`/`livePodeControlar()` (host ou ADM tem controle total de moderação: laser, caneta, limpar traços, passar/aceitar/recusar controle, assumir a qualquer momento, sincronizar slide e encerrar); `_liveComecar`/`_liveEncerrar`/`_livePassar`/`_livePedir`/`_liveAssumir`/`_livePuxarSlide`/`_liveFerr` (laser/caneta)/`liveAplicar(forcar)` (acompanhar; `forcar` = apresentador que recarregou retoma a posição, 1x — `_liveRetomar`)/`liveAposNavegar()` (envolve `_okrGoTo`/`_okrOpenDetail`/`_okrCloseDetail`)/`liveRender()`/`liveDesenhar()` (canvas dos traços + ponto do laser).
- **L3795**: okr-apresentacao.slide.html (raiz do repo, sem `-dev` — nunca teve
- **L3946**: functions/ (Cloud Functions — deploy manual, sempre resincronizar antes, ver `CLAUDE.md`)
  - **L3948**: index.js — registro de exports
  - **L4007**: agente-agil-orquestrador/ (orquestrador novo — este é o documentado em `maredigital.html`)
  - **L4317**: agente-agil/ (agente v0-v3, HTTP, mais antigo — ainda deployado como `exports.agenteAgil`, mas não é o orquestrador documentado em `maredigital.html`)
  - **L4379**: intake/ e backup/ — online
  - **L4404**: okr/ — 2026-09-04, novo (+ `weeklySnapshot.js` e `agenteChat.js`/`agenteTools.js`/`agenteHelpers.js`/`agentePrompt.js` em 2026-09-05)
  - **L4506**: spotify/ — PAUSADO (2026-08-04)
  - **L4525**: painel — consumo de banda (cards incrementais, `usuarios` sob demanda) — v3.93
  - **L4535**: Segurança — handlers inline, identidade do rate limit, redirect (2026-10-05)
  - **L4541**: 💬 Indicador de comentários na face do card (2026-10-05)
  - **L4552**: 🧠 Conhecimento do Agente Ágil (`functions/agente-agil-orquestrador/conhecimento/`, 2026-10-10)
  - **L4557**: 💡 Dicas (mini popups) — `mare-dicas-dev.js` (módulo compartilhado, `?v=5`; em prod `mare-dicas.js?v=5` desde 2026-10-14: kanban v8.30.822, okr v2.78, oceano v1.34, painel v5.68)

## 2. Principais Âncoras por Arquivo (`-dev`)

### `kanban-dev.html` (7 símbolos mapeados)
- `_applyCardsSync` (L10316) · `_notasUpdate` (L20765) · `saveExtraDesc` (L15891) · `openNewCard` (L16698) · `backfillFlow` (L9266) · `recordMove` (L9140)
- `openCard` (L16261)
