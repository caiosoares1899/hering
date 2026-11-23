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

## Protótipo
`docs/demo/cardume-prototipo.html` (#1919, no ar em `…/hering/docs/demo/cardume-prototipo.html`) · teste `docs/arezzo/testes/test_cardume_prototipo.js` · capturas `docs/capturas/cardume-prototipo/`. Mostrado ao Rafael em 23/11/2026.

## Plano de implementação do v0 (23/11/2026)

**Princípio que simplifica tudo:** a "thread do card" **não é cópia** — é o próprio `card_comments` do card (o mesmo caminho do Maré). Responder no Cardume = comentar no card. Assim não existe espelho nem laço, e o card herda de graça o que já funciona nos comentários: contagem (`contarComentarios`), @Agente (`agenteAgilMencao`) e o histórico. O canal só guarda as mensagens soltas e a *referência* a um card.

| # | Etapa | Entrega | Risco · autor | PR / deploy |
|---|---|---|---|---|
| 0 | **Decisões do Caio** | as 4 perguntas abaixo respondidas | — | — |
| 1 | **Nota de desenho + regras** | nós do banco, regras e testes no simulador (abaixo) | R3 · Claude | PR só de regras · 2 revisões (Codex + leitura de segurança do Antigravity) · `firebase deploy --only database` |
| 2 | **Página `cardume-dev.html`** | a tela do protótipo ligada ao banco, só canal (sem thread ainda) | R2 · Claude | PR · `version.json` `cardume_dev`, Biblioteca, `promover.js` (par `cardume`), `mapa.js` |
| 3 | **Thread do card** | prévia do card citado + conversa = `card_comments` do card | R2 · Claude | PR · teste de que o comentário aparece no Maré |
| 4 | **Menção e push** | `@pessoa` → `kanban/usuarios/{uid}/notificacoes` tipo `cardume_mencao` (sino + push) | R3 (function) · Claude | PR · `MareNotif.TIPOS` + `PUSH_TYPES` · `firebase deploy --only functions:sendPushOnNotification` |
| 5 | **Entradas** | cartão no menu de apps do Oceano e atalho no Maré, só para quem está numa squad liberada | R1 · Codex | PR |
| 6 | **Piloto `dados`** (1–2 semanas, no dev) | uso real; medir mensagens/dia, quem usa, banda do Firebase | — · Caio e time | — |
| 7 | **Ajuda, dica e prod** | tópico na Ajuda, dica, `/subirproprod`, aviso no Mural/WhatsApp, tag `cardume-v1.0` | R0 · Antigravity (Ajuda) · Claude (release) | PR de promoção |

### Etapa 1 — dados e regras (rascunho para a nota de desenho)
| Nó | Conteúdo | Quem lê | Quem escreve |
|---|---|---|---|
| `kanban/config/cardume_squads/{squad}` | `true` = squad liberada (piloto: só `dados`) | logado | ADM |
| `kanban/cardume/msgs/{squad}/{msgId}` | `uid`, `texto` (string, ≤ 4000), `ts` (número do servidor), `editado?`, `card?` (id validado `^[A-Za-z0-9_-]{1,64}$`) | membro da squad liberada | só o próprio `uid`, só na squad dele; editar/apagar só a própria; não muda `uid`/`ts` |
| `kanban/cardume/ultima/{squad}` | `{ts, uid}` da última mensagem | membro | escrita junto com a mensagem (update multi-caminho), `ts` = `now` |
| `kanban/cardume/lidas/{uid}/{squad}` | último `ts` lido | o próprio | o próprio |

- Membro = `root.child('kanban/usuarios/'+auth.uid+'/squads/'+$squad).val() === true` (mesma checagem das squads hoje) **e** e-mail `@ciahering.com.br`.
- Testes em `functions/rules/rulesSim.js`: membro escreve; não-membro não lê nem escreve; forjar `uid` falha; editar mensagem alheia falha; texto > 4000 falha; squad não liberada falha; `card` com caractere estranho falha.

### Etapa 2 — a página
- Molde: o protótipo (layout, temas, `textContent`) + o boot das páginas da família (`mare-login`, `firebaseConfig` sobrescrevível, `-dev` em nós `_dev` se fizer sentido).
- Leitura enxuta: `limitToLast(50)` só no canal aberto; "carregar anteriores" sob demanda; não lidas comparando `ultima` × `lidas` (3 leituras pequenas, nunca o histórico).
- Sem DM, anexos nem busca (fora do v0).

### Perguntas ao Caio (etapa 0)
1. **Quem pode ler `# dados`:** só a squad `dados`, ou qualquer pessoa logada (como um canal aberto)?
2. **Apagar:** some de vez, ou fica "mensagem apagada"? (Sugestão: "mensagem apagada", sem o texto.)
3. **Guardar por quanto tempo:** para sempre, ou limpar mensagens de mais de N meses? (Afeta custo e LGPD.)
4. **Comandos do Agente** (`/card criar`, `/quem`, `/resumo`): ficam para o v1, como no plano, ou algum entra já no piloto?

**Depois do v0 (v1):** comandos do Agente por uma função (`onCall`, R3), `/quem` lendo a Escala, status da Escala ao lado do nome; DM e anexos só se o piloto pedir.
