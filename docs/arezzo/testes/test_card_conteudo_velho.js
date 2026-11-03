// 📝 Conteúdo velho por cima do novo: um aparelho com o card DESATUALIZADO grava o card inteiro e apaga o briefing (desc) e o histórico que outra pessoa acabou de escrever (relato de produção 03/11/2026, squad midiacriativa).
// Boot REAL do Maré com Firebase falso. K=kanban roda o MESMO teste contra a produção (o cenário A deve FALHAR lá — é a prova de que o teste pega o bug).
//   python3 -m http.server 8941 &   node docs/arezzo/testes/test_card_conteudo_velho.js        (K=kanban para a produção)
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const K = process.env.K || 'kanban-dev'; const SQ = 'midiacriativa'; const FBP = 'kanban/squads/' + SQ + '/dados';
const U = (uid, n) => ({ uid, email: uid + '@ciahering.com.br', displayName: n, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const flow = col => ({ enteredAt: { [col]: '2026-10-20T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-10-20T12:00:00.000Z' }], firstStartAt: null, doneAt: null });
const card = (id, title, col, extra) => Object.assign({ id, title, col, createdAt: '2026-10-20', desc: 'conteudo de ' + title, flow: flow(col), updatedAt: '2026-10-26T10:00:00.000Z' }, extra || {});
const montaSeed = () => { const cards = {}, idx = {}, upd = {}, arq = {};
  for (let i = 0; i < 10; i++) { cards[i] = card('c' + i, 'Card ' + i, i % 2 ? 'doing' : 'backlog'); }
  cards[10] = card('cArq', 'Card arquivado', 'done', { archived: true });
  Object.entries(cards).forEach(([k, c]) => { idx[c.id] = String(k); upd[c.id] = c.updatedAt; if (c.archived) arq[c.id] = true; });
  return { kanban: { usuarios: { eve: { uid: 'eve', nome: 'Eve', email: 'eve@ciahering.com.br', inscrito: true, init: 'EV', role: 'po', squads: { [SQ]: true } } }, usuarios_publicos: { eve: { uid: 'eve', nome: 'Eve', init: 'EV', role: 'po', squads: { [SQ]: true } } }, config: { adm_emails: [] },
    squads: { [SQ]: { dados: { cards, cards_index: idx, cards_updated_at: upd, cards_archived: arq, columns: [{ id: 'backlog', name: 'Backlog' }, { id: 'doing', name: 'Fazendo' }, { id: 'done', name: 'Concluído', isDone: true }] } } } } }; };

const hist = (n) => Array.from({ length: n }, (_, i) => ({ who: 'Fulana', what: 'evento ' + (i + 1), at: '2026-10-28T1' + i + ':00:00.000Z', init: 'FU' }));
const montaSeed2 = () => { const s = montaSeed(); const dd = s.kanban.squads[SQ].dados; dd.cards[1].desc = ''; dd.cards[1].history = hist(1); return s; };
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 400))); };
  const abre = async () => { const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); await fake.install(ctx, montaSeed2()); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8941/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U('eve', 'Eve')); await p.waitForTimeout(4200); return { ctx, p, errs }; };
  const banco = (p, id) => p.evaluate(([sq, id]) => { const dd = window.__store.kanban.squads[sq].dados; const arr = (Array.isArray(dd.cards) ? dd.cards : Object.values(dd.cards)).filter(Boolean); const c = arr.find(x => x.id === id); return c ? { desc: c.desc, historia: (c.history || []).map(h => h.what), col: c.col, title: c.title, tags: c.tags } : null; }, [SQ, id]);
  // "outra pessoa" escreve o briefing e o histórico direto no banco — o aparelho não recebe nada (é o aparelho atrasado)
  const outraPessoaEdita = (p) => p.evaluate(([sq]) => { const dd = window.__store.kanban.squads[sq].dados; const arr = Array.isArray(dd.cards) ? dd.cards : Object.values(dd.cards); const i = arr.findIndex(x => x && x.id === 'c1');
    const c = Object.assign({}, arr[i], { desc: 'BRIEFING PARA OS DESIGNERS: formato 1080x1350, copy aprovada, referências no Drive', history: [{ who: 'Fulana', what: 'evento 1', at: '2026-10-28T10:00:00.000Z', init: 'FU' }, { who: 'Gestora', what: 'escreveu o briefing', at: '2026-11-03T10:00:00.000Z', init: 'GE' }, { who: 'Gestora', what: 'mudou a prioridade', at: '2026-11-03T10:05:00.000Z', init: 'GE' }], updatedAt: '2026-11-03T10:05:00.000Z' });
    if (Array.isArray(dd.cards)) dd.cards[i] = c; else dd.cards[Object.keys(dd.cards)[i]] = c; dd.cards_updated_at.c1 = c.updatedAt; }, [SQ]);

  { const { ctx, p, errs } = await abre(); await outraPessoaEdita(p);
    t('A0. o aparelho está atrasado: ainda vê o card sem briefing e com 1 evento no histórico', await p.evaluate(() => { const c = cards.find(x => x.id === 'c1'); return !c.desc && c.history.length === 1; }), '');
    await p.evaluate(() => { _ctxCardId = 'c1'; ctxMove('done'); }); await p.waitForTimeout(900);      // o card "volta"/muda de coluna pelo menu
    const r = await banco(p, 'c1');
    t('A. mover o card NÃO apaga o briefing que outra pessoa escreveu', /BRIEFING PARA OS DESIGNERS/.test(r.desc || ''), r);
    t('A2. nem o histórico: as 2 entradas que a outra pessoa gravou continuam lá', r.historia.includes('escreveu o briefing') && r.historia.includes('mudou a prioridade') && r.historia.length >= 3, r.historia);
    t('A3. a edição deste aparelho valeu (o card mudou de coluna)', r.col === 'done', r.col);
    t('A4. sem erro de JS', !errs.length, errs); await ctx.close(); }

  { const { ctx, p } = await abre(); await outraPessoaEdita(p);   // B: qualquer outro save pontual do card (tag, prioridade…) — fbSaveCard direto
    await p.evaluate(() => { const c = cards.find(x => x.id === 'c1'); c.priority = 'alta'; return fbSaveCard(c); }); await p.waitForTimeout(900);
    const r = await banco(p, 'c1'); t('B. salvar um campo qualquer (prioridade) também preserva briefing e histórico dos outros', /BRIEFING/.test(r.desc || '') && r.historia.includes('escreveu o briefing'), r);
    const pri = await p.evaluate(sq => { const dd = window.__store.kanban.squads[sq].dados; const arr = (Array.isArray(dd.cards) ? dd.cards : Object.values(dd.cards)).filter(Boolean); return arr.find(x => x.id === 'c1').priority; }, SQ); t('B2. e a prioridade deste aparelho foi gravada', pri === 'alta', pri); await ctx.close(); }

  { const { ctx, p } = await abre(); await outraPessoaEdita(p);   // C: quem EDITA o briefing agora (conflito de verdade no mesmo campo) vence — o aparelho está escrevendo de propósito
    await p.evaluate(() => { const c = cards.find(x => x.id === 'c1'); c.desc = 'texto novo escrito neste aparelho'; return fbSaveCard(c); }); await p.waitForTimeout(900);
    const r = await banco(p, 'c1'); t('C. quem edita o briefing de propósito neste aparelho continua mandando no campo que editou', r.desc === 'texto novo escrito neste aparelho', r); await ctx.close(); }

  { const { ctx, p } = await abre();    // D: ninguém mais mexeu → o save é igual ao de sempre (sem toast, sem mesclagem)
    await p.evaluate(() => { const c = cards.find(x => x.id === 'c1'); c.title = 'Título novo'; return fbSaveCard(c); }); await p.waitForTimeout(700);
    const r = await banco(p, 'c1'); t('D. sem conflito o save segue normal', r.title === 'Título novo' && r.historia.length === 1, r); await ctx.close(); }

  { const { ctx, p } = await abre(); await outraPessoaEdita(p);   // E: save ESTRUTURAL (ação em massa, reordenar, recorrência…) — regrava /cards inteiro: não pode pôr o conteúdo velho de CARDS QUE NEM FORAM TOCADOS por cima do novo
    await p.evaluate(() => { const c = cards.find(x => x.id === 'c3'); c.title = 'Card 3 editado'; return fbSaveAll(undefined, ['c3']); }); await p.waitForTimeout(1200);
    const r1 = await banco(p, 'c1'), r3 = await banco(p, 'c3');
    t('E. um save em massa de OUTRO card não apaga o briefing/histórico do card que o aparelho tem velho', /BRIEFING/.test(r1.desc || '') && r1.historia.includes('escreveu o briefing'), r1);
    t('E2. e a edição feita neste aparelho (c3) foi gravada', r3.title === 'Card 3 editado', r3);
    const idx = await p.evaluate(sq => { const dd = window.__store.kanban.squads[sq].dados; const arr = Array.isArray(dd.cards) ? dd.cards : Object.values(dd.cards); return { n: arr.filter(Boolean).length, ok: Object.entries(dd.cards_index).every(([id, k]) => (arr[k] || {}).id === id) }; }, SQ);
    t('E3. o índice continua alinhado com as posições e nenhum card sumiu', idx.n === 11 && idx.ok, idx); await ctx.close(); }

  { const { ctx, p } = await abre(); await outraPessoaEdita(p);   // F: save em massa que MUDA AS POSIÇÕES (excluir um card antes) — o card velho muda de lugar e leva o conteúdo novo junto
    await p.evaluate(() => { cards = cards.filter(c => c.id !== 'c0'); return fbSaveAll({ 'cards_deleted_intentionally/c0': true }, []); }); await p.waitForTimeout(1200);
    const r1 = await banco(p, 'c1'); const idx = await p.evaluate(sq => { const dd = window.__store.kanban.squads[sq].dados; const arr = Array.isArray(dd.cards) ? dd.cards : Object.values(dd.cards); return Object.entries(dd.cards_index).every(([id, k]) => (arr[k] || {}).id === id) && !Object.keys(dd.cards_index).includes('c0'); }, SQ);
    t('F. excluir um card (posições deslocadas) mantém o briefing novo do card velho e o índice alinhado', /BRIEFING/.test(r1.desc || '') && idx, [r1, idx]); await ctx.close(); }

  { const { ctx, p } = await abre(); await outraPessoaEdita(p);   // G: a BASE não vaza pro banco (propriedade não enumerável) e muda a cada save
    const antes = await p.evaluate(() => { const c = cards.find(x => x.id === 'c1'); return { temBase: !!c.__base, enumeravel: Object.keys(c).includes('__base'), baseDesc: c.__base.desc }; });
    t('G0. todo card carregado tem base (não enumerável)', antes.temBase && !antes.enumeravel, antes);
    await p.evaluate(() => { const c = cards.find(x => x.id === 'c1'); c.priority = 'alta'; return fbSaveCard(c); }); await p.waitForTimeout(900);
    const noBanco = await p.evaluate(sq => JSON.stringify(window.__store.kanban.squads[sq].dados.cards).includes('__base'), SQ);
    const depois = await p.evaluate(() => { const c = cards.find(x => x.id === 'c1'); return { baseDesc: c.__base.desc, desc: c.desc, baseHist: c.__base.history.length }; });
    t('G. __base nunca vai pro Firebase', !noBanco, noBanco);
    t('G2. depois do merge a base é o que foi gravado (briefing e 3 entradas) e o card local também', /BRIEFING/.test(depois.baseDesc) && depois.desc === depois.baseDesc && depois.baseHist === 3, depois); await ctx.close(); }

  { const { ctx, p } = await abre();   // H: card SEM base (criado/restaurado à mão) grava como sempre — o merge só protege quem sabe de onde partiu
    await p.evaluate(() => { const c = cards.find(x => x.id === 'c2'); const clone = JSON.parse(JSON.stringify(c)); cards[cards.indexOf(c)] = clone; window._cardsByKey[Object.keys(window._cardsByKey).find(k => window._cardsByKey[k] === c)] = clone; clone.title = 'sem base'; return fbSaveCard(clone); }); await p.waitForTimeout(800);
    const r = await banco(p, 'c2'); t('H. card sem base é gravado normalmente (comportamento de sempre)', r.title === 'sem base', r); await ctx.close(); }

  { const { ctx, p } = await abre(); await outraPessoaEdita(p);   // I: save em massa NÃO carimba cards_updated_at de quem não mudou (menos cache invalidado)
    const antes = await p.evaluate(sq => Object.assign({}, window.__store.kanban.squads[sq].dados.cards_updated_at), SQ);
    await p.evaluate(() => { const c = cards.find(x => x.id === 'c3'); c.title = 'Card 3 editado'; return fbSaveAll(undefined); }); await p.waitForTimeout(1200);
    const dep = await p.evaluate(sq => Object.assign({}, window.__store.kanban.squads[sq].dados.cards_updated_at), SQ);
    const mudaram = Object.keys(dep).filter(id => dep[id] !== antes[id]);
    t('I. um save em massa sem touchedIds só carimba o card que mudou de verdade', mudaram.join() === 'c3', mudaram); await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1); })();
