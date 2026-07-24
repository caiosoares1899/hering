// functions/agente-agil/http.js
//
// Endpoint HTTP do Agente Ágil — o ÚNICO ponto de contato entre especialistas
// externos (hoje: agente Databricks) e o board. Especialistas nunca leem/
// escrevem direto no Firebase; só mandam esse envelope aqui.
//
// v0: auth por secret compartilhado (header x-agent-key), idempotência por
// requestId (sem TTL de limpeza automática ainda — RTDB não tem TTL nativo;
// só evita duplicar em retry), outputs "comentario", "link" e
// "relatorio_html" (hospeda no Storage, ver outputs/relatorioHtml.js).
// Sprint 2: resolução de card por cardId direto OU por "referencia" de
// negócio (recorrência + data, ver resolver.js) — o especialista manda um
// dos dois, nunca os dois.

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getDatabase } = require('firebase-admin/database');

const { envelope } = require('./schema');
const { SQUAD_ID, resolveCardKey, buildWritePlan, applyWritePlan } = require('./board');
const { resolveReferencia } = require('./resolver');

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

    // cardId direto (v0) ou referencia de negócio (Sprint 2) — schema.js já
    // garante que exatamente um dos dois veio preenchido. A partir daqui o
    // resto do fluxo (resolveCardKey, buildWritePlan, applyWritePlan) só
    // conhece cardId — não importa de qual dos dois formatos ele veio.
    let cardId = payload.cardId;
    if (payload.referencia) {
      try {
        cardId = await resolveReferencia(db, payload.referencia);
      } catch (err) {
        if (err.code === 'referencia_not_found') {
          res.status(404).json({ error: 'referencia_not_found', referencia: payload.referencia, message: err.message });
          return;
        }
        console.error('[agenteAgil] falha ao resolver referencia:', err);
        res.status(500).json({ error: 'resolve_referencia_failed' });
        return;
      }
    }

    let cardKey;
    try {
      cardKey = await resolveCardKey(db, cardId);
    } catch (err) {
      if (err.code === 'stale_cards_index') {
        // cards_index apontava pra uma chave que não bate mais com o card
        // esperado, mesmo depois de retentar — rastreável em vez de
        // arriscar escrever no card errado silenciosamente. 409: o cliente
        // pode tentar de novo (a reconciliação de carga do board deve
        // corrigir o índice na próxima vez que alguém abrir o kanban).
        res.status(409).json({ error: 'stale_cards_index', cardId, message: err.message });
        return;
      }
      console.error('[agenteAgil] falha ao resolver cardId:', err);
      res.status(500).json({ error: 'resolve_card_key_failed' });
      return;
    }
    if (!cardKey) {
      res.status(404).json({ error: 'card_not_found', cardId });
      return;
    }

    let plan;
    try {
      plan = await buildWritePlan(cardKey, payload.outputs, { cardId, dryRun: payload.dryRun });
    } catch (err) {
      if (err.code === 'unknown_output_type') {
        res.status(400).json({ error: 'invalid_output', message: err.message });
        return;
      }
      // Falha de I/O de verdade (ex.: upload de relatorio_html pro Storage) —
      // não é payload inválido do especialista, é falha do nosso lado.
      console.error('[agenteAgil] falha ao montar plano de escrita:', err);
      res.status(500).json({ error: 'write_plan_failed' });
      return;
    }

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
