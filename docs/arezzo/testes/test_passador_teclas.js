// Passador físico (controle de apresentação) e teclado na apresentação ao vivo do Radar — /monitorarbugs de 19/11/2026, antes da reunião.
// O passador físico manda PageDown/PageUp (alguns, setas). Confere: (1) a aba dos slides aceita PageDown/PageUp, no slide e no detalhe;
// (2) depois de clicar no passador 🎛️ o foco fica na janela flutuante, e as teclas que chegam lá também navegam;
// (3) no Bastidor em janela, digitar a anotação com as setas não troca de slide. Precisa da janela flutuante de verdade (Chrome).
const { chromium } = require(process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright');
const fake = require('./fakefb.js');
const BASE = process.env.APRESENTACAO_TEST_URL || 'http://localhost:8941';
const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana ADM', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const mk = (id, t, o) => ({ id, titulo: t, areaId: 'geral', trimestres: ['2026-Q4'], responsaveis: ['ana'], tagIds: [], history: [], indicadores: ['i1'], progressos: ['p1'], proximosPassos: [], riscos: [], planosAcao: [], descricao: 'd', torre: 'digital', ...o });
const seed = () => ({ kanban: { okr: { objetivos: { d2: mk('d2', 'Checkout', { areaId: 'tech', ordem: 0 }), d4: mk('d4', 'Pagamentos', { areaId: 'tech', ordem: 1 }), d1: mk('d1', 'Fidelidade', { areaId: 'crm' }) }, marcos: {}, tags: {}, reuniao_notas: {} },
  usuarios: { ana: { uid: 'ana', nome: 'Ana ADM', email: U.email, inscrito: true } }, usuarios_publicos: { ana: { nome: 'Ana ADM' } }, config: { adm_emails: [U.email] } } });
let falhas = 0; const t = (n, ok, d) => { if (!ok) falhas++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
const est = p => p.evaluate(() => ({ idx: currentIdx, det: document.getElementById('detail-ov').classList.contains('open') ? _okrDetailCurrentId : '', sala: window.__store.kanban.okr.apresentacao_live?.slide }));
const teclaNaJanela = (p, key) => p.evaluate(k => { const w = window.documentPictureInPicture.window; const alvo = w.document.activeElement || w.document.body; alvo.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); }, key);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); await fake.install(ctx, seed());
    const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto(BASE + '/okr-apresentacao.slide.html'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(1500);
    await p.evaluate(() => window._liveComecar()); await p.waitForTimeout(400);
    // 1) aba dos slides
    await p.locator('body').click({ position: { x: 640, y: 400 } }).catch(() => {});
    await p.keyboard.press('PageDown'); await p.waitForTimeout(300);
    t('aba dos slides: PageDown (passador físico) avança', (await est(p)).idx === 1, await est(p));
    await p.keyboard.press('PageUp'); await p.waitForTimeout(300);
    t('aba dos slides: PageUp volta', (await est(p)).idx === 0, await est(p));
    const ti = await p.evaluate(() => slides.findIndex(x => x.primeiroObj === 'd2'));
    await p.evaluate(i => window._okrGoTo(i), ti); await p.evaluate(() => window._okrOpenDetail('d2')); await p.waitForTimeout(400);
    await p.keyboard.press('PageDown'); await p.waitForTimeout(400);
    t('aba dos slides com o detalhe aberto: PageDown vai ao próximo Objetivo', (await est(p)).det === 'd4', await est(p));
    await p.evaluate(() => window._okrCloseDetail()); await p.evaluate(() => window._okrGoTo(0)); await p.waitForTimeout(400);
    // 2) janela flutuante compacta com o foco
    await p.locator('#live-passador').click();
    await p.waitForFunction(() => !!window.documentPictureInPicture?.window?.document.getElementById('proximo'), null, { timeout: 5000 });
    await p.evaluate(() => { const d = window.documentPictureInPicture.window.document; d.getElementById('proximo').click(); d.getElementById('proximo').focus(); }); await p.waitForTimeout(400);
    const antes = (await est(p)).idx;
    await teclaNaJanela(p, 'PageDown'); await p.waitForTimeout(400);
    t('com o foco no passador, PageDown avança a sala', (await est(p)).idx === antes + 1 && (await est(p)).sala === await p.evaluate(() => slides[currentIdx].key), { antes, depois: await est(p) });
    await teclaNaJanela(p, 'ArrowLeft'); await p.waitForTimeout(400);
    t('com o foco no passador, ← volta', (await est(p)).idx === antes, await est(p));
    await teclaNaJanela(p, 'PageUp'); await p.waitForTimeout(400);
    t('com o foco no passador, PageUp volta', (await est(p)).idx === antes - 1, await est(p));
    await p.evaluate(i => window._okrGoTo(i), ti); await p.evaluate(() => window._okrOpenDetail('d2')); await p.waitForTimeout(400);
    await teclaNaJanela(p, 'ArrowRight'); await p.waitForTimeout(400);
    t('com o foco no passador e o detalhe aberto, → vai ao próximo Objetivo', (await est(p)).det === 'd4', await est(p));
    await p.evaluate(() => window._okrCloseDetail()); await p.waitForTimeout(300);
    await p.evaluate(() => window.documentPictureInPicture.window.close()); await p.waitForFunction(() => !window.documentPictureInPicture.window);
    // 3) Bastidor em janela: setas dentro da anotação são do texto
    await p.evaluate(() => window._livePainel(true)); await p.getByRole('button', { name: 'Abrir bastidor', exact: true }).click();
    await p.waitForFunction(() => !!window.documentPictureInPicture?.window?.document.getElementById('rascunho'), null, { timeout: 5000 });
    const i0 = (await est(p)).idx;
    await p.evaluate(() => window.documentPictureInPicture.window.document.getElementById('rascunho').focus());
    await teclaNaJanela(p, 'ArrowRight'); await teclaNaJanela(p, 'PageDown'); await p.waitForTimeout(400);
    t('no Bastidor, setas e PageDown dentro da anotação não trocam de slide', (await est(p)).idx === i0, { i0, depois: await est(p) });
    await p.evaluate(() => window.documentPictureInPicture.window.document.getElementById('proximo').focus());
    await teclaNaJanela(p, 'PageDown'); await p.waitForTimeout(400);
    t('no Bastidor, fora da anotação, PageDown avança', (await est(p)).idx === i0 + 1, await est(p));
    t('sem erro de JavaScript', !erros.length, erros);
  } finally { await b.close(); }
  console.log(falhas ? `\n${falhas} falha(s)` : '\nTUDO OK'); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
