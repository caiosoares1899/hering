// functions/okr/__tests__/agenteAtingimento.test.js
//
// Ferramentas de ATINGIMENTO do Agente Ágil no OKR (agenteTools.js): resumo_atingimentos, registrar_atingimento,
// configurar_atingimento + o que ler_objetivo/listar_objetivos passaram a devolver. mode:'real' com fake db.
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { buildOkrTools } = require('../agenteTools');
const { SYSTEM_PROMPT_OKR_V1 } = require('../agentePrompt');

const ADM = 'uid-adm', RESP = 'uid-resp', OUTRO = 'uid-outro', PART = 'uid-part';
const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const dia = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

function seed(atingimento, extraObj) {
  return makeFakeDb({
    kanban: {
      usuarios: {
        [ADM]: { email: 'caio.soares@ciahering.com.br' },
        [RESP]: { email: 'resp@ciahering.com.br' },
        [OUTRO]: { email: 'outro@ciahering.com.br' },
        [PART]: { email: 'part@ciahering.com.br' },
      },
      okr: {
        objetivos: {
          o1: { id: 'o1', titulo: 'Receita do trimestre', areaId: 'comercial', responsaveis: [RESP], arquivado: false, ...(atingimento ? { atingimento } : {}), ...(extraObj || {}) },
          o2: { id: 'o2', titulo: 'Sem meta', areaId: 'tech', responsaveis: [RESP], arquivado: false },
          o3: { id: 'o3', titulo: 'Arquivado', areaId: 'tech', responsaveis: [], arquivado: true, atingimento: { tipo: 'numero', inicial: 0, meta: 10, lancamentos: [{ id: 'z', em: '2026-10-01', valor: 5, criadoEm: 'x' }] } },
        },
        marcos: {
          m1: { id: 'm1', objetivoId: 'o1', nome: 'A', progresso: 'concluido', participantes: [PART] },
          m2: { id: 'm2', objetivoId: 'o1', nome: 'B', progresso: 'no_prazo' },
          m3: { id: 'm3', objetivoId: 'o2', nome: 'C', progresso: 'concluido' },
          m4: { id: 'm4', objetivoId: 'o2', nome: 'D', progresso: 'concluido' },
        },
      },
    },
  });
}
const FIN = (lancs) => ({ tipo: 'financeira', moeda: 'BRL', inicial: 0, meta: 100000, lancamentos: lancs || [] });
const tool = (db, uid, name, dryRun = false) => buildOkrTools({ mode: 'real', db, requestingUid: uid, dryRun }).find((t) => t.name === name);
const objDe = async (db, id = 'o1') => (await db.ref('kanban/okr/objetivos/' + id).get()).val();
const temUndefined = (v) => v === undefined || (v && typeof v === 'object' && Object.values(v).some(temUndefined));

// ── leitura ──────────────────────────────────────────────────────────────

test('buildOkrTools: as 3 ferramentas novas existem, com schema e descrição', () => {
  const nomes = buildOkrTools().map((t) => t.name);
  for (const n of ['resumo_atingimentos', 'registrar_atingimento', 'configurar_atingimento']) assert.ok(nomes.includes(n), n);
  const t = buildOkrTools().find((x) => x.name === 'configurar_atingimento');
  assert.ok(t.input_schema.properties.tipo.enum.includes('perene'));
  assert.ok(t.description.length > 100);
});

test('prompt do agente cita as ferramentas de atingimento e a regra de não inventar valor', () => {
  for (const n of ['resumo_atingimentos', 'registrar_atingimento', 'configurar_atingimento', 'confirmar_recalculo']) assert.ok(SYSTEM_PROMPT_OKR_V1.includes(n), n);
  assert.match(SYSTEM_PROMPT_OKR_V1, /NUNCA invente um valor/);
});

test('ler_objetivo: devolve atingimento (tipo, meta, atual, %) e o % da barra vindo do atingimento', async () => {
  const db = seed(FIN([{ id: 'a', em: '2026-09-01', valor: 20000, criadoEm: 'x' }, { id: 'b', em: '2026-10-01', valor: 77500, criadoEm: 'y', por: 'Ana' }]));
  const r = await tool(db, OUTRO, 'ler_objetivo').handler({ objetivo_id: 'o1' });
  assert.equal(r.progresso_pct, 78);
  assert.equal(r.progresso_origem, 'atingimento');
  assert.equal(r.atingimento.tipo, 'financeira');
  assert.equal(r.atingimento.meta_texto.replace(/\s/g, ' '), 'R$ 100.000,00');
  assert.equal(r.atingimento.atual.valor, 77500);
  assert.equal(r.atingimento.registros_recentes.length, 2);
});

