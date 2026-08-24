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
const PUSH_TYPES = new Set(['assigned', 'mention', 'unblocked', 'risk', 'recorrente', 'painel_broadcast', 'intake']);

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
    // URL COMPLETA (com esquema+domínio), não relativa: a primeira versão
    // desse fix usava "kanban.html" relativo (confiando que o Service Worker
    // resolve a partir de self.location, que fica em /hering/) — funcionava
    // no desktop, mas usuárias em iOS continuaram vendo 404 SEM o /hering/
    // (achado numa validação real: link chegou como
    // caiosoares1899.github.io/kanban.html?..., faltando o /hering/). O Web
    // Push do iOS tem histórico de bugs resolvendo URL relativa dentro do
    // Service Worker — uma URL já totalmente qualificada não depende de
    // NENHUMA resolução do navegador, elimina essa classe de bug inteira.
    const SITE_BASE_URL = 'https://caiosoares1899.github.io/hering/';
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
        url: qs ? `${SITE_BASE_URL}kanban.html?${qs}` : `${SITE_BASE_URL}kanban.html`,
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

// Spotify "ouvindo agora" — callback do OAuth (troca code por token, ver
// functions/spotify/oauth.js). Deploy isolado: firebase deploy --only functions:spotifyOauthCallback
exports.spotifyOauthCallback = require('./spotify/oauth').spotifyOauthCallback;

// Spotify — desconecta (apaga token + status público, ver
// functions/spotify/disconnect.js). Deploy isolado: firebase deploy --only functions:spotifyDisconnect
exports.spotifyDisconnect = require('./spotify/disconnect').spotifyDisconnect;

// Spotify — sync agendado do "ouvindo agora" (a cada minuto, ver
// functions/spotify/sync.js) — PAUSADO (2026-08-04): era a única function
// agendada de todo o projeto (roda 24h/dia, sempre, mesmo sem ninguém
// conectado — as outras só custam quando alguém de fato usa) e o custo
// ficou acima do esperado. Painel do Spotify também escondido no board
// (kanban.html/kanban-dev.html, ver #spotify-tab) — sem o sync alimentando
// dado fresco, mostrar o painel só exibiria presença desatualizada.
// Pra religar (depois de uma análise de custo — ex.: cadência maior que
// 30s, ou só rodar quando tiver alguém conectado): descomenta a linha
// abaixo + o botão #spotify-tab no HTML, e roda
// `firebase deploy --only functions:spotifySync`.
// exports.spotifySync = require('./spotify/sync').spotifySync;

// Spotify — sync sob demanda de 1 pessoa só (disparado ao abrir o painel,
// ver functions/spotify/syncNow.js). Deploy isolado: firebase deploy --only functions:spotifySyncNow
exports.spotifySyncNow = require('./spotify/syncNow').spotifySyncNow;

// Spotify — controle de playback PESSOAL (play/pause/próxima, ver
// functions/spotify/playback.js). Deploy isolado: firebase deploy --only functions:spotifyPlayback
exports.spotifyPlayback = require('./spotify/playback').spotifyPlayback;

// Rádio do Maré — playlist colaborativa (ver functions/spotify/radio*.js).
// Callback de conexão da conta DONA das playlists — manual, uma vez só
// (não é o fluxo por-pessoa de spotifyOauthCallback). Deploy isolado:
// firebase deploy --only functions:spotifyRadioOwnerCallback
exports.spotifyRadioOwnerCallback = require('./spotify/radioOwnerCallback').spotifyRadioOwnerCallback;

// Busca de faixas pra sugerir (token app-only, não depende da conta
// dona). Deploy isolado: firebase deploy --only functions:spotifyRadioSearch
exports.spotifyRadioSearch = require('./spotify/radioSearch').spotifyRadioSearch;

// Adiciona a faixa sugerida na playlist (token da conta dona). Deploy
// isolado: firebase deploy --only functions:spotifyRadioSuggest
exports.spotifyRadioSuggest = require('./spotify/radioSuggest').spotifyRadioSuggest;

// Formulário de intake por squad — único ponto de escrita anônima
// (sem login) permitido no sistema, ver functions/intake/submit.js pro
// porquê de gravar em intake_pending em vez de /cards direto. Deploy
// isolado: firebase deploy --only functions:intakeSubmit
exports.intakeSubmit = require('./intake/submit').intakeSubmit;

// Backup semanal automático de cada squad pro Cloud Storage (ver
// functions/backup/weeklyBackup.js) — roda sozinho, sem depender de
// ninguém abrir o board. Deploy isolado: firebase deploy --only functions:weeklyBackup
exports.weeklyBackup = require('./backup/weeklyBackup').weeklyBackup;

// Agente Ágil Orquestrador — @menção v1 (item 3/4 do plano de acionamento
// sem supervisão direta, ver functions/agente-agil-orquestrador/README.md).
// Dispara quando um comentário novo em kanban/squads/dev/dados/
// card_comments/{cardId} menciona "@Agente Ágil" (detectaMencao.js).
// ESCRITA REAL desde 2026-08-18 (decisão explícita do usuário, ver
// mentionTrigger.js:DRY_RUN_MENCAO) — antes rodou em modo sombra
// (dryRun fixo em true, só observa/loga) até o mecanismo de gatilho ser
// validado rodando de verdade. Squad "dev" travado no próprio path do
// trigger, não checagem em runtime. Requer o secret ANTHROPIC_API_KEY
// (`firebase functions:secrets:set ANTHROPIC_API_KEY` antes do primeiro
// deploy). Deploy isolado:
// firebase deploy --only functions:agenteAgilMencao
exports.agenteAgilMencao = require('./agente-agil-orquestrador/mentionTrigger').agenteAgilMencao;

// Agente Ágil Orquestrador — squad `dados` — ATIVADO, escrita real
// (2026-08-24). Mesma fábrica createMentionTrigger() da instância `dev`
// acima (ver mentionTrigger.js) — deployado em modo sombra em 2026-08-23,
// validado em produção com logs reais, e virou dryRun:false em 2026-08-24
// (mesmo critério do squad dev: mecanismo de gatilho validado primeiro,
// escrita real como decisão separada depois). Deploy isolado:
// firebase deploy --only functions:agenteAgilMencaoDados
// (reusa o mesmo secret ANTHROPIC_API_KEY já configurado pro squad dev,
// não precisa configurar de novo).
exports.agenteAgilMencaoDados = require('./agente-agil-orquestrador/mentionTrigger').agenteAgilMencaoDados;

// Agente Ágil Orquestrador — item 5 do roadmap ("gatilho automático em
// mudança de card"), v1 (2026-08-24). Achado que motivou: os gatilhos
// "ambientais" das Automações (due_today/due_overdue/wip_exceeded/aging)
// são 100% client-side — só avaliam se alguém tiver o board aberto. Este
// scan roda 1x/dia (Cloud Scheduler, sem depender de ninguém abrir a
// página) e cobre só due_overdue, só squad dev — ver comentário no topo de
// dueOverdueTrigger.js pro desenho completo. Reusa a MESMA rota da @menção
// (escreve o comentário, agenteAgilMencao processa) — zero caminho novo de
// invocação do agente. Só age se o ADM já tiver configurado uma Automação
// "Notificar Agente Ágil" com o gatilho "Card atrasado (1º dia)" nesse
// squad — opt-in, não liga sozinho pra ninguém. Deploy isolado:
// firebase deploy --only functions:agenteAgilDueOverdueScan
exports.agenteAgilDueOverdueScan = require('./agente-agil-orquestrador/dueOverdueTrigger').agenteAgilDueOverdueScan;
