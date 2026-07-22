// Comentário vira update multi-path em {cardPath}/comments/{novoId} — comments
// já é objeto chaveado por id no schema real do card (kanban.html), então não
// tem risco de posição/concorrência como card.links (array) tem.

function build(out, ctx) {
  const id = 'c' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
  return {
    kind: 'update',
    path: `${ctx.cardPath}/comments`,
    data: {
      [id]: {
        id,
        uid: 'agente-agil',
        author: 'Agente Ágil',
        init: '🤖',
        text: out.texto,
        ts: new Date().toISOString(),
      },
    },
  };
}

module.exports = { build };
