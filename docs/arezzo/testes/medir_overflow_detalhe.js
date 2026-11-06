// Mede, por Objetivo do seed, quais áreas internas do detalhe rolam (conteúdo escondido atrás de barra de rolagem). Uso: node medir_overflow_detalhe.js [rótulo]
const { chromium } = require(process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js'); const { seed } = require('./seed_apresentacao.js');
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); const out = {};
  for (const [w, h] of [[1366, 768], [1920, 1080]]) { const ctx = await b.newContext({ viewport: { width: w, height: h } }); await fake.install(ctx, seed()); const p = await ctx.newPage();
    await p.goto('http://localhost:8941/okr-apresentacao.slide.html'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana', photoURL: '', providerData: [{ providerId: 'google.com' }] }); await p.waitForTimeout(1800);
    const rol = [];
    for (let i = 0; i < 14; i++) { await p.evaluate(id => window._okrOpenDetail(id), 'o' + i); await p.waitForTimeout(350);
      const r = await p.evaluate(() => { const q = s => [...document.querySelectorAll(s)]; const r = []; q('.d2-left').forEach(e => { if (e.scrollHeight > e.clientHeight + 1) r.push('rail'); }); q('.d2-table-rows').forEach(e => { if (e.scrollHeight > e.clientHeight + 1) r.push('marcos'); }); q('.d2-flist').forEach(e => { if (e.scrollHeight > e.clientHeight + 1) r.push('lista'); }); return [...new Set(r)].join('+'); }); if (r) rol.push('o' + i + ':' + r); }
    out[w] = rol.join(' ') || '(nenhum rola)'; await ctx.close(); }
  console.log(process.argv[2] || '', JSON.stringify(out)); await b.close(); })();
