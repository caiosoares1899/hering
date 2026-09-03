// functions/agente-agil-orquestrador/__tests__/visaoBoard.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const {
  summarizeBoard,
  cardTempos,
  cardTempoPorColuna,
  cardPausedMs,
  colWipLimit,
  makeFakeVisaoBoardHandler,
  makeRealVisaoBoardHandler,
  DEFAULT_PERIODO_DIAS,
} = require('../tools/visaoBoard');
const { buildTools } = require('../tools');

const H = 3600000;
const D = 24 * H;
const ago = (ms) => new Date(Date.now() - ms).toISOString();

const COLUMNS = [
  { id: 'backlog', name: 'Backlog' },
  { id: 'progress', name: 'Em Progresso' },
  { id: 'revisao', name: 'Revisão', wip: 2 },
  { id: 'blocker', name: 'Impedimentos' },
  { id: 'done', name: 'Concluído' },
];
const AGIL_CFG = { wip: 3 };

test('cardTempos calcula lead e cycle a partir de createdAt/firstStartAt/doneAt', () => {
  const card = {
    createdAt: ago(5 * D), // ISO completo — testa a matemática de horas, não o fallback de data-only
    flow: { firstStartAt: ago(4 * D), doneAt: ago(1 * D) },
  };
  const t = cardTempos(card);
  assert.equal(t.done, true);
  assert.ok(Math.abs(t.lead - 96) < 2, `lead esperado ~96h, veio ${t.lead}`);
  assert.ok(Math.abs(t.cycle - 72) < 2, `cycle esperado ~72h, veio ${t.cycle}`);
});

test('cardTempos devolve cycle/lead null quando não tem firstStartAt/createdAt', () => {
  const t = cardTempos({});
  assert.equal(t.lead, null);
  assert.equal(t.cycle, null);
  assert.equal(t.done, false);
});

// ⏸ Pausar (2026-09-03) — tempo pausado não deve contar em cycle/lead time.
test('cardPausedMs soma pausas encerradas + a pausa em andamento, se houver', () => {
  assert.equal(cardPausedMs({}), 0);
  assert.equal(cardPausedMs({ pausedMs: 3 * H }), 3 * H);
  const c = { pausedMs: 2 * H, paused: true, pausedAt: ago(1 * H) };
  assert.ok(Math.abs(cardPausedMs(c) - 3 * H) < 2000, `esperado ~3h em ms, veio ${cardPausedMs(c)}`);
  // paused:true sem pausedAt (estado inconsistente) não deve quebrar nem contar a pausa em andamento
  assert.equal(cardPausedMs({ pausedMs: H, paused: true, pausedAt: null }), H);
});

test('cardTempos subtrai o tempo pausado (pausedMs) de lead e cycle', () => {
  const card = {
    createdAt: ago(5 * D),
    flow: { firstStartAt: ago(4 * D), doneAt: ago(1 * D) },
    pausedMs: 24 * H, // 1 dia pausado, já encerrado
  };
  const t = cardTempos(card);
  assert.ok(Math.abs(t.lead - 72) < 2, `lead esperado ~72h (96h - 24h pausado), veio ${t.lead}`);
  assert.ok(Math.abs(t.cycle - 48) < 2, `cycle esperado ~48h (72h - 24h pausado), veio ${t.cycle}`);
});

test('cardTempos considera a pausa EM ANDAMENTO (paused:true) até agora, não só pausas já encerradas', () => {
  const card = {
    createdAt: ago(5 * D),
    flow: { firstStartAt: ago(4 * D), doneAt: null }, // ainda não concluído -> endMs = now
    paused: true,
    pausedAt: ago(2 * D), // pausado há 2 dias, ainda pausado agora
  };
  const t = cardTempos(card);
  // lead sem pausa seria ~5 dias (120h); com ~2 dias (48h) pausados até agora, sobra ~72h
  assert.ok(Math.abs(t.lead - 72) < 2, `lead esperado ~72h, veio ${t.lead}`);
});

test('cardTempos nunca fica negativo se o tempo pausado ultrapassar o elapsed (clamp em 0)', () => {
  const card = {
    createdAt: ago(1 * D),
    flow: { firstStartAt: ago(1 * D), doneAt: null },
    pausedMs: 10 * D, // absurdamente maior que o próprio lead — não deveria acontecer na prática, mas não pode virar tempo negativo
  };
  const t = cardTempos(card);
  assert.equal(t.lead, 0);
  assert.equal(t.cycle, 0);
});

test('cardTempoPorColuna soma o tempo entre transições consecutivas, atribuído à coluna de destino', () => {
  const card = {
    flow: {
      doneAt: ago(1 * D),
      log: [
        { from: 'backlog', to: 'progress', at: ago(4 * D) },
        { from: 'progress', to: 'revisao', at: ago(2 * D) },
        { from: 'revisao', to: 'done', at: ago(1 * D) },
      ],
    },
  };
  const tempos = cardTempoPorColuna(card);
  assert.ok(Math.abs(tempos.progress - 48) < 2, `progress esperado ~48h, veio ${tempos.progress}`);
  assert.ok(Math.abs(tempos.revisao - 24) < 2, `revisao esperado ~24h, veio ${tempos.revisao}`);
});

