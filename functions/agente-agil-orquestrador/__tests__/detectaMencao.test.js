// functions/agente-agil-orquestrador/__tests__/detectaMencao.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { mencionaAgente } = require('../detectaMencao');

test('detecta menção com acento e maiúsculas normais', () => {
  assert.equal(mencionaAgente('Oi @Agente Ágil, pode fazer isso?'), true);
});

test('detecta menção sem acento (teclado sem cedilha configurado)', () => {
  assert.equal(mencionaAgente('@agente agil confirma pra mim'), true);
});

test('detecta menção toda em maiúsculas', () => {
  assert.equal(mencionaAgente('@AGENTE ÁGIL TUDO MAIÚSCULO'), true);
});

test('detecta menção no meio do texto, não só no início', () => {
  assert.equal(mencionaAgente('Alguém pode confirmar? @Agente Ágil dá uma olhada nesse card'), true);
});

test('não detecta comentário sem menção nenhuma', () => {
  assert.equal(mencionaAgente('só um comentário normal, sem chamar ninguém'), false);
});

test('não detecta menção a um humano (@CO, @Ana etc.)', () => {
  assert.equal(mencionaAgente('@CO pode revisar isso?'), false);
});

test('não quebra com texto vazio/undefined/null', () => {
  assert.equal(mencionaAgente(''), false);
  assert.equal(mencionaAgente(undefined), false);
  assert.equal(mencionaAgente(null), false);
});
