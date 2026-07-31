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
  const cached = _accessTokenCache.get(uid);
  if (cached && cached.expiresAt > Date.now() + 30000) return { token: cached.token };

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
  _accessTokenCache.set(uid, {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
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

// Pra cada uid em kanban/spotify_secrets: troca o refresh_token por um
// access_token válido, consulta currently-playing, e escreve o resultado
// em TODOS os squads que a pessoa participa + no geral — mesmo fan-out
// multi-squad de spotifyDisconnect (usuarios/{uid}/squads é um mapa
// {squadId:true}, sem "squad principal").
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
async function runSpotifySync(db, clientSecret) {
  const secretsSnap = await db.ref('kanban/spotify_secrets').get();
  const secrets = secretsSnap.val() || {};
  const uids = Object.keys(secrets);
  if (!uids.length) return;

  const updates = {};

  await Promise.allSettled(
    uids.map(async (uid) => {
      const refreshToken = secrets[uid]?.refresh_token;
      if (!refreshToken) return;

      const tok = await _getAccessToken(uid, refreshToken, clientSecret);
      if (tok.error) {
        if (tok.error === 'invalid_grant') {
          console.warn('[spotifySync] refresh_token revogado pra uid', uid, '— desconectando.');
          Object.assign(updates, await buildDisconnectUpdates(db, uid));
        } else {
          console.error('[spotifySync] falha ao renovar access_token pra uid', uid, ':', tok.error);
        }
        return;
      }
      if (tok.newRefreshToken && tok.newRefreshToken !== refreshToken) {
        updates['kanban/spotify_secrets/' + uid + '/refresh_token'] = tok.newRefreshToken;
      }

      const now = await _fetchNowPlaying(tok.token);
      if (now.error) {
        console.error('[spotifySync] falha ao consultar currently-playing pra uid', uid, ':', now.error);
        return;
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
    })
  );

  if (Object.keys(updates).length) await db.ref().update(updates);
}

module.exports = { runSpotifySync, _accessTokenCache };
