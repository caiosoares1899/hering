// 🔐 Popup da agenda (18/11/2026): escolher OUTRA conta Google no popup trocava a sessão do app em silêncio (signInWithPopup).
// Agora é reauthenticateWithPopup: a conta diferente é recusada (auth/user-mismatch), a sessão fica e nenhum token é gravado.
// KANBAN_HTML/PAINEL_HTML = outra versão da página (para provar que o teste falha antes do fix).
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(os.homedir(), 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const ROOT = path.resolve(__dirname, '../../..');
function chrome() { if (process.env.CHROME) return process.env.CHROME; const r = path.join(os.homedir(), 'hering-tools/chrome'), arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-')); return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'); }
const tipos = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (process.env.KANBAN_HTML && /kanban-dev\.html$/.test(f)) f = process.env.KANBAN_HTML;
  if (process.env.PAINEL_HTML && /painel-dev\.html$/.test(f)) f = process.env.PAINEL_HTML;
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': tipos[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let falhas = 0; const t = (n, ok, d) => { if (!ok) falhas++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
const ADM = { uid: 'ad', email: 'caio.soares@ciahering.com.br', displayName: 'Caio Teste', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const seed = () => ({ kanban: {
  usuarios: { ad: { uid: 'ad', nome: 'Caio Teste', email: ADM.email, init: 'CT', role: 'adm', inscrito: true, squads: { site: true } } },
  usuarios_publicos: { ad: { uid: 'ad', nome: 'Caio Teste', init: 'CT', role: 'adm', inscrito: true, squads: { site: true } } },
  config: { adm_emails: [ADM.email] }, squads: { site: { dados: { columns: [{ id: 'todo', name: 'To Do' }], cards_index: {}, cards: {} } } } } });
const MISMATCH = 'auth/user-mismatch', AVISO = 'mesma conta Google';
(async () => {
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok)); const BASE = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch({ executablePath: chrome(), headless: true });
  const abrir = async pagina => { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed());
    await ctx.addInitScript(() => { try { localStorage.setItem('mare_guia_mare_visto', '1'); localStorage.setItem('mare_dicas_off', '1'); localStorage.setItem('bvmd_ad', '1'); } catch (e) {} });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/' + pagina); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(u => window.__authCb(u), ADM);
    await p.waitForTimeout(2500);
    await p.evaluate(() => { window.__toasts = []; const o = window.showToast; window.showToast = function (m) { window.__toasts.push(String(m)); return o && o.apply(this, arguments); }; });
    return { ctx, p, errs }; };
  const estado = p => p.evaluate(() => ({ tok: localStorage.getItem('gcal_token'), uid: localStorage.getItem('gcal_token_uid'), reauth: window.__reauth || [], popup: window.__popup || 0, authCb: window.__authCbN || 0, signedOut: window.__signedOut || 0, toasts: window.__toasts }));
  const paginas = [
    { nome: 'Maré', url: 'kanban-dev.html?squad=site', chamadas: ['reconectarGCal()', 'processGcalQueueForAdmin()'] },
    { nome: 'Painel', url: 'painel-dev.html', chamadas: ['reconectarPcalGCal()', "(document.getElementById('pcal-agenda-id')||document.body.appendChild(Object.assign(document.createElement('input'),{id:'pcal-agenda-id'}))).value='agenda@x',(document.getElementById('pcal-agenda-label')||document.body.appendChild(Object.assign(document.createElement('input'),{id:'pcal-agenda-label'}))),addPcalAgenda()"] },
  ];
  try {
    for (const pg of paginas) {
      { const { ctx, p } = await abrir(pg.url);
        const cred = await p.evaluate(() => window._requestCalendarScope().then(c => c && c.accessToken));
        const e = await estado(p);
        t(`${pg.nome}: autoriza pela conta logada, sem signInWithPopup`, e.reauth.length === 1 && e.reauth[0].uid === 'ad' && e.popup === 0, e);
        t(`${pg.nome}: o popup já abre na conta certa e mantém o hd`, e.reauth[0] && e.reauth[0].params && e.reauth[0].params.login_hint === ADM.email && e.reauth[0].params.hd === 'ciahering.com.br', e.reauth);
        t(`${pg.nome}: mesma conta grava o token com o dono`, cred === 'TOK_AGENDA' && e.tok === 'TOK_AGENDA' && e.uid === 'ad', e);
        await ctx.close(); }
      for (const chamada of pg.chamadas) { const { ctx, p } = await abrir(pg.url);
        const antes = await estado(p);
        await p.evaluate(c => { window.__reauthErro = 'auth/user-mismatch'; return (0, eval)(c); }, chamada).catch(() => {});
        await p.waitForTimeout(150);
        const e = await estado(p), rot = chamada.split('(')[0] || 'addPcalAgenda';
        t(`${pg.nome} ${rot}: conta diferente não grava token`, e.tok === null && e.uid === null, e);
        t(`${pg.nome} ${rot}: a sessão continua a mesma`, e.authCb === antes.authCb && e.signedOut === 0, e);
        t(`${pg.nome} ${rot}: avisa para usar a mesma conta`, e.toasts.some(m => m.includes(AVISO)), e.toasts);
        await ctx.close(); }
      { const { ctx, p } = await abrir(pg.url);
        const r = await p.evaluate(() => { window.__authCb(null); return window._requestCalendarScope().then(() => 'ok', e => e.code); });
        const e = await estado(p);
        t(`${pg.nome}: sem sessão, recusa sem abrir popup`, r === 'auth/user-signed-out' && e.reauth.length === 0 && e.popup === 0, { r, e });
        await ctx.close(); }
    }
  } finally { await b.close(); srv.close(); }
  console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo.'); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
