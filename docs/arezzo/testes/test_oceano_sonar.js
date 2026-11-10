// 🔍 Sonar do Oceano (oceano-dev): Ctrl/⌘+K e botão, escopos, busca sem acento e com 1 erro, Radar carregado só quando precisa,
// abre no lugar certo, recentes, XSS em título vindo do banco, 3 temas × 1280/390. E o ?busca= do Maré dev.
// Rodar: python3 -m http.server 8949 (na raiz) e `node docs/arezzo/testes/test_oceano_sonar.js`.
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const chromeRoot = path.join(home, 'hering-tools/chrome');
const chrome = process.env.CHROME || path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n=>n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8949';
const out = process.env.OUT || path.join(__dirname, '../../capturas/oceano-sonar');
const U = {uid:'eve',email:'eve@ciahering.com.br',displayName:'Eve Souza',photoURL:'',providerData:[{providerId:'google.com'}]};
const seed = ()=>({kanban:{
  usuarios:{eve:{uid:'eve',nome:'Eve',email:U.email,init:'EV',role:'membro',inscrito:true,squads:{dados:true,site:true},links:{l1:{titulo:'Planilha de metas',url:'https://docs.google.com/x',ordem:1}}}},
  usuarios_publicos:{eve:{uid:'eve',nome:'Eve',init:'EV'}}, config:{adm_emails:[], links_hering:{h1:{titulo:'Portal RH',url:'https://rh.exemplo.com',ordem:1},h2:{titulo:'Ruim',url:'javascript:alert(1)',ordem:2}}},
  okr:{objetivos:{
    o1:{id:'o1',titulo:'Aumentar conversão do app',torre:'digital',trimestres:['T426'],responsaveis:['eve']},
    o2:{id:'o2',titulo:'Reduzir custo de mídia',torre:'digital',trimestres:['T426'],responsaveis:['ana']},
    o3:{id:'o3',titulo:'Objetivo arquivado conversão',torre:'digital',arquivado:true},
    o4:{id:'o4',titulo:'Conversão da torre comercial',torre:'comercial'},
    o5:{id:'o5',titulo:'<img src=x onerror="window.__xss=1">Título hostil',torre:'digital'},
  }, marcos:{m1:{id:'m1',objetivoId:'o2',nome:'Lançar campanha de Natal'}, m2:{id:'m2',objetivoId:'o3',nome:'Marco do arquivado'}}},
}});

