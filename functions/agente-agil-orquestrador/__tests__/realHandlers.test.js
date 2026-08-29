// functions/agente-agil-orquestrador/__tests__/realHandlers.test.js
//
// Cobertura dos handlers reais (Etapa 2 + Etapa 3): buildTools({mode:'real',
// ...}) tem que chamar o mesmo motor de escrita de agente-agil/board.js.
// dryRun é parâmetro de verdade desde a Etapa 3, default true — sem passar
// dryRun explicitamente (Etapa 2, maioria dos testes abaixo), nada é
// aplicado de verdade; com dryRun:false, aplica de verdade (ver teste
// dedicado). Usa o mesmo fake db de agente-agil/__tests__/fakeDb.js — não
// duplica a implementação.
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { buildTools } = require('../tools');
const { runLoop } = require('../loop');
const membersLib = require('../../agente-agil/members');

function seedDevSquadDb(cardKey, card, usuariosPublicos) {
  membersLib._resetCacheForTests();
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
      ...(usuariosPublicos ? { usuarios_publicos: usuariosPublicos } : {}),
    },
  });
}

test('buildTools({mode:"real"}) exige db, squadId e cardId', () => {
  assert.throws(() => buildTools({ mode: 'real' }), /precisa de db, squadId e cardId/);
});

test('handler real de comentario monta o plano de verdade mas nunca escreve (dryRun fixo)', async () => {
  const db = seedDevSquadDb('9', { id: 'c9', title: 'Card no dev', col: 'progress' });
  const tools = buildTools({ mode: 'real', db, squadId: 'dev', cardId: 'c9' });
  const comentario = tools.find((t) => t.name === 'comentario');

  const result = await comentario.handler({ type: 'comentario', texto: 'Testando handler real' });

  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  // card_comments/{cardId} é path próprio por squad, fora da subárvore do
  // card, desde a migração Fase 1.1 (ver cardCommentsPath() em board.js).
  assert.equal(result.plan[0].path, 'kanban/squads/dev/dados/card_comments/c9');

  const commentsAfter = db._data().kanban.squads.dev.dados.card_comments?.c9;
  assert.deepEqual(commentsAfter || {}, {}, 'dryRun fixo não deveria ter escrito nada de verdade');
});

test('handler real devolve card_not_found quando o cardId não existe no squad', async () => {
  const db = seedDevSquadDb('9', { id: 'c9', title: 'Card no dev', col: 'progress' });
  const tools = buildTools({ mode: 'real', db, squadId: 'dev', cardId: 'card-que-nao-existe' });
  const comentario = tools.find((t) => t.name === 'comentario');

  const result = await comentario.handler({ type: 'comentario', texto: 'Oi' });

  assert.deepEqual(result, { ok: false, error: 'card_not_found', cardId: 'card-que-nao-existe', squadId: 'dev' });
});

test('handler real com dryRun:false escreve DE VERDADE no db (Etapa 3 — default continua true quando omitido)', async () => {
  const db = seedDevSquadDb('9', { id: 'c9', title: 'Card no dev', col: 'progress' });
  const tools = buildTools({ mode: 'real', db, squadId: 'dev', cardId: 'c9', dryRun: false });
  const comentario = tools.find((t) => t.name === 'comentario');

  const result = await comentario.handler({ type: 'comentario', texto: 'Escrita real de teste' });

  assert.equal(result.ok, true);
  assert.equal(result.dryRun, false);
  assert.equal(result.applied, 1);

  const comments = Object.values(db._data().kanban.squads.dev.dados.card_comments?.c9 || {});
  assert.equal(comments.length, 1, 'dryRun:false deveria ter escrito o comentário de verdade no fake db');
  assert.equal(comments[0].text, 'Escrita real de teste');
  // Comentário vive fora da subárvore do card desde a migração Fase 1.1
  // (mesmo achado de sprint3.test.js) — sozinho, não estampa mais
  // card.updatedAt.
  const cardAfter = db._data().kanban.squads.dev.dados.cards['9'];
  assert.equal(cardAfter.updatedAt, undefined, 'comentário sozinho não carimba updatedAt do card (path fora da subárvore)');
});

