// ⚡ /otimizaçãoderotina (2026-10-10): o listener de kanban/dados_diarios só pede os últimos 15 dias ao servidor (orderByKey + limitToLast), e a Central de Dados continua igual.
// kanban-dev (padrão) — K=kanban testa a prod. Roda o BOOT REAL do kanban com o Firebase falso.
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const K=process.env.K||'kanban-dev';
const U={uid:'eve',email:'eve@ciahering.com.br',displayName:'Eve',photoURL:'',providerData:[{providerId:'google.com'}]};
const dias=n=>{ const o={}; for(let i=0;i<n;i++){ const d=new Date(Date.UTC(2026,8,1)+i*864e5).toISOString().slice(0,10); o[d]={capDia:1000+i,capAcum:5000+i,metaDia:1000,autorNome:'Ana'}; } return o; };
const seed=()=>({kanban:{usuarios:{eve:{uid:'eve',nome:'Eve',email:'eve@ciahering.com.br',inscrito:true,init:'EV',role:'membro',squads:{dev:true}}},usuarios_publicos:{eve:{uid:'eve',nome:'Eve',init:'EV',role:'membro',squads:{dev:true}}},config:{adm_emails:[]},squads_meta:{dev:{label:'Dev',emoji:'💻',color:'#1de9b6'}},dados_diarios:dias(40)}});
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true; const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,300))); };
 const ctx=await b.newContext({viewport:{width:1280,height:800}}); await fake.install(ctx,seed()); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8941/'+K+'.html?squad=dev'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U); await p.waitForTimeout(3000);
 await p.evaluate(()=>document.querySelectorAll('.ov.open').forEach(o=>o.classList.remove('open')));
 const q=await p.evaluate(()=>window.__qlog||[]);
 t('o listener de dados_diarios pede ao servidor só os últimos 15 dias (orderByKey + limitToLast(15))', q.includes('orderByKey') && q.includes('limitToLast:15'), q);
 t('o listener foi mesmo registrado em kanban/dados_diarios', await p.evaluate(()=>(window.__log||[]).some(l=>l[0]==='onValue' && l[1]==='kanban/dados_diarios')), 'sem onValue');
 const r=await p.evaluate(async()=>{ toggleDados(); await new Promise(r=>setTimeout(r,500)); const b=document.getElementById('dados-body'); return {txt:b.innerText, compactos:b.querySelectorAll('div[style*="justify-content:space-between"][style*="gap:8px"]').length}; });
 const datas=(r.txt.match(/\b\d\d\/\d\d\b/g)||[]); t('Central de Dados: mostra o dia mais recente + 14 anteriores (15 datas), o mesmo de antes', /dias anteriores/i.test(r.txt) && datas.length===15 && datas[0]==='10/10', {n:datas.length, primeira:datas[0]});
 t('sem erro de JS', !errs.length, errs); await ctx.close(); await b.close(); console.log(ok?'TUDO OK':'HÁ FALHAS'); })();
