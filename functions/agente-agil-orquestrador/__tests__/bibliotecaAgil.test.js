// functions/agente-agil-orquestrador/__tests__/bibliotecaAgil.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CONCEITOS_AGEIS,
  COMO_BOARD_FUNCIONA,
  makeBibliotecaAgilHandler,
  bibliotecaAgilSchema,
} = require('../tools/bibliotecaAgil');
const { buildTools } = require('../tools');

function assertVerbetesValidos(lista) {
  assert.ok(Array.isArray(lista) && lista.length > 0);
  lista.forEach((v) => {
    assert.equal(typeof v.titulo, 'string');
    assert.ok(v.titulo.length > 0);
    assert.equal(typeof v.texto, 'string');
    assert.ok(v.texto.length > 0);
    // Conteúdo é pra um LLM ler, não pra renderizar num modal — não deve
    // carregar HTML de formatação (<b>, <div>, <code>...) que só fazia
    // sentido na origem (HELP_CONTENT).
    assert.doesNotMatch(v.texto, /<[a-z][\s\S]*>/i, `verbete "${v.titulo}" não deveria conter HTML`);
  });
}

test('CONCEITOS_AGEIS tem os 9 verbetes esperados, todos com titulo+texto válidos', () => {
  assert.equal(CONCEITOS_AGEIS.length, 9);
  assertVerbetesValidos(CONCEITOS_AGEIS);
});

test('COMO_BOARD_FUNCIONA tem os 15 verbetes esperados, todos com titulo+texto válidos', () => {
  assert.equal(COMO_BOARD_FUNCIONA.length, 15);
  assertVerbetesValidos(COMO_BOARD_FUNCIONA);
});

test('nenhum título se repete dentro do mesmo grupo', () => {
  [CONCEITOS_AGEIS, COMO_BOARD_FUNCIONA].forEach((lista) => {
    const titulos = lista.map((v) => v.titulo);
    assert.equal(new Set(titulos).size, titulos.length);
  });
});

test('bibliotecaAgilSchema não exige nenhum parâmetro', () => {
  const parsed = bibliotecaAgilSchema.safeParse({});
  assert.ok(parsed.success);
});

test('handler retorna os dois grupos completos, sem depender de input', async () => {
  const handler = makeBibliotecaAgilHandler();
  const resultado = await handler({});

  assert.deepEqual(
    resultado.grupos.map((g) => g.nome),
    ['Conceitos ágeis', 'Como o board funciona'],
  );
  assert.equal(resultado.grupos[0].verbetes, CONCEITOS_AGEIS);
  assert.equal(resultado.grupos[1].verbetes, COMO_BOARD_FUNCIONA);
});

test('buildTools() expõe biblioteca_agil nos modos fake e real, com o mesmo comportamento', async () => {
  const toolsFake = buildTools();
  const toolsReal = buildTools({
    mode: 'real',
    db: {},
    squadId: 'dev',
    cardId: 'c1',
  });

  const fakeTool = toolsFake.find((t) => t.name === 'biblioteca_agil');
  const realTool = toolsReal.find((t) => t.name === 'biblioteca_agil');

  assert.ok(fakeTool);
  assert.ok(realTool);
  assert.equal(fakeTool.input_schema.type, 'object');
  assert.equal(typeof fakeTool.handler, 'function');
  assert.equal(typeof realTool.handler, 'function');
  // Sem distinção fake/real: dado estático, mesmo conteúdo nos dois modos
  // (o handler em si não é reaproveitado entre chamadas de buildTools(),
  // só o comportamento é idêntico — real nunca toca {db, squadId, cardId}).
  assert.deepEqual(await fakeTool.handler({}), await realTool.handler({}));
});
