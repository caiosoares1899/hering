#!/usr/bin/env node
// functions/agente-agil-orquestrador/scripts/llmRealSystemPromptV1ToolsetCompletoDryRunContraSquadDev.js
//
// "Item 5" do plano de próximos passos (ver README, seção "Próximos
// passos" / card de acompanhamento c1785199972010_nd0): todo canário até
// aqui rodou com o toolset FILTRADO em código pro subconjunto relevante
// daquele cenário específico. Nenhum rodou com as 9 ferramentas
// disponíveis ao mesmo tempo (ler_card, comentario, mover_coluna,
// checklist_item, agent_status, perguntar_humano, link, editar_campos,
// relatorio_html) — o toolset real de uso, não um recorte por teste.
//
// Objetivo: um pedido único e composto, com 4 instruções explícitas e
// SEM ambiguidade nenhuma (isso já foi validado à exaustão na bateria de
// 4 cenários — aqui não é sobre reconhecer incerteza, é sobre EXECUTAR
// certo quando ferramentas parecidas estão todas na mesa), desenhado pra
// forçar dois pares que um modelo mais descuidado poderia confundir:
//
//   - checklist_item vs agent_status: "marca esse item da checklist como
//     concluído" (checklist_item, sobre um ITEM específico) vs "meu
//     trabalho nesse card terminou, aguardando validação" (agent_status,
//     sobre o STATUS DO PRÓPRIO AGENTE) — as duas mexem em "isso tá
//     pronto?", só que em campos completamente diferentes do card.
//   - mover_coluna vs editar_campos: a linguagem de "terminei"/"tá
//     pronto" no pedido é literalmente o gatilho que, nos cenários 3/4,
//     fazia o modelo cogitar mover a coluna — aqui a coluna NUNCA é
//     mencionada nem pedida, então mover_coluna não deveria ser chamada
//     de jeito nenhum. editar_campos entra por outro motivo (prioridade +
//     tag), não relacionado a "terminar".
//
// Também verifica, por omissão, que link/relatorio_html (agora
// disponíveis mas nada no pedido pede link nem relatório) não são usadas
// à toa só porque estão no toolset.
//
// Mesmo espírito dos canários 7/8: lê o estado REAL do card em tempo de
// execução (item de checklist pendente, prioridade atual, tags reais do
// squad, status atual do agente) — nunca assume, nunca hardcoda. dryRun
// (default, não passa dryRun:false) — nada é escrito de verdade nesta
// etapa; é sobre OBSERVAR a escolha de ferramentas, não confirmar
// escrita (isso já foi validado ferramenta por ferramenta nos canários
// 1-8).
//
// cardId é OBRIGATÓRIO, sem default. Card combinado com o usuário:
// c1785889397211_x0xr2 ("Otimizar consulta lenta no dashboard
// principal", squad dev) — mesmo card do canário 8 (2ª tentativa), que
// já tem um checklist real (3 itens: 2 concluídos, 1 pendente:
// "Medir de novo em prod") e um histórico de comentários acumulado.
//
// Uso:
//   cd functions
//   ANTHROPIC_API_KEY=sk-ant-... node agente-agil-orquestrador/scripts/llmRealSystemPromptV1ToolsetCompletoDryRunContraSquadDev.js <cardId>
//
// Custo esperado: ler_card + até 4-5 tool calls + 1 final — ordem de
// centavos de dólar.

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
    console.error(`Card "${cardId}" não tem nenhum item de checklist PENDENTE agora — desmarque um item pela UI (kanban-dev.html?squad=dev) antes de rodar este script (precisa de algo real pra "marcar como concluído").`);
    console.error('Itens atuais:', JSON.stringify(checklist.map((i) => ({ t: i.t, done: i.done })), null, 2));
    process.exit(1);
  }

  const prioridadeAtual = card.priority || null;
  const prioridadeAlvo = prioridadeAtual === 'low' ? 'medium' : 'low';

  const tagsAtuais = new Set(card.tags || []);
  const tagCandidata = tagsList.find((t) => !tagsAtuais.has(t.id));
  if (!tagCandidata) {
    console.error(`Squad "${SQUAD_ID}" não tem nenhuma tag que o card "${cardId}" já não tenha — cadastre uma tag nova (ou remova uma do card) antes de rodar (precisa de uma tag REAL pra adicionar, sem repetir o que já está lá).`);
    process.exit(1);
  }

  const agentStatusAtual = card.agentStatus || null;

  console.log(`\n=== Estado real lido do card "${cardId}" (squad "${SQUAD_ID}") ===`);
  console.log('Item de checklist pendente escolhido:', JSON.stringify(itemPendente.t));
  console.log('Prioridade atual ->  alvo:', (prioridadeAtual ? PRIORIDADE_LABEL[prioridadeAtual] : '(nenhuma)'), '->', PRIORIDADE_LABEL[prioridadeAlvo]);
  console.log('Tag a adicionar (real, do squad):', JSON.stringify(tagCandidata.label));
  console.log('agentStatus atual:', agentStatusAtual || '(nenhum)');

  // SEM TOOLS_PERMITIDAS — as 9 ferramentas do orquestrador ficam
  // disponíveis ao mesmo tempo, exatamente o ponto deste script.
  const tools = buildTools({ mode: 'real', db, squadId: SQUAD_ID, cardId });
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

  console.log(`\nRodando DRYRUN (toolset completo, sem filtro) contra squad "${SQUAD_ID}", card "${cardId}"...`);
  console.log('Pedido composto, 4 instruções sem ambiguidade nenhuma — o teste é se o modelo despacha cada uma pra ferramenta certa, sem confundir checklist_item<->agent_status nem inventar mover_coluna/link/relatorio_html à toa.\n');

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

  console.log('\n=== Verificação automática (leitura, não é validação com asserção) ===');

  const checklistCall = chamadas.find((c) => c.name === 'checklist_item');
  if (checklistCall && checklistCall.input && checklistCall.input.texto === itemPendente.t && checklistCall.input.concluido === true) {
    console.log('✅ checklist_item: item certo, marcado como concluído.');
  } else if (checklistCall) {
    console.log(`⚠ checklist_item chamado, mas com input inesperado: ${JSON.stringify(checklistCall.input)} (esperado texto="${itemPendente.t}", concluido=true).`);
  } else {
    console.log('❌ checklist_item NÃO foi chamado — esperado pra marcar o item pendente.');
  }

  const agentStatusCall = chamadas.find((c) => c.name === 'agent_status');
  if (agentStatusCall && agentStatusCall.input && agentStatusCall.input.status === 'awaiting_validation') {
    console.log('✅ agent_status: awaiting_validation, corretamente separado de checklist_item.');
  } else if (agentStatusCall) {
    console.log(`⚠ agent_status chamado, mas com status inesperado: ${JSON.stringify(agentStatusCall.input)}.`);
  } else {
    console.log('❌ agent_status NÃO foi chamado — esperado pra sinalizar aguardando validação.');
  }

  const editarCall = chamadas.find((c) => c.name === 'editar_campos');
  if (editarCall) {
    const prioOk = editarCall.input && editarCall.input.priority === prioridadeAlvo;
    const tagOk = editarCall.input && Array.isArray(editarCall.input.tags) && editarCall.input.tags.includes(tagCandidata.label);
    console.log(prioOk ? '✅ editar_campos: prioridade alvo correta.' : `⚠ editar_campos: prioridade enviada (${editarCall.input && editarCall.input.priority}) diferente da alvo (${prioridadeAlvo}).`);
    console.log(tagOk ? '✅ editar_campos: tag alvo correta.' : `⚠ editar_campos: tag "${tagCandidata.label}" não apareceu no input (${JSON.stringify(editarCall.input && editarCall.input.tags)}).`);
  } else {
    console.log('❌ editar_campos NÃO foi chamado — esperado pra prioridade + tag.');
  }

  const comentarioCall = chamadas.find((c) => c.name === 'comentario');
  console.log(comentarioCall ? '✅ comentario: chamado (resumo esperado no final).' : '❌ comentario NÃO foi chamado.');

  const moverCall = chamadas.find((c) => c.name === 'mover_coluna');
  console.log(!moverCall ? '✅ mover_coluna: corretamente NÃO chamado (não foi pedido, mesmo com linguagem de "terminei").' : `⚠ mover_coluna FOI chamado sem ter sido pedido: ${JSON.stringify(moverCall.input)} — possível confusão com o gatilho "terminei"/agent_status.`);

  const linkCall = chamadas.find((c) => c.name === 'link');
  const relatorioCall = chamadas.find((c) => c.name === 'relatorio_html');
  console.log(!linkCall ? '✅ link: corretamente NÃO chamado.' : `⚠ link FOI chamado sem ter sido pedido: ${JSON.stringify(linkCall.input)}.`);
  console.log(!relatorioCall ? '✅ relatorio_html: corretamente NÃO chamado.' : `⚠ relatorio_html FOI chamado sem ter sido pedido: ${JSON.stringify(relatorioCall.input)}.`);

  console.log('\nNenhuma escrita real foi feita (dryRun por padrão — este script não passa dryRun:false).');
  process.exit(0);
}

main().catch((err) => {
  console.error('Falha ao rodar o script:', err.message || err);
  process.exit(1);
});
