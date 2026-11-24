# 🔔 Sino unificado — um Sino só, com os layouts do Maré, em todos os apps (ideia do Caio, 24/11/2026)

**Pedido:** o Cardume precisa de Sino, e o ideal é **um Sino unificado**: o mesmo em todos os apps, com as notificações de todos eles e os **layouts por família** que o Maré já tem (👤 Pessoal · 📅 Calendário · 🎯 Radar · 🛡️ Sistema, com o rótulo do tipo).

**Hoje:** os **dados** já são comuns (o feed da torre em `MareNotif.items()`, a família e o rótulo em `MareNotif.aparencia(tipo)`, o rodapé em `MareNotif.rodapeHtml()`, o som em `MareNotif.novas()`). Mas **cada página desenha o próprio Sino**, e são quatro versões.

## Inventário (a especificação do componente)

| Página | Função | Fontes | Filtros próprios | Clique | Extras |
|---|---|---|---|---|---|
| **Maré** (`kanban-dev.html`) | `renderNotifs` | pessoais (cache próprio) + feed | `sinoLigado` | `openNotif`: **abre por dentro** (card, Intake, 📊 Dados, Gantt…) e cai no `urlPessoal` para o resto; o feed vai por `abrirFeed` | **layout por família** (`notif-familia-item`), Ilha Dinâmica (`_ilhaNotifs`, `_ilhaNotifGrupos`), modo insistente, toque do sino, ✕ por item |
| **Oceano** (`oceano-dev.html`) | `sinoRender` / `sinoItens` | pessoais (`orderByChild('ts')`, `limitToLast(80)`, sem `SO_PAINEL`, `viva`) + feed, **sem duplicar** (`vistos`; o `read` da pessoal vence) | bug do Assistente Férias (`nf_bug_*`) só para o dono ou o ADM | `urlPessoal` / `abrirFeed` em aba nova | marcar tudo como lido, limpar antigas, rodapé |
| **Radar** (`okr-dev.html`) | `_okrBellRender` | pessoais (`_okrNotifPessoais`) + feed | modo visualização (`_isPainelViewer`) | `_okrBellClick` (por dentro para objetivo, Mural e chat) | selo do Mural, limpar antigas (`noTTLDelete` vira `read` + `dismissed`) |
| **Painel** (`painel-dev.html`) | `renderPainelNotifs` + `_mergePainelNotifs` | grupos por fonte (notif, feed, …) | viewer, `SO_PAINEL` só aqui | por dentro (abas do Painel) | Central de Notificações (`renderNotifCentral`) |

**Destino de cada tipo:** o `urlPessoal` sempre devolve uma URL (o padrão é o Maré). Os tipos `intake`, `plantao_bug`, `rascunho`, `kudos` e `gcal_*` caem num destino genérico fora do Maré e do Painel: aceitável, e cada página pode melhorar pelo gancho `abrir`.

## Componente (no `mare-notif-dev.js`)

`MareNotif.sino(botao, opts)` monta o Sino num botão da página. A partir daí o módulo cuida de:
- **o selo**;
- **o painel com os layouts por família:** o CSS sai do Maré e vai para o `css()` do módulo, com valores de reserva para as variáveis que mudam de página para página;
- **a leitura das pessoais**, com a mesma consulta do Oceano: `orderByChild('ts')`, `limitToLast(80)`, `viva`, sem `SO_PAINEL` fora do Painel, e juntando com o feed sem duplicar;
- **os comandos:** marcar lida, ✕, marcar tudo, limpar antigas (com a regra do `noTTLDelete` do Radar), som/`novas`, insistente e rodapé.

**O que fica com cada página** (opções):
- `abrir(item)`: devolve `true` se a página tratou o clique por dentro; se não, o módulo abre por `urlPessoal`/`abrirFeed`;
- `filtro(item)`: por exemplo, o bug do Férias no Oceano e o viewer no Radar;
- `aoMudar(itens)`: para a Ilha Dinâmica do Maré;
- `extrasRodape`.

**Segurança:** o painel é montado com `createElement`/`textContent`, nunca com `innerHTML`. Qualquer pessoa da Hering consegue gravar nas `notificacoes` de outra (aceito no desenho do Cardume), então título e subtítulo são texto de terceiros. Os links passam pelo `hrefOk`/`urlPessoal`, que já existem.

## Cardume (primeiro a usar)
- **Funções do Firebase:** a página expõe `window._db`, `_ref`, `_onValue`, `_query`, `_orderByChild`, `_limitToLast`, `_update` e `_set`, que o módulo usa.
- **Uma contagem só:** o Sino e a aba **@ Menções** leem estados diferentes (`notificacoes/{n}/read` × `mencoes/{uid}/{r}/lida`). Ao abrir uma menção, por qualquer um dos dois, a página marca **os dois**: o registro tem `n` = id da notificação. O clique num `cardume_mencao` no Sino do próprio Cardume abre a menção pelo `abrirMencao`, sem recarregar.
- **Custo de banda:** cerca de 5 escutas a mais por aba (config, feed, torre, seen, prefs). Medir no piloto.

## Fases (um PR por página; o módulo e as páginas são promovidos juntos; cada mudança no módulo exige bump do `?v=` em todas as páginas que o carregam)
| # | Entrega | Quem |
|---|---|---|
| 1 | Componente no módulo + **Cardume** (Sino novo; Menções em sincronia) | Claude |
| 2 | **Oceano** passa a usar o componente (o mais próximo do modelo) | Codex (contrato) |
| 3 | **Radar** | Codex |
| 4 | **Painel** (viewer, `SO_PAINEL`, Central) | Codex |
| 5 | **Maré**, por último (o maior; Ilha Dinâmica e `openNotif` pelo gancho `abrir`) | Claude revisa / Codex |

Cada fase é validada no `-dev` antes da próxima. Nada vai para prod até o Maré migrar, ou então cada página sobe quando validada (decisão no momento de promover).
