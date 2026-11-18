// 🐛 18/11/2026 (pedido do Caio): "INTERNAL ASSERTION FAILED: Pending promise was never set" (SDK do Firebase Auth, popup de login)
// não vira mais erro aberto no Monitor do Painel, mas continua avisando a pessoa (_checkAuthGlitch). Os outros erros seguem gravados.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(os.homedir(), 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const ROOT = path.resolve(__dirname, '../../..');
function chrome() { if (process.env.CHROME) return process.env.CHROME; const r = path.join(os.homedir(), 'hering-tools/chrome'), arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-')); return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'); }
const user = { uid: 'ad', email: 'adrian@ciahering.com.br', displayName: 'Adrian Teste', providerData: [{ providerId: 'google.com' }] };
const tipos = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (process.env.KANBAN_HTML && /kanban-dev\.html$/.test(f)) f = process.env.KANBAN_HTML;
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': tipos[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let falhas = 0; const t = (n, ok, d) => { if (!ok) falhas++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
const seed = () => ({ kanban: {
  usuarios: { ad: { nome: 'Adrian Teste', email: user.email, init: 'AD', role: 'membro', inscrito: true, squads: { site: true } } },
  usuarios_publicos: { ad: { nome: 'Adrian Teste', init: 'AD', role: 'membro', inscrito: true, squads: { site: true } } },
  config: { adm_emails: [] }, squads: { site: { dados: { columns: [{ id: 'todo', name: 'To Do' }], cards_index: {}, cards: {} } } } } });
(async () => {
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok)); const BASE = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch({ executablePath: chrome(), headless: true });
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed());
    const p = await ctx.newPage();
    await p.goto(BASE + '/kanban-dev.html?squad=site'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(u => window.__authCb(u), user);
    await p.waitForTimeout(2500);
    const logs = () => p.evaluate(() => Object.values(window.__store.kanban.squads.site.error_logs || {}).map(e => e.msg));
    await p.evaluate(() => { const e = new Error('INTERNAL ASSERTION FAILED: Pending promise was never set'); logError(e.message, 'promise', 0, 0, e); });
    await p.waitForTimeout(400);
    t('assertion do popup de login NÃO vai para o Monitor', !(await logs()).some(m => m.includes('Pending promise')), await logs());
    t('a pessoa continua vendo o aviso "Conexão instável"', await p.evaluate(() => !!document.getElementById('_auth-glitch-banner')), '');
    await p.evaluate(() => { const e = new Error('erro de verdade'); logError(e.message, 'promise', 0, 0, e); });
    await p.waitForTimeout(400);
    t('outro erro continua sendo gravado', (await logs()).some(m => m.includes('erro de verdade')), await logs());
    await ctx.close();
  } finally { await b.close(); srv.close(); }
  console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo.'); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