test('ler_objetivo: sem atingimento -> atingimento null e % pelos marcos; perene também pelos marcos', async () => {
  const db = seed(null);
  const r = await tool(db, OUTRO, 'ler_objetivo').handler({ objetivo_id: 'o2' });
  assert.equal(r.atingimento, null);
  assert.equal(r.progresso_origem, 'marcos');
  assert.equal(r.progresso_pct, 100);
  const db2 = seed({ tipo: 'perene' });
  const p = await tool(db2, OUTRO, 'ler_objetivo').handler({ objetivo_id: 'o1' });
  assert.equal(p.progresso_pct, 50); // 1 de 2 marcos
  assert.equal(p.atingimento.perene, true);
});

test('listar_objetivos: cada Objetivo traz progresso_pct, origem e tipo de atingimento', async () => {
  const db = seed(FIN([{ id: 'a', em: '2026-10-01', valor: 40000, criadoEm: 'x' }]));
  const r = await tool(db, OUTRO, 'listar_objetivos').handler({});
  const o1 = r.objetivos.find((o) => o.id === 'o1'), o2 = r.objetivos.find((o) => o.id === 'o2');
  assert.deepEqual([o1.progresso_pct, o1.progresso_origem, o1.atingimento_tipo], [40, 'atingimento', 'financeira']);
  assert.deepEqual([o2.progresso_pct, o2.progresso_origem, o2.atingimento_tipo], [100, 'marcos', null]);
});

test('resumo_atingimentos: lista só quem tem atingimento (ativo), conta os sem atingimento e nunca traz arquivado', async () => {
  const db = seed(FIN([{ id: 'a', em: dia(-3), valor: 40000, criadoEm: 'x' }]));
  const r = await tool(db, OUTRO, 'resumo_atingimentos').handler({});
  assert.equal(r.total, 1);
  assert.equal(r.objetivos_sem_atingimento, 1);
  assert.equal(r.atingimentos[0].id, 'o1');
  assert.equal(r.atingimentos[0].pct, 40);
  assert.equal(r.atingimentos[0].dias_desde_ultimo_registro, 3);
});

test('resumo_atingimentos: sem_registro_ha_dias separa desatualizados (e quem nunca registrou) de quem está em dia', async () => {
  const recente = seed(FIN([{ id: 'a', em: dia(-2), valor: 1, criadoEm: 'x' }]));
  assert.equal((await tool(recente, OUTRO, 'resumo_atingimentos').handler({ sem_registro_ha_dias: 7 })).total, 0);
  const velho = seed(FIN([{ id: 'a', em: dia(-20), valor: 1, criadoEm: 'x' }]));
  assert.equal((await tool(velho, OUTRO, 'resumo_atingimentos').handler({ sem_registro_ha_dias: 7 })).total, 1);
  const nunca = seed(FIN([]));
  const rn = await tool(nunca, OUTRO, 'resumo_atingimentos').handler({ sem_registro_ha_dias: 7 });
  assert.equal(rn.total, 1);
  assert.equal(rn.atingimentos[0].ultimo_registro, null);
});

test('resumo_atingimentos: filtra por gerência e trata perene com o % dos marcos; entrada inválida vira erro, não exceção', async () => {
  const db = seed({ tipo: 'perene' });
  const r = await tool(db, OUTRO, 'resumo_atingimentos').handler({ area_id: 'comercial' });
  assert.equal(r.atingimentos[0].perene, true);
  assert.equal(r.atingimentos[0].progresso_pct_por_marcos, 50);
  assert.equal((await tool(db, OUTRO, 'resumo_atingimentos').handler({ area_id: 'tech' })).total, 0);
  // gerência é livre por torre (2026-10-07): id desconhecido no filtro = 0 resultados; a entrada inválida agora é o resto do schema
  assert.equal((await tool(db, OUTRO, 'resumo_atingimentos').handler({ area_id: 'inexistente' })).total, 0);
  const ruim = await tool(db, OUTRO, 'resumo_atingimentos').handler({ sem_registro_ha_dias: 0 });
  assert.equal(ruim.ok, false);
  assert.equal(ruim.error, 'entrada_invalida');
});

