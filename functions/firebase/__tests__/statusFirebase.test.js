// functions/firebase/__tests__/statusFirebase.test.js
//
// 🔥 Testes do monitor de status do Firebase focado nos 6 serviços usados (functions/firebase/statusFirebase.js):
//   • Ignora incidentes de serviços que não usamos (Crashlytics, Test Lab, AdMob, Remote Config, Analytics, etc.)
//   • Detecta incidentes em Realtime Database, Authentication, Cloud Messaging, Cloud Functions, Cloud Storage e Hosting
//   • Aciona SOMENTE os ADMs (role === 'adm'), nunca usuários comuns/PO/convidados, e nunca grava em kanban/comunicados
//   • Destaca Realtime Database com 🚨 quando afetado e atualiza kanban/firebase_saude
//   • Fecha incidentes quando `end` é preenchido ou `most_recent_update.status === 'AVAILABLE'`
//   • Falhas seguidas do endpoint contam em kanban/firebase_saude e só acionam ADMs ao atingir LIMITE_FALHAS

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { _test: F } = require('../statusFirebase');

const AGORA = Date.parse('2026-10-14T20:00:00Z');

const pubs = () => ({
  ana: { role: 'membro' },
  bia: { role: 'po' },
  adm1: { role: 'adm' },
  adm2: { role: 'adm' },
  ext: { role: 'convidado' },
  vis: { role: 'visualizador' },
});
const novoDb = (extra) => makeFakeDb({ kanban: Object.assign({ usuarios_publicos: pubs() }, extra || {}) });
const notifs = async (db, uid) => Object.values((await db.ref(`kanban/usuarios/${uid}/notificacoes`).get()).val() || {});
const saude = async (db) => (await db.ref('kanban/firebase_saude').get()).val();
const resp = (corpo, ok = true, status = 200) => async () => ({ ok, status, text: async () => corpo });

test('identificarServicosUsados e parseIncidents: filtra apenas os 6 serviços usados e ignora Crashlytics/AdMob/Remote Config', () => {
  const feed = JSON.stringify([
    {
      id: 'inc_crash_1',
      service_name: 'Crashlytics',
      external_desc: 'Delays in Crashlytics issue reporting',
      begin: '2026-10-14T19:00:00Z',
      status_impact: 'SERVICE_OUTAGE',
      severity: 'high',
      uri: 'incidents/inc_crash_1',
      most_recent_update: { status: 'SERVICE_OUTAGE', text: 'Investigating Crashlytics.', when: '2026-10-14T19:30:00Z' },
    },
    {
      id: 'inc_rtdb_1',
      service_name: 'Realtime Database',
      external_desc: 'Elevated latency in us-central1 Realtime Database instances',
      begin: '2026-10-14T19:10:00Z',
      status_impact: 'SERVICE_DISRUPTION',
      severity: 'medium',
      uri: 'incidents/inc_rtdb_1',
      most_recent_update: { status: 'SERVICE_DISRUPTION', text: 'Engineers are mitigating connection spikes.', when: '2026-10-14T19:45:00Z' },
    },
  ]);

  const p = F.parseIncidents(feed, AGORA);
  assert.ok(p);
  assert.equal(p.incidentes.length, 1, 'Crashlytics deve ser ignorado');
  assert.equal(p.incidentes[0].id, 'inc_rtdb_1');
  assert.equal(p.rtdbStatus, 'partial_outage');
  assert.equal(p.rtdbAfetado, true);
  assert.equal(p.servicosDegradados.length, 1);
  assert.equal(p.servicosDegradados[0].key, 'Realtime Database');
  assert.equal(p.servicos['Authentication'].status, 'operational');
});

test('incidente apenas em serviços que NÃO usamos: não notifica ninguém e mantém os 6 serviços como operacionais', async () => {
  const db = novoDb();
  const feed = JSON.stringify([
    {
      id: 'inc_testlab',
      service_name: 'Test Lab',
      external_desc: 'Test Lab device provisioning failures',
      begin: '2026-10-14T19:00:00Z',
      status_impact: 'SERVICE_OUTAGE',
      severity: 'high',
      most_recent_update: { status: 'SERVICE_OUTAGE', text: 'Outage in Test Lab.', when: '2026-10-14T19:30:00Z' },
    },
  ]);
  const r = await F.executar({ db, fetchImpl: resp(feed), agora: AGORA });
  assert.equal(r.notificados, 0);
  assert.equal((await notifs(db, 'adm1')).length, 0);
  const s = await saude(db);
  assert.equal(s.ok, true);
  assert.equal(s.abertos, 0);
  assert.equal(s.rtdbStatus, 'operational');
});

