// functions/github/__tests__/statusGithub.test.js
//
// 🐙 Testes do monitor de status do GitHub & GitHub Pages (functions/github/statusGithub.js):
//   • parseSummary com componentes reais da Statuspage do GitHub (incluindo Pages e filtro do componente "Visit www.githubstatus.com...")
//   • Incidente em andamento aciona SOMENTE os ADMs (role === 'adm'), nunca membros/PO/convidados, e nunca grava em kanban/comunicados
//   • Degradação silenciosa do componente "Pages" (sem incidente formal na lista) gera incidente sintético e alerta os ADMs
//   • Atualização de status (investigating → identified → monitoring) atualiza o estado sem repetir push/notificação
//   • Resolução do incidente marca fechado em kanban/github_status e zera abertos em kanban/github_saude
//   • Falhas seguidas do endpoint contam em kanban/github_saude e só acionam ADMs ao atingir LIMITE_FALHAS (uma vez por queda)

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { _test: G } = require('../statusGithub');

const AGORA = Date.parse('2026-10-14T18:00:00Z');

const summaryJson = (overrides = {}) => JSON.stringify(Object.assign({
  page: { id: 'kctbh9vrtdwd', name: 'GitHub', url: 'https://www.githubstatus.com' },
  status: { indicator: 'none', description: 'All Systems Operational' },
  components: [
    { id: 'c1', name: 'Git Operations', status: 'operational', updated_at: '2026-10-14T17:00:00Z' },
    { id: 'c2', name: 'API Requests', status: 'operational', updated_at: '2026-10-14T17:00:00Z' },
    { id: 'c3', name: 'Actions', status: 'operational', updated_at: '2026-10-14T17:00:00Z' },
    { id: 'c4', name: 'Pages', status: 'operational', updated_at: '2026-10-14T17:00:00Z', description: 'Frontend application and API servers for Pages builds' },
    { id: 'c5', name: 'Visit www.githubstatus.com for more information', status: 'operational', updated_at: '2026-10-14T17:00:00Z' },
  ],
  incidents: [],
}, overrides));

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
const saude = async (db) => (await db.ref('kanban/github_saude').get()).val();
const resp = (corpo, ok = true, status = 200) => async () => ({ ok, status, text: async () => corpo });

test('parseSummary: extrai status do Pages, filtra componente fantasma da Statuspage e identifica incidente de Pages', () => {
  const p = G.parseSummary(summaryJson({
    status: { indicator: 'major', description: 'Partial System Outage' },
    components: [
      { id: 'c1', name: 'Git Operations', status: 'operational', updated_at: '2026-10-14T17:00:00Z' },
      { id: 'c4', name: 'Pages', status: 'partial_outage', updated_at: '2026-10-14T17:55:00Z' },
      { id: 'c5', name: 'Visit www.githubstatus.com for more information', status: 'major_outage', updated_at: '2026-10-14T17:55:00Z' },
    ],
    incidents: [{
      id: 'inc_pages_1',
      name: 'Incident with GitHub Pages',
      status: 'investigating',
      impact: 'major',
      shortlink: 'https://stspg.io/abc',
      created_at: '2026-10-14T17:50:00Z',
      updated_at: '2026-10-14T17:55:00Z',
      components: [{ name: 'Pages', status: 'partial_outage' }],
      incident_updates: [{ body: 'We are investigating delayed builds and 503 responses on GitHub Pages.' }],
    }],
  }));
  assert.ok(p);
  assert.equal(p.pagesStatus, 'partial_outage');
  assert.equal(p.componentesDegradados.length, 1);
  assert.equal(p.componentesDegradados[0].nome, 'Pages');
  assert.equal(p.incidentes.length, 1);
  assert.equal(p.incidentes[0].pagesAfetado, true);
  assert.equal(p.incidentes[0].link, 'https://www.githubstatus.com'); // stspg.io cai pro fallback seguro SITE
});

test('parseSummary: lixo, HTML de erro ou objeto vazio retorna null', () => {
  assert.equal(G.parseSummary(''), null);
  assert.equal(G.parseSummary('<html>502 Bad Gateway</html>'), null);
  assert.equal(G.parseSummary('{}'), null);
});

