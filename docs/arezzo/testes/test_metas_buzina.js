// 🚢 Buzina de navio no popup 🐟 "O mar tá pra peixe" (mare-metas-dev.js, 2026-10-14): toca INTEIRA (9,5 s), o popup fecha ~1 s depois que ela acaba (sem som: tempo fixo de 9 s), respeita 🔇/Não Perturbe, para ao fechar, e meta batida (100 %) soa mais alta.
// Espia o Audio do navegador (não toca de verdade). SUF=-dev (padrão); SUF= testa a prod (depois da promoção).
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js');
const SUF=process.env.SUF===undefined?'-dev':process.env.SUF; const B='http://localhost:8941/';
const U={uid:'eve',email:'eve@ciahering.com.br',displayName:'Eve Souza',photoURL:'',providerData:[{providerId:'google.com'}]};
const seed=()=>({kanban:{usuarios:{eve:{uid:'eve',nome:'Eve Souza',email:U.email,inscrito:true,init:'ES',role:'adm',squads:{dados:true}}},usuarios_publicos:{eve:{uid:'eve',nome:'Eve Souza',init:'ES',role:'adm',squads:{dados:true}}},config:{adm_emails:[U.email]}}});
const meta=(atual,marco)=>({id:'teste',titulo:'Receita do trimestre',emoji:'💰',escopo:'digital',tipo:'meta',alvo:100,inicial:0,atual,marco});
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true; const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':'  → '+JSON.stringify(d))); };
 const abre=async(pre)=>{ const ctx=await b.newContext({viewport:{width:1280,height:800}}); await fake.install(ctx,seed());
   await ctx.addInitScript(()=>{ window.__audios=[]; window.Audio=function(src){ const a={src,volume:1,paused:true,plays:0,pauses:0,play(){ a.plays++; a.paused=false; return Promise.resolve(); },pause(){ a.pauses++; a.paused=true; }}; window.__audios.push(a); return a; }; });
   if(pre) await ctx.addInitScript(pre); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e))); await p.goto(B+'kanban'+SUF+'.html?squad=dados',{waitUntil:'commit'}); await p.waitForFunction(()=>window.MareMetas&&MareMetas.mostrarPeixes,{timeout:20000}); return {ctx,p,errs}; };
 const mostra=(p,atual,marco)=>p.evaluate(([m])=>{ MareMetas.mostrarPeixes(m[0],m[1]); },[[meta(atual,marco),marco]]);
 // 1) marco comum: toca a buzina INTEIRA (não corta), o popup NÃO fecha no tempo fixo de 9 s e fecha ~1 s depois que a buzina acaba
 { const {ctx,p,errs}=await abre(); await mostra(p,62,60); await p.waitForTimeout(300);
   const r=await p.evaluate(()=>({n:window.__audios.length,a:window.__audios[0]&&{src:window.__audios[0].src,vol:window.__audios[0].volume,plays:window.__audios[0].plays},ov:!!document.querySelector('.mm-fish-ov')}));
   t('marco 60%: o popup aparece e a buzina toca uma vez', r.ov && r.n===1 && /buzina-navio\.mp3$/.test(r.a.src) && r.a.plays===1, r);
   t('marco comum: volume 0,7', Math.abs(r.a.vol-0.7)<0.01, r.a);
   await p.waitForTimeout(9700); const r2=await p.evaluate(()=>({paused:window.__audios[0].paused,pauses:window.__audios[0].pauses,ov:!!document.querySelector('.mm-fish-ov')}));
   t('com a buzina ainda tocando, o popup continua aberto depois dos 9 s do tempo fixo e a buzina não é cortada', r2.ov && r2.paused===false && r2.pauses===0, r2);
   await p.evaluate(()=>window.__audios[0].onended()); await p.waitForTimeout(700); const r3a=await p.evaluate(()=>!!document.querySelector('.mm-fish-ov'));
   await p.waitForTimeout(900); const r3=await p.evaluate(()=>!!document.querySelector('.mm-fish-ov'));
   t('quando a buzina acaba o popup fecha ~1 s depois (ainda aberto aos 0,7 s, fechado aos 1,6 s)', r3a===true && r3===false, {r3a,r3});
   t('sem erro de JS', !errs.length, errs); await ctx.close(); }
 // 2) meta batida: volume mais alto
 { const {ctx,p}=await abre(); await mostra(p,100,100); await p.waitForTimeout(500);
   const r=await p.evaluate(()=>({vol:window.__audios[0].volume,paused:window.__audios[0].paused,dourado:!!document.querySelector('.mm-fish.cem')}));
   t('meta batida (100%): popup dourado, volume 0,85 e a buzina tocando', r.dourado && Math.abs(r.vol-0.85)<0.01 && r.paused===false, r); await ctx.close(); }
 // 3) fechar o popup para a buzina
 { const {ctx,p}=await abre(); await mostra(p,100,100); await p.waitForTimeout(400); await p.click('.mm-fish .go'); await p.waitForTimeout(300);
   const r=await p.evaluate(()=>({paused:window.__audios[0].paused,pauses:window.__audios[0].pauses,ov:!!document.querySelector('.mm-fish-ov')}));
   t('fechar o popup (botão) para a buzina', !r.ov && r.paused && r.pauses>=1, r); await ctx.close(); }
 // 4) 🔇 ligado no sino: sem buzina, o popup volta ao tempo fixo (9 s)
 { const {ctx,p}=await abre(()=>{ try{ localStorage.setItem('notif_sound_muted','1'); }catch(e){} }); await mostra(p,62,60); await p.waitForTimeout(300);
   const r=await p.evaluate(()=>({n:window.__audios.length,ov:!!document.querySelector('.mm-fish-ov')}));
   t('com o 🔇 ligado não toca buzina, mas o popup aparece', r.ov && r.n===0, r);
   await p.waitForTimeout(9000); t('sem som o popup fecha no tempo fixo de 9 s', !(await p.evaluate(()=>!!document.querySelector('.mm-fish-ov'))), 'ainda aberto'); await ctx.close(); }
 // 5) navegador barra o som (play rejeita): sem erro, popup normal, tempo fixo
 { const {ctx,p,errs}=await abre(()=>{ const O=window.Audio; window.Audio=function(s){ const a=new O(s); a.play=()=>Promise.reject(new Error('NotAllowedError')); return a; }; }); await mostra(p,62,60); await p.waitForTimeout(500);
   const r=await p.evaluate(()=>!!document.querySelector('.mm-fish-ov')); t('autoplay barrado: popup normal e sem erro de JS', r && !errs.length, {r,errs});
   await p.waitForTimeout(9000); t('autoplay barrado: o popup volta a fechar no tempo fixo de 9 s', !(await p.evaluate(()=>!!document.querySelector('.mm-fish-ov'))), 'ainda aberto'); await ctx.close(); }
 await b.close(); console.log(ok?'\nTUDO OK':'\nHÁ FALHAS'); process.exit(ok?0:1); })();
