// 🌊 Login único pelo Oceano: Maré e Painel mandam o deslogado pro Oceano (?next=), o Oceano faz login + cadastro e devolve.
// Sai de fora: Radar, dentro do host do Oceano (iframe), ?login=local (convidado externo), recusa já escrita na tela, anti-loop.
// SUF=-dev (padrão); SUF= testa a prod (depois da promoção).
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const SUF=process.env.SUF===undefined?'-dev':process.env.SUF; const B='http://localhost:8941/';
const U={uid:'eve',email:'eve@ciahering.com.br',displayName:'Eve Souza',photoURL:'',providerData:[{providerId:'google.com'}]};
const EXT={uid:'ext',email:'convidado@gmail.com',displayName:'Convidado',photoURL:'',providerData:[{providerId:'google.com'}]};
const seed=()=>({kanban:{usuarios:{},usuarios_publicos:{},config:{adm_emails:[]}}});
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true; const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+String(JSON.stringify(d===undefined?null:d)).slice(0,400))); };
 const novo=async(pre)=>{ const ctx=await b.newContext({viewport:{width:1100,height:800}}); await fake.install(ctx,seed(),{oceano:true}); if(pre) await ctx.addInitScript(pre); const abertas=[]; ctx.on('page',pg=>abertas.push(pg.url())); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept()); return {ctx,p,errs,abertas}; };
 const url=p=>decodeURIComponent(p.url().replace(B,''));
 // Segura a navegação de volta: registra a URL pedida, espera 1,5 s (a página do Oceano continua viva pra inspeção) e serve uma página-stub.
 // (Abortar a navegação troca o documento por uma página de erro; e o Firebase falso não guarda sessão — o Maré real mandaria de novo pro Oceano.)
 const seguraVolta=async(p,pref,nav)=>{ await p.route(u=>u.href.startsWith(B+pref),async r=>{ nav.push(r.request().url()); await new Promise(x=>setTimeout(x,1500)); r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>stub</title><body id="stub">stub</body>'}); }); };
 // 1) Maré deslogado → Oceano, levando squad/card
 { const {ctx,p,errs}=await novo(); await p.goto(B+'kanban'+SUF+'.html?squad=dev&card=c1',{waitUntil:'load'}); await p.waitForURL(/oceano/,{timeout:8000}).catch(()=>{});
   t('Maré deslogado vai pro Oceano levando a página de volta (squad + card)', url(p)==='oceano'+SUF+'.html?next=kanban'+SUF+'.html?squad=dev&card=c1', p.url());
   t('sem erro de JS (Maré→Oceano)', !errs.length, errs); await ctx.close(); }
 // 2) Painel deslogado → Oceano
 { const {ctx,p}=await novo(); await p.goto(B+'painel'+SUF+'.html',{waitUntil:'load'}); await p.waitForURL(/oceano/,{timeout:8000}).catch(()=>{});
   t('Painel deslogado vai pro Oceano', url(p)==='oceano'+SUF+'.html?next=painel'+SUF+'.html', p.url()); await ctx.close(); }
 // 3) Oceano com next + login Hering → FICA no Oceano (vê o Mural/vitrine), cadastra, e oferece "↩ Continuar"
 { const {ctx,p,errs,abertas}=await novo(); const nav=[]; await seguraVolta(p,'kanban',nav); await p.goto(B+'oceano'+SUF+'.html?next='+encodeURIComponent('kanban'+SUF+'.html?squad=dev&card=c1'),{waitUntil:'load'}); await p.waitForFunction(()=>!!window.__authCb);
   const antes=await p.evaluate(()=>({login:getComputedStyle(document.getElementById('login')).display,conv:document.getElementById('login-convidado').innerText,hrefs:[...document.querySelectorAll('#login-convidado a')].map(a=>a.getAttribute('href'))}));
   t('tela de login do Oceano mostra a saída pro convidado externo (links ?login=local)', antes.login!=='none' && /Convidado externo/.test(antes.conv) && antes.hrefs.join()==='kanban'+SUF+'.html?login=local,painel'+SUF+'.html?login=local,okr'+SUF+'.html?login=local', antes);
   const u0=await p.evaluate(x=>{ window.__authCb(x); return new Promise(r=>setTimeout(()=>r(window.__store.kanban.usuarios.eve||null),150)); },U);
   await p.waitForTimeout(1800);
   const r=await p.evaluate(()=>({app:getComputedStyle(document.getElementById('app')).display,login:getComputedStyle(document.getElementById('login')).display,cont:getComputedStyle(document.getElementById('continuar')).display,txt:document.getElementById('continuar-t').innerText,url:location.pathname+location.search}));
   t('depois do login a pessoa FICA no Oceano (lobby aberto, sem ser devolvida sozinha ao Maré)', nav.length===0 && r.app==='block' && r.login==='none' && /oceano/.test(r.url), {nav,r});
   t('cadastro básico em kanban/usuarios é criado no caminho normal', !!u0 && u0.email==='eve@ciahering.com.br' && u0.nome==='Eve Souza', u0);
   t('aparece o atalho "↩ Continuar" falando do Maré e do card que ela abriu', r.cont==='flex' && /Maré Digital/.test(r.txt) && /card/.test(r.txt), r);
   await p.click('#continuar-ir'); await p.waitForTimeout(1800);
   t('clicar em Continuar leva à página de origem (squad + card) e o atalho some', (nav.some(u=>u===B+'kanban'+SUF+'.html?squad=dev&card=c1') || abertas.some(u=>/kanban(-dev)?\.html\?squad=dev&card=c1/.test(u))) , {nav,abertas});
   t('sem erro de JS (Oceano)', !errs.length, errs); await ctx.close(); }
 // 3b) dispensar o atalho
 { const {ctx,p}=await novo(); await p.goto(B+'oceano'+SUF+'.html?next='+encodeURIComponent('painel'+SUF+'.html'),{waitUntil:'load'}); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U); await p.waitForTimeout(900);
   const a=await p.evaluate(()=>({d:getComputedStyle(document.getElementById('continuar')).display,t:document.getElementById('continuar-t').innerText})); await p.click('#continuar-x');
   t('atalho do Painel aparece e dá pra dispensar com ✕', a.d==='flex' && /Painel/.test(a.t) && (await p.evaluate(()=>getComputedStyle(document.getElementById('continuar')).display==='none')), a); await ctx.close(); }
 // 4) next só aceita páginas da família
 for(const ruim of ['https://evil.com','//evil.com/x','javascript:alert(1)','oceano'+SUF+'.html','kanban'+SUF+'.html@evil.com','../kanban.html']){
   const {ctx,p}=await novo(); await p.goto(B+'oceano'+SUF+'.html?next='+encodeURIComponent(ruim),{waitUntil:'load'}); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U); await p.waitForTimeout(900);
   t(`next inválido "${ruim}" é ignorado (fica no Oceano, lobby normal, SEM atalho de continuar)`, /oceano/.test(p.url()) && await p.evaluate(()=>getComputedStyle(document.getElementById('app')).display!=='none' && getComputedStyle(document.getElementById('continuar')).display==='none'), p.url()); await ctx.close(); }
 // 5) conta que não é da Hering no Oceano: recusa e mantém a saída do convidado
 { const {ctx,p}=await novo(); await p.goto(B+'oceano'+SUF+'.html?next='+encodeURIComponent('painel'+SUF+'.html'),{waitUntil:'load'}); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),EXT); await p.waitForTimeout(500);
   const r=await p.evaluate(()=>({err:document.getElementById('login-err').textContent,conv:getComputedStyle(document.getElementById('login-convidado')).display,url:location.pathname}));
   t('conta externa no Oceano é recusada e a mensagem aponta pros links do convidado', /convidado externo/i.test(r.err) && r.conv!=='none' && /oceano/.test(r.url), r); await ctx.close(); }
 // 6) ?login=local: sem redirecionar, e a escolha vale pela aba (reload sem a query)
 for(const pg of ['kanban','painel']){
   const {ctx,p}=await novo(); await p.goto(B+pg+SUF+'.html?login=local',{waitUntil:'load'}); await p.waitForTimeout(1200);
   const a=await p.evaluate(()=>({url:location.pathname,login:getComputedStyle(document.getElementById('login-ov')).display}));
   await p.goto(B+pg+SUF+'.html',{waitUntil:'load'}); await p.waitForTimeout(1200);
   const c=await p.evaluate(()=>({url:location.pathname,login:getComputedStyle(document.getElementById('login-ov')).display}));
   t(`${pg}: ?login=local mostra a tela de login local, sem ir pro Oceano — e continua assim ao recarregar na mesma aba`, new RegExp(pg).test(a.url) && a.login!=='none' && new RegExp(pg).test(c.url) && c.login!=='none', {a,c}); await ctx.close(); }
 // 7) anti-loop: acabou de ser mandado (<45 s) e voltou deslogado → fica na tela de login local
 for(const pg of ['kanban','painel']){
   const {ctx,p}=await novo(()=>{ try{ sessionStorage.setItem('mare_oceano_ts',String(Date.now())); }catch(e){} }); await p.goto(B+pg+SUF+'.html',{waitUntil:'load'}); await p.waitForTimeout(1200);
   t(`${pg}: se acabou de ser mandado pro Oceano e voltou deslogado, não entra em loop (mostra o login local)`, new RegExp(pg).test(p.url()) && await p.evaluate(()=>getComputedStyle(document.getElementById('login-ov')).display!=='none'), p.url()); await ctx.close(); }
 { const {ctx,p}=await novo(()=>{ try{ sessionStorage.setItem('mare_oceano_ts',String(Date.now()-60000)); }catch(e){} }); await p.goto(B+'kanban'+SUF+'.html',{waitUntil:'load'}); await p.waitForURL(/oceano/,{timeout:8000}).catch(()=>{});
   t('passados 45 s o redirecionamento volta a valer', /oceano/.test(p.url()), p.url()); await ctx.close(); }
 // 8) aviso de recusa já escrito na tela (ex.: externo sem autorização) → a pessoa precisa ler, não redireciona
 { const {ctx,p}=await novo(()=>{ try{ localStorage.setItem('login_notice',JSON.stringify({msg:'Acesso restrito a @ciahering.com.br. Peça a um ADM.',ts:Date.now()})); }catch(e){} }); await p.goto(B+'kanban'+SUF+'.html',{waitUntil:'load'}); await p.waitForTimeout(1200);
   const r=await p.evaluate(()=>({url:location.pathname,err:document.getElementById('login-err').textContent}));
   t('Maré: recusa guardada (login_notice) aparece na tela e NÃO manda pro Oceano', /kanban/.test(r.url) && /Acesso restrito/.test(r.err), r); await ctx.close(); }
 // 9) dentro do host do Oceano (iframe) não redireciona
 { const {ctx,p}=await novo(); await p.goto(B+'oceano'+SUF+'.html',{waitUntil:'load'}); await p.setContent('<iframe id="f" src="'+B+'kanban'+SUF+'.html" style="width:900px;height:600px"></iframe>'); await p.waitForTimeout(1800);
   const fr=p.frames().find(f=>/kanban/.test(f.url())); t('Maré dentro de iframe (host do Oceano) não é redirecionado', !!fr && /kanban/.test(fr.url()) && !/next=/.test(fr.url()), p.frames().map(f=>f.url())); await ctx.close(); }
 // 10) Oceano sem next continua igual (login → lobby)
 { const {ctx,p}=await novo(); await p.goto(B+'oceano'+SUF+'.html',{waitUntil:'load'}); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U); await p.waitForTimeout(900);
   t('Oceano sem ?next: login abre o lobby, sem redirecionar', /oceano/.test(p.url()) && await p.evaluate(()=>getComputedStyle(document.getElementById('app')).display!=='none'), p.url()); await ctx.close(); }
 // 11) Radar fica de fora
 { const {ctx,p}=await novo(); await p.goto(B+'okr'+SUF+'.html',{waitUntil:'load'}); await p.waitForTimeout(1500);
   t('Radar deslogado NÃO é redirecionado (visualizador externo continua entrando direto)', /okr/.test(p.url()), p.url()); await ctx.close(); }
 await b.close(); console.log(ok?'TUDO OK':'HÁ FALHAS'); })();
