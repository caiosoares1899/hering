// 🍎 Maré: os menus ↕ Ordenação e 🔍 Fonte da toolbar abrem FORA de qualquer contêiner de rolagem (no Safari/Mac, dentro da barra rolável o menu ficava invisível e o clique "não fazia nada").
// Chromium não reproduz o recorte do WebKit; o teste garante a invariante que o evita (menu aberto = filho direto do <body>, sem ancestral com overflow) e que tudo segue funcionando.
//   python3 -m http.server 8941 &   node docs/arezzo/testes/test_menus_toolbar.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const K = process.env.K || 'kanban-dev'; const SQ = 'midiacriativa';
const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const mk = () => ({ kanban: { usuarios: { ana: { uid: 'ana', nome: 'Ana', email: 'ana@ciahering.com.br', inscrito: true, init: 'AA', role: 'adm', squads: { [SQ]: true } } }, usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana', init: 'AA', role: 'adm', squads: { [SQ]: true } } }, config: { adm_emails: ['ana@ciahering.com.br'] },
  squads: { [SQ]: { dados: { columns: [{ id: 'todo', name: 'A fazer' }, { id: 'done', name: 'Concluído', isDone: true }], tags: [], cards_index: { c1: 'k1', c2: 'k2', c3: 'k3' }, cards: { k1: { id: 'c1', title: 'Beta', col: 'todo', owner: 'AA' }, k2: { id: 'c2', title: 'Alfa', col: 'todo', owner: 'AA' }, k3: { id: 'c3', title: 'Charlie', col: 'todo', owner: 'AA' } } } } } } });
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const ctx = await b.newContext({ viewport: { width: 1300, height: 800 } }); await fake.install(ctx, mk()); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8941/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(3500);
  await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')));
  const inv = (id) => p.evaluate(i => { const m = document.getElementById(i); if (!m) return { existe: false }; const anc = []; for (let e = m.parentElement; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.overflowX !== 'visible' || s.overflowY !== 'visible') anc.push((e.id || e.className || e.tagName).toString().slice(0, 30)); } const r = m.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + 20); return { existe: true, filhoDoBody: m.parentNode === document.body, ancestraisComOverflow: anc.filter(a => !/^(BODY|HTML)$/.test(a)), visivel: getComputedStyle(m).display !== 'none' && r.width > 100 && r.height > 100, descoberto: !!top && m.contains(top), rect: [Math.round(r.left), Math.round(r.top)] }; }, id);
  for (const [nome, btn, menu] of [['Ordenação', '#btn-sort', 'sort-menu'], ['Fonte', '#btn-fontsize', 'fontsize-menu']]) {
    await p.click(btn); await p.waitForTimeout(300); const r = await inv(menu);
    t(nome + ': ao abrir o menu vai para o <body> (fora da barra rolável) e fica visível e descoberto', r.filhoDoBody && r.ancestraisComOverflow.length === 0 && r.visivel && r.descoberto, r);
    const bt = await p.evaluate(x => { const a = document.querySelector(x).getBoundingClientRect(); return [Math.round(a.left), Math.round(a.bottom + 6)]; }, btn);
    t(nome + ': aparece logo abaixo do botão', Math.abs(r.rect[0] - bt[0]) <= 2 && Math.abs(r.rect[1] - bt[1]) <= 3, [r.rect, bt]);
    await p.click(btn); await p.waitForTimeout(200); t(nome + ': clicar de novo no botão fecha', (await p.evaluate(m => getComputedStyle(document.getElementById(m)).display, menu)) === 'none', '');
    await p.click(btn); await p.waitForTimeout(200); await p.evaluate(() => document.body.click()); await p.waitForTimeout(200);
    t(nome + ': clicar fora fecha', (await p.evaluate(m => getComputedStyle(document.getElementById(m)).display, menu)) === 'none', ''); }
  // funciona de verdade, e várias vezes seguidas
  const ord = () => p.evaluate(() => [...document.querySelectorAll('.col')[0].querySelectorAll('.card-title')].map(e => e.innerText.trim()));
  await p.click('#btn-sort'); await p.waitForTimeout(200); await p.click('#sort-menu button:has-text("Alfabética")'); await p.waitForTimeout(500);
  t('Ordenação → Alfabética reordena (Alfa, Beta, Charlie) e o menu fecha', JSON.stringify(await ord()) === JSON.stringify(['Alfa', 'Beta', 'Charlie']) && (await p.evaluate(() => getComputedStyle(document.getElementById('sort-menu')).display)) === 'none', await ord());
  await p.click('#btn-sort'); await p.waitForTimeout(200); await p.click('#sort-menu button:has-text("Prioridade")'); await p.waitForTimeout(400);
  t('abrir o menu uma 2ª vez depois de ele ter ido pro <body> continua funcionando', (await p.evaluate(() => colSortMode)) === 'priority', await p.evaluate(() => colSortMode));
  await p.click('#btn-fontsize'); await p.waitForTimeout(200); await p.click('#fontsize-menu button:has-text("Grande")'); await p.waitForTimeout(500);
  t('Fonte → Grande aplica (rótulo "Grande") e o menu fecha', /Grande/.test(await p.locator('#btn-fontsize').innerText()) && (await p.evaluate(() => getComputedStyle(document.getElementById('fontsize-menu')).display)) === 'none', await p.locator('#btn-fontsize').innerText());
  await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(300); await p.click('#btn-sort').catch(() => { }); await p.waitForTimeout(300);
  const m = await inv('sort-menu'); t('celular 390 px: o menu também abre no <body> e visível', m.filhoDoBody && m.visivel, m);
  t('sem erro de JS', errs.length === 0, errs);
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1); })();
