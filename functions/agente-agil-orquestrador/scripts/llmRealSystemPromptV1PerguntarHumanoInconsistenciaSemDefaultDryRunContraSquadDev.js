#!/usr/bin/env node
// functions/agente-agil-orquestrador/scripts/llmRealSystemPromptV1PerguntarHumanoInconsistenciaSemDefaultDryRunContraSquadDev.js
//
// Cenário 7 (system prompt v1, dryRun, squad 'dev'), 3ª versão — valida o
// handler REAL de perguntar_humano (antes sempre usava o handler fake, em
// qualquer modo). O objetivo AQUI não é redescobrir julgamento (já provado
// nos cenários 3/4/6: perguntar_humano aparece com ambiguidade genuína
// entre duas ações concretas, ou quando não existe "não fazer nada"
// seguro) — é validar o ENCANAMENTO técnico do handler novo (prefixo do
// comentário, badge agent_status, plano composto correto) com o mínimo de
// tentativas.
//
// HISTÓRICO deste script (2 tentativas anteriores, ambas com resultado
// defensável mas que não exercitaram o handler):
//   v1: pedido puramente informativo ("qual o prazo?") — modelo respondeu
//       só em texto, sem chamar ferramenta nenhuma. Não envolvia escrita.
//   v2: pedido de escrita com "não fazer nada" como default seguro
//       (marcar/não-marcar 1 item de checklist) — modelo preferiu
//       `comentario` explicando a incerteza (comportamento coerente com o
//       próprio prompt: "é melhor comentar... do que mover o card
//       errado"), sem escalar pra perguntar_humano.
//   v3 (esta): combina os dois ingredientes que historicamente
//       dispararam perguntar_humano de verdade — ambiguidade entre DUAS
//       ações concretas (checklist_item vs mover_coluna, mesmo par do
//       cenário 3/4) E nenhuma delas tem "não fazer nada" como saída
//       segura: o card está em "Concluído" mas tem 1 item de checklist
//       pendente — uma inconsistência REAL já presente no card (não
//       inventada pelo script), que o pedido pede explicitamente pra
//       resolver. Marcar o item sem evidência seria chutar; mover o card
//       de volta também exigiria um id de coluna que o modelo não tem
//       como saber (ler_card só expõe a coluna ATUAL, não a lista —
//       limitação conhecida, documentada desde o script de múltiplas
//       ferramentas da Etapa 2).
//
// Toolset: ler_card/perguntar_humano/comentario/checklist_item/
// mover_coluna — as duas ações candidatas + os dois jeitos de comunicar
// (comentar ou pausar formalmente).
//
// dryRun continua true (default, não passado) — nada é escrito de verdade.
//
// Não é um teste automatizado — depende do julgamento do modelo real. cardId
// é OBRIGATÓRIO, sem default.
//
// Uso:
//   cd functions
//   ANTHROPIC_API_KEY=sk-ant-... node agente-agil-orquestrador/scripts/llmRealSystemPromptV1PerguntarHumanoInconsistenciaSemDefaultDryRunContraSquadDev.js <cardId>
//
// Custo esperado: ler_card + 1 decisão — ordem de centavos de dólar.

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const { buildTools } = require('../tools');
const { runLoop } = require('../loop');
const { createAnthropicLlmClient } = require('../llmClient');
const { SYSTEM_PROMPT_V1 } = require('../systemPrompt');

const SQUAD_ID = 'dev';
const TOOLS_PERMITIDAS = new Set(['ler_card', 'perguntar_humano', 'comentario', 'checklist_item', 'mover_coluna']);
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

  const task = `Esse card (${cardId}) está na coluna "Concluído", mas o checklist ainda tem um item pendente ("Divulgar o post nas redes sociais"). Isso é uma inconsistência — resolve isso: marca o item como feito (se já foi divulgado) ou move o card pra refletir que ainda não está 100% pronto (se não foi). Decida com base no que fizer mais sentido.`;

  console.log(`\nRodando dryRun (perguntar_humano handler real, inconsistência sem default seguro) contra squad "${SQUAD_ID}", card "${cardId}"...`);
  console.log('Nem marcar o item (sem evidência) nem mover o card (sem saber o id de destino) tem um jeito seguro de agir sem mais informação.\n');

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
    console.log('Usou perguntar_humano — comportamento esperado (ambiguidade real, sem default seguro em nenhuma das duas ações).');
    const plan = perguntarCall.output.plan || [];
    console.log(`Plano composto tem ${plan.length} step(s) (esperado: 3 — comentario=1 + agent_status=2).`);
    if (perguntarCall.output.dryRun !== true) {
      console.log('ATENÇÃO: esperado output.dryRun === true (default) — revisar.');
    } else {
      console.log('output.dryRun: true confirmado — nada foi escrito de verdade.');
    }
  } else {
    console.log(`Modelo não usou perguntar_humano (ferramentas usadas: ${ferramentasUsadas.join(', ') || 'nenhuma'}) — reveja o finalText/inputs acima pra entender a resposta.`);
  }

  console.log('\nNenhuma escrita real foi feita (dryRun por padrão — este script não passa dryRun:false).');
  process.exit(0);
}

main().catch((err) => {
  console.error('Falha ao rodar o script:', err.message || err);
  process.exit(1);
});
