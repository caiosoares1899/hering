const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const U=(uid,n)=>({uid,email:uid+'@ciahering.com.br',displayName:n,photoURL:'',providerData:[{providerId:'google.com'}]});
const mk=(id,t,o)=>({id,titulo:t,areaId:'geral',torre:'digital',trimestres:['2026-Q4'],responsaveis:['ana','bia'],tagIds:[],history:[],ordem:0,indicadores:[],progressoPct:0,...o});
const seed=()=>({kanban:{okr:{objetivos:{d1:mk('d1','Fidelidade',{tagIds:['t1','t2']}),d2:mk('d2','Checkout',{tagIds:['t1'],arquivado:true}),d3:mk('d3','NPS',{tagIds:['t2']})},
 tags:{t1:{label:'Peak Natal',colorIdx:1},t2:{label:'Tech',colorIdx:2},t3:{label:'Sem uso',colorIdx:3}}},
 usuarios:{ana:{uid:'ana',nome:'Ana ADM',email:'ana@ciahering.com.br',inscrito:true},bia:{uid:'bia',nome:'Bia PO',email:'bia@ciahering.com.br',inscrito:true,role:'po',gestorOkr:true}},config:{adm_emails:['ana@ciahering.com.br']}}});
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true; const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,300))); };
 const open=async(user,delay)=>{ const ctx=await b.newContext({viewport:{width:1280,height:800}}); await fake.install(ctx,seed()); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://localhost:8941/okr-dev.html?torre=digital'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),user); await p.waitForTimeout(1500); if(delay) await p.evaluate(d=>window.__setDelay&&window.__setDelay(d),delay); await p.evaluate(()=>{ window.uiConfirm=async()=>true; }); return {ctx,p,errs}; };
 const db=(p,path)=>p.evaluate(async x=>{ const s=await window._get(window._ref(window._db,x)); return s.exists()?s.val():null; },path);
 // ADM
 { const {ctx,p,errs}=await open(U('ana','Ana ADM'),300);
   const vis=await p.evaluate(()=>getComputedStyle(document.getElementById('okr-tags-btn')).display); t('⋯ Mais tem "🏷️ Gerenciar tags" pra quem cria Objetivo', vis!=='none', vis);
   await p.evaluate(()=>openOkrTagsMgr()); await p.waitForTimeout(200);
   const lista=await p.evaluate(()=>[...document.querySelectorAll('#okr-tags-body > div')].slice(1).map(d=>d.innerText.replace(/\s+/g,' ').trim()));
   console.log('   lista:',lista); t('lista mostra cada tag com quantos Objetivos usam (inclui arquivado)', lista.some(x=>/Peak Natal 2 Objetivos/.test(x))&&lista.some(x=>/Tech 2 Objetivos/.test(x))&&lista.some(x=>/Sem uso 0 Objetivos/.test(x)), lista);
   // duplo clique em apagar tag em uso
   await p.evaluate(()=>{ window.__n=0; const o=window._update; window._update=(r,v)=>{ window.__n++; return o(r,v); }; });
   await p.evaluate(()=>{ _okrTagApagar('t1'); _okrTagApagar('t1'); }); await p.waitForTimeout(1200);
   const n=await p.evaluate(()=>window.__n); t('duplo clique em 🗑 grava 1 vez só', n===1, n);
   const tags=await db(p,'kanban/okr/tags'), d1=await db(p,'kanban/okr/objetivos/d1'), d2=await db(p,'kanban/okr/objetivos/d2'), d3=await db(p,'kanban/okr/objetivos/d3');
   t('tag some do banco', !tags.t1 && tags.t2 && tags.t3, Object.keys(tags)); t('sai de todos os Objetivos que usavam (inclusive arquivado); os outros intactos', JSON.stringify(d1.tagIds)==='["t2"]' && !d2.tagIds && JSON.stringify(d3.tagIds)==='["t2"]', [d1.tagIds,d2.tagIds,d3.tagIds]);
   t('cada Objetivo afetado ganha 1 linha no histórico', d1.history.length===1 && /removeu a tag "Peak Natal"/.test(d1.history[0].what) && d2.history.length===1 && d3.history.length===0, [d1.history,d2.history]);
   const lista2=await p.evaluate(()=>[...document.querySelectorAll('#okr-tags-body > div')].slice(1).length); t('lista do gerenciador atualiza (2 tags)', lista2===2, lista2);
   // criar sem aplicar
   await p.evaluate(()=>{ window.__draftAntes=!!_okrObjDraft; _okrTagFormOpen(null); }); await p.fill('#okr-tag-nome','Nova do gerenciador'); const rot=await p.evaluate(()=>document.getElementById('okr-tag-ok').textContent); await p.evaluate(()=>_okrTagFormSalvar()); await p.waitForTimeout(700);
   const tg=await db(p,'kanban/okr/tags'); t('"+ Nova tag" do gerenciador cria a tag (botão "Criar tag") sem aplicar em Objetivo e sem erro', rot==='Criar tag' && Object.values(tg).some(x=>x.label==='Nova do gerenciador'), [rot,Object.values(tg).map(x=>x.label)]);
   // Esc em camadas: editor por cima do gerenciador
   await p.evaluate(()=>_okrTagFormOpen('t2')); await p.waitForTimeout(100); const delVis=await p.evaluate(()=>document.getElementById('okr-tag-del').style.display); t('editar tag mostra "🗑 Apagar tag"', delVis==='', delVis);
   await p.keyboard.press('Escape'); await p.waitForTimeout(100); const st=await p.evaluate(()=>({form:document.getElementById('okr-tag-ov').classList.contains('open'),mgr:document.getElementById('okr-tags-ov').classList.contains('open')})); t('Esc fecha só o editor (gerenciador continua)', !st.form&&st.mgr, st);
   await p.keyboard.press('Escape'); await p.waitForTimeout(100); t('Esc seguinte fecha o gerenciador', !(await p.evaluate(()=>document.getElementById('okr-tags-ov').classList.contains('open'))),'');
   t('ADM sem erro de JS', !errs.length, errs); await ctx.close(); }
 // pelo editor dentro do ⚙ Configurações do Objetivo
 { const {ctx,p,errs}=await open(U('ana','Ana ADM'));
   await p.evaluate(()=>{ openOkrObjetivo('d1'); }); await p.waitForTimeout(400); await p.evaluate(()=>openOkrConfig()); await p.waitForTimeout(300);
   await p.evaluate(()=>_okrTagFormOpen('t2')); await p.waitForTimeout(150);
   const rot=await p.evaluate(()=>document.getElementById('okr-tag-ok').textContent); await p.evaluate(()=>_okrTagApagar('t2')); await p.waitForTimeout(800);
   const r=await p.evaluate(()=>({form:document.getElementById('okr-tag-ov').classList.contains('open'), draft:(_okrObjDraft.tagIds||[]), chips:document.querySelectorAll('#okr-obj-config-ov .okr-tag-chip').length, dirty:(typeof _okrSnapshotMudou==='function'?_okrSnapshotMudou():null)}));
   console.log('   config:',JSON.stringify(r)); t('apagar pelo editor (dentro do Objetivo): fecha o editor, tira a chip do rascunho e NÃO marca "alterações não salvas" à toa', !r.form && !r.draft.includes('t2') && r.dirty!==true, r);
   t('config sem erro de JS', !errs.length, errs); await ctx.close(); }
 // PO (não ADM): tag em uso trava, sem uso apaga
 { const {ctx,p,errs}=await open(U('bia','Bia PO'));
   await p.evaluate(()=>openOkrTagsMgr()); await p.waitForTimeout(200);
   const dis=await p.evaluate(()=>[...document.querySelectorAll('#okr-tags-body button[title*="Apagar"],#okr-tags-body button[title*="só ADM"]')].map(b=>({d:b.disabled,t:b.title})));
   console.log('   botões 🗑 do PO:',JSON.stringify(dis)); t('PO: 🗑 desabilitado nas tags em uso e habilitado na sem uso', dis.filter(x=>x.d).length===2 && dis.filter(x=>!x.d).length===1, dis);
   await p.evaluate(()=>{ _okrTagApagar('t1'); }); await p.waitForTimeout(500); t('PO tentando apagar tag em uso é barrado (nada muda)', !!(await db(p,'kanban/okr/tags')).t1, '');
   await p.evaluate(()=>{ _okrTagApagar('t3'); }); await p.waitForTimeout(700); t('PO apaga a tag sem uso', !(await db(p,'kanban/okr/tags')).t3, '');
   t('PO sem erro de JS', !errs.length, errs); await ctx.close(); }
 await b.close(); console.log(ok?'TUDO OK':'HÁ FALHAS'); })();
