// functions/oceano/__tests__/resumo.test.js — o JSON do mini painel (oceanoResumo): status dos monitores, backup, plantão, alarmes e os cards do dono.
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { fakeBucket } = require('../../backup/__tests__/fakeBucket');
const R = require('../resumo');

const AGORA = Date.parse('2026-10-30T15:00:00Z');                        // sexta 12:00 em Brasília
const iso = (minAtras) => new Date(AGORA - minAtras * 60000).toISOString();
// o fake não tem consulta: acrescenta orderByChild(campo).equalTo(valor) e CONTA quantas vezes foi usada (prova de que não baixamos o nó inteiro por outro caminho)
function comConsulta(fake) {
  const usos = [];
  const ref = (path) => { const r = fake.ref(path);
    r.orderByChild = (campo) => ({ equalTo: (valor) => ({ async get() { usos.push(path + '|' + campo + '=' + valor); const v = (await r.get()).val() || {}; const arr = Array.isArray(v) ? v : Object.values(v); const f = arr.filter((x) => x && x[campo] === valor); return { val: () => f }; } }) });
    return r; };
  return { ref, usos, _data: fake._data };
}
const card = (id, extra) => Object.assign({ id, title: 'Card ' + id, owner: 'CO', col: 'doing', due: '2026-11-20' }, extra || {});
const seed = (extra) => ({ kanban: Object.assign({
  usuarios_publicos: { dono: { init: 'CO', squads: { dados: true, prf: true, fora: false } }, outro: { init: 'XX', squads: { dados: true } } },
  vtex_saude: { ok: true, ultimoOkEm: iso(2), verificadoEm: iso(2), abertos: 0, incidentes: [], falhasSeguidas: 0 },
  github_saude: { ok: true, verificadoEm: iso(3), indicador: 'none', descricao: 'ok', pagesStatus: 'operational', pagesAfetado: false, abertos: 0 },
  firebase_saude: { ok: true, verificadoEm: iso(1), rtdbAfetado: false, servicosDegradados: [], abertos: 0 },
  plantao: {},
  squads: { dados: { dados: { columns: [{ id: 'doing', name: 'Fazendo' }, { id: 'done', name: 'Concluído' }], config: { flow: { doneCols: ['done'] } }, cards: [
    card('a1', { due: '2026-10-28' }), card('a2', { due: '2026-10-30' }), card('a3', { blocker: true }), card('a4', { col: 'done' }), card('a5', { archived: true }), card('a6', { owner: 'XX' }), card('a7', { due: '2026-11-03' }), card('a8', { due: '' }),
  ] } }, prf: { dados: { columns: [{ id: 'doing', name: 'Fazendo' }], cards: [card('p1', { due: '2026-10-20' })] } } },
}, extra || {}) });
const bucketOk = () => fakeBucket({ 'backups-completos/diario/2026-10-30/manifesto.json': '{"erros":[]}', 'backups-completos/semanal/2026-10-25/manifesto.json': '{"erros":[]}', 'backups/dados/2026-10-30.json': '{}', 'backups/prf/2026-10-30.json': '{}', 'backups/midiacriativa/2026-10-30.json': '{}' });
const monta = (dados, bucket) => { const db = comConsulta(makeFakeDb(dados || seed())); return { db, run: () => R.montarResumo({ db, bucket: bucket || bucketOk(), agora: AGORA, resolverUid: async () => 'dono', memo: R.criarMemo() }) }; };

test('tudo em dia: geral ok e os 3 monitores "operando"', async () => {
  const r = await monta().run();
  assert.equal(r.status.vtex.estado, 'ok'); assert.equal(r.status.github.estado, 'ok'); assert.equal(r.status.firebase.estado, 'ok');
  assert.equal(r.backup.estado, 'ok'); assert.equal(r.geral, 'ok'); assert.equal(r.dono.iniciais, 'CO'); assert.equal(r.dono.squads, 2, 'só os squads com true (fora:false não entra)');
});

