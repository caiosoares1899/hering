// functions/spotify/radioSuggest.js
//
// Wrapper onRequest em cima de radioSuggestCore.js (mesmo motivo de
// sync.js vs. syncCore.js). Qualquer pessoa @ciahering.com.br logada no
// Maré pode sugerir (não precisa ter conectado o próprio Spotify) — verifica
// o ID token do Firebase Auth E o domínio (achado de análise de segurança,
// 2026-09-17: só checava o token, "porque o Firebase Auth do projeto já
// restringe quem consegue logar" — suposição errada, ver
// database.rules.json/painel.html da mesma rodada: o `hd` do
// GoogleAuthProvider é só dica de UI, não é imposto pelo Firebase Auth,
// então QUALQUER conta Google conseguia autenticar e usar este endpoint).
// Moderação: livre total, entra direto na playlist, sem fila de aprovação
// nem log de auditoria nesta v1 (decisão combinada — mesmo espírito de
// confiança do resto do app) — mas só pra playlist REGISTRADA de verdade
// (ver isRegisteredPlaylist() abaixo), não qualquer id que o chamador
// mandar: sem essa checagem, o token de escrita da CONTA DONA
// (playlist-modify-*, vale pra qualquer playlist que ela edite) deixava
// injetar faixa em QUALQUER playlist da conta dona, não só a Rádio do Maré.
const { onRequest } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
const { defineSecret } = require('firebase-functions/params');
const { suggestTrack } = require('./radioSuggestCore');

const SPOTIFY_CLIENT_SECRET = defineSecret('SPOTIFY_CLIENT_SECRET');
const SITE_ORIGIN = 'https://caiosoares1899.github.io';

// Squads fixos que nunca têm entrada em squads_meta (mesmo motivo/mesma
// lista de SQUAD_FALLBACK em functions/intake/submit.js) + squads fictícios
// de dev/teste (kanban-dev.html aponta pro MESMO endpoint de produção,
// então um registro de playlist feito lá também precisa validar).
const KNOWN_SQUADS = ['dados', 'prf', 'midiacriativa', 'dev', 'gestao', 'omnichannel'];

async function listAllSquadIds(db) {
  const metaSnap = await db.ref('kanban/squads_meta').get();
  const meta = metaSnap.val() || {};
  return Array.from(new Set([...KNOWN_SQUADS, ...Object.keys(meta)]));
}

// Confere o playlistId mandado pelo chamador contra os pointers de verdade
// que o app já mantém (kanban/painel/radio_geral e kanban/squads/{id}/dados/
// radio_squad — ver renderSpotifyPlaylist()/registrarSpotifyPlaylist() em
// kanban.html) — só esses foram registrados por alguém com permissão de
// escrita nesses nós (gated por database.rules.json), nunca um id
// arbitrário vindo direto do corpo da requisição.
async function isRegisteredPlaylist(db, playlistId) {
  const geralSnap = await db.ref('kanban/painel/radio_geral/playlistId').get();
  if (geralSnap.val() === playlistId) return true;
  const squadIds = await listAllSquadIds(db);
  const snaps = await Promise.all(
    squadIds.map((sq) => db.ref(`kanban/squads/${sq}/dados/radio_squad/playlistId`).get())
  );
  return snaps.some((snap) => snap.val() === playlistId);
}

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
    let email;
    try {
      const decoded = await getAuth().verifyIdToken(match[1]);
      email = decoded.email || '';
    } catch (e) {
      res.status(401).send('Token inválido ou expirado.');
      return;
    }
    if (!email.toLowerCase().endsWith('@ciahering.com.br')) {
      res.status(403).json({ error: 'domain_not_allowed' });
      return;
    }

    const { playlistId, trackUri } = req.body || {};
    if (!playlistId || typeof playlistId !== 'string' || !trackUri || typeof trackUri !== 'string') {
      res.status(400).send('Faltou playlistId ou trackUri.');
      return;
    }

    const db = getDatabase();
    if (!(await isRegisteredPlaylist(db, playlistId))) {
      res.status(403).json({ error: 'playlist_not_registered' });
      return;
    }

    try {
      await suggestTrack(db, SPOTIFY_CLIENT_SECRET.value(), playlistId, trackUri);
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
