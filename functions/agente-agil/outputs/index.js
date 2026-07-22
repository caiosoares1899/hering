// functions/agente-agil/outputs/index.js
//
// Registry de outputs suportados + montagem do plano de escrita a partir
// da lista de outputs de uma resposta de especialista. buildWritePlan é
// função pura — testável sem emulador, sem depender do Admin SDK (ver
// index.test.js).

const comentario = require('./comentario');
const link = require('./link');

const REGISTRY = {
  comentario,
  link,
};

function buildWritePlan(outputs, ctx) {
  const plan = [];
  for (const output of outputs) {
    const handler = REGISTRY[output.type];
    if (!handler) {
      throw new Error(`output type "${output.type}" sem handler registrado`);
    }
    plan.push(...handler.plan(output, ctx));
  }
  return plan;
}

module.exports = { REGISTRY, buildWritePlan };
