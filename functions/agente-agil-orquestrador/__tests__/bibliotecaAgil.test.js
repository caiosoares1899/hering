// functions/agente-agil-orquestrador/__tests__/bibliotecaAgil.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CONCEITOS_AGEIS,
  ECOSSISTEMA_OCEANO,
  AJUDA_MARE,
  AJUDA_RADAR,
  AJUDA_OCEANO,
  NOVIDADES,
  buscar,
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

test('ECOSSISTEMA_OCEANO cobre a família Oceano e a cisão com a Arezzo, com titulo+texto válidos', () => {
  assertVerbetesValidos(ECOSSISTEMA_OCEANO);
  const titulos = ECOSSISTEMA_OCEANO.map((v) => v.titulo).join(' | ');
  assert.match(titulos, /Oceano/);
  assert.match(titulos, /só Hering/);
  assert.match(titulos, /Radar/);
  assert.match(titulos, /Central de Notificações/);
  assert.match(titulos, /Dicas/);
  const hering = ECOSSISTEMA_OCEANO.find((v) => /só Hering/.test(v.titulo)).texto;
  assert.match(hering, /@ciahering\.com\.br/);
  assert.match(hering, /Arezzo/);
});

test('nenhum título se repete dentro do mesmo grupo', () => {
  [CONCEITOS_AGEIS, ECOSSISTEMA_OCEANO].forEach((lista) => {
    const titulos = lista.map((v) => v.titulo);
    assert.equal(new Set(titulos).size, titulos.length);
  });
});

test('a Ajuda do Maré gerada tem todas as abas, verbetes sem HTML e nenhum título repetido na mesma aba', () => {
  assert.ok(AJUDA_MARE.length > 100, `esperava >100 verbetes, veio ${AJUDA_MARE.length}`);
  const abas = new Set(AJUDA_MARE.map((v) => v.aba));
  ['board', 'cards', 'agente', 'config', 'comunicacao', 'kudos', 'automacoes'].forEach((a) => assert.ok(abas.has(a), `faltou a aba ${a}`));
  assert.ok(!abas.has('spotify') && !abas.has('agil') && !abas.has('ui'));
  AJUDA_MARE.forEach((v) => {
    assert.ok(v.titulo && v.texto, 'verbete sem titulo/texto');
    assert.doesNotMatch(v.texto, /<[a-z][\s\S]*>/i, `verbete "${v.titulo}" não deveria conter HTML`);
  });
  const chaves = AJUDA_MARE.map((v) => `${v.aba}|${v.titulo}`);
  assert.equal(new Set(chaves).size, chaves.length);
  assert.ok(!AJUDA_MARE.some((v) => /^Sua torre/.test(v.titulo)), 'no modo só Hering a entrada "Sua torre" não entra');
});

test('novidades: só entradas já em produção (nenhuma "SÓ DEV"), com data, mais recente primeiro', () => {
  assert.ok(NOVIDADES.length >= 10);
  NOVIDADES.forEach((n) => {
    assert.doesNotMatch(n.titulo, /SÓ DEV/i);
    assert.match(n.data, /^\d{4}-\d{2}-\d{2}$/);
  });
  assert.ok(NOVIDADES[0].data >= NOVIDADES[NOVIDADES.length - 1].data);
});

test('bibliotecaAgilSchema aceita busca opcional (e recusa texto enorme)', () => {
  assert.ok(bibliotecaAgilSchema.safeParse({}).success);
  assert.ok(bibliotecaAgilSchema.safeParse({ busca: 'pausar card' }).success);
  assert.ok(!bibliotecaAgilSchema.safeParse({ busca: 'x'.repeat(201) }).success);
});

test('sem busca: conceitos + família Oceano completos, índice da Ajuda (só títulos) e novidades recentes — resposta enxuta', async () => {
  const r = await makeBibliotecaAgilHandler()({});
  assert.deepEqual(r.grupos.map((g) => g.nome), ['Conceitos ágeis', 'Família Oceano']);
  assert.equal(r.grupos[0].verbetes, CONCEITOS_AGEIS);
  assert.equal(r.grupos[1].verbetes, ECOSSISTEMA_OCEANO);
  const indice = Object.values(r.indice_ajuda_do_mare).flat();
  assert.equal(indice.length, AJUDA_MARE.length + AJUDA_RADAR.length + AJUDA_OCEANO.length);
  assert.ok(r.novidades_recentes.length > 0 && r.novidades_recentes.every((n) => n.data && n.titulo && !n.texto));
  assert.ok(JSON.stringify(r).length < 30000, 'a visão geral não pode virar a Ajuda inteira');
});

test('busca encontra as funcionalidades por palavra-chave (sem acento/maiúscula) e devolve o verbete completo', async () => {
  const h = makeBibliotecaAgilHandler();
  const casos = [
    ['pausar card', /Pausar card/],
    ['RECORRENCIA automatica', /Recorrência automática/],
    ['dicas mini popups', /Dicas/],
    ['arezzo microsoft login', /só Hering/],
    ['radar atingimento', /Radar/],
    ['canal de venda marketplace', /Canal/],
    ['continuo sem data', /Contínuo/],
    ['raia por usuário', /Raia/],
  ];
  for (const [busca, esperado] of casos) {
    const r = await h({ busca });
    assert.ok(r.verbetes.length > 0 && r.verbetes.length <= 5, `"${busca}" sem resultado`);
    assert.ok(r.verbetes.some((v) => esperado.test(v.titulo)), `"${busca}" não trouxe ${esperado}: ${r.verbetes.map((v) => v.titulo).join(' / ')}`);
    r.verbetes.forEach((v) => assert.ok(v.texto.length <= 3500 + 120));
  }
});

test('busca sem resultado devolve aviso (sem inventar nada); busca só de palavras curtas cai no panorama', async () => {
  const h = makeBibliotecaAgilHandler();
  const r = await h({ busca: 'zzzxqwy' });
  assert.deepEqual(r.verbetes, []);
  assert.match(r.aviso, /Nada casou/);
  assert.equal(buscar('a o e'), null);
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
  assert.ok(fakeTool.input_schema.properties.busca, 'a ferramenta precisa expor o parâmetro busca');
  assert.equal(typeof fakeTool.handler, 'function');
  assert.equal(typeof realTool.handler, 'function');
  // Sem distinção fake/real: dado estático, mesmo conteúdo nos dois modos
  // (o handler em si não é reaproveitado entre chamadas de buildTools(),
  // só o comportamento é idêntico — real nunca toca {db, squadId, cardId}).
  assert.deepEqual(await fakeTool.handler({}), await realTool.handler({}));
  assert.deepEqual(await fakeTool.handler({ busca: 'pausar' }), await realTool.handler({ busca: 'pausar' }));
});
