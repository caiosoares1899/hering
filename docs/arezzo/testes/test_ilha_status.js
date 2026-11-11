// Base V2 da Ilha: boot real + Firebase falso, sem acessar banco real.
// Na raiz: python3 -m http.server 8953
// Depois: node docs/arezzo/testes/test_ilha_status.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const chromeRoot = path.join(home, 'hering-tools/chrome');
const chrome = process.env.CHROME || path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n=>n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8953';
const U = {uid:'eve',email:'eve@ciahering.com.br',displayName:'Eve',photoURL:'',providerData:[{providerId:'google.com'}]};
const seed = ()=>({kanban:{usuarios:{eve:{uid:'eve',nome:'Eve',email:U.email,init:'EV',role:'membro',inscrito:true,squads:{site:true,dados:true}}},squads_meta:{site:{label:'Squad Site'},dados:{label:'Squad Dados'}},squads:{site:{dados:{columns:[{id:'doing',name:'Fazendo'}],cards_index:{c1:'k0',c2:'k1'},cards:{k0:{id:'c1',title:'Banner',col:'doing'},k1:{id:'c2',title:'Relatório',col:'doing'}}}},dados:{dados:{columns:[{id:'doing',name:'Fazendo'}],cards:{}}}}}});
const statusSeed=seed;
const seedStatus=()=>{const s=statusSeed(), now=Date.now(); for(const id of ['vtex','github','firebase']) s.kanban[id+'_saude']={ok:true,ultimoOkEm:new Date(now-(id==='firebase'?2*3600000:0)).toISOString(),abertos:0,incidentes:[]}; return s;};
let assertions=0, failures=0;
const check=(name,pass,detail)=>{assertions++;if(!pass) failures++;console.log((pass?'✅ ':'❌ ')+name+(pass?'':' → '+JSON.stringify(detail)));};
const login=async p=>{
  await p.waitForFunction(()=>!!window.__authCb && !!window._onValue && !!window.__ilha);
  // Conta escutas ATIVAS antes do boot autenticado; não confundir com o total de chamadas.
  await p.evaluate(()=>{
    window.__statusAtivas={}; const original=window._onValue;
    window._onValue=function(r,cb,...args){
      const caminho=r.p, cont=window.__statusAtivas; cont[caminho]=(cont[caminho]||0)+1;
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
const counts=p=>p.evaluate(()=>['vtex','github','firebase'].map(id=>window.__statusAtivas['kanban/'+id+'_saude']||0));
const set=async(p,id,d)=>{
  await p.evaluate(async({id,d})=>{document.activeElement?.blur();await window._set(window._ref(window._db,'kanban/'+id+'_saude'),d);},{id,d});
  await p.waitForTimeout(100);
};
const normal=()=>({ok:true,ultimoOkEm:new Date().toISOString(),abertos:0,incidentes:[]});
const noActivity=p=>p.evaluate(()=>!_ilhaModsCand().some(c=>c.mod==='status') && !document.getElementById('ilha').classList.contains('ilha-alerta'));
(async()=>{
  const browser=await chromium.launch({executablePath:chrome,headless:true}), sessions=[];
  const session=async mobile=>{
    const ctx=await browser.newContext({viewport:{width:mobile?390:1280,height:800},hasTouch:mobile,isMobile:mobile});
    const s={ctx,errors:[],dialogs:[]};sessions.push(s);await fake.install(ctx,seedStatus());
    const p=s.p=await ctx.newPage();p.setDefaultTimeout(10000);
    p.on('pageerror',e=>s.errors.push(e.message));p.on('dialog',async d=>{s.dialogs.push(d.message());await d.dismiss();});
    await p.goto(base+'/kanban-dev.html?squad=site');await login(p);await p.evaluate(()=>window.__ilha.ligar());return s;
  };
  try{
    const {p}=await session(false);await tab(p,'ajustes');
    check('Serviços existe desmarcado',await p.locator('#ilha-cfg-mod-status').count()===1 && !await p.isChecked('#ilha-cfg-mod-status'));
    check('desligado: nenhuma escuta de saúde',(await counts(p)).every(n=>n===0));
    await p.check('#ilha-cfg-mod-status');await p.waitForTimeout(100);
    check('ligado: exatamente uma escuta por nó',JSON.stringify(await counts(p))==='[1,1,1]');
    check('aba Serviços disponível',await p.locator('.ilha-aba[data-aba="status"]').count()===1);
    check('normal e sem leitura não geram alerta',await noActivity(p) && !(await p.locator('#ilha-ico').textContent()).includes('🚨') && await p.locator('#ilha-sec').evaluate(e=>e.hidden));
    await tab(p,'status');
    check('Firebase antigo mostra sem leitura',(await p.locator('[data-status="firebase"]').textContent()).includes('sem leitura') && await noActivity(p));
    await set(p,'firebase',normal());
    check('três serviços normais não geram atividade',await noActivity(p) && (await p.locator('[data-status]').allTextContents()).every(t=>t.includes('normal')));
    const ataque='<img src=x onerror=alert(1)>Checkout lento';
    const incidente=link=>({...normal(),abertos:1,incidentes:[{titulo:ataque,link}]});
    await set(p,'vtex',incidente('javascript:alert(1)'));
    check('incidente aparece na principal ou secundária',await p.evaluate(()=>document.getElementById('ilha-ico').textContent==='🚨' || (!document.getElementById('ilha-sec').hidden && document.getElementById('ilha-sec').textContent.includes('🚨'))));
    check('principal status tem ilha-alerta',await p.evaluate(()=>_ilhaAtividades().pri.mod!=='status' || document.getElementById('ilha').classList.contains('ilha-alerta')));
    check('título é texto e não HTML',(await p.locator('[data-status="vtex"]').textContent()).includes(ataque) && await p.locator('#ilha-painel img').count()===0);
    const href=()=>p.getAttribute('[data-status="vtex"] a.ilha-status-link','href');
    check('javascript substituído pela raiz oficial',await href()==='https://status.vtex.com/');
    check('link externo protegido',await p.getAttribute('[data-status="vtex"] a','target')==='_blank' && await p.getAttribute('[data-status="vtex"] a','rel')==='noopener noreferrer');
    await set(p,'vtex',incidente('https://status.vtex.com/incidents/abc'));
    check('link oficial preservado',await href()==='https://status.vtex.com/incidents/abc');
    await set(p,'vtex',incidente('https://evil.com/status.vtex.com/'));
    check('domínio impostor substituído',await href()==='https://status.vtex.com/');
    await set(p,'github',{...normal(),pagesAfetado:true,pagesStatusLabel:'Desempenho degradado'});
    check('Pages eleva prioridade agregada',await p.evaluate(()=>{const cs=_ilhaModsCand().filter(c=>c.mod==='status');return cs.length===1 && cs[0].prio===95 && cs[0].txt.startsWith('GitHub Pages instável');}));
    await tab(p,'ajustes');await p.selectOption('#ilha-cfg-principal','status');
    check('Pages principal começa com aviso explícito',(await p.locator('#ilha-titulo').textContent()).startsWith('GitHub Pages instável'));
    await set(p,'github',normal());await set(p,'vtex',{...incidente('https://status.vtex.com/'),ultimoOkEm:new Date(Date.now()-30*60000).toISOString()});await tab(p,'status');
    check('incidente velho vira sem leitura sem atividade',(await p.locator('[data-status="vtex"]').textContent()).includes('sem leitura') && await noActivity(p));
    await set(p,'vtex',incidente('https://status.vtex.com/'));await tab(p,'ajustes');await p.uncheck('#ilha-cfg-mod-status');
    check('desligar encerra as três escutas',(await counts(p)).every(n=>n===0));
    check('desligar remove aba e alerta',await p.locator('.ilha-aba[data-aba="status"]').count()===0 && await noActivity(p));
    await p.check('#ilha-cfg-mod-status');await p.waitForTimeout(100);
    check('religar não duplica escutas',JSON.stringify(await counts(p))==='[1,1,1]');
    await set(p,'vtex',null);await set(p,'github',{desligado:true,em:new Date().toISOString()});await set(p,'firebase',null);await tab(p,'status');
    check('ausentes e desligados mostram vazio',(await p.locator('#ilha-painel .ilha-vazio').textContent())==='Sem leitura dos monitores agora.');
    const mobile=await session(true);await tab(mobile.p,'ajustes');await mobile.p.check('#ilha-cfg-mod-status');await tab(mobile.p,'status');
    check('390px com toque: sem rolagem lateral',await mobile.p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth && document.getElementById('ilha-painel').scrollWidth<=document.getElementById('ilha-painel').clientWidth));
    check('links têm alvo de toque de 44px',await mobile.p.locator('.ilha-status-link').evaluateAll(es=>es.length===3 && es.every(e=>e.getBoundingClientRect().height>=44)));
  }catch(e){check('contrato executável',false,e.stack||e.message);}
  finally{
    for(const s of sessions){check('nenhum dialog/alert',s.dialogs.length===0,s.dialogs);check('nenhum pageerror',s.errors.length===0,s.errors);await s.ctx.close();}
    await browser.close();console.log(`\n${assertions} asserções, ${failures} falha(s)`);process.exitCode=failures?1:0;
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
