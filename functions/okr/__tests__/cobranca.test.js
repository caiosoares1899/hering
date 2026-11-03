// functions/okr/__tests__/cobranca.test.js — cobrança automática das entregas (functions/okr/cobranca.js).
process.env.MARE_MODO_TESTE = 'varias-torres';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { runCobrancaEntregas, estagiosDe, semanaIso } = require('../cobranca');
const { runOkrDailyScan } = require('../dailyScan');

const soma = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const SEG = '2026-11-09', QUA = '2026-11-11', SAB = '2026-11-14';   // segunda, quarta, sábado
const entrega = (id, extra) => Object.assign({ id, tipo: 'entrega', titulo: 'Plano ' + id, data: soma(QUA, 5), status: 'a_fazer', diaInteiro: true, torre: 'digital', convidados: ['fulana'], criadoPor: { uid: 'criador', nome: 'Criador' } }, extra || {});
const mkDb = (eventos, extra) => makeFakeDb({ kanban: Object.assign({
  okr: { calendario: { eventos }, cobranca_config: { gestores: { rafael: true, caio: true } } },
  usuarios_publicos: { fulana: { nome: 'Fulana', email: 'fulana@ciahering.com.br' }, rafael: { nome: 'Rafael', email: 'rafael.passos@ciahering.com.br' }, caio: { nome: 'Caio', email: 'caio.soares@ciahering.com.br' }, criador: { nome: 'Criador' }, outro: { nome: 'Outro' } },
}, extra || {}) });
const mkCtx = (db, eventos, hoje) => ({ db, eventos, hoje, defaultAdmEmails: [],
  diasAte: (d) => Math.round((new Date(String(d).slice(0, 10) + 'T00:00:00Z') - new Date(hoje + 'T00:00:00Z')) / 86400000),
  writeNotif: async (d, uid, type, title, sub, okrObjId, extra) => { const id = 'n' + Math.random().toString(36).slice(2, 9); await d.ref(`kanban/usuarios/${uid}/notificacoes/${id}`).set({ id, type, title, sub: sub || '', ...(extra || {}), read: false, ts: new Date().toISOString() }); } });
const rodar = async (db, hoje) => { const ev = (await db.ref('kanban/okr/calendario/eventos').get()).val() || {}; return runCobrancaEntregas(mkCtx(db, ev, hoje)); };
const notifs = async (db, uid) => Object.values((await db.ref(`kanban/usuarios/${uid}/notificacoes`).get()).val() || {}).filter((n) => n.type === 'okr_cobranca');

const { diasUteisAte } = require('../cobranca');
const SEX = '2026-11-13';
test('dias úteis: fim de semana não conta, nos dois sentidos', () => {
  assert.equal(diasUteisAte('2026-11-13', '2026-11-16'), 1, 'sexta → segunda = 1');
  assert.equal(diasUteisAte('2026-11-16', '2026-11-13'), -1, 'segunda olhando a sexta = -1');
  assert.equal(diasUteisAte(QUA, '2026-11-14'), 2, 'quarta → sábado = quinta e sexta');
  assert.equal(diasUteisAte('2026-11-14', '2026-11-16'), 1, 'sábado → segunda = 1');
  assert.equal(diasUteisAte(QUA, QUA), 0);
  assert.equal(diasUteisAte('2026-11-16', '2026-11-11'), -3, 'segunda olhando a quarta anterior: qui, sex, seg');
});
test('estágios (dias úteis): preventivo 2–3, véspera 1, dia 0, atraso 1–2, atraso-3, semanal de segunda; `lembrar` desliga véspera/dia', () => {
  assert.deepEqual(estagiosDe(3, 3, QUA), ['preventivo']); assert.deepEqual(estagiosDe(2, 4, QUA), ['preventivo']);
  assert.deepEqual(estagiosDe(1, 1, QUA), ['vespera']); assert.deepEqual(estagiosDe(1, 3, SEX), ['vespera'], 'prazo de segunda avisa a véspera na sexta');
  assert.deepEqual(estagiosDe(0, 0, QUA), ['dia']); assert.deepEqual(estagiosDe(0, 1, SEX), ['dia'], 'prazo no sábado avisa na sexta');
  assert.deepEqual(estagiosDe(-1, -1, QUA), ['atraso-1']); assert.deepEqual(estagiosDe(-2, -4, QUA), ['atraso-1']);
  assert.deepEqual(estagiosDe(-3, -3, QUA), ['atraso-3']);
  assert.deepEqual(estagiosDe(-9, -11, SEG), ['atraso-3', 'semanal-' + semanaIso(SEG)]);
  assert.deepEqual(estagiosDe(1, 1, QUA, { vespera: false, dia: true }), []); assert.deepEqual(estagiosDe(0, 0, QUA, { vespera: true, dia: false }), []);
  assert.deepEqual(estagiosDe(-1, -1, QUA, { vespera: false, dia: false }), ['atraso-1'], 'atraso não depende de `lembrar`');
});
test('semanaIso: virada de ano e segunda-feira', () => { assert.equal(semanaIso('2026-01-01'), '2026-W01'); assert.equal(semanaIso('2026-11-09'), '2026-W46'); assert.equal(semanaIso('2026-11-15'), '2026-W46'); });

