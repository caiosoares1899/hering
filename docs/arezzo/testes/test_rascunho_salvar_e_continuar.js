// 💾 "Salvar e continuar" (16/11/2026, relato do time): card ainda não salvo — ex.: "+ Usar" de um Modelo — não deixava pôr link
// (sumia sem aviso) nem comentar/marcar ninguém. Agora comentar/pôr link pede o salvamento com as MESMAS checagens do 💾 Salvar
// (inclusive os obrigatórios do Modelo) e, confirmado, o modal reabre no card de verdade e a ação acontece nele.
// Boot real + Firebase falso. Uso: node docs/arezzo/testes/test_rascunho_salvar_e_continuar.js   (sobe o próprio servidor)
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
const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Teste', providerData: [{ providerId: 'google.com' }] };
const seed = () => ({ kanban: {
  usuarios: { ana: { uid: 'ana', nome: 'Ana Teste', email: U.email, init: 'AT', role: 'membro', inscrito: true, squads: { site: true }, diretoria: 'digital' } },
  usuarios_publicos: { ana: { nome: 'Ana Teste', init: 'AT', role: 'membro', squads: { site: true } } }, config: { adm_emails: [] }, squads_meta: {},
  squads: { site: { dados: { columns: [{ id: 'todo', name: 'A fazer' }], cards_index: {}, cards: {} } } } } });
