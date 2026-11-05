// 🛡️ Painel (painel-dev) › 🔋 Status › Saúde dos cards — lista os episódios do guardião e os alarmes sem socorro. Playwright + Firebase falso.
//   python3 -m http.server 8941 &   node docs/arezzo/testes/test_painel_saude_cards.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const PAGE = process.env.PAGE || 'painel-dev.html';
const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana ADM', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const ago = h => new Date(Date.now() - h * 3600000).toISOString();
const seed = (comIncidentes) => ({ kanban: { usuarios: { ana: { uid: 'ana', nome: 'Ana ADM', email: 'ana@ciahering.com.br', inscrito: true, init: 'AA', role: 'adm', squads: { dados: true, midiacriativa: true } } },
  usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana ADM', init: 'AA', role: 'adm', squads: { dados: true, midiacriativa: true } } }, config: { adm_emails: ['ana@ciahering.com.br'] },
  cards_guardiao: comIncidentes ? { midiacriativa: { incidentes: {
    g1: { cardId: 'c1', titulo: '[Google] Pmax <img src=x onerror=alert(1)> REGATAS', acao: 'restaurado', detectadoEm: ago(3), causaCodigo: 'fila_offline', causaTexto: 'Save ficou retido ~22s <b>x</b>', causadoPor: { por: 'Juliana <img src=y onerror=alert(2)>', ver: 'v8.30.905-dev', origem: 'reordenarColuna' } },
    g2: { cardId: 'c2', titulo: 'Card sem cópia', acao: 'sem_espelho', detectadoEm: ago(30) },
    g3: { cardId: 'c3', titulo: '', acao: 'em_massa', detectadoEm: ago(24 * 5) },
    g4: { cardId: 'c4', titulo: 'Card que some sempre', acao: 'reincidente', detectadoEm: ago(24 * 10) },
    g5: { cardId: 'velho', titulo: 'Fora da janela de 30 dias', acao: 'sem_espelho', detectadoEm: ago(24 * 40) } } },
    dados: { incidentes: { d1: { cardId: 'd1', titulo: 'T'.repeat(300), acao: 'restaurado', detectadoEm: ago(50) } } } } : undefined,
  squads: { dados: { dados: {} },
    midiacriativa: { dados: { cards_incidentes_sumico: comIncidentes ? {
      i1: { cardId: 'c1', cardTitle: 'outro título', detectadoEm: ago(3.001) },          // já socorrido pelo guardião (g1): não duplica
      i2: { cardId: 'a9', cardTitle: 'Alarme sem restauração', detectadoEm: ago(2) } } : {} } } } } });
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const abre = async (dados, vp) => { const ctx = await b.newContext({ viewport: vp || { width: 1280, height: 900 } }); await fake.install(ctx, seed(dados)); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { errs.push('DIALOG ' + d.message()); d.dismiss(); });
    await p.goto('http://localhost:8941/' + PAGE); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(2500);
    await p.evaluate(() => { SQUADS.splice(0, SQUADS.length, { id: 'dados', label: 'Dados', icon: '📊', color: '#38b6ff', wipLimit: 2 }, { id: 'midiacriativa', label: 'Mídia', icon: '🎨', color: '#1de9b6', wipLimit: 3 }); window._pollSquadDados = () => { }; window._pollSquadSnapshots = () => { }; swPtab('status'); }); await p.waitForTimeout(1500); return { ctx, p, errs }; };
  const txt = (p, id) => p.evaluate(i => (document.getElementById(i) || {}).innerText || '', id);

  { const { ctx, p, errs } = await abre(true);
    const lista = await txt(p, 'sc-lista'), resumo = await txt(p, 'sc-resumo'), badge = await txt(p, 'sc-badge');
    t('A. o cartão existe na aba Status', await p.evaluate(() => !!document.getElementById('st-cards-card') && document.getElementById('ppane-status').classList.contains('on')), '');
    t('B. restaurado aparece com "Restaurado sozinho" e link pra abrir o card', /Restaurado sozinho/.test(lista) && await p.evaluate(dev => [...document.querySelectorAll('#sc-lista a')].some(a => /opencard=c1/.test(a.href) && /squad=midiacriativa/.test(a.href) && (dev ? /kanban-dev\.html/ : /kanban\.html/).test(a.href)), PAGE.includes('-dev')), lista.slice(0, 300));
    t('C. sem cópia, em massa e reincidente aparecem como sem socorro', /Sem cópia/.test(lista) && /Sumiço em massa/.test(lista) && /Voltou a sumir/.test(lista), lista.slice(0, 600));
    t('D. o alarme do navegador JÁ socorrido não duplica; o sem restauração aparece', !/outro título/.test(lista) && /Alarme sem restauração/.test(lista) && /Alarme do navegador, sem restauração/.test(lista) && /midiacriativa/.test(lista), lista.slice(0, 600));
    t('E. fora da janela de 30 dias não entra', !/Fora da janela/.test(lista), lista.slice(-200));
    t('F. resumo (7 dias): 2 restaurados (c1 e d1), 2 sem socorro (sem cópia + alarme) — o em massa de 5 dias também conta = 3', /2\s*restaurados \(7 dias\)/.test(resumo.replace(/\n/g, ' ')) && /3\s*sem socorro \(7 dias\)/.test(resumo.replace(/\n/g, ' ')), resumo);
    t('G. selo vermelho "N sem socorro" e aviso pra buscar no backup antes de recriar', /sem socorro/.test(badge) && /antes de recriar/.test(lista), badge);
    t('H. texto do card vai ESCAPADO (HTML no título aparece como texto, sem <img> nem alert)', await p.evaluate(() => !document.querySelector('#sc-lista img')) && /<img src=x/.test(lista) && errs.filter(e => /DIALOG/.test(e)).length === 0, errs);
    t('H2. dedo-duro: mostra "Causado por" e a causa, tudo ESCAPADO', /Causado por: Juliana/.test(lista) && /v8\.30\.905-dev · reordenarColuna/.test(lista) && /Causa: Save ficou retido/.test(lista) && await p.evaluate(() => !document.querySelector('#sc-lista img, #sc-lista b b')), lista.slice(0, 400));
    t('I. título de 300 caracteres não estoura a largura (sem rolagem lateral)', await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), '');
    t('J. sem erro de JS', errs.filter(e => !/DIALOG/.test(e)).length === 0, errs);
    for (const th of ['light', 'vice']) { await p.evaluate(x => document.documentElement.setAttribute('data-theme', x), th); await p.waitForTimeout(200);
      const c = await p.evaluate(() => { const e = document.querySelector('#sc-lista > div > div'); return e ? getComputedStyle(e).color : null; }); t('K. tema ' + th + ': a lista continua legível (cor do texto definida)', !!c, c); }
    await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await p.locator('#st-cards-card').screenshot({ path: '/tmp/saude_cards_desktop.png' }); await ctx.close(); }

  { const { ctx, p } = await abre(false);
    const lista = await txt(p, 'sc-lista'), badge = await txt(p, 'sc-badge');
    t('L. sem incidentes: estado vazio positivo e selo "Tudo certo"', /Nenhum card sumiu/.test(lista) && /Tudo certo/.test(badge), [lista, badge]); await ctx.close(); }

  { const { ctx, p } = await abre(true, { width: 390, height: 800 });
    t('M. celular 390 px: sem rolagem lateral e as 4 métricas visíveis', await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 && document.querySelectorAll('#sc-resumo > div').length === 4), '');
    await p.locator('#st-cards-card').screenshot({ path: '/tmp/saude_cards_mobile.png' }); await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1); })();
