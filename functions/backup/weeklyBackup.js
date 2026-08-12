// functions/backup/weeklyBackup.js
//
// Backup semanal automático de cada squad pro Cloud Storage — roda sozinho,
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
// Cadência semanal (não diária, não por-minuto): ver o comentário em
// functions/index.js sobre spotifySync ter sido pausado por rodar 24h/dia
// — esse aqui roda ~4-5x/mês, ordens de grandeza mais barato, fica bem
// dentro do free tier tanto do Cloud Scheduler quanto de invocações de
// Cloud Functions.
//
// Retenção: NÃO apaga nada aqui dentro — reaproveita o mesmo mecanismo de
// storage-lifecycle.json (ver README.md "Retenção dos relatórios"),
// adicionando uma regra pro prefixo backups/. Region de vida no bucket,
// não na function; mais simples que reimplementar poda manual.
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

async function backupSquad(db, bucket, squadId, date) {
  const snap = await db.ref('kanban/squads/' + squadId + '/dados').get();
  const dados = snap.val() || {};
  const payload = {
    version: 'cloud-backup',
    squad: squadId,
    exportedAt: new Date().toISOString(),
    exportedBy: 'Backup automático semanal (Cloud Function)',
    board: {
      cards: dados.cards || [],
      columns: dados.columns || [],
      tags: dados.tags || [],
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

exports.weeklyBackup = onSchedule(
  { schedule: 'every sunday 04:00', timeZone: 'America/Sao_Paulo', region: 'us-central1', timeoutSeconds: 120 },
  async () => {
    const db = getDatabase();
    const bucket = getStorage().bucket();
    const date = todayStr();
    const squads = await listActiveSquads(db);
    for (const squadId of squads) {
      try {
        const n = await backupSquad(db, bucket, squadId, date);
        console.log(`[weeklyBackup] ${squadId}: ${n} cards ativos salvos em backups/${squadId}/${date}.json`);
      } catch (e) {
        console.error(`[weeklyBackup] ${squadId} falhou:`, e);
      }
    }
  }
);
