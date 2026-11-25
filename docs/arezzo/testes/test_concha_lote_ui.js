// 🐚 Concha — lote de tela de 25/11/2026 (pedidos do Caio no Quadro): foto na lista do @, botões @ e # na barra com a lista de #tags,
// explicação da formatação (?), e quem reagiu à vista (até 3 nomes no chip; mais que isso, tocar abre a lista com "Reagir também").
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_lote_ui.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const { update: regras } = require('../../../functions/rules/rulesSim.js');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../database.rules.json'), 'utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const agora = Date.now();
const P = (nome, foto) => ({ nome, email: nome.split(' ')[0].toLowerCase() + '@ciahering.com.br', foto: foto || '' });
const seed = () => ({ kanban: {
  usuarios: { ana: { role: 'membro', squads: { dados: true } } },
  usuarios_publicos: { ana: P('Ana Lima'), bru: P('Bruno Reis', 'https://lh3.googleusercontent.com/a/bru'), car: P('Carla Dias'), dan: P('Dani Souza'), edu: P('Edu Melo') },
  cardume: {
    canais: { dados: { nome: 'Dados' } }, membros: { dados: { ana: true, bru: true, car: true, dan: true, edu: true } }, meus: { ana: { dados: true } },
    msgs: { dados: { '-Nm1': { uid: 'bru', ts: agora - 6e4, texto: 'proposta' } } },
    reacoes: { dados: { '-Nm1': { bru: '❤️', car: '❤️', dan: '❤️', edu: '❤️' } } },
    tags_ult: { dados: { blackfriday: agora - 1e4, banner: agora - 2e4, promoção: agora - 3e4 } },
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
  const sug = () => p.evaluate(() => [...document.querySelectorAll('#sugestoes .sugestao')].map(o => ({ t: o.textContent, img: (o.querySelector('img') || {}).src || '', ini: (o.querySelector('.avatar') || {}).textContent || '' })));

  // 📸 foto no @
  await p.click('.barra-fmt [data-ins="@"]'); await p.keyboard.type('Br'); await p.waitForTimeout(150);
  let s = await sug();
  t('botão @ insere @ e a lista mostra a foto da pessoa', s.length === 1 && s[0].t.endsWith('@Bruno Reis') && /lh3\.googleusercontent\.com\/a\/bru/.test(s[0].img), s);
  await p.fill('#entrada', ''); await p.keyboard.type('@C'); await p.waitForTimeout(150); s = await sug();
  t('sem foto, as iniciais (como nas mensagens)', s.length === 1 && s[0].ini === 'CD', s);
  await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  t('Enter escolhe e põe "@Carla Dias "', await p.evaluate(() => document.getElementById('entrada').value === '@Carla Dias '), await p.evaluate(() => document.getElementById('entrada').value));

  // # com a lista das #tags
  await p.fill('#entrada', 'olha o'); await p.click('.barra-fmt [data-ins="#"]'); await p.waitForTimeout(400); s = await sug();
  t('botão # (colado em palavra põe espaço) lista as #tags dos meus canais, da mais recente', await p.evaluate(() => document.getElementById('entrada').value === 'olha o #') && JSON.stringify(s.map(x => x.t)) === JSON.stringify(['#blackfriday', '#banner', '#promoção']), { v: await p.evaluate(() => document.getElementById('entrada').value), s });
  await p.keyboard.type('promoca'); await p.waitForTimeout(150); s = await sug();
  t('sem acento: "#promoca" sugere #promoção', JSON.stringify(s.map(x => x.t)) === JSON.stringify(['#promoção']), s);
  await p.keyboard.press('Tab'); await p.waitForTimeout(100);
  t('Tab escolhe e põe "#promoção "', await p.evaluate(() => document.getElementById('entrada').value === 'olha o #promoção '), await p.evaluate(() => document.getElementById('entrada').value));

  // ? explicação
  t('cada botão da barra explica e dá o atalho (title)', await p.evaluate(() => /\*\*texto\*\*.*Ctrl\+B/.test(document.querySelector('[data-fmt="**"]').title) && /#tag/.test(document.querySelector('[data-ins="#"]').title)), 0);
  await p.click('#b-fmt-ajuda'); await p.waitForTimeout(100);
  t('"?" abre o guia de formatação, com #tag e @', await p.evaluate(() => { const a = document.getElementById('fmt-ajuda'); return !a.hidden && /#assunto/.test(a.textContent) && /@Nome/.test(a.textContent) && document.getElementById('b-fmt-ajuda').getAttribute('aria-expanded') === 'true'; }), 0);
  await p.click('#b-fmt-ajuda');

  // 😀 quem reagiu
  const chips = () => p.evaluate(() => [...document.querySelectorAll('[data-msg="-Nm1"] .rx-chip')].map(c => c.textContent));
  t('mais de 3: "❤️ 4"', JSON.stringify(await chips()) === JSON.stringify(['❤️ 4']), await chips());
  await p.click('[data-msg="-Nm1"] .rx-chip'); await p.waitForTimeout(200);
  const lista = await p.evaluate(() => (document.querySelector('[data-msg="-Nm1"] .rx-lista') || {}).textContent || '');
  t('tocar no chip abre a lista com todos os nomes e "Reagir também" (sem reagir sozinho)', /Bruno Reis, Carla Dias, Dani Souza, Edu Melo/.test(lista) && /Reagir também/.test(lista) && !(((await p.evaluate(() => window.__store.kanban.cardume.reacoes.dados['-Nm1']))) || {}).ana, lista);
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  t('Esc fecha a lista', !(await p.$('[data-msg="-Nm1"] .rx-lista')), 0);
  await p.click('[data-msg="-Nm1"] .rx-chip'); await p.click('[data-msg="-Nm1"] .rx-lista button.primary'); await p.waitForTimeout(300);
  t('"Reagir também" grava a minha e o chip vira "❤️ 5"', (await p.evaluate(() => window.__store.kanban.cardume.reacoes.dados['-Nm1'].ana)) === '❤️' && JSON.stringify(await chips()) === JSON.stringify(['❤️ 5']), await chips());

  const esc = await p.evaluate(() => window.__escritas || []);
  const real = Date.now; const ruins = [];
  for (const e of esc) { const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([k, v]) => [(e.p ? e.p + '/' : '') + k, v])); Date.now = () => e.t; let r; try { r = regras(RULES, e.antes, authDe(ANA), mapa); } finally { Date.now = real; } if (!r) ruins.push({ tipo: e.tipo, caminhos: Object.keys(mapa) }); }
  t('CADA escrita da página passa nas regras reais', esc.length > 0 && !ruins.length, { n: esc.length, ruins });
  t('sem erro de JS', !errs.length, errs);
  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
