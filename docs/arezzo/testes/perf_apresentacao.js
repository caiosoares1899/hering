// Mede fluidez da apresentação do Radar: tempo por quadro (rAF) parado no slide, trocando de slide e com detalhe aberto.
// Chromium headless rasteriza por CPU: o valor absoluto não é o do projetor, mas ANTES × DEPOIS na mesma máquina é comparável.
// Uso: PW_MODULE=... CHROME_PATH=... node perf_apresentacao.js [rótulo] [dpr]
const { chromium } = require(process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js'); const { seed } = require('./seed_apresentacao.js');
const DPR = Number(process.argv[3] || 2);
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: DPR }); await fake.install(ctx, seed()); const p = await ctx.newPage();
  if (process.env.PAGINA_ALT) { const corpo = require('fs').readFileSync(process.env.PAGINA_ALT, 'utf8'); await p.route('**/okr-apresentacao.slide.html*', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: corpo })); }   // compara com outra versão da página sem trocar arquivo
  await p.goto('http://localhost:8941/okr-apresentacao.slide.html'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana', photoURL: '', providerData: [{ providerId: 'google.com' }] }); await p.waitForTimeout(2000);
  const medir = (ms, acao) => p.evaluate(async ([ms, acao]) => { const dts = []; let ult = performance.now(), fim = ult + ms, k = 0; const f = window.eval(acao);
    await new Promise(res => { const tick = (t) => { dts.push(t - ult); ult = t; if (f && (k++ % 40 === 0)) f(); if (t < fim) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
    dts.shift(); dts.sort((a, b) => a - b); const q = x => dts[Math.min(dts.length - 1, Math.floor(dts.length * x))]; const soma = dts.reduce((a, c) => a + c, 0);
    return { quadros: dts.length, fps: Math.round(dts.length / (soma / 1000)), p50: +q(.5).toFixed(1), p95: +q(.95).toFixed(1), max: +dts[dts.length - 1].toFixed(1), lentos: dts.filter(d => d > 33).length }; }, [ms, acao]);
  // Trabalho real de pintura: soma o tempo de Raster/Paint/Draw (todas as threads) numa janela, via tracing do Chromium.
  const TRACE = ['disabled-by-default-devtools.timeline', 'cc', 'viz', 'gpu', 'benchmark'];
  const somar = (ev, ms) => { const t = {}; let quadros = 0; for (const e of ev) { if (e.ph === 'X' && e.dur != null) { const n = e.name; if (/^(RasterTask|Paint|PrePaint|Layerize|UpdateLayer|CompositeLayers|Commit|Layout|UpdateLayoutTree|ImageDecodeTask)$/.test(n) || /DrawAndSwap|GLES2DecoderImpl::DoCommands|SkiaOutputSurface|GpuRaster|RasterDecoder/.test(n)) { t[n] = (t[n] || 0) + e.dur / 1000; } }
      if (e.name === 'Display::DrawAndSwap' || e.name === 'DrawFrame') quadros++; }
    const total = Object.entries(t).filter(([k]) => /RasterTask|DrawAndSwap|DoCommands|GpuRaster|RasterDecoder|SkiaOutputSurface/.test(k)).reduce((a, [, v]) => a + v, 0);
    return { 'ms de raster+GPU por segundo': Math.round(total / (ms / 1000)), 'quadros desenhados/s': Math.round(quadros / (ms / 1000)), 'ms de paint+layout/s': Math.round(Object.entries(t).filter(([k]) => /^(Paint|PrePaint|Layerize|UpdateLayer|Layout|UpdateLayoutTree)$/.test(k)).reduce((a, [, v]) => a + v, 0) / (ms / 1000)) }; };
  const janela = async (ms, acao) => { await b.startTracing(p, { categories: TRACE }); await p.evaluate(async ([ms, acao]) => { const f = window.eval(acao); let k = 0; await new Promise(res => { const fim = performance.now() + ms; const tick = t => { if (f && (k++ % 40 === 0)) f(); if (t < fim) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); }); }, [ms, acao]); const buf = await b.stopTracing(); const ev = JSON.parse(buf.toString()).traceEvents || []; return somar(ev, ms); };
  const R = {};
  await p.evaluate(() => window._okrGoTo(2)); await p.waitForTimeout(1200);
  R['parado na gerência'] = await janela(3000, 'null');
  R['trocando de slide'] = await janela(4000, '(()=>{ let i=1; return ()=>{ window._okrGoTo(i=(i+1)%8); }; })()');
  await p.evaluate(() => { window._okrGoTo(2); window._okrOpenDetail('o0'); }); await p.waitForTimeout(1200);
  R['detalhe aberto'] = await janela(3000, 'null');
  // Cenário real de quem apresenta: sessão "Apresentar ao vivo" ligada (apresentador), parado e com o laser seguindo o mouse.
  await p.evaluate(() => { window._okrCloseDetail(); window._okrGoTo(2); }); await p.waitForTimeout(500);
  p.on('dialog', d => d.accept()); await p.click('#live-box button'); await p.waitForTimeout(6500);   // espera os 3 pulsos de entrada acabarem
  R['AO VIVO ligado, parado'] = await janela(3000, 'null');
  await p.keyboard.press('l'); await p.mouse.move(400, 400);
  const mexe = (async () => { for (let i = 0; i < 60; i++) { await p.mouse.move(400 + (i % 30) * 20, 400 + Math.sin(i) * 120); await p.waitForTimeout(50); } })();
  R['AO VIVO + laser em movimento'] = await janela(3000, 'null'); await mexe;
  console.log(process.argv[2] || 'medida', 'dpr', DPR); console.table(R); await b.close(); })();
