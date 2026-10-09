// Gera os prints do guia-okr.html (okr.html, dados fictícios). Rodar de docs/arezzo/testes com o servidor estático na 8941: cd docs/arezzo/testes && node gerar_prints_guia.js → pasta guia_prints/*.jpg (1180 px). Depois: trocar os <img> do guia (ordem dos slides) por base64 desses arquivos.
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const agora=Date.now(), iso=ms=>new Date(ms).toISOString();
const mk=(id,t,o,extra)=>({id,titulo:t,areaId:'geral',trimestres:['2026-Q4'],responsaveis:['ana'],tagIds:[],history:[],ordem:o,indicadores:[],progressoPct:0,...extra});
const seed={kanban:{okr:{objetivos:{
 d1:mk('d1','Lançar programa de fidelidade',0,{torre:'digital',areaId:'crm'}),d2:mk('d2','Reduzir tempo de checkout',1,{torre:'digital',areaId:'tech'}),
 c1:mk('c1','Abrir 12 lojas no Nordeste',0,{torre:'digital'}),c2:mk('c2','Elevar ticket médio em 8%',1,{torre:'digital'}),
 k1:mk('k1','Fechar o orçamento 2027',0,{torre:'digital'})},
 marcos:{m1:{id:'m1',objetivoId:'c1',nome:'Contrato das 4 primeiras lojas',progresso:'concluido',prazo:'2026-10-20'}},snapshots:{},
 mural:{a:{id:'a',tipo:'urgente',titulo:'Reunião do OKR passou pra quinta, 10h',corpo:'Atualizem os Marcos até quarta à noite.',torres:['*'],autor:'Ana ADM',autorUid:'ana',ts:iso(agora-3600e3)},
        b:{id:'b',tipo:'novidade',titulo:'Digital Hering agora tem as próprias gerências',corpo:'Use ⚙ Gerências na tela do OKR.',torres:['digital'],autor:'Ana ADM',autorUid:'ana',ts:iso(agora-7200e3)}},
 notif_feed:{f1:{id:'f1',tipo:'mural',torres:['*'],titulo:'🚨 Reunião do OKR passou pra quinta, 10h',sub:'Urgente · Atualizem os Marcos até quarta à noite.',muralId:'a',autorUid:'ana',autor:'Ana ADM',ts:iso(agora-3600e3)},
       f2:{id:'f2',tipo:'obj_criado',torres:['digital'],titulo:'🆕 Novo Objetivo: "Elevar ticket médio em 8%"',sub:'Digital Hering 🐟 · por Bia',objId:'c2',autorUid:'bia',autor:'Bia',ts:iso(agora-5400e3)},
       f3:{id:'f3',tipo:'marco_concluido',torres:['digital'],titulo:'✅ Marco concluído: "Contrato das 4 primeiras lojas"',sub:'Objetivo: Abrir 12 lojas no Nordeste',objId:'c1',autorUid:'bia',autor:'Bia',ts:iso(agora-9000e3)}},
 notif_feed_seen:{eve:{ts:iso(agora-86400e3)}}},
 usuarios:{ana:{uid:'ana',nome:'Ana ADM',email:'ana@ciahering.com.br',inscrito:true},bia:{uid:'bia',nome:'Bia Silva',email:'bia@ciahering.com.br',inscrito:true,torre:'digital',gestorOkr:true},
  eve:{uid:'eve',nome:'Eve Souza',email:'eve@ciahering.com.br',inscrito:true,torre:'digital',notificacoes:{n1:{id:'n1',type:'okr_mencao',title:'💬 Bia Silva te mencionou nas anotações do OKR',sub:'@Eve Souza pode trazer o número de lojas?',okrNotaData:'2026-10-07',read:false,ts:iso(agora-1200e3)},n2:{id:'n2',type:'okr_prazo',title:'🎯 Marco "Contrato" vence amanhã',sub:'Objetivo: Abrir 12 lojas no Nordeste',okrObjId:'c1',read:false,ts:iso(agora-4000e3)}}}},
 config:{adm_emails:['ana@ciahering.com.br']}}};
