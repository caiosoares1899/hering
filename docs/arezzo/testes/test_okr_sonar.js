// 🔍 Sonar no Radar: contrato do adaptador de okr-dev.html (implementação em paralelo).
// Rodar, quando disponível: python3 -m http.server 8955 (na raiz) e
// node docs/arezzo/testes/test_okr_sonar.js. BASE_URL, CHROME e PLAYWRIGHT_MODULE são opcionais.
// Este teste foi escrito pelo contrato; não foi executado no sandbox sem navegador.
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const chromeRoot = path.join(home, 'hering-tools/chrome');
const chrome = process.env.CHROME || path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n=>n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8955';
const out = process.env.OUT || path.join(__dirname, '../../capturas/okr-sonar');
const U = {uid:'eve',email:'eve@ciahering.com.br',displayName:'Eve',photoURL:'',providerData:[{providerId:'google.com'}]};
const TITULO = 'Aumentar conversão do app', HOSTIL = '<img src=x onerror="window.__xss=1">Hostil';
const seed = ()=>({kanban:{
  usuarios:{eve:{uid:'eve',nome:'Eve',email:U.email,init:'EV',role:'membro',inscrito:true,squads:{site:true}},
    ana:{uid:'ana',nome:'Ana',email:'ana@ciahering.com.br',init:'AN',role:'membro',inscrito:true}},
  config:{adm_emails:[]},
  okr:{objetivos:{
    o1:{id:'o1',titulo:TITULO,torre:'digital',trimestres:['T426'],responsaveis:['eve']},
    o2:{id:'o2',titulo:'Reduzir custo de mídia',torre:'digital',trimestres:['T126'],responsaveis:['ana']},
    o3:{id:'o3',titulo:'Objetivo arquivado conversão',torre:'digital',arquivado:true},
    o5:{id:'o5',titulo:HOSTIL,torre:'digital'},
  },marcos:{m1:{id:'m1',objetivoId:'o2',nome:'Lançar campanha de Natal',responsavel:'eve'}},tags:{}},
}});