test('handler real de risco com dryRun:false escreve DE VERDADE no db', async () => {
  const db = seedDevSquadDb('9', { id: 'c9', title: 'Card no dev', col: 'progress', riscos: ['Risco já existente'] });
  const tools = buildTools({ mode: 'real', db, squadId: 'dev', cardId: 'c9', dryRun: false });
  const risco = tools.find((t) => t.name === 'risco');

  const result = await risco.handler({ type: 'risco', texto: 'Fornecedor pode atrasar a entrega' });

  assert.equal(result.ok, true);
  assert.equal(result.dryRun, false);
  assert.equal(result.applied, 1);

  const cardAfter = db._data().kanban.squads.dev.dados.cards['9'];
  assert.deepEqual(cardAfter.riscos, ['Risco já existente', 'Fornecedor pode atrasar a entrega']);
});

test('omitir dryRun continua default true (comportamento de todos os scripts/testes anteriores preservado)', async () => {
  const db = seedDevSquadDb('9', { id: 'c9', title: 'Card no dev', col: 'progress' });
  const tools = buildTools({ mode: 'real', db, squadId: 'dev', cardId: 'c9' }); // sem dryRun explícito
  const comentario = tools.find((t) => t.name === 'comentario');

  const result = await comentario.handler({ type: 'comentario', texto: 'Não deveria escrever' });

  assert.equal(result.dryRun, true);
  const commentsAfter = db._data().kanban.squads.dev.dados.card_comments?.c9;
  assert.deepEqual(commentsAfter || {}, {}, 'sem dryRun explícito, nada deveria ser escrito de verdade');
});

test('handler real de mover_coluna funciona mesmo quando o LLM não manda "type" no input (achado real: protocolo de tool-use da Anthropic não reconstitui o nome da ferramenta dentro do input)', async () => {
  const db = makeFakeDb({
    kanban: {
      squads: {
        dev: {
          dados: {
            cards: { 9: { id: 'c9', title: 'Card no dev', col: 'todo', history: [], flow: {} } },
            cards_index: { c9: '9' },
            columns: [
              { id: 'todo', name: 'A Fazer' },
              { id: 'done', name: 'Concluído' },
            ],
            config: { flow: { startCols: [], doneCols: ['done'], reportCols: [] } },
            cards_updated_at: {},
          },
        },
      },
    },
  });
  const tools = buildTools({ mode: 'real', db, squadId: 'dev', cardId: 'c9' });
  const moverColuna = tools.find((t) => t.name === 'mover_coluna');

  // Sem "type" de propósito — exatamente o que o Claude real mandou no
  // cenário 5 (agente-agil-orquestrador/scripts/..MoverColunaInequivoco..):
  // {coluna: "done"}, sem reconstituir o nome da própria ferramenta.
  const result = await moverColuna.handler({ coluna: 'done' });

  assert.equal(result.ok, true, `esperava ok:true, veio: ${JSON.stringify(result)}`);
  assert.equal(result.dryRun, true);
  assert.equal(result.plan[0].path, 'kanban/squads/dev/dados/cards/9/col');

  const cardAfter = db._data().kanban.squads.dev.dados.cards['9'];
  assert.equal(cardAfter.col, 'todo', 'dryRun fixo não deveria ter movido o card de verdade');
});

test('handler real de editar_campos aplica tags (add-only) e priority de verdade (dryRun:false) — canário 7', async () => {
  const db = makeFakeDb({
    kanban: {
      squads: {
        dev: {
          dados: {
            cards: { 9: { id: 'c9', title: 'Card no dev', col: 'progress', tags: ['tag_1'], priority: 'medium', history: [] } },
            cards_index: { c9: '9' },
            tags: [
              { id: 'tag_1', label: 'Piloto' },
              { id: 'tag_2', label: 'Urgente' },
            ],
            cards_updated_at: {},
          },
        },
      },
    },
  });
  const tools = buildTools({ mode: 'real', db, squadId: 'dev', cardId: 'c9', dryRun: false });
  const editarCampos = tools.find((t) => t.name === 'editar_campos');

  // Igual ao que o canário 7 pede pro modelo: label real do squad + nova
  // prioridade — sem "type" de propósito, mesmo achado do mover_coluna.
  const result = await editarCampos.handler({ tags: ['Urgente'], priority: 'high' });

  assert.equal(result.ok, true, `esperava ok:true, veio: ${JSON.stringify(result)}`);
  assert.equal(result.dryRun, false);
  assert.ok(result.applied > 0);

  const cardAfter = db._data().kanban.squads.dev.dados.cards['9'];
  assert.deepEqual(cardAfter.tags, ['tag_1', 'tag_2'], 'add-only: tag_1 (já existente) preservada, tag_2 (Urgente) adicionada');
  assert.equal(cardAfter.priority, 'high');
  assert.ok(cardAfter.updatedAt, 'applyWritePlan deveria carimbar updatedAt do card');
});

