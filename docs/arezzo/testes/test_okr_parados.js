// 🧊 Objetivo parado (okr-dev): selo no cartão + chip/filtro "🧊 Parados" (14 dias sem nenhuma atividade).
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const U=(uid,n)=>({uid,email:uid+'@ciahering.com.br',displayName:n,photoURL:'',providerData:[{providerId:'google.com'}]});
const dAtras=n=>new Date(Date.now()-n*86400000-3600000).toISOString();   // "n dias e 1 h atrás": nunca cai na fronteira do dia
const mk=(id,t,o)=>({id,titulo:t,areaId:'geral',torre:'digital',trimestres:['2026-Q4'],responsaveis:['ana'],tagIds:[],history:[],ordem:0,indicadores:[],progressoPct:0,...o});
const mc=(id,obj,o)=>({id,objetivoId:obj,nome:'Marco '+id,progresso:'em_andamento',...o});
const seed=()=>({kanban:{okr:{objetivos:{
  p1:mk('p1','Parado 20 dias',{atualizadoEm:dAtras(20),ordem:0}),
  p2:mk('p2','Marco mexido ontem',{atualizadoEm:dAtras(20),ordem:1}),
  p3:mk('p3','Histórico recente',{atualizadoEm:dAtras(20),ordem:2,history:[{who:'Ana',what:'atualizou o marco "X"',tipo:'marco',at:dAtras(3)}]}),
  p4:mk('p4','So visibilidade na apresentacao',{atualizadoEm:dAtras(20),ordem:3,history:[{who:'Ana',what:'deixou de aparecer na apresentação',tipo:'campo',at:dAtras(1)}]}),
  p5:mk('p5','Atingimento lancado ontem (valor retroativo)',{atualizadoEm:dAtras(20),ordem:4,atingimento:{tipo:'numero',inicial:0,meta:100,lancamentos:[{id:'l1',em:'2026-08-01',valor:10,criadoEm:dAtras(1)}]}}),
  p6:mk('p6','Perene',{atualizadoEm:dAtras(30),ordem:5,atingimento:{tipo:'perene'}}),
  p7:mk('p7','Manter acima',{atualizadoEm:dAtras(30),ordem:6,atingimento:{tipo:'acima',inicial:0,meta:50,lancamentos:[{id:'l1',em:'2026-08-01',valor:60,criadoEm:dAtras(30)}]}}),
  p8:mk('p8','Arquivado velho',{atualizadoEm:dAtras(30),ordem:7,arquivado:true}),
  p9:mk('p9','Concluido',{atualizadoEm:dAtras(30),ordem:8}),
  p10:mk('p10','Meta batida (>=100%)',{atualizadoEm:dAtras(30),ordem:9,atingimento:{tipo:'numero',inicial:0,meta:10,lancamentos:[{id:'l1',em:'2026-08-01',valor:12,criadoEm:dAtras(30)}]}}),
  p11:mk('p11','13 dias',{atualizadoEm:dAtras(13),ordem:10}),
  p12:mk('p12','14 dias',{atualizadoEm:dAtras(14),ordem:11}),
  p13:mk('p13','Sem nenhuma data',{ordem:12}),
  p14:mk('p14','Marco arquivado mexido ontem',{atualizadoEm:dAtras(20),ordem:13}),
 },
 marcos:{ m2:mc('m2','p2',{atualizadoEm:dAtras(2)}), m9:mc('m9','p9',{progresso:'concluido',atualizadoEm:dAtras(30)}), m14:mc('m14','p14',{arquivado:true,atualizadoEm:dAtras(1)}) },
 tags:{}},
 usuarios:{ana:{uid:'ana',nome:'Ana ADM',email:'ana@ciahering.com.br',inscrito:true}},config:{adm_emails:['ana@ciahering.com.br']}}});
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true;
 const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,300))); };
 const open=async(user,vp,theme)=>{ const ctx=await b.newContext({viewport:vp||{width:1280,height:800}}); await fake.install(ctx,seed()); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
   await p.goto('http://localhost:8941/okr-dev.html?torre=digital'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),user); await p.waitForTimeout(1500);
   if(theme) await p.evaluate(th=>{ document.documentElement.setAttribute('data-theme',th); },theme); return {ctx,p,errs}; };
 const dias=p=>p.evaluate(()=>Object.fromEntries(Object.keys(okrObjetivos).map(id=>[id,_okrObjParadoDias(okrObjetivos[id])])));
 const titulosNaTela=p=>p.evaluate(()=>[...document.querySelectorAll('#okr-objetivos-wrap .okr-card-title')].map(e=>e.textContent));
 { const {ctx,p,errs}=await open(U('ana','Ana ADM'));
   const d=await dias(p); console.log('   dias:',JSON.stringify(d));
   t('p1 parado há 20 dias', d.p1===20, d.p1);
   t('p2: Marco mexido há 2 dias → não parado', d.p2===null, d.p2);
   t('p3: entrada recente no Histórico → não parado', d.p3===null, d.p3);
   t('p4: só mexer na visibilidade da apresentação NÃO conta (continua parado)', d.p4===20, d.p4);
   t('p5: registro de atingimento lançado ontem (mesmo com valor retroativo) → não parado', d.p5===null, d.p5);
   t('p6/p7: Perene e Manter acima ficam fora', d.p6===null && d.p7===null, [d.p6,d.p7]);
   t('p8: arquivado fora', d.p8===null, d.p8);
   t('p9: concluído (todos os Marcos feitos) fora', d.p9===null, d.p9);
   t('p10: meta batida (≥ 100 %) fora', d.p10===null, d.p10);
   t('limite: 13 dias não, 14 dias sim', d.p11===null && d.p12===14, [d.p11,d.p12]);
   t('p13: sem nenhuma data não marca', d.p13===null, d.p13);
   t('p14: Marco arquivado mexido ontem também conta como atividade', d.p14===null, d.p14);
   // selo no cartão
   const selos=await p.evaluate(()=>[...document.querySelectorAll('.okr-card')].filter(c=>c.querySelector('.okr-parado-badge')).map(c=>c.querySelector('.okr-card-title').textContent+' | '+c.querySelector('.okr-parado-badge').textContent.trim()));
   console.log('   selos:',JSON.stringify(selos)); t('selo 🧊 só nos parados (p1, p4, p12) com os dias', selos.length===3 && selos.some(s=>/^Parado 20 dias \| 🧊 20d sem atualização$/.test(s)) && selos.some(s=>/^14 dias \| 🧊 14d/.test(s)), selos);
   // chip
   const chip=await p.evaluate(()=>{ const c=document.querySelector('.okr-stat-parado'); return c?{txt:c.innerText.replace(/\s+/g,' ').trim(),pressed:c.getAttribute('aria-pressed')}:null; });
   t('chip "🧊 3 parados" na faixa de resumo', chip && /🧊 3 parados/.test(chip.txt) && chip.pressed==='false', chip);
   // filtrar
   const antes=(await titulosNaTela(p)).length;
   await p.click('.okr-stat-parado'); await p.waitForTimeout(200);
   const f=await titulosNaTela(p); t('clicar no chip filtra: só os 3 parados', f.length===3 && f.includes('Parado 20 dias') && f.includes('14 dias') && f.includes('So visibilidade na apresentacao'), [antes,f]);
   const chip2=await p.evaluate(()=>{ const c=document.querySelector('.okr-stat-parado'); return {act:c.classList.contains('active'),pressed:c.getAttribute('aria-pressed')}; });
   t('chip fica ativo (aria-pressed=true)', chip2.act && chip2.pressed==='true', chip2);
   // combina com o filtro de status (o resumo continua contando os parados)
   const msg=await p.evaluate(()=>_okrTemFiltroAtivo()); t('conta como filtro ativo (some o reordenar e o "Limpar filtros" funciona)', msg===true, msg);
   const semReordenar=await p.evaluate(()=>document.querySelectorAll('#okr-objetivos-wrap [title="Mover pra cima"]').length); t('com o filtro ligado não aparece o ▲/▼ de reordenar', semReordenar===0, semReordenar);
   // teclado
   await p.focus('.okr-stat-parado'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
   t('Enter no chip desliga o filtro', (await titulosNaTela(p)).length===antes, (await titulosNaTela(p)).length);
   await p.click('.okr-stat-parado'); await p.waitForTimeout(100); await p.evaluate(()=>_okrClearFilters()); await p.waitForTimeout(200);
   t('"Limpar filtros" tira o filtro de parados', (await titulosNaTela(p)).length===antes && !(await p.evaluate(()=>_okrFilter.parado)), '');
   // reordenar não esquenta
   await p.evaluate(()=>_okrObjMover('geral','p1',1)); await p.waitForTimeout(400);
   const d2=await dias(p); const bd=await p.evaluate(async()=>{ const s=await window._get(window._ref(window._db,'kanban/okr/objetivos/p1')); return s.val(); });
   t('reordenar não tira o 🧊 (só grava `ordem`, sem histórico nem atualizadoEm novo)', d2.p1===20 && (bd.history||[]).length===0 && Date.now()-Date.parse(bd.atualizadoEm)>19*86400000, [d2.p1,bd.ordem,bd.atualizadoEm]);
   // editar de verdade esquenta: registrar atingimento via histórico
   await p.evaluate(()=>{ const o=okrObjetivos.p1; o.history=[...(o.history||[]),{who:'Ana',what:'atualizou a descrição',tipo:'campo',at:new Date().toISOString()}]; renderOkrObjetivos(); });
   t('uma edição nova tira o selo', (await dias(p)).p1===null, '');
   t('sem erro de JS', !errs.length, errs); await ctx.close(); }
 // celular + 3 temas: chip e selo legíveis, sem rolagem lateral
 for(const th of ['dark','light','vice']){ const {ctx,p,errs}=await open(U('ana','Ana ADM'),{width:390,height:800},th); await p.waitForTimeout(300);
   const r=await p.evaluate(()=>{ const c=document.querySelector('.okr-stat-parado'), s=document.querySelector('.okr-parado-badge'); const cs=x=>getComputedStyle(x); return {chipCor:cs(c).color, seloCor:cs(s).color, seloBg:cs(s).backgroundColor, fundo:cs(document.body).backgroundColor, rolagem:document.documentElement.scrollWidth>innerWidth+1}; });
   console.log('   tema',th,JSON.stringify(r)); t('tema '+th+' (390 px): chip e selo renderizam, sem rolagem lateral, sem erro', r.seloCor && !r.rolagem && !errs.length, [r,errs]);
   if(process.env.PRINTS) await p.screenshot({path:'/tmp/claude-0/-home-user-hering/6d9105d6-b81e-55b1-b178-9c90fb7df259/scratchpad/parados_'+th+'.png'});
   await ctx.close(); }
 await b.close(); console.log(ok?'TUDO OK':'HÁ FALHAS'); })();
