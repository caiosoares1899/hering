// functions/timers/__tests__/vigia.test.js
//
// ⏲ Vigia dos timers (functions/timers/vigia.js): aviso de "chegou a zero" (1× por timer), de "esquecido rodando" (4 h, 8 h, 12 h; pausar/retomar zera
// a contagem do trecho), o que NÃO avisa (pausado, novo, cronômetro sem duração, timer ainda dentro do tempo) e a idempotência (rodar de novo não duplica).
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const V = require('../vigia');

const T0 = Date.parse('2026-11-02T12:00:00-03:00');
const MIN = 60000, H = 3600000;
const timer = o => Object.assign({ sq: 'dev', cardId: 'c1', cardTitle: 'Card de teste', atividade: 'Roteiro', tipo: 'cron', status: 'rodando', startedAt: T0, accMs: 0, porUid: 'eve' }, o || {});
const db = idx => makeFakeDb({ kanban: { timers_ativos: idx } });
const notifs = async (d, uid) => Object.values((await d.ref(`kanban/usuarios/${uid}/notificacoes`).get()).val() || {}).filter(Boolean);   // o fake deixa null no lugar do nó apagado

test('timer chega a zero → avisa o dono, uma única vez', async () => {
  const d = db({ bob: { t1: timer({ tipo: 'timer', durMs: 25 * MIN }) } });
  assert.equal((await V.runTimersVigia(d, T0 + 24 * MIN)).enviados, 0);                       // ainda dentro do tempo
  assert.equal((await V.runTimersVigia(d, T0 + 25 * MIN + 10000)).enviados, 1);
  const n = await notifs(d, 'bob'); assert.equal(n.length, 1);
  assert.equal(n[0].type, 'timer_zero'); assert.equal(n[0].cardId, 'c1'); assert.equal(n[0].squad, 'dev'); assert.equal(n[0].read, false);
  assert.match(n[0].title, /Roteiro/); assert.match(n[0].sub, /25:00/);
  assert.equal((await V.runTimersVigia(d, T0 + 26 * MIN)).enviados, 0);                      // minuto seguinte: não repete
  assert.equal((await d.ref('kanban/timers_ativos/bob/t1/avisos/zero').get()).val(), true);
});
test('o tempo acumulado antes de pausar conta pro zero (accMs + trecho atual)', async () => {
  const d = db({ bob: { t1: timer({ tipo: 'timer', durMs: 10 * MIN, accMs: 8 * MIN }) } });
  assert.equal((await V.runTimersVigia(d, T0 + 1 * MIN)).enviados, 0);
  assert.equal((await V.runTimersVigia(d, T0 + 2 * MIN)).enviados, 1);
});
test('cronômetro (sem duração) nunca "chega a zero"; pausado e "novo" não avisam nada', async () => {
  const d = db({ bob: { a: timer(), b: timer({ tipo: 'timer', durMs: MIN, status: 'pausado', startedAt: null, accMs: 30000 }), c: timer({ tipo: 'timer', durMs: MIN, status: 'novo', startedAt: null }) } });
  assert.equal((await V.runTimersVigia(d, T0 + 3 * H - 1)).enviados, 0);
});
test('esquecido: avisa aos 4 h, 8 h e 12 h e depois para; cada um só uma vez', async () => {
  const d = db({ bob: { t1: timer() } });
  assert.equal((await V.runTimersVigia(d, T0 + 4 * H - MIN)).enviados, 0);
  assert.equal((await V.runTimersVigia(d, T0 + 4 * H)).enviados, 1);
  assert.equal((await V.runTimersVigia(d, T0 + 4 * H + 5 * MIN)).enviados, 0);
  assert.equal((await V.runTimersVigia(d, T0 + 8 * H)).enviados, 1);
  assert.equal((await V.runTimersVigia(d, T0 + 12 * H)).enviados, 1);
  assert.equal((await V.runTimersVigia(d, T0 + 20 * H)).enviados, 0);                         // já avisou 3×
  const n = await notifs(d, 'bob'); assert.equal(n.length, 3); assert.ok(n.every(x => x.type === 'timer_esquecido'));
  assert.match(n.find(x => x.id.endsWith('_2')).sub, /8 h/);
});
test('pausar e retomar começa um trecho novo: a contagem das 4 h recomeça', async () => {
  const d = db({ bob: { t1: timer() } });
  await V.runTimersVigia(d, T0 + 4 * H);                                                      // 1º aviso
  await d.ref('kanban/timers_ativos/bob/t1').update({ status: 'rodando', startedAt: T0 + 5 * H, accMs: 5 * H });   // retomou às 5 h
  assert.equal((await V.runTimersVigia(d, T0 + 8 * H)).enviados, 0);                          // só 3 h neste trecho
  assert.equal((await V.runTimersVigia(d, T0 + 9 * H)).enviados, 1);                          // 4 h neste trecho
});
test('dono certo e vários timers: cada pessoa recebe só o dela', async () => {
  const d = db({ bob: { t1: timer({ tipo: 'timer', durMs: MIN }) }, eve: { t2: timer({ tipo: 'timer', durMs: MIN, atividade: 'Da Eve' }) } });
  const r = await V.runTimersVigia(d, T0 + 2 * MIN); assert.deepEqual(r, { lidos: 2, enviados: 2 });
  assert.match((await notifs(d, 'eve'))[0].title, /Da Eve/); assert.match((await notifs(d, 'bob'))[0].title, /Roteiro/);
});
test('o aviso já apagado pela limpeza do sino não é recriado (o marcador em `avisos` manda)', async () => {
  const d = db({ bob: { t1: timer({ tipo: 'timer', durMs: MIN }) } });
  await V.runTimersVigia(d, T0 + 2 * MIN);
  await d.ref('kanban/usuarios/bob/notificacoes/n_tz_t1').set(null);
  assert.equal((await V.runTimersVigia(d, T0 + 3 * MIN)).enviados, 0);
  assert.equal((await notifs(d, 'bob')).length, 0);
});
test('sem timers ativos: não faz nada e não quebra', async () => {
  assert.deepEqual(await V.runTimersVigia(makeFakeDb({ kanban: {} }), T0), { lidos: 0, enviados: 0 });
});
