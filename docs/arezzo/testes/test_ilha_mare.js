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
const out = process.env.OUT || path.join(__dirname, '../../capturas/ilha-mare');
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
const openPanel = async p=>{ if(await state(p)==='aberta'){ await p.waitForSelector('#ilha-painel',{state:'visible'}); return; } if(await p.locator('#ilha-btn').isVisible()) await p.click('#ilha-btn'); else { await p.click('#tb-timers'); await p.click('#ilha-ligar'); } await p.waitForSelector('#ilha-painel',{state:'visible'}); };
const tab = async(p,name)=>{await openPanel(p); await p.click(`.ilha-aba[data-aba="${name}"]`);};
const config = async(p,id,value)=>{await tab(p,'ajustes'); if(typeof value==='boolean') await p.locator(id).setChecked(value); else await p.selectOption(id,value);};
const close = async p=>{await p.keyboard.press('Escape'); await p.waitForTimeout(150);};
const notify = (p,id)=>p.evaluate(async id=>{await window._set(window._ref(window._db,`kanban/usuarios/eve/notificacoes/${id}`),{type:'mention',title:'Bia mencionou você',sub:'em Relatório',ts:new Date().toISOString(),read:false,cardId:'c2'});},id);
const read = (p,key)=>p.evaluate(key=>key.split('/').reduce((o,k)=>o?.[k],window.__store),key);
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser = await chromium.launch({executablePath:chrome,headless:true});
  const session = async(width=1280)=>{
    const ctx = await browser.newContext({viewport:{width,height:800}}); await fake.install(ctx,seed());
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
  const enable = async p=>{await p.click('#tb-timers'); await p.click('#ilha-ligar'); await p.waitForSelector('#ilha',{state:'visible'});};
  try {
    await run('padrão, timers e navegação',async({p})=>{
      check('desligada por padrão; sino visível',!await p.locator('#ilha').isVisible() && await p.locator('#notif-btn').isVisible());
      const badge=Number((await text(p,'#notif-badge')).trim()||0);
      const refs=await p.evaluate(()=>window.__ilhaRefs.length);
      const reads=await p.evaluate(()=>window.__log.filter(([op,key])=>['get','onValue'].includes(op) && key.startsWith('kanban/timers_ativos/')).length);
      await enable(p);
      check('ligar mostra atividade',await state(p)==='atividade',await state(p));
      check('atividade e tempo inicial de cinco minutos',await text(p,'#ilha-titulo')==='Revisar campanha' && /^0?5:0\d$/.test((await text(p,'#ilha-tempo')).trim()),await text(p,'#ilha-tempo'));
      check('segundo timer indicado por +1',await text(p,'#ilha-mais')==='+1');
      check('sino substituído pela ilha',!await p.locator('#notif-btn').isVisible());
      check('preferência por usuário no localStorage',await p.evaluate(()=>Object.keys(localStorage).some(k=>/ilha/i.test(k)&&k.includes('eve'))));
      check('contador reaproveita não lidas do sino',badge===1 && Number(await text(p,'#ilha-n b'))===badge,badge);
      check('notificação antiga nunca provoca aviso',await p.evaluate(()=>!window.__ilhaStates.includes('aviso')));
      await openPanel(p);
      check('abrir expande e lista dois timers',await state(p)==='aberta' && await p.getAttribute('#ilha-btn','aria-expanded')==='true' && await p.locator('.ilha-timer').count()===2);
      await tab(p,'notif'); check('aba notificações lista n1 e oferece ações do sino',await p.locator('.ilha-notif').count()===1 && await p.locator('#ilha-ler-tudo').isVisible() && await p.locator('#ilha-abrir-sino').isVisible());
      await tab(p,'timers'); await close(p);
      check('Esc recolhe e devolve foco',await state(p)!=='aberta' && await p.evaluate(()=>document.activeElement===document.getElementById('ilha-btn')));
      check('zero referências novas ao índice ao ligar e navegar',await p.evaluate(()=>window.__ilhaRefs.length)===refs,{antes:refs,depois:await p.evaluate(()=>window.__ilhaRefs.length)});
      await openPanel(p); await p.click(timer('t1','pausar'));
      check('pausar grava índice e registro do card',await until(p,()=>window.__store.kanban.timers_ativos.eve.t1.status==='pausado' && window.__store.kanban.squads.site.dados.card_timers.c1.t1.status==='pausado'));
      await p.click(timer('t1','continuar'));
      check('continuar grava rodando nos dois registros',await until(p,()=>window.__store.kanban.timers_ativos.eve.t1.status==='rodando' && window.__store.kanban.squads.site.dados.card_timers.c1.t1.status==='rodando'));
      check('continuar preserva iniciadoEm',await read(p,'kanban/squads/site/dados/card_timers/c1/t1/iniciadoEm')==='2026-11-10T08:00:00.000Z');
      await p.click(timer('t1','encerrar'));
      check('primeiro clique não encerra',!!await read(p,'kanban/timers_ativos/eve/t1'));
      await p.click(timer('t1','confirmar-encerrar'));
      check('confirmar remove índice e encerra registro',await until(p,()=>!window.__store.kanban.timers_ativos.eve.t1 && window.__store.kanban.squads.site.dados.card_timers.c1.t1.status==='encerrado'));
      check('avisa quem delegou com timestamp string',await until(p,()=>Object.values(window.__store.kanban.usuarios.ana.notificacoes||{}).some(n=>n.type==='timer_encerrado' && typeof n.ts==='string')));
      // Escritas também criam refs: após as ações, conte apenas get/onValue do SDK falso.
      check('ações não adicionam leitura ao índice já escutado',await p.evaluate(()=>window.__log.filter(([op,key])=>['get','onValue'].includes(op) && key.startsWith('kanban/timers_ativos/')).length)===reads);
      await p.click(timer('t2','abrir-card'));
      check('abrir card do mesmo squad mostra modal e recolhe ilha',await until(p,()=>document.getElementById('card-ov').classList.contains('open') && document.getElementById('ilha').dataset.estado!=='aberta'));
    });
    await run('avisos, DND e privado',async({p})=>{
      await enable(p);
      check('n1 não causou aviso na carga nem ao ligar',await p.evaluate(()=>!window.__ilhaStates.includes('aviso')));
      await notify(p,'n9');
      check('notificação nova vira aviso recolhido',await until(p,()=>document.getElementById('ilha').dataset.estado==='aviso' && document.getElementById('ilha-aviso-t').textContent.includes('Bia') && document.getElementById('ilha-btn').getAttribute('aria-expanded')==='false'));
      await p.waitForTimeout(5000); check('aviso permanece antes de sete segundos',await state(p)==='aviso');
      check('aviso volta a atividade em cerca de sete segundos',await until(p,()=>document.getElementById('ilha').dataset.estado==='atividade',null,3500));
      if(await p.evaluate(()=>typeof setDnd==='function' && typeof isDndActive==='function')){
        await p.evaluate(()=>setDnd(true,60,'1 hora'));
        check('DND realmente ativo',await p.evaluate(()=>isDndActive()));
        const n=Number(await text(p,'#ilha-n b')); await p.evaluate(()=>window.__ilhaStates=[]); await notify(p,'n10');
        check('DND atualiza contador',await until(p,n=>Number(document.querySelector('#ilha-n b').textContent)===n+1,n));
        await p.waitForTimeout(8000);
        check('DND não deixa aviso transitório',await p.evaluate(()=>!window.__ilhaStates.includes('aviso')));
        await p.evaluate(()=>setDnd(false));
      } else {skipped++; console.warn('⚠️ DND pulado: setDnd/isDndActive indisponíveis.');}
      await config(p,'#ilha-cfg-privado',true); await close(p);
      check('privado esconde título da pílula',(await text(p,'#ilha-titulo')).trim()==='');
      await notify(p,'n11');
      check('privado usa aviso genérico',await until(p,()=>document.getElementById('ilha').dataset.estado==='aviso' && document.getElementById('ilha-aviso-t').textContent==='Nova notificação'));
    });
    await run('preferências e modo mouse',async({p})=>{
      await enable(p);
      await config(p,'#ilha-cfg-reabrir','ultima'); await tab(p,'notif'); await close(p); await openPanel(p);
      check('reabrir última preserva aba notif',await p.locator('.ilha-aba[data-aba="notif"]').evaluate(e=>e.classList.contains('on')));
      await config(p,'#ilha-cfg-reabrir','timers'); await tab(p,'notif'); await close(p); await openPanel(p);
      check('reabrir timers ignora última aba notif',await p.locator('.ilha-aba[data-aba="timers"]').evaluate(e=>e.classList.contains('on')));
      await config(p,'#ilha-cfg-timer',false); await close(p);
      check('desmarcar timer tira título e relógio da pílula',await until(p,()=>{const a=document.getElementById('ilha-titulo'),b=document.getElementById('ilha-tempo'); const visible=e=>e && !!e.getClientRects().length && getComputedStyle(e).visibility!=='hidden'; return (!visible(a)||!a.textContent.trim()) && (!visible(b)||!b.textContent.trim());}));
      check('sem timer não existe relógio da ilha',await p.evaluate(()=>window.__ilhaTicks===0));
      await config(p,'#ilha-cfg-timer',true); await config(p,'#ilha-cfg-modo','mouse'); await close(p); await p.mouse.move(10,700);
      check('mouse: pílula oculta e fio transparente fora do alvo',await until(p,()=>{const b=document.getElementById('ilha-btn');return (!b.getClientRects().length || getComputedStyle(b).visibility==='hidden' || Number(getComputedStyle(b).opacity)===0) && Number(getComputedStyle(document.getElementById('ilha-fio')).opacity)===0;},null,2000));
      const box=await p.locator('#ilha-fio').boundingBox();
      if(!box) throw new Error('fio sem área para hover');
      await p.mouse.move(box.x+box.width/2,box.y+box.height/2);
      check('hover no fio revela botão',await until(p,()=>{const b=document.getElementById('ilha-btn');return !!b.getClientRects().length && getComputedStyle(b).visibility!=='hidden' && Number(getComputedStyle(b).opacity)>0;}));
      await p.mouse.move(10,700);
      check('sair esconde botão em até dois segundos',await until(p,()=>{const b=document.getElementById('ilha-btn'); return !b.getClientRects().length || getComputedStyle(b).visibility==='hidden' || Number(getComputedStyle(b).opacity)===0;},null,2000));
      await p.mouse.move(box.x+box.width/2,box.y+box.height/2); await tab(p,'ajustes'); await p.click('#ilha-desligar');
      check('desligar esconde ilha e restaura sino',await until(p,()=>{const a=document.getElementById('ilha'),b=document.getElementById('notif-btn');return (!a.getClientRects().length || getComputedStyle(a).visibility==='hidden') && !!b.getClientRects().length && getComputedStyle(b).visibility!=='hidden';}));
    });
    for(const width of [1280,390]) for(const theme of ['dark','light','vice','blackfriday']) await run(`${width}/${theme}`,async({p})=>{
      await enable(p); await p.evaluate(t=>document.documentElement.setAttribute('data-theme',t),theme); await openPanel(p);
      await p.waitForTimeout(250);
      const layout=await p.evaluate(()=>{const panel=document.getElementById('ilha-painel'),r=panel.getBoundingClientRect();return {overflow:document.documentElement.scrollWidth-innerWidth,panelOverflow:panel.scrollWidth-panel.clientWidth,left:r.left,right:r.right,width:innerWidth};});
      check(`${width}/${theme}: painel aberto e sem rolagem lateral`,await state(p)==='aberta' && layout.overflow<=1 && layout.panelOverflow<=1 && layout.left>=-1 && layout.right<=layout.width+1,layout);
      await p.screenshot({path:path.join(out,`ilha_${width}_${theme}.png`)});
    },width);
  } finally {await browser.close();}
  console.log(`\n${assertions} asserções, ${failures} falha(s), ${skipped} cenário(s) pulado(s).`); process.exitCode=failures?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
