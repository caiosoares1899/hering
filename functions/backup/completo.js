// functions/backup/completo.js
//
// Backup COMPLETO do Realtime Database pro Cloud Storage (2026-10-13).
//
// Por quê: o `weeklyBackup` (weeklyBackup.js, 2026-08-12) só guarda o QUADRO de cada squad
// (cards, colunas, tags, agil_cfg, ql_items, links, cal_events, auto_rules). Ficava de fora tudo
// que o Maré virou depois: comentários dos cards, `config` do squad (Raias, Ficha Técnica, padrões,
// calendários, impedimentos), intake, subtimes, kudos, snapshots do CFD; e FORA dos squads: o Radar (`okr`),
// as Metas, a Escala, `usuarios` (papéis/squads/torre/preferências), `squads_meta`, Comunicados,
// `painel`, `config`… Nada disso tinha cópia nenhuma. O `weeklyBackup` continua como está (é o
// formato que a UI "🧯 Restaurar backup" do board entende); este é um SEGUNDO backup, aditivo.
//
// Dois modos (mesmo código, 2 funções agendadas em index.js):
//   • semanal — domingo 04:30: TUDO (cada squad inteiro + todos os nós globais)  → backups-completos/semanal/{data}/
//   • diario  — todo dia 03:30: só os nós globais PEQUENOS e insubstituíveis (OKR, Metas, Escala, usuários…)
//                                                                              → backups-completos/diario/{data}/
// Layout:   global/{nó}.json · squads/{id}.json · manifesto.json (o que entrou, tamanhos, erros, o que ficou de fora)
//
// Segurança: o prefixo `backups-completos/` NÃO tem regra de leitura em storage.rules (negado por padrão — só o Admin
// SDK/console enxergam), porque aqui dentro tem papéis/e-mails de todo mundo. Nunca entram: segredos (`spotify_*`,
// `oauth_pending`), tokens de push (`fcm_tokens`), notificações pessoais, presença/locks/logs de debug e os nós `_dev`.
// Retenção: storage-lifecycle.json (semanal 90 dias, diário 14 dias) — `gsutil lifecycle set`, ver README.md.
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getDatabase } = require('firebase-admin/database');
const { getStorage } = require('firebase-admin/storage');
const { _listActiveSquads } = require('./weeklyBackup');

const PREFIXO = 'backups-completos';

// Nós de `kanban/` copiados como estão (menos o que `filtros` tira). `diario:true` = entra também no backup diário.
const NOS_GLOBAIS = [
  { no: 'okr', diario: true },               // Radar: objetivos, marcos, gerências, mural, calendário, notas, agente_chat, snapshots
  { no: 'metas_digital', diario: true },     // 🐟 Metas
  { no: 'metas_squads', diario: true },
  { no: 'metas_log', diario: true },
  { no: 'escala', diario: true },            // 🗓️ Escala
  { no: 'travessia', diario: false },         // ⛵ Travessia (Baú, 1:1, humor, avaliações): dado SENSÍVEL, só no backup semanal. Quem administra o projeto lê o bucket — ver docs/ideias/travessia-2026-10-22.md §12.3
  { no: 'vtex_status', diario: false },      // 🚨 estado do monitor de incidentes da VTEX (reconstituível a partir do feed)
  { no: 'github_status', diario: false },    // 🐙 estado do monitor de incidentes do GitHub / GitHub Pages (reconstituível a partir da API)
  { no: 'firebase_status', diario: false },  // 🔥 estado do monitor de incidentes do Firebase (reconstituível a partir da API)
  { no: 'usuarios', diario: true },          // papéis, squads, torre, preferências (sem notificações/tokens)
  { no: 'usuarios_publicos', diario: true },
  { no: 'squads_meta', diario: true },       // quais squads existem
  { no: 'comunicados', diario: true },       // Mural/Comunicados
  { no: 'notif_config', diario: true },      // interruptores da Central de Notificações
  { no: 'painel', diario: true },            // config do painel, kudos geral, agentes externos…
  { no: 'painel_viewers', diario: true },    // visualizadores externos autorizados
  { no: 'config', diario: true },            // links da Hering, apresentações de dados…
  { no: 'init_registry', diario: true },
  { no: 'global', diario: true },
  { no: 'campanhas', diario: false },        // volumosos / reconstituíveis: só no semanal
  { no: 'campanhas_log', diario: false },
  { no: 'dados_diarios', diario: false },
  { no: 'dados_diarios_dev', diario: false }, // exceção ao "nada de _dev": a Central de Dados também é publicada pelo painel de teste (painel-dev)
  { no: 'feedback', diario: false },
];

// O que NUNCA entra (documentado no manifesto pra ninguém achar que "esqueceu"):
const EXCLUIDOS = [
  'spotify_secrets', 'spotify_radio_owner_secret', 'oauth_pending',           // segredos
  'presence', 'notif_feed', 'notif_feed_seen', 'vtex_saude', 'github_saude', 'firebase_saude', // efêmeros (o feed é derivado; *_saude = batimento dos monitores)
  'usuarios/*/notificacoes', 'usuarios/*/fcm_tokens',                         // caixa de notificações e tokens de push
  'painel/{okr_presence,presence,spotify_now_geral,_debug_*}', 'okr/obj_locks', // presença, travas e debug
  'squads/*/{presence,access_log,error_logs,error_stats,agent_usage,backups}', // telemetria do squad
  'squads/*/dados/{_debug_*,access_stats,card_locks,spotify_now,agente_pending_auto}',
  'nós *_dev (dados de teste — exceto dados_diarios_dev) e os squads fictícios dev/omnichannel',
];

