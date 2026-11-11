// Guia estático: sem login e sem Firebase.
// Na raiz: python3 -m http.server 8957
// Depois: node docs/arezzo/testes/test_guia_mare_pagina.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const chromeRoot = path.join(home, 'hering-tools/chrome');
const chrome = process.env.CHROME || path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n=>n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8957';
const expected=['board','card-criar','card-mover','card-funcoes','comentar','notificacoes','meu-dia','sonar','agente'];
const extras=['agil','raia','filtros','selecionar','calendarios','campanhas','intake','timeline','dashboard','criativos','dependencias','links','automacoes','comunicacao','kudos','ilha','dicas','metas','tema','config','pausar-continuo','arquivar-excluir','duplicar-modelo','spotify'];
let assertions=0,failures=0;
const t=(name,cond,detail)=>{assertions++;if(!cond)failures++;console.log((cond?'✅ ':'❌ ')+name+(cond?'':' → '+JSON.stringify(detail)));};
const iso=s=>typeof s==='string' && /^\d{4}-\d\d-\d\dT/.test(s) && !Number.isNaN(Date.parse(s));
(async()=>{
 const browser=await chromium.launch({executablePath:chrome,headless:true});
 try{
 for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
  const ctx=await browser.newContext({viewport}),p=await ctx.newPage(),errors=[];
  p.setDefaultTimeout(10000);p.on('pageerror',e=>errors.push(e.message));
  const label=viewport.width+'px · ';
  const go=async query=>{await p.goto(base+'/guia-mare.html?'+query);await p.waitForFunction(()=>!!window.GuiaMare);};
  const move=async id=>{const ids=await p.evaluate(()=>GuiaMare.passos(GuiaMare.estado().modo));const n=ids.indexOf(id);if(n<0)throw Error('Passo ausente: '+id);await p.locator('body').click({position:{x:2,y:2}});for(let i=0;i<ids.length+1;i++){const state=await p.evaluate(()=>GuiaMare.estado());if(state.idx===n)return;await p.keyboard.press(state.idx<n?'ArrowRight':'ArrowLeft');}throw Error('Navegação não chegou a '+id);};
  // O desenho e o ResizeObserver precisam concluir antes de medir a moldura.
  const desenhada=()=>p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await go('modo=completo&agente=1');
  for(const id of [...expected,...extras]){
   await move(id);await desenhada();
   const tela=await p.evaluate(()=>{
    const fig=document.querySelector('figure.tela'),host=fig?.querySelector('.tela-host'),sr=host?.shadowRoot;
    if(!sr)return {figure:!!fig,shadow:false};
    const eventos=[],hrefs=[];
    for(const el of sr.querySelectorAll('*'))for(const attr of el.attributes){
     if(/^on/i.test(attr.name))eventos.push(el.tagName+':'+attr.name);
     if(attr.localName.toLowerCase()==='href')hrefs.push(el.tagName+':'+attr.name);
    }
    const vp=sr.querySelector('.mg-html > .mg-vp');
    return {figure:true,shadow:true,viewport:!!vp&&vp.offsetWidth===1280&&vp.offsetHeight===760,
     scripts:sr.querySelectorAll('script').length,eventos,hrefs,alvo:!!sr.querySelector('.mg-alvo')};
   });
   t(label+'tela real com shadowRoot: '+id,tela.figure&&tela.shadow,tela);
   t(label+'viewport capturado 1280×760: '+id,tela.viewport===true,tela);
   t(label+'captura sem script, on* ou href: '+id,tela.scripts===0&&tela.eventos?.length===0&&tela.hrefs?.length===0,tela);
   t(label+'destaque conforme o passo: '+id,tela.alvo===!['criativos','spotify'].includes(id),tela);
   if(viewport.width===390)t(label+'Completo sem rolagem horizontal: '+id,await p.evaluate(w=>document.documentElement.scrollWidth<=w,viewport.width));
  }
  await go('modo=resumido&agente=1');
  for(const id of expected){
   await move(id);await desenhada();
   const area=await p.evaluate(()=>{
    const host=document.querySelector('figure.tela .tela-host'),alvo=host?.shadowRoot?.querySelector('.mg-alvo');
    if(!host||!alvo)return null;
    const h=host.getBoundingClientRect(),a=alvo.getBoundingClientRect();
    return {host:{x:h.x,y:h.y,w:h.width,h:h.height},alvo:{x:a.x,y:a.y,w:a.width,h:a.height},
     visivel:h.width>0&&h.height>0&&a.width>0&&a.height>0&&Math.min(h.right,a.right)>Math.max(h.left,a.left)&&Math.min(h.bottom,a.bottom)>Math.max(h.top,a.top)};
   });
   t(label+'destaque intersecta a moldura: '+id,area?.visivel===true,area);
  }
  if(viewport.width===390){
   // Card pequeno garante alturas diferentes entre aproximação e tela inteira.
   await move('card-mover');await desenhada();
   const botao=p.locator('figure.tela .tela-bar button'),host=p.locator('figure.tela .tela-host');
   const altura=()=>host.evaluate(el=>el.getBoundingClientRect().height);
   const antes=await altura();
   t(label+'zoom inicia com Tela inteira',await botao.isVisible()&&(await botao.textContent())==='🖥 Tela inteira');
   await botao.click();await desenhada();const inteira=await altura();
   t(label+'zoom oferece Aproximar e muda altura',(await botao.textContent())==='🔍 Aproximar'&&Math.abs(inteira-antes)>1,{antes,inteira});
   await botao.click();await desenhada();const aproximada=await altura();
   t(label+'zoom volta a Tela inteira e restaura altura',(await botao.textContent())==='🖥 Tela inteira'&&Math.abs(aproximada-inteira)>1&&Math.abs(aproximada-antes)<=1,{antes,inteira,aproximada});
  }
  for(const theme of ['light','dark']){
   await p.evaluate(()=>{window.__telaAnterior=document.querySelector('figure.tela .tela-host');});
   await p.selectOption('#theme',theme);await desenhada();
   const tema=await p.evaluate(()=>{
    const host=document.querySelector('figure.tela .tela-host'),html=host?.shadowRoot?.querySelector('.mg-html');
    return {redesenhou:!!host&&host!==window.__telaAnterior,html:!!html,tema:html?.getAttribute('data-theme')};
   });
   t(label+'tema redesenha captura: '+theme,tema.redesenhou&&tema.html&&tema.tema===(theme==='light'?'light':null),tema);
  }
  await go('modo=resumido&squad=dados&agente=1&volta=kanban-dev.html');
  t(label+'9 ids na ordem',JSON.stringify(await p.evaluate(()=>GuiaMare.passos('resumido')))===JSON.stringify(expected));
  t(label+'33 ids completos na ordem',JSON.stringify(await p.evaluate(()=>GuiaMare.passos('completo')))===JSON.stringify([...expected,...extras]));
  await move('sonar');await p.evaluate(()=>{window.__opens=[];window.open=(...args)=>window.__opens.push(args);});await p.locator('#do-board').click();
  t(label+'Sonar abre aba mare_board',JSON.stringify(await p.evaluate(()=>__opens[0]))===JSON.stringify(['kanban-dev.html?squad=dados&tour=sonar','mare_board']));
  await p.locator('#ask-agent').click();t(label+'hotline na aba nomeada',JSON.stringify(await p.evaluate(()=>__opens[1]))===JSON.stringify(['kanban-dev.html?squad=dados&hotline=1','mare_board']));
  await go('modo=completo&agente=1');await move('raia');t(label+'Raia sem Fazer no board',await p.locator('#do-board').count()===0);
  await go('modo=resumido&agente=0');t(label+'8 passos sem Agente',JSON.stringify(await p.evaluate(()=>GuiaMare.passos('resumido')))===JSON.stringify(expected.slice(0,8)));t(label+'nenhum botão do Agente',await p.getByRole('button',{name:'🤖 Pergunte ao Agente'}).count()===0);
  for(const id of expected.slice(0,8)){await move(id);t(label+'sem rolagem horizontal: '+id,await p.evaluate(w=>document.documentElement.scrollWidth<=w,viewport.width));}
  await go('modo=invalido');t(label+'modo inválido abre escolha',await p.locator('#short').isVisible());await p.locator('#short').click();t(label+'escolha inicia percurso',(await p.evaluate(()=>GuiaMare.estado())).id==='board');
  await go('modo=resumido&volta=https://evil.com&squad=%3Cx%3E');await p.evaluate(()=>{window.open=(...args)=>window.__open=args;});await p.locator('#do-board').click();t(label+'volta restrita e squad inválida ignorada',JSON.stringify(await p.evaluate(()=>__open))===JSON.stringify(['kanban.html?tour=board','mare_board']));
  await go('modo=resumido&squad=%3Cimg%20src%3Dx%20onerror%3Dwindow.__x%3D1%3E');t(label+'URL não injeta HTML',await p.evaluate(()=>!window.__x&&document.querySelectorAll('img').length===0));
  await p.evaluate(()=>{localStorage.clear();localStorage.setItem('guia_mare_prog',JSON.stringify({passos:{'x-antigo':'2026-11-11T10:00:00.000Z'}}));});await p.reload();await p.locator('#complete').click();
  const prog=await p.evaluate(()=>JSON.parse(localStorage.getItem('guia_mare_prog')));t(label+'grava ISO preservando chave anterior',iso(prog.passos.board)&&prog.passos['x-antigo']==='2026-11-11T10:00:00.000Z',prog);
  await p.evaluate(()=>{localStorage.clear();localStorage.setItem('guia_mare_prog_espelho',JSON.stringify({passos:{board:'2026-11-11T10:00:00.000Z'}}));});await go('modo=completo');t(label+'espelho mostra ✓ no índice',await p.locator('[data-step="board"]').textContent().then(s=>s.startsWith('✓')));
  await p.evaluate(()=>{localStorage.setItem('guia_mare_prog_espelho',JSON.stringify({passos:{sonar:'2026-11-11T10:00:00.000Z'}}));window.dispatchEvent(new StorageEvent('storage',{key:'guia_mare_prog_espelho'}));});t(label+'storage atualiza ✓',await p.locator('[data-step="sonar"]').textContent().then(s=>s.startsWith('✓')));
  await p.evaluate(()=>{localStorage.setItem('guia_mare_prog_espelho',JSON.stringify({passos:{agil:'2026-11-11T10:00:00.000Z'}}));window.dispatchEvent(new Event('focus'));});t(label+'foco atualiza ✓',await p.locator('[data-step="agil"]').textContent().then(s=>s.startsWith('✓')));
  await p.evaluate(()=>localStorage.clear());await go('modo=resumido&agente=1');for(let i=0;i<9;i++)await p.locator('#complete').click();const end=await p.evaluate(()=>JSON.parse(localStorage.getItem('guia_mare_prog')));t(label+'fim grava resumido ISO',iso(end.resumido)&&Object.keys(end.passos).length===9,end);t(label+'atalho ao outro modo',await p.locator('#other').isVisible());
  for(const theme of ['light','dark','system']){await p.selectOption('#theme',theme);t(label+'tema '+theme,await p.evaluate(v=>document.documentElement.dataset.themePreference===v&&['light','dark'].includes(document.documentElement.dataset.theme),theme));}
  // teclado: a tela capturada é inerte — o Tab vai do título do passo para os botões do guia, sem entrar no board clonado
  await go('modo=resumido&agente=1');await move('card-funcoes');await p.focus('#step-title');
  let preso=false;for(let i=0;i<8;i++){await p.keyboard.press('Tab');const r=await p.evaluate(()=>{const a=document.activeElement;const h=document.querySelector('.tela-host');return {host:!!(a&&a.closest&&a.closest('.tela-host')),dentro:!!(h&&h.shadowRoot&&h.shadowRoot.activeElement),inert:!!(h&&h.inert)};});if(r.host||r.dentro||!r.inert)preso=true;}
  t(label+'Tab não entra na tela capturada (inert)',!preso);
  t(label+'sem pageerror',errors.length===0,errors);await ctx.close();
  const blocked=await browser.newContext({viewport});await blocked.addInitScript(()=>{Storage.prototype.getItem=function(){throw Error('bloqueado');};Storage.prototype.setItem=function(){throw Error('bloqueado');};});const bp=await blocked.newPage(),be=[];bp.on('pageerror',e=>be.push(e.message));await bp.goto(base+'/guia-mare.html?modo=resumido');await bp.locator('#complete').click();await bp.keyboard.press('ArrowRight');t(label+'storage bloqueado permite navegar',await bp.evaluate(()=>GuiaMare.estado().idx===2));t(label+'storage bloqueado sem pageerror',be.length===0,be);await blocked.close();
 }
 const html=fs.readFileSync(path.resolve(__dirname,'../../../guia-mare.html'),'utf8');t('Página menor que 400 KB',Buffer.byteLength(html)<400*1024,Buffer.byteLength(html));t('Sem imagens remotas ou GIF',!/<img\b[^>]*src\s*=\s*["']?https?:/i.test(html)&&!html.toLowerCase().includes('.gif'));t('Sem scripts externos, Firebase ou fetch',!/<script\b[^>]*src\s*=/i.test(html)&&!/\bfetch\s*\(|firebase/i.test(html));
 }finally{await browser.close();}
 console.log(failures?`${failures} FALHA(S) / ${assertions}`:`TUDO OK · ${assertions} verificações`);process.exitCode=failures?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
