// Menu de capa (🎨) do modal do card: fecha clicando fora MESMO depois de clicar dentro dele, e não fica aberto ao sair/voltar pro card.
// Boot real do kanban com Firebase falso. K=kanban testa a prod.
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const K=process.env.K||'kanban-dev';
const U={uid:'eve',email:'eve@ciahering.com.br',displayName:'Eve',photoURL:'',providerData:[{providerId:'google.com'}]};
const seed={kanban:{usuarios:{eve:{uid:'eve',nome:'Eve',email:'eve@ciahering.com.br',inscrito:true,init:'EV',role:'po',squads:{dev:true}}},usuarios_publicos:{eve:{uid:'eve',nome:'Eve',init:'EV',role:'po',squads:{dev:true}}},config:{adm_emails:[]},squads_meta:{},squads:{dev:{cards:{}}}}};
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true; const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+(JSON.stringify(d)||'').slice(0,300))); };
 const ctx=await b.newContext({viewport:{width:1280,height:800}}); await fake.install(ctx,seed); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
 await p.goto('http://localhost:8941/'+K+'.html?squad=dev'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U); await p.waitForTimeout(2800);
 const aberto=()=>p.evaluate(()=>getComputedStyle(document.getElementById('m-cover-menu')).display!=='none');
 await p.evaluate(()=>{ document.querySelectorAll('.ov.open').forEach(o=>o.classList.remove('open')); }); await p.evaluate(()=>openNewCard()); await p.waitForTimeout(400);
 await p.click('#m-cover-btn'); await p.waitForTimeout(150);
 t('clicar em 🎨 abre o menu', await aberto());
 await p.click('#m-cover-img-inp'); await p.waitForTimeout(100);   // clique DENTRO do menu (gastava o ouvinte de clique-fora)
 t('clique dentro do menu não fecha', await aberto());
 await p.click('#m-title-disp', {force:true}).catch(()=>{}); await p.mouse.click(640,60); await p.waitForTimeout(150);
 t('clique fora fecha o menu (mesmo depois de ter clicado dentro dele)', !(await aberto()));
 // reabre, clica dentro várias vezes, fecha pelo próprio botão e reabre
 await p.click('#m-cover-btn'); await p.waitForTimeout(150); await p.click('#m-cover-img-inp'); await p.click('#m-cover-img-inp');
 await p.click('#m-cover-btn'); await p.waitForTimeout(150); t('o botão 🎨 ainda fecha', !(await aberto()));
 await p.click('#m-cover-btn'); await p.waitForTimeout(150); t('e reabre', await aberto());
 // sair do card e voltar: não pode herdar o menu aberto
 await p.evaluate(()=>closeOv('card-ov')); await p.waitForTimeout(500);
 t('ao fechar o card o menu de capa fecha', !(await aberto()));
 await p.evaluate(()=>openNewCard()); await p.waitForTimeout(400);
 t('ao abrir outro card o menu de capa já vem fechado', !(await aberto()));
 // com o menu aberto, abrir outro card também fecha
 await p.click('#m-cover-btn'); await p.waitForTimeout(150); await p.evaluate(()=>openNewCard()); await p.waitForTimeout(300);
 t('abrir outro card com o menu aberto fecha o menu', !(await aberto()));
 t('sem erro de JS', !errs.length, errs);
 await b.close(); console.log(ok?'TUDO OK':'HÁ FALHAS'); process.exit(ok?0:1); })();
