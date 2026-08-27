// functions/agente-agil/schema.js
//
// Contrato de mensagens do Agente Ágil, validado com Zod. Serve tanto pra
// validar em runtime quanto (via zod-to-json-schema) pra gerar documentação
// do contrato pro time que integra especialistas externos e não escreve JS.
//
// v0 validava só "comentario", "link" e "relatorio_html" (hospeda no
// Storage, ver outputs/relatorioHtml.js). Sprint 2 acrescentou "referencia"
// de negócio no envelope (recorrência + data, resolvida pra cardId real em
// resolver.js) — exatamente um dos dois (cardId XOR referencia), nunca os
// dois nem nenhum. Sprint 3 acrescenta o "vocabulário de ações": checklist_
// item, agent_status, mover_coluna, editar_campos (ver outputs/*.js) — cada
// um decide sozinho, em outputs/*.js, se algum campo precisa de pelo menos
// um valor preenchido (esse tipo de regra fica no builder, não aqui, porque
// discriminatedUnion não aceita membros com .refine()).
//
// `envelope`/`output` (v0-v3) ficam como CONTRATO LEGADO — mantidos aqui só
// por compatibilidade de schema/testes, mas http.js PAROU de usá-los pra
// aplicar escrita direta (2026-08-27, ver comentário grande em http.js).
// Correção de arquitetura pedida direto pelo usuário: especialista externo
// nunca mais decide a AÇÃO (mover_coluna, editar_campos...) — só manda
// INFORMAÇÃO em texto livre, e quem decide o que fazer no board é sempre o
// orquestrador (agente-agil-orquestrador/). O novo contrato de entrada é
// `intakeEnvelope`, abaixo — deliberadamente mais pobre em estrutura, porque
// a ideia é caber especialistas futuros cujo formato "nem sempre vamos
// conseguir adaptar" (palavras do usuário) pro vocabulário de outputs.

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

// checklist_item: marca (ou cria, se ainda não existir) um item do
// checklist. `grupo` é opcional — quando ausente, cai no grupo próprio do
// agente ("🤖 Processo automatizado"), ver outputs/checklistItem.js.
const outputChecklistItem = z.object({
  type: z.literal('checklist_item'),
  item: z.string().min(1),
  done: z.boolean(),
  grupo: z.string().min(1).optional(),
});

// agent_status: status visível do agente no card. executorType é opcional —
// quando ausente, promove automaticamente 'human'/vazio para 'agent' (ver
// outputs/agentStatus.js), nunca mexe se já for 'agent'/'hybrid'.
const outputAgentStatus = z.object({
  type: z.literal('agent_status'),
  status: z.enum(['queued', 'running', 'awaiting_validation', 'done', 'error']),
  executorType: z.enum(['human', 'agent', 'hybrid']).optional(),
});

// mover_coluna: id da coluna de destino — precisa existir no board (ver
// outputs/moverColuna.js), senão o envelope inteiro falha com invalid_output.
const outputMoverColuna = z.object({
  type: z.literal('mover_coluna'),
  coluna: z.string().min(1),
});

// editar_campos: ao menos um dos três precisa vir preenchido — validado no
// builder (ver outputs/editarCampos.js), não aqui.
const outputEditarCampos = z.object({
  type: z.literal('editar_campos'),
  desc: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  tags: z.array(z.string().min(1)).optional(),
});

const output = z.discriminatedUnion('type', [
  outputComentario,
  outputLink,
  outputRelatorioHtml,
  outputChecklistItem,
  outputAgentStatus,
  outputMoverColuna,
  outputEditarCampos,
]);

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
    // Identifica QUAL especialista externo mandou este envelope (ex.:
    // "databricks") — opcional por compatibilidade (nenhum especialista
    // real manda isso hoje). Ausente -> http.js assume "databricks" (único
    // especialista em produção até 2026-08-25, ver comentário lá). Usado
    // só pra creditar a escrita com uma identidade PRÓPRIA, diferente de
    // "Agente Ágil" — achado real (2026-08-25): todo output gravava
    // uid:'agente-agil'/author:'Agente Ágil', o MESMO ator que o
    // orquestrador novo usa pra si mesmo — o filtro anti-auto-disparo de
    // mentionTrigger.js (ignora comment.uid===AGENTE_UID) tornava
    // estruturalmente impossível o orquestrador diferenciar "isso foi um
    // especialista" de "isso fui eu mesmo". Ver board.js (buildWritePlan
    // -> ctx.actor) pra onde isso vira uid/author/who de verdade.
    especialista: z.string().min(1).optional(),
  })
  .refine((data) => Boolean(data.cardId) !== Boolean(data.referencia), {
    message: 'Envie exatamente um de "cardId" ou "referencia" — nunca os dois, nunca nenhum.',
    path: ['cardId'],
  });

function envelopeJsonSchema() {
  return zodToJsonSchema(envelope, 'AgenteAgilEnvelopeV0');
}

// Contrato de entrada NOVO (2026-08-27) — o que agente-agil/http.js valida
// e enfileira de verdade hoje (ver intakePendingPath em http.js). `texto`
// livre é o único campo sempre obrigatório: é a única coisa que qualquer
// especialista, presente ou futuro, sempre consegue produzir de algum jeito
// (mesmo que seja um JSON serializado como string) — nada de vocabulário
// fixo de ações aqui. `cardId`/`referencia` continuam existindo, mas agora
// como DICA opcional (nenhum dos dois é obrigatório) — se nenhum vier, ou
// nenhum resolver pra um card real, o orquestrador decide sozinho o que
// fazer (inclusive criar um card novo, ver tools/criarCard.js), em vez do
// pedido inteiro falhar com 400 como acontecia no contrato antigo.
// `dryRun` saiu do envelope — a decisão de sombra/escrita real agora é por
// SQUAD, na criação do trigger (ver intakeTrigger.js), mesmo padrão que
// mentionTrigger.js já usa, não mais por chamada individual.
const intakeEnvelope = z
  .object({
    requestId: z.string().min(1),
    texto: z.string().min(1),
    cardId: z.string().min(1).optional(),
    referencia: referencia.optional(),
    // Mesmo campo/mesmo propósito de atribuição que `envelope.especialista`
    // já tinha — quem mandou esta informação (ex.: "databricks"). Opcional
    // por compatibilidade, mesmo fallback de sempre (ver DEFAULT_ESPECIALISTA
    // em http.js).
    especialista: z.string().min(1).optional(),
  })
  .refine((data) => !(data.cardId && data.referencia), {
    message: 'Envie no máximo um de "cardId" ou "referencia" — nunca os dois.',
    path: ['cardId'],
  });

function intakeEnvelopeJsonSchema() {
  return zodToJsonSchema(intakeEnvelope, 'AgenteAgilIntakeEnvelopeV1');
}

module.exports = {
  envelope,
  referencia,
  output,
  outputComentario,
  outputLink,
  outputRelatorioHtml,
  outputChecklistItem,
  outputAgentStatus,
  outputMoverColuna,
  outputEditarCampos,
  envelopeJsonSchema,
  intakeEnvelope,
  intakeEnvelopeJsonSchema,
};
