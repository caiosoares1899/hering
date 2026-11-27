// 🐚 Concha — 🏷️ Etiquetas por pessoa, por canal (27/11/2026, docs/ideias/cardume-v0-banco.md › "🏷️ Etiquetas").
// A etiqueta de cada um aparece ao lado do nome nas mensagens e na lista de membros (só de quem é membro); "🏷️ Sua etiqueta" nos Detalhes
// abre o modal (sugestões, limite, espaços limpos, Tirar); sair do canal leva a etiqueta junto; nada disso no Geral nem nas notas;
// texto com HTML entra como texto. Cada escrita conferida nas regras reais.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_etiquetas.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const { update: regras } = require('../../../functions/rules/rulesSim.js');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../database.rules.json'), 'utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const agora = Date.now();
const seed = () => ({ kanban: {
  usuarios: { ana: { role: 'membro', squads: { dados: true } } },
  usuarios_publicos: { ana: { nome: 'Ana Lima', email: 'ana@ciahering.com.br' }, bru: { nome: 'Bruno Reis', email: 'bru@ciahering.com.br' }, car: { nome: 'Carla Dias', email: 'car@ciahering.com.br' } },
  cardume: {
    canais: { dados: { nome: 'Dados' }, prf: { nome: 'Performance' } },
    membros: { dados: { ana: true, bru: true }, prf: { ana: true, bru: true } }, meus: { ana: { dados: true, prf: true } },
    msgs: { dados: { '-Nd1': { uid: 'bru', ts: agora - 6e4, texto: 'bom dia' }, '-Nd2': { uid: 'car', ts: agora - 5e4, texto: 'saí do canal' } }, geral: { '-Ng1': { uid: 'bru', ts: agora - 4e4, texto: 'comunicado' } } },
    etiquetas: { dados: { bru: '<b>Plantão</b>', car: 'Ex-membro' }, prf: { bru: 'Mídia paga' } },
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
  await ctx.addInitScript(() => { window.__limitarConsultas = true; localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); localStorage.setItem('cardume_lado', '1'); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb);
  await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(900);
  const S = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__store.kanban.cardume)));
  const autorEtq = id => p.evaluate(i => { const g = document.querySelector('[data-msg="' + i + '"]').closest('.grupo'); const e = g && g.querySelector('.autor .etq'); return e ? e.textContent : null; }, id);

  t('na conversa, a etiqueta do Bruno aparece ao lado do nome', await autorEtq('-Nd1') === '<b>Plantão</b>', await autorEtq('-Nd1'));
  t('HTML na etiqueta entra como texto (nenhum <b> criado)', await p.evaluate(() => !document.querySelector('.autor .etq b')), 0);
  t('quem não é mais membro (Carla) não mostra etiqueta', await autorEtq('-Nd2') === null, await autorEtq('-Nd2'));
  if (await p.evaluate(() => document.getElementById('lado').hidden)) { await p.click('#b-lado'); await p.waitForTimeout(200); }
  t('na lista de membros, a etiqueta aparece ao lado do nome', await p.evaluate(() => [...document.querySelectorAll('#lado .pessoa')].some(l => /Bruno Reis/.test(l.textContent) && (l.querySelector('.etq') || {}).textContent === '<b>Plantão</b>')), 0);
  t('nos Detalhes: "🏷️ Sua etiqueta: nenhuma"', await p.evaluate(() => [...document.querySelectorAll('#lado button')].some(x => x.textContent === '🏷️ Sua etiqueta: nenhuma')), 0);

  await p.evaluate(() => [...document.querySelectorAll('#lado button')].find(x => /^🏷️ Sua etiqueta/.test(x.textContent)).click()); await p.waitForTimeout(150);
  t('o modal abre com foco no campo, limite de 24 e sugestões', await p.evaluate(() => { const i = document.querySelector('.md input[type="text"]'); return document.activeElement === i && i.maxLength === 24 && document.querySelectorAll('.md .etq-sug button').length >= 6; }), 0);
  await p.fill('.md input[type="text"]', '   Design \n  e   UX   '); await p.click('.md button[type="submit"]'); await p.waitForTimeout(400);
  let c = await S();
  t('salvar limpa espaços e grava etiquetas/dados/ana = "Design e UX"', ((c.etiquetas || {}).dados || {}).ana === 'Design e UX', c.etiquetas);
  t('o botão dos Detalhes mostra a etiqueta nova', await p.evaluate(() => [...document.querySelectorAll('#lado button')].some(x => x.textContent === '🏷️ Sua etiqueta: Design e UX')), 0);

  await p.evaluate(() => [...document.querySelectorAll('#lado button')].find(x => /^🏷️ Sua etiqueta/.test(x.textContent)).click()); await p.waitForTimeout(150);
  await p.click('.md .etq-sug button:has-text("Plantão")'); await p.click('.md button[type="submit"]'); await p.waitForTimeout(400);
  t('a sugestão "Plantão" troca a etiqueta', ((await S()).etiquetas.dados || {}).ana === 'Plantão', (await S()).etiquetas);
  await p.fill('#entrada', 'olá, time'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  const minha = await p.evaluate(() => { const ms = [...document.querySelectorAll('#log .msg')]; const g = ms[ms.length - 1].closest('.grupo'); return (g.querySelector('.autor .etq') || {}).textContent; });
  t('a mensagem nova da Ana sai com a etiqueta dela', minha === 'Plantão', minha);

  await p.evaluate(() => [...document.querySelectorAll('#lado button')].find(x => /^🏷️ Sua etiqueta/.test(x.textContent)).click()); await p.waitForTimeout(150);
  await p.click('.md button.perigo'); await p.waitForTimeout(400);
  t('"Tirar etiqueta" apaga', !((await S()).etiquetas.dados || {}).ana, (await S()).etiquetas);

  await p.click('[data-canal="prf"]'); await p.waitForTimeout(400);
  t('a etiqueta é por canal: em Performance o Bruno é "Mídia paga"', await p.evaluate(() => [...document.querySelectorAll('#lado .pessoa')].some(l => /Bruno Reis/.test(l.textContent) && (l.querySelector('.etq') || {}).textContent === 'Mídia paga')), 0);
  await p.evaluate(() => [...document.querySelectorAll('#lado button')].find(x => /^🏷️ Sua etiqueta/.test(x.textContent)).click()); await p.waitForTimeout(150);
  await p.fill('.md input[type="text"]', 'Análise'); await p.click('.md button[type="submit"]'); await p.waitForTimeout(400);
  p.once('dialog', d => d.accept());
  await p.evaluate(() => [...document.querySelectorAll('#lado button')].find(x => x.textContent === 'Sair do canal').click()); await p.waitForTimeout(600);
  c = await S();
  t('sair do canal leva a etiqueta junto (mesmo update)', !((c.etiquetas || {}).prf || {}).ana && !((c.membros || {}).prf || {}).ana, { e: c.etiquetas, m: c.membros });

  await p.click('[data-canal="geral"]'); await p.waitForTimeout(400);
  t('no Geral não há "Sua etiqueta"', await p.evaluate(() => ![...document.querySelectorAll('#lado button')].some(x => /^🏷️ Sua etiqueta/.test(x.textContent))), 0);

  await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(150);
  await p.evaluate(() => document.querySelector('[data-canal="dados"]').click()); await p.waitForTimeout(400);
  t('celular: sem rolagem lateral na conversa com etiquetas', await p.evaluate(() => document.documentElement.scrollWidth <= 391), 0);

  const esc = await p.evaluate(() => window.__escritas || []);
  const real = Date.now; const ruins = [];
  for (const e of esc) { const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([k, v]) => [(e.p ? e.p + '/' : '') + k, v])); Date.now = () => e.t; let r; try { r = regras(RULES, e.antes, authDe(ANA), mapa); } finally { Date.now = real; } if (!r) ruins.push({ tipo: e.tipo, caminhos: Object.keys(mapa) }); }
  t('CADA escrita da página passa nas regras reais', esc.length > 0 && !ruins.length, { n: esc.length, ruins });
  t('sem erro de JS', !errs.length, errs);
  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
