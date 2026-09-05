// functions/okr/__tests__/agenteChat.test.js
//
// Cobertura de `processarMensagem()` — a lógica de negócio pura do chat
// dedicado do Agente Ágil no domínio OKR (kanban/okr/agente_chat), com
// `llmClient` injetado (nunca resolve escolheClienteParaTarefa()/secret
// aqui) e fake db — mesmo padrão de mentionTrigger.test.js. Não testa o
// wrapper `okrAgenteChat` (onValueCreated) em si, mesma razão de sempre
// (a lógica que importa já está toda em processarMensagem(), o wrapper só
// resolve dependências reais e chama ela).
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const {
  processarMensagem,
  resumirResultadoParaLog,
  IDEMPOTENCY_PATH,
  AGENTE_UID,
  DRY_RUN_OKR_CHAT,
} = require('../agenteChat');

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
  return makeFakeDb({
    kanban: {
      usuarios: {
        'uid-adm': { email: 'caio.soares@ciahering.com.br' },
        'uid-humano': { email: 'pessoa@ciahering.com.br' },
      },
      okr: {
        objetivos: {
          o1: { id: 'o1', titulo: 'Reduzir custo Firebase', areaId: 'dadosia', responsaveis: ['uid-humano'], arquivado: false },
        },
        marcos: {},
      },
      config: { agente_agil_orquestrador: { enabled: true } },
      ...extra,
    },
  });
}

// ── Guards, mesma ordem de mentionTrigger.js ────────────────────────────

test('ignora mensagem do próprio agente (anti-auto-disparo) — checagem PRIMEIRO', async () => {
  const db = seedDb();
  const llmClient = scriptedLlmClient([{ toolCalls: [], text: 'não deveria rodar' }]);
  const message = { uid: AGENTE_UID, text: 'eco de mim mesmo' };

  const outcome = await processarMensagem(db, { msgId: 'm1', message, llmClient });

  assert.equal(outcome.processed, false);
  assert.equal(outcome.reason, 'self_message');
  assert.equal(llmClient.calls(), 0);
});

test('ignora mensagem vazia/só espaço', async () => {
  const db = seedDb();
  const llmClient = scriptedLlmClient([{ toolCalls: [], text: 'não deveria rodar' }]);
  const message = { uid: 'uid-humano', text: '   ' };

  const outcome = await processarMensagem(db, { msgId: 'm2', message, llmClient });

  assert.equal(outcome.processed, false);
  assert.equal(outcome.reason, 'empty_message');
  assert.equal(llmClient.calls(), 0);
});

test('ignora quando o kill switch global está desligado (mesmo switch do orquestrador de card)', async () => {
  const db = seedDb({ config: { agente_agil_orquestrador: { enabled: false } } });
  const llmClient = scriptedLlmClient([{ toolCalls: [], text: 'não deveria rodar' }]);
  const message = { uid: 'uid-humano', text: 'me ajuda a preencher um OKR' };

  const outcome = await processarMensagem(db, { msgId: 'm3', message, llmClient });

  assert.equal(outcome.processed, false);
  assert.equal(outcome.reason, 'disabled');
  assert.equal(llmClient.calls(), 0);
});

test('ignora mensagem já processada antes (idempotência)', async () => {
  const db = seedDb();
  await db.ref(`${IDEMPOTENCY_PATH}/m4`).set({ at: 'antes', status: 'done', dryRun: true });
  const llmClient = scriptedLlmClient([{ toolCalls: [], text: 'não deveria rodar' }]);
  const message = { uid: 'uid-humano', text: 'de novo' };

  const outcome = await processarMensagem(db, { msgId: 'm4', message, llmClient });

  assert.equal(outcome.processed, false);
  assert.equal(outcome.reason, 'idempotent');
  assert.equal(llmClient.calls(), 0);
});

// ── Fluxo feliz ──────────────────────────────────────────────────────────

