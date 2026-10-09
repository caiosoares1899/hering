// Menu de produtos (⋮⋮⋮) DENTRO do kanban (dev e prod): botão visível no desktop e no celular, abas Hering/Meus links, produtos por papel, Esc, Central de Ajuda.
// Roda o BOOT REAL do kanban com o Firebase falso (fakefb.js serve o SDK vendorizado). K=kanban pra testar a página de produção.
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const K=process.env.K||'kanban-dev';
const U=(uid,n,email)=>({uid,email:email||uid+'@ciahering.com.br',displayName:n,photoURL:'',providerData:[{providerId:'google.com'}]});
const seed=role=>({kanban:{usuarios:{eve:{uid:'eve',nome:'Eve',email:'eve@ciahering.com.br',inscrito:true,init:'EV',role,squads:{dev:true}}},usuarios_publicos:{eve:{uid:'eve',nome:'Eve',init:'EV',role,squads:{dev:true}}},
 config:{adm_emails:role==='adm'?['eve@ciahering.com.br']:[],links_hering:{a:{titulo:'Portal RH',url:'https://rh.example.com',ordem:1},b:{titulo:'ServiceDesk',url:'https://sd.example.com',ordem:2},x:{titulo:'Mal',url:'javascript:alert(1)',ordem:0}}},squads_meta:{},squads:{dev:{cards:{}}}}});
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true; const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,300))); };
 const open=async(role,w,h)=>{ const ctx=await b.newContext({viewport:{width:w,height:h}}); await fake.install(ctx,seed(role)); await ctx.route('https://www.google.com/s2/favicons**',r=>r.abort()); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
   await p.goto('http://localhost:8941/'+K+'.html?squad=dev'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U('eve','Eve')); await p.waitForTimeout(2800); await p.evaluate(()=>{ document.querySelectorAll('.ov.open').forEach(o=>o.classList.remove('open')); }); return {ctx,p,errs}; };
 for(const [w,h,nome] of [[1280,800,'desktop'],[390,800,'celular']]){
   const {ctx,p,errs}=await open('membro',w,h);
   const v=await p.evaluate(()=>{ const b=document.getElementById('mn-apps-btn'); if(!b) return null; const r=b.getBoundingClientRect(); return {w:r.width,h:r.height,x:r.x}; }); t(`${nome}: botão ⋮⋮⋮ existe, está visível e dentro da tela`, v && v.w>0 && v.h>0 && v.x>=0 && v.x<w, v);
   await p.click('#mn-apps-btn'); await p.waitForTimeout(250);
   t(`${nome}: aba Produtos mostra Maré, Radar e A Bordo (membro não vê Painel)`, (await p.evaluate(()=>[...document.querySelectorAll('#mn-apps-pop .mn-app-n')].map(x=>x.textContent).join()))==='Maré Digital,Radar,A Bordo', 'tiles');
   await p.click('#mn-apps-pop button[data-mntab="hering"]'); await p.waitForTimeout(600);
   const h2=await p.evaluate(()=>{ const pop=document.getElementById('mn-apps-pop'), r=pop.getBoundingClientRect(), e=document.elementFromPoint(r.left+30,r.top+30); return {links:[...pop.querySelectorAll('.mn-lk-t')].map(x=>x.textContent).join(), topo:!!(e&&e.closest('#mn-apps-pop')), dentro:r.left>=0&&r.right<=innerWidth}; });
   t(`${nome}: aba Hering lista os links (sem o javascript:), por cima do board e dentro da tela`, h2.links==='Portal RH,ServiceDesk' && h2.topo && h2.dentro, h2);
   await p.keyboard.press('Escape'); await p.waitForTimeout(150); t(`${nome}: Esc fecha o menu`, await p.evaluate(()=>getComputedStyle(document.getElementById('mn-apps-pop')).display==='none'), 'aberto');
   t(`${nome}: sem erro de JS`, !errs.length, errs); await ctx.close(); }
 for(const role of ['adm','po']){ const {ctx,p}=await open(role,1280,800); await p.click('#mn-apps-btn'); await p.waitForTimeout(250);
   t(`papel ${role}: aba Produtos inclui o Painel`, (await p.evaluate(()=>[...document.querySelectorAll('#mn-apps-pop .mn-app-n')].map(x=>x.textContent).join()))==='Maré Digital,Painel,Radar,A Bordo', 'tiles'); await ctx.close(); }
 { const {ctx,p}=await open('membro',1280,800); const r=await p.evaluate(async()=>{ openHelp(); await new Promise(r=>setTimeout(r,400)); return /Menu de produtos \(⋮⋮⋮\) e a página Oceano/.test(document.body.innerText); }); t('Central de Ajuda tem a entrada "Menu de produtos e a página Oceano"', r, r); await ctx.close(); }
 await b.close(); console.log(ok?'TUDO OK':'HÁ FALHAS'); })();