const MODELOS = [
  { title: 'Modelo Campanha', desc: 'roteiro', checklist: [{ t: 'Arte', text: 'Arte', done: false }], requiredFields: ['owner'] },
  { title: 'Modelo com prazo obrigatório', requiredFields: ['due'] },
];
const tipos = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
let falhas = 0;
const t = (n, ok, d) => { if (!ok) falhas++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
(async () => {
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok)); const BASE = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch({ executablePath: chrome(), headless: true });
  async function abrir() {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed());
    await ctx.addInitScript(() => { try { localStorage.setItem('mare_guia_mare_visto', '1'); localStorage.setItem('bvmd_ana', '1'); localStorage.setItem('mare_dicas_off', '1'); } catch (e) {} });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/' + PAG + '.html?squad=site'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(u => window.__authCb(u), U); await p.waitForTimeout(2300);
    await p.evaluate(m => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); qlItems.modelos = m; currentQL = 'modelos'; }, MODELOS);
    return { ctx, p, errs };
  }
  const banco = p => p.evaluate(() => { const d = window.__store.kanban.squads.site.dados; return { cards: Object.values(d.cards || {}).filter(Boolean), comentarios: d.card_comments || {} }; });
  try {
    // 1) comentar num rascunho de Modelo
    { const { ctx, p, errs } = await abrir();
      await p.evaluate(() => { usarQLItem(0); document.getElementById('m-due').value = '2026-12-01'; }); await p.waitForTimeout(400);
      t('rascunho do Modelo: ainda sem card (editingId nulo) e a lista avisa que comentar salva antes', await p.evaluate(() => editingId === null && /ao comentar, ele é salvo antes/.test(document.getElementById('m-comment-list').textContent)), '');
      await p.evaluate(() => { document.getElementById('m-comment-inp').value = 'primeiro comentário'; submitComment(); }); await p.waitForTimeout(1600);
      const db = await banco(p); const novo = db.cards.find(c => c.title === 'Modelo Campanha');
      t('comentar no rascunho: o card é criado (com o conteúdo do Modelo)', !!novo && novo.desc === 'roteiro', db.cards.map(c => c.title));
      t('…o modal reabre no card de verdade (editingId = o card novo)', novo && await p.evaluate(id => editingId === id && document.getElementById('card-ov').classList.contains('open'), novo.id), '');
      t('…e o comentário é publicado nele', novo && Object.values(db.comentarios[novo.id] || {}).some(c => c.text === 'primeiro comentário'), db.comentarios);
      // agora o link e o 2º comentário funcionam direto (card já existe)
      await p.evaluate(() => { attachToggleAdd(); document.getElementById('m-attach-url').value = 'https://exemplo.com/a'; attachSave(); }); await p.waitForTimeout(800);
      const db2 = await banco(p);
      t('depois disso, link entra normal', (db2.cards.find(c => c.id === novo.id).links || []).some(l => l.url === 'https://exemplo.com/a'), '');
      t('um card só (sem duplicar no salvamento)', db2.cards.filter(c => c.title === 'Modelo Campanha').length === 1, db2.cards.length);
      t('sem erro de JS', !errs.length, errs);
      await ctx.close(); }
    // 2) link num rascunho (antes sumia sem aviso)
    { const { ctx, p } = await abrir();
      await p.evaluate(() => { usarQLItem(0); document.getElementById('m-due').value = '2026-12-01'; }); await p.waitForTimeout(400);
      await p.evaluate(() => { attachToggleAdd(); document.getElementById('m-attach-url').value = 'https://exemplo.com/link'; attachSave(); }); await p.waitForTimeout(1600);
      const db = await banco(p); const novo = db.cards.find(c => c.title === 'Modelo Campanha');
      t('link no rascunho: salva o card e o link fica nele (antes sumia sem aviso)', !!novo && (novo.links || []).some(l => l.url === 'https://exemplo.com/link'), novo);
      t('…e o modal segue aberto no card de verdade', novo && await p.evaluate(id => editingId === id, novo.id), '');
      await ctx.close(); }
    // 3) obrigatório do Modelo faltando: nada é criado, texto preservado
    { const { ctx, p } = await abrir();
      await p.evaluate(() => usarQLItem(1)); await p.waitForTimeout(400);
      await p.evaluate(() => { document.getElementById('m-comment-inp').value = 'não pode perder'; submitComment(); }); await p.waitForTimeout(1200);
      const db = await banco(p);
      t('obrigatório faltando (prazo — do Modelo e do board): nenhum card criado', db.cards.length === 0, db.cards.map(c => c.title));
      t('…o rascunho continua aberto e o comentário digitado fica no campo', await p.evaluate(() => editingId === null && document.getElementById('card-ov').classList.contains('open') && document.getElementById('m-comment-inp').value === 'não pode perder'), '');
      // preenche o prazo e tenta de novo
      await p.evaluate(() => { document.getElementById('m-due').value = '2026-12-01'; submitComment(); }); await p.waitForTimeout(1600);
      const db2 = await banco(p); const novo = db2.cards.find(c => c.title === 'Modelo com prazo obrigatório');
      t('com o prazo preenchido: cria o card e publica o comentário', !!novo && Object.values(db2.comentarios[novo.id] || {}).some(c => c.text === 'não pode perder'), db2);
      await ctx.close(); }
    // 4) card novo comum sem título: nada é criado
    { const { ctx, p } = await abrir();
      await p.evaluate(() => { openNewCard(); document.getElementById('m-title').value = ''; document.getElementById('m-comment-inp').value = 'x'; submitComment(); }); await p.waitForTimeout(1000);
      t('card novo sem título: comentar não cria nada', (await banco(p)).cards.length === 0, '');
      await ctx.close(); }
    // 5) card que já existe: nada muda (fecha normal ao salvar)
    { const { ctx, p } = await abrir();
      await p.evaluate(() => { openNewCard(); document.getElementById('m-title').value = 'Card comum'; document.getElementById('m-due').value = '2026-12-01'; saveCard(); }); await p.waitForTimeout(1500);
      t('salvar um card novo pelo 💾 continua FECHANDO o modal (só o "salvar e continuar" reabre)', await p.evaluate(() => !document.getElementById('card-ov').classList.contains('open')), '');
      await ctx.close(); }
  } finally { await b.close(); srv.close(); }
  console.log(falhas ? `HÁ ${falhas} FALHA(S)` : 'TUDO OK'); process.exitCode = falhas ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; srv.close(); });
