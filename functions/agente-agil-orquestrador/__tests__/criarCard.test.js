// functions/agente-agil-orquestrador/__tests__/criarCard.test.js
//
// Cobertura do handler real de criar_card (tools/criarCard.js) — NÃO
// escreve em /cards (ver comentário grande no topo do arquivo pro porquê:
// mesmo risco de perda silenciosa documentado em functions/intake/
// submit.js), grava em intake_pending, o mesmo caminho seguro que o
// formulário público de intake já usa. Réplica das mesmas regras
// obrigatórias que o agente client-side já aplica (Ficha Técnica/Submarca).
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { makeRealCriarCardHandler, criarCardSchema } = require('../tools/criarCard');

function seedDb({ criativosAtivo = false, submarcaAtivo = false } = {}) {
  return makeFakeDb({
    kanban: {
      squads: {
        dev: {
          dados: {
            config: { criativos_ativo: criativosAtivo, submarca_ativo: submarcaAtivo },
          },
        },
      },
    },
  });
}

test('criarCardSchema exige titulo', () => {
  assert.equal(criarCardSchema.safeParse({}).success, false);
  assert.equal(criarCardSchema.safeParse({ titulo: 'Card novo' }).success, true);
});

test('dryRun (default): monta o que faria, mas não grava nada em intake_pending', async () => {
  const db = seedDb();
  const handler = makeRealCriarCardHandler({ db, squadId: 'dev' });

  const result = await handler({ titulo: 'Investigar métrica estranha' });

  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  const pending = await db.ref('kanban/squads/dev/dados/intake_pending').get();
  assert.equal(pending.val(), null);
});

test('dryRun:false — grava um rascunho em intake_pending, não em /cards', async () => {
  const db = seedDb();
  const handler = makeRealCriarCardHandler({ db, squadId: 'dev', dryRun: false });

  const result = await handler({ titulo: 'Investigar métrica estranha', descricao: 'veio de um alerta automático' });

  assert.equal(result.ok, true);
  assert.equal(result.dryRun, false);
  assert.ok(result.pendingId);

  const cards = await db.ref('kanban/squads/dev/dados/cards').get();
  assert.equal(cards.val(), null, 'nunca deveria escrever direto em /cards');

  const entry = await db.ref(`kanban/squads/dev/dados/intake_pending/${result.pendingId}`).get();
  assert.equal(entry.val().titulo, 'Investigar métrica estranha');
  assert.equal(entry.val().status, 'pending');
  assert.equal(entry.val().demandante, '🤖 Agente Ágil');
});

test('credita o especialista de origem no campo demandante, quando informado', async () => {
  const db = seedDb();
  const handler = makeRealCriarCardHandler({ db, squadId: 'dev', dryRun: false, especialista: 'databricks' });

  const result = await handler({ titulo: 'Card do especialista' });

  const entry = await db.ref(`kanban/squads/dev/dados/intake_pending/${result.pendingId}`).get();
  assert.equal(entry.val().demandante, '🔌 databricks');
});

test('squad com Ficha Técnica ativa: recusa criar, não grava nada', async () => {
  const db = seedDb({ criativosAtivo: true });
  const handler = makeRealCriarCardHandler({ db, squadId: 'dev', dryRun: false });

  const result = await handler({ titulo: 'Card qualquer' });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'ficha_tecnica_obrigatoria');
  const pending = await db.ref('kanban/squads/dev/dados/intake_pending').get();
  assert.equal(pending.val(), null);
});

test('squad com Submarca ativa e submarca ausente: recusa e lista as opções', async () => {
  const db = seedDb({ submarcaAtivo: true });
  const handler = makeRealCriarCardHandler({ db, squadId: 'dev', dryRun: false });

  const result = await handler({ titulo: 'Card sem submarca' });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'submarca_obrigatoria');
  assert.match(result.message, /Hering Adulto Comercial/);
});

test('squad com Submarca ativa e submarca inválida: recusa', async () => {
  const db = seedDb({ submarcaAtivo: true });
  const handler = makeRealCriarCardHandler({ db, squadId: 'dev', dryRun: false });

  const result = await handler({ titulo: 'Card com submarca errada', submarca: 'Não Existe' });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'submarca_invalida');
});

