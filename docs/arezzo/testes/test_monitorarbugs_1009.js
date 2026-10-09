// /monitorarbugs 2026-10-09 — apresentação ao vivo, Oceano (Meus links), Painel (aba Links), menu de produtos.
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const U=(uid,n,email)=>({uid,email:email||uid+'@ciahering.com.br',displayName:n,photoURL:'',providerData:[{providerId:'google.com'}]});
const mk=(id,t,o)=>({id,titulo:t,areaId:'geral',trimestres:['2026-Q4'],responsaveis:['ana'],tagIds:[],history:[],indicadores:['i1'],progressos:['p1'],proximosPassos:[],riscos:[],planosAcao:[],descricao:'desc '+t,torre:'digital',...o});
const seed=()=>({kanban:{okr:{objetivos:{d1:mk('d1','Fidelidade',{areaId:'crm',ordem:0}),d2:mk('d2','Checkout',{areaId:'tech',ordem:0}),d3:mk('d3','NPS',{areaId:'cx',ordem:0})},marcos:{},tags:{},reuniao_notas:{}},
 usuarios:{ana:{uid:'ana',nome:'Ana ADM',email:'ana@ciahering.com.br',inscrito:true,init:'AA',role:'adm',squads:{dev:true}},eve:{uid:'eve',nome:'Eve',email:'eve@ciahering.com.br',inscrito:true,init:'EV',role:'membro'}},usuarios_publicos:{ana:{uid:'ana',nome:'Ana ADM',init:'AA'}},config:{adm_emails:['ana@ciahering.com.br'],links_hering:{a:{titulo:'Portal',url:'https://rh.example.com',ordem:1}}}}});
