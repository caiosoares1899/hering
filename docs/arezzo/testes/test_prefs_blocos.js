// 🧩 Minhas Preferências em blocos (16/11/2026, pedido do Caio): cada área num bloco com fundo um tom acima do painel,
// nos 3 temas e em 1280/390 px. Servir a raiz em BASE_URL (padrão http://127.0.0.1:8949); node docs/arezzo/testes/test_prefs_blocos.js
// CAPTURE_DIR=docs/capturas/prefs_blocos grava as capturas.
const fs = require('node:fs'); const path = require('node:path'); const home = require('node:os').homedir();
const pwPath = process.env.PLAYWRIGHT_MODULE || (fs.existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const { chromium } = require(pwPath); const fake = require('./fakefb');
function resolveChrome() { if (process.env.CHROME) return process.env.CHROME; if (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) return '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const r = path.join(home, 'hering-tools/chrome'); const arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-')); return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'); }
const base = process.env.BASE_URL || 'http://127.0.0.1:8949'; const cap = process.env.CAPTURE_DIR || '';
const SQ = 'site'; const U = { uid: 'mem', nome: 'Mel Membro', email: 'mem@ciahering.com.br', init: 'MM', role: 'membro', squads: { [SQ]: true } };
const seed = () => ({ kanban: { config: { adm_emails: ['adm@ciahering.com.br'] }, usuarios: { mem: Object.assign({ inscrito: true }, U) },
  usuarios_publicos: { mem: { uid: 'mem', nome: U.nome, init: 'MM', squads: U.squads } },
  squads: { [SQ]: { dados: { columns: [{ id: 'doing', name: 'Fazendo' }], tags: [], cards_index: {}, cards: {} } } } } });
const lum = c => { const m = c.match(/[\d.]+/g).map(Number); const [r, g, b] = m.slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
(async () => {
  const b = await chromium.launch({ executablePath: resolveChrome(), headless: true }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d ?? null).slice(0, 400))); };
  for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 820 }]) for (const tema of ['dark', 'light', 'vice']) {
    const ctx = await b.newContext({ viewport: vp, hasTouch: vp.width < 1000, isMobile: vp.width < 1000 }); await fake.install(ctx, seed());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
    await p.goto(base + '/kanban-dev.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(x => window.__authCb(x), { uid: U.uid, email: U.email, displayName: U.nome, photoURL: '', providerData: [{ providerId: 'google.com' }] });
    await p.waitForTimeout(2600);
    await p.evaluate(tm => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); if (tm === 'dark') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', tm); openMinhasPrefs(); }, tema);
    await p.waitForTimeout(300);
    const m = await p.evaluate(() => {
      const body = document.getElementById('minhasprefs-body'), blocos = [...body.querySelectorAll('.mp-bloco')];
      const titulos = blocos.map(x => (x.querySelector('.cfg-sec-title') || {}).textContent || '');
      const solto = [...body.querySelectorAll('.cfg-sec-title')].filter(x => !x.closest('.mp-bloco')).length;
      const painel = getComputedStyle(document.querySelector('#minhasprefs-ov .panel')).backgroundColor, bloco = getComputedStyle(blocos[0]).backgroundColor;
      const r = blocos.map(x => x.getBoundingClientRect()); const gaps = r.slice(1).map((x, i) => Math.round(x.top - r[i].bottom));
      return { n: blocos.length, titulos, solto, painel, bloco, gaps, over: body.scrollWidth - body.clientWidth };
    });
    const nome = `${vp.width} ${tema}`;
    t(`${nome}: 7 blocos (rotina + recusadas juntas), nenhum título solto`, m.n === 7 && m.solto === 0 && /Sugestões de rotina/.test(m.titulos[6]), m);
    t(`${nome}: bloco com fundo diferente do painel`, m.bloco !== 'rgba(0, 0, 0, 0)' && m.bloco !== m.painel, m);
    t(`${nome}: espaço igual entre blocos (10 px) e sem rolagem lateral`, m.gaps.every(g => g === 10) && m.over <= 0, m);
    t(`${nome}: sem erro de JS`, errs.length === 0, errs);
    if (cap) { fs.mkdirSync(cap, { recursive: true }); await p.screenshot({ path: path.join(cap, `prefs_${vp.width}_${tema}.png`) }); }
    await ctx.close();
  }
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1);
})();
