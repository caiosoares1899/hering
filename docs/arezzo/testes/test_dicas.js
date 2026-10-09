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
 // ── /monitorarbugs (2026-10-09): regressões ──
 // (1) visualizador externo só acompanha: nunca recebe dica que manda editar/criar
 { const sx=base(); sx.kanban.painel_viewers={'ext@gmail,com':true};
   const ctx=await b.newContext({viewport:{width:1280,height:800}}); await fake.install(ctx,sx); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
   await p.goto('http://localhost:8941/okr'+SUF+'.html?torre=digital'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U('ext','Externo','ext@gmail.com')); await p.waitForTimeout(6800);
   const d=await dica(p); t('Externo (só leitura): a dica de entrada NÃO manda editar — é a da Apresentação', d && /Apresenta/.test(d.t) && !/Atualize|Converse|registrar|botão direito/i.test(d.t), d);
   const ed=await p.evaluate(()=>{ const c=MareDicas.catalogo().radar.dicas; return {edita:c.filter(x=>x.edita).map(x=>x.id)}; });
   t('Externo: as dicas de edição existem no catálogo (flag edita) e continuam pros demais', ed.edita.length===6, ed);
   await ctx.close();
   const {ctx:c2,p:p2}=await abrir('okr'); await p2.evaluate(()=>_okrEntrarTorre('digital')); await p2.waitForTimeout(6800);
   const d2=await dica(p2); t('Radar (membro/ADM): a primeira dica de entrada continua sendo a do semáforo', d2 && /semáforo/.test(d2.t), d2); await c2.close(); }
 // (2) Oceano: com um produto aberto aqui dentro, a dica de entrada do lobby NÃO cobre o produto
 { const sx=base({notif_feed:{}}); const ctx=await b.newContext({viewport:{width:1280,height:800}}); await fake.install(ctx,sx);
   await ctx.addInitScript(()=>{ try{ localStorage.setItem('oceano_prefs', JSON.stringify({abrir:'aqui'})); }catch(e){} });
   const p=await ctx.newPage(); await p.goto('http://localhost:8941/oceano'+SUF+'.html'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U('ana','Ana ADM')); await p.waitForTimeout(1500);
   await p.click('#tiles .tile-main[data-app="okr"]'); await p.waitForTimeout(500);
   await p.evaluate(()=>{ MareDicas.reiniciar(); MareDicas.gatilho('boot'); }); await p.waitForTimeout(2300);
   t('Oceano: com o Radar aberto aqui dentro a dica de entrada do lobby não aparece', (await dica(p))===null, await dica(p));
   await p.evaluate(()=>{ document.getElementById('host').classList.remove('on'); MareDicas.reiniciar(); MareDicas.gatilho('boot'); }); await p.waitForTimeout(2300);
   t('Oceano: de volta ao lobby a dica aparece', (await dica(p))!==null, 'sem dica'); await ctx.close(); }
 // (3) interruptor: foco fica no controle e os ouvintes não se acumulam a cada abertura da Ajuda
 { const {ctx,p}=await abrir('okr'); await p.evaluate(()=>_okrEntrarTorre('digital')); await p.waitForTimeout(800);
   const r=await p.evaluate(async()=>{ for(let i=0;i<25;i++){ openOkrHelp(); closeOkrHelp(); } openOkrHelp(); const el=document.getElementById('okr-help-dicas');
     let redes=0; const mo=new MutationObserver(rs=>{ redes+=rs.filter(x=>x.addedNodes.length).length; }); mo.observe(el,{childList:true});
     const inp=el.querySelector('input'); inp.focus(); inp.click(); await new Promise(r=>setTimeout(r,80)); mo.disconnect();
     return {redes, foco:document.activeElement===el.querySelector('input'), marcado:el.querySelector('input').checked, ativas:MareDicas.ativas()}; });
   t('Interruptor: alternar não redesenha o controle (0 redesenhos, mesmo depois de 26 aberturas da Ajuda) e o foco continua nele', r.redes===0 && r.foco, r);
   t('Interruptor: a troca vale (desligado) e o controle acompanha', r.ativas===false && r.marcado===false, r);
   await p.evaluate(()=>MareDicas.definir(true)); await p.waitForTimeout(100);
   t('Interruptor: religar por fora (JS) atualiza o controle que está na tela', await p.evaluate(()=>document.querySelector('#okr-help-dicas input').checked), 'desatualizado'); await ctx.close(); }
 // (4) "Saiba mais" leva ao tópico CERTO (a entrada do título vem primeiro) nos 3 apps
 { const sx=base(); sx.kanban.squads={dev:{dados:{columns:[{id:'todo',name:'A fazer'}],tags:[],cards_index:{c1:'k1'},cards:{k1:{id:'c1',title:'Card',col:'todo',owner:'AA'}}}}};
   const {ctx,p}=await abrir('kanban',sx,1280,800,'?squad=dev'); await p.evaluate(()=>document.querySelectorAll('.ov.open').forEach(o=>o.classList.remove('open')));
   const res=await p.evaluate(async()=>{ const out=[]; for(const d of MareDicas.catalogo().mare.dicas){ openHelp(d.saiba.tab, d.saiba.q); await new Promise(r=>setTimeout(r,250));
       const prim=(document.querySelector('#help-body > div > div:nth-child(2)')||{}).textContent||''; out.push([d.id, prim.toLowerCase().includes(d.saiba.q.toLowerCase()), (document.getElementById('help-search-count').textContent)]); } return out; });
   t('Maré: todo "Saiba mais" abre a Ajuda com o tópico certo EM PRIMEIRO ('+res.length+' dicas)', res.every(x=>x[1]), res.filter(x=>!x[1]));
   t('Maré: a dica do Ctrl+K não promete busca "de qualquer squad" (a busca é do board atual)', !/qualquer squad/.test(JSON.stringify(await p.evaluate(()=>MareDicas.catalogo().mare.dicas))), 'texto'); await ctx.close(); }
 { const {ctx,p}=await abrir('okr'); await p.evaluate(()=>_okrEntrarTorre('digital')); const r=await p.evaluate(()=>MareDicas.catalogo().radar.dicas.filter(d=>d.saiba && !document.getElementById('hlp-'+d.saiba)).map(d=>d.id));
   t('Radar: todo "Saiba mais" aponta pra um tópico que existe na Ajuda (hlp-<id>)', r.length===0, r); await ctx.close(); }
 { const {ctx,p}=await abrir('oceano',base({notif_feed:{}})); await p.click('#btn-ajuda'); await p.waitForTimeout(400);
   const r=await p.evaluate(()=>MareDicas.catalogo().oceano.dicas.filter(d=>d.saiba && !document.getElementById('faq-'+d.saiba)).map(d=>d.id));
   t('Oceano: todo "Saiba mais" aponta pra uma pergunta que existe na Ajuda (faq-<id>)', r.length===0, r); await ctx.close(); }
 // ── PAINEL: aba 💡 Dicas lista tudo (só leitura) e marca o que a própria pessoa já viu ──
 { const sx=base(); sx.kanban.usuarios.ana.dicas={vistas:{radar:{semaforo:true,agente:true},mare:{busca:true}},off:{oceano:true}};
   const {ctx,p,errs}=await abrir('painel',sx); await p.evaluate(()=>{ setPcfgTab('dicas'); }); await p.waitForTimeout(900);
   const r=await p.evaluate(()=>{ const el=document.getElementById('pcfg-dicas-list'); const sec=[...el.querySelectorAll('.cfg-sec')].map(x=>x.textContent.replace(/\s+/g,' ').trim()); return {sec, linhas:el.querySelectorAll('[title^="Você"]').length, vistos:[...el.querySelectorAll('[title="Você já viu esta dica"]')].length, txt:el.innerText, vis:getComputedStyle(document.getElementById('painel-cfg-dicas')).display}; });
   t('Painel: aba 💡 Dicas aparece e lista Radar, Maré e Oceano', r.vis==='block' && r.sec.length===3 && /Radar/.test(r.sec[0]) && /Maré/.test(r.sec[1]) && /Oceano/.test(r.sec[2]), r);
   t('Painel: mostra todas as dicas (11 + 10 + 6) com o texto e onde aparece', r.linhas===27 && /Ao abrir o Dashboard/.test(r.txt) && /Ao abrir um card/.test(r.txt) && /Ao abrir ⚙ Meu perfil/.test(r.txt), {linhas:r.linhas});
   t('Painel: marca ✅ só o que a pessoa já viu (3) e avisa que as do Oceano estão desligadas pra ela', r.vistos===3 && /desligadas pra você/.test(r.sec[2]) && /você viu 2/.test(r.sec[0]), r);
   t('Painel: mostra o tópico da Ajuda ("Saiba mais →") de cada dica', /Saiba mais → Marcos e status/.test(r.txt) && /Saiba mais → Busca global/.test(r.txt), 'saiba');
   t('Painel: sem erro de JS', !errs.length, errs); await ctx.close(); }
 await b.close(); console.log(ok?'TUDO OK':'HÁ FALHAS'); })();
