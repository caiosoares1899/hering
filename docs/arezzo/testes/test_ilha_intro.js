// 🏝️ Ilha Dinâmica — ligar em 👤 Minhas preferências + introdução (11/11/2026, pedido do Caio): o botão saiu do ⏲ Timers; na 1ª vez
// que liga, 5 passos explicam o que é, a pílula, o painel aberto, os módulos (interruptores que já valem) e onde mudar depois.
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
(async()=>{
  const b=await chromium.launch({executablePath:chrome});
  const abrir=async(w,h)=>{ const ctx=await b.newContext({viewport:{width:w,height:h},hasTouch:w<500,isMobile:w<500}); await fake.install(ctx,seed());
    const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(base+'/kanban-dev.html?squad=site'); await p.waitForFunction(()=>!!window.__authCb);
    await p.evaluate(u=>window.__authCb(u),U); await p.waitForTimeout(3500);
    await p.evaluate(()=>document.querySelectorAll('.ov.open').forEach(o=>o.classList.remove('open'))); return {ctx,p,errs}; };
  { const {ctx,p,errs}=await abrir(1280,860);
    t('o popup ⏲ Timers não tem mais o botão de ligar', await p.locator('#tm-pop #ilha-ligar').count()===0);
    t('ilha começa desligada', await p.evaluate(()=>!_ilhaPrefs().on));
    await p.evaluate(()=>openMinhasPrefs()); await p.waitForTimeout(300);
    t('Minhas preferências tem a seção 🏝️ Ilha Dinâmica com Ligar e Como funciona', /Ligar a Ilha/.test(await p.locator('#ilha-ligar').textContent()) && /Como funciona/.test(await p.locator('#minhasprefs-body').textContent()));
    await p.click('#ilha-ligar'); await p.waitForTimeout(300);
    t('ligar pela 1ª vez liga a ilha e abre a introdução', await p.evaluate(()=>_ilhaPrefs().on) && await p.locator('#ilha-intro.open').count()===1 && /1 de 5/.test(await p.locator('.ii-passo').textContent()));
    t('foco vai para o botão principal da introdução', await p.evaluate(()=>document.activeElement && document.activeElement.dataset.ii==='proximo'));
    await p.click('[data-ii="proximo"]'); await p.waitForTimeout(150);
    t('Próximo → passo 2', /2 de 5/.test(await p.locator('.ii-passo').textContent()));
    await p.keyboard.press('ArrowRight'); await p.waitForTimeout(150);
    t('seta → avança (passo 3)', /3 de 5/.test(await p.locator('.ii-passo').textContent()));
    await p.click('[data-ii="voltar"]'); await p.waitForTimeout(150);
    t('Voltar → passo 2', /2 de 5/.test(await p.locator('.ii-passo').textContent()));
    await p.click('[data-ii-ponto="3"]'); await p.waitForTimeout(150);
    t('ponto de progresso leva ao passo 4 (módulos)', /4 de 5/.test(await p.locator('.ii-passo').textContent()) && await p.locator('[data-ii-mod="agenda"]').count()===1);
    await p.check('[data-ii-mod="agenda"]'); await p.waitForTimeout(400);
    t('interruptor da introdução já liga o módulo', await p.evaluate(()=>window.__ilhaMods().some(m=>m.id==='agenda' && m.ativo)));
    await p.focus('.ii-prim'); await p.keyboard.press('Tab'); await p.waitForTimeout(100);
    t('Tab no último controle volta para dentro da introdução', await p.evaluate(()=>!!document.activeElement.closest('#ilha-intro')));
    await p.click('[data-ii-ponto="4"]'); await p.waitForTimeout(150);
    await p.click('[data-ii="comecar"]'); await p.waitForTimeout(500);
    t('Começar a usar fecha a introdução e abre a ilha no Resumo', await p.locator('#ilha-intro.open').count()===0 && await p.getAttribute('#ilha','data-estado')==='aberta' && await p.locator('.ilha-aba.on[data-aba="resumo"]').count()===1);
    t('introdução marcada como vista', await p.evaluate(()=>_ilhaPrefs().introVista===true));
    await p.click('.ilha-aba[data-aba="ajustes"]'); await p.waitForTimeout(200); await p.click('[data-ii-abrir]'); await p.waitForTimeout(300);
    t('⚙ Ajustes → 📖 Como funciona reabre a introdução', await p.locator('#ilha-intro.open').count()===1);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    t('Esc fecha a introdução', await p.locator('#ilha-intro.open').count()===0);
    await p.evaluate(()=>openMinhasPrefs()); await p.waitForTimeout(200);
    t('com a ilha ligada, preferências mostram Desligar e ⚙ Ajustes da ilha', /Desligar/.test(await p.locator('#ilha-ligar').textContent()) && /Ajustes da ilha/.test(await p.locator('#minhasprefs-body').textContent()));
    await p.click('#ilha-ligar'); await p.waitForTimeout(300);
    t('Desligar desliga e atualiza o botão', await p.evaluate(()=>!_ilhaPrefs().on) && /Ligar a Ilha/.test(await p.locator('#ilha-ligar').textContent()) && await p.getAttribute('#ilha','hidden')!==null);
    await p.click('#ilha-ligar'); await p.waitForTimeout(300);
    t('religar não repete a introdução', await p.evaluate(()=>_ilhaPrefs().on) && await p.locator('#ilha-intro.open').count()===0);
    await p.evaluate(()=>{ closeOv('minhasprefs-ov'); }); await p.waitForTimeout(200);
    await p.evaluate(()=>openMinhasPrefs()); await p.waitForTimeout(200);
    await p.locator('#minhasprefs-body button', {hasText:'Como funciona'}).click(); await p.waitForTimeout(300);
    t('Minhas preferências → 📖 Como funciona abre a introdução', await p.locator('#ilha-intro.open').count()===1 && await p.locator('#minhasprefs-ov.open').count()===0);
    await p.click('[data-ii="pular"]'); await p.waitForTimeout(200);
    t('Pular fecha', await p.locator('#ilha-intro.open').count()===0);
    t('sem erro de JS (desktop)', !errs.length, errs); await ctx.close(); }
  { const {ctx,p,errs}=await abrir(390,800);
    await p.evaluate(()=>{ document.documentElement.setAttribute('data-theme','light'); openMinhasPrefs(); }); await p.waitForTimeout(300);
    await p.click('#ilha-ligar'); await p.waitForTimeout(300); const ruins=[];
    for(let i=0;i<5;i++){ const r=await p.evaluate(()=>{ const c=document.querySelector('.ii-caixa'), q=c.getBoundingClientRect(); const peq=[...document.querySelectorAll('#ilha-intro button:not(.ii-ponto), #ilha-intro .ii-mod')].filter(x=>{const b=x.getBoundingClientRect(); return b.width && b.height<44;}).length; return {lat:c.scrollWidth>c.clientWidth+1 || document.documentElement.scrollWidth>innerWidth, dentro:q.left>=0 && q.right<=innerWidth && q.bottom<=innerHeight+1, peq}; });
      if(r.lat||!r.dentro||r.peq) ruins.push({passo:i+1,...r}); if(i<4){ await p.click('[data-ii="proximo"]'); await p.waitForTimeout(150); } }
    t('390 px: cabe na tela, sem rolagem lateral, alvos ≥ 44 px em todos os passos', !ruins.length, ruins);
    t('sem erro de JS (celular)', !errs.length, errs); await ctx.close(); }
  await b.close(); console.log(`\n${n} asserções, ${f} falha(s)`); process.exit(f?1:0);
})();
