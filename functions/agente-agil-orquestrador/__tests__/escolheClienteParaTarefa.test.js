// functions/agente-agil-orquestrador/__tests__/escolheClienteParaTarefa.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { escolheClienteParaTarefa, MODEL_BY_TIER } = require('../escolheClienteParaTarefa');
const { DEFAULT_MODEL } = require('../llmClient');

// Nenhum teste aqui chama decide()/faz rede — só valida QUE client seria
// montado (tier, model, forma do llmClient), mesmo princípio de
// llmClient.js não ser exercitado pelos testes (ver README).

test('sempre devolve o tier sonnet, sem heurística nenhuma', () => {
  const escolhaAberta = escolheClienteParaTarefa({ apiKey: 'sk-fake' });
  const escolhaEspecifica = escolheClienteParaTarefa({ apiKey: 'sk-fake' });

  assert.equal(escolhaAberta.tier, 'sonnet');
  assert.equal(escolhaEspecifica.tier, 'sonnet');
});

test('tier sonnet resolve pro DEFAULT_MODEL de llmClient.js', () => {
  const { model } = escolheClienteParaTarefa({ apiKey: 'sk-fake' });
  assert.equal(model, DEFAULT_MODEL);
  assert.equal(MODEL_BY_TIER.sonnet, DEFAULT_MODEL);
});

test('devolve um llmClient com decide() (contrato de loop.js)', () => {
  const { llmClient } = escolheClienteParaTarefa({ apiKey: 'sk-fake' });
  assert.equal(typeof llmClient.decide, 'function');
});

test('tiers haiku/opus já registrados no mapa, mesmo não alcançáveis ainda', () => {
  assert.equal(typeof MODEL_BY_TIER.haiku, 'string');
  assert.equal(typeof MODEL_BY_TIER.opus, 'string');
});

test('propaga a validação de apiKey de createAnthropicLlmClient (sem apiKey, lança)', () => {
  assert.throws(() => escolheClienteParaTarefa({}), /apiKey/);
});
