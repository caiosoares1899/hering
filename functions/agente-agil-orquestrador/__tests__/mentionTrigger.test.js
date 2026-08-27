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
  createMentionTrigger,
  agenteAgilMencaoDados,
  processarMencaoDados,
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

// Achado real (2026-08-18): usuário perguntou "não deveria me mencionar pra
// notificar?" depois de ver a resposta aparecer certinho no card, mas sem
// nenhuma notificação chegar pra ele — comentario só notifica quando o
// TEXTO tem uma @menção reconhecível, e a resposta do agente normalmente
// não menciona ninguém.
test('notifica quem fez a @menção original, mesmo a resposta não mencionando ninguém no texto', async () => {
  const db = seedDb();
  const llmClient = scriptedLlmClient([
    { toolCalls: [{ id: '1', name: 'comentario', input: { type: 'comentario', texto: 'Sprint é o ciclo fixo de trabalho do time.' } }], text: null },
    { toolCalls: [], text: 'Concluído.' },
  ]);
  const comment = { uid: 'uid-quem-perguntou', text: '@Agente Ágil me explica o conceito de sprint' };

  await processarMencao(db, { cardId: 'c1', commentId: 'cm-notif', comment, llmClient });

  const notifs = Object.values((await db.ref('kanban/usuarios/uid-quem-perguntou/notificacoes').get()).val() || {});
  assert.equal(notifs.length, 1, 'quem mencionou o agente deveria ser notificado da resposta, mesmo sem @menção no texto');
  assert.equal(notifs[0].type, 'mention');
  assert.equal(notifs[0].cardId, 'c1');
});

// ── Achado real (2026-08-24): comment.uid==='automacao' (disparo via
// dueOverdueTrigger.js/AUTO_ACTIONS.notify_agent, não uma pessoa de
// verdade) — notificar esse "uid" grava numa notificação fantasma que
// ninguém lê. Fix: notifica o responsável do card (card.owner) nesse
// caso, não comment.uid. ──────────────────────────────────────────────

test('comment.uid===automacao: notifica o RESPONSÁVEL do card (card.owner), não o uid sintético "automacao"', async () => {
  const db = seedDb({
    usuarios_publicos: {
      uidAna: { nome: 'Ana Silva', email: 'ana@ciahering.com.br', init: 'ANA', squads: { [SQUAD_ID]: true } },
    },
  });
  await db.ref(`kanban/squads/${SQUAD_ID}/dados/cards/9`).update({ owner: 'ANA' });
  const llmClient = scriptedLlmClient([
    { toolCalls: [{ id: '1', name: 'comentario', input: { type: 'comentario', texto: 'Card sem descrição, não dá pra avaliar.' } }], text: null },
    { toolCalls: [], text: 'Concluído.' },
  ]);
  const comment = { uid: 'automacao', text: '@Agente Ágil — [Automação] Card "Card de teste" está atrasado (venceu ontem).' };

  await processarMencao(db, { cardId: 'c1', commentId: 'cm-auto1', comment, llmClient });

  const notifsAutomacao = await db.ref('kanban/usuarios/automacao/notificacoes').get();
  assert.equal(notifsAutomacao.val(), null, 'não deveria gravar nada no uid sintético "automacao"');
  const notifsAna = Object.values((await db.ref('kanban/usuarios/uidAna/notificacoes').get()).val() || {});
  assert.equal(notifsAna.length, 1, 'a responsável do card deveria ser notificada');
  assert.equal(notifsAna[0].type, 'mention');
  assert.match(notifsAna[0].title, /Automação/);
});

test('comment.uid===automacao, card SEM responsável — não notifica ninguém (mas processa normalmente)', async () => {
  const db = seedDb();
  const llmClient = scriptedLlmClient([
    { toolCalls: [{ id: '1', name: 'comentario', input: { type: 'comentario', texto: 'Sem responsável definido.' } }], text: null },
    { toolCalls: [], text: 'Concluído.' },
  ]);
  const comment = { uid: 'automacao', text: '@Agente Ágil — [Automação] Card "Card de teste" vence hoje.' };

  const outcome = await processarMencao(db, { cardId: 'c1', commentId: 'cm-auto2', comment, llmClient });

  assert.equal(outcome.processed, true);
  const notifsAutomacao = await db.ref('kanban/usuarios/automacao/notificacoes').get();
  assert.equal(notifsAutomacao.val(), null);
});

test('comment.uid===automacao, card.owner não bate com nenhum membro real — não notifica (sem chutar)', async () => {
  const db = seedDb({
    usuarios_publicos: {
      uidAna: { nome: 'Ana Silva', email: 'ana@ciahering.com.br', init: 'ANA', squads: { [SQUAD_ID]: true } },
    },
  });
  await db.ref(`kanban/squads/${SQUAD_ID}/dados/cards/9`).update({ owner: 'XYZ' }); // init sem membro correspondente
  const llmClient = scriptedLlmClient([
    { toolCalls: [{ id: '1', name: 'comentario', input: { type: 'comentario', texto: 'Owner não resolvido.' } }], text: null },
    { toolCalls: [], text: 'Concluído.' },
  ]);
  const comment = { uid: 'automacao', text: '@Agente Ágil — [Automação] teste' };

  await processarMencao(db, { cardId: 'c1', commentId: 'cm-auto3', comment, llmClient });

  const notifsAna = await db.ref('kanban/usuarios/uidAna/notificacoes').get();
  assert.equal(notifsAna.val(), null);
});

