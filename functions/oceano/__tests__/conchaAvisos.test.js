// 🐚 Concha — aviso de mensagem nova (functions/oceano/conchaAvisos.js): a decisão por pessoa (pura) e o envio com banco e FCM falsos.
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { tagsEm, nivelDe, decidir, runAvisoMsg, INTERVALO_MS } = require('../conchaAvisos');
const { mencaoValida } = require('../../common/cardumePush');

const AG = 1795600000000;
const base = (o) => Object.assign({ uid: 'bru', autor: 'ana', mencionados: [], pref: null, seguidas: {}, vendoTs: null, dnd: null, empresa: true, ultimoEnvio: null, tagsMsg: [], agora: AG }, o || {});

test('tagsEm: o mesmo critério da página (#1966, código e âncora de link não; acento e marcação sim)', () => {
  assert.deepEqual(tagsEm('Subiu o #Banner da #BlackFriday e a #Promoção (PR #1966) — `#codigo` https://x.com/a#ancora'), ['banner', 'blackfriday', 'promoção']);
  assert.deepEqual(tagsEm('**#negrito** e (#parenteses)'), ['negrito', 'parenteses']);
  assert.deepEqual(tagsEm('a#colado #a #' + 'x'.repeat(33)), []);
  assert.equal(tagsEm(Array.from({ length: 15 }, (_, i) => '#t' + String.fromCharCode(97 + i)).join(' ')).length, 10);
  assert.deepEqual(tagsEm(undefined), []);
});

test('nivelDe: ausente, estranho ou com prazo vencido = todas (o 🔕 de 8 h volta sozinho)', () => {
  assert.equal(nivelDe(null, AG), 'todas');
  assert.equal(nivelDe({ nivel: 'xx' }, AG), 'todas');
  assert.equal(nivelDe({ nivel: 'mencoes' }, AG), 'mencoes', 'sem prazo = sempre');
  assert.equal(nivelDe({ nivel: 'mencoes', ate: AG + 1 }, AG), 'mencoes');
  assert.equal(nivelDe({ nivel: 'nada', ate: AG - 1 }, AG), 'todas', 'prazo vencido');
  assert.equal(nivelDe({ nivel: 'nada', ate: 'amanhã' }, AG), 'todas');
});

test('decidir: a ordem das exceções', () => {
  assert.deepEqual(decidir(base()), { envia: true, motivo: 'todas', tags: [] }, 'padrão: todas as mensagens');
  assert.equal(decidir(base({ uid: 'ana' })).motivo, 'autor');
  assert.equal(decidir(base({ mencionados: ['bru'] })).motivo, 'mencao', 'a menção já tem o push dela');
  assert.equal(decidir(base({ pref: { nivel: 'nada' }, seguidas: { banner: 1 }, tagsMsg: ['banner'] })).motivo, 'nada', '🚫 cala até a #tag seguida');
  assert.equal(decidir(base({ pref: { nivel: 'mencoes' } })).motivo, 'silenciado');
  assert.deepEqual(decidir(base({ pref: { nivel: 'mencoes' }, seguidas: { banner: 1 }, tagsMsg: ['banner', 'x'] })), { envia: true, motivo: 'tag', tags: ['banner'] }, '#tag seguida fura o 🔕');
  assert.equal(decidir(base({ pref: { nivel: 'mencoes', ate: AG - 1 } })).motivo, 'todas', '🔕 vencido volta a avisar');
  assert.equal(decidir(base({ vendoTs: AG - 30000 })).motivo, 'vendo');
  assert.equal(decidir(base({ vendoTs: AG - 90000 })).motivo, 'todas', 'sinal de vida velho não conta');
  assert.equal(decidir(base({ dnd: { on: true } })).motivo, 'dnd');
  assert.equal(decidir(base({ dnd: { on: true, until: new Date(AG - 1).toISOString() } })).motivo, 'todas', 'Não Perturbe vencido');
  assert.equal(decidir(base({ empresa: false })).motivo, 'fora', 'conta de fora da empresa não recebe');
  assert.equal(decidir(base({ ultimoEnvio: AG - 30000 })).motivo, 'trava', 'rajada no mesmo canal: 1 push');
  assert.equal(decidir(base({ ultimoEnvio: AG - INTERVALO_MS - 1 })).motivo, 'todas');
  assert.equal(decidir(base({ ultimoEnvio: AG - 30000, seguidas: { banner: 1 }, tagsMsg: ['banner'] })).motivo, 'tag', '#tag seguida não espera a trava');
});

