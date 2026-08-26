// functions/agente-agil-orquestrador/__tests__/llmClient.test.js
//
// Cobre a introdução de prompt caching em llmClient.js (2026-08-26):
// mock de global.fetch pra inspecionar o body exato que decide() manda
// pra API, sem rede de verdade. Testa os dois helpers exportados
// isoladamente (unidade pura) e o efeito ponta-a-ponta em decide().
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createAnthropicLlmClient,
  withSystemCacheControl,
  withMessagesCacheControl,
} = require('../llmClient');

test('withSystemCacheControl: converte string em bloco com cache_control ttl 1h', () => {
  const result = withSystemCacheControl('prompt de sistema');
  assert.deepEqual(result, [
    { type: 'text', text: 'prompt de sistema', cache_control: { type: 'ephemeral', ttl: '1h' } },
  ]);
});

test('withSystemCacheControl: system vazio/undefined passa direto, sem marcador', () => {
  assert.equal(withSystemCacheControl(''), '');
  assert.equal(withSystemCacheControl(undefined), undefined);
});

test('withMessagesCacheControl: marca só o último bloco da última mensagem (content string)', () => {
  const messages = [
    { role: 'user', content: 'primeira tarefa' },
  ];
  const result = withMessagesCacheControl(messages);
  assert.deepEqual(result, [
    { role: 'user', content: [{ type: 'text', text: 'primeira tarefa', cache_control: { type: 'ephemeral' } }] },
  ]);
});

test('withMessagesCacheControl: histórico com múltiplos turnos só marca o último bloco da última mensagem', () => {
  const messages = [
    { role: 'user', content: 'tarefa' },
    { role: 'assistant', content: [{ type: 'tool_use', id: '1', name: 'ler_card', input: {} }] },
    {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: '1', content: '{}' }],
    },
  ];
  const result = withMessagesCacheControl(messages);

  // Mensagens anteriores à última ficam intocadas (sem cache_control).
  assert.equal(result[0].content, 'tarefa');
  assert.equal(result[1].content[0].cache_control, undefined);

  // Só o último bloco da ÚLTIMA mensagem ganha o marcador.
  const lastContent = result[2].content;
  assert.equal(lastContent.length, 1);
  assert.deepEqual(lastContent[0].cache_control, { type: 'ephemeral' });
  assert.equal(lastContent[0].tool_use_id, '1');
});

test('withMessagesCacheControl: lista vazia não quebra', () => {
  assert.deepEqual(withMessagesCacheControl([]), []);
});

test('decide(): body enviado pra API tem cache_control em system e no último bloco de messages', async () => {
  const capturedBodies = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, opts) => {
    capturedBodies.push(JSON.parse(opts.body));
    return {
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 0, cache_creation_input_tokens: 100 },
      }),
    };
  };

  try {
    const client = createAnthropicLlmClient({ apiKey: 'fake-key' });
    const result = await client.decide({
      system: 'prompt de sistema com instruções',
      history: [{ role: 'user', text: 'faz algo' }],
      tools: [{ name: 'comentario', description: 'comenta', input_schema: { type: 'object' } }],
    });

    assert.equal(capturedBodies.length, 1);
    const body = capturedBodies[0];

    // system virou array de blocos com cache_control ttl 1h.
    assert.deepEqual(body.system, [
      { type: 'text', text: 'prompt de sistema com instruções', cache_control: { type: 'ephemeral', ttl: '1h' } },
    ]);

    // último (e único) turno de messages ganhou cache_control (ttl padrão).
    assert.equal(body.messages.length, 1);
    assert.deepEqual(body.messages[0].content[0].cache_control, { type: 'ephemeral' });

    // tools continuam sem cache_control próprio — o breakpoint de system
    // já cobre tools+system juntos (ordem de renderização da API).
    assert.equal(body.tools[0].cache_control, undefined);

    // usage da resposta agora é repassado pra quem chamou decide().
    assert.deepEqual(result.usage, {
      input_tokens: 10,
      output_tokens: 2,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 100,
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('decide(): resumoMeuDia.js chama com tools:[] — system ainda vira bloco cacheável, sem quebrar', async () => {
  const originalFetch = global.fetch;
  let capturedBody = null;
  global.fetch = async (url, opts) => {
    capturedBody = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ content: [], stop_reason: 'end_turn', usage: {} }) };
  };

  try {
    const client = createAnthropicLlmClient({ apiKey: 'fake-key' });
    await client.decide({ system: 'resumo do dia', history: [{ role: 'user', text: 'resume' }], tools: [] });
    assert.deepEqual(capturedBody.tools, []);
    assert.equal(capturedBody.system[0].cache_control.type, 'ephemeral');
  } finally {
    global.fetch = originalFetch;
  }
});
