// 📌 Gantt → datas-chave (13/11/2026): eventos marcados pela squad (Black Friday…) viram faixa/linha atrás das barras nas 3 abas,
// com o nome numa linha "📌 Datas-chave" da régua. PO/Organizador/ADM criam, editam e excluem; ADM cria as que valem para todas as squads.
// Servir a raiz em BASE_URL; node docs/arezzo/testes/test_gantt_datas_chave.js   (CAPTURE_DIR grava capturas)
const fs = require('node:fs'); const path = require('node:path'); const home = require('node:os').homedir();
const pwPath = process.env.PLAYWRIGHT_MODULE || (fs.existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const { chromium } = require(pwPath); const fake = require('./fakefb');
function resolveChrome() { if (process.env.CHROME) return process.env.CHROME; if (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) return '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const r = path.join(home, 'hering-tools/chrome'); const arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-')); return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'); }
const base = process.env.BASE_URL || 'http://127.0.0.1:8949'; const K = process.env.K || 'kanban-dev'; const SUF = K.endsWith('-dev') ? '_dev' : '';
const SQ = 'site'; const cap = process.env.CAPTURE_DIR || '';
const FIXO = '2026-11-12T13:00:00';   // janela 01/11 – 12/12
const fl = col => ({ enteredAt: { [col]: '2026-10-20T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-10-20T12:00:00.000Z' }] });
const USERS = {
  mem: { uid: 'mem', nome: 'Mel Membro', email: 'mem@ciahering.com.br', init: 'MM', role: 'membro', squads: { [SQ]: true }, squads_roles: { [SQ]: 'membro' } },
  po: { uid: 'po', nome: 'Paula PO', email: 'po@ciahering.com.br', init: 'PP', role: 'membro', squads: { [SQ]: true }, squads_roles: { [SQ]: 'po' } },
  adm: { uid: 'adm', nome: 'Ana ADM', email: 'adm@ciahering.com.br', init: 'AA', role: 'adm', squads: { [SQ]: true } },
};
const seed = () => ({ kanban: {
  config: { adm_emails: ['adm@ciahering.com.br'] },
  usuarios: Object.fromEntries(Object.entries(USERS).map(([k, u]) => [k, Object.assign({ inscrito: true }, u)])),
  usuarios_publicos: Object.fromEntries(Object.entries(USERS).map(([k, u]) => [k, { uid: u.uid, nome: u.nome, init: u.init, squads: u.squads }])),
  squads: { [SQ]: {
    dados: { columns: [{ id: 'doing', name: 'Fazendo' }, { id: 'done', name: 'Concluído', isDone: true }], tags: [], cards_index: { c1: 'k1' },
      cards: { k1: { id: 'c1', title: 'Card da campanha', col: 'doing', owner: 'PP', createdAt: '2026-10-20', flow: fl('doing'), inicio: '2026-11-20', fim: '2026-11-30', updatedAt: '2026-10-27T10:00:00.000Z' } } },
    ['gantt_marcos' + SUF]: {
      mbf: { titulo: 'Black Friday', ini: '2026-11-27', fim: '2026-11-30', cor: 'red', porUid: 'po', porNome: 'Paula PO', em: 1 },
      mxs: { titulo: '<img src=x onerror="window.__xss=1"> Esquenta', ini: '2026-11-28', fim: '2026-11-28', cor: 'orange', porUid: 'po', porNome: 'Paula PO', em: 1 },
      mvelho: { titulo: 'Fora da janela', ini: '2026-05-10', fim: '2026-05-10', cor: 'pink', porUid: 'po', porNome: 'Paula PO', em: 1 },
    } } },
  ['gantt_marcos_globais' + SUF]: { g1: { titulo: 'Dia do Cliente (teste)', ini: '2026-11-15', fim: '2026-11-15', cor: 'blue', porUid: 'adm', porNome: 'Ana ADM', em: 1 } },
} });

