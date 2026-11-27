// 🐚 Concha — 🔖 Salvos (era ⭐ Favoritos) (27/11/2026, docs/ideias/cardume-v0-banco.md › "⭐ Favoritos").
// ☆ Salvar na mensagem (grava fav_msgs/{uid}/{canal}/{msgId} = ts, sem texto); 🔖 Salvar #tag na tela da #tag (fav_tags/{uid}/{tag}, sem push);
// a tela 🔖 Salvos (era ⭐ Favoritos) (chips das #tags + mensagens salvas, a mais nova primeiro), abrir uma salva leva à mensagem, ← Voltar da #tag
// volta aos Favoritos, mensagem apagada fica avisando até tirar, #constructor não nasce "favoritada". Cada escrita conferida nas regras reais.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_favoritos.js
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
    msgs: {
      dados: { '-Nd1': { uid: 'bru', ts: agora - 6e4, texto: 'subiu o #banner' }, '-Nd2': { uid: 'bru', ts: agora - 5e4, texto: 'link do relatório #constructor' }, '-Nx': { uid: 'bru', ts: agora - 9e4, apagada: true } },
      prf: { '-Np1': { uid: 'bru', ts: agora - 4e4, texto: 'meta da semana' } },
    },
    tags: { dados: { banner: { '-Nd1': agora - 6e4 }, constructor: { '-Nd2': agora - 5e4 } } },
    fav_msgs: { ana: { dados: { '-Nx': agora - 8e4 } } },   // salva antes de ser apagada
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
  const salvas = async () => ((await S()).fav_msgs || {}).ana || {};

  t('🔖 Salvos aparece na lateral, logo abaixo de @ Menções', await p.evaluate(() => { const f = document.getElementById('b-favs'); return !!f && f.previousElementSibling && f.previousElementSibling.id === 'b-mencoes' && /🔖 Salvos/.test(f.textContent); }), 0);
  t('a mensagem tem ☆ Salvar (desmarcado)', await p.evaluate(() => { const x = document.querySelector('[data-msg="-Nd1"] [aria-label="Salvar em 🔖 Salvos"]'); return !!x && x.getAttribute('aria-pressed') === 'false'; }), 0);
  await p.hover('[data-msg="-Nd1"]'); await p.click('[data-msg="-Nd1"] [aria-label="Salvar em 🔖 Salvos"]'); await p.waitForTimeout(400);
  let sv = await salvas();
  t('☆ Salvar grava fav_msgs/ana/dados/-Nd1 = número (só o id, sem texto)', typeof (sv.dados || {})['-Nd1'] === 'number', sv);
  t('o botão vira 🔖 Salva', await p.evaluate(() => { const x = document.querySelector('[data-msg="-Nd1"] [aria-label="Salva em 🔖 Salvos: tirar"]'); return !!x && x.getAttribute('aria-pressed') === 'true'; }), 0);
  await p.click('[data-canal="prf"]'); await p.waitForTimeout(400);
  await p.hover('[data-msg="-Np1"]'); await p.click('[data-msg="-Np1"] [aria-label="Salvar em 🔖 Salvos"]'); await p.waitForTimeout(400);
  t('salva também a de outro canal', typeof ((await salvas()).prf || {})['-Np1'] === 'number', await salvas());

  await p.click('#b-favs'); await p.waitForTimeout(600);
  const tela = await p.evaluate(() => ({ tit: document.getElementById('canal-titulo').textContent, cur: document.getElementById('b-favs').getAttribute('aria-current'), rod: document.getElementById('rodape').hidden,
    itens: [...document.querySelectorAll('#log .fav-linha .mencao-item')].map(x => x.textContent), tags: document.querySelectorAll('#log .fav-tags .tag').length }));
  t('🔖 Salvos abre a tela (título, aria-current, sem campo de escrever)', tela.tit === '🔖 Salvos' && tela.cur === 'true' && tela.rod === true, tela);
  t('lista as 3 salvas, a mais nova primeiro, com canal, autor e trecho', tela.itens.length === 3 && /# Performance · Bruno Reis.*meta da semana/.test(tela.itens[0]) && /# Dados · Bruno Reis.*subiu o #banner/.test(tela.itens[1]), tela.itens);
  t('a apagada fica avisando "(mensagem apagada)"', /\(mensagem apagada\)/.test(tela.itens[2]), tela.itens);
  t('sem #tag favorita: a seção explica como favoritar', tela.tags === 0 && await p.evaluate(() => /🔖 Salvar #tag/.test(document.getElementById('log').textContent)), 0);
  t('a faixa de assuntos do canal (💬 geral / + Assunto) some na tela de Favoritos', await p.evaluate(() => document.getElementById('assuntos-barra').hidden), 0);
  t('nenhum sinal de vida (vendo) enquanto está em ⭐ Favoritos', !Object.keys(((await S()).vendo || {}).ana || {}).length, (await S()).vendo);

  await p.click('#log .fav-linha:nth-of-type(3) .fav-tirar').catch(async () => { await p.evaluate(() => [...document.querySelectorAll('#log .fav-linha')].pop().querySelector('.fav-tirar').click()); });
  await p.waitForTimeout(400);
  t('⭐ ao lado tira a apagada (a regra deixa tirar mesmo sem a mensagem)', !((await salvas()).dados || {})['-Nx'] && typeof (await salvas()).dados['-Nd1'] === 'number', await salvas());

  await p.evaluate(() => [...document.querySelectorAll('#log .fav-linha .mencao-item')].find(x => /subiu o/.test(x.textContent)).click()); await p.waitForTimeout(700);
  t('abrir uma salva leva ao canal e destaca a mensagem', await p.evaluate(() => { const m = document.querySelector('[data-msg="-Nd1"]'); return new URL(location.href).searchParams.get('c') === 'dados' && !!m && m.classList.contains('destaque') && document.getElementById('b-favs').getAttribute('aria-current') === 'false'; }), 0);

  await p.click('[data-msg="-Nd1"] button.tag'); await p.waitForTimeout(500);
  t('na tela da #tag: 🔔 Seguir e ☆ Favoritar lado a lado', await p.evaluate(() => !!document.querySelector('.seguir-tag') && document.querySelector('.fav-tag-btn').textContent === '🔖 Salvar #banner'), 0);
  await p.click('.fav-tag-btn'); await p.waitForTimeout(400);
  let c = await S();
  t('☆ Favoritar grava fav_tags/ana/banner e NÃO segue (sem push)', typeof ((c.fav_tags || {}).ana || {}).banner === 'number' && !((c.seguidas || {}).ana || {}).banner, { f: c.fav_tags, s: c.seguidas });
  t('o botão vira ⭐ Nos favoritos', await p.evaluate(() => document.querySelector('.fav-tag-btn').textContent === '🔖 Salva' && document.querySelector('.fav-tag-btn').getAttribute('aria-pressed') === 'true'), 0);

  await p.click('#b-favs'); await p.waitForTimeout(500);
  t('a #banner aparece como chip em ⭐ Favoritos', await p.evaluate(() => [...document.querySelectorAll('#log .fav-tags .tag')].map(x => x.textContent).join() === '#banner'), 0);
  await p.click('#log .fav-tags .tag'); await p.waitForTimeout(500);
  t('o chip abre a tela da #tag com "← Voltar para 🔖 Salvos"', await p.evaluate(() => document.getElementById('canal-titulo').textContent === '#banner' && /Voltar para 🔖 Salvos/.test((document.querySelector('.voltar-tag') || {}).textContent || '')), 0);
  await p.click('.voltar-tag'); await p.waitForTimeout(400);
  t('← Voltar volta aos Favoritos', await p.evaluate(() => document.getElementById('canal-titulo').textContent === '🔖 Salvos'), 0);

  await p.click('#b-mencoes'); await p.waitForTimeout(300);
  t('ir para @ Menções desmarca ⭐ Favoritos', await p.evaluate(() => document.getElementById('b-favs').getAttribute('aria-current') === 'false' && document.getElementById('b-mencoes').getAttribute('aria-current') === 'true'), 0);

  await p.click('[data-canal="dados"]'); await p.waitForTimeout(400);
  await p.click('[data-msg="-Nd2"] button.tag'); await p.waitForTimeout(500);
  t('#constructor não nasce "favoritada" (sem protótipo)', await p.evaluate(() => document.querySelector('.fav-tag-btn').textContent === '🔖 Salvar #constructor'), 0);

  await p.click('[data-canal="dados"]'); await p.waitForTimeout(400);
  await p.hover('[data-msg="-Nd1"]'); await p.click('[data-msg="-Nd1"] [aria-label="Salva em 🔖 Salvos: tirar"]'); await p.waitForTimeout(400);
  t('⭐ Salva na mensagem tira dos salvos', !((await salvas()).dados || {})['-Nd1'], await salvas());

  await p.setViewportSize({ width: 390, height: 800 }); await p.click('[data-canal="dados"]').catch(() => {}); await p.waitForTimeout(200);
  await p.evaluate(() => document.getElementById('b-favs').click()); await p.waitForTimeout(400);
  t('celular: a tela cabe sem rolagem lateral', await p.evaluate(() => document.documentElement.scrollWidth <= 391 && document.getElementById('canal-titulo').textContent === '🔖 Salvos'), 0);

  const esc = await p.evaluate(() => window.__escritas || []);
  const real = Date.now; const ruins = [];
  for (const e of esc) { const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([k, v]) => [(e.p ? e.p + '/' : '') + k, v])); Date.now = () => e.t; let r; try { r = regras(RULES, e.antes, authDe(ANA), mapa); } finally { Date.now = real; } if (!r) ruins.push({ tipo: e.tipo, caminhos: Object.keys(mapa) }); }
  t('CADA escrita da página passa nas regras reais', esc.length > 0 && !ruins.length, { n: esc.length, ruins });
  t('sem erro de JS', !errs.length, errs);
  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
