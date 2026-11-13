// 📊 Gantt do Maré → abas "🎯 Calendário de Marca" e "🛒 Comercial Digital" (13/11/2026): lidas de kanban/calendarios_gantt_dev
// só quando a aba abre; uma faixa por linha da planilha, barras que se cruzam em pistas; De/Até vale; texto da planilha escapado.
// Servir a raiz em BASE_URL; node docs/arezzo/testes/test_gantt_calendarios.js   (CAPTURE_DIR grava capturas)
const fs = require('node:fs'); const path = require('node:path'); const home = require('node:os').homedir();
const pwPath = process.env.PLAYWRIGHT_MODULE || (fs.existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const { chromium } = require(pwPath); const fake = require('./fakefb');
function resolveChrome() { if (process.env.CHROME) return process.env.CHROME; if (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) return '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const r = path.join(home, 'hering-tools/chrome'); const arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-')); return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'); }
const base = process.env.BASE_URL || 'http://127.0.0.1:8949'; const K = process.env.K || 'kanban-dev'; const NO = 'calendarios_gantt' + (K.endsWith('-dev') ? '_dev' : '');
const SQ = 'site'; const cap = process.env.CAPTURE_DIR || '';
const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana', photoURL: '', providerData: [{ providerId: 'google.com' }] };
// "Hoje" fixo: 12/11/2026 (quinta) → janela de 6 semanas 01/11 – 12/12
const FIXO = '2026-11-12T13:00:00';
const marca = { meta: { atualizadoEm: Date.UTC(2026, 10, 10, 15), porNome: 'Caio', arquivo: 'Calendário de Campanhas 2026.xlsx', de: '2026-01-01', ate: '2026-12-31' },
  linhas: { sellout: { rot: 'Coleção sellout', ordem: 0 }, web: { rot: 'Web', ordem: 1 }, redes: { rot: 'Redes sociais', ordem: 2 } },
  barras: {
    b_s1: { linha: 'sellout', ini: '2026-07-16', fim: '2026-11-04', txt: 'COLEÇÃO TESTE A' },
    b_s2: { linha: 'sellout', ini: '2026-11-05', fim: '2026-12-31', txt: 'COLEÇÃO TESTE B' },
    b_w1: { linha: 'web', ini: '2026-10-31', fim: '2026-11-30', txt: 'BLACK FRIDAY' },
    b_w2: { linha: 'web', ini: '2026-12-01', fim: '2026-12-31', txt: 'NATAL' },
    b_w3: { linha: 'web', ini: '2026-04-16', fim: '2026-05-10', txt: 'DIA DAS MÃES (fora da janela)' },
    b_r1: { linha: 'redes', ini: '2026-11-10', fim: '2026-11-17', txt: '<img src=x onerror="window.__xss=1"> CAMPANHA TESTE' },
    b_r2: { linha: 'redes', ini: '2026-11-15', fim: '2026-11-18', txt: 'TEASER TESTE (cruza com a campanha)' },
    b_r3: { linha: 'redes', ini: '2026-11-27', fim: '2026-11-29', txt: 'BLACK FRIDAY' },
    b_k1: { linha: 'kids_web', ini: '2026-11-01', fim: '2026-12-01', txt: 'BLACK FRIDAY KIDS' },
  } };
marca.linhas.kids_web = { rot: 'Kids · Web', ordem: 101 };
const comercial = { meta: { atualizadoEm: Date.UTC(2026, 10, 10, 15), porNome: 'Caio', arquivo: 'Calendário Comercial.xlsx', de: '2026-11-01', ate: '2026-11-30' },
  linhas: { saldos: { rot: 'Site · Saldos', ordem: 2 } },
  barras: { b_c1: { linha: 'saldos', ini: '2026-11-02', fim: '2026-11-13', txt: 'OFERTA FICTÍCIA COM UM TÍTULO BEM COMPRIDO QUE PRECISA APARECER INTEIRO, QUEBRANDO EM VÁRIAS LINHAS COMO NO EXCEL' },
    b_c2: { linha: 'saldos', ini: '2026-11-12', fim: '2026-11-12', txt: 'AÇÃO DE UM DIA COM TEXTO LONGO PARA QUEBRAR LINHA' } } };
