// painel-dev: rodada de UI/UX das abas Visão e Fluxo (v5.36) — Playwright + fakefb.
// Uso: (servidor estático na raiz, porta 8941)  node docs/arezzo/testes/test_painel_fluxo.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fake = require('./fakefb.js');
const PAGE = process.env.PAGE || 'painel-dev.html';
const U={uid:'ana',email:'ana@ciahering.com.br',displayName:'Ana ADM',photoURL:'',providerData:[{providerId:'google.com'}]};
const sd=()=>({kanban:{usuarios:{ana:{uid:'ana',nome:'Ana ADM',email:'ana@ciahering.com.br',inscrito:true,init:'AA',role:'adm',squads:{dados:true,prf:true}}},usuarios_publicos:{ana:{uid:'ana',nome:'Ana ADM',init:'AA'}},config:{adm_emails:['ana@ciahering.com.br']},squads_meta:{}}});
let ok=0, bad=0; const t=(n,c,d)=>{ if(c){ok++;console.log('  ✅',n);} else {bad++;console.log('  ❌',n,d===undefined?'':JSON.stringify(d));} };
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 const ctx=await b.newContext({viewport:{width:1280,height:900}}); await fake.install(ctx,sd());
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8941/'+PAGE); await p.waitForFunction(()=>!!window.__authCb);
 await p.evaluate(x=>window.__authCb(x),U); await p.waitForTimeout(2500);
 await p.evaluate(()=>{
  window._pollSquadDados=()=>{}; window._pollSquadSnapshots=()=>{};
  const DAY=864e5, now=Date.now(), ago=d=>new Date(now-d*DAY).toISOString();
  const noon=d=>{ const x=new Date(); x.setHours(12,0,0,0); x.setDate(x.getDate()-d); return x.toISOString(); };   // conclusão em dia de calendário fixo (sem flutuar com a hora do teste)
  SQUADS.splice(0,SQUADS.length,{id:'dados',label:'Squad Dados e IA',icon:'📊',color:'#38b6ff',wipLimit:2},{id:'prf',label:'Marketing de Performance',icon:'📱',color:'#1de9b6',wipLimit:3});
  const cols=[{id:'backlog',name:'Backlog'},{id:'todo',name:'A Fazer'},{id:'progress',name:'Em Progresso'},{id:'blocker',name:'Impedimentos'},{id:'done',name:'Concluído'}];
  const c=(id,col,o)=>({id,title:o.t||id,col,owner:'AA',createdAt:ago(o.cr||10).slice(0,10),archived:false,riscos:o.riscos||[],flow:{enteredAt:{[col]:ago(o.cr||10)},firstStartAt:o.start!=null?ago(o.start):null,doneAt:o.done!=null?noon(o.done):null,log:[]}});
  const A=[c('a1','backlog',{t:'Velho no backlog',cr:40}),c('a2','todo',{cr:9}),c('a3','progress',{t:'Em andamento 5d',cr:8,start:5,riscos:['dependência externa',{t:'risco objeto'}]}),c('a4','progress',{cr:6,start:3}),c('a5','progress',{cr:4,start:2}),c('a6','blocker',{cr:7,start:6}),
           c('a7','done',{cr:12,start:9,done:0}),c('a8','done',{cr:12,start:9,done:1}),c('a9','done',{cr:12,start:9,done:1})];
  const B=[c('b1','backlog',{cr:30}),c('b2','progress',{t:'Prf andamento',cr:5,start:4}),c('b3','done',{cr:12,start:9,done:0}),c('b4','done',{cr:12,start:9,done:3})];
  squadData.dados={cards:A,columns:cols,tags:[],agilCfg:{wip:2},members:[]}; squadData.prf={cards:B,columns:cols.map(x=>({...x})),tags:[],agilCfg:{wip:3},members:[]};
  try{ renderFilterBar(); }catch(e){} renderAll(); renderFlowMetrics();
 });
 console.log('Fluxo');
 await p.evaluate(()=>swPtab('fluxo')); await p.waitForTimeout(400);
 const f=await p.evaluate(()=>{
  const q=s=>document.querySelector(s), txt=s=>(q(s)||{}).textContent;
  const bars=[...document.querySelectorAll('#throughput-chart rect.tp-bar')];
  const cfd=[...document.querySelectorAll('#cfd-chart .wk-row')].map(r=>({nome:r.querySelector('.wk-name').textContent,tot:+r.querySelector('.wk-meta b').textContent,wip:(r.querySelector('.wk-wip')||{}).textContent,over:!!r.querySelector('.wk-wip.over'),segs:[...r.querySelectorAll('.wk-seg')].map(s=>s.style.background)}));
  const ag=[...document.querySelectorAll('#aging-list .aging-item')].map(r=>({t:r.querySelector('.aging-title').textContent,dot:r.querySelector('.wk-dot').style.background,age:r.querySelector('.aging-age').textContent,col:r.querySelector('.aging-col-tag').textContent}));
  return {age:txt('#m-age'),ageSub:txt('#m-age-sub'),ageCls:q('#m-age').className,tp:txt('#m-throughput'),tpSub:txt('#m-throughput-sub'),cyc:txt('#m-cycle'),nBars:bars.length,fills:[...new Set(bars.map(b=>b.getAttribute('fill')))],hover:document.querySelectorAll('#throughput-chart title').length,legend:[...document.querySelectorAll('#tp-legend .wk-lg')].map(x=>x.textContent),cfd,ag,agSub:txt('#aging-sub'),
          oldSecs:{trend:!!q('#trend-dados'),coldist:!!q('#col-dist')}};
 });
 t('"Parado há mais tempo" ignora o Backlog de 40d (mostra o em andamento mais velho: 6d bloqueado)', /^6/.test(f.age), f);
 t('KPI usa unidade separada (d) e cor neutra abaixo do limite', /d$/.test(f.age) && !/met-bad/.test(f.ageCls), f.ageCls);
 t('Throughput: 5 cards em 14 dias → 2.5/sem', /^2\.5/.test(f.tp) && /5 entregues/.test(f.tpSub), [f.tp,f.tpSub]);
 t('Entregas por dia: 1 segmento por (dia × squad) com entrega = 4', f.nBars===4, f.nBars);
 t('Entregas por dia: só cores de squad (#38b6ff, #1de9b6)', f.fills.length===2 && f.fills.includes('#38b6ff') && f.fills.includes('#1de9b6'), f.fills);
 t('Entregas por dia: legenda com os 2 squads + 14 alvos de hover', f.legend.length===2 && f.hover===14, [f.legend,f.hover]);
 t('Onde está o trabalho: 1 linha por squad', f.cfd.length===2, f.cfd);
 t('Dados: 6 abertos (2 na fila: Backlog + A Fazer · 3 em andamento · 1 bloqueado)', f.cfd[0] && f.cfd[0].tot===6, f.cfd[0]);
 t('Dados: WIP 4/2 em vermelho (andamento+bloqueado acima do limite)', f.cfd[0] && /WIP 4\/2/.test(f.cfd[0].wip) && f.cfd[0].over, f.cfd[0]);
 t('Dados: segmento de bloqueado em vermelho (var(--danger))', f.cfd[0] && f.cfd[0].segs.some(s=>/danger/.test(s)), f.cfd[0]);
 t('Prf: WIP 1/3 sem alerta', f.cfd[1] && /WIP 1\/3/.test(f.cfd[1].wip) && !f.cfd[1].over, f.cfd[1]);
 t('Aging: nenhum card de Backlog/fila na lista', f.ag.length>0 && !f.ag.some(a=>/Velho no backlog/.test(a.t)), f.ag);
 t('Aging: bolinha com a cor do squad', f.ag.some(a=>/56, 182, 255/.test(a.dot)) && f.ag.some(a=>/29, 233, 182/.test(a.dot)), f.ag.map(a=>a.dot));
 t('Aging: card bloqueado marcado com 🚧', f.ag.some(a=>/🚧/.test(a.col)), f.ag);
 t('Aging: subtítulo explica limite e fila', /tracejado/.test(f.agSub) && /na fila/.test(f.agSub), f.agSub);
 t('Seções "Tendência" e "Distribuição por coluna" saíram da aba', !f.oldSecs.trend && !f.oldSecs.coldist, f.oldSecs);
 // janela 30 dias
 await p.evaluate(()=>setFlowWindow(30)); await p.waitForTimeout(300);
 const h30=await p.evaluate(()=>document.querySelectorAll('#throughput-chart title').length);
 t('Janela 30d: 30 colunas diárias', h30===30, h30);
 await p.evaluate(()=>setFlowWindow(7)); await p.waitForTimeout(300);
 const h7=await p.evaluate(()=>document.querySelectorAll('#throughput-chart title').length);
 t('Janela 7d: 7 colunas', h7===7, h7);
 await p.evaluate(()=>setFlowWindow(14));
 // funções antigas seguem nulo-seguras
 const old=await p.evaluate(()=>{ try{ renderTrend(); renderColDist(); return 'ok'; }catch(e){ return e.message; } });
 t('renderTrend()/renderColDist() não quebram sem os containers', old==='ok', old);

 console.log('Visão');
 await p.evaluate(()=>swPtab('visao')); await p.waitForTimeout(300);
 const v=await p.evaluate(()=>{
  const q=s=>document.querySelector(s);
  return {head:[...document.querySelectorAll('#cmp-head th')].map(x=>x.textContent.trim()),rows:[...document.querySelectorAll('#cmp-body tr')].map(r=>({l:r.children[0].textContent,n:r.children.length,w:[...r.querySelectorAll('td.winner')].length})),
   sqBar:[...document.querySelectorAll('#squad-filter-bar .filter-btn')].map(x=>x.id),gerBar:[...document.querySelectorAll('#gerencia-bar .filter-btn')].map(x=>x.id),
   onl:['online-list','painel-online-list','okr-online-list','online-count','painel-online-count','okr-online-count'].every(i=>!!q('#'+i)),onCard:!!q('.on-card'),
   risco:[...document.querySelectorAll('#risco-list .panel-card')].map(x=>x.textContent),sqCards:document.querySelectorAll('#squad-cards > *').length};
 });
 t('Comparação: cabeçalho com 1 coluna por squad (2) + Métrica', v.head.length===3 && /Dados/.test(v.head[1]) && /Marketing/.test(v.head[2]), v.head);
 t('Comparação: toda linha tem 3 células', v.rows.length>5 && v.rows.every(r=>r.n===3), v.rows);
 t('Comparação: no máximo 1 vencedor por linha', v.rows.every(r=>r.w<=1), v.rows);
 t('Filtro de squad gerado a partir de SQUADS em #squad-filter-bar (Todos + 2)', v.sqBar.join()==='fb-all,fb-dados,fb-prf', v.sqBar);
 t('Barra de gerência intacta (não sobrescrita pelo filtro de squad)', v.gerBar.length===3 && v.gerBar.every(i=>/^fb-ger-/.test(i)), v.gerBar);
 t('Online: 3 listas e contadores no mesmo cartão', v.onl && v.onCard);
 t('Cards com risco: texto de risco (string e objeto) sem [object Object]', v.risco.length===1 && /dependência externa/.test(v.risco[0]) && /risco objeto/.test(v.risco[0]) && !/object Object/.test(v.risco[0]), v.risco);
 // filtro por squad esconde a comparação e mantém Fluxo coerente
 await p.evaluate(()=>setFilter('prf')); await p.waitForTimeout(300);
 await p.evaluate(()=>swPtab('fluxo')); await p.waitForTimeout(300);
 const fp=await p.evaluate(()=>({rows:document.querySelectorAll('#cfd-chart .wk-row').length,leg:document.querySelectorAll('#tp-legend .wk-lg').length,cmp:getComputedStyle(document.getElementById('cmp-section')).display}));
 t('Filtro Prf: Fluxo mostra só 1 squad e sem legenda; comparação oculta', fp.rows===1 && fp.leg===0 && fp.cmp==='none', fp);
 t('Sem erros de página', errs.length===0, errs.slice(0,3));
 console.log(bad?`\n${bad} FALHA(S) de ${ok+bad}`:`\nTUDO OK (${ok})`);
 await b.close(); process.exit(bad?1:0);
})();
