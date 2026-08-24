// functions/agente-agil-orquestrador/__tests__/dueOverdueTrigger.test.js
//
// Cobertura de runDueOverdueScan()/ruleMatchesDueOverdue() — a lógica pura
// do item 5 v1 (gatilho ambiental due_overdue, squad dev). Não testa o
// wrapper onSchedule em si (exigiria mockar firebase-functions/v2/scheduler,
// mesmo raciocínio já aplicado a mentionTrigger.js/agenteAgilMencao: a
// lógica que importa já está toda em runDueOverdueScan()).
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const flowLib = require('../../agente-agil/flow');
const {
  SQUAD_ID,
  todaySP,
  ruleMatchesDueOverdue,
  runDueOverdueScan,
} = require('../dueOverdueTrigger');

const ONTEM = todaySP(-1);
const HOJE = todaySP(0);

function seedDb({ cards, autoRules, columns, flowConfig } = {}) {
  flowLib._resetCacheForTests();
  return makeFakeDb({
    kanban: {
      squads: {
        [SQUAD_ID]: {
          dados: {
            cards: cards || {},
            auto_rules: autoRules || [],
            columns: columns || [
              { id: 'backlog', name: 'Backlog' },
              { id: 'progress', name: 'Em andamento' },
              { id: 'done', name: 'Concluído' },
            ],
            config: { flow: flowConfig || { startCols: [], doneCols: ['done'], reportCols: [] } },
          },
        },
      },
    },
  });
}

// ── ruleMatchesDueOverdue() ─────────────────────────────────────────────

test('ruleMatchesDueOverdue: regra ativa, trigger due_overdue, ação notify_agent (array actions) — bate', () => {
  const rule = { active: true, trigger: 'due_overdue', actions: [{ action: 'notify_agent', actionVal: 'auto' }] };
  assert.equal(ruleMatchesDueOverdue(rule), true);
});

test('ruleMatchesDueOverdue: formato legado (action/actionVal direto no objeto) — bate', () => {
  const rule = { active: true, trigger: 'due_overdue', action: 'notify_agent', actionVal: 'metricas' };
  assert.equal(ruleMatchesDueOverdue(rule), true);
});

test('ruleMatchesDueOverdue: regra inativa — não bate', () => {
  const rule = { active: false, trigger: 'due_overdue', actions: [{ action: 'notify_agent' }] };
  assert.equal(ruleMatchesDueOverdue(rule), false);
});

test('ruleMatchesDueOverdue: trigger diferente de due_overdue — não bate', () => {
  const rule = { active: true, trigger: 'due_today', actions: [{ action: 'notify_agent' }] };
  assert.equal(ruleMatchesDueOverdue(rule), false);
});

test('ruleMatchesDueOverdue: due_overdue mas sem ação notify_agent (outra ação qualquer) — não bate', () => {
  const rule = { active: true, trigger: 'due_overdue', actions: [{ action: 'move_col', actionVal: 'done' }] };
  assert.equal(ruleMatchesDueOverdue(rule), false);
});

test('ruleMatchesDueOverdue: due_overdue com VÁRIAS ações, notify_agent é uma delas — bate', () => {
  const rule = { active: true, trigger: 'due_overdue', actions: [{ action: 'set_priority', actionVal: 'high' }, { action: 'notify_agent' }] };
  assert.equal(ruleMatchesDueOverdue(rule), true);
});

// ── runDueOverdueScan() ─────────────────────────────────────────────────

test('runDueOverdueScan: sem nenhuma regra due_overdue->notify_agent — sai cedo, não notifica nada', async () => {
  const db = seedDb({
    cards: { 1: { id: 'c1', title: 'Atrasado', col: 'progress', due: ONTEM } },
    autoRules: [],
  });
  const r = await runDueOverdueScan(db, SQUAD_ID);
  assert.deepEqual(r, { scanned: 0, notificados: 0 });
  const comentarios = await db.ref(`kanban/squads/${SQUAD_ID}/dados/card_comments/c1`).get();
  assert.equal(comentarios.val(), null);
});

