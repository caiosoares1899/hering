// functions/backup/weeklyBackup.js
//
// Backup automático (DIÁRIO desde 2026-10-28; nasceu semanal — por isso o nome `weeklyBackup`, mantido de propósito: renomear a função
// criaria outra no Firebase e deixaria a antiga agendada) de cada squad pro Cloud Storage — roda sozinho,
// sem depender de ninguém abrir o kanban-dev.html (o backup existente,
// saveSnapshotToFirebase() em kanban-dev.html, só grava quando alguém
// clica "Baixar JSON agora" ou quando o board fica aberto 7+ dias sem
// backup e o e-mail automático está configurado — ou seja, na prática,
// pode passar semanas sem rodar se ninguém mexer no board).
//
// Formato do JSON salvo é o MESMO que buildBackupPayload()/exportBackupJSON()
// produzem em kanban-dev.html ({version, squad, exportedAt, exportedBy,
// board: {cards, columns, tags, ...}}) — de propósito, pra um backup daqui
// poder ser restaurado direto pela UI "🧯 Restaurar backup" do board, sem
// precisar de conversão nenhuma.
//
// Cadência DIÁRIA (04:00 de Brasília, 2026-10-28): na Black Friday o intervalo de até 7 dias entre backups deixou cards criados no meio da
// semana sem nenhuma cópia (ver BUGS_E_CORRECOES.md, 2026-10-28). O custo continua pequeno — 1 invocação/dia (~30/mês, free tier do
// Cloud Scheduler/Functions) e alguns MB por squad no Storage (ver a retenção abaixo).
//
// Retenção: NÃO apaga nada aqui dentro — reaproveita o mesmo mecanismo de
// storage-lifecycle.json: a regra do prefixo backups/ apaga com 60 dias (≈60 arquivos por squad com a cadência diária).
// Region de vida no bucket, não na function; mais simples que reimplementar poda manual.
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getDatabase } = require('firebase-admin/database');
const { getStorage } = require('firebase-admin/storage');

// Squads fixos de produção — espelha SQUAD_META_DEFAULT em kanban-dev.html.
// Squads extras criados pelo painel (kanban/squads_meta) entram sozinhos via
// listActiveSquads(); só esses 3 aqui precisam ser mantidos em sincronia à
// mão se um dia mudarem no client.
const DEFAULT_SQUADS = ['dados', 'prf', 'midiacriativa'];

// 'dev' e 'omnichannel' são squads fictícios de teste (só existem em
// kanban-dev.html) — nunca deveriam ganhar backup automático de produção.
const SQUADS_IGNORADOS = new Set(['dev', 'omnichannel']);

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

async function listActiveSquads(db) {
  const metaSnap = await db.ref('kanban/squads_meta').get();
  const meta = metaSnap.val() || {};
  const custom = Object.keys(meta).filter((id) => !SQUADS_IGNORADOS.has(id));
  return Array.from(new Set([...DEFAULT_SQUADS, ...custom]));
}

// Mesma normalização que o client (kanban.html) já aplica em toda leitura de
// '/columns'/'/cards'/'/tags' (Array.isArray?val:Object.values(val), depois
// filter(Boolean)) — o Admin SDK devolve o node cru, sem essa limpeza. Sem
// isso, achado real 2026-08-28 (squad midiacriativa, /monitorarbugs): um
// node sparse virava objeto no snapshot, e uma entrada nula sobrevivia até
// o JSON do backup — restaurar esse backup (_applyRestorePayload em
// kanban.html) propagava o dado sujo pro estado ao vivo, travando qualquer
// render que lesse `col.name`/`col.id` (renderNormal/renderColEditor).
function _cleanArr(val) {
  if (!val) return [];
  return (Array.isArray(val) ? val : Object.values(val)).filter(Boolean);
}

async function backupSquad(db, bucket, squadId, date) {
  const snap = await db.ref('kanban/squads/' + squadId + '/dados').get();
  const dados = snap.val() || {};
  const payload = {
    version: 'cloud-backup',
    squad: squadId,
    exportedAt: new Date().toISOString(),
    exportedBy: 'Backup automático diário (Cloud Function)',
    board: {
      cards: _cleanArr(dados.cards),
      columns: _cleanArr(dados.columns),
      tags: _cleanArr(dados.tags),
      agilCfg: dados.agil_cfg || {},
      qlItems: dados.ql_items || { recorrentes: [], modelos: [], agendamentos: [] },
      links: dados.links || [],
      calEvents: dados.cal_events || [],
      autoRules: dados.auto_rules || [],
    },
  };
  const file = bucket.file(`backups/${squadId}/${date}.json`);
  await file.save(JSON.stringify(payload), { contentType: 'application/json', resumable: false });
  return (payload.board.cards || []).filter((c) => c && !c.archived).length;
}

// Reaproveitado por backup/completo.js (mesma lista de squads de produção) — não é uma Cloud Function.
exports._listActiveSquads = listActiveSquads;

// Roda o backup do quadro de TODOS os squads (um de cada vez, pra não somar memória). `db`/`bucket` injetados (os testes passam fakes).
// Antes (até 2026-10-20) o laço engolia o erro de cada squad e a função "terminava bem" mesmo faltando squads — e com 256 MiB / 120 s ela morria
// (estouro de memória ou de tempo) no meio da lista: os squads pequenos e os 3 fixos salvavam, `outlet-crm` (~15 MB de `dados`) e o que vinha depois
// (`site`) ficavam sem backup do quadro, e só o vigia (backupVigia) percebeu. Agora: mais memória/tempo (abaixo) e, se algum squad falhar, a execução
// termina COM ERRO depois de tentar todos (o que deu certo já foi salvo), aparecendo como falha no Cloud Scheduler.
async function rodarWeeklyBackup({ db, bucket, date, log } = {}) {
  const say = log || console;
  const dia = date || todayStr();
  const squads = await listActiveSquads(db);
  const salvos = [];
  const falhas = [];
  for (const squadId of squads) {
    const t0 = Date.now();
    try {
      const n = await backupSquad(db, bucket, squadId, dia);
      salvos.push(squadId);
      say.log(`[weeklyBackup] ${squadId}: ${n} cards ativos salvos em backups/${squadId}/${dia}.json (${Math.round((Date.now() - t0) / 1000)} s)`);
    } catch (e) {
      falhas.push({ squad: squadId, erro: String((e && e.message) || e) });
      say.error(`[weeklyBackup] ${squadId} falhou:`, e);
    }
  }
  if (falhas.length) throw new Error(`weeklyBackup: ${falhas.length} squad(s) falharam: ${falhas.map((f) => f.squad).join(', ')}`);
  return { salvos, falhas };
}
exports.rodarWeeklyBackup = rodarWeeklyBackup;

exports.weeklyBackup = onSchedule(
  { schedule: 'every day 04:00', timeZone: 'America/Sao_Paulo', region: 'us-central1', memory: '1GiB', timeoutSeconds: 540 },
  async () => { await rodarWeeklyBackup({ db: getDatabase(), bucket: getStorage().bucket() }); }
);
