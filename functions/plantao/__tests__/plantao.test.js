// functions/plantao/__tests__/plantao.test.js — o que o servidor do Plantão de Bugs decide: ficha, duplicado, quem é avisado, bug parado, pausa geral.
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { processarBugNovo, rodarVigia, acharDuplicado, similaridade, cardIdDoBug } = require('../plantao');

const AGORA = new Date('2026-10-20T15:00:00Z');   // terça, 12:00 em Brasília
const quieto = { log() {}, error() {} };
const db = (extra) => makeFakeDb({ kanban: Object.assign({
  usuarios_publicos: { adm1: { role: 'adm' }, adm2: { role: 'adm' }, po1: { role: 'po' }, mem: { role: 'membro' } },
  usuarios: { adm1: {}, adm2: {}, po1: {}, mem: {} },
}, extra || {}) });
const bug = (o) => Object.assign({ origem: 'assistente_ferias', texto: 'O botão Salvar do card não responde quando clico', app: 'Maré Digital', arquivoAlvo: 'kanban-dev.html',
  impacto: '🟠 Atrapalha muito', autor: 'Eve Souza', email: 'eve@ciahering.com.br', uid: 'eve', criadoEm: AGORA.getTime() - 1000 }, o || {});
const dados = (d) => d._data().kanban;

test('bug novo: cria a ficha, avisa SÓ os ADMs (sino com cardId da squad Dados) e não vaza autor/e-mail', async () => {
  const d = db(), r = await processarBugNovo({ db: d, id: 'bug_ferias_1', bug: bug(), agora: AGORA });
  assert.deepEqual([r.estado, r.avisados], ['aguardando', 2]);
  const f = dados(d).plantao.bug_ferias_1;
  assert.equal(f.estado, 'aguardando'); assert.equal(f.tentativas, 0); assert.equal(f.cardId, 'c_ferias_1'); assert.equal(f.arquivoAlvo, 'kanban-dev.html');
  const n = dados(d).usuarios.adm1.notificacoes.plantao_bug_ferias_1;
  assert.equal(n.type, 'plantao_bug'); assert.equal(n.squad, 'dados'); assert.equal(n.cardId, 'c_ferias_1'); assert.equal(n.read, false);
  assert.ok(dados(d).usuarios.adm2.notificacoes.plantao_bug_ferias_1);
  assert.equal(dados(d).usuarios.po1.notificacoes, undefined); assert.equal(dados(d).usuarios.mem.notificacoes, undefined);
  assert.doesNotMatch(JSON.stringify(f) + JSON.stringify(n), /Eve|Souza|eve@|"uid":"eve"/);
});

test('só bug do Assistente Férias entra no plantão; feedback comum do Maré é ignorado', async () => {
  const d = db(); const r = await processarBugNovo({ db: d, id: 'f1', bug: { texto: 'oi', tipo: 'sugestao' }, agora: AGORA });
  assert.equal(r.pulou, 'outra_origem'); assert.equal(dados(d).plantao, undefined);
});

test('idempotente: o gatilho repetido não duplica ficha nem aviso', async () => {
  const d = db(); await processarBugNovo({ db: d, id: 'bug_ferias_1', bug: bug(), agora: AGORA });
  dados(d).usuarios.adm1.notificacoes.plantao_bug_ferias_1.read = true;
  const r = await processarBugNovo({ db: d, id: 'bug_ferias_1', bug: bug(), agora: AGORA });
  assert.equal(r.pulou, 'ja_existe'); assert.equal(dados(d).usuarios.adm1.notificacoes.plantao_bug_ferias_1.read, true);
});

test('chave geral kanban/config/plantao_ativo = false pausa tudo', async () => {
  const d = db({ config: { plantao_ativo: false } });
  assert.equal((await processarBugNovo({ db: d, id: 'b1', bug: bug(), agora: AGORA })).pulou, 'desligado');
  assert.equal(dados(d).plantao, undefined);
  assert.equal((await rodarVigia({ db: d, agora: AGORA, log: quieto })).pulou, 'desligado');
});

