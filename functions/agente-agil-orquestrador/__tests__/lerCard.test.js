// functions/agente-agil-orquestrador/__tests__/lerCard.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { summarizeCard, makeRealLerCardHandler, makeFakeLerCardHandler, COMMENTS_CAP } = require('../tools/lerCard');
const { buildTools } = require('../tools');
const { runLoop } = require('../loop');
const flowLib = require('../../agente-agil/flow');

const COLUMNS = [
  { id: 'backlog', name: 'Backlog' },
  { id: 'progress', name: 'Em andamento' },
  { id: 'done', name: 'Concluído' },
];
const MEMBERS = [
  { uid: 'uidAna', init: 'ANA', name: 'Ana Silva', email: 'ana.silva@ciahering.com.br' },
  { uid: 'uidBru', init: 'BRU', name: 'Bruno Tanaka', email: 'bruno.tanaka@ciahering.com.br' },
];
const TAGS = [
  { id: 'tag_1', label: 'Urgente' },
  { id: 'tag_2', label: 'Piloto' },
];

test('summarizeCard resolve coluna, tags, responsável/participantes e checklist pro formato curado', () => {
  const card = {
    title: 'Card X',
    desc: 'Descrição do card',
    priority: 'high',
    tags: ['tag_2', 'tag_desconhecida'],
    col: 'progress',
    owner: 'ANA',
    participants: ['BRU'],
    checklist: [
      { t: 'Revisar PR', done: true, grp: 'default' },
      { t: 'Item sem grupo conhecido', done: false, grp: 'grupo-sumiu' },
    ],
    checklistGroups: [{ id: 'default', title: 'Checklist' }],
  };
  // Comentários chegam separados do card desde a migração Fase 1.1 (ver
  // cardCommentsPath() em agente-agil/board.js) — summarizeCard() recebe
  // via `comments`, não mais `card.comments`.
  const comments = {
    c1: { author: 'Ana Silva', text: 'primeiro', ts: '2026-07-01T10:00:00.000Z' },
    c2: { author: 'Bruno Tanaka', text: 'segundo', ts: '2026-07-02T10:00:00.000Z' },
  };

  const resumo = summarizeCard(card, { columns: COLUMNS, flowConfig: { doneCols: ['done'] }, squadTags: TAGS, members: MEMBERS, comments });

  assert.equal(resumo.titulo, 'Card X');
  assert.equal(resumo.desc, 'Descrição do card');
  assert.equal(resumo.prioridade, 'high');
  assert.deepEqual(resumo.tags, ['Piloto', 'tag_desconhecida']); // tag desconhecida cai pro próprio id, não quebra
  assert.deepEqual(resumo.coluna, { id: 'progress', nome: 'Em andamento' });
  // Achado real (item 7): mover_coluna precisa do ID, não do nome — sem
  // isso o agente não tinha como resolver "Concluído" -> 'done'. Lista
  // TODAS as colunas do board, marcando quais são "fim" (flowConfig.doneCols).
  assert.deepEqual(resumo.colunas_disponiveis, [
    { id: 'backlog', nome: 'Backlog', fim: false },
    { id: 'progress', nome: 'Em andamento', fim: false },
    { id: 'done', nome: 'Concluído', fim: true },
  ]);
  assert.deepEqual(resumo.responsavel, { init: 'ANA', nome: 'Ana Silva' });
  assert.deepEqual(resumo.participantes, [{ init: 'BRU', nome: 'Bruno Tanaka' }]);
  assert.deepEqual(resumo.checklist, [
    { texto: 'Revisar PR', done: true, grupo: 'Checklist' },
    { texto: 'Item sem grupo conhecido', done: false, grupo: 'grupo-sumiu' }, // grupo não encontrado -> cai pro id cru
  ]);
  assert.deepEqual(resumo.comentarios, [
    { autor: 'Ana Silva', texto: 'primeiro', quando: '2026-07-01T10:00:00.000Z' },
    { autor: 'Bruno Tanaka', texto: 'segundo', quando: '2026-07-02T10:00:00.000Z' },
  ]);
});

