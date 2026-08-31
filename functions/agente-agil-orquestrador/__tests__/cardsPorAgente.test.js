// functions/agente-agil-orquestrador/__tests__/cardsPorAgente.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const {
  resolveAgenteFiltro,
  resumoCard,
  agruparPorAgente,
  makeFakeCardsPorAgenteHandler,
  makeRealCardsPorAgenteHandler,
} = require('../tools/cardsPorAgente');
const { buildTools } = require('../tools');
const flowLib = require('../../agente-agil/flow');

const COLUMNS = [
  { id: 'backlog', name: 'Backlog' },
  { id: 'progress', name: 'Em andamento' },
  { id: 'done', name: 'Concluído' },
];
const AGENTES = [
  { id: 'ag1', nome: 'Claude Code', init: 'CC', cor: '#a78bfa', avatarEmoji: '✨' },
  { id: 'ag2', nome: 'Agente Fictício (exemplo)', init: 'AF', cor: '#a78bfa', avatarEmoji: '🤖' },
];

test('resolveAgenteFiltro acha por init (case-insensitive)', () => {
  assert.deepEqual(resolveAgenteFiltro(AGENTES, 'cc'), AGENTES[0]);
  assert.deepEqual(resolveAgenteFiltro(AGENTES, 'CC'), AGENTES[0]);
});

test('resolveAgenteFiltro acha por nome (case-insensitive)', () => {
  assert.deepEqual(resolveAgenteFiltro(AGENTES, 'claude code'), AGENTES[0]);
});

test('resolveAgenteFiltro sem input devolve null (modo "agrupa por todos")', () => {
  assert.equal(resolveAgenteFiltro(AGENTES, undefined), null);
  assert.equal(resolveAgenteFiltro(AGENTES, ''), null);
});

test('resolveAgenteFiltro não acha -> null (chamador decide o erro)', () => {
  assert.equal(resolveAgenteFiltro(AGENTES, 'ninguem'), null);
});

test('resumoCard mapeia campos essenciais, resolvendo nome da coluna', () => {
  const card = { id: 'c1', title: 'Card X', col: 'progress', priority: 'high', due: '2026-09-01' };
  assert.deepEqual(resumoCard(card, COLUMNS), {
    id: 'c1', titulo: 'Card X', coluna: 'Em andamento', prioridade: 'high', prazo: '2026-09-01',
  });
});

test('agruparPorAgente filtra por owner OU participants, ignora arquivados', () => {
  const cards = [
    { id: 'c1', title: 'Card do CC (owner)', col: 'backlog', owner: 'CC' },
    { id: 'c2', title: 'Card do CC (participante)', col: 'progress', owner: 'ANA', participants: ['CC'] },
    { id: 'c3', title: 'Card do AF', col: 'done', owner: 'AF' },
    { id: 'c4', title: 'Card do CC arquivado', col: 'done', owner: 'CC', archived: true },
    { id: 'c5', title: 'Card sem agente nenhum', col: 'backlog', owner: 'ANA' },
  ];
  const resultado = agruparPorAgente(cards, AGENTES, COLUMNS);
  assert.equal(resultado.length, 2);
  const cc = resultado.find((r) => r.agente.init === 'CC');
  assert.equal(cc.total, 2);
  assert.deepEqual(cc.cards.map((c) => c.id), ['c1', 'c2']);
  const af = resultado.find((r) => r.agente.init === 'AF');
  assert.equal(af.total, 1);
  assert.deepEqual(af.cards.map((c) => c.id), ['c3']);
});

test('agruparPorAgente com agente sem card nenhum -> total 0, cards vazio (não some da lista)', () => {
  const resultado = agruparPorAgente([{ id: 'c1', title: 'X', col: 'backlog', owner: 'ANA' }], AGENTES, COLUMNS);
  assert.equal(resultado.length, 2);
  assert.deepEqual(resultado.map((r) => r.total), [0, 0]);
});

test('handler fake devolve um resultado simulado, sem tocar banco nenhum', async () => {
  const handler = makeFakeCardsPorAgenteHandler();
  const result = await handler();
  assert.equal(result.ok, true);
  assert.equal(result.simulated, true);
  assert.ok(Array.isArray(result.resultado));
});