test('squad com Submarca ativa e submarca válida (case-insensitive): cria o rascunho', async () => {
  const db = seedDb({ submarcaAtivo: true });
  const handler = makeRealCriarCardHandler({ db, squadId: 'dev', dryRun: false });

  const result = await handler({ titulo: 'Card com submarca certa', submarca: 'hering kids comercial' });

  assert.equal(result.ok, true);
  const entry = await db.ref(`kanban/squads/dev/dados/intake_pending/${result.pendingId}`).get();
  assert.equal(entry.val().submarca, 'hering kids comercial');
});

test('checklist (2026-09-01): schema aceita até 20 itens, rejeita 21', () => {
  const ate20 = Array.from({ length: 20 }, (_, i) => 'Item ' + i);
  assert.equal(criarCardSchema.safeParse({ titulo: 'X', checklist: ate20 }).success, true);
  const com21 = [...ate20, 'Item 20'];
  assert.equal(criarCardSchema.safeParse({ titulo: 'X', checklist: com21 }).success, false);
});

test('checklist: gravado no rascunho quando informado', async () => {
  const db = seedDb();
  const handler = makeRealCriarCardHandler({ db, squadId: 'dev', dryRun: false });

  const result = await handler({ titulo: 'Card com processo', checklist: ['Passo 1', 'Passo 2'] });

  assert.equal(result.ok, true);
  const entry = await db.ref(`kanban/squads/dev/dados/intake_pending/${result.pendingId}`).get();
  assert.deepEqual(entry.val().checklist, ['Passo 1', 'Passo 2']);
});

test('checklist: ausente vira array vazio, não undefined (rascunho sempre com o campo presente)', async () => {
  const db = seedDb();
  const handler = makeRealCriarCardHandler({ db, squadId: 'dev', dryRun: false });

  const result = await handler({ titulo: 'Card sem checklist' });

  const entry = await db.ref(`kanban/squads/dev/dados/intake_pending/${result.pendingId}`).get();
  assert.deepEqual(entry.val().checklist, []);
});

test('tags/riscos (2026-09-01): schema aceita até 10 itens cada, rejeita 11', () => {
  const ate10 = Array.from({ length: 10 }, (_, i) => 'Item ' + i);
  assert.equal(criarCardSchema.safeParse({ titulo: 'X', tags: ate10 }).success, true);
  assert.equal(criarCardSchema.safeParse({ titulo: 'X', riscos: ate10 }).success, true);
  const com11 = [...ate10, 'Item 10'];
  assert.equal(criarCardSchema.safeParse({ titulo: 'X', tags: com11 }).success, false);
  assert.equal(criarCardSchema.safeParse({ titulo: 'X', riscos: com11 }).success, false);
});

test('tags/riscos: gravados no rascunho quando informados', async () => {
  const db = seedDb();
  const handler = makeRealCriarCardHandler({ db, squadId: 'dev', dryRun: false });

  const result = await handler({
    titulo: 'Card com tags e riscos',
    tags: ['Urgente', 'Marketing'],
    riscos: ['Prazo apertado'],
  });

  assert.equal(result.ok, true);
  const entry = await db.ref(`kanban/squads/dev/dados/intake_pending/${result.pendingId}`).get();
  assert.deepEqual(entry.val().tags, ['Urgente', 'Marketing']);
  assert.deepEqual(entry.val().riscos, ['Prazo apertado']);
});

test('tags/riscos: ausentes viram array vazio, não undefined', async () => {
  const db = seedDb();
  const handler = makeRealCriarCardHandler({ db, squadId: 'dev', dryRun: false });

  const result = await handler({ titulo: 'Card sem tags nem riscos' });

  const entry = await db.ref(`kanban/squads/dev/dados/intake_pending/${result.pendingId}`).get();
  assert.deepEqual(entry.val().tags, []);
  assert.deepEqual(entry.val().riscos, []);
});
