// Reunião real (19/11/2026): o ADM conduz pelo Bastidor (okr-bastidor.html) num computador e os slides rodam em OUTRO, logado com a MESMA conta.
// As duas abas são "quem apresenta" (mesmo uid). Confere que cada uma acompanha a navegação da outra — senão o Próximo de uma pula a partir de um slide velho —
// e que a Tela para o público acompanha as duas.
const { chromium } = require(process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright');
const fake = require('./fakefb.js');
const BASE = process.env.APRESENTACAO_TEST_URL || 'http://localhost:8941';
const U = (uid, n) => ({ uid, email: uid + '@ciahering.com.br', displayName: n, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const mk = (id, t, o) => ({ id, titulo: t, areaId: 'geral', trimestres: ['2026-Q4'], responsaveis: ['ana'], tagIds: [], history: [], indicadores: ['i1'], progressos: ['p1'], proximosPassos: [], riscos: [], planosAcao: [], descricao: 'desc', torre: 'digital', ...o });
const seed = () => ({ kanban: { okr: { objetivos: { d1: mk('d1', 'Fidelidade', { areaId: 'crm', ordem: 0 }), d2: mk('d2', 'Checkout', { areaId: 'tech', ordem: 0 }), d4: mk('d4', 'Pagamentos', { areaId: 'tech', ordem: 1 }), d3: mk('d3', 'NPS', { areaId: 'cx', ordem: 0 }) }, marcos: {}, tags: {}, reuniao_notas: {} },
  usuarios: { ana: { uid: 'ana', nome: 'Ana ADM', email: 'ana@ciahering.com.br', inscrito: true, init: 'AA' } },
  usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana ADM', init: 'AA' } }, config: { adm_emails: ['ana@ciahering.com.br'] } } });
const NO = 'kanban/okr/apresentacao_live';
async function sync(from, ...tos) {
  const n = await from.evaluate(() => JSON.stringify(((window.__store.kanban || {}).okr || {}).apresentacao_live || null));
  for (const to of tos) {
    await to.evaluate(([n, NO]) => { const v = JSON.parse(n), st = window.__store; st.kanban = st.kanban || {}; st.kanban.okr = st.kanban.okr || {}; if (v === null) delete st.kanban.okr.apresentacao_live; else st.kanban.okr.apresentacao_live = v;
      (window.__lis || []).filter(l => l.p === NO).forEach(l => l.cb({ val: () => v === null ? null : JSON.parse(JSON.stringify(v)), exists: () => v !== null, key: 'apresentacao_live' })); }, [n, NO]);
    await to.waitForTimeout(250);
  }
}
let falhas = 0; const t = (n, ok, d) => { if (!ok) falhas++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
const pos = p => p.evaluate(() => ({ idx: currentIdx, key: slides[currentIdx]?.key, det: document.getElementById('detail-ov').classList.contains('open') ? _okrDetailCurrentId : '' }));
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const open = async (url) => { const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); await fake.install(ctx, seed());
    const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto(BASE + url); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U('ana', 'Ana ADM')); await p.waitForTimeout(1500); return { ctx, p, erros }; };
  try {
    const S = await open('/okr-apresentacao.slide.html');   // computador dos slides (Meet)
    const D = await open('/okr-bastidor.html');              // computador do ADM
    const P = await open('/okr-apresentacao.slide.html?tela=publico');
    await D.p.getByRole('button', { name: 'Iniciar apresentação ao vivo' }).click(); await D.p.waitForTimeout(400);
    await sync(D.p, S.p, P.p);
    // 1) os slides avançam no computador do Meet (teclado/clique lá)
    await S.p.evaluate(() => { window._okrGoTo(2); }); await S.p.waitForTimeout(400); await sync(S.p, D.p, P.p);
    const s1 = await pos(S.p), d1 = await pos(D.p), p1 = await pos(P.p);
    await D.p.waitForTimeout(1200);
    const nav = await Promise.all([S.p, D.p, P.p].map(p => p.evaluate(() => { const l = window.__store.kanban.okr.apresentacao_live; return l.navId + '|' + l.slide; })));
    t('quem só repete a navegação (Bastidor e público) não grava de volta (sem pingue-pongue)', nav[1] === nav[0] && nav[2] === nav[0], nav);
    t('o Bastidor acompanha o slide que o computador dos slides mostra', d1.key === s1.key, { s1, d1 });
    t('a Tela para o público também', p1.key === s1.key, { s1, p1 });
    // 2) o Bastidor avança: deve sair do slide atual da sala, não de um velho
    await D.p.getByRole('button', { name: /Próximo/ }).click(); await D.p.waitForTimeout(400); await sync(D.p, S.p, P.p);
    const s2 = await pos(S.p), d2 = await pos(D.p);
    t('Próximo no Bastidor vai para o slide seguinte ao da sala', d2.idx === s1.idx + 1 && s2.key === d2.key, { antes: s1, d2, s2 });
    // 3) abre o detalhe no computador dos slides; o Bastidor sabe que tem detalhe aberto
    const idxTech = await S.p.evaluate(() => slides.findIndex(x => x.primeiroObj === 'd2'));
    await S.p.evaluate(i => window._okrGoTo(i), idxTech); await S.p.waitForTimeout(300); await sync(S.p, D.p, P.p);
    await S.p.evaluate(() => window._okrOpenDetail('d2')); await S.p.waitForTimeout(400); await sync(S.p, D.p, P.p);
    const d3 = await pos(D.p), p3 = await pos(P.p);
    t('o Bastidor mostra o detalhe aberto pelo computador dos slides', d3.det === 'd2' && await D.p.evaluate(() => document.getElementById('bastidor-agora').textContent === 'Checkout'), d3);
    t('a Tela para o público abre o mesmo detalhe', p3.det === 'd2', p3);
    // 4) Próximo no Bastidor com o detalhe aberto vai para o próximo Objetivo
    await D.p.getByRole('button', { name: /Próximo/ }).click(); await D.p.waitForTimeout(400); await sync(D.p, S.p, P.p);
    t('Próximo no Bastidor troca o Objetivo na sala (slides e público)', (await pos(S.p)).det === 'd4' && (await pos(P.p)).det === 'd4', { s: await pos(S.p), p: await pos(P.p) });
    // 5) Fechar detalhe pelo Bastidor
    await D.p.getByRole('button', { name: 'Fechar detalhe', exact: true }).click(); await D.p.waitForTimeout(400); await sync(D.p, S.p, P.p);
    t('Fechar detalhe no Bastidor fecha nos slides e no público', !(await pos(S.p)).det && !(await pos(P.p)).det, { s: await pos(S.p), p: await pos(P.p) });
    // 6) Abrir detalhe pelo Bastidor
    await D.p.getByRole('button', { name: 'Abrir detalhe', exact: true }).click(); await D.p.waitForTimeout(400); await sync(D.p, S.p, P.p);
    t('Abrir detalhe no Bastidor abre o 1º Objetivo da gerência para a sala', (await pos(S.p)).det === 'd2' && (await pos(P.p)).det === 'd2', { s: await pos(S.p), p: await pos(P.p) });
    t('sem erro de JavaScript', ![S, D, P].some(x => x.erros.length), [S, D, P].map(x => x.erros));
  } finally { await b.close(); }
  console.log(falhas ? `\n${falhas} falha(s)` : '\nTUDO OK'); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