// ── registrar_atingimento ────────────────────────────────────────────────

test('registrar_atingimento: Responsável registra valor numérico; grava registro, histórico "ating" e notifica quem não pediu', async () => {
  const db = seed(FIN([{ id: 'a', em: '2026-09-01', valor: 20000, criadoEm: 'x' }]));
  const r = await tool(db, RESP, 'registrar_atingimento').handler({ objetivo_id: 'o1', valor: 'R$ 48.000', data: '2026-10-05', nota: 'fechamento de setembro' });
  assert.equal(r.ok, true);
  assert.equal(r.registro.pct, 48);
  assert.equal(r.atingimento_pct_do_objetivo, 48);
  const o = await objDe(db);
  assert.equal(o.atingimento.lancamentos.length, 2);
  const novo = o.atingimento.lancamentos[1];
  assert.deepEqual([novo.valor, novo.em, novo.nota, novo.por, novo.uid, novo.pedidoPor], [48000, '2026-10-05', 'fechamento de setembro', '🤖 Agente Ágil', 'agente-agil', RESP]);
  assert.equal(o.atingimento.meta, 100000); // não mexeu na config
  const h = o.history.filter((x) => x.tipo === 'ating');
  assert.equal(h.length, 1);
  assert.match(h[0].what, /^registrou atingimento de 05\/10\/2026: R\$\s48\.000,00 → 48% \(via chat\)$/);
  assert.ok(!temUndefined(o));
  // notificações: o participante de marco é avisado; quem pediu não
  const nPart = (await db.ref('kanban/usuarios/' + PART + '/notificacoes').get()).val();
  assert.equal(Object.values(nPart)[0].type, 'okr_editado');
  assert.equal((await db.ref('kanban/usuarios/' + RESP + '/notificacoes').get()).val(), null);
});

test('registrar_atingimento: data padrão = hoje (São Paulo)', async () => {
  const db = seed(FIN());
  await tool(db, ADM, 'registrar_atingimento').handler({ objetivo_id: 'o1', valor: 10 });
  assert.equal((await objDe(db)).atingimento.lancamentos[0].em, hoje());
});

test('registrar_atingimento: binário exige atingido; grava valor 100/0 como o painel', async () => {
  const db = seed({ tipo: 'binario', moeda: 'NUM', inicial: 0, meta: 100, lancamentos: [] });
  const sem = await tool(db, RESP, 'registrar_atingimento').handler({ objetivo_id: 'o1' });
  assert.equal(sem.error, 'faltou_valor');
  const ok = await tool(db, RESP, 'registrar_atingimento').handler({ objetivo_id: 'o1', atingido: true, data: '2026-10-05' });
  assert.equal(ok.registro.pct, 100);
  assert.equal(ok.registro.texto, '✅ Atingido');
  const l = (await objDe(db)).atingimento.lancamentos[0];
  assert.deepEqual([l.atingido, l.valor], [true, 100]);
});

test('registrar_atingimento: "Data de entrega" exige a data e o % vem da faixa em que ela cai', async () => {
  const db = seed({ tipo: 'data', moeda: 'NUM', inicial: 0, meta: 100, datas: [{ de: '2026-10-01', ate: '2026-10-15', pct: 80 }], lancamentos: [] });
  assert.equal((await tool(db, RESP, 'registrar_atingimento').handler({ objetivo_id: 'o1' })).error, 'faltou_data');
  const r = await tool(db, RESP, 'registrar_atingimento').handler({ objetivo_id: 'o1', data: '2026-10-07' });
  assert.equal(r.registro.pct, 80);
  assert.equal(r.registro.texto, '📦 Entregue em 07/10/2026');
  const fora = await tool(db, RESP, 'registrar_atingimento').handler({ objetivo_id: 'o1', data: '2026-12-01' });
  assert.equal(fora.registro.pct, 0); // fora de todas as faixas
});