(async()=>{
  let b, ok = true, total = 0;
  const t = (n,c,d)=>{ total++; if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+String(JSON.stringify(d)).slice(0,600))); };
  const lista = p=>p.$$eval('#msn-lista .msn-it .msn-t', xs=>xs.map(x=>x.textContent));
  const aberto = p=>p.evaluate(()=>!!document.querySelector('#msn-ov.open'));
  const digita = async(p,x)=>{ await p.fill('#msn-in',x); await p.waitForTimeout(500); };
  const aba = async(p,x)=>{ await digita(p,''); await p.click(`#msn-esc [data-esc="${x}"]`); await p.focus('#msn-in'); };
  const abrir = async(p,tecla='Control+k')=>{ await p.keyboard.press(tecla); await p.waitForTimeout(250); };
  const open = async(vp,tema)=>{
    const ctx = await b.newContext({viewport:vp||{width:1280,height:800}});
    try{
      await fake.install(ctx,seed());
      const pedidos = [], errs = [];
      ctx.on('request',r=>{ if(r.resourceType()!=='document') return; let pagina=null; try{ pagina=r.frame().page(); }catch(e){} pedidos.push({url:r.url(),pagina}); });   // aba nova: o frame ainda não existe quando o pedido sai (pagina fica null)
      ctx.on('page',pg=>pg.on('pageerror',e=>errs.push(e.message)));
      const p = await ctx.newPage(); await p.clock.setFixedTime(new Date('2026-11-10T12:00:00-03:00'));
      await p.goto(base+'/okr-dev.html?torre=digital');
      await p.waitForFunction(()=>!!window.__authCb && typeof window._ref==='function');
      // Instalar ANTES do login; o boot do Radar lê objetivos e marcos normalmente.
      await p.evaluate(()=>{
        window.__leiturasOkr = 0;
        const r0 = window._ref;
        window._ref = function(db,caminho,...args){
          if(String(caminho||'').startsWith('kanban/okr/')) window.__leiturasOkr++;
          return r0.call(this,db,caminho,...args);
        };
      });
      await p.evaluate(x=>window.__authCb(x),U);
      await p.waitForSelector('#okr-sonar-btn',{state:'visible'});
      await p.waitForTimeout(1500);
      if(tema) await p.evaluate(th=>document.documentElement.setAttribute('data-theme',th),tema);
      await p.evaluate(()=>{ window.__leiturasOkr = 0; });
      return {ctx,p,errs,pedidos,leit:()=>p.evaluate(()=>window.__leiturasOkr)};
    }catch(e){ await ctx.close(); throw e; }
  };
  // Falha de um cenário não impede os outros nem o resumo/exit code.
  const caso = async(nome,fn,vp,tema)=>{
    let s;
    try{ s=await open(vp,tema); await fn(s); }
    catch(e){ t(nome,false,e.stack||e.message); }
    finally{ if(s) await s.ctx.close(); }
  };
  try{
    fs.mkdirSync(out,{recursive:true});
    b = await chromium.launch({executablePath:chrome});
    await caso('atalhos, filtros e segurança',async({p,errs,leit})=>{
      await p.focus('#okr-sonar-btn'); await abrir(p);
      t('Ctrl+K abre com foco na caixa e título Sonar', await p.evaluate(()=>!!document.querySelector('#msn-ov.open') && document.activeElement.id==='msn-in' && document.getElementById('msn-ttl-b').textContent==='Sonar'));
      t('abrir não faz nova leitura de kanban/okr/*',await leit()===0,await leit());
      await p.keyboard.press('Escape'); await p.waitForTimeout(200);
      t('Esc fecha e devolve o foco a quem abriu pelo teclado',!await aberto(p) && await p.evaluate(()=>document.activeElement.id==='okr-sonar-btn'));
      await abrir(p,'Meta+k');
      t('Meta+K abre com foco na caixa',await aberto(p) && await p.evaluate(()=>document.activeElement.id==='msn-in'));
      await p.keyboard.press('Escape'); await p.click('#okr-sonar-btn'); await p.waitForTimeout(250);
      t('botão do Radar abre o Sonar',await aberto(p));
      const abas = await p.$$eval('#msn-esc button',bs=>bs.map(x=>[x.textContent.trim().replace(/^\d+/,''),x.dataset.esc]));   // o número da tecla vem junto do nome
      t('cinco abas na ordem e com os data-esc do contrato',JSON.stringify(abas)===JSON.stringify([['Tudo','tudo'],['Objetivos','obj'],['Marcos','marcos'],['Maré','mare'],['Ajuda','ajuda']]),abas);
      await digita(p,''); await p.keyboard.press('1'); await p.waitForTimeout(200);
      t('caixa vazia: tecla 1 seleciona Objetivos',await p.$eval('#msn-esc [data-esc="obj"]',x=>x.getAttribute('aria-selected')==='true'));
      await aba(p,'tudo'); await digita(p,'conversao'); const ls = await lista(p);
      t('busca sem acento encontra o Objetivo',ls.includes(TITULO),ls);
      t('busca exclui Objetivo arquivado',!ls.includes('Objetivo arquivado conversão'),ls);
      t('abrir e buscar usam os dados do Radar: zero leituras novas',await leit()===0,await leit());
      await aba(p,'obj'); await digita(p,'meus'); const meus = await lista(p);
      t('meus inclui Objetivo do qual sou responsável',meus.includes(TITULO),meus);
      t('meus inclui Objetivo cujo Marco está sob minha responsabilidade',meus.includes('Reduzir custo de mídia'),meus);
      await digita(p,'T426'); const periodo = await lista(p);
      t('T426 encontra o1 e exclui o2 de T126',periodo.includes(TITULO) && !periodo.includes('Reduzir custo de mídia'),periodo);
      await aba(p,'tudo'); await digita(p,'natal'); const natal = await lista(p);
      t('natal encontra o Marco pelo nome',natal.includes('Lançar campanha de Natal'),natal);
      await digita(p,'hostil'); const hostil = await lista(p);
      t('título hostil aparece como texto literal',hostil.includes(HOSTIL),hostil);
      t('título hostil não cria img nem executa onerror',await p.evaluate(()=>window.__xss===undefined && !document.querySelector('#msn-lista img[src="x"]')));
      t('todos os filtros continuam sem novas leituras de OKR',await leit()===0,await leit());
      await p.keyboard.press('Escape'); await p.waitForTimeout(200);
      t('Esc fecha e restaura foco no botão que abriu',!await aberto(p) && await p.evaluate(()=>document.activeElement.id==='okr-sonar-btn'));
      t('sem erro de JS nos atalhos e filtros',!errs.length,errs);
    });
    await caso('Enter no Objetivo',async({p,errs})=>{
      const url = p.url(); await abrir(p); await aba(p,'obj'); await digita(p,'aumentar');
      const ls = await lista(p); t('Objetivo é o primeiro resultado para Enter',ls[0]===TITULO,ls);
      await p.keyboard.press('Enter'); await p.waitForTimeout(600);
      t('Enter abre o modal do Objetivo na mesma página',p.url()===url && await p.evaluate(()=>!!document.querySelector('#okr-obj-ov.open') || window._okrEditingObjId==='o1'));
      t('abrir Objetivo fecha o Sonar',!await aberto(p));
      t('sem erro de JS ao abrir Objetivo',!errs.length,errs);
    });
    await caso('busca nos cards do Maré',async({p,pedidos,errs})=>{
      await abrir(p); await aba(p,'mare'); await digita(p,'banner'); const ls = await lista(p);
      t('Maré oferece buscar banner nos cards do squad site',ls.some(x=>x.includes('Buscar “banner” nos cards')),ls);
      const antes = pedidos.length;
      await p.keyboard.press('Enter'); await p.waitForTimeout(800);
      const destinos = pedidos.slice(antes).filter(r=>{
        const u = new URL(r.url);
        return u.pathname==='/kanban-dev.html' && u.searchParams.get('squad')==='site' && u.searchParams.get('busca')==='banner';
      });
      t('Enter solicita kanban-dev.html?squad=site&busca=banner em aba nova',destinos.some(r=>r.pagina!==p),pedidos.slice(antes).map(r=>r.url));
      t('sem erro de JS ao buscar no Maré',!errs.length,errs);
    });
    await caso('Ajuda do Radar',async({p,errs})=>{
      await abrir(p); await aba(p,'ajuda'); await digita(p,'atingimento'); const ls = await lista(p);
      t('Ajuda encontra ao menos um item para atingimento',ls.length>0,ls);
      await p.keyboard.press('Enter'); await p.waitForTimeout(500);
      t('Enter na Ajuda abre o modal de ajuda do Radar',await p.evaluate(()=>!!document.querySelector('#okr-help-ov.open')));
      t('sem erro de JS ao abrir Ajuda',!errs.length,errs);
    });
    for(const largura of [1280,390]) for(const tema of ['dark','light','vice']){
      await caso(`tema ${tema} ${largura}px`,async({p,errs})=>{
        await abrir(p); await aba(p,'tudo'); await digita(p,'conversao');
        const r = await p.evaluate(()=>({
          titulos:[...document.querySelectorAll('#msn-lista .msn-it .msn-t')].map(x=>x.textContent),
          alturas:[...document.querySelectorAll('#msn-lista .msn-it')].map(x=>x.getBoundingClientRect().height),
          lateral:document.documentElement.scrollWidth>innerWidth+1 || document.body.scrollWidth>innerWidth+1 ||
            [...document.querySelectorAll('#msn-ov .msn-box, #msn-lista')].some(x=>x.scrollWidth>x.clientWidth+1),
        }));
        await p.screenshot({path:path.join(out,`okr_sonar_${largura}_${tema}.png`)});
        t(`${tema} ${largura}px: conversao tem resultados`,r.titulos.includes(TITULO),r);
        t(`${tema} ${largura}px: todos os itens têm pelo menos 44px`,r.alturas.length>0 && r.alturas.every(h=>h>=44),r.alturas);
        t(`${tema} ${largura}px: sem rolagem lateral`,!r.lateral,r);
        t(`${tema} ${largura}px: sem erro de JS`,!errs.length,errs);
      },{width:largura,height:800},tema);
    }
  }catch(e){ t('execução da suíte',false,e.stack||e.message); }
  finally{ if(b) await b.close(); }
  console.log((ok?'\nTUDO OK':'\nFALHOU')+` (${total} asserções)`); process.exit(ok?0:1);
})();
