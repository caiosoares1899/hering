// functions/agente-agil-orquestrador/__tests__/analisePO.test.js
//
// Cobertura de buildBoardPOPayload()/campanhasRelevantes()/
// collectBoardPOData()/gerarAnalisePO() — a lógica pura e de I/O do
// "🤖 Análise do board (PO)" dentro de "Meu Dia". Não testa o wrapper
// agenteAgilAnalisePO (onRequest) em si — mesmo raciocínio já aplicado a
// resumoMeuDia.test.js/analiseDados.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const flowLib = require('../../agente-agil/flow');
const {
  buildBoardPOPayload,
  campanhasRelevantes,
  collectBoardPOData,
  gerarAnalisePO,
  buildUserMessage,
  todaySP,
  MIN_CLUSTER_TAG,
} = require('../analisePO');

const HOJE = todaySP();
const ONTEM = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const SEMANA_QUE_VEM = new Date(Date.now() + 5 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

const COLUNAS = [
  { id: 'backlog', name: 'Backlog' },
  { id: 'progress', name: 'Em andamento' },
  { id: 'blocker', name: 'Impedimentos' },
  { id: 'done', name: 'Concluído' },
];
const FLOW_META = { columns: COLUNAS, flowConfig: { startCols: [], doneCols: ['done'], reportCols: [] } };
const TAGS_DEF = [
  { id: 't-verao', label: 'Verão' },
  { id: 't-inverno', label: 'Inverno' },
];

test('campanhasRelevantes: só ativa/planejamento, filtra por squad (squads vazio = global)', () => {
  const raw = {
    c1: { nome: 'A', status: 'ativa', squads: ['dev'] },
    c2: { nome: 'B', status: 'planejamento', squads: ['dados'] },
    c3: { nome: 'C', status: 'encerrada', squads: ['dev'] },
    c4: { nome: 'D', status: 'ativa', squads: [] },
    c5: { nome: 'E', status: 'ativa', squads: ['ecomm'] },
  };
  const rel = campanhasRelevantes(raw, 'dev');
  assert.deepEqual(rel.map((c) => c.nome).sort(), ['A', 'D']);
});

test('buildBoardPOPayload: separa atrasados/bloqueados/incompletos e exclui cards em coluna de fim', () => {
  const cards = [
    { id: 'c1', title: 'Atrasado', col: 'progress', due: ONTEM, desc: 'ok', checklist: [{ t: 'x', done: true }] },
    { id: 'c2', title: 'Bloqueado', col: 'blocker' },
    { id: 'c3', title: 'Incompleto', col: 'backlog' },
    { id: 'c4', title: 'Concluído atrasado (não conta)', col: 'done', due: ONTEM },
    { id: 'c5', title: 'Arquivado (não conta)', col: 'progress', due: ONTEM, archived: true },
    { id: 'c6', title: 'Em dia', col: 'progress', due: SEMANA_QUE_VEM, desc: 'ok', checklist: [{ t: 'x', done: false }] },
  ];
  const payload = buildBoardPOPayload({
    squadId: 'dev', cards, flowMeta: FLOW_META, agilCfg: {}, blockerMode: 'col', tagsDef: TAGS_DEF, campanhasRaw: {},
  });

  assert.deepEqual(payload.atrasados.map((c) => c.titulo), ['Atrasado']);
  assert.equal(payload.atrasados[0].diasAtraso, 1);
  assert.deepEqual(payload.bloqueados.map((c) => c.titulo), ['Bloqueado']);
  assert.deepEqual(payload.incompletos.map((c) => c.titulo).sort(), ['Bloqueado', 'Incompleto']);
  assert.equal(payload.squad, 'dev');
  assert.ok(payload.board); // veio de summarizeBoard()
});

test('buildBoardPOPayload: tagsSemCampanha exclui tags já cobertas por campanha ativa/planejamento e respeita MIN_CLUSTER_TAG', () => {
  assert.equal(MIN_CLUSTER_TAG, 3);
  const cards = [
    { id: 'c1', title: 'A', col: 'backlog', tags: ['t-verao'] },
    { id: 'c2', title: 'B', col: 'backlog', tags: ['t-verao'] },
    { id: 'c3', title: 'C', col: 'backlog', tags: ['t-verao'] },
    { id: 'c4', title: 'D', col: 'backlog', tags: ['t-inverno'] },
    { id: 'c5', title: 'E', col: 'backlog', tags: ['t-inverno'] },
  ];
  // t-verao já tem campanha ativa cobrindo -> não deve aparecer, mesmo com 3 cards.
  // t-inverno não tem campanha nenhuma, mas só 2 cards -> abaixo do MIN_CLUSTER_TAG.
  const campanhasRaw = { camp1: { nome: 'Verão 2026', status: 'ativa', squads: ['dev'], tags: ['t-verao'] } };

  const payload = buildBoardPOPayload({
    squadId: 'dev', cards, flowMeta: FLOW_META, agilCfg: {}, blockerMode: 'col', tagsDef: TAGS_DEF, campanhasRaw,
  });

  assert.deepEqual(payload.tagsSemCampanha, []);
  assert.deepEqual(payload.campanhasAtivas, [{ nome: 'Verão 2026', tipo: 'campanha', status: 'ativa', tags: ['Verão'] }]);
});

test('buildBoardPOPayload: tag sem cobertura E com volume suficiente aparece em tagsSemCampanha, com label resolvido', () => {
  const cards = [
    { id: 'c1', title: 'A', col: 'backlog', tags: ['t-inverno'] },
    { id: 'c2', title: 'B', col: 'backlog', tags: ['t-inverno'] },
    { id: 'c3', title: 'C', col: 'backlog', tags: ['t-inverno'] },
    { id: 'c4', title: 'D', col: 'backlog', tags: ['t-inverno'] },
  ];
  const payload = buildBoardPOPayload({
    squadId: 'dev', cards, flowMeta: FLOW_META, agilCfg: {}, blockerMode: 'col', tagsDef: TAGS_DEF, campanhasRaw: {},
  });

  assert.deepEqual(payload.tagsSemCampanha, [{ tag: 'Inverno', qtd: 4 }]);
});

function seedDb({ dev, campanhas, tags } = {}) {
  flowLib._resetCacheForTests();
  return makeFakeDb({
    kanban: {
      campanhas: campanhas || {},
      squads: {
        dev: {
          dados: {
            cards: (dev && dev.cards) || {},
            columns: COLUNAS,
            config: { flow: FLOW_META.flowConfig, blockerMode: (dev && dev.blockerMode) || 'col' },
            agil_cfg: (dev && dev.agilCfg) || {},
            tags: tags || TAGS_DEF,
          },
        },
      },
    },
  });
}

test('collectBoardPOData: lê tudo via Admin SDK e devolve o mesmo payload de buildBoardPOPayload', async () => {
  const db = seedDb({
    dev: { cards: { 0: { id: 'c1', title: 'Atrasado de verdade', col: 'progress', due: ONTEM, tags: ['t-verao'] } } },
  });

  const payload = await collectBoardPOData(db, 'dev');

  assert.equal(payload.squad, 'dev');
  assert.deepEqual(payload.atrasados.map((c) => c.titulo), ['Atrasado de verdade']);
});

function scriptedLlmClient(script) {
  let calls = 0;
  return {
    calls: () => calls,
    async decide() {
      const response = script[calls];
      calls++;
      return response;
    },
  };
}

test('gerarAnalisePO: chama o LLM sem nenhuma tool e devolve o texto', async () => {
  const db = seedDb({ dev: { cards: { 0: { id: 'c1', title: 'Card', col: 'backlog' } } } });
  let toolsRecebidas = null;
  const llmClient = { async decide({ tools }) { toolsRecebidas = tools; return { text: 'Leitura do board aqui.' }; } };

  const resultado = await gerarAnalisePO({ db, squadId: 'dev', llmClient });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.analise, 'Leitura do board aqui.');
  assert.deepEqual(toolsRecebidas, []);
});

test('gerarAnalisePO: resposta vazia do LLM cai num texto de fallback, não quebra', async () => {
  const db = seedDb({});
  const llmClient = scriptedLlmClient([{ text: null }]);

  const resultado = await gerarAnalisePO({ db, squadId: 'dev', llmClient });

  assert.equal(resultado.ok, true);
  assert.ok(resultado.analise.length > 0);
});

test('buildUserMessage: inclui o squad e o payload serializado', () => {
  const msg = buildUserMessage({ squad: 'dev', board: { wip: [] }, atrasados: [], bloqueados: [], incompletos: [], campanhasAtivas: [], tagsSemCampanha: [] });
  assert.ok(msg.includes('squad dev'));
  assert.ok(msg.includes('"wip":[]'));
});