test('handler real de editar_campos devolve erro claro (não escreve nada) quando o modelo alucina um label de tag que não existe no squad', async () => {
  const db = makeFakeDb({
    kanban: {
      squads: {
        dev: {
          dados: {
            cards: { 9: { id: 'c9', title: 'Card no dev', col: 'progress', tags: [], priority: 'medium', history: [] } },
            cards_index: { c9: '9' },
            tags: [{ id: 'tag_1', label: 'Piloto' }],
            cards_updated_at: {},
          },
        },
      },
    },
  });
  const tools = buildTools({ mode: 'real', db, squadId: 'dev', cardId: 'c9', dryRun: false });
  const editarCampos = tools.find((t) => t.name === 'editar_campos');

  const result = await editarCampos.handler({ tags: ['Tag Que Não Existe'] });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'invalid_output');

  const cardAfter = db._data().kanban.squads.dev.dados.cards['9'];
  assert.deepEqual(cardAfter.tags, [], 'label inválido: nada deveria ter sido escrito, nem parcialmente');
});

test('perguntar_humano em modo fake continua simulado (não afetado pela mudança de mode:"real")', async () => {
  const db = seedDevSquadDb('9', { id: 'c9', title: 'Card no dev', col: 'progress' });
  const tools = buildTools({ mode: 'fake', db, squadId: 'dev', cardId: 'c9' });
  const perguntar = tools.find((t) => t.name === 'perguntar_humano');

  const result = await perguntar.handler({ pergunta: 'Qual prioridade uso?' });

  assert.equal(result.simulated, true);
  assert.deepEqual(db._data().kanban.squads.dev.dados.cards['9'], { id: 'c9', title: 'Card no dev', col: 'progress' });
});

const RESPONSAVEL_SEED = {
  uidCaio: { nome: 'Caio Oliveira', email: 'caio.oliveira@ciahering.com.br', init: 'CO', squads: { dev: true } },
};

test('perguntar_humano real em dryRun (default) monta o plano composto (comentario + agent_status + menção ao responsável) mas não escreve', async () => {
  const db = seedDevSquadDb(
    '9',
    { id: 'c9', title: 'Card no dev', col: 'progress', owner: 'CO', agentStatus: null, executorType: null, history: [] },
    RESPONSAVEL_SEED,
  );
  const tools = buildTools({ mode: 'real', db, squadId: 'dev', cardId: 'c9' }); // sem dryRun explícito
  const perguntar = tools.find((t) => t.name === 'perguntar_humano');

  const result = await perguntar.handler({ pergunta: 'Qual prioridade uso?' });

  assert.equal(result.ok, true, `esperava ok:true, veio: ${JSON.stringify(result)}`);
  assert.equal(result.dryRun, true);
  assert.equal(result.tool, 'perguntar_humano');
  // 1 output de comentario (1 step de comentário + 1 step de notificação,
  // já que o texto tem @menção) + 1 output de agent_status (2 steps: update
  // do campo agentStatus + transaction de executorType) = 4 steps. Em
  // dryRun o step de notificação vem como {kind:'noop'} (notify.buildNotifStep
  // devolve noop quando dryRun) — ainda aparece no PLANO pra poder inspecionar
  // o que SERIA notificado, só não é aplicado por _applySteps (ver
  // applyWritePlan, que pula kind:'noop' de propósito).
  assert.equal(result.plan.length, 4);
  assert.equal(result.plan[1].kind, 'noop', 'step de notificação da @menção deveria vir como noop em dryRun, sem ser aplicado');
  assert.ok(result.plan[0].data[Object.keys(result.plan[0].data)[0]].text.includes('@CO'), 'texto do comentário (mesmo em dryRun) já deveria ter a @menção ao responsável');

  const cardAfter = db._data().kanban.squads.dev.dados.cards['9'];
  const commentsAfter = db._data().kanban.squads.dev.dados.card_comments?.c9;
  assert.deepEqual(commentsAfter || {}, {}, 'dryRun (default) não deveria ter escrito nada de verdade');
  assert.equal(cardAfter.agentStatus, null, 'dryRun (default) não deveria ter mudado agentStatus de verdade');
  assert.deepEqual(db._data().kanban.usuarios || {}, {}, 'dryRun (default) não deveria ter criado notificação nenhuma');
});

