# 🐚 Concha (ex-🐟 Cardume) — conversa do time dentro do Oceano (ideia de 23/11/2026)

> **Renomeada para Concha em 24/11/2026** (pedido do Caio). Só o nome visível mudou: o arquivo (`cardume-dev.html`), a URL, o banco (`kanban/cardume/…`), o tipo de notificação (`cardume_mencao`) e os nomes destes documentos seguem "cardume". "Cardume" continua sendo outra coisa no Maré: o escopo da squad nas Estrelas do Mar e o botão 🐟 Cardume Criativo.

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

## Plano de implementação do v0 (revisto em 24/11/2026)

**Critério de sucesso do piloto (proposta adotada em 24/11):** *alguém cola um card → menciona a pessoa certa → ela volta pelo Sino ao ponto exato da conversa → a decisão é registrada no Maré.* Se a `dados` fizer isso no Cardume, o v0 cumpriu o papel. Visão: o Cardume é a **caixa de entrada do trabalho no Oceano**, com o Maré ↔ Cardume nos dois sentidos.

**Princípio (mudou em 24/11): conversar ≠ registrar.** O canal é privado e apagado em 90 dias; o comentário do card é permanente e visível para quem vê o card. Por isso são **duas ações explícitas**: **💬 Conversar no canal** (a discussão, privada) e **📝 Registrar no card** (a pessoa escolhe o trecho, vê quem vai poder ler e grava em `card_comments`, que herda contagem e histórico do Maré). No Maré, o card ganha **Ver conversa no Cardume**, que abre o ponto exato, se a pessoa for membro do canal.

| # | Etapa | Entrega | Risco · autor | PR / deploy |
|---|---|---|---|---|
| 0 | Decisões do Caio | respondidas em 23–24/11 (ver [`cardume-v0-banco.md`](cardume-v0-banco.md)) | — | ✅ |
| 1 | Regras dos canais oficiais | `kanban/cardume`, privado, membros por ADM ou PO/Org da squad | R3 · Claude | ✅ #1921 + #1922, deploy em 24/11 |
| 1b | **Canais temáticos/temporários** | qualquer pessoa cria; aberto ou só convidados; data de fim → só leitura → limpeza | R3 · Claude | PR · 2 revisões · `firebase deploy --only database` |
| 2 | Página `cardume-dev.html` | a tela do protótipo ligada ao banco: canais, mensagens, editar, apagar com 5 s de desfazer, não lidas, gestão de membros | R2 · Claude | PR · `version.json` `cardume_dev`, Biblioteca, `promover.js`, `mapa.js` |
| 3 | Card ↔ conversa | prévia do card colado; **📝 Registrar no card**; **Ver conversa no Cardume** no Maré com link para a mensagem | R2 · Claude | ✅ #1935 + #1936 + #1937, validada em 24/11 |
| 4 | Menções, respostas e push | aba **Menções e respostas**, link direto para a mensagem, push de @menção e resposta, **silenciar canal** (respeita o Não Perturbe) | R3 · Claude | ✅ #1932 + #1933, deploy e teste com duas contas em 24/11 (respostas e silenciar ficam no backlog) |
| 5 | Entradas | cartão no menu de apps do Oceano e atalho no Maré | R1 · Codex | PR |
| 6 | Limpeza e backup | `cardumeLimpeza` (90 dias; canal temático vencido sai inteiro) e backup semanal | R3 · Claude | PR · deploy da função |
| 7 | Piloto `dados` (1–2 semanas, no dev) | medir o critério de sucesso, mensagens/dia, quem usa, banda | — · Caio e time | — |
| 8 | Ajuda, dica e prod | Ajuda, dica, `/subirproprod`, aviso no Mural/WhatsApp, tag `cardume-v1.0` | R0 · Antigravity · Claude | PR de promoção |

### `@card:` e `@objetivo:` sem pesar no banco (desenho de 24/11/2026)
Item do backlog: `docs/quadro/backlog.md#cardume-citar`. Princípio: **não ler nada novo do banco para citar**; reaproveitar o que já está no aparelho da pessoa (o `localStorage` é da mesma origem para todas as páginas do Oceano).

- **`@objetivo:` usa o cache do Sonar.** O `mare-sonar` já lê `kanban/okr/objetivos` + `marcos` (~390 KB em prod) **só quando a busca pede o Radar** e guarda a versão enxuta (`id`, título, período, responsáveis) por 3 h em `oceano_sonar_radar[_dev]`, compartilhada entre as páginas. O Cardume lê esse cache. Se ele estiver vencido, faz a mesma leitura e grava no mesmo formato, ou carrega o próprio `mare-sonar`: no máximo **uma leitura a cada 3 h por aparelho**, e nenhuma se a pessoa usou o `Ctrl+K`. Mesma régua de visibilidade do Sonar (arquivado e `MARE_SO_HERING`).
- **`@card:` usa um índice enxuto deixado pelo Maré.** Cada card no banco é um objeto grande, e não existe lista só de títulos. Mas o Maré já tem os cards da squad aberta em memória: ao carregar ou mudar o board, ele grava `oceano_cards_<squad>[_dev]` = `{t: quando, v: [{id, t: título (até 200), c: coluna}]}`, com cerca de 40 KB para 500 cards (**zero leitura a mais**). O Cardume oferece os cards das squads com índice no aparelho, e o mais recente vem primeiro.
  - **Não cobre** squad que a pessoa nunca abriu no Maré naquele aparelho. Nesse caso, colar o link continua valendo (o chip da v0.6).
  - **Validade:** o índice fica até 7 dias; o título exibido no chip continua vindo da leitura do card (v0.6), então título velho no índice não engana.
- **Se o piloto pedir cobertura total:** uma função mantém `kanban/squads/{sq}/dados/cards_titulos/{id}: "título"`, disparada só quando o título muda (`cards/{k}/title`), com leitura única por squad e sessão (~60 B por card). **Precisa** de regra nova (leitura igual à de `dados`, escrita só do servidor), teste no simulador e revisão.
- **Descartado:** consulta por prefixo (`orderByChild('title').startAt(q)`). Devolve os cards inteiros, distingue maiúscula de minúscula, só casa o início do título e exige `.indexOn` novo.
- **Fronteira:** título vindo do cache é texto de terceiros e entra só por `textContent`. O cache é do aparelho e pode ter sido mexido, então os ids passam pelo `ID_RE` antes de virar link ou leitura, e o texto gravado na mensagem guarda só o link/id.

### Depois do piloto (fila, por ordem)
1. **Escala no canal:** "quem está na escala hoje" no topo; horário ou férias ao lado do nome na @menção.
2. **Sonar (`Ctrl+K`):** achar canais (barato). Busca **dentro das mensagens** pede desenho próprio (o RTDB não busca texto).
3. **Mensagem → trabalho:** **Criar card a partir da mensagem** (abre o formulário do Maré para revisar e devolve o link no canal) e **Vincular ao card**.
4. **Radar na conversa:** prévia de objetivo/marco; resumo semanal opcional (marcos próximos, cards bloqueados, Intake da squad).
5. **📌 Comunicados:** canal que mostra o Mural do Painel com os mesmos públicos, fixação e validade (quem publica continua usando um lugar só).
6. **Agente Ágil:** comando explícito para resumir uma conversa ou preparar um card (fora do piloto, decisão do Caio).
7. DM, anexos e chamadas: só se o piloto pedir.
