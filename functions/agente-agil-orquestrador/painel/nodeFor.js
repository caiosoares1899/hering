// Catálogo fechado. :squad só é substituído após validar a lista de squads.
const NODES = Object.freeze({
  squads_meta: ['kanban/squads_meta'],
  squad_dados: ['kanban/squads/:squad/dados'],
  squad_cards: ['kanban/squads/:squad/dados/cards'],
  squad_columns: ['kanban/squads/:squad/dados/columns'],
  squad_agil_cfg: ['kanban/squads/:squad/dados/agil_cfg'],
  squad_blocker_mode: ['kanban/squads/:squad/dados/config/blockerMode'],
  squad_flow_baseline: ['kanban/squads/:squad/dados/flow_baseline'],
  squad_alarmes: ['kanban/squads/:squad/dados/cards_incidentes_sumico'],
  guardiao_incidentes: ['kanban/cards_guardiao/:squad/incidentes'],
  guardiao_resolvidos: ['kanban/cards_guardiao/:squad/resolvidos'],
  guardiao_status: ['kanban/cards_guardiao/_status'],
  github_saude: ['kanban/github_saude'],
  firebase_saude: ['kanban/firebase_saude'],
  dados_diarios: ['kanban/dados_diarios', 'kanban/dados_diarios_dev'],
  campanhas: ['kanban/campanhas', 'kanban/campanhas_dev'],
  campanhas_log: ['kanban/campanhas_log', 'kanban/campanhas_log_dev'],
  cal_events: ['kanban/painel/cal_events', 'kanban/painel/cal_events_dev'],
  grupos_campanha: ['kanban/painel/grupos_campanha', 'kanban/painel/grupos_campanha_dev'],
  lembretes_gestao: ['kanban/painel/lembretes_gestao', 'kanban/painel/lembretes_gestao_dev'],
  gcal_cache: ['kanban/painel/config/gcal_cache', 'kanban/painel/config/gcal_cache_dev'],
  gcal_cache_meta: ['kanban/painel/config/gcal_cache_meta', 'kanban/painel/config/gcal_cache_meta_dev'],
  gcal_dismissed: ['kanban/painel/config/gcal_dismissed', 'kanban/painel/config/gcal_dismissed_dev'],
  calendars: ['kanban/painel/config/calendars', 'kanban/painel/config/calendars_dev'],
  metas_digital: ['kanban/metas_digital', 'kanban/metas_digital_dev'],
  metas_squads: ['kanban/metas_squads', 'kanban/metas_squads_dev'],
  metas_log: ['kanban/metas_log', 'kanban/metas_log_dev'],
  agente_painel: ['kanban/agente_painel', 'kanban/agente_painel_dev'],
  agente_painel_processed: ['kanban/agente_painel_processed', 'kanban/agente_painel_processed_dev'],
});

function nodeFor(env, nome) {
  if (env !== 'prod' && env !== 'dev') throw new Error('Ambiente inválido');
  if (!Object.hasOwn(NODES, nome)) throw new Error('Nó desconhecido');
  const paths = NODES[nome];
  return env === 'dev' && paths[1] ? paths[1] : paths[0];
}

module.exports = { nodeFor };
