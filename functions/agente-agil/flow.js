// functions/agente-agil/flow.js
//
// Metadados de fluxo do board (columns + config/flow) — não fazem parte do
// card, mas o output mover_coluna precisa deles pra decidir se o destino é
// uma coluna de "fim" (pra disparar notifDone-equivalente) e pra montar o
// rótulo humano da coluna no histórico. Réplica de _flowStartColIds()/
// _flowDoneColId()/_flowDoneColIds() em kanban-dev.html.
//
// Deliberadamente usa flowConfig.doneCols (a config oficial que o PO
// configura em Configurações > Fluxo) como fonte de verdade pra "isso é
// coluna de fim", com fallback pra heurística por nome/id só quando o PO
// não configurou nada — não a heurística mais simples que o cliente usa
// inline em alguns call-sites de notificação (columns.find id==='done' ||
// nome contém "conclu"/"feito"). Combinado com o time: usar a fonte mais
// confiável aqui é mais correto e mais fácil de auditar do que reproduzir
// a heurística simplificada, mesmo custando uma leitura a mais.
//
// Cache em memória por instância "quente" (TTL curto), mesmo espírito do
// cache de members.js — mover_coluna não deveria reler columns/config toda
// vez que o agente move um card.

const CACHE_TTL_MS = 60 * 1000;
let _cache = { ts: 0, squadId: null, data: null };

async function readFlowMeta(db, squadId, { forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && _cache.data && _cache.squadId === squadId && now - _cache.ts < CACHE_TTL_MS) {
    return _cache.data;
  }
  const [columnsSnap, flowSnap] = await Promise.all([
    db.ref(`kanban/squads/${squadId}/dados/columns`).get(),
    db.ref(`kanban/squads/${squadId}/dados/config/flow`).get(),
  ]);
  const columns = columnsSnap.val() || [];
  const flowConfig = flowSnap.val() || { startCols: [], doneCols: [], reportCols: [] };
  const data = { columns, flowConfig };
  _cache = { ts: now, squadId, data };
  return data;
}

function startColumnIds({ columns, flowConfig }) {
  if (flowConfig?.startCols?.length) {
    const valid = flowConfig.startCols.filter((id) => (columns || []).some((c) => c.id === id));
    if (valid.length) return valid;
  }
  const explicit = (columns || []).find((c) => c.id === 'progress' || /progress|andamento|fazendo|doing|execu/i.test(c.name || ''));
  if (explicit) return [explicit.id];
  const ids = (columns || []).map((c) => c.id);
  return ids.length > 1 ? [ids[1]] : ids.slice(0, 1);
}

function doneColumnIds({ columns, flowConfig }) {
  if (flowConfig?.doneCols?.length) {
    const valid = flowConfig.doneCols.filter((id) => (columns || []).some((c) => c.id === id));
    if (valid.length) return valid;
  }
  const c = (columns || []).find((x) => x.id === 'done' || /conclu|done|feito|finaliz/i.test(x.name || ''));
  return c ? [c.id] : [];
}

function isDoneColumn(colId, meta) {
  return doneColumnIds(meta).includes(colId);
}

function columnName(colId, columns) {
  const c = (columns || []).find((x) => x.id === colId);
  return c ? c.name : colId;
}

function columnExists(colId, columns) {
  return (columns || []).some((c) => c.id === colId);
}

module.exports = {
  readFlowMeta,
  startColumnIds,
  doneColumnIds,
  isDoneColumn,
  columnName,
  columnExists,
  _resetCacheForTests() {
    _cache = { ts: 0, squadId: null, data: null };
  },
};
