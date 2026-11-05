// functions/agente-agil/__tests__/httpAuth.test.js
//
// 🔐 Auditoria de segurança de 05/11/2026: o endpoint `agenteAgil` autentica por segredo compartilhado (x-agent-key). `timingSafeEqualStr('', '')` é true, então um segredo VAZIO no
// Secret Manager deixaria entrar quem não manda o header. Aqui: segredo vazio → 500 (nunca aberto); header ausente/vazio/errado → 401; certo → passa da autenticação.
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

function makeDb() {
  const data = {};
  const ref = () => ({
    async get() { return { exists: () => false, val: () => null }; },
    async transaction(fn) { const v = fn(null); return { committed: v !== undefined, snapshot: { val: () => v } }; },
    async set() {}, async update() {}, push() { return { key: 'k1', async set() {} }; },
  });
  return { ref, data };
}

function loadHandler(secret) {
  const realLoad = Module._load;
  Module._load = function (request, ...rest) {
    if (request === 'firebase-functions/v2/https') return { onRequest: (_o, h) => h };
    if (request === 'firebase-functions/params') return { defineSecret: () => ({ value: () => secret }) };
    if (request === 'firebase-admin/database') return { getDatabase: () => makeDb() };
    return realLoad.call(this, request, ...rest);
  };
  try {
    delete require.cache[require.resolve('../http')];
    return require('../http').agenteAgil;
  } finally { Module._load = realLoad; }
}

function call(handler, headers, body) {
  return new Promise((resolve) => {
    const res = { status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); }, send() { resolve({ code: this.code }); } };
    const req = { method: 'POST', headers, get: (k) => headers[String(k).toLowerCase()], body: body || {}, ip: '203.0.113.7' };
    handler(req, res);
  });
}

test('segredo VAZIO no servidor: 500 server_misconfigured, mesmo sem header (nunca autentica)', async () => {
  for (const secret of ['', undefined, null]) {
    const r = await call(loadHandler(secret), {});
    assert.equal(r.code, 500); assert.equal(r.body.error, 'server_misconfigured');
  }
});

test('segredo configurado: header ausente, vazio ou errado → 401', async () => {
  const h = loadHandler('segredo-de-verdade');
  for (const hdr of [{}, { 'x-agent-key': '' }, { 'x-agent-key': 'errado' }, { 'x-agent-key': 'segredo-de-verdadeX' }]) {
    const r = await call(h, hdr); assert.equal(r.code, 401, JSON.stringify(hdr));
  }
});

test('segredo certo passa da autenticação (e cai na validação do payload: 400)', async () => {
  const r = await call(loadHandler('segredo-de-verdade'), { 'x-agent-key': 'segredo-de-verdade' }, {});
  assert.equal(r.code, 400); assert.equal(r.body.error, 'invalid_payload');
});
