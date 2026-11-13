// functions/gantt/__tests__/avisos.test.js
//
// 🔔 Avisos de mudança nos calendários do Gantt (functions/gantt/avisos.js): avisa os inscritos menos o autor, texto de publicar e de
// voltar versão (hora de Brasília), idempotente (retry não duplica), destinatário excluído/de fora não recebe e perde a inscrição (sem
// recriar usuarios/{uid}), _dev lê os inscritos _dev e marca o aviso dev; push: tipo no PUSH_TYPES, URL e tag por calendário.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { _test: G } = require('../avisos');
const { urlDoPush, tagDoPush } = require('../../common/pushUrl');

const linha = (o) => Object.assign({ em: 1, porUid: 'ana', porNome: 'Ana Lima', arquivo: 'Outlet | Calendário Novembro 2026.xlsx', acao: 'publicou', snap: 'vabc123', n: 32, novas: 3, mudaram: 1, saem: 0 }, o || {});
// Auth falso: o que o Firebase Auth diz de cada uid (sumiu = não existe mais no login)
const G_ = (email) => ({ email, providerData: [{ providerId: 'google.com' }] });
const AUTH = { ana: G_('ana@ciahering.com.br'), bia: G_('bia@ciahering.com.br'), caio: G_('caio@ciahering.com.br'), ext: G_('x@gmail.com'), lider: G_('lider@ciahering.com.br'), senha: { email: 'sen@ciahering.com.br', providerData: [{ providerId: 'password' }] } };
const auth = { async getUser(uid) { if (!AUTH[uid]) { const e = new Error('nope'); e.code = 'auth/user-not-found'; throw e; } return AUTH[uid]; } };
const db0 = (suf, extra) => makeFakeDb({ kanban: Object.assign({
  usuarios: { ana: { email: 'ana@ciahering.com.br' }, bia: { email: 'bia@ciahering.com.br' }, caio: { email: 'caio@ciahering.com.br' }, ext: { email: 'x@gmail.com' } },
  usuarios_publicos: { ana: { nome: 'Ana Lima' } },
  ['gantt_inscritos' + (suf || '')]: { outlet: { ana: { em: 1, onde: 'mare' }, bia: { em: 1, onde: 'radar' }, caio: { em: 1, onde: 'mare' }, sumiu: { em: 1, onde: 'mare' }, ext: { em: 1, onde: 'mare' } } },
}, extra || {}) });
const notifs = async (db, uid) => Object.values((await db.ref(`kanban/usuarios/${uid}/notificacoes`).get()).val() || {});

test('avisa os inscritos menos o autor; texto com ＋✎− e o arquivo; campos para o clique', async () => {
  const db = db0();
  const r = await G.avisarMudanca({ db, auth, cal: 'outlet', histId: 'v1', h: linha(), agora: Date.parse('2026-11-13T15:00:00Z') });
  assert.equal(r.enviados, 2);
  assert.equal((await notifs(db, 'ana')).length, 0, 'o autor não recebe');
  const [b] = await notifs(db, 'bia');
  assert.equal(b.type, 'gantt_cal'); assert.equal(b.cal, 'outlet'); assert.equal(b.onde, 'radar'); assert.equal(b.dev, false); assert.equal(b.read, false);
  assert.equal(b.title, '📊 Comercial Outlet atualizado');
  assert.match(b.sub, /^Ana Lima · ＋3 ✎1 · Outlet \| Calendário Novembro 2026\.xlsx$/);
  assert.equal(typeof b.ts, 'string');
  assert.equal(b.id, 'gantt_outlet_v1');
});

test('destinatário excluído ou de fora: não recebe, não recria usuarios/{uid}, e a inscrição sai', async () => {
  const db = db0();
  const r = await G.avisarMudanca({ db, auth, cal: 'outlet', histId: 'v1', h: linha() });
  assert.equal(r.removidos, 2);
  assert.equal((await db.ref('kanban/usuarios/sumiu').get()).val(), null, 'sem usuarios/{uid} órfão');
  assert.equal((await notifs(db, 'ext')).length, 0, 'conta de fora não recebe');
  const ins = (await db.ref('kanban/gantt_inscritos/outlet').get()).val();
  assert.deepEqual(Object.keys(ins).sort(), ['ana', 'bia', 'caio']);
});

test('idempotente: o mesmo disparo de novo não duplica', async () => {
  const db = db0();
  await G.avisarMudanca({ db, auth, cal: 'outlet', histId: 'v1', h: linha() });
  const r2 = await G.avisarMudanca({ db, auth, cal: 'outlet', histId: 'v1', h: linha() });
  assert.equal(r2.enviados, 0);
  assert.equal((await notifs(db, 'bia')).length, 1);
});

