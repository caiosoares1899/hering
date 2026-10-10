// /monitorarbugs 2026-10-10 (Central de Notificações): (1) config chegando DEPOIS das notificações não toca o ding de um tipo desligado;
// (2) ADM só por e-mail (papel "membro" no banco) vê os interruptores travados + aviso, e o erro de permissão é explicado.
// Uso (servidor estático na raiz, porta 8941):  node docs/arezzo/testes/test_monitorarbugs_1010b.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const U = (uid,n)=>({uid,email:uid+'@ciahering.com.br',displayName:n,photoURL:'',providerData:[{providerId:'google.com'}]});
let ok = true; const t = (n,c,d)=>{ if(!c) ok = false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+(JSON.stringify(d)||'').slice(0,300))); };
const seedKanban = ()=>({kanban:{usuarios:{eve:{uid:'eve',nome:'Eve',email:'eve@ciahering.com.br',inscrito:true,init:'EV',role:'membro',squads:{dev:true},
  notificacoes:{n1:{id:'n1',type:'mention',title:'@EV citada',sub:'x',ts:new Date().toISOString(),read:false,squad:'dev'},n2:{id:'n2',type:'assigned',title:'Atribuído',sub:'y',ts:new Date().toISOString(),read:false,squad:'dev'}}}},
  usuarios_publicos:{eve:{uid:'eve',nome:'Eve',init:'EV',role:'membro',squads:{dev:true}}}, config:{adm_emails:[]}, squads_meta:{}, squads:{dev:{cards:{}}}, notif_config:{mention:{sino:false}}}});
const seedPainel = role=>({kanban:{usuarios:{'rafael.passos':{uid:'rafael.passos',nome:'Rafa ADM',email:'rafael.passos@ciahering.com.br',inscrito:true,init:'RP',role,squads:{dev:true}}},
  usuarios_publicos:{'rafael.passos':{uid:'rafael.passos',nome:'Rafa ADM',init:'RP'}}, config:{adm_emails:[]}, squads_meta:{}, squads:{dev:{cards:{}}}}});
