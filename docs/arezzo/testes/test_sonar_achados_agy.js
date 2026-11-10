// 🔍 Sonar — achados do /monitorarbugs do Antigravity (10/11/2026), portados para o código atual:
// 1. "Ver N cards no board" mostra no quadro os mesmos N cards que o Sonar contou (sem acento / várias palavras)
// 3. pontuação colada no termo ("conversao?", "a/b") casa; busca só de símbolos não acha nada
// 4. tópicos do Spotify (pausado) não aparecem no Sonar
// 5. aba "Squads" com a caixa vazia lista os squads; abrir card pelo Sonar fecha a Ajuda que estava por cima
// 6. o disco para quando o Radar demora e termina de carregar
// Rodar: python3 -m http.server 8953 (na raiz) e `node docs/arezzo/testes/test_sonar_achados_agy.js` (BASE_URL troca o servidor).
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const chromeRoot = path.join(home, 'hering-tools/chrome');
const chrome = process.env.CHROME || path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n=>n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8953';
const U = {uid:'eve',email:'eve@ciahering.com.br',displayName:'Eve',photoURL:'',providerData:[{providerId:'google.com'}]};
const seed = ()=>({kanban:{
  usuarios:{eve:{uid:'eve',nome:'Eve',email:U.email,init:'EV',role:'membro',inscrito:true,squads:{site:true}}},
  usuarios_publicos:{eve:{uid:'eve',nome:'Eve',init:'EV'}}, config:{adm_emails:[]},
  squads_meta:{dados:{label:'Squad Dados'}},
  squads:{site:{dados:{columns:[{id:'doing',name:'Fazendo'}], cards_index:{c1:'k1',c2:'k2',c3:'k3'}, cards:{
    k1:{id:'c1',title:'Conversão do checkout',col:'doing'}, k2:{id:'c2',title:'Checkout: conversão mobile',col:'doing'}, k3:{id:'c3',title:'Teste A/B do banner',col:'doing'}}}}},
  okr:{objetivos:{o1:{id:'o1',titulo:'Meta X',torre:'digital'}}, marcos:{}},
}});

(async()=>{
  const b = await chromium.launch({executablePath:chrome}); let ok = true;
  const t = (n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,300))); };
  const lista = p => p.$$eval('#msn-lista .msn-it .msn-t', xs=>xs.map(x=>x.textContent));
  const digita = async(p,x)=>{ await p.fill('#msn-in', x); await p.waitForTimeout(700); };
  const ctx = await b.newContext({viewport:{width:1280,height:900}}); await fake.install(ctx, seed());
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  await p.goto(base+'/kanban-dev.html?squad=site'); await p.waitForFunction(()=>!!window.__authCb);
  await p.evaluate(()=>{ const r0 = window._ref, g0 = window._get;   // Radar responde em 1,5 s
    window._ref = (db, pth)=>{ const r = r0(db, pth); try{ r.__p = String(pth||''); }catch(e){} return r; };
    window._get = r=>{ if(r && /^kanban\/okr\//.test(r.__p||'')) return new Promise(res=>setTimeout(()=>res(g0(r)), 1500)); return g0(r); }; });
  await p.evaluate(x=>window.__authCb(x), U); await p.waitForTimeout(3000);
  await p.keyboard.press('Control+k'); await p.waitForTimeout(300);
  // 6. disco para depois do Radar lento
  await digita(p,'meta');
  await p.waitForTimeout(2500);
  t('6: Radar lento terminou → disco parado', await p.evaluate(()=>document.getAnimations().filter(a=>a.animationName==='msn-sweep').length===0 && !document.querySelector('#msn-ov .msn-box').classList.contains('scan')), '');
  // 3. pontuação colada
  await digita(p,'conversao?'); const l3 = await lista(p); t('3: "conversao?" acha os 2 cards de conversão', ['Conversão do checkout','Checkout: conversão mobile'].every(x=>l3.includes(x)), l3);
  await digita(p,'a/b'); t('3: "a/b" acha "Teste A/B do banner"', (await lista(p)).includes('Teste A/B do banner'), await lista(p));
  t('3: busca só de símbolos não acha nada', await p.evaluate(()=>MareSonar._pontua('Qualquer título', ['???'])===0 && MareSonar._pontua('Qualquer', [])===1), '');
  // 4. Spotify fora
  await digita(p,'spotify'); const daAba = await p.evaluate(()=>(HELP_CONTENT.spotify||[]).map(i=>i.title));
  const l4 = await lista(p); t('4: nenhum tópico da aba Spotify (pausada) aparece', daAba.length>0 && !l4.some(x=>daAba.includes(x)), {daAba, l4});
  // 5. aba Squads vazia
  await p.fill('#msn-in',''); await p.click('#msn-esc [data-esc="squads"]'); await p.waitForTimeout(300);
  t('5: aba "Squads" com a caixa vazia lista os squads', (await lista(p)).includes('Squad Dados'), await lista(p));
  // 1. Ver N cards no board = mesmos cards
  await p.click('#msn-esc [data-esc="tudo"]'); await digita(p,'checkout conversao');
  const ver = (await lista(p)).find(x=>/^Ver \d+ cards no board$/.test(x)) || '';
  const iVer = (await lista(p)).indexOf(ver); await p.click('#msn-o-'+iVer); await p.waitForTimeout(600);
  const noQuadro = await p.evaluate(()=>[...document.querySelectorAll('.card')].filter(c=>c.offsetParent!==null).length);
  t('1: "'+ver+'" mostra no quadro os mesmos cards (sem acento, 2 palavras)', ver==='Ver 2 cards no board' && noQuadro===2, {ver, noQuadro});
  await p.evaluate(()=>{ try{ _okrNoop; }catch(e){} if(typeof clearFilters==='function') clearFilters(); });
  // 5. abrir card fecha a Ajuda por cima
  await p.evaluate(()=>openHelp('board')); await p.waitForTimeout(300);
  await p.keyboard.press('Control+k'); await p.waitForTimeout(300); await digita(p,'banner');
  await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  const est = await p.evaluate(()=>({card:document.getElementById('card-ov').classList.contains('open'), ajuda:document.getElementById('help-ov').classList.contains('open')}));
  t('5: abrir card pelo Sonar fecha a Ajuda que estava por cima', est.card && !est.ajuda, est);
  t('sem erro de JS', !errs.length, errs);
  await ctx.close(); await b.close(); console.log(ok?'\nTUDO OK':'\nFALHOU'); process.exit(ok?0:1);
})();
