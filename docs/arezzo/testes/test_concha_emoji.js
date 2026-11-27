// 🐚 Concha — 😀 emoji do canal e do assunto + faixa com ＋ Assunto por último e ⚙️ (pedido do Caio, 25/11/2026).
// Canal oficial começa com o emoji da squad; quem administra troca nos Detalhes (padrão volta); membro comum não vê o seletor;
// assunto nasce com emoji escolhido e aparece no chip e no campo. Cada escrita conferida nas regras reais.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_emoji.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const { update: regras } = require('../../../functions/rules/rulesSim.js');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../database.rules.json'), 'utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const agora = Date.now();
const seed = () => ({ kanban: {
  usuarios: { ana: { role: 'membro', squads: { dados: true, prf: true }, squads_roles: { dados: 'po' } } },
  usuarios_publicos: { ana: { nome: 'Ana Lima', email: 'ana@ciahering.com.br' }, bru: { nome: 'Bruno Reis', email: 'bru@ciahering.com.br' } },
  cardume: {
    canais: { dados: { nome: 'Dados' }, prf: { nome: 'Performance' } }, membros: { dados: { ana: true, bru: true }, prf: { ana: true, bru: true } }, meus: { ana: { dados: true, prf: true } },
    assuntos: { dados: { aold: { n: 'campanha', por: 'bru', criado: agora - 864e5 } } }, msgs: { dados: {}, prf: {} },
  },
} });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 500))); };
const authDe = u => ({ uid: u.uid, token: { email: u.email, firebase: { sign_in_provider: 'google.com' } } });

(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(chromeRoot) ? path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed());
  await ctx.addInitScript(() => { window.__limitarConsultas = true; window.__filtrarEqualTo = true; localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb);
  await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(1000);
  const S = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__store.kanban.cardume)));
  const nomeLista = id => p.evaluate(i => document.querySelector('[data-canal="' + i + '"] .nome').textContent, id);
  const chips = () => p.evaluate(() => [...document.querySelectorAll('#assuntos-barra button')].map(b => b.textContent));

  t('canal oficial começa com o emoji da squad (📊 Dados) na lista e no topo', (await nomeLista('dados')) === '📊 Dados' && await p.evaluate(() => document.getElementById('canal-titulo').textContent === '📊 Dados'), await nomeLista('dados'));
  t('faixa: geral, assuntos, ＋ Assunto por último', JSON.stringify(await chips()) === JSON.stringify(['💬 geral', '🧵 campanha', '＋ Assunto']), await chips());
  t('PO da squad vê "😀 Emoji do canal" nos Detalhes', await p.evaluate(() => !!document.querySelector('#lado .emoji-grade')), 0);
  await p.click('#lado details.emoji-det summary'); await p.click('#lado .emoji-grade [aria-label="Emoji 🔥"]'); await p.waitForTimeout(300);
  t('escolher 🔥 grava canais/dados/e e a lista mostra 🔥 Dados', (await S()).canais.dados.e === '🔥' && (await nomeLista('dados')) === '🔥 Dados', await S());
  await p.click('#lado details.emoji-det summary'); await p.click('#lado .emoji-grade [aria-label^="Padrão"]'); await p.waitForTimeout(300);
  t('"Padrão" tira o emoji e volta ao da squad', !(await S()).canais.dados.e && (await nomeLista('dados')) === '📊 Dados', 0);
  await p.click('[data-canal="prf"]'); await p.waitForTimeout(400);
  t('membro comum (sem ser PO de Performance) não vê o seletor', await p.evaluate(() => !document.querySelector('#lado .emoji-grade')), 0);
  await p.click('[data-aid="_novo"]:visible');   // sem assuntos, o ＋ Assunto mora no cabeçalho (UI/UX 27/11)
  await p.fill('.md input', 'banner'); await p.click('.md .emoji-grade [aria-label="Emoji 🎨"]'); await p.click('.md button[type="submit"]'); await p.waitForTimeout(500);
  const c = await S(); const aid = Object.keys(c.assuntos.prf || {})[0];
  t('assunto nasce com o emoji escolhido; chip "🎨 banner", campo "Em 🎨 banner" e ⚙️ na faixa', aid && c.assuntos.prf[aid].e === '🎨' && (await chips()).includes('🎨 banner') && await p.evaluate(() => document.getElementById('entrada').placeholder === 'Em 🎨 banner') && (await chips()).includes('⚙️'), { a: c.assuntos.prf, ch: await chips() });
  await p.click('#assuntos-barra [data-aid="_ger"]'); await p.click('.md .emoji-grade [aria-label="Emoji 📈"]'); await p.click('.md button[type="submit"]'); await p.waitForTimeout(400);
  t('⚙️ troca o emoji do assunto (quem criou)', (await S()).assuntos.prf[aid].e === '📈' && (await chips()).includes('📈 banner'), await chips());

  const esc = await p.evaluate(() => window.__escritas || []);
  const real = Date.now; const ruins = [];
  for (const e of esc) { const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([k, v]) => [(e.p ? e.p + '/' : '') + k, v])); Date.now = () => e.t; let r; try { r = regras(RULES, e.antes, authDe(ANA), mapa); } finally { Date.now = real; } if (!r) ruins.push({ tipo: e.tipo, caminhos: Object.keys(mapa) }); }
  t('CADA escrita da página passa nas regras reais', esc.length > 0 && !ruins.length, { n: esc.length, ruins });
  t('sem erro de JS', !errs.length, errs);
  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
