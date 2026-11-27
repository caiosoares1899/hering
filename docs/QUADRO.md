# Quadro: o estado do dia

> **O único arquivo de coordenação que os agentes editam no dia a dia.** As regras ficam em [`COORDENACAO_AGENTES.md`](COORDENACAO_AGENTES.md) e o que já foi feito, em [`historico/`](historico/).
> **Formato fixo** (o `mare-cli.js brief` lê estas tabelas): uma linha por item, até ~200 caracteres; o detalhe vai num link (`quadro/…`, PR ou doc). Arquivos sempre entre crases, separados por vírgula.
> Ao **começar**: linha em *Em andamento* com os arquivos que vai tocar (arquivo reservado = ninguém mais toca até o merge). Ao **terminar**: tire a linha. Item resolvido sai da tabela; a confirmação vai para o histórico.

## Em andamento

| Agente | Branch | Arquivos | Desde |
|---|---|---|---|
| Claude | `claude/ilha-concha` (worktree `~/hering-perfil`) | `mare-ilha-dev.js`, `cardume-dev.html` | 26/11/2026 |


## Fila

Contratos prontos, na ordem. O Caio manda uma linha ("pegue o próximo da sua fila"); o agente pega o 1º, move para *Em andamento* e segue o contrato (formato em [Contrato de tarefa](COORDENACAO_AGENTES.md#contrato-de-tarefa-v2)). O Antigravity continua sendo acionado por mensagem do Caio.

| Agente | Risco | Tarefa | Contrato |
|---|---|---|---|
| Codex | R3 | 🔍 Revisão cruzada do 📝 Minhas notas (canal `eu-{uid}`: terceiro tipo nas regras, ninguém além da dona lê/grava, nem ADM; `notas/{uid}`) — só revisar, comentar no PR | [desenho](ideias/cardume-v0-banco.md#-minhas-notas--o-canal-só-seu-26112026-r3) |
| Antigravity | R3 | 🛡️ `/auditoriaseguranca` do 📝 Minhas notas (privacidade das notas; ramos de ADM e PO retirados para `eu-*`) | [desenho](ideias/cardume-v0-banco.md#-minhas-notas--o-canal-só-seu-26112026-r3) |
| Codex | R0 | 💡 Dica "🧭 Boas-vindas em ❓ Ajuda" no `mare-dicas-dev.js` (bump do `?v=` em 4 páginas); contrato a escrever pelo Claude | [onboarding-mare](ideias/onboarding-mare.md) |

## Escalado

| Quem achou | O que | Detalhe | Data |
|---|---|---|---|
| Codex → Claude | Concha dev v0.55: sino da Ilha para de abrir após sair e entrar na mesma conta sem recarregar. | [reprodução](quadro/escalados.md#concha-sino-da-ilha-após-relogin) | 26/11/2026 |
| Codex → Claude | R3 · #oceano: avisos de promoção enviados pelo perfil de sistema Agente Ágil, com publicação acionada por ADM. | [escopo](quadro/escalados.md#concha-agente-ágil-como-remetente) | 26/11/2026 |
| Codex · Claude | 🔴 **`kanban/usuarios` legível por toda conta Hering** (`.read` no nó-pai): notificações, `fcm_tokens` e `notif_prefs` de todo mundo. Já expõe o `travessia_apoio` ("{nome} marcou que não está bem hoje"). Achado na revisão do Cardume (#1931); correção mexe no Maré inteiro (Painel lê o nó) — R3 à parte. **Plano aprovado em 24/11** (só ADM lê o cadastro completo; torre/Gestor OKR no diretório): [desenho](ideias/usuarios-leitura-fechar.md), fases A → B → C | [escalados](quadro/escalados.md#usuarios-leitura-ampla) | 24/11/2026 |
| Codex | 🏖️ UI/UX Férias: **UI01, UI02 e UI04 resolvidos em 16/11** (tela cheia); faltam UI03 (foco preso na 🧳), UI05 (títulos cortados na 🧳), UI06 (alvos de toque) e UI07 (fonte no tablet do Radar) — módulo é do Claude | [auditoria](FERIAS_UI_AUDITORIA_2026-11-13.md) | 13/11/2026 |
| Claude | `okr-dev.html` sem `prefers-reduced-motion`: o `okrPulse` do "digitando…" do Agente roda com movimento reduzido | [escalados](quadro/escalados.md#radar-reduced-motion) | 09/11/2026 |
| Claude | `test_dicas.js` desatualizado: espera 33–35 dicas no Painel, hoje são 38 (falha também na `main`); e tem caminho do Playwright/porta fixos do Linux | `docs/arezzo/testes/test_dicas.js` L133 | 13/11/2026 |
| Antigravity | `database.rules.json`: `humor`/`humor_comp` da Travessia aceitam nota decimal (ex.: `1.5`); exigir inteiro | [escalados](quadro/escalados.md#travessia-humor-inteiro) | 11/11/2026 |
| Codex | Radar: recalcular espaço do detalhe após #1866, reduzir vazios no rodapé e preservar Marcos; Progressos pode rolar | [escopo](quadro/escalados.md#apresentacao-sem-rolagem) | 18/11/2026 |
| Caio | Radar: gráfico de Evolução do atingimento com a meta como linha d’água na apresentação | [escopo](quadro/escalados.md#apresentacao-linha-dagua) | 18/11/2026 |
| Antigravity | Segurança das regras (`/auditoriaseguranca` do Painel): C1/C2 feitos; **faltam C3, C4, D7/D8**. Cuidado com externos e `painel_viewers` | [escalados](quadro/escalados.md#seguranca-regras-c3-c4) | 11/11/2026 |
| Codex | Radar: relógio opcional, encerramento após sala vazia e previsão de tempo por pauta | [desenho](quadro/escalados.md#radar-tempo-da-reuniao) | 19/11/2026 |

| Codex → Claude | GIFs com KLIPY no Cardume dev. Piloto na squad Dados, com novo campo de mensagem e validação das regras (R3) | [desenho](quadro/escalados.md#gifs-no-cardume-com-klipy) | 24/11/2026 |

## Pendente de deploy

Só o Caio roda, depois do resync do clone. O agente que deixa um deploy para trás acrescenta a linha com o comando completo; quando o Caio confirma, a linha sai daqui e a confirmação vai para o histórico.

| Quem adicionou | O que mudou | Comando | Data |
|---|---|---|---|
| Claude | 👤 Perfil da pessoa: nó `kanban/perfis/{uid}` (só a Hering lê, só a dona grava) — **antes do merge**, a partir da branch `claude/perfil-cartao` (já traz as regras da `main`); depois o backup passa a guardar `perfis` | `firebase deploy --only database --project hering-onboarding` e, após o merge, `firebase deploy --only functions:backupCompletoSemanal,functions:backupGlobalDiario --project hering-onboarding` | 26/11/2026 |
| Antigravity | 📢 Concha: regras dos canais permanentes `geral` e `oceano` (leitura para toda conta Hering; escrita exclusiva de ADM) — **antes do merge**, a partir da branch `antigravity/concha-canais-gerais` | `firebase deploy --only database --project hering-onboarding` | 26/11/2026 |
| Claude | 📝 Concha: regras das Minhas notas (canal `eu-{uid}` só da dona; nó `notas/{uid}`) — **antes do merge**, a partir da branch `claude/concha-minhas-notas` | `firebase deploy --only database --project hering-onboarding` | 26/11/2026 |
| Claude | 🛟 Restaurar comentários sem reativar o Agente Ágil e alarmes de ADM também por `adm_emails` (#1874) | `firebase deploy --only functions:backupCompletoApi,functions:backupVigia,functions:vtexStatus,functions:githubStatus,functions:firebaseStatus --project hering-onboarding` | 19/11/2026 |

## Backlog

| Ideia | Dono | Detalhe |
|---|---|---|
| 🐚 Concha: 🧷 `@card:` só funciona com o **Maré dev** aberto no aparelho (só o `kanban-dev.html` grava a lista `oceano_cards_<squad>_dev`). Na promoção da Concha: levar `_gravarIndiceConcha()` ao `kanban.html` e a Concha aceitar também a lista do prod (mesmo `kanban/squads/<sq>/dados`). Decisão do Caio (25/11): esperar a promoção | Claude | [desenho](ideias/cardume.md) |
| 🐚 Concha: links de mensagens, Salvos, fixados, histórico, fios e outras ideias inspiradas no Slack e concorrentes | Caio escolhe | [comparativo](quadro/backlog.md#concha-comparativo) |
| 🔎 Histórico do período/hora do card: já existe — conferir se algum caminho não registra | Claude | [escopo](quadro/escalados.md#periodo-historico) |
| 🪟 Diagrama `.arq` interativo + rodapé/mapa nas abas institucionais do Oceano (o vidro lapidado ficou pronto na #1806) | Claude | [backlog](quadro/backlog.md#vidro-lapidado) |
| 🏝️ Ilha Dinâmica no Oceano (lobby + host) — o Maré foi validado pelo Caio em 16/11 | Claude | [backlog](quadro/backlog.md#ilha-dinamica) |
| 🧭 Plano da consultoria (guardado em 10/11); próximo: T4 da Travessia | Claude | [backlog](quadro/backlog.md#consultoria) |
| 🔬 Dossiê de concorrência do Antigravity (34 ideias em 4 levas) | Caio escolhe | [backlog](quadro/backlog.md#dossie-concorrencia) |
| 🧲 Ideias do Kanbanize: ícone de link, tempo por coluna, Monte Carlo, fila × ativa, causas de impedimento e ponte com a TI | Claude · ponte: Caio com a TI | [backlog](quadro/backlog.md#ideias-kanbanize) |
| 🐚 Concha (ex-Cardume; arquivo e banco seguem `cardume`): chat do time no Oceano (canal = squad, thread = card); piloto `dados`; regras (oficiais + temáticos) no ar em 24/11; etapas 3 (card ↔ conversa) e 4 (menções + push) validadas pelo Caio em 24/11; GIF, ↩️ Responder, Marine Glass e 😀 reações no dev (25/11); próximas ideias: [escrever melhor](quadro/backlog.md#cardume-texto), [aviso de mensagem nova com 🔕 silenciar](quadro/backlog.md#cardume-avisos), [`@card:` e `@objetivo:`](quadro/backlog.md#cardume-citar), [📳 chamar atenção (zumbido do MSN)](quadro/backlog.md#cardume-zumbido) **Decisão do Caio (26/11): ainda não sobe para o prod; quando subir, o arquivo de prod nasce como `concha.html` (não `cardume.html`).** Na promoção, trocar o nome também em: `mare-notif` (`PAGES.cardume` do prod = `concha.html`), URLs dos pushes em `functions/oceano/conchaAvisos.js` e `functions/common/cardumePush.js`, links do Oceano/menu ⋮⋮⋮, `firebase-messaging-sw.js`, alvo no `promover.js` (`cardume-dev.html` → `concha.html`), chave do `version.json` e `docs/BIBLIOTECA.md`; o banco segue `kanban/cardume`. Auditorias e revisões R3 fechadas em 26/11 (#2001, #2003). | Claude | [ideia](ideias/cardume.md) |
| 🔔 **Sino unificado:** um Sino só (componente no `mare-notif`) com os layouts por família do Maré, em todos os apps; fase 1 = Cardume, depois Oceano → Radar → Painel → Maré | Claude · Codex | [plano](ideias/sino-unificado.md) |
| 🧪 Ferramentas de teste visual (`CENARIO=`, Chrome do `~/hering-tools`, contact sheet) | Claude | [backlog](quadro/backlog.md#ferramentas-teste-visual) |
| 🎬 Gerador de vídeo/GIF de release (sem Remotion) | Caio decide | [backlog](quadro/backlog.md#video-release) |