test('processa uma mensagem válida: chama o loop, marca idempotência com o dryRun passado', async () => {
  const db = seedDb();
  const llmClient = scriptedLlmClient([
    { toolCalls: [{ id: '1', name: 'editar_campos_okr', input: { objetivo_id: 'o1', progressos_adicionar: ['Validamos viabilidade'] } }], text: null },
    { toolCalls: [{ id: '2', name: 'responder', input: { texto: 'Adicionei o progresso no Objetivo.' } }], text: null },
    { toolCalls: [], text: 'Concluído.' },
  ]);
  const message = { uid: 'uid-humano', text: 'já validamos a viabilidade, anota isso no objetivo de custo Firebase' };

  const outcome = await processarMensagem(db, { msgId: 'm5', message, llmClient, dryRun: false });

  assert.equal(outcome.processed, true);
  assert.equal(outcome.result.status, 'done');
  assert.equal(llmClient.calls(), 3);

  const marcado = await db.ref(`${IDEMPOTENCY_PATH}/m5`).get();
  assert.equal(marcado.exists(), true);
  assert.equal(marcado.val().status, 'done');
  assert.equal(marcado.val().dryRun, false);

  const gravado = (await db.ref('kanban/okr/objetivos/o1').get()).val();
  assert.deepEqual(gravado.progressos, ['Validamos viabilidade']);
});

test('escreve a resposta do agente no próprio chat via a ferramenta "responder"', async () => {
  const db = seedDb();
  const llmClient = scriptedLlmClient([{ toolCalls: [{ id: '1', name: 'responder', input: { texto: 'Oi! Como posso ajudar com os OKRs?' } }], text: null }, { toolCalls: [], text: 'Concluído.' }]);
  const message = { uid: 'uid-humano', text: 'oi' };

  await processarMensagem(db, { msgId: 'm6', message, llmClient, dryRun: false });

  const mensagensNoChat = Object.values((await db.ref('kanban/okr/agente_chat').get()).val() || {});
  assert.equal(mensagensNoChat.length, 1);
  assert.equal(mensagensNoChat[0].uid, AGENTE_UID);
  assert.equal(mensagensNoChat[0].text, 'Oi! Como posso ajudar com os OKRs?');
});

// ── Rede de segurança (mesmo achado real do orquestrador de card) ───────

test('rede de segurança: se o modelo não chama "responder" mas devolve finalText, posta ele mesmo como fallback', async () => {
  const db = seedDb();
  const llmClient = scriptedLlmClient([{ toolCalls: [], text: 'Não entendi o pedido, pode reformular?' }]);
  const message = { uid: 'uid-humano', text: 'sei lá' };

  const outcome = await processarMensagem(db, { msgId: 'm7', message, llmClient, dryRun: false });

  assert.equal(outcome.processed, true);
  assert.equal(outcome.fallbackResposta, true);

  const mensagensNoChat = Object.values((await db.ref('kanban/okr/agente_chat').get()).val() || {});
  assert.equal(mensagensNoChat.length, 1, 'fallback deveria ter postado o finalText como resposta de verdade');
  assert.equal(mensagensNoChat[0].text, 'Não entendi o pedido, pode reformular?');

  const marcado = await db.ref(`${IDEMPOTENCY_PATH}/m7`).get();
  assert.equal(marcado.val().fallbackResposta, true);
});

test('rede de segurança NÃO duplica: se o modelo já chamou "responder", não posta o finalText de novo', async () => {
  const db = seedDb();
  const llmClient = scriptedLlmClient([
    { toolCalls: [{ id: '1', name: 'responder', input: { texto: 'Resposta via ferramenta.' } }], text: null },
    { toolCalls: [], text: 'Concluído.' },
  ]);
  const message = { uid: 'uid-humano', text: 'qualquer coisa' };

  const outcome = await processarMensagem(db, { msgId: 'm8', message, llmClient, dryRun: false });

  assert.equal(outcome.fallbackResposta, false);
  const mensagensNoChat = Object.values((await db.ref('kanban/okr/agente_chat').get()).val() || {});
  assert.equal(mensagensNoChat.length, 1);
  assert.equal(mensagensNoChat[0].text, 'Resposta via ferramenta.');
});

