// 🌅 Meu Dia: os 2 blocos de humor (🌤️ Como você está hoje? · 🌙 Fechamento do dia) recolhem e o painel todo rola junto — pedido do Caio, 04/11/2026
// ("os dois termômetros espremeram a parte dos cards, ficou muito pequeno no fim da página"). Boot REAL do Maré com Firebase falso.
//   python3 -m http.server 8941 &   node docs/arezzo/testes/test_meudia_recolher.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const K = process.env.K || 'kanban-dev'; const SQ = 'dev';
const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const pad = n => String(n).padStart(2, '0'); const d0 = new Date(); const HOJE = d0.getFullYear() + '-' + pad(d0.getMonth() + 1) + '-' + pad(d0.getDate());
const dia = (n) => { const d = new Date(Date.now() + n * 86400000); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const cards = {}, idx = {}; for (let i = 0; i < 14; i++) { const id = 'c' + i; idx[id] = 'k' + i; cards['k' + i] = { id, title: 'Card ' + i + (i === 3 ? ' ' + 'longo '.repeat(30) : ''), col: 'todo', owner: 'AA', due: dia(i < 5 ? -2 : i < 9 ? 0 : 3), createdAt: '2026-10-20', flow: { enteredAt: { todo: '2026-10-20T12:00:00Z' }, log: [] } }; }
const mk = (comHumor) => ({ kanban: {
  usuarios: { ana: { uid: 'ana', nome: 'Ana', email: 'ana@ciahering.com.br', inscrito: true, init: 'AA', role: 'adm', squads: { [SQ]: true } } },
  usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana', init: 'AA', role: 'adm', squads: { [SQ]: true } } }, config: { adm_emails: ['ana@ciahering.com.br'] }, squads_meta: { [SQ]: { label: 'Dev', emoji: '💻', color: '#1de9b6' } },
  travessia: comHumor ? { humor: { ana: { [HOJE]: { n: 4, ts: Date.now() } } } } : undefined,
  squads: { [SQ]: { dados: { columns: [{ id: 'todo', name: 'A fazer' }, { id: 'done', name: 'Concluído', isDone: true }], tags: [], cards_index: idx, cards } } } } });
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const abre = async (vp, comHumor, opts) => { const ctx = await b.newContext(Object.assign({ viewport: vp }, opts || {})); await fake.install(ctx, mk(comHumor)); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8941/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(3500);
    await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); openMeuDia(); }); await p.waitForTimeout(1500); return { ctx, p, errs }; };
  const m = p => p.evaluate(() => { const sc = document.getElementById('meudia-scroll'), body = document.getElementById('meudia-body'), pn = sc.parentElement, r = x => x.getBoundingClientRect();
    const linhas = [...document.querySelectorAll('#meudia-body .meudia-row')]; const vis = linhas.filter(l => r(l).top >= r(sc).top && r(l).bottom <= r(sc).bottom).length;
    return { scrollH: sc.scrollHeight, clientH: sc.clientHeight, podeRolar: sc.scrollHeight > sc.clientHeight + 1, painelH: Math.round(r(pn).height), cards: linhas.length, visiveis: vis, bodyRola: getComputedStyle(body).overflowY, topoVisivel: Math.round(r(document.getElementById('meudia-humor')).height) }; });

  { const { ctx, p, errs } = await abre({ width: 1280, height: 640 }, false);
    const a = await m(p);
    t('A. 14 cards carregados no Meu Dia', a.cards >= 12, a);
    t('B. o painel TODO rola junto (um só scroll): o topo e os cards estão no mesmo contêiner rolável; a lista não tem rolagem própria', a.podeRolar && a.bodyRola === 'visible', a);
    t('C. começa com "Como você está hoje?" ABERTO (ainda não respondeu) e "Fechamento do dia" RECOLHIDO', await p.evaluate(() => !document.getElementById('meudia-humor-c').hidden && document.getElementById('meudia-dia-c').hidden), '');
    t('D. os botões de recolher têm aria-expanded e controlam o bloco certo', await p.evaluate(() => { const h = document.getElementById('meudia-humor-tg'), d = document.getElementById('meudia-dia-tg'); return h.getAttribute('aria-expanded') === 'true' && d.getAttribute('aria-expanded') === 'false' && h.getAttribute('aria-controls') === 'meudia-humor-c' && d.getAttribute('aria-controls') === 'meudia-dia-c'; }), '');
    await p.screenshot({ path: '/tmp/meudia_antes_aberto.png' });
    await p.click('#meudia-humor-tg'); await p.waitForTimeout(200);
    const b2 = await m(p);
    t('E. recolher "Como você está hoje?" libera espaço (o topo encolhe)', b2.topoVisivel < a.topoVisivel - 40, [a.topoVisivel, b2.topoVisivel]);
    t('F. a lista sobe: cabem mais cards à vista depois de recolher', b2.visiveis >= a.visiveis, [a.visiveis, b2.visiveis]);
    t('G. o estado fica salvo neste aparelho (localStorage) e o aria-expanded acompanha', await p.evaluate(() => JSON.parse(localStorage.getItem('mare_meudia_col') || '{}').humor === true && document.getElementById('meudia-humor-tg').getAttribute('aria-expanded') === 'false'), '');
    // escolher a carinha com o bloco aberto não recolhe sozinho; rascunho do fechamento sobrevive
    await p.click('#meudia-humor-tg'); await p.waitForTimeout(150); await p.click('#meudia-dia-tg'); await p.waitForTimeout(150);
    await p.fill('#meudia-dia-txt', 'rascunho do dia'); await p.locator('#meudia-humor button[onclick^="_meuDiaHumorSet"]').nth(3).click(); await p.waitForTimeout(600);
    t('H. escolher a carinha NÃO recolhe o bloco (o redesenho mantém o que a pessoa vê) e o rascunho do fechamento sobrevive', await p.evaluate(() => !document.getElementById('meudia-humor-c').hidden && !document.getElementById('meudia-dia-c').hidden && document.getElementById('meudia-dia-txt').value === 'rascunho do dia'), '');
    t('I. com o bloco recolhido o cabeçalho mostra o resumo ("🙂" da carinha escolhida)', await (async () => { await p.click('#meudia-humor-tg'); return p.evaluate(() => /🙂/.test(document.getElementById('meudia-humor-tg').innerText)); })(), await p.locator('#meudia-humor-tg').innerText());
    // teclado: Enter/Espaço no botão alterna
    await p.focus('#meudia-dia-tg'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
    t('J. teclado: Enter no cabeçalho recolhe/abre', await p.evaluate(() => document.getElementById('meudia-dia-c').hidden), '');
    // rolagem geral: dá pra chegar nos últimos cards
    await p.evaluate(() => { document.getElementById('meudia-scroll').scrollTop = 1e6; }); await p.waitForTimeout(150);
    t('K. rolando o painel dá pra ver o ÚLTIMO card', await p.evaluate(() => { const sc = document.getElementById('meudia-scroll'), ls = [...document.querySelectorAll('#meudia-body .meudia-row')], u = ls[ls.length - 1]; const r = u.getBoundingClientRect(), s = sc.getBoundingClientRect(); return r.bottom <= s.bottom + 1 && r.top >= s.top; }), '');
    // reabrir: aplica a preferência salva e volta ao topo
    await p.evaluate(() => { closeOv('meudia-ov'); openMeuDia(); }); await p.waitForTimeout(1200);
    t('L. reabrir o Meu Dia aplica a preferência salva (humor recolhido, fechamento recolhido) e volta ao topo', await p.evaluate(() => document.getElementById('meudia-humor-c').hidden && document.getElementById('meudia-dia-c').hidden && document.getElementById('meudia-scroll').scrollTop === 0), '');
    t('M. sem erro de JS', errs.length === 0, errs);
    await p.screenshot({ path: '/tmp/meudia_depois_recolhido.png' }); await ctx.close(); }

  { const { ctx, p } = await abre({ width: 1280, height: 640 }, true);
    t('N. quem já respondeu o humor de hoje: o bloco abre RECOLHIDO por padrão, com a carinha no cabeçalho', await p.evaluate(() => document.getElementById('meudia-humor-c').hidden && /🙂/.test(document.getElementById('meudia-humor-tg').innerText)), await p.locator('#meudia-humor-tg').innerText());
    const r = await m(p); t('O. com os dois recolhidos já aparecem vários cards logo de cara', r.visiveis >= 3, r); await ctx.close(); }

  { const { ctx, p, errs } = await abre({ width: 390, height: 700 }, false, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const a = await m(p);
    t('P. celular: sem rolagem lateral e o painel rola inteiro', await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1) && a.podeRolar, a);
    t('Q. celular: alvo de toque dos cabeçalhos ≥ 44 px', await p.evaluate(() => [...document.querySelectorAll('.md-tg')].every(e => e.getBoundingClientRect().height >= 43.5)), await p.evaluate(() => [...document.querySelectorAll('.md-tg')].map(e => e.getBoundingClientRect().height)));
    await p.tap('#meudia-humor-tg'); await p.waitForTimeout(200);
    t('R. celular: toque recolhe', await p.evaluate(() => document.getElementById('meudia-humor-c').hidden), '');
    await p.screenshot({ path: '/tmp/meudia_mobile.png' });
    for (const th of ['light', 'vice']) { await p.evaluate(x => document.documentElement.setAttribute('data-theme', x), th); await p.waitForTimeout(150);
      t('S. tema ' + th + ': cabeçalho do bloco legível (cor definida e diferente do fundo)', await p.evaluate(() => { const e = document.getElementById('meudia-humor-tg'); const c = getComputedStyle(e).color; return !!c && c !== 'rgba(0, 0, 0, 0)'; }), ''); }
    t('T. sem erro de JS (celular)', errs.length === 0, errs); await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1); })();
