// functions/agente-agil/outputs/moverColuna.js
//
// Move o card de coluna — replica o que o cliente faz em TODA movimentação
// manual (recordMove -> card.flow, recordHistory -> card.history, notifDone
// se o destino for coluna de "fim", notifMoved pra qualquer outra) pra o
// agente nunca mover um card silenciosamente: quem olha o board depois vê
// no histórico que foi o Agente Ágil quem moveu, e dono/participantes são
// avisados igual a uma movimentação humana, seja pra "Feito" ou pra
// qualquer coluna intermediária.
//
// Achado na validação manual do Sprint 3 (bloco mover_coluna): até aqui só
// a notificação de coluna de fim (notifDone) tinha sido replicada — mover
// pra uma coluna intermediária ficava silencioso pro agente, embora o
// cliente (kanban.html:notifMoved, ver handleDrop) já notifique em QUALQUER
// mudança de coluna há algum tempo. Não era intencional (o comentário acima
// sempre disse "TODA movimentação manual") — o agente só ficou defasado
// depois que notifMoved foi adicionado ao fluxo manual.
//
// "Coluna de fim", pra decidir se notifica, usa flowConfig.doneCols (ver
// flow.js) — a config oficial que o PO ajusta em Configurações > Fluxo, não
// a heurística mais simples que o cliente usa inline nalguns call-sites de
// notificação. Combinado com o time: usar a fonte mais confiável aqui é
// mais correto e mais fácil de auditar do que reproduzir a heurística
// simplificada, mesmo custando uma leitura a mais (columns/config/flow,
// cacheada — ver flow.js).
//
// `col` é escalar (não corre risco de sobrescrever edição concorrente),
// mas ainda usa transaction — não por segurança do dado em si, e sim
// porque histórico/flow/notificação dependem de saber a coluna ANTERIOR de
// verdade no momento do commit, não a que a gente leu antes de escrever
// (que pode já estar obsoleta se um humano arrastou o card ao mesmo tempo).

const flow = require('../flow');
const notify = require('../notifications');

const HIST_CAP = 50;
const FLOW_LOG_CAP = 40;

async function build(out, ctx) {
  const meta = await ctx.readFlowMeta();
  if (!flow.columnExists(out.coluna, meta.columns)) {
    const err = new Error(`Coluna "${out.coluna}" não existe neste board`);
    err.code = 'invalid_output';
    throw err;
  }

  let fromCol = null;
  const nowISO = new Date().toISOString();

  const colStep = {
    kind: 'transaction',
    path: `${ctx.cardPath}/col`,
    transform(current) {
      fromCol = current;
      return out.coluna;
    },
    after: async () => {
      if (fromCol === out.coluna) return []; // já estava lá — nada a fazer, sem poluir histórico

      const destName = flow.columnName(out.coluna, meta.columns);
      const steps = [
        {
          kind: 'transaction',
          path: `${ctx.cardPath}/history`,
          transform(current) {
            const history = Array.isArray(current) ? current.slice() : [];
            history.push({ who: ctx.actor.who, what: `moveu para ${destName}`, at: nowISO, init: ctx.actor.init });
            return history.length > HIST_CAP ? history.slice(-HIST_CAP) : history;
          },
        },
        {
          kind: 'transaction',
          path: `${ctx.cardPath}/flow`,
          transform(current) {
            const f =
              current && typeof current === 'object'
                ? { ...current, enteredAt: { ...(current.enteredAt || {}) }, log: Array.isArray(current.log) ? current.log.slice() : [] }
                : { enteredAt: {}, log: [] };
            f.enteredAt[out.coluna] = nowISO;
            f.log.push({ from: fromCol || '—', to: out.coluna, at: nowISO });
            if (f.log.length > FLOW_LOG_CAP) f.log = f.log.slice(-FLOW_LOG_CAP);
            const startIds = flow.startColumnIds(meta);
            const doneIds = flow.doneColumnIds(meta);
            if (startIds.includes(out.coluna) && !f.firstStartAt) f.firstStartAt = nowISO;
            if (doneIds.includes(out.coluna)) f.doneAt = nowISO;
            else if (f.doneAt && doneIds.includes(fromCol)) f.doneAt = null;
            return f;
          },
        },
      ];

      const isDone = flow.isDoneColumn(out.coluna, meta);
      const card = await ctx.readCard();
      const members = await ctx.readMembers();
      const notifSteps = await notify.buildOwnerParticipantNotifSteps(ctx.db, {
        squadId: ctx.squadId,
        card,
        members,
        type: isDone ? 'done' : 'moved',
        title: isDone ? 'Card concluído 🎉' : `Card movido para ${destName}`,
        cardId: ctx.cardId,
        dryRun: ctx.dryRun,
      });
      steps.push(...notifSteps);

      return steps;
    },
  };

  return [colStep];
}

module.exports = { build };
