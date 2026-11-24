// functions/oceano/__tests__/conchaGif.test.js — 🐚 GIF na Concha (núcleo + invólucro com Firebase falso)
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../conchaGifCore');
const { _tratar } = require('../conchaGif');

const CHAVE = 'CHAVEsecreta_1234567890';
const arq = (url, w, h, size) => ({ url, width: w, height: h, size });
const item = (id, o) => Object.assign({ id, slug: 's' + id, title: 'Oi ' + id, type: 'gif', file: {
  hd: { gif: arq(`https://static.klipy.com/ii/a/${id}/hd.gif`, 498, 280, 3e6), webp: arq(`https://static.klipy.com/ii/a/${id}/hd.webp`, 498, 280, 900000), jpg: arq(`https://static.klipy.com/ii/a/${id}/hd.jpg`, 498, 280, 50000) },
  md: { gif: arq(`https://static.klipy.com/ii/a/${id}/md.gif`, 320, 180, 1.2e6), webp: arq(`https://static.klipy.com/ii/a/${id}/md.webp`, 320, 180, 400000), jpg: arq(`https://static.klipy.com/ii/a/${id}/md.jpg`, 320, 180, 20000) },
  sm: { gif: arq(`https://static2.klipy.com/ii/a/${id}/sm.gif`, 220, 124, 500000), webp: arq(`https://static2.klipy.com/ii/a/${id}/sm.webp`, 220, 124, 150000) },
  xs: { webp: arq(`https://static1.klipy.com/ii/a/${id}/xs.webp`, 120, 68, 40000) },
} }, o || {});
const resposta = itens => ({ result: true, data: { data: itens, current_page: 1, per_page: 24, has_next: true } });

test('normaliza: webp mais leve na faixa de 200–400 px, prévia pequena, quadro parado jpg; descarta anúncio e host de fora', () => {
  const r = core.normalizar(resposta([
    item(1),
    item(2, { type: 'ad' }),
    item(3, { file: { md: { gif: arq('https://evil.example/x.gif', 320, 180, 1000) } } }),
    item(4, { file: { md: { gif: arq('https://static.klipy.com/ii/x.gif', 320, 180, 9e6) } } }),   // pesado demais
    item('5"><img', {}),
  ]));
  assert.equal(r.temMais, true);
  assert.deepEqual(r.itens.map(i => i.id), ['1']);
  const i = r.itens[0];
  assert.equal(i.u, 'https://static2.klipy.com/ii/a/1/sm.webp', 'animação: a mais leve entre 200 e 400 px');
  assert.equal(i.p, 'https://static1.klipy.com/ii/a/1/xs.webp', 'prévia: pequena');
  assert.equal(i.s, 'https://static.klipy.com/ii/a/1/md.jpg', 'quadro parado');
  assert.equal(i.t, 'Oi 1'); assert.equal(i.w, 220); assert.equal(i.h, 124);
  for (const x of [i.u, i.p, i.s]) assert.match(x, core.HOST_RE);
  assert.deepEqual(core.normalizar(null), { itens: [], temMais: false });
  assert.deepEqual(core.normalizar({ data: { data: 'x' } }).itens, []);
});

test('URL da KLIPY: busca ou em alta, parâmetros fixos, sem dado da pessoa; entrada validada', () => {
  const u = new URL(core.urlKlipy(CHAVE, 'bom dia & tchau', 2));
  assert.equal(u.origin + u.pathname, 'https://api.klipy.com/api/v1/' + CHAVE + '/gifs/search');
  assert.equal(u.searchParams.get('q'), 'bom dia & tchau');
  assert.equal(u.searchParams.get('content_filter'), 'high');
  assert.equal(u.searchParams.get('page'), '2');
  assert.equal(u.searchParams.get('customer_id'), null, 'nenhum id de pessoa');
  assert.match(core.urlKlipy(CHAVE, '', 1), /\/gifs\/trending\?/);
  assert.throws(() => core.urlKlipy('', 'x', 1), e => e.codigo === 'chave_ausente');
  assert.throws(() => core.urlKlipy('../x', 'x', 1), e => e.codigo === 'chave_ausente');
  assert.equal(core.normalizarBusca('  Bom   DIA '), 'bom dia');
  assert.equal(core.normalizarBusca(''), '');
  assert.throws(() => core.normalizarBusca('a'), e => e.codigo === 'busca_invalida');
  assert.throws(() => core.normalizarBusca('x'.repeat(51)), e => e.codigo === 'busca_invalida');
  assert.equal(core.normalizarPagina(undefined), 1);
  for (const p of ['0', '6', '1.5', 'abc']) assert.throws(() => core.normalizarPagina(p), e => e.codigo === 'pagina_invalida');
});

test('contador por hora: conta até o limite, zera na hora seguinte', () => {
  const h = '2026112410';
  assert.deepEqual(core.contar(null, h, 2), { h, n: 1 });
  assert.deepEqual(core.contar({ h, n: 1 }, h, 2), { h, n: 2 });
  assert.equal(core.contar({ h, n: 2 }, h, 2), undefined, 'estourou: aborta a transação');
  assert.deepEqual(core.contar({ h: '2026112409', n: 99 }, h, 2), { h, n: 1 }, 'hora nova');
  assert.equal(core.horaChave(new Date('2026-11-24T10:59:00Z')), '2026112410');
});

