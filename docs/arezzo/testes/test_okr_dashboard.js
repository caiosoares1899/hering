// 📊 Dashboard do Radar (v2.58): hero + linha no desenho do gráfico de atingimento, situação clicável, "o que mudou", tabela. okr-dev.html (BASE=…/okr.html testa a prod).
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js'); const {objs,snaps}=require('./seed_okr_dashboard.js');
const BASE=process.env.BASE||'http://localhost:8941/okr-dev.html';
const U={uid:'ana',email:'ana@ciahering.com.br',displayName:'Ana ADM',photoURL:'',providerData:[{providerId:'google.com'}]};
const seed=()=>({kanban:{okr:{objetivos:JSON.parse(JSON.stringify(objs)),marcos:{},tags:{},reuniao_notas:{},snapshots:JSON.parse(JSON.stringify(snaps))},usuarios:{ana:{uid:'ana',nome:'Ana',email:'ana@ciahering.com.br',inscrito:true,init:'AA',role:'adm',squads:{dados:true}}},usuarios_publicos:{ana:{uid:'ana',nome:'Ana',init:'AA'}},config:{adm_emails:['ana@ciahering.com.br']}}});
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true; const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,300))); };
 for(const w of [1280,390]){
  const ctx=await b.newContext({viewport:{width:w,height:900}}); await fake.install(ctx,seed()); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto(BASE); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U); await p.waitForTimeout(2500);
  await p.evaluate(()=>{ _okrEntrarTorre('digital'); _okrSetView('historico'); }); await p.waitForTimeout(1200);
  const q=(s)=>p.evaluate(s=>document.querySelectorAll(s).length,s);
  t(`[${w}] sem os 4 KPIs antigos (número gigante só no hero)`, (await q('.okr-h-kpi'))===0 && (await q('.okr-h-hero-v'))===1, 'kpi');
  t(`[${w}] gráfico de linha usa o desenho do atingimento (.okr-ating-chart, pontos com anel e linha de referência 100%)`, (await q('#okr-h-line svg circle'))>=6 && (await q('#okr-h-line svg line[stroke-dasharray], #okr-h-line svg path[stroke-dasharray]'))>=1, 'svg');
  t(`[${w}] colunas empilhadas por situação (uma coluna por semana, segmentos com espaço)`, (await q('#okr-h-cols .okr-h-colg'))>=6, 'cols');
  t(`[${w}] sem rolagem lateral`, await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1), 'overflow');
  const tip=await p.evaluate(()=>{ const c=document.querySelector('#okr-h-line svg circle'); const h=[...document.querySelectorAll('#okr-h-line svg [data-tip]')][3]; return {tem:!!h, txt:h?h.getAttribute('data-tip'):''}; });
  t(`[${w}] ponto tem tooltip em texto puro (data-tip) com data, média e situação`, tip.tem && /%/.test(tip.txt) && /Objetivo/.test(tip.txt), tip);
  // situação clicável filtra a tabela
  const antes=await q('#okr-h-tbl .okr-h-tr.row');
  await p.click('.okr-h-sit-row:not(.zero) >> nth=0'); await p.waitForTimeout(500);
  const dep=await p.evaluate(()=>({n:document.querySelectorAll('#okr-h-tbl .okr-h-tr.row').length, f:_okrHistFiltro.status, on:!!document.querySelector('.okr-h-sit-row.on')}));
  t(`[${w}] clicar numa situação filtra a tabela (e marca a linha)`, dep.f && dep.on && dep.n<=antes && dep.n>0, {antes,dep});
  await p.click('.okr-h-sit-row.on'); await p.waitForTimeout(400);
  t(`[${w}] clicar de novo tira o filtro`, (await p.evaluate(()=>_okrHistFiltro.status))==='' && (await q('#okr-h-tbl .okr-h-tr.row'))===antes, 'toggle');
  t(`[${w}] ordenação padrão: pior situação primeiro`, (await p.evaluate(()=>_okrHistFiltro.ordem))==='pior', 'ordem');
  // visão detalhada (linha do Objetivo aberta)
  await p.click('#okr-h-tbl .okr-h-tr.row >> nth=0'); await p.waitForTimeout(500);
  const det=await p.evaluate(()=>({svg:document.querySelectorAll('#okr-h-det-line svg circle.okr-ating-dot').length, tip:!!document.querySelector('#okr-h-det-line [data-tip]'), th:[...document.querySelectorAll('.okr-h-semanas th')].map(x=>x.innerText), ov:document.documentElement.scrollWidth>window.innerWidth+1, larg:document.querySelector('#okr-h-det-line svg')?document.querySelector('#okr-h-det-line svg').getBoundingClientRect().width:0}));
  t(`[${w}] detalhe: curva do Objetivo no mesmo desenho do atingimento (pontos com anel, tooltip em texto puro)`, det.svg>=2 && det.tip, det);
  t(`[${w}] detalhe: tabela sem coluna redundante (Semana · Situação · Atingimento · Δ · Marcos), sem rolagem lateral`, det.th.join('|').replace(/\s/g,'')==='Semana|Situação|Atingimento|Δ|Marcos' && !det.ov, det);
  await p.click('#okr-h-tbl .okr-h-tr.row.aberto'); await p.waitForTimeout(300);
  t(`[${w}] clicar de novo fecha o detalhe`, (await q('#okr-h-det-line'))===0, 'fecha');
  // métrica Marcos e períodos
  await p.evaluate(()=>_okrHistMetricaSet && _okrHistMetricaSet('marcos')).catch(()=>{}); await p.waitForTimeout(300);
  t(`[${w}] trocar pra Marcos redesenha sem erro`, (await q('#okr-h-line svg'))===1 && (await p.evaluate(()=>document.querySelector('.okr-h-hero-l').innerText.length>3)), 'marcos');
  await p.evaluate(()=>{ const bt=[...document.querySelectorAll('.okr-h-range button')].find(x=>/4 sem/.test(x.innerText)); bt&&bt.click(); }); await p.waitForTimeout(400);
  t(`[${w}] período "4 sem" encurta o gráfico`, (await q('#okr-h-cols .okr-h-colg'))<=4, await q('#okr-h-cols .okr-h-colg'));
  t(`[${w}] sem erro de JS`, !errs.length, errs); await ctx.close(); }
 await b.close(); console.log(ok?'TUDO OK':'HÁ FALHAS'); })();
