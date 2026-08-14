#!/usr/bin/env node
// functions/agente-agil-orquestrador/scripts/escritaReal8EditarCamposDescContraSquadDev.js
//
// OITAVA ESCRITA REAL do orquestrador (canário 8) — `editar_campos.desc`,
// o único sub-passo destrutivo de editar_campos (SUBSTITUIÇÃO TOTAL, não
// append — ver outputs/editarCampos.js). Mesmo teste já aprovado em dois
// casos de dryRun (desc vazia: sem invenção de conteúdo; desc real não
// vazia, ajustada manualmente pra forçar o caso mais arriscado: preservou
// o conteúdo antigo e acrescentou a informação nova em vez de sobrescrever
// — ver llmRealSystemPromptV1EditarCamposDescPreservaConteudoDryRunContraSquadDev.js
// e o comentário do canário 8 no card de controle), agora com dryRun:false.
//
// Card de teste atual: c1786712278908 ("[TESTE Agente Ágil] Canário 8 —
// não editar manualmente", squad dev), já criado com a mesma descrição
// aprovada no dryRun original: "Este post faz parte da campanha de Q3.".
// Os dois cards anteriores morreram: c1785505159707_geo foi excluído,
// c1785889397211_x0xr2 acabou reaproveitado pra trabalho real (query
// lenta no dashboard) — a 1ª tentativa de escrita real contra ele
// terminou em perguntar_humano (correto: o modelo notou que o pedido não
// tinha nada a ver com o conteúdo real do card, e ainda deixou um
// comentário/notificação real lá que precisa ser limpo à parte). Rode
// verEstadoCardTesteContraSquadDev.js ANTES deste script (de graça, sem
// LLM) pra conferir a descrição atual.
//
// Mesmo padrão de segurança dos canários anteriores (5/6/7):
//   1. cardId obrigatório via CLI, sem default.
//   2. Invocação manual.
//   3. Toolset filtrado em código pra `ler_card` + `editar_campos` +
//      `comentario` + `perguntar_humano`.
//   4. Pedido idêntico ao validado em dryRun — não muda o texto do task
//      entre dryRun e escrita real, pra não invalidar o que já foi
//      aprovado.
//   5. Confirmação interativa (`ESCREVER`) + lembrete de acompanhar
//      `kanban-dev.html?squad=dev` ao vivo.
//   6. Lê a descrição ATUAL do Firebase em tempo de execução (nunca
//      assume estado) e verifica, depois da escrita, que se a descrição
//      antiga não era vazia, o texto novo enviado a CONTÉM — mesma checagem
//      de preservação do script de dryRun, agora contra o resultado real.
//
// ANTHROPIC_API_KEY só de variável de ambiente, nunca logada.
//
// Uso:
//   cd functions
//   ANTHROPIC_API_KEY=sk-ant-... node agente-agil-orquestrador/scripts/escritaReal8EditarCamposDescContraSquadDev.js <cardId>
//
// cardId é OBRIGATÓRIO, sem default. Use c1786712278908.
//
// Custo esperado: ler_card + editar_campos (+ talvez comentario) — ordem
// de centavos de dólar.

const readline = require('node:readline/promises');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const { buildTools } = require('../tools');
const { runLoop } = require('../loop');
const { createAnthropicLlmClient } = require('../llmClient');
const { SYSTEM_PROMPT_V1 } = require('../systemPrompt');
const { resolveCardKey, cardsPath } = require('../../agente-agil/board');

const SQUAD_ID = 'dev';
const TOOLS_PERMITIDAS = new Set(['ler_card', 'editar_campos', 'comentario', 'perguntar_humano']);
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://hering-onboarding-default-rtdb.firebaseio.com';

