// 📅 Período padronizado do Objetivo (okr-dev): seletor T/S/A, Salvar barra fora do padrão, perene isento, filtro cruza períodos.
// Rodar: python3 -m http.server 8948 (na raiz) e `node docs/arezzo/testes/test_okr_periodo.js`. BASE_URL troca o servidor.
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const chromeRoot = path.join(home, 'hering-tools/chrome');
const chrome = process.env.CHROME || path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n=>n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8948';
const out = process.env.OUT || path.join(__dirname, '../../capturas/okr-periodo');
const U = {uid:'ana',email:'ana@ciahering.com.br',displayName:'Ana ADM',photoURL:'',providerData:[{providerId:'google.com'}]};
const mk = (id,t,o)=>({id,titulo:t,areaId:'geral',torre:'digital',responsaveis:['ana'],tagIds:[],history:[],ordem:0,indicadores:[],progressoPct:0,criadoEm:'2026-08-01T12:00:00.000Z',...o});
const ano = new Date().getFullYear(), aa = String(ano).slice(2), prox = String(ano+1).slice(2);
const seed = ()=>({kanban:{okr:{objetivos:{
  novo:mk('novo','Já no padrão',{trimestres:['T4'+aa]}),
  velho:mk('velho','Rótulo antigo',{trimestres:['4T-2026','1S-2027']}),
  semano:mk('semano','Sem ano',{trimestres:['4T']}),
  vazio:mk('vazio','Sem período',{trimestres:[]}),
  livre:mk('livre','Texto que não converte',{trimestres:['Black Friday']}),
  perene:mk('perene','Perene sem período',{trimestres:[],atingimento:{tipo:'perene'}}),
  ano:mk('ano','Ano todo',{trimestres:['A'+aa]}),
  arq:mk('arq','Arquivado',{trimestres:['3T'],arquivado:true}),
 }, marcos:{}, tags:{}},
 usuarios:{ana:{uid:'ana',nome:'Ana ADM',email:U.email,inscrito:true}}, config:{adm_emails:[U.email]}}});

