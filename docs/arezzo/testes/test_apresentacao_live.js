// Apresentação ao vivo (okr-apresentacao.slide.html): apresentador comanda o slide e o detalhe, quem abre acompanha, laser, caneta, passar/pedir o controle, assumir, encerrar.
// Duas páginas na mesma máquina; o Firebase falso é por página, então "sync" copia o nó apresentacao_live de uma pra outra e dispara os ouvintes (como o banco real faria).
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const U=(uid,n,email)=>({uid,email:email||uid+'@ciahering.com.br',displayName:n,photoURL:'',providerData:[{providerId:'google.com'}]});
const mk=(id,t,o)=>({id,titulo:t,areaId:'geral',trimestres:['2026-Q4'],responsaveis:['ana'],tagIds:[],history:[],indicadores:['i1'],progressos:['p1'],proximosPassos:[],riscos:[],planosAcao:[],descricao:'desc '+t,torre:'digital',...o});
const seed=()=>({kanban:{okr:{objetivos:{d1:mk('d1','Fidelidade',{areaId:'crm',ordem:0}),d2:mk('d2','Checkout',{areaId:'tech',ordem:0}),d3:mk('d3','NPS',{areaId:'cx',ordem:0})},marcos:{},tags:{},reuniao_notas:{}},
 usuarios:{ana:{uid:'ana',nome:'Ana ADM',email:'ana@ciahering.com.br',inscrito:true,init:'AA'},eve:{uid:'eve',nome:'Eve',email:'eve@ciahering.com.br',inscrito:true,init:'EV'}},usuarios_publicos:{ana:{uid:'ana',nome:'Ana ADM',init:'AA'}},config:{adm_emails:['ana@ciahering.com.br']},painel_viewers:{'ext@gmail,com':true}}});
