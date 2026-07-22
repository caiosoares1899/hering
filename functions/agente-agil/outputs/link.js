// card.links é array de verdade (kanban.html faz card.links.push() no cliente) —
// o único campo tocado pelo Agente Ágil com risco real de concorrência. Por
// isso a escrita usa uma transaction escopada só em {cardPath}/links, nunca
// um update() direto que pudesse pisar num link adicionado ao mesmo tempo
// por um humano no board.
//
// buildLinkStep é a parte reaproveitável: relatorioHtml.js chama ela direto
// depois de hospedar o relatório no Storage, pra não duplicar a lógica de
// escrita do link no card.

function buildLinkStep({ url, titulo }, ctx) {
  const link = {
    id: 'lnk' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
    url,
    title: titulo,
    ts: new Date().toISOString(),
  };
  return {
    kind: 'transaction',
    path: `${ctx.cardPath}/links`,
    preview: link, // só pro dryRun mostrar o que seria escrito — transform() é quem manda de verdade
    transform(current) {
      const links = Array.isArray(current) ? current.slice() : [];
      links.push(link);
      return links;
    },
  };
}

function build(out, ctx) {
  return buildLinkStep({ url: out.url, titulo: out.titulo }, ctx);
}

module.exports = { build, buildLinkStep };
