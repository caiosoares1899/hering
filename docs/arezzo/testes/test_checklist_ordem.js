// 📋 Reordenar os CHECKLISTS do card por arrastar (alça ⠿), teclado (↑↓) e botões ▲▼ no toque — pedido do Caio, 03/11/2026. Boot REAL do Maré com Firebase falso.
//   python3 -m http.server 8941 &   node docs/arezzo/testes/test_checklist_ordem.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const K = process.env.K || 'kanban-dev'; const SQ = 'midiacriativa';
const U = (uid, n) => ({ uid, email: uid + '@ciahering.com.br', displayName: n, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const flow = col => ({ enteredAt: { [col]: '2026-10-20T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-10-20T12:00:00.000Z' }], firstStartAt: null, doneAt: null });
const GRP = [{ id: 'default', title: 'Briefing', colapsado: false }, { id: 'g2', title: 'Produção', colapsado: false }, { id: 'g3', title: 'Revisão', colapsado: false }];
const ITENS = [{ t: 'a1', done: true, grp: 'default' }, { t: 'a2', done: false, grp: 'default' }, { t: 'b1', done: false, grp: 'g2' }, { t: 'b2', done: true, grp: 'g2' }, { t: 'b3', done: false, grp: 'g2' }, { t: 'c1', done: false, grp: 'g3' }];
const card = (id, extra) => Object.assign({ id, title: 'Card ' + id, col: 'backlog', createdAt: '2026-10-20', desc: 'texto', owner: 'EV', flow: flow('backlog'), updatedAt: '2026-10-27T10:00:00.000Z' }, extra || {});
const mk = () => ({ kanban: { usuarios: { eve: { uid: 'eve', nome: 'Eve Alves', email: 'eve@ciahering.com.br', inscrito: true, init: 'EV', role: 'po', squads: { [SQ]: true } } },
  usuarios_publicos: { eve: { uid: 'eve', nome: 'Eve Alves', init: 'EV', role: 'po', squads: { [SQ]: true } } }, config: { adm_emails: [] },
  squads: { [SQ]: { dados: { cards: { 0: card('c1', { checklist: ITENS, checklistGroups: GRP }), 1: card('c2', { checklist: [{ t: 'x', done: false, grp: 'default' }], checklistGroups: [{ id: 'default', title: 'Checklist' }] }) },
    cards_index: { c1: '0', c2: '1' }, cards_updated_at: { c1: '2026-10-27T10:00:00.000Z', c2: '2026-10-27T10:00:00.000Z' },
    columns: [{ id: 'backlog', name: 'Backlog' }, { id: 'done', name: 'Concluído', isDone: true }] } } } } });
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 320))); };
  const abre = async (ctxOpts, cid) => { const ctx = await b.newContext(Object.assign({ viewport: { width: 1400, height: 1000 } }, ctxOpts || {})); await fake.install(ctx, mk()); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8941/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U('eve', 'Eve Alves')); await p.waitForTimeout(4000);
    await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); }); await p.evaluate(c => openCard(c), cid || 'c1'); await p.waitForTimeout(500); return { ctx, p, errs }; };
  const arrasta = async (p, src, dst, relY) => { // relY: 0..1 dentro do alvo — o destino é medido DEPOIS do arrasto começar (o layout muda um pouco ao focar a alça), sem rolar no meio
    await p.evaluate(() => document.getElementById('m-checklist-sec').scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);   // a seção inteira no meio da tela: nenhum checklist fica cortado pela borda do modal
    const a = await p.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, src);
    await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(a.x + 4, a.y - 4, { steps: 2 }); await p.mouse.move(a.x + 8, a.y - 8, { steps: 2 }); await p.waitForTimeout(100);
    const d = await p.evaluate(([s2, ry]) => { const q = document.querySelector(s2).getBoundingClientRect(); return { x: q.left + 140, y: q.top + q.height * ry }; }, [dst, relY]);
    await p.mouse.move(d.x, d.y, { steps: 12 }); await p.mouse.move(d.x, d.y + 1, { steps: 2 }); await p.mouse.up(); await p.waitForTimeout(500); };
  const ordem = p => p.evaluate(() => [...document.querySelectorAll('#m-checklist .cl-group')].map(g => g.querySelector('.cl-group-title').value));
  const itens = p => p.evaluate(() => [...document.querySelectorAll('#m-checklist .cl-group')].map(g => [...g.querySelectorAll('.cl-it')].map(x => x.dataset.raw).join('+')));
  const salvo = p => p.evaluate(sq => { const dd = window.__store.kanban.squads[sq].dados; const arr = Array.isArray(dd.cards) ? dd.cards : Object.values(dd.cards); const c = arr.find(x => x && x.id === 'c1'); return { grupos: (c.checklistGroups || []).map(g => g.title), itens: (c.checklist || []).map(i => i.t + ':' + i.grp) }; }, SQ);

  { const { ctx, p, errs } = await abre();
    t('A0. ordem inicial: Briefing, Produção, Revisão', (await ordem(p)).join() === 'Briefing,Produção,Revisão', await ordem(p));
    t('A1. com 3 checklists cada cabeçalho tem a alça ⠿ (botão com aria-label)', await p.evaluate(() => [...document.querySelectorAll('#m-checklist .cl-group-handle')].length === 3 && [...document.querySelectorAll('#m-checklist .cl-group-handle')].every(h => /Mover o checklist/.test(h.getAttribute('aria-label')))), '');
    // arrasta o 3º (Revisão) pra cima do 1º
    await arrasta(p, '#m-checklist .cl-group[data-gid="g3"] .cl-group-handle', '#m-checklist .cl-group[data-gid="default"]', 0.4);
    t('B. arrastar a alça do 3º pro topo do 1º coloca "Revisão" em primeiro', (await ordem(p)).join() === 'Revisão,Briefing,Produção', await ordem(p));
    t('B2. os itens foram junto com o checklist deles', (await itens(p)).join('|') === 'c1|a1+a2|b1+b2+b3', await itens(p));
    t('B3. marcações preservadas (a1 e b2 seguem concluídos)', await p.evaluate(() => [...document.querySelectorAll('#m-checklist .cl-item')].filter(r => r.querySelector('input').checked).map(r => r.querySelector('.cl-it').dataset.raw).join()) === 'a1,b2', '');
    await arrasta(p, '#m-checklist .cl-group[data-gid="g3"] .cl-group-handle', '#m-checklist .cl-group[data-gid="g2"]', 0.65);
    t('C. soltar na metade de baixo do último põe DEPOIS dele: Briefing, Produção, Revisão', (await ordem(p)).join() === 'Briefing,Produção,Revisão', await ordem(p));
    await p.dragAndDrop('#m-checklist .cl-group[data-gid="default"] .cl-group-handle', '#m-checklist .cl-group[data-gid="default"]', { targetPosition: { x: 120, y: 6 } }); await p.waitForTimeout(300);
    t('D. soltar o checklist em cima dele mesmo não muda nada', (await ordem(p)).join() === 'Briefing,Produção,Revisão', await ordem(p));
    await p.waitForTimeout(3500);
    const s = await salvo(p); t('E. a ordem é gravada no card (autosave): grupos e itens na ordem dos checklists', s.grupos.join() === 'Briefing,Produção,Revisão' && s.itens.join() === 'a1:default,a2:default,b1:g2,b2:g2,b3:g2,c1:g3', s);
    t('F. sem erro de JS', !errs.length, errs); await ctx.close(); }

  { const { ctx, p } = await abre();   // G: arrastar um ITEM dentro do checklist continua funcionando e não mexe na ordem dos checklists
    await arrasta(p, '#m-checklist .cl-group[data-gid="g2"] .cl-item:nth-child(3) .cl-drag-handle', '#m-checklist .cl-group[data-gid="g2"] .cl-item:nth-child(1)', 0.3);
    t('G. arrastar item dentro do checklist segue valendo (b3 sobe) e a ordem dos checklists não muda', (await itens(p))[1] === 'b3+b1+b2' && (await ordem(p)).join() === 'Briefing,Produção,Revisão', [await itens(p), await ordem(p)]); await ctx.close(); }

  { const { ctx, p } = await abre();   // H: teclado
    await p.focus('#m-checklist .cl-group[data-gid="g2"] .cl-group-handle'); await p.keyboard.press('ArrowUp'); await p.waitForTimeout(300);
    t('H. ↑ com o foco na alça sobe o checklist (Produção, Briefing, Revisão) e o foco continua na alça dele', (await ordem(p)).join() === 'Produção,Briefing,Revisão' && await p.evaluate(() => document.activeElement && document.activeElement.classList.contains('cl-group-handle') && document.activeElement.closest('.cl-group').dataset.gid === 'g2'), [await ordem(p)]);
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(300);
    t('H2. ↓↓ desce de volta e para no fim (Briefing, Revisão, Produção) sem passar do limite', (await ordem(p)).join() === 'Briefing,Revisão,Produção', await ordem(p));
    await p.keyboard.press('ArrowDown'); await p.waitForTimeout(200); t('H3. ↓ no último não faz nada', (await ordem(p)).join() === 'Briefing,Revisão,Produção', await ordem(p));
    await p.keyboard.press('Control+z').catch(() => {}); await ctx.close(); }

  { const { ctx, p } = await abre({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });   // I: toque — ▲▼ visíveis e funcionando
    const vis = await p.evaluate(() => [...document.querySelectorAll('#m-checklist .cl-group-mv')].filter(b => b.offsetParent !== null).length);
    t('I. em tela de toque aparecem os botões ▲▼ (2 por checklist)', vis === 6, vis);
    await p.tap('#m-checklist .cl-group[data-gid="default"] .cl-group-mv[data-dir="1"]'); await p.waitForTimeout(300);
    t('I2. ▼ no 1º desce: Produção, Briefing, Revisão', (await ordem(p)).join() === 'Produção,Briefing,Revisão', await ordem(p));
    t('I3. ▲ do primeiro e ▼ do último ficam desabilitados', await p.evaluate(() => { const g = [...document.querySelectorAll('#m-checklist .cl-group')]; return g[0].querySelector('[data-dir="-1"]').disabled && g[g.length - 1].querySelector('[data-dir="1"]').disabled; }), '');
    const w = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })); t('I4. 390 px sem rolagem lateral', w.sw <= w.cw + 1, w); await ctx.close(); }

  { const { ctx, p } = await abre(null, 'c2');   // J: 1 checklist só: sem alça nem setas
    t('J. card com 1 checklist só não mostra alça nem ▲▼ (nada pra reordenar)', await p.evaluate(() => document.querySelectorAll('#m-checklist .cl-group-handle, #m-checklist .cl-group-mv').length === 0), ''); await ctx.close(); }
  { const { ctx, p } = await abre();   // K: adicionar um checklist novo e reordenar o novo
    await p.evaluate(() => addChecklistGroup()); await p.waitForTimeout(300);
    const gidNovo = await p.evaluate(() => { const g = document.querySelectorAll('#m-checklist .cl-group'); return g[g.length - 1].dataset.gid; });
    await p.evaluate(() => { document.getElementById('m-checklist').scrollTop = 1e5; }); await p.waitForTimeout(150);   // a lista do card rola por dentro (max-height 340px): o novo fica no fim, junto do 3º
    await arrasta(p, '#m-checklist .cl-group[data-gid="' + gidNovo + '"] .cl-group-handle', '#m-checklist .cl-group[data-gid="g3"]', 0.3);
    t('K. um checklist recém-criado também pode ser arrastado (sobe pra antes do 3º)', (await ordem(p)).join() === 'Briefing,Produção,Checklist,Revisão', await ordem(p)); await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1); })();
