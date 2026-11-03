// 📋 Calendário de gestão do Digital (Radar, okr-dev): tipo Entrega (status, responsáveis, pai/filhos), macro PLAN/CHECK/DO/ENGAJAMENTO e gerador "Cadência do Digital".
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const U=(uid,n)=>({uid,email:uid+'@ciahering.com.br',displayName:n,photoURL:'',providerData:[{providerId:'google.com'}]});
const seed=()=>({kanban:{okr:{objetivos:{d1:{id:'d1',titulo:'Fidelidade',areaId:'geral',torre:'digital',trimestres:['2026-Q4'],responsaveis:['ana'],history:[],ordem:0,indicadores:[],progressoPct:0}},marcos:{},calendario:{eventos:{}}},
 usuarios:{ana:{uid:'ana',nome:'Ana ADM',email:'ana@ciahering.com.br',inscrito:true},raf:{uid:'raf',nome:'Rafa Resp',email:'raf@ciahering.com.br',inscrito:true},zed:{uid:'zed',nome:'Zed Outro',email:'zed@ciahering.com.br',inscrito:true}},config:{adm_emails:['ana@ciahering.com.br']}}});
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true; const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,400))); };
 const abrir=async(user,w,sd)=>{ const ctx=await b.newContext({viewport:{width:w||1280,height:900}}); await fake.install(ctx,sd||seed()); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
   await p.goto('http://localhost:8941/okr-dev.html'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),user); await p.waitForTimeout(1500);
   await p.evaluate(()=>{ _okrToggleCal(); _okrCalSetVista('agenda'); }); await p.waitForTimeout(500); return {ctx,p,errs}; };
 // ── ADM: cadência
 { const {ctx,p,errs}=await abrir(U('ana','Ana ADM'));
   t('botão 📋 Cadência do Digital aparece pro ADM', !!(await p.$('button[onclick="_okrCadenciaAbrir()"]')), '');
   const it=await p.evaluate(()=>{ const t=_okrCadTrimestres(4); return {t, q4:_okrCadenciaItens(t[0].ano,t[0].q).length, q3:_okrCadenciaItens(2027,3).length, fixos:_okrCadenciaFixos().length}; });
   console.log('   itens:',JSON.stringify(it));
   t('trimestre sem 3º tri: 1+7 (tático) +1+4 (compras) +1 (All Hands) = 14; 3º tri soma 5 anuais = 19; 3 fixos', it.q4===14 && it.q3===19 && it.fixos===3, it);
   const prazo=await p.evaluate(()=>{ const t=_okrCadTrimestres(1)[0]; const i=_okrCadenciaItens(t.ano,t.q)[0]; const d=_calParse(i.data); return {data:i.data, dow:d.getDay(), ini:_okrCadTriInicio(t.ano,t.q), dias:_calDiasEntre(i.data,_okrCadTriInicio(t.ano,t.q))}; });
   t('prazo do plano: ~15 dias antes do trimestre e em dia útil', prazo.dow>=1 && prazo.dow<=5 && prazo.dias>=15 && prazo.dias<=17, prazo);
   // aplica o 1º trimestre pelo diálogo
   await p.evaluate(()=>{ window.__cad=_okrCadenciaAbrir(); }); await p.waitForTimeout(300);
   const rot=await p.evaluate(()=>[...document.querySelectorAll('div[style*="z-index: 9999"] button')].map(b=>b.innerText));
   t('diálogo lista 4 trimestres + Cancelar, com contagem de itens novos', rot.length===5 && /novo/.test(rot[0]) && rot[4]==='Cancelar', rot);
   await p.evaluate(()=>document.querySelector('div[style*="z-index: 9999"] button[data-i="0"]').click()); await p.waitForTimeout(1200);
   const n1=await p.evaluate(()=>Object.values(okrEventos).filter(e=>e.cadencia).length); t('criou os 14 do trimestre + 3 fixos = 17 itens', n1===17, n1);
   const pais=await p.evaluate(()=>{ const tat=Object.values(okrEventos).find(e=>/^cad_\d+q\d_tatico$/.test(e.id)); const cp=Object.values(okrEventos).find(e=>/_compras$/.test(e.id)); return {tat:_okrCalFilhos(tat.id).length, cp:_okrCalFilhos(cp.id).length, macro:tat.macro, st:tat.status, tipo:tat.tipo, rec:Object.values(okrEventos).filter(e=>e.rec).map(e=>e.rec.tipo).sort()}; });
   t('Plano Tático tem 7 filhos, Plano de Compras 4; macro PLAN, status a_fazer; recorrências semanal/quinzenal/mensal', pais.tat===7 && pais.cp===4 && pais.macro==='plan' && pais.st==='a_fazer' && pais.rec.join()==='mensal,quinzenal,semanal', pais);
   // idempotente
   await p.evaluate(()=>{ window.__cad=_okrCadenciaAbrir(); }); await p.waitForTimeout(300); await p.evaluate(()=>document.querySelector('div[style*="z-index: 9999"] button[data-i="0"]').click()); await p.waitForTimeout(800);
   t('aplicar de novo não duplica', (await p.evaluate(()=>Object.values(okrEventos).filter(e=>e.cadencia).length))===17, '');
   // filtro de macro + selos
   await p.evaluate(()=>{ _okrCalSetVista('mes'); _okrCalAgendaDias=400; _okrCalSetMacro('check'); }); await p.waitForTimeout(300);
   const itC=await p.evaluate(()=>_okrCalItens('2020-01-01','2030-12-31','').map(i=>i.ev&&i.ev.macro)); t('filtro CHECK só traz itens CHECK', itC.length>0 && itC.every(m=>m==='check'), itC.slice(0,5));
   await p.evaluate(()=>_okrCalSetMacro('')); 
   // detalhe do pai: progresso e filhos; marcar entregue
   const r=await p.evaluate(async()=>{ const tat=Object.values(okrEventos).find(e=>/_tatico$/.test(e.id)); const f=_okrCalFilhos(tat.id); await _okrEvStatus(f[0].id,'entregue'); await _okrEvStatus(f[1].id,'andamento'); const pr=_okrCalProgresso(okrEventos[tat.id]); openOkrEvento(tat.id, tat.data); return {pr, f0:okrEventos[f[0].id].status, por:okrEventos[f[0].id].statusPor&&okrEventos[f[0].id].statusPor.nome}; });
   await p.waitForTimeout(400);
   t('marcar filho entregue grava status + quem; pai mostra 1/7', r.f0==='entregue' && r.por==='Ana ADM' && r.pr.n===1 && r.pr.t===7, r);
   const det=await p.evaluate(()=>document.getElementById('okr-evd-body').innerText);
   t('detalhe do plano lista as entregas filhas com o andamento', /Entregas deste plano/i.test(det) && /1\/7/.test(det) && /Plano Comercial/.test(det) && /PLAN/.test(det), det.slice(0,300));
   // lembrete do servidor espelhado no cliente: entregue some do chip como feito
   const feito=await p.evaluate(()=>{ _okrCalSetVista('agenda'); const e=Object.values(okrEventos).find(x=>x.status==='entregue'); return _okrCalSelos(e,e.data); }); t('selo "Entregue" aparece', /Entregue/.test(feito), feito);
   t('sem erro de JS', errs.length===0, errs); await ctx.close(); }
 // ── formulário: entrega
 { const {ctx,p,errs}=await abrir(U('ana','Ana ADM'));
   await p.evaluate(()=>openOkrEventoEditor(null)); await p.waitForTimeout(300);
   await p.selectOption('#okr-ev-tipo','entrega'); await p.waitForTimeout(250);
   const f=await p.evaluate(()=>({status:!!document.getElementById('okr-ev-status'), pai:!!document.getElementById('okr-ev-pai'), macro:!!document.getElementById('okr-ev-macro'), dia:document.getElementById('okr-ev-dia').checked, recOculto:document.getElementById('okr-ev-rec').closest('[hidden]')!==null, resp:/Responsáveis/i.test(document.getElementById('okr-ev-body').innerText)}));
   t('tipo Entrega: mostra Situação, Faz parte de, Macro e Responsáveis; dia inteiro; repetição escondida', f.status&&f.pai&&f.macro&&f.dia&&f.recOculto&&f.resp, f);
   await p.fill('#okr-ev-titulo','Showroom de Compra — Inverno'); await p.fill('#okr-ev-data','2027-02-10'); await p.selectOption('#okr-ev-macro','do'); await p.selectOption('#okr-ev-convsel','raf'); await p.waitForTimeout(200);
   await p.evaluate(()=>saveOkrEvento()); await p.waitForTimeout(800);
   const ev=await p.evaluate(()=>Object.values(okrEventos).find(e=>/Showroom/.test(e.titulo)));
   t('salvou entrega: macro DO, status a_fazer, responsável, sem repetição', ev && ev.tipo==='entrega' && ev.macro==='do' && ev.status==='a_fazer' && ev.convidados.includes('raf') && ev.rec===null, ev);
   t('sem erro de JS (form)', errs.length===0, errs); await ctx.close(); }
 // ── responsável (não-ADM) muda a situação; outra pessoa não
 { const sd=seed(); const ts='2026-11-03T10:00:00.000Z'; sd.kanban.okr.calendario.eventos.x1={id:'x1',titulo:'Lançamento Inverno',tipo:'entrega',macro:'do',status:'a_fazer',data:'2027-03-01',diaInteiro:true,hi:'',hf:'',torre:'digital',areaIds:[],objetivoIds:[],tagIds:[],convidados:['raf'],lembrar:{vespera:true,dia:true},local:'',link:'',descricao:'',rec:null,excecoes:{},criadoPor:{uid:'ana',nome:'Ana ADM'},criadoEm:ts,atualizadoEm:ts};
   const r1=await abrir(U('raf','Rafa Resp'),1280,sd); const a=await r1.p.evaluate(async()=>{ const pode=_okrCalPodeStatus(okrEventos.x1); await _okrEvStatus('x1','entregue'); return {pode, st:okrEventos.x1.status}; });
   t('responsável (não editor) pode marcar a própria entrega', a.pode && a.st==='entregue', a); await r1.ctx.close();
   const r2=await abrir(U('zed','Zed Outro'),1280,seed.call(null)&&sd); const c=await r2.p.evaluate(async()=>{ const pode=_okrCalPodeStatus(okrEventos.x1); await _okrEvStatus('x1','andamento'); return {pode, st:okrEventos.x1.status}; });
   t('quem não é responsável nem editor não muda', c.pode===false && c.st!=='andamento', c); await r2.ctx.close(); }
 // ── celular: sem rolagem lateral
 { const {ctx,p}=await abrir(U('ana','Ana ADM'),390); await p.evaluate(()=>{ _okrCalSetVista('mes'); }); await p.evaluate(async()=>{ window.__c=_okrCadenciaAbrir(); }); await p.waitForTimeout(300); await p.evaluate(()=>document.querySelector('div[style*="z-index: 9999"] button[data-i="0"]').click()); await p.waitForTimeout(1000);
   const w=await p.evaluate(()=>({sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth})); t('390px: sem rolagem lateral com a cadência aplicada', w.sw<=w.cw+1, w);
   await p.evaluate(()=>{ _okrCalSetVista('agenda'); _okrCalAgendaDias=400; renderOkrCalendario(); }); await p.waitForTimeout(300);
   const w2=await p.evaluate(()=>({sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth})); t('390px: vista Agenda também sem rolagem lateral', w2.sw<=w2.cw+1, w2); await ctx.close(); }
 await b.close(); console.log(ok?'\nTUDO OK':'\nFALHOU'); process.exit(ok?0:1); })();
