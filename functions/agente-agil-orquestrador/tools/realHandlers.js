// functions/agente-agil-orquestrador/tools/realHandlers.js
//
// Etapa 2: chama o MESMO motor de escrita que agente-agil/http.js já usa em
// produção (resolveCardKey -> buildWritePlan -> applyWritePlan), no mesmo
// processo, sem HTTP no meio. squadId/cardId vêm fixos da tarefa que o
// orquestrador está executando (não são decididos pelo LLM por tool call) —
// só o `input` de cada chamada, já validado contra o schema Zod
// correspondente (ver tools/index.js), vem do modelo.
//
// dryRun agora é parâmetro de verdade (Etapa 3) — default `true`, nunca um
// global escondido, mesmo padrão de `enabled` em loop.js/limits.js: quem
// quiser escrita real precisa passar `dryRun: false` explicitamente em
// CADA chamada de `buildTools`/`makeRealHandler`; omitir o parâmetro (todo
// script/teste anterior a este commit) preserva o comportamento de sempre
// — plano sempre montado (dá pra inspecionar o que SERIA escrito), nunca
// aplicado. Validado ponta a ponta contra o squad 'dev' (ver README —
// cenário 5) antes de virar parâmetro de verdade, exatamente a condição
// que este comentário antes dizia que faltava.
//
// buildWritePlan() despacha por out.type (união discriminada de
// agente-agil/schema.js) — no caminho de produção (http.js) isso vem de um
// envelope JÁ validado por schema.js (envelope.parse(), que exige "type"
// como campo obrigatório do discriminatedUnion) antes de chegar aqui, então
// nunca falta. Aqui o `input` vem direto do tool_use do Claude, restrito só
// pelo `input_schema` de cada ferramenta (ver tools/index.js) — e o
// protocolo de tool-use da Anthropic devolve só os parâmetros que o
// schema define como propriedades da ferramenta, sem reconstituir o nome
// da própria ferramenta dentro do input. Achado ao rodar o cenário de
// mover_coluna sem ambiguidade com LLM real: o modelo devolveu
// `{coluna: "done"}`, sem "type" nenhum, e buildWritePlan falhou com
// `unknown_output_type` (Output "undefined") em toda tentativa — o
// vocabulário nunca tinha, até então, exercitado com sucesso uma ferramenta
// de risco médio de verdade (só evitada/ambígua nos cenários anteriores).
// `toolName` (o nome da própria ferramenta chamada) já desambigua 100% dos
// casos sozinho — nunca é decidido pelo LLM por tool call, é fixado por
// qual ferramenta o protocolo de tool-use invocou — então reconstituir
// `type` a partir dele aqui, sempre, é seguro mesmo quando o modelo também
// manda o campo (sobrescreve com o mesmo valor, no-op).
const { resolveCardKey, buildWritePlan, applyWritePlan, cardsPath } = require('../../agente-agil/board');
const { enqueuePendingAutoFromDiff } = require('../pendingAuto');

// Compartilhado por makeRealHandler (1 output = a própria tool call) e
// makeRealPerguntarHumanoHandler (2 outputs compostos, ver abaixo) — resolve
// o card, monta o plano, aplica de verdade só se dryRun:false. Mesmo padrão
// de http.js: cardMeta faz applyWritePlan carimbar updatedAt do card +
// cards_updated_at no mesmo write, senão o delta-sync do cliente nunca
// percebe que o card mudou.
async function runWritePlan({ db, squadId, cardId, outputs, dryRun, toolName }) {
  const cardKey = await resolveCardKey(db, cardId, { squadId });
  if (!cardKey) return { ok: false, error: 'card_not_found', cardId, squadId };

  let plan;
  try {
    plan = await buildWritePlan(cardKey, outputs, { cardId, squadId, db, dryRun });
  } catch (err) {
    return { ok: false, error: err.code || 'write_plan_failed', message: err.message };
  }

  if (dryRun) {
    return { ok: true, dryRun: true, tool: toolName, plan };
  }

  const cardPath = `${cardsPath(squadId)}/${cardKey}`;
  // Snapshot ANTES da escrita — usado só pra enfileirar os gatilhos de
  // Automação certos (ver pendingAuto.js), comparando com o card DEPOIS
  // logo abaixo. dryRun já retornou acima, então isso só roda em escrita
  // de verdade. Clone de propósito (JSON.parse/stringify, não só `{...v}`
  // — as escritas abaixo mudam campos aninhados tipo `tags`/`checklist`,
  // um shallow spread ainda compartilharia essas referências): sem isso,
  // um fake db de teste que devolve a MESMA referência de objeto em
  // get() (em vez de uma cópia imutável, como o SDK real garante) faria
  // `before` "mudar sozinho" quando applyWritePlan() mutasse o card por
  // baixo — achado ao rodar o teste de mover_coluna, before.col e
  // after.col vinham iguais mesmo o card tendo movido de verdade.
  const before = JSON.parse(JSON.stringify((await db.ref(cardPath).get()).val() || {}));
  await applyWritePlan(db, plan, { cardPath, cardId, squadId });
  const after = (await db.ref(cardPath).get()).val() || {};
  await enqueuePendingAutoFromDiff(db, squadId, cardId, before, after);
  return { ok: true, dryRun: false, tool: toolName, plan, applied: plan.length };
}

