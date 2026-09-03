// functions/agente-agil-orquestrador/tools/visaoBoard.js
//
// visao_board: segunda ferramenta de LEITURA do orquestrador (a primeira é
// ler_card, que só vê um card por vez). Dá ao agente uma visão agregada do
// board inteiro — WIP vs. limite, throughput, cycle/lead time, gargalo por
// coluna, bloqueios ativos — pro "braço de PO" (gestão do board, entrada/
// saída de informação pra especialistas externos) descrito no plano.
//
// Design combinado com o usuário antes de implementar: métricas FIXAS no v1
// (não interpretação livre do LLM em cima de dado bruto — mais previsível,
// mais barato, mais fácil de validar com canário, igual tudo até aqui).
// Interpretação livre fica como fase futura, só depois de confiança nas
// métricas fixas.
//
// cardTempos()/cardTempoPorColuna() são RÉPLICA deliberada de
// _cardTempos()/_cardTempoPorColuna() em kanban.html (linhas ~14904-14929)
// — mesmo padrão de duplicação já aceito em agente-agil/flow.js (que já
// replica _flowStartColIds()/_flowDoneColId()/_flowDoneColIds()). Decidido
// com o usuário: kanban.html não tem NENHUM <script src> externo hoje (é
// uma propriedade arquitetural do repo, não acidente — CLAUDE.md), e o
// client usa ES modules enquanto o Cloud Function usa CommonJS. Um módulo
// de verdade compartilhado exigiria quebrar essa propriedade OU um shim
// UMD — mais peça nova pra um cálculo pequeno e estável. Se algum dia
// _cardTempos()/_cardTempoPorColuna() mudarem no client, replicar aqui
// manualmente (a fórmula é poucas linhas, risco de desalinhar é baixo).
//
// colWipLimit() replica _colWipLimit() (kanban.html ~linha 10745): usa
// col.wip se definido, senão agilCfg.wip só pra coluna "progress" —
// compatibilidade com a config antiga (Config → Ágil).
//
// Fora do escopo do v1, de propósito: Sprint/Capacidade/Objetivo (são
// INPUT manual do PO, não métrica calculada — não pertencem a uma
// ferramenta de leitura) e os gráficos completos de CFD/Burndown (visual
// pra humano, não dado estruturado — throughput+WIP já cobrem o essencial
// pro agente explicar tendência). Gargalo por coluna é a única métrica sem
// equivalente direto já em produção — combina cardTempoPorColuna() (essa
// sim já usada em produção) com uma agregação nova (média por coluna,
// ranqueada).

const { z } = require('zod');
const { cardsPath } = require('../../agente-agil/board');
const flowLib = require('../../agente-agil/flow');

const DEFAULT_PERIODO_DIAS = 14;

const visaoBoardSchema = z.object({
  periodo_dias: z.number().int().positive().optional(),
});

// ── Réplica de _cardPausedMs() (kanban.html, ver togglePauseCard()) ──
// ⏸ Pausar (2026-09-03, pedido direto): tempo pausado não conta em cycle/
// lead time — soma o acumulado de pausas já encerradas (card.pausedMs) com
// a pausa em andamento, se houver (card.paused && card.pausedAt).
function cardPausedMs(card) {
  if (!card) return 0;
  let ms = card.pausedMs || 0;
  if (card.paused && card.pausedAt) ms += Math.max(0, Date.now() - new Date(card.pausedAt).getTime());
  return ms;
}

// ── Réplica de _cardTempos() (kanban.html ~14904) ──
function cardTempos(card) {
  const now = Date.now();
  let createdMs = null;
  if (card.createdAt) {
    const s = card.createdAt.length <= 10 ? card.createdAt + 'T12:00:00.000Z' : card.createdAt;
    createdMs = new Date(s).getTime();
  } else if (card.flow?.log?.length) {
    createdMs = new Date(card.flow.log[0].at).getTime();
  }
  const doneMs = card.flow?.doneAt ? new Date(card.flow.doneAt).getTime() : null;
  const endMs = doneMs || now;
  const pausedMs = cardPausedMs(card);
  const lead = createdMs != null ? Math.max(0, (endMs - createdMs - pausedMs) / 3600000) : null;
  const startMs = card.flow?.firstStartAt ? new Date(card.flow.firstStartAt).getTime() : null;
  const cycle = startMs != null ? Math.max(0, (endMs - startMs - pausedMs) / 3600000) : null;
  return { lead, cycle, done: !!doneMs };
}

// ── Réplica de _cardTempoPorColuna() (kanban.html ~14917) ──
function cardTempoPorColuna(card) {
  const out = {};
  const log = card.flow?.log;
  if (!log || !log.length) return out;
  const now = Date.now();
  for (let i = 0; i < log.length; i++) {
    const entrada = new Date(log[i].at).getTime();
    const saida = i + 1 < log.length ? new Date(log[i + 1].at).getTime() : card.flow?.doneAt ? new Date(card.flow.doneAt).getTime() : now;
    const col = log[i].to;
    const h = Math.max(0, (saida - entrada) / 3600000);
    out[col] = (out[col] || 0) + h;
  }
  return out;
}

// ── Réplica de _colWipLimit() (kanban.html ~10745) ──
function colWipLimit(col, agilCfg) {
  if (typeof col.wip === 'number' && col.wip > 0) return col.wip;
  if (col.id === 'progress' && agilCfg?.wip) return parseInt(agilCfg.wip) || null;
  return null;
}

