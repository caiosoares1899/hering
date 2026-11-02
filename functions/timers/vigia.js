// functions/timers/vigia.js
//
// ⏲ Timer e Produtividade — vigia dos timers em andamento (o "relógio" do servidor: o navegador só avisa se a aba estiver aberta).
// Lê o índice pessoal `kanban/timers_ativos/{uid}/{tid}` (só o que está ATIVO: novo/rodando/pausado — pequeno por natureza) a cada minuto e escreve,
// na caixa de quem é dono do timer, dois avisos (ambos viram push — PUSH_TYPES em index.js; respeitam Não Perturbe e a Central de Notificações):
//   • `timer_zero`      — um TIMER (com duração) chegou a zero. 1× por timer.
//   • `timer_esquecido` — a atividade segue "rodando" sem pausa há 4 h (e de novo aos 8 h e 12 h; depois para): ainda está trabalhando nisso?
// "Criaram uma atividade pra mim" e "atividade encerrada" NÃO passam por aqui: nascem na hora, no navegador de quem age (kanban-dev.html → tmCriar/tmAcao).
// Idempotência: o que já foi avisado fica em `kanban/timers_ativos/{uid}/{tid}/avisos` ({zero:true, esq:n, segEsq:startedAt}) — o id da notificação é
// determinístico, e o marcador evita recriar (e reabrir como "não lida") um aviso que a limpeza por TTL do sino já apagou. `segEsq` amarra a contagem das
// 4 h ao trecho atual: pausar e retomar começa um trecho novo e zera a contagem.
// Limpeza (02/11/2026, /monitorarbugs): (a) entrada INCOMPLETA no índice (só `avisos`, sem sq/cardId/status) é o rastro de uma corrida — o dono encerrou entre a nossa leitura e a nossa
// escrita e o `update` recriou o nó pela metade: é removida (no navegador viraria uma linha "undefined"); por isso o marcador `avisos` é gravado em TRANSAÇÃO, que não recria o que sumiu.
// (b) card EXCLUÍDO com timer rodando: o aviso 🔔 e a linha do atalho ficariam pra sempre (e o "esquecido" insistiria 3×). Só vale como "excluído" quando as DUAS marcas existem —
// `cards_deleted_intentionally/{id}` (escrita por toda exclusão de verdade) E ausência em `cards_index/{id}` (o desfazer restaura o card e o índice) —, então "card sumiu sozinho" ou
// desfazer nunca apagam timer. O timer do card excluído é ENCERRADO (o tempo fica no registro) e sai do índice.
// O tempo decorrido é o mesmo do navegador: accMs + (agora − startedAt) enquanto 'rodando'.
//
// Deploy isolado: firebase deploy --only functions:timersVigia   (e, junto, functions:sendPushOnNotification — ela precisa conhecer os tipos novos no PUSH_TYPES)

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getDatabase } = require('firebase-admin/database');

const ESQUECIDO_MS = 4 * 3600000;   // intervalo entre os lembretes de "ainda está contando?"
const ESQUECIDO_MAX = 3;            // 4 h, 8 h, 12 h — depois disso o servidor desiste (a pessoa já foi avisada 3×)

