// functions/okr/__tests__/pushMural.test.js — push do aviso novo do Mural (ver pushMural.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { runPushMural, deveReceber, alvoTorres } = require('../pushMural');

const tok = (t) => ({ d1: { token: t } });
function seed(extra = {}) {
  return makeFakeDb({
    kanban: {
      config: { adm_emails: ['ana@ciahering.com.br'] },
      usuarios_publicos: { ana: {}, bia: {}, dan: {}, eve: {}, gia: {}, sem: {}, aut: {} },
      usuarios: {
        ana: { email: 'ana@ciahering.com.br', torre: 'digital', fcm_tokens: tok('T-ana') },
        bia: { email: 'bia@ciahering.com.br', torre: 'comercial', fcm_tokens: tok('T-bia') },
        dan: { email: 'dan@ciahering.com.br', torre: 'digital', fcm_tokens: tok('T-dan') },
        eve: { email: 'eve@ciahering.com.br', fcm_tokens: tok('T-eve') },                      // sem torre = digital
        gia: { email: 'gia@ciahering.com.br', torre: 'geral', fcm_tokens: tok('T-gia') },
        sem: { email: 'sem@ciahering.com.br', torre: 'digital' },                               // nunca ativou push
        aut: { email: 'aut@ciahering.com.br', torre: 'comercial', fcm_tokens: tok('T-aut') },   // autor
        ...extra,
      },
    },
  });
}
function fakeMessaging(falhar = {}) {
  const enviados = [];
  return {
    enviados,
    async sendEachForMulticast(msg) {
      enviados.push(msg);
      const responses = msg.tokens.map((t) => (falhar[t] ? { success: false, error: { code: falhar[t] } } : { success: true }));
      return { successCount: responses.filter((r) => r.success).length, failureCount: responses.filter((r) => !r.success).length, responses };
    },
  };
}
const EV = (o = {}) => ({ id: 'f1', tipo: 'mural', torres: ['comercial'], titulo: '🚨 Reunião mudou', sub: 'Urgente · quinta às 10h', muralId: 'm1', autorUid: 'aut', ...o });
const quem = (m) => m.enviados.flatMap((x) => x.tokens).sort();
const silencio = { log: () => {} };

