// functions/comentarios/__tests__/contagem.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { recalcularContagem } = require('../contagem');

function makeDb(initial) {
  const data = JSON.parse(JSON.stringify(initial || {}));
  const parts = (p) => p.split('/').filter(Boolean);
  const getAt = (p) => parts(p).reduce((o, k) => (o == null ? undefined : o[k]), data);
  const setAt = (p, v) => {
    const ks = parts(p); let cur = data;
    ks.slice(0, -1).forEach((k) => { cur[k] = cur[k] || {}; cur = cur[k]; });
    if (v === undefined || v === null) delete cur[ks[ks.length - 1]]; else cur[ks[ks.length - 1]] = JSON.parse(JSON.stringify(v));
  };
  return {
    data,
    ref: (p) => ({
      async get() { const v = getAt(p); return { val: () => (v === undefined ? null : JSON.parse(JSON.stringify(v))) }; },
      async set(v) { setAt(p, v); },
      async remove() { setAt(p, null); },
    }),
  };
}
const SQ = 'kanban/squads/dados/dados';
const comentarios = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => ['c' + i, { id: 'c' + i, text: 'x' + i }]));

test('conta os comentários do card e grava em card_comments_count', async () => {
  const db = makeDb({ kanban: { squads: { dados: { dados: { card_comments: { card1: comentarios(3) } } } } } });
  assert.equal(await recalcularContagem(db, 'dados', 'card1'), 3);
  assert.equal(db.data.kanban.squads.dados.dados.card_comments_count.card1, 3);
});

test('um único comentário vira 1', async () => {
  const db = makeDb({ kanban: { squads: { dados: { dados: { card_comments: { card1: comentarios(1) } } } } } });
  assert.equal(await recalcularContagem(db, 'dados', 'card1'), 1);
});

test('apagar o último comentário REMOVE o índice (card sem comentário não ocupa espaço)', async () => {
  const db = makeDb({ kanban: { squads: { dados: { dados: { card_comments: { card1: comentarios(1) }, card_comments_count: { card1: 1 } } } } } });
  delete db.data.kanban.squads.dados.dados.card_comments.card1;
  assert.equal(await recalcularContagem(db, 'dados', 'card1'), 0);
  assert.equal(db.data.kanban.squads.dados.dados.card_comments_count.card1, undefined);
});

test('é idempotente: reentrega do evento / ordem trocada dão o mesmo número', async () => {
  const db = makeDb({ kanban: { squads: { dados: { dados: { card_comments: { card1: comentarios(5) } } } } } });
  for (let i = 0; i < 4; i++) assert.equal(await recalcularContagem(db, 'dados', 'card1'), 5);
  assert.equal(db.data.kanban.squads.dados.dados.card_comments_count.card1, 5);
});

test('corrige um índice defasado (qualquer valor errado é sobrescrito pelo real)', async () => {
  const db = makeDb({ kanban: { squads: { dados: { dados: { card_comments: { card1: comentarios(2) }, card_comments_count: { card1: 99 } } } } } });
  await recalcularContagem(db, 'dados', 'card1');
  assert.equal(db.data.kanban.squads.dados.dados.card_comments_count.card1, 2);
});

test('só mexe no card do evento e no squad do evento', async () => {
  const db = makeDb({ kanban: { squads: {
    dados: { dados: { card_comments: { card1: comentarios(2), card2: comentarios(4) }, card_comments_count: { card2: 4 } } },
    prf: { dados: { card_comments: { card1: comentarios(7) }, card_comments_count: { card1: 7 } } },
  } } });
  await recalcularContagem(db, 'dados', 'card1');
  const s = db.data.kanban.squads;
  assert.equal(s.dados.dados.card_comments_count.card1, 2);
  assert.equal(s.dados.dados.card_comments_count.card2, 4);
  assert.equal(s.prf.dados.card_comments_count.card1, 7);
});

test('nunca escreve em card_comments (o gatilho escuta esse nó — escrever ali geraria loop)', async () => {
  const db = makeDb({ kanban: { squads: { dados: { dados: { card_comments: { card1: comentarios(3) } } } } } });
  const antes = JSON.stringify(db.data.kanban.squads.dados.dados.card_comments);
  await recalcularContagem(db, 'dados', 'card1');
  assert.equal(JSON.stringify(db.data.kanban.squads.dados.dados.card_comments), antes);
});
