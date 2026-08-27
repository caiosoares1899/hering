// functions/agente-agil-orquestrador/mentionTrigger.js
//
// PRIMEIRO gatilho automático do orquestrador — até aqui, toda invocação
// (canários 1-9) era 100% manual (script CLI, confirmação interativa,
// humano olhando kanban-dev.html ao vivo). Também é o PRIMEIRO deploy
// real deste módulo como Cloud Function — `functions/agente-agil-
// orquestrador/` não tinha nenhum `index.js`/export até agora.
//
// Item 3 do plano de acionamento sem supervisão direta (ver README —
// "Decisão sobre o item 1"), sequência combinada com o usuário:
//   1. Kill switch dinâmico — FECHADO (limits.js).
//   2. Escopo de squad pra @menção v1 — `dev`, confirmado.
//   3. @menção v1 — ESTE ARQUIVO.
//   4. Rodar de verdade por um tempo antes de considerar gatilho amplo.
//   5. Só depois, gatilho automático em qualquer mudança de card.
//
// Desenho combinado antes do código:
//
// - Escuta `kanban/squads/{squadId}/dados/card_comments/{cardId}/
//   {commentId}` com o squad LITERAL no path (não `{squadId}` wildcard
//   escutando o board inteiro) — a infra em si não recebe eventos de
//   nenhum outro squad, mais forte que uma checagem em runtime. Cada
//   squad suportado é uma Cloud Function DEPLOYADA SEPARADAMENTE (ver
//   createMentionTrigger() e functions/index.js), não uma lista dinâmica
//   dentro de uma função só — evita o trade-off de custo de escutar
//   TODO comentário de TODO squad só pra descartar a maioria em runtime.
// - Convenção de menção própria (detectaMencao.js), não o regex de
//   menção humana (que resolve contra INIT de membro real — o agente não
//   tem um init de verdade).
// - Rede de segurança contra o modelo terminar só com finalText, sem
//   chamar comentario (achado real 2026-08-18: não-determinismo — mesma
//   revisão, mesmo prompt, comportamento diferente entre chamadas
//   seguidas). Ver processarMencao().
// - Ordem de checagem, cada uma um early-return, do mais barato pro mais
//   caro: (1) é comentário do próprio agente? -> ignora, SEMPRE primeiro,
//   requisito de design não-negociável (sem isso, risco real de
//   auto-disparo: o agente comenta, o próprio comentário dispara o
//   trigger de novo); (2) menciona o agente?; (3) kill switch ligado?;
//   (4) já processado antes (idempotência, mesmo padrão de
//   `agente-agil/http.js:IDEMPOTENCY_PATH`, protege contra reentrega do
//   Firebase Functions — RTDB triggers não garantem exatamente-uma-vez).
// - MODO SOMBRA (`dryRun` fixo em `true`, não exposto como parâmetro em
//   runtime): squad `dev` rodou assim de 2026-08-18 (1º deploy real) até
//   o mesmo dia, validando só o MECANISMO DE GATILHO em si (dispara uma
//   vez só, ignora comentário próprio, respeita kill switch, detecta
//   menção certo) — o que "o modelo escolhe a ferramenta certa" já tinha
//   sido provado 9x nos canários manuais. Susto investigado nesse meio
//   tempo: 1º comentário real não gerou log, 2º (4min depois, mesmo card)
//   gerou normal — `detectaMencao.js` testado direto contra os dois
//   textos exatos não achou bug de detecção; explicação mais provável é
//   atraso de provisionamento do trigger Eventarc logo após o 1º deploy,
//   confirmado por uma 3ª menção rodando normal sem qualquer mudança de
//   código.
// - **DECISÃO EXPLÍCITA DO USUÁRIO (2026-08-18, squad `dev`):
//   `dryRun` virou `false`** — mecanismo de gatilho validado, escrita
//   real já provada nos 10 canários manuais anteriores. Esta foi a
//   primeira vez que o agente escreveu em produção SEM humano no
//   terminal digitando `ESCREVER` — a rede de segurança passou a ser o
//   kill switch dinâmico (`limits.js`) + o escopo travado no path do
//   trigger, não mais confirmação manual por invocação. Squad novo
//   (`dados`, ver createMentionTrigger() abaixo) recomeça em modo
//   sombra por padrão — mesma disciplina, decisão de destravar escrita
//   real é separada e específica desse squad, não herdada de `dev`.
// - `processarMencao()` é a lógica de negócio pura, com `llmClient`
//   injetado (não resolve `escolheClienteParaTarefa()`/secret internamente)
//   — testável com fake db + cliente scriptado, mesmo padrão de
//   `loop.test.js`/`realHandlers.test.js`, sem precisar mockar
//   `firebase-functions` nem bater na API de verdade. `agenteAgilMencao`
//   (o export da Cloud Function) é só o encanamento: resolve `db`/secret/
//   client reais e chama `processarMencao()`.

