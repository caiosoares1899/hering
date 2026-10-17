// Auditoria de tema (claro / vice city) no Radar e no Painel: contraste de texto, cor fixa, rolagem lateral, erros de JS, prints.
// uso: (servidor estático na raiz, porta 8941)  node docs/arezzo/testes/auditoria_temas.js   — saída em OUT=/tmp/auditoria (prints + resultado.json)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const T = __dirname + '/';
const fake = require(T + 'fakefb.js');
const { objs, snaps } = require(T + 'seed_okr_dashboard.js');
const OUT = process.env.OUT || '/tmp/auditoria'; fs.mkdirSync(OUT, { recursive: true });
const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana ADM', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const jc = x => JSON.parse(JSON.stringify(x));
const seedOkr = () => ({ kanban: { okr: { objetivos: jc(objs), marcos: {}, tags: {}, reuniao_notas: {}, snapshots: jc(snaps) }, usuarios: { ana: { uid: 'ana', nome: 'Ana', email: 'ana@ciahering.com.br', inscrito: true, init: 'AA', role: 'adm', squads: { dados: true } } }, usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana', init: 'AA' } }, config: { adm_emails: ['ana@ciahering.com.br'] } } });
const fluxoLines = fs.readFileSync(T + 'test_painel_fluxo.js', 'utf8').split('\n');
const sdSrc = fluxoLines[6]; const seedPainel = new Function(sdSrc + '; return sd();')();
const setupPainel = fluxoLines.slice(14, 27).join('\n');   // await p.evaluate(()=>{ ...squads/cards... });

// ── varredura dentro da página ──
const SCAN = () => {
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); };
  const parse = s => { const m = s && s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const over = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; };
  const oceanBg = (() => { const o = document.querySelector('.ocean'); const bi = o ? getComputedStyle(o).backgroundImage : ''; const cs = [...bi.matchAll(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/g)]; if (!cs.length) return null; const u = cs[cs.length - 1]; return [+u[1], +u[2], +u[3], 1]; })();   // pior caso: a ÚLTIMA cor do degradê do fundo
  const rootBg = oceanBg || parse(getComputedStyle(document.documentElement).getPropertyValue('--deep').trim().startsWith('#') ? hexRgb(getComputedStyle(document.documentElement).getPropertyValue('--deep').trim()) : getComputedStyle(document.body).backgroundColor) || [3, 13, 26, 1];
  function hexRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); return 'rgb(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ')'; }
  function bgOf(el) {   // fundo efetivo: compõe os fundos translúcidos dos ancestrais sobre o --deep
    const chain = []; let n = el, imagem = false;
    while (n && n.nodeType === 1) { const cs = getComputedStyle(n); const c = parse(cs.backgroundColor); if (cs.backgroundImage && cs.backgroundImage !== 'none') imagem = true; if (c && c[3] > 0) chain.push(c); if (c && c[3] >= .999) break; n = n.parentElement; }
    let acc = [rootBg[0], rootBg[1], rootBg[2], 1]; for (let i = chain.length - 1; i >= 0; i--) acc = over(chain[i], acc); return { c: acc, imagem };
  }
  const vis = el => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') return false; let n = el; while (n && n.nodeType === 1) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; n = n.parentElement; } return true; };
  const desc = el => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; else if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.'); return s; };
  const out = [], vistos = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let tn; while ((tn = walker.nextNode())) {
    const txt = tn.nodeValue.replace(/\s+/g, ' ').trim(); if (txt.length < 2) continue;
    const el = tn.parentElement; if (!el || /^(SCRIPT|STYLE|NOSCRIPT|OPTION)$/.test(el.tagName)) continue;
    if (!vis(el)) continue;
    const cs = getComputedStyle(el); let col = parse(cs.color); if (!col) continue;
    let op = 1, n = el; while (n && n.nodeType === 1) { op *= +getComputedStyle(n).opacity; n = n.parentElement; }
    const { c: bg, imagem } = bgOf(el);
    const fg = over([col[0], col[1], col[2], col[3] * op], bg);
    const r = ratio(fg, bg); const px = parseFloat(cs.fontSize); const bold = +cs.fontWeight >= 700; const grande = px >= 24 || (px >= 18.6 && bold);
    const min = grande ? 3 : 4.5;
    if (r < min) { const k = desc(el) + '|' + txt.slice(0, 20); if (vistos.has(k)) continue; vistos.add(k); out.push({ t: txt.slice(0, 50), el: desc(el), r: +r.toFixed(2), min, fg: cs.color, bg: 'rgb(' + bg.slice(0, 3).map(Math.round) + ')', px, imagem }); }
  }
  // campos de formulário (valor / placeholder)
  document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea,select').forEach(el => {
    if (!vis(el)) return; const cs = getComputedStyle(el); const col = parse(cs.color); const { c: bg } = bgOf(el); if (!col) return;
    const r = ratio(over(col, bg), bg); if (r < 4.5) out.push({ t: '[campo] ' + (el.placeholder || el.value || el.id || '').slice(0, 30), el: desc(el), r: +r.toFixed(2), min: 4.5, fg: cs.color, bg: 'rgb(' + bg.slice(0, 3).map(Math.round) + ')', px: parseFloat(cs.fontSize) });
  });
  // cor fixa no estilo inline que não se adapta (branco / preto puros)
  const fixas = []; document.querySelectorAll('[style]').forEach(el => { if (!vis(el)) return; const st = el.getAttribute('style') || ''; const m = st.match(/(?:^|;)\s*(?:color|background(?:-color)?)\s*:\s*(#fff(?:fff)?\b|#000(?:000)?\b|white|black|rgb\(255,\s*255,\s*255\)|rgb\(0,\s*0,\s*0\))/i); if (m) fixas.push({ el: desc(el), st: st.slice(0, 90), t: (el.textContent || '').trim().slice(0, 30) }); });
  const ov = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  return { baixo: out, fixas: fixas.slice(0, 15), overflow: ov };
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const CFG = [
    { nome: 'radar', url: 'http://localhost:8941/okr-dev.html', seed: seedOkr, setup: async p => { await p.evaluate(() => { _okrEntrarTorre('digital'); }); await p.waitForTimeout(800); },
      telas: [['objetivos', p => p.evaluate(() => _okrSetView('objetivos'))], ['historico', p => p.evaluate(() => _okrSetView('historico'))], ['calendario', p => p.evaluate(() => _okrSetView('calendario'))], ['notas', p => p.evaluate(() => _okrSetView('notas'))], ['cards', p => p.evaluate(() => _okrSetView('cards'))], ['datastudio', p => p.evaluate(() => _okrSetView('datastudio'))]] },
    { nome: 'painel', url: 'http://localhost:8941/painel-dev.html', seed: () => jc(seedPainel), setup: async p => { await new Function('p', 'return (async()=>{' + setupPainel + '})()')(p); },
      telas: ['visao', 'fluxo', 'timeline', 'pessoas', 'dados', 'monitor', 'notifs', 'status', 'agentes'].map(t => [t, p => p.evaluate(x => swPtab(x), t)]) },
  ];
  const resultado = {};
  for (const cfg of CFG) for (const tema of ['dark', 'light', 'vice']) for (const w of [1280, 390]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
    await ctx.addInitScript(t => { try { localStorage.setItem('mare_theme', t); localStorage.setItem('fish_bg_off', '1'); localStorage.setItem('mare_theme_auto', '0'); } catch (e) { } }, tema);
    await fake.install(ctx, cfg.seed());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto(cfg.url); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(2200);
    try { await cfg.setup(p); } catch (e) { errs.push('setup: ' + e.message); }
    const tAplicado = await p.evaluate(() => document.documentElement.getAttribute('data-theme') || 'dark');
    for (const [nome, fn] of cfg.telas) {
      try { await fn(p); await p.waitForTimeout(700); } catch (e) { errs.push(nome + ': ' + e.message); continue; }
      const r = await p.evaluate(SCAN);
      const key = `${cfg.nome}/${nome}/${w}/${tema}`;
      resultado[key] = { ...r, tema: tAplicado };
      await p.screenshot({ path: path.join(OUT, `${cfg.nome}_${nome}_${w}_${tema}.png`) });
    }
    resultado[`${cfg.nome}/ERROS/${w}/${tema}`] = { errs };
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'resultado.json'), JSON.stringify(resultado, null, 1));
  await b.close();
  console.log('ok', Object.keys(resultado).length);
})();
