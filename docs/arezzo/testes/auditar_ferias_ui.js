// Auditoria UI/UX do modo Férias: boot real e dados sintéticos.
// AUDIT_OUT opcional; gera capturas e medidas, incluindo falhas conhecidas.
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
  const r = path.join(home, 'hering-tools/chrome'); const arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-'));
  return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
}
const ROOT = path.resolve(__dirname, '../../..');
const FIXO = '2026-11-13T15:00:00-03:00';
const FIXO_MS = new Date(FIXO).getTime();
const XSS = '<img src=x onerror=window.__xss=1>Card perigoso';

const U = {
  ana: { uid: 'ana', nome: 'Ana Teste', email: 'ana@ciahering.com.br', init: 'AT', role: 'membro', squads: { dados: true, prf: true } },
  po1: { uid: 'po1', nome: 'Paulo PO', email: 'po@ciahering.com.br', init: 'PP', role: 'po', squads: { dados: true } },
  bia: { uid: 'bia', nome: 'Bia Outra', email: 'bia@ciahering.com.br', init: 'BO', role: 'membro', squads: { dados: true } },
  al1: { uid: 'al1', nome: 'Sem Ferias', email: 'sf@ciahering.com.br', init: 'SF', role: 'membro', squads: { dados: true } },
};
const fl = col => ({ enteredAt: { [col]: '2026-11-01T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-11-01T12:00:00.000Z' }] });
const card = (id, title, col, owner, extra) => Object.assign({ id, title, col, owner, createdAt: '2026-11-01', flow: fl(col), updatedAt: '2026-11-01T12:00:00.000Z', history: [] }, extra || {});
const seed = () => ({ kanban: {
  config: { adm_emails: [] },
  squads_meta: { dados: { label: 'Squad Dados e IA', emoji: '📊', active: true }, prf: { label: 'Performance', emoji: '📱', active: true } },
  usuarios: Object.fromEntries(Object.entries(U).map(([k, u]) => [k, Object.assign({ inscrito: true }, u)])),
  usuarios_publicos: Object.fromEntries(Object.entries(U).map(([k, u]) => [k, { uid: u.uid, nome: u.nome, init: u.init, role: u.role, squads: u.squads }])),
  squads: { dados: { dados: {
    columns: [{ id: 'todo', name: 'A Fazer' }, { id: 'done', name: 'Concluído' }], tags: [],
    cards_index: { c1: 'k1', c2: 'k2', c3: 'k3', c4: 'k4', c5: 'k5', c6: 'k6' },
    cards: {
      k1: card('c1', 'Campanha de Natal', 'todo', 'AT'),
      k2: card('c2', 'Relatório semanal', 'todo', 'BO', { participants: ['AT'] }),
      k3: card('c3', 'Já concluído', 'done', 'AT'),
      k4: card('c4', 'Arquivado', 'todo', 'AT', { archived: true }),
      k5: card('c5', 'De outra pessoa', 'todo', 'BO'),
      k6: card('c6', XSS, 'todo', 'AT'),
    },
  } } },
  okr: {
    objetivos: {
      o1: { id: 'o1', titulo: 'Crescer o app', torre: 'digital', responsaveis: ['ana', 'bia'], history: [] },
      o2: { id: 'o2', titulo: 'Objetivo travado', torre: 'digital', responsaveis: ['ana'], history: [] },
      o3: { id: 'o3', titulo: 'Não é meu', torre: 'digital', responsaveis: ['bia'], history: [] },
    },
    marcos: {
      m1: { id: 'm1', nome: 'Lançar versão 2', objetivoId: 'o1', responsavel: 'ana', progresso: 'em_andamento', history: [] },
      m2: { id: 'm2', nome: 'Marco concluído', objetivoId: 'o1', responsavel: 'ana', progresso: 'concluido', history: [] },
    },
    obj_locks: { o2: { uid: 'bia', who: 'Bia Outra', ts: FIXO_MS } },
    tags: {},
  },
  ferias_dev: {
    ana: { f1: { ini: '2026-11-20', fim: '2026-11-30', em: 1, por: 'ana' } },
    po1: { f1: { ini: '2026-11-25', fim: '2026-12-02', em: 1, por: 'po1' } },
  },
} });

function startServer() {
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.mp3': 'audio/mpeg' };
  const srv = http.createServer((req, res) => {
    const fp = path.join(ROOT, decodeURIComponent((req.url || '/').split('?')[0]));
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(fp)] || 'application/octet-stream' }); fs.createReadStream(fp).pipe(res);
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok({ srv, base: 'http://127.0.0.1:' + srv.address().port })));
}


