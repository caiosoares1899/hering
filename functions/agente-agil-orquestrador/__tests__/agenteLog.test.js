// functions/agente-agil-orquestrador/__tests__/agenteLog.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const { resumirAcaoLegivel, coletarAcoesAgente, registrarLogAgente, AUTOMACAO_UID } = require('../agenteLog');

test('resumirAcaoLegivel: gera frase legível pra cada ferramenta mutante', () => {
  assert.equal(resumirAcaoLegivel({ name: 'mover_coluna', input: { coluna: 'done' } }), 'moveu para a coluna "done"');
  assert.equal(resumirAcaoLegivel({ name: 'editar_campos', input: { prioridade: 'alta', responsavel: '' } }), 'editou: prioridade');
  assert.equal(resumirAcaoLegivel({ name: 'editar_campos', input: {} }), 'editou campos do card');
  assert.equal(resumirAcaoLegivel({ name: 'checklist_item', input: { item: 'Revisar copy', done: true } }), 'marcou item do checklist: "Revisar copy"');
  assert.equal(resumirAcaoLegivel({ name: 'checklist_item', input: { item: 'Revisar copy', done: false } }), 'desmarcou item do checklist: "Revisar copy"');
  assert.equal(resumirAcaoLegivel({ name: 'agent_status', input: { status: 'awaiting_validation' } }), 'atualizou status do agente: awaiting_validation');
  assert.equal(resumirAcaoLegivel({ name: 'comentario', input: { texto: 'Oi' } }), 'comentou: "Oi"');
  assert.equal(resumirAcaoLegivel({ name: 'link', input: { url: 'https://x', label: 'Relatório' } }), 'adicionou um link: Relatório');
  assert.equal(resumirAcaoLegivel({ name: 'link', input: { url: 'https://x' } }), 'adicionou um link');
  assert.equal(resumirAcaoLegivel({ name: 'relatorio_html', input: {} }), 'gerou um relatório');
  assert.equal(resumirAcaoLegivel({ name: 'perguntar_humano', input: { pergunta: 'Qual prazo?' } }), 'perguntou: "Qual prazo?"');
});

test('resumirAcaoLegivel: trunca textos longos', () => {
  const longo = 'a'.repeat(200);
  const resumo = resumirAcaoLegivel({ name: 'comentario', input: { texto: longo } });
  assert.ok(resumo.length < 140, 'deveria truncar o texto do comentário');
  assert.ok(resumo.includes('…'));
});

test('coletarAcoesAgente: ignora tools de leitura (ler_card/visao_board/biblioteca_agil)', () => {
  const steps = [
    { iteration: 1, toolCalls: [
      { name: 'ler_card', input: {}, output: { ok: true } },
      { name: 'visao_board', input: {}, output: { ok: true } },
      { name: 'biblioteca_agil', input: {}, output: { ok: true } },
      { name: 'mover_coluna', input: { coluna: 'progress' }, output: { ok: true } },
    ] },
  ];
  const acoes = coletarAcoesAgente(steps);
  assert.deepEqual(acoes, ['moveu para a coluna "progress"']);
});

test('coletarAcoesAgente: ignora chamadas em dryRun (simulação, não é alteração real)', () => {
  const steps = [
    { iteration: 1, toolCalls: [
      { name: 'mover_coluna', input: { coluna: 'progress' }, output: { ok: true, dryRun: true } },
    ] },
  ];
  assert.deepEqual(coletarAcoesAgente(steps), []);
});

test('coletarAcoesAgente: ignora chamadas que falharam (ok:false)', () => {
  const steps = [
    { iteration: 1, toolCalls: [
      { name: 'mover_coluna', input: { coluna: 'xyz' }, output: { ok: false, error: 'invalid_output' } },
    ] },
  ];
  assert.deepEqual(coletarAcoesAgente(steps), []);
});

test('coletarAcoesAgente: junta ações de várias iterações, na ordem', () => {
  const steps = [
    { iteration: 1, toolCalls: [{ name: 'mover_coluna', input: { coluna: 'progress' }, output: { ok: true } }] },
    { iteration: 2, toolCalls: [{ name: 'comentario', input: { texto: 'feito' }, output: { ok: true } }] },
  ];
  assert.deepEqual(coletarAcoesAgente(steps), ['moveu para a coluna "progress"', 'comentou: "feito"']);
});

test('registrarLogAgente: não escreve nada se não houver ações', async () => {
  let escreveu = false;
  const db = { ref: () => { escreveu = true; return { set: async () => {} }; } };
  await registrarLogAgente(db, { squadId: 'dev', cardId: 'c1', comment: null, acoes: [] });
  assert.equal(escreveu, false);
});

test('registrarLogAgente: humano mencionando -> requestedBy preenchido, autonomous false', async () => {
  let written = null;
  const db = { ref: (path) => ({ set: async (data) => { written = { path, data }; } }) };
  const comment = { uid: 'u1', author: 'Caio Soares', init: 'CS', text: 'faz o resumo desse card' };
  await registrarLogAgente(db, { squadId: 'dev', cardId: 'c1', comment, acoes: ['comentou: "Resumo..."'] });
  assert.ok(written.path.startsWith('kanban/squads/dev/dados/agente_log/'));
  assert.equal(written.data.autonomous, false);
  assert.deepEqual(written.data.requestedBy, { uid: 'u1', name: 'Caio Soares', init: 'CS' });
  assert.equal(written.data.pedido, 'faz o resumo desse card');
  assert.equal(written.data.cardId, 'c1');
});

test('registrarLogAgente: disparo por Automação (comment.uid===automacao) -> autonomous true, requestedBy null', async () => {
  let written = null;
  const db = { ref: () => ({ set: async (data) => { written = data; } }) };
  const comment = { uid: AUTOMACAO_UID, author: '⚙ Automação', init: '⚙', text: 'Card atrasado' };
  await registrarLogAgente(db, { squadId: 'dev', cardId: 'c1', comment, acoes: ['moveu para a coluna "blocker"'] });
  assert.equal(written.autonomous, true);
  assert.equal(written.requestedBy, null);
});
