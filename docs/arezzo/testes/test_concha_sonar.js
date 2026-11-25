// 🐚 Concha — 🔍 Sonar (Ctrl/⌘+K, mare-sonar-dev.js) com canais, #tags e pessoas (25/11/2026; só da Concha, decisão do Caio).
// Acha canais (os mesmos da lista), #tags dos MEUS canais (tags_ult, sem baixar o índice, sem acento), pessoas da Hering; "#" busca só tags;
// pessoa abre os canais em comum; nada de canal em que não estou; recente de outra conta não aparece. Sem escrita no banco.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_sonar.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const pub = (uid, nome, email) => ({ uid, nome, email: email || uid + '@ciahering.com.br', squads: { dados: true } });
const agora = Date.now();
const seed = () => ({ kanban: {
  usuarios: { ana: { role: 'membro', squads: { dados: true } } },
  usuarios_publicos: { ana: pub('ana', 'Ana Lima'), bru: pub('bru', 'Bruno Reis'), car: pub('car', 'Carla Dias'), ext: pub('ext', 'Bruno Externo', 'ext@gmail.com') },
  cardume: {
    canais: { dados: { nome: 'Dados' }, prf: { nome: 'Performance' }, sec: { nome: 'Secreto' }, 't-black-friday-ab12': { nome: 'Black Friday', tipo: 'tema', dono: 'bru', acesso: 'aberto', criado: agora - 864e5 } },
    abertos: { 't-black-friday-ab12': { nome: 'Black Friday' } },
    membros: { dados: { ana: true, bru: true }, prf: { ana: true, car: true }, sec: { bru: true, car: true }, 't-black-friday-ab12': { bru: true } },
    meus: { ana: { dados: true, prf: true } },
    msgs: { dados: { '-Nd1': { uid: 'bru', ts: agora - 9e5, texto: 'a #promoção saiu' } }, prf: {}, sec: {} },
    tags: { dados: { 'promoção': { '-Nd1': agora - 9e5 } }, sec: { segredo: { '-Ns1': agora - 6e5 } } },
    tags_ult: { dados: { 'promoção': agora - 9e5, banner: agora - 3e5 }, prf: { banner: agora - 2e5 }, sec: { segredo: agora - 6e5 } },
  },
} });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 500))); };

(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(chromeRoot) ? path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed());
  await ctx.addInitScript(() => { window.__limitarConsultas = true; localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' }));
    localStorage.setItem('mare_sonar_recentes_concha_dev', JSON.stringify([{ k: 'canal:sec', t: 'Secreto', sub: 'Canal da squad', tipo: 'canal', canal: 'sec' }, { k: 'tag:segredo', t: '#segredo', sub: '', tipo: 'tag', tag: 'segredo' }])); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb);
  await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(900);
  const nEsc0 = await p.evaluate(() => (window.__escritas || []).length);
  const itens = () => p.evaluate(() => [...document.querySelectorAll('#msn-lista [data-i]')].map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  const busca = async q => { await p.fill('#msn-in', q); await p.waitForTimeout(450); return itens(); };

  t('botão 🔍 Buscar visível na lateral', await p.evaluate(() => !document.getElementById('b-buscar').hidden), 0);
  await p.keyboard.press('Control+k'); await p.waitForTimeout(600);
  t('Ctrl+K abre o Sonar', await p.evaluate(() => MareSonar.aberto()), 0);
  let v = await itens();
  t('caixa vazia: canais da lista e #tags dos meus canais (as mais recentes primeiro)', v.some(x => /Dados/.test(x)) && v.some(x => /Black Friday/.test(x)) && v.findIndex(x => /#banner/.test(x)) < v.findIndex(x => /#promoção/.test(x)) && v.findIndex(x => /#banner/.test(x)) >= 0, v);
  t('nada do canal em que não estou: nem Secreto, nem #segredo (inclusive vindo dos recentes)', !v.some(x => /Secreto|segredo/.test(x)), v);
  v = await busca('promocao');
  t('#tag sem acento: "promocao" acha #promoção', v.some(x => /#promoção/.test(x)), v);
  v = await busca('#ban');
  t('"#" busca só #tags', v.length > 0 && v.every(x => /#/.test(x)) && v.some(x => /#banner/.test(x)) && !v.some(x => /Bruno|Dados ?Canal/.test(x)), v);
  t('a #banner diz em que canais está', v.some(x => /#banner.*# Performance.*# Dados|#banner.*# Dados.*# Performance/.test(x)), v);
  v = await busca('black');
  t('acha o temático aberto para entrar', v.some(x => /Black Friday.*Aberto para entrar/.test(x)), v);
  v = await busca('bruno');
  t('pessoas: só da Hering (o de fora não aparece)', v.some(x => /Bruno Reis/.test(x)) && !v.some(x => /Externo/.test(x)), v);
  await p.click('#msn-lista [data-i]:has-text("Bruno Reis")'); await p.waitForTimeout(500);
  const pessoa = await p.evaluate(() => ({ tit: document.getElementById('canal-titulo').textContent, itens: [...document.querySelectorAll('#log .mencao-item b')].map(b => b.textContent) }));
  t('pessoa → canais em comum (Dados; não o Secreto, que é só dele)', pessoa.tit === '👤 Bruno Reis' && JSON.stringify(pessoa.itens) === JSON.stringify(['# Dados']), pessoa);
  await p.keyboard.press('Control+k'); await p.waitForTimeout(300);
  v = await busca('#banner'); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
  t('escolher a #tag abre a tela dela', await p.evaluate(() => document.getElementById('canal-titulo').textContent === '#banner'), await p.evaluate(() => document.getElementById('canal-titulo').textContent));
  await p.keyboard.press('Control+k'); await p.waitForTimeout(300);
  await busca('perfor'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  t('escolher o canal abre a conversa', await p.evaluate(() => window.__cardume.estado.atual === 'prf'), await p.evaluate(() => window.__cardume.estado));
  await p.keyboard.press('Control+k'); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  t('Esc fecha o Sonar', await p.evaluate(() => !MareSonar.aberto()), 0);
  const fora = await p.evaluate(() => (window.__escritas || []).flatMap(e => e.tipo === 'set' ? [e.p] : Object.keys(e.v || {}).map(k => (e.p ? e.p + '/' : '') + k)).filter(c => !/^kanban\/cardume\/(lidas|vendo)\/|^kanban\/notif_feed_seen\//.test(c)));
  t('o Sonar não grava nada no banco (só o "lido" do canal, o do Sino e o sinal de vida da conversa)', !fora.length, fora);
  t('sem erro de JS', !errs.length, errs);
  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
