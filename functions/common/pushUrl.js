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

// Tag do push (mesma tag = o novo substitui o anterior, no aparelho). Card conhecido → a tag é do card (várias mudanças no mesmo card se
// substituem, de propósito). SEM card (reunião, mensagem de feedback, entrada do intake, comunicado do Painel, Estrela do Mar, tudo do OKR…)
// a tag leva o id da própria notificação: antes só o OKR fazia isso, e dois avisos seguidos de qualquer outro tipo sem card ("Reunião em 10 min"
// de duas reuniões na mesma hora, dois feedbacks, dois itens no intake) tinham a MESMA tag — o 2º push apagava o 1º sem ninguém ter visto.
function tagDoPush(notif, notifId) {
  const n = notif || {};
  const type = String(n.type || 'geral');
  if (n.cardId) return type + '_' + String(n.cardId);
  return type + '_' + String(notifId || '');
}

module.exports = { SITE_BASE_URL, urlDoPush, tagDoPush };