test('duplicado: mesmo arquivo + descrição parecida com bug ainda aberto → estado duplicado, sem aviso', async () => {
  const d = db(); await processarBugNovo({ db: d, id: 'bug_ferias_1', bug: bug(), agora: AGORA });
  const r = await processarBugNovo({ db: d, id: 'bug_ferias_2', bug: bug({ texto: 'Botão Salvar do card não responde ao clicar!', criadoEm: AGORA.getTime() }), agora: AGORA });
  assert.equal(r.estado, 'duplicado'); assert.equal(r.duplicadoDe, 'bug_ferias_1'); assert.equal(r.avisados, 0);
  assert.equal(dados(d).plantao.bug_ferias_2.estado, 'duplicado'); assert.equal(dados(d).usuarios.adm1.notificacoes.plantao_bug_ferias_2, undefined);
});

test('NÃO é duplicado: outro arquivo, texto diferente, ou o outro já foi resolvido/escalado', async () => {
  const base = { arquivoAlvo: 'kanban-dev.html', resumo: 'O botão Salvar do card não responde', criadoEm: AGORA.getTime() };
  const dup = (o, resumo, alvo) => acharDuplicado({ id: 'novo', arquivoAlvo: alvo || 'kanban-dev.html', resumo: resumo || 'Botão Salvar do card não responde ao clicar', outros: { x: Object.assign({}, base, o) }, agora: AGORA });
  assert.ok(dup({ estado: 'aguardando' }));
  assert.equal(dup({ estado: 'aguardando', arquivoAlvo: 'painel-dev.html' }), null, 'outro arquivo');
  assert.equal(dup({ estado: 'aguardando' }, 'A escala do Gantt mostra horário errado na pausa'), null, 'texto diferente');
  for (const e of ['validado', 'em_prod', 'cancelado', 'duplicado', 'escalado']) assert.equal(dup({ estado: e }), null, e);
  assert.equal(dup({ estado: 'aguardando', criadoEm: AGORA.getTime() - 20 * 86400000 }), null, 'fora da janela de 14 dias');
  assert.ok(similaridade('a b c', '') === 0);
});

test('cardIdDoBug bate com feriasCardIdBug do Oceano', () => {
  assert.equal(cardIdDoBug('bug_ferias_1760000000000'), 'c_ferias_1760000000000');
  assert.equal(cardIdDoBug('c_ferias_9'), 'c_ferias_9', 'já é id de card: não prefixa de novo');
  assert.equal(cardIdDoBug('bug_ferias_12-3'), 'c_ferias_123');
});

const ficha = (o) => Object.assign({ estado: 'aguardando', criadoEm: AGORA.getTime(), atualizadoEm: AGORA.getTime(), tentativas: 0, impacto: '🟠 Atrapalha muito', resumo: 'Salvar não responde', cardId: 'c_ferias_1' }, o || {});
const h = (n) => n * 3600000;

test('vigia: 🔴 aguardando > 2h, 🟠 > 6h, resto > 24h; dentro do prazo ninguém é incomodado', async () => {
  const d = db({ plantao: {
    r: ficha({ impacto: '🔴 Bloqueia a operação', atualizadoEm: AGORA.getTime() - h(3) }),
    o: ficha({ atualizadoEm: AGORA.getTime() - h(7) }),
    a: ficha({ impacto: '🟡 Dá pra contornar', atualizadoEm: AGORA.getTime() - h(25) }),
    ok1: ficha({ impacto: '🔴 Bloqueia a operação', atualizadoEm: AGORA.getTime() - h(1) }),
    ok2: ficha({ atualizadoEm: AGORA.getTime() - h(5) }),
    ok3: ficha({ impacto: '🟡 Dá pra contornar', atualizadoEm: AGORA.getTime() - h(23) }),
  } });
  const r = await rodarVigia({ db: d, agora: AGORA, log: quieto });
  assert.equal(r.parados, 3); assert.equal(r.avisados, 6);
  const nots = Object.keys(dados(d).usuarios.adm1.notificacoes).sort();
  assert.deepEqual(nots, ['plantao_vigia_a_2026-10-20', 'plantao_vigia_o_2026-10-20', 'plantao_vigia_r_2026-10-20']);
  assert.equal(dados(d).usuarios.adm1.notificacoes['plantao_vigia_r_2026-10-20'].type, 'plantao_bug');
});

