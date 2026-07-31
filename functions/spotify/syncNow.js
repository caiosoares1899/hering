// functions/spotify/syncNow.js
//
// Sync sob demanda de UMA pessoa só, disparado quando ela abre o painel
// "🎧 Spotify" (ver toggleSpotify() em kanban-dev.html) — não espera o
// próximo tick do sync periódico (spotifySync, ver sync.js) pra refletir
// o que está tocando agora.
//
// `uid` vem SEMPRE do ID token decodificado, nunca do corpo da
// requisição — senão qualquer pessoa logada poderia forçar sync de outro
// uid. Rate limit de 10s por uid (ver syncCore.js) evita spam de
// abrir/fechar o painel repetido.
const { onRequest } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
const { defineSecret } = require('firebase-functions/params');
const { syncOneUserNow } = require('./syncCore');

const SPOTIFY_CLIENT_SECRET = defineSecret('SPOTIFY_CLIENT_SECRET');
const SITE_ORIGIN = 'https://caiosoares1899.github.io';

exports.spotifySyncNow = onRequest(
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

    try {
      const result = await syncOneUserNow(getDatabase(), SPOTIFY_CLIENT_SECRET.value(), uid);
      res.status(200).json(result);
    } catch (e) {
      console.error('[spotifySyncNow] falha:', e);
      res.status(500).json({ error: 'sync_failed' });
    }
  }
);
