'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {execFileSync} = require('node:child_process');
const home = require('node:os').homedir();
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const root=process.cwd();
(async()=>{
 const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(req.url.split('?')[0]).replace(/^\//,'');
  if(name.includes('..')) {res.writeHead(403).end();return;}
  try {
   const body=process.env.BORDO_BASE && /^onboarding(\.slide)?\.html$/.test(name) ? execFileSync('git',['show',`origin/main:${name}`],{cwd:root}) : fs.readFileSync(path.join(root,name));
   res.setHeader('Content-Type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.png')?'image/png':'application/octet-stream');res.end(body);
  }catch{res.writeHead(404).end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try {
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || path.join(home, 'hering-tools/chrome/mac_arm-157.0.8103.38/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')});
 const base=`http://127.0.0.1:${server.address().port}`;
 for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/onboarding.html');
  await page.locator('#comece').waitFor({timeout:3000});
  const shortcuts=page.locator('#comece .bordo-atalhos a');
  assert.equal(await shortcuts.count(),13);
  // 🧭 Guia do Maré (11/11/2026): o A Bordo leva ao guia da ferramenta, nos dois modos, e o atalho do roteiro aponta pro bloco
  assert.equal(await page.locator('#comece .bordo-atalhos a[href="#guia-mare"]').count(),1,'atalho "Como usar o Maré" no roteiro');
  const guia=await page.locator('#guia-mare .bordo-atalhos a').evaluateAll(as=>as.map(a=>a.getAttribute('href')));
  assert.deepEqual(guia,['guia-mare.html?modo=resumido&volta=kanban.html','guia-mare.html?modo=completo&volta=kanban.html','kanban.html'],'bloco do Guia do Maré com Resumido, Completo e Abrir o Maré');
  assert.equal(await page.locator('#oceano .bordo-card a[href="#guia-mare"]').count(),1,'cartão do Maré aponta pro guia');
  const style=await shortcuts.first().evaluate(el=>{const s=getComputedStyle(el);return {height:el.getBoundingClientRect().height,border:s.borderTopStyle,radius:parseFloat(s.borderRadius),decoration:s.textDecorationLine};});
  assert.ok(style.height>=44 && style.border==='solid' && style.radius>=10 && style.decoration==='none','atalhos são botões Marine Glass com área de toque');
  const fishRef=fs.readFileSync(path.join(root,'oceano.html'),'utf8').match(/const FISH_SVGS = (\[[\s\S]*?\]);/)[1];
  const expectedFish=require('node:vm').runInNewContext(fishRef);
  const backgrounds=await page.locator('.fish-float svg').evaluateAll(els=>els.map(el=>el.outerHTML));
  const normalizedExpected=await page.evaluate(items=>items.map(svg=>{const el=document.createElement('div');el.innerHTML=svg;return el.firstElementChild.outerHTML;}),Array.from(expectedFish));
  assert.ok(backgrounds.length>0 && backgrounds.every(svg=>normalizedExpected.includes(svg)),'peixes de fundo usam exatamente os SVGs do Oceano');
  const checkAquarium=async(selector)=>{
   const geometry=await page.locator(selector).evaluateAll(els=>els.map(el=>({
    tail:el.querySelector('polygon')?.getAttribute('points'),
    body:el.querySelector('ellipse')?.getAttribute('cx'),
    eye:el.querySelector('circle')?.getAttribute('cx')
   })));
   assert.equal(geometry.length,8,'oito stakeholders');
   assert.ok(geometry.every(f=>f.tail==='0,4 14,14 0,24' && f.body==='34' && f.eye==='47'),'aquário usa geometria do peixe do Maré/Oceano');
  };
  await checkAquarium('#stakeOcean .fish-svg');
  await shortcuts.first().focus();
  assert.equal(await shortcuts.first().evaluate(el=>getComputedStyle(el).outlineStyle),'solid','foco de teclado visível');
  if(!process.env.BORDO_BASE){
   fs.mkdirSync('docs/capturas/a-bordo-marine-glass',{recursive:true});
   await page.locator('#comece .bordo-atalhos').evaluate(el=>el.parentElement.scrollIntoView({block:'center'}));
   await page.locator('#comece .bordo-atalhos').locator('..').screenshot({path:`docs/capturas/a-bordo-marine-glass/atalhos-${width}.png`});
   await page.locator('#guia-mare').scrollIntoViewIfNeeded();
   await page.locator('#guia-mare').screenshot({path:`docs/capturas/a-bordo-marine-glass/guia-mare-${width}.png`});
  }

  assert.equal(await page.locator('#cultura .cultura-item').count(),5,'cinco comportamentos oficiais');
  assert.equal(await page.locator('#oceano .bordo-card').count(),6,'produtos explicados');
  const defects=await page.evaluate(()=>[...document.querySelectorAll('a[href^="#"]')].filter(a=>a.hash.length>1&&!document.getElementById(decodeURIComponent(a.hash.slice(1)))).map(a=>a.hash));
  assert.deepEqual(defects,[],'atalhos internos existentes');
  assert.equal(await page.locator('.sq-name').filter({hasText:/^Dados e IA$/}).count(),1);
  assert.match(await page.locator('.white-data-card').innerText(),/Caio Soares.*Agilidade e implementação de IA/s);
  assert.equal(await page.getByText('Allan Dickmann',{exact:true}).count(),2);
  assert.equal(await page.getByText('Karla Santos',{exact:true}).count(),0);
  await page.locator('#oceano details').last().locator('summary').click();
  assert.equal(await page.locator('#oceano details').last().getAttribute('open'),'');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'sem rolagem horizontal');
  if(width===390){await page.locator('.nav-burger').click();await page.locator('#navLinks a[href="#oceano"]').click();assert.ok(!await page.locator('#navLinks').evaluate(el=>el.classList.contains('open')));}
  await page.locator('#quiz').scrollIntoViewIfNeeded();
  assert.ok((await page.locator('#quizOptions button').count())>0,'quiz continua disponível');
  assert.deepEqual(errors,[],'sem erros de execução');
  if(!process.env.BORDO_BASE && !process.env.BORDO_SEM_CAPTURAS){fs.mkdirSync('docs/capturas/a-bordo',{recursive:true});for(const id of ['comece','cultura','oceano','squads']){await page.locator('#'+id).evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY-90));await page.screenshot({path:`docs/capturas/a-bordo/${id}-${width}.png`});}}
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.locator('#stakeOcean').scrollIntoViewIfNeeded();
  await page.locator('#stakeOcean').evaluate(el=>el.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=0;}));
  for(const key of ['crm','merchan','marca','gg','plan','cd','ti','canais']){
   await page.locator(`[data-fish="${key}"] .fish-svg`).click();
   assert.ok(await page.locator('#fishModal').evaluate(el=>el.classList.contains('open')),'clique do stakeholder abre modal');
   await page.keyboard.press('Escape');
  }
  if(!process.env.BORDO_BASE){fs.mkdirSync('docs/capturas/a-bordo-aquario',{recursive:true});await page.locator('#stakeOcean').screenshot({path:`docs/capturas/a-bordo-aquario/site-${width}.png`});}
  await page.goto(base+'/onboarding.slide.html');
  await page.evaluate(()=>{goTo(slides.findIndex(s=>s.id==='s10'));document.querySelector('.stake-slide').getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=0;});});
  await checkAquarium('.stake-slide .ss-fish-svg');
  for(let i=0;i<8;i++){
   await page.locator('.ss-fish-svg').nth(i).click();
   assert.ok(await page.locator('#fishModal').evaluate(el=>el.classList.contains('open')));
   await page.keyboard.press('Escape');
  }
  if(!process.env.BORDO_BASE)await page.locator('.stake-slide').screenshot({path:`docs/capturas/a-bordo-aquario/slides-${width}.png`});
  await page.emulateMedia({reducedMotion:'reduce'});
  const slideFish=await page.locator('.bg-fish svg').evaluateAll(els=>els.map(el=>el.outerHTML));
  assert.ok(slideFish.length>0 && slideFish.every(svg=>normalizedExpected.includes(svg)),'slides usam os mesmos peixes do Oceano');
  await page.evaluate(()=>goTo(slides.findIndex(s=>s.id==='s11')));
  assert.equal(await page.locator('#s11 .cu-item').count(),5);
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.locator('.slide.active').getAttribute('id'),'s11','seta vertical mantém leitura');
  await page.evaluate(()=>{
   const start=new Event('touchstart');start.touches=[{clientX:100,clientY:600}];document.dispatchEvent(start);
   const end=new Event('touchend');end.changedTouches=[{clientX:160,clientY:200}];document.dispatchEvent(end);
  });
  assert.equal(await page.locator('.slide.active').getAttribute('id'),'s11','rolagem diagonal vertical não troca slide');
  if(width===390){
   const readable=await page.locator('#s11').evaluate(el=>{el.scrollTop=el.scrollHeight;const last=el.querySelector('.cu-item:last-child');return last.getBoundingClientRect().bottom <= innerHeight-52;});
   assert.ok(readable,'último comportamento alcançável acima dos controles');
   await page.locator('#s11').evaluate(el=>el.scrollTop=0);
  }
  if(!process.env.BORDO_BASE && !process.env.BORDO_SEM_CAPTURAS) await page.screenshot({path:`docs/capturas/a-bordo/slide-cultura-${width}.png`});
  assert.ok(await page.locator('#s11').evaluate(el=>el.scrollHeight<=el.clientHeight+2 || ['auto','scroll'].includes(getComputedStyle(el).overflowY)),'cultura cabe no slide ou área de rolagem');
  await page.evaluate(()=>goTo(slides.findIndex(s=>s.id==='s-oceano')));
  assert.equal(await page.locator('#s-oceano .cu-item').count(),6);
  if(!process.env.BORDO_BASE && !process.env.BORDO_SEM_CAPTURAS) await page.screenshot({path:`docs/capturas/a-bordo/slide-oceano-${width}.png`});
  await page.evaluate(()=>goTo(slides.length-1));
  assert.equal(await page.locator('#btnNext').isDisabled(),true);
  assert.equal(await page.locator('#slideCounter').innerText(),'16 / 16');
  assert.equal(await page.getByText('Karla Santos',{exact:true}).count(),0);
  assert.match(await page.locator('#s4').innerText(),/Dados e IA/);
  await page.close();console.log(`✅ A Bordo: navegação, cultura, squads, Oceano, quiz e slides em ${width}px`);
 }
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
