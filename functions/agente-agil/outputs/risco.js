// card.riscos é array de STRINGS puras (kanban-dev.html: addRisco() faz
// renderRiscos([...getRiscos(), v]), sem id/metadado por item, sem conceito
// de "resolver" um risco — só uma lista de avisos visível na tela do card).
// Mesmo raciocínio de concorrência que outputs/link.js: usa uma transaction
// escopada só em {cardPath}/riscos, nunca um update() direto que pudesse
// pisar num risco adicionado ao mesmo tempo por um humano no board.
//
// Sem entrada em card.history, de propósito — mesma escolha de link.js
// (lista própria e visível na tela do card já é o registro; diferente de
// checklist_item/editar_campos/mover_coluna, que mudam um ESTADO existente
// e por isso valem uma linha de histórico).

function build(out, ctx) {
  const texto = out.texto;
  return {
    kind: 'transaction',
    path: `${ctx.cardPath}/riscos`,
    preview: texto, // só pro dryRun mostrar o que seria escrito — transform() é quem manda de verdade
    transform(current) {
      const riscos = Array.isArray(current) ? current.slice() : [];
      riscos.push(texto);
      return riscos;
    },
  };
}

module.exports = { build };
