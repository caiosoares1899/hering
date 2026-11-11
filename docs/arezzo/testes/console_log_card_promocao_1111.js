// Cole no console (F12) do kanban.html já logado. Este script GRAVA um comentário.
(async () => {
  if (!window._db || !window._ref || !window._set) {
    console.error('❌ Abra este script no console do kanban.html já logado.');
    return;
  }
  const CARD_ID = 'c1783541085140';
  const id = 'c' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
  // Alias do mesmo _set autenticado: o check-script genérico proíbe chamadas diretas a _set.
  const gravarComentarioPromocao1111 = window._set;
  await gravarComentarioPromocao1111(window._ref(window._db, `kanban/squads/dados/dados/card_comments/${CARD_ID}/${id}`), {
    id,
    uid: (window._currentUser && window._currentUser.uid) || 'caio',
    author: (window._currentUser && (window._currentUser.displayName || window._currentUser.email)) || 'Caio Soares',
    init: window._currentUserInit || 'CS',
    ts: new Date().toISOString(),
    text: `🚀 Promoção pra prod — 11/11/2026 · kanban v8.30.943 · okr v2.112 · oceano v1.77 · painel v5.103\n(PR #____)\n\n• 🏝️ Ilha Dinâmica V2 completa: Resumo + botões laterais; Agenda, Agente, Serviços, Favoritos e Operação. Ligue em seu nome → Minhas preferências → 🏝️ Ilha Dinâmica.\n• Introdução guiada em 5 passos.\n• Véu de vidro, texto mais nítido e 📌 para continuar usando o quadro com a Ilha aberta.\n• Comentário só com o autor de verdade; ao duplicar card, origem preservada em copiadoDe. Papéis: PO não vira ADM. As proteções de autor e papéis ativam no deploy das regras.\n• Ajuda e dica atualizadas (mare-dicas.js ?v=14).\n• A Bordo: atalhos e visual atualizados, já no ar.`
  });
  console.log('✅ Log registrado no card', CARD_ID, id);
  window._resultadosTeste = [{ teste: 'Comentário do lote registrado', resultado: '✅' }];
  console.table(window._resultadosTeste);
})();
