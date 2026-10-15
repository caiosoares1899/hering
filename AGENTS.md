## Fluxo de Trabalho no Antigravity (Repositório Hering / Maré Digital)

- **Repositório local:** `C:\Users\caio.soares\.gemini\antigravity\scratch\hering` (remote: `https://github.com/caiosoares1899/hering.git`). Mesmo se nenhuma workspace estiver aberta na sessão, opere diretamente neste diretório.
- **Execução Rápida sem Prompts Desnecessários (Política Corporativa):**
  - **Zero terminal para arquivos:** Nunca use `run_command` para ler, buscar, comparar ou editar arquivos (`cat`, `grep`, `Select-String`, `Copy-Item`, `diff`). Use sempre as ferramentas nativas (`view_file`, `replace_file_content`, `write_to_file`), que rodam instantaneamente sem pedir permissão dentro da pasta `hering/`.
  - **Skills sempre pela cópia local do projeto:** Sempre leia as skills pelo caminho dentro do workspace (`c:\Users\caio.soares\.gemini\antigravity\scratch\hering\.claude\skills\<nome>\SKILL.md`) e **nunca** por `C:\Users\caio.soares\.gemini\config\skills\...`, evitando o prompt de *Outside of folders file access*.
  - **Comandos de terminal agrupados (1 único clique):** Quando precisar rodar comandos de terminal (`git`, `npm run conhecimento`, `gh pr create`), agrupe tudo em **uma única chamada `run_command` encadeada** no final da tarefa (ex.: `git fetch origin && git checkout -b <branch> origin/main && git add ... && git commit -m "..." && git push -u origin <branch> && gh pr create ...`), reduzindo aprovações manuais ao mínimo possível. Sempre inclua a extração de `$env:GH_TOKEN` via `git credential fill` antes de `gh pr create` e rode apenas o teste focado (`node --test <caminho>`) quando a mudança em `functions/` for localizada.
  - **Arquitetura Multiagentes por App (Execução Paralela):** Para acelerar entregas que tocam múltiplos arquivos/domínios ou quando a conversa principal já estiver longa, defina (`define_subagent` com `enable_write_tools: true`) e acione em paralelo (`invoke_subagent` em uma única chamada) os subagentes especialistas por produto (sempre em `Workspace: 'inherit'` e **sem** usar terminal nos subagentes — apenas `view_file`/`replace_file_content`):
    1. **`agente-mare`**: `kanban-dev.html` / `kanban.html`, `intake-dev.html` / `intake.html`, `escala-dev.html` / `escala.html`.
    2. **`agente-radar`**: `okr-dev.html` / `okr.html`, `okr-apresentacao.slide.html`, `guia-okr.html`.
    3. **`agente-painel-oceano`**: `painel-dev.html` / `painel.html`, `oceano-dev.html` / `oceano.html` e módulos compartilhados (`mare-notif-dev.js`, `mare-dicas-dev.js`, `mare-metas-dev.js`, `mare-login-dev.js`).
    4. **`agente-functions-docs`**: `functions/` (código + testes unitários), `database.rules.json`, `version.json`, `CHANGELOG.md`, `BUGS_E_CORRECOES.md` e `CODE_MAP.md`.
    O agente principal atua como **Orquestrador**: alinha requisitos com o usuário, dispara os subagentes relevantes simultaneamente (cada um com contexto limpo e rápido) e, ao receber o retorno, executa o único `run_command` final de teste + branch + commit + push + PR.
  - **Orquestrador Zero-Código & Automação via `scripts/mare-cli.js`:** O agente principal **nunca** deve ler ou editar diretamente arquivos grandes (`.html` / `.js` de milhares de linhas) na conversa principal para evitar compressão de contexto e lentidão. Toda leitura/edição de código deve ser delegada aos subagentes especialistas (que consultam `CODE_MAP_FAST.md` e `BUGS_E_CORRECOES.md` antes de abrir qualquer arquivo), finalizando com `node scripts/mare-cli.js` (bump de versão, registro de log, rebuild do mapa rápido e promoção dev→prod).
  - **Separação entre `CHANGELOG.md` e `BUGS_E_CORRECOES.md`:**
    - **`CHANGELOG.md`:** exclusivo para **novas funcionalidades (features)** e **grandes melhorias/entregas estruturais** (`node scripts/mare-cli.js log --type feature ...`). Entradas de jul/2026 a set/2026 ficam arquivadas em `docs/changelog-archive-2026-07-a-09.md`.
    - **`BUGS_E_CORRECOES.md`:** concentra **bugs reportados**, **correções pontuais**, **ajustes de regressão**, **achados do `/monitorarbugs`** (`node scripts/mare-cli.js log --type bug ...`) e a seção **`🛡️ Armadilhas Conhecidas & Regras de Ouro`**.
