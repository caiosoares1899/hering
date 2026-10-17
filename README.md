# Hering — Ferramentas internas

> 📚 **Procurando algo? Veja a [Biblioteca do repositório](docs/BIBLIOTECA.md)** — onde está cada página, módulo, imagem, doc e pasta — e o [🗺️ Mapa do repositório](docs/MAPA_DO_REPOSITORIO.md) — como as peças se encaixam (diagramas).

Repositório dos sites e ferramentas internas da Hering, hospedados via GitHub Pages em
https://caiosoares1899.github.io/hering/

## Maré Digital (kanban + painel)

Sistema de gestão de squads em formato kanban, com painel administrativo e notificações
push.

### Arquivos principais
- `kanban.html` — board de produção
- `kanban-dev.html` — board de teste/desenvolvimento (⚠️ NUNCA aponta pra dados de produção
  sem revisar antes — serve pra testar mudanças com segurança)
- `painel.html` — painel administrativo (gestão de pessoas, comunicados, push manual)
- `painel-dev.html` — versão de teste do painel
- `firebase-messaging-sw.js` — Service Worker (precisa ficar na RAIZ do domínio; cuida de
  cache offline E de mostrar notificações push quando a aba está fechada/em background)

### Backend (Cloud Functions)
Pasta `functions/` — Cloud Function `sendPushOnNotification`, que escuta escritas em
`kanban/usuarios/{uid}/notificacoes/{notifId}` no Realtime Database e dispara push via
Firebase Cloud Messaging (FCM) pros tokens salvos daquele usuário.

Só dispara push pra notificações cujo `type` esteja na lista `PUSH_TYPES` (dentro de
`functions/index.js`) — hoje inclui `assigned`, `mention`, `unblocked`, `risk`,
`recorrente`, `painel_broadcast`. Pra um novo tipo de notificação também virar push,
precisa adicionar o tipo nessa lista e fazer deploy de novo.

### Integração com Spotify
Pasta `functions/spotify/` — "ouvindo agora" (presença ao vivo, opt-in por pessoa) +
Rádio do Maré (playlist colaborativa por squad + geral). Ver
[`functions/spotify/README.md`](functions/spotify/README.md) pra arquitetura completa,
deploy de cada function e gotchas já encontrados em produção (allowlist do Spotify
Developer Mode, migração de endpoint `/tracks` → `/items`).

### Rodando a function localmente
```bash
cd functions
npm install
```

### Deploy da function
```bash
cd functions
firebase deploy --only functions
```
(precisa ter o Firebase CLI instalado e estar logado — `firebase login`)

### Regras do Realtime Database
`database.rules.json`, na raiz do repo — é um **espelho** do que está configurado no
Firebase Console (Realtime Database → Regras). Se alguém mudar uma regra direto no
console, esse arquivo fica desatualizado até alguém copiar a mudança pra cá manualmente.
Vale conferir de vez em quando se os dois batem.

Pra aplicar uma mudança feita aqui de volta pro Firebase:
```bash
firebase deploy --only database
```

### Backup semanal automático
Pasta `functions/backup/` — Cloud Function `weeklyBackup`, agendada (Cloud
Scheduler, todo domingo 04:00 horário de Brasília) pra salvar um snapshot de
cada squad de produção em `backups/{squadId}/{data}.json` no Cloud Storage.
Roda sozinho, sem depender de ninguém abrir o board — diferente do backup
manual/e-mail já existente em `kanban-dev.html`, que só dispara se alguém
clicar ou deixar a aba aberta. Formato do JSON é o mesmo de
`exportBackupJSON()`, então dá pra restaurar direto pela UI "🧯 Restaurar
backup" do board.

### Backup completo do banco (2026-10-13)
O `weeklyBackup` acima só guarda o **quadro** de cada squad. O backup **completo** (`functions/backup/completo.js`)
guarda o resto: comentários dos cards, `config` do squad (Raias, Ficha Técnica, padrões, calendários…), intake, subtimes,
kudos, snapshots do CFD, e — fora dos squads — o Radar (`okr`), Metas, Escala, `usuarios` (papéis, squads, torre, preferências),
`squads_meta`, Comunicados, `painel`, `config`… Duas funções agendadas (horário de Brasília):
- `backupCompletoSemanal` — domingo 04:30: tudo → `backups-completos/semanal/{data}/` (retenção 90 dias);
- `backupGlobalDiario` — todo dia 03:30: só os nós globais pequenos e insubstituíveis → `backups-completos/diario/{data}/` (14 dias).

