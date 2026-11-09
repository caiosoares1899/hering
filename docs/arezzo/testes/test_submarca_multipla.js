// 🏷️ Submarca MÚLTIPLA (09/11/2026, pedido do time): o card pode ter várias submarcas. Boot REAL do Maré com Firebase falso.
//   python3 -m http.server 8941 &   node docs/arezzo/testes/test_submarca_multipla.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const K = process.env.K || 'kanban-dev'; const SQ = 'site';
const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const fl = col => ({ enteredAt: { [col]: '2026-10-20T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-10-20T12:00:00.000Z' }] });
const C = (id, t, extra) => Object.assign({ id, title: t, col: 'doing', owner: 'AA', due: '2026-12-20', createdAt: '2026-10-20', flow: fl('doing'), updatedAt: '2026-10-27T10:00:00.000Z' }, extra || {});
const seed = () => { const cs = { k0: C('c0', 'Um', { tags: ['tag_sm_kids_com'] }), k1: C('c1', 'Dois', { tags: ['tag_sm_kids_com', 'tag_sm_teen_com'] }), k2: C('c2', 'Sem', {}), k3: C('p', 'Pai', { childCardIds: ['c1'] }) };
  return { kanban: { usuarios: { ana: { uid: 'ana', nome: 'Ana', email: 'ana@ciahering.com.br', inscrito: true, init: 'AA', role: 'adm', squads: { [SQ]: true } } }, usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana', init: 'AA', role: 'adm', squads: { [SQ]: true } } }, config: { adm_emails: ['ana@ciahering.com.br'] },
    squads: { [SQ]: { dados: { columns: [{ id: 'doing', name: 'Em Validação' }, { id: 'done', name: 'Concluído', isDone: true }], config: { submarca_ativo: true }, cards: cs, cards_index: { c0: 'k0', c1: 'k1', c2: 'k2', p: 'k3' }, cards_updated_at: { c0: 'x', c1: 'x', c2: 'x', p: 'x' } } } } } }; };
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const abre = async (vp) => { const ctx = await b.newContext({ viewport: vp || { width: 1300, height: 900 } }); await fake.install(ctx, seed()); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { errs.push('DIALOG ' + d.message()); d.dismiss(); });
    await p.goto('http://localhost:8941/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(3500); return { ctx, p, errs }; };
  const chips = p => p.evaluate(() => ({ n: document.querySelectorAll('#m-submarca .sm-chip').length, txt: [...document.querySelectorAll('#m-submarca .sm-chip')].map(e => e.innerText.replace(/\s+/g, ' ').replace('✕', '').trim()), opcoes: [...document.querySelectorAll('#m-submarca .sm-add option')].map(o => o.value), campo: getComputedStyle(document.getElementById('m-submarca-field')).display }));
  const salvo = (p, id) => p.evaluate(i => { const d = window.__store.kanban.squads.site.dados; const arr = Object.values(d.cards || {}); const c = arr.find(x => x && x.id === i); return c ? (c.tags || []) : null; }, id);
  const abreCard = (p, id) => p.evaluate(i => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); openCard(i); }, id).then(() => p.waitForTimeout(700));

  { const { ctx, p, errs } = await abre();
    await abreCard(p, 'c0'); let c = await chips(p);
    t('A. card com 1 submarca: 1 chip (Kids Comercial) + seletor "+ outra submarca" sem a que já tem', c.n === 1 && /Kids Comercial/.test(c.txt[0]) && !c.opcoes.includes('tag_sm_kids_com') && c.opcoes.includes('tag_sm_teen_com') && c.campo !== 'none', c);
    await p.evaluate(() => addCardSubmarca('tag_sm_teen_com')); c = await chips(p);
    t('B. adicionar outra submarca mantém a primeira (2 chips) e tira a nova do seletor', c.n === 2 && /Kids Comercial/.test(c.txt[0]) && /Teen Comercial/.test(c.txt[1]) && !c.opcoes.includes('tag_sm_teen_com'), c);
    await p.waitForTimeout(1500);
    t('C. o autosave grava as duas no card', (await salvo(p, 'c0')).filter(x => /^tag_sm_/.test(x)).sort().join() === 'tag_sm_kids_com,tag_sm_teen_com', await salvo(p, 'c0'));
    await p.evaluate(() => removeCardSubmarca('tag_sm_kids_com')); c = await chips(p); await p.waitForTimeout(1500);
    t('D. remover uma deixa a outra (1 chip) e grava', c.n === 1 && /Teen Comercial/.test(c.txt[0]) && (await salvo(p, 'c0')).join() === 'tag_sm_teen_com', [c, await salvo(p, 'c0')]);
    t('E. com o card aberto, uma Automação que troca as tags ao vivo redesenha os chips', await p.evaluate(() => { editingTags = ['tag_sm_geral', 'tag_sm_kids_cad']; populateTagSelect(); return [...document.querySelectorAll('#m-submarca .sm-chip')].length === 2; }), '');
    await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); openNewCard(); }); await p.waitForTimeout(500); c = await chips(p);   // (2º card no mesmo boot: openNewCard, não openCard — armadilha do Firebase falso)
    t('F. card novo sem submarca: nenhum chip e o seletor "— sem submarca —" com as opções', c.n === 0 && c.opcoes.length > 5, c);
    t('G. a validação de "submarca obrigatória" vê as várias (≥1) e a falta (0)', await p.evaluate(() => { editingTags = []; const sem = _modalSubmarcas().length; editingTags = ['tag_sm_geral', 'tag_sm_kids_cad']; return sem === 0 && _modalSubmarcas().length === 2; }), '');
    t('H. sem erro de JS nem diálogo', errs.length === 0, errs); await ctx.close(); }

  { const { ctx, p } = await abre();
    const r = await p.evaluate(() => { const card = cards.find(c => c.id === 'c0'); const acao = AUTO_ACTIONS.find(a => a.key === 'set_submarca'); const a1 = acao.run({ actionVal: 'tag_sm_teen_com' }, card); const dep = getCardTags(card).slice(); const a2 = acao.run({ actionVal: 'tag_sm_teen_com' }, card); return { label: acao.label, a1, dep, a2, depois: getCardTags(card).length }; });
    t('I. Automação "Adicionar submarca": soma sem tirar a que o card tinha; repetir não faz nada', r.a1 === true && r.dep.length === 2 && r.dep.includes('tag_sm_kids_com') && r.a2 === false && r.depois === 2 && /Adicionar/.test(r.label), r);
    const m = await p.evaluate(() => { selectedCards.clear(); selectedCards.add('c0'); window._bulkSelectedTags = ['tag_sm_geral']; _doBulkTagMulti('add'); const t1 = getCardTags(cards.find(c => c.id === 'c0')).slice(); selectedCards.clear(); selectedCards.add('c1'); window._bulkSelectedTags = ['tag_sm_geral', 'tag_sm_sports_com']; _doBulkTagMulti('add'); return { t1, t2: getCardTags(cards.find(c => c.id === 'c1')).slice() }; });
    t('J. em massa (adicionar): o card ganha a submarca sem perder as dele; 2 de uma vez entram as 2', m.t1.includes('tag_sm_kids_com') && m.t1.includes('tag_sm_geral') && ['tag_sm_kids_com', 'tag_sm_teen_com', 'tag_sm_geral', 'tag_sm_sports_com'].every(x => m.t2.includes(x)), m);
    const ins = await p.evaluate(() => { try { cards.find(c => c.id === 'c1').tags = ['tag_sm_kids_com', 'tag_sm_teen_com']; cards.find(c => c.id === 'c0').tags = ['tag_sm_kids_com']; cards.find(c => c.id === 'c2').tags = []; renderBoardDataInsights(); return window._bdInsightsResumoCache && window._bdInsightsResumoCache.porSubmarca; } catch (e) { return 'ERRO ' + e.message; } });
    t('K. números por submarca: o card com 2 conta em cada uma (Kids = 2, Teen = 1, "sem" = 1)', Array.isArray(ins) && (ins.find(x => /Kids Comercial/.test(x.submarca)) || {}).qtd === 2 && (ins.find(x => /Teen Comercial/.test(x.submarca)) || {}).qtd === 1 && (ins.find(x => /Sem submarca/.test(x.submarca)) || {}).qtd >= 1, ins);
    await ctx.close(); }

  { const { ctx, p } = await abre();
    await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); openCard('p'); }); await p.waitForTimeout(900);
    const pil = await p.evaluate(() => [...document.querySelectorAll('#m-super-children-list .minicard')].map(m => m.querySelectorAll('.minicard-sm .card-tag').length));
    t('L. supercard: o filho com 2 submarcas mostra as 2 pílulas', pil[0] === 2, pil); await ctx.close(); }

  { const { ctx, p } = await abre();
    const r = await p.evaluate(() => { _intakeBucket = { i1: { id: 'i1', titulo: 'Pedido', demandante: 'X', submarca: ['Hering Kids Comercial', 'hering teen cadastro'] }, i2: { id: 'i2', titulo: 'Pedido 2', demandante: 'X', submarca: 'Hering Sports Cadastro' }, i3: { id: 'i3', titulo: 'Pedido 3', demandante: 'X', submarca: 'Hering Kids Comercial; Hering Geral' } };
      _intakeCriarCard('i1'); const a = _modalSubmarcas().slice(); document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); _intakeCriarCard('i2'); const b2 = _modalSubmarcas().slice(); document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); _intakeCriarCard('i3'); return { a, b2, c3: _modalSubmarcas().slice() }; });
    t('M. Intake: pedido com lista de submarcas vira as tags no card novo; com texto único (como antes) também; texto com ";" vale como lista', r.a.sort().join() === 'tag_sm_kids_com,tag_sm_teen_cad' && r.b2.join() === 'tag_sm_sports_cad' && r.c3.includes('tag_sm_kids_com'), r);
    await ctx.close(); }

  { const { ctx, p } = await abre({ width: 390, height: 800 }); await abreCard(p, 'c1');
    t('N. celular 390 px: os chips quebram linha, sem rolagem lateral e o ✕ tem área de toque', await p.evaluate(() => { const x = document.querySelector('#m-submarca .sm-chip-x'); const r = x.getBoundingClientRect(); return document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 && r.width >= 22 && r.height >= 22; }), '');
    for (const th of ['light', 'vice']) { await p.evaluate(x => document.documentElement.setAttribute('data-theme', x), th); await p.waitForTimeout(150); t('O. tema ' + th + ': os chips continuam legíveis', await p.evaluate(() => { const e = document.querySelector('#m-submarca .sm-chip .card-tag'); return !!e && getComputedStyle(e).color !== getComputedStyle(e).backgroundColor; }), ''); }
    await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await p.locator('#m-submarca-field').screenshot({ path: '/tmp/submarca_multipla_mobile.png' }); await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK (' + K + ')' : '\nHÁ FALHAS (' + K + ')'); process.exit(ok ? 0 : 1); })();
