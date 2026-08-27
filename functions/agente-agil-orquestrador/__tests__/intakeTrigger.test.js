// functions/agente-agil-orquestrador/__tests__/intakeTrigger.test.js
//
// Cobertura de `processarIntake()` — lógica de negócio pura do 2º gatilho
// automático (o primeiro que NÃO depende de um card já existir), mesmo
// padrão de mentionTrigger.test.js: `llmClient` injetado, fake db, não
// testa o wrapper onValueCreated em si.
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const membersLib = require('../../agente-agil/members');
const { processarIntake, createIntakeTrigger, IDEMPOTENCY_PATH, PENDING_PATH, DRY_RUN_INTAKE, SQUAD_ID } = require('../intakeTrigger');

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
            cards: { 9: { id: 'c1', title: 'Card de teste', col: 'progress' } },
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

test('ignora quando o kill switch está desligado', async () => {
  const db = seedDb({ config: { agente_agil_orquestrador: { enabled: false } } });
  const llmClient = scriptedLlmClient([{ toolCalls: [], text: 'não deveria rodar' }]);
  const entry = { texto: 'algo aconteceu', especialista: 'databricks' };

  const outcome = await processarIntake(db, { id: 'i1', entry, llmClient });

  assert.equal(outcome.processed, false);
  assert.equal(outcome.reason, 'disabled');
  assert.equal(llmClient.calls(), 0);
});

test('ignora item já processado antes (idempotência)', async () => {
  const db = seedDb();
  await db.ref(`${IDEMPOTENCY_PATH}/i2`).set({ at: 'antes', status: 'done', dryRun: true });
  const llmClient = scriptedLlmClient([{ toolCalls: [], text: 'não deveria rodar' }]);
  const entry = { texto: 'de novo', especialista: 'databricks' };

  const outcome = await processarIntake(db, { id: 'i2', entry, llmClient });

  assert.equal(outcome.processed, false);
  assert.equal(outcome.reason, 'idempotent');
  assert.equal(llmClient.calls(), 0);
});

test('entry vazio (item removido/corrompido antes do trigger rodar) — ignora sem quebrar', async () => {
  const db = seedDb();
  const llmClient = scriptedLlmClient([{ toolCalls: [], text: 'não deveria rodar' }]);

  const outcome = await processarIntake(db, { id: 'i3', entry: null, llmClient });

  assert.equal(outcome.processed, false);
  assert.equal(outcome.reason, 'entry_vazio');
  assert.equal(llmClient.calls(), 0);
});

test('cardId aponta pra card real: monta o toolset COM card (não semCard), roda o loop, grava idempotência', async () => {
  const db = seedDb();
  const llmClient = scriptedLlmClient([{ toolCalls: [], text: 'Confirmado, sem ação necessária.' }]);
  const entry = { texto: 'informação sobre esse card', especialista: 'databricks', cardId: 'c1' };

  const outcome = await processarIntake(db, { id: 'i4', entry, llmClient });

  assert.equal(outcome.processed, true);
  assert.equal(outcome.semCard, false);
  assert.equal(outcome.cardId, 'c1');
  assert.equal(llmClient.calls(), 1);

  const marcado = await db.ref(`${IDEMPOTENCY_PATH}/i4`).get();
  assert.equal(marcado.exists(), true);

  const pendingEntry = await db.ref(`${PENDING_PATH}/i4`).get();
  assert.equal(pendingEntry.val().status, 'done');
  assert.equal(pendingEntry.val().resultText, 'Confirmado, sem ação necessária.');
});

test('cardId aponta pra card que não existe mais: cai no caminho semCard (não quebra)', async () => {
  const db = seedDb();
  const llmClient = scriptedLlmClient([{ toolCalls: [], text: 'Não achei o card, sem ação.' }]);
  const entry = { texto: 'informação sobre um card que sumiu', especialista: 'databricks', cardId: 'card-fantasma' };

  const outcome = await processarIntake(db, { id: 'i5', entry, llmClient });

  assert.equal(outcome.processed, true);
  assert.equal(outcome.semCard, true);
  assert.equal(outcome.cardId, null);
});

