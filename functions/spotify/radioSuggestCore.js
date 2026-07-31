// functions/spotify/radioSuggestCore.js
//
// Adiciona uma faixa sugerida na playlist da Rádio do Maré. Lógica pura
// (mesmo motivo de syncCore.js) — testável com node:test sem runtime de
// Cloud Functions.
//
// SEMPRE usa o token da CONTA DONA fixa (kanban/spotify_radio_owner_secret),
// nunca o de quem está sugerindo — a playlist é única/compartilhada,
// então precisa de um token de escrita fixo, com escopo
// playlist-modify-*, independente de quem tá sugerindo. Isso também
// significa que sugerir não exige a pessoa ter conectado o próprio
// Spotify (só estar logada no Maré — ver radioSuggest.js).
//
// Se isso voltar 403 mesmo com token/escopo certos: não é bug de código
// — é a conta dona faltando na allowlist "Users and Access" do app em
// Spotify for Developers (Development Mode). Ver
// radioOwnerCallback.js e o CHANGELOG "Cloud Functions — Spotify" de
// 2026-07-31 pro relato completo.
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_CLIENT_ID = '737e3e1ce3d449dc955c0d4c7657bb6b';

// Um token só (não por uid — é sempre a mesma conta dona). Dura ~1h,
// mesmo espírito de cache de syncCore.js.
let _ownerTokenCache = null; // {token, expiresAt}

async function _getOwnerAccessToken(db, clientSecret) {
  if (_ownerTokenCache && _ownerTokenCache.expiresAt > Date.now() + 30000) return _ownerTokenCache.token;

  const snap = await db.ref('kanban/spotify_radio_owner_secret').get();
  const secret = snap.val();
  if (!secret || !secret.refresh_token) {
    throw new Error('radio_owner_not_connected');
  }

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: secret.refresh_token,
      client_id: SPOTIFY_CLIENT_ID,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error('owner_token_refresh_failed: ' + (body.error || res.status));
  }
  const data = await res.json();
  _ownerTokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  // Rotação de refresh_token, mesmo cuidado de syncCore.js — se vier um
  // novo, é esse que vale dali pra frente.
  if (data.refresh_token && data.refresh_token !== secret.refresh_token) {
    await db.ref('kanban/spotify_radio_owner_secret/refresh_token').set(data.refresh_token);
  }
  return _ownerTokenCache.token;
}

async function suggestTrack(db, clientSecret, playlistId, trackUri) {
  const token = await _getOwnerAccessToken(db, clientSecret);
  const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ uris: [trackUri] }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error('add_track_failed: http_' + res.status + ' ' + body);
  }
  return res.json();
}

module.exports = { suggestTrack, _resetOwnerTokenCache: () => { _ownerTokenCache = null; } };
