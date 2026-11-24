// functions/rules/__tests__/cardumeRules.test.js
//
// 🐟 Cardume v0 (24/11/2026): chat do time no Oceano. Canal = squad, PRIVADO: só quem o ADM pôs em
// kanban/cardume/membros/{squad} lê e escreve (o campo usuarios/{uid}/squads é self-service e não serve para privacidade).
// O ADM lê todos os canais e pode apagar (moderação). Apagar = tombstone sem texto; só o ADM remove o nó.
// Desenho: docs/ideias/cardume-v0-banco.md
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { check, validate } = require('../rulesSim');

const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database.rules.json'), 'utf8'));
const mk = (uid, email, prov) => ({ uid, token: { email, firebase: { sign_in_provider: prov || 'google.com' } } });
const A = {
  ana: mk('ana', 'ana@ciahering.com.br'), bru: mk('bru', 'bru@ciahering.com.br'),
  gil: mk('gil', 'gil@ciahering.com.br'),            // da Hering, mas fora do canal (mesmo marcado na squad dados)
  adm: mk('adm', 'adm@ciahering.com.br'),
  caio: mk('cai', 'caio.soares@ciahering.com.br'),
  forasteiro: mk('out1', 'qualquer@gmail.com'), arezzo: mk('az1', 'x@arezzo.com.br', 'microsoft.com'),
  intruso: mk('int', 'int@ciahering.com.br', 'password'), // e-mail Hering sem ser login Google
};
let DB;
const reset = () => { DB = { kanban: {
  usuarios: { adm: { role: 'adm' }, gil: { role: 'membro', squads: { dados: true } }, ana: { role: 'membro' }, bru: { role: 'po' } },
  cardume: { canais: { dados: { nome: 'dados' } }, membros: { dados: { ana: true, bru: true, int: true } }, msgs: {} },
} }; };
const lê = (p, ator) => check(RULES, DB, 'read', p, ator);
const grava = (p, ator, val) => check(RULES, DB, 'write', p, ator, val) && validate(RULES, DB, p, ator, val);
const M = (id, sq) => `kanban/cardume/msgs/${sq || 'dados'}/${id}`;
const msg = o => Object.assign({ uid: 'ana', ts: Date.now(), texto: 'Bom dia, time!' }, o || {});
const põe = (id, v) => { DB.kanban.cardume.msgs.dados = Object.assign(DB.kanban.cardume.msgs.dados || {}, { [id]: v }); };

test('canal privado: só membro e ADM leem; o resto da Hering não', () => {
  reset(); põe('m1', msg());
  for (const k of ['ana', 'bru', 'adm', 'caio']) assert.equal(lê('kanban/cardume/msgs/dados', A[k]), true, 'lê: ' + k);
  for (const k of ['gil', 'forasteiro', 'arezzo', 'intruso']) assert.equal(lê('kanban/cardume/msgs/dados', A[k]), false, 'NÃO lê: ' + k);
  assert.equal(lê(M('m1'), A.gil), false, 'nem uma mensagem solta');
  assert.equal(lê('kanban/cardume/msgs', A.adm), false, 'ninguém lê todos os canais de uma vez');
  assert.equal(lê('kanban/cardume', A.ana), false);
  assert.equal(lê('kanban/cardume/ultima/dados', A.gil), false, 'nem o resumo de não lidas');
  assert.equal(lê('kanban/cardume/ultima/dados', A.ana), true);
});

