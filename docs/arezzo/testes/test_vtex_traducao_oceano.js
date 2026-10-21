// 🌐 Aviso da VTEX traduzido (functions/vtex/statusVtex.js) NO OCEANO: o Comunicado REAL gerado pela função (comunicadoDe com tradução) aparece em português no
// cartão do Mural; ao abrir o aviso, "🇬🇧 Ver original em inglês" abre/fecha e mostra o texto original; atributos continuam sendo removidos pelo sanitizador.
// Roda:  python3 -m http.server 8941 &   node docs/arezzo/testes/test_vtex_traducao_oceano.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const { _test: V } = require('../../../functions/vtex/statusVtex');
const U=(uid,n)=>({uid,email:uid+'@ciahering.com.br',displayName:n,photoURL:'',providerData:[{providerId:'google.com'}]});
const item={guid:'https://status.vtex.com//incidents/INC9',titulo:'Checkout errors for some stores',link:'https://status.vtex.com/incidents/INC9',estado:'Investigating',
  corpoTexto:'We are investigating errors on Checkout for some stores.',componentes:[{nome:'Checkout',estado:'Partial outage'}],manutencao:false};
const trad={titulo:'Erros no Checkout para algumas lojas',resumo:'Estamos investigando erros no Checkout para algumas lojas.'};
const real=V.comunicadoDe(item,'aberto',Date.now(),null,trad); real.id='vtex_INC9'; real.criadoEm=new Date(Date.now()-60000).toISOString(); real.expiraEm=new Date(Date.now()+3*3600e3).toISOString();
const sujo={id:'sujo',titulo:'Aviso sujo',corpo:'<details onclick="window.__x=1" ontoggle="window.__x=2" open><summary onclick="window.__x=3">Ver</summary><p>texto</p><script>window.__x=4</script></details>',tipo:'aviso',squad:'*',publico:'todos',prioridade:'popup',ativo:true,oceano:true,criadoEm:new Date(Date.now()-120000).toISOString()};
const seed=()=>({kanban:{usuarios:{eve:{uid:'eve',nome:'Eve',email:'eve@ciahering.com.br',init:'EV',role:'membro',inscrito:true,squads:{dev:true}}},usuarios_publicos:{eve:{uid:'eve',nome:'Eve',init:'EV'}},
  config:{adm_emails:[]},comunicados:{vtex_INC9:real,sujo}}});
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true;
 const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,300))); };
 const ctx=await b.newContext({viewport:{width:1280,height:900}}); await fake.install(ctx,seed()); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8941/oceano-dev.html'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U('eve','Eve')); await p.waitForTimeout(2200);
 const card=await p.evaluate(()=>{ const a=[...document.querySelectorAll('#mural .av')].find(x=>/VTEX/.test(x.textContent)); return a?{titulo:a.querySelector('.av-t').textContent, corpo:a.querySelector('.av-corpo').innerText, temDetails:!!a.querySelector('details')}:null; });
 t('cartão do Mural mostra o título e o resumo em português', card && card.titulo==='🚨 VTEX: Erros no Checkout para algumas lojas' && /Estamos investigando erros no Checkout/.test(card.corpo), card);
 t('cartão não carrega o "Ver original" (o cartão é clicável e abre o aviso inteiro)', card && !card.temDetails, card);
 await p.evaluate(()=>[...document.querySelectorAll('#mural .av')].find(x=>/VTEX/.test(x.textContent)).click()); await p.waitForTimeout(400);
 const m=await p.evaluate(()=>{ const bd=document.getElementById('aviso-bd'), d=bd.querySelector('details'); return {aberto:document.getElementById('ov-aviso').classList.contains('open'), tem:!!d, open:d&&d.open, resumo:d&&d.querySelector('summary').textContent, orig:d&&d.innerText, aviso:/tradução automática/.test(bd.textContent)}; });
 t('aviso aberto: tem o "Ver original em inglês", fechado, e avisa que a tradução é automática', m.aberto && m.tem && m.open===false && /Ver original em inglês/.test(m.resumo) && m.aviso, m);
 t('original em inglês escondido enquanto fechado (só o título do "Ver original" aparece)', !/Checkout errors for some stores|We are investigating/.test(m.orig), m);
 await p.click('#aviso-bd summary'); await p.waitForTimeout(200);
 const o=await p.evaluate(()=>{ const d=document.querySelector('#aviso-bd details'); return {open:d.open, txt:d.innerText}; });
 t('clicar abre o original em inglês (título e texto)', o.open && /Checkout errors for some stores/.test(o.txt) && /We are investigating errors on Checkout/.test(o.txt), o);
 await p.click('#aviso-bd summary'); await p.waitForTimeout(150); t('clicar de novo fecha', !(await p.evaluate(()=>document.querySelector('#aviso-bd details').open)), '');
 // sanitização: atributos e script somem, details/summary ficam
 await p.keyboard.press('Escape'); await p.waitForTimeout(200);
 await p.evaluate(()=>[...document.querySelectorAll('#mural .av')].find(x=>/Aviso sujo/.test(x.textContent)).click()); await p.waitForTimeout(400);
 const s=await p.evaluate(()=>{ const bd=document.getElementById('aviso-bd'), d=bd.querySelector('details'); return {tem:!!d, attrs:d?[...d.attributes].map(a=>a.name):null, sattrs:d?[...d.querySelector('summary').attributes].map(a=>a.name):null, script:!!bd.querySelector('script')}; });
 t('sanitizador mantém details/summary mas remove onclick/ontoggle/open e <script>', s.tem && s.attrs.length===0 && s.sattrs.length===0 && !s.script, s);
 await p.click('#aviso-bd summary'); await p.waitForTimeout(150); t('nada executou (window.__x indefinido)', (await p.evaluate(()=>window.__x))===undefined, '');
 t('sem erro de JS', !errs.length, errs);
 await b.close(); console.log(ok?'TUDO OK':'HÁ FALHAS'); })();