(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const b = await chromium.launch({executablePath:chrome}); let ok = true;
  const t = (n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,400))); };
  const open = async(vp,theme)=>{ const ctx = await b.newContext({viewport:vp||{width:1280,height:800}}); await fake.install(ctx,seed()); const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(base+'/okr-dev.html?torre=digital'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U); await p.waitForTimeout(1500);
    if(theme) await p.evaluate(th=>document.documentElement.setAttribute('data-theme',th),theme); return {ctx,p,errs}; };
  const banco = (p,id)=>p.evaluate(async id=>(await window._get(window._ref(window._db,'kanban/okr/objetivos/'+id))).val(),id);

  { const {ctx,p,errs} = await open();
    // funções puras
    const f = await p.evaluate(()=>({
      sug:['4T-2026','4T','3T-2026','2T-2026','2026-Q4','1T27','1S-2027','T126','Black Friday','5T','3S27',''].map(x=>[x,_okrPeriodoSugestao(x,2026)]),
      dat:['T126','T426','S226','A27','X'].map(x=>[x,_okrPeriodoDatas(x)]),
      nome:_okrPeriodoNome('S227'),
      sob:[_okrPeriodoSobrepoe('T426','S226'),_okrPeriodoSobrepoe('T126','S226'),_okrPeriodoSobrepoe('A26','T326')],
      pend:{novo:_okrPeriodoPendente(okrObjetivos.novo), vazio:!!_okrPeriodoPendente(okrObjetivos.vazio), velho:!!_okrPeriodoPendente(okrObjetivos.velho), perene:_okrPeriodoPendente(okrObjetivos.perene), arq:_okrPeriodoPendente(okrObjetivos.arq)},
    }));
    const S = Object.fromEntries(f.sug);
    t('sugestão converte os rótulos reais do banco', S['4T-2026']==='T426' && S['4T']==='T426' && S['3T-2026']==='T326' && S['2T-2026']==='T226' && S['2026-Q4']==='T426' && S['1T27']==='T127' && S['1S-2027']==='S127' && S['T126']==='T126', S);
    t('o que não é período não converte (nunca chuta)', S['Black Friday']===null && S['5T']===null && S['3S27']===null && S['']===null, S);
    const D = Object.fromEntries(f.dat);
    t('datas: T126, T426, S226, A27', D.T126.ini==='2026-01-01' && D.T126.fim==='2026-03-31' && D.T426.fim==='2026-12-31' && D.S226.ini==='2026-07-01' && D.A27.ini==='2027-01-01' && D.A27.fim==='2027-12-31' && D.X===null, D);
    t('nome legível', f.nome==='2º semestre de 2027', f.nome);
    t('sobreposição: T426∩S226 sim, T126∩S226 não, A26∩T326 sim', f.sob[0]===true && f.sob[1]===false && f.sob[2]===true, f.sob);
    t('pendência: padrão ok, vazio e antigo barram, perene e arquivado isentos', f.pend.novo===null && f.pend.vazio && f.pend.velho && f.pend.perene===null && f.pend.arq===null, f.pend);

    // filtro
    const filtra = sel => p.evaluate(sel=>{ _okrFilter.trimestre = sel; renderOkrObjetivos(); return [...document.querySelectorAll('#okr-objetivos-wrap .okr-card-title')].map(e=>e.textContent).sort(); }, sel);
    const f4 = await filtra('T4'+aa);
    t('filtro T4'+aa+': padrão, antigo convertido, sem ano, ano todo e perene (período atual)', ['Já no padrão','Rótulo antigo','Sem ano','Ano todo','Perene sem período'].every(x=>f4.includes(x)) && !f4.includes('Sem período') && !f4.includes('Texto que não converte'), f4);
    const fs2 = await filtra('S2'+aa);
    t('filtro S2'+aa+' inclui quem tem T4'+aa+' e A'+aa, fs2.includes('Já no padrão') && fs2.includes('Ano todo'), fs2);
    const f127 = await filtra('T1'+prox);
    t('filtro T1'+prox+': só o S1'+prox+' antigo; perene fica fora (não é o período atual)', f127.length===1 && f127[0]==='Rótulo antigo', f127);
    const opts = await p.evaluate(()=>{ _okrFilter.trimestre=''; renderOkrObjetivos(); return [...document.querySelectorAll('#okr-filter-trimestre option')].map(o=>o.value); });
    t('opções do filtro já no padrão (sem "4T-2026"); texto livre continua listado', opts.includes('T4'+aa) && opts.includes('S1'+prox) && !opts.includes('4T-2026') && opts.includes('Black Friday'), opts);

    // seletor e Salvar
    await p.evaluate(()=>{ openOkrObjetivo('vazio'); openOkrConfig(); }); await p.waitForTimeout(300);
    const btns = await p.$$eval('#okr-sec-obj-trimestres .okr-per-btn', bs=>bs.map(b=>b.textContent.trim()));
    t('seletor mostra T1..T4, S1, S2 e A do ano corrente e do próximo', btns.length===14 && btns.includes('T1'+aa) && btns.includes('A'+prox), btns);
    await p.evaluate(()=>saveOkrObjetivo()); await p.waitForTimeout(400);
    t('Salvar sem período é barrado (nada gravado)', ((await banco(p,'vazio')).trimestres||[]).length===0, await banco(p,'vazio'));
    const foco = await p.evaluate(()=>document.activeElement && document.activeElement.closest('#okr-sec-obj-trimestres') ? document.activeElement.textContent.trim() : null);
    t('o foco vai para o seletor de período', !!foco, foco);
    await p.click(`#okr-sec-obj-trimestres .okr-per-btn:text-is("T4${aa}")`); await p.waitForTimeout(100);
    const pressed = await p.$eval(`#okr-sec-obj-trimestres .okr-per-btn.on`, b=>b.getAttribute('aria-pressed'));
    t('clicar marca o botão (aria-pressed=true)', pressed==='true', pressed);
    await p.evaluate(()=>saveOkrObjetivo()); await p.waitForTimeout(500);
    t('com período escolhido, salva', JSON.stringify((await banco(p,'vazio')).trimestres)===JSON.stringify(['T4'+aa]), await banco(p,'vazio'));

    // rótulo antigo: aviso + trocar por
    await p.evaluate(()=>{ openOkrObjetivo('velho'); openOkrConfig(); }); await p.waitForTimeout(300);
    const aviso = await p.$$eval('.okr-per-velho', xs=>xs.map(x=>x.textContent.replace(/\s+/g,' ').trim()));
    t('antigo aparece marcado com "Trocar por"', aviso.length===2 && /4T-2026.*Trocar por T426/.test(aviso[0]) && /1S-2027.*Trocar por S127/.test(aviso[1]), aviso);
    await p.evaluate(()=>saveOkrObjetivo()); await p.waitForTimeout(400);
    t('Salvar com rótulo antigo é barrado', JSON.stringify((await banco(p,'velho')).trimestres)===JSON.stringify(['4T-2026','1S-2027']), (await banco(p,'velho')).trimestres);
    await p.click('.okr-per-velho button:has-text("Trocar por T426")'); await p.waitForTimeout(100);
    await p.click('.okr-per-velho button:has-text("Trocar por S127")'); await p.waitForTimeout(100);
    await p.evaluate(()=>saveOkrObjetivo()); await p.waitForTimeout(500);
    t('depois de trocar, salva no padrão e em ordem', JSON.stringify((await banco(p,'velho')).trimestres)===JSON.stringify(['T4'+aa,'S1'+prox]) || JSON.stringify((await banco(p,'velho')).trimestres)===JSON.stringify(['T426','S127']), (await banco(p,'velho')).trimestres);

    // texto que não converte: só "Tirar"
    await p.evaluate(()=>{ openOkrObjetivo('livre'); openOkrConfig(); }); await p.waitForTimeout(300);
    const livre = await p.$$eval('.okr-per-velho button', bs=>bs.map(b=>b.textContent.trim()));
    t('texto que não converte só oferece "Tirar"', JSON.stringify(livre)===JSON.stringify(['Tirar']), livre);
    await p.evaluate(()=>closeOkrObjetivo&&closeOkrObjetivo());

    // perene salva sem período
    await p.evaluate(()=>{ openOkrObjetivo('perene'); openOkrConfig(); }); await p.waitForTimeout(300);
    const hint = await p.$eval('#okr-sec-obj-trimestres .okr-per-hint', e=>e.textContent);
    t('perene mostra que o período é opcional', /perene/i.test(hint), hint);
    await p.evaluate(()=>saveOkrObjetivo()); await p.waitForTimeout(500);
    t('perene salva sem período', !!(await banco(p,'perene')).atualizadoEm, await banco(p,'perene'));

    // a trava é só do Salvar do Objetivo: mudar status de Marco num Objetivo fora do padrão continua gravando
    await p.evaluate(async()=>{ await window._set(window._ref(window._db,'kanban/okr/marcos/m1'),{id:'m1',objetivoId:'livre',nome:'Marco',progresso:'em_andamento'}); okrMarcos.m1={id:'m1',objetivoId:'livre',nome:'Marco',progresso:'em_andamento'}; await _okrCtxMarcoStatus('m1','concluido'); });
    await p.waitForTimeout(300);
    const m1 = await p.evaluate(async()=>(await window._get(window._ref(window._db,'kanban/okr/marcos/m1'))).val());
    t('status de Marco num Objetivo fora do padrão continua gravando (a trava é só do Salvar)', m1 && m1.progresso==='concluido', m1);
    t('sem erro de JS', !errs.length, errs);
    await ctx.close(); }

  // 3 temas × desktop/celular
  for(const vp of [{width:1280,height:800},{width:390,height:800}]) for(const th of ['dark','light','vice']){
    const {ctx,p,errs} = await open(vp,th);
    await p.evaluate(()=>{ openOkrObjetivo('velho'); openOkrConfig(); }); await p.waitForTimeout(400);
    const r = await p.evaluate(()=>{ const s=document.getElementById('okr-sec-obj-trimestres'); s.scrollIntoView({block:'center'}); const b=s.querySelector('.okr-per-btn'); const cs=getComputedStyle(b);
      return {h:b.getBoundingClientRect().height, cor:cs.color, fundo:cs.backgroundColor, larg:s.scrollWidth<=s.clientWidth+1, rolagem:document.documentElement.scrollWidth>innerWidth+1}; });
    await p.waitForTimeout(150);
    await p.screenshot({path:path.join(out, `periodo_${vp.width}_${th}.png`)});
    t(`tema ${th} ${vp.width}px: seletor sem estourar a largura, sem erro`, r.larg && !r.rolagem && !errs.length, [r,errs]);
    await ctx.close(); }
  await b.close(); console.log(ok?'\nTUDO OK':'\nFALHOU'); process.exit(ok?0:1);
})();
