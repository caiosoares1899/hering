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
// - Escuta `kanban/squads/dev/dados/card_comments/{cardId}/{commentId}`
//   com "dev" LITERAL no path (não `{squadId}` wildcard) — a infra em si
//   não recebe eventos de nenhum outro squad, mais forte que uma
//   checagem em runtime.
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
// - MODO SOMBRA (`dryRun` fixo em `true`, não exposto como parâmetro):
//   rodou de 2026-08-18 (1º deploy real) até o mesmo dia, validando só o
//   MECANISMO DE GATILHO em si (dispara uma vez só, ignora comentário
//   próprio, respeita kill switch, detecta menção certo) — o que "o
//   modelo escolhe a ferramenta certa" já tinha sido provado 9x nos
//   canários manuais. Susto investigado nesse meio tempo: 1º comentário
//   real não gerou log, 2º (4min depois, mesmo card) gerou normal —
//   `detectaMencao.js` testado direto contra os dois textos exatos não
//   achou bug de detecção; explicação mais provável é atraso de
//   provisionamento do trigger Eventarc logo após o 1º deploy, confirmado
//   por uma 3ª menção rodando normal sem qualquer mudança de código.
// - **DECISÃO EXPLÍCITA DO USUÁRIO (2026-08-18): `DRY_RUN_MENCAO` virou
//   `false`** — mecanismo de gatilho validado, escrita real já provada
//   nos 10 canários manuais anteriores, squad `dev` continua sendo a
//   única superfície (path do trigger travado, não checagem em runtime).
//   Esta é a primeira vez que o agente escreve em produção SEM humano no
//   terminal digitando `ESCREVER` — a rede de segurança agora é o kill
//   switch dinâmico (`limits.js`) + o escopo travado no squad `dev`, não
//   mais confirmação manual por invocação.
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

const SQUAD_ID = 'dev';
const AGENTE_UID = 'agente-agil'; // mesmo uid que outputs/*.js grava em todo comentário/escrita do agente
const IDEMPOTENCY_PATH = `kanban/squads/${SQUAD_ID}/dados/agente_agil_mencao_processed`;
const DRY_RUN_MENCAO = false;

async function processarMencao(db, { cardId, commentId, comment, llmClient }) {
  // (1) Anti-auto-disparo — PRIMEIRO de tudo, antes até de olhar o texto.
  if (!comment || comment.uid === AGENTE_UID) {
    return { processed: false, reason: 'self_comment' };
  }

  // (2) Menciona o agente?
  if (!mencionaAgente(comment.text)) {
    return { processed: false, reason: 'no_mention' };
  }

  // (3) Kill switch dinâmico (kanban/config/agente_agil_orquestrador/enabled).
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

  const tools = buildTools({ mode: 'real', db, squadId: SQUAD_ID, cardId, dryRun: DRY_RUN_MENCAO });

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
  const comentarioCall = result.steps.flatMap((step) => step.toolCalls).find((call) => call.name === 'comentario');
  const respostaTexto = comentarioCall?.input?.texto || result.finalText || '';
  const notifStep = await buildNotifStep(db, {
    squadId: SQUAD_ID,
    targetUid: comment.uid,
    type: 'mention',
    title: '🤖 Agente Ágil respondeu sua menção',
    sub: respostaTexto.substring(0, 80) + (respostaTexto.length > 80 ? '…' : ''),
    cardId,
    idOverride: 'mention_' + cardId + '_' + comment.uid,
    dryRun: DRY_RUN_MENCAO,
  });
  if (notifStep && notifStep.kind === 'update') {
    await db.ref(notifStep.path).update(notifStep.data);
  }

  // Marca DEPOIS de rodar (não antes) — se o loop lançar exceção, o
  // comentário fica elegível pra reprocessar numa próxima tentativa, já
  // que nada foi de fato concluído.
  await db.ref(`${IDEMPOTENCY_PATH}/${commentId}`).set({
    at: new Date().toISOString(),
    status: result.status,
    dryRun: DRY_RUN_MENCAO,
    fallbackComentario,
  });

  return { processed: true, result, fallbackComentario };
}

// Formata um resumo legível de um resultado de runLoop() pro log de
// produção — mesma informação que os scripts CLI imprimem passo a passo
// (ferramenta, input, finalText), condensada numa linha só. Função pura,
// separada de processarMencao() de propósito (lógica de negócio não deve
// ter opinião sobre formato de log — mesmo espírito de isolamento do
// resto do módulo). Trunca qualquer campo que possa ficar grande
// (descrição longa em editar_campos, texto de comentário, finalText) pra
// não virar spam de log nem vazar payload gigante pro Cloud Logging.
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

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

const agenteAgilMencao = onValueCreated(
  {
    ref: `/kanban/squads/${SQUAD_ID}/dados/card_comments/{cardId}/{commentId}`,
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
        console.log('[agente-agil-mencao]', cardId, commentId, `dryRun=${DRY_RUN_MENCAO} | tier=${tier} |`, resumirResultadoParaLog(outcome.result) + fallbackNote);
      } else {
        console.log('[agente-agil-mencao]', cardId, commentId, `ignorado (${outcome.reason})`);
      }
    } catch (err) {
      console.error('[agente-agil-mencao] falha ao processar menção:', cardId, commentId, err);
    }
  }
);

module.exports = {
  agenteAgilMencao,
  processarMencao,
  resumirResultadoParaLog,
  DRY_RUN_MENCAO,
  SQUAD_ID,
  IDEMPOTENCY_PATH,
  AGENTE_UID,
};
