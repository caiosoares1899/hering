// functions/metas/lembretes.js
//
// 🐟 Lembretes de preenchimento das METAS e DESAFIOS ("O mar tá pra peixe") — o valor é informado À MÃO (enquanto não vem de um sistema), então a
// pessoa precisa ser lembrada. Cada meta configura o próprio lembrete (formulário em mare-metas-dev.js, grava `lembrete` na meta):
//   { modo:'off' }
//   { modo:'cada', cada:1..4, de:'08:00', ate:'20:00' }   a cada N horas dentro de uma janela (1º horário = `de`)
//   { modo:'diario', hora:'09:00' }                         1 vez por dia
//   { modo:'horarios', horas:['09:00','15:30', ...] }       horários exatos (até 4)
// Tudo no HORÁRIO DE BRASÍLIA (America/Sao_Paulo), mesmo com o servidor em UTC.
//
// Como roda: agendada a cada 15 min (okrDailyScan é o modelo). Em cada tick, uma meta está "no horário" quando algum horário dela cai nos últimos 15
// minutos — então cada horário dispara em exatamente 1 tick. `lembreteUltimo` (AAAA-MM-DDTHH:MM) guarda o último horário avisado: um retry/duplo disparo
// do scheduler não manda aviso em dobro.
// Quando NÃO avisa: meta inativa; fora do período (antes do início/depois do fim); já batida (≥ 100 %); alguém já atualizou há pouco (a pessoa fez o que o
// lembrete pediria); interruptor geral `kanban/config/metas_lembretes_off === true`.
// Quem recebe: `responsaveis` da meta; sem ninguém marcado → squad: PO e Organizadores da squad · Digital: ADMs. A notificação cai no sino (tipo
// `meta_lembrete`, que também é push — respeita Não Perturbe e o interruptor da Central de Notificações) e ao clicar abre a aba 📊 Dados.
// Escaneia os nós de PRODUÇÃO e os `_dev` (dados de teste do dev — o aviso só chega a quem é gestor/ADM, e `_dev` só existe quando alguém testa).
//
// Deploy isolado: firebase deploy --only functions:metasLembretes

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getDatabase } = require('firebase-admin/database');

const SP = 'America/Sao_Paulo';
const TICK_MIN = 15;                       // largura da janela de um horário (= intervalo do scheduler)
const NOS = [
  { digital: 'kanban/metas_digital', squads: 'kanban/metas_squads', sfx: '' },
  { digital: 'kanban/metas_digital_dev', squads: 'kanban/metas_squads_dev', sfx: '_dev' },
];
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// ── tempo (Brasília) ──
function agoraSP(ms) {
  const d = new Date(ms == null ? Date.now() : ms);
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: SP, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(d).reduce((a, x) => { a[x.type] = x.value; return a; }, {});
  const hh = Number(p.hour) % 24;           // alguns runtimes devolvem "24" à meia-noite
  return { data: `${p.year}-${p.month}-${p.day}`, min: hh * 60 + Number(p.minute) };
}
const toMin = s => { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; };
const toHHMM = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
function diaN(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 : null; }

// Horários do dia (HH:MM) em que esta meta pede lembrete.
function horariosDoLembrete(l) {
  if (!l || !l.modo || l.modo === 'off') return [];
  if (l.modo === 'diario') return HORA_RE.test(l.hora || '') ? [l.hora] : ['09:00'];
  if (l.modo === 'horarios') return (Array.isArray(l.horas) ? l.horas : Object.values(l.horas || {})).filter(h => HORA_RE.test(h)).slice(0, 4).sort();
  if (l.modo === 'cada') {
    const de = HORA_RE.test(l.de || '') ? toMin(l.de) : 480, ate = HORA_RE.test(l.ate || '') ? toMin(l.ate) : 1200, passo = ([1, 2, 3, 4].includes(Number(l.cada)) ? Number(l.cada) : 1) * 60, out = [];
    if (ate <= de) return [];
    for (let m = de; m <= ate; m += passo) out.push(toHHMM(m));
    return out;
  }
  return [];
}
// O horário (HH:MM) que está "valendo" neste instante, ou null. Janela = [horário, horário + 15 min).
function horarioDevido(l, minAgora) {
  for (const h of horariosDoLembrete(l)) { const m = toMin(h); if (minAgora >= m && minAgora < m + TICK_MIN) return h; }
  return null;
}

