// functions/agente-agil-orquestrador/agenteMarcador.js
//
// Pedido direto do usuário: quando o orquestrador muda algo de verdade
// num card que já tem um agente de IA cadastrado (kanban/squads/{squad}/
// dados/agentes, ver kanban-dev.html:allIdentities()) como responsável ou
// participante, esse agente deve ficar "marcado" no histórico do card —
// mesmo espírito de avisar um humano quando algo acontece no card dele,
// só que um agente cadastrado não é um usuário de verdade (sem login/uid
// próprio pra receber uma notificação igual pessoa). A solução acordada:
// um comentário adicional, curto e discreto, que qualquer um lendo o
// card também vê — não uma notificação de verdade.
//
// Só dispara quando ALGO MUDOU de verdade (mesmo critério de
// coletarAcoesAgente() em agenteLog.js — chamadas que só leram o card,
// tipo ler_card/visao_board/cards_por_agente, não contam) — senão toda
// @menção num card com agente cadastrado viraria 2 comentários sempre,
// mesmo quando a resposta foi só uma pergunta respondida sem mexer em
// nada.

// Cruza owner/participants do card (INICIAIS, não uid — mesmo formato
// que card.owner sempre usa) contra o registro de agentes do squad.
function resolveAgentesResponsaveis(card, agentesList) {
  if (!card || !agentesList || !agentesList.length) return [];
  const alvo = new Set([card.owner, ...(card.participants || [])].filter(Boolean));
  return agentesList.filter((a) => alvo.has(a.init || a.id));
}

function montarComentarioMarcador(agentesResponsaveis) {
  if (!agentesResponsaveis || !agentesResponsaveis.length) return null;
  const nomes = agentesResponsaveis.map((a) => `${a.avatarEmoji || '🤖'} ${a.nome || a.id}`).join(', ');
  return `📎 cc: ${nomes} — responsável por este card.`;
}

// Melhor esforço, mesmo espírito de registrarLogAgente() (agenteLog.js):
// nunca derruba o fluxo principal — a resposta do orquestrador já foi
// aplicada antes de chegar aqui, uma falha neste passo só perde o
// marcador, não desfaz nada.
async function marcarAgenteResponsavel(db, { squadId, cardId, card, acoes, comentarioTool, dryRun }) {
  if (!acoes || !acoes.length) return { posted: false, reason: 'no_actions' };
  try {
    const agentesSnap = await db.ref(`kanban/squads/${squadId}/dados/agentes`).get();
    const agentesVal = agentesSnap.val();
    const agentesList = agentesVal ? Object.values(agentesVal).filter(Boolean) : [];
    const responsaveis = resolveAgentesResponsaveis(card, agentesList);
    const texto = montarComentarioMarcador(responsaveis);
    if (!texto) return { posted: false, reason: 'no_agent_responsible' };
    if (dryRun || !comentarioTool) return { posted: false, reason: 'dry_run', texto };
    await comentarioTool.handler({ type: 'comentario', texto });
    return { posted: true, texto };
  } catch (err) {
    console.error(`[agente-marcador:${squadId}] falha ao marcar agente responsável:`, cardId, err);
    return { posted: false, reason: 'error' };
  }
}

module.exports = { resolveAgentesResponsaveis, montarComentarioMarcador, marcarAgenteResponsavel };
