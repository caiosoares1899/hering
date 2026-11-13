// ADM: com o Gantt dev aberto, este diagnóstico de console é read-only:
// (()=>{const b=document.querySelector('.gantt-fav,.mgc-fav');console.log(b && ['true','false'].includes(b.getAttribute('aria-pressed')) ? '✅ Controle de favorita disponível' : '❌ Abra o Gantt com Google Hering');})();
// 📊 Gantt — rodada /melhoriauiux de 13/11/2026: rótulo "Hoje" na linha 📌 Datas-chave, rótulo de data de 1 dia CENTRADO na linha
// (estava "torto"), destaque do ADM nas barras dos calendários (cor + ⚠️, vale para todas as squads), filtro "mostrar só" por grupo
// de linhas e o novo nome "Site e App". Servir a raiz em BASE_URL; node docs/arezzo/testes/test_gantt_ui.js (CAPTURE_DIR grava capturas)
const fs = require('node:fs'); const path = require('node:path'); const home = require('node:os').homedir();
const pwPath = process.env.PLAYWRIGHT_MODULE || (fs.existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const { chromium } = require(pwPath); const fake = require('./fakefb');
function resolveChrome() { if (process.env.CHROME) return process.env.CHROME; if (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) return '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const r = path.join(home, 'hering-tools/chrome'); const arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-')); return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'); }
const base = process.env.BASE_URL || 'http://127.0.0.1:8949'; const K = process.env.K || 'kanban-dev'; const SUF = K.endsWith('-dev') ? '_dev' : '';
const SQ = 'site'; const cap = process.env.CAPTURE_DIR || ''; const FIXO = '2026-11-12T13:00:00';   // janela 01/11 – 12/12; hoje = coluna 12
const fl = col => ({ enteredAt: { [col]: '2026-10-20T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-10-20T12:00:00.000Z' }] });
const USERS = {
  mem: { uid: 'mem', nome: 'Mel Membro', email: 'mem@ciahering.com.br', init: 'MM', role: 'membro', squads: { [SQ]: true }, squads_roles: { [SQ]: 'membro' } },
  adm: { uid: 'adm', nome: 'Ana ADM', email: 'adm@ciahering.com.br', init: 'AA', role: 'adm', squads: { [SQ]: true } },
};
const meta = { atualizadoEm: 1, porNome: 'Caio', arquivo: 'x.xlsx', de: '2026-01-01', ate: '2026-12-31' };
const seedBase = () => ({ kanban: {
  config: { adm_emails: ['adm@ciahering.com.br'] },
  usuarios: Object.fromEntries(Object.entries(USERS).map(([k, u]) => [k, Object.assign({ inscrito: true }, u)])),
  usuarios_publicos: Object.fromEntries(Object.entries(USERS).map(([k, u]) => [k, { uid: u.uid, nome: u.nome, init: u.init, squads: u.squads }])),
  squads: { [SQ]: { dados: { columns: [{ id: 'doing', name: 'Fazendo' }], tags: [], cards_index: { c1: 'k1' },
      cards: { k1: { id: 'c1', title: 'Card', col: 'doing', owner: 'MM', createdAt: '2026-10-20', flow: fl('doing'), inicio: '2026-11-20', fim: '2026-11-30', updatedAt: '2026-10-27T10:00:00.000Z' } } },
    ['gantt_marcos' + SUF]: { m1: { titulo: 'Black Friday', ini: '2026-11-27', fim: '2026-11-27', cor: 'purple', porUid: 'adm', em: 1 }, m2: { titulo: 'Semana do Cliente', ini: '2026-11-16', fim: '2026-11-20', cor: 'green', porUid: 'adm', em: 1 } } } },
  ['calendarios_gantt' + SUF]: {
    comercial: { meta, linhas: { lancamentos: { rot: 'Lançamentos e datas', ordem: 0 }, site: { rot: 'Site todo (não remarcados)', ordem: 1 }, saldos: { rot: 'Site · Saldos', ordem: 2 }, crm: { rot: 'CRM', ordem: 6 }, app: { rot: 'Ação App', ordem: 7 } },
      barras: { b_a1: { linha: 'site', ini: '2026-11-09', fim: '2026-11-14', txt: 'AÇÃO SITE TESTE' }, b_a2: { linha: 'saldos', ini: '2026-11-10', fim: '2026-11-13', txt: 'OFERTA FICTÍCIA' },
        b_a3: { linha: 'crm', ini: '2026-11-11', fim: '2026-11-12', txt: 'CRM TESTE' }, b_a4: { linha: 'app', ini: '2026-11-12', fim: '2026-11-12', txt: 'APP TESTE' }, b_a5: { linha: 'lancamentos', ini: '2026-11-15', fim: '2026-11-15', txt: 'FERIADO' } } },
    marca: { meta, linhas: { web: { rot: 'Web', ordem: 1 }, redes: { rot: 'Redes sociais', ordem: 2 } },
      barras: { b_w1: { linha: 'web', ini: '2026-10-31', fim: '2026-11-30', txt: 'BLACK FRIDAY' }, b_r1: { linha: 'redes', ini: '2026-11-10', fim: '2026-11-17', txt: 'CAMPANHA TESTE' } } } },
  ['gantt_destaques' + SUF]: { comercial: { b_a2: { cor: 'red', alerta: true, porNome: 'Ana ADM', em: 1 }, b_a5: { cor: 'blue', alerta: false, porNome: 'Ana ADM', em: 1 } } },
} });


