// Toolbar: folga de pintura/foco no contêiner com rolagem; boot real + Firebase falso.
// PAGINA_ALT=/tmp/kanban-antes.html OUT=/tmp/capturas node docs/arezzo/testes/test_toolbar_ui.js
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), os = require('node:os');
const PW = process.env.PLAYWRIGHT_MODULE || (fs.existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : path.join(os.homedir(), 'hering-tools/playwright/node_modules/playwright'));
const { chromium } = require(PW);
const fake = require('./fakefb');
const ROOT = path.resolve(__dirname, '../../..'), PAG = process.env.PAGINA || 'kanban-dev';
function chrome() {
  if (process.env.CHROME) return process.env.CHROME;
  if (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) return '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const r = path.join(os.homedir(), 'hering-tools/chrome'), arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-'));
  return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
}
const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Teste', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const old = new Date(Date.now() - 40 * 864e5).toISOString();
const seed = () => ({ kanban: {
  usuarios: { ana: { uid: 'ana', nome: 'Ana Teste', email: U.email, init: 'AT', role: 'membro', inscrito: true, squads: { site: true } } },
  usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana Teste', init: 'AT', role: 'membro', squads: { site: true } } },
  config: { adm_emails: [] }, squads_meta: {},
  squads: { site: { dados: { columns: [{ id: 'todo', name: 'A fazer' }, { id: 'done', name: 'Concluído', isDone: true }],
    cards_index: { c1: 'k1', c2: 'k2', c3: 'k3', c4: 'k4' },
    cards: {
      k1: { id: 'c1', title: 'Crítico e meu — título que não pode ficar embaixo da fita', col: 'todo', priority: 'critical', owner: 'AT', created: 'AT', createdAt: '2026-11-01' },
      k2: { id: 'c2', title: 'Crítico e contínuo', col: 'todo', priority: 'critical', continuo: true, created: 'AT', createdAt: '2026-11-01' },
      k3: { id: 'c3', title: 'Crítico sozinho', col: 'todo', priority: 'critical', created: 'AT', createdAt: '2026-11-01' },
      k4: { id: 'c4', title: 'Normal', col: 'todo', priority: 'medium', created: 'AT', createdAt: '2026-11-01' },
    } } } } } });
const tipos = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });

(async () => {
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
  const b = await chromium.launch({ executablePath: chrome(), headless: true });
  const resultados = [], out = process.env.OUT;
  if (out) fs.mkdirSync(out, { recursive: true });
  try {
    for (const quantidade of [0, 4, 54]) {
      const dados = seed();
      const cards = dados.kanban.squads.site.dados.cards;
      if (!quantidade) dados.kanban.squads.site.dados.cards = {};
      for (let i = 4; i < quantidade; i++) cards['k' + i] = { id: 'c' + i, title: 'Campanha de exemplo com título longo 🛒 <b>texto</b> ' + i, col: 'todo', priority: 'medium', created: 'AT', createdAt: '2026-11-01' };
      for (const id of ['site', 'rh', 'crm', 'tech']) dados.kanban.squads_meta[id] = { label: 'Squad fictícia ' + id, active: true };
      const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
      await fake.install(ctx, dados);
      if (process.env.PAGINA_ALT) await ctx.route('**/kanban-dev.html*', route => route.fulfill({ contentType: 'text/html', body: fs.readFileSync(process.env.PAGINA_ALT, 'utf8') }));
      const p = await ctx.newPage(), erros = [];
      p.on('pageerror', e => erros.push(e.message));
      await p.goto('http://127.0.0.1:' + srv.address().port + '/kanban-dev.html?squad=site');
      await p.waitForFunction(() => !!window.__authCb);
      await p.evaluate(u => window.__authCb(u), U);
      await p.waitForTimeout(2300);
      await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')));
      for (const width of [1280, 390]) {
        await p.setViewportSize({ width, height: width === 390 ? 800 : 900 });
        for (const tema of ['blackfriday', 'dark', 'light', 'vice']) {
          await p.evaluate(t => { if (t === 'dark') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = t; }, tema);
          await p.waitForTimeout(80);
          const medidas = await p.evaluate(() => {
            const tb = document.getElementById('main-toolbar'), r = tb.getBoundingClientRect();
            const botoes = [...tb.querySelectorAll('button')].filter(x => x.getBoundingClientRect().width);
            const caixas = botoes.map(x => x.getBoundingClientRect());
            const topo = Math.min(...caixas.map(x => x.top - r.top));
            const base = Math.min(...caixas.map(x => r.bottom - x.bottom));
            tb.scrollLeft = 0;
            const inicial = tb.scrollLeft; tb.scrollLeft = tb.scrollWidth;
            const rola = tb.scrollWidth <= tb.clientWidth || tb.scrollLeft > inicial;
            tb.scrollLeft = 0;
            const primeiro = botoes[0]; primeiro.focus({ preventScroll: true });
            return { topo, base, rola, foco: document.activeElement === primeiro,
              lateral: document.documentElement.scrollWidth - document.documentElement.clientWidth,
              altura: Math.min(...caixas.map(x => x.height)), overflowY: getComputedStyle(tb).overflowY };
          });
          await p.evaluate(fs.readFileSync(path.join(__dirname, 'console_toolbar_ui.js'), 'utf8'));
          const consoleOk = await p.evaluate(() => window._resultadosTeste.every(x => x.resultado === '✅'));
          const ok = consoleOk && medidas.topo >= 3 && medidas.base >= 3 && medidas.rola && medidas.foco && medidas.lateral <= 1 && !erros.length;
          resultados.push({ quantidade, width, tema, ok, ...medidas, erros: [...erros] });
          console.log((ok ? '✅' : '❌') + ` ${quantidade} cards / ${width}px / ${tema}: ` + JSON.stringify(medidas));
          if (out && quantidade === 54) {
            await p.screenshot({ path: path.join(out, `${width}-${tema}.png`) });
          }
        }
      }
      await ctx.close();
    }
    if (out) fs.writeFileSync(path.join(out, 'resultado.json'), JSON.stringify(resultados, null, 2));
    console.log(`${resultados.filter(x => x.ok).length}/${resultados.length} cenários aprovados`);
    process.exitCode = resultados.some(x => !x.ok) ? 1 : 0;
  } finally { await b.close(); await new Promise(ok => srv.close(ok)); }
})().catch(e => { console.error(e); process.exitCode = 1; srv.close(); });
