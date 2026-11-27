// 🐚 Concha — 🖱️ menu de contexto (27/11/2026). No canal da lista (clique direito, tecla Menu/Shift+F10, toque longo): abrir, marcar como
// lido / NÃO LIDO, avisos, mover de seção, copiar link, detalhes, sair. Na mensagem (clique direito): as mesmas ações da pílula + copiar
// texto; link e texto selecionado ficam com o menu do navegador. Teclado: setas, Esc devolve o foco. Cada escrita conferida nas regras reais.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_menu_contexto.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const { update: regras } = require('../../../functions/rules/rulesSim.js');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../database.rules.json'), 'utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const agora = Date.now(), T1 = agora - 3e5, T2 = agora - 2e5;
const seed = () => ({ kanban: {
  usuarios: { ana: { role: 'membro', squads: { dados: true } } },
  usuarios_publicos: { ana: { nome: 'Ana Lima', email: 'ana@ciahering.com.br' }, bru: { nome: 'Bruno Reis', email: 'bru@ciahering.com.br' } },
  cardume: {
    canais: { dados: { nome: 'Dados' }, prf: { nome: 'Performance' } },
    membros: { dados: { ana: true, bru: true }, prf: { ana: true, bru: true } }, meus: { ana: { dados: true, prf: true } },
    msgs: { dados: { '-Nd1': { uid: 'bru', ts: T1, texto: 'veja https://exemplo.com.br' }, '-Nd2': { uid: 'bru', ts: T2, texto: 'texto para copiar' } }, prf: { '-Np1': { uid: 'bru', ts: T1, texto: 'oi' } } },
    ultima: { dados: { ts: T2, uid: 'bru', id: '-Nd2' }, prf: { ts: T1, uid: 'bru', id: '-Np1' } },
    ultima_a: { dados: { _geral: { ts: T2, uid: 'bru', id: '-Nd2' } }, prf: { _geral: { ts: T1, uid: 'bru', id: '-Np1' } } },
    lidas: { ana: { dados: T2, prf: T1 } }, lidas_a: { ana: { dados: { _geral: T2 }, prf: { _geral: T1 } } },
    secoes: { ana: { s: { sproj: { n: 'Projetos', o: 1 } } } },
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
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  await ctx.addInitScript(() => { window.__limitarConsultas = true; localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/cardume-dev.html?c=prf'); await p.waitForFunction(() => !!window.__authCb);
  await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(900);
  const S = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__store.kanban.cardume)));
  const itens = () => p.evaluate(() => document.getElementById('ctx').hidden ? null : [...document.querySelectorAll('#ctx button')].map(x => x.textContent));
  const clicaItem = txt => p.evaluate(tx => [...document.querySelectorAll('#ctx button')].find(x => x.textContent.includes(tx)).click(), txt);
  const ponto = id => p.evaluate(i => !!document.querySelector('[data-canal="' + i + '"].nao-lido'), id);

  // ── canal: clique direito ──
  await p.click('[data-canal="dados"]', { button: 'right' }); await p.waitForTimeout(150);
  let it = await itens();
  t('clique direito em Dados abre o menu do canal (role=menu, título)', !!it && await p.evaluate(() => document.getElementById('ctx').getAttribute('role') === 'menu' && document.querySelector('#ctx .ctx-tit').textContent === '# Dados'), it);
  t('itens: Abrir, Não lido, Avisos, seções (padrão/Projetos/Nova), Link, Detalhes, Sair', !!it && ['Abrir', 'Marcar como não lido', 'Avisos: todas as mensagens…', 'Squads (padrão)', 'Projetos', 'Nova seção…', 'Copiar link do canal', 'Detalhes', 'Sair do canal'].every(x => it.some(y => y.includes(x))), it);
  t('o foco vai para o 1º item', await p.evaluate(() => document.activeElement === document.querySelector('#ctx button')), 0);
  await p.keyboard.press('ArrowDown');
  t('↓ passa para o próximo item', await p.evaluate(() => document.activeElement === document.querySelectorAll('#ctx button')[1]), 0);
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  t('Esc fecha e devolve o foco ao canal', await p.evaluate(() => document.getElementById('ctx').hidden && document.activeElement === document.querySelector('[data-canal="dados"]')), 0);

  await p.click('[data-canal="dados"]', { button: 'right' }); await clicaItem('Marcar como não lido'); await p.waitForTimeout(400);
  let c = await S();
  t('🔵 Marcar como não lido grava lidas e lidas_a/_geral = última − 1', c.lidas.ana.dados === T2 - 1 && c.lidas_a.ana.dados._geral === T2 - 1, { l: c.lidas.ana, a: c.lidas_a.ana.dados });
  t('Dados acende na lista (sem abrir)', await ponto('dados'), 0);
  await p.click('[data-canal="dados"]', { button: 'right' }); await p.waitForTimeout(100);
  it = await itens();
  t('com mensagem nova, o menu oferece "Marcar como lido"', !!it && it.some(x => x.includes('Marcar como lido')) && !it.some(x => x.includes('não lido')), it);
  await clicaItem('Marcar como lido'); await p.waitForTimeout(400);
  t('✓ Marcar como lido volta ao fim e apaga o ponto', (await S()).lidas_a.ana.dados._geral === T2 && !(await ponto('dados')), (await S()).lidas_a.ana.dados);

  await p.click('[data-canal="dados"]', { button: 'right' }); await clicaItem('Projetos'); await p.waitForTimeout(400);
  t('📁 Projetos move o canal de seção', (((await S()).secoes.ana || {}).c || {}).dados === 'sproj', (await S()).secoes);
  await p.click('[data-canal="dados"]', { button: 'right' }); await p.waitForTimeout(100);
  t('a seção atual aparece marcada (menuitemradio)', await p.evaluate(() => [...document.querySelectorAll('#ctx [role="menuitemradio"]')].filter(x => x.getAttribute('aria-checked') === 'true').map(x => x.textContent).join() === '📁Projetos'), await p.evaluate(() => [...document.querySelectorAll('#ctx [role="menuitemradio"]')].map(x => x.textContent + x.getAttribute('aria-checked'))));
  await clicaItem('Copiar link do canal'); await p.waitForTimeout(300);
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  t('🔗 Copiar link copia ?c=dados', /cardume-dev\.html\?c=dados$/.test(clip), clip);

  // canal aberto + não lido: segura o marcar-lido
  await p.click('[data-canal="dados"]'); await p.waitForTimeout(600);
  await p.click('[data-canal="dados"]', { button: 'right' }); await clicaItem('Marcar como não lido'); await p.waitForTimeout(1300);
  t('com o canal aberto, fica não lido (não remarca) e mostra a linha', (await S()).lidas_a.ana.dados._geral === T2 - 1 && await p.evaluate(() => !!document.querySelector('#log .dia.nao-lida')), (await S()).lidas_a.ana.dados);

  // teclado: tecla Menu num canal focado
  await p.focus('[data-canal="prf"]'); await p.evaluate(() => document.querySelector('[data-canal="prf"]').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
  await p.waitForTimeout(300);
  t('pelo teclado (contextmenu sem coordenadas) abre embaixo do canal', await p.evaluate(() => { const m = document.getElementById('ctx'), r = document.querySelector('[data-canal="prf"]').getBoundingClientRect(), q = m.getBoundingClientRect(); return !m.hidden && Math.abs(q.left - (r.left + 12)) < 15 && q.top >= 0 && q.bottom <= innerHeight && /Performance/.test(m.textContent); }), await p.evaluate(() => { const m = document.getElementById('ctx'), r = document.querySelector('[data-canal="prf"]').getBoundingClientRect(), q = m.getBoundingClientRect(); return { h: m.hidden, q: [q.left, q.top, q.height], r: [r.left, r.bottom], t: m.textContent.slice(0, 40) }; }));
  await p.mouse.click(700, 500); await p.waitForTimeout(100);
  t('clicar fora fecha', await p.evaluate(() => document.getElementById('ctx').hidden), 0);

  // ── mensagem ──
  await p.click('[data-msg="-Nd2"] .texto', { button: 'right' }); await p.waitForTimeout(150);
  it = await itens();
  t('clique direito na mensagem: as ações da pílula + Copiar texto', !!it && ['Reagir', 'Responder', 'lida', 'Salvar', 'Copiar texto'].every(x => it.some(y => y.includes(x))), it);
  await clicaItem('Responder'); await p.waitForTimeout(200);
  t('"Responder" pelo menu abre a resposta (mesmo botão da pílula)', await p.evaluate(() => !document.getElementById('resp-barra').hidden), 0);
  await p.click('[data-msg="-Nd2"] .texto', { button: 'right' }); await clicaItem('Copiar texto'); await p.waitForTimeout(250);
  t('📋 Copiar texto', (await p.evaluate(() => navigator.clipboard.readText())) === 'texto para copiar', 0);
  await p.click('[data-msg="-Nd1"] a', { button: 'right' }).catch(() => {}); await p.waitForTimeout(120);
  t('no link, fica o menu do navegador (o nosso não abre)', await p.evaluate(() => document.getElementById('ctx').hidden), 0);
  await p.keyboard.press('Escape');

  // ── toque longo ──
  const ctxT = await b.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true }); await fake.install(ctxT, seed());
  await ctxT.addInitScript(() => { localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); });
  const q = await ctxT.newPage(); q.on('pageerror', e => errs.push('celular: ' + e.message));
  await q.goto(base + '/cardume-dev.html'); await q.waitForFunction(() => !!window.__authCb); await q.evaluate(x => window.__authCb(x), ANA); await q.waitForTimeout(900);
  await q.evaluate(() => { const b = document.querySelector('[data-canal="dados"]'), r = b.getBoundingClientRect(); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: r.left + 20, clientY: r.top + 10 })); });
  await q.waitForTimeout(650);
  await q.evaluate(() => { const b = document.querySelector('[data-canal="dados"]'); b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' })); b.click(); });
  await q.waitForTimeout(150);
  t('celular: toque longo abre o menu e NÃO abre o canal', await q.evaluate(() => !document.getElementById('ctx').hidden && document.getElementById('app').dataset.tela === 'canais'), await q.evaluate(() => document.getElementById('app').dataset.tela));
  t('celular: itens com 44 px e menu dentro da tela', await q.evaluate(() => { const r = document.getElementById('ctx').getBoundingClientRect(); return [...document.querySelectorAll('#ctx button')].every(x => x.getBoundingClientRect().height >= 44) && r.left >= 0 && r.right <= 390; }), 0);
  await ctxT.close();

  const esc = await p.evaluate(() => window.__escritas || []);
  const real = Date.now; const ruins = [];
  for (const e of esc) { const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([k, v]) => [(e.p ? e.p + '/' : '') + k, v])); Date.now = () => e.t; let r; try { r = regras(RULES, e.antes, authDe(ANA), mapa); } finally { Date.now = real; } if (!r) ruins.push({ tipo: e.tipo, caminhos: Object.keys(mapa) }); }
  t('CADA escrita da página passa nas regras reais', esc.length > 0 && !ruins.length, { n: esc.length, ruins });
  t('sem erro de JS', !errs.length, errs);
  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
