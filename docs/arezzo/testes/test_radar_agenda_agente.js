// 🗓️ Subagente de agenda no Radar (okr-dev): cartões de proposta no chat do Agente + ✅ Confirmar aplicando pelos caminhos da tela.
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const U=(uid,n)=>({uid,email:uid+'@ciahering.com.br',displayName:n,photoURL:'',providerData:[{providerId:'google.com'}]});
const hoje=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}); const add=(n)=>{const d=new Date(hoje+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10);};
const ev=(id,x)=>Object.assign({id,tipo:'entrega',titulo:'Plano '+id,data:add(5),diaInteiro:true,hi:'',hf:'',torre:'digital',areaIds:[],objetivoIds:[],tagIds:[],convidados:['raf'],lembrar:{vespera:true,dia:true},local:'',link:'',descricao:'',rec:null,excecoes:{},status:'a_fazer',macro:'plan',criadoPor:{uid:'ana',nome:'Ana ADM'},criadoEm:'2026-11-01T00:00:00.000Z',atualizadoEm:'2026-11-01T00:00:00.000Z'},x||{});
const prop=(id,x)=>Object.assign({id,status:'pendente',porUid:'ana',porNome:'Ana ADM',ts:new Date().toISOString(),resumo:'**Teste** — resumo'},x||{});
const seed=()=>({kanban:{okr:{objetivos:{},marcos:{},
  calendario:{eventos:{a:ev('a'),b:ev('b',{convidados:['raf'],data:add(8)}),pai:ev('pai'),f1:ev('f1',{paiId:'pai',status:'andamento'}),f2:ev('f2',{paiId:'pai',status:'entregue'})}},
  agente_chat:{m1:{id:'m1',uid:'agente-agil',author:'🤖 Agente Ágil',init:'🤖',text:'Deixei 6 propostas prontas.',ts:new Date().toISOString(),propostas:['pc','pe','pd','ps','pk','px']}},
  agenda_propostas:{
    pc:prop('pc',{acao:'criar',eventoId:'novo1',resumo:'**Criar** — **Reunião: All Hands** — dia todo',ev:ev('novo1',{tipo:'reuniao',titulo:'All Hands',macro:'check',status:undefined,convidados:['raf']})}),
    pe:prop('pe',{acao:'editar',eventoId:'a',baseEm:'2026-11-01T00:00:00.000Z',resumo:'**Editar** — Plano a',ev:ev('a',{data:add(12),titulo:'Plano a (novo prazo)',atualizadoEm:'2026-11-03T00:00:00.000Z'})}),
    pd:prop('pd',{acao:'excluir',eventoId:'b',resumo:'**Excluir Entrega: Plano b**'}),
    ps:prop('ps',{acao:'mudar_situacao',eventoId:'f1',situacao:'entregue',resumo:'**Entrega: Plano f1** — situação Em andamento → Entregue'}),
    pk:prop('pk',{acao:'cobrar',eventoId:'a',uids:['raf'],mensagem:'Como está o Plano a?',eventoData:add(5),resumo:'**Cobrar: Plano a**'}),
    px:prop('px',{acao:'editar',eventoId:'b',baseEm:'1999-01-01T00:00:00.000Z',resumo:'**Editar** — velha',ev:ev('b',{titulo:'não deve gravar'})}),
  }},
 usuarios:{ana:{uid:'ana',nome:'Ana ADM',email:'ana@ciahering.com.br',inscrito:true},raf:{uid:'raf',nome:'Rafa Resp',email:'raf@ciahering.com.br',inscrito:true},zed:{uid:'zed',nome:'Zed Outro',email:'zed@ciahering.com.br',inscrito:true}},config:{adm_emails:['ana@ciahering.com.br']}}});
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true; const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,500))); };
 const abrir=async(user,w)=>{ const ctx=await b.newContext({viewport:{width:w||1280,height:900}}); await fake.install(ctx,seed()); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
   await p.goto('http://localhost:8941/okr-dev.html'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),user); await p.waitForTimeout(1500);
   await p.evaluate(()=>_okrToggleAgenteChat()); await p.waitForTimeout(700); return {ctx,p,errs}; };
 const st=(p,id)=>p.evaluate(i=>okrAgendaPropostas[i]&&okrAgendaPropostas[i].status,id);
 const clica=async(p,id,rot)=>{ await p.evaluate(([i,r])=>{ const c=document.querySelector('.okr-prop[data-prop="'+i+'"]'); [...c.querySelectorAll('button')].find(bb=>bb.innerText.includes(r)).click(); },[id,rot]); await p.waitForTimeout(700); };
 // ── quem pediu (ADM) confirma
 { const {ctx,p,errs}=await abrir(U('ana','Ana ADM'));
   const cards=await p.evaluate(()=>[...document.querySelectorAll('.okr-prop')].map(c=>({t:c.querySelector('.okr-prop-tt').innerText,btn:[...c.querySelectorAll('button')].map(x=>x.innerText)})));
   t('6 cartões de proposta, cada um com ✅ Confirmar e ✖ Descartar', cards.length===6 && cards.every(c=>c.btn.length===2 && /Confirmar/.test(c.btn[0])), cards);
   t('título do cartão diz a ação (PROPOSTA · CRIAR EVENTO…)', /CRIAR EVENTO/.test(cards[0].t) && /COBRAR/.test(cards[4].t), cards.map(c=>c.t));
   t('NADA aplicado antes de confirmar', await p.evaluate(()=>!okrEventos.novo1 && okrEventos.a.titulo==='Plano a' && !!okrEventos.b), '');
   await clica(p,'pc','Confirmar'); t('criar: evento criado e proposta confirmada', await p.evaluate(()=>!!okrEventos.novo1 && okrEventos.novo1.titulo==='All Hands' && okrEventos.novo1.macro==='check') && (await st(p,'pc'))==='confirmada', await st(p,'pc'));
   await clica(p,'pe','Confirmar'); t('editar: título e prazo mudaram', await p.evaluate(()=>okrEventos.a.titulo==='Plano a (novo prazo)'), await p.evaluate(()=>okrEventos.a.titulo));
   await clica(p,'px','Confirmar'); t('editar com base velha (evento mudou depois da proposta): NÃO grava e marca falhou', (await st(p,'px'))==='falhou' && await p.evaluate(()=>okrEventos.b.titulo==='Plano b'), await st(p,'px'));
   await clica(p,'ps','Confirmar'); const sit=await p.evaluate(()=>({f1:okrEventos.f1.status, pai:okrEventos.pai.status})); t('mudar situação: filha entregue e o plano pai conclui junto (todas as filhas entregues)', sit.f1==='entregue' && sit.pai==='entregue', sit);
   await clica(p,'pk','Confirmar'); const nots=await p.evaluate(()=>{ const n=window.__fbData?null:null; return null; });
   const cobrou=await p.evaluate(async()=>{ const s=await window._get(window._ref(window._db,'kanban/usuarios/raf/notificacoes')); const v=Object.values(s.val()||{}).filter(n=>n.type==='okr_cobranca'); return v.map(n=>({t:n.title,sub:n.sub,ev:n.okrEventoId})); });
   t('cobrar: o responsável recebe a notificação okr_cobranca com a mensagem e o evento', cobrou.length===1 && /Como está o Plano a/.test(cobrou[0].sub) && cobrou[0].ev==='a', cobrou);
   await clica(p,'pd','Confirmar'); t('excluir: evento sumiu', await p.evaluate(()=>!okrEventos.b), '');
   const rod=await p.evaluate(()=>[...document.querySelectorAll('.okr-prop-ft')].map(x=>x.innerText.replace(/\s+/g,' ').trim()));
   t('cartões resolvidos mostram "Confirmada por Ana ADM" / "Não foi aplicada"', rod.filter(x=>/Confirmada por Ana ADM/.test(x)).length===5 && rod.some(x=>/Não foi aplicada: O evento mudou/.test(x)), rod);
   t('sem erro de JS (ADM)', errs.length===0, errs); await ctx.close(); }
 // ── descartar
 { const {ctx,p}=await abrir(U('ana','Ana ADM')); await clica(p,'pd','Descartar'); t('descartar não aplica nada', (await st(p,'pd'))==='descartada' && await p.evaluate(()=>!!okrEventos.b), await st(p,'pd')); await ctx.close(); }
 // ── outra pessoa (não é quem pediu nem ADM) só vê "Aguardando"
 { const {ctx,p}=await abrir(U('zed','Zed Outro')); const rod=await p.evaluate(()=>[...document.querySelectorAll('.okr-prop')].map(c=>({btn:c.querySelectorAll('button').length,ft:c.querySelector('.okr-prop-ft').innerText})));
   t('quem não pediu (e não é ADM) não vê botões — só "Aguardando Ana ADM confirmar"', rod.length===6 && rod.every(r=>r.btn===0 && /Aguardando Ana ADM/.test(r.ft)), rod); await ctx.close(); }
 // ── celular
 { const {ctx,p}=await abrir(U('ana','Ana ADM'),390); const w=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth, lw:document.getElementById('okr-agente-chat-list').scrollWidth, lc:document.getElementById('okr-agente-chat-list').clientWidth,
     alvo:Math.min(...[...document.querySelectorAll('.okr-prop-ft .btn')].map(x=>x.getBoundingClientRect().height))}));
   t('390px: sem rolagem lateral e botões do cartão com ≥ 34 px de altura', w.sw<=w.cw+1 && w.lw<=w.lc+1 && w.alvo>=34, w); await ctx.close(); }
 await b.close(); console.log(ok?'\nTUDO OK':'\nFALHOU'); process.exit(ok?0:1); })();
