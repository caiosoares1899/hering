// 🔔 Sino unificado (mare-notif-dev.js → MareNotif.sino) — fase 1, no Cardume (docs/ideias/sino-unificado.md).
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_sino_cardume.js
// BASE_URL, CHROME e PLAYWRIGHT_MODULE substituem os caminhos (padrão: ~/hering-tools do Mac). SHOT=1 grava capturas em docs/capturas/sino-unificado/.
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const { update: regras } = require('../../../functions/rules/rulesSim.js');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../database.rules.json'), 'utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const agora = Date.now(), iso = min => new Date(agora - min * 60000).toISOString();
const pub = (uid, nome, init) => ({ uid, nome, init, email: uid + '@ciahering.com.br', squads: { dados: true } });
const seed = () => ({ kanban: {
  usuarios: {
    ana: { role: 'membro', squads: { dados: true }, notificacoes: {
      n1: { id: 'n1', type: 'cardume_mencao', title: '🐟 Bruno te mencionou no Cardume', sub: 'Toque para abrir a conversa', cardumeRef: 'r1', dev: true, read: false, ts: iso(2) },
      n2: { id: 'n2', type: 'mention', title: '<img src=x onerror="window.__xss=1">Bruno citou você', sub: 'Card: Painel de vendas', cardId: 'c1', squad: 'dados', read: false, ts: iso(5) },
      n3: { id: 'n3', type: 'okr_prazo', title: 'Marco vence amanhã', read: true, ts: iso(60 * 20) },
      n4: { id: 'n4', type: 'escala', title: 'Escala da semana cadastrada', read: false, ts: iso(30) },
      n5: { id: 'n5', type: 'rascunho', title: 'Rascunho (só no Painel)', read: false, ts: iso(3) },
      n6: { id: 'n6', type: 'mention', title: 'Dispensada', read: true, dismissed: true, ts: iso(4) },
      n7: { id: 'n7', type: 'cardume_mencao', title: '🐟 Bruno te mencionou no Cardume', sub: 'Toque para abrir a conversa', cardumeRef: 'r2', dev: true, read: false, ts: iso(1) },
    } },
    bru: { role: 'membro', squads: { dados: true } },
  },
  usuarios_publicos: { ana: pub('ana', 'Ana Lima', 'AL'), bru: pub('bru', 'Bruno Reis', 'BR') },
  notif_feed: { f1: { id: 'f1', tipo: 'mural', titulo: 'Aviso geral do Radar', sub: 'Leia no Mural', torres: ['*'], ts: iso(10), autor: 'Caio', autorUid: 'cai', muralId: 'mu1' } },
  notif_feed_seen: { ana: { ts: iso(60 * 24) } },
  cardume: {
    canais: { dados: { nome: 'Dados' } }, membros: { dados: { ana: true, bru: true } }, meus: { ana: { dados: true } },
    msgs: { dados: { '-Nm1': { uid: 'bru', ts: agora - 2 * 60000, texto: 'oi @Ana Lima, olha isso' }, '-Nm2': { uid: 'bru', ts: agora - 60000, texto: 'e isso também @Ana Lima' } } },
    ultima: { dados: { ts: agora - 60000, uid: 'bru', id: '-Nm2' } },
    mencoes: { ana: { r1: { c: 'dados', m: '-Nm1', de: 'bru', ts: agora - 2 * 60000, n: 'n1' }, r2: { c: 'dados', m: '-Nm2', de: 'bru', ts: agora - 60000, n: 'n7' } } },
  },
} });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + JSON.stringify(d).slice(0, 600))); };
const authDe = u => ({ uid: u.uid, token: { email: u.email, firebase: { sign_in_provider: 'google.com' } } });
function conferirEscritas(escritas, quem) {
  const real = Date.now; const ruins = [];
  for (const e of escritas) {
    const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([k, v]) => [(e.p ? e.p + '/' : '') + k, v]));
    Date.now = () => e.t;
    let r; try { r = regras(RULES, e.antes, authDe(quem), mapa); } finally { Date.now = real; }
    if (!r) ruins.push({ tipo: e.tipo, caminhos: Object.keys(mapa) });
  }
  return ruins;
}
const ler = (s, c) => c.split('/').reduce((a, k) => (a == null ? undefined : a[k]), s);

