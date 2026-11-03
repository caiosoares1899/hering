// functions/okr/cobranca.js
//
// 📦 Cobrança automática das ENTREGAS do calendário de gestão do Digital (2026-11-03). Roda dentro do okrDailyScan (todo dia às 7h, horário de Brasília) — sem IA:
// é por data, previsível, e não inventa prazo nem pessoa. Quem é cobrado = os `convidados` da entrega (na tela, "Responsáveis").
//
// Régua (por entrega ABERTA, isto é, status diferente de "entregue"; entrega com filhas não é cobrada — as filhas são). Conta em DIAS ÚTEIS (sábado e domingo não contam:
// o scan não roda neles, e contar em dias corridos fazia o prazo de sexta pular o "atrasou 1 dia" e escalar na segunda, e o prazo de terça nunca receber o preventivo):
//   • preventivo  — faltam 2 ou 3 dias úteis                                                                        → os responsáveis
//   • véspera     — falta 1 dia útil (prazo de segunda avisa na sexta)  — respeita `lembrar.vespera` do evento     → os responsáveis
//   • dia         — vence hoje (prazo em fim de semana avisa na sexta)  — respeita `lembrar.dia` do evento         → os responsáveis
//   • atraso-1    — passou 1 ou 2 dias úteis do prazo                                                              → os responsáveis
//   • atraso-3    — passou 3 dias úteis ou mais (1x)                                                               → os responsáveis + ESCALONAMENTO
//   • semanal     — toda segunda, enquanto seguir atrasada (depois do atraso-3)                                    → os responsáveis
// (Véspera e dia das ENTREGAS saem DAQUI, não do gatilho 3 do dailyScan: lá não tinha o fim de semana, o agrupamento por pessoa nem o tipo okr_cobranca.)
// Escalonamento (atraso-3) = quem está em kanban/okr/cobranca_config/gestores (a tela do Radar grava) — sem a lista, os ADMs — + quem criou a entrega.
// Resumo da segunda: 1 aviso pros gestores (atrasadas · vencem na semana · sem responsável).
// Anti-spam: 1 notificação por pessoa por dia (várias entregas viram um resumo), nada em sábado/domingo, e cada aviso fica carimbado em
// kanban/okr/cobrancas_log/{eventoId}/{estágio} (com a data do prazo: mudou o prazo, a régua recomeça) — o mesmo aviso nunca sai 2x.
// Tipo da notificação: okr_cobranca (push; o ADM liga/desliga na Central de Notificações do Painel).

const cal = require('./calendario');

const LOG = 'kanban/okr/cobrancas_log';
const CFG = 'kanban/okr/cobranca_config';
const TIPO = 'okr_cobranca';

function diaDaSemana(ds) { return new Date(String(ds).slice(0, 10) + 'T12:00:00Z').getUTCDay(); }   // 0 = domingo … 6 = sábado
// semana ISO (YYYY-Www) da data — chave do carimbo semanal
function semanaIso(ds) {
  const d = new Date(String(ds).slice(0, 10) + 'T12:00:00Z');
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const ano = d.getUTCFullYear(), ini = new Date(Date.UTC(ano, 0, 1));
  return ano + '-W' + String(Math.ceil(((d - ini) / 86400000 + 1) / 7)).padStart(2, '0');
}

// Dias ÚTEIS entre `hoje` e `alvo` (YYYY-MM-DD): quantos dias de semana há depois de `hoje` até `alvo` (positivo), ou, se `alvo` já passou, quantos dias de semana
// há depois do prazo até hoje (negativo). Mesmo dia = 0. Prazo em sábado/domingo conta como se fosse a sexta antes (0 a partir da sexta).
function diasUteisAte(hoje, alvo) {
  const h = String(hoje).slice(0, 10), a = String(alvo).slice(0, 10);
  if (h === a) return 0;
  const [de, ate, sinal] = a > h ? [h, a, 1] : [a, h, -1];
  let n = 0;
  const d = new Date(de + 'T12:00:00Z'), fim = new Date(ate + 'T12:00:00Z');
  for (d.setUTCDate(d.getUTCDate() + 1); d <= fim; d.setUTCDate(d.getUTCDate() + 1)) { const w = d.getUTCDay(); if (w !== 0 && w !== 6) n++; }
  return sinal * n;
}

// Quais estágios a entrega pede HOJE (antes de olhar os carimbos). `du` = dias úteis até o prazo (negativo = atrasada), `dias` = dias corridos, `lem` = lembretesDe(ev).
function estagiosDe(du, dias, hoje, lem) {
  const l = lem || { vespera: true, dia: true };
  const out = [];
  if (du === 2 || du === 3) out.push('preventivo');
  if (l.vespera && du === 1 && dias >= 1) out.push('vespera');
  if (l.dia && (dias === 0 || (du === 0 && dias > 0))) out.push('dia');
  if (du <= -1 && du >= -2) out.push('atraso-1');
  if (du <= -3) out.push('atraso-3');
  if (du <= -3 && diaDaSemana(hoje) === 1) out.push('semanal-' + semanaIso(hoje));
  return out;
}

