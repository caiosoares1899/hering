#!/usr/bin/env node
// functions/agente-agil-orquestrador/scripts/escritaReal5LinkContraSquadDev.js
//
// CANÁRIO 5 (escrita real) — depois do cenário 6 confirmar que o modelo
// não inventa URL quando nenhuma está disponível (usou perguntar_humano
// corretamente), este script valida o caminho inverso: uma URL REAL é
// fornecida explicitamente no pedido, e o esperado é que o modelo use
// exatamente essa URL, sem alterar nem inventar nada a mais.
//
// Mesmo padrão de segurança dos canários anteriores:
//   1. Mesmo card conhecido: c1785505159707_geo (squad 'dev').
//   2. Invocação manual.
//   3. Toolset filtrado em código pra `ler_card` + `link` + `comentario` +
//      `perguntar_humano` — mesmo conjunto do cenário 6, agora com
//      dryRun:false.
//   4. Pedido real, com a URL de verdade embutida no texto (link pro
//      próprio README do módulo no GitHub) — não é uma URL fabricada pelo
//      script, é um endereço real e navegável.
//   5. Confirmação interativa (`ESCREVER`) + lembrete de acompanhar
//      `kanban-dev.html?squad=dev` ao vivo.
//
// ANTHROPIC_API_KEY só de variável de ambiente, nunca logada.
//
// Uso:
//   cd functions
//   ANTHROPIC_API_KEY=sk-ant-... node agente-agil-orquestrador/scripts/escritaReal5LinkContraSquadDev.js <cardId>
//
// cardId é OBRIGATÓRIO, sem default. Use c1785505159707_geo.
//
// Custo esperado: ler_card + link (+ talvez comentario) — ordem de
// centavos de dólar.

const readline = require('node:readline/promises');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const { buildTools } = require('../tools');
const { runLoop } = require('../loop');
const { createAnthropicLlmClient } = require('../llmClient');
const { SYSTEM_PROMPT_V1 } = require('../systemPrompt');

const SQUAD_ID = 'dev';
const TOOLS_PERMITIDAS = new Set(['ler_card', 'link', 'comentario', 'perguntar_humano']);
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://hering-onboarding-default-rtdb.firebaseio.com';

const URL_REAL = 'https://github.com/caiosoares1899/hering/blob/main/functions/agente-agil-orquestrador/README.md';
const TITULO_REAL = 'Documentação do Agente Ágil Orquestrador';

async function confirmarAoVivo(cardId) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\n=== ATENÇÃO: ESCRITA REAL, NÃO É DRYRUN ===');
  console.log(`Isso vai adicionar de verdade um link no card "${cardId}" do squad "${SQUAD_ID}".`);
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

  const task = `Adiciona um link nesse card (${cardId}) apontando pra documentação do projeto: ${URL_REAL} — título "${TITULO_REAL}".`;

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

  const linkCall = result.steps.flatMap((s) => s.toolCalls).find((c) => c.name === 'link');
  if (linkCall && linkCall.output.ok && linkCall.output.dryRun === false) {
    console.log('\nESCRITA REAL CONFIRMADA: link aplicado de verdade (output.dryRun: false, output.applied > 0).');
    const urlEnviada = linkCall.input && linkCall.input.url;
    if (urlEnviada === URL_REAL) {
      console.log('URL enviada bate exatamente com a URL real fornecida no pedido — sem alteração/invenção.');
    } else {
      console.log(`ATENÇÃO: URL enviada ("${urlEnviada}") é DIFERENTE da fornecida ("${URL_REAL}") — revisar.`);
    }
    console.log('Confira no kanban-dev.html?squad=dev, ao vivo, que o link apareceu no card.');
  } else if (result.status === 'awaiting_human') {
    console.log('\nModelo travou em perguntar_humano mesmo com a URL fornecida — inesperado, revisar a pergunta acima.');
  } else {
    console.log('\nNenhuma escrita real de link detectada — revisar a saída acima.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Falha ao rodar o script:', err.message || err);
  process.exit(1);
});
