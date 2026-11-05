// functions/agente-agil-orquestrador/__tests__/origemExterna.test.js
//
// 🔐 Auditoria de segurança de 05/11/2026 (Intake × Agente Ágil): card que nasceu de pedido de Intake (card.intakeId) é "origem externa" — o agente NÃO publica relatório HTML, NÃO
// sobrescreve a descrição e NÃO @menciona por texto livre. "Liberar" (card.intakeLiberado) devolve o comportamento normal; rascunho do próprio agente (intakeOrigem 'agente-agil') não é externo.
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { buildTools } = require('../tools');
const { origemExterna } = require('../tools/origemExterna');
const membersLib = require('../../agente-agil/members');

const USERS = {
  uidAna: { nome: 'Ana Silva', email: 'ana.silva@ciahering.com.br', init: 'ANA', squads: { dev: true } },
  uidBruno: { nome: 'Bruno Tanaka', email: 'bruno.tanaka@ciahering.com.br', init: 'BRU', squads: { dev: true } },
};
function seed(card) {
  membersLib._resetCacheForTests();
  return makeFakeDb({ kanban: { usuarios_publicos: USERS, squads: { dev: { dados: { cards: { 9: card }, cards_index: { [card.id]: '9' }, tags: [] } } } } });
}
const base = { id: 'c9', title: 'Pedido', col: 'progress', owner: 'ANA', desc: 'texto original do pedido' };
const tool = (db, nome) => buildTools({ mode: 'real', db, squadId: 'dev', cardId: 'c9', dryRun: false }).find((t) => t.name === nome);
const notifs = (db, uid) => Object.values(db._data().kanban.usuarios?.[uid]?.notificacoes || {});
const card = (db) => db._data().kanban.squads.dev.dados.cards['9'];

test('origemExterna(): só intakeId sem liberar e sem ser rascunho do agente', () => {
  assert.equal(origemExterna({ intakeId: 'p1' }), true);
  assert.equal(origemExterna({ intakeId: 'p1', intakeLiberado: true }), false);
  assert.equal(origemExterna({ intakeId: 'p1', intakeOrigem: 'agente-agil' }), false);
  assert.equal(origemExterna({ title: 'card normal' }), false);
  assert.equal(origemExterna(null), false);
});

test('card do Intake: relatorio_html e editar_campos.desc são recusados com origem_externa — nada é escrito', async () => {
  const db = seed({ ...base, intakeId: 'p1' });
  const r1 = await tool(db, 'relatorio_html').handler({ html: '<h1>phishing</h1>', titulo: 'Relatório' });
  assert.equal(r1.ok, false); assert.equal(r1.error, 'origem_externa'); assert.match(r1.message, /Liberar para o Agente/);
  const r2 = await tool(db, 'editar_campos').handler({ desc: 'sobrescrito pelo agente' });
  assert.equal(r2.ok, false); assert.equal(r2.error, 'origem_externa');
  assert.equal(card(db).desc, 'texto original do pedido'); assert.equal(card(db).links, undefined);
});

test('card do Intake: prioridade/tags/comentário/mover seguem funcionando', async () => {
  const db = seed({ ...base, intakeId: 'p1' });
  assert.equal((await tool(db, 'editar_campos').handler({ priority: 'high' })).ok, true);
  assert.equal(card(db).priority, 'high');
  assert.equal((await tool(db, 'comentario').handler({ texto: 'Análise sem menção' })).ok, true);
  assert.equal(Object.values(db._data().kanban.squads.dev.dados.card_comments.c9).length, 1);
});

test('card do Intake: @menção no comentário do modelo é postada, mas NÃO notifica ninguém', async () => {
  const db = seed({ ...base, intakeId: 'p1' });
  const r = await tool(db, 'comentario').handler({ texto: 'Oi @BRU e @ANA, olhem isto' });
  assert.equal(r.ok, true);
  assert.equal(Object.values(db._data().kanban.squads.dev.dados.card_comments.c9).length, 1, 'o comentário existe');
  assert.equal(notifs(db, 'uidBruno').length, 0); assert.equal(notifs(db, 'uidAna').length, 0);
});

