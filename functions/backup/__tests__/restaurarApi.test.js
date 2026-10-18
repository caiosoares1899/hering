// functions/backup/__tests__/restaurarApi.test.js — API da tela "🛟 Backup completo" (permissão, listar, comparar, restaurar SÓ o que sumiu) + núcleo puro.
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { fakeBucket } = require('./fakeBucket');
const { processar, ErroApi } = require('../restaurarApi');
const { faltantes, compararAreas, marcadoresDeMencao, AREAS_IDS } = require('../restaurarCore');
const { mencionaAgente } = require('../../agente-agil-orquestrador/detectaMencao');

const AGORA = new Date('2026-10-14T12:00:00Z');
const G = (uid, email, prov, verificado) => ({ uid, email, email_verified: verificado === undefined ? true : verificado, firebase: { sign_in_provider: prov || 'google.com' } });
const ADM = G('adm', 'adm@ciahering.com.br'), PO = G('po', 'po@ciahering.com.br'), MEM = G('mem', 'mem@ciahering.com.br'), PO_OUTRO = G('poo', 'poo@ciahering.com.br');

const noBackup = () => ({
  card_comments: { c1: { k1: { text: 'oi', uid: 'u' }, k2: { text: 'oi @Agente Ágil resume', uid: 'u' }, k3: { text: 'terceiro', uid: 'u' } }, c2: { k9: { text: 'de outro card' } } },
  config: { flow: { wip: 3, modo: 'antigo' }, raias: { a: 1 }, criativos_listas: { x: [1] } },
  intake_pending: { i1: { titulo: 'pedido 1' }, i2: { titulo: 'pedido 2' } },
  subtimes: [{ id: 's1', name: 'Designers' }, { id: 's2', name: 'Redatores' }],
  kudos: { a: { de: 'x' } },
  cards: { c1: { id: 'c1' } },
});
// O fake de db do agente só mescla o 1º nível no update(); o RTDB de verdade trata chaves com "/" como caminhos (multi-path). Este wrapper faz igual.
function multi(db) {
  const ref0 = db.ref;
  db.ref = (p) => { const r = ref0(p); const upd = r.update; r.update = async (patch) => { for (const k of Object.keys(patch)) await ref0(`${p}/${k}`).set(patch[k]); return upd && undefined; }; return r; };
  return db;
}
const seed = () => multi(makeFakeDb({ kanban: {
  config: { adm_emails: ['adm@ciahering.com.br'] },
  usuarios: {
    adm: { role: 'adm', nome: 'Ana ADM' }, po: { role: 'po', nome: 'Paulo PO', squads: { dados: true }, squads_roles: { dados: 'po' } },
    mem: { role: 'membro', squads: { dados: true } }, poo: { role: 'po', squads: { prf: true }, squads_roles: { prf: 'po' } },
  },
  squads: { dados: { dados: {
    // hoje: perdeu k2 e k3 do c1 (mas o c1 existe), perdeu o c2 inteiro, perdeu i2, perdeu s2 e o kudos; a config mudou (wip=5) e perdeu `raias`
    card_comments: { c1: { k1: { text: 'oi', uid: 'u' } } },
    config: { flow: { wip: 5 }, criativos_listas: { x: [1] } },
    intake_pending: { i1: { titulo: 'pedido 1 EDITADO' } },
    subtimes: [{ id: 's1', name: 'Designers' }],
    agente_agil_mencao_processed: {},
  } } },
} }));
const bucket = () => fakeBucket({
  'backups-completos/semanal/2026-10-11/squads/dados.json': JSON.stringify({ squad: 'dados', exportadoEm: '2026-10-11T07:30:00.000Z', dados: noBackup(), snapshots: {}, externos: {} }),
  'backups-completos/semanal/2026-10-04/squads/dados.json': '{"dados":{}}',
  'backups-completos/semanal/2026-10-11/squads/prf.json': '{"dados":{}}',
  'backups-completos/diario/2026-10-12/manifesto.json': '{}',
});
const chama = (decoded, corpo, d, b) => processar({ db: d || seed(), bucket: b || bucket(), decoded, corpo, agora: AGORA });
const nega = async (decoded, corpo, status) => { await assert.rejects(() => chama(decoded, corpo), (e) => e instanceof ErroApi && e.status === status); };

