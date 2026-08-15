// functions/agente-agil-orquestrador/tools/index.js
//
// Vocabulário de ferramentas do orquestrador. As sete primeiras são geradas a
// partir dos MESMOS schemas Zod que o Agente Ágil v0-v3 usa pros seus
// "outputs" (functions/agente-agil/schema.js) — o LLM aqui recebe literal-
// mente o mesmo vocabulário de ações que um especialista humano/externo já
// usa hoje. Isso é deliberado: trocar os handlers falsos pelos reais (Etapa
// 2, ver tools/realHandlers.js) não muda nenhum schema, só o handler.
//
// zodToJsonSchema(schema) é chamado SEM o segundo argumento (nome) —
// confirmado que isso produz um objeto plano (sem $ref/definitions),
// compatível com o formato que a Anthropic espera em `input_schema`.
const { zodToJsonSchema } = require('zod-to-json-schema');
const {
  outputComentario,
  outputLink,
  outputRelatorioHtml,
  outputChecklistItem,
  outputAgentStatus,
  outputMoverColuna,
  outputEditarCampos,
} = require('../../agente-agil/schema');
const { makeHandler } = require('./fakeHandlers');
const { makeRealHandler, makeRealPerguntarHumanoHandler } = require('./realHandlers');
const { lerCardSchema, makeFakeLerCardHandler, makeRealLerCardHandler } = require('./lerCard');
const { visaoBoardSchema, makeFakeVisaoBoardHandler, makeRealVisaoBoardHandler } = require('./visaoBoard');
const { bibliotecaAgilSchema, makeBibliotecaAgilHandler } = require('./bibliotecaAgil');

// A ferramenta "type" de cada schema (ex: 'mover_coluna') já diz o que a
// ferramenta faz — o próprio `name` da tool-use do Anthropic. O campo
// `type`/`const` dentro do schema fica redundante nesse contexto, mas é
// inofensivo (o LLM simplesmente sempre preenche com o mesmo literal) e
// manter o schema idêntico ao usado em agente-agil/schema.js facilita
// comparar os dois vocabulários. Não removido por enquanto.
const REUSED_OUTPUT_SCHEMAS = {
  comentario: outputComentario,
  link: outputLink,
  relatorio_html: outputRelatorioHtml,
  checklist_item: outputChecklistItem,
  agent_status: outputAgentStatus,
  mover_coluna: outputMoverColuna,
  editar_campos: outputEditarCampos,
};

// Único schema que não vem de agente-agil/schema.js — central pra visão de
// produto já registrada no card de acompanhamento ("pergunta quando não sabe
// o que fazer"). Existe desde a Etapa 1, mesmo em forma falsa, pra já moldar
// o loop em torno dela em vez de acrescentá-la depois como exceção.
const { z } = require('zod');
const perguntarHumanoSchema = z.object({
  pergunta: z.string().min(1),
});

