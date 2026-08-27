// functions/agente-agil-orquestrador/intakeTrigger.js
//
// Segundo gatilho automático do orquestrador (o primeiro foi @menção, ver
// mentionTrigger.js) — e o primeiro que NÃO depende de um card já existir.
// Escuta kanban/squads/{squadId}/dados/agente_intake_pending/{id}, escrito
// por agente-agil/http.js sempre que um especialista externo (hoje:
// Databricks; desenhado pra caber outros no futuro) manda informação —
// NUNCA mais uma ação já decidida (ver o comentário grande em http.js).
// O especialista só informa; quem decide o que fazer no board — comentar,
// mover, tagear, mencionar um humano, criar um card novo — é sempre o
// orquestrador, aqui.
//
// Desenho combinado com o usuário (2026-08-27), corrigindo o desenho
// anterior (item "orquestrador lendo input de especialistas externos" do
// README, que ainda deixava http.js aplicar a ação direto):
//   1. Especialistas perdem acesso de escrita direta ao board — só mandam
//      texto (+ opcionalmente um cardId/referencia como DICA).
//   2. Roda AUTOMÁTICO, sem precisar de @menção — decisão explícita do
//      usuário (AskUserQuestion, "Automático").
//   3. O payload é deliberadamente pobre em estrutura — não um vocabulário
//      fixo de ações — porque agentes futuros vão chegar com formatos que
//      "nem sempre vamos conseguir adaptar" (palavras do usuário). O único
//      campo sempre obrigatório é texto livre.
//   4. Toolset ganha criar_card (tools/criarCard.js), pra cobrir o caso em
//      que a informação não é sobre nenhum card existente.
//
// Dois caminhos, dependendo se dá pra resolver um card de verdade:
//  - cardId/referencia (já resolvidos em http.js, ou resolvidos aqui de
//    novo — ver resolverCardId) apontam pra um card que existe -> toolset
//    IGUAL ao de @menção (mesmos handlers reais, incl. criar_card),
//    runLoop com o texto do especialista como tarefa.
//  - não resolveu (especialista não mandou nenhum dos dois, ou a dica não
//    bateu com nenhum card real) -> toolset restrito, `semCard: true` (ver
//    tools/index.js) — só criar_card, visao_board e biblioteca_agil fazem
//    sentido sem um card alvo definido; sem ler_card/comentario/
//    perguntar_humano/etc., que exigem um card fixo pra escrever. O
//    resultado (finalText, e o id do rascunho se criar_card rodou) fica
//    gravado de volta no próprio item de agente_intake_pending — não tem
//    card nenhum pra comentar, é o único jeito de dar rastreabilidade
//    pra esse caminho.
//
// Mesma disciplina de segurança do resto do módulo: kill switch dinâmico
// (limits.isEnabled), idempotência por id do item (protege contra
// reentrega do RTDB trigger), squad LITERAL no path do trigger (não
// wildcard, mesmo raciocínio de custo/escopo de mentionTrigger.js), e
// squad novo entra em modo sombra (dryRun:true) por padrão — mecanismo
// NUNCA validado em produção ainda, ao contrário de @menção (10 canários
// manuais antes de destravar escrita real) — mesma disciplina incremental,
// não pula a etapa de sombra só porque o mecanismo de baixo (buildTools/
// realHandlers) já é o mesmo comprovado.

const { onValueCreated } = require('firebase-functions/v2/database');
const { defineSecret } = require('firebase-functions/params');
const { getDatabase } = require('firebase-admin/database');

const { buildTools } = require('./tools');
const { runLoop } = require('./loop');
const { escolheClienteParaTarefa } = require('./escolheClienteParaTarefa');
const { SYSTEM_PROMPT_V1 } = require('./systemPrompt');
const { isEnabled } = require('./limits');
const { resolveCardKey } = require('../agente-agil/board');
const { resolveReferencia } = require('../agente-agil/resolver');
const { coletarAcoesAgente, registrarLogAgente } = require('./agenteLog');

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

