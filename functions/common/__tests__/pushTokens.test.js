// functions/common/__tests__/pushTokens.test.js
//
// 2026-10-13 (/monitorarbugs "ninguém recebe mais push"): só apagar o token quando o token é o culpado. O FCM v1 devolve INVALID_ARGUMENT
// (messaging/invalid-argument) tanto pra token inválido quanto pra MENSAGEM inválida — uma mensagem malformada apagava os tokens de todo mundo.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Module = require('module');

const { tokenMorto, resumirFalhas, falhaGeral } = require('../pushTokens');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');

const err = (code, message) => ({ code, message });

test('tokenMorto: token não registrado / inválido → apaga', () => {
  assert.equal(tokenMorto(err('messaging/registration-token-not-registered', 'Requested entity was not found.')), true);
  assert.equal(tokenMorto(err('messaging/invalid-registration-token', 'x')), true);
  assert.equal(tokenMorto(err('messaging/invalid-argument', 'The registration token is not a valid FCM registration token')), true);
});

test('tokenMorto: invalid-argument de PAYLOAD, credencial, cota e instabilidade → NÃO apaga', () => {
  assert.equal(tokenMorto(err('messaging/invalid-argument', 'Invalid JSON payload received. Unknown name "from" at message.data: Cannot find field.')), false);
  assert.equal(tokenMorto(err('messaging/invalid-argument', 'Android message is too big')), false);
  assert.equal(tokenMorto(err('messaging/mismatched-credential', 'SenderId mismatch')), false);
  assert.equal(tokenMorto(err('messaging/third-party-auth-error', 'x')), false);
  assert.equal(tokenMorto(err('messaging/message-rate-exceeded', 'x')), false);
  assert.equal(tokenMorto(err('messaging/server-unavailable', 'x')), false);
  assert.equal(tokenMorto(undefined), false);
  assert.equal(tokenMorto({}), false);
});

test('resumirFalhas: agrupa por código com contagem e exemplo', () => {
  const r = resumirFalhas([{ success: true }, { success: false, error: err('messaging/invalid-argument', 'a') }, { success: false, error: err('messaging/invalid-argument', 'b') }, { success: false, error: err('messaging/server-unavailable', 'c') }]);
  assert.deepEqual(r, [{ codigo: 'messaging/invalid-argument', qtd: 2, exemplo: 'a' }, { codigo: 'messaging/server-unavailable', qtd: 1, exemplo: 'c' }]);
  assert.deepEqual(resumirFalhas([{ success: true }]), []);
  assert.deepEqual(resumirFalhas(undefined), []);
});

test('falhaGeral: todas falharam por motivo que não é token morto', () => {
  const ruim = { success: false, error: err('messaging/invalid-argument', 'Invalid JSON payload') };
  assert.equal(falhaGeral([ruim, ruim]), true);
  assert.equal(falhaGeral([ruim, { success: true }]), false);                                          // alguém recebeu
  assert.equal(falhaGeral([{ success: false, error: err('messaging/registration-token-not-registered', 'x') }]), false); // só token morto
  assert.equal(falhaGeral([]), false);
});

// ── o handler REAL de sendPushOnNotification, com banco e FCM falsos ──
function carregaHandler(getFcmResponse) {
  const orig = Module._load;
  let handler; let db;
  Module._load = function (req, parent, isMain) {
    if (req === 'firebase-functions/v2/database') return { onValueCreated: (o, h) => { if (o.ref.includes('notificacoes')) handler = h; return h; }, onValueWritten: (o, h) => h, onValueUpdated: (o, h) => h, onValueDeleted: (o, h) => h };
    if (req === 'firebase-functions/v2/scheduler') return { onSchedule: () => () => {} };
    if (req === 'firebase-admin/app') return { initializeApp: () => {} };
    if (req === 'firebase-admin/database') return { getDatabase: () => db };
    if (req === 'firebase-admin/messaging') return { getMessaging: () => ({ sendEachForMulticast: async (m) => getFcmResponse(m) }) };
    if (req === 'firebase-admin/storage') return { getStorage: () => ({}) };
    return orig.apply(this, arguments);
  };
  try {
    const idx = path.join(__dirname, '..', '..', 'index.js');
    delete require.cache[require.resolve(idx)];
    require(idx);
  } finally { Module._load = orig; }
  return { handler, setDb: (d) => { db = d; } };
}
// o fake db deixa a chave com valor null depois de remove() — o Firebase real some com ela
const tokensDe = async (db, uid) => { const v = (await db.ref(`kanban/usuarios/${uid}/fcm_tokens`).get()).val() || {}; return Object.fromEntries(Object.entries(v).filter(([, x]) => x != null)); };
const evento = (type) => ({ params: { uid: 'ana', notifId: 'n1' }, data: { val: () => ({ id: 'n1', type, title: 'T', sub: 'S', cardId: '' }) } });
const silencia = async (fn) => { const l = console.log, e = console.error; console.log = () => {}; console.error = () => {}; try { return await fn(); } finally { console.log = l; console.error = e; } };

