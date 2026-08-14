#!/usr/bin/env node
// functions/agente-agil-orquestrador/scripts/escritaReal9ToolsetCompletoContraSquadDev.js
//
// NONO canário de escrita real — fecha o "item 5" do plano de próximos
// passos (ver README). Mesma tarefa já validada em dryRun por
// `llmRealSystemPromptV1ToolsetCompletoDryRunContraSquadDev.js` (rodada
// real do usuário: status 'done', sequência ler_card -> checklist_item ->
// editar_campos -> agent_status -> comentario, sem confundir
// checklist_item/agent_status, sem cair na armadilha "terminei" ->
// mover_coluna, sem usar link/relatorio_html à toa) — agora com
// `dryRun:false` e SEM filtro de `TOOLS_PERMITIDAS`, diferente de todo
// canário anterior (1-8), que sempre restringia o toolset pro
// subconjunto relevante daquele teste específico.
//
// Risco adicional em relação aos canários anteriores: `relatorio_html`
// nunca teve um canário de escrita real dedicado (gera/hospeda conteúdo
// no Storage — ver README) — como o toolset aqui NÃO é filtrado, ele
// fica tecnicamente acessível ao modelo, mesmo a tarefa não pedindo
// nada relacionado a relatório. A rodada de dryRun não o usou nenhuma
// vez; ainda assim, é uma superfície nova que os canários 1-8 nunca
// expuseram numa escrita real.
//
// Mesmo padrão de segurança dos canários anteriores:
//   1. Card combinado com o usuário: c1785889397211_x0xr2 (squad 'dev').
//   2. Invocação manual.
//   3. Toolset COMPLETO, sem filtro — o ponto deste canário.
//   4. Pedido idêntico ao validado em dryRun — não muda o texto entre
//      dryRun e escrita real, pra não invalidar o que já foi aprovado.
//   5. Confirmação interativa (`ESCREVER`) + lembrete de acompanhar
//      `kanban-dev.html?squad=dev` ao vivo.
//   6. Lê o estado ATUAL do card em tempo de execução (mesmo item de
//      checklist pendente, prioridade atual, tag real do squad).
//
// ANTHROPIC_API_KEY só de variável de ambiente, nunca logada.
//
// Uso:
//   cd functions
//   ANTHROPIC_API_KEY=sk-ant-... node agente-agil-orquestrador/scripts/escritaReal9ToolsetCompletoContraSquadDev.js <cardId>
//
// cardId é OBRIGATÓRIO, sem default. Use c1785889397211_x0xr2.
//
// Custo esperado: ler_card + até 4-5 tool calls + 1 final — ordem de
// centavos de dólar.

const readline = require('node:readline/promises');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const { buildTools } = require('../tools');
const { runLoop } = require('../loop');
const { createAnthropicLlmClient } = require('../llmClient');
const { SYSTEM_PROMPT_V1 } = require('../systemPrompt');
const { resolveCardKey, cardsPath, tagsPath } = require('../../agente-agil/board');

const SQUAD_ID = 'dev';
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://hering-onboarding-default-rtdb.firebaseio.com';
const PRIORIDADE_LABEL = { low: 'baixa', medium: 'média', high: 'alta', critical: 'crítica' };

async function confirmarAoVivo(cardId, itemPendente, prioridadeAtual, prioridadeAlvo, tagLabel) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\n=== ATENÇÃO: ESCRITA REAL, NÃO É DRYRUN — TOOLSET COMPLETO, SEM FILTRO ===');
  console.log(`Card "${cardId}" (squad "${SQUAD_ID}"). Isso vai, de verdade:`);
  console.log(`  - marcar o item de checklist "${itemPendente.t}" como concluído`);
  console.log(`  - mudar a prioridade de "${prioridadeAtual ? PRIORIDADE_LABEL[prioridadeAtual] : 'nenhuma'}" pra "${PRIORIDADE_LABEL[prioridadeAlvo]}"`);
  console.log(`  - adicionar a tag "${tagLabel}"`);
  console.log('  - marcar o status do agente como "aguardando validação"');
  console.log('  - postar um comentário resumindo tudo');
  console.log('Diferente dos canários anteriores, o toolset NÃO está filtrado — as 9 ferramentas (incluindo mover_coluna, link, relatorio_html) ficam acessíveis ao modelo, mesmo a tarefa não pedindo nada relacionado a elas.');
  console.log('Antes de continuar: abra kanban-dev.html?squad=dev e deixe o card aberto, olhando ao vivo.');
  const resposta = await rl.question('Digite exatamente ESCREVER para confirmar e prosseguir (qualquer outra coisa cancela): ');
  rl.close();
  return resposta.trim() === 'ESCREVER';
}

