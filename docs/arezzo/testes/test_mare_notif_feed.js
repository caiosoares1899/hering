// 🔔 mare-notif-dev.js — Feed da Torre: dispensar (✕), "Limpar lidas", TTL, evento endereçado a uma pessoa e título sem ícone duplicado. Sem navegador: carrega o módulo num `vm` com window/localStorage falsos.
//   node docs/arezzo/testes/test_mare_notif_feed.js
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'mare-notif-dev.js'), 'utf8');
function carregar({ feed, seen, uid = 'u1', email = 'a@ciahering.com.br', viewer = false }) {
  const gravado = []; const subs = {};
  const store = {}; const ls = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
  const ref = (_db, p) => ({ p }); const W = { MARE_SO_HERING: true, location: { pathname: '/kanban-dev.html', href: 'http://x/kanban-dev.html', origin: 'http://x' }, localStorage: ls, _db: {},
    _ref: ref, _query: (r) => r, _limitToLast: () => null, _orderByChild: () => null, _equalTo: () => null,
    _onValue: (r, cb) => { subs[r.p] = cb; return () => {}; }, _update: (r, v) => { gravado.push({ fn: 'update', p: r.p, v }); return Promise.resolve(); }, _set: (r, v) => { gravado.push({ fn: 'set', p: r.p, v }); return Promise.resolve(); },
    _get: () => Promise.resolve({ val: () => null, exists: () => false }), addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, matchMedia: () => ({ matches: false, addEventListener() {} }), setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, Event: function () {}, CustomEvent: function () {}, requestAnimationFrame: (f) => f() };
  const el = () => new Proxy(function () {}, { get: (_, k) => (k === 'style' || k === 'classList' || k === 'dataset' ? new Proxy({}, { get: () => () => {}, set: () => true }) : k === 'querySelector' || k === 'querySelectorAll' || k === 'appendChild' ? () => el() : () => el()), set: () => true, apply: () => el() });
  const doc = { readyState: 'complete', addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: () => el(), head: el(), body: el(), documentElement: el(), cookie: '', hidden: false };
  const ctx = vm.createContext(Object.assign(W, { window: W, document: doc, navigator: { userAgent: 'x' }, console, Date, JSON, Promise, Math, Object, Array, String, Number, Set, Map, URL, encodeURIComponent, decodeURIComponent, setTimeout, clearTimeout }));
  W.self = W; vm.runInContext(SRC, ctx, { filename: 'mare-notif-dev.js' });
  const N = W.MareNotif;
  N.start({ user: { uid, email, displayName: 'T' }, isViewer: viewer, isAdm: () => false });
  const F = (k) => Object.keys(subs).find(x => x.endsWith(k) || x === k);
  const feedKey = Object.keys(subs).find(k => /notif_feed$/.test(k)); const seenKey = Object.keys(subs).find(k => /notif_feed_seen\//.test(k));
  const cfgKey = Object.keys(subs).find(k => /notif_config$/.test(k)); if (cfgKey) subs[cfgKey]({ val: () => ({}) });   // a Central de Notificações já respondeu (sem interruptores = tudo no padrão)
  if (feedKey) subs[feedKey]({ val: () => feed });
  if (seenKey) subs[seenKey]({ val: () => seen });
  return { N, gravado, subs, store };
}
const agora = Date.now(), iso = (msAtras) => new Date(agora - msAtras).toISOString(), DIA = 86400000, H = 3600000;
const ev = (o) => Object.assign({ tipo: 'okr_editado', titulo: 'T', sub: 's', autor: 'X', autorUid: 'outro', torres: ['*'], ts: iso(H) }, o);
let ok = true; const t = (n, f) => { try { f(); console.log('✅ ' + n); } catch (e) { ok = false; console.log('❌ ' + n + ' → ' + e.message); } };
const seenBase = (extra) => Object.assign({ ts: iso(2 * DIA), lidos: {}, ocultos: {} }, extra || {});

t('dismiss: some do sino, grava lidos+ocultos no nó da pessoa e preserva o resto', () => {
  const { N, gravado } = carregar({ feed: { a: ev({ ts: iso(H) }), b: ev({ ts: iso(2 * H) }) }, seen: seenBase() });
  assert.strictEqual(N.items().length, 2); N.dismiss('a');
  assert.deepEqual(N.items().map(i => i.id), ['b']);
  const g = gravado.find(x => x.fn === 'update'); assert.ok(g && /notif_feed_seen\/u1$/.test(g.p)); assert.strictEqual(g.v['ocultos/a'], true); assert.strictEqual(g.v['lidos/a'], true);
});
t('clearRead: oculta só os lidos (numa escrita), devolve a quantidade e não mexe nos não lidos', () => {
  const { N, gravado } = carregar({ feed: { a: ev({ ts: iso(H) }), b: ev({ ts: iso(2 * H) }), c: ev({ ts: iso(3 * H) }) }, seen: seenBase({ lidos: { a: true, b: true } }) });
  const n = N.clearRead(); assert.strictEqual(n, 2); assert.deepEqual(N.items().map(i => i.id), ['c']);
  const w = gravado.filter(x => x.fn === 'update'); assert.strictEqual(w.length, 1); assert.deepEqual(Object.keys(w[0].v.ocultos).sort(), ['a', 'b']);
});
t('clearRead: nada lido → 0 e nenhuma escrita; sem seenReady → 0', () => {
  const { N, gravado } = carregar({ feed: { a: ev() }, seen: seenBase() }); assert.strictEqual(N.clearRead(), 0); assert.strictEqual(gravado.length, 0);
});
t('clearRead poda `ocultos` aos ids que ainda estão na janela do feed', () => {
  const { N, gravado } = carregar({ feed: { a: ev(), z: ev() }, seen: seenBase({ lidos: { a: true }, ocultos: { velho1: true, velho2: true } }) });
  N.clearRead(); const w = gravado.find(x => x.fn === 'update'); assert.deepEqual(Object.keys(w.v.ocultos).sort(), ['a']);
});
t('markAll preserva `ocultos` (o _set substitui o nó inteiro)', () => {
  const { N, gravado } = carregar({ feed: { a: ev(), b: ev() }, seen: seenBase({ ocultos: { b: true } }) });
  N.markAll(); const s = gravado.find(x => x.fn === 'set'); assert.ok(s && s.v.ocultos && s.v.ocultos.b === true);
});
t('markOne preserva `ocultos` no estado local', () => {
  const { N } = carregar({ feed: { a: ev(), b: ev() }, seen: seenBase({ ocultos: { b: true } }) }); N.markOne('a'); assert.deepEqual(N.items().map(i => i.id), ['a']);
});
t('TTL do feed: lido some em 3 dias, não lido em 30', () => {
  const { N } = carregar({ feed: { lidoVelho: ev({ ts: iso(4 * DIA) }), lidoNovo: ev({ ts: iso(2 * DIA) }), naoLidoVelho: ev({ ts: iso(31 * DIA) }), naoLidoOk: ev({ ts: iso(10 * DIA) }) },
    seen: { ts: iso(100 * DIA), lidos: { lidoVelho: true, lidoNovo: true }, ocultos: {} } });
  assert.deepEqual(N.items().map(i => i.id).sort(), ['lidoNovo', 'naoLidoOk']);
});
t('evento endereçado: destUid de outra pessoa não aparece; o meu e o sem destino sim; destEmail sem uid compara o e-mail', () => {
  const { N } = carregar({ feed: { p1: ev({ destUid: 'u2' }), p2: ev({ destUid: 'u1' }), p3: ev(), p4: ev({ destEmail: 'b@ciahering.com.br' }), p5: ev({ destEmail: 'A@ciahering.com.br' }) }, seen: seenBase() });
  assert.deepEqual(N.items().map(i => i.id).sort(), ['p2', 'p3', 'p5']);
});
t('título que já começa com o ícone não duplica', () => {
  const { N } = carregar({ feed: { a: ev({ tipo: 'okr_editado', icone: '✅', titulo: '✅ Marco concluído' }), b: ev({ icone: '🆕', titulo: 'Sem ícone no título' }) }, seen: seenBase() });
  const m = Object.fromEntries(N.items().map(i => [i.id, i])); assert.strictEqual(m.a.title, 'Marco concluído'); assert.strictEqual(m.a.icon, '✅'); assert.strictEqual(m.b.title, 'Sem ícone no título');
});
t('viva(): notificação com dismissed:true nunca volta', () => {
  const { N } = carregar({ feed: {}, seen: seenBase() }); assert.strictEqual(N.viva({ ts: iso(H), read: true, dismissed: true }), false); assert.strictEqual(N.viva({ ts: iso(H), read: true }), true);
});
t('viewer (localStorage): dismiss e clearRead funcionam sem tocar no banco', () => {
  const { N, gravado, store } = carregar({ feed: { a: ev(), b: ev() }, seen: null, viewer: true }); N.dismiss('a');
  assert.deepEqual(N.items().map(i => i.id), ['b']); assert.strictEqual(gravado.filter(x => /notif_feed_seen/.test(x.p)).length, 0); assert.ok(Object.keys(store).some(k => /seen/i.test(k)));
});
console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1);
