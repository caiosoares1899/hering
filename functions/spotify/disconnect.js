// functions/spotify/disconnect.js
//
// Desconecta o Spotify de quem chama — apaga de verdade o refresh_token
// (não uma flag de "inativo"), e limpa todo o status público espalhado
// (senão o último "ouvindo agora" ficaria congelado pra sempre no painel
// dos outros, já que ninguém mais escreveria ali depois da desconexão).
//
// Diferente de spotifyOauthCallback (chamado via REDIRECT do navegador,
// sem CORS envolvido), esta function é chamada via fetch() direto do
// kanban.html — precisa de CORS habilitado e de verificar quem está
// chamando. Não usa onCall/httpsCallable (exigiria importar o SDK de
// Functions no client, que hoje não existe em nenhuma página do app) —
// verifica o ID token manualmente, mesmo espírito do resto do projeto
// (agente-agil/http.js verifica um header customizado à mão).
//
// A ausência de uma entrada em kanban/spotify_secrets/{uid} É o sinal de
// "não sincronizar essa pessoa" pra spotifySync — não existe uma flag
// "ativo"/"inativo" separada de propósito, pra não criar um jeito dessas
// duas informações (token existe vs. sincronização ligada) ficarem
// desencontradas. spotifySync também dispara essa mesma desconexão
// sozinho quando o refresh_token vem invalid_grant (ver _shared.js).
const { onRequest } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
const { buildDisconnectUpdates } = require('./_shared');

const SITE_ORIGIN = 'https://caiosoares1899.github.io';

exports.spotifyDisconnect = onRequest(
  { region: 'us-central1', cors: SITE_ORIGIN },
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

    const db = getDatabase();
    const updates = await buildDisconnectUpdates(db, uid);
    await db.ref().update(updates);

    res.status(200).json({ ok: true });
  }
);
