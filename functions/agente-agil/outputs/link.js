// card.links é array de verdade (kanban.html faz card.links.push() no cliente) —
// o único campo tocado pelo Agente Ágil com risco real de concorrência. Por
// isso a escrita usa uma transaction escopada só em {cardPath}/links, nunca
// um update() direto que pudesse pisar num link adicionado ao mesmo tempo
// por um humano no board.

function build(out, ctx) {
  return {
    kind: 'transaction',
    path: `${ctx.cardPath}/links`,
    transform(current) {
      const links = Array.isArray(current) ? current.slice() : [];
      links.push({
        id: 'lnk' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
        url: out.url,
        title: out.titulo,
        ts: new Date().toISOString(),
      });
      return links;
    },
  };
}

module.exports = { build };
