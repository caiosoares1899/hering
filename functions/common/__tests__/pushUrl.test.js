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
  assert.equal(tagDoPush({}, 'n1'), 'geral_');
});
test('okr_reuniao do calendário abre o evento (id + data da ocorrência), não a home do OKR', () => {
  assert.equal(urlDoPush({ type: 'okr_reuniao', okrEventoId: 'ev1', okrEventoData: '2026-10-15' }), SITE_BASE_URL + 'okr.html?evento=ev1&data=2026-10-15');
  assert.equal(urlDoPush({ type: 'okr_reuniao', okrEventoId: 'a b' }), SITE_BASE_URL + 'okr.html?evento=a%20b');
  assert.equal(urlDoPush({ type: 'okr_reuniao', okrObjId: 'o1' }), SITE_BASE_URL + 'okr.html?okr=o1');   // bloco fixo (legado) segue levando ao Objetivo
});
