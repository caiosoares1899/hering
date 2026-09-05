// functions/okr/weeklySnapshot.js
//
// Fase 3 do OKR: snapshot semanal, toda sexta-feira — decisão explícita do
// usuário (ver CHANGELOG.md): NÃO é um sistema de notificação novo (isso já
// existe, ver okr/dailyScan.js), é só uma FOTO do estado de cada Objetivo
// ativo naquele momento, salva em kanban/okr/snapshots/{data}. Sem viewer/
// gráfico ainda — essa função só acumula o dado; comparar "essa semana vs.
// semana passada" fica pra quando alguém pedir a UI de tendência.
//
// Status agregado e % de progresso do Objetivo são recalculados aqui com a
// MESMA lógica de _okrObjStatus()/_okrObjProgressoPct() (painel.html/
// okr-apresentacao.slide.html) — pior status entre os marcos ATIVOS
// (não-concluídos), ou "concluído" se todos os marcos já terminaram, ou
// "não iniciado" se o Objetivo ainda não tem marco algum.

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getDatabase } = require('firebase-admin/database');

// Mesmo formato (YYYY-MM-DD) que dueOverdueTrigger.js/dailyScan.js já usam.
function todaySP() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

const OKR_SEVERIDADE = ['atrasado', 'risco', 'no_prazo', 'nao_iniciado'];

function objMarcosAtivos(marcos, objId) {
  return Object.values(marcos).filter((m) => m && m.objetivoId === objId && !m.arquivado);
}
function objStatus(marcos, objId) {
  const ms = objMarcosAtivos(marcos, objId);
  if (!ms.length) return 'nao_iniciado';
  const ativos = ms.filter((m) => m.progresso !== 'concluido');
  if (!ativos.length) return 'concluido';
  for (const sev of OKR_SEVERIDADE) {
    if (ativos.some((m) => (m.progresso || 'nao_iniciado') === sev)) return sev;
  }
  return 'nao_iniciado';
}
function objProgressoPct(marcos, objId) {
  const ms = objMarcosAtivos(marcos, objId);
  if (!ms.length) return 0;
  return Math.round((ms.filter((m) => m.progresso === 'concluido').length / ms.length) * 100);
}

async function runOkrWeeklySnapshot(db) {
  const [objSnap, marcoSnap] = await Promise.all([
    db.ref('kanban/okr/objetivos').get(),
    db.ref('kanban/okr/marcos').get(),
  ]);
  const objetivos = objSnap.val() || {};
  const marcos = marcoSnap.val() || {};

  const resumoGeral = { total: 0, nao_iniciado: 0, no_prazo: 0, risco: 0, atrasado: 0, concluido: 0 };
  const snapshotObjetivos = {};

  for (const objId of Object.keys(objetivos)) {
    const o = objetivos[objId];
    if (!o || o.arquivado) continue;
    const status = objStatus(marcos, objId);
    const marcosAtivos = objMarcosAtivos(marcos, objId);
    snapshotObjetivos[objId] = {
      titulo: o.titulo || '',
      areaId: o.areaId || 'geral',
      status,
      progressoPct: objProgressoPct(marcos, objId),
      totalMarcos: marcosAtivos.length,
      marcosConcluidos: marcosAtivos.filter((m) => m.progresso === 'concluido').length,
    };
    resumoGeral.total += 1;
    resumoGeral[status] = (resumoGeral[status] || 0) + 1;
  }

  const dateKey = todaySP();
  const snapshot = {
    date: dateKey,
    generatedAt: new Date().toISOString(),
    resumoGeral,
    objetivos: snapshotObjetivos,
  };
  await db.ref('kanban/okr/snapshots/' + dateKey).set(snapshot);
  return snapshot;
}

exports.okrWeeklySnapshot = onSchedule(
  { schedule: '0 17 * * 5', timeZone: 'America/Sao_Paulo', region: 'us-central1', timeoutSeconds: 120 },
  async () => {
    const db = getDatabase();
    try {
      const snap = await runOkrWeeklySnapshot(db);
      console.log('[okrWeeklySnapshot] snapshot salvo:', snap.date, snap.resumoGeral);
    } catch (e) {
      console.error('[okrWeeklySnapshot] falhou:', e);
    }
  }
);

// Exportados pra teste — mesmo padrão de dailyScan.js.
exports.todaySP = todaySP;
exports.objStatus = objStatus;
exports.objProgressoPct = objProgressoPct;
exports.runOkrWeeklySnapshot = runOkrWeeklySnapshot;
