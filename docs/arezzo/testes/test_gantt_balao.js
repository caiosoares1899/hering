// 💬 Gantt — balão do nome inteiro (13/11/2026): passar o mouse (ou focar pelo teclado) numa barra/nome de data-chave cujo texto
// NÃO cabe mostra o nome inteiro + as datas; texto que cabe não abre balão; no toque não aparece (lá vale o aviso do toque).
// Servir a raiz em BASE_URL; node docs/arezzo/testes/test_gantt_balao.js   (CAPTURE_DIR grava capturas)
const fs = require('node:fs'); const path = require('node:path'); const home = require('node:os').homedir();
const pwPath = process.env.PLAYWRIGHT_MODULE || (fs.existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const { chromium } = require(pwPath); const fake = require('./fakefb');
function resolveChrome() { if (process.env.CHROME) return process.env.CHROME; if (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) return '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const r = path.join(home, 'hering-tools/chrome'); const arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-')); return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'); }
const base = process.env.BASE_URL || 'http://127.0.0.1:8949'; const K = process.env.K || 'kanban-dev'; const SUF = K.endsWith('-dev') ? '_dev' : '';
const SQ = 'site'; const cap = process.env.CAPTURE_DIR || ''; const FIXO = '2026-11-12T13:00:00';
const fl = col => ({ enteredAt: { [col]: '2026-10-20T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-10-20T12:00:00.000Z' }] });
const LONGO = 'Campanha de fim de ano com um título comprido demais para caber numa barra de poucos dias';
const card = (id, title, ini, fim) => ({ id, title, col: 'doing', owner: 'MM', createdAt: '2026-10-20', flow: fl('doing'), inicio: ini, fim, updatedAt: '2026-10-27T10:00:00.000Z' });
const seed = () => ({ kanban: {
  usuarios: { mem: { uid: 'mem', nome: 'Mel', email: 'mem@ciahering.com.br', inscrito: true, init: 'MM', role: 'membro', squads: { [SQ]: true } } },
  usuarios_publicos: { mem: { uid: 'mem', nome: 'Mel', init: 'MM', squads: { [SQ]: true } } },
  squads: { [SQ]: { dados: { columns: [{ id: 'doing', name: 'Fazendo' }], tags: [], cards_index: { c1: 'k1', c2: 'k2', c3: 'k3' },
      cards: { k1: card('c1', LONGO, '2026-11-16', '2026-11-19'), k2: card('c2', 'Curto', '2026-11-02', '2026-11-28'), k3: card('c3', '<img src=x onerror="window.__xss=1"> Estreito', '2026-11-24', '2026-11-25') } },
    ['gantt_marcos' + SUF]: { m1: { titulo: 'Lançamento da coleção de verão com nome longo', ini: '2026-11-27', fim: '2026-11-27', cor: 'purple', porUid: 'x', em: 1 } } } },
  ['calendarios_gantt' + SUF]: { marca: { meta: { atualizadoEm: 1, porNome: 'Caio', arquivo: 'x.xlsx', de: '2026-01-01', ate: '2026-12-31' }, linhas: { web: { rot: 'Web', ordem: 1 } },
    barras: { b_w1: { linha: 'web', ini: '2026-11-20', fim: '2026-11-21', txt: 'CAMPANHA DE DOIS DIAS COM TEXTO GRANDE' } } } },
} });

