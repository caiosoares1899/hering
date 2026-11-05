---
paths:
  - "functions/**"
  - "database.rules.json"
---

# Regras de `functions/` e do banco (carregam ao tocar nesses arquivos)

As 3 linhas críticas (resync antes de deploy; `--only functions:<nome>`; deploy é do Caio) também ficam no `CLAUDE.md`, porque valem quando você só entrega um comando. Aqui está o resto.

## Deploy roda na máquina do Caio — sempre resync antes

`functions/` (Cloud Functions, `firebase functions:secrets:set`, `firebase deploy --only functions:...`) é rodado pelo Caio, com o `firebase-tools` dele — o sandbox da sessão não tem credencial. **Toda vez que um PR que toca `functions/` for mergeado e você for entregar um comando `firebase deploy`/`secrets:set`, entregue antes o resync** (o clone dele não se atualiza sozinho):
```bash
cd /d "C:\Users\caio.soares\.gemini\antigravity\scratch\hering"
git fetch origin <branch-name>
git reset --hard origin/<branch-name>
```
- **Windows (fixo, confirmado em 16/10/2026):** `C:\Users\caio.soares\.gemini\antigravity\scratch\hering` — o mesmo diretório em que o Antigravity trabalha. Em `cmd` use `cd /d "…"` (a barra `/d` troca de unidade); em PowerShell, `cd "…"` basta. Escreva o comando já com esse caminho, nunca um genérico.
- **MacBook (31/10/2026):** clone em `~/hering`, com Claude Code próprio (sessão que não enxerga o que outra fez: antes de qualquer pedido, `cd ~/hering && git pull`). O mini painel (`mac/`) roda dele: `cd ~/hering/mac && git pull && xcodegen generate` e ⌘+R no Xcode. Os deploys de `functions/` continuam sendo feitos no Windows.
- **Por quê:** o `firebase deploy` descobre os exports de `functions/index.js` **no disco local**. Se o export novo não está lá, falha com `No function matches the filter: default:<nome>` — sem cara de problema de git. O mesmo vale antes de `npm install`/testar algo em `functions/` depois de um push: assuma o clone velho e diga isso logo de cara.
- Sempre `firebase deploy --only functions:<nome>`; nunca `--only functions` puro (mexe em todas) sem querer isso de propósito. Cada `exports.xxx = require(...)` de `functions/index.js` traz o comando de deploy num comentário acima.
- Tag e log valem também para releases de função (ver `agente-agil-v1a` no `CHANGELOG.md`), que versionam à parte do `version.json`.
- Acrescente a linha em "Pendente de deploy" do `docs/COORDENACAO_AGENTES.md`; não rode `firebase deploy`.

## Funções, push e backup

- **Push:** o app grava em `kanban/usuarios/{uid}/notificacoes/{id}`; a função só decide se vira push, comparando `notif.type` com a allow-list `PUSH_TYPES` (`functions/index.js`). **Tipo novo que deve gerar push = entrada em `PUSH_TYPES` + redeploy** — só front-end não basta (e 1 entrada em `MareNotif.TIPOS`, em `mare-notif(-dev).js`). O Mural do Radar usa outra função, `sendPushOnMural` (um evento de `kanban/notif_feed`). A função respeita o Não Perturbe (`kanban/usuarios/{uid}/notif_prefs/dnd`) e poda tokens FCM inválidos; envia FCM **só `data`** (sem `notification`) de propósito — os dois juntos duplicam a notificação no Safari/iOS.
- **Central de Notificações:** interruptores sino/push por tipo em `kanban/notif_config/{tipo}` (só PO/ADM gravam); o push os respeita via `functions/common/notifConfig.js` (deploy de `sendPushOnNotification`/`sendPushOnMural` + `firebase deploy --only database`).
- **Backup:** nó novo de primeiro nível no banco = acrescentar em `NOS_GLOBAIS` de `functions/backup/completo.js`, ou ele não tem backup. Restauração: `backup/restaurar.js` ou a tela 🛟 em Config → Backup (`backupCompletoApi`); `backupVigia` avisa os ADMs se um backup falhar.
- **Conhecimento do Agente Ágil:** `functions/agente-agil-orquestrador/conhecimento/*.json` são gerados (`cd functions && npm run conhecimento`) da `HELP_CONTENT` (kanban.html), Ajuda do Radar, FAQ do Oceano e CHANGELOG de produção; `conhecimento.test.js` falha se velhos. Mudou a Ajuda ou promoveu pra prod → regenerar, commitar e republicar `agenteAgilMencao`, `agenteAgilMencaoDados`, `agenteAgilIntake`, `agenteAgilAnalisePO`, `okrAgenteChat` (função não lê o repo em runtime).
- **Metas:** `metasLembretes` (`functions/metas/lembretes.js`, a cada 15 min, Brasília); deploy `functions:metasLembretes,functions:sendPushOnNotification` + `--only database`; tipo `meta_lembrete` em `PUSH_TYPES` e `MareNotif.TIPOS`.
- Lista das funções no ar e linhas: `CODE_MAP.md` e `docs/MAPA_DO_REPOSITORIO.md` (`node scripts/mapa.js` ao mudar export).

## Regras do banco

- `database.rules.json` é **espelho manual** do que está no Console; edição direta no Console deixa o arquivo velho — compare de vez em quando. Deploy: `firebase deploy --only database` (só o Caio).
- Quase tudo exige `auth.token.email` terminando em `@ciahering.com.br`, com checagem de squad por `kanban/usuarios/{uid}/squads/{squadId}`. Vários nós têm irmão `_dev` (`dados_diarios_dev`, `campanhas_log_dev`, …) para as páginas `-dev`.
- Nó novo ou regra nova = **regras primeiro** no deploy (sem elas o navegador recebe `PERMISSION_DENIED`) e linha em "Pendente de deploy".
- Modo "só Hering": `functions/common/mareModo.js` e regras sem a alternativa Arezzo; testes de torres rodam com `MARE_MODO_TESTE=varias-torres`. Leia `docs/arezzo/MARE_SO_HERING.md` antes de mexer em login, torres ou domínios.

## Fronteiras de confiança (método em `docs/SEGURANCA_FRONTEIRAS.md`)

- **check-then-act = `.transaction()`**: `get()` + `set()` separados em contador, limite, idempotência ou posição de card é corrida (já deu bug em `intake/submit.js` e `agente-agil/http.js`).
- **A função roda como admin e ignora as regras do banco**: todo handler (`onRequest`, gatilho, ferramenta do Agente Ágil/`okrAgenteChat`) reconfere **no código** quem pediu e o squad/recurso — o prompt do LLM não é fronteira, e texto de card/comentário/Intake é entrada não confiável.
- **Guard de tela sem regra no banco é só conveniência**: se a mudança protege algo importante (papel, acesso de externo, squad), a regra correspondente entra no `database.rules.json` com teste no `functions/rules/rulesSim.js`.
- **`onRequest` novo declara a autenticação** num comentário `// AUTH: …` (idToken `@ciahering`, chave compartilhada em tempo constante, HMAC, ou público com limite) — o `scripts/checar.js` reprova sem ele.

