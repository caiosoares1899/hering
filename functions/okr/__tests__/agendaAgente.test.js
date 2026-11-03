// functions/okr/__tests__/agendaAgente.test.js — subagente de agenda: as ferramentas só PROPÕEM (nunca gravam no calendário) e o `responder` anexa os cartões.
process.env.MARE_MODO_TESTE = 'varias-torres';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { buildOkrTools } = require('../agenteTools');

const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const soma = (n) => { const d = new Date(hoje + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const seed = (eventos) => makeFakeDb({ kanban: {
  config: { adm_emails: ['adm@ciahering.com.br'] },
  usuarios: { adm: { email: 'adm@ciahering.com.br', nome: 'Adm' }, po: { email: 'po@ciahering.com.br', role: 'po', torre: 'digital' }, mem: { email: 'mem@ciahering.com.br', role: 'membro' }, fulana: { email: 'fulana@ciahering.com.br' } },
  usuarios_publicos: { adm: { nome: 'Adm Silva', email: 'adm@ciahering.com.br' }, fulana: { nome: 'Fulana Souza', email: 'fulana@ciahering.com.br' }, fulano: { nome: 'Fulano Lima', email: 'fulano@ciahering.com.br' }, ana1: { nome: 'Ana Paula', email: 'ana1@ciahering.com.br' }, ana2: { nome: 'Ana Clara', email: 'ana2@ciahering.com.br' }, mem: { nome: 'Mem', email: 'mem@ciahering.com.br' } },
  okr: { calendario: { eventos: eventos || {} } },
} });
const ev = (id, extra) => Object.assign({ id, tipo: 'entrega', titulo: 'Plano ' + id, data: soma(5), diaInteiro: true, hi: '', hf: '', torre: 'digital', convidados: ['fulana'], status: 'a_fazer', areaIds: [], objetivoIds: [], tagIds: [], rec: null, excecoes: {}, atualizadoEm: '2026-11-01T00:00:00.000Z', criadoPor: { uid: 'adm', nome: 'Adm' } }, extra || {});
const ferr = (db, uid) => { const t = buildOkrTools({ mode: 'real', db, requestingUid: uid, dryRun: false }); return Object.fromEntries(t.map((x) => [x.name, x.handler])); };
const propostas = async (db) => Object.values((await db.ref('kanban/okr/agenda_propostas').get()).val() || {});
const eventosDb = async (db) => (await db.ref('kanban/okr/calendario/eventos').get()).val() || {};

test('registro: as 2 ferramentas novas existem e a descrição da agenda avisa que o agente só propõe', () => {
  const nomes = buildOkrTools({ mode: 'fake' }).map((t) => t.name);
  assert.ok(nomes.includes('propor_agenda_evento') && nomes.includes('propor_cobranca'));
});
test('criar reunião: vira PROPOSTA pendente com o evento pronto — o calendário NÃO muda', async () => {
  const db = seed(); const f = ferr(db, 'adm');
  const r = await f.propor_agenda_evento({ acao: 'criar', tipo: 'reuniao', titulo: 'All Hands 1º tri', data: soma(10), hora_inicio: '10:00', hora_fim: '11:00', repeticao: 'trimestral' });
  assert.equal(r.ok, true); assert.ok(r.proposta_id);
  assert.deepEqual(await eventosDb(db), {}, 'nada gravado no calendário');
  const [p] = await propostas(db);
  assert.equal(p.status, 'pendente'); assert.equal(p.acao, 'criar'); assert.equal(p.porUid, 'adm');
  assert.equal(p.ev.titulo, 'All Hands 1º tri'); assert.equal(p.ev.hi, '10:00'); assert.equal(p.ev.rec.unidade, 'mes'); assert.equal(p.ev.rec.intervalo, 3); assert.equal(p.ev.torre, 'digital');
  assert.match(p.resumo, /Criar/); assert.match(p.resumo, /repete/);
});
test('criar entrega: dia inteiro, não repete, responsáveis por NOME viram uids, macro e situação', async () => {
  const db = seed(); const f = ferr(db, 'adm');
  const r = await f.propor_agenda_evento({ acao: 'criar', tipo: 'entrega', titulo: 'Showroom de Inverno', data: soma(30), responsaveis: ['fulana souza', 'Fulano'], macro: 'do' });
  assert.equal(r.ok, true);
  const [p] = await propostas(db);
  assert.equal(p.ev.diaInteiro, true); assert.equal(p.ev.rec, null); assert.deepEqual(p.ev.convidados.sort(), ['fulana', 'fulano']); assert.equal(p.ev.macro, 'do'); assert.equal(p.ev.status, 'a_fazer');
  assert.match(p.resumo, /responsáveis: Fulana Souza, Fulano Lima/);
  const rep = await f.propor_agenda_evento({ acao: 'criar', tipo: 'entrega', titulo: 'X', data: soma(3), repeticao: 'semanal' });
  assert.equal(rep.error, 'entrega_nao_repete');
});
test('nunca chuta: pessoa ambígua, desconhecida, data no passado, reunião sem hora', async () => {
  const db = seed(); const f = ferr(db, 'adm');
  const amb = await f.propor_agenda_evento({ acao: 'criar', tipo: 'entrega', titulo: 'X', data: soma(3), responsaveis: ['Ana'] });
  assert.equal(amb.error, 'pessoa_ambigua'); assert.match(amb.message, /Ana Paula/); assert.match(amb.message, /Ana Clara/);
  assert.equal((await f.propor_agenda_evento({ acao: 'criar', tipo: 'entrega', titulo: 'X', data: soma(3), responsaveis: ['Zézinho'] })).error, 'pessoa_nao_encontrada');
  assert.equal((await f.propor_agenda_evento({ acao: 'criar', tipo: 'evento', titulo: 'X', data: soma(-2), dia_inteiro: true })).error, 'data_no_passado');
  assert.equal((await f.propor_agenda_evento({ acao: 'criar', tipo: 'reuniao', titulo: 'X', data: soma(3) })).error, 'hora_obrigatoria');
  assert.equal((await f.propor_agenda_evento({ acao: 'criar', tipo: 'evento', titulo: 'X', data: soma(3), dia_inteiro: true, link: 'http://x' })).error, 'link_invalido');
  assert.deepEqual(await propostas(db), [], 'nenhuma proposta com erro');
});
test('permissão: membro comum não cria; PO da torre cria; agenda global só ADM', async () => {
  const db = seed();
  const m = await ferr(db, 'mem').propor_agenda_evento({ acao: 'criar', tipo: 'evento', titulo: 'X', data: soma(3), dia_inteiro: true });
  assert.equal(m.error, 'sem_permissao');
  const po = await ferr(db, 'po').propor_agenda_evento({ acao: 'criar', tipo: 'evento', titulo: 'X', data: soma(3), dia_inteiro: true });
  assert.equal(po.ok, true);
});
test('editar: aplica só o que mudou, guarda a base (atualizadoEm) e mostra antes → depois; excluir pede a série inteira', async () => {
  const db = seed({ e1: ev('e1', { tipo: 'reuniao', diaInteiro: false, hi: '10:00', hf: '11:00', rec: { tipo: 'semanal', unidade: 'semana', intervalo: 1, ate: '' }, data: soma(2) }) }); const f = ferr(db, 'adm');
  const r = await f.propor_agenda_evento({ acao: 'editar', evento_id: 'e1', data: soma(9) });
  assert.equal(r.ok, true);
  const [p] = await propostas(db);
  assert.equal(p.ev.data, soma(9)); assert.equal(p.ev.hi, '10:00'); assert.equal(p.ev.rec.unidade, 'semana'); assert.equal(p.baseEm, '2026-11-01T00:00:00.000Z'); assert.match(p.resumo, /vale pra série inteira/);
  assert.equal((await eventosDb(db)).e1.data, soma(2), 'evento intacto');
  const ex = await f.propor_agenda_evento({ acao: 'excluir', evento_id: 'e1' }); assert.equal(ex.ok, true); assert.match(ex.resumo, /a série inteira/);
  assert.equal((await f.propor_agenda_evento({ acao: 'editar', evento_id: 'nao-existe', titulo: 'x' })).error, 'evento_nao_encontrado');
});
test('mudar_situacao: o responsável (sem ser ADM) pode propor; quem não tem nada a ver, não; só vale pra entrega', async () => {
  const db = seed({ e1: ev('e1'), r1: ev('r1', { tipo: 'reuniao', diaInteiro: false, hi: '10:00' }) });
  assert.equal((await ferr(db, 'fulana').propor_agenda_evento({ acao: 'mudar_situacao', evento_id: 'e1', situacao: 'entregue' })).ok, true);
  assert.equal((await ferr(db, 'mem').propor_agenda_evento({ acao: 'mudar_situacao', evento_id: 'e1', situacao: 'entregue' })).error, 'sem_permissao');
  assert.equal((await ferr(db, 'adm').propor_agenda_evento({ acao: 'mudar_situacao', evento_id: 'r1', situacao: 'entregue' })).error, 'so_entrega');
  assert.equal((await ferr(db, 'adm').propor_agenda_evento({ acao: 'mudar_situacao', evento_id: 'e1' })).error, 'situacao_obrigatoria');
});
test('cobrança: proposta com texto padrão; recusa entregue, sem responsável, sem permissão; 48 h entre cobranças manuais', async () => {
  const db = seed({ e1: ev('e1', { data: soma(-3) }), ok: ev('ok', { status: 'entregue' }), sd: ev('sd', { convidados: [] }) }); const f = ferr(db, 'adm');
  const r = await f.propor_cobranca({ evento_id: 'e1' }); assert.equal(r.ok, true); assert.match(r.resumo, /Fulana Souza/); assert.match(r.resumo, /já passou/);
  assert.equal((await f.propor_cobranca({ evento_id: 'ok' })).error, 'ja_entregue');
  assert.equal((await f.propor_cobranca({ evento_id: 'sd' })).error, 'sem_responsavel');
  assert.equal((await ferr(db, 'mem').propor_cobranca({ evento_id: 'e1' })).error, 'sem_permissao');
  const [p] = await propostas(db); await db.ref('kanban/okr/agenda_propostas/' + p.id).update({ status: 'confirmada', em: new Date().toISOString() });
  assert.equal((await f.propor_cobranca({ evento_id: 'e1' })).error, 'cobranca_recente');
  await db.ref('kanban/okr/agenda_propostas/' + p.id).update({ em: new Date(Date.now() - 49 * 3600000).toISOString() });
  assert.equal((await f.propor_cobranca({ evento_id: 'e1' })).ok, true, 'passadas 48 h pode cobrar de novo');
});
test('responder anexa à mensagem os ids das propostas preparadas na rodada', async () => {
  const db = seed(); const f = ferr(db, 'adm');
  const a = await f.propor_agenda_evento({ acao: 'criar', tipo: 'evento', titulo: 'Offsite', data: soma(20), dia_inteiro: true });
  const b = await f.propor_agenda_evento({ acao: 'criar', tipo: 'lembrete', titulo: 'Fechar mês', data: soma(21) });
  const r = await f.responder({ texto: 'Deixei 2 propostas prontas.' });
  const msg = (await db.ref('kanban/okr/agente_chat/' + r.message_id).get()).val();
  assert.deepEqual(msg.propostas, [a.proposta_id, b.proposta_id]);
  const r2 = await ferr(db, 'adm').responder({ texto: 'oi' });   // rodada nova: sem propostas
  assert.equal((await db.ref('kanban/okr/agente_chat/' + r2.message_id).get()).val().propostas, undefined);
});
test('listar_agenda enriquecida: atrasadas (com dias), sem responsável, filtros por tipo/macro/situação e nomes dos responsáveis', async () => {
  const db = seed({ a: ev('a', { data: soma(-4), macro: 'plan' }), b: ev('b', { data: soma(6), convidados: [], macro: 'do' }), c: ev('c', { data: soma(-2), status: 'entregue' }), r: ev('r', { tipo: 'reuniao', diaInteiro: false, hi: '09:00', data: soma(1), macro: 'check' }) }); const f = ferr(db, 'adm');
  const atr = await f.listar_agenda({ so_atrasadas: true }); assert.equal(atr.eventos.length, 1); assert.equal(atr.eventos[0].evento_id, 'a'); assert.equal(atr.eventos[0].dias_atraso, 4); assert.equal(atr.eventos[0].responsaveis[0].nome, 'Fulana Souza'); assert.equal(atr.eventos[0].macro, 'plan');
  const sd = await f.listar_agenda({ sem_responsavel: true }); assert.deepEqual(sd.eventos.map((e) => e.evento_id), ['b']);
  assert.deepEqual((await f.listar_agenda({ macro: 'check' })).eventos.map((e) => e.evento_id), ['r']);
  const todas = await f.listar_agenda({ tipo: 'entrega', situacao: 'a_fazer' }); assert.deepEqual(todas.eventos.map((e) => e.evento_id).sort(), ['a', 'b']);
  assert.equal((await f.listar_agenda({})).eventos.some((e) => e.evento_id === 'a'), false, 'sem filtro de atraso segue olhando pra frente');
});

test('excluir um plano com filhas: o cartão AVISA que as filhas ficam avulsas (a tela é que leva junto)', async () => {
  const db = seed({ pai: ev('pai'), f1: ev('f1', { paiId: 'pai' }), f2: ev('f2', { paiId: 'pai' }), solo: ev('solo') }); const f = ferr(db, 'adm');
  const r = await f.propor_agenda_evento({ acao: 'excluir', evento_id: 'pai' });
  assert.equal(r.ok, true); assert.match(r.resumo, /as 2 entregas filhas NÃO são excluídas: ficam avulsas/);
  const s = await f.propor_agenda_evento({ acao: 'excluir', evento_id: 'solo' }); assert.doesNotMatch(s.resumo, /filha/);
});
