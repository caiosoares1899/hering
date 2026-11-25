// 🐚 Concha — 📁 seções na lista de canais (25/11/2026): organização pessoal (kanban/cardume/secoes/{uid}).
// Criar ⭐ Favoritos e Projetos, mover canal pelos Detalhes, recolher (com "N novas" e o canal aberto à vista), reordenar, apagar devolve ao padrão.
// Cada escrita conferida nas regras reais.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_secoes.js
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
    canais: { dados: { nome: 'Dados' }, prf: { nome: 'Performance' }, 't-bf-ab12': { nome: 'Black Friday', tipo: 'tema', dono: 'ana', acesso: 'aberto', criado: agora - 864e5 } },
    abertos: { 't-bf-ab12': { nome: 'Black Friday' } },
    membros: { dados: { ana: true, bru: true }, prf: { ana: true, bru: true }, 't-bf-ab12': { ana: true } }, meus: { ana: { dados: true, prf: true, 't-bf-ab12': true } },
    msgs: { prf: { '-Np1': { uid: 'bru', ts: agora - 6e4, texto: 'nova' } } }, ultima: { prf: { ts: agora - 6e4, uid: 'bru', id: '-Np1' } },
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
  const S = () => p.evaluate(() => JSON.parse(JSON.stringify((window.__store.kanban.cardume.secoes || {}).ana || {})));
  const lista = () => p.evaluate(() => [...document.querySelectorAll('#lista-canais > *')].map(e => e.classList.contains('sec-cab') ? '[' + e.textContent + ']' : e.dataset.canal));

  t('sem seções: Squads e Temáticos como sempre', JSON.stringify(await lista()) === JSON.stringify(['[▾Squads]', 'dados', 'prf', '[▾Temáticos]', 't-bf-ab12']), await lista());
  await p.click('#b-secoes'); await p.waitForTimeout(150);
  await p.click('.md button.lnk:has-text("Favoritos")'); await p.fill('.md input[placeholder^="Nova seção"]', 'Projetos'); await p.click('.md button[type="submit"]'); await p.waitForTimeout(300);
  let sc = await S(); const ids = Object.entries(sc.s || {}).sort((a, b) => a[1].o - b[1].o).map(([k, x]) => [k, x.n, x.o]);
  t('criar ⭐ Favoritos e Projetos (Projetos digitado e salvo direto)', ids.length === 2 && ids[0][1] === '⭐ Favoritos' && ids[1][1] === 'Projetos', ids);
  const [fav, proj] = ids.map(x => x[0]);

  t('o canal aberto tem "📁 Na sua lista" nos Detalhes, em Squads (padrão)', await p.evaluate(() => { const s = document.querySelector('#lado select'); return !!s && s.value === '' && [...s.options].map(o => o.text).join('|') === 'Squads (padrão)|⭐ Favoritos|Projetos|＋ Nova seção…'; }), 0);
  await p.selectOption('#lado select', fav); await p.waitForTimeout(300);
  await p.click('[data-canal="t-bf-ab12"]'); await p.waitForTimeout(300); await p.selectOption('#lado select', proj); await p.waitForTimeout(300);
  t('Dados → ⭐ Favoritos e Black Friday → Projetos, na ordem das seções', JSON.stringify(await lista()) === JSON.stringify(['[▾⭐ Favoritos]', 'dados', '[▾Projetos]', 't-bf-ab12', '[▾Squads]', 'prf']), await lista());

  await p.click('.sec-cab:has-text("Squads")'); await p.waitForTimeout(300);
  t('recolher Squads esconde Performance e avisa "1 nova"', JSON.stringify(await lista()) === JSON.stringify(['[▾⭐ Favoritos]', 'dados', '[▾Projetos]', 't-bf-ab12', '[▸Squads1 nova]']), await lista());
  t('recolhida fica gravada na conta (vale em todo aparelho)', (await S()).r.squads === true, (await S()).r);
  await p.click('.sec-cab:has-text("Projetos")'); await p.waitForTimeout(300);
  t('recolhida, a seção mantém à vista o canal aberto (Black Friday)', JSON.stringify(await lista()).includes('"[▸Projetos]","t-bf-ab12"'), await lista());
  t('o título diz que está recolhida (aria-expanded=false)', await p.evaluate(() => document.querySelector('.sec-cab[aria-expanded="false"]') !== null), 0);

  await p.click('#b-secoes'); await p.waitForTimeout(150);
  await p.click('.md [aria-label="Descer ⭐ Favoritos"]'); await p.click('.md [aria-label="Apagar Projetos"]'); await p.click('.md button[type="submit"]'); await p.waitForTimeout(300);
  sc = await S();
  t('apagar Projetos devolve Black Friday a Temáticos e limpa o recolhido dela', !sc.s[proj] && !(sc.c || {})['t-bf-ab12'] && !(sc.r || {})[proj], sc);
  t('a lista volta: ⭐ Favoritos, Squads (recolhida), Temáticos', JSON.stringify(await lista()) === JSON.stringify(['[▾⭐ Favoritos]', 'dados', '[▸Squads1 nova]', '[▾Temáticos]', 't-bf-ab12']), await lista());
  await p.selectOption('#lado select', '+nova'); await p.waitForTimeout(150);
  await p.fill('.md input[placeholder^="Nova seção"]', 'Campanhas'); await p.click('.md button[type="submit"]'); await p.waitForTimeout(300);
  sc = await S(); const camp = Object.keys(sc.s).find(k => sc.s[k].n === 'Campanhas');
  t('"＋ Nova seção…" nos Detalhes cria a seção e já põe o canal nela', !!camp && sc.c['t-bf-ab12'] === camp, sc);

  const esc = await p.evaluate(() => window.__escritas || []);
  const real = Date.now; const ruins = [];
  for (const e of esc) { const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([k, v]) => [(e.p ? e.p + '/' : '') + k, v])); Date.now = () => e.t; let r; try { r = regras(RULES, e.antes, authDe(ANA), mapa); } finally { Date.now = real; } if (!r) ruins.push({ tipo: e.tipo, caminhos: Object.keys(mapa) }); }
  t('CADA escrita da página passa nas regras reais', esc.length > 0 && !ruins.length, { n: esc.length, ruins });
  t('sem erro de JS', !errs.length, errs);
  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
