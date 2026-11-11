// Base V2 da Ilha: boot real + Firebase falso, sem acessar banco real.
// Na raiz: python3 -m http.server 8953
// Depois: node docs/arezzo/testes/test_ilha_v2_base.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const chromeRoot = path.join(home, 'hering-tools/chrome');
const chrome = process.env.CHROME || path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n=>n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8953';
const U = {uid:'eve',email:'eve@ciahering.com.br',displayName:'Eve',photoURL:'',providerData:[{providerId:'google.com'}]};
const B = {...U,uid:'bob',email:'bob@ciahering.com.br',displayName:'Bob'};
const seed = ()=>{
  const t1 = {sq:'site',cardId:'c1',cardTitle:'Banner',atividade:'Revisar campanha',tipo:'cronometro',status:'rodando',startedAt:Date.now()-5*60000,accMs:0,porUid:'ana'};
  const t2 = {sq:'site',cardId:'c2',cardTitle:'Relatório',atividade:'Relatório semanal',tipo:'cronometro',status:'pausado',accMs:600000,startedAt:null,porUid:'eve'};
  return {kanban:{usuarios:{eve:{uid:'eve',nome:'Eve',email:U.email,init:'EV',role:'membro',inscrito:true,squads:{site:true},notificacoes:{n1:{type:'mention',title:'Velha',ts:new Date(Date.now()-3600000).toISOString(),read:false}}},bob:{uid:'bob',nome:'Bob',email:B.email,init:'BO',role:'membro',inscrito:true,squads:{site:true}},ana:{nome:'Ana'}},config:{adm_emails:[U.email]},cards_guardiao:{site:{ultimo:{acao:'restaurado',titulo:'Velho',cardId:'c2',detectadoEm:new Date(Date.now()-3*86400000).toISOString()}}},timers_ativos:{eve:{t1,t2}},squads:{site:{dados:{columns:[{id:'doing',name:'Fazendo'}],cards_index:{c1:'k0',c2:'k1'},cards:{k0:{id:'c1',title:'Banner',col:'doing'},k1:{id:'c2',title:'Relatório',col:'doing'}},card_timers:{c1:{t1:{...t1,id:'t1',uid:'eve',iniciadoEm:'2026-11-10T08:00:00.000Z'}},c2:{t2:{...t2,id:'t2',uid:'eve'}}}}}}}};
};
let assertions = 0, failures = 0;
const check = (name, pass, detail)=>{ assertions++; if(!pass) failures++; console.log((pass?'✅ ':'❌ ')+name+(pass?'':' → '+JSON.stringify(detail))); };
const until = async(p,fn,arg,timeout=3000)=>{try{await p.waitForFunction(fn,arg,{timeout});return true;}catch(e){if(e.name==='TimeoutError') return false;throw e;}};
// Sem atividade (bob), a entrada pelos Timers abre os ajustes da ilha oculta.
const open = async p=>{if(await p.getAttribute('#ilha','data-estado')!=='aberta'){if(await p.locator('#ilha-btn').isVisible()) await p.click('#ilha-btn');else {await p.click('#tb-timers');await p.click('#ilha-ligar');}}await p.waitForSelector('#ilha-painel',{state:'visible'});};
const tab = async(p,id)=>{await open(p);await p.click(`.ilha-aba[data-aba="${id}"]`);};
const config = async(p,id,value)=>{await tab(p,'ajustes');if(typeof value==='boolean') await p.locator(id).setChecked(value);else await p.selectOption(id,value);};
const close = async p=>{await p.keyboard.press('Escape');};
const put = (p,key,value)=>p.evaluate(async({key,value})=>window._set(window._ref(window._db,key),value),{key,value});
const count = p=>p.evaluate(()=>window.__ilhaOnValueCalls);
const mod = (p,ativo)=>p.evaluate(ativo=>window.__ilhaMods().some(m=>m.id==='op' && m.ativo===ativo),ativo);
const secondaryHidden = p=>p.locator('#ilha-sec').evaluate(e=>e.hidden);
const title = p=>p.locator('#ilha-titulo').textContent();
(async()=>{
  const browser = await chromium.launch({executablePath:chrome,headless:true});
  const sessions = [];
  const login = async(p,user)=>{
    await p.waitForFunction(()=>!!window.__authCb && !!window._onValue && !!window.__ilha);
    // Antes do login: conta chamadas reais ao alias usado pelo board/módulo.
    await p.evaluate(()=>{window.__ilhaOnValueCalls=0;const original=window._onValue;window._onValue=function(...args){window.__ilhaOnValueCalls++;return original.apply(this,args);};});
    await p.evaluate(u=>window.__authCb(u),user);await p.waitForTimeout(3000);
    await p.evaluate(()=>document.querySelectorAll('.ov.open').forEach(o=>o.classList.remove('open')));
  };
  const session = async user=>{
    const ctx=await browser.newContext({viewport:{width:1280,height:800}});
    const s={ctx,p:null,errors:[],user};sessions.push(s);
    await fake.install(ctx,seed());s.p=await ctx.newPage();s.p.setDefaultTimeout(10000);
    s.p.on('pageerror',e=>s.errors.push(e.message));
    await s.p.goto(base+'/kanban-dev.html?squad=site');await login(s.p,user);return s;
  };
  try {
    const {p}=await session(U);
    check('eve vira ADM pela configuração do banco',await p.evaluate(()=>isAdmUser(window._currentUser)));
    const bootCalls=await count(p);
    check('instrumentação contou escutas no login',bootCalls>0,bootCalls);
    await p.evaluate(()=>window.__ilha.ligar());
    check('v1: timer continua principal sem módulos ativos',await title(p)==='Revisar campanha');
    check('v1: secundária tem hidden sem módulo',await secondaryHidden(p));
    check('registro op existe e começa inativo',await mod(p,false));
    await tab(p,'ajustes');
    check('ajustes: secundária existe e começa marcada',await p.locator('#ilha-cfg-sec').count()===1 && await p.locator('#ilha-cfg-sec').isChecked());
    check('ajustes ADM: Operação existe e começa desmarcada',await p.locator('#ilha-cfg-mod-op').count()===1 && !await p.locator('#ilha-cfg-mod-op').isChecked());
    check('módulo desligado não acrescenta escuta',await count(p)===bootCalls,{antes:bootCalls,depois:await count(p)});
    await config(p,'#ilha-cfg-mod-op',true);
    check('registro op fica ativo',await mod(p,true));
    check('ligar Operação não acrescenta escuta',await count(p)===bootCalls,{antes:bootCalls,depois:await count(p)});
    check('Operação cria sua aba',await p.locator('.ilha-aba[data-aba="op"]').count()===1);
    await tab(p,'op');
    check('incidente antigo permanece listado', (await p.locator('#ilha-painel').textContent()).includes('Velho'));
    await close(p);
    check('incidente de três dias não vira atividade',await secondaryHidden(p) && await title(p)==='Revisar campanha');

    await put(p,'kanban/cards_guardiao/site/ultimo',{acao:'sem_espelho',titulo:'Banner sumiu',cardId:'c9',detectadoEm:new Date().toISOString()});
    check('incidente novo: timer principal e alerta secundário',await until(p,()=>document.getElementById('ilha-titulo').textContent==='Revisar campanha' && !document.getElementById('ilha-sec').hidden && document.getElementById('ilha-sec').textContent.includes('🚨')));
    await config(p,'#ilha-cfg-principal','op');await close(p);
    check('principal op mostra incidente e ilha-alerta',await until(p,()=>document.getElementById('ilha-titulo').textContent.includes('Banner sumiu') && document.getElementById('ilha').classList.contains('ilha-alerta')));
    check('timer vira secundária visível começando com ⏲',!await secondaryHidden(p) && (await p.locator('#ilha-sec').textContent()).startsWith('⏲'));
    await tab(p,'op');await p.click('button[data-op="visto"]');await close(p);
    check('Visto remove atividade e cai para timer com principal op',await title(p)==='Revisar campanha' && await secondaryHidden(p));
    // fake.install repõe o seed a cada navegação. Mantém o MESMO incidente novo
    // no reload para não confundir persistência de Visto com expiração do seed velho.
    const snapshot=await p.evaluate(()=>JSON.stringify(window.__store));
    await p.addInitScript(s=>{window.__store=JSON.parse(s);},snapshot);
    await p.reload();await login(p,U);
    check('reload mantém módulo ligado e Visto no localStorage',await mod(p,true) && await title(p)==='Revisar campanha' && await secondaryHidden(p));
    await tab(p,'ajustes');
    check('reload preserva principal op',await p.locator('#ilha-cfg-principal').inputValue()==='op');
    await tab(p,'op');
    check('reload mantém o mesmo incidente listado e sem botão Visto',(await p.locator('#ilha-painel').textContent()).includes('Banner sumiu') && await p.locator('button[data-op="visto"]').count()===0);
    await close(p);

    await put(p,'kanban/usuarios/eve/notificacoes/b1',{id:'b1',type:'backup_falhou',title:'Backup semanal falhou',sub:'squad site',ts:new Date().toISOString(),read:false});
    // Abrir encerra o aviso transitório de notificação; verifica a atividade estável.
    await tab(p,'op');
    check('aba Operação lista falha de backup',await until(p,()=>document.getElementById('ilha-painel').textContent.includes('Backup semanal falhou')));
    await close(p);
    check('backup oferece atividade 🛟 na pílula ou secundária',await until(p,()=>document.getElementById('ilha-ico').textContent.includes('🛟') || (!document.getElementById('ilha-sec').hidden && document.getElementById('ilha-sec').textContent.includes('🛟'))));
    await config(p,'#ilha-cfg-sec',false);await close(p);
    check('desmarcar secundária impõe hidden com backup ativo',await secondaryHidden(p));
    await config(p,'#ilha-cfg-sec',true);await close(p);
    check('remarcar secundária volta a mostrar timer',!await secondaryHidden(p) && (await p.locator('#ilha-sec').textContent()).startsWith('⏲'));
    await config(p,'#ilha-cfg-mod-op',false);
    check('desligar Operação remove aba e inativa registro',await p.locator('.ilha-aba[data-aba="op"]').count()===0 && await mod(p,false));
    await close(p);
    check('desligar Operação remove secundária e ilha-alerta',await secondaryHidden(p) && !await p.locator('#ilha').evaluate(e=>e.classList.contains('ilha-alerta')));
    await config(p,'#ilha-cfg-mod-op',true);await config(p,'#ilha-cfg-principal','op');await close(p);
    check('antes do privado há principal op ativo',await title(p)==='Um backup falhou');
    await config(p,'#ilha-cfg-privado',true);await close(p);
    check('privado esconde título da principal op',await title(p)==='');

    const bob=await session(B);
    check('bob não é ADM',!await bob.p.evaluate(()=>isAdmUser(window._currentUser)));
    await bob.p.evaluate(()=>window.__ilha.ligar());await tab(bob.p,'ajustes');
    check('bob não recebe controle do módulo Operação',await bob.p.locator('#ilha-cfg-mod-op').count()===0);
    check('bob não recebe aba Operação',await bob.p.locator('.ilha-aba[data-aba="op"]').count()===0);
  } catch(e) {check('contrato executável',false,e.stack||e.message);}
  finally {
    for(const s of sessions){check(s.user.uid+': sem erro de JavaScript em todo o contexto',s.errors.length===0,s.errors);await s.ctx.close();}
    await browser.close();
    console.log(`\n${assertions} asserções, ${failures} falha(s)`);process.exitCode=failures?1:0;
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
