// 🐚 Concha — 🧷 @card: e @objetivo: (25/11/2026, docs/ideias/cardume.md › "@card: e @objetivo: sem pesar no banco").
// @card: lista o índice que o Maré deixa no aparelho (só da mesma conta, até 7 dias, squad do canal primeiro) sem ler o banco; @objetivo: usa a lista
// do Sonar ou faz a mesma leitura e grava no mesmo formato; o escolhido vira o LINK e a mensagem mostra o chip com o título lido do banco;
// o @ ganha os atalhos; título hostil não vira HTML.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_citar.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const agora = Date.now();
const seed = () => ({ kanban: {
  usuarios: { ana: { role: 'membro', squads: { dados: true } } },
  usuarios_publicos: { ana: { nome: 'Ana Lima', email: 'ana@ciahering.com.br' }, bru: { nome: 'Bruno Reis', email: 'bru@ciahering.com.br' } },
  squads: { dados: { dados: { cards: { 0: { id: 'cBanner', title: 'Banner da Black Friday', col: 'backlog' } }, cards_index: { cBanner: '0' } } } },
  okr: { objetivos: { o1: { titulo: 'Aumentar a conversão do site', trimestres: ['T426'] }, o2: { titulo: 'Objetivo arquivado', arquivado: true }, o3: { titulo: '<img src=x onerror=alert(1)>' } }, marcos: {} },
  cardume: { canais: { dados: { nome: 'Dados' } }, membros: { dados: { ana: true, bru: true } }, meus: { ana: { dados: true } }, msgs: { dados: {} } },
} });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 500))); };
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(chromeRoot) ? path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed());
  await ctx.addInitScript(ag => { window.__limitarConsultas = true; localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' }));
    localStorage.setItem('oceano_cards_dados_dev', JSON.stringify({ t: ag, u: 'ana', v: [{ id: 'cBanner', t: 'Banner da Black Friday', c: 'backlog' }, { id: 'cRel', t: 'Relatório semanal', c: 'doing' }] }));
    localStorage.setItem('oceano_cards_prf_dev', JSON.stringify({ t: ag, u: 'outra', v: [{ id: 'cX', t: 'Banner de outra conta', c: 'x' }] }));
    localStorage.setItem('oceano_cards_mid_dev', JSON.stringify({ t: ag - 8 * 864e5, u: 'ana', v: [{ id: 'cV', t: 'Banner velho', c: 'x' }] }));
    localStorage.setItem('oceano_cards_dados', JSON.stringify({ t: ag, u: 'ana', v: [{ id: 'cP', t: 'Banner de produção', c: 'x' }] }));
  }, agora);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { errs.push('dialog: ' + d.message()); d.dismiss(); });
  await p.goto(base + '/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb);
  await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(900);
  const sug = () => p.evaluate(() => ({ itens: [...document.querySelectorAll('#sugestoes .sugestao')].map(o => o.textContent), dica: (document.querySelector('#sugestoes .sug-dica') || {}).textContent || '' }));
  const lidasAntes = await p.evaluate(() => (window.__log || []).filter(l => /squads\/.*\/cards/.test(l[1])).length);

  await p.click('#entrada'); await p.keyboard.type('@ca'); await p.waitForTimeout(150);
  let s = await sug();
  t('digitar "@ca" oferece o atalho "🗂 @card:"', s.itens.some(x => /@card: citar um card/.test(x)), s);
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowUp');
  const i = s.itens.findIndex(x => /@card:/.test(x)); for (let k = 0; k < i; k++) await p.keyboard.press('ArrowDown');
  await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  s = await sug();
  t('escolher o atalho põe "@card:" e já lista os cards do aparelho', await p.evaluate(() => document.getElementById('entrada').value === '@card:') && s.itens.length === 2, s);
  t('só os cards da MESMA conta, do dev e com menos de 7 dias (nem os de outra conta, nem os velhos, nem os de produção)', !s.itens.some(x => /outra conta|velho|produção/.test(x)), s);
  await p.keyboard.type('black'); await p.waitForTimeout(150); s = await sug();
  t('"@card:black" filtra: "🗂 Banner da Black Friday · Dados"', JSON.stringify(s.itens) === JSON.stringify(['🗂 Banner da Black Friday · Dados']), s);
  t('para sugerir, nenhuma leitura de cards no banco', (await p.evaluate(() => (window.__log || []).filter(l => /squads\/.*\/cards/.test(l[1])).length)) === lidasAntes, 0);
  await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  t('Enter troca pelo LINK do card (o texto guarda só o link)', await p.evaluate(() => /^https:\/\/caiosoares1899\.github\.io\/hering\/kanban-dev\.html\?squad=dados&opencard=cBanner $/.test(document.getElementById('entrada').value)), await p.evaluate(() => document.getElementById('entrada').value));
  await p.fill('#entrada', 'nada aqui @card:xyzw'); await p.dispatchEvent('#entrada', 'input'); await p.waitForTimeout(150);
  t('sem card com esse nome: dica de colar o link', /colar o link|cole o link/.test((await sug()).dica), await sug());

  // enviar: chip com o título lido do banco
  await p.fill('#entrada', 'olha https://caiosoares1899.github.io/hering/kanban-dev.html?squad=dados&opencard=cBanner'); await p.keyboard.press('Enter'); await p.waitForTimeout(800);
  t('a mensagem mostra o chip do card com o título do banco', await p.evaluate(() => [...document.querySelectorAll('#log .card-chip .tit')].some(x => x.textContent === 'Banner da Black Friday')), 0);

  // @objetivo:
  await p.evaluate(() => localStorage.removeItem('oceano_sonar_radar_dev'));
  await p.fill('#entrada', '@objetivo:'); await p.dispatchEvent('#entrada', 'input'); await p.waitForTimeout(600);
  s = await sug();
  t('@objetivo: sem lista no aparelho: lê o Radar uma vez e lista (sem os arquivados)', s.itens.some(x => /Aumentar a conversão do site · T426/.test(x)) && !s.itens.some(x => /arquivado/.test(x)), s);
  const cache = await p.evaluate(() => JSON.parse(localStorage.getItem('oceano_sonar_radar_dev') || 'null'));
  t('...e grava no MESMO formato do Sonar (s: 2), para os outros apps reaproveitarem', cache && cache.s === 2 && cache.v && cache.v.objs.o1 && Array.isArray(cache.v.marcos), cache && Object.keys(cache));
  t('título hostil aparece como texto na lista (sem HTML)', await p.evaluate(() => !document.querySelector('#sugestoes img') && [...document.querySelectorAll('#sugestoes .sugestao')].some(o => /<img/.test(o.textContent))), 0);
  await p.keyboard.type('convers'); await p.waitForTimeout(150); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  t('Enter põe o link do objetivo no Radar (okr-dev.html?okr=o1)', await p.evaluate(() => /^https:\/\/caiosoares1899\.github\.io\/hering\/okr-dev\.html\?okr=o1 $/.test(document.getElementById('entrada').value)), await p.evaluate(() => document.getElementById('entrada').value));
  await p.keyboard.press('Enter'); await p.waitForTimeout(800);
  t('a mensagem mostra o chip 🎯 com o título do objetivo (e o link some do texto)', await p.evaluate(() => [...document.querySelectorAll('#log .card-chip')].some(a => /🎯/.test(a.textContent) && /Aumentar a conversão do site/.test(a.textContent) && /okr-dev\.html\?okr=o1/.test(a.href)) && ![...document.querySelectorAll('#log .texto')].some(x => /okr-dev/.test(x.textContent))), 0);
  t('sem erro de JS', !errs.length, errs);
  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
