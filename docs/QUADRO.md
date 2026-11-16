# Quadro: o estado do dia

> **O único arquivo de coordenação que os agentes editam no dia a dia.** As regras ficam em [`COORDENACAO_AGENTES.md`](COORDENACAO_AGENTES.md) e o que já foi feito, em [`historico/`](historico/).
> **Formato fixo** (o `mare-cli.js brief` lê estas tabelas): uma linha por item, até ~200 caracteres; o detalhe vai num link (`quadro/…`, PR ou doc). Arquivos sempre entre crases, separados por vírgula.
> Ao **começar**: linha em *Em andamento* com os arquivos que vai tocar (arquivo reservado = ninguém mais toca até o merge). Ao **terminar**: tire a linha. Item resolvido sai da tabela; a confirmação vai para o histórico.

## Em andamento

| Agente | Branch | Arquivos | Desde |
|---|---|---|---|
| Claude | `claude/gantt-dia-ux` | `mare-gcal-dev.js`, `kanban-dev.html` (só `_ganttDia*`), `okr-dev.html` (só `_GCAL_V` + versão), `version.json` | 16/11/2026 |


## Fila

Contratos prontos, na ordem. O Caio manda uma linha ("pegue o próximo da sua fila"); o agente pega o 1º, move para *Em andamento* e segue o contrato (formato em [Contrato de tarefa](COORDENACAO_AGENTES.md#contrato-de-tarefa-v2)). O Antigravity continua sendo acionado por mensagem do Caio.

| Agente | Risco | Tarefa | Contrato |
|---|---|---|---|
| Codex | R1 | 🎨 Tema claro do Painel e do Radar: provar com `auditoria_temas.js` o que já foi feito em 18/10 e corrigir o que restar (contrato colado pelo Caio em 16/11) | [auditoria](ideias/tema-claro-painel-radar-2026-10-17.md) |
| Antigravity | R0 | 🪟 Acabamento "vidro lapidado" (`--specular` por tema + curvas `--ease-*`) | [GUIA_UI_UX §2.4/§2.5](GUIA_UI_UX.md) · [backlog](quadro/backlog.md#vidro-lapidado) |
| Codex | R0 | 💡 Dica "🧭 Boas-vindas em ❓ Ajuda" no `mare-dicas-dev.js` (bump do `?v=` em 4 páginas); contrato a escrever pelo Claude | [onboarding-mare](ideias/onboarding-mare.md) |

## Escalado

| Quem achou | O que | Detalhe | Data |
|---|---|---|---|
| Codex | 🏖️ UI/UX Férias: contraste, acesso ao cadastro, foco, títulos cortados e toque; correções no módulo compartilhado são do Claude | [auditoria](FERIAS_UI_AUDITORIA_2026-11-13.md) | 13/11/2026 |
| Claude | `okr-dev.html` sem `prefers-reduced-motion`: o `okrPulse` do "digitando…" do Agente roda com movimento reduzido | [escalados](quadro/escalados.md#radar-reduced-motion) | 09/11/2026 |
| Claude | `test_apresentacao_live.js` falha também na `main` ("fora da sincronização, o slide do apresentador NÃO puxa a pessoa") | [escalados](quadro/escalados.md#apresentacao-live) | 09/11/2026 |
| Claude | `test_dicas.js` desatualizado: espera 33–35 dicas no Painel, hoje são 38 (falha também na `main`); e tem caminho do Playwright/porta fixos do Linux | `docs/arezzo/testes/test_dicas.js` L133 | 13/11/2026 |
| Antigravity | `database.rules.json`: `humor`/`humor_comp` da Travessia aceitam nota decimal (ex.: `1.5`); exigir inteiro | [escalados](quadro/escalados.md#travessia-humor-inteiro) | 11/11/2026 |
| Antigravity | Segurança das regras (`/auditoriaseguranca` do Painel): C1/C2 feitos; **faltam C3, C4, D7/D8**. Cuidado com externos e `painel_viewers` | [escalados](quadro/escalados.md#seguranca-regras-c3-c4) | 11/11/2026 |

## Pendente de deploy

Só o Caio roda, depois do resync do clone. O agente que deixa um deploy para trás acrescenta a linha com o comando completo; quando o Caio confirma, a linha sai daqui e a confirmação vai para o histórico.

| Quem adicionou | O que mudou | Comando | Data |
|---|---|---|---|
| Claude | 🔧 `firebase-functions` 5 → 7 (PR desta data): **1º uma função só** e olhar os logs; se ok, as outras 40 | resync + `firebase deploy --project hering-onboarding --only functions:githubStatus` → depois `--only functions:agenteAgil,functions:agenteAgilAnaliseDados,functions:agenteAgilAnalisePO,functions:agenteAgilDueOverdueScan,functions:agenteAgilIntake,functions:agenteAgilMencao,functions:agenteAgilMencaoDados,functions:agenteAgilPainelChat,functions:agenteAgilPainelChatDev,functions:agenteAgilResumoMeuDia,functions:backupCompletoApi,functions:backupCompletoSemanal,functions:backupGlobalDiario,functions:backupVigia,functions:cardsEspelhar,functions:cardsEspelhoVarredura,functions:cardsGuardiao,functions:contarComentarios,functions:firebaseStatus,functions:ganttAvisoMudanca,functions:ganttAvisoMudancaDev,functions:guardiaoStatus,functions:intakeSubmit,functions:metasLembretes,functions:oceanoResumo,functions:okrAgenteChat,functions:okrDailyScan,functions:okrWeeklySnapshot,functions:sendPushOnMural,functions:sendPushOnNotification,functions:spotifyDisconnect,functions:spotifyOauthCallback,functions:spotifyPlayback,functions:spotifyRadioOwnerCallback,functions:spotifyRadioSearch,functions:spotifyRadioSuggest,functions:spotifySyncNow,functions:timersVigia,functions:vtexStatus,functions:weeklyBackup` | 16/11/2026 |

## Backlog

| Ideia | Dono | Detalhe |
|---|---|---|
| 🔎 Histórico do período/hora do card: já existe — conferir se algum caminho não registra | Claude | [escopo](quadro/escalados.md#periodo-historico) |
| 🪟 Acabamento "vidro lapidado"; depois, diagrama `.arq` + rodapé do Oceano (com o O4) | Antigravity · Claude | [backlog](quadro/backlog.md#vidro-lapidado) |
| 🏝️ Ilha Dinâmica: 1º teste real no Maré dev (aguarda o Caio); depois Oceano | Claude | [backlog](quadro/backlog.md#ilha-dinamica) |
| 🧭 Plano da consultoria (guardado em 10/11); próximo: T4 da Travessia | Claude | [backlog](quadro/backlog.md#consultoria) |
| 👕 Camiseta Brasil da Black Friday (depende da arte; BF = 27/11) | Claude | [backlog](quadro/backlog.md#camiseta-black-friday) |
| 🔬 Dossiê de concorrência do Antigravity (34 ideias em 4 levas) | Caio escolhe | [backlog](quadro/backlog.md#dossie-concorrencia) |
| 🎨 Tema claro do Painel e do Radar (sem PR que prove que foi feito) | Claude ou Antigravity | [backlog](quadro/backlog.md#tema-claro-painel-radar) |
| 🧪 Ferramentas de teste visual (`CENARIO=`, Chrome do `~/hering-tools`, contact sheet) | Claude | [backlog](quadro/backlog.md#ferramentas-teste-visual) |
| 🎬 Gerador de vídeo/GIF de release (sem Remotion) | Caio decide | [backlog](quadro/backlog.md#video-release) |
| 🔧 Atualizar `firebase-functions` (^5 → atual), com calma e testes | Claude | [backlog](quadro/backlog.md#firebase-functions-v6) |
