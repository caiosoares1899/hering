// functions/backup/vigia.js — o VIGIA dos backups (2026-10-13).
//
// Por quê: um backup que falha em silêncio é pior que nenhum (dá falsa segurança). Hoje uma falha só aparece no log da função e na coluna
// "último resultado" do Cloud Scheduler — ninguém olha. Pior: se a função NÃO RODA (agendamento apagado, função com erro de deploy, permissão
// revogada), não há nem log. Por isso o vigia não confia na execução: ele confere o RESULTADO no Cloud Storage, todo dia às 09:00 (Brasília),
// depois dos backups (03:30 diário · 04:00 quadro dos squads, domingo · 04:30 completo, domingo):
//   1. existe o manifesto do backup COMPLETO diário de hoje, e sem erros?
//   2. o backup COMPLETO semanal mais recente tem ≤ 8 dias, existe o manifesto, sem erros?
//   3. o backup do QUADRO (weeklyBackup, backups/{squad}/{data}.json) de cada squad ativo tem ≤ 8 dias?
// Se algo falhar: notificação 🛟 pros ADMs (sino + push — tipo `backup_falhou`, em PUSH_TYPES). No máximo UMA por dia (id fixo `backup_{data}`; reexecutar
// o vigia no mesmo dia não duplica o push nem reabre uma que já foi lida).
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getDatabase } = require('firebase-admin/database');
const { getStorage } = require('firebase-admin/storage');
const { _listActiveSquads } = require('./weeklyBackup');
const { dataBrasilia, PREFIXO } = require('./completo');

const LIMITE_DIAS = 8;
const dias = (de, ate) => Math.round((Date.parse(ate + 'T00:00:00Z') - Date.parse(de + 'T00:00:00Z')) / 86400000);

async function lerManifesto(bucket, caminho) {
  const f = bucket.file(caminho);
  const [existe] = await f.exists();
  if (!existe) return null;
  try { const [buf] = await f.download(); return JSON.parse(buf.toString('utf8')); } catch (e) { return { _ilegivel: true }; }
}
const itensComErro = (m) => (m.erros || []).map((e) => e.item).join(', ') || 'manifesto ilegível';

// Devolve { problemas:[{codigo,texto}], hoje }. Puro o bastante pra teste (db/bucket injetados).
async function verificar({ db, bucket, agora }) {
  const hoje = dataBrasilia(agora);
  const problemas = [];

  const md = await lerManifesto(bucket, `${PREFIXO}/diario/${hoje}/manifesto.json`);
  if (!md) problemas.push({ codigo: 'diario_ausente', texto: `o backup completo diário de ${hoje} não foi gerado` });
  else if (md._ilegivel || (md.erros || []).length) problemas.push({ codigo: 'diario_erros', texto: `o backup completo diário de ${hoje} teve erro em: ${itensComErro(md)}` });

  const [arqSem] = await bucket.getFiles({ prefix: `${PREFIXO}/semanal/` });
  const datasSem = [...new Set(arqSem.map((f) => f.name).filter((n) => n.endsWith('/manifesto.json')).map((n) => n.split('/')[2]))].sort();
  const ultSem = datasSem[datasSem.length - 1];
  if (!ultSem) problemas.push({ codigo: 'semanal_ausente', texto: 'nenhum backup completo semanal encontrado' });
  else {
    if (dias(ultSem, hoje) > LIMITE_DIAS) problemas.push({ codigo: 'semanal_atrasado', texto: `o último backup completo semanal é de ${ultSem} (${dias(ultSem, hoje)} dias)` });
    const ms = await lerManifesto(bucket, `${PREFIXO}/semanal/${ultSem}/manifesto.json`);
    if (!ms || ms._ilegivel || (ms.erros || []).length) problemas.push({ codigo: 'semanal_erros', texto: `o backup completo semanal de ${ultSem} teve erro em: ${ms ? itensComErro(ms) : 'manifesto ausente'}` });
  }

  // O backup do QUADRO (weeklyBackup): backups/{squad}/{AAAA-MM-DD}.json
  const squads = await _listActiveSquads(db);
  const [arqQuadro] = await bucket.getFiles({ prefix: 'backups/' });
  const ultimoPorSquad = {};
  arqQuadro.forEach((f) => {
    const m = /^backups\/([^/]+)\/(\d{4}-\d{2}-\d{2})\.json$/.exec(f.name);
    if (m && (!ultimoPorSquad[m[1]] || m[2] > ultimoPorSquad[m[1]])) ultimoPorSquad[m[1]] = m[2];
  });
  const atrasados = squads.filter((s) => !ultimoPorSquad[s] || dias(ultimoPorSquad[s], hoje) > LIMITE_DIAS);
  if (atrasados.length) problemas.push({ codigo: 'quadro_atrasado', texto: `sem backup do quadro (weeklyBackup) nos últimos ${LIMITE_DIAS} dias: ${atrasados.join(', ')}` });

  return { problemas, hoje };
}

// Notifica os ADMs (usuarios_publicos com role 'adm' — mesma regra do lembrete de metas pro Digital). Id fixo por dia.
async function alertarAdms({ db, problemas, hoje, agora }) {
  const pubs = (await db.ref('kanban/usuarios_publicos').get()).val() || {};
  const adms = Object.keys(pubs).filter((uid) => pubs[uid] && pubs[uid].role === 'adm');
  const id = `backup_${hoje}`;
  const sub = problemas.map((p) => p.texto).join(' · ').slice(0, 280);
  let enviados = 0;
  for (const uid of adms) {
    const ref = db.ref(`kanban/usuarios/${uid}/notificacoes/${id}`);
    if ((await ref.get()).exists()) continue;     // já avisado hoje (e talvez já lido): não duplica
    await ref.set({ id, type: 'backup_falhou', title: '🛟 Backup com problema', sub, read: false, ts: (agora || new Date()).toISOString() });
    enviados++;
  }
  return { adms: adms.length, enviados };
}

async function rodarVigia({ db, bucket, agora, log }) {
  const say = log || console;
  const { problemas, hoje } = await verificar({ db, bucket, agora });
  if (!problemas.length) { say.log(`[backupVigia] ${hoje}: tudo certo (completo diário/semanal e quadro dos squads).`); return { ok: true, problemas, avisados: 0 }; }
  say.error(`[backupVigia] ${hoje}: ${problemas.length} problema(s):`, problemas.map((p) => p.texto));
  const r = await alertarAdms({ db, problemas, hoje, agora });
  return { ok: false, problemas, avisados: r.enviados };
}

exports.backupVigia = onSchedule(
  { schedule: 'every day 09:00', timeZone: 'America/Sao_Paulo', region: 'us-central1', memory: '256MiB', timeoutSeconds: 120 },
  async () => { await rodarVigia({ db: getDatabase(), bucket: getStorage().bucket() }); }
);
Object.assign(exports, { verificar, alertarAdms, rodarVigia, LIMITE_DIAS });