async function main() {
  const cardId = process.argv[2];
  if (!cardId) {
    console.error(`Uso: node ${__filename.split(require('path').sep).pop()} <cardId>`);
    console.error('cardId é obrigatório, sem default. Use c1785889397211_x0xr2.');
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

  const [cardSnap, tagsSnap] = await Promise.all([
    db.ref(`${cardsPath(SQUAD_ID)}/${cardKey}`).get(),
    db.ref(tagsPath(SQUAD_ID)).get(),
  ]);
  const card = cardSnap.val() || {};
  const squadTags = tagsSnap.val() || [];
  const tagsList = (Array.isArray(squadTags) ? squadTags : Object.values(squadTags)).filter(Boolean);

  const checklist = card.checklist || [];
  const itemPendente = checklist.find((i) => i && !i.done);
  if (!itemPendente) {
    console.error(`Card "${cardId}" não tem nenhum item de checklist PENDENTE agora — desmarque um item pela UI antes de rodar este script.`);
    console.error('Itens atuais:', JSON.stringify(checklist.map((i) => ({ t: i.t, done: i.done })), null, 2));
    process.exit(1);
  }

  const prioridadeAtual = card.priority || null;
  const prioridadeAlvo = prioridadeAtual === 'low' ? 'medium' : 'low';

  const tagsAtuais = new Set(card.tags || []);
  const tagCandidata = tagsList.find((t) => !tagsAtuais.has(t.id));
  if (!tagCandidata) {
    console.error(`Squad "${SQUAD_ID}" não tem nenhuma tag que o card "${cardId}" já não tenha — cadastre uma tag nova antes de rodar.`);
    process.exit(1);
  }

  const confirmado = await confirmarAoVivo(cardId, itemPendente, prioridadeAtual, prioridadeAlvo, tagCandidata.label);
  if (!confirmado) {
    console.log('Cancelado — nada foi escrito.');
    process.exit(0);
  }

  // SEM TOOLS_PERMITIDAS — as 9 ferramentas do orquestrador, dryRun:false.
  const tools = buildTools({ mode: 'real', db, squadId: SQUAD_ID, cardId, dryRun: false });
  console.log(`\nFerramentas disponíveis pro modelo nesta rodada (TODAS, sem filtro): ${tools.map((t) => t.name).join(', ')}`);

  let apiCallCount = 0;
  const rawLlmClient = createAnthropicLlmClient({ apiKey });
  const llmClient = {
    async decide(args) {
      apiCallCount++;
      return rawLlmClient.decide(args);
    },
  };

  const task = `No card ${cardId}: já testei de novo em produção e a query melhorou — pode marcar o item de checklist correspondente como concluído. Isso resolve o bloqueio de performance, então muda a prioridade pra "${PRIORIDADE_LABEL[prioridadeAlvo]}" (era "${prioridadeAtual ? PRIORIDADE_LABEL[prioridadeAtual] : 'nenhuma'}") e adiciona a tag "${tagCandidata.label}" (ela já existe no squad, use exatamente esse label) pra indicar que foi uma correção de performance. Do lado do processo: minha parte nesse card terminou, só falta alguém validar — marca o status do agente como aguardando validação. Por fim, deixa um comentário resumindo o que foi feito.`;

  console.log(`\nRodando ESCRITA REAL (toolset completo, sem filtro) contra squad "${SQUAD_ID}", card "${cardId}"...\n`);

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
  const chamadas = [];
  for (const step of result.steps) {
    for (const call of step.toolCalls) {
      chamadas.push(call);
      console.log(`\n[iteração ${step.iteration}] ferramenta: ${call.name}`);
      console.log('input:', JSON.stringify(call.input, null, 2));
      console.log('output:', JSON.stringify(call.output, null, 2));
    }
  }

  const nomes = chamadas.map((c) => c.name);
  console.log(`\nFerramentas usadas, na ordem: ${nomes.join(' -> ') || '(nenhuma)'}`);
  console.log(`${apiCallCount} chamada(s) à API da Anthropic no total.`);

  console.log('\n=== Verificação automática ===');

  const checklistCall = chamadas.find((c) => c.name === 'checklist_item');
  if (checklistCall && checklistCall.input && checklistCall.input.item === itemPendente.t && checklistCall.input.done === true && checklistCall.output.dryRun === false) {
    console.log('✅ checklist_item: item certo, marcado concluído, ESCRITA REAL confirmada.');
  } else if (checklistCall) {
    console.log(`⚠ checklist_item chamado, mas algo diferente do esperado: input=${JSON.stringify(checklistCall.input)}, dryRun=${checklistCall.output && checklistCall.output.dryRun}.`);
  } else {
    console.log('❌ checklist_item NÃO foi chamado.');
  }

  const agentStatusCall = chamadas.find((c) => c.name === 'agent_status');
  if (agentStatusCall && agentStatusCall.input && agentStatusCall.input.status === 'awaiting_validation' && agentStatusCall.output.dryRun === false) {
    console.log('✅ agent_status: awaiting_validation, ESCRITA REAL confirmada, sem se confundir com checklist_item.');
  } else if (agentStatusCall) {
    console.log(`⚠ agent_status chamado, mas algo diferente do esperado: ${JSON.stringify(agentStatusCall.input)}.`);
  } else {
    console.log('❌ agent_status NÃO foi chamado.');
  }

  const editarCall = chamadas.find((c) => c.name === 'editar_campos');
  if (editarCall) {
    const prioOk = editarCall.input && editarCall.input.priority === prioridadeAlvo;
    const tagOk = editarCall.input && Array.isArray(editarCall.input.tags) && editarCall.input.tags.includes(tagCandidata.label);
    const realOk = editarCall.output && editarCall.output.dryRun === false;
    console.log(prioOk && realOk ? '✅ editar_campos: prioridade alvo correta, ESCRITA REAL confirmada.' : `⚠ editar_campos: prioridade=${editarCall.input && editarCall.input.priority}, dryRun=${editarCall.output && editarCall.output.dryRun}.`);
    console.log(tagOk ? '✅ editar_campos: tag alvo correta.' : `⚠ editar_campos: tag "${tagCandidata.label}" não apareceu no input.`);
  } else {
    console.log('❌ editar_campos NÃO foi chamado.');
  }

  const comentarioCall = chamadas.find((c) => c.name === 'comentario');
  console.log(comentarioCall && comentarioCall.output.dryRun === false ? '✅ comentario: chamado, ESCRITA REAL confirmada.' : '❌ comentario NÃO confirmado com escrita real.');

  const moverCall = chamadas.find((c) => c.name === 'mover_coluna');
  console.log(!moverCall ? '✅ mover_coluna: corretamente NÃO chamado (não foi pedido).' : `⚠ mover_coluna FOI chamado sem ter sido pedido: ${JSON.stringify(moverCall.input)}.`);

  const linkCall = chamadas.find((c) => c.name === 'link');
  const relatorioCall = chamadas.find((c) => c.name === 'relatorio_html');
  console.log(!linkCall ? '✅ link: corretamente NÃO chamado.' : `⚠ link FOI chamado sem ter sido pedido: ${JSON.stringify(linkCall.input)}.`);
  console.log(!relatorioCall ? '✅ relatorio_html: corretamente NÃO chamado.' : `🚨 relatorio_html FOI chamado sem ter sido pedido — primeira escrita real dessa ferramenta, nunca antes canário-testada: ${JSON.stringify(relatorioCall.input)}. Revisar com atenção.`);

  console.log('\nConfira no kanban-dev.html?squad=dev, ao vivo, que tudo mudou como esperado no card.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Falha ao rodar o script:', err.message || err);
  process.exit(1);
});
