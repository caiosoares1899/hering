// Apresentação ao vivo do Radar com relógios diferentes entre computadores (/monitorarbugs de 19/11/2026: "a apresentação não está lendo as pessoas online").
// Quem acompanha grava um sinal de vida com horário; quem apresenta lista quem deu sinal nos últimos 70 s e quem acompanha considera o apresentador
// "sem sinal" depois de 90 s. Se cada computador usa o próprio relógio, um relógio atrasado some da lista e um adiantado vê o apresentador parado.
// O SDK do Firebase mede a diferença para o servidor em `.info/serverTimeOffset`; o fake simula isso semeando esse valor por página.
const { chromium } = require(process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright');
const fake = require('./fakefb.js');
const BASE = process.env.APRESENTACAO_TEST_URL || 'http://localhost:8941';
const U = (uid, n) => ({ uid, email: uid + '@ciahering.com.br', displayName: n, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const mk = (id, t, o) => ({ id, titulo: t, areaId: 'geral', trimestres: ['2026-Q4'], responsaveis: ['ana'], tagIds: [], history: [], indicadores: ['i1'], progressos: ['p1'], proximosPassos: [], riscos: [], planosAcao: [], descricao: 'd', torre: 'digital', ...o });
const seed = (offset) => ({ '.info': { serverTimeOffset: offset }, kanban: { okr: { objetivos: { d1: mk('d1', 'Fidelidade', { areaId: 'crm' }), d2: mk('d2', 'Checkout', { areaId: 'tech' }) }, marcos: {}, tags: {}, reuniao_notas: {} },
  usuarios: { ana: { uid: 'ana', nome: 'Ana ADM', email: 'ana@ciahering.com.br', inscrito: true }, eve: { uid: 'eve', nome: 'Eve Souza', email: 'eve@ciahering.com.br', inscrito: true } },
  usuarios_publicos: { ana: { nome: 'Ana ADM' }, eve: { nome: 'Eve Souza' } }, config: { adm_emails: ['ana@ciahering.com.br'] } } });
const NO = 'kanban/okr/apresentacao_live';
async function sync(from, to) {
  const n = await from.evaluate(() => JSON.stringify(((window.__store.kanban || {}).okr || {}).apresentacao_live || null));
  await to.evaluate(([n, NO]) => { const v = JSON.parse(n), st = window.__store; st.kanban.okr.apresentacao_live = v;
    (window.__lis || []).filter(l => l.p === NO).forEach(l => l.cb({ val: () => v === null ? null : JSON.parse(JSON.stringify(v)), exists: () => v !== null, key: 'apresentacao_live' })); }, [n, NO]);
  await to.waitForTimeout(250);
}
let falhas = 0; const t = (n, ok, d) => { if (!ok) falhas++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  // desvio = quanto o relógio deste computador está à frente do servidor (negativo = atrasado); o SDK mede o oposto em serverTimeOffset
  const open = async (user, desvio) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); await fake.install(ctx, seed(-desvio));
    if (desvio) await ctx.addInitScript(d => { const real = Date.now.bind(Date); Date.now = () => real() + d; }, desvio);
    const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto(BASE + '/okr-apresentacao.slide.html'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), user); await p.waitForTimeout(1500);
    return { ctx, p, erros };
  };
  try {
    for (const [nome, desvioEve] of [['atrasado 2 min', -120000], ['adiantado 2 min', 120000]]) {
      const A = await open(U('ana', 'Ana ADM'), 0), B = await open(U('eve', 'Eve Souza'), desvioEve);
      await A.p.evaluate(() => window._liveComecar()); await A.p.waitForTimeout(400); await sync(A.p, B.p);   // Eve entra e grava o sinal
      await sync(B.p, A.p);
      const lista = await A.p.evaluate(() => liveParticipantes().map(([id]) => id));
      t(`relógio de quem acompanha ${nome}: aparece em "Passar o controle pra…"`, lista.includes('eve'), lista);
      const parado = await B.p.evaluate(() => liveHostParado());
      t(`relógio de quem acompanha ${nome}: não vê quem apresenta como "sem sinal"`, !parado, { parado });
      t(`relógio de quem acompanha ${nome}: sem botão "Assumir" para quem não é ADM`, !(await B.p.evaluate(() => /Assumir/.test(document.getElementById('live-fpanel')?.textContent || '') || /Assumir/.test(document.getElementById('live-box')?.textContent || ''))), '');
      // quem saiu há mais de 3 min some da lista, mesmo com relógio adiantado
      await A.p.evaluate(d => { const st = window.__store.kanban.okr.apresentacao_live; st.participantes.eve.ts -= 200000; }, 0);
      await A.p.evaluate(() => { const st = window.__store.kanban.okr.apresentacao_live; (window.__lis || []).filter(l => l.p === 'kanban/okr/apresentacao_live').forEach(l => l.cb({ val: () => JSON.parse(JSON.stringify(st)), exists: () => true, key: 'x' })); });
      await A.p.waitForTimeout(200);
      t(`relógio de quem acompanha ${nome}: quem parou de dar sinal há mais de 3 min sai da lista`, !(await A.p.evaluate(() => liveParticipantes().some(([id]) => id === 'eve'))), '');
      t(`relógio de quem acompanha ${nome}: sem erro de JavaScript`, !A.erros.length && !B.erros.length, [A.erros, B.erros]);
      await A.ctx.close(); await B.ctx.close();
    }
  } finally { await b.close(); }
  console.log(falhas ? `\n${falhas} falha(s)` : '\nTUDO OK'); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