seed.kanban.notif_feed=seed.kanban.okr.notif_feed; delete seed.kanban.okr.notif_feed; seed.kanban.notif_feed_seen=seed.kanban.okr.notif_feed_seen; delete seed.kanban.okr.notif_feed_seen;
const U=(uid,n)=>({uid,email:uid+'@ciahering.com.br',displayName:n,photoURL:'',providerData:[{providerId:'google.com'}]});
// ── extras do 2º lote (calendário, trava, cabeçalho novo) ──
const _eveN=()=>{ seed.kanban.usuarios.eve.notificacoes.n2={id:'n2',type:'okr_reuniao',title:'🗓️ Amanhã: Check-in OKR — Bloco 1',sub:'qui '+quinta.slice(8)+'/'+quinta.slice(5,7)+' · 10:00–11:00 · Agenda Digital Hering 🐟 · Você está convidado(a)',okrEventoId:'b1',okrEventoData:quinta,read:false,ts:iso(Date.now()-1200e3)};
  seed.kanban.notif_feed.f4={id:'f4',tipo:'okr_evento',torres:['digital'],titulo:'🗓️ Nova reunião: Reunião semanal — Digital',sub:'ter 13/10 · 09:00–09:45 · ↻ toda semana · Agenda Digital Hering 🐟',eventoId:'c1',evData:prox(add(hoje,1),2),icone:'🗓️',autorUid:'ana',autor:'Ana ADM',ts:iso(Date.now()-2400e3)}; };
const hoje=new Date().toLocaleDateString('en-CA'); const add=(s,n)=>{const d=new Date(s+'T00:00:00'); d.setDate(d.getDate()+n); return d.toLocaleDateString('en-CA');};
const prox=(s,dow)=>{ let d=s; while(new Date(d+'T00:00:00').getDay()!==dow) d=add(d,1); return d; };
const quinta=prox(add(hoje,1),4); _eveN();
const ev=(id,extra)=>({id,titulo:'Evento '+id,tipo:'reuniao',data:hoje,diaInteiro:false,hi:'10:00',hf:'11:00',torre:'',areaIds:[],objetivoIds:[],tagIds:[],convidados:[],lembrar:{vespera:true,dia:true},local:'',link:'',descricao:'',rec:null,excecoes:{},criadoPor:{uid:'ana',nome:'Ana ADM'},criadoEm:iso(agora-864e5),atualizadoEm:iso(agora-864e5),...extra});
seed.kanban.okr.tags={t1:{label:'Peak Natal',colorIdx:1}};
seed.kanban.okr.objetivos.d1.tagIds=['t1']; seed.kanban.okr.objetivos.d1.responsaveis=['ana','bia'];
seed.kanban.okr.marcos.m2={id:'m2',objetivoId:'d1',nome:'Regras de pontos aprovadas',progresso:'risco',prazo:add(hoje,3)}; seed.kanban.okr.marcos.m3={id:'m3',objetivoId:'d2',nome:'Novo fluxo em produção',progresso:'atrasado',prazo:add(hoje,-4)};
seed.kanban.okr.calendario={eventos:{
  b1:ev('b1',{titulo:'Check-in OKR — Bloco 1',data:quinta,torre:'digital',areaIds:['geral','comercial','performance','dadosia'],convidados:['bia'],origem:'bloco_quinzenal',rec:{tipo:'quinzenal',unidade:'semana',intervalo:2,ate:''},link:'https://meet.google.com/abc-defg-hij',descricao:'Reunião quinzenal de check-in dos OKRs. Atualizem os Marcos até a véspera.'}),
  b2:ev('b2',{titulo:'Check-in OKR — Bloco 2',data:add(quinta,7),torre:'digital',areaIds:['cx','tech','crm'],origem:'bloco_quinzenal',rec:{tipo:'quinzenal',unidade:'semana',intervalo:2,ate:''}}),
  g1:ev('g1',{titulo:'All hands trimestral',tipo:'evento',data:add(hoje,9),torre:'',hi:'15:00',hf:'16:30',local:'Auditório'}),
  c1:ev('c1',{titulo:'Reunião semanal — Digital',data:prox(add(hoje,1),2),torre:'digital',hi:'09:00',hf:'09:45',rec:{tipo:'semanal',unidade:'semana',intervalo:1,ate:''}}),
  k1:ev('k1',{titulo:'Fechar orçamento 2027',tipo:'lembrete',data:add(hoje,5),torre:'digital',diaInteiro:true,hi:'',hf:''}),
  p1:ev('p1',{titulo:'Peak Natal — alinhamento',data:add(hoje,2),torre:'digital',tagIds:['t1'],hi:'14:00',hf:'15:00'}) }};
