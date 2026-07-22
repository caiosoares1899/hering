// Testa só o núcleo puro (validar envelope -> montar plano de writes), sem
// tocar no banco. Teste de integração ponta a ponta (resolveCardKey,
// applyWritePlan, o endpoint HTTP) fica pro Firebase Emulator Suite —
// não coberto aqui.

const test = require('node:test');
const assert = require('node:assert/strict');

const { envelope } = require('../schema');
const { buildWritePlan, CARDS_PATH } = require('../board');

test('envelope aceita payload v0 válido com outputs comentario e link', () => {
  const result = envelope.safeParse({
    requestId: 'req-abc123',
    cardId: 'c123',
    status: 'success',
    outputs: [
      { type: 'comentario', texto: 'Relatório pronto' },
      { type: 'link', url: 'https://example.com/relatorio', titulo: 'Relatório diário' },
    ],
  });
  assert.equal(result.success, true);
});

test('envelope rejeita output de tipo ainda não suportado no v0', () => {
  const result = envelope.safeParse({
    requestId: 'req-abc123',
    cardId: 'c123',
    status: 'success',
    outputs: [{ type: 'checklistItem', texto: 'x', done: true }],
  });
  assert.equal(result.success, false);
});

test('envelope rejeita link sem url válida', () => {
  const result = envelope.safeParse({
    requestId: 'req-abc123',
    cardId: 'c123',
    status: 'success',
    outputs: [{ type: 'link', url: 'not-a-url', titulo: 'x' }],
  });
  assert.equal(result.success, false);
});

test('buildWritePlan monta update multi-path pra comentario', () => {
  const plan = buildWritePlan('5', [{ type: 'comentario', texto: 'oi' }]);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].kind, 'update');
  assert.equal(plan[0].path, `${CARDS_PATH}/5/comments`);
  const [commentId, comment] = Object.entries(plan[0].data)[0];
  assert.equal(comment.id, commentId);
  assert.equal(comment.text, 'oi');
});

test('buildWritePlan monta transaction escopada em links pra link', () => {
  const plan = buildWritePlan('5', [{ type: 'link', url: 'https://x.com', titulo: 'X' }]);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].kind, 'transaction');
  assert.equal(plan[0].path, `${CARDS_PATH}/5/links`);
  const result = plan[0].transform(null);
  assert.equal(result.length, 1);
  assert.equal(result[0].url, 'https://x.com');
});

test('buildWritePlan preserva links existentes na transaction', () => {
  const plan = buildWritePlan('5', [{ type: 'link', url: 'https://novo.com', titulo: 'Novo' }]);
  const existing = [{ id: 'lnk1', url: 'https://antigo.com', title: 'Antigo', ts: '2026-01-01' }];
  const result = plan[0].transform(existing);
  assert.equal(result.length, 2);
  assert.equal(result[0], existing[0]);
});

test('buildWritePlan rejeita output sem builder registrado', () => {
  assert.throws(() => buildWritePlan('5', [{ type: 'mover_coluna' }]));
});
