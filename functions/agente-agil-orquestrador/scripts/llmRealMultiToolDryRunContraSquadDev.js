#!/usr/bin/env node
// functions/agente-agil-orquestrador/scripts/llmRealMultiToolDryRunContraSquadDev.js
//
// Mesmo objetivo dos dois scripts anteriores (validar o encanamento contra o
// squad 'dev' real), mas com uma tarefa que precisa de DUAS ferramentas
// (comentario + mover_coluna) em vez de uma só — a única forma de exercitar
// contra a API de verdade a parte do loop que o teste de 1 ferramenta nunca
// tocou: o histórico de tool_result sendo re-enviado pro modelo entre a 1ª
// e a 2ª chamada (ver historyToAnthropicMessages() em llmClient.js). O
// script anterior (llmRealDryRunContraSquadDev.js) parou na primeira
// resposta — nunca chegou a montar esse histórico multi-turno.
//
// dryRun continua FIXO em true, mesmos princípios de segurança dos scripts
// anteriores: ANTHROPIC_API_KEY só de variável de ambiente, nunca logada.
//
// mover_coluna exige o ID exato da coluna de destino (não o nome/label) —
// o orquestrador não tem nenhuma ferramenta de LEITURA ainda pra descobrir
// isso sozinho (só as 7 de escrita + perguntar_humano). Por isso ESTE
// SCRIPT lê a coluna atual do card e a lista de colunas do squad 'dev'
// direto do Firebase antes de montar a tarefa, e informa ambas (id + nome)
// no texto — o LLM não precisa adivinhar nada, só decidir o que fazer com
// a informação que já tem (é exatamente esse "decidir com a informação
// dada" que este teste quer validar, não a leitura do board em si).
//
// System prompt continua o mesmo mínimo dos scripts anteriores — só
// confirma escolha/encadeamento de ferramentas + parada natural, não a
// visão de PO completa.
//
// Uso:
//   cd functions
//   ANTHROPIC_API_KEY=sk-ant-... node agente-agil-orquestrador/scripts/llmRealMultiToolDryRunContraSquadDev.js [cardId]
//
// Custo esperado (ordem de grandeza, não exato): ~3 idas e voltas ao modelo
// (2 tool calls + 1 resposta final) — um pouco mais que o teste de 1
// ferramenta, ainda ordem de centavos de dólar. O script imprime o número
// exato de chamadas no final.

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const { resolveCardKey, cardsPath } = require('../../agente-agil/board');
const flowLib = require('../../agente-agil/flow');
const { buildTools } = require('../tools');
const { runLoop } = require('../loop');
const { createAnthropicLlmClient } = require('../llmClient');

const SQUAD_ID = 'dev';
const DEFAULT_CARD_ID = 'c1785433909974'; // mesmo card de teste dos scripts anteriores
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://hering-onboarding-default-rtdb.firebaseio.com';

const SYSTEM_PROMPT = `Você é o Agente Ágil, um assistente que age sobre um card específico de um board Kanban usando as ferramentas disponíveis.

Use as ferramentas certas, na ordem que fizer sentido, para cumprir exatamente o que foi pedido — pode chamar mais de uma ferramenta se a tarefa precisar. Depois de concluir tudo o que foi pedido, responda só com texto confirmando o que foi feito — não chame mais nenhuma ferramenta depois de concluir a tarefa.`;

async function pickDestinationColumn(db, squadId, cardKey) {
  const [colSnap, meta] = await Promise.all([
    db.ref(`${cardsPath(squadId)}/${cardKey}/col`).get(),
    flowLib.readFlowMeta(db, squadId),
  ]);
  const currentCol = colSnap.val();
  const destino = (meta.columns || []).find((c) => c.id !== currentCol);
  if (!destino) {
    throw new Error(`Squad "${squadId}" não tem nenhuma coluna diferente da atual ("${currentCol}") pra usar como destino do teste.`);
  }
  return { currentCol, destino };
}

async function main() {
  const cardId = process.argv[2] || DEFAULT_CARD_ID;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Defina ANTHROPIC_API_KEY no ambiente antes de rodar este script.');
    process.exit(1);
  }

  initializeApp({ credential: applicationDefault(), databaseURL: DATABASE_URL });
  const db = getDatabase();

  const cardKey = await resolveCardKey(db, cardId, { squadId: SQUAD_ID });
  if (!cardKey) {
    console.error(`Card "${cardId}" não encontrado no squad "${SQUAD_ID}".`);
    process.exit(1);
  }
  const { currentCol, destino } = await pickDestinationColumn(db, SQUAD_ID, cardKey);

  const tools = buildTools({ mode: 'real', db, squadId: SQUAD_ID, cardId });

  // Mesmo contador dedicado dos scripts anteriores — reporta o custo real
  // em vez de estimar a partir de result.steps.
  let apiCallCount = 0;
  const rawLlmClient = createAnthropicLlmClient({ apiKey });
  const llmClient = {
    async decide(args) {
      apiCallCount++;
      return rawLlmClient.decide(args);
    },
  };

  const task = `Faça DUAS coisas neste card (${cardId}), nesta ordem:
1. Adicione um comentário dizendo: "[dryRun LLM real] Teste de encadeamento de ferramentas — ignore este comentário, nada foi escrito de verdade."
2. Mova o card para a coluna "${destino.name}" (use exatamente "${destino.id}" no campo "coluna"). A coluna atual do card é "${currentCol}".`;

  console.log(`Rodando dryRun com LLM real (2 ferramentas) contra squad "${SQUAD_ID}", card "${cardId}" (coluna atual: "${currentCol}", destino: "${destino.id}")...`);
  const result = await runLoop({
    llmClient,
    tools,
    system: SYSTEM_PROMPT,
    task,
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

  const ferramentasUsadas = result.steps.flatMap((s) => s.toolCalls.map((c) => c.name));
  console.log(`\nFerramentas usadas, na ordem: ${ferramentasUsadas.join(' -> ') || '(nenhuma)'}`);
  console.log(`${apiCallCount} chamada(s) à API da Anthropic no total.`);
  console.log('Nenhuma escrita real foi feita (dryRun fixo em tools/realHandlers.js).');
  process.exit(0);
}

main().catch((err) => {
  console.error('Falha ao rodar o script:', err.message || err);
  process.exit(1);
});
