// 🐟 Metas — colar a diarização SEM período definido (bug: "31 valor(es) colado(s) para 0 dia(s)"). Node (inferePeriodo/lerColado) + formulário no Maré.
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js'); const S = require('./seed_metas.js'); const M = require('../../../mare-metas-dev.js');
const K = process.env.K || 'kanban-dev';
(async () => {
  let ok = true; const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + JSON.stringify(d).slice(0, 400))); };
  const col31 = Array.from({ length: 31 }, (_, i) => (890404 + i * 1000).toLocaleString('pt-BR')).join('\n');   // "890.404", "891.404"… como na planilha
  t('só valores + "de" definido: o "até" é calculado (31 valores a partir de 01/10 = 01/10 a 31/10)', JSON.stringify(M.inferePeriodo(col31, '2026-10-01', '')) === '{"ini":"2026-10-01","fim":"2026-10-31","n":31}', M.inferePeriodo(col31, '2026-10-01', ''));
  t('só valores + "até" definido: o "de" é calculado', M.inferePeriodo(col31, '', '2026-10-31').ini === '2026-10-01', M.inferePeriodo(col31, '', '2026-10-31'));
  t('só valores e NENHUMA data: não chuta — devolve só a contagem', JSON.stringify(M.inferePeriodo(col31, '', '')) === '{"n":31}', M.inferePeriodo(col31, '', ''));
  t('linhas "dd/mm valor" sem período: o período vem das datas (e vira o ano em 28/12 → 03/01)', (() => { const r = M.inferePeriodo('28/12 1\n29/12 2\n30/12 3\n31/12 4\n01/01 5\n02/01 6\n03/01 7', '', ''); return r.ini.slice(5) === '12-28' && r.fim.slice(5) === '01-03' && +r.fim.slice(0, 4) === +r.ini.slice(0, 4) + 1 && r.n === 7; })(), M.inferePeriodo('28/12 1\n01/01 5', '', ''));
  t('mais de 93 dias / 1 valor só: não deduz', !M.inferePeriodo('1', '2026-10-01', '').ini && !M.inferePeriodo(Array(100).fill('1').join('\n'), '2026-10-01', '').ini, 0);
  const D = Array.from({ length: 30 }, (_, i) => M.blackFriday ? '2026-11-' + String(i + 1).padStart(2, '0') : '');
  t('aviso de quantidade diferente é específico (sobra → "só os N primeiros entraram"; falta → "ficaram em branco")', /só os 30 primeiros/.test(M.lerColado(col31, D).aviso) && /2 últimos dias ficaram em branco/.test(M.lerColado('1\n2\n3', ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']).aviso), [M.lerColado(col31, D).aviso]);
  t('"890.404" (milhar BR) lido como 890404', M.lerColado('890.404\n910.763', ['2026-10-01', '2026-10-02']).valores['2026-10-01'] === 890404, 0);

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const U = S.U('eve', 'Eve Souza'); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, S.seed('po', { semMarcoFresco: true }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8941/' + K + '.html?squad=dev'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(3000);
  await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')));
  await p.evaluate(() => { openCfg('metas'); metasNova('meta'); }); await p.waitForTimeout(400);
  await p.fill('#mm-f-t', 'BF'); await p.fill('#mm-f-a', '30000000'); await p.click('#mm-rit [data-r="dia"]');
  // 1) o cenário do relato: período em branco + 31 valores
  await p.click('#mm-cv-colar'); await p.fill('#mm-cv-txt', col31); await p.click('#mm-cv-aplicar'); await p.waitForTimeout(150);
  const msg1 = await p.innerText('#mm-cv-sum');
  t('sem período e sem datas: NÃO diz "0 dia(s)" — explica que falta o início e que o "até" é calculado', !/0 dia/.test(msg1) && /período não está definido/.test(msg1) && /"de"/.test(msg1), msg1);
  t('…e o texto colado continua lá (nada se perdeu)', (await p.inputValue('#mm-cv-txt')).split('\n').length === 31, 0);
  // 2) preenche só o "de" e aplica de novo: o "até" aparece sozinho e as 31 linhas são preenchidas
  await p.fill('#mm-f-d1', '2026-10-01'); await p.click('#mm-cv-aplicar'); await p.waitForTimeout(200);
  const r = await p.evaluate(() => ({ d2: document.getElementById('mm-f-d2').value, n: document.querySelectorAll('#mm-cv-rows input').length, v1: document.querySelector('#mm-cv-rows input').value, vN: [...document.querySelectorAll('#mm-cv-rows input')].pop().value, sum: document.getElementById('mm-cv-sum').textContent }));
  t('só com o "de": o "até" vira 31/10, a grade ganha 31 linhas preenchidas (890404 … 920404) e avisa o período ajustado', r.d2 === '2026-10-31' && r.n === 31 && r.v1 === '890404' && r.vN === '920404' && /Período ajustado/.test(r.sum), r);
  // 3) linhas com data, formulário limpo
  await p.fill('#mm-f-d1', ''); await p.fill('#mm-f-d2', ''); await p.waitForTimeout(100);
  if (await p.evaluate(() => document.getElementById('mm-cv-colarbox').hidden)) await p.click('#mm-cv-colar');
  await p.fill('#mm-cv-txt', '12/11 1000\n13/11 2000\n14/11 3000'); await p.click('#mm-cv-aplicar'); await p.waitForTimeout(200);
  const r3 = await p.evaluate(() => ({ d1: document.getElementById('mm-f-d1').value.slice(5), d2: document.getElementById('mm-f-d2').value.slice(5), n: document.querySelectorAll('#mm-cv-rows input').length }));
  t('linhas "dd/mm valor" com período em branco: o período vem das datas (12/11 a 14/11, 3 dias)', r3.d1 === '11-12' && r3.d2 === '11-14' && r3.n === 3, r3);
  // 4) "Distribuir igual" sem período avisa em vez de ficar mudo
  await p.fill('#mm-f-d1', ''); await p.fill('#mm-f-d2', ''); await p.waitForTimeout(100); await p.click('#mm-cv-igual');
  t('"Distribuir igual" sem período diz o que falta (antes não fazia nada)', /Defina o período/.test(await p.innerText('#mm-cv-sum')), await p.innerText('#mm-cv-sum'));
  t('sem erro de JS', !errs.length, errs); await ctx.close(); await b.close();
  console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1);
})();
