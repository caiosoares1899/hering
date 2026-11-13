// 📤 Gantt → "Atualizar planilha" + 🕘 Histórico no próprio Maré (13/11/2026): qualquer login Google da Hering envia o .xlsx, vê a prévia e
// publica para todas as squads; cada publicação guarda cópia + linha no histórico; dá para voltar a uma versão (também registrado).
// O leitor (mare-gxl) só é baixado quando alguém usa. Planilhas SINTÉTICAS. Servir a raiz em BASE_URL; node docs/arezzo/testes/test_gantt_atualizar.js
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os'); const home = os.homedir();
const pwPath = process.env.PLAYWRIGHT_MODULE || (fs.existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const { chromium } = require(pwPath); const fake = require('./fakefb'); const X = require('./xlsx_sintetico');
function resolveChrome() { if (process.env.CHROME) return process.env.CHROME; if (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) return '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const r = path.join(home, 'hering-tools/chrome'); const arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-')); return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'); }
const base = process.env.BASE_URL || 'http://127.0.0.1:8949'; const SQ = 'site'; const FIXO = '2026-11-12T13:00:00';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gup-')); const arq = (n, abas) => { const f = path.join(tmp, n); fs.writeFileSync(f, X.xlsx(abas)); return f; };
const V1 = arq('Campanhas v1.xlsx', [X.marca(2026, [{ r: 7, rot: 'WEB', barras: [['2026-11-01', '2026-11-20', 'CAMPANHA V1 TESTE']] }])]);
const V2 = arq('Campanhas v2.xlsx', [X.marca(2026, [{ r: 7, rot: 'WEB', barras: [['2026-11-01', '2026-11-20', 'CAMPANHA V2 TESTE'], ['2026-11-25', '2026-11-30', 'NOVA DA V2']] }])]);
const O_NOV = arq('Outlet | Calendário Novembro 2026.xlsx', X.outletMes(2026, 11, { 'AÇÃO PRINCIPAL': [[1, 4, 'OUTLET NOV TESTE']] }));
const O_DEZ = arq('Outlet | Calendário Dezembro 2026.xlsx', X.outletMes(2026, 12, { 'AÇÃO PRINCIPAL': [[1, 5, 'OUTLET DEZ TESTE']] }));
const fl = col => ({ enteredAt: { [col]: '2026-10-20T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-10-20T12:00:00.000Z' }] });
const seed = () => ({ kanban: { usuarios: { mem: { uid: 'mem', nome: 'Mel Membro', email: 'mem@ciahering.com.br', inscrito: true, init: 'MM', role: 'membro', squads: { [SQ]: true } } },
  usuarios_publicos: { mem: { uid: 'mem', nome: 'Mel Membro', init: 'MM', squads: { [SQ]: true } } },
  squads: { [SQ]: { dados: { columns: [{ id: 'doing', name: 'Fazendo' }], tags: [], cards_index: { c1: 'k1' }, cards: { k1: { id: 'c1', title: 'Card', col: 'doing', owner: 'MM', createdAt: '2026-10-20', flow: fl('doing'), updatedAt: '2026-10-27T10:00:00.000Z' } } } } } } });

