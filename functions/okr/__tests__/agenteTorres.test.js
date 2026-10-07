// Agente Ágil do OKR × o que mudou em 2026-10-07: torres, gerências configuráveis, permissão por torre, 🔒 trava de edição, 🔔 feed do sino e 📅 agenda (só leitura).
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { buildOkrTools } = require('../agenteTools');

const ADM = 'uid-adm', PO_COM = 'uid-po-comercial', GESTOR_DIG = 'uid-gestor-digital', GERAL = 'uid-geral', RESP = 'uid-resp', OUTRO = 'uid-outro';
const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const soma = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return x.toLocaleDateString('en-CA'); };

function seed(extra) {
  return makeFakeDb({
    kanban: {
      usuarios: {
        [ADM]: { email: 'caio.soares@ciahering.com.br' },
        [PO_COM]: { email: 'po@ciahering.com.br', role: 'po', torre: 'comercial' },
        [GESTOR_DIG]: { email: 'g@ciahering.com.br', gestorOkr: true },   // sem torre = Digital
        [GERAL]: { email: 'geral@ciahering.com.br', gestorOkr: true, torre: 'geral' },
        [RESP]: { email: 'r@ciahering.com.br' },
        [OUTRO]: { email: 'o@ciahering.com.br' },
      },
      okr: {
        objetivos: {
          d1: { id: 'd1', titulo: 'Obj Digital', areaId: 'tech', responsaveis: [RESP], tagIds: ['t1'] },                       // sem torre = Digital
          c1: { id: 'c1', titulo: 'Obj Comercial', torre: 'comercial', areaId: 'geral', responsaveis: [] },
          k1: { id: 'k1', titulo: 'Obj Corp', torre: 'corporativa', areaId: 'geral', responsaveis: [] },
        },
        marcos: { m1: { id: 'm1', objetivoId: 'd1', nome: 'Marco A', progresso: 'no_prazo' } },
        tags: { t1: { label: 'Peak Natal' } },
        gerencias: { comercial: { geral: { label: 'Matriz', ordem: 0 }, lojas: { label: 'Lojas', ordem: 1 }, velha: { label: 'Velha', ordem: 2, oculta: true } } },
      },
      ...extra,
    },
  });
}
const tools = (db, uid, dryRun = false) => buildOkrTools({ mode: 'real', db, requestingUid: uid, dryRun });
const tool = (db, uid, name, dryRun) => tools(db, uid, dryRun).find((t) => t.name === name);

test('listar_objetivos: traz torre e nome da gerência (config da torre) e filtra por torre', async () => {
  const db = seed();
  const r = await tool(db, OUTRO, 'listar_objetivos').handler({});
  assert.equal(r.total, 3);
  assert.equal(r.objetivos.find((o) => o.id === 'd1').torre, 'digital');          // sem o campo = Digital
  assert.equal(r.objetivos.find((o) => o.id === 'd1').gerencia, 'Tech');
  assert.equal(r.objetivos.find((o) => o.id === 'c1').gerencia, 'Matriz');         // 'geral' da Comercial foi renomeada na config
  const so = await tool(db, OUTRO, 'listar_objetivos').handler({ torre: 'comercial' });
  assert.deepEqual(so.objetivos.map((o) => o.id), ['c1']);
  assert.equal((await tool(db, OUTRO, 'listar_objetivos').handler({ torre: 'digital', area_id: 'geral' })).total, 0);   // 'geral' é por torre
});

test('listar_gerencias: padrão da torre sem config, config quando existe, e oculta marcada', async () => {
  const db = seed();
  const r = await tool(db, OUTRO, 'listar_gerencias').handler({});
  const dig = r.torres.find((t) => t.torre === 'digital').gerencias, com = r.torres.find((t) => t.torre === 'comercial').gerencias, cor = r.torres.find((t) => t.torre === 'corporativa').gerencias;
  assert.equal(dig.length, 7);
  assert.deepEqual(com.map((g) => [g.id, g.nome, g.oculta]), [['geral', 'Matriz', false], ['lojas', 'Lojas', false], ['velha', 'Velha', true]]);
  assert.deepEqual(cor.map((g) => g.id), ['geral']);
  assert.equal((await tool(db, OUTRO, 'listar_gerencias').handler({ torre: 'comercial' })).torres.length, 1);
});

test('ler_objetivo: torre, gerência, tags e quem está editando (🔒)', async () => {
  const db2 = seed();
  await db2.ref('kanban/okr/obj_locks/d1').set({ uid: OUTRO, who: 'Ana', ts: Date.now() });
  const r = await tool(db2, ADM, 'ler_objetivo').handler({ objetivo_id: 'd1' });
  assert.equal(r.torre, 'digital'); assert.equal(r.gerencia, 'Tech'); assert.deepEqual(r.tags, ['Peak Natal']); assert.equal(r.em_edicao_por, 'Ana');
});