- **Fluxo GitHub-first (Branches & PRs):** Sempre crie uma branch nova a partir da `main` atualizada (`git fetch origin && git checkout main && git pull origin main`), faça commit, `git push` e abra a Pull Request no GitHub informando o link ao usuário. **Nunca faça merge da PR por conta própria** — o usuário aprova e clica em Merge no GitHub.
- **Deploy Firebase (`database.rules.json` e `functions/`):** Se uma tarefa alterar regras do Realtime Database ou Cloud Functions, avise o usuário que precisa de deploy no Firebase e aguarde confirmação explícita no chat antes de rodar `firebase deploy`.
- **Logs nos Cards & Avisos (Mural/WhatsApp):** Só gere o script de console para logar comentário nos cards (`c1785199972010_nd0` / `c1783541085140`) e os rascunhos de aviso quando for promover para produção (`/subirproprod`), não a cada PR de `-dev`.

---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Internal tools for Hering, deployed as static pages via GitHub Pages at
https://caiosoares1899.github.io/hering/. There is no build step, no bundler,
no npm project at the root — each `.html` file is a single self-contained
page (inline `<style>`, inline `<script type="module">`, no imports between
pages). The only Node project is `functions/` (a Firebase Cloud Function).

The centerpiece is **Maré Digital**, a kanban-based squad management system
with an admin panel and push notifications, backed by Firebase Realtime
Database + Firebase Auth (Google sign-in) + Firebase Cloud Messaging.

## Commands

There is no lint/test/build tooling in this repo — changes are made directly
to the HTML files and validated by opening them in a browser.

```bash
# Install/run the Cloud Function locally
cd functions && npm install

# Deploy the push-notification Cloud Function
cd functions && firebase deploy --only functions   # requires `firebase login`

# Push updated Realtime Database rules (database.rules.json) to Firebase
firebase deploy --only database
```

Deploying the static pages themselves is automatic: `.github/workflows/pages.yml`
publishes the entire repo root to GitHub Pages on every push to `main` — there
is no separate deploy step for the HTML files.

### `functions/` deploys run on the user's own machine — always resync first

