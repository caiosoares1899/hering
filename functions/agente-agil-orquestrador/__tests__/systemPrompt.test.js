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

// Achado real (2026-08-18): a 1ª @menção real mostrou o modelo respondendo
// só no finalText (nunca chamou comentario) — invisível pra quem perguntou,
// já que finalText só existe no log da Cloud Function. Guarda a instrução
// explícita que fecha essa lacuna (exceção #5 do cabeçalho).
test('SYSTEM_PROMPT_V1 exige que a resposta final sempre seja entregue via comentario', () => {
  assert.match(SYSTEM_PROMPT_V1, /Entrega da resposta/i);
  assert.match(SYSTEM_PROMPT_V1, /sempre precisa ser entregue via comentario/i);
});
