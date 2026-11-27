// 🐚 Concha — ℹ️ Detalhes reorganizado + "⭐ Favoritos" virou "🔖 Salvos" (27/11/2026, print do Caio).
// Ordem: sobre o canal → Para você (Avisos, Sua etiqueta, Na sua lista) → fixadas (só se houver; vazio = 1 linha para quem pode fixar) →
// Membros (nome inteiro; Fazer admin / Tirar do canal no ⋯) → ＋ Adicionar pessoa (aberto num canal novo e enquanto adiciona) →
// O canal (emoji, editar; só quem administra) → 🚪 Sair do canal por último. Nada sai da largura do painel em 1280 e 390.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_detalhes.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const { update: regras } = require('../../../functions/rules/rulesSim.js');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../database.rules.json'), 'utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const mk = (uid, nome) => ({ uid, email: uid + '@ciahering.com.br', displayName: nome, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const ANA = mk('ana', 'Ana Lima'), BRU = mk('bru', 'Bruno Reis');
const ag = Date.now(), T = 't-dados-ecomm-ab12', N = 't-novo-cd34';
const nomes = { ana: 'Ana Lima', bru: 'Bruno Reis', als: 'Alisson de Oliveira Andrade Albuquerque', gab: 'Gabriela Sabior Antunes', luc: 'Lucas Dourado Bezerra' };
const seed = () => ({ kanban: {
  usuarios: { ana: { role: 'membro' }, bru: { role: 'membro' } },
  usuarios_publicos: Object.fromEntries(Object.entries(nomes).map(([k, n]) => [k, { nome: n, email: k + '@ciahering.com.br' }])),
  cardume: {
    canais: { [T]: { nome: 'dados + ecomm', tipo: 'tema', dono: 'ana', acesso: 'aberto', criado: ag - 864e5, e: '🤝' }, [N]: { nome: 'novo', tipo: 'tema', dono: 'ana', acesso: 'convite', criado: ag - 1000 } },
    abertos: { [T]: { nome: 'dados + ecomm' } },
    membros: { [T]: { ana: true, bru: true, als: true, gab: true, luc: true }, [N]: { ana: true } }, meus: { ana: { [T]: true, [N]: true }, bru: { [T]: true } },
    msgs: { [T]: { '-Na': { uid: 'als', ts: ag - 6e4, texto: 'oi' } } },
  },
} });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 500))); };
const authDe = u => ({ uid: u.uid, token: { email: u.email, firebase: { sign_in_provider: 'google.com' } } });

