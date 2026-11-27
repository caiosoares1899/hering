// 🐚 Concha — rodada de UI/UX de 27/11/2026 ("tela cheia de coisas, falta inteligência"). Princípio: cada elemento aparece só quando tem algo a dizer.
// Lista: navegação sem caixa, lidos quietos × com novidade acesos, "Sem canal (ADM)" recolhida com contagem, Novo canal/Seções numa linha.
// Conversa: faixa de assuntos só com assuntos (senão ＋ Assunto no cabeçalho), fixada fina com setas de 44 px no toque, compositor numa linha
// (Aa abre a formatação; atalhos valem fechada; dica só para leitor de tela), "Mensagem em # Canal", e ao abrir com novidade a conversa começa
// na linha "Novas mensagens". Mede a área das mensagens (meta: ≥ 72 % num canal simples) em 1280 e 390, sem rolagem lateral nos 3 temas.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_uiux.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const { update: regras } = require('../../../functions/rules/rulesSim.js');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../database.rules.json'), 'utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const ADM = { uid: 'cai', email: 'caio.soares@ciahering.com.br', displayName: 'Caio Soares', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const ag = Date.now(); const msgs = {};
for (let i = 0; i < 30; i++) msgs['-Nm' + String(i).padStart(2, '0')] = { uid: ['cai', 'als', 'bru'][i % 3], ts: ag - (30 - i) * 7 * 60000, texto: 'mensagem ' + i };
const LIDO = msgs['-Nm19'].ts;   // leu até a 19: as 20–29 (menos as do próprio Caio) são novas
const seed = assuntos => ({ kanban: {
  usuarios: { cai: { role: 'adm', squads: { dados: true, dev: true, prf: true } } },
  squads_meta: { dados: { label: 'Dados', emoji: '📊' }, dev: { label: 'Dev', emoji: '🧪' }, prf: { label: 'Performance e Conversão do E-commerce Hering', emoji: '📱' }, mkt: { label: 'Marketing', emoji: '📣' }, crm: { label: 'CRM', emoji: '💌' } },
  usuarios_publicos: { cai: { nome: 'Caio Soares', email: 'caio.soares@ciahering.com.br' }, als: { nome: 'Alisson Andrade', email: 'als@ciahering.com.br' }, bru: { nome: 'Bruno Reis', email: 'bru@ciahering.com.br' } },
  cardume: {
    canais: { dados: { nome: 'Dados' }, dev: { nome: 'Dev' }, prf: { nome: 'Performance e Conversão do E-commerce Hering' } },
    membros: { dados: { cai: true, als: true, bru: true }, dev: { cai: true, bru: true }, prf: { cai: true } }, meus: { cai: { dados: true, dev: true, prf: true } },
    msgs: { dados: msgs, dev: { '-Nv1': { uid: 'bru', ts: ag - 6e4, texto: 'oi' } } },
    ultima: { dados: { ts: msgs['-Nm29'].ts, uid: 'bru', id: '-Nm29' }, dev: { ts: ag - 6e4, uid: 'bru', id: '-Nv1' } },
    ultima_a: { dados: { _geral: { ts: msgs['-Nm29'].ts, uid: 'bru', id: '-Nm29' } }, dev: { _geral: { ts: ag - 6e4, uid: 'bru', id: '-Nv1' } } },
    lidas: { cai: { dados: LIDO, dev: ag - 864e5 } }, lidas_a: { cai: { dados: { _geral: LIDO }, dev: { _geral: ag - 864e5 } } },   // Dev com novidade de verdade
    fixadas: { dados: { '-Nm09': { por: 'cai', em: ag - 1000, t: 'topo' }, '-Nm05': { por: 'cai', em: ag - 2000, t: 'topo' } } },
    assuntos: assuntos ? { dados: { ates: { n: 'testes', por: 'cai', ts: ag - 864e5, e: '🧵' } } } : {},
  },
} });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 500))); };
const authDe = u => ({ uid: u.uid, token: { email: u.email, firebase: { sign_in_provider: 'google.com' } } });
const regrasOk = async (p, nome) => {
  const esc = await p.evaluate(() => window.__escritas || []); const real = Date.now; const ruins = [];
  for (const e of esc) { const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([k, v]) => [(e.p ? e.p + '/' : '') + k, v])); Date.now = () => e.t; let r; try { r = regras(RULES, e.antes, authDe(ADM), mapa); } finally { Date.now = real; } if (!r) ruins.push({ tipo: e.tipo, caminhos: Object.keys(mapa) }); }
  t(nome + ': cada escrita passa nas regras reais', !ruins.length, ruins);
};

