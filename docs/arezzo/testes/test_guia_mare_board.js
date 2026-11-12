// Programa de boas-vindas: boot real + Firebase falso, sem acessar banco real.
// Na raiz: python3 -m http.server 8957
// Depois: node docs/arezzo/testes/test_guia_mare_board.js
// O maestro executa o navegador; neste contrato o autor confere só node --check.
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const chromeRoot = path.join(home, 'hering-tools/chrome');
const chrome = process.env.CHROME || path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n=>n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8957';
const U = {uid:'eve',email:'eve@ciahering.com.br',displayName:'Eve',photoURL:'',providerData:[{providerId:'google.com'}]};
const seed = ()=>({kanban:{usuarios:{eve:{uid:'eve',nome:'Eve',email:U.email,init:'EV',role:'membro',inscrito:true,squads:{dev:true,site:true}}},squads_meta:{dev:{label:'Squad Dev'},site:{label:'Squad Site'}},squads:{dev:{dados:{columns:[{id:'doing',name:'Fazendo'}],cards_index:{c1:'k0',c2:'k1'},cards:{k0:{id:'c1',title:'Banner',col:'doing'},k1:{id:'c2',title:'Relatório',col:'doing'}}}},site:{dados:{columns:[{id:'doing',name:'Fazendo'}],cards_index:{c3:'k0'},cards:{k0:{id:'c3',title:'Página',col:'doing'}}}}}}});
const PERFIL='kanban/usuarios/eve/onboarding_mare';
const IDS=['board','card-criar','card-mover','card-funcoes','comentar','notificacoes','meu-dia','sonar','agente'];
const iso=v=>typeof v==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v));
let assertions=0, failures=0;
const t=(name,cond,detail)=>{assertions++;if(!cond)failures++;console.log((cond?'✅ ':'❌ ')+name+(cond?'':' → '+JSON.stringify(detail)));};
const perfil=p=>p.evaluate(async key=>(await window._get(window._ref(window._db,key))).val(),PERFIL);
const aberto=(p,id)=>p.locator('#'+id).evaluate(e=>e.classList.contains('open'));
const esperar=async(p,fn,timeout=3000)=>{try{await p.waitForFunction(fn,null,{timeout});return true;}catch(e){if(e.name==='TimeoutError')return false;throw e;}};
(async()=>{
  const browser=await chromium.launch({executablePath:chrome,headless:true});
  const sessions=[];
  const session=async(squad='dev',query='',mobile=false,welcome=false)=>{
    const ctx=await browser.newContext({viewport:{width:mobile?390:1280,height:mobile?844:900},isMobile:mobile,hasTouch:mobile});
    const s={ctx,errors:[],label:squad+query+(mobile?' 390':' 1280')};sessions.push(s);
    await fake.install(ctx,seed());
    await ctx.addInitScript(w=>{localStorage.removeItem('guia_mare_prog');localStorage.removeItem('guia_mare_prog_espelho');if(w)localStorage.removeItem('bvmd_eve');else localStorage.setItem('bvmd_eve','1');},welcome);
    const p=s.p=await ctx.newPage();p.setDefaultTimeout(10000);
    p.on('pageerror',e=>s.errors.push(e.message));
    p.on('dialog',d=>d.dismiss());
    await p.goto(base+'/kanban-dev.html?squad='+squad+query);
    await p.waitForFunction(()=>!!window.__authCb && !!window._get && typeof _tourMareIniciar==='function');
    await p.evaluate(u=>window.__authCb(u),U);
    await p.waitForFunction(()=>window._currentUser?.uid==='eve' && document.querySelectorAll('#board .card-title').length>0);
    await p.evaluate(()=>_guiaMareCarregar());
    return p;
  };
  const caso=async(nome,fn)=>{try{await fn();}catch(e){t(nome,false,e.stack||e.message);}};
  try{
    await caso('boas-vindas executável',async()=>{
      const p=await session('dev','',false,true);
      t('primeiro acesso abre boas-vindas',await esperar(p,()=>document.getElementById('boasvindas-ov').classList.contains('open')));
      for(const name of ['⚡ Resumido','📚 Completo','🎯 Tour','Agora não'])
        t('boas-vindas oferece '+name,await p.locator('#boasvindas-ov').getByRole('button',{name}).isVisible(),name);
      await p.evaluate(u=>{closeBoasVindas();document.getElementById('insc-ov').classList.add('open');_showBoasVindas(u);},U);
      t('inscrição impede abrir boas-vindas',!await aberto(p,'boasvindas-ov'));
      // Passa uma tentativa inteira ainda com a inscrição aberta.
      await p.waitForTimeout(1100);
      t('boas-vindas continua esperando inscrição',!await aberto(p,'boasvindas-ov'));
      await p.evaluate(()=>document.getElementById('insc-ov').classList.remove('open'));
      t('fecha inscrição: boas-vindas abre em até 2 s',await esperar(p,()=>document.getElementById('boasvindas-ov').classList.contains('open'),2100));
    });
    for(const squad of ['dev','site']) await caso('URL do guia '+squad,async()=>{
      const p=await session(squad);
      const calls=await p.evaluate(()=>{const calls=[],original=window.open;try{window.open=(...args)=>{calls.push(args);return null;};abrirGuiaMare('resumido');abrirGuiaMare();}finally{window.open=original;}return calls;});
      const prefix='guia-mare.html?squad='+squad+'&agente='+(squad==='dev'?'1':'0')+'&volta=kanban-dev.html';
      t(squad+': guia resumido com squad, agente e volta',calls[0]?.[0]===prefix+'&modo=resumido',calls);
      t(squad+': guia sem modo abre escolha',calls[1]?.[0]===prefix && !calls[1][0].includes('modo='),calls);
      t(squad+': guia abre nova aba com noopener',calls.every(c=>c[1]==='_blank' && c[2]==='noopener'),calls);
    });
    for(const mobile of [false,true]) for(const squad of ['dev','site']) await caso('tour '+squad+(mobile?' 390':''),async()=>{
      const p=await session(squad,'',mobile), n=squad==='dev'?9:8, label=squad+(mobile?' 390':' 1280');
      await p.evaluate(()=>_tourMareIniciar('resumido'));
      t(label+': tour tem '+n+' passos',(await p.locator('#tourm-bub .tourm-cnt').textContent())==='1 de '+n);
      t(label+': destaque e balão existem',await p.locator('#tourm-ring').count()===1 && await p.locator('#tourm-bub').count()===1);
      for(let i=0;i<n;i++){
        const bounds=await p.locator('#tourm-bub').evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth};});
        t(label+': balão cabe no passo '+IDS[i],bounds.left>=0 && bounds.right<=bounds.width,bounds);
        await p.locator('#tourm-bub').getByRole('button',{name:i===n-1?'Concluir ✓':'Próximo →',exact:true}).click();
        if(i===0)t(label+': Próximo avança',(await p.locator('#tourm-bub .tourm-cnt').textContent())==='2 de '+n);
      }
      const saved=await perfil(p);
      for(const id of IDS.slice(0,n))t(label+': conclusão grava ISO em passos/'+id,iso(saved?.passos?.[id]),saved);
      t(label+': tour inteiro grava tour-resumido',iso(saved?.passos?.['tour-resumido']),saved);
      t(label+': tour não conclui guia resumido',!Object.prototype.hasOwnProperty.call(saved||{},'resumido'),saved);
      t(label+': conclusão remove ring e balão',await p.locator('#tourm-ring,#tourm-bub').count()===0);
      await p.evaluate(()=>_tourMareIniciar('resumido'));await p.keyboard.press('Escape');
      t(label+': Esc remove ring e balão',await p.locator('#tourm-ring,#tourm-bub').count()===0);
    });
    await caso('sincronização executável',async()=>{
      const p=await session();
      await p.evaluate(async()=>{await _guiaMareCarregar();localStorage.setItem('guia_mare_prog',JSON.stringify({passos:{board:'2026-11-11T12:00:00.000Z','../x':'2026-11-11T12:00:00.000Z',sonar:'<img>'},resumido:'2026-11-11T12:05:00.000Z'}));await _guiaMareSync();});
      const saved=await perfil(p), local=await p.evaluate(()=>({pending:localStorage.getItem('guia_mare_prog'),mirror:JSON.parse(localStorage.getItem('guia_mare_prog_espelho'))}));
      t('sincronização grava board e resumido',saved?.passos?.board==='2026-11-11T12:00:00.000Z' && saved?.resumido==='2026-11-11T12:05:00.000Z',saved);
      t('sincronização rejeita ../x e sonar inválido',!saved?.passos?.['../x'] && !saved?.passos?.sonar && !saved?.passos?.['..'],saved);
      const invalidWrites=await p.evaluate(()=>window.__log.filter(([op,key])=>['set','update'].includes(op) && (key.includes('../x') || key.endsWith('/sonar'))));
      t('não há escrita direta de passos inválidos',invalidWrites.length===0,invalidWrites);
      t('sincronização apaga chave local',local.pending===null,local);
      t('espelho reflete perfil',JSON.stringify(local.mirror)===JSON.stringify(saved),{local,saved});
    });
    await caso('retry após gravação negada',async()=>{
      const p=await session();
      const denied=await p.evaluate(async()=>{
        const raw=JSON.stringify({passos:{board:'2026-11-12T12:00:00.000Z'},resumido:'2026-11-12T12:05:00.000Z'});
        localStorage.setItem('guia_mare_prog',raw);
        window.__denySet=key=>key.includes('/onboarding_mare');
        await _guiaMareSync();
        return {raw,pending:localStorage.getItem('guia_mare_prog'),cache:_guiaMarePerfil,mirror:JSON.parse(localStorage.getItem('guia_mare_prog_espelho'))};
      });
      t('falha mantém progresso local para retry',denied.pending===denied.raw,denied);
      t('falha não confirma cache nem espelho',!denied.cache?.passos?.board && !denied.cache?.resumido && !denied.mirror?.passos?.board && !denied.mirror?.resumido,denied);
      t('falha não gravou perfil',!(await perfil(p))?.passos?.board);
      await p.evaluate(async()=>{window.__denySet=null;await _guiaMareSync();});
      const saved=await perfil(p);
      t('retry grava passo e conclusão no perfil',saved?.passos?.board==='2026-11-12T12:00:00.000Z' && saved?.resumido==='2026-11-12T12:05:00.000Z',saved);
      t('só após retry confirmado apaga local',await p.evaluate(()=>localStorage.getItem('guia_mare_prog')===null));
      t('retry atualiza espelho',await p.evaluate(()=>JSON.stringify(_guiaMarePerfil)===localStorage.getItem('guia_mare_prog_espelho')));
    });
    await caso('setas em campos editáveis',async()=>{
      const p=await session();
      await p.evaluate(()=>_tourMareIniciar('resumido'));
      for(const tag of ['input','textarea','select','contenteditable']){
        await p.evaluate(tag=>{
          const el=document.createElement(tag==='contenteditable'?'div':tag);
          if(tag==='contenteditable'){el.contentEditable='true';el.innerHTML='<span>Texto</span>';}
          document.body.append(el);
          const target=el.firstElementChild||el;
          target.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
          target.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));
          el.remove();
        },tag);
        t(tag+': setas mantêm primeiro passo',(await p.locator('#tourm-bub .tourm-cnt').textContent())==='1 de 9');
        t(tag+': setas não gravam passo',!(await perfil(p))?.passos?.board);
      }
      await p.evaluate(()=>document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));
      t('seta fora de campo avança',(await p.locator('#tourm-bub .tourm-cnt').textContent())==='2 de 9');
      t('seta fora de campo grava passo',await esperar(p,()=>!!_guiaMarePerfil?.passos?.board));
      await p.evaluate(()=>{const el=document.createElement('input');document.body.append(el);el.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));el.remove();});
      t('Esc em campo continua fechando tour',await p.locator('#tourm-ring,#tourm-bub').count()===0);
    });
    await caso('deep link sonar',async()=>{
      const p=await session('dev','&tour=sonar');
      t('tour=sonar abre passo único',await esperar(p,()=>document.querySelector('#tourm-bub .tourm-cnt')?.textContent==='1 de 1' && document.querySelector('#tourm-bub .tourm-t')?.textContent.includes('Sonar')));
      t('URL perde tour e mantém squad',!new URL(p.url()).searchParams.has('tour') && new URL(p.url()).searchParams.get('squad')==='dev',p.url());
    });
    await caso('deep link hostil',async()=>{
      const p=await session('dev','&tour='+encodeURIComponent('<script>'));
      await p.waitForTimeout(2200);
      t('tour=<script> não abre tour',await p.locator('#tourm-ring,#tourm-bub').count()===0);
      t('tour inválido sai da URL',!new URL(p.url()).searchParams.has('tour'),p.url());
    });
    await caso('deep link hotline',async()=>{
      const p=await session('dev','&hotline=1');
      t('hotline abre card do Agente',await esperar(p,()=>document.getElementById('card-ov').classList.contains('open') && document.getElementById('m-title').value==='🤖 Converse com o Agente Ágil',7000));
      t('URL perde hotline e mantém squad',!new URL(p.url()).searchParams.has('hotline') && new URL(p.url()).searchParams.get('squad')==='dev',p.url());
    });
    await caso('Ajuda executável',async()=>{
      const p=await session();await p.evaluate(()=>openHelp());
      t('Ajuda mostra botão Boas-vindas',await p.locator('#help-ov').getByRole('button',{name:'🧭 Boas-vindas',exact:true}).isVisible());
      t('primeiro tópico do board é Programa de boas-vindas',await p.evaluate(()=>HELP_CONTENT.board[0].title.includes('Programa de boas-vindas')));
    });
  }finally{
    for(const s of sessions){t('sem pageerror: '+s.label,s.errors.length===0,s.errors);await s.ctx.close();}
    await browser.close();
  }
  console.log(`\n${assertions} asserções, ${failures} falha(s)`);
  console.log(failures?'HÁ FALHAS':'TUDO OK');process.exitCode=failures?1:0;
})().catch(e=>{console.error(e);console.log('HÁ FALHAS');process.exitCode=1;});