test('perguntar_humano real com dryRun:false posta a pergunta como comentário (prefixo ❓ + @menção ao responsável), marca agent_status:awaiting_validation e notifica de verdade', async () => {
  const db = seedDevSquadDb(
    '9',
    { id: 'c9', title: 'Card no dev', col: 'progress', owner: 'CO', agentStatus: null, executorType: null, history: [] },
    RESPONSAVEL_SEED,
  );
  const tools = buildTools({ mode: 'real', db, squadId: 'dev', cardId: 'c9', dryRun: false });
  const perguntar = tools.find((t) => t.name === 'perguntar_humano');

  const result = await perguntar.handler({ pergunta: 'Qual prioridade uso pra esse card?' });

  assert.equal(result.ok, true, `esperava ok:true, veio: ${JSON.stringify(result)}`);
  assert.equal(result.dryRun, false);
  assert.ok(result.applied > 0);

  const cardAfter = db._data().kanban.squads.dev.dados.cards['9'];
  const comments = Object.values(db._data().kanban.squads.dev.dados.card_comments?.c9 || {});
  assert.equal(comments.length, 1, 'deveria ter escrito o comentário de verdade');
  assert.ok(
    comments[0].text.startsWith('❓ Agente Ágil precisa de uma resposta de @CO:'),
    'comentário deveria ter o prefixo + @menção ao responsável, achado real do canário 6: sem @menção, outputs/comentario.js nunca dispara notificação (ver notifications.js)',
  );
  assert.ok(comments[0].text.includes('Qual prioridade uso pra esse card?'), 'comentário deveria conter a pergunta em si');
  assert.equal(comments[0].author, 'Agente Ágil');

  assert.equal(cardAfter.agentStatus, 'awaiting_validation', 'deveria reaproveitar o campo/badge existente em vez de campo novo');
  assert.equal(cardAfter.executorType, 'agent', 'agent_status sem executorType explícito promove human/vazio -> agent (comportamento já existente do builder, não suprimido)');
  assert.ok(cardAfter.updatedAt, 'applyWritePlan deveria carimbar updatedAt do card');
  assert.ok(db._data().kanban.squads.dev.dados.cards_updated_at && db._data().kanban.squads.dev.dados.cards_updated_at['c9'], 'deveria carimbar cards_updated_at pro delta-sync do cliente perceber a mudança');

  const notifs = Object.values(db._data().kanban.usuarios.uidCaio.notificacoes || {});
  assert.equal(notifs.length, 1, 'a @menção deveria ter disparado UMA notificação de verdade pro responsável — achado do canário 6, sem isso a pergunta ficava soterrada no feed');
  assert.equal(notifs[0].type, 'mention');
  assert.equal(notifs[0].cardId, 'c9');
});

test('perguntar_humano real sem responsável no card (owner vazio) posta o comentário sem @menção, sem quebrar', async () => {
  const db = seedDevSquadDb('9', { id: 'c9', title: 'Card sem dono', col: 'progress', agentStatus: null, executorType: null, history: [] });
  const tools = buildTools({ mode: 'real', db, squadId: 'dev', cardId: 'c9', dryRun: false });
  const perguntar = tools.find((t) => t.name === 'perguntar_humano');

  const result = await perguntar.handler({ pergunta: 'Card sem responsável, alguém decide?' });

  assert.equal(result.ok, true);
  const comments = Object.values(db._data().kanban.squads.dev.dados.card_comments?.c9 || {});
  assert.equal(comments.length, 1);
  assert.equal(comments[0].text, '❓ Agente Ágil precisa de uma resposta:\n\nCard sem responsável, alguém decide?', 'sem owner, mesmo texto de antes — sem @menção pendurada em branco');
});

