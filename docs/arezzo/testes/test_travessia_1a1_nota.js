// 🤝 Travessia — 1:1 com "O que combinamos" (T1 etapa A da consultoria, 11/11/2026): o registro do 1:1 ganha um campo de até 280 caracteres,
// gravado em `nota` (a regra do banco já aceitava), e a nota aparece nos dois lados: no Início da pessoa e no detalhe da pessoa na Frota do líder.
// Rodar: python3 -m http.server 8961 --directory . (na raiz) e `node docs/arezzo/testes/test_travessia_1a1_nota.js` (BASE_URL troca o servidor).
const fs = require('fs'), path = require('path'), home = require('os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const cr = path.join(home, 'hering-tools/chrome'), chrome = process.env.CHROME || path.join(cr, fs.readdirSync(cr).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8961', out = path.join(__dirname, '..', '..', 'capturas', 'travessia-1a1-nota');
(async () => {
  const b = await chromium.launch({ executablePath: chrome }); let falhas = 0, total = 0;
  const t = (n, c, d) => { total++; if (!c) falhas++; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  fs.mkdirSync(out, { recursive: true });
  for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 800 }]) {
    const r = vp.width + 'px'; const ctx = await b.newContext({ viewport: vp }); await fake.install(ctx, {}); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/travessia-dev.html?demo=1&como=ana'); await p.waitForSelector('#app .h1', { timeout: 8000 }); await p.waitForTimeout(600);
    t(r + ': campo "O que combinamos" no registro do 1:1, com limite de 280', await p.locator('#enc-n').evaluate(e => e.maxLength === 280 && /combinamos/i.test(e.placeholder) && !!document.querySelector('label[for="enc-n"]')), '');
    t(r + ': "Últimos 1:1" mostra até 3 registros, com as notas da demo', await p.evaluate(() => { const h = [...document.querySelectorAll('#painel h3')].find(x => /Últimos 1:1/.test(x.textContent)); const ul = h && h.nextElementSibling; return !!ul && ul.querySelectorAll('li').length === 3 && ul.querySelectorAll('.enc-nota').length >= 1; }), '');
    const nota = '<b>Combinamos</b> revisar o painel ' + 'x'.repeat(300);
    await p.fill('#enc-n', nota); await p.click('form[data-form="encontro"] button[type="submit"]'); await p.waitForTimeout(700);
    const li = await p.evaluate(() => { const h = [...document.querySelectorAll('#painel h3')].find(x => /Últimos 1:1/.test(x.textContent)); const l = h && h.nextElementSibling.querySelector('li'); return l ? { txt: l.innerText, html: l.querySelector('.enc-nota') && l.querySelector('.enc-nota').innerHTML, b: !!l.querySelector('.enc-nota b'), nota: l.querySelector('.enc-nota') && l.querySelector('.enc-nota').textContent, del: !!l.querySelector('[data-act="enc-del"]') } : null; });
    t(r + ': o registro novo aparece no topo com a nota, cortada em 280 e como texto (sem HTML)', li && /por você/.test(li.txt) && !li.b && li.html.includes('&lt;b&gt;') && li.nota.replace(/^📝 /, '').length === 280 && li.del, li);
    t(r + ': campo limpo depois de salvar', (await p.inputValue('#enc-n')) === '', '');
    t(r + ': sem rolagem lateral e sem erro de JS', (await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)) && !errs.length, errs);
    await p.screenshot({ path: path.join(out, 'pessoa-' + vp.width + '.png'), fullPage: false });
    // registro sem nota continua valendo (e não grava campo vazio)
    await p.click('form[data-form="encontro"] button[type="submit"]'); await p.waitForTimeout(700);
    const semNota = await p.evaluate(() => { const h = [...document.querySelectorAll('#painel h3')].find(x => /Últimos 1:1/.test(x.textContent)); const l = h.nextElementSibling.querySelector('li'); return { nota: !!l.querySelector('.enc-nota'), txt: l.innerText }; });
    t(r + ': registrar sem nota segue funcionando (sem linha 📝 vazia)', !semNota.nota && /por você/.test(semNota.txt), semNota);
    // o líder (Pau) vê a nota da Ana no detalhe da Frota — mesma aba, a demo guarda o que foi gravado
    await p.selectOption('#demo-persona', 'pau'); await p.waitForTimeout(600);
    await p.click('[data-tab="frota"]'); await p.waitForTimeout(600);
    await p.click('[data-act="abrir"][data-uid="ana"]'); await p.waitForTimeout(700);
    const lider = await p.evaluate(() => { const d = document.querySelector('#detalhe'); if (!d) return null; const notas = [...d.querySelectorAll('.enc-nota')].map(x => x.textContent); return { notas, campo: !!d.querySelector('#enc-n2[maxlength="280"]'), apagarDaAna: [...d.querySelectorAll('li')].filter(l => /por Ana/.test(l.innerText) && l.querySelector('[data-act="enc-del"]')).length }; });
    t(r + ': o líder vê a nota da pessoa no detalhe da Frota e tem o mesmo campo', lider && lider.campo && lider.notas.some(n => n.includes('<b>Combinamos</b>')), lider);
    t(r + ': o líder não tem 🗑 no registro feito pela pessoa (só quem escreveu apaga)', lider && lider.apagarDaAna === 0, lider);
    await p.fill('#enc-n2', 'Líder: combinamos mentoria com a Bia'); await p.click('#detalhe form[data-form="encontro"] button[type="submit"]'); await p.waitForTimeout(700);
    t(r + ': nota do líder aparece no detalhe', await p.evaluate(() => [...document.querySelectorAll('#detalhe .enc-nota')].some(x => /mentoria com a Bia/.test(x.textContent))), '');
    if (vp.width === 1280) await p.screenshot({ path: path.join(out, 'lider-1280.png'), fullPage: false });
    t(r + ': sem erro de JS no fim', !errs.length, errs);
    await ctx.close();
  }
  await b.close(); console.log(`\n${total - falhas}/${total} ok`); process.exit(falhas ? 1 : 0);
})();
