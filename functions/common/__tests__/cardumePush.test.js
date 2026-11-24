const test = require('node:test');
const assert = require('node:assert/strict');
const { mencaoConfere, mencaoValida } = require('../cardumePush');

const notif = { type: 'cardume_mencao', cardumeRef: 'x1', title: '🐟 Ana te mencionou no Cardume' };
const rec = { c: 'dados', m: '-Nmsg1', de: 'ana', ts: 1, n: 'n123' };
const fakeDb = arvore => ({ ref: p => ({ get: async () => ({ val: () => p.split('/').reduce((a, k) => (a == null ? null : a[k]), arvore) ?? null }) }) });

test('push só com registro privado que aponta para ESTA notificação', () => {
  assert.equal(mencaoConfere(notif, 'n123', rec), true);
  assert.equal(mencaoConfere(notif, 'n999', rec), false, 'cardumeRef real copiado para outra notificação (replay)');
  assert.equal(mencaoConfere(notif, 'n123', null), false, 'sem registro (notificação forjada)');
  assert.equal(mencaoConfere({ type: 'mention', cardumeRef: 'x1' }, 'n123', rec), false, 'outro tipo');
  assert.equal(mencaoConfere(Object.assign({}, notif, { cardumeRef: '../x' }), 'n123', rec), false, 'ref com caractere estranho');
  assert.equal(mencaoConfere(notif, 'n123', Object.assign({}, rec, { c: 'x/../y' })), false, 'registro com canal estranho');
});
test('mencaoValida lê o registro do próprio destinatário e nunca lança', async () => {
  const db = fakeDb({ kanban: { cardume: { mencoes: { bru: { x1: rec } } } } });
  assert.equal(await mencaoValida(db, 'bru', notif, 'n123'), true);
  assert.equal(await mencaoValida(db, 'ana', notif, 'n123'), false, 'registro é de outra pessoa');
  assert.equal(await mencaoValida(db, 'bru', notif, 'n1'), false);
  assert.equal(await mencaoValida({ ref: () => ({ get: async () => { throw new Error('rede'); } }) }, 'bru', notif, 'n123'), false, 'erro de leitura = sem push');
});
