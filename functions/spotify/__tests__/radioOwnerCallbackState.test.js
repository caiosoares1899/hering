// functions/spotify/__tests__/radioOwnerCallbackState.test.js
//
// 🔐 Auditoria de segurança de 05/11/2026: o `state` do callback da conta dona da Rádio é STATE_PREFIX + RADIO_OWNER_CONNECT_TOKEN. Com o segredo vazio ele viraria o prefixo constante
// (qualquer um sequestraria a conta dona). Segredo vazio → 500; state errado/ausente → 400; só o state exato avança (e nada é gravado antes disso).
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

function loadHandler(token) {
  const realLoad = Module._load;
  Module._load = function (request, ...rest) {
    if (request === 'firebase-functions/v2/https') return { onRequest: (_o, h) => h };
    if (request === 'firebase-functions/params') return { defineSecret: () => ({ value: () => token }) };
    if (request === 'firebase-admin/database') return { getDatabase: () => ({ ref: () => ({ async set() {} }) }) };
    return realLoad.call(this, request, ...rest);
  };
  try { delete require.cache[require.resolve('../radioOwnerCallback')]; return require('../radioOwnerCallback').spotifyRadioOwnerCallback; }
  finally { Module._load = realLoad; }
}
const call = (h, query) => new Promise((resolve) => {
  const res = { status(c) { this.code = c; return this; }, send(b) { resolve({ code: this.code, body: b }); }, json(b) { resolve({ code: this.code, body: b }); } };
  h({ method: 'GET', query }, res);
});

test('segredo vazio/ausente: 500 mesmo com o state "do prefixo" (o ataque)', async () => {
  for (const tok of ['', undefined, null]) {
    const r = await call(loadHandler(tok), { code: 'x', state: 'radio-owner-connect-v1:' });
    assert.equal(r.code, 500);
  }
});

test('segredo configurado: state ausente, errado, de tamanho diferente ou não-texto → 400', async () => {
  const h = loadHandler('tok-secreto');
  for (const state of [undefined, '', 'radio-owner-connect-v1:', 'radio-owner-connect-v1:tok-errado', 'radio-owner-connect-v1:tok-secreto-extra', ['a']]) {
    const r = await call(h, { code: 'x', state }); assert.equal(r.code, 400, JSON.stringify(state));
  }
});

test('state exato passa da checagem (e cai no code ausente: 400 diferente)', async () => {
  const r = await call(loadHandler('tok-secreto'), { state: 'radio-owner-connect-v1:tok-secreto' });
  assert.equal(r.code, 400); assert.match(String(r.body), /code ausente/);
});
