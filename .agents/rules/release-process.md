---
trigger: always_on
description: Processo de release dev -> prod, versionamento, tags, CHANGELOG, avisos e dicas do Maré Digital / Radar / Oceano
---

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
6. **Send avisos + log the batch to the card.** Every time `kanban.html`
   (prod) gets promoted, always: (a) draft the two announcements — a Mural
   post (via console script against `painel.html`, or the
   `COMUNICADO_RASCUNHOS_SEED` seed mechanism if GitHub/deploy access is
   available) and a WhatsApp-ready text — summarizing what's new/changed in
   user-facing terms; and (b) log the batch as a comment on the right
   Firebase card, via a console script (squad `dados` for both):
   - **`c1785199972010_nd0`** ("Implementação Agente Ágil") — anything
     about the Agente Ágil, either implementation (`functions/agente-agil/`,
     `functions/agente-agil-orquestrador/`, the client-side agent tools in
     `kanban.html`/`kanban-dev.html`) — comments, checklist items, canário/
     scenario results, next-steps planning, all of it.
   - **`c1783541085140`** ("Melhorias Maré Digital") — everything else
     about Maré Digital (kanban/painel features, Firebase cost work,
     optimization routines, etc.).
   This is a standing rule, not something that needs to be asked for each
   time. **Always use `ts: new Date().toISOString()` for any comment written
   this way — never `ts: Date.now()`** — `loadComments()` sorts with
   `a.ts.localeCompare(b.ts)`, which throws and silently breaks the ENTIRE
   comment list for that card if `ts` isn't a string.

7. **Avaliar uma dica (regra permanente, 2026-10-09).** Toda vez que implementarmos algo **novo e visível** em Radar, Maré ou Oceano, avalie se vale uma dica (mini popup) sobre isso — e diga na resposta o que decidiu ("dica: sim, X" ou "dica: não, porque Y"). Vale uma dica quando é um atalho/recurso que a pessoa não descobre sozinha e que economiza tempo; **não vale** pra correção de bug, mudança só interna, ou algo que já é óbvio na tela. Texto simples e curto (uma frase), com "Saiba mais" se houver tópico na Ajuda (e a Ajuda também precisa estar em dia — `/atualizarhelpcontent`). Implementar = linha no `CATALOGO` de `mare-dicas-dev.js` (+ `quando`/gatilho se for lugar novo) e entrada no `CHANGELOG.md`.

Files without a `-dev` counterpart (`firebase-messaging-sw.js`,
`database.rules.json`, `functions/`) skip the dev-first step — they're
either shared (the service worker lives at the domain root for both
environments) or deployed through their own separate command, not GitHub
Pages. Still tag and log Cloud Function releases (see the `agente-agil-v1a`
example in `CHANGELOG.md`) since they're versioned independently of
`version.json`.

### Promotion cadence for `kanban.html`/`painel.html` (prod): bugs now, features batched

Standing rule (2026-08-14): **bug fixes still promote to prod immediately**
once validated (step 3 above, no change there) — but **feature promotions
get batched and concentrated at the end of the day** instead of shipping
one-by-one as each gets validated. Exceptions handled ad hoc when they come
up in conversation (e.g. something time-sensitive), not a rigid rule.

Why: every prod version bump forces every open tab to reload within
`CHECK_INTERVAL_MS` (5 min) via the auto-update overlay (`kanban.html`
~line 24439). A reload isn't free — it re-authenticates and re-attaches
every Firebase listener from scratch (`cards`, `cards_index`, `tags`,
`columns`, `presence`, ...), which is the expensive "cold start" the
`_dbg` byte-measurement system (~line 6702) tracks. Confirmed against real
data: 13 separate "Promove pra prod" merges landed within ~40h on
2026-08-04/05, and those are the two highest-bandwidth days in the
`_debug_bytes_daily` sample for that window (~210MB and ~161MB, vs. a
typical quiet day around 1-2MB) — each promotion re-charges the cold-start
cost to everyone who had the board open at the time. Batching feature
promotions into one push per day means one forced reload instead of many.
