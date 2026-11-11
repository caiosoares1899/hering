// 🏝️ Ilha Dinâmica — /monitorarbugs de 11/11/2026 (reproduz os achados antes do conserto):
// A) com o 📌 (manter aberta) o véu de vidro cobria o quadro e engolia os cliques; B) ilha fixada + card aberto por cima: Esc fechava a ilha
// em vez do card; C) a escuta do módulo 🤖 descartava a 1ª entrega quando o Firebase a entrega na hora (dado já em cache);
// D) desligar o módulo escolhido como atividade principal deixava o seletor de Ajustes mostrando outra coisa.
// (cabeçalho herdado:) painel aberto redesenhado (/melhoriauiux, 11/11/2026): botões redondos nas laterais, conteúdo no centro,
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
const PREF={on:true,modo:'sempre',principal:'agenda',timer:true,notif:true,secundaria:true,reabrir:'ultima',aba:'resumo',ux:2,mods:{agenda:true,agente:true}};
(async()=>{
  const b=await chromium.launch({executablePath:chrome});
  const ctx=await b.newContext({viewport:{width:1280,height:860}}); await fake.install(ctx,seed());
  await ctx.addInitScript(pref=>{ try{ localStorage.setItem('mare_ilha_eve_dev',JSON.stringify(pref)); }catch(e){} },PREF);
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(base+'/kanban-dev.html?squad=site'); await p.waitForFunction(()=>!!window.__authCb);
  await p.evaluate(u=>window.__authCb(u),U); await p.waitForTimeout(3500);
  await p.evaluate(()=>document.querySelectorAll('.ov.open').forEach(o=>o.classList.remove('open')));
  // A) 📌 + véu
  await p.click('#ilha-btn'); await p.waitForTimeout(300); await p.click('#ilha-fixar'); await p.waitForTimeout(200);
  const alvo=await p.evaluate(()=>{ const c=document.querySelector('.card'); const r=c.getBoundingClientRect(); const el=document.elementFromPoint(r.left+10,r.top+10); return {veu:el && el.id==='ilha-veu', card:!!(el && el.closest('.card'))}; });
  t('A) com o 📌, o quadro fica clicável (o véu não cobre)', !alvo.veu && alvo.card, alvo);
  t('A) com o 📌, a ilha segue aberta', await p.getAttribute('#ilha','data-estado')==='aberta');
  // B) card aberto por cima da ilha fixada: Esc fecha o card, não a ilha
  await p.evaluate(()=>openCard('c1')); await p.waitForTimeout(400);
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  const esc1=await p.evaluate(()=>({card:document.getElementById('card-ov').classList.contains('open'), ilha:document.getElementById('ilha').dataset.estado}));
  t('B) Esc com card aberto por cima fecha o card e mantém a ilha', !esc1.card && esc1.ilha==='aberta', esc1);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  t('B) o Esc seguinte fecha a ilha', await p.getAttribute('#ilha','data-estado')!=='aberta');
  // D) desligar o módulo escolhido como principal
  await p.click('#ilha-btn'); await p.waitForTimeout(300); await p.click('.ilha-aba[data-aba="ajustes"]'); await p.waitForTimeout(200);
  await p.uncheck('#ilha-cfg-mod-agenda'); await p.waitForTimeout(300);
  const d=await p.evaluate(()=>({pref:_ilhaPrefs().principal, sel:document.getElementById('ilha-cfg-principal').value}));
  t('D) desligar o módulo principal: o seletor e a preferência dizem a mesma coisa', d.pref===d.sel, d);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // C) entrega síncrona da escuta do agente (dado em cache no Firebase real)
  const c=await p.evaluate(()=>{
    const orig=window._onValue;
    window._onValue=(ref,cb,...r)=>{ if(/agente_analisando/.test(String(ref&&ref.p||ref&&ref.path||ref))){ cb({val:()=>({cmX:{squad:'site',cardId:'c2',desde:new Date(Date.now()-20000).toISOString()}})}); return ()=>{}; } return orig(ref,cb,...r); };
    const pr=_ilhaPrefs(); pr.mods.agente=false; _ilhaSalvar(); _ilhaRender(); pr.mods.agente=true; _ilhaSalvar(); _ilhaRender();
    window._onValue=orig;
    return _ilhaAgAnalisando().length;
  });
  t('C) 1ª entrega síncrona da escuta do agente não é descartada', c===1, c);
  t('sem erro de JS', !errs.length, errs);
  await ctx.close(); await b.close(); console.log(`\n${n} asserções, ${f} falha(s)`); process.exit(f?1:0);
})();