test('incidente aberto em serviço que usamos (Realtime Database / Authentication): aciona SOMENTE os ADMs e fecha ao resolver', async () => {
  const db = novoDb();
  const feedAberto = JSON.stringify([
    {
      id: 'FB_RTDB_99',
      service_name: 'Realtime Database',
      external_desc: 'Connection drops in Realtime Database',
      begin: '2026-10-14T19:20:00Z',
      status_impact: 'SERVICE_OUTAGE',
      severity: 'high',
      uri: 'incidents/FB_RTDB_99',
      most_recent_update: { status: 'SERVICE_OUTAGE', text: 'We are investigating connection resets.', when: '2026-10-14T19:35:00Z' },
    },
  ]);

  const r1 = await F.executar({ db, fetchImpl: resp(feedAberto), agora: AGORA });
  assert.deepEqual([r1.criados, r1.notificados], [1, 2]); // adm1 e adm2

  // Nenhum comunicado global criado
  assert.equal((await db.ref('kanban/comunicados').get()).val(), null);

  // Usuários comuns, PO, convidado e visualizador NÃO recebem nada
  for (const uid of ['ana', 'bia', 'ext', 'vis']) {
    assert.equal((await notifs(db, uid)).length, 0);
  }

  // ADMs recebem a notificação com destaque pro Realtime Database
  for (const uid of ['adm1', 'adm2']) {
    const n = await notifs(db, uid);
    assert.equal(n.length, 1);
    assert.equal(n[0].type, 'firebase_incidente');
    assert.equal(n[0].link, 'status');
    assert.equal(n[0].okrObjId, 'rtdb');
    assert.match(n[0].title, /^🚨 Firebase Realtime Database: Connection drops/);
    assert.equal(n[0].firebaseUrl, 'https://status.firebase.google.com/incidents/FB_RTDB_99');
  }

  // 2º tick com incidente ainda aberto: atualiza sem duplicar notificação
  const r2 = await F.executar({ db, fetchImpl: resp(feedAberto), agora: AGORA + 300000 });
  assert.deepEqual([r2.criados, r2.atualizados, r2.notificados], [0, 1, 0]);
  assert.equal((await notifs(db, 'adm1')).length, 1);

  // 3º tick com `end` preenchido (resolvido): fecha e restaura status operational
  const feedResolvido = JSON.stringify([
    {
      id: 'FB_RTDB_99',
      service_name: 'Realtime Database',
      external_desc: 'Connection drops in Realtime Database',
      begin: '2026-10-14T19:20:00Z',
      end: '2026-10-14T20:08:00Z',
      status_impact: 'SERVICE_OUTAGE',
      severity: 'high',
      uri: 'incidents/FB_RTDB_99',
      most_recent_update: { status: 'AVAILABLE', text: 'The issue has been resolved.', when: '2026-10-14T20:08:00Z' },
    },
  ]);
  const r3 = await F.executar({ db, fetchImpl: resp(feedResolvido), agora: AGORA + 600000 });
  assert.equal(r3.fechados, 1);
  const s3 = await saude(db);
  assert.equal(s3.abertos, 0);
  assert.equal(s3.rtdbStatus, 'operational');
  assert.equal(s3.rtdbAfetado, false);
});

test('falhas seguidas do endpoint do Firebase: só avisa os ADMs ao atingir LIMITE_FALHAS', async () => {
  const db = novoDb();
  await F.executar({ db, fetchImpl: resp('[]'), agora: AGORA });
  for (let i = 1; i < F.LIMITE_FALHAS; i++) {
    await assert.rejects(() => F.executar({ db, fetchImpl: resp('', false, 502), agora: AGORA + i * 300000 }), /HTTP 502/);
    assert.equal((await notifs(db, 'adm1')).length, 0);
  }
  await assert.rejects(() => F.executar({ db, fetchImpl: resp('', false, 502), agora: AGORA + F.LIMITE_FALHAS * 300000 }), /HTTP 502/);
  const nAdm = await notifs(db, 'adm1');
  assert.equal(nAdm.length, 1);
  assert.equal(nAdm[0].type, 'firebase_monitor_falhou');
  assert.equal((await notifs(db, 'ana')).length, 0);
});
