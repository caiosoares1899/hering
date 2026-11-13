// 📊 Radar → Calendário → 📊 Gantt (13/11/2026): os calendários do Maré (Marca, Comercial Hering, Marketplace, Outlet) no Radar,
// só leitura, pelo módulo mare-gcal-dev.js; link direto okr-dev.html?gantt=<aba>. Pessoa SEM squad no Maré (o líder que só usa o Radar).
// Servir a raiz em BASE_URL (padrão http://127.0.0.1:8949); node docs/arezzo/testes/test_radar_gantt.js (CAPTURE_DIR grava capturas)
const fs = require('node:fs'); const path = require('node:path'); const home = require('node:os').homedir();
const pwPath = process.env.PLAYWRIGHT_MODULE || (fs.existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const { chromium } = require(pwPath); const fake = require('./fakefb');
function resolveChrome() { if (process.env.CHROME) return process.env.CHROME; if (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) return '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const r = path.join(home, 'hering-tools/chrome'); const arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-')); return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'); }
const base = process.env.BASE_URL || 'http://127.0.0.1:8949'; const cap = process.env.CAPTURE_DIR || ''; const FIXO = '2026-11-12T13:00:00';
const LIDER = { uid: 'lider', nome: 'Lia Líder', email: 'lia@ciahering.com.br', init: 'LL', role: 'membro' };
const meta = { atualizadoEm: Date.parse('2026-11-13T14:32:00'), porNome: '<b>Caio</b>', arquivo: 'x.xlsx' };
const seed = () => ({ kanban: {
  okr: { objetivos: {}, marcos: {}, tags: {} },
  config: { adm_emails: ['adm@ciahering.com.br'] },
  usuarios: { lider: Object.assign({ inscrito: true }, LIDER) },
  usuarios_publicos: { lider: { uid: 'lider', nome: LIDER.nome, init: 'LL' } },
  calendarios_gantt_dev: {
    comercial: { meta, linhas: { lancamentos: { rot: 'Lançamentos e datas', ordem: 0 }, site: { rot: 'Site todo (não remarcados)', ordem: 1 }, crm: { rot: 'CRM', ordem: 6 }, app: { rot: 'Ação App', ordem: 7 } },
      barras: { b1: { linha: 'site', ini: '2026-11-09', fim: '2026-11-14', txt: 'AÇÃO SITE TESTE' }, b2: { linha: 'crm', ini: '2026-11-11', fim: '2026-11-12', txt: '<img src=x onerror=window.__xss=1>CRM' },
        b3: { linha: 'app', ini: '2026-11-12', fim: '2026-11-12', txt: 'APP TESTE' }, b4: { linha: 'lancamentos', ini: '2026-03-02', fim: '2026-03-04', txt: 'LANÇAMENTO MARÇO' } } },
    marca: { meta, linhas: { web: { rot: 'Web', ordem: 1 }, kids_web: { rot: 'Kids · Web', ordem: 5 } },
      barras: { m1: { linha: 'web', ini: '2026-10-31', fim: '2026-11-30', txt: 'BLACK FRIDAY' }, m2: { linha: 'kids_web', ini: '2026-11-10', fim: '2026-11-17', txt: 'KIDS NATAL' } } },
    outlet: { meta, linhas: { out_acao_principal: { rot: 'Ação principal', ordem: 0 }, out_crm: { rot: 'CRM', ordem: 4 } },
      barras: { o1: { linha: 'out_acao_principal', ini: '2026-11-10', fim: '2026-11-12', txt: 'OUTLET PRINCIPAL' }, o2: { linha: 'out_crm', ini: '2026-11-11', fim: '2026-11-11', txt: 'OUTLET CRM' } } },
  },
  gantt_destaques_dev: { comercial: { b3: { cor: 'red', alerta: true, porNome: 'Ana', em: 1 } } },
} });

