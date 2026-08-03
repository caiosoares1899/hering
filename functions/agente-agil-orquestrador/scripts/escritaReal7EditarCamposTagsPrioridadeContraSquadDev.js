#!/usr/bin/env node
// functions/agente-agil-orquestrador/scripts/escritaReal7EditarCamposTagsPrioridadeContraSquadDev.js
//
// SÉTIMA ESCRITA REAL do orquestrador (canário 7) — primeira parte de
// `editar_campos` (tags + priority). Mesmo padrão de checklist_item/
// agent_status (canários 3/4): o usuário combinou pular o cenário de
// julgamento dedicado pra este par, por serem estruturalmente seguros —
// `tags` é sempre aditivo (nunca remove tag existente, ver
// outputs/editarCampos.js), `priority` é um swap de enum trivial. `desc`
// fica de fora de propósito (destrutivo — sobrescreve texto existente sem
// undo real, sub-passo separado combinado com o usuário).
//
// Risco técnico do lado de tags não é escrever errado — é ALUCINAR um
// label que não existe no squad (editar_campos exige bater exatamente
// contra kanban/squads/{squad}/dados/tags, senão lança invalid_output, ver
// outputs/editarCampos.js:resolveTagId). `ler_card` não expõe a lista
// completa de tags do squad (só as que já estão NO card, ver
// tools/lerCard.js) — o modelo não tem como adivinhar um label válido
// sozinho. Pra não depender de o modelo acertar (ou pra não desperdiçar a
// chamada com um erro esperado de invalid_output), este script lê a lista
// de tags REAL do squad 'dev' direto do Firebase (mesmo padrão que o
// cenário 5 usou pra achar a coluna de destino via flowLib.doneColumnIds())
// e embute um label real no pedido — mesmo espírito do canário 5 de link
// (URL real fornecida no pedido, não inventada).
//
// Mesmo padrão de segurança dos canários anteriores:
//   1. Mesmo card conhecido: c1785505159707_geo (squad 'dev').
//   2. Invocação manual.
//   3. Toolset filtrado em código pra `ler_card` + `editar_campos` +
//      `comentario` + `perguntar_humano`.
//   4. Pedido real, com a tag REAL do squad embutida no texto (lida do
//      Firebase em tempo de execução, não hardcoded) + prioridade alvo
//      escolhida dinamicamente (diferente da atual, pra dar um before/
//      depois verificável).
//   5. Confirmação interativa (`ESCREVER`) + lembrete de acompanhar
//      `kanban-dev.html?squad=dev` ao vivo.
//
// ANTHROPIC_API_KEY só de variável de ambiente, nunca logada.
//
// Uso:
//   cd functions
//   ANTHROPIC_API_KEY=sk-ant-... node agente-agil-orquestrador/scripts/escritaReal7EditarCamposTagsPrioridadeContraSquadDev.js <cardId>
//
// cardId é OBRIGATÓRIO, sem default. Use c1785505159707_geo.
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
const { resolveCardKey, cardsPath, tagsPath } = require('../../agente-agil/board');

const SQUAD_ID = 'dev';
const TOOLS_PERMITIDAS = new Set(['ler_card', 'editar_campos', 'comentario', 'perguntar_humano']);
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://hering-onboarding-default-rtdb.firebaseio.com';
const PRIORIDADES = ['low', 'medium', 'high', 'critical'];
const PRIORIDADE_LABEL = { low: 'baixa', medium: 'média', high: 'alta', critical: 'crítica' };

async function confirmarAoVivo(cardId, tagLabel, prioridadeAlvo) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\n=== ATENÇÃO: ESCRITA REAL, NÃO É DRYRUN ===');
  console.log(`Isso vai adicionar a tag "${tagLabel}" e mudar a prioridade pra "${PRIORIDADE_LABEL[prioridadeAlvo]}" de verdade no card "${cardId}" do squad "${SQUAD_ID}".`);
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

  initializeApp({ credential: applicationDefault(), databaseURL: DATABASE_URL });
  const db = getDatabase();

  const cardKey = await resolveCardKey(db, cardId, { squadId: SQUAD_ID });
  if (!cardKey) {
    console.error(`Card "${cardId}" não encontrado no squad "${SQUAD_ID}".`);
    process.exit(1);
  }

  const [tagsSnap, cardSnap] = await Promise.all([
    db.ref(tagsPath(SQUAD_ID)).get(),
    db.ref(`${cardsPath(SQUAD_ID)}/${cardKey}`).get(),
  ]);
  const squadTags = tagsSnap.val() || [];
  const tagsList = Array.isArray(squadTags) ? squadTags : Object.values(squadTags);
  if (!tagsList.length) {
    console.error(`Squad "${SQUAD_ID}" não tem tag nenhuma cadastrada — crie uma tag pelo board antes de rodar este canário (editar_campos precisa de um label real pra não alucinar).`);
    process.exit(1);
  }
  const tagLabel = tagsList[0].label;

  const card = cardSnap.val() || {};
  const prioridadeAtual = PRIORIDADES.includes(card.priority) ? card.priority : null;
  const prioridadeAlvo = prioridadeAtual === 'high' ? 'medium' : 'high';

  const confirmado = await confirmarAoVivo(cardId, tagLabel, prioridadeAlvo);
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

  const task = `Nesse card (${cardId}): adiciona a tag "${tagLabel}" (ela já existe no squad, use exatamente esse label) e muda a prioridade pra "${PRIORIDADE_LABEL[prioridadeAlvo]}" (era "${prioridadeAtual ? PRIORIDADE_LABEL[prioridadeAtual] : 'nenhuma'}").`;

  console.log(`\nRodando ESCRITA REAL contra squad "${SQUAD_ID}", card "${cardId}"...`);
  console.log(`Prioridade atual: ${prioridadeAtual ? PRIORIDADE_LABEL[prioridadeAtual] : '(nenhuma)'} -> alvo: ${PRIORIDADE_LABEL[prioridadeAlvo]}. Tag real usada: "${tagLabel}".\n`);

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

  const editarCall = result.steps.flatMap((s) => s.toolCalls).find((c) => c.name === 'editar_campos');
  if (editarCall && editarCall.output.ok && editarCall.output.dryRun === false) {
    console.log('\nESCRITA REAL CONFIRMADA: editar_campos aplicado de verdade (output.dryRun: false, output.applied > 0).');
    const tagsEnviadas = (editarCall.input && editarCall.input.tags) || [];
    const prioridadeEnviada = editarCall.input && editarCall.input.priority;
    console.log(tagsEnviadas.includes(tagLabel) ? `Tag "${tagLabel}" enviada corretamente.` : `ATENÇÃO: tag esperada ("${tagLabel}") não apareceu no input enviado (${JSON.stringify(tagsEnviadas)}).`);
    console.log(prioridadeEnviada === prioridadeAlvo ? `Prioridade "${prioridadeAlvo}" enviada corretamente.` : `ATENÇÃO: prioridade enviada ("${prioridadeEnviada}") é diferente da alvo ("${prioridadeAlvo}").`);
    console.log('Confira no kanban-dev.html?squad=dev, ao vivo, que a tag e a prioridade mudaram no card.');
  } else if (result.status === 'awaiting_human') {
    console.log('\nModelo travou em perguntar_humano mesmo com tag/prioridade reais fornecidas — inesperado, revisar a pergunta acima.');
  } else {
    console.log('\nNenhuma escrita real de editar_campos detectada — revisar a saída acima.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Falha ao rodar o script:', err.message || err);
  process.exit(1);
});
