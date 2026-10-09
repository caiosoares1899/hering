const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const U=(uid,n)=>({uid,email:uid+'@ciahering.com.br',displayName:n,photoURL:'',providerData:[{providerId:'google.com'}]});
const hoje=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}); const add=(s,n)=>{const d=new Date(s+'T12:00:00'); d.setDate(d.getDate()+n); return d.toLocaleDateString('en-CA');};
const ev=(id,tipo,titulo,data,extra)=>({id,tipo,titulo,data,diaInteiro:false,hi:'10:00',hf:'11:00',torre:'',areaIds:[],objetivoIds:[],tagIds:[],convidados:[],lembrar:{vespera:true,dia:true},local:'',link:'',descricao:'',rec:null,excecoes:{},criadoPor:{uid:'ana',nome:'Ana ADM'},criadoEm:'2026-10-01T10:00:00.000Z',atualizadoEm:'2026-10-01T10:00:00.000Z',...extra});
const seed=()=>({kanban:{okr:{objetivos:{d1:{id:'d1',titulo:'Fidelidade',areaId:'geral',torre:'digital',trimestres:['2026-Q4'],responsaveis:['ana'],history:[],ordem:0,indicadores:[],progressoPct:0},c1:{id:'c1',titulo:'Lojas',areaId:'geral',torre:'comercial',trimestres:['2026-Q4'],responsaveis:['ana'],history:[]}},
 marcos:{m1:{id:'m1',objetivoId:'d1',nome:'Regras aprovadas',progresso:'no_prazo',prazo:add(hoje,1)},m2:{id:'m2',objetivoId:'c1',nome:'Contrato (Comercial)',progresso:'no_prazo',prazo:add(hoje,1)}},
 calendario:{eventos:{
  e1:ev('e1','reuniao','Check-in global',add(hoje,0),{torre:''}), e2:ev('e2','reuniao','Reunião Digital',add(hoje,1),{torre:'digital'}), e3:ev('e3','evento','All hands',add(hoje,1),{torre:''}),
  e4:ev('e4','lembrete','Fechar mês',add(hoje,2),{torre:'digital',diaInteiro:true,hi:'',hf:''}), e5:ev('e5','reuniao','Reunião da Comercial',add(hoje,1),{torre:'comercial'}), e6:ev('e6','lembrete','Lembrete 2',add(hoje,3),{torre:'digital'})}}},
 usuarios:{ana:{uid:'ana',nome:'Ana ADM',email:'ana@ciahering.com.br',inscrito:true},bia:{uid:'bia',nome:'Bia PO',email:'bia@ciahering.com.br',inscrito:true,role:'po',gestorOkr:true}},config:{adm_emails:['ana@ciahering.com.br']}}});
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true; const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,350))); };
 const open=async(user,{hering=true,w=1280}={})=>{ const ctx=await b.newContext({viewport:{width:w,height:900}}); await fake.install(ctx,seed()); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
   if(!hering) await p.route('**/okr-dev.html*', async r=>{ const res=await r.fetch(); let body=await res.text(); body=body.replace('window.MARE_SO_HERING = true;','window.MARE_SO_HERING = false;'); r.fulfill({response:res,body}); });
   await p.goto('http://localhost:8941/okr-dev.html'+(hering?'':'?torre=digital')); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),user); await p.waitForTimeout(1500); await p.evaluate(()=>{ _okrToggleCal(); _okrCalSetVista('mes'); }); await p.waitForTimeout(400); return {ctx,p,errs}; };
 const leg=p=>p.evaluate(()=>[...document.querySelectorAll('.okr-cal-lg')].map(b=>({t:b.innerText.replace(/\s+/g,' ').trim(),off:b.classList.contains('off'),pr:b.getAttribute('aria-pressed')})));
 const itens=p=>p.evaluate(()=>[...document.querySelectorAll('.okr-cal-agday ~ .okr-cal-item .tt')].map(x=>x.innerText.trim()));
 // ─── modo só Hering
 { const {ctx,p,errs}=await open(U('ana','Ana ADM'));
   let l=await leg(p); console.log('   legenda:',JSON.stringify(l.map(x=>x.t)));
   t('legenda tem 4 chips (Reunião, Evento, Lembrete, Prazo de Marco) com contagem do mês', l.length===4 && l.map(x=>x.t).join('|')===`🗓️ Reunião 2|📌 Evento 1|🔔 Lembrete 2|◆ Prazo de Marco 1`, l.map(x=>x.t));
   t('Comercial/Corporativa fora (evento e prazo de Marco)', !/Reunião da Comercial|Contrato \(Comercial\)/.test(await p.evaluate(()=>document.getElementById('okr-cal-root').innerText)), '');
   const txt=await p.evaluate(()=>document.getElementById('okr-cal-root').innerText);
   t('sem resquício de torre/agenda/Arezzo na barra do calendário', !/agenda global|todas as agendas|Agenda Digital|todas as torres|torre|arezzo|microsoft/i.test(txt) && !(await p.evaluate(()=>{ const s=document.querySelector('#okr-cal-root select[aria-label=Torre]'); return s&&getComputedStyle(s).display!=='none'; })), txt.slice(0,300));
   await p.evaluate(()=>{ _okrCalSelDia(todaySPStr()); }); 
   // clicar em Reunião esconde reuniões e mantém a contagem
   await p.click('.okr-cal-lg:nth-child(1)'); await p.waitForTimeout(150); l=await leg(p);
   t('clicar em 🗓️ Reunião esconde as reuniões (chip fica riscado, aria-pressed=false, contagem preservada) e aparece "Mostrar todos"', l[0].off && l[0].pr==='false' && /Reunião 2/.test(l[0].t) && !!(await p.$('.okr-cal-lg-reset')), l);
   const chips=await p.evaluate(()=>[...document.querySelectorAll('.okr-cal-chip')].map(c=>c.innerText.trim()));
   t('no mês: só aparecem eventos/lembretes/prazos (nenhuma reunião)', chips.length>0 && !chips.some(c=>/Check-in global|Reunião Digital/.test(c)), chips);
   await p.click('.okr-cal-lg:nth-child(4)'); await p.waitForTimeout(150); const chips2=await p.evaluate(()=>[...document.querySelectorAll('.okr-cal-chip')].map(c=>c.innerText.trim())); t('esconder também ◆ Prazo tira o prazo do Marco', !chips2.some(c=>/Regras aprovadas/.test(c)), chips2);
   await p.click('.okr-cal-lg-reset'); await p.waitForTimeout(150); l=await leg(p); t('"Mostrar todos" religa tudo', l.every(x=>!x.off) && !(await p.$('.okr-cal-lg-reset')), l);
   // vista Agenda também filtra, e a legenda acompanha
   await p.evaluate(()=>_okrCalSetVista('agenda')); await p.waitForTimeout(200); await p.click('.okr-cal-lg:nth-child(3)'); await p.waitForTimeout(150);
   const ag=await p.evaluate(()=>[...document.querySelectorAll('.okr-cal-item .tt')].map(x=>x.innerText.trim())); t('vista Agenda: esconder 🔔 Lembrete tira os lembretes', !ag.some(x=>/Fechar mês|Lembrete 2/.test(x)) && ag.some(x=>/Check-in global/.test(x)), ag);
   // detalhe e editor: sem resquício
   await p.evaluate(()=>{ _okrCalMostrarTodos(); openOkrEvento('e1', todaySPStr()); }); await p.waitForTimeout(300);
   const det=await p.evaluate(()=>document.getElementById('okr-evd-body')?document.getElementById('okr-evd-body').innerText:document.body.innerText); 
   const ovTxt=await p.evaluate(()=>{ const o=[...document.querySelectorAll('.pc-modal-ov.open')].pop(); return o?o.innerText:''; });
   t('detalhe do evento sem "todas as torres"/"Agenda global"', !/todas as torres|Agenda global|Agenda Digital/i.test(ovTxt), ovTxt.slice(0,250));
   await p.evaluate(()=>{ document.querySelectorAll('.pc-modal-ov.open').forEach(o=>o.classList.remove('open')); openOkrEventoEditor(null); }); await p.waitForTimeout(300);
   const ed=await p.evaluate(()=>{ const o=[...document.querySelectorAll('.pc-modal-ov.open')].pop(); const sel=document.getElementById('okr-ev-torre'); return {txt:o?[...o.querySelectorAll('*')].filter(e=>e.children.length===0&&getComputedStyle(e).display!=='none'&&e.offsetParent!==null).map(e=>e.innerText||e.textContent).join(' | '):'', torre:sel&&sel.value, selVis:sel&&getComputedStyle(sel).display!=='none'}; });
   console.log('   editor torre/visível:',ed.torre,ed.selVis); t('editor: campo "Agenda" escondido, evento novo nasce na agenda da Digital e o texto não fala de torre', ed.torre==='digital' && !ed.selVis && !/torre|Agenda global|arezzo/i.test(ed.txt), ed);
   t('sem erro de JS (só Hering)', !errs.length, errs); await ctx.close(); }
 // ─── PO (não ADM): consegue criar evento (antes só ADM criava na global)
 { const {ctx,p,errs}=await open(U('bia','Bia PO')); const r=await p.evaluate(()=>({btn:!!document.querySelector('.okr-cal-bar .btn-p'), pad:_okrCalTorrePadrao(), pode:_okrCalPodeCriar(_okrCalTorrePadrao())})); t('PO/Gestor vê "+ Novo evento" e a agenda padrão é a da Digital', r.btn&&r.pad==='digital'&&r.pode, r);
   const msg=await p.evaluate(()=>_okrCalOrgTxt()); t('aviso de permissão não fala de "organizador da torre"', !/torre/.test(msg), msg); t('PO sem erro de JS', !errs.length, errs); await ctx.close(); }
 // ─── 3 torres (interruptor desligado): tudo como era + legenda funciona
 { const {ctx,p,errs}=await open(U('ana','Ana ADM'),{hering:false}); const sel=await p.evaluate(()=>{ const s=document.querySelector('#okr-cal-root select[aria-label=Torre]'); return s&&getComputedStyle(s).display!=='none'; }); const l=await leg(p);
   t('3 torres: seletor de agenda continua aparecendo', !!sel, sel); t('3 torres: legenda por tipo funciona igual', l.length===4, l);
   await p.click('.okr-cal-lg:nth-child(1)'); await p.waitForTimeout(150); t('3 torres: esconder Reunião', (await leg(p))[0].off, ''); t('3 torres sem erro de JS', !errs.length, errs); await ctx.close(); }
 // ─── deep link do sino/link reabre tudo
 { const {ctx,p}=await open(U('ana','Ana ADM')); await p.click('.okr-cal-lg:nth-child(2)'); await p.evaluate(()=>_okrAbrirEvento('e3', todaySPStr())); await p.waitForTimeout(400); const l=await leg(p); t('abrir um evento pelo sino/link religa os tipos (o evento tem que aparecer na lista por baixo)', l.every(x=>!x.off), l); await ctx.close(); }
 await b.close(); console.log(ok?'TUDO OK':'HÁ FALHAS'); })();
