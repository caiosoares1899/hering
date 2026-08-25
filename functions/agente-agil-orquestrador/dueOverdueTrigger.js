// functions/agente-agil-orquestrador/dueOverdueTrigger.js
//
// Item 5 do roadmap ("gatilho automático em mudança de card", ver README.md)
// — desenhado e combinado com o usuário em 2026-08-24, em 2 rodadas: v1 só
// com due_overdue, depois due_today adicionado no mesmo dia (pedido direto
// do usuário: "só precisa esse mesmo, os outros 2 acho que não precisam" —
// wip_exceeded/aging ficaram de fora). O nome do arquivo/função exportada
// ficou de v1 (só due_overdue) — não renomeado ao adicionar due_today pra
// não exigir um 2º deploy + apagar a function antiga; a Cloud Function
// `agenteAgilDueOverdueScan` cobre os dois gatilhos hoje.
//
// Achado que motivou isso: runAutoRules() (kanban-dev.html) é 100%
// client-side, disparado pela ação de quem está com o board aberto. Os 4
// gatilhos "ambientais" de AUTO_TRIGGERS — due_today, due_overdue,
// wip_exceeded, aging — não nascem de uma edição, nascem do TEMPO passando
// (card ficou atrasado, ficou parado) — e hoje só avaliam porque alguma aba
// tem um setInterval rodando a checagem (checkDueNotifs/checkAgingAutomations,
// 1x/dia). Se ninguém abrir o board, nada dispara — um card pode vencer ou
// ficar atrasado um fim de semana inteiro sem ninguém (nem o Agente Ágil)
// notar.
//
// Escopo (decisão explícita do usuário, não deduzida): due_today +
// due_overdue, scan 1x/dia — mesma cadência que checkDueNotifs() já usa
// no client. wip_exceeded/aging ficam de fora de propósito — cada um
// seria uma decisão separada, mesmo padrão incremental do resto deste
// roadmap.
//
// Squad `dados` adicionado ao scan em 2026-08-25 (mesma decisão pendente
// desde o fechamento do item 5 — "expandir o scan pro squad dados"),
// junto com o mesmo escopo já usado pra @menção/Resumo do Agente Ágil
// (SQUADS_ATIVOS em resumoMeuDia.js). Diferente de mentionTrigger.js
// (onde cada squad vira uma Cloud Function DEPLOYADA SEPARADAMENTE, com
// path literal no trigger — ver comentário lá): aqui não existe esse
// motivo de custo, porque `onSchedule` não escuta eventos de squad
// nenhum, só dispara 1x/dia — então 1 Cloud Function só, iterando
// SQUADS em sequência, é mais simples e não paga o preço de 2
// Schedulers/cold starts separados pra zero benefício real. Cada squad
// roda em seu próprio try/catch — um squad falhando não bloqueia o
// outro nem derruba o scan inteiro.
//
// Reaproveita a MESMA rota já validada da @menção, não inventa caminho novo:
// quando a condição bate e existe uma Automação "Notificar Agente Ágil"
// ativa nesse squad com o trigger correspondente, escreve o MESMO formato
// de comentário que AUTO_ACTIONS.notify_agent.run() já escreve no client
// (kanban-dev.html) — cai direto no listener de mentionTrigger.js
// (agenteAgilMencao), que já filtra auto-comentário e respeita o kill
// switch. Não replica NENHUMA outra ação de automação (mover coluna, tag,
// etc.) — só a ação notify_agent da(s) regra(s) due_today/due_overdue; as
// outras ações de uma mesma regra continuam dependendo de alguém abrir o
// board, como hoje (fora de escopo).
//
// Sem marcador de dedupe: os dois gatilhos são auto-dedupe por construção —
// o AUTO_TRIGGERS.matches() do client usa "card.due === hoje"/"=== ontem"
// (igualdade exata, não "<="), então um card só bate NO DIA EXATO em que
// cruza de "vence hoje" pra "atrasado 1 dia" — nunca 2 dias seguidos pelo
// mesmo motivo, e nunca os dois gatilhos no mesmo dia pro mesmo card
// (hoje/ontem são mutuamente exclusivos). Rodando 1x/dia (o Cloud Scheduler
// já garante isso), não precisa de estado extra pra não duplicar.

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getDatabase } = require('firebase-admin/database');
const { cardsPath, cardCommentsPath } = require('../agente-agil/board');
const flowLib = require('../agente-agil/flow');

const SQUAD_ID = 'dev'; // mantido por compatibilidade (testes existentes/scripts usam como default de 1 squad só)
const SQUADS = ['dev', 'dados']; // squads escaneados de verdade pela Cloud Function — ver comentário no topo