test('preventivo: 3 dias antes avisa o responsável uma vez, com título e dias; rodar de novo não repete', async () => {
  const db = mkDb({ a: entrega('a', { data: soma(QUA, 3) }) });
  const r = await rodar(db, QUA); assert.equal(r.avisados, 1);
  const n = await notifs(db, 'fulana'); assert.equal(n.length, 1);
  assert.match(n[0].title, /^📦 Vence em 3 dias: Plano a/); assert.equal(n[0].okrEventoId, 'a');
  await rodar(db, QUA); assert.equal((await notifs(db, 'fulana')).length, 1, 'carimbo impede repetir');
  assert.equal((await notifs(db, 'rafael')).length, 0, 'gestor não é avisado do preventivo');
});
test('atraso de 1 dia: só o responsável; de 3 dias: responsável + escalonamento pros gestores e pra quem criou', async () => {
  const db1 = mkDb({ a: entrega('a', { data: soma(QUA, -1) }) });
  await rodar(db1, QUA); assert.match((await notifs(db1, 'fulana'))[0].title, /atrasada: Plano a/);
  assert.equal((await notifs(db1, 'rafael')).length + (await notifs(db1, 'criador')).length, 0);
  const db3 = mkDb({ a: entrega('a', { data: soma(QUA, -3) }) });
  const r = await rodar(db3, QUA); assert.equal(r.escalonados, 3);
  for (const u of ['rafael', 'caio', 'criador']) { const n = await notifs(db3, u); assert.equal(n.length, 1, u); assert.match(n[0].title, /Atrasada há 3 dias: Plano a/); assert.match(n[0].sub, /Fulana/); }
  await rodar(db3, QUA); assert.equal((await notifs(db3, 'rafael')).length, 1, 'escala 1x só');
});
test('quem é gestor E responsável não recebe duas vezes', async () => {
  const db = mkDb({ a: entrega('a', { data: soma(QUA, -4), convidados: ['rafael'] }) });
  await rodar(db, QUA); assert.equal((await notifs(db, 'rafael')).length, 1);
  assert.equal((await notifs(db, 'caio')).length, 1);
});
test('1 notificação por pessoa: várias entregas viram um resumo', async () => {
  const db = mkDb({ a: entrega('a', { data: soma(QUA, -1) }), b: entrega('b', { data: soma(QUA, -2) }), c: entrega('c', { data: soma(QUA, 3) }) });
  const r = await rodar(db, QUA); assert.equal(r.avisados, 1);
  const n = await notifs(db, 'fulana'); assert.equal(n.length, 1); assert.match(n[0].title, /Você tem 2 entregas atrasadas/); assert.match(n[0].sub, /e 1 vencendo em breve/);
});
test('semanal: segunda, atraso-3 já avisado → cobra de novo 1x na semana; sem o carimbo do atraso-3 só o atraso-3 avisa', async () => {
  const db = mkDb({ a: entrega('a', { data: soma(SEG, -9) }) });
  await rodar(db, soma(SEG, -5));   // quarta anterior (3 dias úteis de atraso): atraso-3
  const n0 = (await notifs(db, 'fulana')).length;
  await rodar(db, SEG); assert.equal((await notifs(db, 'fulana')).length, n0 + 1, 'semanal avisou');
  await rodar(db, SEG); assert.equal((await notifs(db, 'fulana')).length, n0 + 1, 'e não repete na mesma semana');
  const db2 = mkDb({ a: entrega('a', { data: soma(SEG, -9) }) });
  await rodar(db2, SEG); assert.equal((await notifs(db2, 'fulana')).length, 1, 'primeiro aviso é o atraso-3, não 2 de uma vez');
});
test('fim de semana: nada sai', async () => {
  const db = mkDb({ a: entrega('a', { data: soma(SAB, -5) }) }); const r = await rodar(db, SAB);
  assert.equal(r.pulado, 'fim de semana'); assert.equal((await notifs(db, 'fulana')).length, 0);
});
test('entregue, plano pai (com filhas) e sem prazo não são cobrados; a filha atrasada é; sem responsável não cobra ninguém', async () => {
  const db = mkDb({ ok: entrega('ok', { data: soma(QUA, -5), status: 'entregue' }), pai: entrega('pai', { data: soma(QUA, -5) }), filha: entrega('filha', { data: soma(QUA, -5), paiId: 'pai' }),
    sd: entrega('sd', { data: soma(QUA, -5), convidados: [] }), reun: { id: 'reun', tipo: 'reuniao', titulo: 'R', data: soma(QUA, -5), convidados: ['fulana'] } });
  await rodar(db, QUA); const n = await notifs(db, 'fulana');
  assert.equal(n.length, 1); assert.match(n[0].title, /Plano filha/);
});
test('mudou o prazo: o carimbo antigo não vale e a régua recomeça', async () => {
  const db = mkDb({ a: entrega('a', { data: soma(QUA, 3) }) });
  await rodar(db, QUA); assert.equal((await notifs(db, 'fulana')).length, 1);
  await db.ref('kanban/okr/calendario/eventos/a/data').set(soma(QUA, 2));
  await rodar(db, QUA); assert.equal((await notifs(db, 'fulana')).length, 2);
});
test('resumo da segunda: só gestores, 1x por semana, conta atrasadas / vencem na semana / sem responsável', async () => {
  const db = mkDb({ a: entrega('a', { data: soma(SEG, -1) }), b: entrega('b', { data: soma(SEG, 2) }), c: entrega('c', { data: soma(SEG, 4), convidados: [] }) });
  const r = await rodar(db, SEG); assert.equal(r.resumo, 2);
  const n = (await notifs(db, 'rafael')).filter((x) => /resumo da semana/.test(x.title)); assert.equal(n.length, 1);
  assert.equal(n[0].sub, '1 atrasada · 1 vence esta semana · 1 sem responsável');
  assert.equal((await notifs(db, 'fulana')).filter((x) => /resumo/.test(x.title)).length, 0);
  await rodar(db, SEG); assert.equal((await notifs(db, 'rafael')).filter((x) => /resumo da semana/.test(x.title)).length, 1);
  assert.equal((await rodar(mkDb({ z: entrega('z', { data: soma(SEG, 30) }) }), SEG)).resumo, 0, 'nada a dizer = sem resumo');
});
test('sem lista de gestores: caem nos ADMs (e-mails de adm_emails casados com usuarios_publicos)', async () => {
  const db = mkDb({ a: entrega('a', { data: soma(QUA, -3) }) }, { config: { adm_emails: ['rafael.passos@ciahering.com.br'] } });
  await db.ref('kanban/okr/cobranca_config').remove();
  await rodar(db, QUA); assert.equal((await notifs(db, 'rafael')).length, 1); assert.equal((await notifs(db, 'caio')).length, 0);
});
test('limpeza: carimbo de entrega que não existe mais é apagado', async () => {
  const db = mkDb({ a: entrega('a') }, {}); await db.ref('kanban/okr/cobrancas_log/fantasma/preventivo').set({ data: '2026-01-01', ts: 'x', para: [] });
  const r = await rodar(db, QUA); assert.equal(r.limpos, 1); assert.equal((await db.ref('kanban/okr/cobrancas_log/fantasma').get()).val(), null);
});
test('integração: okrDailyScan chama a cobrança (sem derrubar os outros gatilhos)', async () => {
  const hojeSP = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }), dow = new Date(hojeSP + 'T12:00:00Z').getUTCDay();
  const db = mkDb({ a: entrega('a', { data: soma(hojeSP, -1) }) });
  await runOkrDailyScan(db);
  const n = await notifs(db, 'fulana');
  if (dow === 0 || dow === 6) assert.equal(n.length, 0, 'fim de semana: pulou'); else { assert.equal(n.length, 1); assert.match(n[0].title, /atrasada/); }
});

