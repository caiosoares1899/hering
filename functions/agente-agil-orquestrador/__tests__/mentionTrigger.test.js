// functions/agente-agil-orquestrador/__tests__/mentionTrigger.test.js
//
// Cobertura de `processarMencao()` — a lógica de negócio pura do gatilho
// de @menção (item 3 do plano de acionamento), com `llmClient` injetado
// (nunca resolve escolheClienteParaTarefa()/secret aqui) e fake db, mesmo
// padrão de loop.test.js/realHandlers.test.js. Não testa o wrapper
// `agenteAgilMencao` (onValueCreated) em si — isso exigiria mockar
// firebase-functions/v2/database, fora do escopo (a lógica que importa
// já está toda em processarMencao(), o wrapper só resolve dependências
// reais e chama ela).
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const membersLib = require('../../agente-agil/members');
const { processarMencao, SQUAD_ID, IDEMPOTENCY_PATH, AGENTE_UID, DRY_RUN_SOMBRA } = require('../mentionTrigger');

function scriptedLlmClient(script) {
  let calls = 0;
  return {
    calls: () => calls,
    async decide() {
      if (calls >= script.length) {
        throw new Error(`scriptedLlmClient: decide() chamado ${calls + 1} vezes, script só tem ${script.length} respostas.`);
      }
      const response = script[calls];
      calls++;
      return response;
    },
  };
}

function seedDb(extra) {
  membersLib._resetCacheForTests();
  return makeFakeDb({
    kanban: {
      squads: {
        [SQUAD_ID]: {
          dados: {
            cards: { 9: { id: 'c1', title: 'Card de teste', col: 'progress', comments: {} } },
            cards_index: { c1: '9' },
            tags: [],
          },
        },
      },
      config: { agente_agil_orquestrador: { enabled: true } },
      ...extra,
    },
  });
}

test('ignora comentário do próprio agente (anti-auto-disparo) — checagem PRIMEIRO, antes de olhar o texto', async () => {
  const db = seedDb();
  const llmClient = scriptedLlmClient([{ toolCalls: [], text: 'não deveria rodar' }]);
  const comment = { uid: AGENTE_UID, text: '@Agente Ágil isso teria uma menção, mas é o próprio agente falando' };

  const outcome = await processarMencao(db, { cardId: 'c1', commentId: 'cm1', comment, llmClient });

  assert.equal(outcome.processed, false);
  assert.equal(outcome.reason, 'self_comment');
  assert.equal(llmClient.calls(), 0);
});

test('ignora comentário sem menção ao agente', async () => {
  const db = seedDb();
  const llmClient = scriptedLlmClient([{ toolCalls: [], text: 'não deveria rodar' }]);
  const comment = { uid: 'uid-humano', text: 'comentário normal, sem chamar o agente' };

  const outcome = await processarMencao(db, { cardId: 'c1', commentId: 'cm2', comment, llmClient });

  assert.equal(outcome.processed, false);
  assert.equal(outcome.reason, 'no_mention');
  assert.equal(llmClient.calls(), 0);
});

test('ignora quando o kill switch está desligado', async () => {
  const db = seedDb({ config: { agente_agil_orquestrador: { enabled: false } } });
  const llmClient = scriptedLlmClient([{ toolCalls: [], text: 'não deveria rodar' }]);
  const comment = { uid: 'uid-humano', text: '@Agente Ágil faz alguma coisa' };

  const outcome = await processarMencao(db, { cardId: 'c1', commentId: 'cm3', comment, llmClient });

  assert.equal(outcome.processed, false);
  assert.equal(outcome.reason, 'disabled');
  assert.equal(llmClient.calls(), 0);
});

test('ignora comentário já processado antes (idempotência)', async () => {
  const db = seedDb();
  await db.ref(`${IDEMPOTENCY_PATH}/cm4`).set({ at: 'antes', status: 'done', dryRun: true });
  const llmClient = scriptedLlmClient([{ toolCalls: [], text: 'não deveria rodar' }]);
  const comment = { uid: 'uid-humano', text: '@Agente Ágil faz de novo' };

  const outcome = await processarMencao(db, { cardId: 'c1', commentId: 'cm4', comment, llmClient });

  assert.equal(outcome.processed, false);
  assert.equal(outcome.reason, 'idempotent');
  assert.equal(llmClient.calls(), 0);
});

test('processa uma menção válida: chama o loop, marca idempotência, dryRun fixo em modo sombra', async () => {
  const db = seedDb();
  const llmClient = scriptedLlmClient([{ toolCalls: [], text: 'feito, comentário deixado no card' }]);
  const comment = { uid: 'uid-humano', text: '@Agente Ágil resume o card pra mim' };

  const outcome = await processarMencao(db, { cardId: 'c1', commentId: 'cm5', comment, llmClient });

  assert.equal(outcome.processed, true);
  assert.equal(outcome.result.status, 'done');
  assert.equal(llmClient.calls(), 1);

  const marcado = await db.ref(`${IDEMPOTENCY_PATH}/cm5`).get();
  assert.equal(marcado.exists(), true);
  assert.equal(marcado.val().status, 'done');
  assert.equal(marcado.val().dryRun, DRY_RUN_SOMBRA);
  assert.equal(DRY_RUN_SOMBRA, true); // trava o modo sombra — se isso um dia virar false, é decisão nova, não acidente
});

test('mesmo com toolset completo disponível, task simples só usa o que precisa (mesmo espírito do canário 9)', async () => {
  const db = seedDb();
  // Cliente scriptado que chama comentario antes de terminar, prova que o
  // toolset real (não fake) foi montado e o handler responde.
  const llmClient = scriptedLlmClient([
    { toolCalls: [{ id: '1', name: 'comentario', input: { type: 'comentario', texto: 'Resumo: card em progresso, sem bloqueios.' } }], text: null },
    { toolCalls: [], text: 'Resumi o card num comentário.' },
  ]);
  const comment = { uid: 'uid-humano', text: '@Agente Ágil resume esse card' };

  const outcome = await processarMencao(db, { cardId: 'c1', commentId: 'cm6', comment, llmClient });

  assert.equal(outcome.processed, true);
  assert.equal(outcome.result.status, 'done');
  const comentarioCall = outcome.result.steps.flatMap((s) => s.toolCalls).find((c) => c.name === 'comentario');
  assert.ok(comentarioCall);
  assert.equal(comentarioCall.output.dryRun, true); // modo sombra: monta o plano, nunca aplica
});
