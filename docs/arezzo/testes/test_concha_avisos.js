// 🐚 Concha — 🔔 avisos de mensagem nova, estilo WhatsApp (25/11/2026, docs/ideias/cardume-v0-banco.md › "Avisos de mensagem nova").
// 🔔 no topo da conversa com os 3 níveis e o prazo; 🔕/🚫 na lista; Seguir #tag na tela da tag e deixar de seguir no 🔔; sinal de vida
// da conversa aberta (um por canal; some ao trocar de canal, ao abrir @ Menções e com a aba escondida). Cada escrita conferida nas regras reais.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_avisos.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const { update: regras } = require('../../../functions/rules/rulesSim.js');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../database.rules.json'), 'utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const agora = Date.now();
const seed = () => ({ kanban: {
  usuarios: { ana: { role: 'membro', squads: { dados: true } } },
  usuarios_publicos: { ana: { nome: 'Ana Lima', email: 'ana@ciahering.com.br' }, bru: { nome: 'Bruno Reis', email: 'bru@ciahering.com.br' } },
  cardume: {
    canais: { dados: { nome: 'Dados' }, prf: { nome: 'Performance' } }, membros: { dados: { ana: true, bru: true }, prf: { ana: true, bru: true } }, meus: { ana: { dados: true, prf: true } },
    msgs: { dados: { '-Nd1': { uid: 'bru', ts: agora - 6e4, texto: 'subiu o #banner' } } }, tags: { dados: { banner: { '-Nd1': agora - 6e4 } } },
    avisos: { ana: { prf: { nivel: 'nada' } } },
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
  await ctx.addInitScript(() => { window.__limitarConsultas = true; localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb);
  await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(900);
  const S = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__store.kanban.cardume)));

  t('🔔 Avisos em ℹ️ Detalhes (padrão: todas) e nenhum sino no topo da conversa (não confunde com o Sino geral)', await p.evaluate(() => { const b = document.querySelector('#lado .aviso-canal button'); return !!b && /^🔔 Avisos: todas as mensagens$/.test(b.textContent) && !document.getElementById('b-aviso') && !document.querySelector('.conversa .cabecalho [aria-label^="Avisos"]'); }), 0);
  t('na lista, Performance (🚫 Nada) mostra 🚫; Dados não mostra nada', await p.evaluate(() => !!document.querySelector('[data-canal="prf"] .aviso-ic') && document.querySelector('[data-canal="prf"] .aviso-ic').textContent === '🚫' && !document.querySelector('[data-canal="dados"] .aviso-ic')), 0);
  let c = await S();
  t('sinal de vida da conversa aberta: vendo/ana/dados', typeof ((c.vendo || {}).ana || {}).dados === 'number', c.vendo);

  await p.click('#lado .aviso-canal button'); await p.waitForTimeout(150);
  t('o 🔔 abre as 3 opções, com "Todas" marcada e o prazo escondido', await p.evaluate(() => [...document.querySelectorAll('.md input[name="nivel"]')].map(r => r.value + (r.checked ? '*' : '')).join(',') === 'todas*,mencoes,nada' && document.querySelector('.md select').closest('label').hidden), 0);
  await p.click('.md input[value="mencoes"]'); await p.selectOption('.md select', '8h'); await p.click('.md button[type="submit"]'); await p.waitForTimeout(300);
  c = await S(); const pref = c.avisos.ana.dados;
  t('🔕 por 8 h grava {nivel:mencoes, ate ≈ +8 h}', pref.nivel === 'mencoes' && Math.abs(pref.ate - Date.now() - 8 * 3600e3) < 60000, pref);
  t('ℹ️ Detalhes, o subtítulo do canal e a lista mostram 🔕', await p.evaluate(() => /^🔕 Avisos: só @menções/.test(document.querySelector('#lado .aviso-canal button').textContent) && /🔕 Só @menções/.test(document.getElementById('canal-sub').textContent) && document.querySelector('[data-canal="dados"] .aviso-ic').textContent === '🔕'), 0);
  await p.click('#lado .aviso-canal button'); await p.click('.md input[value="todas"]'); await p.click('.md button[type="submit"]'); await p.waitForTimeout(300);
  t('voltar a "Todas" apaga a preferência', !((await S()).avisos.ana || {}).dados, (await S()).avisos);

  await p.click('[data-canal="prf"]'); await p.waitForTimeout(400);
  c = await S();
  t('trocar de canal troca o sinal de vida (sai Dados, entra Performance)', !(c.vendo.ana || {}).dados && typeof c.vendo.ana.prf === 'number', c.vendo);
  await p.click('[data-canal="dados"]'); await p.waitForTimeout(300);
  await p.click('[data-msg="-Nd1"] button.tag'); await p.waitForTimeout(500);
  t('abrir a tela da #tag tira o sinal de vida', !((await S()).vendo.ana || {}).dados, (await S()).vendo);
  await p.click('.seguir-tag'); await p.waitForTimeout(300);
  t('🔔 Seguir #banner grava seguidas/ana/banner e vira "✓ Seguindo"', typeof ((await S()).seguidas || {}).ana?.banner === 'number' && await p.evaluate(() => document.querySelector('.seguir-tag').textContent === '✓ Seguindo #banner'), (await S()).seguidas);
  await p.click('[data-canal="dados"]'); await p.waitForTimeout(300); await p.click('#lado .aviso-canal button'); await p.waitForTimeout(150);
  t('o 🔔 lista as #tags seguidas', await p.evaluate(() => [...document.querySelectorAll('.lista-seguidas button')].map(b => b.textContent).join() === '#banner ✕'), 0);
  await p.click('.lista-seguidas button'); await p.waitForTimeout(300); await p.keyboard.press('Escape');
  t('✕ deixa de seguir', !((await S()).seguidas.ana || {}).banner, (await S()).seguidas);

  await p.evaluate(() => { document.hasFocus = () => false; window.dispatchEvent(new Event('blur')); }); await p.waitForTimeout(300);
  t('janela sem foco (aba esquecida aberta): o sinal de vida some', !(((await S()).vendo || {}).ana || {}).dados, (await S()).vendo);
  await p.evaluate(() => { document.hasFocus = () => true; window.dispatchEvent(new Event('focus')); }); await p.waitForTimeout(300);
  t('voltou o foco: o sinal volta', typeof (((await S()).vendo || {}).ana || {}).dados === 'number', (await S()).vendo);
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); }); await p.waitForTimeout(300);
  t('aba escondida: o sinal de vida some (o push volta a chegar)', !(((await S()).vendo || {}).ana || {}).dados, (await S()).vendo);

  const esc = await p.evaluate(() => window.__escritas || []);
  const real = Date.now; const ruins = [];
  for (const e of esc) { const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([k, v]) => [(e.p ? e.p + '/' : '') + k, v])); Date.now = () => e.t; let r; try { r = regras(RULES, e.antes, authDe(ANA), mapa); } finally { Date.now = real; } if (!r) ruins.push({ tipo: e.tipo, caminhos: Object.keys(mapa) }); }
  t('CADA escrita da página passa nas regras reais', esc.length > 0 && !ruins.length, { n: esc.length, ruins });
  t('sem erro de JS', !errs.length, errs);
  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