// ── a meta (espelho da matemática de mare-metas-dev.js — o teste de paridade garante que continuam iguais) ──
const isNum = v => v !== null && v !== undefined && v !== '' && isFinite(Number(v));
function pct(m) {
  if (!m || !isNum(m.atual) || !isNum(m.alvo)) return null;
  const i = isNum(m.inicial) ? Number(m.inicial) : 0, t = Number(m.alvo);
  return t === i ? null : (Number(m.atual) - i) / (t - i) * 100;
}
const ptNum = (v, d) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: d == null ? 0 : d });
function fmtVal(m, v) {
  if (!isNum(v)) return '—';
  v = Number(v);
  if (m.fmt === 'pct') return ptNum(v, Math.abs(v) < 10 && v % 1 ? 1 : 0) + '%';
  const a = Math.abs(v);
  const t = a >= 1e6 ? ptNum(v / 1e6, 2) + ' mi' : a >= 1e5 ? ptNum(v / 1e3, 0) + ' mil' : ptNum(v, a < 100 && v % 1 ? 1 : 0);
  return m.fmt === 'brl' ? 'R$ ' + t : t + (m.sufixo ? ' ' + m.sufixo : '');
}
function ago(ms, agora) {
  if (!ms) return 'ainda sem valor informado';
  const s = Math.max(0, (agora - ms) / 1000);
  return 'última atualização ' + (s < 90 ? 'agora há pouco' : s < 3600 ? 'há ' + Math.round(s / 60) + ' min' : s < 86400 ? 'há ' + Math.round(s / 3600) + ' h' : 'há ' + Math.round(s / 86400) + ' d');
}
// Intervalo de "atualizado há pouco": se a pessoa já atualizou desde o horário anterior, não precisa do lembrete.
function folgaMs(l) { return l && l.modo === 'cada' ? Math.max(10, (Number(l.cada) || 1) * 60 - 10) * 60e3 : 30 * 60e3; }

// Deve lembrar AGORA? → { devido:true, slot:'HH:MM', slotKey } ou { devido:false, motivo }
function avalia(meta, agora /* {data,min} */, agoraMs) {
  if (!meta || !meta.titulo) return { devido: false, motivo: 'sem_titulo' };
  if (meta.ativo === false) return { devido: false, motivo: 'inativa' };
  const l = meta.lembrete; if (!l || !l.modo || l.modo === 'off') return { devido: false, motivo: 'sem_lembrete' };
  const h = diaN(agora.data), a = diaN(meta.inicio), b = diaN(meta.fim);
  if ((a != null && h < a) || (b != null && h > b)) return { devido: false, motivo: 'fora_do_periodo' };
  const p = pct(meta); if (p !== null && p >= 100) return { devido: false, motivo: 'batida' };
  const slot = horarioDevido(l, agora.min); if (!slot) return { devido: false, motivo: 'fora_do_horario' };
  const slotKey = `${agora.data}T${slot}`;
  if (meta.lembreteUltimo === slotKey) return { devido: false, motivo: 'ja_avisado' };
  if (meta.atualizadoEm && (agoraMs - meta.atualizadoEm) < folgaMs(l)) return { devido: false, motivo: 'atualizada_agora' };
  return { devido: true, slot, slotKey };
}

const papelNaSquad = (u, sq) => (u && u.squads_roles && u.squads_roles[sq]) || (u && u.role) || 'membro';
// Quem recebe: os marcados; senão PO/Organizadores da squad (ou ADMs, no Digital).
function destinatarios(meta, escopo, squadId, pubs) {
  const resp = (Array.isArray(meta.responsaveis) ? meta.responsaveis : Object.values(meta.responsaveis || {})).filter(x => typeof x === 'string' && x);
  if (resp.length) return [...new Set(resp)];
  const uids = Object.keys(pubs || {});
  if (escopo === 'squad') return uids.filter(uid => { const u = pubs[uid]; return u && u.squads && u.squads[squadId] === true && ['po', 'organizador'].includes(papelNaSquad(u, squadId)); });
  return uids.filter(uid => pubs[uid] && pubs[uid].role === 'adm');
}

