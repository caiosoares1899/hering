// functions/common/__tests__/clientIp.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { clientIp, isPrivateIp } = require('../clientIp');

const req = (headers, ip) => ({ headers: headers || {}, ip });

test('valores forjados pelo cliente à esquerda são ignorados — vale o IP que o Google acrescentou', () => {
  assert.equal(clientIp(req({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 203.0.113.9' })), '203.0.113.9');
});

test('mandar um x-forwarded-for diferente a cada requisição NÃO muda a chave (antes mudava)', () => {
  const chaves = new Set();
  for (let i = 0; i < 50; i++) chaves.add(clientIp(req({ 'x-forwarded-for': `9.9.9.${i}, 203.0.113.9` })));
  assert.equal(chaves.size, 1);
});

test('fastly-client-ip (controlado pelo cliente quando chama a function direto) é ignorado', () => {
  assert.equal(
    clientIp(req({ 'fastly-client-ip': '8.8.8.8', 'x-forwarded-for': '203.0.113.9' })),
    '203.0.113.9'
  );
  assert.equal(clientIp(req({ 'fastly-client-ip': '8.8.8.8' }, '203.0.113.50')), '203.0.113.50');
});

test('uma única entrada é usada como está', () => {
  assert.equal(clientIp(req({ 'x-forwarded-for': '203.0.113.9' })), '203.0.113.9');
});

test('proxy interno depois do cliente não vira a chave de todo mundo', () => {
  assert.equal(clientIp(req({ 'x-forwarded-for': '203.0.113.9, 10.1.2.3' })), '203.0.113.9');
  assert.equal(clientIp(req({ 'x-forwarded-for': '203.0.113.9, 169.254.8.1, 172.20.0.4' })), '203.0.113.9');
});

test('só endereços internos: usa o mais à direita (não inventa outro)', () => {
  assert.equal(clientIp(req({ 'x-forwarded-for': '10.0.0.1, 192.168.1.5' })), '192.168.1.5');
});

test('sem x-forwarded-for cai em req.ip, e por fim em "unknown"', () => {
  assert.equal(clientIp(req({}, '203.0.113.77')), '203.0.113.77');
  assert.equal(clientIp(req({})), 'unknown');
  assert.equal(clientIp({}), 'unknown');
});

test('isPrivateIp reconhece as faixas internas e não confunde IP público', () => {
  for (const ip of ['10.0.0.1', '127.0.0.1', '192.168.0.9', '169.254.1.1', '172.16.0.1', '172.31.255.1', '::1', 'fd00::1', 'fe80::1']) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '203.0.113.9', '172.15.0.1', '172.32.0.1', '2001:db8::1']) {
    assert.equal(isPrivateIp(ip), false, ip);
  }
});