test('criar_objetivo: ADM cria em qualquer torre, com torre gravada e evento no sino', async () => {
  const db = seed();
  const r = await tool(db, ADM, 'criar_objetivo').handler({ titulo: 'Abrir lojas', torre: 'comercial', area_id: 'lojas' });
  assert.equal(r.ok, true); assert.equal(r.torre, 'comercial');
  const o = (await db.ref('kanban/okr/objetivos/' + r.objetivo_id).get()).val();
  assert.equal(o.torre, 'comercial'); assert.equal(o.areaId, 'lojas');
  const feed = Object.values((await db.ref('kanban/notif_feed').get()).val() || {});
  assert.equal(feed.length, 1);
  assert.equal(feed[0].tipo, 'obj_criado'); assert.deepEqual(feed[0].torres, ['comercial']); assert.equal(feed[0].objId, r.objetivo_id); assert.equal(feed[0].autorUid, 'agente-agil');
});

test('criar_objetivo: sem torre informada vale a torre de quem pediu (Gestor OKR Digital → Digital; PO Comercial → Comercial; ⭐ Geral → Digital)', async () => {
  const db = seed();
  const a = await tool(db, GESTOR_DIG, 'criar_objetivo').handler({ titulo: 'G1', area_id: 'cx' });
  assert.equal(a.ok, true); assert.equal(a.torre, 'digital');
  const b = await tool(db, PO_COM, 'criar_objetivo').handler({ titulo: 'P1', area_id: 'lojas' });
  assert.equal(b.ok, true); assert.equal(b.torre, 'comercial');
  const c = await tool(db, GERAL, 'criar_objetivo').handler({ titulo: 'GG', area_id: 'geral' });
  assert.equal(c.ok, true); assert.equal(c.torre, 'digital');
});

test('criar_objetivo: PO/Gestor só na PRÓPRIA torre; ⭐ Geral em todas; quem não tem papel é recusado', async () => {
  const db = seed();
  const fora = await tool(db, PO_COM, 'criar_objetivo').handler({ titulo: 'X', torre: 'digital', area_id: 'cx' });
  assert.equal(fora.ok, false); assert.equal(fora.error, 'sem_permissao');
  assert.equal((await tool(db, GERAL, 'criar_objetivo').handler({ titulo: 'Y', torre: 'corporativa', area_id: 'geral' })).ok, true);
  assert.equal((await tool(db, RESP, 'criar_objetivo').handler({ titulo: 'Z', area_id: 'cx' })).error, 'sem_permissao');   // Responsável de um Objetivo não cria
});

test('criar_objetivo: gerência tem que existir NA TORRE (config) e não pode estar oculta', async () => {
  const db = seed();
  const nao = await tool(db, ADM, 'criar_objetivo').handler({ titulo: 'X', torre: 'comercial', area_id: 'tech' });
  assert.equal(nao.ok, false); assert.equal(nao.error, 'gerencia_invalida'); assert.match(nao.message, /Matriz \(geral\), Lojas \(lojas\)/);
  const oc = await tool(db, ADM, 'criar_objetivo').handler({ titulo: 'X', torre: 'comercial', area_id: 'velha' });
  assert.equal(oc.error, 'gerencia_oculta');
  assert.equal((await tool(db, ADM, 'criar_objetivo').handler({ titulo: 'X', torre: 'corporativa', area_id: 'cx' })).error, 'gerencia_invalida');   // 'cx' só existe no Digital
});

test('editar: PO/Organizador e Gestor OKR editam Objetivo da PRÓPRIA torre (sem ser Responsável); de outra torre não', async () => {
  const db = seed();
  assert.equal((await tool(db, PO_COM, 'editar_campos_okr').handler({ objetivo_id: 'c1', pilar: 'Lojas' })).ok, true);
  assert.equal((await tool(db, PO_COM, 'editar_campos_okr').handler({ objetivo_id: 'd1', pilar: 'x' })).error, 'sem_permissao');
  assert.equal((await tool(db, GESTOR_DIG, 'criar_marco').handler({ objetivo_id: 'd1', nome: 'Novo' })).ok, true);   // Gestor sem torre = Digital
  assert.equal((await tool(db, GESTOR_DIG, 'editar_marco').handler({ marco_id: 'm1', progresso: 'risco' })).ok, true);
  assert.equal((await tool(db, GERAL, 'editar_campos_okr').handler({ objetivo_id: 'k1', pilar: 'ok' })).ok, true);   // ⭐ Geral: todas
  assert.equal((await tool(db, OUTRO, 'editar_campos_okr').handler({ objetivo_id: 'd1', pilar: 'x' })).error, 'sem_permissao');
});

