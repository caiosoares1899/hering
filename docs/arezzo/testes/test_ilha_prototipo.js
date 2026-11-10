// 🏝️ Ilha Dinâmica isolada: teste escrito pelo contrato, sem Firebase nem login.
// Rodar na raiz: python3 -m http.server 8957
// Depois: node docs/arezzo/testes/test_ilha_prototipo.js (BASE_URL, CHROME e PLAYWRIGHT_MODULE opcionais).
// Neste sandbox: somente node --check; execução e capturas dependem do protótipo e do navegador.
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const base = process.env.BASE_URL || 'http://127.0.0.1:8957';
const out = path.join(__dirname, '../../capturas/ilha-prototipo');
const temas = ['abrolhos', 'lencois', 'entardecer'];
const formatoTempo = /^\d{1,2}:\d{2}(:\d{2})?$/;
const segundos = texto => {
  if(!formatoTempo.test(texto.trim())) throw new Error('Tempo fora do contrato: '+texto);
  return texto.trim().split(':').reduce((n,v)=>n*60+Number(v),0);
};
let ok = true, total = 0;
const t = (nome, condicao, detalhe) => {
  total++; if(!condicao) ok = false;
  console.log((condicao?'✅ ':'❌ ')+nome+(condicao?'':' → '+String(JSON.stringify(detalhe)).slice(0,600)));
};
// Cada falha é impressa e os demais cenários continuam; erro de infraestrutura também sai com FALHOU.
const verificar = async(nome, fn) => {
  try { const resultado = await fn(); t(nome, !!resultado, resultado); }
  catch(e) { t(nome, false, e.message); }
};
const estado = (p, valor, timeout=2000) => p.waitForFunction(
  valor=>document.querySelector('#ilha')?.dataset.estado===valor, valor, {timeout});
const texto = (p, seletor) => p.locator(seletor).innerText();
const abrir = async p => { await p.locator('#ilha-btn').click(); await estado(p,'aberta'); };

