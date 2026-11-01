// TESTE DE CONTRATO — Assistente Férias (oceano-dev) cria o card de bug na coluna "🐛 Bugs" da squad Dados; o MARÉ (kanban-dev) tem que
// ENTENDER e MOSTRAR esse card. Duas páginas, uma só verdade: o que o Oceano grava é o que o Maré lê.
//
// Por que existe: em 16/10/2026 um /monitorarbugs "corrigiu" o card olhando só o código e afirmou contratos que não eram verdade
// (prioridade em português, `created` como data) — o Maré ficou com select de prioridade vazio e "Criado por 16/10/2026".
// Este teste dirige o Oceano de verdade (window.feriasSincronizarCardSquadDados) e abre o card no Maré de verdade, com o Firebase falso.
//
// Roda:   (na raiz do repositório)  python3 -m http.server 8941 &   e depois   node docs/arezzo/testes/test_ferias_card_contrato.js
// Env:    BASE=http://localhost:8941   OC=oceano-dev   K=kanban-dev
// Regra:  mexeu em feriasMontarCardBugDados / feriasSincronizarCardSquadDados / kanbanSchemaV? Rode ANTES de abrir o PR. Mudou o contrato de
//         propósito (o Maré mudou)? Atualize este teste NO MESMO PR e diga no PR qual linha do Maré prova o novo contrato.
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const BASE = process.env.BASE || 'http://localhost:8941', OC = process.env.OC || 'oceano-dev', K = process.env.K || 'kanban-dev';
let falhas = 0; const t = (n, c, d) => { if (!c) falhas++; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 380))); };
const U = (uid, n) => ({ uid, email: uid + '@ciahering.com.br', displayName: n, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const PRIORIDADES_DO_MARE = ['critical', 'high', 'medium', 'low'];   // <select id="m-priority"> / #f-priority em kanban-dev.html
const seed = () => ({ kanban: {
  usuarios: { ana: { uid: 'ana', nome: 'Ana Silva', email: 'ana@ciahering.com.br', init: 'AS', role: 'adm', inscrito: true, squads: { dados: true } } },
  usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana Silva', init: 'AS', role: 'adm', squads: { dados: true } } },
  config: { adm_emails: ['ana@ciahering.com.br'] },
  squads: { dados: { dados: { columns: [
    { id: 'backlog', name: 'Backlog', color: '#888888' }, { id: 'todo', name: 'A Fazer', color: '#38b6ff' }, { id: 'done', name: 'Concluído', color: '#639922', collapsible: true }] } } },
} });
const BUG = (n, impacto, extra) => Object.assign({ id: 'bug_ferias_t' + n, texto: 'Botão Salvar não responde ' + n, msg: 'Botão Salvar não responde ' + n, app: 'Maré Digital',
  arquivoAlvo: 'kanban-dev.html', impacto, autor: 'Eve Souza', uid: 'eve', status: 'pendente_monitorarbugs', criadoEm: Date.now() }, extra || {});

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const base = 'kanban/squads/dados/dados';

  // ───────── A) OCEANO grava ─────────
  const c1 = await b.newContext({ viewport: { width: 1280, height: 800 } }); await fake.install(c1, seed());
  const p1 = await c1.newPage(); const errsA = []; p1.on('pageerror', e => errsA.push(e.message));
  await p1.goto(`${BASE}/${OC}.html?ferias=1`); await p1.waitForFunction(() => !!window.__authCb); await p1.evaluate(x => window.__authCb(x), U('ana', 'Ana Silva')); await p1.waitForTimeout(2500);
  const cria = (bug, ev) => p1.evaluate(([bg, e]) => window.feriasSincronizarCardSquadDados(bg, e), [bug, ev || 'aberto']);
  const dados = () => p1.evaluate(() => JSON.parse(JSON.stringify(window.__store.kanban.squads.dados.dados)));
  const bugs = [BUG(1, '🔴 Bloqueia a operação'), BUG(2, '🟠 Atrapalha muito'), BUG(3, '🟡 Dá pra contornar')];
  const ids = []; for (const bg of bugs) ids.push(await cria(bg));
  t('O Oceano devolve o id do card criado (c_ferias_…)', ids.every(i => /^c_ferias_/.test(i || '')), ids);
  const snapAntes = await p1.evaluate(() => JSON.parse(JSON.stringify(window.__store)));   // Maré abre ESTE estado (card recém-criado, ainda aberto)
  let d = await dados(); const cards = Object.values(d.cards || {}); const card = id => cards.find(c => c.id === id);
  const c1c = card(ids[0]), c2c = card(ids[1]), c3c = card(ids[2]);

  t('Coluna 🐛 Bugs criada ANTES de "Concluído" e sem perder as outras colunas', JSON.stringify((d.columns || []).map(c => c.id)) === JSON.stringify(['backlog', 'todo', 'col_bugs', 'done']), (d.columns || []).map(c => c.id));
  t('Os 3 cards nascem em col_bugs e cada um ocupa uma chave própria em cards_index', cards.length === 3 && cards.every(c => c.col === 'col_bugs') && new Set(Object.values(d.cards_index || {})).size === 3, d.cards_index);
  t('PRIORIDADE usa os valores do Maré (critical|high|medium|low) — kanban-dev.html <select id="m-priority">', [c1c, c2c, c3c].every(c => c && PRIORIDADES_DO_MARE.includes(c.priority)), [c1c && c1c.priority, c2c && c2c.priority, c3c && c3c.priority]);
  t('Impacto → prioridade: Bloqueia = critical · Atrapalha = high · Dá pra contornar = medium', c1c.priority === 'critical' && c2c.priority === 'high' && c3c.priority === 'medium', [c1c.priority, c2c.priority, c3c.priority]);
  t('`created` é QUEM criou (nome/iniciais), nunca uma data — kanban-dev.html grava `created:user` e mostra "por ${card.created}"', typeof c1c.created === 'string' && c1c.created.length > 0 && !/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(c1c.created) && !/^\d{4}-\d{2}-\d{2}/.test(c1c.created), c1c.created);
  t('`created` é o autor do relato (Eve Souza), não quem estava logado', /Eve/.test(c1c.created), c1c.created);
  t('`createdAt` é a data ISO AAAA-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(c1c.createdAt || ''), c1c.createdAt);
  t('Checklist: 3 itens com texto (em `text` e `t`, que o Maré lê nos dois lugares)', Array.isArray(c1c.checklist) && c1c.checklist.length === 3 && c1c.checklist.every(i => i.text && i.t && typeof i.done === 'boolean'), c1c.checklist);
  t('Histórico no formato do Maré {who, what, at} (recordHistory em kanban-dev.html)', Array.isArray(c1c.history) && c1c.history.length >= 1 && c1c.history.every(h => h.who && h.what && /^\d{4}-\d{2}-\d{2}T/.test(h.at || '')), c1c.history);
  t('Impedimento: "Bloqueia a operação" liga blocker + blockerReason; os outros não', c1c.blocker === true && !!c1c.blockerReason && !c3c.blocker, [c1c.blocker, c3c.blocker]);
  t('flow no formato do recordMove: enteredAt[col] ISO + log[]', !!(c1c.flow && c1c.flow.enteredAt && /^\d{4}-/.test(c1c.flow.enteredAt.col_bugs || '') && Array.isArray(c1c.flow.log)), c1c.flow);

  // idempotência e ciclo de status (mesmo card, não duplica, preserva histórico)
  // o status vem de bugObj.status (o 2º parâmetro só entra no texto do histórico): o app muda o status do bug e então sincroniza
  await cria(Object.assign({}, bugs[0], { status: 'em_analise' }), 'em_analise'); await cria(Object.assign({}, bugs[0], { status: 'resolvido' }), 'resolvido'); d = await dados(); const dep = Object.values(d.cards || {});
  const r1 = dep.find(c => c.id === ids[0]);
  t('Mudar o status (em análise → resolvido) NÃO duplica o card e mantém a chave em cards_index', dep.length === 3 && Object.keys(d.cards_index).length === 3, [dep.length, d.cards_index]);
  t('…e acrescenta ao histórico (não apaga o que já tinha) e limpa o impedimento ao resolver', r1.history.length >= 3 && r1.history[0].what === c1c.history[0].what && !r1.blocker, [r1.history.length, r1.blocker]);
  t('…e o checklist fica todo concluído quando resolvido', r1.checklist.every(i => i.done === true), r1.checklist);
  t('Oceano sem erro de JS', errsA.length === 0, errsA);
  await c1.close();

  // ───────── B) MARÉ lê e mostra (o que a PESSOA vê) ─────────
  const c2 = await b.newContext({ viewport: { width: 1400, height: 900 } }); await fake.install(c2, snapAntes);
  const p2 = await c2.newPage(); const errsB = []; p2.on('pageerror', e => errsB.push(e.message));
  await p2.goto(`${BASE}/${K}.html?squad=dados`); await p2.waitForFunction(() => !!window.__authCb); await p2.evaluate(x => window.__authCb(x), U('ana', 'Ana Silva')); await p2.waitForTimeout(3500);
  const alvo = ids[0];
  const board = await p2.evaluate(id => { const el = document.querySelector(`[data-id="${id}"]`); const col = el && el.closest('[id^="col-"]'); return { achou: !!el, col: col && col.id, n: document.querySelectorAll('.card[data-id^="c_ferias_"]').length }; }, alvo);
  t('MARÉ: o card aparece no board, dentro da coluna 🐛 Bugs (col-col_bugs)', board.achou && board.col === 'col-col_bugs', board);
  t('MARÉ: os 3 cards do Assistente aparecem', board.n === 3, board);
  await p2.evaluate(id => openCard(id), alvo); await p2.waitForTimeout(900);
  const m = await p2.evaluate(() => { const q = s => document.querySelector(s); const txt = document.body.innerText;
    return { titulo: q('#m-title') && q('#m-title').value, col: q('#m-col') && q('#m-col').value, prio: q('#m-priority') && q('#m-priority').value,
      criado: (txt.match(/Criado por ([^\n·]+)/) || [])[1] || null, ck: [...document.querySelectorAll('.cl-item .cl-it')].map(e => ({ t: e.textContent.trim(), done: e.classList.contains('cl-it-done') })),
      histWho: [...document.querySelectorAll('.hist-who')].map(e => e.textContent.trim()), histBody: [...document.querySelectorAll('.hist-body')].map(e => e.innerText.replace(/\s+/g, ' ')),
      lixo: /\bundefined\b|\bNaN\b|\[object Object\]/.test(txt) }; });
  t('MARÉ (modal): título e coluna certos', /Bug Férias/.test(m.titulo || '') && m.col === 'col_bugs', m);
  t('MARÉ (modal): o select de PRIORIDADE mostra "critical" (se vier vazio, o Oceano gravou um valor que o Maré não conhece)', m.prio === 'critical', m.prio);
  t('MARÉ (modal): "Criado por Eve Souza" — não por uma data', /^Eve Souza/.test((m.criado || '').trim()), m.criado);
  t('MARÉ (modal): checklist com 3 itens com texto, o 1º concluído', m.ck.length === 3 && m.ck.every(i => i.t.length > 3) && m.ck[0].done === true && m.ck[1].done === false, m.ck);
  t('MARÉ (modal): histórico mostra o autor e "Criado via Assistente Férias"', m.histWho.length >= 1 && m.histWho.every(x => x) && /Criado via Assistente Férias/.test(m.histBody.join(' ')), [m.histWho, m.histBody]);
  t('MARÉ (modal): nenhum "undefined" / "NaN" / [object Object] na tela', !m.lixo, m.lixo);
  t('Maré sem erro de JS', errsB.length === 0, errsB);
  await c2.close(); await b.close();
  console.log(falhas ? `\n❌ ${falhas} verificação(ões) falharam — o Maré não entende o que o Oceano grava.` : '\nTUDO OK — o que o Oceano grava é o que o Maré lê.'); process.exit(falhas ? 1 : 0);
})();
