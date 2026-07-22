// functions/agente-agil/schema.js
//
// Contrato de mensagens do Agente Ágil, validado com Zod. Serve tanto pra
// validar em runtime quanto (via zod-to-json-schema) pra gerar documentação
// do contrato pro time que integra especialistas externos e não escreve JS.
//
// v0 só sabe validar outputs "comentario" e "link" — os demais tipos do
// contrato completo (checklistItem, agentStatus, mover_coluna) chegam no v2.
// v0 também recebe "cardId" direto no envelope: resolver "referencia" de
// negócio (recorrência + data) pra cardId real é trabalho do v1
// (ver resolver.js).

const { z } = require('zod');
const { zodToJsonSchema } = require('zod-to-json-schema');

const outputComentario = z.object({
  type: z.literal('comentario'),
  texto: z.string().min(1),
});

const outputLink = z.object({
  type: z.literal('link'),
  url: z.string().url(),
  titulo: z.string().min(1),
});

const output = z.discriminatedUnion('type', [outputComentario, outputLink]);

// Resposta do especialista -> Agente Ágil (v0: cardId direto, sem "referencia")
const envelope = z.object({
  requestId: z.string().min(1),
  cardId: z.string().min(1),
  status: z.enum(['success', 'error']),
  outputs: z.array(output).default([]),
  notificar: z.array(z.string()).optional(),
  // Aceito e validado desde já, mas não usado até o v3 (callback assíncrono)
  callbackUrl: z.string().url().optional(),
  dryRun: z.boolean().optional(),
});

function envelopeJsonSchema() {
  return zodToJsonSchema(envelope, 'AgenteAgilEnvelopeV0');
}

module.exports = { envelope, output, outputComentario, outputLink, envelopeJsonSchema };