const NO='kanban/okr/apresentacao_live';
async function sync(from,to){ const n=await from.evaluate(()=>JSON.stringify(((window.__store.kanban||{}).okr||{}).apresentacao_live||null));
  await to.evaluate(([n,NO])=>{ const v=JSON.parse(n), st=window.__store; st.kanban=st.kanban||{}; st.kanban.okr=st.kanban.okr||{}; if(v===null) delete st.kanban.okr.apresentacao_live; else st.kanban.okr.apresentacao_live=v;
    (window.__lis||[]).filter(l=>l.p===NO).forEach(l=>l.cb({val:()=>v===null?null:JSON.parse(JSON.stringify(v)), exists:()=>v!==null, key:'apresentacao_live'})); },[n,NO]); await to.waitForTimeout(250); }
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true; const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,300))); };
 const open=async(user,w=1280,h=800)=>{ const ctx=await b.newContext({viewport:{width:w,height:h}}); await fake.install(ctx,seed()); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept()); await p.goto('http://localhost:8941/okr-apresentacao.slide.html'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),user); await p.waitForTimeout(1500); return {ctx,p,errs}; };
 const A=await open(U('ana','Ana ADM')), B=await open(U('eve','Eve Souza'));
 const info=p=>p.evaluate(()=>({key:slides[currentIdx].key, idx:currentIdx, det:document.getElementById('detail-ov').classList.contains('open')?_okrDetailCurrentId:'', box:document.getElementById('live-box').textContent.replace(/\s+/g,' ').trim()}));
 t('antes de apresentar: botão "Apresentar ao vivo" na barra', /Apresentar ao vivo/.test((await info(A.p)).box), await info(A.p));
 await A.p.click('#live-box button'); await A.p.waitForTimeout(300); await sync(A.p,B.p);
 const a1=await info(A.p), b1=await info(B.p); t('Ana vira apresentadora; Eve vê "Ana ADM está apresentando" e acompanhando', /Você está apresentando/.test(a1.box) && /Ana ADM está apresentando/.test(b1.box) && /Acompanhando/.test(b1.box), {a1,b1});
 await A.p.evaluate(()=>window._okrGoTo(2)); await A.p.waitForTimeout(250); await sync(A.p,B.p); const a2=await info(A.p), b2=await info(B.p);
 t('slide do apresentador chega no acompanhante (pela chave, não pela posição)', a2.idx===2 && b2.key===a2.key && b2.idx===2, {a2,b2});
 await A.p.evaluate(()=>window._okrOpenDetail('d2')); await A.p.waitForTimeout(250); await sync(A.p,B.p); t('Objetivo aberto no detalhe também acompanha', (await info(B.p)).det==='d2', await info(B.p));
 await A.p.evaluate(()=>window._okrCloseDetail()); await A.p.waitForTimeout(250); await sync(A.p,B.p); t('fechar o detalhe fecha pra todos', (await info(B.p)).det==='', await info(B.p));
 // acompanhante mexe sozinho -> sai da sincronização; "Voltar a seguir" volta
 await B.p.evaluate(()=>window._okrGoTo(0)); await B.p.waitForTimeout(200); const b3=await info(B.p); t('mexer nos slides por conta própria sai da sincronização (e aparece "Voltar a seguir")', b3.idx===0 && /Voltar a seguir/.test(b3.box), b3);
 await A.p.evaluate(()=>window._okrGoTo(3)); await A.p.waitForTimeout(250); await sync(A.p,B.p); t('fora da sincronização, o slide do apresentador NÃO puxa a pessoa', (await info(B.p)).idx===0, await info(B.p));
 await B.p.evaluate(()=>window._liveSeguir()); await B.p.waitForTimeout(200); t('"Voltar a seguir" leva ao slide atual do apresentador', (await info(B.p)).idx===3, await info(B.p));
 // laser
 await A.p.keyboard.press('l'); await A.p.mouse.move(640,360); await A.p.waitForTimeout(150); await A.p.mouse.move(700,400); await A.p.waitForTimeout(150); await sync(A.p,B.p);
 const lz=await B.p.evaluate(()=>{ const e=document.getElementById('live-laser'); return {d:getComputedStyle(e).display, l:e.style.left, t:e.style.top}; });
 t('laser do apresentador aparece pro acompanhante, na mesma posição relativa', lz.d==='block' && Math.abs(parseFloat(lz.l)-700/1280*100)<1.5 && Math.abs(parseFloat(lz.t)-400/800*100)<1.5, lz);
 await A.p.keyboard.press('l');
 // caneta
 await A.p.keyboard.press('p'); await A.p.mouse.move(300,300); await A.p.mouse.down(); await A.p.mouse.move(400,350,{steps:6}); await A.p.mouse.move(500,300,{steps:6}); await A.p.mouse.up(); await A.p.waitForTimeout(250); await sync(A.p,B.p);
 const px=async p=>p.evaluate(()=>{ const c=document.getElementById('live-canvas'), d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for(let i=3;i<d.length;i+=4) if(d[i]>0) n++; return n; });
 t('traço da caneta fica salvo e aparece pro acompanhante', (await A.p.evaluate(()=>Object.keys((window.__store.kanban.okr.apresentacao_live.tracos)||{}).length))===1 && await px(B.p)>200, {a:await px(A.p), b:await px(B.p)});
 // com a caneta LIGADA os botões da barra seguem clicáveis (bug: a camada da caneta cobria a barra e não dava pra desligar nem limpar)
 await A.p.evaluate(()=>window._livePainel(true)); await A.p.waitForTimeout(100);
 t('com a caneta ligada, clicar em 🖍️ no painel DESLIGA (clique de verdade, não só tecla)', await (async()=>{ await A.p.click('#live-fpanel button:has-text("Caneta")'); await A.p.waitForTimeout(200); return await A.p.evaluate(()=>!document.body.classList.contains('live-pen')); })(), 'continuou ligada');
 await A.p.click('#live-fpanel button:has-text("Caneta")'); await A.p.waitForTimeout(150); await A.p.click('#live-fpanel button[title^="Apaga"]'); await A.p.waitForTimeout(250); await sync(A.p,B.p);
 t('com a caneta ligada, clicar em 🧽 limpa os traços (nos dois lados)', (await px(A.p))===0 && (await px(B.p))===0, {a:await px(A.p), b:await px(B.p)});
 await A.p.mouse.move(300,300); await A.p.mouse.down(); await A.p.mouse.move(420,360,{steps:5}); await A.p.mouse.up(); await A.p.waitForTimeout(200);
 t('a caneta ainda desenha na área dos slides (abaixo da barra)', (await px(A.p))>100, await px(A.p));
 await A.p.keyboard.press('Escape'); await A.p.evaluate(()=>window._okrGoTo(1)); await A.p.waitForTimeout(250); await sync(A.p,B.p); t('traços são por slide: em outro slide a tela fica limpa', await px(B.p)===0, await px(B.p));
 await A.p.evaluate(()=>window._okrGoTo(3)); await A.p.waitForTimeout(250); await sync(A.p,B.p); t('e voltam quando se retorna ao slide', await px(B.p)>200, await px(B.p));
 await A.p.evaluate(()=>window._liveLimpar()); await A.p.waitForTimeout(200); await sync(A.p,B.p); t('🧽 limpa os traços pra todos', await px(B.p)===0, await px(B.p));
 // caneta TEMPORÁRIA (some sozinha em ~5 s) × FIXA (fica até apagar) + desfazer
 await A.p.evaluate(()=>window._liveLimpar()); await A.p.waitForTimeout(150);
 await A.p.keyboard.press('t'); t('tecla T liga a caneta no tipo temporária (dentro da caneta, não como outra ferramenta)', await A.p.evaluate(()=>liveFerr==='caneta' && liveTipo==='t' && document.body.classList.contains('live-pen') && document.querySelectorAll('#live-fpanel .lp-seg button.on')[0].textContent.startsWith('Temporária')), 'não ligou');
 await A.p.mouse.move(300,300); await A.p.mouse.down(); await A.p.mouse.move(420,360,{steps:5}); await A.p.mouse.up(); await A.p.waitForTimeout(250); await sync(A.p,B.p);
 const tmp=await A.p.evaluate(()=>Object.values(window.__store.kanban.okr.apresentacao_live.tracos||{}).map(x=>x.m+':'+x.fim));
 t('traço temporário aparece pro apresentador e pro acompanhante, marcado como temporário e pronto', tmp.join()==='t:true' && await px(A.p)>100 && await px(B.p)>100, {tmp, a:await px(A.p), b:await px(B.p)});
 await A.p.keyboard.press('p'); await A.p.mouse.move(300,450); await A.p.mouse.down(); await A.p.mouse.move(420,480,{steps:5}); await A.p.mouse.up(); await A.p.waitForTimeout(250); await sync(A.p,B.p);
 t('caneta fixa (tecla P) convive com a temporária', (await A.p.evaluate(()=>Object.values(window.__store.kanban.okr.apresentacao_live.tracos||{}).map(x=>x.m).sort().join()))==='f,t', 'tipos');
 await A.p.waitForTimeout(5900); await sync(A.p,B.p);
 const dep=await A.p.evaluate(()=>Object.values(window.__store.kanban.okr.apresentacao_live.tracos||{}).map(x=>x.m).join());
 t('depois de ~5 s a temporária some do banco e das duas telas; a fixa continua', dep==='f' && await px(A.p)>50 && await px(B.p)>50 && await px(B.p)<=await px(A.p)+5, {dep, a:await px(A.p), b:await px(B.p)});
 // desfazer: remove só o último fixo
 await A.p.mouse.move(300,550); await A.p.mouse.down(); await A.p.mouse.move(420,580,{steps:5}); await A.p.mouse.up(); await A.p.waitForTimeout(250);
 await A.p.click('#live-fpanel button[title^="Desfaz"]'); await A.p.waitForTimeout(250); await sync(A.p,B.p);
 t('↩ desfaz só o último traço fixo (o anterior fica)', (await A.p.evaluate(()=>Object.keys(window.__store.kanban.okr.apresentacao_live.tracos||{}).length))===1, await A.p.evaluate(()=>Object.keys(window.__store.kanban.okr.apresentacao_live.tracos||{}).length));
 // expiração local: uma temporária "esquecida" no banco (ex.: o apresentador saiu antes de apagar) some sozinha em cada tela depois de 5 s
 await B.p.evaluate(()=>{ const s=window.__store.kanban.okr.apresentacao_live; s.tracos.zz={c:'#ff4d4d',k:'s:'+slides[currentIdx].key,m:'t',fim:true,p:[[0.1,0.1],[0.5,0.5]]}; (window.__lis||[]).filter(l=>l.p==='kanban/okr/apresentacao_live').forEach(l=>l.cb({val:()=>JSON.parse(JSON.stringify(s)),exists:()=>true,key:'x'})); });
 await B.p.waitForTimeout(200); const antes=await px(B.p); await B.p.waitForTimeout(5400); const depois=await px(B.p);
 t('temporária esquecida no banco some sozinha em cada tela (conta o tempo localmente, sem depender do apresentador)', antes>depois && depois<antes-50, {antes, depois});
 await A.p.keyboard.press('Escape'); await A.p.evaluate(()=>window._liveLimpar()); await A.p.waitForTimeout(200); await sync(A.p,B.p);
 // o botão flutuante e o painel existem DENTRO do detalhe do Objetivo (a barra do topo some atrás do modal)
 await A.p.evaluate(()=>window._okrOpenDetail('d2')); await A.p.waitForTimeout(250);
 const fabVis=await A.p.evaluate(()=>{ const f=document.getElementById('live-fab'), r=f.getBoundingClientRect(), el=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2); return {hidden:f.hidden, topo:el===f}; });
 t('botão flutuante 🎙️ aparece por cima do detalhe do Objetivo', !fabVis.hidden && fabVis.topo, fabVis);
 await A.p.evaluate(()=>window._livePainel(false)); await A.p.click('#live-fab'); await A.p.waitForTimeout(150); await A.p.click('#live-fpanel button:has-text("Laser")'); await A.p.waitForTimeout(150);
 t('dá pra ligar o laser pelo painel dentro do detalhe', await A.p.evaluate(()=>liveFerr==='laser'), 'não ligou');
 await A.p.click('#live-fpanel button:has-text("Laser")'); await A.p.evaluate(()=>{ window._livePainel(false); window._okrCloseDetail(); }); await A.p.waitForTimeout(150);
 // traços do slide CONTINUAM quando se entra no detalhe do Objetivo; os feitos dentro do detalhe ficam só nele
 await A.p.evaluate(()=>window._liveLimpar()); await A.p.waitForTimeout(150); await A.p.evaluate(()=>window._okrGoTo(3)); await A.p.waitForTimeout(200);
 await A.p.keyboard.press('p'); await A.p.mouse.move(300,300); await A.p.mouse.down(); await A.p.mouse.move(450,340,{steps:5}); await A.p.mouse.up(); await A.p.keyboard.press('Escape'); await A.p.waitForTimeout(200); await sync(A.p,B.p);
 const pre=await px(B.p); await A.p.evaluate(()=>window._okrOpenDetail('d2')); await A.p.waitForTimeout(300); await sync(A.p,B.p);
 t('entrar no detalhe do Objetivo NÃO apaga os traços do slide (nas duas telas)', pre>100 && await px(A.p)>100 && await px(B.p)>100, {pre, a:await px(A.p), b:await px(B.p)});
 await A.p.keyboard.press('p'); await A.p.mouse.move(300,500); await A.p.mouse.down(); await A.p.mouse.move(520,540,{steps:5}); await A.p.mouse.up(); await A.p.keyboard.press('Escape'); await A.p.waitForTimeout(200); await sync(A.p,B.p);
 const comDet=await px(B.p); await A.p.evaluate(()=>window._okrCloseDetail()); await A.p.waitForTimeout(250); await sync(A.p,B.p); const semDet=await px(B.p);
 t('traço feito dentro do detalhe fica só nele; ao fechar sobram os do slide', comDet>pre+50 && semDet>100 && semDet<comDet-50, {pre, comDet, semDet});
 await A.p.evaluate(()=>window._liveLimpar()); await A.p.waitForTimeout(150);
 // passar o controle CLICANDO no nome da pessoa — mesmo com sinais de vida chegando no meio (a interface não pode ser remontada entre o mouse descer e subir)
 await A.p.evaluate(()=>{ const s=window.__store.kanban.okr.apresentacao_live; s.participantes={eve:{nome:'Eve Souza',ts:Date.now()}}; (window.__lis||[]).filter(l=>l.p==='kanban/okr/apresentacao_live').forEach(l=>l.cb({val:()=>JSON.parse(JSON.stringify(s)),exists:()=>true,key:'x'})); });
 await A.p.evaluate(()=>window._livePainel(true)); await A.p.waitForTimeout(150);
 const nomeBtn=A.p.locator('#live-fpanel .lp-lista button:has-text("Eve Souza")'); await nomeBtn.waitFor({timeout:3000});
 await A.p.evaluate(()=>{ const s=window.__store.kanban.okr.apresentacao_live; s.participantes.eve.ts=Date.now(); (window.__lis||[]).filter(l=>l.p==='kanban/okr/apresentacao_live').forEach(l=>l.cb({val:()=>JSON.parse(JSON.stringify(s)),exists:()=>true,key:'x'})); });
 const box=await nomeBtn.boundingBox(); await A.p.mouse.move(box.x+box.width/2, box.y+box.height/2); await A.p.mouse.down();
 await A.p.evaluate(()=>{ const s=window.__store.kanban.okr.apresentacao_live; s.participantes.eve.ts=Date.now()+1; (window.__lis||[]).filter(l=>l.p==='kanban/okr/apresentacao_live').forEach(l=>l.cb({val:()=>JSON.parse(JSON.stringify(s)),exists:()=>true,key:'x'})); });
 await A.p.mouse.up(); await A.p.waitForTimeout(300); await sync(A.p,B.p);
 t('clicar no nome da pessoa no painel passa o controle (com sinais de vida chegando no meio do clique)', await A.p.evaluate(()=>window.__store.kanban.okr.apresentacao_live.apresentador.uid==='eve') && /Você está apresentando/.test((await info(B.p)).box), await A.p.evaluate(()=>window.__store.kanban.okr.apresentacao_live.apresentador));
 await B.p.evaluate(()=>window._liveAssumir()); await B.p.waitForTimeout(150); await sync(B.p,A.p); await A.p.evaluate(()=>window._livePainel(false)); await B.p.evaluate(()=>window._livePainel(false));
 await B.p.evaluate(()=>window._liveEncerrar && 0); await A.p.evaluate(()=>window._liveAssumir()); await A.p.waitForTimeout(200); await sync(A.p,B.p);
 // pedir / passar o controle
 await B.p.evaluate(()=>window._livePedir()); await B.p.waitForTimeout(250); await sync(B.p,A.p);
 t('pedido de controle aparece pro apresentador, com Passar/Recusar', await A.p.evaluate(()=>/Eve Souza pede o controle/.test(document.getElementById('live-toast').textContent) && !!document.querySelector('#live-toast [data-pedido] button')), 'sem pedido');
 // cenário real: a flag de "seguindo" da Ana estava desligada quando ela passou o controle — a tela dela (a compartilhada no Meet) tem que passar a seguir a Eve mesmo assim
 await A.p.evaluate(()=>{ liveSeguindo = false; });
 await A.p.evaluate(()=>document.querySelector('#live-toast [data-pedido] button').click()); await A.p.waitForTimeout(250); await sync(A.p,B.p);
 const a4=await info(A.p), b4=await info(B.p); t('aceitar passa o controle: Eve vira apresentadora e Ana acompanha', /Você está apresentando/.test(b4.box) && /Eve Souza está apresentando/.test(a4.box), {a4,b4});
 await B.p.evaluate(()=>window._okrGoTo(1)); await B.p.waitForTimeout(250); await sync(B.p,A.p); t('o novo apresentador comanda (Ana segue a Eve)', (await info(A.p)).idx===1, await info(A.p));
 // apresentador some -> assumir
 await A.p.evaluate(()=>{ const s=window.__store.kanban.okr.apresentacao_live; s.atualizadoEm=Date.now()-120000; (window.__lis||[]).filter(l=>l.p==='kanban/okr/apresentacao_live').forEach(l=>l.cb({val:()=>JSON.parse(JSON.stringify(s)),exists:()=>true,key:'x'})); }); await A.p.waitForTimeout(200);
 await A.p.evaluate(()=>{ _liveSig=''; window._livePainel(true); }); await A.p.waitForTimeout(150); t('apresentador sem sinal há >90 s: o painel de quem acompanha mostra "Assumir"', await A.p.evaluate(()=>/Assumir/.test(document.getElementById('live-fpanel').textContent)), await A.p.evaluate(()=>document.getElementById('live-fpanel').textContent));
 await A.p.evaluate(()=>window._liveAssumir()); await A.p.waitForTimeout(250); t('assumir faz de Ana a apresentadora', /Você está apresentando/.test((await info(A.p)).box), await info(A.p));
 // encerrar
 await A.p.evaluate(()=>window._liveEncerrar()); await A.p.waitForTimeout(250); await sync(A.p,B.p); const b5=await info(B.p); t('encerrar apaga a sessão e avisa quem estava acompanhando', /Apresentar ao vivo/.test(b5.box) && await B.p.evaluate(()=>/terminou/.test(document.getElementById('live-toast').textContent)), b5);
 t('sem erro de JS nas duas telas', !A.errs.length && !B.errs.length, [A.errs,B.errs]);
 // visualizador externo: acompanha mas não apresenta nem pede controle
 { const V=await open(U('ext','Externo','ext@gmail.com')); await A.p.click('#live-box button'); await A.p.waitForTimeout(250); await sync(A.p,V.p);
   const v=await info(V.p); t('visualizador externo: vê quem apresenta e acompanha, sem botão de apresentar/pedir', /Ana ADM está apresentando/.test(v.box) && !/Pedir o controle|Apresentar ao vivo/.test(v.box), v);
   await V.ctx.close(); }
 await b.close(); console.log(ok?'TUDO OK':'HÁ FALHAS'); })();
