const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');

const AGORA = Date.parse('2026-11-06T15:00:00Z');
const iso = dias => new Date(AGORA - dias * 86400000).toISOString();
const columns = [
  { id: 'backlog', name: 'Backlog' }, { id: 'progress', name: 'Em Progresso' },
  { id: 'review', name: 'Revisão', wip: 2 }, { id: 'blocker', name: 'Impedimentos' }, { id: 'done', name: 'Concluído' },
];
function board() {
  return { columns, agil_cfg: { wip: '2' }, config: { blockerMode: 'tag' }, flow_baseline: { at: iso(90) }, cards: [
    // 4 conclusões: cycle = [2,4,8,16], lead = [3,6,10,20].
    { id: 'd1', title: 'Entrega 1', col: 'done', sp: '3', createdAt: iso(4), flow: { firstStartAt: iso(3), doneAt: iso(1) }, pausedMs: 86400000 },
    { id: 'd2', title: 'Entrega 2', col: 'done', sp: 2, createdAt: iso(16), flow: { firstStartAt: iso(14), doneAt: iso(10) } },
    { id: 'd3', col: 'done', createdAt: iso(30), flow: { firstStartAt: iso(28), doneAt: iso(20) } },
    { id: 'd4', col: 'done', createdAt: iso(60), flow: { firstStartAt: iso(56), doneAt: iso(40) } },
    { id: 'p1', title: 'Mais antigo', col: 'progress', due: '2026-11-05', createdAt: iso(50), flow: { firstStartAt: iso(18) }, updatedAt: iso(0) },
    { id: 'p2', title: 'Outro', col: 'progress', due: '2026-11-08', createdAt: iso(10), flow: { enteredAt: { progress: iso(5), review: iso(4), bad: 'inválida' } } },
    { id: 'r1', title: 'Bloqueado por tag', col: 'review', blocker: true, due: '2026-11-06', createdAt: iso(2) },
    { id: 'b1', title: 'Coluna blocker', col: 'blocker', createdAt: iso(1) },
    { id: 'f1', title: 'Fila muito velha', col: 'backlog', createdAt: iso(100), due: '2026-11-01' },
    { id: 'a1', title: 'Arquivado', col: 'done', archived: true, flow: { firstStartAt: iso(1), doneAt: iso(0) } },
  ] };
}
function seed() {
  const b = board();
  return { kanban: { squads_meta: { extra: { label: 'Extra', wipLimit: 5 }, invisivel: {}, 'evil/path': { label: 'Não' } },
    squads: { dev: { dados: b }, dados: { dados: board() }, extra: { dados: { cards: [] } } },
    campanhas: { p: { titulo: 'Produção' } }, campanhas_dev: { d: { titulo: 'Dev' } },
    github_saude: { ok: true, abertos: 2, pagesStatus: 'operational', verificadoEm: iso(0) },
    firebase_saude: { ok: false, abertos: 1, rtdbStatus: 'degraded_performance', verificadoEm: iso(0) },
    cards_guardiao: { _status: { ts: iso(0), ok: true, abertosTotal: 4, atrasoMaxMin: 2 }, dados: {
      incidentes: {
        r1: { cardId: 'x', acao: 'restaurado', detectadoEm: iso(1) },
        r2: { cardId: 'x', acao: 'restaurado', detectadoEm: iso(2) }, // episódios distintos
        a1: { cardId: 'y', acao: 'sem_espelho', detectadoEm: iso(1) },
        a2: { cardId: 'z', acao: 'em_massa', detectadoEm: iso(2) },
        a3: { cardId: 'w', acao: 'desconhecida', detectadoEm: iso(3) },
        velho: { cardId: 'old', acao: 'sem_espelho', detectadoEm: iso(31) },
        semCard: { acao: 'em_massa', detectadoEm: iso(1) },
      }, resolvidos: { a2: { por: 'Pessoa sintética', uid: 'sintetico', em: iso(0) }, alarme_fora: { uid: 'sintetico' } },
    } },
  } };
}
function somenteLeitura(dados) {
  const db = makeFakeDb(dados), lidos = [], mutacoes = [];
  return { lidos, mutacoes, ref(p) {
    lidos.push(p);
    assert.doesNotMatch(p, /usuarios|feedback|painel_viewers|cards_espelho|gcal|backup/);
    const r = db.ref(p);
    for (const m of ['set', 'update', 'push', 'remove', 'transaction']) r[m] = () => { mutacoes.push(m); throw new Error('ESCRITA PROIBIDA'); };
    return r;
  } };
}
async function chamar(nome, input = {}, dados = seed(), env = 'dev') {
  const { buildPainelTools } = require('../painel/ferramentas');
  const db = somenteLeitura(dados), now = Date.now;
  Date.now = () => AGORA;
  try {
    const tools = buildPainelTools({ db, env, papel: 'membro' });
    for (const t of tools) { assert.ok(t.description); assert.equal(t.input_schema.type, 'object'); }
    const res = await tools.find(t => t.name === nome).handler(input);
    assert.deepEqual(db.mutacoes, []);
    return { res, lidos: db.lidos };
  } finally { Date.now = now; }
}