function pendingAutoEntries(db, squadId) {
  const node = db._data().kanban?.squads?.[squadId]?.dados?.agente_pending_auto || {};
  return Object.values(node);
}

test('handler real de mover_coluna com dryRun:false enfileira o gatilho "move" (achado real /monitorarbugs: Automações não disparavam pra mutação do orquestrador)', async () => {
  const db = makeFakeDb({
    kanban: {
      squads: {
        dev: {
          dados: {
            cards: { 9: { id: 'c9', title: 'Card no dev', col: 'todo', history: [], flow: {} } },
            cards_index: { c9: '9' },
            columns: [
              { id: 'todo', name: 'A Fazer' },
              { id: 'done', name: 'Concluído' },
            ],
            config: { flow: { startCols: [], doneCols: ['done'], reportCols: [] } },
            cards_updated_at: {},
          },
        },
      },
    },
  });
  const tools = buildTools({ mode: 'real', db, squadId: 'dev', cardId: 'c9', dryRun: false });
  const moverColuna = tools.find((t) => t.name === 'mover_coluna');

  const result = await moverColuna.handler({ coluna: 'done' });

  assert.equal(result.ok, true, `esperava ok:true, veio: ${JSON.stringify(result)}`);
  const entries = pendingAutoEntries(db, 'dev');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].eventType, 'move');
  assert.equal(entries[0].cardId, 'c9');
  assert.equal(entries[0].extra, 'done');
});

test('handler real de mover_coluna em dryRun (default) NÃO enfileira nada (nada foi escrito de verdade)', async () => {
  const db = makeFakeDb({
    kanban: {
      squads: {
        dev: {
          dados: {
            cards: { 9: { id: 'c9', title: 'Card no dev', col: 'todo', history: [], flow: {} } },
            cards_index: { c9: '9' },
            columns: [
              { id: 'todo', name: 'A Fazer' },
              { id: 'done', name: 'Concluído' },
            ],
            config: { flow: { startCols: [], doneCols: ['done'], reportCols: [] } },
            cards_updated_at: {},
          },
        },
      },
    },
  });
  const tools = buildTools({ mode: 'real', db, squadId: 'dev', cardId: 'c9' });
  const moverColuna = tools.find((t) => t.name === 'mover_coluna');

  await moverColuna.handler({ coluna: 'done' });

  assert.deepEqual(pendingAutoEntries(db, 'dev'), []);
});

test('handler real de editar_campos com dryRun:false enfileira priority + tag_added (canário 7, mesmo cenário do teste de tags/priority acima)', async () => {
  const db = makeFakeDb({
    kanban: {
      squads: {
        dev: {
          dados: {
            cards: { 9: { id: 'c9', title: 'Card no dev', col: 'progress', tags: ['tag_1'], priority: 'medium', history: [] } },
            cards_index: { c9: '9' },
            tags: [
              { id: 'tag_1', label: 'Piloto' },
              { id: 'tag_2', label: 'Urgente' },
            ],
            cards_updated_at: {},
          },
        },
      },
    },
  });
  const tools = buildTools({ mode: 'real', db, squadId: 'dev', cardId: 'c9', dryRun: false });
  const editarCampos = tools.find((t) => t.name === 'editar_campos');

  await editarCampos.handler({ tags: ['Urgente'], priority: 'high' });

  const entries = pendingAutoEntries(db, 'dev');
  assert.equal(entries.length, 2);
  assert.ok(entries.some((e) => e.eventType === 'priority'));
  assert.ok(entries.some((e) => e.eventType === 'tag_added' && e.extra === 'tag_2'));
});

test('handler real de comentario com dryRun:false NÃO enfileira nada (nenhum campo relevante pra Automações muda)', async () => {
  const db = seedDevSquadDb('9', { id: 'c9', title: 'Card no dev', col: 'progress' });
  const tools = buildTools({ mode: 'real', db, squadId: 'dev', cardId: 'c9', dryRun: false });
  const comentario = tools.find((t) => t.name === 'comentario');

  await comentario.handler({ type: 'comentario', texto: 'Só um comentário, não deveria disparar automação nenhuma' });

  assert.deepEqual(pendingAutoEntries(db, 'dev'), []);
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
