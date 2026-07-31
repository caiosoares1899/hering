# Integração com Spotify — Maré Digital

Duas funcionalidades, mesma pasta, mesmo `client_id`, propósitos
diferentes. **Status: completa e validada em produção** (2026-07-31).

## 1. "Ouvindo agora" — presença ao vivo, opt-in por pessoa

Mostra o que cada membro do squad está ouvindo neste momento — sem
histórico, sem playlist, só "o que está tocando agora". Cada pessoa
conecta a própria conta (opt-in); quem não conectou não aparece.

- **Conexão**: `oauth.js` (`spotifyOauthCallback`) — callback do OAuth
  POR PESSOA. Escopos `user-read-currently-playing
  user-read-playback-state user-modify-playback-state` (o terceiro,
  pra controle de playback — pedido só em conexões/reconexões a partir
  de quando esse recurso foi lançado, sem campanha de reconexão em massa
  pra quem já estava conectado antes). `state`/`kanban/oauth_pending/{state}`
  bridge entre o cliente (que sabe o uid) e o Spotify (que não sabe nada
  de Firebase Auth).
- **Gestão de conta**: `disconnect.js` (`spotifyDisconnect`) — apaga o
  refresh_token de verdade (não é flag de "inativo"), com fan-out pra
  TODOS os squads que a pessoa participa (`usuarios/{uid}/squads` é
  multi-squad, sem "squad principal"). "Trocar de conta" reusa o mesmo
  fluxo de conexão — o `.set()` do callback já sobrescreve.
- **Sync periódico**: `sync.js`/`syncCore.js` (`spotifySync`) —
  `onSchedule`, gatilho do Cloud Scheduler a cada 1 minuto (mínimo que o
  Scheduler permite via cron — não dá pra agendar sub-minuto
  diretamente), mas com **cadência efetiva de 30s**: cada invocação roda
  `runSpotifySync()` duas vezes, com uma pausa de 30s no meio
  (`timeoutSeconds: 90`, dá margem — o default de 60s ficaria justo
  demais). Mesmo custo total de chamadas por dia que rodar nativamente a
  cada 30s (número calculado e aprovado antes de implementar: pra um
  squad de ~10 pessoas conectadas, ~43k chamadas/dia — bem longe de
  qualquer limite conhecido do Spotify e do free tier do Firebase/GCP).
  Renova o `access_token` por pessoa conectada (cacheado em memória —
  dura ~1h, não precisa renovar todo tick), consulta
  `GET /v1/me/player/currently-playing`, escreve em `spotify_now` (por
  squad) + `spotify_now_geral`. Autocorreção: se o `refresh_token` vier
  `invalid_grant` (revogado direto pelo Spotify), desconecta a pessoa por
  completo.
- **Sync sob demanda**: `syncNow.js`/`syncCore.js`
  (`spotifySyncNow`, função `syncOneUserNow`) — disparado (fire-and-
  forget) quando a própria pessoa abre o painel, pra não esperar até 30s
  pelo próximo tick do sync periódico. `uid` sempre resolvido do ID token
  decodificado (nunca aceito do corpo da requisição — evita forçar sync
  de outro uid). Rate limit de 10s por uid (`Map` em memória) evita spam
  de abrir/fechar o painel repetidamente. Reusa a mesma lógica por-uid do
  sync periódico (`_syncOneUser()`, extraída de `runSpotifySync()`
  especificamente pra esse reuso).
- **Controle de playback pessoal**: `playback.js`/`playbackCore.js`
  (`spotifyPlayback`) — play/pause/próxima, cada pessoa controlando a
  PRÓPRIA reprodução (não é um "DJ" tocando pra todo mundo — descartado
  por decisão de produto). Usa o token PESSOAL de cada uid (reusa
  `_getAccessToken`/`_accessTokenCache` de `syncCore.js`, mesmo cache —
  nunca o token da conta dona da Rádio do Maré, que é só pra escrita em
  playlist compartilhada). `uid` sempre do ID token decodificado. 3
  causas de erro distintas, cada uma com mensagem própria na UI: escopo
  insuficiente (403 "Insufficient client scope" — reconectar resolve),
  Premium ausente (403 `reason: PREMIUM_REQUIRED`, requisito histórico
  do Spotify Connect pra controle via API, não relacionado à migração de
  fev/2026), sem dispositivo ativo (404 `reason: NO_ACTIVE_DEVICE`).
  Tenta-e-avisa em vez de checar dispositivo antes (evita uma chamada de
  API extra só pra decidir se desabilita o botão). Estado do botão
  (▶️/⏸️) vem do `spotify_now` já existente, sem chamada nova.
