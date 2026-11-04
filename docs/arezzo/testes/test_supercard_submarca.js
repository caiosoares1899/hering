// 🏷️ Supercard: a lista de cards filhos mostra a SUBMARCA de cada filho (pílula colorida igual à do board) — pedido do Caio, 04/11/2026. Boot REAL com Firebase falso.
//   python3 -m http.server 8941 &   node docs/arezzo/testes/test_supercard_submarca.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const K = process.env.K || 'kanban-dev'; const SQ = 'site';
const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const fl = col => ({ enteredAt: { [col]: '2026-10-20T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-10-20T12:00:00.000Z' }] });
const mk = (submarcaAtivo) => { const C = (id, t, extra) => Object.assign({ id, title: t, col: 'doing', owner: 'LV', createdAt: '2026-10-20', flow: fl('doing'), updatedAt: '2026-10-27T10:00:00.000Z' }, extra || {});
  const cs = { k0: C('p', '[BLACK FRIDAY 2026] - AÇÃO 2', { childCardIds: ['f1', 'f2', 'f3', 'f4'] }), k1: C('f1', '[BF] AÇÃO 2 - KIDS', { tags: ['tag_sm_kids_com'] }), k2: C('f2', 'Pop-up <b>Insider</b>', { tags: ['tag_sm_geral'], owner: 'HB' }), k3: C('f3', '[BF] AÇÃO 2 - SPT', { tags: ['tag_sm_sports_cad', 'x1'] }), k4: C('f4', '[BF] AÇÃO 2 - INT') };
  return { kanban: { usuarios: { ana: { uid: 'ana', nome: 'Ana', email: 'ana@ciahering.com.br', inscrito: true, init: 'AA', role: 'adm', squads: { [SQ]: true } } }, usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana', init: 'AA', role: 'adm', squads: { [SQ]: true } } }, config: { adm_emails: ['ana@ciahering.com.br'] },
    squads: { [SQ]: { dados: { columns: [{ id: 'doing', name: 'Em Validação' }, { id: 'done', name: 'Concluído', isDone: true }], tags: [{ id: 'x1', label: 'OUTRA TAG', color: '#ff8' }], config: { submarca_ativo: submarcaAtivo }, cards_index: { p: 'k0', f1: 'k1', f2: 'k2', f3: 'k3', f4: 'k4' }, cards: cs } } } } }; };
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const abre = async (ativo, vp) => { const ctx = await b.newContext({ viewport: vp || { width: 1300, height: 900 } }); await fake.install(ctx, mk(ativo)); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { errs.push('DIALOG'); d.dismiss(); });
    await p.goto('http://localhost:8941/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(3500);
    await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); openCard('p'); }); await p.waitForTimeout(900); return { ctx, p, errs }; };
  const linhas = p => p.evaluate(() => [...document.querySelectorAll('#m-super-children-list .minicard')].map(m => ({ titulo: m.querySelector('.minicard-title').innerText, meta: m.querySelector('.minicard-meta').innerText.replace(/\s+/g, ' ').trim(), sm: (m.querySelector('.minicard-sm') || {}).innerText || '' })));
  { const { ctx, p, errs } = await abre(true); const L = await linhas(p);
    t('A. 4 filhos listados', L.length === 4, L);
    t('B. o filho KIDS mostra "Hering Kids Comercial"', /Hering Kids Comercial/.test(L[0].sm), L[0]);
    t('C. "Geral" aparece como submarca; com 2 tags só a submarca entra (não a "OUTRA TAG")', /Geral/.test(L[1].sm) && /Hering Sports Cadastro/.test(L[2].sm) && !/OUTRA TAG/.test(L[2].meta), L.slice(1, 3));
    t('D. filho sem submarca, em squad que usa o campo: "🏷️ sem submarca" discreto', /sem submarca/.test(L[3].sm), L[3]);
    t('E. a coluna e o responsável continuam na linha', /Em Validação/.test(L[0].meta) && /LV/.test(L[0].meta) && /HB/.test(L[1].meta), L.map(x => x.meta));
    t('F. o título do filho vai escapado (HTML vira texto)', await p.evaluate(() => !document.querySelector('#m-super-children-list b') && /<b>Insider<\/b>/.test(document.getElementById('m-super-children-list').innerText)), L[1]);
    t('G. a pílula usa as cores do board (card-tag com fundo e borda)', await p.evaluate(() => { const e = document.querySelector('#m-super-children-list .minicard-sm .card-tag'); const s = getComputedStyle(e); return !!e && s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.borderTopColor !== 'rgba(0, 0, 0, 0)'; }), '');
    t('H. clicar na linha continua abrindo o filho', await p.evaluate(() => { const b = document.querySelector('#m-super-children-list .minicard-body'); return /_navigateToCard/.test(b.getAttribute('onclick') || ''); }), '');
    t('I. sem rolagem lateral e sem erro de JS', await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1) && errs.length === 0, errs);
    await p.locator('#m-super-children-list').screenshot({ path: '/tmp/supercard_submarca_desktop.png' });
    for (const th of ['light', 'vice']) { await p.evaluate(x => document.documentElement.setAttribute('data-theme', x), th); await p.waitForTimeout(150); t('J. tema ' + th + ': a pílula continua visível', await p.evaluate(() => { const e = document.querySelector('#m-super-children-list .minicard-sm .card-tag'); const r = e.getBoundingClientRect(); return r.width > 20 && r.height > 8 && getComputedStyle(e).color !== getComputedStyle(e).backgroundColor; }), ''); }
    await ctx.close(); }
  { const { ctx, p } = await abre(false); const L = await linhas(p);
    t('K. squad que NÃO usa submarca: filho com submarca ainda a mostra; sem submarca não mostra nada (sem ruído)', /Hering Kids Comercial/.test(L[0].sm) && L[3].sm === '' && !/sem submarca/.test(L[3].meta), L); await ctx.close(); }
  { const { ctx, p } = await abre(true, { width: 390, height: 800 }); await p.waitForTimeout(300);
    t('L. celular 390 px: sem rolagem lateral e a pílula não corta', await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 && [...document.querySelectorAll('#m-super-children-list .minicard-sm')].every(e => e.getBoundingClientRect().right <= innerWidth)), '');
    await p.locator('#m-super-children-list').screenshot({ path: '/tmp/supercard_submarca_mobile.png' }); await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1); })();
