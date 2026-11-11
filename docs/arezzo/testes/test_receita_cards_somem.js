// 🧩 Receita (fan-out) apagando cards (relato de 12/11/2026: "colocar uma receita num card dá erro, aciona o guardião e some card").
// Cenário real: squad antiga tem "buracos" nas chaves de /cards (cards excluídos). Ao aplicar uma receita num card com Ficha Técnica
// (campanha), _crvPropagateToChildren() chamava fbSaveCard() nos filhos ANTES de fbCreateCard() terminar; sem a chave real, fbSaveCard()
// usava a posição LOCAL do array como chave e sobrescrevia o card que estava ali no banco.
// Rodar: python3 -m http.server 8961 --directory . (na raiz) e `node docs/arezzo/testes/test_receita_cards_somem.js` (PAGINA=kanban.html testa o prod).
const fs = require('fs'), path = require('path'), home = require('os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const cr = path.join(home, 'hering-tools/chrome'), chrome = process.env.CHROME || path.join(cr, fs.readdirSync(cr).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8961', pagina = process.env.PAGINA || 'kanban-dev.html';
const U = { uid: 'eve', email: 'eve@ciahering.com.br', displayName: 'Eve Martins', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const card = (id, t, extra) => Object.assign({ id, title: t, col: 'doing', createdAt: '2026-11-01', owner: '', tags: [] }, extra || {});
// chaves com buraco: 0,1,2,3,5,6,7 (a 4 foi excluída)
const CARDS = { 0: card('c0', 'Campanha Brasil MKT', { criativo: { campanhaTipo: 'campanha', campanhaNome: 'Brasil', canal: 'meta' } }), 1: card('c1', 'Card 1'), 2: card('c2', 'Card 2'), 3: card('c3', 'Card 3'), 5: card('c5', 'Card 5 (não pode sumir)'), 6: card('c6', 'Card 6 (não pode sumir)'), 7: card('c7', 'Card 7 (não pode sumir)') };
const IDX = { c0: '0', c1: '1', c2: '2', c3: '3', c5: '5', c6: '6', c7: '7' };
const seed = () => ({ kanban: {
  usuarios: { eve: { uid: 'eve', nome: 'Eve Martins', email: U.email, init: 'EM', role: 'adm', inscrito: true, squads: { site: true } } },
  usuarios_publicos: { eve: { uid: 'eve', nome: 'Eve Martins', init: 'EM', role: 'adm', squads: { site: true } } }, config: { adm_emails: [U.email] },
  squads_meta: { site: { label: 'Squad Site' } },
  squads: { site: { dados: { columns: [{ id: 'doing', name: 'Fazendo' }, { id: 'done', name: 'Concluído' }], cards_index: IDX, cards: CARDS,
    config: { fanout_templates: { r1: { nome: 'Teste Campanha', filhos: [{ sufixo: 'Feed' }, { sufixo: 'Stories' }, { sufixo: 'Reels' }] } } } } } } } });
(async () => {
  const b = await chromium.launch({ executablePath: chrome }); let n = 0, f = 0;
  const t = (nome, ok, d) => { n++; if (!ok) f++; console.log((ok ? '✅ ' : '❌ ') + nome + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 500))); };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed()); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/' + pagina + '?squad=site'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(u => window.__authCb(u), U); await p.waitForTimeout(3500);
  await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')));
  t('receita carregada', await p.evaluate(() => !!(fanoutTemplates && fanoutTemplates.r1)));
  if (process.env.LENTO) await p.evaluate(ms => window.__setDelay && window.__setDelay(+ms), process.env.LENTO);
  await p.evaluate(() => openCard('c0')); await p.waitForTimeout(800);
  await p.evaluate(() => applyFanoutToCurrentCard('r1')); await p.waitForTimeout(2500);
  const db = await p.evaluate(async () => { const r = await window._get(window._ref(window._db, FB + '/cards')); const c = r.val() || {}; const ix = (await window._get(window._ref(window._db, FB + '/cards_index'))).val() || {}; return { ids: Object.entries(c).map(([k, v]) => k + ':' + (v && v.id)), idx: ix }; });
  const idsNoBanco = db.ids.map(s => s.split(':')[1]);
  t('cards existentes (c5, c6, c7) continuam no banco depois da receita', ['c1', 'c2', 'c3', 'c5', 'c6', 'c7'].every(id => idsNoBanco.includes(id)), db.ids);
  const filhos = idsNoBanco.filter(id => id && !/^c\d$/.test(id));
  t('os 3 filhos existem uma vez cada (sem cópia duplicada)', filhos.length === 3 && new Set(filhos).size === 3, db.ids);
  const idxOk = Object.entries(db.idx).every(([id, k]) => db.ids.includes(k + ':' + id));
  t('índice aponta cada card para a posição certa', idxOk, db);
  t('sem erro de JS', !errs.length, errs);
  await b.close(); console.log(`\n${n - f}/${n} ok`); process.exit(f ? 1 : 0);
})();
