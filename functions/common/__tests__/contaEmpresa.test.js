const test = require('node:test');
const assert = require('node:assert');
const { contaDaEmpresa } = require('../contaEmpresa');

const tok = (o) => Object.assign({ email: 'ana@ciahering.com.br', email_verified: true, firebase: { sign_in_provider: 'google.com' } }, o);

test('conta Google @ciahering com e-mail verificado entra', () => {
  assert.strictEqual(contaDaEmpresa(tok()), true);
  assert.strictEqual(contaDaEmpresa(tok({ email: 'ANA@CiaHering.com.br' })), true);
});
test('mesmo endereço, mas por e-mail/senha (provedor "password") NÃO entra — foi o buraco que fechamos', () => {
  assert.strictEqual(contaDaEmpresa(tok({ firebase: { sign_in_provider: 'password' } })), false);
  assert.strictEqual(contaDaEmpresa(tok({ firebase: { sign_in_provider: 'anonymous' } })), false);
  assert.strictEqual(contaDaEmpresa(tok({ firebase: {} })), false);
  assert.strictEqual(contaDaEmpresa(tok({ firebase: undefined })), false);
});
test('e-mail não verificado não entra', () => {
  assert.strictEqual(contaDaEmpresa(tok({ email_verified: false })), false);
  assert.strictEqual(contaDaEmpresa(tok({ email_verified: undefined })), false);
});
test('outros domínios (e parecidos) não entram', () => {
  for (const email of ['x@gmail.com', 'x@ciahering.com', 'x@evil-ciahering.com.br', 'x@ciahering.com.br.evil.com', '', undefined, 'ciahering.com.br']) {
    assert.strictEqual(contaDaEmpresa(tok({ email })), false, String(email));
  }
});
test('token ausente ou malformado não entra', () => {
  for (const d of [null, undefined, 'x', 42, []]) assert.strictEqual(contaDaEmpresa(d), false);
});