for (const env of ['dev', 'prod']) {
  const squad = env === 'dev' ? 'dev' : 'dados';
  test(`painel_visao golden fixo, ${env}`, async () => {
    const { res } = await chamar('painel_visao', { squad }, seed(), env);
    assert.deepEqual(res.squads, [{ squad, ativos: 9, wip: 2, limite_wip: 2, entregues: 4, pontos_entregues: 5, bloqueados: 1, colunas_total: 5,
      colunas: [
        { coluna: 'Backlog', atual: 1, percentual: 11, limite_wip: null },
        { coluna: 'Em Progresso', atual: 2, percentual: 22, limite_wip: 2 },
        { coluna: 'Revisão', atual: 1, percentual: 11, limite_wip: 2 },
        { coluna: 'Impedimentos', atual: 1, percentual: 11, limite_wip: null },
        { coluna: 'Concluído', atual: 4, percentual: 44, limite_wip: null },
      ], prazos: { vencidos: 2, vence_hoje: 1, vencendo: 2 } }]);
  });
  test(`painel_fluxo golden fixo, ${env}`, async () => {
    const { res: f } = await chamar('painel_fluxo', { squad, dias: 14 }, seed(), env);
    assert.deepEqual(f.cycle_time, { mediana_dias: 4, p85_dias: 16, amostra: 4 });
    assert.deepEqual(f.lead_time, { mediana_dias: 6, p85_dias: 20, amostra: 4 });
    assert.deepEqual(f.vazao, { entregues: 2, por_semana: 1, comparacao: { atual: 1, anterior: 0.5, referencia: 'período anterior', texto: 'subiu de 0,5 para 1,0 cards por semana' } });
    assert.deepEqual(f.throughput14_por_squad, [{ squad, entregues: 2 }]);
    assert.deepEqual(f.wip, { em_andamento: 4, na_fila: 1, limite_dias: 16, acima_limite: 1,
      parado_ha_mais_tempo: { squad, titulo: 'Mais antigo', coluna: 'Em Progresso', idade_dias: 18, bloqueado: false, alerta: true }, itens: [
        { squad, titulo: 'Mais antigo', coluna: 'Em Progresso', idade_dias: 18, bloqueado: false, alerta: true },
        { squad, titulo: 'Outro', coluna: 'Em Progresso', idade_dias: 5, bloqueado: false, alerta: false },
        { squad, titulo: 'Bloqueado por tag', coluna: 'Revisão', idade_dias: 2, bloqueado: true, alerta: false },
        { squad, titulo: 'Coluna blocker', coluna: 'Impedimentos', idade_dias: 1, bloqueado: false, alerta: false },
      ] });
  });
  test(`painel_status golden Guardião e estimativa, ${env}`, async () => {
    const dados = seed();
    dados.kanban.squads.dados.dados.cards_incidentes_sumico = {
      socorrido: { cardId: 'x', detectadoEm: iso(1) }, fora: { cardId: 'alarme', detectadoEm: iso(1) },
      aberto: { cardId: 'outro', detectadoEm: iso(1) },
    };
    const { res: s, lidos } = await chamar('painel_status', {}, dados, env);
    assert.deepEqual(s.guardiao, { abertos: 3, resolvidos: 2, restaurados: 2, _status: { ok: true, texto: 'Guardião ativo · pulso há 0 min', ts: '2026-11-06T15:00:00.000Z', pulso_min: 0, atraso_max_min: 2, abertos_7dias: 4 } });
    assert.equal(s.peso.saude, 'Saudável');
    assert.equal(s.peso.cards, 10); // peso inclui arquivado
    const prefix = env === 'dev' ? 'kanban/campanhas_dev' : 'kanban/campanhas';
    assert.ok(lidos.includes(prefix));
    assert.ok(!lidos.includes(env === 'dev' ? 'kanban/campanhas' : 'kanban/campanhas_dev'));
    assert.equal(s.peso.campanhas_bytes, env === 'dev' ? 22 : 29); // JSON UTF-8 contado à mão
    for (const k of ['latencia', 'online', 'github_ao_vivo', 'firebase_ao_vivo']) assert.equal(s[k].disponivel, false);
    assert.equal(s.github_vigia.abertos, 2);
    assert.equal(s.firebase_vigia.ok, false);
  });
}

