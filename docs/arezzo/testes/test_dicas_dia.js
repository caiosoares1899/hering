// 💡 Dicas: no máximo 1 por DIA por APP (prefs.ultima[app]); cada dica uma vez só; "Rever dicas" recomeça; persiste (localStorage + Firebase) e vale o dia mais recente.
// Uso (servidor estático na raiz, porta 8941):  node docs/arezzo/testes/test_dicas_dia.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const U = {uid:'eve',email:'eve@ciahering.com.br',displayName:'Eve',photoURL:'',providerData:[{providerId:'google.com'}]};
let ok = true; const t = (n,c,d)=>{ if(!c) ok = false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+(JSON.stringify(d)||'').slice(0,300))); };
const seed = ()=>({kanban:{usuarios:{eve:{uid:'eve',nome:'Eve',email:'eve@ciahering.com.br',init:'EV',role:'membro',inscrito:true,squads:{dev:true}}},usuarios_publicos:{eve:{uid:'eve',nome:'Eve',init:'EV'}},config:{adm_emails:[]}}});
(async()=>{ const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 const ctx = await b.newContext({viewport:{width:1280,height:800}}); await fake.install(ctx, seed());
 const p = await ctx.newPage(); const errs = []; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8941/oceano-dev.html'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U); await p.waitForTimeout(1500);
 const D = (id,g)=>({id,gatilho:g,texto:'Dica '+id});
 const iniciar = (app,ids)=>p.evaluate(([app,ids])=>{ MareDicas.fechar(); MareDicas.init({app, user:{uid:'eve',email:'eve@ciahering.com.br'}, dicas:ids.map(i=>({id:i,gatilho:'x',texto:'Dica '+i}))}); },[app,ids]);
 const vis = ()=>p.evaluate(()=>{ const e=document.getElementById('mare-dica'); return e ? e.querySelector('.mdica-t').textContent : ''; });
 const disparar = async()=>{ await p.evaluate(()=>MareDicas.gatilho('x')); await p.waitForTimeout(2300); return vis(); };
 const hoje = await p.evaluate(()=>{ const d=new Date(),z=n=>String(n).padStart(2,'0'); return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate()); });
 await p.evaluate(()=>{ try{ localStorage.removeItem('mare_dicas_eve'); }catch(e){} });

 await iniciar('appA',['a1','a2','a3']);
 t('1ª visita do dia: a 1ª dica aparece', (await disparar())==='Dica a1');
 t('grava o dia de hoje em prefs.ultima[app] (localStorage e Firebase)', await p.evaluate(h=>{ const ls=JSON.parse(localStorage.getItem('mare_dicas_eve')); return MareDicas._estado().prefs.ultima.appA===h && ls.ultima.appA===h && window.__store.kanban.usuarios.eve.dicas.ultima.appA===h; },hoje));
 await p.evaluate(()=>MareDicas.fechar());
 t('mesmo dia: outro gatilho NÃO abre a 2ª dica (nem passando os 50 s antigos)', (await disparar())==='');
 t('mesmo dia, de novo (3ª tentativa)', (await disparar())==='');
 // recarrega a página: continua valendo (vem do localStorage/Firebase)
 await p.reload(); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),U); await p.waitForTimeout(1500);
 await iniciar('appA',['a1','a2','a3']);
 t('depois de recarregar a página: ainda é o mesmo dia, nada aparece', (await disparar())==='');
 // outro app no mesmo dia: conta separado
 await iniciar('appB',['b1','b2']);
 t('outro app, mesmo dia: a dica dele aparece (cada app tem a sua)', (await disparar())==='Dica b1');
 await p.evaluate(()=>MareDicas.fechar());
 // virou o dia → a próxima (não vista) aparece
 await iniciar('appA',['a1','a2','a3']);
 await p.evaluate(()=>{ MareDicas._estado().prefs.ultima.appA='2000-01-01'; });
 t('no dia seguinte: aparece a PRÓXIMA dica (a1 já foi vista, vem a2)', (await disparar())==='Dica a2');
 await p.evaluate(()=>MareDicas.fechar());
 // "Rever dicas" recomeça: a primeira sai já
 await p.evaluate(()=>MareDicas.reiniciar()); 
 t('"Rever dicas": zera as vistas e o dia do app; a 1ª volta já hoje', (await disparar())==='Dica a1');
 t('…e depois dela, só amanhã', await (async()=>{ await p.evaluate(()=>MareDicas.fechar()); return (await disparar())===''; })());
 // desligar continua valendo
 await p.evaluate(()=>{ MareDicas.fechar(); MareDicas._estado().prefs.ultima.appA='2000-01-01'; MareDicas.definir(false); });
 t('dicas desligadas: nada aparece mesmo num dia novo', (await disparar())==='');
 t('sem erro de JS', !errs.length, errs);
 await b.close(); console.log(ok ? 'TUDO OK' : 'HÁ FALHAS'); process.exit(ok?0:1); })();
