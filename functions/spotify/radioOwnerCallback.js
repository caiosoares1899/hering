// functions/spotify/radioOwnerCallback.js
//
// Callback do OAuth da CONTA DONA das playlists da Rádio do Maré — troca
// o `code` por tokens com escopo de ESCRITA em playlist
// (playlist-modify-public/playlist-modify-private), grava o
// refresh_token em kanban/spotify_radio_owner_secret (deny total, mesmo
// padrão de spotify_secrets — ver database.rules.json).
//
// Diferente de spotifyOauthCallback (uma conexão POR PESSOA, disparada
// pelo botão "Conectar Spotify" de cada membro do squad, resolvida via
// state/oauth_pending pra saber qual uid da Firebase iniciou o fluxo),
// esta é uma conexão ÚNICA, feita manualmente uma vez pela pessoa dona
// da conta que vai hospedar as playlists — não tem uid nenhum envolvido
// (é sempre a mesma conta fixa), então não passa pelo fluxo
// state/oauth_pending. O `state` ainda é enviado (recomendação padrão
// OAuth contra CSRF) mas validado contra um valor fixo, não contra um
// registro no banco — não existe uma "URL pública" que dispare isso, é
// uma URL entregue manualmente, uma vez, fora do app.
//
// IMPORTANTE (achado em produção, ver CHANGELOG "Cloud Functions —
// Spotify" de 2026-07-31): mesmo com token válido e escopo certo, a
// conta que autoriza aqui PRECISA estar cadastrada manualmente em
// Spotify for Developers → app → "Users and Access" (Development Mode
// limita a poucos usuários allowlistados) — senão toda chamada de
// escrita à Web API feita com o token dela volta 403, sem relação
// nenhuma com bug de código.
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getDatabase } = require('firebase-admin/database');

const SPOTIFY_CLIENT_SECRET = defineSecret('SPOTIFY_CLIENT_SECRET');
const SPOTIFY_CLIENT_ID = '737e3e1ce3d449dc955c0d4c7657bb6b';
const REDIRECT_URI = 'https://us-central1-hering-onboarding.cloudfunctions.net/spotifyRadioOwnerCallback';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const EXPECTED_STATE = 'radio-owner-connect-v1';

exports.spotifyRadioOwnerCallback = onRequest(
  { region: 'us-central1', secrets: [SPOTIFY_CLIENT_SECRET] },
  async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
      res.status(400).send('Autorização negada no Spotify: ' + error);
      return;
    }
    if (state !== EXPECTED_STATE) {
      res.status(400).send('state inválido — use a URL de autorização gerada especificamente pra isso.');
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
        console.error('[spotifyRadioOwnerCallback] troca de token falhou:', tokenRes.status, body);
        res.status(500).send('Falha ao trocar o code por token — ver logs da function.');
        return;
      }
      tokenData = await tokenRes.json();
    } catch (e) {
      console.error('[spotifyRadioOwnerCallback] erro ao trocar o code:', e);
      res.status(500).send('Erro inesperado — ver logs da function.');
      return;
    }

    if (!tokenData.refresh_token) {
      res.status(500).send(
        'Resposta do Spotify sem refresh_token. Se você já tinha autorizado este app antes ' +
        'com escopos diferentes, revogue o acesso em https://www.spotify.com/account/apps/ e ' +
        'reautorize do zero pela URL de conexão.'
      );
      return;
    }

    await getDatabase().ref('kanban/spotify_radio_owner_secret').set({
      refresh_token: tokenData.refresh_token,
      connectedAt: new Date().toISOString(),
    });

    res.status(200).send('Conta dona da Rádio do Maré conectada com sucesso. Pode fechar esta aba.');
  }
);
