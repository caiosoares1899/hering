// functions/agente-agil/__tests__/intakeEnvelope.test.js
//
// Cobertura do contrato NOVO (2026-08-27) que agente-agil/http.js valida —
// deliberadamente mais pobre em estrutura que o `envelope` legado (ver
// schema.js): texto livre é o único campo sempre obrigatório, cardId e
// referencia são dica opcional (nenhum dos dois é exigido), e não existe
// mais vocabulário de `outputs`/ações no payload.
const test = require('node:test');
const assert = require('node:assert/strict');

const { intakeEnvelope } = require('../schema');

test('aceita o mínimo: só requestId + texto, sem cardId/referencia/especialista', () => {
  const result = intakeEnvelope.safeParse({ requestId: 'r1', texto: 'algo aconteceu' });
  assert.equal(result.success, true);
});

test('aceita cardId como dica opcional', () => {
  const result = intakeEnvelope.safeParse({ requestId: 'r2', texto: 'sobre o card X', cardId: 'c123' });
  assert.equal(result.success, true);
});

test('aceita referencia como dica opcional', () => {
  const result = intakeEnvelope.safeParse({
    requestId: 'r3',
    texto: 'sobre a instância de hoje',
    referencia: { tipo: 'recorrente', nome: 'relatorio_diario', data: '2026-08-27' },
  });
  assert.equal(result.success, true);
});

test('rejeita cardId E referencia juntos (no máximo um dos dois)', () => {
  const result = intakeEnvelope.safeParse({
    requestId: 'r4',
    texto: 'ambíguo',
    cardId: 'c1',
    referencia: { tipo: 'recorrente', nome: 'x', data: '2026-08-27' },
  });
  assert.equal(result.success, false);
});

test('rejeita sem texto', () => {
  const result = intakeEnvelope.safeParse({ requestId: 'r5' });
  assert.equal(result.success, false);
});

test('rejeita sem requestId', () => {
  const result = intakeEnvelope.safeParse({ texto: 'algo' });
  assert.equal(result.success, false);
});

test('aceita especialista opcional', () => {
  const result = intakeEnvelope.safeParse({ requestId: 'r6', texto: 'algo', especialista: 'databricks' });
  assert.equal(result.success, true);
});

// Diferente do contrato antigo: não existe mais `status`/`outputs` no
// payload — envio deles não deveria quebrar nada (Zod ignora campos extras
// por padrão), mas confirma que não são exigidos.
test('não exige mais status/outputs (vocabulário de ações saiu do envelope)', () => {
  const result = intakeEnvelope.safeParse({ requestId: 'r7', texto: 'algo' });
  assert.equal(result.success, true);
  assert.equal('status' in result.data, false);
  assert.equal('outputs' in result.data, false);
});
