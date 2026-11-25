// 🐚 Concha — 🧵 assuntos dentro do canal (25/11/2026, docs/ideias/cardume-v0-banco.md › "Assuntos dentro do canal").
// Faixa com 💬 geral + assuntos; criar e abrir; mensagem vai para o assunto (a + ultima_a) e não aparece em geral; rascunho por assunto;
// não lidas por assunto (ponto no assunto e no canal); chaves forjadas não escondem mensagem nova; encerrar = só leitura; reabrir;
// menção numa mensagem do assunto abre o assunto; apagar guarda o assunto; mensagem de página antiga (só ultima) acende o canal.
// Cada escrita conferida nas regras reais. Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_assuntos.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const { update: regras } = require('../../../functions/rules/rulesSim.js');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../database.rules.json'), 'utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const agora = Date.now();
const forjadas = {}; for (let i = 0; i < 55; i++) forjadas['z' + String(i).padStart(3, '0')] = { uid: 'bru', ts: agora - 864e5 - i * 1000, texto: 'velha ' + i, a: 'aold' };
const ocupado = {}; for (let i = 0; i < 100; i++) ocupado['-Nb' + String(i).padStart(3, '0')] = { uid: 'bru', ts: agora - 3e5 + i * 1000, texto: 'assunto ' + i, a: 'abusy' };
const seed = () => ({ kanban: {
  usuarios: { ana: { role: 'membro', squads: { dados: true } } },
  usuarios_publicos: { ana: { nome: 'Ana Lima', email: 'ana@ciahering.com.br' }, bru: { nome: 'Bruno Reis', email: 'bru@ciahering.com.br' } },
  cardume: {
    canais: { dados: { nome: 'Dados' }, prf: { nome: 'Performance' }, mid: { nome: 'Mídia' } }, membros: { dados: { ana: true, bru: true }, prf: { ana: true, bru: true }, mid: { ana: true, bru: true } }, meus: { ana: { dados: true, prf: true, mid: true } },
    assuntos: { dados: { aold: { n: 'campanha antiga', por: 'bru', criado: agora - 2 * 864e5 } }, mid: { abusy: { n: 'lançamento', por: 'bru', criado: agora - 864e5 } } },
    msgs: { mid: Object.assign({ '-Mg1': { uid: 'bru', ts: agora - 9e6, texto: 'geral antiga 1' }, '-Mg2': { uid: 'bru', ts: agora - 8e6, texto: 'geral antiga 2' }, '-Mg3': { uid: 'bru', ts: agora - 7e6, texto: 'geral antiga 3' } }, ocupado), dados: Object.assign({ '-Ng1': { uid: 'bru', ts: agora - 9e5, texto: 'bom dia, geral' }, '-Nnew': { uid: 'bru', ts: agora - 6e4, texto: 'a NOVA do assunto', a: 'aold' } }, forjadas), prf: {} },
    ultima_a: { dados: { _geral: { ts: agora - 9e5, uid: 'bru', id: '-Ng1' }, aold: { ts: agora - 6e4, uid: 'bru', id: '-Nnew' } } },
    lidas_a: { ana: { dados: { _geral: agora } } },
    mencoes: { ana: { r1: { c: 'dados', m: '-Nnew', de: 'bru', ts: agora - 6e4, n: 'n1' } } },
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
  await p.goto(base + '/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb);
  await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(1000);
  const S = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__store.kanban.cardume)));
  const chips = () => p.evaluate(() => [...document.querySelectorAll('#assuntos-barra button')].map(b => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '') + (b.querySelector('.ponto-a') ? '•' : '')));
  const textos = () => p.evaluate(() => [...document.querySelectorAll('#log .msg .texto')].map(x => x.textContent));
  const externo = mapa => p.evaluate(m => { window.__onDisc = m; window.__simDisconnect(); }, mapa);

  let c = await chips();
  t('faixa: 💬 geral (aberto), 🧵 campanha antiga com ponto de nova, ＋ Assunto (por último), ✓ Marcar como lido', JSON.stringify(c) === JSON.stringify(['💬 geral*', '🧵 campanha antiga•', '＋ Assunto', '✓ Marcar como lido']), c);
  t('geral mostra só a mensagem sem assunto', JSON.stringify(await textos()) === JSON.stringify(['bom dia, geral']), await textos());
  await p.click('[data-canal="prf"]'); await p.waitForTimeout(300);
  t('assunto que eu nunca abri NÃO acende o canal (só o ponto na faixa)', await p.evaluate(() => !document.querySelector('[data-canal="dados"]').classList.contains('nao-lido')), 0);
  await p.click('[data-canal="dados"]'); await p.waitForTimeout(500);

  await p.click('#assuntos-barra [data-aid="aold"]'); await p.waitForTimeout(1300);
  let tx = await textos();
  t('chaves forjadas (z000…z054, antigas) não escondem a mensagem NOVA do assunto', tx.includes('a NOVA do assunto') && tx[tx.length - 1] === 'a NOVA do assunto' && tx.length === 50, { n: tx.length, ult: tx[tx.length - 1] });
  c = await S();
  t('abrir o assunto marca lido (lidas_a/ana/dados/aold) e apaga o ponto', typeof c.lidas_a.ana.dados.aold === 'number' && !(await chips()).some(x => x.includes('•')), { l: c.lidas_a, ch: await chips() });
  t('o endereço leva o assunto (?a=)', await p.evaluate(() => new URL(location.href).searchParams.get('a') === 'aold'), 0);

  await p.click('#assuntos-barra [data-aid="_novo"]'); await p.fill('.md input', 'banner BF'); await p.click('.md button[type="submit"]'); await p.waitForTimeout(500);
  c = await S(); const aid = Object.keys(c.assuntos.dados).find(k => c.assuntos.dados[k].n === 'banner BF');
  t('＋ Novo assunto cria (por = ana) e abre, com o campo dizendo onde vai', !!aid && c.assuntos.dados[aid].por === 'ana' && await p.evaluate(() => /^Em 🧵 banner BF/.test(document.getElementById('entrada').placeholder)), c.assuntos.dados);
  await p.fill('#entrada', 'arte nova subiu'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  c = await S(); const minha = Object.entries(c.msgs.dados).find(([, m]) => m.texto === 'arte nova subiu');
  t('a mensagem vai com a = assunto e marca ultima_a do assunto', minha && minha[1].a === aid && c.ultima_a.dados[aid].id === minha[0], { m: minha, u: c.ultima_a.dados });
  t('no assunto, só as dele', JSON.stringify(await textos()) === JSON.stringify(['arte nova subiu']), await textos());
  await p.fill('#entrada', 'rascunho do banner'); await p.click('#assuntos-barra [data-aid="_geral"]'); await p.waitForTimeout(400);
  t('em geral, a mensagem do assunto não aparece e o rascunho é outro', JSON.stringify(await textos()) === JSON.stringify(['bom dia, geral']) && await p.evaluate(() => document.getElementById('entrada').value === ''), { tx: await textos() });
  await p.click('#assuntos-barra [data-aid="' + aid + '"]'); await p.waitForTimeout(300);
  t('voltar ao assunto devolve o rascunho dele', await p.evaluate(() => document.getElementById('entrada').value === 'rascunho do banner'), await p.evaluate(() => document.getElementById('entrada').value));

  // nova de outra pessoa no assunto, vendo geral: ponto no assunto
  await p.click('#assuntos-barra [data-aid="_geral"]'); await p.waitForTimeout(300);
  const tn = Date.now();
  await externo({ ['kanban/cardume/msgs/dados/-Nb2']: ['set', { uid: 'bru', ts: tn, texto: 'aprovado', a: aid }], ['kanban/cardume/ultima_a/dados/' + aid]: ['set', { ts: tn, uid: 'bru', id: '-Nb2' }] }); await p.waitForTimeout(400);
  t('mensagem nova no assunto, vendo geral: ponto no 🧵 banner BF', (await chips()).some(x => x.startsWith('🧵 banner BF') && x.endsWith('•')), await chips());
  t('...e o canal acende (é um assunto que eu já abri)', await p.evaluate(() => document.querySelector('[data-canal="dados"]').classList.contains('nao-lido')), 0);
  await p.click('#assuntos-barra [data-aid="_lido"]'); await p.waitForTimeout(400);
  t('✓ Marcar como lido apaga todos os pontos (faixa e canal)', !(await chips()).some(x => x.includes('•')) && await p.evaluate(() => !document.querySelector('[data-canal="dados"]').classList.contains('nao-lido')), await chips());

  // encerrar e reabrir (quem criou)
  await p.click('#assuntos-barra [data-aid="' + aid + '"]'); await p.waitForTimeout(300);
  p.once('dialog', d => d.accept());
  await p.click('#assuntos-barra [data-aid="_ger"]'); await p.click('.md button.perigo'); await p.waitForTimeout(400);
  t('🔒 Encerrar: só leitura (sem campo, aviso, sem reagir/editar)', typeof (await S()).assuntos.dados[aid].fim === 'number' && await p.evaluate(() => document.getElementById('rodape').hidden && /Assunto encerrado/.test(document.getElementById('log').textContent) && !document.querySelector('#log [aria-label="Reagir"]')), 0);
  await p.click('#assuntos-barra [data-aid="_ger"]'); await p.click('.md button:has-text("Reabrir")'); await p.waitForTimeout(400);
  t('🔓 Reabrir volta o campo', !(await S()).assuntos.dados[aid].fim && await p.evaluate(() => !document.getElementById('rodape').hidden), 0);

  // encerrado com mensagem nova de outra pessoa: não acende o canal
  await p.click('#assuntos-barra [data-aid="_ger"]'); p.once('dialog', d => d.accept()); await p.click('.md button.perigo'); await p.waitForTimeout(300);
  await p.click('#assuntos-barra [data-aid="_geral"]'); await p.waitForTimeout(300);
  const te = Date.now();
  await externo({ ['kanban/cardume/msgs/dados/-Nb3']: ['set', { uid: 'bru', ts: te, texto: 'depois de encerrar?', a: aid }], ['kanban/cardume/ultima_a/dados/' + aid]: ['set', { ts: te, uid: 'bru', id: '-Nb3' }] }); await p.waitForTimeout(400);
  t('assunto encerrado não acende o canal', await p.evaluate(() => !document.querySelector('[data-canal="dados"]').classList.contains('nao-lido')), 0);
  await p.click('#assuntos-barra button:has-text("Encerrados")'); await p.click('#assuntos-barra [data-aid="' + aid + '"]'); await p.waitForTimeout(300);
  await p.click('#assuntos-barra [data-aid="_ger"]'); await p.click('.md button:has-text("Reabrir")'); await p.waitForTimeout(300);
  // apagar guarda o a
  await p.hover('#log .msg'); await p.click('#log .msg [aria-label="Apagar"]'); await p.waitForTimeout(5600);
  c = await S(); const ap = c.msgs.dados[minha[0]];
  t('apagar (depois dos 5 s) guarda o assunto no resto', ap.apagada === true && ap.a === aid, ap);

  // menção numa mensagem do assunto: abre o assunto
  await p.click('#b-mencoes'); await p.waitForTimeout(300); await p.click('#log .mencao-item'); await p.waitForTimeout(800);
  t('abrir a menção leva ao assunto da mensagem e a destaca', await p.evaluate(() => new URL(location.href).searchParams.get('a') === 'aold' && !!document.querySelector('[data-msg="-Nnew"].destaque')), await chips());

  // geral com a janela cheia de assuntos: nunca "vazio"
  await p.click('[data-canal="mid"]'); await p.waitForTimeout(600);
  t('geral com a janela cheia de mensagens de assunto: avisa e não diz que está vazio', await p.evaluate(() => /estão nos assuntos/.test(document.getElementById('log').textContent) && !/Diga oi/.test(document.getElementById('log').textContent)), await textos());
  await p.click('#log button:has-text("Ver mais de geral")'); await p.waitForTimeout(600);
  t('"Ver mais de geral" traz as 3 antigas', JSON.stringify(await textos()) === JSON.stringify(['geral antiga 1', 'geral antiga 2', 'geral antiga 3']), await textos());
  // página antiga (só ultima, sem ultima_a): o canal acende
  await p.click('[data-canal="prf"]'); await p.waitForTimeout(300);
  const to = Date.now();
  await externo({ ['kanban/cardume/msgs/dados/-Nold']: ['set', { uid: 'bru', ts: to, texto: 'de quem está com a página antiga' }], ['kanban/cardume/ultima/dados']: ['set', { ts: to, uid: 'bru', id: '-Nold' }] }); await p.waitForTimeout(400);
  t('mensagem de página antiga (só ultima) acende o canal', await p.evaluate(() => document.querySelector('[data-canal="dados"]').classList.contains('nao-lido')), 0);

  const esc = await p.evaluate(() => window.__escritas || []);
  const real = Date.now; const ruins = [];
  for (const e of esc) { const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([k, v]) => [(e.p ? e.p + '/' : '') + k, v])); Date.now = () => e.t; let r; try { r = regras(RULES, e.antes, authDe(ANA), mapa); } finally { Date.now = real; } if (!r) ruins.push({ tipo: e.tipo, caminhos: Object.keys(mapa) }); }
  t('CADA escrita da página passa nas regras reais', esc.length > 0 && !ruins.length, { n: esc.length, ruins });
  t('sem erro de JS', !errs.length, errs);
  // link para assunto que não existe mais (?a= velho): volta para geral, com aviso, e o campo segue escrevendo em geral
  await p.goto(base + '/cardume-dev.html?c=prf&a=asumiu'); await p.waitForFunction(() => !!window.__authCb);
  await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(1000);
  t('link para assunto apagado volta para geral (sem ?a=, campo de geral)', await p.evaluate(() => !new URL(location.href).searchParams.get('a') && document.getElementById('entrada').placeholder === 'Escreva uma mensagem…' && /não existe mais/.test(document.getElementById('toast').textContent)), await p.evaluate(() => [location.search, document.getElementById('entrada').placeholder, document.getElementById('toast').textContent]));
  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
