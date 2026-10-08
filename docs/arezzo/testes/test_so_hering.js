// MODO "SÓ HERING" (okr-dev): login só Google, OKR de uma torre só (Digital), pessoas só @ciahering — boot real, Firebase falso
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const BASE=process.env.BASE||'http://localhost:8941/okr-dev.html';
let falhas=0; const ok=(n,c,d)=>{ if(!c) falhas++; console.log(c?'✅':'❌',n,c?'':(d===undefined?'':String(d).slice(0,300))); };
const hoje=new Date().toISOString().slice(0,10);
const mk=(id,t,o,extra)=>({id,titulo:t,areaId:'geral',trimestres:['2026-Q4'],responsaveis:[],tagIds:[],history:[],ordem:o,indicadores:[],progressos:[],proximosPassos:[],riscos:[],planosAcao:[],...extra});
const seed=()=>({kanban:{
  okr:{objetivos:{ o1:mk('o1','Digital sem campo torre',0,{areaId:'dadosia'}), o2:mk('o2','Digital explícito',1,{torre:'digital',areaId:'cx'}),
      c1:mk('c1','Comercial um SEGREDO',0,{torre:'comercial'}), k1:mk('k1','Corporativa um SEGREDO',0,{torre:'corporativa'}) },
    marcos:{ m1:{id:'m1',objetivoId:'o1',nome:'Marco digital',progresso:'em_andamento',prazo:hoje}, m2:{id:'m2',objetivoId:'c1',nome:'Marco comercial SEGREDO',progresso:'em_andamento',prazo:hoje} },
    snapshots:{'2026-09-25':{date:'2026-09-25',resumoGeral:{total:3},objetivos:{ o1:{titulo:'D',areaId:'dadosia',torre:'digital',status:'no_prazo',progressoPct:40,totalMarcos:0,marcosConcluidos:0}, c1:{titulo:'C SEGREDO',areaId:'geral',torre:'comercial',status:'no_prazo',progressoPct:50,totalMarcos:0,marcosConcluidos:0} }}},
    calendario:{eventos:{ eg:{id:'eg',titulo:'Reunião GLOBAL',tipo:'reuniao',data:hoje,torre:''}, ed:{id:'ed',titulo:'Reunião Digital',tipo:'reuniao',data:hoje,torre:'digital'}, ec:{id:'ec',titulo:'Reunião Comercial SEGREDO',tipo:'reuniao',data:hoje,torre:'comercial'} }},
    mural:{ a1:{id:'a1',tipo:'aviso',titulo:'Aviso pra todos',torres:['*'],ts:new Date().toISOString(),autor:'Ana'}, a2:{id:'a2',tipo:'aviso',titulo:'Aviso Digital',torres:['digital'],ts:new Date().toISOString(),autor:'Ana'}, a3:{id:'a3',tipo:'aviso',titulo:'Aviso Comercial SEGREDO',torres:['comercial'],ts:new Date().toISOString(),autor:'Ana'} } },
  usuarios:{ ana:{uid:'ana',nome:'Ana ADM',email:'ana@ciahering.com.br',inscrito:true},
             bia:{uid:'bia',nome:'Bia Hering',email:'bia@ciahering.com.br',inscrito:true,torre:'comercial'},
             az:{uid:'az',nome:'Zé Arezzo',email:'ze@arezzo.com.br',inscrito:true},
             novo:{uid:'novo',nome:'Novo Hering',email:'novo@ciahering.com.br',inscrito:true,criadoEm:'2026-12-01T10:00:00Z'} },
  config:{adm_emails:['ana@ciahering.com.br']}}});
