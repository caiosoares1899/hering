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
 const key=(p,k)=>p.keyboard.press(k); const cur=p=>p.evaluate(()=>slides[currentIdx].key);
 { const {ctx,p,errs}=await open(U('ana','Ana ADM'));
   // navegação por teclado
   await key(p,'ArrowRight'); await key(p,'ArrowRight'); t('→ → anda 2 slides', (await cur(p))==='ger:digital:cx', await cur(p));
   await key(p,'ArrowLeft'); t('← volta 1', (await cur(p))==='torre:digital', await cur(p));
   await key(p,' '); t('Espaço avança', (await cur(p))==='ger:digital:cx', await cur(p));
   // abrir detalhe de um Objetivo da gerência Tech (2 Objetivos: Checkout, Painel de dados)
   await p.evaluate(()=>_okrGoToKey('ger:digital:tech')); await p.waitForTimeout(200);
   await p.evaluate(()=>_okrOpenDetail('d2')); await p.waitForTimeout(200);
   const d=await p.evaluate(()=>({tit:document.querySelector('.d2-title').textContent, prev:[...document.querySelectorAll('.detail-next')].map(b=>b.textContent.trim()+':'+(b.disabled?'off':'on')), marcos:[...document.querySelectorAll('.d2-marco-nome')].map(x=>x.textContent)}));
   console.log('detalhe d2:',JSON.stringify(d));
   t('detalhe: Checkout é o 1º da gerência (Anterior desabilitado, Próximo habilitado)', d.prev.some(x=>/Anterior:off/.test(x))&&d.prev.some(x=>/Próximo.*:on/.test(x)), d);
   await key(p,'ArrowRight'); await p.waitForTimeout(200); t('→ no detalhe vai pro próximo Objetivo (Painel de dados) e NÃO troca o slide por baixo', (await p.evaluate(()=>document.querySelector('.d2-title').textContent))==='Painel de dados' && (await cur(p))==='ger:digital:tech', await cur(p));
   const m2=await p.evaluate(()=>[...document.querySelectorAll('.d2-marco-nome')].map(x=>x.textContent)); t('Marco com "aparecer na apresentação" desligado NÃO aparece no detalhe', !m2.includes('Oculto'), m2);
   await key(p,'Escape'); await p.waitForTimeout(150); t('Esc fecha o detalhe', !(await p.evaluate(()=>document.getElementById('detail-ov').classList.contains('open'))), '');
   // Esc em camadas: detalhe → comentários do Marco
   await p.evaluate(()=>_okrOpenDetail('d1')); await p.waitForTimeout(150); await p.evaluate(()=>_okrOpenMarcoComments('m1')); await p.waitForTimeout(250);
   await key(p,'Escape'); await p.waitForTimeout(100); const s1=await p.evaluate(()=>({mc:document.getElementById('mc-ov').classList.contains('open'),det:document.getElementById('detail-ov').classList.contains('open')}));
   t('Esc fecha só os comentários do Marco (detalhe continua)', !s1.mc&&s1.det, s1);
   // Colapsar concluídos
   const lin=await p.evaluate(()=>[...document.querySelectorAll('.d2-marco-row')].map(r=>({v:r.style.display!=='none'})));
   await p.evaluate(()=>_okrToggleColapsarConcluidos()); await p.waitForTimeout(150);
   const lin2=await p.evaluate(()=>({vis:[...document.querySelectorAll('.d2-marco-row')].filter(r=>r.style.display!=='none').length,tot:document.querySelectorAll('.d2-marco-row').length, num:[...document.querySelectorAll('.d2-marco-num')].filter(n=>n.parentElement.style.display!=='none').map(n=>n.textContent)}));
   t('Colapsar concluídos esconde só os concluídos (1 de 2)', lin2.vis===1&&lin2.tot===2, lin2); t('Colapsar concluídos renumera as linhas visíveis (1., não 2.)', lin2.num.join()==='1.', lin2.num);
   await key(p,'Escape');
   // Anotações: Enter envia, espaço/setas não trocam de slide
   await p.evaluate(()=>_okrGoToKey('torre:digital')); const antes=await cur(p);
   await p.evaluate(()=>_okrToggleNotes()); await p.waitForTimeout(150); await p.fill('#notes-input','primeira nota ao vivo'); await key(p,'ArrowRight'); await p.keyboard.type(' com espaço'); t('digitando anotação: setas/espaço NÃO trocam de slide', (await cur(p))===antes, await cur(p));
   await key(p,'Enter'); await p.waitForTimeout(300); const n=await p.evaluate(()=>document.querySelectorAll('#notes-list .note-item').length); t('Enter envia a anotação e ela aparece na lista', n===1, n);
   await key(p,'Escape'); 
   // filtro por tag + teclado
   await p.selectOption('#tb-tag',{index:1}); await p.waitForTimeout(300); const f1=await p.evaluate(()=>({n:slides.length,foco:document.activeElement.tagName})); t('depois de escolher a tag o foco sai do <select> (setas voltam a navegar)', f1.foco!=='SELECT', f1);
   // Objetivo que sai da apresentação ao vivo: o slide atual some
   await p.selectOption('#tb-tag',''); await p.evaluate(()=>_okrGoToKey('ger:digital:cx')); await p.waitForTimeout(150);
   await p.evaluate(()=>{ okrObjetivos.d3.mostrarApresentacao=false; scheduleRebuild(); }); await p.waitForTimeout(500);
   const jump=await p.evaluate(()=>({k:slides[currentIdx].key,keys:slides.map(s=>s.key)})); console.log('   slide atual sumiu ao vivo →',JSON.stringify(jump));
   t('ao esconder ao vivo o único Objetivo do slide atual, a apresentação não volta pra capa', jump.k!=='cover', jump);
   t('sem erro de JS', !errs.length, errs); await ctx.close(); }
 // visual das capas no modo só Hering
 { const {ctx,p}=await open(U('ana','Ana ADM')); await p.screenshot({path:'ap_capa.png'}); await p.evaluate(()=>_okrGoToKey('torre:digital')); await p.waitForTimeout(300); await p.screenshot({path:'ap_torre.png'}); await p.evaluate(()=>_okrGoToKey('ger:digital:tech')); await p.waitForTimeout(300); await p.screenshot({path:'ap_ger.png'}); await ctx.close(); }
 await b.close(); console.log(ok?'TUDO OK':'HÁ FALHAS'); })();