test('summarizeCard limita comentários aos últimos COMMENTS_CAP, cronológico', () => {
  const comments = {};
  for (let i = 0; i < COMMENTS_CAP + 5; i++) {
    comments['c' + i] = { author: 'X', text: 'msg ' + i, ts: new Date(2026, 0, 1 + i).toISOString() };
  }
  const card = { col: 'backlog' };
  const resumo = summarizeCard(card, { columns: COLUMNS, squadTags: [], members: [], comments });

  assert.equal(resumo.comentarios.length, COMMENTS_CAP);
  assert.equal(resumo.comentarios[0].texto, 'msg 5'); // os 5 mais antigos ficaram de fora
  assert.equal(resumo.comentarios[COMMENTS_CAP - 1].texto, 'msg ' + (COMMENTS_CAP + 4));
});

test('summarizeCard lida com card praticamente vazio sem quebrar', () => {
  const resumo = summarizeCard({}, { columns: COLUMNS, squadTags: [], members: [] });
  assert.equal(resumo.titulo, '');
  assert.equal(resumo.responsavel, null);
  assert.deepEqual(resumo.participantes, []);
  assert.deepEqual(resumo.checklist, []);
  assert.deepEqual(resumo.comentarios, []);
});

test('summarizeCard: sem flowConfig, colunas_disponiveis cai na heurística de nome pra decidir "fim" (mesma de doneColumnIds)', () => {
  // Nenhum doneCols configurado pelo PO — flowLib.doneColumnIds() cai no
  // fallback por nome/id ('done'/conclu.../feito.../finaliz...). A coluna
  // 'done' (nome "Concluído") bate.
  const resumo = summarizeCard({ col: 'backlog' }, { columns: COLUMNS, squadTags: [], members: [] });
  assert.deepEqual(resumo.colunas_disponiveis, [
    { id: 'backlog', nome: 'Backlog', fim: false },
    { id: 'progress', nome: 'Em andamento', fim: false },
    { id: 'done', nome: 'Concluído', fim: true },
  ]);
});

test('summarizeCard: board sem coluna nenhuma não quebra (colunas_disponiveis vazio)', () => {
  const resumo = summarizeCard({}, { columns: [], squadTags: [], members: [] });
  assert.deepEqual(resumo.colunas_disponiveis, []);
});

test('handler fake de ler_card devolve um resumo simulado, sem tocar banco nenhum', async () => {
  const handler = makeFakeLerCardHandler();
  const result = await handler();
  assert.equal(result.ok, true);
  assert.equal(result.simulated, true);
  assert.equal(typeof result.card.titulo, 'string');
});

test('handler real de ler_card lê o card de verdade (fake db) e devolve o resumo curado', async () => {
  // flow.js cacheia readFlowMeta() por squadId (TTL 60s, cache global de
  // módulo) — reseta antes pra não pegar `columns`/`flowConfig` de um
  // teste anterior que também usou squadId 'dev' (mesmo padrão de
  // membersLib._resetCacheForTests() já usado em outros arquivos de teste).
  flowLib._resetCacheForTests();
  const db = makeFakeDb({
    kanban: {
      usuarios_publicos: {
        uidAna: { nome: 'Ana Silva', email: 'ana.silva@ciahering.com.br', init: 'ANA', squads: { dev: true } },
      },
      squads: {
        dev: {
          dados: {
            // `comments` dentro do card é campo MORTO desde a migração Fase
            // 1.1 (kanban-dev.html, 2026-08-11) — deixado aqui de propósito
            // com um comentário-isca que NÃO deve aparecer no resumo, prova
            // de que o handler não volta a ler dali por acidente.
            cards: { 9: { id: 'c9', title: 'Card real', col: 'backlog', owner: 'ANA', comments: { isca: { author: 'Fantasma', text: 'não deveria aparecer', ts: '2020-01-01T00:00:00.000Z' } }, checklist: [] } },
            cards_index: { c9: '9' },
            tags: [],
            columns: COLUMNS,
            config: { flow: { doneCols: ['done'] } },
            // Comentário de verdade, no path correto (card_comments/{cardId}).
            card_comments: { c9: { cReal: { author: 'Ana Silva', text: 'comentário de verdade', ts: '2026-08-18T10:00:00.000Z' } } },
          },
        },
      },
    },
  });

  const handler = makeRealLerCardHandler({ db, squadId: 'dev', cardId: 'c9' });
  const result = await handler();

  assert.equal(result.ok, true);
  assert.equal(result.card.titulo, 'Card real');
  assert.deepEqual(result.card.responsavel, { init: 'ANA', nome: 'Ana Silva' });
  // Lê do path novo (card_comments), ignora o campo morto card.comments.
  assert.deepEqual(result.card.comentarios, [{ autor: 'Ana Silva', texto: 'comentário de verdade', quando: '2026-08-18T10:00:00.000Z' }]);
  // Achado real (item 7): lista completa de colunas pra resolver nome -> id
  // antes de mover_coluna, respeitando o doneCols configurado pelo PO.
  assert.deepEqual(result.card.colunas_disponiveis, [
    { id: 'backlog', nome: 'Backlog', fim: false },
    { id: 'progress', nome: 'Em andamento', fim: false },
    { id: 'done', nome: 'Concluído', fim: true },
  ]);
});

