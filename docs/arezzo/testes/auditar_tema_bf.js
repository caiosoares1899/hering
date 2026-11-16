// 🔥 Auditoria do tema Black Friday no Maré (kanban-dev): contraste de texto (medidor do auditoria_temas.js),
// rolagem lateral, erros de JS e prints — BF comparado com Abrolhos no MESMO board, pra separar o que é do tema.
// Uso: node docs/arezzo/testes/auditar_tema_bf.js   (sobe o próprio servidor estático)
//   OUT=<pasta> guarda os PNG/resultado.json (padrão docs/capturas/tema_bf) · PAGINA=kanban (prod) · TEMAS=blackfriday,dark
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), os = require('node:os');
const PW = process.env.PLAYWRIGHT_MODULE || (fs.existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : path.join(os.homedir(), 'hering-tools/playwright/node_modules/playwright'));
const { chromium } = require(PW);
const fake = require('./fakefb');
const ROOT = path.resolve(__dirname, '../../..');
const PAG = process.env.PAGINA || 'kanban-dev';
const OUT = process.env.OUT || path.join(ROOT, 'docs/capturas/tema_bf'); fs.mkdirSync(OUT, { recursive: true });
const TEMAS = (process.env.TEMAS || 'blackfriday,dark').split(',');
function chrome() {
  if (process.env.CHROME) return process.env.CHROME;
  if (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) return '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const r = path.join(os.homedir(), 'hering-tools/chrome'), arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-'));
  return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
}
// medidor de contraste: mesmo SCAN do auditoria_temas.js (pixels reais do fundo, sem glyphs)
const fonteAud = fs.readFileSync(path.join(__dirname, 'auditoria_temas.js'), 'utf8');
const SCAN_SRC = fonteAud.slice(fonteAud.indexOf('const SCAN = () => {') + 'const SCAN = '.length, fonteAud.indexOf('\nconst { PNG }'));
const { PNG } = require(path.join(path.dirname(require.resolve('playwright-core', { paths: [path.dirname(require.resolve(PW))] })), 'lib/utilsBundle.js'));
const lum = c => c.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
async function medir(p) {
  const dados = await p.evaluate('(' + SCAN_SRC.trim().replace(/;$/, '') + ')()');
  const hide = await p.addStyleTag({ content: '*{-webkit-text-fill-color:transparent!important;text-shadow:none!important;} svg text{fill:transparent!important;} input::placeholder,textarea::placeholder{-webkit-text-fill-color:transparent!important;} .card.card-prio-critical::before{color:transparent!important}' });
  await p.waitForTimeout(80);
  let png; try { png = PNG.sync.read(await p.screenshot({ animations: 'disabled' })); } finally { await hide.evaluate(e => e.remove()); }
  const baixo = [];
  for (const x of dados.textos) {
    let worst = 22;
    for (const [sx, sy] of x.samples) {
      const xx = Math.max(0, Math.min(png.width - 1, Math.floor(sx))), yy = Math.max(0, Math.min(png.height - 1, Math.floor(sy)));
      const off = (yy * png.width + xx) * 4, bg = [...png.data.slice(off, off + 3)], a = x.fg[3] * x.op, fg = x.fg.slice(0, 3).map((v, i) => v * a + bg[i] * (1 - a));
      const r = (Math.max(lum(fg), lum(bg)) + .05) / (Math.min(lum(fg), lum(bg)) + .05); if (r < worst) worst = r;
    }
    if (worst < x.min && !x.disabled) baixo.push({ t: x.t, el: x.el, r: +worst.toFixed(2), min: x.min, px: x.px });
  }
  return { baixo, overflow: dados.overflow, total: dados.textos.length };
}
const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Teste', photoURL: '', providerData: [{ providerId: 'google.com' }] };
function seed() {
  const hoje = new Date(), d = n => { const x = new Date(hoje); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const cols = [{ id: 'todo', name: 'A fazer' }, { id: 'progress', name: 'Em andamento' }, { id: 'blocker', name: 'Impedimentos' }, { id: 'done', name: 'Concluído', isDone: true }];
  const base = [
    ['🔥 Campanha Black Friday — banner home + vitrine de ofertas relâmpago', 'progress', 'critical', { due: d(1), owner: 'AT' }],
    ['Cupom BLACK30 no checkout', 'progress', 'critical', { due: d(-2), owner: 'BO', blocker: true, blockerReason: 'Aguardando aprovação do jurídico' }],
    ['Disparo de e-mail "esquenta"', 'todo', 'high', { due: d(3) }],
    ['Landing page de pré-venda com contador regressivo e um título bem longo para quebrar em várias linhas no card', 'todo', 'medium', {}],
    ['Ajustar estoque do outlet', 'todo', 'low', { owner: 'AT' }],
    ['Integração VTEX — frete grátis acima de R$ 199', 'blocker', 'high', { blockerReason: 'VTEX instável' }],
    ['Peças do Instagram', 'progress', 'medium', { isOKR: true }],
    ['Monitoramento do site no dia', 'progress', 'high', { continuo: true }],
    ['Relatório de vendas da semana', 'done', 'medium', {}],
    ['Revisar <b>HTML</b> no título 🛒', 'todo', 'medium', { paused: true, pausedAt: new Date().toISOString() }],
  ];
  const cards = {}, idx = {};
  base.forEach(([title, col, priority, extra], i) => { const id = 'c' + i, k = 'k' + i; idx[id] = k; cards[k] = Object.assign({ id, title, col, priority, created: 'AT', createdAt: d(-5), desc: '', checklist: i === 0 ? [{ text: 'Arte', t: 'Arte', done: true }, { text: 'Copy', t: 'Copy', done: false }] : [] }, extra); });
  return { kanban: { usuarios: { ana: { uid: 'ana', nome: 'Ana Teste', email: U.email, init: 'AT', role: 'po', inscrito: true, squads: { site: true } } },
    usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana Teste', init: 'AT', role: 'po', squads: { site: true } }, bia: { uid: 'bia', nome: 'Bia Outra', init: 'BO', role: 'membro', squads: { site: true } } },
    config: { adm_emails: [] }, squads_meta: {}, squads: { site: { dados: { columns: cols, cards, cards_index: idx, agil_cfg: { bfBannerMsg: 'Plantão de sexta: todo mundo online das 0h às 2h' } } } } } };
}
const tipos = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
(async () => {
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok)); const BASE = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch({ executablePath: chrome(), headless: true }); const res = {};
  try {
    for (const [w, h, nome] of [[1280, 900, 'desktop'], [390, 800, 'celular']]) {
      for (const tema of TEMAS) {
        const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 800, isMobile: w < 800 });
        await fake.install(ctx, seed());
        await ctx.addInitScript(t => { try { localStorage.setItem('mare_theme', t); localStorage.setItem('mare_guia_mare_visto', '1'); } catch (e) {} }, tema);
        const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
        await p.goto(BASE + '/' + PAG + '.html?squad=site'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(u => window.__authCb(u), U); await p.waitForTimeout(2600);
        await p.evaluate(t => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); if (t === 'blackfriday') document.documentElement.setAttribute('data-theme', 'blackfriday'); else if (t === 'dark') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); document.querySelectorAll('.toast.show').forEach(e => e.classList.remove('show')); }, tema);
        await p.waitForTimeout(300);
        const k = nome + '/' + tema; res[k] = { board: await medir(p), aplicado: await p.evaluate(() => document.documentElement.getAttribute('data-theme')), errs };
        await p.screenshot({ path: path.join(OUT, `${nome}-${tema}-board.png`) });
        await p.evaluate(() => openCard('c0')); await p.waitForTimeout(500);
        res[k].card = await medir(p); await p.screenshot({ path: path.join(OUT, `${nome}-${tema}-card.png`) });
        // telas usadas na semana (o padrão vale pra todas): fecha tudo, abre uma, mede, fecha
        const TELAS = { gantt: 'toggleGanttView()', timeline: 'toggleTimelineView()', calendario: 'openCal()', meudia: 'openMeuDia()', prefs: 'openMinhasPrefs()', sino: 'toggleNotifPanel()' };
        for (const [tela, abre] of Object.entries(TELAS)) {
          await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); try { if (typeof boardView !== 'undefined' && boardView !== 'board') { if (boardView === 'gantt') toggleGanttView(); else if (boardView === 'timeline') toggleTimelineView(); } } catch (e) {} });
          await p.evaluate(a => { try { (0, eval)(a); } catch (e) { window.__abreErro = e.message; } }, abre); await p.waitForTimeout(900);
          res[k][tela] = await medir(p); await p.screenshot({ path: path.join(OUT, `${nome}-${tema}-${tela}.png`) });
          if (tela === 'sino') await p.evaluate(() => { try { toggleNotifPanel(); } catch (e) {} });
        }
        await ctx.close();
      }
    }
  } finally { await b.close(); srv.close(); }
  fs.writeFileSync(path.join(OUT, 'resultado.json'), JSON.stringify(res, null, 1));
  for (const [k, v] of Object.entries(res)) {
    console.log(`\n== ${k} (data-theme no boot: ${v.aplicado || 'nenhum'}) erros JS: ${v.errs.length}`);
    for (const tela of ['board', 'card', 'gantt', 'timeline', 'calendario', 'meudia', 'prefs', 'sino']) { const m = v[tela]; console.log(` ${tela}: ${m.baixo.length} textos abaixo do mínimo de ${m.total} · rolagem lateral: ${m.overflow}`); m.baixo.slice(0, 14).forEach(x => console.log(`   ${x.r}/${x.min} ${x.px}px ${x.el} "${x.t.slice(0, 50)}"`)); }
  }
})().catch(e => { console.error(e); process.exitCode = 1; srv.close(); });
