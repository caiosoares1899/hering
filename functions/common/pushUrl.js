// functions/common/pushUrl.js
//
// Pra onde o clique no push leva. URL COMPLETA (esquema+domínio) — o Web Push do iOS erra URL relativa dentro do Service Worker
// (ver comentário em index.js/sendPushOnNotification). Notificações do OKR (okr_*) levam à página do OKR, não ao kanban.

const SITE_BASE_URL = 'https://caiosoares1899.github.io/hering/';

// notif = kanban/usuarios/{uid}/notificacoes/{id}
function urlDoPush(notif) {
  const n = notif || {};
  const type = String(n.type || '');
  if (type.startsWith('okr_')) {
    // Reunião/evento do calendário do OKR (aviso de véspera/dia, convite, mudança, menção nas anotações): abre direto o evento, igual ao clique no sino.
    if (n.okrEventoId) return SITE_BASE_URL + 'okr.html?evento=' + encodeURIComponent(String(n.okrEventoId)) + (n.okrEventoData ? '&data=' + encodeURIComponent(String(n.okrEventoData)) : '');
    const alvo = type === 'okr_agente' ? 'chat' : type === 'okr_mencao' ? 'notas' : String(n.okrObjId || '');
    return SITE_BASE_URL + 'okr.html' + (alvo ? '?okr=' + encodeURIComponent(alvo) : '');
  }
  const params = new URLSearchParams();
  if (n.squad) params.set('squad', n.squad);
  if (n.cardId) params.set('card', n.cardId);
  const qs = params.toString();
  return SITE_BASE_URL + 'kanban.html' + (qs ? '?' + qs : '');
}

// Tag do push (mesma tag = o novo substitui o anterior). Notificações do OKR sem card usam o id da própria notificação, senão duas
// menções seguidas se substituiriam ("okr_mencao_" igual) e a primeira sumiria sem ter sido vista.
function tagDoPush(notif, notifId) {
  const n = notif || {};
  const type = String(n.type || 'geral');
  if (type.startsWith('okr_')) return type + '_' + String(n.cardId || notifId || '');
  return type + '_' + String(n.cardId || '');
}

module.exports = { SITE_BASE_URL, urlDoPush, tagDoPush };
