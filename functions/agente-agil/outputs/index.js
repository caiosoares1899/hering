// functions/agente-agil/outputs/index.js
//
// Registry de outputs suportados + montagem do plano de escrita a partir
// da lista de outputs de uma resposta de especialista. buildWritePlan é
// async porque relatorio_html precisa fazer upload pro Storage antes de
// saber a URL final — comentario/link continuam síncronos por baixo
// (await em valor não-Promise só resolve na hora), então isso não muda
// nada pra eles. A parte de comentario/link é testável sem emulador
// mesmo assim (ver index.test.js); só relatorio_html precisa de I/O real
// pra parte de upload (testada separadamente, só a extração pura, em
// relatorioHtml.test.js).

const comentario = require('./comentario');
const link = require('./link');
const relatorioHtml = require('./relatorioHtml');

const REGISTRY = {
  comentario,
  link,
  relatorio_html: relatorioHtml,
};

async function buildWritePlan(outputs, ctx) {
  const plan = [];
  for (const output of outputs) {
    const handler = REGISTRY[output.type];
    if (!handler) {
      const err = new Error(`output type "${output.type}" sem handler registrado`);
      err.code = 'unknown_output_type';
      throw err;
    }
    const entries = await handler.plan(output, ctx);
    plan.push(...entries);
  }
  return plan;
}

module.exports = { REGISTRY, buildWritePlan };
