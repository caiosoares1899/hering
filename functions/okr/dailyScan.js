// functions/okr/dailyScan.js
//
// Scan diário do módulo OKR (Objetivos/Marcos, painel.html/painel-dev.html)
// — mesmo motivo do agenteAgilDueOverdueScan/weeklyBackup: os gatilhos
// "ambientais" (prazo chegando, véspera de reunião) nascem do TEMPO
// passando, não de alguém editar algo — sem um scan que roda sozinho,
// dependeria de alguém ter o painel aberto no dia exato (não é garantido).
//
// 2 gatilhos, decisão explícita do usuário (ver CHANGELOG.md):
//  1. Prazo de marco chegando — 3 dias antes e 1 dia antes (vencendo
//     amanhã). Cada janela dispara exatamente 1x por marco, pela mesma
//     razão que due_today/due_overdue (dueOverdueTrigger.js) não precisam
//     de estado de dedupe: checagem por igualdade EXATA de dias restantes,
//     rodando 1x/dia — um marco só bate "faltam 3 dias" num único dia.
//     Alvo: marco.responsavel; sem responsável no marco, cai pros
//     responsaveis[] do Objetivo.
//  2. Véspera da reunião de bloco quinzenal — 1 dia antes (quarta) da
//     quinta-feira de check-in OKR do bloco da gerência do Objetivo.
//     Substitui o antigo mecanismo de gcalReuniaoEventId/gcalPeriodoEventId
//     (evento específico do Google Agenda escolhido manualmente): cada
//     ocorrência semanal de uma reunião recorrente tem um ID de evento
//     DIFERENTE, então um campo único nunca conseguia representar "essa
//     reunião se repete a cada 2 semanas" — o picker nunca agrupou as
//     instâncias. A reunião real "[DIGITAL] Check in OKR's e Iniciativas"
//     alterna toda quinta entre 2 blocos fixos de gerência, e essa divisão
//     mapeia 1:1 em OKR_GERENCIAS (nenhuma sobra/ambiguidade) — então o
//     bloco é 100% derivável de objetivo.areaId, sem input manual nenhum.
//     Mesma fórmula (mantida em sincronia manualmente, ver comentário
//     espelho em painel-dev.html: OKR_BLOCO_AREAS/_okrBlocoDaArea/
//     _okrBlocoNaData) usada pra também mostrar o indicador de bloco no
//     painel — se a fórmula mudar aqui, mudar lá também.
//
// Notificações escritas em kanban/usuarios/{uid}/notificacoes/{id} — MESMO
// path/formato que createNotif() (kanban-dev.html) já usa, então aparecem
// no sininho de qualquer board sem nenhuma mudança lá. Push: precisa dos
// tipos okr_editado/okr_prazo/okr_reuniao em PUSH_TYPES
// (functions/index.js) — sendPushOnNotification já escuta esse path pra
// QUALQUER tipo, só decide mandar push ou não pela allow-list.

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getDatabase } = require('firebase-admin/database');

// ── Bloco quinzenal — mesma fórmula de painel-dev.html (OKR_BLOCO_AREAS/
// _okrBlocoDaArea/_okrBlocoNaData). 2026-09-03 é uma quinta confirmada
// como semana do bloco 1 pelo usuário.
const OKR_BLOCO_AREAS = {
  1: ['geral', 'comercial', 'performance', 'dadosia'],
  2: ['cx', 'tech', 'crm'],
};
const OKR_BLOCO_ANCHOR = '2026-09-03';

function blocoDaArea(areaId) {
  return OKR_BLOCO_AREAS[1].includes(areaId) ? 1 : 2;
}

// true se `dataStr` (YYYY-MM-DD) cai numa quinta de reunião do `bloco`
// dado. Checagem por múltiplo exato de 7 dias a partir do anchor (uma
// quinta) em vez de getDay()===4: qualquer múltiplo exato de 7 dias a
// partir de uma quinta é, por construção, também uma quinta.
function ehDiaDeReuniao(dataStr, bloco) {
  const anchor = new Date(OKR_BLOCO_ANCHOR + 'T00:00:00');
  const alvo = new Date(String(dataStr).slice(0, 10) + 'T00:00:00');
  const diasDesde = Math.round((alvo - anchor) / 86400000);
  if (diasDesde % 7 !== 0) return false;
  const periodo = diasDesde / 7;
  const paridade = ((periodo % 2) + 2) % 2;
  return (paridade === 0 ? 1 : 2) === bloco;
}

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

// `hojeOverride` (YYYY-MM-DD) existe só pra teste determinístico do
// gatilho de bloco quinzenal (ver dailyScan.test.js) — em produção o
// scheduler nunca passa esse argumento, então `hoje` vem sempre de
// todaySP() (data real).
async function runOkrDailyScan(db, hojeOverride) {
  const [objSnap, marcoSnap] = await Promise.all([
    db.ref('kanban/okr/objetivos').get(),
    db.ref('kanban/okr/marcos').get(),
  ]);
  const objetivos = objSnap.val() || {};
  const marcos = marcoSnap.val() || {};

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

  // 2) Véspera da reunião de bloco quinzenal — amanhã é quinta do bloco
  //    da gerência do Objetivo.
  const hoje = hojeOverride || todaySP();
  const amanha = new Date(hoje + 'T00:00:00');
  amanha.setDate(amanha.getDate() + 1);
  const amanhaStr = amanha.toLocaleDateString('en-CA');

  for (const objId of Object.keys(objetivos)) {
    const o = objetivos[objId];
    if (!o || o.arquivado) continue;
    const alvos = o.responsaveis || [];
    if (!alvos.length) continue;

    const bloco = blocoDaArea(o.areaId);
    if (!ehDiaDeReuniao(amanhaStr, bloco)) continue;

    for (const uid of alvos) {
      try {
        await writeNotif(
          db, uid, 'okr_reuniao',
          `🎯 Reunião de "${o.titulo}" é amanhã`,
          'Seu OKR está na pauta — aproveita pra atualizar antes da reunião.',
          objId
        );
      } catch (e) { console.error('[okrDailyScan] reuniao falhou:', objId, e); }
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
exports.blocoDaArea = blocoDaArea;
exports.ehDiaDeReuniao = ehDiaDeReuniao;
exports.OKR_BLOCO_AREAS = OKR_BLOCO_AREAS;
exports.OKR_BLOCO_ANCHOR = OKR_BLOCO_ANCHOR;
