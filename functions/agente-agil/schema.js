// functions/agente-agil/schema.js
//
// Contrato de mensagens entre o Agente Ágil e especialistas externos,
// validado com Zod. O JSON Schema gerado a partir daqui (ver
// gen-json-schema.js) é o que o time que for integrar um novo
// especialista deve ler — não precisa saber Zod nem JS.
//
// v0: só outputs "comentario" e "link". A envelope também recebe
// `cardId` direto em vez de `referencia` (chave de negócio) — resolução
// por referencia é trabalho do v1, junto de resolver.js.

const { z } = require('zod');

const ComentarioOutput = z.object({
  type: z.literal('comentario'),
  texto: z.string().min(1, 'texto do comentário não pode ser vazio'),
});

const LinkOutput = z.object({
  type: z.literal('link'),
  url: z.string().url('url do link precisa ser uma URL válida'),
  titulo: z.string().min(1, 'título do link não pode ser vazio'),
});

// Cresce em v2 com checklistItem, agentStatus e mover_coluna.
const OutputSchema = z.discriminatedUnion('type', [ComentarioOutput, LinkOutput]);

const AgentResponseEnvelope = z.object({
  requestId: z.string().min(1),
  // v0: cardId direto. v1 troca por `referencia` ({tipo, nome, data}) e
  // resolve pra cardId internamente via resolver.js.
  cardId: z.string().min(1),
  status: z.enum(['success', 'error']),
  outputs: z.array(OutputSchema).default([]),
  // Modo de debug: monta e devolve o plano de escrita sem tocar no board.
  dryRun: z.boolean().optional().default(false),
});

module.exports = {
  ComentarioOutput,
  LinkOutput,
  OutputSchema,
  AgentResponseEnvelope,
};
