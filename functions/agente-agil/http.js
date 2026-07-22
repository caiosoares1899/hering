// functions/agente-agil/http.js
//
// Endpoint HTTP do Agente Ágil — o ÚNICO ponto de contato entre especialistas
// externos (hoje: agente Databricks) e o board. Especialistas nunca leem/
// escrevem direto no Firebase; só mandam esse envelope aqui.
//
// v0: auth por secret compartilhado (header x-agent-key), idempotência por
// requestId (sem TTL de limpeza automática ainda — RTDB não tem TTL nativo;
// só evita duplicar em retry), resolução de card por cardId direto (sem
// "referencia" de negócio — isso é v1), outputs "comentario" e "link".

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getDatabase } = require('firebase-admin/database');

const { envelope } = require('./schema');
const { SQUAD_ID, resolveCardKey, buildWritePlan, applyWritePlan } = require('./board');

const AGENTE_AGIL_KEY = defineSecret('AGENTE_AGIL_KEY');

const IDEMPOTENCY_PATH = `kanban/squads/${SQUAD_ID}/dados/agente_agil_processed`;

const agenteAgil = onRequest(
  { region: 'us-central1', secrets: [AGENTE_AGIL_KEY] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'method_not_allowed' });
      return;
    }

    if (req.get('x-agent-key') !== AGENTE_AGIL_KEY.value()) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const parsed = envelope.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }
    const payload = parsed.data;
    const db = getDatabase();

    if (!payload.dryRun) {
      const processedSnap = await db.ref(`${IDEMPOTENCY_PATH}/${payload.requestId}`).get();
      if (processedSnap.exists()) {
        res.status(200).json({ ok: true, idempotent: true });
        return;
      }
    }

    const cardKey = await resolveCardKey(db, payload.cardId);
    if (!cardKey) {
      res.status(404).json({ error: 'card_not_found', cardId: payload.cardId });
      return;
    }

    const plan = buildWritePlan(cardKey, payload.outputs);

    if (payload.dryRun) {
      res.status(200).json({ ok: true, dryRun: true, cardKey, plan });
      return;
    }

    await applyWritePlan(db, plan);
    await db.ref(`${IDEMPOTENCY_PATH}/${payload.requestId}`).set({ at: new Date().toISOString() });

    res.status(200).json({ ok: true, cardKey, applied: plan.length });
  }
);

module.exports = { agenteAgil };
