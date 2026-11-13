# Quadro: o estado do dia

> **O único arquivo de coordenação que os agentes editam no dia a dia.** As regras ficam em [`COORDENACAO_AGENTES.md`](COORDENACAO_AGENTES.md) e o que já foi feito, em [`historico/`](historico/).
> **Formato fixo** (o `mare-cli.js brief` lê estas tabelas): uma linha por item, até ~200 caracteres; o detalhe vai num link (`quadro/…`, PR ou doc). Arquivos sempre entre crases, separados por vírgula.
> Ao **começar**: linha em *Em andamento* com os arquivos que vai tocar (arquivo reservado = ninguém mais toca até o merge). Ao **terminar**: tire a linha. Item resolvido sai da tabela; a confirmação vai para o histórico.

## Em andamento

| Agente | Branch | Arquivos | Desde |
|---|---|---|---|


## Fila

Contratos prontos, na ordem. O Caio manda uma linha ("pegue o próximo da sua fila"); o agente pega o 1º, move para *Em andamento* e segue o contrato (formato em [Contrato de tarefa](COORDENACAO_AGENTES.md#contrato-de-tarefa-v2)). O Antigravity continua sendo acionado por mensagem do Caio.

| Agente | Risco | Tarefa | Contrato |
|---|---|---|---|
| Antigravity | R0 | 🪟 Acabamento "vidro lapidado" (`--specular` por tema + curvas `--ease-*`) | [GUIA_UI_UX §2.4/§2.5](GUIA_UI_UX.md) · [backlog](quadro/backlog.md#vidro-lapidado) |
| Codex | R0 | 💡 Dica "🧭 Boas-vindas em ❓ Ajuda" no `mare-dicas-dev.js` (bump do `?v=` em 4 páginas); contrato a escrever pelo Claude | [onboarding-mare](ideias/onboarding-mare.md) |

## Escalado

| Quem achou | O que | Detalhe | Data |
|---|---|---|---|
| Codex | Pedidos do Caio: (1) **pedir atualização** por calendário — a fazer; (2) calendários no Radar — ✅ no dev (Claude, PR do Radar Gantt) | [escopo](quadro/escalados.md#gantt-pedidos-radar) | 13/11/2026 |
| Claude | `okr-dev.html` sem `prefers-reduced-motion`: o `okrPulse` do "digitando…" do Agente roda com movimento reduzido | [escalados](quadro/escalados.md#radar-reduced-motion) | 09/11/2026 |
| Claude | `test_apresentacao_live.js` falha também na `main` ("fora da sincronização, o slide do apresentador NÃO puxa a pessoa") | [escalados](quadro/escalados.md#apresentacao-live) | 09/11/2026 |
| Antigravity | `database.rules.json`: `humor`/`humor_comp` da Travessia aceitam nota decimal (ex.: `1.5`); exigir inteiro | [escalados](quadro/escalados.md#travessia-humor-inteiro) | 11/11/2026 |
| Antigravity | Segurança das regras (`/auditoriaseguranca` do Painel): C1/C2 feitos; **faltam C3, C4, D7/D8**. Cuidado com externos e `painel_viewers` | [escalados](quadro/escalados.md#seguranca-regras-c3-c4) | 11/11/2026 |

## Pendente de deploy

Só o Caio roda, depois do resync do clone. O agente que deixa um deploy para trás acrescenta a linha com o comando completo; quando o Caio confirma, a linha sai daqui e a confirmação vai para o histórico.

| Quem adicionou | O que mudou | Comando | Data |
|---|---|---|---|
| Claude | 🔔 Avisos de mudança no Gantt: nó `gantt_inscritos(_dev)` + funções de aviso + `gantt_cal` no push (+ backup diário) | resync + `firebase deploy --project hering-onboarding --only database` **e depois** `--only functions:ganttAvisoMudanca,functions:ganttAvisoMudancaDev,functions:sendPushOnNotification,functions:backupCompletoSemanal,functions:backupGlobalDiario` | 13/11/2026 |
| Claude | Conhecimento do Agente Ágil regenerado na promoção do Gantt de 13/11 (Digital · dia a dia, Radar Gantt) | resync + `firebase deploy --project hering-onboarding --only functions:agenteAgilMencao,functions:agenteAgilMencaoDados,functions:agenteAgilIntake,functions:agenteAgilAnalisePO,functions:okrAgenteChat` | 13/11/2026 |

## Backlog

| Ideia | Dono | Detalhe |
|---|---|---|
| 🏖️ Calendário geral de férias + **modo férias** (alerta ao marcar quem está fora, cadastro obrigatório ao ativar, pausar/passar cards e Objetivos item a item) | Claude | [escopo](quadro/escalados.md#modo-ferias) |
| 📱 Gantt no celular: nenhum texto cabe, só barrinhas (Maré e Radar) | Claude | [escopo](quadro/escalados.md#gantt-celular) |
| ⭐ Gantt: aba favorita ao abrir + 🔔 inscrição para avisos quando um calendário muda | Claude | [escopo](quadro/escalados.md#gantt-favorito-avisos) |
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
