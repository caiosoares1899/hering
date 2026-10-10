// functions/common/__tests__/notifConfig.test.js — interruptores da Central de Notificações (ver notifConfig.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { lerConfigTipo, pushPermitido } = require('../notifConfig');

test('pushPermitido: sem config vale o padrão (PUSH_TYPES)', () => {
  assert.equal(pushPermitido({}, true), true);
  assert.equal(pushPermitido({}, false), false);
  assert.equal(pushPermitido(undefined, true), true);
});
test('pushPermitido: push:false bloqueia mesmo dentro do PUSH_TYPES; push:true libera mesmo fora', () => {
  assert.equal(pushPermitido({ push: false }, true), false);
  assert.equal(pushPermitido({ push: true }, false), true);
});
test('pushPermitido: valor que não é booleano é ignorado (vale o padrão)', () => {
  assert.equal(pushPermitido({ push: 'false' }, true), true);
  assert.equal(pushPermitido({ push: 0 }, true), true);
  assert.equal(pushPermitido({ sino: false }, true), true);   // o sino não afeta o push
});
test('lerConfigTipo: lê o nó do tipo; ausente = {}', async () => {
  const db = makeFakeDb({ kanban: { notif_config: { done: { push: true, por: 'Ana' } } } });
  assert.deepEqual(await lerConfigTipo(db, 'done'), { push: true, por: 'Ana' });
  assert.deepEqual(await lerConfigTipo(db, 'mention'), {});
});
test('lerConfigTipo: tipo estranho (vem do banco) nunca vira caminho — devolve {} sem lançar', async () => {
  const db = makeFakeDb({ kanban: { notif_config: { x: { push: false } } } });
  for (const t of [undefined, null, '', 'a.b', 'a/b', 'A B', 'x'.repeat(50), '$x', '../x', 42]) assert.deepEqual(await lerConfigTipo(db, t), {});
});
test('lerConfigTipo: erro de leitura não derruba (devolve {})', async () => {
  const db = { ref() { return { get() { throw new Error('permission_denied'); } }; } };
  assert.deepEqual(await lerConfigTipo(db, 'mention'), {});
});
