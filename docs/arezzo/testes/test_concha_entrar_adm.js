// 🐚 Concha — ADM que ativou o canal mas não está nele (relato do Caio, 25/11/2026: "ele abriu sem quadro de texto").
// A conversa explica por que não há campo de escrever e dá "Entrar no canal" (sem o "Diga oi" enganoso); entrar põe o campo;
// no ℹ️ Detalhes a grade de emojis fica recolhida. Cada escrita conferida nas regras reais.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_entrar_adm.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const { update: regras } = require('../../../functions/rules/rulesSim.js');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../database.rules.json'), 'utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const CAI = { uid: 'cai', email: 'caio.soares@ciahering.com.br', displayName: 'Caio Soares', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const seed = () => ({ kanban: { usuarios: { cai: { role: 'adm', squads: { dados: true } } },
  usuarios_publicos: { cai: { nome: 'Caio Soares', email: 'caio.soares@ciahering.com.br' }, and: { nome: 'Andre Bucciarelli', email: 'andre@ciahering.com.br' } }, squads_meta: { dev: { label: 'Dev', emoji: '🧪' } },
  cardume: { canais: { dados: { nome: 'Dados' }, dev: { nome: 'Dev' } }, membros: { dados: { cai: true }, dev: { and: true } }, meus: { cai: { dados: true }, and: { dev: true } }, msgs: { dados: {}, dev: {} } } } });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 300))); };
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(chromeRoot) ? path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed());
  await ctx.addInitScript(() => { window.__limitarConsultas = true; localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); localStorage.setItem('cardume_lado', '1'); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/cardume-dev.html?c=dev'); await p.waitForFunction(() => !!window.__authCb);
  await p.evaluate(x => window.__authCb(x), CAI); await p.waitForTimeout(1000);
  const log = () => p.evaluate(() => document.getElementById('log').textContent);
  t('(pré-condição) sem campo de escrever (não é membro)', await p.evaluate(() => document.getElementById('rodape').hidden), 0);
  t('a conversa diz por quê e oferece "Entrar no canal" (sem o "Diga oi")', /administra este canal, mas não está nele/.test(await log()) && !/Diga oi/.test(await log()) && await p.evaluate(() => !!document.querySelector('#log .aviso-fora button.primary')), await log());
  t('ℹ️ Detalhes: emoji recolhido ("😀 Emoji do canal: 🧪 (padrão)"), grade escondida', await p.evaluate(() => { const d = document.querySelector('#lado details.emoji-det'); return d && !d.open && /Emoji do canal: 🧪 \(padrão\)/.test(d.querySelector('summary').textContent); }), 0);
  await p.click('#lado details.emoji-det summary'); await p.click('#lado .emoji-grade [aria-label="Emoji 🔥"]'); await p.waitForTimeout(300);
  t('abrir e escolher 🔥 continua gravando canais/dev/e', await p.evaluate(() => window.__store.kanban.cardume.canais.dev.e) === '🔥', 0);
  await p.click('#log .aviso-fora button.primary'); await p.waitForTimeout(600);
  const st = await p.evaluate(() => ({ m: window.__store.kanban.cardume.membros.dev.cai, eu: window.__store.kanban.cardume.meus.cai.dev, rod: document.getElementById('rodape').hidden, aviso: !!document.querySelector('#log .aviso-fora') }));
  t('"Entrar no canal" grava membros/dev/cai + meus/cai/dev, o campo aparece e o aviso some', st.m === true && st.eu === true && !st.rod && !st.aviso, st);
  t('agora o vazio é o normal ("Diga oi")', /Diga oi/.test(await log()), await log());
  const esc = await p.evaluate(() => window.__escritas || []); const real = Date.now; const ruins = [];
  for (const e of esc) { const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([k, v]) => [(e.p ? e.p + '/' : '') + k, v])); Date.now = () => e.t; let r; try { r = regras(RULES, e.antes, { uid: 'cai', token: { email: CAI.email, firebase: { sign_in_provider: 'google.com' } } }, mapa); } finally { Date.now = real; } if (!r) ruins.push(Object.keys(mapa)); }
  t('CADA escrita da página passa nas regras reais', esc.length > 0 && !ruins.length, ruins);
  t('sem erro de JS', !errs.length, errs);
  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
