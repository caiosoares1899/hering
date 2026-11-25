// 🐚 Concha — 🧵 avisos por assunto (PR B, 25/11/2026): ⋯ do assunto para qualquer membro com "🔔 Avisos deste assunto"
// (Como o canal · 🔔 Seguir · 🔕 Silenciar, com prazo); nome/encerrar só para quem pode; chip com 🔔/🔕; o 🔕 do assunto não acende o canal e o
// 🔔 acende mesmo sem ter aberto. Cada escrita conferida nas regras reais.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_assuntos_avisos.js
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
    assuntos: { dados: { abf: { n: 'banner', por: 'bru', criado: agora - 864e5 }, arel: { n: 'relatório', por: 'bru', criado: agora - 864e5 }, avaz: { n: 'vazio seguido', por: 'bru', criado: agora - 864e5 }, avaz2: { n: 'vazio comum', por: 'bru', criado: agora - 864e5 } } },
    msgs: { dados: { '-Ng1': { uid: 'bru', ts: agora - 9e5, texto: 'oi' }, '-Na1': { uid: 'bru', ts: agora - 8e5, texto: 'arte', a: 'abf' } }, prf: {} },
    ultima_a: { dados: { _geral: { ts: agora - 9e5, uid: 'bru', id: '-Ng1' }, abf: { ts: agora - 8e5, uid: 'bru', id: '-Na1' } } },
    lidas_a: { ana: { dados: { _geral: agora, abf: agora } } },
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
  await p.goto(base + '/cardume-dev.html?c=dados&a=abf'); await p.waitForFunction(() => !!window.__authCb);
  await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(1000);
  const S = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__store.kanban.cardume)));
  const chips = () => p.evaluate(() => [...document.querySelectorAll('#assuntos-barra button')].map(b => b.textContent));
  const externo = mapa => p.evaluate(m => { window.__onDisc = m; window.__simDisconnect(); }, mapa);
  const aceso = () => p.evaluate(() => document.querySelector('[data-canal="dados"]').classList.contains('nao-lido'));

  await p.click('#assuntos-barra [data-aid="_ger"]'); await p.waitForTimeout(150);
  t('⋯ do assunto (de outra pessoa, sem ser gestora): só "🔔 Avisos deste assunto", sem nome nem encerrar', await p.evaluate(() => document.querySelectorAll('.md input[name="nivelA"]').length === 3 && !document.querySelector('.md input:not([type])') && !document.querySelector('.md .perigo')), 0);
  await p.click('.md input[value="seguir"]'); await p.click('.md button[type="submit"]'); await p.waitForTimeout(300);
  let c = await S();
  t('🔔 Seguir grava avisos_a/ana/dados/abf = {nivel: seguir} e o chip mostra 🔔', c.avisos_a.ana.dados.abf.nivel === 'seguir' && (await chips()).some(x => x === '🧵 banner 🔔'), { a: c.avisos_a, ch: await chips() });
  await p.click('#assuntos-barra [data-aid="_ger"]'); await p.click('.md input[value="mencoes"]'); await p.selectOption('.md select', '8h'); await p.click('.md button[type="submit"]'); await p.waitForTimeout(300);
  c = await S(); const pr = c.avisos_a.ana.dados.abf;
  t('🔕 Silenciar por 8 h grava {nivel: mencoes, ate ≈ +8 h} e o chip mostra 🔕', pr.nivel === 'mencoes' && Math.abs(pr.ate - Date.now() - 8 * 3600e3) < 60000 && (await chips()).some(x => x === '🧵 banner 🔕'), pr);

  await p.click('[data-canal="prf"]'); await p.waitForTimeout(300);
  let tn = Date.now();
  await externo({ ['kanban/cardume/msgs/dados/-Na2']: ['set', { uid: 'bru', ts: tn, texto: 'mais arte', a: 'abf' }], ['kanban/cardume/ultima_a/dados/abf']: ['set', { ts: tn, uid: 'bru', id: '-Na2' }] }); await p.waitForTimeout(400);
  t('assunto em 🔕 com mensagem nova NÃO acende o canal', !(await aceso()), 0);
  tn = Date.now() + 1;
  await externo({ ['kanban/cardume/msgs/dados/-Nr1']: ['set', { uid: 'bru', ts: tn, texto: 'relatório saiu', a: 'arel' }], ['kanban/cardume/ultima_a/dados/arel']: ['set', { ts: tn, uid: 'bru', id: '-Nr1' }] }); await p.waitForTimeout(400);
  t('assunto nunca aberto (sem 🔔) também não acende', !(await aceso()), 0);
  await p.click('[data-canal="dados"]'); await p.waitForTimeout(400);
  await p.click('#assuntos-barra [data-aid="arel"]'); await p.waitForTimeout(400);
  await p.click('#assuntos-barra [data-aid="_ger"]'); await p.click('.md input[value="seguir"]'); await p.click('.md button[type="submit"]'); await p.waitForTimeout(300);
  await p.click('#assuntos-barra [data-aid="_ger"]'); await p.click('.md input[value="canal"]'); await p.click('.md button[type="submit"]'); await p.waitForTimeout(300);
  t('"Como o canal" apaga a preferência do assunto', !((await S()).avisos_a.ana.dados || {}).arel, (await S()).avisos_a);
  await p.click('#assuntos-barra [data-aid="_ger"]'); await p.click('.md input[value="seguir"]'); await p.click('.md button[type="submit"]'); await p.waitForTimeout(300);
  await p.click('[data-canal="prf"]'); await p.waitForTimeout(300);
  tn = Date.now() + 2;
  await externo({ ['kanban/cardume/msgs/dados/-Nr2']: ['set', { uid: 'bru', ts: tn, texto: 'versão 2', a: 'arel' }], ['kanban/cardume/ultima_a/dados/arel']: ['set', { ts: tn, uid: 'bru', id: '-Nr2' }] }); await p.waitForTimeout(400);
  t('assunto em 🔔 com mensagem nova acende o canal', await aceso(), 0);

  // assunto VAZIO (abrir não grava lido): só o 🔔 faz acender o canal
  await p.click('[data-canal="dados"]'); await p.waitForTimeout(300); await p.click('#assuntos-barra [data-aid="_lido"]').catch(() => {}); await p.waitForTimeout(300);
  await p.click('#assuntos-barra [data-aid="avaz2"]'); await p.waitForTimeout(400);
  t('(pré-condição) abrir um assunto vazio não grava lidas_a', !(((await S()).lidas_a.ana || {}).dados || {}).avaz2, (await S()).lidas_a);
  await p.click('[data-canal="prf"]'); await p.waitForTimeout(300);
  tn = Date.now() + 3;
  await externo({ ['kanban/cardume/msgs/dados/-Nv1']: ['set', { uid: 'bru', ts: tn, texto: 'primeira', a: 'avaz2' }], ['kanban/cardume/ultima_a/dados/avaz2']: ['set', { ts: tn, uid: 'bru', id: '-Nv1' }] }); await p.waitForTimeout(400);
  t('assunto vazio "como o canal" (nunca lido) não acende', !(await aceso()), 0);
  await p.click('[data-canal="dados"]'); await p.waitForTimeout(300); await p.click('#assuntos-barra [data-aid="avaz"]'); await p.waitForTimeout(400);
  t('(pré-condição) o outro assunto vazio também sem lidas_a', !(((await S()).lidas_a.ana || {}).dados || {}).avaz, 0);
  await p.click('#assuntos-barra [data-aid="_ger"]'); await p.click('.md input[value="seguir"]'); await p.click('.md button[type="submit"]'); await p.waitForTimeout(300);
  await p.click('[data-canal="prf"]'); await p.waitForTimeout(300);
  tn = Date.now() + 4;
  await externo({ ['kanban/cardume/msgs/dados/-Nv2']: ['set', { uid: 'bru', ts: tn, texto: 'primeira do seguido', a: 'avaz' }], ['kanban/cardume/ultima_a/dados/avaz']: ['set', { ts: tn, uid: 'bru', id: '-Nv2' }] }); await p.waitForTimeout(400);
  t('assunto vazio em 🔔 (nunca lido) acende o canal — o que o 🔔 garante', await aceso(), 0);

  const esc = await p.evaluate(() => window.__escritas || []);
  const real = Date.now; const ruins = [];
  for (const e of esc) { const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([k, v]) => [(e.p ? e.p + '/' : '') + k, v])); Date.now = () => e.t; let r; try { r = regras(RULES, e.antes, authDe(ANA), mapa); } finally { Date.now = real; } if (!r) ruins.push({ tipo: e.tipo, caminhos: Object.keys(mapa) }); }
  t('CADA escrita da página passa nas regras reais', esc.length > 0 && !ruins.length, { n: esc.length, ruins });
  t('sem erro de JS', !errs.length, errs);
  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
