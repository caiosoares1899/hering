// Regressão: criar_card em squad com chave 4 excluída não pode sobrescrever a chave 7.
// Servir a raiz na porta 8961; rodar com node. Boot real e Firebase falso, sem banco real.
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
  const result = await p.evaluate(() => executeTool('criar_card', {titulo:'Card criado pelo agente',coluna:'doing'}));
  t('executeTool continua síncrono e aceita criação', result.ok && !!result.card_id, result);
  await p.waitForFunction(async id => {
    const ix=(await window._get(window._ref(window._db, FB+'/cards_index'))).val()||{};
    return ix[id]!==undefined && (await window._get(window._ref(window._db, FB+'/cards/'+ix[id]))).val()?.id===id;
  }, result.card_id, {timeout:5000}).catch(e=>{if(e.name!=='TimeoutError')throw e;});
  const db = await p.evaluate(async () => { const r = await window._get(window._ref(window._db, FB + '/cards')); const c = r.val() || {}; const ix = (await window._get(window._ref(window._db, FB + '/cards_index'))).val() || {}; return { cards: c, ids: Object.entries(c).map(([k, v]) => k + ':' + (v && v.id)), idx: ix }; });
  const idsNoBanco = db.ids.map(s => s.split(':')[1]);
  t('cards existentes (c5, c6, c7) continuam no banco depois da criação pelo agente', ['c1', 'c2', 'c3', 'c5', 'c6', 'c7'].every(id => idsNoBanco.includes(id)), db.ids);
  t('chave 7 que o índice local apontaria continua intacta', JSON.stringify(db.cards['7'])===JSON.stringify(CARDS['7']), db);
  t('novo card existe no banco e tem cards_index', idsNoBanco.includes(result.card_id) && db.ids.includes(db.idx[result.card_id]+':'+result.card_id), db);
  const idxOk = Object.entries(db.idx).every(([id, k]) => db.ids.includes(k + ':' + id));
  t('índice aponta cada card para a posição certa', idxOk, db);
  t('sem erro de JS', !errs.length, errs);
  await b.close(); console.log(`\n${n - f}/${n} ok`); process.exit(f ? 1 : 0);
})();
