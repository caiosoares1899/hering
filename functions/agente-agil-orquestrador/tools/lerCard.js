// functions/agente-agil-orquestrador/tools/lerCard.js
//
// ler_card: única ferramenta de LEITURA do orquestrador (as outras 7 são
// todas de escrita, vindas de agente-agil/schema.js). Sem ela, qualquer
// pedido que exija "analisar antes de decidir" (como o próprio
// systemPrompt.js pede pra pedidos abertos) sempre caía em
// perguntar_humano por falta de contexto — achado ao rodar o primeiro
// teste real de pedido aberto
// (scripts/llmRealSystemPromptV1DryRunContraSquadDev.js).
//
// Retorna um RESUMO curado, não o card cru do RTDB — mesma simetria que o
// lado de escrita já tem (mover_coluna não expõe path, ler_card não expõe
// schema interno/history/ids). Cobre exatamente o que o system prompt pede
// pra ler em pedido aberto — checklist, descrição, comentários — mais o
// contexto mínimo pra decidir bem (coluna, tags, responsável/
// participantes, prioridade). Fora do escopo de propósito: history (trilha
// de auditoria, não é o que um PO lê pra decidir a próxima ação) e campos
// de implementação sem valor de decisão (links, recorrente*, timestamps
// internos) — mais fácil acrescentar depois do que remover.
//
// Reaproveita 100% leituras que já existem em agente-agil/ — nenhuma
// lógica de leitura nova é inventada aqui: resolveCardKey/cardsPath/
// tagsPath (board.js), readFlowMeta/columnName (flow.js), readSquadMembers
// (members.js).
//
// cardId/squadId já vêm fixados em buildTools({mode, db, squadId, cardId})
// — mesmo padrão das outras 7 ferramentas — por isso o schema de input é
// vazio, o LLM não precisa (nem deveria) informar nada de novo.

const { z } = require('zod');
const { resolveCardKey, cardsPath, tagsPath, cardCommentsPath } = require('../../agente-agil/board');
const flowLib = require('../../agente-agil/flow');
const membersLib = require('../../agente-agil/members');

// Comentários limitados aos últimos N (cronológico) — evita estourar
// tokens num card com histórico grande. Combinado com o usuário antes de
// implementar.
const COMMENTS_CAP = 20;

const lerCardSchema = z.object({});

// owner/participants no card já são INICIAIS (ex. "ANA"), não uids — ver
// notifications.js:131 (buildOwnerParticipantNotifSteps monta a lista de
// destinatários direto a partir de card.owner/card.participants como
// inits). Resolve pro nome completo via a mesma lista de membros que as
// outras ferramentas de escrita já usam pra @menção.
function resolveMember(members, init) {
  if (!init) return null;
  const m = members.find((mm) => mm.init === init);
  return { init, nome: m ? m.name : init };
}

function summarizeCard(card, { columns, squadTags, members, comments }) {
  const tagsPorId = new Map((squadTags || []).map((t) => [t.id, t.label]));

  const participantes = (card.participants || card.participantes || [])
    .filter(Boolean)
    .map((init) => resolveMember(members, init));

  // Comentários NÃO vivem mais dentro do card desde a migração Fase 1.1
  // (kanban-dev.html, 2026-08-11) — ver comentário em cardCommentsPath()
  // (agente-agil/board.js) pro achado completo. `comments` chega já lido
  // do path próprio (card_comments/{cardId}), não de card.comments (campo
  // morto desde a migração — ficaria sempre vazio se lido daqui).
  const comentarios = Object.values(comments || {})
    .sort((a, b) => new Date(a.ts) - new Date(b.ts))
    .slice(-COMMENTS_CAP)
    .map((c) => ({ autor: c.author, texto: c.text, quando: c.ts }));

  const checklist = (card.checklist || []).map((item) => {
    const grupo = (card.checklistGroups || []).find((g) => g.id === item.grp);
    return { texto: item.t, done: !!item.done, grupo: grupo ? grupo.title : item.grp };
  });

  return {
    titulo: card.title || '',
    desc: card.desc || '',
    prioridade: card.priority || null,
    tags: (card.tags || []).map((id) => tagsPorId.get(id) || id),
    coluna: { id: card.col, nome: flowLib.columnName(card.col, columns) },
    responsavel: resolveMember(members, card.owner),
    participantes,
    checklist,
    comentarios,
  };
}

function makeFakeLerCardHandler() {
  return async function fakeLerCard() {
    return {
      ok: true,
      simulated: true,
      tool: 'ler_card',
      card: {
        titulo: 'Card de exemplo (simulado)',
        desc: '',
        prioridade: null,
        tags: [],
        coluna: { id: 'backlog', nome: 'Backlog' },
        responsavel: null,
        participantes: [],
        checklist: [],
        comentarios: [],
      },
    };
  };
}

function makeRealLerCardHandler({ db, squadId, cardId }) {
  return async function realLerCard() {
    const cardKey = await resolveCardKey(db, cardId, { squadId });
    if (!cardKey) return { ok: false, error: 'card_not_found', cardId, squadId };

    const [cardSnap, meta, squadTagsSnap, members, commentsSnap] = await Promise.all([
      db.ref(`${cardsPath(squadId)}/${cardKey}`).get(),
      flowLib.readFlowMeta(db, squadId),
      db.ref(tagsPath(squadId)).get(),
      membersLib.readSquadMembers(db, squadId),
      db.ref(cardCommentsPath(squadId, cardId)).get(),
    ]);
    const card = cardSnap.val() || {};
    const squadTags = squadTagsSnap.val() || [];
    const comments = commentsSnap.val() || {};

    return {
      ok: true,
      tool: 'ler_card',
      card: summarizeCard(card, { columns: meta.columns, squadTags, members, comments }),
    };
  };
}

module.exports = { lerCardSchema, summarizeCard, makeFakeLerCardHandler, makeRealLerCardHandler, COMMENTS_CAP };
