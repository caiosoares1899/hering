// 🐟 Metas — DIARIZAÇÃO (ritmo não linear): o time define antes quanto a meta pede de cada dia. Matemática (Node) + formulário no Maré (Playwright + fakefb).
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js'); const S = require('./seed_metas.js'); const M = require('../../../mare-metas-dev.js');
const K = process.env.K || 'kanban-dev', SFX = /-dev$/.test(K) ? '_dev' : '';
(async () => {
  let ok = true; const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + JSON.stringify(d).slice(0, 400))); };
  // ── matemática ──
  const D = ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'];
  const m = { titulo: 'x', alvo: 1000, inicial: 0, atual: 200, inicio: D[0], fim: D[4], curva: { [D[0]]: 10, [D[1]]: 10, [D[2]]: 10, [D[3]]: 20, [D[4]]: 50 } };
  t('curva: esperado acumulado ao fim de cada dia (10 · 20 · 30 · 50 · 100 %), 0 antes e 100 depois', [M.esperado(m, '2026-11-22'), ...D.map(d => Math.round(M.esperado(m, d))), M.esperado(m, '2026-12-01')].join() === '0,10,20,30,50,100,100', D.map(d => M.esperado(m, d)));
  t('sem curva continua LINEAR (20 % ao fim do 1º de 5 dias)', Math.round(M.esperado(Object.assign({}, m, { curva: undefined }), D[0])) === 20, 0);
  t('situação segue a curva: 20 % feitos no dia 24 (esperado 20) = no ritmo; no dia 26 (esperado 50) = atrasada', M.status(m, D[1]).id === 'no_ritmo' && M.status(m, D[3]).id === 'atrasada', [M.status(m, D[1]).id, M.status(m, D[3]).id]);
  t('meta do dia = peso do dia sobre o total × (alvo − partida): dia 27 pede 500', M.metaDoDia(m, D[4]) === 500 && M.metaDoDia(m, '2026-11-30') === null && M.metaDoDia(Object.assign({}, m, { curva: undefined }), D[4]) === null, M.metaDoDia(m, D[4]));
  t('curva zerada / sem período não conta como curva', !M.temCurva(Object.assign({}, m, { curva: { [D[0]]: 0 } })) && !M.temCurva(Object.assign({}, m, { inicio: '', fim: '' })), 0);
  const v = M.validar({ escopo: 'digital', titulo: 't', alvo: 1000, inicio: D[0], fim: D[2], ritmo: 'dia', curva: { [D[0]]: '5', [D[2]]: '15', '2030-01-01': 99 } });
  t('validar: ritmo "dia" grava um peso por dia do período (faltou = 0; fora do período some)', v.ok && JSON.stringify(v.meta.curva) === JSON.stringify({ [D[0]]: 5, [D[1]]: 0, [D[2]]: 15 }), v);
  t('validar: "por dia" sem período, com 1 dia só, sem nenhum valor ou com mais de 93 dias é recusado', ['', D[0]].every(f => !M.validar({ escopo: 'digital', titulo: 't', alvo: 1, inicio: D[0], fim: f || '', ritmo: 'dia', curva: { [D[0]]: 1 } }).ok) && !M.validar({ escopo: 'digital', titulo: 't', alvo: 1, inicio: D[0], fim: D[2], ritmo: 'dia', curva: {} }).ok && !M.validar({ escopo: 'digital', titulo: 't', alvo: 1, inicio: '2026-01-01', fim: '2026-06-01', ritmo: 'dia', curva: { '2026-01-01': 1 } }).ok, 0);
  t('validar: ritmo linear não guarda curva', !('curva' in M.validar({ escopo: 'digital', titulo: 't', alvo: 1000, inicio: D[0], fim: D[2], ritmo: 'lin', curva: { [D[0]]: 5 } }).meta), 0);
  const c1 = M.lerColado('1.500,50\nR$ 2000\n300\n10%\n5', D), c2 = M.lerColado('23/11\t100\n24/11 200\n30/11 5', D.slice(0, 3)), c3 = M.lerColado('10\t20\t30', D.slice(0, 3));
  t('colar: coluna em ordem com formato BR (1.500,50 · R$ 2000 · 10%)', c1.valores[D[0]] === 1500.5 && c1.valores[D[1]] === 2000 && c1.valores[D[3]] === 10 && !c1.aviso, c1);
  t('colar: linhas "dd/mm valor" (também separadas por tab); data fora do período é avisada', c2.valores[D[0]] === 100 && c2.valores[D[1]] === 200 && /ignorada/.test(c2.aviso), c2);
  t('colar: uma linha da planilha (valores separados por tab) vira os dias em ordem', c3.valores[D[2]] === 30, c3);
  t('colar: quantidade diferente de dias vira aviso', /5 valor.*3 dia/.test(M.lerColado('1\n2\n3\n4\n5', D.slice(0, 3)).aviso), 0);
  // gráfico: a linha do "ritmo ideal" é uma curva (polyline), não uma reta
  const g = M.graficoHtml(m, [{ t: Date.UTC(2026, 10, 24, 15), v: 100 }]);
  t('gráfico: ritmo do time (diarização) desenhado como linha quebrada + legenda própria', /<polyline[^>]*stroke-dasharray="3 4"/.test(g) && /diarização/.test(g), g.slice(0, 80));
  t('card: tag 📅 diarizada', /📅 diarizada/.test(M.cartaoHtml(m, {})), 0);

  // ── formulário no Maré ──
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const U = S.U('eve', 'Eve Souza'); const seed = S.seed('po', { semMarcoFresco: true });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8941/' + K + '.html?squad=dev'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(3000);
  await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')));
  const store = path => p.evaluate(pa => { let o = window.__store; pa.split('/').forEach(k => { o = o == null ? o : o[k]; }); return o == null ? null : JSON.parse(JSON.stringify(o)); }, path);
  const hj = S.add(0), ini = S.add(-1), fim = S.add(2);
  await p.evaluate(() => { openCfg('metas'); metasNova('desafio'); }); await p.waitForTimeout(400);
  t('o formulário tem "Ritmo ao longo do período": Linear marcado e a grade por dia escondida', await p.evaluate(() => document.querySelector('#mm-rit [data-r="lin"]').getAttribute('aria-pressed') === 'true' && document.getElementById('mm-curva').hidden), 0);
  await p.fill('#mm-f-t', 'Vendas por dia'); await p.fill('#mm-f-a', '1000'); await p.click('#mm-rit [data-r="dia"]');
  t('"Por dia" sem período: pede o período em vez de mostrar linhas', /período/.test(await p.innerText('#mm-cv-sum')) && (await p.$$('#mm-cv-rows input')).length === 0, await p.innerText('#mm-cv-sum'));
  await p.fill('#mm-f-d1', ini); await p.fill('#mm-f-d2', fim); await p.waitForTimeout(150);
  t('com o período (4 dias) aparece uma linha por dia', (await p.$$('#mm-cv-rows input')).length === 4, (await p.$$('#mm-cv-rows input')).length);
  await p.click('#mm-cv-colar'); await p.fill('#mm-cv-txt', '100\n100\n300\n500'); await p.click('#mm-cv-aplicar'); await p.waitForTimeout(150);
  const acc = await p.evaluate(() => [...document.querySelectorAll('#mm-cv-rows .mm-cv-acc')].map(x => x.textContent));
  t('colar da planilha preenche os dias e mostra o acumulado (10 · 20 · 50 · 100 %)', acc.join() === '10%,20%,50%,100%', acc);
  t('a soma dos dias é conferida com a meta (R$/quantidade: 1.000 = 1.000 ✔)', /✔/.test(await p.innerText('#mm-cv-sum')), await p.innerText('#mm-cv-sum'));
  await p.fill('#mm-f-d2', S.add(3)); await p.waitForTimeout(150);
  t('mudar o período mantém os valores dos dias que ficaram e abre linha nova (5 dias, 1ª linha continua 100)', (await p.$$('#mm-cv-rows input')).length === 5 && (await p.inputValue('#mm-cv-rows input')) === '100', (await p.$$('#mm-cv-rows input')).length);
  await p.fill('#mm-f-d2', fim); await p.waitForTimeout(150);
  await p.click('#mm-f-ok'); await p.waitForTimeout(700);
  const salvas = Object.values(await store('kanban/metas_squads' + SFX + '/dev') || {}), nova = salvas.find(x => x.titulo === 'Vendas por dia');
  t('salvou com a curva (um peso por dia do período)', nova && Object.keys(nova.curva || {}).length === 4 && nova.curva[ini] === 100 && nova.curva[hj] === 100 && nova.curva[fim] === 500, nova);
  await p.evaluate(() => toggleDados()); await p.waitForTimeout(600);
  const card = await p.evaluate(() => { const c = [...document.querySelectorAll('#dados-pane .mm-card')].find(x => /Vendas por dia/.test(x.innerText)); return c ? { txt: c.innerText.replace(/\s+/g, ' '), u: (c.querySelector('.mm-bar u') || {}).getAttribute ? c.querySelector('.mm-bar u').style.left : '' } : null; });
  t('o cartão mostra 📅 diarizada e o marcador de "esperado hoje" na curva (hoje é o 2º dia: 10+10 = 20 %; a reta de 4 dias daria 50 %)', card && /diarizada/.test(card.txt) && card.u === '20%', card);
  // editar: a grade volta preenchida; voltar pra Linear apaga a curva
  await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); openCfg('metas'); }); await p.waitForTimeout(400);
  await p.evaluate(sfx => { const id = Object.keys(window.__store.kanban['metas_squads' + sfx].dev).find(k => window.__store.kanban['metas_squads' + sfx].dev[k].titulo === 'Vendas por dia'); metasEditar(MareMetas.achar(id, 'squad', 'dev')); }, SFX); await p.waitForTimeout(400);
  t('editar: abre em "Por dia", com a grade preenchida', await p.evaluate(() => document.querySelector('#mm-rit [data-r="dia"]').getAttribute('aria-pressed') === 'true' && !document.getElementById('mm-curva').hidden && [...document.querySelectorAll('#mm-cv-rows input')].map(i => i.value).join() === '100,100,300,500'), 0);
  await p.click('#mm-rit [data-r="lin"]'); await p.click('#mm-f-ok'); await p.waitForTimeout(700);
  const depois = Object.values(await store('kanban/metas_squads' + SFX + '/dev') || {}).find(x => x.titulo === 'Vendas por dia');
  t('voltar pra Linear e salvar remove a curva do banco (e preserva o resto)', depois && !('curva' in depois) && depois.alvo === 1000, depois);
  t('sem erro de JS', !errs.length, errs);
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1);
})();
