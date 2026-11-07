const test = require('node:test');
const assert = require('node:assert/strict');

// Expectativas independentes do mapa de implementação.
const duplos = {
  dados_diarios: 'kanban/dados_diarios', campanhas: 'kanban/campanhas', campanhas_log: 'kanban/campanhas_log',
  cal_events: 'kanban/painel/cal_events', grupos_campanha: 'kanban/painel/grupos_campanha', lembretes_gestao: 'kanban/painel/lembretes_gestao',
  gcal_cache: 'kanban/painel/config/gcal_cache', gcal_cache_meta: 'kanban/painel/config/gcal_cache_meta', gcal_dismissed: 'kanban/painel/config/gcal_dismissed', calendars: 'kanban/painel/config/calendars',
  metas_digital: 'kanban/metas_digital', metas_squads: 'kanban/metas_squads', metas_log: 'kanban/metas_log',
  agente_painel: 'kanban/agente_painel', agente_painel_processed: 'kanban/agente_painel_processed',
};
for (const [nome, esperado] of Object.entries(duplos)) {
  test(`nodeFor: ${nome} isola dev e prod`, () => {
    const { nodeFor } = require('../painel/nodeFor');
    assert.equal(nodeFor('prod', nome), esperado);
    assert.equal(nodeFor('dev', nome), esperado + '_dev');
  });
}
const comuns = {
  squads_meta: 'kanban/squads_meta', squad_dados: 'kanban/squads/:squad/dados', squad_cards: 'kanban/squads/:squad/dados/cards',
  squad_columns: 'kanban/squads/:squad/dados/columns', squad_agil_cfg: 'kanban/squads/:squad/dados/agil_cfg',
  squad_blocker_mode: 'kanban/squads/:squad/dados/config/blockerMode', squad_flow_baseline: 'kanban/squads/:squad/dados/flow_baseline',
  squad_alarmes: 'kanban/squads/:squad/dados/cards_incidentes_sumico', guardiao_incidentes: 'kanban/cards_guardiao/:squad/incidentes',
  guardiao_resolvidos: 'kanban/cards_guardiao/:squad/resolvidos', guardiao_status: 'kanban/cards_guardiao/_status',
  github_saude: 'kanban/github_saude', firebase_saude: 'kanban/firebase_saude',
};
for (const [nome, esperado] of Object.entries(comuns)) {
  test(`nodeFor: ${nome} é compartilhado`, () => {
    const { nodeFor } = require('../painel/nodeFor');
    assert.equal(nodeFor('dev', nome), esperado);
    assert.equal(nodeFor('prod', nome), esperado);
  });
}
test('nodeFor recusa ambiente e nome desconhecidos, inclusive propriedades herdadas', () => {
  const { nodeFor } = require('../painel/nodeFor');
  for (const nome of ['inexistente', '../usuarios', 'toString', '__proto__']) assert.throws(() => nodeFor('dev', nome));
  for (const env of ['', undefined, 'staging']) assert.throws(() => nodeFor(env, 'squads_meta'));
});