test('cardTempoPorColuna devolve objeto vazio sem flow.log', () => {
  assert.deepEqual(cardTempoPorColuna({}), {});
});

test('colWipLimit prioriza col.wip, cai pra agilCfg.wip só na coluna "progress", senão sem limite', () => {
  assert.equal(colWipLimit({ id: 'revisao', wip: 2 }, AGIL_CFG), 2);
  assert.equal(colWipLimit({ id: 'progress' }, AGIL_CFG), 3);
  assert.equal(colWipLimit({ id: 'backlog' }, AGIL_CFG), null);
});

test('summarizeBoard: WIP conta só cards ativos, só colunas com limite configurado', () => {
  const cards = [
    { id: 'c1', col: 'progress', archived: false },
    { id: 'c2', col: 'progress', archived: false },
    { id: 'c3', col: 'progress', archived: true }, // arquivado não conta
    { id: 'c4', col: 'revisao', archived: false },
    { id: 'c5', col: 'backlog', archived: false }, // backlog não tem limite configurado
  ];
  const board = summarizeBoard(cards, { columns: COLUMNS, agilCfg: AGIL_CFG, blockerMode: 'col', periodoDias: 14 });

  assert.deepEqual(
    board.wip.find((w) => w.coluna === 'Em Progresso'),
    { coluna: 'Em Progresso', atual: 2, limite: 3 }
  );
  assert.deepEqual(
    board.wip.find((w) => w.coluna === 'Revisão'),
    { coluna: 'Revisão', atual: 1, limite: 2 }
  );
  assert.ok(!board.wip.find((w) => w.coluna === 'Backlog'));
});

test('summarizeBoard: throughput/cycle/lead só consideram cards concluídos dentro do período', () => {
  const cards = [
    {
      id: 'dentro',
      col: 'done',
      archived: false,
      createdAt: ago(5 * D).slice(0, 10),
      flow: { firstStartAt: ago(4 * D), doneAt: ago(1 * D) },
    },
    {
      id: 'fora_do_periodo',
      col: 'done',
      archived: false,
      createdAt: ago(60 * D).slice(0, 10),
      flow: { firstStartAt: ago(50 * D), doneAt: ago(30 * D) },
    },
    { id: 'ainda_nao_concluido', col: 'progress', archived: false, flow: { firstStartAt: ago(1 * D) } },
  ];
  const board = summarizeBoard(cards, { columns: COLUMNS, agilCfg: AGIL_CFG, blockerMode: 'col', periodoDias: 14 });

  assert.equal(board.throughput.concluidos_periodo, 1);
  assert.equal(board.cycle_time.amostra, 1);
  assert.equal(board.lead_time.amostra, 1);
  assert.ok(Math.abs(board.cycle_time.media_horas - 72) < 2);
});

test('summarizeBoard: cycle_time devolve média E mediana corretas com amostra >1', () => {
  const mk = (cycleHoras) => ({
    id: 'c_' + cycleHoras,
    col: 'done',
    archived: false,
    createdAt: ago(10 * D).slice(0, 10),
    flow: { firstStartAt: ago(cycleHoras * H + 1 * D), doneAt: ago(1 * D) },
  });
  // cycles aproximados: 24h, 48h, 96h -> média 56, mediana 48
  const cards = [mk(24), mk(48), mk(96)];
  const board = summarizeBoard(cards, { columns: COLUMNS, agilCfg: AGIL_CFG, blockerMode: 'col', periodoDias: 30 });

  assert.equal(board.cycle_time.amostra, 3);
  assert.ok(Math.abs(board.cycle_time.media_horas - 56) < 3, `média esperada ~56, veio ${board.cycle_time.media_horas}`);
  assert.ok(Math.abs(board.cycle_time.mediana_horas - 48) < 3, `mediana esperada ~48, veio ${board.cycle_time.mediana_horas}`);
});

test('summarizeBoard: gargalo_por_coluna rankeia por média de tempo, maior primeiro', () => {
  const card = {
    id: 'c1',
    col: 'done',
    archived: false,
    createdAt: ago(5 * D).slice(0, 10),
    flow: {
      firstStartAt: ago(4 * D),
      doneAt: ago(1 * D),
      log: [
        { from: 'backlog', to: 'progress', at: ago(4 * D) }, // 2 dias em progress
        { from: 'progress', to: 'revisao', at: ago(2 * D) }, // 1 dia em revisao
        { from: 'revisao', to: 'done', at: ago(1 * D) },
      ],
    },
  };
  const board = summarizeBoard([card], { columns: COLUMNS, agilCfg: AGIL_CFG, blockerMode: 'col', periodoDias: 14 });

  assert.equal(board.gargalo_por_coluna[0].coluna, 'Em Progresso'); // maior média primeiro
  assert.ok(board.gargalo_por_coluna[0].media_horas > board.gargalo_por_coluna[1].media_horas);
});

