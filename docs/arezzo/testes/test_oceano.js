// Oceano (oceano-dev.html): login Google, saudação, vitrine por pessoa, temas, peixinhos, hospedagem dos produtos em iframe,
// troca de produto pelo menu de 9 pontinhos DENTRO do Oceano, perfil/cadastro e ajuda.
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const U=(uid,n,email,extra)=>Object.assign({uid,email:email||uid+'@ciahering.com.br',displayName:n,photoURL:'',providerData:[{providerId:'google.com'}]},extra||{});
const seed=()=>({kanban:{usuarios:{ana:{uid:'ana',nome:'Ana Silva',email:'ana@ciahering.com.br',init:'AS',role:'adm',squads:{dev:true,dados:true}},eve:{uid:'eve',nome:'Eve Souza',email:'eve@ciahering.com.br',init:'ES',role:'membro'}},config:{adm_emails:['ana@ciahering.com.br']}}});
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true; const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,300))); };
 const open=async(user,{w=1280,h=800,seedF=seed,reduce=false}={})=>{ const ctx=await b.newContext({viewport:{width:w,height:h},reducedMotion:reduce?'reduce':'no-preference'}); await fake.install(ctx,seedF()); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); await p.goto('http://localhost:8941/oceano-dev.html'); await p.waitForFunction(()=>!!window.__authCb); if(user) { await p.evaluate(x=>window.__authCb(x),user); await p.waitForTimeout(900); } return {ctx,p,errs}; };
 // 1) sem login: só a tela de entrar
 { const {ctx,p}=await open(null); const r=await p.evaluate(()=>({login:getComputedStyle(document.getElementById('login')).display, app:getComputedStyle(document.getElementById('app')).display}));
   t('sem login: aparece só a tela de login (conteúdo escondido)', r.login==='flex' && r.app==='none', r); await ctx.close(); }
 // 2) conta que não é da Hering é barrada
 { const {ctx,p}=await open(U('x','Fulano','x@gmail.com')); const r=await p.evaluate(()=>({err:document.getElementById('login-err').textContent, app:getComputedStyle(document.getElementById('app')).display, signedOut:window.__signedOut}));
   t('Gmail é barrado, com a dica do Radar', /@ciahering/.test(r.err) && r.app==='none' && r.signedOut>=1, r); await ctx.close(); }
 // 3) ADM: saudação, 4 cabines + Travessia, Painel visível
 { const {ctx,p,errs}=await open(U('ana','Ana Silva')); const r=await p.evaluate(()=>({h1:document.getElementById('h1-boas').textContent, cab:[...document.querySelectorAll('#cabines .cabine h3')].map(x=>x.textContent), btn:document.getElementById('btn-continuar').textContent, cadastro:window.__log.filter(l=>l[0]==='update').map(l=>l[1])}));
   console.log('ADM:',JSON.stringify(r));
   t('ADM: saudação com o primeiro nome', /Ana/.test(r.h1), r.h1); t('ADM: vê Maré, Painel, Radar, A Bordo e Travessia (em breve)', r.cab.join()==='Maré Digital,Painel,Radar,A Bordo,Travessia', r.cab);
   t('já tem cadastro: não cria de novo', !r.cadastro.some(x=>/kanban\/usuarios\/ana$/.test(x)), r.cadastro);
   // temas
   await p.click('#btn-eu'); await p.waitForTimeout(200); const padrao=await p.evaluate(()=>document.documentElement.getAttribute('data-theme')); t('tema padrão é o Abrolhos da marca (sem data-theme), como as outras páginas', padrao===null, padrao);
   await p.click('#op-tema button[data-tema="lencois"]'); await p.waitForTimeout(700);
   const tema=await p.evaluate(()=>({t:document.documentElement.getAttribute('data-theme'), ls:JSON.parse(localStorage.getItem('oceano_prefs')).tema, mare:localStorage.getItem('mare_theme'), fb:window.__log.filter(l=>l[0]==='update'&&/oceano$/.test(l[1])).length}));
   t('tema Lençóis aplica (data-theme="light"), vale nas outras páginas (mare_theme) e grava no cadastro', tema.t==='light' && tema.ls==='lencois' && tema.mare==='light' && tema.fb>=1, tema);
   await p.click('#op-tema button[data-tema="entardecer"]'); await p.waitForTimeout(200); t('Entardecer é opcional (data-theme="sunset")', (await p.evaluate(()=>document.documentElement.getAttribute('data-theme')))==='sunset', 'tema');
   // peixinhos
   const cont=async()=>p.evaluate(()=>({peixes:document.querySelectorAll('#fwrap .fish-ltr,#fwrap .fish-rtl').length,bolhas:document.querySelectorAll('#bwrap .bubble').length,svgs:[...new Set([...document.querySelectorAll('#fwrap svg')].map(x=>x.getAttribute('viewBox')))].sort().join('|')}));
   await p.click('#op-peixes button[data-peixes="normal"]'); const mu=await cont(); await p.click('#op-peixes button[data-peixes="off"]'); const off=await cont();
   t('peixinhos iguais aos do Maré: 8 peixes e 16 bolhas, com as 3 silhuetas; desligados = 0', mu.peixes===8 && mu.bolhas===16 && mu.svgs==='0 0 42 22|0 0 60 28|0 0 72 34' && off.peixes===0 && off.bolhas===0, {mu,off});
   t('desligar espelha no liga/desliga do Maré (fish_bg_off)', await p.evaluate(()=>localStorage.getItem('fish_bg_off')==='1'), 'fish_bg_off');
   // sigla
   await p.fill('#pf-init','mm'); await p.dispatchEvent('#pf-init','change'); await p.waitForTimeout(300);
   t('sigla grava em kanban/usuarios/uid', await p.evaluate(()=>window.__log.some(l=>l[0]==='update'&&l[1]==='kanban/usuarios/ana')), 'sem update');
   await p.keyboard.press('Escape'); await p.waitForTimeout(150); t('Esc fecha o perfil', !(await p.evaluate(()=>document.getElementById('ov-perfil').classList.contains('open'))), 'aberto');
   t('sem erro de JS (ADM)', !errs.length, errs); await ctx.close(); }
 // 4) membro sem uso do painel: não vê Painel; sem cadastro → cria
 { const {ctx,p}=await open(U('eve','Eve Souza')); const r=await p.evaluate(()=>[...document.querySelectorAll('#cabines .cabine h3')].map(x=>x.textContent));
   t('membro sem uso do Painel: não vê o Painel na cabine', !r.includes('Painel') && r.includes('Radar'), r);
   t('aba "Painel" mostra que precisa pedir acesso', await p.evaluate(()=>{ document.querySelector('.aba[data-prod="painel"]').click(); return /ainda não usa o Painel/.test(document.getElementById('painel-prod').textContent); }), 'sem aviso'); await ctx.close(); }
 { const {ctx,p}=await open(U('nova','Nova Pessoa')); const r=await p.evaluate(()=>window.__log.filter(l=>l[0]==='update').map(l=>l[1]));
   t('pessoa sem registro: cria o cadastro básico (update, nunca set)', r.includes('kanban/usuarios/nova'), r); await ctx.close(); }
 // 5) hospedagem: abre o Radar dentro do Oceano, troca pelo menu de produtos do próprio Radar
 { const {ctx,p,errs}=await open(U('ana','Ana Silva')); await p.evaluate(()=>{ const s=JSON.parse(localStorage.getItem('oceano_prefs')||'{}'); s.abrir='aqui'; localStorage.setItem('oceano_prefs',JSON.stringify(s)); });
   await p.reload(); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U('ana','Ana Silva')); await p.waitForTimeout(900);
   await p.click('#cabines button[data-app="okr"]'); await p.waitForTimeout(1500);
   const r=await p.evaluate(()=>({host:document.getElementById('host').classList.contains('on'), fr:[...document.querySelectorAll('#host-frames iframe')].map(f=>f.dataset.app+'|'+f.getAttribute('name')+'|'+f.getAttribute('src')), hash:location.hash, titulo:document.title, tabs:[...document.querySelectorAll('.htab')].map(x=>x.textContent.replace('✕','').trim())}));
   console.log('HOST:',JSON.stringify(r)); t('Radar abre dentro do Oceano (iframe nomeado, aba, hash e título)', r.host && r.fr.length===1 && /okr\|oceano-frame\|okr-dev\.html/.test(r.fr[0]) && r.hash==='#/okr' && /Radar/.test(r.titulo) && r.tabs[0]==='Radar', r);
   const fr=p.frames().find(f=>/okr-dev\.html/.test(f.url())); await fr.waitForFunction(()=>!!window.__authCb); await fr.evaluate(x=>window.__authCb(x),U('ana','Ana Silva')); await fr.waitForTimeout(2200);
   const temBtn=await fr.evaluate(()=>!!document.getElementById('mn-apps-btn')); t('o Radar (dentro do Oceano) mostra o menu de 9 pontinhos', temBtn, 'sem botão');
   await fr.click('#mn-apps-btn'); await fr.waitForTimeout(300);
   const itens=await fr.evaluate(()=>[...document.querySelectorAll('#mn-apps-pop .mn-app-n')].map(x=>x.textContent)); t('o menu lista o Oceano primeiro', itens[0]==='Oceano' && itens.includes('Maré Digital'), itens);
   await fr.click('#mn-apps-pop a[data-app="kanban"]'); await p.waitForTimeout(1200);
   const r2=await p.evaluate(()=>({atual:location.hash, tabs:document.querySelectorAll('.htab').length, on:document.querySelector('#host-frames iframe.on')?.dataset.app}));
   t('clicar em Maré Digital no menu do Radar troca o produto no Oceano (sem aba nova)', r2.on==='kanban' && r2.tabs===2 && r2.atual==='#/kanban', r2);
   await fr.evaluate(()=>{}).catch(()=>{});
   await p.evaluate(()=>window.postMessage({oceano:'lobby'},location.origin)); await p.waitForTimeout(300);
   t('mensagem "lobby" volta pro lobby e mantém os 2 produtos abertos', await p.evaluate(()=>!document.getElementById('host').classList.contains('on') && document.querySelectorAll('#host-frames iframe').length===2 && document.getElementById('abertos').classList.contains('on')), 'host');
   await p.click('#abertos button[data-app="okr"]'); await p.waitForTimeout(300); await p.click('.htab[data-ht="okr"] .fx'); await p.waitForTimeout(200);
   t('fechar uma aba mantém a outra', await p.evaluate(()=>document.querySelectorAll('#host-frames iframe').length===1 && document.querySelector('#host-frames iframe.on')?.dataset.app==='kanban'), 'abas'); await ctx.close(); }
 // 6) automático em aba normal abre aba nova (não hospeda)
 { const {ctx,p}=await open(U('ana','Ana Silva')); const pop=p.waitForEvent('popup'); await p.click('#cabines button[data-app="kanban"]'); const np=await pop; t('modo automático no navegador: abre em aba nova (não no host)', /kanban-dev\.html/.test(np.url()) && !(await p.evaluate(()=>document.getElementById('host').classList.contains('on'))), np.url()); await ctx.close(); }
 // 7) ajuda + busca; movimento reduzido
 { const {ctx,p}=await open(U('ana','Ana Silva'),{reduce:true}); const c=await p.evaluate(()=>({peixes:document.querySelectorAll('#fwrap div').length, ajuda:(document.getElementById('btn-ajuda').click(), document.querySelectorAll('#faq details').length)}));
   await p.fill('#ajuda-busca','instalar'); const f=await p.evaluate(()=>[...document.querySelectorAll('#faq summary')].map(x=>x.textContent));
   t('movimento reduzido do sistema: peixinhos começam desligados', c.peixes===0 && c.ajuda>=8, c); t('busca da ajuda filtra', f.length>=1 && f.length<c.ajuda && f.some(x=>/instalo/i.test(x)), f); await ctx.close(); }
 // 8) celular
 { const {ctx,p,errs}=await open(U('ana','Ana Silva'),{w:390,h:844}); const r=await p.evaluate(()=>({sx:document.documentElement.scrollWidth>document.documentElement.clientWidth+1})); t('celular: sem rolagem lateral', !r.sx, r); await p.screenshot({path:process.env.SHOT||'oceano_m.png'}); t('sem erro de JS (celular)', !errs.length, errs); await ctx.close(); }
 await b.close(); console.log(ok?'TUDO OK':'HÁ FALHAS'); })();