- **UI**: painel "🎧 Spotify" no board, tabs Squad/Geral (mesmo padrão do
  Kudos) + sub-toggle "Ouvindo agora"/"Playlist" (ver seção 2). Listener
  ao vivo só existe com o painel aberto (lazy) — diferente do Kudos, que
  faz poll em background pra manter um badge; aqui não tem badge, então
  não tem custo de manter nada vivo com o painel fechado. Lista ordenada
  por prioridade: quem está ouvindo agora > conectado mas parado > não
  conectado (e nesse último grupo, só a própria pessoa aparece — as
  outras pessoas que nunca conectaram ficam de fora, pra não virar uma
  lista longa de gente que não usa a feature).

## 2. Rádio do Maré — playlist colaborativa (Nível 1)

Uma playlist REAL do Spotify por squad + uma pra empresa toda ("Geral").
Qualquer pessoa loga no Maré e sugere música (não precisa ter conectado
o próprio Spotify) — a sugestão entra direto na playlist, sem fila de
aprovação. **NÃO é ao vivo**: quem quiser ouvir abre a playlist no
próprio Spotify e dá play no próprio ritmo, sem sincronia com ninguém.

- **Conta dona**: uma ÚNICA conta Spotify (hoje, pessoal — não existe
  conta institucional da Hering ainda) hospeda as N+1 playlists
  (Geral + uma por squad). A playlist é compartilhada, então toda
  escrita usa o token FIXO dessa conta, nunca o de quem está sugerindo.
  `radioOwnerCallback.js` (`spotifyRadioOwnerCallback`) — conexão ÚNICA
  e manual (sem uid, sem `oauth_pending` — não faz sentido pra uma conta
  fixa), escopos `playlist-modify-public playlist-modify-private`.
  Refresh_token vive em `kanban/spotify_radio_owner_secret` (deny total,
  mesmo padrão de `spotify_secrets`).
- **Criação das playlists**: manual, direto no app do Spotify (decisão
  de escopo — evita automatizar `POST /me/playlists` por um ganho
  pequeno). Registro do `playlistId` na UI (`kanban/painel/radio_geral`
  ou `kanban/squads/{id}/dados/radio_squad`) é um simples ponteiro,
  escrito direto pelo cliente (já coberto pelas regras existentes de
  `painel`/`dados`, sem regra nova).
- **Busca**: `radioSearch.js`/`radioSearchCore.js`
  (`spotifyRadioSearch`) — `GET /v1/search`, usando um token **app-only**
  via `client_credentials` (não depende da conta dona nem de nenhum
  usuário — busca é catálogo público). Qualquer pessoa logada no Maré
  pode buscar.
- **Sugestão**: `radioSuggest.js`/`radioSuggestCore.js`
  (`spotifyRadioSuggest`) — `POST /v1/playlists/{id}/items` (⚠️ não
  `/tracks` — ver "Gotchas" abaixo), sempre com o token da conta dona
  (cacheado em memória, mesmo padrão do sync). Diagnóstico embutido: se a
  escrita falhar, loga o dono do token vs. o dono da playlist lado a
  lado — útil pra descartar mismatch de conta rapidamente num problema
  futuro.
- **Compartilhado entre disconnect e sync**: `_shared.js`
  (`buildDisconnectUpdates`) — o multi-path update que apaga o
  refresh_token + todo o status público espalhado, usado tanto pelo
  botão "Desconectar" quanto pela autocorreção do sync.

## Gotchas reais encontrados em produção (leia antes de mexer)

1. **Regras RTDB cascateiam só numa direção.** `kanban/usuarios` tem
   `.read: "auth != null"` na raiz — um `.read: false` mais profundo
   NUNCA revoga esse acesso já concedido. Por isso `spotify_secrets` e
   `spotify_radio_owner_secret` vivem como nós irmãos no topo de
   `kanban`, fora da árvore `usuarios`. **Nunca** adicione uma regra
   `.read`/`.write: true` na raiz de `kanban` — isso quebraria essa
   proteção pros dois.

2. **Spotify Developer Mode exige allowlist manual.** Apps em
   Development Mode (padrão de qualquer app novo) ficam limitados a
   poucos usuários (5, hoje) cadastrados manualmente em Spotify for
   Developers → app → "Users and Access". Fora da lista = 403 em
   qualquer endpoint de escrita, mesmo com token/escopo corretos.

