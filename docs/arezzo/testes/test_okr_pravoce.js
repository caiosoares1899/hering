// ⭐ Radar — faixa "Pra você" (R3 da consultoria de 09/11/2026): até 4 números MEUS no topo da lista, cada um clicável
// (meus Objetivos, parados, em risco ou atrasados, Marcos meus com prazo em até 14 dias). Quem não é responsável por nada não vê.
// Rodar: python3 -m http.server 8961 --directory . (na raiz) e `node docs/arezzo/testes/test_okr_pravoce.js`. BASE_URL troca o servidor.
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const chromeRoot = path.join(home, 'hering-tools/chrome');
const chrome = process.env.CHROME || path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8961';
const out = path.join(__dirname, '../../capturas/okr-pravoce');
const user = (uid, nome) => ({ uid, email: uid + '@ciahering.com.br', displayName: nome, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const HOJE = new Date('2026-11-10T12:00:00');
const REC = '2026-11-08T12:00:00.000Z', VELHO = '2026-08-01T12:00:00.000Z';
const ob = (id, t, o) => ({ id, titulo: t, areaId: 'geral', torre: 'digital', responsaveis: ['ana'], tagIds: [], history: [], ordem: 0, indicadores: [], progressoPct: 0, trimestres: ['T426'], criadoEm: REC, atualizadoEm: REC, ...o });
const mc = (id, obj, o) => ({ id, objetivoId: obj, titulo: 'Marco ' + id, progresso: 'no_prazo', responsavel: 'ana', criadoEm: REC, atualizadoEm: REC, ...o });
const seed = () => ({ kanban: { okr: { objetivos: {
    o1: ob('o1', 'Meu em dia'),
    o2: ob('o2', 'Meu parado e em risco', { criadoEm: VELHO, atualizadoEm: VELHO }),
    o3: ob('o3', 'Da Bia com Marco meu', { responsaveis: ['bia'] }),
    o4: ob('o4', 'Só da Bia', { responsaveis: ['bia'] }),
    o5: ob('o5', 'Meu arquivado', { arquivado: true }),
  }, marcos: {
    m1: mc('m1', 'o1', { prazo: '2026-11-15' }),
    m4: mc('m4', 'o1', { prazo: '2026-11-05' }),                                   // vencido
    m5: mc('m5', 'o1', { prazo: '2026-12-30' }),                                   // longe: fora
    m6: mc('m6', 'o1', { prazo: '2026-11-12', progresso: 'concluido' }),           // concluído: fora
    m2: mc('m2', 'o2', { progresso: 'risco', responsavel: 'bia', prazo: '2026-11-01', criadoEm: VELHO, atualizadoEm: VELHO }),
    m3: mc('m3', 'o3', { progresso: 'atrasado', prazo: '2026-11-20' }),
    m7: mc('m7', 'o4', { responsavel: 'bia', prazo: '2026-11-11' }),
  }, tags: {} },
  usuarios: { ana: { uid: 'ana', nome: 'Ana Lima', email: 'ana@ciahering.com.br', inscrito: true }, bia: { uid: 'bia', nome: 'Bia', email: 'bia@ciahering.com.br', inscrito: true }, cae: { uid: 'cae', nome: 'Cauê', email: 'cae@ciahering.com.br', inscrito: true } },
  config: { adm_emails: ['ana@ciahering.com.br'] } } });

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: chrome }); let falhas = 0, total = 0;
  const t = (n, c, d) => { total++; if (!c) falhas++; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 400))); };
  const open = async (u, vp, theme) => { const ctx = await b.newContext({ viewport: vp || { width: 1280, height: 800 } }); await fake.install(ctx, seed()); const p = await ctx.newPage(); await p.clock.setFixedTime(HOJE); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/okr-dev.html?torre=digital'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), u); await p.waitForTimeout(1500);
    if (theme) await p.evaluate(th => document.documentElement.setAttribute('data-theme', th), theme); return { ctx, p, errs }; };
  const chips = p => p.evaluate(() => [...document.querySelectorAll('#okr-pravoce .okr-pv-chip')].map(c => ({ txt: c.textContent.replace(/\s+/g, ' ').trim(), on: c.getAttribute('aria-pressed') })));
  const titulos = p => p.evaluate(() => [...document.querySelectorAll('#okr-objetivos-wrap .okr-card-title')].map(e => e.textContent.trim()).sort());
  const clica = async (p, k) => { await p.click(`#okr-pravoce .okr-pv-chip[onclick*="'${k}'"]`); await p.waitForTimeout(300); };

  { const { ctx, p, errs } = await open(user('ana', 'Ana Lima'));
    const c = await chips(p);
    t('Ana: 4 números — 3 meus (inclui o da Bia com Marco meu), 1 parado, 2 em risco/atrasados, 3 Marcos em 14 dias (1 vencido)',
      c.length === 4 && /3 Objetivos meus/.test(c[0].txt) && /1 parado/.test(c[1].txt) && /2 em risco ou atrasados/.test(c[2].txt) && /3 Marcos em até 14 dias \(1 vencido\)/.test(c[3].txt), c);
    t('faixa acima do resumo e da lista', await p.evaluate(() => { const a = document.getElementById('okr-pravoce'), s = document.getElementById('okr-stats-strip'); return !!a.querySelector('.okr-pravoce') && (a.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING) > 0; }), '');
    const todos = await titulos(p);
    await clica(p, 'meus'); const l1 = await titulos(p);
    t('🎯 meus: só os 3 meus; o filtro de pessoa vira "⭐ Eu"', JSON.stringify(l1) === JSON.stringify(['Da Bia com Marco meu', 'Meu em dia', 'Meu parado e em risco']) && (await p.inputValue('#okr-filter-pessoa')) === '__eu', l1);
    t('🎯 marcado como ativo (aria-pressed)', (await chips(p))[0].on === 'true', await chips(p));
    await clica(p, 'meus'); t('clicar de novo volta a todos', JSON.stringify(await titulos(p)) === JSON.stringify(todos), await titulos(p));
    await clica(p, 'parados'); t('🧊 parados: só o meu parado', JSON.stringify(await titulos(p)) === JSON.stringify(['Meu parado e em risco']), await titulos(p));
    await clica(p, 'atencao'); t('⚠️ em risco ou atrasados: os 2 meus (risco e atrasado), troca do filtro anterior', JSON.stringify(await titulos(p)) === JSON.stringify(['Da Bia com Marco meu', 'Meu parado e em risco']) && (await chips(p)).filter(x => x.on === 'true').length === 1, await titulos(p));
    await clica(p, 'marcos'); t('📅 Marcos: os Objetivos com Marco meu vencendo (o1 e o3), não o de Marco da Bia', JSON.stringify(await titulos(p)) === JSON.stringify(['Da Bia com Marco meu', 'Meu em dia']), await titulos(p));
    t('"✕ Limpar filtros" aparece com o recorte da faixa', await p.evaluate(() => getComputedStyle(document.getElementById('okr-clear-filters-btn')).display !== 'none'), '');
    await p.evaluate(() => _okrClearFilters()); await p.waitForTimeout(300);
    t('limpar filtros desliga a faixa e volta a todos', JSON.stringify(await titulos(p)) === JSON.stringify(todos) && (await chips(p)).every(x => x.on === 'false'), await chips(p));
    await p.screenshot({ path: path.join(out, 'ana-1280.png'), clip: { x: 0, y: 0, width: 1280, height: 520 } });
    t('sem erro de JS', !errs.length, errs); await ctx.close(); }

  { const { ctx, p } = await open(user('cae', 'Cauê'));
    t('Cauê (não é responsável por nada): sem faixa', (await p.locator('#okr-pravoce .okr-pravoce').count()) === 0, ''); await ctx.close(); }

  { const { ctx, p } = await open(user('bia', 'Bia'));
    const c = await chips(p);
    t('Bia: só os números dela (3 Objetivos: o2 pelo Marco, o3, o4; sem parado porque o4 e o3 andaram)', c.length >= 1 && /3 Objetivos meus/.test(c[0].txt), c); await ctx.close(); }

  for (const [nome, th] of [['abrolhos', null], ['lencois', 'light'], ['vice', 'vice']]) for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 800 }]) {
    const { ctx, p, errs } = await open(user('ana', 'Ana Lima'), vp, th);
    t(nome + ' ' + vp.width + 'px: faixa visível, sem rolagem lateral, sem erro', (await p.locator('#okr-pravoce .okr-pv-chip').count()) === 4 && (await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)) && !errs.length, errs);
    if (vp.width === 390) await p.screenshot({ path: path.join(out, nome + '-390.png'), clip: await p.locator('#okr-pravoce').boundingBox() });
    await ctx.close(); }

  await b.close(); console.log(`\n${total - falhas}/${total} ok`); process.exit(falhas ? 1 : 0);
})();