(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const b = await chromium.launch({executablePath:chrome}); let ok = true;
  const t = (n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,400))); };
  const open = async(vp, tema)=>{ const ctx = await b.newContext({viewport:vp||{width:1280,height:800}}); await fake.install(ctx,seed());
    const pedidos = []; ctx.on('request', r=>{ if(r.resourceType()==='document') pedidos.push(r.url()); }); const abertas = { some:f=>pedidos.some(u=>f(u.replace(/^https?:\/\/[^/]+\//,''))), toJSON:()=>pedidos };
    const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    let leiturasOkr = 0; await p.exposeFunction('__contaOkr', ()=>{ leiturasOkr++; });
    await p.addInitScript(t=>{ try{ localStorage.setItem('oceano_prefs', JSON.stringify({tema:t||'abrolhos', abrir:'aba'})); }catch(e){} }, tema);
    await p.goto(base+'/oceano-dev.html'); await p.waitForFunction(()=>!!window.__authCb);
    await p.evaluate(()=>{ const r0 = window._ref; window._ref = (db, path)=>{ if(/^kanban\/okr\//.test(String(path||''))) window.__contaOkr(); return r0(db, path); }; });
    await p.evaluate(x=>window.__authCb(x),U); await p.waitForTimeout(1500);
    return {ctx,p,errs,abertas,leituras:()=>leiturasOkr}; };
  const itens = p => p.$$eval('#sonar-lista .sonar-it', xs=>xs.map(x=>x.querySelector('.sonar-it-t').textContent));
  const grupos = p => p.$$eval('#sonar-lista .sonar-g', xs=>xs.map(x=>x.textContent));
  const digita = async(p, txt)=>{ await p.fill('#sonar-in', txt); await p.waitForTimeout(250); };

  { const {ctx,p,errs,abertas,leituras} = await open();
    await p.keyboard.press('Meta+k'); await p.waitForTimeout(200);
    if(!await p.evaluate(()=>document.getElementById('ov-sonar').classList.contains('open'))){ await p.keyboard.press('Control+k'); await p.waitForTimeout(200); }
    t('Ctrl/⌘+K abre o Sonar com o foco na caixa', await p.evaluate(()=>document.getElementById('ov-sonar').classList.contains('open') && document.activeElement.id==='sonar-in'), '');
    t('abrir o Sonar NÃO lê o Radar', leituras()===0, leituras());
    const g0 = await grupos(p); t('vazio: mostra produtos e comandos', g0.includes('Produtos') && g0.includes('Comandos'), g0);
    await digita(p,'r'); t('1 letra no "Tudo" ainda não lê o Radar', leituras()===0, leituras());
    await digita(p,'conversao'); await p.waitForTimeout(500);
    const r1 = await itens(p);
    t('sem acento acha "Aumentar conversão do app"', r1.includes('Aumentar conversão do app'), r1);
    t('arquivado e torre comercial (modo só Hering) ficam de fora', !r1.some(x=>/arquivado|comercial/i.test(x)), r1);
    t('Radar lido 1x (objetivos + marcos)', leituras()===2, leituras());
    await digita(p,'convesão'); t('1 letra errada ainda acha', (await itens(p)).includes('Aumentar conversão do app'), await itens(p));
    await digita(p,'natal'); const r2 = await itens(p); t('acha Marco pelo nome', r2.includes('Lançar campanha de Natal'), r2);
    t('não lê o Radar de novo na mesma sessão', leituras()===2, leituras());
    await digita(p,'r: meus'); const r3 = await itens(p);
    t('"r: meus" = só os Objetivos em que sou responsável', r3.includes('Aumentar conversão do app') && !r3.includes('Reduzir custo de mídia'), r3);
    await digita(p,'hostil'); await p.waitForTimeout(200);
    t('título hostil do banco aparece como texto (sem XSS)', !(await p.evaluate(()=>window.__xss)) && (await itens(p)).some(x=>x.includes('<img')), await itens(p));
    await digita(p,'l: ruim'); const iR = await p.$$eval('#sonar-lista .sonar-it', xs=>xs.findIndex(x=>x.textContent.includes('Ruim')));
    if(iR>=0){ await p.click('#sonar-o-'+iR); await p.waitForTimeout(400); }
    t('link "javascript:" do banco nunca vira endereço (some da lista ou abre "#")', !abertas.some(u=>/^javascript:/i.test(u)), [iR, abertas]);
    if(await p.evaluate(()=>document.getElementById('ov-sonar').classList.contains('open'))) await p.keyboard.press('Escape');
    await p.click('#btn-sonar'); await p.waitForTimeout(200);
    // escopos
    await digita(p,''); await p.keyboard.press('2'); await p.waitForTimeout(200);
    t('com a caixa vazia, "2" troca para o Radar', await p.$eval('#sonar-esc [aria-selected="true"]', b=>b.textContent.includes('Radar')), '');
    await p.keyboard.press('Tab'); await p.waitForTimeout(150);
    t('Tab passa para Links', await p.$eval('#sonar-esc [aria-selected="true"]', b=>b.textContent.includes('Links')), '');
    await digita(p,'portal'); t('Links: acha "Portal RH"', (await itens(p)).includes('Portal RH'), await itens(p));
    await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.waitForTimeout(150);   // Ajuda → Tudo → Maré
    await digita(p,'m: banner'); const gm = await grupos(p);
    t('"m: banner" mostra "Buscar nos cards" de cada squad', gm.includes('Buscar nos cards') && (await itens(p)).filter(x=>/Buscar “banner” nos cards/.test(x)).length===2, [gm, await itens(p)]);
    // Enter abre no lugar certo (abrir:'aba' → aba nova)
    await p.keyboard.press('Enter'); await p.waitForTimeout(500);
    t('Enter abre o Maré com ?squad=…&busca=banner', abertas.some(u=>/^kanban-dev\.html\?squad=(dados|site)&busca=banner$/.test(u)), abertas);
    t('fecha o Sonar ao abrir', !(await p.evaluate(()=>document.getElementById('ov-sonar').classList.contains('open'))), '');
    await p.click('#btn-sonar'); await p.waitForTimeout(200); await digita(p,'conversao'); await p.waitForTimeout(300);
    const idx = await p.$$eval('#sonar-lista .sonar-it', xs=>xs.findIndex(x=>x.textContent.includes('Aumentar conversão')));
    await p.click('#sonar-o-'+idx); await p.waitForTimeout(500);
    t('clicar num Objetivo abre okr-dev.html?okr=o1', abertas.some(u=>/^okr-dev\.html\?okr=o1$/.test(u)), abertas);
    await p.click('#btn-sonar'); await p.waitForTimeout(200);
    const rec = await grupos(p); t('recentes aparecem com a caixa vazia', rec[0]==='Recentes', rec);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    t('Esc fecha e o foco volta ao botão 🔍', await p.evaluate(()=>!document.getElementById('ov-sonar').classList.contains('open') && document.activeElement.id==='btn-sonar'), await p.evaluate(()=>document.activeElement.id));
    t('sem erro de JS', !errs.length, errs);
    await ctx.close(); }

  // 3 temas do lobby × 1280/390
  for(const vp of [{width:1280,height:800},{width:390,height:800}]) for(const tema of ['abrolhos','lencois','entardecer']){
    const {ctx,p,errs} = await open(vp, tema);
    await p.click('#btn-sonar'); await p.waitForTimeout(200); await digita(p,'conversao'); await p.waitForTimeout(500);
    const r = await p.evaluate(()=>{ const m = document.querySelector('#ov-sonar .sonar').getBoundingClientRect(), it = document.querySelector('.sonar-it');
      return {larg:m.width, h:it?it.getBoundingClientRect().height:0, rolagem:document.documentElement.scrollWidth>innerWidth+1, cheia: m.width>=innerWidth-1}; });
    await p.screenshot({path:path.join(out, `sonar_${vp.width}_${tema}.png`)});
    t(`tema ${tema} ${vp.width}px: abre, item com ≥ 44 px, sem rolagem lateral${vp.width<500?', tela cheia':''}`, r.h>=44 && !r.rolagem && (vp.width>500 || r.cheia) && !errs.length, [r,errs]);
    await ctx.close(); }

  // Maré dev: ?busca= abre a busca preenchida e o parâmetro sai da URL
  { const ctx = await b.newContext({viewport:{width:1280,height:800}});
    await fake.install(ctx,{kanban:{usuarios:{eve:{uid:'eve',nome:'Eve',email:U.email,init:'EV',role:'membro',inscrito:true,squads:{site:true}}},config:{adm_emails:[]},
      squads:{site:{dados:{columns:[{id:'doing',name:'Fazendo'}],cards_index:{c1:'k0',c2:'k1'},cards:{k0:{id:'c1',title:'Banner de Natal',col:'doing'},k1:{id:'c2',title:'Outro card',col:'doing'}}}}}}});
    const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(base+'/kanban-dev.html?squad=site&busca=%3Cimg%20src%3Dx%20onerror%3D%22window.__xss%3D1%22%3E'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U); await p.waitForTimeout(4500);
    const r = await p.evaluate(()=>({aberta:document.getElementById('search-overlay').classList.contains('open'), val:document.getElementById('search-inp').value, url:location.search, xss:!!window.__xss}));
    t('Maré: ?busca= abre a busca preenchida, sem XSS, e sai da URL', r.aberta && r.val.startsWith('<img') && !r.xss && !/busca=/.test(r.url), r);
    await p.goto(base+'/kanban-dev.html?squad=site&busca=banner'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U); await p.waitForTimeout(4500);
    const n = await p.evaluate(()=>[...document.querySelectorAll('#search-results [onclick]')].map(x=>x.textContent).join(' | '));
    t('Maré: ?busca=banner lista o card "Banner de Natal"', /Banner de Natal/.test(n), n);
    t('Maré: sem erro de JS', !errs.length, errs);
    await ctx.close(); }

  await b.close(); console.log(ok?'\nTUDO OK':'\nFALHOU'); process.exit(ok?0:1);
})();
