// 📝 Travessia — avaliação com rascunho e progresso (T7 da consultoria, 11/11/2026): rascunho das respostas no aparelho (localStorage, chave com o uid),
// recuperado depois de recarregar/trocar de aba, apagado ao salvar e ao sair da conta; contador "X de N respondidas"; aviso ao sair com texto não salvo.
// Rodar: python3 -m http.server 8961 --directory . (na raiz) e `node docs/arezzo/testes/test_travessia_rascunho.js` (BASE_URL troca o servidor).
const fs = require('fs'), path = require('path'), home = require('os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const cr = path.join(home, 'hering-tools/chrome'), chrome = process.env.CHROME || path.join(cr, fs.readdirSync(cr).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8961', out = path.join(__dirname, '..', '..', 'capturas', 'travessia-rascunho');
(async () => {
  const b = await chromium.launch({ executablePath: chrome }); let falhas = 0, total = 0;
  const t = (n, c, d) => { total++; if (!c) falhas++; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  fs.mkdirSync(out, { recursive: true });
  const ir = async (p, como) => { await p.goto(base + '/travessia-dev.html?demo=1&como=' + como + '&tab=aval'); await p.waitForSelector('#app .h1', { timeout: 8000 }); await p.waitForSelector('textarea[data-resp="auto"]', { timeout: 8000 }); await p.waitForTimeout(400); };
  const chave = como => 'travessia_rasc_dev_demo_' + como;

  for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 800 }]) { const r = vp.width + 'px';
    const ctx = await b.newContext({ viewport: vp }); await fake.install(ctx, {}); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    const dialogos = []; p.on('dialog', d => { dialogos.push(d.type()); d.accept().catch(() => {}); });
    await ir(p, 'ana');
    const info = await p.evaluate(() => { const ts = [...document.querySelectorAll('textarea[data-resp="auto"]:not([readonly])')]; const vazio = ts.find(x => !x.value.trim()); const prog = document.querySelector('[data-prog="auto"]');
      return { n: ts.length, feitas: ts.filter(x => x.value.trim()).length, vazio: vazio && vazio.id, prog: prog && prog.textContent }; });
    t(r + ': contador "X de N respondidas" na autoavaliação', info.prog === info.feitas + ' de ' + info.n + ' respondidas', info);
    const id = info.vazio; t(r + ': há uma pergunta em branco para o teste', !!id, info);
    await p.click('#' + id); await p.keyboard.type('Rascunho do teste T7 — evoluí em SQL', { delay: 2 }); await p.waitForTimeout(900);
    const d1 = await p.evaluate(([id, k]) => ({ st: [...document.querySelectorAll('[data-rasc-st="auto"]')].map(x => x.textContent).join(''), ls: JSON.parse(localStorage.getItem(k) || '{}')[id], prog: document.querySelector('[data-prog="auto"]').textContent }), [id, chave('ana')]);
    t(r + ': depois da pausa: "Rascunho guardado neste aparelho" e o texto no localStorage (chave com o uid)', /Rascunho guardado neste aparelho/.test(d1.st) && d1.ls && /evoluí em SQL/.test(d1.ls.v), d1);
    t(r + ': o contador sobe na hora', d1.prog === (info.feitas + 1) + ' de ' + info.n + ' respondidas', d1.prog);
    if (vp.width === 390) await p.screenshot({ path: path.join(out, 'rascunho-390.png'), clip: await p.locator('[data-rasc-st="auto"]').first().evaluate(e => { const s = e.closest('.foco').getBoundingClientRect(); return { x: s.x, y: Math.max(0, s.y + scrollY + s.height - 360), width: s.width, height: 360 }; }) }).catch(() => {});
    // trocar de aba e voltar (o render apaga o DOM) → volta o texto
    await p.click('[data-tab="bau"]'); await p.waitForTimeout(500); await p.click('[data-tab="aval"]'); await p.waitForSelector('#' + id); await p.waitForTimeout(400);
    t(r + ': trocar de aba e voltar mantém o texto', /evoluí em SQL/.test(await p.inputValue('#' + id)), await p.inputValue('#' + id));
    // recarregar (beforeunload pede confirmação) → recupera do aparelho
    await p.reload(); await p.waitForSelector('#app .h1'); await p.waitForTimeout(300);
    t(r + ': sair com texto não salvo pede confirmação (beforeunload)', dialogos.includes('beforeunload'), dialogos);
    if (!(await p.locator('#' + id).count())) { await p.click('[data-tab="aval"]').catch(() => {}); }
    await p.waitForSelector('#' + id); await p.waitForTimeout(400);
    const d2 = await p.evaluate(id => ({ v: document.getElementById(id).value, st: [...document.querySelectorAll('[data-rasc-st="auto"]')].map(x => x.textContent).join('') }), id);
    t(r + ': depois de recarregar, o rascunho volta com o aviso "recuperado"', /evoluí em SQL/.test(d2.v) && /recuperado/.test(d2.st), d2);
    // outra conta no mesmo navegador não vê
    await p.selectOption('#demo-persona', 'bia'); await p.waitForTimeout(400); await p.click('[data-tab="aval"]').catch(() => {}); await p.waitForTimeout(600);
    t(r + ': outra pessoa no mesmo navegador não vê o rascunho da Ana', await p.evaluate(() => ![...document.querySelectorAll('textarea')].some(x => /evoluí em SQL/.test(x.value))), '');
    await p.selectOption('#demo-persona', 'ana'); await p.waitForTimeout(400); await p.click('[data-tab="aval"]').catch(() => {}); await p.waitForSelector('#' + id); await p.waitForTimeout(400);
    // salvar → rascunho apagado
    await p.click('[data-act="auto-salvar"]'); await p.waitForTimeout(700);
    const d3 = await p.evaluate(([id, k]) => ({ ls: localStorage.getItem(k), v: document.getElementById(id) && document.getElementById(id).value }), [id, chave('ana')]);
    t(r + ': salvar grava no banco e apaga o rascunho do aparelho', !d3.ls && /evoluí em SQL/.test(d3.v || ''), d3);
    dialogos.length = 0; await p.reload(); await p.waitForSelector('#app .h1'); await p.waitForTimeout(300);
    t(r + ': depois de salvar, recarregar não pede confirmação', !dialogos.includes('beforeunload'), dialogos);
    // rascunho mais velho que o salvo no banco (ex.: salvo em outro aparelho depois) é descartado
    await p.evaluate(([id, k]) => localStorage.setItem(k, JSON.stringify({ [id]: { v: 'rascunho velho', ts: 1 } })), [id, chave('ana')]);
    if (!(await p.locator('#' + id).count())) await p.click('[data-tab="aval"]'); await p.waitForSelector('#' + id); await p.evaluate(() => window.Travessia.render()); await p.waitForTimeout(500);
    const d4 = await p.evaluate(([id, k]) => ({ v: document.getElementById(id).value, ls: localStorage.getItem(k) }), [id, chave('ana')]);
    t(r + ': rascunho mais velho que o salvo é descartado (não sobrescreve)', !/rascunho velho/.test(d4.v) && !d4.ls, d4);
    t(r + ': sem rolagem lateral e sem erro de JS', (await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)) && !errs.length, errs);
    await ctx.close(); }

  // sair da conta apaga o rascunho (com confirmação se houver)
  { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, {}); const p = await ctx.newPage(); p.on('dialog', d => d.accept().catch(() => {}));
    await ir(p, 'ana'); const id = await p.evaluate(() => [...document.querySelectorAll('textarea[data-resp="auto"]:not([readonly])')].find(x => !x.value.trim()).id);
    await p.fill('#' + id, 'texto para sair'); await p.waitForTimeout(900);
    const antes = await p.evaluate(k => !!localStorage.getItem(k), chave('ana'));
    await p.evaluate(() => { const b = document.getElementById('btn-sair'); if (b) b.click(); }); await p.waitForTimeout(400);
    const conf = await p.evaluate(() => { const o = [...document.querySelectorAll('button')].find(x => /^Sair$/.test(x.textContent.trim()) && x.offsetParent); return o ? (o.click(), true) : false; }); await p.waitForTimeout(500);
    const depois = await p.evaluate(k => localStorage.getItem(k), chave('ana'));
    t('sair da conta: pede confirmação e apaga o rascunho', antes && conf && !depois, { antes, conf, depois });
    await ctx.close(); }

  await b.close(); console.log(`\n${total - falhas}/${total} ok`); process.exit(falhas ? 1 : 0);
})();
