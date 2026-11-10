// 🔍 Sonar no Maré (kanban-dev): Ctrl+K busca nos cards deste board (sem acento) e no resto do Oceano (Radar, outros squads, Ajuda),
// usa a cópia do Radar que o lobby guarda (0 leituras), lê 1x sem cópia, escapa título hostil, 3 temas × 1280/390.
// Rodar: python3 -m http.server 8950 (na raiz) e `node docs/arezzo/testes/test_mare_sonar.js`.
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const chromeRoot = path.join(home, 'hering-tools/chrome');
const chrome = process.env.CHROME || path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n=>n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8950';
const out = process.env.OUT || path.join(__dirname, '../../capturas/mare-sonar');
const U = {uid:'eve',email:'eve@ciahering.com.br',displayName:'Eve Souza',photoURL:'',providerData:[{providerId:'google.com'}]};
const seed = ()=>({kanban:{
  usuarios:{eve:{uid:'eve',nome:'Eve',email:U.email,init:'EV',role:'membro',inscrito:true,squads:{site:true,dados:true}}},
  config:{adm_emails:[]},
  squads_meta:{dados:{label:'Squad Dados'}},
  squads:{site:{dados:{columns:[{id:'doing',name:'Fazendo'}],cards_index:{c1:'k0',c2:'k1'},cards:{k0:{id:'c1',title:'Conversão do checkout',col:'doing'},k1:{id:'c2',title:'Outro card',col:'doing'}}}}},
  okr:{objetivos:{o1:{id:'o1',titulo:'Aumentar conversão do app',torre:'digital',trimestres:['T426'],responsaveis:['eve']},
                  o5:{id:'o5',titulo:'<img src=x onerror="window.__xss=1">Hostil',torre:'digital'},
                  o9:{id:'o9',titulo:'Conversão arquivada',torre:'digital',arquivado:true}},
       marcos:{m1:{id:'m1',objetivoId:'o1',nome:'Teste A/B da conversão'}}},
}});

