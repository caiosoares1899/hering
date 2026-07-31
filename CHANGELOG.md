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

### v8.30.195 — 2026-07-30 · PR #100
Promove pra prod o fix validado no dev (`v8.30.231-dev`, PR #99): nova
ação em massa **🚧 Impedimento** na barra de seleção múltipla, pra
marcar/remover impedimento em vários cards de uma vez. Respeita o
`blockerMode` do squad (coluna vs tag) via `_cardIsBlocked()` — em modo
"coluna", marcar move os cards pra Impedimentos e remover pede uma
coluna de destino; em modo "tag", marcar/remover só liga/desliga
`card.blocker`+`card.blockerReason`, sem mexer na coluna. De passagem,
corrige a entrada de ajuda "Seleção múltipla" (estava desatualizada,
dizia "seis ações" quando já eram sete). Detalhes completos na entrada
de `v8.30.231-dev` abaixo.

### v8.30.194 — 2026-07-30 · PR #96
Promove pra prod os fixes validados no dev (`v8.30.230-dev`, PRs #94 e
#95):

- **Heartbeat de presença pausa em aba oculta** — evita escrita
  desperdiçada com a aba em background (comum no mobile ao trocar de
  app); a pessoa já aparece "offline" pros outros depois do timeout de
  30s de qualquer forma. Manda um heartbeat imediato ao voltar pra aba.
- **Colunas reordenáveis por toque (mobile)** — cards já tinham touch
  drag-and-drop custom (`addTouchDnD`); colunas só tinham `dragstart`
  nativo do HTML5, que não dispara em touch, e não havia alternativa
  nenhuma. Novo `addTouchColDnD` replica o mesmo gesto de long-press dos
  cards. Ajuda (F1/❓) ganhou entrada documentando o gesto.
- **Limpeza de código morto**: 17 funções órfãs, 2 variáveis órfãs e 8
  regras CSS órfãs removidas (achado por um agente de auditoria dedicado,
  cada item re-verificado manualmente antes de remover). Dois clusters
  (painel "mini dependência", subsistema "Linked Cards") ficaram de fora
  de propósito — precisam de decisão de produto, não são limpeza simples.

Detalhes completos de cada mudança nas entradas de `v8.30.229-dev` e
`v8.30.230-dev` abaixo.

### v8.30.193 — 2026-07-30 · PR #90
Promove pra prod o fix validado no dev (`v8.30.228-dev`, PR #89): reduz o
consumo de leitura do Firebase em boards com muito histórico arquivado.
Novo índice `cards_archived/{cardId}->true` (mantido junto de `cards_index`/
`cards_updated_at` em `fbSaveAll()`/`fbSaveCard()`) permite que o
carregamento em duas etapas (`_twoPhaseCardsLoad()`) pare de reverificar
cards já arquivados a cada sessão — eles só entram em `toFetch` na primeira
vez que o dispositivo os vê, não mais toda vez que o timestamp deles muda.
Achado num squad real (`outlet-crm`): 84% dos 4725 cards estavam
arquivados, e cada sessão baixava esse histórico inteiro de novo, mesmo sem
ninguém abrir a tela de Arquivados — consumo diário tinha saltado de ~156k
pra ~1,3M chamadas em 4 dias. `cards` continua carregando tudo (ativos +
arquivados) — essa mudança só reduz a FREQUÊNCIA de reverificação, não o
que fica disponível localmente. Requer a migração one-off (script enviado
fora do repo) que popula `cards_archived` pros cards já arquivados antes
desta versão, senão eles continuam sendo revalidados até o próximo
arquivamento/desarquivamento real.

### v8.30.192 — 2026-07-30 · PR #88
Promove pra prod o fix validado no dev (`v8.30.227-dev`): corrige a CAUSA
RAIZ das tags fantasma (as duas promoções anteriores só mitigavam o
sintoma). O listener ao vivo de `/tags` reatribuía o array `tags` assim
que qualquer atualização remota chegava, sem proteção contra colisão com
edições locais em andamento no editor de tags (diferente do listener de
`cards`, que já tinha essa guarda) — o que podia corromper silenciosamente
o array salvo em seguida, derrubando tags ainda em uso por cards. Agora
ignora a atualização remota enquanto o editor de tags está de fato aberto
e mostrando linhas.

### v8.30.191 — 2026-07-30 · PR #86
Promove pra prod o fix validado no dev (`v8.30.226-dev`): fortalece a
correção de "🔧 Detectar e reparar tags fantasma" pra também cobrir ids no
formato `tag_<Date.now() cru>` (o mesmo esquema que `addTag()` usa pra
tags criadas normalmente pelo time, não só import do Trello) —
`_derivarLabelTagFantasma()` agora rejeita um rótulo derivado que continue
sendo só dígitos, não só a ausência do prefixo `tag_`.

### v8.30.190 — 2026-07-30 · PR #71
Promove pra prod a documentação de "💡 Meus cards" no conteúdo de ajuda
(F1/❓), landed no dev há um tempo (PR #71) mas nunca promovida — mudança
doc-only, sem risco, agora sincronizada com o dev.

### v8.30.189 — 2026-07-30 · PR #83
Promove pra prod o fix validado no dev (`v8.30.225-dev`): "💡 Meus cards"
destacava cards de outra pessoa quando `window._currentUserInit` (recém-
calculado por uma fórmula ingênua a cada login) divergia do `init`
registrado no Firebase, que pode ter sido editado manualmente pra resolver
colisão de iniciais entre pessoas de nome parecido. `autoRegistrar()`
agora usa `existe.init` (autoritativo) pro usuário já cadastrado, em vez do
valor recém-calculado.

### v8.30.188 — 2026-07-30 · PR #81
Promove pra prod o fix validado no dev (v8.30.224-dev): "🔧 Detectar e
reparar tags fantasma" mostrava o ID cru como rótulo (ex.: `1782410107254`)
quando a tag órfã tinha um ID que não segue o padrão `tag_<slug>_<4chars>`
do import do Trello (squads com tags legadas de ID numérico). Extraído pra
`_derivarLabelTagFantasma()`, com fallback claro (`Tag sem nome (<id>)`)
pra IDs fora do formato esperado. Só afeta reparos futuros — tags já
criadas com nome numérico precisam ser renomeadas manualmente no editor.

### v8.30.187 — 2026-07-30 · PR #70
Promove pra prod tudo desde a v8.30.186 (PRs #68 e #69), validado no dev:
"💡 Meus cards" agora encontra e mostra corretamente cards em qualquer
coluna (não só Concluído) — corrige a expansão do limite de renderização
por coluna e a pré-posicionação da rolagem vertical independente de cada
coluna antes da rolagem horizontal final.

### v8.30.186 — 2026-07-30 · PR #67
Promove pra prod tudo desde a v8.30.185 (PRs #64-#66), validado no dev:

- Corrige quebra de linha feia dos botões "💡 Meus cards"/"✕🗑️" na barra
  de Filtros (agrupados, sem `margin-left:auto`, fluem normal com o resto
  da barra).
- Remove o filtro "Qualquer executor", redundante com o seletor 👤/🤝/🤖
  do cabeçalho.

### v8.30.185 — 2026-07-30 · PR #63
Promove pra prod tudo desde a v8.30.184 (PRs #61 e #62), validado no dev:

- Botão "💡 Meus cards" na barra de Filtros — destaca (glow/pulso, sem
  esconder o resto) os cards onde a pessoa é responsável ou participante,
  expande colunas colapsadas que tenham algum, e rola até o primeiro.
- Corrige crash real ao abrir um card com item de checklist sem texto
  (`t` undefined/null) — `renderMd()` chamado sem o fallback `||''` que o
  resto do app já usa, travava a abertura de qualquer card nessa condição.

### v8.30.184 — 2026-07-30 · PR #60
Promove pra prod tudo desde a v8.30.183 (PRs #56-#59), validado no dev:

- **Checklist**: corrige item inteiro ficando `draggable` desde a criação
  (quebrava seleção de texto por mouse — só dava pra selecionar clicando
  dentro e usando Ctrl+A); botão 📋 pra copiar todos os itens de uma vez;
  **@menção** (pessoa ou agente de IA) nos itens, tanto ao criar quanto ao
  editar, com o mesmo autocomplete/notificação de descrição/comentário/PO.
- **Modal do card**: botão ⬇️ fixo no cabeçalho pra rolar até a Descrição.
- **Descrição (principal e adicionais)**: dropdown "Tt" de tamanho de texto
  (Texto normal / Título 1/2/3), inspirado no Trello — dropdown custom
  (não `<select>` nativo, que renderiza fora do alcance do CSS do app).

### v8.30.183 — 2026-07-30 · PR #55
Promove pra prod o fix da PR #54 (validado no dev): ícone quebrado
(`/favicon.ico`, que nunca existiu neste repo) na notificação nativa do
navegador de lembrete de reunião. Trocado por `marinheiro.png`, arquivo
estático real. Mesma classe de bug já corrigida na PR #53 pro push
(`firebase-messaging-sw.js`/`functions/index.js`).

### v8.30.182 — 2026-07-28 · PR #48 · tag `kanban-v8.30.182`
Promove pra prod a correção de um bug real do delta-sync em squads grandes
(PR #47): o cache do carregamento em duas etapas guardava o conteúdo
completo dos cards em `localStorage`, que tem cota pequena (~5-10MB por
site, compartilhada entre todos os squads/páginas do domínio). Em squads
com muitos cards (ex.: `outlet-crm`, 4.690 cards) o JSON serializado
estourava essa cota — o `setItem` falhava em silêncio e o cache nunca
persistia, fazendo o board cair **sempre** no carregamento completo, sem
nenhum aviso visível, justamente nos squads onde a economia mais importa.
Corrigido movendo o cache pra **IndexedDB** (cota bem maior). Confirmado ao
vivo em `outlet-crm` após a promoção: carregamento caiu de ~9.045KB pra
~827KB numa recarga (~91% de redução), buscando individualmente só o card
que de fato tinha mudado.

### v8.30.181 — 2026-07-28 · PR #45 · tag `kanban-v8.30.181`
Promove pra prod tudo validado no dev desde a v8.30.180 (PRs #41, #42, #43,
#44):
- Tags de tamanho de camiseta (**👕 P/M/G/GG**), opcionais por squad —
  ativa em Configurações → Tags (só PO/ADM/Organizador). Provisiona 4 tags
  fixas; o emoji 👕 cresce de fonte conforme o tamanho.
- Ordenação dos cards por tamanho (P → GG), no menu global e por coluna.
- Botão "Prioridade" da toolbar virou **"Ordenação"** (rótulo fixo, mesmo
  padrão de Filtros/Raia — antes mudava de texto conforme o modo ativo).
- Campo dedicado "👕 Tamanho" no modal do card (exclusivo, ao lado de
  Prioridade) e filtro dedicado de tamanho na barra de Filtros, separados
  do campo/filtro genérico de tags.
- Correções no conteúdo de ajuda: notificação de mudança de coluna que
  faltava na lista, lista de abas de Configurações desatualizada (faltavam
  Fluxo, Calendário e Criativos), dicas novas pras abas Fluxo e Ficha de
  Criativo (que nunca tinham nenhuma).

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

### v8.30.236-dev — 2026-07-31 · PR #109
**Rádio do Maré — Nível 1**: nova funcionalidade, playlist colaborativa
real do Spotify (não confundir com "ouvindo agora" — aqui NÃO é ao vivo,
não é sincronizado, cada um ouve no próprio ritmo). Design discutido e
aprovado antes de escrever código (dono da conta, UI, moderação — ver
PRs anteriores dessa conversa). Mesmo padrão Squad/Geral do resto do
painel: uma playlist pra empresa toda + uma por squad.

- **`database.rules.json`**: novo nó `kanban/spotify_radio_owner_secret`
  (deny total, mesmo padrão de `spotify_secrets`) — guarda o
  refresh_token de uma ÚNICA conta "dona" das playlists (a playlist é
  compartilhada, então precisa de um token de escrita fixo, independente
  de quem está sugerindo música — diferente do token pessoal de cada
  membro pro "ouvindo agora"). `radio_geral` (dentro de `painel`) e
  `radio_squad` (dentro de `squads/{id}/dados`) não precisaram de regra
  nova — já cobertos pelas regras existentes desses nós, mesmo caso de
  `spotify_now`.
- **`functions/spotify/radioOwnerCallback.js`** (novo): callback de
  conexão da conta dona — diferente de `spotifyOauthCallback` (uma
  conexão POR PESSOA, resolvida via `state`/`oauth_pending`), esta é uma
  conexão ÚNICA e manual (sem uid envolvido, é sempre a mesma conta
  fixa), pedindo os escopos `playlist-modify-public`/
  `playlist-modify-private` em vez de `user-read-currently-playing`.
  Deploy isolado: `firebase deploy --only functions:spotifyRadioOwnerCallback`.
- **`functions/spotify/radioSearchCore.js`** + **`radioSearch.js`**
  (novos): busca de faixas via `GET /v1/search`. Decisão importante:
  usa um token **app-only** via `client_credentials` (só
  client_id+client_secret, sem usuário nenhum envolvido) — busca é
  catálogo público, então funciona mesmo antes da conta dona ter sido
  conectada, e não arrisca nada relacionado a ela. Qualquer pessoa
  logada no Maré pode buscar (só verifica o ID token do Firebase Auth).
  Deploy isolado: `firebase deploy --only functions:spotifyRadioSearch`.
- **`functions/spotify/radioSuggestCore.js`** + **`radioSuggest.js`**
  (novos): adiciona a faixa escolhida na playlist via
  `POST /v1/playlists/{id}/tracks`, sempre usando o token da CONTA DONA
  (cacheado em memória entre chamadas, mesmo padrão de `syncCore.js`) —
  nunca o de quem sugere. Isso também significa que sugerir não exige
  ter conectado o próprio Spotify, só estar logado no Maré. **Moderação:
  livre total** — entra direto na playlist, sem fila de aprovação nem
  log de auditoria nesta v1 (decisão combinada, mesmo espírito de
  confiança do resto do app — Kudos/comentários também não têm
  aprovação). Deploy isolado: `firebase deploy --only functions:spotifyRadioSuggest`.
- **UI**: painel Spotify ganhou um sub-toggle "🎧 Ouvindo agora" /
  "🎵 Playlist" (escopo Squad/Geral continua como aba principal, como já
  era). Só um dos dois tem listener ativo por vez — entrar em "Playlist"
  desanexa o listener de presença (nada ali é ao vivo). Sem playlist
  registrada ainda, mostra um formulário simples pra colar o link/ID (a
  criação das playlists em si é manual, feita direto no app do Spotify —
  decisão de escopo pra v1, evita automatizar `POST /users/{id}/playlists`
  por um ganho pequeno). Registrada, mostra "🎵 Abrir playlist no
  Spotify" + busca + resultados com "+ Sugerir" em cada um.
- Ajuda (F1/❓) ganhou uma entrada nova sobre a Rádio do Maré.
- **Deixado de fora desta v1, por decisão combinada**: o botão "🎙️ Ir pra
  rádio" (extensão automática de sugestões do Spotify) — não existe uma
  URL/URI documentada e confiável pra abrir direto nesse modo (é um botão
  dentro do próprio app do Spotify, não um parâmetro de link conhecido);
  fica pra uma investigação futura, sem prioridade agora.

Verificado com Playwright (17 cenários) + `node --test` (8 casos novos em
`functions/spotify/__tests__/radioSearch.test.js` e `radioSuggest.test.js`,
105/105 no total da suíte de functions): form de registro aparece sem
playlist; extração do ID a partir de uma URL colada; grava no path certo
por escopo (squad vs. geral); busca manda o Bearer do usuário e a query
certa; sugerir manda playlistId+trackUri corretos e não depende de o
usuário ter conectado o próprio Spotify; mensagem específica quando a
conta dona ainda não foi conectada; token app-only da busca e token da
conta dona (sugestão) cacheados corretamente e nunca confundidos entre si;
autodesconexão simulada (rotação de refresh_token) coberta nos testes da
function.

**Pendência pra habilitar de verdade**: a conta dona ainda não foi
conectada — sem isso, `spotifyRadioSuggest` responde
`radio_owner_not_connected` (a UI já mostra essa mensagem específica) e
nenhuma playlist pode receber sugestões ainda. URL de autorização
(escopos `playlist-modify-public playlist-modify-private`) entregue fora
do repo, mesmo processo manual do `spotifyOauthCallback` original — só
depois do primeiro deploy + confirmação da Redirect URI exata no Firebase
Console + cadastro dela no Spotify for Developers (adicionando uma
segunda Redirect URI ao mesmo app já existente, mesmo `client_id`).

### v8.30.235-dev — 2026-07-31 · PR #108
Ajuste no grupo "não conectado" do painel Spotify (squad e geral): antes
mostrava TODAS as pessoas que nunca conectaram, cada uma com o convite
"Conectar Spotify" — em squads/na empresa toda isso vira uma lista longa
e pouco útil de gente que não usa a feature. Agora só a **própria pessoa
logada** aparece nesse grupo quando não conectada (com o botão de
conectar); as outras pessoas que nunca conectaram somem da lista.

- `renderSpotifyPanel()`: novo filtro antes do sort — mantém uma pessoa
  se ela for a própria (`isSelf`, sempre visível, conectada ou não) OU se
  `_spotifyGroupRank()` não for 2 (grupo "não conectado"). Os outros 2
  grupos (ouvindo agora / conectado parado) continuam mostrando todo
  mundo que se aplica, sem filtro nenhum — só o grupo 3 mudou.
  `_spotifyGroupRank()` em si não mudou (mesma lógica da v8.30.234-dev);
  o filtro roda em cima do resultado dela.

Verificado com Playwright (10 cenários, ambiente de teste descartado
depois): grupo 1/2 continuam mostrando todo mundo normalmente; grupo 3
mostra só a própria pessoa mesmo com outras pessoas nunca conectadas no
squad; self mantém o convite mesmo sem ninguém mais conectado; ao
conectar, self passa a aparecer no grupo certo e os outros continuam de
fora; mesmo comportamento reproduzido no escopo "Geral".

### v8.30.234-dev — 2026-07-31 · PR #107
Terceira leva da integração com Spotify: **a function agendada de sync**
(a peça que faltava pra "ouvindo agora" aparecer de verdade no painel) +
reordenação por prioridade na lista. Conectar/trocar/desconectar (PR
#106) já foi validado ponta a ponta pelo usuário em ambiente real — único
ajuste veio de lá: `database.rules.json` do PR #105 não tinha sido
deployado ainda (`firebase deploy --only database`), lembrete registrado
aqui pra não repetir: quando `database.rules.json` E `functions/` mudam
na mesma leva, os DOIS deploys são necessários, nenhum published pela
promoção do HTML.

- **`functions/spotify/syncCore.js`** (novo) + **`functions/spotify/
  sync.js`** (novo): lógica separada do wrapper `onSchedule`, mesmo
  motivo de `agente-agil/http.js` vs. `agente-agil/board.js` — a parte
  testável com `node --test` não deveria depender do runtime de Cloud
  Functions. `spotifySync` roda a cada 1 minuto (mínimo que o Cloud
  Scheduler permite — bate com o "a cada 60s" combinado desde o desenho
  original). Pra cada uid em `spotify_secrets`: renova o `access_token`
  via `refresh_token` (cacheado em memória entre execuções — o
  `access_token` dura ~1h, não faz sentido renovar a cada tick só pra 1
  leitura; testado que o segundo tick reusa o cache sem bater no Spotify
  de novo), consulta `GET /v1/me/player/currently-playing`, e escreve o
  resultado em **todos os squads que a pessoa participa + no geral**
  (mesmo fan-out multi-squad de `spotifyDisconnect`). Uma pessoa falhando
  (rede, token) não derruba o tick inteiro (`Promise.allSettled`).
  **Autocorreção**: se o `refresh_token` vier `invalid_grant` — a pessoa
  revogou o acesso direto pela tela "Apps conectados" do Spotify (o link
  de cortesia que a UI já oferece desde o PR #106), sem passar pelo nosso
  botão — a function desconecta a pessoa por completo (mesmo helper de
  `spotifyDisconnect`, agora extraído pra `functions/spotify/_shared.js`
  e reusado pelos dois), em vez de ficar tentando e falhando pra sempre e
  deixando um "conectado" fantasma no painel.
  Deploy isolado: `firebase deploy --only functions:spotifySync`.
- **`functions/spotify/_shared.js`** (novo): `buildDisconnectUpdates(db,
  uid)` — o multi-path update que apaga o refresh_token + todo o status
  público espalhado. Extraído de `spotifyDisconnect` (que passou a usar
  também) porque agora dois lugares diferentes (o botão de desconectar E
  a autocorreção do sync) precisam apagar exatamente as mesmas coisas —
  copiar essa lógica duas vezes seria um jeito fácil dela divergir se
  alguém adicionar um novo path de status no futuro e esquecer de
  atualizar as duas cópias.
- **`functions/package.json`**: novo `spotify/__tests__/*.test.js` no
  script de teste, mesma convenção de `agente-agil`/
  `agente-agil-orquestrador`. `functions/spotify/__tests__/sync.test.js`
  (5 casos, `node --test`, sem emulador — fake db local + `fetch`
  mockado): fan-out multi-squad + geral, imagem de capa pega a menor do
  array, entrada não some quando nada está tocando (`{playing:false}`,
  não ausência), autodesconexão real no `invalid_grant`, tick resiliente
  a uma pessoa falhando, cache de `access_token` reusado no tick seguinte.
- **UI (`kanban-dev.html`)**: nova ordenação por prioridade em
  `renderSpotifyPanel()`/`_spotifyGroupRank()` — **1º** quem está
  conectado E ouvindo algo agora, **2º** conectado mas parado, **3º** não
  conectado; dentro de cada grupo continua alfabético, como já era. A
  própria pessoa usa `_spotifySelfConnected` (a flag pública, não a
  presença no bucket) pra decidir o grupo 1-vs-3 — o sync só escreve a
  cada 1 minuto, então logo depois de conectar o bucket pode ainda não
  ter entrada nenhuma; sem esse cuidado a própria pessoa cairia no grupo
  "não conectado" por até 1 minuto após conectar (mesmo motivo de
  `_spotifySelfConnected` existir desde o PR #106). Pra todo mundo, é
  suficiente calcular com o que o sync já escreve — presença em
  `spotify_now` = conectado, `playing && track` = ouvindo, ausência = não
  conectado — sem precisar de nenhum dado novo.

Verificado com Playwright (8 cenários, ambiente de teste descartado
depois — client não tem framework de teste, ver `CLAUDE.md`): grupo 1
sempre no topo, dois "ouvindo agora" ficam juntos em ordem alfabética
entre si, grupo 2 logo depois, grupo 3 alfabético por último, própria
pessoa recém-conectada (sem entrada no bucket ainda) cai no grupo 2 e não
no 3, volta pro grupo 3 corretamente ao desconectar.

### v8.30.233-dev — 2026-07-31 · PR #106
Segunda leva da integração com Spotify: credenciais reais plugadas
(`SPOTIFY_CLIENT_ID` não é secreto, vive como constante no código; o
`SPOTIFY_CLIENT_SECRET` já estava no Secret Manager desde o primeiro
deploy) e gestão de conta por usuário — trocar de conta, desconectar de
verdade e lidar com quem está em mais de um squad. Design discutido e
aprovado antes de escrever código (ver PRs anteriores dessa conversa).

- **`functions/spotify/oauth.js`**: `SPOTIFY_CLIENT_ID` deixou de ser
  placeholder. O redirect de sucesso agora distingue `?spotify=connected`
  (primeira conexão) de `?spotify=reconnected` (já estava conectado,
  trocou de conta/reautorizou) — o cliente informa qual dos dois é via
  `wasConnected` no próprio `oauth_pending/{state}`, já que a function não
  tem outro jeito de saber. Gravação do token e da flag pública
  `spotify_connected` virou um `update()` multi-path atômico.
- **`functions/spotify/disconnect.js`** (novo): `spotifyDisconnect`, uma
  `onRequest` v2 em `us-central1` com CORS liberado só pro domínio do
  GitHub Pages (chamada via `fetch()` do navegador, não redirect — precisa
  de CORS, diferente do callback do OAuth). Verifica o ID token do
  Firebase Auth (`Authorization: Bearer`), e então **apaga de verdade**
  (não é flag de "inativo"): `spotify_secrets/{uid}` (o refresh token em
  si), `usuarios/{uid}/spotify_connected`, `painel/spotify_now_geral/{uid}`
  e `squads/{sq}/dados/spotify_now/{uid}` — este último pra **cada squad
  que a pessoa participa** (`usuarios/{uid}/squads` é um mapa
  `{squadId: true}`, confirmado que não existe conceito de "squad
  principal" em nenhum outro lugar do código; sem esse fan-out, alguém em
  dois squads continuaria aparecendo como "ouvindo" no squad que não foi
  desconectado). A ausência da entrada em `spotify_secrets` é o único
  sinal que a futura function de sync vai checar pra saber que parou —
  não tem flag separada de "ativo" pra ficar dessincronizada.
  Deploy isolado: `firebase deploy --only functions:spotifyDisconnect`.
- **`functions/index.js`**: exporta `spotifyDisconnect`.
- **UI (`kanban-dev.html`)**: a linha da própria pessoa no painel agora
  reflete `usuarios/{uid}/spotify_connected` (buscado uma vez ao abrir o
  painel, via `toggleSpotify()`) — se já conectada, mostra "🔁 Trocar
  conta" + "❌ Desconectar" + um link de cortesia "Gerenciar no Spotify ↗"
  pra `https://www.spotify.com/account/apps/` (pro caso de a pessoa
  querer revogar o acesso direto pelo lado do Spotify também); se não,
  mostra o botão "🔌 Conectar Spotify" de antes. "Trocar conta" reusa o
  mesmo fluxo de conexão (o `.set()` do callback já sobrescreve o token
  antigo) — só precisou passar `wasConnected` no `oauth_pending` pra virar
  o toast certo. Nova `desconectarSpotify()`: confirma
  (`uiConfirm`), chama `spotifyDisconnect` com o ID token da sessão, e em
  caso de sucesso limpa o estado local (`_spotifySelfConnected` e a
  entrada da própria pessoa nos buckets de "ouvindo agora" já
  carregados) sem esperar o próximo tick de um listener. Ajuda (F1/❓)
  ganhou uma 4ª entrada explicando trocar/desconectar.

Verificado com Playwright (24 cenários): estado não-conectado vs conectado
na linha própria; `connectSpotify()` grava `wasConnected` correto nos dois
casos; fluxo completo de `desconectarSpotify()` (chamada com o Bearer
certo, limpeza de estado local, toast) e seu cancelamento; os três
resultados de query string (`connected`/`reconnected`/`error`) mostram o
toast certo e limpam a URL depois.

**Ainda pendente** (fora do escopo desta leva): a function agendada de
sync (polling de `/me/player/currently-playing` a cada squad conectado e
fan-out pra `spotify_now`/`spotify_now_geral`) — sem ela, conectar/
desconectar e a UI já são testáveis ponta a ponta, mas o "ouvindo agora"
em si ainda não populará no painel.

### v8.30.232-dev — 2026-07-31
Primeira leva da integração com Spotify ("ouvindo agora") — escopo v1
deliberadamente simples: só o que cada pessoa está ouvindo neste momento,
sem histórico. Plano de arquitetura discutido e aprovado antes de
escrever código (investigação de OAuth existente, padrão do Kudos pra
squad/geral, leitura lazy) — ver PRs anteriores dessa conversa.

**Só as partes que não dependem de credenciais do Spotify**, por decisão
combinada — a troca de token real (`SPOTIFY_CLIENT_ID`/
`SPOTIFY_CLIENT_SECRET`) fica pra depois que o app for criado no Spotify
for Developers:

- **`database.rules.json`**: novo nó `kanban/spotify_secrets` com
  `.read`/`.write: false` pra todo mundo — só Admin SDK (Cloud Functions)
  acessa. Importante: teve que ficar FORA da árvore `kanban/usuarios`,
  porque essa árvore já tem `.read: "auth != null"` no nível raiz, e
  regras do Realtime Database cascateiam só numa direção — um `.read:
  false` mais profundo não revoga um acesso já concedido por um
  ancestral. Também novo `kanban/oauth_pending/{state}` (ponte de uso
  único entre "cliente inicia o OAuth" e "Spotify redireciona pro
  callback", já que o Spotify não sabe nada sobre uid do Firebase). Os
  nós de status público (`spotify_now` por squad, `spotify_now_geral`)
  não precisaram de regra nova — já caem dentro de `dados`/`painel`, que
  já têm regras adequadas.
- **`functions/spotify/oauth.js`** (novo): `spotifyOauthCallback`, uma
  `onRequest` v2 em `us-central1` (mesma região de `agenteAgil`). Troca o
  `code` por tokens usando `client_secret` (Secret Manager, mesmo padrão
  de `AGENTE_AGIL_KEY` em `agente-agil/http.js`), grava o `refresh_token`
  em `spotify_secrets/{uid}` via Admin SDK, redireciona de volta pro app
  com `?spotify=connected` ou `?spotify=error`. `SPOTIFY_CLIENT_ID` é
  constante no código (não é secreto — o próprio Spotify espera isso
  exposto no client) — hoje um placeholder, aguardando o app ser criado.
  Não existe function separada pra "iniciar" o OAuth: o link de
  autorização é montado direto no `kanban.html`, sem servidor.
- **UI**: novo botão "🎧 Spotify" na mesma família visual de "📊 Dados"/
  "📌 Lembretes" (pílula fixa na lateral direita), abrindo um painel com
  duas abas "Sua Squad"/"Geral" — mesmo padrão visual e arquitetural do
  Kudos (dois paths reais, não agregação: `kanban/squads/{squad}/dados/
  spotify_now` e `kanban/painel/spotify_now_geral`, function de sync
  futura escreve os dois a cada tick). Cada pessoa aparece com a música
  atual (capa + artista), "⏸ Nada tocando agora" (conectado mas parado),
  ou "Não conectado" — a própria pessoa, se não conectada, vê um botão
  "🔌 Conectar Spotify" em vez disso.
- **Leitura lazy**: diferente do Kudos (que faz poll a cada 3min o tempo
  todo, pra manter um badge de contagem), o Spotify não tem badge — então
  o listener (`_onChildAdded`/`_onChildChanged`/`_onChildRemoved`, mesmo
  padrão de `presence`) só é anexado quando o painel abre, na aba ativa;
  desanexado ao fechar ou trocar de aba. Zero leitura em background com o
  painel fechado. A function agendada de sync (ainda não implementada —
  fica pra quando as credenciais existirem) roda independente disso.
- Ajuda (F1/❓) ganhou uma aba nova "🎧 Spotify" com 3 entradas.

Verificado com Playwright (13 cenários): abrir o painel anexa listener só
no path certo; trocar de aba desanexa o antigo e anexa o novo; fechar
desanexa tudo; renderização cobre os 4 estados (tocando, parado, própria
pessoa não conectada, outra pessoa não conectada); `connectSpotify()` sem
`client_id` configurado avisa em vez de tentar redirecionar.

**Pendências explícitas pra próxima leva** (fora do escopo desta,
combinado com o usuário): function agendada de sync (polling da API do
Spotify a cada 60s, escrevendo `spotify_now`/`spotify_now_geral`);
preencher `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` reais depois que o
app for criado no Spotify for Developers; confirmar a Redirect URI exata
no Firebase Console após o primeiro deploy de `spotifyOauthCallback`,
antes de cadastrar no formulário do Spotify.

### v8.30.231-dev — 2026-07-30
Nova ação em massa na barra de seleção múltipla: **🚧 Impedimento**, pra
marcar/remover impedimento em vários cards de uma vez — pedido pelo
usuário depois de mexer no compilado de bloqueios do Painel.

Respeita o `blockerMode` do squad (coluna vs tag) através da mesma fonte
única de verdade que já existia (`_cardIsBlocked()`), em vez de
reimplementar a decisão:
- **Modo "coluna"** (padrão): marcar move os cards não-bloqueados
  selecionados pra Impedimentos (mesmo caminho de `bulkMove`, com rótulo
  dedicado pra descoberta). Remover pede uma coluna de destino — não
  existe (em nenhum lugar do código, nem no single-card) um "voltar pra
  coluna anterior" rastreado, então não inventei esse estado novo; só
  reaproveitei a lista de colunas já usada por `bulkMove()`.
- **Modo "tag"**: marcar liga `card.blocker`+`card.blockerReason` (com um
  campo de motivo opcional no popover) sem mexer na coluna; remover limpa
  os dois campos. Não abre o modal do card pra digitar o motivo (como o
  fluxo single-card faz) — o motivo vem direto do popover em massa, mais
  rápido pra aplicar o mesmo texto em vários cards.

O popover separa "marcar" (só cards ainda não impedidos) de "remover" (só
cards já impedidos) dentro da mesma seleção — evita marcar de novo quem já
está impedido ou tentar remover de quem nunca esteve.

Verificado com Playwright (18 cenários, sem tocar DOM real — chama as
funções de mutação diretamente): nos dois modos, marca só quem devia,
ignora cards fora da seleção, não duplica/reprocessa quem já está no
estado-alvo, e usa `_bulkFinish` com `keepSelection` correto pra cada modo
(estrutural em coluna, não-estrutural em tag — mesmo padrão das outras
ações em massa).

Ajuda (F1/❓) atualizada — a entrada de "Seleção múltipla" também estava
desatualizada (dizia "seis ações" mas já eram sete, faltando 📅 Prazo);
corrigido de passagem junto com a entrada nova de 🚧 Impedimento.

### v8.30.230-dev — 2026-07-30
Limpeza de código morto, parte 2 da leva de "otimização de rotina" —
relatório gerado por um agente de auditoria dedicado (750+ identificadores
top-level verificados contra o arquivo inteiro + `painel.html`/
`painel-dev.html`, buscando `onclick`, `window.x()`, dispatch por string).
Cada item foi re-verificado manualmente antes de remover (contagem de
referências no arquivo, confirmando exatamente 1 — a própria definição).

**17 funções órfãs removidas** (nunca chamadas — a maioria era duplicata
substituída por outra função, achado durante a auditoria): `cardHasDesc`,
`_doBulkTag`, `subteamsOfInit`, `_flowFirstColId`, `resetFlowBaseline`,
`cycleColSort`, `moveCardSubPrio`, `toggleCardOKR` (duplicata de
`ctxToggleOKR`), `addCI` (lia um `#cl-inp` inexistente no HTML —
substituída por `addCIToGroup`), `_nextDueDate`, `_cleanupQLTemp`,
`openTrelloImport`, `_maybeRequestNotifPermission` (duplicata de
`requestNotifPermission`), `ctxProgress`/`ctxDone` (duplicatas de
`ctxMove`), `renderMentionText` (duplicata de lógica já embutida em
`renderMd`), `resolveAllBugs`, `salvarComoModelo` (duplicata de
`ctxModel`/`salvarComoModeloModal`, cuidado pra não confundir com essa
que continua em uso).

**2 variáveis órfãs removidas**: `_origQa` (leftover de instrumentação
que nunca foi lida) e `_qlEditIdx` (superseded por `_editingQLItem`).

**CSS órfão removido** (correlacionado com o código acima ou standalone,
sem nenhuma referência em markup/JS, incluindo construção dinâmica via
template string): `.card-has-desc`, `.dep-node-indent`/`.dep-node-line-h`/
`.dep-node-line-v` (leftovers de um estilo antigo de árvore, substituído
pela seta de texto simples do Mapa de Dependências atual), `.parent-btn`
(substituído por `.minicard-*` no seletor de "Depende de" atual),
`.retro-s`/`.retro-t`/`.retro-i` (cluster órfão isolado, sem recurso vivo
correspondente).

**Deixado de fora desta leva, por decisão de produto** (não é limpeza de
código morto simples, precisa de decisão consciente — terminar de religar
a UI ou remover o subsistema inteiro):
- Painel "mini dependência" (`renderCardDepMini`, `depMiniNav` etc.) —
  chamado mas sempre no-opa, os IDs de DOM que espera não existem no HTML.
- Subsistema "Linked Cards" (`searchLinkedCards` e vizinhos) — parece
  substituído pelo "Depende de" atual, mas o texto de ajuda (F1/❓) e o
  prompt da IA ainda descrevem esse recurso pros usuários — inconsistência
  real, além do código morto.
- Cauda de ~30 classes CSS órfãs de confiança média (`.btn-modelo`,
  `.squad-btn`, `.cal-legend` etc.) — impacto individual pequeno, mas
  merecem uma segunda olhada isolada antes de remover em lote.

### v8.30.229-dev — 2026-07-30
Leva de otimização de rotina + auditoria mobile, pedida como "otimização
de rotina + análise e correção mobile" — escopo combinado antes de
implementar: performance de sync/polling, limpeza de código morto (relatório
separado) e auditoria geral de responsividade (sem bug específico relatado).

**Heartbeat de presença pausa em aba oculta.** O heartbeat (escreve
`kanban/squads/{squad}/presence/{uid}` a cada 15s) rodava mesmo com a aba
em background — diferente do poll de kudos, que já tinha essa guarda
(`if(!document.hidden)`). Cada heartbeat em background é escrita
desperdiçada (a pessoa já apareceria "offline" pros outros depois do
timeout de 30s de qualquer forma, que é o comportamento correto) —
especialmente relevante no mobile, onde trocar de app deixa a aba em
background o tempo todo. Ganha também um heartbeat imediato ao VOLTAR pra
aba (`visibilitychange`), pra não ficar "às escuras" até o próximo tick de
15s.

**Reordenar colunas por toque (mobile).** Auditoria mobile encontrou um
gap concreto: cards já tinham um sistema de touch drag-and-drop custom
(`addTouchDnD`, toque longo com vibração/clone visual), mas colunas só
tinham o `dragstart` nativo do HTML5 — que simplesmente não dispara em
touch. Não existia alternativa (sem botões mover-esquerda/direita, sem
menu): reordenar colunas só funcionava no desktop. Novo `addTouchColDnD`
replica o mesmo gesto de long-press dos cards (arma depois de 400ms
parado, vibra, classe visual `.col-armed`), calculando o destino pela
metade esquerda/direita da coluna sob o dedo — mesma lógica de
`handleColDrop` (mouse), reaproveitada. Verificado com Playwright
(dispatch de `TouchEvent` reais) antes de fechar: arrasto pro fim da
lista, arrasto pra posição inicial, tap rápido sem long-press (não deve
reordenar nada), e toque começando dentro de um `.card` (não deve colidir
com o drag do card). Os 4 cenários passaram. Texto novo em Ajuda (F1/❓)
documentando o gesto, ao lado da entrada já existente de "Arrastar card
no celular".

Auditoria também sinalizou dois pontos que ficam de fora desta leva, por
não terem risco/retorno claros o bastante pra mexer sem mais confirmação:
um poll de 60s que rebusca `/columns` e `/tags` inteiros além dos
listeners ao vivo que já existem pros dois (parece redundante, mas o
comentário no código descreve como "rede de segurança" deliberada — sem
histórico de por que foi adicionado, não risquei remover); e
`_cardDirtyTimer`, que faz polling de 400ms comparando `JSON.stringify`
pra detectar alterações não salvas no card aberto — daria pra trocar por
listeners de evento nos campos, mas é refator maior tocando a UX do botão
salvar em vários tipos de campo.

Reordenar cards DENTRO da mesma coluna por toque (só entre colunas
funciona hoje) fica como gap conhecido, não resolvido nesta leva.

### v8.30.228-dev — 2026-07-30
Reduz drasticamente o consumo de leitura do Firebase em boards com muito
histórico arquivado. Achado com dados reais de um squad de produção
(`outlet-crm`): 4.725 cards no total, **84% arquivados** (3.966) — e o
sync do board estava rebaixando TODOS eles, ativos e arquivados, a cada
sessão de cada pessoa conectada, o tempo todo (não só no carregamento
inicial — o listener ao vivo de `cards_updated_at` também revalidava
arquivados a cada burst). Consumo medido: mais que dobrando por dia
(155k → 1,3M chamadas/dia em 4 dias), espalhado por várias pessoas
simultaneamente, não uma sessão travada.

Novo índice leve `cards_archived/{cardId}->true` (só existe pra
arquivados, ausente = ativo) — mantido no mesmo funil que já mantém
`cards_index`/`cards_updated_at` (`fbSaveAll()`/`fbSaveCard()`).
`_planCardsDelta()` (kanban.html) passa a receber esse índice: um card
arquivado só entra na lista de busca individual se **nunca tiver sido
cacheado** neste dispositivo — não mais toda vez que o timestamp dele
mudar. `_onCardsUpdatedAtLive()` (listener ao vivo) ignora reverificar
ids já marcados como arquivados; novo listener em `cards_archived`
mantém isso atualizado em tempo real durante a sessão (arquivar/
desarquivar por qualquer pessoa reflete na hora, sem esperar reload).

Decisão deliberada de escopo: `cards` continua contendo TUDO (ativos +
arquivados), exatamente como hoje — investigação encontrou ~50 lugares no
código que dependem disso (renderização, filtros, `openArquivados()`,
`desarquivar()`, limpeza em massa, relatórios). Só muda a FREQUÊNCIA de
reverificação de arquivados, não o que fica disponível localmente — trade-
off: cada dispositivo ainda baixa os arquivados uma vez (não zero), mas
nunca mais fica re-baixando o mesmo histórico parado indefinidamente. Uma
versão "sob demanda" (só carrega arquivados ao abrir a tela de
Arquivados, evitando até esse custo único) fica pra uma investigação
separada — mudança maior, toca os ~50 call-sites que hoje assumem `cards`
completo.

**Requer migração pros squads com arquivados já existentes** (como este):
sem popular `cards_archived` retroativamente, o mecanismo só vale pra
arquivamentos novos a partir de agora. Script de migração fornecido à
parte (console do navegador, roda uma vez por squad).

Verificado: `_planCardsDelta()` (função pura) testada isoladamente contra
6 cenários (ativo mudou, ativo igual, arquivado já cacheado com timestamp
divergente, arquivado nunca cacheado, card legado sem timestamp, e
`remoteIds` sempre completo independente do que entra em `toFetch`).

### v8.30.227-dev — 2026-07-30
Corrige a CAUSA RAIZ das tags fantasma (as duas entradas anteriores só
mitigavam o sintoma — o rótulo numérico no reparo). O listener ao vivo de
`/tags` (`fbListen`) reatribuía `tags` pra um array novo assim que
QUALQUER atualização remota chegava, sem nenhuma proteção contra colisão
com edições locais em andamento — diferente do listener de `cards`, que já
tem essa guarda (`_hasLocalSession`/`_lastLocalSave`).

Sequência do bug: o editor de tags (Config → Tags) renderiza linhas cujos
handlers (`updateTagName(i,...)`, `delTag(i)`, etc.) dependem do ÍNDICE do
array `tags` no momento da renderização. Se uma atualização remota chegasse
enquanto o editor estava aberto (ex.: outra pessoa salvando tags ao mesmo
tempo), `tags` era reatribuído a um array novo por baixo do editor — os
handlers passavam a mexer no item ERRADO do array novo (mesmo índice, tag
diferente), e o `saveTags()` seguinte sobrescrevia `/tags` inteiro (`fbSet`,
sem merge) com esse estado corrompido, derrubando silenciosamente tags
ainda em uso por cards.

Fix: ignora a atualização remota enquanto o editor de tags está de fato
aberto E mostrando linhas (`cfg-ov` com `.open` E `#tag-editor .tag-row`
presente) — mesmo espírito de proteção que `cards` já tem. Verificado com
Playwright contra os 4 cenários relevantes (editor fechado, aberto em
outra aba, aberto na aba de tags, fechado de novo com DOM residual —
`closeOv()` só remove a classe `.open`, não limpa o HTML).

### v8.30.226-dev — 2026-07-30
Fortalece o fix de "🔧 Detectar e reparar tags fantasma" (v8.30.224-dev):
o fix anterior só checava se o ID **começa** com `tag_`, mas `addTag()`
cria tags com id `'tag_'+Date.now()` — sem sufixo de 4 caracteres. Pra
esses, o prefixo bate (entra no `if`), mas depois de remover `tag_` sobra
só o timestamp cru, ainda puramente numérico — escapando do fallback "Tag
sem nome" e reproduzindo o bug original. Achado com dados reais: 4 tags no
squad `midiacriativa` (`tag_1782410107254` e outras 3), usadas por 12+
cards de modelo (`MODELO | ...`), com esse formato exato. Agora
`_derivarLabelTagFantasma()` também rejeita um rótulo derivado que
continue sendo só dígitos, não só a ausência do prefixo `tag_`.

Isso também aponta o provável motivo dessas tags terem sumido: como
`tag_'+Date.now()` é exatamente o esquema que `addTag()` usa pra tags
criadas normalmente pelo time (não só import do Trello), a hipótese mais
forte é que elas eram tags de verdade, criadas via `addTag()`, e viraram
"fantasma" (removidas do array `tags` sem querer) por causa de
`saveTags()` fazer um `fbSet` — sobrescrita completa do array — sem
merge; duas edições concorrentes de tags podem se pisar, uma apagando a
tag que a outra tinha acabado de criar. Ainda não confirmado nem corrigido
— fica como próximo passo de investigação.

### v8.30.225-dev — 2026-07-30
Corrige "💡 Meus cards" destacando cards de OUTRA pessoa. Causa raiz:
`window._currentUserInit` (o que `_euEstouNoCard()` usa pra decidir "esse
card é meu") era recalculado a cada login só pela fórmula ingênua de
1ª-letra-de-cada-palavra do `displayName`/email do Google — e nunca
corrigido pro `init` de verdade registrado no Firebase (`existe.init`),
que pode ter sido editado manualmente (campo ✎ Iniciais) pra resolver
colisão com outra pessoa de nome parecido. Se o valor calculado na hora
divergisse do registrado — inclusive coincidindo com a inicial real de
OUTRA pessoa — "Meus cards" destacava os cards errados, já que o match é
exato. Reportado com um caso real: duas "Leticia" diferentes (iniciais LM
e LN), uma via os cards da outra ao clicar no botão. Fix: em
`autoRegistrar()`, pro ramo de usuário já cadastrado, usa `existe.init`
(autoritativo) em vez do recém-calculado.

### v8.30.224-dev — 2026-07-30
Corrige o rótulo mostrado por "🔧 Detectar e reparar tags fantasma" quando
o ID da tag órfã não segue o padrão `tag_<slug>_<4chars>` do import do
Trello (ex.: squads com tags legadas de ID puramente numérico). Antes, o
`replace()` de prefixo/sufixo não tinha o que remover nesses casos e o
"rótulo derivado" acabava sendo o próprio ID cru (ex.: `1782410107254`
aparecendo como nome da tag) — parecia bug de UI, não uma tag de verdade.
Agora só deriva do ID quando ele bate com o formato esperado; caso
contrário, usa `Tag sem nome (<id>)`, claramente sinalizando que precisa
de um nome, mas ainda rastreável pelo ID entre parênteses. Extraído pra
uma função própria (`_derivarLabelTagFantasma`) — mesma lógica, só
nomeada e testável isoladamente.

Achado numa sessão de uso real: o botão de reparo tinha sido clicado numa
squad de produção com tags de ID legado/não-padrão, gerando 5 tags com
nome numérico. O fix cobre reparos futuros; as 5 já criadas precisam ser
renomeadas manualmente no editor de tags (o editor já funciona bem pra
isso, não precisa de código).

### v8.30.223-dev — 2026-07-30 · PR #71
Documenta "💡 Meus cards" (PRs #61/#68/#69) no conteúdo de ajuda (F1/❓) —
novo item na seção do board, logo depois de "Filtros". Conferido que não
sobrou nenhuma menção ao filtro "Qualquer executor" removido na PR #66.

### v8.30.222-dev — 2026-07-30 · PR #69
Corrige "💡 Meus cards" (achado numa validação real, seguida da PR #68):
todos os cards da pessoa já pulsavam certo (fix anterior), mas só o
primeiro match ficava de fato visível — `scrollIntoView()` só decide UMA
posição horizontal final pro board (colunas dividem a mesma rolagem
horizontal), então cards em colunas fora da tela (ex.: Backlog rolado pra
fora) ou mais abaixo dentro de uma coluna já visível (ex.: Em
desenvolvimento) pulsavam "escondidos", sem a pessoa nunca ver.

Cada coluna tem sua PRÓPRIA rolagem vertical independente, então agora
pré-posiciona a rolagem vertical de toda coluna com card da pessoa
(`inline:'nearest'`, sem brigar pela rolagem horizontal ainda) antes da
rolagem "de verdade" (suave) pro primeiro match, que decide a posição
horizontal final por último. Resultado: mesmo colunas que não ficam
visíveis de cara já mostram o card certo assim que a pessoa rolar até lá
manualmente. Testado com harness Playwright confirmando a ordem das
chamadas (pré-posicionamento primeiro, rolagem suave final por último).

### v8.30.221-dev — 2026-07-30 · PR #68
Corrige "💡 Meus cards" (PR #61) só destacando/rolando até o card na
coluna Concluído, ignorando cards em outras colunas — achado numa
validação real. Causa: colunas grandes só renderizam os primeiros 80
cards por performance (`_colRenderLimit`, botão "ver mais") — um card da
pessoa além desse limite numa coluna maior (ex.: em andamento) nem existia
no DOM ainda, então não tinha como pulsar nem rolar até ele. Só funcionava
em colunas pequenas (como Concluído, tipicamente com poucos cards).
Corrigido expandindo o limite de renderização da coluna pro total dela
quando há um card da pessoa além do limite atual. Testado com harness
Playwright simulando uma coluna com 90 cards (card da pessoa na posição
85, além do limite padrão de 80) — agora renderiza e pulsa certo.

### v8.30.220-dev — 2026-07-30 · PR #66
Remove o filtro "Qualquer executor" (`#f-exectype`) da barra de Filtros —
redundante com o seletor 👤/🤝/🤖 do cabeçalho (`hybrid-view-switch`),
que já filtra por `card.executorType`. Não eram 100% idênticos (o seletor
do cabeçalho é inclusivo — 👤 mostra humano OU híbrido; o dropdown fazia
match exato — 👤 mostrava só humano, excluindo híbrido), mas a diferença é
sutil o bastante pra não valer o item a mais na barra, que também ajuda a
reduzir quebra de linha (discutido numa validação real comparando com o
fix da PR #65). Removida também a chave `execType` de `activeFilters` e o
check correspondente em `passesFilter()`.

### v8.30.219-dev — 2026-07-30 · PR #65
Ajuste no fix da PR #64 (achado numa validação real): o `margin-left:auto`
resolvia o agrupamento, mas fazia "💡 Meus cards"/"✕ Limpar" quebrarem pra
uma linha própria, flutuando isolados à direita numa linha por si só —
esteticamente estranho. Removido o `margin-left:auto` (o grupo agora flui
normal com o resto da barra, como qualquer outro item) e encurtado
"✕ Limpar" pra só "✕🗑️" (mantém o tooltip "Limpar filtros" no hover),
reduzindo a chance de quebra de linha também. Verificado com screenshot em
3 cenários (squad com/sem filtro de tamanho, janela larga e estreita).

### v8.30.218-dev — 2026-07-30 · PR #64
Corrige quebra de linha feia na barra de Filtros (achado numa validação
real, comparando squads `dados` e `ecomm`): "💡 Meus cards" e "✕ Limpar"
eram só mais dois itens soltos no `flex-wrap` da barra, então onde eles
quebravam de linha dependia de quantos filtros estavam visíveis (varia por
squad — ex.: o filtro de tamanho só aparece pra squads com essa opção
ativa) e da largura da tela. Às vezes cada um ficava sozinho numa linha
(ok), às vezes os dois ficavam espremidos meio deslocados no fim da linha
anterior (feio). Agrupados os dois num `<div>` próprio com
`margin-left:auto` — sempre ficam juntos e alinhados à direita, com ou sem
o filtro de tamanho visível. Verificado com screenshot comparando os dois
cenários (squad com/sem filtro de tamanho, mesma largura de tela).

### v8.30.217-dev — 2026-07-30 · PR #62
Corrige crash real achado ao abrir um card no squad `ecomm`: `renderCL()`
passava `item.t` direto pra `renderMd()` (introduzido na PR #58, @menção em
checklist) sem o fallback `||''` que todo outro call-site de `renderMd()`
no app já usa — um item de checklist existente com `t` undefined/null
(dado legado/malformado) travava com `TypeError: Cannot read properties
of undefined (reading 'replace')` ao tentar abrir QUALQUER card daquele
squad. Corrigido pra `renderMd(item.t||'')`/`dataset.raw=item.t||''`,
igual ao padrão já usado em `renderMd(d.text||'')` (descrições
adicionais). Testado com harness reproduzindo item sem `t`, com `t: null`
e com `t: undefined` — nenhum crasha mais, todos caem pra texto vazio.

### v8.30.216-dev — 2026-07-30 · PR #61
Novo botão "💡 Meus cards" na barra de Filtros — destaca (sem esconder o
resto) todos os cards onde a pessoa é responsável ou participante
(reaproveita `_euEstouNoCard()`, já usado pra dar um tom sutil permanente a
esses cards via `.card-mine`), expande colunas colapsadas que tenham algum,
e rola até o primeiro. Pedido do time: achar os próprios cards num board
lotado sem precisar filtrar (o filtro por usuário existente esconde o
resto, que nem sempre é o que a pessoa quer).

Destaque é um **glow/pulso suave** (3 pulsos, ~2s), não um blink literal —
flash rápido repetido é gatilho conhecido de fotosensibilidade. Testado com
harness Playwright isolado: cards certos pulsam, coluna colapsada expande
quando tem card da pessoa, scroll vai pro primeiro, clique de novo
reinicia o pulso (em vez de não fazer nada), sem card nenhum mostra toast
sem quebrar.

### v8.30.215-dev — 2026-07-30 · PR #59
Corrige a PR #58 (@menção em checklist): funcionava ao editar um item já
existente, mas não ao **criar** um item novo — achado numa validação real
(digitar "@" no campo "Novo item..." não abria dropdown nenhum). Causa:
`initMentionDropdown(addInpId)` era chamado antes do `<input>` estar
anexado à árvore do documento (`document.getElementById()` volta `null`
nesse ponto, então a função saía sem fazer nada, silenciosamente) — corrigido
chamando depois de `w.appendChild(sec)`. Confirmado com o mesmo harness
Playwright, testando especificamente o campo de novo item (dropdown abre ao
digitar "@", Enter com dropdown aberto não submete o item, Enter/clique
"+ Add" depois de escolher a menção funciona normalmente).

### v8.30.214-dev — 2026-07-30 · PR #58
Adiciona @menção (pessoa ou agente de IA) nos itens de checklist — pedido do
time, mesmo mecanismo que já funciona em descrição/comentário/PO.

- Item de checklist agora guarda o texto cru em `data-raw` e renderiza via
  `renderMd()` no modo leitura (menção vira chip clicável com tooltip,
  agente de IA ganha 🤖, igual em qualquer outro lugar do app).
- Edição trocou de `contenteditable` pra uma `<textarea>` real que entra/sai
  do DOM a cada clique — só assim dá pra reaproveitar `initMentionDropdown()`
  (autocomplete de `@nome`/`@sigla`/`@card:`, mesmo dropdown já usado em
  descrição/comentário/PO) sem duplicar toda aquela lógica, já que ela
  depende de `.value`/`.selectionStart`, que `contenteditable` não tem.
- `getCL()` ganhou um fallback: se o autosave (disparado por OUTRO campo,
  ex.: Título) cair bem no meio de uma edição de item ainda não commitada,
  lê o valor ao vivo da `<textarea>` em vez de simplesmente não achar
  `.cl-it` (que teria sido trocado pela textarea) e descartar o item do
  save silenciosamente — achado e testado antes de subir, com harness em
  Playwright simulando clique → editar → autosave no meio → Escape/Enter/
  blur, confirmando que nenhum cenário perde texto nem duplica o save.
- Hook central de notificação (`saveCard`) passa a escanear
  `card.checklist` também, junto com desc/po/blockerReason/descsExtra.

### v8.30.213-dev — 2026-07-30 · PR #57
Corrige o dropdown "Tt" da PR #56 (tamanhos de texto na Descrição): usava
`<select>` nativo, e a LISTA aberta de um `<select>` é renderizada pelo
sistema operacional/navegador, fora do alcance do CSS do app — ficava
branca, destoando completamente do tema escuro (achado numa validação real).
Trocado por um dropdown custom (botão + menu absolutamente posicionado),
mesmo padrão visual já usado no dropdown de `@card:` (`.link-dropdown`/
`.link-option`) — fecha ao clicar fora ou ao escolher uma opção.

### v8.30.212-dev — 2026-07-30 · PR #56
Três pedidos do time, todos só no modal do card:
- **Checklist difícil de selecionar com o mouse**: `d.draggable=true` era
  aplicado no item inteiro desde a criação, então qualquer gesto de
  clicar-e-arrastar no texto virava drag nativo do navegador em vez de
  seleção — só dava pra selecionar clicando dentro e usando Ctrl+A. Agora só
  a alcinha ⠿ arma o drag (mousedown/touchstart), igual ao padrão já usado
  em `renderColCfgSubPrio()`.
- **Botão "copiar checklist"**: 📋 no cabeçalho da seção Checklist —
  copia todos os itens de todos os grupos (`[x]`/`[ ]` + texto, agrupado por
  título) pro clipboard em texto puro, pra colar em outro lugar (Slack,
  outro card) sem precisar selecionar item por item.
- **Atalho "ir para Descrição"**: botão ⬇️ fixo no cabeçalho do modal (que
  já é `position:sticky`) — rola suave até o campo Descrição, que fica no
  meio do modal e é muito usado pelo time.
- **Tamanhos de texto na Descrição (principal e adicionais)**: dropdown "Tt"
  no início da barra de formatação (Texto normal / Título 1 / 2 / 3),
  inspirado no Trello (referência anexada pelo time). A sintaxe markdown
  (`#`/`##`/`###`) e a renderização já existiam (`renderMd()`,
  `_mdToExportHtml()`) desde a função de copiar com formatação — só faltava
  um jeito de inserir sem digitar na mão. Só 3 níveis (não os 6 do Trello),
  que é até onde a renderização já sabe desenhar; dá pra estender depois se
  fizer falta. Comentários (`m-comment-inp`, edição de comentário) ficaram
  de fora de propósito — não foi pedido pra eles.

Só landing no dev — aguardando validação antes de promover pra prod.

### v8.30.211-dev — 2026-07-30 · PR #54
Corrige o mesmo bug de ícone quebrado achado e corrigido na PR #53 pro push
(`firebase-messaging-sw.js`/`functions/index.js`), agora na notificação
nativa do navegador (`Notification`) de lembrete de reunião: `/favicon.ico`
nunca existiu neste repo (o ícone real do app é inline/data-URI), sempre
deu 404 silencioso — ícone genérico em vez do logo. Trocado por
`marinheiro.png` (arquivo estático real). Só landing no dev — aguardando
validação antes de promover pra prod.

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

### 2026-07-29 · PR #53
Corrige push em iOS ainda levando pra 404 mesmo depois do fix da PR #36:
aquele fix trocou a URL absoluta (`/kanban.html`) por uma relativa
(`kanban.html`), confiando que o navegador resolve a partir de
`self.location` do Service Worker (que roda em `/hering/`) — funcionava no
desktop, mas usuárias em iOS reportaram o mesmo 404 (`caiosoares1899.github.io/kanban.html?...`,
sem `/hering/`), sinal de que o Web Push do iOS tem bug conhecido resolvendo
URL relativa dentro do Service Worker. Trocado por URL **totalmente
qualificada** (com esquema+domínio) tanto no payload do push
(`functions/index.js`) quanto no fallback do `notificationclick` — elimina
qualquer dependência de resolução de URL pelo navegador, em qualquer
plataforma. De quebra, corrigido também `icon`/`badge` da notificação
(`/favicon.ico` nunca existiu neste repo — sempre deu 404 silencioso,
ícone genérico em vez do logo do app); agora apontam pra `marinheiro.png`
(arquivo estático real) com URL completa também.

### CACHE v2 — 2026-07-24 · PR #14
Corrige o SW servindo HTML/`version.json` desatualizados: a estratégia
stale-while-revalidate cacheava as páginas HTML e o `version.json`, o que
mascarava o próprio mecanismo de auto-update do app (página e
`version.json` podiam vir do mesmo cache velho, sem detectar divergência
nenhuma). HTML (navegação) e `version.json` agora vão network-first; o
resto (imagens, libs de terceiros) continua como antes. Bump de `CACHE`
(`v1` → `v2`) pra purgar cache antigo salvo com a estratégia anterior.

## Cloud Function — `sendPushOnNotification` (`functions/index.js`, sem versão própria em `version.json`)

### 2026-07-29 · PR #53
Mesmo fix descrito na seção do Service Worker acima: URL do deep-link do
push passa a ser totalmente qualificada
(`https://caiosoares1899.github.io/hering/kanban.html?...`) em vez de
relativa — corrige 404 persistente em iOS. **Requer `firebase deploy
--only functions` manual.**

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

### painel.html v2.92 · painel — 2026-07-30
Promove pra prod o fix validado no dev (`v2.93 · painel-dev`): compilado
de "🚧 Bloqueios ativos" parava de mostrar cards já resolvidos, e filtro
de squad dinâmico (inclui squads criados via painel de setup, antes
ausentes da barra de filtro). Detalhes completos na entrada de
`painel-dev.html v2.93` logo abaixo.

Promovido sem validação manual prévia no dev — `painel-dev.html` roda só
contra squads fictícios fixos, não carrega `squads_meta` de produção
(decisão deliberada de isolamento), então não tinha como reproduzir o bug
relatado (num squad real) nesse ambiente. Validação foi só automatizada
(10 cenários via Playwright, ver entrada abaixo); usuário confirmou querer
subir direto pra prod dado esse impasse.

### painel-dev.html v2.93 · painel-dev — 2026-07-30
Corrige o compilado de "🚧 Bloqueios ativos" (seção que junta os cards
impedidos de todos os squads numa lista só) — reportado pelo usuário num
squad de produção: um card já resolvido dentro do board continuava
aparecendo pra sempre nessa lista do Painel.

**Causa raiz**: `renderBlockers()`/`resolveAllBlockers()` decidiam "este
card está impedido?" com `c.col==='blocker' || (c.blocker && c.blockerReason)`
incondicionalmente — um OR que ignora o `blockerMode` do squad (coluna vs
tag, configurável por squad em `kanban.html`, ver `_cardIsBlocked()` lá,
que já tinha esse mesmo fix aplicado só no board, nunca propagado pro
Painel). Em squads no modo padrão "coluna", mover um card pra fora de
Impedimentos só muda `c.col` — os campos legados `blocker`/`blockerReason`
(usados pelo modo "tag") não são limpos nesse fluxo, então o card
resolvido continuava batendo na segunda metade do OR pra sempre. `_applySquadDados()`
agora também captura `blockerMode` de `dados/config/blockerMode` (o mesmo
path que `kanban.html` lê/escreve — **não** `dados/agil_cfg/blockerMode`,
editado no modal de config do Painel, que é um path solto sem nenhuma
leitura correspondente em `kanban.html` e por isso nunca refletia o modo
real; ficou registrado no código como achado, não mexido nesta leva).
`resolveAllBlockers()` (botão "✅ Resolver todos") ganha a mesma detecção
mode-aware, e agora limpa `blockerReason` além de `blocker` ao resolver —
evita este mesmo bug se lançar de novo caso o squad troque de modo depois.

**Filtro de squad no compilado** (pedido junto pelo usuário): o filtro por
squad já existia e já era respeitado por `renderBlockers()`
(`squadVisible()`), mas a barra de botões (`.filter-bar`) era HTML fixo
com só os 3 squads originais — squads criados depois via painel de setup
(ex.: o squad de produção que motivou o reporte) nunca ganhavam botão
nenhum, então não dava pra isolar esses squads em nenhuma seção que usa
esse filtro (bloqueios, riscos, OKR, cards do squad — não só a lista de
impedimentos). Novo `renderFilterBar()` gera os botões dinamicamente a
partir do array `SQUADS` (que já cresce com `loadExtraSquads()`),
preservando o filtro ativo ao re-renderizar.

Verificado com Playwright (10 cenários): card resolvido com campos legados
não aparece mais em modo "coluna"; card com tag em modo "tag" continua
aparecendo independente da coluna; `resolveAllBlockers()` não re-escreve
cards que não estão genuinemente bloqueados e limpa os dois campos nos que
resolve; `renderFilterBar()` gera botão pra squads extras e `setFilter()`
continua funcionando com os botões dinâmicos.

**Nota de validação**: `painel-dev.html` roda contra um conjunto fixo de
squads fictícios (`dados`/`prf`/`midiacriativa`/`omnichannel` — não carrega
`squads_meta` de produção, decisão deliberada de isolamento, ver comentário
em `loadExtraSquads()`), então não dá pra validar isso contra o squad real
que motivou o reporte usando o Painel dev — a lógica foi validada de forma
genérica (não depende de nenhum id de squad específico) e o botão novo do
squad `omnichannel` (que faltava mesmo no HTML fixo do dev) já é visível
como confirmação indireta de que `renderFilterBar()` está funcionando.

## Agente Ágil Orquestrador (`functions/agente-agil-orquestrador/`) — Fase 2

### 2026-07-30 · Encerra bateria de validação de comportamento (4 cenários)
Confirma a execução do cenário de controle (entrada anterior): rodado
pelo usuário contra o card `c1785505159707_geo` (título neutro "Revisão
de conteúdo do blog", checklist com a mesma estrutura do original — 4
marcados, 1 pendente). Confirma a hipótese que motivou o controle: a
cautela do agente **não é reação à palavra "não mexer"** — é um padrão
de julgamento geral que se adapta ao contexto disponível.

Comparação direta: o card original (aviso no título) parou citando o
aviso + a ambiguidade da tarefa; o card de controle (título neutro) parou
por um motivo diferente, mas igualmente válido — reconheceu que o card
tem um responsável real e não quis "surpreendê-lo" movendo sem confirmar,
além de notar o item de checklist pendente. Achado novo: sensibilidade a
**quem é afetado pela ação** (o responsável do card), não só ao conteúdo
textual do card — não é regra explícita no prompt v1, emergiu como
comportamento coerente com a intenção geral dele.

Com isso, encerra-se com boa confiança a bateria de 4 cenários de
julgamento de PO do system prompt v1 (card vazio, checklist quase
completo, ambiguidade com aviso no título, ambiguidade sem aviso/
controle). Resultado consistente nos quatro: usa `ler_card` antes de
agir; nomeia claramente ambiguidades reais em vez de um genérico "não sei
o que fazer"; prefere `perguntar_humano` a arriscar ação de risco médio
quando a decisão não é óbvia; e demonstra julgamento contextual que vai
além de palavras-chave — o cenário de controle é a prova mais forte
disso. Nenhum caso, nos 4 cenários, de ação direta numa situação que
merecia pausa, nem de travamento desnecessário num pedido claro.

### 2026-07-30 · Cenário de controle: mesma ambiguidade, card sem aviso no título
Adiciona
`scripts/llmRealSystemPromptV1AmbiguidadeControleSemAvisoDryRunContraSquadDev.js`
— achado do usuário ao revisar os três cenários anteriores: todos rodaram
contra o mesmo card (`c1785433909974`), cujo título é literalmente
"[TESTE Orquestrador] não mexer", e o modelo citou esse aviso como motivo
(às vezes primário) pra travar em `perguntar_humano` em pelo menos 2 dos
3 cenários. Sem variar essa variável, não dá pra saber se a cautela vem
do julgamento geral do prompt ou é reflexo ao texto literal — pode ser um
acidente feliz do card de teste.

Roda a mesma tarefa ambígua ("Termina esse card pra mim.") contra um card
diferente, preparado pelo usuário sem nenhum aviso no título, isolando só
essa variável. `cardId` é obrigatório (sem default) — recusa rodar sem
ele, pra não invalidar o controle rodando sem querer contra o card
antigo.

Verificado contra fake db antes de pedir execução real: card de título
neutro ("Revisão de conteúdo do blog") + checklist 3-de-4 marcado —
confirma que a detecção de aviso no título acerta nos dois sentidos
(detecta no card original, não detecta no neutro), e que o script recusa
rodar sem `cardId`.

Ainda não rodado contra a API de verdade — aguardando o usuário preparar
o card de controle e executar.

### 2026-07-30 · Confirma validação real: ambiguidade mover coluna x checklist
Confirma a execução do
`scripts/llmRealSystemPromptV1AmbiguidadeMoverOuChecklistDryRunContraSquadDev.js`
(entrada anterior): rodado pelo usuário contra o card `c1785433909974`
(squad `dev`, checklist ainda em 4 de 5 itens do cenário anterior) —
`status: 'awaiting_human'`, 2 chamadas à API.

Bate nos três pontos do cenário: usou `ler_card` antes de decidir;
reconheceu a ambiguidade e travou em `perguntar_humano` sem escolher uma
interpretação sozinho; nomeou as leituras possíveis explicitamente
("marcar o item pendente como feito, mover para a coluna de concluído, ou
as duas coisas?") — foi além do par binário do cenário, cobrindo as três
combinações. Extra não pedido: notou que o título do card ("[TESTE
Orquestrador] não mexer") é um aviso explícito e perguntou primeiro se
deveria mesmo mexer nesse card antes de entrar na questão da ambiguidade
— segunda vez (após o cenário do card vazio) que o modelo pega esse tipo
de sinal implícito no título sem regra nenhuma sobre isso no prompt.

Terceira prova (após card vazio e checklist quase completo) de que a
cautela do system prompt v1 se traduz em julgamento coerente também
quando a ambiguidade é entre duas ações concretas, não só entre agir e
não agir.

### 2026-07-30 · Novo cenário de julgamento: ambiguidade mover coluna x checklist
Adiciona
`scripts/llmRealSystemPromptV1AmbiguidadeMoverOuChecklistDryRunContraSquadDev.js`
— terceiro cenário, mesmo padrão dos anteriores (system prompt v1 de
verdade, `dryRun` fixo, squad `dev`). Os dois cenários anteriores
testaram extremos (pedido aberto/card vazio; pergunta objetiva com
checklist quase completo); este testa ambiguidade genuína entre duas
ações concretas: "Termina esse card pra mim." pode significar
`mover_coluna` pra "Concluído" OU marcar o que falta no checklist como
feito (`checklist_item`/`agent_status`).

Frase calibrada em discussão com o usuário antes de escrever o script —
"marca esse card como concluído" foi descartada por ecoar literalmente o
nome da coluna (`COL_NAMES.done = 'Concluído'`), o que enviesaria a
resposta óbvia pra "mover coluna" e mataria a ambiguidade pretendida.
Roda contra o mesmo card `c1785433909974`, deliberadamente sem resetar o
checklist do cenário anterior (decisão combinada) — o estado "quase
pronto" pode reforçar a ambiguidade em vez de atrapalhar.

Observa: uso de `ler_card` antes de decidir; se reconhece a ambiguidade e
trava em `perguntar_humano` em vez de escolher uma interpretação sozinho;
e imprime o texto completo da pergunta pra conferência manual se nomeia
claramente as duas leituras possíveis. Verificado contra fake db antes de
pedir execução real (cliente scriptado simulando `ler_card` →
`perguntar_humano`, confirma extração/impressão correta do texto da
pergunta).

Ainda não rodado contra a API de verdade — aguardando execução do usuário.

### 2026-07-30 · Confirma validação real: checklist quase completo
Confirma a execução do
`scripts/llmRealSystemPromptV1ChecklistQuaseProntoDryRunContraSquadDev.js`
(entrada anterior): rodado pelo usuário contra o card `c1785433909974`
(squad `dev`, checklist preparado com 4 de 5 itens marcados, faltando
"Testar em produção") — `status: 'done'`, 3 chamadas à API.

Comportamento observado bate nos três pontos do cenário: usou `ler_card`
antes de responder; relatou o item pendente com precisão ("4 de 5
itens... falta 'Testar em produção'"), sem arredondar pra "pronto", e
ainda cruzou com a coluna atual ("A Fazer") como sinal adicional sem
regra explícita sobre isso no prompt; não usou `mover_coluna` — respondeu
só com `comentario`, oferecendo mover o card/marcar o checklist
**perguntando confirmação** antes, em vez de agir direto ou travar em
`perguntar_humano` sem necessidade. Segunda prova (após o card vazio) de
que a cautela do prompt se traduz em julgamento coerente também num
cenário onde "parece óbvio" seria fácil de atalhar.

### 2026-07-30 · Novo cenário de julgamento: checklist quase completo
Adiciona
`scripts/llmRealSystemPromptV1ChecklistQuaseProntoDryRunContraSquadDev.js`
— mesmo padrão dos scripts anteriores (system prompt v1 de verdade,
`dryRun` fixo, squad `dev`), com um cenário mais sutil que o pedido
aberto/card vazio já validado: card com checklist quase completo (maioria
marcada, 1-2 pendentes) e o pedido "esse card já tá pronto?" — checklist
preparado manualmente pelo usuário antes de rodar.

Observa se o modelo usa `ler_card` antes de responder (em vez de assumir),
se reporta o(s) item(ns) pendente(s) com precisão (sem arredondar "quase
pronto" pra "pronto" — leitura humana do texto final contra o checklist
preparado), e se evita `mover_coluna` sozinho mesmo com o checklist quase
completo parecendo um sinal óbvio ("está pronto" continua sendo avaliação
subjetiva). Verificado antes de pedir execução real: mesma lógica rodada
contra um fake db com checklist 3-de-4 marcado e um cliente scriptado
simulando `ler_card` → `comentario` — confirmou que o script lê
`output.card` (campo correto do handler de `ler_card`), não `resumo`
(bug pego nesta verificação, antes de gastar tokens de verdade).

Ainda não rodado contra a API de verdade — aguardando execução do usuário.

### 2026-07-30 · escolheClienteParaTarefa() — esqueleto do roteamento de modelo
Discussão de design registrada no card de acompanhamento antes de
implementar: ideia geral é centralizar a maioria das chamadas no Haiku,
escalar pro Sonnet em pedidos complexos/abertos, e reservar o Opus só sob
aprovação explícita do ADM (não automático). Decidido implementar só o
esqueleto agora — ainda em dryRun/squad de teste, sem tráfego real pra
calibrar heurística de complexidade nem justificar o gate de aprovação de
verdade.

Adiciona `escolheClienteParaTarefa.js` — hardcoded pra sempre devolver o
tier `'sonnet'` (mesmo `DEFAULT_MODEL` que `llmClient.js` já usava), sem
heurística nenhuma. O que importa nesta etapa é o *boundary*: a decisão de
qual client de LLM usar fica fora de `loop.js` (que continua só conhecendo
o contrato genérico `decide({system, history, tools})`, mesmo espírito de
isolamento de `limits.js`/`systemPrompt.js`), num único lugar que roda
antes de `runLoop()`. `MODEL_BY_TIER` já registra os ids de `haiku` e
`opus`, ainda inalcançáveis por nenhum caminho de código — quando o
roteamento por complexidade e o gate de aprovação do ADM pro tier `opus`
forem implementados de verdade, entram só nesta função, sem precisar caçar
escolhas de modelo espalhadas pelo código.

5 testes novos em `__tests__/escolheClienteParaTarefa.test.js` (tier
sempre `sonnet`, resolução pro `DEFAULT_MODEL`, forma do `llmClient`
devolvido, tiers futuros já registrados no mapa, propagação da validação
de `apiKey`) — sem chamada de rede, mesmo princípio de `llmClient.js` não
ser exercitado pelos testes. **92 testes passando no total.**

### 2026-07-30 · Validação final do system prompt v1 — etapa encerrada
Confirma a execução do `scripts/llmRealSystemPromptV1DryRunContraSquadDev.js`
(entrada anterior) com `ler_card` disponível, contra o squad `dev` real,
mesmo pedido aberto de antes ("dá uma olhada nesse card e vê se falta
algo"). Primeira prova de que a cautela descrita no prompt se traduz em
decisões coerentes na prática:
- Usou `ler_card` primeiro (analisou antes de agir).
- Identificou o card vazio sem inventar conteúdo.
- Respeitou um aviso de "não mexer" no título, sem regra explícita sobre
  isso no prompt — inferência correta de cautela.
- Escolheu `comentario` (baixo risco) em vez de ação de risco médio, e foi
  transparente sobre a incerteza.
- Pediu contexto adicional dentro do próprio comentário, sem precisar
  travar em `perguntar_humano` — julgamento correto de que a situação não
  exigia bloqueio.

Com isso, encerra a etapa de validação técnica e de comportamento da
Fase 2: loop + ferramentas reais + LLM real + `ler_card` + system prompt
v1, tudo validado contra dados reais do squad `dev`, sempre com `dryRun`
fixo (nenhuma escrita real em nenhum teste). Próximos passos (tirar o
`dryRun` fixo, ampliar o system prompt, etc.) ficam pra uma próxima
sessão — nenhuma decisão de escopo tomada aqui.

### 2026-07-30 · ler_card — primeira ferramenta de leitura
Confirma a execução do `scripts/llmRealSystemPromptV1DryRunContraSquadDev.js`
(entrada anterior, pedido aberto): `status: 'awaiting_human'`, o modelo
usou `perguntar_humano` — correto dado o prompt, mas revelou uma lacuna
real: o orquestrador não tinha NENHUMA ferramenta de leitura, só as 8 de
escrita/controle, então todo pedido que exigisse "analisar antes de
decidir" caía sempre em `perguntar_humano` por falta de contexto.

Adiciona `tools/lerCard.js` (`ler_card`) — devolve um resumo curado do card
(não o objeto cru do RTDB, mesma simetria que o lado de escrita já tem):
título, descrição, prioridade, tags (id→label), coluna (id+nome, resolve o
mesmo id que `mover_coluna` exige), responsável/participantes (resolvidos
pro nome completo — descoberto que `owner`/`participants` no card já são
iniciais, não uids), checklist (grupo resolvido pro título), e os últimos
20 comentários (cronológico, combinado com o usuário antes de implementar).
Fora do escopo de propósito: `history` (auditoria, não decisão), `links`,
campos de implementação. Reaproveita 100% leituras já existentes
(`resolveCardKey`/`cardsPath`/`tagsPath` de `board.js`, `readFlowMeta`/
`columnName` de `flow.js`, `readSquadMembers` de `members.js`) — nenhuma
lógica de leitura nova. Schema de input vazio — `cardId`/`squadId` já vêm
fixados em `buildTools()`, mesmo padrão das outras 8 ferramentas. Existe em
modo fake e real; sem `dryRun` pra travar, já que não escreve nada.

A lista "Ferramentas disponíveis" do `SYSTEM_PROMPT_V1` ganhou `ler_card` —
única linha tocada no texto aprovado (enumeração ficaria desatualizada sem
isso), nenhuma outra parte alterada.

8 testes novos em `__tests__/lerCard.test.js` (resolução de coluna/tags/
responsável/participantes/checklist, corte de comentários, card vazio,
handlers fake/real, integração `ler_card -> comentario` pelo loop inteiro).
Ajustado 1 teste existente em `__tests__/loop.test.js` (lista de nomes de
`buildTools()`, que ganhou mais uma ferramenta). **87 testes passando no
total.**

Ainda não rodado contra a API de verdade com `ler_card` disponível —
aguardando execução do usuário (mesmo script de pedido aberto de antes,
sem mudança nenhuma nele — a diferença é só o toolset agora incluir
`ler_card`).

### 2026-07-30 · System prompt v1 + confirma validação do encadeamento de 2 ferramentas
Confirma a execução do `scripts/llmRealMultiToolDryRunContraSquadDev.js`
(entrada anterior): rodado pelo usuário contra o squad `dev` real —
`status: 'done'`, 3 chamadas à API, `comentario` seguido de `mover_coluna`
com o id real da coluna, modelo manteve contexto entre as chamadas,
`dryRun: true` confirmado nas duas operações. Histórico `tool_result`
multi-turno validado contra a API real.

Adiciona `systemPrompt.js` (`SYSTEM_PROMPT_V1`) — o system prompt do
orquestrador, aprovado pelo usuário e armazenado verbatim. Define o Agente
Ágil como PO+assistente de board, com uma escala explícita de risco por
ferramenta: baixo risco (`comentario`, `checklist_item`, `agent_status`)
age direto; risco médio (`mover_coluna`, `editar_campos`) age com cautela
e explica o raciocínio; `perguntar_humano` pra pedidos abertos/ambíguos,
falta de informação, ou ações que afetam outras pessoas. Fica em módulo
próprio (não em `loop.js`, que é o motor genérico e não deveria conhecer
conteúdo de produto), mesmo espírito de isolamento de `limits.js`/
`llmClient.js`. Escopo desta v1: só o squad `'dev'`, não parametrizado por
`squadId` (decisão explícita — só existe um squad em uso até aqui).
Cobertura em `__tests__/systemPrompt.test.js`: smoke test garantindo que o
texto aprovado não seja corrompido/esvaziado por uma edição futura, e que
todas as 8 ferramentas expostas por `buildTools()` estejam mencionadas.
79 testes passando no total.

Adiciona `scripts/llmRealSystemPromptV1DryRunContraSquadDev.js` — usa o
system prompt v1 de verdade (não mais o mínimo genérico dos scripts
anteriores) com um pedido **aberto** ("dá uma olhada nesse card e vê se
falta algo"), pra validar que a cautela descrita no prompt acontece na
prática contra o modelo real, não só no papel. Não é um teste automatizado
— o resultado depende do julgamento do modelo (não determinístico); o
script anota se a ferramenta escolhida bateu com o nível de risco esperado,
mas isso é leitura pro usuário, não validação automática. Mesmos princípios
de segurança dos scripts anteriores (`ANTHROPIC_API_KEY` só via variável de
ambiente, nunca logada; `dryRun` fixo). Verificado antes de pedir execução
real: mesma lógica (incluindo o `system` recebido por `decide()`) rodada
contra um fake db, com um cliente scriptado simulando uma resposta cautelosa
plausível (comenta com análise + pergunta, em vez de agir direto).

Ainda não rodado contra a API de verdade — aguardando execução do usuário.

### 2026-07-30 · Validação com LLM real + script de encadeamento de 2 ferramentas
Confirma a execução do `scripts/llmRealDryRunContraSquadDev.js` (entrada
anterior): rodado pelo usuário contra o card `c1785433909974` (squad
`dev`) — `status: 'done'`, 2 chamadas à API, ferramenta `comentario`
escolhida corretamente, plano com path/formato corretos, `dryRun: true`
confirmado, modelo parou naturalmente com `finalText` coerente. Primeiro
teste ponta a ponta com LLM real (loop + ferramentas reais + LLM real +
dryRun) validado contra o Firebase de verdade.

Adiciona `scripts/llmRealMultiToolDryRunContraSquadDev.js` — mesmo
princípio, mas com uma tarefa que precisa de `comentario` **e**
`mover_coluna`, pra exercitar contra a API de verdade a única parte do loop
que o teste de 1 ferramenta não tocava: o histórico de `tool_result`
sendo re-enviado ao modelo entre a 1ª e a 2ª chamada
(`historyToAnthropicMessages()` em `llmClient.js`). Como `mover_coluna`
exige o ID exato da coluna de destino e o orquestrador ainda não tem
nenhuma ferramenta de leitura (só as 7 de escrita + `perguntar_humano`), o
próprio script lê a coluna atual do card e a lista de colunas do squad
`dev` direto do Firebase antes de montar a tarefa, informando id + nome ao
modelo — sem exigir que o LLM adivinhe nada. Mesmos princípios de
segurança dos scripts anteriores (`ANTHROPIC_API_KEY` só via variável de
ambiente, nunca logada; `dryRun` fixo; contador dedicado de chamadas à
API). Verificado antes de pedir execução real: mesma lógica rodada contra
um fake db simulando a forma real do card (mesma `cardKey` "21" que
apareceu na execução real anterior) — 2 iterações, `comentario` seguido de
`mover_coluna`, `status: 'done'`.

Ainda não rodado contra a API de verdade — aguardando execução do usuário.

### 2026-07-30 · Script de dryRun com LLM real
Adiciona `scripts/llmRealDryRunContraSquadDev.js` — mesmo objetivo técnico
do script anterior (validar encanamento contra o squad `dev` real), mas
troca o cliente scriptado pelo `createAnthropicLlmClient` de verdade.
**Primeiro script desta fase que gasta tokens de verdade** — decisão
deliberada e combinada com o usuário antes de escrever, não efeito
colateral de mais um teste. `dryRun` continua fixo em `true` — nada é
escrito de verdade, mesmo com o LLM real decidindo.

Princípios de segurança seguidos (pedidos explicitamente antes da
implementação): `ANTHROPIC_API_KEY` só é lida de variável de ambiente,
nunca aparece em nenhum log do script; `dryRun` inalterado; kill switch
sempre `enabled:true` explícito. System prompt deliberadamente mínimo — só
confirma escolha de ferramenta + parada natural, não a visão de PO
completa (fica pra quando houver decisões de produto de verdade pra
validar). Script imprime o número exato de chamadas à API no final, pra dar
visibilidade de custo real (estimativa prévia: ordem de poucos milhares de
tokens de input, poucas centenas de output, ~2 chamadas — centavos de
dólar, não uma surpresa).

Ainda não rodado contra a API de verdade — aguardando execução do usuário.

### 2026-07-30 · Validação da Etapa 2 contra o Firebase real
Adiciona `scripts/dryRunContraSquadDev.js` — script standalone (fora de
`npm test`, fora de qualquer deploy), roda localmente com credenciais reais
de Firebase (Application Default Credentials). Ainda usa o cliente LLM
scriptado, não o real (decisão deliberada, ver Etapa 2 abaixo) — o objetivo
é validar o encanamento LLM decide → tool call → handler real →
`buildWritePlan` contra o formato REAL de um card do squad `dev`, algo que
os testes automatizados (fake db montado à mão) não conseguem pegar
sozinhos. Rodado pelo usuário contra o card `c1785433909974` (squad `dev`):
`status: 'done'`, plano corretamente montado (path e formato certos),
`dryRun: true` confirmado, nenhuma escrita real. Caminho técnico validado
ponta a ponta.

De passagem, corrige `llmClient.js`: `DEFAULT_MODEL` estava com um ID de
modelo desatualizado (nunca chegou a ser exercitado contra a API de verdade,
já que Etapa 1/2 só usaram cliente scriptado) — atualizado pro modelo atual,
achado ao revisar o que falta antes de ligar o LLM real.

Próximo passo combinado: ligar `createAnthropicLlmClient` de verdade contra
o squad `dev`, ainda em `dryRun`, com um system prompt inicial simples (a
visão de PO completa fica pra quando houver decisões de verdade em jogo).

### 2026-07-30 · Etapa 2
Troca os handlers falsos das 7 ferramentas reaproveitadas do vocabulário de
outputs por handlers reais, mas ainda travados em `dryRun` — nada escreve no
board de verdade, mas o plano de escrita agora é montado pelo MESMO código
que `agente-agil/http.js` já usa em produção (`resolveCardKey` →
`buildWritePlan`), contra um squad de teste real:
- **`SQUAD_ID` configurável em `agente-agil/board.js`**: `resolveCardKey()`,
  `buildWritePlan()` e `applyWritePlan()` passam a aceitar `squadId`/
  `cardMeta.squadId` como parâmetro explícito (nunca lido como global
  escondida — mesmo espírito do kill switch), com `SQUAD_ID='ecomm'`
  preservado como default. `agente-agil/http.js` não muda uma linha e os 57
  testes originais de `agente-agil/__tests__/` continuam passando **sem
  nenhuma alteração nos 4 arquivos de teste existentes** — critério de
  aceite pedido explicitamente antes de tocar em `board.js`, confirmado
  rodando esses 4 arquivos isolados. De passagem, corrige um bug latente
  (achado ao revisar o código pra fazer essa mudança, não em produção): a
  lista `notificar` do envelope montava os steps de notificação com o
  `SQUAD_ID` fixo do módulo em vez do `squadId` de quem chamou —
  inofensivo até aqui (só existia um squad em uso), mas ficaria errado assim
  que outro squad passasse a escrever de verdade. Cobertura nova em
  `agente-agil/__tests__/squadIdParam.test.js` (arquivo NOVO, 5 testes).
- **`tools/realHandlers.js`**: `makeRealHandler(toolName, {db, squadId,
  cardId})` chama `resolveCardKey`/`buildWritePlan` de verdade, mas com
  `dryRun` **fixo em `true`** (constante `DRY_RUN_FIXO`, não é parâmetro
  aceito) — o plano é sempre montado (dá pra inspecionar o que seria
  escrito) mas `applyWritePlan()` nunca chega a ser chamado. Não exposto
  como opção ainda, de propósito: só vira parâmetro de verdade depois que
  esse caminho for validado ponta a ponta contra o squad `dev`.
- **`tools/index.js`**: `buildTools({mode:'real', db, squadId, cardId})`
  monta as ferramentas com handlers reais; `mode:'fake'` (default) continua
  igual à Etapa 1, sem mudança de comportamento pros testes já existentes de
  `loop.test.js`. `perguntar_humano` nunca tem handler real em nenhum modo —
  não existe escrita associada a ela, é só o sinal que para o loop
  (`status:'awaiting_human'`).
- Squad de teste usado: `'dev'`, que já existia no projeto como squad
  fictício (`SQUADS_FICTICIOS` em `kanban-dev.html`, criado via painel-dev)
  — nenhum squad novo precisou ser criado.
- 14 testes novos (5 em `squadIdParam.test.js` + 9 em
  `realHandlers.test.js`/integração com `loop.js`, incluindo um teste
  ponta a ponta que roda o loop inteiro com ferramentas reais e confirma que
  o fake db nunca é mutado). **76 testes passando no total** (62
  `agente-agil/` + 14 `agente-agil-orquestrador/`).

Requer confirmação explícita do usuário antes de tirar o `dryRun` fixo —
combinado como critério de segurança em camadas, junto com o kill switch, já
que esta etapa ainda não tem nenhum caminho de escrita real validado contra
dados de verdade. Não requer `firebase deploy` (nada aqui é chamado por
endpoint HTTP ainda).

### 2026-07-30 · Etapa 1
Abre o projeto novo da Fase 2 do Agente Ágil (PO+orquestrador com LLM e
ferramentas), separado e isolado de `functions/agente-agil/` — que segue
intocado e estável recebendo `POST` de especialistas externos normalmente.
Etapa 1 é só o esqueleto do loop, com ferramentas **falsas** (nenhuma escrita
real no board ainda):
- `loop.js`: `runLoop()` usa o protocolo nativo de tool-use do Claude pra
  decidir quando parar — continua enquanto a resposta trouxer tool calls,
  para com `status:'done'` quando for só texto, sem ferramenta `finish()`
  customizada. Duas paradas de segurança adicionais: `stopped_max_iterations`
  (estourou o teto) e `disabled` (kill switch desligado, nem chama o LLM). Uma
  terceira parada de produto: `awaiting_human`, quando o modelo chama a nova
  ferramenta `perguntar_humano`.
- `limits.js`: kill switch (`KILL_SWITCH_ENABLED = false` por padrão) e
  `MAX_ITERATIONS = 8`. `enabled` é sempre recebido como parâmetro explícito
  em `runLoop()`, nunca lido como global escondida — a suíte de testes passa
  `enabled: true` diretamente e por isso nunca fica bloqueada pelo valor real
  do switch de produção.
- `tools/index.js`: monta as ferramentas a partir dos MESMOS schemas Zod que
  `agente-agil/schema.js` usa pros 7 outputs do Sprint 1-3, via
  `zodToJsonSchema(schema)` sem nome (produz schema plano, compatível com
  `input_schema` da Anthropic) — trocar as ferramentas falsas pelas reais
  (Etapa 3) vai ser só trocar o handler, sem mexer em schema.
- `llmClient.js`: `createAnthropicLlmClient()` via `fetch()` direto em
  `https://api.anthropic.com/v1/messages`, sem acrescentar dependência nova
  (`@anthropic-ai/sdk` não usado, propositalmente). Não exercitado pelos
  testes automatizados (que usam um cliente 100% falso/scripted).
- 9 testes novos em `__tests__/loop.test.js` (parada natural, encadeamento de
  múltiplas ferramentas, `perguntar_humano`, teto de iterações, kill switch,
  ferramenta desconhecida, defaults). `functions/package.json`'s `test` agora
  roda os dois pacotes de testes. 66 testes passando no total
  (57 `agente-agil/` + 9 `agente-agil-orquestrador/`).

Próximas etapas (não implementadas ainda): plugar o motor de escrita real
(`buildWritePlan`/`applyWritePlan`) nos handlers, rodar em `dryRun` contra um
squad de teste, tornar `SQUAD_ID` configurável. Nada aqui é chamado por
nenhum endpoint HTTP ainda — não requer `firebase deploy`.

## Agente Ágil (`functions/agente-agil/`)

### 2026-07-29 · PR #52
Corrige `mover_coluna` ficando silencioso ao mover um card pra coluna
intermediária: o fluxo manual (`kanban.html`/`notifMoved`, ver `handleDrop`)
notifica owner+participants em **qualquer** mudança de coluna há algum
tempo, mas `mover_coluna` do Agente Ágil só replicava a notificação de
coluna de fim (`notifDone`) — achado durante a validação manual do Sprint 3.
Divergência não intencional (o próprio comentário do arquivo sempre disse
"replica TODA movimentação manual"): o agente só ficou defasado depois que
`notifMoved` foi adicionado ao fluxo manual. Corrigido reaproveitando
`buildOwnerParticipantNotifSteps` também pra coluna não-final, com
`type:'moved'` e título `Card movido para {coluna}` (mesmo texto do
cliente). Teste de regressão atualizado pra confirmar a notificação em vez
de confirmar a ausência dela. **Requer `firebase deploy --only functions`
manual.**

### 2026-07-29 · PR #51
Corrige um bug bem mais sério, achado ao re-testar o fix da PR #50: nenhuma
escrita do Agente Ágil (nenhum dos 7 tipos de output — `comentario`, `link`,
`relatorio_html`, `checklist_item`, `agent_status`, `mover_coluna`,
`editar_campos`) nunca tocava `cards_updated_at/{cardId}`, o índice paralelo
que o cliente (`fbSaveCard`/`fbSaveAll` em `kanban.html`) sempre carimba
junto com qualquer escrita de card, e que o delta-sync
(`_planCardsDelta`/carregamento em duas etapas, ver PR #47/#48) usa pra
decidir se um card precisa ser rebuscado. Sem esse carimbo, toda mudança
feita pelo agente ficava invisível pro delta-sync — o board seguia servindo
a versão em cache de antes da chamada, pra sempre (nem no F5, nem ao vivo),
sem erro nenhum em lugar nenhum. Era exatamente por isso que o teste 6.2
(tags) continuava "sem efeito" na UI mesmo depois do fix da PR #50 gravar o
id certo no card. Corrigido centralizando o carimbo em `applyWritePlan()`
(`board.js`): quando o plano de escrita toca algum path dentro do card,
`updatedAt` do card e `cards_updated_at/{cardId}` são gravados no mesmo
commit lógico, com o mesmo timestamp — nenhum output builder precisa saber
disso individualmente. Regressão cobrindo os 7 tipos de output confirmando
o carimbo. **Requer `firebase deploy --only functions` manual.**

### 2026-07-29 · PR #50
Corrige `editar_campos` gravando tag "invisível" na UI: o especialista manda
o label legível (ex.: `"Piloto"`), mas `card.tags` é um array de IDs
internos (`kanban.html` resolve cada id via `getTag()` pra desenhar os
chips) — a função gravava o label cru sem resolver, então `getTag()` nunca
achava a tag e renderizava vazio, sem erro nenhum (achado na validação
manual do Sprint 3, teste 6.2). Mesma classe de bug já corrigida em
`checklistItem.js`/`resolveGroup()` pra grupo de checklist: agora
`editarCampos.js` resolve cada label contra
`kanban/squads/{squad}/dados/tags` (case-insensitive) e grava o `.id`
correspondente, mantendo o comportamento aditivo (nunca remove tag
existente). Label que não bate com tag nenhuma do squad agora é erro (400
`invalid_output`) em vez de gravar algo que a UI nunca vai conseguir
resolver. **Requer `firebase deploy --only functions` manual.**

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

### 2026-07-31 · Regras pra integração com Spotify ("ouvindo agora")
Duas adições, ambas pra suportar a primeira leva da integração com
Spotify (ver entrada de `v8.30.232-dev` no `kanban-dev.html`):

- `kanban/spotify_secrets`: `.read`/`.write: false` incondicional — o
  `refresh_token` OAuth de cada pessoa não pode ser lido por nenhum
  cliente (só Admin SDK, usado pela Cloud Function). Ficou
  deliberadamente FORA da árvore `kanban/usuarios` — essa árvore já tem
  `.read: "auth != null"` no nível raiz, e regras do Realtime Database
  cascateiam só numa direção (um `.read: false` mais profundo não revoga
  um acesso já concedido por um ancestral) — aninhar o token ali dentro
  deixaria ele legível por qualquer pessoa logada, mesmo com `.read:
  false` no nó específico.
- `kanban/oauth_pending/$state`: ponte de uso único entre o cliente
  iniciando o fluxo OAuth e o callback recebendo o redirect do Spotify
  (que não sabe nada sobre uid do Firebase). `.write` exige que o
  registro criado aponte pro próprio uid de quem está escrevendo;
  `.read: false` (só a function precisa ler, via Admin SDK).

Os nós de status público (`spotify_now` por squad, `spotify_now_geral`)
não precisaram de regra nova — já caem dentro de `dados`/`painel`, que já
têm regras adequadas.

**Precisa de `firebase deploy --only database` depois do merge.**

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