const decorrido = (t, agora) => Math.max(0, (Number(t.accMs) || 0) + (t.status === 'rodando' && t.startedAt ? agora - Number(t.startedAt) : 0));
function fmt(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), p = n => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s % 60)}` : `${p(m)}:${p(s % 60)}`;
}
const cortar = (s, n) => String(s || '').slice(0, n);

// O que este timer pede agora: lista de avisos ({chave, notif}) — pura, testável sem banco.
function avisosDoTimer(uid, tid, t, agora) {
  if (!t || t.status !== 'rodando' || !t.startedAt) return [];
  const av = t.avisos || {}, out = [], dec = decorrido(t, agora), base = { cardId: t.cardId, squad: t.sq, read: false, ts: new Date(agora).toISOString(), noTTLDelete: true };
  if (t.tipo === 'timer' && Number(t.durMs) > 0 && dec >= Number(t.durMs) && !av.zero) {
    const id = `n_tz_${tid}`;
    out.push({ campos: { zero: true }, id, notif: Object.assign({ id, type: 'timer_zero', title: `O tempo de "${cortar(t.atividade, 80)}" acabou`, sub: `Timer de ${fmt(Number(t.durMs))} · ${cortar(t.cardTitle, 80) || 'card'}` }, base) });
  }
  const trecho = agora - Number(t.startedAt), n = Math.min(ESQUECIDO_MAX, Math.floor(trecho / ESQUECIDO_MS));
  const jaAvisados = av.segEsq === t.startedAt ? (Number(av.esq) || 0) : 0;
  if (n >= 1 && n > jaAvisados) {
    const id = `n_te_${tid}_${n}`;
    out.push({ campos: { esq: n, segEsq: t.startedAt }, id, notif: Object.assign({ id, type: 'timer_esquecido', title: `"${cortar(t.atividade, 80)}" segue em andamento`, sub: `Há ${n * 4} h sem pausar — ainda está trabalhando nisso? · ${cortar(t.cardTitle, 80) || 'card'}` }, base) });
  }
  return out;
}

const cartaoExcluido = async (db, sq, cardId) => {
  const base = `kanban/squads/${sq}/dados`;
  if ((await db.ref(`${base}/cards_deleted_intentionally/${cardId}`).get()).val() !== true) return false;
  return (await db.ref(`${base}/cards_index/${cardId}`).get()).val() == null;
};

// Varre o índice e grava o que for devido. `agoraMs` existe pra teste determinístico (em produção vem do relógio).
async function runTimersVigia(db, agoraMs) {
  agoraMs = agoraMs == null ? Date.now() : agoraMs;
  const raiz = (await db.ref('kanban/timers_ativos').get()).val() || {};
  let enviados = 0, lidos = 0, limpos = 0; const excluidos = new Map();
  for (const [uid, porTid] of Object.entries(raiz)) {
    for (const [tid, t] of Object.entries(porTid || {})) {
      lidos++;
      const refIdx = db.ref(`kanban/timers_ativos/${uid}/${tid}`);
      if (!t || typeof t !== 'object' || !t.sq || !t.cardId || !t.status) { await refIdx.remove(); limpos++; continue; }   // rastro de corrida: nó pela metade
      const chave = `${t.sq}/${t.cardId}`;
      if (!excluidos.has(chave)) excluidos.set(chave, await cartaoExcluido(db, t.sq, t.cardId).catch(() => false));
      if (excluidos.get(chave)) {                                                                                       // card excluído: encerra o timer e tira do índice
        const refRec = db.ref(`kanban/squads/${t.sq}/dados/card_timers/${t.cardId}/${tid}`);
        if ((await refRec.get()).exists()) await refRec.update({ status: 'encerrado', startedAt: null, accMs: decorrido(t, agoraMs), encerradoEm: new Date(agoraMs).toISOString(), encerradoPor: 'vigia', motivo: 'card_excluido' });
        await refIdx.remove(); limpos++; continue;
      }
      for (const a of avisosDoTimer(uid, tid, t, agoraMs)) {
        const refN = db.ref(`kanban/usuarios/${uid}/notificacoes/${a.id}`);
        // marca ANTES de notificar (nunca avisa em dobro; se a escrita da notificação falhar, o aviso se perde — preferível a spam a cada minuto)
        const tx = await refIdx.transaction((cur) => (cur ? Object.assign({}, cur, { avisos: Object.assign({}, cur.avisos || {}, a.campos) }) : cur));
        if (!tx || !tx.snapshot || !tx.snapshot.val()) continue;   // o timer foi encerrado/excluído enquanto a gente decidia: não avisa
        try { await refN.set(a.notif); enviados++; }
        catch (e) { console.error('[timersVigia] notificação falhou:', uid, tid, e); }
      }
    }
  }
  return { lidos, enviados, limpos };
}

exports.timersVigia = onSchedule(
  { schedule: '* * * * *', timeZone: 'America/Sao_Paulo', region: 'us-central1', timeoutSeconds: 60 },
  async () => {
    try { const r = await runTimersVigia(getDatabase()); if (r.enviados) console.log('[timersVigia]', JSON.stringify(r)); }
    catch (e) { console.error('[timersVigia] falhou:', e); }
  }
);

// Exportados pra teste (a lógica pura fica testável sem mockar firebase-functions/v2/scheduler).
exports.runTimersVigia = runTimersVigia;
exports.avisosDoTimer = avisosDoTimer;
exports.decorrido = decorrido;
