// Sprint 3: vocabulário de ações (checklist_item, agent_status,
// mover_coluna, editar_campos) + resolução de @menções/notificar. Usa o
// fake db de fakeDb.js pra exercitar buildWritePlan() + applyWritePlan()
// de ponta a ponta (boa parte da lógica nova só roda dentro do hook
// `after`, que só dispara de verdade dentro de applyWritePlan) — sem
// emulador, mesmo espírito dos outros testes deste diretório.

const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFakeDb } = require('./fakeDb');
const { buildWritePlan, applyWritePlan, CARDS_PATH } = require('../board');
const membersLib = require('../members');
const flowLib = require('../flow');
const notifications = require('../notifications');

const MEMBERS_SEED = {
  'kanban/usuarios_publicos': {
    uidAna: { nome: 'Ana Silva', email: 'ana.silva@ciahering.com.br', init: 'ANA', squads: { ecomm: true } },
    uidBruno: { nome: 'Bruno Tanaka', email: 'bruno.tanaka@ciahering.com.br', init: 'BRU', squads: { ecomm: true } },
    uidFora: { nome: 'Carla Fora', email: 'carla.fora@ciahering.com.br', init: 'CAR', squads: { outro: true } },
  },
};

const COLUMNS_SEED = {
  columns: [
    { id: 'backlog', name: 'Backlog' },
    { id: 'progress', name: 'Em andamento' },
    { id: 'done', name: 'Concluído' },
  ],
  config: { flow: { startCols: ['progress'], doneCols: ['done'], reportCols: [] } },
};

function seedDb(cardKey, card) {
  membersLib._resetCacheForTests();
  flowLib._resetCacheForTests();
  return makeFakeDb({
    ...MEMBERS_SEED,
    kanban: {
      squads: {
        ecomm: {
          dados: {
            cards: { [cardKey]: card },
            ...COLUMNS_SEED,
          },
        },
      },
      usuarios_publicos: MEMBERS_SEED['kanban/usuarios_publicos'],
    },
  });
}

// ── checklist_item ──────────────────────────────────────────────────────

test('checklist_item cria grupo e item quando não existem, no grupo padrão do agente', async () => {
  const db = seedDb('5', { id: 'c5', title: 'Card X', col: 'progress', checklist: [], checklistGroups: [] });
  const plan = await buildWritePlan('5', [{ type: 'checklist_item', item: 'Gerar relatório', done: true }], { cardId: 'c5', db });
  await applyWritePlan(db, plan);

  const card = db._data().kanban.squads.ecomm.dados.cards['5'];
  assert.deepEqual(card.checklistGroups, [{ id: 'agente-agil', title: '🤖 Processo automatizado' }]);
  assert.equal(card.checklist.length, 1);
  assert.equal(card.checklist[0].t, 'Gerar relatório');
  assert.equal(card.checklist[0].done, true);
  assert.equal(card.checklist[0].grp, 'agente-agil');
  assert.equal(card.history.length, 1);
  assert.match(card.history[0].what, /criou e concluiu "Gerar relatório"/);
  assert.equal(card.history[0].who, 'Agente Ágil');
});

test('checklist_item marca item já existente (mesmo grupo) sem duplicar', async () => {
  const db = seedDb('5', {
    id: 'c5', title: 'Card X', col: 'progress',
    checklist: [{ t: 'Revisar PR', done: false, grp: 'default' }],
    checklistGroups: [{ id: 'default', title: 'Checklist' }],
  });
  const plan = await buildWritePlan('5', [{ type: 'checklist_item', item: 'Revisar PR', done: true, grupo: 'Checklist' }], { cardId: 'c5', db });
  await applyWritePlan(db, plan);

  const card = db._data().kanban.squads.ecomm.dados.cards['5'];
  assert.equal(card.checklist.length, 1, 'não deveria criar um item novo, só marcar o existente');
  assert.equal(card.checklist[0].done, true);
  assert.equal(card.checklistGroups.length, 1, 'grupo já existia — não deveria duplicar');
  assert.match(card.history[0].what, /marcou "Revisar PR" como concluído/);
});

