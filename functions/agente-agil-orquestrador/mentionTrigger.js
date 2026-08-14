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
// - Ordem de checagem, cada uma um early-return, do mais barato pro mais
//   caro: (1) é comentário do próprio agente? -> ignora, SEMPRE primeiro,
//   requisito de design não-negociável (sem isso, risco real de
//   auto-disparo: o agente comenta, o próprio comentário dispara o
//   trigger de novo); (2) menciona o agente?; (3) kill switch ligado?;
//   (4) já processado antes (idempotência, mesmo padrão de
//   `agente-agil/http.js:IDEMPOTENCY_PATH`, protege contra reentrega do
//   Firebase Functions — RTDB triggers não garantem exatamente-uma-vez).
// - MODO SOMBRA: `dryRun` fixo em `true` (`DRY_RUN_SOMBRA` abaixo), não
//   exposto como parâmetro ainda — mesmo padrão que `tools/realHandlers.js`
//   usou na Etapa 2 antes do `dryRun` virar parâmetro de verdade na Etapa
//   3. O que nunca foi validado até agora não é "o modelo escolhe a
//   ferramenta certa" (já provado 9x) — é o MECANISMO DE GATILHO em si
//   (dispara uma vez só, ignora comentário próprio, respeita kill
//   switch, detecta menção certo). Só vira `dryRun:false` depois de
//   observar isso rodando de verdade (não fake db) por um tempo —
//   decisão nova e separada, não implícita neste commit.
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

const SQUAD_ID = 'dev';
const AGENTE_UID = 'agente-agil'; // mesmo uid que outputs/*.js grava em todo comentário/escrita do agente
const IDEMPOTENCY_PATH = `kanban/squads/${SQUAD_ID}/dados/agente_agil_mencao_processed`;
const DRY_RUN_SOMBRA = true;

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
  // o mesmo comentário 2x, mesmo em modo sombra (evita gastar tokens à
  // toa numa chamada duplicada).
  const jaProcessado = await db.ref(`${IDEMPOTENCY_PATH}/${commentId}`).get();
  if (jaProcessado.exists()) {
    return { processed: false, reason: 'idempotent' };
  }

  const tools = buildTools({ mode: 'real', db, squadId: SQUAD_ID, cardId, dryRun: DRY_RUN_SOMBRA });

  const result = await runLoop({
    llmClient,
    tools,
    system: SYSTEM_PROMPT_V1,
    task: comment.text,
    enabled: true, // kill switch já checado no passo (3) acima
  });

  // Marca DEPOIS de rodar (não antes) — se o loop lançar exceção, o
  // comentário fica elegível pra reprocessar numa próxima tentativa, já
  // que nada foi de fato concluído.
  await db.ref(`${IDEMPOTENCY_PATH}/${commentId}`).set({
    at: new Date().toISOString(),
    status: result.status,
    dryRun: DRY_RUN_SOMBRA,
  });

  return { processed: true, result };
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
      const { llmClient } = escolheClienteParaTarefa({ apiKey: ANTHROPIC_API_KEY.value() });
      const outcome = await processarMencao(db, { cardId, commentId, comment, llmClient });
      console.log(
        '[agente-agil-mencao]',
        cardId,
        commentId,
        outcome.processed ? `processado, status=${outcome.result.status}, dryRun=${DRY_RUN_SOMBRA}` : `ignorado (${outcome.reason})`
      );
    } catch (err) {
      console.error('[agente-agil-mencao] falha ao processar menção:', cardId, commentId, err);
    }
  }
);

module.exports = { agenteAgilMencao, processarMencao, DRY_RUN_SOMBRA, SQUAD_ID, IDEMPOTENCY_PATH, AGENTE_UID };
