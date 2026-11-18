// 💬 17/11/2026 — comentário aparece na hora como "⏳ enviando…" e só vira normal quando o banco confirma; recusado, sai da lista e o texto volta ao campo.
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
  squads: { site: { dados: { columns: [{ id: 'todo', name: 'To Do' }], cards_index: { c1: 'k0' },
    cards: { k0: { id: 'c1', title: 'Card', col: 'todo', owner: 'AD', updatedAt: '2026-11-17T10:00:00.000Z' } } } } } } });
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
    await p.evaluate(() => openCard('c1')); await p.waitForTimeout(800); return { ctx, p, errs }; };
  const lista = p => p.evaluate(() => [...document.querySelectorAll('#m-comment-list .comment-item')].map(el => ({ txt: el.querySelector('.comment-text')?.textContent || '', enviando: el.classList.contains('comment-enviando'), selo: !!el.querySelector('.cmt-enviando'), acoes: !!el.querySelector('.comment-actions') })));
  const enviar = (p, txt) => p.evaluate(txt => { const i = document.getElementById('m-comment-inp'); i.value = txt; submitComment(); }, txt);
  const banco = p => p.evaluate(() => Object.values(((window.__store.kanban.squads.site.dados.card_comments || {}).c1) || {}));
  try {
    { const { ctx, p, errs } = await abrir();
      await p.evaluate(() => { window.__setDelay = pa => /card_comments/.test(pa) ? 1500 : 0; });
      await enviar(p, 'oi time'); await p.waitForTimeout(300);
      let l = await lista(p);
      t('aparece na hora com "⏳ enviando…" e sem botões', l.length === 1 && l[0].txt.includes('oi time') && l[0].enviando && l[0].selo && !l[0].acoes, l);
      t('campo limpo enquanto envia', await p.evaluate(() => document.getElementById('m-comment-inp').value) === '', '');
      await p.waitForTimeout(1800);
      l = await lista(p);
      t('banco confirmou: vira comentário normal, com ações', l.length === 1 && !l[0].enviando && !l[0].selo && l[0].acoes, l);
      const db = await banco(p);
      t('gravado no banco sem a marca de "enviando"', db.length === 1 && db[0].text === 'oi time' && !('_enviando' in db[0]), db);
      t('sem erro de JS (1)', !errs.length, errs); await ctx.close(); }
    { const { ctx, p, errs } = await abrir();
      await p.evaluate(() => { window.__setDelay = pa => /card_comments/.test(pa) ? 800 : 0; window.__denySet = pa => /card_comments/.test(pa); });
      await enviar(p, 'vai ser recusado'); await p.waitForTimeout(250);
      t('recusado: primeiro aparece como enviando', (await lista(p)).some(x => x.enviando), await lista(p));
      await p.waitForTimeout(1200);
      t('recusado: sai da lista', !(await lista(p)).some(x => x.txt.includes('vai ser recusado')), await lista(p));
      t('recusado: o texto volta ao campo', await p.evaluate(() => document.getElementById('m-comment-inp').value) === 'vai ser recusado', await p.evaluate(() => document.getElementById('m-comment-inp').value));
      t('recusado: nada no banco', (await banco(p)).length === 0, await banco(p));
      t('sem erro de JS (2)', !errs.length, errs); await ctx.close(); }
    { const { ctx, p, errs } = await abrir();
      await p.evaluate(() => {
        window.__setDelay = pa => /card_comments/.test(pa) ? 600 : 0;
        window.__denySet = pa => /card_comments/.test(pa);
        window.__mencoes = [];
        parseMentions = (...args) => window.__mencoes.push(args);
      });
      await enviar(p, 'primeiro texto');
      const cid = await p.locator('#m-comment-list .comment-item').getAttribute('data-cid');
      const campo = p.locator('#m-comment-inp');
      await campo.evaluate(el => { el.value = 'segundo rascunho'; });
      await p.waitForTimeout(850);
      const item = p.locator('#m-comment-list .comment-item').filter({ hasText: 'primeiro texto' });
      const retry = item.getByRole('button', { name: 'Tentar novamente' });
      t('recusa com novo rascunho: primeiro texto continua com opção de reenvio', await retry.count() === 1 && (await item.textContent()).includes('Falha ao enviar'), await lista(p));
      t('segundo rascunho preservado, sem gravação nem menção', await campo.inputValue() === 'segundo rascunho' && (await banco(p)).length === 0 && await p.evaluate(() => window.__mencoes.length === 0), '');
      if (await retry.count()) {
        await p.evaluate(() => loadComments('c1'));
        t('recarregar comentários preserva o item local sem contá-lo no índice', await retry.count() === 1 && await p.evaluate(() => !(window._commentCounts.c1 || 0)), '');
        await p.evaluate(() => { window.__denySet = null; });
        await retry.evaluate(el => { el.click(); el.click(); });
        t('reenvio pendente: mantém o rascunho e aguarda confirmação para mencionar', await campo.inputValue() === 'segundo rascunho' && await p.evaluate(() => window.__mencoes.length === 0), '');
        await p.waitForTimeout(850);
        const db = await banco(p);
        t('reenvio confirmado: mesmo ID, uma gravação e uma menção', db.length === 1 && db[0].id === cid && db[0].text === 'primeiro texto' && !('_enviando' in db[0]) && !('_falhou' in db[0]) && await p.evaluate(() => window.__mencoes.length === 1), db);
        t('comentário confirmado volta às ações normais', (await lista(p)).some(x => x.txt.includes('primeiro texto') && x.acoes && !x.enviando), await lista(p));
      }
      t('sem erro de JS (3)', !errs.length, errs); await ctx.close(); }
  } finally { await b.close(); srv.close(); }
  console.log(falhas ? `HÁ ${falhas} FALHA(S)` : 'TUDO OK'); process.exitCode = falhas ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; srv.close(); });
