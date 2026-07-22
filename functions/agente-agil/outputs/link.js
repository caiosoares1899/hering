// functions/agente-agil/outputs/link.js
//
// Traduz um output {type:'link', url, titulo} num plano de escrita.
// links é array de verdade em /cards/{chave}/links — único campo com
// risco real de concorrência (dois pushes simultâneos podem se pisar) —
// então precisa rodar como TRANSACTION escopada só nesse campo, nunca
// como update() direto.
//
// buildLinkPlan é a parte reaproveitável: relatorioHtml.js chama ela
// direto depois de hospedar o relatório no Storage, pra não duplicar a
// lógica de escrita do link no card.

function buildLinkPlan({ url, titulo }, ctx) {
  const link = {
    id: ctx.newId('lnk'),
    url,
    title: titulo,
    ts: ctx.now(),
    origemAgente: true,
  };
  return [
    {
      kind: 'transaction',
      path: 'links',
      preview: link, // só pro dryRun mostrar o que seria escrito — apply() é quem manda de verdade
      apply: (current) => {
        const arr = Array.isArray(current) ? current.slice() : [];
        arr.push(link);
        return arr;
      },
    },
  ];
}

function plan(output, ctx) {
  return buildLinkPlan({ url: output.url, titulo: output.titulo }, ctx);
}

module.exports = { plan, buildLinkPlan };
