// functions/github/statusGithub.js
//
// 🐙 Monitor automático de status do GitHub & GitHub Pages — lê https://www.githubstatus.com/api/v2/summary.json
// a cada 5 min. Diferente da VTEX (que abre popup pra empresa inteira), este monitor:
//   1) Atualiza `kanban/github_saude` para exibição na aba 🔋 Status (e barra de topo) do Painel;
//   2) Aciona APENAS os ADMs (`kanban/usuarios_publicos/{uid}.role === 'adm'`) via sino + push (`github_incidente`)
//      quando um incidente abre no GitHub ou quando o componente **Pages** (GitHub Pages, onde o Maré Digital e
//      toda a família Oceano ficam hospedados) entra em degradação/queda — NUNCA cria Comunicado global nem
//      notifica usuários comuns.
//
// Interruptor de emergência: `kanban/config/github_status_off = true` desliga sem redeploy.

let onSchedule;
try { ({ onSchedule } = require('firebase-functions/v2/scheduler')); } catch (_) { onSchedule = (_opts, fn) => fn; }
let getDatabase;
try { ({ getDatabase } = require('firebase-admin/database')); } catch (_) { getDatabase = () => null; }

const SUMMARY_URL = 'https://www.githubstatus.com/api/v2/summary.json';
const SITE = 'https://www.githubstatus.com';
const JANELA_RECENTE_MS = 7 * 24 * 3600 * 1000;   // incidente aberto > 7 dias sem atualizar = zumbi
const TIPO_NOTIF = 'github_incidente';
const TIPO_MONITOR = 'github_monitor_falhou';
const LIMITE_FALHAS = 12;                          // 12 × 5 min = ~1 h seguida sem conseguir ler o status

// Principais componentes do GitHub que interessam à operação (Pages em 1º lugar).
const COMPONENTES_CHAVE = [
  'Pages',
  'Actions',
  'Git Operations',
  'API Requests',
  'Webhooks',
  'Pull Requests',
  'Issues',
  'Packages',
  'Copilot',
];

const TRAD_STATUS_COMP = {
  operational: 'Operacional',
  degraded_performance: 'Lentidão / degradação',
  partial_outage: 'Indisponibilidade parcial',
  major_outage: 'Fora do ar (queda grave)',
  under_maintenance: 'Em manutenção',
};

const TRAD_FASE_INC = {
  investigating: 'Investigando',
  identified: 'Causa identificada',
  monitoring: 'Monitorando',
  resolved: 'Resolvido',
  postmortem: 'Post-mortem',
  scheduled: 'Agendada',
  in_progress: 'Em andamento',
  verifying: 'Verificando',
  completed: 'Concluída',
};

