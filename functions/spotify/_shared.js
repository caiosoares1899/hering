// functions/spotify/_shared.js
//
// Monta o multi-path update que desconecta alguém do Spotify de verdade —
// apaga o refresh_token e todo o status público espalhado pelos squads +
// geral. Usado tanto por spotifyDisconnect (a pessoa clicou "Desconectar")
// quanto por spotifySync (o refresh_token veio invalid_grant — a pessoa
// revogou o acesso direto pela tela "Apps conectados" do Spotify, sem
// passar pelo nosso botão). Os dois casos têm que apagar exatamente as
// mesmas coisas, então ficam num lugar só em vez de duas cópias que podem
// divergir se alguém adicionar um novo path de status no futuro.
async function buildDisconnectUpdates(db, uid) {
  const squadsSnap = await db.ref('kanban/usuarios/' + uid + '/squads').get();
  const squadsMap = squadsSnap.val() || {};
  const squadIds = Object.keys(squadsMap).filter((sq) => squadsMap[sq] === true);

  const updates = {
    ['kanban/spotify_secrets/' + uid]: null,
    ['kanban/usuarios/' + uid + '/spotify_connected']: null,
    ['kanban/painel/spotify_now_geral/' + uid]: null,
  };
  squadIds.forEach((sq) => {
    updates['kanban/squads/' + sq + '/dados/spotify_now/' + uid] = null;
  });
  return updates;
}

// Destino do redirect de volta do OAuth do Spotify. Achado real (/monitorarbugs
// 2026-10-05, áreas sensíveis): `returnUrl` é gravado pelo CLIENTE em
// kanban/oauth_pending/{state} (a regra só exige que o `uid` seja o do próprio
// usuário) e spotifyOauthCallback fazia `res.redirect(pending.returnUrl + ...)`
// sem validar nada — qualquer conta autenticada gravava um `returnUrl` qualquer e
// passava a ter um redirecionamento aberto servido de um domínio confiável
// (`...cloudfunctions.net/spotifyOauthCallback?state=X&error=1` → 302 pra onde ela
// quisesse), útil pra phishing. Só aceita páginas do próprio site.
const ALLOWED_RETURN_ORIGIN = 'https://caiosoares1899.github.io';
function isAllowedReturnUrl(u) {
  if (typeof u !== 'string' || u.length > 500) return false;
  let parsed;
  try { parsed = new URL(u); } catch (_) { return false; }
  return parsed.origin === ALLOWED_RETURN_ORIGIN && parsed.protocol === 'https:' && !parsed.username && !parsed.password;
}

module.exports = { buildDisconnectUpdates, isAllowedReturnUrl, ALLOWED_RETURN_ORIGIN };
