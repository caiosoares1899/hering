// Captura os slides da apresentação do Radar (cover, torre, gerência, resumo, detalhe) em 1920x1080 e 1366x768.
// Uso: PW_MODULE=... CHROME_PATH=... CAPTURAS=pasta node capturar_apresentacao.js [prefixo] [tema]
const { chromium } = require(process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js'); const { seed } = require('./seed_apresentacao.js');
const OUT = process.env.CAPTURAS || '.'; const PRE = process.argv[2] || 'apr';
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  for (const [w, h] of [[1920, 1080], [1366, 768]]) { const ctx = await b.newContext({ viewport: { width: w, height: h } }); await fake.install(ctx, seed()); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8941/okr-apresentacao.slide.html'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana', photoURL: '', providerData: [{ providerId: 'google.com' }] }); await p.waitForTimeout(1800);
    const n = await p.evaluate(() => document.querySelectorAll('.slide').length); const shot = async (nome) => { await p.waitForTimeout(600); await p.screenshot({ path: `${OUT}/${PRE}_${w}_${nome}.png` }); };
    const idx = async (i) => { await p.evaluate(i => window._okrGoTo(i), i); };
    await shot('1_capa'); await idx(1); await shot('2_torre'); await idx(2); await shot('3_gerencia'); await idx(n - 1); await shot('4_resumo');
    await idx(2); await p.evaluate(() => { const c = document.querySelector('.slide.active .obj-card'); c && c.click(); }); await shot('5_detalhe');
    await p.evaluate(() => { const o = window._okrOpenDetail; o('o3'); }); await shot('6_detalhe_denso');
    console.log(w + 'x' + h, 'slides:', n, 'erros:', JSON.stringify(errs)); await ctx.close(); }
  await b.close(); })();
