// 🏝️ Concha — Ilha Dinâmica compartilhada (mare-ilha-dev.js, 26/11/2026). Pedido do Caio: "quem tiver a ilha deveria ter em todos os apps",
// começando pela Concha; uma chave só na conta (kanban/usuarios/{uid}/oceano/ilha). Timer pelo mare-timer (mesmo contrato do Maré);
// o 🔔 mora dentro da ilha; notificação nova alarga a pílula. Rodar na raiz: python3 -m http.server 8952 --bind 127.0.0.1 → node docs/arezzo/testes/test_concha_ilha.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const { update: regras } = require('../../../functions/rules/rulesSim.js');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../database.rules.json'), 'utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:8952';
const U = (uid, nome) => ({ uid, email: uid + '@ciahering.com.br', displayName: nome, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const PAU = U('pau', 'Paula PO'), ANA = U('ana', 'Ana Lima');
const ag = Date.now();
const seed = () => ({ kanban: {
  usuarios: { pau: { role: 'membro', squads: { dados: true }, oceano: { ilha: true }, notificacoes: { velha: { type: 'mention', title: '@CO — você foi mencionado', sub: 'de horas atrás', ts: new Date(ag - 5 * 3600e3).toISOString(), read: false } } }, ana: { role: 'membro', squads: { dados: true } } },
  usuarios_publicos: { pau: { nome: 'Paula PO' }, ana: { nome: 'Ana Lima' } },
  timers_ativos: { pau: {
    tm0001: { sq: 'dados', cardId: 'c1', cardTitle: 'Banner BF', atividade: 'Revisar banner', tipo: 'cron', status: 'rodando', startedAt: ag - 65000, accMs: 0, porUid: 'ana' },
    tm0002: { sq: 'dados', cardId: 'c2', cardTitle: 'Relatório', atividade: 'Montar relatório', tipo: 'cron', status: 'pausado', startedAt: null, accMs: 120000, porUid: '' } } },
  squads: { dados: { dados: { card_timers: { c1: { tm0001: { uid: 'pau', status: 'rodando', startedAt: ag - 65000, accMs: 0, atividade: 'Revisar banner' } }, c2: { tm0002: { uid: 'pau', status: 'pausado', accMs: 120000, atividade: 'Montar relatório' } } } } } },
  cardume: { canais: { dados: { nome: 'Dados' } }, membros: { dados: { pau: true, ana: true } }, meus: { pau: { dados: true }, ana: { dados: true } }, msgs: { dados: { m1: { uid: 'ana', ts: ag - 60000, texto: 'oi' } } } },
} });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 400))); };
const authDe = u => ({ uid: u.uid, token: { email: u.email, firebase: { sign_in_provider: 'google.com' } } });
const DBURL = 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const cr = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(cr) ? path.join(cr, fs.readdirSync(cr).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const abre = async (quem, w) => {
    const ctx = await b.newContext({ viewport: { width: w || 1280, height: 860 } }); await fake.install(ctx, seed());
    await ctx.addInitScript(() => { localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(x => window.__authCb(x), quem); await p.waitForTimeout(1300);
    return { ctx, p, errs };
  };
  const pil = p => p.evaluate(() => { const x = document.querySelector('#ilha-slot .mi-pil'); return x ? { txt: x.querySelector('.mi-main').textContent, aviso: x.classList.contains('mi-aviso'), visivel: !!x.getClientRects().length } : null; });

  { const { ctx, p, errs } = await abre(PAU);
    let x = await pil(p);
    t('Ilha ligada na conta: a pílula aparece no alto com o timer rodando (⏲ Revisar banner, ~01:0x, +1)', x && x.visivel && /⏱️Revisar banner01:0\d\+1/.test(x.txt), x);
    t('notificação ANTIGA não lida não alarga a pílula ao abrir a página (relato do Caio)', x && !x.aviso, x);
    t('o 🔔 do topo some: o sino mora dentro da ilha', await p.evaluate(() => document.getElementById('b-sino').hidden && !!document.querySelector('#ilha-slot .mi-sino.mn-sino-btn')), 0);
    await p.waitForTimeout(1100);
    const x2 = await pil(p);
    t('o relógio anda (o tempo muda a cada segundo)', x2 && x2.txt !== x.txt, [x.txt, x2 && x2.txt]);
    await p.click('#ilha-slot .mi-main'); await p.waitForTimeout(200);
    const pn = await p.evaluate(() => [...document.querySelectorAll('.mi-painel .mi-tm')].map(e => e.textContent));
    t('abrir: os 2 timers, o rodando primeiro, com Pausar / Continuar e "Abrir o card / encerrar no Maré"', pn.length === 2 && /Revisar banner/.test(pn[0]) && /Pausar/.test(pn[0]) && /Continuar/.test(pn[1]) && /encerrar no Maré/.test(pn[0]), pn);
    t('o link do card vai para o Maré dev com squad e card', await p.evaluate(() => document.querySelector('.mi-painel .mi-tm a').getAttribute('href') === 'kanban-dev.html?squad=dados&card=c1'), 0);
    await p.click('.mi-painel .mi-tm button:has-text("Pausar")'); await p.waitForTimeout(300);
    const st = await p.evaluate(() => JSON.parse(JSON.stringify({ ix: window.__store.kanban.timers_ativos.pau.tm0001, rec: window.__store.kanban.squads.dados.dados.card_timers.c1.tm0001 })));
    t('⏸ Pausar grava pelo mare-timer: registro do card e índice pessoal, com o tempo acumulado', st.ix.status === 'pausado' && st.rec.status === 'pausado' && st.ix.accMs >= 65000 && st.ix.startedAt == null, st);
    const esc = await p.evaluate(() => (window.__escritas || []).filter(e => /timers|card_timers/.test(JSON.stringify(Object.keys(e.v || {})) + e.p)));
    const ruins = esc.filter(e => { const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([kk, v]) => [(e.p ? e.p + '/' : '') + kk, v])); const real = Date.now; Date.now = () => e.t; try { return !regras(RULES, e.antes, authDe(PAU), mapa); } finally { Date.now = real; } }).length;
    t('a escrita do timer passa nas regras reais', esc.length >= 1 && !ruins, { n: esc.length, ruins });
    await p.click('#ilha-slot .mi-sino'); await p.waitForTimeout(300);
    t('tocar no 🔔 com a ilha aberta: fecha a ilha e abre só o sino (um painel por vez)', await p.evaluate(() => document.querySelector('.mi-painel').hidden && !document.querySelector('.mn-sino-pop').hidden), 0);
    await p.click('#ilha-slot .mi-main'); await p.waitForTimeout(300);
    t('abrir a ilha com o sino aberto fecha o sino', await p.evaluate(() => !document.querySelector('.mi-painel').hidden && document.querySelector('.mn-sino-pop').hidden), 0);
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    await p.click('#ilha-slot .mi-main'); await p.waitForTimeout(200); await p.click('.mi-painel .mi-tm button'); await p.waitForTimeout(200);
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    t('Esc fecha só a ilha (a conversa segue aberta) e o foco volta à pílula', await p.evaluate(() => document.querySelector('.mi-painel').hidden && document.activeElement.classList.contains('mi-main') && window.__cardume.estado.atual === 'dados'), 0);
    // notificação nova
    await p.evaluate(async u => { const m = await import(u); await m.set(m.ref(null, 'kanban/usuarios/pau/notificacoes/n1'), { type: 'cardume_mencao', title: 'Ana Lima te mencionou na Concha', sub: 'abra para ver', ts: new Date().toISOString(), read: false, cardumeRef: 'x1' }); }, DBURL);
    await p.waitForTimeout(500);
    x = await pil(p);
    t('notificação nova (🐚 menção) alarga a pílula com quem/o quê', x && x.aviso && /Ana Lima te mencionou/.test(x.txt), x);
    t('…e o 🔔 da ilha mostra 2 não lidas (a antiga e a nova)', await p.evaluate(() => { const n = document.querySelector('#ilha-slot .mi-sino .mn-sino-n'); return n && !n.hidden && n.textContent === '2'; }), 0);
    // ⚙️ desligar
    await p.click('#b-config'); await p.waitForTimeout(200);
    t('⚙️ Configurações tem 🏝️ Ilha Dinâmica (Ligada marcada)', await p.evaluate(() => !!document.querySelector('.md.cfg input[name="ilha"][value="sim"]:checked')), 0);
    await p.click('.md.cfg input[name="ilha"][value=""]'); await p.waitForTimeout(300);
    t('Desligar grava na conta (oceano/ilha some) e oferece "Recarregar agora"', await p.evaluate(() => !('ilha' in (window.__store.kanban.usuarios.pau.oceano || {})) && /Recarregar agora/.test(document.querySelector('.md.cfg').textContent)), await p.evaluate(() => window.__store.kanban.usuarios.pau.oceano));
    t('sem erro na página', !errs.length, errs);
    await ctx.close(); }

  { const { ctx, p, errs } = await abre(ANA);
    t('sem a Ilha ligada: nada muda (sem pílula, 🔔 no topo)', await p.evaluate(() => document.getElementById('ilha-slot').hidden && !document.getElementById('b-sino').hidden), 0);
    t('…e ninguém escuta timers_ativos', await p.evaluate(() => !(window.__lis || []).some(l => /timers_ativos/.test(l.p))), 0);
    t('sem erro na página', !errs.length, errs);
    await ctx.close(); }

  { const { ctx, p, errs } = await abre(PAU, 390);
    const r = await p.evaluate(() => { const x = document.querySelector('#ilha-slot .mi-pil'); const q = x.getBoundingClientRect(); return { w: q.width, dentro: q.right <= innerWidth && q.left >= 0 }; });
    t('celular: a pílula cabe na tela (linha própria no topo)', r.dentro && r.w > 100, r);
    await p.screenshot({ path: path.join(__dirname, '../../capturas/concha-ilha-390.png') });
    t('sem erro na página', !errs.length, errs);
    await ctx.close(); }

  await b.close();
  console.log((ok ? '\n✅ ' : '\n❌ ') + total + ' verificações');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
