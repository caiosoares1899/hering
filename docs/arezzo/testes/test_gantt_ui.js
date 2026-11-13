// 📊 Gantt — rodada /melhoriauiux de 13/11/2026: rótulo "Hoje" na linha 📌 Datas-chave, rótulo de data de 1 dia CENTRADO na linha
// (estava "torto"), destaque do ADM nas barras dos calendários (cor + ⚠️, vale para todas as squads), filtro "mostrar só" por grupo
// de linhas e o novo nome "Site e App". Servir a raiz em BASE_URL; node docs/arezzo/testes/test_gantt_ui.js (CAPTURE_DIR grava capturas)
const fs = require('node:fs'); const path = require('node:path'); const home = require('node:os').homedir();
const pwPath = process.env.PLAYWRIGHT_MODULE || (fs.existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const { chromium } = require(pwPath); const fake = require('./fakefb');
function resolveChrome() { if (process.env.CHROME) return process.env.CHROME; if (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) return '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const r = path.join(home, 'hering-tools/chrome'); const arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-')); return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'); }
const base = process.env.BASE_URL || 'http://127.0.0.1:8949'; const K = process.env.K || 'kanban-dev'; const SUF = K.endsWith('-dev') ? '_dev' : '';
const SQ = 'site'; const cap = process.env.CAPTURE_DIR || ''; const FIXO = '2026-11-12T13:00:00';   // janela 01/11 – 12/12; hoje = coluna 12
const fl = col => ({ enteredAt: { [col]: '2026-10-20T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-10-20T12:00:00.000Z' }] });
const USERS = {
  mem: { uid: 'mem', nome: 'Mel Membro', email: 'mem@ciahering.com.br', init: 'MM', role: 'membro', squads: { [SQ]: true }, squads_roles: { [SQ]: 'membro' } },
  adm: { uid: 'adm', nome: 'Ana ADM', email: 'adm@ciahering.com.br', init: 'AA', role: 'adm', squads: { [SQ]: true } },
};
const meta = { atualizadoEm: 1, porNome: 'Caio', arquivo: 'x.xlsx', de: '2026-01-01', ate: '2026-12-31' };
const seed = () => ({ kanban: {
  config: { adm_emails: ['adm@ciahering.com.br'] },
  usuarios: Object.fromEntries(Object.entries(USERS).map(([k, u]) => [k, Object.assign({ inscrito: true }, u)])),
  usuarios_publicos: Object.fromEntries(Object.entries(USERS).map(([k, u]) => [k, { uid: u.uid, nome: u.nome, init: u.init, squads: u.squads }])),
  squads: { [SQ]: { dados: { columns: [{ id: 'doing', name: 'Fazendo' }], tags: [], cards_index: { c1: 'k1' },
      cards: { k1: { id: 'c1', title: 'Card', col: 'doing', owner: 'MM', createdAt: '2026-10-20', flow: fl('doing'), inicio: '2026-11-20', fim: '2026-11-30', updatedAt: '2026-10-27T10:00:00.000Z' } } },
    ['gantt_marcos' + SUF]: { m1: { titulo: 'Black Friday', ini: '2026-11-27', fim: '2026-11-27', cor: 'purple', porUid: 'adm', em: 1 }, m2: { titulo: 'Semana do Cliente', ini: '2026-11-16', fim: '2026-11-20', cor: 'green', porUid: 'adm', em: 1 } } } },
  ['calendarios_gantt' + SUF]: {
    comercial: { meta, linhas: { lancamentos: { rot: 'Lançamentos e datas', ordem: 0 }, site: { rot: 'Site todo (não remarcados)', ordem: 1 }, saldos: { rot: 'Site · Saldos', ordem: 2 }, crm: { rot: 'CRM', ordem: 6 }, app: { rot: 'Ação App', ordem: 7 } },
      barras: { b_a1: { linha: 'site', ini: '2026-11-09', fim: '2026-11-14', txt: 'AÇÃO SITE TESTE' }, b_a2: { linha: 'saldos', ini: '2026-11-10', fim: '2026-11-13', txt: 'OFERTA FICTÍCIA' },
        b_a3: { linha: 'crm', ini: '2026-11-11', fim: '2026-11-12', txt: 'CRM TESTE' }, b_a4: { linha: 'app', ini: '2026-11-12', fim: '2026-11-12', txt: 'APP TESTE' }, b_a5: { linha: 'lancamentos', ini: '2026-11-15', fim: '2026-11-15', txt: 'FERIADO' } } },
    marca: { meta, linhas: { web: { rot: 'Web', ordem: 1 }, redes: { rot: 'Redes sociais', ordem: 2 } },
      barras: { b_w1: { linha: 'web', ini: '2026-10-31', fim: '2026-11-30', txt: 'BLACK FRIDAY' }, b_r1: { linha: 'redes', ini: '2026-11-10', fim: '2026-11-17', txt: 'CAMPANHA TESTE' } } } },
  ['gantt_destaques' + SUF]: { comercial: { b_a2: { cor: 'red', alerta: true, porNome: 'Ana ADM', em: 1 }, b_a5: { cor: 'blue', alerta: false, porNome: 'Ana ADM', em: 1 } } },
} });

