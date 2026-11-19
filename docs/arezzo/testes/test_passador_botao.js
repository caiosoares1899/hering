// 🎛️ Botão próprio do passador, logo acima do 🎙️ (pedido do Caio, 19/11/2026), na apresentação ao vivo do Radar.
// Quem apresenta: um clique abre o controle flutuante compacto (Anterior, Próximo, Abrir e Fechar detalhe). Quem acompanha: o mesmo botão pede o
// controle, e quem apresenta (ou o ADM) libera. O botão acompanha a passagem e a retomada; a Tela para o público e o Bastidor não o mostram.
// Precisa da janela flutuante de verdade (Document Picture-in-Picture): cada pessoa num navegador próprio, como no TESTAR_PIP=1 da suíte ao vivo.
const { chromium } = require(process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright');
const fake = require('./fakefb.js');
const BASE = process.env.APRESENTACAO_TEST_URL || 'http://localhost:8941';
const U = (uid, n) => ({ uid, email: uid + '@ciahering.com.br', displayName: n, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const mk = (id, t, o) => ({ id, titulo: t, areaId: 'geral', trimestres: ['2026-Q4'], responsaveis: ['ana'], tagIds: [], history: [], indicadores: ['i1'], progressos: ['p1'], proximosPassos: [], riscos: [], planosAcao: [], descricao: 'desc', torre: 'digital', ...o });
const seed = () => ({ kanban: { okr: { objetivos: { d1: mk('d1', 'Fidelidade', { areaId: 'crm', ordem: 0 }), d2: mk('d2', 'Checkout', { areaId: 'tech', ordem: 0 }), d4: mk('d4', 'Pagamentos', { areaId: 'tech', ordem: 1 }) }, marcos: {}, tags: {}, reuniao_notas: {} },
  usuarios: { ana: { uid: 'ana', nome: 'Ana ADM', email: 'ana@ciahering.com.br', inscrito: true, init: 'AA' }, eve: { uid: 'eve', nome: 'Eve Souza', email: 'eve@ciahering.com.br', inscrito: true, init: 'ES' } },
  usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana ADM', init: 'AA' }, eve: { uid: 'eve', nome: 'Eve Souza', init: 'ES' } }, config: { adm_emails: ['ana@ciahering.com.br'] } } });
const NO = 'kanban/okr/apresentacao_live';
async function sync(from, to) {
  const n = await from.evaluate(() => JSON.stringify(((window.__store.kanban || {}).okr || {}).apresentacao_live || null));
  await to.evaluate(([n, NO]) => { const v = JSON.parse(n), st = window.__store; st.kanban = st.kanban || {}; st.kanban.okr = st.kanban.okr || {}; if (v === null) delete st.kanban.okr.apresentacao_live; else st.kanban.okr.apresentacao_live = v;
    (window.__lis || []).filter(l => l.p === NO).forEach(l => l.cb({ val: () => v === null ? null : JSON.parse(JSON.stringify(v)), exists: () => v !== null, key: 'apresentacao_live' })); }, [n, NO]);
  await to.waitForTimeout(250);
}
let falhas = 0; const t = (n, ok, d) => { if (!ok) falhas++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
const rotulo = p => p.evaluate(() => { const b = document.getElementById('live-passador'); return b && !b.hidden && getComputedStyle(b).display !== 'none' ? b.getAttribute('aria-label') + (b.disabled ? ' [desligado]' : '') : '(escondido)'; });
const pip = p => p.evaluate(() => { const d = window.documentPictureInPicture?.window?.document; return d ? [...d.querySelectorAll('button')].map(b => b.id).join(',') : ''; });
(async () => {
  const chrome = () => chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const navs = [await chrome(), await chrome()];
  const open = async (nav, user, url = '/okr-apresentacao.slide.html', w = 1280, h = 800) => {
    const ctx = await nav.newContext({ viewport: { width: w, height: h } }); await fake.install(ctx, seed());
    const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto(BASE + url); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), user); await p.waitForTimeout(1500);
    return { ctx, p, erros };
  };
  try {
    const A = await open(navs[0], U('ana', 'Ana ADM')), B = await open(navs[1], U('eve', 'Eve Souza'));
    t('antes da sessão ao vivo, o botão não aparece', await rotulo(A.p) === '(escondido)', await rotulo(A.p));
    await A.p.click('#live-box button'); await A.p.waitForTimeout(300); await sync(A.p, B.p);
    t('quem apresenta vê o botão "Abrir controle flutuante"', await rotulo(A.p) === 'Abrir controle flutuante', await rotulo(A.p));
    const geo = await A.p.evaluate(() => { const r = id => document.getElementById(id).getBoundingClientRect(); const b = r('live-passador'), f = r('live-fab'); return { acima: b.bottom <= f.top, alinhado: Math.abs((b.left + b.right) / 2 - (f.left + f.right) / 2) < 2, alvo: b.height >= 44 }; });
    t('fica logo acima do 🎙️, centrado e com 44 px', geo.acima && geo.alinhado && geo.alvo, geo);
    await A.p.evaluate(() => window._livePainel(true)); await A.p.waitForTimeout(200);
    const menu = await A.p.evaluate(() => { const pn = document.getElementById('live-fpanel'), b = document.getElementById('live-passador').getBoundingClientRect(), r = pn.getBoundingClientRect();
      const cruza = !(r.bottom <= b.top || r.top >= b.bottom || r.right <= b.left || r.left >= b.right);
      const tapados = [...pn.querySelectorAll('button')].filter(x => { const q = x.getBoundingClientRect(); if (!q.width) return false; const e = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return !e || !pn.contains(e); }).map(x => x.textContent.trim());
      return { cruza, tapados, temItem: /Abrir controle flutuante/.test(pn.textContent), laser: /Laser/.test(pn.textContent) && /Caneta/.test(pn.textContent) }; });
    t('o menu 🎙️ abre sem encostar no botão e sem nada dele tapado', !menu.cruza && !menu.tapados.length, menu);
    t('o 🎙️ continua com laser e caneta, e sem o item "Abrir controle flutuante"', menu.laser && !menu.temItem, menu);
    await A.p.evaluate(() => window._livePainel(false));
    await A.p.getByRole('button', { name: 'Abrir controle flutuante', exact: true }).click();
    await A.p.waitForFunction(() => !!window.documentPictureInPicture?.window?.document.getElementById('proximo'), null, { timeout: 5000 });
    t('um clique abre o passador compacto (Anterior, Próximo, Abrir e Fechar detalhe)', await pip(A.p) === 'anterior,proximo,abrir-detalhe,fechar-detalhe', await pip(A.p));
    await A.p.evaluate(() => window._okrOpenDetail('d2')); await A.p.waitForTimeout(400);
    t('com o detalhe do Objetivo aberto, o botão continua por cima e clicável', await A.p.evaluate(() => { const b = document.getElementById('live-passador').getBoundingClientRect(); return document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)?.id === 'live-passador'; }), '');
    await A.p.evaluate(() => window.documentPictureInPicture.window.document.getElementById('proximo').click()); await A.p.waitForTimeout(400);
    t('com o detalhe aberto, Próximo do passador vai para o próximo Objetivo da gerência', await A.p.evaluate(() => _okrDetailCurrentId) === 'd4', await A.p.evaluate(() => _okrDetailCurrentId));
    await A.p.evaluate(() => window.documentPictureInPicture.window.document.getElementById('fechar-detalhe').click()); await A.p.waitForTimeout(300);
    await sync(A.p, B.p);
    t('quem acompanha vê o mesmo botão como pedido de controle', await rotulo(B.p) === 'Pedir o controle para usar o controle flutuante', await rotulo(B.p));
    await B.p.locator('#live-passador').click(); await B.p.waitForTimeout(300);
    t('o clique de quem acompanha envia o pedido e desliga o botão', await B.p.evaluate(() => !!window.__store.kanban.okr.apresentacao_live.pedidos?.eve) && await rotulo(B.p) === 'Pedido de controle enviado [desligado]', await rotulo(B.p));
    await sync(B.p, A.p); await A.p.waitForTimeout(200);
    t('o pedido chega para quem apresenta liberar', await A.p.evaluate(() => !!document.querySelector('#live-toast [data-pedido="eve"]')), '');
    await A.p.evaluate(() => window._liveAceitar('eve', 'Eve Souza')); await A.p.waitForTimeout(300); await sync(A.p, B.p);
    t('liberado: o botão passa para quem recebeu', await rotulo(B.p) === 'Abrir controle flutuante', await rotulo(B.p));
    t('e quem passou o controle perde o botão de abrir e o passador fecha', await rotulo(A.p) === 'Pedir o controle para usar o controle flutuante' && await pip(A.p) === '', { a: await rotulo(A.p), pip: await pip(A.p) });
    await B.p.getByRole('button', { name: 'Abrir controle flutuante', exact: true }).click();
    await B.p.waitForFunction(() => !!window.documentPictureInPicture?.window?.document.getElementById('proximo'), null, { timeout: 5000 });
    t('quem recebeu abre o passador com um clique', await pip(B.p) === 'anterior,proximo,abrir-detalhe,fechar-detalhe', await pip(B.p));
    await A.p.evaluate(() => window._liveAssumir()); await A.p.waitForTimeout(300); await sync(A.p, B.p); await B.p.waitForTimeout(300);
    t('retomar: o botão volta para quem retomou', await rotulo(A.p) === 'Abrir controle flutuante', await rotulo(A.p));
    t('retomar: o passador de quem perdeu o controle fecha e o botão volta a pedir', await pip(B.p) === '' && await rotulo(B.p) === 'Pedir o controle para usar o controle flutuante', { pip: await pip(B.p), b: await rotulo(B.p) });
    const C = await open(navs[1], U('ana', 'Ana ADM'), '/okr-apresentacao.slide.html?tela=publico'); await sync(A.p, C.p);
    t('Tela para o público não mostra o botão', await rotulo(C.p) === '(escondido)', await rotulo(C.p));
    const D = await open(navs[1], U('ana', 'Ana ADM'), '/okr-bastidor.html'); await sync(A.p, D.p);
    t('Bastidor do ADM não mostra o botão', await rotulo(D.p) === '(escondido)', await rotulo(D.p));
    const M = await open(navs[1], U('ana', 'Ana ADM'), '/okr-apresentacao.slide.html', 390, 800); await M.p.evaluate(() => window._liveComecar()); await M.p.waitForTimeout(300);
    await M.p.evaluate(() => window._livePainel(true)); await M.p.waitForTimeout(200);
    const cel = await M.p.evaluate(() => { const b = document.getElementById('live-passador').getBoundingClientRect(), r = document.getElementById('live-fpanel').getBoundingClientRect(); return { cruza: !(r.bottom <= b.top || r.top >= b.bottom || r.right <= b.left || r.left >= b.right), dentro: b.right <= innerWidth && b.top >= 0 }; });
    t('390 px: botão dentro da tela e o menu não encosta nele', !cel.cruza && cel.dentro, cel);
    t('sem erro de JavaScript', ![A, B, C, D, M].some(x => x.erros.length), [A, B, C, D, M].map(x => x.erros));
  } finally { await Promise.all(navs.map(n => n.close())); }
  console.log(falhas ? `\n${falhas} falha(s)` : '\nTUDO OK'); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
