// 🌞 Meta do Digital no Oceano com o tema claro (mare-metas-dev.js): o cartão herda a superfície CLARA da página (--slate-rgb) em vez do fundo escuro de reserva,
// e o texto escuro tem contraste legível sobre ela. No escuro/entardecer segue escuro. Roda:  python3 -m http.server 8941 &   node docs/arezzo/testes/test_metas_tema_claro.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake=require('./fakefb.js'); const S=require('./seed_metas.js');
const lum=c=>{ const m=(c.match(/[\d.]+/g)||[]).map(Number); const f=v=>{ v/=255; return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4); }; return .2126*f(m[0])+.7152*f(m[1])+.0722*f(m[2]); };
const contraste=(a,b)=>{ const x=lum(a),y=lum(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']}); let ok=true;
 const t=(n,c,d)=>{ if(!c) ok=false; console.log((c?'✅ ':'❌ ')+n+(c?'':' → '+JSON.stringify(d).slice(0,300))); };
 for(const th of ['light','dark','sunset']){ const ctx=await b.newContext({viewport:{width:1280,height:900}}); const sd=S.seed('adm'); Object.values(sd.kanban.metas_digital_dev).forEach(m=>{ m.oceano=true; }); await fake.install(ctx,sd);
   const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
   await p.goto('http://localhost:8941/oceano-dev.html'); await p.waitForFunction(()=>!!window.__authCb); await p.evaluate(x=>window.__authCb(x),S.U('eve','Eve Souza')); await p.waitForTimeout(2500);
   await p.evaluate(x=>{ if(x==='dark') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme',x); },th); await p.keyboard.press('Escape');
   await p.evaluate(()=>{ document.querySelectorAll('.mm-fish-ov').forEach(e=>e.remove()); }); await p.waitForTimeout(500);
   const r=await p.evaluate(()=>{ const cs=x=>getComputedStyle(x); const h=document.querySelector('#col-meta .mm-hero'), c=document.querySelector('#col-meta .mm-card'), k=document.querySelector('#col-meta .mm-kpi b'), tt=document.querySelector('#col-meta .mm-ttl');
     const bg=e=>{ const m=cs(e).backgroundImage.match(/rgba?\([^)]*\)/); return m?m[0]:cs(e).backgroundColor; };
     return {hero:h&&bg(h), card:c&&cs(c).backgroundColor, tit:tt&&cs(tt).color, kpi:k&&cs(k).color, btn:cs(document.querySelector('#col-meta .mm-btn:not(.p)')).backgroundColor}; });
   if(th==='light'){ const lumHero=lum(r.hero), lumCard=lum(r.card);
     t('claro: fundo do hero é claro (não o azul-marinho de reserva)', lumHero>.6, r); t('claro: fundo do card é claro', lumCard>.6, r);
     t('claro: título legível sobre o hero (contraste ≥ 4,5)', contraste(r.tit,r.hero)>=4.5, [r.tit,r.hero]); t('claro: botão secundário claro', lum(r.btn)>.6, r.btn);
     // tooltip do gráfico também acompanha o tema
     await p.evaluate(()=>{ const w=document.querySelector('#col-meta .mm-chart-wrap'); if(w){ const r=w.getBoundingClientRect(); w.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2})); } });
     const tip=await p.evaluate(()=>{ const e=document.querySelector('.mm-tip'); return e?getComputedStyle(e).backgroundColor:null; }); if(tip) t('claro: tooltip do gráfico claro', lum(tip)>.6, tip);
   } else { t(th+': hero segue escuro', lum(r.hero)<.15, r); t(th+': título claro sobre o escuro', contraste(r.tit,r.hero)>=4.5, [r.tit,r.hero]); }
   t(th+': sem erro de JS', !errs.length, errs); await ctx.close(); }
 await b.close(); console.log(ok?'TUDO OK':'HÁ FALHAS'); })();