test('aviso da Comercial: vai pra Comercial + ADM + ⭐ Geral; não vai pra Digital, nem pro autor, nem pra quem não ativou push', async () => {
  const db = seed(), m = fakeMessaging();
  const r = await runPushMural(db, m, EV(), silencio);
  assert.deepEqual(quem(m), ['T-ana', 'T-bia', 'T-gia']);
  assert.equal(r.enviados, 3);
});
test('"todas as torres" ({"*"} ou vazio) vai pra todo mundo que tem push (menos o autor)', async () => {
  for (const torres of [['*'], [], undefined]) {
    const m = fakeMessaging(); await runPushMural(seed(), m, EV({ torres }), silencio);
    assert.deepEqual(quem(m), ['T-ana', 'T-bia', 'T-dan', 'T-eve', 'T-gia'], JSON.stringify(torres));
  }
});
test('sem o campo torre = Digital (aviso da Digital chega na Eve)', async () => {
  const m = fakeMessaging(); await runPushMural(seed(), m, EV({ torres: ['digital'] }), silencio);
  assert.deepEqual(quem(m), ['T-ana', 'T-dan', 'T-eve', 'T-gia']);
});
test('Não Perturbe ativo não recebe; expirado recebe; até-desativar não recebe', async () => {
  const agora = Date.now();
  const db = seed({
    bia: { email: 'bia@ciahering.com.br', torre: 'comercial', fcm_tokens: tok('T-bia'), notif_prefs: { dnd: { on: true, until: new Date(agora + 3600e3).toISOString() } } },
    gia: { email: 'gia@ciahering.com.br', torre: 'geral', fcm_tokens: tok('T-gia'), notif_prefs: { dnd: { on: true, until: new Date(agora - 1000).toISOString() } } },
    ana: { email: 'ana@ciahering.com.br', fcm_tokens: tok('T-ana'), notif_prefs: { dnd: { on: true, until: null } } },
  });
  const m = fakeMessaging(); await runPushMural(db, m, EV(), { agora, ...silencio });
  assert.deepEqual(quem(m), ['T-gia']);
});
test('mensagem: só "data" (sem notification), título/corpo do evento, URL completa do OKR com ?mural=, tag por aviso', async () => {
  const m = fakeMessaging(); await runPushMural(seed(), m, EV(), silencio);
  const msg = m.enviados[0];
  assert.equal(msg.notification, undefined);
  assert.equal(msg.data.title, '🚨 Reunião mudou'); assert.equal(msg.data.body, 'Urgente · quinta às 10h');
  assert.equal(msg.data.url, 'https://caiosoares1899.github.io/hering/okr.html?mural=m1'); assert.equal(msg.data.tag, 'mural_m1');
});
test('vários aparelhos da mesma pessoa: 1 envio com todos os tokens', async () => {
  const db = seed({ bia: { email: 'bia@ciahering.com.br', torre: 'comercial', fcm_tokens: { a: { token: 'B1' }, b: { token: 'B2' } } } });
  const m = fakeMessaging(); await runPushMural(db, m, EV(), silencio);
  assert.deepEqual(m.enviados.find((x) => x.tokens.includes('B1')).tokens, ['B1', 'B2']);
});
test('token morto é removido do banco; o resto segue', async () => {
  const db = seed(); const m = fakeMessaging({ 'T-bia': 'messaging/registration-token-not-registered' });
  await runPushMural(db, m, EV(), silencio);
  assert.equal((await db.ref('kanban/usuarios/bia/fcm_tokens/d1').get()).val(), null);
  assert.ok((await db.ref('kanban/usuarios/gia/fcm_tokens/d1').get()).val());
});
test('só tipo "mural": Objetivo criado / Marco concluído não geram push', async () => {
  for (const tipo of ['obj_criado', 'marco_concluido', undefined]) {
    const m = fakeMessaging(); const r = await runPushMural(seed(), m, EV({ tipo }), silencio);
    assert.equal(m.enviados.length, 0); assert.equal(r.enviados, 0);
  }
});
test('lista de ADMs extra vem de config/adm_emails (sem ela, usa os 2 padrão)', async () => {
  const db = makeFakeDb({ kanban: { usuarios_publicos: { x: {} }, usuarios: { x: { email: 'caio.soares@ciahering.com.br', torre: 'digital', fcm_tokens: tok('T-x') } } } });
  const m = fakeMessaging(); await runPushMural(db, m, EV({ torres: ['comercial'] }), silencio);
  assert.deepEqual(quem(m), ['T-x']);
});
test('falha com 1 pessoa não derruba as outras', async () => {
  const m = fakeMessaging(); const orig = m.sendEachForMulticast.bind(m);
  m.sendEachForMulticast = async (msg) => { if (msg.tokens.includes('T-bia')) throw new Error('boom'); return orig(msg); };
  await runPushMural(seed(), m, EV(), silencio);
  assert.deepEqual(quem(m), ['T-ana', 'T-gia']);
});
test('conta de FORA da empresa (freelancer/parceiro) com push ativo NÃO recebe aviso do Mural; @arezzo recebe', async () => {
  const db = seed({
    freela: { email: 'freela@gmail.com', role: 'convidado', torre: 'digital', fcm_tokens: tok('T-freela') },
    parc: { email: 'x@parceiro.com', fcm_tokens: tok('T-parc') },
    az: { email: 'az@arezzo.com.br', torre: 'digital', fcm_tokens: tok('T-az') },
  });
  await db.ref('kanban/usuarios_publicos').update({ freela: {}, parc: {}, az: {} });
  const m = fakeMessaging(); await runPushMural(db, m, EV({ torres: ['*'] }), silencio);
  const q = quem(m);
  assert.ok(!q.includes('T-freela') && !q.includes('T-parc'), 'vazou: ' + q.join(','));
  assert.ok(q.includes('T-az') && q.includes('T-ana'));
});
test('deveReceber / alvoTorres (puras)', () => {
  assert.deepEqual(alvoTorres({ torres: { 0: 'a' } }), ['a']);
  assert.equal(deveReceber({ ev: EV(), uid: 'aut', torre: 'comercial', ehAdm: true }), false);
  assert.equal(deveReceber({ ev: EV(), uid: 'x', torre: undefined, ehAdm: false }), false);
});
