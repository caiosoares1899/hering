// 🧮 O total (atual) da meta tem que bater com o histórico — caso real de 09/11/2026: Oceano 8.885.744 × histórico 9.023.296 (faltavam 137.552). Painel (painel-dev) + mare-metas-dev.js + Firebase falso.
//   python3 -m http.server 8941 &   node docs/arezzo/testes/test_metas_atual_confere.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const PAGE = process.env.PAGE || 'painel-dev.html';
const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana ADM', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const SFX = /-dev\.html/.test(PAGE) ? '_dev' : '';   // o módulo -dev lê kanban/metas_digital_dev e metas_log_dev
const DIA = 864e5, T0 = Date.parse('2026-11-01T12:00:00Z');
const PARTES = [886493, 1022936, 1058290, 1190561, 1078744, 1172160, 1215607, 1398505];
const logDe = (partes, ini) => { const o = {}; let v = ini || 0; partes.forEach((d, i) => { v += d; o[String(T0 + i * DIA).padStart(14, '0') + '_k' + i] = { v, t: T0 + i * DIA, d, nome: 'Caio' }; }); return o; };
const seed = (metas, logs) => ({ kanban: { usuarios: { ana: { uid: 'ana', nome: 'Ana ADM', email: 'ana@ciahering.com.br', inscrito: true, init: 'AA', role: 'adm', squads: { dados: true } } }, usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana ADM', init: 'AA', role: 'adm', squads: { dados: true } } }, config: { adm_emails: ['ana@ciahering.com.br'] }, ['metas_digital' + SFX]: metas, ['metas_log' + SFX]: logs } });
const meta = (id, o) => Object.assign({ id, titulo: id, tipo: 'meta', fmt: 'brl', alvo: 30000000, inicial: 0, ativo: true }, o);
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const abre = async (metas, logs) => { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed(metas, logs)); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8941/' + PAGE); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(2500);
    await p.evaluate(() => { MareMetas.iniciar({ todasSquads: true, onChange: () => { } }); }); await p.waitForTimeout(900); return { ctx, p, errs }; };
  const atual = (p, id) => p.evaluate(i => MareMetas.metasDigital().find(m => m.id === i).atual, id);

  { const { ctx, p, errs } = await abre({ nov: meta('nov', { atual: 8885744, atualT: T0 + 7 * DIA }) }, { nov: logDe(PARTES) });   // o caso real
    await p.evaluate(() => MareMetas.abrirEntradas(MareMetas.metasDigital()[0], { user: { uid: 'ana', nome: 'Ana' } })); await p.waitForTimeout(700);
    const av = await p.evaluate(() => { const e = document.getElementById('mm-e-div'); return e && !e.hidden ? e.innerText : null; });
    t('A. total abaixo do histórico: o modal 🗂 Entradas avisa e diz quanto falta (137,5 mil)', !!av && /não bate/.test(av) && /faltam R\$ 138 mil/.test(av), av);
    await p.click('#mm-e-fix'); await p.waitForTimeout(900);
    t('B. "Corrigir o total" acerta o atual pelo último ponto (9.023.296) e o aviso some', (await atual(p, 'nov')) === 9023296 && await p.evaluate(() => document.getElementById('mm-e-div').hidden), await atual(p, 'nov'));
    t('C. nenhuma entrada nova foi criada (o histórico já estava certo)', (await p.evaluate(() => MareMetas.lerEntradas('nov'))).length === 8, '');
    t('D. sem erro de JS', !errs.length, errs); await ctx.close(); }

  { const { ctx, p } = await abre({ nov: meta('nov', { atual: 8885744, atualT: T0 + 7 * DIA }) }, { nov: logDe(PARTES) });   // desvio antigo + novo lançamento: cura sozinho
    await p.evaluate(({ T0, DIA }) => { const m = MareMetas.metasDigital()[0]; return MareMetas.registrar(m, 100, { uid: 'ana', nome: 'Ana' }, '', T0 + 8 * DIA, { parte: true }); }, { T0, DIA }); await p.waitForTimeout(700);
    t('E. lançar uma parte com o atual defasado cura o desvio: total = 9.023.296 + 100', (await atual(p, 'nov')) === 9023396, await atual(p, 'nov')); await ctx.close(); }

  { const { ctx, p } = await abre({ nov: meta('nov', { atual: 8885744, atualT: T0 + 7 * DIA }) }, { nov: logDe(PARTES) });   // editar uma entrada também cura
    const r = await p.evaluate(async () => { const L = await MareMetas.lerEntradas('nov'); return MareMetas.mexerEntrada(MareMetas.metasDigital()[0], { tipo: 'edit', k: L[0].k, t: L[0].t, valor: 1000000, nota: '' }, { uid: 'ana', nome: 'Ana' }); }); await p.waitForTimeout(700);
    const L2 = await p.evaluate(() => MareMetas.lerEntradas('nov'));
    t('F. editar uma parte com o atual defasado: o total passa a ser o último ponto do histórico', r.ok && (await atual(p, 'nov')) === L2[L2.length - 1].v, [await atual(p, 'nov'), L2[L2.length - 1].v]); await ctx.close(); }

  { const { ctx, p } = await abre({ nov: meta('nov', { atual: 100 }) }, { nov: logDe([10]) });   // cópia da tela VELHA: o banco foi mexido por outra aba/pessoa sem a tela saber
    await p.evaluate(s => { window.__store.kanban['metas_digital' + s].nov.atual = 500; }, SFX);
    await p.evaluate(() => MareMetas.registrar(MareMetas.metasDigital()[0], 7, { uid: 'ana', nome: 'Ana' }, '', Date.now(), { parte: true })); await p.waitForTimeout(500);
    const v = await p.evaluate(s => window.__store.kanban['metas_digital' + s].nov.atual, SFX);
    t('G. a conta parte do valor LIDO AGORA do banco (500 + 7), não da cópia velha da tela (100 + 7)', v === 507, v); await ctx.close(); }

  { const { ctx, p } = await abre({ k: meta('k', { atual: 180, inicial: 0 }) }, {});   // valor-base digitado na ficha ANTES de existir histórico: continua somado
    for (const d of [10, 5, 7]) await p.evaluate(x => MareMetas.registrar(MareMetas.metasDigital()[0], x, { uid: 'ana', nome: 'Ana' }, '', Date.now() - 1000, { parte: true }), d);
    await p.waitForTimeout(500); t('H. valor-base da ficha (180) + partes (10, 5, 7) = 202: a cadeia não engole o valor-base', (await atual(p, 'k')) === 202, await atual(p, 'k'));
    await p.evaluate(() => MareMetas.abrirEntradas(MareMetas.metasDigital()[0], { user: { uid: 'ana', nome: 'Ana' } })); await p.waitForTimeout(600);
    t('I. total ACIMA do histórico (valor-base) não dispara aviso', await p.evaluate(() => document.getElementById('mm-e-div').hidden), '');
    await p.evaluate(async () => { const L = await MareMetas.lerEntradas('k'); await MareMetas.mexerEntrada(MareMetas.metasDigital()[0], { tipo: 'del', k: L[1].k }, { uid: 'ana', nome: 'Ana' }); }); await p.waitForTimeout(600);
    t('J. excluir uma parte mantém o valor-base (202 − 5 = 197)', (await atual(p, 'k')) === 197, await atual(p, 'k')); await ctx.close(); }

  { const { ctx, p } = await abre({ m: meta('m', { atual: 50 }) }, { m: { a: { v: 30, t: T0, nome: 'x' }, b: { v: 80, t: T0 + DIA, d: 50, nome: 'x' } } });   // mistura total avulso: não dá pra conferir sozinho
    const r = await p.evaluate(() => MareMetas.reconciliar(MareMetas.metasDigital()[0], { uid: 'ana', nome: 'Ana' }));
    t('K. histórico com total avulso: não corrige sozinho (explica o porquê) e não mexe no atual', r.ok === false && /mistura totais/.test(r.erro) && (await atual(p, 'm')) === 50, r); await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1); })();