test('permissão: ADM, PO e Organizador do squad passam; membro, PO de OUTRO squad, e-mail de fora e login que não é Google, não', async () => {
  await chama(ADM, { acao: 'listar', squad: 'dados' }); await chama(PO, { acao: 'listar', squad: 'dados' });
  await nega(MEM, { acao: 'listar', squad: 'dados' }, 403);
  await nega(PO_OUTRO, { acao: 'listar', squad: 'dados' }, 403);
  await nega(G('x', 'x@gmail.com'), { acao: 'listar', squad: 'dados' }, 403);
  await nega(G('adm', 'adm@ciahering.com.br', 'password'), { acao: 'listar', squad: 'dados' }, 403);
  await nega(G('adm', 'adm@ciahering.com.br', 'google.com', false), { acao: 'listar', squad: 'dados' }, 403);   // e-mail não verificado (auditoria de 18/10/2026)
  const d = seed(); d._data().kanban.usuarios.org = { role: 'membro', squads: { dados: true }, squads_roles: { dados: 'organizador' } };
  await chama(G('org', 'org@ciahering.com.br'), { acao: 'listar', squad: 'dados' }, d);
});

test('entradas inválidas: squad, data, área e backup inexistente', async () => {
  await nega(ADM, { acao: 'listar', squad: '../x' }, 400);
  await nega(ADM, { acao: 'comparar', squad: 'dados', data: 'ontem' }, 400);
  await nega(ADM, { acao: 'comparar', squad: 'dados', data: '2026-01-01' }, 404);
  await nega(ADM, { acao: 'restaurar', squad: 'dados', data: '2026-10-11', areas: ['cards'] }, 400);
  await nega(ADM, { acao: 'restaurar', squad: 'dados', data: '2026-10-11', areas: [] }, 400);
  await nega(ADM, { acao: 'apagar', squad: 'dados', data: '2026-10-11' }, 400);
});

test('listar: só os backups semanais que têm o squad, do mais novo pro mais velho', async () => {
  const r = await chama(PO, { acao: 'listar', squad: 'dados' });
  assert.deepEqual(r.backups.map((b) => b.data), ['2026-10-11', '2026-10-04']);
});

test('comparar: conta o que sumiu por área, sem gravar nada', async () => {
  const d = seed(), antes = JSON.stringify(d._data());
  const r = await chama(PO, { acao: 'comparar', squad: 'dados', data: '2026-10-11' }, d);
  const por = Object.fromEntries(r.areas.map((a) => [a.id, a]));
  assert.equal(por.card_comments.faltando, 3, 'k2, k3 do c1 e o c2 inteiro'); assert.deepEqual(por.card_comments.exemplos.sort(), ['c1/k2', 'c1/k3', 'c2']);
  assert.equal(por.config.faltando, 2, '`flow/modo` e `raias` sumiram — flow.wip mudou mas EXISTE, então não conta'); assert.deepEqual(por.config.exemplos.sort(), ['flow/modo', 'raias']);
  assert.equal(por.intake_pending.faltando, 1); assert.equal(por.subtimes.faltando, 1); assert.equal(por.kudos.faltando, 1);
  assert.equal(r.exportadoEm, '2026-10-11T07:30:00.000Z');
  assert.equal(JSON.stringify(d._data()), antes, 'comparar não grava nada');
});

