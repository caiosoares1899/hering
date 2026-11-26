// 🐚 Concha — ⏩ encaminhar (25/11/2026, docs/ideias/cardume-v0-banco.md › "Encaminhar mensagem"). Decisões do Caio: mostra o canal de origem;
// avisa antes quando mais gente vai ver (alguém no destino que não está na origem, ou destino aberto). Encaminhada não se edita nem se re-encaminha;
// @menção não avisa de novo. Cada escrita conferida nas regras reais.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_encaminhar.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const { update: regras } = require('../../../functions/rules/rulesSim.js');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../database.rules.json'), 'utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const ag = Date.now();
const P = n => ({ nome: n, email: n.split(' ')[0].toLowerCase() + '@ciahering.com.br' });
const tema = (nome, acesso) => ({ nome, tipo: 'tema', dono: 'ana', acesso, criado: ag - 864e5 });
const seed = () => ({ kanban: { usuarios: { ana: { role: 'membro', squads: { dados: true } } }, usuarios_publicos: { ana: P('Ana Lima'), bru: P('Bruno Reis'), car: P('Carla Dias') },
  squads: { dados: { dados: { cards: { 0: { id: 'cBanner', title: 'Banner da BF', col: 'backlog' } }, cards_index: { cBanner: '0' } } } },
  cardume: {
    canais: { dados: { nome: 'Dados' }, prf: { nome: 'Performance' }, 't-priv-ab12': tema('Privado', 'convite'), 't-geral-cd34': tema('Geral', 'aberto') },
    abertos: { 't-geral-cd34': { nome: 'Geral' } },
    membros: { dados: { ana: true, bru: true }, prf: { ana: true, bru: true, car: true }, 't-priv-ab12': { ana: true, bru: true }, 't-geral-cd34': { ana: true } },
    meus: { ana: { dados: true, prf: true, 't-priv-ab12': true, 't-geral-cd34': true } },
    msgs: { dados: { k1: { uid: 'bru', ts: ag - 6e5, texto: 'proposta do #banner, @Ana Lima' } }, prf: {}, 't-priv-ab12': {}, 't-geral-cd34': { g1: { uid: 'ana', ts: ag - 5e5, texto: 'aviso geral' } } },
  } } });
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
  await p.hover('[data-msg="k1"]'); await p.click('[data-msg="k1"] [aria-label="Encaminhar"]'); await p.waitForTimeout(150);
  const dest = await p.evaluate(() => [...document.querySelectorAll('.md input[name="dest"]')].map(r => r.value).sort());
  t('⏩ abre com os outros canais seus (o atual fica de fora)', JSON.stringify(dest) === JSON.stringify(['prf', 't-geral-cd34', 't-priv-ab12']), dest);
  const sel = async v => { await p.click('.md input[value="' + v + '"]'); await p.waitForTimeout(250); return p.evaluate(() => ({ aviso: document.querySelector('.enc-aviso').hidden ? '' : document.querySelector('.enc-aviso').textContent, bt: document.querySelector('.md button[type=submit]').textContent })); };
  let r = await sel('t-priv-ab12');
  t('destino com as MESMAS pessoas (Privado ⊆ Dados): sem aviso', !r.aviso && r.bt === '⏩ Encaminhar', r);
  r = await sel('prf');
  t('destino com gente de fora (Carla em Performance): avisa antes, "mesmo assim"', /1 pessoa em Performance não está em Dados/.test(r.aviso) && /mesmo assim/.test(r.bt), r);
  r = await sel('t-geral-cd34');
  t('destino temático aberto: avisa que qualquer pessoa da Hering pode entrar', /aberto: qualquer pessoa da Hering/.test(r.aviso), r);
  await sel('t-priv-ab12'); await p.click('.md button[type=submit]'); await p.waitForTimeout(500);
  const c = await S(); const [k, m] = Object.entries(c.msgs['t-priv-ab12'])[0] || [];
  t('grava no destino: mesmo texto + enc {c, m, de, ts, n: "Dados"}', m && m.texto === 'proposta do #banner, @Ana Lima' && m.uid === 'ana' && m.enc && m.enc.c === 'dados' && m.enc.m === 'k1' && m.enc.de === 'bru' && m.enc.n === 'Dados' && typeof m.enc.ts === 'number', m);
  t('não lidas do destino (ultima + ultima_a/_geral) e #tag no índice do destino', c.ultima['t-priv-ab12'].id === k && c.ultima_a['t-priv-ab12']._geral.id === k && c.tags['t-priv-ab12'].banner[k] != null, { u: c.ultima, ua: c.ultima_a, t: c.tags });
  t('@menção do texto NÃO avisa de novo (nenhum registro de menção)', !c.mencoes, c.mencoes);
  await p.click('[data-canal="t-priv-ab12"]'); await p.waitForTimeout(500);
  t('na conversa: "⏩ Encaminhada de Bruno Reis · # Dados"', await p.evaluate(() => /⏩ Encaminhada de Bruno Reis · # Dados/.test((document.querySelector('#log .enc-de') || {}).textContent || '')), await p.evaluate(() => (document.querySelector('#log .enc-de') || {}).textContent));
  await p.hover('#log .msg');
  t('encaminhada: sem ✏️ (mesmo sendo minha e recente) e sem ⏩ (não re-encaminha)', await p.evaluate(() => { const b = document.querySelector('#log .msg'); return !b.querySelector('[aria-label="Editar"]') && !b.querySelector('[aria-label="Encaminhar"]') && !!b.querySelector('[aria-label="Apagar"]'); }), 0);
  // 📝 No card com a encaminhada: o comentário credita QUEM ESCREVEU (Bruno), não quem encaminhou
  await p.hover('#log .msg'); await p.click('#log .msg [aria-label="Registrar no card do Maré"]'); await p.waitForTimeout(200);
  await p.fill('.md.registrar input[type=url]', 'https://caiosoares1899.github.io/hering/kanban-dev.html?squad=dados&opencard=cBanner'); await p.waitForTimeout(600);
  await p.click('.md.registrar button[type=submit]'); await p.waitForTimeout(600);
  const com = Object.values(((await S()) && (await p.evaluate(() => JSON.parse(JSON.stringify(window.__store.kanban.squads.dados.dados.card_comments || {}))))).cBanner || {})[0];
  t('📝 No card: "**Bruno Reis** (encaminhada por Ana Lima · #Dados, …): …" — o texto não fica no nome de quem encaminhou', com && /\*\*Bruno Reis\*\* \(encaminhada por Ana Lima · #Dados, /.test(com.text) && !/\*\*Ana Lima\*\* \(/.test(com.text), com && com.text);
  // origem temática ABERTA: qualquer pessoa da Hering já pode ler lá — não avisa nem para um canal com mais gente
  await p.click('[data-canal="t-geral-cd34"]'); await p.waitForTimeout(400);
  await p.hover('[data-msg="g1"]'); await p.click('[data-msg="g1"] [aria-label="Encaminhar"]'); await p.waitForTimeout(150);
  r = await sel('prf');
  t('origem aberta → destino com mais gente: sem aviso', !r.aviso && r.bt === '⏩ Encaminhar', r);
  await p.keyboard.press('Escape');

  const esc = await p.evaluate(() => window.__escritas || []);
  const real = Date.now; const ruins = [];
  for (const e of esc) { const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([kk, v]) => [(e.p ? e.p + '/' : '') + kk, v])); Date.now = () => e.t; let rr; try { rr = regras(RULES, e.antes, authDe(ANA), mapa); } finally { Date.now = real; } if (!rr) ruins.push({ tipo: e.tipo, caminhos: Object.keys(mapa) }); }
  t('CADA escrita da página passa nas regras reais', esc.length > 0 && !ruins.length, { n: esc.length, ruins });
  t('sem erro de JS', !errs.length, errs);
  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
