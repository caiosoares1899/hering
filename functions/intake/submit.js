// functions/intake/submit.js
//
// Formulário de intake por squad (Fase 5, item 4) — link público, sem
// login, pra alguém de fora do squad (ou até de fora da empresa) pedir
// algo sem precisar de conta no Maré Digital. O board em si não aceita
// escrita anônima (database.rules.json exige auth != null em kanban/**),
// então este é o único ponto de contato: valida o payload com o Admin SDK
// (que ignora as regras) e grava só um registro leve em
// kanban/squads/{squad}/dados/intake_pending/{id} — NUNCA em /cards
// diretamente.
//
// Por que não escrever direto em /cards: /cards é um array reescrito por
// INTEIRO a cada fbSaveAll() do cliente (criar/excluir/reordenar cards) —
// ver o comentário grande em fbSaveAll() no kanban-dev.html. Um card
// inserido por fora, sem passar pelo array em memória de nenhum
// cliente, seria apagado silenciosamente no primeiro fbSaveAll() de
// qualquer pessoa do squad. intake_pending é um nó comum (chaveado por
// push-id, não array), sem esse risco — o cliente (kanban-dev.html) é
// quem lê esse nó e cria o card de verdade pelo fluxo normal
// (cards.push()+fbSaveAll()), com uma pessoa de carne e osso confirmando
// antes.
//
// Sem CAPTCHA (sem lib nova, sem custo) — defesa é: honeypot (campo
// invisível que só um bot preenche) + limite de taxa por IP guardado em
// kanban/_intake_rate/{ipHash} (Admin SDK, fora do alcance das regras
// normais).

const { onRequest } = require('firebase-functions/v2/https');
const { getDatabase } = require('firebase-admin/database');
const crypto = require('crypto');

const ALLOWED_ORIGIN = 'https://caiosoares1899.github.io';
const RATE_LIMIT_MAX = 5; // envios por IP
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // por hora

function setCors(res) {
  res.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}

function hashIp(ip) {
  return crypto.createHash('sha256').update(String(ip || 'unknown')).digest('hex').slice(0, 24);
}

function clean(str, maxLen) {
  return String(str || '').trim().slice(0, maxLen);
}

// squads_meta (kanban/squads_meta) só existe pros squads criados
// DINAMICAMENTE pelo painel (ver loadSquadsFromFirebase em
// kanban-dev.html, mesmo nó) — os squads originais (dados, prf,
// midiacriativa...) nunca ganharam entrada lá, e o próprio board trata
// isso como esperado, caindo num mapa fixo (_SQ_LABELS/_SQ_FALLBACK em
// kanban-dev.html) quando squads_meta não tem o squad. Espelhado aqui:
// a primeira versão desta function validava existência confiando SÓ em
// squads_meta, e rejeitava qualquer squad que não tivesse entrada lá —
// bug real, achado em teste manual (intake.html?squad=dados voltava
// "squad não encontrado" mesmo o squad dados sendo real e ativo, só por
// nunca ter passado pelo painel).
const SQUAD_FALLBACK = {
  dados: { label: 'Dados', emoji: '📊' },
  prf: { label: 'Marketing de Performance', emoji: '📱' },
  midiacriativa: { label: 'Mídia Criativa', emoji: '🎨' },
  dev: { label: 'Dev', emoji: '🧪' },
  gestao: { label: 'Gestão', emoji: '🏛' },
};

const intakeSubmit = onRequest({ region: 'us-central1' }, async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

  const db = getDatabase();
  const squad = clean(req.query.squad || req.body?.squad, 40);
  if (!squad) { res.status(400).json({ error: 'missing_squad' }); return; }

  // Existência de verdade do squad: kanban/squads/{squad}/dados é o path
  // base usado por TODO o board (const FB em kanban-dev.html) — se ele
  // existe, o squad é real, independente de ter squads_meta ou não.
  const dadosSnap = await db.ref(`kanban/squads/${squad}/dados`).get();
  if (!dadosSnap.exists()) { res.status(404).json({ error: 'squad_not_found' }); return; }

  const metaSnap = await db.ref(`kanban/squads_meta/${squad}`).get();
  const meta = metaSnap.val() || {};
  const fallback = SQUAD_FALLBACK[squad] || {};
  const label = meta.label || fallback.label || squad;
  const emoji = meta.emoji || fallback.emoji || '🐟';
  const color = meta.color || '#38b6ff';

  if (req.method === 'GET') {
    res.status(200).json({ ok: true, squad: { id: squad, label, emoji, color } });
    return;
  }

  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }

  const body = req.body || {};
  // Honeypot: campo escondido por CSS no formulário público — humano nunca
  // preenche, bot genérico costuma preencher todo campo que encontra.
  if (clean(body.website, 200)) { res.status(200).json({ ok: true }); return; } // finge sucesso, não dá pista pro bot

  const titulo = clean(body.titulo, 200);
  const demandante = clean(body.demandante, 120);
  if (!titulo || !demandante) { res.status(400).json({ error: 'missing_required_fields' }); return; }
  const descricao = clean(body.descricao, 4000);
  const contato = clean(body.contato, 200);
  const prazo = /^\d{4}-\d{2}-\d{2}$/.test(body.prazo) ? body.prazo : '';

  const ip = req.headers['fastly-client-ip'] || req.headers['x-forwarded-for'] || req.ip || 'unknown';
  const ipKey = hashIp(String(ip).split(',')[0].trim());
  const rateRef = db.ref(`kanban/_intake_rate/${ipKey}`);
  const now = Date.now();
  const rateSnap = await rateRef.get();
  const rate = rateSnap.val();
  if (rate && rate.resetAt > now) {
    if (rate.count >= RATE_LIMIT_MAX) {
      res.status(429).json({ error: 'rate_limited' });
      return;
    }
    await rateRef.update({ count: rate.count + 1 });
  } else {
    await rateRef.set({ count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  }

  const pendingRef = db.ref(`kanban/squads/${squad}/dados/intake_pending`).push();
  await pendingRef.set({
    id: pendingRef.key,
    titulo, descricao, demandante, contato, prazo,
    createdAt: new Date().toISOString(),
    status: 'pending',
  });

  res.status(200).json({ ok: true });
});

module.exports = { intakeSubmit };
