// functions/agente-agil/schema.js
//
// Contrato de mensagens do Agente Ágil, validado com Zod. Serve tanto pra
// validar em runtime quanto (via zod-to-json-schema) pra gerar documentação
// do contrato pro time que integra especialistas externos e não escreve JS.
//
// v0 sabe validar outputs "comentario", "link" e "relatorio_html" (hospeda
// no Storage, ver outputs/relatorioHtml.js) — os demais tipos do contrato
// completo (checklistItem, agentStatus, mover_coluna) chegam no v2.
// Sprint 2: o envelope aceita "cardId" direto (continua funcionando, nada
// muda pra quem já usa) OU "referencia" de negócio (recorrência + data,
// resolvida pra cardId real em resolver.js) — exatamente um dos dois, nunca
// os dois nem nenhum.

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

// Só o tipo 'recorrente' existe por enquanto — nome é o slug carimbado em
// card.recorrenteDe, data é a instância (YYYY-MM-DD) em card.recorrenteData.
const referencia = z.object({
  tipo: z.literal('recorrente'),
  nome: z.string().min(1),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data deve estar no formato YYYY-MM-DD'),
});

// Resposta do especialista -> Agente Ágil. cardId (v0) e referencia (Sprint 2)
// são mutuamente exclusivos — exatamente um dos dois precisa vir preenchido.
const envelope = z
  .object({
    requestId: z.string().min(1),
    cardId: z.string().min(1).optional(),
    referencia: referencia.optional(),
    status: z.enum(['success', 'error']),
    outputs: z.array(output).default([]),
    notificar: z.array(z.string()).optional(),
    // Aceito e validado desde já, mas não usado até o v3 (callback assíncrono)
    callbackUrl: z.string().url().optional(),
    dryRun: z.boolean().optional(),
  })
  .refine((data) => Boolean(data.cardId) !== Boolean(data.referencia), {
    message: 'Envie exatamente um de "cardId" ou "referencia" — nunca os dois, nunca nenhum.',
    path: ['cardId'],
  });

function envelopeJsonSchema() {
  return zodToJsonSchema(envelope, 'AgenteAgilEnvelopeV0');
}

module.exports = { envelope, referencia, output, outputComentario, outputLink, outputRelatorioHtml, envelopeJsonSchema };
