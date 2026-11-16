// Auditoria de tema (claro / vice city) no Radar e no Painel: contraste de texto, cor fixa, rolagem lateral, erros de JS, prints.
// Uso: servidor estático na raiz, porta 8941; node docs/arezzo/testes/auditoria_temas.js.
// OUT=/tmp/auditoria guarda PNG/resultado.json. BASE_URL, CHROME e PLAYWRIGHT_MODULE são configuráveis.
// BASELINE_SHA=<commit> mede os HTMLs da main por route, sem trocar arquivos. SELFTEST=1 testa o medidor.
// O padrão reprova falha nova; exceções são nominadas contra antes.json. Pixels do escuro exigem o mesmo Chromium/SO da referência.
const os = require('os');
const PW=process.env.PLAYWRIGHT_MODULE||(()=>{try{return require.resolve('playwright');}catch(e){return require('path').join(os.homedir(),'hering-tools/playwright/node_modules/playwright');}})();
const { chromium } = require(PW);
const fs = require('fs'), path = require('path');
const T = __dirname + '/';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8941';
const cr = path.join(os.homedir(),'hering-tools/chrome');
const macChrome=fs.existsSync(cr)&&fs.readdirSync(cr).find(n=>n.startsWith('mac_arm-'));
const CHROME=process.env.CHROME||(macChrome?path.join(cr,macChrome,'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'):undefined);
const fake = require(T + 'fakefb.js');
// A fixture também fica fixa no Node; não depende do dia em que o teste for repetido.
class DataFixture extends Date{constructor(...a){super(...(a.length?a:['2026-11-16T12:00:00Z']));}static now(){return Date.parse('2026-11-16T12:00:00Z');}}
const seedModule={exports:{}};require('vm').runInNewContext(fs.readFileSync(T+'seed_okr_dashboard.js','utf8'),{Date:DataFixture,module:seedModule});
const {objs,snaps}=seedModule.exports;
const OUT = process.env.OUT || '/tmp/auditoria'; fs.mkdirSync(OUT, { recursive: true });
const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana ADM', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const jc = x => JSON.parse(JSON.stringify(x));
const seedOkr = () => ({ kanban: { okr: { objetivos: jc(objs), marcos: {}, tags: {}, reuniao_notas: {}, snapshots: jc(snaps) }, usuarios: { ana: { uid: 'ana', nome: 'Ana', email: 'ana@ciahering.com.br', inscrito: true, init: 'AA', role: 'adm', squads: { dados: true } } }, usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana', init: 'AA' } }, config: { adm_emails: ['ana@ciahering.com.br'] } } });
const fluxoLines = fs.readFileSync(T + 'test_painel_fluxo.js', 'utf8').split('\n');
const sdSrc = fluxoLines[6]; const seedPainel = new Function(sdSrc + '; return sd();')();
seedPainel.kanban.usuarios.pessoa2={uid:'pessoa2',nome:'Pessoa de Teste',email:'pessoa2@ciahering.com.br',init:'PT',inscrito:true,role:'membro',squads:{dados:true}};
const setupPainel = fluxoLines.slice(14, 27).join('\n');   // await p.evaluate(()=>{ ...squads/cards... });

// ── varredura dentro da página ──
// Coleta a geometria real. Só texto alfanumérico: emoji isolado não tem a cor CSS do glyph.
// A razão usa pixels do fundo renderizado SEM glyphs (inclui gradientes/vidro), não uma cor presumida.
const SCAN = () => {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const paint=canvas.getContext('2d',{willReadFrequently:true}),cache=new Map();
  const rgba=color=>{if(!cache.has(color)){paint.clearRect(0,0,1,1);paint.fillStyle=color;paint.fillRect(0,0,1,1);const x=[...paint.getImageData(0,0,1,1).data];cache.set(color,[x[0],x[1],x[2],x[3]/255]);}return cache.get(color);};
  const desc=el=>{let s=el.tagName.toLowerCase();if(el.id)s+='#'+el.id;else if(typeof el.className==='string'&&el.className.trim())s+='.'+el.className.trim().split(/\s+/).slice(0,3).join('.');return s;};
  const visible=(el,rect)=>{let r={left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom},op=1;
    for(let n=el;n;n=n.parentElement){const cs=getComputedStyle(n);if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0)return null;op*=+cs.opacity;
      if(n!==el&&n!==document.body&&n!==document.documentElement){const b=n.getBoundingClientRect();if(/hidden|auto|scroll|clip/.test(cs.overflowX)){r.left=Math.max(r.left,b.left);r.right=Math.min(r.right,b.right);}if(/hidden|auto|scroll|clip/.test(cs.overflowY)){r.top=Math.max(r.top,b.top);r.bottom=Math.min(r.bottom,b.bottom);}}}
    r.left=Math.max(0,r.left);r.top=Math.max(0,r.top);r.right=Math.min(innerWidth,r.right);r.bottom=Math.min(innerHeight,r.bottom);
    if(r.right-r.left<2||r.bottom-r.top<2)return null;return {r,op};};
  const textos=[],seen=new Set();let serial=0;
  const bloqueios=[...document.querySelectorAll('body>div[style],#dev-banner,.toast')].filter(e=>{const c=getComputedStyle(e);return c.position==='fixed'&&c.pointerEvents==='none'&&+c.zIndex>100&&+c.opacity>0&&c.display!=='none';}).map(e=>({el:e,r:e.getBoundingClientRect()}));
  function add(el,txt,rect,color,kind='texto'){
    if(!/[\p{L}\p{N}]/u.test(txt))return;const v=visible(el,rect);if(!v)return;
    const cs=getComputedStyle(el),px=parseFloat(cs.fontSize),min=px>=24||(px>=18.66&&+cs.fontWeight>=700)?3:4.5;
    const key=serial+'|'+Math.round(v.r.top);if(seen.has(key))return;seen.add(key);
    const samples=[];for(const fx of [.2,.5,.8])for(const fy of [.35,.65]){const x=v.r.left+(v.r.right-v.r.left)*fx,y=v.r.top+(v.r.bottom-v.r.top)*fy,h=document.elementFromPoint(x,y);if(bloqueios.some(b=>b.el!==el&&!b.el.contains(el)&&x>=b.r.left&&x<=b.r.right&&y>=b.r.top&&y<=b.r.bottom))continue;if(cs.pointerEvents==='none'||(h&&(el===h||el.contains(h)||(h.namespaceURI.includes('svg')&&h.contains(el)))))samples.push([x,y]);}if(!samples.length)return;
    textos.push({source:serial,samples,t:txt.slice(0,100),el:desc(el),r:v.r,fg:color||rgba(el.namespaceURI.includes('svg')&&cs.fill!=='none'?cs.fill:cs.color),op:v.op,px,min,kind,disabled:!!el.closest(':disabled,[aria-disabled="true"],.nc-sw.dis'),style:el.getAttribute('style')||'',parent:desc(el.parentElement),ancestors:[...function*(x){for(let n=x;n&&n!==document.body;n=n.parentElement)yield desc(n);}(el)].slice(0,7)});
  }
  const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
  while(n=walk.nextNode()){serial++;const txt=n.nodeValue.replace(/\s+/g,' ').trim(),el=n.parentElement;if(!el||/^(SCRIPT|STYLE|NOSCRIPT|OPTION)$/.test(el.tagName)||!txt)continue;
    const range=document.createRange();range.selectNodeContents(n);for(const rect of range.getClientRects())add(el,txt,rect);}
  document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea,select').forEach(el=>{
    serial++;
    if(el.type==='file'){const b=el.getBoundingClientRect(),btn=getComputedStyle(el,'::file-selector-button');add(el,'[arquivo] botão nativo',{left:b.left+12,right:Math.min(b.right-5,b.left+58),top:b.top+4,bottom:b.bottom-4},rgba(btn.color).slice(),'file-button');add(el,'[arquivo] nome selecionado',{left:b.left+140,right:b.right-5,top:b.top+4,bottom:b.bottom-4},rgba(getComputedStyle(el).color).slice(),'file-name');return;}
    const placeholder=!el.value&&el.placeholder,cs=getComputedStyle(el,placeholder?'::placeholder':null),c=rgba(cs.color).slice();if(placeholder)c[3]*=Number(cs.opacity);const b=el.getBoundingClientRect();add(el,'[campo] '+(el.value||el.placeholder||el.id),{left:b.left+5,right:b.right-18,top:b.top+3,bottom:b.bottom-3},c,placeholder?'placeholder':'campo');});
  const fixas=[...document.querySelectorAll('[style]')].filter(el=>visible(el,el.getBoundingClientRect())&&/(?:^|;)\s*(?:color|background(?:-color)?)\s*:\s*(#fff(?:fff)?\b|#000(?:000)?\b|white|black)/i.test(el.getAttribute('style')||'')).map(el=>({el:desc(el),st:el.getAttribute('style'),t:el.textContent.trim().slice(0,50)}));
  return {textos,fixas,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1};
};
const { PNG }=require(path.join(path.dirname(require.resolve('playwright-core',{paths:[path.dirname(require.resolve(PW))]})),'lib/utilsBundle.js'));
const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
async function medir(p){
  const dados=await p.evaluate(SCAN);
  const hide=await p.addStyleTag({content:'*{ -webkit-text-fill-color:transparent!important;text-shadow:none!important;} svg text{fill:transparent!important;} input::placeholder,textarea::placeholder{-webkit-text-fill-color:transparent!important;}'});
  await p.waitForTimeout(100);
  let png;try{png=PNG.sync.read(await p.screenshot({animations:'disabled'}));}finally{await hide.evaluate(e=>e.remove());await p.waitForTimeout(100);}
  const baixo=[];
  for(const x of dados.textos){let worst=22,bgWorst;
    // Vários pontos na caixa do texto, longe das bordas. Usa o pior fundo REAL desses pontos.
    for(const [sx,sy] of x.samples){const xx=Math.max(0,Math.min(png.width-1,Math.floor(sx))),yy=Math.max(0,Math.min(png.height-1,Math.floor(sy)));const off=(yy*png.width+xx)*4,bg=[...png.data.slice(off,off+3)],a=x.fg[3]*x.op,fg=x.fg.slice(0,3).map((v,i)=>v*a+bg[i]*(1-a)),l1=lum(fg),l2=lum(bg),ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);if(ratio<worst){worst=ratio;bgWorst=bg;}}
    if(worst<x.min)baixo.push({...x,r:+worst.toFixed(3),bg:bgWorst});
  }
  return {baixo,fixas:dados.fixas,overflow:dados.overflow,total:dados.textos.length};
}

async function medirTela(p){
  await p.evaluate(()=>{document.querySelectorAll('.toast.show').forEach(e=>e.classList.remove('show'));window.scrollTo(0,0);});
  const rows=new Map(),fixas=new Map();let overflow=false,total=0;
  const max=await p.evaluate(()=>Math.max(0,document.documentElement.scrollHeight-innerHeight));
  const step=await p.evaluate(()=>Math.max(300,innerHeight-150));
  const stops=[];for(let y=0;y<max;y+=step)stops.push(y);stops.push(max);
  for(const y of stops){await p.evaluate(y=>window.scrollTo(0,y),y);await p.waitForTimeout(60);const r=await medir(p);overflow ||= r.overflow;total+=r.total;
    for(const x of r.baixo){const key=x.source+'|'+x.el+'|'+x.t;const old=rows.get(key);if(!old||x.r<old.r)rows.set(key,x);}
    r.fixas.forEach(x=>fixas.set(x.el+'|'+x.t,x));}
  await p.evaluate(()=>window.scrollTo(0,0));
  return {baixo:[...rows.values()],fixas:[...fixas.values()],overflow,total};
}

// Exceções nominadas e com piso de contraste: novos casos continuam reprovando.
const refFile=process.env.REFERENCIA||path.join(__dirname,'../../capturas/tema_claro/antes.json');
const referencia=!process.env.BASELINE_SHA&&fs.existsSync(refFile)?JSON.parse(fs.readFileSync(refFile,'utf8')):{};
const assinatura=x=>x.el+'|'+(x.el==='div.version'?'versão':x.t);
function motivoExcecao(key,x){
  if(x.disabled)return 'Controle inativo: exceção da WCAG 1.4.3; estado desabilitado permanece identificável.';
  const anterior=(referencia[key]?.baixo||[]).find(a=>assinatura(a)===assinatura(x)&&x.r>=a.r-.025);
  if(!anterior)return '';
  if(key.endsWith('/dark'))return 'Escuro preexistente, fora da correção de cor: piso do antes preservado; capturas comparadas.';
  if(x.ancestors.some(a=>/\.mpl(?:[. -]|$)|\.mpl-/.test(a)))return 'mare-plantao-dev.js: módulo compartilhado reservado; contraste não piorou. Requer correção própria.';
  if(x.ancestors.some(a=>/\.mn-/.test(a)))return 'mare-notif-dev.js: módulo compartilhado reservado; contraste não piorou. Requer correção própria.';
  if(x.ancestors.some(a=>/\.mgc-/.test(a)))return 'mare-gcal-dev.js: módulo compartilhado reservado; contraste não piorou. Requer correção própria.';
  return '';
}
async function autoTeste(b){
  const p=await b.newPage({viewport:{width:800,height:600}});
  await p.setContent(`<style>body{margin:0;background:white;color:black;font:16px Arial}p{margin:12px 24px}#coberto{position:absolute;top:0;margin:0;color:#aaa}.alto{height:1300px}#grad{background:linear-gradient(90deg,white,black);color:white;width:300px}input::placeholder{color:#aaa;opacity:1}</style>
    <div style="position:fixed;top:0;left:0;right:0;height:30px;z-index:999;pointer-events:none;background:black;color:white">Banner legível</div>
    <p id="coberto">Oculto pelo banner</p><div style="height:40px"></div><p id="bom">Preto no branco</p><p id="ruim" style="color:#aaa">Cinza ilegível</p>
    <p id="grad">Gradiente exige medição real</p><p id="emoji">📅</p><p id="grande" style="font-size:24px;color:#777">Texto grande</p><p id="limite" style="font-size:18px;font-weight:700;color:#777">Pequeno negrito</p>
    <input id="campo" placeholder="Placeholder ilegível"><svg width="200" height="40"><text id="svg-ruim" x="10" y="25" fill="#aaa" style="color:black">SVG usa fill</text></svg>
    <div class="alto"></div><p id="longe" style="color:#aaa">Falha depois de rolar</p>`);
  const r=await medirTela(p),ids=new Set(r.baixo.map(x=>x.el));
  for(const id of ['p#ruim','p#grad','p#limite','input#campo','text#svg-ruim','p#longe'])require('assert').ok(ids.has(id),'detectar '+id);
  for(const id of ['p#bom','p#grande','p#emoji','p#coberto'])require('assert').ok(!ids.has(id),'não acusar '+id);
  console.log('✅ Autoteste: limiar normal/grande, placeholder, fill SVG, gradiente, rolagem, emoji e oclusão (10 verificações).');
  await p.close();
}

(async () => {
  const timer=setTimeout(()=>{console.error('Auditoria excedeu 15 min.');process.exit(2);},900000);timer.unref();
  if(!process.env.SELFTEST){const preflight=await fetch(BASE+'/mare-notif-dev.js');if(!preflight.ok)throw new Error('Servidor local indisponível ou raiz incorreta.');}
  const b = await chromium.launch({ executablePath: CHROME });
  try {
  await autoTeste(b);
  if(process.env.SELFTEST){await b.close();return;}
  const CFG = [
    { nome: 'radar', url: BASE+'/okr-dev.html', seed: ()=>{const d=seedOkr();d.kanban.usuarios.ana.dicas={off:{radar:true,painel:true}};return d;}, setup: async p => { await p.evaluate(() => { _okrEntrarTorre('digital'); }); await p.waitForTimeout(800); },
      telas: [['objetivos', p => p.evaluate(() => _okrSetView('objetivos'))], ['historico', p => p.evaluate(() => _okrSetView('historico'))], ['calendario', p => p.evaluate(() => _okrSetView('calendario'))], ['notas', p => p.evaluate(() => _okrSetView('notas'))], ['cards', p => p.evaluate(() => _okrSetView('cards'))], ['datastudio', p => p.evaluate(() => _okrSetView('datastudio'))]] },
    { nome: 'painel', url: BASE+'/painel-dev.html', seed: ()=>{const d=jc(seedPainel);d.kanban.usuarios.ana.dicas={off:{radar:true,painel:true}};return d;}, setup: async p => { await new Function('p', 'return (async()=>{' + setupPainel + '})()')(p); },
      telas: ['visao', 'fluxo', 'timeline', 'pessoas', 'dados', 'monitor', 'notifs', 'status', 'agentes'].map(t => [t, p => p.evaluate(x => swPtab(x), t)]) },
  ];
  CFG.forEach(c=>{
    if(c.nome==='painel')c.telas.push(['pessoas_ativo',async p=>{await p.evaluate(()=>swPtab('pessoas'));await p.waitForTimeout(250);await p.locator('#lemp-text').fill('Aviso fictício para medir contraste, sem publicar.');await p.locator('#kudosp-text').fill('Reconhecimento fictício, sem enviar.');await p.selectOption('#kudosp-para','pessoa2');}]);
    c.telas.push(['toast',p=>p.evaluate(()=>{window.scrollTo(0,0);showToast('Aviso de teste: confira o contraste.');})]);
  });
  const resultado = process.env.RESUME && fs.existsSync(path.join(OUT,'resultado.json')) ? JSON.parse(fs.readFileSync(path.join(OUT,'resultado.json'),'utf8')) : {};
  for (const cfg of CFG.filter(c=>!process.env.APP||c.nome===process.env.APP)) for (const tema of (process.env.TEMAS||'dark,light,vice').split(',')) for (const w of (process.env.LARGURAS||'1280,390').split(',').map(Number)) {
    if(cfg.telas.every(([nome])=>resultado[`${cfg.nome}/${nome}/${w}/${tema}`])) continue;
    if(process.env.TELAS)cfg.telas=cfg.telas.filter(([n])=>process.env.TELAS.split(',').includes(n));
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, reducedMotion:'reduce',timezoneId:'America/Bahia' });
    await ctx.addInitScript(t => { let aleatorio=1;Math.random=()=>{aleatorio=aleatorio*16807%2147483647;return (aleatorio-1)/2147483646;};try { localStorage.setItem('mare_theme', t); localStorage.setItem('mare_dicas_ana',JSON.stringify({off:{radar:true,painel:true}})); localStorage.setItem('fish_bg_off', '1'); localStorage.setItem('mare_theme_auto', '0'); } catch (e) { } }, tema);
    await fake.install(ctx, cfg.seed());
    const versaoFixture=process.env.BASELINE_SHA ? JSON.parse(require('child_process').execFileSync('git',['show',process.env.BASELINE_SHA+':version.json'],{encoding:'utf8'})) : JSON.parse(fs.readFileSync(path.join(__dirname,'../../../version.json'),'utf8'));
    await ctx.route('**/version.json*',r=>r.fulfill({json:versaoFixture}));
    await ctx.route('https://www.githubstatus.com/**',r=>r.fulfill({json:{status:{indicator:'minor'},components:[{name:'Pages',status:'operational'}],incidents:[{id:'teste',name:'Incidente de teste',status:'investigating',impact:'minor',updated_at:'2026-11-16T11:00:00Z',incident_updates:[{body:'Investigação de teste em andamento.'}]}]}}));
    await ctx.route('https://status.firebase.google.com/**',r=>r.fulfill({json:[]}));
    if(process.env.BASELINE_SHA)for(const file of ['painel-dev.html','okr-dev.html']){const body=require('child_process').execFileSync('git',['show',process.env.BASELINE_SHA+':'+file],{maxBuffer:12*1024*1024});await ctx.route('**/'+file,r=>r.fulfill({contentType:'text/html',body}));}
    const p = await ctx.newPage(); await p.clock.setFixedTime(new Date('2026-11-16T12:00:00Z')); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto(cfg.url); await p.waitForFunction(() => !!window.__authCb && !!window.MareNotif,{},{timeout:10000}); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(2200);
    try { await cfg.setup(p); } catch (e) { errs.push('setup: ' + e.message); }
    await p.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;}'});
    const tAplicado = await p.evaluate(() => document.documentElement.getAttribute('data-theme') || 'dark');
    for (const [nome, fn] of cfg.telas) {
      if(resultado[`${cfg.nome}/${nome}/${w}/${tema}`]) continue;
      try { await fn(p); await p.waitForTimeout(nome==='toast'?100:700); } catch (e) { errs.push(nome + ': ' + e.message); continue; }
      const r = nome==='toast' ? await medir(p) : await medirTela(p);
      if(!process.env.BASELINE_SHA&&['light','vice'].includes(tema)&&['objetivos','visao'].includes(nome)){const roteiro=await p.evaluate(fs.readFileSync(path.join(__dirname,'../../capturas/tema_claro/console_temas.js'),'utf8'));r.roteiroADM=roteiro; if(roteiro.some(x=>x.resultado!=='✅'))errs.push('Roteiro ADM reprovou em '+nome);}
      const key = `${cfg.nome}/${nome}/${w}/${tema}`;
      r.baixo=r.baixo.map(x=>({...x,excecao:motivoExcecao(key,x)}));
      resultado[key] = { ...r, tema: tAplicado };
      fs.writeFileSync(path.join(OUT,'resultado.json'),JSON.stringify(resultado,null,1));
      console.log(key+': '+r.baixo.length+' textos abaixo do mínimo ('+r.baixo.filter(x=>!x.excecao).length+' falhas, '+r.baixo.filter(x=>x.excecao).length+' exceções); overflow='+r.overflow);
      r.baixo.forEach(x=>console.log('  '+JSON.stringify(x)));
      if(r.fixas.length) console.log('  Cores fixas: '+JSON.stringify(r.fixas));
      await p.evaluate(()=>document.querySelectorAll('#firebase-status-pill-txt,#st-fb-rtdb-meta,#st-latencia').forEach(e=>{e.textContent=e.textContent.replace(/\b\d+ ms\b/g,'0 ms');}));
      await p.waitForTimeout(100); // Deixa o compositor repintar os controles com backdrop-filter após restaurar os glyphs.
      // Neutraliza só valores dinâmicos da fixture; contraste foi medido antes, sem máscaras.
      const captura=await p.screenshot({ path: path.join(OUT, `${cfg.nome}_${nome}_${w}_${tema}.png`), animations:'disabled', mask:['.version','#firebase-status-pill-txt','#st-latencia','#st-fb-rtdb-meta'].map(x=>p.locator(x)),maskColor:'#808080' });
      r.capturaHash=require('crypto').createHash('sha256').update(PNG.sync.read(captura).data).digest('hex');
      if(tema==='dark'&&referencia[key]?.capturaHash){r.escuroIgual=r.capturaHash===referencia[key].capturaHash;console.log('  Escuro '+(r.escuroIgual?'idêntico':'ALTERADO')+' (pixels; versão/latência neutralizadas).');}
      Object.assign(resultado[key],r);
      fs.writeFileSync(path.join(OUT,'resultado.json'),JSON.stringify(resultado,null,1));
    }
    resultado[`${cfg.nome}/ERROS/${w}/${tema}`] = { errs };
    if(errs.length) console.log('ERROS '+cfg.nome+'/'+tema+'/'+w+': '+JSON.stringify(errs));
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'resultado.json'), JSON.stringify(resultado, null, 1));
  await b.close();
  const falhas=Object.entries(resultado).reduce((s,[k,r])=>s+(r.baixo||[]).filter(x=>!x.excecao).length+(r.errs||[]).length+(r.overflow?1:0)+(r.escuroIgual===false?1:0),0);
  console.log('RESUMO: '+Object.keys(resultado).length+' registros; '+falhas+' falhas não justificadas (contraste/JS/overflow).');
  process.exitCode=falhas?1:0;
  } finally {await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