Dentro de cada pasta: `global/{nó}.json`, `squads/{id}.json` e `manifesto.json` (o que entrou, tamanhos, vazios, erros e o que
**nunca** entra: segredos do Spotify, tokens de push, notificações pessoais, presença/locks/debug, nós `_dev`). Esse prefixo
**não é legível pelo cliente** (`storage.rules`). Se algum item falhar a execução termina com erro (aparece no monitoramento)
mas o que deu certo já foi salvo.

Deploy (na sua máquina, depois de resincronizar o clone — ver `CLAUDE.md`) + retenção (uma vez):
```bash
cd functions && firebase deploy --only functions:backupCompletoSemanal,functions:backupGlobalDiario
gsutil lifecycle set storage-lifecycle.json gs://hering-onboarding.firebasestorage.app
```
**Aviso quando falhar** — `backupVigia` (todo dia 09:00): confere o **resultado** no Storage (completo diário de hoje, completo semanal ≤ 8 dias, quadro de cada
squad ≤ 8 dias) e manda uma notificação 🛟 (sino + push) pros **ADMs**, no máximo 1 por dia. **Restaurar pela tela do Maré** — ⚙ Config → Backup → 🛟 Backup completo (nuvem)
(ADM/PO/Organizador): lista, compara e traz de volta **só o que sumiu** (comentários dos cards, configurações, intake, subtimes, estrelas; nunca sobrescreve) via
`backupCompletoApi`. Deploy: `firebase deploy --only functions:backupVigia,functions:backupCompletoApi,functions:backupCompletoSemanal,functions:sendPushOnNotification`.

**Restaurar** (script local, `functions/backup/restaurar.js`; por padrão só simula): `node backup/restaurar.js --listar`;
`node backup/restaurar.js --modo diario --data ultimo --no okr` (simula) e o mesmo com `--aplicar` (grava). Também restaura
um squad (`--squad dados`). Sempre **mescla** (nunca apaga o que não está no backup) e salva o estado atual em
`backups-completos/pre-restauracao/…` antes de gravar, pra dar pra desfazer. Precisa de credencial (`gcloud auth
application-default login`) e das variáveis `FIREBASE_DATABASE_URL` e `FIREBASE_STORAGE_BUCKET`.

### Cloud Storage
`storage.rules`, na raiz do repo — mesma lógica do `database.rules.json` acima
(espelho do que está configurado no Firebase Console → Storage → Rules). Guarda os
relatórios que o Agente Ágil hospeda (`relatorios/**`, ver
`functions/agente-agil/`), o upload de PDF da Central de Dados do painel
(`dados_diarios/**`) e o backup semanal automático (`backups/**`, ver acima).

Pra aplicar uma mudança feita aqui de volta pro Firebase:
```bash
firebase deploy --only storage
```

**Retenção** (`storage-lifecycle.json`, também na raiz): apaga automaticamente
qualquer coisa em `relatorios/**` com mais de 2 dias, e em `backups/**` com
mais de 60 dias (~8-9 backups semanais mantidos por squad). Isso é
propriedade do bucket do Cloud Storage, não da camada Firebase — não existe
`firebase deploy` pra isso, precisa do `gsutil` (ou `gcloud storage`), rodado
**uma vez** (ou de novo só se o arquivo mudar — inclusive agora, depois de
adicionar a regra do `backups/**`):
```bash
gsutil lifecycle set storage-lifecycle.json gs://hering-onboarding.firebasestorage.app
```

## Outras ferramentas no repo
`bolao.html`, `capacitacao.html`, `onboarding.html`, `apresentacao.html`, `maredigital.html`,
`resumo.slide.html`, `ai-slide.html`, `ai-txt.html`, `controle.html` — outras ferramentas
internas hospedadas no mesmo GitHub Pages, sem relação direta com o Maré Digital.