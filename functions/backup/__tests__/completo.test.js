// functions/backup/__tests__/completo.test.js — backup COMPLETO (completo.js) e plano de restauração (restaurar.js), com fakes de db/bucket.
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { rodarBackup, filtrarNo, filtrarDadosSquad, nosDoModo, NOS_GLOBAIS, PREFIXO } = require('../completo');
const { planoDeRestauracao, args } = require('../restaurar');

function fakeBucket() {
  const arquivos = {};
  return {
    arquivos,
    file: (nome) => ({
      save: async (texto) => { arquivos[nome] = texto; },
      download: async () => [Buffer.from(arquivos[nome])],
    }),
  };
}
const lido = (b, nome) => JSON.parse(b.arquivos[nome]);
const AGORA = new Date('2026-10-18T12:00:00Z');   // domingo
const quieto = { log() {}, error() {} };

const seed = () => ({
  kanban: {
    squads_meta: { gestao: { label: 'Gestão' }, dev: { label: 'Dev' } },
    squads: {
      dados: {
        dados: { cards: { c1: { id: 'c1' } }, card_comments: { c1: { k: { text: 'oi' } } }, config: { flow: { a: 1 } }, access_stats: { x: 1 }, card_locks: { c1: 1 }, _debug_bytes_log: { q: 1 }, intake_pending: { i1: { titulo: 't' } } },
        snapshots: { '2026-10-17': { total: 3 } }, externos: { ext: true }, presence: { u: 1 }, access_log: { z: 1 },
      },
      gestao: { dados: { cards: {} } },
      dev: { dados: { cards: { c: 1 } } },
      prf: {},
    },
    okr: { objetivos: { o1: { titulo: 'x' } }, obj_locks: { o1: { uid: 'u' } } },
    metas_digital: { m1: { titulo: 'Meta' } }, metas_digital_dev: { teste: 1 },
    escala: { '2026-10-19': { dados: { ana: { t: 'trab', p: '12:00-13:00' } } } },
    usuarios: { ana: { role: 'po', squads: { dados: true }, notificacoes: { n1: {} }, fcm_tokens: { t: { token: 'SEGREDO' } }, atalhos_custom: { a: 1 } }, bia: { role: 'membro' } },
    painel: { config: { x: 1 }, okr_presence: { u: 1 }, presence: { u: 1 }, kudos_geral: { k: 1 } },
    spotify_secrets: { a: 'SEGREDO' }, oauth_pending: { b: 'SEGREDO' }, notif_feed: { e: 1 },
    campanhas: { c1: { nome: 'BF' } }, dados_diarios: { '2026-10-17': { v: 1 } },
  },
});

test('semanal: guarda cada squad INTEIRO (comentários, config, intake, snapshots, externos) e os nós globais — sem segredos, tokens, notificações, presença, locks e debug', async () => {
  const b = fakeBucket();
  const m = await rodarBackup({ db: makeFakeDb(seed()), bucket: b, modo: 'semanal', agora: AGORA, log: quieto });
  const base = `${PREFIXO}/semanal/2026-10-18`;
  const sq = lido(b, `${base}/squads/dados.json`);
  assert.deepEqual(sq.dados.card_comments, { c1: { k: { text: 'oi' } } });
  assert.deepEqual(sq.dados.config, { flow: { a: 1 } });
  assert.deepEqual(sq.dados.intake_pending, { i1: { titulo: 't' } });
  assert.deepEqual(sq.snapshots, { '2026-10-17': { total: 3 } });
  assert.deepEqual(sq.externos, { ext: true });
  ['access_stats', 'card_locks', '_debug_bytes_log'].forEach((k) => assert.equal(k in sq.dados, false, k));
  assert.equal('presence' in sq, false); assert.equal('access_log' in sq, false);
  assert.ok(b.arquivos[`${base}/squads/gestao.json`], 'squad criado pelo painel entra');
  assert.equal(b.arquivos[`${base}/squads/dev.json`], undefined, 'squad fictício dev não entra');
  const u = lido(b, `${base}/global/usuarios.json`).dados;
  assert.deepEqual(u.ana, { role: 'po', squads: { dados: true }, atalhos_custom: { a: 1 } });
  assert.equal(JSON.stringify(b.arquivos).includes('SEGREDO'), false, 'nenhum segredo/token em nenhum arquivo');
  assert.equal(b.arquivos[`${base}/global/spotify_secrets.json`], undefined); assert.equal(b.arquivos[`${base}/global/notif_feed.json`], undefined);
  assert.equal(b.arquivos[`${base}/global/metas_digital_dev.json`], undefined, 'nós _dev ficam de fora');
  assert.deepEqual(lido(b, `${base}/global/okr.json`).dados, { objetivos: { o1: { titulo: 'x' } } });
  assert.deepEqual(lido(b, `${base}/global/painel.json`).dados, { config: { x: 1 }, kudos_geral: { k: 1 } });
  assert.ok(lido(b, `${base}/global/campanhas.json`) && lido(b, `${base}/global/dados_diarios.json`), 'volumosos entram no semanal');
  assert.equal(lido(b, `${base}/global/escala.json`).dados['2026-10-19'].dados.ana.p, '12:00-13:00', 'pausas da escala também');
  assert.ok(m.itens.length === 10 && m.erros.length === 0 && m.excluidos.length > 5);
  assert.equal(lido(b, `${base}/manifesto.json`).modo, 'semanal');
  assert.ok(m.vazios.includes('squads/prf'), 'squad sem nada vai pro manifesto como vazio');
});