test('lista fechada acompanha exatamente os squads de cada ambiente', async () => {
  const dev = await chamar('painel_visao');
  assert.deepEqual(dev.res.squads.map(s => s.squad), ['dev', 'omnichannel']);
  const prod = await chamar('painel_visao', {}, seed(), 'prod');
  assert.deepEqual(prod.res.squads.map(s => s.squad), ['dados', 'prf', 'midiacriativa', 'extra']);
  await assert.rejects(chamar('painel_visao', { squad: 'extra' }));
  await assert.rejects(chamar('painel_visao', { squad: 'invisivel' }, seed(), 'prod'));
});
test('zod rejeita entradas antes de ler um caminho de squad', async () => {
  const { buildPainelTools } = require('../painel/ferramentas');
  const db = somenteLeitura(seed()), ts = buildPainelTools({ db, env: 'dev', papel: 'adm' });
  for (const input of [{ squad: '../usuarios' }, { squad: 'dados' }, { squad: 'nao-existe' }, { squad: 2 }, { extra: true }]) await assert.rejects(ts[0].handler(input));
  for (const dias of [0, 1, 8, 31, '14', null]) await assert.rejects(ts[1].handler({ dias }));
  await assert.rejects(ts[2].handler({ squad: 'dev' }));
  assert.ok(db.lidos.every(p => p === 'kanban/squads_meta'));
});
test('só leitura e sem PII mesmo com campos hostis, listas limitadas', async () => {
  const dados = seed();
  const b = dados.kanban.squads.dev.dados;
  b.cards = Array.from({ length: 35 }, (_, i) => ({ id: 'sintetico-' + i, title: i === 0 ? 'mail@invalid.test uid token 11999999999' : 'X'.repeat(150), owner: 'Pessoa sintética', uid: 'segredo', token: 'nao-retornar', col: 'progress', createdAt: iso(30 + i) }));
  b.columns = Array.from({ length: 25 }, (_, i) => ({ id: i === 0 ? 'progress' : 'col' + i, name: 'mail@invalid.test token uid' }));
  for (const [nome, input] of [['painel_visao', {}], ['painel_fluxo', { dias: 14 }], ['painel_status', {}]]) {
    const { res } = await chamar(nome, input, dados);
    assert.doesNotMatch(JSON.stringify(res), /@|uid|token/i);
    function limites(v) {
      if (Array.isArray(v)) { assert.ok(v.length <= 20); v.forEach(limites); }
      else if (v && typeof v === 'object') { if (v.titulo) assert.ok(v.titulo.length <= 80); Object.values(v).forEach(limites); }
    }
    limites(res);
  }
});
test('baseline, conclusão customizada, fallback de datas e pausas seguem Painel', async () => {
  const dados = seed(), b = dados.kanban.squads.dev.dados;
  b.columns = [{ id: 'fila', name: 'Fila' }, { id: 'exec', name: 'Execução' }, { id: 'fim', name: 'Finalizado' }];
  b.flow_baseline = { at: iso(14) };
  b.cards = [
    { col: 'fim', createdAt: '2026-11-01', doneAt: '2026-11-03T15:00:00Z', pausedMs: 9999999999 },
    { col: 'fim', createdAt: iso(40), doneAt: iso(20) },
    { col: 'exec', createdAt: iso(15), paused: true },
    { col: 'fila', blocker: true, createdAt: iso(2) }, // modo tag sai da fila
  ];
  const { res } = await chamar('painel_fluxo', { squad: 'dev', dias: 7 }, dados);
  assert.deepEqual(res.cycle_time, { mediana_dias: 2, p85_dias: 2, amostra: 1 });
  assert.equal(res.wip.em_andamento, 2);
  assert.equal(res.wip.acima_limite, 1); // idade == limite não passa
});
test('janelas aceitas, meia-noite civil e futuros reproduzem a tela', async () => {
  const dados = seed(), b = dados.kanban.squads.dev.dados;
  b.cards = [
    { col: 'done', flow: { firstStartAt: iso(30), doneAt: '2026-10-24T03:00:00Z' } },
    { col: 'done', flow: { firstStartAt: iso(30), doneAt: '2026-10-24T02:59:59Z' } },
    { col: 'done', flow: { firstStartAt: iso(30), doneAt: iso(-1) } },
  ];
  for (const [dias, esperado] of [[7, 1], [14, 2], [15, 3], [30, 3]]) {
    const { res } = await chamar('painel_fluxo', { squad: 'dev', dias }, dados);
    assert.equal(res.vazao.entregues, esperado);
  }
});
test('Guardião usa arredondamento de pulso, não regra do Mini painel', async () => {
  const dados = seed(); dados.kanban.cards_guardiao._status.ts = new Date(AGORA - 14.5 * 60000).toISOString();
  const { res } = await chamar('painel_status', {}, dados);
  assert.equal(res.guardiao._status.ok, false);
  assert.equal(res.guardiao._status.pulso_min, 15);
  delete dados.kanban.cards_guardiao._status;
  assert.equal((await chamar('painel_status', {}, dados)).res.guardiao._status.ok, null);
});
test('erro de leitura rejeita, não inventa zero saudável', async () => {
  const { buildPainelTools } = require('../painel/ferramentas');
  const db = { ref: () => ({ get: async () => { throw new Error('offline'); } }) };
  for (const t of buildPainelTools({ db, env: 'dev' })) await assert.rejects(t.handler(t.name === 'painel_fluxo' ? { dias: 14 } : {}), /offline/);
});

