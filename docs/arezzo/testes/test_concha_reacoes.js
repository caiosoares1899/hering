// 🐚 Concha — 😀 reagir com emoji (24/11/2026). Uma reação por pessoa, a lista do Maré; aviso genérico no Sino (1 por mensagem e pessoa,
// nunca para si); seletor no lugar da pílula; nomes na mensagem tocada; escuta parada ao sair do canal. Cada escrita conferida nas regras reais.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_reacoes.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const { update: regras } = require('../../../functions/rules/rulesSim.js');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../database.rules.json'), 'utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const pub = (uid, nome, init) => ({ uid, nome, init, email: uid + '@ciahering.com.br', squads: { dados: true } });
const agora = Date.now();
const seed = () => ({ kanban: {
  usuarios: { ana: { role: 'membro', squads: { dados: true } }, bru: { role: 'membro', squads: { dados: true } }, car: { role: 'membro', squads: { dados: true } } },
  usuarios_publicos: { ana: pub('ana', 'Ana Lima', 'AL'), bru: pub('bru', 'Bruno Reis', 'BR'), car: pub('car', 'Carla Dias', 'CD') },
  cardume: {
    canais: { dados: { nome: 'Dados' }, prf: { nome: 'Performance' }, 't-geral': { nome: 'Geral', tipo: 'tema', dono: 'bru', acesso: 'aberto', criado: agora - 864e5 } }, abertos: { 't-geral': { nome: 'Geral' } }, membros: { dados: { ana: true, bru: true, car: true }, prf: { ana: true } }, meus: { ana: { dados: true, prf: true } },
    msgs: { dados: {
      '-Nm1': { uid: 'bru', ts: agora - 5 * 60000, texto: 'Proposta A para o painel' },
      '-Nm2': { uid: 'ana', ts: agora - 4 * 60000, texto: 'minha mensagem' },
      '-Nm3': { uid: 'car', ts: agora - 3 * 60000, apagada: true },
      '-Nm4': { uid: 'car', ts: agora - 2 * 60000, texto: 'Revisão às 9h' },
      '-Na0': { uid: 'car', ts: agora - 60000, texto: 'enviada offline: chave antiga, ts recente' },
    } },
    reacoes: { dados: { '-Na0': { bru: '👀' }, '-Nm1': { car: '😈' }, '-Nm2': { bru: '🎉', car: '🎉' }, '-Nm3': { bru: '👍' } } },
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
  const S = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__store.kanban)));
  const rx = async () => ((await S()).cardume.reacoes || {}).dados || {};
  const chips = id => p.evaluate(i => [...document.querySelectorAll('[data-msg="' + i + '"] .rx-chip')].map(c => [c.textContent, c.getAttribute('aria-pressed'), c.title]), id);
  const notifs = async u => Object.entries(((await S()).usuarios[u] || {}).notificacoes || {});
  const abrirSeletor = async id => { await p.hover('[data-msg="' + id + '"]'); await p.click('[data-msg="' + id + '"] [aria-label="Reagir"]'); await p.waitForTimeout(120); };

  t('emoji fora da lista no banco não aparece', !(await chips('-Nm1')).length, await chips('-Nm1'));
  t('reações dos outros: "🎉 2", não pressionado, com os nomes no title', JSON.stringify(await chips('-Nm2')) === JSON.stringify([['🎉 2', 'false', 'Bruno Reis, Carla Dias']]), await chips('-Nm2'));
  t('mensagem "enviada offline" (chave antiga, ts recente) mostra as reações dela', JSON.stringify((await chips('-Na0')).map(c => c[0])) === JSON.stringify(['👀 1']), await chips('-Na0'));
  t('mensagem apagada não mostra reações (mesmo com reação no banco)', !(await p.$('[data-msg="-Nm3"] .rx-linha')), 0);

  await abrirSeletor('-Nm1');
  const ops = await p.evaluate(() => [...document.querySelectorAll('[data-msg="-Nm1"] .rx-op')].map(b => b.textContent));
  t('😀 Reagir troca a pílula pelos 5 emojis do Maré, com o foco no primeiro', JSON.stringify(ops) === JSON.stringify(['👍', '👀', '❤️', '✅', '🎉']) && await p.evaluate(() => document.activeElement.classList.contains('rx-op')), ops);
  const sobre = await p.evaluate(() => { const m = document.querySelector('[data-msg="-Nm1"]'), pl = m.querySelector('.acoes-msg').getBoundingClientRect(); return [...document.querySelectorAll('.msg .texto, .autor')].map(e => e.getBoundingClientRect()).filter(r => !(r.right <= pl.left || r.left >= pl.right || r.bottom <= pl.top || r.top >= pl.bottom)).length; });
  t('o seletor não cobre texto', sobre === 0, sobre);
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  t('Esc fecha o seletor e devolve o foco ao 😀', !(await p.$('[data-msg="-Nm1"] .rx-op')) && await p.evaluate(() => document.activeElement.getAttribute('aria-label') === 'Reagir'), 0);

  await abrirSeletor('-Nm1'); await p.click('[data-msg="-Nm1"] [aria-label="Reagir com 👍"]'); await p.waitForTimeout(300);
  t('reagir grava reacoes/dados/-Nm1/ana = 👍', (await rx())['-Nm1'].ana === '👍', await rx());
  t('o chip aparece pressionado: "👍 1"', JSON.stringify((await chips('-Nm1')).map(c => c.slice(0, 2))) === JSON.stringify([['👍 1', 'true']]), await chips('-Nm1'));
  let nb = await notifs('bru');
  t('o aviso leva noTTLDelete (o Sino marca como dispensado em vez de apagar: o id fixo segue barrando o 2º aviso)', nb.length === 1 && nb[0][1].noTTLDelete === true, nb);
  t('o Bruno recebe 1 aviso genérico no Sino (sem canal, trecho nem emoji)', nb.length === 1 && nb[0][0] === 'rx_-Nm1_ana' && nb[0][1].type === 'cardume_reacao' && /Ana reagiu a uma mensagem sua na Concha/.test(nb[0][1].title) && !/Dados|Proposta|👍/.test(JSON.stringify(nb[0][1])), nb);

  await abrirSeletor('-Nm1'); await p.click('[data-msg="-Nm1"] [aria-label="Reagir com ❤️"]'); await p.waitForTimeout(300);
  t('escolher outro troca (uma por pessoa): ❤️', (await rx())['-Nm1'].ana === '❤️' && JSON.stringify((await chips('-Nm1')).map(c => c[0])) === JSON.stringify(['❤️ 1']), await rx());
  t('trocar não manda outro aviso', (await notifs('bru')).length === 1 && (await p.evaluate(() => (window.__escritas || []).filter(e => /notificacoes/.test(e.p)).length)) === 1, await notifs('bru'));
  await p.click('[data-msg="-Nm1"] .rx-chip'); await p.waitForTimeout(300);
  t('tocar no próprio chip tira a reação', !((await rx())['-Nm1'] || {}).ana && !(await chips('-Nm1')).length, await rx());
  await abrirSeletor('-Nm1'); await p.click('[data-msg="-Nm1"] [aria-label="Reagir com 👍"]'); await p.waitForTimeout(300);
  t('reagir de novo depois de tirar também não repete o aviso', (await notifs('bru')).length === 1 && (await p.evaluate(() => (window.__escritas || []).filter(e => /notificacoes/.test(e.p)).length)) === 1, 0);

  await p.click('[data-msg="-Nm2"] .rx-chip'); await p.waitForTimeout(300);
  t('tocar no chip dos outros soma a sua: "🎉 3", pressionado', JSON.stringify((await chips('-Nm2')).map(c => c.slice(0, 2))) === JSON.stringify([['🎉 3', 'true']]) && (await rx())['-Nm2'].ana === '🎉', await chips('-Nm2'));
  t('reagir à própria mensagem não avisa ninguém (nem a si)', !(await notifs('ana')).length, await notifs('ana'));

  // escuta para ao sair do canal e ao abrir @ Menções
  const ouvindo = () => p.evaluate(() => (window.__lis || []).some(l => /cardume\/reacoes\/dados$/.test(l.p)));
  t('com o canal aberto, há escuta das reações, a partir da menor chave exibida', await ouvindo() && await p.evaluate(() => (window.__lis || []).some(l => /cardume\/reacoes\/dados$/.test(l.p) && l.q && l.q.s === '-Na0')), await p.evaluate(() => (window.__lis || []).filter(l => /reacoes/.test(l.p)).map(l => [l.p, l.q && l.q.s])));
  // reação recusada pelo banco (ex.: a mensagem foi apagada com o seletor aberto) não gera aviso; tentar de novo depois avisa
  await p.evaluate(() => { window.__denySet = pth => /reacoes\/dados\/-Nm4\//.test(pth); });
  await abrirSeletor('-Nm4'); await p.click('[data-msg="-Nm4"] [aria-label="Reagir com 👀"]'); await p.waitForTimeout(300);
  t('reação recusada não gera aviso', !(await notifs('car')).length, await notifs('car'));
  await p.evaluate(() => { window.__denySet = null; });
  await abrirSeletor('-Nm4'); await p.keyboard.press('ArrowRight'); await p.focus('[data-msg="-Nm4"] [aria-label="Reagir com 👀"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(350);
  t('tentar de novo depois avisa (a trava só vale para reação aceita)', (await notifs('car')).length === 1, await notifs('car'));
  t('pelo teclado, depois de reagir o foco vai para o chip escolhido', await p.evaluate(() => { const a = document.activeElement; return a.classList.contains('rx-chip') && a.dataset.e === '👀' && !!a.closest('[data-msg="-Nm4"]'); }), await p.evaluate(() => document.activeElement.outerHTML.slice(0, 120)));
  await p.click('[data-canal="t-geral"]'); await p.waitForTimeout(250);   // canal em que a Ana NÃO está: não nasce escuta nova que substitua a antiga
  t('trocar de canal (para um em que não está) solta a escuta das reações', !(await ouvindo()), await p.evaluate(() => (window.__lis || []).map(l => l.p)));
  await p.click('[data-canal="dados"]'); await p.waitForTimeout(300); await p.click('#b-mencoes'); await p.waitForTimeout(250);
  t('abrir @ Menções solta a escuta das reações', !(await ouvindo()), 0);

  const esc = await p.evaluate(() => window.__escritas || []);
  const real = Date.now; const ruins = [];
  for (const e of esc) { const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([k, v]) => [(e.p ? e.p + '/' : '') + k, v])); Date.now = () => e.t; let r; try { r = regras(RULES, e.antes, authDe(ANA), mapa); } finally { Date.now = real; } if (!r) ruins.push({ tipo: e.tipo, caminhos: Object.keys(mapa) }); }
  t('CADA escrita da página passa nas regras reais', esc.length > 0 && !ruins.length, { n: esc.length, ruins });
  t('sem erro de JS', !errs.length, errs);
  await ctx.close();

  // ── celular: tocar na mensagem → 😀 → fileira de emojis de 44 px; nomes de quem reagiu na mensagem tocada ──
  const c2 = await b.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true }); await fake.install(c2, seed());
  await c2.addInitScript(() => localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })));
  const m = await c2.newPage(); const errs2 = []; m.on('pageerror', e => errs2.push(e.message));
  await m.goto(base + '/cardume-dev.html?c=dados'); await m.waitForFunction(() => !!window.__authCb); await m.evaluate(x => window.__authCb(x), ANA); await m.waitForTimeout(900);
  const quemVisivel = () => m.evaluate(() => { const q = document.querySelector('[data-msg="-Nm2"] .rx-quem'); return q && getComputedStyle(q).display !== 'none' ? q.textContent : ''; });
  t('celular: em repouso, os nomes de quem reagiu ficam escondidos', !(await quemVisivel()), await quemVisivel());
  await m.tap('[data-msg="-Nm2"] .texto'); await m.waitForTimeout(120);
  t('celular: tocar na mensagem mostra quem reagiu (title não existe no toque)', /🎉 Bruno Reis, Carla Dias/.test(await quemVisivel()), await quemVisivel());
  await m.tap('[data-msg="-Nm1"] .texto'); await m.waitForTimeout(120); await m.tap('[data-msg="-Nm1"] [aria-label="Reagir"]'); await m.waitForTimeout(150);
  const alt = await m.evaluate(() => [...document.querySelectorAll('[data-msg="-Nm1"] .rx-op')].map(x => x.getBoundingClientRect().height));
  t('celular: a fileira de emojis tem 5 alvos de ≥ 44 px', alt.length === 5 && alt.every(h => h >= 44), alt);
  await m.tap('[data-msg="-Nm1"] [aria-label="Reagir com ✅"]'); await m.waitForTimeout(300);
  t('celular: tocar no emoji reage', await m.evaluate(() => window.__store.kanban.cardume.reacoes.dados['-Nm1'].ana === '✅'), 0);
  const ch = await m.evaluate(() => [...document.querySelectorAll('.rx-chip')].map(x => x.getBoundingClientRect().height));
  t('celular: chips de reação com ≥ 44 px', ch.length && ch.every(h => h >= 44), ch);
  t('celular: sem rolagem lateral nem erro de JS', !(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth)) && !errs2.length, errs2);
  await b.close();
  console.log(ok ? `TUDO OK (${total} verificações)` : 'FALHOU');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
