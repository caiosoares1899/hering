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
const { urlDoPush, tagDoPush } = require('./common/pushUrl');
const { lerConfigTipo, pushPermitido } = require('./common/notifConfig');
const { tokenMorto, resumirFalhas, falhaGeral } = require('./common/pushTokens');

initializeApp();

// Tipos que INTERROMPEM (viram push). Os demais só ficam no sino, sem
// incomodar — ajuste essa lista conforme o time for testando o que faz
// sentido virar aviso externo (ex.: talvez "checklistDone" não precise).
const PUSH_TYPES = new Set(['assigned', 'mention', 'unblocked', 'risk', 'recorrente', 'painel_broadcast', 'intake', 'okr_editado', 'okr_prazo', 'okr_reuniao', 'okr_agente', 'okr_mencao', 'feedback', 'reuniao', 'due_today', 'due_overdue', 'meta_lembrete', 'escala', 'backup_falhou', 'vtex_incidente', 'vtex_monitor_falhou', 'github_incidente', 'github_monitor_falhou', 'firebase_incidente', 'firebase_monitor_falhou']);

exports.sendPushOnNotification = onValueCreated(
  {
    ref: '/kanban/usuarios/{uid}/notificacoes/{notifId}',
    region: 'us-central1', // ajuste se o seu Realtime Database estiver em outra região
  },
  async (event) => {
    const { uid } = event.params;
    const notif = event.data.val();
    // Achado real (/monitorarbugs 2026-09-18, sessão de debug ao vivo com o
    // usuário): TODOS os returns abaixo eram silenciosos — sem log nenhum —
    // o que tornou impossível saber ONDE a função estava parando quando um
    // push esperado não chegava (rodada inteira de testes/logs gastos só
    // pra descobrir isso). Cada saída agora loga o motivo.
    if (!notif) { console.log(`[push] ${uid}: evento sem dado (notif null), ignorando.`); return; }

    const db = getDatabase();

    // Tipos que não devem virar push (ex.: rascunho, só-painel) — mas continuam no sino normalmente.
    // 🔔 Central de Notificações do Painel: o ADM liga/desliga o push POR TIPO em kanban/notif_config/{tipo}.push —
    // `false` bloqueia mesmo um tipo do PUSH_TYPES, `true` libera mesmo um de fora; sem config vale o PUSH_TYPES.
    if (notif.type) {
      const cfg = await lerConfigTipo(db, notif.type);
      if (!pushPermitido(cfg, PUSH_TYPES.has(notif.type))) {
        console.log(`[push] ${uid}: tipo '${notif.type}' ${typeof cfg.push === 'boolean' ? 'desligado pelo ADM na Central de Notificações' : 'fora de PUSH_TYPES'}, não enviando.`);
        return;
      }
    }

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
    if (!tokensObj) { console.log(`[push] ${uid}: sem fcm_tokens cadastrado, não enviando.`); return; } // pessoa nunca ativou push em nenhum aparelho

    const tokenEntries = Object.entries(tokensObj); // [ [key, {token, ua, ...}], ... ]
    const tokens = tokenEntries.map(([, t]) => t.token).filter(Boolean);
    if (!tokens.length) { console.log(`[push] ${uid}: fcm_tokens existe mas sem token válido (${tokenEntries.length} entradas), não enviando.`); return; }

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
    // Notificações do OKR (okr_*) levam à página do OKR (okr.html), as demais ao kanban — ver common/pushUrl.js.
    const message = {
      data: {
        title,
        body,
        tag: tagDoPush(notif, event.params.notifId),
        cardId: String(notif.cardId || ''),
        url: urlDoPush(notif),
      },
      tokens,
    };

    const resp = await getMessaging().sendEachForMulticast(message);
    console.log(`[push] ${uid}: ${resp.successCount} ok, ${resp.failureCount} falhas`);
    // POR QUE falhou (antes só a contagem ia pro log — sem o código não dava pra saber se eram tokens mortos, payload recusado ou credencial).
    if (resp.failureCount) {
      const motivos = resumirFalhas(resp.responses);
      console.log(`[push] ${uid}: motivos das falhas (tipo '${notif.type}'): ${JSON.stringify(motivos)}`);
      if (falhaGeral(resp.responses)) console.error(`[push] ${uid}: o FCM recusou TODOS os tokens por motivo que NÃO é token morto — mensagem/credencial/projeto, não apagando nada. ${JSON.stringify(motivos)}`);
    }

    // Remove só tokens que o FCM diz estarem mortos (desinstalou, revogou permissão, etc.) — `invalid-argument` de PAYLOAD não apaga nada
    // (ver common/pushTokens.js: uma mensagem malformada apagava os tokens de todo mundo).
    const deletions = [];
    resp.responses.forEach((r, i) => {
      if (!r.success && tokenMorto(r.error)) {
        const [key] = tokenEntries[i];
        deletions.push(db.ref(`kanban/usuarios/${uid}/fcm_tokens/${key}`).remove());
      }
    });
    if (deletions.length) await Promise.all(deletions);
  }
);

