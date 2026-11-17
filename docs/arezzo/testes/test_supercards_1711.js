const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {chromium}=require(path.join(os.homedir(),'hering-tools/playwright/node_modules/playwright'));
(async()=>{
 const dir=path.join(os.homedir(),'hering-tools/chrome');
 const executablePath=path.join(dir,fs.readdirSync(dir).find(n=>n.startsWith('mac_arm-')),'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
 const browser=await chromium.launch({executablePath,headless:true});
 try{
  const p=await browser.newPage(),raiz=path.resolve(__dirname,'../../..');
  await p.route('http://auditoria.local/**',r=>r.fulfill({contentType:'text/html',body:r.request().url().endsWith('/kanban-dev.html')?fs.readFileSync(process.env.KANBAN_HTML||path.join(raiz,'kanban-dev.html'),'utf8'):'<!doctype html><body></body>'}));
  await p.goto('http://auditoria.local/teste');
  const linhas=await p.evaluate(fs.readFileSync(path.join(__dirname,'console_supercards_1711.js'),'utf8'));
  console.table(linhas);if(linhas.some(r=>r.resultado==='❌'))process.exitCode=1;
  // Boot real: o modal de editar Modelo deixa a receita acessível.
  const fake=require('./fakefb');
  const usuario={uid:'pessoa-ficticia',email:'pessoa-ficticia@ciahering.com.br',displayName:'Pessoa fictícia',providerData:[{providerId:'google.com'}]};
  const dadosUsuario={nome:usuario.displayName,email:usuario.email,init:'PF',role:'adm',inscrito:true,diretoria:'digital',squads:{site:true}};
  const mk=(id,extras)=>Object.assign({id,title:id,col:'todo',createdAt:'2026-11-01'},extras);
  const seed={kanban:{usuarios:{'pessoa-ficticia':dadosUsuario},usuarios_publicos:{'pessoa-ficticia':dadosUsuario},config:{adm_emails:[usuario.email]},squads:{}}};
  seed.kanban.squads.site={dados:{
   columns:[{id:'todo',name:'A fazer'},{id:'done',name:'Concluído'}],
   cards:{0:mk('campanha',{childCardIds:['criativo']}),1:mk('criativo',{childCardIds:['versao']}),2:mk('versao')},
   cards_index:{campanha:'0',criativo:'1',versao:'2'},
   config:{fanout_templates:{r:{nome:'Receita teste',filhos:[{sufixo:'A'},{sufixo:'B'}]}}}
  }};

  const ctx=await browser.newContext();
  try{
   await ctx.route('http://supercard.local/**',async route=>{
    const nome=decodeURIComponent(new URL(route.request().url()).pathname).slice(1);
    const arq=nome==='kanban-dev.html'&&process.env.KANBAN_HTML?process.env.KANBAN_HTML:path.join(raiz,nome);
    const tipos={'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.png':'image/png'};
    if(fs.existsSync(arq)&&fs.statSync(arq).isFile())await route.fulfill({contentType:tipos[path.extname(arq)]||'application/octet-stream',body:fs.readFileSync(arq)});else await route.fulfill({status:404,body:''});
   });
   await fake.install(ctx,seed);
   const pagina=await ctx.newPage();pagina.setDefaultTimeout(15000);
   await pagina.goto('http://supercard.local/kanban-dev.html?squad=site');
   await pagina.waitForFunction(()=>!!window.__authCb);
   await pagina.evaluate(u=>window.__authCb(u),usuario);
   await pagina.waitForFunction(()=>typeof cards!=='undefined'&&cards.some(c=>c.id==='versao')&&fanoutTemplates.r);
   const profundidade=await pagina.evaluate(()=>{
    const antes=cards.length,r=_autoAction('apply_fanout').run({actionVal:'r'},cards.find(c=>c.id==='versao'));
    return r===false&&cards.length===antes;
   });
   console.log((profundidade?'✅':'❌')+' Boot real: Automação recusa quarta camada');if(!profundidade)process.exitCode=1;
   await pagina.evaluate(()=>{document.querySelectorAll('.ov.open').forEach(o=>o.classList.remove('open'));currentQL='modelos';qlItems.modelos=[{title:'Modelo fictício',col:'todo'}];openQLEdit(0)});
   await pagina.waitForTimeout(150);
   const antes=await pagina.evaluate(()=>Object.keys(window.__store.kanban.squads.site.dados.cards).length);
   await pagina.evaluate(()=>applyFanoutToCurrentCard('r'));
   await pagina.waitForTimeout(500);
   const depois=await pagina.evaluate(()=>Object.keys(window.__store.kanban.squads.site.dados.cards).length);
   console.log((antes===depois?'✅':'❌')+' Boot real: receita em Modelo não grava filhos ('+antes+' → '+depois+')');if(antes!==depois)process.exitCode=1;
  }finally{await ctx.close()}

 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
