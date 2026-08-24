// functions/agente-agil-orquestrador/dueOverdueTrigger.js
//
// Item 5 do roadmap ("gatilho automático em mudança de card", ver README.md)
// — v1 enxuto, desenhado e combinado com o usuário em 2026-08-24.
//
// Achado que motivou isso: runAutoRules() (kanban-dev.html) é 100%
// client-side, disparado pela ação de quem está com o board aberto. Os 4
// gatilhos "ambientais" de AUTO_TRIGGERS — due_today, due_overdue,
// wip_exceeded, aging — não nascem de uma edição, nascem do TEMPO passando
// (card ficou atrasado, ficou parado) — e hoje só avaliam porque alguma aba
// tem um setInterval rodando a checagem (checkDueNotifs/checkAgingAutomations,
// 1x/dia). Se ninguém abrir o board, nada dispara — um card pode ficar
// atrasado um fim de semana inteiro sem ninguém (nem o Agente Ágil) notar.
//
// Escopo v1 (decisão explícita do usuário, não deduzida): só o gatilho
// due_overdue ("card atrasado, 1º dia"), só squad `dev`, scan 1x/dia — mesma
// cadência que checkDueNotifs() já usa no client. due_today/wip_exceeded/
// aging ficam de fora de propósito, não implementados ainda — cada um seria
// uma decisão separada, mesmo padrão incremental do resto deste roadmap.
//
// Reaproveita a MESMA rota já validada da @menção, não inventa caminho novo:
// quando a condição bate e existe uma Automação "Notificar Agente Ágil"
// ativa nesse squad com trigger due_overdue, escreve o MESMO formato de
// comentário que AUTO_ACTIONS.notify_agent.run() já escreve no client
// (kanban-dev.html) — cai direto no listener de mentionTrigger.js
// (agenteAgilMencao), que já filtra auto-comentário e respeita o kill
// switch. Não replica NENHUMA outra ação de automação (mover coluna, tag,
// etc.) — só a ação notify_agent da(s) regra(s) due_overdue; as outras
// ações de uma mesma regra continuam dependendo de alguém abrir o board,
// como hoje (fora de escopo v1).
//
// Sem marcador de dedupe: due_overdue é auto-dedupe por construção — o
// AUTO_TRIGGERS.matches() do client usa "card.due === ontem" (não
// "due <= ontem"), então um card só bate NO DIA EXATO em que cruza de "hoje"
// pra "atrasado 1 dia" — nunca 2 dias seguidos. Rodando 1x/dia (o Cloud
// Scheduler já garante isso), não tem como notificar o mesmo card 2x pelo
// mesmo motivo.

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getDatabase } = require('firebase-admin/database');
const { cardsPath, cardCommentsPath } = require('../agente-agil/board');
const flowLib = require('../agente-agil/flow');

const SQUAD_ID = 'dev';

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

function ruleMatchesDueOverdue(rule) {
  if (!rule || !rule.active || rule.trigger !== 'due_overdue') return false;
  return ruleActions(rule).some((a) => a.action === 'notify_agent');
}

function cardHasTag(card, tagId) {
  return (card.tags || []).includes(tagId);
}

async function runDueOverdueScan(db, squadId) {
  const [cardsSnap, rulesSnap] = await Promise.all([
    db.ref(cardsPath(squadId)).get(),
    db.ref(`kanban/squads/${squadId}/dados/auto_rules`).get(),
  ]);
  const rulesRaw = rulesSnap.val();
  const rules = Array.isArray(rulesRaw) ? rulesRaw : Object.values(rulesRaw || {});
  const matchingRules = rules.filter(ruleMatchesDueOverdue);
  const cards = Object.values(cardsSnap.val() || {});
  if (!matchingRules.length) {
    // Nenhuma Automação due_overdue->notify_agent configurada nesse squad —
    // nem vale ler flow meta / iterar cards, sai cedo.
    return { scanned: 0, notificados: 0 };
  }

  const flowMeta = await flowLib.readFlowMeta(db, squadId);
  const ontem = todaySP(-1);
  let notificados = 0;
  for (const card of cards) {
    if (!card || card.archived) continue;
    if (card.due !== ontem) continue;
    if (flowLib.isDoneColumn(card.col, flowMeta)) continue; // mesmo filtro do client (checkDueNotifs)
    const rule = matchingRules.find((r) => !r.condTag || cardHasTag(card, r.condTag));
    if (!rule) continue;
    const comment = {
      id: 'c' + Date.now() + Math.random().toString(36).slice(2, 5),
      uid: 'automacao',
      author: '⚙ Automação',
      init: '⚙',
      foto: '',
      text: `@Agente Ágil — [Automação] Card "${card.title}" está atrasado (venceu ontem). Dá uma olhada e vê se alguma ação é recomendada.`,
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
    try {
      const { scanned, notificados } = await runDueOverdueScan(db, SQUAD_ID);
      console.log(`[agente-agil-due-overdue] squad=${SQUAD_ID} cards=${scanned} notificados=${notificados}`);
    } catch (e) {
      console.error(`[agente-agil-due-overdue] squad=${SQUAD_ID} falhou:`, e);
    }
  }
);

module.exports = {
  SQUAD_ID,
  todaySP,
  ruleMatchesDueOverdue,
  runDueOverdueScan,
  agenteAgilDueOverdueScan,
};
