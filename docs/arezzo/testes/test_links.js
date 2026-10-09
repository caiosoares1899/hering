// Links do menu de produtos: aba "Hering" (cadastrada por ADM no Painel) e "Meus links" (do usuário, no Oceano) — Painel-dev, menu no Radar e Oceano-dev.
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const U=(uid,n,email)=>({uid,email:email||uid+'@ciahering.com.br',displayName:n,photoURL:'',providerData:[{providerId:'google.com'}]});
const seed=()=>({kanban:{okr:{objetivos:{},marcos:{},tags:{}},usuarios:{ana:{uid:'ana',nome:'Ana',email:'ana@ciahering.com.br',init:'AA',role:'adm',inscrito:true,squads:{dev:true}},eve:{uid:'eve',nome:'Eve',email:'eve@ciahering.com.br',init:'EV',role:'membro',inscrito:true,
   links:{m1:{titulo:'Meu Drive',desc:'Docs do time',url:'https://drive.example.com/x',ordem:1}}}},usuarios_publicos:{ana:{uid:'ana',nome:'Ana',init:'AA'},eve:{uid:'eve',nome:'Eve',init:'EV'}},
   painel_viewers:{'ext@gmail,com':true},config:{adm_emails:['ana@ciahering.com.br'],links_hering:{a:{titulo:'Portal do RH',desc:'Holerite e férias',url:'https://rh.example.com',img:'https://img.example.com/rh.png',ordem:2},b:{titulo:'Intranet',desc:'',url:'https://intra.example.com',ordem:1},x:{titulo:'Malicioso',url:'javascript:alert(1)',ordem:0}}}}});
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true; const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,320))); };
 const open=async(page,user,{w=1280,h=800}={})=>{ const ctx=await b.newContext({viewport:{width:w,height:h}}); await fake.install(ctx,seed()); await ctx.route('https://img.example.com/**',r=>r.abort()); await ctx.route('https://www.google.com/s2/favicons**',r=>r.abort()); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept()); await p.goto('http://localhost:8941/'+page); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),user); await p.waitForTimeout(1800); return {ctx,p,errs}; };
 // 1) Painel: ADM cadastra / edita / reordena / remove; link perigoso é recusado; não-ADM não edita
 { const {ctx,p,errs}=await open('painel-dev.html',U('ana','Ana')); await p.evaluate(()=>{ setPcfgTab('links'); }); await p.waitForTimeout(500);
   const ini=await p.evaluate(()=>[...document.querySelectorAll('#pcfg-links-list > div')].map(x=>x.textContent.slice(0,40))); t('Painel: a aba 🔗 Links lista os cadastrados na ordem (Malicioso, Intranet, Portal)', ini.length===3, ini);
   await p.evaluate(()=>{ document.getElementById('pl-titulo').value='Wiki'; document.getElementById('pl-url').value='javascript:alert(1)'; savePlink(); }); await p.waitForTimeout(300);
   t('Painel: link javascript: é recusado (nada gravado)', !(await p.evaluate(()=>window.__log.some(l=>l[0]==='set'&&/links_hering\/l/.test(l[1])))), 'gravou');
   await p.evaluate(()=>{ document.getElementById('pl-url').value='https://wiki.example.com'; document.getElementById('pl-desc').value='Base de conhecimento'; savePlink(); }); await p.waitForTimeout(400);
   const r=await p.evaluate(()=>({set:window.__log.filter(l=>l[0]==='set'&&/links_hering\/l/.test(l[1])).length, n:Object.keys(PLINKS).length, cache:JSON.parse(localStorage.getItem('mare_links_hering')||'null')}));
   t('Painel: salva o link novo, atualiza a lista e o cache compartilhado do menu', r.set===1 && r.n===4 && r.cache && Object.keys(r.cache.v).length===4, r);
   await p.evaluate(()=>{ const id=_plSorted().find(l=>l.titulo==='Wiki').id; movePlink(id,-1); }); await p.waitForTimeout(300);
   t('Painel: ▲ reordena (renumera 1..n)', await p.evaluate(()=>_plSorted().map(l=>l.titulo).join('|').startsWith('Malicioso|Intranet|Wiki|Portal')) , await p.evaluate(()=>_plSorted().map(l=>l.titulo)));
   await p.evaluate(()=>{ removePlink(_plSorted().find(l=>l.titulo==='Wiki').id); }); await p.waitForTimeout(300);
   t('Painel: remover tira do banco e da lista', await p.evaluate(()=>!_plSorted().some(l=>l.titulo==='Wiki')), 'ficou');
   t('Painel: sem erro de JS', !errs.length, errs); await ctx.close(); }
 { const {ctx,p}=await open('painel-dev.html',U('eve','Eve')); await p.evaluate(()=>{ setPcfgTab('links'); }); await p.waitForTimeout(500);
   const r=await p.evaluate(()=>({form:getComputedStyle(document.getElementById('pcfg-links-form')).display, aviso:getComputedStyle(document.getElementById('pcfg-links-so-adm')).display, bts:document.querySelectorAll('#pcfg-links-list button').length}));
   t('Painel: quem não é ADM vê a lista, sem formulário nem botões de edição', r.form==='none' && r.aviso==='block' && r.bts===0, r); await ctx.close(); }
 // 2) Menu no Radar: abas Produtos/Hering/Meus links
 { const {ctx,p,errs}=await open('okr-dev.html',U('eve','Eve')); await p.click('#mn-apps-btn'); await p.waitForTimeout(300);
   t('menu: 3 abas (Produtos, Hering, Meus links) pra quem é da empresa', await p.evaluate(()=>[...document.querySelectorAll('#mn-apps-pop .mn-tabs button')].map(x=>x.textContent).join()==='Produtos,Hering,Meus links'), 'abas');
   await p.click('#mn-apps-pop button[data-mntab="hering"]'); await p.waitForTimeout(600);
   const h=await p.evaluate(()=>({n:[...document.querySelectorAll('#mn-apps-pop a.mn-lk .mn-lk-t')].map(x=>x.textContent), href:[...document.querySelectorAll('#mn-apps-pop a.mn-lk')].map(a=>a.getAttribute('href')+'|'+a.target+'|'+a.rel)}));
   t('aba Hering: links na ordem, sem o javascript:, abrindo em aba nova com noopener', h.n.join()==='Intranet,Portal do RH' && h.href.every(x=>/^https:/.test(x) && /_blank\|noopener/.test(x)), h);
   t('2 links (não múltiplo de 3): fica em lista', await p.evaluate(()=>!!document.querySelector('#mn-apps-pop .mn-lk-lista') && !document.querySelector('#mn-apps-pop .mn-lk-grade')), 'grade');
   await p.evaluate(()=>MareNotif.linksCacheSet('hering','eve',{a:{titulo:'A',url:'https://a.example.com',ordem:1},b:{titulo:'B',url:'https://b.example.com',ordem:2},c:{titulo:'C',url:'https://c.example.com',ordem:3}})); await p.waitForTimeout(200);
   t('3 links (múltiplo de 3): vira grade de quadrados, 3 por fila', await p.evaluate(()=>{ const g=document.querySelector('#mn-apps-pop .mn-lk-grade'); return !!g && getComputedStyle(g).display==='grid' && getComputedStyle(g).gridTemplateColumns.split(' ').length===3; }), 'lista');
   await p.evaluate(()=>MareNotif.linksCacheSet('hering','eve',{a:{titulo:'A',url:'https://a.example.com',ordem:1},b:{titulo:'B',url:'https://b.example.com',ordem:2},c:{titulo:'C',url:'https://c.example.com',ordem:3},d:{titulo:'D',url:'https://d.example.com',ordem:4}})); await p.waitForTimeout(200);
   t('4 links: volta a lista', await p.evaluate(()=>!document.querySelector('#mn-apps-pop .mn-lk-grade')), 'grade');
   await p.evaluate(()=>MareNotif.linksCacheSet('hering','eve',{b:{titulo:'Intranet',url:'https://intra.example.com',ordem:1},a:{titulo:'Portal do RH',desc:'Holerite e férias',url:'https://rh.example.com',img:'https://img.example.com/rh.png',ordem:2}})); await p.waitForTimeout(500); const im=await p.evaluate(()=>[...document.querySelectorAll('#mn-apps-pop .mn-lk-logo')].map(x=>x.querySelector('img')?'img':x.textContent.trim()));
   t('imagem que não carrega cai pro ícone do site e, falhando, vira a inicial', im.every(x=>x==='I'||x==='P'), im);
   await p.click('#mn-apps-pop button[data-mntab="meus"]'); await p.waitForTimeout(300);
   const m=await p.evaluate(()=>({n:[...document.querySelectorAll('#mn-apps-pop a.mn-lk .mn-lk-t')].map(x=>x.textContent), gerir:document.querySelector('#mn-apps-pop a.mn-lk-gerir')?.getAttribute('href')}));
   t('aba Meus links: só os dele + atalho "Adicionar ou editar"', m.n.join()==='Meu Drive' && /oceano-dev\.html#meus-links/.test(m.gerir), m);
   t('sem erro de JS (menu)', !errs.length, errs); await ctx.close(); }
 { const {ctx,p}=await open('okr-dev.html',U('ext','Externo','ext@gmail.com')); await p.waitForTimeout(500); const r=await p.evaluate(()=>{ const b=document.getElementById('mn-apps-btn'); if(!b) return null; b.click(); return {abas:document.querySelectorAll('#mn-apps-pop .mn-tabs').length}; });
   t('visualizador externo: sem abas de links (só produtos)', !r || r.abas===0, r); await ctx.close(); }
 // 3) Oceano: links na tela inicial + editor em ⚙ Meu perfil
 { const {ctx,p,errs}=await open('oceano-dev.html',U('eve','Eve'));
   const r=await p.evaluate(()=>({h:[...document.querySelectorAll('#lk-hering .lk-t')].map(x=>x.textContent), m:[...document.querySelectorAll('#lk-meus .lk-t')].map(x=>x.textContent)}));
   t('Oceano: links da Hering e meus aparecem na tela inicial', r.h.join()==='Intranet,Portal do RH' && r.m.join()==='Meu Drive', r);
   await p.click('#btn-eu'); await p.waitForTimeout(300); await p.fill('#pfl-titulo','Jira'); await p.fill('#pfl-url','http://jira.example.com'); await p.fill('#pfl-img','http://insegura/x.png'); await p.click('#pfl-salvar'); await p.waitForTimeout(300);
   t('imagem http:// (não https) é recusada', !(await p.evaluate(()=>window.__log.some(l=>l[0]==='update'&&/usuarios\/eve\/links$/.test(l[1])))), 'gravou');
   await p.fill('#pfl-img',''); await p.click('#pfl-salvar'); await p.waitForTimeout(400);
   const s=await p.evaluate(()=>({m:[...document.querySelectorAll('#lk-meus .lk-t')].map(x=>x.textContent), c:JSON.parse(localStorage.getItem('mare_links_user_eve')).v}));
   t('salvar link: aparece na tela inicial e no cache compartilhado com o menu', s.m.join()==='Meu Drive,Jira' && Object.keys(s.c).length===2, s);
   await p.click('#pf-links button[data-lk="up"][data-id]:not([disabled])'); await p.waitForTimeout(300);
   t('▲ reordena meus links', await p.evaluate(()=>[...document.querySelectorAll('#lk-meus .lk-t')].map(x=>x.textContent).join()==='Jira,Meu Drive'), 'ordem');
   await p.click('#pf-links button[data-lk="del"]'); await p.waitForTimeout(300);
   t('✕ remove (confirmando)', await p.evaluate(()=>document.querySelectorAll('#lk-meus a.lk').length===1), 'ficaram');
   t('sem erro de JS (Oceano)', !errs.length, errs); await ctx.close(); }
 { const {ctx,p}=await open('oceano-dev.html#meus-links',U('eve','Eve')); await p.waitForTimeout(400); t('link #meus-links abre o perfil já no editor de links', await p.evaluate(()=>document.getElementById('ov-perfil').classList.contains('open') && !!document.getElementById('pfl-titulo')), 'fechado'); await ctx.close(); }
 // 4) dentro do Oceano: "Adicionar ou editar" do menu abre o perfil do lobby
 { const {ctx,p}=await open('oceano-dev.html',U('eve','Eve')); await p.evaluate(()=>{ const s=JSON.parse(localStorage.getItem('oceano_prefs')||'{}'); s.abrir='aqui'; localStorage.setItem('oceano_prefs',JSON.stringify(s)); }); await p.reload(); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U('eve','Eve')); await p.waitForTimeout(900);
   await p.click('#tiles .tile-main[data-app="okr"]'); await p.waitForTimeout(1500); const fr=p.frames().find(f=>/okr-dev\.html/.test(f.url())); await fr.waitForFunction(()=>!!window.__authCb); await fr.evaluate(x=>window.__authCb(x),U('eve','Eve')); await fr.waitForTimeout(2200);
   await fr.click('#mn-apps-btn'); await fr.click('#mn-apps-pop button[data-mntab="meus"]'); await fr.waitForTimeout(300); await fr.click('#mn-apps-pop a.mn-lk-gerir'); await p.waitForTimeout(500);
   t('menu dentro do Oceano: "Adicionar ou editar" volta ao lobby e abre ⚙ Meu perfil nos links', await p.evaluate(()=>!document.getElementById('host').classList.contains('on') && document.getElementById('ov-perfil').classList.contains('open')), 'não abriu'); await ctx.close(); }
 await b.close(); console.log(ok?'TUDO OK':'HÁ FALHAS'); })();
