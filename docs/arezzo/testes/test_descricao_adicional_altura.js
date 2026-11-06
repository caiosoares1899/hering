// 📏 Descrição adicional do card: já vem grande, e a altura que a pessoa arrasta no cantinho fica salva neste navegador e vira o padrão. Playwright + Firebase falso (arrasto REAL do cantinho).
//   python3 -m http.server 8941 &   node docs/arezzo/testes/test_descricao_adicional_altura.js   (PW_MODULE / CHROME_PATH para rodar fora do sandbox Linux)
const { chromium } = require(process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const K = process.env.K || 'kanban-dev', SQ = 'midiacriativa', KEY = 'mare_xdesc_altura';
const U = { uid: 'eve', email: 'eve@ciahering.com.br', displayName: 'Eve', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const flow = col => ({ enteredAt: { [col]: '2026-10-20T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-10-20T12:00:00.000Z' }], firstStartAt: null, doneAt: null });
const seed = () => { const c = { id: 'c0', title: 'Card com descrição adicional', col: 'doing', createdAt: '2026-10-20', desc: 'x', flow: flow('doing'), updatedAt: '2026-10-26T10:00:00.000Z', descsExtra: [{ id: 'd1', label: 'Brief', text: '', author: 'Eve', at: '2026-10-26T10:00:00.000Z' }] };
  return { kanban: { usuarios: { eve: { uid: 'eve', nome: 'Eve', email: 'eve@ciahering.com.br', inscrito: true, init: 'EV', role: 'po', squads: { [SQ]: true } } }, usuarios_publicos: { eve: { uid: 'eve', nome: 'Eve', init: 'EV', role: 'po', squads: { [SQ]: true } } }, config: { adm_emails: [] },
    squads: { [SQ]: { dados: { cards: { 0: c }, cards_index: { c0: '0' }, cards_updated_at: { c0: c.updatedAt }, columns: [{ id: 'doing', name: 'Fazendo' }] } } } } }; };
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const abre = async (vp, antes) => { const ctx = await b.newContext({ viewport: vp || { width: 1280, height: 900 } }); await fake.install(ctx, seed()); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    if (antes) await p.addInitScript(antes);
    await p.goto('http://localhost:8941/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(3000);
    await p.evaluate(() => { document.getElementById('boasvindas-ov')?.classList.remove('open'); }); await p.evaluate(() => { openCard('c0'); }); await p.waitForSelector('.xdesc-text', { timeout: 8000 }); await p.waitForTimeout(400); return { ctx, p, errs }; };
  const altura = p => p.evaluate(() => document.querySelector('.xdesc-text').getBoundingClientRect().height);
  const arrasta = async (p, dy) => { const bb = await p.locator('.xdesc-text').boundingBox(); await p.evaluate(() => document.querySelector('.xdesc-text').scrollIntoView({ block: 'center' })); await p.waitForTimeout(250); const bb2 = await p.locator('.xdesc-text').boundingBox();
    const x = bb2.x + bb2.width - 5, y = bb2.y + bb2.height - 5; await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x, y + dy / 2, { steps: 6 }); await p.mouse.move(x, y + dy, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(300); };

  { const { ctx, p, errs } = await abre();
    const h0 = await altura(p);
    t('A. já vem GRANDE por padrão no desktop (≥ 220 px; antes eram ~3 linhas, ~70 px)', h0 >= 220, h0);
    t('B. nada foi gravado só por abrir (o padrão não vira "escolha da pessoa")', await p.evaluate(k => localStorage.getItem(k) === null, KEY), '');
    await arrasta(p, 160); const h1 = await altura(p);
    t('C. arrastar o cantinho aumenta o campo', h1 > h0 + 100, [h0, h1]);
    const salvo = await p.evaluate(k => parseInt(localStorage.getItem(k), 10), KEY);
    t('D. o navegador SALVOU a altura que a pessoa arrastou', Math.abs(salvo - h1) <= 3, [salvo, h1]);
    await p.evaluate(() => { closeOv && closeOv('card-ov'); }).catch(() => { }); await p.evaluate(() => { document.getElementById('boasvindas-ov')?.classList.remove('open'); }); await p.evaluate(() => openCard('c0')); await p.waitForSelector('.xdesc-text'); await p.waitForTimeout(300);
    t('E. reabrir o card usa a altura salva', Math.abs(await altura(p) - h1) <= 3, [await altura(p), h1]);
    await p.reload(); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(2500); await p.evaluate(() => { document.getElementById('boasvindas-ov')?.classList.remove('open'); }); await p.evaluate(() => openCard('c0')); await p.waitForSelector('.xdesc-text'); await p.waitForTimeout(300);
    t('F. depois de recarregar a página, continua com a altura salva', Math.abs(await altura(p) - h1) <= 3, [await altura(p), h1]);
    await p.locator('.xdesc-text').click(); await p.keyboard.type('texto de teste'); await p.waitForTimeout(200);
    t('G. clicar e digitar não mexe na altura salva', await p.evaluate(k => parseInt(localStorage.getItem(k), 10), KEY) === salvo, '');
    await arrasta(p, -120); const h2 = await altura(p); const salvo2 = await p.evaluate(k => parseInt(localStorage.getItem(k), 10), KEY);
    t('H. diminuir também vale (e respeita o mínimo de 120 px)', h2 < h1 - 60 && h2 >= 118 && Math.abs(salvo2 - h2) <= 3, [h1, h2, salvo2]);
    t('I. sem erro de JS', errs.length === 0, errs); await ctx.close(); }

  { const { ctx, p } = await abre(null, "try{localStorage.setItem('mare_xdesc_altura','abc')}catch(e){}");
    t('J. valor salvo corrompido ("abc") → volta ao padrão grande, sem quebrar', await altura(p) >= 220, await altura(p)); await ctx.close(); }
  { const { ctx, p } = await abre(null, "try{localStorage.setItem('mare_xdesc_altura','99999')}catch(e){}");
    t('K. valor salvo absurdo (99999) → ignorado, volta ao padrão', await altura(p) < 1000 && await altura(p) >= 220, await altura(p)); await ctx.close(); }
  { const { ctx, p } = await abre({ width: 390, height: 800 });
    t('L. celular 390 px: já vem maior que o antigo, mas cabe (sem rolagem lateral)', await altura(p) >= 170 && await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), await altura(p));
    await p.screenshot({ path: (process.env.CAPTURAS || '/tmp') + '/desc_adicional_mobile.png' }).catch(() => { }); await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1); })();