// Data no calendário de São Paulo, independente do timezone do processo do
// Cloud Function — mesmo formato (YYYY-MM-DD) que card.due já usa.
function todaySP(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

// Mesma normalização que _autoRuleActions() já faz no client (kanban-dev.html)
// — regras salvas antes da Fase 3 guardavam action/actionVal direto no
// objeto, em vez de um array actions[].
function ruleActions(rule) {
  if (Array.isArray(rule.actions)) return rule.actions;
  if (rule.action) return [{ action: rule.action, actionVal: rule.actionVal }];
  return [];
}

function ruleMatchesTrigger(rule, triggerKey) {
  if (!rule || !rule.active || rule.trigger !== triggerKey) return false;
  return ruleActions(rule).some((a) => a.action === 'notify_agent');
}

// Mantidos por nome (não só ruleMatchesTrigger genérico) — usados
// diretamente pelos testes e mais legível no call-site do que passar a
// string 'due_overdue'/'due_today' toda vez.
function ruleMatchesDueOverdue(rule) {
  return ruleMatchesTrigger(rule, 'due_overdue');
}
function ruleMatchesDueToday(rule) {
  return ruleMatchesTrigger(rule, 'due_today');
}

function cardHasTag(card, tagId) {
  return (card.tags || []).includes(tagId);
}

const TRIGGER_COMMENT_TEXT = {
  due_today: (card) => `@Agente Ágil — [Automação] Card "${card.title}" vence hoje. Dá uma olhada e vê se alguma ação é recomendada.`,
  due_overdue: (card) => `@Agente Ágil — [Automação] Card "${card.title}" está atrasado (venceu ontem). Dá uma olhada e vê se alguma ação é recomendada.`,
};

async function runDueOverdueScan(db, squadId) {
  const [cardsSnap, rulesSnap] = await Promise.all([
    db.ref(cardsPath(squadId)).get(),
    db.ref(`kanban/squads/${squadId}/dados/auto_rules`).get(),
  ]);
  const rulesRaw = rulesSnap.val();
  const rules = Array.isArray(rulesRaw) ? rulesRaw : Object.values(rulesRaw || {});
  const rulesByTrigger = {
    due_today: rules.filter(ruleMatchesDueToday),
    due_overdue: rules.filter(ruleMatchesDueOverdue),
  };
  const cards = Object.values(cardsSnap.val() || {});
  if (!rulesByTrigger.due_today.length && !rulesByTrigger.due_overdue.length) {
    // Nenhuma Automação due_today/due_overdue->notify_agent configurada
    // nesse squad — nem vale ler flow meta / iterar cards, sai cedo.
    return { scanned: 0, notificados: 0 };
  }

  const flowMeta = await flowLib.readFlowMeta(db, squadId);
  const hoje = todaySP(0);
  const ontem = todaySP(-1);
  let notificados = 0;
  for (const card of cards) {
    if (!card || card.archived) continue;
    if (flowLib.isDoneColumn(card.col, flowMeta)) continue; // mesmo filtro do client (checkDueNotifs)
    let triggerKey = null;
    if (card.due === hoje) triggerKey = 'due_today';
    else if (card.due === ontem) triggerKey = 'due_overdue';
    if (!triggerKey) continue;
    const matchingRules = rulesByTrigger[triggerKey];
    if (!matchingRules.length) continue;
    const rule = matchingRules.find((r) => !r.condTag || cardHasTag(card, r.condTag));
    if (!rule) continue;
    const comment = {
      id: 'c' + Date.now() + Math.random().toString(36).slice(2, 5),
      uid: 'automacao',
      author: '⚙ Automação',
      init: '⚙',
      foto: '',
      text: TRIGGER_COMMENT_TEXT[triggerKey](card),
      ts: new Date().toISOString(),
    };
    await db.ref(`${cardCommentsPath(squadId, card.id)}/${comment.id}`).set(comment);
    notificados++;
  }
  return { scanned: cards.length, notificados };
}

const agenteAgilDueOverdueScan = onSchedule(
  { schedule: 'every day 09:05', timeZone: 'America/Sao_Paulo', region: 'us-central1', timeoutSeconds: 120 },
  async () => {
    const db = getDatabase();
    for (const squadId of SQUADS) {
      try {
        const { scanned, notificados } = await runDueOverdueScan(db, squadId);
        console.log(`[agente-agil-due-overdue] squad=${squadId} cards=${scanned} notificados=${notificados}`);
      } catch (e) {
        console.error(`[agente-agil-due-overdue] squad=${squadId} falhou:`, e);
      }
    }
  }
);

module.exports = {
  SQUAD_ID,
  SQUADS,
  todaySP,
  ruleMatchesTrigger,
  ruleMatchesDueOverdue,
  ruleMatchesDueToday,
  runDueOverdueScan,
  agenteAgilDueOverdueScan,
};
