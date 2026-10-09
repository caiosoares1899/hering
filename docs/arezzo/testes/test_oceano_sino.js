// 🔔 Sino do Oceano (oceano-dev.html; PAGE=oceano.html pra prod): selo, lista (feed + pessoais), marcar tudo, abrir item, Esc, rodapé de push/som/Não Perturbe.
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const PAGE=process.env.PAGE||'oceano-dev.html';
const U={uid:'eve',email:'eve@ciahering.com.br',displayName:'Eve Souza',photoURL:'',providerData:[{providerId:'google.com'}]};
const agora=()=>new Date().toISOString(), antes=m=>new Date(Date.now()-m*60000).toISOString();
const seed=()=>({kanban:{usuarios:{eve:{uid:'eve',nome:'Eve',email:'eve@ciahering.com.br',init:'EV',role:'membro',inscrito:true,squads:{dev:true},
   notificacoes:{n1:{type:'assigned',title:'Card "Banner" atribuído a você',sub:'Maré · dev',ts:antes(5),read:false,cardId:'c1',squad:'dev'},n2:{type:'kudos',title:'Você recebeu uma ⭐',sub:'de Ana',ts:antes(90),read:false},n3:{type:'done',title:'Card concluído',sub:'',ts:antes(300),read:true,cardId:'c9',squad:'dev'},n4:{type:'rascunho',title:'Só do painel',ts:antes(10),read:false}}}},
   usuarios_publicos:{eve:{uid:'eve',nome:'Eve',init:'EV'}},config:{adm_emails:[]},notif_feed_seen:{eve:{ts:antes(600),lidos:{}}},notif_feed:{f1:{id:'f1',tipo:'mural',titulo:'📢 Aviso do Radar',sub:'Reunião mudou',torres:['*'],muralId:'m1',autorUid:'ana',autor:'Ana',ts:antes(20)}}}});
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true; const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,300))); };
 for(const [w,h] of [[1280,800],[390,800]]){
  const ctx=await b.newContext({viewport:{width:w,height:h}}); await fake.install(ctx,seed()); const abertas=[]; ctx.on('page',pg=>abertas.push(pg.url()));
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto('http://localhost:8941/'+PAGE); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U); await p.waitForTimeout(1500);
  const tag=w+'px';
  const v=await p.evaluate(()=>{ const b=document.getElementById('btn-sino'), a=document.getElementById('btn-ajuda'); const rb=b.getBoundingClientRect(), ra=a.getBoundingClientRect(); return {w:rb.width,h:rb.height,x:Math.round(rb.x),perto:Math.abs(rb.y-ra.y)<6 && Math.abs(rb.left-ra.right)<30, sel:document.getElementById('sino-n').textContent, vis:getComputedStyle(document.getElementById('sino-n')).display}; });
  t(`[${tag}] botão 🔔 visível, na mesma linha e colado ao ❓ Ajuda`, v.w>0 && v.h>0 && v.perto, v);
  t(`[${tag}] selo conta só o que é pra mim: 2 pessoais não lidas + 1 aviso do feed (a notificação "rascunho" do painel não entra)`, v.sel==='3' && v.vis!=='none', v);
  await p.click('#btn-sino'); await p.waitForTimeout(300);
  const l=await p.evaluate(()=>{ const d=document.getElementById('sino-drop'), r=d.getBoundingClientRect(), e=document.elementFromPoint(r.left+30,r.top+30); return {abre:getComputedStyle(d).display==='flex', itens:[...d.querySelectorAll('.sino-it .t')].map(x=>x.textContent), dentro:r.left>=0&&r.right<=innerWidth, topo:!!(e&&e.closest('#sino-drop')), rodape:!!d.querySelector('.mn-ft'), perm:(d.querySelector('.mn-perm')||{}).textContent||'', dnd:!!d.querySelector('.mn-dnd-btn'), som:!!d.querySelector('.mn-som')}; });
  t(`[${tag}] painel abre por cima, dentro da tela, com os 4 itens (3 pessoais + 1 do feed), rodapé de push/som/Não Perturbe`, l.abre && l.itens.length===4 && l.dentro && l.topo && l.rodape && l.som && l.dnd && /notifica/i.test(l.perm), l);
  await p.keyboard.press('Escape'); await p.waitForTimeout(150); t(`[${tag}] Esc fecha o painel`, await p.evaluate(()=>getComputedStyle(document.getElementById('sino-drop')).display==='none'), 'aberto');
  await p.click('#btn-sino'); await p.waitForTimeout(250);
  await p.click('.sino-it[data-k="p"][data-id="n1"]'); await p.waitForTimeout(500);
  const s=await p.evaluate(()=>({lida:window.__store.kanban.usuarios.eve.notificacoes.n1.read, sel:document.getElementById('sino-n').textContent}));
  t(`[${tag}] clicar numa notificação marca como lida (banco + selo 3→2) e abre o card no Maré (aba nova)`, s.lida===true && s.sel==='2' && abertas.some(u=>/kanban(-dev)?\.html\?squad=dev&card=c1/.test(u)), {s,abertas});
  await p.click('#btn-sino'); await p.waitForTimeout(250); await p.click('#sino-tudo'); await p.waitForTimeout(400);
  const m=await p.evaluate(()=>({sel:getComputedStyle(document.getElementById('sino-n')).display, n2:window.__store.kanban.usuarios.eve.notificacoes.n2.read, n4:window.__store.kanban.usuarios.eve.notificacoes.n4.read, lidos:Object.keys(((window.__store.kanban.notif_feed_seen||{}).eve||{}).lidos||{})}));
  t(`[${tag}] "Marcar tudo como lido": zera o selo, grava as pessoais e o feed; não mexe no "rascunho" do painel`, m.sel==='none' && m.n2===true && m.n4===false && m.lidos.includes('f1'), m);
  await p.click('#sino-limpar'); await p.waitForTimeout(400);
  t(`[${tag}] "Limpar antigas" remove só as lidas`, await p.evaluate(()=>{ const n=window.__store.kanban.usuarios.eve.notificacoes; return !n.n1 && !n.n2 && !n.n3 && !!n.n4; }), await p.evaluate(()=>Object.keys(window.__store.kanban.usuarios.eve.notificacoes)));
  t(`[${tag}] sem erro de JS`, !errs.length, errs); await ctx.close(); }
 // dentro do Oceano instalado ("abrir aqui"): clicar numa notificação abre o produto no host, não numa aba nova
 { const ctx=await b.newContext({viewport:{width:1280,height:800}}); await fake.install(ctx,seed()); const abertas=[]; ctx.on('page',pg=>abertas.push(pg.url())); const p=await ctx.newPage(); p.on('dialog',d=>d.accept());
   await p.goto('http://localhost:8941/'+PAGE); await p.evaluate(()=>{ localStorage.setItem('oceano_prefs',JSON.stringify({abrir:'aqui'})); }); await p.reload(); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U); await p.waitForTimeout(1500);
   await p.click('#btn-sino'); await p.waitForTimeout(250); await p.click('.sino-it[data-k="p"][data-id="n1"]'); await p.waitForTimeout(1200);
   const r=await p.evaluate(()=>({host:document.getElementById('host').classList.contains('on'), fr:[...document.querySelectorAll('#host-frames iframe')].map(f=>f.getAttribute('src'))}));
   t('com "abrir aqui", a notificação abre o card dentro do Oceano (iframe), sem aba nova', r.host && r.fr.some(u=>/kanban(-dev)?\.html\?squad=dev&card=c1/.test(u)) && !abertas.some(u=>/kanban/.test(u)), {r,abertas}); await ctx.close(); }
 await b.close(); console.log(ok?'TUDO OK':'HÁ FALHAS'); })();