// Achado real (2026-08-24, MESMO dia — a 1ª versão deste fix ainda não
// resolvia): usar o mesmo idOverride (mention_{cardId}_{uid}) que os
// outros 2 caminhos já usam fazia a notificação da Automação colidir com
// QUALQUER notificação anterior pra essa pessoa nesse card — inclusive
// uma bem antiga, de um teste ou @menção manual anterior — e
// buildNotifStep() pulava pra sempre depois disso, mesmo em disparos
// novos, dias depois, com informação nova de verdade. Confirmado ao
// vivo em produção: uma notificação de @menção humana antiga bloqueou
// silenciosamente 2 disparos de Automação novos no mesmo card.
test('comment.uid===automacao: notifica de novo mesmo já existindo uma notificação ANTERIOR pra essa pessoa nesse card (não reusa o idOverride mention_{cardId}_{uid})', async () => {
  const db = seedDb({
    usuarios_publicos: {
      uidAna: { nome: 'Ana Silva', email: 'ana@ciahering.com.br', init: 'ANA', squads: { [SQUAD_ID]: true } },
    },
  });
  await db.ref(`kanban/squads/${SQUAD_ID}/dados/cards/9`).update({ owner: 'ANA' });
  // Simula uma notificação BEM ANTERIOR pra essa mesma pessoa+card, de um
  // caminho diferente (ex.: @menção humana real no texto de outro
  // comentário) — mesmo id que esses outros caminhos usam.
  await db.ref('kanban/usuarios/uidAna/notificacoes/mention_c1_uidAna').set({
    id: 'mention_c1_uidAna', cardId: 'c1', type: 'mention', title: '@ANA — você foi mencionado', sub: 'antiga', read: true, ts: '2026-08-01T00:00:00.000Z', squad: SQUAD_ID,
  });

  const llmClient = scriptedLlmClient([
    { toolCalls: [{ id: '1', name: 'comentario', input: { type: 'comentario', texto: 'Disparo novo da Automação, dias depois.' } }], text: null },
    { toolCalls: [], text: 'Concluído.' },
  ]);
  const comment = { uid: 'automacao', text: '@Agente Ágil — [Automação] Card "Card de teste" está atrasado (venceu ontem).' };

  await processarMencao(db, { cardId: 'c1', commentId: 'cm-auto-novo', comment, llmClient });

  const notifsAna = Object.values((await db.ref('kanban/usuarios/uidAna/notificacoes').get()).val() || {});
  assert.equal(notifsAna.length, 2, 'a notificação antiga continua lá, E uma nova deveria ter sido criada — não bloqueada pelo idOverride antigo');
  const nova = notifsAna.find((n) => n.sub.includes('não dá pra avaliar') || n.title.includes('Automação'));
  assert.ok(notifsAna.some((n) => n.title.includes('Automação')), 'deveria existir uma notificação nova com o título da Automação');
});

// Achado real ao vivo (2026-08-27, reportado pelo usuário): antes desta
// correção, o idOverride da notificação de @menção humana era só
// `mention_{cardId}_{uid}` (sem commentId) — mesmo problema já achado e
// corrigido pro ramo da Automação (ver testes acima), nunca replicado pro
// "caso original". Uma 2ª @menção da MESMA pessoa no MESMO card (pergunta
// NOVA, não um reprocessamento do mesmo evento) não gerava notificação
// nenhuma, porque o slot já estava ocupado pela 1ª. Este teste ANTES
// afirmava esse comportamento (bug) como esperado — corrigido pra refletir
// o comportamento certo: 2 menções diferentes = 2 notificações.
test('2 @menções diferentes da mesma pessoa no mesmo card geram 2 notificações (não é a mesma pergunta de novo)', async () => {
  const db = seedDb();
  const llmClient = () =>
    scriptedLlmClient([
      { toolCalls: [{ id: '1', name: 'comentario', input: { type: 'comentario', texto: 'Resposta.' } }], text: null },
      { toolCalls: [], text: 'Concluído.' },
    ]);
  const comment = { uid: 'uid-quem-perguntou', text: '@Agente Ágil pergunta' };

  await processarMencao(db, { cardId: 'c1', commentId: 'cm-notif-a', comment, llmClient: llmClient() });
  await processarMencao(db, { cardId: 'c1', commentId: 'cm-notif-b', comment, llmClient: llmClient() });

  const notifs = Object.values((await db.ref('kanban/usuarios/uid-quem-perguntou/notificacoes').get()).val() || {});
  assert.equal(notifs.length, 2, 'commentId diferente = pergunta nova = notificação nova, mesmo card+pessoa de antes');
});