function truncar(s, max) {
  if (s == null) return '';
  const str = String(s);
  return str.length > max ? str.slice(0, max) + '…' : str;
}

// Fábrica — mesmo padrão de createMentionTrigger() em mentionTrigger.js:
// cada squad suportado vira uma Cloud Function própria, deployada/pausada
// de forma independente. dryRun aqui é a config INICIAL do squad — squad
// novo entra em modo sombra por padrão (`true`).
function createIntakeTrigger({ squadId, dryRun = true }) {
  const IDEMPOTENCY_PATH = `kanban/squads/${squadId}/dados/agente_intake_processed`;
  const PENDING_PATH = `kanban/squads/${squadId}/dados/agente_intake_pending`;

  // entry.cardId já vem resolvido por http.js (cardId direto ou referencia
  // já traduzida pra cardId real) — mas resolve de novo aqui contra
  // cards_index, porque o card pode ter sido arquivado/apagado no intervalo
  // entre o especialista mandar o pedido e este trigger rodar (RTDB trigger
  // não é instantâneo, e o item pode ficar na fila por um tempo se o kill
  // switch estiver desligado). Sem essa checagem, o toolset seria montado
  // com um cardId que buildTools aceita mas que não existe mais — os
  // handlers reais já tratam isso (`card_not_found`), mas aí cada tool call
  // falharia individualmente em vez do trigger já saber de antemão e cair
  // no caminho semCard, mais barato (menos idas e vindas ao LLM).
  async function resolverCardId(db, entry) {
    if (!entry.cardId) return null;
    const cardKey = await resolveCardKey(db, entry.cardId, { squadId });
    return cardKey ? entry.cardId : null;
  }

  async function processarIntake(db, { id, entry, llmClient }) {
    if (!entry) {
      return { processed: false, reason: 'entry_vazio' };
    }

    if (!(await isEnabled(db))) {
      return { processed: false, reason: 'disabled' };
    }

    const jaProcessado = await db.ref(`${IDEMPOTENCY_PATH}/${id}`).get();
    if (jaProcessado.exists()) {
      return { processed: false, reason: 'idempotent' };
    }

    const cardId = await resolverCardId(db, entry);
    const semCard = !cardId;

    const tools = buildTools({
      mode: 'real',
      db,
      squadId,
      cardId: cardId || undefined,
      dryRun,
      semCard,
      especialista: entry.especialista,
    });

    // Achado real, canário de validação (2026-08-27): sem dizer o squad
    // explicitamente, o modelo — vendo um assunto que "parecia" de outro
    // squad (ex: tema de campanha, mais afim de "dados") — narrou na
    // resposta final "tentei criar o card no squad dados", mesmo a
    // ferramenta criar_card só conseguindo agir no squad ONDE ESTE
    // GATILHO RODA (fixado em `squadId`, nunca escolhido pelo LLM — ver
    // tools/index.js). A recusa em si aconteceu certinho, no squad certo
    // (Ficha Técnica ativa em `dev`) — só a narrativa estava enganosa.
    // Deixar o squad explícito na tarefa evita o modelo inventar/assumir
    // um squad errado ao explicar o que fez.
    const especialistaLabel = entry.especialista ? `Especialista externo "${entry.especialista}"` : 'Especialista externo';
    const task = cardId
      ? `${especialistaLabel} mandou esta informação sobre o card ${cardId} (squad "${squadId}"):\n\n${entry.texto}`
      : `${especialistaLabel} mandou esta informação, sem nenhum card associado a ela. Você está atuando no squad "${squadId}" — se decidir usar criar_card, o rascunho só pode nascer AQUI, neste squad (esta ferramenta não tem como criar em nenhum outro squad, mesmo que o assunto pareça mais afim de outro time). Se fizer sentido, use criar_card; se não tiver certeza, explique por que não deu pra agir:\n\n${entry.texto}`;

    const result = await runLoop({
      llmClient,
      tools,
      system: SYSTEM_PROMPT_V1,
      task,
      enabled: true, // kill switch já checado acima
    });

    const acoesRegistro = coletarAcoesAgente(result.steps);
    const criarCardCall = result.steps.flatMap((s) => s.toolCalls).find((c) => c.name === 'criar_card' && c.output && c.output.ok && !c.output.dryRun);
    const pendingIdCriado = criarCardCall ? criarCardCall.output.pendingId : null;

    // Histórico do Agente Ágil (mesma tela de mentionTrigger.js) — aqui não
    // existe um "comment" de verdade (não veio de card_comments), então
    // registra usando o texto do especialista como "pedido" e um cardId
    // sintético quando não há card nenhum envolvido, só pra manter o
    // registro rastreável mesmo nesse caso.
    await registrarLogAgente(db, {
      squadId,
      cardId: cardId || `intake:${id}`,
      comment: {
        uid: 'especialista:' + (entry.especialista || 'desconhecido'),
        author: '🔌 ' + (entry.especialista || 'Especialista'),
        text: entry.texto,
      },
      acoes: acoesRegistro,
    }).catch((err) => console.error(`[agente-log:${squadId}] falha ao registrar log (intake):`, id, err));

    // Sem card nenhum pra comentar (ou o card só apareceu via criar_card,
    // que já deixa seu próprio pendingId), o único jeito de dar
    // rastreabilidade da decisão do orquestrador é gravar de volta no
    // próprio item da fila.
    await db.ref(`${PENDING_PATH}/${id}`).update({
      status: result.status === 'awaiting_human' ? 'awaiting_human' : 'done',
      processedAt: new Date().toISOString(),
      resultText: truncar(result.finalText, 2000),
      pendingIdCriado,
      dryRun,
    });

    await db.ref(`${IDEMPOTENCY_PATH}/${id}`).set({ at: new Date().toISOString(), status: result.status, dryRun });

    return { processed: true, result, semCard, cardId, pendingIdCriado };
  }

  const agenteAgilIntake = onValueCreated(
    {
      ref: `/kanban/squads/${squadId}/dados/agente_intake_pending/{id}`,
      region: 'us-central1',
      secrets: [ANTHROPIC_API_KEY],
    },
    async (event) => {
      const { id } = event.params;
      const entry = event.data.val();
      const db = getDatabase();

      try {
        const { llmClient, tier } = await escolheClienteParaTarefa({ apiKey: ANTHROPIC_API_KEY.value(), taskText: entry?.texto, db });
        const outcome = await processarIntake(db, { id, entry, llmClient });
        if (outcome.processed) {
          console.log(`[agente-agil-intake:${squadId}]`, id, `dryRun=${dryRun} | tier=${tier} | semCard=${outcome.semCard} | status=${outcome.result.status}`);
        } else {
          console.log(`[agente-agil-intake:${squadId}]`, id, `ignorado (${outcome.reason})`);
        }
      } catch (err) {
        console.error(`[agente-agil-intake:${squadId}] falha ao processar intake:`, id, err);
      }
    }
  );

  return { agenteAgilIntake, processarIntake, SQUAD_ID: squadId, IDEMPOTENCY_PATH, PENDING_PATH, DRY_RUN_INTAKE: dryRun };
}

// ── squad `dev` — ESTRUTURADO, NÃO DEPLOYADO ainda ──────────────────────
// Mesma disciplina do 1º deploy de @menção (ver mentionTrigger.js): existir
// no código não é o mesmo que estar no ar (functions/index.js decide o que
// de fato é exportado/deployado). Modo sombra por padrão — mecanismo ainda
// não rodou nem uma vez contra produção.
const devInstance = createIntakeTrigger({ squadId: 'dev', dryRun: true });

module.exports = {
  createIntakeTrigger,
  agenteAgilIntake: devInstance.agenteAgilIntake,
  processarIntake: devInstance.processarIntake,
  SQUAD_ID: devInstance.SQUAD_ID,
  IDEMPOTENCY_PATH: devInstance.IDEMPOTENCY_PATH,
  PENDING_PATH: devInstance.PENDING_PATH,
  DRY_RUN_INTAKE: devInstance.DRY_RUN_INTAKE,
};
