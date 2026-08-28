// Testa só o núcleo puro (validar envelope -> montar plano de writes), sem
// tocar no banco nem no Storage (relatorio_html usa fakes injetados via o
// terceiro argumento de buildWritePlan). Teste de integração ponta a ponta
// (resolveCardKey, applyWritePlan, upload de verdade, o endpoint HTTP) fica
// pro Firebase Emulator Suite — não coberto aqui.

const test = require('node:test');
const assert = require('node:assert/strict');

const { envelope } = require('../schema');
const { buildWritePlan, applyWritePlan, CARDS_PATH, resolveActor, especialistaLabel } = require('../board');
const { makeFakeDb } = require('./fakeDb');
const membersLib = require('../members');
const flowLib = require('../flow');

test('envelope aceita payload v0 válido com outputs comentario e link', () => {
  const result = envelope.safeParse({
    requestId: 'req-abc123',
    cardId: 'c123',
    status: 'success',
    outputs: [
      { type: 'comentario', texto: 'Relatório pronto' },
      { type: 'link', url: 'https://example.com/relatorio', titulo: 'Relatório diário' },
    ],
  });
  assert.equal(result.success, true);
});

test('envelope aceita output relatorio_html', () => {
  const result = envelope.safeParse({
    requestId: 'req-abc123',
    cardId: 'c123',
    status: 'success',
    outputs: [{ type: 'relatorio_html', html: '<html></html>', titulo: 'Relatório Diário' }],
  });
  assert.equal(result.success, true);
});

test('envelope rejeita output de tipo ainda não suportado no v0', () => {
  const result = envelope.safeParse({
    requestId: 'req-abc123',
    cardId: 'c123',
    status: 'success',
    outputs: [{ type: 'checklistItem', texto: 'x', done: true }],
  });
  assert.equal(result.success, false);
});

test('envelope rejeita link sem url válida', () => {
  const result = envelope.safeParse({
    requestId: 'req-abc123',
    cardId: 'c123',
    status: 'success',
    outputs: [{ type: 'link', url: 'not-a-url', titulo: 'x' }],
  });
  assert.equal(result.success, false);
});

test('buildWritePlan monta update multi-path pra comentario', async () => {
  // Path próprio (card_comments/{cardId}), fora da subárvore do card, desde
  // a migração Fase 1.1 (ver cardCommentsPath() em board.js) — precisa de
  // extra.cardId (sempre presente em uso real via http.js) pro path fazer
  // sentido.
  const plan = await buildWritePlan('5', [{ type: 'comentario', texto: 'oi' }], { cardId: 'c5' });
  assert.equal(plan.length, 1);
  assert.equal(plan[0].kind, 'update');
  assert.equal(plan[0].path, 'kanban/squads/dev/dados/card_comments/c5');
  const [commentId, comment] = Object.entries(plan[0].data)[0];
  assert.equal(comment.id, commentId);
  assert.equal(comment.text, 'oi');
});

// ── Identidade do ator (achado real 2026-08-25) ──────────────────────────
// Antes desta rodada, todo output gravava uid:'agente-agil'/author:'Agente
// Ágil' sem distinguir "especialista externo via http.js" de "o próprio
// orquestrador via realHandlers.js" — o mesmo ator sempre, o que tornava
// impossível o orquestrador diferenciar os dois (e o filtro anti-auto-
// disparo de mentionTrigger.js engolia os dois igual). resolveActor()/
// ctx.actor resolvem isso — ver comentário completo em board.js.

test('envelope aceita "especialista" (opcional) sem quebrar payloads antigos que não mandam isso', () => {
  const semEspecialista = envelope.safeParse({ requestId: 'r1', cardId: 'c1', status: 'success', outputs: [] });
  assert.equal(semEspecialista.success, true);

  const comEspecialista = envelope.safeParse({ requestId: 'r2', cardId: 'c1', status: 'success', outputs: [], especialista: 'databricks' });
  assert.equal(comEspecialista.success, true);
  assert.equal(comEspecialista.data.especialista, 'databricks');
});