(async()=>{ const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 // ── 1) ding no boot ──
 for(const [atraso,rotulo] of [[0,'config chega junto'],[1500,'config chega 1,5 s DEPOIS']]){
   const ctx = await b.newContext({viewport:{width:1280,height:800}}); await fake.install(ctx, seedKanban());
   await ctx.addInitScript(a=>{ window.__ding = 0; window.__onValueDelay = p=>p==='kanban/notif_config'?a:0;
     window.AudioContext = function(){ return {state:'running',currentTime:0,destination:{},resume(){return Promise.resolve();},createOscillator(){window.__ding++;return {type:'',frequency:{},connect(){},start(){},stop(){}}},createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}}}; }; }, atraso);
   const p = await ctx.newPage(); const errs = []; p.on('pageerror',e=>errs.push(e.message));
   await p.goto('http://localhost:8941/kanban-dev.html?squad=dev'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U('eve','Eve')); await p.waitForTimeout(700);
   const ant = await p.evaluate(()=>({pronto:MareNotif.cfgPronto(), sinoMention:MareNotif.sinoLigado('mention'), itens:document.querySelectorAll('#notif-list .notif-item').length, badge:document.getElementById('notif-badge').textContent}));
   await p.waitForTimeout(2600);
   const dep = await p.evaluate(()=>({pronto:MareNotif.cfgPronto(), mention:MareNotif.sinoLigado('mention'), assigned:MareNotif.sinoLigado('assigned'), ding:window.__ding, itens:[...document.querySelectorAll('#notif-list .notif-item .notif-title')].map(x=>x.textContent), badge:document.getElementById('notif-badge').textContent}));
   if(atraso){ t(`(${rotulo}) antes de a config chegar o sino não mostra nada (nem o tipo desligado)`, !ant.pronto && !ant.sinoMention && ant.itens===0, ant); }
   t(`(${rotulo}) depois: só o tipo ligado aparece, selo = 1`, dep.pronto && !dep.mention && dep.assigned && dep.itens+''==='Atribuído' && dep.badge==='1', dep);
   t(`(${rotulo}) o ding toca no máximo 1 vez (2 osciladores) e só por causa do tipo LIGADO`, dep.ding===2, dep.ding);
   t(`(${rotulo}) sem erro de JS`, !errs.length, errs); await ctx.close();
 }
 { // só o tipo desligado não toca nada
   const ctx = await b.newContext({viewport:{width:1280,height:800}}); const s = seedKanban(); delete s.kanban.usuarios.eve.notificacoes.n2; await fake.install(ctx, s);
   await ctx.addInitScript(()=>{ window.__ding = 0; window.__onValueDelay = p=>p==='kanban/notif_config'?1500:0;
     window.AudioContext = function(){ return {state:'running',currentTime:0,destination:{},resume(){return Promise.resolve();},createOscillator(){window.__ding++;return {type:'',frequency:{},connect(){},start(){},stop(){}}},createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}}}; }; });
   const p = await ctx.newPage(); await p.goto('http://localhost:8941/kanban-dev.html?squad=dev'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U('eve','Eve')); await p.waitForTimeout(3300);
   t('só havia notificação de tipo desligado + config atrasada: nenhum ding', (await p.evaluate(()=>window.__ding))===0);
   // sem permissão de ler a config → conta como pronta (o sino aparece com o padrão)
   await ctx.close(); }
 { const ctx = await b.newContext({viewport:{width:1280,height:800}}); await fake.install(ctx, seedKanban()); await ctx.addInitScript(()=>{ window.__onValueDelay = p=>p==='kanban/notif_config'?-1:0; });
   const p = await ctx.newPage(); await p.goto('http://localhost:8941/kanban-dev.html?squad=dev'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U('eve','Eve')); await p.waitForTimeout(1200);
   t('módulo exporta cfgPronto()', await p.evaluate(()=>typeof MareNotif.cfgPronto==='function')); await ctx.close(); }
 // ── 2) ADM só por e-mail ──
 for(const role of ['membro','adm']){
   const ctx = await b.newContext({viewport:{width:1280,height:900}}); await fake.install(ctx, seedPainel(role));
   await ctx.addInitScript(()=>{ window.__denySet = p=>{ if(!/^kanban\/notif_config/.test(p)) return false; const u=(window.__store.kanban.usuarios||{})['rafael.passos']||{}; return !(u.role==='po'||u.role==='adm'); }; });
   const p = await ctx.newPage(); const errs = []; p.on('pageerror',e=>errs.push(e.message));
   await p.goto('http://localhost:8941/painel-dev.html'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U('rafael.passos','Rafa ADM')); await p.waitForTimeout(2600);
   await p.evaluate(()=>{ document.querySelectorAll('.ov.open').forEach(o=>o.classList.remove('open')); window._pollSquadDados=()=>{}; window._pollSquadSnapshots=()=>{}; });
   await p.evaluate(()=>swPtab('notifs')); await p.waitForTimeout(800);
   const v = await p.evaluate(()=>({adm:_isAdmPainel(), trava:document.querySelector('#nc-row-mention .nc-sw input').disabled, reset:document.getElementById('nc-reset').disabled, aviso:getComputedStyle(document.getElementById('nc-sem-permissao')).display!=='none', txt:document.getElementById('nc-sem-permissao').textContent}));
   if(role==='membro'){
     t('ADM só por e-mail (papel membro): interruptores travados + aviso explicando', v.adm && v.trava && v.aviso && /papel no banco/.test(v.txt), v);
     // se o papel mudou no banco, 🔄 Atualizar destrava
     await p.evaluate(()=>{ window.__store.kanban.usuarios['rafael.passos'].role='adm'; }); await p.evaluate(()=>loadGlobalUsers(true)); await p.waitForTimeout(900);
     t('depois que um PO/ADM ajusta o papel, 🔄 Atualizar destrava e o aviso some', await p.evaluate(()=>!document.querySelector('#nc-row-mention .nc-sw input').disabled && getComputedStyle(document.getElementById('nc-sem-permissao')).display==='none'));
     // forçando o clique mesmo travado (cache velho): o banco nega e a mensagem explica
     await p.evaluate(()=>{ window.__store.kanban.usuarios['rafael.passos'].role='membro'; _globalUsersCache['rafael.passos'].role='membro'; });
     await p.evaluate(()=>ncSet('mention','sino',{checked:false})); await p.waitForTimeout(500);
     const m = await p.evaluate(()=>document.getElementById('painel-toast').textContent);
     t('permissão negada e papel sem PO/ADM: a mensagem fala do papel (não das regras não publicadas)', /papel PO ou ADM/.test(m) && !/regras novas/.test(m) && !(await p.evaluate(()=>window.__store.kanban.notif_config)), m);
     // papel parece certo no cache mas o banco nega (ex.: regras ainda não publicadas): a mensagem lembra do deploy das regras
     await p.evaluate(()=>{ _globalUsersCache['rafael.passos'].role='adm'; });
     await p.evaluate(()=>ncSet('mention','sino',{checked:false})); await p.waitForTimeout(500);
     t('permissão negada com papel aparentemente certo: lembra do firebase deploy --only database', /regras novas[^]*deploy --only database/.test(await p.evaluate(()=>document.getElementById('painel-toast').textContent)));
   } else {
     t('papel adm no banco: interruptores liberados, sem aviso', v.adm && !v.trava && !v.reset && !v.aviso, v);
     await p.evaluate(()=>{ document.querySelector('#nc-row-mention .nc-sw:nth-of-type(1) input').click(); }); await p.waitForTimeout(500);
     t('e a gravação acontece', (await p.evaluate(()=>window.__store.kanban.notif_config))?.mention?.sino===false);
   }
   t(`(${role}) sem erro de JS`, !errs.length, errs); await ctx.close(); }
 await b.close(); console.log(ok ? 'TUDO OK' : 'HÁ FALHAS'); process.exit(ok?0:1); })();
