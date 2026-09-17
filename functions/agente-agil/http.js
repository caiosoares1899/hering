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
const crypto = require('crypto');

const { intakeEnvelope } = require('./schema');
const { SQUAD_ID } = require('./board');
const { resolveReferencia } = require('./resolver');

const AGENTE_AGIL_KEY = defineSecret('AGENTE_AGIL_KEY');

const IDEMPOTENCY_PATH = `kanban/squads/${SQUAD_ID}/dados/agente_agil_processed`;
const intakePendingPath = (squadId) => `kanban/squads/${squadId}/dados/agente_intake_pending`;
const AUTH_RATE_LIMIT_PATH = 'kanban/_agente_agil_auth_rate';
const AUTH_RATE_LIMIT_MAX = 20; // tentativas de auth (certas ou erradas) por IP
const AUTH_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // por hora

// Único especialista real usando este canal até 2026-08-25 — nenhuma
// chamada existente manda `especialista` no envelope ainda (campo opcional,
// ver schema.js). Mesmo fallback de sempre, agora usado só pra rotular o
// item enfileirado (não mais pra creditar uma escrita direta).
const DEFAULT_ESPECIALISTA = 'databricks';

function hashIp(ip) {
  return crypto.createHash('sha256').update(String(ip || 'unknown')).digest('hex').slice(0, 24);
}

// Comparação constant-time do secret (achado de análise de segurança,
// 2026-09-17): `!==` numa string comum vaga cedo no primeiro byte
// diferente, abrindo (na teoria — exige muita paciência estatística
// numa rede real) um timing attack pra adivinhar AGENTE_AGIL_KEY byte a
// byte. crypto.timingSafeEqual() exige os dois buffers do MESMO
// tamanho — checagem de tamanho primeiro não é constant-time em si, mas
// vaza só o COMPRIMENTO do header recebido, não nenhum byte do segredo.
function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Rate limit de tentativas de autenticação por IP (achado de análise de
// segurança, 2026-09-17: este endpoint não tinha NENHUM freio, diferente
// de intake/submit.js — combinado com o timing attack acima, dava pra
// tentar adivinhar o secret sem limite nenhum de tentativas). Conta TODA
// tentativa (certa ou errada) — mesmo padrão de transaction() atômico já
// usado no rate limiter de intake/submit.js, pro mesmo motivo (get()+set()
// não-atômico deixava um script concorrente furar o limite).
async function checkAuthRateLimit(db, req) {
  const ip = req.headers['fastly-client-ip'] || req.headers['x-forwarded-for'] || req.ip || 'unknown';
  const ipKey = hashIp(String(ip).split(',')[0].trim());
  const rateRef = db.ref(`${AUTH_RATE_LIMIT_PATH}/${ipKey}`);
  const now = Date.now();
  let limited = false;
  await rateRef.transaction((current) => {
    limited = false;
    if (!current || current.resetAt <= now) {
      return { count: 1, resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS };
    }
    if (current.count >= AUTH_RATE_LIMIT_MAX) {
      limited = true;
      return;
    }
    return { count: current.count + 1, resetAt: current.resetAt };
  });
  return limited;
}

const agenteAgil = onRequest(
  { region: 'us-central1', secrets: [AGENTE_AGIL_KEY] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'method_not_allowed' });
      return;
    }

    const db = getDatabase();
    if (await checkAuthRateLimit(db, req)) {
      res.status(429).json({ error: 'rate_limited' });
      return;
    }

    if (!timingSafeEqualStr(req.get('x-agent-key'), AGENTE_AGIL_KEY.value())) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const parsed = intakeEnvelope.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      return;
    }
    const payload = parsed.data;

    const idemRef = db.ref(`${IDEMPOTENCY_PATH}/${payload.requestId}`);
    // Checagem rápida (não-atômica, só evita refazer a resolução de
    // referencia pro caso comum de retry já conhecido) -- a guarda de
    // verdade é a transaction() logo abaixo, feita só depois da resolução
    // de referencia pra não "gastar" o requestId se ela falhar com 500
    // (um retry legítimo do cliente depois de um erro transiente ainda
    // precisa conseguir processar).
    const processedSnap = await idemRef.get();
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

    // Achado real (/monitorarbugs, áreas sensíveis, 2026-09-11): a checagem
    // get()+set() acima/abaixo não é atômica -- 2 requisições concorrentes
    // com o MESMO requestId (retry por timeout do especialista externo,
    // cenário comum em integração HTTP) passavam as duas pelo get() antes
    // de qualquer uma gravar, criando 2 entradas pendentes duplicadas que o
    // orquestrador processava 2x. Reivindica o requestId atomicamente antes
    // de criar o pending entry -- se outra requisição concorrente já
    // reivindicou, esta recebe idempotent:true sem duplicar nada.
    let alreadyClaimed = false;
    const claimResult = await idemRef.transaction((current) => {
      alreadyClaimed = !!current;
      if (current) return; // aborta, não sobrescreve o registro existente
      return { at: new Date().toISOString(), claiming: true };
    });
    if (alreadyClaimed || !claimResult.committed) {
      res.status(200).json({ ok: true, idempotent: true });
      return;
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
    await idemRef.update({ pendingId: pendingRef.key });

    res.status(200).json({ ok: true, queued: true, pendingId: pendingRef.key });
  }
);

module.exports = { agenteAgil };
