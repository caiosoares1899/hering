// functions/agente-agil/board.js
//
// ÚNICO arquivo que conhece o schema de card e os paths do Realtime Database.
// Nenhum outro módulo do Agente Ágil deveria montar um path de /cards à mão.
//
// PONTE TEMPORÁRIA: /cards é armazenado como array no Realtime Database (RTDB
// representa isso como objeto de chaves numéricas). A posição de um card pode
// mudar (reorder, bulk archive), então nunca se pode confiar em índice sem
// checagem — resolveCardKey por isso sempre lê /cards inteiro e acha a chave
// certa pelo campo `id` do card, do mesmo jeito que fbSaveCard() faz no
// cliente (kanban.html).
//
// v0 aceita o custo de ler o array inteiro a cada chamada — volume de teste
// manual é baixíssimo. O v1 introduz um `cards_index` paralelo (mantido pelo
// cliente, nascendo junto com o card na criação) pra tornar essa leitura
// pontual e barata; ver decisão registrada na conversa do Agente Ágil.
//
// Se um dia /cards migrar de array pra objeto chaveado por id de verdade
// (correção de raiz, hoje cara demais pra valer a pena), resolveCardKey e o
// cards_index inteiro deixam de ser necessários.
//
// A escrita nunca reescreve o card inteiro (isso apagaria edições concorrentes
// de humanos em outros campos) — sempre update()/transaction() na folha que
// mudou. Ver functions/agente-agil/outputs/*.js pra cada tipo de output.

const outputBuilders = require('./outputs');
const storage = require('./storage');

// v0: escrita travada só neste squad (hardcoded). Autenticação/autorização
// por squad de verdade fica pro v4.
const SQUAD_ID = 'ecomm';
const CARDS_PATH = `kanban/squads/${SQUAD_ID}/dados/cards`;

async function resolveCardKey(db, cardId) {
  const snap = await db.ref(CARDS_PATH).get();
  const cards = snap.val() || {};
  const key = Object.keys(cards).find((k) => cards[k] && cards[k].id === cardId);
  return key == null ? null : key;
}

// Função pura o bastante pra testar sem emulador: valida envelope (feito em
// schema.js) -> monta plano de writes. comentario/link não têm I/O nenhum;
// relatorio_html tem (upload pro Storage), mas uploadAndSign/reportBasePath
// vêm injetados via ctx (default: storage.js de verdade) — testável com um
// fake no lugar deles, sem tocar rede nem emulador.
async function buildWritePlan(cardKey, outputs, extra = {}) {
  const ctx = {
    cardPath: `${CARDS_PATH}/${cardKey}`,
    cardId: extra.cardId,
    squadId: SQUAD_ID,
    dryRun: !!extra.dryRun,
    uploadAndSign: extra.uploadAndSign || storage.uploadAndSign,
    reportBasePath: extra.reportBasePath || storage.reportBasePath,
  };
  const plan = [];
  for (const out of outputs) {
    const builder = outputBuilders[out.type];
    if (!builder) {
      const err = new Error(`Output "${out.type}" ainda não suportado no v0`);
      err.code = 'unknown_output_type';
      throw err;
    }
    plan.push(await builder(out, ctx));
  }
  return plan;
}

async function applyWritePlan(db, plan) {
  for (const step of plan) {
    if (step.kind === 'noop') {
      continue; // só existe em dryRun (relatorio_html não sobe nada pra preview) — defensivo
    } else if (step.kind === 'update') {
      await db.ref(step.path).update(step.data);
    } else if (step.kind === 'transaction') {
      await db.ref(step.path).transaction(step.transform);
    } else {
      throw new Error(`Write plan step desconhecido: ${step.kind}`);
    }
  }
}

module.exports = { SQUAD_ID, CARDS_PATH, resolveCardKey, buildWritePlan, applyWritePlan };
