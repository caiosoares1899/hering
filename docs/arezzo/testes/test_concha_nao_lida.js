// 🐚 Concha — 🔵 Marcar como não lida (27/11/2026, como no Slack). A ação na mensagem volta lidas/lidas_a para logo antes dela e SEGURA
// o marcar-lido enquanto a pessoa continua na conversa (linha "Não lida a partir daqui"); ao sair, o canal acende na lista; ao voltar, lê;
// "✓ Lida" desfaz na hora. Sem regra nova (lidas e lidas_a aceitam qualquer número). Cada escrita conferida nas regras reais.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_nao_lida.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const { update: regras } = require('../../../functions/rules/rulesSim.js');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../database.rules.json'), 'utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const agora = Date.now();
const T1 = agora - 3e5, T2 = agora - 2e5, T3 = agora - 1e5;
const seed = () => ({ kanban: {
  usuarios: { ana: { role: 'membro', squads: { dados: true } } },
  usuarios_publicos: { ana: { nome: 'Ana Lima', email: 'ana@ciahering.com.br' }, bru: { nome: 'Bruno Reis', email: 'bru@ciahering.com.br' } },
  cardume: {
    canais: { dados: { nome: 'Dados' }, prf: { nome: 'Performance' } },
    membros: { dados: { ana: true, bru: true }, prf: { ana: true, bru: true } }, meus: { ana: { dados: true, prf: true } },
    msgs: { dados: { '-Nd1': { uid: 'bru', ts: T1, texto: 'primeira' }, '-Nd2': { uid: 'bru', ts: T2, texto: 'preciso de ajuda com o relatório' }, '-Nd3': { uid: 'bru', ts: T3, texto: 'quando puder' } }, prf: { '-Np1': { uid: 'bru', ts: T1, texto: 'oi' } } },
    ultima: { dados: { ts: T3, uid: 'bru', id: '-Nd3' }, prf: { ts: T1, uid: 'bru', id: '-Np1' } },
    ultima_a: { dados: { _geral: { ts: T3, uid: 'bru', id: '-Nd3' } }, prf: { _geral: { ts: T1, uid: 'bru', id: '-Np1' } } },
    lidas: { ana: { dados: T3, prf: T1 } }, lidas_a: { ana: { dados: { _geral: T3 }, prf: { _geral: T1 } } },
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
  const ponto = id => p.evaluate(i => !!document.querySelector('[data-canal="' + i + '"].nao-lido'), id);
  const NL = '[data-msg="-Nd2"] [aria-label="Marcar como não lida a partir daqui"]';

  t('canal lido: Dados sem ponto', !(await ponto('dados')), 0);
  t('a mensagem tem 🔵 Não lida', await p.evaluate(s => !!document.querySelector(s), NL), 0);
  await p.hover('[data-msg="-Nd2"]'); await p.click(NL); await p.waitForTimeout(400);
  let c = await S();
  t('grava lidas_a/_geral e lidas = horário da mensagem − 1', c.lidas_a.ana.dados._geral === T2 - 1 && c.lidas.ana.dados === T2 - 1, { a: c.lidas_a.ana.dados, l: c.lidas.ana.dados });
  t('aparece "Não lida a partir daqui" logo antes da mensagem', await p.evaluate(() => { const d = document.querySelector('#log .dia.nao-lida'); const g = document.querySelector('[data-msg="-Nd2"]').closest('.grupo'); return !!d && d.textContent === 'Não lida a partir daqui' && d.nextElementSibling === g; }), 0);
  t('a ação vira ✓ Lida', await p.evaluate(() => !!document.querySelector('[data-msg="-Nd2"] [aria-label="Marcar como lida de novo"]')), 0);
  await p.evaluate(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); }); await p.waitForTimeout(1500);
  c = await S();
  t('continuando na conversa, NÃO marca como lida de novo', c.lidas_a.ana.dados._geral === T2 - 1, c.lidas_a.ana.dados);

  await p.click('[data-canal="prf"]'); await p.waitForTimeout(500);
  t('saiu: Dados acende na lista', await ponto('dados'), 0);
  await p.click('[data-canal="dados"]'); await p.waitForTimeout(1500);
  c = await S();
  t('voltou: lê até a última e o ponto some', c.lidas_a.ana.dados._geral === T3 && !(await ponto('dados')), c.lidas_a.ana.dados);
  t('a linha "Não lida" não aparece mais', await p.evaluate(() => !document.querySelector('#log .dia.nao-lida')), 0);

  await p.hover('[data-msg="-Nd1"]'); await p.click('[data-msg="-Nd1"] [aria-label="Marcar como não lida a partir daqui"]'); await p.waitForTimeout(400);
  t('de novo, a partir da 1ª', (await S()).lidas_a.ana.dados._geral === T1 - 1, (await S()).lidas_a.ana.dados);
  await p.hover('[data-msg="-Nd1"]'); await p.click('[data-msg="-Nd1"] [aria-label="Marcar como lida de novo"]'); await p.waitForTimeout(500);
  c = await S();
  t('✓ Lida desfaz na hora (lê até a última)', c.lidas_a.ana.dados._geral === T3 && c.lidas.ana.dados === T3, c.lidas_a.ana.dados);

  await p.hover('[data-msg="-Nd3"]'); await p.click('[data-msg="-Nd3"] [aria-label="Marcar como não lida a partir daqui"]'); await p.waitForTimeout(300);
  await p.click('#b-mencoes'); await p.waitForTimeout(400);
  t('ir para @ Menções também solta: Dados acende', await ponto('dados'), 0);

  const esc = await p.evaluate(() => window.__escritas || []);
  const real = Date.now; const ruins = [];
  for (const e of esc) { const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([k, v]) => [(e.p ? e.p + '/' : '') + k, v])); Date.now = () => e.t; let r; try { r = regras(RULES, e.antes, authDe(ANA), mapa); } finally { Date.now = real; } if (!r) ruins.push({ tipo: e.tipo, caminhos: Object.keys(mapa) }); }
  t('CADA escrita da página passa nas regras reais', esc.length > 0 && !ruins.length, { n: esc.length, ruins });
  t('sem erro de JS', !errs.length, errs);
  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
