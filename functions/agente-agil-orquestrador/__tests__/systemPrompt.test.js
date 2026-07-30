// functions/agente-agil-orquestrador/__tests__/systemPrompt.test.js
//
// Smoke test, não um teste de comportamento — o texto em si foi aprovado
// pelo usuário e é armazenado verbatim (ver systemPrompt.js). Isso só
// garante que uma edição futura não corrompa/esvazie o prompt nem perca
// alguma das 8 ferramentas ou a lógica de risco baixo/médio sem que
// alguém perceba.
const test = require('node:test');
const assert = require('node:assert/strict');

const { SYSTEM_PROMPT_V1 } = require('../systemPrompt');
const { buildTools } = require('../tools');

test('SYSTEM_PROMPT_V1 menciona todas as ferramentas que buildTools() expõe', () => {
  const toolNames = buildTools().map((t) => t.name);
  assert.ok(toolNames.length > 0);
  for (const name of toolNames) {
    assert.ok(SYSTEM_PROMPT_V1.includes(name), `prompt deveria mencionar a ferramenta "${name}"`);
  }
});

test('SYSTEM_PROMPT_V1 documenta a distinção de risco baixo/médio e quando perguntar', () => {
  assert.match(SYSTEM_PROMPT_V1, /baixo risco/i);
  assert.match(SYSTEM_PROMPT_V1, /risco médio/i);
  assert.match(SYSTEM_PROMPT_V1, /perguntar_humano/);
  assert.match(SYSTEM_PROMPT_V1, /pedidos abertos/i);
});

test('SYSTEM_PROMPT_V1 escopa explicitamente pro squad "dev"', () => {
  assert.match(SYSTEM_PROMPT_V1, /squad "dev"/);
});
