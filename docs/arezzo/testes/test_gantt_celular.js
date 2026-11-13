// Diagnóstico read-only de console (ADM, Gantt aberto no celular):
// console.table([...document.querySelectorAll('.gantt-bar,.mgc-bar')].map(e=>({alvo:e.getBoundingClientRect().width>=44&&e.getBoundingClientRect().height>=44?'✅':'❌',texto:e.dataset.tip||e.title||e.textContent})));
const fs = require('node:fs'); const path = require('node:path'); const home = require('node:os').homedir();
const pwPath = process.env.PLAYWRIGHT_MODULE || (fs.existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const { chromium } = require(pwPath); const fake = require('./fakefb');
function resolveChrome() { if (process.env.CHROME) return process.env.CHROME; if (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) return '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const r = path.join(home, 'hering-tools/chrome'); const arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-')); return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'); }
const base = process.env.BASE_URL || 'http://127.0.0.1:8949'; const K = process.env.K || 'kanban-dev'; const SUF = K.endsWith('-dev') ? '_dev' : '';
const SQ = 'site'; const capUnused = process.env.CAPTURE_DIR || ''; const FIXO = '2026-11-12T13:00:00';   // janela 01/11 – 12/12; hoje = coluna 12
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



const phase=process.env.PHASE||'depois';const baseline=phase==='antes';
const capt=path.join(__dirname,'../../capturas/gantt_celular',phase);fs.mkdirSync(capt,{recursive:true});
(async()=>{
const b=await chromium.launch({executablePath:resolveChrome(),headless:true});let fails=0;const rows=[];
const t=(n,c,d)=>{if(!c)fails++;console.log((c?'✅ ':'❌ ')+n+(c?'':' '+JSON.stringify(d??null)));};
for(const app of ['mare','radar'])for(const width of (process.env.WIDTH?[Number(process.env.WIDTH)]:[1280,390]))for(const theme of (process.env.THEME?[process.env.THEME]:['dark','light','vice'])){
 const ctx=await b.newContext({viewport:{width,height:width===390?800:900},hasTouch:width===390,isMobile:width===390});const data=seedBase();
 const texto='Campanha de verão: lançamento da coleção com benefícios exclusivos no site, app e CRM — condições completas e duração de apenas um dia 🛍️';
 const linhas={web:{rot:'Web · Campanhas e lançamentos',ordem:1}};const barras={curta:{linha:'web',ini:'2026-11-12',fim:'2026-11-12',txt:texto},longa:{linha:'web',ini:'2026-10-01',fim:'2026-12-30',txt:'Campanha atravessa a janela inteira — '+texto}};
 for(const cal of ['marca','comercial','mktplace','outlet']) data.kanban.calendarios_gantt_dev[cal]={meta,linhas,barras};
 for(let i=0;i<50;i++)data.kanban.calendarios_gantt_dev.mktplace.barras['extra'+i]={linha:'web',ini:'2026-11-12',fim:'2026-11-12',txt:'Ação simultânea '+i+' — '+texto};
 data.kanban.squads.site.dados.cards.k1.title=texto;data.kanban.squads.site.dados.cards.k1.inicio='2026-11-12';data.kanban.squads.site.dados.cards.k1.fim='2026-11-12';
 data.kanban.squads.site.dados.cards.k2={id:'soprazo',title:'SÓ PRAZO NÃO ENTRA',col:'doing',owner:'MM',due:'2026-11-12'};data.kanban.squads.site.dados.cards_index.soprazo='k2';
 data.kanban.okr={objetivos:{},marcos:{},tags:{}};
 await fake.install(ctx,data);
 if(process.env.MAIN_BASELINE) for(const f of ['kanban-dev.html','okr-dev.html','mare-gcal-dev.js']) await ctx.route('**/'+f+'*',r=>r.fulfill({contentType:f.endsWith('.js')?'text/javascript':'text/html',body:require('node:child_process').execFileSync('git',['show',(process.env.BASELINE_REF||'6b01b323')+':'+f],{cwd:path.join(__dirname,'../../..')})}));
 const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(f=>{const R=Date;class D extends R{constructor(...a){super(...(a.length?a:[f]));}static now(){return new R(f).getTime();}}window.Date=D;let seed=12345;Math.random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);localStorage.clear();},FIXO);
 await p.goto(base+'/'+(app==='mare'?'kanban-dev.html?squad=site':'okr-dev.html'));
 await p.waitForFunction(()=>!!window.__authCb);await p.evaluate(()=>window.__authCb({uid:'mem',email:'mem@ciahering.com.br',displayName:'Pessoa Teste',providerData:[{providerId:'google.com'}]}));await p.waitForTimeout(2400);
 await p.evaluate(([a,th])=>{document.documentElement.dataset.theme=th==='dark'?'':th;document.querySelectorAll('.ov.open').forEach(x=>x.classList.remove('open'));if(a==='mare')toggleGanttView();else{_okrSetView('calendario');_okrCalSetVista('gantt');}},[app,theme]);
 await p.waitForSelector(app==='mare'?'.gantt-scroll':'.mgc-scroll');
 await p.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}.version{visibility:hidden!important}'});
 if(width===390)t('Hoje à vista horizontal ao abrir',await p.evaluate(a=>{const sc=document.querySelector(a==='mare'?'.gantt-scroll':'.mgc-scroll'),d=sc.querySelector(a==='mare'?'.gantt-day-hd.is-today':'.mgc-dhd.is-hoje'),c=sc.querySelector(a==='mare'?'.gantt-ruler-corner':'.mgc-sticky');const r=d.getBoundingClientRect(),s=sc.getBoundingClientRect(),w=c.getBoundingClientRect().width;return r.left>=s.left+w-2&&r.right<=s.right+2;},app));
 const abas=app==='mare'?['cards','marca','comercial','mktplace','outlet','digital']:['marca','comercial','mktplace','outlet','digital'];
 for(const aba of abas){
  await p.evaluate(([a,id])=>{if(a==='mare')ganttAba(id);else _okrGcal.aba(id);},[app,aba]);await p.waitForTimeout(180);
  if(aba==='cards')t('Cards sem período não entram',await p.locator('.gantt-row[data-id="soprazo"]').count()===0);
  const prefix=app==='mare'?'gantt':'mgc';const bar=p.locator(app==='mare'?'.gantt-bar':'.mgc-bar');
  const m=await bar.evaluateAll(es=>es.map(e=>{const t=e.querySelector('.gantt-bar-txt,.mgc-txt')||e;const r=e.getBoundingClientRect();return{w:r.width,h:r.height,corta:t.scrollWidth>t.clientWidth};}));
  rows.push({app,width,theme,aba,barras:m.length,cortadas:m.filter(x=>x.corta).length,menorAlvo:Math.min(...m.map(x=>x.h))});
  t(`${app}/${aba}/${width}/${theme} sem overflow da página`,await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
  if(width===390){
   if(baseline) await p.screenshot({path:path.join(capt,`${app}_${aba}_${width}_${theme}.png`)});
   const e=bar.first();await e.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest'}));await e.click();await p.waitForTimeout(120);
   t(`${app}/${aba}/${theme} texto completo a um toque`,await p.locator('.mgc-leitura').count()===1&&await p.locator('.mgc-leitura').innerText().then(s=>s.includes('Campanha')||s.includes('Ação')));
   if(!baseline&&await p.locator('.mgc-leitura').count()){
    const leitura=await p.locator('.mgc-leitura p').innerText();await p.evaluate(a=>a==='mare'?renderBoard():renderOkrCalendario(),app);t('Redesenhar sem trocar aba preserva leitura',await p.locator('.mgc-leitura p').innerText()===leitura);
    t('Alvos das barras e botões ≥44px',m.every(x=>x.h>=44&&x.w>=44)&&await p.locator('.mgc-leitura button').evaluateAll(es=>es.every(e=>e.getBoundingClientRect().height>=44&&e.getBoundingClientRect().width>=44)));
    const cr=await p.locator('.mgc-leitura').evaluate(el=>{
     const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number);const bg=rgb(getComputedStyle(el).backgroundColor),fg=rgb(getComputedStyle(el.querySelector('p')).color);const c=fg.slice(0,3).map((v,i)=>v*(fg[3]??1)+bg[i]*(1-(fg[3]??1)));const lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);return(Math.max(lum(bg),lum(c))+.05)/(Math.min(lum(bg),lum(c))+.05);
    });rows[rows.length-1].contraste=cr;t('Contraste do texto completo ≥4.5:1',cr>=4.5,cr);
   }
   if(!baseline) await p.screenshot({path:path.join(capt,`${app}_${aba}_${width}_${theme}.png`)});
   await p.evaluate(()=>{document.querySelector('.mgc-leitura button[data-fechar]')?.click();document.querySelectorAll('.ov.open').forEach(x=>x.classList.remove('open'));});
   if(!baseline){
    const curta=p.locator(app==='mare'?(aba==='cards'?'.gantt-bar':'.gantt-cal-bar[data-id="curta"]'):'.mgc-bar[data-id="curta"]').first();
    await curta.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest'}));await curta.click();
    t('Barra de um dia responde a toque real',await p.locator('.mgc-leitura p').innerText().then(x=>x.includes('Campanha de verão')));
    if(aba==='marca')await p.screenshot({path:path.join(capt,`${app}_um_dia_390_${theme}.png`)});
    if(app==='mare'&&aba==='cards'){
     await p.getByRole('button',{name:'Abrir card',exact:true}).click();await p.waitForFunction(()=>document.getElementById('card-ov').classList.contains('open'));
     t('Abrir card preserva ação original',await p.locator('#m-title').inputValue()===texto);await p.evaluate(()=>closeOv('card-ov'));
    }
    await p.evaluate(()=>document.querySelector('.mgc-leitura button[data-fechar]')?.click());
    t('Cada barra tem o texto integral no leitor',await p.evaluate(a=>{
      const es=[...document.querySelectorAll(a==='mare'?'.gantt-bar':'.mgc-bar')];
      return es.every(el=>{el.click();const p=document.querySelector('.mgc-leitura p');const ok=!!p&&p.textContent===(el.dataset.tip||el.dataset.tipTitle||el.getAttribute('title')||el.textContent);document.querySelector('.mgc-leitura button[data-fechar]')?.click();return ok;});
    },app));
    if(aba==='digital'){
     await p.evaluate(a=>{if(a==='mare')ganttDia('2026-11-12');else document.querySelector('.mgc-dhd[data-dia="2026-11-12"]').click();},app);
     await bar.first().evaluate(el=>el.click());await p.keyboard.press('Escape');
     t('Esc fecha leitor primeiro e mantém dia',await p.locator('.mgc-leitura').count()===0&&await p.locator(app==='mare'?'#gantt-dia':'.mgc-dia').count()===1);
     await p.keyboard.press('Escape');
    }
   }

  }else if(aba==='marca'||aba==='cards') await p.screenshot({path:path.join(capt,`${app}_${aba}_${width}_${theme}.png`)});
 }
 if(width===390 && !baseline){
  const sc=app==='mare'?'.gantt-scroll':'.mgc-scroll';
  await p.evaluate(a=>{if(a==='mare')ganttNav(0);else document.querySelector('.mgc-btn[data-nav="0"]').click();},app);
  t('Hoje pertence à janela ao retornar',await p.locator(app==='mare'?'.gantt-day-hd.is-today':'.mgc-dhd.is-hoje').count()===1);
  await p.locator(app==='mare'?'.gantt-fmes':'.mgc-mes').selectOption('2026-03');
  t('Mês mantém primeiro de março na régua',await p.locator(app==='mare'?'.gantt-day-hd[data-date="2026-03-01"]':'.mgc-dhd[data-date="2026-03-01"]').count()===1);
  await p.evaluate(a=>{if(a==='mare'){ganttNav(28);ganttNav(-28);ganttNav(0);const f=document.getElementById('gantt-filtros');f.querySelector('[data-p="de"]').value='2026-11-12';f.querySelector('[data-p="ate"]').value='2026-11-12';ganttPeriodo();}else{document.querySelector('.mgc-btn[data-nav="28"]').click();document.querySelector('.mgc-btn[data-nav="-28"]').click();document.querySelector('.mgc-btn[data-nav="0"]').click();}},app);
  if(app==='mare')t('De/Até preservados',await p.locator('#gantt-footer').innerText().then(x=>x.includes('📅 Período')));
  if(theme==='dark'){
   await p.evaluate(async a=>{await window._set(window._ref(window._db,'kanban/calendarios_gantt_dev/marca'),{meta:{},linhas:{},barras:{}});if(a==='mare')ganttAba('marca');else _okrGcal.aba('marca');},app);
   await p.waitForTimeout(100);t('Estado vazio sem leitor obsoleto',await p.locator(app==='mare'?'.gantt-cal-bar':'.mgc-bar').count()===0&&await p.locator('.mgc-leitura').count()===0);
  }
 }
 t(`${app}/${width}/${theme} sem erros JS`,!errs.length,errs);await ctx.close();
}
await b.close();fs.writeFileSync(path.join(capt,process.env.WIDTH?'medicoes_'+process.env.WIDTH+'.json':'medicoes.json'),JSON.stringify(rows,null,2));console.log(fails+' falha(s)');process.exit(fails?1:0);
})();
