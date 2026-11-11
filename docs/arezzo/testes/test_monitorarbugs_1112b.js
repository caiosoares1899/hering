// /monitorarbugs 11–12/11 (parte 2, maestro): os 3 achados do Codex que ficaram para o maestro.
// (1) Oceano: trocar de conta na mesma aba não contava a abertura da 2ª pessoa (sessionStorage por aba, não por pessoa).
// (2) Oceano: com um produto aberto, ir para #conheca fechava o produto mas o título da aba continuava o do produto.
// (3) Ilha no celular: preferência "ao passar o mouse" (salva noutro aparelho) deixava a introdução sem nenhum rádio marcado.
// Rodar: python3 -m http.server 8961 --directory . (na raiz) e `node docs/arezzo/testes/test_monitorarbugs_1112b.js`.
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const cr = path.join(home, 'hering-tools/chrome');
const chrome = process.env.CHROME || path.join(cr, fs.readdirSync(cr).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8961';
const user = (uid, nome) => ({ uid, email: uid + '@ciahering.com.br', displayName: nome, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const seed = () => ({ kanban: { usuarios: { ana: { uid: 'ana', nome: 'Ana', email: 'ana@ciahering.com.br', inscrito: true, role: 'adm', squads: { dados: true } }, bia: { uid: 'bia', nome: 'Bia', email: 'bia@ciahering.com.br', inscrito: true, role: 'membro', squads: { dados: true } } }, config: { adm_emails: ['ana@ciahering.com.br'] } } });
(async () => {
  const b = await chromium.launch({ executablePath: chrome }); let n = 0, f = 0;
  const t = (nome, ok, d) => { n++; if (!ok) f++; console.log((ok ? '✅ ' : '❌ ') + nome + (ok ? '' : ' → ' + JSON.stringify(d))); };
  { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed()); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/oceano-dev.html'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(u => window.__authCb(u), user('ana', 'Ana')); await p.waitForTimeout(1200);
    // troca de conta na MESMA aba: o Oceano recarrega no logout (sessionStorage sobrevive ao reload)
    await Promise.all([p.waitForNavigation().catch(() => {}), p.evaluate(() => window.__authCb(null))]);
    await p.waitForFunction(() => !!window.__authCb); await p.evaluate(u => window.__authCb(u), user('bia', 'Bia')); await p.waitForTimeout(1000);
    const c = await p.evaluate(() => ({ ana: localStorage.getItem('oceano_aberturas_ana'), bia: localStorage.getItem('oceano_aberturas_bia') }));
    t('Oceano: 2ª conta na mesma aba conta a própria abertura', c.ana === '1' && c.bia === '1', c);
    // produto aberto → #conheca → título volta para Oceano
    await p.evaluate(() => { location.hash = '#/okr'; }); await p.waitForTimeout(800);
    const tProd = await p.title();
    await p.evaluate(() => { location.hash = '#conheca'; }); await p.waitForTimeout(600);
    const tDepois = await p.title();
    t('Oceano: #conheca com produto aberto devolve o título "Oceano"', /Oceano/.test(tDepois) && !/Radar/.test(tDepois), { tProd, tDepois });
    t('Oceano: sem erro de JS', !errs.length, errs); await ctx.close(); }
  { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await fake.install(ctx, { kanban: { usuarios: { eve: { uid: 'eve', nome: 'Eve', email: 'eve@ciahering.com.br', init: 'EV', role: 'adm', inscrito: true, squads: { site: true } } }, usuarios_publicos: { eve: { uid: 'eve', nome: 'Eve', init: 'EV' } }, config: { adm_emails: ['eve@ciahering.com.br'] }, squads_meta: { site: { label: 'Squad Site' } }, squads: { site: { dados: { columns: [{ id: 'doing', name: 'Fazendo' }], cards_index: {}, cards: {} } } } } });
    const p = await ctx.newPage(); await p.goto(base + '/kanban-dev.html?squad=site'); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(() => localStorage.setItem('mare_ilha_eve_dev', JSON.stringify({ on: true, introVista: true, ux: 3, modo: 'mouse' })));
    await p.evaluate(u => window.__authCb(u), user('eve', 'Eve')); await p.waitForTimeout(3500);
    await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); _ilhaIntroAbrir(); _ilhaIntroIr(3); }); await p.waitForTimeout(300);
    const r = await p.evaluate(() => [...document.querySelectorAll('[data-ii-modo]')].map(i => [i.value, i.checked]));
    t('Ilha no celular com preferência "mouse": a introdução marca "Só com algo acontecendo" (o que vale no toque)', r.length === 2 && r.some(x => x[0] === 'acao' && x[1]), r);
    await ctx.close(); }
  await b.close(); console.log(`\n${n - f}/${n} ok`); process.exit(f ? 1 : 0);
})();
