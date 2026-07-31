// functions/spotify/sync.js
//
// Wrapper onSchedule (Cloud Scheduler, a cada minuto — mínimo que o
// Scheduler permite) em cima da lógica pura de functions/spotify/
// syncCore.js. Roda independente de qualquer painel estar aberto (o
// client é 100% lazy, só LÊ; ver kanban-dev.html) — é esta function que
// efetivamente decide o que existe em spotify_now (por squad) e
// spotify_now_geral. Separado do core pelo mesmo motivo de
// agente-agil/http.js vs. agente-agil/board.js: a parte testável com
// node:test (ver __tests__/sync.test.js) não deveria depender do runtime
// de Cloud Functions pra rodar.
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { getDatabase } = require('firebase-admin/database');
const { runSpotifySync } = require('./syncCore');

const SPOTIFY_CLIENT_SECRET = defineSecret('SPOTIFY_CLIENT_SECRET');

exports.spotifySync = onSchedule(
  { schedule: '* * * * *', region: 'us-central1', secrets: [SPOTIFY_CLIENT_SECRET] },
  async () => {
    await runSpotifySync(getDatabase(), SPOTIFY_CLIENT_SECRET.value());
  }
);
