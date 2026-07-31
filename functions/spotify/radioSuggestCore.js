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
// Se isso voltar 403 mesmo com token/escopo/allowlist certos, desconfie
// primeiro do endpoint em si: a Web API migrou POST /playlists/{id}/tracks
// pra POST /playlists/{id}/items em fevereiro/2026 (cutover pra apps em
// Development Mode em 9/mar/2026) — o endpoint antigo passou a devolver
// 403 Forbidden genérico pra qualquer chamada, mesmo com tudo mais
// correto. Foi exatamente essa a causa raiz encontrada aqui (ver
// CHANGELOG "Cloud Functions — Spotify"). Também vale conferir a
// allowlist "Users and Access" (Spotify for Developers → app →
// Development Mode) — ver radioOwnerCallback.js —, mas isso já foi
// descartado como causa desta vez.
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_CLIENT_ID = '737e3e1ce3d449dc955c0d4c7657bb6b';

// Um token só (não por uid — é sempre a mesma conta dona). Dura ~1h,
// mesmo espírito de cache de syncCore.js.
let _ownerTokenCache = null; // {token, expiresAt}

async function _getOwnerAccessToken(db, clientSecret) {
  // Lê o refresh_token atual do banco ANTES de decidir se o cache serve
  // — mesmo cuidado de _getAccessToken() em syncCore.js (achado em
  // produção lá: reconectar não adiantava, porque o cache continuava
  // servindo o access_token antigo até expirar sozinho, ~1h). Aqui a
  // leitura é barata (RTDB), vale a garantia de nunca servir um token
  // desatualizado depois de reconectar/trocar a conta dona.
  const snap = await db.ref('kanban/spotify_radio_owner_secret').get();
  const secret = snap.val();
  if (!secret || !secret.refresh_token) {
    throw new Error('radio_owner_not_connected');
  }

  if (
    _ownerTokenCache &&
    _ownerTokenCache.refreshToken === secret.refresh_token &&
    _ownerTokenCache.expiresAt > Date.now() + 30000
  ) {
    return _ownerTokenCache.token;
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
  const effectiveRefreshToken = data.refresh_token || secret.refresh_token;
  _ownerTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    refreshToken: effectiveRefreshToken,
  };
  // Rotação de refresh_token, mesmo cuidado de syncCore.js — se vier um
  // novo, é esse que vale dali pra frente.
  if (data.refresh_token && data.refresh_token !== secret.refresh_token) {
    await db.ref('kanban/spotify_radio_owner_secret/refresh_token').set(data.refresh_token);
  }
  return _ownerTokenCache.token;
}

// Só roda quando add-track já falhou (custo zero no caminho feliz).
// Confirma se o dono do token bate com o dono da playlist — a causa mais
// provável de um 403 aqui (token/escopo certos, allowlist em dia) é a
// conta conectada como "dona" não ter permissão de ESCRITA nessa
// playlist específica (não é owner nem colaboradora dela), que é uma
// exigência real da Web API do Spotify e não algo que o nosso código
// valida antes de tentar.
async function _logOwnershipDiagnostic(token, playlistId) {
  try {
    const [meRes, plRes] = await Promise.all([
      fetch('https://api.spotify.com/v1/me', { headers: { Authorization: 'Bearer ' + token } }),
      fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=name,owner(id,display_name),collaborative`, {
        headers: { Authorization: 'Bearer ' + token },
      }),
    ]);
    const me = meRes.ok ? await meRes.json() : null;
    const pl = plRes.ok ? await plRes.json() : null;
    console.error(
      '[radioSuggestCore] diagnóstico de permissão —',
      'token pertence a:', me ? `${me.id} (${me.display_name || 'sem nome'})` : `não deu pra checar (http_${meRes.status})`,
      '| playlist', playlistId, pl ? `"${pl.name}" pertence a: ${pl.owner.id} (${pl.owner.display_name || 'sem nome'}), collaborative=${pl.collaborative}` : `não deu pra checar (http_${plRes.status})`
    );
  } catch (diagErr) {
    console.error('[radioSuggestCore] diagnóstico de permissão falhou (não afeta o erro original):', diagErr);
  }
}

async function suggestTrack(db, clientSecret, playlistId, trackUri) {
  const token = await _getOwnerAccessToken(db, clientSecret);
  // /items, não /tracks — endpoint renomeado na migração de fev/2026 da
  // Web API (ver comentário no topo do arquivo). Resposta de sucesso é
  // 201 (não 200), mas o código já trata isso certo desde sempre — checa
  // res.ok (qualquer 2xx), nunca comparou com status===200.
  const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/items`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ uris: [trackUri] }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[radioSuggestCore] add_track falhou:', 'playlistId=' + playlistId, 'status=' + res.status, 'token_prefix=' + token.slice(0, 8) + '...');
    await _logOwnershipDiagnostic(token, playlistId);
    throw new Error('add_track_failed: http_' + res.status + ' ' + body);
  }
  return res.json();
}

module.exports = { suggestTrack, _resetOwnerTokenCache: () => { _ownerTokenCache = null; } };
