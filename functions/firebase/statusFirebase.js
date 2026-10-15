// functions/firebase/statusFirebase.js
//
// 🔥 Monitor automático de status do Firebase (focado exclusivamente nos serviços que o Maré Digital / família Oceano usa):
//   • 🗄️ Realtime Database (principal — banco de dados em tempo real `kanban/*`)
//   • 🔐 Authentication (login Google `@ciahering.com.br`)
//   • 🔔 Cloud Messaging (FCM — notificações push Web/PWA)
//   • ⚡ Cloud Functions (orquestrador do Agente Ágil, push, backups, lembretes e vigias)
//   • 📦 Cloud Storage (anexos dos cards, fotos e cofre `backups-completos/`)
//   • 🌐 Hosting (domínio `hering-onboarding.firebaseapp.com` do handler OAuth do login)
//
// Lê https://status.firebase.google.com/incidents.json a cada 5 min:
//   1) Ignora incidentes de produtos do Firebase que NÃO usamos (Crashlytics, Test Lab, AdMob, Remote Config, Analytics, etc.);
//   2) Atualiza `kanban/firebase_saude` para exibição na aba 🔋 Status (e barra de topo) do Painel;
//   3) Aciona APENAS os ADMs (`kanban/usuarios_publicos/{uid}.role === 'adm'`) via sino + push (`firebase_incidente`)
//      quando abre um incidente em qualquer um dos 6 serviços usados — NUNCA cria Comunicado global nem notifica usuários comuns.
//
// Interruptor de emergência: `kanban/config/firebase_status_off = true` desliga sem redeploy.

let onSchedule;
try { ({ onSchedule } = require('firebase-functions/v2/scheduler')); } catch (_) { onSchedule = (_opts, fn) => fn; }
let getDatabase;
try { ({ getDatabase } = require('firebase-admin/database')); } catch (_) { getDatabase = () => null; }

const INCIDENTS_URL = 'https://status.firebase.google.com/incidents.json';
const SITE = 'https://status.firebase.google.com';
const JANELA_RECENTE_MS = 7 * 24 * 3600 * 1000;   // incidente aberto > 7 dias sem atualizar = zumbi
const TIPO_NOTIF = 'firebase_incidente';
const TIPO_MONITOR = 'firebase_monitor_falhou';
const LIMITE_FALHAS = 12;                          // 12 × 5 min = ~1 h seguida sem conseguir ler o status

// Catálogo canônico dos 6 serviços do Firebase que o ecossistema Maré Digital / Oceano realmente utiliza.
const SERVICOS_USADOS = [
  {
    key: 'Realtime Database',
    label: 'Realtime Database',
    uso: 'Banco em tempo real (cards, OKR, escala, metas, mural e presença)',
    primary: true,
    match: /\b(realtime\s+database|rtdb|firebase-database)\b/i,
  },
  {
    key: 'Authentication',
    label: 'Authentication',
    uso: 'Login Google corporativo (@ciahering.com.br) e sessão',
    match: /\b(authentication|firebase\s*auth|firebase-auth)\b/i,
  },
  {
    key: 'Cloud Messaging',
    label: 'Cloud Messaging (FCM)',
    uso: 'Notificações push no navegador e celular (Service Worker)',
    match: /\b(cloud\s+messaging|fcm|firebase-messaging)\b/i,
  },
  {
    key: 'Cloud Functions',
    label: 'Cloud Functions',
    uso: 'Push, Agente Ágil, Intake, Backups, Lembretes e Vigias',
    match: /\b(cloud\s+functions|functions)\b/i,
  },
  {
    key: 'Cloud Storage',
    label: 'Cloud Storage',
    uso: 'Anexos dos cards, avatares e backups completos no Storage',
    match: /\b(cloud\s+storage|storage\s+for\s+firebase|firebase-storage|^storage$)\b/i,
  },
  {
    key: 'Hosting',
    label: 'Hosting / Auth Domain',
    uso: 'Domínio hering-onboarding.firebaseapp.com (handler OAuth do login)',
    match: /\b(hosting|firebase-hosting)\b/i,
  },
];

const TRAD_STATUS = {
  operational: 'Operacional',
  degraded_performance: 'Lentidão / instabilidade',
  partial_outage: 'Indisponibilidade parcial',
  major_outage: 'Fora do ar (queda grave)',
  under_maintenance: 'Em manutenção',
};

