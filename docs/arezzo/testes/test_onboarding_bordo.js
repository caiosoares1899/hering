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
  if(!process.env.BORDO_BASE){fs.mkdirSync('docs/capturas/a-bordo',{recursive:true});for(const id of ['comece','cultura','oceano','squads']){await page.locator('#'+id).evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY-90));await page.screenshot({path:`docs/capturas/a-bordo/${id}-${width}.png`});}}
  await page.goto(base+'/onboarding.slide.html');
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
  if(!process.env.BORDO_BASE) await page.screenshot({path:`docs/capturas/a-bordo/slide-cultura-${width}.png`});
  assert.ok(await page.locator('#s11').evaluate(el=>el.scrollHeight<=el.clientHeight+2 || ['auto','scroll'].includes(getComputedStyle(el).overflowY)),'cultura cabe no slide ou área de rolagem');
  await page.evaluate(()=>goTo(slides.findIndex(s=>s.id==='s-oceano')));
  assert.equal(await page.locator('#s-oceano .cu-item').count(),6);
  if(!process.env.BORDO_BASE) await page.screenshot({path:`docs/capturas/a-bordo/slide-oceano-${width}.png`});
  await page.evaluate(()=>goTo(slides.length-1));
  assert.equal(await page.locator('#btnNext').isDisabled(),true);
  assert.equal(await page.locator('#slideCounter').innerText(),'16 / 16');
  assert.equal(await page.getByText('Karla Santos',{exact:true}).count(),0);
  assert.match(await page.locator('#s4').innerText(),/Dados e IA/);
  await page.close();console.log(`✅ A Bordo: navegação, cultura, squads, Oceano, quiz e slides em ${width}px`);
 }
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
