// functions/spotify/playback.js
//
// Wrapper onRequest em cima de playbackCore.js (mesmo motivo de
// sync.js vs. syncCore.js). Controla SÓ o playback da PRÓPRIA pessoa —
// `uid` sempre vem do ID token decodificado, nunca do corpo da
// requisição (mesmo cuidado de syncNow.js/spotifyDisconnect).
const { onRequest } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
const { defineSecret } = require('firebase-functions/params');
const { controlPlayback } = require('./playbackCore');

const SPOTIFY_CLIENT_SECRET = defineSecret('SPOTIFY_CLIENT_SECRET');
const SITE_ORIGIN = 'https://caiosoares1899.github.io';
const VALID_ACTIONS = new Set(['play', 'pause', 'next']);

const STATUS_BY_ERROR = {
  not_connected: 400,
  insufficient_scope: 403,
  premium_required: 403,
  no_active_device: 404,
  token_refresh_failed: 500,
  playback_failed: 500,
};

exports.spotifyPlayback = onRequest(
  { region: 'us-central1', cors: SITE_ORIGIN, secrets: [SPOTIFY_CLIENT_SECRET] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed.');
      return;
    }

    const authHeader = req.get('Authorization') || '';
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) {
      res.status(401).send('Faltou o header Authorization: Bearer <idToken>.');
      return;
    }

    let uid;
    try {
      const decoded = await getAuth().verifyIdToken(match[1]);
      uid = decoded.uid;
    } catch (e) {
      res.status(401).send('Token inválido ou expirado.');
      return;
    }

    const action = (req.body || {}).action;
    if (!VALID_ACTIONS.has(action)) {
      res.status(400).json({ error: 'invalid_action' });
      return;
    }

    try {
      const result = await controlPlayback(getDatabase(), SPOTIFY_CLIENT_SECRET.value(), uid, action);
      if (result.error) {
        res.status(STATUS_BY_ERROR[result.error] || 500).json(result);
        return;
      }
      res.status(200).json({ ok: true });
    } catch (e) {
      console.error('[spotifyPlayback] falha:', e);
      res.status(500).json({ error: 'playback_failed' });
    }
  }
);