test('resolveActor(): sem especialista, devolve a identidade do próprio orquestrador (mesma de sempre)', () => {
  const actor = resolveActor(undefined);
  assert.deepEqual(actor, { uid: 'agente-agil', author: 'Agente Ágil', who: 'Agente Ágil', init: '🤖' });
});

test('resolveActor(): com especialista conhecido, devolve identidade PRÓPRIA — nunca a mesma do orquestrador', () => {
  const actor = resolveActor('databricks');
  assert.equal(actor.uid, 'especialista:databricks');
  assert.equal(actor.author, '🔌 Databricks');
  assert.equal(actor.who, '🔌 Databricks');
  assert.notEqual(actor.uid, 'agente-agil');
});

test('especialistaLabel(): especialista desconhecido cai num fallback capitalizado, nunca quebra', () => {
  assert.equal(especialistaLabel('databricks'), 'Databricks');
  assert.equal(especialistaLabel('novo-especialista'), 'Novo-especialista');
});

test('buildWritePlan (comentario): sem extra.especialista, credita "Agente Ágil" — mesmo comportamento de sempre pro orquestrador (realHandlers.js nunca passa especialista)', async () => {
  const plan = await buildWritePlan('5', [{ type: 'comentario', texto: 'oi' }], { cardId: 'c5' });
  const [, comment] = Object.entries(plan[0].data)[0];
  assert.equal(comment.uid, 'agente-agil');
  assert.equal(comment.author, 'Agente Ágil');
});

test('buildWritePlan (comentario): com extra.especialista, credita o especialista — não mais "Agente Ágil"', async () => {
  const plan = await buildWritePlan('5', [{ type: 'comentario', texto: 'métrica caiu 12%' }], { cardId: 'c5', especialista: 'databricks' });
  const [, comment] = Object.entries(plan[0].data)[0];
  assert.equal(comment.uid, 'especialista:databricks');
  assert.equal(comment.author, '🔌 Databricks');
  assert.notEqual(comment.uid, 'agente-agil'); // a checagem que importa: não colide mais com o uid do próprio orquestrador
});

test('buildWritePlan+applyWritePlan (mover_coluna, ponta a ponta com fake db): card.history credita o especialista, nunca "Agente Ágil"', async () => {
  membersLib._resetCacheForTests();
  flowLib._resetCacheForTests();
  const db = makeFakeDb({
    kanban: {
      squads: {
        dev: {
          dados: {
            cards: { 5: { id: 'c5', title: 'Card X', col: 'backlog' } },
            columns: [
              { id: 'backlog', name: 'Backlog' },
              { id: 'done', name: 'Concluído' },
            ],
            config: { flow: { startCols: [], doneCols: ['done'], reportCols: [] } },
          },
        },
      },
      usuarios_publicos: {},
    },
  });

  const plan = await buildWritePlan('5', [
    { type: 'comentario', texto: 'métrica caiu 12%' },
    { type: 'mover_coluna', coluna: 'done' },
  ], { cardId: 'c5', db, especialista: 'databricks' });
  await applyWritePlan(db, plan);

  const squadData = db._data().kanban.squads.dev.dados;
  const card = squadData.cards['5'];
  const [, comment] = Object.entries(squadData.card_comments.c5)[0];
  assert.equal(comment.author, '🔌 Databricks');
  assert.equal(comment.uid, 'especialista:databricks');
  assert.equal(card.history[0].who, '🔌 Databricks');
  assert.notEqual(card.history[0].who, 'Agente Ágil'); // a checagem que importa: não credita mais o orquestrador por engano
});

test('buildWritePlan monta transaction escopada em links pra link', async () => {
  const plan = await buildWritePlan('5', [{ type: 'link', url: 'https://x.com', titulo: 'X' }]);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].kind, 'transaction');
  assert.equal(plan[0].path, `${CARDS_PATH}/5/links`);
  assert.equal(plan[0].preview.url, 'https://x.com');
  const result = plan[0].transform(null);
  assert.equal(result.length, 1);
  assert.equal(result[0].url, 'https://x.com');
});

