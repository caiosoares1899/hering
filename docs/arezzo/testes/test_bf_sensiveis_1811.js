// 🔥 18/11/2026 (/monitorarbugs, áreas sensíveis para a semana da Black Friday). Reproduz 3 caminhos em que a pessoa perde trabalho ou é informada errado:
// A) versão nova publicada com o autosave pendente; B) exclusão recusada pelo save; C) restauração de backup que falha na escrita final.
// Comparar com outra versão: KANBAN_HTML=/caminho/da/versao.html node docs/arezzo/testes/test_bf_sensiveis_1811.js
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(os.homedir(), 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const ROOT = path.resolve(__dirname, '../../..');
function chrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const r = path.join(os.homedir(), 'hering-tools/chrome'), arm = fs.readdirSync(r).find(n => n.startsWith('chrome-mac') || n.startsWith('mac'));
  const base = path.join(r, arm); const achar = d => { for (const n of fs.readdirSync(d)) { const f = path.join(d, n); if (n === 'Google Chrome for Testing' && fs.statSync(f).isFile()) return f; if (fs.statSync(f).isDirectory()) { const x = achar(f); if (x) return x; } } return null; };
  return achar(base);
}
const user = { uid: 'ad', email: 'adrian@ciahering.com.br', displayName: 'Adrian Teste', providerData: [{ providerId: 'google.com' }] };
const seed = () => ({ kanban: {
  usuarios: { ad: { nome: 'Adrian Teste', email: user.email, init: 'AD', role: 'adm', inscrito: true, squads: { site: true } } },
  usuarios_publicos: { ad: { nome: 'Adrian Teste', init: 'AD', role: 'adm', inscrito: true, squads: { site: true } } },
  config: { adm_emails: [user.email] },
  squads: { site: { dados: { columns: [{ id: 'todo', name: 'To Do' }, { id: 'prog', name: 'In Progress' }],
    cards_index: { c1: 'k0', c2: 'k1' }, cards_updated_at: { c1: '2026-11-18T10:00:00.000Z', c2: '2026-11-18T10:00:00.000Z' },
    cards: { k0: { id: 'c1', title: 'Card um', col: 'todo', desc: 'texto original', updatedAt: '2026-11-18T10:00:00.000Z' }, k1: { id: 'c2', title: 'Card dois', col: 'todo', updatedAt: '2026-11-18T10:00:00.000Z' } } } } } } });
