// functions/agente-agil/board.js
//
// ÚNICO arquivo que conhece o schema de card e os paths do Realtime Database.
// Nenhum outro módulo do Agente Ágil deveria montar um path de /cards à mão.
//
// PONTE TEMPORÁRIA: /cards é armazenado como array no Realtime Database (RTDB
// representa isso como objeto de chaves numéricas). A posição de um card pode
// mudar (reorder, bulk archive), então nunca se pode confiar em índice sem
// checagem.
//
// v1 (parte A): resolveCardKey lê SÓ a entrada pontual de
// cards_index/{cardId} — não mais o array /cards inteiro (isso era o v0,
// aceitável só pro volume baixíssimo de teste manual). O índice é mantido
// pelo CLIENTE (kanban.html): nasce junto com o card na criação (mesmo
// multi-path update de quem cria), e uma reconciliação na carga do board
// atua como autocorreção pra qualquer divergência. Antes de escrever no
// card, resolveCardKey ainda confere /cards/{chave}/id === cardId esperado
// — se não bater (índice desatualizado por corrida rara, ou reconciliação
// do cliente ainda não rodou), espera um tico e retenta; se continuar
// divergindo, devolve um erro rastreável (código stale_cards_index) em vez
// de arriscar escrever no card errado silenciosamente.
//
// Se um dia /cards migrar de array pra objeto chaveado por id de verdade
// (correção de raiz, hoje cara demais pra valer a pena), resolveCardKey e o
// cards_index inteiro (+ _cardsByKey no cliente) deixam de ser necessários.
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
const CARDS_INDEX_PATH = `kanban/squads/${SQUAD_ID}/dados/cards_index`;
// Sprint 2: recorrentes_index/{recorrenteDe}/{recorrenteData} -> cardId.
// Mesmo espírito do cards_index (get pontual O(1) em vez de escanear /cards),
// mantido pelo CLIENTE — processRecorrentes() em kanban.html grava isso no
// mesmo update multi-path que cria os cards do dia. Ver resolver.js.
const RECORRENTES_INDEX_PATH = `kanban/squads/${SQUAD_ID}/dados/recorrentes_index`;

async function resolveCardKey(db, cardId, { retries = 2, delayMs = 250 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const keySnap = await db.ref(`${CARDS_INDEX_PATH}/${cardId}`).get();
    const key = keySnap.val();
    if (key == null) return null; // sem entrada no índice -> card não existe (ou ainda não foi indexado)

    const idSnap = await db.ref(`${CARDS_PATH}/${key}/id`).get();
    if (idSnap.val() === cardId) return key;

    // Índice desatualizado (corrida rara: reorder/bulk archive mudou a
    // chave depois que o índice foi escrito, ou a reconciliação do cliente
    // ainda não alcançou esse card) — espera um tico e tenta de novo antes
    // de desistir.
    if (attempt < retries) await new Promise((r) => setTimeout(r, delayMs));
  }
  const err = new Error(`cards_index para "${cardId}" ficou desatualizado após ${retries} retentativas`);
  err.code = 'stale_cards_index';
  throw err;
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

module.exports = { SQUAD_ID, CARDS_PATH, CARDS_INDEX_PATH, RECORRENTES_INDEX_PATH, resolveCardKey, buildWritePlan, applyWritePlan };
