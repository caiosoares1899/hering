// 🐚 @card: da Concha — o Maré deixa no aparelho o índice enxuto da squad aberta (oceano_cards_<squad>_dev = {t, u, v:[{id, t, c}]}),
// sem nenhuma leitura a mais do banco; arquivados ficam de fora; o índice acompanha um card novo. Boot REAL do Maré com o Firebase falso.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_mare_indice_concha.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const SQ = 'midiacriativa', K = process.env.K || 'kanban-dev';
const U = (uid, n) => ({ uid, email: uid + '@ciahering.com.br', displayName: n, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const flow = col => ({ enteredAt: { [col]: '2026-10-20T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-10-20T12:00:00.000Z' }], firstStartAt: null, doneAt: null });
const card = (id, title, col, extra) => Object.assign({ id, title, col, createdAt: '2026-10-20', desc: 'conteudo longo '.repeat(20), flow: flow(col), updatedAt: '2026-10-26T10:00:00.000Z' }, extra || {});
const seed = () => { const cards = {}, idx = {}, upd = {}, arq = {};
  cards[0] = card('cBanner', 'Banner da Black Friday', 'backlog'); cards[1] = card('cRel', 'Relatório semanal', 'doing'); cards[2] = card('cArq', 'Card arquivado', 'done', { archived: true });
  Object.entries(cards).forEach(([k, c]) => { idx[c.id] = String(k); upd[c.id] = c.updatedAt; if (c.archived) arq[c.id] = true; });
  return { kanban: { usuarios: { eve: { uid: 'eve', nome: 'Eve', email: 'eve@ciahering.com.br', inscrito: true, init: 'EV', role: 'po', squads: { [SQ]: true } } }, usuarios_publicos: { eve: { uid: 'eve', nome: 'Eve', init: 'EV', role: 'po', squads: { [SQ]: true } } },
    squads: { [SQ]: { dados: { cards, cards_index: idx, cards_updated_at: upd, cards_archived: arq, columns: [{ id: 'backlog', name: 'Backlog' }, { id: 'doing', name: 'Fazendo' }, { id: 'done', name: 'Concluído', isDone: true }] } } } } }; };
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 400))); };
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(chromeRoot) ? path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); await fake.install(ctx, seed());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8941/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb);
  await p.evaluate(x => window.__authCb(x), U('eve', 'Eve')); await p.waitForTimeout(6500);
  const ind = () => p.evaluate(k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, 'oceano_cards_' + SQ + (K.endsWith('-dev') ? '_dev' : ''));
  let x = await ind();
  t('o Maré grava o índice da squad aberta com o uid de quem está logado', x && x.u === 'eve' && typeof x.t === 'number', x);
  t('só {id, título, coluna} dos não arquivados', x && JSON.stringify(x.v.map(c => [c.id, c.t, c.c]).sort()) === JSON.stringify([['cBanner', 'Banner da Black Friday', 'backlog'], ['cRel', 'Relatório semanal', 'doing']]), x && x.v);
  t('enxuto: sem descrição nem outros campos', x && x.v.every(c => Object.keys(c).sort().join() === 'c,id,t'), x && x.v);
  const leituras = await p.evaluate(() => (window.__log || []).filter(l => l[0] === 'get' || l[0] === 'onValue').map(l => l[1]).filter(pp => /oceano|indice/.test(pp)).length);
  t('nenhuma leitura nova do banco para isso', leituras === 0, leituras);
  await p.evaluate(sq => { const fb = window._ref, db = window._db; const novo = { id: 'cNovo', title: 'Card novo do teste', col: 'backlog', createdAt: '2026-11-25', updatedAt: new Date().toISOString() };
    window._cardsByKey = window._cardsByKey || {}; window._cardsByKey['3'] = novo; window._scheduleCardsSync(); }, SQ);
  await p.waitForTimeout(2800);
  x = await ind();
  t('card novo entra no índice (2 s depois da mudança)', x && x.v.some(c => c.id === 'cNovo'), x && x.v);
  t('sem erro de JS', !errs.length, errs);
  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
