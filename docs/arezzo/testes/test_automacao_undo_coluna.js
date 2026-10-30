// ↩️ Automação "move_card" que parecia "desfazer": relato do time (2026-10-30) — "a automação rodou, o card mudou de coluna e depois voltou pra coluna de antes".
// Causa: saveCard()/autosave só gravam a coluna do <select> se ela difere de `_modalOpenCol` (a coluna de quando o modal abriu). Mas `_modalOpenCol` nunca era atualizado
// depois de um save: mudou a coluna no modal (A→B) e salvou → o select continua em B e `_modalOpenCol` continua em A. Se a automação ("movido para B → mover para C", 1,2 s depois)
// ou outra pessoa move o card pra C com o modal ainda aberto, o PRÓXIMO autosave/Salvar vê "select (B) ≠ aberto (A)", entende como mudança da pessoa e regrava B por cima de C.
// Boot REAL do Maré com Firebase falso. K=kanban roda o MESMO teste na produção (os cenários A e B devem FALHAR lá).
//   python3 -m http.server 8941 &   node docs/arezzo/testes/test_automacao_undo_coluna.js        (K=kanban para a produção)
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const K = process.env.K || 'kanban-dev'; const SQ = 'midiacriativa';
const U = (uid, n) => ({ uid, email: uid + '@ciahering.com.br', displayName: n, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const flow = col => ({ enteredAt: { [col]: '2026-10-20T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-10-20T12:00:00.000Z' }], firstStartAt: null, doneAt: null });
const card = (id, col) => ({ id, title: 'Card ' + id, col, createdAt: '2026-10-20', desc: 'texto', owner: 'EV', flow: flow(col), updatedAt: '2026-10-27T10:00:00.000Z' });
const cs = { 0: card('c1', 'backlog'), 1: card('c2', 'backlog') }; const idx = { c1: '0', c2: '1' }, upd = { c1: '2026-10-27T10:00:00.000Z', c2: '2026-10-27T10:00:00.000Z' };
const seed = { kanban: { usuarios: { eve: { uid: 'eve', nome: 'Eve', email: 'eve@ciahering.com.br', inscrito: true, init: 'EV', role: 'po', squads: { [SQ]: true } } }, usuarios_publicos: { eve: { uid: 'eve', nome: 'Eve', init: 'EV', role: 'po', squads: { [SQ]: true } } }, config: { adm_emails: [] },
  squads: { [SQ]: { dados: { cards: cs, cards_index: idx, cards_updated_at: upd,
    auto_rules: { r1: { id: 'r1', active: true, label: 'Doing vai pra Revisão', trigger: 'move_to', triggerVal: 'doing', action: 'move_card', actionVal: 'review' } },
    columns: [{ id: 'backlog', name: 'Backlog' }, { id: 'doing', name: 'Fazendo' }, { id: 'review', name: 'Revisão' }, { id: 'done', name: 'Concluído', isDone: true }] } } } } };
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const abre = async () => { const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }); await fake.install(ctx, JSON.parse(JSON.stringify(seed))); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8941/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U('eve', 'Eve')); await p.waitForTimeout(4000);
    await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); }); return { ctx, p, errs }; };
  const colNoBanco = (p, id) => p.evaluate(([sq, id]) => { const c = window.__store.kanban.squads[sq].dados.cards; return (Array.isArray(c) ? c : Object.values(c)).filter(Boolean).find(x => x.id === id)?.col; }, [SQ, id]);
  const editaDesc = (p, txt) => p.evaluate(async txt => { document.getElementById('m-desc').value = txt; scheduleAutoSave(); await new Promise(r => setTimeout(r, 1800)); }, txt);

  // A) a pessoa muda a coluna no modal (backlog→doing) e a automação leva o card pra "review"; a próxima edição do mesmo modal NÃO pode devolver o card pra "doing"
  { const { ctx, p, errs } = await abre();
    await p.evaluate(() => { openCard('c1'); document.getElementById('m-col').value = 'doing'; scheduleAutoSave(); });
    await p.waitForTimeout(3500); // autosave (0,8 s) + atraso da automação (1,2 s) + escrita
    const apos = await colNoBanco(p, 'c1'); t('A1. a automação levou o card pra Revisão', apos === 'review', apos);
    await editaDesc(p, 'texto editado depois'); const fim = await colNoBanco(p, 'c1');
    t('A2. editar a descrição depois NÃO devolve o card pra "Fazendo" (o "undo" do relato)', fim === 'review', fim);
    const desc = await p.evaluate(sq => { const c = window.__store.kanban.squads[sq].dados.cards; return (Array.isArray(c) ? c : Object.values(c)).filter(Boolean).find(x => x.id === 'c1')?.desc; }, SQ);
    t('A3. a edição da descrição foi gravada normalmente', desc === 'texto editado depois', desc);
    t('A4. o select do modal acompanha a coluna real (Revisão), sem o card parecer ainda estar em "Fazendo"', await p.evaluate(() => document.getElementById('m-col').value) === 'review', null);
    t('A5. sem erro de JS', !errs.length, errs); await ctx.close(); }

  // B) mesma coisa, mas o card é movido por OUTRA pessoa (arrastar) enquanto o modal segue aberto depois de um save com mudança de coluna
  { const { ctx, p } = await abre();
    await p.evaluate(() => { openCard('c2'); document.getElementById('m-col').value = 'done'; scheduleAutoSave(); }); await p.waitForTimeout(2000);
    await p.evaluate(async () => { const c = cards.find(x => x.id === 'c2'); c.col = 'review'; recordMove(c, 'review'); await fbSaveCard(c); }); await p.waitForTimeout(500);
    await editaDesc(p, 'outra edição'); const fim = await colNoBanco(p, 'c2');
    t('B. card movido por outra pessoa com o modal aberto: o próximo autosave respeita a nova coluna', fim === 'review', fim); await ctx.close(); }

  // C) controle: a pessoa NÃO mexeu na coluna — a automação (disparada por outro gatilho) e o modal aberto convivem (já funcionava)
  { const { ctx, p } = await abre();
    await p.evaluate(() => { openCard('c1'); });
    await p.evaluate(async () => { const c = cards.find(x => x.id === 'c1'); c.col = 'review'; recordMove(c, 'review'); await fbSaveCard(c); }); await p.waitForTimeout(500);
    await editaDesc(p, 'sem mexer na coluna'); const fim = await colNoBanco(p, 'c1');
    t('C. sem mexer no select: a coluna movida por fora é preservada', fim === 'review', fim); await ctx.close(); }

  // D) a pessoa muda a coluna DE PROPÓSITO duas vezes seguidas no mesmo modal — a segunda escolha vale (a proteção não pode "travar" a coluna)
  { const { ctx, p } = await abre();
    await p.evaluate(() => { openCard('c2'); document.getElementById('m-col').value = 'doing'; scheduleAutoSave(); }); await p.waitForTimeout(500);
    // desliga a automação desta execução pra isolar o comportamento do select
    await p.evaluate(() => { autoRules.forEach(r => r.active = false); }); await p.waitForTimeout(2200);
    await p.evaluate(() => { document.getElementById('m-col').value = 'done'; scheduleAutoSave(); }); await p.waitForTimeout(1800);
    const fim = await colNoBanco(p, 'c2'); t('D. duas mudanças de coluna pela própria pessoa no mesmo modal: vale a última (Concluído)', fim === 'done', fim); await ctx.close(); }

  await b.close(); console.log(ok ? '\nTUDO OK (' + K + ')' : '\nHÁ FALHAS (' + K + ')'); process.exit(ok ? 0 : 1); })();
