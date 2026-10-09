// 🔗 Cards (Radar): lista de cards com badge 🎯 OKR por squad + vínculo com Objetivos. Só baixa os cards ao clicar. okr-dev.html (BASE=…/okr.html testa a prod).
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const BASE=process.env.BASE||'http://localhost:8941/okr-dev.html';
const U=(uid,n,email)=>({uid,email:email||uid+'@ciahering.com.br',displayName:n,photoURL:'',providerData:[{providerId:'google.com'}]});
const mk=(id,t,o)=>({id,titulo:t,areaId:'geral',trimestres:['2026-Q4'],responsaveis:['ana'],tagIds:[],history:[],indicadores:[],progressos:[],proximosPassos:[],riscos:[],planosAcao:[],descricao:'',torre:'digital',...o});
const seed=()=>({kanban:{okr:{objetivos:{d1:mk('d1','Fidelidade',{cardLinks:[{squadId:'dados',cardId:'c1'}]}),d2:mk('d2','Arquivado',{archived:true,cardLinks:[{squadId:'dados',cardId:'c2'}]})},marcos:{},tags:{},reuniao_notas:{}},
 usuarios:{ana:{uid:'ana',nome:'Ana ADM',email:'ana@ciahering.com.br',inscrito:true,init:'AA',role:'adm',squads:{dados:true}}},usuarios_publicos:{ana:{uid:'ana',nome:'Ana ADM',init:'AA'}},config:{adm_emails:['ana@ciahering.com.br']},painel_viewers:{'ext@gmail,com':true},
 squads_meta:{'outlet-crm':{label:'Outlet CRM',emoji:'🛍️',color:'#f90'}},
 squads:{dados:{dados:{columns:[{id:'todo',name:'A fazer'},{id:'doing',name:'Em andamento'}],tags:[{id:'t9',label:'OKR Q4',isOKR:true}],cards_index:{c1:'k1',c2:'k2',c3:'k3',c4:'k4',c5:'k5'},cards:{
   k1:{id:'c1',title:'Campanha Dia dos Pais',col:'doing',owner:'AA',due:'2026-10-20',isOKR:true},k2:{id:'c2',title:'Card vinculado só por Objetivo arquivado',col:'todo',tags:['okr']},k3:{id:'c3',title:'Card com tag de OKR do squad',col:'todo',tags:['t9']},
   k4:{id:'c4',title:'Card comum (sem OKR)',col:'todo'},k5:{id:'c5',title:'Card OKR arquivado',col:'todo',isOKR:true,archived:true}}}},
  'outlet-crm':{dados:{columns:[{id:'a',name:'Fila'}],tags:[],cards_index:{cx:'kx'},cards:{kx:{id:'cx',title:'Card do Outlet',col:'a',tags:['okr']}}}}}}});
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true; const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,300))); };
 const open=async(user)=>{ const ctx=await b.newContext({viewport:{width:1280,height:900}}); await fake.install(ctx,seed()); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept()); const tabs=[]; ctx.on('page',pg=>tabs.push(pg.url()));
   await p.goto(BASE); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),user); await p.waitForTimeout(2500); return {ctx,p,errs,tabs}; };
 { const {ctx,p,errs,tabs}=await open(U('ana','Ana ADM'));
   await p.evaluate(()=>{ if(typeof _okrEntrarTorre==='function') _okrEntrarTorre('digital'); }); await p.waitForTimeout(300);
   t('aba "🔗 Cards" existe', await p.evaluate(()=>!!document.getElementById('okr-cards-btn') && getComputedStyle(document.getElementById('okr-cards-btn')).display!=='none'), 'sem aba');
   const antes=await p.evaluate(()=>window.__log.filter(l=>l[0]==='get'&&/\/dados\/cards$/.test(l[1])).length);
   await p.click('#okr-cards-btn'); await p.waitForTimeout(400);
   const ini=await p.evaluate(()=>({on:document.getElementById('okr-cards-btn').classList.contains('on'), obj:getComputedStyle(document.getElementById('okr-toolbar')).display, btn:!!document.querySelector('#okr-cards-root button.btn')}));
   t('abrir a aba NÃO baixa os cards (só mostra "Carregar cards") e esconde a lista de Objetivos', ini.on && ini.obj==='none' && ini.btn && (await p.evaluate(()=>window.__log.filter(l=>l[0]==='get'&&/\/dados\/cards$/.test(l[1])).length))===antes, ini);
   await p.click('#okr-cards-root button.btn'); await p.waitForTimeout(1500);
   const l=await p.evaluate(()=>({txt:document.getElementById('okr-cards-root').innerText.replace(/\s+/g,' '), itens:[...document.querySelectorAll('#okr-cards-root .okr-list-item')].length}));
   t('lista só os cards COM badge OKR e não arquivados, de todos os squads (inclusive os de squads_meta)', l.itens===4 && /Campanha Dia dos Pais/.test(l.txt) && /Card vinculado só por Objetivo arquivado/.test(l.txt) && /Card com tag de OKR do squad/.test(l.txt) && /Card do Outlet/.test(l.txt) && !/Card comum/.test(l.txt) && !/OKR arquivado/.test(l.txt) && /Outlet CRM/.test(l.txt), l);
   t('mostra coluna, responsável e prazo do card', /Em andamento/.test(l.txt) && /Ana/.test(l.txt) && /20\/10/.test(l.txt), l.txt);
   t('vínculo com Objetivo: "Fidelidade" no card vinculado; Objetivo ARQUIVADO não conta (card c2 fica "sem vínculo")', /Campanha Dia dos Pais[^🎯]*🎯 Fidelidade/.test(l.txt) && (l.txt.match(/sem vínculo com Objetivo/g)||[]).length===3, l.txt);
   t('resumo: 4 cards, 1 vinculado, 3 sem vínculo', /4 cards com badge OKR · 1 vinculado · 3 sem vínculo/.test(l.txt), l.txt);
   await p.selectOption('#okr-cards-root select','sem'); await p.waitForTimeout(200);
   t('filtro "Sem vínculo" esconde o vinculado', (await p.evaluate(()=>[...document.querySelectorAll('#okr-cards-root .okr-list-item')].length))===3 && !(await p.evaluate(()=>/Dia dos Pais/.test(document.getElementById('okr-cards-root').innerText))), 'filtro');
   await p.selectOption('#okr-cards-root select','todos'); await p.fill('#okr-cards-busca','fidel'); await p.waitForTimeout(250);
   t('busca acha pelo título do Objetivo vinculado', (await p.evaluate(()=>[...document.querySelectorAll('#okr-cards-root .okr-list-item')].length))===1, 'busca');
   await p.fill('#okr-cards-busca',''); await p.waitForTimeout(150);
   await p.click('#okr-cards-root span[title^="Abrir o card"]'); await p.waitForTimeout(500);
   t('clicar no card abre o board no card (aba nova)', tabs.some(u=>/kanban(-dev)?\.html\?squad=dados&card=c1/.test(u)), tabs);
   await p.click('#okr-cards-root button[title="Abrir o Objetivo"]'); await p.waitForTimeout(900);
   t('clicar no Objetivo vinculado abre o Objetivo', await p.evaluate(()=>!!document.querySelector('#okr-obj-ov.open, .okr-modal-ov.open, [id^="okr-sec-links-"]')), 'modal');
   t('sem erro de JS', !errs.length, errs); await ctx.close(); }
 { const {ctx,p}=await open(U('ext','Externo','ext@gmail.com')); const v=await p.evaluate(()=>{ _okrSetView('objetivos'); const b=document.getElementById('okr-cards-btn'); return b?getComputedStyle(b).display:'sem'; }); t('visualizador externo não vê a aba 🔗 Cards', v==='none'||v==='sem', v); await ctx.close(); }
 await b.close(); console.log(ok?'TUDO OK':'HÁ FALHAS'); })();
