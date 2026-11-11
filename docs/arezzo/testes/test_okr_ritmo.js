// 📐 Radar — ritmo esperado × realizado (R1 da consultoria de 09/11/2026). Meta numérica: esperado hoje em linha reta do início ao fim do
// período padrão, faixas +5/−10/−25, silêncio nos primeiros 10%, projeção de fechamento; traço na barra do cartão, rótulo quando sai do
// ritmo, linha no 📈 Evolução e diagonal pontilhada no gráfico.
// Rodar: python3 -m http.server 8961 --directory . (na raiz) e `node docs/arezzo/testes/test_okr_ritmo.js`. BASE_URL troca o servidor.
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const chromeRoot = path.join(home, 'hering-tools/chrome');
const chrome = process.env.CHROME || path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8961', out = path.join(__dirname, '../../capturas/okr-ritmo');
const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const HOJE = new Date('2026-11-09T12:00:00');
const L = (em, valor) => ({ id: 'at_' + em, em, valor, criadoEm: em + 'T12:00:00.000Z', por: 'Ana' });
const ob = (id, t, o) => ({ id, titulo: t, areaId: 'geral', torre: 'digital', responsaveis: ['ana'], tagIds: [], history: [], ordem: 0, indicadores: [], trimestres: ['T426'], criadoEm: '2026-10-01T12:00:00.000Z', atualizadoEm: '2026-11-08T12:00:00.000Z', ...o });
const num = (lanc, extra) => Object.assign({ tipo: 'numero', inicial: 0, meta: 100, lancamentos: lanc }, extra || {});
const seed = () => ({ kanban: { okr: { objetivos: {
    atras: ob('atras', 'Muito atrás', { atingimento: num([L('2026-10-20', 5), L('2026-11-05', 10)]) }),
    ritmo: ob('ritmo', 'No ritmo', { atingimento: num([L('2026-11-01', 40)]) }),
    frente: ob('frente', 'Adiantado', { atingimento: num([L('2026-11-01', 60)]) }),
    bin: ob('bin', 'Binário', { atingimento: { tipo: 'binario', lancamentos: [] } }),
    semper: ob('semper', 'Sem período padrão', { trimestres: ['Black Friday'], atingimento: num([L('2026-11-01', 10)]) }),
  }, marcos: {}, tags: {} },
  usuarios: { ana: { uid: 'ana', nome: 'Ana Lima', email: U.email, inscrito: true } }, config: { adm_emails: [U.email] } } });
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: chrome }); let falhas = 0, total = 0;
  const t = (n, c, d) => { total++; if (!c) falhas++; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 400))); };
  const open = async (vp, tema) => { const ctx = await b.newContext({ viewport: vp || { width: 1280, height: 800 } }); await fake.install(ctx, seed()); const p = await ctx.newPage(); await p.clock.setFixedTime(HOJE); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/okr-dev.html?torre=digital'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(1500);
    if (tema) { await p.evaluate(th => document.documentElement.setAttribute('data-theme', th), tema); await p.waitForTimeout(300); } return { ctx, p, errs }; };

  { const { ctx, p, errs } = await open();
    const r = await p.evaluate(() => { const o = (id, ext) => Object.assign({ id: 'x', trimestres: ['T426'], criadoEm: '2026-10-01T00:00:00Z', atingimento: { tipo: 'numero', inicial: 0, meta: 100, lancamentos: [{ em: '2026-11-01', valor: 40, criadoEm: 'a' }] } }, ext || {});
      const v = (val, ext) => o('x', Object.assign({ atingimento: { tipo: 'numero', inicial: 0, meta: 100, lancamentos: [{ em: '2026-11-01', valor: val, criadoEm: 'a' }] } }, ext || {}));
      const R = (x, h) => _okrRitmo(x, h || '2026-11-09');
      return { r40: R(v(40)), r10: R(v(10)), r60: R(v(60)), r100: R(v(100)), cedo: R(v(1), ), cedoD: R(v(1), '2026-10-05'), futuro: R(v(0), '2026-09-01'),
        bin: R({ trimestres: ['T426'], atingimento: { tipo: 'binario', lancamentos: [] } }), perene: R({ trimestres: [], atingimento: { tipo: 'perene' } }),
        semPer: R(v(10, { trimestres: ['Black Friday'] })), velho: R(v(40, { trimestres: ['4T-2026'] })), multi: R(v(40, { trimestres: ['T426', 'T127'] })),
        fim: R(v(60), '2027-01-10'), reduz: R({ trimestres: ['T426'], atingimento: { tipo: 'financeira', inicial: 1000, meta: 500, lancamentos: [{ em: '2026-11-01', valor: 900, criadoEm: 'a' }] } }),
        motivoSemPer: _okrRitmoMotivo(v(10, { trimestres: ['Black Friday'] }), '2026-11-09'), motivoCedo: _okrRitmoMotivo(v(1), '2026-10-05'), motivoFut: _okrRitmoMotivo(v(0), '2026-09-01') }; });
    t('exemplo do plano (T426, 09/11): esperado 43%; 40% → no ritmo, fecha em ~92%', r.r40 && r.r40.esperado === 43 && r.r40.faixa === 'no_ritmo' && r.r40.projecao === 92, r.r40);
    t('10% → muito atrás, fecha em ~23%', r.r10 && r.r10.faixa === 'muito_atras' && r.r10.projecao === 23, r.r10);
    t('60% → adiantado (+17 pontos)', r.r60 && r.r60.faixa === 'adiantado' && r.r60.delta === 17, r.r60);
    t('meta atingida (100%) → sem ritmo', r.r100 === null);
    t('primeiros 10% do período → sem ritmo (cedo demais), com motivo no detalhe', r.cedoD === null && /cedo/.test(r.motivoCedo), r.motivoCedo);
    t('período que ainda não começou → sem ritmo, com motivo', r.futuro === null && /não começou/.test(r.motivoFut), r.motivoFut);
    t('binário e perene → sem ritmo (não é meta numérica)', r.bin === null && r.perene === null);
    t('rótulo fora do padrão → sem ritmo, pedindo para padronizar', r.semPer === null && /período padrão/.test(r.motivoSemPer), r.motivoSemPer);
    t('rótulo antigo conversível ("4T-2026") vale como T426', r.velho && r.velho.esperado === 43, r.velho);
    t('vários períodos (T426 + T127) = do início do 1º ao fim do último', r.multi && r.multi.fim === '2027-03-31' && r.multi.esperado < 43, r.multi);
    t('período encerrado → muito atrás e marcado como encerrado', r.fim && r.fim.encerrado && r.fim.esperado === 100, r.fim);
    t('meta de redução (inicial 1000 → meta 500) funciona igual', r.reduz && r.reduz.real === 20, r.reduz);
    // cartão
    const c = await p.evaluate(() => { const card = id => [...document.querySelectorAll('.okr-card')].find(e => e.textContent.includes(id));
      const mk = n => { const e = card(n); const m = e && e.querySelector('.okr-ritmo-mk'); return { mk: m ? m.style.left : null, rot: e && e.querySelector('.okr-ritmo') ? e.querySelector('.okr-ritmo').textContent.trim() : null }; };
      return { atras: mk('Muito atrás'), ritmo: mk('No ritmo'), frente: mk('Adiantado'), bin: mk('Binário'), sem: mk('Sem período padrão') }; });
    t('cartão: traço no esperado de hoje (43%) em quem tem ritmo', c.atras.mk === '43%' && c.ritmo.mk === '43%' && c.frente.mk === '43%', c);
    t('cartão: rótulo "33 pontos atrás · fecha em ~23%" no muito atrás', /33 pontos atrás · fecha em ~23%/.test(c.atras.rot || ''), c.atras);
    t('cartão: no ritmo não ganha rótulo (fica quieto); adiantado ganha "à frente"', c.ritmo.rot === null && /17 pontos à frente/.test(c.frente.rot || ''), [c.ritmo, c.frente]);
    t('cartão: sem meta numérica ou sem período = sem traço e sem rótulo', c.bin.mk === null && c.bin.rot === null && c.sem.mk === null, [c.bin, c.sem]);
    await p.locator('.okr-card', { hasText: 'Muito atrás' }).first().screenshot({ path: path.join(out, 'cartao-1280.png') });
    // painel 📈 Evolução + gráfico
    await p.evaluate(() => openOkrAtingChart('atras')); await p.waitForTimeout(400);
    const pn = await p.evaluate(() => { const ov = document.getElementById('okr-ating-chart-ov'); return { txt: ov.querySelector('.okr-ritmo-det') ? ov.querySelector('.okr-ritmo-det').textContent.replace(/\s+/g, ' ') : '', diag: !!ov.querySelector('.okr-ritmo-diag') }; });
    t('📈 Evolução: "esperado hoje 43% · realizado 10% → Muito atrás" e a projeção', /esperado hoje 43%/.test(pn.txt) && /realizado 10%/.test(pn.txt) && /Muito atrás/.test(pn.txt) && /fecha em ~23%/.test(pn.txt), pn.txt);
    t('📈 Evolução: diagonal pontilhada do ritmo esperado no gráfico', pn.diag);
    await p.locator('#okr-ating-chart-ov .okr-ating-chartpanel').screenshot({ path: path.join(out, 'evolucao-1280.png') });
    await p.evaluate(() => openOkrAtingChart('semper')); await p.waitForTimeout(300);
    t('📈 Evolução sem período padrão: explica como ligar o ritmo, sem diagonal', await p.evaluate(() => { const ov = document.getElementById('okr-ating-chart-ov'); return /Defina um período padrão/.test(ov.textContent) && !ov.querySelector('.okr-ritmo-diag'); }));
    t('sem erro de JS', !errs.length, errs); await ctx.close(); }
  for (const [nome, th] of [['abrolhos', null], ['lencois', 'light'], ['vice', 'vice']]) for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 800 }]) {
    const { ctx, p, errs } = await open(vp, th);
    t(nome + ' ' + vp.width + 'px: traços e rótulos sem rolagem lateral nem erro', (await p.locator('.okr-ritmo-mk').count()) === 3 && (await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)) && !errs.length, errs);
    if (vp.width === 390 && th === 'light') await p.locator('.okr-card', { hasText: 'Muito atrás' }).first().screenshot({ path: path.join(out, 'cartao-390-claro.png') });
    await ctx.close(); }
  await b.close(); console.log(`\n${total - falhas}/${total} ok`); process.exit(falhas ? 1 : 0);
})();
