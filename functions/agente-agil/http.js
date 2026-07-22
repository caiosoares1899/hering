// functions/agente-agil/http.js
//
// Endpoint HTTP do Agente Ágil — hoje só recebe a RESPOSTA de um
// especialista (outputs a aplicar num card). O pedido inicial (Agente
// Ágil -> Especialista) e o callback assíncrono são trabalho de fases
// futuras (v3).
//
// Auth v0: header x-agent-key comparado com um secret. Sem auth por
// agente ainda (v4).

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getDatabase } = require('firebase-admin/database');

const { AgentResponseEnvelope } = require('./schema');
const { buildWritePlan } = require('./outputs');
const board = require('./board');

const AGENT_AGIL_KEY = defineSecret('AGENT_AGIL_KEY');

function newId(prefix) {
  return `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

exports.agenteAgil = onRequest({ region: 'us-central1', secrets: [AGENT_AGIL_KEY] }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  if (req.get('x-agent-key') !== AGENT_AGIL_KEY.value()) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }

  const parsed = AgentResponseEnvelope.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'invalid_payload', issues: parsed.error.issues });
    return;
  }
  const body = parsed.data;

  const db = getDatabase();

  if (!body.dryRun && (await board.isProcessed(db, body.requestId))) {
    res.status(200).json({ ok: true, requestId: body.requestId, alreadyProcessed: true });
    return;
  }

  const ctx = {
    agentUid: 'agente-agil',
    agentName: 'Agente Ágil',
    agentInit: 'AA',
    now: () => new Date().toISOString(),
    newId,
  };

  let writePlan;
  try {
    writePlan = buildWritePlan(body.outputs, ctx);
  } catch (err) {
    res.status(400).json({ ok: false, error: 'invalid_output', message: err.message });
    return;
  }

  if (body.dryRun) {
    res.status(200).json({ ok: true, dryRun: true, requestId: body.requestId, cardId: body.cardId, plan: writePlan });
    return;
  }

  const resolved = await board.resolveCardKeyWithRetry(db, body.cardId);
  if (!resolved) {
    res.status(404).json({ ok: false, error: 'card_not_found', cardId: body.cardId });
    return;
  }

  try {
    await board.applyWritePlan(db, resolved.key, writePlan);
  } catch (err) {
    console.error('[agenteAgil] falha ao aplicar plano de escrita:', err);
    res.status(500).json({ ok: false, error: 'write_failed' });
    return;
  }

  await board.markProcessed(db, body.requestId, { cardId: body.cardId, cardKey: resolved.key });

  res.status(200).json({ ok: true, requestId: body.requestId, cardId: body.cardId, applied: writePlan.length });
});