test('registrar_atingimento: manter acima/abaixo dá 100% ou 0%', async () => {
  const db = seed({ tipo: 'acima', moeda: 'PCT', inicial: 0, meta: 95, lancamentos: [] });
  assert.equal((await tool(db, RESP, 'registrar_atingimento').handler({ objetivo_id: 'o1', valor: 96, data: '2026-10-01' })).registro.pct, 100);
  assert.equal((await tool(db, RESP, 'registrar_atingimento').handler({ objetivo_id: 'o1', valor: '90 %', data: '2026-10-02' })).registro.pct, 0);
});

test('registrar_atingimento: recusa sem permissão, perene, sem atingimento, valor inválido, ausente ou data mal formada — e não grava nada', async () => {
  const db = seed(FIN());
  const antes = JSON.stringify(await objDe(db));
  assert.equal((await tool(db, OUTRO, 'registrar_atingimento').handler({ objetivo_id: 'o1', valor: 1 })).error, 'sem_permissao');
  assert.equal((await tool(db, RESP, 'registrar_atingimento').handler({ objetivo_id: 'o1', valor: 'muito' })).error, 'valor_invalido');
  assert.equal((await tool(db, RESP, 'registrar_atingimento').handler({ objetivo_id: 'o1' })).error, 'faltou_valor');
  assert.equal((await tool(db, RESP, 'registrar_atingimento').handler({ objetivo_id: 'o1', valor: 1, data: '05/10/2026' })).error, 'entrada_invalida');
  assert.equal((await tool(db, RESP, 'registrar_atingimento').handler({ objetivo_id: 'o2', valor: 1 })).error, 'sem_atingimento');
  assert.equal((await tool(db, RESP, 'registrar_atingimento').handler({ objetivo_id: 'inexistente', valor: 1 })).error, 'objetivo_nao_encontrado');
  assert.equal(JSON.stringify(await objDe(db)), antes);
  const dbP = seed({ tipo: 'perene' });
  assert.equal((await tool(dbP, RESP, 'registrar_atingimento').handler({ objetivo_id: 'o1', valor: 1 })).error, 'atingimento_perene');
});

test('registrar_atingimento: ADM registra mesmo sem ser Responsável; achar por título funciona', async () => {
  const db = seed(FIN());
  const r = await tool(db, ADM, 'registrar_atingimento').handler({ titulo_objetivo: 'receita do trim', valor: 5000, data: '2026-10-05' });
  assert.equal(r.ok, true);
});

test('registrar_atingimento: dryRun não grava, mas mostra data, texto e %', async () => {
  const db = seed(FIN());
  const r = await tool(db, RESP, 'registrar_atingimento', true).handler({ objetivo_id: 'o1', valor: 25000, data: '2026-10-05' });
  assert.equal(r.dryRun, true);
  assert.equal(r.wouldHaveExecuted.pct, 25);
  assert.equal(((await objDe(db)).atingimento.lancamentos || []).length, 0); // nada foi gravado
});

test('registrar_atingimento: NÃO sobrescreve registro lançado por outra pessoa (transação sobre a lista)', async () => {
  const db = seed(FIN([{ id: 'do_bruno', em: '2026-10-02', valor: 30000, criadoEm: 'x', por: 'Bruno' }]));
  await tool(db, RESP, 'registrar_atingimento').handler({ objetivo_id: 'o1', valor: 50000, data: '2026-10-05' });
  await tool(db, RESP, 'registrar_atingimento').handler({ objetivo_id: 'o1', valor: 60000, data: '2026-10-06' });
  const ls = (await objDe(db)).atingimento.lancamentos;
  assert.deepEqual(ls.map((l) => l.valor), [30000, 50000, 60000]);
});

test('registrar_atingimento: lista que o RTDB devolve como objeto {idx:item} (com buraco) também é preservada', async () => {
  const db = seed({ ...FIN(), lancamentos: { 0: { id: 'a', em: '2026-10-01', valor: 10, criadoEm: 'x' }, 2: { id: 'c', em: '2026-10-02', valor: 20, criadoEm: 'y' } } });
  await tool(db, RESP, 'registrar_atingimento').handler({ objetivo_id: 'o1', valor: 30, data: '2026-10-03' });
  assert.equal((await objDe(db)).atingimento.lancamentos.length, 3);
});

// ── configurar_atingimento ───────────────────────────────────────────────