// Executa o código REAL do HTML em DOM mínimo, sem depender de cópia das fórmulas.
function funcReal(html, nome) {
  const re = new RegExp('(?:async )?function ' + nome + '\\('), m = re.exec(html);
  assert.ok(m, 'Função real existe: ' + nome);
  const fim = html.indexOf('\n}', m.index);
  return html.slice(m.index, fim + 2);
}
function contextoTela(dados, env) {
  const html = fs.readFileSync(path.join(__dirname, '../../../painel-dev.html'), 'utf8');
  const els = new Map();
  const el = () => ({ innerHTML: '', textContent: '', style: {}, children: [], appendChild(v) { this.children.push(v); } });
  const document = { getElementById(id) { if (!els.has(id)) els.set(id, el()); return els.get(id); }, createElement: el };
  class Relogio extends Date { constructor(...args) { super(...(args.length ? args : [AGORA])); } static now() { return AGORA; } }
  const ids = env === 'dev' ? ['dev', 'omnichannel'] : ['dados', 'prf', 'midiacriativa', 'extra'];
  const db = somenteLeitura(dados);
  const ctx = vm.createContext({ Date: Relogio, Blob, console, document, performance: { now: () => 0 },
    window: { _db: {}, _ref: (db, p) => p, _get: p => db.ref(p).get() },
    SQUADS: ids.map(id => ({ id, label: id, icon: '', wipLimit: 3 })), squadData: {}, DAY_MS: 86400000, FLOW_WINDOW: 14, doneInWindow: [],
    squadVisible: () => true, isColVisible: () => true, squadBoardUrl: () => '', esc: String,
    renderColToggle: () => {}, renderThroughputChart: () => {}, renderCFD: () => {},
    carregarConfigInatividade: () => {}, loadGithubStatus: () => {}, loadFirebaseStatus: () => {}, renderFirebaseStatusUI: () => {},
    _stPesoLoad: () => null, _stPesoSave: () => {}, _dbgTrack: () => {}, _fmtBytes: String, _painelSqColor: () => ({}), _sqLabel: String,
    _SC_DIAS: 30, _SC_TOLERANCIA_MS: 60000, _SC_ACAO: { restaurado: { bom: true }, sem_espelho: { bom: false }, em_massa: { bom: false }, reincidente: { bom: false }, alarme: { bom: false } }, _scCausa: () => null,
  });
  for (const id of ids) {
    const b = dados.kanban.squads[id]?.dados || {};
    ctx.squadData[id] = { cards: Object.values(b.cards || {}).filter(Boolean), columns: b.columns || columns, agilCfg: b.agil_cfg || {}, blockerMode: b.config?.blockerMode || 'col', flowBaseline: b.flow_baseline };
  }
  const nomes = ['renderSquadCards', 'flowColsFor', '_startTs', '_doneTs', '_createdTs', 'percentile', 'median', '_flowStage', '_collectFlowCards', '_flowVal', 'renderFlowMetrics', 'renderAgingWip', '_sqCor', '_scMontarEventos', '_scSaude', 'loadStatusData'];
  vm.runInContext(nomes.map(n => funcReal(html, n)).join('\n'), ctx);
  return { ctx, els };
}
for (const env of ['dev', 'prod']) {
  test(`paridade HTML real → DOM mínimo → golden → ferramenta (${env})`, async () => {
    const dados = seed(), { ctx, els } = contextoTela(dados, env);
    vm.runInContext('renderSquadCards(); renderFlowMetrics();', ctx);
    const card = els.get('squad-cards').children[0].innerHTML;
    assert.match(card, /Total<\/div><div[^>]*>9<\/div>/);
    assert.match(card, /Bloqueios<\/div><div[^>]*>1<\/div>/);
    assert.match(els.get('m-cycle').innerHTML, /^4.0</);
    assert.equal(els.get('m-cycle-sub').textContent, 'mediana · P85 16.0d · 4 cards');
    assert.match(els.get('m-lead').innerHTML, /^6.0</);
    assert.match(els.get('m-throughput').innerHTML, /^1.0</);
    assert.match(els.get('m-age').innerHTML, /^18</);
    assert.equal(els.get('m-age-sub').textContent.trim(), 'Mais antigo');
    const { res: f } = await chamar('painel_fluxo', { dias: 14 }, dados, env);
    assert.equal(f.cycle_time.mediana_dias, 4); assert.equal(f.lead_time.p85_dias, 20);
    assert.equal(f.wip.parado_ha_mais_tempo.idade_dias, 18);
    await vm.runInContext('loadStatusData(true)', ctx);
    const { res: s } = await chamar('painel_status', {}, dados, env);
    // loadStatusData é do dev; no prod só o caminho campanhas é diferente.
    const delta = env === 'prod' ? s.peso.campanhas_bytes - 22 : 0;
    assert.equal(Number(els.get('st-peso-total').textContent) + delta, s.peso.bytes);
    assert.equal(Number(els.get('st-cards-total').textContent), s.peso.cards);
    const lidos = ['dados', 'prf', 'midiacriativa'].map(id => ({ id, g: dados.kanban.cards_guardiao[id]?.incidentes, r: dados.kanban.cards_guardiao[id]?.resolvidos }));
    ctx.lidosTeste = lidos;
    const contagens = vm.runInContext('JSON.stringify(_scMontarEventos(lidosTeste, Date.now()).reduce((s,e)=>{s[e.acao=== "restaurado" ? "restaurados" : e.res ? "resolvidos" : "abertos"]++;return s;},{abertos:0,resolvidos:0,restaurados:0}))', ctx);
    assert.deepEqual(JSON.parse(contagens), { abertos: 2, resolvidos: 1, restaurados: 2 });
    assert.equal(s.guardiao.abertos, 2); assert.equal(s.guardiao.resolvidos, 1); assert.equal(s.guardiao.restaurados, 2);
  });
}

