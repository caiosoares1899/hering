// 🔔 Avisos de mudança nos calendários do Gantt (13/11/2026): botão "Avisar-me" no Maré e no Radar (grava kanban/gantt_inscritos_dev/{cal}/{uid}
// com onde=mare|radar; na 🧭 Digital, os 3 comerciais), link ?gantt=… no Maré, clique no aviso `gantt_cal` no sino do Maré, do Radar e do Painel.
// (O envio em si — function ganttAvisoMudanca — é coberto por functions/gantt/__tests__/avisos.test.js.)
// Servir a raiz em BASE_URL (padrão http://127.0.0.1:8949); node docs/arezzo/testes/test_gantt_avisos.js
const fs = require('node:fs'); const path = require('node:path'); const home = require('node:os').homedir();
const pwPath = process.env.PLAYWRIGHT_MODULE || (fs.existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const { chromium } = require(pwPath); const fake = require('./fakefb');
function resolveChrome() { if (process.env.CHROME) return process.env.CHROME; if (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) return '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const r = path.join(home, 'hering-tools/chrome'); const arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-')); return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'); }
const base = process.env.BASE_URL || 'http://127.0.0.1:8949'; const FIXO = '2026-11-12T13:00:00'; const SQ = 'site';
const U = { uid: 'mem', nome: 'Mel Membro', email: 'mem@ciahering.com.br', init: 'MM', role: 'membro', squads: { [SQ]: true } };
const meta = { atualizadoEm: 1, porNome: 'Caio', arquivo: 'x.xlsx' };
const aviso = { id: 'gantt_outlet_v1', type: 'gantt_cal', title: '📊 Comercial Outlet atualizado', sub: 'Ana · ＋3', cal: 'outlet', onde: 'mare', dev: true, read: false, ts: '2026-11-12T12:00:00.000Z' };
const seed = () => ({ kanban: {
  config: { adm_emails: ['adm@ciahering.com.br'] }, okr: { objetivos: {}, marcos: {}, tags: {} },
  usuarios: { mem: Object.assign({ inscrito: true, notificacoes: { gantt_outlet_v1: aviso } }, U) },
  usuarios_publicos: { mem: { uid: 'mem', nome: U.nome, init: 'MM', squads: U.squads } },
  squads: { [SQ]: { dados: { columns: [{ id: 'doing', name: 'Fazendo' }], tags: [], cards_index: {}, cards: {} } } },
  calendarios_gantt_dev: { outlet: { meta, linhas: { out_crm: { rot: 'CRM', ordem: 1 } }, barras: { o1: { linha: 'out_crm', ini: '2026-11-12', fim: '2026-11-12', txt: 'OUTLET' } } } },
} });

