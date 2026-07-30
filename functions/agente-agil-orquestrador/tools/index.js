// functions/agente-agil-orquestrador/tools/index.js
//
// Vocabulário de ferramentas do orquestrador. As sete primeiras são geradas a
// partir dos MESMOS schemas Zod que o Agente Ágil v0-v3 usa pros seus
// "outputs" (functions/agente-agil/schema.js) — o LLM aqui recebe literal-
// mente o mesmo vocabulário de ações que um especialista humano/externo já
// usa hoje. Isso é deliberado: quando a Etapa 3 trocar os handlers falsos
// pelos reais (buildWritePlan()/applyWritePlan()), nenhum schema muda, só o
// handler.
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

function buildTools() {
  const tools = Object.entries(REUSED_OUTPUT_SCHEMAS).map(([name, schema]) => ({
    name,
    description: `Ferramenta reaproveitada do vocabulário de outputs do Agente Ágil ("${name}"). Etapa 1: execução simulada, não escreve no board.`,
    input_schema: zodToJsonSchema(schema),
    handler: makeHandler(name),
  }));

  tools.push({
    name: 'perguntar_humano',
    description: 'Pausa a tarefa e pergunta a um humano quando o orquestrador não sabe como prosseguir.',
    input_schema: zodToJsonSchema(perguntarHumanoSchema),
    handler: makeHandler('perguntar_humano'),
  });

  return tools;
}

module.exports = { buildTools, REUSED_OUTPUT_SCHEMAS };
