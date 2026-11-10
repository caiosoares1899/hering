// Modal do card: boot real + Firebase falso. BASE_URL e MAIN_HTML permitem comparar a main sem trocar arquivo no disco.
const fs = require('node:fs');
const path = require('node:path');
const home = require('node:os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const chromeRoot = path.join(home, 'hering-tools/chrome');
const chrome = process.env.CHROME || path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n=>n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const out = process.env.OUT || path.join(__dirname, '../../capturas/card-modal-ui');
const base = process.env.BASE_URL || 'http://127.0.0.1:8947';
const user = {uid:'teste',email:'teste@ciahering.com.br',displayName:'Pessoa fictícia',providerData:[{providerId:'google.com'}]};
const seed = (count, role) => ({kanban:{usuarios:{teste:{nome:'Pessoa fictícia',email:user.email,init:'TT',role,inscrito:true,squads:{site:true}}},config:{adm_emails:role==='adm'?[user.email]:[]},squads:{site:{dados:{columns:[{id:'doing',name:'Em andamento'},{id:'done',name:'Concluído',isDone:true}],cards_index:{c1:'k0'},cards:{k0:{id:'c1',title:'Projeto com título longo para conferir a leitura e as ações no celular',col:'doing',desc:'## Objetivo\nConferir o projeto.',checklistGroups:[{id:'g1',title:'Planejamento com título longo'},{id:'g2',title:'Execução'}],checklist:Array.from({length:count},(_,i)=>({t:'Entrega '+i+' '+('texto longo '.repeat(7)),grp:i<count/2?'g1':'g2',done:i===0})),updatedAt:'2026-11-09T12:00:00.000Z'}}}}}}});
let failures = 0;
const check = (name, pass, detail) => {console.log(`${pass?'✅':'❌'} ${name}${pass?'':' '+JSON.stringify(detail)}`); if(!pass) failures++;};
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({executablePath:chrome,headless:true});
 try {
 for(const [width,height,count,role] of [[1280,900,50,'adm'],[390,800,50,'membro'],[834,1112,2,'po'],[390,800,0,'adm']]) {
  const ctx=await browser.newContext({viewport:{width,height},hasTouch:width!==1280,isMobile:width===390});
  await fake.install(ctx,seed(count,role));
  if(process.env.MAIN_HTML) await ctx.route('**/kanban-dev.html?*',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(process.env.MAIN_HTML,'utf8')}));
  const p=await ctx.newPage();p.setDefaultTimeout(10000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/kanban-dev.html?squad=site');await p.waitForFunction(()=>!!window.__authCb);await p.evaluate(u=>window.__authCb(u),user);await p.waitForTimeout(2200);
  await p.evaluate(()=>{document.querySelectorAll('.ov.open').forEach(e=>e.classList.remove('open'));openCard('c1');});await p.waitForTimeout(350);
  for(const theme of ['','light','vice']) {
   await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   const label=`${width}/${theme||'dark'}/${count}/${role}`;
   const result=await p.evaluate(()=>{
    const panel=document.querySelector('#card-ov .card-panel');
    const controls=[...document.querySelectorAll('#m-checklist button,#m-checklist .cl-group-handle')].filter(e=>e.getBoundingClientRect().width>0);
    const rects=controls.map(e=>({name:e.getAttribute('aria-label')||e.title||e.textContent,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}));
    return {overflow:panel.scrollWidth-panel.clientWidth,groupCount:document.querySelectorAll('.cl-group').length,items:getCL().length,small:rects.filter(r=>r.w<43.9||r.h<43.9),missing:[...document.querySelectorAll('#card-ov .panel-hd .x-btn')].filter(e=>!e.getAttribute('aria-label')).length,labels:[...document.querySelectorAll('#m-checklist .cl-group-title')].every(e=>!!e.getAttribute('aria-label'))};
   });
   check(label+' sem rolagem lateral',result.overflow<=1,result);
   check(label+' grupos e itens preservados',result.groupCount===2&&result.items===count,result);
   check(label+' ações do cabeçalho e nomes dos checklists acessíveis',result.missing===0&&result.labels,result);
   if(width!==1280) check(label+' controles do checklist com alvo de toque ≥44px',result.small.length===0,result.small);
   await p.screenshot({path:path.join(out,`${width}-${count}-${theme||'dark'}.png`)});
   if(count && width===390){
    await p.evaluate(()=>{const panel=document.querySelector('#card-ov .card-panel'),sec=document.querySelector('#m-checklist-sec');panel.scrollTop+=sec.getBoundingClientRect().top-panel.getBoundingClientRect().top-panel.querySelector('.panel-hd').offsetHeight-12;});
    await p.screenshot({path:path.join(out,`${width}-${count}-${theme||'dark'}-checklist.png`)});
    await p.evaluate(()=>document.querySelector('#card-ov .card-panel').scrollTop=0);
   }
  }
  const consoleResult=await p.evaluate(fs.readFileSync(path.join(__dirname,'console_card_modal_ui.js'),'utf8'));
  check(`${width}/${count} script de console executável e aprovado`,consoleResult.length===4&&consoleResult.every(r=>r.resultado==='✅'),consoleResult);
  // Navegação por teclado usa os mesmos handlers reais; não altera o conteúdo dos itens.
  await p.locator('.cl-collapse-btn').first().focus();await p.keyboard.press('Enter');
  check(`${width}/${count} recolher por teclado preserva itens`,await p.evaluate(n=>getCL().length===n&&document.querySelector('.cl-group .cl-items').style.display==='none',count));
  await p.keyboard.press('Enter');
  check(`${width}/${count} expandir por teclado preserva itens`,await p.evaluate(n=>getCL().length===n&&document.querySelector('.cl-group .cl-items').style.display!=='none',count));
  check(`${width}/${count} sem erro de JavaScript`,errors.length===0,errors);
  await ctx.close();
 }
 } finally {await browser.close();}
 console.log(`${failures} falha(s)`);process.exitCode=failures?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
