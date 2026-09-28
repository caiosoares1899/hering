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

// htmlAnexo (2026-09-28, report diário via card recorrente) — relatório
// pronto, hospedado deterministicamente por intakeTrigger.js, nunca passa
// pelo prompt do LLM (ver comentário grande em schema.js).
test('aceita htmlAnexo opcional (html + titulo)', () => {
  const result = intakeEnvelope.safeParse({
    requestId: 'r8',
    texto: 'Relatório diário pronto.',
    referencia: { tipo: 'recorrente', nome: 'relatorio_diario', data: '2026-09-28' },
    htmlAnexo: { html: '<html><body>oi</body></html>', titulo: 'Relatório Diário' },
  });
  assert.equal(result.success, true);
});

test('sem htmlAnexo continua aceitando normalmente (campo opcional)', () => {
  const result = intakeEnvelope.safeParse({ requestId: 'r9', texto: 'algo' });
  assert.equal(result.success, true);
  assert.equal(result.data.htmlAnexo, undefined);
});

test('rejeita htmlAnexo sem html', () => {
  const result = intakeEnvelope.safeParse({ requestId: 'r10', texto: 'algo', htmlAnexo: { titulo: 'Relatório' } });
  assert.equal(result.success, false);
});

test('rejeita htmlAnexo sem titulo', () => {
  const result = intakeEnvelope.safeParse({ requestId: 'r11', texto: 'algo', htmlAnexo: { html: '<html></html>' } });
  assert.equal(result.success, false);
});

test('rejeita htmlAnexo com html vazio', () => {
  const result = intakeEnvelope.safeParse({ requestId: 'r12', texto: 'algo', htmlAnexo: { html: '', titulo: 'Relatório' } });
  assert.equal(result.success, false);
});

// dadosDiarios (2026-09-28, números de captação pra 📊 Central de Dados) —
// DIFERENTE de htmlAnexo, independente de cardId/referencia (ver
// comentário grande em schema.js).
test('aceita dadosDiarios completo, sem cardId/referencia nenhum', () => {
  const result = intakeEnvelope.safeParse({
    requestId: 'r13',
    texto: 'Captação do dia processada.',
    dadosDiarios: { data: '2026-09-28', capDia: 1170000, metaDia: 1570000, capAcum: 9120000, metaAcum: 12460000, lyAcumPct: -40, metaAmanha: 1359000, texto: 'Bom dia pessoal...' },
  });
  assert.equal(result.success, true);
});

test('aceita dadosDiarios só com data (todos os números opcionais)', () => {
  const result = intakeEnvelope.safeParse({ requestId: 'r14', texto: 'algo', dadosDiarios: { data: '2026-09-28' } });
  assert.equal(result.success, true);
});

test('rejeita dadosDiarios sem data', () => {
  const result = intakeEnvelope.safeParse({ requestId: 'r15', texto: 'algo', dadosDiarios: { capDia: 100 } });
  assert.equal(result.success, false);
});

test('rejeita dadosDiarios com data em formato errado', () => {
  const result = intakeEnvelope.safeParse({ requestId: 'r16', texto: 'algo', dadosDiarios: { data: '28/09/2026', capDia: 100 } });
  assert.equal(result.success, false);
});

test('rejeita dadosDiarios com campo numérico como string', () => {
  const result = intakeEnvelope.safeParse({ requestId: 'r17', texto: 'algo', dadosDiarios: { data: '2026-09-28', capDia: '100' } });
  assert.equal(result.success, false);
});

test('sem dadosDiarios continua aceitando normalmente (campo opcional)', () => {
  const result = intakeEnvelope.safeParse({ requestId: 'r18', texto: 'algo' });
  assert.equal(result.success, true);
  assert.equal(result.data.dadosDiarios, undefined);
});