test('checklist_item acha o item certo mesmo com DOIS grupos de mesmo título (bug relatado em produção)', async () => {
  // Cenário real: o grupo "Checklist" original (vazio, criado automaticamente)
  // continua existindo, e a pessoa clicou em "+ grupo" (que nasce com o
  // título placeholder "Checklist" até alguém renomear) pra colocar o item
  // de verdade. resolveGroup() escolhe só o PRIMEIRO "Checklist" por título
  // — sem o fix, a busca do item olhava só pra esse primeiro id, não achava
  // "Revisar cadastro" (que mora no segundo) e criava um duplicado.
  const db = seedDb('5', {
    id: 'c5', title: 'Card X', col: 'progress',
    checklistGroups: [{ id: 'default', title: 'Checklist' }, { id: 'g1a2b3c', title: 'Checklist' }],
    checklist: [{ t: 'Revisar cadastro', done: false, grp: 'g1a2b3c' }],
  });
  const plan = await buildWritePlan('5', [{ type: 'checklist_item', item: 'Revisar cadastro', done: true, grupo: 'Checklist' }], { cardId: 'c5', db });
  await applyWritePlan(db, plan);

  const card = db._data().kanban.squads.ecomm.dados.cards['5'];
  assert.equal(card.checklist.length, 1, 'não deveria duplicar o item só porque existem dois grupos "Checklist"');
  assert.equal(card.checklist[0].done, true);
  assert.equal(card.checklist[0].grp, 'g1a2b3c', 'o item marcado deveria continuar no grupo onde já estava, não se mudar pro primeiro "Checklist" encontrado');
  assert.equal(card.checklistGroups.length, 2, 'não deveria criar um terceiro grupo nem tocar no grupo do agente');
});

test('checklist_item não escreve histórico quando o estado já era o mesmo (idempotente)', async () => {
  const db = seedDb('5', {
    id: 'c5', title: 'Card X', col: 'progress',
    checklist: [{ t: 'Revisar PR', done: true, grp: 'default' }],
    checklistGroups: [{ id: 'default', title: 'Checklist' }],
  });
  const plan = await buildWritePlan('5', [{ type: 'checklist_item', item: 'Revisar PR', done: true, grupo: 'Checklist' }], { cardId: 'c5', db });
  await applyWritePlan(db, plan);
  const card = db._data().kanban.squads.ecomm.dados.cards['5'];
  assert.equal(card.history, undefined, 'nada mudou de fato — não deveria criar entrada de histórico');
});

test('checklist_item notifica o owner quando o checklist inteiro fica 100% concluído', async () => {
  const db = seedDb('5', {
    id: 'c5', title: 'Card X', col: 'progress', owner: 'ANA',
    checklist: [{ t: 'Item 1', done: true, grp: 'default' }, { t: 'Item 2', done: false, grp: 'default' }],
    checklistGroups: [{ id: 'default', title: 'Checklist' }],
  });
  const plan = await buildWritePlan('5', [{ type: 'checklist_item', item: 'Item 2', done: true, grupo: 'Checklist' }], { cardId: 'c5', db });
  await applyWritePlan(db, plan);

  const notifs = db._data().kanban.usuarios.uidAna.notificacoes;
  const notifList = Object.values(notifs || {});
  assert.equal(notifList.length, 1);
  assert.equal(notifList[0].type, 'checklist');
  assert.equal(notifList[0].title, 'Checklist concluída!');
});

test('checklist_item NÃO notifica quando ainda sobra item pendente', async () => {
  const db = seedDb('5', {
    id: 'c5', title: 'Card X', col: 'progress', owner: 'ANA',
    checklist: [{ t: 'Item 1', done: false, grp: 'default' }, { t: 'Item 2', done: false, grp: 'default' }],
    checklistGroups: [{ id: 'default', title: 'Checklist' }],
  });
  const plan = await buildWritePlan('5', [{ type: 'checklist_item', item: 'Item 2', done: true, grupo: 'Checklist' }], { cardId: 'c5', db });
  await applyWritePlan(db, plan);
  assert.equal(db._data().kanban.usuarios, undefined);
});

// ── agent_status ─────────────────────────────────────────────────────────

test('agent_status promove executorType human -> agent quando não vem override', async () => {
  const db = seedDb('5', { id: 'c5', title: 'Card X', col: 'progress', executorType: 'human' });
  const plan = await buildWritePlan('5', [{ type: 'agent_status', status: 'running' }], { cardId: 'c5', db });
  await applyWritePlan(db, plan);

  const card = db._data().kanban.squads.ecomm.dados.cards['5'];
  assert.equal(card.agentStatus, 'running');
  assert.equal(card.executorType, 'agent');
  assert.equal(card.history.length, 1);
  assert.match(card.history[0].what, /assumiu a execução/);
});

test('agent_status não mexe em executorType já agent/hybrid', async () => {
  const db = seedDb('5', { id: 'c5', title: 'Card X', col: 'progress', executorType: 'hybrid' });
  const plan = await buildWritePlan('5', [{ type: 'agent_status', status: 'running' }], { cardId: 'c5', db });
  await applyWritePlan(db, plan);
  const card = db._data().kanban.squads.ecomm.dados.cards['5'];
  assert.equal(card.executorType, 'hybrid');
  assert.equal(card.history, undefined, 'sem promoção nem erro — não deveria logar nada pra status comuns');
});

