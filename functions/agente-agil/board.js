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

// v0: escrita travada só neste squad por padrão. Fase 2 (agente-agil-
// orquestrador/) precisa rodar contra outros squads (ex.: 'dev', pra dryRun)
// sem arriscar produção — por isso todo path abaixo virou função de
// `squadId`, mas o valor default segue sendo este, e nada em http.js precisa
// mudar (ele nunca passa squadId, então continua batendo em 'ecomm' exatamente
// como antes). Autenticação/autorização por squad de verdade fica pro v4.
const SQUAD_ID = 'ecomm';
const cardsPath = (squadId) => `kanban/squads/${squadId}/dados/cards`;
const cardsIndexPath = (squadId) => `kanban/squads/${squadId}/dados/cards_index`;
// cards_updated_at/{cardId}->timestamp: índice paralelo que o CLIENTE
// (kanban.html, fbSaveCard/fbSaveAll) sempre carimba junto com qualquer
// escrita de card — é dele que o delta-sync (_planCardsDelta, carregamento
// em duas etapas E os listeners ao vivo) decide se um card mudou desde a
// última visita, sem ler /cards inteiro de novo. Se uma escrita no card não
// carimbar isso, ela fica INVISÍVEL pro delta-sync: o cliente segue servindo
// a versão em cache pra sempre, sem erro nenhum (achado na validação manual
// do Sprint 3, teste 6.2 — editar_campos escrevia a tag certinho no card,
// mas a UI nunca via a mudança). applyWritePlan() carimba isso centralizado
// (ver mais abaixo) pra todo write do Agente Ágil manter o mesmo invariante
// que o cliente já mantém — nenhum output builder precisa saber disso.
const cardsUpdatedAtPath = (squadId) => `kanban/squads/${squadId}/dados/cards_updated_at`;
// Sprint 2: recorrentes_index/{recorrenteDe}/{recorrenteData} -> cardId.
// Mesmo espírito do cards_index (get pontual O(1) em vez de escanear /cards),
// mantido pelo CLIENTE — processRecorrentes() em kanban.html grava isso no
// mesmo update multi-path que cria os cards do dia. Ver resolver.js.
const recorrentesIndexPath = (squadId) => `kanban/squads/${squadId}/dados/recorrentes_index`;
const tagsPath = (squadId) => `kanban/squads/${squadId}/dados/tags`;
// Comentários NÃO vivem mais dentro do card (`card.comments`) desde a
// migração Fase 1.1 (2026-08-11, kanban-dev.html) — viram um path próprio
// por squad, chaveado por cardId. Achado real (2026-08-18): `outputs/
// comentario.js` e `tools/lerCard.js` (agente-agil-orquestrador) nunca
// foram atualizados junto com essa migração — continuaram escrevendo/lendo
// `card.comments`, um campo morto que a UI não usa mais desde então.
// Escritas iam com sucesso (sem erro, `dryRun:false` no output), só que
// pra um lugar que ninguém lê mais — os comentários dos canários 9/10 e da
// 1ª @menção real nunca apareceram de verdade no board, mesmo com todo
// check automático passando. Corrigido usando este path (mesmo que
// FB+'/card_comments/'+cardId+'/'+commentId em kanban-dev.html).
const cardCommentsPath = (squadId, cardId) => `kanban/squads/${squadId}/dados/card_comments/${cardId}`;

// Constantes pré-calculadas pro squad default — mantidas por compatibilidade
// (http.js e os testes existentes as importam literalmente; ver funções
// acima pra montar o path de qualquer outro squad).
const CARDS_PATH = cardsPath(SQUAD_ID);
const CARDS_INDEX_PATH = cardsIndexPath(SQUAD_ID);
const CARDS_UPDATED_AT_PATH = cardsUpdatedAtPath(SQUAD_ID);
const RECORRENTES_INDEX_PATH = recorrentesIndexPath(SQUAD_ID);

