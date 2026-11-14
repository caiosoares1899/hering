// F3 — node docs/arezzo/testes/test_ferias_aviso.js (Playwright + fakefb)
// FERIAS_BEFORE_DIR: diretório com ferias-before-kanban.html e ferias-before-okr.html de origin/main.
// 🏖️ Férias F3 (13/11/2026): avisos e selos, com boot real das duas páginas.
// Servidor local próprio, dados sintéticos, sem acesso ao Firebase real.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const home = require('node:os').homedir();
const pwPath = process.env.PLAYWRIGHT_MODULE || (fs.existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const { chromium } = require(pwPath);
const fake = require('./fakefb');

function resolveChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  if (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) return '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const r = path.join(home, 'hering-tools/chrome');
  const arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-'));
  return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
}

const ROOT = path.resolve(__dirname, '../../..');
const cap = process.env.CAPTURE_DIR || '';
const FIXO = '2026-11-13T15:00:00-03:00'; // 15:00 SP

const ANA = { uid: 'ana', nome: 'Ana Teste', email: 'ana@ciahering.com.br', init: 'AT', role: 'membro', squads: { dados: true } };
const BIA = { uid: 'bia', nome: 'Bia Outra', email: 'bia@ciahering.com.br', init: 'BO', role: 'membro', squads: { prf: true } };
const PO  = { uid: 'po1', nome: 'Paulo PO',  email: 'po@ciahering.com.br',  init: 'PP', role: 'po',     squads: { dados: true } };
const ADM = { uid: 'adm', nome: 'Alice ADM', email: 'adm@ciahering.com.br', init: 'AA', role: 'adm',    squads: { dados: true } };
const AL  = { uid: 'al1', nome: 'Lista Adm', email: 'lista@ciahering.com.br', init: 'LA', role: 'membro', squads: { dados: true } };
const VIS = { uid: 'vis1', nome: 'Visitante', email: 'visita@gmail.com',    init: 'VS', role: 'membro', prov: 'password' };

const seed = () => ({
  kanban: {
    okr: { objetivos: {}, marcos: {}, tags: {} },
    config: { adm_emails: ['lista@ciahering.com.br', 'adm@ciahering.com.br'] },
    painel_viewers: { 'visita@gmail,com': true },
    squads_meta: {
      dados: { label: 'Squad Dados e IA', emoji: '📊', active: true },
      prf: { label: 'Marketing de Performance', emoji: '📱', active: true },
    },
    squads: {
      dados: { meta: { label: 'Squad Dados e IA' }, dados: { columns: [{ id: 'c1', title: 'A fazer' }], cards: [] } },
      prf: { meta: { label: 'Marketing de Performance' }, dados: { columns: [{ id: 'c1', title: 'A fazer' }], cards: [] } },
    },
    usuarios: {
      ana: Object.assign({ inscrito: true }, ANA),
      bia: Object.assign({ inscrito: true }, BIA),
      po1: Object.assign({ inscrito: true }, PO),
      adm: Object.assign({ inscrito: true }, ADM),
      al1: Object.assign({ inscrito: true }, AL),
    },
    usuarios_publicos: {
      ana: { uid: 'ana', nome: ANA.nome, init: ANA.init, role: ANA.role, squads: ANA.squads },
      bia: { uid: 'bia', nome: BIA.nome, init: BIA.init, role: BIA.role, squads: BIA.squads },
      po1: { uid: 'po1', nome: PO.nome,  init: PO.init,  role: PO.role,  squads: PO.squads },
      adm: { uid: 'adm', nome: ADM.nome, init: ADM.init, role: ADM.role, squads: ADM.squads },
      al1: { uid: 'al1', nome: AL.nome,  init: AL.init,  role: AL.role,  squads: AL.squads },
    },
    ferias_dev: {
      bia: {
        f1: { ini: '2026-11-10', fim: '2026-11-20', obs: '<img src=x onerror=window.__xss=1>Cobertura: Ana', em: 1790000000000, por: 'bia' },
      },
      po1: {
        f2: { ini: '2026-11-25', fim: '2026-12-02', obs: 'Viagem', em: 1790000000000, por: 'po1' },
      },
    },
  },
});

