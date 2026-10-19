// 🪶 Oceano mais leve (oceano-dev v1.55): peixes no tema claro sem `filter`, animações pausam quando ninguém olha (janela sem foco, produto aberto por
// cima, 60 s parado) e a fila de bugs do Assistente Férias (que guarda prints de ~100 KB) só é baixada inteira pelo ADM — os outros leem só os próprios.
// Roda:  python3 -m http.server 8941 &   node docs/arezzo/testes/test_oceano_leve.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const U=(uid,n,email)=>({uid,email:email||uid+'@ciahering.com.br',displayName:n,photoURL:'',providerData:[{providerId:'google.com'}]});
const bug=(id,uid,extra)=>Object.assign({tipo:'bug',origem:'assistente_ferias',app:'Maré Digital',arquivoAlvo:'kanban-dev.html',impacto:'🟡',msg:'[Férias] '+id,texto:'texto '+id,autor:uid,email:uid+'@ciahering.com.br',uid,ts:new Date().toISOString(),criadoEm:Date.now(),status:'pendente_monitorarbugs',kanbanCardId:'c_'+id,kanbanColId:'col_bugs',kanbanSchemaV:3},extra||{});
const seed=()=>({kanban:{usuarios:{ana:{uid:'ana',nome:'Ana Silva',email:'ana@ciahering.com.br',init:'AS',role:'adm',squads:{dev:true}},eve:{uid:'eve',nome:'Eve Souza',email:'eve@ciahering.com.br',init:'ES',role:'membro'}},
  config:{adm_emails:['ana@ciahering.com.br']},feedback:{bug_ferias_1:bug('bug_ferias_1','eve',{evidenciaImg:'data:image/jpeg;base64,'+'A'.repeat(2000)}),bug_ferias_2:bug('bug_ferias_2','ana'),bug_ferias_3:bug('bug_ferias_3','zed')}}});
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true;
 const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,300))); };
 const open=async(user,{tema,clock}={})=>{ const ctx=await b.newContext({viewport:{width:1280,height:800}}); await fake.install(ctx,seed()); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
   if(clock) await p.clock.install();
   // grava como o Oceano consulta o nó dos bugs (a fake não filtra, então o que vale aqui é a FORMA da consulta)
   await p.addInitScript(()=>{ window.__consultas=[]; let _q,_oc,_eq; Object.defineProperty(window,'_query',{configurable:true,get(){return _q;},set(f){ _q=(r,...c)=>{ const o=f(r,...c); try{ window.__consultas.push({p:r.p, filtros:c.map(x=>x&&x.__d||String(x))}); }catch(e){} return o; }; }});
     Object.defineProperty(window,'_orderByChild',{configurable:true,get(){return _oc;},set(f){ _oc=(k)=>{ const x=f(k); return {__d:'orderByChild:'+k, v:x}; }; }});
     Object.defineProperty(window,'_equalTo',{configurable:true,get(){return _eq;},set(f){ _eq=(v)=>{ const x=f(v); return {__d:'equalTo:'+v, v:x}; }; }}); });
   await p.goto('http://localhost:8941/oceano-dev.html'); await p.waitForFunction(()=>!!window.__authCb);
   await p.evaluate(x=>window.__authCb(x),user); await p.waitForTimeout(1800);
   if(tema) await p.evaluate(th=>{ if(th==='dark') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme',th); },tema);
   return {ctx,p,errs}; };
 const pausado=p=>p.evaluate(()=>document.documentElement.hasAttribute('data-anim-paused'));
 const consultasBugs=p=>p.evaluate(()=>window.__consultas.filter(c=>c.p==='kanban/feedback'));
 // 1) tema claro sem filter (o que derrubava para ~10 quadros/s) e cores claras direto no CSS
 { const {ctx,p,errs}=await open(U('ana','Ana Silva'),{tema:'light'});
   const r=await p.evaluate(()=>{ const cs=x=>getComputedStyle(x); const wrap=document.querySelector('.fish-wrap'), bub=document.querySelector('.bubble'), el=document.querySelector('.fish-wrap svg ellipse'), ci=document.querySelector('.fish-wrap svg circle');
     return {wrap:cs(wrap).filter, bub:cs(bub).filter, fill:cs(el).fill, stroke:cs(el).stroke, olho:cs(ci).fill, borda:cs(bub).borderTopColor, wc:cs(document.querySelector('.fish-ltr,.fish-rtl')).willChange}; });
   t('claro: nem o fundo dos peixes nem as bolhas usam `filter` (custo por quadro)', r.wrap==='none' && r.bub==='none', r);
   t('claro: silhuetas quase brancas com borda escura, direto no CSS', /236, 247, 252/.test(r.fill) && /0, 35, 55/.test(r.stroke) && /0, 35, 55/.test(r.olho), r);
   t('claro: bolhas com borda escura e miolo branco', /0, 35, 55/.test(r.borda), r.borda); t('peixes/bolhas viram camada própria (will-change)', r.wc==='transform', r.wc);
   t('claro: sem erro de JS', !errs.length, errs); await ctx.close(); }
 { const {ctx,p}=await open(U('ana','Ana Silva'),{tema:'dark'}); const r=await p.evaluate(()=>{ const el=document.querySelector('.fish-wrap svg ellipse'); return {fill:getComputedStyle(el).fill, filtro:getComputedStyle(document.querySelector('.fish-wrap')).filter}; });
   t('escuro: segue com as cores azuis originais, sem filtro', /56, 182, 255|29, 233, 182|126, 200, 227/.test(r.fill) && r.filtro==='none', r); await ctx.close(); }
 // 2) pausas
 { const {ctx,p,errs}=await open(U('ana','Ana Silva'));
   t('ativo e com foco: animando', (await pausado(p))===false, '');
   await p.evaluate(()=>{ document.hasFocus=()=>false; window.dispatchEvent(new Event('blur')); }); t('janela sem foco (reunião): pausa', await pausado(p), '');
   await p.evaluate(()=>{ document.hasFocus=()=>true; window.dispatchEvent(new Event('focus')); }); t('voltou o foco: anima de novo', (await pausado(p))===false, '');
   await p.evaluate(()=>{ const s=JSON.parse(localStorage.getItem('oceano_prefs')||'{}'); s.abrir='aqui'; localStorage.setItem('oceano_prefs',JSON.stringify(s)); }); await p.reload(); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U('ana','Ana Silva')); await p.waitForTimeout(900);
   await p.click('#tiles .tile-main[data-app="okr"]'); await p.waitForTimeout(800); t('produto aberto por cima (iframe): o lobby de trás pausa', await pausado(p), '');
   await p.click('#host-lobby, [data-host-lobby], #host-voltar').catch(()=>{}); await p.waitForTimeout(150); t('voltou pro lobby: anima de novo', (await pausado(p))===false, '');
   t('sem erro de JS', !errs.length, errs); await ctx.close(); }
 { const {ctx,p}=await open(U('ana','Ana Silva'),{clock:true});
   await p.clock.fastForward(30000); t('30 s parado ainda anima', (await pausado(p))===false, '');
   await p.clock.fastForward(35000); t('passou de 60 s sem mexer: pausa', await pausado(p), '');
   await p.mouse.move(300,300); await p.mouse.move(340,320); t('mexeu o mouse: volta na hora', (await pausado(p))===false, '');
   await p.clock.fastForward(61000); t('ficou parado de novo: pausa outra vez', await pausado(p), '');
   await p.keyboard.press('Shift'); t('tecla também acorda', (await pausado(p))===false, ''); await ctx.close(); }
 // 3) fila de bugs: só o ADM lê o nó inteiro
 { const {ctx,p}=await open(U('eve','Eve Souza')); const q=await consultasBugs(p);
   t('membro: ao abrir o Oceano consulta os bugs filtrando por uid (orderByChild uid + equalTo o próprio)', q.length>=1 && q.every(c=>c.filtros.includes('orderByChild:uid') && c.filtros.includes('equalTo:eve')), q);
   await p.evaluate(()=>window.abrirFeriasCaio('bugs')); await p.waitForTimeout(700);
   const g=await consultasBugs(p); t('abrir a aba de bugs (leitura única) também usa a consulta filtrada', g.length>q.length && g.every(c=>c.filtros.includes('equalTo:eve')), g);
   const tx=await p.evaluate(()=>{ const e=document.getElementById('fbug-meus-box'); return e?e.textContent:null; });
   t('membro: "meus chamados" mostra o próprio relato (e só ele)', /bug_ferias_1/.test(tx||'') && !/bug_ferias_2|bug_ferias_3/.test(tx||''), tx); await ctx.close(); }
 { const {ctx,p}=await open(U('ana','Ana Silva')); const q=await consultasBugs(p);
   t('ADM: lê o nó inteiro (precisa dos relatos de todos p/ o sino e a fila), sem filtro', q.length===0, q);
   await p.evaluate(()=>window.abrirFeriasCaio('bugs')); await p.waitForTimeout(700);
   const tx=await p.evaluate(()=>{ const e=document.getElementById('fbug-meus-box'); return e?e.textContent:''; }); t('ADM: em "meus chamados" vê o dele', /bug_ferias_2/.test(tx) && !/bug_ferias_1/.test(tx), tx.slice(0,200)); await ctx.close(); }
 await b.close(); console.log(ok?'TUDO OK':'HÁ FALHAS'); })();
