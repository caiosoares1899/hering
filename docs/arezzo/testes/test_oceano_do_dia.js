// 🌊 Oceano como porta de entrada (2026-10-14): quem JÁ está logado no Maré/Painel também passa pelo Oceano na 1ª abertura do dia.
// Sai de fora: link com destino (card/okr/hash…), iframe, ?login=local, e-mail externo, app instalado (standalone), quem já passou pelo Oceano hoje, interruptor MARE_OCEANO_DIARIO=false.
// SUF=-dev (padrão); SUF= testa a prod (depois da promoção).
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const SUF=process.env.SUF===undefined?'-dev':process.env.SUF; const B='http://localhost:8941/';
const U={uid:'eve',email:'eve@ciahering.com.br',displayName:'Eve Souza',photoURL:'',providerData:[{providerId:'google.com'}]};
const EXT={uid:'ext',email:'convidado@gmail.com',displayName:'Convidado',photoURL:'',providerData:[{providerId:'google.com'}]};
const seed=()=>({kanban:{usuarios:{eve:{nome:'Eve Souza',email:U.email,role:'membro',squads:{dev:true,dados:true},inscrito:true,init:'ES'}},usuarios_publicos:{eve:{nome:'Eve Souza',email:U.email,role:'membro',squads:{dev:true,dados:true},init:'ES'}},config:{adm_emails:[]}}});
const hoje=()=>new Date().toLocaleDateString('sv-SE');
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true; const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':'  → '+JSON.stringify(d))); };
 const novo=async(user,pre,ctxIn)=>{ const ctx=ctxIn||await b.newContext({viewport:{width:1100,height:800}}); if(!ctxIn){ await fake.install(ctx,seed(),{oceano:true}); await ctx.addInitScript(u=>{ window.__initialUser=u; },user||U); } if(pre) await ctx.addInitScript(pre); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e))); return {ctx,p,errs}; };
 const vai=async(p,url,esperaOceano)=>{ await p.goto(B+url,{waitUntil:'commit'}); if(esperaOceano) await p.waitForURL(/oceano/,{timeout:8000}).catch(()=>{}); else await p.waitForTimeout(2500); return decodeURIComponent(p.url().replace(B,'')); };
 const dia=p=>p.evaluate(s=>localStorage.getItem(s),'mare_oceano_dia'+(SUF?'_dev':''));
 // 1) Maré e Painel, já logado, sem parâmetro → Oceano levando a página de volta; marca o dia
 for(const pg of ['kanban','painel']){ const {ctx,p,errs}=await novo(); const u=await vai(p,pg+SUF+'.html',true);
   t(`${pg} logado, sem parâmetro: 1ª abertura do dia vai pro Oceano (?next=)`, u==='oceano'+SUF+'.html?next='+pg+SUF+'.html', u);
   t(`${pg}: o dia fica marcado (não manda de novo hoje)`, (await dia(p))===hoje(), await dia(p));
   t(`${pg}: sem erro de JS`, !errs.length, errs);
   const v=await vai(p,pg+SUF+'.html',false);
   t(`${pg}: 2ª abertura no mesmo dia abre normal`, new RegExp(pg+SUF).test(v) && !/oceano/.test(v), v); await ctx.close(); }
 // 2) ?squad= não é destino: vai pro Oceano e leva a squad
 { const {ctx,p}=await novo(); const u=await vai(p,'kanban'+SUF+'.html?squad=dev',true); t('?squad=dev ainda passa pelo Oceano e o ?next= preserva a squad', u==='oceano'+SUF+'.html?next=kanban'+SUF+'.html?squad=dev', u); await ctx.close(); }
 // 3) link com destino (card, okr, tab, hash) nunca é redirecionado — e não gasta o "1º do dia"
 for(const q of ['?card=c1','?squad=dev&card=c1','?okr=abc','?tab=notas','#card-c1']){
   const {ctx,p}=await novo(); const u=await vai(p,'kanban'+SUF+'.html'+q,false);
   t(`link com destino "${q}" abre direto`, /kanban/.test(u) && !/oceano/.test(u), u); t(`"${q}": não consome o 1º do dia`, (await dia(p))===null, await dia(p)); await ctx.close(); }
 { const {ctx,p}=await novo(); const u=await vai(p,'painel'+SUF+'.html?okr=abc',false); t('Painel com ?okr= abre direto (o próprio Painel leva pro Radar, sem passar pelo Oceano)', /(painel|okr)/.test(u) && !/oceano/.test(u), u); await ctx.close(); }
 // 4) dia anterior → volta a valer
 { const {ctx,p}=await novo(null,s=>{ try{ localStorage.setItem('mare_oceano_dia'+(/-dev/.test(location.pathname)?'_dev':''),'2020-01-01'); }catch(e){} }); const u=await vai(p,'kanban'+SUF+'.html',true); t('marca de outro dia: redireciona de novo', /oceano/.test(u), u); await ctx.close(); }
 // 5) quem já abriu o Oceano hoje (direto) não é mandado de novo
 { const {ctx,p}=await novo(); await p.goto(B+'oceano'+SUF+'.html',{waitUntil:'load'}); await p.waitForTimeout(1200); t('abrir o Oceano marca o dia', (await dia(p))===hoje(), await dia(p));
   const p2=await ctx.newPage(); const u=await vai(p2,'kanban'+SUF+'.html',false); t('depois de passar pelo Oceano hoje, o Maré abre normal', /kanban/.test(u) && !/oceano/.test(u), u); await ctx.close(); }
 // 6) ?login=local, e-mail externo, iframe, standalone, interruptor
 { const {ctx,p}=await novo(); const u=await vai(p,'kanban'+SUF+'.html?login=local',false); t('?login=local não redireciona', /kanban/.test(u) && !/next=/.test(u), u); await ctx.close(); }
 { const {ctx,p}=await novo(EXT); const u=await vai(p,'kanban'+SUF+'.html',false); t('e-mail fora da Hering (externo) não é mandado pro Oceano', /kanban/.test(u) && !/oceano/.test(u), u); await ctx.close(); }
 { const {ctx,p}=await novo(); await p.goto(B+'oceano'+SUF+'.html',{waitUntil:'load'}); await p.evaluate(()=>localStorage.clear()); await p.setContent('<iframe id="f" src="'+B+'kanban'+SUF+'.html" style="width:900px;height:600px"></iframe>'); await p.waitForTimeout(2500);
   const fr=p.frames().find(f=>/kanban/.test(f.url())); t('Maré dentro de iframe (host do Oceano) não é redirecionado', !!fr && /kanban/.test(fr.url()) && !/next=/.test(fr.url()), p.frames().map(f=>f.url())); await ctx.close(); }
 { const {ctx,p}=await novo(null,()=>{ const mm=window.matchMedia.bind(window); window.matchMedia=q=>/display-mode:\s*standalone/.test(q)?{matches:true,media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}:mm(q); }); const u=await vai(p,'kanban'+SUF+'.html',false);
   t('app instalado do Maré (standalone) não muda: abre direto', /kanban/.test(u) && !/oceano/.test(u), u); await ctx.close(); }
 { const {ctx,p}=await novo(null,()=>{ window.MARE_OCEANO_DIARIO=false; }); const u=await vai(p,'kanban'+SUF+'.html',false); t('interruptor MARE_OCEANO_DIARIO=false desliga', /kanban/.test(u) && !/oceano/.test(u), u); await ctx.close(); }
 // 7) anti-loop: acabou de ser mandado (<45 s) e voltou → abre normal
 { const {ctx,p}=await novo(null,()=>{ try{ sessionStorage.setItem('mare_oceano_ts',String(Date.now())); }catch(e){} }); const u=await vai(p,'kanban'+SUF+'.html',false); t('anti-loop de 45 s vale também pro redirecionamento diário', /kanban/.test(u) && !/oceano/.test(u), u); await ctx.close(); }
 await b.close(); console.log(ok?'\nTUDO OK':'\nHÁ FALHAS'); process.exit(ok?0:1); })();
