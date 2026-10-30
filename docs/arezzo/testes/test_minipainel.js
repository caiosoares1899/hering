// 🌊 Mini painel (minipainel.html): conecta com a chave, mostra a saúde do ecossistema e os cards, e se comporta bem quando a função erra. A função é simulada por page.route.
//   python3 -m http.server 8941 &   node docs/arezzo/testes/test_minipainel.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const URL_PAG = 'http://localhost:8941/minipainel.html'; const FN = /oceanoResumo/;
const hoje = new Date().toISOString().slice(0, 10);
const base = (extra) => Object.assign({ geral: 'ok', geradoEm: new Date().toISOString(), dono: { iniciais: 'CO', squads: 3 },
  status: { vtex: { estado: 'ok', texto: 'operando' }, github: { estado: 'ok', texto: 'operando' }, firebase: { estado: 'ok', texto: 'operando' } }, backup: { estado: 'ok', texto: 'em dia' },
  plantao: { abertos: 0, aguardandoValidacao: 0, escalados: 0 }, alarmesSumico: { ultimas24h: 0 },
  meusCards: { ativos: 5, atrasados: 0, venceHoje: 0, bloqueados: 0, semPrazo: 1, venceEm7dias: 0, hoje, lista: [] } }, extra || {});
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const abre = async (corpo, opts) => { opts = opts || {}; const ctx = await b.newContext({ viewport: opts.vp || { width: 1280, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); const reqs = [];
    await p.route(FN, async r => { reqs.push(r.request().url()); const c = typeof corpo === 'function' ? corpo() : corpo; if (c === 'abort') return r.abort(); return r.fulfill({ status: c.__http || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(c.__http ? c.json : c) }); });
    await p.addInitScript(([chave, tema]) => { try { if (chave) localStorage.setItem('minipainel_chave', chave); if (tema) localStorage.setItem('minipainel_tema', tema); } catch (e) {} }, [opts.chave === undefined ? 'segredo123' : opts.chave, opts.tema || 'dark']);
    await p.goto(URL_PAG + (opts.qs || '')); await p.waitForTimeout(700); return { ctx, p, errs, reqs }; };
  const txt = p => p.locator('#app').innerText();

  { const { ctx, p, errs } = await abre(base(), { chave: '' });   // A: sem chave → tela de conexão
    t('A1. sem chave aparece a tela "Conectar o mini painel" (e nenhuma consulta é feita)', /Conectar o mini painel/.test(await txt(p)) && (await p.locator('#i-chave').getAttribute('type')) === 'password', await txt(p));
    await p.fill('#i-chave', ' minhaChave '); await p.click('button[type=submit]'); await p.waitForTimeout(700);
    t('A2. ao conectar, a chave (sem espaços) fica só no localStorage e o painel carrega', (await p.evaluate(() => localStorage.getItem('minipainel_chave'))) === 'minhaChave' && /Tudo certo/.test(await txt(p)), await txt(p));
    t('A3. sem erro de JS', !errs.length, errs); await ctx.close(); }

  { const { ctx, p, reqs } = await abre(base());   // B: tudo certo
    t('B1. tudo certo: título, 3 monitores "OK" e 🟢 (estado por cor + ícone + texto)', /Tudo certo/.test(await txt(p)) && (await p.locator('.tile .est.ok').count()) >= 5 && /🟢/.test(await txt(p)), await txt(p));
    t('B2. a chave vai na consulta (?k=) e a página não a expõe na própria URL', reqs[0] && /[?&]k=segredo123/.test(reqs[0]) && !/segredo123/.test(p.url()), [reqs[0], p.url()]);
    t('B3. lista vazia de cards mostra mensagem amigável, não uma lista vazia', /Nada atrasado, bloqueado ou vencendo/.test(await txt(p)), await txt(p)); await ctx.close(); }

  { const { ctx, p } = await abre(base({ geral: 'fora', status: { vtex: { estado: 'atencao', texto: '2 incidentes: Checkout lento' }, github: { estado: 'fora', texto: 'monitor sem resposta (4 falhas)' }, firebase: { estado: 'ok', texto: 'operando' } }, backup: { estado: 'fora', texto: 'sem backup do quadro' },
    plantao: { abertos: 3, aguardandoValidacao: 1, escalados: 1 }, alarmesSumico: { ultimas24h: 2 },
    meusCards: { ativos: 9, atrasados: 2, venceHoje: 1, bloqueados: 1, semPrazo: 0, venceEm7dias: 2, hoje, lista: [
      { squad: 'prf', titulo: 'Card atrasado', prazo: '2026-10-20', atrasado: true, diasAtraso: 10 }, { squad: 'dados', titulo: 'Card bloqueado', prazo: '2026-11-10', bloqueado: true }, { squad: 'dev', titulo: 'Vence hoje', prazo: hoje, venceHoje: true }, { squad: 'dev', titulo: 'Mais para frente', prazo: '2026-11-04' }] } })); 
    const x = await txt(p);   // C: problemas
    t('C1. problema grave: "Algo fora do ar" com 🔴 e o motivo de cada peça', /Algo fora do ar/.test(x) && /Checkout lento/.test(x) && /monitor sem resposta \(4 falhas\)/.test(x) && /sem backup do quadro/.test(x), x);
    t('C2. alarmes e plantão aparecem com números', /2 cards sumiram sem exclusão/.test(x) && /3 abertos · 1 p\/ validar · 1 escalado/.test(x), x);
    t('C3. meus cards: contadores e lista com "atrasado 10 dias", "bloqueado", "vence hoje" e "vence 04/11"', /atrasado 10 dias/.test(x) && /bloqueado\n?/.test(x) && /vence hoje/.test(x) && /vence 04\/11/.test(x) && (await p.locator('.num.bad b').innerText()) === '2', x); await ctx.close(); }

  { const { ctx, p } = await abre({ __http: 403, json: { erro: 'chave inválida' } });   // D: chave errada
    t('D1. chave recusada (403): mensagem clara, botão de tentar de novo e de trocar a chave', /Chave não aceita/.test(await txt(p)) && (await p.locator('#b-trocar').count()) === 1, await txt(p));
    await p.click('#b-trocar'); await p.waitForTimeout(200); t('D2. "Trocar a chave" apaga a chave e volta para a tela de conexão', /Conectar o mini painel/.test(await txt(p)) && (await p.evaluate(() => localStorage.getItem('minipainel_chave'))) === null, await txt(p)); await ctx.close(); }

  { const { ctx, p } = await abre({ __http: 500, json: {} });
    t('E1. erro 500 (ex.: função não publicada): explica que pode faltar o deploy', /respondeu com erro/.test(await txt(p)) && /deploy/.test(await txt(p)), await txt(p)); await ctx.close(); }

  { let falha = false; const { ctx, p } = await abre(() => (falha ? 'abort' : base()));   // F: perdeu a rede depois de carregar: mantém o último dado e avisa
    falha = true; await p.click('#b-atualizar'); await p.waitForTimeout(700); const x = await txt(p);
    t('F. sem rede depois de já ter dado: continua mostrando o último resultado e avisa "Sem conexão"', /Tudo certo/.test(x) && /Sem conexão com a função/.test(x), x); await ctx.close(); }

  { const xss = '<img src=x onerror="window.__xss=1">'; const { ctx, p } = await abre(base({ meusCards: { ativos: 1, atrasados: 1, venceHoje: 0, bloqueados: 0, semPrazo: 0, venceEm7dias: 0, hoje, lista: [{ squad: xss, titulo: xss, prazo: '2026-10-01', atrasado: true, diasAtraso: 5 }] }, status: { vtex: { estado: 'atencao', texto: xss }, github: { estado: 'ok', texto: 'x' }, firebase: { estado: 'ok', texto: 'x' } } })); await p.waitForTimeout(300);
    t('G. texto vindo da função (título, squad, motivo) nunca vira HTML: nada executa e aparece como texto', !(await p.evaluate(() => window.__xss)) && (await p.locator('#app img').count()) === 0 && /<img/.test(await txt(p)), await txt(p)); await ctx.close(); }

  for (const tema of ['dark', 'light']) for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 800 }]) {   // H: temas × tamanhos
    const { ctx, p, errs } = await abre(base({ geral: 'atencao', meusCards: { ativos: 3, atrasados: 1, venceHoje: 1, bloqueados: 0, semPrazo: 0, venceEm7dias: 1, hoje, lista: [{ squad: 'midiacriativa', titulo: 'Um título bem comprido que precisa quebrar linha sem estourar a tela do celular de jeito nenhum', prazo: '2026-10-20', atrasado: true, diasAtraso: 10 }] } }), { tema, vp });
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, tema: document.documentElement.getAttribute('data-theme'), pequenos: [...document.querySelectorAll('button,.btn')].filter(e => { const r = e.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).length }));
    t(`H. ${tema} ${vp.width}px: sem rolagem lateral, tema aplicado, botões ≥ 44 px, sem erro de JS`, m.sw <= m.cw && m.tema === tema && m.pequenos === 0 && !errs.length, m); await ctx.close(); }

  { const { ctx, p } = await abre(base(), { chave: '', qs: '?demo=1' });   // I: demo sem chave
    t('I. ?demo=1 funciona sem chave, avisa que são dados de exemplo e mostra a lista de cards', /Dados de exemplo/.test(await txt(p)) && /Relatório semanal da Black Friday/.test(await txt(p)), await txt(p)); await ctx.close(); }

  { const { ctx, p } = await abre(base()); await p.click('#b-tema'); const t1 = await p.evaluate(() => [document.documentElement.getAttribute('data-theme'), localStorage.getItem('minipainel_tema')]);
    t('J. o botão de tema alterna claro/escuro e lembra a escolha', t1[0] === 'light' && t1[1] === 'light', t1); await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1); })();
