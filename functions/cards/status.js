// functions/cards/status.js
//
// 🛡️ Pulso de saúde do Guardião (06/11/2026). O Guardião (guardiao.js) é disparado por EVENTO: se o gatilho quebrar, ninguém percebe — "sem notícia" é igual a "tudo bem". Esta função agendada
// (a cada 5 min) escreve em kanban/cards_guardiao/_status um carimbo de vida + dois sinais que dão para medir sem reler o quadro inteiro:
//   • atrasoMin — o card mais novo de cada squad (por cards_updated_at, entre os que estão no índice) já tem espelho com a mesma versão? Se o card mudou há mais de LIMITE_ATRASO_MS e o espelho
//     ainda não alcançou, o gatilho `cardsEspelhar` está parado ou lento. Só vale para card mexido nas últimas 24 h (squad parado não tem como provar nada; cards nunca editados desde o deploy
//     ainda não têm espelho até a varredura das 05:30 — por isso o corte de 24 h).
//   • abertos — incidentes do Guardião que precisam de gente (sem_espelho, em_massa, reincidente) dos últimos 7 dias e ainda não marcados como resolvidos (resolvidos/{chave}).
// Quem lê (Painel, oceanoResumo/mini painel) decide a cor: pulso com mais de 15 min = vermelho; atrasoMaxMin > 5 = vermelho.
//
// Deploy isolado: firebase deploy --only functions:guardiaoStatus   (sem regra nova de banco: cards_guardiao/_status herda a leitura da empresa e só o servidor escreve)

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getDatabase } = require('firebase-admin/database');

const LIMITE_ATRASO_MS = 5 * 60 * 1000;
const JANELA_ATRASO_MS = 24 * 3600 * 1000;
const JANELA_INCIDENTES_MS = 7 * 24 * 3600 * 1000;
const base = (sq) => `kanban/squads/${sq}/dados`;

// Lê só o que precisa de UM squad — barato de propósito (roda a cada 5 min = 288×/dia): os 3 cards mais recentes por `orderByValue().limitToLast(3)` em cards_updated_at (índice `.value` nas regras,
// senão o SDK baixaria o mapa inteiro e filtraria aqui) + 1 leitura de cards_index POR id candidato, em vez de baixar os dois mapas de ~900 cards de cada squad.
async function coletarSquad(db, sq) {
  const [topV, incV, resV] = await Promise.all([
    db.ref(`${base(sq)}/cards_updated_at`).orderByValue().limitToLast(3).get(),
    db.ref(`kanban/cards_guardiao/${sq}/incidentes`).get(), db.ref(`kanban/cards_guardiao/${sq}/resolvidos`).get(),
  ]);
  const top = Object.entries(topV.val() || {}).filter(([, ts]) => typeof ts === 'string').sort((a, b) => b[1].localeCompare(a[1]));
  let novoId = null, novoEm = '';
  for (const [id, ts] of top) {   // o mais novo que ainda está no índice (card excluído de propósito deixa resíduo em cards_updated_at e não pode virar falso atraso)
    if ((await db.ref(`${base(sq)}/cards_index/${id}`).get()).val() != null) { novoId = id; novoEm = ts; break; }
  }
  const espelhoEm = novoId ? ((await db.ref(`kanban/cards_espelho/${sq}/${novoId}/card/updatedAt`).get()).val() || null) : null;
  return { novoId, novoEm, espelhoEm, incidentes: incV.val() || {}, resolvidos: resV.val() || {} };
}

// Pura (testável sem Firebase).
function calcularSquad(c, agora) {
  let atrasoMs = 0;
  if (c.novoId && c.novoEm) {
    const idade = agora - Date.parse(c.novoEm);
    const emDia = !!c.espelhoEm && c.espelhoEm >= c.novoEm;
    if (!emDia && idade > LIMITE_ATRASO_MS && idade <= JANELA_ATRASO_MS) atrasoMs = idade;
  }
  const corte = new Date(agora - JANELA_INCIDENTES_MS).toISOString();
  const abertos = Object.entries(c.incidentes || {}).filter(([k, x]) => x && x.acao !== 'restaurado' && x.detectadoEm >= corte && !(c.resolvidos || {})[k]).length;
  return { atrasoMin: Math.round(atrasoMs / 60000), abertos };
}

function montarStatus(porSquad, agora) {
  const squads = {}; let atrasoMaxMin = 0, abertosTotal = 0;
  Object.entries(porSquad).forEach(([sq, c]) => { const r = calcularSquad(c, agora); squads[sq] = r; atrasoMaxMin = Math.max(atrasoMaxMin, r.atrasoMin); abertosTotal += r.abertos; });
  return { ts: new Date(agora).toISOString(), ok: atrasoMaxMin * 60000 <= LIMITE_ATRASO_MS, atrasoMaxMin, abertosTotal, squads };
}

async function atualizarStatus(db, squads, agora = Date.now()) {
  const porSquad = {};
  for (const sq of squads) {
    try { porSquad[sq] = await coletarSquad(db, sq); } catch (e) { console.error('[guardiaoStatus]', sq, e && e.message); }
  }
  const status = montarStatus(porSquad, agora);
  await db.ref('kanban/cards_guardiao/_status').set(status);
  return status;
}

const guardiaoStatus = onSchedule({ schedule: 'every 5 minutes', region: 'us-central1', memory: '256MiB', timeoutSeconds: 120 }, async () => {
  const db = getDatabase();
  const squads = await require('../backup/weeklyBackup')._listActiveSquads(db);
  const s = await atualizarStatus(db, squads);
  console.log('[guardiaoStatus]', JSON.stringify({ ok: s.ok, atrasoMaxMin: s.atrasoMaxMin, abertosTotal: s.abertosTotal }));
});

module.exports = { guardiaoStatus, atualizarStatus, calcularSquad, montarStatus, coletarSquad, LIMITE_ATRASO_MS };
