// MODO "SÓ HERING" em kanban-dev e painel-dev: tela de login, domínios, guardas e menção (sem login real; funções reais da página)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
let falhas=0; const ok=(n,c,d)=>{ if(!c) falhas++; console.log(c?'✅':'❌',n,c?'':(d===undefined?'':String(d).slice(0,300))); };
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 for(const [nome,url] of [[process.env.K||'kanban-dev','http://localhost:8941/'+(process.env.K||'kanban-dev')+'.html'],[process.env.P||'painel-dev','http://localhost:8941/'+(process.env.P||'painel-dev')+'.html']]){
   const ctx=await b.newContext({viewport:{width:1280,height:900}}); const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(e.message));
   await page.goto(url,{waitUntil:'load'}); await page.waitForTimeout(1500);
   const r=await page.evaluate(()=>{ const ov=document.getElementById('login-ov'); const vis=el=>el&&getComputedStyle(el).display!=='none'&&el.offsetParent!==null;
     const msBtns=[...document.querySelectorAll('[onclick*="doSignInMicrosoft"]')];
     return { flag:window.MARE_SO_HERING, td:TRUSTED_DOMAINS.slice(), arezzo:_isTrustedDomainEmail('a@arezzo.com.br'), hering:_isTrustedDomainEmail('a@ciahering.com.br'),
       msVisiveis:msBtns.filter(vis).length, msTotal:msBtns.length, txt:ov?ov.innerText.replace(/\s+/g,' '):'' }; });
   ok(`[${nome}] interruptor ligado e TRUSTED_DOMAINS = só @ciahering`, r.flag===true && r.td.join()==='@ciahering.com.br' && !r.arezzo && r.hering, JSON.stringify(r));
   const mm=await page.evaluate(()=>({az_google:_loginProviderMismatchMsg({email:'ze@arezzo.com.br',providerData:[{providerId:'google.com'}]}), hering_ms:_loginProviderMismatchMsg({email:'a@ciahering.com.br',providerData:[{providerId:'microsoft.com'}]}), hering_google:_loginProviderMismatchMsg({email:'a@ciahering.com.br',providerData:[{providerId:'google.com'}]})}));
   ok(`[${nome}] conta @arezzo entrando pelo Google NÃO é mandada pro botão Microsoft (escondido) — cai no "acesso restrito"`, mm.az_google==='' && /Google/.test(mm.hering_ms) && mm.hering_google==='', JSON.stringify(mm));
   ok(`[${nome}] nenhum botão Microsoft visível na tela de login`, r.msTotal>=1 && r.msVisiveis===0, JSON.stringify({v:r.msVisiveis,t:r.msTotal}));
   ok(`[${nome}] a tela de login só fala de Google/@ciahering`, !/microsoft|arezzo/i.test(r.txt), r.txt);
   const g=await page.evaluate(()=>{ const e=document.getElementById('login-err'); e.style.display='none'; doSignInMicrosoft(); return e.textContent; });
   ok(`[${nome}] doSignInMicrosoft() recusa com aviso`, /desativado/.test(g), g);
   if(nome.startsWith('kanban')){
     const p=await page.evaluate(()=>{ const e=document.getElementById('login-err'); doSignInMicrosoftPessoal(); const t1=e.textContent;
       members.splice(0, members.length, {init:'AA',name:'Ana Hering',email:'ana@ciahering.com.br',uid:'u1'},{init:'ZZ',name:'Zé Arezzo',email:'ze@arezzo.com.br',uid:'u2'},{init:'FR',name:'Free Lancer',email:'free@gmail.com',uid:'u3'},{init:'SE',name:'Sem Email',email:'',uid:'u4'});
       const nomes=mentionCandidates().map(m=>m.name||m.init); return {t1,nomes}; });
     ok('[kanban-dev] login Microsoft pessoal (externo) também desativado', /desativado/.test(p.t1), p.t1);
     ok('[kanban-dev] autocomplete de @menção só com @ciahering (sem Arezzo nem gmail)', p.nomes.includes('Ana Hering') && !p.nomes.includes('Zé Arezzo') && !p.nomes.includes('Free Lancer'), p.nomes.join());
     const ins=await page.evaluate(()=>{ _inscPedirTorre=false; mostrarInscricao({uid:'x',email:'x@ciahering.com.br',displayName:'X'},{init:'XX',role:'membro'},{pedirTorre:true}); return {pedir:_inscPedirTorre, wrap:getComputedStyle(document.getElementById('insc-torre-wrap')).display}; });
     ok('[kanban-dev] inscrição NÃO pergunta a torre', ins.pedir===false && ins.wrap==='none', JSON.stringify(ins));
     const h=await page.evaluate(()=>Object.values(HELP_CONTENT).flat().some(e=>/^Sua torre/.test(e.title)));
     ok('[kanban-dev] Central de Ajuda sem a entrada "Sua torre"', h===false);
   } else {
     const gu=await page.evaluate(()=>({emp:GU_EMPRESAS.map(e=>e.id).join()}));
     ok('[painel-dev] filtros do 👥 Global Users sem o chip Arezzo', gu.emp==='hering,externo', JSON.stringify(gu));
   }
   ok(`[${nome}] sem erros de JS inesperados`, errs.filter(e=>!/firebase|Failed to fetch|import|module|network|ERR_/i.test(e)).length===0, errs.join(' | '));
   await ctx.close(); }
 await b.close(); console.log(falhas?('FALHAS: '+falhas):'TUDO OK'); process.exit(falhas?1:0); })();
