// functions/agente-agil-orquestrador/__tests__/realHandlers.test.js
//
// Cobertura dos handlers reais (Etapa 2): buildTools({mode:'real', ...}) tem
// que chamar o mesmo motor de escrita de agente-agil/board.js, mas nunca
// aplicar nada de verdade nesta fase (DRY_RUN_FIXO). Usa o mesmo fake db de
// agente-agil/__tests__/fakeDb.js — não duplica a implementação.
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { buildTools } = require('../tools');
const { runLoop } = require('../loop');

function seedDevSquadDb(cardKey, card) {
  return makeFakeDb({
    kanban: {
      squads: {
        dev: {
          dados: {
            cards: { [cardKey]: card },
            cards_index: { [card.id]: cardKey },
            tags: [],
          },
        },
      },
    },
  });
}

test('buildTools({mode:"real"}) exige db, squadId e cardId', () => {
  assert.throws(() => buildTools({ mode: 'real' }), /precisa de db, squadId e cardId/);
});

test('handler real de comentario monta o plano de verdade mas nunca escreve (dryRun fixo)', async () => {
  const db = seedDevSquadDb('9', { id: 'c9', title: 'Card no dev', col: 'progress', comments: {} });
  const tools = buildTools({ mode: 'real', db, squadId: 'dev', cardId: 'c9' });
  const comentario = tools.find((t) => t.name === 'comentario');

  const result = await comentario.handler({ type: 'comentario', texto: 'Testando handler real' });

  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.plan[0].path, 'kanban/squads/dev/dados/cards/9/comments');

  const cardAfter = db._data().kanban.squads.dev.dados.cards['9'];
  assert.deepEqual(cardAfter.comments, {}, 'dryRun fixo não deveria ter escrito nada de verdade no card');
});

test('handler real devolve card_not_found quando o cardId não existe no squad', async () => {
  const db = seedDevSquadDb('9', { id: 'c9', title: 'Card no dev', col: 'progress' });
  const tools = buildTools({ mode: 'real', db, squadId: 'dev', cardId: 'card-que-nao-existe' });
  const comentario = tools.find((t) => t.name === 'comentario');

  const result = await comentario.handler({ type: 'comentario', texto: 'Oi' });

  assert.deepEqual(result, { ok: false, error: 'card_not_found', cardId: 'card-que-nao-existe', squadId: 'dev' });
});

test('perguntar_humano continua sem handler real em nenhum modo — nunca toca o board', async () => {
  const db = seedDevSquadDb('9', { id: 'c9', title: 'Card no dev', col: 'progress' });
  const tools = buildTools({ mode: 'real', db, squadId: 'dev', cardId: 'c9' });
  const perguntar = tools.find((t) => t.name === 'perguntar_humano');

  const result = await perguntar.handler({ pergunta: 'Qual prioridade uso?' });

  assert.equal(result.simulated, true);
  assert.deepEqual(db._data().kanban.squads.dev.dados.cards['9'], { id: 'c9', title: 'Card no dev', col: 'progress' });
});

test('integração ponta a ponta: runLoop com tools reais nunca muta o fake db (dryRun fixo em true)', async () => {
  const db = seedDevSquadDb('9', { id: 'c9', title: 'Card no dev', col: 'progress', comments: {}, checklist: [], checklistGroups: [] });
  const tools = buildTools({ mode: 'real', db, squadId: 'dev', cardId: 'c9' });

  const llmClient = {
    calls: 0,
    async decide() {
      this.calls++;
      if (this.calls === 1) {
        return { toolCalls: [{ id: '1', name: 'comentario', input: { type: 'comentario', texto: 'Rodando de verdade contra o squad dev' } }], text: null };
      }
      return { toolCalls: [], text: 'Concluído (dryRun).' };
    },
  };

  const before = JSON.parse(JSON.stringify(db._data()));
  const result = await runLoop({ llmClient, tools, system: 'sistema', task: 'tarefa', enabled: true });

  assert.equal(result.status, 'done');
  assert.equal(result.steps[0].toolCalls[0].output.dryRun, true);
  assert.deepEqual(db._data(), before, 'nenhum write real deveria ter acontecido através do loop inteiro');
});
