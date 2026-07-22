// Testa só o núcleo puro (validar envelope -> montar plano de writes), sem
// tocar no banco nem no Storage (relatorio_html usa fakes injetados via o
// terceiro argumento de buildWritePlan). Teste de integração ponta a ponta
// (resolveCardKey, applyWritePlan, upload de verdade, o endpoint HTTP) fica
// pro Firebase Emulator Suite — não coberto aqui.

const test = require('node:test');
const assert = require('node:assert/strict');

const { envelope } = require('../schema');
const { buildWritePlan, CARDS_PATH } = require('../board');

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
  const plan = await buildWritePlan('5', [{ type: 'comentario', texto: 'oi' }]);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].kind, 'update');
  assert.equal(plan[0].path, `${CARDS_PATH}/5/comments`);
  const [commentId, comment] = Object.entries(plan[0].data)[0];
  assert.equal(comment.id, commentId);
  assert.equal(comment.text, 'oi');
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

test('buildWritePlan rejeita output sem builder registrado', async () => {
  await assert.rejects(() => buildWritePlan('5', [{ type: 'mover_coluna' }]));
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
  assert.ok(uploaded[0].path.includes('relatorios/ecomm/c123/'), 'path deve usar o squad e o cardId de verdade');

  // plano final: mesma forma que buildLinkStep produz pro output "link"
  assert.equal(plan.length, 1);
  assert.equal(plan[0].kind, 'transaction');
  assert.equal(plan[0].path, `${CARDS_PATH}/5/links`);
  assert.equal(plan[0].preview.title, 'Relatório Diário');
  assert.ok(plan[0].preview.url.endsWith('relatorio.html'));
});