Unlike the HTML pages (auto-published by GitHub Pages), anything under
`functions/` (Cloud Functions, `firebase functions:secrets:set`, `firebase
deploy --only functions:...`) has to be run by the user on their own Windows
machine, with their own `firebase-tools` login — this session's sandbox has
no deploy credentials. **Every single time a PR touching `functions/` gets
merged, and you're about to hand the user a `firebase deploy`/`firebase
functions:secrets:set` command to run locally, first give them the sync
step** — their local clone tracks the working branch and does not
auto-update:
```bash
cd C:\path\to\hering
git fetch origin <branch-name>
git reset --hard origin/<branch-name>
```
Skipping this is a real, repeated failure mode: `firebase deploy` silently
discovers whatever `functions/index.js` exports **on disk locally** — if a
new export (e.g. a new Cloud Function) isn't there yet because the merge
happened after their last pull, the deploy fails with a confusing `No
function matches the filter: default:<name>` instead of any obviously
git-related error. Same applies before `npm install`/testing anything
in `functions/` locally after you've pushed changes — always assume their
clone is stale until they've resynced, and say so up front rather than
letting them hit the error first.

## Key files and their roles

- `CODE_MAP_FAST.md` & `CODE_MAP.md` — `CODE_MAP_FAST.md` is the compact,
  auto-generated line-index of functions and anchors across the main HTML/JS
  files (regenerated via `node scripts/mare-cli.js map`) for fast subagent
  lookup; `CODE_MAP.md` is the detailed feature-area index for `kanban.html`/
  `kanban-dev.html`/`painel.html`/`functions/`.
- `BUGS_E_CORRECOES.md` — technical log of bugs, point fixes, regressions,
  `/monitorarbugs` findings, and the `🛡️ Armadilhas Conhecidas` section (8
  critical pitfalls to check before touching Firebase queries, auth, or
  comments), keeping `CHANGELOG.md` focused exclusively on new features and
  major deliveries.
- `MARINE_GLASS.md` — the brand/design-system manual for "Marine Glass"
  (the "glass over ocean" visual identity — dark oceanic gradient background
  + glassmorphism surfaces, "Abrolhos"/"Lençóis Maranhenses" theme names,
  Syne/DM Sans typography, semantic emoji, tone of voice) shared across
  `kanban.html`/`painel.html`, `onboarding.html`, and `bolao.html`. Written
  by the user from the real CSS/copy already in those pages — reference it
  (color tokens, glass blur recipe, the ready-made prompt template in its
  §10) before styling any new page or standalone piece (slide, WhatsApp art)
  that should read as "part of the family." Update it if the palette or
  conventions evolve in a new piece, same spirit as `CODE_MAP.md`.
- `kanban.html` — production kanban board (squad management).
- `kanban-dev.html` — test/dev copy of the board. **Currently byte-identical
  to `kanban.html`** — historically it's meant for testing changes safely
  before they hit prod, so keep changes to the two in sync deliberately, and
  never point the dev board at production data without reviewing first.
- `painel.html` / `painel-dev.html` — admin panel (people management,
  announcements, manual push notifications) and its dev counterpart. Unlike
  the kanban pair, these two **do** diverge (dev has extra debug
  instrumentation, a "dev" banner, etc.) — check `diff painel.html
  painel-dev.html` before assuming a change should land in both.
- `guia-okr.html` — standalone visual guide (Marine Glass slide deck, same
  family as `apresentacao.criativa.html`) for the 🎯 OKR tab in
  `painel.html`/`painel-dev.html`, linked from a **📘 Guia OKR** button in
  that tab's toolbar. No `version.json`/`-dev` counterpart — same pattern
  as the other standalone tools below, just linked FROM a Maré Digital
  page instead of being unrelated to it.
- `mare-notif-dev.js` / `mare-notif.js` — **sino único**: módulo compartilhado (raiz do domínio, único arquivo
  carregado por mais de uma página) que mantém o **feed da torre** (`kanban/notif_feed`, "lido" em
  `kanban/notif_feed_seen/{uid}`) e o roteador de tipos de notificação (ícone + URL entre páginas), além do rodapé do sino (🔊 som · permissão deste aparelho/push · 🔕 Não Perturbe) usado pelo OKR e pelo painel, usado pelo sino de
  `kanban`, `painel` e `okr` — a notificação tem que aparecer igual em qualquer página. Segue o mesmo ciclo dev→prod
  (as páginas `-dev` carregam `mare-notif-dev.js?v=N`, as de prod `mare-notif.js?v=N`; ao mudar o módulo, bump o `?v=` nas páginas).
- `mare-dicas-dev.js` / `mare-dicas.js` — **dicas (mini popups)**: segundo módulo compartilhado (raiz do domínio), usado só por `kanban` (Maré), `okr` (Radar) e `oceano` — Painel e A Bordo não mostram dicas (o Painel só **lista** todas, em ⚙ Configurações → 💡 Dicas). O **catálogo de todos os apps vive no módulo** (`CATALOGO`: id, gatilho, texto curto, `saiba` → tópico da Ajuda, `ajuda` = nome do tópico); cada página só chama `MareDicas.init({app, user, quando:{id:fn}, abrirAjuda})` e `MareDicas.gatilho(...)` onde a pessoa chega. O módulo cuida de aparecer 1 por vez, uma vez só, **no máximo 1 por dia por app** (`dicas/ultima/{app}`), e do liga/desliga por app (`kanban/usuarios/{uid}/dicas`). **Dica nova = 1 linha no `CATALOGO` + (se depender do estado da tela) 1 entrada em `quando` na página.** Mesmo ciclo dev→prod do `mare-notif` (`?v=` nas páginas — bump em todas ao mudar o módulo).
- **Conhecimento do Agente Ágil (2026-10-10)** — `functions/agente-agil-orquestrador/conhecimento/*.json` são **gerados** (`cd functions && npm run conhecimento`) a partir de `HELP_CONTENT` (kanban.html), da Ajuda do Radar (okr.html), do FAQ do Oceano (oceano.html) e do CHANGELOG (produção); o teste `conhecimento.test.js` falha se ficarem velhos. **Mudou a Ajuda ou promoveu pra prod → regenerar, commitar e republicar as funções do agente** (`agenteAgilMencao`, `agenteAgilMencaoDados`, `agenteAgilIntake`, `agenteAgilAnalisePO`, `okrAgenteChat`) — Cloud Functions não leem o repo em runtime. Detalhes no `README.md` da pasta.
- **Central de Notificações (2026-10-10)** — aba 🔔 Notificações do `painel(-dev).html`: catálogo de todos os tipos (`MareNotif.TIPOS` em `mare-notif(-dev).js` — **tipo de notificação novo = 1 entrada lá**), interruptores sino/push por tipo em `kanban/notif_config/{tipo}` (regras: só PO/ADM gravam), e quem está com Não Perturbe/push. O push respeita o interruptor via `functions/common/notifConfig.js` (deploy de `sendPushOnNotification`/`sendPushOnMural` + `firebase deploy --only database`).
- `mare-metas-dev.js` / `mare-metas.js` — **metas e desafios ("O mar tá pra peixe", 2026-10-12, em prod desde 2026-10-13)**: terceiro módulo compartilhado (raiz do domínio), usado por `kanban` (aba lateral 📊 Dados com 2 abas Squad|Digital + ⚙ Config → 🐟 Metas) e `painel` (📊 Dados → metas do Digital). Concentra matemática (% / ritmo / situação / marcos de 20 %), gráficos no estilo do Radar, formulários, popup 🐟 e a camada de dados (`kanban/metas_digital[_dev]`, `kanban/metas_squads[_dev]/{squad}`, `kanban/metas_log[_dev]` — **regras novas, exige `firebase deploy --only database`**). Mesmo ciclo dev→prod do `mare-notif` (`?v=` nas páginas; ao promover: `mare-metas.js` + `kanban.html` + `painel.html` juntos). Recursos: ritmo não linear (diarização), entrada retroativa como parte do total e 🗂 Entradas (editar/excluir). Lembretes de preenchimento: função agendada `metasLembretes` (`functions/metas/lembretes.js`, a cada 15 min no horário de Brasília; deploy: `firebase deploy --only functions:metasLembretes,functions:sendPushOnNotification` + `firebase deploy --only database`; tipo `meta_lembrete` em `PUSH_TYPES` e em `MareNotif.TIPOS`).
- `mare-login-dev.js` / `mare-login.js` — **login Google direto (2026-10-13, em prod)**: quarto módulo compartilhado (raiz do domínio), usado por `oceano` e `kanban` (Maré). Entra em cena em **qualquer iPhone/iPad** (atalho da tela inicial OU Safari comum — o popup do Firebase trava ou dá "missing initial state" em ambos; ou com `?loginDireto=1`; convidado `?login=local` fica no popup): leva a página inteira ao Google (`response_type=id_token`, volta no fragmento da própria página) e entrega o token com `signInWithCredential` (a página precisa expor `window._signInIdToken`). Páginas **sem** URI própria cadastrada (Escala, Intake) usam `MareLogin.iniciar({hub:true})`: a volta do Google é no Oceano, que leva a pessoa de volta pra página de origem. **Exige** cada URL de página que o usa (`…/oceano.html`, `…/kanban.html` e os `-dev`) cadastrada em *URIs de redirecionamento autorizados* do cliente web do projeto (Google Cloud Console). Mesmo ciclo dev→prod (`?v=` nas páginas; ao promover: `mare-login.js` + `oceano.html` + `kanban.html`).
- `escala-dev.html` — **Escala (2026-10-12; prod `escala.html` v1.7 desde 2026-10-13, dev v1.9)**: página própria (login Google @ciahering, como o `intake-dev.html`) com a escala de trabalho/plantão/folga por dia — visão da squad, visão global e cadastro (a própria pessoa; PO/Organizador/ADM da squad editam a de todos). Dados em `kanban/escala/{data}/{squadId}/{uid}` (regras novas em `database.rules.json` — **exige `firebase deploy --only database`**). Entradas: visão 👥 Escala dentro do 📅 Calendários do Maré (iframe com `?embed=1`) e aba Escala ↗ no Painel. **v1.8–v1.9 (só dev):** filtros de squad/subtime numa mini tela (botão 🔎 Filtros), 📊 Visão Gantt do dia (+ JPG do Gantt) e ☕ pausas (campo `p` nas entradas — **exige `firebase deploy --only database`**). Mesmo ciclo dev→prod (`escala.html` ao promover, junto com `kanban.html`/`painel.html`). Ver `docs/OCEANO.md` e `CODE_MAP.md`.
- `firebase-messaging-sw.js` — the Service Worker. **Must stay at the domain
  root** (not in a subfolder) — it handles both offline caching and showing
  push notifications when the tab is closed/backgrounded.
- `functions/index.js` — registers every deployed Cloud Function (each
  `exports.xxx = require('./yyy/zzz').xxx` line documents its own deploy
  command in a comment above it — always deploy with
  `firebase deploy --only functions:<name>`, never a bare
  `--only functions`, unless you mean to touch every function at once).
  Currently live: `sendPushOnNotification` (push), `agenteAgilMencao`
  (Agente Ágil orquestrador, `agente-agil-orquestrador/`), `agenteAgil`
  (older HTTP-based agent v0-v3, `agente-agil/`), `intakeSubmit`
  (anonymous public form → `intake_pending`, `intake/`), `weeklyBackup`
  (automatic weekly board backup to Cloud Storage, `backup/weeklyBackup.js` — board only), `backupCompletoSemanal`/`backupGlobalDiario` (**full database backup**, `backup/completo.js` → private `backups-completos/`; **a new top-level node in the database = add it to `NOS_GLOBAIS` there, or it has no backup**; restore with `backup/restaurar.js` or the 🛟 screen in Config → Backup via `backupCompletoApi`; `backupVigia` alerts the ADMs when a backup fails), and most of
  the Spotify integration (`spotify/`, see below) — **except**
  `spotifySync`, which is commented out. See `CODE_MAP.md` for the full
  export list with line numbers.
- `database.rules.json` — Realtime Database security rules. This is a
  **manual mirror** of what's configured in the Firebase Console; if someone
  edits rules directly in the console, this file goes stale until someone
  copies the change back. Worth diffing against the console occasionally.
- `version.json` — the version each page's auto-update mechanism polls (see
  below). Bump the relevant key whenever a versioned page changes.
- Other standalone tools with no relation to Maré Digital: `bolao.html`,
  `capacitacao.html`, `onboarding.html` (+ `onboarding.slide.html`),
  `apresentacao.html`, `maredigital.html`, `resumo.slide.html`,
  `ai-slide.html`, `ai-txt.html`, `controle.html`.

## Architecture notes for the Maré Digital pages

- **Firebase, no build step.** Pages import the Firebase JS SDK straight from
  the `gstatic.com` CDN inside a `<script type="module">` block (e.g. `import
  { getDatabase } from 'https://www.gstatic.com/firebasejs/10.12.0/...'`).
  `firebaseConfig` lives inline; values fall back to hardcoded defaults but
  can be overridden via `localStorage` (see the "firebase" settings tab /
  `saveFbConfig()`), which is how the dev pages can point at a different
  Firebase project without a code change.
- **Data model**: everything lives under a `kanban/` root in the Realtime
  Database — `kanban/usuarios/{uid}`, `kanban/squads/{squadId}/...`,
  `kanban/painel`, `kanban/config`, `kanban/global`, etc. `database.rules.json`
  gates almost all read/write on `auth.token.email` ending in
  `@ciahering.com.br`, with per-squad membership checks via
  `kanban/usuarios/{uid}/squads/{squadId}`. Several nodes have parallel
  `_dev` siblings (e.g. `dados_diarios` / `dados_diarios_dev`,
  `campanhas_log` / `campanhas_log_dev`) used by the dev pages to avoid
  touching production data.
- **Push notifications, end to end**: the app itself decides something is
  notification-worthy and writes to
  `kanban/usuarios/{uid}/notificacoes/{notifId}`. The Cloud Function
  (`functions/index.js`) only decides whether that notification should also
  become a push — it does this by checking `notif.type` against the
  `PUSH_TYPES` allow-list (currently `assigned`, `mention`, `unblocked`,
  `risk`, `recorrente`, `painel_broadcast`, `okr_mencao`, …; see the constant). The Mural do OKR's new-notice push is a separate function, `sendPushOnMural`, because that notice is one `kanban/notif_feed` event rather than a per-user notification. **To make a new notification
  type trigger push, add it to `PUSH_TYPES` and redeploy the function** — a
  front-end-only change is not enough. The function also respects each
  user's "Não Perturbe" (do-not-disturb) window at
  `kanban/usuarios/{uid}/notif_prefs/dnd`, and prunes FCM tokens that come
  back as invalid/unregistered. It sends `data`-only FCM messages (no
  `notification` field) deliberately — sending both causes some browsers
  (notably Safari/iOS) to show the notification automatically in addition to
  the Service Worker's `onBackgroundMessage`, causing duplicates.
- **Self-updating client**: each versioned page polls `version.json` (with
  `cache: 'no-store'`) on an interval and compares the value at its own
  `VERSION_KEY` (e.g. `'kanban'`, `'painel_dev'`) against the version baked
  into the loaded page. On mismatch it blocks the UI with an "update now"
  overlay rather than silently reloading, so in-progress input isn't lost.
  When you change a versioned page, bump its key in `version.json` (and the
  `<div class="version">...</div>` string in the HTML) or clients won't be
  prompted to refresh.
- Given the file sizes (kanban/painel HTML files run several thousand lines
  and 400KB–1.1MB), use `grep`/targeted `Read` offsets rather than reading a
  whole file at once when investigating. **Check `CODE_MAP.md` first** for
  the feature area you're touching — it names the actual function/const to
  grep for, so you skip the broad exploratory search entirely. Re-grep the
  name to get the current line number (the map's numbers are a snapshot,
  not live) and read from there. This applies to any investigation or edit
  across `kanban.html`/`kanban-dev.html`/`painel.html`/`functions/`, not
  just open-ended exploration.

## Modo "só Hering" (2026-10-08) — Arezzo/Microsoft, Torres e menção ficaram atrás de um interruptor

O Maré passou a atender só a Hering: login só Google (`@ciahering.com.br`), OKR de uma torre só (Digital), @menção só a quem é `@ciahering`. Nada foi apagado — `window.MARE_SO_HERING` (1º `<script>` de `kanban(-dev)`, `painel(-dev)`, `okr(-dev)`; `const MARE_SO_HERING` em `okr-apresentacao.slide.html`; `functions/common/mareModo.js`; `database.rules.json` sem a alternativa Arezzo). **Antes de mexer em login, torres, domínios ou regras, leia `docs/arezzo/MARE_SO_HERING.md`** (o que existia, como foi implementado, lista de interruptores e passo a passo pra religar). Os testes de torres/Arezzo das funções rodam com `MARE_MODO_TESTE=varias-torres`.

## Oceano (2026-10-09) — a família de produtos e os nomes

O que era tudo "Maré Digital" virou a família **Oceano**: **Maré Digital** (kanban), **Painel**, **Radar** (= o OKR, `okr.html`), **A Bordo** (onboarding) e **Travessia** (futuro, performance/gente). Só os **nomes visíveis** mudam — arquivos, URLs e caminhos do banco ficam. "OKR" continua como metodologia, papel ("🎯 Gestor OKR") e selo dos cards. Regras e fases em `docs/OCEANO.md` — **leia antes de renomear qualquer texto**; texto novo que cite a página do OKR deve dizer "Radar".

**Página Oceano (2026-10-09, em produção):** `oceano.html` / `oceano-dev.html` é o lobby/boas-vindas da família (login só Google, vitrine por pessoa, personalização, ajuda, selo `#vtex-pill` de status da VTEX e **host** dos produtos em iframe quando instalada como app — o PWA do Maré Digital não muda). Detalhes em `docs/OCEANO.md`. **Mural do Oceano (2026-10-11, em produção desde 2026-10-13):** os Comunicados do Painel (aba Pessoas) têm 🌊 "Mostrar no mural do Oceano" (padrão ligado) e "Só no Oceano" — página inicial do Oceano, ver `docs/OCEANO.md`. **Login único + 1ª abertura do dia (2026-10-11/14, em produção):** quem não está logado no Maré/Painel (ou na 1ª abertura do dia em `_oceanoDoDia`) é mandado pro Oceano (`?next=`), faz login + cadastro lá e **fica no Oceano** (vê o Mural; atalho "↩ Continuar" no topo leva de volta); Radar e convidados externos (`?login=local`) ficam de fora — ver `docs/OCEANO.md`, interruptores `MARE_LOGIN_PELO_OCEANO` e `MARE_OCEANO_DIARIO`. **Menu de produtos (⋮⋮⋮, `mare-notif(-dev).js`)** com abas Produtos · Hering · Meus links — links da Hering em `kanban/config/links_hering` (nó compartilhado dev/prod), pessoais em `kanban/usuarios/{uid}/links`; em prod em `kanban`, `painel`, `okr` e `oceano` desde 2026-10-09.

## Pendências conhecidas de documentação

**Rodada de 2026-10-15 (auditoria multiagentes de documentação):** Sincronização completa de `kanban.html` (v8.30.863) / `kanban-dev.html` (v8.30.864-dev), `okr.html` (v2.88) / `okr-dev.html` (v2.89), `guia-okr.html`, `oceano-dev.html`, `docs/OCEANO.md`, `maredigital.html`, `CODE_MAP.md` e `AGENTS.md` — cobrindo a 11ª Submarca `Geral` (`tag_sm_geral`), `mare-metas(-dev).js` `?v=13` (gráfico diário/acumulado, modal `⛶ Expandir` com tabela diária Realizado/Esperado/∆ e popups de marco 20%–100%), e no Radar: aba `📈 Data Studio` (`kanban/okr/datastudio`), edição `✏️` e exclusão `🗑️` de anotações da reunião em qualquer data e no Calendário (autor ou ADM), sala ao vivo com controle permanente de ADM (`👑 Assumir` e `📍 Puxar sala`) e auto-fit de títulos longos (`_fitHeaderTitles`), limites de caracteres da Apresentação Executiva (`OKR_CHAR_LIMITS`) e fluxo de promoção `Próximo Passo (✅) → Progresso (🏁) → Marco` (UI + ferramenta `promover_item_okr` em `okrAgenteChat`).

**Rodada de 2026-10-14:** Ajuda do Radar (`#hlp-editar` em `okr-dev.html` v2.80: edição ✏️ e exclusão 🗑️ de comentários de Marco + moderação por ADM; Ajuda do Maré e FAQ do Oceano já estavam em dia com modo insistente e status VTEX), `docs/OCEANO.md` (lobby v1.34, sino, login único, 1ª abertura do dia, Mural, selo VTEX e Escala v1.10 marcados como em produção), `maredigital.html` (versões v8.30.858 / painel v5.68 / okr v2.78 / oceano v1.34 / escala v1.10 / mare-notif v31 / mare-metas v10, monitores `vtexStatus`/`githubStatus`/`firebaseStatus`, nós `marco_comments` e `*_status`/`*_saude`), `CODE_MAP.md` (seção da aba 🔋 Status no Painel + exports de `functions/index.js` + revalidação de âncoras) e `CHANGELOG.md` em dia.

**Rodada de 2026-10-13:** Ajuda do Maré (Escala reescrita: filtros em mini tela, Gantt, pausas, JPG do Gantt; Notificações (escala/meta_lembrete); Instalar no celular (login direto); Menu de produtos (porta de entrada pelo Oceano); Calendário), FAQ do Oceano (login do iPhone; id duplicado `sino` corrigido), `maredigital.html` (versões, mare-login/escala/intake, Metas, regras novas, notif), `CODE_MAP.md` e `CHANGELOG.md` em dia. Ajuda do Radar e `guia-okr.html` sem mudança (o Radar só ganhou o módulo de lembretes). O conhecimento do Agente Ágil só muda quando a Ajuda/Changelog de PRODUÇÃO mudar (regenerar na promoção).

**Rodada de 2026-10-10:** Ajuda do Maré (+💡 Dicas, +📊 Central de Dados) e do Radar (+🎙️ apresentar ao vivo, +⋮⋮⋮ menu de produtos), `guia-okr.html` (38 slides: +ao vivo, +menu/dicas), `maredigital.html` (Oceano, Dicas, Painel Fluxo/Visão, versões) e `CODE_MAP.md` (~420 âncoras revalidadas por `.claude/skills/atualizarcodemap/revalidar_ancoras.py`) em dia. 

Rodada de revisão feita em 2026-10-07 (noite): `guia-okr.html` (prints refeitos com 🛒/🌐 e o sino com rodapé; +3 slides: trava, calendário, pauta/convidados/anotações), `maredigital.html`, `CODE_MAP.md`, ajuda in-app do OKR (`#okr-help-ov`) e `HELP_CONTENT` do kanban (Checklist/colar lista, Notificações/sino único, "Sua torre"), mais o prompt/ferramentas do Agente Ágil do OKR (torres, gerências, trava, agenda). **Resolvido (2026-10-09):** o guia mostra o Agente Ágil como botão flutuante e tem slides do Dashboard v2.58, Cards e Agente (prints refeitos; gerador em `docs/arezzo/testes/gerar_prints_guia.js`). Ao mudar o OKR de novo, lembrar que o guia é compartilhado (sem cópia dev) e que seus prints envelhecem a cada mudança de cabeçalho/símbolo — refazê-los com um harness de Playwright + Firebase fake (copiar de uma rodada anterior) em vez de editar o base64 à mão.