const OUT=process.env.AUDIT_OUT||path.join(require('node:os').tmpdir(),'ferias-ui-audit');fs.mkdirSync(OUT,{recursive:true});
const resumo=[];
function dados(modo,role){
 const d=seed(); d.kanban.usuarios.ana.role=role; d.kanban.usuarios_publicos.ana.role=role;
 if(modo==='vazio'){d.kanban.ferias_dev={};d.kanban.squads.dados.dados.cards={};d.kanban.okr.objetivos={};d.kanban.okr.marcos={};}
 if(modo==='muitos'){
  for(let i=0;i<54;i++){
   const uid='sintetico_'+i, sq='squad_'+i%4;
   d.kanban.squads_meta[sq]={label:'Squad sintética '+i%4,active:true};
   const u={uid,nome:'Pessoa sintética '+i+' de Sobrenome Muito Longo para Teste de Leitura',email:uid+'@ciahering.com.br',init:'Z'+i,role:'membro',squads:{dados:true,[sq]:true}};
   d.kanban.usuarios[uid]=u;d.kanban.usuarios_publicos[uid]=u;
   d.kanban.ferias_dev[uid]={f:{ini:i%2?'2026-11-20':'2026-11-10',fim:'2026-11-30',obs:i===0?'<img src=x onerror=window.__xss=1>': 'Cobertura combinada com o time — observação extensa para testar leitura no celular.'}};
   const k='ui_'+i;d.kanban.squads.dados.dados.cards[k]=card(k,'Campanha '+i+' — título muito longo com 👕 e detalhes importantes no final do texto: conferir preço e estoque','todo','AT');d.kanban.squads.dados.dados.cards_index[k]=k;
   d.kanban.okr.objetivos[k]={id:k,titulo:'Objetivo '+i+' com título longo para verificar se dá para decidir o item sem depender de title no toque',torre:'digital',responsaveis:['ana'],history:[]};
  }
 }
 return d;
}
async function medir(p,selector){return p.evaluate(sel=>{
 const root=document.querySelector(sel);if(!root)return {ausente:true};
 const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
 const controls=[...root.querySelectorAll('button,input,select,a')].filter(vis).map(e=>{const r=e.getBoundingClientRect();return {texto:(e.textContent||e.getAttribute('aria-label')||e.placeholder||e.type).trim().slice(0,75),largura:Math.round(r.width),altura:Math.round(r.height),fonte:getComputedStyle(e).fontSize,tag:e.tagName};});
 const inputs=controls.filter(x=>['INPUT','SELECT'].includes(x.tag)&&parseFloat(x.fonte)<16);
 const pequenos=controls.filter(x=>x.largura<44||x.altura<44);
 const truncados=[...root.querySelectorAll('.mfer-item-nm')].filter(e=>e.scrollWidth>e.clientWidth+1).length;
 const form=root.querySelector('.mfer-form');const fr=form?.getBoundingClientRect();
 const titulo=root.querySelector('.mfer-pass-hd')?.getBoundingClientRect();
 const rgb=c=>(c.match(/[\d.]+/g)||[]).map(Number);
 const lum=c=>{const [r,g,b]=rgb(c).slice(0,3).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};
 const contrastes=[...root.querySelectorAll('.mfer-sub,.mfer-empty,.mfer-item-dt')].filter(vis).slice(0,12).map(e=>{let bg='';for(let a=e;a;a=a.parentElement){const c=getComputedStyle(a).backgroundColor,n=rgb(c);if(n.length>=3&&(n[3]===undefined||n[3]>.6)){bg=c;break;}}return {texto:e.textContent.slice(0,70),cor:getComputedStyle(e).color,fundo:bg,razao:bg?+((Math.max(lum(getComputedStyle(e).color),lum(bg))+.05)/(Math.min(lum(getComputedStyle(e).color),lum(bg))+.05)).toFixed(2):null};});
 return {overflowPagina:document.documentElement.scrollWidth-innerWidth,overflowRoot:root.scrollWidth-root.clientWidth,formTopo:fr?Math.round(fr.top):null,formVisivel:!!fr&&fr.top<innerHeight&&fr.bottom>0,pequenos:pequenos.slice(0,12),qtdPequenos:pequenos.length,campos:inputs.slice(0,8),truncados,contrastes,foco:document.activeElement?.outerHTML.slice(0,130)};
 },selector);}
