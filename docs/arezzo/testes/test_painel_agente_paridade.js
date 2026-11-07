// 🤖 Paridade: o número que o AGENTE (ferramentas de leitura) devolve = o número que a ABA do Painel mostra. Este é o teste de ouro do docs/AGENTE_AGIL_PAINEL.md §3.2.
// Os MESMOS cards alimentam (a) o painel-dev.html no navegador (como test_painel_fluxo.js) e (b) as ferramentas reais sobre um banco falso; o fuso é o de Brasília nos dois lados.
// PW_MODULE=… CHROME_PATH=… node test_painel_agente_paridade.js   (python3 -m http.server 8941 na raiz do repo)
const { chromium } = require(process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const { buildPainelTools } = require('../../../functions/agente-agil-orquestrador/painel/ferramentas'); const { makeFakeDb } = require('../../../functions/agente-agil/__tests__/fakeDb');
const PAGE = process.env.PAGE || 'painel-dev.html';
const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana ADM', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const sd = () => ({ kanban: { usuarios: { ana: { uid: 'ana', nome: 'Ana ADM', email: 'ana@ciahering.com.br', inscrito: true, init: 'AA', role: 'adm', squads: { dados: true, prf: true } } }, usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana ADM', init: 'AA' } }, config: { adm_emails: ['ana@ciahering.com.br'] }, squads_meta: {} } });
const DAY = 864e5, agora = Date.now(), ago = d => new Date(agora - d * DAY).toISOString();
const noon = d => { const x = new Date(agora); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - d); return x.toISOString(); };   // conclusão em dia de calendário fixo
const cols = [{ id: 'backlog', name: 'Backlog' }, { id: 'todo', name: 'A Fazer' }, { id: 'progress', name: 'Em Progresso' }, { id: 'blocker', name: 'Impedimentos' }, { id: 'done', name: 'Concluído' }];
const c = (id, col, o) => ({ id, title: o.t || id, col, owner: 'AA', createdAt: ago(o.cr || 10).slice(0, 10), archived: false, riscos: [], flow: { enteredAt: { [col]: ago(o.cr || 10) }, firstStartAt: o.start != null ? ago(o.start) : null, doneAt: o.done != null ? noon(o.done) : null, log: [] }, due: o.due });
const dia = n => { const x = new Date(agora); x.setDate(x.getDate() + n); return x.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); };
const A = [c('a1', 'backlog', { t: 'Velho no backlog', cr: 40 }), c('a2', 'todo', { cr: 9, due: dia(-2) }), c('a3', 'progress', { t: 'Em andamento 5d', cr: 8, start: 5, due: dia(0) }), c('a4', 'progress', { cr: 6, start: 3, due: dia(2) }), c('a5', 'progress', { cr: 4, start: 2 }), c('a6', 'blocker', { cr: 7, start: 6 }),
  c('a7', 'done', { cr: 12, start: 9, done: 0 }), c('a8', 'done', { cr: 12, start: 9, done: 1 }), c('a9', 'done', { cr: 20, start: 15, done: 6 }), c('a10', 'done', { cr: 40, start: 30, done: 20 }),
  // fronteiras das janelas (7/14/30 dias) e tempos de ciclo variados: sem isso uma janela deslocada em 1 dia ou um percentil errado passam despercebidos
  c('a11', 'done', { cr: 25, start: 12, done: 7 }), c('a12', 'done', { cr: 30, start: 20, done: 13 }), c('a13', 'done', { cr: 33, start: 17, done: 14 }), c('a14', 'done', { cr: 19, start: 3, done: 6 }), c('a15', 'done', { cr: 9, start: 2, done: 29 })];
