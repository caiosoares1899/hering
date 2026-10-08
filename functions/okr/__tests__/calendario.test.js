// Este arquivo cobre o comportamento COM várias torres/Arezzo (interruptor desligado). O modo atual (só Hering) é coberto por modoSoHering.test.js.
process.env.MARE_MODO_TESTE = 'varias-torres';
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

test('tags: o evento vinculado a uma tag abrange os Objetivos com ela (qualquer tipo), avisa só os responsáveis deles', () => {
  const objs = {
    a: { id: 'a', titulo: 'A', torre: 'digital', areaId: 'cx', tagIds: ['t1'], responsaveis: ['ana'] },
    b: { id: 'b', titulo: 'B', torre: 'comercial', tagIds: ['t1', 't2'], responsaveis: ['bia'] },
    c: { id: 'c', titulo: 'C', torre: 'digital', areaId: 'cx', tagIds: ['t2'], responsaveis: ['caio'] },
    d: { id: 'd', titulo: 'D', torre: 'digital', areaId: 'cx', responsaveis: ['dan'] },
  };
  assert.equal(J(Object.keys(cal.alvosDoEvento({ tipo: 'evento', torre: '', tagIds: ['t1'] }, objs)).sort()), J(['ana', 'bia']));
  assert.equal(cal.abrange({ tipo: 'evento', torre: '', tagIds: ['t1'] }, objs.a), 'tag');
  assert.equal(cal.abrange({ tipo: 'evento', torre: '', tagIds: ['t1'] }, objs.c), '');
  // torre local limita: a tag t1 na agenda Digital não pega o Objetivo da Comercial
  assert.equal(J(Object.keys(cal.alvosDoEvento({ tipo: 'reuniao', torre: 'digital', tagIds: ['t1'] }, objs))), J(['ana']));
});
test('tags + gerências: vale uma OU a outra; vínculo explícito vale em qualquer torre; sem nenhum acerto fica de fora (não vira "a torre toda")', () => {
  const o = { id: 'a', titulo: 'A', torre: 'digital', areaId: 'cx', tagIds: ['t9'], responsaveis: ['ana'] };
  assert.equal(cal.abrange({ tipo: 'reuniao', torre: 'digital', areaIds: ['cx'], tagIds: ['t1'] }, o), 'gerencia');
  assert.equal(cal.abrange({ tipo: 'reuniao', torre: 'digital', areaIds: ['tech'], tagIds: ['t1'] }, o), '');
  assert.equal(cal.abrange({ tipo: 'reuniao', torre: 'digital', tagIds: ['t1'] }, o), '');
  assert.equal(cal.abrange({ tipo: 'reuniao', torre: 'comercial', objetivoIds: ['a'] }, o), 'vinculo');
  assert.equal(cal.abrange({ tipo: 'reuniao', torre: 'digital' }, o), 'torre');
});

// ── migração do bloco quinzenal pro calendário ──
const OBJ_BLOCO = {
  b1: { id: 'b1', titulo: 'Obj Comercial Dig', torre: 'digital', areaId: 'comercial', responsaveis: ['ana'] },   // Bloco 1
  b2: { id: 'b2', titulo: 'Obj CX', areaId: 'cx', responsaveis: ['bia'] },                                          // Bloco 2 (sem `torre` = digital)
  c1: { id: 'c1', titulo: 'Obj Comercial torre', torre: 'comercial', responsaveis: ['caio'] },                       // outra torre: nunca teve bloco
};
const BLOCO1 = { id: 'bloco_quinzenal_1', titulo: 'Check-in OKR — Bloco 1', tipo: 'reuniao', data: '2026-09-03', torre: 'digital', areaIds: ['geral', 'comercial', 'performance', 'dadosia'], origem: 'bloco_quinzenal', lembrar: { vespera: true, dia: false }, rec: { tipo: 'quinzenal', unidade: 'semana', intervalo: 2, ate: '' } };
const BLOCO2 = { id: 'bloco_quinzenal_2', titulo: 'Check-in OKR — Bloco 2', tipo: 'reuniao', data: '2026-09-10', torre: 'digital', areaIds: ['cx', 'tech', 'crm'], origem: 'bloco_quinzenal', lembrar: { vespera: true, dia: false }, rec: { tipo: 'quinzenal', unidade: 'semana', intervalo: 2, ate: '' } };
const todasNotifs = async (db, uid) => Object.values((await db.ref(`kanban/usuarios/${uid}/notificacoes`).get()).val() || {}).filter((n) => n.type === 'okr_reuniao');

