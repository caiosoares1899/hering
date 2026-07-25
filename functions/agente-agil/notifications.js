// functions/agente-agil/notifications.js
//
// Réplica server-side do sistema de notificações do cliente (ver
// createNotif/parseMentions/notifAssigned/notifUnblocked/notifDone/
// notifChecklistDone em kanban-dev.html) — o Agente Ágil escreve direto via
// Admin SDK, então nunca passa pelo código de UI que dispara essas
// notificações no navegador. Sem isso, um comentário/edição feito pelo
// agente nunca notificava ninguém: nem @menções no texto, nem responsável,
// nem "card concluído" — mesmo que o card tivesse mudado exatamente do
// jeito que dispararia essas notificações se um humano tivesse feito a
// mesma edição pelo modal. Regra do time pra essa sprint: o agente nunca
// muda um card silenciosamente.
//
// Mantém o MESMO formato de notif e o MESMO esquema de idOverride
// determinístico do cliente pra @menções (mention_{cardId}_{uid}) — assim
// dedupe funciona igual: uma pessoa mencionada tanto no texto quanto na
// lista `notificar` do envelope só recebe UMA notificação, porque os dois
// caminhos calculam o mesmo id e o segundo vê que o primeiro já escreveu.
//
// Dono do path kanban/usuarios/{uid}/notificacoes — não é um path de
// /cards (board.js não precisa saber dele), mesmo espírito de
// independência que storage.js tem para os paths do Storage.

const { getMemberByHandle, getUidByInit } = require('./members');

const MENTION_RE = /@([a-zA-Z][a-zA-Z0-9._-]{1,40})/g;

function resolveHandleOrInit(members, token) {
  const byHandle = getMemberByHandle(members, token);
  if (byHandle) return byHandle;
  if (/^[A-Z]{2,3}$/.test(token)) {
    const uid = getUidByInit(members, token);
    if (uid) return members.find((m) => m.uid === uid) || null;
  }
  return null;
}

function extractMentionedMembers(text, members) {
  if (!text) return [];
  const found = [];
  const seen = new Set();
  let m;
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(text)) !== null) {
    const member = resolveHandleOrInit(members, m[1]);
    if (!member || seen.has(member.uid)) continue;
    seen.add(member.uid);
    found.push(member);
  }
  return found;
}

// idOverride dado -> só escreve se ainda não existir (mesmo mecanismo
// determinístico do createNotif do cliente, usado pra menções). Sem
// idOverride -> sempre escreve com id aleatório (mesmo comportamento do
// cliente pra assigned/unblocked/done/checklist — não dedupe entre saves,
// já que a idempotência do próprio envelope, via requestId em http.js, já
// evita reprocessar o MESMO pedido duas vezes).
async function buildNotifStep(db, { squadId, targetUid, type, title, sub, cardId, idOverride, dryRun }) {
  const notifId = idOverride || ('n' + Date.now() + Math.random().toString(36).slice(2, 6));
  const notif = { id: notifId, type, title, sub: sub || '', cardId, read: false, ts: new Date().toISOString(), squad: squadId };
  const path = `kanban/usuarios/${targetUid}/notificacoes/${notifId}`;
  if (dryRun) return { kind: 'noop', path, preview: notif };
  if (idOverride) {
    const existing = await db.ref(path).get();
    if (existing.exists()) return null; // já notificado — idempotência determinística
  }
  return { kind: 'update', path: `kanban/usuarios/${targetUid}/notificacoes`, data: { [notifId]: notif } };
}

async function buildMentionSteps(db, { squadId, text, members, cardId, dryRun }) {
  const mentioned = extractMentionedMembers(text, members);
  const steps = [];
  for (const member of mentioned) {
    const step = await buildNotifStep(db, {
      squadId,
      targetUid: member.uid,
      type: 'mention',
      title: '@' + member.init + ' — você foi mencionado',
      sub: text.substring(0, 80) + (text.length > 80 ? '…' : ''),
      cardId,
      idOverride: 'mention_' + cardId + '_' + member.uid,
      dryRun,
    });
    if (step) steps.push(step);
  }
  return steps;
}

// Lista explícita `notificar` do envelope — pessoas a avisar mesmo sem
// @menção no texto. Mesmo esquema de idOverride que @menção usa (mesmo id
// determinístico), então quem está nos dois lugares só recebe uma notif.
async function buildExplicitNotifySteps(db, { squadId, notificar, members, cardId, cardTitle, dryRun }) {
  if (!notificar || !notificar.length) return [];
  const steps = [];
  const seen = new Set();
  for (const token of notificar) {
    const member = resolveHandleOrInit(members, token);
    if (!member || seen.has(member.uid)) continue;
    seen.add(member.uid);
    const step = await buildNotifStep(db, {
      squadId,
      targetUid: member.uid,
      type: 'mention',
      title: '@' + member.init + ' — você foi marcado para acompanhar este card',
      sub: (cardTitle || '').substring(0, 60),
      cardId,
      idOverride: 'mention_' + cardId + '_' + member.uid,
      dryRun,
    });
    if (step) steps.push(step);
  }
  return steps;
}

function targetUidsForInits(members, inits) {
  const uids = [];
  const seen = new Set();
  (inits || []).filter(Boolean).forEach((init) => {
    const uid = getUidByInit(members, init);
    if (uid && !seen.has(uid)) {
      seen.add(uid);
      uids.push(uid);
    }
  });
  return uids;
}

// notifUnblocked/notifDone: notifica owner + participants.
async function buildOwnerParticipantNotifSteps(db, { squadId, card, members, type, title, cardId, dryRun }) {
  const inits = [card.owner, ...(card.participants || [])].filter(Boolean);
  const uids = targetUidsForInits(members, inits);
  const steps = [];
  for (const uid of uids) {
    const step = await buildNotifStep(db, { squadId, targetUid: uid, type, title, sub: (card.title || '').substring(0, 60), cardId, dryRun });
    if (step) steps.push(step);
  }
  return steps;
}

// notifChecklistDone/notifAssigned: notifica só o owner.
async function buildOwnerNotifStep(db, { squadId, card, members, type, title, cardId, dryRun }) {
  const uid = targetUidsForInits(members, [card.owner])[0];
  if (!uid) return null;
  return buildNotifStep(db, { squadId, targetUid: uid, type, title, sub: (card.title || '').substring(0, 60), cardId, dryRun });
}

module.exports = {
  extractMentionedMembers,
  buildNotifStep,
  buildMentionSteps,
  buildExplicitNotifySteps,
  buildOwnerParticipantNotifSteps,
  buildOwnerNotifStep,
  targetUidsForInits,
};
