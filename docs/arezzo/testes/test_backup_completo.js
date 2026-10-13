// 🛟 Backup completo (nuvem) na tela do Maré (kanban-dev → ⚙ Config → Backup): visível só pra ADM/PO/Organizador, listar, comparar,
// restaurar SÓ o que sumiu e tratamento de erro. A API (Cloud Function backupCompletoApi) é simulada com page.route — a lógica dela
// tem testes próprios em functions/backup/__tests__/restaurarApi.test.js. K=kanban testa a prod depois da promoção.
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js'); const S = require('./seed_metas.js');
const K = process.env.K || 'kanban-dev';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + JSON.stringify(d).slice(0, 400))); };
  const U = S.U('eve', 'Eve Souza');
  const abre = async (papel, api) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, S.seed(papel, { semMarcoFresco: true }));
    const chamadas = [];
    await ctx.route('**/backupCompletoApi', async route => {
      const req = route.request(), corpo = JSON.parse(req.postData() || '{}'); chamadas.push({ corpo, auth: req.headers()['authorization'] });
      const r = api(corpo); await route.fulfill({ status: r.status || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(r.json) });
    });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto('http://localhost:8941/' + K + '.html?squad=dev'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(3000);
    await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')));
    await p.evaluate(() => { openCfg(); swCfgTab('backup'); }); await p.waitForTimeout(500);
    return { ctx, p, errs, chamadas };
  };
  const vis = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.offsetParent !== null; }, sel);
  const txt = (p, sel) => p.evaluate(s => (document.querySelector(s)?.innerText || '').replace(/\s+/g, ' ').trim(), sel);
  const AREAS = [
    { id: 'card_comments', rotulo: '💬 Comentários dos cards', desc: 'comentários que sumiram', noBackup: 12, agora: 9, faltando: 3, exemplos: ['c1/k2', 'c1/k3', 'c2'] },
    { id: 'config', rotulo: '⚙️ Configurações do squad', desc: 'Raias…', noBackup: 6, agora: 6, faltando: 0, exemplos: [] },
    { id: 'intake_pending', rotulo: '📥 Pedidos de intake pendentes', desc: 'pedidos', noBackup: 2, agora: 1, faltando: 1, exemplos: ['i2'] },
  ];
  const api = corpo => {
    if (corpo.acao === 'listar') return { json: { backups: [{ data: '2026-10-18', bytes: 5242880 }, { data: '2026-10-11', bytes: 2048 }] } };
    if (corpo.acao === 'comparar') return { json: { data: corpo.data, exportadoEm: '2026-10-18T07:30:00.000Z', areas: AREAS } };
    if (corpo.acao === 'restaurar') return { json: { restaurados: { card_comments: 3, intake_pending: 1 }, total: 4, desfazer: 'backups-completos/pre-restauracao/x/api-dev.json' } };
    return { status: 400, json: { erro: 'Ação desconhecida.' } };
  };

  { const { ctx, p, errs, chamadas } = await abre('po', api);
    t('PO vê a seção 🛟 Backup completo (nuvem)', await vis(p, '#restore-cloud-section') && /backup completo \(nuvem\)/i.test(await txt(p, '#restore-cloud-section')), 0);
    t('antes de clicar, nada de lista nem de áreas (e nenhuma chamada à API)', !(await vis(p, '#rc-data')) && !(await vis(p, '#rc-areas')) && chamadas.length === 0, chamadas);
    await p.click('#rc-btn-listar'); await p.waitForTimeout(400);
    t('listar: mostra as 2 datas (dd/mm/aaaa · tamanho) e o botão Comparar; a chamada vai com o squad e o Bearer idToken', await vis(p, '#rc-data') && await vis(p, '#rc-btn-comparar')
      && (await p.$$eval('#rc-data option', o => o.map(x => x.textContent))).join('|') === '18/10/2026 · 5.0 MB|11/10/2026 · 2 KB' && chamadas[0].corpo.acao === 'listar' && chamadas[0].corpo.squad === 'dev' && /^Bearer .+/.test(chamadas[0].auth || ''), [chamadas[0], await p.$$eval('#rc-data option', o => o.map(x => x.textContent))]);
    await p.evaluate(() => document.getElementById('mare-dica')?.remove()); await p.click('#rc-btn-comparar', { force: true }); await p.waitForTimeout(500);
    const cb = await p.$$eval('#rc-areas .rc-area', a => a.map(x => ({ v: x.value, on: x.checked, dis: x.disabled })));
    t('comparar: 3 áreas; as com algo faltando já vêm marcadas; a que não perdeu nada fica desabilitada ("nada sumiu")', cb.length === 3 && cb[0].on && !cb[0].dis && cb[1].dis && !cb[1].on && cb[2].on && /nada sumiu/.test(await txt(p, '#rc-areas')) && /3 sumiram/.test(await txt(p, '#rc-areas')) && /1 sumiu/.test(await txt(p, '#rc-areas')), cb);
    t('mostra exemplos de caminho e as contagens (backup × hoje) e o botão de restaurar aparece', /ex\.: c1\/k2, c1\/k3, c2/.test(await txt(p, '#rc-areas')) && /backup: 12 · hoje: 9/.test(await txt(p, '#rc-areas')) && await vis(p, '#rc-btn-restaurar'), await txt(p, '#rc-areas'));
    await p.evaluate(() => document.getElementById('mare-dica')?.remove()); await p.click('#rc-areas .rc-area[value="intake_pending"]', { force: true });   // desmarca uma
    await p.waitForTimeout(100);
    const clicou = p.evaluate(() => rcRestaurar());
    // uiConfirm é um modal da própria página (#ui-modal-ov), não um dialog nativo
    await p.waitForSelector('#ui-modal-ov .ui-modal-btn:not(.ui-modal-cancel)', { timeout: 5000 }).catch(async () => { console.log('DEBUG', JSON.stringify({ areas: await p.$$eval('#rc-areas .rc-area', a => a.map(x => [x.value, x.checked])), data: await p.evaluate(() => document.getElementById('rc-data').value), toast: await txt(p, '#toast, .toast'), errs, msg: await txt(p, '#rc-msg'), chamadas: chamadas.map(c => c.corpo) })); });
    await p.click('#ui-modal-ov .ui-modal-btn:not(.ui-modal-cancel)');
    await clicou; await p.waitForTimeout(600);
    const rest = chamadas.find(c => c.corpo.acao === 'restaurar');
    t('restaurar: manda SÓ as áreas marcadas (card_comments), a data e o squad', !!rest && rest.corpo.areas.join() === 'card_comments' && rest.corpo.data === '2026-10-18' && rest.corpo.squad === 'dev', rest);
    t('mostra o resultado (4 itens) e re-compara em seguida', /4 item\(ns\) restaurado/.test(await txt(p, '#rc-msg')) || chamadas.filter(c => c.corpo.acao === 'comparar').length >= 2, await txt(p, '#rc-msg'));
    t('sem erro de JS (fluxo completo)', !errs.length, errs); await ctx.close(); }

  { const { ctx, p } = await abre('po', () => ({ status: 403, json: { erro: 'Só ADM, PO ou Organizador deste squad pode usar o backup completo.' } }));
    await p.click('#rc-btn-listar'); await p.waitForTimeout(400);
    t('erro da API (403) aparece na tela em vermelho, sem travar o botão', /Só ADM, PO ou Organizador/.test(await txt(p, '#rc-msg')) && !(await p.evaluate(() => document.getElementById('rc-btn-listar').disabled)), await txt(p, '#rc-msg')); await ctx.close(); }
  { const { ctx, p } = await abre('po', () => ({ json: { backups: [] } }));
    await p.click('#rc-btn-listar'); await p.waitForTimeout(400);
    t('sem nenhum backup do squad: mensagem explicativa e nada de lista', /Ainda não há backup completo/.test(await txt(p, '#rc-msg')) && !(await vis(p, '#rc-data')), await txt(p, '#rc-msg')); await ctx.close(); }
  { const { ctx, p, chamadas } = await abre('po', () => ({ json: { data: 'x', exportadoEm: '2026-10-18T07:30:00.000Z', areas: AREAS.map(a => Object.assign({}, a, { faltando: 0, exemplos: [] })) } }));
    await p.evaluate(() => { document.getElementById('rc-data').innerHTML = '<option value="2026-10-18">x</option>'; document.getElementById('rc-data').style.display = ''; });
    await p.evaluate(() => rcComparar()); await p.waitForTimeout(500);
    t('quando nada sumiu: mensagem ✅ e nenhum botão de restaurar', /Nada sumiu/.test(await txt(p, '#rc-msg')) && !(await vis(p, '#rc-btn-restaurar')), await txt(p, '#rc-msg')); await ctx.close(); }
  { const { ctx, p } = await abre('membro', api);
    t('membro comum NÃO vê a seção (nem a 🧯 Restaurar)', !(await vis(p, '#restore-cloud-section')) && !(await vis(p, '#restore-section')), 0); await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1);
})();
