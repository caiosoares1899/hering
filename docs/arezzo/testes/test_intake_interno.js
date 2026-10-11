// 📥 Intake interno (intake-dev.html + kanban-dev.html): mesmo link com dois modos.
//   Público (sem login) = formulário de sempre via Cloud Function; Interno (Google @ciahering) = poucos toques, grava direto em intake_pending.
// PAGE=intake.html / K=kanban testam a prod depois da promoção.
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const PAGE=process.env.PAGE||'intake-dev.html', K=process.env.K||'kanban-dev';
const U={uid:'eve',email:'eve@ciahering.com.br',displayName:'Eve Souza',photoURL:'',providerData:[{providerId:'google.com'}]};
const GMAIL={uid:'gg',email:'fulano@gmail.com',displayName:'Fulano',photoURL:'',providerData:[{providerId:'google.com'}]};
const seed=()=>({kanban:{
  squads_meta:{mkt:{label:'Marketplace',emoji:'🛒',color:'#ffd166'}},
  usuarios_publicos:{eve:{uid:'eve',nome:'Eve',init:'EV',squads:{dev:true}},ana:{uid:'ana',nome:'Ana',init:'AN',squads:{dev:true,mkt:true}},bia:{uid:'bia',nome:'Bia',init:'BI',squads:{mkt:true}}},
  usuarios:{eve:{uid:'eve',nome:'Eve',email:'eve@ciahering.com.br',init:'EV',role:'membro',inscrito:true,squads:{dev:true}}},
  squads:{
    dev:{dados:{agil_cfg:{intakeEnabled:true,intakeCampos:{tags:{on:true,req:false,ids:['t_camp']},prazo:{on:true,req:true}}},
      tags:[{id:'t_camp',label:'Campanha',pi:1},{id:'t_out',label:'Outro',pi:2},{id:'tag_sm_a',label:'Hering Adulto Comercial',pi:4},{id:'tag_sm_b',label:'Hering Kids Comercial',pi:4},{id:'tag_cv_x',label:'Dafiti',pi:5}],
      config:{submarca_ativo:true,submarcas_visiveis:{tag_sm_b:false},canal_venda_ativo:false}}},
    mkt:{dados:{agil_cfg:{intakeEnabled:false},tags:[{id:'x',label:'X'}]}},
  }}});
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true; const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+String(JSON.stringify(d===undefined?null:d)).slice(0,400))); };
 const open=async(user,qs,fnEnabled)=>{ const ctx=await b.newContext({viewport:{width:420,height:900}}); await fake.install(ctx,seed());
   const posts=[]; await ctx.route('https://us-central1-hering-onboarding.cloudfunctions.net/**',async r=>{ const rq=r.request(); const h={'access-control-allow-origin':'*','access-control-allow-headers':'Content-Type','access-control-allow-methods':'GET,POST,OPTIONS'};
     if(rq.method()==='OPTIONS') return r.fulfill({status:204,headers:h});
     if(rq.method()==='POST'){ posts.push(JSON.parse(rq.postData()||'{}')); return r.fulfill({status:200,headers:h,contentType:'application/json',body:JSON.stringify({ok:true})}); }
     return r.fulfill({status:200,headers:h,contentType:'application/json',body:JSON.stringify({ok:true,intakeEnabled:fnEnabled!==false,squad:{id:'dev',label:'Dev',emoji:'🧪'}})}); });
   const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
   await p.goto('http://localhost:8941/'+PAGE+qs); await p.waitForFunction(()=>!!window.__authCb); if(user) await p.evaluate(x=>window.__authCb(x),user); await p.waitForTimeout(700); return {ctx,p,errs,posts}; };
 const vis=(p,sel)=>p.evaluate(s=>{ const e=document.querySelector(s); return !!e && getComputedStyle(e).display!=='none' && e.offsetParent!==null; },sel);

 // ── PÚBLICO ──
 { const {ctx,p,errs,posts}=await open(null,'?squad=dev');
   t('sem login: formulário público (nome, contato, squad solicitante) + botão "Entrar com Google"', await vis(p,'#intake-form') && !(await vis(p,'#intake-int')) && await vis(p,'#btn-google'), await p.evaluate(()=>document.body.innerText.slice(0,200)));
   await p.fill('#f-titulo','Banner X'); await p.fill('#f-descricao','Preciso de um banner'); await p.fill('#f-demandante','Fulano'); await p.selectOption('#f-squad-demandante','Omni'); await p.click('#btn-submit'); await p.waitForTimeout(500);
   t('envio público continua indo pela Cloud Function (payload com squad/nome/squad solicitante)', posts.length===1 && posts[0].squad==='dev' && posts[0].demandante==='Fulano' && posts[0].squadDemandante==='Omni', posts);
   t('mensagem de sucesso aparece', /Pedido enviado/.test(await p.evaluate(()=>document.getElementById('msg').textContent)));
   await p.evaluate(x=>window.__authCb(x),GMAIL); await p.waitForTimeout(400);
   t('conta que não é @ciahering não vira modo interno', !(await vis(p,'#intake-int')) && (await p.evaluate(()=>window.__intake.modo))==='publico');
   t('sem erro de JS (público)', !errs.length, errs); await ctx.close(); }
 { const {ctx,p}=await open(null,'?squad=dev',false); t('squad com intake desligado: público vê o aviso', await vis(p,'#disabled'), 0); await ctx.close(); }
 { const {ctx,p}=await open(null,''); t('sem ?squad e sem login: link inválido', await vis(p,'#invalid'), 0); await ctx.close(); }

 // ── INTERNO ──
 { const {ctx,p,errs}=await open(U,'?squad=dev');
   t('logado @ciahering: abre o formulário interno (sem o público)', await vis(p,'#intake-int') && !(await vis(p,'#intake-form')), 0);
   const f=await p.evaluate(()=>({ nome:!!document.getElementById('i-nome')||!!document.getElementById('f-demandante') && getComputedStyle(document.getElementById('f-demandante')).display!=='none' && document.getElementById('f-demandante').offsetParent!==null,
     who:document.querySelector('.who')?.innerText.replace(/\s+/g,' '), prio:[...document.querySelectorAll('#g-prio .chip')].map(c=>c.textContent.trim()+(c.getAttribute('aria-pressed')==='true'?'*':'')),
     sm:[...document.querySelectorAll('#g-sm .chip')].map(c=>c.textContent.trim()), cv:!!document.getElementById('g-cv'), tags:[...document.querySelectorAll('#g-tags .chip')].map(c=>c.textContent.trim()), link:!!document.getElementById('i-link'), prazo:!!document.getElementById('i-prazo'),
     dest:[...document.querySelectorAll('#s-dest option')].map(o=>o.textContent.trim()) }));
   t('identidade vem do login (sem digitar nome/contato)', !f.nome && /Eve Souza/.test(f.who||''), f);
   t('prioridade em 4 chips com Média já marcada', f.prio.join()==='🟢 Baixa,🟡 Média*,🔴 Alta,🔥 Crítica', f.prio);
   t('Submarca: chips vêm das tags do squad de destino (respeita "submarcas visíveis")', f.sm.join()==='Hering Adulto Comercial', f.sm);
   t('Canal desligado no squad = sem campo de canal', !f.cv, f);
   t('Tags: só as que o PO liberou (Campanha), nunca as de submarca/canal', f.tags.join()==='Campanha', f.tags);
   t('Link e prazo presentes; seletor "Pedir para" lista os squads', f.link && f.prazo && f.dest.some(x=>/Marketplace/.test(x)) && f.dest.some(x=>/Dev/.test(x)), f);
   // validação
   await p.click('#i-submit'); t('sem título: bloqueia com aviso', /título/i.test(await p.evaluate(()=>document.getElementById('msg').textContent)));
   await p.fill('#i-titulo','Banner Black'); await p.click('#i-submit'); t('sem detalhes: bloqueia', /descrever/i.test(await p.evaluate(()=>document.getElementById('msg').textContent)));
   await p.fill('#i-descricao','Banner pra home da Black'); await p.click('#i-submit'); t('prazo obrigatório (config do PO) sem preencher: bloqueia', /prazo/i.test(await p.evaluate(()=>document.getElementById('msg').textContent)));
   await p.click('[data-prazo="1"]'); const pz=await p.inputValue('#i-prazo'); t('atalho "Amanhã" preenche a data', /^\d{4}-\d{2}-\d{2}$/.test(pz), pz);
   await p.click('#i-submit'); t('submarca obrigatória (squad exige no card) sem escolher: bloqueia', /submarca/i.test(await p.evaluate(()=>document.getElementById('msg').textContent)));
   await p.click('[data-sm="tag_sm_a"]'); await p.click('#i-submit'); t('sem escolher o time solicitante: bloqueia', /time/i.test(await p.evaluate(()=>document.getElementById('msg').textContent)));
   await p.selectOption('#i-sqdem-sel','Omni'); await p.fill('#i-link','ftp://ruim'); await p.click('#i-submit'); t('link que não é http(s): bloqueia', /http/i.test(await p.evaluate(()=>document.getElementById('msg').textContent)));
   await p.fill('#i-link','https://figma.com/file/abc'); await p.click('[data-prio="critical"]'); await p.click('[data-tag="t_camp"]');
   await p.click('#i-submit'); await p.waitForTimeout(600);
   const it=await p.evaluate(()=>{ const m=window.__store.kanban.squads.dev.dados.intake_pending||{}; const k=Object.keys(m); return {n:k.length, it:m[k[0]]}; });
   t('grava 1 item em intake_pending com os campos estruturados', it.n===1 && it.it.origem==='interno' && it.it.titulo==='Banner Black' && it.it.prioridade==='critical' && it.it.submarca==='Hering Adulto Comercial' && it.it.squadDemandante==='Omni' && JSON.stringify(it.it.tags)==='["Campanha"]' && it.it.links?.[0]?.url==='https://figma.com/file/abc' && /^\d{4}/.test(it.it.prazo||'') && it.it.status==='pending' && it.it.solicitanteUid==='eve' && it.it.contato==='eve@ciahering.com.br', it);
   const nt=await p.evaluate(()=>{ const u=window.__store.kanban.usuarios||{}; return {ana:Object.values(u.ana?.notificacoes||{}).length, eve:Object.values(u.eve?.notificacoes||{}).length, bia:Object.values(u.bia?.notificacoes||{}).length, tipo:Object.values(u.ana?.notificacoes||{})[0]?.type}; });
   t('avisa os membros do squad de destino (🔔), sem avisar quem pediu nem quem é de outro squad', nt.ana===1 && nt.eve===0 && nt.bia===0 && nt.tipo==='intake', nt);
   t('mostra confirmação e botão "Fazer outro pedido"', /Pedido enviado/.test(await p.evaluate(()=>document.getElementById('msg').textContent)) && await vis(p,'#btn-outro') && !(await vis(p,'#intake-int')));
   await p.click('#btn-outro'); const re=await p.evaluate(()=>({tit:document.getElementById('i-titulo').value, sq:document.getElementById('i-sqdem-sel').value, prio:document.querySelector('#g-prio .chip[aria-pressed="true"]')?.textContent.trim()}));
   t('"Fazer outro" volta limpo, lembrando o time solicitante e voltando a prioridade Média', re.tit==='' && re.sq==='Omni' && /Média/.test(re.prio), re);
   // trocar squad de destino
   await p.selectOption('#s-dest','mkt'); await p.waitForTimeout(600);
   t('"Pedir para" um squad com intake desligado mostra o aviso', await vis(p,'#disabled'), 0);
   await p.selectOption('#s-dest','dev'); await p.waitForTimeout(600); t('voltando pro squad liga o formulário de novo', await vis(p,'#intake-int'), 0);
   t('sem erro de JS (interno)', !errs.length, errs); await ctx.close(); }
 // falha de gravação
 { const {ctx,p}=await open(U,'?squad=dev'); await p.evaluate(()=>{ window.__denySet=path=>/intake_pending/.test(path); });
   await p.fill('#i-titulo','T'); await p.fill('#i-descricao','D'); await p.click('[data-prazo="0"]'); await p.click('[data-sm="tag_sm_a"]'); await p.selectOption('#i-sqdem-sel','App'); await p.click('#i-submit'); await p.waitForTimeout(500);
   t('se o banco recusar, avisa e mantém o formulário preenchido (não finge sucesso)', /Não deu pra enviar/.test(await p.evaluate(()=>document.getElementById('msg').textContent)) && await vis(p,'#intake-int') && (await p.inputValue('#i-titulo'))==='T', 0); await ctx.close(); }
 // sem ?squad logado
 { const {ctx,p}=await open(U,''); t('logado sem ?squad: pede pra escolher o squad (sem formulário)', await vis(p,'#s-dest') && !(await vis(p,'#intake-int')) && !(await vis(p,'#invalid')), 0); await ctx.close(); }
 // celular estreito: sem rolagem lateral
 { const {ctx,p}=await open(U,'?squad=dev'); const w=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
   t('420 px: sem rolagem horizontal', w.sw<=w.cw+1, w); await ctx.close(); }

 // ── LADO DO MARÉ (kanban-dev): campos configuráveis + criar card ──
 { const ctx=await b.newContext({viewport:{width:1280,height:900}}); await ctx.addInitScript(()=>{ try{ sessionStorage.setItem('mare_login_local','1'); }catch(e){} }); /* sem o redirecionamento pro Oceano */ const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
   await p.goto('http://localhost:8941/'+K+'.html',{waitUntil:'load'}); await p.waitForTimeout(1500);
   const r=await p.evaluate(()=>{
     tags.splice(0,tags.length,{id:'t_camp',label:'Campanha',pi:1},{id:'t_out',label:'Outro',pi:2},{id:'tag_sm_a',label:'Hering Adulto Comercial',pi:4});
     submarcaAtivo=false; canalVendaAtivo=false; agilCfg={};
     fillIntakeCamposUI(); const ids=[...document.querySelectorAll('#cfg-intake-campos input[id$="-on"]')].map(e=>e.id.replace('cfg-ic-','').replace('-on',''));
     const padrao=JSON.stringify(_readIntakeCamposUI());
     document.getElementById('cfg-ic-tags-on').checked=true; _intakeCamposToggle('tags'); const wrap=getComputedStyle(document.getElementById('cfg-intake-tags-wrap')).display;
     const oferecidas=[...document.querySelectorAll('#cfg-intake-tags button')].map(x=>x.textContent);
     _intakeTagPick('t_camp'); document.getElementById('cfg-ic-prazo-req').checked=true;
     const lido=_readIntakeCamposUI();
     document.getElementById('cfg-ic-link-on').checked=false; _intakeCamposToggle('link'); const reqLink=document.getElementById('cfg-ic-link-req');
     const semLink={dis:reqLink.disabled,chk:reqLink.checked};
     // ligar Submarca depois: aparece a linha e o padrão passa a ser "mostrar + obrigatório"
     submarcaAtivo=true; agilCfg={intakeCampos:lido}; fillIntakeCamposUI(); const comSm=!!document.getElementById('cfg-ic-submarca-on') && document.getElementById('cfg-ic-submarca-req').checked;
     return {ids,padrao,wrap,oferecidas,lido,semLink,comSm}; });
   t('config: lista os campos (Submarca/Canal só se o squad usa)', JSON.stringify(r.ids)==='["prioridade","prazo","tags","link"]', r.ids);
   t('config: sem mexer em nada, não grava nada (tudo no padrão)', r.padrao==='{}', r.padrao);
   t('config: ligar Tags mostra o seletor, sem tags de tamanho/submarca/canal', r.wrap!=='none' && r.oferecidas.join()==='Campanha,Outro', r);
   t('config: só grava o que difere do padrão (tags ligadas c/ Campanha, prazo obrigatório)', JSON.stringify(r.lido)==='{"prazo":{"on":true,"req":true},"tags":{"on":true,"req":false,"ids":["t_camp"]}}', r.lido);
   t('config: desligar um campo desabilita e zera o "Obrigatório"', r.semLink.dis===true && r.semLink.chk===false, r.semLink);
   t('config: Submarca ligada no squad → linha aparece já obrigatória (segue o card)', r.comSm===true, r);
   const c=await p.evaluate(()=>{
     window.checkEditPermission=()=>true; submarcaAtivo=true; canalVendaAtivo=true;
     _intakeBucket['i1']={id:'i1',titulo:'Banner Black',descricao:'Pra home',demandante:'Eve Souza',contato:'eve@ciahering.com.br',squadDemandante:'Omni',origem:'interno',prioridade:'high',tags:['Campanha'],submarca:'Hering Adulto Comercial',links:[{url:'https://figma.com/x'},{url:'javascript:alert(1)'}],prazo:'2026-11-20',createdAt:new Date().toISOString(),status:'pending'};
     intakePendentes=[_intakeBucket['i1']]; const html=_intakeItemHtml(_intakeBucket['i1'],{showGuardar:true});
     _intakeCriarCard('i1');
     return { chips:/Alta/.test(html)&&/Campanha/.test(html)&&/figma\.com/.test(html)&&!/javascript:/.test(html)&&/🏢/.test(html), prio:document.getElementById('m-priority').value, desc:document.getElementById('desc-eoc')?.innerText||'', due:document.getElementById('m-due').value, links:_pendingTransferLinks, tagsSel:[...editingTags], pend:_intakeOrigemPendingId }; });
   t('caixa de entrada mostra 🏢, prioridade, tags e link (e descarta link perigoso)', c.chips, c);
   t('✅ Criar card: prioridade sugerida pré-selecionada e registrada na descrição', c.prio==='high' && /Prioridade pedida: 🔴 Alta/.test(c.desc), {prio:c.prio,desc:c.desc.slice(0,200)});
   t('✅ Criar card: prazo, tag, submarca e link (só o http) vão pro modal', c.due==='2026-11-20' && c.tagsSel.includes('t_camp') && c.tagsSel.includes('tag_sm_adulto_com') && c.links?.length===1 && c.links[0].url==='https://figma.com/x' && c.pend==='i1', c);
   const lk=await p.evaluate(()=>{ _copyIntakeLink(); return location.pathname; });
   t('sem erro de JS (kanban)', !errs.length, errs); await ctx.close(); }
 await b.close(); console.log(ok?'TUDO OK':'HÁ FALHAS'); })();
