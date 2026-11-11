// 🌊 Travessia — rodada /melhoriauiux de 11/11/2026 ("muito quadrada, cara de IA, pouco Marine Glass").
// Confere: peixinhos e bolhas iguais aos do Oceano (8/16 no desktop, 4/8 no celular; 🐟 desliga e lembra; pausam com a aba escondida; param com
// movimento reduzido), vidro lapidado sem desfoque nos cartões, botões e abas sem gradiente, seções de consulta abertas (sem caixa), nada de caixa
// dentro de caixa na Avaliação, avatar neutro na Frota (cor só no farol), alerta de apoio continua amarelo, contraste e zero rolagem lateral nos 3 temas.
// Rodar: python3 -m http.server 8961 --directory . (na raiz) e `node docs/arezzo/testes/test_travessia_marine.js` (BASE_URL troca o servidor).
const fs = require('fs'), path = require('path'), home = require('os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const cr = path.join(home, 'hering-tools/chrome'), chrome = process.env.CHROME || path.join(cr, fs.readdirSync(cr).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8961', out = path.join(__dirname, '..', '..', 'capturas', 'travessia-marine');
(async () => {
  const b = await chromium.launch({ executablePath: chrome }); let falhas = 0, total = 0;
  const t = (n, c, d) => { total++; if (!c) falhas++; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  fs.mkdirSync(out, { recursive: true });
  const abre = async (qs, vp, tema, extra) => { const ctx = await b.newContext(Object.assign({ viewport: vp || { width: 1280, height: 900 } }, extra || {})); await fake.install(ctx, {}); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/travessia-dev.html?demo=1' + qs); await p.waitForSelector('#app .h1', { timeout: 8000 }); await p.waitForTimeout(700);
    if (tema) { await p.evaluate(x => document.documentElement.setAttribute('data-theme', x), tema); await p.waitForTimeout(600); } return { ctx, p, errs }; };
  const lum = c => { const [r, g, bl] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const contr = (a, c) => { const x = lum(a), y = lum(c); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

  // 1) peixinhos e bolhas
  { const { ctx, p, errs } = await abre('&como=ana');
    const n = await p.evaluate(() => ({ f: document.querySelectorAll('#fwrap > div').length, b: document.querySelectorAll('#bwrap .bubble').length, svg: document.querySelectorAll('#fwrap svg ellipse').length, z: getComputedStyle(document.getElementById('fwrap')).zIndex, pe: getComputedStyle(document.getElementById('fwrap')).pointerEvents }));
    t('desktop: 8 peixes (silhuetas do Oceano) e 16 bolhas, atrás do conteúdo e sem receber clique', n.f === 8 && n.b === 16 && n.svg === 8 && +n.z < 0 && n.pe === 'none', n);
    await p.click('#btn-peixes'); await p.waitForTimeout(200);
    const off = await p.evaluate(() => ({ f: document.querySelectorAll('#fwrap > div').length, pr: document.getElementById('btn-peixes').getAttribute('aria-pressed'), ls: localStorage.getItem('travessia_peixes') }));
    t('🐟 desliga os peixes (aria-pressed=false) e lembra neste navegador', off.f === 0 && off.pr === 'false' && off.ls === 'off', off);
    await p.reload(); await p.waitForSelector('#app .h1'); await p.waitForTimeout(400);
    t('…e continua desligado depois de recarregar', (await p.locator('#fwrap > div').count()) === 0, '');
    await p.click('#btn-peixes'); await p.waitForTimeout(200); t('🐟 de novo liga', (await p.locator('#fwrap > div').count()) === 8, '');
    await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); }); await p.waitForTimeout(100);
    t('aba escondida: animação pausa (data-anim-paused + play-state paused)', await p.evaluate(() => document.documentElement.hasAttribute('data-anim-paused') && getComputedStyle(document.querySelector('#fwrap > div')).animationPlayState === 'paused'), '');
    t('sem erro de JS', !errs.length, errs); await ctx.close(); }
  { const { ctx, p } = await abre('&como=ana', { width: 390, height: 844 });
    t('celular: 4 peixes e 8 bolhas', (await p.locator('#fwrap > div').count()) === 4 && (await p.locator('#bwrap .bubble').count()) === 8, ''); await ctx.close(); }
  { const { ctx, p } = await abre('&como=ana', null, null, { reducedMotion: 'reduce' });
    t('movimento reduzido: peixes e bolhas parados', await p.evaluate(() => [...document.querySelectorAll('#fwrap > div, #bwrap .bubble')].every(e => getComputedStyle(e).animationName === 'none')), ''); await ctx.close(); }

  // 2) acabamento: vidro lapidado, sem gradiente, seções abertas, sem caixa dentro de caixa
  { const { ctx, p } = await abre('&como=ana');
    const r = await p.evaluate(() => { const cs = s => getComputedStyle(document.querySelector(s));
      const sec = [...document.querySelectorAll('#painel .sec')];
      return { blur: [...document.querySelectorAll('#painel .gl')].filter(e => getComputedStyle(e).backdropFilter !== 'none').length, spec: /inset/.test(cs('#painel .gl').boxShadow),
        btnP: cs('#painel .btn.p').backgroundImage, navSel: cs('.nav [aria-selected="true"]').backgroundImage, ib: cs('#painel h2 .ib').backgroundColor,
        secs: sec.length, secBox: sec.filter(e => { const c = getComputedStyle(e); return c.backgroundColor !== 'rgba(0, 0, 0, 0)' || c.borderTopWidth !== '0px' || c.boxShadow !== 'none'; }).length,
        heroBox: cs('.hero').borderTopWidth, barco: !!document.querySelector('.hero .barco'), farolBg: cs('.farol').backgroundColor }; });
    t('cartões em vidro lapidado: linha de luz no topo e nenhum desfoque nos cartões parados', r.blur === 0 && r.spec, r);
    t('botão principal e aba selecionada sem gradiente', r.btnP === 'none' && r.navSel === 'none', r);
    t('emoji do título sem bolinha em volta', r.ib === 'rgba(0, 0, 0, 0)', r.ib);
    t('Início: Avaliação, Mural de Estrelas e Meu Baú como seções abertas (sem caixa)', r.secs === 3 && r.secBox === 0, r);
    t('saudação direto sobre o mar (sem caixa, sem barquinho balançando)', r.heroBox === '0px' && !r.barco, r);
    t('farol sem caixa colorida (a cor fica no anel)', r.farolBg === 'rgba(0, 0, 0, 0)', r.farolBg);
    await p.click('[data-tab="aval"]'); await p.waitForTimeout(600);
    const a = await p.evaluate(() => [...document.querySelectorAll('#painel .gl .foco, #painel .gl .trava')].map(e => { const c = getComputedStyle(e); return c.backgroundColor === 'rgba(0, 0, 0, 0)' && c.borderTopWidth === '1px'; }));
    t('Avaliação: partes do ciclo como seções com linha fina (nada de caixa dentro de caixa)', a.length >= 4 && a.every(Boolean), a);
    await ctx.close(); }
  { const { ctx, p } = await abre('&como=pau&tab=frota');
    const f = await p.evaluate(() => ({ av: getComputedStyle(document.querySelector('.pcard .av')).boxShadow, apoio: getComputedStyle(document.querySelector('.apoio')).boxShadow, abrir: getComputedStyle(document.querySelector('.pcard [data-act="abrir"]')).backgroundImage }));
    t('Frota: avatar neutro (sem anel na cor do estado) e "Abrir" discreto', !/rgb\((255, 107, 107|74, 222, 128|255, 209, 102)\)/.test(f.av) && f.abrir === 'none', f);
    t('Frota: "Pra ficar de olho" continua com o amarelo de atenção', /255, 209, 102/.test(f.apoio), f.apoio);
    await p.screenshot({ path: path.join(out, 'frota-1280.png'), clip: { x: 0, y: 0, width: 1280, height: 900 } }); await ctx.close(); }

  // 3) três temas × 2 tamanhos: sem rolagem lateral, contraste do botão principal, seção aberta legível no claro
  for (const [nome, tema] of [['abrolhos', null], ['lencois', 'light'], ['entardecer', 'sunset']]) for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const rot = nome + ' ' + vp.width + 'px';
    for (const [como, tab] of [['ana', 'inicio'], ['ana', 'bau'], ['ana', 'diario'], ['ana', 'aval'], ['pau', 'frota'], ['adm', 'admin']]) { const { ctx, p, errs } = await abre('&como=' + como + '&tab=' + tab, vp, tema);
      t(rot + ' · ' + tab + ': sem rolagem lateral e sem erro', (await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)) && !errs.length, errs);
      if (tab === 'inicio') { const c = await p.evaluate(() => { const e = document.querySelector('#painel .btn.p'); const cs = getComputedStyle(e); return [cs.color, cs.backgroundColor]; });
        t(rot + ': texto do botão principal ≥ 4,5:1', contr(c[0], c[1]) >= 4.5, [c, contr(c[0], c[1]).toFixed(2)]);
        if (tema === 'light') { const s = await p.evaluate(() => { const e = document.querySelector('#painel .sec'); const cs = getComputedStyle(e); return [cs.color, cs.backgroundColor]; });
          t(rot + ': seção aberta no claro tem fundo de vidro (texto legível sobre o azul)', !/, 0\)$/.test(s[1]), s); }
        await p.screenshot({ path: path.join(out, nome + '-' + vp.width + '.png'), clip: { x: 0, y: 0, width: vp.width, height: vp.height } }); }
      await ctx.close(); } }

  await b.close(); console.log(`\n${total - falhas}/${total} ok`); process.exit(falhas ? 1 : 0);
})();