(async () => {
  const b = await chromium.launch({ executablePath: resolveChrome(), headless: true }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const abre = async (vp, user) => {
    const ctx = await b.newContext({ viewport: vp, hasTouch: vp.width < 1000, isMobile: vp.width < 1000 }); await fake.install(ctx, seed());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(f => { const R = Date; const fixed = new R(f).getTime(); class D extends R { constructor(...a) { if (!a.length) super(fixed + (window.__avanco || 0)); else super(...a); } static now() { return fixed + (window.__avanco || 0); } } window.Date = D; try { localStorage.clear(); } catch (e) {} }, FIXO);
    await p.goto(base + '/kanban-dev.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(u => window.__authCb(u), user); await p.waitForTimeout(2500);
    await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); toggleGanttView(); ganttAba('marca'); }); await p.waitForTimeout(400);
    return { ctx, p, errs };
  };
  const MEL = { uid: 'mem', email: 'mem@ciahering.com.br', displayName: 'Mel Membro', photoURL: '', providerData: [{ providerId: 'google.com' }] };
  const store = p => p.evaluate(() => JSON.parse(JSON.stringify({ cal: (window.__store.kanban.calendarios_gantt_dev || {}).marca || null, hist: (window.__store.kanban.calendarios_gantt_hist_dev || {}).marca || {}, snap: (window.__store.kanban.calendarios_gantt_snap_dev || {}).marca || {} })));
  const envia = async (p, f) => { await p.setInputFiles('#gantt-up-inp', f); await p.waitForFunction(() => !!document.querySelector('#gantt-up-pv .gxl-ok') || !!document.querySelector('#gantt-up-pv .gxl-erro'), null, { timeout: 15000 }); };

  { const { ctx, p, errs } = await abre({ width: 1280, height: 900 }, MEL);
    t('A. membro (login Google Hering) vê 📤 Atualizar planilha e 🕘 Histórico; o leitor ainda NÃO foi baixado', await p.evaluate(() => /Atualizar planilha/.test(document.getElementById('gantt-filtros').textContent) && /Histórico/.test(document.getElementById('gantt-filtros').textContent) && !window.MareGXL && !document.querySelector('script[src*="mare-gxl"]')));
    t('B. calendário vazio aponta para o botão (e não mais "um ADM publica no Painel")', await p.evaluate(() => /Atualizar planilha/.test(document.querySelector('.gantt-empty').textContent) && !/ADM publica/.test(document.querySelector('.gantt-empty').textContent)));
    await p.click('.gantt-cal-acoes [onclick="ganttAtualizarAbrir()"]'); await p.waitForTimeout(300);
    t('C. abrir a janela baixa o leitor (sob demanda) e explica o que acontece', await p.evaluate(() => document.getElementById('gantt-up-ov').classList.contains('open') && /todas as squads/.test(document.getElementById('gantt-up-exp').textContent)) && await p.waitForFunction(() => !!window.MareGXL, null, { timeout: 8000 }).then(() => true, () => false));
    await envia(p, V1);
    t('D. prévia com o que entra e o botão de publicar', await p.evaluate(() => /＋ 1 novas/.test(document.getElementById('gantt-up-pv').textContent) && /Publicar para todas as squads/.test(document.getElementById('gantt-up-pv').textContent)));
    await p.click('#gantt-up-pv .gxl-ok'); await p.waitForTimeout(500);
    let st = await store(p); let hs = Object.values(st.hist);
    t('E. publicar grava o calendário, 1 cópia e 1 linha no histórico com quem publicou', st.cal && /CAMPANHA V1/.test(JSON.stringify(st.cal.barras)) && Object.keys(st.snap).length === 1 && hs.length === 1 && hs[0].porUid === 'mem' && hs[0].porNome === 'Mel Membro' && hs[0].acao === 'publicou' && hs[0].novas === 1, st);
    t('F. a janela fecha e o Gantt já mostra a barra', await p.evaluate(() => !document.getElementById('gantt-up-ov').classList.contains('open') && /CAMPANHA V1/.test(document.getElementById('gantt-view').textContent)));
    // 2ª versão
    await p.evaluate(() => { window.__avanco = 3600000; ganttAtualizarAbrir(); }); await p.waitForTimeout(150); await envia(p, V2);   // 1 h depois
    t('G. 2ª planilha: prévia compara com o que está publicado (1 nova, 1 sai)', await p.evaluate(() => /＋ 2 novas/.test(document.getElementById('gantt-up-pv').textContent) && /− 1 saem/.test(document.getElementById('gantt-up-pv').textContent)));
    await p.click('#gantt-up-pv .gxl-ok'); await p.waitForTimeout(500);
    // histórico + voltar
    await p.click('.gantt-cal-acoes [onclick="ganttHistoricoAbrir()"]'); await p.waitForTimeout(500);
    const hl = await p.evaluate(() => [...document.querySelectorAll('.gantt-hist-it')].map(x => ({ txt: x.textContent, atual: x.classList.contains('is-atual'), volta: !!x.querySelector('.gantt-hist-volta') })));
    t('H. histórico: 2 publicações, a mais nova marcada como atual (sem "voltar") e a antiga com "↩ Voltar"', hl.length === 2 && hl[0].atual && !hl[0].volta && /Campanhas v2/.test(hl[0].txt) && hl[1].volta && /Campanhas v1/.test(hl[1].txt) && /Mel Membro/.test(hl[1].txt), hl);
    await p.evaluate(() => { window.__avanco = 7200000; }); await p.click('.gantt-hist-volta'); await p.waitForTimeout(200); await p.click('#ui-modal-ok'); await p.waitForTimeout(700);
    st = await store(p); hs = Object.values(st.hist).sort((a, b) => b.em - a.em);
    t('I. voltar à versão 1: calendário volta, e a volta fica no histórico como "restaurou" apontando para a cópia antiga', /CAMPANHA V1/.test(JSON.stringify(st.cal.barras)) && !/NOVA DA V2/.test(JSON.stringify(st.cal.barras)) && hs.length === 3 && hs.some(h => h.acao === 'restaurou') && Object.keys(st.snap).length === 3, hs);
    t('J. a lista do histórico se atualiza (3 itens, "voltou para a versão de…")', await p.evaluate(() => document.querySelectorAll('.gantt-hist-it').length === 3 && /voltou para a versão de/.test(document.querySelector('.gantt-hist-it').textContent)));
    // 🏷️ Outlet pelo Maré: novembro, depois dezembro — novembro continua
    await p.keyboard.press('Escape'); await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); ganttAba('outlet'); }); await p.waitForTimeout(400);
    await p.evaluate(() => { window.__avanco = 10800000; ganttAtualizarAbrir(); }); await p.waitForTimeout(150); await envia(p, O_NOV);
    t('N. Outlet: o aviso da prévia diz que só o mês do arquivo é trocado', await p.evaluate(() => /troca SÓ o mês desta planilha/.test(document.getElementById('gantt-up-pv').textContent)));
    await p.click('#gantt-up-pv .gxl-ok'); await p.waitForTimeout(500);
    await p.evaluate(() => { window.__avanco = 14400000; ganttAtualizarAbrir(); }); await p.waitForTimeout(150); await envia(p, O_DEZ);
    t('O. dezembro: entra 1, sai 0', await p.evaluate(() => /＋ 1 novas/.test(document.getElementById('gantt-up-pv').textContent) && /− 0 saem/.test(document.getElementById('gantt-up-pv').textContent)));
    await p.click('#gantt-up-pv .gxl-ok'); await p.waitForTimeout(500);
    const ob = await p.evaluate(() => Object.values(((window.__store.kanban.calendarios_gantt_dev || {}).outlet || {}).barras || {}).map(x => x.txt));
    t('P. Outlet publicado com novembro E dezembro (só "criou mais um mês")', ob.includes('OUTLET NOV TESTE') && ob.includes('OUTLET DEZ TESTE'), ob);
    t('K. sem erro de JS', errs.length === 0, errs);
    await ctx.close(); }
  { const { ctx, p } = await abre({ width: 1280, height: 900 }, { uid: 'conv', email: 'convidado@gmail.com', displayName: 'Conv', photoURL: '', providerData: [{ providerId: 'password' }] });
    t('L. convidado externo: nem abas de calendário nem botões', await p.evaluate(() => !document.querySelector('.gantt-abas') && !document.querySelector('.gantt-cal-acoes')));
    await ctx.close(); }
  { const { ctx, p, errs } = await abre({ width: 390, height: 800 }, MEL);
    await p.evaluate(() => ganttAtualizarAbrir()); await p.waitForTimeout(300);
    t('M. celular: janela cabe na tela, botões com 44 px, sem rolagem lateral', await p.evaluate(() => { const r = document.querySelector('#gantt-up-ov .panel').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && document.querySelector('.gantt-up-pick').getBoundingClientRect().height >= 44 && document.documentElement.scrollWidth <= innerWidth + 1; }));
    await ctx.close(); }
  await b.close(); fs.rmSync(tmp, { recursive: true, force: true }); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1);
})();