test('configurar_atingimento: cria atingimento financeiro num Objetivo sem meta (histórico "configurou…")', async () => {
  const db = seed(null);
  const r = await tool(db, RESP, 'configurar_atingimento').handler({ objetivo_id: 'o2', tipo: 'financeira', meta: 'R$ 100.000', valor_inicial: 0 });
  assert.equal(r.ok, true);
  const o = await objDe(db, 'o2');
  assert.deepEqual([o.atingimento.tipo, o.atingimento.moeda, o.atingimento.inicial, o.atingimento.meta], ['financeira', 'BRL', 0, 100000]);
  assert.ok(o.atingimento.datas == null); // só o tipo Data de entrega guarda faixas
  assert.match(o.history.find((h) => h.tipo === 'ating').what, /^configurou o atingimento \(Financeira\) \(via chat\)$/);
  assert.ok(!temUndefined(o));
  assert.equal(r.atingimento.tipo, 'financeira');
});

test('configurar_atingimento: moeda por tipo (porcentagem = PCT, número = NUM, acima/abaixo escolhem) e financeira só BRL/USD/EUR', async () => {
  const db = seed(null);
  await tool(db, ADM, 'configurar_atingimento').handler({ objetivo_id: 'o2', tipo: 'porcentagem', meta: 80, moeda: 'BRL' });
  assert.equal((await objDe(db, 'o2')).atingimento.moeda, 'PCT');
  await tool(db, ADM, 'configurar_atingimento').handler({ objetivo_id: 'o2', tipo: 'acima', meta: 50000, moeda: 'USD', confirmar_recalculo: true });
  assert.equal((await objDe(db, 'o2')).atingimento.moeda, 'USD');
  const ruim = await tool(db, ADM, 'configurar_atingimento').handler({ objetivo_id: 'o2', tipo: 'financeira', meta: 1, moeda: 'PCT', confirmar_recalculo: true });
  assert.equal(ruim.error, 'moeda_invalida');
});

test('configurar_atingimento: tipos com meta exigem a meta; não herda o "100" de enfeite de binário/perene', async () => {
  const db = seed({ tipo: 'perene', moeda: 'NUM', inicial: 0, meta: 100, lancamentos: [] });
  assert.equal((await tool(db, RESP, 'configurar_atingimento').handler({ objetivo_id: 'o1', tipo: 'numero' })).error, 'faltou_meta');
  assert.equal((await tool(db, RESP, 'configurar_atingimento').handler({ objetivo_id: 'o1', tipo: 'numero', meta: 'abc' })).error, 'valor_invalido');
  assert.equal((await tool(db, RESP, 'configurar_atingimento').handler({ objetivo_id: 'o1', tipo: 'numero', meta: 500 })).ok, true);
});

test('configurar_atingimento: "Data de entrega" exige faixas válidas (de ≤ ate); aceita e grava', async () => {
  const db = seed(null);
  assert.equal((await tool(db, RESP, 'configurar_atingimento').handler({ objetivo_id: 'o2', tipo: 'data' })).error, 'faltou_faixas');
  const inv = await tool(db, RESP, 'configurar_atingimento').handler({ objetivo_id: 'o2', tipo: 'data', faixas: [{ de: '2026-10-15', ate: '2026-10-01', pct: 100 }] });
  assert.equal(inv.error, 'faixa_invalida');
  const ok = await tool(db, RESP, 'configurar_atingimento').handler({ objetivo_id: 'o2', tipo: 'data', faixas: [{ de: '2026-10-01', ate: '2026-10-15', pct: 100 }, { de: '2026-10-16', ate: '2026-10-31', pct: 60.4 }] });
  assert.equal(ok.ok, true);
  assert.deepEqual((await objDe(db, 'o2')).atingimento.datas.map((f) => f.pct), [100, 60]);
});

test('configurar_atingimento: perene não pede meta e vale pro histórico', async () => {
  const db = seed(null);
  const r = await tool(db, RESP, 'configurar_atingimento').handler({ objetivo_id: 'o2', tipo: 'perene' });
  assert.equal(r.ok, true);
  assert.equal(r.atingimento.perene, true);
  assert.match((await objDe(db, 'o2')).history.at(-1).what, /Perene/);
});

