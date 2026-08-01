#!/usr/bin/env node
// functions/agente-agil-orquestrador/scripts/dryRunContraSquadDev.js
//
// Script standalone — NÃO faz parte de `npm test` nem de nenhum deploy.
// Roda contra o Firebase de VERDADE (squad 'dev', o squad fictício de teste
// já usado pelo painel-dev), não contra um fake db. Precisa de credenciais
// reais (Application Default Credentials — `gcloud auth application-default
// login`, ou GOOGLE_APPLICATION_CREDENTIALS apontando pra uma service
// account), exatamente como qualquer `firebase deploy` já precisa.
//
// Objetivo: validar o encanamento técnico ponta a ponta (LLM decide -> tool
// call -> handler real -> buildWritePlan) contra o FORMATO REAL dos dados do
// squad 'dev' — card de verdade, criado manualmente pelo painel/board — em
// vez de um fake db montado à mão (isso já está coberto em
// __tests__/realHandlers.test.js). dryRun continua true por padrão$
// (este script não passa dryRun:false, ver tools/realHandlers.js): NADA é escrito de verdade,
// mesmo rodando contra o Firebase real. O cliente LLM também continua
// scriptado (não o real) — decisão deliberada, ligar o LLM de verdade é um
// passo futuro separado, com system prompt e visão de produto ainda por
// desenhar (não faria sentido desenhar isso agora: um cliente scriptado
// ignora o `system` que passamos pra decide()).
//
// Uso:
//   cd functions
//   node agente-agil-orquestrador/scripts/dryRunContraSquadDev.js [cardId]
//   (cardId default: o card de teste já criado em kanban-dev.html?squad=dev)
//
// Variável de ambiente opcional:
//   FIREBASE_DATABASE_URL — default: mesmo default hardcoded em
//   kanban.html/kanban-dev.html (https://hering-onboarding-default-rtdb.firebaseio.com)

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const { buildTools } = require('../tools');
const { runLoop } = require('../loop');

const SQUAD_ID = 'dev';
const DEFAULT_CARD_ID = 'c1785433909974'; // card de teste criado manualmente em kanban-dev.html?squad=dev
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://hering-onboarding-default-rtdb.firebaseio.com';

// Sequência fixa e determinística — mesmo cliente scriptado usado em
// __tests__/loop.test.js e __tests__/realHandlers.test.js, só que agora
// batendo em handlers reais contra dados reais. Um único comentário e para —
// suficiente pra validar o caminho inteiro; dryRun fixo cuida do resto.
function scriptedLlmClient() {
  let called = false;
  return {
    async decide() {
      if (!called) {
        called = true;
        return {
          toolCalls: [
            {
              id: 'dryrun-1',
              name: 'comentario',
              input: {
                type: 'comentario',
                texto: '[dryRun] Testando o caminho de escrita real do orquestrador — este comentário NUNCA deveria aparecer de verdade no card.',
              },
            },
          ],
          text: null,
        };
      }
      return { toolCalls: [], text: 'dryRun concluído.' };
    },
  };
}

async function main() {
  const cardId = process.argv[2] || DEFAULT_CARD_ID;

  initializeApp({ credential: applicationDefault(), databaseURL: DATABASE_URL });
  const db = getDatabase();

  const tools = buildTools({ mode: 'real', db, squadId: SQUAD_ID, cardId });
  const llmClient = scriptedLlmClient();

  console.log(`Rodando dryRun do orquestrador contra squad "${SQUAD_ID}", card "${cardId}"...`);
  const result = await runLoop({
    llmClient,
    tools,
    system: 'Você é o Agente Ágil orquestrador. (system prompt real ainda não definido — este script só valida encanamento técnico.)',
    task: `Adicione um comentário de teste no card ${cardId}.`,
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

  console.log('\nNenhuma escrita real foi feita (dryRun fixo em tools/realHandlers.js). Revise o(s) plano(s) acima antes de considerar este caminho validado.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Falha ao rodar o script:', err);
  process.exit(1);
});
