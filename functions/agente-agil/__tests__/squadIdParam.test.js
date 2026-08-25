// functions/agente-agil/__tests__/squadIdParam.test.js
//
// Cobertura da parametrização de squadId em board.js (resolveCardKey,
// buildWritePlan, applyWritePlan) — squadId explícito precisa isolar
// corretamente de qualquer OUTRO squad, não só do default. 'outro-squad'
// abaixo é só um nome de squad qualquer usado como decoy pra provar
// isolamento (nunca existiu de verdade, sem relação com nenhum squad real).
//
// Desde 2026-08-25 o default (SQUAD_ID em board.js) é 'dev', não mais
// 'ecomm' (squad descontinuado, apagado do Realtime Database — sem overlap
// real com o orquestrador, que só roda em 'dev'/'dados').
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
        // Card homônimo em outro squad com dados DIFERENTES — prova que
        // passar squadId:'dev' não vaza pra nenhum outro squad.
        'outro-squad': {
          dados: {
            cards: { [cardKey]: { ...card, title: 'NÃO deveria ler este card (outro-squad)' } },
            cards_index: { [card.id]: cardKey },
          },
        },
      },
      usuarios_publicos: MEMBERS_SEED['kanban/usuarios_publicos'],
    },
  });
}

test('resolveCardKey com squadId explícito resolve contra o squad certo, não contra outro squad', async () => {
  const db = seedDevSquadDb('9', { id: 'c9', title: 'Card no dev', col: 'progress' });
  const key = await resolveCardKey(db, 'c9', { squadId: 'dev' });
  assert.equal(key, '9');
});

test('buildWritePlan com extra.squadId monta o plano contra o squad certo (comentario)', async () => {
  // card_comments/{cardId} é path próprio por squad desde a migração Fase
  // 1.1 (fora da subárvore do card, ver cardCommentsPath() em board.js) —
  // continua respeitando squadId certinho.
  const db = seedDevSquadDb('9', { id: 'c9', title: 'Card no dev', col: 'progress' });
  const plan = await buildWritePlan('9', [{ type: 'comentario', texto: 'Testando squadId' }], {
    cardId: 'c9',
    squadId: 'dev',
    db,
  });
  assert.equal(plan.length, 1);
  assert.equal(plan[0].path, 'kanban/squads/dev/dados/card_comments/c9');

  await applyWritePlan(db, plan, { cardPath: 'kanban/squads/dev/dados/cards/9', cardId: 'c9', squadId: 'dev' });

  const devComments = db._data().kanban.squads.dev.dados.card_comments?.c9;
  const outroComments = db._data().kanban.squads['outro-squad'].dados.card_comments?.c9;
  assert.equal(Object.keys(devComments || {}).length, 1, 'comentário deveria ter sido escrito no card_comments do squad dev');
  assert.equal(Object.keys(outroComments || {}).length, 0, 'card_comments homônimo em outro squad não deveria ter sido tocado');
});

// Comentário não estampa cards_updated_at desde que virou path próprio
// (fora da subárvore do card, ver sprint3.test.js) — usa editar_campos aqui
// pra testar o que este teste realmente cobre (squadId correto no carimbo),
// já que precisa de um write que ainda toque o card de verdade.
test('applyWritePlan com cardMeta.squadId carimba cards_updated_at do squad certo, não o de outro squad', async () => {
  const db = seedDevSquadDb('9', { id: 'c9', title: 'Card no dev', col: 'progress', desc: 'antiga' });
  const plan = await buildWritePlan('9', [{ type: 'editar_campos', desc: 'nova' }], { cardId: 'c9', squadId: 'dev', db });
  await applyWritePlan(db, plan, { cardPath: 'kanban/squads/dev/dados/cards/9', cardId: 'c9', squadId: 'dev' });

  const devStampNode = cardsUpdatedAtPath('dev').split('/').reduce((cur, seg) => (cur ? cur[seg] : undefined), db._data());
  const outroStampNode = cardsUpdatedAtPath('outro-squad').split('/').reduce((cur, seg) => (cur ? cur[seg] : undefined), db._data());
  assert.ok(devStampNode && devStampNode.c9, 'cards_updated_at do squad dev deveria ter sido carimbado');
  assert.equal(outroStampNode, undefined, 'cards_updated_at de outro squad não deveria ter sido tocado');
});

test('buildWritePlan sem extra.squadId cai no squad default (dev, desde 2026-08-25)', async () => {
  const db = makeFakeDb({
    kanban: { squads: { dev: { dados: { cards: { 5: { id: 'c5', title: 'Card X', col: 'progress' } } } } } },
  });
  const plan = await buildWritePlan('5', [{ type: 'comentario', texto: 'Oi' }], { cardId: 'c5', db });
  assert.equal(plan[0].path, 'kanban/squads/dev/dados/card_comments/c5');
});

test('buildWritePlan com extra.notificar usa o squadId certo no step de notificação (bugfix: antes usava SQUAD_ID fixo)', async () => {
  const db = seedDevSquadDb('9', { id: 'c9', title: 'Card no dev', col: 'progress' });
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