test('editar_campos_okr: trocar a gerência valida contra a torre do Objetivo e grava o NOME no histórico', async () => {
  const db = seed();
  const nao = await tool(db, ADM, 'editar_campos_okr').handler({ objetivo_id: 'c1', area_id: 'tech' });
  assert.equal(nao.error, 'gerencia_invalida');
  assert.equal((await tool(db, ADM, 'editar_campos_okr').handler({ objetivo_id: 'c1', area_id: 'lojas' })).ok, true);
  const h = (await db.ref('kanban/okr/objetivos/c1/history').get()).val();
  assert.ok(h.some((x) => /gerência para "Lojas"/.test(x.what)));
});

test('🔒 trava: trava viva de OUTRA pessoa bloqueia toda escrita; a minha, velha ou ausente não', async () => {
  const db = seed();
  await db.ref('kanban/okr/obj_locks/d1').set({ uid: OUTRO, who: 'Ana', ts: Date.now() });
  for (const [nome, input] of [['editar_campos_okr', { objetivo_id: 'd1', pilar: 'x' }], ['criar_marco', { objetivo_id: 'd1', nome: 'M' }], ['editar_marco', { marco_id: 'm1', progresso: 'risco' }],
    ['configurar_atingimento', { objetivo_id: 'd1', tipo: 'perene' }]]) {
    const r = await tool(db, ADM, nome).handler(input);
    assert.equal(r.ok, false, nome); assert.equal(r.error, 'objetivo_em_edicao', nome); assert.match(r.message, /Ana está editando/, nome);
  }
  assert.equal((await tool(db, ADM, 'editar_campos_okr').handler({ objetivo_id: 'c1', pilar: 'outro objetivo' })).ok, true);   // a trava é por Objetivo
  await db.ref('kanban/okr/obj_locks/d1').set({ uid: OUTRO, who: 'Ana', ts: Date.now() - 11 * 60 * 1000 });                   // velha (>10 min)
  assert.equal((await tool(db, ADM, 'editar_campos_okr').handler({ objetivo_id: 'd1', pilar: 'x' })).ok, true);
  await db.ref('kanban/okr/obj_locks/d1').set({ uid: ADM, who: 'Caio', ts: Date.now() });                                      // a de quem está pedindo
  assert.equal((await tool(db, ADM, 'editar_campos_okr').handler({ objetivo_id: 'd1', pilar: 'y' })).ok, true);
});

test('editar_marco: concluir um Marco publica "Marco concluído" no sino da torre — uma vez só', async () => {
  const db = seed();
  await tool(db, ADM, 'editar_marco').handler({ marco_id: 'm1', progresso: 'concluido' });
  await tool(db, ADM, 'editar_marco').handler({ marco_id: 'm1', progresso: 'concluido' });   // já estava concluído: não repete o evento
  await tool(db, ADM, 'editar_marco').handler({ marco_id: 'm1', progresso: 'risco' });
  const feed = Object.values((await db.ref('kanban/notif_feed').get()).val() || {});
  assert.equal(feed.length, 1);
  assert.equal(feed[0].tipo, 'marco_concluido'); assert.deepEqual(feed[0].torres, ['digital']); assert.equal(feed[0].objId, 'd1'); assert.equal(feed[0].marcoId, 'm1');
  assert.match(feed[0].titulo, /Marco A/); assert.match(feed[0].sub, /Obj Digital · 🛒 Digital/);
});

test('dryRun: criar_objetivo valida permissão/gerência mas não grava nada nem publica no sino', async () => {
  const db = seed();
  const r = await tool(db, ADM, 'criar_objetivo', true).handler({ titulo: 'Simulado', torre: 'comercial', area_id: 'lojas' });
  assert.equal(r.dryRun, true); assert.equal(r.wouldHaveExecuted.torre, 'comercial');
  assert.equal(Object.keys((await db.ref('kanban/okr/objetivos').get()).val()).length, 3);
  assert.equal((await db.ref('kanban/notif_feed').get()).val(), null);
});

// ── 📅 listar_agenda ──
const ev = (id, extra) => ({ id, titulo: 'Evento ' + id, tipo: 'reuniao', data: soma(hoje, 3), hi: '10:00', hf: '11:00', torre: '', areaIds: [], objetivoIds: [], tagIds: [], convidados: [], rec: null, excecoes: {}, ...extra });
async function dbComAgenda() {
  const db = seed();
  await db.ref('kanban/okr/calendario/eventos').set({
    g: ev('g', { titulo: 'All hands', torre: '', tipo: 'evento', objetivoIds: ['d1'] }),
    dig: ev('dig', { titulo: 'Check-in Digital', torre: 'digital', areaIds: ['tech'], rec: { tipo: 'semanal', unidade: 'semana', intervalo: 1, ate: '' }, convidados: ['a', 'b'], tagIds: ['t1'], local: 'Sala 2', descricao: 'Pauta do check-in' }),
    com: ev('com', { titulo: 'Reunião Comercial', torre: 'comercial', data: soma(hoje, 5) }),
    longe: ev('longe', { titulo: 'Longe', torre: 'digital', data: soma(hoje, 90) }),
  });
  return db;
}

