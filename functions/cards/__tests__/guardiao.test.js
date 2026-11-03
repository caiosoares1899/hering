// functions/cards/__tests__/guardiao.test.js — o guardião dos cards: espelho, restauração, freios e avisos.
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { espelharCard, verificarRemocao } = require('../guardiao');

const AGORA = new Date('2026-11-03T20:00:00Z');
const SQ = 'midiacriativa';
const B = `kanban/squads/${SQ}/dados`;
const card = (id, extra) => Object.assign({ id, title: 'Card ' + id, col: 'a', history: [{ at: '2026-10-30T18:00:00Z', who: 'Bruna', what: 'criou o card' }] }, extra || {});
const mk = (extra) => {
  const d = { kanban: { squads: { [SQ]: { dados: { cards: { 0: card('c0'), 1: card('c1') }, cards_index: { c0: '0', c1: '1' }, cards_updated_at: { c0: 'x', c1: 'x' } } } },
    usuarios_publicos: { adm1: { role: 'adm' }, po1: { role: 'po', squads: { [SQ]: true } }, poOutro: { role: 'po', squads: { dados: true } }, mem: { role: 'membro', squads: { [SQ]: true } } },
    usuarios: { adm1: {}, po1: {}, poOutro: {}, mem: {} } } };
  return makeFakeDb(Object.assign(d, extra || {}));
};
const dados = (d) => d._data().kanban.squads[SQ].dados;
const rodar = (d, id, o) => verificarRemocao(d, SQ, id, Object.assign({ agora: AGORA, esperar: 0 }, o || {}));
const apagaDoIndice = (d, id) => { delete dados(d).cards_index[id]; };

test('espelho: guarda a versão do card pelo índice; posição que não é dele não espelha', async () => {
  const d = mk();
  assert.equal((await espelharCard(d, SQ, 'c1', AGORA)).espelhado, true);
  assert.equal(d._data().kanban.cards_espelho[SQ].c1.card.title, 'Card c1');
  assert.equal(d._data().kanban.cards_espelho[SQ].c1.em, AGORA.toISOString());
  dados(d).cards_index.cX = '0';                                   // índice aponta pra posição de outro card
  assert.equal((await espelharCard(d, SQ, 'cX', AGORA)).espelhado, false);
  assert.equal((await espelharCard(d, SQ, 'nao_existe', AGORA)).espelhado, false);
});

test('sumiço sem marca de exclusão: restaura do espelho, registra, e avisa ADM e PO da squad (não membro nem PO de outra squad)', async () => {
  const d = mk(); await espelharCard(d, SQ, 'c1', AGORA); apagaDoIndice(d, 'c1'); delete dados(d).cards['1'];
  const r = await rodar(d, 'c1');
  assert.equal(r.acao, 'restaurado');
  const idx = dados(d).cards_index; assert.ok(idx.c1 != null);
  assert.equal(dados(d).cards[idx.c1].title, 'Card c1');
  assert.match(dados(d).cards[idx.c1].history.slice(-1)[0].what, /restaurado automaticamente/);
  assert.equal(dados(d).cards_updated_at.c1, AGORA.toISOString());
  const g = d._data().kanban.cards_guardiao[SQ];
  assert.equal(g.ultimo.acao, 'restaurado'); assert.equal(g.ultimo.titulo, 'Card c1'); assert.equal(Object.keys(g.incidentes).length, 1);
  const n = d._data().kanban.usuarios.adm1.notificacoes; const nid = Object.keys(n)[0];
  assert.equal(n[nid].type, 'card_resgatado'); assert.equal(n[nid].cardId, 'c1'); assert.equal(n[nid].squad, SQ); assert.equal(n[nid].read, false);
  assert.ok(d._data().kanban.usuarios.po1.notificacoes);
  assert.equal(d._data().kanban.usuarios.poOutro.notificacoes, undefined); assert.equal(d._data().kanban.usuarios.mem.notificacoes, undefined);
});

test('restaura numa posição LIVRE: nunca por cima de outro card', async () => {
  const d = mk(); await espelharCard(d, SQ, 'c0', AGORA); apagaDoIndice(d, 'c0');   // a posição 0 ficou sem dono no índice, mas outro card pode ocupar
  dados(d).cards_index.c2 = '0'; dados(d).cards['0'] = card('c2');                   // outro card ocupou a posição 0
  const r = await rodar(d, 'c0'); assert.equal(r.acao, 'restaurado');
  const idx = dados(d).cards_index; assert.notEqual(idx.c0, idx.c2); assert.equal(dados(d).cards[idx.c2].id, 'c2'); assert.equal(dados(d).cards[idx.c0].id, 'c0');
});

