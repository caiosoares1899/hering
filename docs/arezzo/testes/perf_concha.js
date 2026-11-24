// Custo de pintura da Concha (peixes atrás do vidro): ms de raster+GPU por segundo e quadros desenhados/s, parado e digitando.
// Headless rasteriza por CPU: o absoluto não é o do notebook, mas main × branch na mesma máquina compara. PAGINA_ALT=arquivo serve outra versão por page.route.
// Uso (raiz servida em 8941): PEIXES=normal|off [PAGINA_ALT=...] node docs/arezzo/testes/perf_concha.js [rótulo]
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir(); const fake = require('./fakefb.js');
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const agora = Date.now(); const msgs = {}; for (let i = 0; i < 30; i++) msgs['-Np' + String(i).padStart(2, '0')] = { uid: i % 2 ? 'bru' : 'ana', ts: agora - (40 - i) * 60000, texto: 'mensagem de exemplo número ' + i + ' com um texto de tamanho médio' };
const seed = { kanban: { usuarios: { ana: { role: 'membro', squads: { dados: true } } }, usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana Lima', init: 'AL' }, bru: { uid: 'bru', nome: 'Bruno Reis', init: 'BR' } },
  cardume: { canais: { dados: { nome: 'Dados' } }, membros: { dados: { ana: true, bru: true } }, meus: { ana: { dados: true } }, msgs: { dados: msgs } } } };
const TRACE = ['disabled-by-default-devtools.timeline', 'cc', 'viz', 'gpu', 'benchmark'];
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const b = await chromium.launch({ executablePath: process.env.CHROME });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 }); await fake.install(ctx, seed);
  await ctx.addInitScript(pz => localStorage.setItem('oceano_prefs', JSON.stringify({ tema: 'abrolhos', peixes: pz })), process.env.PEIXES || 'normal');
  if (process.env.PAGINA_ALT) { const h = fs.readFileSync(process.env.PAGINA_ALT, 'utf8'); await ctx.route('**/cardume-dev.html*', r => r.fulfill({ body: h, contentType: 'text/html' })); }
  const p = await ctx.newPage(); await p.goto('http://127.0.0.1:8941/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb);
  await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(1500);
  const janela = async (ms, acao) => {
    await b.startTracing(p, { categories: TRACE }); const fim = Date.now() + ms; if (acao) await acao(fim); else await p.waitForTimeout(ms);
    const ev = JSON.parse((await b.stopTracing()).toString()).traceEvents; let total = 0, quadros = 0;
    for (const e of ev) { if (e.ph === 'X' && e.dur != null && /RasterTask|DrawAndSwap|DoCommands|GpuRaster|RasterDecoder|SkiaOutputSurface/.test(e.name)) total += e.dur / 1000; if (e.name === 'Display::DrawAndSwap' || e.name === 'DrawFrame') quadros++; }
    return { 'raster+GPU ms/s': Math.round(total / (ms / 1000)), 'quadros/s': Math.round(quadros / (ms / 1000)) };
  };
  const R = {};
  R.parado = await janela(4000);
  await p.click('#entrada');
  R.digitando = await janela(4000, async fim => { while (Date.now() < fim) await p.keyboard.type('a', { delay: 120 }); });
  console.log(process.argv[2] || 'medida'); console.table(R); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
