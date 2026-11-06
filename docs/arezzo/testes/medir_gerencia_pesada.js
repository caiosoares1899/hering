// Gerência com muitos Objetivos: o ajuste automático (fitSlideContent) pode encolher o texto. Mede a altura REAL renderizada do texto do título (após zoom/scale).
// Uso: [PAGINA_ALT=/caminho/outra_versao.html] node medir_gerencia_pesada.js rótulo
const { chromium } = require(process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js'); const { seed } = require('./seed_apresentacao.js');
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); const out = {};
  for (const N of [3, 6, 10, 14]) for (const [w, h] of [[1366, 768], [1920, 1080]]) { const d = seed(); const o = d.kanban.okr.objetivos; for (let i = 0; i < N; i++) o['x' + i] = { ...o.o0, id: 'x' + i, titulo: 'Objetivo extra número ' + i + ' com título médio para ocupar linha', areaId: 'tech' }; Object.keys(o).forEach(k => { if (!k.startsWith('x') && o[k].areaId === 'tech') o[k].areaId = 'cx'; });
    const ctx = await b.newContext({ viewport: { width: w, height: h } }); await fake.install(ctx, d); const p = await ctx.newPage();
    if (process.env.PAGINA_ALT) { const corpo = require('fs').readFileSync(process.env.PAGINA_ALT, 'utf8'); await p.route('**/okr-apresentacao.slide.html*', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: corpo })); }
    await p.goto('http://localhost:8941/okr-apresentacao.slide.html'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana', photoURL: '', providerData: [{ providerId: 'google.com' }] }); await p.waitForTimeout(1500);
    await p.evaluate(() => { const i = slides.findIndex(s => s.key.endsWith(':tech')); window._okrGoTo(i); }); await p.waitForTimeout(700);
    const r = await p.evaluate(() => { const t = document.querySelector('.slide.active .obj-title'); const rg = document.createRange(); rg.setStart(t.firstChild, 0); rg.setEnd(t.firstChild, 4); const rc = rg.getBoundingClientRect(); return { glifo: +rc.height.toFixed(1) }; });
    out[N + 'obj@' + w] = r.glifo + 'px'; await ctx.close(); }
  console.log(process.argv[2] || '', JSON.stringify(out)); await b.close(); })();