test('incidente aberto no GitHub Pages: aciona SOMENTE os ADMs (sino/push) e NUNCA cria Comunicado para todos os usuários', async () => {
  const db = novoDb();
  const body = summaryJson({
    status: { indicator: 'major', description: 'Partial System Outage' },
    components: [
      { id: 'c4', name: 'Pages', status: 'partial_outage', updated_at: '2026-10-14T17:55:00Z' },
    ],
    incidents: [{
      id: 'INC_GH_1',
      name: 'GitHub Pages serving errors',
      status: 'investigating',
      impact: 'major',
      shortlink: 'https://www.githubstatus.com/incidents/INC_GH_1',
      created_at: '2026-10-14T17:50:00Z',
      updated_at: '2026-10-14T17:55:00Z',
      components: [{ name: 'Pages', status: 'partial_outage' }],
      incident_updates: [{ body: 'Users may experience 502 errors when loading GitHub Pages sites.' }],
    }],
  });

  const r = await G.executar({ db, fetchImpl: resp(body), agora: AGORA });
  assert.deepEqual([r.criados, r.notificados], [1, 2]); // adm1 e adm2

  // Nenhum comunicado global criado
  assert.equal((await db.ref('kanban/comunicados').get()).val(), null);

  // Usuários comuns, POs, convidados e visualizadores NÃO recebem nada
  for (const uid of ['ana', 'bia', 'ext', 'vis']) {
    assert.equal((await notifs(db, uid)).length, 0, `${uid} não deve receber notificação`);
  }

  // ADMs recebem a notificação com destaque de GitHub Pages e link para a aba status do Painel
  for (const uid of ['adm1', 'adm2']) {
    const n = await notifs(db, uid);
    assert.equal(n.length, 1);
    assert.equal(n[0].type, 'github_incidente');
    assert.equal(n[0].link, 'status');
    assert.equal(n[0].okrObjId, 'pages');
    assert.match(n[0].title, /^🚨 GitHub Pages: GitHub Pages serving errors/);
    assert.match(n[0].sub, /Afeta o GitHub Pages/);
  }

  // Saúde gravada para o Painel
  const s = await saude(db);
  assert.equal(s.ok, true);
  assert.equal(s.pagesStatus, 'partial_outage');
  assert.equal(s.pagesAfetado, true);
  assert.equal(s.abertos, 1);

  // 2º tick (mesmo incidente atualizado para monitoring): atualiza o estado sem reenviar push aos ADMs
  const body2 = summaryJson({
    status: { indicator: 'minor', description: 'Minor Service Outage' },
    components: [{ id: 'c4', name: 'Pages', status: 'degraded_performance', updated_at: '2026-10-14T18:05:00Z' }],
    incidents: [{
      id: 'INC_GH_1',
      name: 'GitHub Pages serving errors',
      status: 'monitoring',
      impact: 'minor',
      shortlink: 'https://www.githubstatus.com/incidents/INC_GH_1',
      created_at: '2026-10-14T17:50:00Z',
      updated_at: '2026-10-14T18:05:00Z',
      components: [{ name: 'Pages', status: 'degraded_performance' }],
      incident_updates: [{ body: 'Mitigation applied, monitoring recovery.' }],
    }],
  });
  const r2 = await G.executar({ db, fetchImpl: resp(body2), agora: AGORA + 300000 });
  assert.deepEqual([r2.criados, r2.atualizados, r2.notificados], [0, 1, 0]);
  assert.equal((await notifs(db, 'adm1')).length, 1);

  // 3º tick (incidente resolvido / removido da lista ativa): fecha no banco e limpa abertos
  const r3 = await G.executar({ db, fetchImpl: resp(summaryJson()), agora: AGORA + 600000 });
  assert.equal(r3.fechados, 1);
  const s3 = await saude(db);
  assert.equal(s3.abertos, 0);
  assert.equal(s3.pagesStatus, 'operational');
  assert.equal(s3.pagesAfetado, false);
});

test('degradação silenciosa do componente Pages (sem incidente na lista incidents): cria incidente sintético e alerta os ADMs', async () => {
  const db = novoDb();
  const body = summaryJson({
    status: { indicator: 'minor', description: 'Minor Service Outage' },
    components: [
      { id: 'c4', name: 'Pages', status: 'degraded_performance', updated_at: '2026-10-14T17:58:00Z' },
    ],
    incidents: [],
  });
  const r = await G.executar({ db, fetchImpl: resp(body), agora: AGORA });
  assert.equal(r.notificados, 2);
  const nAdm = await notifs(db, 'adm1');
  assert.equal(nAdm.length, 1);
  assert.match(nAdm[0].title, /^🚨 GitHub Pages:/);
  assert.equal((await notifs(db, 'ana')).length, 0);
});

test('falhas seguidas do endpoint: conta em kanban/github_saude e avisa só os ADMs ao atingir LIMITE_FALHAS', async () => {
  const db = novoDb();
  await G.executar({ db, fetchImpl: resp(summaryJson()), agora: AGORA });
  for (let i = 1; i < G.LIMITE_FALHAS; i++) {
    await assert.rejects(() => G.executar({ db, fetchImpl: resp('', false, 503), agora: AGORA + i * 300000 }), /HTTP 503/);
    assert.equal((await notifs(db, 'adm1')).length, 0);
  }
  await assert.rejects(() => G.executar({ db, fetchImpl: resp('', false, 503), agora: AGORA + G.LIMITE_FALHAS * 300000 }), /HTTP 503/);
  const nAdm = await notifs(db, 'adm1');
  assert.equal(nAdm.length, 1);
  assert.equal(nAdm[0].type, 'github_monitor_falhou');
  assert.equal((await notifs(db, 'ana')).length, 0);
});
