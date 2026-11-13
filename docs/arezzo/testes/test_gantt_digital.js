// 🧭 Digital · dia a dia (13/11/2026): os 3 calendários comerciais (Hering, Marketplace, Outlet) na mesma régua, um bloco por
// origem, filtro por origem e o painel "tudo deste dia" — no Maré (kanban-dev, aba do 📊 Gantt) e no Radar (Calendário → 📊 Gantt,
// via mare-gcal-dev.js). Servir a raiz em BASE_URL (padrão http://127.0.0.1:8949); node docs/arezzo/testes/test_gantt_digital.js
const fs = require('node:fs'); const path = require('node:path'); const home = require('node:os').homedir();
const pwPath = process.env.PLAYWRIGHT_MODULE || (fs.existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const { chromium } = require(pwPath); const fake = require('./fakefb');
function resolveChrome() { if (process.env.CHROME) return process.env.CHROME; if (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) return '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const r = path.join(home, 'hering-tools/chrome'); const arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-')); return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'); }
const base = process.env.BASE_URL || 'http://127.0.0.1:8949'; const cap = process.env.CAPTURE_DIR || ''; const FIXO = '2026-11-12T13:00:00';
const SQ = 'site'; const PROD = process.env.PROD === '1'; const SUF = PROD ? '' : '_dev'; const KAN = PROD ? 'kanban.html' : 'kanban-dev.html', OKR = PROD ? 'okr.html' : 'okr-dev.html';   // PROD=1 testa as páginas de produção
const U = { uid: 'mem', nome: 'Mel Membro', email: 'mem@ciahering.com.br', init: 'MM', role: 'membro', squads: { [SQ]: true } };
const meta = { atualizadoEm: Date.parse('2026-11-13T14:32:00'), porNome: 'Caio', arquivo: 'x.xlsx' };
const seed = () => ({ kanban: {
  config: { adm_emails: ['adm@ciahering.com.br'] },
  okr: { objetivos: {}, marcos: {}, tags: {} },
  usuarios: { mem: Object.assign({ inscrito: true }, U) },
  usuarios_publicos: { mem: { uid: 'mem', nome: U.nome, init: 'MM', squads: U.squads } },
  squads: { [SQ]: { dados: { columns: [{ id: 'doing', name: 'Fazendo' }], tags: [], cards_index: {}, cards: {} } } },
  ['calendarios_gantt' + SUF]: {
    comercial: { meta, linhas: { site: { rot: 'Site todo (não remarcados)', ordem: 1 }, crm: { rot: 'CRM', ordem: 6 } },
      barras: { h1: { linha: 'site', ini: '2026-11-10', fim: '2026-11-14', txt: 'AÇÃO SITE LONGA' }, h2: { linha: 'crm', ini: '2026-11-13', fim: '2026-11-13', txt: '<img src=x onerror=window.__xss=1>CRM DO DIA' } } },
    mktplace: { meta, linhas: { mkt_amazon: { rot: 'Amazon', ordem: 0 } },
      barras: { h1: { linha: 'mkt_amazon', ini: '2026-11-12', fim: '2026-11-15', txt: 'CUPOM AMAZON' } } },
    // outlet: NÃO publicado (o bloco dele avisa sozinho)
  },
  ['gantt_destaques' + SUF]: { mktplace: { h1: { cor: 'red', alerta: true, porNome: 'Ana', em: 1 } }, comercial: { h1: { cor: 'blue', alerta: false, porNome: 'Ana', em: 1 } } },
} });