3. **`POST /playlists/{id}/tracks` foi renomeado pra
   `POST /playlists/{id}/items`** na migração de fevereiro/2026 da Web
   API do Spotify (cutover pra Development Mode em 9/mar/2026) — o
   endpoint antigo devolve 403 Forbidden genérico, indistinguível à
   primeira vista de um problema de permissão. Migração afeta os 4
   métodos do sub-recurso (GET/POST/PUT/DELETE); só o `POST` era usado
   aqui. Corpo da requisição (`{"uris": [...]}`) não mudou, só o path —
   e o sucesso passa a ser `201`, não `200` (o código sempre tratou isso
   certo via `res.ok`, nunca comparou com `status===200`).

   Lição: um 403 "do nada", com token/escopo/allowlist aparentemente
   certos, merece checar primeiro se o endpoint em si não foi
   renomeado/migrado — `developer.spotify.com/documentation/web-api/
   references/changes/` lista as mudanças por mês.

4. **`/me/player/*` (play/pause/next) devolve `401 "Permissions
   missing"` pra escopo faltando** — diferente da maioria da Web API,
   que devolve `403 "Insufficient client scope"` pro mesmo problema.
   Inconsistência real do lado do Spotify entre famílias de endpoints,
   não um bug de detecção "certo vs. errado" — as duas formas existem de
   verdade, cada uma numa família diferente.

5. **Cache de `access_token` em memória precisa validar o `refresh_token`
   usado, não só o uid/uma flag fixa.** Bug real encontrado ao lançar o
   controle de playback: alguém reconectou (🔁 Trocar) especificamente
   pra ganhar o escopo novo (`user-modify-playback-state`), e mesmo assim
   continuou tomando o 401 de escopo faltando — porque o sync (que roda
   a cada 30s) já tinha cacheado um `access_token` com o escopo VELHO
   minutos antes da reconexão, e o cache (`_accessTokenCache` em
   `syncCore.js`, `_ownerTokenCache` em `radioSuggestCore.js`) só checava
   `expiresAt` (~1h de validade), nunca se o `refresh_token` usado pra
   gerar aquele token ainda era o mesmo salvo no banco. Corrigido nos
   dois caches: agora só serve o cache se o `refreshToken` bater
   exatamente com o que gerou o `access_token` cacheado — qualquer
   reconexão/troca de conta invalida o cache na hora, sem precisar
   esperar expirar sozinho. De passagem, `playbackCore.js` também passou
   a persistir `refresh_token` rotacionado no banco (só `_syncOneUser()`
   fazia isso antes) — sem isso, uma rotação durante um controle de
   playback ficaria só na memória, e o próximo tick do sync usaria um
   `refresh_token` que o Spotify já pode ter invalidado.

## Testes

`functions/spotify/__tests__/*.test.js` — `node --test`, mesma
convenção de `agente-agil`/`agente-agil-orquestrador` (rodado via
`npm test`, sem emulador — fake db local + `fetch` mockado). Cobre
`syncCore.js`, `radioSearchCore.js` e `radioSuggestCore.js` — os
wrappers `onRequest`/`onSchedule` em si não são testados diretamente
(mesmo padrão de `agente-agil/http.js`: a lógica testável fica separada
do wrapper do runtime de Cloud Functions).

UI (`kanban-dev.html`) verificada via Playwright contra extrações
isoladas do código real — ambiente de teste descartado depois de cada
verificação (client não tem framework de teste, ver `CLAUDE.md`).

## Deploy

Cada function tem deploy isolado (nenhuma sai publicada só com o merge
do HTML — GitHub Pages só redeploya as páginas estáticas):

```bash
firebase deploy --only functions:spotifyOauthCallback
firebase deploy --only functions:spotifyDisconnect
firebase deploy --only functions:spotifySync
firebase deploy --only functions:spotifySyncNow
firebase deploy --only functions:spotifyPlayback
firebase deploy --only functions:spotifyRadioOwnerCallback
firebase deploy --only functions:spotifyRadioSearch
firebase deploy --only functions:spotifyRadioSuggest
```

`database.rules.json` (novos nós `spotify_secrets`,
`spotify_radio_owner_secret`, `oauth_pending`) precisa do próprio deploy
separado:

```bash
firebase deploy --only database
```

## Histórico completo

Ver `CHANGELOG.md`, seções `kanban-dev.html` (PRs #105–#109, evolução da
UI e das functions) e `Cloud Functions — Spotify` (PRs #110–#112, a
investigação completa do bug de 403 pós-lançamento — allowlist real mas
incompleta como causa, até a causa raiz definitiva: migração de
endpoint).
