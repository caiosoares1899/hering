// functions/okr/agenteChat.js
//
// Chat dedicado com o Agente Ágil pro domínio OKR — pedido direto do
// usuário: "usar o agente ágil para ajudar o pessoal a preencher, igual ele
// faz com os cards! ai coloca um chat ali nessa página, tipo aquele q ta no
// kanban-dev/dados". Investigado antes de desenhar: aquele "chat" do kanban
// não é um chat de verdade — é um card disfarçado (agenteHotline:true) que
// reusa o campo de comentário + @menção. Aqui não precisa dessa camada: o
// nó novo (kanban/okr/agente_chat) É dedicado só pra conversar com o
// agente, então toda mensagem de um humano já é, por definição, um pedido
// pra ele — sem @menção nenhuma pra detectar.
//
// Escopo confirmado com o usuário via AskUserQuestion:
//   1. Central geral (não presa a um Objetivo específico) — fiel ao modelo
//      do card hotline, que também não é preso a nada.
//   2. Escreve direto nos campos (editar_campos_okr etc.), não só sugere.
//
// "Acesso aos pedidos feitos aqui" (2º pedido do usuário): NÃO criou um
// viewer de log separado — o próprio nó kanban/okr/agente_chat é permanente
// e compartilhado, então a conversa inteira (pedidos + respostas) já fica
// visível pra qualquer um que abrir a Central no painel, sem precisar de
// nada a mais. Diferente do 🧾 Histórico do Agente Ágil existente (que é
// por squad+card, não serviria pro domínio global de OKR).
//
// ESCRITA REAL desde o 1º deploy (dryRun:false) — decisão explícita do
// usuário via AskUserQuestion (2026-09-05): "Já libera escrita real",
// escolhida no lugar do modo sombra que mentionTrigger.js usou pra squad
// `dados` no início. Sem etapa intermediária de validar só o mecanismo —
// o agente já responde e edita os OKRs de verdade desde o primeiro deploy.

const { onValueCreated } = require('firebase-functions/v2/database');
const { defineSecret } = require('firebase-functions/params');
const { getDatabase } = require('firebase-admin/database');

const { buildOkrTools } = require('./agenteTools');
const { runLoop } = require('../agente-agil-orquestrador/loop');
const { escolheClienteParaTarefa } = require('../agente-agil-orquestrador/escolheClienteParaTarefa');
const { SYSTEM_PROMPT_OKR_V1 } = require('./agentePrompt');
const { isEnabled } = require('../agente-agil-orquestrador/limits');

const AGENTE_UID = 'agente-agil';
const IDEMPOTENCY_PATH = 'kanban/okr/agente_chat_processed';
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

async function writeNotif(db, uid, sub) {
  if (!uid) return;
  const id = 'n' + Date.now() + Math.random().toString(36).slice(2, 6);
  await db.ref(`kanban/usuarios/${uid}/notificacoes/${id}`).set({
    id,
    type: 'okr_agente',
    title: '🤖 Agente Ágil respondeu no chat de OKR',
    sub: sub || '',
    read: false,
    ts: new Date().toISOString(),
  });
}

