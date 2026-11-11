// 💬 ANTES do deploy da regra do autor do comentário (database.rules.json → card_comments/.../uid). Cole no console (F12) do kanban.html
// de PRODUÇÃO, logado como ADM. Conta os comentários que ainda moram no campo legado `cards/{key}/comments` e, se você confirmar,
// copia cada um para `card_comments/{cardId}/{id}` com o MESMO autor e texto (as regras antigas ainda deixam). Não apaga o campo legado
// (o próprio Maré faz isso ao abrir o card) e não sobrescreve nada que já exista em card_comments — pode rodar de novo sem efeito.
(async () => {
  if (!window._db || !window._ref || !window._get || !window._update) { console.error('❌ Abra no console do kanban.html já logado.'); return; }
  const meta = (await window._get(window._ref(window._db, 'kanban/squads_meta'))).val() || {};
  const plano = [];
  for (const sq of Object.keys(meta)) {
    const base = 'kanban/squads/' + sq + '/dados';
    let cards = null; try { cards = (await window._get(window._ref(window._db, base + '/cards'))).val(); } catch (e) { console.warn('sem acesso a', sq); continue; }
    const lista = Array.isArray(cards) ? cards : Object.values(cards || {});
    for (const c of lista) {
      if (!c || !c.id || !c.comments || typeof c.comments !== 'object') continue;
      const ja = (await window._get(window._ref(window._db, base + '/card_comments/' + c.id))).val() || {};
      Object.entries(c.comments).forEach(([id, cm]) => { if (cm && typeof cm === 'object' && !ja[id]) plano.push({ sq, base, cardId: c.id, id, cm }); });
    }
  }
  const porSquad = plano.reduce((o, p) => (o[p.sq] = (o[p.sq] || 0) + 1, o), {});
  console.log('📋 Comentários só no campo legado:', plano.length, porSquad);
  if (!plano.length) { console.log('✅ Nada a migrar — pode fazer o deploy das regras.'); return; }
  if (!confirm('Migrar ' + plano.length + ' comentário(s) legado(s) para card_comments (mesmo autor e texto)?')) return;
  let ok = 0, falha = 0;
  for (const p of plano) {
    try { await window._update(window._ref(window._db, p.base + '/card_comments/' + p.cardId), { [p.id]: Object.assign({ id: p.id }, p.cm) }); ok++; }
    catch (e) { falha++; console.warn('falhou', p.sq, p.cardId, p.id, e); }
  }
  console.log(falha ? '⚠️' : '✅', 'Migrados:', ok, '· falhas:', falha, falha ? '— NÃO faça o deploy das regras ainda.' : '— pode fazer o deploy das regras.');
})();