test('listar_agenda: próximas ocorrências (recorrente expande), ordenadas, com agenda/repetição/tags/convidados — fora da janela não entra', async () => {
  const db = await dbComAgenda();
  const r = await tool(db, OUTRO, 'listar_agenda').handler({ dias: 14 });
  assert.equal(r.ok, true);
  assert.ok(!r.eventos.some((e) => e.evento_id === 'longe'));
  const dig = r.eventos.filter((e) => e.evento_id === 'dig');
  assert.ok(dig.length >= 2, 'a semanal aparece mais de uma vez em 14 dias');
  assert.equal(dig[0].agenda, 'Agenda Digital'); assert.equal(dig[0].repete, 'toda semana'); assert.equal(dig[0].convidados, 2); assert.deepEqual(dig[0].tags, ['Peak Natal']); assert.equal(dig[0].local, 'Sala 2'); assert.equal(dig[0].hora, '10:00–11:00');
  assert.equal(r.eventos.find((e) => e.evento_id === 'g').agenda, 'Agenda global');
  assert.deepEqual(r.eventos.map((e) => e.data), [...r.eventos.map((e) => e.data)].sort());
  assert.equal((await tool(db, OUTRO, 'listar_agenda').handler({ dias: 120 })).eventos.some((e) => e.evento_id === 'longe'), true);
});

test('listar_agenda: filtro por torre (a dela + a global) e "global"', async () => {
  const db = await dbComAgenda();
  const com = await tool(db, OUTRO, 'listar_agenda').handler({ torre: 'comercial' });
  assert.deepEqual([...new Set(com.eventos.map((e) => e.evento_id))].sort(), ['com', 'g']);
  const gl = await tool(db, OUTRO, 'listar_agenda').handler({ torre: 'global' });
  assert.deepEqual([...new Set(gl.eventos.map((e) => e.evento_id))], ['g']);
});

test('listar_agenda: por Objetivo usa o MESMO escopo da pauta (vínculo explícito > gerência/tag > reunião sem recorte = torre toda)', async () => {
  const db = await dbComAgenda();
  const d1 = await tool(db, OUTRO, 'listar_agenda').handler({ titulo_objetivo: 'Obj Digital' });   // d1: Digital/tech/tag t1
  assert.deepEqual([...new Set(d1.eventos.map((e) => e.evento_id))].sort(), ['dig', 'g']);          // g por vínculo; dig por gerência tech/tag
  const c1 = await tool(db, OUTRO, 'listar_agenda').handler({ objetivo_id: 'c1' });
  assert.deepEqual([...new Set(c1.eventos.map((e) => e.evento_id))], ['com']);                      // reunião da Comercial sem recorte = torre toda
  assert.equal((await tool(db, OUTRO, 'listar_agenda').handler({ objetivo_id: 'nao-existe' })).error, 'objetivo_nao_encontrado');
});

test('listar_agenda: evento_id devolve o detalhe (descrição + pauta); dias fora do limite é erro de entrada', async () => {
  const db = await dbComAgenda();
  const r = await tool(db, OUTRO, 'listar_agenda').handler({ evento_id: 'dig' });
  assert.equal(r.eventos.length, 1); assert.equal(r.detalhe.descricao, 'Pauta do check-in');
  assert.deepEqual(r.detalhe.pauta.map((p) => p.id), ['d1']);
  assert.equal((await tool(db, OUTRO, 'listar_agenda').handler({ evento_id: 'zzz' })).error, 'evento_nao_encontrado');
  assert.equal((await tool(db, OUTRO, 'listar_agenda').handler({ dias: 500 })).error, 'entrada_invalida');
});

test('listar_agenda é só leitura: nada muda no calendário, e o fake (mode:fake) nunca toca o banco', async () => {
  const db = await dbComAgenda();
  const antes = JSON.stringify((await db.ref('kanban/okr/calendario').get()).val());
  await tool(db, OUTRO, 'listar_agenda').handler({ dias: 60 });
  assert.equal(JSON.stringify((await db.ref('kanban/okr/calendario').get()).val()), antes);
  const f = buildOkrTools().find((t) => t.name === 'listar_agenda');
  assert.equal((await f.handler({ dias: 7 })).simulated, true);
  assert.ok(!buildOkrTools().some((t) => /evento/.test(t.name) && t.name !== 'listar_agenda'), 'o agente não ganhou ferramenta de escrita de evento');
});
