// 🐚 Concha — 📌 fixar no canal (26/11/2026, docs/ideias/cardume-v0-banco.md › "Fixar no canal"). Decisões do Caio: só quem ADMINISTRA
// o canal fixa e desafixa; a fixada fica em ℹ️ Detalhes › 📌 Fixadas para todo o canal. Apagar a mensagem tira a fixada no mesmo update;
// fixada órfã (mensagem apagada/sumida) é limpa por qualquer membro. Cada escrita conferida nas regras reais.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_fixar.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const { update: regras } = require('../../../functions/rules/rulesSim.js');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../database.rules.json'), 'utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const U = (uid, nome) => ({ uid, email: uid + '@ciahering.com.br', displayName: nome, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const PAU = U('pau', 'Paula PO'), ANA = U('ana', 'Ana Lima');
const ag = Date.now();
const P = n => ({ nome: n, email: n.split(' ')[0].toLowerCase() + '@ciahering.com.br' });
const seed = () => {
  const msgs = { velha: { uid: 'ana', ts: ag - 9e6, texto: 'Decisão: o banner sai na segunda' }, minha: { uid: 'pau', ts: ag - 8e6, texto: 'link da planilha' } };
  for (let i = 0; i < 55; i++) msgs['n' + String(i).padStart(2, '0')] = { uid: i % 2 ? 'ana' : 'pau', ts: ag - 6e6 + i * 1000, texto: 'mensagem ' + i };
  return { kanban: {
    usuarios: { pau: { role: 'membro', squads: { dados: true }, squads_roles: { dados: 'po' } }, ana: { role: 'membro', squads: { dados: true } } },
    usuarios_publicos: { pau: P('Paula PO'), ana: P('Ana Lima') },
    cardume: {
      canais: { dados: { nome: 'Dados' } },
      membros: { dados: { pau: true, ana: true } },
      meus: { pau: { dados: true }, ana: { dados: true } },
      msgs: { dados: msgs },
      fixadas: { dados: { velha: { por: 'pau', em: ag - 5e6 }, minha: { por: 'pau', em: ag - 4e6 }, sumiu: { por: 'pau', em: ag - 3e6 } } },
    } } };
};
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 500))); };
const authDe = u => ({ uid: u.uid, token: { email: u.email, firebase: { sign_in_provider: 'google.com' } } });
async function conferirRegras(p, quem) {
  const esc = await p.evaluate(() => window.__escritas || []);
  const real = Date.now; const ruins = [];
  for (const e of esc) { const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([kk, v]) => [(e.p ? e.p + '/' : '') + kk, v])); Date.now = () => e.t; let rr; try { rr = regras(RULES, e.antes, authDe(quem), mapa); } finally { Date.now = real; } if (!rr) ruins.push({ tipo: e.tipo, caminhos: Object.keys(mapa) }); }
  return { n: esc.length, ruins };
}
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(chromeRoot) ? path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const abre = async quem => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed());
    await ctx.addInitScript(() => { window.__limitarConsultas = true; localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(x => window.__authCb(x), quem); await p.waitForTimeout(1000);
    return { ctx, p, errs };
  };
  const S = p => p.evaluate(() => JSON.parse(JSON.stringify(window.__store.kanban.cardume)));
  const lado = p => p.evaluate(() => { const f = document.querySelector('#lado .fixadas'); return f ? { h: f.querySelector('h3').textContent, itens: [...f.querySelectorAll('.fix-item .citacao')].map(x => x.textContent), desafixar: f.querySelectorAll('.fix-item > button:not(.citacao)').length, txt: f.textContent } : null; });

  // ── PO da squad (gestora do canal) ──
  { const { ctx, p, errs } = await abre(PAU);
    let l = await lado(p);
    t('ℹ️ Detalhes mostra 📌 Fixadas com a mensagem FORA das 50 carregadas (escuta própria)', l && /📌 Fixadas \(2\)/.test(l.h) && l.itens.some(x => /Decisão: o banner sai na segunda/.test(x)) && l.itens.some(x => /link da planilha/.test(x)), l);
    t('fixada de mensagem que não existe mais some da lista', l && !l.itens.some(x => /…/.test(x)) && l.itens.length === 2, l);
    t('a gestora vê "Desafixar" em cada item', l && l.desafixar === 2, l);
    await p.hover('[data-msg="n54"]');
    t('nas ações da mensagem: 📌 Fixar', await p.evaluate(() => !!document.querySelector('[data-msg="n54"] [aria-label="Fixar no canal (aparece em ℹ️ Detalhes)"]')), 0);
    await p.click('[data-msg="n54"] [aria-label="Fixar no canal (aparece em ℹ️ Detalhes)"]'); await p.waitForTimeout(300);
    let c = await S(p);
    t('fixar grava fixadas/dados/n54 = {por: pau, em}', c.fixadas.dados.n54 && c.fixadas.dados.n54.por === 'pau' && typeof c.fixadas.dados.n54.em === 'number', c.fixadas.dados);
    t('a mensagem ganha "📌 Fixada" e a lista passa a 3, a mais nova primeiro', await p.evaluate(() => /📌 Fixada/.test(document.querySelector('[data-msg="n54"]').textContent)) && /\(3\)/.test((await lado(p)).h) && /mensagem 54/.test((await lado(p)).itens[0]), await lado(p));
    await p.locator('#lado .fix-item').first().locator('button:not(.citacao)').click(); await p.waitForTimeout(300);
    c = await S(p);
    t('Desafixar na lista tira do banco e da conversa', !c.fixadas.dados.n54 && await p.evaluate(() => !/📌 Fixada/.test(document.querySelector('[data-msg="n54"]').textContent)), c.fixadas.dados);
    await p.click('#lado .fix-item .citacao'); await p.waitForTimeout(500);
    t('clicar numa fixada leva até ela (sem erro)', !errs.length, errs);
    // apagar a própria mensagem fixada: o tombstone e a saída das fixadas no MESMO update
    await p.hover('[data-msg="n52"]'); await p.click('[data-msg="n52"] [aria-label="Fixar no canal (aparece em ℹ️ Detalhes)"]'); await p.waitForTimeout(300);
    await p.hover('[data-msg="n52"]'); await p.waitForTimeout(100);
    const temApagar = await p.evaluate(() => !!document.querySelector('[data-msg="n52"] [aria-label="Apagar"]'));
    if (temApagar) { await p.click('[data-msg="n52"] [aria-label="Apagar"]'); await p.waitForTimeout(5600); }
    c = await S(p);
    const apag = (await p.evaluate(() => (window.__escritas || []).find(e => e.tipo === 'update' && e.v && Object.keys(e.v).some(k => /msgs\/dados\/n52$/.test(k)))));
    t('apagar uma mensagem fixada: tombstone + fixada fora no MESMO update', temApagar && c.msgs.dados.n52.apagada === true && apag && Object.prototype.hasOwnProperty.call(apag.v, 'kanban/cardume/fixadas/dados/n52') && apag.v['kanban/cardume/fixadas/dados/n52'] === null, { temApagar, apag: apag && Object.keys(apag.v) });
    const rr = await conferirRegras(p, PAU);
    t('CADA escrita da gestora passa nas regras reais', rr.n > 0 && !rr.ruins.length, rr);
    t('sem erro de JS (gestora)', !errs.length, errs);
    await ctx.close(); }

  // ── membro comum (não administra) ──
  { const { ctx, p, errs } = await abre(ANA);
    await p.waitForTimeout(400);
    const c = await S(p), l = await lado(p);
    t('membro vê a lista, sem "Desafixar"', l && l.itens.length === 2 && l.desafixar === 0, l);
    await p.hover('[data-msg="n50"]');
    t('membro NÃO vê 📌 Fixar nas ações (decisão do Caio: só quem administra)', await p.evaluate(() => !document.querySelector('[data-msg="n50"] [aria-label^="Fixar"]') && !document.querySelector('[data-msg="n50"] [aria-label^="Desafixar"]')), 0);
    t('fixada órfã (mensagem que sumiu) é limpa pelo membro', !c.fixadas.dados.sumiu && !!c.fixadas.dados.velha, c.fixadas.dados);
    const rr = await conferirRegras(p, ANA);
    t('CADA escrita do membro passa nas regras reais', rr.n > 0 && !rr.ruins.length, rr);
    t('sem erro de JS (membro)', !errs.length, errs);
    await ctx.close(); }

  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