(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(chromeRoot) ? path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const abertas = []; await ctx.exposeFunction('__abriu', u => abertas.push(u)); await ctx.addInitScript(() => { window.open = u => { window.__abriu(String(u)); return {}; }; });
  await p.goto(base + '/cardume-dev.html'); await p.waitForFunction(() => !!window.__authCb);
  await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(900);
  const store = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__store)));
  const shots = process.env.SHOT ? path.join(__dirname, '../../capturas/sino-unificado') : null; if (shots) fs.mkdirSync(shots, { recursive: true });

  t('o Sino aparece no topo do Cardume', await p.isVisible('#b-sino'), 0);
  const selo = (await p.textContent('#b-sino .mn-sino-n')).trim();
  t('selo conta as não lidas: 3 menções/cards/escala + 1 do feed (rascunho e dispensada ficam fora)', selo === '5', selo);
  await p.click('#b-sino'); await p.waitForTimeout(200);
  t('abre o painel e o foco vai para o título', await p.isVisible('.mn-sino-pop') && (await p.getAttribute('#b-sino', 'aria-expanded')) === 'true' && await p.evaluate(() => document.activeElement && document.activeElement.textContent === '🔔 Notificações'), 0);
  const itens = await p.evaluate(() => [...document.querySelectorAll('.mn-sino-it')].map(e => ({ id: e.dataset.mnId, fam: e.dataset.familia, txt: e.textContent })));
  t('lista: pessoais + feed, sem SO_PAINEL nem dispensada', itens.length === 6 && !itens.some(i => /Rascunho|Dispensada/.test(i.txt)) && itens.some(i => i.id === 'feed:f1'), itens.map(i => i.id));
  t('layout por família: cada item traz o selo da família e o rótulo do tipo', itens.every(i => i.fam) && new Set(itens.map(i => i.fam)).size >= 2 && itens.every(i => /Pessoal|Calendário|Radar|Sistema/.test(i.txt)), itens.map(i => i.fam + ' ' + i.txt.slice(0, 40)));
  t('ordem: mais nova primeiro', itens[0].id === 'pessoal:n7', itens.map(i => i.id));
  t('o ícone não se repete no começo do título', !itens.some(i => /🐟\s*🐟/.test(i.txt)) && itens.some(i => /Bruno te mencionou no Cardume/.test(i.txt)), itens.map(i => i.txt.slice(0, 50)));
  t('texto de terceiros entra como texto (nada de <img> nem script)', !(await p.$('.mn-sino-pop img')) && await p.evaluate(() => !window.__xss) && itens.some(i => i.txt.includes('<img src=x')), 0);
  if (shots) await p.screenshot({ path: path.join(shots, 'cardume-sino-1280.png') });

  // clique na menção do Cardume: abre aqui mesmo, destaca a mensagem e marca Sino + aba @ Menções
  await p.click('[data-mn-id="pessoal:n1"]'); await p.waitForTimeout(500);
  let s = await store();
  t('menção pelo Sino: abre o canal certo nesta página (sem aba nova)', (await p.evaluate(() => window.__cardume.estado.atual)) === 'dados' && !abertas.length && await p.isHidden('.mn-sino-pop'), abertas);
  t('menção pelo Sino: marca a notificação E o registro da menção como lidos', ler(s, 'kanban/usuarios/ana/notificacoes/n1/read') === true && ler(s, 'kanban/cardume/mencoes/ana/r1/lida') === true, [ler(s, 'kanban/usuarios/ana/notificacoes/n1'), ler(s, 'kanban/cardume/mencoes/ana/r1')]);
  // menção aberta pela aba @ Menções também sai do Sino
  await p.click('#b-mencoes'); await p.waitForTimeout(200);
  await p.click('.mencao-item.nova'); await p.waitForTimeout(400);
  s = await store();
  t('menção pela aba: o Sino também marca como lida (uma contagem só)', ler(s, 'kanban/usuarios/ana/notificacoes/n7/read') === true && ler(s, 'kanban/cardume/mencoes/ana/r2/lida') === true, ler(s, 'kanban/usuarios/ana/notificacoes/n7'));
  t('selo cai para 3', (await p.textContent('#b-sino .mn-sino-n')).trim() === '3', await p.textContent('#b-sino .mn-sino-n'));

  // item de outro app: abre pela URL do módulo em aba nova
  await p.click('#b-sino'); await p.waitForTimeout(200);
  await p.click('[data-mn-id="pessoal:n2"]'); await p.waitForTimeout(300);
  t('card do Maré: abre o kanban-dev no card certo, em aba nova', abertas.some(u => /kanban-dev\.html\?squad=dados&card=c1$/.test(u)), abertas);
  await p.click('#b-sino'); await p.waitForTimeout(200);
  await p.click('[data-mn-id="feed:f1"]'); await p.waitForTimeout(300);
  t('aviso do feed (Mural): abre o Radar no Mural', abertas.some(u => /okr-dev\.html.*mural/.test(u)), abertas);
  s = await store();
  t('aviso do feed: marcado como lido no feed_seen da pessoa', ler(s, 'kanban/notif_feed_seen/ana/lidos/f1') === true, ler(s, 'kanban/notif_feed_seen/ana'));

  // ✕ e marcar tudo
  await p.click('#b-sino'); await p.waitForTimeout(200);
  await p.click('[data-mn-id="x:pessoal:n4"]'); await p.waitForTimeout(300);
  s = await store();
  t('✕ remove a notificação pessoal', ler(s, 'kanban/usuarios/ana/notificacoes/n4') == null && !(await p.$('[data-mn-id="pessoal:n4"]')), ler(s, 'kanban/usuarios/ana/notificacoes/n4'));
  t('o foco não se perde depois do ✕', await p.evaluate(() => !!document.activeElement && document.activeElement !== document.body), 0);
  t('sem não lidas, "Marcar tudo" some', !(await p.$('.mn-sino-tudo')), 0);
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  t('Esc fecha e devolve o foco ao Sino', await p.isHidden('.mn-sino-pop') && await p.evaluate(() => document.activeElement && document.activeElement.id === 'b-sino'), 0);

  const ruins = conferirEscritas(await p.evaluate(() => window.__escritas || []), ANA);
  t('CADA escrita passa nas regras reais do banco', !ruins.length, ruins);
  t('sem erro de JS', !errs.length, errs);

  // celular e temas
  await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(200);
  await p.click('#b-sino'); await p.waitForTimeout(200);
  const caixa = await p.evaluate(() => { const r = document.querySelector('.mn-sino-pop').getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth, sobra: document.documentElement.scrollWidth - innerWidth }; });
  t('celular: o painel cabe na tela, sem rolagem lateral', caixa.l >= 0 && caixa.r <= caixa.w && caixa.sobra <= 0, caixa);
  if (shots) await p.screenshot({ path: path.join(shots, 'cardume-sino-390.png') });
  for (const tema of ['light', 'sunset']) {
    await p.evaluate(x => document.documentElement.setAttribute('data-theme', x), tema); await p.waitForTimeout(100);
    const cor = await p.evaluate(() => { const e = document.querySelector('.mn-sino-pop'); const c = getComputedStyle(e); return { bg: c.backgroundColor, fg: c.color }; });
    t('tema ' + tema + ': painel com fundo e texto do tema', cor.bg !== cor.fg && cor.bg !== 'rgba(0, 0, 0, 0)', cor);
    if (shots) await p.screenshot({ path: path.join(shots, 'cardume-sino-390-' + tema + '.png') });
  }
  // "Marcar tudo como lido" numa página nova (todas as não lidas: pessoais + feed)
  const ctx2 = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx2, seed());
  const q = await ctx2.newPage(); const errs2 = []; q.on('pageerror', e => errs2.push(e.message));
  await q.goto(base + '/cardume-dev.html'); await q.waitForFunction(() => !!window.__authCb);
  await q.evaluate(x => window.__authCb(x), ANA); await q.waitForTimeout(900);
  await q.click('#b-sino'); await q.waitForTimeout(200); await q.click('.mn-sino-tudo'); await q.waitForTimeout(300);
  const s2 = await q.evaluate(() => JSON.parse(JSON.stringify(window.__store)));
  const ns = ler(s2, 'kanban/usuarios/ana/notificacoes');
  t('Marcar tudo: todas as pessoais lidas, o feed lido e o selo some', ['n1', 'n2', 'n4', 'n7'].every(k => ns[k].read === true) && ler(s2, 'kanban/notif_feed_seen/ana/lidos/f1') === true && await q.isHidden('#b-sino .mn-sino-n'), ns);
  t('Marcar tudo: escritas passam nas regras', !conferirEscritas(await q.evaluate(() => window.__escritas || []), ANA).length, 0);
  t('sem erro de JS (Marcar tudo)', !errs2.length, errs2);
  await b.close();
  console.log(ok ? `TUDO OK (${total} verificações)` : 'FALHOU');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
