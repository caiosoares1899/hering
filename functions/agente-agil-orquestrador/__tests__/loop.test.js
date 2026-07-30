// functions/agente-agil-orquestrador/__tests__/loop.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { runLoop } = require('../loop');
const { buildTools } = require('../tools');
const limits = require('../limits');

// Cliente falso: cada chamada a decide() consome a próxima resposta do
// script, na ordem. Zero rede — nenhuma dependência de llmClient.js aqui.
function scriptedLlmClient(script) {
  let calls = 0;
  return {
    calls: () => calls,
    async decide() {
      if (calls >= script.length) {
        throw new Error(`scriptedLlmClient: decide() chamado ${calls + 1} vezes, script só tem ${script.length} respostas.`);
      }
      const response = script[calls];
      calls++;
      return response;
    },
  };
}

test('para naturalmente quando a resposta não traz tool calls (status done)', async () => {
  const llmClient = scriptedLlmClient([{ toolCalls: [], text: 'Tarefa concluída.' }]);
  const result = await runLoop({ llmClient, tools: buildTools(), system: 'sistema', task: 'tarefa', enabled: true });

  assert.equal(result.status, 'done');
  assert.equal(result.finalText, 'Tarefa concluída.');
  assert.deepEqual(result.steps, []);
});

test('encadeia múltiplas ferramentas antes de parar (mover_coluna + checklist_item + comentário)', async () => {
  const llmClient = scriptedLlmClient([
    { toolCalls: [{ id: '1', name: 'mover_coluna', input: { type: 'mover_coluna', coluna: 'em_desenvolvimento' } }], text: null },
    { toolCalls: [{ id: '2', name: 'checklist_item', input: { type: 'checklist_item', item: 'Revisado', done: true } }], text: null },
    { toolCalls: [{ id: '3', name: 'comentario', input: { type: 'comentario', texto: 'Feito.' } }], text: null },
    { toolCalls: [], text: 'Concluído.' },
  ]);
  const result = await runLoop({ llmClient, tools: buildTools(), system: 'sistema', task: 'tarefa', enabled: true });

  assert.equal(result.status, 'done');
  assert.equal(result.finalText, 'Concluído.');
  assert.equal(result.steps.length, 3);
  assert.deepEqual(
    result.steps.map((s) => s.toolCalls[0].name),
    ['mover_coluna', 'checklist_item', 'comentario'],
  );
  result.steps.forEach((s) => assert.equal(s.toolCalls[0].output.simulated, true));
});

test('perguntar_humano encerra o loop com status awaiting_human', async () => {
  const llmClient = scriptedLlmClient([
    { toolCalls: [{ id: '1', name: 'perguntar_humano', input: { pergunta: 'Que prioridade usar?' } }], text: null },
  ]);
  const result = await runLoop({ llmClient, tools: buildTools(), system: 'sistema', task: 'tarefa', enabled: true });

  assert.equal(result.status, 'awaiting_human');
  assert.equal(result.steps.length, 1);
  assert.equal(result.steps[0].toolCalls[0].name, 'perguntar_humano');
});

test('estoura o teto de iterações -> status stopped_max_iterations', async () => {
  const alwaysToolCall = () => ({ toolCalls: [{ id: 'x', name: 'comentario', input: { type: 'comentario', texto: 'de novo' } }], text: null });
  const llmClient = scriptedLlmClient([alwaysToolCall(), alwaysToolCall(), alwaysToolCall()]);
  const result = await runLoop({ llmClient, tools: buildTools(), system: 'sistema', task: 'tarefa', enabled: true, maxIterations: 3 });

  assert.equal(result.status, 'stopped_max_iterations');
  assert.equal(result.steps.length, 3);
  assert.equal(llmClient.calls(), 3);
});

test('kill switch desligado impede o loop de rodar e nunca chama o LLM', async () => {
  const llmClient = scriptedLlmClient([{ toolCalls: [], text: 'não devia chegar aqui' }]);
  const result = await runLoop({ llmClient, tools: buildTools(), system: 'sistema', task: 'tarefa', enabled: false });

  assert.equal(result.status, 'disabled');
  assert.deepEqual(result.steps, []);
  assert.equal(result.finalText, null);
  assert.equal(llmClient.calls(), 0);
});

test('ferramenta desconhecida vinda do modelo não derruba o loop', async () => {
  const llmClient = scriptedLlmClient([
    { toolCalls: [{ id: '1', name: 'ferramenta_que_nao_existe', input: {} }], text: null },
    { toolCalls: [], text: 'ok' },
  ]);
  const result = await runLoop({ llmClient, tools: buildTools(), system: 'sistema', task: 'tarefa', enabled: true });

  assert.equal(result.status, 'done');
  assert.equal(result.finalText, 'ok');
  assert.deepEqual(result.steps[0].toolCalls[0].output, { ok: false, error: 'unknown_tool', tool: 'ferramenta_que_nao_existe' });
});

test('limits.isEnabled() é false por padrão (kill switch de produção)', () => {
  assert.equal(limits.isEnabled(), false);
});

test('a suíte nunca depende do valor real do kill switch de produção', async () => {
  // O switch de produção está desligado (linha acima já comprova isso), mas
  // o teste passa enabled:true explicitamente e o loop roda normalmente —
  // prova que runLoop() nunca lê limits.isEnabled() por conta própria.
  assert.equal(limits.isEnabled(), false);
  const llmClient = scriptedLlmClient([{ toolCalls: [], text: 'rodou mesmo com o switch de produção desligado' }]);
  const result = await runLoop({ llmClient, tools: buildTools(), system: 'sistema', task: 'tarefa', enabled: true });

  assert.equal(result.status, 'done');
  assert.equal(llmClient.calls(), 1);
});

test('buildTools() expõe o vocabulário de outputs do Agente Ágil + perguntar_humano + ler_card', () => {
  const tools = buildTools();
  const names = tools.map((t) => t.name);

  assert.deepEqual(
    names.sort(),
    ['agent_status', 'checklist_item', 'comentario', 'editar_campos', 'ler_card', 'link', 'mover_coluna', 'perguntar_humano', 'relatorio_html'].sort(),
  );
  tools.forEach((t) => {
    assert.equal(t.input_schema.type, 'object');
    assert.equal(typeof t.handler, 'function');
  });
});
