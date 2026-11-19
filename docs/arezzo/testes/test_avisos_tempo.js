// ⏳ Avisos de tempo da apresentação ao vivo do Radar (pedido do Caio, 19/11/2026): faltam 10 min, faltam 5 min, tempo esgotado e o aviso de ritmo
// ("nesse ritmo, terminamos às…"). Os de tempo aparecem em todas as telas, inclusive a do público. O de ritmo aparece para quem controla, e para a sala
// só quando o Bastidor liga "Mostrar aviso de ritmo para a sala" (às vezes quem passa o slide não é quem fala).
const { chromium } = require(process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright');
const fake = require('./fakefb.js');
const BASE = process.env.APRESENTACAO_TEST_URL || 'http://localhost:8941';
const U = (uid, n) => ({ uid, email: uid + '@ciahering.com.br', displayName: n, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const mk = (id, t, o) => ({ id, titulo: t, areaId: 'geral', trimestres: ['2026-Q4'], responsaveis: ['ana'], tagIds: [], history: [], indicadores: ['i1'], progressos: ['p1'], proximosPassos: [], riscos: [], planosAcao: [], descricao: 'd', torre: 'digital', ...o });
const T0 = Date.parse('2026-11-20T13:30:00.000Z');   // 10:30 em São Paulo
const MIN = 60000;
const areas = ['crm', 'tech', 'cx', 'loja', 'log', 'fin', 'rh', 'mkt'];
const objetivos = Object.fromEntries(areas.map((a, i) => ['o' + i, mk('o' + i, 'Objetivo ' + a, { areaId: a })]));
const seed = () => ({ kanban: { okr: { objetivos, marcos: {}, tags: {}, reuniao_notas: {}, reuniao_agenda: {} },
  usuarios: { ana: { uid: 'ana', nome: 'Ana ADM', email: 'ana@ciahering.com.br', inscrito: true }, eve: { uid: 'eve', nome: 'Eve Souza', email: 'eve@ciahering.com.br', inscrito: true } },
  usuarios_publicos: { ana: { nome: 'Ana ADM' }, eve: { nome: 'Eve Souza' } }, config: { adm_emails: ['ana@ciahering.com.br'] } } });
const NO = 'kanban/okr/apresentacao_live';
async function sync(from, ...tos) {
  const n = await from.evaluate(() => JSON.stringify(((window.__store.kanban || {}).okr || {}).apresentacao_live || null));
  for (const to of tos) {
    await to.evaluate(([n, NO]) => { const v = JSON.parse(n), st = window.__store; st.kanban.okr.apresentacao_live = v;
      (window.__lis || []).filter(l => l.p === NO).forEach(l => l.cb({ val: () => v === null ? null : JSON.parse(JSON.stringify(v)), exists: () => v !== null, key: 'apresentacao_live' })); }, [n, NO]);
    await to.waitForTimeout(250);
  }
}
let falhas = 0; const t = (n, ok, d) => { if (!ok) falhas++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
const balao = p => p.evaluate(() => { const e = document.getElementById('tempo-balao'); return e.hidden || getComputedStyle(e).display === 'none' ? '' : e.textContent; });
const apagar = p => p.evaluate(() => { document.getElementById('tempo-balao').hidden = true; });
const quando = async (min, ...ps) => { for (const p of ps) await p.clock.setFixedTime(new Date(T0 + min * MIN)); await ps[0].waitForTimeout(1300); };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const open = async (user, url = '/okr-apresentacao.slide.html', w = 1280, h = 800) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, timezoneId: 'America/Sao_Paulo' }); await fake.install(ctx, seed());
    const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message)); p.on('dialog', d => d.accept());
    await p.clock.setFixedTime(new Date(T0));
    await p.goto(BASE + url); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), user); await p.waitForTimeout(1500);
    return { ctx, p, erros };
  };
  try {
    // 1) faltam 10, faltam 5, tempo esgotado — quem apresenta e a Tela para o público
    { const A = await open(U('ana', 'Ana ADM')), P = await open(U('ana', 'Ana ADM'), '/okr-apresentacao.slide.html?tela=publico', 390, 800);
      await A.p.click('#live-box button'); await A.p.fill('#inicio-duracao', '30'); await A.p.click('#inicio-com'); await A.p.waitForTimeout(400);
      await sync(A.p, P.p);
      t('no começo, nenhum balão', !(await balao(A.p)) && !(await balao(P.p)), [await balao(A.p), await balao(P.p)]);
      t('Tela para o público mostra o tempo restante num selo', (await P.p.textContent('#publico-tempo')) === '⏳ 30min restantes' && await P.p.isVisible('#publico-tempo'), await P.p.textContent('#publico-tempo'));
      t('quem apresenta não ganha o selo do público (já tem a barra)', !(await A.p.isVisible('#publico-tempo')), '');
      await quando(20, A.p, P.p);
      t('faltando 10 min: balão para quem apresenta', (await balao(A.p)) === '⏳ Faltam 10 min', await balao(A.p));
      t('faltando 10 min: balão também na Tela para o público', (await balao(P.p)) === '⏳ Faltam 10 min', await balao(P.p));
      await apagar(A.p); await A.p.waitForTimeout(1300);
      t('o mesmo aviso não volta no tique seguinte', !(await balao(A.p)), await balao(A.p));
      await A.p.reload(); await A.p.waitForFunction(() => !!window.__authCb); await A.p.evaluate(x => window.__authCb(x), U('ana', 'Ana ADM')); await A.p.waitForTimeout(500);
      await sync(P.p, A.p); await A.p.waitForTimeout(1300);   // o fake semeia de novo ao recarregar; a sessão volta pela sala
      t('nem depois de recarregar a página', !(await balao(A.p)), await balao(A.p));
      await quando(26, A.p, P.p);
      t('faltando 4 min: balão de 5 min, com o tempo real', (await balao(A.p)) === '⏳ Faltam 4 min' && await A.p.evaluate(() => document.getElementById('tempo-balao').className === 'alerta'), await balao(A.p));
      await quando(30, A.p, P.p);
      t('no término: tempo esgotado (todas as telas)', (await balao(A.p)) === '🔴 Tempo esgotado' && (await balao(P.p)) === '🔴 Tempo esgotado', [await balao(A.p), await balao(P.p)]);
      t('selo do público fica vermelho no término', await P.p.evaluate(() => document.getElementById('publico-tempo').className === 'fim'), '');
      const caixa = await P.p.evaluate(() => { const r = document.getElementById('tempo-balao').getBoundingClientRect(); return { dentro: r.left >= 0 && r.right <= innerWidth, lateral: document.documentElement.scrollWidth > innerWidth }; });
      t('390 px: balão dentro da tela e sem rolagem lateral', caixa.dentro && !caixa.lateral, caixa);
      // ajustar o término rearma os avisos
      await apagar(A.p);
      await A.p.evaluate(() => { window._okrToggleAgendaCfg(); document.getElementById('agenda-inicio').value = '10:00'; document.getElementById('agenda-fim').value = '11:10'; window._okrAgendaSalvar(); });
      await A.p.waitForTimeout(1300);
      t('término ajustado (+10 min): os avisos voltam a valer para o novo término', (await balao(A.p)) === '⏳ Faltam 10 min', await balao(A.p));
      t('sem erro de JavaScript (tempo)', !A.erros.length && !P.erros.length, [A.erros, P.erros]);
      await A.ctx.close(); await P.ctx.close(); }
    // 2) ritmo: quem controla vê; a sala só com o interruptor do Bastidor
    { const A = await open(U('ana', 'Ana ADM')), E = await open(U('eve', 'Eve Souza')), P = await open(U('ana', 'Ana ADM'), '/okr-apresentacao.slide.html?tela=publico');
      await A.p.click('#live-box button'); await A.p.fill('#inicio-duracao', '60'); await A.p.click('#inicio-com'); await A.p.waitForTimeout(400);
      const D = await open(U('ana', 'Ana ADM'), '/okr-apresentacao.slide.html?tela=bastidor');
      await sync(A.p, E.p, P.p, D.p);
      t('Bastidor: antes de 20% da pauta, o ritmo espera', /depois de 20% da pauta/.test(await D.p.textContent('#ritmo')), await D.p.textContent('#ritmo'));
      // 25% da pauta em 30 min → projeção de 120 min, 60 min de atraso
      const alvo = await A.p.evaluate(() => Math.ceil((slides.length - 1) * 0.25));
      await A.p.evaluate(i => window._okrGoTo(i), alvo); await A.p.waitForTimeout(300); await sync(A.p, E.p, P.p, D.p);
      await quando(30, A.p, E.p, P.p, D.p);
      const pct = await A.p.evaluate(() => currentIdx / (slides.length - 1));
      t('quem apresenta vê o aviso de ritmo', /^⚠️ Nesse ritmo, terminamos às /.test(await balao(A.p)), { b: await balao(A.p), pct });
      t('Bastidor mostra a previsão de término', /^⚠️ Nesse ritmo, termina às \d\d:\d\d/.test(await D.p.textContent('#ritmo')), await D.p.textContent('#ritmo'));
      t('com o interruptor desligado, o público não vê o ritmo', !(await balao(P.p)), await balao(P.p));
      t('nem quem só acompanha', !(await balao(E.p)), await balao(E.p));
      t('o interruptor nasce desligado e ligável pelo ADM', await D.p.evaluate(() => { const c = document.getElementById('ritmo-sala'); return !c.checked && !c.disabled; }), '');
      await D.p.click('#ritmo-sala'); await D.p.waitForTimeout(300);
      t('ligar grava avisos/ritmoSala na sessão', await D.p.evaluate(() => window.__store.kanban.okr.apresentacao_live.avisos?.ritmoSala === true), '');
      await sync(D.p, A.p, E.p, P.p); await P.p.waitForTimeout(1300);
      t('ligado: a Tela para o público mostra o aviso de ritmo', /^⚠️ Nesse ritmo/.test(await balao(P.p)), await balao(P.p));
      t('ligado: quem acompanha também', /^⚠️ Nesse ritmo/.test(await balao(E.p)), await balao(E.p));
      await quando(52, A.p, D.p);
      await D.p.waitForTimeout(1300);
      t('com aviso de tempo e de ritmo ao mesmo tempo, o de tempo fica na tela (Bastidor)', (await balao(D.p)) === '⏳ Faltam 8 min', await balao(D.p));
      await A.p.evaluate(() => window._livePassar('eve', 'Eve Souza')); await A.p.waitForTimeout(300);
      t('passar o controle mantém o interruptor', await A.p.evaluate(() => window.__store.kanban.okr.apresentacao_live.avisos?.ritmoSala === true), '');
      t('sem erro de JavaScript (ritmo)', ![A, E, P, D].some(x => x.erros.length), [A, E, P, D].map(x => x.erros));
      await Promise.all([A, E, P, D].map(x => x.ctx.close())); }
    // 3) sem cronômetro: nenhum aviso, interruptor desligado
    { const A = await open(U('ana', 'Ana ADM'));
      await A.p.click('#live-box button'); await A.p.click('#inicio-sem'); await A.p.waitForTimeout(300);
      const D = await open(U('ana', 'Ana ADM'), '/okr-apresentacao.slide.html?tela=bastidor'); await sync(A.p, D.p);
      await quando(200, A.p, D.p);
      t('sem cronômetro: nenhum balão de tempo', !(await balao(A.p)), await balao(A.p));
      t('sem cronômetro: o Bastidor explica e o interruptor fica desligado', /só com cronômetro/.test(await D.p.textContent('#ritmo')) && await D.p.evaluate(() => document.getElementById('ritmo-sala').disabled), await D.p.textContent('#ritmo'));
      await A.ctx.close(); await D.ctx.close(); }
  } finally { await b.close(); }
  console.log(falhas ? `\n${falhas} falha(s)` : '\nTUDO OK'); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
