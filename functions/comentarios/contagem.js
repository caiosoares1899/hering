// functions/comentarios/contagem.js
//
// Mantém kanban/squads/{squad}/dados/card_comments_count/{cardId} = quantidade de comentários do card.
// Existe pro board desenhar o indicador 💬 na linha de ícones do card (ao lado de ≡ descrição e 📎
// anexo) sem baixar os comentários de todos os cards: os comentários vivem em card_comments/{cardId}/…
// (path próprio, nunca vêm junto do card) e o board só escuta este índice minúsculo (id → n).
//
// Por que uma Cloud Function e não um contador no navegador: comentário é escrito por MAIS DE UM
// caminho — o cliente (3 pontos + importar/duplicar) E as functions do Agente Ágil (respostas, resumos).
// Um contador mantido só no cliente perderia exatamente as respostas do agente.
//
// Recalcula a contagem lendo os filhos (em vez de +1/-1): RTDB não garante exatamente-uma-vez, e
// recalcular é idempotente — reentrega, ordem trocada ou exclusão em lote dão sempre o número certo.
// Este gatilho só escreve em card_comments_count, nunca em card_comments — sem risco de loop.
const { onValueWritten } = require('firebase-functions/v2/database');
const { getDatabase } = require('firebase-admin/database');

async function recalcularContagem(db, squadId, cardId) {
  const base = `kanban/squads/${squadId}/dados`;
  const snap = await db.ref(`${base}/card_comments/${cardId}`).get();
  const val = snap.val();
  const n = val && typeof val === 'object' ? Object.keys(val).length : 0;
  const ref = db.ref(`${base}/card_comments_count/${cardId}`);
  if (n > 0) await ref.set(n); else await ref.remove();
  return n;
}

const contarComentarios = onValueWritten(
  {
    ref: '/kanban/squads/{squadId}/dados/card_comments/{cardId}/{commentId}',
    region: 'us-central1',
  },
  async (event) => {
    const { squadId, cardId } = event.params;
    await recalcularContagem(getDatabase(), squadId, cardId);
  }
);

module.exports = { contarComentarios, recalcularContagem };