// 📢 Push do aviso novo do Mural do OKR — o aviso é 1 evento em kanban/notif_feed (sem notificação por pessoa), então o push parte dele
// (ver functions/okr/pushMural.js). Mesma regra de quem vê do sino (torre/ADM/Geral), respeita o Não Perturbe.
// Deploy isolado: firebase deploy --only functions:sendPushOnMural
exports.sendPushOnMural = require('./okr/pushMural').criaTrigger();

// 💬 Contagem de comentários por card (kanban/squads/{squad}/dados/card_comments_count/{cardId}) —
// alimenta o indicador de comentário na face do card (ver functions/comentarios/contagem.js).
// Cobre TODO escritor de comentário (humano, Agente Ágil, importação). Um único gatilho pra todos os
// squads: só conta (1 leitura pequena por comentário), diferente dos gatilhos do orquestrador, que
// são por squad por causa de custo de chamada ao modelo.
// Deploy isolado: firebase deploy --only functions:contarComentarios
exports.contarComentarios = require('./comentarios/contagem').contarComentarios;

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

// Backup COMPLETO (2026-10-13, ver functions/backup/completo.js): o weeklyBackup acima só guarda o quadro de
// cada squad — este guarda TUDO (comentários, config, intake, OKR, Metas, Escala, usuários…) em
// backups-completos/ (sem leitura pelo cliente). Semanal = tudo; diário = só os nós globais pequenos.
// Restaurar: functions/backup/restaurar.js (na sua máquina). Deploy isolado:
//   firebase deploy --only functions:backupCompletoSemanal,functions:backupGlobalDiario
exports.backupCompletoSemanal = require('./backup/completo').backupCompletoSemanal;
exports.backupGlobalDiario = require('./backup/completo').backupGlobalDiario;
// O VIGIA dos backups (functions/backup/vigia.js): todo dia 09:00 confere o RESULTADO no Storage (completo diário/semanal e o quadro de cada
// squad) e avisa os ADMs (sino + push, tipo `backup_falhou`) se algo faltou ou deu erro. Deploy isolado:
//   firebase deploy --only functions:backupVigia,functions:sendPushOnNotification   (o 2º por causa do novo tipo no PUSH_TYPES)
exports.backupVigia = require('./backup/vigia').backupVigia;

// API da tela "🛟 Backup completo (nuvem)" do Maré (Config → Backup): lista/compara/restaura SÓ o que sumiu (comentários, config, intake, subtimes,
// kudos) a partir do backup completo — HTTP + Bearer idToken, só ADM/PO/Organizador do squad (functions/backup/restaurarApi.js). Deploy isolado:
//   firebase deploy --only functions:backupCompletoApi
exports.backupCompletoApi = require('./backup/restaurarApi').backupCompletoApi;

// 🎯 OKR — scan diário (prazo de marco chegando, período de editar, véspera
// de reunião — ver functions/okr/dailyScan.js). Roda sozinho, sem depender
// de ninguém abrir o painel. Lê kanban/painel/config/gcal_cache (mesmo
// cache que painel.html já mantém) pra período/reunião — zero chamada nova
// à API do Google. Deploy isolado: firebase deploy --only functions:okrDailyScan
exports.okrDailyScan = require('./okr/dailyScan').okrDailyScan;

// 🐟 Metas e desafios — lembretes de preenchimento ("O mar tá pra peixe", ver functions/metas/lembretes.js): agendada a cada 15 min, no horário de
// Brasília; cada meta configura o próprio lembrete (a cada 1–4 h, 1× por dia ou horários exatos). Escreve notificações do tipo `meta_lembrete`
// (que também é push — PUSH_TYPES acima). Deploy isolado: firebase deploy --only functions:metasLembretes
// (e, junto, sendPushOnNotification — ela precisa conhecer o tipo novo — e `firebase deploy --only database` pras regras das metas).
exports.metasLembretes = require('./metas/lembretes').metasLembretes;

