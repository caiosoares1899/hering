// 🔗 Menção de card (@card:) — busca por palavras em qualquer ordem, popup que não abre depois de uma frase comum, quebra de linha fecha. Playwright + Firebase falso.
//   python3 -m http.server 8941 &   node docs/arezzo/testes/test_mencao_card.js   (PW_MODULE / CHROME_PATH para rodar fora do sandbox Linux)
const { chromium } = require(process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const K = process.env.K || 'kanban-dev', SQ = 'midiacriativa';
const U = { uid: 'eve', email: 'eve@ciahering.com.br', displayName: 'Eve', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const flow = col => ({ enteredAt: { [col]: '2026-10-20T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-10-20T12:00:00.000Z' }], firstStartAt: null, doneAt: null });
const card = (id, title, extra) => Object.assign({ id, title, col: 'doing', createdAt: '2026-10-20', desc: 'x', flow: flow('doing'), updatedAt: '2026-10-26T10:00:00.000Z' }, extra || {});
const seed = () => { const cards = { 0: card('c0', 'Reunião semanal de resultados'), 1: card('c1', 'Relatório da Black Friday'), 2: card('c2', 'Reunião com a VTEX'), 3: card('c3', 'Card arquivado de reunião', { archived: true }) }, idx = {}, upd = {}, arq = { c3: true };
  Object.entries(cards).forEach(([k, c]) => { idx[c.id] = String(k); upd[c.id] = c.updatedAt; });
  return { kanban: { usuarios: { eve: { uid: 'eve', nome: 'Eve', email: 'eve@ciahering.com.br', inscrito: true, init: 'EV', role: 'po', squads: { [SQ]: true } }, ana: { uid: 'ana', nome: 'Ana Silva', email: 'ana@ciahering.com.br', inscrito: true, init: 'AS', role: 'membro', squads: { [SQ]: true } } },
    usuarios_publicos: { eve: { uid: 'eve', nome: 'Eve', init: 'EV', role: 'po', squads: { [SQ]: true } }, ana: { uid: 'ana', nome: 'Ana Silva', init: 'AS', role: 'membro', squads: { [SQ]: true } } }, config: { adm_emails: [] },
    squads: { [SQ]: { dados: { cards, cards_index: idx, cards_updated_at: upd, cards_archived: arq, columns: [{ id: 'doing', name: 'Fazendo' }] } } } } }; };
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); await fake.install(ctx, seed()); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8941/' + K + '.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(3000);
  // textarea + dropdown de teste, chamando a função REAL da página
  const tenta = (valor, caret) => p.evaluate(({ valor, caret }) => { let ta = document.getElementById('t-mc'), dd = document.getElementById('d-mc');
    if (!ta) { ta = document.createElement('textarea'); ta.id = 't-mc'; dd = document.createElement('div'); dd.id = 'd-mc'; dd.className = 'mention-dd'; document.body.append(ta, dd); }
    ta.value = valor; ta.selectionStart = ta.selectionEnd = (caret == null ? valor.length : caret); handleMentionInput(ta, dd);
    return { aberto: dd.classList.contains('open'), texto: dd.innerText, modo: (typeof _mentionActive !== 'undefined' && _mentionActive) ? _mentionActive.mode : null }; }, { valor, caret });
  t('boot: handleMentionInput existe e os cards carregaram', await p.evaluate(() => typeof handleMentionInput === 'function' && cards.length >= 3), '');
  let r = await tenta('@card:reunião semanal'); t('A. frase contígua com espaço acha o card', r.aberto && /Reunião semanal de resultados/.test(r.texto), r);
  r = await tenta('@card:semanal reunião'); t('B. as MESMAS palavras em outra ordem também acham (cada palavra separada)', r.aberto && /Reunião semanal de resultados/.test(r.texto), r);
  r = await tenta('@card:reun'); t('C. prefixo acha os dois cards de reunião (e não o arquivado)', r.aberto && /Reunião semanal/.test(r.texto) && /Reunião com a VTEX/.test(r.texto) && !/arquivado/.test(r.texto), r);
  r = await tenta('@card:reunião  vtex'); t('D. espaços repetidos entre as palavras não atrapalham', r.aberto && /Reunião com a VTEX/.test(r.texto) && !/semanal/.test(r.texto), r);
  r = await tenta('@card:inexistente xyz'); t('E. sem resultado: o popup fecha', !r.aberto, r);
  r = await tenta('Oi @ana tudo bem'); t('F. menção de PESSOA: depois de um espaço o popup fecha (como sempre foi)', !r.aberto, r);
  r = await tenta('Oi @an'); t('G. menção de pessoa sem espaço abre o popup de pessoas', r.aberto && r.modo !== 'card', r);
  r = await tenta('@card:reun\noutra linha'); t('H. quebra de linha encerra a busca de card', !r.aberto, r);
  r = await tenta('texto sem arroba'); t('I. sem @ nada abre', !r.aberto, r);
  t('J. sem erro de JS', errs.length === 0, errs);
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1); })();
