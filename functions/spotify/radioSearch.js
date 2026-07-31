// functions/spotify/radioSearch.js
//
// Wrapper onRequest em cima de radioSearchCore.js (mesmo motivo de
// sync.js vs. syncCore.js). Qualquer pessoa logada no Maré pode buscar
// (não precisa ter conectado o próprio Spotify pro "ouvindo agora") —
// só verifica o ID token do Firebase Auth, não checa domínio de e-mail
// aqui porque o Firebase Auth do projeto já restringe quem consegue
// logar.
const { onRequest } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const { defineSecret } = require('firebase-functions/params');
const { searchTracks } = require('./radioSearchCore');

const SPOTIFY_CLIENT_SECRET = defineSecret('SPOTIFY_CLIENT_SECRET');
const SITE_ORIGIN = 'https://caiosoares1899.github.io';

exports.spotifyRadioSearch = onRequest(
  { region: 'us-central1', cors: SITE_ORIGIN, secrets: [SPOTIFY_CLIENT_SECRET] },
  async (req, res) => {
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

    const q = (req.query.q || '').toString().trim();
    if (!q) {
      res.status(400).json({ error: 'query vazia' });
      return;
    }

    try {
      const tracks = await searchTracks(SPOTIFY_CLIENT_SECRET.value(), q);
      res.status(200).json({ tracks });
    } catch (e) {
      console.error('[spotifyRadioSearch] falha na busca:', e);
      res.status(500).json({ error: 'search_failed' });
    }
  }
);
