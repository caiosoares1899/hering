#!/usr/bin/env node
// functions/agente-agil-orquestrador/scripts/escritaReal10BibliotecaAgilContraSquadDev.js
//
// DÉCIMO canário de escrita real — primeira escrita real envolvendo
// `biblioteca_agil` (mergeada em #401/#402). Mesmos dois cenários já
// validados em dryRun por `dryRunBibliotecaAgilContraSquadDev.js`
// (rodada real do usuário: biblioteca_agil chamada SOZINHA nos dois
// casos, sem confundir "Recorrência automática" com "Itens recorrentes",
// e reconhecendo a própria limitação de não saber preencher a Ficha
// Técnica) — agora com `dryRun:false`, pra confirmar que o comentário
// final (a resposta do agente) é escrito de verdade no card, não só
// simulado.
//
// `biblioteca_agil` em si NUNCA escreve nada (dado 100% estático, sem
// distinção fake/real no handler — ver tools/bibliotecaAgil.js) — o
// ponto real deste canário não é a ferramenta em si, é confirmar que ELA
// se comporta igual dentro de uma execução real (toolset completo, sem
// filtro, dryRun:false) e que o `comentario` que carrega a resposta dela
// pro humano realmente é escrito no Firebase.
//
// Mesmo padrão de segurança dos canários anteriores:
//   1. Card combinado por CLI, sem default (qualquer card existente no
//      squad 'dev' serve — biblioteca_agil não depende do estado do
//      card, diferente dos canários que mexem em checklist/prioridade).
//   2. Invocação manual.
//   3. Toolset COMPLETO, sem filtro — mesmo toolset já usado no dryRun.
//   4. Pedidos idênticos aos validados em dryRun — não muda o texto
//      entre dryRun e escrita real, pra não invalidar o que já foi
//      aprovado.
//   5. Confirmação interativa (`ESCREVER`) + lembrete de acompanhar
//      `kanban-dev.html?squad=dev` ao vivo.
//   6. Dois cenários sequenciais no mesmo card (mesma ferramenta sendo
//      validada, só dois pedidos diferentes — não duas hipóteses de
//      risco distintas, que é quando este repo separa em scripts
//      próprios; mesmo raciocínio já usado no dryRun).
//
// ANTHROPIC_API_KEY só de variável de ambiente, nunca logada.
//
// Uso:
//   cd functions
//   ANTHROPIC_API_KEY=sk-ant-... node agente-agil-orquestrador/scripts/escritaReal10BibliotecaAgilContraSquadDev.js <cardId>
//
// cardId é OBRIGATÓRIO, sem default.
//
// Custo esperado: 2 tarefas × (biblioteca_agil + comentario) — ordem de
// centavos de dólar.

const readline = require('node:readline/promises');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const { buildTools } = require('../tools');
const { runLoop } = require('../loop');
const { createAnthropicLlmClient } = require('../llmClient');
const { SYSTEM_PROMPT_V1 } = require('../systemPrompt');
const { resolveCardKey } = require('../../agente-agil/board');

const SQUAD_ID = 'dev';
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://hering-onboarding-default-rtdb.firebaseio.com';

const CENARIOS = [
  {
    nome: 'Recorrência automática',
    task: 'Como funciona a recorrência automática de card aqui no Maré Digital? Comenta a resposta no card.',
  },
  {
    nome: 'Ficha técnica',
    task: 'Esse squad tem ficha técnica ativada, o que eu preciso preencher nela? Comenta a resposta no card.',
  },
];

async function confirmarAoVivo(cardId) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\n=== ATENÇÃO: ESCRITA REAL, NÃO É DRYRUN — biblioteca_agil, TOOLSET COMPLETO ===');
  console.log(`Card "${cardId}" (squad "${SQUAD_ID}"). Isso vai, de verdade, postar 2 comentários no card:`);
  CENARIOS.forEach((c, i) => console.log(`  ${i + 1}. resposta sobre "${c.nome}"`));
  console.log('biblioteca_agil em si nunca escreve nada (dado estático) — o que é escrito de verdade é o comentario com a resposta.');
  console.log('Toolset NÃO está filtrado — mesmo padrão já usado no dryRun.');
  console.log('Antes de continuar: abra kanban-dev.html?squad=dev e deixe o card aberto, olhando ao vivo.');
  const resposta = await rl.question('Digite exatamente ESCREVER para confirmar e prosseguir (qualquer outra coisa cancela): ');
  rl.close();
  return resposta.trim() === 'ESCREVER';
}