seed.kanban.okr.calendario.notas={b1:{[hoje]:{n1:{texto:'Decidimos antecipar o piloto do programa de fidelidade. @Bia Silva fica com o desenho das regras.',autorUid:'ana',ts:iso(agora-3600e3)}}}};
const open=async(b,u,qs,h)=>{ const ctx=await b.newContext({viewport:{width:1180,height:h||760}}); await fake.install(ctx,JSON.parse(JSON.stringify(seed))); const p=await ctx.newPage(); await p.goto('http://localhost:8941/okr.html'+(qs||'')); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),u); await p.waitForTimeout(1100); await p.evaluate(()=>{ try{ _okrMuralVistoMarca('a'); _okrMuralPopFecha(); }catch(e){} }); return {ctx,p}; };
const shot=async(p,name,clip)=>{ await p.addStyleTag({content:'.version{display:none!important}'+(/agente|lista|ger/.test(name)?'':'#okr-agente-fab{display:none!important}')}); return p.screenshot({path:name,type:'jpeg',quality:80,clip:clip||{x:0,y:22,width:1180,height:660}})};

// ── v2.58: snapshots (Dashboard), cards com badge OKR (aba Cards), chat do Agente Ágil ──
const fridays=[]; { let d=new Date(); while(d.getDay()!==5) d.setDate(d.getDate()-1); for(let i=7;i>=0;i--){ const x=new Date(d); x.setDate(x.getDate()-7*i-7); fridays.push(x.toLocaleDateString('en-CA')); } }
const O=seed.kanban.okr.objetivos; const ids=['d1','d2','c1','c2','k1'];
const ST=['nao_iniciado','no_prazo','risco','atrasado','concluido'];
Object.assign(O.c1,{areaId:'comercial'}); Object.assign(O.c2,{areaId:'comercial'}); Object.assign(O.k1,{areaId:'geral'});
ids.forEach((id,i)=>{ O[id].torre='digital'; O[id].atingimento={tipo:'porcentagem',inicial:0,meta:100,lancamentos:[{id:'l1',em:fridays[1],valor:12+i*3},{id:'l2',em:fridays[4],valor:35+i*4},{id:'l3',em:fridays[7],valor:62+i*5}]}; });
const snaps={}; fridays.forEach((d,k)=>{ const o={}, rg={total:0,nao_iniciado:0,no_prazo:0,risco:0,atrasado:0,concluido:0};
  ids.forEach((id,i)=>{ if(k<(i%2)) return; const st=ST[(i*2+k+(k>5&&i<2?2:0))%5]; const pct=Math.min(100,Math.round(10+k*8+i*4+(k>5?5:0)));
    o[id]={titulo:O[id].titulo,areaId:O[id].areaId,torre:'digital',status:st,progressoPct:pct,totalMarcos:4,marcosConcluidos:Math.floor(pct/26),atingimentoTipo:'porcentagem',atingimentoPct:pct}; rg.total++; rg[st]++; });
  snaps[d]={date:d,resumoGeral:rg,objetivos:o}; });
seed.kanban.okr.snapshots=snaps;
seed.kanban.usuarios.ana.squads={dados:true,dev:true}; seed.kanban.usuarios.ana.role='adm';
seed.kanban.config.adm_emails=['ana@ciahering.com.br'];
seed.kanban.squads_meta={dados:{label:'Dados',emoji:'📊',color:'#38b6ff'},dev:{label:'Dev',emoji:'💻',color:'#1de9b6'}};
seed.kanban.okr.objetivos.d1.cardLinks=[{squadId:'dados',cardId:'c1'}];
seed.kanban.squads={dados:{dados:{columns:[{id:'todo',name:'A fazer'},{id:'doing',name:'Em andamento'}],tags:[],cards_index:{c1:'k1',c2:'k2',c3:'k3'},cards:{
  k1:{id:'c1',title:'Campanha de lançamento do programa de fidelidade',col:'doing',owner:'AA',due:add(hoje,6),isOKR:true},
  k2:{id:'c2',title:'Painel de vendas por loja',col:'todo',owner:'BS',due:add(hoje,12),isOKR:true},
  k3:{id:'c3',title:'Relatório semanal de atingimento',col:'doing',owner:'AA',isOKR:true}}}},
 dev:{dados:{columns:[{id:'a',name:'Fila'}],tags:[],cards_index:{cx:'kx'},cards:{kx:{id:'cx',title:'Novo fluxo de checkout em 3 passos',col:'a',owner:'BS',isOKR:true}}}}};