test('agent_status registra histórico quando status é error', async () => {
  const db = seedDb('5', { id: 'c5', title: 'Card X', col: 'progress', executorType: 'agent' });
  const plan = await buildWritePlan('5', [{ type: 'agent_status', status: 'error' }], { cardId: 'c5', db });
  await applyWritePlan(db, plan);
  const card = db._data().kanban.squads.ecomm.dados.cards['5'];
  assert.equal(card.agentStatus, 'error');
  assert.equal(card.history.length, 1);
  assert.match(card.history[0].what, /falhou/);
});

test('agent_status respeita executorType explícito, mesmo que "regrida"', async () => {
  const db = seedDb('5', { id: 'c5', title: 'Card X', col: 'progress', executorType: 'agent' });
  const plan = await buildWritePlan('5', [{ type: 'agent_status', status: 'awaiting_validation', executorType: 'human' }], { cardId: 'c5', db });
  await applyWritePlan(db, plan);
  const card = db._data().kanban.squads.ecomm.dados.cards['5'];
  assert.equal(card.executorType, 'human');
  assert.match(card.history[0].what, /agente → humano/);
});

// ── mover_coluna ─────────────────────────────────────────────────────────

test('mover_coluna rejeita coluna inexistente', async () => {
  const db = seedDb('5', { id: 'c5', title: 'Card X', col: 'backlog' });
  await assert.rejects(
    () => buildWritePlan('5', [{ type: 'mover_coluna', coluna: 'coluna-fantasma' }], { cardId: 'c5', db }),
    (err) => err.code === 'invalid_output'
  );
});

test('mover_coluna registra flow + histórico e não notifica pra coluna não-final', async () => {
  const db = seedDb('5', { id: 'c5', title: 'Card X', col: 'backlog', owner: 'ANA' });
  const plan = await buildWritePlan('5', [{ type: 'mover_coluna', coluna: 'progress' }], { cardId: 'c5', db });
  await applyWritePlan(db, plan);

  const card = db._data().kanban.squads.ecomm.dados.cards['5'];
  assert.equal(card.col, 'progress');
  assert.equal(card.history.length, 1);
  assert.match(card.history[0].what, /moveu para Em andamento/);
  assert.equal(card.flow.enteredAt.progress !== undefined, true);
  assert.equal(card.flow.firstStartAt !== undefined, true, 'progress é startCol configurado — deveria marcar firstStartAt');
  assert.equal(card.flow.log.length, 1);
  assert.equal(card.flow.log[0].from, 'backlog');
  assert.equal(card.flow.log[0].to, 'progress');
  assert.equal(db._data().kanban.usuarios, undefined, 'coluna não é done — não deveria notificar');
});

test('mover_coluna pra coluna done notifica owner+participants e marca flow.doneAt', async () => {
  const db = seedDb('5', { id: 'c5', title: 'Card X', col: 'progress', owner: 'ANA', participants: ['BRU'] });
  const plan = await buildWritePlan('5', [{ type: 'mover_coluna', coluna: 'done' }], { cardId: 'c5', db });
  await applyWritePlan(db, plan);

  const card = db._data().kanban.squads.ecomm.dados.cards['5'];
  assert.equal(card.col, 'done');
  assert.ok(card.flow.doneAt);
  const notifsAna = Object.values(db._data().kanban.usuarios.uidAna.notificacoes || {});
  const notifsBru = Object.values(db._data().kanban.usuarios.uidBruno.notificacoes || {});
  assert.equal(notifsAna.length, 1);
  assert.equal(notifsAna[0].type, 'done');
  assert.equal(notifsBru.length, 1);
});

test('mover_coluna pra mesma coluna atual não faz nada (sem histórico, sem notif)', async () => {
  const db = seedDb('5', { id: 'c5', title: 'Card X', col: 'progress', owner: 'ANA' });
  const plan = await buildWritePlan('5', [{ type: 'mover_coluna', coluna: 'progress' }], { cardId: 'c5', db });
  await applyWritePlan(db, plan);
  const card = db._data().kanban.squads.ecomm.dados.cards['5'];
  assert.equal(card.history, undefined);
  assert.equal(card.flow, undefined);
});

// ── editar_campos ────────────────────────────────────────────────────────

test('editar_campos rejeita quando nenhum campo muda', async () => {
  const db = seedDb('5', { id: 'c5', title: 'Card X', col: 'progress', desc: 'já era isso', priority: 'high' });
  await assert.rejects(
    () => buildWritePlan('5', [{ type: 'editar_campos', desc: 'já era isso', priority: 'high' }], { cardId: 'c5', db }),
    (err) => err.code === 'invalid_output'
  );
});

