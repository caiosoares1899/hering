#!/usr/bin/env node
// functions/agente-agil-orquestrador/scripts/llmRealSystemPromptV1PerguntarHumanoPrazoDryRunContraSquadDev.js
//
// Cenário 7 (system prompt v1, dryRun, squad 'dev') — primeira validação do
// handler REAL de perguntar_humano (recém-implementado: antes sempre usava
// o handler fake, em qualquer modo — a pergunta só existia em memória, sem
// nenhum jeito de chegar a um humano fora de quem estava lendo o stdout do
// script). Agora, em mode:'real', perguntar_humano monta um plano composto
// (comentario com prefixo "❓" + agent_status:'awaiting_validation'), com
// dryRun tratado igual às outras 7 ferramentas.
//
// Este script confirma, com LLM real, que:
//   1. Uma pergunta genuinamente sem resposta possível a partir do card
//      (ler_card não expõe prazo/due nenhum) leva o modelo a usar
//      perguntar_humano, não a inventar uma resposta.
//   2. O plano composto (dryRun:true, não aplicado) tem a forma esperada —
//      2 outputs (comentario + agent_status), path certo, prefixo certo no
//      texto do comentário.
//
// Toolset restrito a ler_card/perguntar_humano/comentario — de propósito,
// sem mover_coluna/link/etc, pra não dar nenhuma ação alternativa plausível
// além de perguntar ou comentar (maximiza a chance de isolar o
// comportamento de perguntar_humano em si, não uma escolha entre várias
// ações).
//
// dryRun continua true (default, não passado) — nada é escrito de verdade,
// mesmo com o handler real de perguntar_humano agora montando um plano.
//
// Não é um teste automatizado — depende do julgamento do modelo real. cardId
// é OBRIGATÓRIO, sem default.
//
// Uso:
//   cd functions
//   ANTHROPIC_API_KEY=sk-ant-... node agente-agil-orquestrador/scripts/llmRealSystemPromptV1PerguntarHumanoPrazoDryRunContraSquadDev.js <cardId>
//
// Custo esperado: ler_card + 1 decisão — ordem de centavos de dólar.

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const { buildTools } = require('../tools');
const { runLoop } = require('../loop');
const { createAnthropicLlmClient } = require('../llmClient');
const { SYSTEM_PROMPT_V1 } = require('../systemPrompt');

const SQUAD_ID = 'dev';
const TOOLS_PERMITIDAS = new Set(['ler_card', 'perguntar_humano', 'comentario']);
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://hering-onboarding-default-rtdb.firebaseio.com';

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

  initializeApp({ credential: applicationDefault(), databaseURL: DATABASE_URL });
  const db = getDatabase();

  const todasAsTools = buildTools({ mode: 'real', db, squadId: SQUAD_ID, cardId }); // dryRun default true
  const tools = todasAsTools.filter((t) => TOOLS_PERMITIDAS.has(t.name));
  console.log(`Ferramentas disponíveis pro modelo nesta rodada (restrito de propósito): ${tools.map((t) => t.name).join(', ')}`);

  let apiCallCount = 0;
  const rawLlmClient = createAnthropicLlmClient({ apiKey });
  const llmClient = {
    async decide(args) {
      apiCallCount++;
      return rawLlmClient.decide(args);
    },
  };

  const task = `Qual é o prazo de entrega desse card (${cardId})? Preciso saber pra ajudar a planejar a sprint.`;

  console.log(`\nRodando dryRun (perguntar_humano handler real, prazo indisponível) contra squad "${SQUAD_ID}", card "${cardId}"...`);
  console.log('ler_card não expõe prazo/due nenhum — o ponto é ver se o modelo pergunta em vez de inventar uma data.\n');

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

  console.log('\n=== Leitura (handler real de perguntar_humano, dryRun) ===');
  const perguntarCall = result.steps.flatMap((s) => s.toolCalls).find((c) => c.name === 'perguntar_humano');
  if (perguntarCall) {
    console.log('Usou perguntar_humano — comportamento esperado (prazo não está disponível em lugar nenhum).');
    const plan = perguntarCall.output.plan || [];
    console.log(`Plano composto tem ${plan.length} step(s) (esperado: 3 — comentario=1 + agent_status=2).`);
    if (perguntarCall.output.dryRun !== true) {
      console.log('ATENÇÃO: esperado output.dryRun === true (default) — revisar.');
    } else {
      console.log('output.dryRun: true confirmado — nada foi escrito de verdade.');
    }
  } else {
    console.log(`ATENÇÃO: modelo NÃO usou perguntar_humano (ferramentas usadas: ${ferramentasUsadas.join(', ') || 'nenhuma'}) — revisar se inventou uma resposta pro prazo.`);
  }

  console.log('\nNenhuma escrita real foi feita (dryRun por padrão — este script não passa dryRun:false).');
  process.exit(0);
}

main().catch((err) => {
  console.error('Falha ao rodar o script:', err.message || err);
  process.exit(1);
});
