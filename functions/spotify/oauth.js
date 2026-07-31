// functions/spotify/oauth.js
//
// Callback do OAuth do Spotify — troca o `code` que o Spotify manda de
// volta por um access_token + refresh_token, e grava o refresh_token em
// kanban/spotify_secrets/{uid} (ver database.rules.json: esse nó não é
// legível nem gravável por nenhum cliente, só por Admin SDK).
//
// Não existe uma function separada pra "iniciar" o OAuth — o client_id
// não é secreto, então o kanban.html monta o link de autorização
// (https://accounts.spotify.com/authorize?...) direto no navegador, sem
// passar por servidor nenhum. Só a troca do code (que exige o
// client_secret) precisa de function.
//
// Como o Spotify não sabe nada sobre Firebase Auth, o cliente precisa
// avisar ESTA function qual uid iniciou o fluxo. Isso é feito via um
// `state` aleatório: o cliente grava kanban/oauth_pending/{state} =
// {uid, returnUrl} ANTES de ir pro Spotify, e esta function lê + apaga
// (uso único) esse registro quando o Spotify redireciona de volta com o
// mesmo state.
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getDatabase } = require('firebase-admin/database');

const SPOTIFY_CLIENT_SECRET = defineSecret('SPOTIFY_CLIENT_SECRET');

// Não é secreto (o próprio Spotify espera esse valor exposto no client) —
// por isso vive como constante de código, não Secret Manager.
const SPOTIFY_CLIENT_ID = '737e3e1ce3d449dc955c0d4c7657bb6b';

// Confirmada batendo com a Redirect URI cadastrada no formulário do
// Spotify for Developers após o primeiro deploy (ver CHANGELOG).
const REDIRECT_URI = 'https://us-central1-hering-onboarding.cloudfunctions.net/spotifyOauthCallback';

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

exports.spotifyOauthCallback = onRequest(
  { region: 'us-central1', secrets: [SPOTIFY_CLIENT_SECRET] },
  async (req, res) => {
    const { code, state, error } = req.query;
    const db = getDatabase();

    if (!state || typeof state !== 'string') {
      res.status(400).send('Requisição inválida: state ausente.');
      return;
    }

    // Consome o state ANTES de qualquer outra coisa — uso único, evita
    // que um redirect repetido (ex.: usuário atualiza a página de volta)
    // tente gravar de novo com um state já usado.
    const pendingRef = db.ref('kanban/oauth_pending/' + state);
    const pendingSnap = await pendingRef.get();
    const pending = pendingSnap.val();
    await pendingRef.remove();

    if (!pending || !pending.uid || !pending.returnUrl) {
      res.status(400).send('Sessão de conexão com o Spotify expirada ou inválida — tente conectar de novo.');
      return;
    }

    if (error) {
      // Usuário negou a autorização na tela do Spotify, ou algum outro erro
      // do lado deles — não é uma falha do nosso código.
      res.redirect(pending.returnUrl + '?spotify=error');
      return;
    }

    if (!code || typeof code !== 'string') {
      res.status(400).send('Requisição inválida: code ausente.');
      return;
    }

    let tokenData;
    try {
      const tokenRes = await fetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
          client_id: SPOTIFY_CLIENT_ID,
          client_secret: SPOTIFY_CLIENT_SECRET.value(),
        }),
      });
      if (!tokenRes.ok) {
        const body = await tokenRes.text().catch(() => '');
        console.error('[spotifyOauthCallback] troca de token falhou:', tokenRes.status, body);
        res.redirect(pending.returnUrl + '?spotify=error');
        return;
      }
      tokenData = await tokenRes.json();
    } catch (e) {
      console.error('[spotifyOauthCallback] erro ao trocar o code:', e);
      res.redirect(pending.returnUrl + '?spotify=error');
      return;
    }

    // "connected" (primeira vez) vs "reconnected" (já estava conectado,
    // trocou de conta/re-autorizou) — o cliente manda esse contexto no
    // próprio oauth_pending (ele sabia, antes de sair pro Spotify, se já
    // tinha spotify_connected=true) e a function só ecoa de volta na URL,
    // pra mostrar um toast diferente ("conta atualizada" vs "conectado").
    const resultParam = pending.wasConnected ? 'reconnected' : 'connected';

    if (!tokenData.refresh_token) {
      // Não deveria acontecer no primeiro consentimento (scope pedido inclui
      // acesso offline), mas Spotify não devolve refresh_token de novo se a
      // pessoa já tinha autorizado o app antes e a autorização ainda for
      // válida — nesse caso o token antigo continua servindo, não é erro.
      // Ainda assim garante a flag pública (idempotente — pode já estar true).
      console.warn('[spotifyOauthCallback] resposta sem refresh_token pra uid', pending.uid, '— mantendo o token existente, se houver.');
      await db.ref('kanban/usuarios/' + pending.uid + '/spotify_connected').set(true);
      res.redirect(pending.returnUrl + '?spotify=' + resultParam);
      return;
    }

    // Duas gravações atômicas: o token em si (privado, spotify_secrets — ver
    // database.rules.json) e uma flag PÚBLICA (spotify_connected, dentro de
    // usuarios/{uid}, que já é legível por qualquer pessoa logada) — o
    // cliente não consegue ler spotify_secrets pra saber se já está
    // conectado (por isso "Conectar" vira "Trocar conta" na UI), então
    // precisa desse sinal separado, sem token nenhum nele.
    await db.ref().update({
      ['kanban/spotify_secrets/' + pending.uid]: {
        refresh_token: tokenData.refresh_token,
        connectedAt: new Date().toISOString(),
      },
      ['kanban/usuarios/' + pending.uid + '/spotify_connected']: true,
    });

    res.redirect(pending.returnUrl + '?spotify=' + resultParam);
  }
);
