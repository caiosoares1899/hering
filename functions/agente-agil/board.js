// functions/agente-agil/board.js
//
// ÚNICO arquivo que conhece o schema de card e os paths do Realtime
// Database. Nada além disso deveria montar um path do RTDB ou saber como
// um card é representado lá dentro — outputs/*.js só devolvem planos de
// escrita relativos (path+valor), quem monta o path absoluto e executa é
// este arquivo.

// v0: trava a escrita no squad dev-ecomm, hardcoded. Squad por request
// (ou multi-squad) fica pra quando existir mais de um especialista e/ou
// auth de verdade por agente (v4).
const SQUAD = 'dev-ecomm';

function cardsPath() {
  return `kanban/squads/${SQUAD}/dados/cards`;
}

// PONTE TEMPORÁRIA: resolve cardId -> chave real lendo o node /cards
// inteiro do squad e procurando por .id === cardId.
//
// Isso é o mesmo padrão que o kanban.html evita no cliente (custo de
// baixar o node inteiro a cada leitura) — mas aqui é aceitável por ora:
// o Agente Ágil roda sob demanda, com volume baixíssimo (teste manual via
// curl), não no hot path do board. Quando o v1 trouxer tráfego recorrente
// de verdade (Databricks rodando toda manhã), a resolução passa a usar um
// node cards_index/{cardId}->chave mantido pelo cliente (mesmo papel que
// window._cardsByKey já cumpre em memória hoje, mas persistido no RTDB) —
// decisão já tomada, só adiada pro v1 pra não misturar escopo (v1 também
// mexe em kanban.html; v0 só na function nova).
//
// Se um dia /cards migrar de array pra objeto chaveado por id de verdade
// (correção de raiz, hoje cara demais pra valer a pena), essa função toda
// — e o índice que a substituir no v1 — deixam de ser necessários.
async function resolveCardKey(db, cardId) {
  const snap = await db.ref(cardsPath()).get();
  const val = snap.val();
  if (!val) return null;
  const entries = Array.isArray(val) ? val.map((v, i) => [String(i), v]) : Object.entries(val);
  const found = entries.find(([, card]) => card && card.id === cardId);
  return found ? { key: found[0], card: found[1] } : null;
}

// Confere, logo antes de escrever, que a chave ainda aponta pro card
// esperado — cobre a corrida rara entre a resolução e a escrita (alguém
// reordenou/arquivou em massa nesse meio-tempo).
async function verifyCardKey(db, key, cardId) {
  const snap = await db.ref(`${cardsPath()}/${key}/id`).get();
  return snap.val() === cardId;
}

async function resolveCardKeyWithRetry(db, cardId, { retries = 2, delayMs = 250 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const resolved = await resolveCardKey(db, cardId);
    if (!resolved) return null;
    if (await verifyCardKey(db, resolved.key, cardId)) return resolved;
    if (attempt < retries) await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

// Executa o plano de escrita (ver outputs/index.js#buildWritePlan) contra
// o card já resolvido. NUNCA reescreve o card inteiro: entradas "update"
// viram um único multi-path update() nas folhas tocadas; entradas
// "transaction" (hoje só `links`) rodam à parte, escopadas só naquele
// campo.
async function applyWritePlan(db, cardKey, planEntries) {
  const base = `${cardsPath()}/${cardKey}`;
  const updates = {};
  const transactions = [];
  for (const entry of planEntries) {
    if (entry.kind === 'update') {
      updates[`${base}/${entry.path}`] = entry.value;
    } else if (entry.kind === 'transaction') {
      transactions.push(entry);
    } else {
      throw new Error(`plan entry de tipo desconhecido: ${entry.kind}`);
    }
  }
  const writes = [];
  if (Object.keys(updates).length) writes.push(db.ref().update(updates));
  for (const entry of transactions) {
    writes.push(db.ref(`${base}/${entry.path}`).transaction(entry.apply));
  }
  await Promise.all(writes);
}

function processedPath(requestId) {
  return `kanban/squads/${SQUAD}/dados/agente_agil_processed/${requestId}`;
}

// Idempotência: guarda requestId processados pra Databricks poder fazer
// retry sem duplicar comentário/link. TTL/limpeza automática ainda não
// existe (RTDB não tem TTL nativo — precisaria de uma scheduled function
// separada); por ora o node só cresce. Ok pro volume de v0, revisitar
// quando o Databricks estiver rodando todo dia de verdade.
async function isProcessed(db, requestId) {
  const snap = await db.ref(processedPath(requestId)).get();
  return snap.exists();
}

async function markProcessed(db, requestId, info) {
  await db.ref(processedPath(requestId)).set({ at: new Date().toISOString(), ...info });
}

module.exports = {
  SQUAD,
  cardsPath,
  resolveCardKey,
  verifyCardKey,
  resolveCardKeyWithRetry,
  applyWritePlan,
  isProcessed,
  markProcessed,
};
