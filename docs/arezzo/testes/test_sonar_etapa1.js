// 🔍 Sonar — Etapa 1 (correções): prefixo × aba, "meu/meus/minha/minhas", Ctrl+Enter só com destino, seleção preservada com o Radar
// chegando atrasado, validade da cópia do Radar também em memória (+ atualizar), "Exibindo X de Y". Lobby (oceano-dev) e Maré (kanban-dev).
// Rodar: python3 -m http.server 8952 (na raiz) e `node docs/arezzo/testes/test_sonar_etapa1.js`.
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const chromeRoot = path.join(home, 'hering-tools/chrome');
const chrome = process.env.CHROME || path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n=>n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8952';
const U = {uid:'eve',email:'eve@ciahering.com.br',displayName:'Eve',photoURL:'',providerData:[{providerId:'google.com'}]};
const muitos = Object.fromEntries(Array.from({length:40}, (_,i)=>['m'+i, {id:'m'+i, titulo:'Meta de vendas '+(i+1), torre:'digital', trimestres:['T426'], responsaveis:i<2?['eve']:['ana']}]));
const seed = ()=>({kanban:{
  usuarios:{eve:{uid:'eve',nome:'Eve',email:U.email,init:'EV',role:'membro',inscrito:true,squads:{site:true,dados:true}}},
  usuarios_publicos:{eve:{uid:'eve',nome:'Eve',init:'EV'}}, config:{adm_emails:[]},
  squads:{site:{dados:{columns:[{id:'doing',name:'Fazendo'}],cards_index:{c1:'k0'},cards:{k0:{id:'c1',title:'Meta do banner',col:'doing'}}}}},
  okr:{objetivos:muitos, marcos:{}},
}});

