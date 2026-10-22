// ⛵ Travessia — protótipo da Fase 0 (travessia-dev.html, dados fictícios): papéis, abas, interações, 3 temas, 1280 e 390 px, contraste e rolagem lateral.
// Roda:  python3 -m http.server 8941 &   node docs/arezzo/testes/test_travessia_proto.js     (PRINTS=pasta salva as capturas)
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fs=require('fs');
const URL='http://localhost:8941/travessia-dev.html';
const lum=c=>{ const m=(c.match(/[\d.]+/g)||[]).map(Number); const f=v=>{ v/=255; return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4); }; return .2126*f(m[0])+.7152*f(m[1])+.0722*f(m[2]); };
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true;
 const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,400))); };
 const abre=async(vp,tema,hash)=>{ const ctx=await b.newContext({viewport:vp}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const reqs=[]; p.on('request',r=>{ if(!/localhost|fonts\.g/.test(r.url())&&!r.url().startsWith('data:')) reqs.push(r.url()); });
   await p.goto(URL+(hash?'#'+hash:''),{waitUntil:'domcontentloaded'}); await p.waitForSelector('#app .h1'); if(tema){ for(let i=0;i<(tema==='light'?1:2);i++) await p.click('#btn-tema'); } return {ctx,p,errs,reqs}; };
 const dec=await b.newContext(); const hp=await dec.newPage();
 const contraste=async(p)=>{
   const walk=()=>{ const out=[]; const w=document.createTreeWalker(document.getElementById('app'),NodeFilter.SHOW_TEXT); let n; while((n=w.nextNode())){ const e=n.parentElement; if(!e||!n.textContent.trim()) continue; if(n.textContent.trim().codePointAt(0)>0x2000) continue; const cs=getComputedStyle(e); if(cs.visibility==='hidden'||cs.display==='none') continue; const r=document.createRange(); r.selectNodeContents(n); const q=r.getClientRects()[0]; if(!q||q.width<4||q.height<6) continue; out.push({c:cs.color,fs:parseFloat(cs.fontSize),fw:+cs.fontWeight,x:q.left+scrollX+Math.min(2,q.width/2),y:q.top+scrollY+q.height/2,t:n.textContent.trim().slice(0,28)}); } return out; };
   await p.evaluate(()=>document.fonts.ready); const cores=(await p.evaluate(`(${walk.toString()})()`)).slice(0,300);
   await p.addStyleTag({content:'#app *{color:transparent!important;text-shadow:none!important;-webkit-text-fill-color:transparent!important} #app ::placeholder{color:transparent!important}'});
   const pos=(await p.evaluate(`(${walk.toString()})()`)).slice(0,300);   // posições DEPOIS da injeção: o layout é o mesmo da captura
   const itens=cores.map((c,i)=>Object.assign({},c,{x:(pos[i]||c).x,y:(pos[i]||c).y}));
   const png=(await p.screenshot({fullPage:true})).toString('base64');
   const bad=await hp.evaluate(async({png,itens})=>{ const img=new Image(); img.src='data:image/png;base64,'+png; await img.decode(); const c=document.createElement('canvas'); c.width=img.width; c.height=img.height; const g=c.getContext('2d'); g.drawImage(img,0,0);
     const f=v=>{ v/=255; return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4); }; const L=(r,gg,b)=>.2126*f(r)+.7152*f(gg)+.0722*f(b); const piores=[];
     for(const it of itens){ const m=it.c.match(/[\d.]+/g).map(Number); const a=m.length>3?m[3]:1; const px=g.getImageData(Math.max(0,Math.min(img.width-1,Math.round(it.x))),Math.max(0,Math.min(img.height-1,Math.round(it.y))),1,1).data;
       const fr=[0,1,2].map(i=>m[i]*a+px[i]*(1-a)); const l1=L(...fr), l2=L(px[0],px[1],px[2]); const ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05); const grande=it.fs>=24||(it.fs>=18.66&&it.fw>=700);
       if(ratio<(grande?3:4.5)) piores.push([it.t,+ratio.toFixed(2),it.fs,Math.round(it.x),Math.round(it.y)]); } return piores; },{png,itens});
   return {n:itens.length,bad}; };
 const lateral=p=>p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
 const prints=process.env.PRINTS; if(prints) fs.mkdirSync(prints,{recursive:true});
 // 0) botão de tema: só o emoji (igual ao Maré), alterna os 3 temas
 { const {ctx,p}=await abre({width:1280,height:900}); const txt=()=>p.locator('#btn-tema').innerText(); const th=()=>p.evaluate(()=>document.documentElement.getAttribute('data-theme')||'escuro');
   t('botão de tema mostra só o emoji (🌙)', (await txt()).trim()==='🌙' && (await p.locator('#sel-tema').count())===0, await txt());
   await p.click('#btn-tema'); t('1º clique: claro ☀️', (await txt()).trim()==='☀️' && (await th())==='light', [await txt(),await th()]);
   await p.click('#btn-tema'); t('2º clique: entardecer 🌅', (await txt()).trim()==='🌅' && (await th())==='sunset', '');
   await p.click('#btn-tema'); t('3º clique: volta ao escuro 🌙', (await txt()).trim()==='🌙' && (await th())==='escuro', ''); await ctx.close(); }
 // 1) fluxo completo da Pessoa (1280)
 { const {ctx,p,errs,reqs}=await abre({width:1280,height:900});
   t('abre como Pessoa, com rota e 6 portos', (await p.locator('.porto').count())===6 && await p.locator('.porto.atual .barco').count()===1, '');
   t('nada de rede além do próprio servidor e das fontes (protótipo sem Firebase)', reqs.length===0, reqs);
   await p.click('[data-tab="pdi"]'); const pctAntes=await p.locator('.foco .ring b').first().innerText();
   await p.locator('input[data-act="acao-pdi"]').nth(1).check(); const pctDepois=await p.locator('.foco .ring b').first().innerText(); t('marcar ação do PDI atualiza o anel', pctAntes!==pctDepois, [pctAntes,pctDepois]);
   await p.click('[data-act="pedir-copiloto"]'); t('Agente sugere 2 focos como rascunho', (await p.locator('.foco.rasc').count())===2, '');
   const nAntes=await p.locator('.foco').count(); await p.locator('[data-act="aceitar-foco"]').first().click(); t('aceitar vira foco do PDI marcado como rascunho do Agente', (await p.locator('.foco .chip.ag',{hasText:'Rascunho do Agente'}).count())===1, '');
   await p.click('[data-tab="um"]'); await p.fill('#np','Quero falar de férias em dezembro'); await p.press('#np','Enter'); t('adicionar tópico à pauta', (await p.locator('.lst li',{hasText:'férias em dezembro'}).count())===1, '');
   await p.locator('[data-act="add-sug"]').first().click(); t('sugestão do sistema entra na pauta e sai da lista de sugeridos', (await p.locator('[data-act="add-sug"]').count())===4, await p.locator('[data-act="add-sug"]').count());
   await p.fill('#np','<img src=x onerror=alert(1)>'); await p.press('#np','Enter'); t('texto digitado é escapado (sem HTML injetado)', (await p.locator('#app img').count())===0, '');
   await p.click('[data-tab="acoes"]'); await p.click('[data-f="atrasadas"]'); t('filtro "atrasadas" mostra a ação atrasada com ⚠ e texto', (await p.locator('.lst li').count())===1 && /atrasada/.test(await p.locator('.lst li').first().innerText()), '');
   await p.click('[data-tab="historia"]'); await p.click('[data-act="autoav"]'); t('autoavaliação rascunhada pelo Agente', /Rascunho do Agente/.test(await p.inputValue('#aav')), '');
   t('Pessoa: sem erro de JS', !errs.length, errs); await ctx.close(); }
 // 2) PO: frota, sinais, detalhe, notas privadas, pauta com RH e planejador
 { const {ctx,p,errs}=await abre({width:1280,height:900},null,'po');
   t('Frota: 6 pessoas', (await p.locator('.pcard').count())===6, await p.locator('.pcard').count());
   const ordem=await p.locator('.pcard b').allInnerTexts(); t('quem precisa de atenção aparece primeiro', ordem[0]!=='Ana Lima' && ordem.indexOf('Fabiana Souza')>ordem.indexOf('Cauê Matos'), ordem);
   const sinal=await p.locator('.pcard',{hasText:'Cauê Matos'}).innerText(); t('Cauê: 1:1 atrasado e PDI parado (texto + ícone, não só cor)', /1:1 atrasado há 20 dias/.test(sinal)&&/PDI parado há 24 dias/.test(sinal), sinal);
   await p.click('[data-f="atencao"]'); t('filtro "precisam de atenção" tira quem está em dia', (await p.locator('.pcard',{hasText:'Fabiana'}).count())===0, '');
   await p.click('[data-f="todos"]'); await p.locator('.pcard',{hasText:'Ana Lima'}).locator('[data-act="abrir"]').click(); t('abrir Ana mostra visão do PO e as notas privadas dela', (await p.locator('#detalhe').count())===1 && /só você vê/.test(await p.locator('#detalhe').innerText()), '');
   await p.fill('#nn','Nota nova de teste'); await p.press('#nn','Enter'); t('salvar nota privada', (await p.locator('#detalhe .lst li',{hasText:'Nota nova de teste'}).count())===1, '');
   await p.click('[data-act="levar-rh"]'); await p.click('[data-tab="rh"]'); t('"Levar ao RH" cria item privado na pauta com o RH', (await p.locator('.lst li',{hasText:'Sobre Ana'}).locator('.chip.warn',{hasText:'Privado'}).count())===1, '');
   await p.locator('.lst li',{hasText:'Sobre Ana'}).locator('[data-act="rh-toggle"]').click(); t('compartilhar muda o selo', (await p.locator('.lst li',{hasText:'Sobre Ana'}).locator('.chip.ok',{hasText:'Compartilhado'}).count())===1, '');
   await p.click('[data-tab="planejar"]'); const oc=await p.locator('.ocorr li').count(); t('planejador gera 8 conversas', oc===8, oc);
   await p.selectOption('[data-plan="cad"]','trimestral'); const dts=await p.locator('.ocorr li b').allInnerTexts(); t('trimestral espaça ~3 meses', dts.length===8 && dts[0]!==dts[1], dts);
   await p.selectOption('[data-plan="cad"]','semanal'); await p.selectOption('[data-plan="pessoa"]','ana'); await p.selectOption('[data-plan="dow"]','5'); const fol=await p.locator('.ocorr').innerText(); t('semanal na sexta de Ana: 06/11 (folga) é movida e o motivo é a folga, não o fim de semana', /movido de sex 06\/11: folga na Escala/.test(fol) && /movido de sex 20\/11: feriado \(Consciência Negra\)/.test(fol), fol);
   await p.click('[data-act="criar-serie"]'); t('criar série avisa por toast', /Série criada/.test(await p.locator('#toast').innerText()), '');
   t('PO: sem erro de JS', !errs.length, errs); await ctx.close(); }
 // 3) RH só vê o que o PO compartilhou; gerente vê agregado
 { const {ctx,p,errs}=await abre({width:1280,height:900},null,'po'); await p.click('[data-tab="rh"]'); await p.fill('#nr','Segredo do PO que o RH não pode ver'); await p.press('#nr','Enter'); await p.locator('.lst li',{hasText:'banco de horas'}).locator('[data-act="rh-toggle"]').click(); await p.click('[data-papel="rh"]'); await p.click('[data-tab="pautas"]');
   const rh=await p.locator('main').innerText(); t('RH vê o que o PO compartilhou (2 itens) e NÃO vê o item privado', /banco de horas/.test(rh) && /Como apoiar quem está com 3 frentes/.test(rh) && !/Segredo do PO/.test(rh), rh.slice(0,400)); 
      await p.click('[data-tab="visao"]'); t('RH: visão geral mostra squad Dados como piloto e aviso de privacidade', /piloto/.test(await p.locator('main').innerText()) && /Não vê/.test(await p.locator('main').innerText()), '');
   await p.click('[data-papel="gerente"]'); t('Gerente: 4 POs com constância e pessoas que precisam de atenção', (await p.locator('.pcard').count())===4 && /precisam de atenção/.test(await p.locator('.pcard').first().innerText()), '');
   t('RH/Gerente: sem erro de JS', !errs.length, errs); await ctx.close(); }
 // 4) 3 temas × 4 papéis × 2 larguras: sem rolagem lateral, contraste do texto principal e dos chips
 for(const [vp,nome] of [[{width:1280,height:900},'desk'],[{width:390,height:800},'cel']]) for(const tema of ['','light','sunset']) for(const papel of ['pessoa','po','gerente','rh']){
   const {ctx,p,errs}=await abre(vp,tema,papel); await p.waitForTimeout(150);
   const r=await p.evaluate(()=>{ const cs=x=>getComputedStyle(x); const bg=e=>{ let n=e; while(n){ const c=cs(n).backgroundColor; if(c&&!/rgba\(0, 0, 0, 0\)/.test(c)&&!/, 0\)$/.test(c)) return c; n=n.parentElement; } return 'rgb(255,255,255)'; };
     const pior=[]; document.querySelectorAll('.gl .sub, .gl .small, .chip, .tile span, .lbl, .lst .tx, .porto .d, .porto .t, b').forEach(e=>{ if(!e.offsetParent||!e.innerText.trim()) return; pior.push([cs(e).color, bg(e.closest('.gl')||e), e.innerText.slice(0,24)]); }); return pior.slice(0,400); });
   t(`${nome}/${tema||'escuro'}/${papel}: sem rolagem lateral e sem erro`, !(await lateral(p)) && !errs.length, [await lateral(p),errs]);
   if(prints) await p.screenshot({path:`${prints}/${nome}_${tema||'escuro'}_${papel}.png`,fullPage:true});
   const ct=await contraste(p); t(`${nome}/${tema||'escuro'}/${papel}: contraste do texto (${ct.n} trechos medidos no pixel real) ≥ 4,5:1`, ct.bad.length===0, ct.bad.slice(0,6));
   await ctx.close(); }
 await b.close(); console.log(ok?'TUDO OK':'HÁ FALHAS'); })();