test('membros: membro e ADM veem a lista do canal; ninguém se adiciona sozinho', () => {
  reset();
  assert.equal(lê('kanban/cardume/membros/dados', A.ana), true, 'membro vê (para @menção)');
  assert.equal(lê('kanban/cardume/membros/dados', A.adm), true);
  assert.equal(lê('kanban/cardume/membros/dados', A.gil), false);
  assert.equal(grava('kanban/cardume/membros/dados/gil', A.gil, true), false, 'gil não se põe no canal');
  assert.equal(grava('kanban/cardume/membros/dados/gil', A.ana, true), false, 'membro não põe ninguém');
  assert.equal(grava('kanban/cardume/membros/dados/gil', A.bru, true), false, 'PO também não (papel global)');
  assert.equal(grava('kanban/cardume/membros/dados/gil', A.adm, true), true, 'ADM põe');
  assert.equal(grava('kanban/cardume/membros/dados/ana', A.adm, null), true, 'ADM tira');
  assert.equal(grava('kanban/cardume/membros/dados/gil', A.adm, 'sim'), false, 'valor tem de ser true');
  assert.equal(grava('kanban/cardume/canais/prf', A.ana, { nome: 'prf' }), false, 'só ADM cria canal');
  assert.equal(grava('kanban/cardume/canais/prf', A.adm, { nome: 'prf' }), true);
  assert.equal(grava('kanban/cardume/canais/prf', A.adm, { nome: 'prf', html: '<b>' }), false, 'campo extra no canal');
});

test('membro com e-mail Hering mas sem login Google não entra (porta só Hering)', () => {
  reset();
  assert.equal(grava(M('m9'), A.intruso, msg({ uid: 'int' })), false);
  assert.equal(lê('kanban/cardume/membros/dados', A.intruso), false);
});

test('criar mensagem: só membro, como ele mesmo, com hora do servidor e texto válido', () => {
  reset();
  assert.equal(grava(M('m1'), A.ana, msg()), true, 'membro posta');
  assert.equal(grava(M('m1'), A.ana, msg({ card: 'c1783541085140', cardSq: 'dados' })), true, 'com referência a card');
  assert.equal(grava(M('m1'), A.gil, msg({ uid: 'gil' })), false, 'não membro não posta');
  assert.equal(grava(M('m1'), A.adm, msg({ uid: 'adm' })), false, 'ADM só posta se for membro');
  assert.equal(grava(M('m1'), A.ana, msg({ uid: 'bru' })), false, 'forjar autor');
  assert.equal(grava(M('m1'), A.ana, msg({ ts: Date.now() - 3600000 })), false, 'hora de 1 h atrás');
  assert.equal(grava(M('m1'), A.ana, msg({ ts: Date.now() + 3600000 })), false, 'hora no futuro');
  assert.equal(grava(M('m1'), A.ana, msg({ texto: '' })), false, 'texto vazio');
  assert.equal(grava(M('m1'), A.ana, msg({ texto: 'x'.repeat(4001) })), false, 'texto > 4000');
  assert.equal(grava(M('m1'), A.ana, msg({ texto: 'x'.repeat(4000) })), true, 'texto = 4000');
  assert.equal(grava(M('m1'), A.ana, msg({ texto: undefined })), false, 'sem texto');
  assert.equal(grava(M('m1'), A.ana, msg({ card: 'c1"><img>', cardSq: 'dados' })), false, 'card com caractere estranho');
  assert.equal(grava(M('m1'), A.ana, msg({ card: 'c1' })), false, 'card sem a squad do card');
  assert.equal(grava(M('m1'), A.ana, msg({ html: '<b>oi</b>' })), false, 'campo desconhecido');
  assert.equal(grava(M('m1'), A.ana, msg({ editado: Date.now() })), false, 'nasce sem editado');
  assert.equal(grava(M('m1'), A.ana, msg({ apagada: true })), false, 'nasce sem apagada');
  assert.equal(grava(M('m.1'), A.ana, msg()), false, 'id inválido');
});