const mktplace = { meta: { atualizadoEm: Date.UTC(2026, 10, 10, 15), porNome: 'Caio', arquivo: 'Calendário Mktplace.xlsx', de: '2026-10-01', ate: '2026-11-30' },
  linhas: { mkt_amazon: { rot: 'Amazon', ordem: 0 }, mkt_shopee: { rot: 'Shopee', ordem: 2 }, mkt_meli: { rot: 'Mercado Livre (Meli + Full)', ordem: 3 } },
  barras: { b_m1: { linha: 'mkt_amazon', ini: '2026-11-03', fim: '2026-11-30', txt: 'OFERTA DESTAQUE TESTE COM UM TEXTO LONGO PARA QUEBRAR EM VÁRIAS LINHAS NA BARRA' },
    b_m2: { linha: 'mkt_shopee', ini: '2026-11-01', fim: '2026-11-30', txt: 'KITS TESTE' }, b_m3: { linha: 'mkt_meli', ini: '2026-11-05', fim: '2026-11-05', txt: 'ENVIO FULL TESTE' } } };
const fl = col => ({ enteredAt: { [col]: '2026-10-20T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-10-20T12:00:00.000Z' }] });
const seed = comCal => ({ kanban: Object.assign({
  usuarios: { ana: { uid: 'ana', nome: 'Ana', email: U.email, inscrito: true, init: 'AA', role: 'membro', squads: { [SQ]: true } } }, usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana', init: 'AA', squads: { [SQ]: true } } },
  squads: { [SQ]: { dados: { columns: [{ id: 'doing', name: 'Fazendo' }, { id: 'done', name: 'Concluído', isDone: true }], tags: [],
    cards_index: { c1: 'k1' }, cards: { k1: { id: 'c1', title: 'Card com período', col: 'doing', owner: 'AA', createdAt: '2026-10-20', flow: fl('doing'), inicio: '2026-11-09', fim: '2026-11-13', updatedAt: '2026-10-27T10:00:00.000Z' } } } } } },
  comCal ? { [NO]: { marca, comercial, mktplace } } : {}) });