const SEM = {
  usuario: ['notificacoes', 'fcm_tokens'],
  painel: ['okr_presence', 'presence', 'spotify_now_geral', '_debug_bytes_log', '_debug_bytes_daily', '_debug_bytes_log_dev', '_debug_bytes_daily_dev'],
  okr: ['obj_locks'],
  dadosSquad: ['_debug_bytes_log', '_debug_bytes_daily', '_debug_fallback_log', 'access_stats', 'card_locks', 'spotify_now', 'agente_pending_auto'],
};

const sem = (obj, chaves) => {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  Object.keys(obj).forEach((k) => { if (!chaves.includes(k)) out[k] = obj[k]; });
  return out;
};

// Filtros por nó (puros — testados em __tests__/completo.test.js)
const filtros = {
  usuarios: (v) => {
    if (!v || typeof v !== 'object') return v;
    const out = {};
    Object.keys(v).forEach((uid) => { out[uid] = sem(v[uid], SEM.usuario); });
    return out;
  },
  painel: (v) => sem(v, SEM.painel),
  okr: (v) => sem(v, SEM.okr),
};
const filtrarNo = (no, valor) => (filtros[no] ? filtros[no](valor) : valor);
const filtrarDadosSquad = (dados) => sem(dados, SEM.dadosSquad);

const dataBrasilia = (d) => (d || new Date()).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const nosDoModo = (modo) => NOS_GLOBAIS.filter((n) => modo === 'semanal' || n.diario);
const caminhoBase = (modo, data) => `${PREFIXO}/${modo}/${data}`;

async function salvar(bucket, caminho, objeto) {
  const texto = JSON.stringify(objeto);
  await bucket.file(caminho).save(texto, { contentType: 'application/json', resumable: false });
  return Buffer.byteLength(texto);
}

// Roda o backup. `db`/`bucket` injetados (os testes passam fakes). Devolve o manifesto; lança no fim se algum item falhou
// (a execução aparece como falha no monitoramento do Cloud Scheduler, mas o que deu certo já foi salvo).
async function rodarBackup({ db, bucket, modo, agora, log }) {
  const say = log || console;
  const data = dataBrasilia(agora);
  const base = caminhoBase(modo, data);
  const manifesto = { versao: 1, modo, data, geradoEm: (agora || new Date()).toISOString(), itens: [], vazios: [], erros: [], excluidos: EXCLUIDOS };

  for (const { no } of nosDoModo(modo)) {
    try {
      const v = filtrarNo(no, (await db.ref(`kanban/${no}`).get()).val());
      if (v == null) { manifesto.vazios.push(`global/${no}`); continue; }
      const bytes = await salvar(bucket, `${base}/global/${no}.json`, { no: `kanban/${no}`, exportadoEm: manifesto.geradoEm, dados: v });
      manifesto.itens.push({ caminho: `global/${no}.json`, bytes, filhos: typeof v === 'object' ? Object.keys(v).length : 1 });
    } catch (e) { manifesto.erros.push({ item: `global/${no}`, erro: String(e && e.message || e) }); say.error(`[backupCompleto] ${no} falhou:`, e); }
  }

  if (modo === 'semanal') {
    let squads = [];
    try { squads = await _listActiveSquads(db); } catch (e) { manifesto.erros.push({ item: 'squads (lista)', erro: String(e && e.message || e) }); }
    for (const id of squads) {
      try {
        const [dados, snapshots, externos] = await Promise.all(['dados', 'snapshots', 'externos'].map(async (c) => (await db.ref(`kanban/squads/${id}/${c}`).get()).val()));
        if (dados == null && snapshots == null && externos == null) { manifesto.vazios.push(`squads/${id}`); continue; }
        const bytes = await salvar(bucket, `${base}/squads/${id}.json`, { squad: id, exportadoEm: manifesto.geradoEm, dados: filtrarDadosSquad(dados), snapshots, externos });
        manifesto.itens.push({ caminho: `squads/${id}.json`, bytes, filhos: dados && typeof dados === 'object' ? Object.keys(dados).length : 0 });
      } catch (e) { manifesto.erros.push({ item: `squads/${id}`, erro: String(e && e.message || e) }); say.error(`[backupCompleto] squad ${id} falhou:`, e); }
    }
  }

  await salvar(bucket, `${base}/manifesto.json`, manifesto);
  say.log(`[backupCompleto/${modo}] ${manifesto.itens.length} itens, ${manifesto.vazios.length} vazios, ${manifesto.erros.length} erros → ${base}/`);
  if (manifesto.erros.length) throw new Error(`backupCompleto/${modo}: ${manifesto.erros.length} item(ns) falharam: ${manifesto.erros.map((e) => e.item).join(', ')}`);
  return manifesto;
}

const OPTS = { timeZone: 'America/Sao_Paulo', region: 'us-central1', memory: '512MiB', timeoutSeconds: 300 };

exports.backupCompletoSemanal = onSchedule({ ...OPTS, schedule: 'every sunday 04:30' },
  async () => { await rodarBackup({ db: getDatabase(), bucket: getStorage().bucket(), modo: 'semanal' }); });

exports.backupGlobalDiario = onSchedule({ ...OPTS, schedule: 'every day 03:30' },
  async () => { await rodarBackup({ db: getDatabase(), bucket: getStorage().bucket(), modo: 'diario' }); });

Object.assign(exports, { rodarBackup, filtrarNo, filtrarDadosSquad, nosDoModo, caminhoBase, dataBrasilia, NOS_GLOBAIS, EXCLUIDOS, PREFIXO });
