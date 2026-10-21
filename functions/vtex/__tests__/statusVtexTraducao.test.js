// functions/vtex/__tests__/statusVtexTraducao.test.js — tradução (inglês → português) dos avisos da VTEX: traduzir.js (Google Cloud Translation, com fetch falso)
// e a integração em statusVtex.js (Comunicado em português + "Ver original em inglês", sino/push e selinho em português, cache, falha → inglês, interruptor).
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { _test: V } = require('../statusVtex');
const T = require('../traduzir');

const AGORA = Date.parse('2026-10-13T20:16:00Z');
const item = (o) => `<item><title><![CDATA[${o.titulo}]]></title><link>https://status.vtex.com//incidents/${o.id}</link><guid>https://status.vtex.com//incidents/${o.id}</guid><pubDate>Tue, 13 Oct 2026 20:00:00 GMT</pubDate><description><![CDATA[<b>Status: ${o.estado}</b><br/><br/>${o.texto}<br/><br/><b>Affected components</b><ul><li>Checkout (Partial outage)</li></ul>]]></description></item>`;
const rss = (...i) => `<?xml version="1.0"?><rss version="2.0"><channel><title>VTEX status</title>${i.join('')}</channel></rss>`;
const novoDb = (extra) => makeFakeDb({ kanban: Object.assign({ usuarios_publicos: { ana: { role: 'membro' }, adm: { role: 'adm' } } }, extra || {}) });
const com = async (db, id) => (await db.ref(`kanban/comunicados/${id}`).get()).val();
const itens = (o) => V.parseFeed(rss(item(o)));
const INC = { id: 'INC9', titulo: 'Checkout errors for some stores', estado: 'Investigating', texto: 'We are investigating errors on Checkout for some stores.' };

// Tradutor de mentira: prefixa "PT:" e conta as chamadas.
const falso = () => { const f = async (txt) => { f.chamadas++; return txt.map((t) => 'PT: ' + t); }; f.chamadas = 0; return f; };

test('traduzir.js: protege termos de produto, pede inglês→português em html e devolve texto puro', async () => {
  const visto = {};
  const fetchImpl = async (url, opts) => {
    visto.url = url; visto.opts = opts; visto.corpo = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ data: { translations: visto.corpo.q.map((h) => ({ translatedText: h.replace(/We are investigating/, 'Estamos investigando').replace('errors on', 'erros no').replace('&#39;', "'") })) } }) };
  };
  const out = await T.traduzirEnPt(['We are investigating errors on Checkout & VTEX IO <b>x</b>'], { fetchImpl, token: 'TOKEN' });
  assert.equal(visto.url, 'https://translation.googleapis.com/language/translate/v2');
  assert.equal(visto.opts.headers.authorization, 'Bearer TOKEN');
  assert.equal(visto.corpo.source, 'en'); assert.equal(visto.corpo.target, 'pt'); assert.equal(visto.corpo.format, 'html');
  assert.match(visto.corpo.q[0], /<span translate="no">Checkout<\/span>/);
  assert.match(visto.corpo.q[0], /<span translate="no">VTEX IO<\/span>/, '"VTEX IO" inteiro, não "VTEX" + "IO"');
  assert.ok(!/<b>x<\/b>/.test(visto.corpo.q[0]), 'HTML do feed é escapado antes de ir pro Google');
  assert.equal(out[0], 'Estamos investigando erros no Checkout & VTEX IO <b>x</b>', 'spans somem e as entidades voltam a texto puro');
});

test('traduzir.js: erro HTTP, número errado de textos e lista vazia', async () => {
  await assert.rejects(() => T.traduzirEnPt(['a'], { token: 't', fetchImpl: async () => ({ ok: false, status: 403, text: async () => 'API not enabled' }) }), /HTTP 403 API not enabled/);
  await assert.rejects(() => T.traduzirEnPt(['a', 'b'], { token: 't', fetchImpl: async () => ({ ok: true, json: async () => ({ data: { translations: [{ translatedText: 'x' }] } }) }) }), /1 de 2/);
  assert.deepEqual(await T.traduzirEnPt([], { token: 't' }), []);
});

