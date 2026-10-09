// 💡 Dicas (mini popups) — mare-dicas(-dev).js em Radar (okr-dev), Maré (kanban-dev) e Oceano (oceano-dev). SUFIXO=-dev (padrão) ou '' pra testar a prod.
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const SUF = process.env.SUFIXO===undefined ? '-dev' : process.env.SUFIXO;
const U=(uid,n,email)=>({uid,email:email||uid+'@ciahering.com.br',displayName:n,photoURL:'',providerData:[{providerId:'google.com'}]});
const mk=(id,t,o)=>({id,titulo:t,areaId:'geral',trimestres:['2026-Q4'],responsaveis:['ana'],tagIds:[],history:[],indicadores:[],progressos:[],proximosPassos:[],riscos:[],planosAcao:[],descricao:'',torre:'digital',...o});
const base=(extra)=>({kanban:Object.assign({okr:{objetivos:{d1:mk('d1','Fidelidade',{ordem:0}),d2:mk('d2','Checkout',{ordem:1})},marcos:{},tags:{},reuniao_notas:{},snapshots:{}},
  usuarios:{ana:{uid:'ana',nome:'Ana ADM',email:'ana@ciahering.com.br',inscrito:true,init:'AA',role:'adm',squads:{dev:true}}},usuarios_publicos:{ana:{uid:'ana',nome:'Ana ADM',init:'AA'}},config:{adm_emails:['ana@ciahering.com.br']},
  squads_meta:{dev:{label:'Dev',emoji:'💻',color:'#1de9b6'}}},extra||{})});
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true; const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,300))); };
 const abrir=async(page,seedX,w,h,qs)=>{ const ctx=await b.newContext({viewport:{width:w||1280,height:h||800}}); await fake.install(ctx,seedX||base()); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
   await p.goto('http://localhost:8941/'+page+SUF+'.html'+(qs||'')); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U('ana','Ana ADM')); await p.waitForTimeout(1800); return {ctx,p,errs}; };
 const dica=p=>p.evaluate(()=>{ const e=document.getElementById('mare-dica'); return e?{t:e.querySelector('.mdica-t').textContent, mais:!!e.querySelector('[data-a=mais]'), titulo:e.querySelector('.mdica-h b').textContent}:null; });
 const estado=p=>p.evaluate(()=>window.MareDicas._estado());

 // ── RADAR ──
 { const {ctx,p,errs}=await abrir('okr'); await p.evaluate(()=>_okrEntrarTorre('digital')); await p.waitForTimeout(500);
   t('Radar: nenhuma dica antes da hora (nada aparece nos primeiros segundos)', (await dica(p))===null, await dica(p));
   await p.waitForTimeout(6500);
   let d=await dica(p); t('Radar: dica de entrada aparece sozinha, com título "Dica do Radar", texto curto e "Saiba mais"', d && /Radar/.test(d.titulo) && d.t.length<140 && d.mais, d);
   const primeira=d&&d.t;
   const pos=await p.evaluate(()=>{ const r=document.getElementById('mare-dica').getBoundingClientRect(); return {l:r.left,b:innerHeight-r.bottom,w:r.width}; }); t('Radar: canto inferior esquerdo, sem cobrir o botão do Agente (direita)', pos.l<30 && pos.b<30 && pos.w<=340, pos);
   t('Radar: a dica já conta como vista (não volta na próxima visita)', (await estado(p)).vistas.semaforo===true, await estado(p));
   await p.evaluate(()=>MareDicas.gatilho('view:historico')); await p.waitForTimeout(2200);
   t('Radar: 2ª dica NÃO empilha enquanto a 1ª está na tela (1 por vez)', (await dica(p)).t===primeira, await dica(p));
   await p.click('#mare-dica [data-a=mais]'); await p.waitForTimeout(500);
   t('Radar: "Saiba mais" fecha a dica e abre o tópico da Ajuda', (await dica(p))===null && await p.evaluate(()=>document.getElementById('okr-help-ov').classList.contains('open') && !document.getElementById('hlp-marcos').closest('[hidden]')), 'ajuda');
   t('Radar: a Ajuda tem o interruptor 💡 Dicas ligado', await p.evaluate(()=>{ const c=document.querySelector('#okr-help-dicas input'); return !!c && c.checked; }), 'sem controle');
   await p.evaluate(()=>closeOkrHelp()); t('Radar: sem erro de JS', !errs.length, errs); await ctx.close(); }

 // gatilhos por lugar, espaçamento e desligar (Radar) — sem esperar o intervalo real: zera o relógio interno via estado
 { const {ctx,p,errs}=await abrir('okr'); await p.evaluate(()=>_okrEntrarTorre('digital')); await p.waitForTimeout(1500);
   await p.evaluate(()=>_okrSetView('historico')); await p.waitForTimeout(2300);
   let d=await dica(p); t('Radar: ao abrir o Dashboard aparece a dica do Dashboard (filtrar a tabela)', d && /situação|filtrar/i.test(d.t), d);
   await p.click('#mare-dica [data-a=ok]'); t('Radar: "Entendi" fecha', (await dica(p))===null, 'aberta');
   await p.evaluate(()=>_okrSetView('calendario')); await p.waitForTimeout(2300);
   t('Radar: 2ª dica só depois do intervalo mínimo (não bombardeia)', (await dica(p))===null, await dica(p));
   await p.evaluate(()=>_okrSetView('historico')); await p.evaluate(()=>MareDicas.reiniciar()); await p.waitForTimeout(300);
   await p.evaluate(()=>{ MareDicas.definir(false); }); await p.evaluate(()=>MareDicas.gatilho('boot')); await p.waitForTimeout(2300);
   t('Radar: com as dicas desligadas nada aparece', (await dica(p))===null && !(await estado(p)).ativas, await estado(p));
   const fb=await p.evaluate(()=>window._get(window._ref(window._db,'kanban/usuarios/ana/dicas')).then(s=>s.val()));
   t('Radar: desligar grava no perfil da pessoa (kanban/usuarios/{uid}/dicas/off/radar) e só no Radar', fb && fb.off && fb.off.radar===true && !fb.off.mare && !fb.off.oceano, fb);
   await p.evaluate(()=>{ MareDicas.definir(true); }); await p.evaluate(()=>MareDicas.gatilho('boot')); await p.waitForTimeout(2300);
   t('Radar: religar volta a mostrar', (await dica(p))!==null, await dica(p));
   await p.click('#mare-dica [data-a=off]'); await p.waitForTimeout(300);
   t('Radar: "Não mostrar dicas do Radar" desliga na hora e avisa onde religar', !(await estado(p)).ativas && await p.evaluate(()=>/Ajuda/.test(document.getElementById('mare-dica').textContent)), await estado(p));
   t('Radar: sem erro de JS', !errs.length, errs); await ctx.close(); }

 // preferência já salva no Firebase: dicas vistas/desligadas valem em outro aparelho
 { const sx=base(); sx.kanban.usuarios.ana.dicas={vistas:{radar:{semaforo:true,atingimento:true,agente:true,menu:true,apresentacao:true}}};
   const {ctx,p}=await abrir('okr',sx); await p.evaluate(()=>_okrEntrarTorre('digital')); await p.waitForTimeout(6800);
   t('Radar: dicas vistas em outro aparelho (Firebase) não voltam — a de entrada acabou, nada aparece', (await dica(p))===null, await dica(p)); await ctx.close(); }
 { const sx=base(); sx.kanban.usuarios.ana.dicas={off:{radar:true}};
   const {ctx,p}=await abrir('okr',sx); await p.evaluate(()=>_okrEntrarTorre('digital')); await p.waitForTimeout(6800);
   t('Radar: desligado no Firebase = não mostra', (await dica(p))===null, await dica(p)); await ctx.close(); }

 // visualizador externo: sem Firebase, só localStorage
 { const ctx=await b.newContext({viewport:{width:1280,height:800}}); await fake.install(ctx,(()=>{ const sx=base(); sx.kanban.painel_viewers={'ext@gmail,com':true}; return sx; })()); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
   await p.goto('http://localhost:8941/okr'+SUF+'.html'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U('ext','Externo','ext@gmail.com')); await p.waitForTimeout(6800);
   const e=await estado(p); t('Radar (externo): não quebra e guarda só no aparelho (sem erro de JS)', !errs.length && e.app==='radar', {errs,e}); await ctx.close(); }

 // ── OCEANO ──
 { const {ctx,p,errs}=await abrir('oceano',base({notif_feed:{}}),1280,800); await p.waitForTimeout(4600);
   let d=await dica(p); t('Oceano: dica de entrada aparece, título "Dica do Oceano", com "Saiba mais"', d && /Oceano/.test(d.titulo) && d.mais, d);
   await p.click('#mare-dica [data-a=mais]'); await p.waitForTimeout(400);
   t('Oceano: "Saiba mais" abre a pergunta certa da Ajuda', await p.evaluate(()=>document.getElementById('ov-ajuda').classList.contains('open') && document.querySelector('#faq details[open]')!==null), 'ajuda');
   await p.evaluate(()=>{ document.getElementById('ov-ajuda').classList.remove('open'); });
   await p.click('#btn-eu'); await p.waitForTimeout(500);
   t('Oceano: ⚙ Meu perfil tem o interruptor 💡 Dicas', await p.evaluate(()=>!!document.querySelector('#pf-dicas input[type=checkbox]')), 'sem controle');
   await p.evaluate(()=>{ const c=document.querySelector('#pf-dicas input'); c.checked=false; c.dispatchEvent(new Event('change',{bubbles:true})); });
   t('Oceano: desligar no perfil vale na hora', !(await estado(p)).ativas, await estado(p));
   const fb=await p.evaluate(()=>window._get(window._ref(window._db,'kanban/usuarios/ana/dicas')).then(s=>s.val())); t('Oceano: grava off/oceano', fb && fb.off && fb.off.oceano===true && !fb.off.radar, fb);
   t('Oceano: sem erro de JS', !errs.length, errs); await ctx.close(); }
 { const {ctx,p}=await abrir('oceano',base({notif_feed:{}}),390,800); await p.waitForTimeout(4600); const r=await p.evaluate(()=>{ const e=document.getElementById('mare-dica'); if(!e) return null; const r=e.getBoundingClientRect(); return {l:r.left,r:innerWidth-r.right,b:innerHeight-r.bottom}; });
   t('Oceano (celular): popup cabe na tela, margens iguais, acima da base', r && r.l>=8 && r.r>=8 && r.b>=60, r); await ctx.close(); }

 // ── MARÉ (boot real do kanban) ──
 { const sx=base(); sx.kanban.squads={dev:{dados:{columns:[{id:'todo',name:'A fazer'}],tags:[],cards_index:{c1:'k1'},cards:{k1:{id:'c1',title:'Card de teste',col:'todo',owner:'AA'}}}}};
   const {ctx,p,errs}=await abrir('kanban',sx,1280,800,'?squad=dev'); await p.evaluate(()=>{ document.querySelectorAll('.ov.open').forEach(o=>o.classList.remove('open')); });
   await p.waitForFunction(()=>!!document.getElementById('mare-dica'),null,{timeout:12000}).catch(()=>{});
   let d=await dica(p); t('Maré: dica de entrada aparece, título "Dica do Maré", com "Saiba mais"', d && /Maré/.test(d.titulo) && d.mais, d);
   await p.evaluate(()=>{ MareDicas.fechar(); openHelp(); }); await p.waitForTimeout(500);
   t('Maré: a Central de Ajuda tem o interruptor 💡 Dicas', await p.evaluate(()=>!!document.querySelector('#help-dicas-ctl input[type=checkbox]')), 'sem controle');
   await p.evaluate(()=>{ document.getElementById('help-ov').classList.remove('open'); });
   await p.evaluate(()=>MareDicas.reiniciar()); await p.evaluate(()=>{ MareDicas._estado(); });
   t('Maré: sem erro de JS', !errs.length, errs.filter(e=>!/ResizeObserver/.test(e))); await ctx.close(); }
 await b.close(); console.log(ok?'TUDO OK':'HÁ FALHAS'); })();
