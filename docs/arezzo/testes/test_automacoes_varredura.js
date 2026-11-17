// 🐞 17/11/2026 (/monitorarbugs Automações × Black Friday) — as varreduras diárias de Automação (prazo hoje/vencido, card parado) rodavam
// em CADA navegador: a trava era só o localStorage do aparelho. 2º aparelho = a regra "adicionar item ao checklist" rodava de novo no mesmo card.
// Simula o 2º aparelho limpando o localStorage e rodando de novo na mesma página (o Firebase falso é por contexto).
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(os.homedir(), 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const ROOT = path.resolve(__dirname, '../../..');
function chrome() { if (process.env.CHROME) return process.env.CHROME; const r = path.join(os.homedir(), 'hering-tools/chrome'), arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-')); return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'); }
const user = { uid: 'ad', email: 'adrian@ciahering.com.br', displayName: 'Adrian Teste', providerData: [{ providerId: 'google.com' }] };
const pub = (n, i) => ({ nome: n, init: i, role: 'membro', inscrito: true, squads: { site: true } });
const seed = () => ({ kanban: {
  usuarios: { ad: { nome: 'Adrian Teste', email: user.email, init: 'AD', role: 'membro', inscrito: true, squads: { site: true } } },
  usuarios_publicos: { ad: pub('Adrian Teste', 'AD') },
  config: { adm_emails: [] },
  squads: { site: { dados: { columns: [{ id: 'todo', name: 'To Do' }, { id: 'prog', name: 'In Progress' }],
    agil_cfg: { sprintDays: 14 },
    auto_rules: [{ id: 'r1', active: true, trigger: 'aging', action: 'add_checklist_item', actionVal: 'Revisar card parado' },
                 { id: 'r2', active: true, trigger: 'due_today', action: 'add_checklist_item', actionVal: 'Prazo vence hoje' }],
    cards_index: { c1: 'k0', c2: 'k1' },
    cards: { k0: { id: 'c1', title: 'Parado', col: 'todo', owner: 'AD', checklist: [], updatedAt: '2026-11-01T10:00:00.000Z' },
             k1: { id: 'c2', title: 'Vence hoje', col: 'todo', owner: 'AD', checklist: [], updatedAt: '2026-11-01T10:00:00.000Z' } } } } } } });
const tipos = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (process.env.KANBAN_HTML && /kanban-dev\.html$/.test(f)) f = process.env.KANBAN_HTML; if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
let falhas = 0; const t = (n, ok, d) => { if (!ok) falhas++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
(async () => {
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok)); const BASE = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch({ executablePath: chrome(), headless: true });
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed());
    await ctx.addInitScript(() => { try { localStorage.setItem('mare_guia_mare_visto', '1'); localStorage.setItem('mare_dicas_off', '1'); localStorage.setItem('bvmd_ad', '1'); } catch (e) {} });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/kanban-dev.html?squad=site'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(u => window.__authCb(u), user);
    await p.waitForTimeout(2500);
    // prepara o dia: card c1 parado há exatamente 1 sprint, c2 vencendo hoje; 9h já passou
    await p.evaluate(() => {
      _pastDailyTriggerSP = () => true;
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 14);
      const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      cards.find(c => c.id === 'c1').editedAt = iso; cards.find(c => c.id === 'c2').due = _todaySP();
      ['lastAgingCheck_site', 'lastDueCheck_site'].forEach(k => safeLS.removeItem(k));
      delete window.__store.kanban.squads.site.dados.auto_varredura;   // o boot da página já disputou o dia (sem cards no ponto): começa do zero
    });
    const itens = (k, txt) => p.evaluate(([k, txt]) => ((window.__store.kanban.squads.site.dados.cards[k] || {}).checklist || []).filter(i => i && i.t === txt).length, [k, txt]);
    const rodar = async () => { await p.evaluate(() => { checkAgingAutomations(); checkDueNotifs(); }); await p.waitForTimeout(3000); };
    await rodar();                                                                                         // 1º aparelho
    t('1º aparelho: "card parado" roda 1 vez', await itens('k0', 'Revisar card parado') === 1, await itens('k0', 'Revisar card parado'));
    t('1º aparelho: "vence hoje" roda 1 vez', await itens('k1', 'Prazo vence hoje') === 1, await itens('k1', 'Prazo vence hoje'));
    await p.evaluate(() => ['lastAgingCheck_site', 'lastDueCheck_site'].forEach(k => safeLS.removeItem(k)));   // 2º aparelho (localStorage dele está vazio)
    await rodar();
    t('2º aparelho no mesmo dia: "card parado" NÃO roda de novo', await itens('k0', 'Revisar card parado') === 1, await itens('k0', 'Revisar card parado'));
    t('2º aparelho no mesmo dia: "vence hoje" NÃO roda de novo', await itens('k1', 'Prazo vence hoje') === 1, await itens('k1', 'Prazo vence hoje'));
    t('a marca do dia fica no banco da squad', await p.evaluate(() => { const v = (window.__store.kanban.squads.site.dados.auto_varredura || {}); return v.aging === _todaySP() && v.prazo === _todaySP(); }), await p.evaluate(() => window.__store.kanban.squads.site.dados.auto_varredura || null));
    // dia seguinte: roda de novo (a marca é do dia, não para sempre)
    await p.evaluate(() => { window.__store.kanban.squads.site.dados.auto_varredura = { aging: '2000-01-01', prazo: '2000-01-01' }; ['lastAgingCheck_site', 'lastDueCheck_site'].forEach(k => safeLS.removeItem(k)); });
    await rodar();
    t('marca de outro dia não bloqueia: roda de novo', await itens('k1', 'Prazo vence hoje') === 2, await itens('k1', 'Prazo vence hoje'));
    t('sem erro de JS', !errs.length, errs);
    await ctx.close();
  } finally { await b.close(); srv.close(); }
  console.log(falhas ? `HÁ ${falhas} FALHA(S)` : 'TUDO OK'); process.exitCode = falhas ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; srv.close(); });
