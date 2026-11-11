// Ilha no Maré: contrato de integração, boot real + Firebase falso (sem acessar banco real).
// Rodar na raiz: python3 -m http.server 8959
// Depois: node docs/arezzo/testes/test_ilha_mare.js
// Escrito pelo contrato enquanto a implementação era feita em outro worktree.
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const chromeRoot = path.join(home, 'hering-tools/chrome');
const chrome = process.env.CHROME || path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n=>n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8959';
const out = process.env.OUT || path.join(__dirname, '../../capturas/ilha-notificacoes');
const U = {uid:'eve',email:'eve@ciahering.com.br',displayName:'Eve',photoURL:'',providerData:[{providerId:'google.com'}]};
const seed = ()=>{
  const t1 = {sq:'site',cardId:'c1',cardTitle:'Banner',atividade:'Revisar campanha',tipo:'cronometro',status:'rodando',startedAt:Date.now()-5*60000,accMs:0,porUid:'ana'};
  const t2 = {sq:'site',cardId:'c2',cardTitle:'Relatório',atividade:'Relatório semanal',tipo:'cronometro',status:'pausado',accMs:600000,startedAt:null,porUid:'eve'};
  return {kanban:{usuarios:{eve:{uid:'eve',nome:'Eve',email:U.email,init:'EV',role:'membro',inscrito:true,squads:{site:true},notificacoes:{n1:{type:'mention',title:'Velha',ts:new Date(Date.now()-3600000).toISOString(),read:false}}},ana:{nome:'Ana'}},config:{adm_emails:[]},timers_ativos:{eve:{t1,t2}},squads:{site:{dados:{columns:[{id:'doing',name:'Fazendo'}],cards_index:{c1:'k0',c2:'k1'},cards:{k0:{id:'c1',title:'Banner',col:'doing'},k1:{id:'c2',title:'Relatório',col:'doing'}},card_timers:{c1:{t1:{...t1,id:'t1',uid:'eve',iniciadoEm:'2026-11-10T08:00:00.000Z'}},c2:{t2:{...t2,id:'t2',uid:'eve'}}}}}}}};
};
let assertions = 0, failures = 0, skipped = 0;
const check = (name, pass, detail)=>{ assertions++; if(!pass) failures++; console.log((pass?'✅ ':'❌ ')+name+(pass?'':' → '+JSON.stringify(detail))); };
const state = p=>p.getAttribute('#ilha','data-estado');
const text = (p,s)=>p.locator(s).textContent();
const timer = (id,action)=>`.ilha-timer[data-id="${id}"] [data-acao="${action}"]`;
const until = async(p,fn,arg,timeout=2500)=>{ try {await p.waitForFunction(fn,arg,{timeout}); return true;} catch(e) {if(e.name==='TimeoutError') return false; throw e;} };
// Com a ilha recolhida e invisível (ex.: "só com ação" sem atividade), o caminho para ela é o ⏲ Timers → 🏝️ Ilha Dinâmica (abre nos ajustes).
const openPanel = async p=>{ if(await state(p)==='aberta'){ await p.waitForSelector('#ilha-painel',{state:'visible'}); return; } if(await p.locator('#ilha-btn').isVisible()) await p.click('#ilha-btn'); else { await p.evaluate(()=>_ilhaAbrirAjustes()); } await p.waitForSelector('#ilha-painel',{state:'visible'}); };
const tab = async(p,name)=>{await openPanel(p); await p.click(`.ilha-aba[data-aba="${name}"]`);};
const config = async(p,id,value)=>{await tab(p,'ajustes'); if(typeof value==='boolean') await p.locator(id).setChecked(value); else await p.selectOption(id,value);};
const close = async p=>{await p.keyboard.press('Escape'); await p.waitForTimeout(150);};
const notify = (p,id)=>p.evaluate(async id=>{await window._set(window._ref(window._db,`kanban/usuarios/eve/notificacoes/${id}`),{type:'mention',title:'Bia mencionou você',sub:'em Relatório',ts:new Date().toISOString(),read:false,cardId:'c2'});},id);
const read = (p,key)=>p.evaluate(key=>key.split('/').reduce((o,k)=>o?.[k],window.__store),key);
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser = await chromium.launch({executablePath:chrome,headless:true});
  const session = async(width=1280)=>{
    const ctx = await browser.newContext({viewport:{width,height:800},hasTouch:width===390,isMobile:width===390}); await fake.install(ctx,seed()); if(process.env.MAIN_HTML) await ctx.route('**/kanban-dev.html?*',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(process.env.MAIN_HTML,'utf8')}));
    const p = await ctx.newPage(), errors=[]; p.setDefaultTimeout(10000); p.on('pageerror',e=>errors.push(e.message));
    await p.goto(base+'/kanban-dev.html?squad=site'); await p.waitForFunction(()=>!!window.__authCb && !!window._ref);
    await p.evaluate(()=>{
      window.__ilhaRefs=[]; window.__ilhaStates=[];
      const original=window._ref;
      window._ref=function(db,path,...rest){if(String(path||'').startsWith('kanban/timers_ativos/')) window.__ilhaRefs.push(String(path)); return original.call(this,db,path,...rest);};
      // Observa também a primeira entrega: n1 não pode causar nem um aviso transitório.
      new MutationObserver(()=>{const el=document.getElementById('ilha'); if(el) window.__ilhaStates.push(el.dataset.estado);}).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['data-estado']});
    });
    await p.evaluate(u=>window.__authCb(u),U); await p.waitForTimeout(3000);
    await p.evaluate(()=>document.querySelectorAll(".ov.open").forEach(o=>o.classList.remove("open")));   // boas-vindas e afins da 1ª visita ficam por cima do topo
    return {ctx,p,errors};
  };
  const run = async(name,fn,width)=>{const s=await session(width); try {await fn(s);} catch(e){check(name+' executável',false,e.message);} finally {check(name+' sem erro de JavaScript',!s.errors.length,s.errors); await s.ctx.close();}};
  const enable = async p=>{await p.evaluate(()=>openMinhasPrefs()); await p.click('#ilha-ligar'); await p.waitForSelector('#ilha-intro.open'); await p.click('[data-ii="pular"]'); await p.waitForSelector('#ilha',{state:'visible'});};
  try {
    await run('paridade do sino',async({p})=>{
      await p.evaluate(()=>{
        window.__sinoOriginal=document.getElementById('notif-panel');
        window.__listaOriginal=document.getElementById('notif-list');
      });
      const before=await p.evaluate(()=>window.__log.filter(x=>x[0]==='onValue').length);
      await enable(p); await tab(p,'notif');
      const embedded=await p.locator('#ilha-sino-slot #notif-panel').count();
      check('Ilha hospeda o mesmo painel do sino',embedded===1 && await p.evaluate(()=>document.getElementById('notif-panel')===window.__sinoOriginal));
      if(!embedded) return;
      check('limpeza, som, push, Não Perturbe e insistente acessíveis',await p.evaluate(()=>['notif-sound-toggle','notif-perm-row','dnd-toggle-btn','ins-toggle-btn'].every(id=>!!document.querySelector('#ilha-sino-slot #'+id))) && await p.getByText('Limpar antigas',{exact:true}).isVisible());
      await p.evaluate(async()=>{
        const up={}; for(let i=0;i<12;i++) up['extra'+i]={id:'extra'+i,type:'done',title:'Teste '+i,sub:'Texto comprido para conferir a lista inteira',read:false,ts:new Date().toISOString()};
        up.deterministica={id:'deterministica',type:'mention',title:'Não recriar',read:false,noTTLDelete:true,ts:new Date().toISOString()};
        await window._update(window._ref(window._db,'kanban/usuarios/eve/notificacoes'),up);
      });
      check('lista inteira, sem corte nos oito primeiros',await until(p,()=>document.querySelectorAll('#ilha-sino-slot .notif-item').length===14));
      await p.click('#notif-sound-toggle');
      check('som usa preferência original',await p.evaluate(()=>isNotifSoundMuted()===true));
      await p.click('#notif-sound-toggle');
      check('som pode ser reativado',await p.evaluate(()=>isNotifSoundMuted()===false));
      await p.click('#dnd-toggle-btn');
      check('menu DND fora do ancestral com transform',await p.evaluate(()=>document.getElementById('dnd-menu').parentElement===document.body));
      check('DND com lista longa permanece dentro da janela',await p.evaluate(()=>{const r=document.getElementById('dnd-menu').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth;}));
      await p.getByRole('button',{name:'🔕 Por 1 hora',exact:true}).click();
      check('DND grava a mesma preferência e mantém Ilha aberta',await until(p,()=>window.__store.kanban.usuarios.eve.notif_prefs?.dnd?.on===true && document.getElementById('ilha').dataset.estado==='aberta'));
      await p.click('#dnd-toggle-btn'); await p.keyboard.press('Escape');
      check('Esc recolhe só submenu e devolve foco',await state(p)==='aberta' && await p.evaluate(()=>document.activeElement.id==='dnd-toggle-btn' && document.getElementById('dnd-menu').style.display==='none'));
      await p.click('#ins-toggle-btn');
      await p.locator('#mn-ins-menu [data-ins="on"]').setChecked(true);
      check('modo insistente original editável sem fechar Ilha',await state(p)==='aberta' && await until(p,()=>window.__store.kanban.usuarios.eve.notif_prefs?.insistente?.on===true));
      await p.keyboard.press('Escape');
      // Push: Firebase falso e adaptadores de dispositivo simulados; nunca solicita permissão real.
      await p.evaluate(()=>{
        window.confirm=()=>true;
        notifPermissionState=()=> 'granted';
        registerPushToken=async()=>{await window._set(window._ref(window._db,'kanban/usuarios/eve/fcm_tokens/'+PUSH_DEVICE_ID),{token:'ficticio'});return 'ficticio';};
        unregisterPushToken=async()=>window._set(window._ref(window._db,'kanban/usuarios/eve/fcm_tokens/'+PUSH_DEVICE_ID),null);
      });
      await p.click('#notif-perm-row');
      check('push ativa com permissão já concedida e sem inscrição',await until(p,()=>!!window.__store.kanban.usuarios.eve.fcm_tokens?.[PUSH_DEVICE_ID]));
      await p.click('#notif-perm-row');
      check('push desativa só o registro do aparelho',await until(p,()=>!window.__store.kanban.usuarios.eve.fcm_tokens?.[PUSH_DEVICE_ID]));
      await p.click('#notif-perm-row');
      check('push pode ser reativado no mesmo controle',await until(p,()=>!!window.__store.kanban.usuarios.eve.fcm_tokens?.[PUSH_DEVICE_ID]));
      await p.getByRole('button',{name:'Marcar todas como lidas',exact:true}).click();
      check('marcar todas inclui lista completa',await until(p,()=>Object.values(window.__store.kanban.usuarios.eve.notificacoes).every(n=>n.read)));
      await p.getByRole('button',{name:'Limpar antigas',exact:true}).click();
      check('limpeza mantém determinística dispensada sem ressuscitar',await until(p,()=>{const ns=window.__store.kanban.usuarios.eve.notificacoes;return Object.keys(ns).length===1 && ns.deterministica.read && ns.deterministica.dismissed;}));
      const roteiro=await p.evaluate(fs.readFileSync(path.join(__dirname,'console_ilha_notificacoes.js'),'utf8'));
      check('script de console executa com cinco verificações aprovadas',roteiro.length===5&&roteiro.every(r=>r.resultado==='✅'),roteiro);
      check('nenhum listener novo de notificações',await p.evaluate(()=>window.__log.filter(x=>x[0]==='onValue').length)===before);
      await tab(p,'timers');
      check('trocar aba restaura painel original sem perder nó/lista',await p.evaluate(()=>!document.getElementById('notif-panel').closest('#ilha') && document.getElementById('notif-list')===window.__listaOriginal));
      await tab(p,'notif');await close(p);
      check('fechar restaura painel e menu sem IDs duplicados',await p.evaluate(()=>!document.getElementById('notif-panel').closest('#ilha') && document.querySelectorAll('#notif-panel').length===1 && !!document.getElementById('dnd-menu').closest('#notif-panel')));
      await p.evaluate(()=>window.__ilha.desligar());
      await p.click('#notif-btn');
      check('sino tradicional funciona depois de desligar Ilha',await p.locator('#notif-panel').isVisible());
    });
    for(const width of [1280,390]) for(const theme of ['dark','light','vice']) await run(`${width}/${theme}`,async({p})=>{
      await enable(p);await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);await tab(p,'notif');
      const result=await p.evaluate(()=>{const box=document.getElementById('ilha-painel'),r=box.getBoundingClientRect();return {overflow:box.scrollWidth-box.clientWidth,left:r.left,right:r.right,width:innerWidth};});
      check('notificações e rodapé sem overflow '+width+'/'+theme,result.overflow<=1 && result.left>=-1 && result.right<=result.width+1,result);
      check('rodapé de notificações presente '+width+'/'+theme,await p.locator('#ilha-sino-slot #ins-toggle-btn').count()===1);
      check('controles não cobertos pelas abas laterais '+width+'/'+theme,await p.evaluate(()=>{const e=document.getElementById('notif-perm-row'),r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.right-2,r.top+r.height/2));}));
      if(await p.locator('#ilha-sino-slot').count()){
        await p.click('#dnd-toggle-btn');
        const menu=await p.evaluate(()=>{const m=document.getElementById('dnd-menu'),r=m.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight};});
        check('menu DND cabe na janela '+width+'/'+theme,menu.top>=0 && menu.bottom<=menu.height,menu);
        await p.keyboard.press('Escape');
      }
      await p.screenshot({path:path.join(out,`notificacoes_${width}_${theme}.png`)});
    },width);
  } finally {await browser.close();}
  console.log(`\n${assertions} asserções, ${failures} falha(s), ${skipped} cenário(s) pulado(s).`); process.exitCode=failures?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