test('editar: só o autor, só o texto, com marca de editado', () => {
  reset(); const orig = msg({ ts: Date.now() - 5000, card: 'c1', cardSq: 'dados' }); põe('m1', orig);
  const ed = o => Object.assign({}, orig, { texto: 'Bom dia, corrigido', editado: Date.now() }, o || {});
  assert.equal(grava(M('m1'), A.ana, ed()), true, 'autor edita');
  assert.equal(grava(M('m1'), A.bru, ed()), false, 'outro membro não edita');
  assert.equal(grava(M('m1'), A.adm, ed()), false, 'ADM não reescreve o texto de ninguém');
  assert.equal(grava(M('m1'), A.ana, ed({ editado: undefined })), false, 'edição sem marca');
  assert.equal(grava(M('m1'), A.ana, ed({ ts: Date.now() })), false, 'não muda a hora');
  assert.equal(grava(M('m1'), A.ana, ed({ uid: 'bru' })), false, 'não muda o autor');
  assert.equal(grava(M('m1'), A.ana, ed({ card: 'c2' })), false, 'não troca o card citado');
  DB.kanban.cardume.membros.dados.ana = null;
  assert.equal(grava(M('m1'), A.ana, ed()), false, 'quem saiu do canal não edita mais');
});

test('apagar: autor ou ADM gravam "mensagem apagada" sem o texto; é final; só ADM remove o nó', () => {
  reset(); const orig = msg({ ts: Date.now() - 5000 }); põe('m1', orig);
  const tomb = o => Object.assign({ uid: orig.uid, ts: orig.ts, apagada: true }, o || {});
  assert.equal(grava(M('m1'), A.ana, tomb()), true, 'autor apaga');
  assert.equal(grava(M('m1'), A.adm, tomb()), true, 'ADM apaga (moderação)');
  assert.equal(grava(M('m1'), A.bru, tomb()), false, 'outro membro não apaga');
  assert.equal(grava(M('m1'), A.ana, tomb({ texto: orig.texto })), false, 'apagada não guarda o texto');
  assert.equal(grava(M('m1'), A.ana, tomb({ card: 'c1', cardSq: 'dados' })), false, 'nem o card');
  assert.equal(grava(M('m1'), A.ana, tomb({ ts: Date.now() })), false, 'não muda a hora');
  assert.equal(grava(M('m1'), A.ana, null), false, 'autor não remove o nó');
  assert.equal(grava(M('m1'), A.adm, null), true, 'ADM remove o nó');
  põe('m1', tomb());
  assert.equal(grava(M('m1'), A.ana, Object.assign({}, orig, { editado: Date.now() })), false, 'apagada não volta');
  assert.equal(grava(M('m1'), A.adm, Object.assign({}, orig, { editado: Date.now() })), false, 'nem pelo ADM');
  assert.equal(grava(M('m1'), A.adm, null), true, 'ADM ainda remove o tombstone');
});

test('ultima (não lidas): só aponta para a mensagem que o próprio membro acabou de mandar; não volta no tempo nem some', () => {
  // Na tela, a mensagem e o marcador vão no MESMO update multi-caminho; aqui a mensagem já está no estado final.
  reset(); const U = 'kanban/cardume/ultima/dados'; const ts = Date.now() - 1000;
  põe('m2', msg({ ts })); põe('b1', msg({ uid: 'bru', ts }));
  assert.equal(grava(U, A.ana, { ts, uid: 'ana', id: 'm2' }), true, 'aponta para a própria mensagem');
  assert.equal(grava(U, A.ana, { ts: Date.now(), uid: 'ana', id: 'naoexiste' }), false, 'sem mensagem de verdade não acende não lidas');
  assert.equal(grava(U, A.ana, { ts, uid: 'ana', id: 'b1' }), false, 'nem apontando para a mensagem de outra pessoa');
  assert.equal(grava(U, A.ana, { ts: ts - 10, uid: 'ana', id: 'm2' }), false, 'hora tem de ser a da mensagem');
  assert.equal(grava(U, A.ana, { ts, uid: 'ana' }), false, 'sem id');
  assert.equal(grava(U, A.gil, { ts, uid: 'gil', id: 'm2' }), false, 'não membro');
  assert.equal(grava(U, A.ana, { ts, uid: 'bru', id: 'b1' }), false, 'forjar autor');
  assert.equal(grava(U, A.ana, { ts, uid: 'ana', id: 'm2', texto: 'vaza' }), false, 'campo extra');
  DB.kanban.cardume.ultima = { dados: { ts: ts + 500, uid: 'bru', id: 'b2' } };
  assert.equal(grava(U, A.ana, { ts, uid: 'ana', id: 'm2' }), false, 'não volta para uma mensagem mais antiga');
  assert.equal(grava(U, A.ana, null), false, 'membro não apaga o marcador');
  assert.equal(grava(U, A.adm, null), true, 'ADM pode limpar');
  põe('m3', { uid: 'ana', ts: ts + 900, apagada: true });
  assert.equal(grava(U, A.ana, { ts: ts + 900, uid: 'ana', id: 'm3' }), false, 'nem aponta para mensagem apagada');
});