(async () => {
  const b = await chromium.launch({ executablePath: resolveChrome(), headless: true }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d ?? null).slice(0, 400))); };
  const abre = async (pagina, qs, opt) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(([f]) => { const R = Date; const fixed = new R(f).getTime(); class D extends R { constructor(...a) { if (!a.length) super(fixed); else super(...a); } static now() { return fixed; } } window.Date = D; try { localStorage.clear(); } catch (e) {} }, [FIXO]);
    await p.goto(base + '/' + pagina + (qs || '')); await p.waitForFunction(() => !!window.__authCb);
    if (opt && opt.negar) await p.evaluate(() => { window.__denySet = (path) => /gantt_inscritos/.test(path); });
    await p.evaluate(x => window.__authCb(x), { uid: U.uid, email: U.email, displayName: U.nome, photoURL: '', providerData: [{ providerId: 'google.com' }] });
    await p.waitForTimeout(2600);
    await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')));
    return { ctx, p, errs };
  };
  const insc = (p) => p.evaluate(() => JSON.parse(JSON.stringify((window.__store.kanban || {}).gantt_inscritos_dev || {})));

  // ── MARÉ ──
  { const { ctx, p, errs } = await abre('kanban-dev.html', '?squad=' + SQ + '&gantt=outlet');
    t('M1. ?gantt=outlet abre o Gantt na aba Outlet (e o parâmetro sai da URL)', await p.evaluate(() => boardView === 'gantt' && _ganttAba === 'outlet' && !/gantt=/.test(location.search)));
    const bt = () => p.evaluate(() => { const x = document.querySelector('#gantt-filtros .gantt-sino'); return x ? { txt: x.textContent, on: x.getAttribute('aria-pressed') } : null; });
    t('M2. botão 🔔 Avisar-me ao lado de 📤/🕘', JSON.stringify(await bt()) === JSON.stringify({ txt: '🔔 Avisar-me', on: 'false' }), await bt());
    await p.click('#gantt-filtros .gantt-sino'); await p.waitForTimeout(250);
    let s = await insc(p);
    t('M3. inscrever grava só a própria inscrição, com onde=mare', s.outlet && s.outlet.mem && s.outlet.mem.onde === 'mare' && typeof s.outlet.mem.em === 'number', s);
    t('M4. botão vira 🔔 Avisando', (await bt()).txt === '🔔 Avisando');
    await p.click('#gantt-filtros .gantt-sino'); await p.waitForTimeout(250);
    s = await insc(p);
    t('M5. tocar de novo desinscreve', !(s.outlet && s.outlet.mem) && (await bt()).txt === '🔔 Avisar-me', s);
    await p.evaluate(() => ganttAba('digital')); await p.waitForTimeout(200);
    t('M6. na 🧭 Digital só o 🔔 (sem 📤/🕘)', await p.evaluate(() => { const a = document.querySelector('#gantt-filtros .gantt-cal-acoes'); return !!a && a.querySelectorAll('button').length === 1 && !!a.querySelector('.gantt-sino'); }));
    await p.click('#gantt-filtros .gantt-sino'); await p.waitForTimeout(250);
    s = await insc(p);
    t('M7. na 🧭 Digital o 🔔 segue os 3 comerciais', ['comercial', 'mktplace', 'outlet'].every(c => s[c] && s[c].mem) && !(s.marca && s.marca.mem), s);
    await p.evaluate(() => ganttAba('marca')); await p.waitForTimeout(150);
    t('M8. na Marca o botão mostra o estado DELA (não inscrita)', (await bt()).txt === '🔔 Avisar-me');
    // clique no aviso no sino do Maré
    await p.evaluate(() => { toggleGanttView(); }); await p.waitForTimeout(150);
    await p.evaluate(() => openNotif('gantt_outlet_v1', '', 'site', '', 'gantt_cal', 'outlet', '')); await p.waitForTimeout(300);
    t('M9. clicar no aviso abre o Gantt no Outlet e marca lido', await p.evaluate(() => boardView === 'gantt' && _ganttAba === 'outlet' && window.__store.kanban.usuarios.mem.notificacoes.gantt_outlet_v1.read === true));
    t('M10. o sino renderiza o aviso com o calendário no clique', await p.evaluate(() => { const el = document.querySelector('.notif-item[data-notif-id="gantt_outlet_v1"]'); return !el || /'outlet'|&quot;outlet&quot;|"outlet"/.test(el.getAttribute('onclick') || ''); }));
    t('M11. sem erro de JS (Maré)', errs.length === 0, errs);
    await ctx.close(); }

  // ── MARÉ sem as regras novas publicadas ──
  { const { ctx, p, errs } = await abre('kanban-dev.html', '?squad=' + SQ + '&gantt=outlet', { negar: true });
    const toasts = []; await p.exposeFunction('__toastSpy', m => toasts.push(m)).catch(() => {});
    await p.evaluate(() => { const o = window.showToast; window.showToast = (m, ...r) => { try { window.__toastSpy(String(m)); } catch (e) {} return o && o(m, ...r); }; });
    await p.click('#gantt-filtros .gantt-sino'); await p.waitForTimeout(300);
    t('N1. gravação negada: avisa que as permissões não foram publicadas e o botão não muda', toasts.some(m => /permiss/.test(m)) && await p.evaluate(() => document.querySelector('#gantt-filtros .gantt-sino').textContent === '🔔 Avisar-me' && !document.querySelector('#gantt-filtros .gantt-sino').disabled), toasts);
    t('N2. sem erro de JS', errs.length === 0, errs);
    await ctx.close(); }

  // ── RADAR ──
  { const { ctx, p, errs } = await abre('okr-dev.html', '?gantt=comercial');
    await p.click('.mgc-sino'); await p.waitForTimeout(250);
    let s = await insc(p);
    t('R1. Radar: 🔔 grava a inscrição com onde=radar', s.comercial && s.comercial.mem && s.comercial.mem.onde === 'radar', s);
    t('R2. botão vira 🔔 Avisando e a linha de aviso confirma', await p.evaluate(() => document.querySelector('.mgc-sino').textContent === '🔔 Avisando' && /Pronto/.test(document.querySelector('.mgc-det').textContent)));
    await p.evaluate(() => _okrSetView('objetivos')); await p.waitForTimeout(150);
    t('R3a. o aviso chegou ao sino do Radar', await p.evaluate(() => _okrNotifPessoais.some(x => x.id === 'gantt_outlet_v1')));
    await p.evaluate(() => _okrBellClick('p', 'gantt_outlet_v1'));
    await p.waitForTimeout(300);
    t('R3. clicar no aviso no sino do Radar abre Calendário → Gantt no Outlet, na mesma página', await p.evaluate(() => _okrCalVista === 'gantt' && document.querySelector('.mgc-aba.on') && document.querySelector('.mgc-aba.on').dataset.aba === 'outlet'), await p.evaluate(() => ({ v: _okrCalVista, a: (document.querySelector('.mgc-aba.on') || {}).dataset })));
    t('R4. sem erro de JS (Radar)', errs.length === 0, errs);
    await ctx.close(); }

  // ── PAINEL: o sino próprio leva o calendário até o clique ──
  { const { ctx, p, errs } = await abre('painel-dev.html', '');
    const r = await p.evaluate(() => { const el = [...document.querySelectorAll('[onclick*="gantt_outlet_v1"]')].find(e => /urlPessoal/.test(e.getAttribute('onclick'))); return el ? el.getAttribute('onclick') : null; });
    t('P1. Painel: o aviso no sino chama o roteador com cal e onde', !!r && /outlet/.test(r) && /mare/.test(r), r);
    t('P2. roteador: aviso do Maré abre kanban-dev.html?gantt=outlet', await p.evaluate(() => MareNotif.urlPessoal({ type: 'gantt_cal', cal: 'outlet', onde: 'mare' }).url === 'kanban-dev.html?gantt=outlet' && MareNotif.urlPessoal({ type: 'gantt_cal', cal: 'x"><img>', onde: 'radar' }).url === 'okr-dev.html?gantt='));
    t('P3. sem erro de JS (Painel)', errs.length === 0, errs);
    await ctx.close(); }

  await b.close(); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1);
})();
