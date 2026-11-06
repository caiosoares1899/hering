// Apresentação do Radar — rodada UI/UX (06/11/2026): leitura em tela cheia, fluidez (fps) e acabamento Marine Glass.
// Uso: PW_MODULE=... CHROME_PATH=... node test_apresentacao_ui.js
const { chromium } = require(process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js'); const { seed, objetivos } = require('./seed_apresentacao.js');
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true; const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const dados = seed(); const o = dados.kanban.okr.objetivos; o.o5.titulo = '<img src=x onerror="window.__xss=1"> Título com HTML <b>negrito</b>';   // texto de outra pessoa vira texto, nunca marcação
  for (const [w, h] of [[1920, 1080], [1366, 768], [1024, 768]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } }); await fake.install(ctx, JSON.parse(JSON.stringify(dados))); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8941/okr-apresentacao.slide.html'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana', photoURL: '', providerData: [{ providerId: 'google.com' }] }); await p.waitForTimeout(1800);
    const n = await p.evaluate(() => document.querySelectorAll('.slide').length); const tag = `[${w}px] `;
    // 1) sem rolagem lateral em nenhum slide nem no detalhe
    const lateral = []; for (let i = 0; i < n; i++) { await p.evaluate(i => window._okrGoTo(i), i); await p.waitForTimeout(450); const r = await p.evaluate(() => { const d = document.documentElement; const a = document.querySelector('.slide.active'); const inn = a && a.querySelector('.slide-inner,.cover-wrap'); const rc = inn ? inn.getBoundingClientRect() : null; return { doc: d.scrollWidth - d.clientWidth, dentro: rc ? (rc.left >= -1 && rc.right <= innerWidth + 1) : true }; }); if (r.doc > 1 || !r.dentro) lateral.push([i, r]); }
    t(tag + 'nenhum slide estoura a largura (capa, torre, gerências, resumo)', !lateral.length, lateral);
    const latDet = []; for (const id of ['o0', 'o3', 'o5']) { await p.evaluate(id => window._okrOpenDetail(id), id); await p.waitForTimeout(500); const r = await p.evaluate(() => { const d = document.documentElement, m = document.querySelector('.d2-wrap').getBoundingClientRect(); return { doc: d.scrollWidth - d.clientWidth, dir: Math.round(m.right - innerWidth), baixo: Math.round(m.bottom - innerHeight) }; }); if (r.doc > 1 || r.dir > 1 || r.baixo > 1) latDet.push([id, r]); }
    t(tag + 'detalhe do Objetivo (curto, 14 marcos, título enorme) cabe na tela', !latDet.length, latDet);
    // 2) fluidez: nada animando para sempre quando ninguém está ao vivo, e sem desfoque nas superfícies fixas
    await p.evaluate(() => { window._okrCloseDetail(); window._okrGoTo(2); }); await p.waitForTimeout(700);
    const infinitas = await p.evaluate(() => document.getAnimations().filter(a => a.effect && a.effect.getComputedTiming().iterations === Infinity).map(a => (a.effect.target && a.effect.target.className) || '?'));
    t(tag + 'sem animação infinita parada (era o pulso do "AO VIVO" repintando o desfoque 60×/s)', !infinitas.length, infinitas);
    const blur = await p.evaluate(() => ['#topbar', '#bottombar', '.obj-card', '.stat-chip', '.torre-tile', '.ger-row', '.d2-panel', '.d2-right', '.d2-fcol', '#notes-fab', '#live-fab'].filter(s => { const e = document.querySelector(s); return e && /blur/.test(getComputedStyle(e).backdropFilter); }));
    t(tag + 'superfícies fixas sem backdrop-filter (fundo é gradiente estático: o desfoque só custava GPU)', !blur.length, blur);
    // 3) leitura: tamanho mínimo (px reais) — em Full HD o texto cresce, em notebook não encolhe
    const f = await p.evaluate(() => { const px = s => { const e = document.querySelector(s); return e ? parseFloat(getComputedStyle(e).fontSize) : 0; }; return { rotulo: px('.slide.active .prog-label'), pct: px('.slide.active .prog-pct'), titulo: px('.slide.active .obj-title'), chip: px('.slide.active .status-chip') }; });
    const minLeit = w >= 1900 ? { rotulo: 18, pct: 50, titulo: 30, chip: 16 } : { rotulo: 14, pct: 40, titulo: 22, chip: 12 };
    t(tag + `texto legível no cartão ${JSON.stringify(f)}`, f.rotulo >= minLeit.rotulo && f.pct >= minLeit.pct && f.titulo >= minLeit.titulo && f.chip >= minLeit.chip, [f, minLeit]);
    await p.evaluate(() => window._okrOpenDetail('o0')); await p.waitForTimeout(500);
    const d = await p.evaluate(() => { const px = s => { const e = document.querySelector(s); return e ? parseFloat(getComputedStyle(e).fontSize) : 0; }; return { marco: px('.d2-marco-row'), lista: px('.d2-flist'), corpo: px('.d2-panel-body') }; });
    t(tag + `texto legível no detalhe ${JSON.stringify(d)}`, w >= 1900 ? (d.marco >= 21 && d.lista >= 20) : (d.marco >= 15 && d.lista >= 14), d);
    // 4) acabamento: sem faixa lateral grossa no cartão; selo de status é um (cor + texto) e não quebra em 2 linhas
    await p.evaluate(() => { window._okrCloseDetail(); window._okrGoTo(2); }); await p.waitForTimeout(600);
    const ac = await p.evaluate(() => { const c = document.querySelector('.slide.active .obj-card'); const cs = getComputedStyle(c); const chip = c.querySelector('.status-chip'); return { borda: parseFloat(cs.borderLeftWidth), chipH: Math.round(chip.getBoundingClientRect().height), fonte: parseFloat(getComputedStyle(chip).fontSize) }; });
    t(tag + 'cartão sem a faixa lateral colorida e selo numa linha só', ac.borda <= 1.5 && ac.chipH < ac.fonte * 2.4, ac);
    // 5) texto de outra pessoa nunca vira marcação
    const xss = await p.evaluate(() => ({ img: !!document.querySelector('#slides img[src="x"], #detail-modal img[src="x"]'), flag: window.__xss || 0 }));
    t(tag + 'HTML no título aparece como texto (sem <img> injetado)', !xss.img && !xss.flag, xss);
    t(tag + 'sem erro de JS', !errs.length, errs); await ctx.close(); }
  // 6) com a apresentação ao vivo de verdade, o anel pulsa (único movimento permitido) e só com transform/opacity
  { const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } }); await fake.install(ctx, JSON.parse(JSON.stringify(dados))); const p = await ctx.newPage(); await p.goto('http://localhost:8941/okr-apresentacao.slide.html'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana', photoURL: '', providerData: [{ providerId: 'google.com' }] }); await p.waitForTimeout(1800);
    const css = await p.evaluate(() => { const r = [...document.styleSheets].flatMap(s => [...s.cssRules]).find(x => x.name === 'liveAnel'); return r ? r.cssText : ''; });
    t('anel do "ao vivo" anima só transform/opacity (compositor, sem repintar)', /transform/.test(css) && /opacity/.test(css) && !/box-shadow/.test(css), css); await ctx.close(); }
  await b.close(); console.log(ok ? 'TUDO OK' : 'HÁ FALHAS'); process.exit(ok ? 0 : 1); })();
