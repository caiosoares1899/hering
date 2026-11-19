// Bastidor do Radar em aba própria (okr-bastidor.html → okr-apresentacao.slide.html?tela=bastidor) — /melhoriauiux de 19/11/2026.
// Confere, em 1280 e 390 px: espera com botão da casa, quem apresenta, slide atual e o que vem a seguir, detalhe do Objetivo,
// alvos de 44 px, nada rolando para o lado, FPS fora da aba, Encerrar separado e o aviso de início próprio da aba.
const path = require('path');
const { chromium } = require(process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright');
const fake = require('./fakefb.js');
const BASE = process.env.APRESENTACAO_TEST_URL || 'http://localhost:8941';
const U = (uid, n) => ({ uid, email: uid + '@ciahering.com.br', displayName: n, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const mk = (id, t, o) => ({ id, titulo: t, areaId: 'geral', trimestres: ['2026-Q4'], responsaveis: ['ana'], tagIds: [], history: [], indicadores: ['i1'], progressos: ['p1'], proximosPassos: [], riscos: [], planosAcao: [], descricao: 'desc', torre: 'digital', ...o });
const LONGO = 'Aumentar a conversão do checkout no app e no site durante a Black Friday sem perder margem';
const seed = () => ({ kanban: { okr: { objetivos: {
  d1: mk('d1', 'Fidelidade', { areaId: 'crm', ordem: 0 }), d2: mk('d2', LONGO, { areaId: 'tech', ordem: 0, atingimento:{tipo:'numero',inicial:0,meta:100,lancamentos:[{em:'2026-11-10',valor:80}]} }),
  d3: mk('d3', 'NPS', { areaId: 'cx', ordem: 0 }), d4: mk('d4', 'Pagamentos', { areaId: 'tech', ordem: 1 }) }, marcos: {}, tags: {}, reuniao_notas: {} },
  usuarios: { ana: { uid: 'ana', nome: 'Ana ADM', email: 'ana@ciahering.com.br', inscrito: true, init: 'AA' }, eve: { uid:'eve', nome:'Eve Souza', inscrito:true } },
  usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana ADM', init: 'AA' } }, config: { adm_emails: ['ana@ciahering.com.br'] } } });
let falhas = 0; const t = (n, ok, d) => { if (!ok) falhas++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
const texto = (p, sel) => p.evaluate(s => (document.querySelector(s)?.textContent || '').replace(/\s+/g, ' ').trim(), sel);
const medir = p => p.evaluate(() => ({
  rolagemLateral: document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('#bastidor-pagina *')].some(e => e.offsetParent && e.getBoundingClientRect().right > innerWidth + 1),
  pequenos: [...document.querySelectorAll('#bastidor-pagina :is(button,select)')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 44).map(e => e.id || e.textContent.trim()),
}));
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  try {
    for (const [w, h] of [[1280, 768], [1366, 650], [390, 800]]) {
      const ctx = await b.newContext({ viewport: { width: w, height: h } }); await fake.install(ctx, seed());
      const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message)); p.on('dialog', d => d.accept());
      await p.goto(BASE + '/okr-bastidor.html'); await p.waitForFunction(() => !!window.__authCb);
      await p.evaluate(x => window.__authCb(x), U('ana', 'Ana ADM')); await p.waitForTimeout(1500);
      const iniciar = p.getByRole('button', { name: 'Iniciar apresentação ao vivo' });
      t(`[${w}] espera: Iniciar com alvo de 44 px e cor de ação`, await iniciar.isVisible() && await iniciar.evaluate(e => e.getBoundingClientRect().height >= 44 && getComputedStyle(e).backgroundColor !== 'rgb(239, 239, 239)'), await iniciar.evaluate(e => getComputedStyle(e).backgroundColor));
      await iniciar.click(); await p.click('#inicio-sem'); await p.waitForTimeout(700);
      t(`[${w}] aviso de início fala da tela para o público, não do 🎙️ da aba dos slides`, /tela para o público/.test(await texto(p, '#live-toast')) && !/canto da tela/.test(await texto(p, '#live-toast')), await texto(p, '#live-toast'));
      const quadro = p.locator('#bastidor-previa iframe');
      await quadro.waitFor({state:'visible'});
      const esperado = await p.evaluate(()=>slides[currentIdx+1].title);
      await p.frameLocator('#bastidor-previa iframe').locator('.slide.active').waitFor();
      t(`[${w}] miniatura renderiza o HTML do próximo slide em quadro isolado`,
        await quadro.evaluate(e=>e.getAttribute('sandbox')==='' && e.srcdoc.includes(slides[currentIdx+1].html)), esperado);
      await p.locator('#proximo').click();
      t(`[${w}] Próximo coloca a prévia no ar`, (await texto(p, '#bastidor-agora'))===esperado, esperado);
      await p.locator('#anterior').click();
      await p.locator('#proximo').focus();
      await p.keyboard.press('PageDown');
      t(`[${w}] PageDown navega com foco no controle`, (await texto(p,'#bastidor-agora'))===esperado,'');
      await p.keyboard.press('PageUp');
      t(`[${w}] PageUp volta ao primeiro slide`, await p.evaluate(()=>currentIdx===0),'');
      await p.locator('#rascunho').focus();
      await p.keyboard.press('ArrowRight');
      const camposProtegidos=await p.evaluate(()=>{
        const select=document.getElementById('participante');
        const evento=new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true});
        select.dispatchEvent(evento);
        return currentIdx===0 && !evento.defaultPrevented;
      });
      t(`[${w}] setas respeitam o rascunho e o seletor de participantes`,camposProtegidos,'');

      await p.evaluate(()=>Object.defineProperty(navigator.clipboard,'writeText',{value:async texto=>{window.__conviteBastidor=texto;}}));
      await p.getByRole('button',{name:'Copiar convite do Meet'}).click();
      t(`[${w}] Bastidor copia o convite com link para os slides`, await p.evaluate(()=>
        window.__conviteBastidor?.includes(location.origin+location.pathname) &&
        window.__conviteBastidor.includes('O áudio e a conversa continuam aqui no Google Meet.') &&
        !window.__conviteBastidor.includes('tela=publico')), '');
      if(process.env.CAPTURA_BASTIDOR){
        await p.screenshot({path:process.env.CAPTURA_BASTIDOR+'-'+w+'.png'});
      }
      t(`[${w}] mostra quem apresenta`, (await texto(p, '#bastidor-quem')) === 'Você está apresentando', await texto(p, '#bastidor-quem'));
      const agora = await p.evaluate(() => slides[currentIdx].title), seguir = await p.evaluate(() => slides[currentIdx + 1]?.title || '');
      t(`[${w}] mostra o slide atual e o que vem a seguir`, (await texto(p, '#bastidor-agora')) === agora && (await texto(p, '#bastidor-seguir')) === seguir && /Slide 1 de/.test(await texto(p, '#estado')), { agora, seguir });
      t(`[${w}] FPS fica fora da aba (só faz sentido no computador dos slides)`, !(await p.locator('#fps').isVisible()), '');
      t(`[${w}] Próximo é o único botão de ação principal`, await p.evaluate(() => { const cor = e => getComputedStyle(e).backgroundColor; const prox = cor(document.getElementById('proximo')); return [...document.querySelectorAll('#bastidor-controles button')].filter(e => cor(e) === prox).map(e => e.id).join() === 'proximo'; }), '');
      t(`[${w}] Encerrar fica separado, no fim`, await p.evaluate(() => !!document.querySelector('.bst-fim #bastidor-encerrar')), '');
      if(w>=1100) t(`Bastidor usa a largura da tela e cabe em ${w} × ${h} sem rolagem vertical`, await p.locator('#bastidor-pagina').evaluate(el=>el.scrollHeight<=el.clientHeight+1 && el.clientWidth>=innerWidth-1), '');
      const historico = p.locator('#bastidor-notas');
      t(`[${w}] histórico fica recolhido por padrão`, !(await historico.evaluate(el=>el.open)), '');
      await historico.locator('summary').click();
      await p.getByText('Nenhuma anotação hoje.',{exact:true}).waitFor();
      t(`[${w}] histórico sinaliza quando ainda não há notas`, (await texto(p,'#bastidor-notas-lista'))==='Nenhuma anotação hoje.', '');
      const rascunho = p.locator('#rascunho');
      await rascunho.fill('Rascunho em andamento');
      await p.evaluate(async ()=>{
        const nota = {autorUid:'eve', texto:'<b>Decisão</b> registrada', ts:'2026-11-19T12:00:00Z'};
        await window._set(window._ref(window._db,'kanban/okr/reuniao_notas/'+_hojeStr()+'/nota-teste'),nota);
      });
      await p.locator('#bastidor-notas-lista article').waitFor();
      t(`[${w}] nota recebida mostra autor, horário e texto literal sem apagar rascunho`,
        /Eve Souza · \d{2}:\d{2}/.test(await texto(p,'#bastidor-notas-lista small')) &&
        (await texto(p,'#bastidor-notas-lista p'))==='<b>Decisão</b> registrada' &&
        await rascunho.inputValue()==='Rascunho em andamento' &&
        await p.locator('#bastidor-notas-lista b').count()===0, '');
      t(`[${w}] histórico reaproveita o ouvinte de notas`, await p.evaluate(()=>
        window.__lis.filter(l=>l.p==='kanban/okr/reuniao_notas').length===1), '');
      await historico.locator('summary').click();
      await p.getByRole('button',{name:'Configurar horário'}).click();
      await p.keyboard.press('PageDown');
      t(`[${w}] diálogo do horário bloqueia navegação por passador`, await p.evaluate(()=>currentIdx===0),'');
      await p.locator('#agenda-inicio').fill('10:00');
      await p.locator('#agenda-fim').fill('11:00');
      await p.locator('#agenda-cfg-ov').getByRole('button',{name:'Salvar'}).click();
      await p.waitForFunction(()=>window.__store.kanban.okr.reuniao_agenda?.[_hojeStr()]?.fim==='11:00');
      t(`[${w}] Bastidor salva o horário no mesmo registro da apresentação`, await p.evaluate(()=>_okrAgendaHoje()?.inicio==='10:00'), '');
      t(`[${w}] no slide de abertura, Abrir detalhe fica desligado`, await p.locator('#abrir-detalhe').isDisabled(), '');
      const gerencia = p.getByRole('combobox',{name:'Gerência',exact:true});
      const chave = await p.evaluate(()=>slides.find(x=>x.primeiroObj==='d2').key);
      await gerencia.selectOption(chave);
      await p.waitForFunction(chave=>window.__store.kanban.okr.apresentacao_live.slide===chave,chave);
      t(`[${w}] Gerência pula direto para o slide e oferece os Objetivos dele`,
        await gerencia.inputValue()===chave && await p.getByRole('combobox',{name:'Objetivo do slide'}).isVisible(),'');
      const objetivo = p.getByRole('combobox',{name:'Objetivo do slide'});
      await objetivo.selectOption('d4');
      await p.getByRole('button',{name:'Abrir detalhe',exact:true}).click();
      await p.waitForFunction(()=>window.__store.kanban.okr.apresentacao_live.detalhe==='d4');
      t(`[${w}] escolha direta abre o Objetivo escolhido, com Evolução oculta se não há meta`,
        (await texto(p,'#bastidor-agora'))==='Pagamentos' && !(await p.locator('#controle-evolucao').isVisible()), '');
      await objetivo.selectOption('d2');
      await p.getByRole('button',{name:'Abrir detalhe',exact:true}).click();
      await p.locator('#controle-evolucao').click();
      await p.waitForFunction(()=>window.__store.kanban.okr.apresentacao_live.evolucao==='d2');
      t(`[${w}] Bastidor oferece fechar a Evolução publicada`, (await texto(p,'#controle-evolucao'))==='Fechar evolução','');
      await p.locator('#controle-evolucao').click();
      await p.waitForFunction(()=>window.__store.kanban.okr.apresentacao_live.evolucao==='');

      t(`[${w}] prévia de Objetivo usa o cartão quando há vizinho`,
        await p.locator('.bst-previa-objetivo').isVisible() && !(await quadro.isVisible()), '');
      t(`[${w}] detalhe: título do Objetivo em destaque e o próximo da gerência`, (await texto(p, '#bastidor-agora')) === LONGO && (await texto(p, '#bastidor-seguir')) === 'Pagamentos' && (await texto(p, '#estado')) === 'Detalhe do Objetivo', { a: await texto(p, '#bastidor-agora'), s: await texto(p, '#bastidor-seguir') });
      let m = await medir(p);
      t(`[${w}] sem rolagem lateral com título longo e alvos de pelo menos 44 px`, !m.rolagemLateral && !m.pequenos.length, m);
      await p.keyboard.press('ArrowRight');
      t(`[${w}] último Objetivo desativa Próximo e esconde a prévia`,
        await p.locator('#proximo').isDisabled() && !(await p.locator('#bastidor-previa').isVisible()), '');
      const outra = await p.evaluate(()=>slides.find(x=>x.key.startsWith('ger:') && x.key!==slides[currentIdx].key).key);
      await gerencia.selectOption(outra);
      await p.waitForFunction(chave=>window.__store.kanban.okr.apresentacao_live.slide===chave && !window.__store.kanban.okr.apresentacao_live.detalhe,outra);
      t(`[${w}] trocar de Gerência fecha o detalhe que estava no ar`, await gerencia.inputValue()===outra,'');
      await p.getByRole('button',{name:'Ir para Panorama geral'}).click();
      await p.waitForFunction(()=>window.__store.kanban.okr.apresentacao_live.slide==='summary');
      t(`[${w}] atalho fecha o detalhe e leva a sala ao Panorama geral`, (await texto(p,'#bastidor-agora'))==='Panorama geral' &&
        await p.evaluate(()=>!window.__store.kanban.okr.apresentacao_live.detalhe), '');
      await p.evaluate(() => { window._okrCloseDetail(); const st = window.__store.kanban.okr.apresentacao_live; st.apresentador = { uid: 'eve', nome: 'Eve Souza' };
        (window.__lis || []).filter(l => l.p === 'kanban/okr/apresentacao_live').forEach(l => l.cb({ val: () => JSON.parse(JSON.stringify(st)), exists: () => true, key: 'apresentacao_live' })); });
      await p.waitForTimeout(400);
      t(`[${w}] outra pessoa apresentando: o selo diz quem e explica por que as setas estão desligadas`, (await texto(p, '#bastidor-quem')) === 'Eve Souza está apresentando' && /retomar o controle/.test(await texto(p, '#bastidor-dica-controle')) && await p.locator('#proximo').isDisabled() && !(await p.locator('#retomar').isDisabled()), await texto(p, '#bastidor-quem'));
      t(`[${w}] sem erro de JavaScript`, !erros.length, erros);
      await ctx.close();
    }
  } finally { await b.close(); }
  console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo'); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