(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const cr = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(cr) ? path.join(cr, fs.readdirSync(cr).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const errs = [];
  const abre = async (quem, canal, w, h, extra) => {
    const ctx = await b.newContext(Object.assign({ viewport: { width: w, height: h } }, extra || {})); await fake.install(ctx, seed());
    await ctx.addInitScript(() => { window.__limitarConsultas = true; localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); localStorage.setItem('cardume_lado', '1'); });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(w + ': ' + e.message));
    await p.goto(base + '/cardume-dev.html?c=' + canal); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), quem); await p.waitForTimeout(1100);
    return { ctx, p };
  };
  const cabe = p => p.evaluate(() => { const L = document.getElementById('lado').getBoundingClientRect(); return [...document.querySelectorAll('#lado .opcoes > *, #lado .pessoa .mais, #lado .chip')].every(e => { const r = e.getBoundingClientRect(); return r.right <= L.right + 1 && r.left >= L.left - 1; }); });

  // ── dona, computador ──
  let { ctx, p } = await abre(ANA, T, 1280, 860);
  t('🔖 Salvos na lista (era ⭐ Favoritos)', await p.evaluate(() => /^🔖 Salvos$/.test(document.getElementById('b-favs').textContent.trim())), 0);
  const ordem = await p.evaluate(() => [...document.querySelectorAll('#lado section > *')].map(e => e.matches('h3') ? 'H:' + e.textContent : e.matches('.lado-sobre') ? 'sobre' : e.matches('.opcoes') ? 'lista' : e.matches('.fixadas') ? 'fix' : e.matches('.opc-add') ? 'add' : e.matches('.sair') ? 'sair' : e.tagName.toLowerCase()));
  t('ordem: sobre → Para você → (fixadas) → Membros → Adicionar → O canal → Sair', JSON.stringify(ordem) === JSON.stringify(['sobre', 'H:Para você', 'lista', 'fix', 'H:Membros (5)', 'lista', 'add', 'H:O canal', 'lista', 'sair']), ordem);
  t('sobre: "Criado por Ana Lima · aberto a toda a Hering"', await p.evaluate(() => document.querySelector('#lado .lado-sobre').textContent === 'Criado por Ana Lima · aberto a toda a Hering'), 0);
  t('Para você: Avisos, Sua etiqueta, Na sua lista (linhas de 44 px)', await p.evaluate(() => { const r = [...document.querySelectorAll('#lado .opcoes')][0].querySelectorAll('[data-opc]'); return [...r].map(x => x.dataset.opc).join() === 'avisos,etiqueta,secao' && [...r].every(x => x.getBoundingClientRect().height >= 44); }), 0);
  t('fixadas vazias: uma linha só, para quem pode fixar', await p.evaluate(() => { const f = document.querySelector('#lado .fixadas'); return !!f && f.querySelectorAll('h3').length === 0 && /Nada fixado nem regras/.test(f.textContent); }), 0);
  t('membros: nome inteiro do lado, sem botões "Tirar/Fazer admin" na linha; ⋯ para os outros, selo "dona" para ela', await p.evaluate(() => { const ls = [...document.querySelectorAll('#lado .membros .pessoa')]; return ls.length === 5 && !ls.some(l => [...l.querySelectorAll('button')].some(x => /^(Tirar|Fazer admin)$/.test(x.textContent))) && ls.filter(l => l.querySelector('.mais')).length === 4 && ls.some(l => /Ana Lima/.test(l.textContent) && l.querySelector('.chip')?.textContent === 'dona'); }), 0);
  t('nada sai da largura do painel (1280)', await cabe(p), 0);
  await p.click('#lado .membros .pessoa:has-text("Bruno") .mais'); await p.waitForTimeout(150);
  t('⋯ abre o menu da pessoa: Fazer admin e Tirar do canal (vermelho)', await p.evaluate(() => { const it = [...document.querySelectorAll('#ctx button')].map(x => x.textContent); return !document.getElementById('ctx').hidden && /Bruno Reis/.test(document.querySelector('#ctx .ctx-tit').textContent) && it.some(x => /Fazer admin/.test(x)) && !!document.querySelector('#ctx button.perigo') && /Tirar do canal/.test(document.querySelector('#ctx button.perigo').textContent); }), 0);
  await p.evaluate(() => [...document.querySelectorAll('#ctx button')].find(x => /Fazer admin/.test(x.textContent)).click()); await p.waitForTimeout(300);
  t('Fazer admin pelo ⋯ grava admins/T/bru', ((await p.evaluate(t0 => window.__store.kanban.cardume.admins, T)) || {})[T]?.bru === true, 0);
  t('com 5 membros, "＋ Adicionar pessoa" vem recolhido (sem a busca)', await p.evaluate(() => document.querySelector('#lado .opc-add').getAttribute('aria-expanded') === 'false' && !document.querySelector('#lado input[type="search"]')), 0);
  await p.click('#lado .opc-add'); await p.waitForTimeout(150);
  t('＋ Adicionar pessoa abre a busca com o foco nela', await p.evaluate(() => document.activeElement === document.querySelector('#lado input[type="search"]')), 0);
  t('O canal: emoji (🤝) e ⚙️ Editar canal; 🚪 Sair do canal por último, em vermelho', await p.evaluate(() => { const g = [...document.querySelectorAll('#lado .opcoes')].pop(); const s = document.querySelector('#lado .sair-canal'); return /Emoji do canal.*🤝/.test(g.textContent) && !!g.querySelector('[data-opc="editar"]') && !!s && getComputedStyle(s).color !== getComputedStyle(document.querySelector('#lado .opc')).color && document.querySelector('#lado section').lastElementChild.contains(s); }), 0);
  await ctx.close();

  // ── canal novo (só a dona): a busca já vem aberta e continua aberta enquanto adiciona ──
  ({ ctx, p } = await abre(ANA, N, 1280, 860));
  t('canal novo: "＋ Adicionar pessoa" já aberto (é a próxima coisa a fazer)', await p.evaluate(() => !!document.querySelector('#lado input[type="search"]')), 0);
  await p.fill('#lado input[type="search"]', 'Bruno'); await p.click('#lado .pessoa button:has-text("Adicionar")'); await p.waitForTimeout(400);
  t('depois de adicionar (2 membros), a busca continua aberta para a próxima pessoa', await p.evaluate(() => !!document.querySelector('#lado input[type="search"]') && document.querySelectorAll('#lado .membros .pessoa').length === 2), 0);
  const esc = await p.evaluate(() => window.__escritas || []); const real = Date.now; const ruins = [];
  for (const e of esc) { const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([k, v]) => [(e.p ? e.p + '/' : '') + k, v])); Date.now = () => e.t; let r; try { r = regras(RULES, e.antes, authDe(ANA), mapa); } finally { Date.now = real; } if (!r) ruins.push({ tipo: e.tipo, caminhos: Object.keys(mapa) }); }
  t('cada escrita da dona passa nas regras reais', !ruins.length, ruins);
  await ctx.close();

  // ── membro comum: sem ⋯, sem "O canal", sem linha de fixadas vazias ──
  ({ ctx, p } = await abre(BRU, T, 1280, 860));
  t('membro comum: sem ⋯ nos membros, sem "O canal", sem "Adicionar", sem linha de fixadas vazias; Sair continua', await p.evaluate(() => !document.querySelector('#lado .mais') && ![...document.querySelectorAll('#lado h3')].some(h => h.textContent === 'O canal') && !document.querySelector('#lado .opc-add') && !document.querySelector('#lado .fix-vazio') && !!document.querySelector('#lado .sair-canal')), 0);
  await ctx.close();

  // ── celular ──
  ({ ctx, p } = await abre(ANA, T, 390, 800, { hasTouch: true, isMobile: true }));
  await p.evaluate(() => { document.getElementById('app').dataset.tela = 'lado'; }); await p.waitForTimeout(200);
  t('celular: nada sai da largura, ⋯ com 44 px, sem rolagem lateral', await cabe(p) && await p.evaluate(() => [...document.querySelectorAll('#lado .mais')].every(x => x.getBoundingClientRect().height >= 44) && document.documentElement.scrollWidth <= innerWidth), 0);
  await ctx.close();

  t('sem erro de JS', !errs.length, errs);
  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