function chaveDe(id) {
  const ult = String(id || '').trim().split('/').filter(Boolean).pop() || 'inc';
  return ult.replace(/[.#$/\[\]\s]/g, '_').slice(0, 80) || 'inc';
}

function linkSeguro(uriOrUrl) {
  const s = String(uriOrUrl || '').trim();
  if (!s) return SITE;
  if (/^https:\/\/status\.(firebase|cloud)\.google\.com(\/[^\s"<>]*)?$/i.test(s)) return s;
  if (/^\/?incidents\/[a-zA-Z0-9_-]+\/?$/.test(s)) {
    return `${SITE}/${s.replace(/^\/+/, '')}`;
  }
  return SITE;
}

function traduzirStatus(st) {
  const k = String(st || '').trim().toLowerCase();
  return TRAD_STATUS[k] || String(st || 'Desconhecido');
}

// Identifica quais dos 6 serviços que usamos são afetados por um incidente do Firebase.
// Retorna array de keys canônicas (ex.: ['Realtime Database', 'Authentication']). Vazio = incidente de serviço que NÃO usamos.
function identificarServicosUsados(rawInc) {
  if (!rawInc || typeof rawInc !== 'object') return [];
  const candidatos = [];
  if (rawInc.service_name) candidatos.push(String(rawInc.service_name));
  if (rawInc.service_key) candidatos.push(String(rawInc.service_key));
  if (Array.isArray(rawInc.affected_products)) {
    for (const p of rawInc.affected_products) {
      if (p && p.title) candidatos.push(String(p.title));
      if (p && p.id) candidatos.push(String(p.id));
    }
  }
  const achados = new Set();
  for (const texto of candidatos) {
    for (const srv of SERVICOS_USADOS) {
      if (srv.match.test(texto)) achados.add(srv.key);
    }
  }
  return Array.from(achados);
}

// Converte severidade/status_impact do Google Status para o modelo visual do Painel.
function mapearStatusImpacto(rawInc) {
  const mru = (rawInc && rawInc.most_recent_update) || {};
  const impact = String(mru.status || rawInc.status_impact || '').toUpperCase();
  const sev = String(rawInc.severity || '').toLowerCase();
  if (impact === 'SERVICE_OUTAGE' || sev === 'high') return 'major_outage';
  if (impact === 'SERVICE_DISRUPTION' || sev === 'medium') return 'partial_outage';
  if (impact === 'SERVICE_INFORMATION' || sev === 'low') return 'degraded_performance';
  return 'partial_outage';
}

function limparTextoStatus(txt) {
  return String(txt || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function faseDe(inc) {
  if (!inc || typeof inc !== 'object') return 'desconhecido';
  if (inc.encerrado === true) return 'final';
  const e = String(inc.estado || '').trim().toLowerCase();
  if (e === 'resolved' || e === 'available' || e === 'final') return 'final';
  return 'aberto';
}

function recente(inc, agora) {
  const refIso = (inc && (inc.atualizadoEm || inc.criadoEm)) || '';
  const ts = Date.parse(refIso);
  if (!Number.isFinite(ts)) return true;
  return (agora - ts) <= JANELA_RECENTE_MS;
}

// Interpreta o JSON de https://status.firebase.google.com/incidents.json.
// Retorna null se não for um array JSON válido (dispara alerta de falha do monitor após LIMITE_FALHAS).
function parseIncidents(raw, agora = Date.now()) {
  let arr = raw;
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw); } catch (_) { return null; }
  }
  if (!Array.isArray(arr)) return null;

  const incidentesUsados = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const servicos = identificarServicosUsados(item);
    if (!servicos.length) continue; // Ignora serviços que não usamos (Crashlytics, AdMob, Test Lab, etc.)

    const mru = item.most_recent_update || (Array.isArray(item.updates) && item.updates[0]) || {};
    const mruStatus = String(mru.status || item.status_impact || '').toUpperCase();
    const temFim = Boolean(item.end && String(item.end).trim()) || mruStatus === 'AVAILABLE';
    const statusComp = temFim ? 'operational' : mapearStatusImpacto(item);
    const criadoEm = String(item.begin || item.created || mru.when || mru.created || '');
    const atualizadoEm = String(mru.when || mru.created || item.modified || item.end || criadoEm || '');
    const titulo = limparTextoStatus(item.external_desc || `Incidente em ${servicos.join(', ')}`) || `Incidente no Firebase (${servicos.join(', ')})`;
    const resumo = limparTextoStatus(mru.text || '').slice(0, 280);

    incidentesUsados.push({
      id: String(item.id || item.number || chaveDe(titulo)),
      numero: String(item.number || item.id || ''),
      titulo,
      servicos,
      rtdbAfetado: servicos.includes('Realtime Database'),
      estado: temFim ? 'resolved' : (statusComp === 'major_outage' ? 'outage' : 'disruption'),
      statusComp,
      severidade: String(item.severity || (statusComp === 'major_outage' ? 'high' : 'medium')).toLowerCase(),
      encerrado: temFim,
      link: linkSeguro(item.uri),
      criadoEm,
      atualizadoEm,
      resumo,
    });
  }

  // Monta o mapa dos 6 serviços que usamos a partir dos incidentes em aberto e recentes
  const RANK = { operational: 0, under_maintenance: 1, degraded_performance: 2, partial_outage: 3, major_outage: 4 };
  const servicosMap = {};
  for (const s of SERVICOS_USADOS) {
    servicosMap[s.key] = {
      key: s.key,
      nome: s.label,
      uso: s.uso,
      status: 'operational',
      statusLabel: traduzirStatus('operational'),
      atualizadoEm: new Date(agora).toISOString(),
    };
  }

  for (const inc of incidentesUsados) {
    if (faseDe(inc) !== 'aberto' || !recente(inc, agora)) continue;
    for (const sk of inc.servicos) {
      const atual = servicosMap[sk];
      if (!atual) continue;
      if ((RANK[inc.statusComp] || 0) > (RANK[atual.status] || 0)) {
        atual.status = inc.statusComp;
        atual.statusLabel = traduzirStatus(inc.statusComp);
        atual.incidenteTitulo = inc.titulo.slice(0, 120);
        atual.atualizadoEm = inc.atualizadoEm || atual.atualizadoEm;
      }
    }
  }

  const servicosResumo = SERVICOS_USADOS.map((s) => servicosMap[s.key]);
  const servicosDegradados = servicosResumo.filter((s) => s.status !== 'operational');
  const rtdbObj = servicosMap['Realtime Database'];

  return {
    rtdbStatus: rtdbObj.status,
    rtdbStatusLabel: rtdbObj.statusLabel,
    rtdbAfetado: rtdbObj.status !== 'operational',
    servicos: servicosMap,
    servicosResumo,
    servicosDegradados,
    incidentes: incidentesUsados,
  };
}

function formatarNotifIncidente(inc) {
  const rtdb = !!inc.rtdbAfetado;
  const listaSrv = (inc.servicos || []).join(', ') || 'Firebase';
  const prefixo = rtdb ? '🚨 Firebase Realtime Database: ' : `🔥 Firebase (${listaSrv}): `;
  const title = (prefixo + String(inc.titulo || 'Incidente em andamento')).slice(0, 140);
  const partes = [
    `Impacto: ${traduzirStatus(inc.statusComp)}`,
    `Serviço(s) usado(s): ${listaSrv}`,
  ];
  if (inc.resumo) partes.push(inc.resumo);
  return {
    title,
    sub: partes.join(' · ').slice(0, 260),
  };
}

// Notifica SOMENTE os ADMs (`kanban/usuarios_publicos/{uid}.role === 'adm'`).
async function notificarAdms({ db, inc, chave, agora }) {
  const pubs = (await db.ref('kanban/usuarios_publicos').get()).val() || {};
  const adms = Object.keys(pubs).filter((uid) => pubs[uid] && pubs[uid].role === 'adm');
  const ts = new Date(agora).toISOString();
  const notifId = `firebase_${chave}`;
  const { title, sub } = formatarNotifIncidente(inc);
  let enviados = 0;
  for (const uid of adms) {
    const nRef = db.ref(`kanban/usuarios/${uid}/notificacoes/${notifId}`);
    if ((await nRef.get()).exists()) continue;
    await nRef.set({
      id: notifId,
      type: TIPO_NOTIF,
      title,
      sub,
      link: 'status',
      okrObjId: inc.rtdbAfetado ? 'rtdb' : 'firebase',
      firebaseUrl: linkSeguro(inc.link),
      read: false,
      ts,
    });
    enviados++;
  }
  return enviados;
}

async function processar({ db, parsed, agora }) {
  const t = agora == null ? Date.now() : agora;
  const iso = new Date(t).toISOString();
  const out = { criados: 0, atualizados: 0, fechados: 0, notificados: 0, ignorados: 0, erros: 0, incidentesAtivos: [] };

  const lista = Array.isArray(parsed.incidentes) ? parsed.incidentes : [];
  const chavesAtivasNoTick = new Set();

  for (const inc of lista) {
    try {
      const chave = chaveDe(inc.id);
      const fase = faseDe(inc);
      if (!chave || fase === 'desconhecido') { out.ignorados++; continue; }
      const estRef = db.ref(`kanban/firebase_status/${chave}`);
      const est = (await estRef.get()).val();

      if (fase === 'final') {
        if (!est || est.fechado) { out.ignorados++; continue; }
        await estRef.update({ fechado: true, estado: 'resolved', fechadoEm: iso });
        out.fechados++;
        continue;
      }
      if (!recente(inc, t)) { out.ignorados++; continue; }

      chavesAtivasNoTick.add(chave);
      out.incidentesAtivos.push({
        id: chave,
        titulo: inc.titulo.slice(0, 140),
        servicos: inc.servicos,
        rtdbAfetado: !!inc.rtdbAfetado,
        statusComp: inc.statusComp,
        estadoLabel: traduzirStatus(inc.statusComp),
        severidade: inc.severidade || 'medium',
        link: linkSeguro(inc.link),
        atualizadoEm: inc.atualizadoEm || iso,
        resumo: (inc.resumo || '').slice(0, 220),
      });

      const jaExistia = !!est && !est.fechado;
      const novoEst = {
        id: chave,
        titulo: inc.titulo.slice(0, 140),
        servicos: inc.servicos,
        rtdbAfetado: !!inc.rtdbAfetado,
        estado: inc.estado,
        statusComp: inc.statusComp,
        link: linkSeguro(inc.link),
        criadoEm: (est && est.criadoEm) || inc.criadoEm || iso,
        atualizadoEm: iso,
        fechado: false,
      };
      if (est && est.notificadoEm) novoEst.notificadoEm = est.notificadoEm;

      if (!(est && est.notificadoEm)) {
        out.notificados += await notificarAdms({ db, inc, chave, agora: t });
        novoEst.notificadoEm = iso;
      }

      await estRef.set(novoEst);
      if (jaExistia) out.atualizados++;
      else out.criados++;
    } catch (e) {
      out.erros++;
      console.error('[firebaseStatus] item falhou:', inc && inc.id, e);
    }
  }

  // Fecha no banco qualquer incidente que estava aberto em `kanban/firebase_status` mas sumiu/fechou no feed
  try {
    const todosSalvos = (await db.ref('kanban/firebase_status').get()).val() || {};
    for (const [ch, val] of Object.entries(todosSalvos)) {
      if (val && !val.fechado && !chavesAtivasNoTick.has(ch)) {
        await db.ref(`kanban/firebase_status/${ch}`).update({ fechado: true, estado: 'resolved', fechadoEm: iso });
        out.fechados++;
      }
    }
  } catch (e) {
    console.error('[firebaseStatus] limpeza de fechados falhou:', e);
  }

  return out;
}

async function buscarIncidents(fetchImpl) {
  const f = fetchImpl || fetch;
  const r = await f(INCIDENTS_URL, {
    headers: { 'user-agent': 'MareDigital-FirebaseStatus/1.0', accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error('status do Firebase respondeu HTTP ' + r.status);
  return r.text();
}

async function rodar({ db, fetchImpl, agora, log }) {
  const say = log || console;
  const t = agora == null ? Date.now() : agora;
  if ((await db.ref('kanban/config/firebase_status_off').get()).val() === true) return { desligado: true };
  const texto = await buscarIncidents(fetchImpl);
  const parsed = parseIncidents(texto, t);
  if (!parsed) {
    say.warn('[firebaseStatus] incidents.json inválido ou formato mudou (nada alterado)');
    return { valido: false };
  }
  const r = await processar({ db, parsed, agora: t });
  if (r.erros && parsed.incidentes.length && r.erros >= parsed.incidentes.length) {
    throw new Error('todos os ' + parsed.incidentes.length + ' incidentes do Firebase falharam ao gravar');
  }
  return Object.assign({ valido: true, parsed }, r);
}

async function alertarMonitor({ db, falhas, erro, agora }) {
  const pubs = (await db.ref('kanban/usuarios_publicos').get()).val() || {};
  const adms = Object.keys(pubs).filter((uid) => pubs[uid] && pubs[uid].role === 'adm');
  const ts = new Date(agora).toISOString();
  const id = `firebasemon_${ts.slice(0, 10)}`;
  const sub = `Sem ler o status do Firebase há ~${Math.round((falhas * 5) / 60 * 10) / 10} h (${falhas} tentativas): ${String(erro || 'resposta inválida').slice(0, 120)}.`;
  let n = 0;
  for (const uid of adms) {
    const ref = db.ref(`kanban/usuarios/${uid}/notificacoes/${id}`);
    if ((await ref.get()).exists()) continue;
    await ref.set({ id, type: TIPO_MONITOR, title: '🛰️ Monitor do Firebase sem resposta', sub, link: 'status', read: false, ts });
    n++;
  }
  return n;
}

async function executar({ db, fetchImpl, agora, log }) {
  const t = agora == null ? Date.now() : agora;
  const iso = new Date(t).toISOString();
  const ref = db.ref('kanban/firebase_saude');
  try {
    const r = await rodar({ db, fetchImpl, agora: t, log });
    if (r.desligado) { await ref.set({ desligado: true, em: iso }); return r; }
    if (!r.valido) throw new Error('incidents.json do Firebase ilegível (formato mudou?)');
    const p = r.parsed;
    await ref.set({
      ok: true,
      ultimoOkEm: iso,
      verificadoEm: iso,
      rtdbStatus: p.rtdbStatus,
      rtdbStatusLabel: p.rtdbStatusLabel,
      rtdbAfetado: p.rtdbAfetado,
      servicos: p.servicos,
      servicosResumo: p.servicosResumo,
      servicosDegradados: p.servicosDegradados,
      abertos: r.incidentesAtivos.length,
      incidentes: r.incidentesAtivos.slice(0, 5),
      falhasSeguidas: 0,
    });
    return r;
  } catch (e) {
    const prev = (await ref.get()).val() || {};
    const n = (prev.falhasSeguidas || 0) + 1;
    const upd = { ok: false, falhasSeguidas: n, ultimaTentativaEm: iso, verificadoEm: iso, erro: String((e && e.message) || e).slice(0, 200) };
    if (n >= LIMITE_FALHAS && !prev.avisadoEm) {
      try { await alertarMonitor({ db, falhas: n, erro: upd.erro, agora: t }); upd.avisadoEm = iso; }
      catch (e2) { console.error('[firebaseStatus] não consegui avisar os ADMs (tenta de novo no próximo tick):', e2); }
    }
    await ref.update(upd);
    throw e;
  }
}

exports.firebaseStatus = onSchedule(
  { schedule: '*/5 * * * *', timeZone: 'America/Sao_Paulo', region: 'us-central1', timeoutSeconds: 60 },
  async () => {
    try {
      const r = await executar({ db: getDatabase() });
      if (r.criados || r.fechados || r.atualizados) console.log('[firebaseStatus]', JSON.stringify({ criados: r.criados, atualizados: r.atualizados, fechados: r.fechados, notificados: r.notificados }));
    } catch (e) {
      console.error('[firebaseStatus] falhou:', e);
    }
  }
);

exports._test = {
  INCIDENTS_URL,
  SITE,
  SERVICOS_USADOS,
  TIPO_NOTIF,
  TIPO_MONITOR,
  LIMITE_FALHAS,
  chaveDe,
  linkSeguro,
  traduzirStatus,
  identificarServicosUsados,
  mapearStatusImpacto,
  faseDe,
  recente,
  parseIncidents,
  formatarNotifIncidente,
  notificarAdms,
  processar,
  rodar,
  alertarMonitor,
  executar,
};
