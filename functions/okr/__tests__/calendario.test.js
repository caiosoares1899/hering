// functions/okr/__tests__/calendario.test.js
//
// Parte pura do calendário do OKR (recorrência, escopo, lembretes) + o gatilho 3 do dailyScan (véspera e dia). Os casos de recorrência são os MESMOS do
// teste de navegador do cliente (okr-dev.html) — as duas implementações têm que concordar.
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const cal = require('../calendario');
const { runOkrDailyScan, todaySP } = require('../dailyScan');

const J = JSON.stringify;
const R = (unidade, intervalo, ate) => ({ tipo: 'x', unidade, intervalo, ate: ate || '' });
const oc = (data, rec, de, ate, ex) => cal.ocorrencias({ data, rec, excecoes: ex || {} }, de, ate);

test('recorrência: não repete / semanal / quinzenal', () => {
  assert.equal(J(oc('2026-10-08', null, '2026-10-01', '2026-10-31')), J(['2026-10-08']));
  assert.equal(J(oc('2026-10-08', R('semana', 1), '2026-10-01', '2026-10-31')), J(['2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29']));
  assert.equal(J(oc('2026-10-08', R('semana', 2), '2026-10-01', '2026-11-30')), J(['2026-10-08', '2026-10-22', '2026-11-05', '2026-11-19']));
});
test('recorrência: mensal no dia 31 usa o último dia do mês; trimestral; semestral; anual em 29/fev', () => {
  assert.equal(J(oc('2026-01-31', R('mes', 1), '2026-01-01', '2026-05-31')), J(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']));
  assert.equal(J(oc('2026-01-15', R('mes', 3), '2026-01-01', '2026-12-31')), J(['2026-01-15', '2026-04-15', '2026-07-15', '2026-10-15']));
  assert.equal(J(oc('2026-02-10', R('mes', 6), '2026-01-01', '2027-12-31')), J(['2026-02-10', '2026-08-10', '2027-02-10', '2027-08-10']));
  assert.equal(J(oc('2028-02-29', R('ano', 1), '2028-01-01', '2030-12-31')), J(['2028-02-29', '2029-02-28', '2030-02-28']));
});
test('recorrência: personalizada, data final, exceção, intervalo inválido', () => {
  assert.equal(J(oc('2026-10-01', R('dia', 10), '2026-10-01', '2026-11-05')), J(['2026-10-01', '2026-10-11', '2026-10-21', '2026-10-31']));
  assert.equal(J(oc('2026-10-08', R('semana', 1, '2026-10-20'), '2026-10-01', '2026-12-31')), J(['2026-10-08', '2026-10-15']));
  assert.equal(J(oc('2026-10-08', R('semana', 1), '2026-10-01', '2026-10-31', { '2026-10-15': true })), J(['2026-10-08', '2026-10-22', '2026-10-29']));
  assert.equal(J(oc('2026-10-08', { unidade: 'semana', intervalo: 0 }, '2026-10-01', '2026-10-31')), J(['2026-10-08']));
});

const OBJ = {
  o1: { id: 'o1', titulo: 'Dig Tech', torre: 'digital', areaId: 'tech', responsaveis: ['ana'] },
  o2: { id: 'o2', titulo: 'Dig CX', areaId: 'cx', responsaveis: ['bia', 'ana'] },            // sem `torre` = digital
  o3: { id: 'o3', titulo: 'Com', torre: 'comercial', responsaveis: ['caio'] },
  o4: { id: 'o4', titulo: 'Arq', torre: 'comercial', arquivado: true, responsaveis: ['dan'] },
  o5: { id: 'o5', titulo: 'Sem resp', torre: 'comercial', responsaveis: [] },
};
test('alvos: reunião da torre = responsáveis dos Objetivos ativos dela; global = de todas as torres', () => {
  assert.equal(J(Object.keys(cal.alvosDoEvento({ tipo: 'reuniao', torre: 'comercial' }, OBJ)).sort()), J(['caio']));
  assert.equal(J(Object.keys(cal.alvosDoEvento({ tipo: 'reuniao', torre: '' }, OBJ)).sort()), J(['ana', 'bia', 'caio']));
  assert.equal(J(Object.keys(cal.alvosDoEvento({ tipo: 'reuniao', torre: 'digital', areaIds: ['cx'] }, OBJ)).sort()), J(['ana', 'bia']));
});
test('alvos: vínculo explícito vence; evento/lembrete sem vínculo não avisa ninguém; arquivado e sem responsável ficam de fora', () => {
  assert.equal(J(Object.keys(cal.alvosDoEvento({ tipo: 'evento', torre: 'digital', objetivoIds: ['o1'] }, OBJ))), J(['ana']));
  assert.equal(J(Object.keys(cal.alvosDoEvento({ tipo: 'evento', torre: 'digital' }, OBJ))), J([]));
  assert.equal(J(Object.keys(cal.alvosDoEvento({ tipo: 'lembrete', torre: '' }, OBJ))), J([]));
  assert.equal(J(Object.keys(cal.alvosDoEvento({ tipo: 'reuniao', torre: 'comercial', objetivoIds: ['o4', 'o5'] }, OBJ))), J([]));
});
test('alvos: um responsável com 2 Objetivos recebe a lista dos 2 (uma notificação só, no scan)', () => {
  assert.equal(J(cal.alvosDoEvento({ tipo: 'reuniao', torre: 'digital' }, OBJ).ana), J(['Dig Tech', 'Dig CX']));
});
test('lembretes: padrão = véspera e dia; respeita o evento; lembrete só no dia', () => {
  assert.equal(J(cal.lembretesDe({ tipo: 'reuniao' })), J({ vespera: true, dia: true }));
  assert.equal(J(cal.lembretesDe({ tipo: 'reuniao', lembrar: { vespera: false, dia: true } })), J({ vespera: false, dia: true }));
  assert.equal(J(cal.lembretesDe({ tipo: 'reuniao', lembrar: { vespera: true, dia: false } })), J({ vespera: true, dia: false }));
  assert.equal(J(cal.lembretesDe({ tipo: 'lembrete' })), J({ vespera: false, dia: true }));
});

// ── gatilho 3 do dailyScan ──
const HOJE = todaySP();
const addDias = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const seed = (eventos, objetivos) => makeFakeDb({ kanban: { okr: { objetivos: objetivos || OBJ, marcos: {}, calendario: { eventos } } } });
// só as do CALENDÁRIO (okrEventoId): o gatilho antigo do bloco quinzenal também escreve `okr_reuniao` nas vésperas de quinta, conforme a data real do teste.
const notifsDe = async (db, uid) => Object.values((await db.ref(`kanban/usuarios/${uid}/notificacoes`).get()).val() || {}).filter((n) => n.okrEventoId);

test('scan: reunião da torre amanhã → véspera pros responsáveis, com título, hora, agenda e pauta; tipo okr_reuniao (já vira push)', async () => {
  const db = seed({ e1: { id: 'e1', titulo: 'Check-in Comercial', tipo: 'reuniao', data: addDias(1), hi: '10:00', hf: '11:00', torre: 'comercial' } });
  await runOkrDailyScan(db);
  const n = await notifsDe(db, 'caio');
  assert.equal(n.length, 1);
  assert.equal(n[0].type, 'okr_reuniao'); assert.match(n[0].title, /Amanhã: Check-in Comercial/); assert.match(n[0].sub, /10:00–11:00/); assert.match(n[0].sub, /Agenda Comercial/); assert.match(n[0].sub, /Na pauta: Com/);
  assert.equal(n[0].okrEventoId, 'e1'); assert.equal(n[0].okrEventoData, addDias(1));
  assert.equal((await notifsDe(db, 'ana')).length, 0);   // Digital não é alvo da reunião da Comercial
});
test('scan: reunião hoje → "Hoje"; as duas janelas juntas (semanal começando hoje e amanhã seria outro dia) não duplicam', async () => {
  const db = seed({ e1: { id: 'e1', titulo: 'Daily', tipo: 'reuniao', data: HOJE, torre: 'comercial' } });
  await runOkrDailyScan(db);
  const n = await notifsDe(db, 'caio'); assert.equal(n.length, 1); assert.match(n[0].title, /Hoje: Daily/);
});
test('scan: respeita `lembrar` (véspera desligada = não avisa amanhã) e exceção (ocorrência cancelada)', async () => {
  const db = seed({
    e1: { id: 'e1', titulo: 'Sem véspera', tipo: 'reuniao', data: addDias(1), torre: 'comercial', lembrar: { vespera: false, dia: true } },
    e2: { id: 'e2', titulo: 'Cancelada', tipo: 'reuniao', data: addDias(1), torre: 'comercial', excecoes: { [addDias(1)]: true } },
  });
  await runOkrDailyScan(db);
  assert.equal((await notifsDe(db, 'caio')).length, 0);
});
test('scan: série recorrente (semanal) cai amanhã numa ocorrência futura; global avisa todas as torres, 1 notificação por pessoa', async () => {
  const db = seed({ g1: { id: 'g1', titulo: 'All-hands', tipo: 'reuniao', data: addDias(-6), torre: '', rec: { tipo: 'semanal', unidade: 'semana', intervalo: 1, ate: '' } } });
  await runOkrDailyScan(db);   // -6 +7 = amanhã
  const n = await notifsDe(db, 'ana');
  assert.equal(n.length, 1); assert.match(n[0].title, /Amanhã: All-hands/); assert.match(n[0].sub, /Agenda global/); assert.match(n[0].sub, /Na pauta: Dig Tech · Dig CX/);
  assert.equal((await notifsDe(db, 'bia')).length, 1); assert.equal((await notifsDe(db, 'caio')).length, 1);
});
test('scan: sem eventos / evento sem data / evento fora da janela não escrevem nada nem quebram os outros gatilhos', async () => {
  const db = seed({ x: { id: 'x', titulo: 'sem data', tipo: 'reuniao' }, y: { id: 'y', titulo: 'longe', tipo: 'reuniao', data: addDias(10), torre: '' } });
  await runOkrDailyScan(db);
  assert.equal((await notifsDe(db, 'ana')).length + (await notifsDe(db, 'caio')).length, 0);
});

test('convidados: recebem véspera e dia mesmo sem Objetivo na pauta; quem já está na pauta e é convidado recebe UMA só', async () => {
  const db = seed({ e1: { id: 'e1', titulo: 'Reunião aberta', tipo: 'reuniao', data: addDias(1), torre: 'comercial', convidados: ['zed', 'caio'], local: 'Sala 3' } });
  await runOkrDailyScan(db);
  const z = await notifsDe(db, 'zed'); assert.equal(z.length, 1); assert.match(z[0].sub, /Você está convidado/); assert.match(z[0].sub, /Sala 3/); assert.doesNotMatch(z[0].sub, /Na pauta/);
  const c = await notifsDe(db, 'caio'); assert.equal(c.length, 1); assert.match(c[0].sub, /Na pauta: Com/);
});
test('convidados: lista vazia/ausente não quebra', () => {
  assert.equal(J(cal.convidadosDe({})), J([])); assert.equal(J(cal.convidadosDe({ convidados: ['a', null, 'b'] })), J(['a', 'b']));
});