(async () => {
  const b = await chromium.launch({ executablePath: resolveChrome(), headless: true }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 400))); };
  const abre = async vp => {
    const ctx = await b.newContext({ viewport: vp, hasTouch: vp.width < 1000, isMobile: vp.width < 1000 }); await fake.install(ctx, seed());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(f => { const R = Date; const fixed = new R(f).getTime(); class D extends R { constructor(...a) { if (!a.length) super(fixed); else super(...a); } static now() { return fixed; } } window.Date = D; try { localStorage.clear(); } catch (e) {} }, FIXO);
    await p.goto(base + '/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(() => window.__authCb({ uid: 'mem', email: 'mem@ciahering.com.br', displayName: 'Mel', photoURL: '', providerData: [{ providerId: 'google.com' }] })); await p.waitForTimeout(2500);
    await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); toggleGanttView(); }); await p.waitForTimeout(400);
    return { ctx, p, errs };
  };
  const balao = p => p.evaluate(() => { const e = document.getElementById('gantt-tip'); if (!e || !e.classList.contains('on')) return null; const r = e.getBoundingClientRect(); return { nome: (e.querySelector('.gantt-tip-nome') || {}).textContent, det: (e.querySelector('.gantt-tip-det') || {}).textContent, l: r.left, r: r.right, t: r.top, b: r.bottom, img: !!e.querySelector('img'), baixo: e.classList.contains('baixo') }; });
  const passa = async (p, sel) => { await p.mouse.move(2, 2); await p.waitForTimeout(80); const bx = await p.locator(sel).first().boundingBox(); await p.mouse.move(bx.x + Math.min(bx.width / 2, 40), bx.y + bx.height / 2); await p.waitForTimeout(420); };

  { const { ctx, p, errs } = await abre({ width: 1280, height: 900 });
    await passa(p, '.gantt-bar[data-card-id="c1"]'); let bl = await balao(p);
    t('A. barra com nome cortado: balão com o nome inteiro e as datas embaixo', bl && bl.nome === LONGO && /Período: 16\/11 → 19\/11/.test(bl.det), bl);
    t('B. balão dentro da tela e acima da barra; sem o title nativo junto (barra e linha)', bl && bl.l >= 8 && bl.r <= 1272 && bl.b <= (await p.locator('.gantt-bar[data-card-id="c1"]').boundingBox()).y && await p.evaluate(() => !document.querySelector('.gantt-bar[data-card-id="c1"]').hasAttribute('title') && !document.querySelector('.gantt-row[data-id="c1"]').hasAttribute('title') && document.querySelector('.gantt-bar[data-card-id="c1"]').getAttribute('aria-describedby') === 'gantt-tip'), bl);
    await p.mouse.move(2, 2); await p.waitForTimeout(250);
    t('C. ao sair, o balão some e o title volta', !(await balao(p)) && await p.evaluate(() => /Período/.test(document.querySelector('.gantt-bar[data-card-id="c1"]').getAttribute('title') || '') && !!document.querySelector('.gantt-row[data-id="c1"]').getAttribute('title')));
    await passa(p, '.gantt-bar[data-card-id="c2"]');
    t('D. nome que cabe inteiro na barra: sem balão', !(await balao(p)));
    await passa(p, '.gantt-bar[data-card-id="c3"]'); bl = await balao(p);
    t('E. barra estreita (nome fora dela): balão; HTML do título vira texto', bl && /<img src=x/.test(bl.nome) && !bl.img && await p.evaluate(() => !window.__xss), bl);
    await passa(p, '.gantt-mc-chip[data-id="m1"]'); bl = await balao(p);
    t('F. nome de data-chave cortado: balão com o nome e a data', bl && bl.nome === 'Lançamento da coleção de verão com nome longo' && /27\/11/.test(bl.det), bl);
    // teclado: foco visível numa barra cortada abre; Esc fecha
    await p.mouse.move(2, 2); await p.evaluate(() => document.querySelector('.gantt-row[data-id="c2"]').focus()); await p.keyboard.press('Tab'); await p.waitForTimeout(100);
    await p.evaluate(() => { const r = document.querySelector('.gantt-mc-chip[data-id="m1"]'); r.focus(); });
    await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Tab'); await p.waitForTimeout(150);
    t('G. teclado: foco visível no nome cortado abre o balão', !!(await balao(p)));
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    t('H. Esc fecha o balão', !(await balao(p)));
    await p.evaluate(() => ganttAba('marca')); await p.waitForTimeout(300);
    await passa(p, '.gantt-cal-bar[data-id="b_w1"]'); bl = await balao(p);
    t('I. aba de Marca: barra de 2 dias com texto cortado → balão com texto, datas e linha', bl && bl.nome === 'CAMPANHA DE DOIS DIAS COM TEXTO GRANDE' && /20\/11 – 21\/11 · Web/.test(bl.det), bl);
    await p.evaluate(() => renderBoard()); await p.waitForTimeout(150);
    t('J. redesenho do board (Firebase) fecha o balão em vez de deixá-lo preso', !(await balao(p)));
    // perto do topo da tela: abre para baixo
    await p.evaluate(() => { document.getElementById('gantt-view').scrollIntoView(); window.scrollBy(0, 300); }); await p.waitForTimeout(150);
    const y = await p.evaluate(() => document.querySelector('.gantt-mc-chip[data-id="m1"]') ? 1 : 0);
    await p.evaluate(() => ganttAba('cards')); await p.waitForTimeout(300);
    await p.mouse.move(2, 2); await p.waitForTimeout(100);   // o cursor fora do Gantt: o transform não pode passar elementos por baixo dele
    // leva o rótulo para perto do topo da tela (a página do Maré não rola pelo window): desloca a visão com transform
    await p.evaluate(() => { const c = document.querySelector('.gantt-mc-chip[data-id="m1"]'); const v = document.getElementById('gantt-view'); v.style.transform = 'translateY(' + (20 - c.getBoundingClientRect().top) + 'px)'; }); await p.waitForTimeout(150);
    // (no topo o cabeçalho fixo da página cobre o rótulo para o mouse; aqui o que se testa é o posicionamento)
    await p.evaluate(() => _ganttTipMostrar(document.querySelector('.gantt-mc-chip[data-id="m1"]'))); await p.waitForTimeout(200); bl = await balao(p);
    t('K. perto do topo da tela o balão abre para baixo (sem sair da tela)', y && bl && bl.baixo && bl.t >= 8, bl);
    await p.evaluate(() => { document.getElementById('gantt-view').style.transform = ''; });
    if (cap) { for (const th of ['', 'light', 'vice']) { await p.evaluate(x => document.documentElement.dataset.theme = x, th); await passa(p, '.gantt-bar[data-card-id="c1"]'); await p.screenshot({ path: path.join(cap, `balao_${th || 'dark'}.png`) }); } }
    t('L. sem erro de JS', errs.length === 0, errs);
    await ctx.close(); }
  { const { ctx, p } = await abre({ width: 390, height: 800 });
    await p.locator('.gantt-bar[data-card-id="c1"]').first().scrollIntoViewIfNeeded(); await p.tap('.gantt-bar[data-card-id="c1"]').catch(() => {}); await p.waitForTimeout(400);
    t('M. celular (toque): o balão não aparece (lá o toque abre o card / o aviso)', !(await balao(p)));
    await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1);
})();
