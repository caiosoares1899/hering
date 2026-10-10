// /monitorarbugs 2026-10-10 (2ª rodada de notificações): (1) Comunicado urgente publicado por ADM só-por-e-mail: o fan-out do painel_broadcast é negado pelas
// regras e o painel avisa (antes: "publicado!" e ninguém notificado, em silêncio); (2) tipo painel_broadcast desligado nos 2 canais: nem grava;
// (3) tag do push: tipos sem card não se substituem (functions/common/pushUrl.js — também coberto por pushUrl.test.js).
// Uso (servidor estático na raiz, porta 8941):  node docs/arezzo/testes/test_monitorarbugs_1010c.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const U = (uid,n)=>({uid,email:uid+'@ciahering.com.br',displayName:n,photoURL:'',providerData:[{providerId:'google.com'}]});
let ok = true; const t = (n,c,d)=>{ if(!c) ok = false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+(JSON.stringify(d)||'').slice(0,300))); };
const seed = (role,cfg)=>({kanban:{usuarios:{
  'rafael.passos':{uid:'rafael.passos',nome:'Rafa ADM',email:'rafael.passos@ciahering.com.br',inscrito:true,init:'RP',role,squads:{dev:true}},
  bia:{uid:'bia',nome:'Bia',email:'bia@ciahering.com.br',inscrito:true,init:'BI',role:'membro',squads:{dev:true}},
  caro:{uid:'caro',nome:'Caro',email:'caro@ciahering.com.br',inscrito:true,init:'CA',role:'membro',squads:{dev:true}}},
  usuarios_publicos:{'rafael.passos':{uid:'rafael.passos',nome:'Rafa ADM',init:'RP'}}, config:{adm_emails:[]}, squads_meta:{}, squads:{dev:{cards:{}}}, ...(cfg?{notif_config:cfg}:{})}});
