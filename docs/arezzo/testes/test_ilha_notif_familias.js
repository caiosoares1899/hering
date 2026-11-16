// Famílias no sino e grupos na Ilha: boot real, Firebase só em memória.
// BASELINE=1 serve os dois arquivos de origin/main sem trocar arquivos no disco.
// BASE_URL=http://127.0.0.1:8966 node docs/arezzo/testes/test_ilha_notif_familias.js
const fs=require('fs'),path=require('path'),os=require('os'),{execFileSync}=require('child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(os.homedir(),'hering-tools/playwright/node_modules/playwright'));
const fake=require('./fakefb');
const cr=path.join(os.homedir(),'hering-tools/chrome');
const chrome=process.env.CHROME||path.join(cr,fs.readdirSync(cr).find(n=>n.startsWith('mac_arm-')),'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base=process.env.BASE_URL||'http://127.0.0.1:8966',out=path.join(__dirname,'../../capturas/ilha_notif');
const U={uid:'teste',email:'teste@ciahering.com.br',displayName:'Pessoa Teste',photoURL:'',providerData:[{providerId:'google.com'}]};
const types=['mention','due_today','okr_editado','backup_falhou','reuniao','okr_reuniao','gantt_cal','gantt_pedido','due_overdue','okr_prazo','gcal_pending','gcal_approved','escala','legado_desconhecido'];
const seed=()=>({kanban:{usuarios:{teste:{uid:U.uid,nome:U.displayName,email:U.email,init:'PT',role:'adm',inscrito:true,squads:{site:true},notificacoes:Object.fromEntries(types.map((type,i)=>['n'+i,{type,title:type==='legado_desconhecido'?'Texto <img src=x onerror="window.__xss=1">':['Revisar campanha','O prazo da campanha vence hoje','Objetivo atualizado','Backup não foi concluído'][i%4],sub:'Texto de teste: '+type,cardId:'c1',squad:'site',ts:new Date(Date.now()-i*60000).toISOString(),read:false}]))}},usuarios_publicos:{teste:{nome:U.displayName,init:'PT'}},config:{adm_emails:[U.email]},squads_meta:{site:{label:'Squad de teste'}},squads:{site:{dados:{columns:[{id:'doing',name:'Fazendo'}],cards_index:{c1:'k1'},cards:{k1:{id:'c1',title:'Campanha de teste',col:'doing'}}}}},notif_feed:{ev:{tipo:'okr_evento',titulo:'Evento do calendário do Radar',torre:'digital',ts:new Date(Date.now()-90000).toISOString(),eventoId:'e1'}}}});
let n=0,f=0;const t=(name,ok,detail)=>{n++;if(!ok)f++;console.log((ok?'✅ ':'❌ ')+name+(ok?'':' → '+JSON.stringify(detail)));};
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({executablePath:chrome});
try{for(const width of [1280,390])for(const theme of ['dark','light','vice']){
 const ctx=await browser.newContext({viewport:{width,height:900},hasTouch:width===390,isMobile:width===390,reducedMotion:'reduce'});await fake.install(ctx,seed());
 if(process.env.BASELINE)for(const file of ['kanban-dev.html','mare-notif-dev.js']){const body=execFileSync('git',['show','origin/main:'+file],{maxBuffer:12*1024*1024});await ctx.route('**/'+file+'*',r=>r.fulfill({contentType:file.endsWith('.js')?'text/javascript':'text/html',body}));}
 await ctx.addInitScript(()=>localStorage.setItem('mare_ilha_teste_dev',JSON.stringify({on:true,modo:'sempre',timer:false,notif:true,aba:'notif',ux:3,introVista:true,mods:{op:true}})));
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(10000);
 await p.goto(base+'/kanban-dev.html?squad=site');await p.waitForFunction(()=>!!window.__authCb);await p.evaluate(u=>window.__authCb(u),U);await p.waitForTimeout(2500);
 await p.evaluate(theme=>{document.querySelectorAll('.ov.open').forEach(x=>x.classList.remove('open'));document.documentElement.dataset.theme=theme;},theme);
 const tag=width+'/'+theme,initial=await p.locator('#notif-list .notif-item').count();
 t(tag+': 15 itens pessoais/feed sem perder contagem',initial===15,initial);
 const chronological=await p.$$eval('#notif-list .notif-item',xs=>xs.map(x=>x.dataset.notifId||x.dataset.feedId));
 await p.click('#ilha-btn');await p.click('.ilha-aba[data-aba="notif"]');
 const groups=await p.$$eval('#notif-list .ilha-notif-grupo',xs=>xs.map(x=>x.dataset.grupo));
 t(tag+': Operação → Calendário → demais notificações',JSON.stringify(groups)===JSON.stringify(['sistema','calendario','resto']),groups);
 t(tag+': calendário reúne pessoais e feed',await p.locator('#notif-list [data-familia="calendario"]').count()===11);
 const visual=await p.$$eval('#notif-list .notif-item',xs=>xs.map(x=>({family:x.dataset.familia,border:getComputedStyle(x).borderLeftWidth,badge:!!x.querySelector('.notif-familia'),label:x.querySelector('.notif-tipo')?.textContent,icon:x.querySelector('.notif-familia')?.textContent,color:getComputedStyle(x).borderLeftColor})));
 t(tag+': todo item tem faixa + selo + rótulo',visual.every(x=>x.family&&parseFloat(x.border)>=3&&x.badge&&x.label&&x.icon),visual);
 t(tag+': quatro cores de família distintas',new Set(visual.map(x=>x.color)).size===4);
 if(!process.env.BASELINE){const roteiro=await p.evaluate(fs.readFileSync(path.join(__dirname,'console_ilha_notif_familias.js'),'utf8'));t(tag+': roteiro ADM só leitura executa',roteiro.length===5&&roteiro.every(x=>x.resultado==='✅'),roteiro);}
 t(tag+': conteúdo escapado, sem executar HTML',!await p.evaluate(()=>window.__xss)&&await p.locator('#notif-list img').count()===0);
 t(tag+': sem overflow',await p.evaluate(()=>{const e=document.getElementById('ilha-painel');return e.scrollWidth<=e.clientWidth+1&&document.documentElement.scrollWidth<=innerWidth;}));
 if(width===390)t(tag+': remover com alvo 44 px e visível',await p.$$eval('#notif-list .notif-dismiss',xs=>xs.every(x=>{const r=x.getBoundingClientRect();return r.width>=44&&r.height>=44&&+getComputedStyle(x).opacity===1;})));
 // Mede o contraste do selo/rotulo contra fundo composto (vidro sobre superfície do sino).
 const contrast=await p.evaluate(()=>{const rgb=c=>(c.match(/[\d.]+/g)||[]).map(Number),mix=(a,b)=>a.slice(0,3).map((v,i)=>v*(a[3]??1)+b[i]*(1-(a[3]??1))),lum=a=>a.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);return Math.min(...[...document.querySelectorAll('#notif-list .notif-familia,#notif-list .notif-tipo')].map(e=>{const chain=[];for(let x=e;x;x=x.parentElement)chain.push(x);let bg=[3,13,26];chain.reverse().forEach(x=>bg=mix(rgb(getComputedStyle(x).backgroundColor),bg));const fg=mix(rgb(getComputedStyle(e).color),bg),a=lum(fg),b=lum(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);}));});
 t(tag+': selos/rótulos com contraste ≥ 4,5',contrast>=4.5,contrast);
 if(!process.env.BASELINE){await p.screenshot({path:path.join(out,`ilha_${width}_${theme}.png`)});await p.locator('#ilha-painel .ilha-corpo').evaluate(e=>e.scrollTop=e.scrollHeight);await p.screenshot({path:path.join(out,`ilha_${width}_${theme}_demais.png`)});await p.locator('#ilha-painel .ilha-corpo').evaluate(e=>e.scrollTop=0);}
 await p.evaluate(()=>_ilhaFechar(false));await p.evaluate(()=>window.__ilha.desligar());await p.click('#notif-btn');
 t(tag+': sino restaura ordem cronológica',JSON.stringify(await p.$$eval('#notif-list .notif-item',xs=>xs.map(x=>x.dataset.notifId||x.dataset.feedId)))===JSON.stringify(chronological));
 t(tag+': sino sem títulos de grupo',await p.locator('#notif-list .ilha-notif-grupo').count()===0);
 t(tag+': famílias também no sino',await p.locator('#notif-list .notif-familia').count()===15);
 if(!process.env.BASELINE)await p.screenshot({path:path.join(out,`sino_${width}_${theme}.png`)});
 if(width===1280&&theme==='dark'){
  const before=await p.evaluate(()=>window.__log.filter(x=>x[0]==='onValue').length),unreadBefore=await p.evaluate(()=>_ilhaNaoLidas());
  await p.evaluate(()=>{window.__abriu=null;openCard=id=>{window.__abriu=id;};});await p.locator('[data-notif-id="n0"]').click();
  t('clique abre card e marca só o item',await p.evaluate(()=>window.__abriu==='c1'&&window.__store.kanban.usuarios.teste.notificacoes.n0.read===true&&Object.values(window.__store.kanban.usuarios.teste.notificacoes).filter(x=>x.read).length===1));
  await p.waitForFunction(n=>_ilhaNaoLidas()===n-1,unreadBefore);
  t('selo não lido decrementa',await p.evaluate(()=>_ilhaNaoLidas())===unreadBefore-1);
  await p.evaluate(()=>{const pref=_ilhaPrefs();pref.on=true;_ilhaSalvar();_ilhaRender();_ilhaAbrir();_ilha.abaAtual='notif';_ilhaPainel();});
  await p.getByRole('button',{name:'Marcar todas como lidas',exact:true}).click();
  t('marcar todas inclui feed e pessoais',await p.evaluate(()=>_ilhaNaoLidas())===0&&await p.evaluate(()=>Object.values(window.__store.kanban.usuarios.teste.notificacoes).every(x=>x.read)));
  await p.evaluate(async()=>{await window._set(window._ref(window._db,'kanban/usuarios/teste/notificacoes'),{unico:{type:'mention',title:'Só pessoal',ts:new Date().toISOString(),read:false}});await window._set(window._ref(window._db,'kanban/notif_feed'),null);});
  t('grupo vazio desaparece',await p.locator('.ilha-notif-grupo[data-grupo="calendario"]').count()===0);
  t('nenhum listener novo por agrupar',await p.evaluate(()=>window.__log.filter(x=>x[0]==='onValue').length)===before);
 }
 t(tag+': sem erro de JS',!errors.length,errors);await ctx.close();
}}finally{await browser.close();}console.log(`\n${n} asserções, ${f} falha(s)`);process.exitCode=f?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
