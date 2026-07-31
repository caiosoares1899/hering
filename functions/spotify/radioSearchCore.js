// functions/spotify/radioSearchCore.js
//
// Busca de faixas pra sugerir na Rádio do Maré. Lógica pura, sem import
// de firebase-functions (mesmo motivo de syncCore.js) — testável com
// node:test sem runtime de Cloud Functions.
//
// Diferente de radioSuggestCore.js (que precisa do token da CONTA DONA,
// com escopo de escrita), busca é catálogo público — usa um token
// app-only via client_credentials (só client_id+client_secret, sem
// refresh_token, sem usuário nenhum envolvido). Decisão deliberada: isso
// desacopla "buscar" de qualquer conta pessoal — funciona mesmo antes da
// conta dona ter sido conectada.
const CLIENT_CREDENTIALS_URL = 'https://accounts.spotify.com/api/token';
const SEARCH_URL = 'https://api.spotify.com/v1/search';
const SPOTIFY_CLIENT_ID = '737e3e1ce3d449dc955c0d4c7657bb6b';

// Só um token cacheado (não é por uid, não tem usuário — token da
// aplicação em si). Dura ~1h, mesmo espírito de cache de syncCore.js.
let _appTokenCache = null; // {token, expiresAt}

async function _getAppToken(clientSecret) {
  if (_appTokenCache && _appTokenCache.expiresAt > Date.now() + 30000) return _appTokenCache.token;

  const res = await fetch(CLIENT_CREDENTIALS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: SPOTIFY_CLIENT_ID,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) throw new Error('client_credentials falhou: http_' + res.status);
  const data = await res.json();
  _appTokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return _appTokenCache.token;
}

async function searchTracks(clientSecret, query, limit) {
  const token = await _getAppToken(clientSecret);
  const params = new URLSearchParams({ q: query, type: 'track', limit: String(Math.min(limit || 10, 50)) });
  const res = await fetch(SEARCH_URL + '?' + params.toString(), { headers: { Authorization: 'Bearer ' + token } });
  if (!res.ok) throw new Error('search falhou: http_' + res.status);
  const data = await res.json();
  const items = (data.tracks && data.tracks.items) || [];
  return items.map((t) => ({
    uri: t.uri,
    id: t.id,
    name: t.name,
    artist: (t.artists || []).map((a) => a.name).join(', '),
    album: t.album?.name || '',
    // Menor imagem disponível — mesmo critério de syncCore.js (a UI só
    // precisa de uma miniatura).
    albumArt: (t.album?.images || []).length ? t.album.images[t.album.images.length - 1].url : '',
    durationMs: t.duration_ms || 0,
  }));
}

module.exports = { searchTracks, _resetAppTokenCache: () => { _appTokenCache = null; } };