test('diário: só os nós globais pequenos (sem squads, sem campanhas/dados_diarios/feedback)', async () => {
  const b = fakeBucket();
  await rodarBackup({ db: makeFakeDb(seed()), bucket: b, modo: 'diario', agora: AGORA, log: quieto });
  const base = `${PREFIXO}/diario/2026-10-18`;
  const nomes = Object.keys(b.arquivos).map((n) => n.replace(base + '/', ''));
  assert.ok(nomes.includes('global/okr.json') && nomes.includes('global/escala.json') && nomes.includes('global/usuarios.json') && nomes.includes('manifesto.json'));
  assert.equal(nomes.some((n) => n.startsWith('squads/')), false);
  ['campanhas', 'dados_diarios', 'feedback'].forEach((n) => assert.equal(nomes.includes(`global/${n}.json`), false, n));
});

test('erro num item: salva o resto, registra no manifesto e a execução FALHA (aparece no monitoramento)', async () => {
  const b = fakeBucket(), db = makeFakeDb(seed());
  const ref0 = db.ref;
  db.ref = (p) => (p === 'kanban/okr' ? { get: async () => { throw new Error('boom'); } } : ref0(p));
  await assert.rejects(() => rodarBackup({ db, bucket: b, modo: 'diario', agora: AGORA, log: quieto }), /1 item\(ns\) falharam: global\/okr/);
  const m = lido(b, `${PREFIXO}/diario/2026-10-18/manifesto.json`);
  assert.equal(m.erros.length, 1); assert.ok(b.arquivos[`${PREFIXO}/diario/2026-10-18/global/escala.json`], 'o que deu certo foi salvo');
});

test('filtros puros e escolha de nós por modo', () => {
  assert.deepEqual(filtrarNo('okr', { a: 1, obj_locks: 2 }), { a: 1 });
  assert.deepEqual(filtrarNo('campanhas', { a: 1 }), { a: 1 });
  assert.deepEqual(filtrarDadosSquad({ cards: 1, card_locks: 2 }), { cards: 1 });
  assert.equal(nosDoModo('semanal').length, NOS_GLOBAIS.length);
  assert.ok(nosDoModo('diario').length < NOS_GLOBAIS.length);
  NOS_GLOBAIS.forEach((n) => assert.equal(/_dev$|secret|oauth|presence|notif_feed/.test(n.no) && !['notif_config'].includes(n.no), false, n.no));
});

test('restauração: plano por nó, por pessoa (usuarios) e por squad — sempre update, nunca set', () => {
  assert.deepEqual(planoDeRestauracao({ no: 'okr', arquivo: { dados: { objetivos: { o1: 1 } } } }), [{ path: 'kanban/okr', valor: { objetivos: { o1: 1 } } }]);
  assert.deepEqual(planoDeRestauracao({ no: 'usuarios', arquivo: { dados: { ana: { role: 'po' }, bia: { role: 'membro' } } } }),
    [{ path: 'kanban/usuarios/ana', valor: { role: 'po' } }, { path: 'kanban/usuarios/bia', valor: { role: 'membro' } }]);
  assert.deepEqual(planoDeRestauracao({ squad: 'dados', arquivo: { dados: { cards: 1 }, snapshots: { d: 1 }, externos: null } }),
    [{ path: 'kanban/squads/dados/dados', valor: { cards: 1 } }, { path: 'kanban/squads/dados/snapshots', valor: { d: 1 } }]);
  assert.deepEqual(planoDeRestauracao({ no: 'okr', arquivo: { dados: null } }), []);
  assert.deepEqual(args(['--no', 'okr', '--aplicar', '--data', 'ultimo']), { no: 'okr', aplicar: true, data: 'ultimo' });
});
