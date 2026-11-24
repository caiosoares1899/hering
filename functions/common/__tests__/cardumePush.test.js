const test = require('node:test');
const assert = require('node:assert/strict');
const { mencionadosNoTexto, mencaoConfere, mencaoValida } = require('../cardumePush');

const nomes = { ana: 'Ana Lima', ann: 'Ana', bru: 'Bruno Reis', cai: 'Caio Soares' };
const membros = { ana: true, ann: true, bru: true, cai: true };
const notif = { type: 'cardume_mencao', cardumeRef: 'x1', title: 'texto do navegador', sub: 'qualquer coisa' };
const rec = { c: 'dados', m: '-Nmsg1', de: 'cai', ts: Date.now(), n: 'n123' };
const msg = { uid: 'cai', ts: 1, texto: 'oi @Ana Lima, tudo certo?' };
const arvore = { kanban: { cardume: { mencoes: { ana: { x1: rec } }, msgs: { dados: { '-Nmsg1': msg } }, membros: { dados: membros } },
  usuarios_publicos: Object.fromEntries(Object.entries(nomes).map(([u, n]) => [u, { nome: n }])) } };
const fakeDb = a => ({ ref: p => ({ get: async () => ({ val: () => p.split('/').reduce((x, k) => (x == null ? null : x[k]), a) ?? null }) }) });

test('parser igual ao da tela: nome mais longo, com borda, fora de código, com marcação em volta', () => {
  assert.deepEqual(mencionadosNoTexto('oi @Ana Lima', nomes), ['ana']);
  assert.deepEqual(mencionadosNoTexto('oi @Ana, tudo?', nomes), ['ann']);
  assert.deepEqual(mencionadosNoTexto('**@Ana Lima** e _@Bruno Reis_', nomes).sort(), ['ana', 'bru']);
  assert.deepEqual(mencionadosNoTexto('`@Ana Lima` e ```\n@Bruno Reis\n```', nomes), []);
  assert.deepEqual(mencionadosNoTexto('e-mail ana@Ana Lima', nomes), [], '@ grudado em palavra não é menção');
  assert.deepEqual(mencionadosNoTexto('@Analu', nomes), [], 'sem borda depois do nome');
});

test('push só se o registro aponta para ESTA notificação E a mensagem menciona de fato a pessoa', () => {
  assert.equal(mencaoConfere(notif, 'n123', 'ana', rec, msg, membros, nomes), true);
  assert.equal(mencaoConfere(notif, 'n999', 'ana', rec, msg, membros, nomes), false, 'cardumeRef real copiado para outra notificação (replay)');
  assert.equal(mencaoConfere(notif, 'n123', 'ana', null, msg, membros, nomes), false, 'sem registro (notificação forjada)');
  assert.equal(mencaoConfere(notif, 'n123', 'ann', rec, msg, membros, nomes), false, '"@Ana Lima" não autoriza push para a "Ana"');
  assert.equal(mencaoConfere(notif, 'n123', 'bru', rec, msg, membros, nomes), false, 'mensagem SEM menção à pessoa não autoriza push');
  assert.equal(mencaoConfere(notif, 'n123', 'ana', rec, Object.assign({}, msg, { uid: 'bru' }), membros, nomes), false, 'mensagem de outra pessoa');
  assert.equal(mencaoConfere(notif, 'n123', 'ana', rec, { uid: 'cai', ts: 1, apagada: true }, membros, nomes), false, 'mensagem apagada');
  assert.equal(mencaoConfere(notif, 'n123', 'ana', rec, msg, Object.assign({}, membros, { ana: null }), nomes), false, 'saiu do canal');
  assert.equal(mencaoConfere(notif, 'n123', 'ana', Object.assign({}, rec, { lida: true }), msg, membros, nomes), false, 'registro já lido (replay depois de limpar o Sino)');
  assert.equal(mencaoConfere(notif, 'n123', 'ana', Object.assign({}, rec, { ts: Date.now() - 6 * 60 * 1000 }), msg, membros, nomes), false, 'registro velho (replay tardio)');
  assert.equal(mencaoConfere(notif, 'n123', 'ana', Object.assign({}, rec, { ts: Date.now() - 4 * 60 * 1000 }), msg, membros, nomes), true, 'dentro da janela');
  assert.equal(mencaoConfere(notif, 'n123', 'ana', Object.assign({}, rec, { ts: undefined }), msg, membros, nomes), false, 'sem ts');
  assert.equal(mencaoConfere({ type: 'mention', cardumeRef: 'x1' }, 'n123', 'ana', rec, msg, membros, nomes), false, 'outro tipo');
});

test('mencaoValida lê tudo, monta o texto do push no servidor (ignora o do navegador) e nunca lança', async () => {
  const r = await mencaoValida(fakeDb(arvore), 'ana', notif, 'n123');
  assert.deepEqual(r, { ok: true, title: '🐟 Cardume', body: 'Caio te mencionou' });
  assert.equal((await mencaoValida(fakeDb(arvore), 'ana', notif, 'n1')).ok, false);
  assert.equal((await mencaoValida(fakeDb(arvore), 'bru', notif, 'n123')).ok, false, 'registro é de outra pessoa');
  assert.equal((await mencaoValida({ ref: () => ({ get: async () => { throw new Error('rede'); } }) }, 'ana', notif, 'n123')).ok, false, 'erro = sem push');
});