// Prova da fronteira aceita: autora e PO/ADM gravam; outro membro comum não.
const assert=require('node:assert/strict');
const {check,validate}=require('../../../functions/rules/rulesSim');
const rules=JSON.parse(fs.readFileSync(path.join(__dirname,'../../../database.rules.json')));
const db={kanban:{usuarios:{mem:{role:'membro'},outro:{role:'membro'},po:{role:'po'},adm:{role:'adm'}}}};
for(const uid of ['mem','outro','po','adm']) for(const v of ['outlet',null]) {
  const auth={uid,token:{email:uid+'@ciahering.com.br',firebase:{sign_in_provider:'google.com'}}};
  const p='kanban/usuarios/mem/gantt_favorita';
  assert.equal(check(rules,db,'write',p,auth,v)&&validate(rules,db,p,auth,v),uid!=='outro');
}
console.log('✅ rulesSim: autora permite; outro membro nega; PO/ADM permitem (exceção aceita), salvar e remover');
(async()=>{
 const b=await chromium.launch({executablePath:resolveChrome(),headless:true});let ok=true;
 const t=(n,c,d)=>{if(!c)ok=false;console.log((c?'✅ ':'❌ ')+n+(c?'':' '+JSON.stringify(d??null)));};
 const abrir=async(app,fav,opts={})=>{
  const ctx=await b.newContext({viewport:{width:opts.mobile?390:1280,height:900},hasTouch:!!opts.mobile,isMobile:!!opts.mobile});
  const data=seedBase();data.kanban.usuarios.mem.gantt_favorita=fav;data.kanban.okr={objetivos:{},marcos:{},tags:{}};
  await fake.install(ctx,data);const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(([fix,last,delay])=>{ const R=Date;class D extends R{constructor(...a){super(...(a.length?a:[fix]));}static now(){return new R(fix).getTime();}}window.Date=D;
    localStorage.clear();localStorage.setItem('mare_gantt_aba',last);localStorage.setItem('okr_gcal_aba',last);
    window.__onValueDelay=path=>path.endsWith('/gantt_favorita')?delay:0;
  },[FIXO,opts.last||'marca',opts.delay||0]);
  await p.goto(base+'/'+(app==='mare'?'kanban-dev':'okr-dev')+'.html'+(app==='mare'?'?squad=site':'')+(opts.link?(app==='mare'?'&':'?')+'gantt='+opts.link:''));
  await p.waitForFunction(()=>!!window.__authCb);
  await p.evaluate(ex=>window.__authCb({uid:'mem',email:ex?'membro@externo.example':'mem@ciahering.com.br',displayName:'Pessoa Teste',providerData:[{providerId:ex?'microsoft.com':'google.com'}]}),!!opts.external);
  await p.waitForTimeout(2300);
  if(!opts.link) await p.evaluate(a=>{document.querySelectorAll('.ov.open').forEach(x=>x.classList.remove('open'));if(a==='mare')toggleGanttView();else{_okrSetView('calendario');_okrCalSetVista('gantt');}},app);
  await p.waitForSelector(app==='mare'?'.gantt-scroll':'.mgc-scroll');await p.waitForTimeout(100);
  return {ctx,p,errs,app};
 };
 const aba=s=>s.p.evaluate(a=>a==='mare'?_ganttAba:_okrGcal._estado.aba,s.app);
 const troca=(s,id)=>s.p.evaluate(([a,id])=>a==='mare'?ganttAba(id):document.querySelector('.mgc-aba[data-aba="'+id+'"]').click(),[s.app,id]);
 const btn=s=>s.p.locator(s.app==='mare'?'.gantt-fav':'.mgc-fav');
 const fechar=async s=>{t(s.app+' sem erro JS',!s.errs.length,s.errs);await s.ctx.close();};
 let s=await abrir('mare',null);await troca(s,'outlet');await btn(s).click();
 await s.p.waitForFunction(()=>window.__store.kanban.usuarios.mem.gantt_favorita==='outlet');
 t('Maré salva Outlet na conta',await btn(s).getAttribute('aria-pressed')==='true');await fechar(s);
 s=await abrir('mare','outlet',{last:'marca'});t('Outro aparelho: favorita ganha do local',await aba(s)==='outlet');await fechar(s);
 s=await abrir('mare','outlet',{link:'marca'});t('Link direto ganha da favorita',await aba(s)==='marca');await s.p.evaluate(()=>{toggleGanttView();toggleGanttView();});t('Nova abertura após link aplica favorita',await aba(s)==='outlet');await fechar(s);
 s=await abrir('mare','outlet');await btn(s).click();await s.p.waitForFunction(()=>!window.__store.kanban.usuarios.mem.gantt_favorita);await troca(s,'comercial');await fechar(s);
 s=await abrir('mare',null,{last:'comercial'});t('Sem favorita usa última aba',await aba(s)==='comercial');await fechar(s);
 for(const app of ['mare','radar']) {
  s=await abrir(app,'comercial',{last:'outlet'});t(app+' lê o mesmo campo compartilhado',await aba(s)==='comercial');
  await troca(s,'marca');await btn(s).click();await s.p.waitForFunction(()=>window.__store.kanban.usuarios.mem.gantt_favorita==='marca');
  t(app+' grava mesma preferência de conta',await btn(s).getAttribute('aria-pressed')==='true');
  await s.p.evaluate(()=>{window.__setDelay=p=>p.endsWith('/gantt_favorita')?300:0;});
  const antes=await s.p.evaluate(()=>window.__log.filter(x=>x[0]==='set'&&x[1].endsWith('/gantt_favorita')).length);
  await btn(s).evaluate(e=>{e.click();e.click();});await s.p.waitForTimeout(450);
  t(app+' clique duplicado faz só uma gravação e remove com null',await s.p.evaluate(n=>window.__log.filter(x=>x[0]==='set'&&x[1].endsWith('/gantt_favorita')).length===n+1&&!window.__store.kanban.usuarios.mem.gantt_favorita,antes));
  await s.p.evaluate(()=>{window.__denySet=p=>p.endsWith('/gantt_favorita');});await btn(s).click();await s.p.waitForTimeout(450);
  t(app+' gravação negada não confirma favorita',await btn(s).getAttribute('aria-pressed')==='false');await fechar(s);
  s=await abrir(app,'outlet',{delay:1000,last:'marca'});await troca(s,'comercial');await s.p.waitForTimeout(1150);t(app+' resposta atrasada não desfaz escolha',await aba(s)==='comercial');await fechar(s);
  s=await abrir(app,'outlet',{delay:600,last:'marca'});await s.p.waitForTimeout(750);t(app+' resposta atrasada aplica se não houve interação',await aba(s)==='outlet');await fechar(s);
  for(const lixo of ['<img>','xpto']){s=await abrir(app,lixo,{last:'marca'});t(app+' ignora valor inválido '+lixo,await aba(s)==='marca');await fechar(s);}
  s=await abrir(app,'outlet',{mobile:true});
  for(const tema of ['','light','vice']){await s.p.evaluate(x=>document.documentElement.dataset.theme=x,tema);t(app+' 390 '+tema+' sem overflow e alvo 44px',await s.p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)&&await btn(s).evaluate(e=>e.getBoundingClientRect().height>=44));}
  await fechar(s);
 }
 s=await abrir('radar','cards',{last:'outlet'});t('Radar ignora cards e mantém local',await aba(s)==='outlet');await fechar(s);
 s=await abrir('radar','outlet',{link:'marca'});t('Radar link ganha da favorita',await aba(s)==='marca');await s.p.evaluate(()=>{_okrCalSetVista('mes');_okrCalSetVista('gantt');});t('Radar nova abertura após link aplica favorita',await aba(s)==='outlet');await fechar(s);
 // A permissão do externo é exercitada também nas suítes de calendários/pedido.
 s=await abrir('mare','outlet');await s.p.evaluate(()=>{window._currentUser={uid:'ext',email:'ext@externo.example',providerData:[{providerId:'microsoft.com'}]};renderBoard();});
 t('Externo fica em Cards e sem estrela',await aba(s)==='cards'&&await btn(s).count()===0);await fechar(s);
 await b.close();console.log(ok?'TUDO OK':'FALHOU');process.exit(ok?0:1);
})();
