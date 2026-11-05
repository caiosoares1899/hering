// Boot real + Firebase falso: reserva antes da resposta e troca pelos blocos reais.
// node docs/arezzo/testes/test_oceano_esqueletos.js (servidor na porta 8941)
// PLAYWRIGHT_PATH=/caminho/playwright CHROME_PATH=/caminho/chrome opcionais.
// SOURCE_FILE=/tmp/oceano-antes.html REQUIRE_SKELETON=0 mede a versão anterior.
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fake = require('./fakefb');
const seedMetas = require('./seed_metas');
const B = process.env.BASE_URL || 'http://localhost:8941/';
const exigir = process.env.REQUIRE_SKELETON !== '0';
const assert = require('node:assert/strict');
const consoleScript = fs.readFileSync(require('node:path').join(__dirname,'console_oceano_esqueletos.js'),'utf8');
const conferirConsole = async p => { const r=await p.evaluate(code=>eval(code),consoleScript);assert.ok(r.every(x=>x.resultado==='✅'),JSON.stringify(r)); };
const user = seedMetas.U('eve', 'Pessoa Teste');
const seed = () => { const s = seedMetas.seed('membro', {semMarcoFresco:true}); s.kanban.metas_digital_dev.g.oceano = true; s.kanban.comunicados = {a:{ativo:true,oceano:true,tipo:'aviso',squad:'*',publico:'todos',titulo:'Aviso de teste',corpo:'<p>Informação para o time.</p>',criadoEm:new Date().toISOString()}}; return s; };
const caixas = p => p.evaluate(() => {
  const box = id => {const e=document.getElementById(id),r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,busy:e.getAttribute('aria-busy')};};
  return {meta:box('col-meta'),mural:box('mural-wrap'),tiles:box('tiles'),links:box('lk-meus-wrap'),overflow:document.documentElement.scrollWidth>innerWidth+1};
});
(async () => {
 const browser = await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try {
 const abrir = async ({w=1280,tema='abrolhos',modo='normal'}={}) => {
  const ctx = await browser.newContext({viewport:{width:w,height:900},reducedMotion:'reduce'});
  const s=seed(); if(modo==='vazio'){s.kanban.comunicados={};s.kanban.metas_digital_dev={};}
  if(modo==='restrito') s.kanban.comunicados.a.publico='po';
  await fake.install(ctx,s);
  await ctx.addInitScript(({tema,modo})=>{
   localStorage.setItem('oceano_prefs',JSON.stringify({tema,peixes:'off'}));
   window.__getDelay=path=>path.includes('/usuarios/')?200:0;
   window.__onValueDelay=path=>/metas_digital|comunicados/.test(path)?(modo==='tardio'?1000:1600):0;
   if(modo==='erro'||modo==='tardio') { const original=window.setTimeout; window.setTimeout=(fn,ms,...a)=>original(fn,ms===15000?300:ms,...a); }
  },{tema,modo});
  if(process.env.SOURCE_FILE) await ctx.route('**/oceano-dev.html',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(process.env.SOURCE_FILE,'utf8')}));
  const p=await ctx.newPage(); const erros=[];p.on('pageerror',e=>erros.push(e.message));
  await p.goto(B+'oceano-dev.html');await p.waitForFunction(()=>!!window.__authCb);
  await p.evaluate(({user,modo})=>{
   if(modo==='erro') { const on=window._onValue;window._onValue=(r,cb,err)=>{if(/metas_digital|comunicados/.test(r.p)){if(err)setTimeout(()=>err(new Error('PERMISSION_DENIED')),100);return ()=>{};}return on(r,cb,err);}; }
   window.__authCb(user);
  },{user,modo});
  await p.waitForFunction(()=>document.getElementById('tiles').children.length>0);
  return {ctx,p,erros};
 };
 for(const w of [1280,390]) for(const tema of ['abrolhos','lencois','entardecer']) {
  const {ctx,p,erros}=await abrir({w,tema});
  const antes=await caixas(p); const espera=await p.evaluate(()=>({meta:!!document.querySelector('.meta-esqueleto'),mural:!!document.querySelector('.mural-esqueleto'),aberto:document.getElementById('mural-hd').getAttribute('aria-expanded')}));
  if(exigir){assert.ok(espera.meta&&espera.mural);assert.ok(antes.meta.h>=300);assert.ok(antes.mural.h>0);assert.equal(espera.aberto,w>=980?'true':'false');assert.ok(!antes.overflow);}
  if(exigir) await conferirConsole(p);
  if(process.env.SHOT_DIR) { fs.mkdirSync(process.env.SHOT_DIR,{recursive:true});await p.screenshot({path:process.env.SHOT_DIR+'/oceano_'+w+'_'+tema+'_carregando.png',fullPage:true}); }
  await p.waitForFunction(()=>!!document.querySelector('#meta-oceano-body [data-mm-id]')&&!!document.querySelector('#mural .av'));
  const depois=await caixas(p);
  const troca=await p.evaluate(()=>({skeleton:!!document.querySelector('.meta-esqueleto,.mural-esqueleto'),metaBusy:document.getElementById('col-meta').hasAttribute('aria-busy'),muralBusy:document.getElementById('mural-wrap').hasAttribute('aria-busy')}));
  assert.ok(!troca.skeleton&&!troca.metaBusy&&!troca.muralBusy);assert.ok(!depois.overflow);assert.deepEqual(erros,[]);
  if(exigir) await conferirConsole(p);
  if(exigir){assert.ok(Math.abs(antes.tiles.w-depois.tiles.w)<2,'produtos mantêm largura');assert.ok(Math.abs(antes.meta.y-depois.meta.y)<2,'meta mantém topo');assert.ok(Math.abs(antes.links.y-depois.links.y)<24,'uma meta e um aviso: conteúdo abaixo fica estável');if(w>=980)assert.ok(Math.abs(antes.mural.y-depois.mural.y)<2,'mural mantém topo no desktop');}
  console.log('✅ '+w+'/'+tema,JSON.stringify({antes,depois,deltaLinks:depois.links.y-antes.links.y}));
  if(process.env.SHOT_DIR) { fs.mkdirSync(process.env.SHOT_DIR,{recursive:true});await p.screenshot({path:process.env.SHOT_DIR+'/oceano_'+w+'_'+tema+'.png',fullPage:true}); }
  await p.click('#mural-hd');assert.equal(await p.locator('#mural-hd').getAttribute('aria-expanded'),w>=980?'false':'true');
  await ctx.close();
 }
 if(exigir) {
  for(const modo of ['vazio','restrito','erro','tardio']) {
   const {ctx,p,erros}=await abrir({modo});
   if(modo==='tardio') {await p.waitForSelector('.meta-indisponivel');assert.equal(await p.locator('#col-meta').getAttribute('aria-busy'),null);await p.waitForSelector('#meta-oceano-body [data-mm-id]');assert.equal(await p.locator('.meta-indisponivel').count(),0);}
   else if(modo==='erro') {await p.waitForSelector('.meta-indisponivel');await p.waitForFunction(()=>getComputedStyle(document.getElementById('mural-wrap')).display==='none');assert.equal(await p.locator('#col-meta').getAttribute('aria-busy'),null);}
   else {await p.waitForFunction(()=>!document.getElementById('mural-wrap').hasAttribute('aria-busy'));assert.equal(await p.locator('#mural-wrap').isVisible(),false);if(modo==='vazio')assert.equal(await p.locator('#col-meta').isVisible(),false);}
   assert.deepEqual(erros,[]);console.log('✅ estado '+modo);await ctx.close();
  }
  const {ctx,p}=await abrir();await p.waitForSelector('#mural .av');await p.setViewportSize({width:390,height:900});await p.waitForFunction(()=>document.getElementById('mural-hd').getAttribute('aria-expanded')==='false');await p.setViewportSize({width:1280,height:900});await p.waitForFunction(()=>document.getElementById('mural-hd').getAttribute('aria-expanded')==='true');await ctx.close();console.log('✅ redimensionar acompanha padrão sem escolha salva');
 }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