function makeRealHandler(toolName, { db, squadId, cardId, dryRun = true }) {
  return async function realHandler(input) {
    // `toolName` (o nome da própria ferramenta chamada) já desambigua 100%
    // dos casos sozinho — nunca é decidido pelo LLM por tool call, é fixado
    // por qual ferramenta o protocolo de tool-use invocou — então
    // reconstituir `type` a partir dele aqui, sempre, é seguro mesmo quando
    // o modelo também manda o campo (sobrescreve com o mesmo valor, no-op).
    // Achado ao rodar o cenário de mover_coluna sem ambiguidade com LLM
    // real: o modelo devolveu {coluna: "done"}, sem "type" nenhum, e
    // buildWritePlan falhava com unknown_output_type em toda tentativa — o
    // protocolo de tool-use da Anthropic não reconstitui o nome da própria
    // ferramenta dentro do input, diferente do envelope de http.js (já
    // validado por schema.js antes de chegar aqui).
    const output = { ...input, type: toolName };
    return runWritePlan({ db, squadId, cardId, outputs: [output], dryRun, toolName });
  };
}

// perguntar_humano nunca foi um output type de agente-agil/schema.js (não
// existe pro especialista Databricks via http.js — só faz sentido no
// contexto do orquestrador decidindo pausar) — por isso não faz o mesmo
// truque de "reconstituir type" que makeRealHandler faz. Em vez disso,
// COMPÕE dois outputs que já existem: `comentario` (a pergunta, com um
// prefixo que a distingue de um comentário normal do agente) + `agent_status`
// com status:'awaiting_validation' (reaproveita o campo/badge que a UI já
// renderiza — https://github.com/.../outputs/agentStatus.js — em vez de
// inventar um campo novo no card só pra isso). `agent_status` sem
// executorType explícito promove executorType 'human'/vazio pra 'agent'
// (comportamento já existente do builder, não suprimido aqui de propósito —
// perguntar algo faz parte do mesmo ciclo de vida "agente processando o
// card" que os outros status já cobrem).
//
// dryRun tratado IGUAL às outras 7 ferramentas (não é sempre-real nem
// sempre-fake) — importante pra não sujar os cenários de julgamento
// (1-6), que dependem de perguntar_humano não escrever nada quando rodados
// em dryRun (o padrão de teste desde a Etapa 1).
//
// Achado no canário 6 (escrita real): o comentário aparecia certinho no
// card, mas ninguém era notificado — outputs/comentario.js só dispara
// notify.buildMentionSteps() quando o TEXTO tem uma @menção de verdade (ver
// notifications.js, Sprint 3), e o texto acima nunca tinha uma. Sem
// notificação, a pergunta fica soterrada no feed de comentários, ninguém
// sabe que precisa responder. Resolve o `owner` (responsável) do card ANTES
// de montar o comentário e injeta `@INIT` no texto — mesmo mecanismo que
// editar_campos/comentario já usam há uma sprint pra @menção manual, só que
// agora é o próprio handler que garante a menção em vez de depender do LLM
// lembrar de escrever "@alguém" na pergunta. Só o responsável é mencionado
// (não participantes) — é quem decide, mesmo público de notifAssigned/
// checklist (buildOwnerNotifStep), não o de notifDone/unblocked (owner +
// participants). Se o card não tem responsável, o comentário sai sem menção
// (mesmo comportamento de silêncio que o resto do sistema já tem pra card
// sem owner — não é regressão nova).
async function resolveOwnerInit(db, squadId, cardId) {
  const cardKey = await resolveCardKey(db, cardId, { squadId });
  if (!cardKey) return null;
  const snap = await db.ref(`${cardsPath(squadId)}/${cardKey}/owner`).get();
  return snap.val() || null;
}

function makeRealPerguntarHumanoHandler({ db, squadId, cardId, dryRun = true }) {
  return async function realPerguntarHumanoHandler(input) {
    const ownerInit = await resolveOwnerInit(db, squadId, cardId);
    const destinatario = ownerInit ? ` de @${ownerInit}` : '';
    const outputs = [
      { type: 'comentario', texto: `❓ Agente Ágil precisa de uma resposta${destinatario}:\n\n${input.pergunta}` },
      { type: 'agent_status', status: 'awaiting_validation' },
    ];
    return runWritePlan({ db, squadId, cardId, outputs, dryRun, toolName: 'perguntar_humano' });
  };
}

module.exports = { makeRealHandler, makeRealPerguntarHumanoHandler };
