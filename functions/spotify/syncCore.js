// functions/spotify/syncCore.js
//
// Lógica pura do sync do Spotify — sem nenhum import de firebase-functions,
// só firebase-admin (via `db` injetado) e o fetch global do Node 20. Fica
// separado de sync.js (o wrapper onSchedule) pelo mesmo motivo de
// agente-agil/http.js vs. agente-agil/board.js: a parte testável com
// node:test não deveria depender do runtime de Cloud Functions pra rodar.
const { buildDisconnectUpdates } = require('./_shared');

const SPOTIFY_CLIENT_ID = '737e3e1ce3d449dc955c0d4c7657bb6b';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_NOW_PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing';

// uid -> {token, expiresAt}. Só vive na memória da instância — não é
// persistido, não precisa ser (é puramente uma otimização de custo/
// latência: o access_token do Spotify dura ~1h, não faz sentido renovar
// a cada tick de 1min só pra 1 leitura). Pior caso de a instância
// reciclar é um refresh a mais, não um bug.
const _accessTokenCache = new Map();

async function _getAccessToken(uid, refreshToken, clientSecret) {
  // O cache só é válido se o refreshToken bater com o que gerou o
  // access_token cacheado. Sem essa checagem, alguém que reconecta (ex:
  // "🔁 Trocar" pra ganhar um escopo novo, como user-modify-playback-state)
  // continuaria recebendo o access_token ANTIGO (escopo velho) até o
  // cache expirar sozinho (~1h) — mesmo com o refresh_token novo já
  // salvo no banco. Achado em produção: alguém reconectou pra ganhar
  // escopo de playback e continuou tomando 401 "Permissions missing"
  // porque o sync (que roda a cada 30s) já tinha cacheado um token com o
  // escopo velho minutos antes da reconexão.
  const cached = _accessTokenCache.get(uid);
  if (cached && cached.refreshToken === refreshToken && cached.expiresAt > Date.now() + 30000) {
    return { token: cached.token };
  }

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: SPOTIFY_CLIENT_ID,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: body.error || 'http_' + res.status };
  }

  const data = await res.json();
  // Se veio rotação (refresh_token novo), guarda o cache já com o
  // refreshToken NOVO — senão a própria rotação (legítima, não uma
  // reconexão de verdade) invalidaria o cache no próximo tick à toa,
  // já que quem chama vai persistir newRefreshToken no banco e passar
  // esse valor novo na chamada seguinte.
  const effectiveRefreshToken = data.refresh_token || refreshToken;
  _accessTokenCache.set(uid, {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    refreshToken: effectiveRefreshToken,
  });
  // Spotify às vezes manda um refresh_token novo junto (rotação) — se
  // vier, é esse que vale dali pra frente, o antigo pode já não servir.
  return { token: data.access_token, newRefreshToken: data.refresh_token || null };
}

