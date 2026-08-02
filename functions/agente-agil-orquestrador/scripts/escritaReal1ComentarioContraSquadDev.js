#!/usr/bin/env node
// functions/agente-agil-orquestrador/scripts/escritaReal1ComentarioContraSquadDev.js
//
// PRIMEIRA ESCRITA REAL do orquestrador — não é dryRun. Depois da bateria de
// 5 cenários de validação (4 de julgamento + o cenário 5 de risco médio
// inequívoco, que também encontrou e corrigiu o bug de `type` faltando em
// tools/realHandlers.js), este é o primeiro script que passa `dryRun: false`
// pra `buildTools()` — `applyWritePlan()` É chamado de verdade.
//
// Autorizado explicitamente pelo usuário, com este desenho específico
// (ver conversa/README):
//   1. Mesmo card conhecido de sempre: c1785505159707_geo ("Revisão de
//      conteúdo do blog", squad 'dev').
//   2. Invocação manual via script — gatilho automático é decisão FUTURA
//      separada, não faz parte deste passo.
//   3. Restrito a ferramentas de BAIXO risco: o toolset passado ao loop é
//      filtrado pra só `ler_card` (leitura, sem risco) + `comentario`
//      (baixo risco) + `perguntar_humano` (não escreve nada). NÃO é uma
//      questão de confiar no julgamento do modelo pra se auto-restringir a
//      baixo risco — isso já foi validado no cenário 5, mas esta é a
//      PRIMEIRA escrita real de qualquer tipo, então a restrição é reforçada
//      em código: mover_coluna/editar_campos/etc. nem aparecem como opção
//      pro modelo aqui, mesmo que o system prompt já os desencoraje neste
//      cenário. mover_coluna real fica pro script seguinte (depois deste
//      sair limpo).
//   4. O pedido é real (resumir o status do card), não uma instrução
//      sintética tipo "chame a ferramenta comentario" — a ideia é ver o
//      modelo ESCOLHER comentario porque é a ação certa pro pedido, não
//      porque é a única disponível tecnicamente (ainda que também seja).
//   5. Exige confirmação interativa antes de chamar o LLM — a pessoa
//      rodando precisa estar olhando kanban-dev.html?squad=dev AO VIVO
//      (combinado como obrigatório) e confirmar digitando uma palavra
//      exata, não só apertar Enter.
//
// ANTHROPIC_API_KEY só de variável de ambiente, nunca logada.
//
// Uso:
//   cd functions
//   ANTHROPIC_API_KEY=sk-ant-... node agente-agil-orquestrador/scripts/escritaReal1ComentarioContraSquadDev.js <cardId>
//
// cardId é OBRIGATÓRIO, sem default — escrita real não deveria nunca ter um
// alvo implícito. Use c1785505159707_geo (combinado) a menos que haja um
// motivo explícito pra usar outro.
//
// Custo esperado: ler_card + comentario (+ talvez 1 iteração final de
// texto) — ordem de centavos de dólar.

const readline = require('node:readline/promises');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const { buildTools } = require('../tools');
const { runLoop } = require('../loop');
const { createAnthropicLlmClient } = require('../llmClient');
const { SYSTEM_PROMPT_V1 } = require('../systemPrompt');

const SQUAD_ID = 'dev';
const TOOLS_PERMITIDAS = new Set(['ler_card', 'comentario', 'perguntar_humano']);
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://hering-onboarding-default-rtdb.firebaseio.com';

async function confirmarAoVivo(cardId) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\n=== ATENÇÃO: ESCRITA REAL, NÃO É DRYRUN ===');
  console.log(`Isso vai escrever de verdade no card "${cardId}" do squad "${SQUAD_ID}".`);
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
    console.error('Card combinado pra esta primeira escrita real: c1785505159707_geo');
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

  const task = `Dá uma olhada nesse card (${cardId}) e deixa um comentário resumindo o status atual pra quem for acompanhar depois.`;

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

  const escreveu = result.steps.some((s) => s.toolCalls.some((c) => c.name === 'comentario' && c.output.ok && c.output.dryRun === false));
  if (escreveu) {
    console.log('\nESCRITA REAL CONFIRMADA: comentario aplicado de verdade (output.dryRun: false, output.applied > 0).');
    console.log('Confira no kanban-dev.html?squad=dev, ao vivo, que o comentário apareceu no card.');
  } else if (result.status === 'awaiting_human') {
    console.log('\nModelo travou em perguntar_humano — nenhuma escrita real aconteceu. Revisar a pergunta acima.');
  } else {
    console.log('\nNenhuma escrita real de comentario detectada nos passos — revisar a saída acima.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Falha ao rodar o script:', err.message || err);
  process.exit(1);
});
