---
paths:
  - "okr*.html"
  - "okr-apresentacao.slide.html"
  - "guia-okr.html"
  - "functions/okr/**"
  - "docs/CALENDARIO_GESTAO.md"
---

# Radar (OKR) — o que saber antes de mexer

> Movido do `CLAUDE.md` em 04/11/2026: só carrega quando um arquivo do Radar é lido ou editado. As regras gerais (dev→prod, `?v=`, tags, avisos, Radar × OKR nos textos) continuam no `CLAUDE.md`.

- `docs/CALENDARIO_GESTAO.md` — **calendário de gestão do Digital (03/11/2026; em produção desde 04/11/2026, Radar v2.103)**: pedido do Rafael, decisões do Caio, 📦 Entrega/macro/📋 Cadência no calendário do Radar, cobrança automática (`functions/okr/cobranca.js`), subagente de agenda (`agendaAgente.js`, propõe e a pessoa confirma), limites (regras do calendário abertas), deploy e próximos passos. **Leia antes de mexer no calendário do Radar ou no agente.**

- `guia-okr.html` — standalone visual guide (Marine Glass slide deck, same
  family as `apresentacao.criativa.html`) for the 🎯 OKR tab in
  `painel.html`/`painel-dev.html`, linked from a **📘 Guia OKR** button in
  that tab's toolbar. No `version.json`/`-dev` counterpart — same pattern
  as the other standalone tools below, just linked FROM a Maré Digital
  page instead of being unrelated to it.
