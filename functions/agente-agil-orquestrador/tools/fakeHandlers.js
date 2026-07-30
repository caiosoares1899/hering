// functions/agente-agil-orquestrador/tools/fakeHandlers.js
//
// Etapa 1: nenhuma ferramenta escreve no RTDB de verdade ainda. Cada handler
// só confirma que recebeu o input (já validado contra o schema Zod
// correspondente antes de chegar aqui, ver tools/index.js) e devolve o que
// teria feito. Quando a Etapa 3 plugar buildWritePlan()/applyWritePlan() de
// agente-agil/board.js, a troca é só substituir o handler — o nome e o
// schema da ferramenta continuam os mesmos.
function makeHandler(toolName) {
  return async function fakeHandler(input) {
    return { ok: true, simulated: true, tool: toolName, wouldHaveExecuted: input };
  };
}

module.exports = { makeHandler };