test('card do Intake: perguntar_humano continua avisando o DONO (e só ele, mesmo se o modelo escrever outras menções)', async () => {
  const db = seed({ ...base, intakeId: 'p1' });
  const r = await tool(db, 'perguntar_humano').handler({ pergunta: 'Posso mover? cc @BRU' });
  assert.equal(r.ok, true);
  assert.ok(notifs(db, 'uidAna').length >= 1, 'o dono (ANA) é avisado');
  assert.equal(notifs(db, 'uidBruno').length, 0, 'o BRU, mencionado pelo texto livre do modelo, não');
});

test('card normal (sem intakeId): tudo como antes — menção notifica, desc pode ser editada', async () => {
  const db = seed({ ...base });
  await tool(db, 'comentario').handler({ texto: 'Oi @BRU' });
  assert.ok(notifs(db, 'uidBruno').length >= 1);
  assert.equal((await tool(db, 'editar_campos').handler({ desc: 'nova descrição' })).ok, true);
  assert.equal(card(db).desc, 'nova descrição');
});

test('Liberar (intakeLiberado) e rascunho do agente (intakeOrigem agente-agil): voltam ao normal', async () => {
  for (const extra of [{ intakeLiberado: true }, { intakeOrigem: 'agente-agil' }]) {
    const db = seed({ ...base, intakeId: 'p1', ...extra });
    assert.equal((await tool(db, 'editar_campos').handler({ desc: 'nova descrição' })).ok, true, JSON.stringify(extra));
    await tool(db, 'comentario').handler({ texto: 'Oi @BRU' });
    assert.ok(notifs(db, 'uidBruno').length >= 1, JSON.stringify(extra));
  }
});

test('falha ao ler o card = trata como externo para o que é bloqueado (fail-closed)', async () => {
  const db = seed({ ...base });
  const orig = db.ref.bind(db);
  db.ref = (p) => { const r = orig(p); return String(p).endsWith('/cards/9') ? Object.assign(Object.create(r), { get: async () => { throw new Error('boom'); } }) : r; };
  const r = await tool(db, 'relatorio_html').handler({ html: '<p>x</p>', titulo: 'R' });
  assert.equal(r.ok, false); assert.equal(r.error, 'origem_externa');
});

// Cards criados antes de `intakeOrigem` existir: a origem do pedido continua em intake_pending/{intakeId}.
function seedComPendente(card, pendente) {
  membersLib._resetCacheForTests();
  return makeFakeDb({ kanban: { usuarios_publicos: USERS, squads: { dev: { dados: { cards: { 9: card }, cards_index: { [card.id]: '9' }, tags: [], ...(pendente ? { intake_pending: { p1: pendente } } : {}) } } } } });
}
test('card antigo (sem intakeOrigem): rascunho do agente em intake_pending/{id} NÃO é externo; pedido do formulário é; pendente sumido = externo', async () => {
  const antigoAgente = seedComPendente({ ...base, intakeId: 'p1' }, { id: 'p1', origem: 'agente-agil', status: 'done' });
  assert.equal((await tool(antigoAgente, 'editar_campos').handler({ desc: 'nova' })).ok, true);
  const antigoForm = seedComPendente({ ...base, intakeId: 'p1' }, { id: 'p1', status: 'done' });
  assert.equal((await tool(antigoForm, 'editar_campos').handler({ desc: 'nova' })).error, 'origem_externa');
  const semPendente = seedComPendente({ ...base, intakeId: 'p1' }, null);
  assert.equal((await tool(semPendente, 'relatorio_html').handler({ html: '<p>x</p>', titulo: 'R' })).error, 'origem_externa');
});
