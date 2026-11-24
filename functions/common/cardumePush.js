// functions/common/cardumePush.js
//
// 🐟 Cardume — prova de origem do push de menção (docs/ideias/cardume-v0-banco.md › Etapa 4).
// As notificações (kanban/usuarios/{uid}/notificacoes) são legíveis por toda a Hering e a regra delas aceita qualquer tipo,
// então uma notificação `cardume_mencao` sozinha NÃO prova nada. Só vira push se existir o registro privado
// kanban/cardume/mencoes/{uid}/{cardumeRef} (que as regras só deixam criar a partir de uma mensagem real, entre membros do canal)
// e se esse registro apontar para ESTA notificação (`n === notifId`) — copiar um cardumeRef real para uma notificação falsa não basta.

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

// rec = valor de kanban/cardume/mencoes/{uid}/{cardumeRef} (ou null)
function mencaoConfere(notif, notifId, rec) {
  if (!notif || notif.type !== 'cardume_mencao') return false;
  if (!ID_RE.test(String(notif.cardumeRef || '')) || !ID_RE.test(String(notifId || ''))) return false;
  return !!rec && typeof rec === 'object' && rec.n === String(notifId) && ID_RE.test(String(rec.c || '')) && ID_RE.test(String(rec.m || ''));
}

// Lê o registro com o Admin SDK e confere. Devolve true/false (nunca lança: na dúvida, não manda push).
async function mencaoValida(db, uid, notif, notifId) {
  try {
    if (!ID_RE.test(String(uid || '')) || !notif || !ID_RE.test(String(notif.cardumeRef || ''))) return false;
    const snap = await db.ref(`kanban/cardume/mencoes/${uid}/${notif.cardumeRef}`).get();
    return mencaoConfere(notif, notifId, snap.val());
  } catch (e) { return false; }
}

module.exports = { mencaoConfere, mencaoValida };
