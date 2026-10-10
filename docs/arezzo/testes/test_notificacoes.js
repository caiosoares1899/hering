// 🔔 Central de Notificações (painel-dev aba "Notificações" + interruptores sino/push + catálogo em mare-notif-dev.js). Playwright + fakefb.
// Uso (servidor estático na raiz, porta 8941):  node docs/arezzo/testes/test_notificacoes.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fake = require('./fakefb.js'); const fs = require('fs');
const ROOT = '/home/user/hering/';
const U = (uid,n)=>({uid,email:uid+'@ciahering.com.br',displayName:n,photoURL:'',providerData:[{providerId:'google.com'}]});
const agora = Date.now(), iso = ms=>new Date(ms).toISOString();
const seed = ()=>({kanban:{
  usuarios:{
    ana:{uid:'ana',nome:'Ana ADM',email:'ana@ciahering.com.br',inscrito:true,init:'AA',role:'adm',squads:{dev:true},
      fcm_tokens:{a:{token:'T1'},b:{token:'T2'}},
      notificacoes:{n1:{id:'n1',type:'mention',title:'@AA mencionada',sub:'x',ts:iso(agora-3600e3),read:false},n2:{id:'n2',type:'assigned',title:'Atribuído',sub:'y',ts:iso(agora-7200e3),read:true},n3:{id:'n3',type:'mention',title:'velha',sub:'z',ts:iso(agora-20*864e5),read:false}}},
    bia:{uid:'bia',nome:'Bia Souza',email:'bia@ciahering.com.br',inscrito:true,init:'BS',role:'membro',squads:{dev:true},fcm_tokens:{c:{token:'T3'}},notif_prefs:{dnd:{on:true,until:iso(agora+3*3600e3),label:'Foco'}},notificacoes:{n4:{id:'n4',type:'mention',title:'m',sub:'',ts:iso(agora-1000),read:false}}},
    caro:{uid:'caro',nome:'Caro Lima',email:'caro@ciahering.com.br',inscrito:true,init:'CL',role:'membro',squads:{dev:true},notif_prefs:{dnd:{on:true,until:iso(agora-3600e3)}}},   // DND já vencido: não conta
    dan:{uid:'dan',nome:'Dan Reis',email:'dan@ciahering.com.br',inscrito:true,init:'DR',role:'membro',squads:{dev:true},notif_prefs:{dnd:{on:true}}},   // DND sem hora de fim
  },
  usuarios_publicos:{ana:{uid:'ana',nome:'Ana ADM',init:'AA'},bia:{uid:'bia',nome:'Bia Souza',init:'BS'}},
  config:{adm_emails:['ana@ciahering.com.br']}, squads_meta:{}, squads:{dev:{cards:{}}},
}});
let ok=true; const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+(JSON.stringify(d)||'').slice(0,300))); };
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 const abrirPainel=async(user, w)=>{ const ctx=await b.newContext({viewport:{width:w||1280,height:900}}); await fake.install(ctx,seed()); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
   await p.goto('http://localhost:8941/painel-dev.html'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),user); await p.waitForTimeout(2600);
   await p.evaluate(()=>{ document.querySelectorAll('.ov.open').forEach(o=>o.classList.remove('open')); window._pollSquadDados=()=>{}; window._pollSquadSnapshots=()=>{}; });
   return {ctx,p,errs}; };

 // ── catálogo × código (sem navegador) ──
 const idx=fs.readFileSync(ROOT+'functions/index.js','utf8');
 const pt=new Set([...(/const PUSH_TYPES = new Set\(\[([^\]]*)\]/.exec(idx)[1].matchAll(/'([a-z_]+)'/g))].map(m=>m[1]));
 const mod=fs.readFileSync(ROOT+'mare-notif-dev.js','utf8');
 const pp=new Set([...(/const PUSH_PADRAO = new Set\(\[([^\]]*)\]/.exec(mod)[1].matchAll(/'([a-z_]+)'/g))].map(m=>m[1]));
 const esperado=new Set([...pt,'mural']);
 t('PUSH_PADRAO do módulo = PUSH_TYPES da função + mural', pp.size===esperado.size && [...esperado].every(x=>pp.has(x)), {faltaNoModulo:[...esperado].filter(x=>!pp.has(x)),sobra:[...pp].filter(x=>!esperado.has(x))});
 const kan=fs.readFileSync(ROOT+'kanban-dev.html','utf8');
 const criados=new Set([...kan.matchAll(/createNotif\([^,]+,\s*'([a-z_]+)'/g)].map(m=>m[1]));
 const icones=new Set([...(/const NOTIF_ICONS = \{([^}]*)\}/.exec(kan)[1].matchAll(/^\s*([a-z_]+):/gm))].map(m=>m[1]));
 const ids=new Set([...mod.matchAll(/^\s*\{id:'([a-z_]+)', area:/gm)].map(m=>m[1]));
 t('todo tipo criado por createNotif() no Maré está no catálogo', [...criados].every(x=>ids.has(x)), [...criados].filter(x=>!ids.has(x)));
 t('todo tipo de NOTIF_ICONS (menos o morto due_soon) está no catálogo', [...icones].filter(x=>x!=='due_soon').every(x=>ids.has(x)), [...icones].filter(x=>x!=='due_soon'&&!ids.has(x)));
 const okrTipos=['okr_editado','okr_prazo','okr_reuniao','okr_agente','okr_mencao','mural','obj_criado','marco_concluido','okr_evento','rascunho','painel_broadcast','intake'];
 t('tipos do Radar/Painel/servidor também estão no catálogo', okrTipos.every(x=>ids.has(x)), okrTipos.filter(x=>!ids.has(x)));

 // ── Painel: ADM ──
 { const {ctx,p,errs}=await abrirPainel(U('ana','Ana ADM'));
   t('aba 🔔 Notificações existe', await p.evaluate(()=>!!document.getElementById('ptab-notifs')&&!!document.getElementById('ppane-notifs')));
   await p.evaluate(()=>swPtab('notifs')); await p.waitForTimeout(700);
   const v=await p.evaluate(()=>({linhas:document.querySelectorAll('#nc-tipos .nc-row').length,total:MareNotif.TIPOS.length,areas:document.querySelectorAll('#nc-tipos .nc-area').length,resumo:[...document.querySelectorAll('#nc-resumo .met')].map(m=>m.textContent.replace(/\s+/g,' ').trim()),visivel:document.getElementById('ppane-notifs').classList.contains('on')}));
   t('lista todos os tipos do catálogo, agrupados por área', v.visivel && v.linhas===v.total && v.areas===6, v);
   t('resumo: 🔕 Não Perturbe agora = 2 (Bia com fim futuro + Dan sem fim; Caro venceu)', /Não Perturbe agora\s*2/.test(v.resumo[2]) && /Bia/.test(v.resumo[2]) && /Dan/.test(v.resumo[2]) && !/Caro/.test(v.resumo[2]), v.resumo);
   t('resumo: pessoas com push = 2 de 4', /2\s*\/4/.test(v.resumo[3].replace(/\s/g,'')) , v.resumo[3]);
   const pes=await p.evaluate(()=>[...document.querySelectorAll('#nc-pessoas .nc-pess:not(.hd)')].map(r=>({nome:r.querySelector('b').textContent,txt:r.textContent.replace(/\s+/g,' ')})));
   t('pessoas em Não Perturbe vêm primeiro e mostram até quando / sem hora de fim / rótulo', pes.length===4 && /Bia|Dan/.test(pes[0].nome) && /Foco/.test(pes.find(x=>/Bia/.test(x.nome)).txt) && /sem hora de fim/.test(pes.find(x=>/Dan/.test(x.nome)).txt), pes);
   t('Caro (Não Perturbe vencido) e Ana (sem Não Perturbe) aparecem sem 🔕', !/ligado/.test(pes.find(x=>/Caro/.test(x.nome)).txt) && !/ligado/.test(pes.find(x=>/Ana/.test(x.nome)).txt) && /2 aparelhos/.test(pes.find(x=>/Ana/.test(x.nome)).txt), pes);
   await p.click('#nc-chips-pessoas .nc-chip:nth-child(2)'); await p.waitForTimeout(150);
   t('filtro "Em Não Perturbe" lista só as 2 pessoas', (await p.evaluate(()=>document.querySelectorAll('#nc-pessoas .nc-pess:not(.hd)').length))===2);
   await p.evaluate(()=>ncFiltroPessoas('todos'));
   const uso=await p.evaluate(()=>{ const r=document.getElementById('nc-row-mention'); return r.querySelector('.nc-uso').textContent; });
   t('uso 7d da Menção: 2 notificações recentes (a de 20 dias não conta), em 2 pessoas', /2 em 2 pessoas/.test(uso) && /2 não lidas/.test(uso), uso);
   // detalhes
   await p.click('#nc-row-mention .nc-main'); await p.waitForTimeout(100);
   t('clicar na linha abre QUANDO / QUEM / ONDE', await p.evaluate(()=>{ const d=document.querySelector('#nc-row-mention .nc-det'); return getComputedStyle(d).display!=='none' && /Quando/.test(d.textContent) && /Quem recebe/.test(d.textContent) && /Onde nasce/.test(d.textContent); }));
   // interruptor do sino
   await p.evaluate(()=>{ const i=document.querySelector('#nc-row-mention .nc-sw:nth-of-type(1) input'); i.click(); }); await p.waitForTimeout(500);
   const cfg=await p.evaluate(()=>(window.__store.kanban.notif_config||{}).mention);
   t('desligar o 🔔 de "Menção" grava kanban/notif_config/mention {sino:false, por, em}', cfg && cfg.sino===false && /Ana/.test(cfg.por) && !!cfg.em, cfg);
   const aft=await p.evaluate(()=>({sino:MareNotif.sinoLigado('mention'),viva:MareNotif.viva({type:'mention',ts:new Date().toISOString(),read:false}),vivaOutro:MareNotif.viva({type:'assigned',ts:new Date().toISOString(),read:false}),alt:!!document.querySelector('#nc-row-mention .nc-tag.alt'),filtro:null}));
   t('o módulo passa a esconder o tipo (viva=false) e só ele; a linha ganha "✏️ alterado"', aft.sino===false && aft.viva===false && aft.vivaOutro===true && aft.alt, aft);
   // push on num tipo que não enviava
   await p.evaluate(()=>{ const i=document.querySelector('#nc-row-done .nc-sw:nth-of-type(2) input'); i.click(); }); await p.waitForTimeout(400);
   t('ligar o 📲 de "Card concluído" (fora do PUSH_TYPES) grava push:true', (await p.evaluate(()=>(window.__store.kanban.notif_config||{}).done))?.push===true);
   t('tipo que só existe no sino (feed: Objetivo criado) tem o 📲 travado', await p.evaluate(()=>document.querySelector('#nc-row-obj_criado .nc-sw.dis input').disabled));
   // filtros
   await p.evaluate(()=>ncFiltroTipos('sino_off')); await p.waitForTimeout(100);
   t('filtro "Sino desligado" mostra só Menção', (await p.evaluate(()=>[...document.querySelectorAll('#nc-tipos .nc-row')].map(r=>r.id)))+''==='nc-row-mention');
   await p.evaluate(()=>ncFiltroTipos('alterados')); await p.waitForTimeout(100);
   t('filtro "Alterados" mostra Menção e Card concluído', (await p.evaluate(()=>[...document.querySelectorAll('#nc-tipos .nc-row')].map(r=>r.id).sort()))+''==='nc-row-done,nc-row-mention');
   await p.evaluate(()=>ncFiltroTipos('todos')); await p.fill('#nc-busca','prazo'); await p.waitForTimeout(150);
   t('busca por "prazo" acha os tipos de prazo', (await p.evaluate(()=>[...document.querySelectorAll('#nc-tipos .nc-row')].map(r=>r.id))).some(i=>/due_/.test(i)));
   await p.fill('#nc-busca',''); await p.evaluate(()=>ncBusca(''));
   // sino do painel esconde o tipo desligado (lista pessoal da Ana tem 1 mention e 1 assigned)
   const sinoP=await p.evaluate(()=>_painelNotifs.filter(n=>n._kind==='notif').map(n=>n.type).sort());
   t('sino do Painel: a Menção desligada some; "Atribuído" continua', sinoP.indexOf('mention')===-1 && sinoP.includes('assigned'), sinoP);
   // restaurar
   await p.evaluate(()=>{ window.confirm=()=>true; ncRestaurarTudo(); }); await p.waitForTimeout(500);
   t('"Restaurar tudo ao padrão" apaga kanban/notif_config e a Menção volta ao sino', await p.evaluate(()=>!window.__store.kanban.notif_config && MareNotif.sinoLigado('mention')));
   // falha de gravação (regras não publicadas) avisa e não deixa o switch mentir
   await p.evaluate(()=>{ window.__denySet=()=>true; }); await p.evaluate(()=>{ document.querySelector('#nc-row-risk .nc-sw:nth-of-type(1) input').click(); }); await p.waitForTimeout(500);
   t('sem permissão de escrita: avisa e o switch volta ao estado real', await p.evaluate(()=>document.querySelector('#nc-row-risk .nc-sw:nth-of-type(1) input').checked===true && /regras|gravar/i.test(document.body.innerText)));
   t('sem erro de JS (ADM)', !errs.length, errs); await ctx.close(); }

 // (opcional) prints pra conferir o visual: SHOT=/pasta node test_notificacoes.js
 if(process.env.SHOT){ for(const w of [1280,390]){ const {ctx,p}=await abrirPainel(U('ana','Ana ADM'),w); await p.evaluate(()=>swPtab('notifs')); await p.waitForTimeout(600); await p.evaluate(()=>{ ncAbrir('mention'); ncSet && 0; }); await p.screenshot({path:process.env.SHOT+'/notifs_'+w+'.png',fullPage:true}); await ctx.close(); } }
 // ── Painel: quem não é ADM só enxerga ──
 { const {ctx,p,errs}=await abrirPainel(U('bia','Bia Souza'));
   await p.evaluate(()=>swPtab('notifs')); await p.waitForTimeout(600);
   const r=await p.evaluate(()=>({linhas:document.querySelectorAll('#nc-tipos .nc-row').length,todosDesab:[...document.querySelectorAll('#nc-tipos .nc-sw input')].every(i=>i.disabled)}));
   t('não-ADM: vê o catálogo, mas todos os interruptores vêm desabilitados', r.linhas>20 && r.todosDesab, r);
   t('sem erro de JS (não-ADM)', !errs.length, errs); await ctx.close(); }

 // ── Maré (kanban-dev): createNotif respeita os interruptores ──
 { const ctx=await b.newContext({viewport:{width:1280,height:800}}); await fake.install(ctx,seed()); await ctx.route('https://www.google.com/s2/favicons**',r=>r.abort()); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
   await p.goto('http://localhost:8941/kanban-dev.html?squad=dev'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U('ana','Ana ADM')); await p.waitForTimeout(2800);
   const gravou=async(tipo)=>{ await p.evaluate(()=>{ window.__log.length=0; }); await p.evaluate(tp=>{ _recentNotifs.clear(); createNotif('bia',tp,'t','s','c1','id_'+tp+Date.now()); },tipo); await p.waitForTimeout(250); return p.evaluate(()=>window.__log.filter(l=>/usuarios\/bia\/notificacoes\//.test(l[1])&&(l[0]==='set'||l[0]==='update')).length); };
   const cfgSet=(tipo,v)=>p.evaluate(([tp,vv])=>window._set(window._ref(window._db,'kanban/notif_config/'+tp),vv),[tipo,v]).then(()=>p.waitForTimeout(300));
   t('Maré: createNotif grava normalmente com tudo no padrão', (await gravou('assigned'))>0);
   await cfgSet('assigned',{sino:false});   // só o sino desligado — "Card atribuído" tem push ligado por padrão
   t('Maré: com só o SINO desligado ainda grava (o push segue ligado)', (await gravou('assigned'))>0);
   await cfgSet('assigned',{sino:false,push:false});
   t('Maré: sino E push desligados = createNotif nem grava', (await gravou('assigned'))===0);
   await cfgSet('moved',{sino:false});   // "Card mudou de coluna" NÃO tem push por padrão → só o sino desligado já é "os dois desligados"
   t('Maré: tipo sem push por padrão com o sino desligado também não grava', (await gravou('moved'))===0);
   await cfgSet('moved',{sino:false,push:true});
   t('Maré: sino desligado mas push ligado explicitamente → grava (a função manda o push)', (await gravou('moved'))>0);
   await cfgSet('assigned',null); await cfgSet('moved',null);
   t('Maré: voltou ao padrão, grava de novo', (await gravou('assigned'))>0);
   t('sem erro de JS (Maré)', !errs.length, errs); await ctx.close(); }

 await b.close(); console.log(ok?'\nTUDO OK':'\nHÁ FALHAS'); process.exit(ok?0:1);
})();
