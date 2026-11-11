// 🧭 Travessia — cultura Hering (11/11/2026, pedido do Caio): as 5 atitudes do A Bordo no 1:1 ("atitude em foco") e na avaliação
// (autoavaliação, par e líder, num nó irmão `atitudes/` para o prod não apagar). Também: resumo do time na Frota, interruptor por ciclo no Admin.
// Roda no modo demonstração (grava só na memória da aba; `window.Travessia.demoMem` mostra o que foi "gravado").
// Rodar: python3 -m http.server 8961 --directory . (na raiz) e `node docs/arezzo/testes/test_travessia_cultura.js` (BASE_URL troca o servidor).
const fs = require('fs'), path = require('path'), home = require('os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const cr = path.join(home, 'hering-tools/chrome'), chrome = process.env.CHROME || path.join(cr, fs.readdirSync(cr).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8961', out = path.join(__dirname, '..', '..', 'capturas', 'travessia-cultura');
(async () => {
  const b = await chromium.launch({ executablePath: chrome }); let falhas = 0, total = 0;
  const t = (n, c, d) => { total++; if (!c) falhas++; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  fs.mkdirSync(out, { recursive: true });
  const abre = async (qs, vp, tema) => { const ctx = await b.newContext({ viewport: vp || { width: 1280, height: 900 } }); await fake.install(ctx, {}); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/travessia-dev.html?demo=1' + qs); await p.waitForSelector('#app .h1', { timeout: 8000 }); await p.waitForTimeout(800);
    if (tema) { await p.evaluate(x => document.documentElement.setAttribute('data-theme', x), tema); await p.waitForTimeout(500); } return { ctx, p, errs }; };
  const mem = (p, cam) => p.evaluate(c => c.split('/').reduce((o, k) => (o == null ? o : o[k]), window.Travessia.demoMem), cam);
  const T = 'kanban/travessia/', CID = 'c2026s2';

  // 1) 1:1 com atitude em foco
  { const { ctx, p, errs } = await abre('&como=ana');
    const g = '[aria-labelledby="t-um"] [data-at-grupo="enc"]';
    t('1:1: os 5 botões de atitude, com o nome visível (não só emoji)', await p.locator(g + ' .at-op').evaluateAll(l => l.length === 5 && l.every(e => e.textContent.trim().length > 6)), '');
    await p.click(g + ' [data-at="cardume"]'); await p.click(g + ' [data-at="legado"]');
    t('1:1: só uma atitude por vez (a segunda troca a primeira)', (await p.locator(g + ' [aria-pressed="true"]').count()) === 1 && (await p.getAttribute(g + ' [data-at="legado"]', 'aria-pressed')) === 'true', '');
    await p.click('[data-tab="bau"]'); await p.waitForTimeout(300); await p.click('[data-tab="inicio"]'); await p.waitForTimeout(500);
    t('1:1: a escolha sobrevive a trocar de aba antes de salvar', (await p.getAttribute(g + ' [data-at="legado"]', 'aria-pressed')) === 'true', '');
    await p.click('[aria-labelledby="t-um"] form button[type="submit"]'); await p.waitForTimeout(600);
    const encs = Object.values((await mem(p, T + 'encontros/ana')) || {}).sort((a, b) => b.ts - a.ts);
    t('1:1: grava `at` no registro e mostra o chip na lista', encs[0].at === 'legado' && /Legado em evolução/.test(await p.locator('[aria-labelledby="t-um"] .lst li').first().innerText()), encs[0]);
    t('1:1: depois de salvar, a escolha volta a zero', (await p.locator(g + ' [aria-pressed="true"]').count()) === 0, '');
    await p.click('[aria-labelledby="t-um"] form button[type="submit"]'); await p.waitForTimeout(600);
    const e2 = Object.values(await mem(p, T + 'encontros/ana')).sort((a, b) => b.ts - a.ts)[0];
    t('1:1: sem atitude marcada não grava o campo', !('at' in e2), e2);
    // id desconhecido no banco não chega à tela
    await p.evaluate(() => { const m = window.Travessia.demoMem.kanban.travessia.encontros.ana; m.zz = { data: '2026-11-11', tipo: 'acomp', por: 'pau', ts: Date.now() + 9999, at: 'x"><img src=x onerror=alert(1)>', nota: '<b>oi</b>' }; window.Travessia.estado.cache = {}; window.Travessia.render(); }); await p.waitForTimeout(600);
    t('valor desconhecido de atitude não aparece; nota vai como texto', await p.evaluate(() => !document.querySelector('#painel img') && /<b>oi<\/b>/.test(document.querySelector('[aria-labelledby="t-um"] .lst').textContent)), '');
    t('sem erro de JS', !errs.length, errs); await ctx.close(); }

  // 2) autoavaliação (Ana) e par (Ana → Bia)
  { const { ctx, p, errs } = await abre('&como=ana&tab=aval');
    const box = p.locator('.cult-bloco').first();
    t('autoavaliação: bloco das atitudes no ciclo com cultura (e não no ciclo encerrado sem ela)', (await p.locator('.cult-bloco').count()) === 2, await p.locator('.cult-bloco').count());
    await box.locator('[data-at="facilita"]').click(); await box.locator('[data-at="cardume"]').click(); await box.locator('[data-at="legado"]').click(); await p.waitForTimeout(200);
    t('autoavaliação: no máximo 2 atitudes (a 3ª avisa e não marca)', (await box.locator('[aria-pressed="true"]').count()) === 2 && /até 2/.test(await p.locator('#toast').innerText()), '');
    const prog = await p.locator('[data-prog="auto"]').first().innerText();
    await box.locator('textarea').fill('Simplifiquei o <b>painel</b> e alinhei com a squad de mídia.');
    t('o exemplo das atitudes não entra no contador "X de N respondidas"', (await p.locator('[data-prog="auto"]').first().innerText()) === prog, prog);
    const autoAntes = await mem(p, T + 'avaliacoes/' + CID + '/ana/auto');
    await box.locator('[data-act="at-salvar"]').click(); await p.waitForTimeout(600);
    const at = await mem(p, T + 'avaliacoes/' + CID + '/ana/atitudes/auto');
    t('autoavaliação: grava em atitudes/auto (at "facilita,cardume" + exemplo + ts)', at && at.at === 'facilita,cardume' && /painel/.test(at.atx) && at.ts, at);
    t('as respostas q1–q4 da autoavaliação ficam intactas', JSON.stringify(await mem(p, T + 'avaliacoes/' + CID + '/ana/auto')) === JSON.stringify(autoAntes), '');
    t('depois de salvar: chips marcados e exemplo como texto', (await p.locator('.cult-bloco').first().locator('[aria-pressed="true"]').count()) === 2 && /<b>painel<\/b>/.test(await p.locator('.cult-bloco').first().locator('textarea').inputValue()), '');
    t('"As 5 atitudes da Hering" com o texto do A Bordo e o exemplo "No Digital"', await p.locator('.cult').first().evaluate(e => e.querySelectorAll('li').length === 5 && /No Digital: alinhe dependências entre squads/.test(e.textContent)), '');
    const par = p.locator('.cult-bloco').last();
    await par.locator('[data-at="acessivel"]').click(); await par.locator('[data-act="at-salvar"]').click(); await p.waitForTimeout(600);
    t('par (Ana avaliando a Bia): grava em atitudes/par/ana', ((await mem(p, T + 'avaliacoes/' + CID + '/bia/atitudes/par/ana')) || {}).at === 'acessivel', await mem(p, T + 'avaliacoes/' + CID + '/bia/atitudes'));
    await p.locator('.cult-bloco').first().screenshot({ path: path.join(out, 'auto-1280.png') });
    t('sem erro de JS', !errs.length, errs); await ctx.close(); }

  // 3) líder (Pau) e Frota
  { const { ctx, p, errs } = await abre('&como=pau&tab=frota');
    t('Frota: "Atitudes em foco nos 1:1" com as 5 atitudes e contagem', await p.locator('.at-barras li').count() === 5 && /Atitudes em foco nos 1:1/.test(await p.locator('#painel').innerText()), '');
    await p.click('[data-act="abrir"][data-uid="ana"]'); await p.waitForTimeout(600); await p.click('[data-act="sel-aba"][data-k="aval"]'); await p.waitForTimeout(700);
    const det = p.locator('details:has(> summary:has-text("Atitudes da Hering"))').first(); await det.locator('> summary').click(); await p.waitForTimeout(300);
    t('líder: vê o que o par destacou (Débora: cardume e bem-feito, com o exemplo)', /Débora Pinto/.test(await det.innerText()) && /Juntos, somos um cardume · 1/.test(await det.innerText()), (await det.innerText()).slice(0, 200));
    const box = det.locator('.cult-bloco');
    await box.locator('[data-at-grupo="at"] [data-at="cardume"]').click(); await box.locator('[data-at-grupo="atd"] [data-at="facilita"]').click();
    await box.locator('[data-act="at-salvar"]').click(); await p.waitForTimeout(600);
    const l = await mem(p, T + 'avaliacoes/' + CID + '/ana/atitudes/lider');
    t('líder: grava destaque e atitude a desenvolver em atitudes/lider', l && l.at === 'cardume' && l.atd === 'facilita', l);
    await p.locator('[aria-labelledby="t-at"]').screenshot({ path: path.join(out, 'frota-1280.png') });
    t('sem erro de JS', !errs.length, errs); await ctx.close(); }

  // 4) Admin: novo ciclo com atitudes (padrão ligado) e interruptor por ciclo
  { const { ctx, p, errs } = await abre('&como=adm&tab=admin');
    t('Admin: "Incluir as atitudes da Hering" já vem marcado no novo ciclo', await p.locator('input[name="cultura"]').isChecked(), '');
    const bt = p.locator('[data-act="ciclo-cultura"][data-cid="c2026s1"]');
    t('Admin: o ciclo antigo mostra "Atitudes: desligadas"', /desligadas/.test(await bt.innerText()), await bt.innerText());
    await bt.click(); await p.waitForTimeout(500);
    t('Admin: o botão liga as atitudes no ciclo (grava cultura: true)', (await mem(p, T + 'ciclos/c2026s1/cultura')) === true && /ligadas/.test(await p.locator('[data-act="ciclo-cultura"][data-cid="c2026s1"]').innerText()), '');
    t('sem erro de JS', !errs.length, errs); await ctx.close(); }

  // 5) celular e temas
  for (const [nome, tema] of [['abrolhos', null], ['lencois', 'light'], ['entardecer', 'sunset']]) for (const [como, tab] of [['ana', 'inicio'], ['ana', 'aval'], ['pau', 'frota']]) {
    const { ctx, p, errs } = await abre('&como=' + como + '&tab=' + tab, { width: 390, height: 844 }, tema);
    t(nome + ' 390px · ' + tab + ': sem rolagem lateral e sem erro', (await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)) && !errs.length, errs);
    if (tab === 'aval' && !tema) await p.locator('.cult-bloco').first().screenshot({ path: path.join(out, 'aval-390.png') });
    await ctx.close(); }

  await b.close(); console.log(`\n${total - falhas}/${total} ok`); process.exit(falhas ? 1 : 0);
})();
