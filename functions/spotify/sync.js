// functions/spotify/sync.js
//
// Wrapper onSchedule (Cloud Scheduler, gatilho a cada 1 minuto — mínimo
// que o Scheduler permite via cron, não dá pra agendar sub-minuto
// diretamente) em cima da lógica pura de functions/spotify/syncCore.js.
// Roda independente de qualquer painel estar aberto (o client é 100%
// lazy, só LÊ; ver kanban-dev.html) — é esta function que efetivamente
// decide o que existe em spotify_now (por squad) e spotify_now_geral.
// Separado do core pelo mesmo motivo de agente-agil/http.js vs.
// agente-agil/board.js: a parte testável com node:test (ver
// __tests__/sync.test.js) não deveria depender do runtime de Cloud
// Functions pra rodar.
//
// Cadência efetiva de 30s: como o Cloud Scheduler não agenda sub-minuto,
// cada invocação (1x/min) roda o sync DUAS vezes, com uma pausa de 30s no
// meio — mesmo custo total de API por dia que rodar nativamente a cada
// 30s (calculado e aprovado antes de implementar), só a mecânica de
// disparo que é diferente. timeoutSeconds aumentado de propósito (default
// de 60s ficaria justo demais pra caber 30s de pausa + 2 execuções reais).
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { getDatabase } = require('firebase-admin/database');
const { runSpotifySync } = require('./syncCore');

const SPOTIFY_CLIENT_SECRET = defineSecret('SPOTIFY_CLIENT_SECRET');

function _sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

exports.spotifySync = onSchedule(
  { schedule: '* * * * *', region: 'us-central1', secrets: [SPOTIFY_CLIENT_SECRET], timeoutSeconds: 90 },
  async () => {
    const db = getDatabase();
    const clientSecret = SPOTIFY_CLIENT_SECRET.value();
    await runSpotifySync(db, clientSecret);
    await _sleep(30000);
    await runSpotifySync(db, clientSecret);
  }
);
