// Apresentação ao vivo (okr-apresentacao.slide.html): apresentador comanda o slide e o detalhe, quem abre acompanha, laser, caneta, passar/pedir o controle, assumir, encerrar.
// Duas páginas na mesma máquina; o Firebase falso é por página, então "sync" copia o nó apresentacao_live de uma pra outra e dispara os ouvintes (como o banco real faria).
const { chromium } = require(process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const U=(uid,n,email)=>({uid,email:email||uid+'@ciahering.com.br',displayName:n,photoURL:'',providerData:[{providerId:'google.com'}]});
const mk=(id,t,o)=>({id,titulo:t,areaId:'geral',trimestres:['2026-Q4'],responsaveis:['ana'],tagIds:[],history:[],indicadores:['i1'],progressos:['p1'],proximosPassos:[],riscos:[],planosAcao:[],descricao:'desc '+t,torre:'digital',...o});
const seed=()=>({kanban:{okr:{objetivos:{d1:mk('d1','Fidelidade',{areaId:'crm',ordem:0}),d2:mk('d2','Checkout',{areaId:'tech',ordem:0,atingimento:{tipo:'numero',inicial:0,meta:100,lancamentos:[{em:'2026-11-10',valor:80}]}}),d3:mk('d3','NPS',{areaId:'cx',ordem:0})},marcos:{},tags:{},reuniao_notas:{}},
 usuarios:{ana:{uid:'ana',nome:'Ana ADM',email:'ana@ciahering.com.br',inscrito:true,init:'AA'},eve:{uid:'eve',nome:'Eve',email:'eve@ciahering.com.br',inscrito:true,init:'EV'}},usuarios_publicos:{ana:{uid:'ana',nome:'Ana ADM',init:'AA'}},config:{adm_emails:['ana@ciahering.com.br']},painel_viewers:{'ext@gmail,com':true}}});
const NO='kanban/okr/apresentacao_live';
async function sync(from,to){ const n=await from.evaluate(()=>JSON.stringify(((window.__store.kanban||{}).okr||{}).apresentacao_live||null));
  await to.evaluate(([n,NO])=>{ const v=JSON.parse(n), st=window.__store; st.kanban=st.kanban||{}; st.kanban.okr=st.kanban.okr||{}; if(v===null) delete st.kanban.okr.apresentacao_live; else st.kanban.okr.apresentacao_live=v;
    (window.__lis||[]).filter(l=>l.p===NO).forEach(l=>l.cb({val:()=>v===null?null:JSON.parse(JSON.stringify(v)), exists:()=>v!==null, key:'apresentacao_live'})); },[n,NO]); await to.waitForTimeout(250); }
(async()=>{ const abrirChrome=()=>chromium.launch({executablePath:process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); const b=await abrirChrome(); const remoto=process.env.TESTAR_PIP==='1' ? await abrirChrome() : b; let ok=true; const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,300))); };
 const open=async(user,w=1280,h=800,url,navegador=b)=>{ const ctx=await navegador.newContext({viewport:{width:w,height:h}}); await fake.install(ctx,seed()); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept()); await p.goto(url || (process.env.APRESENTACAO_TEST_URL || 'http://localhost:8941') + '/okr-apresentacao.slide.html'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),user); await p.waitForTimeout(1500); return {ctx,p,errs}; };
 const A=await open(U('ana','Ana ADM')), B=await open(U('eve','Eve Souza'),1280,800,undefined,remoto);
 const info=p=>p.evaluate(()=>({key:slides[currentIdx].key, idx:currentIdx, det:document.getElementById('detail-ov').classList.contains('open')?_okrDetailCurrentId:'', box:document.getElementById('live-box').textContent.replace(/\s+/g,' ').trim()}));
 t('antes de apresentar: botão "Apresentar ao vivo" na barra', /Apresentar ao vivo/.test((await info(A.p)).box), await info(A.p));
 await A.p.click('#live-box button'); await A.p.waitForTimeout(300); await sync(A.p,B.p);
 const a1=await info(A.p), b1=await info(B.p); t('Ana vira apresentadora; Eve vê "Ana ADM está apresentando" e acompanhando', /Parar de apresentar/.test(a1.box) && /Ana ADM está apresentando/.test(b1.box) && /Acompanhando/.test(b1.box) && !/Parar de apresentar/.test(b1.box), {a1,b1});
 await A.p.evaluate(() => {
   Object.defineProperty(navigator.clipboard, 'writeText', { value: async texto => { window.__conviteCopiado = texto; } });
   window._livePainel(true);
 });
 await A.p.getByRole('button', { name: /Copiar convite pro chat do Meet/ }).click();
 const convite = await A.p.evaluate(() => window.__conviteCopiado);
 t('convite aponta só para os slides e deixa a conversa no Meet', convite === 'Abra os slides ao vivo do Radar para acompanhar no navegador: '+new URL(A.p.url()).origin+'/okr-apresentacao.slide.html\nO áudio e a conversa continuam aqui no Google Meet.', convite);
 await A.p.getByRole('button',{name:'Copiar link da tela para o público'}).click();
 const urlPublico=await A.p.evaluate(()=>window.__conviteCopiado);
 t('link da tela para o público ativa o modo de projeção', new URL(urlPublico).searchParams.get('tela')==='publico',urlPublico);
 await A.p.evaluate(() => window._livePainel(false));
 const D=await open(U('ana','Ana ADM'),960,720,new URL('okr-bastidor.html',A.p.url()).href);
 await D.p.evaluate(()=>Object.defineProperty(window,'documentPictureInPicture',{value:undefined,configurable:true}));
 t('endereço do Bastidor abre aba própria e mostra a espera da sessão',
   new URL(D.p.url()).searchParams.get('tela')==='bastidor' && await D.p.getByRole('button',{name:'Iniciar apresentação ao vivo'}).isVisible(),'');
 await sync(A.p,D.p);
 await D.p.getByRole('button',{name:'Salvar anotação'}).waitFor();
 t('Bastidor em aba própria só mostra os controles e funciona sem PiP',
   !(await D.p.locator('#slides').isVisible()) && await D.p.getByRole('button',{name:'Retomar controle'}).count()===1,'');
 await D.p.getByRole('button',{name:/Próximo/}).click();
 await D.p.waitForFunction(()=>window.__store.kanban.okr.apresentacao_live.slide===slides[1].key);
 await sync(D.p,B.p);
 t('Bastidor em aba própria navega na mesma sala', (await info(B.p)).idx===1,'');
 await sync(A.p,B.p);
 await D.ctx.close();

 if(process.env.TESTAR_PIP==='1'){
   const abrirPip=async(nome='Abrir bastidor')=>{
     await A.p.evaluate(()=>window._livePainel(true));
     await A.p.getByRole('button',{name:nome,exact:true}).click();
     await A.p.waitForFunction(()=>!!window.documentPictureInPicture?.window?.document.getElementById('proximo'),null,{timeout:5000});
   };
   const comando=id=>A.p.evaluate(i=>window.documentPictureInPicture.window.document.getElementById(i).click(),id);
   await abrirPip('🎛️ Abrir controle flutuante');
   t('controle flutuante mantém só Anterior, Próximo e Fechar detalhe', await A.p.evaluate(()=>{
     const doc=window.documentPictureInPicture.window.document;
     return doc.querySelectorAll('button').length===3 && doc.getElementById('anterior').disabled && !doc.getElementById('anotacao');
   }), '');
   await comando('proximo');
   await A.p.waitForFunction(()=>window.__store.kanban.okr.apresentacao_live.slide===slides[1].key);
   await comando('anterior');
   await A.p.waitForFunction(()=>window.__store.kanban.okr.apresentacao_live.slide===slides[0].key);
   await A.p.evaluate(()=>window.documentPictureInPicture.window.close());
   await A.p.waitForFunction(()=>!window.documentPictureInPicture.window);
   await abrirPip();
   await comando('palco');
   t('Palco Limpo oculta bastidores e mantém os slides visíveis', await A.p.evaluate(()=>{
     const ocultos=['live-box','live-toast','notes-fab','fps-meter','tb-countdown'];
     return ocultos.every(id=>getComputedStyle(document.getElementById(id)).display==='none') &&
       getComputedStyle(document.getElementById('slides')).display!=='none';
   }), '');
   await A.p.locator('#live-fab').click();
   t('Palco Limpo mantém o microfone com laser e caneta', await A.p.locator('#live-fpanel button').filter({hasText:/Laser|Caneta/}).count()===2 &&
     await A.p.getByRole('button',{name:'Copiar link da tela para o público'}).count()===0, '');
   await A.p.locator('#live-fab').click();
   await A.p.evaluate(()=>{
     okrAgendas[_hojeStr()]={fim:'23:59'};
     const doc=window.documentPictureInPicture.window.document;
     const campo=doc.getElementById('rascunho');
     campo.value='Decisão do teste';
     campo.dispatchEvent(new Event('input'));
     window.__denySet=no=>no.includes('/reuniao_notas/');
   });
   await comando('salvar-nota');
   await A.p.waitForFunction(()=>window.documentPictureInPicture.window.document.getElementById('nota-estado').textContent.includes('Falha'));
   t('falha mantém o rascunho no bastidor', await A.p.evaluate(()=>window.documentPictureInPicture.window.document.getElementById('rascunho').value==='Decisão do teste'), '');
   await A.p.evaluate(()=>{ window.__denySet=null; });
   await comando('salvar-nota');
   await A.p.waitForFunction(()=>window.documentPictureInPicture.window.document.getElementById('nota-estado').textContent==='Anotação salva.');
   t('anotação do bastidor usa o mesmo registro e limpa o rascunho', await A.p.evaluate(()=>{
     const notas=Object.values(window.__store.kanban.okr.reuniao_notas[_hojeStr()]);
     return notas.length===1 && notas[0].texto==='Decisão do teste' && !document.getElementById('notes-input').value;
   }), '');
   await A.p.waitForFunction(()=>window.documentPictureInPicture.window.document.getElementById('tempo').textContent!=='Sem horário de término');
   t('bastidor mostra relógio da reunião e FPS ou indisponibilidade', await A.p.evaluate(()=>{
     const doc=window.documentPictureInPicture.window.document;
     return doc.getElementById('tempo').textContent===document.getElementById('tb-countdown').textContent &&
       /fps/i.test(doc.getElementById('fps').textContent);
   }), '');
   await comando('proximo');
   await A.p.waitForFunction(()=>window.__store.kanban.okr.apresentacao_live.slide===slides[1].key);
   await sync(A.p,B.p);
   t('Próximo na janela flutuante navega nas duas abas', (await info(A.p)).idx===1 && (await info(B.p)).idx===1, '');
   await comando('anterior');
   await A.p.waitForFunction(()=>window.__store.kanban.okr.apresentacao_live.slide===slides[0].key);
   t('Anterior na janela flutuante volta ao primeiro slide', (await info(A.p)).idx===0, '');
   await A.p.evaluate(()=>window._okrOpenDetail('d2'));
   await A.p.waitForFunction(()=>window.__store.kanban.okr.apresentacao_live.detalhe==='d2');
   await comando('fechar-detalhe');
   await A.p.waitForFunction(()=>!window.__store.kanban.okr.apresentacao_live.detalhe);
   await sync(A.p,B.p);
   t('Fechar detalhe pela janela sincroniza o fechamento', (await info(A.p)).det==='' && (await info(B.p)).det==='', '');
   await A.p.evaluate(()=>window.documentPictureInPicture.window.close());
   await A.p.waitForFunction(()=>!window.documentPictureInPicture.window && !document.body.classList.contains('live-palco-limpo'));
   t('fechar o bastidor restaura os controles da aba', await A.p.evaluate(()=>getComputedStyle(document.getElementById('live-box')).display!=='none'), '');
   await abrirPip();
 }
 await A.p.evaluate(()=>window._okrGoTo(2)); await A.p.waitForTimeout(250); await sync(A.p,B.p); const a2=await info(A.p), b2=await info(B.p);
 t('slide do apresentador chega no acompanhante (pela chave, não pela posição)', a2.idx===2 && b2.key===a2.key && b2.idx===2, {a2,b2});
 await A.p.evaluate(()=>window._okrOpenDetail('d2')); await A.p.waitForTimeout(250); await sync(A.p,B.p); t('Objetivo aberto no detalhe também acompanha', (await info(B.p)).det==='d2', await info(B.p));
 await A.p.evaluate(()=>window._okrOpenAting('d2'));
 await A.p.waitForFunction(()=>window.__store.kanban.okr.apresentacao_live.evolucao==='d2');
 await sync(A.p,B.p);
 const evolucaoAberta = p => p.evaluate(()=>document.getElementById('ating-ov').classList.contains('open') && !!document.querySelector('#ating-body svg'));
 t('abrir Evolução sincroniza o gráfico', await evolucaoAberta(B.p), '');
 const C = await open(U('ana','Ana ADM'),1024,768,urlPublico);
 t('tela para o público aguarda a sessão', await C.p.locator('#publico-espera').isVisible(), '');
 await sync(A.p,C.p);
 t('entrada tardia em outra resolução abre o detalhe e a Evolução', (await info(C.p)).det==='d2' && await evolucaoAberta(C.p), '');
 await C.p.keyboard.press('Escape');
 await C.p.keyboard.press('ArrowRight');
 const publico=await C.p.evaluate(()=>{
   window._liveAssumir();
   window._livePedir();
   return {
     ocultos:['topbar','bottombar','notes-fab','live-toast','live-fab'].every(id=>getComputedStyle(document.getElementById(id)).display==='none'),
     semGravacao:!window.__log.some(([op])=>['set','update','remove'].includes(op)),
     semNotas:!window.__log.some(([,no])=>no==='kanban/okr/reuniao_notas'),
     host:liveSouHost()
   };
 });
 t('tela com a conta da apresentadora continua passiva e mostra só os slides', publico.ocultos && publico.semGravacao && publico.semNotas &&
   !publico.host && (await info(C.p)).idx===2 && await evolucaoAberta(C.p), publico);
 await A.p.evaluate(()=>window._okrCloseAting());
 await A.p.waitForFunction(()=>window.__store.kanban.okr.apresentacao_live.evolucao==='');
 await sync(A.p,B.p);
 t('fechar Evolução deixa o detalhe aberto nas duas abas', !(await evolucaoAberta(B.p)) && (await info(B.p)).det==='d2', '');
 await sync(A.p,C.p);
 t('tela do público fecha Evolução ao receber a navegação', !(await evolucaoAberta(C.p)) && (await info(C.p)).det==='d2', '');
 await A.p.evaluate(()=>window._okrCloseDetail()); await A.p.waitForTimeout(250); await sync(A.p,B.p); t('fechar o detalhe fecha pra todos', (await info(B.p)).det==='', await info(B.p));
 // acompanhante mexe sozinho -> sai da sincronização; "Voltar a seguir" volta
 await B.p.evaluate(()=>window._okrGoTo(0)); await B.p.waitForTimeout(200); const b3=await info(B.p); t('mexer nos slides por conta própria sai da sincronização (e aparece "Voltar a seguir")', b3.idx===0 && /Voltar a seguir/.test(b3.box), b3);
 await sync(A.p,B.p);
 const bPausa=await info(B.p); t('snapshot sem nova navegação preserva a pausa local', bPausa.idx===0 && /Voltar a seguir/.test(bPausa.box), bPausa);
 await B.p.evaluate(()=>window._liveSeguir());
 const bSeguiu=await info(B.p); t('"Voltar a seguir" retoma o slide atual imediatamente', bSeguiu.key===a2.key && /Acompanhando/.test(bSeguiu.box), bSeguiu);
 await B.p.evaluate(()=>window._okrGoTo(0));
 await A.p.evaluate(()=>window._okrGoTo(3));
 await A.p.waitForFunction(()=>window.__store.kanban.okr.apresentacao_live.slide===slides[3].key);
 await sync(A.p,B.p);
 const bRetomou=await info(B.p); t('nova navegação do apresentador ressincroniza quem estava em pausa', bRetomou.idx===3 && /Acompanhando/.test(bRetomou.box), bRetomou);
 // Gestos na margem do slide, fora dos cartões e botões.
 await B.p.mouse.click(8,400,{clickCount:3});
 t('quem acompanha não ativa ferramentas por clique triplo', await B.p.evaluate(()=>!liveFerr), '');
 await A.p.mouse.dblclick(8,400);
 await A.p.waitForFunction(()=>liveFerr==='laser');
 t('clique duplo liga o laser', await A.p.evaluate(()=>liveFerr==='laser'), '');
 await A.p.keyboard.press('Escape');
 await A.p.mouse.click(8,400,{clickCount:3});
 await A.p.waitForTimeout(450);
 t('clique triplo liga só a caneta temporária', await A.p.evaluate(()=>liveFerr==='caneta' && liveTipo==='t'), '');
 await A.p.keyboard.press('Escape');
 await A.p.evaluate(()=>window._liveTipo('f'));
 await A.p.keyboard.press('Escape');
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
 t('clicar no nome da pessoa no painel passa o controle (com sinais de vida chegando no meio do clique)', await A.p.evaluate(()=>window.__store.kanban.okr.apresentacao_live.apresentador.uid==='eve') && /Parar de apresentar/.test((await info(B.p)).box), await A.p.evaluate(()=>window.__store.kanban.okr.apresentacao_live.apresentador));
 if(process.env.TESTAR_PIP==='1'){
   t('ADM mantém o Bastidor aberto com Retomar controle disponível', await A.p.evaluate(()=>{
     const doc=window.documentPictureInPicture.window?.document;
     return doc && !doc.getElementById('retomar').disabled && doc.getElementById('proximo').disabled;
   }), '');
   await B.p.evaluate(()=>window._livePainel(true));
   t('quem recebe o controle vê o passador e o Bastidor fica reservado ao ADM',
     await B.p.getByRole('button',{name:/Abrir controle flutuante/}).count()===1 && await B.p.getByRole('button',{name:'Abrir bastidor',exact:true}).count()===0, '');
   await B.p.getByRole('button',{name:/Abrir controle flutuante/}).click();
   await B.p.waitForFunction(()=>!!window.documentPictureInPicture.window?.document.getElementById('anterior'));
   await A.p.evaluate(()=>window.documentPictureInPicture.window.document.getElementById('retomar').click());
   await A.p.waitForFunction(()=>liveSouHost());
   await sync(A.p,B.p);
   await B.p.waitForFunction(()=>!window.documentPictureInPicture.window);
   t('Retomar controle devolve a apresentação ao ADM e fecha o passador anterior',
     await A.p.evaluate(()=>liveSouHost() && window.documentPictureInPicture.window.document.getElementById('retomar').disabled), '');
 }
 if(process.env.TESTAR_PIP!=='1'){
   await A.p.evaluate(()=>window._liveAssumir()); await A.p.waitForTimeout(200); await sync(A.p,B.p);
 }
 await A.p.evaluate(()=>window._livePainel(false)); await B.p.evaluate(()=>window._livePainel(false));
 // pedir / passar o controle
 await B.p.evaluate(()=>window._livePedir()); await B.p.waitForTimeout(250); await sync(B.p,A.p);
 t('pedido de controle aparece pro apresentador, com Passar/Recusar', await A.p.evaluate(()=>/Eve Souza pede o controle/.test(document.getElementById('live-toast').textContent) && !!document.querySelector('#live-toast [data-pedido] button')), 'sem pedido');
 await A.p.evaluate(()=>{ window._okrOpenDetail('d2'); window._okrOpenAting('d2'); });
 await A.p.waitForFunction(()=>window.__store.kanban.okr.apresentacao_live.evolucao==='d2');
 // cenário real: a flag de "seguindo" da Ana estava desligada quando ela passou o controle — a tela dela (a compartilhada no Meet) tem que passar a seguir a Eve mesmo assim
 await A.p.evaluate(()=>{ liveSeguindo = false; });
 if(process.env.TESTAR_PIP==='1'){
   await A.p.evaluate(()=>{
     window._okrOpenAting('d2');
     const doc=window.documentPictureInPicture.window.document;
     doc.getElementById('palco').click();
     const seletor=doc.getElementById('participante');
     seletor.value='eve';
     seletor.dispatchEvent(new Event('change'));
   });
   t('pedido aparece no bastidor com opção de recusar', await A.p.evaluate(()=>{
     const doc=window.documentPictureInPicture.window.document;
     return doc.getElementById('participante').selectedOptions[0].textContent.includes('pediu o controle') &&
       !doc.getElementById('recusar').disabled && getComputedStyle(document.getElementById('live-toast')).display==='none';
   }), '');
   await A.p.waitForFunction(()=>window.__store.kanban.okr.apresentacao_live.evolucao==='d2');
   await A.p.evaluate(()=>window.documentPictureInPicture.window.document.getElementById('passar').click());
   await A.p.waitForFunction(()=>!liveSouHost() && !!window.documentPictureInPicture.window);
   await A.p.evaluate(()=>window.documentPictureInPicture.window.close());
   await A.p.waitForFunction(()=>!document.body.classList.contains('live-palco-limpo'));
 }else await A.p.evaluate(()=>document.querySelector('#live-toast [data-pedido] button').click()); await A.p.waitForTimeout(250); await sync(A.p,B.p);
 const a4=await info(A.p), b4=await info(B.p); t('aceitar passa o controle: Eve vira apresentadora e Ana acompanha', /Parar de apresentar/.test(b4.box) && /Eve Souza está apresentando/.test(a4.box), {a4,b4});
 t('quem recebe o controle herda o detalhe e a Evolução aberta', (await info(B.p)).det==='d2' && await evolucaoAberta(B.p), '');
 await B.p.evaluate(()=>{ window._okrCloseDetail(); window._okrGoTo(1); }); await B.p.waitForTimeout(250); await sync(B.p,A.p); t('o novo apresentador comanda (Ana segue a Eve)', (await info(A.p)).idx===1, await info(A.p));
 // apresentador some -> assumir
 await A.p.evaluate(()=>{ const s=window.__store.kanban.okr.apresentacao_live; s.atualizadoEm=Date.now()-120000; (window.__lis||[]).filter(l=>l.p==='kanban/okr/apresentacao_live').forEach(l=>l.cb({val:()=>JSON.parse(JSON.stringify(s)),exists:()=>true,key:'x'})); }); await A.p.waitForTimeout(200);
 await A.p.evaluate(()=>{ _liveSig=''; window._livePainel(true); }); await A.p.waitForTimeout(150); t('apresentador sem sinal há >90 s: o painel de quem acompanha mostra "Assumir"', await A.p.evaluate(()=>/Assumir/.test(document.getElementById('live-fpanel').textContent)), await A.p.evaluate(()=>document.getElementById('live-fpanel').textContent));
 await A.p.evaluate(()=>window._liveAssumir()); await A.p.waitForTimeout(250); t('assumir faz de Ana a apresentadora', /Parar de apresentar/.test((await info(A.p)).box), await info(A.p));
 // encerrar
 const parar = A.p.getByRole('button', { name: 'Parar de apresentar', exact: true });
 const confirmacao = A.p.waitForEvent('dialog').then(d => d.message());
 await parar.press('Enter');
 t('confirmação diferencia a sessão do Radar do compartilhamento no Meet', /sessão do Radar.*compartilhamento de tela.*Google Meet/.test(await confirmacao), ''); await A.p.waitForTimeout(250); await sync(A.p,B.p); const b5=await info(B.p); t('encerrar apaga a sessão e avisa quem estava acompanhando', /Apresentar ao vivo/.test(b5.box) && await B.p.evaluate(()=>/terminou/.test(document.getElementById('live-toast').textContent)), b5);
 await sync(A.p,C.p);
 t('encerrar volta a tela projetada para a espera', await C.p.locator('#publico-espera').isVisible(), '');
 await C.ctx.close();
 t('sem erro de JS nas duas telas', !A.errs.length && !B.errs.length, [A.errs,B.errs]);
 // visualizador externo: acompanha mas não apresenta nem pede controle
 { const V=await open(U('ext','Externo','ext@gmail.com')); await A.p.click('#live-box button'); await A.p.waitForTimeout(250); await sync(A.p,V.p);
   const v=await info(V.p); t('visualizador externo: vê quem apresenta e acompanha, sem botão de apresentar/pedir', /Ana ADM está apresentando/.test(v.box) && !/Pedir o controle|Apresentar ao vivo/.test(v.box), v);
   await V.ctx.close(); }
 if(remoto!==b) await remoto.close(); await b.close(); console.log(ok?'TUDO OK':'HÁ FALHAS'); process.exitCode=ok?0:1; })();