test('sendPushOnNotification: mensagem recusada por PAYLOAD não apaga os tokens (antes apagava todos)', async () => {
  const { handler, setDb } = carregaHandler((m) => ({ successCount: 0, failureCount: m.tokens.length, responses: m.tokens.map(() => ({ success: false, error: err('messaging/invalid-argument', 'Invalid JSON payload received.') })) }));
  const db = makeFakeDb({ kanban: { usuarios: { ana: { fcm_tokens: { a: { token: 't1' }, b: { token: 't2' } } } } } }); setDb(db);
  await silencia(() => handler(evento('assigned')));
  assert.deepEqual(Object.keys(await tokensDe(db, 'ana')).sort(), ['a', 'b']);
});

test('sendPushOnNotification: token realmente morto é apagado; o vivo fica', async () => {
  const { handler, setDb } = carregaHandler((m) => ({ successCount: 1, failureCount: 1, responses: [{ success: false, error: err('messaging/registration-token-not-registered', 'Requested entity was not found.') }, { success: true }] }));
  const db = makeFakeDb({ kanban: { usuarios: { ana: { fcm_tokens: { a: { token: 't1' }, b: { token: 't2' } } } } } }); setDb(db);
  await silencia(() => handler(evento('mention')));
  assert.deepEqual(Object.keys(await tokensDe(db, 'ana')), ['b']);
});

test('sendPushOnNotification: invalid-argument que fala do TOKEN apaga só esse token', async () => {
  const { handler, setDb } = carregaHandler((m) => ({ successCount: 1, failureCount: 1, responses: [{ success: true }, { success: false, error: err('messaging/invalid-argument', 'The registration token is not a valid FCM registration token') }] }));
  const db = makeFakeDb({ kanban: { usuarios: { ana: { fcm_tokens: { a: { token: 't1' }, b: { token: 't2' } } } } } }); setDb(db);
  await silencia(() => handler(evento('assigned')));
  assert.deepEqual(Object.keys(await tokensDe(db, 'ana')), ['a']);
});

test('sendPushOnNotification: o log traz os motivos das falhas (código + exemplo)', async () => {
  const { handler, setDb } = carregaHandler((m) => ({ successCount: 0, failureCount: 1, responses: [{ success: false, error: err('messaging/mismatched-credential', 'SenderId mismatch') }] }));
  const db = makeFakeDb({ kanban: { usuarios: { ana: { fcm_tokens: { a: { token: 't1' } } } } } }); setDb(db);
  const linhas = []; const l = console.log, e = console.error; console.log = (x) => linhas.push(String(x)); console.error = (x) => linhas.push('ERR ' + String(x));
  try { await handler(evento('assigned')); } finally { console.log = l; console.error = e; }
  assert.ok(linhas.some((x) => /motivos das falhas/.test(x) && /mismatched-credential/.test(x) && /SenderId mismatch/.test(x)), linhas.join('\n'));
  assert.ok(linhas.some((x) => x.startsWith('ERR ') && /NÃO é token morto/.test(x)), 'falha geral vira console.error');
  assert.deepEqual(Object.keys(await tokensDe(db, 'ana')), ['a']);
});