(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const cr = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(cr) ? path.join(cr, fs.readdirSync(cr).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const errs = [];
  const abre = async (w, h, assuntos, tema, extra) => {
    const ctx = await b.newContext(Object.assign({ viewport: { width: w, height: h } }, extra || {})); await fake.install(ctx, seed(assuntos));
    await ctx.addInitScript(tm => { window.__limitarConsultas = true; localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); localStorage.setItem('cardume_lado', '0'); if (tm) localStorage.setItem('concha_tema', tm); }, tema || '');
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(w + (tema || '') + ': ' + e.message));
    await p.goto(base + '/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), ADM); await p.waitForTimeout(1100);
    return { ctx, p };
  };
  const area = p => p.evaluate(() => Math.round(document.getElementById('log').getBoundingClientRect().height / innerHeight * 100));

  // ── computador, canal SEM assuntos ──
  let { ctx, p } = await abre(1280, 860, false);
  t('lista: Menções e Favoritos são linhas de navegação (sem borda), o Buscar continua com cara de campo', await p.evaluate(() => { const c = e => getComputedStyle(document.getElementById(e)).borderTopColor; return c('b-mencoes') === 'rgba(0, 0, 0, 0)' && c('b-favs') === 'rgba(0, 0, 0, 0)'; }), 0);
  const lidoX = await p.evaluate(() => { const s = id => getComputedStyle(document.querySelector('[data-canal="' + id + '"] .nome')); return { novo: document.querySelector('[data-canal="dev"]').classList.contains('nao-lido'), cn: s('dev').color, wn: Number(s('dev').fontWeight), cl: s('geral').color, wl: Number(s('geral').fontWeight) }; });
  t('lista: Dev (com novidade) acende — cor diferente e peso ≥ 800 — e o Geral (lido) fica quieto, peso 600', lidoX.novo && lidoX.cn !== lidoX.cl && lidoX.wn >= 800 && lidoX.wl === 600, lidoX);
  t('lista: "Sem canal (ADM)" nasce recolhida e mostra quantos', await p.evaluate(() => { const h = document.querySelector('.sec-cab[data-sec="semcanal"]'); return !!h && h.getAttribute('aria-expanded') === 'false' && /Sem canal \(ADM\) \(\d+\)/.test(h.textContent) && !document.querySelector('[data-canal="mkt"]'); }), await p.evaluate(() => (document.querySelector('.sec-cab[data-sec="semcanal"]') || {}).textContent));
  await p.click('.sec-cab[data-sec="semcanal"]'); await p.waitForTimeout(300);
  t('lista: abrir "Sem canal" grava r/semcanal = true e mostra os squads', ((((await p.evaluate(() => window.__store.kanban.cardume.secoes)) || {}).cai || {}).r || {}).semcanal === true && await p.evaluate(() => !!document.querySelector('[data-canal="mkt"]')), 0);
  t('lista: Novo canal e Seções na mesma linha', await p.evaluate(() => Math.abs(document.getElementById('b-novo').getBoundingClientRect().top - document.getElementById('b-secoes').getBoundingClientRect().top) < 2), 0);
  t('sem assuntos: a faixa some e o ＋ Assunto aparece no cabeçalho', await p.evaluate(() => document.getElementById('assuntos-barra').hidden && !document.getElementById('b-assunto').hidden), 0);
  t('canal sem assuntos, com fixada, a 1280: mensagens com ≥ 68 % da altura', await area(p) >= 68, await area(p));
  t('o campo diz onde a mensagem vai: "Mensagem em # Dados"', await p.evaluate(() => document.getElementById('entrada').placeholder === 'Mensagem em # Dados'), await p.evaluate(() => document.getElementById('entrada').placeholder));
  t('ao abrir com novidade: linha "Novas mensagens" antes da 1ª nova de outra pessoa (-Nm20)', await p.evaluate(() => { const d = document.querySelector('#log .dia.novas'); const g = document.querySelector('[data-msg="-Nm20"]').closest('.grupo'); return !!d && d.nextElementSibling === g; }), 0);
  t('…e a conversa começa nela (perto do topo da área), não no fim', await p.evaluate(() => { const d = document.querySelector('#log .dia.novas').getBoundingClientRect().top - document.getElementById('log').getBoundingClientRect().top; return d >= -4 && d < 60; }), await p.evaluate(() => document.querySelector('#log .dia.novas').getBoundingClientRect().top - document.getElementById('log').getBoundingClientRect().top));
  await p.click('[data-canal="dev"]'); await p.waitForTimeout(400); await p.click('[data-canal="dados"]'); await p.waitForTimeout(600);
  t('voltando depois de ler, não há mais "Novas mensagens"', await p.evaluate(() => !document.querySelector('#log .dia.novas')), 0);
  t('compositor numa linha: Aa · campo · 😀 · GIF · Enviar; formatação fechada', await p.evaluate(() => { const ids = ['b-fmt', 'entrada', 'b-emoji', 'b-gif', 'b-enviar'].map(i => document.getElementById(i).getBoundingClientRect()); const top = ids.map(r => r.bottom); return Math.max(...top) - Math.min(...top) < 6 && getComputedStyle(document.getElementById('barra-fmt')).display === 'none' && document.getElementById('b-fmt').getAttribute('aria-expanded') === 'false'; }), 0);
  t('a dica do campo continua para leitor de tela (aria-describedby), sem ocupar a tela', await p.evaluate(() => { const a = document.getElementById('ajuda'); return document.getElementById('entrada').getAttribute('aria-describedby') === 'ajuda' && a.getBoundingClientRect().height <= 1 && a.textContent.length > 10; }), 0);
  await p.fill('#entrada', 'olá mundo'); await p.evaluate(() => { const e = document.getElementById('entrada'); e.setSelectionRange(0, 3); }); await p.keyboard.press('Control+b');
  t('Ctrl+B funciona com a barra fechada', await p.evaluate(() => document.getElementById('entrada').value === '**olá** mundo'), await p.evaluate(() => document.getElementById('entrada').value));
  await p.fill('#entrada', '');
  await p.click('#b-fmt'); await p.waitForTimeout(100);
  t('Aa abre a formatação (aria-expanded) e lembra no aparelho', await p.evaluate(() => getComputedStyle(document.getElementById('barra-fmt')).display !== 'none' && document.getElementById('b-fmt').getAttribute('aria-expanded') === 'true' && localStorage.getItem('concha_fmt') === '1'), 0);
  await p.click('#b-fmt'); await p.click('#b-emoji'); await p.waitForTimeout(200);
  t('😀 abre o painel de emoji dentro da tela, do lado do botão', await p.evaluate(() => { const r = document.getElementById('emojis').getBoundingClientRect(), bt = document.getElementById('b-emoji').getBoundingClientRect(); return !document.getElementById('emojis').hidden && r.left >= 0 && r.right <= innerWidth && r.bottom <= bt.top + 2 && r.right >= bt.left; }), 0);
  await p.keyboard.press('Escape'); await p.click('#b-gif'); await p.waitForTimeout(250);
  t('GIF abre o painel dentro da tela', await p.evaluate(() => { const r = document.getElementById('gifs').getBoundingClientRect(); return !document.getElementById('gifs').hidden && r.left >= 0 && r.right <= innerWidth && r.top >= 0; }), 0);
  await p.keyboard.press('Escape'); await p.evaluate(() => { if (!document.getElementById('gifs').hidden) document.getElementById('b-gif').click(); });
  await p.click('#b-assunto'); await p.waitForTimeout(150);
  t('＋ Assunto do cabeçalho abre o modal de novo assunto', await p.evaluate(() => !document.getElementById('ov').hidden && /assunto/i.test(document.querySelector('.md h2').textContent)), 0);
  await p.keyboard.press('Escape');
  await regrasOk(p, '1280');
  await ctx.close();

  // ── canal COM assunto: a faixa volta; 3 temas sem rolagem lateral ──
  for (const tema of ['', 'lencois', 'vice']) {
    ({ ctx, p } = await abre(1280, 860, true, tema));
    t('com assunto [' + (tema || 'abrolhos') + ']: faixa visível, ＋ Assunto no fim da faixa (não no cabeçalho), sem rolagem lateral', await p.evaluate(() => !document.getElementById('assuntos-barra').hidden && document.getElementById('b-assunto').hidden && !!document.querySelector('#assuntos-barra [data-aid="_novo"]') && document.documentElement.scrollWidth <= innerWidth), 0);
    await ctx.close();
  }

  // ── celular ──
  ({ ctx, p } = await abre(390, 800, false, '', { hasTouch: true, isMobile: true }));
  await p.evaluate(() => { document.getElementById('app').dataset.tela = 'conversa'; });
  t('celular, sem assuntos e com fixada: ≥ 66 % da altura para as mensagens', await area(p) >= 66, await area(p));
  t('celular: Aa, 😀, GIF, Enviar e setas da fixada com 44 px', await p.evaluate(() => ['b-fmt', 'b-emoji', 'b-gif', 'b-enviar'].every(i => { const r = document.getElementById(i).getBoundingClientRect(); return r.width >= 44 && r.height >= 44; }) && [...document.querySelectorAll('.fix-nav button')].every(x => x.getBoundingClientRect().height >= 44)), await p.evaluate(() => ['b-fmt', 'b-emoji', 'b-gif', 'b-enviar'].map(i => { const r = document.getElementById(i).getBoundingClientRect(); return i + ':' + Math.round(r.width) + 'x' + Math.round(r.height); }).concat([...document.querySelectorAll('.fix-nav button')].map(x => Math.round(x.getBoundingClientRect().height)))));
  t('celular: Enviar com nome acessível "Enviar" e campo com ≥ 140 px', await p.evaluate(() => document.getElementById('b-enviar').getAttribute('aria-label') === 'Enviar' && document.getElementById('entrada').getBoundingClientRect().width >= 140), await p.evaluate(() => document.getElementById('entrada').getBoundingClientRect().width));
  t('celular: sem rolagem lateral', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 0);
  await p.evaluate(() => { document.getElementById('app').dataset.tela = 'canais'; }); await p.click('[data-canal="prf"]'); await p.waitForTimeout(500);
  const cab = await p.evaluate(() => { const h = document.getElementById('canal-titulo'), r = id => document.getElementById(id).getBoundingClientRect(); return { hw: [h.scrollWidth, h.clientWidth], A: [Math.round(r('b-assunto').width), Math.round(r('b-assunto').height)], I: Math.round(r('b-lado').height), corta: h.scrollWidth > h.clientWidth && getComputedStyle(h).textOverflow === 'ellipsis', ass: !document.getElementById('b-assunto').hidden && r('b-assunto').height >= 44 && r('b-assunto').right <= innerWidth, info: r('b-lado').height >= 44 && r('b-lado').right <= innerWidth, rol: document.documentElement.scrollWidth <= innerWidth }; });
  t('celular, canal de nome longo sem assuntos: título com reticências, ＋ Assunto e ℹ️ com 44 px à vista, sem rolagem lateral', cab.corta && cab.ass && cab.info && cab.rol, cab);
  await ctx.close();

  t('sem erro de JS', !errs.length, errs);
  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
