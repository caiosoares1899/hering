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
//
// buildWritePlan() despacha por out.type (união discriminada de
// agente-agil/schema.js) — no caminho de produção (http.js) isso vem de um
// envelope JÁ validado por schema.js (envelope.parse(), que exige "type"
// como campo obrigatório do discriminatedUnion) antes de chegar aqui, então
// nunca falta. Aqui o `input` vem direto do tool_use do Claude, restrito só
// pelo `input_schema` de cada ferramenta (ver tools/index.js) — e o
// protocolo de tool-use da Anthropic devolve só os parâmetros que o
// schema define como propriedades da ferramenta, sem reconstituir o nome
// da própria ferramenta dentro do input. Achado ao rodar o cenário de
// mover_coluna sem ambiguidade com LLM real: o modelo devolveu
// `{coluna: "done"}`, sem "type" nenhum, e buildWritePlan falhou com
// `unknown_output_type` (Output "undefined") em toda tentativa — o
// vocabulário nunca tinha, até então, exercitado com sucesso uma ferramenta
// de risco médio de verdade (só evitada/ambígua nos cenários anteriores).
// `toolName` (o nome da própria ferramenta chamada) já desambigua 100% dos
// casos sozinho — nunca é decidido pelo LLM por tool call, é fixado por
// qual ferramenta o protocolo de tool-use invocou — então reconstituir
// `type` a partir dele aqui, sempre, é seguro mesmo quando o modelo também
// manda o campo (sobrescreve com o mesmo valor, no-op).
const { resolveCardKey, buildWritePlan } = require('../../agente-agil/board');

const DRY_RUN_FIXO = true;

function makeRealHandler(toolName, { db, squadId, cardId }) {
  return async function realHandler(input) {
    const cardKey = await resolveCardKey(db, cardId, { squadId });
    if (!cardKey) return { ok: false, error: 'card_not_found', cardId, squadId };

    const output = { ...input, type: toolName };

    let plan;
    try {
      plan = await buildWritePlan(cardKey, [output], { cardId, squadId, db, dryRun: DRY_RUN_FIXO });
    } catch (err) {
      return { ok: false, error: err.code || 'write_plan_failed', message: err.message };
    }

    return { ok: true, dryRun: true, tool: toolName, plan };
  };
}

module.exports = { makeRealHandler, DRY_RUN_FIXO };
