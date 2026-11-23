# 🐟 Cardume — conversa do time dentro do Oceano (ideia de 23/11/2026)

Um "Slack nosso", **dentro do Oceano**, sem servidor novo: Firebase RTDB + login Google `@ciahering` + squads que já existem. Referência de mercado: os *slack clones* do GitHub (Mattermost, Rocket.Chat, Zulip, Matrix). Optamos por **não** subir um deles porque exigem servidor/banco/SSO próprios (projeto com a TI) e não falam com o Maré.

**O diferencial:** canal = squad, thread = card. A conversa mora junto do trabalho.

## Decisões do Caio (23/11/2026)
| # | Decisão |
|---|---|
| 1 | Dentro do Oceano (não Mattermost/Rocket.Chat self-hosted) |
| 2 | Squad piloto: **`dados`** |
| 3 | Primeiro um **protótipo isolado** (dados fictícios, sem Firebase), feito pelo **Codex** por contrato |
| 4 | Nome: **Cardume** (aceito ao aprovar o esboço) |

## Escopo do v0 (depois do protótipo)
- Canal por squad em tempo real, @menção e push (`mare-notif`), não lidas por canal, editar/apagar a própria mensagem.
- Conversa do card: comentários do card aparecem no canal como thread (convivem com os comentários atuais; um lado escreve, o outro lê — sem laço).
- **Fora do v0:** DM, anexos, busca completa, chamadas.

## v1 / v2
- **v1:** comandos do Agente Ágil (`/card criar`, `/quem está hoje`, `/resumo`), prévia de card colado, status da Escala ao lado do nome, "@Agente resume e cria os cards".
- **v2 (só se o piloto pedir):** DM, anexos.

## Dados (rascunho, v0 — R3: nota de desenho antes do código)
- `kanban/cardume/{squad}/msgs/{id}` — `{uid, texto, ts (ISO), editado?, card?}`; leitura só de quem é da squad; escrita só do próprio `uid`.
- `kanban/cardume/lidas/{uid}/{squad}` — último `ts` lido.
- Página escuta `limitToLast(50)` do canal aberto; não lidas por um resumo pequeno por canal (sem baixar histórico).

## Fronteira (para o v0)
Texto de outra pessoa chegando ao DOM → **só `textContent`**, nunca `innerHTML`; link de card validado por padrão (`^c\d+…`) antes de virar prévia; regras novas no simulador (`functions/rules/rulesSim.js`) e 2 revisões de modelos diferentes.

## Fases
| Fase | Entrega | Banco | Quem |
|---|---|---|---|
| **0 · protótipo** | `docs/demo/cardume-prototipo.html` + teste | zero | Codex (contrato abaixo) · Claude revisa |
| **1 · v0 piloto** | `cardume-dev.html` na squad `dados` | nós novos + regras | Claude (R3) |
| **2 · v1** | Agente, prévia de card, Escala | leitura da Escala | a decidir |

## Contrato do protótipo (Codex)
Entregue ao Codex em 23/11/2026 por `scripts/delegar.sh cardume-prototipo` (cópia do contrato em `~/hering-logs/delegacoes/`). Resumo: `docs/demo/cardume-prototipo.html` com 3 colunas (canais · conversa · thread do card), compositor com @menção e `/card criar` · `/quem` · `/resumo` (respostas fictícias do 🤖 Agente), editar/apagar, não lidas, 3 temas, celular, tudo por `textContent`; teste `docs/arezzo/testes/test_cardume_prototipo.js`.
