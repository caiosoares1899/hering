// functions/agente-agil/resolver.js
//
// V0: a "referencia" de negócio (ex.: {tipo:'recorrente', nome:'relatorio_diario',
// data:'2026-07-22'}) ainda NÃO é resolvida aqui — o envelope do v0 já chega
// com cardId direto (ver schema.js). Este arquivo existe desde já só pra
// fixar o ponto de extensão.
//
// No v1, resolveReferencia vai usar card.recorrenteDe + a data da instância
// (carimbados por processRecorrentes() no kanban.html) pra achar o cardId
// real, em vez de o especialista precisar conhecer ID interno do board.

function resolveReferencia(_referencia) {
  throw new Error('resolveReferencia ainda não implementado no v0 — envelope usa cardId direto');
}

module.exports = { resolveReferencia };