const fakeMsg = () => { const envios = []; return { envios, sendEachForMulticast: async (m) => { envios.push(m); return { successCount: m.tokens.length, failureCount: m.tokens.filter((t) => t === 'morto').length ? 1 : 0, responses: m.tokens.map((t) => (t === 'morto' ? { success: false, error: { code: 'messaging/registration-token-not-registered' } } : { success: true })) }; } }; };
const pub = (nome) => ({ nome, email: nome.split(' ')[0].toLowerCase() + '@ciahering.com.br' });
const banco = (o) => makeFakeDb({ kanban: {
  usuarios: { bru: { fcm_tokens: { d1: { token: 'tb' }, d2: { token: 'morto' } } }, car: { fcm_tokens: { d1: { token: 'tc' } } }, dan: { fcm_tokens: { d1: { token: 'td' } } }, ext: { fcm_tokens: { d1: { token: 'te' } } }, ana: { fcm_tokens: { d1: { token: 'ta' } } } },
  usuarios_publicos: { ana: pub('Ana Lima'), bru: pub('Bruno Reis'), car: pub('Carla Dias'), dan: pub('Dani Souza'), ext: pub('Ext Fora') },
  cardume: Object.assign({ canais: { dados: { nome: 'Dados' }, 't-priv-ab12': { nome: 'Segredo', tipo: 'tema', dono: 'ana', acesso: 'convite', criado: AG - 864e5 } },
    membros: { dados: { ana: true, bru: true, car: true, dan: true, ext: true }, 't-priv-ab12': { ana: true, bru: true } } }, o || {}),
} });
const emailDe = async (u) => (u === 'ext' ? 'ext@gmail.com' : u + '@ciahering.com.br');

test('runAvisoMsg: avisa os membros pela preferência de cada um; menção, 🚫, vendo e fora da empresa ficam de fora', async () => {
  const db = banco({ avisos: { dan: { dados: { nivel: 'nada' } } }, vendo: { car: { dados: AG - 10000 } } });
  const m = fakeMsg();
  const r = await runAvisoMsg(db, m, 'dados', 'k1', { uid: 'ana', ts: AG - 1000, texto: 'bom dia, time' }, { agora: AG, emailDe, log: () => {} });
  assert.deepEqual(m.envios.map((e) => e.tokens), [['tb', 'morto']], 'só o Bruno (Carla está vendo, Dani em 🚫, ext é de fora, Ana é a autora)');
  assert.equal(m.envios[0].data.title, '🐚 Ana em # Dados');
  assert.equal(m.envios[0].data.tag, 'concha-dados', 'um push por canal no aparelho');
  assert.match(m.envios[0].data.url, /cardume-dev\.html\?c=dados&m=k1$/);
  assert.ok(!/bom dia/.test(JSON.stringify(m.envios[0].data)), 'sem trecho da mensagem');
  assert.equal(r.enviados, 2);
  assert.equal(db._data().kanban.usuarios.bru.fcm_tokens.d2, undefined, 'token morto podado');
  assert.equal(typeof db._data().kanban.cardume.aviso_env.bru.dados, 'number', 'trava gravada');
  const m2 = fakeMsg();
  await runAvisoMsg(db, m2, 'dados', 'k2', { uid: 'ana', ts: AG, texto: 'mais uma' }, { agora: AG + 5000, emailDe, log: () => {} });
  assert.equal(m2.envios.length, 0, 'rajada: a 2ª mensagem não apita de novo');
});

test('runAvisoMsg: quem foi mencionado ou respondido não recebe este aviso (já tem o push da menção); #tag seguida fura o 🔕 e diz a tag', async () => {
  const db = banco({ avisos: { car: { dados: { nivel: 'mencoes', ate: AG + 3600e3 } } }, seguidas: { car: { banner: AG } }, msgs: { dados: { o1: { uid: 'dan', ts: AG - 9e5, texto: 'original' } } } });
  const m = fakeMsg();
  await runAvisoMsg(db, m, 'dados', 'k1', { uid: 'ana', ts: AG - 1000, texto: '@Bruno Reis olha o #Banner', resp: 'o1' }, { agora: AG, emailDe, log: () => {} });
  const por = Object.fromEntries(m.envios.map((e) => [e.tokens[0], e.data]));
  assert.deepEqual(Object.keys(por).sort(), ['tc'], 'Bruno (mencionado) e Dani (respondida) de fora; Carla pela #tag');
  assert.equal(por.tc.title, '🐚 Ana usou #banner em # Dados');
  assert.equal(por.tc.body, 'Você segue #banner');
});

