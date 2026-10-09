const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 const ctx=await b.newContext({viewport:{width:1366,height:768}}); await fake.install(ctx,{kanban:{usuarios:{ana:{uid:'ana',nome:'Ana',email:'ana@ciahering.com.br',inscrito:true,init:'AA'}},usuarios_publicos:{ana:{uid:'ana',nome:'Ana',init:'AA'}},config:{adm_emails:['ana@ciahering.com.br']}}});
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8941/painel-dev.html'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),{uid:'ana',email:'ana@ciahering.com.br',displayName:'Ana',photoURL:'',providerData:[{providerId:'google.com'}]}); await p.waitForTimeout(2500);
 await p.evaluate(()=>_pagesSwitcherRender()); await p.waitForTimeout(800); const r=await p.evaluate(()=>{ const im=document.querySelector('#ptab-okr img'); const dd=[...document.querySelectorAll('#pg-switcher-dd img')]; return {aba:!!im&&im.complete&&im.naturalWidth>0, menu:dd.length, menuOk:dd.every(i=>i.complete&&i.naturalWidth>0), v:document.querySelector('.version').textContent}; });
 console.log(JSON.stringify(r), 'erros:',errs); const el=await p.$('#ptab-okr'); if(el){ await el.screenshot({path:process.argv[2]}); }
 console.log(r.aba&&r.menu===2&&r.menuOk&&!errs.length?'✅ OK':'❌ FALHA'); await b.close(); })();
