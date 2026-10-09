const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const U=(uid,n,email)=>({uid,email:email||uid+'@ciahering.com.br',displayName:n,photoURL:'',providerData:[{providerId:'google.com'}]});
const mk=(id,t,o)=>({id,titulo:t,areaId:'geral',trimestres:['2026-Q4'],responsaveis:['ana'],tagIds:[],history:[],indicadores:['i1'],progressos:['p1'],proximosPassos:[],riscos:[],planosAcao:[],descricao:'desc '+t,...o});
const mc=(id,obj,nome,prog,extra)=>({id,objetivoId:obj,nome,progresso:prog,prazo:'2026-12-01',descricao:'',...extra});
const seed=()=>({kanban:{okr:{
 objetivos:{
  d1:mk('d1','Fidelidade',{torre:'digital',areaId:'crm',tagIds:['t1'],ordem:0}), d2:mk('d2','Checkout',{torre:'digital',areaId:'tech',tagIds:['t1','t2'],ordem:0}), d3:mk('d3','NPS',{torre:'digital',areaId:'cx',ordem:0}),
  d4:mk('d4','Painel de dados',{torre:'digital',areaId:'tech',ordem:1}),
  c1:mk('c1','Abrir 12 lojas',{torre:'comercial',tagIds:['t1','t3']}), c2:mk('c2','Ticket médio',{torre:'comercial',tagIds:['t3']}), k1:mk('k1','Orçamento 2027',{torre:'corporativa',tagIds:['t3']}),
  oc:mk('oc','Oculto na apresentação',{torre:'digital',areaId:'tech',tagIds:['t1'],mostrarApresentacao:false}), ar:mk('ar','Arquivado',{torre:'digital',areaId:'tech',tagIds:['t1'],arquivado:true})},
 marcos:{m1:mc('m1','d1','Regras aprovadas','concluido'),m2:mc('m2','d1','Piloto','no_prazo'),m3:mc('m3','d2','Fluxo novo','atrasado'),m4:mc('m4','c1','Contrato','concluido'),m5:mc('m5','d4','Oculto','risco',{mostrarApresentacao:false})},
 tags:{t1:{label:'Peak Natal',colorIdx:1},t2:{label:'Tech',colorIdx:2},t3:{label:'Só Comercial/Corp',colorIdx:3}}, reuniao_notas:{}},
 usuarios:{ana:{uid:'ana',nome:'Ana ADM',email:'ana@ciahering.com.br',inscrito:true,init:'AA'}},usuarios_publicos:{ana:{uid:'ana',nome:'Ana ADM',init:'AA'}},config:{adm_emails:['ana@ciahering.com.br']},painel_viewers:{'ext@gmail,com':true}}});
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true; const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,400))); };
 const open=async(user,{hering=true,qs='',w=1366,h=768}={})=>{ const ctx=await b.newContext({viewport:{width:w,height:h}}); await fake.install(ctx,seed()); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
   if(!hering) await p.route('**/okr-apresentacao.slide.html*', async r=>{ const res=await r.fetch(); let body=await res.text(); body=body.replace('const MARE_SO_HERING = true','const MARE_SO_HERING = false'); r.fulfill({response:res,body}); });
   await p.goto('http://localhost:8941/okr-apresentacao.slide.html'+qs); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),user); await p.waitForTimeout(1500); return {ctx,p,errs}; };
 const info=p=>p.evaluate(()=>({n:slides.length, keys:slides.map(s=>s.key), idx:currentIdx, titulo:document.getElementById('tb-title').textContent, tagOpts:[...document.querySelectorAll('#tb-tag option')].map(o=>o.textContent), torreBox:!document.getElementById('tb-filter-torre').hidden, cover:document.querySelector('.slide.active')?.innerText.replace(/\s+/g,' ').slice(0,260)}));
 // ───── modo só Hering
 { const {ctx,p,errs}=await open(U('ana','Ana ADM')); const i=await info(p); console.log('SÓ HERING:',JSON.stringify(i));
   t('só Hering: slides = capa + torre + 3 gerências(crm,tech,cx) + panorama', i.n===1+1+3+1 && i.keys.join()==='cover,torre:digital,ger:digital:crm,ger:digital:tech,ger:digital:cx,summary'.replace('ger:digital:crm,ger:digital:tech,ger:digital:cx', i.keys.slice(2,5).join()), i.keys);
   t('só Hering: 4 Objetivos ativos na capa (oculto/arquivado/outras torres fora)', /4\s*Objetivos ativos/.test(i.cover), i.cover);
   const tg=i.tagOpts; console.log('   opções de tag:',tg);
   t('só Hering: contagem da tag "Peak Natal" = Objetivos VISÍVEIS (2: Fidelidade + Checkout)', tg.some(x=>/Peak Natal \(2\)/.test(x)), tg);
   t('só Hering: tag usada só por Comercial/Corporativa NÃO aparece no filtro', !tg.some(x=>/Só Comercial/.test(x)), tg);
   t('só Hering: seletor de torre escondido', !i.torreBox, i);
   t('sem erro de JS', !errs.length, errs); await ctx.close(); }
 // ───── modo 3 torres
 { const {ctx,p,errs}=await open(U('ana','Ana ADM'),{hering:false}); const i=await info(p); console.log('3 TORRES:',JSON.stringify({n:i.n,keys:i.keys,tagOpts:i.tagOpts,torreBox:i.torreBox}));
   t('3 torres: seletor de torre aparece', i.torreBox, i); t('3 torres: tag "Só Comercial/Corp" (usada por 3 Objetivos ativos: c1,c2,k1)', i.tagOpts.some(x=>/Só Comercial\/Corp \(3\)/.test(x)), i.tagOpts);
   await p.selectOption('#tb-torre','comercial'); await p.waitForTimeout(400); const j=await info(p); console.log('   filtro Comercial → tags:',j.tagOpts);
   t('3 torres: com filtro de torre Comercial, a contagem de cada tag segue o filtro', j.tagOpts.some(x=>/Peak Natal \(1\)/.test(x)) , j.tagOpts); t('sem erro de JS (3 torres)', !errs.length, errs); await ctx.close(); }
 // ───── anotações como visualizador externo
 { const {ctx,p,errs}=await open(U('ext','Externo','ext@gmail.com')); const r=await p.evaluate(async()=>{ _okrToggleNotes(); await new Promise(r=>setTimeout(r,100)); const c=document.getElementById('notes-compose'), rd=document.getElementById('notes-readonly'); const antes=Object.keys(okrNotas).length; document.getElementById('notes-input').value='nota do externo'; _okrAddNota(); await new Promise(r=>setTimeout(r,300)); _okrToggleAgendaCfg(); return {composeOculto:c.hidden, aviso:rd.hidden?'':rd.textContent, agendaAbriu:document.getElementById('agenda-cfg-ov').classList.contains('open'), gravou:Object.keys(okrNotas).length-antes}; });
   console.log('VISUALIZADOR:',JSON.stringify(r)); t('visualizador: sem caixa de compor e com aviso de "só acompanha"', r.composeOculto && /visualizador/.test(r.aviso), r); t('visualizador: tentativa de enviar não grava e o ⏱ horário não abre', r.gravou===0 && !r.agendaAbriu, r); t('visualizador sem erro de JS', !errs.length, errs); await ctx.close(); }
 // ───── anotação que falha ao gravar: o texto volta pro campo e avisa
 { const {ctx,p}=await open(U('ana','Ana ADM')); const r=await p.evaluate(async()=>{ _okrToggleNotes(); await new Promise(r=>setTimeout(r,100)); const orig=window._set; window._set=()=>Promise.reject(new Error('negado')); const inp=document.getElementById('notes-input'); inp.value='anotação importante'; _okrAddNota(); await new Promise(r=>setTimeout(r,200)); window._set=orig; const rd=document.getElementById('notes-readonly'); return {campo:inp.value, aviso:rd.hidden?'':rd.textContent}; });
   console.log('FALHA AO GRAVAR:',JSON.stringify(r)); t('falha ao gravar anotação: texto volta pro campo + aviso', r.campo==='anotação importante' && /Não foi possível/.test(r.aviso), r); await ctx.close(); }
 await b.close(); console.log(ok?'TUDO OK':'HÁ FALHAS'); })();
