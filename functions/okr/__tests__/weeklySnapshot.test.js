// functions/okr/__tests__/weeklySnapshot.test.js
//
// Cobertura de runOkrWeeklySnapshot() — a Fase 3 do OKR (snapshot semanal,
// sem notificação nenhuma). Não testa o wrapper onSchedule em si (mesmo
// raciocínio de dailyScan.test.js).
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { todaySP, objStatus, objProgressoPct, runOkrWeeklySnapshot } = require('../weeklySnapshot');

function seedDb({ objetivos, marcos } = {}) {
  return makeFakeDb({ kanban: { okr: { objetivos: objetivos || {}, marcos: marcos || {} } } });
}

// ── objStatus() ──────────────────────────────────────────────────────────

test('objStatus: sem nenhum marco -> nao_iniciado', () => {
  assert.equal(objStatus({}, 'o1'), 'nao_iniciado');
});
test('objStatus: todos os marcos concluídos -> concluido', () => {
  const marcos = { m1: { objetivoId: 'o1', progresso: 'concluido' }, m2: { objetivoId: 'o1', progresso: 'concluido' } };
  assert.equal(objStatus(marcos, 'o1'), 'concluido');
});
test('objStatus: pega o PIOR status entre os marcos ATIVOS (não concluídos)', () => {
  const marcos = {
    m1: { objetivoId: 'o1', progresso: 'concluido' },
    m2: { objetivoId: 'o1', progresso: 'no_prazo' },
    m3: { objetivoId: 'o1', progresso: 'risco' },
  };
  assert.equal(objStatus(marcos, 'o1'), 'risco');
});
test('objStatus: atrasado pesa mais que risco', () => {
  const marcos = { m1: { objetivoId: 'o1', progresso: 'risco' }, m2: { objetivoId: 'o1', progresso: 'atrasado' } };
  assert.equal(objStatus(marcos, 'o1'), 'atrasado');
});
test('objStatus: marco arquivado não conta', () => {
  const marcos = { m1: { objetivoId: 'o1', progresso: 'atrasado', arquivado: true } };
  assert.equal(objStatus(marcos, 'o1'), 'nao_iniciado');
});

// ── objProgressoPct() ────────────────────────────────────────────────────

test('objProgressoPct: sem marco -> 0', () => {
  assert.equal(objProgressoPct({}, 'o1'), 0);
});
test('objProgressoPct: 2 de 4 concluídos -> 50', () => {
  const marcos = {
    m1: { objetivoId: 'o1', progresso: 'concluido' },
    m2: { objetivoId: 'o1', progresso: 'concluido' },
    m3: { objetivoId: 'o1', progresso: 'no_prazo' },
    m4: { objetivoId: 'o1', progresso: 'risco' },
  };
  assert.equal(objProgressoPct(marcos, 'o1'), 50);
});

// ── runOkrWeeklySnapshot() ───────────────────────────────────────────────

test('grava o snapshot em kanban/okr/snapshots/{data de hoje SP}', async () => {
  const db = seedDb({
    objetivos: { o1: { id: 'o1', titulo: 'Objetivo X', areaId: 'tech', arquivado: false } },
    marcos: { m1: { objetivoId: 'o1', progresso: 'no_prazo' } },
  });
  const snap = await runOkrWeeklySnapshot(db);
  const gravado = (await db.ref('kanban/okr/snapshots/' + todaySP()).get()).val();
  assert.ok(gravado, 'deveria ter gravado algo em kanban/okr/snapshots/{hoje}');
  assert.equal(gravado.date, todaySP());
  assert.equal(snap.date, todaySP());
});

test('inclui campos essenciais de cada objetivo (título, área, status, % de progresso)', async () => {
  const db = seedDb({
    objetivos: { o1: { id: 'o1', titulo: 'Reduzir custo Firebase', areaId: 'dadosia', arquivado: false } },
    marcos: {
      m1: { objetivoId: 'o1', progresso: 'concluido' },
      m2: { objetivoId: 'o1', progresso: 'risco' },
    },
  });
  const snap = await runOkrWeeklySnapshot(db);
  const o1 = snap.objetivos.o1;
  assert.equal(o1.titulo, 'Reduzir custo Firebase');
  assert.equal(o1.areaId, 'dadosia');
  assert.equal(o1.status, 'risco');
  assert.equal(o1.progressoPct, 50);
  assert.equal(o1.totalMarcos, 2);
  assert.equal(o1.marcosConcluidos, 1);
});

test('NUNCA inclui objetivo arquivado no snapshot', async () => {
  const db = seedDb({
    objetivos: {
      o1: { id: 'o1', titulo: 'Ativo', areaId: 'tech', arquivado: false },
      o2: { id: 'o2', titulo: 'Arquivado', areaId: 'tech', arquivado: true },
    },
  });
  const snap = await runOkrWeeklySnapshot(db);
  assert.ok(snap.objetivos.o1);
  assert.ok(!snap.objetivos.o2);
});

test('resumoGeral agrega a contagem de objetivos por status', async () => {
  const db = seedDb({
    objetivos: {
      o1: { id: 'o1', titulo: 'A', areaId: 'tech', arquivado: false },
      o2: { id: 'o2', titulo: 'B', areaId: 'tech', arquivado: false },
      o3: { id: 'o3', titulo: 'C', areaId: 'crm', arquivado: false },
    },
    marcos: {
      m1: { objetivoId: 'o1', progresso: 'no_prazo' },
      m2: { objetivoId: 'o2', progresso: 'atrasado' },
      // o3 sem marco nenhum -> nao_iniciado
    },
  });
  const snap = await runOkrWeeklySnapshot(db);
  assert.equal(snap.resumoGeral.total, 3);
  assert.equal(snap.resumoGeral.no_prazo, 1);
  assert.equal(snap.resumoGeral.atrasado, 1);
  assert.equal(snap.resumoGeral.nao_iniciado, 1);
});

test('NÃO escreve nenhuma notificação (Fase 3 é só snapshot, decisão explícita)', async () => {
  const db = seedDb({
    objetivos: { o1: { id: 'o1', titulo: 'X', areaId: 'tech', responsaveis: ['uid1'], arquivado: false } },
    marcos: { m1: { objetivoId: 'o1', progresso: 'atrasado' } },
  });
  await runOkrWeeklySnapshot(db);
  const notifs = (await db.ref('kanban/usuarios/uid1/notificacoes').get()).val();
  assert.ok(!notifs, 'não deveria ter escrito nenhuma notificação');
});

test('rodar 2x no mesmo dia SOBRESCREVE o snapshot do dia (não duplica)', async () => {
  const db = seedDb({
    objetivos: { o1: { id: 'o1', titulo: 'X', areaId: 'tech', arquivado: false } },
    marcos: { m1: { objetivoId: 'o1', progresso: 'no_prazo' } },
  });
  await runOkrWeeklySnapshot(db);
  await runOkrWeeklySnapshot(db);
  const todosSnapshots = (await db.ref('kanban/okr/snapshots').get()).val();
  assert.equal(Object.keys(todosSnapshots).length, 1);
});
