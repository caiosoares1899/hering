// functions/okr/pushMural.js
//
// 📢 Push do aviso novo do Mural do OKR. O aviso NÃO gera uma notificação por pessoa (é 1 evento no feed da torre,
// kanban/notif_feed/{id}, sem fan-out — ver mare-notif.js); então o push também parte desse evento: quando um evento tipo 'mural'
// é criado, procura quem deve recebê-lo e manda 1 push por pessoa (todos os aparelhos dela).
//
// Quem recebe: mesma regra do sino (paraMim() em mare-notif.js) — ADM, torre ⭐ Geral e quem é da torre alvo (sem o campo `torre` =
// Digital); aviso "todas as torres" ('*' ou lista vazia) vai pra todo mundo. Nunca pro próprio autor. Respeita o Não Perturbe
// (kanban/usuarios/{uid}/notif_prefs/dnd) e só considera quem ativou push em algum aparelho (kanban/usuarios/{uid}/fcm_tokens).
// Só tipo 'mural': "Objetivo criado"/"Marco concluído" ficam só no sino (seriam muito barulho).
//
// Quem existe é lido de kanban/usuarios_publicos (diretório magro) — ler kanban/usuarios inteiro traria as notificações e os
// tokens de todo mundo pra memória por causa de 1 aviso.

const { SITE_BASE_URL } = require('../common/pushUrl');
const { emailDaEmpresa, MARE_SO_HERING, TORRES_ATIVAS } = require('../common/mareModo');

const DEFAULT_ADM_EMAILS = ['caio.soares@ciahering.com.br', 'rafael.passos@ciahering.com.br'];

// O feed do sino só é legível pela empresa (e visualizadores) — o push não pode furar isso: freelancer/parceiro com push ativo (a conta existe em
// usuarios_publicos e pode ter token) NÃO recebe o texto de um aviso interno do OKR. Mesmo critério do domínio de confiança do app.
// Modo "só Hering" (common/mareModo.js): só @ciahering.com.br; com o interruptor desligado volta a valer @arezzo.com.br também.
const empresa = emailDaEmpresa;

function alvoTorres(ev) {
  const t = ev && ev.torres;
  const arr = Array.isArray(t) ? t : t && typeof t === 'object' ? Object.values(t) : [];
  if (!arr.length || arr.includes('*')) return ['*'];
  return arr;
}

function dndAtivo(dnd, agora) {
  if (!dnd || !dnd.on) return false;
  return !dnd.until || new Date(dnd.until).getTime() > agora;
}

// Decide se UMA pessoa recebe o push (pura, pra teste).
function deveReceber({ ev, uid, torre, ehAdm, agora }) {
  if (!ev || ev.tipo !== 'mural') return false;
  if (uid === ev.autorUid) return false;
  const alvo = alvoTorres(ev);
  // Modo "só Hering": existe uma torre só, então a flag antiga da pessoa (comercial/corporativa, que continua gravada) não conta — todo mundo é Digital (menos a ⭐ Geral).
  if (MARE_SO_HERING && torre !== 'geral') torre = 'digital';
  // Modo "só Hering": aviso dirigido SÓ a outra torre (ex.: ['comercial']) não vai pra ninguém, nem pro ADM.
  if (MARE_SO_HERING && !alvo.includes('*') && !alvo.some((t) => TORRES_ATIVAS.includes(t))) return false;
  if (ehAdm || torre === 'geral' || alvo.includes('*')) return true;
  return alvo.includes(torre || 'digital');
}

async function runPushMural(db, messaging, ev, { agora = Date.now(), log = console.log } = {}) {
  if (!ev || ev.tipo !== 'mural') { log('[push-mural] evento não é "mural", ignorando.'); return { enviados: 0, alvos: 0 }; }
  const [pubSnap, admSnap] = await Promise.all([db.ref('kanban/usuarios_publicos').get(), db.ref('kanban/config/adm_emails').get()]);
  const admEmails = (Array.isArray(admSnap.val()) ? admSnap.val() : DEFAULT_ADM_EMAILS).map((e) => String(e).toLowerCase());
  const uids = Object.keys(pubSnap.val() || {}).filter((u) => u !== ev.autorUid);

  const title = String(ev.titulo || 'Aviso no Mural do OKR');
  const body = String(ev.sub || '');
  const url = SITE_BASE_URL + 'okr.html' + (ev.muralId ? '?mural=' + encodeURIComponent(ev.muralId) : '');
  let enviados = 0, alvos = 0;

  await Promise.all(uids.map(async (uid) => {
    try {
      const tokSnap = await db.ref(`kanban/usuarios/${uid}/fcm_tokens`).get();
      const tokObj = tokSnap.val();
      if (!tokObj) return;                                           // nunca ativou push
      const entries = Object.entries(tokObj).filter(([, t]) => t && t.token);
      if (!entries.length) return;
      const [dndSnap, torreSnap, emailSnap] = await Promise.all([
        db.ref(`kanban/usuarios/${uid}/notif_prefs/dnd`).get(),
        db.ref(`kanban/usuarios/${uid}/torre`).get(),
        db.ref(`kanban/usuarios/${uid}/email`).get(),
      ]);
      if (dndAtivo(dndSnap.val(), agora)) return;
      const emailU = String(emailSnap.val() || '').toLowerCase();
      const ehAdm = admEmails.includes(emailU);
      if (!ehAdm && !empresa(emailU)) return;                         // conta de fora da empresa: sem push do Mural
      if (!deveReceber({ ev, uid, torre: torreSnap.val(), ehAdm, agora })) return;
      alvos++;
      // Só "data" (sem "notification"): quem mostra é o Service Worker, 1 vez — ver comentário em index.js
      const resp = await messaging.sendEachForMulticast({
        data: { title, body, tag: 'mural_' + String(ev.muralId || ev.id || ''), cardId: '', url },
        tokens: entries.map(([, t]) => t.token),
      });
      enviados += resp.successCount || 0;
      const mortos = [];
      resp.responses.forEach((r, i) => {
        const code = (r.error && r.error.code) || '';
        if (!r.success && (code.includes('registration-token-not-registered') || code.includes('invalid-argument'))) mortos.push(db.ref(`kanban/usuarios/${uid}/fcm_tokens/${entries[i][0]}`).remove());
      });
      if (mortos.length) await Promise.all(mortos);
    } catch (e) { log(`[push-mural] ${uid}: falha (${e && e.message}), seguindo com os demais.`); }
  }));
  log(`[push-mural] aviso ${ev.muralId || ev.id}: ${alvos} pessoa(s) alvo, ${enviados} push(es) entregue(s).`);
  return { enviados, alvos };
}

// Gatilho: evento novo em kanban/notif_feed. Deploy isolado: firebase deploy --only functions:sendPushOnMural
function criaTrigger() {
  const { onValueCreated } = require('firebase-functions/v2/database');
  const { getMessaging } = require('firebase-admin/messaging');
  const { getDatabase } = require('firebase-admin/database');
  return onValueCreated({ ref: '/kanban/notif_feed/{id}', region: 'us-central1' }, async (event) => {
    const ev = event.data.val();
    if (!ev || ev.tipo !== 'mural') return;
    await runPushMural(getDatabase(), getMessaging(), { ...ev, id: ev.id || event.params.id });
  });
}

module.exports = { runPushMural, deveReceber, alvoTorres, dndAtivo, empresa, criaTrigger };