async function processarMensagem(db, { msgId, message, llmClient, dryRun = true }) {
  // (1) Anti-auto-disparo — sempre primeiro, mesma ordem do orquestrador de card.
  if (!message || message.uid === AGENTE_UID) {
    return { processed: false, reason: 'self_message' };
  }
  if (!message.text || !message.text.trim()) {
    return { processed: false, reason: 'empty_message' };
  }

  // (2) Kill switch — MESMO switch global do orquestrador de card
  // (kanban/config/agente_agil_orquestrador/enabled). Um interruptor só pra
  // tudo que é Agente Ágil, deliberado.
  if (!(await isEnabled(db))) {
    return { processed: false, reason: 'disabled' };
  }

  // (3) Idempotência — mesma razão de sempre (RTDB não garante exatamente-uma-vez).
  const jaProcessado = await db.ref(`${IDEMPOTENCY_PATH}/${msgId}`).get();
  if (jaProcessado.exists()) {
    return { processed: false, reason: 'idempotent' };
  }

  const tools = buildOkrTools({ mode: 'real', db, requestingUid: message.uid, dryRun });

  const result = await runLoop({
    llmClient,
    tools,
    system: SYSTEM_PROMPT_OKR_V1,
    task: message.text,
    enabled: true, // kill switch já checado no passo (2)
  });

  // Rede de segurança — mesmo achado real do orquestrador de card (2026-08-18):
  // o modelo às vezes termina só com finalText, sem chamar a ferramenta de
  // resposta. Garante que a pessoa SEMPRE recebe alguma resposta no chat.
  const chamouResponder = result.steps.some((step) => step.toolCalls.some((call) => call.name === 'responder'));
  let fallbackResposta = false;
  if (!chamouResponder && result.finalText) {
    const responderTool = tools.find((t) => t.name === 'responder');
    if (responderTool) {
      await responderTool.handler({ texto: result.finalText });
      fallbackResposta = true;
    }
  }

  const respostaCall = result.steps.flatMap((s) => s.toolCalls).find((c) => c.name === 'responder');
  const respostaTexto = respostaCall?.input?.texto || result.finalText || '';
  if (respostaTexto) {
    await writeNotif(db, message.uid, respostaTexto.substring(0, 80) + (respostaTexto.length > 80 ? '…' : '')).catch((err) =>
      console.error('[okr-agente-chat] falha ao notificar:', msgId, err)
    );
  }

  // Marca DEPOIS de rodar — se o loop lançar exceção, a mensagem fica
  // elegível pra reprocessar numa próxima tentativa.
  await db.ref(`${IDEMPOTENCY_PATH}/${msgId}`).set({ at: new Date().toISOString(), status: result.status, dryRun, fallbackResposta });

  return { processed: true, result, fallbackResposta };
}

function resumirResultadoParaLog(result) {
  const chamadas = result.steps.flatMap((s) => s.toolCalls);
  const ferramentas = chamadas.length ? chamadas.map((c) => c.name).join(' -> ') : '(nenhuma)';
  return `status=${result.status} | ferramentas: ${ferramentas}`;
}

// dryRun:false (escrita real desde o 1º deploy) — ver comentário no topo do arquivo.
const DRY_RUN_OKR_CHAT = false;

const okrAgenteChat = onValueCreated(
  {
    ref: '/kanban/okr/agente_chat/{msgId}',
    region: 'us-central1',
    secrets: [ANTHROPIC_API_KEY],
  },
  async (event) => {
    const { msgId } = event.params;
    const message = event.data.val();
    const db = getDatabase();
    try {
      const { llmClient, tier } = await escolheClienteParaTarefa({ apiKey: ANTHROPIC_API_KEY.value(), taskText: message?.text, db });
      const outcome = await processarMensagem(db, { msgId, message, llmClient, dryRun: DRY_RUN_OKR_CHAT });
      if (outcome.processed) {
        const fallbackNote = outcome.fallbackResposta ? ' | FALLBACK: finalText postado como resposta' : '';
        console.log('[okr-agente-chat]', msgId, `dryRun=${DRY_RUN_OKR_CHAT} | tier=${tier} |`, resumirResultadoParaLog(outcome.result) + fallbackNote);
      } else {
        console.log('[okr-agente-chat]', msgId, `ignorado (${outcome.reason})`);
      }
    } catch (err) {
      console.error('[okr-agente-chat] falha ao processar mensagem:', msgId, err);
    }
  }
);

module.exports = { okrAgenteChat, processarMensagem, resumirResultadoParaLog, IDEMPOTENCY_PATH, AGENTE_UID, DRY_RUN_OKR_CHAT };
