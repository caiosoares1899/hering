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
//
// tags: o especialista manda o LABEL legível (ex.: "Piloto"), não o id
// interno da tag — ele não tem por que conhecer esse id, e não faz sentido
// pedir pra conhecer. card.tags, porém, é um array de IDs (kanban.html
// resolve cada id via getTag()/tags.find(t=>t.id===id) pra desenhar os
// chips); gravar o label cru ali deixava a tag "invisível" na UI (getTag()
// não achava nada com aquele id, renderizava vazio, sem erro nenhum) —
// mesma classe de bug já corrigida em checklistItem.js/resolveGroup() pra
// grupo de checklist, agora resolvida aqui pra tags: busca o label contra
// kanban/squads/{squad}/dados/tags (case-insensitive, mesmo padrão de
// resolveGroup()) e grava o .id correspondente. Label que não bate com
// tag nenhuma do squad é erro (400 invalid_output) — prefere recusar a
// arriscar gravar algo que a UI nunca vai conseguir resolver.

const notify = require('../notifications');

const HIST_CAP = 50;
const PRIORITY_LABEL = { low: '🟢 Baixa', medium: '🟡 Média', high: '🔴 Alta', critical: '🔥 Crítica' };

function truncateForHistory(v) {
  if (v == null || v === '') return '—';
  const s = String(v);
  return s.length > 40 ? s.substring(0, 40) + '…' : s;
}

function resolveTagId(labelInput, squadTags) {
  const list = Array.isArray(squadTags) ? squadTags : Object.values(squadTags || {});
  const match = list.find((t) => t && t.label && t.label.toLowerCase() === String(labelInput).toLowerCase());
  return match ? match.id : null;
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
    const squadTags = await ctx.readTags();
    const resolved = out.tags.map((label) => ({ label, id: resolveTagId(label, squadTags) }));
    const unresolved = resolved.find((r) => !r.id);
    if (unresolved) {
      const err = new Error(`editar_campos: tag "${unresolved.label}" não existe no squad`);
      err.code = 'invalid_output';
      throw err;
    }
    const idToLabel = new Map(resolved.map((r) => [r.id, r.label]));
    const resolvedIds = resolved.map((r) => r.id);

    let originalTags = [];
    steps.push({
      kind: 'transaction',
      path: `${ctx.cardPath}/tags`,
      transform(current) {
        originalTags = Array.isArray(current) ? current.slice() : [];
        const tags = originalTags.slice();
        resolvedIds.forEach((id) => {
          if (id && !tags.includes(id)) tags.push(id);
        });
        return tags;
      },
      after: async () => {
        const newlyAdded = resolvedIds.filter((id) => id && !originalTags.includes(id));
        if (!newlyAdded.length) return [];
        const newlyAddedLabels = newlyAdded.map((id) => idToLabel.get(id) || id);
        return [
          {
            kind: 'transaction',
            path: `${ctx.cardPath}/history`,
            transform(current) {
              const history = Array.isArray(current) ? current.slice() : [];
              history.push({ who: ctx.actor.who, what: `adicionou tag(s): ${newlyAddedLabels.join(', ')}`, at: nowISO, init: ctx.actor.init });
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
        historyEntries.forEach((what) => history.push({ who: ctx.actor.who, what, at: nowISO, init: ctx.actor.init }));
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
