// 🏖️ Férias F4 (13/11/2026): 🧳 Preparar minha saída no Maré (cards) e no Radar (Objetivos/Marcos) + 🏖️ Minhas férias no menu.
// Prova: nada pré-marcado; Revisar travado até tudo decidido; "Manter todos os restantes" só preenche; NADA gravado antes do ✅;
// fechar não grava; 1 aviso por pessoa; Radar grava com update parcial e respeita a 🔒 do Objetivo; falha desfaz e não avisa;
// títulos com <img onerror> viram texto; aviso do Senior aparece. node docs/arezzo/testes/test_ferias_saida.js
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const home = require('node:os').homedir();
const pwPath = process.env.PLAYWRIGHT_MODULE || (fs.existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const { chromium } = require(pwPath);
const fake = require('./fakefb');
function resolveChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  if (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) return '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const r = path.join(home, 'hering-tools/chrome'); const arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-'));
  return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
}
const ROOT = path.resolve(__dirname, '../../..');
const FIXO = '2026-11-13T15:00:00-03:00';
const FIXO_MS = new Date(FIXO).getTime();
const XSS = '<img src=x onerror=window.__xss=1>Card perigoso';

const U = {
  ana: { uid: 'ana', nome: 'Ana Teste', email: 'ana@ciahering.com.br', init: 'AT', role: 'membro', squads: { dados: true, prf: true } },
  po1: { uid: 'po1', nome: 'Paulo PO', email: 'po@ciahering.com.br', init: 'PP', role: 'po', squads: { dados: true } },
  bia: { uid: 'bia', nome: 'Bia Outra', email: 'bia@ciahering.com.br', init: 'BO', role: 'membro', squads: { dados: true } },
  al1: { uid: 'al1', nome: 'Sem Ferias', email: 'sf@ciahering.com.br', init: 'SF', role: 'membro', squads: { dados: true } },
};
const fl = col => ({ enteredAt: { [col]: '2026-11-01T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-11-01T12:00:00.000Z' }] });
const card = (id, title, col, owner, extra) => Object.assign({ id, title, col, owner, createdAt: '2026-11-01', flow: fl(col), updatedAt: '2026-11-01T12:00:00.000Z', history: [] }, extra || {});
const seed = () => ({ kanban: {
  config: { adm_emails: [] },
  squads_meta: { dados: { label: 'Squad Dados e IA', emoji: '📊', active: true }, prf: { label: 'Performance', emoji: '📱', active: true } },
  usuarios: Object.fromEntries(Object.entries(U).map(([k, u]) => [k, Object.assign({ inscrito: true }, u)])),
  usuarios_publicos: Object.fromEntries(Object.entries(U).map(([k, u]) => [k, { uid: u.uid, nome: u.nome, init: u.init, role: u.role, squads: u.squads }])),
  squads: { dados: { dados: {
    columns: [{ id: 'todo', name: 'A Fazer' }, { id: 'done', name: 'Concluído' }], tags: [],
    cards_index: { c1: 'k1', c2: 'k2', c3: 'k3', c4: 'k4', c5: 'k5', c6: 'k6' },
    cards: {
      k1: card('c1', 'Campanha de Natal', 'todo', 'AT'),
      k2: card('c2', 'Relatório semanal', 'todo', 'BO', { participants: ['AT'] }),
      k3: card('c3', 'Já concluído', 'done', 'AT'),
      k4: card('c4', 'Arquivado', 'todo', 'AT', { archived: true }),
      k5: card('c5', 'De outra pessoa', 'todo', 'BO'),
      k6: card('c6', XSS, 'todo', 'AT'),
    },
  } } },
  okr: {
    objetivos: {
      o1: { id: 'o1', titulo: 'Crescer o app', torre: 'digital', responsaveis: ['ana', 'bia'], history: [] },
      o2: { id: 'o2', titulo: 'Objetivo travado', torre: 'digital', responsaveis: ['ana'], history: [] },
      o3: { id: 'o3', titulo: 'Não é meu', torre: 'digital', responsaveis: ['bia'], history: [] },
    },
    marcos: {
      m1: { id: 'm1', nome: 'Lançar versão 2', objetivoId: 'o1', responsavel: 'ana', progresso: 'em_andamento', history: [] },
      m2: { id: 'm2', nome: 'Marco concluído', objetivoId: 'o1', responsavel: 'ana', progresso: 'concluido', history: [] },
    },
    obj_locks: { o2: { uid: 'bia', who: 'Bia Outra', ts: FIXO_MS } },
    tags: {},
  },
  ferias_dev: {
    ana: { f1: { ini: '2026-11-20', fim: '2026-11-30', em: 1, por: 'ana' } },
    po1: { f1: { ini: '2026-11-25', fim: '2026-12-02', em: 1, por: 'po1' } },
  },
} });

