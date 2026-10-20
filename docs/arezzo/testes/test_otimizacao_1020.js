// /otimizaçãoderotina de 20/10/2026: (1) o Maré não baixa mais o node error_logs inteiro em todo boot — conta pelo error_stats e só lê/limpa quando passa de 500;
// (2) painel-dev: os 2 polls de status de 5 min não consultam com a aba oculta; (3) preconnect das fontes em painel/okr/oceano.
// Roda:  python3 -m http.server 8941 &   node docs/arezzo/testes/test_otimizacao_1020.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js'); const fs=require('fs');
const U=(uid,n)=>({uid,email:uid+'@ciahering.com.br',displayName:n,photoURL:'',providerData:[{providerId:'google.com'}]});
const mkLogs=n=>Object.fromEntries(Array.from({length:n},(_,i)=>['err_'+(1760000000000+i),{ts:new Date(1760000000000+i).toISOString(),msg:'x'+i,status:'novo',squad:'dev'}]));
const seed=({stats,logs})=>({kanban:{usuarios:{eve:{uid:'eve',nome:'Eve',email:'eve@ciahering.com.br',inscrito:true,init:'EV',role:'membro',squads:{dev:true}}},usuarios_publicos:{eve:{uid:'eve',nome:'Eve',init:'EV',role:'membro',squads:{dev:true}}},
  config:{adm_emails:[]},squads_meta:{},squads:{dev:{cards:{},error_stats:stats,error_logs:mkLogs(logs)}}}});
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true;
 const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,300))); };
 const boot=async(s)=>{ const ctx=await b.newContext({viewport:{width:1280,height:800}}); await fake.install(ctx,seed(s)); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
   await p.goto('http://localhost:8941/kanban-dev.html?squad=dev'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U('eve','Eve')); await p.waitForTimeout(2500);
   const log=await p.evaluate(()=>window.__log.map(l=>l[0]+' '+l[1]).filter(l=>/error_logs|error_stats/.test(l))); return {ctx,p,errs,log}; };
 // 1) poucos erros: lê só o contador, nunca o node de logs
 { const {ctx,log,errs}=await boot({stats:{'2026-10-18':3,'2026-10-19':5},logs:8});
   t('poucos erros: lê error_stats (contador)', log.some(l=>/get .*error_stats$/.test(l)), log);
   t('poucos erros: NÃO baixa error_logs inteiro no boot', !log.some(l=>/get .*error_logs$/.test(l)), log);
   t('poucos erros: sem limpeza', !log.some(l=>/set .*error_(logs|stats)$/.test(l)), log); t('sem erro de JS', !errs.length, errs); await ctx.close(); }
 // 2) contador alto + logs > 500: confirma lendo error_logs e limpa os dois
 { const {ctx,p,log,errs}=await boot({stats:{'2026-10-18':300,'2026-10-19':260},logs:560});
   t('contador > 500: confirma lendo error_logs', log.some(l=>/get .*error_logs$/.test(l)), log);
   t('logs > 500: limpa error_logs e error_stats', log.some(l=>/set .*error_logs$/.test(l)) && log.some(l=>/set .*error_stats$/.test(l)), log); t('sem erro de JS', !errs.length, errs); await ctx.close(); }
 // 3) contador alto mas logs poucos (erros apagados pelo Painel): lê para conferir e NÃO limpa
 { const {ctx,log,errs}=await boot({stats:{'2026-10-18':400,'2026-10-19':300},logs:20});
   t('contador superestimado: confere lendo error_logs', log.some(l=>/get .*error_logs$/.test(l)), log);
   t('…mas só 20 logs: não limpa nada', !log.some(l=>/set .*error_(logs|stats)$/.test(l)), log); t('sem erro de JS', !errs.length, errs); await ctx.close(); }
 // 4) estático: polls do painel com aba oculta + preconnect
 const src=f=>fs.readFileSync(__dirname+'/../../../'+f,'utf8');
 const pd=src('painel-dev.html');
 t('painel: poll do status do GitHub só com a aba visível', /setInterval\(\(\) => \{ if\(!document\.hidden\) loadGithubStatus\(false\); \}, 5 \* 60 \* 1000\)/.test(pd), 'github');
 t('painel: poll do status do Firebase só com a aba visível', /setInterval\(\(\) => \{ if\(!document\.hidden\) loadFirebaseStatus\(false\); \}, 5 \* 60 \* 1000\)/.test(pd), 'firebase');
 for(const f of ['painel-dev.html','okr-dev.html','oceano-dev.html']){ const h=src(f).slice(0,3000);
   t(f+': preconnect de fonts.googleapis e fonts.gstatic (crossorigin)', /rel="preconnect" href="https:\/\/fonts\.googleapis\.com"/.test(h) && /rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin/.test(h), h.slice(0,400)); }
 await b.close(); console.log(ok?'TUDO OK':'HÁ FALHAS'); })();