function mean(nums) {
  if (!nums.length) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function median(nums) {
  if (!nums.length) return null;
  const sorted = nums.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round1(n) {
  return n == null ? null : Math.round(n * 10) / 10;
}

// Função pura (sem I/O) — testável direto com listas de cards/columns/agilCfg
// fabricadas à mão, sem fakeDb. periodoDias delimita throughput/cycle/lead/
// gargalo (métricas "do período"); WIP é sempre snapshot atual (não faz
// sentido "WIP do período", é o estado agora).
function summarizeBoard(cards, { columns, agilCfg, blockerMode, periodoDias }) {
  const ativos = (cards || []).filter((c) => c && !c.archived);
  const cutoffMs = Date.now() - periodoDias * 86400000;

  // ── WIP vs. limite, só colunas com limite configurado ──
  const wip = (columns || [])
    .map((col) => ({ col, limite: colWipLimit(col, agilCfg) }))
    .filter((x) => x.limite != null)
    .map(({ col, limite }) => ({
      coluna: col.name || col.id,
      atual: ativos.filter((c) => c.col === col.id).length,
      limite,
    }));

  // ── Cards concluídos no período (base de throughput/cycle/lead/gargalo) ──
  const concluidosPeriodo = ativos.filter((c) => {
    const doneAt = c.flow?.doneAt;
    if (!doneAt) return false;
    const doneMs = new Date(doneAt).getTime();
    return !Number.isNaN(doneMs) && doneMs >= cutoffMs;
  });

  const cycles = concluidosPeriodo.map((c) => cardTempos(c).cycle).filter((v) => v != null);
  const leads = concluidosPeriodo.map((c) => cardTempos(c).lead).filter((v) => v != null);

  // ── Gargalo por coluna: média de tempo-em-coluna sobre os concluídos no período ──
  const colNomePorId = new Map((columns || []).map((c) => [c.id, c.name || c.id]));
  const temposPorColuna = {}; // colId -> [horas, horas, ...]
  concluidosPeriodo.forEach((c) => {
    const tempos = cardTempoPorColuna(c);
    Object.entries(tempos).forEach(([colId, horas]) => {
      (temposPorColuna[colId] || (temposPorColuna[colId] = [])).push(horas);
    });
  });
  const gargaloPorColuna = Object.entries(temposPorColuna)
    .map(([colId, horas]) => ({ coluna: colNomePorId.get(colId) || colId, media_horas: round1(mean(horas)) }))
    .sort((a, b) => b.media_horas - a.media_horas);

  // ── Bloqueios ativos ──
  const isBlocked = (c) => (blockerMode === 'col' ? c.col === 'blocker' : !!c.blocker);
  const bloqueiosAtivos = ativos.filter(isBlocked).length;

  return {
    periodo_dias: periodoDias,
    wip,
    throughput: { concluidos_periodo: concluidosPeriodo.length },
    cycle_time: { media_horas: round1(mean(cycles)), mediana_horas: round1(median(cycles)), amostra: cycles.length },
    lead_time: { media_horas: round1(mean(leads)), mediana_horas: round1(median(leads)), amostra: leads.length },
    gargalo_por_coluna: gargaloPorColuna,
    bloqueios_ativos: bloqueiosAtivos,
  };
}

function makeFakeVisaoBoardHandler() {
  return async function fakeVisaoBoard() {
    return {
      ok: true,
      simulated: true,
      tool: 'visao_board',
      board: {
        periodo_dias: DEFAULT_PERIODO_DIAS,
        wip: [{ coluna: 'Em Progresso', atual: 2, limite: 3 }],
        throughput: { concluidos_periodo: 4 },
        cycle_time: { media_horas: 30, mediana_horas: 28, amostra: 4 },
        lead_time: { media_horas: 48, mediana_horas: 44, amostra: 4 },
        gargalo_por_coluna: [{ coluna: 'Revisão', media_horas: 20 }],
        bloqueios_ativos: 0,
      },
    };
  };
}

function makeRealVisaoBoardHandler({ db, squadId }) {
  return async function realVisaoBoard(input) {
    const periodoDias = input?.periodo_dias || DEFAULT_PERIODO_DIAS;
    const [cardsSnap, meta, agilCfgSnap, blockerModeSnap] = await Promise.all([
      db.ref(cardsPath(squadId)).get(),
      flowLib.readFlowMeta(db, squadId),
      db.ref(`kanban/squads/${squadId}/dados/agil_cfg`).get(),
      db.ref(`kanban/squads/${squadId}/dados/config/blockerMode`).get(),
    ]);
    const cards = Object.values(cardsSnap.val() || {});
    const agilCfg = agilCfgSnap.val() || {};
    const blockerMode = blockerModeSnap.val() || 'col';

    return {
      ok: true,
      tool: 'visao_board',
      board: summarizeBoard(cards, { columns: meta.columns, agilCfg, blockerMode, periodoDias }),
    };
  };
}

module.exports = {
  visaoBoardSchema,
  summarizeBoard,
  cardTempos,
  cardTempoPorColuna,
  cardPausedMs,
  colWipLimit,
  makeFakeVisaoBoardHandler,
  makeRealVisaoBoardHandler,
  DEFAULT_PERIODO_DIAS,
};
