// functions/agente-agil/schema.js
//
// Contrato de mensagens do Agente Ágil, validado com Zod. Serve tanto pra
// validar em runtime quanto (via zod-to-json-schema) pra gerar documentação
// do contrato pro time que integra especialistas externos e não escreve JS.
//
// v0 sabe validar outputs "comentario", "link" e "relatorio_html" (hospeda
// no Storage, ver outputs/relatorioHtml.js) — os demais tipos do contrato
// completo (checklistItem, agentStatus, mover_coluna) chegam no v2.
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

// HTML completo do relatório, com imagens embutidas em base64. O Agente
// Ágil extrai as imagens, hospeda tudo no Storage e escreve só um link no
// card — nunca guarda o HTML bruto no Realtime Database.
const outputRelatorioHtml = z.object({
  type: z.literal('relatorio_html'),
  html: z.string().min(1),
  titulo: z.string().min(1),
});

const output = z.discriminatedUnion('type', [outputComentario, outputLink, outputRelatorioHtml]);

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

module.exports = { envelope, output, outputComentario, outputLink, outputRelatorioHtml, envelopeJsonSchema };
