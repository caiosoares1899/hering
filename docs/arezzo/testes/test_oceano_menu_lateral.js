// 🧭 Oceano — menu lateral (fase 1, só no dev; pedido do Rafa via Caio, 26/11/2026): o Oceano vira a moldura e os apps trocam pelo menu.
// Ordem: 🌊 Oceano (início) · Maré · Concha · Radar · A Bordo · Painel (só ADM/quem usa). Computador: trilho que expande/recolhe. Celular: barra embaixo.
// Rodar na raiz: python3 -m http.server 8952 --bind 127.0.0.1  →  node docs/arezzo/testes/test_oceano_menu_lateral.js   (fotos em docs/capturas/oceano-menu/)
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const base = process.env.BASE_URL || 'http://127.0.0.1:8952';
const OUT = path.join(__dirname, '../../capturas/oceano-menu'); fs.mkdirSync(OUT, { recursive: true });
const U = (uid, nome) => ({ uid, email: uid + '@ciahering.com.br', displayName: nome, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const seed = (adm) => ({ kanban: { usuarios: { cai: { role: adm ? 'adm' : 'membro', nome: 'Caio', squads: { dados: true } } }, config: { adm_emails: adm ? ['cai@ciahering.com.br'] : [] } } });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 400))); };
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const cr = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(cr) ? path.join(cr, fs.readdirSync(cr).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const abre = async (w, h, adm, larga) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h } }); await fake.install(ctx, seed(adm), { oceano: true });
    await ctx.addInitScript(l => { localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); localStorage.setItem('oceano_rail_larga', l ? '1' : '0'); }, !!larga);
    await ctx.route('**/*', r => { const u = r.request().url(); if (/(kanban|cardume|okr|painel)-dev\.html|onboarding\.html/.test(u)) return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><body style="margin:0;background:#0a2540;color:#cfe;font:16px system-ui;display:flex;align-items:center;justify-content:center;height:100vh">' + u.split('/').pop() + '</body>' }); return r.fallback(); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/oceano-dev.html'); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(() => window.__authCb({ uid: 'cai', email: 'cai@ciahering.com.br', displayName: 'Caio Soares', photoURL: '', providerData: [{ providerId: 'google.com' }] }));
    await p.waitForTimeout(1500);
    return { ctx, p, errs };
  };
  const itens = p => p.evaluate(() => [...document.querySelectorAll('#rail .rail-it:not([hidden])')].filter(x => x.getClientRects().length).map(x => (x.dataset.rail || x.id) + (x.getAttribute('aria-current') ? '*' : '')));

  // ── computador, ADM ──
  { const { ctx, p, errs } = await abre(1280, 800, true);
    t('o menu aparece depois do login', await p.evaluate(() => document.body.classList.contains('com-rail') && getComputedStyle(document.getElementById('rail')).display === 'flex'), 0);
    let it = await itens(p);
    t('ordem: Oceano (início, atual) · Maré · Concha · Radar · A Bordo · Painel; embaixo Sonar e Eu', JSON.stringify(it) === JSON.stringify(['lobby*', 'kanban', 'cardume', 'okr', 'onboarding', 'painel', 'rail-sonar', 'rail-eu']), it);
    t('o início é uma casinha de traço (SVG, sem emoji), com o nome "Início"', await p.evaluate(() => { const b = document.querySelector('#rail [data-rail="lobby"]'); return !!b.querySelector('svg.rail-svg') && b.textContent.trim() === 'Início'; }), 0);
    t('os botões de baixo também são ícones de traço (sem emoji)', await p.evaluate(() => ['rail-sonar', 'rail-recarregar', 'rail-aba', 'rail-fechar'].every(i => !!document.querySelector('#' + i + ' svg.rail-svg'))), 0);
    t('com o menu, os cartões de apps saem do Início (o menu já mostra todos)', await p.evaluate(() => !document.getElementById('tiles').getClientRects().length && !!document.getElementById('col-meta')), 0);
    await p.screenshot({ path: path.join(OUT, 'pc_lobby_recolhido.png') });
    await p.click('#rail [data-rail="cardume"]'); await p.waitForTimeout(500);
    t('clicar em Concha abre DENTRO do Oceano (iframe), com o menu ao lado e sem a barra de abas', await p.evaluate(() => document.getElementById('host').classList.contains('on') && !!document.querySelector('#host-frames iframe.on[data-app="cardume"]') && getComputedStyle(document.querySelector('.host-barra')).display === 'none' && document.getElementById('host').getBoundingClientRect().left === 72), 0);
    t('a janela interna da Concha tem o endereço e CARREGA o app (relato do Caio: tela em branco quando o src sumiu)', await p.evaluate(() => document.querySelector('#host-frames iframe.on').getAttribute('src') === 'cardume-dev.html') && p.frames().some(f => /\/cardume-dev\.html$/.test(f.url())), await p.evaluate(() => document.querySelector('#host-frames iframe.on').getAttribute('src')));
    t('a janela interna não tem title (o balão "Concha" sobre o app) e tem nome acessível', await p.evaluate(() => { const f = document.querySelector('#host-frames iframe.on'); return !f.hasAttribute('title') && f.getAttribute('aria-label') === 'Concha'; }), 0);
    it = await itens(p);
    t('Concha vira o atual; aparecem ↻ Nova aba ✕', it.includes('cardume*') && it.includes('rail-recarregar') && it.includes('rail-aba') && it.includes('rail-fechar'), it);
    await p.click('#rail [data-rail="kanban"]'); await p.waitForTimeout(400);
    t('trocar para o Maré mantém a Concha aberta (bolinha de "aberto")', await p.evaluate(() => !!document.querySelector('#rail [data-rail="cardume"] .rail-aberto') && document.querySelectorAll('#host-frames iframe').length === 2), 0);
    await p.screenshot({ path: path.join(OUT, 'pc_app_recolhido.png') });
    await p.click('#rail-tog'); await p.waitForTimeout(300);
    t('» expande: menu de 212px com nome ao lado do ícone, o app acompanha', await p.evaluate(() => document.getElementById('rail').getBoundingClientRect().width === 212 && document.getElementById('host').getBoundingClientRect().left === 212 && localStorage.getItem('oceano_rail_larga') === '1'), await p.evaluate(() => document.getElementById('rail').getBoundingClientRect().width));
    await p.screenshot({ path: path.join(OUT, 'pc_app_expandido.png') });
    await p.click('#rail-tog'); await p.waitForTimeout(300);
    t('« recolhe de novo', await p.evaluate(() => document.getElementById('rail').getBoundingClientRect().width === 72), 0);
    await p.click('#rail-fechar'); await p.waitForTimeout(300);
    t('✕ fecha o app atual e mostra o outro aberto (Concha)', await p.evaluate(() => document.querySelectorAll('#host-frames iframe').length === 1 && !!document.querySelector('#host-frames iframe.on[data-app="cardume"]')), 0);
    await p.click('#rail [data-rail="lobby"]'); await p.waitForTimeout(300);
    t('o ícone do Oceano volta ao início (o app segue aberto)', await p.evaluate(() => !document.getElementById('host').classList.contains('on') && document.querySelectorAll('#host-frames iframe').length === 1), 0);
    await p.click('#rail-eu'); await p.waitForTimeout(300);
    t('"Eu" abre ⚙ Meu perfil (acima do menu)', await p.evaluate(() => document.getElementById('ov-perfil').classList.contains('open') && +getComputedStyle(document.getElementById('ov-perfil')).zIndex > +getComputedStyle(document.getElementById('rail')).zIndex), 0);
    t('sem erro na página', !errs.length, errs);
    await ctx.close(); }

  // ── membro (sem Painel), expandido salvo ──
  { const { ctx, p, errs } = await abre(1280, 800, false, true);
    const it = await itens(p);
    t('quem não é ADM não vê o Painel', !it.includes('painel'), it);
    t('a preferência "expandido" volta ao recarregar', await p.evaluate(() => document.body.classList.contains('rail-larga')), 0);
    await p.screenshot({ path: path.join(OUT, 'pc_lobby_expandido.png') });
    t('sem erro na página', !errs.length, errs);
    await ctx.close(); }

  // ── celular ──
  { const { ctx, p, errs } = await abre(390, 844, true, true);
    const r = await p.evaluate(() => { const x = document.getElementById('rail').getBoundingClientRect(); return { top: x.top, h: x.height, w: x.width }; });
    t('celular: barra embaixo, largura toda (mesmo com "expandido" salvo)', r.w === 390 && r.top > 700, r);
    const it = await itens(p);
    t('celular: Oceano + 5 apps + Eu (sem Sonar e sem » )', JSON.stringify(it) === JSON.stringify(['lobby*', 'kanban', 'cardume', 'okr', 'onboarding', 'painel', 'rail-eu']) && await p.evaluate(() => !document.getElementById('rail-tog').getClientRects().length), it);
    await p.screenshot({ path: path.join(OUT, 'cel_lobby.png') });
    await p.click('#rail [data-rail="okr"]'); await p.waitForTimeout(400);
    t('celular: o app ocupa a tela acima da barra', await p.evaluate(() => { const h = document.getElementById('host').getBoundingClientRect(), r = document.getElementById('rail').getBoundingClientRect(); return h.left === 0 && Math.abs(h.bottom - r.top) < 2; }), 0);
    await p.screenshot({ path: path.join(OUT, 'cel_app.png') });
    t('sem erro na página', !errs.length, errs);
    await ctx.close(); }

  await b.close();
  console.log((ok ? '\n✅ ' : '\n❌ ') + total + ' verificações');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
