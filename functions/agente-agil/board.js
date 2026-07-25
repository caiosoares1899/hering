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
const membersLib = require('./members');
const flowLib = require('./flow');
const notifications = require('./notifications');

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
// relatorio_html tem (upload pro Storage), checklist_item/agent_status/
// mover_coluna/editar_campos também podem ter (ler card/members/columns
// pra montar o plano) — todo I/O é injetado via ctx (default: leituras de
// verdade usando extra.db), testável com fakes no lugar deles, sem tocar
// rede nem emulador.
//
// Sprint 3: builders que precisam do valor ATUAL de algum campo pra decidir
// o que escrever (ex.: mover_coluna precisa saber a coluna anterior de
// verdade, não uma que a gente leu há alguns milissegundos) usam
// transaction() e resolvem histórico/notificação só DEPOIS que a
// transaction commita de verdade, via um hook opcional `step.after(result)`
// que devolve passos extras — ver outputs/moverColuna.js, checklistItem.js,
// agentStatus.js, editarCampos.js. Builders continuam podendo devolver um
// único step (como sempre) ou um array de steps — sempre granular, nunca
// reescrevendo o card inteiro numa transaction só.
async function buildWritePlan(cardKey, outputs, extra = {}) {
  const cardPath = `${CARDS_PATH}/${cardKey}`;
  const db = extra.db || null;
  let _cardPromise = null;
  const ctx = {
    cardPath,
    cardId: extra.cardId,
    squadId: SQUAD_ID,
    dryRun: !!extra.dryRun,
    db,
    uploadAndSign: extra.uploadAndSign || storage.uploadAndSign,
    reportBasePath: extra.reportBasePath || storage.reportBasePath,
    readCard:
      extra.readCard ||
      (() => {
        if (!db) throw new Error('buildWritePlan: ctx.readCard precisa de extra.db (ou extra.readCard injetado em teste)');
        if (!_cardPromise) _cardPromise = db.ref(cardPath).get().then((s) => s.val() || {});
        return _cardPromise;
      }),
    readMembers:
      extra.readMembers ||
      (() => {
        if (!db) throw new Error('buildWritePlan: ctx.readMembers precisa de extra.db (ou extra.readMembers injetado em teste)');
        return membersLib.readSquadMembers(db, SQUAD_ID);
      }),
    readFlowMeta:
      extra.readFlowMeta ||
      (() => {
        if (!db) throw new Error('buildWritePlan: ctx.readFlowMeta precisa de extra.db (ou extra.readFlowMeta injetado em teste)');
        return flowLib.readFlowMeta(db, SQUAD_ID);
      }),
  };
  const plan = [];
  for (const out of outputs) {
    const builder = outputBuilders[out.type];
    if (!builder) {
      const err = new Error(`Output "${out.type}" ainda não suportado no v0`);
      err.code = 'unknown_output_type';
      throw err;
    }
    const built = await builder(out, ctx);
    if (Array.isArray(built)) plan.push(...built);
    else plan.push(built);
  }

  // `notificar`: lista explícita do envelope, independente de @menção no
  // texto — combinado com o time pra dar ao especialista externo um jeito
  // de avisar alguém mesmo quando não há texto nenhum pra @mencionar (ex.:
  // mover_coluna sozinho).
  if (extra.notificar && extra.notificar.length) {
    const members = await ctx.readMembers();
    const card = await ctx.readCard();
    const notifySteps = await notifications.buildExplicitNotifySteps(db, {
      squadId: SQUAD_ID,
      notificar: extra.notificar,
      members,
      cardId: extra.cardId,
      cardTitle: card.title,
      dryRun: ctx.dryRun,
    });
    plan.push(...notifySteps);
  }

  return plan;
}

async function applyWritePlan(db, plan) {
  for (const step of plan) {
    if (step.kind === 'noop') {
      continue; // só existe em dryRun (relatorio_html não sobe nada pra preview) — defensivo
    }
    let result;
    if (step.kind === 'update') {
      await db.ref(step.path).update(step.data);
    } else if (step.kind === 'transaction') {
      result = await db.ref(step.path).transaction(step.transform);
    } else {
      throw new Error(`Write plan step desconhecido: ${step.kind}`);
    }
    if (step.after) {
      const moreSteps = await step.after(result);
      if (moreSteps && moreSteps.length) await applyWritePlan(db, moreSteps);
    }
  }
}

module.exports = { SQUAD_ID, CARDS_PATH, CARDS_INDEX_PATH, RECORRENTES_INDEX_PATH, resolveCardKey, buildWritePlan, applyWritePlan };
