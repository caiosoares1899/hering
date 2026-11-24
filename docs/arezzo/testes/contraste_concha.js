// Contraste do texto da Concha sobre o vidro com o mar atrás (o pior pixel do fundo da conversa, peixes e horizonte inclusos), nos 3 temas.
// Esconde o texto, fotografa o fundo, acha o pixel mais "parecido" com cada cor de texto e calcula a razão WCAG. Uso: node docs/arezzo/testes/contraste_concha.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir(); const fake = require('./fakefb.js');
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const agora = Date.now(); const msgs = {}; for (let i = 0; i < 12; i++) msgs['-Nc' + String(i).padStart(2, '0')] = { uid: i % 2 ? 'bru' : 'ana', ts: agora - (40 - i) * 60000, texto: 'linha ' + i };
const seed = { kanban: { usuarios: { ana: { role: 'membro', squads: { dados: true } } }, usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana Lima', init: 'AL' }, bru: { uid: 'bru', nome: 'Bruno Reis', init: 'BR' } }, cardume: { canais: { dados: { nome: 'Dados' } }, membros: { dados: { ana: true, bru: true } }, meus: { ana: { dados: true } }, msgs: { dados: msgs } } } };
const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
const razao = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const b = await chromium.launch({ executablePath: process.env.CHROME }); let pior = Infinity; const linhas = [];
  for (const tema of ['abrolhos', 'lencois', 'entardecer']) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed);
    await ctx.addInitScript(t => localStorage.setItem('oceano_prefs', JSON.stringify({ tema: t, peixes: 'normal' })), tema);
    if (process.env.PAGINA_ALT) { const h = fs.readFileSync(process.env.PAGINA_ALT, 'utf8'); await ctx.route('**/cardume-dev.html*', r => r.fulfill({ body: h, contentType: 'text/html' })); }
    const p = await ctx.newPage(); await p.goto('http://127.0.0.1:8941/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(1200);
    const cores = await p.evaluate(() => { const cs = getComputedStyle(document.documentElement), rgb = v => { const d = document.createElement('i'); d.style.color = v; document.body.append(d); const c = getComputedStyle(d).color.match(/[\d.]+/g).map(Number); d.remove(); return c; };
      return { texto: rgb(cs.getPropertyValue('--txt')), 'hora/subtítulo (--txt2)': rgb(cs.getPropertyValue('--txt2')), 'menção/link (--accent-txt)': rgb(cs.getPropertyValue('--accent-txt') || cs.getPropertyValue('--accent')) }; });
    for (const [regiao, sel] of [['conversa', '#log'], ['lista de canais', '.lateral'], ['detalhes', '#lado'], ['cabeçalho', '.cabecalho'], ['rodapé', '.rodape']]) {
    const caixa = await p.evaluate(sl => { const e = document.querySelector(sl); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); const m = 16; return r.width > 2 * m ? { x: r.x + m, y: r.y + m, width: r.width - 2 * m, height: r.height - 2 * m } : null; }, sel);   // longe do canto arredondado e da borda: lá não há texto e aparece o mar de fora
    if (!caixa) { linhas.push({ tema, regiao, cor: '—', 'pior razão': 'fechado', AA: '—' }); continue; }
    // várias posições do cardume: pior caso ao longo do tempo
    let fundos = [];
    for (let k = 0; k < 4; k++) {
      await p.addStyleTag({ content: sel + ' *{visibility:hidden!important}' });   // só o fundo da região (vidro + mar atrás): o piso onde o texto é escrito
      await p.evaluate(k => document.getAnimations().forEach(a => { a.pause(); a.currentTime = (a.currentTime || 0) + k * 3700; }), k);
      const png = (await p.screenshot({ clip: caixa })).toString('base64');
      const px = await p.evaluate(async src => { const im = new Image(); im.src = 'data:image/png;base64,' + src; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; const out = []; for (let i = 0; i < d.length; i += 4 * 7) out.push([d[i], d[i + 1], d[i + 2]]); return out; }, png);
      fundos = fundos.concat(px);
    }
    for (const [nome, cor] of Object.entries(cores)) { let r = Infinity; const a = cor.length > 3 ? cor[3] : 1; for (const f of fundos) { const c = cor.slice(0, 3).map((v, i) => v * a + f[i] * (1 - a)); const x = razao(c, f); if (x < r) r = x; } pior = Math.min(pior, r); linhas.push({ tema, regiao, cor: nome, 'pior razão': +r.toFixed(2), AA: r >= 4.5 ? '✅' : r >= 3 ? '≥3 (só texto grande)' : '❌' }); }
    await p.reload(); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(1000);   // tira o estilo de medir antes da próxima região
    }
    await ctx.close();
  }
  console.table(linhas); await b.close();
  if (process.env.EXIGIR && linhas.some(l => typeof l['pior razão'] === 'number' && l['pior razão'] < 4.5)) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
