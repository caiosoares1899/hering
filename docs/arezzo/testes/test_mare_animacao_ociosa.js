// ⚡ Maré: peixes/bolhas pausam com aba oculta, janela sem foco, 60 s sem uso (aqui encurtado) e com tela aberta por cima — e voltam no primeiro movimento. As colunas, gavetas e botões
// não têm mais backdrop-filter (o custo medido em repouso: ~1 núcleo → ~3%); modais e cabeçalho mantêm o vidro. Boot REAL com Firebase falso.
//   python3 -m http.server 8941 &   node docs/arezzo/testes/test_mare_animacao_ociosa.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const K = process.env.K || 'kanban-dev'; const SQ = 'midiacriativa';
const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const mk = () => ({ kanban: { usuarios: { ana: { uid: 'ana', nome: 'Ana', email: 'ana@ciahering.com.br', inscrito: true, init: 'AA', role: 'adm', squads: { [SQ]: true } } }, usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana', init: 'AA', role: 'adm', squads: { [SQ]: true } } }, config: { adm_emails: ['ana@ciahering.com.br'] },
  squads: { [SQ]: { dados: { columns: [{ id: 'todo', name: 'A fazer' }, { id: 'done', name: 'Concluído', isDone: true }], tags: [], cards_index: { c1: 'k1' }, cards: { k1: { id: 'c1', title: 'Card', col: 'todo', owner: 'AA' } } } } } } });
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const ctx = await b.newContext({ viewport: { width: 1300, height: 800 } }); await fake.install(ctx, mk()); await ctx.addInitScript(() => { window._animOciosoMs = 2500; });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8941/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(3500);
  await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')));
  const pausado = () => p.evaluate(() => document.documentElement.hasAttribute('data-anim-paused'));
  const estado = () => p.evaluate(() => { const e = document.querySelector('.fish-ltr,.fish-rtl,.bubble'); return e ? getComputedStyle(e).animationPlayState : null; });
  await p.mouse.move(200, 200); await p.mouse.move(260, 240); await p.waitForTimeout(300);
  t('A. em uso: as animações rodam (peixes/bolhas existem e não estão pausados)', !(await pausado()) && (await estado()) === 'running' && (await p.evaluate(() => document.querySelectorAll('.fish-ltr,.fish-rtl,.bubble').length)) > 10, [await pausado(), await estado()]);
  await p.waitForTimeout(3200);
  t('B. sem uso por 2,5 s (no real: 60 s) as animações PAUSAM', (await pausado()) && (await estado()) === 'paused', [await pausado(), await estado()]);
  await p.mouse.move(400, 300); await p.mouse.move(420, 320); await p.waitForTimeout(400);
  t('C. no primeiro movimento do mouse voltam a rodar', !(await pausado()) && (await estado()) === 'running', [await pausado(), await estado()]);
  await p.evaluate(() => document.getElementById('meudia-ov').classList.add('open')); await p.waitForTimeout(300);
  t('D. com um modal aberto por cima (Meu Dia) as animações pausam — mesmo com o mouse ativo', (await estado()) === 'paused', await estado());
  await p.evaluate(() => document.getElementById('meudia-ov').classList.remove('open')); await p.waitForTimeout(300);
  t('E. fechou o modal: voltam', (await estado()) === 'running', await estado());
  await p.evaluate(() => window.dispatchEvent(new Event('blur'))); await p.evaluate(() => { const real = document.hasFocus; document.hasFocus = () => false; window.dispatchEvent(new Event('blur')); window.__hf = real; }); await p.waitForTimeout(200);
  t('F. janela sem foco (outro programa na frente): pausa', await pausado(), '');
  await p.evaluate(() => { document.hasFocus = window.__hf; window.dispatchEvent(new Event('focus')); }); await p.waitForTimeout(300);
  t('G. voltou o foco: retoma', !(await pausado()), '');
  // vidro: coluna/botão sem desfoque; modal com desfoque
  const bf = await p.evaluate(() => { const g = s => { const e = document.querySelector(s); return e ? getComputedStyle(e).backdropFilter : 'sem-elemento'; }; return { col: g('.col'), btn: g('.btn'), modal: (() => { const o = document.getElementById('meudia-ov'); o.classList.add('open'); const v = getComputedStyle(o).backdropFilter; o.classList.remove('open'); return v; })() }; });
  t('H. colunas e botões sem backdrop-filter (o que custava o repouso)', bf.col === 'none' && bf.btn === 'none', bf);
  t('I. o modal mantém o vidro (desfoque) — só aparece de vez em quando', bf.modal !== 'none' && bf.modal !== 'sem-elemento', bf);
  t('J. sem erro de JS', errs.length === 0, errs);
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1); })();