// 🚨 Alerta de incidente da VTEX (functions/vtex/statusVtex.js): a cada 5 min lê https://status.vtex.com/feed.rss e, com incidente/manutenção em
// andamento, publica sozinho um Comunicado 🚨 (popup insistente, todos) + notificação `vtex_incidente` (sino + push, PUSH_TYPES acima) pra todo mundo;
// resolvido/concluído → desativa o aviso. Interruptor: kanban/config/vtex_status_off=true. Deploy isolado:
//   firebase deploy --only functions:vtexStatus,functions:sendPushOnNotification   (o 2º por causa do tipo novo no PUSH_TYPES)
exports.vtexStatus = require('./vtex/statusVtex').vtexStatus;

// 🐙 Status do GitHub & GitHub Pages (functions/github/statusGithub.js): a cada 5 min lê https://www.githubstatus.com/api/v2/summary.json,
// atualiza `kanban/github_saude` (exibido na aba 🔋 Status do Painel) e, quando abre incidente ou degradação no GitHub Pages, aciona SOMENTE
// os ADMs via sino + push (`github_incidente`, PUSH_TYPES acima) — nunca cria Comunicado global para todos os usuários. Interruptor:
// kanban/config/github_status_off=true. Deploy isolado:
//   firebase deploy --only functions:githubStatus,functions:sendPushOnNotification
exports.githubStatus = require('./github/statusGithub').githubStatus;

// 🔥 Status do Firebase — Serviços que usamos (functions/firebase/statusFirebase.js): a cada 5 min lê https://status.firebase.google.com/incidents.json,
// filtra SOMENTE os 6 serviços que o ecossistema Maré/Oceano usa (Realtime Database, Authentication, Cloud Messaging, Cloud Functions,
// Cloud Storage e Hosting), atualiza `kanban/firebase_saude` e aciona SOMENTE os ADMs via sino + push (`firebase_incidente`, PUSH_TYPES acima).
// Interruptor: kanban/config/firebase_status_off=true. Deploy isolado:
//   firebase deploy --only functions:firebaseStatus,functions:sendPushOnNotification
exports.firebaseStatus = require('./firebase/statusFirebase').firebaseStatus;

// 🎯 OKR — Fase 3: snapshot semanal (toda sexta 17h, ver
// functions/okr/weeklySnapshot.js). NÃO notifica ninguém — só grava uma
// foto do status/progresso de cada Objetivo ativo em
// kanban/okr/snapshots/{data}, pra permitir comparar semana a semana mais
// pra frente. Deploy isolado: firebase deploy --only functions:okrWeeklySnapshot
exports.okrWeeklySnapshot = require('./okr/weeklySnapshot').okrWeeklySnapshot;

// 🎯 OKR — chat dedicado com o Agente Ágil (ver functions/okr/agenteChat.js).
// Central geral (não presa a um Objetivo), escreve direto nos campos via
// ferramentas (functions/okr/agenteTools.js) — MODO SOMBRA no 1º deploy
// (DRY_RUN_OKR_CHAT=true no próprio arquivo: valida o mecanismo antes de
// destravar escrita real, mesma disciplina do mentionTrigger.js pra squad
// `dados`). Deploy isolado: firebase deploy --only functions:okrAgenteChat
exports.okrAgenteChat = require('./okr/agenteChat').okrAgenteChat;

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
// mudança de card"), 2026-08-24. Achado que motivou: os gatilhos
// "ambientais" das Automações (due_today/due_overdue/wip_exceeded/aging)
// são 100% client-side — só avaliam se alguém tiver o board aberto. Este
// scan roda 1x/dia (Cloud Scheduler, sem depender de ninguém abrir a
// página) e cobre due_today + due_overdue nos squads dev e dados (dados
// adicionado 2026-08-25) — decisão explícita do usuário de deixar
// wip_exceeded/aging de fora ("só precisa esse mesmo"). Nome ficou de
// quando cobria só due_overdue (v1) e só squad dev; não renomeado ao
// adicionar due_today/squad dados pra não exigir apagar a function
// antiga — ver comentário no topo de dueOverdueTrigger.js pro desenho
// completo. Reusa a MESMA rota da @menção (escreve o comentário,
// agenteAgilMencao processa) — zero caminho novo de invocação do agente.
// Só age se o ADM já tiver configurado uma Automação "Notificar Agente
// Ágil" com o gatilho correspondente ("Card vence hoje"/"Card atrasado
// (1º dia)") nesse squad — opt-in, não liga sozinho pra ninguém. Deploy
// isolado: firebase deploy --only functions:agenteAgilDueOverdueScan
exports.agenteAgilDueOverdueScan = require('./agente-agil-orquestrador/dueOverdueTrigger').agenteAgilDueOverdueScan;