const { onValueCreated } = require('firebase-functions/v2/database');
const { defineSecret } = require('firebase-functions/params');
const { getDatabase } = require('firebase-admin/database');

const { buildTools } = require('./tools');
const { runLoop } = require('./loop');
const { escolheClienteParaTarefa } = require('./escolheClienteParaTarefa');
const { SYSTEM_PROMPT_V1 } = require('./systemPrompt');
const { isEnabled } = require('./limits');
const { mencionaAgente } = require('./detectaMencao');
const { buildNotifStep } = require('../agente-agil/notifications');
const { resolveCardKey, cardsPath } = require('../agente-agil/board');
const { coletarAcoesAgente, registrarLogAgente } = require('./agenteLog');
const { readSquadMembers, getUidByInit } = require('../agente-agil/members');

const AGENTE_UID = 'agente-agil'; // mesmo uid que outputs/*.js grava em todo comentário/escrita do agente
const AUTOMACAO_UID = 'automacao'; // mesmo uid que o client (AUTO_ACTIONS.notify_agent) e dueOverdueTrigger.js gravam — não é uma pessoa real, ver achado abaixo

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

// Formata um resumo legível de um resultado de runLoop() pro log de
// produção — mesma informação que os scripts CLI imprimem passo a passo
// (ferramenta, input, finalText), condensada numa linha só. Função pura,
// sem opinião sobre squad — reaproveitada por qualquer instância criada
// por createMentionTrigger(). Trunca qualquer campo que possa ficar
// grande (descrição longa em editar_campos, texto de comentário,
// finalText) pra não virar spam de log nem vazar payload gigante pro
// Cloud Logging.
const TRUNC_INPUT = 160;
const TRUNC_FINAL_TEXT = 500;