// ── Notificação (okr_agente, allow-list em functions/index.js) ─────────

test('notifica quem mandou a mensagem quando o agente responde', async () => {
  const db = seedDb();
  const llmClient = scriptedLlmClient([{ toolCalls: [{ id: '1', name: 'responder', input: { texto: 'Feito!' } }], text: null }, { toolCalls: [], text: 'Concluído.' }]);
  const message = { uid: 'uid-humano', text: 'faz alguma coisa' };

  await processarMensagem(db, { msgId: 'm9', message, llmClient, dryRun: false });

  const notifs = Object.values((await db.ref('kanban/usuarios/uid-humano/notificacoes').get()).val() || {});
  assert.equal(notifs.length, 1);
  assert.equal(notifs[0].type, 'okr_agente');
  assert.equal(notifs[0].read, false);
});

// ── Permissão respeitada de ponta a ponta (não só na ferramenta isolada) ─

test('pedido de criar Objetivo por quem NÃO é ADM: a ferramenta recusa, o agente explica na resposta, nada é gravado', async () => {
  const db = seedDb();
  const llmClient = scriptedLlmClient([
    { toolCalls: [{ id: '1', name: 'criar_objetivo', input: { titulo: 'Novo Objetivo', area_id: 'tech' } }], text: null },
    { toolCalls: [{ id: '2', name: 'responder', input: { texto: 'Só ADM pode criar um Objetivo novo — pede pra um ADM criar.' } }], text: null },
    { toolCalls: [], text: 'Concluído.' },
  ]);
  const message = { uid: 'uid-humano', text: 'cria um objetivo novo pra mim' };

  const outcome = await processarMensagem(db, { msgId: 'm10', message, llmClient, dryRun: false });

  assert.equal(outcome.processed, true);
  const objetivos = (await db.ref('kanban/okr/objetivos').get()).val();
  assert.equal(Object.keys(objetivos).length, 1); // só o1 original, nada criado
  const mensagensNoChat = Object.values((await db.ref('kanban/okr/agente_chat').get()).val() || {});
  assert.match(mensagensNoChat[0].text, /Só ADM/);
});

// ── resumirResultadoParaLog() — formatação do log de produção ──────────

test('resumirResultadoParaLog: sem nenhuma ferramenta chamada', () => {
  const result = { status: 'done', steps: [] };
  const resumo = resumirResultadoParaLog(result);
  assert.match(resumo, /status=done/);
  assert.match(resumo, /ferramentas: \(nenhuma\)/);
});

test('resumirResultadoParaLog: mostra as ferramentas chamadas na ordem', () => {
  const result = {
    status: 'done',
    steps: [
      {
        toolCalls: [
          { name: 'editar_campos_okr', input: {}, output: { ok: true } },
          { name: 'responder', input: {}, output: { ok: true } },
        ],
      },
    ],
  };
  const resumo = resumirResultadoParaLog(result);
  assert.match(resumo, /ferramentas: editar_campos_okr -> responder/);
});

// ── Flag de modo sombra — trava o valor atual de propósito ─────────────
// Mesmo raciocínio do teste equivalente em mentionTrigger.test.js: se isso
// divergir do esperado, é sinal de mudança acidental do flag, não decisão
// nova. DRY_RUN_OKR_CHAT começa true (modo sombra) — ver comentário no
// topo de agenteChat.js. Atualizar este assert só junto de uma decisão
// deliberada e comunicada de trocar pra escrita real.
test('agenteChat.js exporta DRY_RUN_OKR_CHAT=true (modo sombra no 1º deploy)', () => {
  assert.equal(DRY_RUN_OKR_CHAT, true);
});