// "🤖 Resumo do Agente Ágil" dentro de "Meu Dia" (kanban.html/kanban-dev.html),
// 2026-08-25 — pedido direto do usuário. Sob demanda (só quando a pessoa
// clica), pessoal, cross-squad (dev + dados, mesmo escopo de
// AGENTE_AGIL_MENTION_SQUADS no client) — NÃO escreve nada no board, só lê
// os cards ativos da pessoa e devolve um resumo priorizado (ver comentário
// completo no topo de resumoMeuDia.js pro desenho: onRequest + Bearer
// idToken, mesmo padrão de spotify/disconnect.js; kill switch dinâmico
// respeitado; rate limit de 2min por pessoa; sem cards pendentes não chama
// o LLM). Deploy isolado: firebase deploy --only functions:agenteAgilResumoMeuDia
exports.agenteAgilResumoMeuDia = require('./agente-agil-orquestrador/resumoMeuDia').agenteAgilResumoMeuDia;

// Agente Ágil Orquestrador — intake de especialista externo, squad `dev`,
// 2026-08-27. Correção de arquitetura pedida direto pelo usuário:
// especialistas externos (hoje: Databricks) PARARAM de escrever direto no
// board via agente-agil/http.js — agora só mandam informação (texto livre),
// que http.js enfileira em agente_intake_pending, e É ESTE gatilho quem
// decide o que fazer (comentar, mover, tagear, mencionar um humano, ou
// criar um card novo via criar_card — ver intakeTrigger.js pro desenho
// completo). ESCRITA REAL desde 2026-08-27 (decisão explícita do usuário,
// mesma pergunta direta feita pra @menção em 2026-08-18) — rodou em modo
// sombra do 1º deploy até essa decisão, validado com 4 canários simulados
// diretos no Firebase real (card existente, sem card com trava de
// segurança recusando, sem card completando de verdade). Requer o mesmo
// secret ANTHROPIC_API_KEY já configurado pras outras functions deste
// módulo.
// Deploy isolado: firebase deploy --only functions:agenteAgilIntake
exports.agenteAgilIntake = require('./agente-agil-orquestrador/intakeTrigger').agenteAgilIntake;

// "🤖 Ponto de vista do Agente Ágil" dentro dos painéis "Dados do Board"
// (Insights) e "Controle de Criativos" (kanban.html/kanban-dev.html),
// 2026-09-01 — pedido direto do usuário. Sob demanda (só quando a pessoa
// clica), mesmo escopo de squad que resumoMeuDia.js (dev + dados, via
// ANALISE_DADOS_SQUADS em squadScope.js) — NÃO escreve nada no board, só
// recebe o resumo agregado que o painel já calculou client-side e devolve
// um ponto de vista priorizado (ver comentário completo no topo de
// analiseDados.js pro desenho: onRequest + Bearer idToken, mesmo padrão de
// resumoMeuDia.js; kill switch dinâmico respeitado; rate limit de 2min por
// pessoa; um endpoint só, contexto escolhe o system prompt certo).
// Deploy isolado: firebase deploy --only functions:agenteAgilAnaliseDados
exports.agenteAgilAnaliseDados = require('./agente-agil-orquestrador/analiseDados').agenteAgilAnaliseDados;

// "🤖 Análise do board (PO)" dentro de "Meu Dia" (kanban.html/
// kanban-dev.html), 2026-09-01 — pedido direto do usuário, botão visível
// só pra PO/Organizador/ADM. Diferente de agenteAgilAnaliseDados: lê os
// cards/campanhas direto via Admin SDK (não recebe resumo pronto do
// cliente) — precisa comparar tags dos cards ativos contra as campanhas
// já ativas/em planejamento (kanban/campanhas, global) pra só sugerir
// campanha/coleção nova quando o padrão detectado ainda não estiver
// coberto (ver comentário completo no topo de analisePO.js). Mesmo
// escopo de squad que analiseDados.js (só o squad atual, não cross-squad
// como o resto de "Meu Dia"), NÃO escreve nada no board.
// Deploy isolado: firebase deploy --only functions:agenteAgilAnalisePO
exports.agenteAgilAnalisePO = require('./agente-agil-orquestrador/analisePO').agenteAgilAnalisePO;
