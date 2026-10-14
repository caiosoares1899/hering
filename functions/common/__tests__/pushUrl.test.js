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
test('escala cadastrada por um gestor abre a Escala na semana cadastrada (okrObjId leva a 1ª data); data inválida é ignorada', () => {
  assert.equal(urlDoPush({ type: 'escala', squad: 'dados', okrObjId: '2026-11-23' }), SITE_BASE_URL + 'escala.html?visao=squad&squad=dados&semana=2026-11-23');
  assert.equal(urlDoPush({ type: 'escala', squad: 'dados', okrObjId: 'xx' }), SITE_BASE_URL + 'escala.html?visao=squad&squad=dados');
  assert.equal(urlDoPush({ type: 'escala' }), SITE_BASE_URL + 'escala.html?visao=squad');
  assert.notEqual(tagDoPush({ type: 'escala' }, 'nA'), tagDoPush({ type: 'escala' }, 'nB'));   // dois cadastros seguidos não se substituem no aparelho
});

test('vtex_monitor_falhou (aviso aos ADMs) abre o Painel; vtex_incidente cai no Maré; github_* abre a aba Status do Painel', () => {
  assert.equal(urlDoPush({ type: 'vtex_monitor_falhou' }), SITE_BASE_URL + 'painel.html');
  assert.equal(urlDoPush({ type: 'vtex_incidente' }), SITE_BASE_URL + 'kanban.html');
  assert.equal(urlDoPush({ type: 'github_incidente' }), SITE_BASE_URL + 'painel.html?tab=status');
  assert.equal(urlDoPush({ type: 'github_monitor_falhou' }), SITE_BASE_URL + 'painel.html?tab=status');
});
