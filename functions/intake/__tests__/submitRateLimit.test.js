// functions/intake/__tests__/submitRateLimit.test.js
//
// Roda o handler REAL de intake/submit.js (com firebase-functions/firebase-admin
// substituídos por fakes via Module._load) contra um db falso que implementa
// transaction() de verdade (compare-and-swap). O foco é a identidade usada no rate
// limit: mandar x-forwarded-for / fastly-client-ip diferentes a cada requisição não
// pode mais dar uma chave nova a cada vez.
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

function makeDb(initial) {
  const data = JSON.parse(JSON.stringify(initial || {}));
  const parts = (p) => p.split('/').filter(Boolean);
  const getAt = (p) => parts(p).reduce((o, k) => (o == null ? undefined : o[k]), data);
  const setAt = (p, v) => {
    const ks = parts(p); let cur = data;
    ks.slice(0, -1).forEach((k) => { cur[k] = cur[k] || {}; cur = cur[k]; });
    if (v === undefined || v === null) delete cur[ks[ks.length - 1]]; else cur[ks[ks.length - 1]] = JSON.parse(JSON.stringify(v));
  };
  let pushN = 0;
  const ref = (p) => ({
    async get() { const v = getAt(p); return { exists: () => v !== undefined, val: () => (v === undefined ? null : JSON.parse(JSON.stringify(v))) }; },
    async set(v) { setAt(p, v); },
    async update(u) { Object.entries(u).forEach(([k, v]) => setAt(p + '/' + k, v)); },
    async transaction(fn) { const cur = getAt(p); const next = fn(cur === undefined ? null : JSON.parse(JSON.stringify(cur))); if (next === undefined) return { committed: false }; setAt(p, next); return { committed: true }; },
    push() { const key = 'k' + (++pushN); return { key, async set(v) { setAt(p + '/' + key, v); } }; },
  });
  return { ref, data };
}

function loadHandler(db) {
  const realLoad = Module._load;
  Module._load = function (request, ...rest) {
    if (request === 'firebase-functions/v2/https') return { onRequest: (_o, h) => h };
    if (request === 'firebase-admin/database') return { getDatabase: () => db };
    return realLoad.call(this, request, ...rest);
  };
  try {
    delete require.cache[require.resolve('../submit')];
    return require('../submit').intakeSubmit;
  } finally { Module._load = realLoad; }
}

function call(handler, headers, bodyExtra) {
  return new Promise((resolve) => {
    const res = { _h: {}, set(k, v) { this._h[k] = v; }, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); }, send() { resolve({ code: this.code }); } };
    const req = {
      method: 'POST', query: { squad: 'dados' }, headers,
      body: { titulo: 'Pedido', demandante: 'Fulano', descricao: 'Preciso de X', squadDemandante: 'Time Y', ...bodyExtra }, ip: '203.0.113.1',
    };
    handler(req, res);
  });
}

const baseDb = () => makeDb({ kanban: { squads: { dados: { dados: { x: 1 }, usuarios: {} } } } });

test('20 requisições do MESMO IP com x-forwarded-for forjado diferente a cada uma: só 5 passam', async () => {
  const handler = loadHandler(baseDb());
  const codes = [];
  for (let i = 0; i < 20; i++) {
    const r = await call(handler, { 'x-forwarded-for': `10.9.8.${i}, 198.51.100.${i}, 203.0.113.50` });
    codes.push(r.code);
  }
  assert.equal(codes.filter((c) => c === 200).length, 5);
  assert.equal(codes.filter((c) => c === 429).length, 15);
});

test('fastly-client-ip diferente a cada requisição também não contorna', async () => {
  const handler = loadHandler(baseDb());
  let ok = 0;
  for (let i = 0; i < 20; i++) {
    const r = await call(handler, { 'fastly-client-ip': `198.51.100.${i}`, 'x-forwarded-for': '203.0.113.60' });
    if (r.code === 200) ok++;
  }
  assert.equal(ok, 5);
});

test('IPs reais diferentes continuam tendo cota própria (não vira limite global por engano)', async () => {
  const handler = loadHandler(baseDb());
  for (const ip of ['203.0.113.1', '203.0.113.2', '203.0.113.3']) {
    for (let i = 0; i < 5; i++) assert.equal((await call(handler, { 'x-forwarded-for': ip })).code, 200);
    assert.equal((await call(handler, { 'x-forwarded-for': ip })).code, 429);
  }
});

test('teto por squad: muitos IPs reais diferentes não passam de 40 envios/hora', async () => {
  const handler = loadHandler(baseDb());
  let ok = 0, limited = 0;
  for (let i = 0; i < 60; i++) {
    const r = await call(handler, { 'x-forwarded-for': `198.51.100.${i}` });
    if (r.code === 200) ok++; else if (r.code === 429) limited++;
  }
  assert.equal(ok, 40);
  assert.equal(limited, 20);
});