test('summarizeBoard: bloqueios_ativos respeita blockerMode "col" e "field"', () => {
  const cardsCol = [
    { id: 'b1', col: 'blocker', archived: false },
    { id: 'b2', col: 'progress', archived: false },
  ];
  const boardCol = summarizeBoard(cardsCol, { columns: COLUMNS, agilCfg: AGIL_CFG, blockerMode: 'col', periodoDias: 14 });
  assert.equal(boardCol.bloqueios_ativos, 1);

  const cardsField = [
    { id: 'b1', col: 'progress', blocker: true, archived: false },
    { id: 'b2', col: 'progress', archived: false },
  ];
  const boardField = summarizeBoard(cardsField, { columns: COLUMNS, agilCfg: AGIL_CFG, blockerMode: 'field', periodoDias: 14 });
  assert.equal(boardField.bloqueios_ativos, 1);
});

test('summarizeBoard: board vazio não quebra, devolve zeros/null coerentes', () => {
  const board = summarizeBoard([], { columns: COLUMNS, agilCfg: AGIL_CFG, blockerMode: 'col', periodoDias: 14 });
  assert.equal(board.throughput.concluidos_periodo, 0);
  assert.equal(board.cycle_time.amostra, 0);
  assert.equal(board.cycle_time.media_horas, null);
  assert.deepEqual(board.gargalo_por_coluna, []);
  assert.equal(board.bloqueios_ativos, 0);
});

test('handler fake de visao_board devolve board simulado, sem tocar banco nenhum', async () => {
  const handler = makeFakeVisaoBoardHandler();
  const result = await handler();
  assert.equal(result.ok, true);
  assert.equal(result.simulated, true);
  assert.equal(result.board.periodo_dias, DEFAULT_PERIODO_DIAS);
});

test('handler real de visao_board lê board de verdade (fake db) e agrega', async () => {
  const db = makeFakeDb({
    kanban: {
      squads: {
        dev: {
          dados: {
            cards: {
              1: {
                id: 'c1',
                col: 'done',
                archived: false,
                createdAt: ago(5 * D).slice(0, 10),
                flow: { firstStartAt: ago(4 * D), doneAt: ago(1 * D) },
              },
              2: { id: 'c2', col: 'progress', archived: false },
            },
            columns: COLUMNS,
            agil_cfg: AGIL_CFG,
            config: { blockerMode: 'col' },
          },
        },
      },
    },
  });

  const handler = makeRealVisaoBoardHandler({ db, squadId: 'dev' });
  const result = await handler({});

  assert.equal(result.ok, true);
  assert.equal(result.tool, 'visao_board');
  assert.equal(result.board.throughput.concluidos_periodo, 1);
  assert.ok(result.board.wip.find((w) => w.coluna === 'Em Progresso'));
});

test('handler real de visao_board aceita periodo_dias explícito', async () => {
  const db = makeFakeDb({
    kanban: {
      squads: {
        dev: {
          dados: {
            cards: {
              1: {
                id: 'c1',
                col: 'done',
                archived: false,
                createdAt: ago(20 * D).slice(0, 10),
                flow: { firstStartAt: ago(19 * D), doneAt: ago(10 * D) },
              },
            },
            columns: COLUMNS,
            agil_cfg: AGIL_CFG,
            config: { blockerMode: 'col' },
          },
        },
      },
    },
  });

  const handler = makeRealVisaoBoardHandler({ db, squadId: 'dev' });
  const curto = await handler({ periodo_dias: 5 });
  const longo = await handler({ periodo_dias: 30 });

  assert.equal(curto.board.throughput.concluidos_periodo, 0); // fora da janela de 5 dias
  assert.equal(longo.board.throughput.concluidos_periodo, 1); // dentro da janela de 30 dias
});

test('buildTools() expõe visao_board em modo fake e real, com periodo_dias opcional no schema', () => {
  const fakeTools = buildTools();
  const visaoBoardFake = fakeTools.find((t) => t.name === 'visao_board');
  assert.ok(visaoBoardFake);
  assert.ok(visaoBoardFake.input_schema.properties.periodo_dias);
  assert.ok(!(visaoBoardFake.input_schema.required || []).includes('periodo_dias'));

  const db = makeFakeDb({ kanban: { squads: { dev: { dados: { cards: {}, cards_index: {} } } } } });
  const realTools = buildTools({ mode: 'real', db, squadId: 'dev', cardId: 'c9' });
  assert.ok(realTools.find((t) => t.name === 'visao_board'));
});
