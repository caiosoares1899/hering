// 🐞 17/11/2026 (/monitorarbugs pensando na Black Friday) — várias pessoas no MESMO card ao mesmo tempo. O modal lia título,
// descrição, checklist, participantes… uma vez ao abrir; o colega marcava o item A, eu marcava o B e o autosave gravava a lista
// inteira da minha tela: o A do colega voltava a desmarcado. Cobre: modal acompanhando campo intocado, merge item a item do
// checklist (cliques no mesmo segundo), campo que estou digitando NÃO é atropelado, mudança de estrutura segue a regra geral.
// Boot real + Firebase falso. KANBAN_HTML=/caminho compara outra versão (ex.: a main) sem trocar o arquivo no disco.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(os.homedir(), 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const ROOT = path.resolve(__dirname, '../../..');
function chrome() { if (process.env.CHROME) return process.env.CHROME; const r = path.join(os.homedir(), 'hering-tools/chrome'), arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-')); return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'); }
const user = { uid: 'ad', email: 'adrian@ciahering.com.br', displayName: 'Adrian Teste', providerData: [{ providerId: 'google.com' }] };
const pub = (n, i) => ({ nome: n, init: i, role: 'membro', inscrito: true, squads: { site: true } });
const CL = (a, b) => [{ t: 'item A', done: a, grp: 'default' }, { t: 'item B', done: b, grp: 'default' }];
const seed = () => ({ kanban: {
  usuarios: { ad: { nome: 'Adrian Teste', email: user.email, init: 'AD', role: 'membro', inscrito: true, squads: { site: true } } },
  usuarios_publicos: { ad: pub('Adrian Teste', 'AD'), jm: pub('Juliana Teste', 'JM') },
  config: { adm_emails: [] },
  squads: { site: { dados: { columns: [{ id: 'todo', name: 'To Do' }, { id: 'prog', name: 'In Progress' }],
    cards_index: { c1: 'k0' }, cards_updated_at: { c1: '2026-11-17T10:00:00.000Z' },
    cards: { k0: { id: 'c1', title: 'Card da campanha', col: 'prog', owner: 'AD', desc: 'texto original', po: '', checklist: CL(false, false), participants: [], updatedAt: '2026-11-17T10:00:00.000Z' } } } } } } });