test('status golden mínimo: JSON UTF-8 de 47 + 2 + 2 = 51 bytes', async () => {
  // {"cards":[null,{"col":"done","archived":true}]} = 47 bytes ASCII.
  // Omnichannel ausente = {}, campanhas ausentes = {}: 2 bytes cada.
  const dados = { kanban: { squads: { dev: { dados: { cards: [null, { col: 'done', archived: true }] } } } } };
  const { res } = await chamar('painel_status', {}, dados);
  assert.deepEqual(res.peso, { bytes: 51, campanhas_bytes: 2, cards: 1, percentual_referencia: 0, saude: 'Saudável', squads_total: 2,
    squads: [{ squad: 'dev', bytes: 47, cards: 1 }, { squad: 'omnichannel', bytes: 2, cards: 0 }] });
  assert.deepEqual(res.guardiao, { abertos: 0, resolvidos: 0, restaurados: 0, _status: { ok: null, texto: 'Guardião: aguardando o primeiro pulso', ts: null, pulso_min: null, atraso_max_min: 0, abertos_7dias: 0 } });
});
test('todos os squads entram nos totais; listas de squads não passam de 20', async () => {
  const dados = seed();
  for (let i = 0; i < 25; i++) {
    dados.kanban.squads_meta['s' + i] = { label: 'Squad sintético' };
    dados.kanban.squads['s' + i] = { dados: { cards: [{ col: 'done', flow: { firstStartAt: iso(2), doneAt: iso(1) } }] } };
  }
  const v = (await chamar('painel_visao', {}, dados, 'prod')).res;
  assert.equal(v.squads_total, 29); assert.equal(v.squads.length, 20);
  const f = (await chamar('painel_fluxo', { dias: 7 }, dados, 'prod')).res;
  assert.equal(f.vazao.entregues, 26); assert.equal(f.throughput14_por_squad.length, 20);
  const s = (await chamar('painel_status', {}, dados, 'prod')).res;
  assert.equal(s.peso.cards, 35); assert.equal(s.peso.squads.length, 20);
});
test('sem conclusões: lista alerta aos 14 dias, KPI não inventa limite', async () => {
  const dados = seed();
  dados.kanban.squads.dev.dados.cards = [{ col: 'progress', title: 'Andando', createdAt: iso(14) }];
  const { res } = await chamar('painel_fluxo', { squad: 'dev', dias: 14 }, dados);
  assert.deepEqual(res.cycle_time, { mediana_dias: null, p85_dias: null, amostra: 0 });
  assert.equal(res.wip.limite_dias, null);
  assert.equal(res.wip.parado_ha_mais_tempo.alerta, false);
  assert.equal(res.wip.itens[0].alerta, true);
});
// A pasta painel/ tem DUAS camadas: as FERRAMENTAS (só leitura — este teste) e o CHAT (chat.js grava a resposta no nó do próprio chat; tem teste próprio em painelChat.test.js
// que prova que só escreve em kanban/agente_painel*). Arquivo novo na pasta precisa ser classificado aqui de propósito: sem isso uma ferramenta com escrita poderia entrar sem teste.
const CAMADA_FERRAMENTAS = ['ferramentas.js', 'nodeFor.js'];
const CAMADA_CHAT = ['chat.js', 'conferirNumeros.js', 'prompt.js'];
test('código de ferramentas não contém métodos de escrita nem rede/LLM', () => {
  const dir = path.join(__dirname, '../painel');
  const arquivos = fs.readdirSync(dir).sort();
  assert.deepEqual(arquivos.filter((n) => !CAMADA_FERRAMENTAS.includes(n) && !CAMADA_CHAT.includes(n)), [], 'arquivo novo em painel/ sem classificação (ferramenta de leitura ou camada do chat)');
  for (const nome of CAMADA_FERRAMENTAS) {
    const src = fs.readFileSync(path.join(dir, nome), 'utf8');
    assert.doesNotMatch(src, /\.(?:set|update|push|remove|transaction)\s*\(/, nome);
    assert.doesNotMatch(src, /\b(?:fetch|axios|https|anthropic|openai)\s*\(/i, nome);
  }
});
test('arrays vazios são diferentes de coluna ausente; objetos Firebase são normalizados', async () => {
  const dados = seed(), b = dados.kanban.squads.dev.dados;
  b.cards = { x: { col: 'progress' }, y: { col: 'done' } };
  b.columns = [];
  let v = (await chamar('painel_visao', { squad: 'dev' }, dados)).res.squads[0];
  assert.equal(v.ativos, 2); assert.equal(v.colunas_total, 0);
  b.columns = { a: { id: 'progress', name: 'Andando' }, z: { id: 'done', name: 'Fim' } };
  v = (await chamar('painel_visao', { squad: 'dev' }, dados)).res.squads[0];
  assert.equal(v.colunas_total, 2); assert.equal(v.colunas[0].atual, 1);
  delete b.columns;
  assert.equal((await chamar('painel_visao', { squad: 'dev' }, dados)).res.squads[0].colunas_total, 5);
});
test('comparações de queda e estabilidade saem prontas em pt-BR', async () => {
  const dados = seed(), b = dados.kanban.squads.dev.dados;
  b.cards = [{ col: 'done', flow: { doneAt: iso(10) } }];
  let c = (await chamar('painel_fluxo', { squad: 'dev', dias: 7 }, dados)).res.vazao.comparacao;
  assert.deepEqual(c, { atual: 0, anterior: 1, referencia: 'período anterior', texto: 'caiu de 1,0 para 0,0 cards por semana' });
  b.cards = [];
  c = (await chamar('painel_fluxo', { squad: 'dev', dias: 7 }, dados)).res.vazao.comparacao;
  assert.deepEqual(c, { atual: 0, anterior: 0, referencia: 'período anterior', texto: 'permaneceu em 0,0 cards por semana' });
});
