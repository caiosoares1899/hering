// Convidado externo (?login=local) no Maré: a escolha vale pela aba e o cadastro guiado (?squad=X) não pode soltá-la — senão o Oceano devolve a pessoa pro Maré (looping).
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const SUF = process.env.SUFIXO===undefined ? '-dev' : process.env.SUFIXO;
const EXT={uid:'x1',email:'freela@gmail.com',displayName:'Freela',photoURL:'',providerData:[{providerId:'google.com'}]};
const seed=()=>({kanban:{usuarios:{adm:{uid:'adm',nome:'Adm',email:'caio.soares@ciahering.com.br',inscrito:true,init:'CS',role:'adm',squads:{dados:true}}},usuarios_publicos:{},config:{adm_emails:['caio.soares@ciahering.com.br']},
  squads_meta:{dados:{label:'Dados'},design:{label:'Design'}},squads:{dados:{externos:{}},design:{externos:{'freela@gmail,com':{email:'freela@gmail.com'}}}}}});
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true; const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':'  → '+JSON.stringify(d))); };
 // 1) externa JÁ logada abre o link geral do Oceano (sem squad): cadastro guiado manda pro squad dela e mantém o modo convidado
 { const ctx=await b.newContext(); await fake.install(ctx,seed(),{oceano:true}); const p=await ctx.newPage(); const nav=[]; p.on('framenavigated',f=>{ if(f===p.mainFrame()) nav.push(f.url().replace('http://localhost:8941/','')); });
   await p.goto('http://localhost:8941/oceano'+SUF+'.html'); await p.waitForTimeout(600);
   const href=await p.evaluate(()=>document.getElementById('lc-kanban').getAttribute('href')); t('link do Maré na tela de login do Oceano leva ?login=local', /login=local/.test(href), href);
   await p.goto('http://localhost:8941/kanban'+SUF+'.html?login=local'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),EXT); await p.waitForTimeout(4500);
   const url=await p.evaluate(()=>location.pathname.split('/').pop()+location.search);
   t('cadastro guiado manda pro squad dela E mantém login=local', /squad=design/.test(url) && /login=local/.test(url), url);
   t('aba segue marcada como convidado', await p.evaluate(()=>sessionStorage.getItem('mare_login_local')==='1'), null);
   t('nunca navegou pro Oceano', !nav.some(u=>/oceano/.test(u.split('?')[0]) && nav.indexOf(u)>0), nav);
   // 2) na página nova, sessão perdida (deslogada) NÃO volta pro Oceano
   await p.evaluate(()=>window.__authCb&&window.__authCb(null)); await p.waitForTimeout(1500);
   t('deslogada no ?squad=X da aba de convidado: fica no Maré (sem Oceano)', /kanban/.test(await p.evaluate(()=>location.pathname)), await p.evaluate(()=>location.href)); await ctx.close(); }
 // 3) externa que chega já logada (sem passar por tela de login): a aba é marcada como convidado ao validar
 { const ctx=await b.newContext(); await fake.install(ctx,seed(),{oceano:true}); const p=await ctx.newPage();
   await p.goto('http://localhost:8941/kanban'+SUF+'.html?squad=design'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),EXT); await p.waitForTimeout(2500);
   t('externa autorizada sem ?login=local: aba marcada como convidado ao validar', await p.evaluate(()=>sessionStorage.getItem('mare_login_local')==='1'), null);
   await p.evaluate(()=>window.__authCb(null)); await p.waitForTimeout(1200);
   t('e se a sessão cair, não é mandada pro Oceano', /kanban/.test(await p.evaluate(()=>location.pathname)), await p.evaluate(()=>location.href)); await ctx.close(); }
 // 4) @ciahering deslogada continua indo pro Oceano (comportamento de sempre)
 { const ctx=await b.newContext(); await fake.install(ctx,seed(),{oceano:true}); const p=await ctx.newPage();
   await p.goto('http://localhost:8941/kanban'+SUF+'.html?squad=dados'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(()=>window.__authCb(null)); await p.waitForTimeout(1500);
   t('@ciahering deslogada ainda vai pro Oceano (?next=)', /oceano/.test(await p.evaluate(()=>location.pathname)), await p.evaluate(()=>location.href)); await ctx.close(); }
 await b.close(); console.log(ok?'\nTUDO OK':'\nFALHOU'); process.exit(ok?0:1); })();
