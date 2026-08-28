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

// Captura o `history` de cada chamada de decide() — usado só pra checar o
// TEXTO da tarefa passada ao modelo (ver teste do achado do canário
// abaixo), não o comportamento normal (scriptedLlmClient já cobre isso).
function recordingLlmClient(script) {
  let calls = 0;
  const historias = [];
  return {
    calls: () => calls,
    historias: () => historias,
    async decide({ history }) {
      historias.push(history);
      const response = script[calls];
      calls++;
      return response;
    },
  };
}

function throwingLlmClient(err) {
  return { calls: () => 1, async decide() { throw err; } };
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

// Achado real do canário de validação (2026-08-27): uma instabilidade
// momentânea da API da Anthropic (erro 529 "overloaded") derrubou
// runLoop() com exceção, e o item ficava preso em "pending" pra sempre,
// sem NENHUM sinal de falha — diferente da @menção, aqui não tem
// ninguém esperando resposta num card pra notar que nada chegou.
test('runLoop falhando (ex: API fora do ar) marca o item como "failed", com o erro, em vez de ficar preso em "pending" pra sempre', async () => {
  const db = seedDb();
  const llmClient = throwingLlmClient(new Error('Anthropic API respondeu 529: overloaded'));
  const entry = { texto: 'informação qualquer', especialista: 'databricks' };

  const outcome = await processarIntake(db, { id: 'i-falha', entry, llmClient });

  assert.equal(outcome.processed, false);
  assert.equal(outcome.reason, 'llm_error');

  const pendingEntry = await db.ref(`${PENDING_PATH}/i-falha`).get();
  assert.equal(pendingEntry.val().status, 'failed');
  assert.match(pendingEntry.val().error, /529/);
  assert.ok(pendingEntry.val().processedAt);

  // Idempotência NÃO marcada — nada foi de fato concluído, um
  // reprocessamento futuro não deveria ser bloqueado por isso.
  const marcado = await db.ref(`${IDEMPOTENCY_PATH}/i-falha`).get();
  assert.equal(marcado.exists(), false);
});

// Achado real do canário de validação (2026-08-27): sem o squad explícito
// na tarefa, o modelo narrou "tentei criar o card no squad dados" mesmo
// só conseguindo agir no squad ONDE O GATILHO RODA (aqui, dev) — a recusa
// em si (Ficha Técnica ativa) aconteceu certo, só a explicação mencionava
// um squad errado. Fix: task text deixa o squad explícito nos dois
// caminhos (com e sem card).
test('a tarefa passada ao modelo menciona o squad explicitamente, nos dois caminhos (com e sem card)', async () => {
  const db = seedDb();
  const semCardClient = recordingLlmClient([{ toolCalls: [], text: 'ok' }]);
  await processarIntake(db, { id: 'i-squad-a', entry: { texto: 'algo sem card' }, llmClient: semCardClient });
  assert.match(semCardClient.historias()[0][0].text, new RegExp(`squad "${SQUAD_ID}"`));

  const comCardClient = recordingLlmClient([{ toolCalls: [], text: 'ok' }]);
  await processarIntake(db, { id: 'i-squad-b', entry: { texto: 'algo sobre esse card', cardId: 'c1' }, llmClient: comCardClient });
  assert.match(comCardClient.historias()[0][0].text, new RegExp(`squad "${SQUAD_ID}"`));
});

// config/agentesExternos é um registro GLOBAL (kanban/config/agentesExternos,
// editado em painel.html/painel-dev.html) — não mais por squad (correção de
// arquitetura 2026-08-28, pedido direto: "setar em quais squads ele vai
// ficar") — DIFERENTE do kill switch (config/agente_agil_orquestrador,
// também global, ver seedDb() acima) — por isso estes testes montam o
// próprio db em vez de reusar seedDb().
function seedDbComAgentesExternos(agentesExternos) {
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
      config: {
        agente_agil_orquestrador: { enabled: true },
        agentesExternos: agentesExternos || {},
      },
    },
  });
}

