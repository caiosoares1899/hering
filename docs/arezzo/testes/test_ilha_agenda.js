// Base V2 da Ilha: boot real + Firebase falso, sem acessar banco real.
// Na raiz: python3 -m http.server 8953
// Depois: node docs/arezzo/testes/test_ilha_agenda.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const chromeRoot = path.join(home, 'hering-tools/chrome');
const chrome = process.env.CHROME || path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n=>n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8953';
const U = {uid:'eve',email:'eve@ciahering.com.br',displayName:'Eve',photoURL:'',providerData:[{providerId:'google.com'}]};
const seed = ()=>({kanban:{usuarios:{eve:{uid:'eve',nome:'Eve',email:U.email,init:'EV',role:'membro',inscrito:true,squads:{site:true,dados:true}}},squads_meta:{site:{label:'Squad Site'},dados:{label:'Squad Dados'}},squads:{site:{dados:{columns:[{id:'doing',name:'Fazendo'}],cards_index:{c1:'k0',c2:'k1'},cards:{k0:{id:'c1',title:'Banner',col:'doing'},k1:{id:'c2',title:'Relatório',col:'doing'}}}},dados:{dados:{columns:[{id:'doing',name:'Fazendo'}],cards:{}}}}}});

// Relógio local determinístico: 11/11 às 10h. Nunca consulta Firebase real.
const NOW = new Date(2026,10,11,10,0,0).getTime();
const fmt=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const day=n=>{const d=new Date(NOW);d.setDate(d.getDate()+n);return fmt(d);};
const EVENTS='kanban/okr/calendario/eventos', OBJECTIVES='kanban/okr/objetivos';
const agendaSeed=()=>{
  const s=seed(), ev=(titulo,n,extra={})=>({titulo,data:day(n),tipo:'evento',hi:'09:00',hf:'10:00',convidados:['eve'],...extra});
  s.kanban.okr={objetivos:{o1:{id:'o1',torre:'digital',responsaveis:['eve'],titulo:'Meta'},o2:{id:'o2',torre:'digital',responsaveis:['outro'],titulo:'Outra meta'}},calendario:{eventos:{
    e1:ev('Reunião de hoje',0,{tipo:'reuniao',hi:'10:10',hf:'10:40'}),
    e2:ev('Reunião de outra pessoa',0,{convidados:['outro']}),
    e3:ev('Semanal',-21,{rec:{unidade:'semana',intervalo:1,ate:day(14)},excecoes:{[day(0)]:true}}),
    e4:ev('Entrega concluída',1,{tipo:'entrega',status:'entregue'}),
    e5:ev('<img src=x onerror=alert(1)>Offsite',3,{link:'javascript:alert(1)'}),
    e6:ev('Reunião da torre',4,{tipo:'reuniao',torre:'digital',convidados:[]}),
    e7:ev('Evento da torre',4,{torre:'digital',convidados:[]}),
    e8:ev('Reunião de outro objetivo',4,{tipo:'reuniao',torre:'digital',objetivoIds:['o2'],convidados:[]})
  }}};return s;
};
let assertions=0,failures=0;
const check=(name,pass,detail)=>{assertions++;if(!pass)failures++;console.log((pass?'✅ ':'❌ ')+name+(pass?'':' → '+JSON.stringify(detail)));};
const login=async p=>{
  await p.waitForFunction(()=>!!window.__authCb && !!window._get && !!window.__ilha);
  // Os wrappers são instalados ANTES do callback de autenticação, inclusive no reload.
  await p.evaluate(()=>{
    window.__agendaCalls={get:{},onValue:{}};
    for(const [alias,tipo] of [['_get','get'],['_onValue','onValue']]){
      const orig=window[alias];window[alias]=function(r,...args){const c=window.__agendaCalls[tipo];c[r.p]=(c[r.p]||0)+1;return orig.call(this,r,...args);};
    }
  });
  await p.evaluate(u=>window.__authCb(u),U);
  await p.waitForFunction(()=>window._currentUser?.uid==='eve');
  await p.clock.fastForward(3000);
  await p.evaluate(()=>{document.querySelectorAll('.ov.open').forEach(o=>o.classList.remove('open'));window.__ilha.ligar();});
};
const tab=async(p,id)=>{
  // os saltos do relógio falso disparam a trava 🧊 de sessão velha do Maré (testada à parte): fora do escopo deste teste
  await p.evaluate(()=>{document.getElementById('_au-block')?.remove();window._auStale=false;if(!_ilha.aberta)_ilhaAbrir();});
  await p.locator(`.ilha-aba[data-aba="${id}"]`).evaluate(e=>e.click());
};
const count=(p,tipo='get')=>p.evaluate(({tipo,EVENTS})=>window.__agendaCalls[tipo][EVENTS]||0,{tipo,EVENTS});
const objectives=(p,tipo='get')=>p.evaluate(({tipo,OBJECTIVES})=>window.__agendaCalls[tipo][OBJECTIVES]||0,{tipo,OBJECTIVES});
const choose=async p=>{await tab(p,'ajustes');await p.selectOption('#ilha-cfg-principal','agenda');};
const row=(p,id)=>p.locator(`[data-ag-id="${id}"]`).first();
(async()=>{
  const browser=await chromium.launch({executablePath:chrome,headless:true}),sessions=[];
  const session=async mobile=>{
    const ctx=await browser.newContext({viewport:{width:mobile?390:1280,height:800},hasTouch:mobile,isMobile:mobile});
    const s={ctx,errors:[],dialogs:[]};sessions.push(s);await fake.install(ctx,agendaSeed());
    const p=s.p=await ctx.newPage();p.setDefaultTimeout(10000);
    p.on('pageerror',e=>s.errors.push(e.message));p.on('dialog',async d=>{s.dialogs.push(d.message());await d.dismiss();});
    await p.clock.install({time:new Date(NOW)});await p.clock.pauseAt(new Date(NOW));
    await p.goto(base+'/kanban-dev.html?squad=site');await login(p);return s;
  };
  try{
    const {p}=await session(false);await tab(p,'ajustes');
    check('Agenda existe desmarcada',await p.locator('#ilha-cfg-mod-agenda').count()===1 && !await p.isChecked('#ilha-cfg-mod-agenda'));
    check('desligada: zero leituras de calendário',await p.evaluate(()=>Object.entries(window.__agendaCalls.get).filter(([k])=>k.includes('okr/calendario')).every(([,n])=>n===0)));
    await p.check('#ilha-cfg-mod-agenda');await p.waitForFunction(()=>_ilhaAgd.pronta);
    check('um get por nó sem escuta',await count(p)===1 && await objectives(p)===1 && await count(p,'onValue')===0 && await objectives(p,'onValue')===0);
    await tab(p,'agenda');
    check('mantém convidados e entregas pendentes',await row(p,'e1').count()===1 && await row(p,'e3').count()===1 && await row(p,'e5').count()===1 && await row(p,'e2').count()===0 && await row(p,'e4').count()===0);
    check('reunião sem recorte inclui responsável da torre',await row(p,'e6').count()===1);
    check('evento sem vínculo e reunião de outro objetivo ficam fora',await row(p,'e7').count()===0 && await row(p,'e8').count()===0);
    check('cópia s:2 guarda só compromissos',await p.evaluate(()=>{const c=JSON.parse(localStorage.getItem(_ilhaAgChave()));return c.s===2 && !('objetivos' in c) && c.v.every(e=>!('responsaveis' in e));}));
    check('recorrência pula exceção e mantém próxima semana',await row(p,'e3').getAttribute('data-ag-data')===day(7));
    await choose(p);
    check('reunião começa em 10 min',await p.locator('#ilha-titulo').textContent()==='Reunião de hoje' && await p.locator('#ilha-tempo').textContent()==='em 10 min');
    await p.clock.fastForward(11*60000);
    check('11 min depois: agora',await p.locator('#ilha-tempo').textContent()==='agora');
    await p.reload();await login(p);await p.waitForFunction(()=>_ilhaAgd.pronta);
    check('reload usa cópia válida',await count(p)===0 && await objectives(p)===0);
    await p.evaluate(()=>{_ilhaAgd.t-=3*3600000+60000;_ilhaAgd.tentativa=0;});await p.clock.fastForward(61000);await p.waitForFunction(()=>!_ilhaAgd.lendo);
    check('cópia vence ligada: um get novo por nó',await count(p)===1 && await objectives(p)===1);
    await tab(p,'agenda');
    check('título hostil é texto', (await row(p,'e5').textContent()).includes('<img src=x onerror=alert(1)>Offsite') && await p.locator('#ilha-painel img').count()===0);
    check('javascript não oferece Entrar',await row(p,'e5').getByRole('link',{name:'Entrar',exact:true}).count()===0);
    const radar=row(p,'e5').getByRole('link',{name:'Abrir no Radar'});
    check('Radar dev com ocorrência e proteção',/okr-dev\.html\?evento=e5&data=/.test(await radar.getAttribute('href')) && await radar.getAttribute('target')==='_blank' && await radar.getAttribute('rel')==='noopener');
    for(let i=0;i<6;i++){ await p.mouse.move(200+i,200); await p.clock.fastForward(5*60000); }   // e1 vai das 10:10 às 10:40: passa do fim (mexendo o mouse, senão a tela congela por inatividade)
    await row(p,'e5').locator('[data-ag-contar]').evaluate(e=>e.click());await choose(p);
    check('contagem escolhida aparece após reunião',await p.locator('#ilha-ico').textContent()==='⏳' && /^[23]d \d+h$/.test(await p.locator('#ilha-tempo').textContent()));
    await tab(p,'agenda');
    check('contagem está pressionada',await row(p,'e5').locator('[data-ag-contar]').getAttribute('aria-pressed')==='true');
    await row(p,'e5').getByRole('button',{name:'Parar contagem'}).evaluate(e=>e.click());
    check('parar remove a preferência',await p.evaluate(()=>!_ilhaPrefs().agendaContagem));
    // Deixa passar o limite da leitura automática antes da atualização manual.
    await p.clock.fastForward(60000);await tab(p,'agenda');const antes=await count(p);
    await p.locator('[data-ag-atualizar]').evaluate(e=>e.click());await p.waitForFunction(()=>!_ilhaAgd.lendo);
    await p.locator('[data-ag-atualizar]').evaluate(e=>e.click());
    check('duas atualizações: um get extra por nó',await count(p)===antes+1 && await objectives(p)===antes+1);
    await p.evaluate(async()=>{await window._update(window._ref(window._db,'kanban/okr/objetivos/o1'),{arquivado:true});});
    await p.clock.fastForward(60000);await tab(p,'agenda');
    await p.locator('[data-ag-atualizar]').evaluate(e=>e.click());await p.waitForFunction(()=>!_ilhaAgd.lendo);
    check('objetivo arquivado deixa de incluir reunião da torre',await row(p,'e6').count()===0 && await row(p,'e5').count()===1);   // e1 já terminou a esta altura (10:40); e5 segue no futuro
    await row(p,'e5').locator('[data-ag-contar]').evaluate(e=>e.click());await choose(p);await p.check('#ilha-cfg-privado');
    check('privado oculta título na principal e secundária',await p.evaluate(()=>{const titulo='<img src=x onerror=alert(1)>Offsite';return !document.getElementById('ilha-titulo').textContent.includes(titulo) && !document.getElementById('ilha-sec').textContent.includes(titulo) && document.getElementById('ilha-titulo').textContent==='';}));
    await p.uncheck('#ilha-cfg-mod-agenda');
    check('desligar elimina intervalo e aba',await p.evaluate(()=>window.__ilhaAgendaTick===0) && await p.locator('.ilha-aba[data-aba="agenda"]').count()===0);
    const desligado=await count(p), objetivosDesligado=await objectives(p);await p.evaluate(()=>{_ilhaAgd.t=0;_ilhaAgd.tentativa=0;});await p.clock.fastForward(61000);   // envelhece a cópia sem saltar horas (salto grande recarrega a tela velha)
    check('desligado não atualiza cópia',await count(p)===desligado && await objectives(p)===objetivosDesligado);
    const mobile=await session(true), m=mobile.p;await tab(m,'ajustes');await m.check('#ilha-cfg-mod-agenda');await m.waitForFunction(()=>_ilhaAgd.pronta);await tab(m,'agenda');
    check('390px toque: sem rolagem lateral',await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth && document.getElementById('ilha-painel').scrollWidth<=document.getElementById('ilha-painel').clientWidth));
    check('ações Agenda têm 44px',await m.locator('.ilha-agenda button,.ilha-agenda a').evaluateAll(es=>es.length>0 && es.every(e=>e.getBoundingClientRect().height>=44)));
  }catch(e){check('contrato executável',false,e.stack||e.message);}
  finally{
    for(const s of sessions){check('nenhum dialog',s.dialogs.length===0,s.dialogs);check('nenhum pageerror',s.errors.length===0,s.errors);await s.ctx.close();}
    await browser.close();console.log(`\n${assertions} asserções, ${failures} falha(s)`);process.exitCode=failures?1:0;
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
