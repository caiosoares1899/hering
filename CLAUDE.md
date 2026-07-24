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

## Key files and their roles

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
- `firebase-messaging-sw.js` — the Service Worker. **Must stay at the domain
  root** (not in a subfolder) — it handles both offline caching and showing
  push notifications when the tab is closed/backgrounded.
- `functions/index.js` — the one Cloud Function, `sendPushOnNotification`.
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
  `risk`, `recorrente`, `painel_broadcast`). **To make a new notification
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
  whole file at once when investigating.

## Release process

Since deploy is automatic on push to `main` and there's no staging/CI gate,
this is what stands in for one — follow it for any change to a versioned
page (`kanban.html`/`kanban-dev.html`/`painel.html`/`painel-dev.html`):

1. **Dev first.** Land the fix in the `-dev` file only, bump its key in
   `version.json` **and** the `<div class="version">...</div>` string in
   that HTML file, open a PR, merge it. GitHub Pages only redeploys on a
   push to `main` — a commit sitting on a feature branch never reaches the
   live site, so the PR has to actually merge before anyone can test it
   there.
2. **Wait for explicit validation** from whoever asked for the fix before
   touching the prod file. Don't promote on your own judgement that "it
   looks right."
3. **Promote to prod** once validated: diff the `-dev` file against the prod
   file (`diff kanban.html kanban-dev.html`) — it should be exactly the
   accumulated fixes plus the version string/`VERSION_KEY` line. Apply that
   diff to the prod file, restore its own version string/`VERSION_KEY`
   (don't carry over the `-dev` one), bump `version.json`'s prod key, PR,
   merge.
4. **Tag the release.** On the commit that merged into `main` (the actual
   live state), create an annotated tag:
   - `kanban-vX.Y.Z` / `kanban_dev-vX.Y.Z-dev` for the kanban pair
   - `painel-vX.Y` / `painel_dev-vX.Y-dev` for the painel pair
   Push tags with `git push origin <tag>`. This is what makes "what's live
   right now" and "what changed between two releases" answerable with
   plain git (`git tag -l`, `git diff <old-tag> <new-tag>`) instead of
   spelunking through commit history.
5. **Update `CHANGELOG.md`** with a new entry under the right page/version,
   summarizing what changed and linking the PR number. Keep entries
   user-facing (what changed and why), not a copy of the commit's internal
   diff description.

Files without a `-dev` counterpart (`firebase-messaging-sw.js`,
`database.rules.json`, `functions/`) skip the dev-first step — they're
either shared (the service worker lives at the domain root for both
environments) or deployed through their own separate command, not GitHub
Pages. Still tag and log Cloud Function releases (see the `agente-agil-v1a`
example in `CHANGELOG.md`) since they're versioned independently of
`version.json`.