const U=(uid,email,nome,prov)=>({uid,email,displayName:nome,photoURL:'',providerData:[{providerId:prov||'google.com'}]});
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 async function open(user,qs){ const ctx=await b.newContext({viewport:{width:1280,height:900}}); await fake.install(ctx,seed()); const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(e.message)); page.on('dialog',d=>d.accept());
   await page.goto(BASE+(qs||'')); await page.waitForFunction(()=>!!window.__authCb); const login=await page.evaluate(()=>({ms:getComputedStyle(document.querySelector('button[onclick="doSignInMicrosoft()"]')).display, txt:document.getElementById('login-ov').innerText}));
   await page.evaluate(u=>window.__authCb(u),user); await page.waitForTimeout(1500); return {ctx,page,errs,login}; }
 // 1) login
 { const {ctx,page,login}=await open(U('ana','ana@ciahering.com.br','Ana ADM'));
   ok('1a. botão "Entrar com Microsoft" escondido e o texto fala só de Google', login.ms==='none' && !/microsoft/i.test(login.txt), JSON.stringify(login));
   ok('1b. texto de acesso restrito não cita @arezzo', !/arezzo/i.test(login.txt), login.txt);
   const g=await page.evaluate(()=>({ms:window.MARE_SO_HERING, td:TRUSTED_DOMAINS, a:_isTrustedDomainEmail('x@arezzo.com.br'), h:_isTrustedDomainEmail('x@ciahering.com.br')}));
   ok('1c. TRUSTED_DOMAINS = só @ciahering; @arezzo não é confiável', g.ms===true && g.td.length===1 && g.a===false && g.h===true, JSON.stringify(g));
   const t=await page.evaluate(()=>{ doSignInMicrosoft(); return document.getElementById('login-err').textContent; });
   ok('1d. doSignInMicrosoft() recusa com mensagem', /desativado/.test(t), t); await ctx.close(); }
 // 2) uma torre só
 { const {ctx,page,errs}=await open(U('ana','ana@ciahering.com.br','Ana ADM'));
   const r=await page.evaluate(()=>({home:getComputedStyle(document.getElementById('okr-home')).display, nav:getComputedStyle(document.getElementById('okr-torre-nav')).display, atual:_okrTorreAtual, torres:OKR_TORRES.map(t=>t.id),
      titulos:[...document.querySelectorAll('.okr-card-title')].map(e=>e.textContent), body:document.body.innerText}));
   ok('2a. entra direto na Digital: sem home de torres, sem barra de torres', r.home==='none' && r.nav==='none' && r.atual==='digital' && r.torres.join()==='digital', JSON.stringify({home:r.home,nav:r.nav,atual:r.atual,torres:r.torres}));
   ok('2b. a lista mostra só os Objetivos Digitais (com e sem o campo torre)', r.titulos.length===2 && r.titulos.every(t=>/Digital/.test(t)), JSON.stringify(r.titulos));
   ok('2c. nada de SEGREDO (Comercial/Corporativa) em lugar nenhum da tela', !/SEGREDO/.test(r.body));
   const e=await page.evaluate(()=>{ _okrEntrarTorre('comercial'); const a1=_okrTorreAtual; _okrEntrarTorre('global'); const a2=_okrTorreAtual; _okrEntrarTorre(''); return [a1,a2,_okrTorreAtual]; });
   ok('2d. _okrEntrarTorre("comercial"/"global"/"") sempre cai na Digital', e.join()==='digital,digital,digital', e.join());
   const dados=await page.evaluate(()=>({obj:Object.keys(okrObjetivos).sort().join(), ev:Object.keys(okrEventos).sort().join(), mu:Object.keys(okrMural).sort().join()}));
   ok('2e. cache: Objetivos/eventos/avisos de outra torre nem entram (ficam só no banco)', dados.obj==='o1,o2' && dados.ev==='ed,eg' && dados.mu==='a1,a2', JSON.stringify(dados));
   const bd=await page.evaluate(async()=>{ _okrSetView('calendario'); await new Promise(r=>setTimeout(r,500)); const c=document.body.innerText; _okrSetView('historico'); await new Promise(r=>setTimeout(r,700)); return {cal:c, hist:document.body.innerText}; });
   ok('2f. Calendário e Histórico semanal sem nada das outras torres', !/SEGREDO/.test(bd.cal) && !/SEGREDO/.test(bd.hist), (bd.cal+bd.hist).match(/.{0,30}SEGREDO.{0,30}/)?.[0]);
   const cfg=await page.evaluate(()=>{ _okrSetView('objetivos'); openOkrObjetivo('o1'); openOkrConfig(); return {torreCampo:!!document.getElementById('okr-f-torre'), txt:document.getElementById('okr-obj-config-body').innerText}; });
   ok('2g. ⚙ Configurações do Objetivo não tem o campo Torre', !cfg.torreCampo && !/\bTorre\b/.test(cfg.txt), cfg.txt.slice(0,120));
   ok('2h. sem erros de JS', errs.length===0, errs.join('|')); await ctx.close(); }
 // 3) Objetivo novo nasce Digital; torre da pessoa não importa; sem prompt de torre
 { const {ctx,page}=await open(U('novo','novo@ciahering.com.br','Novo Hering')); await page.waitForTimeout(500);
   const p=await page.evaluate(()=>({prompt:!!document.getElementById('okr-torre-ov'), minha:_okrMinhaTorre(), criar:_okrTorreParaCriar()}));
   ok('3a. cadastro novo NÃO recebe a pergunta de torre', p.prompt===false && p.minha==='digital' && p.criar==='digital', JSON.stringify(p));
   await ctx.close(); }
 { const {ctx,page}=await open(U('ana','ana@ciahering.com.br','Ana ADM'));
   await page.evaluate(()=>{ openOkrObjetivo(null); }); await page.waitForTimeout(200);
   const t=await page.evaluate(()=>_okrObjDraft.torre); ok('3b. Objetivo novo nasce Digital', t==='digital', t); await ctx.close(); }
 // 4) pessoas só @ciahering
 { const {ctx,page}=await open(U('ana','ana@ciahering.com.br','Ana ADM'));
   const nomes=await page.evaluate(()=>_okrPessoaOptions().map(p=>p.nome));
   ok('4a. listas de pessoas/@menção só com @ciahering (sem o Zé da Arezzo)', nomes.includes('Bia Hering') && nomes.includes('Novo Hering') && !nomes.includes('Zé Arezzo'), nomes.join());
   await ctx.close(); }
 // 5) externo (visualizador) cai no portão de domínio como antes
 { const {ctx,page}=await open(U('az','ze@arezzo.com.br','Zé Arezzo','microsoft.com')); await page.waitForTimeout(800);
   const r=await page.evaluate(()=>({err:document.getElementById('login-err').textContent, login:getComputedStyle(document.getElementById('login-ov')).display}));
   ok('5. conta @arezzo/Microsoft é barrada no portão ("Acesso restrito a @ciahering.com.br")', /restrito|visualizador|Microsoft|Google/i.test(r.err) && !/arezzo/i.test(r.err.replace(/ze@arezzo/,'')), JSON.stringify(r)); await ctx.close(); }
 await b.close(); console.log(falhas?('FALHAS: '+falhas):'TUDO OK'); process.exit(falhas?1:0); })();