const NO='kanban/okr/apresentacao_live';
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true; const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,300))); };
 const open=async(page,user,store)=>{ const ctx=await b.newContext({viewport:{width:1280,height:800}}); await fake.install(ctx,store||seed()); await ctx.route('https://www.google.com/s2/favicons**',r=>r.abort()); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept()); await p.goto('http://localhost:8941/'+page); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),user); await p.waitForTimeout(1400); return {ctx,p,errs}; };
 // 1) auth-change refirado não acumula ouvintes do nó ao vivo
 { const {ctx,p}=await open('okr-apresentacao.slide.html',U('ana','Ana ADM')); await p.evaluate(x=>window.__authCb(x),U('ana','Ana ADM')); await p.evaluate(x=>window.__authCb(x),U('ana','Ana ADM')); await p.waitForTimeout(300);
   t('login refirado 3x: só 1 ouvinte do nó da apresentação ao vivo', (await p.evaluate(NO=>window.__lis.filter(l=>l.p===NO).length,NO))===1, await p.evaluate(NO=>window.__lis.filter(l=>l.p===NO).length,NO)); await ctx.close(); }
 // 2) apresentador que recarrega volta pra posição da sessão (1x só, sem puxar depois)
 { const {ctx,p}=await open('okr-apresentacao.slide.html',U('ana','Ana ADM')); await p.evaluate(()=>window._okrGoTo(3)); await p.click('#live-box button'); await p.waitForTimeout(300); await p.evaluate(()=>window._okrGoTo(3)); await p.waitForTimeout(300);
   const sess=await p.evaluate(()=>JSON.stringify(window.__store.kanban.okr.apresentacao_live));
   const st=seed(); st.kanban.okr.apresentacao_live=JSON.parse(sess); const k=JSON.parse(sess).slide;
   const R=await open('okr-apresentacao.slide.html',U('ana','Ana ADM'),st);
   const idx=await R.p.evaluate(()=>({i:currentIdx,k:slides[currentIdx].key}));
   t('apresentador recarregou a página: volta pro slide da sessão (e não fica na capa)', idx.k===k && idx.i>0, {idx,k});
   await R.p.evaluate(()=>window._okrGoTo(1)); await R.p.waitForTimeout(250);
   await R.p.evaluate(([NO,s])=>{ (window.__lis||[]).filter(l=>l.p===NO).forEach(l=>l.cb({val:()=>JSON.parse(s),exists:()=>true,key:'apresentacao_live'})); },[NO,sess]); await R.p.waitForTimeout(250);
   t('depois de retomar, um sinal velho da sala NÃO puxa o apresentador de volta', (await R.p.evaluate(()=>currentIdx))===1, await R.p.evaluate(()=>currentIdx));
   // 3) laser: sair da janela apaga o ponto
   await R.p.keyboard.press('l'); await R.p.mouse.move(500,300); await R.p.waitForTimeout(120); await R.p.mouse.move(520,320); await R.p.waitForTimeout(120);
   const on1=await R.p.evaluate(()=>window.__store.kanban.okr.apresentacao_live.laser&&window.__store.kanban.okr.apresentacao_live.laser.on);
   await R.p.evaluate(()=>document.documentElement.dispatchEvent(new MouseEvent('mouseleave'))); await R.p.waitForTimeout(150);
   const on2=await R.p.evaluate(()=>window.__store.kanban.okr.apresentacao_live.laser&&window.__store.kanban.okr.apresentacao_live.laser.on);
   t('laser: ao sair da janela o ponto some pra todos', on1===true && on2===false, {on1,on2});
   // 4) estado vazio do painel: botão de copiar o link
   await R.p.evaluate(()=>window._livePainel(true)); await R.p.waitForTimeout(150);
   t('painel sem ninguém na sala oferece "Copiar link da apresentação"', await R.p.evaluate(()=>/Copiar link/.test(document.getElementById('live-fpanel').textContent)), 'sem botão');
   await ctx.close(); await R.ctx.close(); }
 // 5) Oceano: duplo clique em Salvar link não cria 2
 { const {ctx,p,errs}=await open('oceano-dev.html',U('eve','Eve')); await p.evaluate(()=>{ window.__setDelay=()=>400; }); await p.click('#btn-eu'); await p.waitForTimeout(300);
   await p.fill('#pfl-titulo','Jira'); await p.fill('#pfl-url','https://jira.example.com');
   await p.evaluate(()=>{ const b=document.getElementById('pfl-salvar'); b.click(); b.click(); b.click(); }); await p.waitForTimeout(1200);
   const n=await p.evaluate(()=>Object.keys(window.__store.kanban.usuarios.eve.links||{}).length);
   t('Oceano: 3 cliques seguidos em "Salvar link" criam 1 link só', n===1, n); t('Oceano: sem erro de JS', !errs.length, errs); await ctx.close(); }
 // 6) Painel: duplo clique + editar link removido por outra pessoa + mover não ressuscita fantasma
 { const {ctx,p,errs}=await open('painel-dev.html',U('ana','Ana ADM')); await p.evaluate(()=>setPcfgTab('links')); await p.waitForTimeout(500);
   await p.evaluate(()=>{ window.__setDelay=()=>400; document.getElementById('pl-titulo').value='Wiki'; document.getElementById('pl-url').value='https://wiki.example.com'; savePlink(); savePlink(); savePlink(); }); await p.waitForTimeout(1300);
   const n=await p.evaluate(()=>Object.keys(window.__store.kanban.config.links_hering).length);
   t('Painel: 3 cliques seguidos em "Salvar" criam 1 link só (2 no total com o já existente)', n===2, n);
   await p.evaluate(()=>{ window.__setDelay=()=>0; const id=Object.keys(PLINKS).find(k=>PLINKS[k].titulo==='Wiki'); editPlink(id); window.__idEd=id; delete window.__store.kanban.config.links_hering[id]; document.getElementById('pl-titulo').value='Wiki 2'; savePlink(); }); await p.waitForTimeout(500);
   t('Painel: editar um link que outra pessoa já removeu NÃO o ressuscita', await p.evaluate(()=>!window.__store.kanban.config.links_hering[window.__idEd]), 'ressuscitou');
   await p.evaluate(()=>{ const ids=Object.keys(window.__store.kanban.config.links_hering); window.__ids=ids; });
   await p.evaluate(()=>{ loadPlinks(); }); await p.waitForTimeout(300);
   await p.evaluate(()=>{ const m=Object.keys(PLINKS)[0]; window.__fantasma='zzz'; PLINKS.zzz={titulo:'Fantasma',url:'https://f.example.com',ordem:2}; movePlink(m,1); }); await p.waitForTimeout(500);
   t('Painel: ▼ não cria registro vazio pra link que já não existe no banco', await p.evaluate(()=>!window.__store.kanban.config.links_hering.zzz), await p.evaluate(()=>JSON.stringify(window.__store.kanban.config.links_hering.zzz)));
   t('Painel: sem erro de JS', !errs.length, errs); await ctx.close(); }
 // 7) menu: trocar de pessoa na mesma página não mostra os links da anterior
 { const {ctx,p}=await open('okr-dev.html',U('eve','Eve'));
   const txt=await p.evaluate(()=>{ MareNotif.linksCacheSet('meus','eve',{m:{titulo:'Privado da Eve',url:'https://p.example.com',ordem:1}}); MareNotif.appsMontar({user:{uid:'ana',email:'ana@ciahering.com.br'}, aqui:'okr', isViewer:false, isAdm:true, slot:document.body}); document.getElementById('mn-apps-btn').click(); document.querySelector('#mn-apps-pop button[data-mntab="meus"]').click(); return document.getElementById('mn-apps-pop').textContent; });
   t('menu: outra pessoa na mesma página começa sem os "Meus links" da anterior', !/Privado da Eve/.test(txt), txt.slice(0,160)); await ctx.close(); }
 await b.close(); console.log(ok?'TUDO OK':'HÁ FALHAS'); })();
