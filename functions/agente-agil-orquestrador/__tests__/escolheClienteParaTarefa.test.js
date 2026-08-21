// functions/agente-agil-orquestrador/__tests__/escolheClienteParaTarefa.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { escolheClienteParaTarefa, classificaComplexidade, MODEL_BY_TIER } = require('../escolheClienteParaTarefa');
const { DEFAULT_MODEL } = require('../llmClient');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');

// Nenhum teste aqui chama decide()/faz rede — só valida a escolha de tier
// e a forma do client montado, mesmo princípio de llmClient.js não ser
// exercitado pelos testes (ver README).

test('sem override e sem taskText reconhecível: default seguro é sonnet', async () => {
  const escolha = await escolheClienteParaTarefa({ apiKey: 'sk-fake' });
  assert.equal(escolha.tier, 'sonnet');
});

test('tier sonnet resolve pro DEFAULT_MODEL de llmClient.js', async () => {
  const { model } = await escolheClienteParaTarefa({ apiKey: 'sk-fake' });
  assert.equal(model, DEFAULT_MODEL);
  assert.equal(MODEL_BY_TIER.sonnet, DEFAULT_MODEL);
});

test('devolve um llmClient com decide() (contrato de loop.js)', async () => {
  const { llmClient } = await escolheClienteParaTarefa({ apiKey: 'sk-fake' });
  assert.equal(typeof llmClient.decide, 'function');
});

test('tiers haiku/opus registrados no mapa', () => {
  assert.equal(typeof MODEL_BY_TIER.haiku, 'string');
  assert.equal(typeof MODEL_BY_TIER.opus, 'string');
});

test('propaga a validação de apiKey de createAnthropicLlmClient (sem apiKey, lança)', async () => {
  await assert.rejects(() => escolheClienteParaTarefa({}), /apiKey/);
});

// ── classificaComplexidade() — heurística pura, sem rede ────────────────

test('classificaComplexidade: pergunta conceitual curta -> haiku', () => {
  assert.equal(classificaComplexidade('@Agente Ágil me explica o conceito de sprint'), 'haiku');
  assert.equal(classificaComplexidade('@Agente Ágil como usar cards recorrentes'), 'haiku');
  assert.equal(classificaComplexidade('@Agente Ágil o que é WIP?'), 'haiku');
  assert.equal(classificaComplexidade('@Agente Ágil por que existe o campo Demandante?'), 'haiku');
});

test('classificaComplexidade: acento/maiúscula não importam (mesma normalização de detectaMencao.js)', () => {
  assert.equal(classificaComplexidade('@agente agil COMO FUNCIONA a recorrencia'), 'haiku');
  assert.equal(classificaComplexidade('@Agente Ágil qual a diferença entre Supercard e Dependências?'), 'haiku');
});

test('classificaComplexidade: pedido de ação no board -> sonnet, mesmo sendo curto', () => {
  assert.equal(classificaComplexidade('@Agente Ágil move esse card pra Concluído'), 'sonnet');
  assert.equal(classificaComplexidade('@Agente Ágil marca a prioridade como crítica'), 'sonnet');
  assert.equal(classificaComplexidade('@Agente Ágil cria um card de bug no backlog'), 'sonnet');
});

test('classificaComplexidade: pergunta longa/composta demais -> sonnet, mesmo começando com marcador', () => {
  const longa = '@Agente Ágil como funciona a recorrência quando o card já passou do prazo, ele recria na mesma coluna ou volta pro backlog, e o que acontece com o checklist nesse caso?';
  assert.equal(classificaComplexidade(longa), 'sonnet');
});

test('classificaComplexidade: texto vazio/só a menção -> sonnet (nunca haiku por ausência de dado)', () => {
  assert.equal(classificaComplexidade(''), 'sonnet');
  assert.equal(classificaComplexidade(null), 'sonnet');
  assert.equal(classificaComplexidade('@Agente Ágil'), 'sonnet');
});

test('classificaComplexidade nunca devolve opus — só o override manual alcança esse tier', () => {
  const textos = [
    'me explica o conceito de sprint',
    'move esse card',
    '',
    'um texto qualquer bem longo '.repeat(10),
  ];
  for (const t of textos) assert.notEqual(classificaComplexidade(t), 'opus');
});

// ── Override manual do ADM (model_tier_override) ─────────────────────────

test('override válido no Firebase vence a heurística, inclusive pra opus', async () => {
  const db = makeFakeDb({ kanban: { config: { agente_agil_orquestrador: { model_tier_override: 'opus' } } } });
  const { tier } = await escolheClienteParaTarefa({ apiKey: 'sk-fake', taskText: 'me explica o conceito de sprint', db });
  assert.equal(tier, 'opus');
});

test('override força até pra baixo (heurística mandaria sonnet, override manda haiku)', async () => {
  const db = makeFakeDb({ kanban: { config: { agente_agil_orquestrador: { model_tier_override: 'haiku' } } } });
  const { tier } = await escolheClienteParaTarefa({ apiKey: 'sk-fake', taskText: 'move esse card pra Concluído', db });
  assert.equal(tier, 'haiku');
});

test('override ausente (nó nunca criado) cai na heurística normal, sem erro', async () => {
  const db = makeFakeDb({});
  const { tier } = await escolheClienteParaTarefa({ apiKey: 'sk-fake', taskText: 'me explica o conceito de sprint', db });
  assert.equal(tier, 'haiku');
});

test('override com valor malformado (fora de haiku/sonnet/opus) é ignorado — fail-safe, mesmo espírito de limits.isEnabled()', async () => {
  const db = makeFakeDb({ kanban: { config: { agente_agil_orquestrador: { model_tier_override: 'gpt-5' } } } });
  const { tier } = await escolheClienteParaTarefa({ apiKey: 'sk-fake', taskText: 'move esse card', db });
  assert.equal(tier, 'sonnet');
});

test('sem db: ignora override (não quebra), cai na heurística normal', async () => {
  const { tier } = await escolheClienteParaTarefa({ apiKey: 'sk-fake', taskText: 'me explica o conceito de sprint' });
  assert.equal(tier, 'haiku');
});

test('db.ref().get() lançando erro: ignora override silenciosamente, cai na heurística (fail-safe)', async () => {
  const dbQuebrado = { ref: () => ({ get: async () => { throw new Error('boom'); } }) };
  const { tier } = await escolheClienteParaTarefa({ apiKey: 'sk-fake', taskText: 'move esse card', db: dbQuebrado });
  assert.equal(tier, 'sonnet');
});
