// 🧩 Supercard DENTRO de supercard (09/11/2026, pedido de uma PO): na vinculação do modal, dá pra vincular um supercard
// que já existe como filho de outro, respeitando o teto de 3 camadas (campanha → criativo → versão). Boot REAL, Firebase falso.
//   python3 -m http.server 8941 &   node docs/arezzo/testes/test_supercard_em_supercard.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const K = process.env.K || 'kanban-dev'; const SQ = 'site';
const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const fl = col => ({ enteredAt: { [col]: '2026-10-20T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-10-20T12:00:00.000Z' }] });
const seed = (extra) => { const C = (id, t, extra) => Object.assign({ id, title: t, col: 'doing', owner: 'LV', due: '2026-12-20', createdAt: '2026-10-20', flow: fl('doing'), updatedAt: '2026-10-27T10:00:00.000Z' }, extra || {});
  const lista = [
    C('ca', 'Zeta campanha A (sem filhos)', extra && extra.ca ? { childCardIds: extra.ca } : {}), C('cb', 'Zeta campanha B', { childCardIds: ['b1'] }), C('b1', 'Zeta criativo de B'),
    C('cc', 'Zeta campanha C (3 níveis)', { childCardIds: ['c1'] }), C('c1', 'Zeta criativo de C', { childCardIds: ['c11'] }), C('c11', 'Zeta versão de C'),
    C('cd', 'Zeta card simples'), C('cp', 'Zeta campanha P', { childCardIds: ['cq'] }), C('cq', 'Zeta criativo Q', { childCardIds: ['cr'] }), C('cr', 'Zeta versão R'),
    C('cx', 'Zeta arquivado', { archived: true, childCardIds: [] })];
  const cs = {}, ix = {}; lista.forEach((c, i) => { cs['k' + i] = c; ix[c.id] = 'k' + i; });
  return { kanban: { usuarios: { ana: { uid: 'ana', nome: 'Ana', email: 'ana@ciahering.com.br', inscrito: true, init: 'AA', role: 'adm', squads: { [SQ]: true } } }, usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana', init: 'AA' } }, config: { adm_emails: ['ana@ciahering.com.br'] },
    squads: { [SQ]: { dados: { columns: [{ id: 'doing', name: 'Em Validação' }, { id: 'done', name: 'Concluído', isDone: true }], cards_index: ix, cards: cs } } } } }; };
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const abre = async (extra) => { const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } }); await fake.install(ctx, seed(extra)); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.dismiss());
    await p.goto('http://localhost:8941/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(3500); return { ctx, p, errs }; };
  const abreCard = (p, id) => p.evaluate(i => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); openCard(i); }, id).then(() => p.waitForTimeout(700));
  const busca = (p, q) => p.evaluate(x => { searchSuperChildren(x); return [...document.querySelectorAll('#m-super-link-dropdown .link-option')].map(o => o.innerText.replace(/\s+/g, ' ').trim()); }, q);
  const filhos = (p, id) => p.evaluate(i => Object.values(window.__store.kanban.squads.site.dados.cards || {}).find(c => c.id === i).childCardIds || [], id);

  // OBS.: reabrir um 2º card na mesma sessão com o Firebase falso trava (laço do _checkCardLock) — cada cenário sobe uma sessão nova.
  const cenario = async (id, extra) => { const { ctx, p, errs } = await abre(extra); await abreCard(p, id); return { ctx, p, errs }; };
  { const { ctx, p, errs } = await cenario('ca');
    t('A. helpers: altura 0/1/2 e descendente', await p.evaluate(() => _superAltura(cards.find(c => c.id === 'ca')) === 0 && _superAltura(cards.find(c => c.id === 'cb')) === 1 && _superAltura(cards.find(c => c.id === 'cc')) === 2 && _superTemDescendente(cards.find(c => c.id === 'cc'), 'c11') && !_superTemDescendente(cards.find(c => c.id === 'cb'), 'c11')), '');
    const r = (await busca(p, 'Zeta')).join(' | ');
    t('B. na campanha (sem pai): lista a campanha B (supercard com 1 nível) e o card simples', /campanha B/.test(r) && /card simples/.test(r), r);
    t('C. NÃO lista a campanha C (3 níveis), nem quem já é filho (criativo/versão/Q/R), nem arquivado', !/campanha C/.test(r) && !/criativo de B/.test(r) && !/versão/.test(r) && !/criativo Q/.test(r) && !/arquivado/.test(r), r);
    t('D. a campanha P (tem filho que tem filho) também fica de fora', !/campanha P/.test(r), r);
    await p.evaluate(() => addSuperChild(cards.find(c => c.id === 'cb'))); await p.waitForTimeout(500);
    t('E. vincular o supercard B: entra no childCardIds da campanha A e grava', (await filhos(p, 'ca')).join() === 'cb', await filhos(p, 'ca'));
    t('F. a árvore ficou com altura 2 (A → B → criativo)', await p.evaluate(() => _superAltura(cards.find(c => c.id === 'ca')) === 2), '');
    const rej = await p.evaluate(() => { const antes = editingSuperChildren.length; addSuperChild(cards.find(c => c.id === 'cc')); addSuperChild(cards.find(c => c.id === 'cx')); return editingSuperChildren.length - antes; });
    t('K. forçar pela função um supercard de 3 níveis ou um arquivado é recusado', rej === 0, rej);
    t('L. sem erro de JS', errs.length === 0, errs); await ctx.close(); }
  { const { ctx, p } = await cenario('cd'); const x = (await busca(p, 'campanha B')).join('|');
    t('F2. num card simples a campanha B ainda aparece (é só ela que já vinculada some, ver G)', /campanha B/.test(x), x); await ctx.close(); }
  { const { ctx, p } = await cenario('cb', { ca: ['cb'] }); const nota = await p.evaluate(() => document.getElementById('m-super-parent-note').innerText);
    t('G. com B já dentro de A: B diz que é filho do supercard A e ainda lista o criativo dele', /filho do supercard/.test(nota) && /Zeta campanha A/.test(nota) && await p.evaluate(() => editingSuperChildren.length === 1 && editingSuperParentIsChild === false), nota); await ctx.close(); }
  { const { ctx, p } = await cenario('b1', { ca: ['cb'] });
    t('H. o antigo criativo de B virou "versão": não pode ter filhos', await p.evaluate(() => editingSuperParentIsChild === true && document.getElementById('m-super-add-btn').style.display === 'none'), ''); await ctx.close(); }
  { const { ctx, p } = await cenario('cd', { ca: ['cb'] }); const x = (await busca(p, 'campanha B')).join('|');
    t('H2. B já é filho de A: some da busca dos outros cards', !/campanha B/.test(x), x); await ctx.close(); }
  { const { ctx, p } = await cenario('cq'); const q = (await busca(p, 'Zeta')).join(' | ');
    t('I. num criativo (já tem pai): só entra card SEM filhos (a versão fica sem filhos)', /card simples/.test(q) && /campanha A/.test(q) && !/campanha B/.test(q) && !/campanha C/.test(q), q); await ctx.close(); }
  { const { ctx, p } = await cenario('cr');
    t('J. numa versão: não dá para vincular nada (botão escondido)', await p.evaluate(() => editingSuperParentIsChild === true && document.getElementById('m-super-add-btn').style.display === 'none'), ''); await ctx.close(); }
  await b.close(); console.log(ok ? 'TUDO OK' : 'HÁ FALHAS'); process.exit(ok ? 0 : 1); })();
