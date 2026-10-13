// functions/vtex/__tests__/statusVtex.test.js
//
// 🚨 Alerta automático de incidente da VTEX (functions/vtex/statusVtex.js): parser do RSS REAL do incident.io (feed-real.rss, colado em 13/10/2026),
// fases (aberto · agendado · final), 1ª execução sem criar nada pro histórico, criar/renovar/fechar o Comunicado, push/sino uma vez só,
// respeito ao ADM que apaga/desativa, texto escapado, interruptor geral e feed vazio/quebrado.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { _test: V } = require('../statusVtex');

const FEED = fs.readFileSync(path.join(__dirname, 'feed-real.rss'), 'utf8');
const AGORA = Date.parse('2026-10-13T20:16:00Z');
const item = (o) => `<item><title><![CDATA[${o.titulo}]]></title><link>https://status.vtex.com//incidents/${o.id}</link><guid>https://status.vtex.com//incidents/${o.id}</guid><pubDate>${o.pub || 'Tue, 13 Oct 2026 20:00:00 GMT'}</pubDate><description><![CDATA[<b>Status: ${o.estado}</b><br/><br/>${o.texto || 'Estamos investigando.'}<br/><br/><b>Affected components</b><ul><li>Checkout (${o.comp || 'Partial outage'})</li><li>Order Placement (Degraded performance)</li></ul>]]></description></item>`;
const rss = (...itens) => `<?xml version="1.0"?><rss version="2.0"><channel><title>VTEX status</title>${itens.join('')}</channel></rss>`;
const pubs = () => ({ ana: { role: 'membro' }, bia: { role: 'po' }, adm: { role: 'adm' }, ext: { role: 'convidado' }, vis: { role: 'visualizador' } });
const novoDb = (extra) => makeFakeDb({ kanban: Object.assign({ usuarios_publicos: pubs() }, extra || {}) });
const notifs = async (db, uid) => Object.values((await db.ref(`kanban/usuarios/${uid}/notificacoes`).get()).val() || {});
const com = async (db, id) => (await db.ref(`kanban/comunicados/${id}`).get()).val();

test('parseFeed: lê o feed real (8 campos, componentes, mojibake, link sem barra dupla)', () => {
  const it = V.parseFeed(FEED);
  assert.equal(it.length, 4);
  assert.deepEqual(it.map((i) => i.estado), ['Complete', 'Resolved', 'Complete', 'Resolved']);
  assert.equal(it[0].guid, 'https://status.vtex.com//incidents/01M4G417EF2PAHWNF23R2RD701');
  assert.equal(it[0].link, 'https://status.vtex.com/incidents/01M4G417EF2PAHWNF23R2RD701');
  assert.equal(it[0].manutencao, true);
  assert.equal(it[1].manutencao, false);
  assert.equal(it[2].titulo, 'Maintenance: Scheduled Maintenance – Session');     // â€“ → –
  assert.deepEqual(it[2].componentes.map((c) => c.nome), ['FastStore', 'Order Placement', 'Admin Operations']);
  assert.deepEqual(it[1].componentes, [{ nome: 'Admin Operations', estado: 'Operational' }]);
  assert.match(it[1].corpoTexto, /^This incident has been resolved/);
  assert.ok(!/Affected components|<b>|Status:/.test(it[1].corpoTexto));
  assert.ok(!/Â/.test(it[3].corpoTexto));                                              // "Â " some
  assert.equal(it[1].publicadoEm, Date.parse('2026-09-25T16:18:48Z'));
});

test('chaveDe: usa só o id final do incidente, sem caracteres proibidos no Firebase', () => {
  assert.equal(V.chaveDe('https://status.vtex.com//incidents/01M4G417EF2PAHWNF23R2RD701'), '01M4G417EF2PAHWNF23R2RD701');
  assert.equal(V.chaveDe('a.b#c$d[e]'), 'a_b_c_d_e_');
});

test('parseFeed: feed vazio, lixo e item sem guid não quebram', () => {
  assert.deepEqual(V.parseFeed(''), []);
  assert.deepEqual(V.parseFeed(null), []);
  assert.deepEqual(V.parseFeed('<html>502 Bad Gateway</html>'), []);
  assert.deepEqual(V.parseFeed('<rss><channel><item><title>x</title></item></channel></rss>'), []);
});

test('faseDe: final · agendado · aberto (inclui estados novos desconhecidos)', () => {
  const f = (estado) => V.faseDe({ estado });
  ['Resolved', 'Complete', 'Completed', 'Cancelled', 'resolvido', 'Concluída'].forEach((e) => assert.equal(f(e), 'final', e));
  ['Scheduled', 'Planned', 'Upcoming'].forEach((e) => assert.equal(f(e), 'agendado', e));
  ['Investigating', 'Identified', 'Monitoring', 'In progress', 'Degraded', 'Algo novo'].forEach((e) => assert.equal(f(e), 'aberto', e));
});

