const test = require('node:test');
const assert = require('node:assert/strict');
const { urlDoPush, tagDoPush, SITE_BASE_URL } = require('../pushUrl');

test('card normal continua levando ao kanban com squad+card', () => {
  assert.equal(urlDoPush({ type: 'mention', squad: 'dev', cardId: 'c1' }), SITE_BASE_URL + 'kanban.html?squad=dev&card=c1');
  assert.equal(urlDoPush({ type: 'painel_broadcast' }), SITE_BASE_URL + 'kanban.html');
});
test('okr_mencao leva às Anotações do OKR; okr_agente ao chat; okr_* ao Objetivo', () => {
  assert.equal(urlDoPush({ type: 'okr_mencao' }), SITE_BASE_URL + 'okr.html?okr=notas');
  assert.equal(urlDoPush({ type: 'okr_agente' }), SITE_BASE_URL + 'okr.html?okr=chat');
  assert.equal(urlDoPush({ type: 'okr_prazo', okrObjId: 'o 1' }), SITE_BASE_URL + 'okr.html?okr=o%201');
  assert.equal(urlDoPush({ type: 'okr_editado' }), SITE_BASE_URL + 'okr.html');
});
test('tag: duas menções do OKR seguidas não se substituem; as demais mantêm o comportamento antigo', () => {
  assert.notEqual(tagDoPush({ type: 'okr_mencao' }, 'n1'), tagDoPush({ type: 'okr_mencao' }, 'n2'));
  assert.equal(tagDoPush({ type: 'risk', cardId: 'c9' }, 'n1'), 'risk_c9');
  assert.equal(tagDoPush({}, 'n1'), 'geral_n1');
});
test('tag: tipo SEM card (reunião, feedback, intake, comunicado, Estrela) não se substitui; COM card continua por card', () => {
  for (const type of ['reuniao', 'feedback', 'intake', 'painel_broadcast', 'kudos', 'okr_prazo']) {
    assert.notEqual(tagDoPush({ type }, 'nA'), tagDoPush({ type }, 'nB'), type);
  }
  assert.equal(tagDoPush({ type: 'assigned', cardId: 'c1' }, 'nA'), tagDoPush({ type: 'assigned', cardId: 'c1' }, 'nB'));
  assert.notEqual(tagDoPush({ type: 'assigned', cardId: 'c1' }, 'nA'), tagDoPush({ type: 'assigned', cardId: 'c2' }, 'nA'));
  assert.equal(tagDoPush({ type: 'okr_mencao', cardId: null }, 'n9'), 'okr_mencao_n9');   // OKR: igual ao de antes
});
test('okr_reuniao do calendário abre o evento (id + data da ocorrência), não a home do OKR', () => {
  assert.equal(urlDoPush({ type: 'okr_reuniao', okrEventoId: 'ev1', okrEventoData: '2026-10-15' }), SITE_BASE_URL + 'okr.html?evento=ev1&data=2026-10-15');
  assert.equal(urlDoPush({ type: 'okr_reuniao', okrEventoId: 'a b' }), SITE_BASE_URL + 'okr.html?evento=a%20b');
  assert.equal(urlDoPush({ type: 'okr_reuniao', okrObjId: 'o1' }), SITE_BASE_URL + 'okr.html?okr=o1');   // bloco fixo (legado) segue levando ao Objetivo
});
