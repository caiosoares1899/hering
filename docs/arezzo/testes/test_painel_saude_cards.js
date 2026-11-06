// 🛡️ Painel (painel-dev) › 🔋 Status › Saúde dos cards — fila de ação (abas), acordeão, "Resolver" (marcador, nunca apaga), "Resolver os antigos" e a bolinha de saúde do guardião.
// Playwright + Firebase falso. Roda no sandbox Linux (padrão) ou em qualquer máquina com Playwright: PW_MODULE=/caminho/playwright CHROME_PATH=/caminho/chrome
//   python3 -m http.server 8941 &   node docs/arezzo/testes/test_painel_saude_cards.js        (capturas em CAPTURAS=/pasta)
const { chromium } = require(process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const PAGE = process.env.PAGE || 'painel-dev.html', OUT = process.env.CAPTURAS || '/tmp';
const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana ADM', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const ago = h => new Date(Date.now() - h * 3600000).toISOString();
const seed = ({ incidentes = true, status = 'ok', role = 'adm' } = {}) => ({ kanban: { usuarios: { ana: { uid: 'ana', nome: 'Ana', email: 'ana@ciahering.com.br', inscrito: true, init: 'AA', role, squads: { dados: true, midiacriativa: true } } },
  usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana', init: 'AA', role, squads: { dados: true, midiacriativa: true } } }, config: { adm_emails: role === 'adm' ? ['ana@ciahering.com.br'] : [] },
  cards_guardiao: incidentes ? { midiacriativa: { incidentes: {
    g1: { cardId: 'c1', titulo: '[Google] Pmax <img src=x onerror=alert(1)> REGATAS', acao: 'restaurado', detectadoEm: ago(3), causaCodigo: 'fila_offline', causaTexto: 'Save ficou retido ~22s <b>x</b>', causadoPor: { por: 'Juliana <img src=y onerror=alert(2)>', ver: 'v8.30.905-dev', origem: 'reordenarColuna' } },
    g2: { cardId: 'c2', titulo: 'Card sem cópia', acao: 'sem_espelho', detectadoEm: ago(30), causaCodigo: 'sem_carimbo', causaTexto: 'Nenhum carimbo de gravação encontrado' },
    g3: { cardId: 'c3', titulo: '', acao: 'em_massa', detectadoEm: ago(24 * 9) },
    g4: { cardId: 'c4', titulo: 'Card que some sempre', acao: 'reincidente', detectadoEm: ago(24 * 10) },
    g6: { cardId: 'c6', titulo: 'Já tratado', acao: 'sem_espelho', detectadoEm: ago(24 * 3), contexto: { ultimaEscritaEstrutural: { por: 'Vinicius', ver: 'v8.30.906', origem: 'salvar', haSeg: 4 } } },
    g5: { cardId: 'velho', titulo: 'Fora da janela de 30 dias', acao: 'sem_espelho', detectadoEm: ago(24 * 40) } },
    resolvidos: { g6: { por: 'Caio', uid: 'caio', em: ago(20) } } },
    dados: { incidentes: { d1: { cardId: 'd1', titulo: 'T'.repeat(300), acao: 'restaurado', detectadoEm: ago(50) } } },
    ...(status === 'ok' ? { _status: { ts: ago(0.05), ok: true, atrasoMaxMin: 0, abertosTotal: 3, squads: {} } } : status === 'velho' ? { _status: { ts: ago(0.5), ok: true, atrasoMaxMin: 0, abertosTotal: 0, squads: {} } } : status === 'atrasado' ? { _status: { ts: ago(0.02), ok: false, atrasoMaxMin: 12, abertosTotal: 0, squads: {} } } : {}) } : undefined,
  squads: { dados: { dados: {} },
    midiacriativa: { dados: { cards_incidentes_sumico: incidentes ? {
      i1: { cardId: 'c1', cardTitle: 'outro título', detectadoEm: ago(3.001) },          // já socorrido pelo guardião (g1): não duplica
      i2: { cardId: 'a9', cardTitle: 'Alarme sem restauração', detectadoEm: ago(2) } } : {} } } } } });
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const abre = async (opts, vp) => { const ctx = await b.newContext({ viewport: vp || { width: 1280, height: 900 } }); await fake.install(ctx, seed(opts)); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { errs.push('DIALOG ' + d.message()); d.dismiss(); });
    await p.goto('http://localhost:8941/' + PAGE); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(2500);
    await p.evaluate(() => { SQUADS.splice(0, SQUADS.length, { id: 'dados', label: 'Dados', icon: '📊', color: '#38b6ff', wipLimit: 2 }, { id: 'midiacriativa', label: 'Mídia', icon: '🎨', color: '#1de9b6', wipLimit: 3 }); window._pollSquadDados = () => { }; window._pollSquadSnapshots = () => { }; window.uiConfirm = async () => true; swPtab('status'); }); await p.waitForTimeout(1500); return { ctx, p, errs }; };
  const txt = (p, id) => p.evaluate(i => (document.getElementById(i) || {}).innerText || '', id);
  const store = (p, caminho) => p.evaluate(c => c.split('/').reduce((o, k) => (o == null ? o : o[k]), window.__store), caminho);

  { const { ctx, p, errs } = await abre({});
    const lista = await txt(p, 'sc-lista'), saude = await txt(p, 'sc-resumo'), badge = await txt(p, 'sc-badge');
    t('A. a aba abre na fila "Precisam de você" com contagens nas 3 abas', /Precisam de você \(4\)/.test(lista) && /Restaurados sozinhos \(2\)/.test(lista) && /Resolvidos \(1\)/.test(lista), lista.slice(0, 200));
    t('B. a fila mostra só o que pede ação (sem cópia, em massa, reincidente, alarme sem socorro) — não o restaurado nem o resolvido nem o >30 dias', /Card sem cópia/.test(lista) && /Card que some sempre/.test(lista) && /Alarme sem restauração/.test(lista) && !/Pmax/.test(lista) && !/Já tratado/.test(lista) && !/Fora da janela/.test(lista), lista.slice(0, 500));
    t('C. bolinha de saúde: verde, com texto', /Guardião ativo · pulso há/.test(saude) && await p.evaluate(() => getComputedStyle(document.querySelector('#sc-resumo .sc-dot')).backgroundColor !== 'rgba(0, 0, 0, 0)'), saude);
    t('D. selo do cabeçalho diz quantos precisam de você', /4 precisam de você/.test(badge), badge);
    t('E. "Resolver os antigos" aparece (há episódios com mais de 7 dias) e o aviso do backup também', /Resolver os antigos/.test(lista) && /Antes de recriar um card/.test(lista), lista.slice(0, 400));
    t('F. acordeão: o episódio abre e mostra causa e "autor não identificado" quando o servidor não provou', await p.evaluate(() => { const d = [...document.querySelectorAll('#sc-lista details.sc-item')].find(x => /Card sem cópia/.test(x.innerText)); d.open = true; return /Nenhum carimbo/.test(d.innerText) && /Autor não identificado/.test(d.innerText); }), '');
    await p.screenshot({ path: OUT + '/saude_cards_desktop.png', clip: await p.evaluate(() => { const r = document.getElementById('st-cards-card').getBoundingClientRect(); return { x: r.x, y: Math.max(0, r.y + scrollY), width: r.width, height: r.height }; }).catch(() => undefined) }).catch(() => { });
    // resolver um
    await p.evaluate(() => { [...document.querySelectorAll('#sc-lista details.sc-item')].find(x => /Card sem cópia/.test(x.innerText)).querySelector('[data-sc-acao="resolver"]').click(); }); await p.waitForTimeout(600);
    const r1 = await store(p, 'kanban/cards_guardiao/midiacriativa/resolvidos/g2');
    t('G. "Resolver" grava o marcador com quem e quando, NÃO apaga o incidente e tira da fila', !!r1 && r1.uid === 'ana' && /Ana/.test(r1.por) && !!r1.em && !!(await store(p, 'kanban/cards_guardiao/midiacriativa/incidentes/g2')) && !/Card sem cópia/.test(await txt(p, 'sc-lista')) && /Precisam de você \(3\)/.test(await txt(p, 'sc-lista')), r1);
    // resolver os antigos
    await p.evaluate(() => document.querySelector('[data-sc-acao="resolver-antigos"]').click()); await p.waitForTimeout(800);
    const r3 = await store(p, 'kanban/cards_guardiao/midiacriativa/resolvidos/g3'), r4 = await store(p, 'kanban/cards_guardiao/midiacriativa/resolvidos/g4');
    t('H. "Resolver os antigos" marca os de mais de 7 dias (e só eles) e a fila fica com o alarme recente', !!r3 && !!r4 && /Precisam de você \(1\)/.test(await txt(p, 'sc-lista')) && /Alarme sem restauração/.test(await txt(p, 'sc-lista')), [r3, r4]);
    await p.evaluate(() => document.querySelector('[data-sc-aba="resolvidos"]').click());
    t('I. aba Resolvidos lista quem resolveu e quando', /Resolvido por Caio/.test(await txt(p, 'sc-lista')) && /Resolvidos \(4\)/.test(await txt(p, 'sc-lista')), (await txt(p, 'sc-lista')).slice(0, 300));
    await p.evaluate(() => document.querySelector('[data-sc-aba="restaurados"]').click());
    const rest = await txt(p, 'sc-lista');
    t('J. aba Restaurados: HTML do banco vai ESCAPADO (nenhuma tag, nenhum alert), link para abrir o card', /Pmax/.test(rest) && await p.evaluate(() => !document.querySelector('#sc-lista img, #sc-lista b b, #sc-lista script') && [...document.querySelectorAll('#sc-lista a')].some(a => /opencard=c1/.test(a.href))) && errs.filter(e => /DIALOG/.test(e)).length === 0, [rest.slice(0, 200), errs]);
    t('K. sem erro de JS', errs.filter(e => !/DIALOG/.test(e)).length === 0, errs);
    t('L. sem rolagem lateral no desktop', await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), '');
    for (const th of ['light', 'vice']) { await p.evaluate(x => document.documentElement.setAttribute('data-theme', x), th); await p.waitForTimeout(200);
      t('M. tema ' + th + ': o episódio continua legível (cor do texto definida e diferente do fundo)', await p.evaluate(() => { const e = document.querySelector('#sc-lista .sc-item'); if (!e) return true; const c = getComputedStyle(e.querySelector('.sc-tit')).color, f = getComputedStyle(e).backgroundColor; return !!c && c !== f; }), th);
      await p.screenshot({ path: OUT + '/saude_cards_' + th + '.png' }).catch(() => { }); }
    await ctx.close(); }

  for (const [status, re] of [['velho', /sem pulso há 30 min/], ['atrasado', /espelho atrasado 12 min/], ['nenhum', /aguardando o primeiro pulso/]]) { const { ctx, p } = await abre({ status });
    t('N. bolinha (' + status + '): ' + re, re.test(await txt(p, 'sc-resumo')), await txt(p, 'sc-resumo')); await ctx.close(); }

  { const { ctx, p } = await abre({ incidentes: false });
    t('O. sem incidentes: estado vazio positivo e selo "Tudo certo"', /Nada esperando por você/.test(await txt(p, 'sc-lista')) && /Tudo certo/.test(await txt(p, 'sc-badge')), await txt(p, 'sc-lista')); await ctx.close(); }

  { const { ctx, p } = await abre({ role: 'membro' });
    t('P. sem permissão (membro): nenhum botão de resolver', await p.evaluate(() => !document.querySelector('#sc-lista [data-sc-acao^="resolver"]')), ''); await ctx.close(); }

  { const { ctx, p } = await abre({}, { width: 390, height: 800 });
    t('Q. celular 390 px: sem rolagem lateral', await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), '');
    t('R. celular: abas e botões com alvo de toque razoável (≥ 32 px de altura; 44 px em toque real)', await p.evaluate(() => [...document.querySelectorAll('#sc-lista .sc-chip, #sc-lista .sc-btn')].every(e => e.getBoundingClientRect().height >= 32)), '');
    await p.screenshot({ path: OUT + '/saude_cards_mobile.png', fullPage: false }).catch(() => { }); await ctx.close(); }

  await b.close(); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1); })();
