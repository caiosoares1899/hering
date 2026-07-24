// functions/index.js
//
// Dispara um push (FCM) sempre que uma notificação nova é gravada em
// kanban/usuarios/{uid}/notificacoes/{notifId} — ou seja, sempre que o
// próprio app (kanban.html/painel.html) já cria uma notificação interna
// (card atribuído, menção, desbloqueio, etc.). Essa função só "empurra"
// pra fora o que o app já decidiu que era notificação; ela não decide
// SE algo é notificável, só SE deve virar um push.
//
// Respeita o modo Não Perturbe (kanban/usuarios/{uid}/notif_prefs/dnd) e
// limpa tokens de push que o Firebase reporta como inválidos/expirados.

const { onValueCreated } = require('firebase-functions/v2/database');
const { initializeApp } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const { getDatabase } = require('firebase-admin/database');

initializeApp();

// Tipos que INTERROMPEM (viram push). Os demais só ficam no sino, sem
// incomodar — ajuste essa lista conforme o time for testando o que faz
// sentido virar aviso externo (ex.: talvez "checklistDone" não precise).
const PUSH_TYPES = new Set(['assigned', 'mention', 'unblocked', 'risk', 'recorrente', 'painel_broadcast']);

exports.sendPushOnNotification = onValueCreated(
  {
    ref: '/kanban/usuarios/{uid}/notificacoes/{notifId}',
    region: 'us-central1', // ajuste se o seu Realtime Database estiver em outra região
  },
  async (event) => {
    const { uid } = event.params;
    const notif = event.data.val();
    if (!notif) return;

    // Tipos que não devem virar push (ex.: rascunho, só-painel) — mas continuam no sino normalmente
    if (notif.type && !PUSH_TYPES.has(notif.type)) return;

    const db = getDatabase();

    // Checa Não Perturbe
    const dndSnap = await db.ref(`kanban/usuarios/${uid}/notif_prefs/dnd`).get();
    const dnd = dndSnap.val();
    if (dnd?.on) {
      const stillActive = !dnd.until || new Date(dnd.until).getTime() > Date.now();
      if (stillActive) {
        console.log(`[push] ${uid} está em Não Perturbe — não enviando.`);
        return;
      }
    }

    // Busca os tokens de push registrados pra essa pessoa (pode ter mais de um aparelho)
    const tokensSnap = await db.ref(`kanban/usuarios/${uid}/fcm_tokens`).get();
    const tokensObj = tokensSnap.val();
    if (!tokensObj) return; // pessoa nunca ativou push em nenhum aparelho

    const tokenEntries = Object.entries(tokensObj); // [ [key, {token, ua, ...}], ... ]
    const tokens = tokenEntries.map(([, t]) => t.token).filter(Boolean);
    if (!tokens.length) return;

    const title = notif.title || 'Maré Digital';
    const body = notif.sub || '';

    // IMPORTANTE: manda só "data", sem o campo "notification". Quando os dois
    // vêm juntos, alguns navegadores (Safari/iOS em especial) já exibem a
    // notificação sozinhos automaticamente ANTES do nosso Service Worker
    // rodar — e aí o onBackgroundMessage mostra de novo, duplicando. Com
    // "data" puro, quem decide e mostra é sempre o nosso código, uma única vez.
    // Deep-link pro card específico, não só pro board — o Service Worker
    // (firebase-messaging-sw.js, notificationclick) já sabe navegar pra
    // event.notification.data.url quando a pessoa clica no push; só faltava
    // essa URL incluir o card. Sem isso, todo push (inclusive menção) abria
    // só o board, deixando a pessoa procurar o card na mão.
    const params = new URLSearchParams();
    if (notif.squad) params.set('squad', notif.squad);
    if (notif.cardId) params.set('card', notif.cardId);
    const qs = params.toString();
    const message = {
      data: {
        title,
        body,
        tag: String(notif.type || 'geral') + '_' + String(notif.cardId || ''),
        cardId: String(notif.cardId || ''),
        url: qs ? `/kanban.html?${qs}` : '/kanban.html',
      },
      tokens,
    };

    const resp = await getMessaging().sendEachForMulticast(message);
    console.log(`[push] ${uid}: ${resp.successCount} ok, ${resp.failureCount} falhas`);

    // Remove tokens mortos (desinstalou, revogou permissão, etc.) pra não
    // ficar tentando pra sempre em vão
    const deletions = [];
    resp.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code || '';
        if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
          const [key] = tokenEntries[i];
          deletions.push(db.ref(`kanban/usuarios/${uid}/fcm_tokens/${key}`).remove());
        }
      }
    });
    if (deletions.length) await Promise.all(deletions);
  }
);

// Agente Ágil — orquestrador entre o board e agentes especialistas externos
// (hoje: Databricks). Deploy isolado: firebase deploy --only functions:agenteAgil
exports.agenteAgil = require('./agente-agil/http').agenteAgil;
