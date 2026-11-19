// ⏱ Relógio opcional da reunião ao vivo do Radar (#1904, etapa 1). Ao clicar em Apresentar ao vivo: iniciar com cronômetro, sem cronômetro ou cancelar.
// O relógio fica na sessão (apresentacao_live/relogio), em horário do servidor, e vale para a sala inteira.
const { chromium } = require(process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright');
const fake = require('./fakefb.js');
const BASE = process.env.APRESENTACAO_TEST_URL || 'http://localhost:8941';
const U = (uid, n) => ({ uid, email: uid + '@ciahering.com.br', displayName: n, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const mk = (id, t, o) => ({ id, titulo: t, areaId: 'geral', trimestres: ['2026-Q4'], responsaveis: ['ana'], tagIds: [], history: [], indicadores: ['i1'], progressos: ['p1'], proximosPassos: [], riscos: [], planosAcao: [], descricao: 'd', torre: 'digital', ...o });
const AGORA = new Date('2026-11-20T13:30:00.000Z');   // 10:30 em São Paulo
const HOJE = '2026-11-20';
const SP = (hhmm, data = HOJE) => Date.parse(data + 'T' + hhmm + ':00-03:00');
const seed = (extra = {}) => ({ '.info': { serverTimeOffset: extra.offset || 0 }, kanban: { okr: { objetivos: { d1: mk('d1', 'Fidelidade', { areaId: 'crm' }), d2: mk('d2', 'Checkout', { areaId: 'tech' }) }, marcos: {}, tags: {}, reuniao_notas: {},
  reuniao_agenda: extra.agenda ? { [HOJE]: extra.agenda } : {} },
  usuarios: { ana: { uid: 'ana', nome: 'Ana ADM', email: 'ana@ciahering.com.br', inscrito: true }, eve: { uid: 'eve', nome: 'Eve Souza', email: 'eve@ciahering.com.br', inscrito: true } },
  usuarios_publicos: { ana: { nome: 'Ana ADM' }, eve: { nome: 'Eve Souza' } }, config: { adm_emails: ['ana@ciahering.com.br'] } } });
const NO = 'kanban/okr/apresentacao_live';
async function sync(from, to) {
  const n = await from.evaluate(() => JSON.stringify(((window.__store.kanban || {}).okr || {}).apresentacao_live || null));
  await to.evaluate(([n, NO]) => { const v = JSON.parse(n), st = window.__store; st.kanban.okr.apresentacao_live = v;
    (window.__lis || []).filter(l => l.p === NO).forEach(l => l.cb({ val: () => v === null ? null : JSON.parse(JSON.stringify(v)), exists: () => v !== null, key: 'apresentacao_live' })); }, [n, NO]);
  await to.waitForTimeout(250);
}
let falhas = 0; const t = (n, ok, d) => { if (!ok) falhas++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const open = async (user, opts = {}) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: opts.fuso || 'America/Sao_Paulo' }); await fake.install(ctx, seed(opts));
    const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message)); p.on('dialog', d => d.accept());
    await p.clock.setFixedTime(new Date(AGORA.getTime() + (opts.desvio || 0)));
    await p.goto(BASE + (opts.caminho || '/okr-apresentacao.slide.html')); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), user); await p.waitForTimeout(1500);
    return { ctx, p, erros };
  };
  const sessao = p => p.evaluate(() => window.__store.kanban.okr.apresentacao_live || null);
  const contagem = p => p.evaluate(() => { const e = document.getElementById('tb-countdown'); return e.hidden ? '(escondida)' : e.textContent; });
  const abrir = async p => { await p.click('#live-box button'); await p.waitForSelector('#inicio-ov.open'); };
  try {
    // 1) Cancelar e Esc não criam sessão
    { const A = await open(U('ana', 'Ana ADM'));
      await abrir(A.p);
      const opcoes = await A.p.evaluate(() => [...document.querySelectorAll('#inicio-ov .inicio-acoes button')].map(b => b.textContent));
      t('Apresentar ao vivo oferece com cronômetro, sem cronômetro e Cancelar', opcoes.join('|') === 'Iniciar com cronômetro|Iniciar sem cronômetro|Cancelar', opcoes);
      await A.p.click('#inicio-cancelar'); await A.p.waitForTimeout(200);
      t('Cancelar fecha sem criar sessão', !(await sessao(A.p)) && !(await A.p.evaluate(() => document.getElementById('inicio-ov').classList.contains('open'))), '');
      await abrir(A.p); await A.p.keyboard.press('Escape'); await A.p.waitForTimeout(200);
      t('Esc fecha sem criar sessão', !(await sessao(A.p)) && !(await A.p.evaluate(() => document.getElementById('inicio-ov').classList.contains('open'))), '');
      // 2) sem término: com cronômetro pede o término; duração funciona
      await abrir(A.p); await A.p.click('#inicio-com'); await A.p.waitForTimeout(200);
      t('sem agenda nem Calendário, "com cronômetro" pede término ou duração e não inicia', !(await sessao(A.p)) && /término ou a duração/.test(await A.p.textContent('#inicio-erro')), await A.p.textContent('#inicio-erro'));
      await A.p.fill('#inicio-duracao', '50'); await A.p.click('#inicio-com'); await A.p.waitForTimeout(400);
      const s1 = await sessao(A.p);
      t('duração vira término a partir do início real', s1?.relogio?.modo === 'cronometro' && s1.relogio.fimEm === AGORA.getTime() + 50 * 60000 && s1.relogio.inicioEm === AGORA.getTime() && s1.relogio.origem === 'manual' && !!s1.sessaoId, s1?.relogio);
      t('contagem mostra decorrido e restante', (await contagem(A.p)) === '⏱ 0min decorridos · ⏳ 50min restantes', await contagem(A.p));
      // 3) passar e retomar o controle não mexem no relógio; outra tela (com relógio 3 min adiantado) vê o mesmo
      const B = await open(U('eve', 'Eve Souza'), { desvio: 180000, offset: -180000 });
      await sync(A.p, B.p);
      t('outra tela, com o relógio do computador fora, mostra o mesmo tempo', (await contagem(B.p)) === (await contagem(A.p)), [await contagem(B.p), await contagem(A.p)]);
      await A.p.evaluate(() => window._livePassar('eve', 'Eve Souza')); await A.p.waitForTimeout(300); await sync(A.p, B.p);
      await B.p.evaluate(() => window._liveAssumir()); await B.p.waitForTimeout(300); await sync(B.p, A.p);
      await A.p.evaluate(() => window._liveAssumir()); await A.p.waitForTimeout(300);
      const s2 = await sessao(A.p);
      t('trocar de apresentador e retomar conservam o relógio da sala', JSON.stringify(s2.relogio) === JSON.stringify(s1.relogio) && s2.sessaoId === s1.sessaoId, [s1.relogio, s2.relogio]);
      // 4) "Configurar horário" no meio da sessão ajusta o término dela
      await A.p.evaluate(() => { window._okrToggleAgendaCfg(); document.getElementById('agenda-inicio').value = '10:00'; document.getElementById('agenda-fim').value = '11:40'; window._okrAgendaSalvar(); });
      await A.p.waitForTimeout(300);
      t('Configurar horário durante a sessão ajusta o término da sessão', (await sessao(A.p)).relogio.fimEm === SP('11:40'), (await sessao(A.p)).relogio);
      t('sem erro de JavaScript (cronômetro)', !A.erros.length && !B.erros.length, [A.erros, B.erros]);
      await A.ctx.close(); await B.ctx.close(); }
    // 5) agenda do dia é reaproveitada
    { const A = await open(U('ana', 'Ana ADM'), { agenda: { inicio: '10:00', fim: '11:15' } });
      await abrir(A.p);
      t('agenda do dia vem sugerida e editável', (await A.p.inputValue('#inicio-fim')) === '11:15' && /configurado para hoje/.test(await A.p.textContent('#inicio-origem')), await A.p.inputValue('#inicio-fim'));
      await A.p.click('#inicio-com'); await A.p.waitForTimeout(400);
      const s = await sessao(A.p);
      t('início atrasado não prorroga o término da agenda', s.relogio.fimEm === SP('11:15') && s.relogio.origem === 'agenda', s.relogio);
      t('contagem: 45 min restantes às 10:30', (await contagem(A.p)) === '⏱ 0min decorridos · ⏳ 45min restantes', await contagem(A.p));
      await A.ctx.close(); }
    // 6) Calendário: término da ocorrência; fuso do computador não importa
    { const hash = '#' + new URLSearchParams({ reuniao: 'ritual', data: HOJE, objetivos: '["d1","d2"]', inicio: '10:00', fim: '11:00' });
      const A = await open(U('ana', 'Ana ADM'), { caminho: '/okr-apresentacao.slide.html' + hash, fuso: 'Asia/Tokyo' });
      await abrir(A.p);
      t('ocorrência do Calendário sugere o término dela', (await A.p.inputValue('#inicio-fim')) === '11:00' && /Calendário/.test(await A.p.textContent('#inicio-origem')), await A.p.inputValue('#inicio-fim'));
      await A.p.fill('#inicio-fim', '11:10'); await A.p.click('#inicio-com'); await A.p.waitForTimeout(400);
      const s = await sessao(A.p);
      t('término ajustado vale em São Paulo mesmo com o computador em Tóquio', s.relogio.fimEm === SP('11:10') && s.relogio.origem === 'manual', s.relogio);
      await A.ctx.close(); }
    { const hash = '#' + new URLSearchParams({ reuniao: 'ritual', data: '2026-11-18', objetivos: '["d1"]', inicio: '10:00', fim: '11:00' });
      const A = await open(U('ana', 'Ana ADM'), { caminho: '/okr-apresentacao.slide.html' + hash });
      await abrir(A.p);
      t('pauta de outro dia não sugere o término em silêncio', (await A.p.inputValue('#inicio-fim')) === '' && /18\/11\/2026/.test(await A.p.textContent('#inicio-origem')), await A.p.textContent('#inicio-origem'));
      await A.ctx.close(); }
    // 7) sem cronômetro
    { const A = await open(U('ana', 'Ana ADM'), { agenda: { inicio: '10:00', fim: '11:15' } });
      await abrir(A.p); await A.p.click('#inicio-sem'); await A.p.waitForTimeout(400);
      const s = await sessao(A.p);
      t('sem cronômetro grava modo livre (fica fora do histórico da previsão)', s.relogio.modo === 'livre' && s.relogio.fimEm == null, s.relogio);
      t('sem cronômetro esconde a contagem, mesmo com agenda no dia', (await contagem(A.p)) === '(escondida)', await contagem(A.p));
      await A.ctx.close(); }
    // 8) outra pessoa iniciou enquanto o diálogo estava aberto: não sobrescreve
    { const A = await open(U('ana', 'Ana ADM'));
      await abrir(A.p);
      await A.p.evaluate(() => { const st = window.__store.kanban.okr; st.apresentacao_live = { ativa: true, sessaoId: 'outra', apresentador: { uid: 'eve', nome: 'Eve Souza' }, iniciadoEm: Date.now(), atualizadoEm: Date.now(), relogio: { modo: 'livre', inicioEm: Date.now(), origem: 'manual' }, slide: 'cover' }; });
      await A.p.fill('#inicio-duracao', '30'); await A.p.click('#inicio-com'); await A.p.waitForTimeout(400);
      const s = await sessao(A.p);
      t('não sobrescreve uma sessão iniciada por outra pessoa enquanto o diálogo estava aberto', s.sessaoId === 'outra' && s.apresentador.uid === 'eve', s);
      await A.ctx.close(); }
    // 9) clique duplo inicia uma vez só
    { const A = await open(U('ana', 'Ana ADM'));
      await abrir(A.p); await A.p.fill('#inicio-duracao', '30');
      await A.p.evaluate(() => { window._liveIniciar(true); window._liveIniciar(true); }); await A.p.waitForTimeout(400);
      t('clique duplo em Iniciar faz uma transação só', (await A.p.evaluate(() => window.__log.filter(x => x[0] === 'transaction' && x[1] === 'kanban/okr/apresentacao_live').length)) === 1, await A.p.evaluate(() => window.__log.filter(x => x[0] === 'transaction')));
      await A.ctx.close(); }
    // 10) valor estranho gravado por fora não quebra a contagem
    { const A = await open(U('ana', 'Ana ADM'));
      await abrir(A.p); await A.p.click('#inicio-sem'); await A.p.waitForTimeout(300);
      await A.p.evaluate(() => { const st = window.__store.kanban.okr.apresentacao_live; st.relogio = { modo: '<img src=x onerror=alert(1)>', fimEm: 'abc' };
        (window.__lis || []).filter(l => l.p === 'kanban/okr/apresentacao_live').forEach(l => l.cb({ val: () => JSON.parse(JSON.stringify(st)), exists: () => true, key: 'x' })); });
      await A.p.waitForTimeout(1300);
      t('relógio inválido no banco é ignorado sem erro', !A.erros.length && !(await A.p.evaluate(() => document.querySelector('#tb-countdown img'))), A.erros);
      await A.ctx.close(); }
    // 11) sessão iniciada antes desta versão (sem `relogio`) com agenda no dia: mantém a contagem antiga
    { const A = await open(U('ana', 'Ana ADM'), { agenda: { inicio: '10:00', fim: '11:15' } });
      await A.p.evaluate(() => { const st = window.__store.kanban.okr; st.apresentacao_live = { ativa: true, apresentador: { uid: 'ana', nome: 'Ana ADM' }, iniciadoEm: Date.now(), atualizadoEm: Date.now(), slide: 'cover' };
        (window.__lis || []).filter(l => l.p === 'kanban/okr/apresentacao_live').forEach(l => l.cb({ val: () => JSON.parse(JSON.stringify(st.apresentacao_live)), exists: () => true, key: 'x' })); });
      await A.p.waitForTimeout(400);
      t('sessão antiga, sem relógio: a contagem da agenda continua aparecendo', (await contagem(A.p)) === '⏳ 45min restantes', await contagem(A.p));
      t('sem erro de JavaScript (sessão antiga)', !A.erros.length, A.erros);
      await A.ctx.close(); }
  } finally { await b.close(); }
  console.log(falhas ? `\n${falhas} falha(s)` : '\nTUDO OK'); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
