# Changelog

Registro de mudanças do Maré Digital e demais ferramentas deste repositório,
organizado por página e versão (ver `version.json`). Cada entrada linka o PR
correspondente — `git diff <tag-antiga> <tag-nova>` mostra o diff exato do
que foi ao ar entre duas versões.

**Convenção de tags:** `kanban-vX.Y.Z` (produção), `kanban_dev-vX.Y.Z-dev`
(ambiente de teste), `painel-vX.Y`, `painel_dev-vX.Y-dev` — sempre no commit
de merge que efetivamente publicou aquela versão (o merge pra `main`, já
que o deploy do GitHub Pages roda automaticamente a partir daí). Ver seção
"Processo de release" no `CLAUDE.md` para o fluxo completo.

Este arquivo passou a ser mantido em 2026-07-24; histórico anterior a essa
data existe no `git log` mas não foi documentado retroativamente aqui (ver
`git log -- kanban.html` / `git log -- painel.html` etc. pro histórico
completo, incluindo commits antigos sem PR/descrição detalhada).

## kanban.html (produção)

### v8.30.180 — 2026-07-28 · PR #39 · tag `kanban-v8.30.180`
Promove pra prod o **carregamento em duas etapas dos cards** (delta-sync),
validado no dev desde a v8.30.204-dev (PRs #34, #35, #38): em vez de
`onChildAdded` direto em `/cards` (baixa o board inteiro toda vez que é
aberto), lê primeiro os índices pequenos `cards_index` +
`cards_updated_at`, compara com um cache local por squad, e busca
individualmente só os cards novos/mudados — cai automaticamente no
carregamento completo de sempre quando não há cache, mudou demais desde
a última visita, ou o board ainda não tem `cards_updated_at` migrado
(nunca perde nem atrasa a exibição de um card). Validado ao vivo numa
squad real (`ecomm`) antes da promoção: edição de card caiu de ~46,5KB
pra ~4,3KB no reload, exclusão não reaparece, sincronização ao vivo
entre abas funcionando.

### v8.30.179 — 2026-07-27 · PR #33 · tag `kanban-v8.30.179`
Promove pra prod tudo que tinha sido validado no dev desde a v8.30.178:
- Nova notificação **`notifMoved`**: card mudando pra qualquer coluna que
  não seja "Concluído" (que já tinha `notifDone` dedicada) agora notifica
  dono/participantes também — antes só coluna de conclusão disparava algo.
  Só sino, sem push, mesmo padrão de `done`/`checklist`.
- **Editar um comentário existente agora dispara `@`menção** — antes só
  criar um comentário novo chamava `parseMentions()`.

(A causa raiz de fundo — regra do Realtime Database bloqueando notificação
entre membros comuns, e depois bloqueando convidados com email fora do
domínio — foi corrigida em `database.rules.json`, não em `kanban.html`; ver
seção própria mais abaixo.)

### v8.30.178 — 2026-07-27 · PR #28 · tag `kanban-v8.30.178`
Promove pra prod tudo que tinha sido validado no dev desde a v8.30.177:
- **Notificação por @menção nunca disparava quando o card era salvo só
  pelo autosave** (o caminho mais comum — quase ninguém clica no botão
  "Salvar" manual): `scheduleAutoSave()` replicava os outros 5 gatilhos de
  notificação (atribuído/desbloqueado/concluído/risco/checklist), mas não
  chamava `parseMentions()`. Corrigido — junto com um bug adjacente onde o
  campo "motivo do impedimento" também não era capturado pelo autosave.
- **Notificação sumia em silêncio quando o dono/participante/mencionado
  não estava mais inscrito no squad atual** (saiu, foi removido, nunca
  "participou" formalmente) — `getUidByInit()` retornava `null` sem
  nenhum aviso. Agora cai pra buscar entre todos os usuários cadastrados
  antes de desistir, e sempre loga um aviso quando realmente não acha
  ninguém.
- Medidor de bytes por path do Realtime Database (`debugBytesRemote()`
  no console): agora também rastreia leituras pontuais (`fbGet()`), não
  só listeners em tempo real, e ganha um rollup diário de 90 dias
  (`debugBytesHistory()`/`debugBytesExportCSV()`) além do log horário de
  7 dias que já existia.

### v8.30.177 — 2026-07-25 · PR #22 · tag `kanban-v8.30.177`
Promove pra prod tudo que tinha sido validado no dev desde a v8.30.176:
- Sistema híbrido humano+agente de IA restaurado (perdido acidentalmente
  num commit anterior sem PR): visão 👤/🤝/🤖, campo Executor + status do
  agente no card, identidades de agente integradas em menções/seletores/
  avatares, ciclo de validar/devolver trabalho do agente.
- Agrupamento manual de campanhas do painel passa a valer no board de
  cada squad (`grupoId`), sem alterar o nome que cada squad enxerga.
- Agente Ágil Sprint 2: resolve "referencia" de negócio (recorrência +
  data) em vez de exigir `cardId` direto — mais o fix do bug de data que
  fazia `recorrenteData` e `createdAt` divergirem por 1 dia perto da
  meia-noite em fusos como o do Brasil.
- Impedimento vazando em squads no modo "tag" (ex.: Outlet Comercial):
  mover card pra uma coluna renomeada (ex.: "Impedimentos" → "Finalizado")
  não marca mais como impedido por baixo dos panos.
- Duplicar card abre modal deixando escolher quais campos entram na cópia
  (Descrição, Checklist, Tags, Responsável, Participantes, Prazo,
  Prioridade, Riscos, Anexos/Links).
- ADM, PO e Organizador podem excluir comentários de qualquer usuário
  (antes só ADM, além do próprio autor).
- "Texto" adicionado às sugestões de Formato da Ficha de Criativo.

### v8.30.176 — 2026-07-24 · PR #13 · tag `kanban-v8.30.176`
Promove pra prod tudo que tinha sido validado no dev desde a v8.30.174:
- Título de card com uma palavra só muito longa (sem espaço) agora quebra
  linha em vez de estourar a largura do card.
- Corrige board abrindo vazio às vezes logo depois do login (só voltava com
  F5): `fbLoadAll()` esperava o SDK do Firebase ficar pronto, não o login em
  si terminar.
- Dropdown de `@`menção/`@card:` na descrição principal passa a abrir perto
  do cursor, em vez de sempre no rodapé do campo inteiro.

### v8.30.175 — 2026-07-24 · PR #10 · tag `kanban-v8.30.175`
Promove pra prod a primeira leva de correções validadas no dev:
- Notificações: dedup determinístico de `@`menção (parava de renotificar a
  mesma menção antiga em todo save subsequente do card); clique na
  notificação navega entre squads e reabre o card certo; menção em
  descrição adicional passa a notificar e ganha o dropdown de
  `@`pessoa/`@card:`.
- Corrige link de card errado ao clicar em `[[CARD:...]]` dentro de
  comentário/descrição.
- Corrige iniciais duplicadas pra mesma pessoa (bug de `c.participantes`
  vs `c.participants` na migração de iniciais).
- Corrige participantes "sumindo" de cards (parsing frágil de DOM
  substituído por array em memória).
- Corrige perda silenciosa de autosave (`fbSaveCard()` sem tratamento de
  erro em `scheduleAutoSave`/`saveExtraDesc`/`toggleCardOKR`) com retry +
  aviso visível.
- Lembrete de acesso ao colar link do ecossistema Google (Docs/Sheets/
  Slides/Drive).

### v8.30.174 e anteriores
Base antes desta leva de trabalho. Ver `git log -- kanban.html` pro
histórico completo (sem tags/changelog retroativo).

## kanban-dev.html (ambiente de teste)

### v8.30.191-dev — 2026-07-24 · PR #16 · tag `kanban_dev-v8.30.191-dev`
Restaura o sistema híbrido humano+agente de IA que tinha sido apagado por
acidente no commit `ea180cc` (22/07, edição direta pelo GitHub sem PR) — a
correção da lista de squads do dev arrastou junto ~2000 linhas de uma
feature que só existia lá. `functions/agente-agil/board.js` continua com
`SQUAD_ID='ecomm'` fixo, ou seja, a Cloud Function do Agente Ágil já
escrevia cards nesse squad enquanto o board tinha perdido a capacidade de
mostrar/gerenciar esses cards como "de agente". Restaurado e integrado ao
estado atual do arquivo:
- Botão de 3 visões no header (👤 Humanos / 🤝 Híbrido / 🤖 IA), só
  aparece em squads com agentes cadastrados.
- Campo "Executor" (Humano/Agente/Híbrido) + status do agente no modal do
  card, chip visual no card, filtro dedicado.
- Identidades de agente (`agentes[]`/`allIdentities()`) integradas em
  menções, dropdown de `@`, seletor de responsável/participante, avatares
  de card e comentário.
- Ciclo humano-agente: validar/devolver trabalho do agente (com
  comentário de sistema) + painel de simulação client-side pra ensaiar o
  fluxo antes de plugar agentes reais.
- Não restaurado (por escolha): dados de seed/demo fictícios — só a
  mecânica.

### v8.30.190-dev — 2026-07-24 · PR #12 · tag `kanban_dev-v8.30.190-dev`
Dropdown de `@`menção/`@card:` na descrição principal passa a medir a
posição real do cursor e abrir ali, em vez de sempre no rodapé do campo
(bug visível em campos longos, como a descrição principal de 12 linhas).

### v8.30.189-dev — 2026-07-24 · PR #11 · tag `kanban_dev-v8.30.189-dev`
- Título de card com uma palavra só muito longa (sem espaço) agora quebra
  linha.
- Corrige board abrindo vazio às vezes logo após o login: `fbLoadAll()`
  agora só roda depois de confirmar usuário autenticado de verdade, não só
  o SDK do Firebase pronto.

### v8.30.188-dev — 2026-07-24 · PR #9 · tag `kanban_dev-v8.30.188-dev`
Ativa o dropdown de `@`pessoa/`@card:` no campo de descrição adicional —
nunca tinha sido inicializado ali (`initMentionDropdown()` só era chamado
pra descrição principal, PO e comentário).

### v8.30.187-dev — 2026-07-24 · PR #8 · tag `kanban_dev-v8.30.187-dev`
- Menção em descrição adicional (`descsExtra`) passa a disparar
  notificação — nenhum ponto do código chamava `parseMentions()` pra esse
  texto antes.
- Corrige perda silenciosa de autosave: `fbSaveCard()` sem `.catch()` em
  `scheduleAutoSave()`/`saveExtraDesc()`/`toggleCardOKR()` deixava falha de
  escrita (rede instável, sessão expirada) completamente muda — a tela
  mostrava "salvo" mas o Firebase não recebia, e a sincronização seguinte
  sobrescrevia tudo sem aviso. Adicionado `_saveCardWithRetry()` (tenta de
  novo 1x, avisa com toast se falhar as duas vezes).

### v8.30.186-dev — 2026-07-24 · PR #7 · tag `kanban_dev-v8.30.186-dev`
- Notificações: dedup de `@`menção (parava de renotificar a mesma menção
  antiga em todo save subsequente); clique na notificação navega entre
  squads e reabre o card certo (com retry se o board ainda não sincronizou).
- Corrige link de card errado (`[[CARD:...]]` agora passa por
  `openCardMention()`, que respeita alterações não salvas).
- Corrige iniciais duplicadas pra mesma pessoa (typo `c.participantes` →
  `c.participants` na migração).
- Corrige participantes sumindo de cards.
- Lembrete de acesso ao colar link do Google (Docs/Sheets/Slides/Drive).

## Service Worker — `firebase-messaging-sw.js` (raiz do domínio, sem versão própria em `version.json`)

### CACHE v2 — 2026-07-24 · PR #14
Corrige o SW servindo HTML/`version.json` desatualizados: a estratégia
stale-while-revalidate cacheava as páginas HTML e o `version.json`, o que
mascarava o próprio mecanismo de auto-update do app (página e
`version.json` podiam vir do mesmo cache velho, sem detectar divergência
nenhuma). HTML (navegação) e `version.json` agora vão network-first; o
resto (imagens, libs de terceiros) continua como antes. Bump de `CACHE`
(`v1` → `v2`) pra purgar cache antigo salvo com a estratégia anterior.

## Cloud Function — `sendPushOnNotification` (`functions/index.js`, sem versão própria em `version.json`)

### 2026-07-27 · PR #36
Corrige o link do push levando pra fora do site: a URL do deep-link do
card era montada como `/kanban.html?...` (absoluta a partir da raiz do
domínio), mas o site fica em `caiosoares1899.github.io/hering/`, não na
raiz — todo clique num push caía em 404
(`caiosoares1899.github.io/kanban.html`, sem `/hering/`). Tirada a barra
inicial (URL relativa) tanto na Cloud Function quanto no fallback do
`firebase-messaging-sw.js`. **Requer `firebase deploy --only functions`
manual** (feito no mesmo dia) — pushes entregues antes do redeploy mantêm
o link antigo quebrado.

## painel.html / painel-dev.html

Sem mudanças nesta leva de trabalho — seguem em v2.91 / v2.90-dev. Ver
`git log -- painel.html painel-dev.html` pro histórico completo.

## Agente Ágil (`functions/agente-agil/`)

### v2 — 2026-07-25 · PR #23 · tag `agente-agil-v2`
Sprint 3 — "vocabulário de ações": 4 novos tipos de output no envelope,
além de comentário/link/relatório — `checklist_item` (marca ou cria item +
grupo, grupo padrão "🤖 Processo automatizado" quando não especificado),
`agent_status` (status visível do agente no card, promove `executorType`
human→agent automaticamente), `mover_coluna` (move o card, decide coluna
de "fim" via `flowConfig.doneCols`) e `editar_campos` (descrição/
prioridade/tags — tags sempre aditivo, nunca remove). Toda ação nova
replica o que o cliente já faz numa edição manual (`recordMove`/
`recordHistory`/`createNotif`/`notifDone`/`notifChecklistDone`) — o agente
nunca muda um card silenciosamente: sempre grava histórico e, quando
aplicável, notifica dono/participantes/mencionados. Além disso, `@menções`
em `comentario`/`editar_campos.desc` passam a ser resolvidas e notificadas
do lado do servidor (antes, uma menção escrita pelo agente nunca
notificava ninguém, porque isso normalmente acontece no `<textarea>` do
cliente). O campo `notificar[]` do envelope, que já existia no schema mas
nunca tinha sido usado, também passa a funcionar.

### v1 Parte B — 2026-07-24 · PR #19 · tag `agente-agil-v1b`
Sprint 2: o envelope aceita `referencia` de negócio (`{tipo:'recorrente',
nome, data}`) além de `cardId` direto — o especialista externo (ex.:
Databricks) não precisa mais conhecer o id interno do card, só a
recorrência + a data da instância que quer atualizar. Resolvida via um
novo índice `recorrentes_index/{nome}/{data} → cardId`, mantido pelo
cliente no mesmo multi-path update que cria os cards recorrentes do dia
(mesmo espírito do `cards_index`). `cardId` e `referencia` são mutuamente
exclusivos — o schema exige exatamente um dos dois.

### v1 Parte A — 2026-07-23 · PR #6 · tag `agente-agil-v1a`
`cards_index` de verdade, mantido pelo cliente: `fbSaveAll()`/`fbSaveCard()`
escrevem o índice `id → chave` atomicamente junto com `/cards`;
`resolveCardKey()` na Cloud Function passa a ler esse índice pontualmente
(em vez de escanear `/cards` inteiro a cada chamada), com verificação +
retry e erro rastreável (`stale_cards_index`, HTTP 409) em caso de
divergência.

## `database.rules.json` (regras do Realtime Database, sem versão própria em `version.json`)

### 2026-07-27 · PR #30
Corrige a causa raiz de notificações entre membros comuns nunca chegando
(mas chegando normalmente quando quem dispara a ação é `po`/`adm`):
`createNotif()` no cliente escreve direto em `kanban/usuarios/{uid-do-
destinatário}/notificacoes/{id}` — é assim que menção, atribuição,
desbloqueio etc. funcionam, quem dispara a ação escreve no nó de quem vai
ser avisado. A regra de `kanban/usuarios/{uid}` só liberava escrita pro
dono do próprio nó ou pra `po`/`adm`, então um membro comum notificando
outro membro comum tinha a escrita rejeitada (`PERMISSION_DENIED`) em
silêncio — só um `console.warn`, nenhum erro visível, nenhuma notificação
criada. Adiciona uma regra específica pra `notificacoes/$notifId`: qualquer
pessoa autenticada do domínio pode criar uma notificação nova em qualquer
conta; só o dono do nó ou `po`/`adm` pode modificar/apagar uma que já
existe (marcar como lida, limpar expiradas).
**Precisa de `firebase deploy --only database` depois do merge** — só
commitar/mergear este arquivo não muda as regras que já estão ao vivo no
Console.

### 2026-07-27 · correção da PR #30 (mesmo dia)
A regra acima exigia `auth.token.email.endsWith('@ciahering.com.br')` — mas
o app aceita convidados/freelancers com email fora desse domínio
(`role:'convidado'`, ver aviso na aba de acesso do painel), e eles ficaram
de fora tanto de mandar quanto de receber notificação. Removida a exigência
de domínio da regra de `notificacoes/$notifId`: agora basta estar
autenticado (`auth != null`) pra criar uma notificação nova em qualquer
conta; modificar/apagar uma existente continua exclusivo do dono do nó ou
`po`/`adm`. (Mesma restrição de domínio também bloqueia convidados de
atualizar `presence/$uid` — bug preexistente, fora do escopo desta correção,
sinalizado mas não alterado aqui.)
