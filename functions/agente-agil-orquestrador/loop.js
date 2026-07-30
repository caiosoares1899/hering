// functions/agente-agil-orquestrador/loop.js
//
// Máquina de estados do orquestrador. Usa o protocolo nativo de tool-use do
// Claude pra decidir quando parar: continua enquanto a resposta do modelo
// trouxer tool calls, para naturalmente (status 'done') quando a resposta for
// só texto. Não existe uma ferramenta finish() customizada — é o próprio
// modelo escolhendo não chamar mais nenhuma ferramenta.
//
// Duas paradas de segurança, distintas do stop natural:
//   'stopped_max_iterations' — estourou o teto de iterações (loop.js nunca lê
//                               o valor de produção escondido; ver limits.js).
//   'disabled'                — kill switch desligado, o loop nem chega a
//                               chamar o LLM.
// E uma terceira parada "de produto", não de segurança: 'awaiting_human',
// quando o modelo chama perguntar_humano — não tem com o que continuar até
// alguém responder, então o loop encerra e devolve a pergunta em steps.
const limits = require('./limits');

function findTool(tools, name) {
  return tools.find((t) => t.name === name) || null;
}

async function runToolCalls(tools, toolCalls) {
  const results = [];
  for (const call of toolCalls) {
    const tool = findTool(tools, call.name);
    let output;
    if (!tool) {
      output = { ok: false, error: 'unknown_tool', tool: call.name };
    } else {
      output = await tool.handler(call.input);
    }
    results.push({ toolCallId: call.id, name: call.name, input: call.input, output });
  }
  return results;
}

async function runLoop({
  llmClient,
  tools,
  system,
  task,
  enabled = limits.isEnabled(),
  maxIterations = limits.MAX_ITERATIONS,
}) {
  if (!enabled) {
    return { status: 'disabled', steps: [], finalText: null };
  }

  const history = [{ role: 'user', text: task }];
  const steps = [];

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    const response = await llmClient.decide({ system, history, tools });

    if (!response.toolCalls || response.toolCalls.length === 0) {
      return { status: 'done', steps, finalText: response.text || null };
    }

    const results = await runToolCalls(tools, response.toolCalls);
    steps.push({ iteration, text: response.text || null, toolCalls: results });

    history.push({ role: 'assistant', text: response.text || null, toolCalls: response.toolCalls });
    history.push({
      role: 'tool_results',
      results: results.map((r) => ({ toolCallId: r.toolCallId, output: r.output })),
    });

    if (results.some((r) => r.name === 'perguntar_humano')) {
      return { status: 'awaiting_human', steps, finalText: null };
    }
  }

  return { status: 'stopped_max_iterations', steps, finalText: null };
}

module.exports = { runLoop };
