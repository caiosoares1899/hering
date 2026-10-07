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
