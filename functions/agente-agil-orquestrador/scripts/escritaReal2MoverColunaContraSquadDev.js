#!/usr/bin/env node
// functions/agente-agil-orquestrador/scripts/escritaReal2MoverColunaContraSquadDev.js
//
// SEGUNDA ESCRITA REAL do orquestrador (canário 2) — depois de
// escritaReal1ComentarioContraSquadDev.js ter saído limpo (comentário real
// aplicado com sucesso, conferido ao vivo pelo usuário no card
// c1785505159707_geo). Mesmo padrão de segurança do canário 1, mas agora
// testando a ação de risco MÉDIO (mover_coluna) de verdade, não mais só em
// dryRun — mesmo cenário já validado em dryRun no cenário 5
// (llmRealSystemPromptV1MoverColunaInequivocoDryRunContraSquadDev.js:
// pedido direto e fechado + checklist 100% completo, sem ambiguidade).
//
// Desenho combinado com o usuário:
//   1. Mesmo card conhecido: c1785505159707_geo (já tem o comentário do
//      canário 1 — não é resetado, roda em cima do estado real atual).
//   2. Invocação manual — gatilho automático continua fora de escopo.
//   3. Toolset ainda restrito, agora ao que o cenário precisa: `ler_card`
//      (contexto), `mover_coluna` (a ação sendo validada), `comentario`
//      (o cenário 5 mostrou o modelo usando os dois em sequência pra
//      explicar o raciocínio) e `perguntar_humano` (válvula de segurança,
//      sempre disponível). `editar_campos`/`checklist_item`/`agent_status`/
//      `link`/`relatorio_html` continuam de fora — não fazem parte deste
//      cenário, sem motivo pra estarem acessíveis.
//   4. Confirmação interativa (`ESCREVER`) + lembrete de acompanhar
//      `kanban-dev.html?squad=dev` ao vivo, igual ao canário 1.
//
// mover_coluna exige o ID exato da coluna de destino — mesmo padrão do
// cenário 5, resolve "Concluído" via flowLib.doneColumnIds() (fonte de
// verdade oficial, flowConfig.doneCols) antes de montar a tarefa, informa
// id + nome no texto. O LLM não precisa adivinhar nada.
//
// ANTHROPIC_API_KEY só de variável de ambiente, nunca logada.
//
// Uso:
//   cd functions
//   ANTHROPIC_API_KEY=sk-ant-... node agente-agil-orquestrador/scripts/escritaReal2MoverColunaContraSquadDev.js <cardId>
//
// cardId é OBRIGATÓRIO, sem default. Use c1785505159707_geo (combinado) a
// menos que haja um motivo explícito pra usar outro card — e confirme antes
// que o checklist dele está 100% completo e que ele não está já na coluna
// de destino (o script recusa rodar nesse caso).
//
// Custo esperado: ler_card + mover_coluna (+ talvez comentario) — ordem de
// centavos de dólar.

const readline = require('node:readline/promises');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const { resolveCardKey, cardsPath } = require('../../agente-agil/board');
const flowLib = require('../../agente-agil/flow');
const { buildTools } = require('../tools');
const { runLoop } = require('../loop');
const { createAnthropicLlmClient } = require('../llmClient');
const { SYSTEM_PROMPT_V1 } = require('../systemPrompt');

const SQUAD_ID = 'dev';
const TOOLS_PERMITIDAS = new Set(['ler_card', 'mover_coluna', 'comentario', 'perguntar_humano']);
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://hering-onboarding-default-rtdb.firebaseio.com';

async function pickColunaConcluida(db, squadId, cardKey) {
  const [colSnap, meta] = await Promise.all([
    db.ref(`${cardsPath(squadId)}/${cardKey}/col`).get(),
    flowLib.readFlowMeta(db, squadId, { forceRefresh: true }),
  ]);
  const currentCol = colSnap.val();
  const doneIds = flowLib.doneColumnIds(meta);
  const destinoId = doneIds.find((id) => id !== currentCol) || doneIds[0];
  if (!destinoId) {
    throw new Error(`Squad "${squadId}" não tem nenhuma coluna de "fim" configurada (flowConfig.doneCols) nem detectável por nome.`);
  }
  if (destinoId === currentCol) {
    throw new Error(`O card já está na coluna de destino ("${flowLib.columnName(destinoId, meta.columns)}") — nada a validar aqui, escolha outro card/coluna.`);
  }
  return { currentCol, destino: { id: destinoId, name: flowLib.columnName(destinoId, meta.columns) } };
}

async function confirmarAoVivo(cardId, currentCol, destino) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\n=== ATENÇÃO: ESCRITA REAL, NÃO É DRYRUN ===');
  console.log(`Isso vai MOVER de verdade o card "${cardId}" de "${currentCol}" pra "${destino.name}" (${destino.id}), no squad "${SQUAD_ID}".`);
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

  initializeApp({ credential: applicationDefault(), databaseURL: DATABASE_URL });
  const db = getDatabase();

  const cardKey = await resolveCardKey(db, cardId, { squadId: SQUAD_ID });
  if (!cardKey) {
    console.error(`Card "${cardId}" não encontrado no squad "${SQUAD_ID}".`);
    process.exit(1);
  }
  const { currentCol, destino } = await pickColunaConcluida(db, SQUAD_ID, cardKey);

  const confirmado = await confirmarAoVivo(cardId, currentCol, destino);
  if (!confirmado) {
    console.log('Cancelado — nada foi escrito.');
    process.exit(0);
  }

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

  const task = `Mova esse card (${cardId}) pra coluna "${destino.name}" (use exatamente "${destino.id}" no campo "coluna"). A coluna atual do card é "${currentCol}". O checklist já está 100% completo.`;

  console.log(`\nRodando ESCRITA REAL contra squad "${SQUAD_ID}", card "${cardId}" (coluna atual: "${currentCol}", destino: "${destino.id}")...`);
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

  const moveuDeVerdade = result.steps.some((s) => s.toolCalls.some((c) => c.name === 'mover_coluna' && c.output.ok && c.output.dryRun === false));
  if (moveuDeVerdade) {
    console.log('\nESCRITA REAL CONFIRMADA: mover_coluna aplicado de verdade (output.dryRun: false, output.applied > 0).');
    console.log('Confira no kanban-dev.html?squad=dev, ao vivo, que o card mudou de coluna.');
  } else if (result.status === 'awaiting_human') {
    console.log('\nModelo travou em perguntar_humano — nenhuma escrita real de mover_coluna aconteceu. Revisar a pergunta acima.');
  } else {
    console.log('\nNenhuma escrita real de mover_coluna detectada nos passos — revisar a saída acima.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Falha ao rodar o script:', err.message || err);
  process.exit(1);
});