(async () => {
  const b = await chromium.launch({ executablePath: resolveChrome(), headless: true }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d ?? null).slice(0, 400))); };
  const abre = async (vp, qs, user, tema) => {
    const ctx = await b.newContext({ viewport: vp, hasTouch: vp.width < 1000, isMobile: vp.width < 1000 }); await fake.install(ctx, seed());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(([f, tm]) => { const R = Date; const fixed = new R(f).getTime(); class D extends R { constructor(...a) { if (!a.length) super(fixed); else super(...a); } static now() { return fixed; } } window.Date = D;
      try { localStorage.clear(); if (tm) localStorage.setItem('theme', tm); } catch (e) {} }, [FIXO, tema || '']);
    await p.goto(base + '/okr-dev.html' + (qs || '')); await p.waitForFunction(() => !!window.__authCb);
    const u = user || LIDER; await p.evaluate(x => window.__authCb(x), { uid: u.uid, email: u.email, displayName: u.nome, photoURL: '', providerData: [{ providerId: u.prov || 'google.com' }] });
    await p.waitForTimeout(2600);
    if (tema) await p.evaluate(tm => { if (tm === 'dark') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', tm); }, tema);
    return { ctx, p, errs };
  };

  // 1. link direto, desktop
  { const { ctx, p, errs } = await abre({ width: 1280, height: 900 }, '?gantt=outlet');
    const st = () => p.evaluate(() => ({ cal: document.getElementById('okr-cal-wrap')?.style.display !== 'none', vista: _okrCalVista, host: !document.getElementById('okr-gcal-host').hidden,
      aba: document.querySelector('.mgc-aba.on')?.dataset.aba, txt: document.getElementById('okr-gcal-host').innerText }));
    let s = await st();
    t('A. ?gantt=outlet abre Calendário → 📊 Gantt na aba Outlet (pessoa sem squad no Maré)', s.cal && s.vista === 'gantt' && s.host && s.aba === 'outlet' && /OUTLET PRINCIPAL/.test(s.txt), s);
    t('B. 5 abas: Marca, Comercial Hering, Marketplace, Outlet e 🧭 Digital', await p.evaluate(() => [...document.querySelectorAll('.mgc-aba')].map(x => x.dataset.aba).join()) === 'marca,comercial,mktplace,outlet,digital');
    t('C. botão 📊 Gantt marcado no seletor Mês · Agenda · Gantt', await p.evaluate(() => { const bs = [...document.querySelectorAll('.okr-cal-seg button')]; return bs.length === 3 && bs[2].classList.contains('on') && /Gantt/.test(bs[2].textContent); }));
    t('D. Outlet filtra por grupo (chips Tudo + 7)', await p.evaluate(() => document.querySelectorAll('.mgc-chip').length === 8));
    await p.click('.mgc-aba[data-aba="comercial"]'); await p.waitForTimeout(200);
    s = await st();
    t('E. trocar para Comercial Hering: barras, "Site e App" renomeado e o rodapé com data/hora', s.aba === 'comercial' && /AÇÃO SITE TESTE/.test(s.txt) && /Site e App · todo/.test(s.txt) && /atualizado em 13\/11\/2026 às 14:32/.test(s.txt), s.txt.slice(0, 300));
    t('F. texto do banco escapado (barra e "por <b>Caio</b>"), nada executa', await p.evaluate(() => !window.__xss && !document.querySelector('#okr-gcal-host img') && /por <b>Caio<\/b>/.test(document.getElementById('okr-gcal-host').innerText)));
    t('G. destaque do ADM aparece (⚠️ na barra APP TESTE)', await p.evaluate(() => { const x = [...document.querySelectorAll('.mgc-bar')].find(e => /APP TESTE/.test(e.textContent)); return !!x && x.classList.contains('is-alerta'); }));
    await p.evaluate(() => [...document.querySelectorAll('.mgc-bar')].find(e => /APP TESTE/.test(e.textContent)).click()); await p.waitForTimeout(100);
    t('H. tocar na barra mostra o texto inteiro, período e linha', /⚠️ Importante · APP TESTE · 12\/11 · Ação App/.test(await p.textContent('.mgc-det')), await p.textContent('.mgc-det'));
    await p.selectOption('.mgc-mes', '2026-03'); await p.waitForTimeout(200);
    t('I. 📆 Mês leva a régua a março (e mostra a barra de março)', await p.evaluate(() => !!document.querySelector('.mgc-dhd[data-date="2026-03-01"]') && /LANÇAMENTO MARÇO/.test(document.getElementById('okr-gcal-host').innerText) && document.querySelector('.mgc-mes').value === '2026-03'));
    await p.click('.mgc-btn[data-nav="0"]'); await p.waitForTimeout(150);
    t('J. Hoje volta para a janela de hoje e limpa o Mês', await p.evaluate(() => !!document.querySelector('.mgc-dhd.is-hoje[data-date="2026-11-12"]') && document.querySelector('.mgc-mes').value === ''));
    await p.click('.mgc-btn[data-nav="28"]'); await p.waitForTimeout(150);
    t('K. ▶ avança 4 semanas', await p.evaluate(() => !document.querySelector('.mgc-dhd[data-date="2026-11-01"]') && !!document.querySelector('.mgc-dhd[data-date="2026-12-10"]')));
    await p.click('.mgc-btn[data-nav="0"]');
    await p.click('.mgc-chip[data-g="crm"]'); await p.waitForTimeout(150);
    t('L. chip ✉️ CRM mostra só a linha de CRM', await p.evaluate(() => { const x = document.getElementById('okr-gcal-host').innerText; return /CRM/.test(x) && !/AÇÃO SITE TESTE/.test(x) && /Mostrando só/.test(x); }));
    await p.click('.mgc-chip[data-g=""]');
    t('M. redesenhos da agenda não derrubam o Gantt (mesmo visualizador, aba mantida)', await p.evaluate(() => { const g = _okrGcal; renderOkrCalendario(); renderOkrCalendario(); return _okrGcal === g && !!document.querySelector('.mgc-scroll') && document.querySelector('.mgc-aba.on').dataset.aba === 'comercial'; }));
    await p.click('.mgc-aba[data-aba="marca"]'); await p.waitForTimeout(150);
    t('N. Marca: bloco 👶 Hering Kids separado, dia estreito (não largo)', await p.evaluate(() => /Hering Kids/.test(document.getElementById('okr-gcal-host').innerText) && !document.getElementById('okr-gcal-host').classList.contains('is-largo')));
    const xs = await p.evaluate(() => { const sc = document.querySelector('.mgc-scroll'); sc.scrollLeft = 100; renderOkrCalendario(); return document.querySelector('.mgc-scroll').scrollLeft; });
    t('M2. redesenho da agenda com o Gantt aberto mantém a rolagem de quem está lendo', xs === 100, xs);
    await p.evaluate(() => _okrCalSetVista('mes')); await p.waitForTimeout(150);
    t('O. voltar para Mês esconde o Gantt e mostra a grade do mês', await p.evaluate(() => document.getElementById('okr-gcal-host').hidden && !!document.querySelector('.okr-cal-grid')));
    await p.evaluate(() => { _okrCalSetVista('gantt'); }); await p.waitForTimeout(150);
    t('O2. voltar ao Gantt rola até hoje de novo', await p.evaluate(() => { const sc = document.querySelector('.mgc-scroll'); return !document.getElementById('okr-gcal-host').hidden && sc.scrollLeft > 0 && sc.scrollLeft !== 100; }));
    await p.evaluate(() => _okrCalSetVista('mes'));
    t('P. a vista escolhida e a aba ficam salvas', await p.evaluate(() => localStorage.getItem('okr_cal_vista') === 'mes' && localStorage.getItem('okr_gcal_aba') === 'marca'));
    t('Q. lê os nós _dev (calendarios_gantt_dev)', await p.evaluate(() => (window.MareGCal && MareGCal.CALS.length === 4)));
    t('R. sem erro de JS (desktop)', errs.length === 0, errs);
    await ctx.close(); }

  // 2. quem não pode ler: login sem Google → sem botão e link avisa
  { const { ctx, p, errs } = await abre({ width: 1280, height: 900 }, '?gantt=comercial', Object.assign({}, LIDER, { prov: 'password' }));
    t('S. login sem Google da Hering: link não abre o Gantt e o seletor não tem 📊 Gantt', await p.evaluate(() => { _okrSetView('calendario'); return _okrCalVista !== 'gantt' && ![...document.querySelectorAll('.okr-cal-seg button')].some(b => /Gantt/.test(b.textContent)) && !window.MareGCal; }));
    t('T. sem erro de JS (sem acesso)', errs.length === 0, errs);
    await ctx.close(); }

  // 3. celular 390, três temas
  for (const tema of ['dark', 'light', 'vice']) {
    const { ctx, p, errs } = await abre({ width: 390, height: 800 }, '?gantt=comercial', null, tema);
    const m = await p.evaluate(() => { const h = document.getElementById('okr-gcal-host'), sc = h.querySelector('.mgc-scroll');
      const toques = [...h.querySelectorAll('.mgc-aba,.mgc-btn,.mgc-chip,.mgc-mes')].filter(e => e.getBoundingClientRect().height < 43.5).length;
      return { over: document.documentElement.scrollWidth - innerWidth, rola: sc && sc.scrollWidth > sc.clientWidth, hoje: sc && sc.scrollLeft > 0, toques, bars: h.querySelectorAll('.mgc-bar').length }; });
    t(`U. 390 ${tema}: sem rolagem lateral da página; régua rola dentro e começa perto de hoje`, m.over <= 0 && m.rola && m.hoje && m.bars >= 3, m);
    t(`V. 390 ${tema}: alvos de toque ≥ 44 px`, m.toques === 0, m);
    t(`V2. 390 ${tema}: abas com rótulo curto e a aba ativa inteira à vista (a lista rola de lado)`, await p.evaluate(() => { const a = document.querySelector('.mgc-abas'), on = a.querySelector('.mgc-aba.on').getBoundingClientRect(), r = a.getBoundingClientRect(); return getComputedStyle(document.querySelector('.mgc-aba-c')).display !== 'none' && on.left >= r.left - 1 && on.right <= r.right + 1; }));
    await p.evaluate(() => _okrGcal.aba('digital')); await p.waitForTimeout(150);
    t(`V3. 390 ${tema}: a 5ª aba (🧭 Digital) ativa fica à vista`, await p.evaluate(() => { const a = document.querySelector('.mgc-abas'), on = a.querySelector('.mgc-aba.on').getBoundingClientRect(), r = a.getBoundingClientRect(); return on.left >= r.left - 1 && on.right <= r.right + 1; }));
    if (tema === 'light') t('V3. tema claro: aba e chip ativos com texto branco', await p.evaluate(() => getComputedStyle(document.querySelector('.mgc-aba.on')).color === 'rgb(255, 255, 255)' && getComputedStyle(document.querySelector('.mgc-chip.on')).color === 'rgb(255, 255, 255)'));
    if (cap) { fs.mkdirSync(cap, { recursive: true }); await p.evaluate(() => { document.querySelectorAll('.dica-pop,[class*="dica"]').forEach(e => { if (e.getBoundingClientRect().height < 300 && /Dica/.test(e.textContent)) e.style.display = 'none'; }); document.getElementById('okr-gcal-host').scrollIntoView(); }); await p.screenshot({ path: path.join(cap, `radar_gantt_390_${tema}.png`), fullPage: false }); }
    t(`W. 390 ${tema}: sem erro de JS`, errs.length === 0, errs);
    await ctx.close();
  }
  if (cap) { const { ctx, p } = await abre({ width: 1280, height: 900 }, '?gantt=comercial'); await p.screenshot({ path: path.join(cap, 'radar_gantt_1280.png') }); await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1);
})();
