// 🐚 Concha — 🛡️ regressão da auditoria de segurança (26/11/2026, docs/AUDITORIA_SEGURANCA_CONCHA_2026-11.md).
// A2: #constructor em tags_ult não quebra carregarTagsUlt() nem faz botaoSeguir() mostrar "Seguindo" sem seguir.
// A3: aviso de regras dispensado (concha_regras_<uid>_<canal>) é isolado por conta no localStorage.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_seguranca.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const U = (uid, nome) => ({ uid, email: uid + '@ciahering.com.br', displayName: nome, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const ANA = U('ana', 'Ana Lima'), BRU = U('bru', 'Bruno Reis');
const pub = (uid, nome) => ({ uid, nome, email: uid + '@ciahering.com.br', squads: { dados: true } });
const ag = Date.now();
const seed = () => ({ kanban: {
  usuarios: { ana: { role: 'membro', squads: { dados: true } }, bru: { role: 'membro', squads: { dados: true } } },
  usuarios_publicos: { ana: pub('ana', 'Ana Lima'), bru: pub('bru', 'Bruno Reis') },
  cardume: {
    canais: { dados: { nome: 'Dados' } },
    membros: { dados: { ana: true, bru: true } },
    meus: { ana: { dados: true }, bru: { dados: true } },
    msgs: { dados: {
      r1: { uid: 'ana', ts: ag - 8e6, texto: 'Regra do canal' },
      m1: { uid: 'bru', ts: ag - 6e5, texto: 'teste #constructor e #banner' },
    } },
    fixadas: { dados: { r1: { por: 'ana', em: ag - 7e6, t: 'regra' } } },
    tags: { dados: { constructor: { m1: ag - 6e5 }, banner: { m1: ag - 6e5 } } },
    tags_ult: { dados: { constructor: ag - 6e5, banner: ag - 5e5 } },
  },
} });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 500))); };

(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(chromeRoot) ? path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});

  // ── A2: #constructor em tags_ult não quebra Sonar nem finge que está seguido ──
  { const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed());
    await ctx.addInitScript(() => { window.__limitarConsultas = true; localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(900);
    await p.keyboard.press('Control+k'); await p.waitForTimeout(600);
    const itens = await p.evaluate(() => [...document.querySelectorAll('#msn-lista [data-i]')].map(e => e.textContent.replace(/\s+/g, ' ').trim()));
    t('A2: tags_ult com #constructor não derruba a lista de #tags no Sonar (#banner aparece)', itens.some(x => /#banner/.test(x)), itens);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    await p.click('[data-msg="m1"] button.tag:has-text("#constructor")'); await p.waitForTimeout(500);
    const btnSeg = await p.evaluate(() => { const el = document.querySelector('#log .seguir-tag'); return el ? { txt: el.textContent, pressed: el.getAttribute('aria-pressed') } : null; });
    t('A2: botaoSeguir(#constructor) mostra "Seguir" (não "Seguindo") quando seguidas está vazio', btnSeg && /Seguir #constructor/.test(btnSeg.txt) && btnSeg.pressed === 'false', btnSeg);
    t('A2: sem erro de JS', !errs.length, errs);
    await ctx.close(); }

  // ── A3: concha_regras_<uid>_<canal> isolado por conta no mesmo navegador ──
  { const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed());
    await ctx.addInitScript(() => { window.__limitarConsultas = true; localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(900);
    await p.click('#faixa-fix .fix-regras-aviso [aria-label="Dispensar o aviso de regras"]'); await p.waitForTimeout(200);
    const lsAna = await p.evaluate(() => ({ comUid: localStorage.getItem('concha_regras_ana_dados'), semUid: localStorage.getItem('concha_regras_dados') }));
    t('A3: dispensar regras grava chave com uid (concha_regras_ana_dados) e não a chave global sem uid', !!lsAna.comUid && !lsAna.semUid, lsAna);
    // Outra conta no mesmo navegador (mesmo localStorage) ainda vê o aviso de regras
    const p2 = await ctx.newPage(); p2.on('pageerror', e => errs.push(e.message));
    await p2.goto(base + '/cardume-dev.html?c=dados'); await p2.waitForFunction(() => !!window.__authCb);
    await p2.evaluate(x => window.__authCb(x), BRU); await p2.waitForTimeout(900);
    const avisoBru = await p2.evaluate(() => (document.querySelector('#faixa-fix .fix-regras-aviso') || {}).textContent || '');
    t('A3: outra conta no mesmo navegador ainda vê o aviso "Este canal tem 1 regra"', /Este canal tem 1 regra/.test(avisoBru), avisoBru);
    t('A3: sem erro de JS', !errs.length, errs);
    await ctx.close(); }

  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