(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const b = await chromium.launch({executablePath:chrome}); let ok = true;
  const t = (n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,400))); };
  const open = async(vp, tema, cache)=>{ const ctx = await b.newContext({viewport:vp||{width:1280,height:800}}); await fake.install(ctx,seed());
    const pedidos = []; ctx.on('request', r=>{ if(r.resourceType()==='document') pedidos.push(r.url().replace(/^https?:\/\/[^/]+\//,'')); });
    const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    let leit = 0; await p.exposeFunction('__contaOkr', ()=>{ leit++; });
    if(cache) await p.addInitScript(c=>{ try{ localStorage.setItem('oceano_sonar_radar_dev', JSON.stringify(c)); }catch(e){} }, cache);
    await p.goto(base+'/kanban-dev.html?squad=site'); await p.waitForFunction(()=>!!window.__authCb);
    await p.evaluate(()=>{ const r0 = window._ref; window._ref = (db, path)=>{ if(/^kanban\/okr\//.test(String(path||''))) window.__contaOkr(); return r0(db, path); }; });
    await p.evaluate(x=>window.__authCb(x),U); await p.waitForTimeout(3000);
    if(tema && tema!=='dark') await p.evaluate(th=>document.documentElement.setAttribute('data-theme',th), tema);
    return {ctx,p,errs,pedidos,leit:()=>leit}; };
  const lista = p => p.$$eval('#msn-lista .msn-it .msn-t', xs=>xs.map(x=>x.textContent));
  const grupos = p => p.$$eval('#msn-lista .msn-g', xs=>xs.map(x=>x.textContent));
  const digita = async(p,x)=>{ await p.fill('#msn-in', x); await p.waitForTimeout(500); };

  { const {ctx,p,errs,pedidos,leit} = await open();
    await p.keyboard.press('Control+k'); await p.waitForTimeout(250);
    t('primeira vez, caixa vazia: frase inicial do Maré e nenhum grupo vazio', await p.evaluate(()=>/Digite para buscar nos cards deste board/.test(document.getElementById('msn-lista').textContent) && !document.querySelector('#msn-lista .msn-g')), await p.evaluate(()=>document.getElementById('msn-lista').textContent));
    const box = await p.evaluate(()=>({aberto:document.getElementById('msn-ov').classList.contains('open'), label:document.getElementById('msn-ttl-b').textContent, ph:document.getElementById('msn-in').placeholder}));
    t('Ctrl+K abre o Sonar (nome visível)', box.aberto && box.label==='Sonar' && /board/.test(box.ph), box);
    await digita(p,'c'); t('1 letra: não lê o Radar', leit()===0, leit());
    await digita(p,'conversao');
    const l1 = await lista(p), g1 = await grupos(p);
    t('card do board acha sem acento ("conversao" → "Conversão do checkout")', l1[0]==='Conversão do checkout' && g1[0]==='Neste board', [l1,g1]);
    t('Radar: Objetivo e Marco aparecem; arquivado não', l1.includes('Aumentar conversão do app') && l1.includes('Teste A/B da conversão') && !l1.includes('Conversão arquivada'), l1);
    t('Radar lido 1x sem cópia no aparelho (objetivos + marcos)', leit()===2, leit());
    t('"Outros squads" oferece buscar no Squad Dados (no fim da lista)', g1[g1.length-1]==='Outros squads' || g1.includes('Outros squads') && l1.some(x=>/Buscar “conversao” em Squad Dados/.test(x)), [g1,l1]);
    t('mesmo layout do lobby: título Sonar, abas e disco', await p.evaluate(()=>!!document.querySelector('#msn-ov .msn-disc') && document.querySelectorAll('#msn-esc button').length===5), '');
    await digita(p,'meu dia'); const l2 = await lista(p);
    t('Ajuda do Maré aparece', (await grupos(p)).includes('Ajuda do Maré') && l2.some(x=>/Meu Dia/.test(x)), l2);
    await digita(p,'hostil'); t('título hostil vira texto (sem XSS)', !(await p.evaluate(()=>window.__xss)) && (await lista(p)).some(x=>x.includes('<img')), await lista(p));
    // Enter no Objetivo
    await digita(p,'aumentar'); const idx = (await lista(p)).indexOf('Aumentar conversão do app');
    for(let k=0;k<idx;k++) await p.keyboard.press('ArrowDown');
    await p.keyboard.press('Enter'); await p.waitForTimeout(600);
    t('Enter no Objetivo abre okr-dev.html?okr=o1 (aba nova) e fecha o Sonar', pedidos.some(u=>u==='okr-dev.html?okr=o1') && !(await p.evaluate(()=>document.getElementById('msn-ov').classList.contains('open'))), pedidos);
    // Enter no card continua abrindo o card
    await p.keyboard.press('Control+k'); await p.waitForTimeout(200);
    t('caixa vazia no Maré: só "Recentes" (o Objetivo de antes), sem título de grupo sem itens', await p.evaluate(()=>{ const gs=[...document.querySelectorAll('#msn-lista .msn-g')]; return gs.length===1 && gs[0].textContent==='Recentes' && gs.every(g=>g.nextElementSibling && g.nextElementSibling.classList.contains('msn-it')); }), await p.evaluate(()=>document.getElementById('msn-lista').textContent));
    await digita(p,'checkout'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
    t('Enter no card deste board abre o card (como antes)', await p.evaluate(()=>document.getElementById('card-ov').classList.contains('open')), '');
    // ?busca= abre o Sonar já filtrado em "Este board"
    await p.goto(base+'/kanban-dev.html?squad=site&busca=checkout'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U); await p.waitForTimeout(4000);
    const bz = await p.evaluate(()=>({aberto:document.getElementById('msn-ov').classList.contains('open'), q:document.getElementById('msn-in').value, esc:(document.querySelector('#msn-esc [aria-selected="true"]')||{}).textContent, url:location.search}));
    t('?busca= abre o Sonar preenchido em "Este board" e sai da URL', bz.aberto && bz.q==='checkout' && /Este board/.test(bz.esc||'') && !/busca=/.test(bz.url), bz);
    t('sem erro de JS', !errs.length, errs);
    await ctx.close(); }

  // com a cópia do lobby no aparelho: 0 leituras
  { const cache = {t:Date.now(), v:{objs:{o1:{id:'o1',t:'Aumentar conversão do app',per:['T426'],resp:['eve']}}, marcos:[]}};
    const {ctx,p,errs,leit} = await open(null, null, cache);
    await p.keyboard.press('Control+k'); await p.waitForTimeout(200); await digita(p,'conversao');
    t('com a cópia do lobby: acha o Objetivo sem ler o banco', leit()===0 && (await lista(p)).includes('Aumentar conversão do app'), [leit(), await lista(p)]);
    t('sem erro de JS (cópia)', !errs.length, errs); await ctx.close(); }

  for(const vp of [{width:1280,height:800},{width:390,height:800}]) for(const tema of ['dark','light','vice','blackfriday']){
    const {ctx,p,errs} = await open(vp, tema);
    await p.keyboard.press('Control+k'); await p.waitForTimeout(200); await digita(p,'conversao');
    const r = await p.evaluate(()=>({rolagem:document.documentElement.scrollWidth>innerWidth+1, n:document.querySelectorAll('#msn-lista .msn-it').length}));
    await p.screenshot({path:path.join(out, `sonar_mare_${vp.width}_${tema}.png`)});
    t(`tema ${tema} ${vp.width}px: lista com resultados, sem rolagem lateral, sem erro`, r.n>=3 && !r.rolagem && !errs.length, [r,errs]);
    await ctx.close(); }
  await b.close(); console.log(ok?'\nTUDO OK':'\nFALHOU'); process.exit(ok?0:1);
})();
