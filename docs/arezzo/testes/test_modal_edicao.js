const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const BASE=process.env.BASE||'http://localhost:8941/okr-dev.html';
let falhas=0; const ok=(n,c,d)=>{ if(!c) falhas++; console.log(c?'✅':'❌',n,c?'':(d===undefined?'':String(d).slice(0,400))); };
const obj=(id,extra)=>({id,titulo:'Obj '+id,areaId:'geral',trimestres:['2026-Q4'],pilar:'',descricao:'d',responsaveis:[],indicadores:['i'],progressos:[],proximosPassos:[],riscos:[],planosAcao:[],tagIds:[],cardLinks:[],history:[],torre:'digital',ordem:0,...extra});
const seed=()=>({kanban:{okr:{objetivos:{o1:obj('o1'),o2:obj('o2')},marcos:{m1:{id:'m1',objetivoId:'o1',nome:'Marco A',responsavel:'',prazo:'2026-12-01',progresso:'em_andamento',descricao:'',checklist:[{text:'x',done:false}],tags:[],participantes:[],history:[]}},snapshots:{},tags:{}},usuarios:{ana:{uid:'ana',nome:'Ana ADM',email:'ana@ciahering.com.br',inscrito:true}},config:{adm_emails:['ana@ciahering.com.br']}}});
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 async function open(){ const ctx=await b.newContext({viewport:{width:1280,height:900}}); await fake.install(ctx,seed()); const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(e.message));
   await page.goto(BASE+'?torre=digital'); await page.waitForFunction(()=>!!window.__authCb); await page.evaluate(()=>window.__authCb({uid:'ana',email:'ana@ciahering.com.br',displayName:'Ana ADM',photoURL:'',providerData:[{providerId:'google.com'}]})); await page.waitForTimeout(1400);
   await page.evaluate(()=>{ window.__conf=[]; window.__resp=false; window.uiConfirm=async(m)=>{ window.__conf.push(m); return window.__resp; }; window.__t=[]; const t=showToast; window.showToast=m=>{window.__t.push(m); t(m);}; });
   return {ctx,page,errs}; }
 const store=p=>p.evaluate(()=>JSON.parse(JSON.stringify(window.__store.kanban.okr)));
 const st=p=>p.evaluate(()=>({obj:document.getElementById('okr-obj-ov').classList.contains('open'),cfg:document.getElementById('okr-obj-config-ov').classList.contains('open'),marco:document.getElementById('okr-marco-ov').classList.contains('open')}));
 // 1) duplo clique
 { const {ctx,page,errs}=await open(); await page.evaluate(()=>{ window.__setDelay=p=>/okr\/(objetivos|marcos)\//.test(p)?300:0; });
   await page.evaluate(()=>openOkrObjetivo(null)); await page.waitForTimeout(200); await page.evaluate(()=>{ document.getElementById('okr-f-titulo').value='Novo X'; saveOkrObjetivo(); saveOkrObjetivo(); });
   const dis=await page.evaluate(()=>[...document.querySelectorAll('#okr-obj-config-footer .save-btn')].every(b=>b.disabled)); await page.waitForTimeout(1200);
   let s=await store(page); ok('1a. duplo clique em 💾 Salvar de Objetivo NOVO cria 1 só', Object.values(s.objetivos).filter(o=>o.titulo==='Novo X').length===1);
   ok('1b. o botão fica desabilitado enquanto grava', dis);
   await page.evaluate(()=>openOkrObjetivo('o1')); await page.waitForTimeout(300); await page.evaluate(()=>{ _okrObjDraft.indicadores=['i','j']; saveOkrObjetivo(); saveOkrObjetivo(); }); await page.waitForTimeout(1200);
   s=await store(page); ok('1c. duplo clique em Salvar de Objetivo existente grava 1 linha de histórico', (s.objetivos.o1.history||[]).length===1, JSON.stringify(s.objetivos.o1.history));
   await page.evaluate(()=>openOkrMarco(null,'o1')); await page.waitForTimeout(200); await page.evaluate(()=>{ document.getElementById('okr-m-nome').value='Marco Novo'; saveOkrMarco(); saveOkrMarco(); }); await page.waitForTimeout(1500);
   s=await store(page); ok('1d. duplo clique em Salvar de Marco NOVO cria 1 só', Object.values(s.marcos).filter(m=>m.nome==='Marco Novo').length===1);
   ok('1e. e o histórico do Objetivo recebe 1 linha só desse Marco', (s.objetivos.o1.history||[]).filter(h=>/Marco Novo/.test(h.what)).length===1, JSON.stringify(s.objetivos.o1.history));
   ok('1f. sem erros de JS', errs.length===0, errs.join('|')); await ctx.close(); }
 // 2) apagado por outra pessoa
 { const {ctx,page}=await open(); await page.evaluate(()=>openOkrObjetivo('o2')); await page.waitForTimeout(300); await page.evaluate(()=>window._remove(window._ref(window._db,'kanban/okr/objetivos/o2'))); await page.waitForTimeout(300);
   await page.evaluate(()=>saveOkrObjetivo()); await page.waitForTimeout(400); let s=await store(page);
   ok('2a. salvar Objetivo apagado por outra pessoa não o ressuscita (e avisa)', !s.objetivos.o2 && (await page.evaluate(()=>window.__t)).some(t=>/excluído por outra pessoa/.test(t)));
   await page.evaluate(()=>{ closeOkrObjetivo(); openOkrMarco('m1','o1'); }); await page.waitForTimeout(300); await page.evaluate(()=>window._remove(window._ref(window._db,'kanban/okr/marcos/m1'))); await page.waitForTimeout(300);
   await page.evaluate(()=>saveOkrMarco()); await page.waitForTimeout(400); s=await store(page);
   ok('2b. salvar Marco apagado por outra pessoa não o ressuscita (e avisa)', !(s.marcos&&s.marcos.m1)); 
   await page.evaluate(()=>{ closeOkrMarco(); closeOkrObjetivo(); openOkrMarco(null,'o2'); }); await page.waitForTimeout(300); await page.evaluate(()=>{ document.getElementById('okr-m-nome').value='Órfão'; saveOkrMarco(); }); await page.waitForTimeout(400); s=await store(page);
   ok('2c. Marco NOVO sob Objetivo apagado não vira órfão', !Object.values(s.marcos||{}).some(m=>m.nome==='Órfão')); await ctx.close(); }
 // 3) falha de gravação
 { const {ctx,page}=await open(); await page.evaluate(()=>openOkrObjetivo('o1')); await page.waitForTimeout(300); await page.evaluate(()=>{ window.__denySet=p=>/okr\/objetivos\//.test(p); _okrObjDraft.indicadores=['i','novo']; });
   await page.evaluate(()=>{ saveOkrObjetivo(); }); await page.waitForTimeout(500);
   let r=await page.evaluate(()=>({t:window.__t, hist:(_okrObjDraft.history||[]).length, btn:[...document.querySelectorAll('#okr-obj-footer .save-btn')].map(b=>b.disabled), aberto:document.getElementById('okr-obj-ov').classList.contains('open')}));
   ok('3a. gravação negada: avisa, mantém o modal aberto, reabilita o botão', r.t.some(x=>/Não consegui salvar/.test(x)) && r.aberto && r.btn.every(d=>!d), JSON.stringify(r));
   await page.evaluate(()=>{ window.__denySet=null; saveOkrObjetivo(); }); await page.waitForTimeout(500); r=await page.evaluate(()=>(_okrObjDraft?_okrObjDraft.history:(window.__store.kanban.okr.objetivos.o1.history)||[]).length);
   ok('3b. tentar de novo depois da falha grava e não duplica a linha do histórico', r===1, r); await ctx.close(); }
 // 4) falso "alterações não salvas" + o aviso verdadeiro continua
 { const {ctx,page}=await open(); const fecha=async(js)=>{ await page.evaluate(()=>{window.__conf.length=0;}); await page.evaluate(js); await page.waitForTimeout(250); return page.evaluate(()=>window.__conf.slice()); };
   await page.evaluate(()=>{ openOkrMarco('m1','o1'); }); await page.waitForTimeout(250); let c=await fecha("void _okrTryCloseMarco()");
   ok('4a. abrir e fechar um Marco antigo (sem 🎬) NÃO acusa alteração', c.length===0, c[0]);
   await page.evaluate(()=>{ openOkrMarco('m1','o1'); document.getElementById('okr-m-nome').value='Outro nome'; }); c=await fecha("void _okrTryCloseMarco()");
   ok('4b. mexer de verdade no nome do Marco AINDA pergunta', c.length===1, c.length);
   await page.evaluate(()=>{ window.__resp=true; }); await fecha("void _okrTryCloseMarco()"); await page.evaluate(()=>{ window.__resp=false; });
   await page.evaluate(()=>{ openOkrMarco('m1','o1'); document.getElementById('okr-m-mostrar-apresentacao').checked=false; }); c=await fecha("void _okrTryCloseMarco()");
   ok('4c. desmarcar "🎬 Aparecer na apresentação" do Marco AINDA pergunta', c.length===1);
   await page.evaluate(()=>{ window.__resp=true; }); await fecha("void _okrTryCloseMarco()"); await page.evaluate(()=>{ window.__resp=false; });
   await page.evaluate(()=>{ openOkrObjetivo('o1'); openOkrConfig(); }); await page.waitForTimeout(250); c=await fecha("void _okrTryCloseObjetivo()");
   ok('4d. abrir ⚙ Configurações e fechar, sem mexer, NÃO acusa alteração', c.length===0, c[0]);
   await page.evaluate(()=>{ openOkrObjetivo('o1'); openOkrConfig(); document.getElementById('okr-f-titulo').value='Título novo'; }); c=await fecha("void _okrTryCloseObjetivo()");
   ok('4e. mudar o título na ⚙ Configurações AINDA pergunta', c.length===1);
   await page.evaluate(()=>{ window.__resp=true; }); await fecha("void _okrTryCloseObjetivo()"); await page.evaluate(()=>{ window.__resp=false; });
   await page.evaluate(()=>{ openOkrObjetivo('o1'); openOkrConfig(); document.getElementById('okr-f-mostrar-apresentacao').checked=false; }); c=await fecha("void _okrTryCloseObjetivo()");
   ok('4f. desmarcar "🎬 Aparecer na apresentação" do Objetivo AINDA pergunta', c.length===1);
   await ctx.close(); }
 // 5) Esc
 { const {ctx,page}=await open();
   await page.evaluate(()=>openOkrObjetivo('o1')); await page.waitForTimeout(250); await page.keyboard.press('Escape'); await page.waitForTimeout(250);
   ok('5a. Esc fecha o modal do Objetivo (sem mudança, sem pergunta)', !(await st(page)).obj && (await page.evaluate(()=>window.__conf.length))===0);
   await page.evaluate(()=>{ openOkrObjetivo('o1'); openOkrConfig(); }); await page.waitForTimeout(250); await page.keyboard.press('Escape'); await page.waitForTimeout(250);
   ok('5b. Esc fecha também a tela ⚙ Configurações', (s=>!s.obj&&!s.cfg)(await st(page)));
   await page.evaluate(()=>{ openOkrObjetivo('o1'); }); await page.waitForTimeout(250); await page.evaluate(()=>{ _okrObjDraft.indicadores=['i','mudou']; }); await page.keyboard.press('Escape'); await page.waitForTimeout(250);
   ok('5c. com alteração, o Esc PERGUNTA e (recusando) o modal continua aberto', (await page.evaluate(()=>window.__conf.length))===1 && (await st(page)).obj);
   await page.evaluate(()=>{ closeOkrObjetivo(); openOkrObjetivo('o1'); }); await page.waitForTimeout(250);
   await page.evaluate(()=>{ _okrListEditStart(document.querySelector('#okr-sec-obj-indicadores .okr-list-item span'),'indicadores',0); }); await page.waitForTimeout(150); await page.keyboard.press('Escape'); await page.waitForTimeout(250);
   ok('5d. Esc dentro da edição de um item cancela só a edição (o modal NÃO fecha)', (await st(page)).obj);
   await page.evaluate(()=>{ closeOkrObjetivo(); openOkrMarco('m1','o1'); }); await page.waitForTimeout(250); await page.keyboard.press('Escape'); await page.waitForTimeout(250);
   ok('5e. Esc fecha o Marco e volta pro Objetivo', (s=>s.obj&&!s.marco)(await st(page)));
   await ctx.close(); }
 // 6) o que chega assíncrono não apaga o que foi digitado
 { const {ctx,page}=await open(); await page.evaluate(()=>{ const g=window._get; window._get=(r)=>/marco_comments/.test(r.p)? new Promise(res=>setTimeout(()=>res(g(r)),700)) : g(r); });
   await page.evaluate(()=>openOkrMarco('m1','o1')); await page.waitForTimeout(150);
   await page.evaluate(()=>{ document.getElementById('okr-m-nome').value='Nome digitado'; document.getElementById('okr-m-descricao').value='Descrição digitada'; document.getElementById('okr-m-prazo').value='2027-01-15'; }); await page.waitForTimeout(1200);
   let v=await page.evaluate(()=>({n:document.getElementById('okr-m-nome').value,d:document.getElementById('okr-m-descricao').value,p:document.getElementById('okr-m-prazo').value}));
   ok('6a. comentários do Marco chegando depois NÃO apagam nome/descrição/prazo já digitados', v.n==='Nome digitado'&&v.d==='Descrição digitada'&&v.p==='2027-01-15', JSON.stringify(v));
   await page.evaluate(()=>{ closeOkrMarco(); openOkrObjetivo('o1'); openOkrConfig(); }); await page.waitForTimeout(250);
   await page.evaluate(()=>{ document.getElementById('okr-f-titulo').value='Título em edição'; document.getElementById('okr-f-pilar').value='Pilar em edição'; });
   await page.evaluate(()=>window._set(window._ref(window._db,'kanban/okr/tags/t2'),{label:'T2',cor:'#0af'})); await page.waitForTimeout(400);
   v=await page.evaluate(()=>({t:document.getElementById('okr-f-titulo').value,p:document.getElementById('okr-f-pilar').value}));
   ok('6b. outra pessoa criar uma tag NÃO apaga título/pilar digitados na ⚙ Configurações', v.t==='Título em edição'&&v.p==='Pilar em edição', JSON.stringify(v));
   await page.evaluate(()=>{ document.getElementById('okr-f-titulo').value='Título 2'; });
   await page.evaluate(()=>window._set(window._ref(window._db,'kanban/okr/gerencias'),{digital:{g9:{label:'Nova',icon:'🧪',ordem:9}}})); await page.waitForTimeout(400);
   ok('6c. outra pessoa mexer nas gerências NÃO apaga o título digitado', (await page.evaluate(()=>document.getElementById('okr-f-titulo').value))==='Título 2');
   await ctx.close(); }
 await b.close(); console.log(falhas?('FALHAS: '+falhas):'TUDO OK'); process.exit(falhas?1:0); })();
