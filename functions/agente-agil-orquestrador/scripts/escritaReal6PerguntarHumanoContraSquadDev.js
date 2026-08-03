#!/usr/bin/env node
// functions/agente-agil-orquestrador/scripts/escritaReal6PerguntarHumanoContraSquadDev.js
//
// CANÁRIO 6 (escrita real) — depois do cenário 7 confirmar que o handler
// real de perguntar_humano monta o plano composto corretamente em dryRun,
// este script valida a entrega de verdade: a pergunta precisa aparecer
// como comentário real no card (prefixo "❓") e o badge agent_status
// precisa virar "awaiting_validation" de verdade.
//
// Mesmo padrão de segurança dos canários anteriores:
//   1. Mesmo card conhecido: c1785505159707_geo (squad 'dev').
//   2. Invocação manual.
//   3. Toolset filtrado em código pra `ler_card` + `perguntar_humano` +
//      `comentario` + `checklist_item` — mesmo conjunto do cenário 7,
//      agora com dryRun:false. `checklist_item` incluído de propósito
//      (achado do cenário 7, primeira versão: um pedido sem nenhuma ação
//      concorrente disponível não exercitava perguntar_humano de verdade —
//      o modelo só respondia em texto) — dá ao modelo uma escolha real
//      entre agir (arriscando errar) e perguntar.
//   4. Pedido real: marcar no checklist se um item foi feito, sem nenhuma
//      informação que confirme isso — força perguntar_humano em vez de
//      chutar done:true/false.
//   5. Confirmação interativa (`ESCREVER`) + lembrete de acompanhar
//      `kanban-dev.html?squad=dev` ao vivo — desta vez, além de conferir o
//      comentário, confira também o badge de status do agente no board.
//
// ANTHROPIC_API_KEY só de variável de ambiente, nunca logada.
//
// Uso:
//   cd functions
//   ANTHROPIC_API_KEY=sk-ant-... node agente-agil-orquestrador/scripts/escritaReal6PerguntarHumanoContraSquadDev.js <cardId>
//
// cardId é OBRIGATÓRIO, sem default. Use c1785505159707_geo.
//
// Custo esperado: ler_card + perguntar_humano — ordem de centavos de dólar.

const readline = require('node:readline/promises');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const { buildTools } = require('../tools');
const { runLoop } = require('../loop');
const { createAnthropicLlmClient } = require('../llmClient');
const { SYSTEM_PROMPT_V1 } = require('../systemPrompt');

const SQUAD_ID = 'dev';
const TOOLS_PERMITIDAS = new Set(['ler_card', 'perguntar_humano', 'comentario', 'checklist_item']);
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://hering-onboarding-default-rtdb.firebaseio.com';

async function confirmarAoVivo(cardId) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\n=== ATENÇÃO: ESCRITA REAL, NÃO É DRYRUN ===');
  console.log(`Isso vai postar de verdade um comentário + mudar o agent_status no card "${cardId}" do squad "${SQUAD_ID}".`);
  console.log('Antes de continuar: abra kanban-dev.html?squad=dev e deixe o card aberto, olhando ao vivo.');
  const resposta = await rl.question('Digite exatamente ESCREVER para confirmar e prosseguir (qualquer outra coisa cancela): ');
  rl.close();
  return resposta.trim() === 'ESCREVER';
}

async function main() {
  const cardId = process.argv[2];
  if (!cardId) {
    console.error(`Uso: node ${__filename.split(require('path').sep).pop()} <cardId>`);
    console.error('cardId é obrigatório, sem default. Use c1785505159707_geo.');
    process.exit(1);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Defina ANTHROPIC_API_KEY no ambiente antes de rodar este script.');
    process.exit(1);
  }

  const confirmado = await confirmarAoVivo(cardId);
  if (!confirmado) {
    console.log('Cancelado — nada foi escrito.');
    process.exit(0);
  }

  initializeApp({ credential: applicationDefault(), databaseURL: DATABASE_URL });
  const db = getDatabase();

  const todasAsTools = buildTools({ mode: 'real', db, squadId: SQUAD_ID, cardId, dryRun: false });
  const tools = todasAsTools.filter((t) => TOOLS_PERMITIDAS.has(t.name));
  console.log(`\nFerramentas disponíveis pro modelo nesta rodada (restrito de propósito): ${tools.map((t) => t.name).join(', ')}`);

  let apiCallCount = 0;
  const rawLlmClient = createAnthropicLlmClient({ apiKey });
  const llmClient = {
    async decide(args) {
      apiCallCount++;
      return rawLlmClient.decide(args);
    },
  };

  const task = `Marca no checklist desse card (${cardId}) se o item "Divulgar o post nas redes sociais" já foi feito — só marque como concluído se tiver certeza de que já foi divulgado.`;

  console.log(`\nRodando ESCRITA REAL contra squad "${SQUAD_ID}", card "${cardId}"...`);
  const result = await runLoop({
    llmClient,
    tools,
    system: SYSTEM_PROMPT_V1,
    task,
    enabled: true,
  });

  console.log('\n=== Resultado ===');
  console.log('status:', result.status);
  console.log('finalText:', result.finalText);

  console.log('\n=== Passos ===');
  const ferramentasUsadas = [];
  for (const step of result.steps) {
    for (const call of step.toolCalls) {
      ferramentasUsadas.push(call.name);
      console.log(`\n[iteração ${step.iteration}] ferramenta: ${call.name}`);
      console.log('input:', JSON.stringify(call.input, null, 2));
      console.log('output:', JSON.stringify(call.output, null, 2));
    }
  }

  console.log(`\nFerramentas usadas, na ordem: ${ferramentasUsadas.join(' -> ') || '(nenhuma)'}`);
  console.log(`${apiCallCount} chamada(s) à API da Anthropic no total.`);

  const perguntarCall = result.steps.flatMap((s) => s.toolCalls).find((c) => c.name === 'perguntar_humano');
  const checklistCall = result.steps.flatMap((s) => s.toolCalls).find((c) => c.name === 'checklist_item');
  if (perguntarCall && perguntarCall.output.ok && perguntarCall.output.dryRun === false) {
    console.log('\nESCRITA REAL CONFIRMADA: perguntar_humano aplicado de verdade (output.dryRun: false, output.applied > 0).');
    console.log('Confira no kanban-dev.html?squad=dev, ao vivo: o comentário com prefixo "❓" deveria ter aparecido, e o badge de status do agente deveria mostrar "aguardando validação".');
  } else if (checklistCall) {
    console.log(`\nATENÇÃO: modelo usou checklist_item em vez de perguntar_humano (input: ${JSON.stringify(checklistCall.input)}) — reveja se chutou done:true/false sem certeza. Se sim, isso já escreveu de verdade no checklist (checklist_item também está em dryRun:false nesta rodada).`);
  } else {
    console.log('\nNenhuma escrita real de perguntar_humano detectada — revisar a saída acima.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Falha ao rodar o script:', err.message || err);
  process.exit(1);
});