// mode:'fake' (default) — nenhuma ferramenta toca o board, ver
// tools/fakeHandlers.js. Usado pelos testes e por qualquer chamada que não
// passe explicitamente pra 'real'.
// mode:'real' — handlers de verdade (tools/realHandlers.js), precisa de
// {db, squadId, cardId}; dryRun é opção explícita, default `true` (ver
// makeRealHandler em realHandlers.js) — quem quer escrita real precisa
// passar `dryRun: false` aqui, nunca um default escondido. ler_card não
// escreve nada, então não tem dryRun nenhum pra travar, real ou fake
// sempre lê. perguntar_humano TEM handler real desde que a lacuna de
// entrega foi identificada (a pergunta só existia em memória, visível só
// pra quem rodava o script) — ver makeRealPerguntarHumanoHandler em
// realHandlers.js: posta a pergunta como comentário + marca
// agent_status:'awaiting_validation', respeitando dryRun igual às outras
// 7 (importante pra não sujar os cenários de julgamento 1-6, que dependem
// dela não escrever nada em dryRun).
function buildTools(options = {}) {
  const { mode = 'fake', db, squadId, cardId, dryRun = true } = options;
  if (mode === 'real' && (!db || !squadId || !cardId)) {
    throw new Error('buildTools({mode:"real"}) precisa de db, squadId e cardId.');
  }

  const tools = Object.entries(REUSED_OUTPUT_SCHEMAS).map(([name, schema]) => ({
    name,
    description:
      mode === 'real'
        ? `Ferramenta reaproveitada do vocabulário de outputs do Agente Ágil ("${name}"). ${dryRun ? 'Monta o plano de escrita de verdade contra o board, mas em dryRun — nunca aplica.' : 'Escreve DE VERDADE no board.'}`
        : `Ferramenta reaproveitada do vocabulário de outputs do Agente Ágil ("${name}"). Execução simulada, não escreve no board.`,
    input_schema: zodToJsonSchema(schema),
    handler: mode === 'real' ? makeRealHandler(name, { db, squadId, cardId, dryRun }) : makeHandler(name),
  }));

  tools.push({
    name: 'perguntar_humano',
    description:
      mode === 'real'
        ? `Pausa a tarefa e pergunta a um humano quando o orquestrador não sabe como prosseguir. ${dryRun ? 'Monta o plano de verdade (comentário + agent_status), mas em dryRun — nunca aplica.' : 'Posta a pergunta como comentário DE VERDADE no card e marca agent_status como "awaiting_validation".'}`
        : 'Pausa a tarefa e pergunta a um humano quando o orquestrador não sabe como prosseguir.',
    input_schema: zodToJsonSchema(perguntarHumanoSchema),
    handler: mode === 'real' ? makeRealPerguntarHumanoHandler({ db, squadId, cardId, dryRun }) : makeHandler('perguntar_humano'),
  });

  tools.push({
    name: 'ler_card',
    description: 'Lê um resumo do card atual (descrição, checklist, comentários, coluna, tags, responsável/participantes) — use antes de decidir uma ação em pedidos abertos ou quando faltar contexto.',
    input_schema: zodToJsonSchema(lerCardSchema),
    handler: mode === 'real' ? makeRealLerCardHandler({ db, squadId, cardId }) : makeFakeLerCardHandler(),
  });

  tools.push({
    name: 'visao_board',
    description:
      'Visão agregada do board inteiro (não só o card atual): WIP atual vs. limite por coluna, throughput, cycle time e lead time (média/mediana/amostra), gargalo por coluna (tempo médio parado) e bloqueios ativos. Aceita periodo_dias opcional (default 14) pra throughput/cycle/lead/gargalo — WIP e bloqueios são sempre o estado atual. Use antes de responder perguntas de gestão/fluxo do time ou pra dar contexto de board a um especialista externo.',
    input_schema: zodToJsonSchema(visaoBoardSchema),
    handler: mode === 'real' ? makeRealVisaoBoardHandler({ db, squadId }) : makeFakeVisaoBoardHandler(),
  });

  tools.push({
    name: 'biblioteca_agil',
    description:
      'Base de conhecimento estática: conceitos ágeis (WIP, sprint, throughput, papéis...) e como as funcionalidades do Maré Digital funcionam na prática (recorrência, ficha técnica, dependências, riscos, campanhas, arquivamento...). Sempre o mesmo conteúdo, não depende do estado do board. Use quando o pedido envolver dúvida sobre uma funcionalidade do board ou um conceito ágil, ou pra decidir se/como usar um recurso do Maré Digital antes de agir ou responder.',
    input_schema: zodToJsonSchema(bibliotecaAgilSchema),
    // Sem distinção fake/real: dado 100% estático, nunca toca o Firebase —
    // o mesmo handler serve os dois modos de buildTools().
    handler: makeBibliotecaAgilHandler(),
  });

  return tools;
}

module.exports = { buildTools, REUSED_OUTPUT_SCHEMAS };
