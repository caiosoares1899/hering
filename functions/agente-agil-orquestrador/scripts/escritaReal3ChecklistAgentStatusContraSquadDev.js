#!/usr/bin/env node
// functions/agente-agil-orquestrador/scripts/escritaReal3ChecklistAgentStatusContraSquadDev.js
//
// TERCEIRA ESCRITA REAL do orquestrador (canário 3) — depois dos canários 1
// (comentario) e 2 (mover_coluna) confirmados pelo usuário contra o
// Firebase real. Primeira expansão de toolset desde então: adiciona
// `checklist_item` e `agent_status`, as duas ferramentas restantes já
// classificadas como "baixo risco, age direto" no SYSTEM_PROMPT_V1 (mesmo
// nível de `comentario`).
//
// Diferente de mover_coluna (cenário 5 dedicado antes do canário, por ser
// risco médio), o usuário combinou pular o cenário de julgamento dedicado
// pra este par — canário direto, mesmo padrão de segurança de sempre:
//   1. Mesmo card conhecido: c1785505159707_geo (squad 'dev').
//   2. Invocação manual.
//   3. Toolset filtrado em código pra `ler_card` + `checklist_item` +
//      `agent_status` + `comentario` + `perguntar_humano` — `mover_coluna`/
//      `editar_campos`/`link`/`relatorio_html` continuam de fora, sem
//      motivo pra estarem acessíveis neste cenário.
//   4. Pedido real (não instrução sintética nomeando a ferramenta).
//   5. Confirmação interativa (`ESCREVER`) + lembrete de acompanhar
//      `kanban-dev.html?squad=dev` ao vivo.
//
// checklist_item cria o item se ele ainda não existir (casamento por texto
// EXATO contra itens existentes, ver outputs/checklistItem.js) — a tarefa
// abaixo pede um item novo de propósito (não tenta marcar um dos 5 já
// existentes), pra exercitar o caminho de criação sem depender de o modelo
// copiar um texto existente perfeitamente.
//
// ANTHROPIC_API_KEY só de variável de ambiente, nunca logada.
//
// Uso:
//   cd functions
//   ANTHROPIC_API_KEY=sk-ant-... node agente-agil-orquestrador/scripts/escritaReal3ChecklistAgentStatusContraSquadDev.js <cardId>
//
// cardId é OBRIGATÓRIO, sem default. Use c1785505159707_geo (combinado).
//
// Custo esperado: ler_card + checklist_item + agent_status (+ talvez
// comentario) — ordem de centavos de dólar.

const readline = require('node:readline/promises');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const { buildTools } = require('../tools');
const { runLoop } = require('../loop');
const { createAnthropicLlmClient } = require('../llmClient');
const { SYSTEM_PROMPT_V1 } = require('../systemPrompt');

const SQUAD_ID = 'dev';
const TOOLS_PERMITIDAS = new Set(['ler_card', 'checklist_item', 'agent_status', 'comentario', 'perguntar_humano']);
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://hering-onboarding-default-rtdb.firebaseio.com';

async function confirmarAoVivo(cardId) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\n=== ATENÇÃO: ESCRITA REAL, NÃO É DRYRUN ===');
  console.log(`Isso vai escrever de verdade no card "${cardId}" do squad "${SQUAD_ID}" (checklist_item + agent_status).`);
  console.log('Antes de continuar: abra kanban-dev.html?squad=dev e deixe o card aberto, olhando ao vivo.');
  const resposta = await rl.question('Digite exatamente ESCREVER para confirmar e prosseguir (qualquer outra coisa cancela): ');
  rl.close();
  return resposta.trim() === 'ESCREVER';
}

async function main() {
  const cardId = process.argv[2];
  if (!cardId) {
    console.error(`Uso: node ${__filename.split(require('path').sep).pop()} <cardId>`);
    console.error('cardId é obrigatório, sem default — escrita real não deveria ter alvo implícito.');
    console.error('Card combinado pra esta rodada: c1785505159707_geo');
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

  const task = `Adiciona um item novo no checklist desse card (${cardId}): "Divulgar o post nas redes sociais" — ainda não feito, só cria o item pendente. Depois, atualiza seu status de execução indicando que você concluiu essa tarefa.`;

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

  const escreveuChecklist = result.steps.some((s) => s.toolCalls.some((c) => c.name === 'checklist_item' && c.output.ok && c.output.dryRun === false));
  const escreveuStatus = result.steps.some((s) => s.toolCalls.some((c) => c.name === 'agent_status' && c.output.ok && c.output.dryRun === false));
  console.log(`\ncheckist_item aplicado de verdade: ${escreveuChecklist}`);
  console.log(`agent_status aplicado de verdade: ${escreveuStatus}`);
  if (escreveuChecklist || escreveuStatus) {
    console.log('Confira no kanban-dev.html?squad=dev, ao vivo, que o card mudou.');
  } else if (result.status === 'awaiting_human') {
    console.log('Modelo travou em perguntar_humano — nenhuma escrita real aconteceu. Revisar a pergunta acima.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Falha ao rodar o script:', err.message || err);
  process.exit(1);
});
