// functions/agente-agil-orquestrador/tools/cardsPorAgente.js
//
// cards_por_agente: ferramenta de LEITURA nova, pedido direto do usuário
// ("fica mais fácil pro Agente Ágil se organizar dentro do quadro") —
// consulta quais cards têm um agente cadastrado (kanban/squads/{squad}/
// dados/agentes, ver kanban-dev.html:allIdentities()) como responsável ou
// participante. Sem filtro (`agente` omitido), agrupa por TODOS os
// agentes cadastrados — visão geral de quem tem o quê. Com filtro (nome
// ou init), devolve só os cards daquele agente.
//
// Reaproveita 100% leituras que já existem — cardsPath()/agente-agil/board,
// readFlowMeta()/columnName() de agente-agil/flow, mesmo padrão de
// visao_board.js/lerCard.js. Não faz sentido pedir cardId fixo (é uma
// consulta sobre o BOARD, não sobre 1 card só) — vive fora do
// `if(!semCard)` em tools/index.js, junto de visao_board/biblioteca_agil.

const { z } = require('zod');
const { cardsPath } = require('../../agente-agil/board');
const flowLib = require('../../agente-agil/flow');

const cardsPorAgenteSchema = z.object({
  agente: z.string().optional(),
});

// Resolve o filtro do LLM (nome OU init, case-insensitive) contra o
// registro de agentes cadastrados — mesma tolerância que resolveMember()
// (lerCard.js) já dá pra membros humanos.
function resolveAgenteFiltro(agentesList, agenteInput) {
  if (!agenteInput) return null;
  const alvo = agenteInput.trim().toLowerCase();
  return (
    (agentesList || []).find((a) => (a.init || a.id || '').toLowerCase() === alvo || (a.nome || '').toLowerCase() === alvo) || null
  );
}

function resumoCard(card, columns) {
  return {
    id: card.id,
    titulo: card.title || '',
    coluna: flowLib.columnName(card.col, columns),
    prioridade: card.priority || null,
    prazo: card.due || null,
  };
}

// Só cards ATIVOS (não arquivados) — mesmo critério de summarizeBoard()
// (visaoBoard.js). Um agente "organizando o quadro" quer saber o que
// ainda está em aberto, não o que já foi pra história.
function agruparPorAgente(cards, agentesList, columns) {
  const ativos = (cards || []).filter((c) => c && !c.archived);
  return (agentesList || []).map((a) => {
    const init = a.init || a.id;
    const cardsDoAgente = ativos.filter((c) => c.owner === init || (c.participants || []).includes(init));
    return {
      agente: { nome: a.nome || a.id, init },
      total: cardsDoAgente.length,
      cards: cardsDoAgente.map((c) => resumoCard(c, columns)),
    };
  });
}

function makeFakeCardsPorAgenteHandler() {
  return async function fakeCardsPorAgente() {
    return {
      ok: true,
      simulated: true,
      tool: 'cards_por_agente',
      resultado: [
        {
          agente: { nome: 'Agente Fictício (exemplo)', init: 'AF' },
          total: 1,
          cards: [{ id: 'c1', titulo: 'Card de exemplo', coluna: 'Backlog', prioridade: null, prazo: null }],
        },
      ],
    };
  };
}

function makeRealCardsPorAgenteHandler({ db, squadId }) {
  return async function realCardsPorAgente(input) {
    const [agentesSnap, cardsSnap, meta] = await Promise.all([
      db.ref(`kanban/squads/${squadId}/dados/agentes`).get(),
      db.ref(cardsPath(squadId)).get(),
      flowLib.readFlowMeta(db, squadId),
    ]);
    const agentesVal = agentesSnap.val();
    const agentesList = agentesVal ? Object.values(agentesVal).filter(Boolean) : [];
    const cards = Object.values(cardsSnap.val() || {}).filter(Boolean);

    if (!agentesList.length) {
      return { ok: true, tool: 'cards_por_agente', resultado: [], aviso: 'Nenhum agente de IA cadastrado neste squad ainda.' };
    }

    const alvo = resolveAgenteFiltro(agentesList, input?.agente);
    if (input?.agente && !alvo) {
      return {
        ok: false,
        error: 'agente_nao_encontrado',
        agentes_disponiveis: agentesList.map((a) => a.nome || a.id),
      };
    }

    const agentesFiltrados = alvo ? [alvo] : agentesList;
    return {
      ok: true,
      tool: 'cards_por_agente',
      resultado: agruparPorAgente(cards, agentesFiltrados, meta.columns),
    };
  };
}

module.exports = {
  cardsPorAgenteSchema,
  resolveAgenteFiltro,
  resumoCard,
  agruparPorAgente,
  makeFakeCardsPorAgenteHandler,
  makeRealCardsPorAgenteHandler,
};
