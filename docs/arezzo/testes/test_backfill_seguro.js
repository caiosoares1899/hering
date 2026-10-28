// 🛟 O backfill de `flow` do boot NÃO pode regravar o /cards inteiro (relato de produção 2026-10-28, midiacriativa: cards sumiam "quando as pessoas entravam").
// Antes: qualquer aparelho que carregasse um card sem `flow` fazia `set` do array local em /cards — apagando os arquivados (que o aparelho não baixa), compactando as posições
// (cards_index passava a apontar pro lugar errado) e passando por FORA do resgate de fbSaveAll(). Agora só o `flow` dos cards afetados é gravado, na posição real.
// Também confere a trilha de auditoria (cards_auditoria: quem gravou, de qual função, em qual versão). K=kanban roda o MESMO teste na produção (deve FALHAR lá).
//   python3 -m http.server 8941 &   node docs/arezzo/testes/test_backfill_seguro.js        (K=kanban para a produção)
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const K = process.env.K || 'kanban-dev'; const SQ = 'midiacriativa';
const U = (uid, n) => ({ uid, email: uid + '@ciahering.com.br', displayName: n, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const flow = col => ({ enteredAt: { [col]: '2026-10-20T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-10-20T12:00:00.000Z' }], firstStartAt: null, doneAt: null });
const card = (id, title, col, extra) => Object.assign({ id, title, col, createdAt: '2026-10-20', desc: 'conteudo de ' + title, flow: flow(col), updatedAt: '2026-10-27T10:00:00.000Z' }, extra || {});
const cardsObj = { 0: card('cA', 'Card A', 'backlog'), 1: card('cB', 'Card B', 'doing'), 3: card('cD', 'Card D', 'doing'), 4: card('cE', 'Card E arquivado', 'done', { archived: true }), 5: card('cF', 'Card F sem flow', 'backlog', { flow: undefined }), 7: card('cH', 'Card H', 'review') };
const idx = {}, upd = {}, arq = {}; Object.entries(cardsObj).forEach(([k, c]) => { idx[c.id] = String(k); upd[c.id] = c.updatedAt; if (c.archived) arq[c.id] = true; });
const seed = { kanban: { usuarios: { eve: { uid: 'eve', nome: 'Eve', email: 'eve@ciahering.com.br', inscrito: true, init: 'EV', role: 'po', squads: { [SQ]: true } } }, usuarios_publicos: { eve: { uid: 'eve', nome: 'Eve', init: 'EV', role: 'po', squads: { [SQ]: true } } }, config: { adm_emails: [] },
  squads: { [SQ]: { dados: { cards: JSON.parse(JSON.stringify(cardsObj)), cards_index: idx, cards_updated_at: upd, cards_archived: arq, columns: [{ id: 'backlog', name: 'Backlog' }, { id: 'doing', name: 'Fazendo' }, { id: 'review', name: 'Revisão' }, { id: 'done', name: 'Concluído', isDone: true }] } } } } };
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); await fake.install(ctx, seed); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8941/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U('eve', 'Eve')); await p.waitForTimeout(4500);
  const r = await p.evaluate(sq => { const dd = window.__store.kanban.squads[sq].dados; const c = dd.cards; const arr = Array.isArray(c) ? c.map((x, i) => x ? [i, x] : null).filter(Boolean) : Object.entries(c);
    return { writes: window.__log.filter(l => l[0] === 'set' && /\/dados\/cards$/.test(l[1])).length, chaves: arr.map(([k]) => +k), ids: arr.map(([, x]) => x.id), posicoes: Object.fromEntries(arr.map(([k, x]) => [x.id, +k])), flowF: !!(arr.find(([, x]) => x.id === 'cF') || [])[1]?.flow, index: dd.cards_index, auditoria: Object.values(dd.cards_auditoria || {}) }; }, SQ);
  t('A. o boot NÃO substitui o /cards inteiro (nenhum `set` em .../cards)', r.writes === 0, r.writes);
  t('B. o card arquivado (que o aparelho não baixa) continua no banco', r.ids.includes('cE'), r.ids);
  t('C. as posições dos cards não foram compactadas (0,1,3,4,5,7) e batem com o cards_index', JSON.stringify(r.chaves) === '[0,1,3,4,5,7]' && Object.entries(r.posicoes).every(([id, k]) => r.index[id] === String(k)), [r.chaves, r.index]);
  t('D. o card sem `flow` ganhou o `flow` (o backfill continua funcionando, só que pontual)', r.flowF, r.flowF);
  t('E. a trilha de auditoria registrou a gravação do backfill (origem, versão e pilha)', r.auditoria.some(a => a.origem === 'applyCardsSync-backfill' && a.cardsAfetados === 1 && a.ver && a.pilha), r.auditoria);
  // auditoria do fbSaveAll: quem chamou (função) aparece na pilha
  const a2 = await p.evaluate(async sq => { function acaoEmMassaDeTeste() { return fbSaveAll(undefined, ['cA']); } await acaoEmMassaDeTeste(); await new Promise(r => setTimeout(r, 300)); return Object.values(window.__store.kanban.squads[sq].dados.cards_auditoria || {}).filter(a => a.origem === 'fbSaveAll'); }, SQ);
  t('F. fbSaveAll deixa rastro: quem, versão, quantos cards e a função que chamou (pilha)', a2.length === 1 && /acaoEmMassaDeTeste/.test(a2[0].pilha) && a2[0].tocados === 1 && a2[0].por === 'Eve', a2);
  t('G. sem erro de JS', !errs.length, errs); await b.close(); console.log(ok ? '\nTUDO OK (' + K + ')' : '\nHÁ FALHAS (' + K + ')'); process.exit(ok ? 0 : 1); })();