test('handler real de ler_card devolve card_not_found quando o cardId não existe', async () => {
  const db = makeFakeDb({ kanban: { squads: { dev: { dados: { cards: {}, cards_index: {} } } } } });
  const handler = makeRealLerCardHandler({ db, squadId: 'dev', cardId: 'nao-existe' });
  const result = await handler();
  assert.deepEqual(result, { ok: false, error: 'card_not_found', cardId: 'nao-existe', squadId: 'dev' });
});

test('buildTools() expõe ler_card em modo fake e real, com schema de input vazio', () => {
  const fakeTools = buildTools();
  const lerCardFake = fakeTools.find((t) => t.name === 'ler_card');
  assert.ok(lerCardFake);
  assert.deepEqual(lerCardFake.input_schema.properties, {});

  const db = makeFakeDb({ kanban: { squads: { dev: { dados: { cards: {}, cards_index: {} } } } } });
  const realTools = buildTools({ mode: 'real', db, squadId: 'dev', cardId: 'c9' });
  assert.ok(realTools.find((t) => t.name === 'ler_card'));
});

test('integração: o loop consegue encadear ler_card -> comentario com o cliente scriptado', async () => {
  const db = makeFakeDb({
    kanban: {
      squads: {
        dev: {
          dados: {
            cards: { 9: { id: 'c9', title: 'Card real', col: 'backlog', comments: {}, checklist: [] } },
            cards_index: { c9: '9' },
          },
        },
      },
    },
  });
  // dryRun:false — regressão de propósito (achado 2026-08-18): quer provar
  // não só que o loop encadeia ler_card -> comentario, mas que o comentário
  // realmente aparece no path certo depois de uma escrita de verdade.
  const tools = buildTools({ mode: 'real', db, squadId: 'dev', cardId: 'c9', dryRun: false });

  let call = 0;
  const llmClient = {
    async decide() {
      call++;
      if (call === 1) return { toolCalls: [{ id: '1', name: 'ler_card', input: {} }], text: null };
      if (call === 2) return { toolCalls: [{ id: '2', name: 'comentario', input: { type: 'comentario', texto: 'Analisei: card ainda sem checklist.' } }], text: null };
      return { toolCalls: [], text: 'Concluído.' };
    },
  };

  const result = await runLoop({ llmClient, tools, system: 'sys', task: 'Dá uma olhada e vê se falta algo.', enabled: true });

  assert.equal(result.status, 'done');
  assert.deepEqual(result.steps.map((s) => s.toolCalls[0].name), ['ler_card', 'comentario']);
  assert.equal(result.steps[0].toolCalls[0].output.card.titulo, 'Card real');

  // Regressão do achado 2026-08-18: o comentário escrito pelo `comentario`
  // tem que ir pro path novo (card_comments/{cardId}), não pro campo morto
  // card.comments — senão a UI (kanban-dev.html) nunca mostra o que o
  // agente escreveu, mesmo com o output da chamada reportando sucesso.
  const novoPath = await db.ref('kanban/squads/dev/dados/card_comments/c9').get();
  const comentariosNovos = Object.values(novoPath.val() || {});
  assert.equal(comentariosNovos.length, 1);
  assert.equal(comentariosNovos[0].text, 'Analisei: card ainda sem checklist.');

  const cardAposEscrita = await db.ref('kanban/squads/dev/dados/cards/9').get();
  assert.deepEqual(cardAposEscrita.val().comments, {}); // campo morto continua vazio, não recebe mais nada
});