test('runAvisoMsg: mensagem velha (restauração do backup), apagada, canal vencido ou ADM desligou = ninguém', async () => {
  const opts = { agora: AG, emailDe, log: () => {} };
  let m = fakeMsg(); await runAvisoMsg(banco(), m, 'dados', 'k1', { uid: 'ana', ts: AG - 3 * 60000, texto: 'oi' }, opts); assert.equal(m.envios.length, 0, 'mais de 2 min');
  m = fakeMsg(); await runAvisoMsg(banco(), m, 'dados', 'k1', { uid: 'ana', ts: AG, apagada: true }, opts); assert.equal(m.envios.length, 0, 'apagada');
  const venc = banco(); venc._data().kanban.cardume.canais.dados.fim = AG - 1;
  m = fakeMsg(); await runAvisoMsg(venc, m, 'dados', 'k1', { uid: 'ana', ts: AG, texto: 'oi' }, opts); assert.equal(m.envios.length, 0, 'canal vencido');
  const off = banco(); off._data().kanban.notif_config = { cardume_msg: { push: false } };
  m = fakeMsg(); await runAvisoMsg(off, m, 'dados', 'k1', { uid: 'ana', ts: AG, texto: 'oi' }, opts); assert.equal(m.envios.length, 0, 'Central de Notificações');
  m = fakeMsg(); await runAvisoMsg(banco(), m, 'dados', 'k1', { uid: 'zed', ts: AG, texto: 'oi' }, opts); assert.equal(m.envios.length, 0, 'autor que não é membro');
});

test('runAvisoMsg: canal só de convidados não diz o nome no push', async () => {
  const m = fakeMsg();
  await runAvisoMsg(banco(), m, 't-priv-ab12', 'k1', { uid: 'ana', ts: AG, texto: 'oi' }, { agora: AG, emailDe, log: () => {} });
  assert.equal(m.envios[0].data.title, '🐚 Ana num canal privado');
});

test('push de @menção respeita o 🚫 Nada do canal (e só ele)', async () => {
  const agora = Date.now();
  const db = (nivel) => makeFakeDb({ kanban: {
    usuarios_publicos: { ana: { nome: 'Ana Lima' }, bru: { nome: 'Bruno Reis' } },
    cardume: { membros: { dados: { ana: true, bru: true } }, msgs: { dados: { k1: { uid: 'ana', ts: agora, texto: 'oi @Bruno Reis' } } },
      mencoes: { bru: { r1: { c: 'dados', m: 'k1', de: 'ana', ts: agora, n: 'n1' } } }, avisos: nivel ? { bru: { dados: { nivel } } } : {} } } });
  const notif = { type: 'cardume_mencao', cardumeRef: 'r1' };
  assert.equal((await mencaoValida(db(null), 'bru', notif, 'n1')).ok, true, 'padrão');
  assert.equal((await mencaoValida(db('mencoes'), 'bru', notif, 'n1')).ok, true, '🔕 ainda avisa a menção');
  assert.equal((await mencaoValida(db('nada'), 'bru', notif, 'n1')).ok, false, '🚫 nem a menção');
});

test('tagsEm: paridade com a página (cardume-dev.html) — o mesmo texto dá as mesmas #tags nos dois lados', () => {
  const fs = require('fs'), path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'cardume-dev.html'), 'utf8');
  const ini = html.indexOf('const TAG_ANTES'), fim = html.indexOf('\n}', html.indexOf('function tagsEm(txt)')) + 2;
  assert.ok(ini > 0 && fim > ini, 'achei o leitor da página');
  const daPagina = new Function(html.slice(ini, fim) + '\nreturn tagsEm;')();
  for (const t of ['Subiu o #Banner da #BlackFriday e a #Promoção (PR #1966) — `#codigo` https://x.com/a#ancora', '**#negrito** _#it_ (#p) >#q', '```\n#bloco\n``` #fora', '#a #bb #' + 'c'.repeat(32) + ' #' + 'd'.repeat(33), 'x#y #Ção-2 #_x #1a'])
    assert.deepEqual(tagsEm(t), daPagina(t), t);
});

