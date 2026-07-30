// functions/agente-agil/__tests__/squadIdParam.test.js
//
// Cobertura da parametrização de squadId em board.js (resolveCardKey,
// buildWritePlan, applyWritePlan), feita pro agente-agil-orquestrador/ poder
// rodar contra o squad 'dev' sem arriscar 'ecomm' (produção). Arquivo NOVO —
// não altera nenhum dos testes já existentes neste diretório, que continuam
// validando o comportamento default (squad 'ecomm') sem saber que esse
// parâmetro passou a existir.
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFakeDb } = require('./fakeDb');
const { resolveCardKey, buildWritePlan, applyWritePlan, cardsUpdatedAtPath } = require('../board');
const membersLib = require('../members');
const flowLib = require('../flow');

const MEMBERS_SEED = {
  'kanban/usuarios_publicos': {
    uidDev: { nome: 'Dev Tester', email: 'dev.tester@ciahering.com.br', init: 'DEV', squads: { dev: true } },
  },
};

function seedDevSquadDb(cardKey, card) {
  membersLib._resetCacheForTests();
  flowLib._resetCacheForTests();
  return makeFakeDb({
    ...MEMBERS_SEED,
    kanban: {
      squads: {
        dev: {
          dados: {
            cards: { [cardKey]: card },
            cards_index: { [card.id]: cardKey },
            tags: [],
          },
        },
        // Card homônimo em 'ecomm' com dados DIFERENTES — prova que passar
        // squadId:'dev' não vaza pro squad default.
        ecomm: {
          dados: {
            cards: { [cardKey]: { ...card, title: 'NÃO deveria ler este card (ecomm)' } },
            cards_index: { [card.id]: cardKey },
          },
        },
      },
      usuarios_publicos: MEMBERS_SEED['kanban/usuarios_publicos'],
    },
  });
}

test('resolveCardKey com squadId explícito resolve contra o squad certo, não contra ecomm (default)', async () => {
  const db = seedDevSquadDb('9', { id: 'c9', title: 'Card no dev', col: 'progress' });
  const key = await resolveCardKey(db, 'c9', { squadId: 'dev' });
  assert.equal(key, '9');
});

test('buildWritePlan com extra.squadId monta o plano contra o squad certo (comentario)', async () => {
  const db = seedDevSquadDb('9', { id: 'c9', title: 'Card no dev', col: 'progress', comments: {} });
  const plan = await buildWritePlan('9', [{ type: 'comentario', texto: 'Testando squadId' }], {
    cardId: 'c9',
    squadId: 'dev',
    db,
  });
  assert.equal(plan.length, 1);
  assert.equal(plan[0].path, 'kanban/squads/dev/dados/cards/9/comments');

  await applyWritePlan(db, plan, { cardPath: 'kanban/squads/dev/dados/cards/9', cardId: 'c9', squadId: 'dev' });

  const devCard = db._data().kanban.squads.dev.dados.cards['9'];
  const ecommCard = db._data().kanban.squads.ecomm.dados.cards['9'];
  assert.equal(Object.keys(devCard.comments).length, 1, 'comentário deveria ter sido escrito no card do squad dev');
  assert.equal(Object.keys(ecommCard.comments || {}).length, 0, 'card homônimo em ecomm não deveria ter sido tocado');
});

test('applyWritePlan com cardMeta.squadId carimba cards_updated_at do squad certo, não o de ecomm', async () => {
  const db = seedDevSquadDb('9', { id: 'c9', title: 'Card no dev', col: 'progress', comments: {} });
  const plan = await buildWritePlan('9', [{ type: 'comentario', texto: 'Oi' }], { cardId: 'c9', squadId: 'dev', db });
  await applyWritePlan(db, plan, { cardPath: 'kanban/squads/dev/dados/cards/9', cardId: 'c9', squadId: 'dev' });

  const devStampNode = cardsUpdatedAtPath('dev').split('/').reduce((cur, seg) => (cur ? cur[seg] : undefined), db._data());
  const ecommStampNode = cardsUpdatedAtPath('ecomm').split('/').reduce((cur, seg) => (cur ? cur[seg] : undefined), db._data());
  assert.ok(devStampNode && devStampNode.c9, 'cards_updated_at do squad dev deveria ter sido carimbado');
  assert.equal(ecommStampNode, undefined, 'cards_updated_at de ecomm não deveria ter sido tocado');
});

test('buildWritePlan sem extra.squadId continua batendo em ecomm (default preservado)', async () => {
  const db = makeFakeDb({
    kanban: { squads: { ecomm: { dados: { cards: { 5: { id: 'c5', title: 'Card X', col: 'progress', comments: {} } } } } } },
  });
  const plan = await buildWritePlan('5', [{ type: 'comentario', texto: 'Oi' }], { cardId: 'c5', db });
  assert.equal(plan[0].path, 'kanban/squads/ecomm/dados/cards/5/comments');
});

test('buildWritePlan com extra.notificar usa o squadId certo no step de notificação (bugfix: antes usava SQUAD_ID fixo)', async () => {
  const db = seedDevSquadDb('9', { id: 'c9', title: 'Card no dev', col: 'progress', comments: {} });
  const plan = await buildWritePlan('9', [{ type: 'comentario', texto: 'Sem menção aqui' }], {
    cardId: 'c9',
    squadId: 'dev',
    db,
    notificar: ['DEV'],
  });

  const notifStep = plan.find((s) => s.path === 'kanban/usuarios/uidDev/notificacoes');
  assert.ok(notifStep, 'deveria ter montado um step de notificação pro uidDev');
  const notifData = Object.values(notifStep.data)[0];
  assert.equal(notifData.squad, 'dev', 'notificação deveria carregar squad:"dev", não o SQUAD_ID default');
});