(async () => {
  const b = await chromium.launch({ executablePath: resolveChrome(), headless: true }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 400))); };
  const abre = async (vp, comCal = true, antes) => {
    const ctx = await b.newContext({ viewport: vp, hasTouch: vp.width < 1000, isMobile: vp.width < 1000 }); await fake.install(ctx, seed(comCal));
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(f => { const R = Date; const fixed = new R(f).getTime(); class D extends R { constructor(...a) { if (!a.length) super(fixed); else super(...a); } static now() { return fixed; } } window.Date = D; try { localStorage.removeItem('mare_gantt_aba'); } catch (e) {} }, FIXO);
    if (antes) await p.addInitScript(antes);
    await p.goto(base + '/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(2500);
    await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')));
    return { ctx, p, errs };
  };
  const leuCal = p => p.evaluate(n => window.__log.filter(x => String(x[1]).includes(n)).length, NO);

  for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 800 }]) {
    const L = vp.width + 'px'; const { ctx, p, errs } = await abre(vp);
    t(`A ${L}. o calendário NÃO é lido no boot`, await leuCal(p) === 0);
    await p.evaluate(() => toggleGanttView()); await p.waitForTimeout(300);
    t(`B ${L}. Gantt abre na aba "Cards da squad" com 6 abas (5 + 🧭 Digital) e ainda sem ler o calendário`, await p.evaluate(() => [...document.querySelectorAll('.gantt-aba')].map(x => x.dataset.aba + ':' + x.getAttribute('aria-selected')).join() === 'cards:true,marca:false,comercial:false,mktplace:false,outlet:false,digital:false') && await leuCal(p) === 0);
    await p.click('.gantt-aba[data-aba="marca"]'); await p.waitForTimeout(400);
    t(`C ${L}. aba de Marca: lê o nó ${NO}/marca ao abrir`, await leuCal(p) === 1);
    const r = await p.evaluate(() => {
      const grp = [...document.querySelectorAll('.gantt-cal-row.is-1a .gantt-cal-lin')].map(x => x.textContent);
      const bar = re => [...document.querySelectorAll('.gantt-cal-bar')].find(x => re.test(x.querySelector('.gantt-bar-txt').textContent) && (re.source !== '^BLACK FRIDAY$' || /· Web$/.test(x.dataset.tip)));
      const bf = bar(/^BLACK FRIDAY$/); const rd = [...document.querySelectorAll('.gantt-cal-row[data-linha="redes"]')];
      return { grp, nBar: document.querySelectorAll('.gantt-cal-bar').length, bfCol: bf && bf.style.gridColumn, bfClip: bf && bf.className, pistasRedes: rd.length,
        xss: !!document.querySelector('.gantt-cal-bar img'), xssTxt: (bar(/CAMPANHA TESTE/) || {}).textContent, filtrosCards: [...document.querySelectorAll('#gantt-filtros select[data-campo]')].every(x => getComputedStyle(x).display === 'none'),
        deAte: getComputedStyle(document.querySelector('#gantt-filtros .gantt-fdata')).display !== 'none', rodape: document.getElementById('gantt-footer').innerText, sticky: document.querySelector('.gantt-cal-row .gantt-cal-lin').textContent };
    });
    t(`D ${L}. faixas na ordem da planilha, com o bloco 👶 Hering Kids separado (Web do Kids sem o prefixo)`, r.grp.join('|') === 'Coleção sellout|Web|Redes sociais|Web' && await p.evaluate(() => [...document.querySelectorAll('.gantt-cal-bloco .gantt-grp-lbl')].map(x => x.textContent).join('|') === 'Hering|👶 Hering Kids'), r.grp);
    t(`E ${L}. só o que cruza a janela (8 barras; Dia das Mães de maio fica de fora e é contado no rodapé)`, r.nBar === 8 && /1 item em outras semanas/.test(r.rodape), r);
    t(`F ${L}. BLACK FRIDAY da Web começa antes da janela (◂) e vai até 30/11 (coluna 1 → 31)`, r.bfCol === '1 / 31' && /clip-l/.test(r.bfClip), r);
    t(`G ${L}. barras que se cruzam (CAMPANHA × TEASER) vão para pistas diferentes nas Redes`, r.pistasRedes === 2, r.pistasRedes);
    t(`H ${L}. texto da planilha é só texto (sem <img>, nada executa)`, !r.xss && /<img src=x/.test(r.xssTxt) && await p.evaluate(() => !window.__xss), r.xssTxt);
    t(`I ${L}. filtros de card somem; De/Até fica; rodapé diz quando e quem atualizou`, r.filtrosCards && r.deAte && /atualizado em 10\/11\/2026 às \d{2}:\d{2} por Caio/.test(r.rodape), r);
    await p.click('.gantt-cal-bar[data-tip*="BLACK FRIDAY · 31/10"]');
    t(`J ${L}. tocar numa barra mostra o texto inteiro com datas e linha`, await p.evaluate(() => /BLACK FRIDAY · 31\/10 – 30\/11 · Web/.test(document.body.innerText)));
    await p.click('.gantt-cal-bar[data-tip*="CAMPANHA TESTE"]'); await p.waitForTimeout(200);
    t(`J2 ${L}. tocar na barra com HTML no texto: o aviso mostra o texto como texto e nada executa`, await p.evaluate(() => !window.__xss && /<img src=x/.test(document.getElementById('kb-toast').textContent) && !document.querySelector('#kb-toast img')));
    // De/Até: 25/11–30/11 deixa só o que cruza
    await p.evaluate(() => { const f = document.getElementById('gantt-filtros'); f.querySelector('input[data-p="de"]').value = '2026-11-25'; f.querySelector('input[data-p="ate"]').value = '2026-11-30'; ganttPeriodo(); }); await p.waitForTimeout(300);
    const per = await p.evaluate(() => [...document.querySelectorAll('.gantt-cal-bar .gantt-bar-txt')].map(x => x.textContent).sort());
    t(`K ${L}. De/Até 25–30/11: só COLEÇÃO TESTE B, BF da Web, das Redes e do Kids`, per.join('|') === 'BLACK FRIDAY|BLACK FRIDAY|BLACK FRIDAY KIDS|COLEÇÃO TESTE B', per);
    await p.evaluate(() => ganttLimpar()); await p.waitForTimeout(200);
    // a aba sobrevive ao redesenho do board e à volta para o Gantt
    await p.evaluate(() => renderBoard()); await p.waitForTimeout(150);
    t(`L ${L}. a aba escolhida sobrevive ao redesenho (Firebase) e fica guardada no aparelho`, await p.evaluate(() => document.querySelector('.gantt-aba.on').dataset.aba === 'marca' && localStorage.getItem('mare_gantt_aba') === 'marca'));
    t(`M ${L}. sem rolagem lateral da página`, await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
    if (vp.width >= 1000) {
      // teclado: setas trocam de aba e o foco acompanha
      await p.focus('.gantt-aba[data-aba="marca"]'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(300);
      t(`N ${L}. seta → leva para Comercial Digital (foco junto)`, await p.evaluate(() => document.activeElement && document.activeElement.dataset.aba === 'comercial'));
      await p.evaluate(() => ganttNav(0)); await p.waitForTimeout(300);
      const larg = await p.evaluate(() => { const v = document.getElementById('gantt-view'); const d = document.querySelector('.gantt-day-hd').getBoundingClientRect().width;
        const txts = [...document.querySelectorAll('.gantt-cal-bar .gantt-bar-txt')].map(x => ({ cheio: x.scrollWidth <= x.clientWidth + 1 && x.scrollHeight <= x.clientHeight + 1 && getComputedStyle(x).whiteSpace === 'normal', linhas: Math.round(x.getBoundingClientRect().height / parseFloat(getComputedStyle(x).lineHeight)) }));
        return { largo: v.classList.contains('gantt-largo'), dia: d, txts }; });
      t(`N2 ${L}. Comercial "como no Excel": dia largo (≥ 130 px), texto inteiro quebrando linha (nada cortado)`, larg.largo && larg.dia >= 130 && larg.txts.length === 2 && larg.txts.every(x => x.cheio) && larg.txts.some(x => x.linhas >= 2), larg);
      const sticky = await p.evaluate(() => { const sc = document.getElementById('gantt-scroll'); sc.scrollLeft = 900; const b = [...document.querySelectorAll('.gantt-cal-bar')].find(x => /COMPRIDO/.test(x.textContent)); const t = b.querySelector('.gantt-bar-txt').getBoundingClientRect(); const col = document.querySelector('.gantt-cal-row .gantt-col-sticky').getBoundingClientRect(); return { txtL: t.left, colR: col.right }; });
      t(`N3 ${L}. barra que começou fora da tela: o texto acompanha a rolagem e fica logo depois da coluna fixa`, sticky.txtL >= sticky.colR - 1, sticky);
      await p.evaluate(() => ganttAba('marca')); await p.waitForTimeout(200);
      await p.evaluate(() => ganttAba('mktplace')); await p.waitForTimeout(300);
      const mk = await p.evaluate(() => ({ largo: document.getElementById('gantt-view').classList.contains('gantt-largo'), lins: [...document.querySelectorAll('.gantt-cal-lin')].map(x => x.textContent),
        chips: [...document.querySelectorAll('.gantt-cal-fchip')].map(x => x.textContent), cheio: [...document.querySelectorAll('.gantt-cal-bar .gantt-bar-txt')].every(x => getComputedStyle(x).whiteSpace === 'normal') }));
      t(`N5 ${L}. 🛍️ Comercial Marketplace: largo e com texto inteiro como o Hering; uma linha por marketplace; chips por marketplace`, mk.largo && mk.cheio && mk.lins.join('|') === 'Amazon|Shopee|Mercado Livre (Meli + Full)' && mk.chips[0] === 'Tudo' && mk.chips.includes('Amazon') && mk.chips.includes('Mercado Livre'), mk);
      await p.click('.gantt-cal-fchip[data-g="meli"]'); await p.waitForTimeout(250);
      t(`N6 ${L}. filtro "Mercado Livre" mostra só ele`, await p.evaluate(() => [...document.querySelectorAll('.gantt-cal-lin')].map(x => x.textContent).join('|') === 'Mercado Livre (Meli + Full)'));
      await p.evaluate(() => { ganttLimpar(); ganttAba('marca'); }); await p.waitForTimeout(250);
      t(`N4 ${L}. a aba de Marca continua compacta (só os Comerciais alargam)`, await p.evaluate(() => !document.getElementById('gantt-view').classList.contains('gantt-largo')));
      await p.evaluate(() => ganttAba('comercial'));
      await p.click('.gantt-aba[data-aba="cards"]'); await p.evaluate(() => ganttNav(0)); await p.waitForTimeout(300);   // o De/Até do passo K levou a régua para 25/11
      const o = await p.evaluate(() => ({ row: !!document.querySelector('.gantt-row[data-id="c1"]'), cal: document.getElementById('gantt-filtros').classList.contains('is-cal'), aba: document.querySelector('.gantt-aba.on').dataset.aba, vazio: (document.querySelector('.gantt-empty') || {}).textContent }));
      t(`O ${L}. de volta aos cards: o card com período aparece e os filtros de card voltam`, o.row && !o.cal, o);
    } else {
      t(`N ${L}. abas com alvo de toque ≥ 44 px`, await p.evaluate(() => [...document.querySelectorAll('.gantt-aba')].every(x => x.getBoundingClientRect().height >= 44)));
    }
    if (cap) { await p.click('.gantt-aba[data-aba="marca"]').catch(() => {}); await p.waitForTimeout(300); for (const th of ['', 'light', 'vice']) { await p.evaluate(x => document.documentElement.dataset.theme = x, th); await p.waitForTimeout(150); await p.screenshot({ path: path.join(cap, `gantt_cal_${vp.width}_${th || 'dark'}.png`) }); } }
    t(`P ${L}. sem erro de JS`, errs.length === 0, errs);
    await ctx.close();
  }
  { // convidado externo do squad (sem login Google @ciahering): as abas de calendário nem aparecem
    const { ctx, p } = await abre({ width: 1280, height: 900 });
    await p.evaluate(() => { toggleGanttView(); ganttAba('marca'); }); await p.waitForTimeout(300);
    await p.evaluate(() => { window._currentUser = { uid: 'conv', email: 'convidado@gmail.com', providerData: [{ providerId: 'password' }] }; renderBoard(); }); await p.waitForTimeout(300);
    t('R. convidado externo: sem abas de calendário, volta para os cards e não tenta ler outra vez', await p.evaluate(() => !document.querySelector('.gantt-abas') && !document.querySelector('.gantt-cal-row') && !!document.querySelector('.gantt-row[data-id="c1"]')));
    await ctx.close();
  }
  { // permissão negada (regras ainda não publicadas) → mensagem amigável
    const { ctx, p } = await abre({ width: 1280, height: 900 }, false, () => {
      const iv = setInterval(() => { if (window._onValue && !window.__patched) { window.__patched = 1; const orig = window._onValue; window._onValue = (r, cb, err) => (String(r.p || r).includes('calendarios_gantt') ? (setTimeout(() => err && err(new Error('PERMISSION_DENIED: Client doesn\'t have permission')), 0), () => {}) : orig(r, cb, err)); clearInterval(iv); } }, 5);
    });
    await p.evaluate(() => { toggleGanttView(); ganttAba('marca'); }); await p.waitForTimeout(400);
    t('Q. sem permissão ainda: aviso amigável, sem erro', await p.evaluate(() => /permissões novas do banco/.test(document.querySelector('.gantt-empty').textContent)));
    await ctx.close();
  }
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1);
})();
