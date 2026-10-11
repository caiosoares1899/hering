// 📌 Mural de avisos no Oceano (oceano-dev.html) + opção 🌊 no composer de Comunicados (painel-dev.html) + filtro no Maré (kanban-dev.html).
// SUF=-dev (padrão); SUF= testa a prod depois da promoção.  SHOT=/pasta salva prints.
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const SUF=process.env.SUF===undefined?'-dev':process.env.SUF, B='http://localhost:8941/', SHOT=process.env.SHOT||'';
const U=(uid,n,email)=>({uid,email:email||uid+'@ciahering.com.br',displayName:n,photoURL:'',providerData:[{providerId:'google.com'}]});
const agora=Date.now(), iso=ms=>new Date(ms).toISOString();
const com=(id,o)=>[id,Object.assign({id,titulo:'Aviso '+id,corpo:'<p>Corpo de '+id+'</p>',tipo:'aviso',squad:'*',publico:'todos',prioridade:'popup',ativo:true,oceano:true,criadoEm:iso(agora-3600e3)},o)];
const seed=()=>({kanban:{
  usuarios:{
    eve:{uid:'eve',nome:'Eve',email:'eve@ciahering.com.br',init:'EV',role:'membro',inscrito:true,squads:{dev:true},squads_roles:{dev:'membro'}},
    paulo:{uid:'paulo',nome:'Paulo PO',email:'paulo@ciahering.com.br',init:'PP',role:'membro',inscrito:true,squads:{dev:true},squads_roles:{dev:'po'}},
    ana:{uid:'ana',nome:'Ana ADM',email:'ana@ciahering.com.br',init:'AA',role:'adm',inscrito:true,squads:{}},
  },
  usuarios_publicos:{eve:{uid:'eve',nome:'Eve',init:'EV'},paulo:{uid:'paulo',nome:'Paulo',init:'PP'},ana:{uid:'ana',nome:'Ana',init:'AA'}},
  config:{adm_emails:['ana@ciahering.com.br']},
  comunicados:Object.fromEntries([
    com('fix',{titulo:'Black Friday: calendário oficial',tipo:'novidade',fixado:true,corpo:'<p><b>Atenção</b> ao <i>calendário</i> da Black. <a href="https://exemplo.com/x">Veja</a> e <a href="javascript:alert(1)">ruim</a><script>window.__xss=1</script><img src=x onerror="window.__xss=2"></p><ul><li>item 1</li><li>item 2</li></ul>',capa:'https://img.exemplo.com/capa.png',botao:{rotulo:'Ver no Maré',url:'kanban-dev.html?squad=dev'},autor:'Caio',criadoEm:iso(agora-2*864e5)}),
    com('urg',{titulo:'Sistema instável hoje',tipo:'urgente',prioridade:'oceano',criadoEm:iso(agora-1800e3)}),
    com('sq',{titulo:'Só do squad dev',squad:'dev'}),
    com('outro',{titulo:'Squad do marketplace',squad:'mkt'}),
    com('po',{titulo:'Só PO e ADM',publico:'po'}),
    com('semoc',{titulo:'Só popup no Maré',oceano:false}),
    com('off',{titulo:'Arquivado',ativo:false}),
    com('velho',{titulo:'Expirado',expiraEm:iso(agora-864e5)}),
    ...[1,2,3,4].map(i=>com('x'+i,{titulo:'Extra '+i,tipo:['dica','novidade','aviso','dica'][i-1],criadoEm:iso(agora-(5+i)*3600e3)})),
  ]),
}});
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true; const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+String(JSON.stringify(d===undefined?null:d)).slice(0,400))); };
 const abre=async(user,w,seedFn)=>{ const ctx=await b.newContext({viewport:{width:w||1280,height:900}}); await fake.install(ctx,(seedFn||seed)()); const abertas=[]; ctx.on('page',pg=>abertas.push(pg.url()));
   await ctx.route('https://img.exemplo.com/**',r=>r.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="240"><defs><linearGradient id="g"><stop offset="0" stop-color="#ff6b6b"/><stop offset="1" stop-color="#ffd166"/></linearGradient></defs><rect width="600" height="240" fill="url(#g)"/><text x="30" y="130" font-size="48" fill="#fff" font-family="sans-serif">BLACK</text></svg>'}));
   const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
   await p.goto(B+'oceano'+SUF+'.html'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),user); await p.waitForTimeout(900); return {ctx,p,errs,abertas}; };
 const titulos=p=>p.evaluate(()=>[...document.querySelectorAll('#mural .av-t')].map(e=>e.textContent));

 // ── Oceano: membro do squad dev ──
 { const {ctx,p,errs,abertas}=await abre(U('eve','Eve Souza'));
   const v=await p.evaluate(()=>({wrap:getComputedStyle(document.getElementById('mural-wrap')).display,n:document.getElementById('mural-n').textContent,mais:document.getElementById('mural-mais').textContent,xss:window.__xss||0}));
   const ts=await titulos(p);
   t('mural aparece na página inicial, com contador e "Ver todos"', v.wrap!=='none' && v.n==='7' && /Ver todos \(7\)/.test(v.mais), v);
   t('só os avisos pra mim: oceano ligado, ativo, não expirado, meu squad, sem "só PO" (7 de 13; mostra 4 e o resto em "Ver todos")', ts.length===4 && !ts.some(x=>/marketplace|Só PO|Só popup|Arquivado|Expirado/.test(x)), ts);
   t('ordem: fixado primeiro, depois urgente, depois os mais novos', ts[0]==='Black Friday: calendário oficial' && ts[1]==='Sistema instável hoje', ts);
   const d=await p.evaluate(()=>({dest:[...document.querySelectorAll('#mural .av.dest')].length,novo:document.querySelectorAll('#mural .av-novo').length,pin:!!document.querySelector('#mural .av-pin'),img:!!document.querySelector('#mural .av-capa img'),bt:document.querySelector('#mural [data-av-bt]')?.textContent,tipo:[...document.querySelectorAll('#mural .av-tipo')].slice(0,2).map(e=>e.textContent.trim()),autor:document.querySelector('#mural .av-autor')?.textContent}));
   t('fixado e urgente ficam em destaque (largura total); capa, 📌, botão, autor e selo NOVO', d.dest===2 && d.pin && d.img && d.bt==='Ver no Maré' && d.novo>=4 && /Novidade/.test(d.tipo[0]) && /Urgente/.test(d.tipo[1]) && d.autor==='por Caio', d);
   const h=await p.evaluate(()=>({script:!!document.querySelector('#mural script'),onerr:[...document.querySelectorAll('#mural .av-corpo *')].some(e=>[...e.attributes].some(a=>/^on/i.test(a.name))),js:/javascript:/i.test(document.getElementById('mural').innerHTML),a:[...document.querySelectorAll('#mural .av-corpo a')].map(a=>a.getAttribute('href')+'|'+a.target+'|'+a.rel),xss:window.__xss||0,img:!!document.querySelector('#mural .av-corpo img')}));
   t('o HTML do aviso é sanitizado (sem script, sem handler, sem javascript:, sem <img> solto; link seguro abre em aba nova)', !h.script && !h.onerr && !h.js && !h.xss && !h.img && h.a.includes('https://exemplo.com/x|_blank|noopener noreferrer'), h);
   if(SHOT) await p.screenshot({path:SHOT+'/mural_desktop.png'});
   // abrir o aviso inteiro
   await p.click('#mural .av.dest'); await p.waitForTimeout(250);
   const m=await p.evaluate(()=>({aberto:document.getElementById('ov-aviso').classList.contains('open'),t:document.getElementById('aviso-t').textContent,corpo:document.getElementById('aviso-bd').innerText,capa:!!document.querySelector('#aviso-bd .aviso-capa'),bt:!!document.querySelector('#aviso-bd [data-av-bt]')}));
   t('clicar no aviso abre o texto completo (título, capa, data, autor, lista, botão)', m.aberto && /Black Friday/.test(m.t) && /item 1/.test(m.corpo) && /por Caio/.test(m.corpo) && m.capa && m.bt, m);
   if(SHOT) await p.screenshot({path:SHOT+'/mural_modal.png'});
   await p.keyboard.press('Escape'); await p.waitForTimeout(150);
   t('Esc fecha o aviso', !(await p.evaluate(()=>document.getElementById('ov-aviso').classList.contains('open'))), 0);
   // botão do card: página do Maré (abre via roteador do Oceano → aba nova com as preferências padrão)
   await p.click('#mural [data-av-bt]'); await p.waitForTimeout(700);
   t('botão com link da família abre a página (aba nova) e não abre o aviso', abertas.some(u=>/kanban-dev\.html\?squad=dev/.test(u)) || abertas.some(u=>/kanban/.test(u)) || await p.evaluate(()=>document.getElementById('host')?.classList.contains('on')), abertas);
   // ver todos
   const antes=(await titulos(p)).length; await p.click('#mural-mais'); const depois=(await titulos(p)).length; const lbl=await p.evaluate(()=>document.getElementById('mural-mais').textContent);
   t('"Ver todos (7)" mostra os 7 e vira "Ver menos"', antes===4 && depois===7 && lbl==='Ver menos', {antes,depois,lbl});
   // tempo real
   await p.evaluate(()=>{ window._set(window._ref(window._db,'kanban/comunicados/live'),{id:'live',titulo:'Chegou agora',corpo:'ao vivo',tipo:'dica',squad:'*',publico:'todos',prioridade:'oceano',ativo:true,oceano:true,criadoEm:new Date().toISOString()}); }); await p.waitForTimeout(400);
   t('aviso novo publicado aparece sem recarregar a página', (await titulos(p)).includes('Chegou agora'), await titulos(p));
   // visto
   await p.waitForTimeout(6500); await p.reload(); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U('eve','Eve Souza')); await p.waitForTimeout(900);
   const nv=await p.evaluate(()=>({novos:document.querySelectorAll('#mural .av-novo').length,n:document.getElementById('mural-n').textContent}));
   t('depois de uns segundos na tela, os avisos viram "vistos" (some o NOVO na próxima visita)', nv.novos===0 || nv.novos===1, nv);
   t('sem erro de JS (mural)', !errs.length, errs); await ctx.close(); }
 // ── PO e ADM veem mais ──
 { const {ctx,p}=await abre(U('paulo','Paulo PO')); await p.click('#mural-mais'); const ts=await titulos(p);
   t('PO do squad também vê o aviso "só PO"', ts.includes('Só PO e ADM') && !ts.includes('Squad do marketplace'), ts); await ctx.close(); }
 { const {ctx,p}=await abre(U('ana','Ana ADM')); await p.click('#mural-mais'); const ts=await titulos(p);
   t('ADM (sem squad) vê avisos de qualquer squad e os "só PO"; nunca o arquivado/expirado/sem Oceano', ts.includes('Squad do marketplace') && ts.includes('Só PO e ADM') && ts.includes('Só do squad dev') && !ts.some(x=>/Arquivado|Expirado|Só popup/.test(x)), ts); await ctx.close(); }
 // ── sem avisos: some ──
 { const {ctx,p}=await abre(U('eve','Eve Souza'),1280,()=>{ const s=seed(); s.kanban.comunicados={}; return s; });
   t('sem nenhum aviso o Mural nem aparece (a página não ganha espaço vazio)', await p.evaluate(()=>getComputedStyle(document.getElementById('mural-wrap')).display==='none'), 0); await ctx.close(); }
 // ── celular ──
 { const {ctx,p}=await abre(U('eve','Eve Souza'),390); const w=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,dest:getComputedStyle(document.querySelector('#mural .av.dest')).flexDirection}));
   t('390 px: sem rolagem lateral e o destaque vira coluna', w.sw<=w.cw+1 && w.dest==='column', w); if(SHOT) await p.screenshot({path:SHOT+'/mural_mobile.png'}); await ctx.close(); }
 // ── Painel: composer ──
 { const ctx=await b.newContext({viewport:{width:1280,height:900}}); await fake.install(ctx,seed()); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
   await p.goto(B+'painel'+SUF+'.html'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U('ana','Ana ADM')); await p.waitForTimeout(2600);
   await p.evaluate(()=>openComunicadoCompose()); await p.waitForTimeout(200);
   const d0=await p.evaluate(()=>({oc:document.getElementById('cc-oceano').checked,dis:document.getElementById('cc-oceano').disabled,extra:getComputedStyle(document.getElementById('cc-oceano-extra')).display,opts:[...document.querySelectorAll('#cc-prioridade option')].map(o=>o.value)}));
   t('composer: "🌊 Mostrar no mural do Oceano" vem MARCADO por padrão e existe a opção "Só no Oceano"', d0.oc && !d0.dis && d0.extra!=='none' && d0.opts.join()==='popup,mural,oceano', d0);
   await p.evaluate(()=>{ document.getElementById('cc-prioridade').value='oceano'; _ccTogglePrioridadeUI(); });
   const d1=await p.evaluate(()=>({oc:document.getElementById('cc-oceano').checked,dis:document.getElementById('cc-oceano').disabled,ins:document.getElementById('cc-insistente').disabled}));
   t('"Só no Oceano": checkbox fica marcado e travado, e "Insistente" desabilita', d1.oc && d1.dis && d1.ins, d1);
   await p.evaluate(()=>{ document.getElementById('cc-prioridade').value='popup'; _ccTogglePrioridadeUI(); document.getElementById('cc-oceano').checked=false; _ccTogglePrioridadeUI(); });
   t('desmarcar o Oceano esconde capa/botão/fixar', await p.evaluate(()=>getComputedStyle(document.getElementById('cc-oceano-extra')).display==='none'), 0);
   // publicar: padrão (popup + Oceano), com capa/botão/fixar
   await p.evaluate(()=>{ document.getElementById('cc-titulo').value='Peak Black'; document.getElementById('cc-corpo').innerHTML='<p>Texto</p>'; document.getElementById('cc-oceano').checked=true; _ccTogglePrioridadeUI(); document.getElementById('cc-capa').value='https://img.exemplo.com/c.png'; document.getElementById('cc-botao-txt').value='Abrir'; document.getElementById('cc-botao-url').value='kanban.html?squad=dados'; document.getElementById('cc-fixado').checked=true; saveComunicado(); }); await p.waitForTimeout(500);
   const c1=await p.evaluate(()=>Object.values(window.__store.kanban.comunicados).find(c=>c.titulo==='Peak Black'));
   t('publicar grava oceano:true + capa + botão + fixado + autor (e o popup continua)', c1 && c1.oceano===true && c1.prioridade==='popup' && c1.capa==='https://img.exemplo.com/c.png' && c1.botao?.rotulo==='Abrir' && c1.botao?.url==='kanban.html?squad=dados' && c1.fixado===true && c1.autor==='Ana ADM' && c1.ativo===true, c1);
   // só no Oceano → sem notificação mesmo urgente
   await p.evaluate(()=>{ openComunicadoCompose(); document.getElementById('cc-titulo').value='Só lá'; document.getElementById('cc-tipo').value='urgente'; document.getElementById('cc-prioridade').value='oceano'; _ccTogglePrioridadeUI(); saveComunicado(); }); await p.waitForTimeout(800);
   const c2=await p.evaluate(()=>({c:Object.values(window.__store.kanban.comunicados).find(c=>c.titulo==='Só lá'),notifs:Object.values(window.__store.kanban.usuarios).reduce((n,u)=>n+Object.values(u.notificacoes||{}).filter(x=>x.type==='painel_broadcast').length,0)}));
   t('"Só no Oceano": grava prioridade oceano + oceano:true e NÃO gera notificação, nem sendo 🚨 Urgente', c2.c && c2.c.prioridade==='oceano' && c2.c.oceano===true && c2.notifs===0, c2);
   // desmarcado = oceano:false e sem capa/botão
   await p.evaluate(()=>{ openComunicadoCompose(); document.getElementById('cc-titulo').value='Só Maré'; document.getElementById('cc-oceano').checked=false; _ccTogglePrioridadeUI(); document.getElementById('cc-capa').value='https://x.com/y.png'; saveComunicado(); }); await p.waitForTimeout(500);
   const c3=await p.evaluate(()=>Object.values(window.__store.kanban.comunicados).find(c=>c.titulo==='Só Maré'));
   t('com o Oceano desmarcado: oceano:false e nada de capa/botão/fixado gravado', c3 && c3.oceano===false && !c3.capa && !c3.botao && !c3.fixado, c3);
   // validações
   for(const [rot,cap,bt,bu,esp] of [['capa http (não https)','http://x.com/a.png','','',/capa/i],['capa javascript','javascript:alert(1)','','',/capa/i],['botão sem texto','','','https://x.com',/texto/i],['botão com link inválido','','Ir','ftp://x',/link/i]]){
     await p.evaluate(([cap,bt,bu])=>{ openComunicadoCompose(); document.getElementById('cc-titulo').value='Val'; document.getElementById('cc-oceano').checked=true; _ccTogglePrioridadeUI(); document.getElementById('cc-capa').value=cap; document.getElementById('cc-botao-txt').value=bt; document.getElementById('cc-botao-url').value=bu; window.__antes=Object.keys(window.__store.kanban.comunicados).length; saveComunicado(); },[cap,bt,bu]); await p.waitForTimeout(250);
     const r=await p.evaluate(()=>({n:Object.keys(window.__store.kanban.comunicados).length-window.__antes,toast:document.getElementById('toast')?.textContent||''}));
     t(`validação: ${rot} é recusado com aviso e não grava`, r.n===0 && esp.test(r.toast), r); }
   // lista
   await p.evaluate(()=>{ window._comunicadosListenerOn=false; loadComunicados(); }); await p.waitForTimeout(400);
   const lista=await p.evaluate(()=>document.getElementById('comunicados-lista').innerText);
   t('lista de comunicados mostra onde aparece (🌊)', /popup \+ 🌊 Oceano \(fixado\)/.test(lista) && /só Oceano/.test(lista), lista);
   // editar aviso antigo (sem o campo) abre DESMARCADO
   await p.evaluate(()=>{ window.__store.kanban.comunicados.velhoSemCampo={id:'velhoSemCampo',titulo:'Antigo',corpo:'x',tipo:'aviso',squad:'*',publico:'todos',prioridade:'popup',ativo:true,criadoEm:new Date().toISOString()}; _comunicadosCache=window.__store.kanban.comunicados; openComunicadoCompose('velhoSemCampo'); });
   t('editar um aviso antigo (sem o campo Oceano) abre com o Oceano DESMARCADO — só vai se alguém marcar', !(await p.evaluate(()=>document.getElementById('cc-oceano').checked)), 0);
   t('sem erro de JS (painel)', !errs.length, errs); await ctx.close(); }
 // ── Maré: só-Oceano não entra no mural/badge ──
 { const ctx=await b.newContext({viewport:{width:1280,height:900}}); await fake.install(ctx,seed()); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
   await p.goto(B+'kanban'+SUF+'.html?squad=dev'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U('eve','Eve Souza')); await p.waitForTimeout(3000);
   const r=await p.evaluate(()=>({m:(typeof _muralTodos!=='undefined'?_muralTodos:[]).map(c=>c.id),p:(typeof _comunicadosAtivos!=='undefined'?_comunicadosAtivos:[]).map(c=>c.id)}));
   t('Maré: aviso "só no Oceano" não aparece no mural/badge nem no popup', !r.m.includes('urg') && !r.p.includes('urg') && r.m.includes('sq'), r);
   t('sem erro de JS (kanban)', !errs.length, errs); await ctx.close(); }
 await b.close(); console.log(ok?'TUDO OK':'HÁ FALHAS'); })();
