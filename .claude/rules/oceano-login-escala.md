---
paths:
  - "oceano*.html"
  - "mare-login*.js"
  - "escala*.html"
  - "intake*.html"
  - "travessia*.html"
  - "minipainel.html"
  - "mac/**"
  - "windows/**"
  - "functions/oceano/**"
---

# Oceano, login direto, Escala e Mini painel — o que saber antes de mexer

> Movido do `CLAUDE.md` em 04/11/2026: só carrega quando um desses arquivos é lido ou editado. O modo "só Hering", o menu de produtos e a regra de nomes (Maré/Radar/…) continuam no `CLAUDE.md`.

- `mare-login-dev.js` / `mare-login.js` — **login Google direto (2026-10-13, em prod)**: quarto módulo compartilhado (raiz do domínio), usado por `oceano` e `kanban` (Maré). Entra em cena em **qualquer iPhone/iPad** (atalho da tela inicial OU Safari comum — o popup do Firebase trava ou dá "missing initial state" em ambos; ou com `?loginDireto=1`; convidado `?login=local` fica no popup): leva a página inteira ao Google (`response_type=id_token`, volta no fragmento da própria página) e entrega o token com `signInWithCredential` (a página precisa expor `window._signInIdToken`). Páginas **sem** URI própria cadastrada (Escala, Intake) usam `MareLogin.iniciar({hub:true})`: a volta do Google é no Oceano, que leva a pessoa de volta pra página de origem. **Exige** cada URL de página que o usa (`…/oceano.html`, `…/kanban.html` e os `-dev`) cadastrada em *URIs de redirecionamento autorizados* do cliente web do projeto (Google Cloud Console). Mesmo ciclo dev→prod (`?v=` nas páginas; ao promover: `mare-login.js` + `oceano.html` + `kanban.html`).

- `escala-dev.html` — **Escala (2026-10-12; prod `escala.html` v1.7 desde 2026-10-13, dev v1.9)**: página própria (login Google @ciahering, como o `intake-dev.html`) com a escala de trabalho/plantão/folga por dia — visão da squad, visão global e cadastro (a própria pessoa; PO/Organizador/ADM da squad editam a de todos). Dados em `kanban/escala/{data}/{squadId}/{uid}` (regras novas em `database.rules.json` — **exige `firebase deploy --only database`**). Entradas: visão 👥 Escala dentro do 📅 Calendários do Maré (iframe com `?embed=1`) e aba Escala ↗ no Painel. **v1.8–v1.9 (só dev):** filtros de squad/subtime numa mini tela (botão 🔎 Filtros), 📊 Visão Gantt do dia (+ JPG do Gantt) e ☕ pausas (campo `p` nas entradas — **exige `firebase deploy --only database`**). Mesmo ciclo dev→prod (`escala.html` ao promover, junto com `kanban.html`/`painel.html`). Ver `docs/OCEANO.md` e `CODE_MAP.md`.
