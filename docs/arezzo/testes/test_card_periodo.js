// Período e hora: boot real + Firebase falso, sem acessar dados reais.
// Maestro: servir a raiz em BASE_URL; node docs/arezzo/testes/test_card_periodo.js.
// MAIN_HTML permite provar a falha na versão anterior sem trocar arquivos no disco.
const fs = require('node:fs');
const path = require('node:path');
const home = require('node:os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home,'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const chromeRoot = path.join(home,'hering-tools/chrome');
const chrome = process.env.CHROME || path.join(chromeRoot,fs.readdirSync(chromeRoot).find(n=>n.startsWith('mac_arm-')),'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8947';
const user = {uid:'teste',email:'teste@ciahering.com.br',displayName:'Pessoa fictícia',providerData:[{providerId:'google.com'}]};
const seed = () => ({kanban:{usuarios:{teste:{nome:user.displayName,email:user.email,init:'TT',role:'adm',inscrito:true,squads:{site:true}}},config:{adm_emails:[user.email]},squads:{site:{dados:{columns:[{id:'doing',name:'Em andamento'},{id:'done',name:'Concluído',isDone:true}],cards_index:{c1:'k0'},cards:{k0:{id:'c1',title:'Card antigo sem período',col:'doing',due:'2026-11-20',owner:'TT',desc:'',updatedAt:'2026-11-09T12:00:00.000Z'}}}}}}});
let failures=0;
const check=(name,pass,detail)=>{ console.log(`${pass?'✅':'❌'} ${name}${pass?'':' '+JSON.stringify(detail)}`); if(!pass) failures++; };
const getCard=(p,id)=>p.evaluate(id=>Object.values(window.__store.kanban.squads.site.dados.cards).find(c=>c&&c.id===id),id);
const waitCard=(p,id,expected)=>p.waitForFunction(({id,expected})=>{
 const c=Object.values(window.__store.kanban.squads.site.dados.cards).find(c=>c&&c.id===id);
 return c&&Object.entries(expected).every(([k,v])=>c[k]===v);
},{id,expected});
const open=(p,id)=>p.evaluate(id=>openCard(id),id).then(()=>p.waitForTimeout(200));
const setDates=(p,d)=>p.evaluate(d=>{for(const [f,v] of Object.entries(d)) document.getElementById('m-'+f).value=v;},d);
const save=(p)=>p.evaluate(()=>saveCard()).then(()=>p.waitForFunction(()=>!document.getElementById('card-ov').classList.contains('open')));
(async()=>{
 const browser=await chromium.launch({executablePath:chrome,headless:true});
 try {
  for(const width of [1280,390]){
   const ctx=await browser.newContext({viewport:{width,height:900},hasTouch:width===390,isMobile:width===390});
   await fake.install(ctx,seed());
   if(process.env.MAIN_HTML) await ctx.route('**/kanban-dev.html?*',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(process.env.MAIN_HTML,'utf8')}));
   const p=await ctx.newPage(); p.setDefaultTimeout(10000);
   const errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.goto(base+'/kanban-dev.html?squad=site');
   await p.waitForFunction(()=>!!window.__authCb);await p.evaluate(u=>window.__authCb(u),user);await p.waitForTimeout(2200);
   await p.evaluate(()=>{
    document.querySelectorAll('.ov.open').forEach(e=>e.classList.remove('open'));
    // O fake serializa JSON: cheque ANTES da serialização, para não mascarar undefined.
    window.__undefinedWrites=[];
    const inspect=(v,p='')=>{if(v===undefined) window.__undefinedWrites.push(p);else if(v&&typeof v==='object') Object.entries(v).forEach(([k,x])=>inspect(x,p+'.'+k));};
    const set=window._set,update=window._update,tx=window._runTransaction;
    window._set=(r,v)=>{inspect(v,r.p);return set(r,v);};
    window._update=(r,v)=>{inspect(v,r.p);return update(r,v);};
    window._runTransaction=(r,fn,...args)=>tx(r,v=>{const next=fn(v);if(next!==undefined)inspect(next,r.p);return next;},...args);
   });
   const label=width+'px';
   await open(p,'c1');
   check(label+' card antigo abre limpo',await p.evaluate(()=>!_cardIsDirty()&&['inicio','fim','dueHora'].every(f=>document.getElementById('m-'+f).value==='')));
   const closed=await p.evaluate(()=>{
    const original=uiConfirm;let calls=0;uiConfirm=()=>{calls++;return Promise.resolve(false);};
    closeOv('card-ov');uiConfirm=original;
    return calls===0&&!document.getElementById('card-ov').classList.contains('open');
   });
   check(label+' fechar card antigo não pede confirmação',closed);
   await open(p,'c1');
   // /melhoriauiux 12/11 (2ª): as datas novas num cartão "📅 Período e hora" embaixo de Riscos; Prazo segue onde o time conhece.
   const lay=await p.evaluate(()=>{const r=id=>document.getElementById(id).getBoundingClientRect();const due=r('m-due'),hora=r('m-dueHora'),ini=r('m-inicio'),fim=r('m-fim');
    const sec=document.getElementById('m-periodo-sec'),riscos=document.getElementById('m-riscos-sec');
    return {noCartao:['m-inicio','m-fim','m-dueHora','m-periodo-aviso'].every(id=>sec&&sec.contains(document.getElementById(id))),
     prazoFora:!!sec&&!sec.contains(document.getElementById('m-due')),depoisDeRiscos:!!sec&&riscos.nextElementSibling===sec,
     linha:Math.abs(ini.top-fim.top)<=1&&fim.left>ini.left,horaEmbaixo:hora.top>ini.top&&Math.abs(hora.left-ini.left)<=1,
     botaoNaLinha:(()=>{const b=document.querySelector('#m-due + .dp-btn').getBoundingClientRect();return Math.abs((b.top+b.height/2)-(due.top+due.height/2))<=3&&b.left>due.left;})(),
     secao:CARD_SECTIONS.some(x=>x.key==='periodo'&&x.id==='m-periodo-sec')};});
   check(label+' cartão 📅 Período e hora embaixo de Riscos (Início|Fim, Hora), Prazo no lugar de sempre',Object.values(lay).every(Boolean),lay);
   for(const theme of ['','light','vice']){
    await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    const overflow=await p.evaluate(()=>{const el=document.querySelector('#card-ov .card-panel');return el.scrollWidth-el.clientWidth;});
    check(label+'/'+(theme||'dark')+' modal sem rolagem lateral',overflow<=1,overflow);
   }
   const first={inicio:'2026-11-10',fim:'2026-11-20',dueHora:'14:00'};
   // Eventos reais: os onchange devem agendar o autosave, sem chamar o salvamento no teste.
   for(const [f,v] of Object.entries(first)){await p.locator('#m-'+f).fill(v);await p.locator('#m-'+f).dispatchEvent('change');}
   await waitCard(p,'c1',first);
   await p.waitForFunction(()=>!_cardIsDirty());
   const auto=await getCard(p,'c1');
   check(label+' autosave grava três campos e mantém due',auto.due==='2026-11-20'&&Object.entries(first).every(([k,v])=>auto[k]===v),auto);
   check(label+' histórico contém três entradas legíveis',['Início: — → 10/11','Fim: — → 20/11','Hora do prazo: — → 14:00'].every(t=>auto.history.some(h=>h.what===t)),auto.history);
   check(label+' board mostra período e hora',await p.evaluate(()=>{const el=makeCardEl(cards.find(c=>c.id==='c1'));return el.querySelector('.card-periodo').textContent==='10/11 → 20/11'&&el.querySelector('.due-badge').textContent.includes('· 14:00');}));
   check(label+' campos do banco entram no board sem HTML executável',await p.evaluate(()=>{
    const el=makeCardEl({...cards.find(c=>c.id==='c1'),inicio:'<img src=x onerror=alert(1)>',fim:'<svg onload=alert(1)>',dueHora:'<img src=x onerror=alert(1)>'});
    return !el.querySelector('[onerror],[onload]')&&el.querySelector('.due-badge').textContent.includes('<img');
   }));
   await p.evaluate(()=>closeOv('card-ov'));await open(p,'c1');
   check(label+' reabrir preenche três campos',await p.evaluate(d=>Object.entries(d).every(([f,v])=>document.getElementById('m-'+f).value===v),first));
   const manual={inicio:'2026-11-12',fim:'2026-11-22',dueHora:'16:30'};
   await setDates(p,manual); // Sem eventos: garante que foi o botão Salvar, não o autosave.
   check(label+' datas participam da trava de alterações',await p.evaluate(()=>_cardIsDirty()));
   await save(p);await waitCard(p,'c1',manual);
   const edited=await getCard(p,'c1');
   check(label+' Salvar manual e histórico',edited.history.some(h=>h.what==='Início: 10/11 → 12/11')&&edited.history.some(h=>h.what==='Fim: 20/11 → 22/11')&&edited.history.some(h=>h.what==='Hora do prazo: 14:00 → 16:30'),edited.history);
   await open(p,'c1');
   await p.locator('#m-fim').fill('2026-11-01');await p.locator('#m-fim').dispatchEvent('change');
   await p.waitForTimeout(1300);
   check(label+' Fim inválido avisa e não substitui o salvo',await p.locator('#m-periodo-aviso').isVisible()&&(await getCard(p,'c1')).fim===manual.fim);
   await setDates(p,{fim:manual.fim});await p.evaluate(()=>closeOv('card-ov'));
   // Duplicação real e persistência no fake.
   const copyId=await p.evaluate(async()=>{const copy=_duplicarCardObj(cards.find(c=>c.id==='c1'),{comments:false});await fbCreateCard(copy);return copy.id;});
   const copy=await getCard(p,copyId);
   check(label+' duplicar copia três campos',Object.entries(manual).every(([k,v])=>copy[k]===v),copy);
   for(const [title,dates] of [['Novo com período',first],['Novo sem período',{inicio:'',fim:'',dueHora:''}],['Novo com Fim inválido',{inicio:'2026-11-20',fim:'2026-11-10',dueHora:'10:00'}]]){
    await p.evaluate(()=>openNewCard('doing'));
    check(label+'/'+title+' campos limpos ao criar',await p.evaluate(()=>Object.values(_cardDatasNow()).every(v=>v==='')));
    await p.evaluate(title=>{document.getElementById('m-title').value=title;document.getElementById('m-due').value='2026-11-25';},title);
    await setDates(p,dates);await save(p);
    const novo=await p.evaluate(title=>Object.values(window.__store.kanban.squads.site.dados.cards).find(c=>c&&c.title===title),title);
    const expected={...dates,fim:dates.fim<dates.inicio?'':dates.fim};
    check(label+'/'+title+' criação grava campos normalizados',!!novo&&Object.entries(expected).every(([k,v])=>novo[k]===v),novo);
   }
   // Atualização recebida com modal aberto não pode ser desfeita por outra edição.
   await open(p,'c1');
   const synced=await p.evaluate(()=>{
    const c=cards.find(c=>c.id==='c1');Object.assign(c,{inicio:'2026-12-01',fim:'2026-12-10',dueHora:'09:00'});_modalSyncCol();
    const ok=Object.entries({inicio:c.inicio,fim:c.fim,dueHora:c.dueHora}).every(([f,v])=>document.getElementById('m-'+f).value===v)&&!_cardIsDirty();
    document.getElementById('m-dueHora').value='11:00';c.dueHora='12:00';_modalSyncCol();
    return ok&&document.getElementById('m-dueHora').value==='11:00';
   });
   check(label+' sincronização acompanha campos intocados e preserva rascunho',synced);
   await setDates(p,manual);await save(p);
   // Itens reutilizáveis não recebem as datas da ocorrência, inclusive na edição completa.
   for(const tipo of ['modelos','recorrentes','agendamentos']){
    await p.evaluate(tipo=>{qlItems[tipo]=[{title:'Item '+tipo,col:'doing',owner:'TT'}];currentQL=tipo;openQLEdit(0);},tipo);
    await setDates(p,first);await save(p);
    const item=await p.evaluate(tipo=>window.__store.kanban.squads.site.dados.ql_items[tipo][0],tipo);
    check(label+'/'+tipo+' não guarda datas',item&&['inicio','fim','dueHora'].every(f=>!Object.hasOwn(item,f)),item);
   }
   check(label+' nenhum undefined enviado ao banco',await p.evaluate(()=>window.__undefinedWrites.length===0),await p.evaluate(()=>window.__undefinedWrites));
   check(label+' sem erro de JavaScript',errors.length===0,errors);
   await ctx.close();
  }
 }finally{await browser.close();}
 console.log(`${failures} falha(s)`);process.exitCode=failures?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
