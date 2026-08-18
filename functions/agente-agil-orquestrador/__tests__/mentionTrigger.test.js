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
const {
  processarMencao,
  resumirResultadoParaLog,
  SQUAD_ID,
  IDEMPOTENCY_PATH,
  AGENTE_UID,
  DRY_RUN_MENCAO,
} = require('../mentionTrigger');

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

test('processa uma menção válida: chama o loop, marca idempotência, dryRun fixo em DRY_RUN_MENCAO', async () => {
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
  assert.equal(marcado.val().dryRun, DRY_RUN_MENCAO);
  // Trava o valor ATUAL de propósito — se isso divergir do esperado, é
  // sinal de mudança acidental do flag, não decisão nova (decisão de
  // 2026-08-18: virou `false`, escrita real, ver comentário em
  // mentionTrigger.js). Atualizar este assert junto de qualquer mudança
  // futura do flag, nunca deixar o teste "seguir" o valor sem revisar.
  assert.equal(DRY_RUN_MENCAO, false);
});

// Achado real (2026-08-18): mesma revisão deployada, mesmo prompt, e o
// modelo às vezes termina só com finalText (como no cliente scriptado
// acima, de propósito) sem chamar comentario — não-determinismo do LLM,
// não bug. A rede de segurança em processarMencao() garante entrega mesmo
// assim.
test('rede de segurança: se o modelo não chama comentario mas devolve finalText, posta ele mesmo como fallback', async () => {
  const db = seedDb();
  const llmClient = scriptedLlmClient([{ toolCalls: [], text: 'Sprint é o ciclo fixo de trabalho do time.' }]);
  const comment = { uid: 'uid-humano', text: '@Agente Ágil me explica o conceito de sprint' };

  const outcome = await processarMencao(db, { cardId: 'c1', commentId: 'cm-fallback', comment, llmClient });

  assert.equal(outcome.processed, true);
  assert.equal(outcome.fallbackComentario, true);

  const comentariosNoCard = Object.values((await db.ref('kanban/squads/dev/dados/card_comments/c1').get()).val() || {});
  assert.equal(comentariosNoCard.length, 1, 'fallback deveria ter postado o finalText como comentario de verdade');
  assert.equal(comentariosNoCard[0].text, 'Sprint é o ciclo fixo de trabalho do time.');
  assert.equal(comentariosNoCard[0].author, 'Agente Ágil');

  const marcado = await db.ref(`${IDEMPOTENCY_PATH}/cm-fallback`).get();
  assert.equal(marcado.val().fallbackComentario, true);
});

test('rede de segurança NÃO duplica: se o modelo já chamou comentario, não posta o finalText de novo', async () => {
  const db = seedDb();
  const llmClient = scriptedLlmClient([
    { toolCalls: [{ id: '1', name: 'comentario', input: { type: 'comentario', texto: 'Resposta via ferramenta.' } }], text: null },
    { toolCalls: [], text: 'Concluído.' },
  ]);
  const comment = { uid: 'uid-humano', text: '@Agente Ágil qualquer coisa' };

  const outcome = await processarMencao(db, { cardId: 'c1', commentId: 'cm-sem-fallback', comment, llmClient });

  assert.equal(outcome.fallbackComentario, false);
  const comentariosNoCard = Object.values((await db.ref('kanban/squads/dev/dados/card_comments/c1').get()).val() || {});
  assert.equal(comentariosNoCard.length, 1, 'só o comentário real da ferramenta, sem duplicata do fallback');
  assert.equal(comentariosNoCard[0].text, 'Resposta via ferramenta.');
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
  assert.equal(comentarioCall.output.dryRun, false); // escrita real (DRY_RUN_MENCAO=false) — comentário de verdade, não simulado
});

// ── resumirResultadoParaLog() — formatação do log de produção ──────────
// Função pura (não depende de db/Firebase), separada de processarMencao()
// de propósito. Cobre o pedido do usuário: precisa dar pra julgar se as
// decisões fizeram sentido só lendo o log, sem abrir o Firebase Console.

test('resumirResultadoParaLog: sem nenhuma ferramenta chamada (resposta só em texto)', () => {
  const result = { status: 'done', finalText: 'Não há nada a fazer aqui.', steps: [] };
  const resumo = resumirResultadoParaLog(result);
  assert.match(resumo, /status=done/);
  assert.match(resumo, /ferramentas: \(nenhuma\)/);
  assert.match(resumo, /finalText: "Não há nada a fazer aqui\."/);
});

test('resumirResultadoParaLog: mostra as ferramentas na ordem, com input resumido (sem o campo "type" redundante)', () => {
  const result = {
    status: 'done',
    finalText: 'Feito.',
    steps: [
      {
        iteration: 1,
        toolCalls: [
          { name: 'checklist_item', input: { type: 'checklist_item', item: 'Testar em prod', done: true }, output: { ok: true } },
          { name: 'comentario', input: { type: 'comentario', texto: 'Marquei o item.' }, output: { ok: true } },
        ],
      },
    ],
  };
  const resumo = resumirResultadoParaLog(result);
  assert.match(resumo, /ferramentas: checklist_item\(.*\) -> comentario\(.*\)/);
  assert.ok(!resumo.includes('"type"')); // campo type removido do resumo, já é redundante com o nome da ferramenta
  assert.match(resumo, /item.*Testar em prod/);
  assert.match(resumo, /texto.*Marquei o item\./);
});

test('resumirResultadoParaLog: trunca input e finalText muito longos, sem quebrar', () => {
  const descLonga = 'x'.repeat(1000);
  const finalTextLongo = 'y'.repeat(1000);
  const result = {
    status: 'done',
    finalText: finalTextLongo,
    steps: [{ iteration: 1, toolCalls: [{ name: 'editar_campos', input: { type: 'editar_campos', desc: descLonga }, output: { ok: true } }] }],
  };
  const resumo = resumirResultadoParaLog(result);
  assert.ok(resumo.length < descLonga.length + finalTextLongo.length); // realmente truncou, não colou tudo cru
  assert.match(resumo, /…/); // marcador de truncamento presente
});

test('resumirResultadoParaLog: status awaiting_human também formata sem erro', () => {
  const result = {
    status: 'awaiting_human',
    finalText: null,
    steps: [
      {
        iteration: 1,
        toolCalls: [{ name: 'perguntar_humano', input: { type: 'perguntar_humano', pergunta: 'Qual coluna devo usar?' }, output: { ok: true } }],
      },
    ],
  };
  const resumo = resumirResultadoParaLog(result);
  assert.match(resumo, /status=awaiting_human/);
  assert.match(resumo, /finalText: "\(nenhum\)"/);
  assert.match(resumo, /pergunta.*Qual coluna devo usar\?/);
});
