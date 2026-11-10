// 🔍 Sonar — "meus": no Maré filtra os cards em que estou (responsável ou participante); no Radar conta também os Objetivos
// em que sou responsável por algum MARCO (mesma régua do filtro de pessoa do Radar, _okrObjTemPessoa). "Ver N cards no board" conta certo.
// Rodar: python3 -m http.server 8953 (na raiz) e `node docs/arezzo/testes/test_sonar_meus.js`.
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const chromeRoot = path.join(home, 'hering-tools/chrome');
const chrome = process.env.CHROME || path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n=>n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8953';
const U = {uid:'eve',email:'eve@ciahering.com.br',displayName:'Eve',photoURL:'',providerData:[{providerId:'google.com'}]};
const card = (id,t,o)=>Object.assign({id, title:t, col:'doing'}, o);
const seed = ()=>({kanban:{
  usuarios:{eve:{uid:'eve',nome:'Eve',email:U.email,init:'EV',role:'membro',inscrito:true,squads:{site:true}}},
  usuarios_publicos:{eve:{uid:'eve',nome:'Eve',init:'EV'}}, config:{adm_emails:[]},
  squads:{site:{dados:{columns:[{id:'doing',name:'Fazendo'}], cards_index:{c1:'k1',c2:'k2',c3:'k3',c4:'k4'}, cards:{
    k1:card('c1','Banner de Natal',{owner:'EV'}), k2:card('c2','Banner da home',{participants:['EV','AN']}), k3:card('c3','Banner de outra pessoa',{owner:'AN'}), k4:card('c4','Relatório meu',{owner:'EV'})}}}},
  okr:{objetivos:{o1:{id:'o1',titulo:'Objetivo onde sou responsável',torre:'digital',responsaveis:['eve']},
                  o2:{id:'o2',titulo:'Objetivo onde só tenho um Marco',torre:'digital',responsaveis:['ana']},
                  o3:{id:'o3',titulo:'Objetivo de outra pessoa',torre:'digital',responsaveis:['ana']}},
       marcos:{m1:{id:'m1',objetivoId:'o2',nome:'Marco meu no objetivo da Ana',responsavel:'eve'}, m2:{id:'m2',objetivoId:'o3',nome:'Marco da Ana',responsavel:'ana'}}},
}});

(async()=>{
  const b = await chromium.launch({executablePath:chrome}); let ok = true;
  const t = (n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,400))); };
  const lista = p => p.$$eval('#msn-lista .msn-it .msn-t', xs=>xs.map(x=>x.textContent));
  const digita = async(p,x)=>{ await p.fill('#msn-in', x); await p.waitForTimeout(700); };
  for(const pg of ['kanban-dev.html?squad=site', 'oceano-dev.html']){
    const ctx = await b.newContext({viewport:{width:1280,height:900}}); await fake.install(ctx, seed());
    const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e=>errs.push(e.message));
    await p.goto(base+'/'+pg); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x), U); await p.waitForTimeout(pg.startsWith('kanban')?3000:1500);
    if(pg.startsWith('kanban')) await p.keyboard.press('Control+k'); else await p.click('#btn-sonar');
    await p.waitForTimeout(300);
    const nome = pg.startsWith('kanban') ? 'Maré' : 'Lobby';
    // Radar: "meus" inclui o Objetivo em que só tenho um Marco, e o Marco
    await p.click('#msn-esc [data-esc="radar"]'); await digita(p,'meus');
    const r = await lista(p);
    t(nome+': "meus" no Radar traz o Objetivo em que sou responsável', r.includes('Objetivo onde sou responsável'), r);
    t(nome+': "meus" no Radar traz o Objetivo em que só tenho um Marco', r.includes('Objetivo onde só tenho um Marco'), r);
    t(nome+': "meus" no Radar traz o Marco em que sou responsável', r.includes('Marco meu no objetivo da Ana'), r);
    t(nome+': "meus" no Radar não traz o de outra pessoa', !r.includes('Objetivo de outra pessoa') && !r.includes('Marco da Ana'), r);
    if(pg.startsWith('kanban')){
      await p.click('#msn-esc [data-esc="board"]'); await digita(p,'meus');
      const c1 = await lista(p);
      t('Maré: "meus" lista meus cards (responsável e participante)', ['Banner de Natal','Banner da home','Relatório meu'].every(x=>c1.includes(x)) && !c1.includes('Banner de outra pessoa'), c1);
      await digita(p,'meus banner');
      const c2 = await lista(p);
      t('Maré: "meus banner" = meus cards com "banner"', c2.includes('Banner de Natal') && c2.includes('Banner da home') && !c2.includes('Relatório meu') && !c2.includes('Banner de outra pessoa'), c2);
      t('Maré: "Ver 2 cards no board" conta só os meus', c2.some(x=>/^Ver 2 cards no board$/.test(x)), c2);
      await digita(p,'banner');
      t('Maré: "banner" sozinho continua achando os 3', (await lista(p)).filter(x=>/^Banner/.test(x)).length===3 && (await lista(p)).some(x=>/^Ver 3 cards no board$/.test(x)), await lista(p));
      const iVer = (await lista(p)).findIndex(x=>/^Ver 3 cards/.test(x)); await p.click('#msn-o-'+iVer); await p.waitForTimeout(500);
      t('Maré: "Ver N cards no board" fecha o Sonar e filtra o quadro', await p.evaluate(()=>!document.getElementById('msn-ov').classList.contains('open') && (document.getElementById('f-texto')||{}).value==='banner'), '');
    }
    t(nome+': sem erro de JS', !errs.length, errs);
    await ctx.close();
  }
  await b.close(); console.log(ok?'\nTUDO OK':'\nFALHOU'); process.exit(ok?0:1);
})();