test('runDueOverdueScan: card com due===ontem, regra ativa — posta comentário @Agente Ágil real', async () => {
  const db = seedDb({
    cards: { 1: { id: 'c1', title: 'Publicar campanha', col: 'progress', due: ONTEM } },
    autoRules: [{ active: true, trigger: 'due_overdue', label: 'Avisa atraso', actions: [{ action: 'notify_agent', actionVal: 'auto' }] }],
  });
  const r = await runDueOverdueScan(db, SQUAD_ID);
  assert.equal(r.scanned, 1);
  assert.equal(r.notificados, 1);
  const comentarios = Object.values((await db.ref(`kanban/squads/${SQUAD_ID}/dados/card_comments/c1`).get()).val());
  assert.equal(comentarios.length, 1);
  assert.match(comentarios[0].text, /@Agente Ágil/);
  assert.match(comentarios[0].text, /Publicar campanha/);
  assert.equal(comentarios[0].uid, 'automacao');
});

test('runDueOverdueScan: card com due===hoje (ainda não atrasado) — não notifica', async () => {
  const db = seedDb({
    cards: { 1: { id: 'c1', title: 'Vence hoje', col: 'progress', due: HOJE } },
    autoRules: [{ active: true, trigger: 'due_overdue', actions: [{ action: 'notify_agent' }] }],
  });
  const r = await runDueOverdueScan(db, SQUAD_ID);
  assert.equal(r.notificados, 0);
});

test('runDueOverdueScan: card arquivado, mesmo atrasado — não notifica', async () => {
  const db = seedDb({
    cards: { 1: { id: 'c1', title: 'Arquivado', col: 'progress', due: ONTEM, archived: true } },
    autoRules: [{ active: true, trigger: 'due_overdue', actions: [{ action: 'notify_agent' }] }],
  });
  const r = await runDueOverdueScan(db, SQUAD_ID);
  assert.equal(r.notificados, 0);
});

test('runDueOverdueScan: card já numa coluna de fim (Concluído), mesmo atrasado — não notifica (mesmo filtro do client)', async () => {
  const db = seedDb({
    cards: { 1: { id: 'c1', title: 'Já concluído', col: 'done', due: ONTEM } },
    autoRules: [{ active: true, trigger: 'due_overdue', actions: [{ action: 'notify_agent' }] }],
  });
  const r = await runDueOverdueScan(db, SQUAD_ID);
  assert.equal(r.notificados, 0);
});

test('runDueOverdueScan: regra com condTag — só notifica card que tem a tag', async () => {
  const db = seedDb({
    cards: {
      1: { id: 'c1', title: 'Com a tag', col: 'progress', due: ONTEM, tags: ['urgente'] },
      2: { id: 'c2', title: 'Sem a tag', col: 'progress', due: ONTEM, tags: [] },
    },
    autoRules: [{ active: true, trigger: 'due_overdue', condTag: 'urgente', actions: [{ action: 'notify_agent' }] }],
  });
  const r = await runDueOverdueScan(db, SQUAD_ID);
  assert.equal(r.notificados, 1);
  const c1 = await db.ref(`kanban/squads/${SQUAD_ID}/dados/card_comments/c1`).get();
  const c2 = await db.ref(`kanban/squads/${SQUAD_ID}/dados/card_comments/c2`).get();
  assert.notEqual(c1.val(), null);
  assert.equal(c2.val(), null);
});

test('runDueOverdueScan: vários cards atrasados na mesma varredura — notifica todos', async () => {
  const db = seedDb({
    cards: {
      1: { id: 'c1', title: 'Um', col: 'progress', due: ONTEM },
      2: { id: 'c2', title: 'Dois', col: 'backlog', due: ONTEM },
      3: { id: 'c3', title: 'Não atrasado', col: 'progress', due: HOJE },
    },
    autoRules: [{ active: true, trigger: 'due_overdue', actions: [{ action: 'notify_agent' }] }],
  });
  const r = await runDueOverdueScan(db, SQUAD_ID);
  assert.equal(r.scanned, 3);
  assert.equal(r.notificados, 2);
});

test('runDueOverdueScan: auto_rules salvo como objeto (não array) — ainda funciona (mesma tolerância do client)', async () => {
  const db = seedDb({
    cards: { 1: { id: 'c1', title: 'Atrasado', col: 'progress', due: ONTEM } },
  });
  await db.ref(`kanban/squads/${SQUAD_ID}/dados/auto_rules`).set({ 0: { active: true, trigger: 'due_overdue', actions: [{ action: 'notify_agent' }] } });
  const r = await runDueOverdueScan(db, SQUAD_ID);
  assert.equal(r.notificados, 1);
});
