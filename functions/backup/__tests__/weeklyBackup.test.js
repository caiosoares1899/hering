// functions/backup/__tests__/weeklyBackup.test.js — backup semanal do QUADRO (weeklyBackup.js), com fakes de db/bucket.
// Origem (20/10/2026): o vigia avisou "sem backup do quadro nos últimos 8 dias: outlet-crm, site" — os dois ÚLTIMOS squads da lista. A função tinha 256 MiB / 120 s,
// morria no meio da lista e, como o laço engolia erro, nunca reportava falha. Estes testes travam: todos os squads salvam, falha de um não impede os outros e a
// execução TERMINA COM ERRO (aparece no Cloud Scheduler), e a lista inclui os squads de squads_meta (menos dev/omnichannel).
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { fakeBucket } = require('./fakeBucket');
const { rodarWeeklyBackup, _listActiveSquads } = require('../weeklyBackup');

const quieto = { log() {}, error() {} };
const DIA = '2026-10-25';
const seed = () => ({
  kanban: {
    squads_meta: { app: {}, mktplace: {}, outlet: {}, 'outlet-crm': {}, site: {}, dev: {}, omnichannel: {} },
    squads: {
      dados: { dados: { cards: { a: { id: 'a', title: 'A' }, b: { id: 'b', archived: true } }, columns: [{ id: 'todo', name: 'A Fazer' }, null], tags: [], agil_cfg: { x: 1 } } },
      prf: { dados: { cards: [] } }, midiacriativa: { dados: {} },
      app: { dados: { cards: { x: { id: 'x' } } } }, mktplace: { dados: {} }, outlet: { dados: {} },
      'outlet-crm': { dados: { cards: { y: { id: 'y' }, z: { id: 'z' } }, card_comments: { y: { k: { text: 'oi' } } } } },
      site: { dados: {} },
    },
  },
});

test('lista: fixos + squads_meta, sem os fictícios dev/omnichannel', async () => {
  const lista = await _listActiveSquads(makeFakeDb(seed()));
  assert.deepEqual([...lista].sort(), ['app', 'dados', 'midiacriativa', 'mktplace', 'outlet', 'outlet-crm', 'prf', 'site']);
});

test('salva o backup de TODOS os squads (inclusive os últimos da lista) no formato restaurável', async () => {
  const bucket = fakeBucket();
  const r = await rodarWeeklyBackup({ db: makeFakeDb(seed()), bucket, date: DIA, log: quieto });
  for (const sq of ['dados', 'prf', 'midiacriativa', 'app', 'mktplace', 'outlet', 'outlet-crm', 'site']) {
    assert.ok(bucket.arquivos[`backups/${sq}/${DIA}.json`], `faltou backups/${sq}/${DIA}.json`);
  }
  assert.equal(r.salvos.length, 8);
  assert.equal(r.falhas.length, 0);
  assert.ok(!bucket.arquivos[`backups/dev/${DIA}.json`] && !bucket.arquivos[`backups/omnichannel/${DIA}.json`], 'squads fictícios não ganham backup');
  const p = JSON.parse(bucket.arquivos[`backups/dados/${DIA}.json`]);
  assert.equal(p.version, 'cloud-backup');
  assert.equal(p.squad, 'dados');
  assert.equal(p.board.cards.length, 2);
  assert.deepEqual(p.board.columns.map((c) => c.id), ['todo'], 'entrada nula some (mesma limpeza do client)');
  assert.deepEqual(p.board.agilCfg, { x: 1 });
  assert.equal(JSON.parse(bucket.arquivos[`backups/outlet-crm/${DIA}.json`]).board.cards.length, 2);
});

test('um squad que falha não impede os outros — e a execução termina COM ERRO nomeando quem falhou', async () => {
  const base = makeFakeDb(seed());
  const db = { ref: (p) => (p === 'kanban/squads/outlet/dados' ? { get: async () => { throw new Error('estouro simulado'); } } : base.ref(p)) };
  const bucket = fakeBucket();
  await assert.rejects(() => rodarWeeklyBackup({ db, bucket, date: DIA, log: quieto }), /1 squad\(s\) falharam: outlet/);
  for (const sq of ['dados', 'prf', 'midiacriativa', 'app', 'mktplace', 'outlet-crm', 'site']) {
    assert.ok(bucket.arquivos[`backups/${sq}/${DIA}.json`], `${sq} deveria ter sido salvo mesmo com outro squad falhando`);
  }
  assert.ok(!bucket.arquivos[`backups/outlet/${DIA}.json`]);
});

test('falha de gravação no bucket também reprova a execução', async () => {
  const bucket = fakeBucket();
  const orig = bucket.file;
  bucket.file = (nome) => (nome.includes('/site/') ? { save: async () => { throw new Error('sem permissão'); } } : orig(nome));
  await assert.rejects(() => rodarWeeklyBackup({ db: makeFakeDb(seed()), bucket, date: DIA, log: quieto }), /falharam: site/);
});