function startServer() {
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.mp3': 'audio/mpeg' };
  const srv = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const fp = path.join(ROOT, urlPath === '/' ? 'okr-dev.html' : urlPath);
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(fp)] || 'application/octet-stream' });
    const alt = process.env.FERIAS_BEFORE_DIR && /^(kanban|okr)-dev\.html$/.test(path.basename(fp)) ? path.join(process.env.FERIAS_BEFORE_DIR,'ferias-before-'+path.basename(fp).split('-')[0]+'.html') : fp;
    fs.createReadStream(alt).pipe(res);
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok({ srv, base: 'http://127.0.0.1:' + srv.address().port })));
}

(async()=>{
 const {srv,base}=await startServer(); let b; let falhas=0;
 const check=(n,c)=>{console.log((c?'✅ ':'❌ ')+n);if(!c)falhas++;};
 try{
 b=await chromium.launch({executablePath:resolveChrome(),headless:true});
 for(const app of (process.env.FERIAS_APPS||'kanban,okr').split(',')) for(const width of [1280,390]) for(const tema of (process.env.FERIAS_TEMAS||'dark,light,vice').split(',')){
 const ctx=await b.newContext({viewport:{width,height:900}});
 const data=seed();
 // Personas inteiramente sintéticas, incluindo nome hostil para verificar o DOM.
 data.kanban.usuarios.bia.nome='<img src=x onerror=window.__xss=1>Bia';
 data.kanban.usuarios_publicos.bia.nome=data.kanban.usuarios.bia.nome;
 data.kanban.ferias_dev.po1.f2={ini:'2026-11-20',fim:'2026-12-02'};
 data.kanban.ferias_dev.al1={f:{ini:'2026-11-21',fim:'2026-12-02'}};
 data.kanban.ferias_dev.adm={f:{ini:'2026-11-12',fim:'2026-11-25'}};
 data.kanban.ferias_dev.ana={f:{ini:'2026-11-01',fim:'2026-11-12'}};
 await fake.install(ctx,data);
 const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(f=>{const R=Date;const fixed=new R(f).getTime();window.Date=class extends R{constructor(...a){super(...(a.length?a:[fixed]));}static now(){return fixed;}};localStorage.clear();localStorage.setItem('mare_guia_ocultar','1');},FIXO);
 await p.goto(base+'/'+app+'-dev.html');await p.waitForFunction(()=>!!window.__authCb);
 await p.evaluate(u=>window.__authCb({...u,displayName:u.nome,providerData:[{providerId:'google.com'}]}),ADM);
 await p.waitForTimeout(2800);
 await p.evaluate(tm=>{document.documentElement.dataset.theme=tm;},tema);
 const prefix=app==='kanban'?'_':'_okr';
 const pronto=await p.evaluate(pre=>typeof window[pre+'FeriasAvisar']==='function'&&!!window.MareFerias?.ausente('bia','2026-11-13'),prefix);
 check(app+'/'+width+': API inicializada sem abrir calendário',pronto);
 if(!pronto){await ctx.close();continue;}
 const results=await p.evaluate(pre=>{
 const avisar=window[pre+'FeriasAvisar'],selo=window[pre+'FeriasSelo'];
 const orig=showToast,calls=[];showToast=(...a)=>calls.push(a);
 const test=(xs)=>{calls.length=0;avisar(xs);return calls.map(x=>[...x]);};
 const atual=test(['BO']),futuro=test(['PP']),nenhum=test(['AT','LA']),grupo=test(['BO','bia','PP','adm']);
 const html=selo('BO'),prox=selo('PP');const F=window.MareFerias;window.MareFerias=undefined;let semErro=true;try{avisar(['BO']);selo('BO');}catch(e){semErro=false;}window.MareFerias=F;showToast=orig;
 return {atual,futuro,nenhum,grupo,html,prox,semErro};
 },prefix);
 check(app+'/'+width+': hoje e aviso de 6 segundos',results.atual.length===1&&results.atual[0][1]===6000&&results.atual[0][0].includes('até 20/11'));
 check(app+'/'+width+': sai em 7 dias',results.futuro[0]?.[0].includes('sai de férias em 20/11'));
 check(app+'/'+width+': passado e saída em 8 dias silenciosos',results.nenhum.length===0);
 check(app+'/'+width+': grupo sem duplicar inicial/uid',results.grupo.length===1&&(results.grupo[0][0].match(/Bia/g)||[]).length===1&&results.grupo[0][0].includes('Paulo PO')&&results.grupo[0][0].includes('Alice ADM'));
 check(app+'/'+width+': selo somente hoje e módulo ausente seguro',results.html.includes('De férias até 20/11')&&!results.prox&&results.semErro);
 await p.evaluate(pre=>window[pre+'FeriasAvisar'](['BO','PP']),prefix);
 const toast=app==='kanban'?'#kb-toast':'#toast';
 check(app+'/'+width+': nome hostil é texto',await p.$eval(toast,e=>e.textContent.includes('<img src=x')&&!e.querySelector('img')));
 // Pontos de entrada reais; isola apenas a persistência no teste de integração dos handlers.
 const points=await p.evaluate(async app=>{
 const out=[];const real=showToast;let msgs=[];showToast=(m)=>msgs.push(m);
 let who;
 const run=async(n,fn)=>{msgs=[];try{await fn();out.push([n+'/'+who.init,msgs.filter(m=>m.startsWith('🏖️')).length===(who.avisa?1:0)]);}catch(e){out.push([n,false,e.message]);}};
 for(who of [{init:'BO',uid:'bia',avisa:true},{init:'PP',uid:'po1',avisa:true},{init:'AT',uid:'ana',avisa:false},{init:'LA',uid:'al1',avisa:false}]){
 if(app==='kanban'){
   await run('menção',()=>{const ta=document.createElement('textarea');ta.id='f3-mention';ta.value='@';document.body.appendChild(ta);insertMention(ta,0,1,who.init);ta.remove();});
   await run('responsável',()=>{const sel=document.getElementById('m-owner');sel.innerHTML='<option value="'+who.init+'">Teste</option>';sel.value=who.init;sel.dispatchEvent(new Event('change'));});
   await run('participante',()=>{editingParticipants=[];const sel=document.getElementById('m-part-select');sel.innerHTML='<option value="'+who.init+'">Teste</option>';sel.value=who.init;addParticipant();});
   await run('lote',()=>{cards=[{id:'f3',title:'Teste',owner:'AA',col:columns[0]?.id||'c1',history:[]}];selectedCards.add('f3');_doBulkAssign(who.init);});
   await run('reatribuir',async()=>{cards=[{id:'f3',title:'Teste',owner:'AA',col:columns[0]?.id||'c1',history:[]}];for(const [id,val]of [['reassign-from','AA'],['reassign-to',who.init]]){const e=document.getElementById(id);e.innerHTML='<option value="'+val+'">Teste</option>';e.value=val;}const conf=uiConfirm;uiConfirm=async()=>true;try{await executarReatribuir();}finally{uiConfirm=conf;}});
 }else{
   await run('menção',()=>{const inp=document.getElementById('okr-notas-inp');inp.value='@';_okrMencaoEscolhe(who.uid);});
   await run('objetivo',()=>{openOkrObjetivo();_okrPessoaAdd('responsaveis',who.uid);});
   await run('marco',()=>{openOkrMarco(null,_okrEditingObjId||'f3');const sel=document.getElementById('okr-m-resp');sel.value=who.uid;sel.dispatchEvent(new Event('change'));});
 }
 }
 showToast=real;return out;
 },app);
 points.forEach(([n,c,e])=>check(app+'/'+width+': gatilho '+n+(e?' '+e:''),c));
 
 // Reusa os renderizadores reais para conferir selo no responsável e participantes.
 const badges=await p.evaluate(app=>{
   document.querySelectorAll('.ov.open').forEach(e=>e.classList.remove('open'));
   if(app==='kanban'){
     cards=[{id:'f3',title:'Campanha de teste',owner:'BO',col:columns[0]?.id||'c1',participants:['BO','PP'],history:[]}];renderBoard();renderParticipants(['BO','PP']);
     return {board:!!document.querySelector('.card[data-id="f3"] .ferias-selo'),part:document.querySelectorAll('#m-participants .ferias-selo').length===1};
   }
   okrObjetivos.f3={id:'f3',titulo:'Objetivo de teste',torre:'digital',areaId:'geral',trimestres:['T426'],responsaveis:['bia','po1'],history:[]};
   okrMarcos.f3={id:'f3',objetivoId:'f3',nome:'Marco de teste',responsavel:'bia',progresso:'nao_iniciado'};
   renderOkrObjetivos();openOkrObjetivo('f3');
   return {board:!!document.querySelector('.okr-avatar-stack .ferias-selo'),part:!!document.querySelector('.okr-marco-meta .ferias-selo')};
 },app);
 check(app+'/'+width+'/'+tema+': selos em componentes reais',badges.board&&badges.part);
 // Atribuição ao ausente continua gravando (banco fake, sem acesso ao Firebase real).
 const saved=await p.evaluate(async app=>{
   if(app==='kanban'){
     selectedCards.clear();selectedCards.add('f3');_doBulkAssign('BO');
     await new Promise(r=>setTimeout(r,300));
     const raw=window.__store.kanban.squads.dados.dados.cards;
     return Object.values(raw||{}).some(c=>c?.id==='f3'&&c.owner==='BO');
   }
   openOkrMarco(null,'f3');document.getElementById('okr-m-nome').value='Marco salvo de teste';
   const sel=document.getElementById('okr-m-resp');sel.value='bia';sel.dispatchEvent(new Event('change'));
   await saveOkrMarco();
   return Object.values(window.__store.kanban.okr.marcos||{}).some(m=>m.nome==='Marco salvo de teste'&&m.responsavel==='bia');
 },app);
 check(app+'/'+width+'/'+tema+': salva após aviso',saved);
 await p.evaluate(app=>{if(app==='okr'){document.querySelectorAll('.pc-modal-ov.open').forEach(e=>e.classList.remove('open'));Object.assign(okrObjetivos.f3,{titulo:'Objetivo de teste',torre:'digital',areaId:'geral',trimestres:['T426'],responsaveis:['bia','po1']});_okrSetView('objetivos');renderOkrObjetivos();}},app);
 await p.evaluate(pre=>window[pre+'FeriasAvisar'](['BO','PP','adm']),prefix);
 if(app==='okr') check('Radar: selo visível na captura',await p.locator('#okr-objetivos-wrap .ferias-selo').first().isVisible());
 if(cap){fs.mkdirSync(cap,{recursive:true});await p.screenshot({path:path.join(cap,app+'-'+width+'-'+tema+'.png')});}
 check(app+'/'+width+'/'+tema+': aviso cabe na tela',await p.$eval(toast,e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}));
 
 check(app+'/'+width+': sem execução XSS',await p.evaluate(()=>!window.__xss));
 await p.evaluate(fs.readFileSync(path.join(ROOT,'docs/arezzo/testes/console_ferias_aviso.js'),'utf8'));
 check(app+'/'+width+'/'+tema+': sem erro JS',errors.length===0);if(errors.length) console.log(errors);
 await ctx.close();
 }
 }finally{if(b)await b.close();srv.close();}
 process.exitCode=falhas?1:0;
})().catch(e=>{console.error(e);process.exit(1);});
