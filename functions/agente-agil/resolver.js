// functions/agente-agil/resolver.js
//
// Sprint 2: resolve uma "referencia" de negócio (ex.: {tipo:'recorrente',
// nome:'relatorio_diario', data:'2026-07-22'}) pra um cardId real, sem o
// especialista externo (ex.: Databricks) precisar conhecer ID interno do
// board. Só sabe o tipo 'recorrente' por enquanto — card.recorrenteDe/
// recorrenteData são carimbados por _criarCardRecorrente() no
// kanban-dev.html no momento em que o card nasce (ver processRecorrentes()).
//
// Lê recorrentes_index/{nome}/{data} -> cardId (RECORRENTES_INDEX_PATH, ver
// board.js) — get pontual O(1), mesmo espírito do cards_index, em vez de
// escanear /cards procurando por recorrenteDe+recorrenteData batendo (custo
// cresceria sem limite conforme o recorrente acumula instâncias).
//
// Se a referencia não bate com nenhum card (ex.: perguntaram antes da
// instância de hoje nascer), lança um erro rastreável (code:
// 'referencia_not_found') em vez de criar um card sozinho — "criar card do
// zero a partir de uma referencia" é escopo de um Sprint futuro, ainda não
// decidido.

const { RECORRENTES_INDEX_PATH } = require('./board');

async function resolveReferencia(db, referencia) {
  if (!referencia || typeof referencia !== 'object') {
    const err = new Error('referencia ausente ou inválida');
    err.code = 'invalid_referencia';
    throw err;
  }

  if (referencia.tipo === 'recorrente') {
    const { nome, data } = referencia;
    const snap = await db.ref(`${RECORRENTES_INDEX_PATH}/${nome}/${data}`).get();
    const cardId = snap.val();
    if (!cardId) {
      const err = new Error(
        `Nenhum card encontrado para o recorrente "${nome}" na data "${data}" — ` +
          'talvez a instância de hoje ainda não tenha nascido (processRecorrentes roda ao abrir o board).'
      );
      err.code = 'referencia_not_found';
      throw err;
    }
    return cardId;
  }

  const err = new Error(`Tipo de referencia "${referencia.tipo}" não suportado`);
  err.code = 'unknown_referencia_type';
  throw err;
}

module.exports = { resolveReferencia };