const tipos = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (process.env.KANBAN_HTML && /kanban-dev\.html$/.test(f)) f = process.env.KANBAN_HTML; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let falhas = 0; const t = (n, ok, d) => { if (!ok) falhas++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
(async () => {
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok)); const BASE = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch({ executablePath: chrome(), headless: true });
  const abrir = async () => { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' }); await fake.install(ctx, seed());
    await ctx.addInitScript(() => { try { localStorage.setItem('mare_guia_mare_visto', '1'); localStorage.setItem('mare_dicas_off', '1'); } catch (e) {} });
    const p = await ctx.newPage(); await p.goto(BASE + '/kanban-dev.html?squad=site'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(u => window.__authCb(u), user);
    await p.waitForTimeout(2500); await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open'))); return { ctx, p }; };
  const novaVersao = p => p.route(/version\.json/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ kanban_dev: 'v9.99.99-dev' }) }));
  const banco = p => p.evaluate(() => Object.values(window.__store.kanban.squads.site.dados.cards || {}).filter(Boolean));
  const semRede = p => p.evaluate(() => { window._auOfflineDesde = Date.now() - 120000; });
  try {
    { const { ctx, p } = await abrir(); await novaVersao(p);
      await p.evaluate(() => openCard('c1')); await p.waitForTimeout(900);
      await p.evaluate(() => { const el = document.getElementById('m-desc'); el.value += ' + digitado antes da versao nova'; el.dispatchEvent(new Event('input', { bubbles: true })); scheduleAutoSave(); });
      await p.evaluate(() => window._auCheckVersion()); await p.waitForTimeout(2500);
      const c = (await banco(p)).find(x => x.id === 'c1');
      t('A1. versão nova com autosave pendente: o texto digitado chega ao banco', /digitado antes da versao nova/.test(c.desc || ''), c.desc);
      t('A2. a tela de atualização aparece', await p.evaluate(() => !!document.getElementById('_au-block')), await p.evaluate(async () => { const res = await fetch('version.json?_=1', { cache: 'no-store' }); return { status: res.status, corpo: (await res.text()).slice(0, 90), versao: [...document.querySelectorAll('.version')].map(e => e.textContent.trim()), stale: window._auStale, fn: typeof window._auCheckVersion }; }));
      await ctx.close(); }
    { const { ctx, p } = await abrir(); await novaVersao(p);
      await p.evaluate(() => openNewCard()); await p.waitForTimeout(500);
      await p.evaluate(() => { for (const [id, v] of [['m-title', 'Card novo da campanha'], ['m-desc', 'briefing que ainda nao foi salvo']]) { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); } });
      await p.evaluate(() => window._auCheckVersion()); await p.waitForTimeout(800);
      const txt = await p.evaluate(() => document.getElementById('_au-block')?.innerText || '');
      const copia = await p.evaluate(() => document.getElementById('_au-block-texto')?.value || '');
      t('A3. card novo não salvo: a tela não promete que o texto fica salvo', !/fica salvo/.test(txt), txt);
      t('A4. card novo não salvo: o texto aparece para copiar', /briefing que ainda nao foi salvo/.test(copia) && /Card novo da campanha/.test(copia), copia);
      await ctx.close(); }
    { const { ctx, p } = await abrir(); await semRede(p);
      await p.evaluate(() => { selectedCards.add('c1'); window.uiConfirm = async () => true; return bulkDeleteSelected(); }); await p.waitForTimeout(800);
      const local = await p.evaluate(() => cards.some(c => c.id === 'c1')), toast = await p.evaluate(() => document.getElementById('kb-toast')?.textContent || '');
      t('B1. exclusão em massa recusada: o card continua na tela', local, '');
      t('B2. exclusão em massa recusada: não diz que excluiu', !/excluído/.test(toast) || /não/i.test(toast), toast);
      t('B3. o card continua no banco', (await banco(p)).some(c => c.id === 'c1'), '');
      await ctx.close(); }
    { const { ctx, p } = await abrir(); await semRede(p);
      await p.evaluate(() => { _ctxCardId = 'c2'; window.uiConfirm = async () => true; return ctxDelete(); }); await p.waitForTimeout(800);
      t('B4. excluir pelo menu recusado: o card continua na tela', await p.evaluate(() => cards.some(c => c.id === 'c2')), '');
      await ctx.close(); }
    { const { ctx, p } = await abrir();
      const r = await p.evaluate(async () => { window._auOfflineDesde = Date.now() - 120000; const antes = cards.map(c => c.id).join(',');
        await _applyRestorePayload({ board: { cards: [{ id: 'bk1', title: 'Do backup', col: 'todo' }], columns: [{ id: 'todo', name: 'To Do' }], tags: [] } });
        return { antes, depois: cards.map(c => c.id).join(',') }; });
      t('C1. restauração que falha não deixa o backup na memória da aba', r.antes === r.depois, r);
      await ctx.close(); }
    { const { ctx, p } = await abrir();
      await p.evaluate(() => { selectedCards.add('c1'); window.uiConfirm = async () => true; return bulkDeleteSelected(); }); await p.waitForTimeout(900);
      t('D1. exclusão com banco ok: some do banco e da tela', !(await banco(p)).some(c => c.id === 'c1') && !(await p.evaluate(() => cards.some(c => c.id === 'c1'))), await banco(p));
      t('D2. exclusão com banco ok: confirma para a pessoa', /excluído/.test(await p.evaluate(() => document.getElementById('kb-toast')?.textContent || '')), '');
      await ctx.close(); }
    { const { ctx, p } = await abrir();
      await p.evaluate(() => _applyRestorePayload({ board: { cards: [{ id: 'bk1', title: 'Do backup', col: 'todo' }], columns: [{ id: 'todo', name: 'To Do' }], tags: [] } })); await p.waitForTimeout(900);
      t('D3. restauração com banco ok: o backup entra no banco e na tela', (await banco(p)).some(c => c.id === 'bk1') && await p.evaluate(() => cards.some(c => c.id === 'bk1')), await banco(p));
      await ctx.close(); }
    { const { ctx, p } = await abrir(); await novaVersao(p);
      await p.evaluate(() => openCard('c1')); await p.waitForTimeout(900);
      await p.evaluate(() => { const el = document.getElementById('m-comment-inp'); el.value = 'comentario ainda nao enviado'; });
      await p.evaluate(() => window._auCheckVersion()); await p.waitForTimeout(500);
      t('D4. comentário não enviado aparece para copiar', /comentario ainda nao enviado/.test(await p.evaluate(() => document.getElementById('_au-block-texto')?.value || '')), '');
      await ctx.close(); }
    { const { ctx, p } = await abrir(); await novaVersao(p);
      await p.evaluate(() => window._auCheckVersion()); await p.waitForTimeout(500);
      const r = await p.evaluate(() => ({ txt: document.getElementById('_au-block')?.innerText || '', oculto: document.getElementById('_au-block-copia')?.hidden }));
      t('D5. sem nada pendente: mantém a mensagem normal e esconde a caixa', /fica salvo/.test(r.txt) && r.oculto === true, r);
      await ctx.close(); }
    { const { ctx, p } = await abrir(); await novaVersao(p);
      await p.evaluate(() => openCard('c1')); await p.waitForTimeout(900);
      await p.evaluate(() => { const orig = window._runTransaction; window._runTransaction = async (...a) => { await new Promise(r => setTimeout(r, 900)); return orig(...a); };
        window.addEventListener('beforeunload', () => { try { sessionStorage.setItem('pendentes_no_reload', String(_pendingFbWrites)); } catch (e) {} });
        const el = document.getElementById('m-desc'); el.value += ' + clique imediato'; el.dispatchEvent(new Event('input', { bubbles: true })); scheduleAutoSave(); });
      await p.evaluate(() => window._auCheckVersion());
      const nav = p.waitForNavigation({ timeout: 9000 }); await p.click('#_au-block-btn'); await nav; await p.waitForTimeout(300);
      t('E1. clicar em Atualizar na hora espera a gravação terminar', (await p.evaluate(() => sessionStorage.getItem('pendentes_no_reload'))) === '0', await p.evaluate(() => sessionStorage.getItem('pendentes_no_reload')));
      await ctx.close(); }
    { const { ctx, p } = await abrir(); await novaVersao(p);
      await p.evaluate(() => openCard('c1')); await p.waitForTimeout(900);
      await p.evaluate(() => { document.getElementById('m-priority').value = 'high'; });
      await p.evaluate(() => window._auCheckVersion()); await p.waitForTimeout(500);
      const txt = await p.evaluate(() => document.getElementById('_au-block')?.innerText || '');
      t('E2. card existente com prioridade sem salvar: avisa e não promete', !/fica salvo/.test(txt) && /sem salvar/.test(txt), txt);
      await ctx.close(); }
    { const { ctx, p } = await abrir(); await novaVersao(p);
      await p.evaluate(() => openNewCard()); await p.waitForTimeout(500);
      await p.evaluate(() => { document.getElementById('m-priority').value = 'high'; });
      await p.evaluate(() => window._auCheckVersion()); await p.waitForTimeout(500);
      const txt = await p.evaluate(() => document.getElementById('_au-block')?.innerText || '');
      t('E3. card novo só com prioridade: avisa e não promete', !/fica salvo/.test(txt) && /sem salvar/.test(txt), txt);
      await ctx.close(); }
  } finally { await b.close(); srv.close(); }
  console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo'); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