test('lidas: só o próprio lê e grava', () => {
  reset(); const L = 'kanban/cardume/lidas/ana';
  assert.equal(grava(L + '/dados', A.ana, Date.now()), true);
  assert.equal(lê(L, A.ana), true);
  assert.equal(lê(L, A.bru), false);
  assert.equal(grava(L + '/dados', A.bru, Date.now()), false);
  assert.equal(grava(L + '/dados', A.ana, 'ontem'), false, 'tem de ser número');
});

test('config: todo mundo da Hering lê, só ADM muda a retenção (7 a 3650 dias)', () => {
  reset(); const C = 'kanban/cardume/config/retencao_dias';
  assert.equal(lê('kanban/cardume/config', A.gil), true);
  assert.equal(lê('kanban/cardume/config', A.forasteiro), false);
  assert.equal(grava(C, A.ana, 90), false);
  assert.equal(grava(C, A.adm, 90), true);
  assert.equal(grava(C, A.adm, 1), false);
  assert.equal(grava('kanban/cardume/config/outra', A.adm, 1), false);
});

test('gravar direto num campo filho não fura as regras da mensagem nem do marcador', () => {
  reset(); const ts = Date.now() - 5000; põe('m1', msg({ ts })); põe('m2', msg({ ts: ts + 1 })); põe('b1', msg({ uid: 'bru', ts }));
  assert.equal(grava(M('m1') + '/uid', A.ana, 'bru'), false, 'passar a própria mensagem para outra pessoa');
  assert.equal(grava(M('m1') + '/ts', A.ana, Date.now()), false, 'mudar a hora');
  assert.equal(grava(M('m1') + '/texto', A.ana, 'trocado sem marca de editado'), false, 'editar texto sem "editado"');
  assert.equal(grava(M('m1') + '/card', A.ana, 'c9'), false, 'pendurar um card depois');
  assert.equal(grava(M('m1') + '/apagada', A.ana, true), false, '"apagada" mantendo o texto');
  assert.equal(grava(M('m1') + '/html', A.ana, '<b>'), false, 'campo novo');
  assert.equal(grava(M('b1') + '/texto', A.ana, 'mexendo na do Bruno'), false, 'texto alheio');
  DB.kanban.cardume.ultima = { dados: { ts, uid: 'ana', id: 'm1' } };
  const U = 'kanban/cardume/ultima/dados';
  assert.equal(grava(U + '/ts', A.ana, Date.now()), false, 'acender não lidas sem mensagem');
  assert.equal(grava(U + '/id', A.ana, 'b1'), false, 'apontar para a mensagem de outro');
  assert.equal(grava(U + '/id', A.ana, 'm2'), false, 'trocar o id sem a hora bater');
  assert.equal(grava(U + '/uid', A.bru, 'bru'), false, 'outro membro assumir o marcador');
  assert.equal(grava(U + '/ts', A.ana, null), false, 'apagar um pedaço do marcador');
});