test('VTEX com incidente vira atenção e mostra o título; monitor sem resposta vira fora; monitor parado vira atenção', async () => {
  let r = await monta(seed({ vtex_saude: { ok: true, ultimoOkEm: iso(1), verificadoEm: iso(1), abertos: 2, incidentes: [{ titulo: 'Checkout lento', estado: 'investigando' }] } })).run();
  assert.equal(r.status.vtex.estado, 'atencao'); assert.match(r.status.vtex.texto, /2 incidentes: Checkout lento/); assert.equal(r.geral, 'atencao');
  r = await monta(seed({ github_saude: { ok: false, falhasSeguidas: 4, verificadoEm: iso(2) } })).run();
  assert.equal(r.status.github.estado, 'fora'); assert.match(r.status.github.texto, /4 falhas/); assert.equal(r.geral, 'fora');
  r = await monta(seed({ firebase_saude: { ok: true, verificadoEm: iso(45), abertos: 0, servicosDegradados: [] } })).run();
  assert.equal(r.status.firebase.estado, 'atencao'); assert.match(r.status.firebase.texto, /parado há 45 min/);
});

test('GitHub Pages afetado, Firebase com serviço degradado, monitor desligado e sem leitura', async () => {
  let r = await monta(seed({ github_saude: { ok: true, verificadoEm: iso(1), indicador: 'minor', pagesAfetado: true, pagesStatusLabel: 'Degradado' } })).run();
  assert.equal(r.status.github.estado, 'atencao'); assert.match(r.status.github.texto, /Pages afetado/);
  r = await monta(seed({ firebase_saude: { ok: true, verificadoEm: iso(1), servicosDegradados: ['Hosting'], abertos: 0 } })).run();
  assert.match(r.status.firebase.texto, /1 serviço degradado/);
  r = await monta(seed({ vtex_saude: { desligado: true, em: iso(1) }, github_saude: null })).run();
  assert.equal(r.status.vtex.estado, 'off'); assert.equal(r.status.github.estado, 'desconhecido');
});

test('meus cards: só os ATIVOS do dono (fora arquivado, concluído e de outro dono), contados por situação e ordenados por urgência', async () => {
  const { db, run } = monta(); const r = await run(); const c = r.meusCards;
  assert.equal(c.ativos, 6, 'a1 a2 a3 a7 a8 (dados) + p1 (prf); a4 concluído, a5 arquivado e a6 de outro dono ficam de fora');
  assert.equal(c.atrasados, 2); assert.equal(c.venceHoje, 1); assert.equal(c.bloqueados, 1); assert.equal(c.semPrazo, 1); assert.equal(c.venceEm7dias, 1);
  assert.deepEqual(c.lista.map((x) => x.id), ['p1', 'a1', 'a3', 'a2', 'a7'], 'atrasados (mais antigo primeiro), bloqueado, vence hoje, vence nos próximos 7 dias; sem prazo e longe ficam fora da lista');
  assert.equal(c.lista[0].squad, 'prf'); assert.equal(c.lista[0].diasAtraso, 10);
  assert.ok(db.usos.length >= 2 && db.usos.every((u) => /\|owner=CO$/.test(u)), 'os cards vêm da consulta por responsável (com índice, só o resultado trafega): ' + db.usos.join(', '));
});

test('o JSON não leva dado além do necessário: título cortado em 80 e nenhum campo de descrição, comentário ou outra pessoa', async () => {
  const d = seed(); d.kanban.squads.dados.dados.cards[0].title = 'x'.repeat(200); d.kanban.squads.dados.dados.cards[0].desc = 'SEGREDO'; d.kanban.squads.dados.dados.cards[0].participants = ['ZZ'];
  const r = await monta(d).run(); const txt = JSON.stringify(r);
  assert.ok(r.meusCards.lista.every((x) => x.titulo.length <= 80)); assert.ok(!/SEGREDO|ZZ/.test(txt));
});

