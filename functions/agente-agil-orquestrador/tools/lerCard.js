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

// Ponto 4 do desenho combinado "orquestrador lendo input de especialistas
// externos" (README.md, 2026-08-25 — implementado 2026-08-27): em vez de
// uma ferramenta nova só pra ler o que especialistas escreveram, cada
// comentário que ler_card já devolve ganha uma `origem`, resolvida pelo
// MESMO `uid` que `resolveActor()` (agente-agil/board.js) já grava —
// nenhum registro/campo novo no Firebase, só rotular o que já existe.
// `especialista:*` é o prefixo que `resolveActor(especialistaId)` usa pra
// qualquer especialista externo (hoje só Databricks, mas o prefixo já é
// genérico); `agente-agil` é o próprio orquestrador (resolveActor() sem
// especialista); `automacao` é o ator sintético que dispara o agente via
// Automação/scan diário (não é uma pessoa, mas também não é um
// especialista nem o próprio agente — categoria própria evita rotular
// errado); qualquer outro uid é uma pessoa de verdade.
function origemDoComentario(uid) {
  if (uid === 'agente-agil') return 'proprio';
  if (typeof uid === 'string' && uid.startsWith('especialista:')) return 'especialista';
  if (uid === 'automacao') return 'automacao';
  return 'humano';
}

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

// Achado real (teste do item 7, 2026-08-21): mover_coluna espera o ID da
// coluna (schema `coluna: z.string()`), não o nome de exibição — mas
// nenhuma ferramenta expunha o mapa id<->nome de TODAS as colunas do
// board antes disto. visao_board só lista colunas com WIP configurado
// (Backlog/Concluído tipicamente não têm); ler_card só devolvia a coluna
// ATUAL do card. Resultado observado em produção: pedido "move esse card
// pra Concluído" (nome real da coluna) fez o agente corretamente recusar
// adivinhar o ID e perguntar ao humano — julgamento certo, mas por falta
// de informação que deveria estar disponível. `colunas_disponiveis`
// fecha essa lacuna: toda vez que o agente chama ler_card (já orientado
// pelo system prompt a fazer isso em pedidos abertos/falta de contexto),
// ganha a lista completa pra resolver nome -> id antes de mover_coluna.
function summarizeCard(card, { columns, flowConfig, squadTags, members, comments }) {
  const tagsPorId = new Map((squadTags || []).map((t) => [t.id, t.label]));
  const doneIds = new Set(flowLib.doneColumnIds({ columns, flowConfig }));
  const colunasDisponiveis = (columns || []).map((c) => ({ id: c.id, nome: c.name || c.id, fim: doneIds.has(c.id) }));

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
    .map((c) => ({ autor: c.author, texto: c.text, quando: c.ts, origem: origemDoComentario(c.uid) }));

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
    colunas_disponiveis: colunasDisponiveis,
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
        colunas_disponiveis: [
          { id: 'backlog', nome: 'Backlog', fim: false },
          { id: 'progress', nome: 'Em Progresso', fim: false },
          { id: 'done', nome: 'Concluído', fim: true },
        ],
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
      card: summarizeCard(card, { columns: meta.columns, flowConfig: meta.flowConfig, squadTags, members, comments }),
    };
  };
}

module.exports = { lerCardSchema, summarizeCard, origemDoComentario, makeFakeLerCardHandler, makeRealLerCardHandler, COMMENTS_CAP };
