// functions/agente-agil/outputs/comentario.js
//
// Traduz um output {type:'comentario', texto} num plano de escrita.
// comments é um OBJETO chaveado por id em /cards/{chave}/comments (não
// array) — sem risco de posição, então é um update() de folha só.

function plan(output, ctx) {
  const commentId = ctx.newId('agente');
  const comment = {
    id: commentId,
    uid: ctx.agentUid,
    author: ctx.agentName,
    init: ctx.agentInit,
    text: output.texto,
    ts: ctx.now(),
    origemAgente: true,
  };
  return [{ kind: 'update', path: `comments/${commentId}`, value: comment }];
}

module.exports = { plan };
