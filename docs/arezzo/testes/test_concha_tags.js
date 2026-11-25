// 🐚 Concha — #️⃣ #tags nas mensagens (25/11/2026, docs/ideias/cardume-v0-banco.md › "#tags nas mensagens").
// Enviar indexa as #tags no mesmo update; #1966, código e âncora de link não viram tag; a etiqueta abre a tela da #tag com as mensagens
// de todos os canais da pessoa (e só deles); editar troca as entradas; apagar tira. Cada escrita da página conferida nas regras reais.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_tags.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const { update: regras } = require('../../../functions/rules/rulesSim.js');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../database.rules.json'), 'utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const pub = (uid, nome, init) => ({ uid, nome, init, email: uid + '@ciahering.com.br', squads: { dados: true } });
const agora = Date.now();
const seed = () => ({ kanban: {
  usuarios: { ana: { role: 'membro', squads: { dados: true } }, bru: { role: 'membro', squads: { dados: true } } },
  usuarios_publicos: { ana: pub('ana', 'Ana Lima', 'AL'), bru: pub('bru', 'Bruno Reis', 'BR') },
  cardume: {
    canais: { dados: { nome: 'Dados' }, prf: { nome: 'Performance' }, sec: { nome: 'Secreto' } },
    membros: { dados: { ana: true, bru: true }, prf: { ana: true, bru: true }, sec: { bru: true } }, meus: { ana: { dados: true, prf: true }, bru: { dados: true, prf: true, sec: true } },
    msgs: {
      dados: { '-Nd1': { uid: 'bru', ts: agora - 9 * 60000, texto: 'planejamento #banner semana 1' } },
      prf: { '-Np1': { uid: 'bru', ts: agora - 5 * 60000, texto: 'subiu o #Banner da campanha' } },
      sec: { '-Ns1': { uid: 'bru', ts: agora - 3 * 60000, texto: 'segredo #banner' } },
    },
    tags: { dados: { banner: { '-Nd1': agora - 9 * 60000 } }, prf: { banner: { '-Np1': agora - 5 * 60000 } }, sec: { banner: { '-Ns1': agora - 3 * 60000 } } },
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
  const enviar = async txt => { await p.fill('#entrada', txt); await p.keyboard.press('Enter'); await p.waitForTimeout(400); };
  const minhas = async () => { const c = await S(); return Object.entries(c.msgs.dados).filter(([, m]) => m.uid === 'ana' && !m.apagada).sort((a, b) => a[1].ts - b[1].ts); };

  await p.focus('#entrada');
  await enviar('Subiu o #Banner da #BlackFriday e a #Promoção (PR #1966) — `#codigo` https://x.com/a#ancora');
  let [k1, m1] = (await minhas()).pop(); let c = await S();
  const tagsDe = (cc, id) => Object.keys((cc.tags || {}).dados || {}).filter(t => (cc.tags.dados[t] || {})[id] != null).sort();
  t('enviar indexa #banner, #blackfriday e #promoção (minúsculas como escrito)', JSON.stringify(tagsDe(c, k1)) === JSON.stringify(['banner', 'blackfriday', 'promoção']), tagsDe(c, k1));
  t('#1966, `#codigo` e a âncora do link não viram tag', !['1966', 'codigo', 'ancora'].some(x => ((c.tags || {}).dados || {})[x]), Object.keys(c.tags.dados));
  t('o valor do índice é o ts da mensagem e tags_ult acompanha', c.tags.dados.banner[k1] === m1.ts && c.tags_ult.dados.banner === m1.ts, { idx: c.tags.dados.banner[k1], ts: m1.ts, ult: c.tags_ult });
  const etiquetas = await p.evaluate(id => [...document.querySelectorAll('[data-msg="' + id + '"] button.tag')].map(b => b.textContent), k1);
  t('na mensagem, #Banner, #BlackFriday e #Promoção viram etiqueta (como escritas); o resto fica texto', JSON.stringify(etiquetas) === JSON.stringify(['#Banner', '#BlackFriday', '#Promoção']), etiquetas);
  const hostil = '#<img src=x onerror=alert(1)>';
  await enviar('teste ' + hostil + ' e **#negrito**');
  const nTags = await p.evaluate(() => document.querySelectorAll('.texto img').length);
  t('texto hostil depois de # não vira HTML; #tag dentro de **negrito** vale', nTags === 0 && await p.evaluate(() => [...document.querySelectorAll('button.tag')].some(b => b.textContent === '#negrito')), nTags);

  // tela da #tag
  await p.click('[data-msg="' + k1 + '"] button.tag'); await p.waitForTimeout(700);
  const lista = await p.evaluate(() => [...document.querySelectorAll('#log .mencao-item')].map(b => b.querySelector('b').textContent + ' | ' + b.querySelector('.sub').textContent));
  t('a tela da #banner mostra as mensagens dos MEUS canais, da mais nova para a mais antiga', lista.length === 3 && /^# Dados · Ana Lima/.test(lista[0]) && /^# Performance · Bruno Reis/.test(lista[1]) && /^# Dados · Bruno Reis/.test(lista[2]), lista);
  t('...e nunca a do canal em que não estou (Secreto)', !lista.some(x => /Secreto|segredo/.test(x)), lista);
  t('título e campo: "#banner", sem campo de escrever', await p.evaluate(() => document.getElementById('canal-titulo').textContent === '#banner' && document.getElementById('rodape').hidden), await p.evaluate(() => document.getElementById('canal-titulo').textContent));
  t('a tela da #tag soltou as escutas do canal', await p.evaluate(() => !(window.__lis || []).some(l => /cardume\/msgs\//.test(l.p))), await p.evaluate(() => (window.__lis || []).map(l => l.p)));
  await p.click('#log .mencao-item >> nth=1'); await p.waitForTimeout(600);
  t('clicar leva à mensagem no canal (Performance, destacada)', await p.evaluate(() => window.__cardume.estado.atual === 'prf' && !!document.querySelector('[data-msg="-Np1"].destaque')), await p.evaluate(() => window.__cardume.estado));

  // editar troca as entradas
  await p.click('[data-canal="dados"]'); await p.waitForTimeout(400);
  await p.hover('[data-msg="' + k1 + '"]'); await p.click('[data-msg="' + k1 + '"] [aria-label="Editar"]');
  await p.fill('[data-msg="' + k1 + '"] textarea', 'Subiu o #Banner e a #arte nova'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  c = await S();
  t('editar: sai #blackfriday/#promoção, entra #arte (com o ts original); #banner fica', JSON.stringify(tagsDe(c, k1)) === JSON.stringify(['arte', 'banner']) && c.tags.dados.arte[k1] === m1.ts, tagsDe(c, k1));

  // apagar tira
  await p.hover('[data-msg="' + k1 + '"]'); await p.click('[data-msg="' + k1 + '"] [aria-label="Apagar"]'); await p.waitForTimeout(5600);
  c = await S();
  t('apagar (depois dos 5 s) tira a mensagem de todas as #tags', !tagsDe(c, k1).length && c.msgs.dados[k1].apagada === true, tagsDe(c, k1));

  // reserva: o banco recusa só o índice (regras ainda não publicadas) → a mensagem sai mesmo assim, sem índice
  await p.evaluate(() => { window.__denySet = (pp, v) => !!v && typeof v === 'object' && Object.keys(v).some(k => /cardume\/tags(_ult)?\//.test(k)); });
  await enviar('reserva #indice');
  c = await S();
  const reserva = Object.values(c.msgs.dados).some(m => m.texto === 'reserva #indice') && !((c.tags || {}).dados || {}).indice;
  t('com as #tags recusadas pelo banco, a mensagem sai mesmo assim (sem o índice)', reserva, Object.keys(c.tags.dados));
  t('...e o campo fica limpo, sem aviso de erro', await p.evaluate(() => document.getElementById('entrada').value === ''), await p.evaluate(() => document.getElementById('entrada').value));
  await p.evaluate(() => { window.__denySet = null; });

  const esc = await p.evaluate(() => window.__escritas || []);
  const real = Date.now; const ruins = [];
  for (const e of esc) { const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([k, v]) => [(e.p ? e.p + '/' : '') + k, v])); Date.now = () => e.t; let r; try { r = regras(RULES, e.antes, authDe(ANA), mapa); } finally { Date.now = real; } if (!r) ruins.push({ tipo: e.tipo, caminhos: Object.keys(mapa) }); }
  t('CADA escrita da página passa nas regras reais', esc.length > 0 && !ruins.length, { n: esc.length, ruins });
  t('sem erro de JS', !errs.length, errs);
  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
