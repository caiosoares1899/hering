// functions/agente-agil-orquestrador/escolheClienteParaTarefa.js
//
// Único lugar que decide QUAL client de LLM uma tarefa do orquestrador
// recebe, ANTES de chamar runLoop() (ver loop.js) — não dentro dele.
// loop.js só conhece o contrato genérico decide({system, history, tools})
// e não deveria saber que tiers de modelo existem, mesmo espírito de
// isolamento já usado pra limits.js (kill switch/iterações) e
// systemPrompt.js (conteúdo de produto).
//
// Esqueleto (decisão explícita, registrada no card de acompanhamento):
// hardcoded pra sempre devolver o tier 'sonnet', sem heurística de
// complexidade nenhuma. Ainda em dryRun/squad de teste — não tem tráfego
// real pra calibrar uma heurística contra, e perguntar pro Haiku "isso é
// simples ou complexo?" antes só adicionaria custo/latência/mais uma fonte
// de erro de julgamento sem base nenhuma pra validar. Quando o roteamento
// de verdade (por complexidade) e o gate de aprovação do ADM pro tier
// 'opus' forem implementados, entram AQUI — nenhum outro arquivo precisa
// mudar pra isso, é só trocar o corpo desta função.
const { createAnthropicLlmClient, DEFAULT_MODEL } = require('./llmClient');

// Tier -> model id da Anthropic. 'haiku'/'opus' já registrados aqui pra
// quando o roteamento de verdade existir, mas nenhum caminho de código
// ainda os seleciona — só 'sonnet' é alcançável hoje.
const MODEL_BY_TIER = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: DEFAULT_MODEL,
  opus: 'claude-opus-5',
};

function escolheClienteParaTarefa({ apiKey } = {}) {
  const tier = 'sonnet'; // hardcoded — ver comentário no topo do arquivo
  const model = MODEL_BY_TIER[tier];
  return {
    tier,
    model,
    llmClient: createAnthropicLlmClient({ apiKey, model }),
  };
}

module.exports = { escolheClienteParaTarefa, MODEL_BY_TIER };