test('exclusão de propósito (marca) não é restaurada; card que voltou sozinho também não', async () => {
  const d = mk(); await espelharCard(d, SQ, 'c1', AGORA); apagaDoIndice(d, 'c1'); dados(d).cards_deleted_intentionally = { c1: true };
  assert.equal((await rodar(d, 'c1')).motivo, 'exclusão intencional'); assert.equal(dados(d).cards_index.c1, undefined);
  const d2 = mk(); assert.equal((await rodar(d2, 'c1')).motivo, 'voltou ao índice');
});

test('pausa declarada pelo cliente (restaurar backup/importar): não restaura; vencida, volta a valer', async () => {
  const d = mk(); await espelharCard(d, SQ, 'c1', AGORA); apagaDoIndice(d, 'c1'); dados(d).cards_guardiao_pausa_ate = AGORA.getTime() + 60000;
  assert.match((await rodar(d, 'c1')).motivo, /operação em massa declarada/);
  dados(d).cards_guardiao_pausa_ate = AGORA.getTime() - 1; assert.equal((await rodar(d, 'c1')).acao, 'restaurado');
});

test('índice vazio (squad zerada/apagada): não restaura nada', async () => {
  const d = mk(); await espelharCard(d, SQ, 'c1', AGORA); dados(d).cards_index = {};
  assert.match((await rodar(d, 'c1')).motivo, /índice vazio/);
});

test('sem espelho (card antigo, nunca gravado depois do guardião): não inventa — registra e avisa pra buscar no backup', async () => {
  const d = mk(); apagaDoIndice(d, 'c1');
  const r = await rodar(d, 'c1'); assert.equal(r.acao, 'sem_espelho');
  assert.equal(d._data().kanban.cards_guardiao[SQ].ultimo.acao, 'sem_espelho');
  const n = Object.values(d._data().kanban.usuarios.adm1.notificacoes)[0]; assert.match(n.title, /não deu pra restaurar/);
});

test('em massa (mais de 30 em 2 min sem marca): NÃO restaura sozinho, registra e avisa uma vez só', async () => {
  const idx = {}, cards = {}; for (let i = 0; i < 40; i++) { idx['m' + i] = String(i + 10); cards[i + 10] = card('m' + i); }
  const d = mk(); Object.assign(dados(d).cards_index, idx); Object.assign(dados(d).cards, cards);
  for (let i = 0; i < 40; i++) await espelharCard(d, SQ, 'm' + i, AGORA);
  for (let i = 0; i < 40; i++) apagaDoIndice(d, 'm' + i);
  const acoes = []; for (let i = 0; i < 40; i++) acoes.push((await rodar(d, 'm' + i)).acao);
  assert.equal(acoes.filter((a) => a === 'restaurado').length, 30); assert.equal(acoes.filter((a) => a === 'alerta_em_massa').length, 10);
  assert.equal(Object.keys(d._data().kanban.usuarios.adm1.notificacoes).filter((k) => k.startsWith('crd_massa')).length, 1, 'um alerta só, não 10');
});

test('reincidente: o mesmo card restaurado 2× em 24 h e some de novo → para de restaurar e alerta', async () => {
  const d = mk(); await espelharCard(d, SQ, 'c1', AGORA);
  for (let i = 0; i < 2; i++) { apagaDoIndice(d, 'c1'); assert.equal((await rodar(d, 'c1', { agora: new Date(AGORA.getTime() + i * 3600000) })).acao, 'restaurado'); }
  apagaDoIndice(d, 'c1'); const r = await rodar(d, 'c1', { agora: new Date(AGORA.getTime() + 2 * 3600000) });
  assert.equal(r.acao, 'reincidente'); assert.equal(dados(d).cards_index.c1, undefined);
  assert.equal(d._data().kanban.cards_guardiao[SQ].ultimo.acao, 'reincidente');
});

test('card arquivado restaurado volta marcado como arquivado', async () => {
  const d = mk(); dados(d).cards['1'] = card('c1', { archived: true }); await espelharCard(d, SQ, 'c1', AGORA); apagaDoIndice(d, 'c1');
  assert.equal((await rodar(d, 'c1')).acao, 'restaurado'); assert.equal(dados(d).cards_archived.c1, true);
});