test('voltar versão: texto próprio com a data de Brasília', async () => {
  const db = db0();
  await G.avisarMudanca({ db, auth, cal: 'outlet', histId: 'v2', h: linha({ acao: 'restaurou', deEm: Date.parse('2026-11-13T15:32:00Z') }) });
  const [b] = await notifs(db, 'bia');
  assert.equal(b.title, '📊 Comercial Outlet voltou para uma versão anterior');
  assert.equal(b.sub, 'Ana Lima voltou para a versão de 13/11 às 12:32');
});

test('_dev: lê os inscritos _dev e o aviso leva à página -dev', async () => {
  const db = db0('_dev');
  const r = await G.avisarMudanca({ db, auth, cal: 'outlet', histId: 'v1', h: linha(), dev: true });
  assert.equal(r.enviados, 2);
  const [b] = await notifs(db, 'bia');
  assert.equal(b.dev, true);
  assert.equal(urlDoPush(b), 'https://caiosoares1899.github.io/hering/okr-dev.html?gantt=outlet');
  const db2 = db0('_dev');
  assert.equal((await G.avisarMudanca({ db: db2, auth, cal: 'outlet', histId: 'v1', h: linha(), dev: false })).enviados, 0, 'prod não lê os inscritos _dev');
});

test('linha inválida ou calendário desconhecido: nada', async () => {
  const db = db0();
  assert.equal((await G.avisarMudanca({ db, auth, cal: 'digital', histId: 'v1', h: linha() })).enviados, 0);
  assert.equal((await G.avisarMudanca({ db, auth, cal: 'outlet', histId: 'v1', h: null })).enviados, 0);
});

test('texto: nome com quebra de linha e arquivo enorme são limpos e cortados', () => {
  const t = G.textoDoAviso('marca', linha({ porNome: 'Ana\nLima', arquivo: 'x'.repeat(300), novas: 0, mudaram: 0, saem: 0 }));
  assert.ok(!/\n/.test(t.sub)); assert.ok(t.sub.length <= 140); assert.match(t.sub, /sem mudança nas ações/);
});

test('push: gantt_cal no PUSH_TYPES; URL do Maré/Radar e tag por calendário', () => {
  const idx = fs.readFileSync(path.join(__dirname, '..', '..', 'index.js'), 'utf8');
  assert.match(idx, /PUSH_TYPES = new Set\(\[[^\]]*'gantt_cal'/);
  assert.equal(urlDoPush({ type: 'gantt_cal', cal: 'comercial', onde: 'mare' }), 'https://caiosoares1899.github.io/hering/kanban.html?gantt=comercial');
  assert.equal(urlDoPush({ type: 'gantt_cal', cal: 'marca', onde: 'radar' }), 'https://caiosoares1899.github.io/hering/okr.html?gantt=marca');
  assert.equal(urlDoPush({ type: 'gantt_cal', cal: 'javascript:x', onde: 'mare' }), 'https://caiosoares1899.github.io/hering/kanban.html?gantt=', 'calendário fora da lista não entra na URL');
  assert.equal(tagDoPush({ type: 'gantt_cal', cal: 'outlet' }, 'n1'), 'gantt_cal_outlet');
  assert.equal(tagDoPush({ type: 'gantt_cal', cal: 'outlet' }, 'n2'), 'gantt_cal_outlet', 'publicações seguidas do mesmo calendário se substituem no aparelho');
});

test('líder que só usa o Radar (registro sem email, só torre/fcm_tokens) recebe; conta não-Google não', async () => {
  const db = makeFakeDb({ kanban: { usuarios: { lider: { torre: 'digital', fcm_tokens: { d1: { token: 't' } } }, senha: { email: 'sen@ciahering.com.br' } },
    gantt_inscritos: { marca: { lider: { em: 1, onde: 'radar' }, senha: { em: 1, onde: 'mare' } } } } });
  const r = await G.avisarMudanca({ db, auth, cal: 'marca', histId: 'v9', h: linha() });
  assert.equal(r.enviados, 1);
  assert.equal((await notifs(db, 'lider')).length, 1);
  assert.equal((await notifs(db, 'senha')).length, 0, 'login que não é Google não recebe');
});

test('o nome de quem atualizou vem do cadastro público, não do texto livre da linha', async () => {
  const db = db0();
  await G.avisarMudanca({ db, auth, cal: 'outlet', histId: 'v7', h: linha({ porNome: 'Caio Soares (falso)' }) });
  const [b] = await notifs(db, 'bia');
  assert.match(b.sub, /^Ana Lima · /);
});