test('restaurar: traz SÓ o que sumiu, nunca sobrescreve o que existe, e deixa registro + lista pra desfazer', async () => {
  const d = seed(), b = bucket();
  const r = await chama(PO, { acao: 'restaurar', squad: 'dados', data: '2026-10-11', areas: ['card_comments', 'config', 'intake_pending', 'subtimes', 'kudos'] }, d, b);
  assert.deepEqual(r.restaurados, { card_comments: 3, config: 2, intake_pending: 1, subtimes: 1, kudos: 1 });
  const dd = d._data().kanban.squads.dados.dados;
  assert.deepEqual(Object.keys(dd.card_comments.c1).sort(), ['k1', 'k2', 'k3']); assert.equal(dd.card_comments.c2.k9.text, 'de outro card');
  assert.equal(dd.config.flow.wip, 5, 'o valor ATUAL (5) vence o do backup (3)'); assert.equal(dd.config.flow.modo, 'antigo'); assert.deepEqual(dd.config.raias, { a: 1 });
  assert.equal(dd.intake_pending.i1.titulo, 'pedido 1 EDITADO', 'pedido que existe não é tocado'); assert.equal(dd.intake_pending.i2.titulo, 'pedido 2');
  assert.deepEqual(dd.subtimes.map((s) => s.id), ['s1', 's2']); assert.deepEqual(dd.kudos, { a: { de: 'x' } });
  assert.equal(dd.cards, undefined, 'o quadro nunca é restaurado por aqui');
  const reg = Object.values(dd.backup_restauracoes)[0];
  assert.equal(reg.por, 'Paulo PO'); assert.equal(reg.backup, '2026-10-11'); assert.equal(reg.itens, r.total);
  const undo = JSON.parse(b.arquivos[r.desfazer]);
  assert.ok(undo.criados.includes('card_comments/c1/k2') && undo.criados.includes('config/raias') && undo.criados.includes('subtimes/1'));
  const de_novo = await chama(PO, { acao: 'restaurar', squad: 'dados', data: '2026-10-11', areas: ['card_comments', 'config'] }, d, b);
  assert.equal(de_novo.total, 0, 'rodar de novo não faz nada');
});

test('restaurar só as áreas escolhidas', async () => {
  const d = seed();
  await chama(ADM, { acao: 'restaurar', squad: 'dados', data: '2026-10-11', areas: ['kudos'] }, d);
  const dd = d._data().kanban.squads.dados.dados;
  assert.deepEqual(dd.kudos, { a: { de: 'x' } }); assert.equal(dd.card_comments.c2, undefined); assert.equal(dd.config.raias, undefined);
});

test('comentário que menciona o Agente Ágil volta COM o marcador de "já processado" (senão o gatilho do agente responderia de novo)', async () => {
  const d = seed();
  await chama(PO, { acao: 'restaurar', squad: 'dados', data: '2026-10-11', areas: ['card_comments'] }, d);
  const dd = d._data().kanban.squads.dados.dados;
  assert.ok(dd.agente_agil_mencao_processed.k2 && dd.agente_agil_mencao_processed.k2.restaurado === true, 'k2 menciona o agente');
  assert.equal(dd.agente_agil_mencao_processed.k3, undefined, 'k3 não menciona: sem marcador');
  const d2 = seed(); d2._data().kanban.squads.dados.dados.agente_agil_mencao_processed = { k2: { at: 'antes', status: 'ok' } };
  await chama(PO, { acao: 'restaurar', squad: 'dados', data: '2026-10-11', areas: ['card_comments'] }, d2);
  assert.equal(d2._data().kanban.squads.dados.dados.agente_agil_mencao_processed.k2.at, 'antes', 'registro que já existia não é sobrescrito');
});

test('núcleo: faltantes por objeto, por array com id, e valores que existem (mesmo diferentes) ficam', () => {
  assert.deepEqual(faltantes({ a: 1 }, { a: 2, b: { c: 1 } }), [{ path: 'b', valor: { c: 1 } }]);
  assert.deepEqual(faltantes(null, { a: 1 }), [{ path: '', valor: { a: 1 } }]);
  assert.deepEqual(faltantes({ x: { y: 1 } }, { x: { y: 9, z: 2 } }), [{ path: 'x/z', valor: 2 }]);
  assert.deepEqual(faltantes([{ id: 'a' }], [{ id: 'a', n: 2 }, { id: 'b' }]), [{ path: '1', valor: { id: 'b' } }]);
  assert.deepEqual(faltantes([1, 2], [1, 2, 3]), [], 'array sem id: não mexe');
  assert.deepEqual(faltantes('texto', { a: 1 }), []);
  assert.equal(compararAreas({}, {}).length, AREAS_IDS.length);
  assert.deepEqual(marcadoresDeMencao([{ path: 'c1', valor: { k1: { text: '@agente agil oi' }, k2: { text: 'x' } } }], {}, mencionaAgente, 'T'), { 'agente_agil_mencao_processed/k1': { at: 'T', restaurado: true } });
});