test('prazo na SEXTA: segunda é atraso de 1 dia útil (só o responsável); só na quarta escala pros gestores', async () => {
  const mk = () => mkDb({ a: entrega('a', { data: '2026-11-06' }) });   // sexta anterior à segunda SEG
  const seg = mk(); await rodar(seg, SEG);
  assert.equal((await notifs(seg, 'fulana')).length, 1); assert.match((await notifs(seg, 'fulana'))[0].title, /atrasada: Plano a/);
  const semResumo = async (u) => (await notifs(seg, u)).filter((x) => !/resumo da semana/.test(x.title)).length;   // segunda traz o resumo da gestão pros gestores — isso não é escalonamento
  assert.equal((await semResumo('rafael')) + (await semResumo('criador')), 0, 'segunda ainda não escala');
  const qua = mk(); await rodar(qua, QUA);
  assert.ok((await notifs(qua, 'rafael')).some((x) => /Atrasada há/.test(x.title)), 'quarta (3 dias úteis) escala');
});
test('prazo na TERÇA recebe o preventivo (na sexta) — antes, em dias corridos, o fim de semana engolia a janela', async () => {
  const db = mkDb({ a: entrega('a', { data: '2026-11-17' }) });   // terça
  await rodar(db, SEX); assert.equal((await notifs(db, 'fulana')).length, 1); assert.match((await notifs(db, 'fulana'))[0].title, /Vence em 4 dias|Vence em/);
});
test('véspera e dia das entregas: prazo de segunda avisa na SEXTA (nunca no domingo); respeita `lembrar`; agrupa por pessoa', async () => {
  const db = mkDb({ a: entrega('a', { data: '2026-11-16' }), b: entrega('b', { data: '2026-11-16' }), c: entrega('c', { data: '2026-11-16', lembrar: { vespera: false, dia: false } }) });
  await rodar(db, SEX);
  const n = await notifs(db, 'fulana');
  assert.equal(n.length, 1, 'uma notificação só'); assert.match(n[0].title, /Você tem 2 entregas vencendo/, 'a (c) com lembrete desligado não entra');
  const dom = mkDb({ a: entrega('a', { data: '2026-11-16' }) }); const r = await rodar(dom, '2026-11-15');
  assert.equal(r.pulado, 'fim de semana'); assert.equal((await notifs(dom, 'fulana')).length, 0, 'domingo: nada');
  const dia = mkDb({ a: entrega('a', { data: SEG }) }); await rodar(dia, SEG);
  assert.match((await notifs(dia, 'fulana'))[0].title, /Vence hoje: Plano a/);
});
test('plano pai com responsável preenchido NÃO recebe véspera/dia (só as filhas)', async () => {
  const db = mkDb({ pai: entrega('pai', { data: SEG }), f: entrega('f', { data: SEG, paiId: 'pai', convidados: ['outro'] }) });
  await rodar(db, SEG); assert.equal((await notifs(db, 'fulana')).length, 0); assert.equal((await notifs(db, 'outro')).length, 1);
});
