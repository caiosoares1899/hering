// Base V2 da Ilha: boot real + Firebase falso, sem acessar banco real.
// Na raiz: python3 -m http.server 8953
// Depois: node docs/arezzo/testes/test_ilha_favoritos.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const chromeRoot = path.join(home, 'hering-tools/chrome');
const chrome = process.env.CHROME || path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n=>n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8953';
const U = {uid:'eve',email:'eve@ciahering.com.br',displayName:'Eve',photoURL:'',providerData:[{providerId:'google.com'}]};
const seed = ()=>({kanban:{usuarios:{eve:{uid:'eve',nome:'Eve',email:U.email,init:'EV',role:'membro',inscrito:true,squads:{site:true,dados:true}}},squads_meta:{site:{label:'Squad Site'},dados:{label:'Squad Dados'}},squads:{site:{dados:{columns:[{id:'doing',name:'Fazendo'}],cards_index:{c1:'k0',c2:'k1'},cards:{k0:{id:'c1',title:'Banner',col:'doing'},k1:{id:'c2',title:'Relatório',col:'doing'}}}},dados:{dados:{columns:[{id:'doing',name:'Fazendo'}],cards:{}}}}}});
let assertions=0, failures=0;
const check=(name,pass,detail)=>{assertions++;if(!pass) failures++;console.log((pass?'✅ ':'❌ ')+name+(pass?'':' → '+JSON.stringify(detail)));};
const login=async p=>{
  await p.waitForFunction(()=>!!window.__authCb && !!window._onValue && !!window._get && !!window.__ilha);
  await p.evaluate(()=>{window.__favReads={onValue:0,get:0};for(const [alias,key] of [['_onValue','onValue'],['_get','get']]){const fn=window[alias];window[alias]=function(...args){window.__favReads[key]++;return fn.apply(this,args);};}});
  await p.evaluate(u=>window.__authCb(u),U);await p.waitForTimeout(3000);
  await p.evaluate(()=>document.querySelectorAll('.ov.open').forEach(o=>o.classList.remove('open')));
};
const open=async p=>{
  // Card aberto fica acima do cabeçalho: abre a ilha pela mesma função do botão,
  // sem fechar o card que se quer favoritar.
  await p.evaluate(()=>{if(document.getElementById('ilha').dataset.estado!=='aberta') _ilhaAbrir();});
  await p.waitForSelector('#ilha-painel',{state:'visible'});
};
const tab=async(p,id)=>{await open(p);await p.locator(`.ilha-aba[data-aba="${id}"]`).evaluate(e=>e.click());};
const favorites=p=>p.locator('#ilha-painel button[data-fav]');
const add=async(p,value)=>{await p.selectOption('#ilha-fav-add',value);};
const reads=p=>p.evaluate(()=>JSON.stringify(window.__favReads));
(async()=>{
  const browser=await chromium.launch({executablePath:chrome,headless:true});
  const sessions=[];
  const session=async mobile=>{
    const ctx=await browser.newContext({viewport:{width:mobile?390:1280,height:800},hasTouch:mobile,isMobile:mobile});
    const s={ctx,p:null,errors:[],dialogs:[]};sessions.push(s);await fake.install(ctx,seed());
    const p=s.p=await ctx.newPage();p.setDefaultTimeout(10000);
    p.on('pageerror',e=>s.errors.push(e.message));p.on('dialog',async d=>{s.dialogs.push(d.message());await d.dismiss();});
    await p.goto(base+'/kanban-dev.html?squad=site');await login(p);return s;
  };
  try{
    const {p}=await session(false);
    await p.evaluate(()=>window.__ilha.ligar());await tab(p,'ajustes');
    check('Favoritos disponível e desmarcado',await p.locator('#ilha-cfg-mod-fav').count()===1 && !await p.isChecked('#ilha-cfg-mod-fav'));
    check('desligado não cria aba',await p.locator('.ilha-aba[data-aba="fav"]').count()===0);
    const before=await reads(p), title=await p.locator('#ilha-titulo').textContent();
    await p.check('#ilha-cfg-mod-fav');
    check('ligar não acrescenta _onValue nem _get',before===await reads(p));
    check('ligar cria aba',await p.locator('.ilha-aba[data-aba="fav"]').count()===1);
    await tab(p,'fav');check('vazio explica como adicionar',await p.locator('#ilha-painel .ilha-vazio').count()===1);
    check('favoritos não mudam a pílula',title===await p.locator('#ilha-titulo').textContent());
    await add(p,'produto:okr');await add(p,'squad:dados');
    check('dois favoritos com nomes reais',await favorites(p).count()===2 && (await favorites(p).allTextContents()).join(' ').includes('Radar') && (await favorites(p).allTextContents()).join(' ').includes('Squad Dados'));
    check('select exclui favoritos existentes',await p.locator('#ilha-fav-add option[value="produto:okr"], #ilha-fav-add option[value="squad:dados"]').count()===0);
    check('Oceano também pode ser favorito',await p.locator('#ilha-fav-add option[value="produto:oceano"]').count()===1);
    await p.reload();await login(p);await tab(p,'fav');
    check('reload mantém dois favoritos',await favorites(p).count()===2);
    await p.evaluate(()=>openCard('c2'));await tab(p,'fav');
    await p.locator('[data-fav-card]').evaluate(e=>e.click());
    check('card aberto vira terceiro favorito',await favorites(p).count()===3 && (await favorites(p).nth(2).textContent()).includes('Relatório'));
    check('limite remove select e explica troca',await p.locator('#ilha-fav-add').count()===0 && (await p.locator('#ilha-painel').textContent()).includes('Máximo de 3 — remova um para trocar'));
    await p.locator('[data-fav-rm="0"]').evaluate(e=>e.click());
    check('remover primeiro libera select',await favorites(p).count()===2 && await p.locator('#ilha-fav-add').count()===1);
    // Recoloca produto no slot 2 para testar abertura depois da remoção exigida.
    await p.evaluate(()=>document.querySelectorAll('.ov.open').forEach(o=>o.classList.remove('open')));
    await add(p,'produto:okr');
    await p.evaluate(()=>{window.__favOpen=[];window.open=(...args)=>{window.__favOpen.push(args);return null;};});
    await favorites(p).nth(2).click();const dest=await p.evaluate(()=>window.__favOpen[0]);
    check('produto usa destino dev e noopener',dest && dest[0].endsWith('okr-dev.html') && dest[1]==='_blank' && dest[2]==='noopener',dest);
    await favorites(p).nth(1).click();
    check('card fecha ilha e abre Relatório',await p.getAttribute('#ilha','data-estado')!=='aberta' && await p.locator('#card-ov').evaluate(e=>e.classList.contains('open')) && await p.inputValue('#m-title')==='Relatório');
    await p.evaluate(()=>document.querySelectorAll('.ov.open').forEach(o=>o.classList.remove('open')));await tab(p,'fav');
    await Promise.all([p.waitForURL('**/kanban-dev.html?squad=dados'),favorites(p).nth(0).click()]);
    check('squad navega na mesma aba',new URL(p.url()).search==='?squad=dados');await login(p);
    await p.evaluate(()=>{const k=_ilhaChave(), pref=JSON.parse(localStorage.getItem(k));pref.favs=[{tipo:'produto',id:'xss<img src=x onerror=alert(1)>'},{tipo:'link',url:'javascript:alert(1)'},{tipo:'squad',id:'site'},{tipo:'squad',id:'site'},{tipo:'squad',id:'dados'},{tipo:'card'}];localStorage.setItem(k,JSON.stringify(pref));});
    await p.reload();await login(p);await tab(p,'fav');
    check('armazenamento adulterado não injeta img',await p.locator('#ilha-painel img').count()===0);
    check('somente squads válidos e únicos, no máximo três',await favorites(p).count()===2 && (await favorites(p).allTextContents()).every(t=>/Squad (Site|Dados)/.test(t)));
    const mobile=await session(true);await mobile.p.evaluate(()=>window.__ilha.ligar());await tab(mobile.p,'ajustes');await mobile.p.check('#ilha-cfg-mod-fav');await tab(mobile.p,'fav');await add(mobile.p,'produto:okr');await add(mobile.p,'squad:dados');
    check('toque: todos os botões de favorito têm 44px',await mobile.p.locator('[data-fav], [data-fav-rm]').evaluateAll(es=>es.length>0 && es.every(e=>e.getBoundingClientRect().height>=44)));
    check('390px: sem rolagem lateral',await mobile.p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }catch(e){check('contrato executável',false,e.stack||e.message);}
  finally{
    for(const s of sessions){check('sem alert/dialog',s.dialogs.length===0,s.dialogs);check('sem erro de JavaScript',s.errors.length===0,s.errors);await s.ctx.close();}
    await browser.close();console.log(`\n${assertions} asserções, ${failures} falha(s)`);process.exitCode=failures?1:0;
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
