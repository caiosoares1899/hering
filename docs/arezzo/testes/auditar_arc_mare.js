// Auditoria Arc UI no Maré (17/11/2026): foco por teclado visível, hover que gruda no toque, números estáveis e o botão Salvar
// do card. Boot real + Firebase falso. Uso: node docs/arezzo/testes/auditar_arc_mare.js [OUT=pasta de prints]
// KANBAN_HTML=/caminho/arquivo.html compara outra versão (ex.: a da main) sem trocar o arquivo no disco.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), os = require('node:os');
const PW = process.env.PLAYWRIGHT_MODULE || path.join(os.homedir(), 'hering-tools/playwright/node_modules/playwright');
const { chromium } = require(PW);
const fake = require('./fakefb');
const ROOT = path.resolve(__dirname, '../../..');
const OUT = process.env.OUT || ''; if (OUT) fs.mkdirSync(OUT, { recursive: true });
function chrome() { if (process.env.CHROME) return process.env.CHROME; const r = path.join(os.homedir(), 'hering-tools/chrome'), arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-')); return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'); }
const user = { uid: 'teste', email: 'teste@ciahering.com.br', displayName: 'Pessoa Teste', providerData: [{ providerId: 'google.com' }] };
const cols = [{ id: 'todo', name: 'A fazer' }, { id: 'doing', name: 'Em andamento' }, { id: 'rev', name: 'Revisão' }, { id: 'done', name: 'Concluído', isDone: true }];
const seed = () => { const cards = {}, idx = {}; for (let i = 0; i < 40; i++) { const k = 'k' + i; cards[k] = { id: 'c' + i, title: 'Card ' + i + (i % 5 ? '' : ' com um título bem longo para ver quebra de linha'), col: cols[i % 4].id, owner: i % 3 ? 'PT' : '', priority: ['low', 'medium', 'high', 'critical'][i % 4], due: '2026-11-' + String(10 + (i % 15)).padStart(2, '0'), createdAt: '2026-11-01', updatedAt: '2026-11-10T12:00:00.000Z', checklist: i % 2 ? [{ t: 'a', done: true }, { t: 'b', done: false }] : [] }; idx['c' + i] = k; }
  return { kanban: { usuarios: { teste: { nome: 'Pessoa Teste', email: user.email, init: 'PT', role: 'po', inscrito: true, squads: { site: true }, diretoria: 'digital' } }, usuarios_publicos: { teste: { nome: 'Pessoa Teste', init: 'PT', role: 'po', inscrito: true, squads: { site: true }, diretoria: 'digital' } }, config: { adm_emails: [] }, squads: { site: { dados: { columns: cols, cards, cards_index: idx } } } } }; };