test('buildWritePlan preserva links existentes na transaction', async () => {
  const plan = await buildWritePlan('5', [{ type: 'link', url: 'https://novo.com', titulo: 'Novo' }]);
  const existing = [{ id: 'lnk1', url: 'https://antigo.com', title: 'Antigo', ts: '2026-01-01' }];
  const result = plan[0].transform(existing);
  assert.equal(result.length, 2);
  assert.equal(result[0], existing[0]);
});

test('buildWritePlan monta transaction escopada em riscos pra risco', async () => {
  const plan = await buildWritePlan('5', [{ type: 'risco', texto: 'Fornecedor pode atrasar a entrega' }]);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].kind, 'transaction');
  assert.equal(plan[0].path, `${CARDS_PATH}/5/riscos`);
  assert.equal(plan[0].preview, 'Fornecedor pode atrasar a entrega');
  const result = plan[0].transform(null);
  assert.equal(result.length, 1);
  assert.equal(result[0], 'Fornecedor pode atrasar a entrega');
});

test('buildWritePlan preserva riscos existentes na transaction', async () => {
  const plan = await buildWritePlan('5', [{ type: 'risco', texto: 'Risco novo' }]);
  const existing = ['Risco antigo'];
  const result = plan[0].transform(existing);
  assert.equal(result.length, 2);
  assert.equal(result[0], 'Risco antigo');
  assert.equal(result[1], 'Risco novo');
});

test('buildWritePlan rejeita output sem builder registrado', async () => {
  await assert.rejects(() => buildWritePlan('5', [{ type: 'tipo_inexistente' }]), (err) => err.code === 'unknown_output_type');
});

test('buildWritePlan (relatorio_html, dryRun) não sobe nada pro Storage, só devolve preview', async () => {
  let uploadCalls = 0;
  const html = '<html><body><img src="data:image/png;base64,QUJD"></body></html>';
  const plan = await buildWritePlan('5', [{ type: 'relatorio_html', html, titulo: 'Relatório Diário' }], {
    cardId: 'c123',
    dryRun: true,
    uploadAndSign: async () => {
      uploadCalls += 1;
      return 'não deveria ter sido chamado';
    },
  });
  assert.equal(uploadCalls, 0, 'dryRun não deveria subir nada pro Storage');
  assert.equal(plan.length, 1);
  assert.equal(plan[0].kind, 'noop');
  assert.equal(plan[0].preview.imagensDetectadas, 1);
  assert.equal(plan[0].preview.titulo, 'Relatório Diário');
});

test('buildWritePlan (relatorio_html, execução real) sobe imagens + html enxuto e reaproveita o step de link', async () => {
  const uploaded = [];
  const html =
    '<html><body><h1>Rel</h1><img src="data:image/png;base64,QUJD"><img src="data:image/png;base64,WFla"></body></html>';
  const plan = await buildWritePlan('5', [{ type: 'relatorio_html', html, titulo: 'Relatório Diário' }], {
    cardId: 'c123',
    dryRun: false,
    reportBasePath: (squadId, cardId) => `relatorios/${squadId}/${cardId}/2026-07-22`,
    uploadAndSign: async (path, buffer, contentType) => {
      uploaded.push({ path, contentType, bytes: buffer.length });
      return `https://fake-storage.example/${path}`;
    },
  });

  // 2 imagens + 1 html = 3 uploads, nessa ordem
  assert.equal(uploaded.length, 3);
  assert.ok(uploaded[0].path.endsWith('imagem-1.png'));
  assert.ok(uploaded[1].path.endsWith('imagem-2.png'));
  assert.ok(uploaded[2].path.endsWith('relatorio.html'));
  assert.equal(uploaded[2].contentType, 'text/html; charset=utf-8');
  assert.ok(uploaded[0].path.includes('relatorios/dev/c123/'), 'path deve usar o squad e o cardId de verdade');

  // plano final: mesma forma que buildLinkStep produz pro output "link"
  assert.equal(plan.length, 1);
  assert.equal(plan[0].kind, 'transaction');
  assert.equal(plan[0].path, `${CARDS_PATH}/5/links`);
  assert.equal(plan[0].preview.title, 'Relatório Diário');
  assert.ok(plan[0].preview.url.endsWith('relatorio.html'));
});