test('handler real, sem filtro: agrupa por todos os agentes cadastrados no squad', async () => {
  flowLib._resetCacheForTests();
  const db = makeFakeDb({
    kanban: {
      squads: {
        dev: {
          dados: {
            agentes: { ag1: AGENTES[0], ag2: AGENTES[1] },
            cards: {
              1: { id: 'c1', title: 'Card do CC', col: 'backlog', owner: 'CC' },
              2: { id: 'c2', title: 'Card do AF', col: 'done', owner: 'AF' },
            },
            cards_index: { c1: '1', c2: '2' },
            columns: COLUMNS,
            config: { flow: {} },
          },
        },
      },
    },
  });

  const handler = makeRealCardsPorAgenteHandler({ db, squadId: 'dev' });
  const result = await handler({});

  assert.equal(result.ok, true);
  assert.equal(result.resultado.length, 2);
  assert.deepEqual(
    result.resultado.map((r) => [r.agente.init, r.total]),
    [['CC', 1], ['AF', 1]]
  );
});

test('handler real, com filtro por init: devolve só o agente pedido', async () => {
  flowLib._resetCacheForTests();
  const db = makeFakeDb({
    kanban: {
      squads: {
        dev: {
          dados: {
            agentes: { ag1: AGENTES[0], ag2: AGENTES[1] },
            cards: {
              1: { id: 'c1', title: 'Card do CC', col: 'backlog', owner: 'CC' },
              2: { id: 'c2', title: 'Card do AF', col: 'done', owner: 'AF' },
            },
            cards_index: { c1: '1', c2: '2' },
            columns: COLUMNS,
            config: { flow: {} },
          },
        },
      },
    },
  });

  const handler = makeRealCardsPorAgenteHandler({ db, squadId: 'dev' });
  const result = await handler({ agente: 'Claude Code' });

  assert.equal(result.ok, true);
  assert.equal(result.resultado.length, 1);
  assert.equal(result.resultado[0].agente.init, 'CC');
  assert.deepEqual(result.resultado[0].cards.map((c) => c.id), ['c1']);
});

test('handler real: agente pedido não existe -> erro com a lista de agentes disponíveis', async () => {
  flowLib._resetCacheForTests();
  const db = makeFakeDb({
    kanban: { squads: { dev: { dados: { agentes: { ag1: AGENTES[0] }, cards: {}, cards_index: {}, columns: COLUMNS, config: { flow: {} } } } } },
  });
  const handler = makeRealCardsPorAgenteHandler({ db, squadId: 'dev' });
  const result = await handler({ agente: 'não existe' });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'agente_nao_encontrado');
  assert.deepEqual(result.agentes_disponiveis, ['Claude Code']);
});

test('handler real: squad sem nenhum agente cadastrado -> resultado vazio com aviso, não erro', async () => {
  flowLib._resetCacheForTests();
  const db = makeFakeDb({
    kanban: { squads: { dev: { dados: { cards: {}, cards_index: {}, columns: COLUMNS, config: { flow: {} } } } } },
  });
  const handler = makeRealCardsPorAgenteHandler({ db, squadId: 'dev' });
  const result = await handler({});
  assert.equal(result.ok, true);
  assert.deepEqual(result.resultado, []);
  assert.ok(result.aviso);
});

test('buildTools() expõe cards_por_agente nos modos fake e real, com o mesmo comportamento', () => {
  const fakeTools = buildTools();
  const fake = fakeTools.find((t) => t.name === 'cards_por_agente');
  assert.ok(fake);
  assert.deepEqual(Object.keys(fake.input_schema.properties), ['agente']);

  const db = makeFakeDb({ kanban: { squads: { dev: { dados: { cards: {}, cards_index: {} } } } } });
  const realTools = buildTools({ mode: 'real', db, squadId: 'dev', cardId: 'c9' });
  assert.ok(realTools.find((t) => t.name === 'cards_por_agente'));

  // Também disponível em modo semCard (não exige cardId fixo, mesma
  // categoria de visao_board/biblioteca_agil/criar_card) — ver comentário
  // em buildTools() (tools/index.js).
  const semCardTools = buildTools({ mode: 'real', db, squadId: 'dev', semCard: true });
  assert.ok(semCardTools.find((t) => t.name === 'cards_por_agente'));
});
