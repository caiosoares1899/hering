// /monitorarbugs de 11/10 — Intake interno, Mural do Oceano e "Vincular a card". Cada cenário reproduz o achado (falha no código anterior).
// SUF=-dev (padrão).
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const SUF=process.env.SUF===undefined?'-dev':process.env.SUF, B='http://localhost:8941/';
const U=(uid,n)=>({uid,email:uid+'@ciahering.com.br',displayName:n,photoURL:'',providerData:[{providerId:'google.com'}]});
const agora=Date.now(), iso=ms=>new Date(ms).toISOString();
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true; const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+String(JSON.stringify(d===undefined?null:d)).slice(0,400))); };
 // ── 1) Intake: trocar "Pedir para" rápido — a resposta atrasada do squad antigo não pode sobrescrever o novo ──
 { const seed={kanban:{squads_meta:{mkt:{label:'Marketplace',emoji:'🛒'}},usuarios_publicos:{eve:{uid:'eve',squads:{dev:true}}},
     squads:{dev:{dados:{agil_cfg:{intakeEnabled:true,intakeCampos:{tags:{on:true,ids:['t_dev']}}},tags:[{id:'t_dev',label:'SóDoDev'}]}},
             mkt:{dados:{agil_cfg:{intakeEnabled:true,intakeCampos:{tags:{on:true,ids:['t_mkt']}}},tags:[{id:'t_mkt',label:'SóDoMkt'}]}}}}};
   const ctx=await b.newContext({viewport:{width:420,height:900}}); await fake.install(ctx,seed,{oceano:true}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
   await p.goto(B+'intake'+SUF+'.html?squad=dev'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U('eve','Eve')); await p.waitForTimeout(800);
   await p.evaluate(()=>{ window.__getDelay=path=>/squads\/dev\//.test(path)?700:0; });   // o squad antigo (dev) responde DEPOIS do novo (mkt)
   await p.evaluate(()=>{ const s=document.getElementById('s-dest'); s.value='mkt'; s.dispatchEvent(new Event('change')); });
   await p.evaluate(()=>{ const s=document.getElementById('s-dest'); s.value='dev'; s.dispatchEvent(new Event('change')); });   // 2ª troca imediata: volta pro dev (lento)
   await p.evaluate(()=>{ const s=document.getElementById('s-dest'); s.value='mkt'; s.dispatchEvent(new Event('change')); });   // 3ª: mkt é o escolhido FINAL
   await p.waitForTimeout(1800);
   const r=await p.evaluate(()=>({squad:window.__intake.squad,chips:[...document.querySelectorAll('#g-tags .chip')].map(c=>c.textContent.trim()),sel:document.getElementById('s-dest')?.value}));
   t('trocar o squad de destino várias vezes seguidas: vale o ÚLTIMO escolhido (a resposta atrasada de outro squad não sobrescreve as tags)', r.squad==='mkt' && r.chips.join()==='SóDoMkt' && r.sel==='mkt', r);
   t('sem erro de JS (intake)', !errs.length, errs); await ctx.close(); }
 // ── 2) Intake: ?squad= com barra/caracteres estranhos não vira caminho do banco ──
 { const ctx=await b.newContext({viewport:{width:420,height:900}}); await fake.install(ctx,{kanban:{usuarios_publicos:{},squads:{dev:{dados:{agil_cfg:{intakeEnabled:true},tags:[]}}}}},{oceano:true}); const p=await ctx.newPage();
   await p.goto(B+'intake'+SUF+'.html?squad='+encodeURIComponent('dev/../../usuarios')); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U('eve','Eve')); await p.waitForTimeout(800);
   const r=await p.evaluate(()=>({gets:(window.__log||[]).filter(x=>x[0]==='get').map(x=>x[1]),inv:getComputedStyle(document.getElementById('invalid')).display,int:getComputedStyle(document.getElementById('intake-int')).display}));
   t('squad com "/" ou ".." é recusado como link inválido — e nenhuma leitura do banco usa esse texto como caminho', r.inv!=='none' && r.int==='none' && !r.gets.some(g=>/\.\.|usuarios$/.test(g) && /dev\//.test(g)), r); await ctx.close(); }
 // ── 3) Mural: "visto" só com o Mural realmente à vista (aba em segundo plano / produto aberto por cima não contam) ──
 { const com=(id,o)=>[id,Object.assign({id,titulo:'Aviso '+id,corpo:'x',tipo:'aviso',squad:'*',publico:'todos',prioridade:'oceano',ativo:true,oceano:true,criadoEm:iso(agora-3600e3)},o)];
   const seed=()=>({kanban:{usuarios:{eve:{uid:'eve',nome:'Eve',email:'eve@ciahering.com.br',init:'EV',role:'membro',inscrito:true,squads:{dev:true}}},usuarios_publicos:{},config:{adm_emails:[]},comunicados:Object.fromEntries([com('a'),com('b')])}});
   for(const modo of ['aba em segundo plano','produto aberto por cima (host)']){
     const ctx=await b.newContext({viewport:{width:1280,height:900}}); await fake.install(ctx,seed(),{oceano:true}); await ctx.addInitScript(()=>{ try{ localStorage.setItem('oceano_mural_aberto','1'); }catch(e){} }); const p=await ctx.newPage();
     await p.goto(B+'oceano'+SUF+'.html'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U('eve','Eve')); await p.waitForTimeout(900);
     if(modo==='aba em segundo plano') await p.evaluate(()=>{ Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); });
     else await p.evaluate(()=>{ document.getElementById('host').classList.add('on'); });
     await p.waitForTimeout(7000);
     const v=await p.evaluate(()=>localStorage.getItem('oceano_mural_visto_eve'));
     t(`Mural aberto mas ${modo}: os avisos NÃO viram "vistos" (ninguém viu)`, !v || v==='[]', v);
     // volta à vista → passa a contar
     await p.evaluate(()=>{ try{ delete document.hidden; }catch(e){} document.getElementById('host').classList.remove('on'); }); await p.waitForTimeout(7500);
     const v2=await p.evaluate(()=>localStorage.getItem('oceano_mural_visto_eve'));
     t(`...e quando volta à vista, passa a contar como visto (${modo})`, !!v2 && JSON.parse(v2).length===2, v2); await ctx.close(); } }
 // ── 4) Intake: "🔗 Vincular a card" como comentário não pode perder os campos novos do pedido interno ──
 { const ctx=await b.newContext({viewport:{width:1280,height:900}}); await fake.install(ctx,{kanban:{}}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
   await p.goto(B+'kanban'+SUF+'.html',{waitUntil:'load'}); await p.waitForTimeout(1500);
   const r=await p.evaluate(()=>{ window.checkEditPermission=()=>true; window._currentUser={uid:'u1',displayName:'Ana',email:'ana@ciahering.com.br'}; window._set=()=>Promise.resolve();
     cards.splice(0,cards.length,{id:'c1',title:'Card alvo',col:columns[0].id,checklist:[]});
     const it={id:'i1',titulo:'Banner Black',descricao:'Pra home',demandante:'Eve',contato:'eve@x.com',squadDemandante:'Omni',origem:'interno',prioridade:'critical',tags:['Campanha'],submarca:'Hering Kids Comercial',canal:'Dafiti',prazo:'2026-11-20',links:[{url:'https://figma.com/x'}],status:'pending'};
     _intakeBucket['i1']=it; _intakeLinkSel['i1']={cardId:'c1',cardTitle:'Card alvo'}; _intakeConfirmLink('i1','comment');
     const c=Object.values(_commentsCache['c1']||{})[0]; return {texto:c?c.text:''}; });
   t('Vincular como comentário leva prioridade pedida, prazo, tags/submarca/canal e o link do pedido interno', /Prioridade pedida: 🔥/.test(r.texto) && /20\/11\/2026|2026-11-20/.test(r.texto) && /Campanha/.test(r.texto) && /Kids Comercial/.test(r.texto) && /Dafiti/.test(r.texto) && /figma\.com\/x/.test(r.texto), r);
   t('sem erro de JS (kanban)', !errs.length, errs); await ctx.close(); }
 // ── 5) Painel: duplo clique em "Publicar" Comunicado novo = 2 avisos (e 2 no Mural do Oceano) ──
 { const seed={kanban:{usuarios:{ana:{uid:'ana',nome:'Ana',email:'ana@ciahering.com.br',init:'AA',role:'adm',inscrito:true,squads:{}}},usuarios_publicos:{},config:{adm_emails:['ana@ciahering.com.br']}}};
   const ctx=await b.newContext({viewport:{width:1280,height:900}}); await fake.install(ctx,seed,{oceano:true}); await ctx.addInitScript(()=>{ try{ sessionStorage.setItem('mare_login_local','1'); }catch(e){} }); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
   await p.goto(B+'painel'+SUF+'.html'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U('ana','Ana ADM')); await p.waitForTimeout(2600);
   await p.evaluate(()=>{ window.__setDelay=path=>/comunicados/.test(path)?400:0; openComunicadoCompose(); document.getElementById('cc-titulo').value='Dupla'; document.getElementById('cc-prioridade').value='oceano'; _ccTogglePrioridadeUI(); saveComunicado(); saveComunicado(); });
   await p.waitForTimeout(1500);
   const n=await p.evaluate(()=>Object.values(window.__store.kanban.comunicados||{}).filter(c=>c.titulo==='Dupla').length);
   t('duplo clique em Publicar grava UM comunicado só', n===1, n); t('sem erro de JS (painel)', !errs.length, errs); await ctx.close(); }
 // ── 6) Intake interno: duplo clique em "Enviar pedido" = 1 pedido (e 1 aviso pro squad) ──
 { const seed={kanban:{usuarios_publicos:{eve:{uid:'eve',squads:{dev:true}},ana:{uid:'ana',squads:{dev:true}}},squads:{dev:{dados:{agil_cfg:{intakeEnabled:true},tags:[]}}}}};
   const ctx=await b.newContext({viewport:{width:420,height:900}}); await fake.install(ctx,seed,{oceano:true}); const p=await ctx.newPage();
   await p.goto(B+'intake'+SUF+'.html?squad=dev'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U('eve','Eve')); await p.waitForTimeout(800);
   await p.fill('#i-titulo','T'); await p.fill('#i-descricao','D'); await p.selectOption('#i-sqdem-sel','App'); await p.evaluate(()=>{ window.__setDelay=path=>/intake_pending/.test(path)?400:0; });
   await p.dblclick('#i-submit'); await p.waitForTimeout(1500);
   const r=await p.evaluate(()=>({n:Object.keys(window.__store.kanban.squads.dev.dados.intake_pending||{}).length,notifs:Object.values(window.__store.kanban.usuarios?.ana?.notificacoes||{}).length}));
   t('duplo clique em Enviar pedido cria 1 pedido e avisa o squad 1 vez', r.n===1 && r.notifs===1, r); await ctx.close(); }
 // ── 7) Oceano: falha momentânea ao LER o cadastro não pode virar "cadastro novo" por cima do existente ──
 { const seed={kanban:{usuarios:{eve:{uid:'eve',nome:'Eve Apelido',email:'eve@ciahering.com.br',foto:'f.png',criadoEm:'2024-01-01T00:00:00.000Z',init:'EV',role:'membro',inscrito:true,squads:{dev:true}}},usuarios_publicos:{},config:{adm_emails:[]}}};
   const ctx=await b.newContext({viewport:{width:1280,height:900}}); await fake.install(ctx,seed,{oceano:true}); const p=await ctx.newPage();
   await p.addInitScript(()=>{ window.__denyGet=path=>/kanban\/usuarios\/eve\/uid$/.test(path); });
   await p.goto(B+'oceano'+SUF+'.html'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U('eve','Eve Google')); await p.waitForTimeout(1200);
   const u=await p.evaluate(()=>window.__store.kanban.usuarios.eve);
   t('leitura do cadastro falhou: o Oceano NÃO sobrescreve nome/criação do cadastro que já existe', u.nome==='Eve Apelido' && u.criadoEm==='2024-01-01T00:00:00.000Z', u); await ctx.close(); }
 await b.close(); console.log(ok?'TUDO OK':'HÁ FALHAS'); })();
