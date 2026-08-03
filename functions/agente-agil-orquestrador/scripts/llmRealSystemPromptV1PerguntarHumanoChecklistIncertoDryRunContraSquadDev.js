#!/usr/bin/env node
// functions/agente-agil-orquestrador/scripts/llmRealSystemPromptV1PerguntarHumanoChecklistIncertoDryRunContraSquadDev.js
//
// Cenário 7 (system prompt v1, dryRun, squad 'dev') — primeira validação do
// handler REAL de perguntar_humano (recém-implementado: antes sempre usava
// o handler fake, em qualquer modo — a pergunta só existia em memória, sem
// nenhum jeito de chegar a um humano fora de quem estava lendo o stdout do
// script). Agora, em mode:'real', perguntar_humano monta um plano composto
// (comentario com prefixo "❓" + agent_status:'awaiting_validation'), com
// dryRun tratado igual às outras 7 ferramentas.
//
// ACHADO da primeira versão deste script (pedido puramente informativo —
// "qual é o prazo desse card?"): o modelo respondeu direto por TEXTO
// ("não tem prazo registrado... confirme com o Caio"), sem chamar nenhuma
// ferramenta — resposta honesta (não inventou data), mas não exercita o
// handler novo, porque não envolve nenhuma tentativa de ESCRITA. Pelos
// cenários anteriores (3/4), perguntar_humano só aparece quando o pedido é
// orientado a AÇÃO (escrever algo) com incerteza genuína — nunca em
// perguntas puramente informativas, que o modelo resolve só respondendo em
// texto. Corrigido: agora pede uma escrita concreta (marcar item de
// checklist) bloqueada por falta de certeza, usando o item "Divulgar o
// post nas redes sociais" (criado no canário 3, já existe no card real).
//
// Este script confirma, com LLM real, que:
//   1. Um pedido de escrita (marcar checklist) sem informação suficiente
//      pra confirmar o valor leva o modelo a perguntar_humano — "nunca
//      finja certeza que você não tem" (SYSTEM_PROMPT_V1) — não a chutar
//      done:true ou done:false.
//   2. O plano composto (dryRun:true, não aplicado) tem a forma esperada —
//      2 outputs (comentario + agent_status), path certo, prefixo certo no
//      texto do comentário.
//
// Toolset: ler_card/perguntar_humano/comentario/checklist_item — inclui
// checklist_item de propósito (a ação que o pedido pede) pra dar ao modelo
// uma escolha real entre agir (arriscando errar) e perguntar, em vez de
// isolar perguntar_humano artificialmente sem nenhuma ação concorrente
// (foi exatamente a falta dessa escolha real que fez a primeira versão do
// cenário não disparar perguntar_humano nem checklist_item).
//
// dryRun continua true (default, não passado) — nada é escrito de verdade,
// mesmo com o handler real de perguntar_humano agora montando um plano.
//
// Não é um teste automatizado — depende do julgamento do modelo real. cardId
// é OBRIGATÓRIO, sem default.
//
// Uso:
//   cd functions
//   ANTHROPIC_API_KEY=sk-ant-... node agente-agil-orquestrador/scripts/llmRealSystemPromptV1PerguntarHumanoChecklistIncertoDryRunContraSquadDev.js <cardId>
//
// Custo esperado: ler_card + 1 decisão — ordem de centavos de dólar.

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const { buildTools } = require('../tools');
const { runLoop } = require('../loop');
const { createAnthropicLlmClient } = require('../llmClient');
const { SYSTEM_PROMPT_V1 } = require('../systemPrompt');

const SQUAD_ID = 'dev';
const TOOLS_PERMITIDAS = new Set(['ler_card', 'perguntar_humano', 'comentario', 'checklist_item']);
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

  const task = `Marca no checklist desse card (${cardId}) se o item "Divulgar o post nas redes sociais" já foi feito — só marque como concluído se tiver certeza de que já foi divulgado.`;

  console.log(`\nRodando dryRun (perguntar_humano handler real, checklist incerto) contra squad "${SQUAD_ID}", card "${cardId}"...`);
  console.log('Nenhuma informação disponível confirma se a divulgação já aconteceu — o ponto é ver se o modelo pergunta em vez de chutar done:true/false.\n');

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
  const checklistCall = result.steps.flatMap((s) => s.toolCalls).find((c) => c.name === 'checklist_item');
  if (perguntarCall) {
    console.log('Usou perguntar_humano — comportamento esperado (nenhuma informação confirma se a divulgação aconteceu).');
    const plan = perguntarCall.output.plan || [];
    console.log(`Plano composto tem ${plan.length} step(s) (esperado: 3 — comentario=1 + agent_status=2).`);
    if (perguntarCall.output.dryRun !== true) {
      console.log('ATENÇÃO: esperado output.dryRun === true (default) — revisar.');
    } else {
      console.log('output.dryRun: true confirmado — nada foi escrito de verdade.');
    }
  } else if (checklistCall) {
    console.log(`ATENÇÃO: modelo usou checklist_item em vez de perguntar_humano (input: ${JSON.stringify(checklistCall.input)}) — reveja se chutou done:true/false sem certeza.`);
  } else {
    console.log(`Modelo não usou nem perguntar_humano nem checklist_item (ferramentas usadas: ${ferramentasUsadas.join(', ') || 'nenhuma'}) — reveja o finalText acima pra entender a resposta.`);
  }

  console.log('\nNenhuma escrita real foi feita (dryRun por padrão — este script não passa dryRun:false).');
  process.exit(0);
}

main().catch((err) => {
  console.error('Falha ao rodar o script:', err.message || err);
  process.exit(1);
});
