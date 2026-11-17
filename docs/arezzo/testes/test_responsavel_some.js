// 🐞 17/11/2026 — "o Maré me tira como responsável do card" (Mídia Criativa). Com o card aberto, qualquer escrita em
// kanban/usuarios_publicos (alguém entra no Maré e o login regrava o perfil) redesenhava o campo Responsável e zerava a
// seleção; o próximo autosave gravava o card sem dono. 2º caminho: responsável fora da lista do time abria o campo vazio.
// Boot real + Firebase falso. KANBAN_HTML=/caminho compara outra versão (ex.: a main) sem trocar o arquivo no disco.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(os.homedir(), 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const ROOT = path.resolve(__dirname, '../../..');
function chrome() { if (process.env.CHROME) return process.env.CHROME; const r = path.join(os.homedir(), 'hering-tools/chrome'), arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-')); return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'); }
const user = { uid: 'ad', email: 'adrian@ciahering.com.br', displayName: 'Adrian Teste', providerData: [{ providerId: 'google.com' }] };
const pub = (n, i) => ({ nome: n, init: i, role: 'membro', inscrito: true, squads: { site: true } });
const seed = () => ({ kanban: {
  usuarios: { ad: { nome: 'Adrian Teste', email: user.email, init: 'AD', role: 'membro', inscrito: true, squads: { site: true }, diretoria: 'digital' } },
  usuarios_publicos: { ad: pub('Adrian Teste', 'AD'), jm: pub('Juliana Teste', 'JM'), rf: pub('Roberta Teste', 'RF') },
  config: { adm_emails: [] },
  squads: { site: { dados: { columns: [{ id: 'todo', name: 'To Do' }, { id: 'prog', name: 'In Progress' }],
    cards_index: { c1: 'k0', c2: 'k1' },
    cards: { k0: { id: 'c1', title: 'Card do Adrian', col: 'prog', owner: 'AD', desc: '', updatedAt: '2026-11-17T10:00:00.000Z' },
             k1: { id: 'c2', title: 'Card de quem saiu do time', col: 'prog', owner: 'ZZ', desc: '', updatedAt: '2026-11-17T10:00:00.000Z' } } } } } } });
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
    await p.waitForTimeout(2500); await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open'))); return { ctx, p, errs }; };
  const dono = (p, k) => p.evaluate(k => window.__store.kanban.squads.site.dados.cards[k].owner, k);
  const editar = async (p, txt) => { await p.evaluate(x => { const d = document.getElementById('m-desc'); d.value = x; d.dispatchEvent(new Event('input', { bubbles: true })); scheduleAutoSave(); }, txt); await p.waitForTimeout(2000); };
  try {
    // 1) card aberto + alguém entra no Maré (regrava usuarios_publicos) + edição → dono continua AD
    { const { ctx, p, errs } = await abrir();
      await p.evaluate(() => openCard('c1')); await p.waitForTimeout(600);
      t('card aberto mostra AD no Responsável', await p.evaluate(() => document.getElementById('m-owner').value) === 'AD', '');
      await p.evaluate(() => window._update(window._ref(window._db, 'kanban/usuarios_publicos/jm'), { foto: 'https://exemplo/foto.png' })); // a Juliana entrou no Maré
      await p.waitForTimeout(500);
      t('depois do login de outra pessoa, o campo continua em AD', await p.evaluate(() => document.getElementById('m-owner').value) === 'AD', await p.evaluate(() => document.getElementById('m-owner').value));
      await editar(p, 'marquei um item');
      t('a próxima edição (autosave) NÃO apaga o responsável', await dono(p, 'k0') === 'AD', await dono(p, 'k0'));
      const h = await p.evaluate(() => (window.__store.kanban.squads.site.dados.cards.k0.history || []).map(x => x.what).join(' | '));
      t('histórico sem "removeu responsável"', !/removeu responsável/.test(h), h);
      // a pessoa troca de propósito: continua funcionando
      await p.evaluate(() => { const s = document.getElementById('m-owner'); s.value = 'RF'; s.dispatchEvent(new Event('change', { bubbles: true })); scheduleAutoSave(); }); await p.waitForTimeout(2000);
      await p.evaluate(() => window._update(window._ref(window._db, 'kanban/usuarios_publicos/jm'), { foto: 'https://exemplo/foto2.png' })); await p.waitForTimeout(500);
      t('troca de propósito (→ RF) vale e sobrevive a outro login', await dono(p, 'k0') === 'RF' && await p.evaluate(() => document.getElementById('m-owner').value) === 'RF', [await dono(p, 'k0')]);
      t('sem erro de JS', !errs.length, errs);
      await ctx.close(); }
    // 2) responsável fora da lista do time: abrir + editar não apaga o dono
    { const { ctx, p } = await abrir();
      await p.evaluate(() => openCard('c2')); await p.waitForTimeout(600);
      t('card com responsável fora do time abre com a sigla (ZZ) no campo', await p.evaluate(() => document.getElementById('m-owner').value) === 'ZZ', await p.evaluate(() => document.getElementById('m-owner').value));
      await editar(p, 'edição qualquer');
      t('editar outro campo não apaga o dono (ZZ)', await dono(p, 'k1') === 'ZZ', await dono(p, 'k1'));
      await ctx.close(); }
  } finally { await b.close(); srv.close(); }
  console.log(falhas ? `HÁ ${falhas} FALHA(S)` : 'TUDO OK'); process.exitCode = falhas ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; srv.close(); });
