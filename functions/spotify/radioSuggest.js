// functions/spotify/radioSuggest.js
//
// Wrapper onRequest em cima de radioSuggestCore.js (mesmo motivo de
// sync.js vs. syncCore.js). Qualquer pessoa logada no Maré pode sugerir
// (não precisa ter conectado o próprio Spotify) — só verifica o ID token
// do Firebase Auth. Moderação: livre total, entra direto na playlist,
// sem fila de aprovação nem log de auditoria nesta v1 (decisão
// combinada — mesmo espírito de confiança do resto do app).
const { onRequest } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
const { defineSecret } = require('firebase-functions/params');
const { suggestTrack } = require('./radioSuggestCore');

const SPOTIFY_CLIENT_SECRET = defineSecret('SPOTIFY_CLIENT_SECRET');
const SITE_ORIGIN = 'https://caiosoares1899.github.io';

exports.spotifyRadioSuggest = onRequest(
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
    try {
      await getAuth().verifyIdToken(match[1]);
    } catch (e) {
      res.status(401).send('Token inválido ou expirado.');
      return;
    }

    const { playlistId, trackUri } = req.body || {};
    if (!playlistId || typeof playlistId !== 'string' || !trackUri || typeof trackUri !== 'string') {
      res.status(400).send('Faltou playlistId ou trackUri.');
      return;
    }

    try {
      await suggestTrack(getDatabase(), SPOTIFY_CLIENT_SECRET.value(), playlistId, trackUri);
      res.status(200).json({ ok: true });
    } catch (e) {
      const msg = String((e && e.message) || e);
      console.error('[spotifyRadioSuggest] falha ao adicionar faixa:', e);
      if (msg.includes('radio_owner_not_connected')) {
        res.status(503).json({ error: 'radio_owner_not_connected' });
        return;
      }
      // Detalhe do erro real (do Spotify, ou da troca de token) — não é
      // segredo nenhum, é só o texto de erro público da API deles (ex:
      // "Insufficient client scope", "Invalid playlist Id"). Devolvido
      // pra UI mostrar direto no toast, sem precisar de ninguém entrar
      // no Cloud Logging pra descobrir o que aconteceu.
      res.status(500).json({ error: 'add_track_failed', detail: msg.slice(0, 300) });
    }
  }
);
