// 🐚 Concha — 📢 canais permanentes Geral e #oceano (26/11/2026, R3, PR #2011).
// Valida em dev com conta comum (Ana) e conta ADM (Caio): ambas veem e leem os dois canais automaticamente;
// conta comum vê aviso de somente leitura, não tem compositor e não vê Geral/#oceano nos destinos de encaminhar;
// conta ADM consegue publicar e encaminhar; cada escrita validada contra as regras reais em database.rules.json.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_canais_permanentes.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const { update: regras } = require('../../../functions/rules/rulesSim.js');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../database.rules.json'), 'utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const U = (uid, nome, email) => ({ uid, email: email || uid + '@ciahering.com.br', displayName: nome, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const ANA = U('ana', 'Ana Lima');
const ADM = U('adm', 'Admin Concha');
const ag = Date.now();
const seed = () => ({ kanban: {
  usuarios: {
    ana: { role: 'membro', squads: { dados: true } },
    adm: { role: 'adm', squads: { dados: true } },
  },
  usuarios_publicos: {
    ana: { nome: 'Ana Lima', email: 'ana@ciahering.com.br' },
    adm: { nome: 'Admin Concha', email: 'adm@ciahering.com.br' },
  },
  cardume: {
    canais: { dados: { nome: 'Dados' } },
    membros: { dados: { ana: true, adm: true } },
    meus: { ana: { dados: true }, adm: { dados: true } },
    msgs: {
      dados: { d1: { uid: 'ana', ts: ag - 6e4, texto: 'novidade da squad' } },
      geral: { g1: { uid: 'adm', ts: ag - 9e4, texto: 'Bem-vindos ao canal Geral' } },
      oceano: { o1: { uid: 'adm', ts: ag - 8e4, texto: 'Promoção no ar\n\n🤖 Agente Ágil' } },
    },
  },
} });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 400))); };
const authDe = u => ({ uid: u.uid, token: { email: u.email, firebase: { sign_in_provider: 'google.com' } } });
async function conferirRegras(p, quem) {
  const esc = await p.evaluate(() => window.__escritas || []);
  const real = Date.now; const ruins = [];
  for (const e of esc) {
    const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([kk, v]) => [(e.p ? e.p + '/' : '') + kk, v]));
    Date.now = () => e.t;
    let rr; try { rr = regras(RULES, e.antes, authDe(quem), mapa); } finally { Date.now = real; }
    if (!rr) ruins.push({ tipo: e.tipo, caminhos: Object.keys(mapa) });
  }
  return { n: esc.length, ruins };
}

