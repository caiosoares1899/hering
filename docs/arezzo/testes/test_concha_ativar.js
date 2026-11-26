// 🐚 Concha — ativar o canal de uma squad (ADM) com o painel ℹ️ Detalhes FECHADO (relato do Caio, 26/11/2026: "não consigo ativar a squad dev").
// Antes, o botão só existia no Detalhes: com ele fechado, "＋ Dev" abria uma conversa vazia sem saída. Agora o botão aparece também na conversa.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_ativar.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const { update: regras } = require('../../../functions/rules/rulesSim.js');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../database.rules.json'), 'utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const CAI = { uid: 'cai', email: 'caio.soares@ciahering.com.br', displayName: 'Caio Soares', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const seed = () => ({ kanban: { usuarios: { cai: { role: 'adm', squads: { dados: true } } }, usuarios_publicos: { cai: { nome: 'Caio Soares', email: 'caio.soares@ciahering.com.br' } }, squads_meta: { dev: { label: 'Dev', emoji: '🧪' } },
  cardume: { canais: { dados: { nome: 'Dados' } }, membros: { dados: { cai: true } }, meus: { cai: { dados: true } }, msgs: { dados: {} } } } });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 300))); };
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(chromeRoot) ? path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed());
  await ctx.addInitScript(() => { window.__limitarConsultas = true; localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); localStorage.setItem('cardume_lado', '0'); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb);
  await p.evaluate(x => window.__authCb(x), CAI); await p.waitForTimeout(900);
  t('(pré-condição) painel ℹ️ Detalhes fechado', await p.evaluate(() => document.getElementById('lado').hidden), 0);
  await p.click('[data-canal="dev"]'); await p.waitForTimeout(400);
  t('"＋ Dev" mostra na conversa "Dev ainda não tem canal" + Ativar (não a conversa vazia)', await p.evaluate(() => { const l = document.getElementById('log').textContent; return /Dev ainda não tem canal/.test(l) && !/Diga oi/.test(l) && !!document.querySelector('#log button.primary'); }), await p.evaluate(() => document.getElementById('log').textContent));
  await p.click('#log button.primary'); await p.waitForTimeout(500);
  t('ativa: canais/dev = {nome: "Dev"} e o Detalhes abre para pôr as pessoas', JSON.stringify(await p.evaluate(() => window.__store.kanban.cardume.canais.dev)) === '{"nome":"Dev"}' && await p.evaluate(() => !document.getElementById('lado').hidden), await p.evaluate(() => window.__store.kanban.cardume.canais.dev));
  const esc = await p.evaluate(() => window.__escritas || []); const real = Date.now; const ruins = [];
  for (const e of esc) { const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([k, v]) => [(e.p ? e.p + '/' : '') + k, v])); Date.now = () => e.t; let r; try { r = regras(RULES, e.antes, { uid: 'cai', token: { email: CAI.email, firebase: { sign_in_provider: 'google.com' } } }, mapa); } finally { Date.now = real; } if (!r) ruins.push(Object.keys(mapa)); }
  t('CADA escrita da página passa nas regras reais', esc.length > 0 && !ruins.length, ruins);
  t('sem erro de JS', !errs.length, errs);
  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