function truncar(s, max) {
  if (s == null) return '';
  const str = String(s);
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function resumirChamada(call) {
  const input = { ...call.input };
  delete input.type; // já é redundante com call.name, não precisa duplicar no log
  return `${call.name}(${truncar(JSON.stringify(input), TRUNC_INPUT)})`;
}

function resumirResultadoParaLog(result) {
  const chamadas = result.steps.flatMap((s) => s.toolCalls);
  const ferramentas = chamadas.length ? chamadas.map(resumirChamada).join(' -> ') : '(nenhuma)';
  const finalText = result.finalText ? truncar(result.finalText, TRUNC_FINAL_TEXT) : '(nenhum)';
  return `status=${result.status} | ferramentas: ${ferramentas} | finalText: "${finalText}"`;
}

// Fábrica — cada squad suportado chama isto uma vez (ver o bloco "squad
// dev" e "squad dados" no fim do arquivo) e vira uma Cloud Function
// própria, deployada/pausada de forma independente (mesmo padrão do
// spotifySync comentado em functions/index.js: existir no código não é
// o mesmo que estar no ar). `dryRun` aqui é a config INICIAL do squad —
// squad novo entra em modo sombra por padrão (`true`), squad `dev` já
// destravado (`false`, decisão de 2026-08-18) continua exatamente como
// estava, sem regressão.
function createMentionTrigger({ squadId, dryRun = true }) {
  const IDEMPOTENCY_PATH = `kanban/squads/${squadId}/dados/agente_agil_mencao_processed`;

  async function processarMencao(db, { cardId, commentId, comment, llmClient }) {
    // (1) Anti-auto-disparo — PRIMEIRO de tudo, antes até de olhar o texto.
    if (!comment || comment.uid === AGENTE_UID) {
      return { processed: false, reason: 'self_comment' };
    }

    // (2) Menciona o agente?
    if (!mencionaAgente(comment.text)) {
      return { processed: false, reason: 'no_mention' };
    }

    // (3) Kill switch dinâmico (kanban/config/agente_agil_orquestrador/enabled)
    // — GLOBAL, não por squad: qualquer squad deployado respeita o mesmo
    // interruptor único, mesmo padrão desde que o kill switch existe.
    if (!(await isEnabled(db))) {
      return { processed: false, reason: 'disabled' };
    }

    // (4) Idempotência — protege contra reentrega do Firebase Functions
    // (RTDB triggers não garantem exatamente-uma-vez) e contra reprocessar
    // o mesmo comentário 2x (evita gastar tokens à toa numa chamada
    // duplicada, e — agora com escrita real — evita comentário repetido).
    const jaProcessado = await db.ref(`${IDEMPOTENCY_PATH}/${commentId}`).get();
    if (jaProcessado.exists()) {
      return { processed: false, reason: 'idempotent' };
    }

    const tools = buildTools({ mode: 'real', db, squadId, cardId, dryRun });

    const result = await runLoop({
      llmClient,
      tools,
      system: SYSTEM_PROMPT_V1,
      task: comment.text,
      enabled: true, // kill switch já checado no passo (3) acima
    });

    // Rede de segurança — achado real (2026-08-18): o modelo às vezes
    // termina só com finalText, sem chamar comentario, mesmo com a
    // instrução explícita em systemPrompt.js ("Entrega da resposta").
    // MESMA revisão deployada, MESMO prompt, comportamento diferente entre
    // chamadas seguidas — não-determinismo do LLM, não bug de código/path.
    // Pedir só no prompt reduz a frequência, não garante; sem isso a
    // resposta fica presa no log do Cloud Functions, invisível pra quem
    // mencionou. Garantido aqui: se o loop terminou sem NENHUMA chamada de
    // comentario mas tem finalText, posta ele mesmo, usando a MESMA
    // ferramenta que o modelo usaria (mesmo dryRun/squad/card).
    const chamouComentario = result.steps.some((step) => step.toolCalls.some((call) => call.name === 'comentario'));
    let fallbackComentario = false;
    if (!chamouComentario && result.finalText) {
      const comentarioTool = tools.find((t) => t.name === 'comentario');
      if (comentarioTool) {
        await comentarioTool.handler({ type: 'comentario', texto: result.finalText });
        fallbackComentario = true;
      }
    }

    // Histórico do Agente Ágil (Configurações → 🤖 Histórico do Agente,
    // PO/Organizador/ADM) — pedido direto: "quero uma area q guarde todas
    // as alterações nos cards que ele faça naquela squad". Melhor esforço
    // (nunca derruba o fluxo principal: a resposta do agente já foi
    // aplicada nos passos acima, uma falha aqui só perde a entrada do log,
    // não desfaz nada). fallbackComentario não passa por result.steps
    // (chama o handler direto, fora do loop) — emenda manualmente.
    const acoesRegistro = coletarAcoesAgente(result.steps);
    if (fallbackComentario) acoesRegistro.push(`comentou: "${truncar(result.finalText, 120)}"`);
    // AWAIT de propósito (não fire-and-forget): o Cloud Functions pode
    // congelar/matar o processo assim que a função do trigger retornar —
    // sem esperar aqui, a escrita do log corre risco real de nunca
    // completar. O .catch() garante que uma falha aqui não derruba o
    // fluxo principal (a resposta do agente já foi aplicada acima).
    await registrarLogAgente(db, { squadId, cardId, comment, acoes: acoesRegistro }).catch((err) =>
      console.error(`[agente-log:${squadId}] falha ao registrar log:`, cardId, err)
    );

    // Notifica quem fez a @menção original — achado real (2026-08-18):
    // `comentario` só dispara notificação quando o TEXTO da resposta tem uma
    // @menção reconhecível (heurística pensada pra menção humana dentro do
    // texto, ver outputs/comentario.js), e a resposta do agente normalmente
    // não menciona ninguém — a pessoa que perguntou nunca era avisada, mesmo
    // sendo resposta direta a ela. Notifica direto por uid (já em `comment`,
    // não precisa resolver init) com o MESMO esquema de id determinístico
    // que @menção-no-texto usa (`mention_{cardId}_{uid}`) — se o texto por
    // acaso também mencionar essa pessoa, buildNotifStep vê que já existe e
    // não duplica.
    //
    // Segundo achado real (2026-08-24, testando due_today/due_overdue):
    // quando quem "mencionou" o agente foi a Automação (comment.uid ===
    // 'automacao', não uma pessoa — ver dueOverdueTrigger.js/AUTO_ACTIONS.
    // notify_agent no client), notificar `comment.uid` grava a notificação
    // em `kanban/usuarios/automacao/notificacoes/...` — um caminho que
    // ninguém lê, porque 'automacao' não é um uid de usuário de verdade.
    // Resultado observado: o 1º comentário automático (análise, sem
    // perguntar_humano) saía sem NENHUMA notificação — só o 2º, quando o
    // agente usava perguntar_humano e @mencionava alguém de verdade no
    // texto (esse caminho já funcionava, via buildMentionSteps() em
    // outputs/comentario.js). Fix: quando o disparo foi da Automação,
    // notifica o responsável do card (`card.owner`, resolvido por init)
    // em vez de `comment.uid` — mesmo padrão que checkDueNotifs() já usa
    // no client pra notificar due_today/due_overdue. Sem responsável
    // definido, não notifica ninguém (mesmo comportamento do client:
    // melhor não notificar do que notificar errado).
    //
    // Terceiro achado real (2026-08-24, MESMO dia — 1ª versão deste fix
    // ainda não resolvia de verdade): usar o MESMO idOverride
    // (`mention_{cardId}_{uid}`) que os outros 2 caminhos (notifica quem
    // perguntou / notifica quem foi @mencionado no texto) já usam faz o
    // disparo da Automação colidir com QUALQUER notificação anterior pra
    // essa pessoa nesse card, de QUALQUER origem — inclusive uma bem
    // antiga, de um teste ou @menção manual anterior. `buildNotifStep()`
    // vê que o slot já existe e pula pra sempre, mesmo em invocações
    // completamente novas dias depois, com informação nova de verdade
    // (confirmado ao vivo: notificação de 12:37, de um teste anterior,
    // bloqueou silenciosamente os disparos de Automação de 12:57/12:58 no
    // MESMO card). Fix na época: `idOverride` da Automação inclui
    // `commentId` (`mention_auto_{cardId}_{uid}_{commentId}`) — único por
    // disparo, sem colidir com os outros 2 caminhos nem se auto-bloquear
    // pra sempre; ainda idempotente pra reentrega do MESMO commentId
    // (mesmo padrão de sempre).
    //
    // Quarto achado real (2026-08-27, reportado ao vivo pelo usuário): o
    // raciocínio "dedupe por card+pessoa faz sentido pro caso original
    // (mesma pessoa perguntando de novo não precisa de notificação
    // duplicada)" — texto que estava aqui até esta correção — é FALSO na
    // prática. Uma 2ª @menção da MESMA pessoa no MESMO card é uma
    // PERGUNTA NOVA (ex.: pediu uma coisa, minutos depois pediu outra, ou
    // testou de novo depois de um fix), e merece notificação nova quando
    // o agente responde — exatamente o mesmo problema que o 3º achado
    // acima já tinha resolvido pro ramo da Automação, nunca replicado pra
    // este ramo (o "caso original"). Confirmado ao vivo: 2ª @menção no
    // mesmo card, resposta do agente chegou certinho no card, mas
    // nenhuma notificação — o slot `mention_{cardId}_{uid}` já estava
    // ocupado pela 1ª. Mesmo fix de sempre: `commentId` no idOverride.
    // Achado real ao vivo (2026-08-27): o comentário abaixo dizia "dedupe
    // por card+pessoa faz sentido pro caso original (mesma pessoa
    // perguntando de novo não precisa de notificação duplicada)" — mas
    // isso é FALSO na prática: uma 2ª @menção da mesma pessoa no mesmo
    // card é uma PERGUNTA NOVA (ex.: "adiciona a tag X" e, minutos depois,
    // "testa de novo") e merece notificação nova quando o agente responde.
    // Sem `commentId` aqui, a notificação da 1ª menção deixava o slot
    // `mention_{cardId}_{uid}` ocupado pra sempre — qualquer resposta
    // seguinte no MESMO card pra essa pessoa era silenciosamente
    // engolida por `buildNotifStep()` (mesma causa raiz do bug já achado
    // e corrigido pro ramo da Automação logo abaixo, nunca replicado pra
    // este ramo). Mesmo fix: inclui `commentId`, único por @menção.
    let targetUid = comment.uid;
    let notifTitle = '🤖 Agente Ágil respondeu sua menção';
    let notifIdOverride = 'mention_' + cardId + '_' + comment.uid + '_' + commentId;
    if (comment.uid === AUTOMACAO_UID) {
      targetUid = null;
      const cardKey = await resolveCardKey(db, cardId, { squadId });
      const cardSnap = cardKey ? await db.ref(`${cardsPath(squadId)}/${cardKey}`).get() : null;
      const card = cardSnap?.val();
      if (card?.owner) {
        const members = await readSquadMembers(db, squadId);
        targetUid = getUidByInit(members, card.owner);
      }
      notifTitle = '🤖 Agente Ágil comentou no seu card (Automação)';
      notifIdOverride = 'mention_auto_' + cardId + '_' + targetUid + '_' + commentId;
    }
    const comentarioCall = result.steps.flatMap((step) => step.toolCalls).find((call) => call.name === 'comentario');
    const respostaTexto = comentarioCall?.input?.texto || result.finalText || '';
    const notifStep = targetUid
      ? await buildNotifStep(db, {
          squadId,
          targetUid,
          type: 'mention',
          title: notifTitle,
          sub: respostaTexto.substring(0, 80) + (respostaTexto.length > 80 ? '…' : ''),
          cardId,
          idOverride: notifIdOverride,
          dryRun,
        })
      : null;
    if (notifStep && notifStep.kind === 'update') {
      await db.ref(notifStep.path).update(notifStep.data);
    }

    // Marca DEPOIS de rodar (não antes) — se o loop lançar exceção, o
    // comentário fica elegível pra reprocessar numa próxima tentativa, já
    // que nada foi de fato concluído.
    await db.ref(`${IDEMPOTENCY_PATH}/${commentId}`).set({
      at: new Date().toISOString(),
      status: result.status,
      dryRun,
      fallbackComentario,
    });

    return { processed: true, result, fallbackComentario };
  }

  const agenteAgilMencao = onValueCreated(
    {
      ref: `/kanban/squads/${squadId}/dados/card_comments/{cardId}/{commentId}`,
      region: 'us-central1',
      secrets: [ANTHROPIC_API_KEY],
    },
    async (event) => {
      const { cardId, commentId } = event.params;
      const comment = event.data.val();
      const db = getDatabase();

      try {
        const { llmClient, tier } = await escolheClienteParaTarefa({ apiKey: ANTHROPIC_API_KEY.value(), taskText: comment?.text, db });
        const outcome = await processarMencao(db, { cardId, commentId, comment, llmClient });
        if (outcome.processed) {
          const fallbackNote = outcome.fallbackComentario ? ' | FALLBACK: finalText postado como comentario (modelo não chamou a ferramenta)' : '';
          console.log(`[agente-agil-mencao:${squadId}]`, cardId, commentId, `dryRun=${dryRun} | tier=${tier} |`, resumirResultadoParaLog(outcome.result) + fallbackNote);
        } else {
          console.log(`[agente-agil-mencao:${squadId}]`, cardId, commentId, `ignorado (${outcome.reason})`);
        }
      } catch (err) {
        console.error(`[agente-agil-mencao:${squadId}] falha ao processar menção:`, cardId, commentId, err);
      }
    }
  );

  return { agenteAgilMencao, processarMencao, resumirResultadoParaLog, SQUAD_ID: squadId, IDEMPOTENCY_PATH, AGENTE_UID, DRY_RUN_MENCAO: dryRun };
}

// ── squad `dev` — em produção desde 2026-08-18, escrita real ────────────
// Mesma instância de sempre; nomes re-exportados no topo do módulo (ver
// module.exports abaixo) pra manter 100% de compatibilidade com quem já
// importava { agenteAgilMencao, processarMencao, SQUAD_ID, ... } direto
// daqui — nenhum código/teste existente precisa mudar por causa da fábrica.
const devInstance = createMentionTrigger({ squadId: 'dev', dryRun: false });

// ── squad `dados` — estruturado, NÃO deployado ainda ─────────────────────
// Pedido do usuário (2026-08-21): preparar o próximo squad (o squad de
// trabalho da própria equipe, mesmo onde os logs de implementação já são
// registrados) SEM subir pra produção em horário de trabalho — decisão de
// ativação (deploy: PR #480, 2026-08-23) rodou primeiro em modo sombra
// pra validar o mecanismo de gatilho em produção — mesma disciplina do
// squad dev. Validado (2026-08-24, logs reais: dryRun=true, status=done,
// idempotência segurando entre menções sequenciais no mesmo card) —
// decisão explícita do usuário: dryRun vira false, escrita real.
const dadosInstance = createMentionTrigger({ squadId: 'dados', dryRun: false });

module.exports = {
  createMentionTrigger,
  agenteAgilMencao: devInstance.agenteAgilMencao,
  processarMencao: devInstance.processarMencao,
  SQUAD_ID: devInstance.SQUAD_ID,
  IDEMPOTENCY_PATH: devInstance.IDEMPOTENCY_PATH,
  AGENTE_UID,
  DRY_RUN_MENCAO: devInstance.DRY_RUN_MENCAO,
  resumirResultadoParaLog,
  agenteAgilMencaoDados: dadosInstance.agenteAgilMencao,
  processarMencaoDados: dadosInstance.processarMencao,
};
