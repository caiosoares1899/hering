// functions/cards/__tests__/status.test.js — pulso de saúde do Guardião: atraso do espelho, incidentes em aberto (menos os resolvidos) e o semáforo que o oceanoResumo tira dele.
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { calcularSquad, montarStatus, atualizarStatus, coletarSquad } = require('../status');
const { statusGuardiao } = require('../../oceano/resumo');

const AGORA = Date.parse('2026-11-06T12:00:00Z'), MIN = 60000, H = 3600000;
const iso = (msAtras) => new Date(AGORA - msAtras).toISOString();

test('espelho em dia (mesma versão do card mais novo) → atraso 0, mesmo com card recente', () => {
  const r = calcularSquad({ novoId: 'c1', novoEm: iso(2 * H), espelhoEm: iso(2 * H), incidentes: {}, resolvidos: {} }, AGORA);
  assert.equal(r.atrasoMin, 0);
});
test('card mexido há 30 min e espelho ainda na versão anterior → gatilho suspeito (atraso 30 min); espelho ausente também', () => {
  assert.equal(calcularSquad({ novoId: 'c1', novoEm: iso(30 * MIN), espelhoEm: iso(3 * H), incidentes: {}, resolvidos: {} }, AGORA).atrasoMin, 30);
  assert.equal(calcularSquad({ novoId: 'c1', novoEm: iso(30 * MIN), espelhoEm: null, incidentes: {}, resolvidos: {} }, AGORA).atrasoMin, 30);
});
test('tolerância: card mexido há 2 min ainda não conta; squad parado há mais de 24 h não prova nada', () => {
  assert.equal(calcularSquad({ novoId: 'c1', novoEm: iso(2 * MIN), espelhoEm: null, incidentes: {}, resolvidos: {} }, AGORA).atrasoMin, 0);
  assert.equal(calcularSquad({ novoId: 'c1', novoEm: iso(25 * H), espelhoEm: null, incidentes: {}, resolvidos: {} }, AGORA).atrasoMin, 0);
  assert.equal(calcularSquad({ novoId: null, novoEm: '', espelhoEm: null, incidentes: {}, resolvidos: {} }, AGORA).atrasoMin, 0);
});
test('incidentes em aberto: só os que precisam de gente, dos últimos 7 dias, e não resolvidos', () => {
  const incidentes = { a: { acao: 'sem_espelho', detectadoEm: iso(H) }, b: { acao: 'restaurado', detectadoEm: iso(H) }, c: { acao: 'em_massa', detectadoEm: iso(2 * H) },
    d: { acao: 'reincidente', detectadoEm: iso(8 * 24 * H) }, e: { acao: 'sem_espelho', detectadoEm: iso(3 * H) } };
  assert.equal(calcularSquad({ novoId: null, novoEm: '', espelhoEm: null, incidentes, resolvidos: {} }, AGORA).abertos, 3, 'a, c e e (b foi restaurado; d é velho)');
  assert.equal(calcularSquad({ novoId: null, novoEm: '', espelhoEm: null, incidentes, resolvidos: { a: { por: 'x' }, e: { por: 'x' } } }, AGORA).abertos, 1, 'a e e resolvidos');
});
test('montarStatus soma e pega o pior atraso; ok vira false acima de 5 min', () => {
  const s = montarStatus({ dados: { novoId: 'c', novoEm: iso(30 * MIN), espelhoEm: null, incidentes: { x: { acao: 'sem_espelho', detectadoEm: iso(H) } }, resolvidos: {} }, prf: { novoId: null, novoEm: '', espelhoEm: null, incidentes: {}, resolvidos: {} } }, AGORA);
  assert.equal(s.ok, false); assert.equal(s.atrasoMaxMin, 30); assert.equal(s.abertosTotal, 1); assert.equal(s.ts, new Date(AGORA).toISOString());
  assert.equal(montarStatus({}, AGORA).ok, true);
});
test('atualizarStatus lê o banco (só cards no índice contam), grava em cards_guardiao/_status e não quebra se um squad falhar', async () => {
  const d = makeFakeDb({ kanban: { squads: { dados: { dados: { cards_updated_at: { c1: iso(H), fantasma: iso(10 * MIN) }, cards_index: { c1: '0' } } } },
    cards_espelho: { dados: { c1: { card: { updatedAt: iso(H) } } } }, cards_guardiao: { dados: { incidentes: { k: { acao: 'sem_espelho', detectadoEm: iso(H) } }, resolvidos: {} } } } });
  const s = await atualizarStatus(d, ['dados', 'inexistente'], AGORA);
  assert.equal(s.squads.dados.atrasoMin, 0, 'o card "fantasma" (fora do índice) não gera falso atraso'); assert.equal(s.squads.dados.abertos, 1);
  assert.deepEqual(Object.keys(d._data().kanban.cards_guardiao._status).sort(), ['abertosTotal', 'atrasoMaxMin', 'ok', 'squads', 'ts']);
});
test('statusGuardiao (oceanoResumo): sem nó = desconhecido; pulso velho ou espelho atrasado = atenção; senão ok', () => {
  assert.equal(statusGuardiao(null, AGORA).estado, 'desconhecido');
  assert.equal(statusGuardiao({ ts: iso(10 * MIN), ok: true, atrasoMaxMin: 0, abertosTotal: 0 }, AGORA).estado, 'ok');
  const velho = statusGuardiao({ ts: iso(20 * MIN), ok: true, atrasoMaxMin: 0, abertosTotal: 0 }, AGORA); assert.equal(velho.estado, 'atencao'); assert.match(velho.texto, /sem pulso há 20 min/);
  const atras = statusGuardiao({ ts: iso(MIN), ok: false, atrasoMaxMin: 12, abertosTotal: 0 }, AGORA); assert.equal(atras.estado, 'atencao'); assert.match(atras.texto, /atrasado 12 min/);
  assert.match(statusGuardiao({ ts: iso(MIN), ok: true, atrasoMaxMin: 0, abertosTotal: 2 }, AGORA).texto, /2 incidente/);
});