test('editar_campos atualiza desc/priority e registra histórico dos dois', async () => {
  const db = seedDb('5', { id: 'c5', title: 'Card X', col: 'progress', desc: 'antiga', priority: 'low' });
  const plan = await buildWritePlan('5', [{ type: 'editar_campos', desc: 'nova descrição', priority: 'critical' }], { cardId: 'c5', db });
  await applyWritePlan(db, plan);
  const card = db._data().kanban.squads.ecomm.dados.cards['5'];
  assert.equal(card.desc, 'nova descrição');
  assert.equal(card.priority, 'critical');
  assert.equal(card.history.length, 2);
});

test('editar_campos adiciona tags sem remover as existentes (add-only)', async () => {
  const db = seedDb('5', { id: 'c5', title: 'Card X', col: 'progress', tags: ['urgente'] });
  const plan = await buildWritePlan('5', [{ type: 'editar_campos', tags: ['urgente', 'financeiro'] }], { cardId: 'c5', db });
  await applyWritePlan(db, plan);
  const card = db._data().kanban.squads.ecomm.dados.cards['5'];
  assert.deepEqual(card.tags, ['urgente', 'financeiro']);
  assert.equal(card.history.length, 1);
  assert.match(card.history[0].what, /adicionou tag\(s\): financeiro/);
});

test('editar_campos com desc mencionando @alguém notifica a pessoa', async () => {
  const db = seedDb('5', { id: 'c5', title: 'Card X', col: 'progress', desc: '' });
  const plan = await buildWritePlan('5', [{ type: 'editar_campos', desc: 'favor validar @ana.silva' }], { cardId: 'c5', db });
  await applyWritePlan(db, plan);
  const notifs = Object.values(db._data().kanban.usuarios.uidAna.notificacoes || {});
  assert.equal(notifs.length, 1);
  assert.equal(notifs[0].type, 'mention');
});

// ── comentario com @menção ──────────────────────────────────────────────

test('comentario com @menção notifica e comentário sem @ não gera leitura extra de membros', async () => {
  const db = seedDb('5', { id: 'c5', title: 'Card X', col: 'progress' });
  const plan1 = await buildWritePlan('5', [{ type: 'comentario', texto: 'tudo certo por aqui' }], { cardId: 'c5', db });
  assert.equal(plan1.length, 1, 'sem @, não deveria gerar step de notificação nenhum');

  const plan2 = await buildWritePlan('5', [{ type: 'comentario', texto: 'oi @bruno.tanaka, dá uma olhada' }], { cardId: 'c5', db });
  await applyWritePlan(db, plan2);
  const notifs = Object.values(db._data().kanban.usuarios.uidBruno.notificacoes || {});
  assert.equal(notifs.length, 1);
  assert.equal(notifs[0].type, 'mention');
});

// ── notificar (lista explícita do envelope) ─────────────────────────────

test('notificar avisa por init mesmo sem @menção no texto, e dedupe com mention não duplica', async () => {
  const db = seedDb('5', { id: 'c5', title: 'Card X', col: 'progress' });
  const plan = await buildWritePlan('5', [{ type: 'comentario', texto: 'oi @ana.silva' }], { cardId: 'c5', db, notificar: ['ANA'] });
  await applyWritePlan(db, plan);
  const notifs = Object.values(db._data().kanban.usuarios.uidAna.notificacoes || {});
  assert.equal(notifs.length, 1, 'mesma pessoa via @menção e via notificar[] deveria gerar UMA notificação só');
});

// ── flow.js (puro) ──────────────────────────────────────────────────────

test('flow.isDoneColumn usa flowConfig.doneCols quando configurado', () => {
  const meta = { columns: COLUMNS_SEED.columns, flowConfig: { startCols: [], doneCols: ['done'], reportCols: [] } };
  assert.equal(flowLib.isDoneColumn('done', meta), true);
  assert.equal(flowLib.isDoneColumn('progress', meta), false);
});

test('flow.isDoneColumn cai pra heurística por nome/id quando flowConfig.doneCols está vazio', () => {
  const meta = { columns: [{ id: 'fim', name: 'Finalizado' }], flowConfig: { startCols: [], doneCols: [], reportCols: [] } };
  assert.equal(flowLib.isDoneColumn('fim', meta), true);
});

// ── notifications.js (puro) ─────────────────────────────────────────────

test('extractMentionedMembers resolve por handle (email) e por init, ignora token não-membro', () => {
  const members = [
    { uid: 'u1', init: 'ANA', name: 'Ana Silva', email: 'ana.silva@ciahering.com.br' },
    { uid: 'u2', init: 'BRU', name: 'Bruno Tanaka', email: 'bruno.tanaka@ciahering.com.br' },
  ];
  const found = notifications.extractMentionedMembers('oi @ana.silva e @BRU, e @ninguem.aqui não existe', members);
  assert.equal(found.length, 2);
  assert.deepEqual(found.map((m) => m.uid).sort(), ['u1', 'u2']);
});
