// functions/backup/__tests__/vigia.test.js — o vigia dos backups: o que conta como problema, quem é avisado e a regra "no máximo 1 por dia".
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { fakeBucket } = require('./fakeBucket');
const { verificar, rodarVigia } = require('../vigia');

const AGORA = new Date('2026-10-14T12:00:00Z');   // terça, 09:00 em Brasília
const quieto = { log() {}, error() {} };
const man = (o) => JSON.stringify(Object.assign({ erros: [] }, o || {}));
const db = (extra) => makeFakeDb({ kanban: Object.assign({
  squads_meta: {},
  usuarios_publicos: { adm1: { role: 'adm' }, adm2: { role: 'adm' }, po1: { role: 'po' }, mem: { role: 'membro' } },
  usuarios: { adm1: {}, adm2: {}, po1: {} },
}, extra || {}) });
const tudoCerto = () => ({
  'backups-completos/diario/2026-10-14/manifesto.json': man(),
  'backups-completos/semanal/2026-10-11/manifesto.json': man(),
  'backups/dados/2026-10-11.json': '{}', 'backups/prf/2026-10-11.json': '{}', 'backups/midiacriativa/2026-10-11.json': '{}',
});

test('tudo certo: nenhum problema, ninguém é avisado', async () => {
  const d = db(), r = await rodarVigia({ db: d, bucket: fakeBucket(tudoCerto()), agora: AGORA, log: quieto });
  assert.equal(r.ok, true); assert.equal(r.avisados, 0);
  assert.equal(d._data().kanban.usuarios.adm1.notificacoes, undefined);
});

test('o diário de hoje não rodou: problema, e SÓ os ADMs recebem a notificação (tipo backup_falhou, com push)', async () => {
  const arq = tudoCerto(); delete arq['backups-completos/diario/2026-10-14/manifesto.json'];
  const d = db(), r = await rodarVigia({ db: d, bucket: fakeBucket(arq), agora: AGORA, log: quieto });
  assert.equal(r.ok, false); assert.equal(r.problemas[0].codigo, 'diario_ausente'); assert.equal(r.avisados, 2);
  const n = d._data().kanban.usuarios.adm1.notificacoes['backup_2026-10-14'];
  assert.equal(n.type, 'backup_falhou'); assert.match(n.sub, /diário de 2026-10-14 não foi gerado/); assert.equal(n.read, false); assert.equal(typeof n.ts, 'string');
  assert.ok(d._data().kanban.usuarios.adm2.notificacoes['backup_2026-10-14']);
  assert.equal(d._data().kanban.usuarios.po1.notificacoes, undefined, 'PO que não é ADM não é avisado');
});

test('manifesto com erro (diário e semanal) vira problema com o nome dos itens', async () => {
  const arq = tudoCerto();
  arq['backups-completos/diario/2026-10-14/manifesto.json'] = man({ erros: [{ item: 'global/okr', erro: 'x' }] });
  arq['backups-completos/semanal/2026-10-11/manifesto.json'] = man({ erros: [{ item: 'squads/outlet', erro: 'y' }] });
  const { problemas } = await verificar({ db: db(), bucket: fakeBucket(arq), agora: AGORA });
  assert.deepEqual(problemas.map((p) => p.codigo), ['diario_erros', 'semanal_erros']);
  assert.match(problemas[0].texto, /global\/okr/); assert.match(problemas[1].texto, /squads\/outlet/);
});

test('semanal velho (> 8 dias) ou inexistente', async () => {
  const velho = tudoCerto(); delete velho['backups-completos/semanal/2026-10-11/manifesto.json']; velho['backups-completos/semanal/2026-10-04/manifesto.json'] = man();
  assert.deepEqual((await verificar({ db: db(), bucket: fakeBucket(velho), agora: AGORA })).problemas.map((p) => p.codigo), ['semanal_atrasado']);
  const nenhum = tudoCerto(); delete nenhum['backups-completos/semanal/2026-10-11/manifesto.json'];
  assert.deepEqual((await verificar({ db: db(), bucket: fakeBucket(nenhum), agora: AGORA })).problemas.map((p) => p.codigo), ['semanal_ausente']);
});

test('o backup do QUADRO (weeklyBackup) atrasado: lista os squads sem arquivo recente, incluindo os criados pelo painel', async () => {
  const arq = tudoCerto(); delete arq['backups/prf/2026-10-11.json']; arq['backups/midiacriativa/2026-09-20.json'] = '{}'; delete arq['backups/midiacriativa/2026-10-11.json'];
  const { problemas } = await verificar({ db: db({ squads_meta: { outlet: { label: 'Outlet' } } }), bucket: fakeBucket(arq), agora: AGORA });
  assert.equal(problemas.length, 1); assert.equal(problemas[0].codigo, 'quadro_atrasado');
  assert.match(problemas[0].texto, /prf/); assert.match(problemas[0].texto, /midiacriativa/); assert.match(problemas[0].texto, /outlet/); assert.doesNotMatch(problemas[0].texto, /dados/);
});

test('no máximo 1 aviso por dia: reexecutar não duplica nem reabre uma notificação já lida', async () => {
  const arq = tudoCerto(); delete arq['backups-completos/diario/2026-10-14/manifesto.json'];
  const d = db(), b = fakeBucket(arq);
  await rodarVigia({ db: d, bucket: b, agora: AGORA, log: quieto });
  d._data().kanban.usuarios.adm1.notificacoes['backup_2026-10-14'].read = true;       // o ADM já viu
  const r2 = await rodarVigia({ db: d, bucket: b, agora: AGORA, log: quieto });
  assert.equal(r2.avisados, 0);
  assert.equal(d._data().kanban.usuarios.adm1.notificacoes['backup_2026-10-14'].read, true);
  const amanha = await rodarVigia({ db: d, bucket: b, agora: new Date('2026-10-15T12:00:00Z'), log: quieto });
  assert.ok(amanha.problemas.length >= 1, 'no dia seguinte o problema persiste e avisa de novo');
});