async function _fetchNowPlaying(accessToken) {
  const res = await fetch(SPOTIFY_NOW_PLAYING_URL, {
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  // 204 = API confirma "nada tocando agora" (não é erro).
  if (res.status === 204) return { playing: false };
  if (!res.ok) return { error: 'http_' + res.status };
  const data = await res.json().catch(() => null);
  if (!data || !data.item) return { playing: false };
  const images = data.item.album?.images || [];
  return {
    playing: !!data.is_playing,
    track: data.item.name || '',
    artist: (data.item.artists || []).map((a) => a.name).join(', '),
    // Menor imagem disponível (Spotify manda em ordem decrescente de
    // tamanho) — a UI só precisa de um quadrado de 36px.
    albumArt: images.length ? images[images.length - 1].url : '',
  };
}

// Sincroniza UM uid — troca o refresh_token por um access_token válido,
// consulta currently-playing, e monta (sem aplicar) as atualizações pra
// TODOS os squads que a pessoa participa + o geral — mesmo fan-out
// multi-squad de spotifyDisconnect (usuarios/{uid}/squads é um mapa
// {squadId:true}, sem "squad principal"). Quem chama decide quando/como
// aplicar (`runSpotifySync` acumula de vários uids num só `update()` em
// lote; `syncOneUserNow` aplica sozinha, pra 1 pessoa só).
//
// A presença de uma entrada em spotify_now É o sinal de "conectado" pro
// painel (ver renderSpotifyPanel/_spotifyGroupRank em kanban-dev.html) —
// por isso sempre escreve algo (mesmo {playing:false}) pra quem está
// conectado, nunca deixa a entrada ausente enquanto o refresh_token
// continuar válido.
//
// Se o refresh_token vier invalid_grant, a pessoa revogou o acesso direto
// pela tela "Apps conectados" do Spotify, sem passar pelo nosso botão — a
// conexão já está morta do lado deles de qualquer jeito. Se autocorrige e
// desconecta por completo (mesmo helper de spotifyDisconnect), em vez de
// ficar tentando e falhando pra sempre e deixando o painel com um
// "conectado" fantasma.
async function _syncOneUser(db, clientSecret, uid, refreshToken) {
  const updates = {};
  if (!refreshToken) return updates;

  const tok = await _getAccessToken(uid, refreshToken, clientSecret);
  if (tok.error) {
    if (tok.error === 'invalid_grant') {
      console.warn('[syncCore] refresh_token revogado pra uid', uid, '— desconectando.');
      Object.assign(updates, await buildDisconnectUpdates(db, uid));
    } else {
      console.error('[syncCore] falha ao renovar access_token pra uid', uid, ':', tok.error);
    }
    return updates;
  }
  if (tok.newRefreshToken && tok.newRefreshToken !== refreshToken) {
    updates['kanban/spotify_secrets/' + uid + '/refresh_token'] = tok.newRefreshToken;
  }

  const now = await _fetchNowPlaying(tok.token);
  if (now.error) {
    console.error('[syncCore] falha ao consultar currently-playing pra uid', uid, ':', now.error);
    return updates;
  }

  const status = {
    playing: now.playing,
    track: now.track || null,
    artist: now.artist || null,
    albumArt: now.albumArt || null,
    updatedAt: new Date().toISOString(),
  };

  const squadsSnap = await db.ref('kanban/usuarios/' + uid + '/squads').get();
  const squadsMap = squadsSnap.val() || {};
  Object.keys(squadsMap)
    .filter((sq) => squadsMap[sq] === true)
    .forEach((sq) => {
      updates['kanban/squads/' + sq + '/dados/spotify_now/' + uid] = status;
    });
  updates['kanban/painel/spotify_now_geral/' + uid] = status;

  return updates;
}

// Roda pra TODOS os uids em kanban/spotify_secrets, batendo num único
// db.ref().update() no final (menos escritas separadas que N updates
// individuais).
async function runSpotifySync(db, clientSecret) {
  const secretsSnap = await db.ref('kanban/spotify_secrets').get();
  const secrets = secretsSnap.val() || {};
  const uids = Object.keys(secrets);
  if (!uids.length) return;

  const updates = {};
  await Promise.allSettled(
    uids.map(async (uid) => {
      const frag = await _syncOneUser(db, clientSecret, uid, secrets[uid]?.refresh_token);
      Object.assign(updates, frag);
    })
  );

  if (Object.keys(updates).length) await db.ref().update(updates);
}

// uid -> timestamp do último sync manual disparado por essa pessoa (ao
// abrir o painel "🎧 Spotify" — ver toggleSpotify() em kanban-dev.html).
// Só em memória — o objetivo é impedir spam de abrir/fechar o painel
// repetido, não uma garantia dura; se a instância reciclar, pior caso é
// permitir um sync a mais, não um bug.
const _manualSyncCooldown = new Map();
const MANUAL_SYNC_COOLDOWN_MS = 10000;

// Sync sob demanda de 1 pessoa só — não espera o próximo tick do
// spotifySync (que roda a cada 30s, ver sync.js). `uid` é sempre resolvido
// pelo chamador a partir do ID token decodificado (ver syncNow.js), nunca
// aceito como parâmetro vindo de fora sem verificação — senão qualquer
// pessoa logada poderia forçar sync de outro uid.
async function syncOneUserNow(db, clientSecret, uid) {
  const last = _manualSyncCooldown.get(uid);
  if (last && Date.now() - last < MANUAL_SYNC_COOLDOWN_MS) {
    return { skipped: true, reason: 'cooldown' };
  }
  _manualSyncCooldown.set(uid, Date.now());

  const secretSnap = await db.ref('kanban/spotify_secrets/' + uid).get();
  const secret = secretSnap.val();
  if (!secret || !secret.refresh_token) {
    return { skipped: true, reason: 'not_connected' };
  }

  const updates = await _syncOneUser(db, clientSecret, uid, secret.refresh_token);
  if (Object.keys(updates).length) await db.ref().update(updates);
  return { skipped: false };
}

module.exports = {
  runSpotifySync,
  syncOneUserNow,
  // Exportado pra playbackCore.js reusar a MESMA troca de refresh_token
  // (e o mesmo cache) em vez de duplicar uma terceira vez — controle de
  // playback usa o token PESSOAL de cada uid, igual ao sync, só que pra
  // um endpoint diferente (/me/player/play|pause|next em vez de
  // /me/player/currently-playing).
  _getAccessToken,
  _accessTokenCache,
  _resetManualSyncCooldown: () => { _manualSyncCooldown.clear(); },
};