function chaveDe(id) {
  const ult = String(id || '').trim().split('/').filter(Boolean).pop() || 'inc';
  return ult.replace(/[.#$/\[\]\s]/g, '_').slice(0, 80) || 'inc';
}

// Só aceita links http(s) nos domínios oficiais do GitHub Status (stspg-customer.com / githubstatus.com / github.com).
function linkSeguro(u) {
  const s = String(u || '').trim();
  return /^https:\/\/([a-z0-9-]+\.)?(githubstatus\.com|stspg-customer\.com|github\.com)(\/[^\s"<>]*)?$/i.test(s) ? s : '';
}

function ehComponenteFantasma(nome) {
  const n = String(nome || '').trim();
  return !n || /visit\s+www\.githubstatus\.com/i.test(n);
}

function ehPagesComponente(nome) {
  const n = String(nome || '').trim();
  return /^pages$/i.test(n) || /\bgithub\s+pages\b/i.test(n);
}

function traduzirStatusComp(st) {
  const k = String(st || '').trim().toLowerCase();
  return TRAD_STATUS_COMP[k] || String(st || 'Desconhecido');
}

function traduzirFaseInc(st) {
  const k = String(st || '').trim().toLowerCase();
  return TRAD_FASE_INC[k] || String(st || 'Em andamento');
}

function faseDe(inc) {
  const e = String((inc && (inc.estado || inc.status)) || '').trim().toLowerCase();
  if (!e) return 'desconhecido';
  if (/^(resolved|postmortem|completed|complete|cancelled)$/.test(e)) return 'final';
  if (/^(scheduled|planned|upcoming)$/.test(e)) return 'agendado';
  return 'aberto';
}

function recente(inc, agora) {
  const refIso = (inc && (inc.atualizadoEm || inc.criadoEm || inc.updated_at || inc.created_at)) || '';
  const ts = Date.parse(refIso);
  if (!Number.isFinite(ts)) return true;
  return (agora - ts) <= JANELA_RECENTE_MS;
}

// Interpreta o JSON do summary.json da Statuspage do GitHub.
// Retorna null se o JSON não tiver o formato esperado (dispara erro de monitor).
function parseSummary(raw) {
  let data = raw;
  if (typeof raw === 'string') {
    try { data = JSON.parse(raw); } catch (_) { return null; }
  }
  if (!data || typeof data !== 'object') return null;
  if (!Array.isArray(data.components) && !Array.isArray(data.incidents) && !(data.status && typeof data.status.indicator === 'string')) {
    return null;
  }

  const indicador = String((data.status && data.status.indicator) || 'none').toLowerCase();
  const descricao = String((data.status && data.status.description) || '').trim();

  const compsValidos = (Array.isArray(data.components) ? data.components : [])
    .filter((c) => c && typeof c === 'object' && !ehComponenteFantasma(c.name))
    .map((c) => ({
      id: String(c.id || ''),
      nome: String(c.name || '').trim(),
      status: String(c.status || 'operational').trim().toLowerCase(),
      descricao: String(c.description || '').trim(),
      atualizadoEm: String(c.updated_at || ''),
    }));

  if (!compsValidos.length && !Array.isArray(data.incidents)) return null;

  const compPages = compsValidos.find((c) => ehPagesComponente(c.nome)) || null;
  const pagesStatus = compPages ? compPages.status : 'operational';
  const pagesAtualizadoEm = compPages ? compPages.atualizadoEm : '';

  const componentesDegradados = compsValidos
    .filter((c) => c.status !== 'operational')
    .map((c) => ({ nome: c.nome, status: c.status, statusLabel: traduzirStatusComp(c.status) }));

  // Mapa enxuto dos componentes principais para o card do Painel
  const componentesResumo = COMPONENTES_CHAVE.map((nomeAlvo) => {
    const achado = compsValidos.find((c) => c.nome.toLowerCase() === nomeAlvo.toLowerCase());
    return achado
      ? { nome: achado.nome, status: achado.status, statusLabel: traduzirStatusComp(achado.status), atualizadoEm: achado.atualizadoEm }
      : null;
  }).filter(Boolean);

  const incidentes = (Array.isArray(data.incidents) ? data.incidents : [])
    .filter((inc) => inc && typeof inc === 'object' && (inc.id || inc.name))
    .map((inc) => {
      const updates = Array.isArray(inc.incident_updates) ? inc.incident_updates : [];
      const ultUpdate = updates[0] || {};
      const compsInc = (Array.isArray(inc.components) ? inc.components : [])
        .filter((c) => c && !ehComponenteFantasma(c.name))
        .map((c) => ({ nome: String(c.name || '').trim(), status: String(c.status || '').trim().toLowerCase() }));
      const textoUpdate = String(ultUpdate.body || '').replace(/\s+/g, ' ').trim();
      const titulo = String(inc.name || 'Incidente no GitHub').trim();
      const pagesNoIncidente = compsInc.some((c) => ehPagesComponente(c.nome))
        || /\b(github\s+)?pages\b/i.test(titulo)
        || /\b(github\s+)?pages\b/i.test(textoUpdate);
      return {
        id: String(inc.id || chaveDe(titulo)),
        titulo,
        estado: String(inc.status || '').trim().toLowerCase(),
        impacto: String(inc.impact || 'minor').trim().toLowerCase(),
        link: linkSeguro(inc.shortlink) || SITE,
        criadoEm: String(inc.created_at || ''),
        atualizadoEm: String(inc.updated_at || ultUpdate.created_at || inc.created_at || ''),
        resumo: textoUpdate.slice(0, 280),
        componentes: compsInc,
        pagesAfetado: pagesNoIncidente,
      };
    });

  return {
    indicador,
    descricao,
    pagesStatus,
    pagesAtualizadoEm,
    componentesDegradados,
    componentesResumo,
    incidentes,
  };
}

// Se o componente "Pages" ficar degradado/fora do ar sem que exista um incidente aberto mencionando Pages,
// sintetiza um incidente para garantir que os ADMs recebam o alerta imediatamente.
function montarIncidenteSinteticoPages(parsed, agora) {
  if (!parsed || !parsed.pagesStatus || parsed.pagesStatus === 'operational') return null;
  const jaCoberto = (parsed.incidentes || []).some((inc) => faseDe(inc) === 'aberto' && inc.pagesAfetado);
  if (jaCoberto) return null;
  const diaIso = new Date(agora).toISOString().slice(0, 10);
  const st = parsed.pagesStatus;
  const impacto = st === 'major_outage' ? 'critical' : st === 'partial_outage' ? 'major' : 'minor';
  return {
    id: `pages_degradado_${diaIso}_${st}`,
    titulo: `GitHub Pages: ${traduzirStatusComp(st)}`,
    estado: st === 'under_maintenance' ? 'in_progress' : 'investigating',
    impacto,
    link: SITE,
    criadoEm: parsed.pagesAtualizadoEm || new Date(agora).toISOString(),
    atualizadoEm: parsed.pagesAtualizadoEm || new Date(agora).toISOString(),
    resumo: `O componente Pages aparece como "${traduzirStatusComp(st)}" em githubstatus.com (afeta a publicação e o carregamento do GitHub Pages).`,
    componentes: [{ nome: 'Pages', status: st }],
    pagesAfetado: true,
    sintetico: true,
  };
}

function formatarNotifIncidente(inc) {
  const pages = !!inc.pagesAfetado;
  const prefixo = pages ? '🚨 GitHub Pages: ' : '🐙 GitHub: ';
  const title = (prefixo + String(inc.titulo || 'Incidente')).slice(0, 140);
  const partes = [`Situação: ${traduzirFaseInc(inc.estado)}`];
  if (pages) partes.push('📄 Afeta o GitHub Pages');
  else if (Array.isArray(inc.componentes) && inc.componentes.length) {
    partes.push('Afeta: ' + inc.componentes.slice(0, 4).map((c) => c.nome).join(', '));
  }
  if (inc.resumo) partes.push(inc.resumo);
  return {
    title,
    sub: partes.join(' · ').slice(0, 260),
  };
}

// Notifica SOMENTE os ADMs (usuarios_publicos com role === 'adm'). Nunca notifica membros/POs/convidados.
async function notificarAdms({ db, inc, chave, agora }) {
  const pubs = (await db.ref('kanban/usuarios_publicos').get()).val() || {};
  const adms = Object.keys(pubs).filter((uid) => pubs[uid] && pubs[uid].role === 'adm');
  const ts = new Date(agora).toISOString();
  const notifId = `github_${chave}`;
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
      okrObjId: inc.pagesAfetado ? 'pages' : 'github',
      githubUrl: linkSeguro(inc.link) || SITE,
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

  const lista = Array.isArray(parsed.incidentes) ? parsed.incidentes.slice() : [];
  const sintetico = montarIncidenteSinteticoPages(parsed, t);
  if (sintetico) lista.unshift(sintetico);

  const chavesAtivasNoTick = new Set();

  for (const inc of lista) {
    try {
      const chave = chaveDe(inc.id);
      const fase = faseDe(inc);
      const estRef = db.ref(`kanban/github_status/${chave}`);
      const est = (await estRef.get()).val();

      if (fase === 'final') {
        if (!est || est.fechado) { out.ignorados++; continue; }
        await estRef.update({ fechado: true, estado: inc.estado, fechadoEm: iso });
        out.fechados++;
        continue;
      }
      if (!recente(inc, t)) { out.ignorados++; continue; }

      chavesAtivasNoTick.add(chave);
      if (fase === 'aberto') {
        out.incidentesAtivos.push({
          id: chave,
          titulo: inc.titulo.slice(0, 140),
          estado: inc.estado,
          estadoLabel: traduzirFaseInc(inc.estado),
          impacto: inc.impacto || 'minor',
          pagesAfetado: !!inc.pagesAfetado,
          link: linkSeguro(inc.link) || SITE,
          atualizadoEm: inc.atualizadoEm || iso,
          resumo: (inc.resumo || '').slice(0, 220),
          componentes: (inc.componentes || []).slice(0, 6).map((c) => c.nome),
        });
      }

      const jaExistia = !!est && !est.fechado;
      const novoEst = {
        id: chave,
        titulo: inc.titulo.slice(0, 140),
        estado: inc.estado,
        impacto: inc.impacto || 'minor',
        pagesAfetado: !!inc.pagesAfetado,
        link: linkSeguro(inc.link) || SITE,
        criadoEm: (est && est.criadoEm) || inc.criadoEm || iso,
        atualizadoEm: iso,
        fechado: false,
      };
      if (est && est.notificadoEm) novoEst.notificadoEm = est.notificadoEm;

      // Só dispara sino + push aos ADMs quando está em andamento ('aberto') e ainda não foi notificado.
      if (fase === 'aberto' && !(est && est.notificadoEm)) {
        out.notificados += await notificarAdms({ db, inc, chave, agora: t });
        novoEst.notificadoEm = iso;
      }

      await estRef.set(novoEst);
      if (jaExistia) out.atualizados++;
      else out.criados++;
    } catch (e) {
      out.erros++;
      console.error('[githubStatus] item falhou:', inc && inc.id, e);
    }
  }

  // Fecha no banco qualquer incidente que estava aberto em `kanban/github_status` mas sumiu da lista de incidentes ativos do summary.json
  try {
    const todosSalvos = (await db.ref('kanban/github_status').get()).val() || {};
    for (const [ch, val] of Object.entries(todosSalvos)) {
      if (val && !val.fechado && !chavesAtivasNoTick.has(ch)) {
        await db.ref(`kanban/github_status/${ch}`).update({ fechado: true, estado: 'resolved', fechadoEm: iso });
        out.fechados++;
      }
    }
  } catch (e) {
    console.error('[githubStatus] limpeza de fechados falhou:', e);
  }

  return out;
}

async function buscarSummary(fetchImpl) {
  const f = fetchImpl || fetch;
  const r = await f(SUMMARY_URL, {
    headers: { 'user-agent': 'MareDigital-GithubStatus/1.0', accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error('status do GitHub respondeu HTTP ' + r.status);
  return r.text();
}

async function rodar({ db, fetchImpl, agora, log }) {
  const say = log || console;
  if ((await db.ref('kanban/config/github_status_off').get()).val() === true) return { desligado: true };
  const texto = await buscarSummary(fetchImpl);
  const parsed = parseSummary(texto);
  if (!parsed) {
    say.warn('[githubStatus] summary.json inválido ou formato mudou (nada alterado)');
    return { valido: false };
  }
  const r = await processar({ db, parsed, agora });
  if (r.erros && parsed.incidentes.length && r.erros >= parsed.incidentes.length) {
    throw new Error('todos os ' + parsed.incidentes.length + ' incidentes do GitHub falharam ao gravar');
  }
  return Object.assign({ valido: true, parsed }, r);
}

async function alertarMonitor({ db, falhas, erro, agora }) {
  const pubs = (await db.ref('kanban/usuarios_publicos').get()).val() || {};
  const adms = Object.keys(pubs).filter((uid) => pubs[uid] && pubs[uid].role === 'adm');
  const ts = new Date(agora).toISOString();
  const id = `githubmon_${ts.slice(0, 10)}`;
  const sub = `Sem ler o status do GitHub há ~${Math.round((falhas * 5) / 60 * 10) / 10} h (${falhas} tentativas): ${String(erro || 'resposta inválida').slice(0, 120)}.`;
  let n = 0;
  for (const uid of adms) {
    const ref = db.ref(`kanban/usuarios/${uid}/notificacoes/${id}`);
    if ((await ref.get()).exists()) continue;
    await ref.set({ id, type: TIPO_MONITOR, title: '🛰️ Monitor do GitHub sem resposta', sub, link: 'status', read: false, ts });
    n++;
  }
  return n;
}

async function executar({ db, fetchImpl, agora, log }) {
  const t = agora == null ? Date.now() : agora;
  const iso = new Date(t).toISOString();
  const ref = db.ref('kanban/github_saude');
  try {
    const r = await rodar({ db, fetchImpl, agora: t, log });
    if (r.desligado) { await ref.set({ desligado: true, em: iso }); return r; }
    if (!r.valido) throw new Error('summary.json do GitHub ilegível (formato mudou?)');
    const p = r.parsed;
    const pagesAfetadoAgora = p.pagesStatus !== 'operational' || r.incidentesAtivos.some((i) => i.pagesAfetado);
    await ref.set({
      ok: true,
      ultimoOkEm: iso,
      verificadoEm: iso,
      indicador: p.indicador,
      descricao: p.descricao,
      pagesStatus: p.pagesStatus,
      pagesStatusLabel: traduzirStatusComp(p.pagesStatus),
      pagesAtualizadoEm: p.pagesAtualizadoEm || iso,
      pagesAfetado: pagesAfetadoAgora,
      componentesDegradados: p.componentesDegradados.slice(0, 8),
      componentesResumo: p.componentesResumo,
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
      catch (e2) { console.error('[githubStatus] não consegui avisar os ADMs (tenta de novo no próximo tick):', e2); }
    }
    await ref.update(upd);
    throw e;
  }
}

exports.githubStatus = onSchedule(
  { schedule: '*/5 * * * *', timeZone: 'America/Sao_Paulo', region: 'us-central1', timeoutSeconds: 60 },
  async () => {
    try {
      const r = await executar({ db: getDatabase() });
      if (r.criados || r.fechados || r.atualizados) console.log('[githubStatus]', JSON.stringify({ criados: r.criados, atualizados: r.atualizados, fechados: r.fechados, notificados: r.notificados }));
    } catch (e) {
      console.error('[githubStatus] falhou:', e);
    }
  }
);

exports._test = {
  SUMMARY_URL,
  SITE,
  TIPO_NOTIF,
  TIPO_MONITOR,
  LIMITE_FALHAS,
  chaveDe,
  linkSeguro,
  ehPagesComponente,
  traduzirStatusComp,
  traduzirFaseInc,
  faseDe,
  recente,
  parseSummary,
  montarIncidenteSinteticoPages,
  formatarNotifIncidente,
  notificarAdms,
  processar,
  rodar,
  alertarMonitor,
  executar,
};