test('incidente aberto: Comunicado, sino e selinho em português; o original em inglês fica num "Ver original"', async () => {
  const db = novoDb(); const traduzir = falso();
  const r = await V.processar({ db, itens: itens(INC), agora: AGORA, traduzir });
  assert.equal(r.criados, 1);
  const cc = await com(db, 'vtex_INC9');
  assert.equal(cc.titulo, '🚨 VTEX: PT: Checkout errors for some stores');
  assert.match(cc.corpo, /tradução automática; o original em inglês está logo abaixo/);
  assert.match(cc.corpo, /<p>PT: We are investigating errors on Checkout for some stores\.<\/p>/);
  assert.match(cc.corpo, /<details><summary>🇬🇧 Ver original em inglês<\/summary><p><b>Checkout errors for some stores<\/b><\/p><p>We are investigating errors on Checkout for some stores\.<\/p><\/details>/);
  assert.match(cc.corpo, /<li>Checkout <i>\(indisponibilidade parcial\)<\/i><\/li>/, 'nome do componente não é traduzido; o estado, sim');
  assert.match(cc.corpo, /status\.vtex\.com\/incidents\/INC9/);
  const n = Object.values((await db.ref('kanban/usuarios/ana/notificacoes').get()).val())[0];
  assert.equal(n.title, '🚨 VTEX: PT: Checkout errors for some stores');
  assert.deepEqual(r.incidentes.map((i) => i.titulo), ['PT: Checkout errors for some stores'], 'selinho do Oceano');
  assert.equal(traduzir.chamadas, 1, 'título e resumo vão juntos numa só chamada');
});

test('cache: texto igual não chama o Google de novo; texto novo (atualização da VTEX) traduz de novo', async () => {
  const db = novoDb(); const traduzir = falso();
  await V.processar({ db, itens: itens(INC), agora: AGORA, traduzir });
  await V.processar({ db, itens: itens(INC), agora: AGORA + 5 * 60000, traduzir });
  await V.processar({ db, itens: itens(INC), agora: AGORA + 10 * 60000, traduzir });
  assert.equal(traduzir.chamadas, 1, '3 ticks, 1 tradução');
  const est = (await db.ref('kanban/vtex_status/INC9').get()).val();
  assert.ok(est.trad && est.trad.h && est.trad.titulo === 'PT: Checkout errors for some stores');
  await V.processar({ db, itens: itens(Object.assign({}, INC, { estado: 'Identified', texto: 'We identified the cause and are applying a fix.' })), agora: AGORA + 15 * 60000, traduzir });
  assert.equal(traduzir.chamadas, 2);
  assert.match((await com(db, 'vtex_INC9')).corpo, /PT: We identified the cause/);
});

test('tradução falhou (API desligada, permissão, rede): o aviso sai em inglês, como antes — e traduz quando voltar', async () => {
  const db = novoDb(); let falha = true; let n = 0;
  const traduzir = async (t) => { n++; if (falha) throw new Error('HTTP 403 API not enabled'); return t.map((x) => 'PT: ' + x); };
  const r = await V.processar({ db, itens: itens(INC), agora: AGORA, traduzir });
  assert.equal(r.criados, 1, 'o alerta NÃO espera tradução');
  const cc = await com(db, 'vtex_INC9');
  assert.equal(cc.titulo, '🚨 VTEX: Checkout errors for some stores');
  assert.match(cc.corpo, /texto original em inglês/); assert.ok(!/<details>/.test(cc.corpo));
  assert.equal((await db.ref('kanban/vtex_status/INC9/trad').get()).val(), null, 'falha não vai pro cache');
  falha = false;
  await V.processar({ db, itens: itens(INC), agora: AGORA + 5 * 60000, traduzir });
  assert.match((await com(db, 'vtex_INC9')).titulo, /PT: Checkout errors/);
  assert.equal(n, 2);
});

test('interruptor kanban/config/vtex_traducao_off: não chama o Google, aviso em inglês', async () => {
  const db = novoDb({ config: { vtex_traducao_off: true } }); const traduzir = falso();
  await V.processar({ db, itens: itens(INC), agora: AGORA, traduzir });
  assert.equal(traduzir.chamadas, 0);
  assert.equal((await com(db, 'vtex_INC9')).titulo, '🚨 VTEX: Checkout errors for some stores');
});

test('manutenção agendada: "Maintenance:" vira "manutenção —" e só o resto do título é traduzido', async () => {
  const db = novoDb(); const traduzir = falso();
  const it = V.parseFeed(rss(item({ id: 'M1', titulo: 'Maintenance: Scheduled database upgrade', estado: 'In progress', texto: 'Planned work on the database.' })));
  await V.processar({ db, itens: it, agora: AGORA, traduzir });
  assert.equal((await com(db, 'vtex_M1')).titulo, '🚨 VTEX: manutenção — PT: Scheduled database upgrade');
});

test('texto da VTEX com HTML/script continua escapado (original e tradução)', async () => {
  const db = novoDb();
  const traduzir = async () => ['<img src=x onerror=alert(1)>', 'x <script>alert(1)</script>'];
  await V.processar({ db, itens: itens(Object.assign({}, INC, { texto: 'a &lt;b&gt; b' })), agora: AGORA, traduzir });
  const cc = await com(db, 'vtex_INC9');
  assert.ok(!/<script|<img/i.test(cc.corpo), cc.corpo);
});

// ── Ajustes de 21/10: horário em Brasília, estado do componente em português, corte na última frase completa ──
const REAL = 'Scheduled for Oct 21, 2026 at 01:00 - 03:00 UTC\nWe will work on improvements to our platform that require controlled interruptions in Marketplace Connectors. As we upgrade the database supporting our Shopee integration, some stores might experience brief periods of interruption. ';

