// functions/agente-agil-orquestrador/llmClient.js
//
// Única camada que sabe o formato de mensagens da Anthropic. loop.js só
// conhece o contrato genérico decide({system, history, tools}) -> { toolCalls,
// text, stopReason } — isso é o que permite os testes injetarem um cliente
// 100% falso, sem rede, sem depender de nada daqui.
//
// Usa fetch() global (Node 20 já traz) direto em
// https://api.anthropic.com/v1/messages, em vez do pacote @anthropic-ai/sdk,
// pra não acrescentar dependência nova — functions/package.json hoje só tem
// firebase-admin, firebase-functions, google-auth-library, zod e
// zod-to-json-schema.
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';
const DEFAULT_MAX_TOKENS = 4096;

// Traduz o histórico genérico do loop (ver loop.js) pro formato de
// `messages` da Anthropic. Cada turno do histórico é um dos três:
//   { role: 'user', text }                         -> mensagem de usuário em texto puro
//   { role: 'assistant', text, toolCalls }          -> texto + blocos tool_use
//   { role: 'tool_results', results: [{toolCallId, output}] } -> blocos tool_result (role 'user' na API)
function historyToAnthropicMessages(history) {
  return history.map((turn) => {
    if (turn.role === 'user') {
      return { role: 'user', content: turn.text };
    }
    if (turn.role === 'assistant') {
      const content = [];
      if (turn.text) content.push({ type: 'text', text: turn.text });
      for (const call of turn.toolCalls || []) {
        content.push({ type: 'tool_use', id: call.id, name: call.name, input: call.input });
      }
      return { role: 'assistant', content };
    }
    if (turn.role === 'tool_results') {
      return {
        role: 'user',
        content: turn.results.map((r) => ({
          type: 'tool_result',
          tool_use_id: r.toolCallId,
          content: JSON.stringify(r.output),
        })),
      };
    }
    throw new Error(`Turno de histórico desconhecido: ${turn.role}`);
  });
}

function anthropicToolsFromTools(tools) {
  return tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }));
}

function createAnthropicLlmClient({ apiKey, model = DEFAULT_MODEL, maxTokens = DEFAULT_MAX_TOKENS } = {}) {
  if (!apiKey) throw new Error('createAnthropicLlmClient requer apiKey.');

  return {
    async decide({ system, history, tools }) {
      const res = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          messages: historyToAnthropicMessages(history),
          tools: anthropicToolsFromTools(tools),
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Anthropic API respondeu ${res.status}: ${body}`);
      }

      const data = await res.json();
      const toolCalls = [];
      let text = null;
      for (const block of data.content || []) {
        if (block.type === 'text') text = (text || '') + block.text;
        else if (block.type === 'tool_use') toolCalls.push({ id: block.id, name: block.name, input: block.input });
      }

      return { toolCalls, text, stopReason: data.stop_reason };
    },
  };
}

module.exports = { createAnthropicLlmClient, historyToAnthropicMessages, DEFAULT_MODEL };