// ═══ 🧵 Assuntos (PR B): 🔔 seguir / 🔕 silenciar por assunto e o nome do assunto no push ═══
const { nivelAssuntoDe } = require('../conchaAvisos');
test('nivelAssuntoDe: ausente, estranho ou vencido = como o canal', () => {
  assert.equal(nivelAssuntoDe(null, AG), 'canal');
  assert.equal(nivelAssuntoDe({ nivel: 'nada' }, AG), 'canal', 'assunto não tem "nada" (isso é do canal)');
  assert.equal(nivelAssuntoDe({ nivel: 'seguir' }, AG), 'seguir');
  assert.equal(nivelAssuntoDe({ nivel: 'mencoes', ate: AG - 1 }, AG), 'canal', 'prazo vencido');
});

test('decidir com assunto: 🔔 seguir fura o 🔕 do canal (não o 🚫); 🔕 do assunto cala mesmo com o canal em todas; #tag seguida fura o 🔕 do assunto', () => {
  assert.equal(decidir(base({ pref: { nivel: 'mencoes' }, prefAssunto: { nivel: 'seguir' } })).motivo, 'assunto', 'canal 🔕 + assunto seguido');
  assert.equal(decidir(base({ pref: { nivel: 'nada' }, prefAssunto: { nivel: 'seguir' } })).motivo, 'nada', '🚫 do canal vence');
  assert.equal(decidir(base({ prefAssunto: { nivel: 'mencoes' } })).motivo, 'assunto_silenciado', 'assunto 🔕 com canal em todas');
  assert.equal(decidir(base({ prefAssunto: { nivel: 'mencoes' }, seguidas: { banner: 1 }, tagsMsg: ['banner'] })).motivo, 'tag', '#tag seguida fura o 🔕 do assunto');
  assert.equal(decidir(base({ prefAssunto: { nivel: 'mencoes' }, mencionados: ['bru'] })).motivo, 'mencao', 'a menção tem o push dela');
  assert.equal(decidir(base({ prefAssunto: { nivel: 'seguir' }, ultimoEnvio: AG - 30000 })).motivo, 'trava', 'assunto seguido respeita a trava de rajada');
  assert.equal(decidir(base({ prefAssunto: { nivel: 'seguir' }, vendoTs: AG - 1000 })).motivo, 'vendo');
});

test('runAvisoMsg com assunto: nome no push e ?a= no link; canal só de convidados esconde o assunto; preferências do assunto valem', async () => {
  const db = banco({ assuntos: { dados: { abf: { n: 'banner da Black Friday', por: 'ana', criado: AG - 864e5 } }, 't-priv-ab12': { asec: { n: 'segredo de estado', por: 'ana', criado: AG - 864e5 } } },
    avisos: { car: { dados: { nivel: 'mencoes' } } }, avisos_a: { car: { dados: { abf: { nivel: 'seguir' } } }, dan: { dados: { abf: { nivel: 'mencoes' } } } } });
  const m = fakeMsg();
  await runAvisoMsg(db, m, 'dados', 'k1', { uid: 'ana', ts: AG - 1000, texto: 'arte nova', a: 'abf' }, { agora: AG, emailDe, log: () => {} });
  const por = Object.fromEntries(m.envios.map((e) => [e.tokens[0], e.data]));
  assert.deepEqual(Object.keys(por).sort(), ['tb', 'tc'], 'Bruno (canal em todas) e Carla (canal 🔕, assunto 🔔); Dani (assunto 🔕) não');
  assert.equal(por.tb.title, '🐚 Ana em # Dados › banner da Black Friday');
  assert.match(por.tb.url, /cardume-dev\.html\?c=dados&a=abf&m=k1$/);
  assert.equal(por.tc.body, 'Você segue o assunto');
  const m2 = fakeMsg();
  await runAvisoMsg(banco({ assuntos: { 't-priv-ab12': { asec: { n: 'segredo de estado', por: 'ana', criado: AG - 864e5 } } } }), m2, 't-priv-ab12', 'k1', { uid: 'ana', ts: AG, texto: 'oi', a: 'asec' }, { agora: AG, emailDe, log: () => {} });
  assert.equal(m2.envios[0].data.title, '🐚 Ana num canal privado', 'nem o nome do assunto');
  assert.ok(!/segredo/.test(JSON.stringify(m2.envios[0].data)));
});
