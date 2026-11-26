// 🔔 Service Worker — clique no push reaproveita só a aba da MESMA página (26/11/2026, /monitorarbugs da Concha).
// Antes, todo link que não fosse do OKR reaproveitava qualquer aba com "kanban" na URL: o push da Concha levava embora a aba do Maré.
// Carrega o firebase-messaging-sw.js real num vm, com self/clients/firebase falsos. Rodar: node docs/arezzo/testes/test_sw_clique_push.js
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const src = fs.readFileSync(path.join(__dirname, '../../../', process.env.SW_FILE || 'firebase-messaging-sw.js'), 'utf8');
const B = 'https://caiosoares1899.github.io/hering/';
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + JSON.stringify(d))); };
async function clicar(abas, urlPush) {
  const ouvintes = {}, abertas = [], eventos = [];
  const mk = (url, frameType) => ({ url, frameType: frameType || 'top-level', focus() { eventos.push(['focus', this.url]); return Promise.resolve(this); }, navigate(u) { eventos.push(['navigate', this.url, u]); return Promise.resolve(this); } });
  const lista = abas.map(a => (typeof a === 'string' ? mk(a) : mk(a.url, a.frameType)));
  const self = { addEventListener: (ev, fn) => { ouvintes[ev] = fn; }, registration: { showNotification() {} }, location: { origin: 'https://caiosoares1899.github.io' } };
  const ctx = { self, clients: { matchAll: async () => lista, openWindow: async (u) => { abertas.push(u); } }, importScripts() {}, console,
    firebase: { initializeApp() {}, messaging: () => ({ onBackgroundMessage() {} }) }, caches: { open: async () => ({ addAll: async () => {}, put: async () => {}, match: async () => null }), keys: async () => [], delete: async () => true, match: async () => null }, fetch: async () => ({ ok: true, clone() { return this; } }), URL, Response: function () {}, Promise, setTimeout };
  ctx.self.clients = ctx.clients; vm.createContext(ctx); vm.runInContext(src, ctx);
  let espera; const ev = { notification: { close() {}, data: urlPush ? { url: urlPush } : {} }, waitUntil: (p) => { espera = p; } };
  ouvintes.notificationclick(ev); await espera;
  return { abertas, eventos };
}
(async () => {
  let r = await clicar([B + 'kanban.html?squad=dados'], B + 'cardume-dev.html?c=dados&m=k1');
  t('push da Concha com o Maré aberto: NÃO navega a aba do Maré, abre a Concha', !r.eventos.some(e => e[0] === 'navigate') && r.abertas[0] === B + 'cardume-dev.html?c=dados&m=k1', r);
  r = await clicar([B + 'kanban.html?squad=dados', B + 'cardume-dev.html?c=prf'], B + 'cardume-dev.html?c=dados&m=k1');
  t('com a Concha aberta: reaproveita a aba da Concha (navega e foca), sem abrir outra', r.eventos.some(e => e[0] === 'navigate' && /cardume-dev/.test(e[1])) && !r.abertas.length && !r.eventos.some(e => /kanban/.test(e[1])), r);
  r = await clicar([B + 'kanban-dev.html?squad=dados'], B + 'kanban.html?squad=dados&card=c1');
  t('push do Maré de prod com só o Maré dev aberto: não reaproveita o ambiente errado', !r.eventos.some(e => e[0] === 'navigate') && r.abertas.length === 1, r);
  r = await clicar([B + 'kanban.html?squad=dados'], B + 'kanban.html?squad=dados&card=c1');
  t('push do Maré com o Maré aberto: reaproveita a aba (como antes)', r.eventos.some(e => e[0] === 'navigate' && e[2] === B + 'kanban.html?squad=dados&card=c1') && !r.abertas.length, r);
  r = await clicar([B + 'okr-apresentacao.slide.html'], B + 'okr.html?okr=o1');
  t('push do Radar com a apresentação aberta: não navega a apresentação', !r.eventos.some(e => e[0] === 'navigate') && r.abertas.length === 1, r);
  r = await clicar([{ url: B + 'cardume-dev.html?c=dados', frameType: 'nested' }, B + 'oceano.html'], B + 'cardume-dev.html?c=dados&m=k2');
  t('Concha só dentro do Oceano (iframe): não navega o iframe, abre aba própria', !r.eventos.some(e => e[0] === 'navigate') && r.abertas.length === 1, r);
  r = await clicar([B + 'kanban.html'], null);
  t('push sem URL: abre/foca o Maré (padrão)', r.eventos.some(e => e[0] === 'focus' && /kanban\.html/.test(e[1])), r);
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
