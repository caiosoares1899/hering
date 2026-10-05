// functions/spotify/__tests__/oauthReturnUrl.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { isAllowedReturnUrl } = require('../_shared');

test('aceita as páginas do próprio site (kanban, painel, dev, com subcaminho)', () => {
  for (const u of [
    'https://caiosoares1899.github.io/hering/kanban.html',
    'https://caiosoares1899.github.io/hering/kanban-dev.html',
    'https://caiosoares1899.github.io/hering/painel.html',
    'https://caiosoares1899.github.io/hering/kanban.html#x',
  ]) assert.equal(isAllowedReturnUrl(u), true, u);
});

test('recusa qualquer outro destino (o redirecionamento aberto de antes)', () => {
  for (const u of [
    'https://evil.example/login',
    'https://caiosoares1899.github.io.evil.example/hering/kanban.html',
    'https://evil.example/https://caiosoares1899.github.io/hering/kanban.html',
    'https://caiosoares1899.github.io@evil.example/',
    'https://user:pass@caiosoares1899.github.io/hering/kanban.html',
    'http://caiosoares1899.github.io/hering/kanban.html',
    '//evil.example/x',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'caiosoares1899.github.io/hering/kanban.html',
    '/hering/kanban.html',
    '',
  ]) assert.equal(isAllowedReturnUrl(u), false, u);
});

test('recusa tipos que não são texto e URLs gigantes', () => {
  for (const u of [null, undefined, 123, {}, [], ['https://caiosoares1899.github.io/hering/kanban.html']]) {
    assert.equal(isAllowedReturnUrl(u), false);
  }
  assert.equal(isAllowedReturnUrl('https://caiosoares1899.github.io/hering/' + 'a'.repeat(600)), false);
});
