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
const { resolveCardKey, cardsPath, cardCommentsPath } = require('../agente-agil/board');
const { resolveReferencia } = require('../agente-agil/resolver');
const { coletarAcoesAgente, registrarLogAgente } = require('./agenteLog');
const { readSquadMembers } = require('../agente-agil/members');
const { buildNotifStep } = require('../agente-agil/notifications');

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

function truncar(s, max) {
  if (s == null) return '';
  const str = String(s);
  return str.length > max ? str.slice(0, max) + '…' : str;
}

// Card hotline "🤖 Converse com o Agente Ágil" (agenteHotline:true) — ver
// openAgenteHotline()/_findAgenteHotlineCard() em kanban-dev.html. Só LÊ,
// nunca cria — escrever um card novo direto em /cards arrisca a mesma
// perda silenciosa que criarCard.js/intake/submit.js já contornam (o
// cliente reescreve o array inteiro em fbSaveAll(), sem transaction).
async function acharCardHotline(db, squadId) {
  const snap = await db.ref(cardsPath(squadId)).get();
  const val = snap.val();
  const lista = Array.isArray(val) ? val : Object.values(val || {});
  return lista.find((c) => c && c.agenteHotline && !c.archived) || null;
}

// Pedido direto do usuário (2026-08-28, testando o intake via HTTPS real):
// quando o orquestrador não tem NENHUM card pra agir (semCard) e termina
// sem criar um rascunho de verdade (criar_card recusou, ex. Ficha Técnica
// obrigatória, ou o modelo decidiu que não fazia sentido criar), a única
// trilha até aqui era o próprio item de agente_intake_pending — ninguém é
// avisado pra ir olhar lá, a informação podia se perder em silêncio.
// Relata no card hotline (se a squad já tiver um) e notifica quem tem
// papel "po"/"adm" nesta squad — mesmo padrão de dryRun de todo o resto
// do módulo (nada escreve de verdade em modo sombra).
async function notificarFalhaSemCard(db, { squadId, especialista, texto, resultText, dryRun }) {
  const hotline = await acharCardHotline(db, squadId);
  const especialistaLabel = especialista ? `"${especialista}"` : '(especialista não identificado)';

  if (hotline) {
    const commentId = 'c' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
    const comment = {
      id: commentId,
      uid: 'agente-agil',
      author: 'Agente Ágil',
      init: '🤖',
      text: `⚠️ Recebi uma informação do especialista externo ${especialistaLabel} que não virou nenhuma ação no board — sem nenhum card associado, e não deu pra criar um rascunho novo.\n\n**Mensagem original:**\n${texto}\n\n**O que aconteceu:**\n${resultText || '(sem detalhe adicional)'}`,
      ts: new Date().toISOString(),
    };
    if (!dryRun) await db.ref(cardCommentsPath(squadId, hotline.id)).update({ [commentId]: comment });
  }

  const members = await readSquadMembers(db, squadId);
  const alvo = members.filter((m) => m.role === 'po' || m.role === 'adm');
  const resumo = truncar(resultText || texto, 100);
  for (const m of alvo) {
    const step = await buildNotifStep(db, {
      squadId,
      targetUid: m.uid,
      // 'mention' navega pro card hotline (mesmo comportamento de sempre);
      // sem card hotline ainda, 'intake' abre o painel de Pedidos de
      // Intake em vez de tentar navegar pra um cardId nulo (ver openNotif()
      // em kanban-dev.html, que já trata esse tipo especificamente).
      type: hotline ? 'mention' : 'intake',
      title: '🤖 Agente Ágil não conseguiu agir sozinho',
      sub: resumo,
      cardId: hotline ? hotline.id : null,
      dryRun,
    });
    if (step && step.kind === 'update' && !dryRun) {
      await db.ref(step.path).update(step.data);
    }
  }
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

    // Achado real, canário de validação (2026-08-27): uma instabilidade
    // momentânea da API da Anthropic (erro 529 "overloaded") derrubou
    // runLoop() com exceção — e como nada abaixo daqui rodava, o item
    // ficava pra sempre com status:'pending', sem NENHUM sinal de que
    // algo tinha falhado. Diferente da @menção (onde a ausência de
    // resposta num card já é um sinal visível pra quem perguntou), aqui
    // não existe ninguém esperando — o item some silenciosamente no
    // meio da fila. Não tenta reprocessar sozinho (isso exigiria um scan
    // agendado, fora de escopo por ora) — só GARANTE que a falha fica
    // visível pra quem for olhar `agente_intake_pending` depois.
    // Idempotência de propósito NÃO marcada nesse caminho — nada foi de
    // fato concluído, então um reprocessamento futuro (ex: reenviando o
    // mesmo pedido) não deveria ser bloqueado por isso.
    let result;
    try {
      result = await runLoop({
        llmClient,
        tools,
        system: SYSTEM_PROMPT_V1,
        task,
        enabled: true, // kill switch já checado acima
      });
    } catch (err) {
      console.error(`[agente-agil-intake:${squadId}] runLoop falhou:`, id, err);
      await db.ref(`${PENDING_PATH}/${id}`).update({
        status: 'failed',
        processedAt: new Date().toISOString(),
        error: truncar(err.message, 500),
        dryRun,
      });
      return { processed: false, reason: 'llm_error', error: err.message };
    }

    const acoesRegistro = coletarAcoesAgente(result.steps);
    const criarCardCall = result.steps.flatMap((s) => s.toolCalls).find((c) => c.name === 'criar_card' && c.output && c.output.ok && !c.output.dryRun);
    const pendingIdCriado = criarCardCall ? criarCardCall.output.pendingId : null;

    // Pedido direto do usuário: sem card nenhum pra agir E sem ter criado
    // um rascunho de verdade, a informação ficaria visível só pra quem
    // fosse abrir Pedidos de Intake por conta própria — ninguém é avisado.
    // Reporta no card hotline + notifica PO/ADM da squad (ver
    // notificarFalhaSemCard acima). Não dispara se resolveu um card real
    // (cardId) — nesse caminho o comentário já fica visível no próprio
    // card, mesma cobertura que uma @menção normal já tem.
    if (semCard && !pendingIdCriado) {
      await notificarFalhaSemCard(db, {
        squadId,
        especialista: entry.especialista,
        texto: entry.texto,
        resultText: result.finalText,
        dryRun,
      }).catch((err) => console.error(`[agente-agil-intake:${squadId}] falha ao notificar falha sem card:`, id, err));
    }

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

// ── squad `dev` — ESCRITA REAL desde 2026-08-27 ─────────────────────────
// Rodou em modo sombra do 1º deploy (mesmo dia) até esta decisão — 4
// canários simulados diretos no Firebase real: card existente (só
// comentou, decisão certa), sem card associado com Ficha Técnica/Submarca
// ativas (recusou corretamente, 2x), e sem card com as duas exigências
// desligadas temporariamente só pro teste (criar_card completou e o
// modelo relatou certo que era simulação — só depois de 2 rodadas de fix:
// description de criar_card avisando sobre dryRun não bastou sozinha,
// precisou da regra genérica em systemPrompt.js, "Ferramenta em modo de
// teste (dryRun)"). Decisão explícita do usuário (2026-08-27, mesma
// pergunta direta feita pra @menção em 2026-08-18): "sim, pode destravar".
const devInstance = createIntakeTrigger({ squadId: 'dev', dryRun: false });

module.exports = {
  createIntakeTrigger,
  agenteAgilIntake: devInstance.agenteAgilIntake,
  processarIntake: devInstance.processarIntake,
  SQUAD_ID: devInstance.SQUAD_ID,
  IDEMPOTENCY_PATH: devInstance.IDEMPOTENCY_PATH,
  PENDING_PATH: devInstance.PENDING_PATH,
  DRY_RUN_INTAKE: devInstance.DRY_RUN_INTAKE,
};
