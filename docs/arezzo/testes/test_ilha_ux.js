// 🏝️ Ilha Dinâmica — painel aberto redesenhado (/melhoriauiux, 11/11/2026): botões redondos nas laterais, conteúdo no centro,
// Resumo com um bloco por módulo. Confere layout (1280/390, 4 temas, sem rolagem lateral nem dentro do painel), o bug dos Ajustes
// cortados pela esquerda, a navegação pelos blocos, a ação do timer no bloco, teclado e alvos de toque.
// Rodar: python3 -m http.server 8953 (na raiz) e `node docs/arezzo/testes/test_ilha_ux.js` (BASE_URL troca o servidor).
const fs=require('fs'),path=require('path'),home=require('os').homedir();
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(home,'hering-tools/playwright/node_modules/playwright'));
const fake=require('./fakefb');
const cr=path.join(home,'hering-tools/chrome'),chrome=process.env.CHROME||path.join(cr,fs.readdirSync(cr).find(n=>n.startsWith('mac_arm-')),'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base=process.env.BASE_URL||'http://127.0.0.1:8953', out=path.join(__dirname,'..','..','capturas','ilha-ux');
const U={uid:'eve',email:'eve@ciahering.com.br',displayName:'Eve Martins',photoURL:'',providerData:[{providerId:'google.com'}]};
const hoje=new Date(), d=n=>{const x=new Date();x.setDate(x.getDate()+n);return x.toISOString().slice(0,10);}, hm=m=>{const x=new Date(Date.now()+m*60000);return String(x.getHours()).padStart(2,'0')+':'+String(x.getMinutes()).padStart(2,'0');};
const seed=()=>({kanban:{
  usuarios:{eve:{uid:'eve',nome:'Eve Martins',email:U.email,init:'EM',role:'adm',inscrito:true,squads:{site:true},
    notificacoes:{n1:{id:'n1',type:'mention',title:'Ana mencionou você em "Banner da Black Friday"',sub:'Pode revisar o texto do CTA até amanhã?',cardId:'c1',squad:'site',ts:new Date(Date.now()-600000).toISOString(),read:false},
      n2:{id:'n2',type:'card_moved',title:'"Relatório semanal" foi para Concluído',sub:'Squad Site',ts:new Date(Date.now()-3600000).toISOString(),read:false},
      n3:{id:'mention_c1_eve_cmA',type:'mention',title:'🤖 Agente Ágil respondeu sua menção',sub:'Resumo: 3 tarefas abertas, 1 bloqueio no checkout…',cardId:'c1',squad:'site',ts:new Date(Date.now()-120000).toISOString(),read:false}},
    agente_analisando:{cmB:{squad:'site',cardId:'c2',desde:new Date(Date.now()-40000).toISOString()}}}},
  usuarios_publicos:{eve:{uid:'eve',nome:'Eve Martins',init:'EM'}}, config:{adm_emails:['eve@ciahering.com.br']},
  squads_meta:{site:{label:'Squad Site'},dados:{label:'Squad Dados'}},
  squads:{site:{dados:{columns:[{id:'doing',name:'Fazendo'}],cards_index:{c1:'k1',c2:'k2'},cards:{k1:{id:'c1',title:'Banner da Black Friday',col:'doing'},k2:{id:'c2',title:'Relatório semanal de conversão',col:'doing'}},
    card_timers:{c1:{t1:{id:'t1',uid:'eve',sq:'site',cardId:'c1',cardTitle:'Banner da Black Friday',atividade:'Revisar campanha',tipo:'cronometro',status:'rodando',startedAt:Date.now()-25*60000,accMs:0,porUid:'ana'}}}}}},
  timers_ativos:{eve:{t1:{sq:'site',cardId:'c1',cardTitle:'Banner da Black Friday',atividade:'Revisar campanha',tipo:'cronometro',status:'rodando',startedAt:Date.now()-25*60000,accMs:0,porUid:'ana'},
    t2:{sq:'site',cardId:'c2',cardTitle:'Relatório semanal de conversão',atividade:'Relatório semanal',tipo:'timer',durMs:3600000,status:'pausado',accMs:600000,startedAt:null,porUid:'eve'}}},
  cards_guardiao:{site:{ultimo:{acao:'restaurado',titulo:'Banner da Black Friday',cardId:'c1',detectadoEm:new Date(Date.now()-3600000).toISOString()}}},
  vtex_saude:{ok:true,ultimoOkEm:new Date().toISOString(),abertos:1,incidentes:[{titulo:'Lentidão no checkout em algumas lojas',link:'https://status.vtex.com/incidents/x'}]},
  github_saude:{ok:true,ultimoOkEm:new Date().toISOString(),abertos:0,incidentes:[]},
  firebase_saude:{ok:true,ultimoOkEm:new Date().toISOString(),abertos:0,incidentes:[]},
  okr:{objetivos:{o1:{id:'o1',torre:'digital',titulo:'Meta',responsaveis:['eve']}},calendario:{eventos:{
    e1:{id:'e1',titulo:'Daily do Squad Site',tipo:'reuniao',data:d(0),hi:hm(12),hf:hm(27),convidados:['eve'],link:'https://meet.google.com/abc'},
    e2:{id:'e2',titulo:'Check-in OKR — Bloco 1',tipo:'reuniao',data:d(1),hi:'10:00',hf:'11:00',torre:'digital'},
    e3:{id:'e3',titulo:'Lançamento Black Friday',tipo:'evento',data:d(9),diaInteiro:true,convidados:['eve']}}}}
}});

let n=0,f=0; const t=(nome,ok,d)=>{n++; if(!ok) f++; console.log((ok?'✅ ':'❌ ')+nome+(ok?'':' → '+String(JSON.stringify(d)).slice(0,300)));};
const PREF={on:true,modo:'sempre',principal:'timer',timer:true,notif:true,secundaria:true,reabrir:'ultima',aba:'resumo',mods:{op:true,fav:true,status:true,agenda:true,agente:true},favs:[{tipo:'produto',id:'okr'},{tipo:'squad',id:'dados'}]};
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const b=await chromium.launch({executablePath:chrome});
  const abrir=async(w,h,tema)=>{
    const ctx=await b.newContext({viewport:{width:w,height:h},hasTouch:w<500,isMobile:w<500}); await fake.install(ctx,seed());
    await ctx.addInitScript(pref=>{ try{ localStorage.setItem('mare_ilha_eve_dev',JSON.stringify(pref)); }catch(e){} },PREF);
    const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(base+'/kanban-dev.html?squad=site'); await p.waitForFunction(()=>!!window.__authCb);
    await p.evaluate(u=>window.__authCb(u),U); await p.waitForTimeout(3500);
    await p.evaluate(tema=>{ document.querySelectorAll('.ov.open').forEach(o=>o.classList.remove('open')); if(tema!=='dark') document.documentElement.setAttribute('data-theme',tema); },tema);
    await p.click('#ilha-btn'); await p.waitForTimeout(400);
    return {ctx,p,errs};
  };
  const semLateral=p=>p.evaluate(()=>{ const c=document.querySelector('#ilha-painel .ilha-corpo'); return document.documentElement.scrollWidth<=innerWidth && (!c || (c.scrollWidth<=c.clientWidth+1 && c.scrollLeft===0)); });
  // 1) desktop escuro: estrutura, navegação, ação do timer, teclado
  { const {ctx,p,errs}=await abrir(1280,860,'dark');
    const lados=await p.evaluate(()=>({esq:[...document.querySelectorAll('.ilha-trilho.esq .ilha-aba')].map(a=>a.dataset.aba), dir:[...document.querySelectorAll('.ilha-trilho.dir .ilha-aba')].map(a=>a.dataset.aba)}));
    t('abre no Resumo', await p.locator('.ilha-aba.on[data-aba="resumo"]').count()===1);
    t('esquerda = o que acontece agora', JSON.stringify(lados.esq)===JSON.stringify(['resumo','timers','notif','agenda','agente']), lados);
    t('direita = atalhos e controle, Ajustes por último', lados.dir[lados.dir.length-1]==='ajustes' && ['fav','status','op'].every(x=>lados.dir.includes(x)), lados);
    const tiles=await p.$$eval('.ilha-tile',xs=>xs.map(x=>x.dataset.ir));
    t('um bloco por módulo ligado', ['timers','notif','agenda','agente','status','op','fav'].every(x=>tiles.includes(x)), tiles);
    t('contadores reais nos botões (2 timers, 3 avisos)', await p.locator('.ilha-aba[data-aba="timers"] .ilha-aba-sel').textContent()==='2' && await p.locator('.ilha-aba[data-aba="notif"] .ilha-aba-sel').textContent()==='3');
    t('incidente aparece como alerta no bloco e no botão', await p.locator('.ilha-tile.alerta[data-ir="status"]').count()===1 && await p.locator('.ilha-aba[data-aba="status"] .ilha-aba-sel.alerta').count()===1);
    t('centro e botões lado a lado, sem sobrepor', await p.evaluate(()=>{ const e=document.querySelector('.ilha-trilho.esq').getBoundingClientRect(), c=document.querySelector('.ilha-centro').getBoundingClientRect(), d=document.querySelector('.ilha-trilho.dir').getBoundingClientRect(); return e.right<=c.left && c.right<=d.left; }));
    await p.screenshot({path:out+'/ux_1280_dark_resumo.png',clip:{x:0,y:0,width:1280,height:600}});
    await p.click('.ilha-tile[data-ir="agenda"]'); await p.waitForTimeout(200);
    t('bloco leva ao módulo (Agenda)', await p.locator('.ilha-aba.on[data-aba="agenda"]').count()===1 && await p.locator('.ilha-cab h2').textContent().then(x=>/Agenda/.test(x)));
    await p.click('.ilha-aba[data-aba="resumo"]'); await p.waitForTimeout(200);
    await p.click('.ilha-tile[data-ir="timers"] .ilha-tile-acao'); await p.waitForTimeout(600);
    t('⏸ no bloco pausa o timer (sem trocar de aba)', await p.evaluate(()=>(_tmMeus.t1||{}).status==='pausado') && await p.locator('.ilha-aba.on[data-aba="resumo"]').count()===1, await p.evaluate(()=>(_tmMeus.t1||{}).status));
    await p.focus('.ilha-tile[data-ir="notif"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
    t('Enter num bloco abre o módulo (Notificações)', await p.locator('.ilha-aba.on[data-aba="notif"]').count()===1 && await p.locator('.ilha-cab h2').textContent().then(x=>/Notificações/.test(x)));
    await p.click('.ilha-aba[data-aba="ajustes"]'); await p.waitForTimeout(200);
    t('Ajustes sem rolagem lateral (bug: rótulos cortados pela esquerda)', await semLateral(p) && await p.evaluate(()=>document.querySelector('#ilha-painel').scrollLeft===0));
    t('Ajustes em grupos com interruptores', await p.locator('.ilha-cfg-grupo').count()===2 && await p.locator('#ilha-cfg-mod-agenda').evaluate(e=>getComputedStyle(e).appearance==='none'));
    // quadros da abertura (movimento): fecha, reabre e pausa a animação em instantes fixos
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    await p.click('#ilha-btn');
    const quadros=[];
    for(const ms of [0,60,120,200]){ await p.evaluate(ms=>document.getAnimations().forEach(a=>{ if(a.animationName==='ilhaAbre'){ a.pause(); a.currentTime=ms; } }),ms);
      quadros.push(await p.evaluate(()=>{ const e=document.getElementById('ilha-painel'); const cs=getComputedStyle(e); return {op:+cs.opacity, top:Math.round(e.getBoundingClientRect().top)}; }));
      await p.screenshot({path:out+'/ux_abertura_'+ms+'ms.png',clip:{x:150,y:40,width:720,height:300}}); }
    t('abertura: aparece e assenta em ~200 ms, sem salto', quadros[0].op<0.2 && quadros[3].op>0.95 && Math.abs(quadros[3].top-quadros[0].top)<=8, quadros);
    t('sem erro de JS (desktop)', !errs.length, errs); await ctx.close(); }
  // 2) temas e celular: sem rolagem lateral em nenhuma aba; toque com alvos de 44 px
  for(const [w,h,tema] of [[1280,860,'light'],[1280,860,'vice'],[1280,860,'blackfriday'],[390,800,'dark'],[390,800,'light']]){
    const {ctx,p,errs}=await abrir(w,h,tema); const ruins=[];
    for(const a of await p.$$eval('.ilha-aba',xs=>xs.map(x=>x.dataset.aba))){ await p.click(`.ilha-aba[data-aba="${a}"]`); await p.waitForTimeout(150); if(!await semLateral(p)) ruins.push(a); }
    t(`${w}/${tema}: nenhuma aba com rolagem lateral`, !ruins.length, ruins);
    if(w<500){ const peq=await p.$$eval('#ilha-painel .ilha-aba-ico, #ilha-painel .ilha-tile-acao, #ilha-fixar',xs=>xs.filter(x=>{const r=x.getBoundingClientRect(); return r.width && (r.width<44||r.height<44);}).length);
      t(`${w}/${tema}: alvos de toque ≥ 44 px`, peq===0, peq);
      t(`${w}/${tema}: painel cabe na tela (botões embaixo, ao alcance do polegar)`, await p.evaluate(()=>{ const r=document.getElementById('ilha-painel').getBoundingClientRect(), d=document.querySelector('.ilha-trilho.esq').getBoundingClientRect(), c=document.querySelector('.ilha-centro').getBoundingClientRect(); return r.bottom<=innerHeight && d.top>=c.bottom-1; })); }
    await p.click('.ilha-aba[data-aba="resumo"]'); await p.waitForTimeout(150);
    await p.screenshot({path:`${out}/ux_${w}_${tema}_resumo.png`});
    t(`${w}/${tema}: sem erro de JS`, !errs.length, errs); await ctx.close();
  }
  // 3) larguras intermediárias (notebook pequeno, tablet com toque): o painel fica inteiro na tela
  for(const [w,h,toque] of [[834,1112,true],[1024,768,false],[1100,800,false]]){
    const ctx=await b.newContext({viewport:{width:w,height:h},hasTouch:toque}); await fake.install(ctx,seed());
    await ctx.addInitScript(pref=>{ try{ localStorage.setItem('mare_ilha_eve_dev',JSON.stringify(pref)); }catch(e){} },PREF);
    const p=await ctx.newPage(); await p.goto(base+'/kanban-dev.html?squad=site'); await p.waitForFunction(()=>!!window.__authCb);
    await p.evaluate(u=>window.__authCb(u),U); await p.waitForTimeout(3500); await p.evaluate(()=>document.querySelectorAll('.ov.open').forEach(o=>o.classList.remove('open')));
    await p.click('#ilha-btn'); await p.waitForTimeout(400);
    const r=await p.evaluate(()=>{ const a=document.getElementById('ilha-painel').getBoundingClientRect(); return {l:Math.round(a.left), r:Math.round(a.right), iw:innerWidth}; });
    t(`${w}px: painel inteiro na tela (de ${r.l} a ${r.r})`, r.l>=8 && r.r<=r.iw-8, r);
    if(toque){ const peq=await p.$$eval('#ilha-painel .ilha-acoes button, #ilha-painel .ilha-tile-acao, #ilha-fixar',xs=>xs.filter(x=>{const q=x.getBoundingClientRect(); return q.width && (q.width<44||q.height<44);}).length);
      t(`${w}px com toque: alvos ≥ 44 px`, peq===0, peq); }
    await ctx.close();
  }
  // 4) quem já usava a ilha (aba salva = timers, sem a marca do redesenho) vê o Resumo uma vez; depois vale a última aba de novo
  { const ctx=await b.newContext({viewport:{width:1280,height:860}}); await fake.install(ctx,seed());
    await ctx.addInitScript(()=>{ try{ if(!sessionStorage.getItem('jaSemeou')){ localStorage.setItem('mare_ilha_eve_dev',JSON.stringify({on:true,modo:'sempre',timer:true,notif:true,reabrir:'ultima',aba:'timers',mods:{agente:true}})); sessionStorage.setItem('jaSemeou','1'); } }catch(e){} });
    const p=await ctx.newPage(); await p.goto(base+'/kanban-dev.html?squad=site'); await p.waitForFunction(()=>!!window.__authCb);
    await p.evaluate(u=>window.__authCb(u),U); await p.waitForTimeout(3500); await p.evaluate(()=>document.querySelectorAll('.ov.open').forEach(o=>o.classList.remove('open')));
    await p.click('#ilha-btn'); await p.waitForTimeout(300);
    t('quem já usava: 1ª abertura depois do redesenho mostra o Resumo', await p.locator('.ilha-aba.on[data-aba="resumo"]').count()===1);
    await p.click('.ilha-aba[data-aba="timers"]'); await p.keyboard.press('Escape'); await p.waitForTimeout(200); await p.click('#ilha-btn'); await p.waitForTimeout(300);
    t('…e depois volta a abrir na última aba usada', await p.locator('.ilha-aba.on[data-aba="timers"]').count()===1);
    // "Analisando · N s" anda com o painel aberto e o foco dentro dele
    await p.click('.ilha-aba[data-aba="resumo"]'); await p.focus('.ilha-aba[data-aba="resumo"]');
    const a1=await p.locator('[data-vivo="ag"]').textContent(); await p.waitForTimeout(5600); const a2=await p.locator('[data-vivo="ag"]').textContent();
    t('"Analisando" anda com o painel aberto', a1!==a2 && /Analisando · \d+ s/.test(a2), {a1,a2});
    await ctx.close(); }
  await b.close(); console.log(`\n${n} asserções, ${f} falha(s)`); process.exit(f?1:0);
})();