async function writeNotif(db, uid, meta, escopo, squadId, agoraMs) {
  const id = 'n' + agoraMs + Math.random().toString(36).slice(2, 6);
  const p = pct(meta);
  const quem = (meta.emoji || '🎯') + (escopo === 'digital' ? ' Digital' : '');
  const valor = isNum(meta.atual) ? `hoje ${fmtVal(meta, meta.atual)} de ${fmtVal(meta, meta.alvo)} (${p < 100 ? Math.min(99, Math.round(p)) : Math.round(p)}%)` : `meta ${fmtVal(meta, meta.alvo)}`;
  const sub = [quem, ago(meta.atualizadoEm, agoraMs), valor].join(' · ');
  await db.ref(`kanban/usuarios/${uid}/notificacoes/${id}`).set({
    id, type: 'meta_lembrete', title: `🐟 Atualize a meta: ${meta.titulo}`, sub,
    squad: escopo === 'squad' ? squadId : null, okrObjId: escopo,   // okrObjId carrega o escopo ('digital' | 'squad'): o sino abre a aba certa de 📊 Dados
    metaId: meta.id, read: false, ts: new Date(agoraMs).toISOString(),
  });
}

// Varre os nós e manda os lembretes devidos. `agoraMs` existe pra teste determinístico (em produção vem do relógio).
async function runMetasLembretes(db, agoraMs) {
  agoraMs = agoraMs == null ? Date.now() : agoraMs;
  const off = (await db.ref('kanban/config/metas_lembretes_off').get()).val();
  if (off === true) return { enviados: 0, metas: 0, desligado: true };
  const agora = agoraSP(agoraMs);
  const pubs = (await db.ref('kanban/usuarios_publicos').get()).val() || {};
  let enviados = 0, avaliadas = 0;
  for (const no of NOS) {
    const [dg, sqs] = await Promise.all([db.ref(no.digital).get(), db.ref(no.squads).get()]);
    const itens = [];
    Object.entries(dg.val() || {}).forEach(([id, m]) => itens.push({ meta: Object.assign({ id }, m), escopo: 'digital', squadId: null, caminho: `${no.digital}/${id}` }));
    Object.entries(sqs.val() || {}).forEach(([sq, metas]) => Object.entries(metas || {}).forEach(([id, m]) => itens.push({ meta: Object.assign({ id }, m), escopo: 'squad', squadId: sq, caminho: `${no.squads}/${sq}/${id}` })));
    for (const it of itens) {
      avaliadas++;
      const r = avalia(it.meta, agora, agoraMs); if (!r.devido) continue;
      const uids = destinatarios(it.meta, it.escopo, it.squadId, pubs);
      // Marca o horário ANTES de enviar: se o envio falhar no meio, o próximo tick não repete pra quem já recebeu (preferimos perder 1 lembrete a mandar em dobro).
      await db.ref(it.caminho).update({ lembreteUltimo: r.slotKey });
      for (const uid of uids) {
        try { await writeNotif(db, uid, it.meta, it.escopo, it.squadId, agoraMs); enviados++; }
        catch (e) { console.error('[metasLembretes] falhou pra', uid, it.meta.id, e); }
      }
    }
  }
  return { enviados, metas: avaliadas };
}

exports.metasLembretes = onSchedule(
  { schedule: '*/15 * * * *', timeZone: SP, region: 'us-central1', timeoutSeconds: 120 },
  async () => {
    try { const r = await runMetasLembretes(getDatabase()); if (r.enviados) console.log('[metasLembretes]', JSON.stringify(r)); }
    catch (e) { console.error('[metasLembretes] falhou:', e); }
  }
);

// Exportados pra teste (a lógica pura fica testável sem mockar firebase-functions/v2/scheduler).
exports.runMetasLembretes = runMetasLembretes;
exports.avalia = avalia;
exports.horariosDoLembrete = horariosDoLembrete;
exports.horarioDevido = horarioDevido;
exports.destinatarios = destinatarios;
exports.agoraSP = agoraSP;
exports.pct = pct;
exports.fmtVal = fmtVal;
exports.folgaMs = folgaMs;