const lista = cal.lista;
const rotuloDias = (d) => (d < 0 ? `${-d} dia${d === -1 ? '' : 's'} de atraso` : d === 0 ? 'vence hoje' : d === 1 ? 'vence amanhã' : `prazo em ${d} dias`);
const quandoTxt = (d) => (d === 0 ? 'hoje' : d === 1 ? 'amanhã' : `em ${d} dias`);

// Quem recebe o escalonamento e o resumo: a lista configurada (uids); sem lista, os ADMs (e-mails de kanban/config/adm_emails casados com usuarios_publicos).
async function gestoresDe(db, defaultAdmEmails) {
  const cfg = (await db.ref(CFG + '/gestores').get()).val();
  const uids = Array.isArray(cfg) ? cfg.filter(Boolean) : Object.keys(cfg || {}).filter((u) => cfg[u]);
  if (uids.length) return uids;
  const [admSnap, pubSnap] = await Promise.all([db.ref('kanban/config/adm_emails').get(), db.ref('kanban/usuarios_publicos').get()]);
  const emails = (Array.isArray(admSnap.val()) ? admSnap.val() : (defaultAdmEmails || [])).map((e) => String(e).toLowerCase());
  const pub = pubSnap.val() || {};
  return Object.keys(pub).filter((u) => pub[u] && emails.includes(String(pub[u].email || '').toLowerCase()));
}