const tipos = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (process.env.KANBAN_HTML && /kanban-dev\.html$/.test(f)) f = process.env.KANBAN_HTML; if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
let falhas = 0; const t = (n, ok, d) => { if (!ok) falhas++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 600))); };
(async () => {
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok)); const BASE = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch({ executablePath: chrome(), headless: true });
  async function abrir(w, h, touch, tema) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch && w < 600 });
    await fake.install(ctx, seed());
    await ctx.addInitScript(tm => { try { localStorage.setItem('mare_guia_mare_visto', '1'); localStorage.setItem('mare_dicas_off', '1'); localStorage.setItem('bvmd_teste', '1'); if (tm) localStorage.setItem('mare_theme', tm); } catch (e) {} }, tema || '');
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/kanban-dev.html?squad=site'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(u => window.__authCb(u), user);
    await p.waitForTimeout(2500); await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')));
    return { ctx, p, errs };
  }
  try {
    // A) foco por teclado: cada parada do Tab (até 70) precisa de indicador visível (outline ou box-shadow diferente do sem foco)
    for (const tema of ['', 'light', 'vice']) {
      const { ctx, p, errs } = await abrir(1280, 900, false, tema);
      await p.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
      const sem = [];
      for (let i = 0; i < 70; i++) {
        await p.keyboard.press('Tab');
        const r = await p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null;
          const cs = getComputedStyle(e); const vis = e.getBoundingClientRect(); if (vis.width === 0) return null;
          const temOutline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
          const fs = cs.boxShadow; e.blur(); const ns = getComputedStyle(e).boxShadow; e.focus({ preventScroll: true });
          return { nome: (e.getAttribute('aria-label') || e.title || e.textContent || e.id || e.className).trim().slice(0, 40), tag: e.tagName, id: e.id, cls: String(e.className).slice(0, 40), ok: temOutline || fs !== ns }; });
        if (r && !r.ok) sem.push(r);
      }
      const unicos = [...new Map(sem.map(s => [s.tag + s.id + s.cls, s])).values()];
      t('foco por teclado visível em todas as paradas do Tab (1280, ' + (tema || 'abrolhos') + ')', unicos.length === 0, unicos);
      t('sem erro de JS (' + (tema || 'abrolhos') + ')', !errs.length, errs);
      await ctx.close();
    }
    // B) toque em tablet (sem mouse): :hover forçado pelo DevTools não pode levantar o card (no iPad o hover gruda após o toque)
    for (const [tw, th] of [[834, 1112], [1180, 820]]) { const { ctx, p } = await abrir(tw, th, true, '');
      const ctx2 = ctx; const cdp = await ctx2.newCDPSession(p);
      await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'hover', value: 'none' }, { name: 'pointer', value: 'coarse' }] });
      t('tablet: ambiente sem mouse (hover:none)', await p.evaluate(() => matchMedia('(hover:none)').matches), '');
      await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
      const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.card' });
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] });
      await p.waitForTimeout(500); // o card tem transition: ler na hora devolve o valor inicial da transição (falso verde)
      const r = await p.evaluate(() => { const c = document.querySelector('.card'); return { hover: c.matches(':hover'), transform: getComputedStyle(c).transform }; });
      t('tablet '+tw+' px: card em :hover continua no lugar (sem translateY)', r.hover && (r.transform === 'none' || r.transform === 'matrix(1, 0, 0, 1, 0, 0)'), r);
      await ctx.close(); }
    // B2) mouse de verdade: o hover continua levantando o card (não tiramos o efeito de quem tem mouse)
    { const { ctx, p } = await abrir(1280, 900, false, '');
      await p.locator('.card').first().hover(); await p.waitForTimeout(250);
      const tr = await p.evaluate(() => getComputedStyle(document.querySelector('.card')).transform);
      t('desktop (mouse): hover ainda levanta o card', tr !== 'none' && tr !== 'matrix(1, 0, 0, 1, 0, 0)', tr);
      await ctx.close(); }
    // D) salvamento automático: o "✓ Salvo" aparece no 💾 Salvar (não no "Salvar impedimento" escondido) e não gruda
    { const { ctx, p, errs } = await abrir(1280, 900, false, '');
      await p.evaluate(() => openCard('c1')); await p.waitForTimeout(600);
      const imp0 = await p.evaluate(() => [...document.querySelectorAll('#m-blocker-row .btn-p')].map(b => b.textContent).join('|'));
      await p.evaluate(() => { const d = document.getElementById('m-desc'); d.value = 'texto 1'; d.dispatchEvent(new Event('input', { bubbles: true })); scheduleAutoSave(); });
      let viu = false; for (let i = 0; i < 30 && !viu; i++) { await p.waitForTimeout(100); viu = await p.evaluate(() => document.getElementById('btn-save-card').textContent.includes('✓ Salvo')); }
      t('autosave: "✓ Salvo" aparece no botão 💾 Salvar', viu, await p.evaluate(() => document.getElementById('btn-save-card').textContent));
      t('…e o "Salvar impedimento" (escondido) não muda', await p.evaluate(() => [...document.querySelectorAll('#m-blocker-row .btn-p')].map(b => b.textContent).join('|')) === imp0, '');
      // 2 salvamentos com menos de 1,2 s entre eles: o botão não pode ficar preso em "✓ Salvo"
      await p.evaluate(() => { const d = document.getElementById('m-desc'); d.value = 'texto 2'; scheduleAutoSave(); });
      await p.waitForTimeout(1000);
      await p.evaluate(() => { const d = document.getElementById('m-desc'); d.value = 'texto 3'; scheduleAutoSave(); });
      await p.waitForTimeout(3500);
      const fim = await p.evaluate(() => document.getElementById('btn-save-card').textContent);
      t('2 salvamentos seguidos: o botão volta a "💾 Salvar…" (não gruda em "✓ Salvo")', /^💾 Salvar/.test(fim), fim);
      t('sem erro de JS (autosave)', !errs.length, errs);
      await ctx.close(); }
    // C) números que mudam com largura estável
    { const { ctx, p } = await abrir(1280, 900, false, '');
      const r = await p.evaluate(() => [...document.querySelectorAll('.col-cnt')].slice(0, 4).map(e => getComputedStyle(e).fontVariantNumeric));
      t('contador de cards da coluna com tabular-nums', r.length && r.every(v => /tabular-nums/.test(v)), r);
      await ctx.close(); }
  } finally { await b.close(); srv.close(); }
  console.log(falhas ? `HÁ ${falhas} FALHA(S)` : 'TUDO OK'); process.exitCode = falhas ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; srv.close(); });
