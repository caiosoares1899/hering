// functions/agente-agil/outputs/editarCampos.js
//
// Edita descrição/prioridade/tags do card. desc e priority são escalares
// (update() direto, sem risco de concorrência); tags é array e SEMPRE
// aditivo — nunca remove tag existente. Combinado com o time: remover tag
// é decisão de humano, o agente só adiciona contexto, nunca apaga o que já
// estava lá (evita perder uma tag colocada por alguém enquanto o agente
// processava o card em paralelo).
//
// Histórico registra cada campo que de fato mudou, no mesmo espírito que
// _histDiff produz nas edições manuais do cliente. Se desc mudar, o texto
// novo passa pela MESMA resolução de @menções que comentario.js usa (ver
// notifications.js) — sem isso, editar a descrição pelo agente nunca
// notificava ninguém, porque isso normalmente acontece no <textarea> do
// cliente (parseMentions()), que o agente nunca toca.

const notify = require('../notifications');

const HIST_CAP = 50;
const PRIORITY_LABEL = { low: '🟢 Baixa', medium: '🟡 Média', high: '🔴 Alta', critical: '🔥 Crítica' };

function truncateForHistory(v) {
  if (v == null || v === '') return '—';
  const s = String(v);
  return s.length > 40 ? s.substring(0, 40) + '…' : s;
}

async function build(out, ctx) {
  const steps = [];
  const historyEntries = [];
  const nowISO = new Date().toISOString();

  if (out.desc !== undefined) {
    const card = await ctx.readCard();
    const before = card.desc || '';
    if (before !== out.desc) {
      steps.push({ kind: 'update', path: ctx.cardPath, data: { desc: out.desc } });
      historyEntries.push(
        before === '' ? `definiu descrição: ${truncateForHistory(out.desc)}` : `alterou descrição: ${truncateForHistory(before)} → ${truncateForHistory(out.desc)}`
      );
    }
    if (/@[a-zA-Z]/.test(out.desc)) {
      const members = await ctx.readMembers();
      const mentionSteps = await notify.buildMentionSteps(ctx.db, {
        squadId: ctx.squadId,
        text: out.desc,
        members,
        cardId: ctx.cardId,
        dryRun: ctx.dryRun,
      });
      steps.push(...mentionSteps);
    }
  }

  if (out.priority !== undefined) {
    const card = await ctx.readCard();
    const before = card.priority || '';
    if (before !== out.priority) {
      steps.push({ kind: 'update', path: ctx.cardPath, data: { priority: out.priority } });
      historyEntries.push(`alterou prioridade: ${PRIORITY_LABEL[before] || '—'} → ${PRIORITY_LABEL[out.priority] || out.priority}`);
    }
  }

  if (out.tags !== undefined && out.tags.length) {
    let originalTags = [];
    steps.push({
      kind: 'transaction',
      path: `${ctx.cardPath}/tags`,
      transform(current) {
        originalTags = Array.isArray(current) ? current.slice() : [];
        const tags = originalTags.slice();
        out.tags.forEach((t) => {
          if (t && !tags.includes(t)) tags.push(t);
        });
        return tags;
      },
      after: async () => {
        const newlyAdded = out.tags.filter((t) => t && !originalTags.includes(t));
        if (!newlyAdded.length) return [];
        return [
          {
            kind: 'transaction',
            path: `${ctx.cardPath}/history`,
            transform(current) {
              const history = Array.isArray(current) ? current.slice() : [];
              history.push({ who: 'Agente Ágil', what: `adicionou tag(s): ${newlyAdded.join(', ')}`, at: nowISO });
              return history.length > HIST_CAP ? history.slice(-HIST_CAP) : history;
            },
          },
        ];
      },
    });
  }

  if (historyEntries.length) {
    steps.push({
      kind: 'transaction',
      path: `${ctx.cardPath}/history`,
      transform(current) {
        const history = Array.isArray(current) ? current.slice() : [];
        historyEntries.forEach((what) => history.push({ who: 'Agente Ágil', what, at: nowISO }));
        return history.length > HIST_CAP ? history.slice(-HIST_CAP) : history;
      },
    });
  }

  if (!steps.length) {
    const err = new Error('editar_campos: nenhum campo mudou (desc/priority/tags iguais ao valor atual, ou nenhum enviado)');
    err.code = 'invalid_output';
    throw err;
  }

  return steps;
}

module.exports = { build };