// Pedido direto (2026-08-28, testando o intake ao vivo): ADM/PO documenta
// no Painel → Configurações → Agentes Externos o que cada especialista faz,
// e em quais squads isso vale — intakeTrigger.js injeta essa descrição na
// tarefa do LLM sempre que a mensagem vem daquele especialista E o squad
// atual está marcado em `squads`.
test('injeta a descrição do especialista (config/agentesExternos) na tarefa do modelo, quando cadastrada pro squad atual', async () => {
  const db = seedDbComAgentesExternos({
    'agente-dados-concorrencia': { descricao: 'Coleta dados públicos de mídia paga de concorrentes, roda semanalmente.', squads: { [SQUAD_ID]: true } },
  });
  const client = recordingLlmClient([{ toolCalls: [], text: 'ok' }]);
  await processarIntake(db, { id: 'i-desc-especialista', entry: { texto: 'dados novos', especialista: 'agente-dados-concorrencia' }, llmClient: client });

  assert.match(client.historias()[0][0].text, /Coleta dados públicos de mídia paga de concorrentes/);
});

test('sem descrição cadastrada pro especialista (ou sem especialista), a tarefa não menciona nenhum contexto extra', async () => {
  const db = seedDbComAgentesExternos();
  const client = recordingLlmClient([{ toolCalls: [], text: 'ok' }]);
  await processarIntake(db, { id: 'i-sem-desc-especialista', entry: { texto: 'dados novos', especialista: 'agente-desconhecido' }, llmClient: client });

  assert.doesNotMatch(client.historias()[0][0].text, /Contexto sobre este especialista/);
});