(async()=>{
  let b;
  try {
    const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home,'hering-tools/playwright/node_modules/playwright'));
    const chromeRoot = path.join(home,'hering-tools/chrome');
    const chrome = process.env.CHROME || path.join(chromeRoot,fs.readdirSync(chromeRoot).find(n=>n.startsWith('mac_arm-')),'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
    fs.mkdirSync(out,{recursive:true});
    b = await chromium.launch({executablePath:chrome});
    const caso = async(nome, params, fn, op={}) => {
      const ctx = await b.newContext({viewport:{width:op.largura||1280,height:900}, hasTouch:op.largura===390, serviceWorkers:'block'});
      const erros=[], rede=[];
      // No contexto, antes de criar a página: inclui pedidos iniciais e de eventuais workers.
      // as fontes (fonts.gstatic.com) podem; Firebase (www.gstatic.com/firebasejs, *.firebaseio.com) não
      ctx.on('request',r=>{ if(/firebase|www\.gstatic\.com/i.test(r.url())) rede.push(r.url()); });
      const p = await ctx.newPage();
      p.setDefaultTimeout(3000);
      p.on('pageerror',e=>erros.push(e.message));
      try {
        if(op.reduzir) await p.emulateMedia({reducedMotion:'reduce'});
        if(op.clock) {
          const inicio = new Date('2026-11-10T12:00:00Z');
          await p.clock.install({time:inicio});
          await p.clock.pauseAt(new Date(inicio.getTime()+1000));
        }
        const resposta = await p.goto(base+'/docs/demo/ilha-dinamica-prototipo.html?'+new URLSearchParams(params));
        if(!resposta || !resposta.ok()) throw new Error('Página indisponível: HTTP '+resposta?.status());
        await p.locator('#ilha').waitFor({state:'attached'});
        await fn(p);
      } catch(e) { t(nome+' — execução do cenário',false,e.message); }
      finally {
        t(nome+' — sem erro de JS',erros.length===0,erros);
        t(nome+' — nenhum pedido firebase/gstatic',rede.length===0,rede);
        await ctx.close();
      }
    };

    // 1. Temas pela URL, sem alterar o DOM para fabricar o resultado.
    const fundos=[];
    for(const tema of temas) await caso('tema '+tema,{tema,modo:'sempre'},async p=>{
      const th = await p.locator('html').getAttribute('data-theme');
      t(tema+' aplica data-theme correto',th===({abrolhos:null,lencois:'light',entardecer:'sunset'})[tema],th);
      await p.waitForTimeout(1000);
      fundos.push(await p.evaluate(()=>{ const b = getComputedStyle(document.body); return getComputedStyle(document.documentElement).backgroundColor+' | '+b.backgroundImage.slice(0,80); }));   // nos temas claro/entardecer o fundo é gradiente (imagem): compara a cor da página + o início do gradiente
    });
    t('cada tema tem seu fundo (cor da página + gradiente)',fundos.length===3 && new Set(fundos).size===3,fundos);

    // 2–3. Estados e visibilidade da pílula; padrão de modo/cenário também coberto.
    for(const modo of ['sempre','acao']) for(const cenario of ['vazio','timer']) await caso(modo+' '+cenario,{modo,cenario},async p=>{
      const esperado = cenario==='timer'?'atividade':modo==='sempre'?'repouso':'oculta';
      await verificar(modo+' '+cenario+' → '+esperado,async()=>{await estado(p,esperado); return true;});
      t('data-modo = '+modo,await p.locator('#ilha').getAttribute('data-modo')===modo);
      t('visibilidade da pílula em '+modo+' '+cenario,await p.locator('#ilha-btn').isVisible()===(esperado!=='oculta'));
      if(cenario==='timer') {
        t('atividade tem título',!!(await texto(p,'#ilha-titulo')).trim());
        t('tempo no formato mm:ss ou h:mm:ss',formatoTempo.test((await texto(p,'#ilha-tempo')).trim()));
      }
    });
    await caso('padrões da URL',{},async p=>{
      t('modo padrão é acao',await p.locator('#ilha').getAttribute('data-modo')==='acao');
      await verificar('cenário padrão vazio → oculta',async()=>{await estado(p,'oculta'); return true;});
    });

    // 4. Hover real e navegação por Tab (não apenas element.focus()).
    await caso('mouse desktop',{modo:'mouse',cenario:'vazio'},async p=>{
      await verificar('mouse vazio → fio',async()=>{await estado(p,'fio'); return true;});
      { const bx = await p.locator('#ilha-fio').boundingBox(); await p.mouse.move(bx.x+bx.width/2, bx.y+bx.height/2); }   // a ilha aparece e o fio some no mesmo instante: o hover() do Playwright trataria isso como interceptação
      await verificar('hover no fio → repouso',async()=>{await estado(p,'repouso'); return true;});
      await p.mouse.move(0,899);
      await verificar('sair do hover → fio em até 2 s',async()=>{await estado(p,'fio',2000); return true;});
      // Reinicia o ciclo de Tab para não depender de qual controle está antes do fio.
      await p.evaluate(()=>document.activeElement?.blur());
      let focou = false;
      for(let i=0;i<50;i++) {
        await p.keyboard.press('Tab');
        if(await p.evaluate(()=>document.activeElement?.id==='ilha-fio')) { focou=true; break; }
      }
      t('fio alcançável pelo teclado',focou);
      await verificar('foco de teclado no fio → repouso',async()=>{await estado(p,'repouso'); return true;});
    });
    await caso('mouse celular',{modo:'mouse',cenario:'vazio'},async p=>{
      await verificar('390 px: mouse vazio → oculta',async()=>{await estado(p,'oculta'); return true;});
      t('390 px: pílula invisível sem ação',!await p.locator('#ilha-btn').isVisible());
    },{largura:390});

    // 6. Acessibilidade ao abrir/recolher.
    await caso('painel e foco',{modo:'sempre',cenario:'timer'},async p=>{
      t('pílula controla o painel',await p.locator('#ilha-btn').getAttribute('aria-controls')==='ilha-painel');
      await abrir(p);
      t('clicar → aberta',await p.locator('#ilha').getAttribute('data-estado')==='aberta');
      t('aria-expanded=true',await p.locator('#ilha-btn').getAttribute('aria-expanded')==='true');
      t('painel visível com role=dialog',await p.locator('#ilha-painel').isVisible() && await p.locator('#ilha-painel').getAttribute('role')==='dialog');
      t('foco está dentro do painel',await p.evaluate(()=>document.querySelector('#ilha-painel').contains(document.activeElement)));
      await p.keyboard.press('Escape');
      await verificar('Esc recolhe para atividade',async()=>{await estado(p,'atividade'); return true;});
      t('Esc: aria-expanded=false',await p.locator('#ilha-btn').getAttribute('aria-expanded')==='false');
      t('Esc: painel invisível',!await p.locator('#ilha-painel').isVisible());
      t('Esc devolve foco à pílula',await p.evaluate(()=>document.activeElement?.id==='ilha-btn'));
    });

    // 7–8. Relógio instalado ANTES do goto, sem depender de dados ou funções internas.
    await caso('tempo e encerramento',{modo:'sempre',cenario:'timer'},async p=>{
      const antes = segundos(await texto(p,'#ilha-tempo'));
      await p.clock.runFor(65000);
      const depois = segundos(await texto(p,'#ilha-tempo'));
      t('65 s avançam o tempo em 1:05 (±1 s)',Math.abs(depois-antes-65)<=1,{antes,depois});
      await abrir(p);
      const timer = p.locator('.ilha-timer[data-id]').first();
      const id = await timer.getAttribute('data-id');
      // Guarda a identidade para não confundir remoção com reordenação da lista.
      const lerTempo = ()=>timer.locator('.ilha-timer-tempo').innerText();
      await timer.locator('[data-acao="pausar"]').click();
      const pausado = segundos(await lerTempo());
      await p.clock.runFor(30000);
      t('pausar congela por 30 s',segundos(await lerTempo())===pausado);
      await timer.locator('[data-acao="continuar"]').click();
      const retomado = segundos(await lerTempo());
      await p.clock.runFor(5000);
      const contado = segundos(await lerTempo());
      t('continuar volta a contar (+5 s ±1 s)',Math.abs(contado-retomado-5)<=1,{retomado,contado});
      const quantidade = await p.locator('.ilha-timer[data-id]').count();
      await timer.locator('[data-acao="encerrar"]').click();
      t('primeiro clique mantém o timer',await p.locator('.ilha-timer[data-id]').count()===quantidade);
      t('primeiro clique pede confirmar-encerrar',await timer.locator('[data-acao="confirmar-encerrar"]').isVisible());
      await timer.locator('[data-acao="confirmar-encerrar"]').click();
      const ids = await p.locator('.ilha-timer[data-id]').evaluateAll(xs=>xs.map(x=>x.dataset.id));
      t('segundo clique remove o timer certo',!ids.includes(id) && ids.length===quantidade-1,ids);
    },{clock:true});

    // 9–13. Vários timers, notificação passageira, privacidade, erro e Sonar interno.
    await caso('vários timers',{modo:'sempre',cenario:'varios'},async p=>{
      t('pílula mostra +2',(await texto(p,'#ilha-mais')).trim()==='+2');
      await abrir(p);
      t('painel lista três timers',await p.locator('.ilha-timer[data-id]').count()===3);
    });
    await caso('notificação passageira',{modo:'acao',cenario:'vazio'},async p=>{
      await estado(p,'oculta');
      await p.locator('#ctl-notif').click();
      await verificar('notificação faz aparecer em atividade',async()=>{await estado(p,'atividade'); return true;});
      t('notificação não expande',await p.locator('#ilha-btn').getAttribute('aria-expanded')==='false');
      t('notificação não abre painel',!await p.locator('#ilha-painel').isVisible());
      await p.clock.runFor(7000);
      await verificar('depois de 7 s volta a oculta',async()=>{await estado(p,'oculta'); return true;});
      t('depois de 7 s pílula invisível',!await p.locator('#ilha-btn').isVisible());
    },{clock:true});
    await caso('privado',{cenario:'timer',privado:'1'},async p=>{
      t('privado esvazia título',(await p.locator('#ilha-titulo').textContent()).trim()==='');
      t('privado mantém tempo visível',await p.locator('#ilha-tempo').isVisible());
    });
    await caso('erro recuperável',{modo:'sempre',cenario:'erro'},async p=>{
      await abrir(p);
      t('erro aparece no painel',await p.locator('#ilha-erro').isVisible());
      await p.locator('#ilha-tentar').click();
      await verificar('tentar novamente remove o erro',async()=>{await p.locator('#ilha-erro').waitFor({state:'hidden'}); return true;});
      t('tentar novamente também some',!await p.locator('#ilha-tentar').isVisible());
    });
    await caso('Sonar dentro',{modo:'sempre',sonar:'dentro'},async p=>{
      t('Sonar externo não existe',await p.locator('#btn-sonar').count()===0);
      await abrir(p);
      t('input Sonar interno visível',await p.locator('input#ilha-sonar-in').isVisible());
    });

    // 14. Parado não anima; movimento reduzido não deve sequer iniciar animação ao abrir/fechar.
    await caso('movimento parado',{modo:'sempre',cenario:'timer'},async p=>{
      await p.waitForTimeout(1000);
      const n = await p.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length);
      t('parada há 1 s: nenhuma animação rodando',n===0,n);
    });
    await caso('movimento reduzido',{modo:'sempre',cenario:'timer'},async p=>{
      await p.waitForTimeout(1000);
      await p.evaluate(()=>{
        window.__ilhaAnimacoes = [];
        for(const tipo of ['animationstart','transitionrun']) document.addEventListener(tipo,e=>window.__ilhaAnimacoes.push(e.type),true);
        const animate = Element.prototype.animate;
        Element.prototype.animate = function(...args) { window.__ilhaAnimacoes.push('animate'); return animate.apply(this,args); };
      });
      await abrir(p);
      await p.waitForTimeout(100);
      await p.keyboard.press('Escape');
      await estado(p,'atividade');
      await p.waitForTimeout(100);
      const movimento = await p.evaluate(()=>({iniciadas:window.__ilhaAnimacoes,rodando:document.getAnimations().filter(a=>a.playState==='running').length}));
      t('reduce: abrir/fechar não cria animação',movimento.iniciadas.length===0 && movimento.rodando===0,movimento);
    },{reduzir:true});

    // 15–17. Matriz visual, toque e isolamento. Rede/JS verificados em TODOS os casos.
    for(const largura of [1280,390]) for(const tema of temas) await caso('matriz '+largura+' '+tema,{tema,modo:'sempre',cenario:'varios'},async p=>{
      await abrir(p);
      await p.waitForTimeout(1000);
      const lateral = await p.evaluate(()=>({html:document.documentElement.scrollWidth,body:document.body.scrollWidth,largura:innerWidth}));
      t(largura+' '+tema+': sem rolagem lateral',lateral.html<=lateral.largura && lateral.body<=lateral.largura,lateral);
      t(largura+' '+tema+': não existe sino externo',await p.locator('#btn-sino').count()===0);
      t(largura+' '+tema+': Sonar externo existe',await p.locator('#btn-sonar').count()===1);
      if(largura===390) {
        const botoes = await p.locator('#ilha-painel button, #ilha-painel [role="button"]').evaluateAll(xs=>xs.filter(e=>e.getClientRects().length && getComputedStyle(e).visibility!=='hidden').map(e=>{const r=e.getBoundingClientRect();return {acao:e.dataset.acao||e.id||e.textContent.trim(),w:r.width,h:r.height};}));
        t('390 '+tema+': todos os botões visíveis ≥44×44 px',botoes.length>0 && botoes.every(r=>r.w>=44 && r.h>=44),botoes);
      }
      await p.screenshot({path:path.join(out,`ilha_${largura}_${tema}.png`),fullPage:true});
      t(largura+' '+tema+': screenshot gravada',fs.existsSync(path.join(out,`ilha_${largura}_${tema}.png`)));
    },{largura});
  } catch(e) { t('infraestrutura do teste',false,e.message); }
  finally {
    if(b) { try { await b.close(); } catch(e) { t('fechar navegador',false,e.message); } }
    console.log('\n'+total+' asserções — '+(ok?'TUDO OK':'FALHOU'));
    process.exitCode = ok?0:1;
  }
})();
