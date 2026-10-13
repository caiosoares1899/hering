// 🐟 Metas — "Atualizar valor" com DATA E HORA da entrada (retroativo). Fuso (Node) + modal no Maré (Playwright + fakefb).
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js'); const S = require('./seed_metas.js'); const M = require('../../../mare-metas-dev.js');
const K = process.env.K || 'kanban-dev', SFX = /-dev$/.test(K) ? '_dev' : '';
(async () => {
  let ok = true; const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + JSON.stringify(d).slice(0, 400))); };
  t('fuso: Brasília ↔ instante (27/11 14:30 em Brasília = 17:30 UTC) e ida-e-volta', new Date(M.spParaMs('2026-11-27', '14:30')).toISOString() === '2026-11-27T17:30:00.000Z' && JSON.stringify(M.partesSP(Date.UTC(2026, 10, 27, 17, 30))) === '{"data":"2026-11-27","hora":"14:30"}' && isNaN(M.spParaMs('x', '14:30')) && isNaN(M.spParaMs('2026-11-27', '25:00')), 0);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const U = S.U('eve', 'Eve Souza');
  const abre = async () => { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, S.seed('po', { semMarcoFresco: true })); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8941/' + K + '.html?squad=dev'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(3000);
    await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); toggleDados(); }); await p.waitForTimeout(600); return { ctx, p, errs }; };
  const store = (p, path) => p.evaluate(pa => { let o = window.__store; pa.split('/').forEach(k => { o = o == null ? o : o[k]; }); return o == null ? null : JSON.parse(JSON.stringify(o)); }, path);
  const abrir = async p => { await p.click('#dados-pane .mm-card[data-mm-id="b"] [data-mm-act="reg"]'); await p.waitForSelector('#mm-r-v'); };
  const quando = async (p, ms) => { const q = M.partesSP(ms); await p.fill('#mm-r-d', q.data); await p.fill('#mm-r-h', q.hora); };
  const lgDe = async p => Object.values(await store(p, 'kanban/metas_log' + SFX + '/b') || {});

  { const { ctx, p, errs } = await abre(); await abrir(p);
    const ini = await p.evaluate(() => ({ d: document.getElementById('mm-r-d').value, h: document.getElementById('mm-r-h').value }));
    const agora = M.partesSP(Date.now());
    t('o modal ganha Data e hora da entrada, já em "agora" (Brasília)', ini.d === agora.data && /^\d\d:\d\d$/.test(ini.h) && Math.abs(M.spParaMs(ini.d, ini.h) - Date.now()) < 3 * 60e3, ini);
    // 1) retroativo MAIS ANTIGO que o valor atual (a meta "b" foi atualizada há 5 h): só histórico
    const t1 = Date.now() - 10 * 3600e3; await quando(p, t1); await p.fill('#mm-r-v', '120');
    t('retroativo: "Somar ao atual" continua LIGADO (lança como parte) e aparece "Voltar pra agora"', await p.evaluate(() => !document.querySelector('[data-m="somar"]').disabled && !document.getElementById('mm-r-agora').hidden), 0);
    t('a prévia avisa que vai só pro histórico/gráfico e o atual continua 180', /histórico e pro gráfico/.test(await p.innerText('#mm-r-p')) && /180/.test(await p.innerText('#mm-r-p')), await p.innerText('#mm-r-p'));
    await p.click('#mm-r-ok'); await p.waitForTimeout(600);
    const m1 = await store(p, 'kanban/metas_squads' + SFX + '/dev/b'), l1 = await lgDe(p);
    t('mais antigo: o valor ATUAL não muda (180), mas o histórico ganha o ponto na data certa (com "reg" = quando foi lançado)', m1.atual === 180 && l1.some(x => x.v === 120 && Math.abs(x.t - t1) < 61e3 && x.reg > x.t), [m1.atual, l1.map(x => [x.v, x.t, x.reg])]);
    t('mas "quem/quando atualizou" é de verdade (agora): some o ⏰ de desatualizada', m1.atualizadoEm > Date.now() - 60e3 && m1.atualizadoNome === 'Eve Souza', [m1.atualizadoEm, m1.atualizadoNome]);
    // 2) retroativo MAIS NOVO que o atual (2 h atrás > 5 h atrás): vira o atual
    await abrir(p); const t2 = Date.now() - 2 * 3600e3; await quando(p, t2); await p.fill('#mm-r-v', '250'); await p.click('#mm-r-ok'); await p.waitForTimeout(600);
    const m2 = await store(p, 'kanban/metas_squads' + SFX + '/dev/b'), l2 = await lgDe(p);
    t('mais novo que o atual: vira o valor atual (250) e guarda o instante dele (atualT)', m2.atual === 250 && Math.abs(m2.atualT - t2) < 61e3 && l2.some(x => x.v === 250 && Math.abs(x.t - t2) < 61e3), [m2.atual, m2.atualT]);
    // 3) a entrada de 10 h atrás NÃO sobrescreve o atual quando chega depois de outra mais nova (ordem de lançamento ≠ ordem do tempo)
    await abrir(p); await quando(p, Date.now() - 3 * 3600e3); await p.fill('#mm-r-v', '200'); await p.click('#mm-r-ok'); await p.waitForTimeout(600);
    t('lançar por último uma entrada mais ANTIGA que o atual não derruba o atual (continua 250)', (await store(p, 'kanban/metas_squads' + SFX + '/dev/b')).atual === 250, (await store(p, 'kanban/metas_squads' + SFX + '/dev/b')).atual);
    // 4) futuro é recusado; agora funciona como sempre (somar)
    await abrir(p); const fut = M.partesSP(Date.now() + 26 * 3600e3); await p.evaluate(() => { document.getElementById('mm-r-d').removeAttribute('max'); }); await p.fill('#mm-r-d', fut.data); await p.fill('#mm-r-h', fut.hora); await p.fill('#mm-r-v', '999'); await p.click('#mm-r-ok'); await p.waitForTimeout(300);
    t('data/hora no futuro: recusa com aviso e não grava', /futuro/.test(await p.innerText('#mm-r-e')) && (await store(p, 'kanban/metas_squads' + SFX + '/dev/b')).atual === 250, await p.innerText('#mm-r-e'));
    await p.click('#mm-r-agora'); await p.click('[data-m="somar"]'); await p.fill('#mm-r-v', '10'); await p.click('#mm-r-ok'); await p.waitForTimeout(600);
    const m4 = await store(p, 'kanban/metas_squads' + SFX + '/dev/b');
    t('voltar pra agora: "Somar" volta a funcionar e é o valor atual de agora (250 + 10)', m4.atual === 260 && Math.abs(m4.atualT - Date.now()) < 60e3, [m4.atual, m4.atualT]);
    // 5) o cartão mostra de quando é o valor quando é retroativo
    await p.waitForTimeout(300); await abrir(p); await quando(p, Date.now() - 20 * 3600e3); await p.fill('#mm-r-v', '300'); await p.click('#mm-r-ok'); await p.waitForTimeout(600);
    // (entrada mais antiga: não vira atual → o selo não muda); agora uma retroativa que vira atual de verdade:
    await p.evaluate(sfx => window._set(window._ref(window._db, 'kanban/metas_squads' + sfx + '/dev/b/atualT'), Date.now() - 6 * 3600e3), SFX); await p.waitForTimeout(300);
    await abrir(p); await quando(p, Date.now() - 3600e3); await p.fill('#mm-r-v', '280'); await p.click('#mm-r-ok'); await p.waitForTimeout(700);
    t('cartão: "Atualizado agora há pouco por Eve (valor de dd/mm hh:mm)" quando o valor é retroativo', /valor de \d\d\/\d\d \d\d:\d\d/.test(await p.innerText('#dados-pane .mm-card[data-mm-id="b"]')), (await p.innerText('#dados-pane .mm-card[data-mm-id="b"]')).replace(/\s+/g, ' ').slice(0, 300));
    t('sem erro de JS', !errs.length, errs); await ctx.close(); }

  // 6) PARTES retroativas: cada dia que já passou entra como uma parte e o todo é a soma (lançadas fora de ordem)
  { const { ctx, p, errs } = await abre(); await abrir(p); await p.click('#mm-r-x');
    const antes = await store(p, 'kanban/metas_squads' + SFX + '/dev/b'), logAntes = Object.values(await store(p, 'kanban/metas_log' + SFX + '/b') || {}).sort((x, y) => x.t - y.t);
    const base = antes.atual, D = 24 * 3600e3, d3 = Date.now() - 3 * D, d2 = Date.now() - 2 * D, d1 = Date.now() - 1 * D;
    const parte = async (ms, v, nota) => { await abrir(p); await quando(p, ms); await p.click('[data-m="somar"]'); await p.fill('#mm-r-v', String(v)); if (nota) await p.fill('#mm-r-n', nota); return p.innerText('#mm-r-p'); };
    const prev = await parte(d2, 10);
    t('a prévia diz que é uma PARTE e mostra o total somado (' + base + ' → ' + (base + 10) + ')', /Parte de/.test(prev) && prev.replace(/\D/g, '').includes(String(base + 10)), prev);
    t('o rótulo vira "Quanto entrou neste dia/horário" e o botão Somar está ativo', /Quanto entrou neste dia/.test(await p.innerText('.mm-md label[for="mm-r-v"]')) && await p.evaluate(() => !document.querySelector('[data-m="somar"]').disabled), 0);
    await p.click('#mm-r-ok'); await p.waitForTimeout(600);
    await parte(d3, 5); await p.click('#mm-r-ok'); await p.waitForTimeout(600);     // mais antigo, lançado DEPOIS
    await parte(d1, 7); await p.click('#mm-r-ok'); await p.waitForTimeout(600);     // mais novo
    const mb = await store(p, 'kanban/metas_squads' + SFX + '/dev/b'), lg = Object.values(await store(p, 'kanban/metas_log' + SFX + '/b') || {}).sort((x, y) => x.t - y.t);
    t('o total é a SOMA das partes (' + base + ' + 10 + 5 + 7 = ' + (base + 22) + ')', mb.atual === base + 22, mb.atual);
    t('3 pontos novos no histórico, cada um marcado com a parte (d)', lg.length === logAntes.length + 3 && [5, 10, 7].every(d => lg.some(x => x.d === d)), lg.map(x => [x.v, x.d]));
    t('o histórico fica coerente: acumulado cresce na ordem do tempo e o último ponto = total', lg.every((x, i) => i === 0 || x.v >= lg[i - 1].v - 1e-9 || !x.d) && lg.filter(x => x.d).map(x => x.d).join() === '5,10,7' && lg.filter(x => x.d).every((x, i, a) => i === 0 || x.v > a[i - 1].v), lg.map(x => [x.t, x.v, x.d]));
    const pd = lg.filter(x => x.d), ultimoAntes = logAntes.filter(x => x.t <= pd[0].t).pop();
    t('1ª parte (a mais antiga) = acumulado até ali + parte; os pontos antigos que vinham depois subiram a mesma parte', pd[0].v === (ultimoAntes ? ultimoAntes.v : (antes.inicial || 0)) + 5 && logAntes.filter(x => x.t > pd[0].t).every(o => lg.some(x => !x.d && x.t === o.t && x.v >= o.v + 5)), [pd[0].v, ultimoAntes && ultimoAntes.v]);
    t('o valor ATUAL e o instante dele não recuaram (a parte mais nova é de ontem, antes do último valor)', mb.atualT >= (antes.atualT || antes.atualizadoEm || 0), [mb.atualT, antes.atualT]);
    t('quem/quando atualizou é de agora (selo ⏰ ok)', mb.atualizadoEm > Date.now() - 60e3, mb.atualizadoEm);
    t('o cartão mostra o novo total', (await p.innerText('#dados-pane .mm-card[data-mm-id="b"]')).replace(/\D/g, '').includes(String(base + 22)), (await p.innerText('#dados-pane .mm-card[data-mm-id="b"]')).replace(/\s+/g, ' ').slice(0, 200));
    // parte NEGATIVA corrige um dia (ex.: lançou a mais)
    await parte(d2, -4); await p.click('#mm-r-ok'); await p.waitForTimeout(600);
    t('parte negativa corrige o total (−4)', (await store(p, 'kanban/metas_squads' + SFX + '/dev/b')).atual === base + 18, (await store(p, 'kanban/metas_squads' + SFX + '/dev/b')).atual);
    // editar a meta (renomear) NÃO pode perder o instante do valor atual (atualT): sem ele um retroativo seguinte passaria por cima
    const antesEd = await store(p, 'kanban/metas_squads' + SFX + '/dev/b');
    await p.evaluate(sq => MareMetas.salvar(Object.assign({}, MareMetas.achar('b', 'squad', sq), { titulo: 'Renomeada' }), { uid: 'eve', nome: 'Eve Souza' }), 'dev'); await p.waitForTimeout(500);
    const depoisEd = await store(p, 'kanban/metas_squads' + SFX + '/dev/b');
    t('editar/renomear a meta preserva o atualT (instante do valor atual) e o valor', depoisEd.titulo === 'Renomeada' && depoisEd.atualT === antesEd.atualT && depoisEd.atual === antesEd.atual, [antesEd.atualT, depoisEd.atualT]);
    t('sem erro de JS (partes)', !errs.length, errs); await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1);
})();
