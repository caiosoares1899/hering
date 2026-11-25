// 🐚 Concha — ✏️ editar só nos primeiros 15 min (pedido do Caio, 25/11/2026). O ✏️ aparece só na própria mensagem com menos de 15 min,
// some sozinho quando a janela fecha, e salvar com a janela já fechada avisa em vez de gravar. A regra do banco confere o mesmo (cardumeRules).
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_editar.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const agora = Date.now(), J = 15 * 60000;
const seed = () => ({ kanban: { usuarios: { ana: { role: 'membro' } }, usuarios_publicos: { ana: { nome: 'Ana Lima', email: 'ana@ciahering.com.br' } },
  cardume: { canais: { dados: { nome: 'Dados' } }, membros: { dados: { ana: true } }, meus: { ana: { dados: true } },
    msgs: { dados: { '-Nv': { uid: 'ana', ts: agora - 16 * 60000, texto: 'velha' }, '-Nq': { uid: 'ana', ts: agora - J + 4000, texto: 'quase vencendo' }, '-Nn': { uid: 'ana', ts: agora - 60000, texto: 'nova' } } } } } });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 400))); };
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(chromeRoot) ? path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed());
  await ctx.addInitScript(() => { window.__limitarConsultas = true; localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb);
  await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(800);
  const tem = id => p.evaluate(i => !!document.querySelector('[data-msg="' + i + '"] [aria-label="Editar"]'), id);
  t('✏️ na mensagem de 1 min', await tem('-Nn'), 0);
  t('sem ✏️ na mensagem de 16 min (só apagar)', !(await tem('-Nv')) && await p.evaluate(() => !!document.querySelector('[data-msg="-Nv"] [aria-label="Apagar"]')), 0);
  t('o ✏️ diz o limite ("até 15 min")', await p.evaluate(() => /15 min/.test(document.querySelector('[data-msg="-Nn"] [aria-label="Editar"]').title)), 0);
  t('(pré-condição) a de 14m56s ainda tem ✏️', await tem('-Nq'), 0);
  await p.waitForTimeout(5500);
  t('passados os 15 min, o ✏️ some sozinho (sem recarregar)', !(await tem('-Nq')), 0);
  // salvar com a janela fechada: avisa e não grava
  await p.evaluate(() => { window.__escritas = []; });
  await p.hover('[data-msg="-Nn"]'); await p.click('[data-msg="-Nn"] [aria-label^="Editar"]'); await p.fill('[data-msg="-Nn"] textarea', 'tarde demais');
  await p.evaluate(() => { const r = Date.now; window.__relogioReal = r; Date.now = () => r() + 20 * 60000; });   // o tempo passa com o editor aberto
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  await p.evaluate(() => { Date.now = window.__relogioReal; });
  t('salvar depois dos 15 min avisa e não grava', await p.evaluate(() => /Passaram 15 minutos/.test(document.getElementById('toast').textContent) && !(window.__escritas || []).some(e => /msgs\/dados\/-Nn/.test(e.p + JSON.stringify(Object.keys(e.v || {}))))), await p.evaluate(() => document.getElementById('toast').textContent));
  t('sem erro de JS', !errs.length, errs);
  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
