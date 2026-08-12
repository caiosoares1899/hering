# Hering — Ferramentas internas

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