function startServer() {
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.mp3': 'audio/mpeg' };
  const srv = http.createServer((req, res) => {
    const fp = path.join(ROOT, decodeURIComponent((req.url || '/').split('?')[0]));
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(fp)] || 'application/octet-stream' }); fs.createReadStream(fp).pipe(res);
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok({ srv, base: 'http://127.0.0.1:' + srv.address().port })));
}

(async () => {
  const { srv, base } = await startServer();
  const b = await chromium.launch({ executablePath: resolveChrome(), headless: true });
  let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d ?? null).slice(0, 400))); };
  const abre = async (pagePath, user, vp) => {
    const ctx = await b.newContext({ viewport: vp || { width: 1280, height: 900 }, hasTouch: !!vp, isMobile: !!vp });
    await fake.install(ctx, seed());
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(f => { const R = Date; const fx = new R(f).getTime(); class D extends R { constructor(...a) { if (!a.length) super(fx); else super(...a); } static now() { return fx; } } window.Date = D; try { localStorage.clear(); } catch (e) {} }, FIXO);
    await p.goto(base + pagePath);
    await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(x => window.__authCb(x), { uid: user.uid, email: user.email, displayName: user.nome, photoURL: '', providerData: [{ providerId: 'google.com' }] });
    await p.waitForTimeout(2800);
    await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(x => x.classList.remove('open')); });
    return { ctx, p, errs };
  };
  const escritas = (p, prefixo) => p.evaluate(px => window.__log.filter(([op, pa]) => (op === 'set' || op === 'update' || op === 'remove') && String(pa).startsWith(px)).length, prefixo);

  // ═══ 1. Maré (kanban-dev.html?squad=dados), Ana ═══
  {
    const { ctx, p, errs } = await abre('/kanban-dev.html?squad=dados', U.ana);
    t('M0. coluna "Concluído" conta como fim (pré-condição)', await p.evaluate(() => _isColDone('done') && !_isColDone('todo')));
    await p.evaluate(() => openStatusMenu());
    t('M1. menu do nome tem 🏖️ Minhas férias', await p.locator('#status-menu-ferias').count() === 1);
    await p.click('#status-menu-ferias'); await p.waitForTimeout(300);
    t('M2. abre 📅 Calendários na visão 🏖️ Férias', await p.evaluate(() => document.getElementById('cal-ov')?.classList.contains('cal-ferias') && !!document.querySelector('#cal-ferias .mfer')));
    t('M3. aviso do Senior no cadastro', /não substitui o das férias no Senior/i.test(await p.textContent('#cal-ferias .mfer-senior')));
    const btn = p.locator('#cal-ferias [data-act="saida"]');
    t('M4. 🧳 Preparar minha saída habilitado (Ana tem período)', await btn.count() === 1 && await btn.isEnabled());
    const w0 = await escritas(p, 'kanban/squads/dados/dados');
    await btn.click(); await p.waitForTimeout(200);
    const keys = await p.evaluate(() => [...document.querySelectorAll('#mfer-pass-ov [data-key]')].map(e => e.dataset.key).sort());
    t('M5. lista só os cards ativos meus (responsável/participante): c1, c2, c6', JSON.stringify(keys) === '["c1","c2","c6"]', keys);
    t('M6. nada pré-marcado e Revisar travado', await p.evaluate(() => !document.querySelector('#mfer-pass-ov [aria-pressed="true"]') && document.querySelector('#mfer-pass-ov [data-pa="revisar"]').disabled));
    t('M7. título com <img onerror> aparece como texto', await p.evaluate(x => !window.__xss && document.querySelector('#mfer-pass-ov [data-key="c6"]').textContent.includes(x), XSS));
    t('M8. aviso do Senior também na passagem', /não substitui o cadastro das férias no Senior/i.test(await p.textContent('#mfer-pass-ov')));
    t('M9. link para repetir na outra squad (prf)', await p.evaluate(() => [...document.querySelectorAll('#mfer-pass-ov .mfer-pass-links a')].some(a => /[?&]squad=prf&ferias=saida$/.test(a.getAttribute('href')))));
    // fechar sem confirmar não grava
    await p.click('#mfer-pass-ov [data-key="c1"] [data-pa="manter"]');
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    t('M10. Esc fecha sem gravar nada', await p.locator('#mfer-pass-ov').count() === 0 && await escritas(p, 'kanban/squads/dados/dados') === w0);
    // fluxo completo
    await btn.click(); await p.waitForTimeout(150);
    await p.click('#mfer-pass-ov [data-key="c1"] [data-pa="passar"]');
    const opPP = await p.evaluate(() => [...document.querySelectorAll('#mfer-pass-ov [data-key="c1"] select option')].map(o => o.textContent).find(x => /Paulo/.test(x)) || '');
    t('M11. quem também está fora no meu período aparece com 🏖️', /🏖️/.test(opPP), opPP);
    t('M12. "Passar" sem pessoa mantém Revisar travado', await p.evaluate(() => document.querySelector('#mfer-pass-ov [data-pa="revisar"]').disabled));
    await p.selectOption('#mfer-pass-ov [data-key="c1"] select', 'PP');
    await p.click('#mfer-pass-ov [data-key="c2"] [data-pa="passar"]');
    await p.click('#mfer-pass-ov [data-pa="manter-resto"]');
    t('M13. "Manter todos os restantes" preenche só o que não tinha escolha (c6) e não grava', await p.evaluate(() => {
      const st = document.querySelector('#mfer-pass-ov [data-key="c6"] [data-pa="manter"]').getAttribute('aria-pressed') === 'true';
      const c2 = document.querySelector('#mfer-pass-ov [data-key="c2"] [data-pa="passar"]').getAttribute('aria-pressed') === 'true';
      return st && c2 && document.querySelector('#mfer-pass-ov [data-pa="revisar"]').disabled;
    }) && await escritas(p, 'kanban/squads/dados/dados') === w0);
    await p.selectOption('#mfer-pass-ov [data-key="c2"] select', 'PP');
    t('M14. tudo decidido libera Revisar', await p.evaluate(() => !document.querySelector('#mfer-pass-ov [data-pa="revisar"]').disabled));
    await p.click('#mfer-pass-ov [data-pa="revisar"]');
    t('M15. revisão lista o que passa e o que fica, sem gravar', /Passar \(2\)/.test(await p.textContent('#mfer-pass-ov')) && /Ficam com você \(1\)/.test(await p.textContent('#mfer-pass-ov')) && await escritas(p, 'kanban/squads/dados/dados') === w0);
    const n0 = await p.evaluate(() => Object.keys(window.__store.kanban.usuarios.po1.notificacoes || {}).length);
    await p.evaluate(() => { window.__autoChamadas = []; const ra = window.runAutoRules; window.runAutoRules = function(){ window.__autoChamadas.push([...arguments]); return ra.apply(this, arguments); }; });
    await p.click('#mfer-pass-ov [data-pa="aplicar"]'); await p.waitForTimeout(800);
    const st = await p.evaluate(() => { const cs = Object.values(window.__store.kanban.squads.dados.dados.cards); const g = id => cs.find(c => c && c.id === id); return { c1: g('c1'), c2: g('c2'), c6: g('c6') }; });
    t('M16. c1: responsável passou para PP, com Histórico 🏖️', st.c1.owner === 'PP' && /🏖️ passou o card para Paulo PO/.test((st.c1.history || []).slice(-1)[0]?.what || ''), st.c1);
    t('M17. c2: participação AT → PP (dono BO intacto)', st.c2.owner === 'BO' && (st.c2.participants || []).includes('PP') && !(st.c2.participants || []).includes('AT'), st.c2);
    t('M18. c6 mantido com Ana', st.c6.owner === 'AT');
    t('M18b. automação de "atribuído" disparou 1× (c1 → PP), depois de gravar', await p.evaluate(() => JSON.stringify(window.__autoChamadas) === '[["assigned","c1","PP"]]'), await p.evaluate(() => window.__autoChamadas));
    const nots = await p.evaluate(() => Object.values(window.__store.kanban.usuarios.po1.notificacoes || {}));
    t('M19. 1 aviso só para o Paulo (2 cards no lote), tipo assigned', nots.length === n0 + 1 && nots.some(n => n.type === 'assigned' && /passou 2 cards para você/.test(n.title)), nots);
    t('M20. tela final confirma', /2 item\(ns\) passado/.test(await p.textContent('#mfer-pass-ov')));
    t('M21. sem erro JS', !errs.length, errs);
    await ctx.close();
  }
  // ═══ 2. Maré: gravação recusada desfaz e não avisa ═══
  {
    const { ctx, p, errs } = await abre('/kanban-dev.html?squad=dados', U.ana);
    await p.evaluate(() => { window.__c1Ref = cards.find(x => x.id === 'c1'); window.__c1TinhaBase = Object.getOwnPropertyDescriptor(window.__c1Ref, '__base') !== undefined; window.__autoChamadas = []; const ra = window.runAutoRules; window.runAutoRules = function(){ window.__autoChamadas.push([...arguments]); return ra.apply(this, arguments); }; window.__denySet = pa => String(pa).startsWith('kanban/squads/dados/dados'); abrirMinhasFerias(); });
    await p.waitForTimeout(300);
    await p.click('#cal-ferias [data-act="saida"]'); await p.waitForTimeout(150);
    await p.click('#mfer-pass-ov [data-key="c1"] [data-pa="passar"]'); await p.selectOption('#mfer-pass-ov [data-key="c1"] select', 'PP');
    await p.click('#mfer-pass-ov [data-pa="manter-resto"]'); await p.click('#mfer-pass-ov [data-pa="revisar"]');
    await p.click('#mfer-pass-ov [data-pa="aplicar"]'); await p.waitForTimeout(800);
    t('F1. falha mostra ❌ na tela', /não deu certo/.test(await p.textContent('#mfer-pass-ov')));
    t('F2. card local voltou ao que era (owner AT), no MESMO objeto (preserva __base do merge)', await p.evaluate(() => { const c = cards.find(x => x.id === 'c1'); return c.owner === 'AT' && c === window.__c1Ref && !(c.history || []).some(h => /🏖️/.test(h.what || '')) && (Object.getOwnPropertyDescriptor(c, '__base') !== undefined) === window.__c1TinhaBase; }));
    t('F2b. nenhuma automação de "atribuído" disparou para a passagem recusada', await p.evaluate(() => window.__autoChamadas.length === 0), await p.evaluate(() => window.__autoChamadas));
    t('F3. ninguém foi avisado', await p.evaluate(() => !Object.keys(window.__store.kanban.usuarios.po1.notificacoes || {}).length));
    t('F4. sem erro JS', !errs.filter(e => !/PERMISSION_DENIED/.test(e)).length, errs);
    await ctx.close();
  }
  // ═══ 3. Maré: sem período cadastrado, 🧳 desabilitado; ?ferias=saida só abre a tela ═══
  {
    const { ctx, p } = await abre('/kanban-dev.html?squad=dados', U.al1);
    await p.evaluate(() => abrirMinhasFerias()); await p.waitForTimeout(300);
    t('S1. sem férias cadastradas o 🧳 fica desabilitado', await p.evaluate(() => { const bt = [...document.querySelectorAll('#cal-ferias .mfer-btn')].find(x => /Preparar minha saída/.test(x.textContent)); return !!bt && bt.disabled; }));
    await ctx.close();
    const r = await abre('/kanban-dev.html?squad=dados&ferias=saida', U.ana);
    await r.p.waitForTimeout(2500);
    const s2 = { ov: await r.p.locator('#mfer-pass-ov').count(), cards: await r.p.evaluate(() => Object.values(window.__store.kanban.squads.dados.dados.cards).filter(c => c && ['c1', 'c2', 'c6'].includes(c.id)).map(c => [c.id, c.owner, (c.participants || []).join(','), (c.history || []).length])) };
    t('S2. ?ferias=saida abre a passagem e NÃO aplica nada (cards intactos)', s2.ov === 1 && JSON.stringify(s2.cards.sort()) === '[["c1","AT","",0],["c2","BO","AT",0],["c6","AT","",0]]', s2);
    t('S3. o parâmetro sai da URL', !/ferias=/.test(await r.p.evaluate(() => location.search)));
    await r.ctx.close();
  }
  // ═══ 4. Maré 390 px ═══
  {
    const { ctx, p } = await abre('/kanban-dev.html?squad=dados', U.ana, { width: 390, height: 800 });
    await p.evaluate(() => abrirMinhasFerias()); await p.waitForTimeout(300);
    await p.click('#cal-ferias [data-act="saida"]'); await p.waitForTimeout(150);
    await p.click('#mfer-pass-ov [data-key="c1"] [data-pa="passar"]');
    t('P1. 390 px: passagem sem rolagem lateral e botões ≥44 px', await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      && [...document.querySelectorAll('#mfer-pass-ov .mfer-btn')].every(e => e.getBoundingClientRect().height >= 44)));
    await ctx.close();
  }
  // ═══ 5. Radar (okr-dev.html), Ana ═══
  {
    const { ctx, p, errs } = await abre('/okr-dev.html', U.ana);
    await p.click('#okr-more-btn');
    t('R1. ⋯ Mais tem 🏖️ Minhas férias', await p.locator('#okr-ferias-btn').isVisible());
    await p.click('#okr-ferias-btn');
    await p.waitForSelector('#okr-ferias-host .mfer'); await p.waitForTimeout(300);
    t('R2. aviso do Senior no cadastro do Radar', /não substitui o das férias no Senior/i.test(await p.textContent('#okr-ferias-host .mfer-senior')));
    await p.click('#okr-ferias-host [data-act="saida"]'); await p.waitForTimeout(200);
    const keys = await p.evaluate(() => [...document.querySelectorAll('#mfer-pass-ov [data-key]')].map(e => e.dataset.key).sort());
    t('R3. lista Objetivos meus (o1, o2) e Marco em aberto (m1); não o concluído nem o de outra pessoa', JSON.stringify(keys) === '["m:m1","o:o1","o:o2"]', keys);
    t('R4. Objetivo travado mostra 🔒 e quem edita', /🔒 em edição por Bia Outra/.test(await p.textContent('#mfer-pass-ov [data-key="o:o2"]')));
    t('R5. link para passar os cards no Maré', await p.evaluate(() => [...document.querySelectorAll('#mfer-pass-ov .mfer-pass-links a')].some(a => a.getAttribute('href') === 'kanban-dev.html?ferias=saida')));
    for (const k of ['o:o1', 'o:o2', 'm:m1']) { await p.click(`#mfer-pass-ov [data-key="${k}"] [data-pa="passar"]`); await p.selectOption(`#mfer-pass-ov [data-key="${k}"] select`, 'bia'); }
    const w0 = await escritas(p, 'kanban/okr');
    await p.click('#mfer-pass-ov [data-pa="revisar"]');
    t('R6. nada gravado antes do ✅', await escritas(p, 'kanban/okr') === w0);
    await p.click('#mfer-pass-ov [data-pa="aplicar"]'); await p.waitForTimeout(800);
    const st = await p.evaluate(() => ({ o1: window.__store.kanban.okr.objetivos.o1, o2: window.__store.kanban.okr.objetivos.o2, m1: window.__store.kanban.okr.marcos.m1, log: window.__log.filter(([op, pa]) => /kanban\/okr\/(objetivos|marcos)\//.test(pa) && op !== 'onValue' && op !== 'get') }));
    t('R7. o1: Ana sai, Bia fica (sem duplicar), Histórico 🏖️', JSON.stringify(st.o1.responsaveis) === '["bia"]' && /🏖️ passou a responsabilidade para Bia Outra/.test((st.o1.history || []).slice(-1)[0]?.what || ''), st.o1);
    t('R8. m1: responsável Bia', st.m1.responsavel === 'bia');
    t('R9. o2 travado NÃO foi alterado', JSON.stringify(st.o2.responsaveis) === '["ana"]');
    t('R10. gravação só por update parcial (nunca set no objeto inteiro), e nada em o2', st.log.every(([op]) => op === 'update') && !st.log.some(([, pa]) => /objetivos\/o2/.test(pa)) && st.log.length === 2, st.log);
    t('R11. tela final: 2 passados e o travado explicado', /2 item\(ns\) passado/.test(await p.textContent('#mfer-pass-ov')) && /em edição por Bia Outra/.test(await p.textContent('#mfer-pass-ov .mfer-msg.err')));
    const nb = await p.evaluate(() => Object.values(window.__store.kanban.usuarios.bia.notificacoes || {}));
    t('R12. 1 aviso para a Bia (2 itens), tipo okr_editado', nb.length === 1 && nb[0].type === 'okr_editado' && /passou 2 itens do Radar/.test(nb[0].title), nb);
    t('R13. sem erro JS', !errs.length, errs);
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(ok ? 'TUDO OK' : 'HÁ FALHAS');
  process.exit(ok ? 0 : 1);
})();
