// Comentário vira update multi-path em card_comments/{cardId}/{novoId} —
// path próprio por squad desde a migração Fase 1.1 (kanban-dev.html,
// 2026-08-11), NÃO mais dentro do card (card.comments, campo morto desde
// então). Achado real (2026-08-18): este arquivo ficou escrevendo no campo
// antigo por uma sprint inteira depois da migração, sem erro nenhum (é uma
// escrita RTDB válida, só que pra um lugar que a UI não lê mais) — os
// comentários dos canários 9/10 e da 1ª @menção real do orquestrador nunca
// apareceram de verdade no board, mesmo com "escrita real confirmada" nos
// checks automáticos (que só conferem o output da chamada, não a UI).
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
    // Pré-calculado em ctx.cardCommentsPath por buildWritePlan() (board.js)
    // — não importa board.js diretamente aqui de propósito, ver comentário
    // na montagem de ctx (dependência circular real encontrada).
    path: ctx.cardCommentsPath,
    data: {
      [id]: {
        id,
        uid: ctx.actor.uid,
        author: ctx.actor.author,
        init: ctx.actor.init,
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
