// 💬 DEPOIS do deploy da regra do autor do comentário. Cole no console (F12) do kanban-dev.html?squad=dev logado. Testa a regra NO
// FIREBASE DE VERDADE num card de teste do squad dev e apaga tudo o que criou. Espera: 6 ✅.
(async () => {
  if (!window._db || !window._ref || !window._set || !window._get) { console.error('❌ Abra no kanban-dev.html?squad=dev já logado.'); return; }
  const me = window._currentUser && window._currentUser.uid; if (!me) { console.error('❌ Faça login.'); return; }
  const base = 'kanban/squads/dev/dados/card_comments', t = 'teste_regra_' + Date.now(), ts = new Date().toISOString();
  const r = p => window._ref(window._db, base + '/' + p);
  const tenta = async (nome, esperado, fn) => { let ok = true; try { await fn(); } catch (e) { ok = false; } console.log((ok === esperado ? '✅ ' : '❌ ') + nome + (ok === esperado ? '' : ' (esperado: ' + (esperado ? 'aceito' : 'recusado') + ')')); };
  const cm = (o) => Object.assign({ author: 'Teste', init: 'TT', text: 'teste da regra', ts }, o);
  await tenta('comentário próprio', true, () => window._set(r(t + '_a/c1'), cm({ id: 'c1', uid: me })));
  await tenta('comentário com uid de OUTRA pessoa', false, () => window._set(r(t + '_a/c2'), cm({ id: 'c2', uid: 'outra_pessoa_teste' })));
  await tenta('uid de sistema (automacao)', true, () => window._set(r(t + '_a/c3'), cm({ id: 'c3', uid: 'automacao' })));
  await tenta('reagir/editar sem trocar o autor (comentário da "automacao")', true, () => window._update(r(t + '_a/c3'), { text: 'editado', reactions: { '👍': { [me]: true } } }));
  await tenta('trocar o autor de um comentário existente', false, () => window._set(r(t + '_a/c3/uid'), me));
  await tenta('gravação com copiadoDe aceita (o caso de outra pessoa está no teste do simulador)', true, () => window._set(r(t + '_b/c3'), cm({ id: 'c3', uid: 'automacao', text: 'editado', reactions: { '👍': { [me]: true } }, copiadoDe: t + '_a' })));
  await window._set(r(t + '_a'), null).catch(() => {}); await window._set(r(t + '_b'), null).catch(() => {});
  console.log('🧹 Limpo:', t);
})();