test('alarmes de "card sumiu": conta cards distintos das últimas 24 h nos squads do dono', async () => {
  const d = seed(); d.kanban.squads.dados.dados.cards_incidentes_sumico = {
    i1: { cardId: 'c1', detectadoEm: iso(60) }, i2: { cardId: 'c1', detectadoEm: iso(50) }, i3: { cardId: 'c2', detectadoEm: iso(30) }, i4: { cardId: 'velho', detectadoEm: iso(60 * 30) } };
  const r = await monta(d).run();
  assert.equal(r.alarmesSumico.ultimas24h, 2); assert.equal(r.alarmesSumico.squadUltimo, 'dados'); assert.equal(r.geral, 'atencao');
  const limpo = await monta().run(); assert.equal(limpo.alarmesSumico.ultimas24h, 0);
});

test('plantão: conta só as fichas abertas; ficha escalada deixa o geral em atenção', async () => {
  const d = seed({ plantao: { b1: { estado: 'aguardando' }, b2: { estado: 'testando' }, b3: { estado: 'pr_aberto' }, b4: { estado: 'validado' }, b5: { estado: 'escalado' } } });
  const r = await monta(d).run();
  assert.equal(r.plantao.abertos, 4); assert.equal(r.plantao.aguardandoValidacao, 2); assert.equal(r.plantao.escalados, 1); assert.equal(r.geral, 'atencao');
});

test('backup atrasado vira "fora" com o motivo do vigia', async () => {
  const b = fakeBucket({ 'backups-completos/semanal/2026-10-25/manifesto.json': '{"erros":[]}', 'backups/dados/2026-10-30.json': '{}', 'backups/prf/2026-10-30.json': '{}', 'backups/midiacriativa/2026-10-20.json': '{}' });
  const r = await monta(null, b).run();
  assert.equal(r.backup.estado, 'fora'); assert.match(r.backup.texto, /diário|quadro|midiacriativa/); assert.equal(r.geral, 'fora');
});

test('uma leitura que falha não derruba o resto: o bloco vira desconhecido/null e o JSON sai', async () => {
  const fake = comConsulta(makeFakeDb(seed())); const refOriginal = fake.ref;
  fake.ref = (path) => { if (/\/plantao$/.test(path)) throw new Error('permissão negada'); return refOriginal(path); };
  const e = console.error; console.error = () => {};
  try { const r = await R.montarResumo({ db: fake, bucket: bucketOk(), agora: AGORA, resolverUid: async () => 'dono', memo: R.criarMemo() });
    assert.equal(r.plantao, null); assert.equal(r.status.vtex.estado, 'ok'); assert.ok(r.meusCards.ativos > 0); }
  finally { console.error = e; }
});

test('dono sem cadastro (uid não resolve): devolve o resumo de sistema, sem cards', async () => {
  const r = await R.montarResumo({ db: comConsulta(makeFakeDb(seed())), bucket: bucketOk(), agora: AGORA, resolverUid: async () => null, memo: R.criarMemo() });
  assert.equal(r.meusCards, null); assert.equal(r.status.vtex.estado, 'ok'); assert.equal(r.dono.iniciais, null);
});

test('memo: a segunda chamada dentro do TTL não relê; passado o TTL, relê', async () => {
  const memo = R.criarMemo(); let n = 0; const f = async () => ++n;
  assert.equal(await memo('k', 1000, 0, f), 1); assert.equal(await memo('k', 1000, 500, f), 1); assert.equal(await memo('k', 1000, 1500, f), 2);
});

test('limite por hora: acima do teto devolve false (e conta na hora certa)', async () => {
  const db = makeFakeDb({}); let ok = true;
  for (let i = 0; i < R.LIMITE_POR_HORA; i++) ok = ok && (await R.dentroDoLimite(db, AGORA));
  assert.equal(ok, true); assert.equal(await R.dentroDoLimite(db, AGORA), false); assert.equal(await R.dentroDoLimite(db, AGORA + 3600000), true);
});
