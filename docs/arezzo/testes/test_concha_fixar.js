// 🐚 Concha — 📌 fixadas no topo e 📜 regras do canal (26/11/2026, docs/ideias/cardume-v0-banco.md › "Fixar no canal").
// Decisões do Caio: só quem ADMINISTRA o canal fixa, move e desafixa. Dois tipos: 'topo' (faixa no alto da conversa, até 3, uma por vez,
// como no WhatsApp) e 'regra' (ℹ️ Detalhes › 📜 Regras do canal, texto inteiro, até 10, aviso na 1ª vez). Fixada antiga sem tipo = regra.
// Apagar a mensagem tira a fixada no mesmo update; órfã é limpa por qualquer membro. Cada escrita conferida nas regras reais.
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
  const msgs = { velha: { uid: 'ana', ts: ag - 9e6, texto: 'Decisão: o banner sai na segunda' }, minha: { uid: 'pau', ts: ag - 8e6, texto: '**Regra 1:** pedido de banner só pelo card' } };
  for (let i = 0; i < 55; i++) msgs['n' + String(i).padStart(2, '0')] = { uid: i % 2 ? 'ana' : 'pau', ts: ag - 6e6 + i * 1000, texto: 'mensagem ' + i };
  return { kanban: {
    usuarios: { pau: { role: 'membro', squads: { dados: true }, squads_roles: { dados: 'po' } }, ana: { role: 'membro', squads: { dados: true } } },
    usuarios_publicos: { pau: P('Paula PO'), ana: P('Ana Lima') },
    cardume: {
      canais: { dados: { nome: 'Dados' } },
      membros: { dados: { pau: true, ana: true } },
      meus: { pau: { dados: true }, ana: { dados: true } },
      msgs: { dados: msgs },
      fixadas: { dados: { velha: { por: 'pau', em: ag - 5e6, t: 'topo' }, minha: { por: 'pau', em: ag - 4e6 }, sumiu: { por: 'pau', em: ag - 3e6, t: 'topo' } } },
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
  const abre = async (quem, w) => {
    const ctx = await b.newContext({ viewport: { width: w || 1280, height: 860 } }); await fake.install(ctx, seed());
    await ctx.addInitScript(() => { window.__limitarConsultas = true; localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(x => window.__authCb(x), quem); await p.waitForTimeout(1000);
    return { ctx, p, errs };
  };
  const S = p => p.evaluate(() => JSON.parse(JSON.stringify(window.__store.kanban.cardume)));
  const faixa = p => p.evaluate(() => { const f = document.getElementById('faixa-fix'); return { hidden: f.hidden, ic: (f.querySelector('.fix-ic') || {}).textContent || '', txt: (f.querySelector('.fix-txt') || {}).textContent || '', aviso: (f.querySelector('.fix-regras-aviso') || {}).textContent || '' }; });
  const lado = p => p.evaluate(() => { const f = document.querySelector('#lado .fixadas'); if (!f) return null; return { topo: [...f.querySelectorAll('.fix-item .citacao')].map(x => x.textContent), regras: [...f.querySelectorAll('.regra-item .regra-txt')].map(x => x.innerHTML), hs: [...f.querySelectorAll('h3')].map(x => x.textContent) }; });
  const fixarComo = async (p, id, rot) => { await p.hover('[data-msg="' + id + '"]'); await p.click('[data-msg="' + id + '"] [aria-label^="Fix"]'); await p.waitForTimeout(150); await p.click('.md .tipo-fix button:has-text("' + rot + '")'); await p.waitForTimeout(300); };

  // ── PO da squad (gestora do canal) ──
  { const { ctx, p, errs } = await abre(PAU);
    let f = await faixa(p);
    t('faixa do topo mostra a fixada de topo FORA das 50 carregadas (escuta própria); a órfã some', !f.hidden && /Decisão: o banner sai na segunda/.test(f.txt) && f.ic === '📌', f);
    t('fixada antiga sem tipo vira 📜 regra; aviso "Este canal tem 1 regra"', /Este canal tem 1 regra/.test(f.aviso), f);
    const l = await lado(p);
    t('ℹ️ Detalhes: 📌 No topo (1/3) e 📜 Regras do canal (1), com o texto inteiro formatado', l && l.hs[0] === '📌 No topo (1/3)' && l.hs[1] === '📜 Regras do canal (1)' && /<(strong|b)>Regra 1:<\/(strong|b)>/.test(l.regras[0]), l);
    await fixarComo(p, 'n54', 'No topo do canal');
    await fixarComo(p, 'n53', 'No topo do canal');
    let c = await S(p);
    t('fixar no topo grava {por, em, t: "topo"}', c.fixadas.dados.n54 && c.fixadas.dados.n54.t === 'topo' && c.fixadas.dados.n54.por === 'pau', c.fixadas.dados.n54);
    f = await faixa(p);
    t('com 3 no topo: a faixa mostra a mais nova e "📌 1/3"', f.ic === '📌 1/3' && /mensagem 53/.test(f.txt), f);
    await p.click('#faixa-fix .fix-ic'); await p.waitForTimeout(150); f = await faixa(p);
    t('tocar no 📌 passa para a próxima (2/3)', f.ic === '📌 2/3' && /mensagem 54/.test(f.txt), f);
    await p.hover('[data-msg="n52"]'); await p.click('[data-msg="n52"] [aria-label^="Fix"]'); await p.waitForTimeout(150);
    t('topo cheio (3): a opção 📌 fica desligada e diz "Cheio"', await p.evaluate(() => { const b = [...document.querySelectorAll('.md .tipo-fix button')].find(x => /No topo/.test(x.textContent)); return !!b && b.disabled && /Cheio/.test(document.querySelector('.md .tipo-fix').textContent); }), 0);
    await p.click('.md .tipo-fix button:has-text("Regra do canal")'); await p.waitForTimeout(300);
    c = await S(p);
    t('fixar como regra grava t: "regra"', c.fixadas.dados.n52 && c.fixadas.dados.n52.t === 'regra', c.fixadas.dados.n52);
    await p.hover('[data-msg="n53"]'); await p.click('[data-msg="n53"] [aria-label^="Fix"]'); await p.waitForTimeout(150);
    t('fixada: o modal oferece "Mover para 📜 Regra do canal" e "Desafixar"', await p.evaluate(() => /Mover para 📜 Regra do canal/.test(document.querySelector('.md').textContent) && !!document.querySelector('.md button.perigo')), 0);
    await p.click('.md .tipo-fix button'); await p.waitForTimeout(300);
    c = await S(p);
    t('mover troca só o tipo (mesmo autor e hora)', c.fixadas.dados.n53.t === 'regra' && c.fixadas.dados.n53.por === 'pau', c.fixadas.dados.n53);
    t('a mensagem mostra "📜 Regra do canal" / "📌 Fixada no topo"', await p.evaluate(() => /📜 Regra do canal/.test(document.querySelector('[data-msg="n53"]').textContent) && /📌 Fixada no topo/.test(document.querySelector('[data-msg="n54"]').textContent)), 0);
    await p.locator('#lado .fix-item').first().locator('button:not(.citacao)').click(); await p.waitForTimeout(300);
    c = await S(p); t('Desafixar na lista do topo tira do banco', !c.fixadas.dados.n54, c.fixadas.dados);
    await p.click('#faixa-fix .fix-regras-aviso button.primary'); await p.waitForTimeout(300);
    t('"Ver regras" leva às regras e o aviso some', !(await faixa(p)).aviso, await faixa(p));
    await fixarComo(p, 'n50', 'No topo do canal');
    await p.hover('[data-msg="n50"]'); await p.waitForTimeout(100);
    const temApagar = await p.evaluate(() => !!document.querySelector('[data-msg="n50"] [aria-label="Apagar"]'));
    if (temApagar) { await p.click('[data-msg="n50"] [aria-label="Apagar"]'); await p.waitForTimeout(5600); }
    c = await S(p);
    const apag = await p.evaluate(() => (window.__escritas || []).find(e => e.tipo === 'update' && e.v && Object.keys(e.v).some(k => /msgs\/dados\/n50$/.test(k))));
    t('apagar uma mensagem fixada: tombstone + fixada fora no MESMO update', temApagar && c.msgs.dados.n50.apagada === true && apag && apag.v['kanban/cardume/fixadas/dados/n50'] === null, { temApagar, apag: apag && Object.keys(apag.v) });
    const rr = await conferirRegras(p, PAU);
    t('CADA escrita da gestora passa nas regras reais', rr.n > 0 && !rr.ruins.length, rr);
    t('sem erro de JS (gestora)', !errs.length, errs);
    await ctx.close(); }

  // ── membro comum (não administra), no celular ──
  { const { ctx, p, errs } = await abre(ANA, 390);
    await p.waitForTimeout(400);
    const c = await S(p), f = await faixa(p);
    t('membro vê a faixa do topo e o aviso de regras (celular)', !f.hidden && /Decisão/.test(f.txt) && /Este canal tem 1 regra/.test(f.aviso), f);
    await p.click('#faixa-fix .fix-regras-aviso button.primary'); await p.waitForTimeout(300);
    t('"Ver regras" no celular abre a tela de Detalhes com as regras', await p.evaluate(() => document.getElementById('app').dataset.tela === 'lado' && /Regra 1/.test(document.querySelector('#lado .regras').textContent)), 0);
    t('aviso dispensado fica guardado (neste aparelho)', await p.evaluate(() => !!localStorage.getItem('concha_regras_dados')), 0);
    await p.click('#lado .voltar'); await p.waitForTimeout(200);
    await p.click('[data-msg="n50"]'); await p.waitForTimeout(100);
    t('membro NÃO vê 📌 Fixar nas ações (decisão do Caio: só quem administra)', await p.evaluate(() => !document.querySelector('[data-msg="n50"] [aria-label^="Fix"]')), 0);
    t('membro não vê Desafixar nas listas', await p.evaluate(() => ![...document.querySelectorAll('#lado .fixadas button')].some(b => /Desafixar/.test(b.textContent))), 0);
    t('fixada órfã (mensagem que sumiu) é limpa pelo membro', !c.fixadas.dados.sumiu && !!c.fixadas.dados.velha, c.fixadas.dados);
    const rr = await conferirRegras(p, ANA);
    t('CADA escrita do membro passa nas regras reais', rr.n > 0 && !rr.ruins.length, rr);
    t('sem erro de JS (membro)', !errs.length, errs);
    await ctx.close(); }

  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