test('horarioBrasilia: UTC → Brasília (−3h), inclusive virando o dia, com data final e sem horário', () => {
  const h = V.horarioBrasilia;
  assert.equal(h('Scheduled for Oct 21, 2026 at 01:00 - 03:00 UTC'), 'de 20/10 às 22:00 até 21/10 às 00:00', 'o caso real: 01–03 UTC = 22h–00h do dia anterior');
  assert.equal(h('Scheduled for Oct 21, 2026 at 13:00 - 15:30 UTC'), '21/10, das 10:00 às 12:30');
  assert.equal(h('Scheduled for Dec 31, 2026 at 23:00 - 01:00 UTC'), '31/12, das 20:00 às 22:00', 'fim menor que o início = termina no dia seguinte (UTC)');
  assert.equal(h('from Oct 21, 2026 at 22:00 - Oct 22, 2026 at 02:00 UTC'), '21/10, das 19:00 às 23:00', 'com data no fim (cruza a meia-noite em UTC, não em Brasília)');
  assert.equal(h('We are investigating errors on Checkout.'), '', 'sem horário em UTC: não inventa');
  assert.equal(h('Oct 21, 2026 at 25:00 - 03:00 UTC'), '', 'hora inválida: ignora');
});

test('compEstadoPt: estados conhecidos viram português e os desconhecidos ficam como vieram', () => {
  assert.equal(V.compEstadoPt('Under maintenance'), 'em manutenção');
  assert.equal(V.compEstadoPt(' Partial Outage '), 'indisponibilidade parcial');
  assert.equal(V.compEstadoPt('Something new'), 'Something new');
});

test('resumoDe: texto longo corta na última frase completa (sem "…"); sem frase aproveitável, corta por palavra com "…"', () => {
  const frases = Array.from({ length: 30 }, (_, i) => `Esta é a frase número ${i} do aviso.`).join(' ');
  const r = V.resumoDe({ corpoTexto: frases });
  assert.ok(r.length <= 700 && r.endsWith('.') && !r.endsWith('…'), r.slice(-40));
  assert.ok(frases.startsWith(r), 'é um prefixo do original');
  const semFrase = V.resumoDe({ corpoTexto: 'palavra '.repeat(200) });
  assert.ok(semFrase.endsWith('…') && semFrase.length <= 701, 'sem pontuação: corte por palavra');
  assert.equal(V.resumoDe({ corpoTexto: 'curto.' }), 'curto.');
  assert.equal(V.resumoCortado({ corpoTexto: frases }), true); assert.equal(V.resumoCortado({ corpoTexto: 'curto.' }), false);
});

test('Comunicado: linha "Horário de Brasília" (traduzido e em inglês), estado do componente em português e link "aviso completo" só quando cortou', async () => {
  const longo = REAL + 'Detalhe adicional importante do aviso. '.repeat(30);
  const mk = (corpoTexto, extra) => Object.assign({ guid: 'https://status.vtex.com//incidents/X1', titulo: 'Maintenance: Marketplace Connectors maintenance', estado: 'Scheduled', manutencao: true, link: 'https://status.vtex.com//incidents/X1', corpoTexto, componentes: [{ nome: 'Marketplace Connectors', estado: 'Under maintenance' }] }, extra || {});
  const comTrad = V.comunicadoDe(mk(REAL), 'agendado', AGORA, null, { titulo: 'Manutenção', resumo: 'Texto em português.' }).corpo;
  assert.match(comTrad, /🕒 <b>Horário de Brasília:<\/b> de 20\/10 às 22:00 até 21\/10 às 00:00/);
  assert.match(comTrad, /Marketplace Connectors <i>\(em manutenção\)<\/i>/);
  assert.match(comTrad, /Ver na página de status da VTEX/); assert.ok(!/aviso completo/.test(comTrad));
  assert.ok(comTrad.indexOf('Horário de Brasília') < comTrad.indexOf('Texto em português'), 'o horário vem antes do texto');
  assert.ok(!/Horário de Brasília[\s\S]*<details>[\s\S]*Horário de Brasília/.test(comTrad), 'só uma vez (não duplica dentro do original)');
  const semTrad = V.comunicadoDe(mk(REAL), 'agendado', AGORA, null, null).corpo;
  assert.match(semTrad, /Horário de Brasília/, 'no fallback em inglês também');
  const cortado = V.comunicadoDe(mk(longo), 'agendado', AGORA, null, { titulo: 'M', resumo: 'R' }).corpo;
  assert.match(cortado, /Ver o aviso completo na página de status da VTEX/);
  const sem = V.comunicadoDe(mk('We are investigating errors.', { componentes: [] }), 'aberto', AGORA, null, null).corpo;
  assert.ok(!/Horário de Brasília/.test(sem), 'sem horário em UTC, sem linha');
});