test('a chave NUNCA sai: erro do fetch com a URL dentro vira código fixo', async () => {
  const erros = []; const orig = console.error; console.error = (...a) => erros.push(a.join(' '));
  try {
    await assert.rejects(core.chamarKlipy({ chave: CHAVE, q: 'oi', pagina: 1, fetchImpl: async url => { throw new Error('falhou ' + url); } }),
      e => e.codigo === 'klipy_falhou' && !String(e.message).includes(CHAVE) && !String(e.stack).includes(CHAVE));
    await assert.rejects(core.chamarKlipy({ chave: CHAVE, q: 'oi', pagina: 1, fetchImpl: async () => ({ ok: false, status: 429 }) }), e => e.codigo === 'klipy_cota');
    await assert.rejects(core.chamarKlipy({ chave: CHAVE, q: 'oi', pagina: 1, fetchImpl: async () => ({ ok: true, json: async () => { throw new Error('json ' + CHAVE); } }) }),
      e => e.codigo === 'klipy_resposta' && !String(e.message).includes(CHAVE));
  } finally { console.error = orig; }
  assert.ok(!erros.join('\n').includes(CHAVE));
});

// ── invólucro: Firebase falso ──
function fakeDb(estado) {
  const ler = c => c.split('/').reduce((a, k) => (a == null ? undefined : a[k]), estado);
  const gravar = (c, v) => { const ks = c.split('/'); let o = estado; ks.slice(0, -1).forEach(k => { o[k] = o[k] || {}; o = o[k]; }); o[ks[ks.length - 1]] = v; };
  return { ref: c => ({ get: async () => ({ val: () => ler(c) }), transaction: async fn => { const n = fn(ler(c)); if (n === undefined) return { committed: false }; gravar(c, n); return { committed: true }; } }) };
}
const tokenOk = { uid: 'ana', email: 'ana@ciahering.com.br', email_verified: true, firebase: { sign_in_provider: 'google.com' } };
function chamar({ q, p, token = 'tok', decoded = tokenOk, estado, fetchImpl, method = 'GET' }) {
  let status = 0, corpo = null;
  const req = { method, query: { q, p }, get: h => (h === 'Authorization' && token ? 'Bearer ' + token : undefined) };
  const res = { status(s) { status = s; return this; }, json(b) { corpo = b; return this; } };
  const auth = { verifyIdToken: async t => { if (t !== 'tok') throw new Error('inválido'); return decoded; } };
  return _tratar(req, res, { auth, db: fakeDb(estado), chave: CHAVE, fetch: fetchImpl }).then(() => ({ status, corpo }));
}
const membro = () => ({ kanban: { cardume: { meus: { ana: { dados: true } } } } });

test('invólucro: auth, membro da Concha, entrada, limites, cache e erro sem vazar', async () => {
  core._cache.clear();
  let chamadas = 0; const ok = async url => { chamadas++; assert.ok(url.includes(CHAVE)); return { ok: true, json: async () => resposta([item(7)]) }; };
  assert.equal((await chamar({ q: 'oi', token: null, estado: membro() })).status, 401, 'sem token');
  assert.equal((await chamar({ q: 'oi', token: 'xx', estado: membro() })).status, 401, 'token inválido');
  assert.equal((await chamar({ q: 'oi', decoded: Object.assign({}, tokenOk, { email: 'x@gmail.com' }), estado: membro() })).status, 403, 'fora da empresa');
  assert.equal((await chamar({ q: 'oi', decoded: Object.assign({}, tokenOk, { firebase: { sign_in_provider: 'password' } }), estado: membro() })).status, 403, 'sem Google');
  assert.equal((await chamar({ q: 'oi', estado: { kanban: { cardume: { meus: {} } } }, fetchImpl: ok })).corpo.erro, 'fora_da_concha');
  assert.equal((await chamar({ q: 'oi', method: 'POST', estado: membro() })).status, 405);
  assert.equal((await chamar({ q: 'a', estado: membro() })).status, 400, 'busca de 1 letra');
  const est = membro();
  const r1 = await chamar({ q: 'Oi', estado: est, fetchImpl: ok });
  assert.equal(r1.status, 200); assert.equal(r1.corpo.itens[0].id, '7'); assert.equal(chamadas, 1);
  const r2 = await chamar({ q: 'oi ', estado: est, fetchImpl: ok });
  assert.equal(r2.status, 200); assert.equal(chamadas, 1, 'cache: mesma busca não chama a KLIPY de novo');
  assert.equal(est.kanban.cardume.gif_uso._casa.n, 1, 'cache não conta no teto da casa');
  assert.equal(est.kanban.cardume.gif_uso.ana.n, 2, 'mas conta no limite da pessoa');
  est.kanban.cardume.gif_uso.ana.n = core.LIMITE_PESSOA_H;
  assert.equal((await chamar({ q: 'outra', estado: est, fetchImpl: ok })).corpo.erro, 'limite_pessoa');
  const est2 = membro(); est2.kanban.cardume.gif_uso = { _casa: { h: core.horaChave(), n: core.TETO_CASA_H } };
  assert.equal((await chamar({ q: 'nova busca', estado: est2, fetchImpl: ok })).corpo.erro, 'limite_casa');
  const erros = []; const orig = console.error; console.error = (...a) => erros.push(a.join(' '));
  let r3; try { r3 = await chamar({ q: 'vai falhar', estado: membro(), fetchImpl: async url => { throw new Error('caiu ' + url); } }); } finally { console.error = orig; }
  assert.equal(r3.status, 502); assert.deepEqual(r3.corpo, { erro: 'klipy_falhou' });
  assert.ok(!JSON.stringify(r3.corpo).includes(CHAVE) && !erros.join('\n').includes(CHAVE), 'a chave não aparece nem na resposta nem no log');
});