const agoraT=Date.now();
seed.kanban.okr.agente_chat={
  m1:{id:'m1',uid:'ana',author:'Ana ADM',init:'AA',text:'como estão os atingimentos?',ts:iso(agoraT-600e3)},
  m2:{id:'m2',uid:'agente-agil',author:'Agente Ágil',text:'Hoje o **atingimento médio da Digital Hering 🐟 é 79%**, +9 pp desde a semana passada.\n\n• ✅ Fidelidade 2.0 — 73%\n• ⚠️ Reduzir tempo de resposta — 76%, mas **atrasado**: faltam 2 Marcos\n\nQuer que eu registre algum valor novo?',ts:iso(agoraT-580e3)},
  m3:{id:'m3',uid:'ana',author:'Ana ADM',init:'AA',text:'registra 82% em Receita por canal hoje',ts:iso(agoraT-300e3)},
  m4:{id:'m4',uid:'agente-agil',author:'Agente Ágil',text:'Pronto: registrei **82%** em *Receita por canal* (hoje). A barra do Objetivo já mostra o novo valor.',ts:iso(agoraT-280e3)}};

(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 const fs=require('fs'); fs.mkdirSync('guia_prints',{recursive:true});
 const full={x:0,y:0,width:1180,height:660}, tall={x:0,y:0,width:1180,height:716};
 // lista da torre (cabeçalho novo: Cards, ⋮⋮⋮, 📢, 🔔, 🌙; botão flutuante do Agente)
 { const {ctx,p}=await open(b,U('ana','Ana ADM'),'?torre=digital'); await p.waitForTimeout(500); await shot(p,'guia_prints/lista.jpg',full); 
   await p.evaluate(()=>openOkrGerencias('digital')); await p.waitForTimeout(500); await shot(p,'guia_prints/ger.jpg',full); await ctx.close(); }
 // mural
 { const {ctx,p}=await open(b,U('ana','Ana ADM')); await p.evaluate(()=>openOkrMural()); await p.waitForTimeout(400); await shot(p,'guia_prints/mural.jpg',full); await ctx.close(); }
 // sino
 { const {ctx,p}=await open(b,U('eve','Eve Souza')); await p.click('#okr-bell-btn'); await p.waitForTimeout(500); await shot(p,'guia_prints/sino.jpg',full); await ctx.close(); }
 // calendário + evento
 { const {ctx,p}=await open(b,U('ana','Ana ADM'),'?torre=digital'); await p.evaluate(({q})=>{ _okrToggleCal(); _okrCalSetVista('mes'); _okrCalSetTorre(''); _okrCalSelDia(q); },{q:quinta}); await p.waitForTimeout(500); await shot(p,'guia_prints/cal.jpg',tall);
   await p.evaluate(({q})=>openOkrEvento('b1',q),{q:quinta}); await p.waitForTimeout(500); await shot(p,'guia_prints/evt.jpg',tall); await ctx.close(); }
 // trava
 { const {ctx,p}=await open(b,U('bia','Bia Silva'),'?torre=digital'); await p.evaluate(({t})=>window._set(window._ref(window._db,'kanban/okr/obj_locks/d1'),{uid:'ana',who:'Ana ADM',ts:t}),{t:Date.now()}); await p.waitForTimeout(500);
   await p.evaluate(()=>openOkrObjetivo('d1')); await p.waitForTimeout(700); await shot(p,'guia_prints/trava.jpg',tall); await ctx.close(); }
 // Dashboard: topo (número grande + linha) e situação/o que mudou; detalhe de um Objetivo
 { const {ctx,p}=await open(b,U('ana','Ana ADM'),'?torre=digital'); await p.evaluate(()=>_okrSetView('historico')); await p.waitForTimeout(1500);
   await shot(p,'guia_prints/dash1.jpg',{x:0,y:96,width:1180,height:700});
   await p.evaluate(()=>window.scrollTo(0,640)); await p.waitForTimeout(300); await shot(p,'guia_prints/dash2.jpg',{x:0,y:0,width:1180,height:700});
   await p.click('#okr-h-tbl .okr-h-tr.row >> nth=0'); await p.waitForTimeout(600); await p.evaluate(()=>document.getElementById('okr-h-tbl').scrollIntoView()); await p.waitForTimeout(300); await shot(p,'guia_prints/dash3.jpg',{x:0,y:0,width:1180,height:716}); await ctx.close(); }
 // Cards
 { const {ctx,p}=await open(b,U('ana','Ana ADM'),'?torre=digital'); await p.click('#okr-cards-btn'); await p.waitForTimeout(400); await p.click('#okr-cards-root button.btn'); await p.waitForTimeout(1500); await shot(p,'guia_prints/cards.jpg',full); await ctx.close(); }
 // Agente Ágil: botão flutuante + painel do chat aberto
 { const {ctx,p}=await open(b,U('ana','Ana ADM'),'?torre=digital',760); await p.click('#okr-agente-fab'); await p.waitForTimeout(800); await shot(p,'guia_prints/agente.jpg',{x:0,y:0,width:1180,height:760}); await ctx.close(); }
 await b.close(); })();
