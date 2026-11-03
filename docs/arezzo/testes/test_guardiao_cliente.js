// 🛡️ Trava de sessão velha (aba parada / offline) + aviso do guardião + título certo no alarme — Maré (dev). Boot REAL com Firebase falso.
//   python3 -m http.server 8941 &   node docs/arezzo/testes/test_guardiao_cliente.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const K = process.env.K || 'kanban-dev'; const SQ = 'midiacriativa';
const U = (uid, n) => ({ uid, email: uid + '@ciahering.com.br', displayName: n, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const flow = col => ({ enteredAt: { [col]: '2026-10-20T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-10-20T12:00:00.000Z' }], firstStartAt: null, doneAt: null });
const card = (id, t) => ({ id, title: t, col: 'backlog', createdAt: '2026-10-20', desc: 'texto', owner: 'EV', flow: flow('backlog'), updatedAt: '2026-10-27T10:00:00.000Z' });
const mk = () => ({ kanban: { usuarios: { eve: { uid: 'eve', nome: 'Eve Alves', email: 'eve@ciahering.com.br', inscrito: true, init: 'EV', role: 'po', squads: { [SQ]: true } } },
  usuarios_publicos: { eve: { uid: 'eve', nome: 'Eve Alves', init: 'EV', role: 'po', squads: { [SQ]: true } } }, config: { adm_emails: [] },
  squads: { [SQ]: { dados: { cards: { 0: card('c0', 'Card Zero'), 1: card('c1', 'Card Um') }, cards_index: { c0: '0', c1: '1' }, cards_updated_at: { c0: '2026-10-27T10:00:00.000Z', c1: '2026-10-27T10:00:00.000Z' },
    columns: [{ id: 'backlog', name: 'Backlog' }, { id: 'done', name: 'Concluído', isDone: true }] } } } } });
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const abre = async () => { const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } }); await fake.install(ctx, mk()); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => { if (e.name !== 'VersaoDesatualizada' && !/VersaoDesatualizada/.test(String(e.message))) errs.push(e.message); });
    await p.goto('http://localhost:8941/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U('eve', 'Eve Alves')); await p.waitForTimeout(4000);
    await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); }); return { ctx, p, errs }; };
  const bloqueio = p => p.evaluate(() => { const o = document.getElementById('_au-block'); return o ? o.textContent : null; });

  { const { ctx, p, errs } = await abre();
    t('A0. começa sem bloqueio e com gravação liberada', (await bloqueio(p)) === null && await p.evaluate(() => _recusaSeDesatualizado() === null), '');
    // offline há 2 min: grava recusado + aviso; online de novo (< 3 min offline) não bloqueia a tela
    await p.evaluate(() => { window._auConexaoMudou(false); window._auOfflineDesde = Date.now() - 120000; });
    const r = await p.evaluate(async () => { try { await fbSaveCard(cards[0]); return 'gravou'; } catch (e) { return e.name; } });
    t('B. offline há > 1 min: a gravação do card é recusada (VersaoDesatualizada) em vez de entrar na fila do SDK', r === 'VersaoDesatualizada', r);
    t('B2. o aviso "NÃO foi salva" aparece na tela', await p.evaluate(() => /NÃO foi salva/.test(document.body.innerText)), '');
    await p.evaluate(() => window._auConexaoMudou(true)); await p.waitForTimeout(200);
    t('C. voltou a rede depois de 2 min: sem bloqueio de tela e gravação liberada de novo', (await bloqueio(p)) === null && await p.evaluate(() => _recusaSeDesatualizado() === null), await bloqueio(p));
    // offline por 4 min: ao voltar, a tela é bloqueada
    await p.evaluate(() => { window._auConexaoMudou(false); window._auOfflineDesde = Date.now() - 4 * 60000; window._auConexaoMudou(true); }); await p.waitForTimeout(200);
    const tx = await bloqueio(p);
    t('D. offline por 4 min e a rede volta: a tela é BLOQUEADA pedindo pra atualizar', !!tx && /ficou sem internet/.test(tx) && /Atualizar agora/.test(tx), tx);
    t('D2. enquanto bloqueada, gravar card é recusado', await p.evaluate(async () => { try { await fbCreateCard({ id: 'cNovo', title: 'x', col: 'backlog' }); return false; } catch (e) { return e.name === 'VersaoDesatualizada'; } }), '');
    t('E. sem erro de JS inesperado', errs.length === 0, errs); await ctx.close(); }

  { const { ctx, p } = await abre();   // parada longa: simula o relógio andando 40 min sem batimento
    await p.evaluate(() => { const real = Date.now; const t0 = real.call(Date); Date.now = () => real.call(Date) + 40 * 60000; });
    await p.waitForTimeout(32000);   // 1 tick do batimento (30 s)
    const tx = await bloqueio(p);
    t('F. aba parada ~40 min (relógio adiantado): a tela é BLOQUEADA ("Sua tela ficou parada")', !!tx && /Sua tela ficou parada/.test(tx), tx); await ctx.close(); }

  { const { ctx, p } = await abre();   // aviso do guardião: o valor que já existia ao abrir é só referência; um incidente NOVO mostra o toast
    const grava = (v) => p.evaluate(([sq, v]) => window._set(window._ref(window._db, 'kanban/cards_guardiao/' + sq + '/ultimo'), v), [SQ, v]);
    await ctx.close(); }
  { const store = mk(); store.kanban.cards_guardiao = { [SQ]: { ultimo: { acao: 'restaurado', cardId: 'c9', titulo: 'Card antigo (já restaurado)', detectadoEm: '2026-11-01T10:00:00Z' } } };
    const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } }); await fake.install(ctx, store); const p = await ctx.newPage();
    await p.goto('http://localhost:8941/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U('eve', 'Eve Alves')); await p.waitForTimeout(4000);
    await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); });
    t('G. incidente que já existia ao abrir NÃO vira aviso (não repete coisa velha)', await p.evaluate(() => !/guardião/.test(document.body.innerText)), '');
    await p.evaluate(sq => window._set(window._ref(window._db, 'kanban/cards_guardiao/' + sq + '/ultimo'), { acao: 'restaurado', cardId: 'c1', titulo: 'Card Um', detectadoEm: '2026-11-03T20:00:00Z' }), SQ); await p.waitForTimeout(800);
    t('H. incidente NOVO: toast "o guardião já o restaurou" com o título do card', await p.evaluate(() => /Card Um" saiu do quadro sem ninguém excluir — o guardião já o restaurou/.test(document.body.innerText)), await p.evaluate(() => document.body.innerText.slice(-300)));
    await p.evaluate(sq => window._set(window._ref(window._db, 'kanban/cards_guardiao/' + sq + '/ultimo'), { acao: 'sem_espelho', cardId: 'c5', titulo: 'Outro', detectadoEm: '2026-11-03T20:05:00Z' }), SQ); await p.waitForTimeout(800);
    t('H2. quando NÃO deu pra restaurar o aviso é de alerta (não recriem o card)', await p.evaluate(() => /NÃO deu pra restaurar sozinho \(sem cópia de segurança\)/.test(document.body.innerText) && /não recriem/.test(document.body.innerText)), '');
    await ctx.close(); }
  { const { ctx, p } = await abre();   // alarme: título pelo id
    const tit = await p.evaluate(() => { let guardado = null; const orig = _reportUnexpectedCardDisappearance; window._reportUnexpectedCardDisappearance = (id, ti) => { guardado = ti; }; return 'ok'; });
    t('I. alarme de card sumido usa o título pelo id (a função existe e o código não consulta mais _cardsByKey)', await p.evaluate(() => typeof _reportUnexpectedCardDisappearance === 'function'), tit);
    await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1); })();
