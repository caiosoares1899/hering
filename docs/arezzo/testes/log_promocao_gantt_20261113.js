// Depois do merge, cole no console do kanban.html logado para registrar o lote.
(async () => {
  if (!window._db || !window._ref || !window._set || !window._currentUser) {
    console.error('❌ Abra no Maré de produção já logado.'); return;
  }
  const id = 'c' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
  await window._set(window._ref(window._db, `kanban/squads/dados/dados/card_comments/c1783541085140/${id}`), {
    id, uid: window._currentUser.uid,
    author: window._currentUser.displayName || 'ADM', init: window._currentUserInit || '',
    ts: new Date().toISOString(),
    text: '🚀 Promoção do Gantt — 13/11/2026 · kanban v8.30.969. Calendários de Marca, Comercial Hering, Marketplace e Outlet; atualização por qualquer login Hering, histórico e volta de versão; datas-chave, destaques, filtros, balão e navegação por mês. Painel e módulos promovidos juntos; conhecimento do Agente Ágil regenerado.'
  });
  console.log('✅ Promoção registrada no card de melhorias.');
})();
