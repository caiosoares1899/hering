# Para 18/10/2026 — mapa do repositório, resumo no Ecossistema e push dos pedidos do Antigravity

Combinado com o Caio na noite de 17/10 (junto com a correção do tema claro: `docs/ideias/tema-claro-painel-radar-2026-10-17.md`).

## 1. Mapa do repositório no GitHub
**Pedido:** "fazer um mapa do rep github e deixar lá" — um mapa do repositório **dentro do próprio repositório**.
- Já existe a **Biblioteca** (`docs/BIBLIOTECA.md`): onde mora cada arquivo e por quê. O mapa é o passo seguinte: **visão em árvore + relações** (quem carrega quem: páginas → módulos `mare-*`, páginas → Firebase/nós, `functions/` → nós do banco, skills → docs), de leitura rápida para quem chega de fora (TI).
- Proposta: `docs/MAPA_DO_REPOSITORIO.md` (árvore comentada + diagrama Mermaid, que o GitHub renderiza) ligado da Biblioteca e do `README.md`; gerado/validado por script (`scripts/checar.js` já cobra a raiz; estender para o mapa) para não envelhecer.

## 2. Resumo do mapa no `ecossistema.html` + botão para o repositório
- Seção curta no `ecossistema.html` (ex.: dentro da 08 GitHub ou nova "Mapa do repositório") com o resumo da árvore e um **botão que abre o repositório** (`https://github.com/caiosoares1899/hering`) e outro para o mapa renderizado (`…/blob/main/docs/MAPA_DO_REPOSITORIO.md`).
- Lembrar: a página não tem `-dev` (entra no ar no merge); refazer as medições (tags no GitHub agora publicadas — tirar a nota da "lacuna conhecida" e trocar o número 338 por `git ls-remote --tags origin`).

## 3. Push no celular quando o Antigravity "pedir" algo no tratamento de bugs
**Pedido:** quando houver um *request* do Antigravity dentro do monitoramento/tratamento de bugs, mandar push para o celular do Caio. **Ver se dá.**
- **O que já existe:** `functions/plantao/webhook.js` (PR aberta pelo Antigravity → `avisarAdms`, tipo `plantao_bug`, "🔧 PR do plantão pronta"/"🧪 … pronta para testar"), `plantaoVigia` ("⏰ Bug parado", "🤖 Antigravity não está buscando bugs") e `plantaoBugNovo` — todos já criam notificação para os ADMs e `plantao_bug` está no `PUSH_TYPES` de `sendPushOnNotification`. Então **parte disso já deveria chegar no celular**.
- **Investigar primeiro (se não está chegando):** deploy de `sendPushOnNotification`/`plantaoBugNovo`/`plantaoVigia` feito? interruptor do tipo `plantao_bug` ligado em 🔔 Notificações do Painel (`kanban/notif_config/plantao_bug`)? Não Perturbe do Caio? push ativo **neste aparelho** (token FCM)? `plantao_ativo` ≠ false?
- **Lacunas prováveis (o que provavelmente falta cobrir):** (a) o Antigravity respondeu **"ESCALAR AO CLAUDE"** ou pediu decisão/aprovação (hoje só fica no texto da resposta/na PR); (b) PR de branch `antigravity/*` **fora do plantão** (nenhum aviso); (c) comentário de revisão do Claude pedindo algo ao Antigravity. Para (b)/(c), o gancho é o webhook do GitHub (com assinatura) — **nunca** reagir a texto de issue/comentário de terceiros (linha vermelha do `AGENTS.md`); só a *metadata* da PR (branch, autor, título) e o *segredo* do webhook.
- **Desenho candidato:** tipo novo `antigravity_request` (entrada em `MareNotif.TIPOS` + `PUSH_TYPES`; deploy de `sendPushOnNotification` + função do webhook + `database.rules.json` se houver nó novo), aviso só aos ADMs, com link para a PR/ficha; respeitar interruptor e Não Perturbe como os outros tipos. Deploy é do Caio (resync antes — `CLAUDE.md`).
