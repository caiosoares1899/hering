#!/usr/bin/env node
// functions/agente-agil-orquestrador/scripts/llmRealDryRunContraSquadDev.js
//
// Primeiro script que gasta tokens de verdade contra a API da Anthropic —
// decisão deliberada, não efeito colateral de mais um teste (ver PR #74).
// Mesmo objetivo técnico do script anterior (dryRunContraSquadDev.js):
// validar o encanamento decide -> tool call -> handler real ->
// buildWritePlan contra o squad 'dev' real. A ÚNICA coisa que muda é o
// cliente: LLM de verdade no lugar do cliente scriptado — então agora
// estamos validando se o modelo consegue escolher a ferramenta certa dado
// um pedido claro, não só se o encanamento aceita uma tool call.
//
// dryRun continua FIXO em true (tools/realHandlers.js, DRY_RUN_FIXO) — nada
// é escrito de verdade, mesmo com o LLM real decidindo.
//
// O system prompt aqui é deliberadamente mínimo: só o suficiente pra
// confirmar que o modelo escolhe a ferramenta certa e para quando termina.
// NÃO tenta capturar a visão de PO completa (autoridade, quando perguntar
// vs decidir sozinho) — isso fica pra quando estivermos prontos pra validar
// decisões de produto de verdade, não só o encanamento técnico com IA de
// verdade no lugar do cliente scriptado.
//
// Segurança:
//   - ANTHROPIC_API_KEY só é lida de variável de ambiente. Nunca logada
//     (nem parcial/mascarada) em nenhum console.log/console.error daqui —
//     e nunca repassada pra dentro de nenhum objeto que este script imprime.
//   - dryRun fixo, kill switch sempre `enabled:true` explícito (nunca lido
//     como global escondida).
//
// Uso:
//   cd functions
//   ANTHROPIC_API_KEY=sk-ant-... node agente-agil-orquestrador/scripts/llmRealDryRunContraSquadDev.js [cardId]
//
// Custo esperado (ordem de grandeza, não exato — confira no seu console da
// Anthropic depois de rodar): tarefa simples de 1 ferramenta, deve resolver
// em ~2 idas e voltas ao modelo (1 tool call + 1 resposta final de texto —
// o script imprime o número exato de chamadas no final). Cada chamada
// carrega as 8 ferramentas (schemas pequenos) + histórico curto no input —
// poucos milhares de tokens de input no total, poucas centenas de tokens de
// output. Nesse volume é centavos de dólar, não dezenas de chamadas nem
// milhares de tokens.

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const { buildTools } = require('../tools');
const { runLoop } = require('../loop');
const { createAnthropicLlmClient } = require('../llmClient');

const SQUAD_ID = 'dev';
const DEFAULT_CARD_ID = 'c1785433909974'; // mesmo card de teste do script anterior
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://hering-onboarding-default-rtdb.firebaseio.com';

// Mínimo de propósito — só confirma escolha de ferramenta + parada natural,
// não a visão de PO completa (ver comentário no topo do arquivo).
const SYSTEM_PROMPT = `Você é o Agente Ágil, um assistente que age sobre um card específico de um board Kanban usando as ferramentas disponíveis.

Use a ferramenta certa para cumprir exatamente o que foi pedido. Depois de usar a ferramenta necessária, responda só com texto confirmando o que foi feito — não chame mais nenhuma ferramenta depois de concluir a tarefa.`;

async function main() {
  const cardId = process.argv[2] || DEFAULT_CARD_ID;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Defina ANTHROPIC_API_KEY no ambiente antes de rodar este script.');
    process.exit(1);
  }

  initializeApp({ credential: applicationDefault(), databaseURL: DATABASE_URL });
  const db = getDatabase();

  const tools = buildTools({ mode: 'real', db, squadId: SQUAD_ID, cardId });

  // Conta chamadas reais à API sem expor nada do cliente por baixo — só
  // encaminha decide() e incrementa um contador, pra reportar o custo real
  // no final em vez de estimar a partir de result.steps (que sub-conta a
  // última chamada quando o loop para naturalmente).
  let apiCallCount = 0;
  const rawLlmClient = createAnthropicLlmClient({ apiKey });
  const llmClient = {
    async decide(args) {
      apiCallCount++;
      return rawLlmClient.decide(args);
    },
  };

  console.log(`Rodando dryRun com LLM real contra squad "${SQUAD_ID}", card "${cardId}"...`);
  const result = await runLoop({
    llmClient,
    tools,
    system: SYSTEM_PROMPT,
    task: `Adicione um comentário no card ${cardId} dizendo: "[dryRun LLM real] Teste do orquestrador — ignore este comentário, nada foi escrito de verdade."`,
    enabled: true,
  });

  console.log('\n=== Resultado ===');
  console.log('status:', result.status);
  console.log('finalText:', result.finalText);

  console.log('\n=== Passos ===');
  for (const step of result.steps) {
    for (const call of step.toolCalls) {
      console.log(`\n[iteração ${step.iteration}] ferramenta: ${call.name}`);
      console.log('input:', JSON.stringify(call.input, null, 2));
      console.log('output.ok:', call.output.ok, '| output.dryRun:', call.output.dryRun);
      if (call.output.plan) {
        console.log('plano que SERIA aplicado (nada foi escrito de verdade):');
        console.log(JSON.stringify(call.output.plan, null, 2));
      }
      if (call.output.error) {
        console.log('erro:', call.output.error, call.output.message || '');
      }
    }
  }

  console.log(`\n${apiCallCount} chamada(s) à API da Anthropic no total.`);
  console.log('Nenhuma escrita real foi feita (dryRun fixo em tools/realHandlers.js).');
  process.exit(0);
}

main().catch((err) => {
  console.error('Falha ao rodar o script:', err.message || err);
  process.exit(1);
});
