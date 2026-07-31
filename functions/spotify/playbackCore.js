// functions/spotify/playbackCore.js
//
// Controle de playback PESSOAL — cada pessoa dá play/pause/pula a
// PRÓPRIA reprodução, direto pelo painel do Maré, sem precisar abrir o
// Spotify separadamente. NÃO é um "DJ" tocando pra todo mundo (descartado
// por decisão de produto — fragilidade técnica, latência desencontrada,
// exigiria permissão de escrita de todo mundo) — é só um atalho de
// conveniência pra reprodução da PRÓPRIA pessoa, no próprio dispositivo
// Spotify ativo dela (Spotify Connect).
//
// Usa o token PESSOAL de cada uid (kanban/spotify_secrets/{uid}, mesmo
// de syncCore.js — reusa _getAccessToken/_accessTokenCache de lá, mesmo
// cache em memória, evita duplicar a troca de refresh_token uma terceira
// vez), NUNCA o token da conta dona da Rádio do Maré — esse é só pra
// escrita na playlist compartilhada, não tem relação nenhuma com
// playback pessoal.
//
// v1: play/pause/próxima só. Anterior/volume/seek ficam de fora de
// propósito — mesmo padrão de endpoint, fácil de adicionar depois sem
// risco arquitetural, sem motivo pra incluir agora sem alguém pedir.
const { _getAccessToken } = require('./syncCore');

const ENDPOINTS = {
  play: { method: 'PUT', url: 'https://api.spotify.com/v1/me/player/play' },
  pause: { method: 'PUT', url: 'https://api.spotify.com/v1/me/player/pause' },
  next: { method: 'POST', url: 'https://api.spotify.com/v1/me/player/next' },
};

// Controle de playback exige o escopo user-modify-playback-state, pedido
// só em conexões/reconexões NOVAS a partir de agora (ver connectSpotify()
// em kanban-dev.html) — quem conectou antes não tem esse escopo até
// reconectar. Spotify sinaliza isso com 403 + "Insufficient client
// scope" na mensagem — distinto do PREMIUM_REQUIRED (a própria conta não
// é Premium, requisito histórico do Spotify Connect pra controle via
// API) e do NO_ACTIVE_DEVICE (ninguém com o Spotify aberto em nenhum
// aparelho agora). As três causas têm mensagens bem diferentes pra UI —
// ver playback.js/kanban-dev.html.
async function controlPlayback(db, clientSecret, uid, action) {
  const endpoint = ENDPOINTS[action];
  if (!endpoint) throw new Error('invalid_action');

  const secretSnap = await db.ref('kanban/spotify_secrets/' + uid).get();
  const secret = secretSnap.val();
  if (!secret || !secret.refresh_token) {
    return { error: 'not_connected' };
  }

  const tok = await _getAccessToken(uid, secret.refresh_token, clientSecret);
  if (tok.error) {
    return { error: 'token_refresh_failed', detail: tok.error };
  }

  const res = await fetch(endpoint.url, {
    method: endpoint.method,
    headers: { Authorization: 'Bearer ' + tok.token },
  });

  if (res.ok) return { ok: true };

  const body = await res.json().catch(() => ({}));
  const reason = body?.error?.reason;
  const message = body?.error?.message || '';

  if (reason === 'PREMIUM_REQUIRED') return { error: 'premium_required' };
  if (reason === 'NO_ACTIVE_DEVICE' || res.status === 404) return { error: 'no_active_device' };
  if (res.status === 403 && /insufficient client scope/i.test(message)) return { error: 'insufficient_scope' };

  return { error: 'playback_failed', detail: `http_${res.status} ${message || JSON.stringify(body)}`.slice(0, 300) };
}

module.exports = { controlPlayback };
