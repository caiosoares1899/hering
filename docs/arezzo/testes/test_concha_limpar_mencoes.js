// 🐚 Concha — 🧹 limpar a aba @ Menções e ✓ marcar todas como lidas (pedido do Caio, 25/11/2026; Backlog #concha-novos-pedidos-2511).
// Limpar tira só a lista da pessoa (kanban/cardume/mencoes/{uid}); as mensagens continuam nos canais; cancelar não apaga nada. Cada escrita nas regras reais.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_limpar_mencoes.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const { update: regras } = require('../../../functions/rules/rulesSim.js');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../database.rules.json'), 'utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const ag = Date.now();
const seed = () => ({ kanban: { usuarios: { ana: { role: 'membro' } }, usuarios_publicos: { ana: { nome: 'Ana Lima', email: 'ana@ciahering.com.br' }, bru: { nome: 'Bruno Reis', email: 'bru@ciahering.com.br' } },
  cardume: { canais: { dados: { nome: 'Dados' } }, membros: { dados: { ana: true, bru: true } }, meus: { ana: { dados: true } },
    msgs: { dados: { k1: { uid: 'bru', ts: ag - 3e5, texto: 'oi @Ana Lima' }, k2: { uid: 'bru', ts: ag - 2e5, texto: '@Ana Lima olha' }, k3: { uid: 'bru', ts: ag - 1e5, texto: 'e aí @Ana Lima' } } },
    mencoes: { ana: { r1: { c: 'dados', m: 'k1', de: 'bru', ts: ag - 3e5, n: 'n1', lida: true }, r2: { c: 'dados', m: 'k2', de: 'bru', ts: ag - 2e5, n: 'n2' }, r3: { c: 'dados', m: 'k3', de: 'bru', ts: ag - 1e5, n: 'n3' } } } } } });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 400))); };
const authDe = u => ({ uid: u.uid, token: { email: u.email, firebase: { sign_in_provider: 'google.com' } } });
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(chromeRoot) ? path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed());
  await ctx.addInitScript(() => { window.__limitarConsultas = true; localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb);
  await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(900);
  const S = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__store.kanban.cardume)));
  await p.click('#b-mencoes'); await p.waitForTimeout(300);
  t('a aba mostra ✓ Marcar todas como lidas e 🧹 Limpar menções', await p.evaluate(() => [...document.querySelectorAll('.mencoes-acoes button')].map(b => b.textContent).join() === '✓ Marcar todas como lidas,🧹 Limpar menções'), 0);
  await p.click('.mencoes-acoes button:has-text("Marcar todas")'); await p.waitForTimeout(300);
  let c = await S();
  t('marcar todas: lida em todas, e o selo some', Object.values(c.mencoes.ana).every(x => x.lida === true) && await p.evaluate(() => document.getElementById('mencoes-n').hidden), c.mencoes.ana);
  p.once('dialog', d => d.dismiss()); await p.click('.mencoes-acoes button:has-text("Limpar")'); await p.waitForTimeout(300);
  t('cancelar não apaga nada', Object.keys((await S()).mencoes.ana || {}).length === 3, 0);
  p.once('dialog', d => d.accept()); await p.click('.mencoes-acoes button:has-text("Limpar")'); await p.waitForTimeout(400);
  c = await S();
  t('🧹 Limpar tira todas as menções da lista', !c.mencoes || !c.mencoes.ana || !Object.keys(c.mencoes.ana).length, c.mencoes);
  t('as mensagens continuam nos canais', Object.keys(c.msgs.dados).length === 3, Object.keys(c.msgs.dados));
  t('a aba mostra o vazio', await p.evaluate(() => /Ninguém mencionou você/.test(document.getElementById('log').textContent)), 0);
  const esc = await p.evaluate(() => window.__escritas || []);
  const real = Date.now; const ruins = [];
  for (const e of esc) { const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([k, v]) => [(e.p ? e.p + '/' : '') + k, v])); Date.now = () => e.t; let r; try { r = regras(RULES, e.antes, authDe(ANA), mapa); } finally { Date.now = real; } if (!r) ruins.push({ tipo: e.tipo, caminhos: Object.keys(mapa) }); }
  t('CADA escrita da página passa nas regras reais', esc.length > 0 && !ruins.length, { n: esc.length, ruins });
  t('sem erro de JS', !errs.length, errs);
  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