const tipos = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (process.env.KANBAN_HTML && /kanban-dev\.html$/.test(f)) f = process.env.KANBAN_HTML; if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
let falhas = 0; const t = (n, ok, d) => { if (!ok) falhas++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
(async () => {
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok)); const BASE = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch({ executablePath: chrome(), headless: true });
  const abrir = async () => { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed());
    await ctx.addInitScript(() => { try { localStorage.setItem('mare_guia_mare_visto', '1'); localStorage.setItem('mare_dicas_off', '1'); localStorage.setItem('bvmd_ad', '1'); } catch (e) {} });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/kanban-dev.html?squad=site'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(u => window.__authCb(u), user);
    await p.waitForTimeout(2500); await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')));
    await p.evaluate(() => openCard('c1')); await p.waitForTimeout(600); return { ctx, p, errs }; };
  // o "colega": escrita direta no banco (como chegaria de outro aparelho), com carimbo novo
  const colega = (p, campos) => p.evaluate(campos => { const ts = new Date().toISOString();
    window._update(window._ref(window._db, 'kanban/squads/site/dados/cards/k0'), Object.assign({}, campos, { updatedAt: ts }));
    window._set(window._ref(window._db, 'kanban/squads/site/dados/cards_updated_at/c1'), ts);
    // o Firebase falso não emite child_changed: entrega o evento ao vivo como o listener real faria (ver test_cards_resgate.js E4)
    setTimeout(() => { window._cardsByKey.k0 = JSON.parse(JSON.stringify(window.__store.kanban.squads.site.dados.cards.k0)); window._scheduleCardsSync(); }, 30); }, campos);
  const marcarB = p => p.evaluate(() => { document.querySelectorAll('#m-checklist input[type=checkbox]')[1].click(); scheduleAutoSave(); });
  const banco = p => p.evaluate(() => window.__store.kanban.squads.site.dados.cards.k0);
  const feitos = c => (c.checklist || []).map(x => !!x.done).join(',');
  try {
    // 1) cliques no MESMO segundo (o evento do colega ainda está na janela de 2 s): merge item a item
    { const { ctx, p, errs } = await abrir();
      await colega(p, { checklist: CL(true, false) }); await p.waitForTimeout(300);
      await marcarB(p); await p.waitForTimeout(3000);
      const c = await banco(p);
      t('cliques quase juntos: A (colega) e B (eu) ficam marcados', feitos(c) === 'true,true', feitos(c));
      t('sem erro de JS (1)', !errs.length, errs); await ctx.close(); }
    // 2) o colega mexe e depois eu: o modal mostra o que ele fez nos campos que eu não toquei
    { const { ctx, p, errs } = await abrir();
      await p.waitForTimeout(2200);
      await colega(p, { checklist: CL(true, false), desc: 'briefing do colega', participants: ['JM'], title: 'Card da campanha (BF)' }); await p.waitForTimeout(1200);
      const ui = await p.evaluate(() => ({ cl: getCL().map(x => !!x.done).join(','), desc: document.getElementById('m-desc').value, part: getParticipants().join(','), title: document.getElementById('m-title').value }));
      t('modal acompanha o checklist do colega', ui.cl === 'true,false', ui);
      t('modal acompanha descrição, título e participantes do colega', ui.desc === 'briefing do colega' && ui.title === 'Card da campanha (BF)' && ui.part === 'JM', ui);
      await marcarB(p); await p.waitForTimeout(3000);
      const c = await banco(p);
      t('depois do meu clique: A e B marcados, descrição/participante do colega intactos', feitos(c) === 'true,true' && c.desc === 'briefing do colega' && (c.participants || []).includes('JM'), { cl: feitos(c), desc: c.desc, part: c.participants });
      t('sem erro de JS (2)', !errs.length, errs); await ctx.close(); }
    // 3) estou digitando a descrição: a mudança do colega NÃO atropela o que escrevo
    { const { ctx, p } = await abrir();
      await p.waitForTimeout(2200);
      await p.evaluate(() => { const d = document.getElementById('m-desc'); d.value = 'eu estou escrevendo'; d.dispatchEvent(new Event('input', { bubbles: true })); });
      await colega(p, { desc: 'texto do colega', checklist: CL(true, false) }); await p.waitForTimeout(1200);
      const ui = await p.evaluate(() => ({ desc: document.getElementById('m-desc').value, cl: getCL().map(x => !!x.done).join(',') }));
      t('campo que estou editando fica como eu deixei', ui.desc === 'eu estou escrevendo', ui);
      t('…e o campo que não toquei (checklist) acompanha', ui.cl === 'true,false', ui);
      await ctx.close(); }
    // 4) colega acrescenta item (estrutura mudou) enquanto eu marco B: sem erro, meu clique grava (regra geral do merge)
    { const { ctx, p, errs } = await abrir();
      await colega(p, { checklist: CL(false, false).concat([{ t: 'item C', done: false, grp: 'default' }]) }); await p.waitForTimeout(300);
      await marcarB(p); await p.waitForTimeout(3000);
      const c = await banco(p);
      t('estrutura diferente: meu B gravado, sem erro', (c.checklist || [])[1] && c.checklist[1].done === true && !errs.length, { cl: c.checklist, errs });
      await ctx.close(); }
  } finally { await b.close(); srv.close(); }
  console.log(falhas ? `HÁ ${falhas} FALHA(S)` : 'TUDO OK'); process.exitCode = falhas ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; srv.close(); });