(async () => {
  const b = await chromium.launch({ executablePath: resolveChrome(), headless: true }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d ?? null).slice(0, 400))); };
  const abre = async (pagina, qs, vp, tema) => {
    const ctx = await b.newContext({ viewport: vp, hasTouch: vp.width < 1000, isMobile: vp.width < 1000 }); await fake.install(ctx, seed());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(([f]) => { const R = Date; const fixed = new R(f).getTime(); class D extends R { constructor(...a) { if (!a.length) super(fixed); else super(...a); } static now() { return fixed; } } window.Date = D; try { localStorage.clear(); } catch (e) {} }, [FIXO]);
    await p.goto(base + '/' + pagina + (qs || '')); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(x => window.__authCb(x), { uid: U.uid, email: U.email, displayName: U.nome, photoURL: '', providerData: [{ providerId: 'google.com' }] });
    await p.waitForTimeout(2600);
    if (tema) await p.evaluate(tm => { if (tm === 'dark') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', tm); }, tema);
    return { ctx, p, errs };
  };

  // ── MARÉ ────────────────────────────────────────────────────────────
  { const { ctx, p, errs } = await abre(KAN, '?squad=' + SQ, { width: 1280, height: 900 });
    await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); toggleGanttView(); }); await p.waitForTimeout(300);
    t('M1. aba 🧭 Digital · dia a dia existe depois do Outlet', await p.evaluate(() => [...document.querySelectorAll('.gantt-aba')].map(a => a.dataset.aba).join()) === 'cards,marca,comercial,mktplace,outlet,digital');
    // filtro de grupo esquecido na aba própria NÃO pode vazar para a consolidada
    await p.evaluate(() => { ganttAba('comercial'); }); await p.waitForTimeout(150);
    await p.evaluate(() => ganttCalFiltro('crm')); await p.waitForTimeout(150);
    await p.evaluate(() => ganttAba('digital')); await p.waitForTimeout(250);
    const st = () => p.evaluate(() => { const v = document.getElementById('gantt-view'); return { txt: v.innerText, origens: [...v.querySelectorAll('.gantt-cal-origem')].map(e => e.dataset.origem), largo: v.classList.contains('gantt-largo'),
      acoes: !!v.querySelector('.gantt-cal-acoes'), chips: [...v.querySelectorAll('.gantt-cal-fchip')].map(c => c.dataset.g) }; });
    let s = await st();
    t('M2. 3 blocos por origem (Hering, Marketplace, Outlet), dia largo', s.origens.join() === 'comercial,mktplace,outlet' && s.largo, s.origens);
    t('M3. o "só CRM" da aba Hering não vaza: o Site aparece na consolidada', /AÇÃO SITE LONGA/.test(s.txt) && /CRM DO DIA/.test(s.txt), s.txt.slice(0, 400));
    t('M4. Outlet não publicado avisa só no bloco dele', /O Calendário Comercial Outlet ainda não foi publicado/.test(s.txt) && !document_has_empty_global(s.txt), '');
    t('M5. sem 📤/🕘 na consolidada (só o 🔔); chips por origem', await p.evaluate(() => { const a = document.querySelector('#gantt-view .gantt-cal-acoes'); return !a || [...a.querySelectorAll('button')].every(b => b.classList.contains('gantt-sino')); }) && s.chips.join() === ',comercial,mktplace,outlet', s);
    t('M6. destaque ⚠️ do Marketplace aparece e a barra leva a origem (data-cal=mktplace)', await p.evaluate(() => { const x = document.querySelector('.gantt-cal-bar[data-cal="mktplace"][data-id="h1"]'); return !!x && x.classList.contains('is-alerta'); }));
    t('M7. XSS: texto do banco escapado', await p.evaluate(() => !window.__xss && !document.querySelector('#gantt-view img')));
    // painel do dia
    await p.click('.gantt-day-hd.is-clic[data-date="2026-11-13"]'); await p.waitForTimeout(250);
    let dia = await p.evaluate(() => { const d = document.getElementById('gantt-dia'); return d ? d.innerText : ''; });
    t('M8. tocar no dia 13 abre "tudo deste dia": ação de vários dias + do dia, por origem', /3 ações/.test(dia) && /AÇÃO SITE LONGA/.test(dia) && /10\/11 – 14\/11/.test(dia) && /CRM DO DIA/.test(dia) && /CUPOM AMAZON/.test(dia) && /Ainda não publicado/.test(dia), dia);
    t('M9. dia escolhido destacado (aria-pressed) e foco no ✕', await p.evaluate(() => document.querySelector('.gantt-day-hd[data-date="2026-11-13"]').getAttribute('aria-pressed') === 'true' && document.activeElement && document.activeElement.closest('#gantt-dia')));
    // republicação ao vivo de uma fonte com a consolidada aberta
    await p.evaluate(suf => window._set(window._ref(window._db, 'kanban/calendarios_gantt' + suf + '/outlet'), { meta: { atualizadoEm: 1, porNome: 'X', arquivo: 'o.xlsx' }, linhas: { out_acao_principal: { rot: 'Ação principal', ordem: 0 } }, barras: { o1: { linha: 'out_acao_principal', ini: '2026-11-13', fim: '2026-11-13', txt: 'OUTLET NOVO' } } }), SUF);
    await p.waitForTimeout(300);
    dia = await p.evaluate(() => (document.getElementById('gantt-dia') || {}).innerText || '');
    t('M10. republicar o Outlet com a consolidada aberta: régua e painel atualizam na hora', /OUTLET NOVO/.test(await p.evaluate(() => document.getElementById('gantt-view').innerText)) && /4 ações/.test(dia), dia);
    // filtro por origem respeitado pelo painel
    await p.evaluate(() => ganttCalFiltro('mktplace')); await p.waitForTimeout(200);
    s = await st(); dia = await p.evaluate(() => (document.getElementById('gantt-dia') || {}).innerText || '');
    t('M11. filtro "só Marketplace": só esse bloco e o painel diz "só Marketplace"', s.origens.join() === 'mktplace' && /só 🛍️ Marketplace/.test(dia) && /1 ação/.test(dia) && !/AÇÃO SITE/.test(dia), { o: s.origens, dia });
    await p.evaluate(() => ganttCalFiltro('mktplace')); await p.waitForTimeout(150);
    // Esc fecha o painel antes de tudo
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    t('M12. Esc fecha o painel do dia (e não sai do Gantt)', await p.evaluate(() => !document.getElementById('gantt-dia') && boardView === 'gantt'));
    await p.evaluate(() => ganttAba('marca')); await p.waitForTimeout(150);
    t('M13. nas outras abas o dia não é clicável', await p.evaluate(() => !document.querySelector('.gantt-day-hd.is-clic')));
    t('M14. sem erro de JS (Maré)', errs.length === 0, errs);
    await ctx.close(); }

  // ── RADAR ───────────────────────────────────────────────────────────
  { const { ctx, p, errs } = await abre(OKR, '?gantt=digital', { width: 1280, height: 900 });
    const st = () => p.evaluate(() => { const h = document.getElementById('okr-gcal-host'); return { aba: (h.querySelector('.mgc-aba.on') || {}).dataset?.aba, txt: h.innerText, origens: [...h.querySelectorAll('.mgc-origem')].map(e => e.textContent) }; });
    let s = await st();
    t('R1. ?gantt=digital abre a consolidada no Radar', s.aba === 'digital' && s.origens.length === 3, s);
    t('R2. blocos e avisos por origem (Outlet não publicado)', /AÇÃO SITE LONGA/.test(s.txt) && /CUPOM AMAZON/.test(s.txt) && /Outlet ainda não foi publicado/.test(s.txt), s.txt.slice(0, 300));
    await p.click('.mgc-dhd.is-clic[data-dia="2026-11-13"]'); await p.waitForTimeout(200);
    let dia = await p.evaluate(() => (document.querySelector('.mgc-dia') || {}).innerText || '');
    t('R3. painel do dia no Radar (mesma doDia do módulo)', /3 ações/.test(dia) && /CRM DO DIA/.test(dia) && /10\/11 – 14\/11/.test(dia), dia);
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    t('R4. Esc fecha o painel do dia', await p.evaluate(() => !document.querySelector('.mgc-dia')));
    t('R5. destaque ⚠️ do Marketplace no Radar', await p.evaluate(() => { const x = document.querySelector('.mgc-bar[data-cal="mktplace"][data-id="h1"]'); return !!x && x.classList.contains('is-alerta'); }));
    t('R6. XSS escapado no Radar', await p.evaluate(() => !window.__xss && !document.querySelector('#okr-gcal-host img')));
    t('R7. sem erro de JS (Radar)', errs.length === 0, errs);
    await ctx.close(); }

  // ── 390 px × 3 temas (Maré e Radar) ────────────────────────────────
  for (const tema of ['dark', 'light', 'vice']) {
    { const { ctx, p, errs } = await abre(KAN, '?squad=' + SQ, { width: 390, height: 820 }, tema);
      await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); toggleGanttView(); ganttAba('digital'); }); await p.waitForTimeout(300);
      await p.evaluate(() => ganttDia('2026-11-13')); await p.waitForTimeout(200);
      const m = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, dia: !!document.getElementById('gantt-dia'), alvo: document.querySelector('.gantt-day-hd.is-clic').getBoundingClientRect().height }));
      t(`P. Maré 390 ${tema}: sem rolagem lateral, painel aberto, dia ≥ 44 px`, m.over <= 0 && m.dia && m.alvo >= 43.5, m);
      if (cap) { fs.mkdirSync(cap, { recursive: true }); await p.evaluate(() => document.getElementById('gantt-dia').scrollIntoView()); await p.screenshot({ path: path.join(cap, `mare_digital_390_${tema}.png`) }); }
      t(`P. Maré 390 ${tema}: sem erro de JS`, errs.length === 0, errs); await ctx.close(); }
    { const { ctx, p, errs } = await abre(OKR, '?gantt=digital', { width: 390, height: 820 }, tema);
      await p.click('.mgc-dhd.is-clic[data-dia="2026-11-13"]'); await p.waitForTimeout(200);
      const m = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, dia: !!document.querySelector('.mgc-dia'), abas: (() => { const a = document.querySelector('.mgc-abas'); return a.scrollWidth - a.clientWidth; })() }));
      t(`Q. Radar 390 ${tema}: sem rolagem lateral, painel aberto`, m.over <= 0 && m.dia, m);
      t(`Q2. Radar 390 ${tema}: título de cada bloco visível com a régua rolada até hoje`, await p.evaluate(() => { const sc = document.querySelector('.mgc-scroll'), r = sc.getBoundingClientRect(); return sc.scrollLeft > 0 && [...document.querySelectorAll('.mgc-origem>span')].every(e => { const b = e.getBoundingClientRect(); return b.left >= r.left - 1 && b.right <= r.right + 1 && b.width > 20; }); }));
      if (cap) { await p.evaluate(() => document.querySelector('.mgc-dia').scrollIntoView()); await p.screenshot({ path: path.join(cap, `radar_digital_390_${tema}.png`) }); }
      t(`Q. Radar 390 ${tema}: sem erro de JS`, errs.length === 0, errs); await ctx.close(); }
  }
  if (cap) { const { ctx, p } = await abre(KAN, '?squad=' + SQ, { width: 1280, height: 900 });
    await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); toggleGanttView(); ganttAba('digital'); ganttDia('2026-11-13'); }); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(cap, 'mare_digital_1280.png'), fullPage: true }); await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1);
})();
function document_has_empty_global(txt) { return /Nada do .* nestas 6 semanas — use/.test(txt); }
