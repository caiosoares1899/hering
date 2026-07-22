// functions/agente-agil/outputs/link.js
//
// Traduz um output {type:'link', url, titulo} num plano de escrita.
// links é array de verdade em /cards/{chave}/links — único campo com
// risco real de concorrência (dois pushes simultâneos podem se pisar) —
// então precisa rodar como TRANSACTION escopada só nesse campo, nunca
// como update() direto.

function plan(output, ctx) {
  const link = {
    id: ctx.newId('lnk'),
    url: output.url,
    title: output.titulo,
    ts: ctx.now(),
    origemAgente: true,
  };
  return [
    {
      kind: 'transaction',
      path: 'links',
      apply: (current) => {
        const arr = Array.isArray(current) ? current.slice() : [];
        arr.push(link);
        return arr;
      },
    },
  ];
}

module.exports = { plan };