(async () => {
  const b = await chromium.launch({ executablePath: resolveChrome(), headless: true }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 400))); };
  const abre = async (quem, vp) => {
    const ctx = await b.newContext({ viewport: vp, hasTouch: vp.width < 1000, isMobile: vp.width < 1000 }); await fake.install(ctx, seed());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(f => { const R = Date; const fixed = new R(f).getTime(); class D extends R { constructor(...a) { if (!a.length) super(fixed); else super(...a); } static now() { return fixed; } } window.Date = D; try { localStorage.clear(); } catch (e) {} }, FIXO);
    await p.goto(base + '/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb);
    const u = USERS[quem]; await p.evaluate(x => window.__authCb(x), { uid: u.uid, email: u.email, displayName: u.nome, photoURL: '', providerData: [{ providerId: 'google.com' }] }); await p.waitForTimeout(2500);
    await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); toggleGanttView(); }); await p.waitForTimeout(400);
    return { ctx, p, errs };
  };
  // centro x de um elemento; rótulo × linha do dia (a linha é o filho do overlay na coluna do dia)
  const alinh = p => p.evaluate(() => {
    const cx = e => { const r = e.getBoundingClientRect(); return r.left + r.width / 2; };
    const hoje = document.querySelector('.gantt-mc-hoje'), linhaHoje = document.querySelector('.gantt-today-line'), hd = document.querySelector('.gantt-day-hd.is-today');
    const bf = document.querySelector('.gantt-mc-chip[data-id="m1"]'), bfLinha = document.querySelector('.gantt-mc-faixa[data-mc="squad:m1"]');
    const sc = document.querySelector('.gantt-mc-chip[data-id="m2"]'), scFaixa = document.querySelector('.gantt-mc-faixa[data-mc="squad:m2"]');
    return { hoje: hoje && linhaHoje ? Math.abs(cx(hoje) - cx(linhaHoje)) : 99, hdHoje: hd && linhaHoje ? Math.abs(cx(hd) - cx(linhaHoje)) : 99,
      bf: bf && bfLinha ? Math.abs(cx(bf) - cx(bfLinha)) : 99, sc: sc && scFaixa ? Math.abs(sc.getBoundingClientRect().left - scFaixa.getBoundingClientRect().left) : 99 };
  });

  for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 800 }]) {
    const L = vp.width + 'px'; const { ctx, p, errs } = await abre('mem', vp);
    for (const aba of ['cards', 'marca', 'comercial']) {
      await p.evaluate(a => ganttAba(a), aba); await p.waitForTimeout(300);
      await p.evaluate(() => { const s = document.getElementById('gantt-scroll'); const d = document.querySelector('.gantt-day-hd[data-date="2026-11-16"]'); s.scrollLeft = Math.max(0, d.offsetLeft - 260); }); await p.waitForTimeout(100);
      const a = await alinh(p);
      t(`A ${L} ${aba}. "Hoje" tem rótulo na linha 📌 e ele fica centrado na linha de hoje (±2 px); a linha bate com o dia no cabeçalho`, a.hoje <= 2 && a.hdHoje <= 2, a);
      t(`B ${L} ${aba}. data de 1 dia: rótulo centrado na linha (±2 px) — antes ficava torto`, a.bf <= 2, a);
      t(`C ${L} ${aba}. data de vários dias: rótulo começa onde a faixa começa (±3 px)`, a.sc <= 3, a);
    }
    t(`D ${L}. Comercial com o nome novo: "Site e App · todo" e "Site e App · saldos" (mesmo com dado publicado antes)`, await p.evaluate(() => { const ls = [...document.querySelectorAll('.gantt-cal-lin')].map(x => x.textContent); return ls.includes('Site e App · todo (não remarcados)') && ls.includes('Site e App · saldos') && !ls.some(x => /^Site todo|^Site · Saldos/.test(x)); }));
    const dz = await p.evaluate(() => { const b = document.querySelector('.gantt-cal-bar[data-id="b_a2"]'); return { dest: b.classList.contains('is-dest'), alerta: !!b.querySelector('.gantt-cal-alerta[aria-label="Ação importante"]'), cor: b.style.getPropertyValue('--gantt-tag'), leg: document.querySelector('.gantt-leg').textContent }; });
    t(`E ${L}. barra destacada pelo ADM: cor do destaque, ⚠️ com texto alternativo e legenda "Ação importante"`, dz.dest && dz.alerta && /ff6b6b/i.test(dz.cor) && /Ação importante/.test(dz.leg), dz);
    t(`E2 ${L}. destaque só de cor também tem sinal além da cor (★ com texto "Ação destacada")`, await p.evaluate(() => !!document.querySelector('.gantt-cal-bar[data-id="b_a5"] .gantt-cal-dest[aria-label="Ação destacada"]') && /Destacada/.test(document.querySelector('.gantt-leg').textContent)));
    await p.click('.gantt-cal-bar[data-id="b_a2"]'); await p.waitForTimeout(200);
    t(`F ${L}. membro toca na barra destacada: aviso "⚠️ Importante · …" e nada de editor`, await p.evaluate(() => /⚠️ Importante · OFERTA FICTÍCIA/.test((document.querySelector('.mgc-leitura p')||document.getElementById('kb-toast')).textContent) && !(document.getElementById('gantt-dz-ov') || {}).classList?.contains('open')));
    await p.evaluate(()=>document.querySelector('.mgc-leitura button[data-fechar]')?.click());
    // filtro "mostrar só"
    const chips = await p.evaluate(() => [...document.querySelectorAll('.gantt-cal-fchip')].map(x => x.textContent));
    t(`G ${L}. chips de filtro do Comercial: Tudo · Site · App · CRM · Mídia · Lançamentos`, chips.join('|') === 'Tudo|🖥️ Site|📱 App|✉️ CRM|📣 Mídia|🚀 Lançamentos e datas', chips);
    await p.click('.gantt-cal-fchip[data-g="app"]'); await p.waitForTimeout(300);
    let ls = await p.evaluate(() => [...document.querySelectorAll('.gantt-cal-lin')].map(x => x.textContent));
    t(`H ${L}. "📱 App": Site e App (todo e saldos) + Ação App; sem CRM nem lançamentos; rodapé diz o filtro`, ls.join('|') === 'Site e App · todo (não remarcados)|Site e App · saldos|Ação App' && await p.evaluate(() => /Mostrando só 📱 App/.test(document.getElementById('gantt-footer').textContent)), ls);
    await p.click('.gantt-cal-fchip[data-g="crm"]'); await p.waitForTimeout(300);
    ls = await p.evaluate(() => [...document.querySelectorAll('.gantt-cal-lin')].map(x => x.textContent));
    t(`I ${L}. "✉️ CRM": só CRM; o filtro fica guardado por aba e não vaza para a Marca`, ls.join('|') === 'CRM' && await p.evaluate(() => { ganttAba('marca'); return [...document.querySelectorAll('.gantt-cal-lin')].length === 2 && !document.querySelector('.gantt-cal-fchip.on[data-g]:not([data-g=""])'); }), ls);
    await p.evaluate(() => ganttAba('comercial')); await p.waitForTimeout(300);
    t(`J0 ${L}. com só um grupo ligado, o "✕ Limpar filtros" aparece`, await p.evaluate(() => !document.querySelector('#gantt-filtros .gantt-flimpa').hidden));
    await p.click('#gantt-filtros .gantt-flimpa'); await p.waitForTimeout(300);
    t(`J ${L}. "Limpar filtros" volta para Tudo`, await p.evaluate(() => document.querySelector('.gantt-cal-fchip.on').dataset.g === '' && document.querySelectorAll('.gantt-cal-lin').length === 5));
    t(`K ${L}. sem rolagem lateral da página, sem erro de JS`, await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1) && errs.length === 0, errs);
    if (vp.width < 1000) t(`L ${L}. chips com alvo ≥ 44 px`, await p.evaluate(() => [...document.querySelectorAll('.gantt-cal-fchip')].every(x => x.getBoundingClientRect().height >= 44)));
    if (cap) for (const aba of ['cards', 'comercial']) { await p.evaluate(a => ganttAba(a), aba); await p.waitForTimeout(200); for (const th of ['', 'light', 'vice']) { await p.evaluate(x => document.documentElement.dataset.theme = x, th); await p.waitForTimeout(120); await p.screenshot({ path: path.join(cap, `ui_${aba}_${vp.width}_${th || 'dark'}.png`) }); } await p.evaluate(() => document.documentElement.dataset.theme = ''); }
    await ctx.close();
  }
  // ── ADM destaca
  { const { ctx, p, errs } = await abre('adm', { width: 1280, height: 900 });
    await p.evaluate(() => ganttAba('comercial')); await p.waitForTimeout(300);
    t('M. ADM: legenda convida a destacar', await p.evaluate(() => /Toque numa barra para destacar/.test(document.querySelector('.gantt-leg').textContent)));
    await p.click('.gantt-cal-bar[data-id="b_a3"]'); await p.waitForTimeout(200);
    t('N. ADM toca numa barra: editor com o texto, as datas, cor "da linha" marcada e sem "Tirar destaque"', await p.evaluate(() => document.getElementById('gantt-dz-ov').classList.contains('open') && document.getElementById('gantt-dz-txt').textContent === 'CRM TESTE' && /11\/11 – 12\/11 · CRM/.test(document.getElementById('gantt-dz-per').textContent) && document.querySelector('#gantt-dz-ov .gantt-mc-cor.on').dataset.cor === '' && document.getElementById('gantt-dz-del').hidden));
    await p.click('#gantt-dz-ov .gantt-mc-cor[data-cor="orange"]'); await p.check('#gantt-dz-alerta'); await p.click('#gantt-dz-ok'); await p.waitForTimeout(300);
    const st = await p.evaluate(s => JSON.parse(JSON.stringify(window.__store.kanban['gantt_destaques' + s].comercial)), SUF);
    t('O. salva em gantt_destaques' + SUF + '/comercial/{id da barra} com cor, alerta e autor; a barra muda na hora', st.b_a3 && st.b_a3.cor === 'orange' && st.b_a3.alerta === true && st.b_a3.porNome === 'Ana ADM' && await p.evaluate(() => document.querySelector('.gantt-cal-bar[data-id="b_a3"]').classList.contains('is-alerta')), st);
    await p.click('.gantt-cal-bar[data-id="b_a2"]'); await p.waitForTimeout(200); await p.click('#gantt-dz-del'); await p.waitForTimeout(300);
    t('P. "Tirar destaque" apaga o registro e a barra volta à cor da linha', await p.evaluate(s => !(window.__store.kanban['gantt_destaques' + s].comercial || {}).b_a2 && !document.querySelector('.gantt-cal-bar[data-id="b_a2"]').classList.contains('is-dest'), SUF));
    await p.click('.gantt-cal-bar[data-id="b_a4"]'); await p.waitForTimeout(200); await p.click('#gantt-dz-ok'); await p.waitForTimeout(300);
    t('Q. salvar sem cor e sem alerta = não grava nada (não cria registro vazio)', await p.evaluate(s => !(window.__store.kanban['gantt_destaques' + s].comercial || {}).b_a4, SUF));
    await p.evaluate(() => ganttAba('marca')); await p.waitForTimeout(300); await p.click('.gantt-cal-bar[data-id="b_r1"]'); await p.waitForTimeout(200);
    t('R. o destaque também funciona na aba de Marca', await p.evaluate(() => document.getElementById('gantt-dz-ov').classList.contains('open') && /Calendário de Marca/.test(document.getElementById('gantt-dz-per').textContent)));
    t('S. sem erro de JS', errs.length === 0, errs);
    await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1);
})();
