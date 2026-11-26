// Regressão de envio pendente enquanto a pessoa muda de assunto.
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const base = process.env.BASE_URL || 'http://127.0.0.1:8949';
const U = (uid, nome) => ({ uid, email: uid + '@ciahering.com.br', displayName: nome, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const PAU = U('pau', 'Paula PO');
const ag = Date.now();
const P = n => ({ nome: n, email: n.split(' ')[0].toLowerCase() + '@ciahering.com.br' });
const seed = () => {
  const msgs = { fixa: { uid: 'pau', ts: ag - 60000, texto: 'Decisão: o banner sai na segunda' } };
  for (let i = 0; i < 10; i++) msgs['n' + i] = { uid: 'pau', ts: ag - 50000 + i * 100, texto: 'mensagem ' + i };
  return { kanban: {
    usuarios: { pau: { role: 'membro', squads: { dados: true }, squads_roles: { dados: 'po' } } },
    usuarios_publicos: { pau: P('Paula PO') },
    cardume: {
      canais: { dados: { nome: 'Dados' } }, membros: { dados: { pau: true } }, meus: { pau: { dados: true } },
      msgs: { dados: msgs, 'eu-pau': { x1: { uid: 'pau', ts: ag - 1000, texto: 'minha nota' } } },
      fixadas: { dados: { fixa: { por: 'pau', em: ag - 5000, t: 'topo' } } },
      notas: { pau: true },
      assuntos: { dados: { a1: { n: 'Pauta', em: ag, por: 'pau' } } },
    } } };
};
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 400))); };
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(chromeRoot) ? path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const abre = async (url) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed());
    await ctx.addInitScript(() => { window.__limitarConsultas = true; localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + url); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(x => window.__authCb(x), PAU); await p.waitForTimeout(1000);
    return { ctx, p, errs };
  };

  const { ctx, p, errs } = await abre('/cardume-dev.html?c=dados');
  const entrada = p.locator('#entrada');
  const geral = p.locator('[data-aid="_geral"]');
  const pauta = p.locator('[data-aid="a1"]');
  await pauta.click();
  await entrada.fill('Texto igual');
  await geral.click();
  await entrada.fill('Texto igual');
  await p.evaluate(() => { window.__setDelay = path => path === '' ? 1200 : 0; });
  await entrada.press('Enter');
  await pauta.click();
  await p.locator('#b-config').focus();
  await p.waitForFunction(() => !document.getElementById('b-enviar').disabled);
  t('envio no geral preserva texto idêntico no assunto', await entrada.inputValue() === 'Texto igual', await entrada.inputValue());
  t('confirmação não rouba o foco do assunto', await p.evaluate(() => document.activeElement?.id === 'b-config'), await p.evaluate(() => document.activeElement?.id));
  await geral.click();
  t('rascunho enviado foi limpo no geral', await entrada.inputValue() === '', await entrada.inputValue());
  t('sem erro na página', !errs.length, errs);
  await ctx.close();

  await b.close();
  console.log((ok ? '\n✅ ' : '\n❌ ') + total + ' verificações');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
