// 🐚 Concha — 📝 Minhas notas (26/11/2026, ideia do Caio): canal só seu (eu-{uid}), vem desativado, ninguém além da dona lê (nem o ADM).
// Ativar, escrever (sem #tags indexadas), fixar, encaminhar PARA as notas, nenhum ⏩ saindo delas, desativar. Cada escrita nas regras reais.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_notas.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const { update: regras } = require('../../../functions/rules/rulesSim.js');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../database.rules.json'), 'utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const ag = Date.now();
const seed = () => ({ kanban: { usuarios: { ana: { role: 'membro', squads: { dados: true } } }, usuarios_publicos: { ana: { nome: 'Ana Lima', email: 'ana@ciahering.com.br' }, bru: { nome: 'Bruno Reis', email: 'bru@ciahering.com.br' } },
  cardume: { canais: { dados: { nome: 'Dados' } }, membros: { dados: { ana: true, bru: true } }, meus: { ana: { dados: true } },
    msgs: { dados: { d1: { uid: 'bru', ts: ag - 6e4, texto: 'link da planilha https://exemplo.com/p' } } } } } });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 400))); };
const authDe = u => ({ uid: u.uid, token: { email: u.email, firebase: { sign_in_provider: 'google.com' } } });
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const cr = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(cr) ? path.join(cr, fs.readdirSync(cr).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed());
  await ctx.addInitScript(() => { localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb);
  await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(1000);
  const S = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__store.kanban.cardume)));
  t('vem desativado: nada de "Minhas notas" na lista', await p.evaluate(() => !document.querySelector('[data-canal^="eu-"]')), 0);
  await p.click('#b-config'); await p.waitForTimeout(150);
  t('⚙️ Configurações tem Aparência, Minhas notas e Seções; explica que ninguém mais lê, nem o ADM', await p.evaluate(() => { const t = document.querySelector('.md.cfg').textContent; return /Aparência/.test(t) && /Minhas notas/.test(t) && /Seções/.test(t) && /nem o ADM/.test(t); }), 0);
  await p.click('.md.cfg button:has-text("Ativar Minhas notas")'); await p.waitForTimeout(400);
  await p.click('.md.cfg button:has-text("Abrir Minhas notas")'); await p.waitForTimeout(500);
  let c = await S();
  t('ativar grava notas/ana = true e abre as notas, no alto da lista', c.notas && c.notas.ana === true && await p.evaluate(() => document.querySelector('#lista-canais .canal').dataset.canal === 'eu-ana' && /Minhas notas/.test(document.getElementById('canal-titulo').textContent)), c.notas);
  t('cabeçalho: "Só você vê · nem o ADM"; sem @ e sem # na barra', await p.evaluate(() => /Só você vê · nem o ADM/.test(document.getElementById('canal-sub').textContent) && [...document.querySelectorAll('.barra-fmt [data-ins]')].every(x => x.hidden)), 0);
  await p.fill('#entrada', 'ideia: banner da #blackfriday'); await p.click('#b-enviar'); await p.waitForTimeout(500);
  c = await S(); const nota = Object.entries((c.msgs || {})['eu-ana'] || {})[0];
  t('a nota é gravada em msgs/eu-ana, e a #tag NÃO vai para o índice', nota && nota[1].texto === 'ideia: banner da #blackfriday' && !(c.tags && c.tags['eu-ana']) && !(c.tags_ult && c.tags_ult['eu-ana']), { nota, tags: c.tags });
  t('nada de cadastro do canal, membros ou "meus" para as notas', !(c.canais || {})['eu-ana'] && !(c.membros || {})['eu-ana'] && !((c.meus || {}).ana || {})['eu-ana'], { canais: c.canais, membros: c.membros });
  const k = nota && nota[0];
  await p.hover('[data-msg="' + k + '"]');
  t('nas notas não há ⏩ Encaminhar nem 📝 No card (das notas não sai)', await p.evaluate(id => !document.querySelector('[data-msg="' + id + '"] [aria-label="Encaminhar"]') && !document.querySelector('[data-msg="' + id + '"] [aria-label="Registrar no card do Maré"]'), k), 0);
  await p.click('[data-msg="' + k + '"] [aria-label^="Fix"]'); await p.waitForTimeout(150); await p.click('.md .tipo-fix button:has-text("No topo do canal")'); await p.waitForTimeout(400);
  c = await S();
  t('a dona fixa a própria nota no topo', c.fixadas && c.fixadas['eu-ana'] && c.fixadas['eu-ana'][k] && c.fixadas['eu-ana'][k].t === 'topo', c.fixadas);
  // encaminhar de Dados para as notas
  await p.click('[data-canal="dados"]'); await p.waitForTimeout(500);
  await p.hover('[data-msg="d1"]'); await p.click('[data-msg="d1"] [aria-label="Encaminhar"]'); await p.waitForTimeout(200);
  t('"Minhas notas" aparece como destino do encaminhar', await p.evaluate(() => !!document.querySelector('.md input[value="eu-ana"]')), 0);
  await p.click('.md input[value="eu-ana"]'); await p.waitForTimeout(250);
  t('sem aviso de público (só você vê)', await p.evaluate(() => document.querySelector('.enc-aviso').hidden), 0);
  await p.click('.md button[type=submit]'); await p.waitForTimeout(500);
  c = await S();
  t('a mensagem de Dados foi guardada nas notas, com a origem', Object.values(c.msgs['eu-ana']).some(m => m.enc && m.enc.c === 'dados' && m.texto === 'link da planilha https://exemplo.com/p'), c.msgs['eu-ana']);
  // desativar
  await p.click('[data-canal="eu-ana"]'); await p.waitForTimeout(400);
  p.once('dialog', d => d.accept());
  await p.click('#lado button:has-text("Desativar Minhas notas")'); await p.waitForTimeout(500);
  c = await S();
  t('desativar tira da lista e apaga só a preferência (as notas ficam)', !(c.notas || {}).ana && Object.keys(c.msgs['eu-ana']).length === 2 && await p.evaluate(() => !document.querySelector('[data-canal^="eu-"]')), { notas: c.notas });
  await p.click('#b-config'); await p.waitForTimeout(150);
  t('depois de desativar, o ⚙️ volta a oferecer "Ativar Minhas notas"', await p.evaluate(() => [...document.querySelectorAll('.md.cfg button')].some(b => /Ativar Minhas notas/.test(b.textContent))), 0);
  await p.keyboard.press('Escape');
  await p.click('#b-config'); await p.waitForTimeout(150); await p.click('.md.cfg input[name="peixes"][value="off"]'); await p.waitForTimeout(150);
  t('⚙️ › Peixes: "Sem peixes" vale na hora e fica só na Concha (concha_peixes)', await p.evaluate(() => localStorage.getItem('concha_peixes') === 'off' && !document.querySelector('.fish-ltr,.fish-rtl')), 0);
  await p.click('.md.cfg button:has-text("Organizar seções")'); await p.waitForTimeout(200);
  t('⚙️ › Organizar seções abre o modal de seções', await p.evaluate(() => /Suas seções/.test((document.querySelector('.md') || {}).textContent || '')), 0);
  await p.keyboard.press('Escape');
  const esc = await p.evaluate(() => window.__escritas || []);
  const real = Date.now; const ruins = [];
  for (const e of esc) { const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([kk, v]) => [(e.p ? e.p + '/' : '') + kk, v])); Date.now = () => e.t; let rr; try { rr = regras(RULES, e.antes, authDe(ANA), mapa); } finally { Date.now = real; } if (!rr) ruins.push({ tipo: e.tipo, caminhos: Object.keys(mapa) }); }
  t('CADA escrita da página passa nas regras reais', esc.length > 0 && !ruins.length, { n: esc.length, ruins });
  t('sem erro de JS', !errs.length, errs);
  await b.close(); console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