// `ctx` = { db, eventos, hoje, diasAte, writeNotif } (vem do dailyScan; evita require circular). Devolve contadores (log/teste).
async function runCobrancaEntregas(ctx) {
  const { db, eventos, hoje, diasAte, writeNotif } = ctx;
  const res = { avisados: 0, escalonados: 0, resumo: 0, carimbos: 0, limpos: 0, pulado: '' };
  const dow = diaDaSemana(hoje);
  if (dow === 0 || dow === 6) { res.pulado = 'fim de semana'; return res; }

  const todas = Object.entries(eventos || {}).map(([id, e]) => (e ? { ...e, id: e.id || id } : null)).filter(Boolean);
  const paisComFilha = new Set(todas.filter((e) => e.tipo === 'entrega' && e.paiId).map((e) => e.paiId));
  const abertas = todas.filter((e) => e.tipo === 'entrega' && e.data && e.status !== 'entregue' && !paisComFilha.has(e.id));

  const logSnap = (await db.ref(LOG).get()).val() || {};
  const carimbada = (ev, est) => { const c = logSnap[ev.id] && logSnap[ev.id][est]; return !!c && c.data === ev.data; };

  // limpeza: carimbos de entregas que não existem mais
  for (const id of Object.keys(logSnap)) {
    if (id === '_resumo') continue;
    if (!todas.some((e) => e.id === id && e.tipo === 'entrega')) { await db.ref(`${LOG}/${id}`).remove(); res.limpos++; }
  }

  // 1) pendências do dia, por responsável
  const porPessoa = new Map();                 // uid → [{ev, dias, est}]
  const esc = [];                              // entregas que acabaram de virar "atraso-3"
  const semDono = [];
  const fired = [];                            // {ev, est, para:[uids]}
  for (const ev of abertas) {
    const dias = diasAte(ev.data); if (dias === null) continue;
    const resp = lista(ev.convidados);
    if (!resp.length) { semDono.push({ ev, dias }); continue; }
    const du = diasUteisAte(hoje, ev.data);
    let estagios = estagiosDe(du, dias, hoje, cal.lembretesDe(ev));
    // semanal e atraso-3 no mesmo dia (atraso-3 ainda não avisado): só o atraso-3 avisa (ele já escala)
    if (estagios.includes('atraso-3') && !carimbada(ev, 'atraso-3')) estagios = estagios.filter((e) => !e.startsWith('semanal'));
    const finais = estagios.filter((est) => !carimbada(ev, est));
    if (!finais.length) continue;
    for (const est of finais) {
      fired.push({ ev, est, para: resp });
      if (est === 'atraso-3') esc.push({ ev, dias });
    }
    for (const uid of resp) { if (!porPessoa.has(uid)) porPessoa.set(uid, []); porPessoa.get(uid).push({ ev, dias, est: finais[0] }); }
  }

  // 2) 1 notificação por pessoa (várias entregas = 1 resumo)
  for (const [uid, itens] of porPessoa) {
    const atras = itens.filter((i) => i.dias < 0), venc = itens.filter((i) => i.dias >= 0);
    const topo = (atras.length ? atras : venc).slice().sort((a, b) => a.dias - b.dias);
    const um = topo[0];
    const title = atras.length
      ? (atras.length === 1 ? `📦 Entrega atrasada: ${um.ev.titulo}` : `📦 Você tem ${atras.length} entregas atrasadas`)
      : (venc.length === 1 ? `📦 Vence ${quandoTxt(um.dias)}: ${um.ev.titulo}` : `📦 Você tem ${venc.length} entregas vencendo agora`);
    const linhas = topo.slice(0, 3).map((i) => `${i.ev.titulo} (${rotuloDias(i.dias)})`);
    const sub = linhas.join(' · ') + (itens.length > 3 ? ` · +${itens.length - 3}` : '') + (atras.length && venc.length ? ` · e ${venc.length} vencendo em breve` : '');
    try {
      await writeNotif(db, uid, TIPO, title, sub, null, { okrEventoId: um.ev.id, okrEventoData: um.ev.data });
      res.avisados++;
    } catch (e) { console.error('[okrCobranca] aviso falhou:', uid, e); }
  }

  // 3) escalonamento (atraso-3): gestores + quem criou — exceto quem já foi cobrado como responsável
  if (esc.length) {
    const gestores = await gestoresDe(db, ctx.defaultAdmEmails);
    const pub = (await db.ref('kanban/usuarios_publicos').get()).val() || {};
    const nome = (u) => (pub[u] && pub[u].nome) || 'sem nome';
    const alvos = new Map();
    for (const { ev, dias } of esc) {
      const resp = lista(ev.convidados), dest = new Set([...gestores, ev.criadoPor && ev.criadoPor.uid].filter(Boolean));
      for (const u of dest) { if (resp.includes(u)) continue; if (!alvos.has(u)) alvos.set(u, []); alvos.get(u).push({ ev, dias, resp }); }
    }
    for (const [uid, itens] of alvos) {
      const title = itens.length === 1 ? `📦 Atrasada há ${-itens[0].dias} dias: ${itens[0].ev.titulo}` : `📦 ${itens.length} entregas atrasadas há 3+ dias`;
      const sub = itens.slice(0, 3).map((i) => `${i.ev.titulo} — ${i.resp.map(nome).join(', ')}`).join(' · ') + (itens.length > 3 ? ` · +${itens.length - 3}` : '');
      try { await writeNotif(db, uid, TIPO, title, sub, null, { okrEventoId: itens[0].ev.id, okrEventoData: itens[0].ev.data }); res.escalonados++; } catch (e) { console.error('[okrCobranca] escalonamento falhou:', uid, e); }
    }
  }

  // 4) carimbos (depois de avisar; falha de gravação só repete o aviso amanhã, nunca perde)
  const ts = new Date().toISOString();
  for (const { ev, est, para } of fired) {
    try { await db.ref(`${LOG}/${ev.id}/${est}`).set({ data: ev.data, ts, para }); res.carimbos++; } catch (e) { console.error('[okrCobranca] carimbo falhou:', ev.id, est, e); }
  }

  // 5) resumo da segunda pros gestores — 1x por semana
  if (dow === 1) {
    const semana = semanaIso(hoje);
    const jaFoi = ((logSnap._resumo || {})[semana]) || null;
    if (!jaFoi) {
      const atrasadas = abertas.filter((e) => lista(e.convidados).length && diasAte(e.data) < 0);
      const semana7 = abertas.filter((e) => { const d = diasAte(e.data); return lista(e.convidados).length && d >= 0 && d <= 6; });
      const total = atrasadas.length + semana7.length + semDono.length;
      if (total > 0) {
        const gestores = await gestoresDe(db, ctx.defaultAdmEmails);
        const sub = [`${atrasadas.length} atrasada${atrasadas.length === 1 ? '' : 's'}`, `${semana7.length} vence${semana7.length === 1 ? '' : 'm'} esta semana`, `${semDono.length} sem responsável`].join(' · ');
        const primeira = atrasadas[0] || semana7[0] || (semDono[0] && semDono[0].ev);
        for (const uid of gestores) {
          try { await writeNotif(db, uid, TIPO, '📦 Gestão do Digital — resumo da semana', sub, null, primeira ? { okrEventoId: primeira.id, okrEventoData: primeira.data } : {}); res.resumo++; } catch (e) { console.error('[okrCobranca] resumo falhou:', uid, e); }
        }
      }
      await db.ref(`${LOG}/_resumo/${semana}`).set({ ts, atrasadas: atrasadas.length, semana: semana7.length, semDono: semDono.length });
    }
  }
  return res;
}

module.exports = { runCobrancaEntregas, estagiosDe, diasUteisAte, semanaIso, diaDaSemana, gestoresDe, TIPO, LOG, CFG };
