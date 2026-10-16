# Changelog

Registro de mudanças do Maré Digital e demais ferramentas deste repositório,
organizado por página e versão (ver `version.json`). Cada entrada linka o PR
correspondente — `git diff <tag-antiga> <tag-nova>` mostra o diff exato do
que foi ao ar entre duas versões.

**Convenção de tags:** `kanban-vX.Y.Z` (produção), `kanban_dev-vX.Y.Z-dev`
(ambiente de teste), `painel-vX.Y`, `painel_dev-vX.Y-dev` — sempre no commit
de merge que efetivamente publicou aquela versão (o merge pra `main`, já
que o deploy do GitHub Pages roda automaticamente a partir daí). Ver seção
"Processo de release" no `CLAUDE.md` para o fluxo completo.

Este arquivo passou a ser mantido em 2026-07-24; histórico anterior a essa
data existe no `git log` mas não foi documentado retroativamente aqui (ver
`git log -- kanban.html` / `git log -- painel.html` etc. pro histórico
completo, incluindo commits antigos sem PR/descrição detalhada).

> **📌 Escopo deste arquivo (a partir de out/2026):**
> - **O que entra aqui:** apenas **novas funcionalidades (features)** e **grandes melhorias/correções estruturais**.
> - **Onde ficam os bugs e correções técnicas:** em [`BUGS_E_CORRECOES.md`](BUGS_E_CORRECOES.md) (inclui a seção `🛡️ Armadilhas Conhecidas` e achados do `/monitorarbugs`).
> - **Histórico anterior:** entradas de jul/2026 a set/2026 estão arquivadas em [`docs/changelog-archive-2026-07-a-09.md`](docs/changelog-archive-2026-07-a-09.md).


## kanban.html (produção)

### SÓ DEV — Automação Zero-Approval (`mare-cli.js ship` & `check-script`) + Suporte a `mare-plantao.js` — 2026-10-16

- **`node scripts/mare-cli.js check-script` (`verifyConsoleTestScript`):** validador estático e de escopo para scripts de teste de console (`F12 → Console`) que verifica sintaxe JS (`vm.Script`), conformidade read-only (bloqueando `_set`/`_update`/`_remove`/`saveCard`), ausência de reatribuição de `const` globais da página (como `today` em `kanban-dev.html`) e existência real de todas as funções livres e IDs DOM chamados no script contra o arquivo `-dev.html` e seus módulos compartilhados (prevenindo erros como `ReferenceError: fmtDate is not defined`, Linha Vermelha #4).
- **`node scripts/mare-cli.js ship` (`.mare-ship.json`):** pipeline declarativo de entrega em 1 único clique que lê o manifesto `.mare-ship.json` (gerado via `write_to_file` sem prompt de terminal), valida o script de teste antes de tocar no Git, preserva arquivos editados em memória durante o `git fetch origin && git checkout -B <branch> origin/main` (eliminando conflitos de stash em `version.json`, `CHANGELOG.md` e `BUGS_E_CORRECOES.md`), executa `promote`/`bump`/`log`/`map`/`conhecimento`/`checar.js`, commita com `Agent: antigravity`, faz push e cria/atualiza a PR via `--body-file` (sem problemas de escape no PowerShell).
- **Suporte ao módulo `mare-plantao-dev.js` / `mare-plantao.js`:** registrado em `scripts/mare-cli.js` (`SHARED_MODULES`, `MODULE_TARGET_MAP`, `MAP_TARGET_FILES`) e em `.claude/skills/subirproprod/promover.js` (`TARGETS` e preservação de pares `-dev`/prod).
- **Inspeção Zero-Terminal (`.claude/skills/seatualizar/SKILL.md`, `.claude/skills/plantaobug/SKILL.md`, `AGENTS.md`):** leitura direta de `.git/HEAD`, `.git/logs/HEAD` (`view_file`) e comentários de revisão do Claude nas PRs (`read_url_content`) sem acionar terminal.

### 2026-10-16 — Plantão: comentário no card com o resumo da correção ao validar (PROD · painel v5.79 · oceano v1.52 · mare-plantao.js v2)

Quando o ADM clica em "Rodei o script e validei" (Painel › Monitor › Plantão), o card do bug na squad Dados ganha um comentário com o resumo da correção: PR (número e título), o que mudou (seção "## Resumo" da PR), quem validou, a nota do ADM e o resultado do teste. O servidor (`plantaoGithubWebhook`) passa a guardar `prTitulo` e `prResumo` na ficha ao receber a PR; sem eles o comentário sai só com PR, validador e nota. Dev: mare-plantao-dev.js ?v=2, painel-dev v5.79, oceano-dev v1.52. **Exige** `firebase deploy --only database` (campos novos da ficha) e `--only functions:plantaoGithubWebhook`.

### 2026-10-16 — Ecossistema de gestão (ecossistema.html): documentação técnica do Oceano para a TI (PROD · oceano v1.52 com o botão)

Nova página `ecossistema.html` (sem versão própria; entra no ar no merge), escrita para a reunião com a TI de 30/10: arquitetura, uso do Google Cloud e da conta corporativa, segurança e inventário de dados, ambientes dev × prod, Agente Ágil e consumo de tokens (mecanismos com a evidência no código), Claude × Antigravity, skills e subagentes, política de PR/CI/auditoria no GitHub, personalização por squad, dependências, riscos e caminho de internalização. Números medidos no repositório (comandos na seção 14). `maredigital.html` passa a ser a referência detalhada do Maré Digital e aponta para ela; o botão "Ecossistema de gestão" no Oceano (oceano v1.52) abre a página.

### 2026-10-16 — Busca nos comentários do card (Ctrl+K), Comunicados Multi-Squad e atualização de documentações (PROD · kanban v8.30.874 · painel v5.79 · oceano v1.52) · antes kanban-dev v8.30.872-dev · painel-dev v5.78-dev · oceano-dev v1.50-dev

- **Busca nos comentários do card (`Ctrl+K` em `kanban-dev.html`):** com o modal de um card aberto (`#card-ov.open`), apertar `Ctrl+K` (ou clicar no botão `🔍 Buscar Ctrl+K` no cabeçalho de comentários) abre a barra `#m-comment-search-bar` (`toggleCommentSearch()`, `onCommentSearchInput()`) para filtrar comentários por conteúdo, `@autor` ou data (`dd/mm/aaaa hh:mm`), exibindo contador `X de Y` e grifando os termos encontrados (`<mark class="comment-search-hl">` via `_highlightDomTextNodes()`) sem quebrar o Markdown. O `Escape` dentro do campo usa `stopPropagation()` para fechar apenas a busca sem fechar o card. **Dica:** não, porque o próprio cabeçalho da seção de comentários já exibe o botão visível `🔍 Buscar Ctrl+K`.
- **Seleção de múltiplas squads em Comunicados (`painel-dev.html`, `kanban-dev.html`, `oceano-dev.html`):** o modal `#comunicado-compose-ov` substituiu o `<select>` único pelo seletor de chips multi-squad `#cc-squad-chips` (`_ccSelectedSquads`, `_ccToggleSquadChip()`, `_ccRenderSquadChips()`, `_ccGetSquadPayload()`), permitindo direcionar um aviso para **Todos os squads** (`squad: "*"`), **1 squad** ou **2+ squads simultaneamente** (`squad: "multi"`, `squads: [...]`). Leitores atualizados em `painel-dev.html` (`_comunicadoSquadsAlvo()`, `_comunicadoAlvoLabel()`, `_painelResolveComunicadoAlvos()`), `kanban-dev.html` (`_refreshComunicados()`) e `oceano-dev.html` (`avPodeVer()`). **Dica:** não, pois é uma ação administrativa restrita ao composer de Comunicados do Painel.
- **Documentações sincronizadas (`/atualizardocumentacoes`):** atualizados `maredigital.html`, `docs/OCEANO.md`, `HELP_CONTENT` (`kanban-dev.html`), `CODE_MAP.md`, `CODE_MAP_FAST.md` e a base de conhecimento do Agente Ágil (`functions/agente-agil-orquestrador/conhecimento/`) contemplando `mare-metas.js` v16 (👻 Projeção de Fechamento), `mare-plantao.js` v1 (Plantão de Bugs no Oceano e Painel), busca nos comentários do card e comunicados multi-squad.

### 🎯 Projeção nas metas: onde a meta termina se o ritmo continuar (`mare-metas.js` v16 · `oceano.html` v1.49 · `painel.html` v5.77) — 2026-10-16 · oceano v1.48→v1.49 · painel v5.76→v5.77 · kanban v8.30.870→v8.30.871 · mare-metas.js v14→v16 (PROD)

- Pedido do Rafael: além do esperado (tique branco) e do realizado (arco), as metas ganham a PROJEÇÃO — onde a meta termina se o ritmo continuar. Conta = realizado ÷ meta acumulada até ONTEM × meta total (a mesma do Data Studio e do resumo diário: 17,62M vs 15,06M = 117% → R$ 35,17 mi). Respeita a diarização.
- Anel: 'volta fantasma' (arco translúcido até a projeção, limitado a 100%); gráfico acumulado: linha pontilhada até o fim do período com o valor projetado; KPI '👻 Projeção'.
- Sem base (1º dia, sem valor, meta batida, período encerrado) não projeta. Dica: não — o tooltip do anel e o KPI explicam.

### 🛟 Plantão de Bugs: Oceano só com a visão do usuário e controle de ADM no Painel › Monitor (`oceano.html` v1.48 / `painel.html` v5.76 / `mare-plantao.js`) — 2026-10-16 · oceano v1.36→v1.48 · painel v5.75→v5.76 · kanban v8.30.865→v8.30.870 · mare-plantao.js v1 (PROD)

- Em produção: aviso do assistente minimizado e dispensável no Oceano; 🛟 Plantão de Bugs na aba 🐛 Monitor do Painel; módulo mare-plantao.js; correção da barra de checklist (2/3 = 67%).
- Painel: ordenação de relatos tolera criadoEm numérico (Oceano grava número).
- Dica: não — ferramenta de ADM.

### 2026-10-16 — Plantão de Bugs: Oceano só com a visão do usuário; controle de ADM no Painel › 🐛 Monitor (PROD · oceano v1.48 · painel v5.76)

- Oceano: o aviso do assistente abre minimizado (uma linha) e pode ser dispensado com ✕; a aba 🐛 Reportar Bug mostra só o formulário e Meus chamados — pacote, PR, script, validação e comando do agente saíram de lá.
- Painel › 🐛 Monitor ganhou 🛟 Plantão de Bugs: fichas, PR + script de teste, validar/reprovar, 🚀 em produção, avisar quem reportou, pausa geral e batimento do Antigravity.
- Novo módulo compartilhado mare-plantao-dev.js (card na Squad Dados, aviso ao autor, pacote anônimo, tela do ADM); fichas ganham app/autorUid/autorNome (exige firebase deploy --only database e redeploy de plantaoBugNovo).
- Dica: não — é ferramenta de ADM e o aviso do Oceano já é o próprio lembrete.

### oceano-dev.html v1.47 (2026-10-16) — SÓ DEV, ainda não promovido para oceano.html — Plantão automático: o Antigravity busca o bug sozinho e o GitHub registra a PR (funções + regras, exige chaves, deploy e webhook)

- **`plantaoProximo`** (`functions/plantao/agente.js`): GET com chave que entrega o próximo bug ao Antigravity (tarefa agendada dele; `read_url_content` não pede aprovação) como pacote anônimo + branch + instruções, com lease de 3 h, máximo de 3 entregas e teto de requisições; relato marcado como DADO.
- **`plantaoGithubWebhook`** (`functions/plantao/webhook.js`): o GitHub avisa (HMAC-SHA256) quando a PR `antigravity/bug-<id>` abre; o servidor grava link da PR + script de teste (corpo da PR) na ficha e avisa os ADMs; push depois de validada desfaz a validação.
- **Vigia** avisa quando o Antigravity para de buscar (> 2 h com bug esperando); **Oceano** mostra o batimento. Regras: `plantao_status` (só ADM lê) e campos `prSha`/`entregaEm`/`entregas` na ficha.
- **Exige:** 2 secrets, `--only database`, deploy das 3 funções, webhook no GitHub e a tarefa agendada (`docs/PLANTAO_BUGS.md`, "Modo automático"). **Dica:** não — ferramenta de ADM.

### oceano-dev.html v1.45 (2026-10-16) — SÓ DEV, ainda não promovido para oceano.html — Plantão de Bugs: ficha, validação pelo ADM, aviso e vigia (funções + regras, exige deploy)

- **Servidor** (`functions/plantao/plantao.js`, novo): `plantaoBugNovo` cria a ficha do bug em `kanban/plantao/{id}`, junta duplicados (mesmo arquivo-alvo + descrição parecida, sem IA) e avisa os ADMs (sino + push, tipo `plantao_bug`, sem autor/e-mail; clicar abre o card do bug na squad Dados); `plantaoVigia` (de 3 em 3 h, 08–20h de Brasília) avisa de bug parado. Pausa geral: `kanban/config/plantao_ativo = false`.
- **Regras** (`database.rules.json`, nó `kanban/plantao`): só ADM lê/escreve; estado só da lista; PR só de `caiosoares1899/hering`; `validadoPorUid` = quem grava. **Exige `firebase deploy --only database` e `--only functions:plantaoBugNovo,functions:plantaoVigia,functions:sendPushOnNotification`** (passo a passo em `docs/PLANTAO_BUGS.md`).
- **Oceano** (aba 🐛 Reportar Bug, só ADM): painel por bug com PR, script de teste, nota, ✅ validei / ❌ reprovei (máx. 3 → escalado ao Claude), 🚀 em produção (resolve o bug e avisa quem reportou) e botão ⏸ pausar plantão. Sem PR + script salvos não valida; quem reportou não valida o próprio.
- **Sino:** tipo `plantao_bug` no catálogo da Central de Notificações (`mare-notif-dev.js ?v=32`).
- **Dica:** não — ferramenta restrita a ADM, sem recurso novo para o público.

### oceano-dev.html v1.41 (2026-10-16) — SÓ DEV, ainda não promovido para oceano.html — Assistente Férias: criação e atualização automática de Card na coluna Bugs da Squad Dados

- **Criação e atualização automática de Card na Squad `Dados` (coluna `Bugs`) para cada bug do Assistente Férias (`feriasGarantirColunaBugsDados`, `feriasMontarCardBugDados`, `feriasSincronizarCardSquadDados`):**
  - Ao registrar um bug no Assistente Férias (`feriasEnviarBug`) — ou ao sincronizar via GitHub Issues (`feriasSincronizarGithubIssues`) / carregar chamados existentes sem card (`feriasProcessarSnapshotBugs`) — o Oceano localiza a coluna **`Bugs`** em `kanban/squads/dados/dados/columns` (ou cria `{ id: 'col_bugs', name: '🐛 Bugs' }` caso ainda não exista) e aloca atomicamente via `runTransaction` em `cards_index` um card individual (`c_ferias_<ts>`) em `kanban/squads/dados/dados/cards`.
  - O card é preenchido com título (`[Bug Férias · <App>] ...`), prioridade mapeada do impacto (`critical`/`high`/`medium`), tag `bug`, descrição completa (status, app/arquivo, autor/e-mail, relato, link/evidência, erros vermelhos do F12, print, link da Issue no GitHub e resposta da resolução), links clicáveis, checklist de 3 etapas e histórico de comentários em `card_comments/<cardId>` (`ts` sempre em ISO string).
  - Sempre que o bug muda para **🔵 Sendo tratado** ou **🟢 Resolvido** (pela fila automática do Antigravity no GitHub ou pelo painel ADM), o card correspondente na Squad `Dados` tem sua descrição e checklist atualizados e recebe um novo comentário documentando o andamento/solução, além de exibir o botão/chip direto **`📋 Card Squad Dados (Bugs)`** (`kanban-dev.html?squad=dados&card=<cardId>`) no Assistente Férias.

### oceano-dev.html v1.38 (2026-10-16) — SÓ DEV, ainda não promovido para oceano.html

- **🔔 Retorno Automático de Status ao Autor do Bug (`🟡 Na fila` → `🔵 Sendo tratado` → `🟢 Resolvido`) + Sincronização com GitHub Issues (`feriasSincronizarGithubIssues`)**: seção **"📬 Meus Chamados de Bug"** (`feriasHtmlMeusChamados`), alerta clicável no próprio banner da home do Oceano (`feriasBannerAlertaAutorHtml`) quando um chamado do usuário está em tratamento ou foi resolvido, disparo automático de notificação no sino global (`🔔` em `kanban/notif_feed` e `kanban/usuarios/<uid>/notificacoes`) para quem abriu o pedido (`feriasDispararNotifStatusBug`), e sincronização automática com as Issues do GitHub (`feriasSincronizarGithubIssues` lendo `<!-- FERIAS_STATUS: em_analise|resolvido -->` postado pelo Antigravity e atualizando `kanban/feedback/<bugId>` sem intervenção manual).
- **📖 Guia Rápido de Uso & Evidências / Erros Vermelhos do DevTools (`F12`)**: passo a passo visual (`feriasBlocoGuiaDevtoolsHtml`) ensinando como usar o Assistente e como copiar os erros vermelhos da aba `Console` (`F12`), zona para colar print da tela com `Ctrl+V` (`feriasComprimirImagem` via `<canvas>`), campo de link/card e campo dedicado para erros do Console com captura automática de dados técnicos do navegador (`feriasPreencherDadosTecnicos`).
- **🏖️ Assistente Férias do Caio (16/10 a 03/11) + Ponte `/monitorarbugs` (`v1.37-dev`)**: banner automático na home do Oceano (`#ferias-caio-host`, ativo até `2026-11-03` ou via `?ferias=1`) e modal interativo (`#ferias-ov`) com 6 abas (`💬 Perguntar`, `🆘 Socorro Rápido`, `🚀 Onde Paramos`, `🗺️ Próximos Passos`, `📖 Guia Rápido & DevTools` e `🐛 Reportar Bug`).

### 🎯🌊 Meta Global na página inicial do Oceano (`oceano.html` v1.36) + opção "Mostrar no Oceano" no Painel (`painel.html` v5.75 / `mare-metas.js` v14) — 2026-10-15 · oceano v1.34→v1.36 · painel v5.74→v5.75 · kanban v8.30.864→v8.30.865 · mare-metas.js v13→v14 (PROD)
- **🌊 Destaque da Meta Global na página inicial do Oceano (`#col-meta`, `iniciarMetasOceano`, `metaOceanoRender` em `oceano.html` v1.36 e `MareMetas.painelOceanoHtml` em `mare-metas.js` v14):** a área principal (`#inicio-grid`) do Oceano agora acomoda a coluna **🎯 Meta Global · Digital** ao lado dos atalhos dos produtos (`.col-apps`) e do **📌 Mural de avisos** (`#col-mural`), adaptando o grid automaticamente para 2 ou 3 colunas conforme haja meta publicada e/ou mural ativo (`.tem-meta`, `.tem-mural`, `.tem-meta.tem-mural`). Exibe o hero card completo da meta principal do Digital (percentual gigante, barra com agulha do esperado hoje, realizada × alvo, situação, ritmo por dia, gráfico de evolução com alternância **Acumulado / Por dia** e botão **⛶ Expandir**, além de botão **＋ Atualizar** para responsáveis/editores de Dados/ADM) e cartões compactos caso mais de uma meta/desafio do Digital esteja marcada para o Oceano.
- **🎛️ Opção de escolher se a meta do Digital vai para o Oceano (`m.oceano`, `#mm-f-oceano`, `definirOceano` em `mare-metas.js` v14 e `painel.html` v5.75):**
  - No modal de criar/editar meta do Digital (**Painel → 📊 Dados → 🎯 Metas do Digital** ou **Maré → ⚙ Config → 🐟 Metas**), novo checkbox **🌊 Mostrar na página inicial do Oceano** (ligado por padrão ao criar uma nova meta principal do Digital).
  - Nos cartões de metas do Digital no Painel e na aba Dados, novo botão rápido de 1 clique (**`🌊 No Oceano`** / **`🌊 Mostrar no Oceano`**) para ligar ou desligar a exibição no Oceano sem precisar abrir o formulário de edição, além do selo **`🌊 No Oceano`** identificando quais metas estão visíveis no lobby. Dica: não (visualização automática na home do Oceano e controle direto e autodescritivo nos cartões do Painel).

### 📚 Sincronização completa da documentação (Central de Ajuda do Maré, Guia OKR, FAQ do Oceano, `docs/OCEANO.md`, `maredigital.html`, `CODE_MAP.md` e `AGENTS.md`) — 2026-10-15 · kanban v8.30.863→v8.30.864 · oceano v1.34→v1.35 · `guia-okr.html` · `maredigital.html` · `CODE_MAP.md` · `docs/OCEANO.md` · `AGENTS.md` (PROD)
- **❓ Central de Ajuda e textos inline do Maré Digital (`HELP_CONTENT` e `#cfgtab-metas` em `kanban.html` v8.30.864):**
  - **Submarca `Geral` (`tag_sm_geral`):** atualizado de 10 para **11 etiquetas fixas de Submarca** em `HELP_CONTENT.cards` (*"🔒 Prazo, Submarca e Canal obrigatórios"*), `HELP_CONTENT.board` (*"📥 Formulário de intake"*) e `HELP_CONTENT.config` (*"🏷️ Submarca"*), explicando o uso de `Geral` para demandas transversais a todas as marcas.
  - **🐟 Metas ("O mar tá pra peixe" — `mare-metas` v13):** documentados em `HELP_CONTENT.board` (*"🐟 Metas e desafios"*), `HELP_CONTENT.config` (novo tópico *"🐟 Metas (configuração e popups de marco)"*) e no cabeçalho de `#cfgtab-metas` a alternância **Acumulado / Por dia** no gráfico de evolução (com linha tracejada do esperado do dia), o botão **⛶ Expandir** (tela cheia com tabela diária comparando Realizado, Esperado e ∆ diferença) e a seção **🎉 Popups de marco (20% a 100%)** para personalizar título, mensagem e emoji de cada marco.
  - **📅 Escala (`escala.html` v1.10):** atualizado em `HELP_CONTENT.board` (*"📅 Calendário"*) e `HELP_CONTENT.comunicacao` (*"Escala (quem trabalha quando)"*) com o botão **🔎 Filtros** (squad/subtime), a **📊 Visão Gantt** do dia (com exportação em JPG), o registro de **☕ pausas** e o modo somente-leitura para quem não edita a squad.
- **📘 Guia Visual do Radar (`guia-okr.html`) e Central de Ajuda (`#okr-help-ov` em `okr.html` v2.89):** documentados no guia de slides a edição (`✏️`) e exclusão (`🗑️`) de anotações em qualquer data e direto pelo **📅 Calendário**, a moderação de **ADM** em anotações e na Apresentação ao Vivo (**👑 Assumir** e **📍 Puxar sala**), o fluxo de promoção **Próximo Passo (`✅`) → Progresso (`🏁`) → Marco** (na tela e via Agente Ágil), a aba **📊 Data Studio** e a validação de limites de caracteres pelo Agente Ágil.
- **🌊 FAQ do Oceano (`oceano.html` v1.35) e `docs/OCEANO.md`:** atualizado o item `vtex` do FAQ e o documento da família Oceano para refletir que o indicador do topo (`#vtex-pill`) monitora **6 serviços em tempo real** (**VTEX, Shopify, Cloudflare, GitHub, OpenAI e Claude**), além de atualizar o resumo da **Escala v1.10**, **Radar v2.88/v2.89** e **Metas v13**.
- **🗺️ Documento Técnico (`maredigital.html`), Mapa do Código (`CODE_MAP.md`) e Fluxo Multiagentes (`AGENTS.md`):** sincronizadas todas as versões de referência de `15/10/2026`, árvore RTDB de `okr/` (`anotacoes`, `datastudio`), ferramentas de escrita e promoção do `okrAgenteChat` (`promover_item_okr`, `OKR_CHAR_LIMITS`), âncoras de código em `CODE_MAP.md` e a arquitetura de 4 subagentes especialistas em paralelo (`agente-mare`, `agente-radar`, `agente-painel-oceano`, `agente-functions-docs`) em `AGENTS.md`. Dica: não (atualização de documentação).

### 🚀 Radar (`okr.html` v2.89) e Agente Ágil (`okrAgenteChat`): fluxo de promoção Próximo Passo → Progresso → Marco — 2026-10-15 · okr v2.88→v2.89 · mare-dicas.js v5→v6 · Cloud Function `okrAgenteChat` (PROD)
- **✅ Promover Próximo Passo a Progresso (`_okrPromoverParaProgresso` em `okr.html`):** cada item de **➡️ Próximos Passos** no modal de Objetivo agora traz o botão **`✅`** (*"Promover para Progresso"*). Ao clicar, o item é movido (removido de `proximosPassos` e adicionado em `progressos`) com feedback imediato no toast (`✅ Próximo passo movido para Progressos — clique em Salvar para confirmar`).
- **🏁 Promover Progresso a Marco (`_okrPromoverParaMarco`, `openOkrMarco(null, objId, prefill)`, `_saveOkrMarcoInner` em `okr.html`):** cada item de **✅ Progressos** agora traz o botão **`🏁`** (*"Promover para Marco"*). Ao clicar (em um Objetivo já salvo), abre o modal **Novo Marco** já pré-preenchido com o texto do progresso (truncado em `70` caracteres se necessário), status **`✅ Concluído`**, prazo de **hoje** (`_todayStr()`) e responsável sugerido (1º responsável do Objetivo ou o próprio usuário), exibindo o aviso `🏁 Promovendo de Progressos — ao salvar este Marco, o item será removido da lista de Progressos do Objetivo para não ficar duplicado.` Assim que a pessoa revisa e clica em **`💾 Salvar`** no Marco, o Marco é criado e o item original é automaticamente removido de `obj.progressos` (e do rascunho/snapshot aberto no modal do Objetivo, registrando no histórico `Promoveu progresso "..." a Marco`).
- **🤖 Ferramenta `promover_item_okr` no Agente Ágil do Radar (`promoverItemOkrSchema`, `makePromoverItemOkrHandler` em `functions/okr/agenteTools.js` e `SYSTEM_PROMPT_OKR_V1` em `functions/okr/agentePrompt.js`):** o chat do Agente Ágil agora realiza os dois passos do fluxo sob comando natural (ex.: *"o próximo passo X foi concluído, vira progresso"* ou *"transforma o progresso Y em marco"*):
  - `tipo: 'proximo_passo_para_progresso'`: localiza o item em `proximosPassos` (por `indice` ou busca em `texto_item`), remove de `proximosPassos` e adiciona em `progressos` (respeitando o limite de `90` caracteres e registrando no histórico).
  - `tipo: 'progresso_para_marco'`: localiza o item em `progressos`, cria o Marco em `kanban/okr/marcos` (padrão `progresso: 'concluido'`, `prazo` = hoje, `responsavel` = 1º responsável do Objetivo; respeita o limite de `70` caracteres do slide), remove o item de `progressos`, publica no sino da torre se concluído e registra no histórico + notifica responsáveis.
- **💡 Nova dica in-app e Ajuda do Radar (`promover-fluxo` em `mare-dicas.js` v6; `#hlp-objetivo`, `#hlp-editar` e `#hlp-agente` em `okr.html`):** adicionada a dica `{id: 'promover-fluxo', gatilho: 'obj-modal'}` (*"Um próximo passo avançou? Use ✅ pra virar Progresso e 🏁 num Progresso pra promovê-lo a Marco."*) e documentado o fluxo na Central de Ajuda do Radar. Dica: sim (`promover-fluxo` ao abrir o modal de Objetivo para quem tem permissão de edição).

### 🤖 Agente Ágil no Radar (`okrAgenteChat` — `functions/okr/`) e Apresentação Executiva (`okr-apresentacao.slide.html`): respeito aos limites de caracteres, validação de resumo com o usuário e títulos longos sem corte — 2026-10-15 · Cloud Function `okrAgenteChat` · `okr-apresentacao.slide.html` (PROD)
- **📏 Trava de limite de caracteres da Apresentação Executiva (`OKR_CHAR_LIMITS`, `validarLimitesCaracteres` em `functions/okr/agenteTools.js`):**
  - Como cada Objetivo do Radar é projetado em um slide único (`okr-apresentacao.slide.html`), as ferramentas de escrita do Agente Ágil (`criar_objetivo`, `editar_campos_okr`, `criar_marco` e `editar_marco`) agora validam os mesmos limites de caracteres da tela antes de gravar no banco: **Título do Objetivo** (`titulo` / `novo_titulo`: máx. `90` caracteres), **Pilar estratégico** (`pilar`: máx. `60`), **Descrição do Objetivo** (`descricao`: máx. `200`), **itens de lista** (`indicadores`, `progressos`, `proximos_passos`, `riscos`, `planos_acao`: máx. `90` por item) e **Nome de Marco** (`nome` / `novo_nome`: máx. `70`).
  - Se qualquer campo ou item de lista ultrapassar o limite, o handler recusa a gravação com `error: 'limite_caracteres_excedido'`, detalhando exatamente qual campo estourou (`tamanho`/`limite`) sem salvar textão no Objetivo.
- **💬 Validação com a pessoa quando precisar resumir (`SYSTEM_PROMPT_OKR_V1` em `functions/okr/agentePrompt.js`):** o prompt e as descrições das tools agora instruem o Agente Ágil a nunca tentar salvar textos longos nem cortar informações importantes no escuro — quando o pedido da pessoa passar do limite do slide, o agente redige uma sugestão enxuta dentro do limite (mostrando a contagem de caracteres, ex.: `168/200 caracteres`), apresenta no chat via `responder` e pede validação (`"Posso gravar assim?"`) antes de efetivar a gravação.
- **🔤 Títulos longos sempre inteiros na Apresentação Executiva (`.d2-title`, `_okrFitDetailSections`, `.obj-title`, `.ger-row .gr-name`, `.mc-hd h3` em `okr-apresentacao.slide.html`):** removido o corte por `-webkit-line-clamp: 2; overflow: hidden;` do título do Objetivo no detalhe (`.d2-title`) e o `text-overflow: ellipsis; white-space: nowrap;` dos títulos de Gerência na capa da torre (`.ger-row .gr-name`) e do cabeçalho de comentários do Marco (`.mc-hd h3`). Além disso, `_okrFitDetailSections()` agora readequa automaticamente o `font-size` de `.d2-title` (reduzindo gradualmente até `15px` antes de medir o corpo e o rodapé quando o título passa de 2 linhas), garantindo que qualquer título caiba inteiro sem reticências e sem espremer o restante do slide. Dica: não (ajuste automático de layout e comportamento interno do Agente Ágil).

### 🏷️ Nova opção de Submarca `Geral` (`tag_sm_geral`) para cards que valem para todas as marcas — 2026-10-15 · v8.30.861 → v8.30.863 (PROD) / v8.30.863-dev
- **🏷️ Submarca `Geral` adicionada a `SUBMARCA_TAGS` (`kanban.html`, `kanban-dev.html`, `intake.html`, `intake-dev.html`, `functions/agente-agil-orquestrador/tools/criarCard.js`):**
  - Quando o time precisar registrar um card transversal que vale para todas as marcas/todo mundo, agora há a opção **`Geral`** (`id: 'tag_sm_geral'`) ao lado das 10 submarcas existentes (Hering Adulto, Kids, Sports, Intimates e Teen — Comercial/Cadastro), sem alterar IDs, nomes, cores, filtros ou cards já classificados.
  - A nova opção aparece automaticamente em **todos** os pontos de Submarca do sistema — mesmo antes de um PO/Organizador abrir as configurações da squad: seletor **🏷️ Submarca** do modal do card, renderização da pílula de tag no card (`getTag` com fallback para `SUBMARCA_TAGS`), backfill automático em `dados/tags` por qualquer membro logado da squad (`_ensureSubmarcaTagsBackfilled`), menu rápido **🏷️ Submarcas ▾** da toolbar, gaveta **🔭 Filtros**, **⚙ Configurações → Tags → Submarca** (11 interruptores individuais, ligada por padrão), seletores de gatilho/ação de **⚡ Automações** (`_autoRenderValueOptions` lendo `SUBMARCA_TAGS` e respeitando `_submarcaIsVisivel`), formulário interno do **📥 Intake** (`intake.html` / `intake-dev.html`), **📥 Importar do Trello**, **📊 Dados do Board** (com 11ª cor dedicada `#a3e635` em `SUBMARCA_COLORS`, preservando as 10 cores anteriores), ferramenta `criar_card` do **🤖 Agente Ágil** (`SUBMARCA_LABELS`) e **❓ Central de Ajuda** (`HELP_CONTENT`). Dica: não (é apenas uma opção adicional na lista de submarcas já conhecida pelo time).

### 🔍 `/monitorarbugs` na Apresentação do Radar (`okr-apresentacao.slide.html`): 7 correções de apresentação ao vivo, relógio/cronômetro, filtros, tela cheia e limpeza de modais — 2026-10-15 · `okr-apresentacao.slide.html` (PROD)
- **🖍️ Desativação automática de Caneta/Laser e debounce de navegação ao perder o controle da apresentação (`liveInit`, `liveDesligaFerr`, `liveAposNavegar`):** quando um ADM assumia a apresentação (`👑 Assumir`), passava o microfone para um 3º participante ou assumia após 90 s de inatividade enquanto o apresentador anterior estava com a **🖍️ Caneta** (`body.live-pen` / `#live-capture`) ou **🔴 Laser** ativo, a camada `#live-capture` continuava bloqueando cliques na tela do ex-apresentador (e `Escape` não funcionava porque `!livePodeControlar()`), além de `_liveSyncT` poder disparar até 60 ms depois e sobrescrever o slide no Firebase. Agora `liveDesligaFerr()` limpa `_liveSyncT`, `liveStroke`, laser e `body.live-pen`, `liveInit()` desliga as ferramentas sempre que o usuário deixa de ser apresentador (exibindo aviso `🎙️ Fulano assumiu o controle da apresentação.`) e `_liveSyncT` revalida `livePodeControlar()`.
- **⏳ Relógio (`#tb-clock`) e cronômetro regressivo da reunião (`#tb-countdown`) visíveis durante a apresentação ao vivo (`body.live-host .tb-clock-wrap` / `body.live-ativa .tb-live`):** a regra legada `body.live-host .tb-clock-wrap { display: none }` escondia o relógio e o alerta de tempo restante da reunião justamente para o apresentador e para todos os ADMs (`body.live-host`). Agora apenas o selo estático `.tb-live` é ocultado quando há sessão ao vivo (`body.live-ativa`), mantendo o relógio e o cronômetro sempre visíveis.
- **⛶ Recálculo de altura e atalho `F` (Tela Cheia) dentro do detalhe de Objetivo (`_okrFitDetailSections`, `resize`, `keydown`):** redimensionar a janela ou alternar tela cheia (`F` / `⛶`) com `#detail-ov` aberto mantinha `.d2-body`, `.d2-footer` e `.d2-fcol` travados com as alturas antigas em pixels, e a tecla `F` era bloqueada pelo `return` antecipado do modal. Agora o `resize` recalcula `_okrFitDetailSections()` quando `#detail-ov` está aberto e o atalho `F` funciona também dentro do detalhe.
- **🏷️ Sincronização ao filtrar por Tag/Torre ou receber atualização de Objetivo durante a apresentação (`_okrSetTorre`, `rebuild`):** filtrar por Tag/Torre ou receber atualização do banco que ocultava/alterava o Objetivo aberto mudava `currentIdx` sem chamar `liveAposNavegar()` e não atualizava/fechava `#detail-ov`. Agora `_okrSetTorre` passa `porFiltro = true`, `rebuild()` fecha `#detail-ov` se o Objetivo sair do filtro (ou re-renderiza preservando o scroll das colunas) e sincroniza a sala via `liveAposNavegar()`.
- **📋 Abertura de `📋 Anotações` sempre na reunião de hoje (`_okrToggleNotes`, `_notasPopulateDateSel`):** após consultar a ata de uma reunião passada no seletor `#notes-date-sel`, fechar e reabrir o painel mantinha a data antiga selecionada (`sel.value` tinha precedência sobre `_notesViewDate` e `_okrToggleNotes` só inicializava `_notesViewDate` quando vazio). Agora reabrir o painel sempre seleciona a reunião de hoje (`_hojeStr()`).
- **↩ `Desfazer` (`_liveDesfazer` / tecla `Z`) funcional para ADM moderando ou após recarregar a página:** quando a pilha local `liveMeus` da aba está vazia, `_liveDesfazer()` agora desfaz o último traço fixo visível no slide/detalhe atual (`liveCtxs()`), permitindo que ADMs moderem traços na tela ou que o apresentador desfaça mesmo após `F5`.
- **🧹 Limpeza completa de sub-modais (`#mc-ov`, `#ating-ov`) ao trocar/fechar Objetivo e no logout (`_okrOpenDetail`, `_okrCloseDetail`, `_okrResetOverlays`):** trocar de Objetivo com `←`/`→` ou fechar `#detail-ov` agora fecha também os modais empilhados de comentários de marco (`#mc-ov`) e evolução (`#ating-ov`), e o logout/perda de acesso (`_okrResetOverlays`) fecha todos os overlays e desliga ferramentas ativas. Dica: não (correções de bugs).

### 📋 Radar (`okr.html` / `okr-dev.html` v2.88): gerenciamento completo de Anotações da reunião e do Calendário (adicionar em qualquer data, editar ✏️, excluir 🗑️ e limpar data por ADM) — 2026-10-15 · okr v2.87→v2.88 (PROD)
- **✏️ Edição e 🗑️ exclusão de anotações em qualquer data na aba `📋 Anotações` (`renderOkrNotas`, `_okrNotaStartEdit`, `_okrNotaSaveEdit`, `_okrNotaDel`, `_okrNotaPodeGerenciar` em `okr.html` / `okr-dev.html`):**
  - Agora é possível **adicionar**, **editar (`✏️`)** e **excluir (`🗑️`, com confirmação)** anotações tanto na reunião de hoje quanto em **reuniões de datas anteriores** selecionadas em `#okr-notas-date-sel` (`_okrNotasViewDate || _todayStr()`).
  - **Quem pode gerenciar:** quem escreveu a anotação (`n.autorUid === meuUid`) pode editar ou excluir a própria anotação em qualquer data; **ADMs (`_isAdmPainel()`)** podem editar ou excluir a anotação de qualquer pessoa em qualquer data, além de contar com o botão **🗑️ Excluir data** (`#okr-notas-del-date-btn` / `_okrNotaDelDate()`) para apagar todas as anotações de uma data de uma só vez.
  - Ao salvar uma edição (`Ctrl+Enter` ou botão **Salvar**), a anotação ganha o selo `(editado)` com data/hora no tooltip e dispara notificação (`_okrNotifyMencao`) apenas para **novas `@menções`** adicionadas na edição.
- **📅 Edição `✏️` e confirmação de exclusão `🗑️` nas anotações pós-reunião do Calendário (`_okrEvdNotasHtml`, `_okrEvdNotaStartEdit`, `_okrEvdNotaSaveEdit`, `_okrEvdNotaDel` em `okr.html` / `okr-dev.html`):** anotações registradas dentro de um evento do Calendário (`kanban/okr/calendario/notas/{eventoId}/{data}`) também ganharam edição inline (`✏️`), confirmação antes de excluir (`🗑️`) e disparo de notificação para novas `@menções` ao editar (liberados para o autor, organizador do evento, Gestor de OKR ou ADM).
- **❓ Ajuda do Radar (`#hlp-editar`, `#hlp-calendario`, `#hlp-mencao` em `okr.html` / `okr-dev.html`):** tópicos atualizados com as regras de edição, exclusão e moderação por ADM nas anotações de reunião e do Calendário. Dica: não (botões `✏️` e `🗑️` visíveis diretamente em cada anotação).

### 👑 Apresentação ao vivo do Radar (`okr-apresentacao.slide.html`): controle e moderação permanentes para ADM + hotfix de sincronização de slide e detalhe de Objetivo — 2026-10-15 · `okr-apresentacao.slide.html` (PROD)
- **🛡️ Controle total e moderação de ADM independente de quem está apresentando (`_isAdmOkr`, `liveSouAdm`, `livePodeControlar`, `_livePuxarSlide` em `okr-apresentacao.slide.html`):** sem bloquear nenhum usuário de iniciar ou conduzir a apresentação, qualquer ADM (`kanban/config/adm_emails` ou `role === 'adm'`) agora tem controle permanente de gestão e moderação durante qualquer sessão ao vivo (`kanban/okr/apresentacao_live`):
  - **👑 Assumir apresentação a qualquer momento (1 clique):** botão direto na barra do topo (`#live-box`) e no painel `🎙️` (`#live-fpanel`), sem precisar aguardar os 90 s de inatividade (`liveHostParado()`), já sincronizando a sala no slide atual do ADM.
  - **📍 Sincronizar / puxar a sala pro slide do ADM (`_livePuxarSlide`):** permite mandar toda a sala para o slide ou detalhe que o ADM está vendo sem precisar tirar o nome do apresentador atual.
  - **🤝 Passar o controle, aprovar/recusar pedidos (`✋`) e encerrar (`⏹`):** ADM visualiza a lista de participantes na sala para transferir o microfone de uma pessoa para outra, recebe os toasts de pedidos de controle (`Passar` / `Recusar`) e pode encerrar a apresentação a qualquer momento.
  - **🔴 Laser (`L`), 🖍️ Caneta (`P`/`T`), ↩ Desfazer (`Z`), 🧽 Apagar tudo e moderação de `📋 Anotações`:** habilitados permanentemente para ADM durante a apresentação de qualquer pessoa, além de permitir excluir anotações na ata da reunião do dia (`renderNotas` / `_okrDelNota`).
  - **🚑 Hotfix de sincronização de slide e detalhe de Objetivo (`liveAposNavegar`, `liveAplicar`, `liveInit`):** `liveAposNavegar()` ainda checava `liveSouHost()` em vez de `livePodeControlar()`, fazendo com que qualquer clique do ADM em um slide ou card de Objetivo desligasse `liveSeguindo = false` na tela do ADM (impedindo a tela compartilhada de acompanhar os cliques do apresentador) e não transmitisse a navegação do ADM para a sala. Agora `liveAposNavegar()` usa `livePodeControlar()` com identificador de navegação (`navId`), e `liveInit()`/`liveAplicar()` ressincronizam automaticamente toda a sala (`liveSeguindo = true`) sempre que o apresentador ou um ADM avança/volta slide, abre/fecha o detalhamento de um Objetivo (`mudouNav`) ou transfere o controle (`mudouHost`). Dica: não (poder de gestão e moderação restrito a ADM).

### 🚀 Promoção: gráfico interativo e curva diária nas Metas, popup de marco personalizado, aba Data Studio no Radar e correções em Anotações e `/monitorarbugs` — 2026-10-15 · kanban v8.30.861 · painel v5.74 · okr v2.87 · mare-metas.js v13 (sem avisos)
- **📈 Metas ("O mar tá pra peixe!") — Curva diária, tooltip interativo e expandir (`mare-metas.js` v13 · `kanban.html` v8.30.861 · `painel.html` v5.74):** metas diarizadas agora abrem por padrão na visão **📅 Curva diária** (realizado no dia vs. meta do dia, com pílula para alternar para **📈 Acumulado**), exibem tooltip detalhado ao passar o mouse ou tocar nos pontos (`.mm-pt` / `.mm-tip`) e contam com o botão **⛶ Expandir** (`abrirGraficoModal`, `760×300`) com zero leituras extras no Firebase (`S.logCache`).
- **🐟 Popup de marco personalizado por meta (`textoPopup` / `mostrarPeixes` em `mare-metas.js` v13):** o popup comemorativo a cada 20% adapta título, saudação e botão ao mês (`Outubro`, `Novembro`…), à Black Friday / Cyber / campanhas e ao nome da própria meta, mostrando o progresso realizado e quanto falta para o próximo peixe.
- **📈 Nova aba Data Studio no Radar (`#okr-ds-btn` / `renderOkrDataStudio` em `okr.html` v2.87):** incorpora os relatórios do **Looker Studio** diretamente no Radar (links salvos em `kanban/okr/datastudio`, lidos sob demanda com zero bytes no boot), mantendo o compartilhamento **100% restrito ao Google Workspace (`@ciahering.com.br`)** com botão **🔑 Conectar conta (1ª vez)** (`_okrDsAuthPopup`), seletor em pílulas para múltiplos painéis, modo **⛶ Tela cheia**, modal **⚙ Configurar** para gestores e tópico na **❓ Ajuda do Radar** (`#hlp-datastudio`).
- **📋 Anotações da reunião + `/monitorarbugs` (`okr.html` v2.87 · `okr-apresentacao.slide.html`):** contraste escuro oceânico no seletor de datas das anotações (`#notes-date-sel option`), filtro de chaves `YYYY-MM-DD` (removendo `Invalid Date` de notas legadas), correção de vínculos de Objetivos arquivados na aba **🔗 Cards** (`o.arquivado`), modo leitura real no modal de Marco, trava anti-duplo-clique nos comentários e todas as proteções do `/monitorarbugs` no Data Studio e na Ajuda do Radar (`#hlp-editar`). Conhecimento do Agente Ágil (`conhecimento/*.json`) regenerado. Dica: não. Detalhes nas entradas de dev de 14/10 e 15/10.

### 📋 Apresentação do Radar (`okr-apresentacao.slide.html`) + Radar (`okr-dev.html`): correção de leitura e `Invalid Date` no seletor de datas das Anotações da reunião — 2026-10-15 · `okr-apresentacao.slide.html` (PROD) · okr-dev v2.86→v2.87 (DEV)
- **🎨 Contraste da lista de datas no painel `📋 Anotações da reunião` (`#notes-date-sel` / `#notes-date-sel option` em `okr-apresentacao.slide.html`):** o `<select id="notes-date-sel">` usava `background: rgba(255,255,255,.05)` e `color: var(--txt)` (`#e8f4fd`) sem regra para `<option>`, fazendo com que o Chrome no Windows abrisse o menu nativo com fundo branco e letras quase brancas (branco no branco). Agora `#notes-date-sel` e `#notes-date-sel option` seguem o mesmo padrão escuro oceânico (`background: #0a1a2e; color: #e8f4ff; color-scheme: dark`) dos filtros do topo (`.tb-filter select option`), além de `.pt-filter-input option, .okr-select option` explícito em `okr-dev.html`.
- **🧹 Remoção de `Invalid Date` no topo da lista (`_notasPopulateDateSel` em `okr-apresentacao.slide.html` e `_okrNotasPopulateDateSel` em `okr-dev.html`):** antes da segmentação das anotações por data (`kanban/okr/reuniao_notas/{YYYY-MM-DD}/{id}`), 2 anotações antigas foram gravadas direto na raiz (`nota_*`). Como `'nota_...' > '2026-10-15'` na ordenação reversa, elas apareciam no topo do seletor como `Invalid Date`. Agora ambos os seletores filtram apenas chaves no formato `YYYY-MM-DD` (`/^\d{4}-\d{2}-\d{2}$/`). Dica: não (correção de bug visual).

### 📈 Radar: nova aba Data Studio (Looker Studio ao vivo no Radar, 100% restrito ao Google Workspace) + `/monitorarbugs` — 2026-10-15 · okr-dev v2.80→v2.86 (SÓ DEV)
- **📈 Aba Data Studio (`#okr-ds-btn` / `renderOkrDataStudio` em `okr-dev.html`):** incorpora os painéis do **Looker Studio (Data Studio)** diretamente dentro do Radar, sem precisar sair do Oceano. Os links dos relatórios ficam armazenados exclusivamente no Firebase (`kanban/okr/datastudio`, protegidos pelas regras de autenticação `@ciahering.com.br` — nunca expostos no código público do GitHub) e são lidos **sob demanda** com `window._get` apenas quando a pessoa clica na aba **📈 Data Studio** (**zero bytes** consumidos no boot do Radar, com cache em memória na sessão).
- **🔐 Opção 2 — Relatório 100% restrito ao Google Workspace (`@ciahering.com.br`) + botão `🔑 Conectar conta (1ª vez)` (`_okrDsAuthPopup`):** o compartilhamento no Looker Studio permanece **restrito à Cia. Hering (`@ciahering.com.br`)** ou às pessoas/grupos autorizados (sem precisar deixar como *"Não listado"*), somado a **Credenciais do proprietário** na fonte de dados e **Incorporar relatório** (`/embed/reporting/...`). No Chrome corporativo onde a pessoa já está logada na conta Hering, o painel abre direto dentro do Radar; se for a 1ª vez ou o navegador bloquear o cookie entre domínios / misturar com conta Gmail pessoal, o botão **🔑 Conectar conta (1ª vez)** abre uma janela rápida já apontando para `authuser=<email@ciahering.com.br>` e, assim que fechada, recarrega automaticamente o iframe dentro do Radar.
- **🎛️ Múltiplos painéis, tela cheia (`⛶`) e configuração (`⚙ Configurar`):** suporta cadastrar, editar, reordenar (`▲`/`▼`) e remover múltiplos relatórios (restrito a ADM, PO/Organizador e 🎯 Gestor OKR via `_okrCanCreate()`), com conversão automática de links comuns (`/reporting/...` ou código `<iframe>`) para `/embed/reporting/...`, seletor em pílulas no topo, botão **🔄 Atualizar**, modo **⛶ Tela cheia** (`Esc` sai), atalho **↗ Abrir no Looker Studio** e tópico dedicado na **❓ Ajuda do Radar** (`#hlp-datastudio`).
- **🛡️ Correções do `/monitorarbugs` (`v2.85–v2.86 · okr-dev`):** (1) substituição de `'_esc(r.id)'` por `${jsq(r.id)}` em todos os `onclick` inline (pílulas, reordenação, edição e exclusão); (2) endurecimento de `_okrDsNormalizeUrl` e `_okrDsViewUrl` (aceita apenas `https://lookerstudio.google.com/` ou `datastudio.google.com/`, bloqueando `javascript:` ou domínios externos caso o nó no banco seja editado manualmente, e garante fallback de `r.id` para a chave do objeto em `_okrDsListSorted`); (3) preservação do `<iframe id="okr-ds-iframe">` ao re-renderizar a barra superior (`#okr-ds-top`) para que alternar entre abas do Radar, entrar/sair da tela cheia ou editar/reordenar painéis não recarregue o Looker Studio nem perca os filtros aplicados; (4) deduplicação da Promise concorrente em `_okrDsEnsureLoaded` (`_okrDsLoadingPromise`) e trava anti-duplo-clique (`_okrDsSaving`) + atalho `Enter` em `_okrDsSaveForm`; (5) confirmação estilizada com `uiConfirm` (em vez de `confirm()` nativo), guard de permissão `_okrCanCreate()` em `_okrDsDelete`/`_okrDsMove` e preservação de rascunho digitado no formulário ao reordenar ou excluir outro item (`_okrDsRenderCfgModal(true)`); (6) bloqueio do reaparecimento indevido do botão `+ Novo Objetivo` (`#okr-novo-btn`) quando `renderOkrObjetivos()` roda em background com outra aba ativa e atualização imediata dos botões de configuração do Data Studio assim que `loadAdmList`/`loadGlobalUsers` terminam; (7) listener de `Escape` em fase de captura (`true`) com `stopPropagation` para fechar primeiro o modal de confirmação/configuração antes de sair da tela cheia. Dica: não (a aba `📈 Data Studio` já fica visível direto na barra principal de abas do Radar e exibe o guia completo na própria tela quando vazia).

### 📈 Metas ("O mar tá pra peixe!"): gráfico de evolução interativo, opção de expandir em tela ampla e curva diária (não acumulada) para metas diarizadas — 2026-10-15 · kanban-dev v8.30.860-dev→v8.30.861-dev · painel-dev v5.73→v5.74 · mare-metas-dev.js v12→v13 (SÓ DEV)
- **📅 Curva diária (não acumulada) para metas diarizadas (`serieDiaria` + `graficoHtml` com `modo: 'dia'`):** quando a meta tem diarização (`temCurva(m)`), o gráfico **📈 Evolução** na aba **📊 Dados** agora abre por padrão na visão **📅 Curva diária**, comparando o **Realizado no próprio dia** (linha sólida com pontos e rótulos de valor) contra a **Meta do próprio dia** (`metaDoDia`, linha tracejada ao longo de todos os dias do período), exatamente no formato de curva diária de receita captada — com seletor em pílula no topo do gráfico para alternar a qualquer momento entre **📅 Curva diária** e **📈 Acumulado**.
- **🖱️ Tooltip interativo ao passar o mouse ou tocar nos pontos (`.mm-pt` + `.mm-tip`):** passar o mouse (ou tocar no celular) sobre o gráfico destaca automaticamente o ponto mais próximo e a linha guia vertical, exibindo um card flutuante com a data/hora, o valor realizado (no dia ou acumulado), a comparação com a meta do dia (`% da meta do dia` e diferença `+/-`) ou o `% da meta total`, o delta do registro e a observação/nota.
- **⛶ Expandir gráfico em modal amplo (`abrirGraficoModal`, zero leituras extras no Firebase):** botão **⛶ Expandir** no cabeçalho do gráfico abre a visualização ampliada (`760×300`, modal `.mm-md-lg`) com todos os rótulos, eixos, seletor **📅 Curva diária / 📈 Acumulado**, resumo de KPIs no rodapé e atalho para **✏️ Atualizar valor**, mantendo o gráfico compacto na barra lateral para não quebrar o layout. As leituras de `metas_log` são cacheadas em memória por 5 min (`S.logCache`, invalidado ao registrar/editar entrada), garantindo **0 bytes extras** de download do Firebase ao alternar modos ou expandir. Dica: não (os botões `📅 Curva diária` / `📈 Acumulado` e `⛶ Expandir` ficam visíveis diretamente na barra do gráfico e o tooltip reage sozinho ao passar o mouse).

### 🐟 Metas ("O mar tá pra peixe!"): popup de marco personalizado para a meta em questão — 2026-10-15 · kanban-dev v8.30.859-dev→v8.30.860-dev · painel-dev v5.72→v5.73 · mare-metas-dev.js v11→v12 (SÓ DEV)
- **🎯 Texto personalizado por meta, tema e marco (`textoPopup` + `mostrarPeixes` em `mare-metas-dev.js`):** o popup de comemoração a cada 20% (**"O mar tá pra peixe!"** / **"🏆 Meta batida!"**) deixou de usar uma frase única genérica e passou a reagir ao título, ao tema, ao marco atingido (`20%`, `40%`, `60%`, `80%`, `100%`) e aos valores reais da meta ou desafio:
  - **Meses no título (ex.: `"Outubro"`, `"Meta Novembro"`):** adapta título, mensagem e botão para o mês (*"O mar tá pra peixe em Outubro! 🐟"*, *"Primeiro peixe de Outubro na rede!"* / *"O cardume de Outubro tá encorpando!"* / *"Passamos da metade de Outubro!"* / *"Reta final de Outubro no mar!"*, *"Bora pescar mais em Outubro! 🚀"*, e em 100% *"🏆 Meta batida em Outubro! 🎉"*).
  - **Black Friday / Cyber / Esquenta e campanhas (`Dia das Mães`, `Natal`, `Live`, etc.):** adapta a saudação, o título e o botão para a Black ou campanha em andamento.
  - **Qualquer meta ou desafio:** tece o nome da meta diretamente na frase de comemoração, exibe o progresso realizado no formato da meta (`(R$ 400 mil de R$ 1 mi)`) e quanto falta para o próximo peixe (`Próximo peixe em 60% — faltam R$ 200 mil.`). Dica: não (é um refinamento visual/textual de um popup comemorativo que já aparece sozinho).

### 📚 Documentação: Ajuda do Radar (comentários de Marco), Oceano, maredigital.html e CODE_MAP — 2026-10-14 · okr-dev v2.80 · maredigital.html · docs/OCEANO.md · CODE_MAP.md (SÓ DEV)
- **❓ Ajuda do Radar (`okr-dev.html` v2.80):** o tópico **✏️ Editar o que já foi escrito** (`#hlp-editar`) agora documenta a edição (`✏️`, com selo *(editado)*) e a exclusão (`🗑️`, com confirmação) dos próprios comentários nos Marcos, além da moderação por ADMs.
- **🌊 `docs/OCEANO.md`, `CLAUDE.md` e `AGENTS.md`:** atualizados os status do lobby `oceano.html` (v1.34, selo `#vtex-pill`), sino no Oceano, login único pelo Oceano (incluindo convidado externo e redirecionamento na 1ª abertura do dia via `_oceanoDoDia`), Mural de avisos do Oceano e `escala.html` (v1.10 com filtros em mini tela, Visão Gantt + JPG e pausas) de "só dev" para **em produção**.
- **📘 `maredigital.html` e `CODE_MAP.md`:** versões sincronizadas (`kanban.html` v8.30.858, `painel.html` v5.68 / `painel-dev` v5.71, `okr.html` v2.78 / `okr-dev` v2.80, `oceano.html` v1.34, `escala.html` v1.10, `mare-notif.js` v31, `mare-dicas.js` v5, `mare-metas.js` v10, `mare-login.js` v3); documentados na árvore do Firebase e na tabela de Cloud Functions os vigias `vtexStatus`, `githubStatus` e `firebaseStatus`, os nós `okr/marco_comments`, `vtex_status`/`vtex_saude`, `github_status`/`github_saude` e `firebase_status`/`firebase_saude`, e a seção da aba **🔋 Status** do Painel; âncoras revalidadas no `CODE_MAP.md` via `revalidar_ancoras.py`.

### 🚀 Promoção: monitores de status do GitHub Pages e do Firebase no Painel + alertas exclusivos para ADMs — 2026-10-14 · painel v5.68 · mare-notif.js v31 · Cloud Functions `githubStatus` & `firebaseStatus` (sem avisos)
- **🐙 Status do GitHub & GitHub Pages (`#st-github-card` + pílula `#github-status-pill`):** a aba **🔋 Status** do Painel agora mostra em tempo real a saúde do **📄 GitHub Pages** (hospedagem oficial de todas as páginas da família Oceano), a grade dos 9 componentes do GitHub (`Pages`, `Actions`, `Git Operations`, `API Requests`, `Webhooks`, `Pull Requests`, `Issues`, `Packages`, `Copilot`), incidentes ativos e pílula clicável `🐙 GitHub Pages: OK` na barra superior. A Cloud Function `githubStatus` (a cada 5 min) grava o batimento em `kanban/github_saude` e envia alerta no sino + push (`github_incidente` / `github_monitor_falhou`) **exclusivamente para os ADMs**, sem criar Comunicado global.
- **🔥 Status do Firebase — Serviços que usamos (`#st-firebase-card` + pílula `#firebase-status-pill`):** monitora exclusivamente os **6 serviços do Firebase** que sustentam o ecossistema (**🗄️ Realtime Database** em destaque principal com latência medida ao vivo em `ms`, **🔐 Authentication**, **🔔 Cloud Messaging**, **⚡ Cloud Functions**, **📦 Cloud Storage** e **🌐 Hosting / Domínio**), ignorando produtos que não utilizamos (Crashlytics, AdMob, Test Lab etc.). A Cloud Function `firebaseStatus` (a cada 5 min) grava `kanban/firebase_saude` e notifica **apenas os ADMs** (`firebase_incidente` / `firebase_monitor_falhou`).
- **🛡️ Correções do `/monitorarbugs` incluídas:** normalização de schema entre o batimento das Cloud Functions e a leitura ao vivo no navegador (`renderGithubStatusUI` / `renderFirebaseStatusUI`), filtro de incidentes resolvidos ou com mais de 7 dias, limpeza de HTML e validação de URLs (`_linkSeguroStatus`), matcher regex por fronteira de palavra (`_fbMatchServicos`) e preservação do dot luminoso nas pílulas (`_setStatusPill`). Conhecimento do Agente Ágil (`novidades.json`) regenerado. Dica: não (Painel não exibe dicas e o alerta é exclusivo para ADMs). Detalhes nas entradas de dev de 14/10 (`painel-dev` v5.68→v5.71).

### 🛡️ /monitorarbugs no Painel: compatibilidade de schema Cloud Function ↔ navegador, filtro de incidentes antigos/HTML, sanitização de links, matcher regex e pílulas de topo nos monitores GitHub & Firebase — 2026-10-14 · painel-dev v5.70–v5.71 · `statusGithub.js` · `statusFirebase.js` (SÓ DEV)
- **🔄 Compatibilidade entre batimento da Cloud Function (`_ghSaude` / `_fbSaude`) e leitura ao vivo (`renderGithubStatusUI` / `renderFirebaseStatusUI`):** quando o navegador exibia o fallback vindo do Realtime Database (`kanban/github_saude` ou `kanban/firebase_saude`), os nomes de campos gravados pelas Cloud Functions (`componentesResumo`, `servicos` / `servicosResumo`, `incidentes[].titulo/estadoLabel/resumo/link/atualizadoEm`) divergiam dos campos lidos pela UI (`componentes`, `incidentesAtivos[].name/status/latestBody/shortlink/updatedAt`), deixando componentes como `"Desconhecido"` e omitindo a lista de incidentes ativos no modo fallback. Agora ambos os formatos são normalizados na renderização.
- **🧹 Filtro de incidentes resolvidos/antigos, limpeza de HTML, sanitização de links (`_linkSeguroStatus`) e ranking de severidade no navegador (`loadGithubStatus` / `loadFirebaseStatus`):** `loadGithubStatus()` agora ignora o componente placeholder `"Visit www.githubstatus.com..."` e filtra incidentes já em estado `resolved`/`postmortem`/`completed`/`cancelled` ou com mais de 7 dias; `loadFirebaseStatus()` passou a filtrar incidentes zumbis (> 7 dias), limpar tags/entidades HTML de `external_desc` e `most_recent_update.text`, e comparar severidade (`_STATUS_RANK`) ao atualizar `comps[k].status` para que um incidente menor subsequente nunca rebaixe um `major_outage` no mesmo serviço. Além da sanitização no backend (`linkSeguro`), a UI do Painel agora valida `shortlink`/`link` via `_linkSeguroStatus()` na coleta e na renderização (aceitando apenas `http(s)://` ou caminhos relativos `/incidents/...` e bloqueando esquemas inseguros como `javascript:`).
- **🎯 Matcher de serviços do Firebase por fronteira de palavra (`_fbMatchServicos`) e preservação do dot nas pílulas (`_setStatusPill`):** `_fbMatchServicos()` passou a usar as mesmas expressões regulares com `\b` de `statusFirebase.js` (inspecionando `service_name`, `service_key` e `affected_products[].title/id`), evitando falso-positivo por `.includes('auth')`; `_setStatusPill()` atualiza `#github-status-pill-dot`/`#github-status-pill-txt` e `#firebase-status-pill-dot`/`#firebase-status-pill-txt` sem destruir os spans filhos, e `#st-gh-pages-meta` agora mostra domínio e horário de atualização. Em `statusFirebase.js` (`rodar`/`processar`) e `statusGithub.js` (`processar`), adicionado guard para `fase === 'desconhecido'` e propagação de erro quando todos os incidentes falham ao gravar no banco.

### 🔥 Painel: status do Firebase (serviços que usamos) ao vivo + vigia automático exclusivo para ADMs — 2026-10-14 · painel-dev v5.69 · mare-notif-dev v31 · Cloud Function `firebaseStatus` (SÓ DEV)
- **🔥 Status do Firebase no Painel (`painel-dev.html`):** a aba **🔋 Status** ganhou o painel **🔥 Status do Firebase (Serviços que usamos)**, focado exclusivamente nos 6 serviços que sustentam o ecossistema Maré Digital / Oceano: **🗄️ Realtime Database** (em destaque principal, com latência de leitura medida ao vivo em `ms`), **🔐 Authentication** (login Google `@ciahering.com.br`), **🔔 Cloud Messaging (FCM)** (notificações push Web/PWA), **⚡ Cloud Functions** (push, Agente Ágil, intake, backups, lembretes e vigias), **📦 Cloud Storage** (anexos, avatares e `backups-completos/`) e **🌐 Hosting / Auth Domain** (`hering-onboarding.firebaseapp.com`). Inclui lista de incidentes ativos, botão **🔄 Checar Firebase** e pílula clicável `🔥 Firebase (RTDB): OK` na barra de topo ao lado do GitHub Pages.
- **🚨 Alerta automático filtrado e restrito aos ADMs (`functions/firebase/statusFirebase.js` · `firebaseStatus`):** função agendada a cada 5 min (`*/5 * * * *`, Brasília) que lê `https://status.firebase.google.com/incidents.json`, ignora produtos do Firebase que não usamos (Crashlytics, AdMob, Test Lab, Remote Config, Analytics etc.), grava o batimento em `kanban/firebase_saude` e, quando abre um incidente em um dos 6 serviços usados, envia notificação no sino + push (`firebase_incidente`, e `firebase_monitor_falhou` se o endpoint ficar ~1 h sem responder) **exclusivamente para os ADMs** (`role === 'adm'`), sem criar Comunicado global para todos os usuários. Clicar na notificação ou no push abre direto a aba **🔋 Status** do Painel (`?tab=status`). Interruptor: `kanban/config/firebase_status_off = true`.
- **🔔 Catálogo, regras, roteamento e backup (`mare-notif-dev.js` · `database.rules.json` · `functions/common/pushUrl.js` · `functions/backup/completo.js`):** tipos `firebase_incidente` e `firebase_monitor_falhou` adicionados ao catálogo da Central de Notificações e ao `PUSH_TYPES`; leitura liberada em `kanban/firebase_saude` (`.write: false`); `firebase_status` incluído no backup semanal e `firebase_saude` listado em `EXCLUIDOS`. Também corrigido o guard de atualização do banner de destaque do GitHub Pages (`renderGithubStatusUI`). Dica: não (o Painel não exibe dicas e o alerta é exclusivo para ADMs).

### 🐙 Painel: status do GitHub & GitHub Pages ao vivo + vigia automático exclusivo para ADMs — 2026-10-14 · painel-dev v5.68 · mare-notif-dev v30 · Cloud Function `githubStatus` (SÓ DEV)
- **📄 Status do GitHub & GitHub Pages no Painel (`painel-dev.html`):** a aba **🔋 Status** ganhou o painel **🐙 Status do GitHub & GitHub Pages**, com card de destaque exclusivo para o **📄 GitHub Pages** (onde o Maré Digital, Painel, Radar, Oceano e Escala ficam hospedados), grade dos componentes principais do GitHub (`Pages`, `Actions`, `Git Operations`, `API Requests`, `Webhooks`, `Pull Requests`, `Issues`, `Packages`, `Copilot`), lista de incidentes ativos e botão **🔄 Checar agora** (consulta `https://www.githubstatus.com/api/v2/summary.json` ao vivo no navegador e cruza com o batimento `kanban/github_saude`). A barra de topo do Painel também ganhou o selo clicável `🐙 GitHub Pages: Operacional` (que muda para âmbar/vermelho em caso de lentidão ou incidente e leva direto à aba **🔋 Status**).
- **🚨 Alerta automático restrito aos ADMs (`functions/github/statusGithub.js` · `githubStatus`):** função agendada a cada 5 min (`*/5 * * * *`, Brasília) que lê o `summary.json` oficial do GitHub, grava o batimento em `kanban/github_saude` e, quando abre um incidente ou o componente **Pages** entra em degradação/indisponibilidade (mesmo sem incidente formal listado), envia notificação no sino + push (`github_incidente`, e `github_monitor_falhou` se o endpoint ficar ~1 h sem responder) **exclusivamente para os ADMs** (`role === 'adm'`), sem criar Comunicado global e sem acionar os demais usuários. Clicar na notificação ou no push leva direto à aba **🔋 Status** do Painel (`?tab=status`). Interruptor de emergência: `kanban/config/github_status_off = true`.
- **🔔 Catálogo, regras e backup (`mare-notif-dev.js` · `database.rules.json` · `functions/backup/completo.js`):** tipos `github_incidente` e `github_monitor_falhou` adicionados ao catálogo da Central de Notificações e ao `PUSH_TYPES`; regra de leitura para `kanban/github_saude` (`.write: false`, escrito só via Admin SDK) adicionada em `database.rules.json`; `github_status` incluído no backup semanal e `github_saude` listado em `EXCLUIDOS` (batimento efêmero). Dica: não (o Painel não exibe dicas e o alerta é exclusivo para ADMs).

### 🛡️ /monitorarbugs no Radar: vínculos de Objetivos arquivados na aba Cards, modo leitura real no modal de Marco e trava/preservação nos comentários — 2026-10-14 · okr-dev v2.79 (SÓ DEV)
- **🔗 Aba Cards ignorando Objetivos arquivados (`_okrCardsVinculos`):** a verificação de Objetivo arquivado na aba **🔗 Cards** testava `o.archived` (nome do campo nos cards do Kanban) em vez de `o.arquivado` (campo real dos Objetivos do Radar). Com isso, cards vinculados a Objetivos arquivados continuavam contando como "Vinculados a um Objetivo", não entravam no filtro "Sem vínculo com Objetivo" e exibiam o botão `🎯 <Título>` apontando para o Objetivo arquivado. Corrigido para `o.arquivado`.
- **🔒 Modo somente leitura real no modal de Marco (`renderOkrMarcoBody` / `_okrTryCloseMarco`):** quando uma pessoa sem permissão de edição no Objetivo (ou com o Objetivo em uso por outra pessoa) abria um Marco, o botão **💾 Salvar** sumia, mas os controles de status, checklist, tags e participantes continuavam clicáveis e alteravam o rascunho em memória — fazendo o fechar (`✕`, clique fora ou `Esc`) disparar um falso alerta *"Você tem alterações não salvas neste Marco. Fechar mesmo assim?"*. Agora `_okrStatusPickerHtml(false)`, `_okrChecklistHtml(false)`, `_okrTagsHtml(false)` e `_okrParticipantesHtml(false)` renderizam em modo leitura real quando `!podeEditar`, e `_okrTryCloseMarco()` só verifica rascunho sujo quando `podeEditar` é verdadeiro.
- **💬 Comentários e campos pendentes do Marco (`_okrCommentSend` / `_okrCommentsHtml` / `_OKR_MARCO_PENDING_IDS` / `_okrTagAdd`):** `_okrCommentSend()` agora usa a trava `_okrComentSalvando` com `try/catch/finally` e toast de erro (evitando comentários duplicados em clique/Enter duplo), `_okrCommentsHtml()` oculta o campo de envio para visualizadores externos (`window._isPainelViewer`), e `_OKR_MARCO_PENDING_IDS` passou a preservar também `#okr-tag-add`, `#okr-comment-inp` e `#okr-comment-edit-inp` em re-renders assíncronos do modal (limpando o input ao adicionar tag ou trocar de comentário em edição).

### 🚀 Promoção: editar e apagar comentários nos Marcos do Radar (+ moderação ADM) — 2026-10-14 · okr v2.78 (com avisos)
- **✏️ Editar o próprio comentário do Marco (`_okrCommentEdit` / `_okrCommentEditSave`):** botão **✏️** ao lado da data em cada comentário feito pela própria pessoa no modal do Marco abre edição inline (Salvar/Cancelar, `Enter`/`Esc`), grava apenas `text` + `editadoEm` e exibe **· editado**. Não perde o que estiver sendo digitado no Marco e avisa caso o comentário tenha sido removido antes de salvar.
- **🗑️ Apagar comentário no Marco (`_okrCommentDel`):** botão **🗑️** ao lado do comentário (com confirmação `uiConfirm`) permite que o próprio autor apague seu comentário e que **ADMs** (`_isAdmPainel()`) também apaguem comentários de qualquer pessoa para moderação. Visualizadores externos continuam em modo somente leitura.
- Conhecimento do Agente Ágil (`novidades.json`) regenerado. Dica: não (ícones diretos no comentário). Detalhes nas entradas de dev de 14/10 (okr-dev v2.76→v2.78).

### 🛡️ Radar: ADM também pode apagar comentários de qualquer pessoa nos Marcos — 2026-10-14 · okr-dev v2.78 (SÓ DEV)
- **🛡️ Moderação de comentários por ADM (`_okrCommentsHtml` / `_okrCommentDel`):** além do próprio autor, usuários ADM (`_isAdmPainel()`) agora também veem o botão **🗑️ Apagar comentário** e podem remover comentários de outras pessoas dentro do modal do Marco (com confirmação `uiConfirm`). A edição inline (`✏️`) continua restrita exclusivamente ao autor do comentário, e visualizadores externos continuam em modo somente leitura. `loadAdmList()` também re-renderiza o corpo do Marco caso o modal já esteja aberto quando a lista de ADMs terminar de carregar.

### 🗑️ Radar: apagar o próprio comentário do Marco — 2026-10-14 · okr-dev v2.77 (SÓ DEV)
- **🗑️ Apagar comentário no Marco:** ao lado do ✏️ (editar), cada comentário feito pela própria pessoa no modal do Marco agora exibe o botão **🗑️ Apagar comentário** (`_okrCommentDel`). Pede confirmação (`uiConfirm`), remove de `kanban/okr/marco_comments/{marcoId}/{id}` sem perder o que estiver sendo digitado no Marco e atualiza a lista e o contador de comentários na hora. Comentários de outras pessoas e o modo visualizador externo não exibem o botão.
- Sem mudança de regra no banco (`kanban/okr` já permite escrita aos usuários autenticados `@ciahering.com.br`). Dica: não (ícone direto no comentário). Teste `test_comentario_marco.js` atualizado cobrindo exclusão, cancelamento, preservação de rascunho, falha de rede e permissão por autor.

### 🚀 Promoção: buzina de navio no popup "O mar tá pra peixe" — 2026-10-14 · kanban v8.30.858 · painel v5.67 · mare-metas.js v10 · `buzina-navio.mp3` (sem avisos)
- **🚢 Buzina no popup 🐟:** ao cruzar um marco de 20 % da meta (e na meta batida 🏆), o popup dos peixinhos toca uma **buzina de navio** inteira (~9,5 s) e fecha cerca de 1 s depois que ela acaba. Respeita o 🔇 e o 🔕 Não Perturbe do sino; sem som, o popup fecha sozinho em 9 s (14 s na meta batida). Marco comum soa mais baixo (0,7) que a meta batida (0,85). Fechar o popup antes para a buzina.
- Ajuda do Maré (Metas e desafios) atualizada; conhecimento do Agente Ágil regenerado. Detalhes nas entradas de dev de 14/10. Dica: não (efeito automático).

### 🚢 Buzina do popup 🐟 agora toca INTEIRA e o popup acompanha — 2026-10-14 · kanban-dev v8.30.858-dev · painel-dev v5.67 · mare-metas-dev v10 · `buzina-navio.mp3` (SÓ DEV)
- **Corrige a desproporção da v9:** o áudio enviado tem ~10 s e eu o tinha cortado em 4 s (e em 2,4 s nos marcos comuns), enquanto o popup ficava 9–14 s aberto. Agora o `buzina-navio.mp3` tem o áudio **inteiro** (9,5 s, duas buzinadas, ~95 KB) e **o popup fecha ~1 s depois que a buzina acaba** (antes: tempo fixo de 9 s / 14 s na meta batida).
- Sem som (🔇, Não Perturbe, ou o navegador barrou o autoplay) o popup volta ao tempo fixo de sempre (9 s; 14 s na meta batida). Marco comum soa em volume 0,7 e a meta batida 0,85. Fechar o popup antes (✕, botão, Esc) para a buzina.
- Teste `test_metas_buzina.js` reescrito (11 checagens, incluindo "popup continua aberto depois dos 9 s com a buzina tocando" e "fecha ~1 s após o fim"). Ajuda do Maré (Metas) atualizada. **Licença do som a confirmar antes de ir pra prod.**

### 🚢 Buzina de navio no popup "O mar tá pra peixe" — 2026-10-14 · kanban-dev v8.30.857-dev · painel-dev v5.66 · mare-metas-dev v9 · `buzina-navio.mp3` (SÓ DEV)
- O popup 🐟 de cada marco de 20 % agora toca uma **buzina de navio**: buzinada curta (corta com fade em ~2,4 s, volume 0,6) nos marcos comuns e a **buzina inteira** (4 s, volume 0,85) na meta batida 🏆.
- O áudio é o `buzina-navio.mp3` (raiz do domínio, ~50 KB): trecho de 4,1 s de um som de navio de cruzeiro (Freesound, enviado pelo Caio), cortado, normalizado e comprimido (mono, 96 kbps). **Confirmar a licença/atribuição do original antes de promover pra prod.**
- Respeita o 🔇 do sino e o 🔕 Não Perturbe (`MareNotif.somMudo()`/`dndAtivo()`); fecha o popup = para o som; se o navegador barrar o som (autoplay), falha em silêncio e o popup aparece normal.
- Ajuda do Maré (Metas) atualizada. Dica: não (efeito automático). Teste novo `test_metas_buzina.js` (8 checagens); testes de Metas existentes sem regressão.

### 🚀 Promoção: Oceano como porta de entrada (1ª abertura do dia) + correção do convidado externo — 2026-10-14 · kanban v8.30.856 · painel v5.65 · oceano v1.34 (com avisos)
- **🌊 Oceano como porta de entrada:** na **primeira abertura do dia** do Maré ou do Painel por favorito/link simples, quem já está logado passa antes pelo Oceano (vê o Mural e os avisos) e o atalho "↩ Continuar" leva de volta, na mesma squad. Antes só quem NÃO tinha sessão era mandado pra lá — e o login do Maré sobrevive a sair da conta Google, então quase ninguém passava. Não passam: link com destino (card, notificação, `?okr=`), app instalado do Maré, e-mail de fora da Hering, `?login=local`, o Maré dentro do Oceano e quem já abriu o Oceano hoje. Interruptor `MARE_OCEANO_DIARIO`.
- **🐛 Convidado externo (freelancer) não conseguia entrar:** o Maré manda todo deslogado pro Oceano; o Oceano recusava a conta externa e a saída levava pra `?login=local` sem a squad. Agora a conta externa vinda do Maré/Painel é encaminhada direto pra página de origem em modo local (squad/card/hash preservados), e o Maré confere a lista de externos.
- Ajuda do Maré (Menu de produtos) e FAQ do Oceano ("Por que o Maré me mandou pro Oceano?") atualizados; conhecimento do Agente Ágil regenerado. Mural + WhatsApp: rascunho `seed_oceano_porta_2026_10_14` no Painel. Dica: não (automático). Detalhes nas entradas de dev de 14/10.

### 🐛 Convidado externo (freelancer) não conseguia entrar: o Oceano recusava e ela ficava sem caminho pro Maré — 2026-10-14 · oceano-dev v1.34 (SÓ DEV)
- **O problema:** quem não está logado no Maré/Painel é mandado pro Oceano (`?next=`) — o Maré ainda não sabe o e-mail dela. Com uma conta que NÃO é `@ciahering.com.br` (freelancer/visualizador), o Oceano a desloga e mostrava só "O Oceano é só pra conta Google @ciahering.com.br…". A saída (links "Maré · Painel · Radar" no rodapé) mandava pra `?login=local` **sem a squad nem o card de origem** e ela precisava entrar com o Google de novo — na prática ficava sem entrar em lugar nenhum.
- **Agora:** se a conta externa veio do Maré/Painel (há `?next=`), o Oceano **encaminha direto pra página de origem em modo local** (`…&login=local`, mantendo squad/card/hash), sem deslogar; o Maré confere a lista de externos da squad e, se não estiver autorizada, mostra o motivo certo ("peça ao PO…"). Os links de convidado da tela de login também levam a squad/card de origem. Quem abre o Oceano direto com conta externa continua recebendo a recusa. Conta `@ciahering` que não entrou pelo Google continua recusada.
- Teste: `test_login_oceano.js` (caso 5 reescrito + 3 novos). Dica: não (correção).

### 🌊 Oceano como porta de entrada também pra quem já está logado (1ª abertura do dia) — 2026-10-14 · kanban-dev v8.30.856-dev · painel-dev v5.65 · oceano-dev v1.33 (SÓ DEV)
- **O problema:** o redirecionamento pro Oceano só valia pra quem NÃO tinha sessão no Maré/Painel. O login do Maré é uma sessão do Firebase guardada no navegador — ela sobrevive a sair da conta Google (e à verificação em 2 etapas pedida de novo). Resultado: com o Google deslogado, o Maré ainda abria direto e a pessoa nunca passava pelo Oceano (nem via o Mural).
- **Agora:** na **primeira abertura do dia** por favorito ou link simples (sem destino), o Maré e o Painel mandam a pessoa logada pro Oceano (`?next=`, preservando a squad); o atalho "↩ Continuar" leva de volta. Abrir o Oceano direto também conta como "já passou hoje". Marca: `localStorage.mare_oceano_dia`.
- **Não muda:** link com destino (card, notificação, `?okr=`, `#hash`), app instalado do Maré (standalone), iframe do Oceano, `?login=local`, e-mail fora da Hering e quem já passou hoje. `?squad=` NÃO conta como destino (é a escolha do quadro; o `?next=` leva a squad junto). Interruptor `window.MARE_OCEANO_DIARIO=false`.
- Ajuda do Maré (Menu de produtos) e FAQ do Oceano ("Por que o Maré me mandou pro Oceano?") atualizados. Dica: não (é automático). Teste novo `test_oceano_do_dia.js` (29 checagens); `fakefb.js` ganhou `window.__initialUser` (a pessoa já chega logada).

### 🛡️ /monitorarbugs na VTEX: feed com formato diferente não vira alerta em massa, link do feed só da página oficial, um item ruim não derruba os outros — 2026-10-13 · `vtexStatus` (SÓ DEV / função ainda não republicada; sem mudança de página nem de `version.json`)
- **Severo (latente): formato do feed mudou = popup 🚨 + push pra TODO MUNDO por cada incidente já resolvido dos últimos 7 dias.** `faseDe()` tratava "sem `Status:` legível" como "aberto". Reproduzido com o feed trocando `<b>` por `<strong>`: 2 itens já resolvidos → 2 comunicados insistentes + 4 notificações. Agora status ilegível = fase `desconhecido` (ignorado, nunca alarma) e, se o feed inteiro vier sem nenhum `Status:` legível, conta como falha do monitor (selo cinza + aviso aos ADMs depois de ~1 h).
- **Link do feed sem validação:** `javascript:alert(1)` ou site estranho no `<link>` virava `href` do popup (sem sanitização no Maré) e `link` da notificação. Agora só `https://status.vtex.com/…` vale; senão cai na home da página de status.
- **Um item ruim derrubava o feed inteiro:** um erro ao gravar um item abortava o `processar()` e os itens seguintes (incluindo um incidente real) não eram avisados. Agora cada item tem o seu `try/catch` (conta em `erros`; se TODOS falharem, vira falha do monitor). Guarda extra: chave vazia nunca grava no nó `vtex_status` inteiro.
- **Falha ao avisar os ADMs escondia o erro original e travava o contador:** `alertarMonitor()` lançando fazia `executar()` perder o `HTTP 503` e não gravar `falhasSeguidas`. Agora o aviso é tentado de novo no tick seguinte (só marca `avisadoEm` se enviou) e o erro/contador seguem.
- Sem achado (lido de ponta a ponta): fases final/agendado/aberto, ADM apaga/desativa, dedupe da notificação por usuário, renovação/expiração de 3 h, `chaveDe`, mojibake, selo do Oceano (`vtexEstado`, 20 min), regra `vtex_saude`, `PUSH_TYPES`/`MareNotif.TIPOS`/`openNotif`/`pushUrl`, backup (`vtex_status` em `NOS_GLOBAIS`, `vtex_saude` excluído), popup insistente (dispensa por sessão). Hipótese descartada: achei que o `pubDate` de manutenção era o início agendado; o feed real mostra que é a última atualização — por isso o aviso NÃO ganhou "data de início" (a janela vem no texto da própria VTEX).
- 4 testes novos (suíte `vtex` 22/22; funções 833 passam). **Deploy (máquina do usuário, resync antes):** `firebase deploy --only functions:vtexStatus`.

### 🚀 Promoção: modo insistente (tremor de tela + som repetido + título piscando) e aviso do sistema na reunião — 2026-10-13 · kanban v8.30.855 · painel v5.64 · okr v2.75 · oceano v1.32 · mare-notif.js v29 · mare-dicas.js v5 (com avisos)
- **🫨 Modo insistente (opcional, desligado por padrão):** botão no rodapé do 🔔 (Maré, Radar, Painel, Oceano). Ligado, ao chegar um aviso importante (os mesmos tipos que viram push) a tela treme (como o zumbido do MSN) e, se a pessoa não está olhando a janela, o som se repete a cada 30 s (até 5×) e o título da aba pisca — até ela voltar à janela ou mexer em algo. Cada item é escolhido separadamente, com ▶ Testar agora; respeita 🔇, 🔕 Não Perturbe e "reduzir movimento". A escolha acompanha a conta em todos os aparelhos. Só o conteúdo principal treme (os elementos fixos ficam parados).
- **🪟 Aviso do sistema com a janela visível sem foco:** se o Maré/Radar está aberto mas o foco está em outra janela (reunião, tela compartilhada), o push agora também aparece como notificação do sistema — antes só aparecia um toast de 3 s.
- Ajuda do Maré (Notificações), FAQ do Oceano e dica nova no Maré (`insistente`); conhecimento do Agente Ágil regenerado. Funções (já no ar ou a publicar pelo usuário): `sendPushOnNotification`/`sendPushOnMural` — uma mensagem recusada pelo FCM não apaga mais os tokens de ninguém e o log traz o motivo das falhas (#1391). Mural + WhatsApp: rascunho `seed_modo_insistente_2026_10_13` no Painel.

### 🚀 Promoção: alerta automático de incidente da VTEX (popup + push + selinho no Oceano) — 2026-10-13 · kanban v8.30.853 · painel v5.62 · okr v2.73 · oceano v1.30 · mare-notif.js v27 (com avisos)
- **🚨 Alerta de incidente da VTEX:** o Maré acompanha sozinho a página de status da VTEX (status.vtex.com). Com incidente ou manutenção **em andamento**, aparece um popup 🚨 para todo mundo (reaparece até acabar) e chega uma notificação no sino e no celular; quando a VTEX marca como resolvido, o aviso some sozinho. Manutenção só agendada vira aviso comum, sem push. O tipo "Incidente na VTEX" está na 🔔 Central de Notificações do Painel (o ADM pode desligar), e clicar na notificação no Maré abre o Mural.
- **🌊 Selinho "VTEX" no topo do Oceano:** azul = normal · vermelho = incidente (clique abre os detalhes) · cinza = não consegui consultar agora (nunca afirma "normal" sem leitura recente). Aparece depois que o monitor está ativo.
- **🛰️ Aviso aos ADMs:** se o monitor ficar ~1 h sem conseguir ler a página da VTEX, os ADMs recebem a notificação "Monitor da VTEX sem resposta" (abre o Painel).
- Ajuda do Maré (Notificações) e FAQ do Oceano (verbete "O selinho VTEX") atualizados; conhecimento do Agente Ágil regenerado. Depende de `firebase deploy --only functions:vtexStatus,functions:sendPushOnNotification` e `firebase deploy --only database` (já publicados). Mural + WhatsApp: rascunho `seed_vtex_alerta_2026_10_13` no Painel. Dica: não (é automático).

### 🚀 Promoção: login do iPhone em qualquer navegador, Escala (filtros, Gantt, pausas, JPG do Gantt), restaurar do backup completo, aviso de backup com problema — 2026-10-13 · kanban v8.30.850 · painel v5.60 · okr v2.71 · oceano v1.27 · escala v1.10 · mare-notif.js v25 · mare-login.js v3 · intake.html (sem avisos)
- **🍎 Login no iPhone/iPad:** o "Entrar com Google" vai direto ao Google e volta já logado em **qualquer** iPhone/iPad (Safari, link aberto do WhatsApp, atalho da tela inicial) — acabou o "Unable to process request due to missing initial state". Escala e Intake voltam pelo Oceano e já trazem a pessoa de volta pra página onde estava.
- **🗓️ Escala (v1.10):** filtros de squad e subtime numa mini tela (botão 🔎 Filtros), **📊 Visão Gantt** do dia (barra por pessoa, cobertura por hora, folga à parte), **☕ pausas** no cadastro (até 3 por dia; aparecem na lista, na célula, no Gantt e no JPG) e **🖼️ JPG da Visão Gantt**. As pausas exigem as regras novas do banco (`firebase deploy --only database`).
- **🛟 Backup completo:** Config → Backup ganhou **🛟 Backup completo (nuvem)** (ADM/PO/Organizador): compara o backup semanal com hoje e traz de volta **só o que sumiu** (comentários dos cards, configurações, intake, subtimes, estrelas) — nunca sobrescreve. Os ADMs recebem o aviso 🛟 "Backup com problema" (sino + push) se um backup falhar. Depende das funções `backupCompletoApi`, `backupVigia`, `backupCompletoSemanal` publicadas.
- Ajuda do Maré e FAQ do Oceano em dia (Escala, login do iPhone, porta de entrada pelo Oceano, backup completo).

### 🚀 Promoção: Metas "O mar tá pra peixe", Escala, Pedido interno, login único pelo Oceano, login do iPhone — 2026-10-13 · kanban v8.30.845 · painel v5.59 · okr v2.70 · oceano v1.24 · mare-notif.js v24 · mare-metas.js v8 (novo) · mare-login.js v2 (novo) · escala.html v1.7 (nova) · intake.html (Pedido interno)
Sobe pra produção tudo o que estava validado em dev desde 10/10 (kanban-dev v8.30.825→845, painel-dev v5.45→5.59, okr-dev v2.70, oceano-dev v1.15→1.24, mare-notif-dev v23→24). Em `database.rules.json` os nós `metas_*`, `escala` e `notif_config` já estão publicados.
- **🐟 Metas e desafios ("O mar tá pra peixe"):** aba lateral 📊 Dados do Maré (squad | Digital) e 📊 Dados do Painel; meta com ritmo **linear ou por dia (diarização do time)**, faróis 🟢🟡🔴, popup de peixinhos a cada 20 %, **Atualizar valor** com data/hora (entrada retroativa, como soma ou como total) e **🗂 Entradas** (ver, editar, excluir). Lembrete de preenchimento (função `metasLembretes`).
- **🗓️ Escala (`escala.html`):** escala de trabalho/plantão/folga por dia — visão da squad, global e cadastro; visão 👥 no 📅 Calendários do Maré (marcador por dia no mês), imagem JPG da semana/dia, aviso (sino + push) a quem teve a escala cadastrada por um gestor.
- **📥 Pedido interno (`intake.html`):** pedido a uma squad já logado com o Google da Hering, com os campos que o PO liga/desliga; cai na caixa de Intake. Correção: salvar a config do Painel não religa mais o Intake nem apaga os campos do pedido interno (`dados/agil_cfg`).
- **🌊 Login único e Mural do Oceano:** Maré/Painel deslogados levam ao Oceano e voltam; Mural de avisos na página inicial do Oceano (recolhível, com indicador de novos); Comunicados com "Mostrar no mural do Oceano".
- **📱 Login do iPhone/iPad (`mare-login.js`):** no atalho da tela inicial o login do Google não trava mais (vai por navegação de página inteira, sem popup). **Pré-requisito:** as URLs `oceano.html` e `kanban.html` (e as `-dev`) cadastradas em *URIs de redirecionamento autorizados* do cliente web do Google Cloud.
- Notificações: tipos `escala` e `meta_lembrete` na Central; Escala/Metas no roteador do sino. Mais as correções das rodadas de /monitorarbugs de 13/10 (Metas, Escala JPG, Intake, login).
- Comunicados (rascunhos no Mural, para publicar): Metas, Escala e Pedido interno/login.

### 🚀 Promoção: logos novas do Painel e do A Bordo + Ajuda do Radar sem Arezzo — 2026-10-10 · kanban v8.30.824 · painel v5.44 · okr v2.69 · oceano v1.14 · mare-notif.js v22 (sem avisos)
Sobe pra produção o que estava em dev (kanban-dev v8.30.822→824, painel-dev v5.42→5.44, okr-dev v2.66→2.69, oceano-dev v1.12→1.14, mare-notif-dev v20→22).
- **Logo nova do Painel** (a ponte de comando) na aba do `painel.html` e no **menu de produtos (⋮⋮⋮)** e no tile do Oceano; **logo nova do A Bordo** (o convés) no menu e no Oceano (a aba da página `onboarding.html` já estava no ar). Arte maior e centralizada, ícones de 512 px legíveis até em 16 px; `?v=3` nas referências pra o navegador trocar a imagem antiga.
- **Radar:** a Ajuda "Link direto do Objetivo" não cita mais o login @arezzo no modo só Hering.
- **Agente Ágil:** a base de conhecimento (`conhecimento/*.json`) foi regenerada a partir das páginas de produção e deste CHANGELOG; as funções do agente só enxergam depois do deploy manual.
- Dica: não — troca de ícones e correção de texto.

### 🚀 Promoção: Dicas — no máximo 1 por dia por app — 2026-10-10 · kanban v8.30.821 · painel v5.41 · okr v2.65 · oceano v1.11 · mare-dicas.js v4 (sem avisos)
Sobe pra produção o ritmo novo das dicas (mini popups), validado em dev (kanban-dev v8.30.821, painel-dev v5.41, okr-dev v2.65, oceano-dev v1.11, mare-dicas-dev v4).
- **Antes:** até 4 dicas por abertura da página, com 50 s entre elas. **Agora:** **no máximo 1 dica por dia, por app** (Maré, Radar e Oceano contam separado), no dia do calendário da pessoa. Cada dica continua aparecendo **uma vez só**; amanhã vem a próxima ainda não vista. "Rever dicas" recomeça; desligar vale por app.
- A data da última dica fica em `kanban/usuarios/{uid}/dicas/ultima/{app}` (mesmo nó das dicas vistas, sem mudar regra) e também no aparelho; ao juntar aparelho e Firebase vale o dia mais recente.
- Textos atualizados: Ajuda do Maré ("Dicas (mini popups)"), aba 💡 Dicas do Painel e o interruptor da Ajuda dos apps.
- Dica: não — é a própria regra das dicas.

### 🚀 Promoção: Central de Notificações + correções de notificação — 2026-10-10 · kanban v8.30.820 · painel v5.40 · okr v2.64 · oceano v1.10 · mare-notif.js v19 (sem avisos)
Sobe pra produção o lote validado em dev (kanban-dev v8.30.818→820, painel-dev v5.38→5.40, okr-dev v2.62→2.64, oceano-dev v1.8→1.10, mare-notif-dev v17→19). Detalhes de cada item nas entradas de dev correspondentes.
- **🔔 Central de Notificações (Painel → aba Notificações):** catálogo dos 29 tipos de aviso (quando disparam, quem recebe, onde nascem), interruptores de **sino** e **push** por tipo (valem pra todo mundo; só PO/ADM gravam), quem está com Não Perturbe, uso dos últimos 7 dias. Os 4 sinos (Maré, Painel, Radar, Oceano) respeitam o interruptor ao vivo.
- **Menu de capa (🎨) do card** fecha por clique fora e não herda estado aberto ao reabrir/trocar de card.
- **Correções (notificações):** o sino não toca mais por tipo desligado quando a config chega depois; ADM só pelo e-mail vê os interruptores travados com aviso; religar um tipo ao vivo traz a notificação de volta; Comunicado urgente avisa quando o envio falha por papel; push de tipo sem card (reunião, feedback, intake…) não substitui o anterior.
- **Já no ar antes desta promoção (deploy manual feito):** regras `notif_config` (`firebase deploy --only database`) e funções `sendPushOnNotification`/`sendPushOnMural`.
- Dica: não — conjunto de correções + painel administrativo.

### 💡 Dicas: no máximo 1 por dia por app — 2026-10-10 · kanban-dev v8.30.821-dev · okr-dev v2.65 · oceano-dev v1.11 · painel-dev v5.41 · mare-dicas-dev v4 (SÓ DEV)
Pedido: "1 dica por dia por app". Antes o limite era por abertura da página (até 4 dicas, 50 s entre elas); agora é por **dia do calendário** (relógio da pessoa), contado **separado em cada app** (Maré, Radar e Oceano). Cada dica continua aparecendo **uma vez só, pra sempre**.
- **Como:** `prefs.ultima[app]` = `'AAAA-MM-DD'` da última dica mostrada naquele app, em `kanban/usuarios/{uid}/dicas/ultima/{app}` (mesmo nó das `vistas`/`off`, sem mudar regra) + cópia no aparelho. Ao reunir aparelho e Firebase vale o dia mais recente. O gatilho não abre nada se o app já gastou a dica de hoje; amanhã vem a **próxima não vista**. "Rever dicas" recomeça (a 1ª volta já, as demais uma por dia); desligar continua valendo por app. Saiu o limite de 4 por visita e o intervalo de 50 s (a regra do dia já cobre).
- **Textos:** Ajuda do Maré ("Dicas (mini popups)"), aba 💡 Dicas do Painel e o interruptor da Ajuda dos apps agora dizem "no máximo uma por dia".
- **Testes:** `test_dicas_dia.js` (11 checks: 1ª do dia aparece e grava o dia; 2ª no mesmo dia não — nem recarregando a página; outro app no mesmo dia aparece; no dia seguinte vem a próxima; "Rever dicas"; desligado) + `test_dicas.js` verde.
- **Dica:** não — é a própria regra das dicas.

### 🫨 Modo insistente (opt-in): chamar a atenção com tremor de tela, som repetido e título piscando — 2026-10-13 · kanban-dev v8.30.855-dev · painel-dev v5.64 · okr-dev v2.75 · oceano-dev v1.32 · mare-notif-dev v29 · mare-dicas-dev v5 (SÓ DEV)
- **Pedido do time:** "às vezes não ouvimos o barulho, queremos ser chamados mais a atenção" — mas **cada pessoa escolhe**. Padrão: **desligado** (o sino segue tocando só o "ding").
- **Como funciona (ligado):** quando chega um aviso **novo importante** (por padrão os mesmos tipos que viram push): 📳 a **tela treme** (~0,7 s, o "zumbido" do MSN) e, se a pessoa **não está olhando a janela**, 🔁 o **som se repete a cada 30 s** (até 5×) e 🪧 o **título da aba pisca** — até ela voltar à janela, clicar/teclar/tocar em algo ou o Não Perturbe ligar. Respeita 🔇 (sem som, o resto continua) e 🔕 Não Perturbe (nada acontece) e o "reduzir movimento" do sistema (sem tremor).
- **Escolha:** botão **🫨 Modo insistente** no rodapé do 🔔 (Maré, Radar, Painel e Oceano): ligar/desligar, e cada item (tremer · repetir som · piscar título · só importantes) + **▶ Testar agora**. Grava em `kanban/usuarios/{uid}/notif_prefs/insistente` (acompanha a conta em todos os aparelhos; sem regra nova — a pessoa já grava no próprio cadastro) e cópia no aparelho (`localStorage notif_insistente`).
- **Tremor seguro:** só o conteúdo principal (`#app-root`/`#app`) se mexe, animando `left`/`top` — nunca `transform`, que deslocaria modais, gaveta e botões flutuantes. Medido: os elementos fixos ficam parados durante o tremor.
- `MareNotif.insistente(opts)` é chamado junto do "ding" (`novas(ids, tipos)` no módulo; `renderNotifs()` no Maré). Os itens do sino do Radar/Oceano/Painel passaram a levar o `tipo` do aviso (pro filtro "só importantes").
- Ajuda do Maré (Notificações) e FAQ do Oceano atualizados; **dica nova no Maré** (`insistente`). Teste: `docs/arezzo/testes/test_insistente.js` (46 verificações: padrão desligado, persistência, tremor × fixos, foco, título, repetição com relógio simulado, Não Perturbe, "só importantes", reduzir movimento, preferência vinda da conta, menu, Maré).

### 🪟 Push com a janela visível mas sem foco (reunião) agora mostra o aviso do sistema — 2026-10-13 · kanban-dev v8.30.854-dev · painel-dev v5.63 · okr-dev v2.74 · oceano-dev v1.31 · mare-notif-dev v28 (SÓ DEV)
- **Caso real:** o Agente Ágil respondeu a uma @menção durante a reunião (notificação gerada, 3 aparelhos cadastrados, função enviou) e nenhum aviso do Windows apareceu. O FCM só entrega ao Service Worker (aviso do sistema) quando **nenhuma** aba está visível; com uma visível (Maré no 2º monitor, tela compartilhada, foco no Meet/Teams) entrega à própria página, que só mostrava um toast de ~3 s, fácil de perder.
- **Agora:** se a página recebe o push **sem foco** (`document.hasFocus()` falso) e a permissão está concedida, ela mostra também o aviso do sistema (`MareNotif.avisoSistema()`), com o mesmo título/texto/ícone/`tag` do Service Worker (mesma `tag` → um substitui o outro, nunca duplica) e o clique leva ao mesmo link. **Com foco** (a pessoa está olhando a janela) fica só o toast, como antes. O link do clique só aceita endereço do próprio site. Vale para Maré, Radar, Painel e Oceano (módulo compartilhado + o ouvinte próprio do Maré).
- Teste: `docs/arezzo/testes/test_push_foco.js` (Maré e Oceano: sem foco mostra, com foco não, sem permissão não, link de fora trocado, payload só com `notification`). Dica: não (é automático).

### 📲 Push: uma mensagem recusada pelo FCM não apaga mais os tokens de ninguém + o log diz o motivo — 2026-10-13 · `sendPushOnNotification` e `sendPushOnMural` (função; ainda não republicada)
- **Achado (/monitorarbugs "parece que ninguém tá recebendo push"):** a função apagava o `fcm_token` sempre que o erro do FCM continha `invalid-argument`. O FCM v1 usa esse código tanto para "este token é inválido" quanto para "a **mensagem** está errada" (payload malformado, grande demais, chave reservada), e o firebase-admin mapeia os dois para o mesmo `messaging/invalid-argument`. Uma única mensagem fora do padrão fazia o FCM recusar **todos** os tokens daquele envio e a função apagava todos os aparelhos da pessoa — e, mesmo depois de corrigida a mensagem, ninguém voltava a receber até reativar as notificações em cada aparelho. Agora só apaga o token quando o FCM diz que ele morreu (`registration-token-not-registered`, `invalid-registration-token`, ou `invalid-argument` cuja mensagem fala do token).
- **Observabilidade:** o log só dizia "N ok, M falhas", sem o porquê — impossível diagnosticar sem reproduzir. Agora cada envio com falha loga os **motivos** (código + exemplo + contagem) e, se o FCM recusar todos por motivo que não é token morto, vira `console.error` (aparece como erro no Cloud Logging).
- `functions/common/pushTokens.js` (`tokenMorto`, `resumirFalhas`, `falhaGeral`) usado pelos dois envios; 8 testes novos (incluindo o handler REAL com banco e FCM falsos: mensagem recusada por payload **não** apaga tokens — o teste falha no código antigo). Não muda nenhuma página. Deploy: `firebase deploy --only functions:sendPushOnNotification,functions:sendPushOnMural`.

### 🚨 VTEX: selinho de status no Oceano + aviso aos ADMs quando o monitor falha — 2026-10-13 · oceano-dev v1.29 · kanban-dev v8.30.852-dev · painel-dev v5.62 · okr-dev v2.73 · mare-notif-dev v27 · `vtexStatus` (SÓ DEV / função ainda não republicada)
- **Selinho no topo do Oceano:** azul "VTEX normal" (sem incidente, com "verificado há N min" no balão), vermelho piscando "VTEX: incidente" (o balão lista os incidentes e o clique abre a página do incidente) e cinza "VTEX: sem leitura" quando o monitor não registra batimento há mais de 20 min — **nunca afirma "normal" sem leitura recente**. Some se a função ainda não foi publicada ou se o interruptor `kanban/config/vtex_status_off` estiver ligado. No celular só o ponto aparece.
- **Batimento do monitor:** a cada tick a `vtexStatus` grava `kanban/vtex_saude` (`ok`, `ultimoOkEm`, `abertos`, `incidentes`, `falhasSeguidas`). Regra nova em `database.rules.json`: leitura pra conta Google @ciahering, escrita só pelo Admin SDK — **exige `firebase deploy --only database`** (sem ela o selinho fica oculto, nada quebra).
- **Aviso aos ADMs:** feed fora do ar, vazio ou com formato diferente por ~1 h seguida (12 ticks) → notificação 🛰️ `vtex_monitor_falhou` (sino + push, abre o Painel), uma vez por queda; voltou a ler, o contador zera. Tipo novo em `PUSH_TYPES`, `MareNotif.TIPOS` e `pushUrl.js`. `vtex_saude` fica fora do backup (efêmero).
- Testes: `vtexStatus` 18 casos (saúde, limite de falhas, aviso único, recuperação, feed sem item), regras (`vtex_saude`), `pushUrl`, `docs/arezzo/testes/test_vtex_selo.js` (8 cenários no Oceano). Dica: não.

### 🚨 Alerta automático de incidente da VTEX (popup + push pra todo mundo) — 2026-10-13 · kanban-dev v8.30.851-dev · painel-dev v5.61 · okr-dev v2.72 · oceano-dev v1.28 · mare-notif-dev v26 · `vtexStatus` (SÓ DEV / função ainda não publicada)
- **O que faz:** a função agendada `vtexStatus` lê o feed da página de status da VTEX (`https://status.vtex.com/feed.rss`, incident.io) a cada 5 minutos. Quando há incidente ou manutenção **em andamento**, publica sozinha um Comunicado 🚨 (popup que reaparece até acabar, todas as squads, também no Mural do Oceano) e manda uma notificação `vtex_incidente` (sino + push) pra todo mundo, menos convidados/visualizadores externos. Quando a VTEX marca como resolvido/concluído, o aviso é desativado.
- **Regras:** uma notificação por incidente (atualizações da VTEX só editam o mesmo aviso); manutenção só **agendada** vira aviso comum (⚠️, sem insistir, sem push) e só vira alerta quando começa; a 1ª execução não cria nada pro histórico já encerrado; o aviso expira em 3 h e é renovado a cada tick (se a função parar, o popup some sozinho); se um ADM apagar ou desativar o aviso à mão, a função respeita; item aberto há mais de 7 dias é ignorado; texto da VTEX é escapado (o título vai como texto puro).
- **Estado e interruptor:** `kanban/vtex_status/{id do incidente}` (entra no backup completo); desliga tudo com `kanban/config/vtex_status_off = true`.
- **Front (dev):** tipo `vtex_incidente` no catálogo da 🔔 Central de Notificações (`MareNotif.TIPOS`, ícone 🚨, push padrão ligado); clicar na notificação no Maré abre o Mural. Testes: `functions/vtex/__tests__/statusVtex.test.js` (feed real do incident.io como fixture, 13 casos) e `docs/arezzo/testes/test_vtex_alerta.js` (popup no Maré). Deploy: `firebase deploy --only functions:vtexStatus,functions:sendPushOnNotification`. Dica: não — é automático, não há nada a descobrir.

### ⏰ Metas: lembretes de preenchimento (função agendada) + aviso no sino — 2026-10-12 · kanban-dev v8.30.834-dev · painel-dev v5.50 · okr-dev v2.70 · oceano-dev v1.22 · mare-notif-dev v23 · `metasLembretes` (SÓ DEV / função ainda não publicada)
Fecha o pedido do "O mar tá pra peixe": "criar uma função de emitir lembrete de preenchimento da meta (horário de Brasília), configurável com presets: a cada 1h, a cada 2h, 1 vez por dia, horário exato".
- **Função `metasLembretes`** (`functions/metas/lembretes.js`, agendada **a cada 15 min**, fuso `America/Sao_Paulo`): cada meta/desafio configura o próprio lembrete no formulário (o PR anterior já grava `lembrete`): **a cada 1–4 h** dentro de uma janela (padrão 08:00–20:00), **1× por dia** (hora) ou **horários exatos** (até 4). Cada horário dispara em exatamente 1 tick (janela de 15 min) e `lembreteUltimo` evita aviso em dobro se o scheduler repetir.
- **Quando NÃO avisa:** meta inativa · fora do período · já batida (≥ 100 %) · alguém **atualizou há pouco** (a cada 2 h: nos últimos 110 min; diário/horários: 30 min) · interruptor geral `kanban/config/metas_lembretes_off = true`.
- **Quem recebe:** os "quem preenche" marcados na meta; sem ninguém marcado → **PO e Organizadores da squad** (nunca membro, convidado ou PO de outra squad) ou, nas metas do Digital, os **ADMs**. A notificação (`meta_lembrete`, "🐟 Atualize a meta: …", com última atualização e "hoje R$ X de R$ Y (42%)") cai no sino e também vira **push** (respeita Não Perturbe e o interruptor da Central de Notificações — tipo novo no catálogo, área "Prazos e rotinas"). **Clicar abre a aba 📊 Dados** (Squad/Digital) do Maré — no sino do Maré, do Painel, do Radar e do Oceano; o Maré aceita `?dados=squad|digital` no link.
- Escaneia os nós de produção **e os `_dev`** (dados de teste do dev) — dá pra validar o lembrete antes de promover.
- **Regras do banco testadas pela 1ª vez no simulador** (`rulesSim.js` ganhou `.validate`, `isNumber/isBoolean/hasChildren/numChildren` e `String.matches`): `metasEscalaRules.test.js` cobre também as regras da **Escala** (que não tinham teste) — próprio vs. de outros, PO/Organizador da squad vs. de outra squad, papel por squad vence o role global, formato (tipo/horário/nota/autor/data/campo extra). As regras das metas ganharam validação por campo (`atual`, `marco`, `marcoTs`, `atualizadoEm`, `ativo`) pra um update parcial não gravar lixo.
- **Testes:** `functions/metas/__tests__/lembretes.test.js` (13: fuso/virada de dia, horários, janela de 15 min, quando não avisa, destinatários, formato da notificação, retry sem duplicar, Digital × squad, `_dev`, interruptor, paridade da matemática com `mare-metas-dev.js`) + `metasEscalaRules.test.js` (14) → `npm test` em `functions/` **780/780**. `test_metas.js` ganhou 5 checks (clique no lembrete, `?dados=`).
- **Para entrar no ar (do SEU lado, `functions/` não publica sozinho):** resync do clone (`git fetch origin claude/agente-agil-orchestrator-jf99de` + `git reset --hard origin/claude/agente-agil-orchestrator-jf99de`), depois `firebase deploy --only database` e `firebase deploy --only functions:metasLembretes,functions:sendPushOnNotification` (a 2ª precisa conhecer o tipo novo no `PUSH_TYPES`).
- Dica: não.

### 🐟 Metas e desafios — "O mar tá pra peixe" (Black Friday, dor 2) — 2026-10-12 · kanban-dev v8.30.833-dev · painel-dev v5.49 · mare-metas-dev.js v1 (SÓ DEV)
Pedido: meta global (Digital) configurável pelo Painel, meta de cada squad em Configurações do Maré, **desafios extras** (por dia, submarca ou canal), tudo na aba lateral **Dados** (1ª aba = squad, 2ª = Digital), "mostrar na visão global", popup com peixinhos a cada 20 %, lembrete de preenchimento (horário de Brasília) e visual forte, no estilo do Radar.
- **Módulo novo `mare-metas-dev.js`** (compartilhado Maré + Painel, mesmo ciclo dev→prod do mare-notif/mare-dicas — as páginas carregam `?v=1`): matemática (% da meta, **ritmo esperado** pelo calendário, situação 🟢 no ritmo / 🟡 atenção / 🔴 atrasada / 🏆 batida / ⏳ não começou, marcos de 20 %, quanto falta e quanto precisa entrar por dia), os gráficos (anel de progresso com tracinho do "esperado hoje" e marcas de 20 %, barra de marcos com peixes, KPIs, **gráfico de evolução** linha real × ritmo ideal × meta, cartões de desafio com tags de dia/submarca/canal, ranking de squads), os formulários e o popup. Cores/tokens são os das páginas (funcionam nos 3 temas).
- **Maré — aba lateral 📊 Dados com 2 abas:** **🐠 squad** (meta principal em destaque + outras metas + 🏆 desafios, com ✏️ Atualizar valor e 📈 Evolução) e **🌊 Digital** (meta global, desafios do Digital, **ranking das squads** e cartões das metas marcadas "🌊 mostrar na visão global"; a Central de captação do dia continua logo abaixo). A aba escolhida fica lembrada.
- **Maré — ⚙ Configurações → 🐟 Metas** (PO/Organizador/ADM): criar/editar/excluir/desativar metas e desafios da squad — nome, ícone, formato (R$ / quantidade com unidade / %), alvo, ponto de partida, período (atalhos "Só hoje" e "🔥 Black Friday"), submarca, canal de venda, **🌊 mostrar na visão global**, **⏰ lembrete** (desligado · a cada 1–4 h dentro de uma janela · 1× por dia · horários exatos) e **quem preenche**.
- **Painel — 📊 Dados → 🐟 Metas e desafios do Digital:** a meta global e os desafios do Digital (ADM e editores de Dados criam/editam/atualizam; os demais só veem) + o ranking das metas das squads.
- **Atualizar valor:** "Definir o total" ou "+ Somar ao atual", com **prévia ao vivo** (novo %, situação e se vem peixe novo). Grava `atual`, o marco, quem/quando e o histórico (`metas_log`) num `update` só.
- **🐟 Popup "O mar tá pra peixe!"** a cada 20 % (20/40/60/80/100; 100 % = "Meta batida!" dourado): peixinhos pulando, ondas, próximo peixe. Uma vez por pessoa por marco (guardado no aparelho), só pra marco "fresco" (até 6 h — quem abre o Maré depois não leva enxurrada), na fila quando vários cruzam juntos. **Corrigir o valor pra baixo não derruba o marco** (a conquista fica). Respeita `prefers-reduced-motion`.
- **Dados:** `kanban/metas_digital[_dev]/{id}` (global), `kanban/metas_squads[_dev]/{squad}/{id}` (squads; `global:true` = visão do Digital), `kanban/metas_log[_dev]/{id}/{chave}` (histórico). Dev usa `_dev` (como `dados_diarios_dev`); produção, sem sufixo. **Regras novas em `database.rules.json`** (leitura: qualquer @ciahering; escrita das squads: membro da squad, PO/Organizador ou ADM; do Digital: @ciahering, com a tela restringindo a ADM/editores de Dados) — **precisa de `firebase deploy --only database`**.
- **Próximo (PR separado, exige deploy de função):** a função agendada de **lembretes** (os campos de lembrete já são gravados por este PR).
- **Testes:** `test_metas_calc.js` (14, matemática em Node) · `test_metas.js` (62, Maré: popup/fila/visto, abas, hero/KPIs/marcos, gráfico, atualizar valor, config criar/editar/excluir/desativar, permissões, caminhos `_dev`) · `test_metas_painel.js` (15) · `test_dados_diarios.js` ajustado (a captação agora está na aba 🌊 Digital).
- **Dica:** não — o próprio popup 🐟 e o aviso do lançamento apresentam; uma dica exigiria bump do módulo de dicas em 4 páginas.

### 🔎 /monitorarbugs Maré antes de subir — login direto × login único — 2026-10-13 · kanban-dev v8.30.845-dev · mare-login-dev v2 (SÓ DEV)
- **Achado (regressão minha do login direto):** na volta do Google o Firebase dispara um `auth-change` **nulo** antes do `signInWithCredential` terminar; o "login único" do Maré (`_irParaOceano()`) tratava isso como "deslogado" e mandava a pessoa pro Oceano — o token já tinha sido apagado da URL, então se perdia e a pessoa caía na tela de login de novo. Agora `MareLogin.voltando` (ligado quando a página volta do Google) impede o redirect. Reproduzido antes de corrigir (o fake de teste liga "login local" por padrão e escondia isso — o teste agora limpa essa trava).
- Sem achado: validação da volta (state/nonce/aud/iss/exp/idade), Oceano na volta, Escala dentro do calendário do mês (leitura "só a última vale", cache, iframe só recarrega se squad/semana mudou), 🗂 Entradas (Esc/empilhamento/trava de clique duplo), Intake.
- Observação: o **Radar** (`okr.html`) ainda não usa o login direto (fica fora do login único) — no atalho do iPhone ele pode ter o mesmo travamento. Teste: `test_login_direto.js`.

### 🔐 Login direto pro atalho do iPhone/iPad (Oceano e Maré) — 2026-10-13 · oceano-dev v1.24 · kanban-dev v8.30.844-dev · mare-login-dev v1 (SÓ DEV)
Relato de usuária (iPhone 12): o atalho na tela inicial **fica preso no login do Google**.
- **Causa provável:** no atalho (modo "app") o popup do Google abre numa janela que não devolve o resultado ao app — fica na tela do Google, **sem erro** (por isso o fallback "popup falhou 2×" do Maré nunca disparava; o Oceano nem tinha fallback). O redirect do Firebase também não serve no Safari/iOS recente (o resultado volta por um iframe de outro domínio, isolado pelo Safari).
- **Correção:** novo módulo compartilhado `mare-login-dev.js` — no atalho do iPhone/iPad (ou com `?loginDireto=1`) o botão **Entrar** leva a página inteira ao Google e volta com o `id_token` no fragmento da **própria página**, que entrega ao Firebase com `signInWithCredential`. Sem popup e sem storage de terceiros. Valida `state`, `nonce`, `aud`, `iss`, validade e idade da tentativa (10 min); apaga o token da barra de endereço na hora; erros viram aviso na tela de login. **Quem já entra bem não muda** (continua no popup).
- **Pré-requisito (uma vez, no Google Cloud Console):** em Credenciais → "Web client (auto created by Google Service)" → *URIs de redirecionamento autorizados*, incluir `…/hering/oceano.html`, `…/oceano-dev.html`, `…/kanban.html`, `…/kanban-dev.html`. Sem isso o Google mostra `redirect_uri_mismatch`.
- Observação: esse caminho não traz o token do Google Agenda (o Maré pede o escopo depois, no próprio fluxo). **Não foi possível testar num iPhone real** — validado em Chromium com iPhone emulado (ida, volta, nonce/state inválidos). Painel e Radar ainda não usam (mesmo padrão, se precisar).
- Dica: não. Teste: `test_login_direto.js` (+ `fakefb.js` ganhou `signInWithCredential`).

### 🩹 Hotfix kanban-dev v8.30.843-dev — texto de ajuda do 🗂 Entradas quebrava o script (SÓ DEV)
O PR do 🗂 Entradas (v8.30.842-dev) inseriu o texto novo na Central de Ajuda com quebras de linha de verdade dentro de uma string JS (`'...'`): "Invalid or unexpected token" — o `kanban-dev.html` não carregava. Corrigido (`\n\n`). Os testes tinham rodado ANTES dessa última edição de texto. Prod não foi afetada (nada disso foi promovido). Novo: `docs/demo/brainstorm-console.js` (códigos de console pro brainstorm: intake de demonstração, popup 🐟, escala fake e limpezas).

### 🐟 Metas: 🗂 Entradas — ver, editar e excluir o que foi lançado — 2026-10-13 · kanban-dev v8.30.842-dev · painel-dev v5.59 · mare-metas-dev v8 (SÓ DEV)
Pedido: depois de lançar não tinha como corrigir/excluir uma entrada (principalmente os dias lançados como parte).
- **Novo botão 🗂 Entradas** nos cartões (Maré e Painel, pra quem pode atualizar o valor): lista **todas** as entradas, mais nova primeiro — valor (parte "+X · total Y" ou "total Y"), data/hora, quem lançou, "lançado em" (retroativas), nota e "editado por". Cada uma tem **✏️ editar** (data, hora, valor, nota) e **🗑 excluir** (com confirmação que explica o efeito).
- **Contas certas:** *parte* editada/excluída desloca os pontos **posteriores** pela mesma diferença (o todo continua = soma das partes e o gráfico segue coerente); *total* mexe só naquele ponto. Mudar a **data** reordena e recalcula. O **valor atual** passa a ser o do último ponto (deslocado pela mesma diferença, então metas antigas com histórico incompleto não "pulam"); sem entrada nenhuma a meta volta a "sem valor ainda". O marco só sobe; futuro é recusado; trava de duplo clique; entrada que outra pessoa já excluiu avisa em vez de ressuscitar.
- Dado: ponto editado ganha `ed`/`edNome`; escrita num `update` só (pontos mudados + `atual`/`atualT`). Regras do banco já aceitam — **sem deploy**. Dica: não (o botão é rotulado). Testes: `test_metas_entradas.js` (11 cenários de lógica + modal no Maré).

### 🐟 /monitorarbugs Metas: colar a diarização sem período + `atualT` perdido ao editar — 2026-10-13 · kanban-dev v8.30.841-dev · painel-dev v5.58 · mare-metas-dev v7 (SÓ DEV)
Relato: ao colar 31 valores na grade "Por dia" aparecia "31 valor(es) colado(s) para 0 dia(s) — confira." e nada era preenchido.
- **Causa:** o período (de/até) estava em branco, então a grade tinha 0 dias; o colar só avisava (e o aviso sobrescrevia a explicação "Informe o período"). **Correção:** com o período ausente/incompleto o **Colar deduz o período do que foi colado** — linhas "dd/mm valor" montam do 1º ao último dia (vira o ano em dez→jan); só valores + "de" preenchido calcula o "até" (ou o contrário). Sem nenhuma data, explica o que falta e **não perde o texto**. "Distribuir igual" sem período agora avisa em vez de ficar mudo. Os avisos de quantidade ficaram específicos ("só os 30 primeiros entraram" / "os 2 últimos dias ficaram em branco").
- **Achado da varredura (técnica 2, caminhos que gravam a meta):** `salvar()` (editar/renomear a meta) não preservava o `atualT` (instante do valor atual) — depois de editar, um retroativo seguinte podia passar por cima do valor atual e o cartão perdia o "(valor de dd/mm hh:mm)". Reproduzido antes de corrigir.
- Dica: não (correção). Testes: `test_metas_curva_colar.js` (novo) e `test_metas_retroativo.js` (edição preserva `atualT`).

### 🐟 Metas: entrada retroativa como PARTE do total (dia a dia) — 2026-10-13 · kanban-dev v8.30.840-dev · painel-dev v5.57 · mare-metas-dev v6 (SÓ DEV)
Pedido: no retroativo só dava "definir o total" — pra lançar os 12 dias de setembro, um por vez, o todo tem que ser a **soma** deles.
- **"+ Somar ao atual" agora vale no retroativo:** com a data/hora no passado, o valor é uma **parte** (rótulo "Quanto entrou neste dia/horário"). Ela **soma ao total** e o histórico é **recalculado**: o ponto novo fica em (acumulado até ali + parte) e os pontos que vinham depois sobem a mesma parte — o gráfico continua coerente. Pode lançar **em qualquer ordem**; parte negativa corrige um dia lançado a mais.
- "Definir o total" retroativo continua existindo (acumulado daquele momento, só histórico se houver entrada mais nova). A prévia diz "Parte de dd/mm hh:mm: +X · o total passa de A para B".
- Dado: ponto do histórico ganha `d` (a parte); `atualT` nunca recua. Sem deploy (regras já aceitam). Dica: não. Teste: `test_metas_retroativo.js` (cenário de 3 partes fora de ordem + negativa).

### 🐟 Metas: "Atualizar valor" com data e hora da entrada (retroativo) — 2026-10-13 · kanban-dev v8.30.839-dev · painel-dev v5.56 · mare-metas-dev v5 (SÓ DEV)
Pedido: o valor pode ser lançado depois do fato (fechamento de ontem, de ontem às 14h…).
- **Modal "Atualizar valor":** novo campo **Data e hora da entrada** (horário de Brasília, padrão = agora). Mudando pro passado vira **entrada retroativa**: "Somar ao atual" fica desligado (informe o **total acumulado naquele momento**), aparece "🕒 Voltar pra agora" e a prévia explica o que vai acontecer. Data/hora no futuro é recusada.
- **Onde cai:** o ponto entra no **histórico e no gráfico na data certa** (guarda também quando foi lançado). Só vira o **valor atual** se for o mais recente — um retroativo mais antigo que o valor atual vai só pro histórico e **não derruba** o que já está lá (guarda `atualT`, o instante do valor atual; metas antigas usam a última atualização). "Quem/quando atualizou" (selo ⏰ e lembretes) continua sendo o momento real; o cartão mostra "(valor de dd/mm hh:mm)" quando o valor é retroativo.
- Dado: `atualT` na meta e `reg` no ponto do histórico (as regras do banco já aceitam — **sem deploy**). Dica: não. Teste: `test_metas_retroativo.js`.

### 🐟 Metas: ritmo NÃO linear — diarização definida pelo time — 2026-10-13 · kanban-dev v8.30.838-dev · painel-dev v5.55 · mare-metas-dev v4 (SÓ DEV)
Pedido: a venda não cresce igual todo dia — o time define antes uma **diarização** (quanto a meta pede de cada dia). Até aqui o "esperado hoje" era sempre uma reta.
- **Cadastro (Maré e Painel):** novo campo **Ritmo ao longo do período**: 📏 *Linear* (padrão, como antes) ou 📅 *Por dia*. Em "Por dia" aparece uma grade com uma linha por dia do período (seg 12/10, ter 13/10…) e o acumulado em % ao lado; **Distribuir igual** e **📋 Colar da planilha** (uma coluna de valores na ordem dos dias, ou linhas "12/11 1500", formato BR: `1.500,50`, `R$ 2000`, `10%`). Vale a **proporção** entre os dias (não precisa fechar a soma com a meta — o formulário avisa a diferença). Mudar o período mantém os valores dos dias que ficaram. Máx. 93 dias; "por dia" exige período com ≥ 2 dias.
- **O que passa a seguir a curva:** o **esperado agora** (tracinho do anel e da barra: o acumulado até ontem + a parte de hoje na proporção da hora do dia, pra um dia pesado não deixar o farol vermelho às 00:01), os **faróis** 🟢🟡🔴 / a **situação** (no ritmo / atenção / atrasada — e nada pedido ainda = no ritmo), o **gráfico** (a linha do ritmo ideal vira a curva do time, legenda "ritmo do time (diarização)"), tag **📅 diarizada** e o KPI novo **Meta de hoje** (quanto só hoje pede). Linear continua igual; voltar pra Linear e salvar remove a curva. Dado: `curva: { 'AAAA-MM-DD': peso }` na própria meta (as regras do banco já aceitam — sem deploy).
- Dica: não (é um campo do próprio formulário, com texto explicativo). Teste: `test_metas_curva.js`.

### 🌊 Oceano: sem cartão da Travessia na home — 2026-10-13 · oceano-dev v1.23 (SÓ DEV, teste)
Pedido pra testar: o cartão "Travessia · em breve" saiu da grade de produtos da página inicial; ela continua em **Conheça o Oceano** (aba de produtos). Para voltar, é só trocar o filtro de `renderTudo()` por `a.futuro || visivel(a)`. O `oceano.html` (produção) não mudou.

### 🍎 Login no iPhone: "Unable to process request due to missing initial state" no Safari (link aberto do WhatsApp) — 2026-10-13 · mare-login-dev v3 · oceano-dev v1.27 · kanban-dev v8.30.850-dev · escala-dev v1.10 · intake-dev (SÓ DEV — **a correção só vale em produção depois de promover `mare-login.js` + as páginas**)
Relato de uma usuária (print: Safari com "◄ WhatsApp" no topo, em `hering-onboarding.firebaseapp.com`): "Unable to process request due to missing initial state. This may happen if browser sessionStorage is inaccessible or accidentally cleared… Using signInWithRedirect in a storage-partitioned browser environment". Era o MESMO defeito do atalho da tela inicial (o login do Firebase passa por um iframe/janela do domínio `firebaseapp.com` e o Safari isola o storage de terceiros), só que **no Safari comum**: a correção anterior (login direto, sem popup) só ligava no atalho (`standalone`), então um link aberto de outro app (WhatsApp) ainda caía no popup.
- **`MareLogin.usar()` agora vale pra TODO iPhone/iPad** (Safari comum, Chrome/Firefox do iOS — todos WebKit — e atalho), menos convidado externo (`?login=local`, que o login direto não aceita). Quem não é iOS continua no popup.
- **Escala e Intake também:** como cada página que usa o login direto precisa da própria URL cadastrada no Google Cloud (e elas não estão), ganharam o modo **`{hub:true}`**: a volta do Google é no **Oceano** (URL já cadastrada) e, assim que o Firebase confirma o login (todas as páginas são da mesma origem, então o login vale pra todas), o Oceano **leva a pessoa de volta pra página de onde ela saiu**, com a mesma query (`?squad=…`). O destino só é seguido se for um caminho relativo da própria origem (`//outro.site` é ignorado). Nenhuma URL nova a cadastrar.
- **Ainda de fora:** o **Radar** (`okr.html`) — o Radar aceita visualizador externo com Gmail, e o Oceano (que serve de hub) recusa conta de fora; um Radar no iPhone pode ter o mesmo erro. Se aparecer, o caminho é cadastrar `okr.html`/`okr-dev.html` no Google Cloud e ligar o `MareLogin` direto lá.
- Ajuda do Maré e FAQ do Oceano atualizados. Testes: `test_login_direto.js` (+9: iPhone no Safari comum, `?login=local`, Escala e Intake pelo hub, volta pelo hub, `ret` malicioso ignorado). Dica: não (correção).

### 🛟 Backup: vigia que avisa quando falha + tela de restauração no Maré + Central de Dados do painel de teste no backup — 2026-10-13 · kanban-dev v8.30.849-dev · painel-dev v5.60 · okr-dev v2.71 · oceano-dev v1.26 · mare-notif-dev v25 · functions (**requer deploy**)
Os 3 pedidos depois da validação do backup completo:
- **1. Aviso quando falhar — `backupVigia` (todo dia 09:00, Brasília):** uma falha de backup só aparecia no log e na coluna "último resultado" do Cloud Scheduler (ninguém olha), e se a função **nem rodasse** não havia nem log. O vigia não confia na execução: confere o **resultado no Storage** — (a) existe o manifesto do completo **diário** de hoje e sem erros? (b) o completo **semanal** mais recente tem ≤ 8 dias e sem erros? (c) o backup do **quadro** (`weeklyBackup`, `backups/{squad}/…`) de cada squad ativo tem ≤ 8 dias? Se algo falhar, os **ADMs** recebem a notificação 🛟 "Backup com problema" (sino + **push**; tipo novo `backup_falhou` em `PUSH_TYPES`, no catálogo da Central de Notificações e no roteador — clicar abre o Painel). No máximo **1 aviso por dia** (id `backup_{data}`; reexecutar não duplica nem reabre uma já lida). Cobre também o `weeklyBackup` antigo, que ninguém tinha como saber se ainda rodava.
- **2. Restaurar pelo Maré — ⚙ Config → Backup → 🛟 Backup completo (nuvem)** (só ADM/PO/Organizador): ☁️ **Ver backups disponíveis** → data → 🔍 **Comparar com hoje** (por área: 💬 comentários dos cards, ⚙️ configurações do squad, 📥 pedidos de intake, 👥 subtimes, ⭐ estrelas — quantos itens **sumiram**, com exemplos) → marcar → 🧯 **Restaurar as áreas marcadas**. **Só volta o que sumiu; o que existe hoje nunca é sobrescrito** (config: só as chaves que não existem mais; subtimes: por `id`). Como o Storage de `backups-completos/` não é legível pelo cliente (tem papéis/e-mails de todo mundo), quem lê é a nova função HTTP **`backupCompletoApi`** (Bearer idToken, mesmo padrão do Spotify; confere conta Google @ciahering + papel **no squad** — PO/Organizador só no que estão inscritos, ADM em qualquer um). Antes de gravar, a lista exata de caminhos criados vai pra `backups-completos/pre-restauracao/` (desfazer = apagar esses caminhos) e quem restaurou fica em `squads/{squad}/dados/backup_restauracoes/`. **Cuidado resolvido:** restaurar um comentário que menciona o Agente Ágil dispararia o gatilho `onValueCreated` do agente de novo — a restauração grava, na MESMA atualização, o marcador de "já processado" (`agente_agil_mencao_processed/{id}`) desses comentários (sem sobrescrever o que já existia); os contadores 💬 se refazem sozinhos (`contarComentarios`). O quadro (cards/colunas/tags) segue na 🧯 Restaurar de sempre (tem índices derivados).
- **3. `dados_diarios_dev` no backup completo (semanal):** a Central de Dados também é publicada pelo painel de teste; é a única exceção à regra "nós `_dev` ficam de fora".
- **Deploy (na sua máquina, depois do resync):** `firebase deploy --only functions:backupVigia,functions:backupCompletoApi,functions:backupCompletoSemanal,functions:sendPushOnNotification` (o último por causa do `backup_falhou` no `PUSH_TYPES`). A tela do Maré só funciona depois que `backupCompletoApi` estiver publicada (antes aparece "a função ainda não foi publicada?").
- Testes: `backup/__tests__/vigia.test.js` (6) e `restaurarApi.test.js` (8: permissão por papel/squad/provedor, validações, listar, comparar sem gravar, restaurar só o que sumiu + registro + desfazer, marcador de menção do agente, núcleo puro) — suíte de funções 801/802 (1 skip); `docs/arezzo/testes/test_backup_completo.js` (12, API simulada). `fakefb.js` agora dá `getIdToken()` ao usuário falso. Dica: não (ferramenta de ADM/PO, já fica à vista em Config → Backup).

### 🛟 Backup completo do banco: o `weeklyBackup` só guardava o quadro — comentários, configs, Radar, Metas, Escala e usuários não tinham cópia — 2026-10-13 · `functions/backup/completo.js` + `restaurar.js` · kanban-dev v8.30.847-dev (texto de Ajuda) (funções: **requer deploy**)
Auditoria pedida ("o backup deve estar bem desatualizado"). O `weeklyBackup` (12/08) copia, por squad, só `cards`, `columns`, `tags`, `agil_cfg`, `ql_items`, `links`, `cal_events` e `auto_rules` — o formato que a UI 🧯 Restaurar entende. **Sem nenhuma cópia:**
- **Dentro de cada squad** (`kanban/squads/{id}/dados`): `card_comments` (todos os comentários), `config` (Raias, Ficha Técnica/fan-out, padrões de card, calendários, modo de impedimento, listas de criativos, submarca/canal…), `intake_pending`, `notas`, `lembretes`, `subtimes`, `kudos`, `archive_cfg`, `agentes`; e ao lado de `dados`: `snapshots` (histórico do CFD/burndown) e `externos` (whitelist).
- **Fora dos squads:** `okr` (Objetivos, Marcos, Mural, Calendário, notas de reunião), `metas_*`, `escala` (inclusive as pausas), `usuarios` (papéis, squads, torre, preferências), `usuarios_publicos`, `squads_meta` (quais squads existem), `comunicados`, `painel`, `config` (links da Hering…), `notif_config`, `painel_viewers`, `campanhas*`, `dados_diarios`, `feedback`.
- Os backups manuais (Config → Backup e Painel → 💾 Backup global) têm o mesmo recorte curto (o do painel tem só 5 campos). Não foi mudado — a UI de restaurar segue igual.
**O que entrou (aditivo — o `weeklyBackup` continua como está):**
- `backupCompletoSemanal` (domingo 04:30): cada squad **inteiro** + todos os nós globais → `backups-completos/semanal/{data}/` (retenção 90 dias). `backupGlobalDiario` (todo dia 03:30): só os nós globais pequenos e insubstituíveis (OKR, Metas, Escala, usuários, squads_meta, comunicados, painel, config…) → `backups-completos/diario/{data}/` (14 dias). Cada pasta traz `manifesto.json` (o que entrou, tamanhos, vazios, erros e o que nunca entra); se um item falha o resto é salvo e a execução termina com erro (visível no monitoramento).
- **Nunca entram:** segredos do Spotify/OAuth, tokens de push (`fcm_tokens`), notificações pessoais, presença/locks/telemetria/debug e os nós `_dev`. O prefixo `backups-completos/` **não é legível pelo cliente** (`storage.rules` explícito) — tem papéis e e-mails de todo mundo, diferente de `backups/**`, que qualquer @ciahering lê.
- **`functions/backup/restaurar.js`** (script local, dry-run por padrão): `--listar`, `--no okr`, `--squad dados`, `--aplicar`. Só **mescla** (`update`; em `usuarios` por pessoa, preservando notificações e tokens) e grava o estado atual em `pre-restauracao/` antes, pra desfazer.
- **Pendências suas:** (1) resync do clone + `cd functions && firebase deploy --only functions:backupCompletoSemanal,functions:backupGlobalDiario`; (2) `gsutil lifecycle set storage-lifecycle.json gs://hering-onboarding.firebasestorage.app` (regras novas de retenção — e confira que a de `backups/` de 60 dias de fato está aplicada); (3) opcional `firebase deploy --only storage` (só deixa a negação escrita; já era negado por padrão); (4) confirme no console que `backups/{squad}/` vem recebendo arquivos aos domingos (não dá pra verificar daqui). Nó novo no banco = 1 linha em `NOS_GLOBAIS` (senão fica sem backup).
- Testes: `backup/__tests__/completo.test.js` (5: semanal completo sem segredos, diário, erro parcial, filtros, plano de restauração); suíte de funções 787/787. Ajuda do Maré (Config → Backup) cita o backup completo. Dica: não (infra).

### 📘 Docs em dia (13/10): Ajuda do Maré, FAQ do Oceano, maredigital.html, CODE_MAP e CLAUDE.md — 2026-10-13 · kanban-dev v8.30.846-dev · oceano-dev v1.25 (SÓ DEV; texto de ajuda, sem mudança de comportamento)
- **Ajuda do Maré (`HELP_CONTENT`):** a entrada **Escala** foi reescrita (filtros na mini tela 🔎, Visão Gantt, ☕ pausas, JPG do Gantt; um parágrafo de JPG estava colado no do aviso). **Notificações** ganhou os tipos 🗓️ Escala e 🐟 lembrete de meta; **Calendário** aponta pra visão 👥 Escala; **Instalar no celular** explica o login direto no iPhone/iPad; **Menu de produtos/Oceano** explica a porta de entrada (login único + Mural + ↩ Continuar). A entrada de Metas e a de Intake já estavam em dia (conferidas).
- **FAQ do Oceano:** "Como instalo?" ganhou o login do iPhone/iPad; id duplicado `sino` (duas perguntas com o mesmo `faq-sino`) corrigido — a 2ª virou `notif`.
- **`maredigital.html`:** versões (kanban v8.30.845 · painel v5.59 · okr v2.70 · oceano v1.24 + dev), módulos `mare-notif` v24 / `mare-dicas` v4 / `mare-metas` v8 (agora em prod), linhas novas de `mare-login`, `escala` e `intake`, tipos de push e interruptor `notif_config`, nós `escala/` e `metas_*` na estrutura do banco, regras de escala (campo `p`) e metas, função `metasLembretes`, cards de Metas, Escala, Pedido interno e Porta de entrada; a descrição das Dicas dizia "50 s / 4 por sessão" (hoje é 1 por dia por app).
- **`CODE_MAP.md`:** 391 âncoras revalidadas por script (faixas de seção do script reajustadas), registro de exports de `functions/index.js` renumerado, cabeçalho e rodapé do retrato. **`CLAUDE.md`/`docs/OCEANO.md`:** Metas, login direto e Escala marcados como em prod; Escala v1.8–v1.9 documentada.
- **Sem mudança:** Ajuda do Radar e `guia-okr.html` (o Radar só ganhou o módulo de lembretes desde 10/10). O conhecimento do Agente Ágil só muda quando a Ajuda/Changelog de **produção** mudar — regenerar (`cd functions && npm run conhecimento`) e republicar as funções do agente na próxima promoção. Dica: não (documentação).

### 🗓️ Escala: filtros numa mini tela, ☕ pausas no cadastro e 🖼️ JPG da Visão Gantt — 2026-10-13 · escala-dev v1.9 · `database.rules.json` (campo `p`) (SÓ DEV)
- **🔎 Filtros viraram um botão:** a faixa de chips que ocupava a tela saiu. Na barra fica só **🔎 Filtros** (com um selo com o número de filtros ativos e destaque quando há filtro); clicando abre uma **mini tela** com os chips de squad e de subtime (multi-seleção, "Todas"/"Todos", ✕ Limpar filtros, "Pronto (N)"). Clicar nos chips já filtra a página por trás; Esc fecha. Mesmo comportamento de antes (URL `f_sq`/`f_sub`, vale pro JPG).
- **🖼️ JPG da Visão Gantt:** ao baixar a imagem do **Dia** há agora **📋 Lista | 📊 Visão Gantt**. O botão do detalhe do dia vira "JPG do Gantt" quando a visão é Gantt (nome do arquivo termina em `-gantt`). A imagem tem eixo de horas, barra por pessoa (verde = escalado, laranja = plantão, listrado/tracejado = "dia todo"), pausas tracejadas, linha de cobertura por hora, folga à parte e agrupamento por squad na visão global.
- **☕ Pausas (entradas e saídas adicionais):** no **Cadastrar escala**, abaixo de Entrada/Saída, **☕ Adicionar pausa (saída e volta)** — até 3 por dia (ex.: almoço 12:00–13:00). Validação: volta depois da saída, dentro do expediente, em ordem e sem sobrepor; ao virar Folga a pausa é descartada. A pausa aparece na lista do dia ("☕ pausa 12:00–13:00"), no tooltip/☕ da célula, **na Visão Gantt como intervalo no meio da barra** (a cobertura por hora não conta a pessoa durante a pausa) e no JPG. Editar um dia que já tem pausa abre com ela preenchida.
- **⚠️ Exige `firebase deploy --only database`:** o dado novo é `kanban/escala/{data}/{squad}/{uid}/p` (texto `"12:00-13:00;15:00-15:15"`, validado nas regras; sem o deploy o banco recusa gravar escala com pausa). Regras testadas em `metasEscalaRules.test.js`.
- Dica: não — a Escala é página própria (sem o módulo de dicas) e os três recursos aparecem à vista (botão Filtros, botão "Adicionar pausa", seletor Lista | Gantt). Ainda não aparece a pausa no popover do Calendário do Maré (`kanban-dev`, só horário). Testes: `test_escala_pausas.js` (novo), `test_escala_gantt.js`/`test_escala.js`/`test_escala_jpg.js` adaptados à mini tela.

### 🗓️ Escala: filtros em chips + 📊 Visão Gantt do dia — 2026-10-13 · escala-dev v1.8 (SÓ DEV)
- **Filtros viraram chips:** a barra de filtros mostra **chips de squad** (visão da squad: a que está em foco, clicar em outra troca a squad; visão global: **Todas** ou várias squads ao mesmo tempo) e **chips de subtime** (multi-seleção, **Todos** limpa). Subtime de uma squad que saiu do escopo deixa de filtrar. Entram na URL (`?f_sq=dev,dados&f_sub=Designers,Backend`), valem pro JPG, e **✕ Limpar filtros** zera os dois. O select de squad continua no topo.
- **📊 Visão Gantt (detalhe do dia):** ao abrir um dia há agora **📋 Lista | 📊 Visão Gantt**. No Gantt cada pessoa é uma linha com uma **barra do período** em que está (✅ azul, 🔥 laranja pro plantão; sem horário = barra listrada "dia todo"; só entrada = barra aberta pra direita, só saída = pra esquerda). O eixo se ajusta aos horários do dia (padrão 08h–18h), tem marcador vermelho de **agora** no dia de hoje, linha de **cobertura por hora** (quantas pessoas em cada hora) e a folga numa linha à parte. Na visão global o Gantt agrupa por squad. A escolha fica lembrada no aparelho.
- Dica: não — a Escala é página própria (não carrega o módulo de dicas) e o Gantt é um botão visível no próprio detalhe do dia. Testes: `test_escala_gantt.js` (novo), `test_escala.js` e `test_escala_jpg.js` adaptados aos chips.

### 🗓️ Escala: aviso à pessoa + Escala no mês do Calendário — 2026-10-13 · kanban-dev v8.30.837-dev · painel-dev v5.54 · escala-dev v1.7 · mare-notif-dev v24 · `sendPushOnNotification` (SÓ DEV)
- **🔔 Aviso quando o gestor cadastra por você:** PO/Organizador/ADM que cadastra (ou limpa) a escala de OUTRA pessoa gera uma notificação pra ela — "🗓️ Sua escala foi cadastrada/removida" com squad, período, tipo/horário e quem fez. Uma por cadastro; quem mexe na própria escala não se avisa. Clicar (sino do Maré, Painel, Radar e Oceano) abre a Escala na squad e na semana certas. Tipo novo `escala` (catálogo da Central de Notificações, ícone 🗓️, push por padrão — **exige `firebase deploy --only functions:sendPushOnNotification`**; o clique do push abre `escala.html`, que passa a existir na promoção).
- **📅 Escala no mês do Calendário (Maré):** nas visões Tudo/Eventos/Prazos, cada dia mostra a **sua** escala (✅ horário · 🔥 Plantão · 🏖️ Folga) e quantas pessoas da squad estão escaladas (👥 N · 🔥 plantão). Clicar no dia lista quem está (plantão, escalados, folga) com "Abrir na Escala ›", que vai pra aba 👥 já na semana do dia. Botão **👥 Escala ✓/✗** nas Legendas liga/desliga (lembrado no aparelho). Custo: 1 leitura do intervalo visível de `kanban/escala` por mês navegado (cache de 5 min), só com o Calendário aberto; conta sem permissão de leitura vê o mês normal.
- Dica: não (o resumo aparece na própria tela e o botão tem tooltip). Testes: `test_escala_aviso.js`, `test_escala_calendario.js`.

### 🐛 /monitorarbugs (13/10, 3ª rodada): Intake — Painel apagava a config do intake — 2026-10-13 · painel-dev v5.53 · intake-dev (SÓ DEV)
- **⚙ Config do board no Painel apagava a configuração do intake (severo).** `saveCfg()` gravava `agil_cfg` com `set()` de um objeto novo (sprint, WIP, capacidade…), e esse mesmo nó guarda o que o Maré grava: `intakeEnabled`, `intakeCampos` ("Campos do pedido interno") e `bfBannerMsg`. Salvar a config de uma squad no Painel **religava os pedidos que o PO tinha desligado** (o link público voltava a aceitar) e zerava os campos escolhidos. Agora usa `update` (mescla). **O mesmo código está em `painel.html` (produção)** — vai na próxima promoção do Painel.
- **Pedido interno com prazo no passado:** o formulário é `novalidate`, então o `min` do campo não barrava data digitada à mão (o card nascia com prazo vencido). Agora avisa "O prazo desejado já passou".
Sem achado: envio interno (trava de duplo clique, número de chamada ao trocar de squad), campos configuráveis × padrão, criar card/vincular/guardar/descartar, notificação `intake` (push, navegação), regras de `intake_pending`.

### 🐛 /monitorarbugs (13/10, 2ª rodada): Escala — celular e menções — 2026-10-13 · escala-dev v1.6 (SÓ DEV)
- **Celular:** a barra da semana (◀ data ▶ Hoje 🔥 Black Friday) não quebrava linha e estourava a largura: a página ganhava rolagem lateral e o botão da Black Friday ficava cortado. Agora quebra linha.
- **📋 Copiar menções (visão "Todas as squads"):** quem está em duas squads aparecia duas vezes (`@AL @AL @BR`) e inflava o contador. Agora uma vez só.
Sem achado: cadastro (período × dias da semana, limpar, troca de squad, trava de duplo clique), regras × tela (gestor/PO/Organizador/ADM/própria), leitura da janela (só a última vale), escape de HTML, embutida no Calendário do Maré.

### 🐛 /monitorarbugs (13/10): Metas e Escala JPG — 2026-10-13 · kanban-dev v8.30.836-dev · painel-dev v5.52 · escala-dev v1.5 · mare-metas-dev v3 · `metasLembretes` (texto) (SÓ DEV)
Rodada sobre o código de 12/10 (Escala JPG + Metas). 5 achados, todos reproduzidos antes de corrigir (`test_monitorarbugs_1013.js`):
- **Esc fechava a tela de baixo.** Apertar Esc no formulário de meta/desafio (ou no popup 🐟) fechava também o ⚙ Configurações que estava por trás — o Esc do módulo não parava o evento. Agora fecha só a camada de cima (e o ouvinte não fica mais pendurado quando o modal é fechado por Cancelar).
- **Excluir meta deixava o histórico órfão.** As regras só liberam apagar as *chaves* de `metas_log/{id}`, não o nó-pai; o erro era engolido. Agora apaga chave a chave (não precisa publicar regra nova).
- **"+ Somar ao atual" perdia a soma de outra pessoa.** A conta partia do valor visto quando o modal abriu: se alguém informou 230 nesse meio-tempo, somar 20 sobre 180 gravava 200. Agora parte sempre do valor mais novo (prévia e gravação). Pelo mesmo motivo o **marco já conquistado não desce mais** (antes comparava com o marco velho: 80 → 60).
- **99,7 % aparecia como "100%"** (anel, cartão, ranking, prévia e texto do lembrete) sem ser meta batida. Agora só mostra 100 % quando bate de verdade.
- **Escala JPG: arquivo errado.** Fechar o modal com a leitura pendente e abrir outro (ex.: "JPG do dia") reiniciava o contador de chamadas e a resposta velha trocava a imagem/nome do botão ⬇️: a prévia dizia *Dia*, o arquivo baixado era a *semana*. Contador agora global.

### 🖼️ Escala: baixar em JPG (dia · semana · mês) + títulos de Dados em fonte mais legível — 2026-10-12 · escala-dev v1.4 · kanban-dev v8.30.835-dev · painel-dev v5.51 · mare-metas-dev v2 (SÓ DEV)
- **Baixar JPG na Escala:** botão **🖼️ Baixar JPG** na barra (e **🖼️ JPG do dia** no detalhe de cada dia). Escolhe **Dia / Semana / Mês** + uma data de referência, vê a prévia e baixa. Vale pra visão da tela (a squad escolhida ou **todas as squads**) e respeita o **filtro de subtime**. Semana (squad): pessoas × dias com chips Escalado/Plantão/Folga, horário e linha de cobertura; semana (global): um bloco por squad com os nomes; dia: lista por squad; mês: calendário com nomes (squad) ou contagem por squad (global). Imagem em tema escuro, com legenda e data de geração, pronta pra WhatsApp/apresentação.
- Desenhada direto num `<canvas>` (sem biblioteca externa, sem foto de perfil — foto de outro domínio bloquearia o download). Lê o período direto do banco (não depende da semana aberta na tela).
- **Fonte:** o título "📊 Dados — metas, desafios e captação" e os títulos/popup do módulo de metas deixam a Syne (difícil de ler) e passam a **DM Sans em negrito**.
- Teste novo: `docs/arezzo/testes/test_escala_jpg.js` (13 cenários: modal, prévia, download real com assinatura JPEG, modos, global, subtime, atalho do dia, troca rápida de modo).
- Dica: não — a Escala ainda está em dev e o botão é autoexplicativo.

### 📅 Escala dentro do Calendário (some o botão da barra) — 2026-10-12 · kanban-dev v8.30.832-dev · escala-dev v1.3 (SÓ DEV)
Pedido: "não acho que deveria ser um botão externo na toolbar, deveria ser dentro de calendário".
- **Saiu** o botão 🗓️ Escala da barra do board (e a ação equivalente dos atalhos configuráveis).
- **Entrou** a visão **👥 Escala** no 📅 Calendários, ao lado de Tudo / 🗓️ Eventos / 📎 Prazos. Escolhendo, o mês, os filtros e o "+ Evento" saem de cena e aparece a Escala da squad atual (a MESMA página `escala-dev.html`, embutida com `?embed=1` — sem cabeçalho/rodapé; squad, 🌐 Todas as squads, filtro de subtime e ➕ Cadastrar escala funcionam igual). Há um link "↗ abrir em tela cheia". A página só carrega quando a pessoa abre a visão (e recarrega se a squad mudou); reabrir o Calendário lembra a visão em que estava.
- **Mantido:** a aba **Escala ↗** do Painel (abre a visão global em outra aba) — me avise se também deve sair/ir pra dentro do calendário do Painel.
- **Testes:** `test_escala.js` (78 checks) agora cobre o Calendário: sem botão solto, a visão ao lado das outras, iframe com `embed=1` na squad atual, mês/filtros escondidos, página sem cabeçalho, voltar pra Tudo.
- Dica: não.

### ✂️ Escala: fica só o filtro de subtime — 2026-10-12 · escala-dev v1.2 · kanban-dev v8.30.831-dev (SÓ DEV)
Pedido: "deixa só subtime". Saem os filtros de **squad** e de **submarca** da v1.1 (e o campo "Submarcas que cobre" do cadastro e a validação `s` das regras do banco — **não precisa do segundo deploy de regras**; quem já publicou a versão com `s` pode republicar sem ele, não faz diferença). Fica o **filtro de subtime** nas duas visões (por nome: "Designers" junta os Designers de todas as squads na global), com ✕ Limpar filtro e `?f_sub=` na URL; a barra some em squad sem nenhum subtime. O filtro só esconde pessoas — o ➕ Cadastro continua listando a squad inteira.
- **Testes:** `test_escala.js` com os checks de filtro reescritos pra só subtime (global, link, visão da squad, squad sem subtimes, cadastro não afetado).

### 🔎 Escala: filtros de squad, subtime e submarca — 2026-10-12 · escala-dev v1.1 · kanban-dev v8.30.830-dev (SÓ DEV)
Pedido: "filtro de subtime, submarca e squad (na visão global)".
- **Barra 🔎 Filtrar** (squad · subtime · submarca · ✕ Limpar filtros), valendo nas duas visões — o filtro de **squad** só aparece na global. Os filtros entram na URL (`f_sq`, `f_sub`, `f_sm`), então dá pra mandar o link já filtrado.
- **Subtime:** vem dos subtimes que o PO cria no Maré (`kanban/squads/{sq}/dados/subtimes`, membros por iniciais). Na visão global, subtimes de squads diferentes com o mesmo **nome** viram uma opção só ("Designers" = todos os Designers de todas as squads). Filtrar esconde as pessoas de fora e as squads que ficam sem ninguém.
- **Submarca (decisão: marcada em cada dia):** no ➕ Cadastro, campo opcional **"Submarcas que cobre"** (chips das submarcas que a squad usa — as 10 fixas do Maré, respeitando as "submarcas visíveis"; só aparece em squad com o campo Submarca ligado e some em Folga). O filtro mostra **quem cobre aquela submarca naquele dia**; o aviso de buracos passa a dizer "sem ninguém cobrindo Kids Comercial". O chip do dia ganha 🏷 e o detalhe do dia lista as submarcas.
- **Dados/regras:** entrada ganha `s: {tag_sm_*: true}` (mapa, até 12). `database.rules.json` valida (`tag_sm_…` = true) — **precisa de novo `firebase deploy --only database`**. Lê também `squads/{sq}/dados/config/submarca_ativo|submarcas_visiveis` e `subtimes` (leituras pequenas, uma vez por abertura).
- **Testes:** `test_escala.js` agora com 86 checks (filtros em global/squad, escopo das opções, subtime × submarca juntos, link com filtros, cadastro com submarca/folga/outra squad, detalhe do dia respeitando o filtro).
- Dica: não (mesmo motivo da Escala).

### 🗓️ Escala: quem trabalha quando (squad + global + cadastro) — 2026-10-12 · escala-dev v1.0 · kanban-dev v8.30.829-dev · painel-dev v5.48 (SÓ DEV)
Pedido (Black Friday, dor 3 — "escala por squad com foto/menção"): uma página só com **visão da squad** e **visão global**, mais uma **etapa de cadastro** feita pela própria pessoa ou pelo PO/Organizador/ADM.
- **Página nova `escala-dev.html`** (login Google @ciahering, sem build; mesma família do `intake-dev.html`): semana de segunda a domingo, ◀ ▶ Hoje e **🔥 Black Friday** (pula pra semana dela e marca a sexta). Cada dia de cada pessoa é **✅ Escalado**, **🔥 Plantão** ou **🏖️ Folga**, com horário e observação opcionais.
- **👥 Squad:** linhas = pessoas da squad (foto, nome, @iniciais, papel; convidado fica de fora), colunas = dias, linha de **cobertura** (escalados + plantão; ⚠️ 0 em dia útil sem ninguém). Faixa "Hoje" com quem está de plantão.
- **🌐 Todas as squads:** uma linha por squad, as fotos de quem está em cada dia (plantão com aro laranja), "N de folga", e um aviso com os **dias úteis sem ninguém escalado** — só nas squads que já têm escala cadastrada (squad sem nenhum cadastro mostra "sem escala cadastrada", sem ⚠️ em tudo). Clicar no dia lista as pessoas (plantão primeiro) e **📋 copia as menções** (@iniciais de quem trabalha).
- **➕ Cadastrar escala:** squad · pessoa · período (de/até, atalhos Esta semana / Próxima / 🔥 Semana da Black Friday, que já marca os 7 dias) · dias da semana · tipo · horário · observação, com prévia ("5 dias · Ana · de 12/10 a 16/10") e **🗑 Limpar período**. Clicar numa célula edita só aquele dia. **Quem edita o quê:** cada pessoa edita a própria linha (se for da squad); **PO, Organizador e ADM** da squad editam a de todos; ADM edita qualquer squad.
- **Dados:** `kanban/escala/{AAAA-MM-DD}/{squadId}/{uid}` = `{t:'trab'|'plant'|'folga', i?, f?, n?, por, ts}` — a data na frente deixa a leitura de uma semana ser **uma consulta só** (`orderByKey` + `startAt/endAt`) e a limpeza antiga ser simples. **Regras novas em `database.rules.json`** (leitura: qualquer @ciahering; escrita: a própria pessoa na squad dela, ou PO/Organizador da squad, ou ADM; valida tipo, horário HH:MM, observação ≤ 140, `por` = quem gravou, bloqueia campo extra) — **precisa de `firebase deploy --only database` pra gravar/ler de verdade**; sem isso a página avisa "regras do banco ainda não publicadas".
- **Entradas:** botão **🗓️ Escala** na barra do Maré (abre em outra aba na squad atual; também vira ação do 🔗 atalhos configuráveis) e aba **🗓️ Escala ↗** no Painel (abre a visão global). Ajuda do Maré: entrada "Escala (quem trabalha quando)".
- **Cuidados:** leitura da semana com número de chamada (só a última resposta vale — trocar de semana rápido não mistura dados); gravação com trava (clique repetido não grava duas vezes) e mensagem clara se o banco negar; período limitado a 93 dias por cadastro.
- **Testes:** `test_escala.js` (58 checks: login/conta errada, squad, cadastro 1 dia e período, PO por outra pessoa, Organizador de outra squad, ADM, global, buracos, copiar menções, corrida de semanas, permissão negada, regras ausentes, duplo clique, botão no Maré/aba no Painel/Ajuda) + `fakefb.js` ganhou `startAt/endAt`.
- **Dica:** não — o botão fica visível na barra e o lançamento vai por aviso no Mural/WhatsApp; uma dica custaria bump do módulo em 4 páginas.
- **Não feito (fica pra depois se fizer falta):** aviso (🔔) à pessoa quando o PO cadastra a escala dela, escala no calendário do Maré, push.

### 📐 Mural sem corte: coluna mais alta — oceano-dev v1.21 (SÓ DEV)
Relato do usuário (prints): a coluna do Mural cortava o aviso e criava rolagem enquanto sobrava espaço até a linha de baixo. O teto da coluna subiu de `100vh − 290px` pra `max(600px, 100vh − 170px)` — um aviso com capa cabe inteiro; a rolagem interna só entra com muitos avisos.

### 📐 Início do Oceano em duas colunas: produtos à esquerda, Mural à direita — oceano-dev v1.20 (SÓ DEV)
Relato do usuário (com print): o Mural empilhado ficava colado nos produtos e empurrava tudo pra baixo.
- **Desktop (≥ 980 px):** `#inicio-grid` em 2 colunas — produtos (2×2) à esquerda, **Mural à direita**, os dois na primeira tela, sem rolar a página. A coluna do Mural tem altura limitada (`100vh − 290px`) e **rola por dentro** quando há muitos avisos; fixado/urgente continuam em destaque (capa em cima, texto embaixo). Sem aviso nenhum a coluna some e os produtos ocupam a largura toda (`.tem-mural`).
- **Padrão aberto/recolhido acompanha o layout:** sem escolha da pessoa, **aberto no desktop** (não empurra nada) e **recolhido no celular/janela estreita** (empilhado); a escolha dela (`oceano_mural_aberto`) vale mais que o padrão, e girar/redimensionar a janela atualiza o padrão. No estreito continua "mostra 4 + Ver todos"; no desktop mostra todos.
- Teste: `test_mural_oceano.js` (+8 checagens de layout: lado a lado, primeira tela, rolagem interna, escolha lembrada, estreitar/alargar, sem avisos). FAQ atualizado.
- Dica: não.

### 🌊 Login único: a pessoa FICA no Oceano (e vê o Mural) — oceano-dev v1.19 (SÓ DEV; ajuste da v1.15)
Relato direto do usuário: depois do login a pessoa era **devolvida sozinha** ao Maré/Painel e nunca via a página inicial do Oceano — justamente onde fica o Mural.
- **Antes:** Oceano fazia o cadastro e `location.replace(next)` ("Voltando pra onde você estava…"). **Agora:** a pessoa **fica no Oceano** (lobby, Mural, vitrine) e ganha, no topo, um atalho **"↩ Você estava indo para o Maré Digital (no card que você abriu) · [Continuar] ✕"**. Continuar abre a página de origem (squad/card/hash) pelo roteador do Oceano (aba nova ou dentro do host, conforme a preferência); ✕ dispensa. `next` continua só da família (lista fechada); `next` inválido = sem atalho.
- Maré e Painel não mudam: deslogado → Oceano (`?next=`), com as mesmas exceções (Radar, iframe, `?login=local`, recusa na tela, anti-loop). FAQ do Oceano atualizado.
- Teste: `test_login_oceano.js` reescrito pro novo comportamento (fica no Oceano, cadastro no caminho normal, atalho abre/dispensa, `next` inválido sem atalho).
- Dica: não.

### 🐛 /monitorarbugs (11/10): Intake interno, Mural do Oceano e Comunicados — kanban-dev v8.30.828-dev · painel-dev v5.47 · oceano-dev v1.18 · intake-dev (SÓ DEV)
Rodada sobre o código das últimas horas (Intake interno, login único, Mural, composer). 7 achados, todos reproduzidos no Chromium antes de corrigir.
- **Intake — trocar "Pedir para" rápido** (`intake-dev.html`): a resposta atrasada de um squad antigo sobrescrevia o formulário do escolhido (tags do squad errado sob o nome do certo; o pedido ia pro squad novo com os campos do antigo). Cada `entrar()` agora tem número e só a última vale; o envio usa o id do squad carregado. Mesmo vale pro caso "público falhou depois do login".
- **Intake — `?squad=` com `/` ou `..`** virava pedaço de caminho do banco (leitura e escrita). Agora só `[A-Za-z0-9_-]` (senão "link inválido").
- **Vincular a card (Intake)**: o comentário só levava título/demandante/descrição — **prioridade pedida, prazo, submarca, canal, tags e link do pedido interno se perdiam** (só "Criar card" os levava). `_intakeDetalhesLinhas()`.
- **Mural do Oceano — "visto"** contava com a aba em segundo plano ou com um produto aberto por cima do lobby (host); agora só com o Mural aberto **e à vista** (`avMarcaVistos()` tenta de novo até voltar). Código morto `avTexto()` removido.
- **Painel — duplo clique em Publicar Comunicado** gravava 2 avisos (id novo por chamada, sem trava) — e agora seriam 2 cards no Mural de todo mundo. Trava `_ccSalvando` + botão desabilitado.
- **Oceano — cadastro**: se a **leitura** do cadastro falhasse (rede), o Oceano tratava como "não existe" e gravava um cadastro novo por cima (nome, foto e data de criação reescritos). `lerRamo()` agora devolve `undefined` na falha; só `null` (não existe) cria.
- Teste: `docs/arezzo/testes/test_monitorarbugs_1011.js` (13 checagens; todas as de bug falham no código anterior).
- Dica: não — correções.

### 📌 Mural do Oceano recolhível, com selo de novos — oceano-dev v1.17 (SÓ DEV)
- O Mural da página inicial agora **começa recolhido**: o cabeçalho (botão, também por teclado) mostra "📌 Mural · N" e o selo **● N novos** — **vermelho** se entre os novos há um 🚨 Urgente, singular com 1 ("1 novo"). Clicar abre/recolhe e a **escolha fica lembrada** no navegador (`oceano_mural_aberto`).
- **"Visto" só conta com o Mural aberto**: recolhido não marca nada como visto; aberto, o que está à vista (os 4 primeiros, ou todos em "Ver todos") vira visto depois de ~6 s. O selo sobe sozinho quando chega aviso novo, sem abrir o Mural.
- FAQ do Oceano atualizado. Teste: `test_mural_oceano.js` (41 checagens, +10 do recolhido/selo) + testes do Oceano e do login re-rodados.
- Dica: não.

### 📌 Mural de avisos na página inicial do Oceano — oceano-dev v1.16 · painel-dev v5.46 · kanban-dev v8.30.827-dev (SÓ DEV)
Como todo mundo agora passa pelo Oceano, os **Comunicados** do Painel ganharam um destino novo: o **Mural da página inicial** do Oceano.
- **Painel › Pessoas › Comunicados (composer):** novo checkbox **🌊 Mostrar no mural do Oceano** (vem **marcado** em aviso novo; rascunho 🤖 também) e nova opção em "Onde aparece": **🌊 Só no Oceano** (não aparece no Maré: sem popup, sem mural/📢 e **sem notificação**, mesmo 🚨 Urgente). Com o Oceano ligado: **imagem de capa** (https), **botão** (texto + link — https ou página do Maré, ex. `kanban.html?squad=dados`) e **📌 fixar no topo**. Grava `oceano`, `capa`, `botao`, `fixado`, `autor`; as listas mostram "popup + 🌊 Oceano (fixado)" / "🌊 só Oceano". Aviso antigo (sem o campo) abre **desmarcado** — só vai pro Oceano se alguém marcar e salvar.
- **Oceano (início):** seção **📌 Mural** acima dos produtos, só aparece se há aviso pra você. Cards de vidro com faixa e selo coloridos por tipo (🎉 Novidade · ⚠️ Aviso · 💡 Dica · 🚨 Urgente), data relativa, autor, selo **NOVO** (some depois de uns segundos na tela), capa e botão. **Fixados e 🚨 urgentes** ocupam a largura toda; mostra 4 e "Ver todos (N)". Clicar abre o texto completo (capa, data, autor, validade, botão); botão com página da família abre pelo roteador do Oceano. Tempo real (query `ativo=true` filtrada no servidor), celular (390 px, destaque vira coluna), 3 temas.
- **Quem vê o quê:** mesmas regras do Maré — aviso de um squad só pra quem é do squad, "só PO" pra PO/Organizador/ADM; ADM vê tudo; expirado e arquivado nunca. O HTML do aviso é **sanitizado de novo** no Oceano (lista curta de tags, sem atributos, link só http/https/mailto).
- **Maré:** aviso "só no Oceano" não entra no mural/badge 📢 (nem no popup). Ajuda do Maré e FAQ do Oceano atualizados.
- Testes: `test_mural_oceano.js` (31 checagens) + bateria completa re-rodada. **Nenhuma mudança em regras/functions** (as regras de `comunicados` já deixam qualquer Hering ler, só quem é Hering escrever).
- Dica: não — o mural é a própria tela inicial.

### 🌊 Login único pelo Oceano — kanban-dev v8.30.826-dev · painel-dev v5.45 · oceano-dev v1.15 (SÓ DEV)
Quem **não está logado** no Maré ou no Painel agora é mandado pro **Oceano**, faz login e cadastro lá e **volta sozinho** pra mesma página (inclusive `?squad=…&card=…`).
- **Maré e Painel (deslogado):** `_irParaOceano()` → `oceano(-dev).html?next=<página + query + hash>`. Interruptor `window.MARE_LOGIN_PELO_OCEANO` (false = volta a tela de login própria, ao lado do `MARE_SO_HERING`).
- **Oceano:** com `?next=`, depois do login faz o cadastro básico (`kanban/usuarios/{uid}`, sem sobrescrever) e volta — tela "Voltando pra onde você estava…" em vez de piscar o lobby. `next` só aceita `kanban|painel|okr` (+`-dev`) do próprio domínio (lista fechada; `https://…`, `//…`, `javascript:` e `../` são ignorados).
- **Não redireciona:** **Radar** (visualizador externo segue entrando direto); página **dentro do host do Oceano** (iframe); `?login=local` (convidado externo/visualizador — vale pela aba, via `sessionStorage`); recusa/aviso já escrito na tela de login (ou guardado em `login_notice`); e **anti-loop** (se já mandou há menos de 45 s e voltou deslogado, mostra o login próprio).
- **Convidado externo:** a tela de login do Oceano ganhou "Convidado externo? Entre direto: Maré · Painel · Radar" (links `?login=local`); a mensagem de recusa de conta não-Hering aponta pra eles.
- Ajuda do Oceano: FAQ "Abri o Maré e fui parar no Oceano. Por quê?". Testes: `test_login_oceano.js` (25 checagens; `fakefb.js` ganhou `opts.oceano` — por padrão os testes ficam com o redirecionamento desligado); toda a bateria de `docs/arezzo/testes/` re-rodada.
- **Pendente de teste manual (não dá pra automatizar aqui):** o app instalado (PWA) no iPhone/desktop indo e voltando pelo Oceano sem abrir o navegador por fora.
- Dica: não — é o fluxo de entrada.

### 📥 Intake interno: mesmo link, dois modos — kanban-dev v8.30.825-dev · `intake-dev.html` (novo, SÓ DEV)
Pedir algo a um squad ficou mais rápido pra quem é da Hering, sem mexer no formulário público.
- **`intake-dev.html`** (cópia de dev da `intake.html`; a prod só muda na promoção): **sem login** continua o formulário de sempre, via Cloud Function (honeypot + limite por IP/squad). Com **login Google @ciahering** (botão "🔐 Entrar com Google", ou quem já está logado no Maré) vira um formulário de toques: nome/contato/foto vêm do login; **prioridade** em 4 chips (Média já marcada — é uma *sugestão*), **prazo** com atalhos (Hoje/Amanhã/Sexta/+1 semana), **submarca**, **canal de venda**, **tags** e **link**; o time solicitante fica lembrado. Seletor **"Pedir para"** troca o squad de destino. Grava direto em `intake_pending` (as regras já deixam qualquer Hering gravar no squad) e avisa os membros do squad no 🔔 — **nenhum deploy de `functions/`**. Submarca/canal/tags saem das `tags` do próprio squad (nada duplicado na página).
- **Campos escolhidos pelo PO** — ⚙ Config → Ágil → "🏢 Pedido interno — campos do formulário": Mostrar/Obrigatório por campo (Prioridade, Prazo, Submarca/Canal só se o squad usa, Tags com seletor de quais oferecer, Link), em `agil_cfg.intakeCampos`. Só grava o que difere do padrão (Submarca/Canal seguem o que já é obrigatório no card; ligar depois reflete sozinho).
- **Caixa de entrada** (📥 Intake): item de pedido interno ganha 🏢 e chips (prioridade, canal, tags, link — só `http(s)`); **✅ Criar card** pré-seleciona a prioridade sugerida (e registra "Prioridade pedida" na descrição) e leva os links; tags/submarca/canal/prazo já eram aplicados. "🔗 Copiar link" aponta pra `intake-dev.html` no dev.
- Achado pelo teste: ao escolher um squad com intake desligado, o seletor sumia junto com o aviso e a pessoa ficava presa — cabeçalho e seletor agora ficam sempre visíveis.
- Teste: `docs/arezzo/testes/test_intake_interno.js` (41 checagens, Chromium + Firebase falso; `fakefb.js` ganhou `push`). Ajuda do Maré atualizada.
- Dica: não por enquanto — o recurso vive no link do Intake e na Config; vale uma dica quando o atalho "Fazer um pedido" entrar no Oceano (Fase 2).

### 🎨 Favicons do Painel e do A Bordo: arte maior e centralizada — 2026-10-10 · painel-dev v5.44 · kanban-dev v8.30.824-dev · okr-dev v2.69 · oceano-dev v1.14 · mare-notif-dev v22 (SÓ DEV; `onboarding.html` já em prod)
- O usuário reenviou as duas artes com o desenho maior e centralizado (2000 px). `favicon-painel-v2.png`, `favicon-painel-v2-dev.png` (com o selo "DEV") e `favicon-bordo-v2.png` foram refeitos (512 px, paleta, ~70 KB) — legíveis até em 16 px. Como o nome dos arquivos não mudou, as referências ganharam `?v=3` (aba do painel-dev, menu de produtos, tile do Oceano e `onboarding.html`) pra o navegador não reaproveitar a imagem antiga em cache.
- Dica: não — troca de ícone.

### 🎨 A Bordo: favicon nova (o convés) na aba da página e no menu de produtos — 2026-10-10 · painel-dev v5.43 · kanban-dev v8.30.823-dev · okr-dev v2.68 · oceano-dev v1.13 · mare-notif-dev v21 (SÓ DEV)
- Arte nova do A Bordo enviada pelo usuário: `favicon-bordo-v2.png` (512 px, paleta, 45 KB). **`onboarding.html`** (página avulsa, sem versão nem cópia dev) ganhou `<link rel="icon">`/apple-touch-icon — antes não tinha favicon nenhum, então a aba nova já vale em produção. **Menu de produtos ⋮⋮⋮** (`mare-notif-dev.js`) e **tile do Oceano** (`oceano-dev.html`): o A Bordo deixa de ser o glifo laranja provisório e mostra a logo nova (em prod só na promoção do módulo/Oceano).
- Dica: não — é troca de ícone.

### 🎨 Painel: favicon nova (a ponte de comando) na aba e no menu de produtos — 2026-10-10 · painel-dev v5.42 · kanban-dev v8.30.822-dev · okr-dev v2.67 · oceano-dev v1.12 · mare-notif-dev v20 (SÓ DEV)
- Arte nova do Painel enviada pelo usuário (volante e painéis diante do mar, peixinho e radar). Arquivos novos na raiz: `favicon-painel-v2.png` (512 px, paleta — 50 KB; aba de prod no futuro + menu de produtos) e `favicon-painel-v2-dev.png` (a mesma com selo laranja "DEV", pra aba do painel-dev se distinguir). Os antigos (`favicon-painel.png`/`-dev.png`, os peixinhos de colete) ficam intocados até a promoção — `painel.html` de prod ainda os usa.
- **painel-dev:** a aba usa `favicon-painel-v2-dev.png`. **Menu de produtos ⋮⋮⋮** (`mare-notif-dev.js`) e **tile do Oceano** (`oceano-dev.html`): o Painel deixa de ser o glifo roxo provisório e passa a mostrar a logo nova (`img:'favicon-painel-v2.png'`). Em prod só muda na promoção (painel.html troca o link; mare-notif.js/oceano.html recebem o módulo).
- Dica: não — é troca de ícone.

### 📘 Radar: Ajuda "Link direto do Objetivo" não cita mais a Arezzo no modo só Hering — 2026-10-10 · okr-dev v2.66 (SÓ DEV)
- A entrada da Ajuda dizia que quem recebe o link precisa de login "@ciahering, @arezzo ou visualizador autorizado" — no modo só Hering o login Arezzo não existe. O trecho `@arezzo` passou a usar a classe `ms-login` (que o modo só Hering esconde). Achado ao gerar a base de conhecimento do Agente Ágil a partir da Ajuda.

### 🐛 Notificações — /monitorarbugs (2ª rodada): 3 achados + 1 regressão do fix anterior — 2026-10-10 · painel-dev v5.40 · kanban-dev v8.30.820-dev · okr-dev v2.64 · oceano-dev v1.10 · mare-notif-dev v19 · `functions/` (SÓ DEV)
Pedido: "como notificação é sensível, roda outro". Tudo reproduzido (testes vermelhos) antes de corrigir.
- **Regressão do fix da rodada anterior (minha).** Pôr `sinoLigado()` dentro de `viva()` fez Painel, Radar e Oceano **descartarem da lista pessoal** a notificação cujo snapshot chegava antes da config (`viva()` era chamada na montagem da lista, não no desenho) — selo vazio até o próximo snapshot — e, pelo mesmo motivo, **religar um tipo ao vivo não trazia a notificação de volta**. Agora `viva()` é só o prazo (TTL) e o filtro do interruptor fica no desenho (onde as 4 páginas já filtravam). Junto: `novas()` só inicia a janela "fria" de 3 s depois da config (senão a lista que já existia chegava "nova" e tocava o ding quando a config demorava >3 s).
- **Push de tipo sem card substituía o anterior (`functions/common/pushUrl.js`).** A `tag` do push era `tipo_cardId`; sem card (reunião, feedback, intake, comunicado do Painel, Estrela do Mar) todos os avisos do tipo tinham a **mesma tag** e o 2º push apagava o 1º no aparelho sem ninguém ter visto (ex.: 2 reuniões na mesma hora, 2 feedbacks seguidos). Só o OKR já usava o id da notificação; agora vale pra todo tipo sem card. **Exige** `firebase deploy --only functions:sendPushOnNotification` (resincronizar o clone antes).
- **Comunicado urgente por ADM só-por-e-mail (`painel-dev`).** As regras novas só deixam gravar `painel_broadcast` em caixa alheia a quem tem papel `po`/`adm` no banco; o fan-out do `_painelNotifyBroadcast()` engolia cada negação (`.catch(()=>{})`) e o toast dizia só "✅ publicado" — ninguém era avisado e o ADM não sabia. Agora conta as falhas e avisa ("N de M avisos não foram entregues… só quem tem papel PO/ADM envia"). Também respeita a Central: com `painel_broadcast` desligado no sino **e** no push, nem grava.
- **Observações (não corrigidas):** Meu Dia ainda lista menções não lidas com o sino de `mention` desligado; `addKudosPainel()` (Painel) regrava o array `kudos_geral` inteiro a partir do cache local — mesma classe do PR #896 (Kudos do board, que já usa transação).
- **Testes:** `test_monitorarbugs_1010c.js` (9 checks; Oceano com config a 3,8 s, religar ao vivo, comunicado sem papel, tipo desligado) + `pushUrl.test.js` (functions 740/740) + `test_monitorarbugs_1010b`, `test_notificacoes` (ajustado: `viva()` não depende mais do interruptor), `test_oceano_sino`, `test_calendario`, `test_links`, `test_okr_dashboard`, `test_so_hering_kanban_painel`, `test_menu_kanban` verdes.
- **Dica:** não — correção de bug.

### 🐛 Central de Notificações — /monitorarbugs: 2 achados corrigidos — 2026-10-10 · painel-dev v5.39 · kanban-dev v8.30.819-dev · okr-dev v2.63 · oceano-dev v1.9 · mare-notif-dev v18 (SÓ DEV)
Rodada de `/monitorarbugs` na Central de Notificações (código do PR #1344, sem rodada própria até aqui). Os dois achados foram **reproduzidos no Chromium antes de corrigir**.
- **Ding de um tipo que o ADM desligou.** O sino ficava com "tudo ligado" até a config (`kanban/notif_config`) chegar do banco; se ela chegava **depois** das notificações pessoais (rede lenta), o sino montava a lista com o tipo desligado, tocava o *ding* e só então a config escondia o item e o selo — o som já tinha saído. Cenário: `mention` com sino desligado + 1 menção não lida + config atrasada 1,5 s → 1 ding (controle com config imediata: 0). Fix (`mare-notif-dev.js`): `sinoLigado()` só responde "ligado" depois que a config chegou (`cfgPronto()`; erro de leitura também conta como pronta) — vale pros 4 sinos (Maré, Painel, Radar, Oceano). Criar notificação continua sem esperar (na dúvida, grava).
- **ADM só pelo e-mail via interruptores "vivos" que o banco nega.** `_isAdmPainel()` é a lista de e-mails (`ADM_EMAILS`), mas as regras de `notif_config` exigem **papel `po`/`adm` em `kanban/usuarios/{uid}/role`** (ou o e-mail do Caio). Quem é ADM só pelo e-mail (papel `membro` no banco — é o que o cadastro grava, ver /monitorarbugs de 2026-10-05) via os interruptores ativos, clicava e recebia "As regras novas já foram publicadas?" — enganoso. Agora, com papel conhecido e sem PO/ADM, os interruptores e o "Restaurar tudo" ficam **só pra leitura** com um aviso (`#nc-sem-permissao`) explicando o que fazer; o 🔄 Atualizar relê o papel. Se o banco negar mesmo assim, a mensagem separa os dois casos (papel sem PO/ADM × regras ainda não publicadas → `firebase deploy --only database`).
- **Observação (não corrigida, decisão de produto):** o Meu Dia (kanban) continua listando "Menções não lidas" mesmo com o sino de `mention` desligado — o interruptor esconde do **sino**, não apaga nada.
- **Testes:** `test_monitorarbugs_1010b.js` (16 checks; sem o fix o primeiro `MareNotif.cfgPronto()` já quebra) + `test_notificacoes.js`, `test_oceano_sino.js`, `test_calendario.js`, `test_links.js`, `test_monitorarbugs_1009.js`, `test_menu_kanban.js`, `test_so_hering_kanban_painel.js` verdes. `fakefb.js` ganhou `window.__onValueDelay(path)` (1ª entrega do listener atrasada, pra simular rede lenta).
- **Dica:** não — correção de bug.

### 🔔 Central de Notificações no Painel — catálogo, interruptores sino/push e Não Perturbe — 2026-10-10 · painel-dev v5.38 · kanban-dev v8.30.818-dev · okr-dev v2.62 · oceano-dev v1.8 · mare-notif-dev v17 · `functions/` + `database.rules.json` (SÓ DEV; função e regras exigem deploy)
Pedido: "um sistema de notificações no painel, onde eu enxergue todas as notificações, como funcionam, os gatilhos, que eu possa ligar e desligar, saber quem tá com Não Perturbe… um sistema de gerenciamento mesmo". Decisões (confirmadas): interruptor **por tipo, pra todo mundo, com Sino e Push separados**; tela com **catálogo + uso dos últimos 7 dias**; Não Perturbe **só leitura**.
- **Nova aba 🔔 Notificações** (`painel-dev`): resumo (sino ligado x/29, push ligado, 🔕 em Não Perturbe agora, pessoas com push); os **29 tipos** agrupados em 6 áreas (Cards do board, Prazos, Pessoas, Radar, Calendário, Painel/sistema) — cada um com ícone, nome, id, **quando dispara, quem recebe, onde nasce** (clique abre), uso dos 7 dias (quantas, em quantas pessoas, não lidas) e dois interruptores **🔔 sino** e **📲 push**; busca e filtros (sino desligado · com push · sem push · alterados); "✏️ alterado por X em D" + "↺ voltar ao padrão" por tipo e "Restaurar tudo". **Pessoas**: quem está em Não Perturbe (até quando, rótulo, ou sem hora de fim — vencido não conta), aparelhos de push e notificações na caixa; filtros. Não-ADM vê tudo, interruptores desabilitados; visualizador externo não vê a aba.
- **Como o interruptor vale:** `kanban/notif_config/{tipo}` = `{sino?, push?, por, em}` (ausente = padrão). **Sino desligado** → os 4 sinos (Maré, Painel, Radar, Oceano) e os selos escondem o tipo, ao vivo (nada é apagado); com sino **e** push desligados `createNotif()` nem grava. **Push** → `sendPushOnNotification` e `sendPushOnMural` leem a config (`functions/common/notifConfig.js`): `false` bloqueia mesmo tipo do `PUSH_TYPES`, `true` libera mesmo tipo de fora (ex.: ligar push de "Card concluído").
- **Segurança:** nó novo `notif_config` nas duas edições das regras — empresa e visualizador **leem**, só PO/ADM (e o Caio) **gravam**. 2 casos novos no simulador de regras.
- **Testes:** `test_notificacoes.js` (33 checks: PUSH_PADRAO = PUSH_TYPES; todo tipo de `createNotif()` está no catálogo; interruptores gravam; sino do Painel/Maré; Não Perturbe; permissões; falha de gravação) + `functions/` 740/740 (novos: `notifConfig.test.js`, 2 do `pushMural`). **Dica: não** (ferramenta de ADM; Painel não mostra dicas). Ajuda do Maré (Notificações) ganhou um parágrafo.
- ⚠️ **Deploy manual** (resincronizar o clone antes): `firebase deploy --only database` (regras) e `firebase deploy --only functions:sendPushOnNotification,functions:sendPushOnMural`. Sem as regras, ligar/desligar mostra erro de permissão; sem a função, o push segue pelo padrão (o sino já funciona sozinho).

### 🐛 Menu de capa (🎨) do card ficava aberto pra sempre — 2026-10-10 · kanban-dev v8.30.817-dev (SÓ DEV)
- **Relato:** "no modal do card, quando clica no símbolo pra botar capa, se não clicar de novo pra fechar ele não fecha mais — mesmo saindo do card e voltando".
- **Causa (reproduzida no Chromium antes de corrigir):** `toggleCoverMenu()` registrava o ouvinte de "clique fora fecha" com `{once:true}`; o **primeiro clique DENTRO do menu** (campo da URL, texto, área vazia) gastava o ouvinte (que só ignorava o clique) e a partir dali o menu nunca mais fechava por clique fora. E como o menu mora no cabeçalho do modal, que é reaproveitado, ele continuava aberto ao fechar e reabrir o card (ou abrir outro).
- **Correção:** ouvinte persistente enquanto o menu está aberto (removido em `_closeCoverMenu()`), e o menu fecha também ao **abrir um card (novo ou existente)** e ao **fechar o modal**. O botão 🎨 continua alternando.
- Teste novo `docs/arezzo/testes/test_capa_menu.js` (9 checks; falha no código anterior). **Dica: não** (correção).

### 📚 Documentação em dia: Ajuda do Maré (v8.30.816-dev) e do Radar (v2.61-dev), guia do Radar (38 slides), maredigital.html e CODE_MAP — 2026-10-10 · SÓ DEV (guia/maredigital/CODE_MAP valem na hora)
Rodada de `/atualizarhelpcontent` + `/atualizarcodemap` + `maredigital.html` + `guia-okr.html` (pedido: "todos"). Só texto/documentação — nenhum comportamento muda.
- **Central de Ajuda do Maré (`HELP_CONTENT`, kanban-dev v8.30.816-dev):** 2 entradas novas — **💡 Dicas (mini popups)** (como funcionam, o interruptor no topo da Ajuda e o "Rever dicas") e **📊 Central de Dados (aba lateral)** (dia mais recente + 14 anteriores; o board só baixa os últimos 15 dias) (conferido: "Sua torre" já se esconde sozinha da Ajuda no modo "só Hering" e a entrada do menu de produtos com as 3 abas já estava em dia).
- **Ajuda do Radar (okr-dev v2.61-dev):** **🎙️ Apresentar ao vivo** (apresentador, "Acompanhando ✓", laser L, caneta fixa P/temporária T, desfazer Z, passar/pedir/assumir o controle) em "Apresentação em slides"; **⋮⋮⋮ Menu de produtos** (Produtos/Hering/Meus links) e **💡 Dicas** no "cabeçalho"; palavras-chave de busca atualizadas.
- **`guia-okr.html` (agora 38 slides):** novo **🎙️ Apresentar ao vivo: laser, caneta e controle** e **⋮⋮⋮ Menu de produtos e 💡 Dicas** (o slide "Apresentação ao vivo" antigo só falava do carrossel).
- **`maredigital.html`:** versões (Maré v8.30.815/816-dev, Painel v5.37, Radar v2.60/2.61-dev, Oceano v1.7); novos módulos `mare-notif` e `mare-dicas` na tabela de arquivos; cartão da **Família Oceano**; **Painel**: aba Fluxo e Comparação reescritas (entregas por dia, onde está o trabalho, parado há mais tempo, uma coluna por squad), cartão Online, filtros, ⚙ Links/💡 Dicas; **Maré**: Dicas e Central de Dados (15 dias); **Radar**: Apresentação ao vivo; menu de produtos com as 3 abas.
- **`CODE_MAP.md`:** ~420 âncoras revalidadas por script contra as declarações reais (a maioria andou +1000 a +4600 linhas; as do OKR agora apontam pro `okr-dev.html`), `functions/index.js` com os exports atuais, `okr_mencao` no `PUSH_TYPES`, seção nova da **Central de Dados** e dos helpers do Fluxo. O script ficou em `.claude/skills/atualizarcodemap/revalidar_ancoras.py` pra próxima rodada.
- **Dica: não** (documentação). Ao promover o kanban-dev/okr-dev, as Ajudas novas seguem junto.

### 🚀 Promoção pra prod: Painel Fluxo/Visão redesenhados + Central de Dados mais leve (Maré v8.30.815 · Painel v5.37) — 2026-10-10 · sem avisos
Promove o lote validado em dev: **kanban** v8.30.814 → v8.30.815 (Central de Dados do board só baixa os últimos 15 dias de `dados_diarios`, menos bytes a cada abertura) e **painel** v5.35 → v5.37 (rodada de UI/UX nas abas Visão e Fluxo: entregas por dia empilhadas por squad, "Onde está o trabalho agora" por squad com WIP/limite, "Cards andando há mais tempo" com marca de limite, Online em um cartão só, filtros lado a lado, comparação com uma coluna por squad, filtro de squad gerado a partir dos squads existentes; + 4 correções da rodada de bugs — KPI = gráfico, WIP igual nas duas abas, Cycle Time destacado, cor do squad só `#hex`). Métrica que mudou de propósito: "Item mais velho" virou "Parado há mais tempo" e só conta cards em andamento/bloqueados (fila não envelhece). Merge 3 vias (só a linha de versão divergia). Detalhes nas entradas de dev abaixo. Checks: `node --check` limpo, balanço de chaves/parênteses igual ao prod anterior, `test_painel_fluxo.js` (32) com `PAGE=painel.html` e `test_dados_diarios.js` com `K=kanban` passando. PRs #1338 (dados), #1339/#1340 (painel).

### ⚡ Otimização de rotina: Central de Dados só baixa os últimos 15 dias — 2026-10-10 · kanban-dev v8.30.815-dev (SÓ DEV)
- **Achado (Passo 4.1, leitura do Firebase):** a Central de Dados do board (`renderDadosPainel`) mostra só o dia mais recente + 14 anteriores, mas o listener de `kanban/dados_diarios` baixava e mantinha ao vivo o nó **inteiro** — 1 entrada por dia desde que a feature nasceu, só cresce — em toda sessão do kanban (e a cada reload forçado por promoção). Agora `query(orderByKey(), limitToLast(15))`: as chaves são datas (`YYYY-MM-DD`), então ordem de chave é ordem cronológica. A tela mostra exatamente o mesmo.
- Sem mudança de regra/índice (`orderByKey` não precisa de `.indexOn`). Sem os helpers `window._orderByKey/_limitToLast` cai no comportamento antigo (nó inteiro).
- Teste novo `test_dados_diarios.js` (o listener pede `orderByKey`+`limitToLast(15)`; a Central mostra 15 datas com 40 dias no banco; falha no código anterior). `fakefb.js` exporta `orderByKey` e registra `orderByKey`/`limitToLast` em `window.__qlog`.
- **Baseline desta rodada:** `kanban-dev.html` 2.467.147 bytes (38.651 linhas), CSS ~224 KB, script principal ~1,87 MB, 19/17 timers (o novo é o refresh horário do perfil do Google, vida inteira da sessão e com guarda de aba escondida), 44 `backdrop-filter`, zero `data:image` embutido; `mare-dicas.js` 21 KB e `mare-notif.js` 48 KB (externos, cacheados).
- **Reportado, não implementado:** (1) ícones grandes — `favicon-dev.png` 150 KB, `favicon-painel-dev.png` 123 KB, `favicon-painel.png` 94 KB, `favicon-vice.png` 96 KB (512 px RGB); quantizar para paleta cairia ~70%, mas é lossy e precisa de aval visual; (2) `kudos`/`kudos_geral` (já anotado em 2026-09-22) e a Central de Dados do **Painel** (`painel-dev` lê `dados_diarios_dev` inteiro na aba de gestão — lá a tela de edição usa o histórico completo, então não dá pra limitar sem mudar a tela).

### 🐛 Painel Fluxo/Visão — rodada de /monitorarbugs no redesenho: 4 achados — 2026-10-10 · painel-dev v5.37 (SÓ DEV)
Código escrito horas antes (v5.36), sem rodada própria. Todos reproduzidos no Chromium antes de corrigir (5 verificações novas falham no código anterior).
- **KPI × gráfico:** o Throughput contava a janela como "agora − N×24h", mas o gráfico "Entregas por dia" desenha N dias de **calendário** (da meia-noite). Entrega das primeiras horas do dia N+1 entrava no KPI e em nenhuma coluna (6 × 5). A janela passou a ser N dias de calendário nos dois (e cada dia do gráfico é montado com `setDate`, não `−i×24h`, que pula/duplica dia em mudança de horário de verão).
- **WIP em dois números:** o chip `WIP x/limite` do Fluxo somava em andamento + bloqueado (5/3) enquanto o card do squad na Visão conta a coluna Em Progresso (4/3). Agora é a mesma conta nos dois.
- **Comparação — Cycle Time nunca destacava ninguém:** o valor chega como texto ("3.0"), e só número competia. Valor numérico em texto agora também compete (menor vence).
- **Cor do squad (vem de `squads_meta`)** entrava crua em `style`/`fill` nos gráficos novos; agora só passa `#hex` (`_sqCor()`).
- Checado e sem achado: troca de janela 7/14/30, filtro por squad/gerência, estados vazios, tema claro/escuro (tokens), 390 px, escape de título/coluna/squad, `renderTrend()`/`renderColDist()` nulo-seguras. Teste: `test_painel_fluxo.js` (32 checks).

### 🎨 Painel: rodada de UI/UX nas abas Visão e Fluxo — 2026-10-10 · painel-dev v5.36 (SÓ DEV)
Pedido direto: "na página Visão e na página Fluxo, faz uma rodada de UI/UX! tá muito confuso e é tudo a mesma cor, esse fluxo". Auditoria feita renderizando as duas abas com dados realistas (3 squads) em 1280 e 390 px, aplicando as regras de dataviz (uma cor = um significado, sem repetir a mesma informação, rótulos diretos).
- **Fluxo — o que estava confuso:** as barras de "Distribuição WIP" e "Distribuição por coluna" usavam a cor de cada *coluna* (azul/verde/vermelho/verde repetidos entre squads, e as colunas de todos os squads eram somadas por nome numa lista só); a mesma distribuição aparecia 3 vezes (Visão, WIP, por coluna); "Throughput semanal" em 14 dias mostrava só 2 barras gigantes; "Tendência" fixava só 2 squads (o 3º nunca aparecia) e rotulava como throughput o *estoque* de concluídos; "Item mais velho" contava cards parados no Backlog (40 dias de fila viravam alerta).
- **Fluxo — agora:** (1) **Entregas por dia** (colunas empilhadas por squad, cor = identidade do squad, 7/14/30 dias batendo com o KPI de Throughput, hoje destacado, rótulo de valor seletivo, dica ao passar o mouse); (2) **Onde está o trabalho agora**: uma barra por squad — cor cheia = em andamento, clara = na fila (colunas antes de "Em Progresso"), vermelho = bloqueado, e `WIP x/limite` (vermelho quando passa); (3) **Cards andando há mais tempo**: bolinha do squad, marca tracejada no limite (P85 do cycle time ou 2× a mediana), só 2 níveis (neutro / vermelho), 🚧 nos bloqueados. KPIs com unidade (`d`, `/sem`) e tamanho da amostra; só o "Parado há mais tempo" muda de cor (vermelho acima do limite). Saíram da aba as seções "Tendência" e "Distribuição por coluna" (as barras por coluna já estão em "Squads em tempo real", na Visão).
- **Mudança de métrica (de propósito):** "Item mais velho" → **"Parado há mais tempo"** e a linha da Comparação passam a contar só cards **em andamento ou bloqueados** (fila não envelhece) — o número cai em quem tem Backlog antigo.
- **Visão:** as 3 listas "Online" (Maré/Painel/Radar) viraram **um cartão** com 3 linhas; filtros de gerência e squad ficaram lado a lado, com rótulo; **Comparação entre squads** desenha **uma coluna por squad** (a 3ª nunca aparecia: só 2 células por linha) com cabeçalho vindo de `SQUADS`, e destaca o melhor valor entre todos (empate no topo = ninguém); risco do card aceita texto ou objeto (sem `[object Object]`).
- **Bug achado de passagem:** `renderFilterBar()` escrevia no *primeiro* `.filter-bar` da página (= `#gerencia-bar`, que era re-escrita logo depois), então o filtro de squad **nunca** era gerado a partir de `SQUADS` — squads criados depois ficavam sem botão. Agora usa `#squad-filter-bar`.
- Teste novo `docs/arezzo/testes/test_painel_fluxo.js` (28 checks: Backlog fora do KPI/lista, 1 segmento por dia×squad, cores de squad, WIP/limite, 7/14/30 dias, comparação com N squads, filtros, risco). **Dica: não** — redesenho visual de telas que a pessoa já usa, sem atalho novo pra descobrir. Painel prod continua na v5.35 até validação.

### 🚀 Promoção pra prod: 💡 Dicas (Maré v8.30.814 · Radar v2.60 · Oceano v1.7 · Painel v5.35) — 2026-10-10
- **Mini popups de dicas** nos 3 apps (Maré, Radar, Oceano): uma dica curta por vez, quando a pessoa chega no lugar certo, cada uma uma vez só (50 s entre duas, até 4 por visita). **Entendi · Saiba mais** (abre o tópico certo da Ajuda) **· Não mostrar dicas do app**. Liga/desliga por app e por pessoa (`kanban/usuarios/{uid}/dicas`), com interruptor 💡 e "Rever dicas" na Ajuda do Radar, na Central de Ajuda do Maré e em ⚙ Meu perfil do Oceano. Painel e A Bordo não mostram dicas.
- **Painel → ⚙ Configurações → 💡 Dicas**: lista só leitura das 27 dicas (texto, onde aparece, tópico do "Saiba mais", e o ✅ do que você já viu).
- **Correções da rodada de bugs**: externo (só leitura) não recebe dica de edição; a dica do lobby do Oceano não cobre um produto aberto; o interruptor não perde o foco nem acumula ouvintes; o "Saiba mais" do Maré abre o tópico certo em primeiro (a busca da Central de Ajuda agora põe o título antes do texto — vale pra toda busca); textos do catálogo corrigidos.
- Novo módulo compartilhado `mare-dicas.js` (cópia de `mare-dicas-dev.js`, `?v=3` nas 4 páginas); `mare-notif.js` inalterado (v16). Promoção por merge de 3 vias; o diff de prod × dev é só linhas de ambiente. Regra permanente nova: toda funcionalidade nova avalia se vale uma dica (`CLAUDE.md`, passo 7). PRs #1334, #1335, #1336.

### 🐛 Dicas — rodada de /monitorarbugs: 5 achados corrigidos — 2026-10-09 · okr-dev v2.60 · kanban-dev v8.30.814-dev · oceano-dev v1.7 · painel-dev v5.35 (SÓ DEV)
- **Externo (só leitura) recebia dica que manda editar** ("Atualize os Marcos…", "Converse com o Agente Ágil", "botão direito…"). O catálogo ganhou o marcador `edita` (6 dicas do Radar) e quem acompanha como visualizador só recebe as demais (Apresentação, atalhos do modal, Dashboard).
- **Oceano: a dica de entrada aparecia POR CIMA do produto aberto** dentro do Oceano (app instalado abrindo direto no último produto, ou clique rápido num produto). As 3 dicas de entrada só aparecem com o lobby à vista.
- **Interruptor 💡 Dicas perdia o foco** ao ser alternado (o controle era redesenhado — quem usa o teclado caía no início da página) **e acumulava ouvintes** a cada abertura da Ajuda (26 aberturas = 26 redesenhos por clique). Agora desenha uma vez, só sincroniza o estado, e há 1 ouvinte por elemento (os de elementos que saíram da página são podados).
- **"Saiba mais" do Maré caía numa lista em que a entrada certa não era a primeira** (ex.: "Menções" abria com "Meu Dia" no topo; "Checklist" tinha 23 resultados). A busca da Central de Ajuda agora põe antes quem tem o termo no **título** (ordem estável; vale pra qualquer busca e pros balões "Saiba mais →").
- **Textos do catálogo que prometiam o que não é verdade**: o Ctrl+K busca no board atual (não "de qualquer squad"); "Meus cards" destaca (não filtra); o ⋮⋮⋮ só leva ao Painel pra quem tem acesso a ele.
- Verificado e sem achado: dica por cima dos modais (z-index 9400 > 9000/9100/120/60), regras do banco aceitam `usuarios/{uid}/dicas` (igual a `links`/`apps`), todos os "Saiba mais" do Radar (`hlp-<id>`) e do Oceano (`faq-<id>`) existem, XSS (texto sempre `textContent`; nome do app e catálogo escapados), corrida entre desligar e a leitura remota (janela de ~100 ms depois do login, antes de a 1ª dica poder aparecer — não reproduzível de forma fiel; fica como observação).
- `test_dicas.js` ganhou 12 verificações dessa rodada (6 falham no código anterior). `?v=3` do módulo nas 4 páginas.

### 💡 Dicas: lista de todas as dicas no Painel + catálogo centralizado no módulo — 2026-10-09 · painel-dev v5.34 · okr-dev v2.59 · kanban-dev v8.30.813-dev · oceano-dev v1.6 (SÓ DEV)
- Pedido: "coloca essa lista no painel" (ver todas as dicas) e, daqui pra frente, **avaliar uma dica a cada funcionalidade nova** (agora regra permanente no `CLAUDE.md`, passo 7 do Release process).
- **Painel → ⚙ Configurações → 💡 Dicas** (só leitura): Radar, Maré e Oceano, cada dica com o texto, **onde aparece** ("Ao abrir o Dashboard", "Ao abrir um card"…), o tópico do **Saiba mais** e o ✅/⏳ do que **você** já viu (lê só o próprio nó); mostra "desligadas pra você" quando for o caso.
- Pra isso o **catálogo saiu das páginas e foi pro módulo** `mare-dicas-dev.js` (`CATALOGO`, dados puros): as páginas só passam o que depende da tela (`quando`) e o `abrirAjuda`. `?v=2` do módulo em todas as páginas. Comportamento das dicas inalterado (mesmo teste passando).
- Teste: `test_dicas.js` ganhou o bloco do Painel (3 apps, 27 dicas, ✅ só das vistas, desligadas, tópico da Ajuda).

### 💡 Dicas (mini popups) no Radar, no Maré e no Oceano — 2026-10-09 · okr-dev v2.59 · kanban-dev v8.30.813-dev · oceano-dev v1.6 (SÓ DEV)
- Pedido: mini popups de dicas, que o usuário possa desligar, personalizados por app (Radar, Oceano e Maré; Painel e A Bordo ficam de fora), linguagem simples e curta, com "saiba mais" levando à Ajuda.
- **Módulo novo compartilhado `mare-dicas-dev.js`** (mesmo ciclo do `mare-notif`: `?v=` nas páginas; a versão de prod, `mare-dicas.js`, nasce na promoção). Mostra **uma dica por vez**, no canto inferior esquerdo (acima da barra no celular), **quando a pessoa chega num lugar** (gatilho), **uma vez só** cada, com no mínimo 50 s entre duas e no máximo 4 por visita. Botões: **Entendi**, **Saiba mais** (abre o tópico certo da Ajuda do app) e **Não mostrar dicas do <app>**. Texto sempre como texto puro; não rouba o foco.
- **Liga/desliga por app e por pessoa**: `kanban/usuarios/{uid}/dicas = {off:{radar:true}, vistas:{radar:{id:true}}}` (cada pessoa já escreve o próprio nó — sem mudar regra) + cópia no aparelho (única do visualizador externo). Desligar no Radar não desliga no Maré. O interruptor **💡 Dicas** + **Rever dicas** fica na Ajuda do Radar, na Central de Ajuda do Maré e em ⚙ Meu perfil do Oceano (e uma pergunta nova na Ajuda do Oceano).
- **Catálogos** (cada app o seu, em `OKR_DICAS` / `MARE_DICAS` / `OCEANO_DICAS`): Radar 11 dicas (semáforo automático, atingimento, Agente, menu do botão direito, Apresentação, atalhos do modal, trava, Dashboard x2, Calendário, Cards); Maré 10 (Ctrl+K, Ctrl+D, botão direito no card, Ctrl+Z, Meus cards, ⋮⋮⋮, @menção, colar checklist, card travado, Automações); Oceano 6 (instalar, ⋮⋮⋮, abrir em aba, 🔔, peixinhos, tema).
- Teste novo `docs/arezzo/testes/test_dicas.js` (os 3 apps: aparece sozinha, 1 por vez, intervalo, desligar/religar e gravar, saiba mais, vistas/desligado vindo do Firebase, externo, celular, boot real do Maré).

### 📘 guia-okr.html: prints refeitos + slides novos (Dashboard, Cards, Agente Ágil) — 2026-10-09 (guia compartilhado, sem cópia dev: no ar ao mergear)
- **Prints refeitos** com a página atual do Radar (cabeçalho com 🔗 Cards, menu de produtos, 📢, 🔔, 🌙 e o botão flutuante do Agente): lista de Objetivos, gerências, trava de edição, calendário, reunião, Mural e sino. Os GIFs de fluxo (criar Objetivo/Marco, reordenar, duplicar) e os prints do modal não mudaram.
- **Dashboard**: o slide único virou 3 — número grande + linha, situação/o que mudou/tabela, detalhe de um Objetivo — com print de cada um.
- **Novo slide 🔗 Cards** (aba Cards do Radar) e **slide próprio do 🤖 Agente Ágil** com o painel do chat aberto; o texto que ainda dizia "aba 💬 Agente Ágil" agora fala do botão flutuante. Capa: badges Dashboard/Cards, "~24 min". 33 → 36 slides.
- Gerador dos prints guardado em `docs/arezzo/testes/gerar_prints_guia.js` (Playwright + Firebase fake).

### 🚀 Promoção pra prod: Oceano v1.5 (🔔 sino) + Radar v2.58 (aba 🔗 Cards, Dashboard redesenhado) — 2026-10-09
- **oceano.html v1.5**: sininho 🔔 ao lado de Ajuda, igual ao das outras páginas (mesmo feed, rodapé com som/push/Não Perturbe) — promovido de oceano-dev v1.5 (PR #1329).
- **okr.html v2.58 (Radar)**: nova aba **🔗 Cards** (cards do board com badge 🎯 OKR por squad e o Objetivo vinculado — v2.57, PR #1330) e **Dashboard redesenhado** (número grande + linha no desenho do atingimento, situação clicável, "o que mudou" simples, tabela por pior situação, detalhe do Objetivo mais limpo — v2.58, PR #1331).
- `mare-notif.js` não mudou (continua v16, código idêntico ao dev); `oceano.html` agora o carrega com `?v=16`. Promoção por merge de 3 vias (base = dev da promoção anterior); só diferem do dev as linhas de ambiente. Testes rodados contra os arquivos de prod: test_okr_dashboard, test_okr_cards, test_oceano, test_oceano_sino. Sem avisos desta vez (pedido do usuário).

### 📊 Radar: Dashboard redesenhado — menos números, o gráfico do atingimento em todo lugar, detalhe do Objetivo mais limpo — 2026-10-09 · okr-dev v2.58 (SÓ DEV)
- Pedido: auditoria de UI/UX e de dados no Dashboard ("os gráficos podiam ser do mesmo layout do gráfico de atingimento… quanto mais simples e limpa a visualização, mais fácil ler"). Achados da auditoria: (1) 6 cartões de KPI repetiam o que a tabela já mostra e a média ficava escondida num deles; (2) o gráfico misturava barras de contagem e linha de % **no mesmo eixo** (eixo duplo disfarçado); (3) a tooltip era uma caixa própria diferente da do atingimento; (4) as cores de status apareciam 3 vezes (KPI, barra do gráfico, ponto e barra da tabela) competindo com a cor da série; (5) o "O que mudou" usava emoji colorido + borda lateral; (6) o detalhe do Objetivo tinha gráfico de outro estilo e uma coluna "Atingimento" repetindo a de progresso; (7) a tabela abria em ordem alfabética, escondendo o que pede ação.
- **Agora**: um **número grande** (atingimento médio + variação) com a **linha da evolução no mesmo desenho do gráfico de atingimento** (grade fina, tracejado de 100%, pontos com anel, dica por toque/hover). **Situação dos Objetivos** = uma barra única + lista clicável (clicar filtra a tabela) ao lado das **colunas semana a semana** (um eixo só — contagem). "O que mudou" virou lista simples com ▲/▼ (6 itens + "ver todas"). Tabela com a barra na cor da série (a situação fica só no ponto + nome) e **ordenada por pior situação primeiro**. Abas Atingimento/Marcos e períodos (4/8/12/tudo) numa linha só; o texto do snapshot virou uma linha de apoio.
- **Detalhe do Objetivo** (clique na linha): a curva do Objetivo no mesmo desenho (com dica por ponto), tabela semana a semana sem a coluna redundante (no celular, data curta e sem a coluna Marcos).
- Sem mudar dados: nenhum campo novo no snapshot; o modal "Como cada Objetivo contribui" não foi tocado. Teste novo `docs/arezzo/testes/test_okr_dashboard.js` (1280 e 390 px) + suítes OKR/modal/tags/calendário/links/só-Hering sem regressão.

### 🔗 Radar: nova aba "Cards" — os cards do board com badge 🎯 OKR, por squad, e a que Objetivo cada um está vinculado — 2026-10-09 · okr-dev v2.57 (SÓ DEV)
- Pedido: "não achei os cards vinculados a OKR no Radar". Dentro do Objetivo a seção "🔗 Cards vinculados" já existia (e funciona), mas a **lista geral "🎯 Cards do board com badge OKR"** ficou no Painel (aba Visão) quando o OKR virou página própria. Agora o Radar tem a aba **🔗 Cards** (depois de Anotações).
- **Só baixa ao clicar** (📥 Carregar cards): ler os cards de cada squad é justamente o que o Radar evitava no boot; 1x por sessão, 🔄 Atualizar baixa de novo. Lista por squad (inclusive os de `squads_meta`): título (clique abre o card no board em aba nova), coluna, responsável, prazo, ⏸ pausado. Mesma regra de "badge OKR" de antes (`isOKR`, tag `okr` ou tag do squad marcada OKR, em `tags[]` inteiro; arquivados fora).
- **Vínculo com Objetivos:** cada card mostra os Objetivos que o vinculam (`cardLinks`; chip 🎯 abre o Objetivo) ou "sem vínculo com Objetivo"; Objetivo arquivado não conta. Filtro (todos / vinculados / sem vínculo), busca (card ou Objetivo) e resumo "N cards · N vinculados · N sem vínculo". Visualizador externo não vê a aba.
- Teste novo `docs/arezzo/testes/test_okr_cards.js` (13 checagens, incl. "abrir a aba não baixa nenhum card"). Ajuda do Radar atualizada.

### 🔔 Oceano ganha o sininho (ao lado da Ajuda) — 2026-10-09 · oceano-dev v1.5 (SÓ DEV)
- O botão **🔔** no topo do Oceano, colado ao ❓ Ajuda, é o **mesmo sino** das outras páginas (módulo `mare-notif-dev.js`): notificações pessoais (todos os tipos; só `rascunho` é exclusivo do painel) + avisos da torre, com selo de não lidas, ✓ Marcar tudo como lido, Limpar antigas e o **rodapé de 🔊 som · 🔔 notificações neste aparelho (push) · 🔕 Não Perturbe**.
- **Push:** o Oceano agora pode registrar o aparelho (`fcm_tokens`) — quem usa só o Oceano instalado passa a poder receber push (antes só dava pelo Maré/Painel/Radar). O push em si continua sendo emitido pela Cloud Function `sendPushOnNotification` a partir de `kanban/usuarios/{uid}/notificacoes`; nada novo a implantar no servidor. FCM carregado por `import()` dinâmico: se não carregar, só o push some, o login segue.
- **Clicar numa notificação** abre o card/Objetivo/aviso **dentro do Oceano** (iframe) quando "Como abrir os produtos" é "aqui"/app instalado, ou em aba nova (comportamento das outras páginas). Entrada nova na FAQ da ajuda do Oceano.
- Teste novo `docs/arezzo/testes/test_oceano_sino.js` (desktop e celular, + cenário "abrir aqui"). Promoção pra `oceano.html` e `mare-notif.js` não mudou: aguardando validação.

### kanban v8.30.812 · painel v5.33 · okr v2.56 · oceano v1.4 · mare-notif.js v16 — 2026-10-09 · Promove pra prod: menu de produtos com abas (Produtos · Hering · Meus links), Oceano v1.4, aba 🔗 Links do Painel, correções do /monitorarbugs do dia (#1326)
- **Maré Digital (`kanban.html`) ganha o menu de produtos (⋮⋮⋮)** no cabeçalho — até agora só existia no `kanban-dev`. Abas **Produtos** (Maré, Painel, Radar, A Bordo; o título "🌊 Oceano · início" leva ao lobby), **Hering** (links importantes dos sistemas da empresa) e **Meus links** (atalhos pessoais; quantidade múltipla de 3 vira grade de quadrados, as demais ficam em lista). Entrada nova na Central de Ajuda: "Menu de produtos (⋮⋮⋮) e a página Oceano" (também no `kanban-dev` v8.30.812-dev).
- **Painel (`painel.html`) v5.33:** ⚙ Configurações → **🔗 Links** (só ADM edita; título, endereço https, imagem https opcional, descrição curta, ▲▼ ✎ ✕, até 60). Os links já cadastrados no dev **valem em prod sem migração**: ficam em `kanban/config/links_hering`, nó compartilhado pelos dois ambientes. Correções do dia: duplo clique em Salvar não cria 2 links; editar link removido por outra pessoa não o ressuscita; ▲▼ não cria registro fantasma.
- **Oceano (`oceano.html`) v1.4:** "Meus links" (⚙ Meu perfil), links da Hering e meus na tela inicial; trava contra duplo clique em Salvar link. **Radar (`okr.html`) v2.56** e **`mare-notif.js` v16** (trocar de conta na mesma página não mostra os "Meus links" da pessoa anterior); as 4 páginas de prod carregam `mare-notif.js?v=16`.
- Mural (rascunho `seed_oceano_menu_apps_2026_10_09` em `painel.html`, aparece pro ADM publicar) + WhatsApp + log no card "Melhorias Maré Digital". `okr-apresentacao.slide.html` (compartilhada) já estava no ar desde o #1326.
- Promoção por merge de 3 vias (prod × dev × dev da última promoção); só as linhas de ambiente (título/favicon/versão/`VERSION_KEY`/`mare-notif(-dev).js`) divergiram. Suítes: test_links, test_monitorarbugs_1009, test_so_hering(_kanban_painel), test_oceano — todas verdes contra as páginas de PROD.

### 🐛 /monitorarbugs das entregas de 09/10 — apresentação ao vivo, Oceano, menu de produtos, aba 🔗 Links — 2026-10-09 · okr-apresentacao.slide.html (compartilhada) · mare-notif-dev v16 · oceano-dev v1.4 · painel-dev v5.33 · okr-dev v2.56 · kanban-dev v8.30.811-dev
- **Apresentação ao vivo (compartilhada, vale ao mergear):** (1) `liveInit()` rodava de novo a cada `auth-change` e acumulava ouvintes do mesmo nó (3 logins refirados = 3 ouvintes) — agora é idempotente; (2) **apresentador que recarrega a página** abria na capa enquanto a sala seguia no slide dele, e só voltava ao navegar — agora retoma a posição da sessão **uma vez** (sem puxar de volta a cada sinal da sala); (3) laser: o ponto ficava parado nas telas de quem acompanha quando o apresentador saía da janela (`mouseleave` do `document` nem sempre dispara) — agora também no `<html>` e no `blur`; (4) painel sem ninguém na sala ganhou **📋 Copiar link da apresentação** e a explicação (a conta precisa ser da empresa; outra aba da mesma conta não conta). Decisão registrada: **conta externa (`painel_viewers`) só acompanha** — as regras só deixam `@ciahering` gravar em `kanban/okr`, então ela não entra na lista de "passar o controle" (mantido assim a pedido).
- **Oceano ⚙ Meu perfil → Meus links:** duplo clique em "Salvar link" criava 2 links (id novo por chamada, gravação assíncrona) — trava + botão desabilitado.
- **Painel ⚙ → 🔗 Links:** mesmo duplo clique; **editar** um link que outro ADM já removeu o ressuscitava; **▼/▲** regravava `ordem` de ids que já não existem (registro fantasma ocupando vaga do limite de 60). Agora relê o banco antes de editar/mover.
- **Menu de produtos (`mare-notif-dev.js`):** sair/entrar com outra conta na mesma página mostrava os "Meus links" da pessoa anterior até recarregar — `appsMontar()` zera links e aba quando o uid muda.
- Teste novo `docs/arezzo/testes/test_monitorarbugs_1009.js` (12 checagens; 8 falham no código anterior). Reportado, não corrigido: o ícone de cada link usa o serviço de favicon do Google (o **nome do site interno** é enviado ao Google quando não há imagem própria); caches de links/apps ficam no aparelho depois do logout; a gravação de `kanban/config` (links da Hering) só é restrita a ADM na interface (as regras deixam qualquer `@ciahering` escrever em `kanban/config`).

### 🎙️ Apresentação ao vivo: controles num botão flutuante (também no detalhe), temporária dentro da caneta, e clicar no nome passa o controle — 2026-10-09 · okr-apresentacao.slide.html (compartilhada)
- **Botão flutuante 🎙️/🖍️ (acima do das Anotações)** com um painel: Laser, Caneta, Desfazer, Apagar tudo, **Passar o controle pra…** (lista de quem está na sala, clique no nome) e Encerrar. Fica **por cima do detalhe do Objetivo** (a barra do topo some atrás do modal, por isso os controles não apareciam lá) e **não ocupa espaço na barra**, que agora só mostra o selo "🎙️ Você está apresentando" (ou o botão "Apresentar ao vivo"). Quem acompanha tem o mesmo botão: ↩ Voltar a seguir, ✋ Pedir o controle, 🎙️ Assumir.
- **Caneta com dois tipos dentro dela:** ao ligar a 🖍️ Caneta aparece **Fixa | Temporária · 5 s** (+ as 4 cores). Teclas: **P** liga/desliga a caneta, **T** liga já na temporária.
- **Fix: não dava pra clicar no nome da pessoa pra passar o controle.** A barra era remontada a cada sinal de vida dos participantes (o tempo todo), trocando o botão entre o mouse descer e subir — o clique se perdia (e o menu fechava sozinho). Agora a interface só é remontada quando algo muda de verdade e a lista de pessoas fica **dentro do painel** (sem menu suspenso). Teste: clicar no nome com sinais de vida chegando no meio do clique.
- Testes novos/atualizados (Chromium, 2 páginas): botão por cima do detalhe, laser ligado pelo painel no detalhe, tipo temporária dentro da caneta, clique no nome passa o controle.

### ✨ Apresentação ao vivo: caneta temporária × fixa, desfazer, e os traços continuam no detalhe — 2026-10-09 · okr-apresentacao.slide.html (compartilhada)
- **Dois tipos de caneta (a que o time usa no Meet):** **🖍️ Caneta** (tecla **P**) = **fixa**, o traço fica até você apagar; **✨ Temporária** (tecla **T**) = o traço **some sozinho depois de 5 s** (esmaece no último segundo) pra todo mundo. Cada tela conta o tempo sozinha, então some mesmo que o apresentador saia; o apresentador também limpa o banco. Mesmas 4 cores; os dois tipos convivem.
- **↩ Desfazer** (tecla **Z**) tira só o **último traço fixo**; **🧽** continua apagando tudo.
- **Fix: ao entrar no detalhe do Objetivo os traços sumiam.** Agora os traços do slide **continuam por cima do detalhe**; o que for desenhado dentro do detalhe fica só nele (ao fechar, sobram os do slide).
- Testes novos (falham sem a mudança): T liga a temporária; some do banco e das 2 telas em ~5 s com a fixa ficando; temporária "esquecida" no banco some localmente; ↩ desfaz só o último; traços continuam no detalhe e os do detalhe ficam só nele.

### 🎙️ Apresentação ao vivo: depois de passar o controle, a tela de quem apresentava volta a seguir — 2026-10-09 · okr-apresentacao.slide.html (compartilhada)
- **Cenário:** você compartilha a tela no Meet, passa o controle pra outra pessoa e ela passa slide/risca na página dela — a **sua** página (a compartilhada) precisa refletir isso. Se por algum motivo a sua tela tinha saído da sincronização antes de passar o controle (você mexeu "por conta própria" quando era só acompanhante e depois assumiu), ela ficava parada. **Correção:** ao deixar de ser apresentador, a página volta a seguir o novo apresentador automaticamente. Teste cobre esse caso (falha sem a correção).

### 🖍️ Apresentação ao vivo: caneta ligada não deixava desligar nem limpar (fix) — 2026-10-09 · okr-apresentacao.slide.html (compartilhada)
- **Bug:** com a caneta ligada, a camada que captura o mouse cobria a tela inteira, **inclusive a barra do topo**; clicar em 🖍️ (desligar), 🧽 (limpar) ou nas cores não chegava no botão. **Correção:** a captura da caneta agora começa **abaixo da barra** (`#live-capture`), então os botões seguem clicáveis; a tecla P e o Esc continuam funcionando. Teste novo: com a caneta ligada, clicar (de verdade) em 🖍️ desliga e em 🧽 limpa nos dois lados, e a caneta ainda desenha nos slides.

### 🎙️ Apresentação ao vivo: passador, laser e caneta direto na nossa apresentação — 2026-10-09 · okr-apresentacao.slide.html (compartilhada, vale assim que mergeada; aditivo: nada muda até alguém clicar em "Apresentar ao vivo")
- **Como funciona:** quem clica **🎙️ Apresentar ao vivo** vira o apresentador. O slide (pela chave, então funciona mesmo com filtros diferentes) e o Objetivo aberto no detalhe vão pro Firebase (`kanban/okr/apresentacao_live`). **Quem abrir a página acompanha sozinho** ("Acompanhando ✓"); mexer nos slides por conta própria sai da sincronização e aparece **↩ Voltar a seguir**. Visualizador externo acompanha, mas não apresenta nem pede controle.
- **Passador:** o apresentador tem **🤝 Passar o controle ▾** (lista quem está com a página aberta) e quem acompanha tem **✋ Pedir o controle** (o apresentador vê "Fulano pede o controle" com Passar/Recusar). Se o apresentador ficar **90 s sem sinal**, qualquer pessoa pode **🎙️ Assumir**. **⏹** encerra e apaga a sessão.
- **Ferramentas (quem está com o controle):** **🔴 Laser** (tecla **L**) — um ponto vermelho que todo mundo vê na mesma posição; **🖍️ Caneta** (tecla **P**, 4 cores, Esc sai) — os traços ficam **por slide** e aparecem pra todos; **🧽** limpa tudo. Ao passar o controle, o laser e a caneta passam junto.
- **Pra reunião no Meet:** só o apresentador compartilha a aba; os outros abrem o link e acompanham — e quem receber o controle comanda do próprio navegador. Não depende do Google Slides.
- Sem mudança de regras do banco (qualquer @ciahering escreve em `kanban/okr`; o externo só lê). Teste novo `docs/arezzo/testes/test_apresentacao_live.js` (21 checagens com 2 páginas: acompanhar slide/detalhe, sair e voltar a seguir, laser, caneta por slide, pedir/passar/assumir/encerrar, externo).

### 🔗 Menu de produtos ganha abas: Produtos · Hering · Meus links — 2026-10-09 · mare-notif-dev v15 · painel-dev v5.32 · oceano-dev v1.3 · okr-dev v2.54 · kanban-dev v8.30.809-dev (SÓ DEV)
- **Menu de 9 pontinhos com 3 abas** (só pra quem é da Hering; visualizador externo continua só com produtos): **Produtos** (como antes), **Hering** (links importantes da empresa) e **Meus links** (atalhos da própria pessoa). Cada link tem imagem, título e uma descrição curta; abre em aba nova (`noopener`).
- **Links da Hering — cadastrados no Painel:** nova aba **🔗 Links** em ⚙ Configurações do `painel-dev` (título, descrição, link, imagem, ▲▼ ordem, ✎ editar, ✕ remover; até 60). Fica em `kanban/config/links_hering/{id}`. Quem não é ADM vê a lista sem os botões. *Obs.: como o Mural e a lista de ADMs, a restrição a ADM é da tela; as regras do banco deixam qualquer @ciahering gravar em `kanban/config` (endurecer pede mudança de regras + deploy).*
- **Meus links — nas preferências do Oceano:** ⚙ Meu perfil → **🔗 Meus links** (mesmo formulário, até 30), em `kanban/usuarios/{uid}/links`. Aparecem também na tela inicial do Oceano ("Links da Hering" e "Meus links", com botão ＋ Adicionar), e o menu tem o atalho "Adicionar ou editar" (`oceano.html#meus-links`; dentro do Oceano abre o perfil do lobby).
- **Layout inteligente das abas Hering e Meus links (mare-notif-dev v15, okr-dev v2.55, painel-dev v5.32, kanban-dev v8.30.810-dev):** quantidade **múltipla de 3** (3, 6, 9…) vira **grade de quadrados**, 3 por fila (logo grande, título e descrição em até 2 linhas, como a aba Produtos); qualquer outra quantidade fica em **lista**.
- **Imagem:** endereço direto `https://…` de qualquer site de imagens (.png/.jpg/.svg). Em branco — ou se não carregar — usa o ícone do site e, por fim, a inicial do título. **Segurança:** só `http(s)` pro link e só `https` pra imagem (nada de `javascript:`), texto sempre escapado, `rel="noopener noreferrer"`.
- **Cache compartilhado** em localStorage (`mare_links_hering`, `mare_links_user_{uid}`, 10 min): quem edita atualiza na hora as outras páginas do mesmo navegador.
- Teste novo `docs/arezzo/testes/test_links.js` (21 checagens: Painel salva/recusa `javascript:`/reordena/remove, não-ADM sem edição, abas do menu, imagem quebrada, externo sem abas, Oceano edita e reordena, `#meus-links`, menu dentro do Oceano).

### painel v5.30 — 2026-10-09 · 🌊 Oceano (prod e dev) na listinha de páginas do Painel (painel.html e painel-dev.html)
- A lista que desce ao clicar no "Maré Digital" do cabeçalho do Painel agora tem **Oceano** (e **Oceano · dev**) no topo, antes de Radar, Kanban e Painel. Só a lista mudou. Colocado direto em prod junto com o dev, a pedido (mudança de uma lista, sem lógica).

### okr v2.53 · painel v5.29 · oceano v1.2 — 2026-10-09 · Promove pra prod — 🌊 Oceano (oceano.html) + menu de produtos com o Oceano · SEM avisos (sem Mural/WhatsApp)
- **🌊 Oceano em produção (`oceano.html` v1.2):** a página-lobby da família (ver as entradas de dev abaixo): abre direto nos produtos (teclas 1–9, atalhos por squad e do Radar), abas "Conheça o Oceano" (a venda) e "Por baixo do casco" (técnica + versões), login só Google @ciahering, cadastro e personalização (ambiente, peixinhos, como abrir os produtos), ajuda com busca e **host dos produtos em iframe** quando instalada como app (`oceano.webmanifest`; o aplicativo do Maré Digital não é tocado).
- **Menu de produtos (`mare-notif.js` v13):** o **Oceano é o título do popover** ("🌊 Oceano · início ↗", link pro lobby, só pra quem é da Hering); a grade continua só de produtos (Maré, Painel, Radar, A Bordo). Dentro do Oceano o clique troca a aba em vez de abrir outra janela. `okr.html` v2.53 e `painel.html` v5.29 carregam `mare-notif.js?v=13`. O `kanban.html` de prod não carrega o menu (continua só no `kanban-dev`, v8.30.808-dev).
- Merge de 3 vias (base = dev da promoção anterior): só sobraram as linhas de ambiente. `oceano.html` = `oceano-dev.html` com título, manifesto, chaves de localStorage do Firebase e `VERSION_KEY` próprios. Testes (Chromium): `test_oceano.js` contra `oceano.html` e `oceano-dev.html`; as 4 suítes do Radar contra `okr.html`; suíte só Hering contra `painel.html`.

### 🌊 Oceano: a tela inicial é o dia a dia — produtos primeiro, "venda" em outra aba — 2026-10-09 · oceano-dev v1.2 (SÓ DEV)
- **Abre direto nos produtos:** aba **Meus produtos** com uma saudação curta e uma grade de botões (logo quadrada, nome, uma linha), como o menu de 9 pontinhos mas em tamanho de uso. Um clique abre (aqui dentro ou em aba nova, conforme a preferência). **Teclas 1–9** abrem o produto, **?** abre a ajuda. Marca o **último** que você usou; cada botão tem ↗ (aba nova) e ⓘ (o que é).
- **Atalhos:** um botão por squad seu no Maré (`?squad=`) e as portas do Radar mais usadas (Anotações da reunião, Agente Ágil). Dentro do Oceano abrem na aba do produto.
- **A venda ficou nas outras abas:** **Conheça o Oceano** (por que, quem usa o quê, produtos) e **Por baixo do casco** (técnica e versões). Os links `#conheca`/`#tecnica` funcionam.
- **Menos cara de "gerado":** saíram o título gigante com gradiente, o porthole grande balançando, as fileiras de chips com emoji e os títulos em caixa-alta com emoji. Textos mais curtos e diretos; títulos em Syne pequeno (como o `hd-title` do Maré) e corpo em DM Sans 13–14 px. Cabeçalho mais enxuto (sem a navegação por âncoras — agora são abas, como as do Radar).
- Teste atualizado: 1ª tela são os produtos, atalhos, tecla `1`, aba Conheça/Técnica, deep link.

### 🌊 Oceano: visual volta pro Marine Glass das outras páginas — 2026-10-09 · oceano-dev v1.1 (SÓ DEV)
- **Layout igual ao das outras páginas:** mesmos tokens do Maré/Painel/Radar (`--deep`, `--glass`, `--accent`…), cabeçalho de vidro (título "Oceano" + subtítulo, botões `.btn`, chip do usuário), cards de vidro, botão primário azul, fontes Syne/DM Sans. Saiu a madeira/latão, a corda, as ondas e o gradiente de pôr do sol como padrão.
- **Peixinhos e bolhas são os do Maré Digital:** as mesmas 3 silhuetas (azul/teal/cyan), 8 peixes e 16 bolhas (metade no celular), mesmas animações, e o mesmo comportamento no tema claro. **Sumiram os "pontos dourados"** (eram as bolhas na cor âmbar do tema antigo). Preferência "Como no Maré / Poucos / Desligados" espelha o 🐟 liga/desliga do Maré (`fish_bg_off`).
- **Temas:** 🌙 Abrolhos (padrão) e ☀️ Lençóis Maranhenses usam a **mesma chave `mare_theme`** das outras páginas — escolher aqui vale no Maré, Painel e Radar. 🌅 Entardecer ficou como opcional, só no Oceano.
- Faixa laranja "🧪 OCEANO DEV" como nas outras páginas `-dev`. Vigias (logos redondas) agora com anel de vidro azul em vez de latão.
- Teste atualizado (`test_oceano.js`): tema padrão sem `data-theme`, Lençóis → `light` + `mare_theme`, peixinhos 8/16 com as 3 silhuetas e espelho em `fish_bg_off`.

### 🌊 Oceano — a página-lobby da família (NOVA) — 2026-10-09 · oceano-dev v1.0 · mare-notif-dev v12 · okr-dev/painel-dev/kanban-dev (`?v=12`) (SÓ DEV)
- **Página nova `oceano-dev.html`** (+ `favicon-oceano.png`, `oceano-logo.png`, `oceano-icon-192/512.png`, `oceano-dev.webmanifest`): o lobby/boas-vindas que reúne Maré Digital, Painel, Radar, A Bordo e Travessia (em breve). **Login só Google @ciahering** (outra conta é barrada; visualizador externo do Radar segue usando o `okr.html`).
- **Vibe de salão de cruzeiro:** cabeçalho de madeira com latão, produtos em **vigias** (portholes) de latão, corda separando as seções; 3 ambientes — 🌅 **Entardecer** (padrão), 🌙 **Abrolhos**, ☀️ **Lençóis Maranhenses**. **Peixinhos, bolhas e ondas desligáveis** (desligados/poucos/muitos; começam desligados se o sistema pede menos movimento; pausam com a aba em segundo plano).
- **Conteúdo "de venda interna":** seção *Por que o Oceano* (como costuma ser × com o Oceano, 6 argumentos com a prova de cada um, quem sobe a bordo, contato), *Os produtos* (abas com o que cada um faz) e *Por baixo do casco* (arquitetura, fatos técnicos, **versões no ar lidas do `version.json`**, link pra `maredigital.html` e Guia do Radar). Sem números inventados — só o que o repositório comprova.
- **"Sua cabine":** vitrine por pessoa com a mesma regra do menu de 9 pontinhos (Painel só pra ADM/quem já usa). **Cadastro e personalização:** perfil (apelido, sigla), ambiente, peixinhos/ondas, como abrir os produtos e "ao abrir o app, ir para…"; tudo em `kanban/usuarios/{uid}/oceano` (+ localStorage pra aplicar o tema antes do login). Quem nunca entrou em produto nenhum ganha o cadastro básico (update, nunca set). **Ajuda** com busca (FAQ, inclusive "como instalar").
- **O Oceano como aplicativo (host):** manifesto próprio (`oceano(-dev).webmanifest`, `id` próprio, escopo só da página) — **o aplicativo do Maré Digital não é tocado**. Com o app instalado (ou "Sempre aqui dentro"), os produtos abrem **num iframe dentro do Oceano**, com abas, vários abertos ao mesmo tempo (até 4), "🌊 Lobby", ↻ e ↗; `#/okr`, `#/kanban`… como deep link e o botão Voltar volta pro lobby. No navegador comum, "Abrir" continua abrindo em aba nova.
- **`mare-notif-dev.js` v12:** o menu de 9 pontinhos ganhou **🌊 Oceano** (primeiro item, só pra quem é da Hering) e, **quando a página roda dentro do Oceano** (iframe `oceano-frame`), clicar num produto manda `postMessage` pro lobby trocar de aba em vez de abrir aba nova.
- Teste novo `docs/arezzo/testes/test_oceano.js` (Chromium, 24 checagens: login/Gmail barrado, vitrine por pessoa, temas, peixinhos, cadastro, host em iframe, troca pelo menu do Radar, celular).
- **Ainda não feito (propositalmente):** sino dentro do lobby; `oceano.html` (prod) e a promoção; logos próprias de Painel/A Bordo.

### 📡 Radar: favicon com `?v=2` pra o navegador largar a antiga — 2026-10-09 · okr.html / okr-dev.html / apresentação / guia (só o `<link>`; sem bump de versão pra não forçar reload)
- O arquivo `favicon-radar.png` já era o de fundo azul desde o PR #1309, mas o Chrome guarda favicon por endereço e seguia mostrando a antiga na aba. Os `<link rel="icon">` e `apple-touch-icon` agora apontam pra `favicon-radar.png?v=2`.

### 🎥 Apresentação do Radar: aba sem o 📡 — 2026-10-09 · okr-apresentacao.slide.html (compartilhada, vale assim que mergeada)
- O título da aba era "📡 Radar · Apresentação" e aparecia o emoji do lado do favicon; agora é só "Radar · Apresentação".

### v5.28 · okr v2.52 — 2026-10-09 · Promove pra prod — 📡 Radar (okr.html v2.52) + Painel (painel.html v5.28) · SEM avisos (sem Mural/WhatsApp)
- **Radar (`okr.html` v2.49 → v2.52):** 🏷️ dá pra **apagar tag** e há **⋯ Mais → Gerenciar tags** (v2.50); 📅 **legenda clicável do calendário** (Reunião · Evento · Lembrete · Prazo de Marco, com contagem e liga/desliga por tipo) e **fim dos resquícios de torre/agenda global** no modo só Hering — uma agenda só, a da Digital Hering 🐟 (v2.51); **logo do Radar** (sem fundo) no login, cabeçalho, home e ajuda (v2.52).
- **Painel (`painel.html` v5.22 → v5.28):** nomes **Radar** (aba "Radar ↗", "Online no Radar", visualizadores, ajudas), **menu de produtos do Oceano** (botão estilo "apps do Google": Maré, Radar, Painel, A Bordo — Painel só aparece pra quem usa) e `mare-notif.js?v=11`.
- Feito por **merge de 3 vias** (base = dev da última promoção); só sobraram as linhas de ambiente (título/favicon/banner dev/versão/chave `okr`/`painel`/`mare-notif.js`). `okr.html` roda as 4 suítes do Radar (só Hering, tags, calendário, modal de edição) e o painel prod roda a suíte do modo só Hering — tudo verde.
- **Guia do Radar:** slide do calendário (texto + print) com a legenda e sem agenda global.
- Fica de fora (continua dev): Maré Digital (`kanban-dev` v8.30.807-dev) com o menu de produtos — por isso, em prod, o menu aparece no Radar e no Painel mas não no board.

### 📡 Radar: logo sem fundo no lugar do emoji (login, cabeçalho, home, ajuda) — 2026-10-09 · okr-dev v2.52 (SÓ DEV — produção segue na v2.49)
- Os 📡 do `okr-dev` viram o `radar-logo.png` (classe `.rdr-logo`, acompanha o tamanho da letra): tela de login, cabeçalho da página, título "Radar — escolha uma torre" e o "Começar" da ajuda. Vai pra prod na próxima promoção.

### 📡 Painel: volta o emoji 📡 (desfaz a troca pelo logo) — 2026-10-09 · painel-dev v5.28 (SÓ DEV)
- A v5.27 trocou o 📡 da aba "Radar ↗" e do menu de páginas pelo `radar-logo.png`; no painel o emoji ficou melhor, então a v5.28 desfaz isso (o logo segue na apresentação e no `okr-dev`).

### 📡 Radar: favicon nova (fundo azul) + logo sem fundo na capa da apresentação — 2026-10-09 · arquivos compartilhados (valem em prod e dev assim que mergeados)
- **`favicon-radar.png` trocada** pela versão de fundo azul-marinho cheio (256 px, ~24 KB): aparece na aba de `okr`/`okr-dev`, apresentação, Guia e no card "Radar" do menu de produtos (mesmo arquivo — o navegador pode segurar a antiga no cache da aba por um tempo).
- **`radar-logo.png` (nova, sem fundo, 256 px):** substitui o emoji 📡 na **capa da apresentação** (104 px, com sombra suave) e no logo da barra de cima.
- **Subtítulo da capa:** no modo só Hering vira "Panorama **por gerência** · data" (sem "por torre"); com as torres religadas continua "por torre e gerência".
- Teste novo `docs/arezzo/testes/test_apresentacao_capa.js` (Chromium, 2 modos: imagens carregam, sem emoji na capa, subtítulo certo).

### 📅 Radar: legenda clicável do calendário + fim dos resquícios de torre/agenda global — 2026-10-09 · okr-dev v2.51 (SÓ DEV — produção segue na v2.49)

- **Legenda com chips clicáveis** (fecha o item que estava pendente): **🗓️ Reunião · 📌 Evento · 🔔 Lembrete · ◆ Prazo de Marco**, cada um com a contagem do período que está na tela. Clicar liga/desliga aquele tipo no Mês e na Agenda e no painel do dia (chip fica riscado, `aria-pressed`); "Mostrar todos" volta tudo. É só filtro de tela (nada é apagado, vale só na sessão) e abrir um evento pelo sino/link religa os tipos pra ele aparecer na lista por baixo.
- **Resquícios de torre/Arezzo no calendário (modo só Hering)**, limpos: o seletor "Todas as agendas / Agenda global / Agenda Digital Hering 🐟" e o "+ global" saem (a agenda é uma só); itens e detalhes não dizem mais "Agenda global · todas as torres" nem "🌐"; toda a agenda usa a mesma cor (o tipo vai no ícone); o editor de evento esconde o campo "Agenda" e o evento novo nasce na agenda da Digital (**antes um ADM criava na "global" e PO/Gestor só na da torre — agora PO/Gestor OKR também criam sem passar pelo seletor**); avisos de permissão falam "ADM, PO/Organizador ou 🎯 Gestor OKR" em vez de "organizador da torre"; "gerências (nenhuma marcada = a torre toda)" vira "todas as gerências"; Ajuda do calendário ajustada. Eventos antigos da agenda global continuam existindo (só ADM edita). Arezzo/Microsoft não aparecia no calendário (os convidados já listavam só @ciahering).
- Com o interruptor desligado (3 torres) o calendário volta ao que era, com a legenda por cima.
- Testes em Chromium nos 2 modos (`docs/arezzo/testes/test_calendario.js`). Fica pra promoção: o slide do calendário do Guia (texto + print).

### 🏷️ Radar: dá pra APAGAR tag (e gerenciar todas pelo ⋯ Mais) — 2026-10-09 · okr-dev v2.50 (SÓ DEV — produção segue na v2.49)

Antes dava pra criar e editar tag (só dentro do ⚙ Configurações de um Objetivo), mas não existia como apagar — `_okrTagApagar()` estava no código sem nenhum botão ligado a ela.
- **🗑 Apagar tag** no editor de tag (o 🎨 do ⚙ Configurações): tira a tag do Radar inteiro **e de todo Objetivo que a usa** (inclusive arquivados), com uma linha no histórico de cada um ("removeu a tag … (tag apagada)"), limpa o filtro por tag se era ela e não deixa o Objetivo aberto com "alterações não salvas" à toa. Pede confirmação dizendo em quantos Objetivos está.
- **⋯ Mais → 🏷️ Gerenciar tags** (quem cria Objetivo): lista todas as tags com quantos Objetivos usam cada uma, ✎ editar, 🗑 apagar e **+ Nova tag** (cria sem aplicar em ninguém) — não precisa mais entrar no ⚙ Configurações de um Objetivo.
- **Quem apaga:** tag **em uso** só ADM (mexe em Objetivo de outras pessoas; pros demais o 🗑 fica desabilitado, com explicação); tag **sem uso** qualquer pessoa da empresa (desfaz tag criada por engano). Visualizador não grava.
- Trava contra duplo clique (a gravação é assíncrona) e Esc em camadas (editor por cima do gerenciador fecha primeiro). A Ajuda do Radar ganhou a explicação.
- Testado em Chromium (banco com latência): duplo clique grava 1 vez, tag some de banco/Objetivos/filtro/rascunho, histórico, ADM × PO, Esc, criar sem aplicar. Testes em `docs/arezzo/testes/test_tags.js`.

### v8.30.803 · okr v2.49 — 2026-10-09 · Promove pra prod — 📡 Radar (o OKR vira Radar) + favicon nova + menu de produtos do Oceano (okr.html v2.49, mare-notif.js v11)

Promove o okr-dev v2.49 (entradas "Oceano: o OKR vira Radar", "menu de produtos" e "logo do Maré Digital", mais a favicon nova). **Sem avisos** (pedido do usuário).
- **Radar:** aba do navegador, cabeçalho ("📡 Radar · Oceano"), Ajuda, Mural, Notificações, "Online no Radar" e mensagens falam "Radar"; **favicon nova** (radar com peixinhos, `favicon-radar.png`) na aba e no menu de produtos; `apple-touch-icon` também.
- **Menu de produtos (9 pontinhos)** entra no cabeçalho do Radar: Maré Digital, Painel, Radar e A Bordo, cada um com a sua logo, abrindo em aba nova. O botão "🐟 Painel" do cabeçalho saiu (o Painel agora só aparece no menu pra ADM, visualizador externo e quem já usa o painel — o "já usa" é gravado quando a pessoa abre o painel ou é PO/Organizador no kanban **dev**; em prod isso só passa a valer quando o Maré Digital/Painel forem promovidos, então por enquanto o Painel aparece no menu só pra ADM e visualizador).
- **`mare-notif.js` v11** (módulo compartilhado): ganha o menu de produtos e a logo do Radar. `kanban.html`/`painel.html` seguem carregando `?v=8` e não chamam o menu (inerte pra eles até serem promovidos).
- **Páginas compartilhadas (sem cópia dev) no ar junto:** `guia-okr.html` ("Guia do Radar", 8 prints refeitos com o cabeçalho novo, favicon), `okr-apresentacao.slide.html` ("Radar — OKRs Hering", favicon), `maredigital.html` (versões, Radar, card do menu).
- **Cloud Function (exige deploy):** o prompt do Agente Ágil do OKR passa a chamar o produto de "Radar" (OKR segue sendo a metodologia): `firebase deploy --only functions:okrAgenteChat` (resync do clone antes).
- Smoke em Chromium contra `okr.html` e `okr-dev.html`: favicon, logos carregando, links de produção/dev, módulo certo; suítes do modo só Hering, modal de edição, apresentação (2) e `functions/` (728, 727 passam) seguem verdes.

### 📡 Radar: favicon nova + logo no menu de produtos — 2026-10-09 · okr-dev v2.49 · mare-notif-dev v11 · painel-dev v5.26 · kanban-dev v8.30.807-dev

`favicon-radar.png` (256 px, ~24 KB) vira o ícone da aba do Radar e a logo dele no menu de produtos (no lugar do SVG provisório). Painel e kanban só sobem o `?v=` do módulo pra 11.

### 🎥 Apresentação do OKR/Radar — `/monitorarbugs` antes da reunião — 2026-10-09 · okr-apresentacao.slide.html (compartilhada, vale assim que mergeada)

6 achados reais, reproduzidos no Chromium (modo só Hering e 3 torres) antes de corrigir:
- **Filtro de tag mentia no modo só Hering:** a contagem `(N)` e a lista de tags olhavam Objetivos de Comercial/Corporativa (escondidos) — aparecia "Só Comercial/Corp (3)" e, ao escolher, "Nenhum Objetivo com essa tag"; "Peak Natal (3)" mostrava 2. Também ignorava o filtro de torre. Agora conta só o que a tela mostra.
- **Slide sumindo ao vivo jogava pra capa:** se alguém desligasse no painel o único Objetivo da gerência que estava na tela, a apresentação voltava pra capa no meio da fala. Agora fica na mesma posição (o próximo slide). Trocar de filtro continua voltando pra capa.
- **Visualizador externo perdia anotação em silêncio:** a caixa de anotação ficava habilitada, o texto sumia ao enviar e as regras negavam a gravação. Agora ele vê as anotações com o aviso "acesso de visualizador", sem caixa; o ⏱ horário da reunião também não abre pra ele.
- **Falha ao gravar anotação sumia o texto:** agora o texto volta pro campo e aparece um aviso.
- **"Colapsar concluídos" deixava a numeração em "2." sem o "1.":** as linhas visíveis agora são renumeradas.
- **Torre única sem ícone** deixava um recuo vazio no cartão/título da torre ("Digital Hering 🐟"): o espaço do ícone só existe quando há ícone.
Sem achado: navegação por teclado (→ ← espaço F, com detalhe/anotações/comentários abertos), Esc em camadas, Anterior/Próximo do detalhe, Marco/Objetivo ocultos, "Colapsar concluídos", foco do `<select>`, modo de 3 torres. Testes: `docs/arezzo/testes/test_apresentacao.js` e `test_apresentacao_nav.js`.

### 🔲 Oceano: menu de produtos usa a logo do Maré Digital de verdade — 2026-10-09 · mare-notif-dev v10 · okr-dev v2.48 · painel-dev v5.25 · kanban-dev v8.30.806-dev (SÓ DEV)

No menu de produtos, o Maré Digital passa a usar o `favicon.png` de produção (os peixinhos) no lugar do ícone de ondas que eu tinha desenhado — também nas páginas `-dev`. Painel, Radar e A Bordo seguem com os SVG provisórios até ganharem logo própria. A imagem só carrega quando o menu abre.

### 🔲 Oceano: menu de produtos (estilo "apps do Google") — 2026-10-09 · mare-notif-dev v9 · okr-dev v2.47 · painel-dev v5.24 · kanban-dev v8.30.805-dev (SÓ DEV)

Novo botão de 9 pontinhos no cabeçalho do Maré Digital, do Painel e do Radar: abre a grade dos produtos do Oceano, cada um com a sua logo, e clicar **abre em aba nova**. Só aparece o que a pessoa usa:
- **Maré Digital** e **A Bordo**: qualquer pessoa da Hering · **Radar**: todo mundo, inclusive visualizador externo.
- **Painel**: ADM, visualizador externo e quem **já usa** o painel — abriu o painel alguma vez ou é PO/Organizador/ADM num squad. Isso fica em `kanban/usuarios/{uid}/apps/painel` (o próprio dono grava; as regras do banco já deixavam, **sem deploy**). É vitrine, não segurança: esconder o botão não impede quem sabe a URL.
- Nas páginas `-dev` o menu abre as páginas `-dev` e avisa "🧪 páginas de teste". A página atual aparece como "você está aqui".
- O botão "🐟 Painel" do cabeçalho do Radar foi substituído pelo menu (o Painel agora só aparece pra quem o usa).
- Implementação: módulo compartilhado `mare-notif-dev.js` (`MareNotif.appsMontar()` / `appsUso()`, logos em SVG próprios — sem arquivo de imagem); cada página só tem um `<span id="mare-apps-slot">` no cabeçalho e uma chamada depois do login. `?v=` do módulo vai pra 9.
- Testado em Chromium: ADM / pessoa comum / quem já usa o painel / visualizador externo veem os produtos certos, links `target=_blank rel=noopener` e `-dev`, Esc e clique fora fecham, cabe no celular, abrir o painel grava o uso, e o botão encaixa no cabeçalho do kanban.

### 🌊 Oceano: o OKR vira "Radar" 📡 — fase 1, só nomes visíveis — 2026-10-09 · okr-dev v2.46 · painel-dev v5.23 · kanban-dev v8.30.804-dev (SÓ DEV — produção ainda chama "OKR")

Decisão: o que era tudo "Maré Digital" vira uma família chamada **Oceano** — **Maré Digital** (o kanban, mantém o nome), **Painel** (mantém), **Radar** (o OKR), **A Bordo** (onboarding, depois) e **Travessia** (performance/gente, projeto futuro). Detalhes e regras em `docs/OCEANO.md`.
- **okr-dev:** aba do navegador "📡 Radar · Oceano", cabeçalho "📡 Radar · Oceano", tela de login, "Ajuda do Radar" (o herói agora diz "O Radar em 30 segundos" e explica que Radar é o nome do OKR no Oceano), "Mural do Radar", "Notificações do Radar", "Telas do Radar", "Online no Radar", "📘 Guia", boas-vindas e a notificação "te mencionou nas anotações do Radar".
- **painel-dev:** aba "📡 Radar ↗", menu de páginas, "Online no Radar", Visualizadores externos (painel e Radar) e avisos que citavam o OKR.
- **kanban-dev:** Central de Ajuda e a inscrição falam "Radar" onde é a página/produto.
- **Não mudou (de propósito):** "🎯 Gestor OKR" (papel), o selo **OKR dos cards** do kanban ("Marcar como OKR"), "OKRs" (metodologia), eventos "Check-in OKR" já gravados, arquivos/URLs/caminhos do banco.
- **Fica pra promoção:** `guia-okr.html` (+ prints), `okr-apresentacao.slide.html`, `maredigital.html` e os textos das Cloud Functions (prompt do Agente do OKR, push `okr_*` — exigem deploy), pra não deixar prod e guia dizendo coisas diferentes.
- Testado em Chromium (nomes no okr-dev/painel-dev/kanban-dev + suítes do modo só Hering e do modal de edição).

### v8.30.803 · okr v2.45 — 2026-10-08 · Promove pra prod — OKR: "Digital Hering 🐟" + Ajuda/Guia ao lado de Apresentação (okr.html v2.45)

Promove o okr-dev v2.45 (entrada "🐟 OKR: a torre única vira Digital Hering 🐟", abaixo): a torre única passa a se chamar **Digital Hering 🐟** (em vez de "🛒 Torre Digital") e **❓ Ajuda** e **📘 Guia** saem do "⋯ Mais" e ficam ao lado de 🎥 Apresentação. Sem mudança no kanban nem no painel (seguem na v8.30.803 / v5.22). Guia, apresentação e `maredigital` já estavam no ar (compartilhados). Sem avisos (pedido do usuário).

### 🐟 OKR: a torre única vira "Digital Hering 🐟" + guia e maredigital em dia com o modo só Hering — 2026-10-08 · okr-dev v2.45 · apresentação · guia-okr · maredigital (okr-dev SÓ DEV; guia/apresentação/maredigital são compartilhados e valem já)

- **Rótulo:** no modo só Hering o OKR deixa de falar "🛒 Torre Digital" e passa a mostrar **"Digital Hering 🐟"** (título da tela, ⚙ Gerências, avisos do sino "Novo Objetivo / Marco concluído", agenda, apresentação). Implementação: `OKR_TORRES` (okr-dev e apresentação) mapeia a torre única pra `{label:'Digital Hering 🐟', icon:''}` e o helper novo `okrTorreTitulo(id)` (`_okrTorreTitulo` na apresentação) devolve só o rótulo no modo só Hering e `🛒 Torre Digital` com o interruptor desligado — religar as 3 torres traz tudo de volta sem mexer em mais nada.
- **`guia-okr.html`:** slides das torres/gerências, permissões, calendário, Mural, sino, apresentação, visualizadores e Agente reescritos pra uma base só + login Google; **8 prints refeitos** (lista, gerências, trava, calendário, reunião, Mural, sino) com o Maré no modo só Hering. Os GIFs de criar/duplicar/reordenar não foram refeitos (mostram o fluxo, não o rótulo da torre).
- **`maredigital.html`:** versões das páginas e seção do OKR com a nota do modo só Hering (`docs/arezzo/MARE_SO_HERING.md`).
- **Cabeçalho:** os botões **❓ Ajuda** e **📘 Guia** saíram do menu "⋯ Mais" e ficam agora **ao lado de 🎥 Apresentação** (ids `okr-help-btn`/`okr-guia-btn`); o ⋯ Mais ficou só com ⚙ Gerências e 👁 Visualizadores (+ a versão).
- Testado em Chromium nos dois modos do interruptor (okr-dev + apresentação) e as suítes `test_so_hering` / `test_modal_edicao` seguem passando.

### v8.30.803 — 2026-10-08 · Promove pra prod — correções da auditoria do modo só Hering (kanban v8.30.803, painel.html v5.22, okr.html v2.44)

Promove as correções da auditoria `/monitorarbugs` (entrada abaixo): conta `@arezzo` entrando pelo Google deixa de ser mandada pro botão Microsoft escondido (cai no "Acesso restrito a @ciahering.com.br"), e torre desconhecida/corrompida continua valendo como Digital. O push do Mural (servidor) já estava publicado pelo usuário. Merge de 3 vias; dev × prod só diferem nas linhas de ambiente. Sem avisos.

### 🏢 Maré só Hering — auditoria `/monitorarbugs` — 2026-10-08 · kanban-dev v8.30.803-dev · painel-dev v5.22 · okr-dev v2.44 · Cloud Functions (SÓ DEV + funções — produção ainda na v8.30.802/v5.21/v2.43)

Auditoria do que o modo só Hering escondeu/esqueceu (reproduzida antes de corrigir):

- **Push do Mural não chegava pra quem ainda tem a flag de torre antiga.** `deveReceber()` (`sendPushOnMural`) comparava o aviso com `kanban/usuarios/{uid}/torre` cru: pessoa com `torre: 'comercial'`/`'corporativa'` (o campo continua gravado) via o aviso da Digital no sino mas **nunca recebia o push**. No modo só Hering a flag conta como Digital (a ⭐ Geral segue igual). **Requer** `firebase deploy --only functions:sendPushOnMural,functions:okrDailyScan,functions:okrAgenteChat` (o `mareModo.js` mudou).
- **Conta `@arezzo` entrando pelo Google era mandada pra um botão escondido.** `_loginProviderMismatchMsg()` (kanban, painel, OKR) respondia "Contas @arezzo.com.br entram pelo botão da Microsoft — clique em Entrar com Microsoft" — botão que não existe mais. Agora, no modo só Hering, cai no "Acesso restrito a @ciahering.com.br…" do portão de externos.
- **Torre desconhecida/corrompida sumia.** `_okrSoAtivo()` (okr) e `torreAtiva()` (funções) escondiam qualquer `torre` fora de `digital`; um valor inesperado (que antes valia como Digital em `_okrTorreDe()`/`torreDe()`) passava a desaparecer. Agora só some o que é, de verdade, de Comercial/Corporativa.
- Sem achado: `editar_marco`/`criar_marco` do Agente por `marco_id` de Objetivo oculto (a checagem de Objetivo bloqueia), `resumoGeral` do Histórico (recalculado a partir dos Objetivos filtrados), Marcos de Objetivos ocultos no Calendário/Histórico, mural/eventos/feed, `paraMim()` do sino, chip Arezzo do Global Users, religar (as suítes antigas de torres/gerências/calendário passam com os interruptores virados — lembrando que a apresentação tem a própria constante).
- Reportado, não alterado: (1) menção só `@ciahering` também tira freelancers `@gmail` do autocomplete do kanban (decisão de produto); (2) contas `@arezzo` já cadastradas seguem aparecendo nas listas de membros/responsável do kanban (as regras já as barram); (3) abrir um link `?okr=` de Objetivo de outra torre mostra "não foi encontrado…"; (4) `guia-okr.html`/`maredigital.html` ainda descrevem as 3 torres e a Microsoft.

### v8.30.802 — 2026-10-08 · Promove pra prod — Maré só Hering (login só Google, OKR só Digital, menção só @ciahering) + links em aba nova + modal de edição do OKR

Promove pra produção, com `painel.html v5.21`, `okr.html v2.43` e `mare-notif.js v8`: o **modo só Hering** (entrada abaixo — `window.MARE_SO_HERING = true`; o botão "Entrar com Microsoft" some, o OKR abre direto na torre Digital, @menção/listas de pessoas só com `@ciahering.com.br`), que já tinha `database.rules.json` e as Cloud Functions publicados pelo usuário; os **links entre páginas em aba nova** no kanban (v8.30.801-dev, que ainda não tinha subido); e, no `okr.html`, o **conserto do modal de edição** (duplo clique em Salvar, "alterações não salvas" falso, texto digitado sumindo, Esc — okr-dev v2.42). Merge de 3 vias a partir do estado promovido anteriormente; dev × prod só diferem nas linhas de ambiente. Sem avisos (Mural/WhatsApp), a pedido. Doc de referência e passo a passo pra religar: `docs/arezzo/MARE_SO_HERING.md`.

### 🏢 Maré só Hering — 2026-10-08 · kanban-dev v8.30.802-dev · painel-dev v5.21 · okr-dev v2.43 · apresentação · mare-notif-dev v8 · regras do banco · Cloud Functions (SÓ DEV — produção ainda não mudou)

Pedido direto: *"o Maré vai só atender Hering! pode voltar as configurações de só ter acesso Google, OKR só do Digital, menção só a Hering… mapeia tudo que tem hoje, faz as alterações mas gera um doc com tudo que tem e como implementou, caso seja necessário implementar novamente"*. Em vez de apagar o que foi construído entre 2026-10-01 e 07, tudo ficou atrás de **um interruptor por página** (`window.MARE_SO_HERING = true`) + um arquivo de regras arquivado — religar é trocar o valor (passo a passo no doc).

- **Login só Google:** botões "Entrar com Microsoft" (e o de conta Microsoft pessoal do kanban) escondidos; `doSignInMicrosoft*()` recusam; `TRUSTED_DOMAINS` = só `@ciahering.com.br` (conta `@arezzo` cai no portão de externos e é barrada); textos "@ciahering/@arezzo" dinâmicos (`_dominiosTxt()`). Chip "Arezzo" sai do 👥 Global Users.
- **Regras do banco:** `database.rules.json` sem a alternativa `@arezzo.com.br`+`microsoft.com` (60 expressões); a versão antiga ficou em `docs/arezzo/database.rules.com-arezzo.json`; a matriz de `rules/__tests__/databaseRules.test.js` roda nos dois arquivos. **Requer `firebase deploy --only database`** (máquina do usuário, depois do resync).
- **OKR só do Digital:** `OKR_TORRES` vira só Digital (home/barra/visão global/pergunta de torre/campo Torre/ajuda de torres somem), `_okrEntrarTorre()` sempre cai na Digital, e Objetivos, avisos do Mural e eventos de outra torre **não entram no cache** (ficam no banco, invisíveis). `_okrTorreDe()` devolve a torre crua da inativa, então snapshots/Marcos dela também ficam de fora. Apresentação (`okr-apresentacao.slide.html`, compartilhada → vai ao ar no merge) e sino único (`mare-notif-dev.js`, `?v=8`) seguem a mesma regra. Kanban: inscrição não pergunta a torre e a ajuda "Sua torre…" sai.
- **Menção/pessoas só `@ciahering.com.br`:** `mentionCandidates()` (kanban) e `_okrPessoaOptions()` (okr). Não bloqueia a notificação de um nome digitado à mão.
- **Cloud Functions:** novo `functions/common/mareModo.js` (`MARE_SO_HERING`, `emailDaEmpresa`, `torreAtiva`); `sendPushOnMural` (só `@ciahering`; aviso só de outra torre não vai pra ninguém), `okrDailyScan` (ignora Objetivo/evento de outra torre), `okrAgenteChat` (ferramentas e prompt só com a Digital). **Requer** `firebase deploy --only functions:sendPushOnMural,functions:okrDailyScan,functions:okrAgenteChat`.
- **Testes:** `npm test` em `functions/` (modo só Hering em `okr/__tests__/modoSoHering.test.js`; modo religado nas 4 suítes antigas via `MARE_MODO_TESTE=varias-torres`) + suítes de navegador do OKR rodando nos dois modos.
- **Documento de referência (o que existia, como foi feito, como religar):** `docs/arezzo/MARE_SO_HERING.md`.

### v8.30.800 — 2026-10-07 · Promove pra prod — sino único, torre na inscrição, Central de Ajuda em dia

Promove o lote de dev v8.30.795 → v8.30.800: (1) **sino único** — o 🔔 do kanban passa a mostrar também as novidades da torre (aviso do Mural do OKR, Objetivo criado, Marco concluído, reuniões do calendário) via `mare-notif.js`, e entende as notificações do OKR (@menção, reunião) levando ao lugar certo; link de reunião só abre http(s); (2) **cadastro novo pergunta a torre** (Digital/Comercial/Corporativa) — só vale pro OKR; (3) **Central de Ajuda** com colar lista no checklist, sino único, "Sua torre" e a Central do OKR. Diff vs. prod = só essas mudanças + as divergências de ambiente de sempre (favicon, `VERSION_KEY`, chave de "Deslogar todos"). Mesmo lote em dev: v8.30.795–800-dev.

### v8.30.801-dev — 2026-10-08 · fix: links do sino que levam a outra página (OKR/painel) abrem em ABA NOVA (só kanban-dev)

Pedido direto: redirecionamentos entre páginas não podem tirar a pessoa de onde ela está. No kanban, clicar numa notificação do OKR (Objetivo editado/prazo/reunião/Agente/@menção) ou no feedback do Mural agora abre o OKR/painel numa aba nova e o board continua como estava (antes trocava a página, e o board — com card aberto, filtros e rolagem — era perdido). Usa `MareNotif.abrirPagina()` (`mare-notif-dev.js?v=7`), que cai pra navegação normal só se o navegador bloquear a aba nova. Redirecionamento de link antigo (`painel?okr=` → OKR) continua na mesma aba — é só encaminhar.

### v8.30.800-dev — 2026-10-07 · docs: Central de Ajuda (❓) em dia com o dia — colar lista, sino único, "Sua torre", Agente do OKR (só kanban-dev)

Só texto da `HELP_CONTENT`, sem mudança de comportamento. **☑ Checklist** ganhou "📋 Colar uma lista" (tópicos `-`/`•`/`*`/`1.`/`1)`/`a)`, `[x]` marca feito, só com 2+ linhas, iniciais tipo "J. Silva" ficam no texto). **🔔 Notificações** agora conta que o sino é único: além dos avisos pessoais, mostra as novidades da torre (📢 Mural do OKR, 🆕 Objetivo criado, ✅ Marco concluído, 🗓️ reuniões do calendário) e que clicar leva ao lugar certo. Entrada nova **🏛️ Sua torre** (Digital/Comercial/Corporativa — perguntada na inscrição, só vale pro OKR, ADM troca em 👥 Global Users). **🎯 OKR** (o marcador do card) aponta pra página própria do OKR e **🤖 O que é o Agente Ágil** cita a Central do OKR. Visualmente nada mudou.

### v8.30.798-dev — 2026-10-07 · fix: o sino do kanban só abre link de reunião http(s) (só kanban-dev)

Achado do `/monitorarbugs` no sino único: a notificação "🎥 Reunião em X min" abria `meetingLink` com `window.open()` sem checar o esquema — um `javascript:` gravado na notificação (quem tem permissão de criar notificação na caixa de outra pessoa) rodava no navegador de quem clicasse. Agora só `http(s)://`, com `noopener`.

### v8.30.797-dev — 2026-10-07 · feat: SINO ÚNICO — o sino do kanban passa a mostrar o feed da torre (só kanban-dev)

Pedido direto: "o sistema de notificação do Maré tem que ser um só — a notificação aparece independente da página em que você está". As notificações pessoais já eram um nó só (`kanban/usuarios/{uid}/notificacoes`); o que estava separado era o **feed da torre** (aviso novo no Mural do OKR, 🆕 Objetivo criado, ✅ Marco concluído), que só aparecia no sino do OKR. Agora o kanban carrega o módulo compartilhado `mare-notif-dev.js` e **mistura o feed na própria lista do 🔔**, ordenado por data, com o mesmo selo; clicar num item do feed abre o OKR no ponto certo (`?mural=<id>` / `?okr=<id>`) e marca como lido; **"Marcar todas como lidas" também zera o feed**. Quem não tem acesso ao feed (freelancer) só não recebe esses itens. Nada do sino de antes mudou (som, Não Perturbe, "Limpar antigas", ✕, navegação de cada tipo).

### v8.30.796-dev — 2026-10-07 · fix: o sino do kanban entende a notificação de @menção do OKR (só kanban-dev)

Acompanha o **sino do OKR** (`okr-dev.html` v2.10): as Anotações da reunião ganharam @menção e a pessoa mencionada recebe uma notificação `okr_mencao`. Sem isto, no sino do kanban ela apareceria com o ícone genérico e, ao clicar, só marcaria como lida sem levar a lugar nenhum (a mesma classe de gap já corrigida em 2026-09-06 para os outros tipos `okr_*`). Agora tem o ícone 💬 e leva às Anotações do OKR (`?okr=notas`).

### v8.30.795-dev — 2026-10-07 · feat: cadastro novo pergunta a torre (Digital / Comercial / Corporativa) na inscrição (só kanban-dev)

Parte do recurso **Torres** do OKR (ver `okr-dev.html` v2.0). A tela "🙋 Inscrever-se no quadro" — que todo usuário **novo** já vê, pra confirmar as iniciais — ganhou o campo obrigatório **Sua torre** (começa em "Escolha…"; sem escolher, "⚠ Escolha a sua torre."). A escolha é gravada só em `kanban/usuarios/{uid}/torre` (o board não lê esse campo; `usuarios_publicos` fica como está). Também vale pro caminho "cadastro com recarga" (externos), que reabre a inscrição depois do reload. Quem já existia **não** é perguntado aqui: sem o campo = Digital. A inscrição antiga ("Primeira vez?") também não pergunta.

### v8.30.794 — 2026-10-07 · Promove pra prod — colar uma lista em tópicos no checklist cria um item por linha

Promoção de `kanban-dev.html` v8.30.793 + v8.30.794 (merge de 3 vias a partir da v8.30.792-dev; dev × prod só diferem nas 7 linhas de ambiente). Sugestão de usuária: colar uma mensagem escrita em tópicos no "Novo item..." do checklist jogava tudo num item só (o `<input>` de uma linha achata as quebras). Agora, com 2+ linhas, cada linha vira um item: marcadores do começo (`-`, `•`, `*`, `1.`, `1)`, `a)`, `☐`…) são removidos, `[x]`/`[ ]` entram marcados/desmarcados (formato do "📋 Copiar checklist"), sub-itens recuados viram itens, iniciais de nome ("J. Silva") e sinais ("-5 pontos") ficam intactos, 1 linha cola normal. Smoke test no `kanban.html` real: 15 cenários verdes; `node --check` OK; balanço -1/-1 (baseline novo: +4 parênteses de regex/comentário, não de sintaxe). Mural: rascunho `seed_colar_lista_checklist_2026_10_07`.

### v8.30.794-dev — 2026-10-07 · fix: colar lista no checklist não come iniciais de nome ("J. Silva") (só kanban-dev)

Achado de `/monitorarbugs` no parser da v8.30.793-dev: o marcador de letra aceitava `A.` além de `a)`, então "J. Silva enviou a proposta" colado no checklist virava "Silva enviou a proposta". Agora só `a)`/`B)` conta como marcador. Chromium: parser + colar de verdade (15 cenários).

### v8.30.792 — 2026-10-06 · Promove pra prod — ordenação de colunas corrigida (+ "mais recentes primeiro"), "Marcar todas como lidas" do sino, data nos históricos e popup Dados do Board maior

Promoção do lote acumulado de `kanban-dev.html` desde a v8.30.787 (merge de 3 vias; a diferença prod novo × antigo é exatamente a diferença do dev no período, e dev × prod só diferem nas 7 linhas de ambiente de sempre: favicons, versão, `VERSION_KEY`, chave de logout forçado):
- **Ordenação nas colunas** (v8.30.788/789): "Data de criação" mandava cards sem data pro topo e empates do mesmo dia ficavam na ordem do array (agora: sem data por último, desempate pela hora de criação do id); "Prazo" desempata por prioridade; e o campo `_lastFlowCol` — que o Agente Ágil não atualiza ao mover cards no servidor — é reposto a partir da coluna real a cada sincronização, então
  arrastar um card de volta à coluna antiga volta a subir em "Movimentação". Nova opção **🕐 Data de criação (mais recentes primeiro)** (a antiga virou "mais antigos primeiro").
- **Histórico do card mostra sempre a data completa e a hora** (`06/10/2026 14:32`), sem "3d/4d/5d" (v8.30.790).
- **📊 Dados do Board** (v8.30.791): popup de até 1500px, **barra única "Colunas na conta"** com chips (vale pras 3 abas), cartões lado a lado e gráficos (barras, tendência, CFD, burndown) que preenchem a largura e se redesenham ao redimensionar.
- **Fix do sino** (v8.30.792): "Marcar todas como lidas" não gravava nada desde a v8.30.786 (regex sobre o `onclick`, que passou a usar aspas duplas), e por isso "Limpar antigas" não achava notificação lida pra apagar; agora ambos gravam numa escrita só, com toast de sucesso/erro.
Smoke test no `kanban.html` real: Dados do Board 12/12, ordenação OK, sino (1 escrita com todos os ids), data do histórico OK. `node --check` OK; balanço -1/3 no baseline. Mural: rascunho `seed_kanban_v8_30_792_2026_10_06`.

### v8.30.793-dev — 2026-10-07 · fix: colar uma lista em tópicos no "Novo item..." do checklist agora cria um item por linha (só kanban-dev)

Sugestão de usuária: copiar uma mensagem escrita em tópicos (WhatsApp, Slack, e-mail, outro card) e colar no campo do checklist jogava tudo num item só. Causa: o campo "Novo item..." é um `<input>` de uma linha, e o navegador achata as quebras de linha ao colar. Agora o evento de colar é tratado: com **2 ou mais linhas** o texto é dividido por linha (linhas vazias ignoradas) e cada uma vira um item — marcadores no começo são removidos (`-`, `•`, `*`, `–`, `▪`, `●`, `1.`, `1)`, `a)`, `☐`…) e `[x]`/`[ ]` entram já marcados/desmarcados (é o formato que "📋 Copiar checklist" gera, então copiar de um card e colar em outro preserva quem estava concluído). Sub-itens recuados viram itens normais; "-5 pontos" (sem espaço) mantém o sinal; **1 linha só cola normal**. Toast "📋 N itens adicionados ao checklist." e um único passo no "desfazer". Chromium (14 cenários: parser com 9 formatos + colar de verdade no campo, lista × 1 linha, grupo certo, `[x]` preservado, sem erro de JS). Só dev; o prod recebe quando validado.

### v8.30.792-dev — 2026-10-06 · fix: "Marcar todas como lidas" do sino não gravava nada (e por isso "Limpar antigas" não achava nada pra apagar)

Relato de usuária ("não consigo apagar as notificações já lidas"). Causa raiz: `markAllRead()` achava o id de cada notificação com um regex `/'([^']+)'/` em cima do atributo `onclick` — mas desde a conversão do `onclick` do sino para `jsq()` (correção de XSS, v8.30.786) os
ids vão entre aspas **duplas**, e o regex nunca mais casou: **"Marcar todas como lidas" virou um botão que não faz nada** (nem erro, nem toast). Como abrir o painel não marca nada como lido, a única forma de uma notificação virar "lida" em lote estava quebrada, e **"Limpar antigas"**
(que só apaga as já lidas) respondia "Nenhuma notificação lida para remover" — ou só limpava as que a pessoa tinha aberto uma a uma. Presente também no prod (kanban v8.30.786/787). Fix: os dois botões leem o id de `data-notif-id` (agora com `esc()`), gravam **numa escrita só** (`update` multi-path, em vez de uma por notificação, que re-disparava o sino a cada item) e
mostram toast de sucesso/erro; o plural do toast também estava errado ("notificaçãoões"). Reproduzido antes (0 escritas) e depois (1 escrita com todos os ids, inclusive um id com apóstrofo). Só dev nesta versão; o prod recebe o hotfix isolado.

### v8.30.791-dev — 2026-10-06 · feat: popup 📊 Dados do Board maior, com barra única de colunas e gráficos que preenchem a tela (só kanban-dev)

Pedido direto (print da aba CFD & Burndown: popup estreito, gráfico encolhido num canto, "Colunas na conta" repetida em cada aba): o popup passa de 860px para **até 1500px (97% da tela)**; o toggle **📍 Colunas na conta**
virou uma **barra única fixa no topo, com botãozinhos (chips) maiores e acessíveis por teclado**, valendo para as 3 abas (já valia no cálculo; saem as 3 cópias, uma em cada aba). Junto na barra fica o botão ⏱ Relatórios de Tempo.
**Visão Geral**: indicadores em grade mais larga e, abaixo, "Cards ativos por coluna" e "Tendência — 14 dias" **lado a lado** em cartões. **CFD & Burndown**: os dois gráficos lado a lado (CFD 60%, Burndown 40%).
Todos os gráficos (barras, tendência, CFD, burndown) agora **medem a largura do container** e se redesenham ao redimensionar a janela, em vez de ficarem num viewBox fixo de ~540px; rótulos de data um pouco maiores. Em tela estreita (<980px) os cartões empilham.
Ajuda ("CFD & Burndown") atualizada. 12 cenários no Chromium (tamanho do popup, gráficos preenchendo, chips únicos, toggle valendo nas 3 abas, teclado, resize, celular). Só dev.

### v8.30.790-dev — 2026-10-06 · ajuste: Histórico do card mostra sempre a data (sem "3d/4d/5d") (só kanban-dev)

Pedido direto: no **Histórico** do card (a lista no fim do modal), cada linha mostrava o tempo relativo ("agora", "5min", "3h", "4d") e só passava pra data depois de 7 dias. Agora **toda linha mostra a data
completa e a hora** (`06/10/2026 14:32`); o tooltip continua com segundos. Só `_histRelTime()`. Só dev.

### v8.30.789-dev — 2026-10-06 · feat: ordenação "Data de criação (mais recentes primeiro)" (só kanban-dev)

Pedido direto (continuação da v8.30.788-dev): "Data de criação" só ordenava do mais antigo pro mais novo, enquanto "Movimentação" é do mais recente pro mais antigo. Nova opção **🕐 Data de criação (mais recentes primeiro)** no
botão ↕ Ordenação e em ⚙ da coluna → Visualização; a antiga virou "(mais antigos primeiro)". Mesmas regras da v8.30.788: no mesmo dia vale a hora de criação embutida no id (a mais nova primeiro neste modo), e card SEM data de
criação fica no FIM nos dois sentidos. Central de Ajuda (Ordenar cards nas colunas) atualizada. Verificado no Chromium (ordem pura e `renderBoard()`, menu e config da coluna).

### v8.30.788-dev — 2026-10-06 · fix(/monitorarbugs): ordenação por data de criação, prazo e movimentação (só kanban-dev; prod espera validação)

Relato de usuários: "a ordenação do kanban tá com bug, especialmente a por data e a por movimentação". Reproduzido no Chromium com as funções reais (6 de 6 cenários falhavam):
- **Movimentação / métricas de fluxo — card movido pelo Agente Ágil e depois arrastado de volta**: `card._lastFlowCol` ("onde o fluxo achava que o card estava") é gravado junto com o card, mas
  o Agente Ágil move cards no servidor (atualiza col/flow/log) sem conhecer esse campo — o card chegava com o valor VELHO e `_applyCardsSync()` só o repunha quando vinha vazio. Arrastar esse card de
  volta pra coluna que o campo velho dizia fazia `recordMove()` achar que "já estava lá" e sair sem atualizar `enteredAt`/log: o card NÃO subia em "Movimentação (mais recente)", cycle/lead time e Timeline
  ficavam parados; indo pra uma 3ª coluna, o log gravava o `from` errado. Agora `_syncLastFlowCol()` repõe o campo a partir da coluna que veio do banco depois de TODA sincronização.
- **Data de criação**: o card SEM data (legado/importado) vinha PRIMEIRO na coluna ('' < qualquer data), ao contrário de "Movimentação"/"Prazo" — agora vai pro fim; e como `createdAt` é só o dia, vários cards do
  mesmo dia ficavam na ordem do array — agora desempata pela hora embutida no id (`_cardIdTs()`), a criação de verdade.
- **Prazo (antigos/novos primeiro)**: cards com o MESMO prazo ficavam na ordem do array — agora o mais prioritário primeiro.
Verificado também na tela (`renderBoard()`). Sem mudança no que já funcionava (prioridade, tamanho, alfabética, manual, pin). `node --check` OK; chaves/parênteses -1/3 (baseline).
Em aberto (decisão de produto, perguntado): "Data de criação" só ordena do mais antigo pro mais novo, enquanto "Movimentação" é do mais recente pro mais antigo — falta a opção inversa.

### v8.30.787 — 2026-10-06 · Promove pra prod — mobile: passar o dedo na lista de cards não abre mais um card

Promoção do kanban-dev v8.30.787 sobre o prod v8.30.786 (merge de 3 vias; só a linha de versão conflitou; diff dev × prod continua só nas 28 linhas de ambiente).
Pro público de prod: no celular/tablet, passar o dedo rápido sobre a lista de cards (pra rolar) abria um card por engano — e tocar pra parar uma rolagem em
andamento também. Agora só toque de verdade abre o card: o dedo que andou mais de 10 px conta como rolagem, e um toque que começa até 160 ms depois do último scroll
só interrompe a inércia. Duplo toque (menu de contexto) e toque normal seguem iguais. Testado em Chromium com toque emulado contra o `kanban.html` real: 9 de 9 cenários.
Checks: `node --check` OK; chaves/parênteses -1/3 (mesmo baseline da v8.30.786). Sem avisos (correção de bug).

### v8.30.786 — 2026-10-05 · Promove pra prod — externos com conta Microsoft pessoal, cadastro guiado, 💬 de comentários, chip Híbrido, reforço de segurança

Promoção do lote acumulado em dev desde a v8.30.777 (v8.30.778 a v8.30.786-dev; pedido: "uma promoção agora com tudo
acumulado, vou pedir pras pessoas de Microsoft testarem"). Pro público de prod:
- **Externos autorizados com hotmail/outlook**: novo link "Entrar com conta pessoal Microsoft" na tela de login (o botão
  corporativo da Arezzo continua igual). Depende do registro do app no Azure aceitar contas pessoais (já configurado).
- **Cadastro guiado**: usuário novo agora cai sozinho na tela "🙋 Inscrever-se no quadro" com qualquer provedor (o link "Primeira
  vez?" saiu — ele sempre abria o login do Google). Quando não dá pra saber o squad (URL sem `?squad=`, ou cadastro sem squad
  nenhum), a tela "👋 Complete seu cadastro" pergunta em vez de assumir. Externo recém-cadastrado recarrega uma vez sozinho (antes
  ficava com o board vazio até o 1º F5) e, se o cadastro for recusado, aparece o aviso com a causa.
- **Externo autorizado só em outro squad** não é mais recusado; a mensagem de recusa lista os squads onde ele está autorizado.
- **Correções de cadastro**: ADM novo não fica preso no login; confirmar a inscrição não regrava o papel; "Primeira vez?" não
  promove mais externo a membro sozinho; erro de "Permission denied" no console de externo silenciado.
- **💬 Comentários no card**: indicador na linha de ícones (ao lado de ≡ e 📎), com a contagem quando há mais de 1. Alimentado por
  uma Cloud Function (`contarComentarios`, já no ar); cards antigos passam a mostrar depois que alguém comenta ou abre o card.
- **🤝 Híbrido**: o chip do executor ficou compacto e cabe na linha das tags.
- **Segurança**: nomes/títulos/ids com aspas ou HTML (intake, notificações, listas) não executam mais script no navegador de quem
  abre a tela (332 pontos no kanban, mais OKR/onboarding).
Detalhes técnicos nas entradas `-dev` v8.30.778 a v8.30.786-dev logo abaixo.

### v8.30.777 — 2026-10-02 · Promove pra prod — login mais claro (Google × Microsoft), foto do Google corrigida, seletor de squad

Promoção do lote acumulado em dev desde a v8.30.774 (pedido: "promove tudo pra
prod"). Pro público de prod:
- **Login**: conta `@ciahering.com.br` só entra pelo botão do **Google** e
  `@arezzo.com.br` só pela **Microsoft** — quem clicar no botão errado agora
  recebe uma mensagem dizendo qual usar, em vez de cair num board em branco.
  Conta sem e-mail também é recusada com explicação.
- **Mensagem de recusa não some mais**: quem era barrado como externo não
  autorizado via a tela de login voltar sem motivo; o aviso agora aparece.
- **🔄 Atualizar minha foto do Google**: a releitura agora usa o perfil
  mais novo devolvido pelo login e avisa corretamente quando uma das fontes
  do Google falha.
- **Seletor de squad**: nome/emoji dos squads escapados no HTML.

Checks de rotina: `node --check` nos 3 blocos `<script>` — OK;
`diff kanban.html kanban-dev.html` conferido — só as divergências
permanentes de ambiente (favicon, versão/`VERSION_KEY`, `_faviconDefaultHref`,
`force_logout_after`).

### v8.30.787-dev — 2026-10-06 · fix(mobile): passar o dedo na lista de cards (rolar) não abre mais um card

Relato direto: "no mobile, quando eu passo o dedo rápido na lista de card, para descer ou subir, ele abre um card! Deveria só correr a lista."
- **Causa**: desde o duplo-toque por `touchend` (v8.30.739-dev), o `addTouchDnD()` tratava **qualquer gesto que não virou arrasto como "toque simples"** e abria o card após 350 ms — sem checar se o dedo andou. Antes, o abrir vinha do `click`, que o navegador **não** gera depois de uma rolagem; ao contar os toques manualmente essa proteção nativa se perdeu. Qualquer rolagem que **começasse em cima de um card** abria um card; o mesmo acontecia ao **tocar para parar** a lista que ainda rolava por inércia.
- **Correção**: um gesto só é "toque" se o dedo andou **≤ 10 px** (`TAP_SLOP_PX`) **e** o toque não começou até 160 ms depois do último scroll (`TAP_SCROLL_GRACE_MS`, que cobre a inércia). Rolagem e "toque que só parou a rolagem" não abrem card nem contam para o duplo-toque. Toque simples, tremida de poucos pixels, duplo-toque (menu de contexto) e arrastar-para-mover (long-press) continuam como antes.
- Testes (Chromium com toque emulado, função real `addTouchDnD`): 9 cenários — flick rápido, arrasto lento, tremida, parar a inércia, duplo-toque, e "nada ficou travado depois de um swipe"; 3 deles falhavam antes da correção.
- **Para validar**: no celular, abra o board (a tela pede "atualizar agora" ao detectar a v8.30.787-dev) e role a lista de cards com o dedo, rápido e devagar, começando em cima de um card; depois toque normalmente e dê um duplo-toque.

### v8.30.786-dev — 2026-10-05 · fix(cadastro): /monitorarbugs no login/cadastro do dia — ADM novo não fica mais preso no login (+3)

Rodada de `/monitorarbugs` sobre o código de hoje (v8.30.781–785). 5 achados, o 1º é regressão da v8.30.784.

- **ADM novo (não-Caio) preso na tela de login (regressão da v8.30.784):** o 1º cadastro grava `role: 'adm'` para quem está em `ADM_EMAILS`,
  mas as regras (`usuarios/$uid/role` `.validate`) só deixam quem já é po/adm, ou o Caio, atribuir `adm` — num 1º login isso é NEGADO e derruba
  o cadastro inteiro. Antes a gravação era fire-and-forget (falhava em silêncio e o app abria); a v8.30.784 passou a aguardar e dar `return` na
  falha, então o ADM novo via só um aviso e nunca entrava. Agora grava `membro` (o ADM por e-mail segue ADM via `isAdmUser()`), e uma falha de
  gravação avisa a causa mas **não trava** o app.
- **`confirmarInscricao()` regravava `role`:** papel efetivo pode vir de `squads_roles`/`isAdmUser()` (≠ role global) e as regras negam mudar o
  role global de quem não é po/adm — o update INTEIRO era recusado e as iniciais se perdiam. Só grava `role` se não há papel nenhum.
- **Cache do gate de externos (15 min) vale pro e-mail, não pro squad:** externo validado num squad e abrindo outro dentro da janela chegava na
  matrícula sem ter sido conferido NESTE squad e levava um erro de regra com mensagem enganosa. Agora confere a lista de externos antes e avisa
  "peça ao PO para te adicionar".
- **auth-change refirado durante o cadastro:** com a pergunta de squad e a gravação aguardada, a 2ª execução abria uma 2ª tela e uma 2ª
  reivindicação de iniciais em paralelo. Guard `_regEmAndamento`.
- Testado com a página real e banco simulado (Playwright): 24 cenários de cadastro + 4 do gate; script de console em português (8 verificações,
  restaura o estado da página no fim). Não testado com Firebase real.

### v8.30.785-dev — 2026-10-05 · fix(cadastro): usuário novo cai na inscrição sozinho — some o "Primeira vez?" (que só entrava pelo Google)

**Cenário real:** externo entrou direto pelo link "Entrar com conta pessoal Microsoft" (1º acesso) sem clicar em "Primeira vez?
Inscrever-se no quadro" — esse atalho chamava o login do **Google**, então por Microsoft/conta pessoal a tela de inscrição
nunca aparecia (o cadastro era feito em silêncio, sem a pessoa confirmar nada).

- Link "Primeira vez?" removido. O próprio login detecta usuário novo (sem cadastro, ou com cadastro parcial) e abre a tela
  "🙋 Inscrever-se no quadro" (iniciais), com qualquer provedor. Para externo, a inscrição abre depois do reload do 1º cadastro.
- A tela mostra o papel real ("Convidado" para externo, "Membro" para domínio confiável) em vez de sempre "Membro".
- `confirmarInscricao()` não grava mais `role: 'membro'` fixo — mantém o papel do cadastro. Com a inscrição agora aberta para todo
  usuário novo, o valor fixo promoveria externo a membro sozinho (as regras permitem convidado → membro pelo próprio uid).
- Testado com a página real e banco simulado (Playwright): 21 cenários de cadastro + 4 do gate. Não testado com Firebase real.

### v8.30.784-dev — 2026-10-05 · feat(cadastro): cadastro guiado — pergunta o squad quando falta e recarrega o 1º login de externo

**Pedido:** "em vez de assumir esse erro, o código deve tentar corrigir com o usuário — se faltar qual squad é, pergunta".

- **Reload automático:** externo recém-cadastrado recarrega 1x assim que o cadastro é gravado (os listeners dos cards disparavam
  antes e levavam `permission_denied`, deixando o board vazio até o 1º F5). A mensagem de boas-vindas é mostrada depois do reload.
- **Tela nova "👋 Complete seu cadastro":** sem `?squad=` na URL o app matriculava a pessoa em `dados` sem perguntar (o seletor
  pré-login foi removido em 2026-10-01). Agora lista os squads elegíveis (externo = só onde foi autorizado; domínio confiável =
  todos) e pergunta. Se há só 1 opção para um externo, vai direto. Usuário que já tem cadastro mas **nenhum** squad também é
  perguntado (domínio confiável pode "Agora não": vale 7 dias).
- **Gate de externos mais útil:** autorizado em outro squad (ou sem `?squad=`) deixa de ser recusado; quando a URL pede um squad
  em que ele não está, a mensagem lista os squads em que ele ESTÁ autorizado.
- **Cadastro não é mais fire-and-forget:** se as regras recusarem a gravação, aparece o aviso com a causa em vez de board vazio.
- **Externo já cadastrado sem matrícula no squad da URL:** matricula e recarrega 1x.
- Achado durante o teste: a tela nova ficaria por baixo do login (z-index) e o Esc global a fecharia sem resolver a pergunta;
  usa classe própria (`.cad-ov`, z-index acima do login, fora do `.ov.open`).
- Testado com a página real e banco simulado (Playwright): 16 cenários de cadastro + 4 do gate, todos ✅. Não testado com Firebase real.

### v8.30.783-dev — 2026-10-05 · fix(login): externo não vê mais "Uncaught Permission denied" ao ler ADMs extras

A leitura de `kanban/config/adm_emails` no boot não tinha `.catch`. Externo não tem leitura de `kanban/config`
pelas regras, então todo login dele gerava um "Uncaught (in promise): Permission denied" e uma tentativa de gravar
em `error_logs` (também negada). Sem efeito funcional, só ruído no console. Adicionado `.catch` vazio. Os avisos
de `presence` continuam: pelas regras, gravar presença é só para `@ciahering`/`@arezzo`.

### v8.30.782-dev — 2026-10-05 · fix(login): 1º login de externo caía em registro parcial e ficava com o board vazio

**Cenário real:** externo autorizado (conta Microsoft pessoal) entrou, mas o board abriu vazio com
`permission_denied` na leitura dos cards. O nó `kanban/usuarios/{uid}` dele tinha só `board_prefs`,
`temasDescobertos`, `nome` e `email` — sem `init`, `role`, `squads` nem `inscrito`.

**Causa:** outros pontos do app gravam filhos de `usuarios/{uid}` (preferências, descoberta de tema, sincronização
de perfil) antes de `autoRegistrar()` rodar, então o nó já "existia" e o login seguia pelo ramo de usuário antigo,
que nunca grava `squads/{squad}: true`. Para externos as regras só liberam a leitura do squad com esse valor.
Sem ele: board vazio, sem mensagem e sem saída. Também afetava usuário novo de domínio confiável (ficava sem `init`/`role`).

**Correção:** registro sem `init`/`squads`/`role`/`inscrito` é tratado como cadastro novo, gravado com UPDATE
(preserva `board_prefs` e demais campos) em vez de SET. Quem já estava nesse estado se conserta sozinho no próximo
login (F5).

### v8.30.781-dev — 2026-10-05 · feat(login): "Entrar com conta pessoal Microsoft" para externos autorizados (hotmail/outlook)

**Problema:** externo autorizado tentou entrar com conta Microsoft pessoal (hotmail) e a própria Microsoft
recusou: "Você não pode entrar aqui com uma conta pessoal. Use sua conta corporativa ou de estudante."
Causa: o botão "Entrar com Microsoft" (integração Arezzo) fixa `tenant: 'organizations'`, que por
definição rejeita contas pessoais — a recusa vem da Microsoft, antes de voltar pro app.

**Correção:** link novo na tela de login, **"Externo autorizado com hotmail/outlook? Entrar com conta pessoal
Microsoft"**, com provider próprio (`tenant: 'consumers'`), mesmo fluxo de popup + fallback de redirect do botão
corporativo. O botão corporativo não mudou. Não foi usado `tenant: 'common'` num botão só de propósito: aceitaria
contas corporativas de qualquer empresa, e o e-mail dessas contas não é verificado pela Microsoft (um tenant
próprio poderia reutilizar o e-mail de um externo autorizado). Com `consumers` só entra conta pessoal, e a
Microsoft verifica esse e-mail. A autorização continua sendo a lista de externos do squad (gate do client +
regras do banco, inalterados). Só `kanban-dev.html`; `painel` não tem externos.

**Pré-requisito fora do código:** no Azure (registro do app), "Tipos de conta com suporte" precisa incluir
"contas Microsoft pessoais" — sem isso a Microsoft recusa também por este link.

### v8.30.780-dev — 2026-10-05 · feat(card): indicador 💬 de comentários na linha de ícones (ao lado de ≡ e 📎)

Pedido direto do usuário (com print de um card): na segunda linha, a que tem o ícone de
descrição (≡) e de anexo (📎), "podia criar o símbolo de comentários também".

O board não sabia quais cards têm comentário: eles vivem em `card_comments/{cardId}/…`, path
próprio que nunca vem junto do card (ler todos só pra desenhar um ícone seria caro). E comentário é
escrito por MAIS DE UM caminho — o cliente (3 pontos + importar/duplicar) **e as Cloud Functions do
Agente Ágil** (respostas, resumos) —, então um contador só no navegador perderia justamente as
respostas do agente.

- Nova Cloud Function `contarComentarios` (`functions/comentarios/contagem.js`): a cada escrita em
  `card_comments/{cardId}/{id}` recalcula (contando os filhos — idempotente, tolera reentrega e
  ordem trocada) e grava `card_comments_count/{cardId}` = n (remove quando chega a 0). Só escreve no
  índice, nunca em `card_comments`: sem risco de loop. 7 testes novos (561/561 na suíte).
- Board escuta só esse índice minúsculo (id → n, `_dbgTrack('/card_comments_count:live')`) e desenha
  `💬` na linha de ícones; mostra o número só quando há mais de 1 (igual ao ≡ de descrições). Mudou a
  contagem → atualiza o ícone no lugar, em todas as faces do card (raias), sem re-renderizar o board.
  Fica oculto na densidade compacta, como os outros ícones. Card antigo com o campo legado
  `comments` também conta.
- Rede de segurança no cliente: ao abrir um card, se o índice diverge da lista real que acabou de
  chegar, corrige o índice — o recurso funciona (e se cura sozinho) mesmo antes do deploy da function.
- Chromium com o `makeCardEl()` real: sem contagem não desenha; 1 → `💬`; 7 → `💬⁷`; troca/remoção no
  lugar; mesmo card em 2 faces; id com aspas no seletor não lança e não afeta outros cards.
- **⚠️ Requer** `firebase deploy --only functions:contarComentarios` (resincronizar o clone antes) e,
  **uma vez**, o backfill dos comentários que já existem (script de console no painel, ver o chat).
  Sem o deploy, o ícone só aparece nos cards que alguém abrir (a rede de segurança acima).

### v8.30.779-dev — 2026-10-05 · fix(segurança, /monitorarbugs "áreas sensíveis"): XSS armazenado via id em handler inline (`on*="f('${esc(x)}')"`)

`on*="f('${esc(x)}')"` **não é seguro**: `esc()` troca `'` por `&#39;`, que o
navegador decodifica de volta pra `'` ANTES de o JavaScript do atributo rodar. Um
id como `x');window.__pwn=1;//` escapa da string e executa. Reproduzido no
Chromium com o `_intakeItemHtml()` real: os 4 botões do item de intake rodaram o
código injetado. Quem controla o dado (`intake_pending` aceita escrita de
qualquer membro de squad, inclusive freelancer da whitelist `externos`) roda JS na
sessão de quem abrir a tela — inclusive de um ADM, que pode então trocar papéis.
Havia também ~110 casos em que o id entrava no `onclick` **sem nem passar pelo
`esc()`**.

- Novo `jsq(x)` (junto de `esc()`): `esc(JSON.stringify(String(x)))` — literal JS
  válido, protegido pro atributo HTML.
- 195 interpolações `'${…}'` em atributos `on*=` convertidas pra `${jsq(…)}`
  (transformação mecânica, restrita ao interior dos atributos). Não sobrou nenhuma
  entre aspas simples em atributo `on*`.
- Verificação no Chromium: 5.020 textos hostis (aspas, barra invertida, `</script>`,
  `&#39;`, quebras de linha, U+2028, `${…}`, crases, emoji...) — o handler recebe
  **exatamente** a string original, 1 chamada, 0 execuções injetadas; PoC do intake
  neutralizado e caso benigno intacto; sem erro de página no boot.
- Mesma correção em `painel-dev.html` (v3.95), `okr-apresentacao.slide.html`
  (4 ids crus) e `onboarding.slide.html` (1) — ver as entradas deles.

### v8.30.778-dev — 2026-10-05 · ui(card): chip de executor ("🤝 Híbrido") compacto pra caber na linha das tags

Pedido direto do usuário (com print de um card): "será que esse 🤝 Híbrido não
cabe na linha de cima? deixando o layout mais limpo?". Medido no Chromium com o
`makeCardEl()` real, num card de 258 px (234 úteis) com tag + 👕 M + OKR +
prioridade + risco + 🎯 + 🚧: a 1ª linha deixava **47 px** livres e o chip com
texto precisava de **61 px**, então ele caía sozinho pra uma linha só dele
(falta ~14 px — não dava pra resolver só apertando margem).

- O chip de executor (`.exec-chip`, só aparece pra Agente/Híbrido) mostra só o
  emoji (🤖/🤝) + o emoji do status do agente quando existe (ex.: `🤝 👀`),
  ~25 px (39 px com status) — cabe na linha das tags e o card perde uma linha de
  altura. O nome por extenso continua no tooltip (`title`/`aria-label`:
  "Executor: Híbrido — Aguardando validação") e no campo "Executor" do modal.
- Cards com ainda mais selos continuam quebrando de linha normalmente (é flex de
  inline-blocks). O chip efêmero "🤖 pensando…" não mudou.
- Só `kanban-dev.html`; prod (`kanban.html`) fica pra depois da sua validação.

### v8.30.777-dev — 2026-10-01 · fix(seletor de squad): nome/emoji/subtítulo/id injetados crus no HTML

`/monitorarbugs` (seletor de squad pós-login, PR #1148 de hoje).
`renderSelectorGrid()` montava o grid com `meta.label`/`subtitle`/`emoji` e
o `id` direto no `innerHTML`/`href` — texto livre digitado no painel
(`kanban/squads_meta`). O seletor do header (`toggleSquadSwitcher()`) já
escapava com `esc()`/`encodeURIComponent()`; este era o único que não.
Um nome de squad com `<`/`&`/aspas quebrava o card (ou injetava HTML).

### v8.30.776-dev — 2026-10-01 · fix(login): botão errado (Google × Microsoft) entrava em app vazio + mensagem de recusa sumia no reload

`/monitorarbugs` no login com Microsoft (feito hoje). 3 achados:
1. **Gate do client mais frouxo que as regras.** `database.rules.json` (PR
   #1152) só aceita `@ciahering.com.br` logado pelo **Google** e
   `@arezzo.com.br` pela **Microsoft**; o gate de `auth-change` checava só o
   domínio. Quem clicasse no botão "errado" (ex.: conta `@ciahering.com.br`
   que exista no Entra ID da Arezzo e escolhesse "Entrar com Microsoft")
   passava pelo client e caía num board em branco/erros de permissão, sem
   explicação. Novo `_loginProviderMismatchMsg(user)` recusa já no login e
   diz qual botão usar.
2. **Conta sem e-mail escapava do gate** — a checagem do chamador é
   `if(user.email && !confiável)`, e e-mail vazio (comum em Microsoft sem o
   atributo `mail`) era tratado como "ok". Agora é recusado com mensagem.
3. **A mensagem de recusa nunca chegava a ser lida**: `window._signOut()`
   termina em `location.reload()`, e o texto escrito em `#login-err` antes
   dele sumia junto com a página — vale também pro "Acesso restrito... peça
   ao PO pra adicionar como externo" que já existia. `_rejectLoginAfterReload()`
   guarda a mensagem e `_showLoginNotice()` mostra uma vez no boot seguinte.

Checks de rotina: `node --check` nos 3 blocos `<script>` — OK; função
testada isolada (10 cenários).

### v8.30.775-dev — 2026-10-01 · fix(foto Google): releitura lia o perfil ANTIGO + aviso mentia quando a People API falhava

`/monitorarbugs` nas implementações do dia. Em `window._relerFotoGoogle()`:
(1) `providerData` era lido do objeto de usuário capturado ANTES do popup —
o login devolve um objeto NOVO (`r.user`) com `providerData` já atualizado
pelo Google; a fonte mais fresca era descartada (e `updateProfile()` ia pro
objeto velho). Agora lê/atualiza `r.user` e mantém `window._currentUser` em
sincronia. (2) Se a People API falhasse (provável "API não habilitada" no
projeto do Google Cloud — a única fonte que diz se a foto é avatar padrão),
o toast dizia "o Google devolveu a mesma foto", escondendo que só 2 de 3
fontes foram consultadas; agora diz que a People API falhou e por quê.

### v8.30.774 — 2026-10-01 · Promove pra prod — "🔄 Atualizar minha foto do Google"

Promoção do v8.30.774-dev (pedido: "sobe tudo que tá acumulado pra prod").
Item novo no menu do avatar (só pra quem logou com Google): pede o perfil
de novo ao Google (popup rápido na mesma conta) pra corrigir foto que
aparece como avatar genérico; se o Google confirmar que a conta só tem o
avatar padrão, avisa claramente. Detalhes técnicos na entrada de dev logo
abaixo.

Checks de rotina: `node --check` nos 3 blocos `<script>` — OK;
`diff kanban.html kanban-dev.html` conferido — só as divergências
permanentes de ambiente (favicon, versão/`VERSION_KEY`,
`_faviconDefaultHref`, `force_logout_after`).

### v8.30.774-dev — 2026-10-01 · feat: "🔄 Atualizar minha foto do Google" (releitura forçada direto no Google)

Pedido direto do usuário, retomando o assunto pausado ("tenta resolver
essa questão da foto do Google! não tem como a gente forçar uma
releitura disso?"). O refresh silencioso anterior (`reload()`) só
re-busca o que o Firebase Auth JÁ tem guardado — nunca pergunta de novo
ao Google, só um login de verdade faz isso. Novo item no menu do avatar
(clicar na foto/nome no cabeçalho), só pra quem logou com Google:
abre um popup rápido na MESMA conta pra obter um token OAuth fresco e
consulta o Google direto — People API (`photos[].default` é a única
forma de saber que uma foto é o avatar genérico) e userinfo (`picture`)
— comparando com o `photoURL` salvo. Se houver uma URL melhor, grava via
`updateProfile()` (único jeito de sobreviver a `reload()`) e re-sincroniza
o banco/avatar do cabeçalho. Se o Google confirmar que a conta só tem o
avatar padrão, o toast diz isso claramente (não é erro do Maré Digital).
Relatório completo em `console.table` e `window._ultimoRelFoto`.
`window._relerFotoGoogle()` (módulo) + `atualizarFotoGoogle()` (clássico).

**Limite conhecido**: se o Google só entrega o avatar genérico pra apps
externos (foto visível só dentro da organização), nenhuma releitura
resolve — o caminho definitivo seria upload de foto própria no Maré
Digital (não implementado).

Checks de rotina: `node --check` no módulo e no script clássico — OK.

### v8.30.773 — 2026-10-01 · Promove pra prod — seletor de squad deixa de aparecer ANTES do login

Promoção pontual, validada pelo usuário ("deu bom, pode promover").

**Correção**: a tela de escolha de squad (nomes/emojis de todos os
squads existentes) aparecia ANTES da tela de login, sempre que a URL
não tinha `?squad=` — qualquer visitante, logado ou não, via a lista
inteira. Login agora é sempre a 1ª tela. Quem tem mais de 1 squad
continua vendo um seletor — só que DEPOIS de logar, filtrado só pros
squads que participa (fluxo que já existia, mais correto que o antigo).

Checks de rotina: `node --check` no bloco `<script>` clássico — OK;
balanço de chaves/parênteses bate com o baseline da sessão (braces -1,
parens +4); `diff kanban.html kanban-dev.html` conferido — só as 4
divergências permanentes de ambiente.

### v8.30.773-dev — 2026-10-01 · fix(login): seletor de squad deixa de aparecer ANTES do login

Relato direto do usuário, com print: "no kanban prod, antes da tela de
login vem a tela de escolha de squad... n deveria ser o contrario?".

Causa: `initSquadSelector()` mostrava um seletor com TODOS os squads
existentes assim que a página carregava (`DOMContentLoaded`), sempre
que a URL não tinha `?squad=` — ANTES de qualquer login resolver.
Qualquer visitante, logado ou não, via nome/emoji de squad que nem era
dele.

Fix: removida a exibição pré-login — login agora é sempre a 1ª tela,
com ou sem `?squad=` na URL. O caso de verdade (pessoa com mais de 1
squad, sem squad escolhido na URL) já era coberto por um fluxo melhor
que já existia PÓS-login (`resolveSquadAndShow()` →
`showSquadSelectorFiltered()`): mostra só os squads que a própria
pessoa participa, redireciona sozinho se só tiver 1.

Checks de rotina: `node --check` no bloco `<script>` clássico — OK;
balanço de chaves/parênteses bate com o baseline da sessão (braces -1,
parens +4).

### v8.30.772 — 2026-10-01 · Promove pra prod — login com Microsoft (integração Arezzo)

Pedido direto do usuário: time da Arezzo colabora com a gente, mas usa
Microsoft/Azure AD, não Google Workspace. Pré-requisitos externos já
concluídos pelo usuário (app registrado no Azure AD multitenant,
provider Microsoft habilitado no Firebase Console, `firebase deploy
--only database` publicando as regras novas) — promovido direto pra
deixar o pessoal da Arezzo validar o login já em produção.

**Novidade**: 2º botão "Entrar com Microsoft" na tela de login — aceita
qualquer conta Microsoft de TRABALHO/ESCOLA (conta pessoal continua
bloqueada), com o mesmo fallback de popup→redirect que o login Google
já tinha pra instabilidade do Chrome. `@arezzo.com.br` passa a ter o
mesmo nível de acesso de `@ciahering.com.br` — qualquer squad, não
entra como "convidado"/externo.

**Correção incidental** (mesma investigação da foto do Google): o
avatar do cabeçalho nunca atualizava sozinho depois do refresh
silencioso de foto rodar — só um F5 corrigia. Corrigido junto.

Checks de rotina: `node --check` nos 2 blocos `<script>` reais (module +
clássico) — OK; balanço de chaves/parênteses bate com o baseline da
sessão (braces -1, parens +4); `diff kanban.html kanban-dev.html`
conferido — só as 4 divergências permanentes de ambiente.

### v8.30.772-dev — 2026-10-01 · feat: login com Microsoft (integração Arezzo)

Pedido direto do usuário: time da Arezzo colabora com a gente, mas usa
Microsoft/Azure AD, não Google Workspace — precisava de um 2º jeito de
entrar, "na camada mais segura" (login nativo via provider Microsoft,
não a whitelist manual de "externos" que já existia).

**Login**: 2º botão "Entrar com Microsoft" na tela de login, usando
`OAuthProvider('microsoft.com')` (mesmo SDK modular do Firebase Auth já
usado pro Google) — `tenant: 'organizations'` restringe a contas de
TRABALHO/ESCOLA Microsoft (bloqueia conta pessoal @outlook/@live/@hotmail
na raiz). Mesmo fallback de popup→redirect já existente pro Google
(2 falhas seguidas de popup trocam pra `signInWithRedirect`), com
contador próprio pra não interferir no do Google.

**Domínio confiável**: `@arezzo.com.br` passa a ser tratado exatamente
como `@ciahering.com.br` — acesso a qualquer squad (mesmo nível dos dois
domínios, não entra como "convidado"/externo). Novo array
`TRUSTED_DOMAINS`/`_isTrustedDomainEmail()` centraliza os 3 pontos que
antes checavam só `@ciahering.com.br` na mão (gate de login,
atribuição de papel no 1º cadastro, tela "+ Adicionar externo" — que
agora recusa email de domínio confiável, já que não precisa de
whitelist). `database.rules.json` ganhou a mesma checagem em paralelo
nas 52 regras que já restringiam leitura/escrita a `@ciahering.com.br`.

**⚠️ Pré-requisitos fora do código, antes disso funcionar de verdade**
(nenhum dos dois pode ser feito deste ambiente — sem credencial de
Firebase Console/Azure AD aqui):
1. Registrar um app no Azure AD/Microsoft Entra ID (Azure Portal → Entra
   ID → App registrations → New registration), redirect URI
   `https://hering-onboarding.firebaseapp.com/__/auth/handler`.
2. Firebase Console → Authentication → Sign-in method → adicionar
   provider "Microsoft", colar o Application (client) ID + client
   secret gerados no passo 1.
3. `firebase deploy --only database` (da própria máquina do usuário,
   `firebase-tools` logado) pra publicar o `database.rules.json`
   atualizado — sem isso, mesmo com o login funcionando, a leitura/
   escrita de dados pra `@arezzo.com.br` continua bloqueada pelas regras
   antigas já publicadas no Firebase.

Checks de rotina: `node --check` nos 2 blocos `<script>` reais (module +
clássico) — OK; balanço de chaves/parênteses bate com o baseline da
sessão (braces -1, parens +4); `database.rules.json` validado como JSON
bem formado após a substituição em lote.

### v8.30.771 — 2026-10-01 · Promove pra prod — foto do Google, corrida de escrita em Automações, disparo de impedimento

Lote de 3 correções de bug, todas já validadas pelo usuário em dev
(sem feature nova — bug fix promove direto, sem esperar o lote de
features do dia, conforme a cadência de promoção acordada):

- **Foto do Google "sumida"**: refresh silencioso periódico do perfil
  (`reload(auth.currentUser)` a cada hora, com a aba em primeiro plano)
  — Google mudou o formato da URL de foto e vem descontinuando o
  formato antigo; sessões longas sem relogar nunca re-buscavam o
  perfil sozinhas. Ver v8.30.769-dev.
- **Automação criada podia sumir sem nunca disparar**: `saveAutoRule()`/
  `toggleAutoRule()`/`delAutoRule()` escreviam o array `autoRules`
  inteiro de volta no Firebase (sobrescrita completa) mesmo com um
  listener ao vivo — uma regra criada por outra pessoa/aba na janela
  de corrida era apagada em silêncio. Agora usam `runTransaction()`.
  Ver v8.30.770-dev.
- **Automações de impedimento não disparavam em 2 caminhos do modal**
  (botão "✕ Remover impedimento" e marcar/desmarcar a linha de
  impedimento + 💾 Salvar) — o dado era gravado certinho, só a
  automação/notificação "Impedimento removido"/"Card bloqueado" ficava
  pra trás. Também corrigido: 7 ações de Automação (definir
  prioridade/submarca/canal/tamanho/demandante/padrão/capa) sem o
  guard de no-op, gravando histórico/toast à toa quando a regra
  re-disparava num card já no valor-alvo. Ver v8.30.771-dev.

Checks de rotina: `node --check` no bloco `<script>` principal — OK;
balanço de chaves/parênteses bate com o baseline da sessão (braces -1,
parens +4). Tentativa de criar/empurrar a tag `kanban-v8.30.771` — ver
nota de ambiente sobre 403 se falhar.

### v8.30.771-dev — 2026-10-01 · fix: automações de "Card bloqueado"/"Impedimento removido" não disparavam em 3 caminhos do modal

`/monitorarbugs` em Automações, continuação do fix da corrida de escrita
(v8.30.770-dev). Auditoria comparando todos os `AUTO_ACTIONS` contra o
padrão de "no-op guard" (evitar escrita/toast desnecessários quando a
regra já bate com o estado atual, padrão de `assign_owner`/
`toggle_okr`/2026-09-17) e todos os caminhos que mudam `card.blocker`
contra o padrão já estabelecido em `_doBulkBlockTag()`/
`_doBulkUnblockTag()` (2026-08-27).

**7 ações sem no-op guard** (`set_priority`, `set_submarca`,
`set_canal_venda`, `set_tamanho`, `set_demandante`, `set_padrao`,
`set_cover`): uma regra de Automação re-disparando num card que já
estava no valor-alvo gravava histórico, salvava no Firebase e mostrava
"⚡ Automação aplicada" à toa, toda vez que o gatilho batesse de novo —
mesmo sem nenhuma mudança real no card. Fix: cada `run()` agora retorna
`false` sem mutar quando o valor já bate (mesmo padrão já usado em
`add_tag`/`remove_tag`/`assign_owner`/`toggle_okr`/`apply_fanout`).

**2 caminhos de "impedimento" (modo tag) nunca disparavam a
automação correspondente**, achado mais severo porque atinge uso
comum, não só edge case:
- Botão **"✕ Remover impedimento"** no card (`removeBlockerTag()`)
  salva direto no Firebase sem passar pelo `saveCard()`/autosave —
  nunca fechava o episódio de ⏱️ tempo bloqueado nem disparava
  "Impedimento removido" (automação) ou a notificação pra quem estava
  acompanhando.
- Marcar/desmarcar o impedimento pela linha do modal (checkbox "🚧
  Impedimento") + clicar **💾 Salvar**: essa linha aparece via
  `style.display` direto (não dispara `input`/`change`), então nem o
  autosave pega essa mudança sozinho — o branch de edição manual do
  `saveCard()` já fazia o acerto de tempo bloqueado (`_settleBlockedTag()`),
  mas nunca disparava "Card bloqueado"/"Impedimento removido".
Em ambos os casos, o dado era gravado certinho — só a automação (e, no
caso do botão, também a notificação) ficava pra trás, mesma classe de
bug já corrigida 3x nesta área (assigned/move em 2026-08-26, bulk
actions em 2026-08-27, criação de card em 2026-08-29): existe mais de
um caminho pra mesma mutação, e cada caminho precisa dos mesmos
disparos.

Checks de rotina: `node --check` no bloco `<script>` principal — OK;
balanço de chaves/parênteses bate com o baseline da sessão (braces -1,
parens +4).

### v8.30.770-dev — 2026-10-01 · fix: automação criada podia sumir sem nunca disparar (corrida de escrita)

Relato direto do usuário: Vinicius criou uma automação ("quando migrar
para To Do, adicionar tag de pronto para teste") que nunca chegou a
disparar e sumiu da lista pouco depois.

Causa raiz: `saveAutoRule()`/`toggleAutoRule()`/`delAutoRule()`
escreviam o array `autoRules` LOCAL inteiro de volta no Firebase
(`fbSet`, sobrescrita completa) — mesma classe de corrida já corrigida
em outras áreas (Kudos, Lembretes, Links). Mesmo com um listener ao
vivo sincronizando `autoRules`, existe uma janela entre o eco do
listener e a próxima ação (de outra pessoa, ou de outra aba sua) onde
o array local fica um passo atrás; nesse intervalo, uma regra recém-
criada por alguém é apagada em silêncio pela próxima escrita de
qualquer um.

Fix: as 3 funções passam a usar `runTransaction()` (recalcula sobre o
valor FRESCO do servidor a cada tentativa, mesmo padrão já usado em
`addKudos()`/`addLink()`) — toggle/exclusão casam a regra por `id`
estável, não por índice do array.

Checks de rotina: `node --check` nos 2 blocos `<script>` reais — OK;
balanço de chaves/parênteses bate com o baseline da sessão (braces -1,
parens +3).

### v8.30.769-dev — 2026-10-01 · fix: foto do Google "sumida" — refresh silencioso periódico do perfil

Relato direto do usuário: "tem usuarios q a foto do Google sumiu! la no
google msm, a pessoa ainda ta c a foto". Investigação com diagnóstico ao
vivo (script de console lendo `kanban/usuarios_publicos` e testando cada
URL de foto) confirmou a causa: o Google trocou o FORMATO da URL de foto
de perfil — de `.../a-/ALV-Uj...` (antigo) pro atual `.../a/ACg8oc...` —
e vem descontinuando o formato antigo aos poucos. A URL salva no Firebase
pra quem registrou a conta há mais tempo ainda era a antiga, e parou de
resolver.

Não é um bug de dado perdido: o campo `foto` sempre esteve correto no
Firebase, só desatualizado. O SDK do Firebase Auth só re-busca
displayName/photoURL do Google numa autenticação de verdade (popup/
redirect) — numa sessão restaurada (quem mantém a aba aberta por dias
sem relogar), esses campos ficam congelados no valor capturado da última
vez, mesmo com o Google tendo atualizado a URL do lado dele havia tempo.

Fix: `window._reloadAuthUser()` (usa `reload()` do SDK, oficial, sem
popup/sem pedir permissão de novo) + `_syncAuthProfileToFirebase()`
(auto-cura de foto/nome/email, extraída de dentro de `autoRegistrar()` —
mesma lógica de antes, só reutilizável) rodando a cada 1h, só com a aba
em primeiro plano e alguém logado — cobre sessões longas, não só o
momento do login.

Checks de rotina: `node --check` nos 2 blocos `<script>` reais — OK;
balanço de chaves/parênteses bate com o baseline da sessão (braces -1,
parens +3).

### v8.30.174 e anteriores
Base antes desta leva de trabalho. Ver `git log -- kanban.html` pro
histórico completo (sem tags/changelog retroativo).


## favicon.png / favicon-monochrome.png (assets compartilhados — raiz do domínio, sem versão própria em `version.json`)


## Service Worker — `firebase-messaging-sw.js` (raiz do domínio, sem versão própria em `version.json`)


## Cloud Function — `weeklyBackup` (`functions/backup/weeklyBackup.js`, sem versão própria em `version.json`)


## Cloud Function — `metasLembretes` (`functions/metas/lembretes.js`, sem versão própria em `version.json`) — 2026-10-12 · NOVA (ainda não publicada)
Agendada a cada 15 min (`America/Sao_Paulo`): lembra de **preencher o valor das metas/desafios** ("O mar tá pra peixe") conforme o `lembrete` de cada meta (a cada 1–4 h, 1× por dia, horários exatos). Escreve notificações `meta_lembrete` (sino + push) pros responsáveis marcados — ou PO/Organizadores da squad, ou ADMs no Digital. Não avisa meta inativa, fora do período, batida ou atualizada há pouco; interruptor `kanban/config/metas_lembretes_off`. Escaneia os nós de produção e `_dev`. Deploy: `firebase deploy --only functions:metasLembretes,functions:sendPushOnNotification` (a 2ª por causa do `PUSH_TYPES`) + `firebase deploy --only database`. Detalhes na entrada "⏰ Metas: lembretes de preenchimento" acima.


## Cloud Function — `sendPushOnNotification` (`functions/index.js`, sem versão própria em `version.json`)

### 2026-10-07 — push de @menção do OKR (`okr_mencao`) + push do aviso novo do Mural (`sendPushOnMural`)

Pedido direto: "inclui o push dos avisos de menção e Mural". (1) **`okr_mencao`** entra em `PUSH_TYPES` (é uma notificação pessoal, então o gatilho de sempre cuida). (2) **Link do push do OKR**: antes todo push — inclusive `okr_editado`/`okr_prazo`/`okr_agente` — abria o **kanban**; agora tipos `okr_*` abrem a **página do OKR** (`okr.html?okr=notas` pra menção, `?okr=chat` pro Agente, `?okr=<objetivo>` pros demais) — `functions/common/pushUrl.js`. A tag do push dos `okr_*` sem card inclui o id da notificação (duas menções seguidas não se substituem mais), e o clique no push reaproveita uma aba que já está na página de destino (`firebase-messaging-sw.js`) — não "sequestra" mais a aba do kanban pra abrir o OKR. (3) **Aviso do Mural**: o aviso é 1 evento em `kanban/notif_feed` (sem notificação por pessoa), então nasceu uma função nova, **`sendPushOnMural`** (`functions/okr/pushMural.js`), disparada quando um evento `tipo:'mural'` é criado: manda 1 push por pessoa (todos os aparelhos) com a mesma regra de quem vê do sino — ADM, torre ⭐ Geral e quem é da torre alvo (sem o campo `torre` = Digital), "todas as torres" vai pra todo mundo — nunca pro autor, respeitando o Não Perturbe e só pra quem ativou push; remove tokens mortos; a falha de uma pessoa não derruba as outras. Quem existe vem de `usuarios_publicos` (não lê `kanban/usuarios` inteiro). "Objetivo criado"/"Marco concluído" **continuam só no sino** (seria barulho demais). Link do push: `okr.html?mural=<id>` (o deep link só abre o aviso depois que a okr-dev v2.10+ for promovida pra `okr.html`; até lá o push abre a página). Testes: 14 novos (`pushMural` + `pushUrl`), suíte 626 ok. **Deploy manual**: `firebase deploy --only functions:sendPushOnNotification,functions:sendPushOnMural`.


## Cloud Function — `contarComentarios` (`functions/comentarios/contagem.js`, sem versão própria em `version.json`)

### 2026-10-05 · nova: mantém `card_comments_count/{cardId}` (indicador 💬 do card)

Gatilho `onValueWritten` em `kanban/squads/{squadId}/dados/card_comments/{cardId}/{commentId}` (um só pra
todos os squads — só conta, diferente dos gatilhos do orquestrador, que são por squad por causa de custo de
chamada ao modelo). Recalcula lendo os filhos (idempotente) e grava/remove o índice. Detalhes e motivação em
`kanban-dev.html` v8.30.780-dev. **Deploy isolado:** `firebase deploy --only functions:contarComentarios`.


## Cloud Functions públicas — identidade do rate limit + redirect do Spotify (`functions/common/clientIp.js`, `functions/intake/submit.js`, `functions/agente-agil/http.js`, `functions/spotify/oauth.js`)

### 2026-10-05 · fix(segurança, /monitorarbugs "áreas sensíveis")

**1. Rate limit contornável por cabeçalho (`intakeSubmit` e `agenteAgil`).** A chave de
IP era `req.headers['fastly-client-ip'] || req.headers['x-forwarded-for']` com
`split(',')[0]` — os dois são escolhidos pelo CLIENTE. O formulário chama
`us-central1-hering-onboarding.cloudfunctions.net/intakeSubmit` direto (sem o
Firebase Hosting/Fastly na frente) e o Google só ACRESCENTA o IP real no fim do
`x-forwarded-for`. Mandar um valor novo a cada requisição dava uma chave nova a cada
vez: o limite de 5 envios/hora do formulário público (sem CAPTCHA — cada envio ainda
notifica/dispara push pro squad inteiro) e o de 20 tentativas/hora de autenticação do
Agente Ágil eram contornáveis com um cabeçalho. Novo `common/clientIp.js`: ignora
`fastly-client-ip`, usa a entrada MAIS À DIREITA de `x-forwarded-for` (a do Google) e
pula endereços internos. Teto por SQUAD (40/hora, independente de IP) no
`intakeSubmit` como backstop que não depende de nenhuma suposição sobre cabeçalho.
Testes rodando o handler REAL (fakes de `firebase-functions`/`firebase-admin`, db com
`transaction()` de verdade): 20 requisições com `x-forwarded-for` diferente a cada
uma — antes 20/20 passavam, agora só 5; 3 dos 4 testes novos falham no código antigo.

**2. Redirecionamento aberto em `spotifyOauthCallback`.** `returnUrl` é gravado pelo
cliente em `kanban/oauth_pending/{state}` (a regra só exige `uid === auth.uid`) e a
function fazia `res.redirect(pending.returnUrl + …)` sem validar. Qualquer conta
autenticada podia gravar um `returnUrl` qualquer e mandar um link
`…cloudfunctions.net/spotifyOauthCallback?state=X&error=1` que devolve 302 pra onde ela
quisesse, a partir de um domínio confiável. Novo `isAllowedReturnUrl()` (`_shared.js`):
só `https://caiosoares1899.github.io`, sem credenciais embutidas. A function segue no ar
mesmo com o Spotify pausado.

Suíte `functions/`: 536/536 (521 + 15 novos). **⚠️ Requer deploy manual**:
`firebase deploy --only functions:intakeSubmit`, `functions:agenteAgil` e
`functions:spotifyOauthCallback` (resincronizar o clone antes — ver `CLAUDE.md`).


## Cloud Function — `intakeSubmit` (`functions/intake/submit.js`, sem versão própria em `version.json`)


## Cloud Functions — Spotify (`functions/spotify/`, sem versão própria em `version.json`)


## Cloud Functions — Agente Ágil (orquestrador + chat do Radar) — 2026-10-10 · conhecimento atualizado: cisão com a Arezzo, família Oceano e funcionalidades novas
Pedido: "atualizar o agente sobre a cisão com a Arezzo, voltar a dar conhecimento sobre o código e suas atualizações, o Oceano e as funcionalidades novas". Diagnóstico: a ferramenta `biblioteca_agil` (a base de conhecimento do orquestrador de cards) tinha 16 verbetes escritos à mão e parados desde agosto — nada de Meu Dia, Automações, Pausar, Contínuo, Raias, Canal, Dicas, Central de Notificações, Oceano/Radar; o prompt do orquestrador nunca soube que o Maré virou só-Hering. (O chat do Agente Ágil no Radar já conhecia torre única/Radar/atingimento desde 07–08/10.)
- **Base de conhecimento GERADA das páginas** (`functions/agente-agil-orquestrador/conhecimento/`, `npm run conhecimento`): `ajudaMare.json` (122 verbetes, o `HELP_CONTENT` de `kanban.html`), `ajudaRadar.json` (40, a Ajuda do Radar de `okr.html` — já sem o que o modo só Hering esconde: torres, login Microsoft), `ajudaOceano.json` (14, o FAQ de `oceano.html`) e `novidades.json` (30 entradas de produção do `CHANGELOG.md`, sem as "SÓ DEV"). Nunca mais escrita à mão.
- **`biblioteca_agil` ganhou `busca`** (palavras-chave, sem acento/maiúscula, com radical): devolve até 5 verbetes completos (Ajuda do Maré/Radar/Oceano, conceitos ágeis, família Oceano, novidades — estas com peso menor); sem `busca` devolve só os conceitos, a família Oceano, o ÍNDICE de toda a Ajuda e as novidades mais recentes (~15 KB, não os 180 KB).
- **Família Oceano + cisão** (verbetes curados): o que é Maré/Painel/Radar/A Bordo/Oceano; **"Maré só Hering"** (login só Google @ciahering.com.br, OKR de uma torre só — Digital, @menção só @ciahering; Arezzo/Microsoft/torres Comercial e Corporativa desligadas por interruptor, não apagadas); Radar (Objetivos, Marcos, atingimento); Painel + Central de Notificações; sino único e Não Perturbe; Dicas (1 por dia por app).
- **Prompt do orquestrador** (`systemPrompt.js`, nota 11): nova seção "Contexto do produto" (família Oceano, só Hering, dizer "Radar") e o bullet de `biblioteca_agil` explica `busca`, o índice e "se não cobrir, diga que não sabe".
- **Chat do Radar** (`okr/`): nova ferramenta de LEITURA `consultar_ajuda` (mesma base) + linha no prompt — responde "como faço…/onde fica…/o que mudou" sem inventar.
- **Anti-drift:** `conhecimento.test.js` FALHA se qualquer `ajuda*.json` ficar diferente do HELP_CONTENT/okr.html/oceano.html, ou se a novidade mais recente do CHANGELOG não estiver em `novidades.json` → quem mexer na Ajuda precisa rodar `npm run conhecimento` (passo novo nas skills `/atualizarhelpcontent` e `/subirproprod`).
- **Testes:** `functions/` 753/753 (eram 740). ⚠️ **Exige deploy** (resincronizar o clone antes): `firebase deploy --only functions:agenteAgilMencao,functions:agenteAgilMencaoDados,functions:agenteAgilIntake,functions:agenteAgilAnalisePO,functions:okrAgenteChat` — os JSON entram no pacote; a Cloud Function não lê o repositório em tempo de execução.


## Cloud Function — Agente Ágil — 2026-10-08 · tier `haiku` passa pro Haiku 5.5

Confirmado em produção que o Sonnet 5.5 funciona (🌅 Meu dia). Agora o tier `haiku` (perguntas conceituais curtas, ex.: "@Agente Ágil o que é WIP?") vai de `claude-haiku-4-5-20251001` pra **`claude-haiku-5-5`**, com a mesma rede de segurança do Sonnet: se a API recusar o id (404/400 de "model"), repete 1x com o Haiku 4.5 e usa ele direto naquele processo. Só afeta quem classifica por texto: `agenteAgilMencao`, `agenteAgilMencaoDados`, `okrAgenteChat`, `agenteAgilIntake` (os demais passam texto vazio → sempre Sonnet). 2 testes novos (685 no total, 684 passam). **Deploy**: `firebase deploy --only functions:okrAgenteChat,functions:agenteAgilMencao,functions:agenteAgilMencaoDados,functions:agenteAgilIntake` (depois do resync).


## Cloud Function — Agente Ágil (todos os fluxos) — 2026-10-08 · passa pro Sonnet 5.5

Pedido direto. `DEFAULT_MODEL` (`functions/agente-agil-orquestrador/llmClient.js`) vai de `claude-sonnet-5` pra **`claude-sonnet-5-5`** — como todo fluxo do agente passa por `escolheClienteParaTarefa()`, o tier `sonnet` (o padrão) muda de uma vez em: `agenteAgilMencao`/`agenteAgilMencaoDados` (@menção nos cards), `okrAgenteChat` (Central do OKR), `agenteAgilIntake`, `agenteAgilResumoMeuDia`, `agenteAgilAnaliseDados`, `agenteAgilAnalisePO`. Os tiers `haiku` e `opus` não mudaram. **Rede de segurança**: se a API recusar o id (404, ou 400 falando de "model"), o cliente repete a chamada UMA vez com `claude-sonnet-5` e passa a usá-lo direto naquele processo (log `[llmClient] modelo … indisponível`) — o agente nunca fica mudo por causa de um id de modelo; erro de outro tipo (429/5xx/400 comum) continua estourando normalmente, e modelo escolhido à mão (haiku/opus) não tem fallback. 5 testes novos (683 no total, 682 passam). **Precisa de deploy**: `firebase deploy --only functions:okrAgenteChat,functions:agenteAgilMencao,functions:agenteAgilMencaoDados,functions:agenteAgilIntake,functions:agenteAgilResumoMeuDia,functions:agenteAgilAnaliseDados,functions:agenteAgilAnalisePO` (depois do resync do clone local).


## Cloud Function — `okrAgenteChat` (`functions/okr/`) — 2026-10-07 · o Agente Ágil do OKR passa a conhecer torres, gerências, calendário, trava e sino

**Requer `firebase deploy --only functions:okrAgenteChat` (resync do clone antes, ver `CLAUDE.md`).** O agente do chat do OKR ainda era o de antes das torres: o `area_id` era um enum fixo das 7 gerências originais (gerência nova de uma torre era impossível, `geral` era ambíguo), criava Objetivo sempre sem `torre` (= Digital), só deixava ADM criar e só o Responsável/ADM editar (a UI já deixava PO/Organizador/🎯 Gestor OKR na própria torre), não sabia da 🔒 trava de edição (uma escrita dele no meio da edição de alguém era apagada pelo "Salvar" da pessoa), não avisava o 🔔 sino e não enxergava o calendário.
- **Permissão por torre** (espelho de `_okrCanEdit`/`_okrCanCreate`): ADM em tudo; PO/Organizador/Gestor OKR só na própria torre (⭐ Geral em todas); Responsável sempre no seu. `criar_objetivo` ganhou `torre` (sem informar vale a da pessoa) e valida a gerência contra a torre (`gerencia_invalida`/`gerencia_oculta`); `editar_campos_okr` valida a gerência na torre do Objetivo e grava o NOME no histórico.
- **Ferramentas novas só de leitura:** `listar_gerencias` (por torre, com "oculta") e `listar_agenda` (próximas ocorrências do calendário, global + torres; filtros torre/Objetivo/`evento_id` com descrição e pauta; mesmo escopo da pauta da tela). `listar_objetivos`/`resumo_atingimentos` filtram por torre; `ler_objetivo` traz torre, gerência, tags e quem está editando.
- **🔒 Trava respeitada:** com trava viva de OUTRA pessoa o agente devolve `objetivo_em_edicao` (com o nome) e não grava — em `editar_campos_okr`, `criar_marco`, `editar_marco`, `registrar_atingimento` e `configurar_atingimento`.
- **🔔 Sino:** criar Objetivo e concluir um Marco (uma vez só) publicam no `kanban/notif_feed`, igual aos ganchos da tela.
- Prompt: bloco novo "Torres, gerências e agenda". O agente **não** ganhou escrita no calendário (criar/convidar/cancelar é pela tela) — decisão deliberada.
Testes: `agenteTorres.test.js` (17 casos: permissão por torre, gerência por torre, trava, feed, agenda) + `calendario.js` `recTexto()`; o filtro `area_id` desconhecido agora devolve 0 resultados em vez de erro de schema (teste ajustado). Suíte 677/677 (1 pulado).


## Cloud Function — `okrWeeklySnapshot` — 2026-10-07 (Torres): o snapshot grava a torre

**Requer `firebase deploy --only functions:okrWeeklySnapshot` (resync do clone antes, ver `CLAUDE.md`).** Cada Objetivo do snapshot semanal ganha `torre` (`digital`/`comercial`/`corporativa`; sem o campo ou inválido = `digital`) — o Histórico da visão global do OKR usa pra manter um Objetivo apagado/movido na torre certa. Campo novo e opcional: o client antigo ignora e o novo cai na torre atual do Objetivo enquanto o deploy não sai (snapshots antigos também não têm). +1 teste (16/16 no arquivo).


## Cloud Function — `okrDailyScan` — 2026-10-07 (gerências configuráveis): só as gerências ORIGINAIS têm bloco quinzenal

**Requer `firebase deploy --only functions:okrDailyScan` (resync do clone antes).** Com gerências criadas pelas torres, uma `areaId` nova caía no fallback "bloco 2" e a responsável recebia "reunião amanhã" de uma reunião que não existe pra ela. Agora a véspera só vale pras áreas de `OKR_BLOCO_AREAS` (sem `areaId` = `geral`). +1 teste.


## Cloud Function — `okrDailyScan` (`functions/okr/dailyScan.js`) — fix 2026-10-07 (Torres)

**Sem versão própria — requer `firebase deploy --only functions:okrDailyScan` (resync do clone antes, ver `CLAUDE.md`).** A "véspera da reunião de bloco quinzenal" notificava os responsáveis de TODO Objetivo ativo; os blocos (CX/Tech/CRM…) são da torre Digital, então Objetivos de Comercial/Corporativa (`areaId:'geral'`, que cai no bloco 1) recebiam "Reunião de X é amanhã" de uma reunião que não é deles. Agora pula `torre` ≠ digital (sem o campo = Digital, compatível com tudo que já existia). Prazo de marco segue em qualquer torre. +2 testes; 2 testes antigos (`marco … notifica`) dependiam da data real de hoje (falhavam na véspera de uma quinta de bloco) e passaram a filtrar por tipo; `atingimento.test.js` comparava o motor com `painel-dev.html`, de onde o OKR saiu na v5.0 (falhava desde então) — agora compara com `okr-dev.html`/`okr.html` ignorando linhas em branco. Suíte 604/604.


## Cloud Function — `okrWeeklySnapshot` (`functions/okr/weeklySnapshot.js`, sem versão própria em `version.json`)


## Cloud Function — `okrAgenteChat` (`functions/okr/agenteChat.js`, sem versão própria em `version.json`)

### 2026-10-05 — Agente Ágil passa a LER e ATUAR no 📈 Atingimento dos Objetivos (`functions/okr/`)

Pedido (pendência do release do Atingimento): o chat de OKR do Agente Ágil só conhecia marcos; agora conhece a meta de cada Objetivo.
- **Leitura**: `ler_objetivo`/`listar_objetivos` devolvem o **% da barra** (`progresso_pct`) e **de onde ele vem** (`progresso_origem`: atingimento ou marcos) e `ler_objetivo` traz o **atingimento** (tipo, moeda, inicial, meta, valor atual, % e últimos 5 registros). Ferramenta nova **`resumo_atingimentos`**: visão geral de todos os Objetivos com meta (% atual, meta, valor, último registro e há quantos dias), com filtro por gerência e por **"sem registro há N dias"** (inclui quem nunca registrou).
- **Atuação**: **`registrar_atingimento`** (valor, `atingido` no tipo binário, `data` da entrega no tipo Data de entrega, nota; data padrão = hoje em São Paulo) e **`configurar_atingimento`** (tipo, moeda, valor inicial, meta, faixas de data; inclui ♾️ Perene). Mesma regra de permissão do painel (ADM ou Responsável do Objetivo). O registro entra por **transação sobre a lista** (quem registra pelo painel ao mesmo tempo não é sobrescrito) e a configuração por `update()` (nunca apaga registros). Grava 📜 Histórico no mesmo formato do painel (`registrou atingimento de DD/MM/AAAA: … → N% (via chat)`, `configurou o atingimento (…)`, `alterou a meta/tipo…`), avisa Responsáveis/participantes (`okr_editado`) e marca `por:'🤖 Agente Ágil'` + `pedidoPor` (uid de quem pediu).
- **Salvaguardas**: nunca inventa valor/meta/data (o prompt manda perguntar); **trocar o tipo** de um atingimento que já tem registros exige `confirmar_recalculo` depois de perguntar à pessoa; o agente **não apaga registro nem remove atingimento** (só pela tela do Objetivo); Perene não aceita registro (a barra anda pelos marcos); entrada validada com zod dentro do handler (o loop não valida).
- **Mesmo %, sempre**: `functions/okr/atingimento.js` contém uma **cópia literal** do motor de cálculo do painel (bloco `ATING-ENGINE`); `__tests__/atingimento.test.js` falha se divergir de `painel-dev.html`/`painel.html` e compara 1.000 casos aleatórios (8 tipos) entre o motor do painel e o do servidor.
- **`okrWeeklySnapshot`**: o `progressoPct` de cada Objetivo no snapshot passa a seguir a mesma conta da barra (atingimento quando há meta, senão marcos) + campos novos `atingimentoTipo`/`atingimentoPct`/`atingimentoRegistros` (o histórico do painel ignora o que não conhece).
- Testes: `agenteAtingimento.test.js` (28 casos: leitura, registrar por tipo, configurar, permissões, dryRun, concorrência, histórico, notificação), 2 ponta a ponta no `agenteChat.test.js` (pedido em texto → ferramentas → resposta) e 2 no `weeklySnapshot.test.js`. Suíte de `functions/`: **601/601** (era 521).
- **Requer redeploy manual** (resync antes, ver `CLAUDE.md`): `firebase deploy --only functions:okrAgenteChat` e `--only functions:okrWeeklySnapshot`. Sem mudança em `database.rules.json`.


## okr-apresentacao.slide.html (raiz do domínio, sem versão própria em `version.json`)

### 2026-10-06 (6ª) · Detalhe do Objetivo: texto que passa da área rola, em vez de diminuir a letra

Pedido direto: a letra do rodapé (Progressos / Próximos passos / Riscos / Planos de ação) e da tabela de Marcos encolhia sozinha quando o texto não cabia, e ficava pequena
demais no telão. Agora **a fonte mantém o tamanho e a área rola** (barra de rolagem visível). Vale para a tabela de Marcos, as 4 colunas do rodapé e a raia da esquerda
(Objetivo/Responsável/Indicadores). O piso de 30% da altura para o rodapé continua; o cabeçalho STATUS/PRAZO ganha o mesmo recuo da barra de rolagem para seguir alinhado com as linhas.
Conteúdo curto não ganha barra. Testado no Chromium em 1366x768, 1920x1080 e 1280x720 (muitos Marcos, rodapé longo, tudo longo, curto): fonte 15px/14px intacta, alinhamento 0px,
primeiro Marco visível, nada vaza da tela. O carrossel de slides continua com o ajuste automático.

### 2026-10-06 (5ª) · fix(/monitorarbugs): filtro por tag fechava o dropdown em atualização ao vivo

Auditoria do filtro por tag/botão Anterior feitos minutos antes. `rebuild()` roda a cada atualização ao vivo do Firebase (a equipe
editando o painel durante a reunião) e `_okrAtualizaFiltroTag()` reescrevia o `innerHTML` do `<select>` toda vez — com o dropdown aberto,
ele fechava no meio da escolha. Reproduzido no Chromium (o `<option>` era um nó novo a cada rebuild). Agora só reescreve quando as opções
mudam de verdade (assinatura do conteúdo); contagem nova ainda atualiza. Checado também: barra superior não estoura a largura em
1366 e 1024 px com o filtro. Sem versão própria (vale no deploy).

### 2026-10-06 (4ª) · feat: botão "← Anterior" no detalhe do Objetivo + filtro por tag na barra

Pedido direto (manhã da reunião de OKR): alguém vai pegar alguns Objetivos desta apresentação pra preencher outra, e vão ser marcados com
uma tag.
- **← Anterior** ao lado de "Próximo →" no detalhe do Objetivo (mesma ordem da grade; desabilitado no primeiro da gerência).
- **🏷️ Filtro por tag** na barra superior (só aparece quando há tag em uso; lista só tags em uso, com a contagem). Vale pra tudo: capa
  (contagens e aviso "Filtrando pela tag…"), grade das gerências (gerência sem Objetivo com a tag some), panorama e o Anterior/Próximo do
  detalhe. "Todas as tags" desfaz; tag apagada no painel com o filtro ligado limpa o filtro; só em memória (reabrir volta pra todas).
  Setas/espaço com o foco no filtro mudam a opção em vez de trocar de slide.
- As tags já apareciam nos cards da grade (v3.108/3.109); nada mudou ali. Não há tag no detalhe, como pedido.
Testado no Chromium (16 cenários: contagens, ordem manual, Anterior/Próximo pulando quem não tem a tag, teclado, tag apagada, sem resultado).
Sem versão própria (vale no deploy).

### 2026-10-06 (3ª) · fix: colunas STATUS/PRAZO da tabela de Marcos desalinhadas do cabeçalho

Relato direto: em alguns Objetivos as linhas dos Marcos ficavam coladas à esquerda, fora de alinhamento com o cabeçalho
STATUS/PRAZO. Só acontecia nos Objetivos com Marcos suficientes pra tabela precisar encolher (≥14 em 1366x768): `_zoomFitToHeight()`
ligava `align-self:start` ANTES de medir a largura, e como a tabela é item de um flex em coluna isso encolhia a largura pro
conteúdo (767px contra 908px do cabeçalho em 1366x768; Δ de 139px no STATUS). Agora a largura é medida antes de mexer no estilo, e o
cabeçalho acompanha o zoom das linhas (as colunas de 160/95px encolhem juntas). Medido em 1366x768, 1920x1080 e 1280x720 com 3 a 24
Marcos (nomes longos): 9 de 18 casos desalinhados antes, 0 depois. Sem versão própria (vale no deploy).

### 2026-10-06 (2ª) · fix(/monitorarbugs): rodapé do detalhe do Objetivo ilegível com muitos Marcos

No modal de detalhe, rodapé (Progressos / Próximos passos / Riscos / Planos de ação) e corpo (Marcos + raia esquerda)
dividiam o aperto proporcionalmente ao tamanho natural — um Objetivo com muitos Marcos (≥14 em 1366x768, ≥24 em
1920x1080) levava o rodapé junto: zoom de 0,66 com 16 Marcos e 0,2 com 24. Agora o rodapé tem um piso (o menor entre
o tamanho natural e 30% da altura da tela) e quem cede é a tabela de Marcos, que já encolhia sozinha. Medido em
1366x768: rodapé 93→111 px com 16 Marcos e 68→111 px com 24, sem zoom nas listas; tabela 0,81→0,79 e 0,55→0,50.
Objetivos com poucos Marcos ficam exatamente como antes. Sem versão própria (vale no deploy).

### 2026-10-06 · fix(/monitorarbugs): a apresentação ignorava a ordem manual dos Objetivos

Na aba 🎯 OKR do painel dá pra reordenar os Objetivos de uma Gerência (▲/▼ ou arrastar), e o painel respeita
essa ordem (`ordem` numérico). A apresentação, porém, sempre ordenava por título (alfabético) — então a
sequência dos slides, a grade de cards e o botão "Próximo objetivo" saíam diferentes da que o time montou pra
reunião. Agora usa a mesma regra do painel: com algum `ordem` definido ele manda (quem ainda não tem vai pro
fim); sem nenhum, continua alfabético. Grade e "Próximo objetivo" usam a mesma função, então seguem a mesma ordem.
Sem versão própria (página de prod sem `-dev`): vale assim que o deploy do Pages terminar.

### 2026-10-05 · fix(segurança, /monitorarbugs): ids crus em handler inline

4 ids (`o.id`, `nextObj.id`, `m.id`, `id` da anotação) entravam direto em
`onclick="window._okr…('${x}')"` — sem `esc()` e, mesmo com `esc()`, escapável (ver
kanban-dev.html v8.30.779-dev). Objetivos, Marcos e anotações são gravados por
qualquer pessoa da empresa e lidos por quem abre a apresentação. Agora
`onclick="…(${jsq(x)})"`. 3.012 textos hostis no Chromium, 0 falhas. Mesma correção em
`onboarding.slide.html` (`deleteCard(${jsq(key)})`, helper próprio — a página não tem `esc()`).

### 2026-10-01 (3ª rodada) — fix: comentários do Marco podiam aparecer sob o Marco errado

`/monitorarbugs` nas implementações do dia. `_okrOpenMarcoComments()` lê
`marco_comments/{id}` de forma assíncrona e a resposta nunca checava se
ainda era a do Marco aberto: clicar em outro Marco (ou fechar e reabrir)
antes da 1ª leitura voltar fazia a resposta ATRASADA sobrescrever a lista,
sob o título do Marco novo. O `if(!list) return` "painel fechado" nunca
disparava (`#mc-list` sempre existe). Agora `_mcCurrentId` descarta
respostas de aberturas antigas.

### 2026-10-01 (2ª rodada) — Novidade: descrição do Marco agora aparece na tabela

Pedido direto do usuário: "o pessoal quer q apareça tambem a descrição
do marco na apresentação".

Cada linha de Marco, na tabela "Marcos ou atividades macros" do
detalhe do Objetivo, ganhou uma 2ª linha opcional logo abaixo do nome
— texto menor, cor mais apagada (`--txt3`) — com `m.descricao`, quando
o Marco tiver uma preenchida. Quebra de linha normal (mesmo padrão já
usado no nome do Marco), não corta nem trunca. Marco sem descrição
continua mostrando só o nome, sem espaço extra.

Checks de rotina: `node --check` nos 2 blocos `<script>` — OK; balanço
de chaves do arquivo inteiro (0, igual ao baseline anterior).

### 2026-10-01 — Novidade: clicar num Marco mostra os comentários feitos nele

Pedido direto do usuário: "na apresentação de okr, o marco deveria ser
clicável e mostrar os comentários feitos".

Dentro do detalhe de um Objetivo, cada linha de Marco agora é
clicável — abre um painel lateral (mesmo estilo visual do já existente
"📋 Anotações da reunião") listando os comentários já feitos nele
(autor, foto, data/hora, texto), lidos direto de
`kanban/okr/marco_comments/{marcoId}` — o mesmo lugar onde
`painel.html` já grava comentários no modal do Marco. É só leitura
aqui: comentar de verdade continua sendo feito no painel; esta tela é
pra quem está acompanhando a apresentação ver o que já foi dito sem
precisar abrir outra aba.

Checks de rotina: `node --check` nos 2 blocos `<script>` (module +
clássico) — OK; balanço de chaves/parênteses do arquivo (braces 0,
parens +1).


## okr.html / okr-dev.html (página própria do OKR)

### ✏️ Radar: editar o próprio comentário do Marco — 2026-10-14 · okr-dev v2.76 · okr-dev (SÓ DEV)

Os comentários do Marco só podiam ser enviados — errou uma palavra, ficava assim. Agora cada comentário **seu** tem um ✏️ ao lado da data: abre o texto no próprio lugar com **Salvar** / **Cancelar** (Enter salva, Esc cancela sem fechar o Marco) e o comentário passa a mostrar **· editado**.

- Só o **autor** edita (comentário dos outros não tem ✏️; externo só acompanha). Grava apenas `text` + `editadoEm` — autor, data e ordem não mudam. Texto igual ao atual não regrava; vazio é recusado.
- Comentário apagado por outra pessoa durante a edição não ressuscita (avisa); gravação negada avisa e mantém o campo aberto.
- O que já estava digitado no Marco (nome/descrição/prazo) sobrevive ao abrir/salvar/cancelar a edição.
- Sem mudança nas regras do banco (`kanban/okr` já aceita escrita de qualquer conta @ciahering). Dica: não (o ✏️ está ao lado do comentário, é óbvio na tela). Ajuda do Radar: não cita comentários do Marco, nada a atualizar.

Teste: `docs/arezzo/testes/test_comentario_marco.js` (18 verificações no Chromium, banco falso).

### okr-dev.html v2.42 · okr-dev — 2026-10-08 · fix: edição do OKR no modal — duplo clique em Salvar, "alterações não salvas" falso, texto digitado sumindo, Esc (/monitorarbugs)

Auditoria do modal de edição (Objetivo, ⚙ Configurações e Marco) — todos reproduzidos no Chromium (banco com 300 ms de latência) antes de corrigir:

- **Duplo clique em 💾 Salvar criava duplicata.** O id do Objetivo/Marco NOVO nasce a cada chamada e a gravação é assíncrona: 2 cliques = 2 Objetivos (ou 2 Marcos) e, ao editar um existente, 2 linhas idênticas no 📜 Histórico (+2 notificações). Agora há trava "salvando" (`_okrSalvandoObj`/`_okrSalvandoMarco`) e o botão fica desabilitado enquanto grava. Se a gravação falhar (sem permissão/rede) o modal continua aberto, avisa "Não consegui salvar" e tentar de novo não duplica a linha do histórico.
- **Salvar um Objetivo/Marco apagado por outra pessoa o "ressuscitava".** O Salvar grava o rascunho inteiro por cima do nó; com o item já excluído, ele voltava a existir (e um Marco novo sob Objetivo apagado virava órfão). Agora recusa com aviso.
- **"Você tem alterações não salvas" sem a pessoa ter mexido em nada.** O rascunho era comparado em JSON cru com o que o formulário devolve (`''`/`true`), e o dado antigo não tem `mostrarApresentacao`, responsável, prazo ou descrição: todo Marco anterior ao botão 🎬 (e os criados pelo Agente/duplicados) e todo Objetivo aberto na ⚙ Configurações perguntavam ao fechar. `_okrDirtyStr()` normaliza os dois lados (e ordena as chaves) — mexer de verdade (nome, 🎬, título…) continua perguntando.
- **Texto digitado sumia sozinho.** Três re-renders assíncronos não guardavam antes o que já estava na tela: os **comentários do Marco** chegando (nome/descrição/prazo digitados antes de a leitura voltar eram apagados), **outra pessoa criando/editando uma tag** ou **mexendo nas gerências** com a ⚙ Configurações aberta (título/pilar/descrição), e reordenar Marcos (valor de atingimento digitado). Todos passam a sincronizar o rascunho antes de redesenhar.
- **Esc agora fecha o modal de edição** (era a única janela da página sem Esc), pelo mesmo caminho do ✕ — com o aviso de alterações; Esc dentro da edição de um item da lista só cancela a edição, e as camadas de cima (diálogo, gráfico, ajuda…) continuam fechando primeiro.

Teste: `test_modal_edicao.js` (26 verificações no Chromium; 18 falham no código da v2.41) + script de console em português entregue na conversa.

### okr.html — 2026-10-08 · fix cosmético: o 🎯 aparecia duas vezes na aba (ícone + título)

O ícone da aba já é o 🎯; o título também começava com ele ("🎯 🎯 OKR…"). O título de **prod** passa a ser só "OKR · Maré Digital" (o do dev, "🧪 OKR · Maré Digital · Dev", não repetia o ícone e fica como está). Só texto do `<title>`: sem bump de versão, pra não forçar recarga nas abas abertas — vale no próximo carregamento da página.

### okr.html v2.41 · okr — 2026-10-08 · Promove pra prod — versão sempre visível, painel do Agente por cima dos modais, folga pro botão flutuante

Promove okr-dev v2.41 (prod estava na v2.40): a **versão** passa a aparecer também no menu ⋯ Mais, no título da ❓ Ajuda e no tooltip do botão do Agente; **"💬 Perguntar ao Agente"** com o modal do Objetivo aberto abre o painel por cima do modal (antes ficava por baixo); a página ganha folga embaixo pro botão flutuante não esconder o fim da lista. Sem avisos (Mural/WhatsApp) por decisão do usuário.

### okr-dev.html v2.41 · okr-dev — 2026-10-08 · fix: versão sempre visível + painel do Agente por cima dos modais + folga pro botão flutuante (/monitorarbugs)

Relato direto: "o botão do agente tá em cima do número da versão, não consigo saber qual versão tá". O rótulo do canto é minúsculo (9 px, cinza) e dividia o canto com o botão; agora a **versão aparece em 3 lugares impossíveis de cobrir**: no menu **⋯ Mais** ("ℹ️ Versão vX"), no título da **❓ Ajuda** e no tooltip do botão do Agente — e o rótulo do canto ficou maior e mais claro. A varredura do que foi feito hoje achou mais 2 coisas reais, reproduzidas no Chromium antes de corrigir: (1) **"💬 Perguntar ao Agente"** (menu de contexto do Marco/Objetivo) com o modal do Objetivo aberto abria o painel **por baixo do modal** — parecia não fazer nada; o botão e o painel moravam dentro do `#app-root`, que cria um contexto de empilhamento menor que o dos modais (z-index não adianta ali) — foram pro nível do `body` (aparecem só depois do login) e o painel ganhou z-index acima dos modais, enquanto o botão fica atrás deles; (2) o fim da lista/calendário podia ficar **escondido atrás do botão** flutuante — a página ganhou folga embaixo (6 rem). Teste: 8 cenários (`test_versao_fab`) + regressão.

### okr.html v2.40 · okr — 2026-10-08 · Promove pra prod — Agente Ágil flutuante, ajuda em abas com busca, links em aba nova, faixas das gerências, ocultar Objetivo da apresentação

Promove okr-dev v2.34 → v2.40 (prod estava na v2.33), com `mare-notif.js` v7: **💬 Agente Ágil vira botão flutuante** (sai das abas; painel no canto no computador, tela cheia no celular, selo de resposta nova); **❓ Ajuda do OKR** reorganizada (abas, busca, 18 perguntas frequentes, "🙋 O que eu posso fazer?" por papel); modais do Objetivo/Configurações/Marco repensados pro **celular**; **gerências em faixas alternadas** (dois tons suaves); **🎬 ocultar Objetivo da apresentação** (+ filtro "só incluídos") e **menu de contexto** com Ver histórico/Agendar reunião/Perguntar ao Agente; **links entre páginas abrem em aba nova**. Sem avisos (Mural/WhatsApp) por decisão do usuário.

### okr-dev.html v2.40 · okr-dev + okr-apresentacao.slide.html — 2026-10-08 · 🎬 ocultar Objetivo da apresentação + filtro · menu de contexto com 4 itens novos

**Ocultar Objetivo da apresentação** (o que já existia nos Marcos): campo `mostrarApresentacao` no Objetivo (`false` = oculto; ausente = aparece, então nada muda pros Objetivos atuais). Liga/desliga em **botão direito → 🎬 Ocultar/Mostrar na apresentação** (tecla O, grava por transação e registra no Histórico) ou em **⚙ Configurações → 🎬 Aparecer na apresentação**. O cartão ganha o selo **🙈 fora da apresentação**. **Filtro** novo em **⚙ Mais filtros → 🎬 Apresentação**: todos / só os incluídos / só os ocultos (entra no contador e no "Limpar filtros"). A **apresentação em slides** (`okr-apresentacao.slide.html`, sem cópia dev: vale assim que mergeia) passa a ignorar o Objetivo oculto em TUDO — capa, torres, gerências, panorama, Anterior/Próximo, contadores, filtro de tag — e o `?preview=` de um oculto não abre; o 👁 do cartão e o "Ver na apresentação" do menu avisam em vez de abrir. No OKR o Objetivo oculto segue igual (lista, Dashboard, calendário).

**Menu de contexto** (auditado; ficaram os que mais economizam clique): Objetivo ganhou **🎬 Ocultar/Mostrar na apresentação (O)**, **📜 Ver histórico (H)** (abre o Objetivo já na seção), **📅 Agendar reunião sobre este Objetivo (M)** (abre o editor de evento já com o Objetivo vinculado, a torre e o título — só ADM/organizador da torre) e **💬 Perguntar ao Agente sobre este Objetivo (G)** (abre o painel flutuante com a frase pronta); Marco ganhou **💬 Perguntar ao Agente sobre este Marco (G)**. Itens sem permissão ficam apagados com a explicação (Membro: não oculta nem agenda; visualizador: nada disso). Ajuda do OKR (menu, filtros, FAQ, apresentação) atualizada. Teste: 22 cenários (`test_obj_apres`: papéis, filtro, config, Histórico, apresentação) + regressão.

### okr-dev.html v2.39 · okr-dev — 2026-10-08 · 💬 Agente Ágil vira BOTÃO FLUTUANTE (sai da barra de abas)

Pedido direto (usabilidade): o agente deixa de ser uma aba e vira um botão flutuante no canto inferior direito, disponível em qualquer tela. **Computador**: abre um painel no canto (410 px) que **não bloqueia a página** — dá pra consultar Objetivos/Calendário enquanto conversa; Esc (com o foco no painel) e ✕ fecham. **Celular**: botão redondo de 56 px (só o ícone) e folha em **tela cheia** (caixa em 16 px, sem roubar o foco pra não pular o teclado, respeita a safe-area). **Selo vermelho** com respostas novas **dirigidas a você** (a conversa é compartilhada: respostas às perguntas de outras pessoas não acendem o selo; 1º acesso no aparelho não mostra o histórico antigo como "novas"; abrir o painel zera). **"🤖 pensando…"** enquanto o agente não responde (some sozinho em 90 s). **Atalhos de pergunta** (📈 atingimentos · ⏰ sem registro · 📅 pauta · ✍️ contar uma novidade) só preenchem a caixa. Texto "ℹ️ O que ele faz" recolhido no cabeçalho do painel. Visualizador externo continua só lendo (caixa e Enviar desabilitados). `?okr=chat`, o clique na notificação `okr_agente` e `_okrSetView('agente')` (legado) abrem o painel sem trocar de tela. O rótulo de versão foi pro canto esquerdo. Ajuda do OKR e `maredigital.html` atualizados; o `guia-okr.html` (compartilhado, sem cópia dev) **fica pra promoção** — o prod ainda tem a aba (pendência registrada no `CLAUDE.md`). Teste: 25 cenários no Chromium (`test_agente_fab`) + `test_okr_head` ajustado pra 4 abas.

### okr-dev.html v2.38 · okr-dev — 2026-10-08 · 🎨 faixas das gerências um pouco mais visíveis (escuro e Vice City)

Feedback: no tema escuro e no Vice City a diferença entre as faixas alternadas ficou suave demais pra perceber. Escuro: ~13% / 3% (era 5,5% / 1,6%). Vice City: ~20% / 5% **mais um contorno fino** (inset, sem mexer no layout) — o fundo do Vice é um degradê forte (laranja no meio, roxo embaixo), então só o tom some em alguma altura da tela; o contorno mantém a divisão visível em qualquer parte. Claro e visão global inalterados.

### okr-dev.html v2.37 · okr-dev — 2026-10-08 · 🎨 gerências em faixas alternadas (dois tons bem suaves)

Pedido direto: dividir melhor as gerências na lista de Objetivos, sem poluir. Cada gerência agora fica num bloco com fundo bem leve, e os blocos **alternam dois tons pela POSIÇÃO** (1ª, 3ª… num tom; 2ª, 4ª… no outro — não é uma cor por gerência, então filtrar não "troca" a cor de ninguém). O tom é da cor do tema (azul no Abrolhos, pêssego no Vice City, branco translúcido no Lençóis, que já é azul saturado); na **visão global** é a cor de cada torre, recomeçando a alternância em cada faixa. Só fundo: os cartões não mudam de lugar nem de tamanho (margem negativa devolve o respiro do padding), sem rolagem horizontal, 1º bloco da visão global respira do título da torre. Opacidades: ~5,5% / 1,6% (escuro). Teste: 11 cenários no Chromium (4 gerências alternam a-b-a-b, filtro recomeça em "a", 3 temas, visão global por torre, celular).

### okr-dev.html v2.35 · okr-dev — 2026-10-08 · ❓ Ajuda do OKR reorganizada — abas, busca, perguntas frequentes e "🙋 O que eu posso fazer?"

Pedido direto: a ajuda do OKR tinha virado uma lista corrida de 24 blocos de texto. Reorganizada **sem perder nenhum conteúdo** (os 24 tópicos continuam, agora em seções):

- **7 abas**: ⭐ Começar · ❓ Perguntas · 🎯 Objetivos · 📅 Agenda e avisos · 🏛️ Torres e acesso · 🧭 Navegar · 💬 Agente Ágil. Cada tópico é um acordeão com título + uma linha de resumo; os textões (Torres, Trava, Calendário, Notificações, Menu de ações, Apresentação) viraram listas com o termo em negrito.
- **⭐ Começar** (abre aqui): "O OKR em 30 segundos" (Torre → Objetivo → Marcos; a **cor** vem dos Marcos, a **barra** do Atingimento — a dúvida mais comum), **🔥 Mais usados** (8 atalhos pros tópicos) e **🚀 Primeiros passos**.
- **🙋 O que eu posso fazer?** — janelinha **personalizada pelo papel real da pessoa** (lê as mesmas funções que travam a edição: ADM, PO/Organizador, 🎯 Gestor OKR, torre ⭐ Geral, Responsável por N Objetivos, Membro, 👁 Visualizador externo): lista "✅ Você pode" e "🚫 Você não pode" (com link pro tópico que explica). Ex.: um Gestor OKR da Comercial vê "criar/editar na torre Comercial, agenda da sua torre, Mural" e "não pode excluir nem usar a agenda global".
- **❓ Perguntas frequentes** — 18 perguntas (por que não consigo editar, "🔒 Fulano editando", como registrar atingimento, cor × barra, reunião/convidados, não recebi aviso, Arquivar × Excluir, acesso externo…), cada uma com links "Veja…" pro tópico.
- **🔎 Busca** — ignora acento e maiúsculas, várias palavras = todas precisam aparecer, procura no título, em palavras-chave (ex.: "convidar" acha o Calendário) e no texto; mostra o trecho com destaque, agrupa por seção e abre sozinha quando há até 3 resultados. Atalho **/** foca a busca; **Esc** limpa a busca e, de novo, fecha; ← → trocam de aba; clicar no fundo fecha (antes o Esc não fechava a ajuda).
- **Celular**: tela cheia (mesmo padrão dos modais do Objetivo), abas em fila rolável, busca em 16px (sem zoom do iOS), alvos de toque ≥ 44px.
- `openOkrHelp('trava')` abre direto num tópico (pronto pra links de ajuda contextual).

Teste: 41 cenários no Chromium (desktop + 390×844), 5 papéis conferidos.

### okr.html v2.33 · okr — 2026-10-07 · Promove pra prod — 📅 Calendário, 🔒 trava de edição, cabeçalho em níveis, apresentação por torre e correções do dia

Promove okr-dev v2.20 → v2.33 (prod estava na v2.19): **🔒 trava de edição** do Objetivo (e pedir o Objetivo), **📅 Calendário** (agenda global + de cada torre, recorrências, pauta sugerida, convidados, avisos no sino/push, anotações pós-reunião, tags; **bloco quinzenal importável**), **cabeçalho reorganizado** (abas + ⋯ Mais + filtros recolhíveis, títulos em DM Sans), **ADM vê se o visualizador externo já entrou/está online**, aviso ao excluir gerência com Objetivos, rodapé do sino respeitando o Não Perturbe desde o boot, e as 2 rodadas de `/monitorarbugs` (XSS por torre do evento, duplo clique em Salvar, Esc nos diálogos, série apagada a partir de ocorrência passada, evento apagado por outra pessoa). `mare-notif.js` v6 (reuniões no sino). **Requer deploy das functions** `okrDailyScan`, `sendPushOnNotification` e `okrAgenteChat` pra reuniões/push/Agente funcionarem por completo (a página funciona sem). Antes de usar o aviso de véspera do bloco quinzenal, importar o bloco pelo banner do ADM.

### okr-dev.html v2.11 · okr-dev + painel-dev v5.10 — 2026-10-07 · /monitorarbugs do Mural + sino

Rodada de auditoria no que subiu em v2.10, 4 achados reais, todos reproduzidos no Chromium antes de corrigir. (1) **Duplo clique em "📢 Publicar"** (ou Enter repetido) criava **2 avisos e 2 eventos no sino**: cada chamada gera um id novo e a gravação é assíncrona, sem trava de "em andamento" — agora `_okrMuralSaving`. (2) **Esc não fechava nada novo**: nem o modal de publicar, nem o aviso em destaque, nem o painel do sino (e, com o aviso aberto por cima de um Objetivo, o Esc ia pro modal de baixo) — as outras janelas da página já fechavam com Esc; agora fecha a camada de cima (aviso → sino → publicar). (3) **⧉ Duplicar Objetivo** criava um Objetivo novo sem o evento "🆕 Objetivo criado" (só o "+ Novo Objetivo" gerava) — a torre não era avisada; agora gera o mesmo evento. (4) **Sino do painel** (só ADM, `painel-dev.html`): as notificações do OKR (`okr_editado`/`okr_prazo`/`okr_reuniao`/`okr_agente` e a nova `okr_mencao`) não tinham nenhuma ação ao clicar — o painel descartava o `okrObjId`; agora levam à página do OKR (Objetivo, Central do Agente ou Anotações) e marcam como lida, o mesmo mapa do sino do kanban. Testes: 6 cenários (OKR) + 5 (sino do painel) novos; suítes anteriores sem regressão.

### okr-dev.html v2.30 · okr-dev — 2026-10-07 · 🔤 títulos novos em DM Sans (menos "cara de IA")

Relato direto: o título da torre no cabeçalho novo ("🛒 Torre Digital", Syne extrabold) ficou "IA demais". Passa a usar **DM Sans semibold** (a fonte do corpo da página, sem a cara de display), menor e sem peso extra; o mesmo vale pro título do mês no calendário e pro título do evento, que eu tinha feito com a mesma fonte. Só visual; nenhum comportamento muda.


### okr-dev.html v2.31 · okr-dev (+ `pushUrl.js`) — 2026-10-07 · /monitorarbugs do calendário do OKR

Rodada de auditoria em tudo que foi feito hoje no OKR (trava, visualizadores, gerências, apresentação por torre, calendário, bloco quinzenal, cabeçalho). 4 achados reais, todos reproduzidos no Chromium antes de corrigir; o resto da área foi lido de ponta a ponta e não teve achado (paridade cliente↔servidor da recorrência e do escopo, regras de `acesso`, aviso de gerência, apresentação por torre).

1. **XSS armazenado pela torre do evento** (o mais sério). `ev.torre` vem do banco — qualquer pessoa da empresa grava em `kanban/okr` — e entrava cru no `class="…"` dos itens, chips e pontinhos do calendário. Um evento com `torre = x" onmouseover="…` injetava atributos na agenda e no mês de todo mundo que abrisse o calendário (mesma classe da varredura de 05/10, repetida ao escrever o render novo). Agora só um id de torre conhecido vira classe (`_okrCalCls`); desconhecida é pintada como global.
2. **Push de reunião não abria a reunião.** O clique no push de `okr_reuniao` (véspera/dia, convite, mudança) caía na home do OKR: `urlDoPush` só conhecia `okrObjId`. Com `okrEventoId` agora abre `okr.html?evento=<id>&data=<dia>`, igual ao clique no sino. **Requer `firebase deploy --only functions:sendPushOnNotification`.** +1 teste (suíte 659/659, 1 pulado).
3. **Excluir a série inteira de dentro de uma ocorrência passada não avisava ninguém.** O aviso de cancelamento só saía se a data aberta fosse de hoje em diante; apagando "Toda a série" numa ocorrência de semanas atrás, convidados e sino não eram avisados (e as ocorrências futuras sumiam). Agora "toda a série" avisa se ainda restava ocorrência pela frente, citando a próxima; "só esta" segue avisando só se ainda não passou.
4. **Mudar de mês deixava o painel do dia mentindo.** O dia selecionado ficava no mês anterior e o painel abaixo da grade dizia "Nada marcado neste dia" mesmo com eventos no mês novo (ele só enxerga as 6 semanas exibidas). Agora ◀/▶ leva a seleção pro mês exibido (hoje, se for o mês atual; senão o dia 1).

Reportado, não corrigido: apagar um evento deixa as anotações pós-reunião e vínculos dele órfãos no banco (só o "↩ Voltar ao bloco fixo" apaga junto) — apagar anotações é destrutivo, fica como decisão de produto.


### okr-dev.html v2.32 · okr-dev — 2026-10-07 · /monitorarbugs (2ª rodada) do editor de eventos e dos diálogos

Segunda rodada no calendário, agora no que acontece com rede lenta e janelas empilhadas. 3 achados reais, reproduzidos no Chromium (com atraso de 400 ms nas gravações) antes de corrigir.

1. **Duplo clique em "💾 Salvar" criava 2 eventos e 2 avisos no sino.** Evento novo gera um id novo a cada chamada e a gravação é assíncrona — o clique repetido (ou Enter) passava de novo antes de o editor fechar. Agora há trava "salvando" (`_okrEvSalvando`). Mesma lição de 06/10 (`_okrAtingQuickSalvar`) e do 📢 Publicar.
2. **Esc com um diálogo aberto fechava a janela de trás.** Em "Excluir → Só esta / Toda a série" (e nos `uiConfirm`/`uiAviso` do OKR), o Esc fechava o detalhe/editor por baixo e deixava o diálogo órfão na tela. Agora o Esc fecha só o diálogo (`_uiEscFecha`, ouvinte na `window` em captura).
3. **Salvar um editor aberto sobre um evento apagado por outra pessoa o ressuscitava em silêncio** (com aviso de "nova reunião" no sino). Agora avisa "foi excluído por outra pessoa enquanto você editava — nada foi salvo" e fecha o editor.


### okr-dev.html v2.33 · okr-dev — 2026-10-07 · docs: ❓ Ajuda do OKR em dia (cabeçalho em níveis, calendário completo, torres nas permissões, Agente por torre)

Só texto da ajuda in-app (`#okr-help-ov`). Novo bloco **🧭 O cabeçalho** (título da torre + ⋯ Mais + abas) e filtros atualizados (**⚙ Mais filtros** guarda período/pessoa/tag). **📅 Calendário** ganhou convidados, avisos (sino da torre, véspera e dia às 7h, push), anotações pós-reunião por ocorrência e o vínculo com a apresentação. **🔔 Notificações** cita as reuniões do calendário. **👁 Visualizadores** agora diz onde fica o botão (⋯ Mais) e o status "já entrou / online agora". **✏️ Quem pode editar** reflete a regra **por torre** (e a do calendário). **🖥️ Apresentação**: "aqui no Painel" → "aqui no OKR", capa por torre e ← → do teclado. **🔒 Trava**: o Agente Ágil agora a respeita. **💬 Central Agente Ágil**: torre e gerência ao criar Objetivo, 📅 agenda (só leitura), permissão por torre e sino. Gerência excluída com Objetivos: o 🗑 explica a saída.


### okr-dev.html v2.34 · okr-dev — 2026-10-08 · 📱 modais do OKR repensados pro celular (Objetivo · ⚙ Configurações · Marco)

Relato direto, com print: no celular o modal do Objetivo era uma janelinha com **só 41% da tela útil pra editar** (cabeçalho de 168 px com o título espremido numa coluna, 4 filas de chips de seção, resumo com botão duplicado, e um rodapé de 5 botões que estourava a largura e cortava o "Cancelar"). Agora, em telas até 640 px (desktop **não muda**): (1) o modal vira uma **folha em tela cheia** (`100dvh`, sem moldura); (2) **cabeçalho em 2 linhas** — título inteiro + ✕ em cima, chip da torre + ⚙ 🔗 embaixo; (3) os 9 chips de seção viram **um seletor "🧭 Ir para a seção…"** (com as contagens; em toque ele não abre o teclado ao pular); (4) o resumo perde o botão "⚙ Configurações" repetido (o ⚙ do cabeçalho já abre) e "Próximas reuniões" fica em 1 linha cada; (5) rodapé **[Cancelar] [⋯] [💾 Salvar]** — Duplicar/Excluir/Arquivar vão pro menu ⋯ (com área de toque de 42 px e respeito à barra inferior do iOS); (6) menos folga entre rótulo e campo. Medido no Chromium (390×844, toque): corpo útil **348 px → 631 px** (41% → 75%). A mesma folha vale pro ⚙ Configurações (702 px de corpo) e pro Marco (651 px). No dev, a faixa "OKR DEV" ganhou um recuo no celular pra não cobrir o cabeçalho (sem mexer na faixa).

### okr-dev.html v2.29 · okr-dev — 2026-10-07 · 🧭 cabeçalho do OKR reorganizado (menos poluído, com hierarquia e divisões)

Relato direto: a barra do OKR estava "poluída, cheia, com cores parecidas, sem divisão" — tudo (ajuda, guia, apresentação, 5 telas, visualizadores, filtros) tinha o mesmo peso visual, na mesma linha. Agora em **3 níveis**: (1) **título da torre** ("🛒 Torre Digital", com o kicker "Objetivos estratégicos") + 3 ações — **🎥 Apresentação** (contorno), **⋯ Mais** e **+ Novo Objetivo** (o único botão preenchido); (2) **abas** com sublinhado — **Objetivos · Calendário · Dashboard · Anotações · Agente Ágil** — que trocam de tela uma de cada vez (antes eram botões que viravam "◀ Ver Objetivos"; clicar na aba ativa não volta mais); (3) **filtros** só na aba Objetivos: busca (larga), gerência e status à vista, **⚙ Mais filtros** (período, pessoa, tag — abre sozinho com contador quando um deles está aplicado, p.ex. ao clicar numa tag do cartão) e 📦 arquivados; os **chips de estatística** ficaram leves (sem caixa até o mouse/seleção) e as métricas (atingimento médio, marcos) vão à direita como texto. No menu **⋯ Mais**: ❓ Ajuda, 📘 Guia visual, ⚙ Gerências da torre (quem edita a torre) e 👁 Visualizadores externos (só ADM) — o ⚙ Gerências saiu da barra de torres. Mesmos ids e funções (nada de dados mexido); no celular as abas rolam na horizontal e o cabeçalho quebra em linhas, sem rolagem lateral. Testes: `test_okr_head` novo (30 checagens: abas, menu por perfil, filtros, celular) + 2 testes antigos ajustados ao novo lugar dos botões.

### okr-dev.html v2.28 · okr-dev + `functions/okr/dailyScan.js` — 2026-10-07 · 🗓️ o "bloco quinzenal" fixo vira 2 reuniões recorrentes do calendário

Migração do **bloco quinzenal** (Bloco 1: Geral, Comercial, Marketing de Performance, Dados e IA · Bloco 2: CX, Tech, CRM — as duas se alternam toda quinta desde 03/09, só torre Digital), que vivia fixo no código (modal do Objetivo + aviso das 7h), pro calendário. **Sem "dia da virada":** no calendário (👤 ADM) aparece o banner **📥 Importar bloco quinzenal**; ao confirmar, criam-se 2 eventos recorrentes — **"Check-in OKR — Bloco 1"** (a partir de 03/09) e **"Bloco 2"** (a partir de 10/09), a cada 2 semanas, torre Digital, ligados às gerências de cada bloco, com **lembrete de véspera ligado e do dia desligado** (igual ao aviso antigo), `origem:'bloco_quinzenal'`, sem horário (edite pra pôr horário/link/convidados). Enquanto não importar, **nada muda**. Depois de importar, a troca é automática: o modal do Objetivo deixa de mostrar o aviso fixo (a reunião aparece em "Próximas reuniões e eventos" e no selo 📅 do cartão), e o `okrDailyScan` **cala o gatilho fixo** (a véspera vem do calendário — 1 aviso por pessoa, sem duplicar; mesmo público: responsáveis dos Objetivos Digital das gerências do bloco). Idempotente (ids fixos; importar de novo não duplica) e **reversível** ("↩ Voltar ao bloco quinzenal fixo", só ADM, apaga os 2 eventos e religa o aviso fixo); apagar os eventos à mão também religa. Editar o evento importado mantém a origem (antes de testar isso, salvar o evento a perdia e o aviso fixo voltaria duplicando — corrigido). **Paridade:** as ocorrências dos 2 eventos são iguais à fórmula antiga em todas as quintas (teste no navegador e no servidor). O `okr.html` de **produção** continua com o bloco fixo (a lógica antiga segue no código — `OKR_BLOCO_*`/`_okrBlocoInfoHtml` — até o calendário ir pra prod; aí dá pra apagá-la). **Requer deploy antes de importar:** `firebase deploy --only functions:okrDailyScan`. Testes: +13 no navegador (98 no total do calendário) e +4 no servidor (659).

### okr-dev.html v2.27 · okr-dev + `functions/okr/calendario.js` — 2026-10-07 · 🏷️ Calendário: vincular o evento a tags

O evento do calendário agora pode ser **vinculado a tags** do OKR (campo 🏷️ Tags no editor, com os chips coloridos de sempre). Vale como o recorte por gerência: os **Objetivos que têm a tag** passam a fazer parte do evento — entram na **pauta sugerida**, em "Próximas reuniões e eventos" do Objetivo (e no selo 📅 do cartão) e nos **lembretes de véspera/dia** (responsáveis desses Objetivos, via `okrDailyScan`) — mesmo num evento do tipo "evento" ou "lembrete". Regra única de escopo (cliente e servidor): vínculo explícito a Objetivos vale em qualquer torre; dentro da torre do evento (global = todas) vale **tag OU gerência**; com algum recorte e nenhum acerto o Objetivo fica de fora (nunca vira "a torre toda" — vale também se a tag for apagada); sem recorte nenhum, reunião = a torre toda. O calendário ganhou o **filtro 🏷️ por tag** (mostra os eventos com a tag e os prazos de Marcos de Objetivos com a tag) e as tags aparecem no detalhe e na linha do evento. Antes, quando um evento tinha Objetivos vinculados E gerências marcadas, as gerências eram ignoradas; agora valem as duas (união). **Requer deploy** só pra os lembretes seguirem a regra nova: `firebase deploy --only functions:okrDailyScan`. Testes: +10 no navegador (84 no total do calendário) e +2 no servidor (16; 655 no total).

### okr-dev.html v2.26 · okr-dev + painel-dev v5.19 + kanban-dev v8.30.799-dev + `mare-notif-dev.js` (?v=6) + `functions/okr/` — 2026-10-07 · 📅 Calendário: avisos no sino, convidados e anotações pós-reunião

Pedidos diretos sobre o calendário. **Avisos no sino:** (1) **nova reunião/evento, mudança de data, horário, local ou repetição, e cancelamento** (de uma ocorrência ou da série) viram aviso no sino da agenda (feed `okr_evento`: 🗓️/🚫 — a agenda global avisa todas as torres, a local só a torre; aparece no sino do OKR, do painel e do kanban, e o clique abre a reunião no calendário via `?evento=<id>&data=<dia>`); no editor há **"Avisar agora no sino"** pra não fazer barulho por ajuste pequeno (e mudar só a descrição nunca avisa); (2) **véspera e dia** (às 7h) pela Cloud Function `okrDailyScan` (gatilho 3): notificação pessoal `okr_reuniao` — que já é push — pros responsáveis dos Objetivos da pauta e pros convidados, escolhendo **"Lembrar na véspera"/"Lembrar no dia"** por evento (lembrete só no dia). **Convidados:** campo no editor (qualquer pessoa da empresa); eles recebem convite pessoal ("📩 fulano te convidou"), avisos de mudança/cancelamento e os lembretes mesmo sem Objetivo na pauta; aparecem no detalhe. **Anotações pós-reunião** por ocorrência (ata, decisões, próximos passos; `@Nome` avisa a pessoa; autor/ADM/organizador apaga; externo só lê), em `kanban/okr/calendario/notas/{evento}/{data}`. **Vínculo com a apresentação do OKR:** o botão 🔗 liga a ocorrência às anotações da apresentação do mesmo dia (`reuniao_notas/{data}`), que passam a aparecer dentro da reunião (com atalho pra tela de anotações e pra apresentação); o botão avisa quando já há anotações da apresentação naquele dia. **Também:** campo de descrição maior (8 linhas), e correção da lista de **Objetivos vinculados** do editor, que encolhia pra uma linha (o corpo do modal é uma coluna flexível e a lista com rolagem cedia espaço). Pauta sugerida começa com 5 itens (+ "Mostrar todos"). **Requer deploy:** `firebase deploy --only functions:okrDailyScan` (lembretes de véspera/dia e convidados); os avisos de criação/mudança/cancelamento, convites e anotações funcionam sem deploy. Testes: 74 checagens no Chromium + 14 do calendário no servidor (652 no total) + regras.

### okr-dev.html v2.25 · okr-dev — 2026-10-07 · 📅 Calendário do OKR (agenda global + agenda de cada torre, recorrências, pauta sugerida)

Nova visão **📅 Calendário** (botão ao lado do 📊 Dashboard; alterna com a lista de Objetivos). **Duas camadas de agenda:** a **🌐 agenda global** (envolve todas as torres — só ADM cria) e a **agenda local de cada torre** (ADM e quem organiza a torre — PO/Gestor OKR dela — criam). O filtro mostra *Todas as agendas*, *só a global* ou *a de uma torre* (com a caixa **+ global** pra ver junto os eventos que envolvem todo mundo); a torre em que você está já abre filtrada. **Recorrência:** não repete, toda semana, quinzenal, mensal, trimestral, semestral, anual ou personalizada ("a cada N dias/semanas/meses/anos"), com data final opcional; mensal/anual mantêm o dia e usam o último dia do mês quando ele não existe (31, 29/fev); dá pra excluir **só uma ocorrência** (exceção) ou a série inteira. **Visões:** mês (chips coloridos por torre, 🌐 na global, ◆ nos prazos dos Marcos, painel do dia embaixo) e **Agenda** (próximos 60 dias, +60 sob demanda) — no celular abre como Agenda e o mês troca os chips por pontinhos. **Interação com os Objetivos:** o evento pode ser ligado a gerências e a Objetivos; o **modal do Objetivo** lista as próximas reuniões/eventos dele, o **cartão** ganha o selo 📅 quando há um nos próximos 7 dias, e a reunião monta uma **pauta sugerida** (Objetivos atrasados/em risco primeiro, marcos vencidos ou vencendo até 7 dias depois da reunião, atingimento sem lançamento há mais de 14 dias). Externo só lê. Dado novo: `kanban/okr/calendario/eventos/{id}` (já coberto pelas regras de `kanban/okr`; sem deploy de regras). **Ainda não** (próximos passos): avisos no sino/push de reunião marcada e de véspera, trocar o "bloco quinzenal" fixo por eventos recorrentes (inclui `dailyScan.js`), próxima reunião na apresentação e o Agente Ágil ler/criar eventos. Testes: 48 checagens no Chromium (recorrências, filtros global/local, permissões ADM/organizador/membro/externo, pauta, vínculo com Objetivos, exclusão de ocorrência/série, validações, celular) + 2 casos de regras (638).

### okr-apresentacao.slide.html — 2026-10-07 · ⌨️ setas ← → também passam os Objetivos no detalhe (+ Espaço não pula mais 2 slides)

Pedido direto: "quando você coloca a visão detalhada de um Objetivo, as setas não passam". Era isso mesmo — com o detalhe aberto o atalho de teclado só tratava Esc/Backspace e ignorava as setas (o resto da apresentação já passava slide com ← → e Espaço). Agora, **com o detalhe de um Objetivo aberto, → vai pro próximo Objetivo e ← pro anterior da mesma gerência** (mesma lista e ordem dos botões "← Anterior"/"Próximo →"; nas pontas não faz nada, como o botão desabilitado). Fora do detalhe nada muda.

Achado na verificação: depois de clicar em ▶/◀ da barra o foco fica no botão, e o **Espaço avançava 2 slides** (o clique nativo do botão + o atalho). O atalho agora faz `preventDefault` no Espaço. E, de quebra, o atalho passa a ignorar teclas enquanto se digita num campo de texto (`INPUT`/`TEXTAREA`). `guia-okr.html` ganhou a frase nova no slide de navegação. Sem versão própria (a apresentação é compartilhada, entra no ar no merge).

### okr-apresentacao.slide.html — 2026-10-07 · 🏛️ a apresentação ganha as torres (capa por torre, slide de cada torre, panorama agrupado, filtro)

Antes a apresentação só tratava a torre como um prefixo no nome da gerência ("🛍️ Comercial · Geral") e a capa somava tudo. Agora: **capa** com um cartão por torre (Objetivos, progresso médio, barra de status, gerências, atrasados/em risco — clicável); **slide-capa de cada torre** (cor própria: Digital azul, Comercial laranja, Corporativa roxa) com os KPIs, a barra de status com legenda e as gerências dela como linhas clicáveis (contagem, barra e média); **slides das gerências** com chip da torre e só o nome da gerência no título; **panorama** com uma faixa por torre (subtotal) e as gerências embaixo, mais a coluna **Média**; **bolinhas do rodapé** na cor da torre, com a capa de cada torre maior e um respiro entre as torres. Novo **filtro de torre** na barra (🏛️, aparece com Objetivos em 2+ torres) e por URL (`?torre=comercial`): apresenta só aquela torre — capa, slides, panorama e Anterior/Próximo do detalhe seguem o filtro, junto com o filtro de tag. Sem mudança de dados. Página compartilhada (sem cópia dev). Teste novo `test_apres_torres` (18 checagens: ordem dos slides, cartões, navegação por clique, nome configurado da gerência, panorama, filtro por select e por URL, 1 torre só, detalhe).

### okr-dev.html v2.24 · okr-dev — 2026-10-07 · 🗑 excluir gerência com Objetivos agora avisa (em vez de não fazer nada)

Relato direto: o 🗑 de uma gerência criada no OKR só funcionava quando ela estava vazia; com Objetivos o botão simplesmente não fazia nada, sem aviso (ele vinha `disabled`, e botão desabilitado não dispara clique — nem toast). A regra continua (gerência com Objetivos não é apagada), mas agora o botão é clicável e abre uma caixa explicando: "Não dá pra excluir 'X': ela ainda tem N Objetivo(s) (M arquivado(s))" + as saídas — ➡️ enviar os Objetivos pra outra gerência (Objetivo → ⚙ Configurações → Gerência), 🗑 excluir os Objetivos dela (os arquivados estão em 📦 Ver arquivados) ou 🙈 Ocultar (tira dos seletores e os Objetivos continuam nela). Se for a última gerência da torre, o aviso diz que a torre precisa de ao menos uma. O texto de abertura do modal também aponta pro 🗑. Novo `uiAviso()` (caixa só com "Entendi"). Teste de gerências ajustado + 3 casos (aviso, gerência intacta, chamada direta recusada) — 32 checagens.

### okr-dev.html v2.23 · okr-dev + painel-dev v5.18 + `database.rules.json` — 2026-10-07 · 👁 ADM vê se o visualizador externo já entrou e se está ativo

Pedido direto: "não tem como eu identificar se o visualizador externo já fez login, se já está ativo no Maré". A lista de visualizadores (OKR → 👁 e painel → ⚙ ADMs / 👥 Global Users → 👁) só mostrava e-mail e "só leitura". Agora cada pessoa tem um status: **🟢 online agora** (· OKR/Painel), **✅ entrou · visto há 3 h** (tooltip com primeiro acesso e último sinal) ou **⏳ ainda não entrou**; a lista vem ordenada nessa ordem e atualiza sozinha a cada 20 s com o modal aberto. Como funciona: o próprio visualizador grava `kanban/painel_viewers/{email}/acesso = {primeiro, ultimo, uid, pagina}` (no máx. 1× a cada 5 min, só com a aba visível); "online" = batimento de presença do OKR ou último sinal < 6 min. O registro mora dentro da entrada do visualizador, então some junto se o ADM o remover, e a regra nova (`painel_viewers/$k/acesso`) só deixa cada um escrever o PRÓPRIO registro e só se já estiver autorizado na lista (não dá pra se auto-autorizar nem mexer no de outro; `primeiro` é imutável). **Requer publicar as regras** (`firebase deploy --only database`); sem isso a gravação falha em silêncio e tenta de novo a cada ~1 min. Quem já estava na lista aparece como "ainda não entrou" até o próximo login (não há histórico anterior). Testes: 14 cenários no Chromium + 3 casos novos de regras (636 no total).

### okr-dev.html v2.22 · okr-dev — 2026-10-07 · 🐞 fix: fechar o modal não soltava a trava (teste de console com dado real)

Achado pelo teste de console rodado no Firebase de verdade (`B3. fechar o modal solta a trava` ❌): ao fechar o Objetivo, a trava continuava no banco e o heartbeat seguia renovando — o Objetivo ficava "🔒 editando" pra todo mundo até a pessoa sair da página. Causa: o Realtime Database dispara os ouvintes locais **de forma síncrona dentro do próprio `remove()`**; `closeOkrObjetivo()` soltava a trava ANTES de encerrar a sessão do modal, então o eco da remoção chegava em `_okrLockOnChange()` com o modal ainda "aberto", via o Objetivo livre e **retomava a trava** na hora. Meu ambiente de teste disparava ouvintes de forma assíncrona e escondia o problema. Correção: (1) `closeOkrObjetivo()` encerra a sessão (id/rascunho/snapshot) antes de soltar; (2) flag `_okrLockSolto` — soltei de propósito, o reconciliador não retoma até a próxima abertura; (3) `pageshow` com `persisted` (volta do cache de navegação) retoma a trava se o modal ainda estiver aberto. O fake de teste agora tem modo síncrono (`__fireSync`) e a suíte da trava (21 cenários) roda nele — antes do fix falhavam 1b e 6c, agora passam.

### okr-dev.html v2.21 · okr-dev — 2026-10-07 · 🔒 trava de edição simultânea do mesmo Objetivo

Pedido direto: "trave edição simultânea do mesmo objetivo no OKR, estilo o que já temos no kanban em cards". Mesmo desenho da trava de card (`_checkCardLock()` do kanban): 1 nó por Objetivo em **`kanban/okr/obj_locks/{id}`** = `{uid, who, ts[, request]}` (já coberto pelas regras de `kanban/okr`: empresa escreve, visualizador só lê — **sem deploy de regras**). **Quem abre primeiro segura**; quem abre depois vê o Objetivo **e os Marcos dele em modo leitura**, com aviso "🔒 Fulano está editando este Objetivo agora", sem 💾 Salvar nem ⚙ Configurações; o cartão na lista ganha o selo **🔒 Fulano editando**. **Heartbeat de 1 min**; trava sem sinal há **10 min** conta como abandonada (aba fechada/computador dormiu) e quem abrir assume — o poll de 30 s também libera quem espera em leitura. **🔔 Pedir o Objetivo**: quem segura vê o pedido (aviso + contagem) e tem **5 min** pra salvar e sair ou clicar em **✅ Liberar agora**; estourou, o sistema salva o que está na tela (Marco aberto primeiro) e fecha pra ele, e quem pediu assume (+2 s de folga). Quem estava em leitura e herda a trava (o outro saiu/liberou) tem o modal **reaberto com o dado fresco** — não edita em cima de rascunho velho. **Corrida** (duas pessoas abrem junto): quem perdeu passa a leitura e para o heartbeat. A trava solta ao fechar, no `beforeunload`/`pagehide` e só remove se ainda for **minha**. O mesmo usuário em outra aba não trava a si mesmo (por uid); só quem **pode editar** o Objetivo pega a trava (quem só lê, visualizador externo e "Novo Objetivo" não gravam nada). As ações rápidas que escrevem no nó do Objetivo — tags, mover/arrastar, arquivar, desarquivar, excluir, status/apresentação/arquivar de Marco — **também respeitam a trava** (senão o Salvar de quem segura, que grava o rascunho inteiro, apagaria a mudança em silêncio); atingimento rápido segue liberado (já é por transação e o Salvar mescla registros alheios). **Limite conhecido:** o Agente Ágil (servidor) edita Objetivo sem passar por aqui e não é travado. Testes: 21 cenários de Chromium (`test_obj_lock`) e as suítes do OKR sem regressão.

### okr-dev.html v2.20 · okr-dev + painel-dev v5.17 + `mare-notif-dev.js` (?v=5) + functions + service worker — 2026-10-07 · /monitorarbugs do OKR (rodapé do sino, push do Mural)

Rodada de auditoria no que subiu depois da anterior, 3 achados reais, todos reproduzidos antes de corrigir. (1) **O ding ignorava o Não Perturbe no OKR**: o módulo só carregava `notif_prefs/dnd` quando o sino era aberto pela 1ª vez (`rodapeRender()`), mas o som de notificação nova (`MareNotif.novas()`) roda desde o boot — quem tinha Não Perturbe ligado (gravado pelo kanban) ouvia o ding no OKR até abrir o sino uma vez (o painel já carregava no boot, por isso não tinha o problema). Agora `novas()` carrega o Não Perturbe antes de decidir tocar (controle: sem Não Perturbe segue tocando). (2) **O push do aviso do Mural vazava pra fora da empresa**: o feed é protegido pelas regras (só empresa e visualizadores leem), mas `sendPushOnMural` mandava pra todo mundo de `usuarios_publicos` com push ativo — um freelancer/parceiro com push recebia o título de um aviso interno. Agora só contas `@ciahering.com.br`/`@arezzo.com.br` (ou ADM da lista) recebem (**requer redeploy**: `firebase deploy --only functions:sendPushOnMural`). (3) **O clique no push do OKR podia sequestrar a apresentação da reunião**: o service worker reaproveitava qualquer aba com "okr" na URL, e `okr-apresentacao.slide.html` também tem — o push navegava a apresentação aberta pro OKR; agora só reaproveita a página do OKR de verdade. Teste novo no `pushMural` (12) e cenários de Chromium (ding com/sem Não Perturbe, OKR e painel). Obs.: o `mare-notif.js` de **prod** não foi alterado (arquivo compartilhado vai ao ar na hora); a correção (1) entra em prod na próxima promoção, junto com `?v=5`.

### okr-dev.html v2.19 · okr-dev + painel-dev v5.16 + `database.rules.json` — 2026-10-07 · visualizadores externos aparecem no "🟢 Online no OKR"

Pergunta direta: "no Online mostra também os visualizadores externos?" — **não mostrava**: o externo lia a lista, mas não escrevia a própria presença (a página pulava o heartbeat dele e as regras de `kanban/painel` só deixam a empresa escrever). Agora aparece, com o selo **👁** e a dica "visualizador externo", tanto no OKR quanto na linha "Online no OKR" da Visão do painel. Como: (1) **regras** — novo `kanban/painel/okr_presence/$uid` com `.write` só para o próprio uid de quem é visualizador (`painel_viewers`), sem abrir mais nada de `kanban/painel` (testado: não escreve a presença de outra pessoa nem outros nós), e um `.validate` do formato (`ts` número, `nome` texto ≤ 120, `foto` texto ≤ 600, `externo` booleano); (2) **heartbeat** — o externo grava `{ts, nome, foto, externo:true}` (a empresa segue sem o campo `externo`). **Deploy manual das regras: `firebase deploy --only database`** — enquanto não for publicado, o externo continua sem aparecer (a escrita é recusada em silêncio) e nada mais muda. Testes: 3 casos novos nas regras (630 no total), 8 cenários de tela e o teste 45 do `test_okr_page` atualizado (antes afirmava que o externo NÃO aparecia).

### okr-dev.html v2.18 · okr-dev + painel-dev v5.15 — 2026-10-07 · a aba "Histórico" vira "📊 Dashboard"

Pedido direto: a aba já tem muito mais que histórico (KPIs, cartões por torre, atingimento, gráfico, "o que mudou", contribuição, ponto ao vivo), então o botão **📈 Histórico** passou a **📊 Dashboard** (botão da barra e o rótulo "◀ Ver Objetivos" ao voltar não mudam), com o texto da ajuda do OKR, do aviso de Visualizadores (okr-dev e painel-dev), do `guia-okr.html` e do `maredigital.html` acompanhando. **Não** mudou: o **📜 Histórico** de cada Objetivo/Marco (log de edições), o "Histórico de atingimentos" e os nomes internos (`_okrHist*`, `okr-historico-btn`, `renderOkrHistorico()`), pra não mexer em âncoras do `CODE_MAP.md` à toa. Só texto/ícone, sem mudança de dado.

### okr-dev.html v2.17 · okr-dev — 2026-10-07 · Histórico ganha o ponto de HOJE (ao vivo)

Relato com print: no 📈 Histórico (🎯 Atingimento, visão global) a torre **Digital** aparecia com "0 Objetivos / sem Objetivos" mesmo com o Objetivo "🧪 TESTE — Receita do trimestre" já com atingimento cadastrado (a lista, o resumo e o cartão do Objetivo mostravam 40%). Causa: o Histórico é montado só das fotos de sexta 17h (`kanban/okr/snapshots`) — um Objetivo criado, ou com o 1º registro de atingimento, **depois** da última foto simplesmente não existe no Histórico até a próxima sexta. Correção na leitura (nada é gravado): quando há ao menos 1 snapshot, hoje é depois do último e **algum Objetivo tem valor hoje que não está no último snapshot**, o Histórico soma um ponto virtual **"hoje (ao vivo)"** montado dos dados atuais (`_okrHistLiveSnap()`, mesmos campos e a mesma conta do snapshot do servidor: só conta atingimento com registro, perene fora, arquivado fora). Ele vira o "último" da tela (KPIs, cartões por torre, tabela, "o que mudou", gráfico, janela "Como cada Objetivo contribui"), e o cabeçalho passa a dizer **"📍 Hoje, ao vivo · último snapshot guardado: sex, 02 de out. · o ponto de hoje é calculado agora, ainda não é um snapshot"** (a contagem de snapshots guardados só considera os reais). Sem novidade (todos os Objetivos de hoje já estão no último snapshot) nada muda; se já existe snapshot com a data de hoje, ele vale; sem nenhum snapshot segue a tela "ainda não há nenhum snapshot" (agora com a lista do que está ao vivo, da v2.16). Efeito colateral esperado: no "último" ao vivo, Objetivo apagado/arquivado depois da foto deixa de contar (na foto de sexta ele ainda contava). Testes: 11 cenários novos (`test_hist_live`) e as suítes de Histórico/Torres/OKR sem regressão.

### okr-dev.html v2.16 · okr-dev — 2026-10-07 · meus Objetivos pintados de novo + Histórico explica o que ainda não entrou no snapshot

Dois relatos do usuário. (1) **"Os meus Objetivos não estão pintados diferente, como era no painel"**: o tingimento azul de "👤 você é responsável" (`.okr-card.okr-mine`) existia, mas o gradiente da cor da torre (`.okr-card.okr-t-*`, mesma especificidade e mais abaixo no arquivo, adicionado com as Torres) sobrescrevia o `background-image` — os cartões "meus" ficavam idênticos aos dos outros (reproduzido: mesmo `background-image` nos dois). Agora o tingimento empilha com o gradiente da torre (escuro e claro). (2) **"A torre Digital trata como se nenhum Objetivo tivesse atingimento"**: a lista, o resumo (📈 % de atingimento médio) e a barra do cartão já usavam o atingimento certo (reproduzido: 40% no Objetivo de teste); quem dizia "Nenhum Objetivo com atingimento registrado nos snapshots" era o **📈 Histórico**, que só enxerga o que já entrou na foto de sexta 17h — um Objetivo criado, ou com o 1º registro, DEPOIS da última foto fica fora da curva até a próxima (e a tela vazia parecia dizer que não existe nenhum). Por decisão de não mudar a semântica do Histórico, a tela vazia (e a "ainda não há nenhum snapshot") agora lista **"📌 Já cadastrado agora (ao vivo)"**: título, % de atingimento atual e torre de cada Objetivo, com a data do próximo snapshot. Se o sintoma era em outro lugar, abrir um relato com a tela.

### okr-dev.html v2.15 · okr-dev + painel-dev v5.14 — 2026-10-07 · símbolos: 🛒 Digital, 🌐 Visão global

Pedido direto: o símbolo da torre **Digital** passa de 🌐 para **🛒**, e o **🌐** vira o símbolo da **Visão global** (que era 🔭). Mudou em todo lugar que mostra a torre: botões da tela inicial, chips da barra de torres, cartões/legendas do Histórico, filtros, Mural (chips de torre), título da lista na Visão global e a ajuda do OKR (`okr-dev.html`, `OKR_TORRES`); seletor de torre em 👥 Global Users (`painel-dev.html`, `GU_TORRES`); e a lista de torres da apresentação (`okr-apresentacao.slide.html` — arquivo compartilhado, vale já nos dois ambientes), além de `guia-okr.html` e `maredigital.html`. Só texto/ícone, sem mudança de dado: o id da torre continua `digital`. Obs.: os prints embutidos no `guia-okr.html` (slides da home) ainda mostram o símbolo antigo.

### okr-dev.html v2.14 · okr-dev + painel-dev v5.13 + `mare-notif-dev.js` (?v=4) — 2026-10-07 · rodapé do sino igual ao do kanban

Pedido direto, comparando os dois sinos: o do OKR (e o do painel) só tinham a lista + "marcar como lido", enquanto o do kanban tem **Limpar antigas**, **🔊/🔇 som**, **permissão deste aparelho** e **🔕 Não Perturbe**. Agora os três são iguais. O rodapé vive no módulo compartilhado (`MareNotif.rodapeHtml()` + `rodapeRender()`, com o próprio CSS) e usa os **mesmos dados do kanban**, então o que a pessoa escolhe vale em qualquer página: som mudo = `localStorage notif_sound_muted`; Não Perturbe = `kanban/usuarios/{uid}/notif_prefs/dnd` (1 h · 8 h · até amanhã 9h · até desativar; o sino continua registrando tudo, só o som/aviso que interrompe silencia); push do aparelho = `kanban/usuarios/{uid}/fcm_tokens/{push_device_id}` (a permissão do navegador já é por origem, então quem permitiu pelo kanban já aparece "✅ Permitidas neste aparelho" no OKR/painel e o token é reconfirmado sozinho). OKR e painel passaram a importar `firebase-messaging` (hooks `window._fcm*`, mesmo contrato do kanban) só pra isso. **Som**: o "ding" toca quando chega uma notificação nova (pessoal ou da torre) — o que vem na carga da página (primeiros 3 s) só entra na lista, sem som; respeita 🔇 e o Não Perturbe. **Limpar antigas** (OKR): apaga as notificações **pessoais já lidas** numa escrita só; o feed da torre é compartilhado e não se apaga (o que foi lido só perde o destaque). O menu do Não Perturbe é `position:fixed` (não é cortado pelo painel) e abre pra cima quando não cabe embaixo; **Esc fecha só o menu** antes de fechar o painel. **Visualizador externo**: só o 🔊 (não escreve no Firebase, não tem push nem Não Perturbe). Testes novos: 18 (OKR) + 6 (painel) e as suítes anteriores sem regressão.

### okr-dev.html v2.13 · okr-dev + painel-dev v5.12 + `mare-notif-dev.js` (?v=3) — 2026-10-07 · /monitorarbugs do SINO ÚNICO

Rodada de auditoria do sistema de notificações (área sensível), 5 achados reais, todos reproduzidos no Chromium antes de corrigir. (1) **XSS armazenado — severo**: o ícone do evento do feed (`icone`, gravado por qualquer pessoa da empresa em `kanban/notif_feed`) entrava sem escape no HTML do sino do OKR — um evento com `<img onerror=…>` executava JS em quem abrisse o 🔔 (kanban e painel já escapavam). Agora o OKR escapa e o módulo só aceita ícone curto e sem caracteres de HTML. (2) **`javascript:` na notificação de reunião**: o roteador compartilhado e o `openNotif()` do kanban abriam `meetingLink` com `window.open()` sem checar o esquema — só `http(s)` agora. (3) **Listas diferentes**: o kanban esconde notificação lida há mais de 3 dias e não lida há mais de 30; OKR e painel mostravam (e contavam no selo) tudo — o "sino único" não era igual. O critério virou `MareNotif.viva()`, usado pelas três páginas. (4) **"Marcar tudo" podia esconder evento nunca visto**: avançava o "lido" pra "agora" e comparava com o relógio de quem publicou — um evento publicado segundos antes do clique, mas entregue depois (latência) ou vindo de um relógio atrasado, nascia "lido". Agora marca cada evento carregado por id (`notif_feed_seen/{uid}/lidos`) e não mexe no watermark. (5) **Endurecimento**: ao clicar num item que troca de página, o "lido" agora espera a gravação sair (no máx. 0,8 s) antes de navegar. Testes: 5 + 3 cenários novos (kanban e painel também validados com evento hostil) e as suítes anteriores sem regressão; regras 612/612.

### okr-dev.html v2.12 · okr-dev + painel-dev v5.11 + `mare-notif-dev.js` — 2026-10-07 · 🔔 SINO ÚNICO + 📢 Mural vira botão com selo (igual ao kanban)

Pedidos diretos: (1) **"o sistema de notificação tem que ser um só, independente da página"**; (2) **"o Mural do OKR tem que ser o símbolo do megafone, igual ao kanban"**. **Sino único**: novo módulo compartilhado **`mare-notif-dev.js`** (raiz do domínio, como `firebase-messaging-sw.js`; a versão de prod `mare-notif.js` nasce na promoção) carregado por kanban, painel e OKR — é a única exceção à regra "sem import entre páginas". Ele cuida do **feed da torre** (agora num nó neutro **`kanban/notif_feed/{id}`**, 1 escrita por evento, + `kanban/notif_feed_seen/{uid}` pro "lido"; saiu de `kanban/okr/feed*`, que ficou órfão), do filtro por torre (ADM/⭐ Geral/externo veem tudo) e do **roteador de tipos** (ícone + URL entre páginas). Cada página continua com a sua lista de notificações pessoais e agora **mostra as duas juntas**: kanban (v8.30.797-dev), painel (v5.11 — o sino deixou de ser exclusivo de ADM; só os lembretes de squad seguem de ADM, com guarda própria) e OKR (que agora mostra **notificações de qualquer tipo**, não só `okr_*`; as que vivem em outra página — card, Kudos, reunião, intake — levam até ela pelo roteador). Publicar evento no feed deixou de ser coisa do OKR: `MareNotif.pushFeed()` serve qualquer página. **Mural**: a faixa fixa sumiu; o cabeçalho ganhou o botão **📢 com selo** de avisos não vistos (como o do kanban), que abre a lista — clicar num aviso lê o texto inteiro e marca como visto; ADM/quem edita a torre publica, edita e arquiva dentro da lista; Esc fecha em camadas; deep link `?mural=<id>` (usado pelo sino das outras páginas). **Regras do Firebase (`database.rules.json`, deploy manual: `firebase deploy --only database`)**: `kanban/notif_feed` e `notif_feed_seen` com o mesmo acesso do `okr` (empresa + visualizador leem, só a empresa escreve); enquanto não for publicado, o feed fica vazio em silêncio nas 3 páginas. Testes: 73 (OKR, adaptados) + 10 (botão 📢) + 8 (kanban/painel) novos e as suítes anteriores sem regressão; regras 612/612.

### Documentação do OKR — 2026-10-07 (noite, sem versão própria) · guia, maredigital.html, CODE_MAP e CLAUDE.md

Rodada de fechamento do dia. **`guia-okr.html`** (30 → 33 slides): prints refeitos com o Chromium + Firebase fake (home com 🛒/🌐 e o cabeçalho novo, ⋯ Mais, Gerências, Mural, sino com o rodapé e as reuniões do calendário) e **3 slides novos** — 🔒 trava de edição, 📅 Calendário e 👥 pauta/convidados/anotações; textos "no Painel" → "no OKR", Permissões com 3 linhas (agenda da torre, agenda global, anotar) e tabela compacta (a de 13 linhas escondia as últimas atrás do rodapé em 1366×768). Corrige também um engano do #1280: a frase das setas ← → no detalhe do Objetivo tinha ido parar no aviso de tela cheia do GUIA (agora está só no slide da apresentação). **`maredigital.html`**: versões (kanban-dev v8.30.800, painel v5.16/5.19-dev, okr v2.19/2.33-dev), árvore com `calendario/`, `obj_locks/` e `acesso`, novo bloco "📅 Calendário, 🔒 trava e cabeçalho", apresentação por torre + setas, visualizadores com status, push do `okr_mencao`, `sendPushOnMural`, `okrDailyScan` gatilho 3 e o Agente por torre. **`CODE_MAP.md`**: seções do `okr-dev`/apresentação/`functions/okr/` revalidadas (a chave `okr_feed_seen_` era `mare_feed_seen_`; "o Agente não é travado" virou "respeita a trava"), aba OKR do painel marcada como histórica, rodapé. **`CLAUDE.md`**: pendências de documentação fechadas.

### Documentação do OKR — 2026-10-07 (sem versão própria) · guia, maredigital.html e CODE_MAP

Acompanha o Mural/sino (v2.10) e as Torres/Gerências: **`guia-okr.html`** ganhou 5 slides com prints reais (🏛️ Torres e gerências, ⚙ Gerências configuráveis, 📢 Mural do OKR, 🔔 O sino do OKR com @menção, 👁 Visualizadores externos), a tabela de Permissões passou a valer "dentro da sua torre" (+ linha de Gerências/Mural) e os textos que ainda falavam em "aba OKR do Painel" apontam pra página própria (30 slides, ~16 min). **`maredigital.html`**: versões atuais (kanban v8.30.794/796-dev, painel v5.9, okr v2.8/v2.10-dev), linha nova pra `okr.html`/`okr-dev.html` na tabela de arquivos, árvore do Firebase com `gerencias`/`mural`/`feed`/`feed_seen`/`reuniao_notas`/`painel_viewers`, seção 22 reescrita (torres, gerências, permissões por torre, visualizadores, Mural, sino, menção) e notas de torre nas functions `okrDailyScan`/`okrWeeklySnapshot`. **`CODE_MAP.md`**: âncoras do Mural/sino/menção e dos visualizadores, contagem de slides do guia. A "❓ Ajuda" do próprio OKR já saiu atualizada na v2.10. Obs.: o guia é compartilhado (sem cópia dev) e já descreve Gerências/Mural/sino, que só chegam em `okr.html` (prod) na próxima promoção.

### okr-dev.html v2.10 · okr-dev — 2026-10-07 · 📢 Mural exclusivo do OKR + 🔔 sino de notificações

Pedido direto: "um mural exclusivo + sininho de notificações" no OKR. **📢 Mural do OKR** (`kanban/okr/mural/{id}` = tipo, título, mensagem, torres, autor, expiração): faixa fixa no alto da página (tela inicial e dentro das torres — dentro de uma torre mostra o dela + o dirigido a todas), com os 4 tipos do Mural geral (🎉 novidade, ⚠️ aviso, 💡 dica, 🚨 urgente); os **🚨 urgentes também abrem um popup 1x por pessoa** ("Entendi" marca como visto; vários pendentes abrem um de cada vez; quem publicou não recebe o próprio). **Quem publica**: ADM e quem edita a torre (PO/Organizador, 🎯 Gestor OKR ou torre ⭐ Geral), só nas torres que edita — "Todas as torres" é só pra quem edita todas (ADM / ⭐ Geral). Cada aviso tem expiração (7/15/30 dias ou só quando arquivar); editar e 📦 arquivar seguem a mesma régua. **🔔 Sino** no cabeçalho, com badge: junta as notificações pessoais `okr_*` (as mesmas do sino do kanban/painel: editado, prazo, reunião, agente + a nova **menção**) com o **feed da torre** (`kanban/okr/feed/{id}`, 1 escrita por evento, sem fan-out por pessoa): aviso novo no Mural, 🆕 Objetivo criado e ✅ Marco concluído — cada pessoa vê o da sua torre + o dirigido a todas (ADM, ⭐ Geral e visualizador externo veem todas); o que a própria pessoa fez não vira aviso pra ela. Clicar leva ao Objetivo / abre o aviso / abre as Anotações; "lido" por item (`kanban/okr/feed_seen/{uid}`) e **✓ Marcar tudo como lido**; na 1ª visita nada antigo vira "não lido". **Visualizador externo tem sino** com o feed e o Mural (só leitura — o "lido" dele fica no navegador, sem escrever no Firebase); menções e prazos são só pra quem tem usuário. **@menção nas 📋 Anotações da reunião**: digitar `@` lista as pessoas (↑↓ + Enter/Tab, Esc fecha); ao enviar, quem foi mencionado (nome completo, sem diferenciar acento/maiúscula) recebe `okr_mencao` e a menção aparece destacada na lista; deep link `?okr=notas`. **Sem mudança de regras do Firebase nem de Cloud Function** (usa `kanban/okr/*`, já legível pelo externo e gravável só pela empresa; a chave de feed ordena por tempo, sem índice novo). Push no celular pra menção/aviso não foi incluído (precisaria de `okr_mencao` em `PUSH_TYPES` + deploy da função). Testes no Chromium: 73 cenários (permissões por papel/torre, visibilidade por torre, popup, sino, externo sem escrita, eventos do feed, menção) + as 11 suítes anteriores do OKR sem regressão; backend 609/609.

### okr-dev.html v2.9 · okr-dev — 2026-10-07 · ⚙ Gerências configuráveis por torre

Pedido direto: "as torres configuram as próprias gerências, porque elas variam". Dentro de uma torre, o botão **⚙ Gerências** (barra de torres) abre um modal pra **criar, renomear, trocar o ícone, reordenar (▲▼) e ocultar** gerências. Dados em `kanban/okr/gerencias/{torre}/{id}` = `{label, icon, ordem, oculta?}`; enquanto a torre não configura nada vale o padrão (Digital: as 7 de sempre; Comercial/Corporativa: só "Geral"), e na 1ª edição o padrão é copiado e passa a mandar (a Digital também é editável). **Quem edita**: o mesmo que cria Objetivo na torre — ADM; PO/Organizador, 🎯 Gestor OKR e a torre ⭐ Geral. **Nunca apaga gerência em uso**: com Objetivos (ativos ou arquivados) só dá pra **ocultar** (some dos seletores de Objetivos novos; os existentes continuam nela e ela segue no filtro, marcada "oculta"); só gerência vazia exclui; a torre sempre mantém ao menos uma visível. Cada mudança é uma transação (duas pessoas editando juntas não se sobrescrevem). O rótulo agora depende da torre (o id `geral` existe em todas e pode ter nome diferente em cada). O bloco quinzenal continua só nas gerências originais da Digital (uma criada depois não tem bloco). **`okr-apresentacao.slide.html`** (compartilhada, já no ar): passou a ler as gerências configuradas e a agrupar por **torre + gerência** — antes, um Objetivo numa gerência fora da lista fixa sumia da apresentação e o "Geral" das 3 torres se misturava; agora Digital segue como sempre e as outras levam "🛍️ Comercial · Matriz". Também corrigido: o filtro de gerência da lista não refazia as opções quando a lista da torre mudava. Testes no Chromium: 30 cenários (criar/renomear/mover/ocultar/excluir, permissões por papel e torre, Digital, apresentação).

### okr.html v2.19 · okr — 2026-10-07 · Promove pra prod — Mural, sino único, Dashboard, símbolos novos e visualizadores no Online

Promoção de tudo que estava validado em dev (okr-dev v2.9 → v2.19, merge de 3 vias a partir do estado promovido na v2.8; prod só difere do dev nas linhas de ambiente). **Novo**: 📢 **Mural do OKR** (avisos por torre; 🚨 urgente abre em destaque; publica ADM, Gestor OKR e quem edita a torre) e 🔔 **sino único** (notificações pessoais de qualquer tipo + novidades da torre: aviso no Mural, 🆕 Objetivo criado, ✅ Marco concluído; visualizadores externos também têm sino) com rodapé igual ao do kanban — **Limpar antigas**, 🔊/🔇 som, **permissão neste aparelho** (push) e 🔕 **Não Perturbe** (mesmos dados do kanban); **@menção** nas Anotações da reunião (autocomplete, notificação, push); a aba **Histórico** virou **📊 Dashboard** e ganhou o ponto **"hoje (ao vivo)"** (Objetivo novo fora do último snapshot aparece na hora); símbolos **🛒 Digital** e **🌐 Visão global**; "meus Objetivos" voltam a ser pintados por cima da cor da torre; **visualizadores externos aparecem no 🟢 Online no OKR** (selo 👁). **Infra**: a página passa a carregar o módulo compartilhado **`mare-notif.js`** (raiz do domínio, `?v=4`; cópia de `mare-notif-dev.js`) e importa `firebase-messaging` pro push. **Já no ar antes desta promoção** (arquivos sem versão própria): regras `notif_feed`/`notif_feed_seen`/`okr_presence/$uid` e as functions `sendPushOnNotification`/`sendPushOnMural`. Sem avisos (Mural/WhatsApp) por pedido.

### okr.html v2.8 · okr — 2026-10-07 · Promove pra prod — torre "⭐ Geral" (ADMs de OKR editam todas as torres)

Promoção do `okr-dev.html` v2.8 sobre a v2.7 de prod (merge de 3 vias; dev × prod só diferem nas 27 linhas de ambiente): quem tem `torre='geral'` em `kanban/usuarios/{uid}` cria/edita em todas as torres (continua precisando do papel PO/Organizador ou 🎯 Gestor OKR), escolhe a torre ao criar na Visão global e muda a torre de um Objetivo; a home marca "⭐ sua torre: Geral (edita todas)". Smoke test no `okr.html` real: página 49/49, torres 35/35, Histórico 15/15, torre Geral 15/15, visualizadores 22/22 + 5/5.

### okr-dev.html v2.8 · okr-dev — 2026-10-07 · 🏛️ Torre "⭐ Geral": ADMs de OKR editam todas as torres

Pedido direto: uma torre **Geral** na flag do usuário pra colocar nos ADMs de OKR, que editam qualquer torre quando precisar. `kanban/usuarios/{uid}/torre = 'geral'` (só vale pra PESSOA — Objetivo continua sendo Digital/Comercial/Corporativa). Quem tem a Geral **cria e edita em todas as torres**, mas continua precisando do papel (PO/Organizador ou 🎯 Gestor OKR): a Geral sozinha não dá edição (o Responsável de um Objetivo segue editando o seu). Também: o seletor de torre na ⚙ do Objetivo (e a escolha da torre ao criar na Visão global, que nasce em Digital) vale pra ADM **e** pra quem tem a Geral; a home marca "⭐ sua torre: Geral (edita todas)" na Visão global; `?okr=chat` abre na global; cadastro novo com a Geral não recebe a pergunta de torre. A Ajuda do OKR explica. Testes no Chromium: 15 cenários (Gestor Geral, Geral sem papel, PO da Digital, ADM, home, deep link, painel).

### okr.html v2.7 · okr — 2026-10-07 · Promove pra prod — "+ Visualizador" recusa e-mail com mais de 8 pontos

Promoção do `okr-dev.html` v2.7 sobre a v2.6 de prod (merge de 3 vias; dev × prod só diferem nas 27 linhas de ambiente): o botão **+ Visualizador** recusa e-mail com mais de 8 pontos (as regras do banco só localizam a chave com até 8 `replace`; antes a pessoa ficava autorizada na lista e barrada ao entrar). Smoke test no `okr.html` real: página 49/49, torres 35/35, Histórico 15/15, visualizadores 22/22 + 5/5.

### okr-dev.html v2.7 · okr-dev — 2026-10-07 · fix(/monitorarbugs): visualizador externo com e-mail de mais de 8 pontos era autorizado mas ficava barrado

Achado da auditoria do que subiu hoje. As regras do banco procuram a chave do visualizador trocando "." por "," com **no máximo 8** `replace` encadeados (limitação já documentada em `database.rules.json`), mas a lista (OKR e painel) gravava a chave com TODOS os pontos trocados: um e-mail com mais de 8 pontos entrava na lista e a pessoa continuava barrada ao tentar entrar, sem pista do motivo. Agora o botão **+ Visualizador** recusa com a explicação (precaução: o limite de 8 é o das regras atuais). Também: `guia-okr.html` não fala mais em "aba OKR do Painel" (o OKR tem página própria desde a v5.0 do painel). +3 cenários de teste (21 no total).

### okr.html v2.6 · okr — 2026-10-07 · Promove pra prod — 👁 ADM autoriza visualizador externo sem sair do OKR

Promoção do `okr-dev.html` v2.6 sobre a v2.5 de prod (merge de 3 vias; dev × prod só diferem nas 27 linhas de ambiente): botão **👁 Visualizadores** (só ADM) com lista/adicionar/remover da mesma lista `kanban/painel_viewers` do painel, e parágrafo na Ajuda do OKR. Smoke test no `okr.html` real: página 49/49, torres 35/35, Histórico 15/15, visualizadores 18/18 + 5/5.

### okr-dev.html v2.6 · okr-dev — 2026-10-07 · 👁 ADM autoriza visualizador externo sem sair do OKR

Pedido direto ("só em kanban dá pra autorizar um externo — tem que ter no painel/OKR também"): botão **👁 Visualizadores** (só ADM, ao lado de "Anotações da reunião") abre um modal com a lista de quem só acompanha, e-mail + nome + "+ Visualizador" e ✕ pra remover (confirmação). É a mesma lista de `kanban/painel_viewers` do painel (e-mail da empresa é recusado — já tem acesso; e-mail inválido também). Esc e clique fora fecham; visualizador e não-ADM não veem o botão nem abrem o modal. Texto na Ajuda do OKR. Testes no Chromium: 18 cenários (OKR + painel).

### okr.html v2.5 · okr — 2026-10-07 · Promove pra prod — 🏛️ Torres, Histórico por torre, visualizador externo só leitura

Promoção do `okr-dev.html` v1.4–v2.5 sobre a v1.3 de prod (merge de 3 vias a partir da v1.3-dev; dev × prod só diferem nas 27 linhas de ambiente). O que chega:
- **🏛️ Torres** (v2.0): home com os botões Digital/Comercial/Corporativa + 🔭 Visão global colorida; Objetivo sem torre = Digital; gerências por torre; todos veem tudo, edita só a própria torre (ADM qualquer; Responsável o que é seu); a torre da pessoa vem de `kanban/usuarios/{uid}/torre` (sem o campo = Digital) e cadastro novo sem torre escolhe ao entrar.
- **📈 Histórico por torre** (v2.3/2.4): na visão global compara as torres (cartões, linha por torre + total tracejado, faixas na tabela); abre direto na aba que tem dados (Marcos quando Atingimento está vazio); filtros de período/gerência zeram ao trocar de torre (v2.1/2.2).
- **Cadastro de quem só usa o OKR** (v1.4) e **🟢 Online no OKR** (v1.5).
- **🔒 Visualizador externo só acompanha** (v2.5): lê `kanban/usuarios_publicos`, não mais `kanban/usuarios` (as regras novas fecham essa leitura).
Smoke test no `okr.html` real: página 49/49 (URLs de prod), torres 35/35, Histórico 15 + 10, e2e 11/11, visualizador 5/5. `node --check` OK.

### okr-dev.html v2.5 · okr-dev — 2026-10-07 · 🔒 visualizador externo (só acompanhar) lê o diretório público, não `kanban/usuarios`

Pedido direto: liberar um externo só pra **acompanhar** o OKR e fechar a leitura de `usuarios` pra ele. Visualizador (`kanban/painel_viewers`, só leitura) agora lê `kanban/usuarios_publicos` (nome/foto/sigla/papel) pra mostrar responsáveis e avatares — as regras (`database.rules.json`) deixam de liberar `kanban/usuarios` pra ele (e-mails, notificações e tokens de push de todos). Quem é da empresa segue lendo `kanban/usuarios` (papéis, torre, Gestor OKR). O mesmo vale pra `okr-apresentacao.slide.html` (compartilhada, sem versão: o visualizador lê `usuarios_publicos`; antes, sem isso, a negativa de leitura da regra nova derrubaria a apresentação inteira pra ele). **Ordem de deploy:** promover `okr.html`/`painel.html` ANTES de publicar as regras (prod ainda lê `kanban/usuarios` como visualizador). Testes (Chromium): visualizador lê só `usuarios_publicos` (sem tokens), membro segue em `usuarios`; regras: 22/22 no simulador (`functions/rules`, visualizador lê o OKR, não escreve, não lê `usuarios`).

### okr-dev.html v2.4 · okr-dev — 2026-10-07 · 📈 Histórico abre direto na aba que tem dados

Pedido direto: com a aba 🎯 Atingimento vazia (nenhum Objetivo com meta registrada nos snapshots) e a 🏁 Marcos com dados, o Histórico abria numa tela de "nenhum Objetivo" e a pessoa tinha que descobrir a outra aba (caso real: Atingimento 0, Marcos 25). Agora abre em **Marcos**, com uma dica ("Abrimos aqui porque ainda não há Objetivos com Atingimento registrado nesta visão"). A escolha acompanha a visão: trocar de torre/visão global reavalia (Comercial com atingimento volta pra Atingimento). Clicar numa aba na mão vale até sair do Histórico — a tela não "foge" da escolha da pessoa, nem num re-render por dado novo. 10 cenários no Chromium.

### okr-dev.html v2.3 · okr-dev — 2026-10-07 · 📈 Histórico pensado nas torres: comparativo por torre na 🔭 Visão global

Pedido direto ("esse histórico é bom você repensar pensando nas torres, na visão global"). Dentro de uma torre nada muda (só os Objetivos dela). Na **Visão global** o Histórico passa a **comparar as torres**:
- **Cartão por torre** logo abaixo dos KPIs: nº de Objetivos, atingimento médio, variação vs. snapshot anterior e a contagem por status; clicar filtra a tabela (clicar de novo limpa). A simulação "tirar da conta" vale por torre.
- **Gráfico**: uma linha por torre na cor dela + o **total tracejado**; legenda e dica (ao passar o mouse/tocar) com o % e o nº de Objetivos de cada torre.
- **🔄 O que mudou** mostra a torre de cada Objetivo; **tabela "Por Objetivo"** em faixas por torre (com a média de cada uma) e filtro de torre — o de gerência só aparece quando uma torre está escolhida (o "Geral" das 3 torres não se mistura mais).
- **Janela "Como cada Objetivo contribui"**: na global agrupa por **torre** (modo do gráfico "Por torre", botões todos/nenhum por torre).
- A torre vem do Objetivo atual; se ele foi apagado, da gravada no snapshot (abaixo); sem nenhuma = Digital.
Testes no Chromium (fakefb): 15 cenários novos (global + dentro de uma torre) + suítes anteriores verdes.

### okr-dev.html v2.2 · okr-dev — 2026-10-07 · fix(/monitorarbugs): filtro de gerência do 📈 Histórico sobrevivia à troca de torre

Mesma classe do bug da v2.1, agora no Histórico semanal: escolher "CX" na tabela "Por Objetivo" na torre Digital e entrar na Comercial deixava o filtro `CX` ativo enquanto o select (que só lista as gerências da Comercial) mostrava "Todas as gerências" — tabela vazia ("Nenhum Objetivo com esses filtros") sem pista do motivo. Reproduzido antes; agora o filtro de gerência do Histórico zera ao trocar de torre (como o da lista de Objetivos já fazia).

### okr-dev.html v2.1 · okr-dev — 2026-10-07 · fix(/monitorarbugs): trocar de torre mantinha o filtro de período da torre anterior

Achado da auditoria das Torres. O filtro "Todos os períodos" guardava o trimestre escolhido numa torre ao entrar em outra: se a nova torre não tinha nenhum Objetivo daquele período, a lista ficava vazia ("Nenhum objetivo bate com esse filtro") enquanto o select mostrava "Todos os períodos" — filtro ativo e invisível. Reproduzido antes (Digital com 2026-Q3 → Comercial só com 2026-Q4: 0 cartões, select em branco). Agora o filtro de período zera ao trocar de torre (como a gerência já fazia) e o período escolhido entra sempre nas opções do select (como pessoa/tag).

### okr-dev.html v2.0 · okr-dev — 2026-10-07 · 🏛️ Torres: o OKR passa a ter 3 visões (Digital, Comercial, Corporativa) + Visão global colorida

Pedido direto: vários times vão usar o OKR, então as visões precisam ser divididas. A página inicial agora é uma **home com 3 botões de torre** (🌐 Digital, 🛍️ Comercial, 🏛️ Corporativa) e o botão **🔭 Visão global**; clicar entra nos Objetivos daquela torre, separados (`?torre=` na URL, botão Voltar do navegador funciona). Tudo que já existia vira **Digital** automaticamente (objetivo sem `torre` = Digital, sem migração). Visão global: todos os Objetivos juntos, agrupados por torre e **coloridos** (card do objetivo e chip no modal).
- **Gerências por torre**: cada torre tem a sua lista (Comercial e Corporativa começam só com "Geral"); trocar a torre de um Objetivo na tela ⚙ (só ADM) recarrega as gerências da torre nova.
- **Permissões**: todo mundo **vê** todas as torres; edita só a própria. ADM edita qualquer torre; PO/Gestor OKR só na própria; Responsável sempre edita o que é seu. Criar Objetivo cai na torre aberta (na global, na torre da pessoa).
- **Torre da pessoa**: flag `kanban/usuarios/{uid}/torre`; sem ela = Digital. Quem se cadastrou a partir de 07/10/2026 sem torre vê um aviso ao entrar na página pra escolher (existentes não são perguntados). ADM muda em 👥 Global Users (painel-dev v5.2); o kanban-dev pergunta na inscrição (v8.30.795-dev).
- Histórico/Resumos/estatísticas respeitam a torre aberta; mover e reordenar Objetivos agrupam por torre+gerência; bloco quinzenal continua só pra Digital.
- Fica pra um PR separado (precisa deploy de `functions/`): Agente Ágil, snapshot semanal, resumo diário e apresentação por torre.
Testes no Chromium (fakefb): 35 cenários novos + suítes anteriores verdes.

### okr-dev.html v1.5 · okr-dev — 2026-10-07 · 🟢 Online no OKR: quem está com a página aberta agora

Pedido direto: a página do OKR precisa mostrar quem está online, como o painel faz. Faixa "🟢 Online no OKR (N)" logo abaixo do cabeçalho, com uma pílula por pessoa (foto, ou iniciais quando não há; "(você)" destacada e sempre primeira; até 12 visíveis + "+N" com os nomes no tooltip). Mesmo padrão do "Online no painel" (heartbeat de 15 s, pausado em aba oculta e imediato ao voltar, sem `onDisconnect` — quem some é cortado pelo prazo de 30 s) mas em **node próprio**, `kanban/painel/okr_presence/{uid}` (`{ts, nome, foto}`), pra mostrar só quem está NESTA página — já coberto pelas regras de `kanban/painel` (escrita só da empresa, leitura também do visualizador; **nenhuma mudança de regras nem deploy**). Um relógio de 10 s redesenha a lista (sair não gera evento — sem isso um visualizador sozinho veria fantasmas). Visualizador externo vê a lista mas não aparece nela. Nomes vêm escapados (`esc()`); o "Online no painel" original insere o nome cru e não tem CSS próprio — corrigido só aqui. 10 cenários novos no Chromium (49 na suíte da página): lista com eu primeiro, prazo de 30 s, heartbeat gravado, HTML escapado, saída por tempo, entrada ao vivo, +N, visualizador; E2E 11 e menu 42 verdes; 3 temas/390 px conferidos por captura.

### okr-dev.html v1.4 · okr-dev — 2026-10-07 · cadastro de quem só usa o OKR: aparece na hora, boas-vindas, sem sobrescrever o cadastro do kanban

Pergunta direta: "o processo de cadastro de novos usuários veio pra página do OKR? vai ter gente que só acessa o OKR". Já existia o essencial (cópia de `_painelEnsureUserRecord()`: cria `kanban/usuarios/{uid}` com nome/e-mail/foto no 1º login, SEM squad/papel/sigla — quem só usa o OKR não é matriculado em squad nenhum; o registro parcial é tratado como "usuário novo" pelo `autoRegistrar()` do kanban se a pessoa abrir o board um dia). Mas 3 lacunas, reproduzidas: (1) com a gravação mais lenta que a leitura de usuários (o normal), **a própria pessoa não aparecia nos seletores/avatares até a lista renovar (10 min)** — agora relê os usuários depois do cadastro; (2) **nenhuma explicação pra quem entra pela 1ª vez** — toast de boas-vindas ("acompanha tudo; edita os Objetivos em que for Responsável; pra criar/editar os demais, peça acesso a um ADM"), só quando o registro é criado agora; (3) o cadastro usava `set` (substitui o nó) — se o kanban gravasse o cadastro completo no mesmo instante, seria sobrescrito; agora `update` (mescla). Também: `window._currentUserInit` (que a Central Agente Ágil grava como iniciais do autor) nunca era preenchido aqui — agora usa a sigla do kanban se existir, senão as iniciais do nome. 6 cenários novos no Chromium (41 na suíte da página): usuário novo (campos, sem init/papel/squads, update e não set), aparece nos seletores com gravação lenta, boas-vindas + só leitura, iniciais, sem erros, e cadastro completo do kanban fica intacto sem escrita/boas-vindas. Pra um ADM tornar alguém 🎯 Gestor OKR: 👥 Global Users no painel (lista todo mundo do cache, inclusive sem squad).

### okr.html v1.3 · okr — 2026-10-07 · Promove pra prod — correções das v1.1–v1.3 (colar lista, deep link espera papéis, sair recarrega, visualizador, usuários renovam)

Promoção do `okr-dev.html` v1.1–v1.3 (PRs #1229–#1231) sobre a v1.0 de prod: colar lista em tópicos nas caixas "+ Add" (um item por linha); `?okr=<id>` só abre o Objetivo depois que ADMs/usuários chegaram (PO/Gestor OKR via o modal com 💾 Salvar); sair depois de logado recarrega (listeners do Firebase morrem sem acesso); título de card vinculado lido uma vez; visualizador externo com as caixas de Anotações/Central Agente Ágil desabilitadas (antes perdia o texto em silêncio); usuários/papéis renovam ao voltar pra aba. `okr.html` = `okr-dev.html` com as 6 diferenças de ambiente (título, sem faixa laranja, link pro `painel.html`, versão, `VERSION_KEY='okr'`, sufixo da config do Firebase). Smoke no `okr.html` real: página 35, E2E ao vivo 11, menu de contexto 42, colagem 9.

### okr-dev.html v1.3 · okr-dev — 2026-10-07 · fix(/monitorarbugs): visualizador não perde mais texto digitado; usuários renovam ao voltar pra aba

Auditoria da página nova (2ª rodada). (1) **Visualizador externo (`painel_viewers`) via as caixas de "📋 Anotações da reunião" e "💬 Central Agente Ágil" como se pudesse escrever**: digitava, o campo limpava e a gravação era negada em silêncio pelas regras — o texto sumia sem aviso. Agora as 2 caixas (e os botões Enviar) ficam desabilitadas com "👁 Modo visualização — convidado sem permissão de escrita." (membros da empresa continuam normais). (2) O painel renovava a lista de usuários (papéis/fotos) ao voltar pra aba e retomava uma 1ª leitura que falhou (`visibilitychange`); essa parte da infra não veio na extração — a página ficava, depois de 5 falhas de rede, sem nomes/papéis até recarregar. Voltou, só depois do login. Checado e sem achado: todos os ids de DOM usados pelo código existem na página; nenhum efeito colateral global do painel ficou pra trás (21 declarações com "okr" fora da extração revisadas — todas pertencem ao painel); regras do Firebase cobrem os 7 caminhos de `kanban/okr` (escrita só empresa; leitura também visualizador) e as notificações `okr_editado` seguem permitidas pra quem usa só o OKR (regra por domínio); service worker serve páginas network-first (o antigo redirect `okr.html` não fica preso em cache); `?card=` do kanban existe. **Testes**: pixel-diff `painel-dev` × `okr-dev` em 9 componentes × 3 temas (cartão, barra de filtros, resumo, menu de contexto, modal do Objetivo, modal do Marco, ajuda, Histórico, janela de contribuição) = 0 pixels diferentes (a poda de CSS não perdeu nada); E2E real com listeners ao vivo (criar Objetivo → item de lista → Marco → comentário → arquivar/restaurar → excluir sem órfãos) 11/11; 390 px sem rolagem horizontal em lista/modal/Histórico/janela; suíte da página 35 cenários (4 novos).

### okr-dev.html v1.2 · okr-dev — 2026-10-07 · fix(/monitorarbugs): deep link só abre depois dos papéis chegarem; sair recarrega; sem leitura repetida de cards

Rodada de `/monitorarbugs` na página nova. (1) **`?okr=<id>` abria o Objetivo antes da lista de usuários/ADMs chegar**: a permissão de editar é calculada uma vez ao abrir o modal, então quem edita só por papel (PO/Organizador, 🎯 Gestor OKR, ADM extra) via o Objetivo SEM o 💾 Salvar mesmo depois dos dados chegarem (reproduzido com leitura de usuários de 500 ms: modal aberto aos 250 ms sem Salvar; agora abre aos ~500 ms já editável). O link vem das notificações, então é o caminho mais comum. `_okrTryOpenFromUrl()` só roda depois de objetivos + ADMs + usuários (prazo de 6 s se uma leitura falhar). (2) **Sair e entrar de novo com a mesma conta não reanexava os listeners** (o Firebase cancela os listeners quando a conta perde acesso; a tela ficaria parada sem receber nada ao vivo) — sair depois de logado agora recarrega a página, como o kanban. (3) O título de um card vinculado era lido várias vezes enquanto o modal re-renderizava (leitura em andamento não era rastreada). 2 cenários novos no Chromium (31 no total). Gerado do `painel-dev.html` v4.10.

### okr-dev.html v1.1 · okr-dev — 2026-10-07 · colar lista em tópicos nas caixas "+ Add" cria um item por linha

Mesma correção do checklist do kanban (v8.30.793-dev), agora no OKR: colar 2+ linhas nas caixas "+ Add" de **Indicadores, Progressos, Próximos Passos, Riscos, Planos de Ação, Trimestres** e do **checklist do Marco** cria um item por linha (marcadores `-`/`•`/`1.`/`a)`/`☐` removidos; `[x]`/`[ ]` viram marcado/desmarcado no checklist do Marco). 1 linha só cola normal. Gerado a partir do `painel-dev.html` v4.9 (mesmo código). Chromium: 8 cenários novos + suítes de contexto/abas/página (29) verdes.

### okr.html v1.0 · okr — 2026-10-06 · Promove pra prod — o OKR agora tem página própria (`/okr`), separada do painel

Promoção do `okr-dev.html` v1.0 (PR #1226) como **`okr.html`**, que deixa de ser só um redirect pro painel e passa a ser a própria tela de OKR: Objetivos, Marcos, Atingimento, tags, menu de ações, Histórico semanal com a janela de contribuição, Central Agente Ágil, Anotações da reunião, Ajuda, Guia e Apresentação. Mesmos dados (`kanban/okr/...`), mesmas regras de acesso (Google @ciahering, Microsoft @arezzo, visualizadores de `painel_viewers` só leitura) e de edição. Links antigos continuam valendo: `/okr?okr=<id>` abre o Objetivo e `/okr?okr=chat` a Central Agente Ágil; o "🔗 Copiar link" do painel já gerava `okr.html?okr=<id>`. Cards vinculados sob demanda (título por vínculo, busca só baixa os cards na 1ª digitação, clique abre o board no card em aba nova). Diferenças do dev: sem a faixa laranja, links pra `kanban.html`/`painel.html`, `VERSION_KEY = 'okr'`, config do Firebase sob o sufixo `_okr`. **O painel não foi alterado**: a aba 🎯 OKR continua lá; atalho "🎯 OKR →" e troca dos links (kanban, sino do painel, guia) ficam pra próxima etapa (dev-first). Smoke test no `okr.html` real: 29 cenários da página + suítes de OKR do painel (menu 42, histórico 17, janela 35, abas 12, duplo clique) verdes; `node --check`/`no-undef` OK. Mural: rascunho `seed_okr_pagina_propria_2026_10_06`.

### okr-dev.html v1.0 · okr-dev — 2026-10-06 · OKR numa página só dele, separada do painel (ambiente de teste)

Pedido direto: tirar o OKR de dentro do painel. Primeira etapa: **`okr-dev.html`** — a MESMA tela da aba 🎯 OKR do `painel-dev.html` v4.8 (Objetivos, Marcos, Atingimento, tags, menu de contexto, Histórico semanal com a janela de contribuição, Central Agente Ágil, Anotações da reunião, Ajuda, deep links `?okr=<id>` / `?okr=chat`), em página própria. O `painel-dev.html` **não foi alterado** nesta etapa (o atalho 🎯 OKR → página e a troca dos links vêm só depois da validação).
- **Como foi feito:** o código de OKR veio do painel por extração mecânica (análise de AST: as ~280 funções/consts de OKR + o mínimo de infra de que elas dependem — tema, `esc`/`jsq`, toasts/confirmações, o motor de atingimento, etc.), sem reescrever comportamento. Mesmos caminhos do Firebase (`kanban/okr/...`, **os mesmos dados do painel de produção** — por isso a faixa laranja no topo), mesmas regras de edição (ADM / PO / Organizador / 🎯 Gestor OKR / Responsável).
- **Acesso idêntico ao do painel:** @ciahering.com.br só pelo Google, @arezzo.com.br só pela Microsoft (mesma mensagem de "botão errado"), qualquer outro e-mail só como visualizador de `kanban/painel_viewers` (somente leitura, cache de 15 min, 3 tentativas). Quem só usa o OKR ganha o registro em `kanban/usuarios/{uid}` no 1º login (sem squad/papel), como no painel. Os listeners só sobem **depois** do login.
- **Cards vinculados sob demanda** (o painel baixava os cards de TODOS os squads só pra isso): o título de cada vínculo vem de 2 leituras pontuais (`dados/cards_index/{id}` → `dados/cards/{chave}`), e a busca "🔎 Buscar card com badge OKR" só baixa `cards`+`tags` de cada squad **na 1ª vez que alguém digita** (guarda só os cards com badge OKR, em memória). Clicar num vínculo abre o board no card (aba nova, `kanban-dev.html?squad=…&card=…`); card removido/sem acesso aparece como "(card não encontrado)" / "(sem acesso ao card)". A lista "Cards do board com badge OKR" continua só no painel.
- **Mudanças de infra** (única diferença de comportamento): link "🔗 Copiar link" gera `okr-dev.html?okr=<id>`; `?okr=<id>` não precisa trocar de aba; lista de usuários (`loadGlobalUsers`) e de ADMs (`kanban/config/adm_emails`) enxutas; auto-atualização por `version.json` (chave `okr_dev`).
- **Testes** (Chromium, Firebase falso em memória que roda o boot real da página): 29 cenários novos (portão de login com provedor errado/externo/visualizador/ADM, listeners só após login, nenhum card baixado no boot, títulos sob demanda, busca com cache e regra de badge OKR, vínculo + histórico "vinculou o card", usuário criado, deep links, tema) + as suítes do OKR do painel reaproveitadas contra a página nova (menu de contexto 42, histórico 17, janela de contribuição 35, abas Atingimento/Marcos 12, atingimento 12+17+13+27, filtro, tags 13+17, XSS de tag, duplo clique) — todas verdes. `node --check`, `no-undef` (ESLint) e checagem de handlers inline sem pendências.


## painel.html / painel-dev.html

### painel.html v5.20 · painel — 2026-10-08 · Promove pra prod — a aba "🎯 OKR ↗" e os cliques do sino abrem o OKR em aba nova

Promove painel-dev v5.20 (prod estava na v5.19) + `mare-notif.js` v7 (novo `MareNotif.abrirPagina()`: aba nova; se o navegador bloquear, navega na mesma). Sem avisos.

### painel-dev.html v5.20 · painel-dev + okr-dev v2.36 + `mare-notif-dev.js` (?v=7) — 2026-10-08 · links entre páginas abrem em ABA NOVA

Pedido direto: "os links de redirecionamento (okr em painel, painel em okr…) precisam abrir uma nova aba". **Painel**: a aba "🎯 OKR ↗" (e `swPtab('okr')`) e os cliques do sino do painel em reunião/Objetivo do OKR abrem o OKR numa aba nova (uma só — não duas); o painel continua onde estava. **OKR**: o botão "🐟 Painel" e os cliques do sino que levam a outra página (card → kanban, etc.) abrem aba nova; notificação de Objetivo/reunião do próprio OKR segue abrindo o modal aqui. **Módulo do sino**: novo `MareNotif.abrirPagina(url)` (aba nova; se o navegador bloquear, navega na mesma) — `abrirFeed` passou a usá-lo e não espera mais 0,8 s pelo "lido" (a página atual continua viva, então a gravação termina sozinha, e abrir direto no clique evita o bloqueio de popup do Safari). O encaminhamento de link antigo (`painel?okr=…` → OKR) continua na mesma aba. Teste: 16 cenários no Chromium (aba nova abre, página atual não muda, 1 aba só, fallback com popup bloqueado).

### painel.html v5.19 · painel — 2026-10-07 · Promove pra prod — reuniões do OKR no sino do painel, status dos visualizadores

Promove painel-dev v5.17 → v5.19 (prod estava na v5.16): o sino do painel abre a reunião do calendário do OKR ao clicar, a lista de 👁 Visualizadores externos mostra "já entrou / online agora" (o painel também registra o acesso do visualizador) e `mare-notif.js` v6.

### painel.html v5.16 · painel — 2026-10-07 · Promove pra prod — sino único (todos veem), rodapé do sino e visualizadores no Online

Promoção de painel-dev v5.10 → v5.16 (merge de 3 vias a partir da v5.9; as divergências permanentes dev×prod do painel ficam como estavam). **Sino único**: o 🔔 do painel passa a existir pra qualquer pessoa (antes só ADM) e mostra as notificações pessoais **mais** as novidades da torre (aviso do Mural, Objetivo criado, Marco concluído) pelo módulo compartilhado `mare-notif.js`; só os **lembretes de squad** seguem exclusivos de ADM; mesma validade do kanban (lida some em 3 dias, não lida em 30); notificações `okr_*` levam à página do OKR; rodapé do sino (🔊/🔇, permissão neste aparelho, 🔕 Não Perturbe) com push via `firebase-messaging`. **Online no OKR** (Visão): mostra visualizadores externos com o selo 👁. **Textos**: Dashboard (antes "Histórico" do OKR) e 🛒 Digital no seletor de torre do Global Users. Sem avisos (Mural/WhatsApp) por pedido.

### painel.html v5.9 · painel — 2026-10-07 · Promove pra prod — menu de páginas do Maré (clique no título) + torre "⭐ Geral" no Global Users

Promoção do `painel-dev.html` v5.9 sobre a v5.8 de prod (merge de 3 vias; dev × prod só diferem nas linhas de ambiente e nos blocos já divergentes de sempre): (1) clicar em "🐟 Maré Digital Painel ▾" abre a lista de páginas — OKR, OKR dev, Kanban, Kanban dev, Painel, Painel dev —, atual marcada "você está aqui"; (2) 👥 Global Users: seletor e filtro de torre ganham **⭐ Geral (todas)**. Smoke test no `painel.html` real: menu 10/10 (página atual = painel.html), Global Users/torre Geral 15/15, redirecionamentos 17/17, Online no OKR 7/7.

### painel-dev.html v5.9 · painel-dev — 2026-10-07 · menu de páginas do Maré (clique no título) + torre "⭐ Geral" no Global Users

Dois pedidos diretos. (1) **Menu de páginas**: clicar em "🐟 Maré Digital Painel ▾" no cabeçalho abre uma listinha (como o seletor de squads do kanban) com as 6 páginas — OKR, OKR dev, Kanban, Kanban dev, Painel, Painel dev —, a atual marcada "você está aqui", as de teste com a etiqueta "dev · testes"; Esc, clique fora e clicar de novo fecham. (2) **👥 Global Users**: o seletor de torre da pessoa ganhou **⭐ Geral (todas)** (e o filtro por torre também) — ver okr-dev v2.8. Testes no Chromium: menu 10/10 + Global Users (Geral, gravação só em `usuarios/{uid}`, filtro).

### painel.html v5.8 · painel — 2026-10-07 · Promove pra prod — o botão 👁 Visualizadores externos de 👥 Global Users passa a abrir por cima

Promoção do `painel-dev.html` v5.7 + v5.8 sobre a v5.6 de prod (merge de 3 vias; dev × prod só diferem nas linhas de ambiente e nos blocos já divergentes de sempre): (1) **fix** — o botão 👁 em 👥 Global Users "não fazia nada": o modal abria por baixo do Global Users (mesmo `z-index`, ordem do HTML); agora `z-index:9200`; (2) o "+ Visualizador" (aba ADMs e esse modal) recusa e-mail com mais de 8 pontos. Smoke test no `painel.html` real: o campo de e-mail do modal é o elemento do topo; redirecionamentos 17/17, Online no OKR 7/7, visualizadores 22/22.

### painel-dev.html v5.8 · painel-dev — 2026-10-07 · fix (relato direto): o botão 👁 Visualizadores externos de 👥 Global Users "não fazia nada"

O modal abria, mas **por baixo** do 👥 Global Users: os dois usam `.cfg-ov` (`z-index:9100`) e o novo vem antes no HTML, então ficava atrás e a tela parecia igual. Reproduzido antes (o campo de e-mail não era o elemento do topo). Agora `#viewers-ov` tem `z-index:9200`. O teste da v5.5 só conferia a classe `open` — passou a conferir o que está no topo da tela. **`painel.html` (prod, v5.6) tem o mesmo problema** — correção de 1 linha, aguardando validação no dev.

### painel-dev.html v5.7 · painel-dev — 2026-10-07 · fix(/monitorarbugs): + Visualizador recusa e-mail com mais de 8 pontos

Mesmo achado do okr-dev v2.7, na lista de visualizadores externos do painel (aba ADMs e modal de 👥 Global Users).

### painel.html v5.6 · painel — 2026-10-07 · Promove pra prod — aba Visão ganha "🎯 Online no OKR"; Visualizadores externos mais fáceis de achar

Promoção do `painel-dev.html` v5.5 + v5.6 sobre a v5.4 de prod (merge de 3 vias; dev × prod só diferem nas linhas de ambiente e nos blocos já divergentes de sempre): (1) **nova linha "🎯 Online no OKR"** na aba Visão (lê `kanban/painel/okr_presence`, o heartbeat que a própria página do OKR já escreve; corte de 30 s, nomes escapados); (2) a seção de visualizadores externos virou "(painel e OKR)", com explicação, e ganhou o botão **👁 Visualizadores externos** em 👥 Global Users (só ADM). Smoke test no `painel.html` real: redirecionamentos 17/17, Online no OKR 7/7, visualizadores 18/18.

### painel-dev.html v5.6 · painel-dev — 2026-10-07 · aba Visão: nova linha "🎯 Online no OKR"

Pedido direto: a aba Visão mostrava "Online no board" e "Online no painel"; agora mostra também **quem está com a página do OKR aberta**. Lê `kanban/painel/okr_presence` (o heartbeat de 15 s que a própria página do OKR já escreve — o painel só lê, sem escrita nova nem mudança de regras). Mesmo corte de 30 s das outras presenças, com um relógio de 10 s pra tirar quem fecha a aba sem gerar evento; nomes escapados. Testes no Chromium: 7 cenários (contagem, filtro por nome/tempo, ordem alfabética, nome com HTML, vazio, expiração sem evento).

### painel-dev.html v5.5 · painel-dev — 2026-10-07 · 👁 Visualizadores externos mais fáceis de achar (e dizem que valem pro OKR)

Os visualizadores externos (`kanban/painel_viewers`) só eram gerenciáveis em ⚙ Configurações → 🔑 ADMs (precisa escolher um squad antes) e o texto só falava do painel. Agora: (1) a seção se chama **"Visualizadores externos (painel e OKR)"** e explica que a pessoa só acompanha, vê as 3 torres, não edita e entra com o Google direto em okr.html; (2) botão **👁 Visualizadores externos** no topo de 👥 Global Users (só ADM) abre um modal com a mesma lista e o formulário de adicionar, sem passar por squad nenhum (`renderPainelViewers()` agora renderiza nos 2 lugares; `addPainelViewer('modal')`). A aba ADMs segue igual.

### painel.html v5.4 · painel — 2026-10-07 · Promove pra prod — a aba 🎯 OKR vira atalho pra página própria (okr.html), torre no Global Users, correção do nome em "Online", visualizador sem `usuarios`

Promoção do `painel-dev.html` v4.10 → v5.4 (merge de 3 vias a partir da v4.10-dev; dev × prod só diferem nas linhas de ambiente e nos blocos já divergentes de sempre). **As versões 5.0–5.4 vão juntas** (a v5.0 sozinha redirecionava o painel inteiro pro OKR; a v5.1 corrige):
- **OKR em página própria**: o conteúdo da aba sai do painel e o botão leva a `okr.html` (links antigos `?okr=<id>`/`?tab=okr` repassam). A aba salva no navegador como "okr" é descartada (não redireciona sozinho). A lista "Cards do board com badge OKR" voltou pra aba Visão.
- **👥 Global Users**: seletor de **torre** por pessoa (ADM) + filtro "Todas as torres"; o chip Gestor OKR vale na torre da pessoa.
- **Segurança**: nome na lista "Online" (board e painel) agora é escapado (antes um nome malicioso rodava JS na sessão de quem abrisse o painel — reproduzido em prod antes do fix); visualizador externo lê `usuarios_publicos` em vez de `kanban/usuarios`.
Smoke test no `painel.html` real: redirecionamentos e abas 17/17. `node --check` OK; balanço de parênteses -17 (era -21 em prod: o código do OKR saiu).

### painel-dev.html v5.4 · painel-dev — 2026-10-07 · visualizador externo lê `usuarios_publicos` (a leitura de `kanban/usuarios` fecha pra ele)

Mesmo motivo do okr-dev v2.5: `loadGlobalUsers()` e a lista de membros por squad usam `kanban/usuarios_publicos` quando `window._isPainelViewer` (o painel do visualizador só precisa de nome/foto/sigla); quem é da empresa segue em `kanban/usuarios`. Regras: ver okr-dev v2.5.

### painel-dev.html v5.3 · painel-dev — 2026-10-07 · fix(/monitorarbugs): nome na lista "Online" era injetado como HTML (XSS armazenado)

`renderOnline()` (Online no board) e `renderPainelOnline()` (Online no painel) montavam a pílula com `u.nome` cru. O nome vem de `presence/{uid}`, que qualquer membro grava — um nome como `<img src=x onerror=…>` rodava JS na sessão de quem abrisse o painel (inclusive ADM). Reproduzido no Chromium antes (2 execuções no `painel.html` de prod; 0 depois do fix no dev): agora `esc()` no nome e no ícone do squad. **`painel.html` (prod) ainda tem o problema** — mesma correção de 3 linhas, aguardando sinal verde pra promover.

### painel-dev.html v5.2 · painel-dev — 2026-10-07 · 👥 Global Users: ADM define a Torre de cada pessoa (+ filtro)

Recurso **Torres**: cada pessoa ganha a flag `torre` em `kanban/usuarios/{uid}` (`digital` | `comercial` | `corporativa`; sem o campo = Digital, então todo mundo que existe hoje já é Digital sem nenhuma gravação em massa). Na lista do 👥 Global Users, cada linha ganhou um seletor de torre (só ADM altera; grava apenas em `usuarios/{uid}`, mesmo critério do toggle "Gestor OKR") e a barra de filtros ganhou **Todas as torres**. O chip "Gestor OKR" agora vale na torre da própria pessoa. `torre` entrou na regex `_GU_FIELD_RE` (mudança remota da flag re-renderiza a lista).

### painel-dev.html v5.1 · painel-dev — 2026-10-07 · fix (relato direto): o painel inteiro redirecionava pro OKR a cada carregamento

Regressão da v5.0. O painel guarda a última aba aberta em `localStorage` (`_painel_tab`) e `_restoreTab()` a restaura ~300 ms depois do boot — quem usava a aba OKR antes dela virar atalho tinha `okr` salvo, então o `swPtab('okr')` da restauração (que agora NAVEGA pra `okr-dev.html`) mandava o painel inteiro pra página do OKR toda vez que abria, não só no clique da aba. Reproduzido antes (URL final `okr-dev.html`) e corrigido: `_restoreTab()` descarta `okr` (e limpa a chave) em vez de restaurar; as demais abas salvas continuam sendo restauradas. O OKR só abre por clique/link explícito. (Eu tinha anotado `_restoreTab()` como código morto na rodada de 2026-09-06 — estava vivo, chamado no `fb-ready`; o cenário de teste da v5.0 usava navegador limpo, sem aba salva.) 2 cenários novos (17 na suíte do redirecionamento). **Na promoção pro `painel.html`** isto TEM que ir junto com a v5.0, senão o mesmo acontece em produção.

### painel-dev.html v5.0 · painel-dev — 2026-10-07 · feat!: a aba 🎯 OKR vira um atalho pra página própria (okr-dev.html); o código do OKR sai do painel

Pedido direto: "pra não ficar repetido e diminuir a chance de erros, tira o conteúdo da aba OKR do painel e faz o botão da aba ser um redirecionador pra página nova (prod pra prod, dev pra dev)". A aba "🎯 OKR" agora é um **link** (`<a href="okr-dev.html">`, "OKR ↗") — e `swPtab('okr')` (sino do painel, deep links) também navega pra lá. Links antigos continuam valendo: um `<script>` no `<head>` repassa `?okr=<id>`, `?okr=chat` e `?tab=okr` pra `okr-dev.html` antes de a página carregar (as notificações do kanban ainda apontam pro painel e passam por esse redirecionamento). **Removido** (extração mecânica por AST + varredura de código morto, nada escrito à mão): ~340 declarações do OKR (Objetivos/Marcos, Atingimento, menu de contexto, Histórico + janela de contribuição, Central Agente Ágil, Anotações, tags, ajuda, apresentação), ~243 KB de JS, os 3 blocos de HTML (aba, ajuda, 7 modais) e ~34 KB de CSS `.okr-*` sem uso; `loadOkr()` deixou de rodar no boot (o painel não lê mais `kanban/okr/*`). **Ficou**: `renderOKR()` — a lista "🎯 Cards do board com badge OKR" (lê os cards dos squads) **voltou pra aba Visão**, onde nasceu —, o toggle 🎯 Gestor OKR do 👥 Global Users e as classes `.okr-stat-chip` usadas pelos filtros dele. Dev×prod: o `painel.html` continua com o OKR até a validação; ao promover, aponta pra `okr.html`. Chromium: 15 cenários (5 formas de link antigo, `?tab=pessoas` não redireciona, aba é `<a href>`, nada de OKR no DOM/`window`, lista de cards OKR na Visão, troca de todas as abas, clique e `swPtab` navegam, sem erro de JS); `node --check` OK; `no-undef` sem referência pendente; handlers inline sem pendências. Balanço -1/-19.

### painel.html v4.10 · painel — 2026-10-07 · Promove pra prod — colar lista em tópicos nas caixas "+ Add" do OKR cria um item por linha

Promoção do `painel-dev.html` v4.9 + v4.10 (merge de 3 vias a partir da v4.8): Indicadores/Progressos/Próximos Passos/Riscos/Planos de Ação/Trimestres e checklist do Marco passam a aceitar uma lista colada (um item por linha, marcadores removidos, `[x]`/`[ ]` no checklist do Marco; "J. Silva" e "-5 pontos" intactos; 1 linha cola normal). Smoke no `painel.html` real: colagem 9 + menu de contexto 42 verdes. Mural: rascunho `seed_colar_lista_checklist_2026_10_07` (também cobre o kanban).

### painel-dev.html v4.10 · painel-dev — 2026-10-07 · fix: colar lista com iniciais de nome ("J. Silva") não perde a inicial (só painel-dev)

O marcador de letra do parser de colagem (v4.9) aceitava `A.` além de `a)` e comia a inicial de nomes: a linha "J. Silva enviou a proposta" virava "Silva enviou a proposta". Agora só `a)`/`B)` conta como marcador. (O mesmo vale pro checklist do kanban, v8.30.794-dev.)

### painel-dev.html v4.9 · painel-dev — 2026-10-07 · colar lista em tópicos nas caixas "+ Add" do OKR cria um item por linha (só painel-dev)

Mesma correção do checklist do kanban (v8.30.793-dev): o `<input>` de uma linha achatava as quebras e a lista colada virava UM item. `_okrParsePasted()` + `_okrPasteList()`/`_okrPasteChecklist()` (`onpaste` nas caixas de Indicadores/Progressos/Próximos Passos/Riscos/Planos de Ação/Trimestres e no checklist do Marco): 2+ linhas → um item por linha, sem marcadores do começo, `[x]`/`[ ]` entendidos no checklist do Marco; 1 linha cola normal; toast com a contagem. Chromium (8 cenários) em `painel-dev.html` e `okr-dev.html`. Só dev; o prod recebe quando validado.

### painel.html v4.8 · painel — 2026-10-06 · Promove pra prod — Histórico semanal redesenhado (abas Atingimento/Marcos), janela do progresso médio, Excluir no menu e datas nos históricos

Promoção do lote acumulado de `painel-dev.html` desde a v4.1 (prod anterior): **v4.2** 🗑 Excluir no menu de contexto do Objetivo (só ADM, com confirmação); **v4.3** 📈 Histórico semanal redesenhado (cabeçalho com último/próximo snapshot e período, 6 indicadores com variação, gráfico de barras + linha, "O que mudou", tabela Por Objetivo com
filtros, mini-tendência e detalhe semanal); **v4.4** Histórico do Objetivo/Marco com data e hora completas (sem "3d/4d/5d"); **v4.5–v4.7** janela "Como cada Objetivo contribui" (clique no indicador médio): média em destaque, quem puxa pra baixo/sustenta, filtros em chips (período, linhas, status, gerência), Objetivos como chips que
tiram da conta e recalculam, gráfico de linhas (⭐ Destaques, todas coloridas, por gerência, só a média, mini-gráficos) e destaque por hover; **v4.8** o Histórico ganha duas abas — **🎯 Atingimento** (padrão; curva reconstruída pelos registros quando o snapshot é antigo) e **🏁 Marcos**. `guia-okr.html` ganhou o slide "📈 Histórico semanal"
e o menu de ações com Excluir. Merge de 3 vias (prod atual, dev da v4.1 como base, dev atual); a diferença prod novo × antigo é a do dev no período (só a linha de versão difere do dev). Smoke test no `painel.html` real: Histórico 17/17, janela 35/35, abas 12/12, menu 41/42 (o 1 é só o URL esperado pelo teste), duplo clique OK. `node --check` OK; balanço -1/-16 no baseline.
Mural: rascunho `seed_okr_historico_2026_10_06`.

### painel-dev.html v4.8 · painel-dev — 2026-10-06 · feat(OKR): Histórico com duas abas — 🎯 Atingimento (padrão) e 🏁 Marcos

Pergunta direta ("como você calculou esse progresso? é com base no atingimento?"). Resposta: o `% de progresso` do snapshot semanal era **misto** — o mesmo da barra do cartão: **atingimento quando o Objetivo tem meta, senão % de Marcos concluídos** (`progressoDoObjetivo()` em `weeklySnapshot.js`) —, então a média misturava
2 réguas e um Objetivo que passava a ter meta "caía/subia" de repente na curva (ex.: −75 pp na semana em que a origem do número mudou). Agora o Histórico tem **duas abas**: **🎯 Atingimento** (padrão: só Objetivos com 📈 meta configurada; o ♾️ perene fica de fora) e **🏁 Marcos** (marcosConcluidos ÷ totalMarcos; sem Marcos, fora).
Indicadores, gráfico, "O que mudou", tabela por Objetivo, detalhe semanal e a janela do progresso médio **seguem a aba**, e cada aba mostra quantos Objetivos tem. Na aba Atingimento vale o `atingimentoPct` gravado no snapshot; se o snapshot é de antes do atingimento existir, a curva é **reconstruída pelos registros de valor** (data ≤ data do snapshot) do Objetivo
atual — assim já nasce com histórico. Sem dados na aba: estado vazio explicando e botão "Ver por Marcos". Nenhum campo novo no snapshot (nenhum deploy de Cloud Function). Ajuda e CODE_MAP atualizados. 12 cenários novos no Chromium (contagem nas abas, filtro por visão, reconstrução, valor gravado × reconstruído, média de Marcos, janela acompanhando a aba, estado vazio) + as suítes anteriores (17, 35, 42). Só dev.

### painel-dev.html v4.7 · painel-dev — 2026-10-06 · fix(OKR): gráfico da janela do Progresso médio menos confuso (Destaques, destaque por hover, mini-gráficos)

Feedback direto (print com 25 linhas coloridas, "tá muito confuso, pensa melhor"): com muitos Objetivos, 1 linha colorida por Objetivo vira um emaranhado. Agora o padrão é **⭐ Destaques**: a **média numa linha branca grossa**, os **3 Objetivos que mais subiram (verde) e os 3 que mais caíram (vermelho)** com o nome e o valor no fim da linha
(rótulos sem sobreposição), e **todos os demais em cinza de fundo**; há também linhas verticais por snapshot. **Passar o mouse** numa linha, **num chip** ou **numa linha da tabela** destaca só aquele Objetivo (cor, espessura e nome no gráfico) e esmaece o resto.
Novos modos nos chips "Linhas do gráfico": **Todas coloridas** (o desenho antigo), **Por gerência**, **Só a média** (com a faixa mín–máx) e **📊 Mini-gráficos** — um cartão por Objetivo, com a linha dele, a média tracejada ao fundo e a variação no período, ordenados do que mais caiu pro que mais subiu.
Ajuda e CODE_MAP atualizados. 35 cenários no Chromium (Destaques, hover em chip/tabela/linha, mini-gráficos, modos, filtros, recálculo, teclado, XSS). Só dev.

### painel-dev.html v4.6 · painel-dev — 2026-10-06 · feat(OKR): janela do Progresso médio maior, com chips e gráfico de linhas (cada Objetivo + a média)

Pedido direto sobre a janela do v4.5 ("tá pequena", "no estilo do Dados do Board, chips de filtros", "gráfico de linha com cada Objetivo e a média no meio", "média em destaque + chips pra personalizar a visão"):
- **Janela grande** (até 1400px, 97% da tela) e reorganizada: **média em destaque** (número grande, variação vs. semana anterior com os mesmos Objetivos) + caixas **"Mais puxam a média pra baixo"** e **"Mais sustentam a média"**.
- **Chips de visão**: ⏱ período (4/8/12 sem/Tudo — o mesmo do Histórico), 📈 linhas do gráfico (**Por Objetivo / Por gerência / Só a média**, esta com a **faixa do menor ao maior**), 🚦 **status** do Objetivo e 🏢 **gerência**; "limpar filtros".
- **Gráfico de linhas**: uma linha por Objetivo na conta (cor própria, que aparece também num tracinho no chip dele) e a **média como linha grossa em destaque no meio delas**, com rótulo "média N%" no fim; passar o mouse destaca a linha mais próxima e mostra data, Objetivo, valor e média.
- **Objetivos como chips** agrupados por gerência (com média da gerência e "todos/nenhum"), no lugar da lista com checkbox: clicar tira da conta e **tudo recalcula** (média, gráfico, indicador e tabela). A tabela "Contribuição de cada Objetivo" (contribui, efeito se sair, Δ semana, marcos) continua abaixo.
- Ajuda, CODE_MAP atualizados. 30 cenários no Chromium (chips, linhas, modos, status, período, hover, teclado, XSS, persistência). Só dev.

### painel-dev.html v4.5 · painel-dev — 2026-10-06 · feat(OKR): Histórico — clique no "Progresso médio" mostra a contribuição de cada Objetivo (com filtro de gerência e simulação)

Pedido direto: ao clicar no indicador **Progresso médio** do 📈 Histórico, abre a janela **🧮 Como cada Objetivo contribui para o progresso médio**, sobre o último snapshot:
- média grande + variação vs. o snapshot anterior (**só com os mesmos Objetivos** nos dois, pra comparar igual com igual) e "N de M Objetivos na conta";
- uma linha por Objetivo: progresso, **quanto contribui** (progresso ÷ N, em pp), **o que acontece com a média se ele sair da conta** e a variação da semana;
- **filtro por gerência**, ordenação (puxam a média pra baixo / maior progresso / A–Z), **Marcar todos / Desmarcar todos** (da gerência filtrada) e **Restaurar tudo**;
- **desmarcar um Objetivo tira ele da conta e a média recalcula sozinha**; o indicador e a linha do gráfico por trás acompanham, com um aviso "Simulação: sem N Objetivos" e botão para restaurar. A exclusão é só uma simulação local (fica no `localStorage`, não grava no Firebase nem
  muda pra outras pessoas), no mesmo espírito dos toggles de colunas em Dados do Board. Também: variações com vírgula decimal. Ajuda e CODE_MAP atualizados. 19 cenários no Chromium (abrir, contas, efeito de sair, desmarcar/recalcular, filtro, marcar/desmarcar todos, ordenar, Esc, restaurar, persistência, teclado, XSS). Só dev.

### painel-dev.html v4.4 · painel-dev — 2026-10-06 · ajuste(OKR): Histórico do Objetivo/Marco mostra sempre a data (sem "3d/4d/5d")

Pedido direto, mesma mudança do Histórico do card no kanban (v8.30.790-dev): a linha do tempo no fim do Objetivo/Marco mostrava "agora / 5min / 3h / 4d" e só depois de 7 dias a data. Agora toda linha mostra **data e hora completas**
(`06/10/2026 14:32`). Só `_okrHistRelTime()`. A tela 📈 Histórico semanal não muda ("há N dias" no cabeçalho do último snapshot continua, porque ali é um aviso de frescor, não a data de um evento). Só dev.

### painel-dev.html v4.3 · painel-dev — 2026-10-06 · feat(OKR): 📈 Histórico semanal redesenhado (mais informação, UI/UX e design)

Pedido direto ("falta informação, UI/UX, melhorar design"). Antes: um gráfico de barras e um dropdown que abria uma tabela. Agora, tudo só com os dados que o snapshot semanal já guarda (nada novo na Cloud Function):
- **Cabeçalho**: data do último snapshot ("há N dias"), quando sai o próximo (sexta 17h), quantos snapshots existem e período do gráfico (**4 / 8 / 12 sem / Tudo**).
- **6 indicadores** (Objetivos ativos, Concluídos, No prazo, Risco, Atrasados, Progresso médio) com a **variação vs. a semana anterior** (verde = melhora, vermelho = piora; para Risco/Atrasados, subir é ruim).
- **Gráfico**: barras por status + **linha do progresso médio (%)**, eixos dos dois lados, dica ao passar o mouse/tocar com data, contagem por status e média.
- **🔄 O que mudou** entre os dois últimos snapshots: piorou/melhorou de status, progresso subiu/caiu, Objetivos novos e os que saíram; clicar leva ao Objetivo na tabela.
- **Por Objetivo**: tabela com status, barra de progresso, Δ pp, mini-tendência, marcos e ícone do atingimento; **busca, filtros de gerência e status e ordenação** (A–Z, maior alta, maior queda, pior status, maior progresso). Clique (ou Enter) expande a **curva de progresso** + quadro semana a semana (status, progresso, Δ, marcos, atingimento) e o botão 📂 Abrir Objetivo.
- Estados vazios explicados (sem snapshot / só 1 snapshot), layout para celular, 3 temas, títulos escapados. 17 cenários no Chromium (filtros mantêm o foco, dica, expandir, teclado, XSS, temas e mobile). Ajuda do OKR atualizada. Só dev.

### painel-dev.html v4.2 · painel-dev — 2026-10-06 · feat(OKR): 🗑 Excluir no menu de contexto do Objetivo (só ADM)

Pedido direto ("no menu de contexto okr faltou a opção excluir"): na v3.111 o Excluir tinha ficado de fora de propósito; agora o menu do **Objetivo** tem **🗑 Excluir** (tecla **X**), logo depois de Arquivar. Mesma regra do botão do
modal: **só ADM**, com a mesma confirmação ("apaga também N marco(s)… não dá pra desfazer") e o mesmo apagamento definitivo (Objetivo, Marcos e comentários dos Marcos). Como pelo menu não há modal pra fechar, a lista de Objetivos
é redesenhada na hora. Marco continua só com **Arquivar** (não existe exclusão de Marco em lugar nenhum). Ajuda do OKR e CODE_MAP atualizados. 42 cenários no Chromium (4 novos: ADM vê e usa X, apaga em cascata, recusar não apaga, não-ADM não vê).
Só dev; o guia ganha a mudança quando for promovido.

### painel.html v4.1 · painel — 2026-10-06 · Promove pra prod — painel v4 (lote OKR: menu de ações, ajustes de gráfico, help)

Promoção do lote acumulado de `painel-dev.html` desde a v3.110 (prod anterior): **v3.111** menu de contexto (clique direito) nos Objetivos e nos Marcos — registrar atingimento (modal rápido), status do Marco,
tags, mover, duplicar, arquivar (só ADM), copiar link, com atalhos de teclado e gravação por transação; **v3.112** o botão Registrar do modal rápido não lança o mesmo registro duas vezes (duplo clique / Enter repetido);
**v3.113** sem o botão ⋯ (o menu abre pelo clique direito) + Ajuda do OKR atualizada (ordem, tags, filtro por tag, ← Anterior, texto que rola na apresentação); **v4.0** marco de versão; **v4.1** gráfico de evolução:
a linha "início" virou "valor inicial" e some quando é 0. A promoção usou merge de 3 vias com o dev da v3.110 como base; a diferença entre o prod novo e o antigo é exatamente a diferença do dev no período (só a linha de versão difere
do dev). Mural: rascunho `seed_okr_v4_2026_10_06`. Smoke test no `painel.html` real (menu 36/37 — o 37º é só o URL esperado pelo teste —, duplo clique, gráfico 17/17, "valor inicial").

### painel-dev.html v4.1 · painel-dev — 2026-10-06 · fix(OKR): gráfico de evolução — a linha "início" virou "valor inicial" (e some quando é 0)

Relato do usuário (print do gráfico): a linha pontilhada rotulada **"início"** parecia o começo do período, e a primeira bolinha (14/09, acima da linha) parecia "não ser o início". Na verdade era o **valor
inicial** configurado no Objetivo (ponto de partida da fórmula do %). Agora o rótulo é **"valor inicial"** e, quando esse valor é **0**, a linha não é desenhada (só repetia o eixo). A mesma mudança vale na
**apresentação** (`okr-apresentacao.slide.html`, o gráfico é o mesmo bloco — vale assim que o Pages publicar). Teste de paridade painel × apresentação, 17 cenários do gráfico e fuzz de 600 casos continuam OK.

### painel-dev.html v4.0 · painel-dev — 2026-10-06 · marco: painel passa pra v4 (OKR: atingimento, gráfico, tags, menu de contexto, ordem/duplicar/configurações em tela própria) + guia atualizado

Sem mudança de código além do número: o painel pula de v3.113 para **v4.0** porque o OKR ganhou muito desde a v3.x (📈 atingimento com 8 tipos e gráfico de evolução, modal por seções, tags com cor e filtro,
filtro por pessoa, reordenar/duplicar/Configurações em tela própria, menu de contexto, Agente Ágil lendo e registrando atingimento). Quando for promovido, o prod sai como **v4.0 · painel**.
`guia-okr.html` (sem versão própria; vale na hora): o slide "Apresentação ao vivo" deixou de dizer "sem precisar rolar" para o detalhe, ganhou **ordem manual**, **tags + filtro por tag**, e um slide
novo "Dentro do detalhe do Objetivo" (**← Anterior / Próximo →**, **texto longo rola**, contadores de caracteres, "Aparecer na apresentação", "Colapsar concluídos"). O slide do **menu de contexto** entra no guia
junto com a promoção do painel v4.0 (hoje o menu só existe no dev).

### painel-dev.html v3.113 · painel-dev — 2026-10-06 · ajuste(OKR): tira o botão ⋯ dos cartões e das linhas de Marco + atualiza o help de OKR

Pedido direto: o menu de contexto já abre com o clique direito, então o botão **⋯** do cartão de Objetivo e o das linhas de Marco saíram (o canto do cartão volta a ter só o 👁, e a barra
▲/▼ e o título recuperam o espaço de antes). O menu em si não mudou. **Help do OKR** (❓): o bloco do menu de ações deixa de citar o ⋯, e o bloco "Apresentação em slides" ganhou
**ordem manual** igual à do painel, **tags + filtro por tag**, botões **← Anterior / Próximo →**, **texto longo rola** (a letra não diminui mais no detalhe), e o 👁 do cartão; o bloco de
reordenar lembra que a ordem vale na apresentação e que filtros desativam a reordenação. Só dev.

### painel-dev.html v3.112 · painel-dev — 2026-10-06 · fix(OKR): "Registrar atingimento" do menu rápido não lança o mesmo registro duas vezes

Achado por `/monitorarbugs` (rodada no menu de contexto do OKR, v3.111): o botão **Registrar** do modal rápido de atingimento (aberto por *Registrar atingimento…* no menu ⋯) não tinha trava
enquanto a gravação por transação rodava. **Duplo clique** em Registrar — ou **Enter** apertado duas vezes no campo de valor/nota — chamava a função duas vezes, e cada chamada gera um
id novo: o Objetivo ficava com **dois registros idênticos** (valor, data, nota), duas linhas "registrou atingimento…" no Histórico e duas notificações pros Responsáveis; no gráfico de
evolução o ponto contava em dobro. Reproduzido no Chromium com latência de rede simulada (2 registros após duplo clique, 4 após dois Enter em sequência). Agora a gravação em andamento
ignora novos disparos e o botão fica desabilitado até a transação responder (se falhar, reabilita pra tentar de novo). Só dev; o prod espera validação do menu de contexto.

### painel-dev.html v3.111 · painel-dev — 2026-10-06 · feat(OKR): menu de contexto (clique direito / ⋯) nos Objetivos e nos Marcos

Pedido direto ("um menu de contexto nessa página de OKR"): quase tudo num cartão exigia abrir o modal. Agora **clique direito** no cartão de Objetivo — ou o novo
botão **⋯** (ao lado do 👁; serve pro toque/tablet) — abre um menu:
- **Objetivo**: 📂 Abrir · 📈 Registrar atingimento… (modal rápido: data, valor, nota, com prévia do % que vai ficar) · 📊 Ver evolução · 👁 Ver na apresentação ·
  🏷️ Tags ▸ (marca/desmarca na hora, ✓ nas aplicadas) · ⬆⬇ Mover · ⧉ Duplicar · 📦 Arquivar/♻️ Desarquivar (só ADM) · 🔗 Copiar link (`?okr=<id>`).
- **Marco** (dentro do Objetivo, clique direito ou ⋯ na linha): 📂 Abrir · 🚦 Status ▸ · 🎬 Mostrar/Ocultar na apresentação · ⬆⬇ Mover · 📦 Arquivar.
- Cada item mostra a **tecla de atalho** (R, E, P, T, D, A, L…); ↑↓ navegam, → abre submenu, Enter executa, Esc fecha. Itens sem permissão ficam apagados (mesmas regras do modal);
  **Excluir fica de fora de propósito**. Tag, status, apresentação e registro gravam **por transação** (não pisam em registro lançado por outra pessoa nem no rascunho de um modal
  aberto) e entram no Histórico do Objetivo, como no Salvar; registrar atingimento e mudar status avisam os Responsáveis como o Salvar faz.
- Bugs achados pelos testes antes de entregar: "clicar fora" fechava o menu no `mousedown` mesmo dentro dele (clique de mouse nos itens não executava); um `scroll` espúrio do corpo do
  modal fechava o menu do Marco logo ao abrir.
- Ajuda do OKR ganhou o bloco "⋯ Menu de ações". 37 cenários no Chromium (menu, teclado, permissões, atingimento financeiro/binário/perene, tags, mover com filtro, Marco, XSS por nome/id de tag).
  Só dev; o prod espera validação.

### painel.html v3.110 · painel — 2026-10-06 · Promove pra prod — fix de segurança no seletor de tags do OKR

Promoção do painel-dev v3.110 sobre o prod v3.109 (merge de 3 vias; só a linha de versão conflitou). Única mudança: o seletor de tags do ⚙ Configurações
do Objetivo (e o seletor de Objetivo do Feed) passa a escapar o id da tag/Objetivo em `onclick`/`value=` — antes, uma chave hostil gravada em
`kanban/okr/tags` executava JS na sessão de quem abrisse a configuração (detalhes na entrada do v3.110 · painel-dev). Nada muda visualmente. Smoke contra o
`painel.html` real: XSS de tag 4 cenários, tags 13, cor da tag 17, filtro, UI do atingimento 27, gráfico 17 — todos verdes. Sem avisos (correção interna).

### painel-dev.html v3.110 · painel-dev — 2026-10-06 · fix(segurança, /monitorarbugs): id de tag/objetivo cru em atributo HTML

O seletor de tags do ⚙ Configurações do Objetivo (v3.108, depois da varredura de 05/10) montava o botão ✕ da tag como
`onclick="_okrTagRemoveFromObj('${id}')"` e o `<option value="${id}">` sem escape — mesma classe de XSS armazenado já
corrigida em 332 pontos no dia 05/10 (`esc()` não protege string JS dentro de atributo). O id vem da chave do nó
`kanban/okr/tags`, gravável por qualquer pessoa da empresa: uma chave como `x');alert(1);//` rodava JS na sessão de quem abrisse
a configuração de um Objetivo (inclusive ADM). Reproduzido no Chromium antes de corrigir (JS executado + `<img>` injetado);
agora `jsq(id)` no ✕ e `esc(id)` nos `value=` (também o seletor de Objetivo do Feed, `o.id`). A apresentação não tinha o problema
(só renderiza o nome da tag, escapado). Achado incidental, não corrigido: `_okrTagApagar()` nunca é chamada — não existe
UI pra apagar uma tag (código morto; a tag só some se alguém apagar o nó no Firebase, e o filtro já trata esse caso).
Promoção pro prod aguarda validação (fix de baixo risco, mas fora do lote de hoje por ser a manhã da reunião de OKR).

### painel.html v3.109 · painel — 2026-10-06 · Promove pra prod — OKR: tags nos cartões + filtro por tag + cor da tag; Ajuda do OKR atualizada

Lote acumulado do painel-dev v3.106 → v3.109 sobre o prod v3.105, mesclado em 3 vias (só a linha de versão conflitou; título, favicon, banner e demais divergências de ambiente intactos). Sem avisos (pedido do usuário). Detalhes nas entradas `painel-dev.html v3.106…v3.109` logo abaixo.
- **🏷️ Tags nos cartões da aba OKR** (até 4 + "+N"); clicar numa tag filtra a lista por ela. **Filtro por tag** na barra (só tags em uso, combina com os outros filtros, some sem tags; apagar a tag filtrada desfaz o filtro).
- **Cor da tag**: "+ Nova" abre formulário com nome e cor (6 da paleta ou qualquer cor); 🎨 ao lado da tag aplicada edita nome/cor. A cor vale também na apresentação (`okr-apresentacao.slide.html`, já em prod).
- **❓ Ajuda do OKR** atualizada (atingimento, gráfico de evolução, modal por seções, filtros, tags, Central Agente Ágil com atingimento).
- Teste de fumaça contra o `painel.html` real: tags 13, cor da tag 17, gráfico 17, bugs 12, UI 27, Perene 13, nav, filtro, pessoas — todos verdes.

### painel-dev.html v3.109 · painel-dev (+ okr-apresentacao.slide.html) — 2026-10-05 · feat(OKR): escolher a cor da tag (ao criar e ao editar)

Pedido: poder definir a cor da tag, no mesmo lugar em que ela é criada. Antes, "+ Nova" (⚙ Configurações do Objetivo) pedia só o nome num `prompt` e a cor saía automática (rodízio da paleta).
- **"+ Nova" agora abre um formulário** (nome + cor): 6 cores prontas da paleta **ou qualquer cor** pelo seletor 🎨, com prévia de como a tag vai aparecer. Enter cria, Esc/clique fora cancela. Nome em branco é recusado; nome que já existe **não duplica** (aplica a existente); se a gravação falhar, o erro aparece e a tag não é aplicada.
- **🎨 ao lado de cada tag aplicada** edita **nome e cor** (a mudança vale pra todos os Objetivos que usam a tag); renomear para o nome de outra tag é recusado. Voltar a uma cor da paleta remove a cor própria.
- A cor própria é guardada em `kanban/okr/tags/{id}.cor` (`#rrggbb`, validado) **além** do `colorIdx` antigo — tags existentes e clientes antigos seguem na paleta. Painel (modal, cartões da lista, filtro) e **apresentação** (`okr-apresentacao.slide.html`, prod) leem os dois campos.
- Testes: 17 cenários novos (formulário, paleta × cor própria, Enter, duplicada, edição, renomear para nome existente, Esc, cor inválida, nome com HTML hostil, falha de gravação, apresentação); suítes anteriores verdes.

### painel-dev.html v3.108 · painel-dev (+ guia-okr.html) — 2026-10-05 · feat(OKR): 🏷️ tags nos cartões da aba e filtro por tag

Pergunta do usuário: "se eu colocar uma tag num Objetivo, aparece na aba? E tem que ter filtro por tag." Não aparecia — as tags só eram vistas dentro do modal (e na apresentação).
- **Cartão do Objetivo** na lista passa a mostrar as **tags** (até 4, com "+N" e a lista completa no tooltip). Tag apagada ou inexistente não aparece. **Clicar numa tag do cartão filtra a lista por ela** (sem abrir o Objetivo); clicar de novo limpa; a tag ativa fica destacada.
- **Filtro 🏷️ por tag** na barra da aba, ao lado de pessoa/status: lista só as tags **em uso** na visão atual (ativos × arquivados), combina com os outros filtros, o resumo da aba acompanha, "✕ Limpar filtros" também limpa a tag, e o seletor some quando nenhum Objetivo tem tag. Se a tag filtrada for apagada, o filtro se desfaz sozinho (em vez de deixar a lista vazia com um filtro invisível). A lista também se atualiza quando as tags terminam de carregar.
- Rótulo de tag é escapado (testado com HTML hostil) nos cartões e no seletor.
- Ajuda do OKR e Guia OKR atualizados (filtros e tags nos cartões).
- Testes: 13 cenários novos (chips, limite 4+N, tag fantasma, escape, seletor só com tags em uso, filtro + resumo + destaque, combinação com pessoa, limpar, clique no cartão sem abrir modal, apagar tag filtrada, visão de arquivados); suítes anteriores verdes.

### painel-dev.html v3.107 · painel-dev (+ guia-okr.html) — 2026-10-05 · docs(OKR): ❓ Ajuda do OKR e 📘 Guia OKR atualizados (atingimento, gráfico, modal por seções, filtros)

Só documentação (nenhuma mudança de comportamento). Ajuda in-app (`okr-help-ov`, "❓ Ajuda" da aba OKR) e o guia standalone `guia-okr.html` (slides) passam a cobrir o que entrou nos últimos lotes.
- **Ajuda in-app**: novos blocos **📈 Atingimento — a meta do Objetivo** (os 8 tipos, a fórmula do %, como registrar, quem pode), **📊 Gráfico de evolução**, **🎨 O modal do Objetivo** (seções coloridas + atalhos) e **🔎 Filtros e resumo da aba** (filtro por pessoa, % médio); ajustes em *Marcos e status* (cor = Marcos, barra = Atingimento), *Quem pode editar* (qualquer pessoa cadastrada no painel é responsável possível; chip 🛡️ ADM), *Histórico semanal* (mesmo % da barra) e *Apresentação* (emoji/gráfico). O bloco da Central Agente Ágil já dizia que ele lê/registra atingimento (v3.106).
- **Guia OKR** (`guia-okr.html`, página sem `-dev`, vai direto ao ar ao mergear): 4 slides novos — **modal do Objetivo por seções**, **Escolha como o Objetivo é medido** (tabela dos tipos e do %), **Registrar o valor ao longo do tempo** e **Veja a evolução com data e valor** — com screenshots reais; ajustes na capa (badge 📈, ~12 min), visão geral, semáforo (cor × barra), lista de Objetivos (filtro por pessoa, resumo, emoji do tipo; o gif antigo foi trocado por screenshot atual), Marcos, Histórico, Agente Ágil (atingimento por chat), Apresentação e Permissões (+ linha de atingimento). O arquivo ficou ~1,2 MB menor (um gif antigo de 1,5 MB saiu).
- O texto do guia sobre o **Agente Ágil registrar atingimento** vale depois do deploy das Cloud Functions `okrAgenteChat`/`okrWeeklySnapshot` (PR #1192).

### painel-dev.html v3.106 · painel-dev — 2026-10-05 · docs(OKR): Central Agente Ágil e ajuda dizem que o agente lê/registra o 📈 Atingimento

Só texto: a introdução da 💬 Central Agente Ágil e a ajuda do OKR passam a explicar o que o agente faz com atingimento (ler, registrar, configurar; nunca inventa valor; confirma antes de trocar o tipo). Acompanha o deploy das Cloud Functions acima — antes do deploy o agente ainda responde só sobre marcos.

### painel.html v3.105 · painel — 2026-10-05 · Promove pra prod — OKR: 📈 Atingimento (7 tipos + ♾️ Perene) com gráfico de evolução, modal em seções coloridas com atalhos, filtro por pessoa e correções

Lote acumulado do painel-dev v3.96 → v3.105 (validado pelo usuário), mesclado em 3 vias sobre o prod v3.95 (só a linha de versão conflitou; título, favicon, banner e demais divergências de ambiente intactos). Detalhes de cada item nas entradas `painel-dev.html v3.96…v3.105` logo abaixo.
- **📈 Atingimento por Objetivo**: 7 tipos (Financeira, %, Número, Atingido/Não atingido, Manter acima/abaixo, Data de entrega) + **♾️ Perene** (acompanha pelos marcos); registros datados; a barra do Objetivo (aba e apresentação) anda pelo atingimento. Emoji do tipo no cartão; clicar abre o **gráfico de evolução** (data e valor, dica ao passar o mouse/tocar).
- **Modal do OKR**: seções coloridas com caixas destacadas, atalhos no topo (2 filas) para pular de seção, também no tema 🌴 Vice City.
- **Aba**: filtro por pessoa; editar progressos/riscos/próximos passos depois de enviados; quem usa só o painel (sem squad) aparece como responsável; chip 🛡️ ADM em Global Users.
- **Correções do /monitorarbugs**: clique perdido ao editar a meta, valor digitado descartado ao Salvar, registros de outra pessoa sobrescritos, `undefined` recusado pelo Firebase, e (gráfico/Perene) botão "Evolução" em Perene, dica presa no toque, botão do modal em Objetivo sem id.
- Rascunho no Mural: `seed_okr_atingimento_visual_2026_10_05`. `okr-apresentacao.slide.html` (sem `-dev`) já estava em prod com o gráfico e o ♾️.

### painel-dev.html v3.105 · painel-dev (+ okr-apresentacao.slide.html) — 2026-10-05 · fix(OKR/Atingimento): /monitorarbugs no gráfico de evolução e no tipo Perene (+3)

Rodada de `/monitorarbugs` nas entregas do dia (emoji do tipo, gráfico de evolução, ♾️ Perene, cópia na apresentação). 3 achados, todos reproduzidos num navegador antes de corrigir.
- **Apresentação: Objetivo Perene mostrava o botão "♾️ Evolução"** no cabeçalho do detalhe, que abria um painel sem gráfico (Perene não tem registros). Agora o botão só aparece quando há gráfico a mostrar.
- **Dica do gráfico ficava presa em tela de toque**: tocar num ponto mostra a dica, mas toque não dispara "mouse saiu", então ela só sumia ao tocar em outro ponto. Agora tocar em área vazia do gráfico esconde a dica (painel e apresentação).
- **Botão "📈 Gráfico" do modal em Objetivo ainda sem id** (rascunho) não abria nada, porque dependia do id do Objetivo. Agora, chamado de dentro do modal, sempre usa o rascunho (inclusive o registro ainda não salvo).
- Verificado e sem achado: fuzz de 600 atingimentos com valores/datas estranhos (texto, `NaN`, `null`, 1e12, datas vazias/ausentes) e texto hostil em nota/autor — sem exceção, `NaN`/`undefined` no SVG nem XSS; o bloco do gráfico e as 12 funções copiadas ficaram **idênticos** no painel e na apresentação (virou teste permanente de paridade).

### painel-dev.html v3.104 · painel-dev (+ okr-apresentacao.slide.html) — 2026-10-05 · feat(OKR): ♾️ tipo de atingimento "Perene" — a barra volta a andar pelos marcos

Pedido: um tipo **perene**, para objetivo contínuo (sem meta final nem data de entrega), que **volta a ser analisado a partir dos marcos**.
- Novo tipo **♾️ Perene (acompanha pelos marcos)** no seletor "Tipo de meta". Não tem meta, nem campo de valor, nem histórico de registros: a barra do Objetivo (aba, resumo e apresentação) anda pelas entregas dos **Marcos**, como antes de existir atingimento — a diferença é que agora isso fica **explícito**: ♾️ no cartão e na seção do modal, com "X/Y marco(s) concluído(s) · N%".
- Diferente de "Sem atingimento" (que só não configura nada), o Perene é uma escolha registrada no 📜 Histórico ("configurou o atingimento (Perene…)") e exibida no cartão.
- Trocar um tipo com registros para Perene **não apaga nada**: o aviso diz que os registros ficam guardados; ao voltar para o tipo anterior eles reaparecem. Salvar um Perene não pergunta por "valor pendente".
- Cartão e apresentação mostram ♾️ no lugar do emoji de gráfico (não há gráfico em Perene).
- Testes: 12 cenários novos (motor, cartão, seção do modal, salvar, escolher/trocar/voltar de tipo, histórico, gráfico, apresentação); suítes anteriores verdes.

### painel-dev.html v3.103 · painel-dev (+ okr-apresentacao.slide.html) — 2026-10-05 · feat(OKR): 📈 gráfico de evolução do atingimento (data e valor, com dica ao passar o mouse)

Pedido: o emoji do tipo no cartão do Objetivo passa a ser um **botão que abre o gráfico de evolução** do atingimento, com data e valor, e a dica ao passar o mouse.
- **Gráfico**: tipos numéricos (Financeira, %, Número, Manter acima/abaixo) plotam o **valor** registrado ao longo do tempo, com a linha tracejada da **🎯 meta** (e do início, quando existe); *Atingido/Não atingido* e *Data de entrega* plotam o **%** (0–100). Pontos distribuídos pela data real; eixo em formato compacto (R$ 72 mil) e sem descer abaixo de zero quando os valores não são negativos. Abaixo do gráfico, o resumo (atual → meta), a barra e a lista de registros.
- **Dica ao passar o mouse (ou tocar/focar com Tab)** em cada ponto: `data · % de atingimento`, valor formatado (R$, %, número…), quem registrou e a nota.
- **Onde abre**: no **painel**, clicando no emoji do tipo no cartão do Objetivo (não abre o modal do Objetivo junto) ou no botão **📈 Gráfico** do histórico dentro do modal (mostra também o registro ainda não salvo); na **apresentação**, no emoji do cartão ou no botão **Evolução** do cabeçalho do detalhe do Objetivo. Esc fecha só o gráfico. Funciona nos 3 temas.
- Apresentação: o gráfico é só leitura; o cálculo e o código do gráfico são cópia fiel do painel (mantidos iguais). Removida uma função duplicada que sobrou da cópia do cálculo (sem efeito no resultado).
- Testes: 14 cenários do gráfico no painel (7 tipos de situação: 1 ponto, mesma data, binário, sem atingimento, borda, Esc, rascunho) + 4 na apresentação; suítes anteriores verdes.

### painel-dev.html v3.102 · painel-dev — 2026-10-05 · feat(OKR): emoji do tipo de atingimento no cartão do Objetivo

Pedido: na aba, o cartão do Objetivo passa a mostrar um emoji do **tipo de atingimento** configurado, no lugar do 📈 genérico ao lado do %: 💰 Financeira · 📊 Porcentagem · 🔢 Número · ✅ Atingido/Não atingido · ⬆️ Manter acima · ⬇️ Manter abaixo · 📅 Data de entrega (passar o mouse mostra o nome do tipo). O mesmo emoji aparece nas opções do seletor "Tipo de meta" no modal. Objetivo sem atingimento segue sem emoji (barra pelos marcos).

### painel-dev.html v3.101 · painel-dev — 2026-10-05 · fix(OKR/Atingimento): /monitorarbugs no 📈 Atingimento — clique perdido, valor digitado descartado ao Salvar, registros alheios sobrescritos (+4)

Rodada de `/monitorarbugs` no código do atingimento (v3.100), horas depois de ele ir ao ar. 2 bugs reproduzidos num navegador de verdade antes de corrigir + 2 riscos achados lendo o fluxo de salvar.
- **O clique no botão se perdia depois de editar um campo de configuração** (🐞 reproduzido): alterar a meta/valor inicial/uma data da faixa disparava `change` ao sair do campo, que **redesenhava a seção inteira** — o botão que a pessoa estava clicando (`+ Registrar`, `+ Adicionar data`) sumia no meio do clique e nada acontecia; só no 2º clique funcionava. Agora esses campos só atualizam o **%, o resumo e o histórico no lugar** (sem trocar o campo, foco e cursor preservados); só a troca de moeda redesenha.
- **Digitar o valor e clicar em 💾 Salvar descartava o atingimento em silêncio** (🐞 reproduzido): "Objetivo salvo" aparecia, mas o valor digitado ficava só no campo e nunca virava registro. Agora o Salvar pergunta *"Você digitou um atingimento (65) que ainda não foi registrado. Registrar agora e salvar?"* — confirmando, registra e salva; valor inválido ou "cancelar" **não salva** e deixa o que foi digitado lá.
- **Dois responsáveis lançando registros ao mesmo tempo se sobrescreviam**: o Salvar gravava o rascunho inteiro, então um registro lançado por outra pessoa enquanto o modal estava aberto era apagado. Agora faz *merge de 3 vias* (o que **eu** adicionei/removi vale; o que **outra pessoa** lançou é mantido, com aviso "📈 N registro(s) lançados por outra pessoa foram mantidos"), e o 📜 Histórico não atribui a registro alheio a quem salvou.
- **Campo `undefined` no atingimento fazia o Firebase recusar a gravação do Objetivo inteiro**: o rascunho agora é sanitizado antes de gravar.
- Testes: `bug_ating.js` (reprodução) + 12 cenários novos de regressão (clique logo após editar meta/faixa, % ao vivo, Salvar com valor pendente confirmar/cancelar/inválido, sem pendente, merge com registro alheio, `undefined`); suítes anteriores (27 UI, 4 apresentação, 50 motor, nav, filtro, pessoas) seguem verdes.

### painel-dev.html v3.100 · painel-dev (+ okr-apresentacao.slide.html) — 2026-10-05 · feat(OKR): 📈 Atingimento por tipo de meta, com histórico datado — a barra do Objetivo passa a andar por ele

Pedido do chefe (benchmark: Feedz): um "atingimento" com tipos de meta; o % sai do tipo escolhido e dos registros lançados, e o histórico com
data mostra a evolução. A barra da aba, que andava pela entrega dos marcos, passa a andar pelo atingimento. Também: atalhos do modal em 2 filas.
- **7 tipos de meta** (os mesmos do Feedz): **Financeira** (moeda R$/US$/€, valor inicial, meta) · **Porcentagem (%)** · **Número (#)** — todos por
  `(atual − inicial) ÷ (meta − inicial)`, travado entre 0% e 100% (meta menor que o início também funciona, ex.: reduzir custo) ·
  **Atingido/Não atingido** (0%/100%, inicial e meta fixos) · **Manter acima de** / **Manter abaixo de** (unidade escolhível, só a meta: 100%
  se o valor medido cumpre o limite, 0% se não) · **Data de entrega** (faixas "se atingido entre X e Y, o status será Z%"; entrega fora de todas
  as faixas = 0%; faixas sobrepostas valem a maior).
- **Seção 📈 Atingimento** no modal do Objetivo (1º atalho do cabeçalho): tipo, campos do tipo, resumo com barra, **Registrar atingimento**
  (data + valor + nota) e **histórico em ordem decrescente de data** com valor, % e autor, mais um gráfico de evolução com 2+ registros.
  O "atual" é o registro de data mais recente. Trocar o tipo ou remover o atingimento com registros pede confirmação.
- **Barra do Objetivo**: cartão da aba, resumo da aba (novo chip "📈 N% de atingimento médio") e cartão da `okr-apresentacao.slide.html` usam o
  atingimento quando há meta configurada; **Objetivo sem meta segue pelos marcos, como sempre** (nada muda pra quem não usar).
- O 📜 Histórico do Objetivo registra configuração, mudança de tipo/meta e cada registro adicionado/removido. Duplicar Objetivo copia a meta e
  zera os registros (como os marcos). A chave `atingimento` só é gravada quando há meta.
- **Atalhos do cabeçalho em 2 filas** (a rolagem lateral não funcionava bem).
- **Decisões a confirmar** (assumidas pelos prints, fáceis de mudar — um `case` cada): "Manter acima/abaixo de" é tudo-ou-nada (100% ou 0%), não
  proporcional; o atingimento é **por Objetivo** (não por Marco); mudar a meta recalcula o % dos registros antigos pelas regras novas.
- Não cobertos nesta versão: o resumo semanal/diário das Cloud Functions (`weeklySnapshot`/`dailyScan`) e as ferramentas do Agente Ágil de OKR
  continuam olhando só marcos; o status (no prazo/risco/atrasado) do Objetivo continua vindo dos marcos.
- Testes: 50 de fórmula (Node, incl. os exemplos dos prints), 27 de interface (Chromium, funções reais: cada tipo, registrar, histórico, trocar tipo,
  remover, salvar, duplicar, leitura, dirty-check, 2 filas), 4 da apresentação (cópia do cálculo = painel em 400 casos aleatórios) + os 25 dos
  recursos anteriores; 3 temas conferidos por captura. `okr-apresentacao.slide.html` não tem versão -dev: vai ao ar junto deste merge, mas só
  muda o que é mostrado para Objetivos que tenham atingimento configurado.

### painel-dev.html v3.99 · painel-dev — 2026-10-05 · fix(OKR/Usuários): quem usa só o painel aparece como responsável + chip "🛡️ ADM" em Global Users

Relato direto: o chefe se cadastrou pelo painel e entrou, mas só apareceu na lista de responsáveis do OKR depois que o usuário o colocou em
um squad — e em "Global Users" não havia como torná-lo ADM (só aparecem Membro/PO/Organizador).
- **Responsáveis/participantes do OKR**: `_okrPessoaOptions()` só aceitava quem tinha squad, `inscrito` ou `role:'adm'`, mas quem usa SÓ o
  painel é cadastrado sem squad DE PROPÓSITO (`_painelEnsureUserRecord()`, 2026-09-09: "só abrir o painel não deveria auto-matricular
  ninguém"). Agora basta o registro ter identidade (nome ou e-mail); registros vazios/parciais (só preferências) continuam de fora.
- **Lista de pessoas não fica velha**: o cache de usuários (`_GU_TTL_MS`, 10 min) agora é renovado ao renderizar a aba OKR — pessoa
  recém-cadastrada pelo painel aparece nos seletores sem F5. Só renova depois de uma 1ª carga bem-sucedida (não insiste a cada render
  se a leitura falhar), então o custo de leitura segue o do resto do painel.
- **🛡️ ADM em Global Users**: chip em cada pessoa (funciona mesmo sem nenhum squad), no mesmo estilo do "🎯 Gestor OKR". ADM não é papel
  por squad — é a lista de e-mails de ⚙ Configurações → ADMs, a mesma que o board e as regras usam; o chip só chama o mesmo caminho de
  `addAdmEmail()`/`removeAdmEmail()` (que também sincroniza `role` do registro). Pede confirmação, fica desabilitado sem e-mail ou para
  quem não é ADM, e não deixa tirar o PRÓPRIO acesso de ADM.
- Testado no Chromium com as funções reais (9 cenários novos + 25 anteriores, todos ✅). Ainda em dev.

### painel-dev.html v3.98 · painel-dev — 2026-10-05 · fix(OKR, UI/UX): seções dos modais na paleta do 🌴 Vice City

A v3.97 só foi conferida nos temas escuro e claro. No Vice City as cores fixas das seções (azul/verde/roxo vivos) ficavam legíveis mas
brigavam com a paleta quente do tema (pêssego/lavanda/rosa/laranja — o próprio tema proíbe "azul genérico"), e o cartão de resumo e o brilho
de foco das caixas de texto usavam azul fixo. Agora o Vice City tem a própria paleta de seções (Indicadores pêssego, Progressos menta,
Próximos passos lavanda, Riscos laranja, Planos de ação rosa, Marcos areia, Comentários pêssego, neutros malva — pastéis sobre o vinho,
cada tipo ainda distinto) e o foco/resumo usam o token `--okr-focus-rgb` por tema (azul no escuro, azul-petróleo no claro, pêssego no
Vice City). Só CSS. Conferido nos 3 temas por captura de tela; os 25 cenários de teste seguem ✅.

### painel-dev.html v3.97 · painel-dev — 2026-10-05 · feat(OKR, UI/UX): modais com seções coloridas, caixas de texto em destaque e atalhos fixos no cabeçalho

Feedback do chefe: "o layout do modal é muito igual, tudo no mesmo tom — destacar as áreas e as caixas de texto", e pedido de botões no
cabeçalho que levem direto a cada área (como o atalho de Descrição do card no kanban).
- **Seções com cor e ícone próprios** no modal do Objetivo: 🎯 Indicadores (azul), ✅ Progressos (verde), ➡️ Próximos passos (índigo),
  ⚠️ Riscos (âmbar), 🛠️ Planos de ação (roxo), 🏁 Marcos (turquesa). Cada uma é um cartão com barra lateral colorida, título em destaque
  e contador de itens, no lugar de 5 blocos idênticos com título cinza minúsculo. O resumo do topo (gerência/período/pilar/responsáveis)
  virou um cartão de destaque. Vale também para o modo somente leitura.
- **Modal do Marco**: "Detalhes do marco", ☑️ Checklist (com 1/2 concluídos), 🏷️ Tags, 👥 Participantes e 💬 Comentários viraram
  cartões; checklist e tags/participantes seguem o mesmo padrão.
- **Caixas de texto em destaque** (todo o OKR): contorno visível e anel de foco na cor da seção em que a caixa está (azul fora de seção);
  o botão "+ Add" também ganha a cor da seção.
- **Atalhos fixos no cabeçalho** (fora do corpo que rola, então não somem): Objetivo = Indicadores · Progressos · Próximos passos · Riscos ·
  Planos de ação · Marcos · Cards vinculados · Histórico; Marco = Detalhes · Checklist · Tags · Participantes · Comentários · Histórico.
  Cada chip tem a cor da seção e a contagem; clicar rola até lá com um destaque de ~1s, abre a seção se estava recolhida
  (Histórico/Cards vinculados) e põe o cursor na caixa de "adicionar". Em modo leitura só aparecem atalhos de seções que existem.
- Tema claro conferido (cores mais escuras pra manter o contraste). Os ids das seções levam o id do Objetivo/Marco, então Objetivo e
  Marco abertos juntos não duplicam ids.
- Testado no Chromium com as funções reais: 11 cenários de navegação (rolagem, foco, seção recolhida, leitura, objetivo novo, Objetivo
  + Marco abertos juntos, ids duplicados) + os 14 de filtro/edição da v3.96, todos ✅. Ainda em dev.

### painel-dev.html v3.96 · painel-dev — 2026-10-05 · feat(OKR): filtro por pessoa na aba + botão ✏️ visível pra editar itens

Feedback direto do usuário ("falta um filtro por usuário na aba"; "depois que envia só tem como excluir, não tem como editar").
- **Filtro por pessoa** na barra da aba 🎯 OKR (ao lado de Gerência/Período/Status): lista as pessoas que aparecem como responsáveis
  na visão atual, mais "⭐ Eu". Um objetivo bate se a pessoa é responsável POR ELE ou por algum marco ATIVO dele (marco arquivado
  não conta). Respeita "Ver arquivados", aparece em "✕ Limpar filtros" e a pessoa escolhida continua selecionada ao alternar entre
  ativos e arquivados (senão o select mostraria "Todas" com filtro ainda ativo).
- **Editar item**: a edição por clique no texto já existia (v3.68+), mas só aparecia como dica ao passar o mouse — no celular nem isso
  — e o botão visível era só o ✕. Agora cada item das listas do Objetivo (indicadores, progressos, próximos passos, riscos, planos de
  ação, trimestres) e do checklist do Marco ganhou um **✏️ Editar** ao lado do ✕, e o texto sublinha ao passar o mouse. Enter salva,
  Esc cancela, igual antes.
- Testado no Chromium com as funções reais (14 cenários: filtro incl. "Eu"/marco arquivado/arquivados/limpar, editor de lista e de
  checklist, Esc). Ainda em dev.

### painel.html v3.95 · painel — 2026-10-05 · Promove pra prod — reforço de segurança (XSS via id em handler inline)

Promoção do v3.95 de dev (pedido: "uma promoção agora com tudo acumulado"). Só a correção de segurança: 137 pontos do painel
onde um id/texto com aspas ou HTML podia executar script no navegador de quem abre a tela (inclusive ADM) foram trocados por uma
escapada própria de string JS. Sem mudança de tela. Cenário e verificação em `kanban-dev.html` v8.30.779-dev e na entrada
`painel-dev.html` v3.95 logo abaixo.

### painel-dev.html v3.95 · painel-dev — 2026-10-05 · fix(segurança): XSS armazenado via id em handler inline

Mesma classe de `kanban-dev.html` v8.30.779-dev (ver lá o cenário e a verificação):
137 interpolações `'${…}'` em atributos `on*=` do painel (a ferramenta de ADM — alvo
mais valioso) convertidas pra `${jsq(…)}`; `jsq()` definido junto de cada `esc()`.
Verificado no Chromium com 5.020 textos hostis, 0 falhas. Ainda em dev — promover
junto do kanban depois da validação.

### painel.html v3.94 · painel / painel-dev.html v3.94 · painel-dev — 2026-10-02 · fix(banda, /monitorarbugs): cache de cards sobrevivia ao logout + 3 pedidos engolidos/sem retry

Rodada de `/monitorarbugs` sobre o próprio v3.93 (cards incrementais, `usuarios`
sob demanda). Promovido direto pra prod (bug na mesma área sensível, pedido do
usuário de subir correções sem esperar), sem avisos.

- **Cache de cards sobrevivia ao logout** (`painel_cards_cache`, IndexedDB): num
  computador compartilhado ficaria dado de cards da pessoa anterior no disco
  (mesma preocupação do `gcal_token`). Chave agora inclui o `uid`
  (`databaseURL|uid|squad`), nunca é lida/gravada sem usuário logado, e é
  apagada quando `auth-change` chega com `null`. Banco subiu pra v2 pra
  descartar as entradas órfãs da v1 (sem uid, até ~37 MB por navegador).
- **Recarga completa engolida:** Shift+clique em "🔄" durante um fetch já em
  andamento da mesma squad era descartado em silêncio — agora roda assim que o
  fetch termina.
- **`usuarios`:** releitura forçada (feita 500 ms depois de o ADM trocar
  papel/squad) durante outra leitura em andamento era descartada, podendo mostrar
  o papel ANTIGO; e uma falha de rede na 1ª leitura deixava avatares/responsáveis
  do OKR vazios a sessão toda (o `onValue` antigo reconectava sozinho) — agora
  refaz ao terminar e tenta de novo (até 5x, 15 s; também ao voltar pra aba).
- Falha de permissão no download de cards não gera mais `unhandled rejection`
  (leituras das folhas já disparadas ficavam sem tratamento).
- Poll de `snapshots` (~38 KB/squad) ao voltar pra aba entrou no mesmo throttle de
  5 min do `dados`.
- Premissa do delta conferida e mantida: `fbSaveAll()` carimba `cards_updated_at`
  (tocados com timestamp novo, os demais com o próprio); sem `touchedIds` carimba
  todos, o que no painel vira recarga completa (seguro). O painel não muda
  objetos de cards em cache no lugar.
- Testes: 11 cenários novos (uid na chave, logout limpa, sem uid não grava,
  pedido forçado durante fetch, retry, fila de releitura, sem
  `unhandledRejection`) + os 29 anteriores; os novos falham no código do v3.93
  (4 falhas) e passam no v3.94.

### painel.html v3.93 · painel — 2026-10-02 · Promove pra prod — correção do consumo de ~8 GB/dia (v3.91 → v3.93 de dev)

Correção de bug sério promovida na hora (pedido direto do usuário, sem
avisos): ontem o Realtime Database bateu ~8 GB de download, ~99% vindo do
próprio painel. Detalhes do diagnóstico e dos números na entrada de dev v3.93
logo abaixo. Em prod: cards sincronizados de forma incremental (só o que mudou,
cache persistente em IndexedDB, recarga completa no Shift+clique em "🔄"),
`kanban/usuarios` deixa de ser listener ao vivo, aba Status com medição em
cache e visão multi-squad de Campanhas só lendo o que usa. Leva junto o v3.91
(filtros Hering × Arezzo/papel/squad/Gestor OKR em "🗂 Usuários cadastrados"),
que estava acumulado em dev. Nenhum aviso (Mural/WhatsApp) — decisão do usuário.

### painel-dev.html v3.93 · painel-dev — 2026-10-02 · fix(banda): painel baixava ~8 GB/dia (cards de todas as squads a cada volta pra aba + usuarios ao vivo)

Diagnóstico de "ontem bateu 8 GB de download" (script hora a hora sobre
`_debug_bytes_log`, 84 janelas, 7,04 GB medidos): ~99% dos bytes vieram do
PRÓPRIO painel — `poll:squads/<id>/dados` ~6,5 GB (~180 refreshes completos no
dia, ~37 MB cada; `outlet-crm` 15 MB, `outlet` 9,7 MB, `midiacriativa` 5 MB) e
`onValue('kanban/usuarios')` ~0,7 GB (1,1 MB × 621 entregas). Boards somaram
~40 MB. Uma única sessão de ADM respondeu por 43% do dia (3,1 GB em 9 h). Não
era loop: era `visibilitychange` — cada volta pra aba rebaixava `dados`
inteiro de todas as squads (inclui `card_comments`, `ql_items`, `notas`,
`intake_pending`, `agent_msgs`, `_debug_bytes_log`...).

- **Cards incrementais** (`_fetchSquadDados`/`_fetchCardsDelta`): lê só
  `cards_index` + `cards_updated_at` (índices leves, o mesmo par que o
  kanban usa e que as Cloud Functions do Agente Ágil carimbam) e baixa só os
  cards cujo timestamp mudou. Refresh sem mudança: ~1,9 KB vs ~106 KB num
  squad de teste de 50 cards (~37 MB → ~0,5 MB no total real).
- **Cache persistente em IndexedDB** (`painel_cards_cache`): a próxima abertura
  do painel também começa pelo incremental. Recarga completa de segurança se o
  cache tem >3 dias, se o delta achar qualquer inconsistência (card sumiu/índice
  aponta pra outro id), se mudaram >200 cards, se a squad tem card sem
  id/índice, ou com **Shift+clique em "🔄"** (`window._painelFullRefresh()`).
- Só os filhos de `dados` que o painel usa (`columns`, `tags`, `agil_cfg`,
  `flow_baseline`, `lembretes`, `config/{blockerMode,submarca_ativo,
  canal_venda_ativo}`); volta pra aba só refaz o fetch da squad se o último foi
  há ≥ 5 min; fetch em andamento não é duplicado.
- **`usuarios` sem listener ao vivo** (`loadGlobalUsers(force)`): leitura sob
  demanda — ao abrir, ao abrir "🗂 Usuários", depois de escritas do próprio
  painel em papel/squads/gestorOkr/nome/foto (wrapper em `_set`/`_update`) e,
  ao voltar pra aba, se o cache tem >10 min.
- Aba **Status** ("Peso por squad") baixava `dados` inteiro de todas as squads a
  cada abertura, sem passar pela telemetria — agora o resultado fica 6 h em
  cache (botão "🔄 Atualizar" mede de novo) e é registrado em `_dbgTrack`.
  Visão multi-squad de Campanhas lê só `cards`+`columns`.
- Telemetria: refresh incremental aparece como `poll:squads/<id>/dados(delta)`,
  completo continua `poll:squads/<id>/dados`.
- Testes: 29 cenários com Firebase simulado e IndexedDB falso rodando o código
  real extraído da página (edição, card novo, inserção no meio, remoção, índice
  inconsistente, card sem id, cache da sessão anterior, cache expirado, >200
  mudanças, array esparso, squad vazia, regex de escritas em `usuarios`).

### painel-dev.html v3.91 · painel-dev — 2026-10-02 · feat: filtros na tela "🗂 Usuários cadastrados" (Hering × Arezzo)

Pedido direto do usuário: "sabe aquele user global dentro de painel? coloca
opções de filtros, principalmente de ser Hering ou Arezzo". Barra de filtros
abaixo da busca em `openGlobalUsersModal()`/`renderGlobalUsers()`:
- **Empresa** (chips clicáveis com contagem): 🏢 Hering (`@ciahering.com.br`),
  🅰️ Arezzo (`@arezzo.com.br`) e 🌐 Externos (qualquer outro domínio, ou sem
  e-mail) — derivado do domínio do e-mail (`_guEmpresa()`), nada novo gravado.
  A contagem de cada empresa é calculada antes do filtro de empresa (senão as
  outras zerariam ao escolher uma).
- **Papel** (adm/po/organizador/membro/convidado — vale o papel global OU por
  squad; `adm` também pega a whitelist `ADM_EMAILS`), **Squad** (inclui "sem
  nenhum squad") e **🎯 Gestor OKR**.
- Todos combinam entre si e com a busca por texto; "✕ Limpar filtros" aparece
  quando há algo filtrado, o contador vira "X / total" e cada linha ganha uma
  etiqueta com a empresa.

Validado em Chromium (Playwright) com as funções reais da página: 18
cenários (cada filtro, combinações, contagens, e-mail em maiúsculas/ausente,
limpar) + print conferido.

### painel.html v3.90 · painel — 2026-10-02 · Promove pra prod — lote OKR (v3.87 → v3.90 de dev)

Promoção do acumulado em `painel-dev.html` desde a v3.86 (pedido: "promove tudo
pra prod"). Aba 🎯 OKR e login:
- **Histórico do Objetivo não perde mais a entrada do Marco**: salvar/arquivar
  um Marco e depois salvar o Objetivo apagava o resumo "atualizou o marco X".
- **Texto digitado numa caixa "+ Add" não some mais** ao confirmar outra
  lista, ir pra ⚙ Configurações/abrir um Marco e voltar, ou marcar item do
  checklist.
- **Histórico e Cards vinculados** lembram se estavam abertos (não fecham
  sozinhos a cada "+ Add").
- **Login**: conta `@ciahering.com.br` só pelo Google e `@arezzo.com.br` só
  pela Microsoft — botão errado ou conta sem e-mail agora recebe mensagem.

Checks de rotina: `node --check` nos 3 blocos `<script>` — OK; divergência
restante contra `painel-dev.html` é só ambiente (favicon/título/banner dev,
nodes `_dev`, squads fictícias).

### painel-dev.html v3.90 · painel-dev — 2026-10-01 · fix(OKR): texto digitado numa caixa "+ Add" não some mais ao mexer em outra coisa

Continuação do #1147 (aviso de "não salvo" com texto pendente). O texto
digitado numa caixa "+ Add" (Indicadores/Progressos/Próximos Passos/Riscos/
Planos de Ação/Trimestres no Objetivo; checklist no Marco) só vira item com
Enter/"+ Add" — até lá vive só no `<input>`, e todo "+ Add"/remover/editar
item reconstrói o corpo inteiro do modal. Resultado: o texto pendente de
OUTRA caixa sumia em silêncio ao confirmar uma lista, ao ir pra ⚙
Configurações ou abrir um Marco e voltar, e ao marcar um item do checklist.
Agora `_okrReadPending()`/`_okrWritePending()` leem os valores logo antes de
reconstruir e devolvem depois (com o contador de caracteres).

Cuidado deliberado pra não vazar texto entre Objetivos/Marcos: a leitura é
do DOM vivo, então o corpo de cada modal é limpo ao abrir e ao fechar a
sessão (`openOkrObjetivo`/`closeOkrObjetivo`/`openOkrMarco`/`closeOkrMarco`);
e o item recém-confirmado esvazia a própria caixa antes do re-render, pra
não voltar como "pendente". O aviso de fechar com texto pendente (#1147)
continua funcionando.

Validado em Chromium (Playwright) com as funções reais da página: 12
cenários (sobrevive ao + Add de outra lista, ida e volta pela Config e por
um Marco, trimestres, checklist; não vaza pro próximo Objetivo/Marco; aviso
de fechar intacto) — os 6 de "sobrevive" falham sem a correção.

### painel-dev.html v3.89 · painel-dev — 2026-10-01 · fix(OKR): salvar um Marco e depois o Objetivo apagava a entrada do Marco no histórico

`/monitorarbugs` nas correções de OKR do dia. `saveOkrMarco()`/
`_okrArquivarMarco()` empurram um resumo ("atualizou o marco X") pro
`history[]` do Objetivo pai direto no Firebase — mas o Objetivo continua
aberto por baixo (abrir um Marco só esconde o overlay), com `_okrObjDraft`
ainda segurando o `history[]` de quando abriu. O 💾 Salvar seguinte do
Objetivo grava `{...draft}` por cima do nó inteiro e **apagava a entrada
que o Marco tinha acabado de gravar** (e o 📜 Histórico do próprio
Objetivo já voltava desatualizado ao fechar o Marco). Fluxo comum: editar
um Marco dentro do modal do Objetivo e depois salvar o Objetivo.
`_okrSyncObjDraftHistory()` mantém rascunho e snapshot em sincronia (sem
acusar "alteração não salva" à toa).

### painel-dev.html v3.88 · painel-dev — 2026-10-01 · fix(login): mesmo gate de provedor/e-mail do kanban

Espelha o fix do kanban v8.30.776-dev: `_loginProviderMismatchMsg()` recusa
conta `@ciahering.com.br` fora do Google, `@arezzo.com.br` fora da Microsoft
e conta sem e-mail (as regras do banco são um arquivo só pros dois). No
painel `_signOut()` não recarrega, então a mensagem aparece direto.

### painel-dev.html v3.87 · painel-dev — 2026-10-01 · fix(OKR modal): Histórico/Cards vinculados voltavam a fechar sozinhos

`/monitorarbugs` nas implementações do dia. As seções recolhíveis do modal
(v3.86) dependiam do estado só no HTML gerado — e o corpo inteiro do modal é
reconstruído a cada "+ Add"/remover/editar item: abrir o Histórico (ou
"Cards vinculados" vazio) e mexer em qualquer lista fechava a seção de novo.
Agora o estado aberto/fechado é lembrado por seção+entidade
(`_okrDetailsState`/`_okrDetailsAttrs()`).

### painel.html v3.86 · painel — 2026-10-01 · Promove pra prod — lote OKR acumulado (v3.77 → v3.86 de dev)

Promoção do lote acumulado em `painel-dev.html` (pedido: "sobe tudo que
tá acumulado pra prod"). Mudanças pro público de prod, aba 🎯 OKR:
- **Bug real corrigido**: abrir ⚙ Configurações de um 2º Objetivo
  mostrava título/gerência/pilar/descrição "grudados" do 1º que foi
  configurado na sessão (já estava ao vivo em prod).
- **Login com Microsoft** (integração Arezzo, `@arezzo.com.br`) também
  no painel, com o mesmo nível de acesso de `@ciahering.com.br`.
- **Preview 👁** em cada card de Objetivo: abre a apresentação já no
  detalhe daquele Objetivo. **Contador de caracteres recomendado** nos
  campos que aparecem na apresentação (aviso, não bloqueia salvar).
- **Marcos**: arrastar e soltar pra reordenar (além de ▲/▼), ícone 🎬
  nos que aparecem na apresentação, borda colorida por status.
- **UI/UX da aba**: botões agrupados e "+ Novo Objetivo" em destaque
  (também corrige corte de botões no celular), "Ver arquivados" junto
  dos filtros, tira de resumo clicável por status + % de marcos
  concluídos, "✕ Limpar filtros", barra de progresso na cor do status.
- **UI/UX do modal**: Histórico e Cards vinculados colapsáveis.
- Cards de OKR/Risco/Bloqueio no modo claro com fundo legível.

Rascunho do Mural (`seed_okr_lote_foto_2026_10_01`) adicionado em `COMUNICADO_RASCUNHOS_SEED` — fica como rascunho até um ADM publicar.

Checks de rotina: `node --check` nos 3 blocos `<script>` — OK; versão
`v3.86 · painel`, resto da divergência contra `painel-dev.html` é só
ambiente (favicon/título/banner dev, nodes `_dev`, squads fictícias).

### painel-dev.html v3.86 · painel-dev — 2026-10-01 · UI/UX: auditoria + melhorias DENTRO do modal de Objetivo/Marco (OKR)

Pedido direto, continuação da rodada anterior na aba: "agora dentro do
modal do okr". Mesmo método (auditoria no código/CSS, sem navegador
logado nesta sessão) — 3 achados reais, corrigidos:

**1. Histórico sempre 100% expandido, no fim do scroll.** Um Objetivo
pode acumular até `OKR_HIST_CAP`=80 entradas de histórico — e a tela
sempre renderizava TODAS, sem colapsar, bem no final de um modal que já
empilha 5 editores de lista (Indicadores/Progressos/Próximos Passos/
Riscos/Planos de Ação) + Marcos + Cards vinculados antes dele. Pra um
Objetivo com uso real, isso sozinho podia dobrar a altura do modal numa
seção que a maioria das aberturas nem olha. Fix: `_okrHistorySectionHtml()`
reusa o MESMO padrão `<details class="pt-bucket">`/`.pt-chevron` já
usado na Timeline do painel (não inventa componente novo) — fechado por
padrão quando tem bastante coisa (>5 entradas), aberto quando é pouco.
Aplicado nos 4 lugares que mostravam Histórico (Objetivo e Marco, modo
leitura e edição).

**2. "🔗 Cards vinculados" sempre aberto, com busca ocupando espaço
permanente.** Feature de uso bem mais raro que Marcos/Riscos/Planos de
Ação, mas vinha sempre expandida — inclusive o campo de busca, mesmo
quando a lista estava vazia (o caso comum). Mesmo padrão `<details>` do
item acima: fechado quando vazio, aberto quando já tem algo vinculado
(não esconde o que já existe).

**3. Status do Marco, dentro do modal, comunicado só por um dot
pequeno** (sem texto, diferente do card na grid da aba, que mostra
dot+label) — cada linha de `.okr-marco-row` ganhou uma borda esquerda
de 3px na cor do status (mesma técnica que `.okr-hist-item` já usa pra
tipo de evento), reforçando o status sem gastar largura — o modal tem
só 560px e cada linha já tem nome+responsável+prazo+🎬 disputando
espaço.

Checks de rotina: `node --check` no bloco `<script>` clássico — OK;
balanço de chaves do arquivo (-1, igual ao baseline da sessão).

### painel-dev.html v3.85 · painel-dev — 2026-10-01 · UI/UX: auditoria + melhorias na aba 🎯 OKR

Pedido direto do usuário: "quero q vc faça uma analise de UI/UX e
melhore a aba de okr do painel!". Auditoria feita direto no código/CSS
(sem acesso a um navegador logado nesta sessão) — 4 achados reais,
todos corrigidos juntos:

**1. Toolbar de ações sobrecarregado.** O cabeçalho tinha 8 botões no
MESMO peso visual, misturando 3 tipos de ação bem diferentes: links de
referência (❓ Ajuda, 📘 Guia OKR, 🎥 Apresentação), troca de VISÃO
(💬 Central Agente Ágil, 📋 Anotações, 📈 Histórico — substituem o grid
inteiro) e a CTA principal (+ Novo Objetivo). Agora em 3 grupos
separados por um traço vertical, com "+ Novo Objetivo" como ÚNICO
botão de destaque (preenchido, `.btn-p`) — o resto fica em segundo
plano de propósito.

**2. Bug de mobile na mesma linha de botões.** A linha de 8 botões não
tinha `flex-wrap` — só o BLOCO inteiro ia pra linha de baixo (o pai,
`.sec-title`, é flex-wrap), mas os botões dentro dele continuavam numa
fileira só sem wrap nem scroll, cortando os últimos pra fora da tela
num celular. Corrigido com `flex-wrap` nos grupos internos também.

**3. "📦 Ver arquivados" realocado.** Conceitualmente é um FILTRO do
que o grid mostra (ativo vs. arquivado), não uma ação de página —
estava isolado no cabeçalho, longe dos outros filtros (área/trimestre/
status/texto). Movido pra dentro do `.okr-toolbar`.

**4. Sem visão agregada, sem feedback de filtro.** A aba ia direto pro
grid de cards agrupados por Gerência sem nenhum resumo — pra saber
"como estamos indo", a pessoa tinha que escanear card por card. Além
disso, os filtros não davam nenhum feedback de "algo está filtrado" se
a pessoa esquecesse. Dois adicionados:
- **Tira de resumo clicável** (`#okr-stats-strip`/`_okrStatsStripHtml()`)
  logo abaixo do toolbar: total de Objetivos, quantos por status (cada
  chip clicável filtra por aquele status — mesmo `_okrSetFilter()` que
  o `<select>` já usava) e % geral de marcos concluídos. Calculada
  sobre o filtro de área/trimestre/texto já aplicado, mas ANTES do de
  status (senão o resumo sumiria assim que alguém clicasse num chip).
- **"✕ Limpar filtros"** (só aparece com algum filtro ativo) +
  mensagem de vazio diferenciada ("nenhum objetivo bate com esse
  filtro", com link pra limpar, em vez do genérico "nenhum objetivo
  encontrado" que também aparecia quando era só um filtro vazio).

**Achado incidental, corrigido junto**: a barra de progresso do card
(`.okr-progress-fill`) sempre usava a cor `--accent` (azul neutro),
mesmo num Objetivo 🔴 Atrasado — perdia a chance de reforçar o status
visualmente à distância, numa tela que escaneia dezenas de cards. Agora
usa a MESMA cor do dot de status (`okrStatusInfo(status).dot`).

Checks de rotina: `node --check` no bloco `<script>` clássico — OK;
balanço de chaves do arquivo (-1, igual ao baseline da sessão).

### painel-dev.html v3.84 · painel-dev — 2026-10-01 · feat(OKR): preview por Objetivo + contador de caracteres recomendado

Pedido direto do usuário: "um preview da apresentação do objetivo para
cada objetivo na guia okr! e um aviso para as pessoas olharem como
ficou pq ta ficando com muito texto e acho q eles precisam ver isso e
a gente precisa tambem calcular quantos caracteres sao maximo para n
quebrar a leitura".

**1. 👁 Pré-visualizar** — cada card de Objetivo, na aba 🎯 OKR, ganhou
um botão no canto (`_okrPreviewApresentacao(id)`) que abre
`okr-apresentacao.slide.html?preview=<id>` numa aba nova, já com o
detalhe desse Objetivo aberto — sem precisar navegar pelo carrossel/
índice pra conferir como ficou. Do lado de `okr-apresentacao.slide.html`:
`_previewObjId` lê o parâmetro da URL e `rebuild()` consome ele UMA
VEZ, no 1º carregamento de dados completo, chamando
`window._okrOpenDetail(id)` direto.

**2. Contador de caracteres recomendado** — `OKR_CHAR_LIMITS` define um
soft cap por campo (não bloqueia salvar, só avisa), calculado a partir
da largura REAL dos containers em `okr-apresentacao.slide.html` (CSS de
lá) com uma heurística de ~0.52× o tamanho da fonte por caractere:
Objetivo (`okr-f-descricao`) ~200 car., item de lista (Indicadores/
Progressos/Próx. Passos/Riscos/Planos de Ação) ~90 car. cada, nome do
Marco ~70 car., descrição do Marco ~110 car. Não é limite técnico —
nada quebra visualmente acima dele, porque o zoom-fit da apresentação
sempre encolhe o que for preciso pra caber, sem piso mínimo de fonte —
é um aviso de LEGIBILIDADE: acima do soft cap, o campo passa a dominar
a seção e encolhe a fonte de tudo ao redor quando a apresentação roda
num telão/projetor. Contador aparece embaixo de cada campo (texto fixo
e itens de lista, tanto no "+ Add" quanto editando um item já salvo),
muda de cor (cinza → amarelo perto do limite → vermelho acima dele).

Checks de rotina: `node --check` nos 2 blocos `<script>` (module +
clássico) de `painel-dev.html` e nos 2 de `okr-apresentacao.slide.html`
— OK; balanço de chaves/parênteses de `painel-dev.html` bate com o
baseline da sessão (braces -1, parens -14); balanço de chaves de
`okr-apresentacao.slide.html` (0, igual ao baseline anterior).

### painel-dev.html v3.83 · painel-dev — 2026-10-01 · feat: login com Microsoft (integração Arezzo) — gap que ficou de fora da rodada do kanban

Pedido direto do usuário ("existem coisas que tão ligadas ao usuário
que são Google e você precisa adaptar pra Microsoft e ainda não fez?
se sim, pode corrigir") — auditoria encontrou um gap real: `painel.html`/
`painel-dev.html` nunca receberam o mesmo tratamento que `kanban.html`/
`kanban-dev.html` ganharam mais cedo no mesmo dia (PR #1144/#1145). Só
tinha login Google, e o próprio gate de domínio checava só
`@ciahering.com.br` puro — um email `@arezzo.com.br`, mesmo que
conseguisse logar via Google de algum jeito, cairia no fluxo de
"visualizador externo" (só leitura) em vez de ter o mesmo nível de
acesso combinado pro kanban.

**O que mudou**: 2º botão "Entrar com Microsoft" (mesmo
`OAuthProvider('microsoft.com')`, `tenant:'organizations'`, só contas
de trabalho/escola) + `TRUSTED_DOMAINS`/`_isTrustedDomainEmail()`
substituindo o `endsWith('@ciahering.com.br')` solto no gate de login e
na tela "Adicionar visualizador". `database.rules.json` já estava
coberto — o provider-pin feito mais cedo no mesmo dia (PR #1152) é no
MESMO arquivo compartilhado entre kanban e painel, então já valia pros
nodes que o painel lê, sem precisar de mudança adicional ali.

Checks de rotina: `node --check` nos 2 blocos `<script>` (module +
clássico) — OK.

### painel-dev.html v3.82 · painel-dev — 2026-10-01 · feat(OKR): arrastar e soltar pra reordenar Marcos dentro do Objetivo

Pedido direto do usuário. A lista de Marcos, dentro do modal do
Objetivo, já tinha botões ▲/▼ (`_okrMarcoMover()`) pra reordenar um
passo de cada vez — agora cada linha também é arrastável
(`draggable`), soltando em cima de outro Marco pra reinserir na
posição de uma vez só, sem precisar de vários cliques. Mesmo padrão
HTML5 DnD nativo (sem lib) já usado pros cards de Objetivo dentro de
cada Gerência (`_okrObjDragStart()`/`_okrObjReorderTo()`) — os dois
jeitos de reordenar convivem, arrastar é só o atalho mais rápido.

Checks de rotina: `node --check` no maior bloco `<script>` — OK.

### painel-dev.html v3.81 · painel-dev — 2026-10-01 · fix(OKR): tela de Configurações ficava "presa" no 1º Objetivo configurado

Relato direto do usuário: "quando vc clica em configurações de um okr e
muda para configurar outro, ele fica preso nesse primeiro q vc
configurou! como se tivesse 'preso' numa espécie de 'cache'" — **já
confirmado ativo em produção também** (mesmo bug em `painel.html`).

Causa raiz: `openOkrConfig()` chamava `_okrSyncObjDraftFromDom()` antes
de renderizar a tela de Configurações — mas essa função só lê os campos
`okr-f-titulo`/`okr-f-area`/`okr-f-pilar`/`okr-f-descricao`, que só
existem DENTRO da própria tela de Configurações, nunca na tela
principal (de onde o botão ⚙ é clicado). Essa `<div>` não é limpa ao
fechar o modal, só escondida — então a chamada lia o que sobrou no DOM
da ÚLTIMA vez que a Config rodou (possivelmente de outro Objetivo) e
sobrescrevia título/gerência/pilar/descrição do rascunho atual com
dado antigo antes mesmo de renderizar a tela nova.

Fix: chamada removida — não havia nada de legítimo pra sincronizar ali
(a tela principal não tem esses campos); `closeOkrConfigBack()` já faz
o sync de verdade, no momento certo (saindo da Config, com ela ainda
ativa).

Checks de rotina: `node --check` no maior bloco `<script>` — OK.

### painel-dev.html v3.80 · painel-dev — 2026-10-01 · fix(OKR): texto digitado no "+ Add" sem confirmar fechava o modal em silêncio

Relato direto do usuário: "precisa colocar aquele ponto de quando clicar
fora e tiver editando um okr, perguntar se realmente quer sair sem
salvar" — o modal de Objetivo e o de Marco JÁ tinham esse dirty-check
(`_okrTryCloseObjetivo()`/`_okrTryCloseMarco()`, clique fora/✕/Cancelar),
mas com um gap real: os campos "+ Add" (Indicadores/Progressos/Próximos
Passos/Riscos/Planos de Ação/Trimestres no Objetivo, Checklist no Marco)
só viram item de verdade no rascunho quando confirmados (Enter/"+ Add")
— texto digitado mas ainda não confirmado nunca entrava na sincronização
que o dirty-check compara, então clicar fora com algo digitado ali (sem
confirmar) fechava o modal e perdia o texto em silêncio, sem perguntar
nada.

Fix: `_okrTryCloseObjetivo()`/`_okrTryCloseMarco()` agora também checam
se algum desses campos "+ Add" tem texto digitado e ainda não confirmado
— se tiver, trata como alteração não salva e pergunta antes de fechar,
mesmo que o resto do rascunho esteja idêntico ao que foi aberto.

Checks de rotina: `node --check` no maior bloco `<script>` — OK.

### painel-dev.html v3.79 · painel-dev — 2026-10-01 · fix: ícone da lista de Marcos trocado de 📷 pra 🎬 (consistência com o checkbox do Marco)

Correção pontual da v3.78, mesmo dia: usei 📷 (câmera) por engano — o
checkbox "Aparecer na apresentação" dentro do próprio Marco já usa 🎬
(claquete) desde que a feature existe. Troca simples pro mesmo emoji,
mantendo os 2 pontos consistentes.

### painel-dev.html v3.78 · painel-dev — 2026-10-01 · feat(OKR): ícone 📷 na lista de Marcos indica quem aparece na apresentação

Pedido direto do usuário. O modal do Objetivo (aba 🎯 OKR) já mostrava
responsável e prazo de cada Marco na lista — mas se um Marco aparece ou
não em `okr-apresentacao.slide.html` (`mostrarApresentacao`) só dava pra
ver abrindo o Marco individualmente. Agora a própria linha do Marco na
lista do Objetivo ganha um 📷 (com tooltip "Aparece na apresentação")
quando `mostrarApresentacao!==false` — mesmo critério que
`okr-apresentacao.slide.html` já usa pra filtrar o que mostrar no slide,
só que visível de relance na lista, sem precisar abrir cada Marco.

Checks de rotina: `node --check` no maior bloco `<script>` — OK.

### painel-dev.html v3.77 · painel-dev — 2026-10-01 · fix: cards de OKR/Risco/Bloqueio ilegíveis no tema claro

Relato direto do usuário, com print: "modo claro no okr ta bugadasso de
leitura" — os cards de "🎯 Cards do board com badge OKR" apareciam quase
ilegíveis no tema claro, título em cinza sobre fundo escuro.

Causa raiz: `.panel-card` (usado pelos 3 tipos de tile — OKR, Risco e
Bloqueio) tinha o fundo FIXO em `rgba(6,20,44,.85)` (azul-marinho
escuro, hardcoded), nunca mudava com o tema — enquanto `.pc-card-title`
já usava `var(--txt)`, corretamente escuro no tema claro. Resultado:
texto escuro sobre fundo escuro fixo, no meio de uma tela cujo restante
já tinha virado claro corretamente. Esse componente é mais antigo que o
tema claro do painel e nunca foi retrofitado (comentário original já
documentava "Bloqueios/OKR/Risco continuam com o visual próprio deles,
intocado").

Fix: troca pro mesmo padrão já usado em `.pt-row`/`.met`/etc.
(`background:rgba(var(--ink-rgb),.85)`, tema-aware) — 1 linha, afeta os
3 tipos de tile de uma vez.

Checks de rotina: `node --check` no maior bloco `<script>` — OK; balanço
de chaves do `<style>` — 735/735, batendo.


## Agente Ágil Orquestrador (`functions/agente-agil-orquestrador/`) — Fase 2


## Agente Ágil (`functions/agente-agil/`)


## `database.rules.json` (regras do Realtime Database, sem versão própria em `version.json`)

### 2026-10-05 — Hardening: `usuarios` (leitura), notificações (criação), `feedback` e `access_log` (escrita)

Segue da rodada `/monitorarbugs` "áreas sensíveis" (a "rodada de hardening separada" que a entrada de
2026-10-01 deixou pra depois) e foi **pedida pelo usuário**: "pode preparar a mudança nas regras! se quiser na
vdd pode acrescentar a regra que só ADM pode emitir notificado".

**O problema (cadeia):** `kanban/usuarios` tinha `.read: auth != null` — qualquer conta Google/Microsoft
autenticada, mesmo de fora da empresa, lia o nó INTEIRO: e-mails, **notificações** (títulos de card, menções) e
**tokens de push** de todo mundo. O CHANGELOG de 2026-09-18 aceitou esse trade-off descrevendo o nó como "nome/e-mail/
foto/role" — mas ele guarda também notificações e `fcm_tokens`. Além disso, `notificacoes/$id` aceitava criação por
`!data.exists()` pra qualquer autenticado, e `sendPushOnNotification` transforma título/texto da notificação em push:
uma conta de fora conseguia ler todos os uids/e-mails e mandar push de phishing pra todo mundo (a URL do clique é
fixa — sem redirect —, mas o texto é livre). `feedback` e `squads/*/access_log` tinham `.write: auth != null`.

**Regras novas (5 trocas + 1 nó):**
1. `usuarios.read` → empresa (`@ciahering` via Google / `@arezzo` via Microsoft) **ou** visualizador do painel
   (`painel_viewers`). Cada pessoa lê o PRÓPRIO registro (`usuarios/$uid.read: auth.uid === $uid`) — é o que o
   login do freelancer usa. `usuarios_publicos` (diretório magro) e `squads/*/externos.read` seguem abertos de
   propósito (o fluxo de login dos externos depende deles).
2. `notificacoes/$id.write` — a própria caixa e PO/ADM continuam como antes. Criar na caixa de OUTRA pessoa agora
   exige: nó novo + campo `type` (texto) + `type !== 'painel_broadcast'` + ser da empresa **ou** ter algum squad
   (`usuarios/{uid}/squads` existe — o `validate` de `squads/$squadId` só deixa um externo ter squad se ele estiver
   na whitelist). **`painel_broadcast` (aviso geral do Mural) só PO/ADM** — esta é a "regra de só ADM emite" pedida,
   no nível certo: restringir TODA notificação a ADM quebraria @menção/atribuição/comentário/prazo, que o app cria no
   navegador de quem faz a ação. Exigir `type` fecha o atalho de mandar notificação sem tipo (a function só filtra por
   `PUSH_TYPES` quando há `type`).
3. `feedback.write` → empresa ou membro de algum squad. 4. `squads/$squadId/access_log.write` → empresa ou membro
   DAQUELE squad.

**Verificação** (sem emulador no ambiente → simulador de regras novo, `functions/rules/rulesSim.js`, que avalia as
expressões reais do arquivo com a cascata do Firebase): matriz de 10 atores × 17 operações; comparação antigo × novo
em TODOS os 46 caminhos × 11 atores × leitura/escrita (1.012 combinações) — só mudaram `usuarios/**`, `feedback` e
`access_log`, e **nenhum caminho ficou mais permissivo pra ninguém**. A matriz virou teste permanente
(`functions/rules/__tests__/databaseRules.test.js`, 18 casos; 10 falham contra as regras antigas). Suíte `functions/`:
554/554. **Não testado contra o Firebase real** — a linguagem de regras tem diferenças sutis do JS que o simulador usa.

**Não mudou (conhecido):** `init_registry` ainda aceita qualquer autenticado reivindicar uma sigla (precisa ser assim:
o freela reivindica ANTES de ter registro); `usuarios_publicos` segue legível por qualquer autenticado (e-mails de
funcionários, sem notificações/tokens).

**⚠️ Requer deploy manual** (`firebase deploy --only database`, resincronizar o clone antes — ver `CLAUDE.md`) e um
teste com uma conta de freelancer logo depois. Rollback: Firebase Console → Realtime Database → Regras → Histórico
(ou `git show <commit anterior>:database.rules.json`).

### 2026-10-01 — Pin de provedor por domínio corporativo (Arezzo só Microsoft, Hering só Google)

Segue direto da integração de login com Microsoft (PR #1144/#1145,
mesmo dia) — revisão de segurança trazida pelo usuário (análise de uma
outra IA, "Manus", sobre o `database.rules.json`), verificada linha a
linha contra o arquivo real antes de aplicar qualquer coisa. A maioria
dos achados do Manus se confirmou (`feedback`/`access_log` com
`.write: auth != null` solto, `usuarios`/`usuarios_publicos`/
`init_registry` com `.read: auth != null` no nó pai, `externos.read`
aberto pra qualquer autenticado, chave de `painel_viewers`/`externos`
por email sanitizado em vez de uid) — decisão explícita do usuário
(`AskUserQuestion`): aplicar só o pin de provedor agora, tratar o resto
como uma rodada de hardening separada (não bloqueia a integração
Arezzo de hoje, maior superfície pra revisar com calma).

**O que mudou**: as 52 ocorrências de
`(auth.token.email.endsWith('@ciahering.com.br')||auth.token.email.endsWith('@arezzo.com.br'))`
viraram
`((auth.token.email.endsWith('@ciahering.com.br')&&auth.token.firebase.sign_in_provider=='google.com')||(auth.token.email.endsWith('@arezzo.com.br')&&auth.token.firebase.sign_in_provider=='microsoft.com'))`
— antes, qualquer domínio autenticado por QUALQUER provider passava
(ex.: `@arezzo.com.br` via Google, se a pessoa tivesse uma conta Google
pessoal com esse email, passaria igual); agora cada domínio só passa
pelo provider esperado.

**Cuidado explícito, por causa do precedente documentado logo abaixo
(2026-09-18, freelancer bloqueado por um fix de segurança anterior)**:
confirmado que os fallbacks de freelancer/externo (`|| root.child('kanban/painel_viewers/...')`,
`|| root.child('kanban/squads/.../externos/...')`, `|| root.child('kanban/usuarios/' + auth.uid + '/squads/' + $squadId)`)
continuam INTACTOS em todos os nodes que já os tinham — só a parte do
domínio corporativo foi envolvida em `&&provider`, nunca a estrutura
`||` que dá acesso a quem está explicitamente cadastrado como externo,
independente do provider que usa.

**NÃO aplicado nesta rodada** (decisão explícita, ver acima): exigir
`email_verified == true` (precisa confirmar antes, via teste ao vivo,
se o Firebase marca isso corretamente nos tokens de login Microsoft
deste app — risco de travar gente sem aviso se não confirmar antes);
fechar `feedback`/`access_log`/`usuarios`/`usuarios_publicos`/
`init_registry`/`externos.read`; migrar `painel_viewers`/`externos` de
chave-por-email pra chave-por-uid.

⚠️ **Deploy manual pendente** — mesma limitação de sempre
(`firebase deploy --only database`, da máquina do usuário, depois de
resincronizar o clone local). **Recomendação forte antes do deploy
real**: testar os 4 cenários no Firebase Console → Realtime Database →
Rules → Rules Playground (simulação, não publica nada) —
`@ciahering.com.br`+`google.com` permitido, `@ciahering.com.br`+
`microsoft.com` negado, `@arezzo.com.br`+`microsoft.com` permitido,
`@arezzo.com.br`+`google.com` negado — antes de publicar de verdade,
dado o precedente de 2026-09-18.

