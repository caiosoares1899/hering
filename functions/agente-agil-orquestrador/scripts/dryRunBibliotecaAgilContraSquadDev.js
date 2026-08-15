// functions/agente-agil-orquestrador/scripts/dryRunBibliotecaAgilContraSquadDev.js
//
// Canário manual da ferramenta biblioteca_agil — mesmo padrão do dryRun de
// visao_board: roda o loop de verdade contra o squad "dev", com dois
// pedidos que só têm resposta certa se o agente CONSULTAR a biblioteca
// (não é sobre o card em si, é sobre como uma funcionalidade do board
// funciona). O ponto do teste não é o conteúdo da resposta — é confirmar
// que o agente lembra de chamar biblioteca_agil SOZINHO, sem ninguém
// pedir isso explicitamente no texto da tarefa.
//
// Dois cenários, na mesma rodada de script (mesma ferramenta sendo
// validada, só dois pedidos diferentes — não duas hipóteses de risco
// distintas, que é quando este repo separa em scripts próprios):
//   1. "Como funciona a recorrência automática de card?" — testa se o
//      agente distingue "Itens recorrentes" de "Recorrência automática"
//      (são conceitos parecidos e fáceis de confundir na biblioteca).
//   2. "Esse squad tem ficha técnica ativada, o que preciso preencher
//      nela?" — testa o verbete mais denso (Ficha Técnica) E se o agente
//      reproduz a nota crítica de autoconhecimento ("hoje eu não sei
//      preencher a Ficha Técnica sozinho").
//
// RODA SÓ LOCAL, na sua máquina — este sandbox não tem credenciais de
// Firebase nem chave da Anthropic. Antes de rodar:
//   1. `gcloud auth application-default login` (se ainda não tiver feito) —
//      ou defina GOOGLE_APPLICATION_CREDENTIALS apontando pra um arquivo de
//      service account.
//   2. Defina ANTHROPIC_API_KEY no ambiente (mesma chave usada pros outros
//      canários — NUNCA cole a chave direto neste arquivo).
//   3. cd functions && node agente-agil-orquestrador/scripts/dryRunBibliotecaAgilContraSquadDev.js
//
// cardId é só uma âncora (buildTools({mode:'real'}) exige um, mesmo pra
// ferramentas que não tocam card nenhum) — troque se c1786712278908 não
// existir mais no squad dev.

const { initializeApp, cert, applicationDefault } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const { buildTools } = require('../tools');
const { runLoop } = require('../loop');
const { createAnthropicLlmClient } = require('../llmClient');
const { SYSTEM_PROMPT_V1 } = require('../systemPrompt');

const SQUAD_ID = 'dev';
const CARD_ID_ANCORA = 'c1786712278908';
const DATABASE_URL = 'https://hering-onboarding-default-rtdb.firebaseio.com';

const CENARIOS = [
  {
    nome: 'Recorrência automática',
    task: 'Como funciona a recorrência automática de card aqui no Maré Digital?',
  },
  {
    nome: 'Ficha técnica',
    task: 'Esse squad tem ficha técnica ativada, o que eu preciso preencher nela?',
  },
];

async function rodarCenario({ nome, task }, { tools, llmClient }) {
  console.log(`\n=== Cenário: ${nome} ===`);
  console.log('Task:', task);
  console.log();

  const result = await runLoop({ llmClient, tools, system: SYSTEM_PROMPT_V1, task, enabled: true });

  const chamouBiblioteca = result.steps.some((step) => step.toolCalls.some((call) => call.name === 'biblioteca_agil'));

  console.log('--- Ferramentas chamadas ---');
  result.steps.forEach((step, i) => {
    step.toolCalls.forEach((call) => {
      console.log(`${i + 1}. ${call.name}(${JSON.stringify(call.input)})`);
    });
  });

  console.log();
  console.log(`--- biblioteca_agil chamada sem pedir explicitamente? ${chamouBiblioteca ? 'SIM' : 'NÃO'} ---`);
  console.log('--- status:', result.status, '---');
  console.log('--- finalText ---');
  console.log(result.finalText || '(sem texto final)');

  return { nome, chamouBiblioteca, status: result.status };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Defina ANTHROPIC_API_KEY no ambiente antes de rodar este script.');
    process.exit(1);
  }

  initializeApp({
    credential: process.env.GOOGLE_APPLICATION_CREDENTIALS ? cert(require(process.env.GOOGLE_APPLICATION_CREDENTIALS)) : applicationDefault(),
    databaseURL: DATABASE_URL,
  });
  const db = getDatabase();

  const tools = buildTools({ mode: 'real', db, squadId: SQUAD_ID, cardId: CARD_ID_ANCORA, dryRun: true });
  const llmClient = createAnthropicLlmClient({ apiKey: process.env.ANTHROPIC_API_KEY });

  console.log('--- Rodando loop (dryRun) — 2 cenários ---');

  const resumo = [];
  for (const cenario of CENARIOS) {
    resumo.push(await rodarCenario(cenario, { tools, llmClient }));
  }

  console.log('\n=== Resumo ===');
  resumo.forEach((r) => {
    console.log(`${r.chamouBiblioteca ? '✅' : '❌'} ${r.nome} — biblioteca_agil ${r.chamouBiblioteca ? 'chamada' : 'NÃO chamada'} (status: ${r.status})`);
  });

  console.log();
  console.log('--- Checagem manual ---');
  console.log(
    'Confira se a resposta de "Recorrência automática" não confunde com "Itens recorrentes" (são conceitos parecidos e é fácil o agente misturar), e se a resposta de "Ficha técnica" inclui a nota de que o agente hoje não sabe preencher a ficha sozinho.',
  );

  // firebase-admin/database mantém uma conexão WebSocket aberta — sem isso
  // o processo Node nunca encerra sozinho depois do script terminar
  // (parece "travado" no terminal, mas já rodou tudo e imprimiu o resultado).
  process.exit(0);
}

main().catch((err) => {
  console.error('Erro no dryRun:', err);
  process.exit(1);
});