test('1ª execução com o feed real (só histórico encerrado): não cria NADA', async () => {
  const db = novoDb();
  const r = await V.processar({ db, itens: V.parseFeed(FEED), agora: AGORA });
  assert.equal(r.criados, 0); assert.equal(r.notificados, 0);
  assert.equal((await db.ref('kanban/comunicados').get()).val(), null);
  assert.equal((await db.ref('kanban/vtex_status').get()).val(), null);
});

test('incidente aberto: cria o Comunicado 🚨 (popup insistente, todos) + notifica todo mundo menos convidado/visualizador, uma vez só', async () => {
  const db = novoDb();
  const itens = V.parseFeed(rss(item({ id: 'INC1', titulo: 'Checkout errors', estado: 'Investigating' })));
  const r = await V.processar({ db, itens, agora: AGORA });
  assert.deepEqual([r.criados, r.notificados], [1, 3]);
  const id = Object.keys((await db.ref('kanban/comunicados').get()).val())[0];
  const cc = await com(db, id);
  assert.equal(id, 'vtex_INC1');
  assert.equal(Object.keys((await db.ref('kanban/vtex_status').get()).val())[0], 'INC1');
  assert.ok(!/[.#$/\[\]]/.test(id));
  assert.equal(cc.tipo, 'urgente'); assert.equal(cc.prioridade, 'popup'); assert.equal(cc.insistente, true); assert.equal(cc.squad, '*');
  assert.equal(cc.publico, 'todos'); assert.equal(cc.ativo, true); assert.equal(cc.rascunho, false); assert.equal(cc.origem, 'vtex_status');
  assert.match(cc.titulo, /^🚨 VTEX: Checkout errors/);
  assert.match(cc.corpo, /Situação: Investigando/); assert.match(cc.corpo, /Checkout/); assert.match(cc.corpo, /status\.vtex\.com\/incidents\/INC1/);
  assert.equal(cc.expiraEm, new Date(AGORA + 3 * 3600 * 1000).toISOString());
  const nAna = await notifs(db, 'ana');
  assert.equal(nAna.length, 1); assert.equal(nAna[0].type, 'vtex_incidente'); assert.equal(nAna[0].read, false); assert.equal(nAna[0].comunicadoId, id);
  assert.equal((await notifs(db, 'ext')).length, 0); assert.equal((await notifs(db, 'vis')).length, 0);
  assert.equal((await notifs(db, 'adm')).length, 1);
  // 2º tick, mesmo estado: renova a validade, NÃO duplica aviso
  const r2 = await V.processar({ db, itens, agora: AGORA + 5 * 60000 });
  assert.deepEqual([r2.criados, r2.atualizados, r2.notificados], [0, 1, 0]);
  assert.equal((await notifs(db, 'ana')).length, 1);
  assert.equal((await com(db, id)).expiraEm, new Date(AGORA + 5 * 60000 + 3 * 3600 * 1000).toISOString());
});

test('atualização da VTEX (Investigating → Monitoring) edita o MESMO aviso, sem novo push', async () => {
  const db = novoDb();
  await V.processar({ db, itens: V.parseFeed(rss(item({ id: 'INC2', titulo: 'API slow', estado: 'Investigating' }))), agora: AGORA });
  const r = await V.processar({ db, itens: V.parseFeed(rss(item({ id: 'INC2', titulo: 'API slow', estado: 'Monitoring', texto: 'Aplicamos a correção.' }))), agora: AGORA + 600000 });
  assert.deepEqual([r.criados, r.atualizados, r.notificados], [0, 1, 0]);
  const todos = (await db.ref('kanban/comunicados').get()).val();
  assert.equal(Object.keys(todos).length, 1);
  assert.match(Object.values(todos)[0].corpo, /Monitorando/); assert.match(Object.values(todos)[0].corpo, /Aplicamos a correção/);
});

test('resolvido: desativa o Comunicado e marca o estado como fechado; tick seguinte não mexe mais', async () => {
  const db = novoDb();
  await V.processar({ db, itens: V.parseFeed(rss(item({ id: 'INC3', titulo: 'Payments down', estado: 'Identified' }))), agora: AGORA });
  const id = Object.keys((await db.ref('kanban/comunicados').get()).val())[0];
  const r = await V.processar({ db, itens: V.parseFeed(rss(item({ id: 'INC3', titulo: 'Payments down', estado: 'Resolved' }))), agora: AGORA + 1800000 });
  assert.equal(r.fechados, 1);
  assert.equal((await com(db, id)).ativo, false);
  const est = (await db.ref('kanban/vtex_status').get()).val();
  assert.equal(Object.values(est)[0].fechado, true);
  const r2 = await V.processar({ db, itens: V.parseFeed(rss(item({ id: 'INC3', titulo: 'Payments down', estado: 'Resolved' }))), agora: AGORA + 2100000 });
  assert.deepEqual([r2.fechados, r2.criados, r2.atualizados], [0, 0, 0]);
});

test('manutenção só AGENDADA: aviso comum (⚠️, sem insistir, sem push); quando começa (In progress) vira alerta + push uma vez', async () => {
  const db = novoDb();
  const ag = rss(item({ id: 'MNT1', titulo: 'Maintenance: Catalog database', estado: 'Scheduled', pub: 'Wed, 14 Oct 2026 03:00:00 GMT', comp: 'Operational' }));
  const r = await V.processar({ db, itens: V.parseFeed(ag), agora: AGORA });
  assert.deepEqual([r.criados, r.notificados], [1, 0]);
  const id = Object.keys((await db.ref('kanban/comunicados').get()).val())[0];
  let c = await com(db, id);
  assert.equal(c.tipo, 'aviso'); assert.equal(c.insistente, false); assert.match(c.titulo, /^🛠️ VTEX: manutenção — Catalog database/);
  assert.equal((await notifs(db, 'ana')).length, 0);
  const r2 = await V.processar({ db, itens: V.parseFeed(rss(item({ id: 'MNT1', titulo: 'Maintenance: Catalog database', estado: 'In progress', pub: 'Wed, 14 Oct 2026 03:00:00 GMT' }))), agora: Date.parse('2026-10-14T03:05:00Z') });
  assert.deepEqual([r2.atualizados, r2.notificados], [1, 3]);
  c = await com(db, id);
  assert.equal(c.tipo, 'urgente'); assert.equal(c.insistente, true);
});

test('item aberto velho demais (> 7 dias) é ignorado', async () => {
  const db = novoDb();
  const r = await V.processar({ db, itens: V.parseFeed(rss(item({ id: 'OLD', titulo: 'Zumbi', estado: 'Investigating', pub: 'Mon, 01 Sep 2026 10:00:00 GMT' }))), agora: AGORA });
  assert.deepEqual([r.criados, r.ignorados], [0, 1]);
});

test('ADM apagou ou desativou o aviso: a função respeita (não recria, não reativa, não reenvia push)', async () => {
  const itens = V.parseFeed(rss(item({ id: 'INC4', titulo: 'Search errors', estado: 'Investigating' })));
  // apagado
  let db = novoDb();
  await V.processar({ db, itens, agora: AGORA });
  const id = Object.keys((await db.ref('kanban/comunicados').get()).val())[0];
  await db.ref(`kanban/comunicados/${id}`).set(null);
  let r = await V.processar({ db, itens, agora: AGORA + 300000 });
  assert.deepEqual([r.criados, r.notificados], [0, 0]);
  assert.equal(await com(db, id), null);
  // desativado
  db = novoDb();
  await V.processar({ db, itens, agora: AGORA });
  await db.ref(`kanban/comunicados/${id}`).update({ ativo: false });
  r = await V.processar({ db, itens, agora: AGORA + 300000 });
  assert.equal(r.atualizados, 0);
  assert.equal((await com(db, id)).ativo, false);
});

test('título/texto da VTEX com HTML não vira HTML no Comunicado (escapado)', () => {
  const [i] = V.parseFeed(rss(item({ id: 'X', titulo: 'Bad <script>alert(1)</script> & "co"', estado: 'Investigating', texto: 'a &lt;img src=x onerror=alert(1)&gt; b' })));
  const c = V.comunicadoDe(i, 'aberto', AGORA, null);
  assert.ok(!/<script|<img/i.test(c.corpo));
  assert.ok(!/<script/i.test(c.titulo) || /&lt;|\\u003c|</.test(c.titulo));   // título é texto puro: o cliente o renderiza com escape
  assert.match(c.corpo, /&lt;img/);
});

test('rodar: interruptor geral, feed vazio e erro HTTP', async () => {
  const resp = (corpo, ok = true, status = 200) => async () => ({ ok, status, text: async () => corpo });
  let db = novoDb({ config: { vtex_status_off: true } });
  assert.deepEqual(await V.rodar({ db, fetchImpl: resp(rss(item({ id: 'A', titulo: 't', estado: 'Investigating' }))), agora: AGORA }), { desligado: true });
  assert.equal((await db.ref('kanban/comunicados').get()).val(), null);

  db = novoDb();
  const avisos = [];
  const r = await V.rodar({ db, fetchImpl: resp('<html>erro</html>'), agora: AGORA, log: { warn: (m) => avisos.push(m) } });
  assert.equal(r.itens, 0); assert.equal(avisos.length, 1);
  await assert.rejects(() => V.rodar({ db, fetchImpl: resp('', false, 503), agora: AGORA }), /HTTP 503/);

  const r2 = await V.rodar({ db, fetchImpl: resp(rss(item({ id: 'B', titulo: 'Real', estado: 'Investigating' }))), agora: AGORA });
  assert.equal(r2.itens, 1); assert.equal(r2.criados, 1);
});

// ── saúde do monitor (kanban/vtex_saude) e aviso aos ADMs quando o feed falha ──
const resp = (corpo, ok = true, status = 200) => async () => ({ ok, status, text: async () => corpo });
const saude = async (db) => (await db.ref('kanban/vtex_saude').get()).val();

test('executar: feed ok sem incidente → saúde ok, 0 abertos', async () => {
  const db = novoDb();
  await V.executar({ db, fetchImpl: resp(FEED), agora: AGORA });
  const s = await saude(db);
  assert.equal(s.ok, true); assert.equal(s.abertos, 0); assert.equal(s.falhasSeguidas, 0); assert.equal(s.ultimoOkEm, new Date(AGORA).toISOString());
});

test('executar: incidente aberto → saúde lista o incidente (título, link, estado)', async () => {
  const db = novoDb();
  await V.executar({ db, fetchImpl: resp(rss(item({ id: 'S1', titulo: 'Payments degraded', estado: 'Identified' }))), agora: AGORA });
  const s = await saude(db);
  assert.equal(s.abertos, 1);
  assert.deepEqual(s.incidentes, [{ titulo: 'Payments degraded', link: 'https://status.vtex.com/incidents/S1', estado: 'Identified' }]);
});

test('executar: falha do feed conta, preserva o último ok e só avisa os ADMs ao atingir o limite (uma vez por queda)', async () => {
  const db = novoDb();
  await V.executar({ db, fetchImpl: resp(FEED), agora: AGORA });
  for (let i = 1; i < V.LIMITE_FALHAS; i++) {
    await assert.rejects(() => V.executar({ db, fetchImpl: resp('', false, 503), agora: AGORA + i * 300000 }), /HTTP 503/);
    const s = await saude(db);
    assert.equal(s.ok, false); assert.equal(s.falhasSeguidas, i); assert.equal(s.ultimoOkEm, new Date(AGORA).toISOString());
    assert.equal((await notifs(db, 'adm')).length, 0, 'ainda não avisa com ' + i + ' falhas');
  }
  await assert.rejects(() => V.executar({ db, fetchImpl: resp('', false, 503), agora: AGORA + V.LIMITE_FALHAS * 300000 }), /HTTP 503/);
  const n = await notifs(db, 'adm');
  assert.equal(n.length, 1); assert.equal(n[0].type, 'vtex_monitor_falhou'); assert.match(n[0].sub, /HTTP 503/);
  assert.equal((await notifs(db, 'ana')).length, 0);                       // só ADM
  // continua falhando: não repete o aviso
  await assert.rejects(() => V.executar({ db, fetchImpl: resp('', false, 503), agora: AGORA + (V.LIMITE_FALHAS + 1) * 300000 }));
  assert.equal((await notifs(db, 'adm')).length, 1);
  // volta a funcionar: zera o contador e libera um novo aviso numa próxima queda
  await V.executar({ db, fetchImpl: resp(FEED), agora: AGORA + (V.LIMITE_FALHAS + 2) * 300000 });
  const s = await saude(db);
  assert.equal(s.ok, true); assert.equal(s.falhasSeguidas, 0); assert.equal(s.avisadoEm, undefined);
});

test('executar: feed que "responde" mas sem item (formato mudou) também é falha', async () => {
  const db = novoDb();
  await assert.rejects(() => V.executar({ db, fetchImpl: resp('<html>nova página</html>'), agora: AGORA, log: { warn() {} } }), /sem nenhum item/);
  const s = await saude(db);
  assert.equal(s.ok, false); assert.equal(s.falhasSeguidas, 1);
});

test('executar: interruptor desligado grava saúde "desligado" (selinho some)', async () => {
  const db = novoDb({ config: { vtex_status_off: true } });
  await V.executar({ db, fetchImpl: resp(FEED), agora: AGORA });
  const s = await saude(db);
  assert.equal(s.desligado, true); assert.equal(s.ok, undefined);
});
