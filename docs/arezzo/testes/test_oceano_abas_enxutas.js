// 🧭 Oceano — O4 da consultoria (11/11/2026): "Conheça o Oceano" e "Por baixo do casco" saem da navegação de quem já abriu o Oceano mais de
// 5 vezes neste aparelho; viram links no rodapé e na Ajuda. #conheca e #tecnica continuam funcionando. Quem chega pela 1ª vez vê as abas.
// Rodar: python3 -m http.server 8961 --directory . (na raiz) e `node docs/arezzo/testes/test_oceano_abas_enxutas.js` (BASE_URL troca o servidor).
const fs = require('fs'), path = require('path'), home = require('os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const cr = path.join(home, 'hering-tools/chrome'), chrome = process.env.CHROME || path.join(cr, fs.readdirSync(cr).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8961';
const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const seed = () => ({ kanban: { usuarios: { ana: { uid: 'ana', nome: 'Ana Lima', email: U.email, inscrito: true, role: 'membro', squads: { dados: true } } } } });
(async () => {
  const b = await chromium.launch({ executablePath: chrome }); let falhas = 0, total = 0;
  const t = (n, c, d) => { total++; if (!c) falhas++; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed());
  const errs = [];
  const abre = async (hash) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto(base + '/oceano-dev.html' + (hash || '')); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(1200); return p; };
  const estado = p => p.evaluate(() => ({ nav: getComputedStyle(document.querySelector('main > .tabs')).display !== 'none', rod: getComputedStyle(document.querySelector('.rodape-links')).display !== 'none', n: +localStorage.getItem('oceano_aberturas_ana') || 0 }));

  // 5 aberturas (cada aba nova = sessão nova): abas visíveis
  for (let i = 1; i <= 5; i++) { const p = await abre(); const e = await estado(p); if (i === 1) t('1ª abertura: abas visíveis e sem links no rodapé', e.nav && !e.rod && e.n === 1, e);
    if (i === 5) t('5ª abertura: ainda visíveis (conta 5)', e.nav && e.n === 5, e); await p.close(); }
  { const p = await abre(); const e = await estado(p);
    t('6ª abertura: abas somem do Início e viram links no rodapé', !e.nav && e.rod && e.n === 6, e);
    await p.reload(); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(800);
    t('recarregar na mesma aba não conta de novo (1 por sessão)', (await estado(p)).n === 6, await estado(p));
    await p.click('.rodape-links a[href="#conheca"]'); await p.waitForTimeout(500);
    const c = await p.evaluate(() => ({ tab: document.querySelector('.tabs [aria-selected="true"]').dataset.tab, painel: document.getElementById('tab-conheca').classList.contains('on'), nav: getComputedStyle(document.querySelector('main > .tabs')).display !== 'none' }));
    t('link do rodapé abre "Conheça o Oceano" e mostra as abas para voltar', c.tab === 'conheca' && c.painel && c.nav, c);
    await p.click('.tabs [data-tab="inicio"]'); await p.waitForTimeout(300);
    t('voltar a "Meus produtos" esconde as abas de novo', !(await estado(p)).nav, '');
    await p.close(); }
  { const p = await abre('#tecnica'); const c = await p.evaluate(() => ({ painel: document.getElementById('tab-tecnica').classList.contains('on'), nav: getComputedStyle(document.querySelector('main > .tabs')).display !== 'none' }));
    t('#tecnica continua abrindo "Por baixo do casco" (com as abas visíveis)', c.painel && c.nav, c); await p.close(); }
  { const p = await abre(); const faq = await p.evaluate(async () => { const src = await (await fetch(location.pathname, { cache: 'no-store' })).text(); const m = /\{id:'abas'[^\n]*/.exec(src); return m ? m[0] : ''; });   // o FAQ mora num <script type=module>
    t('Ajuda explica onde foram as abas, com os dois links', /href="#conheca"/.test(faq) && /href="#tecnica"/.test(faq), faq.slice(0, 120)); await p.close(); }
  { const c2 = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(c2, seed()); const p = await c2.newPage(); await p.goto(base + '/oceano-dev.html'); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(() => { localStorage.setItem('oceano_aberturas_bia', '40'); }); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(1000);
    t('a contagem é por pessoa: outra conta veterana no mesmo navegador não esconde as abas de quem é nova', await p.evaluate(() => getComputedStyle(document.querySelector('main > .tabs')).display !== 'none'), ''); await c2.close(); }
  t('sem erro de JS', !errs.length, errs);
  await b.close(); console.log(`\n${total - falhas}/${total} ok`); process.exit(falhas ? 1 : 0);
})();
