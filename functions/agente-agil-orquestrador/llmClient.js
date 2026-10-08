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
// Atualizado em 2026-07-30 pro ID de modelo atual — o valor anterior
// (claude-sonnet-4-5-20250929) era um snapshot antigo, nunca chegou a ser
// exercitado contra a API de verdade (Etapa 1/2 só usaram cliente
// scriptado). Revisar este valor sempre que o próximo passo (LLM real)
// for implementado, caso um modelo mais novo já exista nessa altura.
// 2026-10-08: o Agente Ágil (todos os fluxos passam por escolheClienteParaTarefa → tier 'sonnet') passa pro Sonnet 5.5.
const DEFAULT_MODEL = 'claude-sonnet-5-5';
// Rede de segurança: se a API disser que o id do DEFAULT_MODEL não existe/não está liberado pra esta chave (404, ou 400 falando de "model"),
// repete a chamada UMA vez com o modelo anterior e passa a usá-lo direto neste processo — o agente nunca fica mudo por causa de um id de modelo.
const FALLBACK_MODEL = 'claude-sonnet-5';
const _modelosIndisponiveis = new Set();
function modeloIndisponivel(status, body) { return status === 404 || (status === 400 && /model/i.test(String(body || ''))); }
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
          // Achado real (2026-08-27): nenhum tool_result marcava is_error,
          // mesmo quando o handler devolvia { ok: false, ... } (convenção
          // usada em TODAS as tools que escrevem — realHandlers.js/
          // lerCard.js). O modelo recebia a falha só enterrada dentro do
          // JSON do content, sem o sinal dedicado que a API da Anthropic
          // usa pra tratar aquele resultado como erro de verdade — achado
          // ao vivo: pedido pra adicionar uma tag que não existe no squad
          // falhava certinho (editar_campos lança invalid_output), mas o
          // texto final do agente afirmava "adicionei a tag" mesmo assim.
          ...(r.output && r.output.ok === false ? { is_error: true } : {}),
        })),
      };
    }
    throw new Error(`Turno de histórico desconhecido: ${turn.role}`);
  });
}

function anthropicToolsFromTools(tools) {
  return tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }));
}

// Prompt caching: `system` e `tools` são idênticos em toda chamada de um
// mesmo modo/dryRun (buildTools() só varia por esses dois, não por
// squadId/cardId — ver tools/index.js), e `messages` só CRESCE dentro do
// mesmo loop (loop.js reenvia o histórico acumulado inteiro a cada
// iteração, ver runLoop()). Sem cache_control nenhum, cada iteração paga
// preço cheio pelo prefixo inteiro de novo — medido em produção: um único
// acionamento com 6 iterações chegou a ~50k tokens de entrada cobrados
// sem nenhum desconto. Ordem de renderização da API é tools -> system ->
// messages, então o marcador no último bloco de `system` já cacheia
// tools+system juntos (não precisa de marcador redundante em tools).
//
// TTL de 1h no bloco de system: esse prefixo é o mesmo pra QUALQUER
// tarefa (não só entre iterações do mesmo loop) — vale manter vivo por
// mais tempo pra pegar menções espaçadas ao longo da hora, não só
// iterações consecutivas em segundos. O bloco de messages usa o TTL
// padrão (5min): esse prefixo é específico da tarefa em andamento, não
// faz sentido mantê-lo por 1h.
//
// Mínimo cacheável pro Sonnet 5/Opus 5 é 1024 tokens — system+tools aqui
// somam ~2,5k tokens (medido), então cria cache normalmente. Já pro tier
// 'haiku' (ver escolheClienteParaTarefa.js; Haiku 5.5 desde 2026-10-08 — o mínimo abaixo é o do 4.5, conferir o do 5.5), o mínimo do Haiku 4.5 é
// 4096 tokens — abaixo disso o marcador não quebra nada, só não cria
// cache (comportamento documentado da API: cache_creation_input_tokens
// fica 0, sem erro).
function withSystemCacheControl(system) {
  if (!system) return system;
  return [{ type: 'text', text: system, cache_control: { type: 'ephemeral', ttl: '1h' } }];
}

function withMessagesCacheControl(messages) {
  if (!messages.length) return messages;
  const last = messages[messages.length - 1];
  const content = typeof last.content === 'string'
    ? [{ type: 'text', text: last.content }]
    : last.content.slice();
  if (!content.length) return messages;
  content[content.length - 1] = {
    ...content[content.length - 1],
    cache_control: { type: 'ephemeral' },
  };
  return [...messages.slice(0, -1), { ...last, content }];
}

function createAnthropicLlmClient({ apiKey, model = DEFAULT_MODEL, maxTokens = DEFAULT_MAX_TOKENS, fallbackModel = (model === DEFAULT_MODEL ? FALLBACK_MODEL : null) } = {}) {
  if (!apiKey) throw new Error('createAnthropicLlmClient requer apiKey.');

  return {
    async decide({ system, history, tools }) {
      const chama = (m) => fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: m,
          max_tokens: maxTokens,
          system: withSystemCacheControl(system),
          messages: withMessagesCacheControl(historyToAnthropicMessages(history)),
          tools: anthropicToolsFromTools(tools),
        }),
      });

      const usaFallback = !!fallbackModel && _modelosIndisponiveis.has(model);
      let res = await chama(usaFallback ? fallbackModel : model);

      if (!res.ok && fallbackModel && !usaFallback) {
        const corpo = await res.text().catch(() => '');
        if (modeloIndisponivel(res.status, corpo)) {
          _modelosIndisponiveis.add(model);
          console.warn(`[llmClient] modelo ${model} indisponível (${res.status}) — usando ${fallbackModel}: ${corpo.slice(0, 200)}`);
          res = await chama(fallbackModel);
        } else {
          throw new Error(`Anthropic API respondeu ${res.status}: ${corpo}`);
        }
      }

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

      return { toolCalls, text, stopReason: data.stop_reason, usage: data.usage || null };
    },
  };
}

module.exports = {
  createAnthropicLlmClient,
  historyToAnthropicMessages,
  withSystemCacheControl,
  withMessagesCacheControl,
  DEFAULT_MODEL,
  FALLBACK_MODEL,
  _modelosIndisponiveis,   // exportado só pros testes
};