// Idempotência de verdade (RTDB triggers não garantem exatamente-uma-vez,
// ver comentário no topo do arquivo): reentrega do MESMO evento (MESMO
// commentId) não deveria duplicar a notificação.
test('reentrega do MESMO commentId não duplica a notificação (idempotência)', async () => {
  const db = seedDb();
  const llmClient = () =>
    scriptedLlmClient([
      { toolCalls: [{ id: '1', name: 'comentario', input: { type: 'comentario', texto: 'Resposta.' } }], text: null },
      { toolCalls: [], text: 'Concluído.' },
    ]);
  const comment = { uid: 'uid-quem-perguntou', text: '@Agente Ágil pergunta' };

  await processarMencao(db, { cardId: 'c1', commentId: 'cm-notif-a', comment, llmClient: llmClient() });
  // Reentrega real bateria no early-return de idempotência (IDEMPOTENCY_PATH)
  // antes de chegar aqui — este teste isola só o comportamento do
  // idOverride, chamando processarMencao() direto de novo com o MESMO
  // commentId (sem passar pelo guard de idempotência, que é testado à parte).
  await processarMencao(db, { cardId: 'c1', commentId: 'cm-notif-a', comment, llmClient: llmClient() });

  const notifs = Object.values((await db.ref('kanban/usuarios/uid-quem-perguntou/notificacoes').get()).val() || {});
  assert.equal(notifs.length, 1, 'mesmo commentId = mesmo evento = idOverride igual = não duplica');
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

// ── createMentionTrigger() — fábrica multi-squad (2026-08-21) ───────────
// Pedido do usuário: preparar o squad `dados` SEM subir pra produção em
// horário de trabalho. Ativado depois em 2 etapas deliberadas: deploy em
// modo sombra (PR #480, 2026-08-23), validado em produção com logs reais
// (dryRun=true, status=done, idempotência OK), e só então dryRun virou
// false (2026-08-24) — mesma disciplina que o squad dev seguiu.
// `agenteAgilMencaoDados`/`processarMencaoDados` são a instância real,
// exportada em functions/index.js — os testes abaixo cobrem tanto a
// fábrica em si (paths escopados por squad) quanto o comportamento real
// (dryRun:false) da instância `dados` hoje.

test('createMentionTrigger: cada instância tem seu próprio IDEMPOTENCY_PATH, escopado por squad', () => {
  const dev = createMentionTrigger({ squadId: 'dev', dryRun: false });
  const dados = createMentionTrigger({ squadId: 'dados', dryRun: true });
  assert.equal(dev.IDEMPOTENCY_PATH, 'kanban/squads/dev/dados/agente_agil_mencao_processed');
  assert.equal(dados.IDEMPOTENCY_PATH, 'kanban/squads/dados/dados/agente_agil_mencao_processed');
  assert.notEqual(dev.IDEMPOTENCY_PATH, dados.IDEMPOTENCY_PATH);
});

test('createMentionTrigger: squad novo entra em modo sombra por padrão (dryRun:true) se não especificado', () => {
  const instancia = createMentionTrigger({ squadId: 'outro-squad' });
  assert.equal(instancia.DRY_RUN_MENCAO, true);
});

test('mentionTrigger.js exporta a instância dev com dryRun:false, sem regressão da fábrica', () => {
  assert.equal(DRY_RUN_MENCAO, false);
  assert.equal(SQUAD_ID, 'dev');
});

test('agenteAgilMencaoDados/processarMencaoDados exportados e ativos em functions/index.js', () => {
  assert.equal(typeof agenteAgilMencaoDados, 'function'); // onValueCreated() devolve uma CloudFunction (callable), mesmo tipo de agenteAgilMencao
  assert.equal(typeof processarMencaoDados, 'function');
});

test('processarMencaoDados: dryRun:false (ativado 2026-08-24) — escreve comentário real de verdade', async () => {
  membersLib._resetCacheForTests();
  const db = makeFakeDb({
    kanban: {
      squads: {
        dados: {
          dados: {
            cards: { 9: { id: 'c1', title: 'Card de teste (squad dados)', col: 'progress', comments: {} } },
            cards_index: { c1: '9' },
            tags: [],
          },
        },
      },
      config: { agente_agil_orquestrador: { enabled: true } },
    },
  });
  // Mesmo padrão do teste "processa uma menção válida" acima: finalText
  // sem chamada de ferramenta nenhuma aciona a rede de segurança
  // (fallbackComentario), que usa o MESMO handler.
  const llmClient = scriptedLlmClient([{ toolCalls: [], text: 'Confirmado.' }]);
  const comment = { uid: 'uidHumano', text: '@Agente Ágil confirma esse card', ts: '2026-08-21T10:00:00.000Z' };

  const outcome = await processarMencaoDados(db, { cardId: 'c1', commentId: 'cmt1', comment, llmClient });

  assert.equal(outcome.processed, true);
  assert.equal(outcome.result.status, 'done');
  // dryRun:false — o comentário de resposta é escrito de verdade no path
  // de comentários do squad dados.
  const comentariosReais = await db.ref('kanban/squads/dados/dados/card_comments/c1').get();
  const lista = Object.values(comentariosReais.val() || {});
  assert.equal(lista.length, 1);
  assert.equal(lista[0].text, 'Confirmado.');
});