(async () => {
  const b = await chromium.launch({ executablePath: resolveChrome(), headless: true }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 400))); };
  const abre = async (quem, vp) => {
    const ctx = await b.newContext({ viewport: vp, hasTouch: vp.width < 1000, isMobile: vp.width < 1000 }); await fake.install(ctx, seed());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(f => { const R = Date; const fixed = new R(f).getTime(); class D extends R { constructor(...a) { if (!a.length) super(fixed); else super(...a); } static now() { return fixed; } } window.Date = D; try { localStorage.removeItem('mare_gantt_aba'); } catch (e) {} }, FIXO);
    await p.goto(base + '/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb);
    const u = USERS[quem]; await p.evaluate(x => window.__authCb(x), { uid: u.uid, email: u.email, displayName: u.nome, photoURL: '', providerData: [{ providerId: 'google.com' }] }); await p.waitForTimeout(2500);
    await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')));
    return { ctx, p, errs };
  };
  const leu = (p, s) => p.evaluate(x => window.__log.filter(l => String(l[1]).includes(x)).length, s);
  const store = p => p.evaluate(([sq, suf]) => JSON.parse(JSON.stringify({ sq: ((window.__store.kanban.squads || {})[sq] || {})['gantt_marcos' + suf] || {}, gl: window.__store.kanban['gantt_marcos_globais' + suf] || {} })), [SQ, SUF]);

  // ── membro: vê, não edita
  for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 800 }]) {
    const L = vp.width + 'px'; const { ctx, p, errs } = await abre('mem', vp);
    t(`A ${L}. datas-chave não são lidas no boot`, await leu(p, 'gantt_marcos') === 0);
    await p.evaluate(() => toggleGanttView()); await p.waitForTimeout(400);
    t(`B ${L}. ao abrir o Gantt lê as da squad e as globais`, await leu(p, 'squads/site/gantt_marcos') === 1 && await leu(p, 'gantt_marcos_globais') === 1);
    const r = await p.evaluate(() => {
      const chips = [...document.querySelectorAll('.gantt-mc-chip:not(.gantt-mc-hoje)')].map(c => ({ n: c.querySelector('.gantt-mc-nome').textContent, col: c.style.gridColumn, row: c.style.gridRow, glb: !!c.querySelector('.gantt-mc-glb') }));
      const faixas = [...document.querySelectorAll('.gantt-mc-faixa')].map(f => ({ col: f.style.gridColumn, dia: f.classList.contains('is-dia') }));
      return { chips, faixas, add: !!document.querySelector('.gantt-mc-add'), img: !!document.querySelector('.gantt-mc-chip img'), corner: (document.querySelector('.gantt-mc-corner') || {}).textContent };
    });
    const bf = r.chips.find(c => c.n === 'Black Friday'), xs = r.chips.find(c => /Esquenta/.test(c.n)), gl = r.chips.find(c => /Dia do Cliente/.test(c.n));
    t(`C ${L}. linha "📌 Datas-chave" com 3 nomes (o de maio fica fora da janela)`, r.chips.length === 3 && /Datas-chave/.test(r.corner), r);
    t(`D ${L}. Black Friday 27–30/11 começa na coluna 27 e a faixa cobre 27→30; 1 dia vira linha`, bf && /^27 \//.test(bf.col) && r.faixas.some(f => f.col === '27 / 31' && !f.dia) && r.faixas.some(f => f.col === '28 / 29' && f.dia), r);
    t(`D2 ${L}. nome de data de 1 dia cabe (não fica só o ícone)`, await p.evaluate(() => [...document.querySelectorAll('.gantt-mc-chip:not(.gantt-mc-hoje) .gantt-mc-nome')].every(n => n.getBoundingClientRect().width >= 40)));
    t(`E ${L}. nomes que se cruzam vão para outra pista (Esquenta embaixo da Black Friday)`, bf && xs && bf.row !== xs.row, [bf, xs]);
    t(`F ${L}. a global tem o 🌐 e as da squad não`, gl && gl.glb && bf && !bf.glb, r.chips);
    t(`G ${L}. nome com HTML aparece como texto (nada executa)`, !r.img && await p.evaluate(() => !window.__xss) && /<img src=x/.test(xs && xs.n), xs);
    t(`H ${L}. membro não vê o ＋`, !r.add);
    await p.click('.gantt-mc-chip[data-id="mbf"]'); await p.waitForTimeout(200);
    t(`I ${L}. membro toca no nome: aviso com nome e período (sem abrir formulário)`, await p.evaluate(() => /Black Friday · 27\/11 – 30\/11/.test(document.getElementById('kb-toast').textContent) && !(document.getElementById('gantt-mc-ov') || {}).classList?.contains('open')));
    await p.evaluate(() => ganttAba('marca')); await p.waitForTimeout(300);
    t(`J ${L}. nas abas de calendário as datas-chave continuam (linha e faixa)`, await p.evaluate(() => document.querySelectorAll('.gantt-mc-chip:not(.gantt-mc-hoje)').length === 3 && document.querySelectorAll('.gantt-mc-faixa').length === 3));
    t(`K ${L}. sem rolagem lateral da página e sem erro de JS`, await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1) && errs.length === 0, errs);
    if (cap) { await p.evaluate(() => ganttAba('cards')); await p.waitForTimeout(200); for (const th of ['', 'light', 'vice']) { await p.evaluate(x => document.documentElement.dataset.theme = x, th); await p.waitForTimeout(150); await p.screenshot({ path: path.join(cap, `mc_${vp.width}_${th || 'dark'}.png`) }); } }
    await ctx.close();
  }
  // ── PO: cria, valida, edita e exclui
  { const { ctx, p, errs } = await abre('po', { width: 1280, height: 900 });
    await p.evaluate(() => toggleGanttView()); await p.waitForTimeout(300);
    t('L. PO vê o ＋ ao lado de "📌 Datas-chave"', await p.evaluate(() => !!document.querySelector('.gantt-mc-add')));
    await p.click('.gantt-mc-add'); await p.waitForTimeout(150);
    t('M. formulário abre com foco no nome; PO não vê "todas as squads"', await p.evaluate(() => document.getElementById('gantt-mc-ov').classList.contains('open') && document.activeElement.id === 'gantt-mc-titulo' && document.getElementById('gantt-mc-glob-l').hidden));
    await p.fill('#gantt-mc-titulo', 'Natal'); await p.fill('#gantt-mc-ini', '2026-12-10'); await p.fill('#gantt-mc-fim', '2026-12-01'); await p.click('#gantt-mc-ok'); await p.waitForTimeout(150);
    t('N. fim antes do início: avisa e não grava', await p.evaluate(() => /não pode ser antes/.test(document.getElementById('gantt-mc-aviso').textContent)) && Object.keys((await store(p)).sq).length === 3);
    await p.fill('#gantt-mc-fim', '2026-12-24'); await p.click('.gantt-mc-cor[data-cor="green"]'); await p.click('#gantt-mc-ok'); await p.waitForTimeout(300);
    let st = await store(p); const novo = Object.entries(st.sq).find(([, m]) => m.titulo === 'Natal');
    t('O. salva na squad com autor, cor e datas; o nome aparece na régua', !!novo && novo[1].porUid === 'po' && novo[1].cor === 'green' && novo[1].ini === '2026-12-10' && novo[1].fim === '2026-12-24' && /^m[a-z0-9]+$/.test(novo[0])
      && await p.evaluate(() => [...document.querySelectorAll('.gantt-mc-nome')].some(x => x.textContent === 'Natal')), novo);
    await p.click('.gantt-mc-chip[data-id="mbf"]'); await p.waitForTimeout(150);
    t('P. PO toca num nome: abre a edição já preenchida, com Excluir', await p.evaluate(() => document.getElementById('gantt-mc-titulo').value === 'Black Friday' && document.getElementById('gantt-mc-fim').value === '2026-11-30' && !document.getElementById('gantt-mc-del').hidden && document.querySelector('.gantt-mc-cor.on').dataset.cor === 'red'));
    await p.fill('#gantt-mc-titulo', 'Black Friday 🖤'); await p.click('#gantt-mc-ok'); await p.waitForTimeout(300);
    st = await store(p);
    t('Q. editar mantém o autor e o id', st.sq.mbf && st.sq.mbf.titulo === 'Black Friday 🖤' && st.sq.mbf.porUid === 'po', st.sq.mbf);
    await p.click('.gantt-mc-chip[data-id="mbf"]'); await p.waitForTimeout(150); await p.click('#gantt-mc-del'); await p.waitForTimeout(150); await p.click('#ui-modal-ok'); await p.waitForTimeout(300);
    st = await store(p);
    t('R. excluir pede confirmação e apaga', !st.sq.mbf && await p.evaluate(() => !document.querySelector('.gantt-mc-chip[data-id="mbf"]')));
    t('S. PO não edita a global (toque só mostra o aviso)', await p.evaluate(() => { document.querySelector('.gantt-mc-chip[data-escopo="global"]').click(); return !document.getElementById('gantt-mc-ov').classList.contains('open') && /todas as squads/.test(document.getElementById('kb-toast').textContent); }));
    t('T. sem erro de JS', errs.length === 0, errs);
    await ctx.close(); }
  // ── PO numa squad SEM datas-chave: a dica de vazio aparece junto com o "Hoje" (antes o Hoje a escondia)
  { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const sd = seed(); delete sd.kanban.squads[SQ]['gantt_marcos' + SUF]; delete sd.kanban['gantt_marcos_globais' + SUF]; await fake.install(ctx, sd);
    const p = await ctx.newPage(); await p.addInitScript(f => { const R = Date; const fixed = new R(f).getTime(); class D extends R { constructor(...a) { if (!a.length) super(fixed); else super(...a); } static now() { return fixed; } } window.Date = D; }, FIXO);
    await p.goto(base + '/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb); const u = USERS.po;
    await p.evaluate(x => window.__authCb(x), { uid: u.uid, email: u.email, displayName: u.nome, photoURL: '', providerData: [{ providerId: 'google.com' }] }); await p.waitForTimeout(2500);
    await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); toggleGanttView(); }); await p.waitForTimeout(300);
    t('L2. PO sem datas-chave: "Hoje" e a dica "Marque Black Friday…" aparecem juntos', await p.evaluate(() => !!document.querySelector('.gantt-mc-hoje') && /Marque Black Friday/.test((document.querySelector('.gantt-mc-vazio') || {}).textContent || '')));
    await ctx.close(); }
  // ── ADM: cria global
  { const { ctx, p } = await abre('adm', { width: 1280, height: 900 });
    await p.evaluate(() => toggleGanttView()); await p.waitForTimeout(300);
    await p.click('.gantt-mc-add'); await p.waitForTimeout(150);
    t('U. ADM vê "🌐 todas as squads"', await p.evaluate(() => !document.getElementById('gantt-mc-glob-l').hidden));
    await p.fill('#gantt-mc-titulo', 'Feriado nacional (teste)'); await p.fill('#gantt-mc-ini', '2026-11-20'); await p.check('#gantt-mc-glob'); await p.click('#gantt-mc-ok'); await p.waitForTimeout(300);
    const st = await store(p); const g = Object.values(st.gl).find(m => /Feriado/.test(m.titulo));
    t('V. global vai para gantt_marcos_globais' + SUF + ' (não para a squad), 1 dia = início e fim iguais', !!g && g.ini === '2026-11-20' && g.fim === '2026-11-20' && !Object.values(st.sq).some(m => /Feriado/.test(m.titulo)), st);
    await ctx.close(); }
  // ── celular: alvos de toque do PO
  { const { ctx, p } = await abre('po', { width: 390, height: 800 });
    await p.evaluate(() => toggleGanttView()); await p.waitForTimeout(300);
    t('W. celular: ＋ e nomes com alvo ≥ 32 px (＋ ≥ 44), formulário cabe na tela', await p.evaluate(() => { const a = document.querySelector('.gantt-mc-add').getBoundingClientRect(); const c = document.querySelector('.gantt-mc-chip:not(.gantt-mc-hoje)').getBoundingClientRect(); return a.height >= 44 && c.height >= 32; })
      && await (async () => { await p.click('.gantt-mc-add'); await p.waitForTimeout(150); return p.evaluate(() => { const r = document.querySelector('.gantt-mc-panel').getBoundingClientRect(); return r.right <= innerWidth && r.left >= 0 && document.documentElement.scrollWidth <= innerWidth + 1; }); })());
    await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1);
})();
