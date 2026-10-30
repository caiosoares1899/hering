// functions/oceano/__tests__/contrato_mac.test.js — o app do Mac (mac/Shared/Resumo.swift) lê o JSON do oceanoResumo: todo nome que o Swift espera tem de existir no JSON REAL.
// Não substitui compilar o Swift (isso é no Xcode), mas pega o desencontro mais provável: a função renomear/remover um campo e o app do Mac continuar esperando o antigo.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { fakeBucket } = require('../../backup/__tests__/fakeBucket');
const R = require('../resumo');

const AGORA = Date.parse('2026-10-30T15:00:00Z');
const iso = (m) => new Date(AGORA - m * 60000).toISOString();
function comConsulta(fake) {
  const ref = (p) => { const r = fake.ref(p); r.orderByChild = (c) => ({ equalTo: (v) => ({ async get() { const x = (await r.get()).val() || {}; const a = Array.isArray(x) ? x : Object.values(x); return { val: () => a.filter((i) => i && i[c] === v) }; } }) }); return r; };
  return { ref, _data: fake._data };
}
const card = (id, e) => Object.assign({ id, title: 'Card ' + id, owner: 'CO', col: 'doing', due: '2026-11-20' }, e || {});

// pega os nomes de propriedade (`let nome:`) do Swift e os raws dos CodingKeys (`case idCard = "id"`)
function nomesDoSwift() {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'mac', 'Shared', 'Resumo.swift'), 'utf8');
  const nomes = new Set();
  for (const m of src.matchAll(/^\s*let\s+(\w+)\s*:/gm)) nomes.add(m[1]);
  const renomeados = new Map();
  for (const m of src.matchAll(/case\s+(\w+)\s*=\s*"(\w+)"/g)) renomeados.set(m[1], m[2]);
  return [...nomes].map((n) => renomeados.get(n) || n);
}
function chavesDoJson(v, acc = new Set()) {
  if (Array.isArray(v)) v.forEach((x) => chavesDoJson(x, acc));
  else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => { acc.add(k); chavesDoJson(x, acc); });
  return acc;
}

test('todo campo que o app do Mac (Resumo.swift) espera existe no JSON da função', async () => {
  const db = comConsulta(makeFakeDb({ kanban: {
    usuarios_publicos: { dono: { init: 'CO', squads: { dados: true } } },
    vtex_saude: { ok: true, ultimoOkEm: iso(1), verificadoEm: iso(1), abertos: 1, incidentes: [{ titulo: 'x' }] }, github_saude: { ok: true, verificadoEm: iso(1), indicador: 'none' }, firebase_saude: { ok: true, verificadoEm: iso(1), servicosDegradados: [] },
    plantao: { b1: { estado: 'testando' }, b2: { estado: 'escalado' } },
    squads: { dados: { dados: { columns: [{ id: 'doing' }], cards: [card('a1', { due: '2026-10-20' }), card('a2', { due: '2026-10-30' }), card('a3', { blocker: true })], cards_incidentes_sumico: { i1: { cardId: 'c1', detectadoEm: iso(30) } } } } } } }));
  const b = fakeBucket({ 'backups-completos/diario/2026-10-30/manifesto.json': '{"erros":[]}', 'backups-completos/semanal/2026-10-25/manifesto.json': '{"erros":[]}', 'backups/dados/2026-10-30.json': '{}' });
  const json = JSON.parse(JSON.stringify(await R.montarResumo({ db, bucket: b, agora: AGORA, resolverUid: async () => 'dono', memo: R.criarMemo() })));
  const reais = chavesDoJson(json);
  const esperados = nomesDoSwift();
  assert.ok(esperados.length > 25, 'o parser leu os campos do Swift (' + esperados.length + ')');
  const faltam = esperados.filter((n) => !reais.has(n));
  assert.deepEqual(faltam, [], 'o Swift espera campos que a função não devolve: ' + faltam.join(', '));
  assert.ok(json.meusCards.lista.length > 0 && 'diasAtraso' in json.meusCards.lista[0] || json.meusCards.lista.some((c) => c.atrasado), 'a lista de cards tem item atrasado para o contrato de "diasAtraso"');
});
