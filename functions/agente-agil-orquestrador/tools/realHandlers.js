// functions/agente-agil-orquestrador/tools/realHandlers.js
//
// Etapa 2: chama o MESMO motor de escrita que agente-agil/http.js já usa em
// produção (resolveCardKey -> buildWritePlan -> applyWritePlan), no mesmo
// processo, sem HTTP no meio. squadId/cardId vêm fixos da tarefa que o
// orquestrador está executando (não são decididos pelo LLM por tool call) —
// só o `input` de cada chamada, já validado contra o schema Zod
// correspondente (ver tools/index.js), vem do modelo.
//
// dryRun fica FIXO em true nesta fase — não é parâmetro aceito aqui, de
// propósito, pra não existir nem um jeito acidental de desligar antes do
// caminho de escrita real ser validado ponta a ponta contra o squad 'dev'.
// Reaproveita o mesmo mecanismo que http.js já usa pra dryRun hoje: o plano
// é sempre montado (então dá pra inspecionar o que SERIA escrito), só nunca
// chega a chamar applyWritePlan().
const { resolveCardKey, buildWritePlan } = require('../../agente-agil/board');

const DRY_RUN_FIXO = true;

function makeRealHandler(toolName, { db, squadId, cardId }) {
  return async function realHandler(input) {
    const cardKey = await resolveCardKey(db, cardId, { squadId });
    if (!cardKey) return { ok: false, error: 'card_not_found', cardId, squadId };

    let plan;
    try {
      plan = await buildWritePlan(cardKey, [input], { cardId, squadId, db, dryRun: DRY_RUN_FIXO });
    } catch (err) {
      return { ok: false, error: err.code || 'write_plan_failed', message: err.message };
    }

    return { ok: true, dryRun: true, tool: toolName, plan };
  };
}

module.exports = { makeRealHandler, DRY_RUN_FIXO };
