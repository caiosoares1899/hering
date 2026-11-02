// /monitorarbugs do Timer e Produtividade (2026-11-02): reproduz, no boot REAL do Maré com Firebase falso, os achados da rodada.
//   (A) duplo clique em "Criar" gravava 2 atividades (id novo por chamada + gravação assíncrona, sem trava)
//   (B) o modal de edição de um Modelo/Recorrente (card TEMPORÁRIO __qltmp__) mostrava o timer: criava registro pendurado num id que nunca existe de verdade
//   (C) registro "pela metade" no índice pessoal (o vigia/uma corrida recria só `avisos` depois do encerrar) virava linha "undefined" no atalho do topo
//   (D) card excluído com timer rodando: o aviso/linha ficavam pra sempre (corrigido no servidor — ver functions/timers/__tests__/vigia.test.js)
//   python3 -m http.server 8941 &   node docs/arezzo/testes/test_monitorarbugs_timer.js     (K=kanban para a produção)
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const K = process.env.K || 'kanban-dev'; const SQ = 'midiacriativa';
const U = (uid, n) => ({ uid, email: uid + '@ciahering.com.br', displayName: n, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const flow = col => ({ enteredAt: { [col]: '2026-10-20T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-10-20T12:00:00.000Z' }], firstStartAt: null, doneAt: null });
const card = (id, col) => ({ id, title: 'Card ' + id, col, createdAt: '2026-10-20', desc: 'texto', owner: 'EV', flow: flow(col), updatedAt: '2026-10-27T10:00:00.000Z' });
const mk = extra => ({ kanban: Object.assign({ usuarios: { eve: { uid: 'eve', nome: 'Eve Alves', email: 'eve@ciahering.com.br', inscrito: true, init: 'EV', role: 'po', squads: { [SQ]: true } } },
  usuarios_publicos: { eve: { uid: 'eve', nome: 'Eve Alves', init: 'EV', role: 'po', squads: { [SQ]: true } } }, config: { adm_emails: [] },
  squads: { [SQ]: { dados: { cards: { 0: card('c1', 'backlog') }, cards_index: { c1: '0' }, cards_updated_at: { c1: '2026-10-27T10:00:00.000Z' },
    columns: [{ id: 'backlog', name: 'Backlog' }, { id: 'doing', name: 'Fazendo' }] } } } }, extra || {}) });
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const abre = async (seed) => { const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }); await fake.install(ctx, JSON.parse(JSON.stringify(seed || mk())));
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8941/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U('eve', 'Eve Alves')); await p.waitForTimeout(3500);
    await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); }); return { ctx, p, errs }; };
  const lista = (p, c) => p.evaluate(([sq, c]) => Object.values((window.__store.kanban.squads[sq].dados.card_timers || {})[c] || {}), [SQ, 'c1']);

  // A) duplo clique em "Criar" com a rede lenta
  { const { ctx, p } = await abre(); await p.evaluate(() => { window.__setDelay = () => 300; openCard('c1'); }); await p.waitForTimeout(400);
    await p.click('#m-timer-add'); await p.fill('#tm-f-nome', 'Clique duplo'); const btn = p.locator('#m-timer-form .btn-teal');
    await btn.click(); await btn.click({ force: true, noWaitAfter: true }).catch(() => {}); await p.waitForTimeout(1500);
    const l = await lista(p); t('A. duplo clique em Criar cria UMA atividade só', l.length === 1, l.map(x => x.atividade)); await ctx.close(); }

  // B) modal de um Modelo (card temporário): não oferece timer
  { const seed = mk({}); seed.kanban.squads[SQ].dados.ql_items = { modelo: [{ id: 'm1', title: 'Modelo X', tag: '', col: 'backlog' }] };
    const { ctx, p } = await abre(seed);
    const abriu = await p.evaluate(() => { try { currentQL = 'modelos'; qlItems.modelos = [{ id: 'm1', title: 'Modelo X', col: 'backlog' }]; openQLEdit(0); return true; } catch (e) { return String(e); } }); await p.waitForTimeout(500);
    const info = await p.evaluate(() => ({ editando: !!_editingQLItem, id: typeof editingId !== 'undefined' ? editingId : null, add: document.getElementById('m-timer-add')?.style.display, txt: document.getElementById('m-timers')?.textContent.slice(0, 60), sec: document.getElementById('m-timers-sec')?.style.display }));
    t('B. editando um Modelo/Recorrente o timer não é oferecido (card temporário)', abriu === true && (info.add === 'none' || info.sec === 'none'), { abriu, info }); await ctx.close(); }

  // C) registro "pela metade" no índice pessoal não vira linha "undefined" nem conta no selo
  { const seed = mk({ timers_ativos: { eve: { orf: { avisos: { zero: true } }, ok1: { sq: SQ, cardId: 'c1', cardTitle: 'Card c1', atividade: 'Boa', tipo: 'cron', status: 'rodando', startedAt: Date.now() - 5000, accMs: 0, porUid: 'eve' } } } });
    const { ctx, p } = await abre(seed); await p.click('#tb-timers'); await p.waitForTimeout(300);
    const txt = await p.textContent('#tm-pop-list'); const n = (await p.textContent('#tb-timers-n')).trim();
    t('C. entrada incompleta do índice é ignorada (nada de "undefined" no atalho, selo = 1)', !/undefined/.test(txt) && n === '1' && /Boa/.test(txt), { txt: txt.slice(0, 120), n }); await ctx.close(); }

  await b.close(); console.log(ok ? '\nTUDO OK (' + K + ')' : '\nHÁ FALHAS (' + K + ')'); process.exit(ok ? 0 : 1); })();