// Especialista cadastrado, mas SEM o squad atual marcado em `squads` — ex.:
// um ADM cadastrou "agente-dados-concorrencia" só pro squad "dados", e essa
// mesma chave (por coincidência, ou por má configuração) manda uma mensagem
// pro squad "dev". Não injeta nada — mesmo tratamento de especialista
// desconhecido, pra não vazar contexto de um squad pra outro sem intenção.
test('especialista cadastrado mas sem o squad atual marcado em `squads` — não injeta nada', async () => {
  const db = seedDbComAgentesExternos({
    'agente-dados-concorrencia': { descricao: 'Coleta dados públicos de mídia paga de concorrentes.', squads: { outroSquad: true } },
  });
  const client = recordingLlmClient([{ toolCalls: [], text: 'ok' }]);
  await processarIntake(db, { id: 'i-especialista-fora-do-squad', entry: { texto: 'dados novos', especialista: 'agente-dados-concorrencia' }, llmClient: client });

  assert.doesNotMatch(client.historias()[0][0].text, /Contexto sobre este especialista/);
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

// A instância `dev` exportada tem escrita real desde 2026-08-27 (ver
// comentário no fim do arquivo) — este teste testa especificamente o
// comportamento em dryRun, então monta a PRÓPRIA instância com
// dryRun:true explícito, em vez de depender do flag da instância
// compartilhada (mesmo padrão já usado no teste de escrita real acima).
test('sem cardId nenhum, dryRun explícito: criar_card monta o plano mas não grava nada', async () => {
  const db = seedDb();
  const trigger = createIntakeTrigger({ squadId: SQUAD_ID, dryRun: true });
  const llmClient = scriptedLlmClient([
    { toolCalls: [{ id: '1', name: 'criar_card', input: { titulo: 'Investigar anomalia reportada' } }], text: null },
    { toolCalls: [], text: 'Teria criado um rascunho, mas estou em modo sombra.' },
  ]);
  const entry = { texto: 'anomalia detectada, sem card associado', especialista: 'databricks' };

  const outcome = await trigger.processarIntake(db, { id: 'i6b', entry, llmClient });

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

// ── notificarFalhaSemCard (pedido direto, 2026-08-28) ───────────────────
// Quando semCard e nada de acionável nasceu (criar_card recusou, ou o
// modelo decidiu não criar nada), a informação não pode ficar visível só
// pra quem for abrir Pedidos de Intake por conta própria.
function seedDbComHotlineEMembros({ comHotline = true } = {}) {
  membersLib._resetCacheForTests();
  const cards = { 9: { id: 'c1', title: 'Card de teste', col: 'progress' } };
  if (comHotline) cards[99] = { id: 'hotline1', title: '🤖 Converse com o Agente Ágil', agenteHotline: true, archived: false };
  return makeFakeDb({
    kanban: {
      squads: {
        [SQUAD_ID]: {
          dados: {
            cards,
            cards_index: { c1: '9' },
            tags: [],
          },
        },
      },
      usuarios_publicos: {
        uidPO: { nome: 'Ana PO', email: 'ana@ciahering.com.br', init: 'ANA', squads: { [SQUAD_ID]: true }, squads_roles: { [SQUAD_ID]: 'po' } },
        uidADM: { nome: 'Bruno Adm', email: 'bruno@ciahering.com.br', init: 'BRU', squads: { [SQUAD_ID]: true }, squads_roles: { [SQUAD_ID]: 'adm' } },
        uidMembro: { nome: 'Carla Membro', email: 'carla@ciahering.com.br', init: 'CAR', squads: { [SQUAD_ID]: true }, squads_roles: { [SQUAD_ID]: 'membro' } },
      },
      config: { agente_agil_orquestrador: { enabled: true } },
    },
  });
}

test('semCard sem pendingIdCriado, hotline existe: comenta no card hotline e notifica PO+ADM (não membro comum)', async () => {
  const db = seedDbComHotlineEMembros();
  const trigger = createIntakeTrigger({ squadId: SQUAD_ID, dryRun: false });
  const llmClient = scriptedLlmClient([{ toolCalls: [], text: 'Não consegui criar o card: Ficha Técnica obrigatória neste squad.' }]);
  const entry = { texto: 'queda nas vendas da campanha', especialista: 'databricks' };

  const outcome = await trigger.processarIntake(db, { id: 'i-hotline', entry, llmClient });
  assert.equal(outcome.pendingIdCriado, null);

  const comentarios = await db.ref(`kanban/squads/${SQUAD_ID}/dados/card_comments/hotline1`).get();
  const lista = Object.values(comentarios.val() || {});
  assert.equal(lista.length, 1);
  assert.match(lista[0].text, /databricks/);
  assert.match(lista[0].text, /Ficha Técnica obrigatória/);

  const notifPO = Object.values((await db.ref('kanban/usuarios/uidPO/notificacoes').get()).val() || {});
  const notifADM = Object.values((await db.ref('kanban/usuarios/uidADM/notificacoes').get()).val() || {});
  const notifMembro = await db.ref('kanban/usuarios/uidMembro/notificacoes').get();
  assert.equal(notifPO.length, 1);
  assert.equal(notifPO[0].type, 'mention');
  assert.equal(notifPO[0].cardId, 'hotline1');
  assert.equal(notifADM.length, 1);
  assert.equal(notifMembro.val(), null, 'membro comum (não PO/ADM) não deveria ser notificado');
});

test('semCard sem pendingIdCriado, SEM card hotline: não comenta em lugar nenhum mas ainda notifica PO/ADM (type intake, sem cardId)', async () => {
  const db = seedDbComHotlineEMembros({ comHotline: false });
  const trigger = createIntakeTrigger({ squadId: SQUAD_ID, dryRun: false });
  const llmClient = scriptedLlmClient([{ toolCalls: [], text: 'Informação vaga demais, não criei nada.' }]);
  const entry = { texto: 'algo bem vago', especialista: 'databricks' };

  await trigger.processarIntake(db, { id: 'i-sem-hotline', entry, llmClient });

  const notifPO = Object.values((await db.ref('kanban/usuarios/uidPO/notificacoes').get()).val() || {});
  assert.equal(notifPO.length, 1);
  assert.equal(notifPO[0].type, 'intake');
  assert.equal(notifPO[0].cardId, null);
});

test('semCard sem pendingIdCriado, dryRun:true: não escreve nem comentário nem notificação', async () => {
  const db = seedDbComHotlineEMembros();
  const trigger = createIntakeTrigger({ squadId: SQUAD_ID, dryRun: true });
  const llmClient = scriptedLlmClient([{ toolCalls: [], text: 'Teria explicado, mas estou em modo sombra.' }]);
  const entry = { texto: 'algo', especialista: 'databricks' };

  await trigger.processarIntake(db, { id: 'i-dryrun-falha', entry, llmClient });

  const comentarios = await db.ref(`kanban/squads/${SQUAD_ID}/dados/card_comments/hotline1`).get();
  assert.equal(comentarios.val(), null);
  const notifPO = await db.ref('kanban/usuarios/uidPO/notificacoes').get();
  assert.equal(notifPO.val(), null);
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

// Decisão explícita do usuário (2026-08-27), depois de 4 canários
// simulados diretos em produção validando os dois caminhos (com/sem
// card) e as travas de segurança. Trava o valor ATUAL de propósito —
// se isso divergir do esperado, é sinal de mudança acidental do flag,
// não decisão nova (mesmo padrão de DRY_RUN_MENCAO em mentionTrigger.test.js).
test('instância dev exportada tem escrita real (destravada em 2026-08-27)', () => {
  assert.equal(DRY_RUN_INTAKE, false);
  assert.equal(SQUAD_ID, 'dev');
});
