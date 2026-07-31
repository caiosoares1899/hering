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

module.exports = { buildDisconnectUpdates };
