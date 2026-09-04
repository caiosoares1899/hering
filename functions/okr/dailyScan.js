// functions/okr/dailyScan.js
//
// Scan diário do módulo OKR (Objetivos/Marcos, painel.html/painel-dev.html)
// — mesmo motivo do agenteAgilDueOverdueScan/weeklyBackup: os gatilhos
// "ambientais" (prazo chegando, dia do período de atualização, véspera de
// reunião) nascem do TEMPO passando, não de alguém editar algo — sem um
// scan que roda sozinho, dependeria de alguém ter o painel aberto no dia
// exato (não é garantido).
//
// 3 gatilhos, decisão explícita do usuário (ver CHANGELOG.md):
//  1. Prazo de marco chegando — 3 dias antes e 1 dia antes (vencendo
//     amanhã). Cada janela dispara exatamente 1x por marco, pela mesma
//     razão que due_today/due_overdue (dueOverdueTrigger.js) não precisam
//     de estado de dedupe: checagem por igualdade EXATA de dias restantes,
//     rodando 1x/dia — um marco só bate "faltam 3 dias" num único dia.
//     Alvo: marco.responsavel; sem responsável no marco, cai pros
//     responsaveis[] do Objetivo.
//  2. "Seu período de editar" — no dia do evento do Google Agenda
//     escolhido pelo responsável em objetivo.gcalPeriodoEventId.
//  3. Véspera da reunião — 1 dia antes do evento em
//     objetivo.gcalReuniaoEventId.
//
// Fonte dos eventos de agenda: kanban/painel/config/gcal_cache — o MESMO
// cache que painel.html (prod) já mantém, sincronizado por quem tem o
// Google Agenda conectado (ver painel.html renderPcal()/_syncGcalEvents()).
// Zero chamada nova à API do Google aqui, só lê o que já está salvo — só o
// path de PRODUÇÃO (sem sufixo _dev): Cloud Functions não têm um "ambiente
// dev" próprio, e kanban/okr/objetivos|marcos já são compartilhados entre
// painel.html/painel-dev.html (Fase 1 não separou por _dev, decisão já
// tomada ali).
//
// Notificações escritas em kanban/usuarios/{uid}/notificacoes/{id} — MESMO
// path/formato que createNotif() (kanban-dev.html) já usa, então aparecem
// no sininho de qualquer board sem nenhuma mudança lá. Push: precisa dos
// tipos okr_editado/okr_prazo/okr_periodo/okr_reuniao em PUSH_TYPES
// (functions/index.js) — sendPushOnNotification já escuta esse path pra
// QUALQUER tipo, só decide mandar push ou não pela allow-list.

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getDatabase } = require('firebase-admin/database');

// Data no calendário de São Paulo, independente do timezone do processo do
// Cloud Function — mesmo formato (YYYY-MM-DD) que dueOverdueTrigger.js já usa.
function todaySP() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}
function diasAte(dataStr) {
  if (!dataStr) return null;
  const hoje = new Date(todaySP() + 'T00:00:00');
  const alvo = new Date(String(dataStr).slice(0, 10) + 'T00:00:00');
  const d = Math.round((alvo - hoje) / 86400000);
  return Number.isFinite(d) ? d : null;
}

async function writeNotif(db, uid, type, title, sub, okrObjId) {
  if (!uid) return;
  const id = 'n' + Date.now() + Math.random().toString(36).slice(2, 6);
  await db.ref(`kanban/usuarios/${uid}/notificacoes/${id}`).set({
    id,
    type,
    title,
    sub: sub || '',
    okrObjId: okrObjId || null,
    read: false,
    ts: new Date().toISOString(),
  });
}

async function runOkrDailyScan(db) {
  const [objSnap, marcoSnap, gcalSnap] = await Promise.all([
    db.ref('kanban/okr/objetivos').get(),
    db.ref('kanban/okr/marcos').get(),
    db.ref('kanban/painel/config/gcal_cache').get(),
  ]);
  const objetivos = objSnap.val() || {};
  const marcos = marcoSnap.val() || {};
  const gcalEvents = gcalSnap.val() || {};

  // 1) Prazo de marco chegando (3 dias antes / 1 dia antes)
  for (const marcoId of Object.keys(marcos)) {
    const m = marcos[marcoId];
    if (!m || m.arquivado || m.progresso === 'concluido' || !m.prazo) continue;
    const dias = diasAte(m.prazo);
    if (dias !== 3 && dias !== 1) continue;
    const obj = objetivos[m.objetivoId];
    const alvos = m.responsavel ? [m.responsavel] : (obj?.responsaveis || []);
    const quando = dias === 1 ? 'amanhã' : `em ${dias} dias`;
    for (const uid of alvos) {
      try {
        await writeNotif(
          db, uid, 'okr_prazo',
          `🎯 Marco "${m.nome}" vence ${quando}`,
          obj ? `Objetivo: ${obj.titulo}` : '',
          m.objetivoId
        );
      } catch (e) { console.error('[okrDailyScan] prazo falhou:', marcoId, e); }
    }
  }

  // 2) "Seu período de editar" (no dia do evento) + 3) véspera da reunião (1 dia antes)
  for (const objId of Object.keys(objetivos)) {
    const o = objetivos[objId];
    if (!o || o.arquivado) continue;
    const alvos = o.responsaveis || [];
    if (!alvos.length) continue;

    if (o.gcalPeriodoEventId) {
      const ev = gcalEvents[o.gcalPeriodoEventId];
      if (ev && diasAte(ev.start) === 0) {
        for (const uid of alvos) {
          try {
            await writeNotif(
              db, uid, 'okr_periodo',
              `🎯 Hoje é seu período de atualizar "${o.titulo}"`,
              'Aproveita pra revisar progresso, próximos passos e riscos.',
              objId
            );
          } catch (e) { console.error('[okrDailyScan] periodo falhou:', objId, e); }
        }
      }
    }
    if (o.gcalReuniaoEventId) {
      const ev = gcalEvents[o.gcalReuniaoEventId];
      if (ev && diasAte(ev.start) === 1) {
        for (const uid of alvos) {
          try {
            await writeNotif(
              db, uid, 'okr_reuniao',
              `🎯 Reunião de "${o.titulo}" é amanhã`,
              ev.title || '',
              objId
            );
          } catch (e) { console.error('[okrDailyScan] reuniao falhou:', objId, e); }
        }
      }
    }
  }
}

exports.okrDailyScan = onSchedule(
  { schedule: '0 7 * * *', timeZone: 'America/Sao_Paulo', region: 'us-central1', timeoutSeconds: 120 },
  async () => {
    const db = getDatabase();
    try {
      await runOkrDailyScan(db);
      console.log('[okrDailyScan] scan concluído.');
    } catch (e) {
      console.error('[okrDailyScan] falhou:', e);
    }
  }
);

// Exportados pra teste — mesmo padrão de dueOverdueTrigger.js (a lógica
// pura fica testável sem precisar mockar firebase-functions/v2/scheduler).
exports.diasAte = diasAte;
exports.todaySP = todaySP;
exports.runOkrDailyScan = runOkrDailyScan;
