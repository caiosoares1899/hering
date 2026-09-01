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
//
// 2026-09-01 — pedido direto do usuário: "o agente de VM da Vtex tem q
// ter um ID e ser responsável pelo card... tudo de importante q acontecer
// ali, o agente agil vai pegar essas informações e levar pro agente de vm
// externo, q ta la na vtex, via https ou endpoint". Estende esta mesma
// função pra também reconhecer AGENTES EXTERNOS (registro GLOBAL em
// `kanban/config/agentesExternos/{id}`, painel.html — normalmente usados
// só como CONTEXTO de quem manda mensagem pro Agente Ágil via API, ver
// `lerDescricaoEspecialista()`/intakeTrigger.js) como responsável/
// participante de card, do mesmo jeito que um agente de IA decorativo —
// desde que a entrada tenha `init` preenchido (opcional; sem isso, o
// agente externo não aparece nos seletores do board, comportamento igual
// ao de antes desta mudança). Decisão explícita do usuário: o gatilho é
// DETERMINÍSTICO em código (não uma ferramenta que o LLM decide chamar) —
// GARANTIDO disparar em toda mutação real, sem depender do modelo lembrar
// de notificar. Reaproveita o MESMO handler HTTP que a ferramenta
// `notificar_especialista_externo` já usa (`tools/notificarEspecialistaExterno.js`)
// — mesma validação de URL, timeout, tratamento de erro — só chamado
// direto em vez de exposto como tool. Mesmo squad-scope de rollout já
// vetado pra chamada HTTP real (`NOTIFICAR_ESPECIALISTA_SQUADS`, hoje só
// 'dev') — fora desses squads, o agente externo ainda entra no comentário
// "📎 cc" (visibilidade in-app), só não recebe o POST de verdade.

const { NOTIFICAR_ESPECIALISTA_SQUADS } = require('./squadScope');
const { makeRealNotificarEspecialistaExternoHandler } = require('./tools/notificarEspecialistaExterno');

// Cruza owner/participants do card (INICIAIS, não uid — mesmo formato
// que card.owner sempre usa) contra uma lista de agentes (`.init`/`.id`)
// — usada tanto pra agentes de IA decorativos (dados/agentes) quanto pra
// agentes externos habilitados no squad (ver agentesExternosDoSquad()).
function resolveAgentesResponsaveis(card, agentesList) {
  if (!card || !agentesList || !agentesList.length) return [];
  const alvo = new Set([card.owner, ...(card.participants || [])].filter(Boolean));
  return agentesList.filter((a) => alvo.has(a.init || a.id));
}

// Filtra o registro GLOBAL de agentes externos (painel.html) pros que
// valem NESTE squad (`squads[squadId]===true`) e têm `init` preenchido —
// sem `init` o cadastro só serve de contexto pro LLM (comportamento
// original, anterior a esta mudança), nunca aparece como responsável de
// card. Normaliza pro mesmo shape de dados/agentes (`.id`/`.nome`/`.init`/
// `.cor`/`.avatarEmoji`) + `webhookUrl` pra decidir a notificação.
function agentesExternosDoSquad(agentesExternosRaw, squadId) {
  if (!agentesExternosRaw) return [];
  return Object.entries(agentesExternosRaw)
    .filter(([, v]) => v && v.squads && v.squads[squadId] === true && v.init)
    .map(([id, v]) => ({
      id,
      nome: v.nome || id,
      init: v.init,
      cor: v.cor,
      avatarEmoji: v.avatarEmoji || '🔌',
      webhookUrl: typeof v.webhookUrl === 'string' ? v.webhookUrl.trim() : '',
    }));
}

function montarComentarioMarcador(agentesResponsaveis) {
  if (!agentesResponsaveis || !agentesResponsaveis.length) return null;
  const nomes = agentesResponsaveis.map((a) => `${a.avatarEmoji || '🤖'} ${a.nome || a.id}`).join(', ');
  return `📎 cc: ${nomes} — responsável por este card.`;
}

function truncarMensagem(s, max = 500) {
  if (!s) return s;
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

// Chama o MESMO handler HTTP que a tool notificar_especialista_externo
// usa, uma vez por agente externo responsável que tenha webhookUrl
// configurado — só nos squads vetados pra chamada HTTP real
// (NOTIFICAR_ESPECIALISTA_SQUADS). Nunca lança: cada chamada individual
// já volta {ok:false,...} em erro (mesmo contrato do handler original).
async function notificarAgentesExternosResponsaveis(db, { squadId, cardId, agentesExternosResponsaveis, mensagem, dryRun }) {
  if (!agentesExternosResponsaveis || !agentesExternosResponsaveis.length) return [];
  if (!NOTIFICAR_ESPECIALISTA_SQUADS.includes(squadId)) return [];
  const handler = makeRealNotificarEspecialistaExternoHandler({ db, squadId, cardId, dryRun });
  const resultados = [];
  for (const a of agentesExternosResponsaveis) {
    if (!a.webhookUrl) continue;
    const r = await handler({ especialista: a.id, mensagem }).catch((err) => ({ ok: false, error: 'exception', message: err.message }));
    resultados.push({ especialista: a.id, ...r });
  }
  return resultados;
}

// Melhor esforço, mesmo espírito de registrarLogAgente() (agenteLog.js):
// nunca derruba o fluxo principal — a resposta do orquestrador já foi
// aplicada antes de chegar aqui, uma falha neste passo só perde o
// marcador, não desfaz nada.
async function marcarAgenteResponsavel(db, { squadId, cardId, card, acoes, comentarioTool, dryRun }) {
  if (!acoes || !acoes.length) return { posted: false, reason: 'no_actions' };
  try {
    const [agentesSnap, agentesExternosSnap] = await Promise.all([
      db.ref(`kanban/squads/${squadId}/dados/agentes`).get(),
      db.ref('kanban/config/agentesExternos').get(),
    ]);
    const agentesVal = agentesSnap.val();
    const agentesList = agentesVal ? Object.values(agentesVal).filter(Boolean) : [];
    const agentesExternosList = agentesExternosDoSquad(agentesExternosSnap.val(), squadId);

    const responsaveis = resolveAgentesResponsaveis(card, agentesList);
    const responsaveisExternos = resolveAgentesResponsaveis(card, agentesExternosList);
    const texto = montarComentarioMarcador([...responsaveis, ...responsaveisExternos]);
    if (!texto) return { posted: false, reason: 'no_agent_responsible' };
    if (dryRun || !comentarioTool) return { posted: false, reason: 'dry_run', texto };
    await comentarioTool.handler({ type: 'comentario', texto });

    // Passo separado, com seu próprio try/catch: se algo inesperado
    // falhar aqui, o comentário JÁ foi postado com sucesso — não faz
    // sentido reportar posted:false pra quem chamou.
    let webhooks = [];
    try {
      webhooks = await notificarAgentesExternosResponsaveis(db, {
        squadId,
        cardId,
        agentesExternosResponsaveis: responsaveisExternos,
        mensagem: truncarMensagem(acoes.join('; ')),
        dryRun,
      });
    } catch (err) {
      console.error(`[agente-marcador:${squadId}] falha ao notificar agentes externos:`, cardId, err);
    }
    return { posted: true, texto, webhooks };
  } catch (err) {
    console.error(`[agente-marcador:${squadId}] falha ao marcar agente responsável:`, cardId, err);
    return { posted: false, reason: 'error' };
  }
}

module.exports = {
  resolveAgentesResponsaveis,
  agentesExternosDoSquad,
  montarComentarioMarcador,
  notificarAgentesExternosResponsaveis,
  marcarAgenteResponsavel,
};