// Mesmo pedido usado no dryRun já aprovado — não mude o texto aqui sem
// rodar o dryRun de novo primeiro (o que foi validado foi ESTE task).
const TASK_TEMPLATE = (cardId) =>
  `Atualiza a descrição desse card (${cardId}) pra registrar que a etapa de divulgação nas redes sociais passou a ser responsabilidade de outro time e não faz mais parte do escopo deste card. Se a descrição já tiver outra informação, preserve — só adicione essa informação nova.`;

async function confirmarAoVivo(cardId, descAtual) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\n=== ATENÇÃO: ESCRITA REAL, NÃO É DRYRUN ===');
  console.log(`Isso vai alterar a DESCRIÇÃO de verdade do card "${cardId}" no squad "${SQUAD_ID}" (SUBSTITUIÇÃO TOTAL — não é append).`);
  console.log(`Descrição atual (lida agora do Firebase): ${descAtual ? JSON.stringify(descAtual) : '(vazia)'}`);
  console.log('Antes de continuar: abra kanban-dev.html?squad=dev e deixe o card aberto, olhando ao vivo.');
  const resposta = await rl.question('Digite exatamente ESCREVER para confirmar e prosseguir (qualquer outra coisa cancela): ');
  rl.close();
  return resposta.trim() === 'ESCREVER';
}

async function main() {
  const cardId = process.argv[2];
  if (!cardId) {
    console.error(`Uso: node ${__filename.split(require('path').sep).pop()} <cardId>`);
    console.error('cardId é obrigatório, sem default. Use c1786712278908.');
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

  const descSnap = await db.ref(`${cardsPath(SQUAD_ID)}/${cardKey}/desc`).get();
  const descAtual = descSnap.val() || '';

  const confirmado = await confirmarAoVivo(cardId, descAtual);
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

  const task = TASK_TEMPLATE(cardId);

  console.log(`\nRodando ESCRITA REAL (editar_campos.desc, preservação de conteúdo) contra squad "${SQUAD_ID}", card "${cardId}"...`);
  console.log('O pedido não dá o texto final pronto — o modelo precisa ler a descrição atual e decidir como incorporar a informação nova sem perder o que já existia.\n');

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

  const editarCall = result.steps
    .flatMap((s) => s.toolCalls)
    .find((c) => c.name === 'editar_campos' && c.input && c.input.desc !== undefined);

  if (editarCall && editarCall.output.ok && editarCall.output.dryRun === false) {
    const descNova = editarCall.input.desc;
    console.log('\nESCRITA REAL CONFIRMADA: editar_campos aplicado de verdade (output.dryRun: false, output.applied > 0).');
    console.log('Descrição enviada:', JSON.stringify(descNova));
    if (descAtual && !descNova.includes(descAtual)) {
      console.log('\n⚠️ ATENÇÃO — POSSÍVEL PERDA DE CONTEÚDO: a descrição antiga (não vazia) NÃO está contida na nova. Isso contraria o que foi validado em dryRun. Confira manualmente no board e considere reverter (o texto antigo, truncado em 40 caracteres, fica no history do card).');
    } else if (descAtual) {
      console.log('OK: a descrição nova preserva o conteúdo antigo (contém o texto atual) e incorpora a informação pedida — mesmo comportamento aprovado em dryRun.');
    } else {
      console.log('Descrição atual estava vazia — não havia o que preservar. Confira manualmente no board que o texto novo se limita à informação pedida.');
    }
    console.log('Confira no kanban-dev.html?squad=dev, ao vivo, que a descrição mudou no card.');
  } else if (result.status === 'awaiting_human') {
    console.log('\nModelo travou em perguntar_humano mesmo com o mesmo pedido validado em dryRun — inesperado, revisar a pergunta acima antes de tentar de novo.');
  } else if (ferramentasUsadas.includes('comentario')) {
    console.log('\nModelo optou por comentario em vez de editar a descrição — diferente do que rodou em dryRun, revisar.');
  } else {
    console.log('\nNenhuma escrita real de editar_campos.desc detectada — revisar a saída acima.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Falha ao rodar o script:', err.message || err);
  process.exit(1);
});