test('vigia: em análise/PR/teste/escalado > 24h avisa; validado, em prod e duplicado nunca', async () => {
  const velho = AGORA.getTime() - h(30);
  const d = db({ plantao: { a: ficha({ estado: 'em_analise', atualizadoEm: velho }), b: ficha({ estado: 'pr_aberto', atualizadoEm: velho }), c: ficha({ estado: 'testando', atualizadoEm: velho }),
    e: ficha({ estado: 'escalado', atualizadoEm: velho }), v: ficha({ estado: 'validado', atualizadoEm: velho }), p: ficha({ estado: 'em_prod', atualizadoEm: velho }), x: ficha({ estado: 'duplicado', atualizadoEm: velho }) } });
  const r = await rodarVigia({ db: d, agora: AGORA, log: quieto });
  assert.equal(r.parados, 4);
  assert.match(dados(d).usuarios.adm1.notificacoes['plantao_vigia_e_2026-10-20'].sub, /escalado ao Claude/);
});

test('vigia: no máximo 1 aviso por bug por dia (reexecutar não repete nem reabre o que foi lido)', async () => {
  const d = db({ plantao: { o: ficha({ atualizadoEm: AGORA.getTime() - h(7) }) } });
  await rodarVigia({ db: d, agora: AGORA, log: quieto });
  dados(d).usuarios.adm1.notificacoes['plantao_vigia_o_2026-10-20'].read = true;
  const r = await rodarVigia({ db: d, agora: new Date(AGORA.getTime() + h(3)), log: quieto });
  assert.equal(r.avisados, 0); assert.equal(dados(d).usuarios.adm1.notificacoes['plantao_vigia_o_2026-10-20'].read, true);
  const r2 = await rodarVigia({ db: d, agora: new Date(AGORA.getTime() + h(24)), log: quieto });
  assert.equal(r2.avisados, 2, 'no dia seguinte, avisa de novo');
});

test('vigia: só entre 08h e 20h de Brasília', async () => {
  const d = db({ plantao: { o: ficha({ atualizadoEm: AGORA.getTime() - h(30) }) } });
  assert.equal((await rodarVigia({ db: d, agora: new Date('2026-10-20T09:00:00Z'), log: quieto })).pulou, 'fora_do_horario');   // 06:00
  assert.equal((await rodarVigia({ db: d, agora: new Date('2026-10-21T02:00:00Z'), log: quieto })).pulou, 'fora_do_horario');   // 23:00
  assert.equal((await rodarVigia({ db: d, agora: new Date('2026-10-20T11:00:00Z'), log: quieto })).parados, 1);                   // 08:00
});

test('vigia: Antigravity parou de buscar (> 2h) com bug esperando → avisa os ADMs 1x por dia; sem batimento nunca registrado, não cobra', async () => {
  const esperando = { o: ficha({ atualizadoEm: AGORA.getTime() - h(1) }) };
  const parado = db({ plantao: esperando, plantao_status: { agenteVistoEm: AGORA.getTime() - h(3) } });
  const r = await rodarVigia({ db: parado, agora: AGORA, log: quieto });
  assert.equal(r.avisados, 2); const n = dados(parado).usuarios.adm1.notificacoes['plantao_agente_parado_2026-10-20'];
  assert.equal(n.type, 'plantao_bug'); assert.match(n.title, /Antigravity não está buscando/); assert.match(n.sub, /1 bug\(s\) esperando.*há 3h/);
  assert.equal((await rodarVigia({ db: parado, agora: new Date(AGORA.getTime() + h(1)), log: quieto })).avisados, 0, 'só 1 por dia');
  const nunca = db({ plantao: esperando });
  assert.equal((await rodarVigia({ db: nunca, agora: AGORA, log: quieto })).avisados, 0, 'modo automático nunca ligado: sem cobrança');
  const vivo = db({ plantao: esperando, plantao_status: { agenteVistoEm: AGORA.getTime() - h(1) } });
  assert.equal((await rodarVigia({ db: vivo, agora: AGORA, log: quieto })).avisados, 0, 'buscou há 1h: tudo certo');
  const semBug = db({ plantao: { v: ficha({ estado: 'validado' }) }, plantao_status: { agenteVistoEm: AGORA.getTime() - h(9) } });
  assert.equal((await rodarVigia({ db: semBug, agora: AGORA, log: quieto })).avisados, 0, 'sem bug esperando, não há o que buscar');
});
