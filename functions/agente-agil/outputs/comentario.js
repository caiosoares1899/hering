// Comentário vira update multi-path em {cardPath}/comments/{novoId} — comments
// já é objeto chaveado por id no schema real do card (kanban.html), então não
// tem risco de posição/concorrência como card.links (array) tem.
//
// Sprint 3: se o texto tiver @menção, resolve e notifica igual ao
// parseMentions() do cliente (ver notifications.js) — sem isso, comentar
// pelo agente nunca notificava ninguém, porque isso normalmente acontece no
// <textarea> do modal, que o agente nunca toca. Só lê a lista de membros
// (ctx.readMembers) quando o texto de fato tem uma chance de @menção —
// evita a leitura em todo comentário sem @ nenhum.

const notify = require('../notifications');

async function build(out, ctx) {
  const id = 'c' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
  const commentStep = {
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
  const steps = [commentStep];
  if (/@[a-zA-Z]/.test(out.texto)) {
    const members = await ctx.readMembers();
    const mentionSteps = await notify.buildMentionSteps(ctx.db, {
      squadId: ctx.squadId,
      text: out.texto,
      members,
      cardId: ctx.cardId,
      dryRun: ctx.dryRun,
    });
    steps.push(...mentionSteps);
  }
  return steps;
}

module.exports = { build };
