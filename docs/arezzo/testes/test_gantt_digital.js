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
    t('M8. tocar no dia 13 abre "tudo deste dia": ação de vários dias + do dia, por origem', /3 ações/.test(dia) && /AÇÃO SITE LONGA/.test(dia) && /10\/11 – 14\/11/.test(dia) && /CRM DO DIA/.test(dia) && /CUPOM AMAZON/.test(dia) && /ainda não publicado/i.test(dia), dia);
    t('M8b. 📅 popup junto do dia clicado (no <body>, fixo, logo abaixo/acima do dia, inteiro na tela)', await p.evaluate(() => { const d = document.getElementById('gantt-dia'), SEL = '.gantt-day-hd[data-date="2026-11-13"]'; if (!d) return false; const r = d.getBoundingClientRect(), a = document.querySelector(SEL).getBoundingClientRect(); return { corpo: d.parentElement === document.body, fixo: getComputedStyle(d).position === 'fixed', perto: (Math.abs(r.top - a.bottom) <= 16 || Math.abs(r.bottom - a.top) <= 16), naTela: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, cobreX: r.left <= a.right && r.right >= a.left }; }).then(x => x && x.corpo && x.fixo && x.perto && x.naTela && x.cobreX), await p.evaluate(() => { const d = document.getElementById('gantt-dia'); return d && d.getBoundingClientRect().toJSON(); }));
    // 📅 /melhoriauiux 16/11: calendário → linha (cor da régua, nome uma vez) → itens com o "quando"; ⚠️ como na régua; vazio compacto
    const est = await p.evaluate(() => { const d = document.getElementById('gantt-dia'); const q = t => [...d.querySelectorAll('.mgc-dia-it')].find(li => li.textContent.includes(t));
      return { fontes: [...d.querySelectorAll('.mgc-dia-fonte')].map(h => h.innerText.replace(/\s+/g, ' ')), linhas: [...d.querySelectorAll('.mgc-dia-lrot')].map(x => x.textContent),
        cores: [...d.querySelectorAll('.mgc-dia-lrot i')].every(i => /rgb/.test(getComputedStyle(i).backgroundColor) && getComputedStyle(i).backgroundColor !== 'rgba(0, 0, 0, 0)'),
        qSite: (q('AÇÃO SITE LONGA') || {}).querySelector?.('.mgc-dia-q').textContent, qCrm: (q('CRM DO DIA') || {}).querySelector?.('.mgc-dia-q').textContent,
        alerta: (() => { const li = q('CUPOM AMAZON'); return !!li && li.classList.contains('is-alerta') && /⚠️/.test(li.textContent); })(),
        vazio: [...d.querySelectorAll('.mgc-dia-vz')].map(x => x.innerText.replace(/\s+/g, ' ')), sub: d.querySelector('.mgc-dia-tit span').textContent,
        fixo: getComputedStyle(d.querySelector('.mgc-dia-hd')).position }; });
    t('M8c. hierarquia: 2 calendários com ações (título + total), linha uma vez com a bolinha da cor da régua', est.fontes.length === 2 && /COMERCIAL HERING 2/i.test(est.fontes[0]) && est.linhas.length === 3 && est.cores, est);
    t('M8d. "quando" de cada item: período (10/11 – 14/11) e Só hoje', est.qSite === '10/11 – 14/11' && est.qCrm === 'Só hoje', est);
    t('M8e. ⚠️ ação importante aparece no popup (como na régua)', est.alerta, est);
    t('M8f. calendário sem nada vira linha compacta no fim; subtítulo conta ações e calendários; cabeçalho fixo', est.vazio.length === 1 && /Outlet.*ainda não publicado/i.test(est.vazio[0]) && est.sub === '3 ações em 2 calendários' && est.fixo === 'sticky', est);
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
    t('M12a. Esc devolve o foco ao dia', await p.evaluate(() => !!document.activeElement && document.activeElement.matches('.gantt-day-hd[data-date="2026-11-13"]')));
    // clique fora fecha; outro dia troca o popup de lugar (sem fechar e reabrir no mesmo)
    await p.click('.gantt-day-hd.is-clic[data-date="2026-11-13"]'); await p.waitForTimeout(200);
    await p.click('.gantt-day-hd.is-clic[data-date="2026-11-12"]'); await p.waitForTimeout(200);
    t('M12b. tocar em outro dia leva o popup para ele', await p.evaluate(() => { const d = document.getElementById('gantt-dia'); return !!d && document.querySelectorAll('#gantt-dia').length === 1 && /12\/11/.test(d.innerText) && document.querySelector('.gantt-day-hd[data-date="2026-11-12"]').getAttribute('aria-pressed') === 'true'; }));
    await p.mouse.click(640, 880); await p.waitForTimeout(200);
    t('M12c. clique fora fecha o popup', await p.evaluate(() => !document.getElementById('gantt-dia') && !_ganttDia && !document.querySelector('.gantt-day-hd[aria-pressed="true"]')));
    await p.click('.gantt-day-hd.is-clic[data-date="2026-11-13"]'); await p.waitForTimeout(200);
    await p.click('#gantt-dia [data-dia-fechar]'); await p.waitForTimeout(200);
    t('M12d. ✕ fecha o popup', await p.evaluate(() => !document.getElementById('gantt-dia') && !_ganttDia));
    await p.click('.gantt-day-hd.is-clic[data-date="2026-11-13"]'); await p.waitForTimeout(200);
    await p.evaluate(() => toggleGanttView()); await p.waitForTimeout(200);
    t('M12e. sair do Gantt não deixa o popup sobrando no Kanban', await p.evaluate(() => boardView !== 'gantt' && !document.getElementById('gantt-dia') && !document.querySelector('.mgc-diapop')));
    await p.evaluate(() => toggleGanttView()); await p.waitForTimeout(250);
    t('M12f. voltar ao Gantt não reabre o popup sozinho', await p.evaluate(() => !document.getElementById('gantt-dia')));
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
    t('R3b. 📅 popup junto do dia no Radar (no <body>, fixo, inteiro na tela) e foco no ✕', await p.evaluate(() => { const d = document.querySelector('.mgc-dia'), SEL = '.mgc-dhd[data-dia="2026-11-13"]'; if (!d) return false; const r = d.getBoundingClientRect(), a = document.querySelector(SEL).getBoundingClientRect(); return { corpo: d.parentElement === document.body, fixo: getComputedStyle(d).position === 'fixed', perto: (Math.abs(r.top - a.bottom) <= 16 || Math.abs(r.bottom - a.top) <= 16), naTela: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, cobreX: r.left <= a.right && r.right >= a.left }; }).then(x => x && x.corpo && x.fixo && x.perto && x.naTela && x.cobreX) && await p.evaluate(() => !!document.activeElement && !!document.activeElement.closest('.mgc-dia')));
    await p.click('.mgc-dia [data-dia-fechar]'); await p.waitForTimeout(150);
    t('R3c. ✕ fecha o popup no Radar e devolve o foco ao dia', await p.evaluate(() => !document.querySelector('.mgc-dia') && document.activeElement && document.activeElement.matches('.mgc-dhd[data-dia="2026-11-13"]')));
    await p.click('.mgc-dhd.is-clic[data-dia="2026-11-13"]'); await p.waitForTimeout(150);
    await p.mouse.click(640, 880); await p.waitForTimeout(150);
    t('R3d. clique fora fecha o popup no Radar', await p.evaluate(() => !document.querySelector('.mgc-dia') && !document.querySelector('.mgc-dhd[aria-pressed="true"]')));
    await p.click('.mgc-dhd.is-clic[data-dia="2026-11-13"]'); await p.waitForTimeout(150);
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
      const m = await p.evaluate(() => { const d = document.getElementById('gantt-dia'), r = d && d.getBoundingClientRect(); return { over: document.documentElement.scrollWidth - innerWidth, dia: !!d, alvo: document.querySelector('.gantt-day-hd.is-clic').getBoundingClientRect().height, folha: !!r && r.left >= 11 && innerWidth - r.right >= 11 && innerHeight - r.bottom <= 14 && r.top >= 0, btn: d && d.querySelector('[data-dia-fechar]').getBoundingClientRect().height }; });
      t(`P. Maré 390 ${tema}: sem rolagem lateral, painel aberto, dia ≥ 44 px`, m.over <= 0 && m.dia && m.alvo >= 43.5, m);
      t(`P. Maré 390 ${tema}: popup vira folha embaixo (12 px das bordas) e ✕ ≥ 44 px`, m.folha && m.btn >= 43.5, m);
      if (cap) { fs.mkdirSync(cap, { recursive: true }); await p.evaluate(() => document.getElementById('gantt-dia').scrollIntoView()); await p.screenshot({ path: path.join(cap, `mare_digital_390_${tema}.png`) }); }
      t(`P. Maré 390 ${tema}: sem erro de JS`, errs.length === 0, errs); await ctx.close(); }
    { const { ctx, p, errs } = await abre(OKR, '?gantt=digital', { width: 390, height: 820 }, tema);
      await p.click('.mgc-dhd.is-clic[data-dia="2026-11-13"]'); await p.waitForTimeout(200);
      const m = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, dia: !!document.querySelector('.mgc-dia'), abas: (() => { const a = document.querySelector('.mgc-abas'); return a.scrollWidth - a.clientWidth; })() }));
      t(`Q. Radar 390 ${tema}: sem rolagem lateral, painel aberto`, m.over <= 0 && m.dia, m);
      t(`Q. Radar 390 ${tema}: popup vira folha embaixo`, await p.evaluate(() => { const r = document.querySelector('.mgc-dia').getBoundingClientRect(); return r.left >= 11 && innerWidth - r.right >= 11 && innerHeight - r.bottom <= 14 && r.top >= 0; }));
      t(`Q2. Radar 390 ${tema}: título de cada bloco visível com a régua rolada até hoje`, await p.evaluate(() => { const sc = document.querySelector('.mgc-scroll'), r = sc.getBoundingClientRect(); return sc.scrollLeft > 0 && [...document.querySelectorAll('.mgc-origem>span')].every(e => { const b = e.getBoundingClientRect(); return b.left >= r.left - 1 && b.right <= r.right + 1 && b.width > 20; }); }));
      if (cap) { await p.evaluate(() => document.querySelector('.mgc-dia').scrollIntoView()); await p.screenshot({ path: path.join(cap, `radar_digital_390_${tema}.png`) }); }
      t(`Q. Radar 390 ${tema}: sem erro de JS`, errs.length === 0, errs); await ctx.close(); }
  }
  if (cap) { const { ctx, p } = await abre(KAN, '?squad=' + SQ, { width: 1280, height: 900 });
    await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); toggleGanttView(); ganttAba('digital'); ganttDia('2026-11-13'); }); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(cap, 'mare_digital_1280.png') }); await ctx.close();
    for (const tema of ['dark', 'light', 'vice']) { const { ctx: c2, p: p2 } = await abre(OKR, '?gantt=digital', { width: 1280, height: 900 }, tema);
      await p2.click('.mgc-dhd.is-clic[data-dia="2026-11-13"]'); await p2.waitForTimeout(250);
      await p2.screenshot({ path: path.join(cap, `radar_digital_1280_${tema}.png`) }); await c2.close(); } }
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1);
})();
function document_has_empty_global(txt) { return /Nada do .* nestas 6 semanas — use/.test(txt); }
