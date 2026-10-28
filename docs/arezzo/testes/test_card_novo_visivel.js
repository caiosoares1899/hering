// 🆕 Card recém-criado precisa APARECER no board (relato de produção 2026-10-28, squad midiacriativa, Black Friday: "estou abrindo cards e eles estão sumindo").
// Causa: cada coluna só renderiza os 80 primeiros cards (_colRenderLimit, "▼ Ver mais N ocultos") e nada expandia o limite na criação — o card novo era criado e
// gravado, mas ficava escondido atrás do "Ver mais". Boot REAL do Maré com Firebase falso. K=kanban roda o MESMO teste na produção (os cenários A devem FALHAR lá).
//   python3 -m http.server 8941 &   node docs/arezzo/testes/test_card_novo_visivel.js        (K=kanban para a produção)
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const K = process.env.K || 'kanban-dev'; const SQ = 'midiacriativa';
const U = (uid, n) => ({ uid, email: uid + '@ciahering.com.br', displayName: n, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const flow = col => ({ enteredAt: { [col]: '2026-10-20T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-10-20T12:00:00.000Z' }], firstStartAt: null, doneAt: null });
const montaSeed = n => { const cs = {}, idx = {}, upd = {}; for (let i = 0; i < n; i++) { cs[i] = { id: 'c' + i, title: 'Card ' + i, col: 'backlog', priority: 'high', createdAt: '2026-10-20', flow: flow('backlog'), updatedAt: '2026-10-26T10:00:00.000Z', created: 'EV', owner: 'EV' }; idx['c' + i] = String(i); upd['c' + i] = cs[i].updatedAt; }
  return { kanban: { usuarios: { eve: { uid: 'eve', nome: 'Eve', email: 'eve@ciahering.com.br', inscrito: true, init: 'EV', role: 'po', squads: { [SQ]: true } } }, usuarios_publicos: { eve: { uid: 'eve', nome: 'Eve', init: 'EV', role: 'po', squads: { [SQ]: true } } }, config: { adm_emails: [] },
    squads: { [SQ]: { dados: { cards: cs, cards_index: idx, cards_updated_at: upd, columns: [{ id: 'backlog', name: 'Backlog' }, { id: 'done', name: 'Concluído', isDone: true }] } } } } }; };
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const abre = async n => { const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }); await fake.install(ctx, montaSeed(n)); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8941/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U('eve', 'Eve')); await p.waitForTimeout(4000);
    await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); window.__toasts = []; const o = window.showToast; window.showToast = m => { window.__toasts.push(String(m)); return o && o.apply(this, arguments); }; }); return { ctx, p, errs }; };
  // cria um card "como o saveCard() faz": entra em cards[], vai pelo fbCreateCard() e o chamador redesenha o board
  const cria = (p, extra) => p.evaluate(async ex => { const n = Object.assign({ id: 'cBF1', title: 'CARD NOVO DA BLACK FRIDAY', col: 'backlog', priority: 'medium', createdAt: '2026-10-28', created: 'EV', owner: 'EV', tags: [], checklist: [], flow: { enteredAt: { backlog: new Date().toISOString() }, log: [], firstStartAt: null, doneAt: null }, updatedAt: new Date().toISOString() }, ex || {});
    cards.push(n); await fbCreateCard(n); renderBoard(); await new Promise(r => setTimeout(r, 600));
    return { noDom: !!document.querySelector('#body-backlog .card[data-id="' + n.id + '"]'), renderizados: document.querySelectorAll('#body-backlog .card').length, verMais: (document.querySelector('#body-backlog .col-more-btn') || {}).textContent || null, noBanco: Object.values(window.__store.kanban.squads.midiacriativa.dados.cards).some(c => c && c.id === n.id), toasts: window.__toasts.slice() }; }, extra);

  { const { ctx, p, errs } = await abre(100); const r = await cria(p);
    t('A. coluna com 100 cards: o card novo (prioridade média, depois dos "alta") APARECE no board', r.noDom && r.noBanco, r);
    t('A2. o "Ver mais" some, já que o limite cobriu o card novo', r.verMais === null, r.verMais); t('A3. sem erro de JS', !errs.length, errs); await ctx.close(); }
  { const { ctx, p } = await abre(60); const r = await cria(p); t('B. coluna com 60 cards (abaixo do limite): continua aparecendo', r.noDom && r.noBanco && r.renderizados === 61, r); await ctx.close(); }
  { const { ctx, p } = await abre(100); const r = await cria(p, { priority: 'critical' });
    t('C. card crítico (cai no topo, dentro dos 80): aparece SEM expandir a coluna (continua com "Ver mais")', r.noDom && r.renderizados === 80 && /20|21/.test(String(r.verMais)), r); await ctx.close(); }
  { const { ctx, p } = await abre(60); await p.evaluate(() => { activeFilters.owner = 'ZZ'; renderBoard(); }); const r = await cria(p);
    t('D. filtro ativo que esconde o card novo: avisa em vez de deixar parecer que sumiu', !r.noDom && r.noBanco && r.toasts.some(x => /filtro atual o esconde/.test(x)), r); await ctx.close(); }
  { const { ctx, p } = await abre(60); const r = await cria(p); t('E. sem filtro, nenhum aviso de "filtro" aparece à toa', r.noDom && !r.toasts.some(x => /filtro atual o esconde/.test(x)), r.toasts); await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK (' + K + ')' : '\nHÁ FALHAS (' + K + ')'); process.exit(ok ? 0 : 1); })();