async function resolveCardKey(db, cardId, { squadId = SQUAD_ID, retries = 2, delayMs = 250 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const keySnap = await db.ref(`${cardsIndexPath(squadId)}/${cardId}`).get();
    const key = keySnap.val();
    if (key == null) return null; // sem entrada no índice -> card não existe (ou ainda não foi indexado)

    const idSnap = await db.ref(`${cardsPath(squadId)}/${key}/id`).get();
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
  const squadId = extra.squadId || SQUAD_ID;
  const cardPath = `${cardsPath(squadId)}/${cardKey}`;
  const db = extra.db || null;
  let _cardPromise = null;
  const ctx = {
    cardPath,
    // Pré-calculado aqui (mesmo espírito de cardPath) em vez de outputs/
    // comentario.js importar board.js pra montar sozinho — board.js já
    // requer ./outputs (outputBuilders) no topo do arquivo, então um
    // require reverso de outputs/comentario.js -> ../board criaria
    // dependência circular (module.exports ainda incompleto na hora que
    // comentario.js carrega, achado real: "cardCommentsPath is not a
    // function").
    cardCommentsPath: cardCommentsPath(squadId, extra.cardId),
    cardId: extra.cardId,
    squadId,
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
        return membersLib.readSquadMembers(db, squadId);
      }),
    readFlowMeta:
      extra.readFlowMeta ||
      (() => {
        if (!db) throw new Error('buildWritePlan: ctx.readFlowMeta precisa de extra.db (ou extra.readFlowMeta injetado em teste)');
        return flowLib.readFlowMeta(db, squadId);
      }),
    // Lista de tags do squad ({id, label, ...}) — usado por editar_campos pra
    // resolver o label legível que o especialista manda pro id interno que o
    // card de verdade guarda em card.tags (ver outputs/editarCampos.js).
    readTags:
      extra.readTags ||
      (() => {
        if (!db) throw new Error('buildWritePlan: ctx.readTags precisa de extra.db (ou extra.readTags injetado em teste)');
        return db
          .ref(tagsPath(squadId))
          .get()
          .then((s) => s.val() || []);
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
      squadId,
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

// Executa os steps de verdade e devolve os paths tocados (inclui os steps
// que só existem por causa de um hook `after`, ex.: o history escrito depois
// que uma transaction de tags/coluna/status commita) — usado por
// applyWritePlan() pra decidir se a escrita tocou o card e precisa carimbar
// updatedAt/cards_updated_at (ver CARDS_UPDATED_AT_PATH acima).
async function _applySteps(db, plan) {
  const touchedPaths = [];
  for (const step of plan) {
    if (step.kind === 'noop') {
      continue; // só existe em dryRun (relatorio_html não sobe nada pra preview) — defensivo
    }
    touchedPaths.push(step.path);
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
      if (moreSteps && moreSteps.length) touchedPaths.push(...(await _applySteps(db, moreSteps)));
    }
  }
  return touchedPaths;
}

// cardMeta ({cardPath, cardId, squadId?}) é opcional — quando vem (sempre, no
// uso real via http.js), e algum step do plano tocou dentro do card (path ===
// cardPath ou começa com `${cardPath}/`), carimba updatedAt do card +
// cards_updated_at no MESMO commit lógico da escrita, com um único timestamp
// pros dois. squadId é opcional (default SQUAD_ID) — só importa pra saber em
// qual cards_updated_at carimbar; cardMeta.cardPath já vem pronto de quem
// chama (não é recalculado aqui). Sem isso, todo write do Agente Ágil fica
// invisível pro delta-sync do cliente (ver comentário de cardsUpdatedAtPath)
// — não é responsabilidade de cada output builder saber disso, por isso fica
// centralizado aqui.
async function applyWritePlan(db, plan, cardMeta = null) {
  const touchedPaths = await _applySteps(db, plan);
  if (!cardMeta) return;
  const touchedCard = touchedPaths.some((p) => p === cardMeta.cardPath || (p && p.startsWith(`${cardMeta.cardPath}/`)));
  if (!touchedCard) return;
  const stampedAt = new Date().toISOString();
  await db.ref(cardMeta.cardPath).update({ updatedAt: stampedAt });
  await db.ref(cardsUpdatedAtPath(cardMeta.squadId || SQUAD_ID)).update({ [cardMeta.cardId]: stampedAt });
}

module.exports = {
  SQUAD_ID,
  CARDS_PATH,
  CARDS_INDEX_PATH,
  RECORRENTES_INDEX_PATH,
  CARDS_UPDATED_AT_PATH,
  cardsPath,
  cardsIndexPath,
  cardsUpdatedAtPath,
  cardCommentsPath,
  recorrentesIndexPath,
  tagsPath,
  resolveCardKey,
  buildWritePlan,
  applyWritePlan,
};
