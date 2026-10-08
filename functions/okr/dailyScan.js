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
//  2. Véspera da reunião de bloco quinzenal — (LEGADO: se cala quando o bloco foi importado pro calendário do OKR — eventos com
//     `origem:'bloco_quinzenal'` —, que passa a avisar pelo gatilho 3) — 1 dia antes (quarta) da
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
const { torreAtiva } = require('../common/mareModo');
const { getDatabase } = require('firebase-admin/database');
const cal = require('./calendario');

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

async function writeNotif(db, uid, type, title, sub, okrObjId, extra) {
  if (!uid) return;
  const id = 'n' + Date.now() + Math.random().toString(36).slice(2, 6);
  await db.ref(`kanban/usuarios/${uid}/notificacoes/${id}`).set({
    id,
    type,
    title,
    sub: sub || '',
    okrObjId: okrObjId || null,
    ...(extra || {}),
    read: false,
    ts: new Date().toISOString(),
  });
}

// `hojeOverride` (YYYY-MM-DD) existe só pra teste determinístico do
// gatilho de bloco quinzenal (ver dailyScan.test.js) — em produção o
// scheduler nunca passa esse argumento, então `hoje` vem sempre de
// todaySP() (data real).
async function runOkrDailyScan(db, hojeOverride) {
  const [objSnap, marcoSnap, evSnap] = await Promise.all([
    db.ref('kanban/okr/objetivos').get(),
    db.ref('kanban/okr/marcos').get(),
    db.ref('kanban/okr/calendario/eventos').get(),
  ]);
  // Modo "só Hering" (common/mareModo.js): Objetivo/evento de outra torre é invisível pro scan (nenhum aviso de prazo/reunião); os marcos deles
  // caem no `!obj` abaixo. Com o interruptor desligado o filtro não tira nada.
  const soAtivas = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, x]) => x && torreAtiva(x.torre)));
  const objetivos = soAtivas(objSnap.val());
  const marcos = marcoSnap.val() || {};
  const eventos = soAtivas(evSnap.val());

  // 1) Prazo de marco chegando (3 dias antes / 1 dia antes)
  for (const marcoId of Object.keys(marcos)) {
    const m = marcos[marcoId];
    if (!m || m.arquivado || m.progresso === 'concluido' || !m.prazo) continue;
    const obj = objetivos[m.objetivoId];
    // Achado de /monitorarbugs (2026-09-25, técnica 2 — comparar contra o
    // gatilho irmão logo abaixo, "véspera da reunião", que já checa
    // `o.arquivado`): arquivar um Objetivo NUNCA cascateia pros Marcos dele
    // (_okrArquivarObjetivo() só marca o Objetivo) — sem este check, um
    // Marco de um Objetivo já arquivado (fora da lista de ativos, ninguém
    // mais acompanhando) continuava disparando "vence amanhã" normalmente.
    if (!obj || obj.arquivado) continue;
    const dias = diasAte(m.prazo);
    if (dias !== 3 && dias !== 1) continue;
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

  // Migração (2026-10-07): quando o ADM importa o bloco quinzenal pro calendário do OKR, existem eventos com `origem:'bloco_quinzenal'` e a véspera passa a
  // vir do gatilho 3 (calendário). Este gatilho fixo então se cala — sem aviso duplicado e sem "dia da virada": enquanto não importar, nada muda.
  const blocoMigrado = Object.values(eventos).some((e) => e && e.origem === 'bloco_quinzenal');

  for (const objId of blocoMigrado ? [] : Object.keys(objetivos)) {
    const o = objetivos[objId];
    if (!o || o.arquivado) continue;
    // Torres (2026-10-07, /monitorarbugs): os blocos quinzenais (CX/Tech/CRM...) são da torre Digital — Objetivo de
    // Comercial/Corporativa (areaId 'geral', que cai no fallback do bloco 2) recebia "reunião amanhã" de uma reunião
    // que não é dele. Sem o campo `torre` = Digital (mesma regra do client, `_okrTorreDe()`).
    if (o.torre && o.torre !== 'digital') continue;
    const alvos = o.responsaveis || [];
    if (!alvos.length) continue;

    // Gerências agora são configuráveis por torre (2026-10-07): uma criada depois NÃO tem bloco quinzenal — só as originais (OKR_BLOCO_AREAS) têm reunião.
    // Sem areaId = 'geral' (mesma regra do client).
    const area = o.areaId || 'geral';
    if (!OKR_BLOCO_AREAS[1].includes(area) && !OKR_BLOCO_AREAS[2].includes(area)) continue;
    const bloco = blocoDaArea(area);
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

  // 3) 📅 Calendário do OKR (2026-10-07): reunião/evento/lembrete marcado pra AMANHÃ (véspera) e pra HOJE, conforme `lembrar` do evento
  //    (sem o campo = os dois). Quem recebe: responsáveis dos Objetivos ativos que o evento abrange (mesmo critério da pauta — ver calendario.js).
  //    Mesma notificação pessoal `okr_reuniao` (já está no PUSH_TYPES → também vira push). Sem estado de dedupe: roda 1x/dia e cada janela
  //    (amanhã/hoje) é por igualdade exata de data — uma ocorrência só cai numa delas por rodada.
  try {
    await avisaEventosDoCalendario(db, eventos, objetivos, hoje, amanhaStr);
  } catch (e) { console.error('[okrDailyScan] calendário falhou:', e); }
}

async function avisaEventosDoCalendario(db, eventos, objetivos, hoje, amanhaStr) {
  for (const evId of Object.keys(eventos)) {
    const ev0 = eventos[evId];
    if (!ev0 || !ev0.data) continue;
    const ev = { ...ev0, id: ev0.id || evId };
    const lem = cal.lembretesDe(ev);
    const janelas = [];
    if (lem.vespera && cal.ocorrencias(ev, amanhaStr, amanhaStr).length) janelas.push({ quando: 'Amanhã', data: amanhaStr });
    if (lem.dia && cal.ocorrencias(ev, hoje, hoje).length) janelas.push({ quando: 'Hoje', data: hoje });
    if (!janelas.length) continue;
    const alvos = cal.alvosDoEvento(ev, objetivos);
    const convidados = new Set(cal.convidadosDe(ev));
    convidados.forEach((u) => { if (!alvos[u]) alvos[u] = []; });   // convidado sem Objetivo na pauta também é avisado
    const uids = Object.keys(alvos);
    if (!uids.length) continue;
    for (const j of janelas) {
      for (const uid of uids) {
        try {
          const objs = alvos[uid].filter(Boolean);
          const pauta = objs.length ? 'Na pauta: ' + objs.slice(0, 2).join(' · ') + (objs.length > 2 ? ` +${objs.length - 2}` : '') : '';
          const sub = [cal.horaTxt(ev), cal.agendaNome(ev), ev.local || '', convidados.has(uid) ? 'Você está convidado(a)' : '', pauta].filter(Boolean).join(' · ');
          await writeNotif(db, uid, 'okr_reuniao', `🗓️ ${j.quando}: ${ev.titulo || 'Evento do OKR'}`, sub, null, { okrEventoId: ev.id, okrEventoData: j.data });
        } catch (e) { console.error('[okrDailyScan] calendário falhou:', evId, uid, e); }
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
exports.avisaEventosDoCalendario = avisaEventosDoCalendario;
exports.blocoDaArea = blocoDaArea;
exports.ehDiaDeReuniao = ehDiaDeReuniao;
exports.OKR_BLOCO_AREAS = OKR_BLOCO_AREAS;
exports.OKR_BLOCO_ANCHOR = OKR_BLOCO_ANCHOR;
