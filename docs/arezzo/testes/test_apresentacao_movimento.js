// Apresentação do Radar — movimento de entrada (09/11/2026, GUIA_UI_UX §2.4, regime experiência).
// Antes: a troca de slide era um corte seco (render() recria os slides; a transição de .35s do CSS nunca rodava) e as barras já nasciam cheias.
// Agora: os blocos entram em cascata (30 ms, até 6), as barras crescem e os números da capa/torre contam — só ao navegar. O slide inteiro não anima (custo de GPU medido).
// Uso: python3 -m http.server 8941 &  PW_MODULE=... CHROME_PATH=... node docs/arezzo/testes/test_apresentacao_movimento.js
const { chromium } = require(process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js'); const { seed } = require('./seed_apresentacao.js');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, x) => { console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ' + JSON.stringify(x))); if (!c) ok = false; };
  const abre = async (reduce) => {
    const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: reduce ? 'reduce' : 'no-preference' }); await fake.install(ctx, seed()); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8941/okr-apresentacao.slide.html'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana' }); await p.waitForTimeout(1500); return { ctx, p, errs };
  };
  const anims = p => p.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' || a.playState === 'pending').map(a => a.animationName || a.transitionProperty));
  const nums = p => p.evaluate(() => [...document.querySelectorAll('.slide.active :is(.ck-hero b, .ck-nums b, .tt-nums b, .torre-kpis .stat-chip b)')].map(e => e.textContent));
  { const { ctx, p, errs } = await abre(false);
    // 1) navegar anima: o slide entra pela direção do avanço e os blocos em cascata
    const a = await p.evaluate(() => { window._okrGoTo(2); const sl = document.querySelector('.slide.active'); return { entra: sl.classList.contains('entra'), slide: sl.getAnimations().length, nomes: [...new Set(document.getAnimations().map(x => x.animationName).filter(Boolean))] }; });
    t('avançar: blocos em cascata e barras crescendo; o slide inteiro não anima (camada de tela cheia = GPU)', a.entra && !a.slide && ['slItem', 'slBarra'].every(n => a.nomes.includes(n)), a);
    const atrasos = await p.evaluate(() => [...document.querySelectorAll('.slide.active .obj-card')].map(e => getComputedStyle(e).animationDelay));
    t('cascata limitada: 30 ms por cartão e para no 6º', atrasos[0] === '0.06s' && atrasos[1] === '0.09s' && atrasos.slice(5).every(x => x === '0.21s'), atrasos);
    const v = await p.evaluate(() => { window._okrGoTo(1); return document.querySelector('.slide.active').classList.contains('entra'); });
    t('voltar também anima a entrada', v);
    // 2) uma vez só: em ~1 s nada mais anima (GPU zero com a tela parada)
    await p.waitForTimeout(1100); const parado = (await anims(p)).filter(x => x !== 'width');
    t('depois da entrada nada fica animando', !parado.length, parado);
    // 3) o :hover do cartão continua valendo (a animação não prende o transform)
    await p.evaluate(() => window._okrGoTo(2)); await p.waitForTimeout(900); await p.hover('.slide.active .obj-card'); await p.waitForTimeout(350);
    const hov = await p.evaluate(() => getComputedStyle(document.querySelector('.slide.active .obj-card')).transform);
    t('hover do cartão ainda levanta depois da entrada', hov !== 'none' && /-3/.test(hov), hov);
    // 4) dado mudando no meio da reunião (rebuild) NÃO reanima a sala
    await p.evaluate(() => window._update(window._ref(window._db, 'kanban/okr/objetivos/o0'), { titulo: 'Título editado ao vivo' })); await p.waitForTimeout(400);
    const r = await p.evaluate(() => ({ entra: document.querySelector('.slide.active').classList.contains('entra'), nomes: document.getAnimations().map(x => x.animationName).filter(Boolean), titulo: document.body.innerText.includes('Título editado ao vivo') }));
    t('atualização de dado redesenha sem animar de novo', r.titulo && !r.entra && !r.nomes.length, r);
    // 5) Count-up: conta durante a entrada e termina no texto exato (com %)
    await p.evaluate(() => window._okrGoTo(1)); await p.waitForTimeout(900); const finalTorre = await nums(p);
    const finalCapa = await p.evaluate(() => { window._okrGoTo(0); return [...document.querySelectorAll('.slide.active :is(.ck-hero b, .ck-nums b, .tt-nums b, .torre-kpis .stat-chip b)')].map(e => e.textContent); }); await p.waitForTimeout(150); const meio = await nums(p); await p.waitForTimeout(900); const fim = await nums(p);
    t('capa: números contam durante a entrada', finalCapa.length > 0 && meio.some((x, i) => x !== finalCapa[i]), { finalCapa, meio });
    t('capa: contagem termina no valor exato', JSON.stringify(fim) === JSON.stringify(finalCapa), { finalCapa, fim });
    await p.evaluate(() => window._okrGoTo(1)); await p.waitForTimeout(900);
    t('torre: contagem termina no valor exato (com %)', JSON.stringify(await nums(p)) === JSON.stringify(finalTorre) && finalTorre.some(x => /%$/.test(x)), finalTorre);
    // 6) navegar rápido (segurar a seta) não deixa número pela metade
    await p.evaluate(() => { window._okrGoTo(0); window._okrGoTo(1); window._okrGoTo(0); }); await p.waitForTimeout(900);
    t('navegação rápida: números da capa terminam certos', JSON.stringify(await nums(p)) === JSON.stringify(finalCapa));
    // 7) largura reservada da contagem é solta no fim
    t('contagem solta a largura reservada no fim', await p.evaluate(() => [...document.querySelectorAll('.slide.active .conta')].every(e => !e.style.minWidth)));
    // 8) detalhe do Objetivo abre sem animação (véu de tela cheia com opacidade = o custo de GPU que saiu do slide)
    const d1 = await p.evaluate(() => { window._okrOpenDetail('o0'); return document.getAnimations().map(x => x.animationName).filter(Boolean); }); await p.waitForTimeout(300); await p.evaluate(() => window._okrCloseDetail());
    t('detalhe abre sem animar o véu de tela cheia', !d1.length, d1);
    // 10) medidor de fps no canto inferior direito: mostra o número e não cobre o 📋 nem as bolinhas
    const fm = await p.evaluate(() => { const b = s => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }; document.getElementById('notes-fab').hidden = false; const m = b('#fps-meter'), f = b('#notes-fab'); const ov = (a, c) => a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b; return { txt: document.getElementById('fps-meter').textContent, canto: m.r > innerWidth - 40 && m.b > innerHeight - 30, cobre: ov(m, f) || [...document.querySelectorAll('#bottombar .dot')].some(d => ov(m, b('#bottombar .dot[title="' + d.title + '"]'))) }; });
    t('medidor de fps no canto inferior direito, sem cobrir botão nem bolinhas', /^\d+ fps · (bom|alerta|péssimo)$/.test(fm.txt) && fm.canto && !fm.cobre, fm);
    t('sem erro de JS', !errs.length, errs); await ctx.close(); }
  // 9) movimento reduzido: nada anima e o número já nasce final
  { const { ctx, p, errs } = await abre(true);
    const a = await p.evaluate(() => { window._okrGoTo(1); window._okrGoTo(0); return { n: document.getAnimations().filter(x => x.animationName).length }; });
    const n0 = await nums(p); await p.waitForTimeout(120); const n1 = await nums(p);
    t('reduzir movimento: sem entrada e sem contagem', !a.n && JSON.stringify(n0) === JSON.stringify(n1), { a, n0, n1 });
    t('sem erro de JS (movimento reduzido)', !errs.length, errs); await ctx.close(); }
  await b.close(); console.log(ok ? 'TUDO OK' : 'FALHOU'); process.exit(ok ? 0 : 1);
})();
