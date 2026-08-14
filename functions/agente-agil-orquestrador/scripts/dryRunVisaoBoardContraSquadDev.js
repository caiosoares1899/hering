// functions/agente-agil-orquestrador/scripts/dryRunVisaoBoardContraSquadDev.js
//
// Canário manual da ferramenta visao_board — mesmo padrão dos dryRuns
// anteriores (canário 9 do toolset completo, etc.): roda o loop de verdade
// contra o squad "dev", com um pedido de gestão/fluxo (não sobre um card
// específico), e confere se o agente CHAMA visao_board sozinho e se os
// números batem com o que "📊 Dados do Board" mostra pra humano no mesmo
// squad/período.
//
// RODA SÓ LOCAL, na sua máquina — este sandbox não tem credenciais de
// Firebase nem chave da Anthropic. Antes de rodar:
//   1. `gcloud auth application-default login` (se ainda não tiver feito) —
//      ou defina GOOGLE_APPLICATION_CREDENTIALS apontando pra um arquivo de
//      service account.
//   2. Defina ANTHROPIC_API_KEY no ambiente (mesma chave usada pros outros
//      canários — NUNCA cole a chave direto neste arquivo).
//   3. cd functions && node agente-agil-orquestrador/scripts/dryRunVisaoBoardContraSquadDev.js
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

  const task = 'Como está o fluxo do time nesse squad? Tem algum gargalo ou risco que eu deveria saber, olhando os últimos 14 dias?';

  console.log('--- Rodando loop (dryRun) ---');
  console.log('Task:', task);
  console.log();

  const result = await runLoop({ llmClient, tools, system: SYSTEM_PROMPT_V1, task, enabled: true });

  console.log('--- Ferramentas chamadas ---');
  result.steps.forEach((step, i) => {
    step.toolCalls.forEach((call) => {
      console.log(`${i + 1}. ${call.name}(${JSON.stringify(call.input)})`);
      if (call.name === 'visao_board') {
        console.log('   -> output:', JSON.stringify(call.output, null, 2));
      }
    });
  });

  console.log();
  console.log('--- status:', result.status, '---');
  console.log('--- finalText ---');
  console.log(result.finalText || '(sem texto final)');

  console.log();
  console.log('--- Checagem manual ---');
  console.log(
    'Abra o board do squad "dev" > 📊 Dados do Board > aba Fluxo, e confira se WIP/gargalo/tempo batem com o que o visao_board devolveu acima (a aba Fluxo não mostra cycle/lead time em número direto — pra isso, compare com a aba "⏱ Tempo" do painel, se existir, ou confie na matemática: cycle/lead são réplica exata de _cardTempos()/_cardTempoPorColuna() do kanban.html).',
  );
}

main().catch((err) => {
  console.error('Erro no dryRun:', err);
  process.exit(1);
});