const B = [c('b1', 'backlog', { cr: 30 }), c('b2', 'progress', { t: 'Prf andamento', cr: 5, start: 4 }), c('b3', 'done', { cr: 12, start: 9, done: 0 }), c('b4', 'done', { cr: 12, start: 9, done: 3 })];
let ok = 0, bad = 0; const t = (n, cnd, d) => { if (cnd) { ok++; console.log('  ✅', n); } else { bad++; console.log('  ❌', n, d === undefined ? '' : String(JSON.stringify(d)).slice(0, 400)); } };
const num = s => { const m = String(s || '').match(/-?\d+(?:[.,]\d+)?/); return m ? Number(m[0].replace(',', '.')) : null; };
(async () => {
  const dbTool = (env) => makeFakeDb({ kanban: { squads_meta: {}, squads: { dados: { dados: { cards: A, columns: cols, agil_cfg: { wip: 2 }, flow_baseline: {} } }, prf: { dados: { cards: B, columns: cols.map(x => ({ ...x })), agil_cfg: { wip: 3 }, flow_baseline: {} } } } } });
  const ferr = (nome, input) => buildPainelTools({ db: dbTool(), env: 'prod', papel: 'adm' }).find(x => x.name === nome).handler(input);
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/Sao_Paulo' }); await fake.install(ctx, sd());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8941/' + PAGE); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(2500);
  await p.evaluate(([A, B, cols]) => { window._pollSquadDados = () => { }; window._pollSquadSnapshots = () => { };
    SQUADS.splice(0, SQUADS.length, { id: 'dados', label: 'Squad Dados e IA', icon: '📊', color: '#38b6ff', wipLimit: 2 }, { id: 'prf', label: 'Marketing de Performance', icon: '📱', color: '#1de9b6', wipLimit: 3 });
    squadData.dados = { cards: A, columns: cols, tags: [], agilCfg: { wip: 2 }, members: [] }; squadData.prf = { cards: B, columns: cols.map(x => ({ ...x })), tags: [], agilCfg: { wip: 3 }, members: [] };
    try { renderFilterBar(); } catch (e) { } renderAll(); }, [A, B, cols]);

  for (const dias of [7, 14, 30]) {
    console.log('Fluxo · ' + dias + ' dias');
    await p.evaluate(d => { swPtab('fluxo'); setFlowWindow(d); }, dias); await p.waitForTimeout(500);
    const tela = await p.evaluate(() => { const q = s => (document.querySelector(s) || {}).textContent || ''; return { cyc: q('#m-cycle'), cycSub: q('#m-cycle-sub'), lead: q('#m-lead'), leadSub: q('#m-lead-sub'), tp: q('#m-throughput'), tpSub: q('#m-throughput-sub'), age: q('#m-age'), ageSub: q('#m-age-sub'),
      cfd: [...document.querySelectorAll('#cfd-chart .wk-row')].map(r => ({ tot: +r.querySelector('.wk-meta b').textContent, wip: (r.querySelector('.wk-wip') || {}).textContent })) }; });
    const f = await ferr('painel_fluxo', { dias });
    t('tempo de ciclo: mediana', num(tela.cyc) === f.cycle_time.mediana_dias, [tela.cyc, f.cycle_time.mediana_dias]);
    t('tempo de ciclo: P85 e amostra (subtítulo da tela)', num((tela.cycSub.match(/P85\s*([\d.,]+)/) || [])[1]) === f.cycle_time.p85_dias && num((tela.cycSub.match(/(\d+)\s*cards/) || [])[1]) === f.cycle_time.amostra, [tela.cycSub, f.cycle_time]);
    t('lead time: mediana, P85 e amostra', num(tela.lead) === f.lead_time.mediana_dias && num((tela.leadSub.match(/P85\s*([\d.,]+)/) || [])[1]) === f.lead_time.p85_dias && num((tela.leadSub.match(/(\d+)\s*cards/) || [])[1]) === f.lead_time.amostra, [tela.lead, tela.leadSub, f.lead_time]);
    t('vazão por semana e entregues na janela', num(tela.tp) === f.vazao.por_semana && num(tela.tpSub) === f.vazao.entregues, [tela.tp, tela.tpSub, f.vazao]);
    t('"Parado há mais tempo" (maior idade em andamento, sem fila)', Math.round(num(tela.age)) === (f.wip.parado_ha_mais_tempo || {}).idade_dias, [tela.age, f.wip.parado_ha_mais_tempo]);
    const abertosTela = tela.cfd.reduce((s, r) => s + r.tot, 0);
    t('"Onde está o trabalho": abertos da tela = em andamento + fila da ferramenta', abertosTela === f.wip.em_andamento + f.wip.na_fila, [abertosTela, f.wip.em_andamento, f.wip.na_fila]);
  }
  console.log('Visão (cartões por squad)');
  const v = await ferr('painel_visao', {});
  const porSquad = Object.fromEntries(v.squads.map(s => [s.squad, s]));
  const cfd = await p.evaluate(() => { swPtab('fluxo'); setFlowWindow(14); return [...document.querySelectorAll('#cfd-chart .wk-row')].map(r => ({ nome: r.querySelector('.wk-name').textContent, tot: +r.querySelector('.wk-meta b').textContent, wip: (r.querySelector('.wk-wip') || {}).textContent })); });
  await p.waitForTimeout(300);
  t('Dados: WIP e limite batem com a tela (WIP 3/2)', /WIP 3\/2/.test(cfd[0].wip) && porSquad.dados.wip === 3 && porSquad.dados.limite_wip === 2, [cfd[0], porSquad.dados]);
  t('Prf: WIP e limite batem com a tela (WIP 1/3)', /WIP 1\/3/.test(cfd[1].wip) && porSquad.prf.wip === 1 && porSquad.prf.limite_wip === 3, [cfd[1], porSquad.prf]);
  t('abertos por squad (tela) = ativos − entregues (ferramenta)', cfd[0].tot === porSquad.dados.ativos - porSquad.dados.entregues && cfd[1].tot === porSquad.prf.ativos - porSquad.prf.entregues, [cfd, porSquad]);
  t('prazos: 1 vencido, 1 vence hoje, 2 vencendo (hoje + em 2 dias) no squad Dados', porSquad.dados.prazos.vencidos === 1 && porSquad.dados.prazos.vence_hoje === 1 && porSquad.dados.prazos.vencendo === 2, porSquad.dados.prazos);
  t('bloqueados do squad Dados = 1 (coluna Impedimentos)', porSquad.dados.bloqueados === 1, porSquad.dados);
  t('sem erro de JS na página', !errs.length, errs);
  await b.close(); console.log(bad ? `\n❌ ${bad} falha(s), ${ok} ok` : `\nTUDO OK (${ok})`); process.exit(bad ? 1 : 0);
})();