(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const cr = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(cr) ? path.join(cr, fs.readdirSync(cr).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});

  // ── 1. Conta comum (Ana) ──
  { const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed());
    await ctx.addInitScript(() => { localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(900);

    t('comum: vê Geral e #oceano automaticamente na lista', await p.evaluate(() => !!document.querySelector('[data-canal="geral"]') && !!document.querySelector('[data-canal="oceano"]')), 0);

    await p.click('[data-canal="geral"]'); await p.waitForTimeout(500);
    t('comum: lê mensagens do Geral, vê aviso de somente leitura e compositor fica oculto', await p.evaluate(() => /Bem-vindos ao canal Geral/.test(document.getElementById('log').textContent) && /somente leitura/i.test(document.getElementById('log').textContent) && document.getElementById('rodape').hidden), 0);

    await p.click('[data-canal="oceano"]'); await p.waitForTimeout(500);
    t('comum: lê mensagens do #oceano (com 🤖 Agente Ágil), vê aviso de somente leitura e compositor oculto', await p.evaluate(() => /Promoção no ar/.test(document.getElementById('log').textContent) && /🤖 Agente Ágil/.test(document.getElementById('log').textContent) && /somente leitura/i.test(document.getElementById('log').textContent) && document.getElementById('rodape').hidden), 0);

    // Encaminhar da squad Dados: Geral e #oceano NÃO aparecem como destino para conta comum
    await p.click('[data-canal="dados"]'); await p.waitForTimeout(400);
    await p.hover('[data-msg="d1"]'); await p.click('[data-msg="d1"] [aria-label="Encaminhar"]'); await p.waitForTimeout(250);
    t('comum: Geral e #oceano NÃO aparecem como destino no ⏩ Encaminhar', await p.evaluate(() => !document.querySelector('.md input[value="geral"]') && !document.querySelector('.md input[value="oceano"]')), 0);
    await p.keyboard.press('Escape');

    const rr = await conferirRegras(p, ANA);
    t('comum: CADA escrita (lidas/vendo) passa nas regras reais', !rr.ruins.length, rr);
    t('comum: sem erro de JS', !errs.length, errs);
    await ctx.close(); }

  // ── 2. Conta ADM ──
  { const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed());
    await ctx.addInitScript(() => { localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(x => window.__authCb(x), ADM); await p.waitForTimeout(900);

    t('ADM: vê Geral e #oceano automaticamente na lista', await p.evaluate(() => !!document.querySelector('[data-canal="geral"]') && !!document.querySelector('[data-canal="oceano"]')), 0);

    await p.click('[data-canal="geral"]'); await p.waitForTimeout(500);
    t('ADM: compositor visível no Geral e publica mensagem', !await p.evaluate(() => document.getElementById('rodape').hidden), 0);
    await p.fill('#entrada', 'Aviso geral do ADM'); await p.click('#b-enviar'); await p.waitForTimeout(500);
    let S = await p.evaluate(() => JSON.parse(JSON.stringify(window.__store.kanban.cardume)));
    t('ADM: mensagem gravada em msgs/geral com autoria da conta ADM', Object.values(S.msgs.geral).some(m => m.uid === 'adm' && m.texto === 'Aviso geral do ADM'), S.msgs.geral);

    await p.click('[data-canal="oceano"]'); await p.waitForTimeout(500);
    await p.fill('#entrada', 'Novidades em prod\n\n🤖 Agente Ágil'); await p.click('#b-enviar'); await p.waitForTimeout(500);
    S = await p.evaluate(() => JSON.parse(JSON.stringify(window.__store.kanban.cardume)));
    t('ADM: publica no #oceano com rodapé 🤖 Agente Ágil e uid da conta ADM', Object.values(S.msgs.oceano).some(m => m.uid === 'adm' && /🤖 Agente Ágil/.test(m.texto)), S.msgs.oceano);

    // ADM consegue encaminhar de Dados para #oceano (com aviso de público)
    await p.click('[data-canal="dados"]'); await p.waitForTimeout(400);
    await p.hover('[data-msg="d1"]'); await p.click('[data-msg="d1"] [aria-label="Encaminhar"]'); await p.waitForTimeout(250);
    t('ADM: Geral e #oceano aparecem como destino no ⏩ Encaminhar', await p.evaluate(() => !!document.querySelector('.md input[value="geral"]') && !!document.querySelector('.md input[value="oceano"]')), 0);
    await p.click('.md input[value="oceano"]'); await p.waitForTimeout(250);
    t('ADM: encaminhar para #oceano exibe aviso de público amplo', await p.evaluate(() => !document.querySelector('.enc-aviso').hidden && /toda conta/i.test(document.querySelector('.enc-aviso').textContent)), 0);
    await p.click('.md button[type=submit]'); await p.waitForTimeout(500);
    S = await p.evaluate(() => JSON.parse(JSON.stringify(window.__store.kanban.cardume)));
    t('ADM: mensagem encaminhada para #oceano gravada no banco', Object.values(S.msgs.oceano).some(m => m.enc && m.enc.c === 'dados' && m.uid === 'adm'), S.msgs.oceano);

    const rr = await conferirRegras(p, ADM);
    t('ADM: CADA escrita passa nas regras reais', rr.n > 0 && !rr.ruins.length, rr);
    t('ADM: sem erro de JS', !errs.length, errs);
    await ctx.close(); }

  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
