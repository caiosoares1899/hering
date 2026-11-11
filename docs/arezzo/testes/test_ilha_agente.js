// Ilha V2 · Agente Ágil: boot real e Firebase falso, sem acessar banco real.
// Na raiz: python3 -m http.server 8953
// Depois: node docs/arezzo/testes/test_ilha_agente.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const chromeRoot = path.join(home, 'hering-tools/chrome');
const chrome = process.env.CHROME || path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n=>n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8953';
const U = {uid:'eve',email:'eve@ciahering.com.br',displayName:'Eve',photoURL:'',providerData:[{providerId:'google.com'}]};
const seed = ()=>({kanban:{usuarios:{eve:{uid:'eve',nome:'Eve',email:U.email,init:'EV',role:'membro',inscrito:true,squads:{site:true,dados:true}}},squads_meta:{site:{label:'Squad Site'},dados:{label:'Squad Dados'}},squads:{site:{dados:{columns:[{id:'doing',name:'Fazendo'}],cards_index:{c1:'k0',c2:'k1'},cards:{k0:{id:'c1',title:'Banner',col:'doing'},k1:{id:'c2',title:'Relatório',col:'doing'}}}},dados:{dados:{columns:[{id:'doing',name:'Fazendo'}],cards:{}}}}}});
const agenteSeed=()=>{
  const s=seed();
  s.kanban.timers_ativos={eve:{t1:{sq:'site',cardId:'c2',cardTitle:'Relatório',atividade:'Relatório semanal',tipo:'cronometro',status:'rodando',startedAt:Date.now()-300000,accMs:0,porUid:'eve'}}};
  return s;
};
let assertions=0, failures=0;
const check=(name,pass,detail)=>{assertions++;if(!pass) failures++;console.log((pass?'✅ ':'❌ ')+name+(pass?'':' → '+JSON.stringify(detail)));};
const login=async p=>{
  await p.waitForFunction(()=>!!window.__authCb && !!window._onValue && !!window.__ilha);
  // Conta escutas ATIVAS antes do boot autenticado; não confundir com o total de chamadas.
  await p.evaluate(()=>{
    window.__agAtivas={}; const original=window._onValue;
    window._onValue=function(r,cb,...args){
      const caminho=r.p, cont=window.__agAtivas; cont[caminho]=(cont[caminho]||0)+1;
      let ativa=true; const off=original.call(this,r,(...v)=>{if(ativa) cb(...v);},...args);
      return ()=>{if(!ativa)return;ativa=false;cont[caminho]--;off();};
    };
  });
  await p.evaluate(u=>window.__authCb(u),U);await p.waitForTimeout(3000);
  await p.evaluate(()=>document.querySelectorAll('.ov.open').forEach(o=>o.classList.remove('open')));
};
const tab=async(p,id)=>{
  await p.evaluate(()=>{if(! _ilha.aberta) _ilhaAbrir();});
  await p.locator(`.ilha-aba[data-aba="${id}"]`).evaluate(e=>e.click());
};
const raiz='kanban/usuarios/eve/', analisando=raiz+'agente_analisando';
const count=p=>p.evaluate(c=>window.__agAtivas[c]||0,analisando);
const set=async(p,c,d)=>{await p.evaluate(async({c,d})=>{document.activeElement?.blur();await window._set(window._ref(window._db,c),d);},{c,d});await p.waitForTimeout(100);};
const remove=async(p,c)=>{await p.evaluate(c=>window._remove(window._ref(window._db,c)),c);await p.waitForTimeout(100);};
const marker=(ms=40000)=>({squad:'site',cardId:'c1',desde:new Date(Date.now()-ms).toISOString()});
const principal=async(p,id)=>{await p.evaluate(()=>_ilhaAbrir());await tab(p,'ajustes');await p.selectOption('#ilha-cfg-principal',id);};
const noActivity=p=>p.evaluate(()=>!_ilhaModsCand().some(c=>c.mod==='agente') && !document.getElementById('ilha-ico').textContent.includes('🤖') && (document.getElementById('ilha-sec').hidden || !document.getElementById('ilha-sec').textContent.includes('🤖')) && window.__ilhaAgTick===0);
const cardOpened=async p=>{
  await p.waitForSelector('#card-ov.open');
  return await p.inputValue('#m-title')==='Banner' && await p.evaluate(()=>!_ilha.aberta && document.getElementById('ilha').dataset.estado!=='aberta');
};
(async()=>{
  const sessions=[];let browser;
  try{
    browser=await chromium.launch({executablePath:chrome,headless:true});
    const session=async mobile=>{
      const ctx=await browser.newContext({viewport:{width:mobile?390:1280,height:800},hasTouch:mobile,isMobile:mobile});
      const s={ctx,errors:[],dialogs:[]};sessions.push(s);await fake.install(ctx,agenteSeed());
      const p=s.p=await ctx.newPage();p.setDefaultTimeout(10000);
      p.on('pageerror',e=>s.errors.push(e.message));p.on('dialog',async d=>{s.dialogs.push(d.message());await d.dismiss();});
      await p.goto(base+'/kanban-dev.html?squad=site');await login(p);await p.evaluate(()=>window.__ilha.ligar());return s;
    };
    const {p}=await session(false);await tab(p,'ajustes');
    check('Agente existe desmarcado',await p.locator('#ilha-cfg-mod-agente').count()===1 && !await p.isChecked('#ilha-cfg-mod-agente'));
    check('desligado: nenhuma escuta de análise',await count(p)===0);
    await p.check('#ilha-cfg-mod-agente');await p.waitForTimeout(100);
    check('ligado: exatamente uma escuta ativa',await count(p)===1);
    await tab(p,'agente');
    const vazio=await p.locator('#ilha-painel').textContent();
    check('aba Agente traz os dois vazios',vazio.includes('Nenhuma menção ao agente em andamento.') && vazio.includes('Nenhuma resposta nova do agente.'));
    check('sem marcadores: sem atividade nem relógio',await noActivity(p));
    await set(p,analisando+'/cm1',marker());await principal(p,'agente');
    const titulo=await p.locator('#ilha-titulo').textContent();
    check('análise principal identifica Banner',titulo.includes('Agente analisando') && titulo.includes('Banner'));
    check('análise mostra segundos reais e liga relógio',/^\d+ s$/.test(await p.locator('#ilha-tempo').textContent()) && await p.evaluate(()=>window.__ilhaAgTick===1));
    await tab(p,'agente');
    check('aba lista Banner com botão do card',await p.locator('[data-ag-card="site|c1"]').count()===1 && (await p.locator('#ilha-painel').textContent()).includes('Banner'));
    await set(p,analisando+'/outro',{squad:'dados',cardId:'x9',desde:new Date().toISOString()});
    const outro=await p.locator('#ilha-painel').textContent();
    check('outro squad mostra label sem vazar id',outro.includes('card em Squad Dados') && !outro.includes('x9'));
    await remove(p,analisando);
    for(const [id,v] of Object.entries({velho:marker(15*60000),dataRuim:{...marker(),desde:'lixo'},squadRuim:{...marker(),squad:1},incompleto:{squad:1}})){
      await set(p,analisando+'/'+id,v);
      check(id+': ignorado sem atividade e sem linha na aba',await noActivity(p) && await p.locator('[data-ag-card]').count()===0 && await p.evaluate(()=>_ilhaAgAnalisando().length===0));
      await remove(p,analisando+'/'+id);
    }
    await remove(p,analisando);
    const nid='mention_c1_eve_cm1', sub='<img src=x onerror=alert(1)>Resumo pronto';
    await set(p,raiz+'notificacoes/'+nid,{id:nid,type:'mention',title:'🤖 Agente Ágil respondeu sua menção',sub,cardId:'c1',squad:'site',ts:new Date().toISOString(),read:false});
    // Abrir Ajustes limpa o aviso transitório de notificação antes de conferir a pílula.
    await principal(p,'timer');
    check('timer principal mantém resposta pronta na secundária',await p.evaluate(()=>_ilhaAtividades().pri?.mod==='timer' && _ilhaAtividades().sec?.prio===75 && !document.getElementById('ilha-sec').hidden && document.getElementById('ilha-sec').textContent.includes('🤖')));
    await principal(p,'agente');
    check('resposta pronta principal e relógio parado',await p.locator('#ilha-titulo').textContent()==='Resposta do agente pronta' && await p.evaluate(()=>window.__ilhaAgTick===0));
    await tab(p,'agente');
    check('resumo é texto, sem imagem, com botão de resposta',(await p.locator('#ilha-painel').textContent()).includes(sub) && await p.locator('#ilha-painel img').count()===0 && await p.locator('[data-ag-resp="'+nid+'"]').count()===1);
    await p.locator('[data-ag-resp="'+nid+'"]').click();
    check('Ver resposta abre c1 e fecha ilha',await cardOpened(p));
    await p.keyboard.press('Escape');await remove(p,raiz+'notificacoes/'+nid);
    await set(p,raiz+'notificacoes/mention_c2_eve_x',{id:'mention_c2_eve_x',type:'mention',title:'💬 Ana mencionou você',cardId:'c2',squad:'site',ts:new Date().toISOString(),read:false});
    await tab(p,'agente');
    check('menção humana não vira resposta pronta',await p.evaluate(()=>_ilhaAgProntas().length===0) && await p.locator('[data-ag-resp]').count()===0 && !(await p.locator('#ilha-titulo').textContent()).includes('Resposta do agente pronta'));
    await set(p,analisando+'/cm1',marker());
    await p.locator('[data-ag-card="site|c1"]').click();
    check('Abrir o card da análise abre c1 e fecha ilha',await cardOpened(p));
    await p.keyboard.press('Escape');await tab(p,'ajustes');await p.uncheck('#ilha-cfg-mod-agente');
    check('desligar encerra escuta ativa',await count(p)===0);
    check('desligar remove aba, atividade e relógio',await p.locator('.ilha-aba[data-aba="agente"]').count()===0 && await noActivity(p));
    const mobile=await session(true);await tab(mobile.p,'ajustes');await mobile.p.check('#ilha-cfg-mod-agente');
    await set(mobile.p,analisando+'/cm1',marker());await tab(mobile.p,'agente');
    check('390px com toque: aba Agente sem rolagem lateral',await mobile.p.evaluate(()=>navigator.maxTouchPoints>0 && innerWidth===390 && document.documentElement.scrollWidth<=innerWidth && document.getElementById('ilha-painel').scrollWidth<=document.getElementById('ilha-painel').clientWidth));
  }catch(e){check('contrato executável',false,e.stack||e.message);}
  finally{
    for(const s of sessions){check('nenhum dialog/alert',s.dialogs.length===0,s.dialogs);check('nenhum pageerror',s.errors.length===0,s.errors);await s.ctx.close();}
    if(browser) await browser.close();console.log(`\n${assertions} asserções, ${failures} falha(s)`);process.exitCode=failures?1:0;
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