async function rodarCenario({ nome, task }, { tools, llmClient }) {
  console.log(`\n=== Cenário: ${nome} ===`);
  console.log('Task:', task);

  const result = await runLoop({ llmClient, tools, system: SYSTEM_PROMPT_V1, task, enabled: true });

  console.log('\n--- Ferramentas chamadas ---');
  const chamadas = [];
  for (const step of result.steps) {
    for (const call of step.toolCalls) {
      chamadas.push(call);
      console.log(`[iteração ${step.iteration}] ${call.name}(${JSON.stringify(call.input)})`);
    }
  }

  const bibliotecaCall = chamadas.find((c) => c.name === 'biblioteca_agil');
  const comentarioCall = chamadas.find((c) => c.name === 'comentario');

  console.log('\n--- Verificação automática ---');
  console.log(bibliotecaCall ? '✅ biblioteca_agil: chamada sem ter sido pedida explicitamente.' : '❌ biblioteca_agil NÃO foi chamada.');
  if (bibliotecaCall) {
    const semDryRunField = bibliotecaCall.output && !('dryRun' in bibliotecaCall.output);
    console.log(semDryRunField ? '✅ biblioteca_agil: output sem campo dryRun (confirma que não toca escrita, mesmo em modo real).' : `⚠ biblioteca_agil: output tem campo dryRun inesperado: ${JSON.stringify(bibliotecaCall.output)}.`);
  }
  if (comentarioCall && comentarioCall.output && comentarioCall.output.dryRun === false) {
    console.log('✅ comentario: chamado, ESCRITA REAL confirmada (dryRun:false no output).');
  } else if (comentarioCall) {
    console.log(`⚠ comentario chamado, mas output inesperado: ${JSON.stringify(comentarioCall.output)}.`);
  } else {
    console.log('❌ comentario NÃO foi chamado — resposta não foi escrita no card.');
  }

  console.log('\n--- status:', result.status, '---');
  console.log('--- finalText ---');
  console.log(result.finalText || '(sem texto final)');

  return { nome, bibliotecaCall: !!bibliotecaCall, comentarioReal: !!(comentarioCall && comentarioCall.output && comentarioCall.output.dryRun === false) };
}

async function main() {
  const cardId = process.argv[2];
  if (!cardId) {
    console.error(`Uso: node ${__filename.split(require('path').sep).pop()} <cardId>`);
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

  const confirmado = await confirmarAoVivo(cardId);
  if (!confirmado) {
    console.log('Cancelado — nada foi escrito.');
    process.exit(0);
  }

  // SEM TOOLS_PERMITIDAS — mesmo toolset completo já usado no dryRun,
  // agora com dryRun:false.
  const tools = buildTools({ mode: 'real', db, squadId: SQUAD_ID, cardId, dryRun: false });
  console.log(`\nFerramentas disponíveis pro modelo nesta rodada (TODAS, sem filtro): ${tools.map((t) => t.name).join(', ')}`);

  const llmClient = createAnthropicLlmClient({ apiKey });

  console.log(`\nRodando ESCRITA REAL contra squad "${SQUAD_ID}", card "${cardId}" — 2 cenários...\n`);

  const resumo = [];
  for (const cenario of CENARIOS) {
    resumo.push(await rodarCenario(cenario, { tools, llmClient }));
  }

  console.log('\n=== Resumo ===');
  resumo.forEach((r) => {
    console.log(`${r.bibliotecaCall ? '✅' : '❌'} ${r.nome} — biblioteca_agil ${r.bibliotecaCall ? 'chamada' : 'NÃO chamada'}; comentário real ${r.comentarioReal ? 'confirmado' : 'NÃO confirmado'}`);
  });

  console.log('\nConfira no kanban-dev.html?squad=dev, ao vivo, os 2 comentários no card — mesma checagem manual já feita no dryRun (não confundir Recorrência automática com Itens recorrentes; Ficha técnica reconhecendo a própria limitação de não saber preencher sozinho).');
  process.exit(0);
}

main().catch((err) => {
  console.error('Falha ao rodar o script:', err.message || err);
  process.exit(1);
});
