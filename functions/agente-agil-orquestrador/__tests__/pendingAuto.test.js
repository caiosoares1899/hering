// functions/agente-agil-orquestrador/__tests__/pendingAuto.test.js
//
// Cobertura de pendingAuto.js — a fila que avisa o cliente (kanban-dev.html)
// que uma mutação do orquestrador aconteceu e precisa ser checada contra as
// Automações (AUTO_TRIGGERS/runAutoRules), já que o motor de Automações só
// existe no cliente (ver comentário grande em pendingAuto.js e em
// _claimPendingAuto() no kanban-dev.html).
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { enqueuePendingAuto, enqueuePendingAutoFromDiff } = require('../pendingAuto');

function pendingEntries(db, squadId) {
  const node = db._data().kanban?.squads?.[squadId]?.dados?.agente_pending_auto || {};
  return Object.values(node);
}

test('enqueuePendingAuto grava um registro com eventType/cardId/extra/ts', async () => {
  const db = makeFakeDb({ kanban: { squads: { dev: { dados: {} } } } });
  await enqueuePendingAuto(db, 'dev', { eventType: 'move', cardId: 'c9', extra: 'done' });

  const entries = pendingEntries(db, 'dev');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].eventType, 'move');
  assert.equal(entries[0].cardId, 'c9');
  assert.equal(entries[0].extra, 'done');
  assert.ok(entries[0].ts);
});

test('enqueuePendingAuto grava extra:null quando omitido (evento sem valor associado, ex.: priority/risk_added/checklist_complete)', async () => {
  const db = makeFakeDb({ kanban: { squads: { dev: { dados: {} } } } });
  await enqueuePendingAuto(db, 'dev', { eventType: 'risk_added', cardId: 'c9' });

  const entries = pendingEntries(db, 'dev');
  assert.equal(entries[0].extra, null);
});

test('enqueuePendingAutoFromDiff: card.col mudou -> enfileira move com a coluna nova', async () => {
  const db = makeFakeDb({ kanban: { squads: { dev: { dados: {} } } } });
  await enqueuePendingAutoFromDiff(db, 'dev', 'c9', { col: 'todo' }, { col: 'done' });

  const entries = pendingEntries(db, 'dev');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].eventType, 'move');
  assert.equal(entries[0].extra, 'done');
});

test('enqueuePendingAutoFromDiff: nada mudou -> não enfileira nada', async () => {
  const db = makeFakeDb({ kanban: { squads: { dev: { dados: {} } } } });
  const card = { col: 'todo', priority: 'high', tags: ['a', 'b'], checklist: [{ done: true }], riscos: ['r1'] };
  await enqueuePendingAutoFromDiff(db, 'dev', 'c9', card, { ...card });

  assert.deepEqual(pendingEntries(db, 'dev'), []);
});

test('enqueuePendingAutoFromDiff: priority mudou -> enfileira priority (sem extra)', async () => {
  const db = makeFakeDb({ kanban: { squads: { dev: { dados: {} } } } });
  await enqueuePendingAutoFromDiff(db, 'dev', 'c9', { priority: 'medium' }, { priority: 'high' });

  const entries = pendingEntries(db, 'dev');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].eventType, 'priority');
  assert.equal(entries[0].extra, null);
});

test('enqueuePendingAutoFromDiff: priority sumiu (virou vazio) -> NÃO enfileira (mesma regra do cliente: só dispara priority_set com um valor de verdade)', async () => {
  const db = makeFakeDb({ kanban: { squads: { dev: { dados: {} } } } });
  await enqueuePendingAutoFromDiff(db, 'dev', 'c9', { priority: 'high' }, { priority: '' });

  assert.deepEqual(pendingEntries(db, 'dev'), []);
});

test('enqueuePendingAutoFromDiff: tags — 1 adicionada e 1 removida -> enfileira tag_added e tag_removed, cada um só pra sua tag', async () => {
  const db = makeFakeDb({ kanban: { squads: { dev: { dados: {} } } } });
  await enqueuePendingAutoFromDiff(db, 'dev', 'c9', { tags: ['tag_1'] }, { tags: ['tag_2'] });

  const entries = pendingEntries(db, 'dev');
  assert.equal(entries.length, 2);
  assert.ok(entries.some((e) => e.eventType === 'tag_added' && e.extra === 'tag_2'));
  assert.ok(entries.some((e) => e.eventType === 'tag_removed' && e.extra === 'tag_1'));
});

test('enqueuePendingAutoFromDiff: checklist chegou a 100% -> enfileira checklist_complete', async () => {
  const db = makeFakeDb({ kanban: { squads: { dev: { dados: {} } } } });
  const before = { checklist: [{ done: true }, { done: false }] };
  const after = { checklist: [{ done: true }, { done: true }] };
  await enqueuePendingAutoFromDiff(db, 'dev', 'c9', before, after);

  const entries = pendingEntries(db, 'dev');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].eventType, 'checklist_complete');
});

test('enqueuePendingAutoFromDiff: checklist já estava 100% antes -> não enfileira de novo (marcar/desmarcar um item que não muda o total de done não conta)', async () => {
  const db = makeFakeDb({ kanban: { squads: { dev: { dados: {} } } } });
  const checklist = [{ done: true }, { done: true }];
  await enqueuePendingAutoFromDiff(db, 'dev', 'c9', { checklist }, { checklist: [...checklist] });

  assert.deepEqual(pendingEntries(db, 'dev'), []);
});

test('enqueuePendingAutoFromDiff: riscos.length aumentou -> enfileira risk_added', async () => {
  const db = makeFakeDb({ kanban: { squads: { dev: { dados: {} } } } });
  await enqueuePendingAutoFromDiff(db, 'dev', 'c9', { riscos: [] }, { riscos: ['Fornecedor pode atrasar'] });

  const entries = pendingEntries(db, 'dev');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].eventType, 'risk_added');
});

test('enqueuePendingAutoFromDiff: vários campos mudam juntos (editar_campos com tags+priority) -> enfileira um evento por mudança', async () => {
  const db = makeFakeDb({ kanban: { squads: { dev: { dados: {} } } } });
  const before = { priority: 'medium', tags: ['tag_1'] };
  const after = { priority: 'high', tags: ['tag_1', 'tag_2'] };
  await enqueuePendingAutoFromDiff(db, 'dev', 'c9', before, after);

  const entries = pendingEntries(db, 'dev');
  assert.equal(entries.length, 2);
  assert.ok(entries.some((e) => e.eventType === 'priority'));
  assert.ok(entries.some((e) => e.eventType === 'tag_added' && e.extra === 'tag_2'));
});
