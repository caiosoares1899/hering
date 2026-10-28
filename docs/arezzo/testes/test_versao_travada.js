// 🔒 Aba desatualizada não grava + checagem de versão ao voltar à aba + cache local versionado (relato de produção 2026-10-28, squad midiacriativa).
// Boot REAL do Maré com Firebase falso; o version.json é controlado por page.route. K=kanban roda o MESMO teste na produção (ao promover; antes do fix os blocos A–E devem FALHAR lá).
//   python3 -m http.server 8941 &   node docs/arezzo/testes/test_versao_travada.js        (K=kanban para a produção)
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const K = process.env.K || 'kanban-dev'; const SQ = 'midiacriativa'; const CHAVE = K === 'kanban' ? 'kanban' : 'kanban_dev';
const U = { uid: 'eve', email: 'eve@ciahering.com.br', displayName: 'Eve', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const flow = col => ({ enteredAt: { [col]: '2026-10-20T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-10-20T12:00:00.000Z' }], firstStartAt: null, doneAt: null });
const card = (id, title, col) => ({ id, title, col, createdAt: '2026-10-20', desc: 'x', flow: flow(col), updatedAt: '2026-10-27T10:00:00.000Z' });
const cs = { 0: card('c0', 'Card Zero', 'backlog'), 1: card('c1', 'Card Um', 'doing'), 2: card('c2', 'Card Dois', 'doing') };
const idx = {}, upd = {}; Object.entries(cs).forEach(([k, c]) => { idx[c.id] = String(k); upd[c.id] = c.updatedAt; });
const seed = () => ({ kanban: { usuarios: { eve: { uid: 'eve', nome: 'Eve', email: 'eve@ciahering.com.br', inscrito: true, init: 'EV', role: 'po', squads: { [SQ]: true } } }, usuarios_publicos: { eve: { uid: 'eve', nome: 'Eve', init: 'EV', role: 'po', squads: { [SQ]: true } } }, config: { adm_emails: [] },
  squads: { [SQ]: { dados: { cards: JSON.parse(JSON.stringify(cs)), cards_index: idx, cards_updated_at: upd, columns: [{ id: 'backlog', name: 'Backlog' }, { id: 'doing', name: 'Fazendo' }] } } } } });
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  // modo do version.json: 'igual' | 'novo' | 'fora' (rede caída)
  const abre = async (modo) => { const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); await fake.install(ctx, seed()); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    const est = { modo }; let atual = null;
    await p.route(/version\.json/, async r => { if (est.modo === 'fora') return r.abort(); const j = JSON.parse((await (await r.fetch()).text()) || '{}'); j[CHAVE] = est.modo === 'novo' ? 'v9.99.999-NOVA' : atual; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) }); });
    await p.goto('http://localhost:8941/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb); atual = await p.evaluate(() => document.querySelector('.version').textContent.trim());
    await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(4200); return { ctx, p, errs, est }; };
  const gravacoes = p => p.evaluate(() => window.__log.filter(l => l[0] !== 'get' && /\/dados\/(cards|cards_index)/.test(l[1] || '')).length);
  const tentaGravar = p => p.evaluate(async () => { const r = {}; const falha = async (n, f) => { try { await f(); r[n] = 'gravou'; } catch (e) { r[n] = e && e.name === 'VersaoDesatualizada' ? 'recusou' : 'erro:' + (e && e.message); } };
    await falha('saveAll', () => fbSaveAll(undefined, ['c1'])); await falha('saveCard', () => fbSaveCard(cards.find(c => c.id === 'c1')));
    await falha('createCard', () => fbCreateCard({ id: 'cNovo', title: 'Novo', col: 'backlog', createdAt: '2026-10-28', desc: 'x', flow: { enteredAt: { backlog: '2026-10-28T12:00:00.000Z' }, log: [], firstStartAt: null, doneAt: null } })); await new Promise(r => setTimeout(r, 300)); return r; });

  { const { ctx, p, errs, est } = await abre('igual');   // A: versão igual → tudo normal; versão nova ao VOLTAR pra aba → trava
    const r0 = await tentaGravar(p); t('A1. aba em dia grava normalmente (saveAll, saveCard, createCard)', r0.saveAll === 'gravou' && r0.saveCard === 'gravou' && r0.createCard === 'gravou', r0);
    t('A2. sem aviso de versão enquanto está em dia', await p.evaluate(() => !document.getElementById('_au-block') && !window._auStale), '');
    est.modo = 'novo'; await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(700);
    t('A3. ao VOLTAR pra aba (visibilitychange) a versão nova é detectada na hora — sem esperar o tick de 5 min', await p.evaluate(() => !!document.getElementById('_au-block')), '');
    const antes = await gravacoes(p); const r1 = await tentaGravar(p); const depois = await gravacoes(p);
    t('A4. com o aviso na tela, fbSaveAll / fbSaveCard / fbCreateCard RECUSAM (promessa rejeitada VersaoDesatualizada)', r1.saveAll === 'recusou' && r1.saveCard === 'recusou' && r1.createCard === 'recusou', r1);
    t('A5. e nada é gravado em /cards nem em /cards_index', depois === antes, [antes, depois]);
    t('A6. sem erro de JS', !errs.length, errs); await ctx.close(); }

  { const { ctx, p, est } = await abre('igual'); est.modo = 'novo';   // B: pageshow (PWA retomado do cache do navegador)
    await p.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))); await p.waitForTimeout(700);
    t('B. pageshow (voltando do cache de páginas / PWA retomado) também checa a versão', await p.evaluate(() => !!document.getElementById('_au-block') && window._auStale === true), ''); await ctx.close(); }

  { const { ctx, p, est } = await abre('igual'); est.modo = 'fora';   // C: sem rede NÃO trava (só trava depois de CONFIRMAR versão nova)
    await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(700);
    const r = await tentaGravar(p); t('C. com o version.json inacessível, não trava e continua gravando', !(await p.evaluate(() => !!document.getElementById('_au-block'))) && r.saveAll === 'gravou', r); await ctx.close(); }

  { const { ctx, p, est } = await abre('igual');   // D: várias voltas seguidas = 1 consulta só (limite de 10 s)
    let n = 0; await p.route(/version\.json/, async r => { n++; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ [CHAVE]: await p.evaluate(() => document.querySelector('.version').textContent.trim()) }) }); });
    for (let i = 0; i < 4; i++) { await p.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); window.dispatchEvent(new Event('online')); }); await p.waitForTimeout(80); }
    await p.waitForTimeout(400); t('D. visibilitychange + pageshow + online juntos fazem no máximo 1 consulta ao version.json', n === 1, n); await ctx.close(); }

  // E: cache local — descartado quando o esquema muda; cache antigo (sem o campo) continua valendo
  const lerCache = p => p.evaluate(() => new Promise(res => { const rq = indexedDB.open('mare_digital_cache', 1); rq.onsuccess = () => { const g = rq.result.transaction('cards_cache').objectStore('cards_cache').get('cardsCache_v1_midiacriativa'); g.onsuccess = () => res(g.result || null); }; rq.onerror = () => res(null); }));
  const mexeCache = (p, fn) => p.evaluate(fnTxt => new Promise(res => { const rq = indexedDB.open('mare_digital_cache', 1); rq.onsuccess = () => { const tx = rq.result.transaction('cards_cache', 'readwrite'), st = tx.objectStore('cards_cache'); const g = st.get('cardsCache_v1_midiacriativa'); g.onsuccess = () => { const v = g.result; (new Function('v', fnTxt))(v); st.put(v, 'cardsCache_v1_midiacriativa'); }; tx.oncomplete = () => res(true); }; }), fn.toString().replace(/^[^{]*\{|\}$/g, ''));
  const tituloC0 = p => p.evaluate(() => (cards.find(c => c.id === 'c0') || {}).title);
  { const { ctx, p } = await abre('igual'); const c1 = await lerCache(p);
    t('E1. o cache gravado leva o número do esquema', !!c1 && c1.schema === 1, c1 && c1.schema);
    await mexeCache(p, v => { v.cardsById.c0.title = 'COPIA VELHA'; delete v.schema; }); await p.reload(); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(4200);
    t('E2. cache ANTIGO (sem o campo de esquema) continua valendo — o deploy não invalida ninguém à toa', (await tituloC0(p)) === 'COPIA VELHA', await tituloC0(p));
    await mexeCache(p, v => { v.cardsById.c0.title = 'COPIA VELHA'; v.schema = 99; }); await p.reload(); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(4200);
    t('E3. com o esquema diferente o cache é descartado e o card volta como está NO BANCO', (await tituloC0(p)) === 'Card Zero', await tituloC0(p));
    const bancoOk = await p.evaluate(sq => { const d = window.__store.kanban.squads[sq].dados; return Object.keys(d.cards).length === 3 && d.cards_index.c0 === '0'; }, SQ);
    t('E4. descartar o cache não apagou nem moveu nenhum card do banco', bancoOk, bancoOk);
    const c2 = await lerCache(p); t('E5. o cache é regravado já com o esquema atual', !!c2 && c2.schema === 1 && c2.cardsById.c0.title === 'Card Zero', c2 && c2.cardsById.c0); await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK (' + K + ')' : '\nHÁ FALHAS (' + K + ')'); process.exit(ok ? 0 : 1); })();