(async()=>{
 const {srv,base}=await startServer();const browser=await chromium.launch({executablePath:resolveChrome(),headless:true});
 try{
 for(const app of ['kanban','okr']) for(const width of [1280,390]) for(const modo of ['vazio','poucos','muitos']){
 const ctx=await browser.newContext({viewport:{width,height:width===390?800:900},hasTouch:width===390,isMobile:width===390});await fake.install(ctx,dados(modo,'membro'));
 const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(f=>{const R=Date,fx=new R(f).getTime();window.Date=class extends R{constructor(...a){super(...(a.length?a:[fx]));}static now(){return fx;}};localStorage.clear();},FIXO);
 await p.goto(base+'/'+app+'-dev.html?squad=dados');await p.waitForFunction(()=>!!window.__authCb);await p.evaluate(u=>window.__authCb({...u,displayName:u.nome,providerData:[{providerId:'google.com'}]}),U.ana);await p.waitForTimeout(1800);
 await p.evaluate(app=>{document.querySelectorAll('.ov.open,.pc-modal-ov.open').forEach(e=>e.classList.remove('open'));if(app==='kanban')abrirMinhasFerias();else _okrAbrirMinhasFerias();},app);
 const host=app==='kanban'?'#cal-ferias':'#okr-ferias-host';await p.waitForSelector(host+' .mfer');
 for(const tema of ['dark','light','vice']){
 await p.evaluate(t=>document.documentElement.dataset.theme=t,tema);
 await p.evaluate(sel=>{for(let e=document.querySelector(sel);e;e=e.parentElement){e.scrollTop=0;}window.scrollTo(0,0);},host);
 const id=app+'-'+width+'-'+modo+'-'+tema;
 const inicial=await medir(p,host);await p.screenshot({path:path.join(OUT,id+'-agenda.png')});
 await p.locator(host+' .mfer-form').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(OUT,id+'-cadastro.png')});
 const controles=await medir(p,host);
 // Rascunho + atualização de filtro: dado digitado é preservado? O foco permanece no filtro após mudar?
 await p.locator(host+' [data-f="obs"]').fill('Rascunho de auditoria');await p.locator(host+' [data-filtro="periodo"]').focus();await p.locator(host+' [data-filtro="periodo"]').selectOption('agora');
 const rascunho=await p.locator(host+' [data-f="obs"]').inputValue();const focoFiltro=await p.evaluate(()=>document.activeElement?.dataset.filtro==='periodo');
 await p.locator(host+' [data-filtro="periodo"]').selectOption('todos');
 let passagem=null;
 if(modo!=='vazio'){
 await p.locator(host+' [data-act="saida"]').click();await p.waitForSelector('#mfer-pass-ov');
 passagem=await medir(p,'#mfer-pass-ov');await p.screenshot({path:path.join(OUT,id+'-saida.png')});
 await p.locator('#mfer-pass-ov [data-pa="passar"]').first().click();await p.screenshot({path:path.join(OUT,id+'-pessoa.png')});
 passagem.overflowAposPassar=await p.evaluate(()=>document.querySelector('.mfer-pass').scrollWidth-document.querySelector('.mfer-pass').clientWidth);
 // Tab a partir do último controle deve continuar dentro do diálogo modal.
 await p.locator('#mfer-pass-ov button:not([disabled]),#mfer-pass-ov select').last().focus();await p.keyboard.press('Tab');passagem.focoContido=await p.evaluate(()=>!!document.activeElement.closest('#mfer-pass-ov'));
 await p.keyboard.press('Escape');
 }
 await p.evaluate(fs.readFileSync(path.join(ROOT,'docs/arezzo/testes/console_ferias_ui.js'),'utf8'));
 const item={app,width,modo,tema,inicial,controles,rascunhoPreservado:rascunho==='Rascunho de auditoria',focoFiltro,passagem,errors:[...errors],xss:await p.evaluate(()=>!!window.__xss)};resumo.push(item);console.log(JSON.stringify({id,formTopo:inicial.formTopo,pequenos:controles.qtdPequenos,campos:controles.campos.length,overflow:inicial.overflowPagina,passagemOverflow:passagem?.overflowRoot,truncados:passagem?.truncados,focoContido:passagem?.focoContido,errors}));
 }
 await ctx.close();
 }
 // iPad/toque: largura não substitui a capacidade de toque.
 const ctx=await browser.newContext({viewport:{width:834,height:1112},hasTouch:true,isMobile:true});await fake.install(ctx,dados('poucos','adm'));const p=await ctx.newPage();await p.goto(base+'/kanban-dev.html?squad=dados');await p.waitForFunction(()=>!!window.__authCb);await p.evaluate(u=>window.__authCb({...u,displayName:u.nome,providerData:[{providerId:'google.com'}]}),U.ana);await p.waitForTimeout(1800);await p.evaluate(()=>{document.querySelectorAll('.ov.open').forEach(e=>e.classList.remove('open'));abrirMinhasFerias();});await p.waitForSelector('#cal-ferias .mfer');resumo.push({app:'kanban',width:834,role:'adm',controles:await medir(p,'#cal-ferias')});await p.screenshot({path:path.join(OUT,'tablet-adm.png')});await ctx.close();
 }finally{fs.writeFileSync(path.join(OUT,'metricas.json'),JSON.stringify(resumo,null,2));await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
