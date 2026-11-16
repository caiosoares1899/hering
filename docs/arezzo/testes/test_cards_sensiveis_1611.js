// Provas de auditoria: exit 1 significa bug ainda presente; nenhum acesso ao Firebase real.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {chromium}=require(path.join(os.homedir(),'hering-tools/playwright/node_modules/playwright'));
(async()=>{
 const dir=path.join(os.homedir(),'hering-tools/chrome');
 const executablePath=path.join(dir,fs.readdirSync(dir).find(n=>n.startsWith('mac_arm-')),'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
 const b=await chromium.launch({executablePath,headless:true});
 try{
  const p=await b.newPage(); const raiz=path.resolve(__dirname,'../../..');
  await p.route('http://auditoria.local/**',r=>r.fulfill({contentType:'text/html',body:r.request().url().endsWith('/kanban-dev.html')?fs.readFileSync(path.join(raiz,'kanban-dev.html'),'utf8'):'<!doctype html><body></body>'}));
  await p.goto('http://auditoria.local/auditoria');
  const linhas=await p.evaluate(fs.readFileSync(path.join(__dirname,'console_cards_sensiveis_1611.js'),'utf8'));
  console.table(linhas); if(linhas.some(l=>l.resultado==='❌'))process.exitCode=1;
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
