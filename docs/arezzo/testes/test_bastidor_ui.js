// Bastidor do Radar em aba própria (okr-bastidor.html → okr-apresentacao.slide.html?tela=bastidor) — /melhoriauiux de 19/11/2026.
// Confere, em 1280 e 390 px: espera com botão da casa, quem apresenta, slide atual e o que vem a seguir, detalhe do Objetivo,
// alvos de 44 px, nada rolando para o lado, FPS fora da aba, Encerrar separado e o aviso de início próprio da aba.
const path = require('path');
const { chromium } = require(process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright');
const fake = require('./fakefb.js');
const BASE = process.env.APRESENTACAO_TEST_URL || 'http://localhost:8941';
const U = (uid, n) => ({ uid, email: uid + '@ciahering.com.br', displayName: n, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const mk = (id, t, o) => ({ id, titulo: t, areaId: 'geral', trimestres: ['2026-Q4'], responsaveis: ['ana'], tagIds: [], history: [], indicadores: ['i1'], progressos: ['p1'], proximosPassos: [], riscos: [], planosAcao: [], descricao: 'desc', torre: 'digital', ...o });
const LONGO = 'Aumentar a conversão do checkout no app e no site durante a Black Friday sem perder margem';
const seed = () => ({ kanban: { okr: { objetivos: {
  d1: mk('d1', 'Fidelidade', { areaId: 'crm', ordem: 0 }), d2: mk('d2', LONGO, { areaId: 'tech', ordem: 0 }),
  d3: mk('d3', 'NPS', { areaId: 'cx', ordem: 0 }), d4: mk('d4', 'Pagamentos', { areaId: 'tech', ordem: 1 }) }, marcos: {}, tags: {}, reuniao_notas: {} },
  usuarios: { ana: { uid: 'ana', nome: 'Ana ADM', email: 'ana@ciahering.com.br', inscrito: true, init: 'AA' } },
  usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana ADM', init: 'AA' } }, config: { adm_emails: ['ana@ciahering.com.br'] } } });
let falhas = 0; const t = (n, ok, d) => { if (!ok) falhas++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
const texto = (p, sel) => p.evaluate(s => (document.querySelector(s)?.textContent || '').replace(/\s+/g, ' ').trim(), sel);
const medir = p => p.evaluate(() => ({
  rolagemLateral: document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('#bastidor-pagina *')].some(e => e.offsetParent && e.getBoundingClientRect().right > innerWidth + 1),
  pequenos: [...document.querySelectorAll('#bastidor-pagina :is(button,select)')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 44).map(e => e.id || e.textContent.trim()),
}));
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  try {
    for (const [w, h] of [[1280, 800], [390, 800]]) {
      const ctx = await b.newContext({ viewport: { width: w, height: h } }); await fake.install(ctx, seed());
      const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message)); p.on('dialog', d => d.accept());
      await p.goto(BASE + '/okr-bastidor.html'); await p.waitForFunction(() => !!window.__authCb);
      await p.evaluate(x => window.__authCb(x), U('ana', 'Ana ADM')); await p.waitForTimeout(1500);
      const iniciar = p.getByRole('button', { name: 'Iniciar apresentação ao vivo' });
      t(`[${w}] espera: Iniciar com alvo de 44 px e cor de ação`, await iniciar.isVisible() && await iniciar.evaluate(e => e.getBoundingClientRect().height >= 44 && getComputedStyle(e).backgroundColor !== 'rgb(239, 239, 239)'), await iniciar.evaluate(e => getComputedStyle(e).backgroundColor));
      await iniciar.click(); await p.waitForTimeout(700);
      t(`[${w}] aviso de início fala da tela para o público, não do 🎙️ da aba dos slides`, /tela para o público/.test(await texto(p, '#live-toast')) && !/canto da tela/.test(await texto(p, '#live-toast')), await texto(p, '#live-toast'));
      t(`[${w}] mostra quem apresenta`, (await texto(p, '#bastidor-quem')) === 'Você está apresentando', await texto(p, '#bastidor-quem'));
      const agora = await p.evaluate(() => slides[currentIdx].title), seguir = await p.evaluate(() => slides[currentIdx + 1]?.title || '');
      t(`[${w}] mostra o slide atual e o que vem a seguir`, (await texto(p, '#bastidor-agora')) === agora && (await texto(p, '#bastidor-seguir')) === seguir && /Slide 1 de/.test(await texto(p, '#estado')), { agora, seguir });
      t(`[${w}] FPS fica fora da aba (só faz sentido no computador dos slides)`, !(await p.locator('#fps').isVisible()), '');
      t(`[${w}] Próximo é o único botão de ação principal`, await p.evaluate(() => { const cor = e => getComputedStyle(e).backgroundColor; const prox = cor(document.getElementById('proximo')); return [...document.querySelectorAll('#bastidor-controles button')].filter(e => cor(e) === prox).map(e => e.id).join() === 'proximo'; }), '');
      t(`[${w}] Encerrar fica separado, no fim`, await p.evaluate(() => !!document.querySelector('.bst-fim #bastidor-encerrar')), '');
      await p.evaluate(() => window._okrOpenDetail('d2')); await p.waitForTimeout(400);
      t(`[${w}] detalhe: título do Objetivo em destaque e o próximo da gerência`, (await texto(p, '#bastidor-agora')) === LONGO && (await texto(p, '#bastidor-seguir')) === 'Pagamentos' && (await texto(p, '#estado')) === 'Detalhe do Objetivo', { a: await texto(p, '#bastidor-agora'), s: await texto(p, '#bastidor-seguir') });
      let m = await medir(p);
      t(`[${w}] sem rolagem lateral com título longo e alvos de pelo menos 44 px`, !m.rolagemLateral && !m.pequenos.length, m);
      await p.evaluate(() => { window._okrCloseDetail(); const st = window.__store.kanban.okr.apresentacao_live; st.apresentador = { uid: 'eve', nome: 'Eve Souza' };
        (window.__lis || []).filter(l => l.p === 'kanban/okr/apresentacao_live').forEach(l => l.cb({ val: () => JSON.parse(JSON.stringify(st)), exists: () => true, key: 'apresentacao_live' })); });
      await p.waitForTimeout(400);
      t(`[${w}] outra pessoa apresentando: o selo diz quem e explica por que as setas estão desligadas`, (await texto(p, '#bastidor-quem')) === 'Eve Souza está apresentando' && /retomar o controle/.test(await texto(p, '#bastidor-dica-controle')) && await p.locator('#proximo').isDisabled() && !(await p.locator('#retomar').isDisabled()), await texto(p, '#bastidor-quem'));
      t(`[${w}] sem erro de JavaScript`, !erros.length, erros);
      await ctx.close();
    }
  } finally { await b.close(); }
  console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo'); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
