// functions/okr/__tests__/dailyScan.test.js
//
// Cobertura de runOkrDailyScan() — os 3 gatilhos ambientais do módulo OKR
// (prazo de marco chegando, período de editar, véspera de reunião). Não
// testa o wrapper onSchedule em si (mesmo raciocínio de
// dueOverdueTrigger.test.js: exigiria mockar firebase-functions/v2/
// scheduler, a lógica que importa já está toda em runOkrDailyScan()).
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { todaySP, diasAte, runOkrDailyScan } = require('../dailyScan');

const HOJE = todaySP();
function addDias(n) {
  return new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function seedDb({ objetivos, marcos, gcal } = {}) {
  return makeFakeDb({
    kanban: {
      okr: { objetivos: objetivos || {}, marcos: marcos || {} },
      painel: { config: { gcal_cache: gcal || {} } },
    },
  });
}

async function notifsDe(db, uid) {
  const snap = await db.ref(`kanban/usuarios/${uid}/notificacoes`).get();
  return Object.values(snap.val() || {});
}

// ── diasAte() ────────────────────────────────────────────────────────────

test('diasAte: data de hoje retorna 0', () => {
  assert.equal(diasAte(HOJE), 0);
});
test('diasAte: 3 dias no futuro retorna 3', () => {
  assert.equal(diasAte(addDias(3)), 3);
});
test('diasAte: data ausente retorna null', () => {
  assert.equal(diasAte(''), null);
  assert.equal(diasAte(null), null);
});

// ── 1) Prazo de marco chegando ──────────────────────────────────────────

test('marco com prazo em 3 dias notifica o responsável do marco', async () => {
  const db = seedDb({
    objetivos: { o1: { id: 'o1', titulo: 'Objetivo X', responsaveis: ['uidResp'] } },
    marcos: { m1: { id: 'm1', objetivoId: 'o1', nome: 'Marco A', prazo: addDias(3), progresso: 'no_prazo', responsavel: 'uidMarco' } },
  });
  await runOkrDailyScan(db);
  const notifsMarco = await notifsDe(db, 'uidMarco');
  const notifsObj = await notifsDe(db, 'uidResp');
  assert.equal(notifsMarco.length, 1);
  assert.equal(notifsMarco[0].type, 'okr_prazo');
  assert.match(notifsMarco[0].title, /Marco A/);
  assert.equal(notifsObj.length, 0, 'responsável do OBJETIVO não devia ser notificado quando o marco já tem responsável próprio');
});

test('marco sem responsável próprio cai pros responsaveis[] do Objetivo', async () => {
  const db = seedDb({
    objetivos: { o1: { id: 'o1', titulo: 'Objetivo X', responsaveis: ['uidResp1', 'uidResp2'] } },
    marcos: { m1: { id: 'm1', objetivoId: 'o1', nome: 'Marco A', prazo: addDias(1), progresso: 'no_prazo' } },
  });
  await runOkrDailyScan(db);
  assert.equal((await notifsDe(db, 'uidResp1')).length, 1);
  assert.equal((await notifsDe(db, 'uidResp2')).length, 1);
});

test('marco concluído NÃO notifica mesmo com prazo batendo', async () => {
  const db = seedDb({
    objetivos: { o1: { id: 'o1', titulo: 'X', responsaveis: [] } },
    marcos: { m1: { id: 'm1', objetivoId: 'o1', nome: 'Marco A', prazo: addDias(1), progresso: 'concluido', responsavel: 'uidMarco' } },
  });
  await runOkrDailyScan(db);
  assert.equal((await notifsDe(db, 'uidMarco')).length, 0);
});

test('marco arquivado NÃO notifica', async () => {
  const db = seedDb({
    objetivos: { o1: { id: 'o1', titulo: 'X', responsaveis: [] } },
    marcos: { m1: { id: 'm1', objetivoId: 'o1', nome: 'Marco A', prazo: addDias(1), progresso: 'no_prazo', responsavel: 'uidMarco', arquivado: true } },
  });
  await runOkrDailyScan(db);
  assert.equal((await notifsDe(db, 'uidMarco')).length, 0);
});

test('marco com prazo fora da janela (2 ou 5 dias) NÃO notifica', async () => {
  const db = seedDb({
    objetivos: { o1: { id: 'o1', titulo: 'X', responsaveis: [] } },
    marcos: {
      m1: { id: 'm1', objetivoId: 'o1', nome: 'A', prazo: addDias(2), progresso: 'no_prazo', responsavel: 'uid2d' },
      m2: { id: 'm2', objetivoId: 'o1', nome: 'B', prazo: addDias(5), progresso: 'no_prazo', responsavel: 'uid5d' },
      m3: { id: 'm3', objetivoId: 'o1', nome: 'C', prazo: addDias(0), progresso: 'no_prazo', responsavel: 'uidHoje' },
    },
  });
  await runOkrDailyScan(db);
  assert.equal((await notifsDe(db, 'uid2d')).length, 0);
  assert.equal((await notifsDe(db, 'uid5d')).length, 0);
  assert.equal((await notifsDe(db, 'uidHoje')).length, 0);
});

// ── 2) Período de editar / 3) véspera de reunião ────────────────────────

test('objetivo com evento de período HOJE notifica todos os responsaveis', async () => {
  const db = seedDb({
    objetivos: { o1: { id: 'o1', titulo: 'Obj Período', responsaveis: ['u1', 'u2'], gcalPeriodoEventId: 'ev1' } },
    gcal: { ev1: { id: 'ev1', title: 'Período OKR', start: HOJE } },
  });
  await runOkrDailyScan(db);
  const n1 = await notifsDe(db, 'u1'), n2 = await notifsDe(db, 'u2');
  assert.equal(n1.length, 1); assert.equal(n1[0].type, 'okr_periodo');
  assert.equal(n2.length, 1);
});

test('objetivo com evento de reunião AMANHÃ notifica (véspera)', async () => {
  const db = seedDb({
    objetivos: { o1: { id: 'o1', titulo: 'Obj Reunião', responsaveis: ['u1'], gcalReuniaoEventId: 'ev2' } },
    gcal: { ev2: { id: 'ev2', title: 'Planejamento Estratégico', start: addDias(1) } },
  });
  await runOkrDailyScan(db);
  const n1 = await notifsDe(db, 'u1');
  assert.equal(n1.length, 1);
  assert.equal(n1[0].type, 'okr_reuniao');
  assert.match(n1[0].sub, /Planejamento Estratégico/);
});

test('evento de reunião HOJE (não amanhã) NÃO dispara a véspera', async () => {
  const db = seedDb({
    objetivos: { o1: { id: 'o1', titulo: 'X', responsaveis: ['u1'], gcalReuniaoEventId: 'ev2' } },
    gcal: { ev2: { id: 'ev2', title: 'Reunião', start: HOJE } },
  });
  await runOkrDailyScan(db);
  assert.equal((await notifsDe(db, 'u1')).length, 0);
});

test('objetivo arquivado NÃO notifica mesmo com evento batendo', async () => {
  const db = seedDb({
    objetivos: { o1: { id: 'o1', titulo: 'X', responsaveis: ['u1'], gcalPeriodoEventId: 'ev1', arquivado: true } },
    gcal: { ev1: { id: 'ev1', title: 'Período', start: HOJE } },
  });
  await runOkrDailyScan(db);
  assert.equal((await notifsDe(db, 'u1')).length, 0);
});

test('objetivo sem gcalPeriodoEventId/gcalReuniaoEventId setado NÃO notifica (sem evento vinculado)', async () => {
  const db = seedDb({
    objetivos: { o1: { id: 'o1', titulo: 'X', responsaveis: ['u1'] } },
    gcal: { ev1: { id: 'ev1', title: 'Período', start: HOJE } },
  });
  await runOkrDailyScan(db);
  assert.equal((await notifsDe(db, 'u1')).length, 0);
});

test('notificação escrita tem o formato esperado (ts ISO, read false, okrObjId presente)', async () => {
  const db = seedDb({
    objetivos: { o1: { id: 'o1', titulo: 'Obj', responsaveis: ['u1'], gcalPeriodoEventId: 'ev1' } },
    gcal: { ev1: { id: 'ev1', title: 'Período', start: HOJE } },
  });
  await runOkrDailyScan(db);
  const [n] = await notifsDe(db, 'u1');
  assert.equal(n.read, false);
  assert.equal(n.okrObjId, 'o1');
  assert.equal(typeof n.ts, 'string');
  assert.ok(n.ts.includes('T'), 'ts deve ser ISO string, nunca Date.now()');
});
