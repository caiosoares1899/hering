// 🐟 Metas — 🗂 Entradas: ver, editar e excluir o que foi lançado (parte = soma ao todo; total = ponto absoluto). Lógica (Node) + modal no Maré (Playwright + fakefb).
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js'); const S = require('./seed_metas.js'); const M = require('../../../mare-metas-dev.js');
const K = process.env.K || 'kanban-dev', SFX = /-dev$/.test(K) ? '_dev' : '';
(async () => {
  let ok = true; const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + JSON.stringify(d).slice(0, 500))); };
  // ── lógica pura: 3 dias lançados como partes (10, 20, 30 → totais 10, 30, 60), meta com inicial 0 ──
  const L = () => M.entradasDeLog({ '00000000000001_a': { v: 10, t: 1, d: 10 }, '00000000000002_b': { v: 30, t: 2, d: 20 }, '00000000000003_c': { v: 60, t: 3, d: 30 } });
  const f = { inicial: 0, atual: 60 }, tot = r => r.lista.map(e => e.v).join();
  let r = M.entPlano(f, L(), { tipo: 'del', k: '00000000000002_b' });
  t('excluir a parte do meio (20): os posteriores caem 20 (10, 40) e o atual vai 60 → 40', tot(r) === '10,40' && r.atual === 40 && r.atualT === 3, r);
  r = M.entPlano(f, L(), { tipo: 'del', k: '00000000000003_c' });
  t('excluir a última parte (30): atual 60 → 30 e atualT passa pro ponto anterior', tot(r) === '10,30' && r.atual === 30 && r.atualT === 2, r);
  r = M.entPlano(f, L(), { tipo: 'edit', k: '00000000000002_b', t: 2, valor: 5 });
  t('editar a parte do meio de 20 → 5: ela vira 15 e os posteriores descem 15 (10, 15, 45); atual 45', tot(r) === '10,15,45' && r.atual === 45, r);
  r = M.entPlano(f, L(), { tipo: 'edit', k: '00000000000001_a', t: 4, valor: 10 });
  t('mudar a DATA de uma parte pra depois das outras: ordem refeita (a de 10 vai pro fim), total igual (60)', r.lista.map(e => e.d).join() === '20,30,10' && r.atual === 60 && r.lista[2].v === 60, r);
  r = M.entPlano(f, L(), { tipo: 'del', k: '00000000000001_a' });
  t('excluir a 1ª parte (10): todas as seguintes caem 10 a partir do ponto de partida (20, 50); atual 50', tot(r) === '20,50' && r.atual === 50, r);
  const T = () => M.entradasDeLog({ '00000000000001_a': { v: 100, t: 1 }, '00000000000002_b': { v: 250, t: 2 } });
  r = M.entPlano({ inicial: 0, atual: 250 }, T(), { tipo: 'del', k: '00000000000002_b' });
  t('excluir um TOTAL (o último): só ele some e o atual volta pro total anterior (250 → 100)', tot(r) === '100' && r.atual === 100, r);
  r = M.entPlano({ inicial: 0, atual: 250 }, T(), { tipo: 'edit', k: '00000000000001_a', t: 1, valor: 120 });
  t('editar o total de um ponto antigo: só aquele ponto muda; o atual (último) não', tot(r) === '120,250' && r.atual === 250, r);
  r = M.entPlano({ inicial: 0, atual: 250 }, T(), { tipo: 'edit', k: '00000000000002_b', t: 2, valor: 300 });
  t('editar o total do ÚLTIMO ponto: o atual acompanha (250 → 300)', r.atual === 300, r);
  r = M.entPlano({ inicial: 0, atual: 100 }, M.entradasDeLog({ '00000000000001_a': { v: 100, t: 1 } }), { tipo: 'del', k: '00000000000001_a' });
  t('excluir a ÚNICA entrada: a meta volta a "sem valor ainda" (atual nulo)', r.atual === null && r.atualT === null && r.lista.length === 0, r);
  t('entrada que não existe mais: erro claro (outra pessoa já excluiu)', /não existe mais/.test(M.entPlano(f, L(), { tipo: 'del', k: 'x' }).erro), 0);
  t('inserir parte entre duas existentes parte do acumulado ANTERIOR (+5 entre 10 e 30: 10, 15, 35)', (() => { const l = M.entradasDeLog({ '00000000000001_a': { v: 10, t: 1, d: 10 }, '00000000000003_c': { v: 30, t: 3, d: 20 } }); const x = M.entPlano({ inicial: 0, atual: 30 }, M.entradasDeLog({ '00000000000001_a': { v: 10, t: 1, d: 10 }, 'z': { v: 10, t: 2, d: 0 }, '00000000000003_c': { v: 30, t: 3, d: 20 } }), { tipo: 'edit', k: 'z', t: 2, valor: 5 }); return x.lista.map(e => e.v).join() === '10,15,35' && x.atual === 35; })(), 0);

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const U = S.U('eve', 'Eve Souza'); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, S.seed('po', { semMarcoFresco: true }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8941/' + K + '.html?squad=dev'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(3000);
  await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); toggleDados(); }); await p.waitForTimeout(600);
  const store = path => p.evaluate(pa => { let o = window.__store; pa.split('/').forEach(k => { o = o == null ? o : o[k]; }); return o == null ? null : JSON.parse(JSON.stringify(o)); }, path);
  const meta = () => store('kanban/metas_squads' + SFX + '/dev/b'), lg = async () => Object.values(await store('kanban/metas_log' + SFX + '/b') || {}).sort((x, y) => x.t - y.t);
  const D = 24 * 3600e3;
  await p.evaluate(async () => { await MareMetas.registrar(MareMetas.achar('b', 'squad', 'dev'), 50, { uid: 'eve', nome: 'Eve Souza' }, '', Date.now() - 8 * 86400e3); }); await p.waitForTimeout(400);   // um TOTAL bem antigo (só histórico)
  const base = (await meta()).atual, n0 = (await lg()).length;
  // 3 dias retroativos como partes (via a API real) + abrir o modal
  await p.evaluate(async () => { const m = MareMetas.achar('b', 'squad', 'dev'), u = { uid: 'eve', nome: 'Eve Souza' }; for (const [dias, v] of [[3, 5], [2, 10], [1, 7]]) await MareMetas.registrar(m, v, u, '', Date.now() - dias * 86400e3, { parte: true }); });
  await p.waitForTimeout(500);
  t('o cartão da meta tem o botão 🗂 Entradas (quem pode atualizar)', !!(await p.$('#dados-pane .mm-card[data-mm-id="b"] [data-mm-act="ent"]')), 0);
  await p.click('#dados-pane .mm-card[data-mm-id="b"] [data-mm-act="ent"]'); await p.waitForSelector('#mm-e-l .mm-ent-r');
  const linhas = () => p.$$eval('#mm-e-l .mm-ent-r', a => a.map(x => x.innerText.replace(/\s+/g, ' ')));
  let ls = await linhas();
  t('a lista mostra todas as entradas (antigas + 3 partes), mais nova primeiro, com "+" nas partes', ls.length === n0 + 3 && /\+/.test(ls[1]) && ls.filter(x => /^\+/.test(x)).length === 3, ls.slice(0, 4));
  t('o cabeçalho traz o total e a contagem', new RegExp(String(n0 + 3) + ' entradas').test(await p.innerText('#mm-e-sub')), await p.innerText('#mm-e-sub'));
  // editar a parte de ontem (+7 → +20) pelo formulário
  const idx = i => `#mm-e-l .mm-ent-r:nth-child(${i})`;
  const linhaDe = async txt => { const l = await linhas(); return l.findIndex(x => x.startsWith(txt)) + 1; };
  let i = await linhaDe('+7'); await p.click(idx(i) + ' [data-a="ed"]'); await p.fill('#mm-e-v', '20'); await p.fill('#mm-e-n', 'corrigido'); await p.click('#mm-e-l [data-a="ok"]'); await p.waitForTimeout(700);
  let m1 = await meta(), l1 = await lg();
  t('editar +7 → +20: o total sobe 13 e o ponto guarda a nota e "editado"', m1.atual === base + 22 + 13 && l1.some(x => x.d === 20 && x.nota === 'corrigido' && x.ed), [m1.atual, base]);
  t('…e o ponto aparece na lista como editado, com a nota', /editado por Eve Souza.*corrigido/.test((await linhas()).find(x => /^\+20/.test(x)) || ''), await linhas());
  // mudar a data de uma parte (+5 de 3 dias atrás → 5 dias atrás): total igual, chave nova
  i = await linhaDe('+5'); await p.click(idx(i) + ' [data-a="ed"]'); const q = M.partesSP(Date.now() - 5 * D); await p.fill('#mm-e-d', q.data); await p.fill('#mm-e-h', q.hora); await p.click('#mm-e-l [data-a="ok"]'); await p.waitForTimeout(700);
  const l2 = await lg(), m2 = await meta(), pt = l2.find(x => x.d === 5);
  t('mudar só a data da parte +5: o total não muda e o ponto vai pra data nova', m2.atual === m1.atual && Math.abs(pt.t - (Date.now() - 5 * D)) < 61e3, [m2.atual, m1.atual, pt && pt.t]);
  t('o gráfico/histórico continua em ordem: acumulado nunca desce entre os pontos de partes', (() => { const ps = l2.filter(x => x.t > Date.now() - 6 * D); return ps.every((x, k) => k === 0 || x.v >= ps[k - 1].v); })(), l2.map(x => [x.t, x.v, x.d]));
  // excluir a parte +10: total cai 10
  i = await linhaDe('+10'); await p.click(idx(i) + ' [data-a="del"]'); await p.waitForTimeout(700);
  const m3 = await meta(), l3 = await lg();
  t('excluir a parte +10: o total cai 10, o ponto some e os posteriores descem 10', m3.atual === m2.atual - 10 && !l3.some(x => x.d === 10) && l3.length === l2.length - 1 && (l3[l3.length - 1].v - l2[l2.length - 1].v) === -10, [m3.atual, m2.atual, l3.map(x => x.v), l2.map(x => x.v)]);
  t('a lista e o cabeçalho refletem na hora', (await linhas()).length === n0 + 2 && new RegExp(String(n0 + 2) + ' entradas').test(await p.innerText('#mm-e-sub')), await p.innerText('#mm-e-sub'));
  // futuro e campo vazio: recusa
  i = await linhaDe('+20'); await p.click(idx(i) + ' [data-a="ed"]'); await p.fill('#mm-e-v', ''); await p.click('#mm-e-l [data-a="ok"]');
  t('valor vazio: recusa com aviso e não grava', /número/.test(await p.innerText('#mm-e-e')) && (await meta()).atual === m3.atual, await p.innerText('#mm-e-e'));
  await p.evaluate(() => document.getElementById('mm-e-d').removeAttribute('max')); const fut = M.partesSP(Date.now() + 26 * 3600e3); await p.fill('#mm-e-v', '1'); await p.fill('#mm-e-d', fut.data); await p.fill('#mm-e-h', fut.hora); await p.click('#mm-e-l [data-a="ok"]');
  t('data no futuro: recusa com aviso e não grava', /futuro/.test(await p.innerText('#mm-e-e')) && (await meta()).atual === m3.atual, await p.innerText('#mm-e-e'));
  await p.click('#mm-e-l [data-a="cn"]');
  // excluir um TOTAL antigo (o 1º da lista antiga): só ele some
  const antes = await lg();
  const ls2 = await linhas(); const iT = ls2.length; t('a última linha (a mais antiga) é o total de 50 lançado antes', /total 50|50/.test(ls2[iT - 1]) && !/^\+/.test(ls2[iT - 1]), ls2[iT - 1]); await p.click(idx(iT) + ' [data-a="del"]'); await p.waitForTimeout(700);
  const dep = await lg(); t('excluir um total antigo: só o ponto some, o valor atual não muda', dep.length === antes.length - 1 && (await meta()).atual === m3.atual, [dep.length, antes.length]);
  // permissão: quem não pode atualizar não vê o botão (visão do Digital sem pode)
  t('sem erro de JS', !errs.length, errs); await ctx.close(); await b.close();
  console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1);
})();
