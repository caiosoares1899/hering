// functions/agente-agil/outputs/index.test.js
//
// Testa buildWritePlan como função pura — sem emulador, sem Admin SDK.
// Rodar com: node functions/agente-agil/outputs/index.test.js

const assert = require('node:assert/strict');
const { buildWritePlan } = require('./index');

function fakeCtx() {
  let n = 0;
  return {
    agentUid: 'agente-agil',
    agentName: 'Agente Ágil',
    agentInit: 'AA',
    now: () => '2026-07-22T12:00:00.000Z',
    newId: (prefix) => `${prefix}fixo${n++}`,
  };
}

// comentario -> update numa folha só, em comments/{id}
{
  const ctx = fakeCtx();
  const plan = buildWritePlan([{ type: 'comentario', texto: 'oi' }], ctx);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].kind, 'update');
  assert.equal(plan[0].path, 'comments/agentefixo0');
  assert.equal(plan[0].value.text, 'oi');
  assert.equal(plan[0].value.origemAgente, true);
}

// link -> transaction escopada em links, não pisa em link existente
{
  const ctx = fakeCtx();
  const plan = buildWritePlan([{ type: 'link', url: 'https://x.com/r', titulo: 'Relatório' }], ctx);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].kind, 'transaction');
  assert.equal(plan[0].path, 'links');
  const result = plan[0].apply(undefined);
  assert.equal(result.length, 1);
  assert.equal(result[0].url, 'https://x.com/r');
  const result2 = plan[0].apply(result);
  assert.equal(result2.length, 2);
}

// múltiplos outputs viram múltiplas entradas, na ordem
{
  const ctx = fakeCtx();
  const plan = buildWritePlan(
    [
      { type: 'comentario', texto: 'a' },
      { type: 'link', url: 'https://x.com', titulo: 't' },
    ],
    ctx
  );
  assert.equal(plan.length, 2);
  assert.equal(plan[0].kind, 'update');
  assert.equal(plan[1].kind, 'transaction');
}

// output sem handler registrado -> erro explícito
{
  const ctx = fakeCtx();
  assert.throws(() => buildWritePlan([{ type: 'checklistItem' }], ctx), /sem handler registrado/);
}

console.log('outputs/index.test.js: ok');