test('configurar_atingimento: trocar o tipo com registros exige confirmação; com confirmar_recalculo troca e MANTÉM os registros', async () => {
  const db = seed(FIN([{ id: 'a', em: '2026-10-01', valor: 50000, criadoEm: 'x' }]));
  const pede = await tool(db, RESP, 'configurar_atingimento').handler({ objetivo_id: 'o1', tipo: 'numero', meta: 200 });
  assert.equal(pede.error, 'precisa_confirmar');
  assert.match(pede.message, /1 registro/);
  assert.equal((await objDe(db)).atingimento.tipo, 'financeira'); // nada mudou
  const ok = await tool(db, RESP, 'configurar_atingimento').handler({ objetivo_id: 'o1', tipo: 'numero', meta: 200, confirmar_recalculo: true });
  assert.equal(ok.ok, true);
  const o = await objDe(db);
  assert.equal(o.atingimento.tipo, 'numero');
  assert.equal(o.atingimento.lancamentos.length, 1);
  assert.match(o.history.at(-1).what, /^alterou o tipo do atingimento: Financeira → Número \(#\) \(via chat\)$/);
});

test('configurar_atingimento: mesmo tipo, nova meta — não pede confirmação, mantém registros e loga a mudança de meta', async () => {
  const db = seed(FIN([{ id: 'a', em: '2026-10-01', valor: 50000, criadoEm: 'x' }]));
  const r = await tool(db, RESP, 'configurar_atingimento').handler({ objetivo_id: 'o1', tipo: 'financeira', meta: 200000 });
  assert.equal(r.ok, true);
  const o = await objDe(db);
  assert.equal(o.atingimento.meta, 200000);
  assert.equal(o.atingimento.lancamentos.length, 1);
  assert.match(o.history.at(-1).what, /alterou a meta do atingimento: R\$\s100\.000,00 → R\$\s200\.000,00/);
  assert.equal(r.atingimento.pct, 25); // 50 mil de 200 mil
});

test('configurar_atingimento: idêntico ao que já existe = nada_pra_alterar; sem permissão e dryRun não gravam', async () => {
  const db = seed(FIN());
  assert.equal((await tool(db, RESP, 'configurar_atingimento').handler({ objetivo_id: 'o1', tipo: 'financeira', meta: 100000 })).error, 'nada_pra_alterar');
  assert.equal((await tool(db, OUTRO, 'configurar_atingimento').handler({ objetivo_id: 'o1', tipo: 'financeira', meta: 1 })).error, 'sem_permissao');
  const dry = await tool(db, RESP, 'configurar_atingimento', true).handler({ objetivo_id: 'o1', tipo: 'financeira', meta: 1 });
  assert.equal(dry.dryRun, true);
  assert.equal((await objDe(db)).atingimento.meta, 100000);
  assert.equal((await tool(db, RESP, 'configurar_atingimento').handler({ objetivo_id: 'o1', tipo: 'inventado', meta: 1 })).error, 'entrada_invalida');
});

test('configurar_atingimento: update() preserva registros lançados por outra pessoa entre a leitura e a escrita', async () => {
  const db = seed(FIN([{ id: 'a', em: '2026-10-01', valor: 50000, criadoEm: 'x' }]));
  await tool(db, RESP, 'configurar_atingimento').handler({ objetivo_id: 'o1', tipo: 'financeira', meta: 300000 });
  await db.ref('kanban/okr/objetivos/o1/atingimento/lancamentos').transaction((cur) => [...cur, { id: 'b', em: '2026-10-03', valor: 60000, criadoEm: 'y' }]);
  await tool(db, RESP, 'configurar_atingimento').handler({ objetivo_id: 'o1', tipo: 'financeira', meta: 400000 });
  assert.equal((await objDe(db)).atingimento.lancamentos.length, 2);
});

test('fluxo completo: configurar → registrar → ler mostra o % novo', async () => {
  const db = seed(null);
  await tool(db, RESP, 'configurar_atingimento').handler({ objetivo_id: 'o2', tipo: 'numero', meta: 20, valor_inicial: 0 });
  await tool(db, RESP, 'registrar_atingimento').handler({ objetivo_id: 'o2', valor: 5, data: '2026-10-01' });
  const r = await tool(db, OUTRO, 'ler_objetivo').handler({ objetivo_id: 'o2' });
  assert.equal(r.progresso_pct, 25);
  assert.equal(r.progresso_origem, 'atingimento');
  assert.equal(r.atingimento.atual.valor, 5);
});
