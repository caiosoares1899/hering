// functions/okr/__tests__/modoSoHering.test.js
//
// 🏢 MODO ATUAL (2026-10-08): o Maré atende só a Hering — @ciahering.com.br via Google e UMA torre no OKR (Digital).
// Este arquivo roda com o interruptor LIGADO (padrão de common/mareModo.js). Os arquivos agenteTorres/calendario/dailyScan/pushMural
// ligam MARE_MODO_TESTE=varias-torres e seguem cobrindo o comportamento das 3 torres + Arezzo (pra quando religar).
// Documentação completa: docs/arezzo/MARE_SO_HERING.md
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const modo = require('../../common/mareModo');
const { buildOkrTools } = require('../agenteTools');
const { runPushMural, deveReceber } = require('../pushMural');
const { runOkrDailyScan } = require('../dailyScan');
const { SYSTEM_PROMPT_OKR_V1 } = require('../agentePrompt');

const ADM = 'uid-adm';
const addDias = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const seed = (extra = {}) => makeFakeDb({ kanban: {
  usuarios: { [ADM]: { email: 'caio.soares@ciahering.com.br' }, u1: { email: 'u1@ciahering.com.br' } },
  okr: {
    objetivos: {
      d1: { id: 'd1', titulo: 'Obj Digital', areaId: 'tech', responsaveis: ['u1'] },
      c1: { id: 'c1', titulo: 'Obj Comercial', torre: 'comercial', areaId: 'geral', responsaveis: ['u1'] },
    },
    marcos: { m1: { id: 'm1', objetivoId: 'c1', nome: 'Marco C', prazo: addDias(1), progresso: 'no_prazo' } },
  },
  ...extra,
} });
const tool = (db, name) => buildOkrTools({ mode: 'real', db, requestingUid: ADM, dryRun: false }).find((t) => t.name === name);

test('interruptor: ligado por padrão — empresa = só @ciahering.com.br; torre ativa = só Digital', () => {
  assert.equal(modo.MARE_SO_HERING, true);
  assert.deepEqual(modo.DOMINIOS_EMPRESA, ['ciahering.com.br']);
  assert.deepEqual(modo.TORRES_ATIVAS, ['digital']);
  assert.equal(modo.emailDaEmpresa('a@ciahering.com.br'), true);
  assert.equal(modo.emailDaEmpresa('B@Arezzo.com.br'), false);
  assert.equal(modo.emailDaEmpresa('x@gmail.com'), false);
  assert.equal(modo.torreAtiva(undefined), true);   // sem o campo = Digital
  assert.equal(modo.torreAtiva('digital'), true);
  assert.equal(modo.torreAtiva('comercial'), false);
});

test('push do Mural: conta @arezzo NÃO recebe; aviso dirigido só a outra torre não vai pra ninguém (nem ADM)', async () => {
  const db = makeFakeDb({ kanban: {
    config: { adm_emails: ['ana@ciahering.com.br'] },
    usuarios_publicos: { ana: {}, dan: {}, az: {} },
    usuarios: {
      ana: { email: 'ana@ciahering.com.br', fcm_tokens: { d: { token: 'T-ana' } } },
      dan: { email: 'dan@ciahering.com.br', torre: 'digital', fcm_tokens: { d: { token: 'T-dan' } } },
      az: { email: 'az@arezzo.com.br', torre: 'digital', fcm_tokens: { d: { token: 'T-az' } } },
    },
  } });
  const enviados = [];
  const msg = { async sendEachForMulticast(m) { enviados.push(...m.tokens); return { successCount: m.tokens.length, failureCount: 0, responses: m.tokens.map(() => ({ success: true })) }; } };
  const ev = (o) => ({ id: 'f1', tipo: 'mural', torres: ['*'], titulo: 'x', sub: 'y', muralId: 'm1', autorUid: 'aut', ...o });
  await runPushMural(db, msg, ev(), { log: () => {} });
  assert.deepEqual(enviados.sort(), ['T-ana', 'T-dan']);                                    // az (Microsoft/Arezzo) fica de fora
  enviados.length = 0;
  await runPushMural(db, msg, ev({ torres: ['comercial'] }), { log: () => {} });
  assert.deepEqual(enviados, []);                                                           // só Comercial: ninguém, nem o ADM
  assert.equal(deveReceber({ ev: ev({ torres: ['digital'] }), uid: 'x', torre: 'digital', ehAdm: false }), true);
});

test('scan diário: marco de Objetivo de outra torre não notifica prazo; Objetivo Digital segue notificando', async () => {
  const db = seed();
  await db.ref('kanban/okr/marcos/m2').set({ id: 'm2', objetivoId: 'd1', nome: 'Marco D', prazo: addDias(1), progresso: 'no_prazo' });
  await runOkrDailyScan(db, '2026-09-01');
  const n = Object.values((await db.ref('kanban/usuarios/u1/notificacoes').get()).val() || {}).filter((x) => x.type === 'okr_prazo');
  assert.equal(n.length, 1);
  assert.match(n[0].title + (n[0].sub || ''), /Marco D/);
});

test('Agente: listar_objetivos / resumo_atingimentos / ler_objetivo não enxergam Objetivo de outra torre', async () => {
  const db = seed();
  const l = await tool(db, 'listar_objetivos').handler({});
  assert.deepEqual(l.objetivos.map((o) => o.id), ['d1']);
  const r = await tool(db, 'resumo_atingimentos').handler({});
  assert.ok(!(r.atingimentos || []).some((x) => x.id === 'c1'));
  const lido = await tool(db, 'ler_objetivo').handler({ objetivo_id: 'c1' });
  assert.equal(lido.error, 'objetivo_nao_encontrado');
  assert.equal((await tool(db, 'ler_objetivo').handler({ titulo: 'Comercial' })).error, 'objetivo_nao_encontrado');
});

test('Agente: torre "comercial" nem passa na validação de entrada; criar Objetivo sem torre nasce Digital; prompt só fala de Digital', async () => {
  const db = seed();
  const t = tool(db, 'listar_objetivos');
  assert.deepEqual(t.input_schema.properties.torre.enum, ['digital']);              // o modelo nem consegue pedir outra torre
  assert.deepEqual((await t.handler({ torre: 'comercial' })).objetivos, []);       // e se vier um id/torre à força, não vaza nada
  const g = await tool(db, 'listar_gerencias').handler({});
  assert.deepEqual(g.torres.map((t) => t.torre), ['digital']);
  assert.match(SYSTEM_PROMPT_OKR_V1, /única em uso/);
  assert.doesNotMatch(SYSTEM_PROMPT_OKR_V1, /O OKR tem 3 torres/);
});
