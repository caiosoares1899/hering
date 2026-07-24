// Testa resolveReferencia() (Sprint 2) contra um db fake — mesmo espírito dos
// demais testes deste diretório: sem emulador, só a lógica pura de resolução.
// Também cobre a validação XOR cardId/referencia do envelope (schema.js),
// já que as duas mudanças nasceram juntas nesta rodada.

const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveReferencia } = require('../resolver');
const { RECORRENTES_INDEX_PATH } = require('../board');
const { envelope } = require('../schema');

// Fake db mínimo: mesma interface do Admin SDK usada em resolveCardKey
// (db.ref(path).get() -> snap com .val()), sobre um mapa PLANO path->valor
// (path completo como chave, sem navegar segmento por segmento — mais simples
// e menos propenso a erro do que simular a árvore inteira do RTDB).
function fakeDb(pathMap) {
  return {
    ref(path) {
      return {
        get: async () => ({
          val: () => (path in pathMap ? pathMap[path] : null),
        }),
      };
    },
  };
}

test('resolveReferencia acha o cardId certo pra recorrente+data batendo', async () => {
  const db = fakeDb({
    [`${RECORRENTES_INDEX_PATH}/relatorio_diario/2026-07-23`]: 'cAAA',
    [`${RECORRENTES_INDEX_PATH}/relatorio_diario/2026-07-24`]: 'cBBB',
    [`${RECORRENTES_INDEX_PATH}/relatorio_semanal/2026-07-24`]: 'cCCC',
  });
  const cardId = await resolveReferencia(db, { tipo: 'recorrente', nome: 'relatorio_diario', data: '2026-07-24' });
  assert.equal(cardId, 'cBBB');
});

test('resolveReferencia não confunde recorrentes com nomes diferentes na mesma data', async () => {
  const db = fakeDb({
    [`${RECORRENTES_INDEX_PATH}/relatorio_diario/2026-07-24`]: 'cBBB',
    [`${RECORRENTES_INDEX_PATH}/relatorio_semanal/2026-07-24`]: 'cCCC',
  });
  const cardId = await resolveReferencia(db, { tipo: 'recorrente', nome: 'relatorio_semanal', data: '2026-07-24' });
  assert.equal(cardId, 'cCCC');
});

test('resolveReferencia lança referencia_not_found quando a instância de hoje ainda não nasceu', async () => {
  const db = fakeDb({
    // só ontem — hoje ainda não rodou processRecorrentes()
    [`${RECORRENTES_INDEX_PATH}/relatorio_diario/2026-07-23`]: 'cAAA',
  });
  await assert.rejects(
    () => resolveReferencia(db, { tipo: 'recorrente', nome: 'relatorio_diario', data: '2026-07-24' }),
    (err) => {
      assert.equal(err.code, 'referencia_not_found');
      return true;
    }
  );
});

test('resolveReferencia lança referencia_not_found pra recorrente que nunca existiu', async () => {
  const db = fakeDb({});
  await assert.rejects(
    () => resolveReferencia(db, { tipo: 'recorrente', nome: 'relatorio_inexistente', data: '2026-07-24' }),
    { code: 'referencia_not_found' }
  );
});

test('resolveReferencia lança unknown_referencia_type pra tipo desconhecido', async () => {
  const db = fakeDb({});
  await assert.rejects(
    () => resolveReferencia(db, { tipo: 'algo_novo', nome: 'x', data: '2026-07-24' }),
    { code: 'unknown_referencia_type' }
  );
});

// ── Envelope: cardId e referencia são mutuamente exclusivos ──────────────

test('envelope aceita cardId direto sem referencia (v0, continua funcionando)', () => {
  const result = envelope.safeParse({
    requestId: 'req-1',
    cardId: 'c123',
    status: 'success',
    outputs: [],
  });
  assert.equal(result.success, true);
});

test('envelope aceita referencia sem cardId (Sprint 2)', () => {
  const result = envelope.safeParse({
    requestId: 'req-2',
    referencia: { tipo: 'recorrente', nome: 'relatorio_diario', data: '2026-07-24' },
    status: 'success',
    outputs: [],
  });
  assert.equal(result.success, true);
});

test('envelope rejeita quando vêm cardId E referencia juntos', () => {
  const result = envelope.safeParse({
    requestId: 'req-3',
    cardId: 'c123',
    referencia: { tipo: 'recorrente', nome: 'relatorio_diario', data: '2026-07-24' },
    status: 'success',
    outputs: [],
  });
  assert.equal(result.success, false);
});

test('envelope rejeita quando não vem nem cardId nem referencia', () => {
  const result = envelope.safeParse({
    requestId: 'req-4',
    status: 'success',
    outputs: [],
  });
  assert.equal(result.success, false);
});

test('envelope rejeita referencia com data em formato inválido', () => {
  const result = envelope.safeParse({
    requestId: 'req-5',
    referencia: { tipo: 'recorrente', nome: 'relatorio_diario', data: '24/07/2026' },
    status: 'success',
    outputs: [],
  });
  assert.equal(result.success, false);
});
