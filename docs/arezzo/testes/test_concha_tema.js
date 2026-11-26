// 🐚 Concha — 🎨 tema (pedido do Caio, 25/11/2026): Como no Oceano (padrão) · Abrolhos · Lençóis · Entardecer · 🌴 Vice City.
// Guardado só na Concha (concha_tema); "Como no Oceano" segue oceano_prefs; vale desde o 1º pintar da página (sem piscar). Só aparelho, nada no banco.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_tema.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const seed = () => ({ kanban: { usuarios: { ana: { role: 'membro' } }, usuarios_publicos: { ana: { nome: 'Ana Lima', email: 'ana@ciahering.com.br' } },
  cardume: { canais: { dados: { nome: 'Dados' } }, membros: { dados: { ana: true } }, meus: { ana: { dados: true } }, msgs: { dados: {} } } } });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 300))); };
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(chromeRoot) ? path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed());
  await ctx.addInitScript(() => { window.__limitarConsultas = true; if (!sessionStorage.getItem('ja')) { sessionStorage.setItem('ja', '1'); localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off', tema: 'lencois' })); } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb);
  await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(800);
  const tema = () => p.evaluate(() => document.documentElement.getAttribute('data-theme'));
  t('padrão: segue o Oceano (Lençóis = claro)', (await tema()) === 'light', await tema());
  t('⚙️ no topo depois do login (o tema mora nas Configurações)', await p.evaluate(() => !document.getElementById('b-config').hidden), 0);
  await p.click('#b-config'); await p.waitForTimeout(100);
  t('o ⚙️ › Aparência mostra os 5 temas (Como no Oceano marcado)', await p.evaluate(() => [...document.querySelectorAll('.md input[name="tema"]')].map(r => r.value + (r.checked ? '*' : '')).join() === '*,abrolhos,lencois,entardecer,vice'), 0);
  await p.click('.md input[value="vice"]'); await p.waitForTimeout(100);
  t('🌴 Vice City muda na hora e fica guardado só na Concha', (await tema()) === 'vice' && await p.evaluate(() => localStorage.getItem('concha_tema') === 'vice' && JSON.parse(localStorage.getItem('oceano_prefs')).tema === 'lencois'), await tema());
  await p.keyboard.press('Escape');
  await p.reload(); 
  t('recarregar: já nasce em Vice City (sem piscar o tema do Oceano)', (await tema()) === 'vice', await tema());
  await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(600);
  await p.click('#b-config'); await p.click('.md input[name="tema"][value=""]'); await p.waitForTimeout(100);
  t('"Como no Oceano" volta a seguir o Oceano (Lençóis) e apaga a escolha da Concha', (await tema()) === 'light' && await p.evaluate(() => localStorage.getItem('concha_tema') === null), await tema());
  await p.click('.md input[value="abrolhos"]'); await p.waitForTimeout(100);
  t('Abrolhos (escuro) tira o atributo', (await tema()) === null, await tema());
  t('o tema não grava nada no banco', await p.evaluate(() => !(window.__escritas || []).some(e => /tema/.test(e.p + JSON.stringify(Object.keys(e.v || {}))))), 0);
  t('sem erro de JS', !errs.length, errs);
  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