test('migração: as ocorrências dos 2 eventos recorrentes batem com a fórmula fixa do bloco quinzenal (alternam toda quinta, a partir de 03/09)', () => {
  const { ehDiaDeReuniao } = require('../dailyScan');
  const de = '2026-09-01', ate = '2027-03-31';
  const d1 = cal.ocorrencias(BLOCO1, de, ate), d2 = cal.ocorrencias(BLOCO2, de, ate);
  // toda quinta entre as datas: pertence a exatamente um dos blocos, o mesmo que a fórmula antiga diz
  let n = 0;
  for (let d = new Date(de + 'T00:00:00'); d <= new Date(ate + 'T00:00:00'); d.setDate(d.getDate() + 1)) {
    const s = d.toLocaleDateString('en-CA');
    if (d.getDay() !== 4) { assert.ok(!d1.includes(s) && !d2.includes(s), 'só quinta: ' + s); continue; }
    n++;
    assert.equal(d1.includes(s), ehDiaDeReuniao(s, 1), 'bloco 1 em ' + s);
    assert.equal(d2.includes(s), ehDiaDeReuniao(s, 2), 'bloco 2 em ' + s);
  }
  assert.ok(n > 25);
});
test('migração: com os eventos importados, a véspera vem do calendário (1 aviso por pessoa) e o gatilho fixo se cala — sem duplicar', async () => {
  const db = makeFakeDb({ kanban: { okr: { objetivos: OBJ_BLOCO, marcos: {}, calendario: { eventos: { bloco_quinzenal_1: BLOCO1, bloco_quinzenal_2: BLOCO2 } } } } });
  await runOkrDailyScan(db, '2026-09-30');   // amanhã (01/10) é quinta do Bloco 1
  const a = await todasNotifs(db, 'ana');
  assert.equal(a.length, 1); assert.equal(a[0].okrEventoId, 'bloco_quinzenal_1'); assert.match(a[0].title, /Amanhã: Check-in OKR — Bloco 1/); assert.match(a[0].sub, /Na pauta: Obj Comercial Dig/);
  assert.equal((await todasNotifs(db, 'bia')).length, 0);      // CX é do Bloco 2: não é essa semana
  assert.equal((await todasNotifs(db, 'caio')).length, 0);     // outra torre
  await runOkrDailyScan(db, '2026-10-07');   // amanhã (08/10) é quinta do Bloco 2
  const b = await todasNotifs(db, 'bia'); assert.equal(b.length, 1); assert.equal(b[0].okrEventoId, 'bloco_quinzenal_2');
});
test('migração: SEM os eventos importados o gatilho fixo continua avisando como sempre (nada muda até o ADM importar)', async () => {
  const db = makeFakeDb({ kanban: { okr: { objetivos: OBJ_BLOCO, marcos: {}, calendario: { eventos: {} } } } });
  await runOkrDailyScan(db, '2026-09-30');
  const a = await todasNotifs(db, 'ana');
  assert.equal(a.length, 1); assert.match(a[0].title, /Reunião de "Obj Comercial Dig" é amanhã/); assert.ok(!a[0].okrEventoId);
});
test('migração: um evento qualquer do calendário (sem origem) NÃO desliga o bloco fixo', async () => {
  const db = makeFakeDb({ kanban: { okr: { objetivos: OBJ_BLOCO, marcos: {}, calendario: { eventos: { x: { id: 'x', titulo: 'Outra', tipo: 'reuniao', data: '2026-10-20', torre: 'comercial' } } } } } });
  await runOkrDailyScan(db, '2026-09-30');
  const a = await todasNotifs(db, 'ana'); assert.equal(a.length, 1); assert.match(a[0].title, /é amanhã/);
});