(async()=>{
  const b = await chromium.launch({executablePath:chrome}); let ok = true;
  const t = (n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,400))); };
  // atraso: leitura de kanban/okr/* responde depois de `atraso` ms
  const open = async(pg, atraso)=>{ const ctx = await b.newContext({viewport:{width:1280,height:900}}); await fake.install(ctx, seed());
    const docs = []; ctx.on('request', r=>{ if(r.resourceType()==='document') docs.push(r.url().replace(/^https?:\/\/[^/]+\//,'')); });
    const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e=>errs.push(e.message));
    let leit = 0; await p.exposeFunction('__contaOkr', ()=>{ leit++; });
    await p.addInitScript(()=>{ try{ localStorage.setItem('oceano_prefs', JSON.stringify({abrir:'aba'})); }catch(e){} });
    await p.goto(base+'/'+pg); await p.waitForFunction(()=>!!window.__authCb);
    await p.evaluate(ms=>{ const r0 = window._ref, g0 = window._get;
      window._ref = (db, pth)=>{ const r = r0(db, pth); try{ r.__p = String(pth||''); }catch(e){} return r; };
      window._get = r=>{ if(r && /^kanban\/okr\//.test(r.__p||'')){ window.__contaOkr(); return new Promise(res=>setTimeout(()=>res(g0(r)), ms)); } return g0(r); };
    }, atraso||0);
    await p.evaluate(x=>window.__authCb(x), U); await p.waitForTimeout(pg.startsWith('kanban')?3000:1500);
    return {ctx, p, errs, docs, leit:()=>leit}; };
  const lista = p => p.$$eval('#msn-lista .msn-it .msn-t', xs=>xs.map(x=>x.textContent));
  const selec = p => p.$eval('#msn-lista .msn-it[aria-selected="true"] .msn-t', x=>x.textContent).catch(()=>null);
  const aba = p => p.$eval('#msn-esc [aria-selected="true"]', x=>x.textContent).catch(()=>null);
  const digita = async(p,x,ms)=>{ await p.fill('#msn-in', x); await p.waitForTimeout(ms||500); };

  // ── Lobby ──
  { const {ctx,p,errs,docs,leit} = await open('oceano-dev.html', 0);
    await p.click('#btn-sonar'); await p.waitForTimeout(200);
    // 2. prefixo vira escopo; trocar de aba troca o escopo
    await digita(p,'r: meta', 700);
    const a1 = {aba:await aba(p), val:await p.inputValue('#msn-in')};
    t('"r: meta" vira a aba Radar e o campo fica só com "meta"', /Radar/.test(a1.aba||'') && a1.val==='meta', a1);
    await p.click('#msn-esc [data-esc="mare"]'); await p.waitForTimeout(400);
    const a2 = {aba:await aba(p), l:await lista(p)};
    t('depois, clicar em "Maré" busca no Maré (não fica preso no Radar)', /Maré/.test(a2.aba||'') && !a2.l.some(x=>/^Meta de vendas/.test(x)), a2);
    // 3. meu/meus/minha/minhas
    for(const w of ['meus','meu','minha','minhas']){ await p.click('#msn-esc [data-esc="radar"]'); await digita(p, w+' meta', 400);
      const l = await lista(p); t(`"${w} meta" filtra pelos meus Objetivos (2)`, l.filter(x=>/^Meta de vendas/.test(x)).length===2, l.length); }
    // 6. Exibindo X de Y
    await p.click('#msn-esc [data-esc="tudo"]'); await digita(p,'meta de vendas', 500);
    const tudo = await p.evaluate(()=>({n:[...document.querySelectorAll('#msn-lista .msn-it .msn-t')].filter(x=>/^Meta de vendas/.test(x.textContent)).length, txt:document.getElementById('msn-lista').textContent, st:document.getElementById('msn-st').textContent}));
    t('em Tudo: 5 Objetivos + "Exibindo 5 de 40" com ação para ver todos no Radar', tudo.n===5 && /Exibindo 5 de 40/.test(tudo.txt), tudo);
    await p.waitForTimeout(700);
    t('o status não finge total: fala do que é parcial', !/^\d+ resultados$/.test((await p.$eval('#msn-st', x=>x.textContent)).trim()) || /de 4\d/.test(await p.$eval('#msn-st', x=>x.textContent)), await p.$eval('#msn-st', x=>x.textContent));
    const iVer = (await lista(p)).findIndex(x=>/Ver os 40|Ver todos/.test(x));
    if(iVer>=0){ await p.click('#msn-o-'+iVer); await p.waitForTimeout(300); }
    t('a ação leva para a aba Radar', /Radar/.test(await aba(p)||''), await aba(p));
    const rad = await p.evaluate(()=>({n:[...document.querySelectorAll('#msn-lista .msn-it .msn-t')].filter(x=>/^Meta de vendas/.test(x.textContent)).length, txt:document.getElementById('msn-lista').textContent}));
    t('na aba Radar: 30 + "Exibindo 30 de 40" com "Mostrar mais"', rad.n===30 && /Exibindo 30 de 40/.test(rad.txt) && /Mostrar mais/.test(rad.txt), rad);
    const iMais = (await lista(p)).findIndex(x=>/Mostrar mais/.test(x)); if(iMais>=0){ await p.click('#msn-o-'+iMais); await p.waitForTimeout(300); }
    t('"Mostrar mais" mostra os 40', (await lista(p)).filter(x=>/^Meta de vendas/.test(x)).length===40, (await lista(p)).length);
    // 4. Ctrl+Enter: rodapé só promete quando o item tem destino
    await p.click('#msn-esc [data-esc="tudo"]'); await digita(p,'perfil', 400);
    const peP = await p.$eval('.msn-pe', x=>x.textContent);
    t('item sem endereço (Meu perfil): rodapé não promete aba nova', !/aba nova/.test(peP), peP);
    await digita(p,'radar', 400);
    const peR = await p.$eval('.msn-pe', x=>x.textContent);
    t('item com endereço (Radar): rodapé oferece aba nova', /aba nova/.test(peR), peR);
    // 1. validade em memória + atualizar
    const l0 = leit();
    await p.clock.setFixedTime(new Date(Date.now() + 3*3600*1000 + 60000));
    await p.click('#msn-esc [data-esc="radar"]'); await digita(p,'meta', 800);
    t('passadas 3 h com o Sonar na memória: relê o Radar', leit()===l0+2, [leit(), l0]);
    await digita(p,'atualizar', 400);
    const iAt = (await lista(p)).findIndex(x=>/Atualizar o Radar/.test(x));
    t('há a ação "Atualizar o Radar"', iAt>=0, await lista(p));
    if(iAt>=0){ await p.click('#msn-o-'+iAt); await p.waitForTimeout(600); }
    t('"Atualizar o Radar" relê agora (e o Sonar continua aberto)', leit()===l0+4 && await p.evaluate(()=>document.getElementById('msn-ov').classList.contains('open')), [leit(), l0]);
    t('sem erro de JS (lobby)', !errs.length, errs);
    await ctx.close(); }

  // 5. seleção preservada com o Radar atrasado
  { const {ctx,p,errs} = await open('oceano-dev.html', 1500);
    await p.click('#btn-sonar'); await p.waitForTimeout(200);
    await digita(p,'meta', 300);
    const antes = await lista(p);
    const alvo = antes.findIndex(x=>/Buscar “meta” nos cards/.test(x));
    for(let k=0;k<alvo;k++) await p.keyboard.press('ArrowDown');
    const s0 = await selec(p);
    await p.waitForTimeout(2200);   // o Radar chega e insere Objetivos ACIMA
    const s1 = await selec(p), depois = await lista(p);
    t('Radar chegando depois não troca o item selecionado', alvo>=0 && s0===s1 && depois.length>antes.length, {s0, s1, antes:antes.length, depois:depois.length});
    t('sem erro de JS (atraso)', !errs.length, errs);
    await ctx.close(); }

  // 4. Maré: card com deep link → Ctrl+Enter abre o card em aba nova
  { const {ctx,p,errs,docs} = await open('kanban-dev.html?squad=site', 0);
    await p.keyboard.press('Control+k'); await p.waitForTimeout(300); await digita(p,'banner', 500);
    t('Maré: card oferece aba nova no rodapé', /aba nova/.test(await p.$eval('.msn-pe', x=>x.textContent)), await p.$eval('.msn-pe', x=>x.textContent));
    await p.keyboard.press('Control+Enter'); await p.waitForTimeout(600);
    t('Maré: Ctrl+Enter no card abre kanban-dev.html?squad=site&card=c1', docs.some(u=>u==='kanban-dev.html?squad=site&card=c1'), docs);
    t('sem erro de JS (Maré)', !errs.length, errs);
    await ctx.close(); }

  await b.close(); console.log(ok?'\nTUDO OK':'\nFALHOU'); process.exit(ok?0:1);
})();