// A instância `dev` exportada fica em modo sombra (DRY_RUN_INTAKE:true,
// mecanismo ainda não validado em produção — ver comentário no fim do
// arquivo) — criar_card em dryRun nunca grava pendingId de verdade, então
// este teste monta a PRÓPRIA instância com dryRun:false pra exercitar o
// caminho de escrita real (mesmo padrão que realHandlers.test.js já usa
// pra testar dryRun:false isoladamente, sem depender do flag de produção).
test('sem cardId nenhum (nem dica): toolset semCard, criar_card disponível e escreve de verdade quando dryRun:false', async () => {
  const db = seedDb();
  const trigger = createIntakeTrigger({ squadId: SQUAD_ID, dryRun: false });
  const llmClient = scriptedLlmClient([
    {
      toolCalls: [{ id: '1', name: 'criar_card', input: { titulo: 'Investigar anomalia reportada' } }],
      text: null,
    },
    { toolCalls: [], text: 'Criei um rascunho de card pra investigar.' },
  ]);
  const entry = { texto: 'anomalia detectada, sem card associado', especialista: 'databricks' };

  const outcome = await trigger.processarIntake(db, { id: 'i6', entry, llmClient });

  assert.equal(outcome.processed, true);
  assert.equal(outcome.semCard, true);
  assert.ok(outcome.pendingIdCriado, 'criar_card real com dryRun:false deveria ter devolvido um pendingId');

  const rascunho = await db.ref(`kanban/squads/${SQUAD_ID}/dados/intake_pending/${outcome.pendingIdCriado}`).get();
  assert.equal(rascunho.val().titulo, 'Investigar anomalia reportada');
});

test('sem cardId nenhum, dryRun (padrão): criar_card monta o plano mas não grava nada', async () => {
  const db = seedDb();
  const llmClient = scriptedLlmClient([
    { toolCalls: [{ id: '1', name: 'criar_card', input: { titulo: 'Investigar anomalia reportada' } }], text: null },
    { toolCalls: [], text: 'Teria criado um rascunho, mas estou em modo sombra.' },
  ]);
  const entry = { texto: 'anomalia detectada, sem card associado', especialista: 'databricks' };

  const outcome = await processarIntake(db, { id: 'i6b', entry, llmClient });

  assert.equal(outcome.processed, true);
  assert.equal(outcome.pendingIdCriado, null, 'dryRun não deveria gravar rascunho nenhum');
  const pending = await db.ref(`kanban/squads/${SQUAD_ID}/dados/intake_pending`).get();
  assert.equal(pending.val(), null);
});

test('sem cardId nenhum, modelo decide não criar nada: só finalText, sem chamada de ferramenta', async () => {
  const db = seedDb();
  const llmClient = scriptedLlmClient([{ toolCalls: [], text: 'Informação vaga demais, não criei nada. Sugiro pedir mais contexto.' }]);
  const entry = { texto: 'algo bem vago', especialista: 'databricks' };

  const outcome = await processarIntake(db, { id: 'i7', entry, llmClient });

  assert.equal(outcome.processed, true);
  assert.equal(outcome.pendingIdCriado, null);
  const pendingEntry = await db.ref(`${PENDING_PATH}/i7`).get();
  assert.match(pendingEntry.val().resultText, /Informação vaga demais/);
});

test('createIntakeTrigger: squad novo entra em modo sombra por padrão (dryRun:true)', () => {
  const instancia = createIntakeTrigger({ squadId: 'outro-squad' });
  assert.equal(instancia.DRY_RUN_INTAKE, true);
});

test('createIntakeTrigger: cada instância tem paths próprios, escopados por squad', () => {
  const dev = createIntakeTrigger({ squadId: 'dev' });
  const dados = createIntakeTrigger({ squadId: 'dados' });
  assert.equal(dev.PENDING_PATH, 'kanban/squads/dev/dados/agente_intake_pending');
  assert.equal(dados.PENDING_PATH, 'kanban/squads/dados/dados/agente_intake_pending');
  assert.notEqual(dev.IDEMPOTENCY_PATH, dados.IDEMPOTENCY_PATH);
});

test('instância dev exportada continua em modo sombra (mecanismo ainda não validado em produção)', () => {
  assert.equal(DRY_RUN_INTAKE, true);
  assert.equal(SQUAD_ID, 'dev');
});
