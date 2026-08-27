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
// Sprint 3: vocabulário de ações (checklist_item, agent_status,
// mover_coluna, editar_campos — ver outputs/*.js) e o campo `notificar` do
// envelope, ambos passados adiante em buildWritePlan(..., {db, notificar})
// pra poder ler card/members/columns e resolver @menções/notificações.
//
// CORREÇÃO DE ARQUITETURA (2026-08-27, pedido direto do usuário): até aqui
// este endpoint aplicava a AÇÃO que o especialista mandava (mover_coluna,
// editar_campos...) direto no board, via buildWritePlan/applyWritePlan —
// o orquestrador (agente-agil-orquestrador/) nunca participava dessa
// escrita. Isso contrariava a ideia de fundo do orquestrador: "os outros
// agentes NÃO tenham acesso ao board... eles devem se comunicar com o
// Agente Ágil e ele executa as ações... porque ele conhece o board e o
// fluxo do time, ele toma as decisões". Um especialista com um vocabulário
// fixo de ações decidindo sozinho o que escrever é exatamente o oposto
// disso — e não escala pra "outros agentes e subagentes que possam vir mais
// pra frente" com formatos "que nem sempre vamos conseguir adaptar"
// (palavras do usuário) pro vocabulário de outputs.
//
// Este endpoint agora SÓ enfileira. Valida o envelope novo (`intakeEnvelope`
// em schema.js — texto livre obrigatório, cardId/referencia como DICA
// opcional) e grava em kanban/squads/{squad}/dados/agente_intake_pending/
// {id} — nó comum (chaveado por push-id, nunca um array), mesmo espírito de
// segurança que kanban/squads/{squad}/dados/intake_pending já usa pro
// formulário público (ver functions/intake/submit.js). Quem decide o que
// fazer com essa informação — comentar, mover, tagear, mencionar um humano,
// ou até criar um card novo — é o orquestrador, via o gatilho automático
// novo (agente-agil-orquestrador/intakeTrigger.js), nunca mais este arquivo.
//
// O vocabulário `output`/`outputs` de schema.js (mover_coluna, editar_campos,
// etc.) continua existindo só como contrato legado — não é mais lido daqui.

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getDatabase } = require('firebase-admin/database');

const { intakeEnvelope } = require('./schema');
const { SQUAD_ID } = require('./board');
const { resolveReferencia } = require('./resolver');

const AGENTE_AGIL_KEY = defineSecret('AGENTE_AGIL_KEY');

const IDEMPOTENCY_PATH = `kanban/squads/${SQUAD_ID}/dados/agente_agil_processed`;
const intakePendingPath = (squadId) => `kanban/squads/${squadId}/dados/agente_intake_pending`;

// Único especialista real usando este canal até 2026-08-25 — nenhuma
// chamada existente manda `especialista` no envelope ainda (campo opcional,
// ver schema.js). Mesmo fallback de sempre, agora usado só pra rotular o
// item enfileirado (não mais pra creditar uma escrita direta).
const DEFAULT_ESPECIALISTA = 'databricks';

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

    const parsed = intakeEnvelope.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }
    const payload = parsed.data;
    const db = getDatabase();

    const processedSnap = await db.ref(`${IDEMPOTENCY_PATH}/${payload.requestId}`).get();
    if (processedSnap.exists()) {
      res.status(200).json({ ok: true, idempotent: true });
      return;
    }

    // cardId direto ou referencia de negócio — os dois continuam servindo só
    // de DICA pro orquestrador (ver intakeTrigger.js); diferente do contrato
    // antigo, uma referencia que não resolve não derruba mais o pedido com
    // 404 — vira um item sem cardId, e o orquestrador decide sozinho.
    let cardId = payload.cardId || null;
    if (payload.referencia) {
      try {
        cardId = await resolveReferencia(db, payload.referencia);
      } catch (err) {
        if (err.code !== 'referencia_not_found') {
          console.error('[agenteAgil] falha ao resolver referencia:', err);
          res.status(500).json({ error: 'resolve_referencia_failed' });
          return;
        }
        cardId = null;
      }
    }

    const pendingRef = db.ref(intakePendingPath(SQUAD_ID)).push();
    const entry = {
      id: pendingRef.key,
      requestId: payload.requestId,
      especialista: payload.especialista || DEFAULT_ESPECIALISTA,
      texto: payload.texto,
      cardId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    await pendingRef.set(entry);
    await db.ref(`${IDEMPOTENCY_PATH}/${payload.requestId}`).set({ at: new Date().toISOString(), pendingId: pendingRef.key });

    res.status(200).json({ ok: true, queued: true, pendingId: pendingRef.key });
  }
);

module.exports = { agenteAgil };