(async()=>{ const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 const publicar = async (role,cfg)=>{
   const ctx = await b.newContext({viewport:{width:1280,height:900}}); await fake.install(ctx, seed(role,cfg));
   // regras do banco (preparadas): notificação painel_broadcast em caixa alheia só por quem tem papel po/adm
   await ctx.addInitScript(()=>{ window.__denySet = (p,v)=>{ const m=/^kanban\/usuarios\/([^/]+)\/notificacoes\/[^/]+$/.exec(p); if(!m || !v || v.type!=='painel_broadcast') return false;
     const eu=(window.__store.kanban.usuarios||{})['rafael.passos']||{}; return m[1]!=='rafael.passos' && !(eu.role==='po'||eu.role==='adm'); }; });
   const p = await ctx.newPage(); const errs = []; p.on('pageerror',e=>errs.push(e.message));
   await p.goto('http://localhost:8941/painel-dev.html'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U('rafael.passos','Rafa ADM')); await p.waitForTimeout(2600);
   await p.evaluate(()=>{ document.querySelectorAll('.ov.open').forEach(o=>o.classList.remove('open')); window._pollSquadDados=()=>{}; window._pollSquadSnapshots=()=>{}; });
   await p.evaluate(async()=>{ await loadGlobalUsers(true); });
   await p.waitForTimeout(500);
   await p.evaluate(()=>{ openComunicadoCompose(); document.getElementById('cc-titulo').value='Parada geral'; document.getElementById('cc-corpo').innerHTML='<p>teste</p>'; document.getElementById('cc-tipo').value='urgente'; saveComunicado(); });
   const toasts = []; for(let i=0;i<14;i++){ await p.waitForTimeout(250); toasts.push(await p.evaluate(()=>document.getElementById('toast').textContent)); }
   const notifs = await p.evaluate(()=>Object.entries(window.__store.kanban.usuarios).filter(([u,x])=>x.notificacoes && Object.values(x.notificacoes).some(n=>n.type==='painel_broadcast')).map(([u])=>u));
   await ctx.close(); return {toasts, notifs, errs}; };
 { const r = await publicar('membro');
   t('ADM só por e-mail (papel membro): as regras negam o fan-out → ninguém recebe a notificação', r.notifs.length===0, r.notifs);
   t('…e o painel AVISA que os avisos não foram entregues (antes ficava só o "publicado!")', r.toasts.some(x=>/não (foram|chegaram)|n[aã]o entreg/i.test(x) && /PO|ADM|papel/i.test(x)), r.toasts.filter((x,i,a)=>a.indexOf(x)===i));
   t('o comunicado em si continua publicado', r.toasts.some(x=>/publicado/i.test(x)), r.toasts);
   t('sem erro de JS', !r.errs.length, r.errs); }
 { const r = await publicar('adm');
   t('papel adm no banco: Bia e Caro recebem a notificação, sem aviso de falha', r.notifs.sort()+''==='bia,caro' && !r.toasts.some(x=>/não (foram|chegaram)/i.test(x)), r); }
 { const r = await publicar('adm',{painel_broadcast:{sino:false,push:false}});
   t('painel_broadcast desligado no sino E no push: não grava notificação nenhuma', r.notifs.length===0, r.notifs); }
 { const r = await publicar('adm',{painel_broadcast:{sino:false}});
   t('só o sino desligado: continua gravando (o push pode estar ligado)', r.notifs.length===2, r.notifs); }
 { // sino do Oceano com a config chegando DEPOIS dos 3 s "frios" do novas(): a lista que já existia não pode virar "notificação nova" (ding a cada abertura)
   const antes=m=>new Date(Date.now()-m*60000).toISOString();
   const ctx = await b.newContext({viewport:{width:1280,height:800}});
   await fake.install(ctx, {kanban:{usuarios:{eve:{uid:'eve',nome:'Eve',email:'eve@ciahering.com.br',init:'EV',role:'membro',inscrito:true,squads:{dev:true},
     notificacoes:{n1:{type:'assigned',title:'Card atribuído',sub:'x',ts:antes(5),read:false,cardId:'c1',squad:'dev'}}}}, usuarios_publicos:{eve:{uid:'eve',nome:'Eve',init:'EV'}}, config:{adm_emails:[]}}});
   await ctx.addInitScript(()=>{ window.__ding=0; window.__onValueDelay=p=>p==='kanban/notif_config'?3800:0;
     window.AudioContext=function(){ return {state:'running',currentTime:0,destination:{},resume(){return Promise.resolve();},createOscillator(){window.__ding++;return {type:'',frequency:{},connect(){},start(){},stop(){}}},createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}}}; }; });
   const p = await ctx.newPage(); await p.goto('http://localhost:8941/oceano-dev.html'); await p.waitForFunction(()=>!!window.__authCb);
   await p.evaluate(x=>window.__authCb(x),{uid:'eve',email:'eve@ciahering.com.br',displayName:'Eve',photoURL:'',providerData:[{providerId:'google.com'}]}); await p.waitForTimeout(5200);
   const r = await p.evaluate(()=>({pronto:MareNotif.cfgPronto(), ding:window.__ding, sel:document.getElementById('sino-n').textContent}));
   t('Oceano, config chegando só depois de 3,8 s: o selo aparece (1) mas a notificação que já existia NÃO toca o ding', r.pronto && r.sel==='1' && r.ding===0, r);
   // o ADM desliga o tipo ao vivo → some; religa → VOLTA (antes ficava descartada da lista até o próximo snapshot)
   const sel = ()=>p.evaluate(()=>getComputedStyle(document.getElementById('sino-n')).display==='none' ? '' : document.getElementById('sino-n').textContent);
   await p.evaluate(()=>window._set(window._ref(window._db,'kanban/notif_config/assigned'),{sino:false})); await p.waitForTimeout(400);
   const off = await sel();
   await p.evaluate(()=>window._set(window._ref(window._db,'kanban/notif_config/assigned'),null)); await p.waitForTimeout(400);
   const on = await sel();
   t('Oceano: sino do tipo desligado ao vivo some do selo; religado, a notificação VOLTA (sem esperar outro snapshot)', off==='' && on==='1', {off,on});
   t('viva() é só o prazo (TTL), não depende da config', await p.evaluate(()=>MareNotif.viva({type:'assigned',ts:new Date().toISOString(),read:false}) && !MareNotif.viva({type:'assigned',ts:new Date(Date.now()-40*864e5).toISOString(),read:false})));
   await ctx.close(); }
 await b.close(); console.log(ok ? 'TUDO OK' : 'HÁ FALHAS'); process.exit(ok?0:1); })();
