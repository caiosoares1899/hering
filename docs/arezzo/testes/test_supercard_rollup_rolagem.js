// 🧩 Supercard no board: com muitos filhos a lista ROLA dentro do card (antes cortava em 6 com "+N mais...") — pedido do Caio, 12/11/2026.
// Boot REAL com Firebase falso. Servir a raiz em BASE_URL; node docs/arezzo/testes/test_supercard_rollup_rolagem.js
// MAIN_HTML=<arquivo> roda contra outra versão (ex.: a da main) para provar que o teste falha nela.
const fs = require('node:fs'); const path = require('node:path'); const home = require('node:os').homedir();
const pwPath = process.env.PLAYWRIGHT_MODULE || (fs.existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const { chromium } = require(pwPath); const fake = require('./fakefb');
function resolveChrome() { if (process.env.CHROME) return process.env.CHROME; if (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) return '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const r = path.join(home, 'hering-tools/chrome'); const arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-')); return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'); }
const base = process.env.BASE_URL || 'http://127.0.0.1:8949'; const K = process.env.K || 'kanban-dev'; const SQ = 'site';
const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const fl = col => ({ enteredAt: { [col]: '2026-10-20T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-10-20T12:00:00.000Z' }] });
const C = (id, t, extra) => Object.assign({ id, title: t, col: 'doing', owner: 'AA', createdAt: '2026-10-20', flow: fl('doing'), updatedAt: '2026-10-27T10:00:00.000Z' }, extra || {});
const seed = () => { const cards = {}, idx = {}; const add = c => { const k = 'k_' + c.id; cards[k] = c; idx[c.id] = k; };
  const muitos = Array.from({ length: 15 }, (_, i) => 'm' + i); const poucos = ['q0', 'q1', 'q2'];
  add(C('big', 'Campanha com 15 filhos', { childCardIds: muitos })); add(C('small', 'Campanha com 3 filhos', { childCardIds: poucos }));
  muitos.forEach((id, i) => add(C(id, 'Filho ' + (i + 1) + ' da campanha grande', i % 4 === 0 ? { col: 'done' } : {})));
  poucos.forEach((id, i) => add(C(id, 'Filho pequeno ' + (i + 1))));
  return { kanban: { usuarios: { ana: { uid: 'ana', nome: 'Ana', email: U.email, inscrito: true, init: 'AA', role: 'adm', squads: { [SQ]: true } } }, usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana', init: 'AA', role: 'adm', squads: { [SQ]: true } } }, config: { adm_emails: [U.email] },
    squads: { [SQ]: { dados: { columns: [{ id: 'doing', name: 'Fazendo' }, { id: 'done', name: 'Concluído', isDone: true }], tags: [], cards_index: idx, cards } } } } }; };
(async () => { const b = await chromium.launch({ executablePath: resolveChrome(), headless: true }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 800 }]) {
    const ctx = await b.newContext({ viewport: vp, hasTouch: vp.width < 1000, isMobile: vp.width < 1000 }); await fake.install(ctx, seed());
    if (process.env.MAIN_HTML) { const html = fs.readFileSync(process.env.MAIN_HTML, 'utf8'); await ctx.route(u => u.pathname.endsWith('/' + K + '.html'), r => r.fulfill({ status: 200, contentType: 'text/html', body: html })); }
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(3000);
    await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')));
    const L = vp.width + 'px';
    const info = await p.evaluate(() => { const card = id => document.querySelector(`.card[data-id="${id}"]`) || [...document.querySelectorAll('.card')].find(c => c.innerText.includes(id === 'big' ? 'Campanha com 15' : 'Campanha com 3'));
      const g = card('big'), s = card('small'); const lg = g && g.querySelector('.super-rollup-list'), ls = s && s.querySelector('.super-rollup-list');
      return { temG: !!g, rowsG: g ? g.querySelectorAll('.super-rollup-row').length : 0, rowsS: s ? s.querySelectorAll('.super-rollup-row').length : 0, maisTxt: g ? /\+\d+ mais/.test(g.innerText) : null,
        rola: lg ? { sh: lg.scrollHeight, ch: lg.clientHeight, ov: getComputedStyle(lg).overflowY, ob: getComputedStyle(lg).overscrollBehaviorY } : null, pequenoRola: ls ? ls.scrollHeight > ls.clientHeight + 1 : null, hd: g ? g.querySelector('.super-rollup-hd').innerText : '' }; });
    t(`A ${L}. supercard grande mostra os 15 filhos (sem "+N mais")`, info.rowsG === 15 && info.maisTxt === false, info);
    t(`B ${L}. a lista do grande rola dentro do card (altura limitada, overflow auto, sem vazar pra coluna)`, !!info.rola && info.rola.sh > info.rola.ch + 20 && info.rola.ch <= 130 && info.rola.ov === 'auto' && info.rola.ob === 'contain', info.rola);
    t(`C ${L}. supercard com 3 filhos não ganha rolagem`, info.rowsS === 3 && info.pequenoRola === false, info);
    t(`D ${L}. cabeçalho continua com o total`, /4\/15/.test(info.hd), info.hd);
    // rola até o último filho e confirma que ele fica visível e clicável
    const ultimo = await p.evaluate(() => { const l = [...document.querySelectorAll('.super-rollup-list')].find(x => x.querySelectorAll('.super-rollup-row').length === 15); l.scrollTop = l.scrollHeight; l.dispatchEvent(new Event('scroll')); const r = l.querySelectorAll('.super-rollup-row')[14]; const a = r.getBoundingClientRect(), bx = l.getBoundingClientRect(); return { dentro: a.top >= bx.top - 1 && a.bottom <= bx.bottom + 1, st: l.scrollTop, oc: r.getAttribute('onclick') }; });
    t(`E ${L}. rolando até o fim, o 15º filho fica visível e abre o próprio card`, ultimo.dentro && ultimo.st > 0 && /openCard\(["']m14["']\)/.test(ultimo.oc || ''), ultimo);
    await p.evaluate(() => renderBoard()); await p.waitForTimeout(150);
    const st2 = await p.evaluate(() => { const l = [...document.querySelectorAll('.super-rollup-list')].find(x => x.querySelectorAll('.super-rollup-row').length === 15); return l ? l.scrollTop : -1; });
    t(`F ${L}. a posição da rolagem sobrevive ao re-render do board`, Math.abs(st2 - ultimo.st) <= 2, { antes: ultimo.st, depois: st2 });
    t(`G ${L}. sem rolagem lateral e sem erro de JS`, await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1) && errs.length === 0, errs);
    if (process.env.CAPTURE_DIR) { const el = p.locator('.card.supercard').first(); await el.screenshot({ path: path.join(process.env.CAPTURE_DIR, `supercard_rolagem_${vp.width}.png`) }); }
    await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1); })();
