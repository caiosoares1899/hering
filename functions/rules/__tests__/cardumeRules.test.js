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
const { check, validate, update } = require('../rulesSim');

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
const mb = (ator, canal, uid, v) => update(RULES, DB, ator, { [`kanban/cardume/membros/${canal}/${uid}`]: v, [`kanban/cardume/meus/${uid}/${canal}`]: v });
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
  assert.equal(mb(A.gil, 'dados', 'gil', true), false, 'gil não se põe no canal');
  assert.equal(mb(A.ana, 'dados', 'gil', true), false, 'membro não põe ninguém');
  assert.equal(mb(A.bru, 'dados', 'gil', true), false, 'PO global que não está na squad não põe');
  assert.equal(mb(A.adm, 'dados', 'gil', true), true, 'ADM põe');
  assert.equal(mb(A.adm, 'dados', 'ana', null), true, 'ADM tira');
  assert.equal(grava('kanban/cardume/membros/dados/gil', A.adm, 'sim'), false, 'valor tem de ser true');
  assert.equal(grava('kanban/cardume/canais/prf', A.ana, { nome: 'prf' }), false, 'só ADM cria canal');
  assert.equal(grava('kanban/cardume/canais/prf', A.adm, { nome: 'prf' }), true);
  assert.equal(grava('kanban/cardume/canais/prf', A.adm, { nome: 'prf', html: '<b>' }), false, 'campo extra no canal');
});

test('manutenção: ADM, ou PO/Organizador DA squad (papel por squad, sem cair no papel global), põem e tiram pessoas', () => {
  const P = 'kanban/cardume/membros/dados/';
  const com = (uid, extra) => { reset(); DB.kanban.usuarios[uid] = Object.assign({ role: 'membro', squads: { dados: true } }, extra); };
  const quem = mk('ze', 'ze@ciahering.com.br');
  com('ze', { squads_roles: { dados: 'po' } });
  assert.equal(mb(quem, 'dados', 'gil', true), true, 'PO da squad põe');
  assert.equal(mb(quem, 'dados', 'ana', null), true, 'PO da squad tira');
  assert.equal(lê('kanban/cardume/membros/dados', quem), true, 'PO da squad vê a lista mesmo sem estar no canal');
  assert.equal(lê('kanban/cardume/msgs/dados', quem), false, '...mas não lê as mensagens enquanto não se puser no canal');
  com('ze', { squads_roles: { dados: 'organizador' } });
  assert.equal(mb(quem, 'dados', 'gil', true), true, 'Organizador da squad põe');
  com('ze', { role: 'po' });
  assert.equal(mb(quem, 'dados', 'gil', true), false, 'PO global na squad SEM papel por squad não põe (decisão do Caio, 24/11: exige PO/Org DA squad)');
  com('ze', { role: 'po', squads_roles: { dados: 'membro' } });
  assert.equal(mb(quem, 'dados', 'gil', true), false, 'papel POR SQUAD manda: membro da squad não põe, mesmo sendo PO global');
  com('ze', { squads_roles: { dados: 'membro' } });
  assert.equal(mb(quem, 'dados', 'ze', true), false, 'membro que se marcou na squad não se põe no canal');
  com('ze', { squads: { prf: true }, squads_roles: { prf: 'po' } });
  assert.equal(mb(quem, 'dados', 'gil', true), false, 'PO de outra squad não mexe no canal da dados');
  com('ze', { squads_roles: { dados: 'po' } });
  assert.equal(mb(quem, 'prf', 'gil', true), false, 'nem o PO da dados mexe no canal da prf');
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
  assert.equal(grava(M('m1'), A.ana, ed({ editado: orig.ts - 1 })), false, 'editado antes da própria mensagem (auditoria do Antigravity)');
  assert.equal(grava(M('m1') + '/editado', A.ana, orig.ts - 1), false, 'nem gravando só o filho');
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
  assert.equal(grava(L, A.ana, 5), false, 'lidas/{uid} é um objeto, não um número solto');
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

// ───────────── Canais temáticos e temporários (etapa 1b, 24/11/2026) ─────────────
// Criar/entrar/sair são update() multi-caminho (canal + membros + espelhos `meus`/`abertos`): o simulador aplica tudo num estado-depois.
const up = (ator, mapa) => update(RULES, DB, ator, mapa);
const C = id => `kanban/cardume/canais/${id}`, MB = (id, u) => `kanban/cardume/membros/${id}/${u}`;
const MEU = (u, id) => `kanban/cardume/meus/${u}/${id}`, AB = id => `kanban/cardume/abertos/${id}`;
const tema = o => Object.assign({ nome: 'Black Friday', tipo: 'tema', dono: 'gil', acesso: 'aberto', criado: Date.now() }, o || {});
const criar = (ator, id, canal) => {
  const m = { [C(id)]: canal, [MB(id, ator.uid)]: true, [MEU(ator.uid, id)]: true };
  if (canal.acesso === 'aberto') m[AB(id)] = { nome: canal.nome };
  return up(ator, m);
};
const existe = (id, canal, membros) => {
  DB.kanban.cardume.canais[id] = canal;
  DB.kanban.cardume.membros[id] = membros || { [canal.dono]: true };
  if (canal.acesso === 'aberto') DB.kanban.cardume.abertos = Object.assign(DB.kanban.cardume.abertos || {}, { [id]: { nome: canal.nome } });
};

test('temático: qualquer pessoa da Hering cria, num update só, sendo a dona', () => {
  reset();
  assert.equal(criar(A.gil, 't-black-friday', tema()), true, 'aberto, com espelhos');
  assert.equal(criar(A.gil, 't-comercial', tema({ nome: 'Comercial', acesso: 'convite' })), true, 'só convidados');
  assert.equal(criar(A.gil, 't-bf26', tema({ fim: Date.now() + 7 * 864e5 })), true, 'temporário, com fim');
  assert.equal(criar(A.forasteiro, 't-black-friday', tema({ dono: 'out1' })), false, 'conta de fora não cria');
  assert.equal(criar(A.gil, 't-black-friday', tema({ dono: 'ana' })), false, 'dona forjada');
  assert.equal(criar(A.gil, 'black-friday', tema()), false, 'sem o prefixo t-');
  assert.equal(criar(A.gil, 't-Black', tema()), false, 'id com maiúscula');
  assert.equal(criar(A.gil, 't-bf26', tema({ tipo: 'oficial' })), false, 'tipo errado');
  assert.equal(criar(A.gil, 't-bf26', tema({ acesso: 'secreto' })), false, 'acesso inválido');
  assert.equal(criar(A.gil, 't-bf26', tema({ criado: Date.now() - 3600000 })), false, 'data de criação forjada');
  assert.equal(criar(A.gil, 't-bf26', tema({ fim: Date.now() + 400 * 864e5 })), false, 'fim depois de 1 ano');
  assert.equal(criar(A.gil, 't-bf26', tema({ html: 'x' })), false, 'campo extra');
  DB.kanban.squads_meta = { 't-ops': { nome: 'Ops' } };
  assert.equal(criar(A.gil, 't-ops', tema()), false, 'não pode ter o id de uma squad existente');
  assert.equal(grava(C('dados'), A.gil, { nome: 'dados' }), false, 'canal oficial só o ADM cria');
});

test('temático: membros sem o canal no mesmo update, ou tomando a dona de um canal existente, falha inteiro', () => {
  reset(); existe('t-bf26', tema({ dono: 'ana' }), { ana: true });
  assert.equal(up(A.gil, { [MB('t-xx', 'gil')]: true, [MEU('gil', 't-xx')]: true }), false, 'membros de canal que não existe');
  assert.equal(up(A.gil, { [C('t-bf26') + '/dono']: 'gil', [MB('t-bf26', 'gil')]: true }), false, 'trocar a dona e se pôr dentro');
  assert.equal(up(A.gil, { [C('t-bf26')]: tema({ dono: 'gil', criado: DB.kanban.cardume.canais['t-bf26'].criado }), [MB('t-bf26', 'gil')]: true }), false, 'sobrescrever o canal inteiro');
});

test('temático: entrar sozinho só no aberto e não vencido; sair sempre', () => {
  reset(); existe('t-bf26', tema()); existe('t-com', tema({ nome: 'Comercial', acesso: 'convite' }));
  existe('t-velho', tema({ nome: 'Velho', criado: Date.now() - 10 * 864e5, fim: Date.now() - 864e5 }));
  assert.equal(up(A.ana, { [MB('t-bf26', 'ana')]: true, [MEU('ana', 't-bf26')]: true }), true, 'entra no aberto');
  assert.equal(up(A.ana, { [MB('t-com', 'ana')]: true, [MEU('ana', 't-com')]: true }), false, 'não entra no só convidados');
  assert.equal(up(A.ana, { [MB('t-velho', 'ana')]: true, [MEU('ana', 't-velho')]: true }), false, 'não entra em canal vencido');
  assert.equal(up(A.ana, { [MB('t-bf26', 'bru')]: true, [MEU('bru', 't-bf26')]: true }), false, 'não põe outra pessoa no aberto');
  assert.equal(up(A.gil, { [MB('t-bf26', 'gil')]: null, [MEU('gil', 't-bf26')]: null }), true, 'sai do canal');
  assert.equal(up(A.ana, { [MB('dados', 'ana')]: null, [MEU('ana', 'dados')]: null }), true, 'sai até do oficial');
  assert.equal(up(A.gil, { [MB('dados', 'gil')]: true, [MEU('gil', 'dados')]: true }), false, 'não entra sozinho no oficial');
});

test('temático: dona, co-admin e ADM administram; PO de squad não vira gestor de temático', () => {
  reset(); existe('t-com', tema({ nome: 'Comercial', acesso: 'convite' }));
  assert.equal(up(A.gil, { [MB('t-com', 'ana')]: true, [MEU('ana', 't-com')]: true }), true, 'dona convida');
  assert.equal(up(A.gil, { 'kanban/cardume/admins/t-com/bru': true }), true, 'dona indica co-admin');
  assert.equal(up(A.ana, { 'kanban/cardume/admins/t-com/ana': true }), false, 'membro não se faz co-admin');
  DB.kanban.cardume.admins = { 't-com': { bru: true } };
  assert.equal(up(A.bru, { [MB('t-com', 'ana')]: true, [MEU('ana', 't-com')]: true }), true, 'co-admin convida');
  assert.equal(up(A.bru, { 'kanban/cardume/admins/t-com/ana': true }), false, 'co-admin não indica outro co-admin');
  assert.equal(up(A.adm, { [MB('t-com', 'ana')]: true, [MEU('ana', 't-com')]: true }), true, 'ADM convida');
  const ze = mk('ze', 'ze@ciahering.com.br');
  DB.kanban.usuarios.ze = { role: 'po', squads: { 't-com': true }, squads_roles: { 't-com': 'po' } };
  assert.equal(up(ze, { [MB('t-com', 'ze')]: true, [MEU('ze', 't-com')]: true }), false, 'PO "da squad t-com" não manda no temático t-com');
  assert.equal(up(A.ana, { [C('t-com') + '/nome']: 'Comercial 2' }), false, 'membro não renomeia');
  assert.equal(up(A.gil, { [C('t-com') + '/nome']: 'Comercial 2' }), true, 'dona renomeia');
  assert.equal(up(A.gil, { [C('t-com') + '/dono']: 'ana' }), false, 'dona não passa o canal adiante (dono imutável)');
  assert.equal(up(A.gil, { [C('t-com')]: Object.assign({}, DB.kanban.cardume.canais['t-com'], { dono: 'ana' }) }), false, 'nem regravando o canal inteiro');
  assert.equal(up(A.gil, { [C('t-com') + '/tipo']: 'oficial' }), false, 'tipo imutável');
  assert.equal(up(A.gil, { [C('t-com') + '/criado']: DB.kanban.cardume.canais['t-com'].criado - 5000 }), false, 'criado imutável');
  assert.equal(up(A.gil, { [C('t-com')]: null }), false, 'dona não apaga o nó (arquiva com fim)');
  assert.equal(up(A.adm, { [C('t-com')]: null }), false, 'nem o ADM apaga o canal temático pelas regras (arquiva com fim; quem apaga é a limpeza, tudo junto)');
  assert.equal(up(A.adm, { [C('t-com') + '/fim']: Date.now() + 1000 }), true, 'ADM arquiva (põe o fim)');
});

test('temático vencido: vira só leitura (mensagem, edição, apagar e não lidas param)', () => {
  reset(); const criado = Date.now() - 10 * 864e5;
  existe('t-velho', tema({ criado, fim: Date.now() - 864e5 }), { gil: true });
  const ts = Date.now() - 2 * 864e5;
  DB.kanban.cardume.msgs['t-velho'] = { m1: { uid: 'gil', ts, texto: 'antiga' } };
  const MV = id => `kanban/cardume/msgs/t-velho/${id}`;
  assert.equal(lê('kanban/cardume/msgs/t-velho', A.gil), true, 'membro ainda lê');
  assert.equal(grava(MV('m2'), A.gil, { uid: 'gil', ts: Date.now(), texto: 'oi' }), false, 'não manda mensagem');
  assert.equal(grava(MV('m1'), A.gil, { uid: 'gil', ts, texto: 'editada', editado: Date.now() }), false, 'não edita');
  assert.equal(grava(MV('m1') + '/texto', A.gil, 'só o filho'), false, 'nem pelo filho');
  assert.equal(grava(MV('m1'), A.gil, { uid: 'gil', ts, apagada: true }), false, 'não apaga');
  assert.equal(grava(MV('m1'), A.adm, { uid: 'gil', ts, apagada: true }), true, 'ADM ainda modera');
  assert.equal(up(A.gil, { 'kanban/cardume/ultima/t-velho': { ts, uid: 'gil', id: 'm1' } }), false, 'não acende não lidas');
  assert.equal(up(A.gil, { [C('t-velho') + '/fim']: criado + 30 * 864e5 }), true, 'a dona pode reabrir adiando o fim');
});

test('temático: só convidados é invisível para quem não é membro; aberto aparece', () => {
  reset(); existe('t-bf26', tema()); existe('t-com', tema({ nome: 'Comercial', acesso: 'convite' }), { gil: true, ana: true });
  assert.equal(lê(C('t-bf26'), A.bru), true, 'aberto: qualquer pessoa da Hering vê');
  assert.equal(lê(C('t-com'), A.bru), false, 'convite: quem não é membro não vê nem o nome');
  assert.equal(lê(C('t-com'), A.ana), true, 'membro vê');
  assert.equal(lê(C('t-com'), A.adm), true, 'ADM vê');
  assert.equal(lê('kanban/cardume/canais', A.ana), false, 'ninguém lê a lista inteira de canais');
  assert.equal(lê('kanban/cardume/abertos', A.bru), true, 'a lista de abertos é pública na Hering');
  assert.equal(lê('kanban/cardume/abertos', A.forasteiro), false);
  assert.equal(lê(C('dados'), A.gil), true, 'oficial: o nome é visível na Hering');
  assert.equal(lê('kanban/cardume/msgs/t-com', A.bru), false, 'mensagens do convite: só membros');
});

test('espelhos não mentem: abertos só para tema aberto com o mesmo nome; meus só para quem é membro', () => {
  reset(); existe('t-bf26', tema()); existe('t-com', tema({ nome: 'Comercial', acesso: 'convite' }));
  assert.equal(up(A.ana, { [AB('t-com')]: { nome: 'Comercial' } }), false, 'pôr convite na lista pública');
  assert.equal(up(A.ana, { [AB('t-bf26')]: { nome: 'Outro nome' } }), false, 'nome diferente do canal');
  assert.equal(up(A.ana, { [AB('t-bf26')]: null }), false, 'tirar da lista um aberto ativo');
  assert.equal(up(A.gil, { [C('t-bf26') + '/acesso']: 'convite', [AB('t-bf26')]: null }), true, 'virar convite e sair da lista juntos');
  assert.equal(up(A.ana, { [MEU('ana', 't-com')]: true }), false, '"meus" sem ser membro');
  assert.equal(up(A.ana, { [MEU('ana', 'dados')]: true }), true, '"meus" de quem é membro');
  assert.equal(up(A.bru, { [MEU('ana', 'dados')]: null }), false, 'apagar o "meus" de quem continua membro');
  assert.equal(lê('kanban/cardume/meus/ana', A.bru), false, 'só a própria pessoa lê os seus canais');
});

test('achados do Codex (#1924): canal apagado não deixa acesso para trás; espelhos acompanham o canal e os membros', () => {
  reset();
  // P1 — restos de um temático antigo (apagado pela limpeza só no canal, por exemplo): não aceitam mensagem nem herança
  DB.kanban.cardume.membros['t-velho'] = { gil: true, ana: true };
  DB.kanban.cardume.msgs['t-velho'] = { m1: { uid: 'ana', ts: Date.now() - 864e5, texto: 'antiga' } };
  assert.equal(grava('kanban/cardume/msgs/t-velho/m2', A.gil, { uid: 'gil', ts: Date.now(), texto: 'voltei' }), false, 'sem o canal, o temático não aceita mensagem');
  assert.equal(up(A.gil, { 'kanban/cardume/ultima/t-velho': { ts: Date.now() - 864e5, uid: 'ana', id: 'm1' } }), false, 'nem acende não lidas');
  assert.equal(criar(A.bru, 't-velho', tema({ dono: 'bru', nome: 'Velho' })), false, 'recriar o id com membros/mensagens antigos não herda nada: é recusado');
  // P2 — lista pública acompanha o canal
  reset(); existe('t-bf26', tema());
  assert.equal(up(A.gil, { [C('t-bf26') + '/acesso']: 'convite' }), false, 'virar convite sem tirar da lista pública');
  assert.equal(up(A.gil, { [C('t-bf26') + '/nome']: 'BF 2026' }), false, 'renomear sem atualizar a lista pública');
  assert.equal(up(A.gil, { [C('t-bf26') + '/nome']: 'BF 2026', [AB('t-bf26') + '/nome']: 'BF 2026' }), true, 'renomear junto com a lista');
  assert.equal(criar(A.gil, 't-novo1', tema({ acesso: 'aberto' })), true);
  assert.equal(up(A.gil, { [C('t-novo2')]: tema(), [MB('t-novo2', 'gil')]: true, [MEU('gil', 't-novo2')]: true }), false, 'criar aberto sem entrar na lista pública');
  assert.equal(up(A.gil, { [C('t-novo3')]: tema({ acesso: 'convite' }), [MB('t-novo3', 'gil')]: true, [MEU('gil', 't-novo3')]: true, [AB('t-novo3')]: { nome: 'Black Friday' } }), false, 'criar convite já na lista pública');
  // P2 — "meus" acompanha os membros
  assert.equal(up(A.gil, { [MB('t-bf26', 'ana')]: true }), false, 'pôr membro sem o "meus" dele');
  DB.kanban.cardume.membros['t-bf26'].ana = true; DB.kanban.cardume.meus = { ana: { 't-bf26': true } };
  assert.equal(up(A.gil, { [MB('t-bf26', 'ana')]: null }), false, 'tirar membro deixando o "meus" dele');
  assert.equal(up(A.gil, { [MB('t-bf26', 'ana')]: null, [MEU('ana', 't-bf26')]: null }), true, 'tirar junto');
  // simulador: o .validate do ancestral vale (id curto demais é recusado mesmo escrevendo só um filho)
  existe('t-x', tema({ nome: 'X' }));
  assert.equal(up(A.gil, { [C('t-x') + '/fim']: Date.now() }), false, 'ancestral com id inválido recusa a escrita no filho');
});

test('enviar = mensagem + marcador de não lidas num update só (o que a página faz a cada envio)', () => {
  reset(); existe('t-bf26', tema({ dono: 'ana' }), { ana: true });
  for (const c of ['dados', 't-bf26']) {
    const ts = Date.now();
    assert.equal(up(A.ana, { [`kanban/cardume/msgs/${c}/m5`]: { uid: 'ana', ts, texto: 'Bom dia' }, [`kanban/cardume/ultima/${c}`]: { ts, uid: 'ana', id: 'm5' } }), true, 'envio atômico em ' + c);
    assert.equal(up(A.ana, { [`kanban/cardume/msgs/${c}/m6`]: { uid: 'ana', ts, texto: 'Bom dia' }, [`kanban/cardume/ultima/${c}`]: { ts: ts - 1, uid: 'ana', id: 'm6' } }), false, 'hora do marcador diferente da mensagem em ' + c);
    assert.equal(up(A.gil, { [`kanban/cardume/msgs/${c}/m7`]: { uid: 'gil', ts, texto: 'oi' }, [`kanban/cardume/ultima/${c}`]: { ts, uid: 'gil', id: 'm7' } }), false, 'não membro não envia em ' + c);
  }
});

test('achados do Antigravity (#1924): sem oráculo de membros; co-admin não tira a dona; simulador como o RTDB', () => {
  reset(); existe('t-segredo', tema({ nome: 'Segredo', acesso: 'convite', dono: 'gil' }), { gil: true, ana: true });
  DB.kanban.cardume.meus = { ana: { 't-segredo': true } };
  assert.equal(up(A.bru, { [MEU('ana', 't-segredo')]: true }), false, 'quem é de fora não grava o "meus" de outra pessoa (não descobre quem é membro)');
  assert.equal(up(A.bru, { [MEU('ana', 't-outro')]: null }), false, 'nem apaga o "meus" alheio');
  assert.equal(up(A.ana, { [MEU('ana', 't-segredo')]: true }), true, 'a própria pessoa mantém o seu');
  DB.kanban.cardume.admins = { 't-segredo': { ana: true } };
  assert.equal(up(A.ana, { [MB('t-segredo', 'gil')]: null, [MEU('gil', 't-segredo')]: null }), false, 'co-admin não tira a dona');
  assert.equal(up(A.adm, { [MB('t-segredo', 'gil')]: null, [MEU('gil', 't-segredo')]: null }), true, 'o ADM tira');
  assert.equal(up(A.gil, { [MB('t-segredo', 'gil')]: null, [MEU('gil', 't-segredo')]: null }), true, 'a dona sai sozinha');
  assert.equal(up(A.adm, { 'kanban/cardume/config': { retencao_dias: 90 }, 'kanban/cardume/config/retencao_dias': 90 }), false, 'caminho + descendente no mesmo update: o RTDB recusa');
});

// ───────────── Menções (etapa 4, desenho revisto em 24/11/2026) ─────────────
// Índice PRIVADO kanban/cardume/mencoes/{uid}/{id}: a notificação (legível pela empresa) fica genérica; o canal/mensagem só aqui.
test('menções: só quem escreveu a mensagem, sendo membro, menciona outro membro do mesmo canal', () => {
  reset(); const ts = Date.now() - 2000;
  DB.kanban.cardume.membros.dados.gil = null;
  põe('m1', msg({ uid: 'ana', ts })); põe('b1', msg({ uid: 'bru', ts }));
  const MN = (u, id) => `kanban/cardume/mencoes/${u}/${id}`;
  const rec = o => Object.assign({ c: 'dados', m: 'm1', de: 'ana', ts: Date.now(), n: 'n123' }, o || {});
  assert.equal(up(A.ana, { [MN('bru', 'x1')]: rec() }), true, 'Ana menciona o Bruno na própria mensagem');
  assert.equal(up(A.ana, { [MN('bru', 'x1')]: rec({ de: 'bru' }) }), false, 'forjar quem mencionou');
  assert.equal(up(A.ana, { [MN('ana', 'x1')]: rec() }), false, 'mencionar a si mesma');
  assert.equal(up(A.ana, { [MN('gil', 'x1')]: rec() }), false, 'mencionar quem não é do canal (não leva nada privado pra fora)');
  assert.equal(up(A.gil, { [MN('bru', 'x1')]: rec({ de: 'gil' }) }), false, 'quem não é do canal não menciona');
  põe('g1', msg({ uid: 'gil', ts }));
  assert.equal(up(A.gil, { [MN('bru', 'x1')]: rec({ de: 'gil', m: 'g1' }) }), false, 'quem escreveu e depois saiu do canal não menciona mais');
  assert.equal(up(A.ana, { [MN('bru', 'x1')]: rec({ m: 'b1' }) }), false, 'apontar para a mensagem de outra pessoa');
  assert.equal(up(A.ana, { [MN('bru', 'x1')]: rec({ m: 'naoexiste' }) }), false, 'mensagem que não existe');
  põe('velha', msg({ uid: 'ana', ts: Date.now() - 3600000 }));
  assert.equal(up(A.ana, { [MN('bru', 'x1')]: rec({ m: 'velha' }) }), false, 'mensagem antiga (não dá pra "repontar" depois)');
  põe('tomb', { uid: 'ana', ts, apagada: true });
  assert.equal(up(A.ana, { [MN('bru', 'x1')]: rec({ m: 'tomb' }) }), false, 'mensagem apagada');
  assert.equal(up(A.ana, { [MN('bru', 'x1')]: rec({ ts: Date.now() - 3600000 }) }), false, 'hora forjada');
  assert.equal(up(A.ana, { [MN('bru', 'x1')]: rec({ lida: true }) }), false, 'nasce sem lida');
  assert.equal(up(A.ana, { [MN('bru', 'x1')]: rec({ txt: 'vaza' }) }), false, 'campo extra');
  assert.equal(up(A.ana, { [MN('bru', 'x1')]: rec({ n: undefined }) }), false, 'sem o id da notificação (prova de origem)');
  assert.equal(up(A.ana, { [MN('bru', 'x1') + '/c']: 'dados' }), false, 'escrita direta num filho não cria registro');
});

test('menções: só a dona lê; só ela marca como lida; dona ou ADM apagam', () => {
  reset(); const MN = 'kanban/cardume/mencoes/bru/x1', base = { c: 'dados', m: 'm1', de: 'ana', ts: Date.now() - 1000, n: 'n123' };
  DB.kanban.cardume.mencoes = { bru: { x1: base } };
  assert.equal(lê(MN, A.bru), true, 'a dona lê');
  assert.equal(lê('kanban/cardume/mencoes/bru', A.bru), true);
  for (const k of ['ana', 'gil', 'adm', 'forasteiro']) assert.equal(lê('kanban/cardume/mencoes/bru', A[k]), false, 'não lê: ' + k);
  assert.equal(up(A.bru, { [MN + '/lida']: true }), true, 'a dona marca como lida');
  assert.equal(up(A.bru, { [MN]: Object.assign({}, base, { lida: true }) }), true, 'regravando inteiro, só com lida diferente');
  assert.equal(up(A.bru, { [MN + '/c']: 't-outro' }), false, 'a dona não muda o canal');
  assert.equal(up(A.bru, { [MN + '/n']: 'n999' }), false, 'nem o id da notificação');
  assert.equal(up(A.ana, { [MN + '/lida']: true }), false, 'quem mencionou não mexe');
  assert.equal(up(A.ana, { [MN]: null }), false, 'quem mencionou não apaga');
  assert.equal(up(A.bru, { [MN]: null }), true, 'a dona apaga');
  assert.equal(up(A.adm, { [MN]: null }), true, 'o ADM apaga');
});

test('menções: canal temático vencido não gera menção', () => {
  reset(); existe('t-velho', tema({ criado: Date.now() - 10 * 864e5, fim: Date.now() - 864e5 }), { gil: true, ana: true });
  DB.kanban.cardume.msgs['t-velho'] = { m1: { uid: 'gil', ts: Date.now() - 1000, texto: 'oi @Ana Lima' } };
  assert.equal(up(A.gil, { 'kanban/cardume/mencoes/ana/x1': { c: 't-velho', m: 'm1', de: 'gil', ts: Date.now(), n: 'n1' } }), false);
});

// 🐚 GIF (KLIPY) — docs/ideias/cardume-v0-banco.md › "GIF na Concha". O campo `gif` só entra na criação, só com mídia de host fixo da KLIPY,
// e não muda depois (editar mexe só na legenda). O registro de apagada não leva o GIF. O contador da função (gif_uso) é fechado ao navegador.
const GIFU = 'https://static.klipy.com/ii/935d7ab9d8c6202580a668421940ec81/14/af/um0L4dFH.webp';
const gif = o => Object.assign({ u: GIFU, s: 'https://static2.klipy.com/ii/935d7ab9/14/af/um0L4dFH.jpg', w: 320, h: 240, t: 'Hello' }, o || {});
test('GIF: cria com ou sem legenda, só de host da KLIPY, com tamanho e campos válidos', () => {
  reset();
  assert.equal(grava(M('g1'), A.ana, msg({ texto: undefined, gif: gif() })), true, 'GIF sem legenda');
  assert.equal(grava(M('g1'), A.ana, msg({ gif: gif() })), true, 'GIF com legenda');
  assert.equal(grava(M('g1'), A.ana, msg({ texto: undefined, gif: gif({ s: undefined, t: undefined }) })), true, 'só u, w e h');
  assert.equal(grava(M('g1'), A.ana, msg({ texto: undefined })), false, 'nem texto nem GIF');
  for (const [u, porque] of [
    ['https://evil.example/x.gif', 'host de fora'], ['https://static.klipy.com.evil.example/x.gif', 'sufixo enganoso'],
    ['http://static.klipy.com/ii/a.gif', 'http'], ['javascript:alert(1)', 'javascript:'], ['https://static3.klipy.com/ii/a.gif', 'host fora da lista'],
    ['https://static.klipy.com/ii/a.gif?x=1', 'query'], ['https://static.klipy.com/ii/"onerror=x', 'aspas'],
  ]) assert.equal(grava(M('g1'), A.ana, msg({ texto: undefined, gif: gif({ u }) })), false, 'u: ' + porque);
  assert.equal(grava(M('g1'), A.ana, msg({ texto: undefined, gif: gif({ s: 'https://evil.example/s.jpg' }) })), false, 's de fora');
  assert.equal(grava(M('g1'), A.ana, msg({ texto: undefined, gif: gif({ w: 0 }) })), false, 'largura 0');
  assert.equal(grava(M('g1'), A.ana, msg({ texto: undefined, gif: gif({ h: 99999 }) })), false, 'altura enorme');
  assert.equal(grava(M('g1'), A.ana, msg({ texto: undefined, gif: gif({ w: '320' }) })), false, 'largura texto');
  assert.equal(grava(M('g1'), A.ana, msg({ texto: undefined, gif: gif({ t: 'x'.repeat(101) }) })), false, 'título > 100');
  assert.equal(grava(M('g1'), A.ana, msg({ texto: undefined, gif: gif({ href: 'https://evil.example' }) })), false, 'campo extra no gif');
  assert.equal(grava(M('g1'), A.ana, msg({ texto: undefined, gif: gif({ u: undefined }) })), false, 'gif sem u');
  assert.equal(grava(M('g1'), A.gil, msg({ uid: 'gil', texto: undefined, gif: gif() })), false, 'não membro');
  const ts = Date.now();
  assert.equal(up(A.ana, { 'kanban/cardume/msgs/dados/g2': { uid: 'ana', ts, gif: gif() }, 'kanban/cardume/ultima/dados': { ts, uid: 'ana', id: 'g2' } }), true, 'envio atômico de GIF (mensagem + marcador)');
});
test('GIF: editar não põe, não tira e não troca o GIF; apagar não guarda o GIF', () => {
  reset(); const comGif = msg({ ts: Date.now() - 5000, gif: gif() }), semGif = msg({ ts: Date.now() - 5000 }); põe('g1', comGif); põe('s1', semGif);
  const ed = (o, base) => Object.assign({}, base || comGif, { texto: 'legenda nova', editado: Date.now() }, o || {});
  assert.equal(grava(M('g1'), A.ana, ed()), true, 'muda só a legenda');
  assert.equal(grava(M('g1'), A.ana, ed({ gif: gif({ u: GIFU.replace('um0L4dFH', 'outro123') }) })), false, 'troca o GIF');
  assert.equal(grava(M('g1'), A.ana, ed({ gif: gif({ w: 100 }) })), false, 'muda o tamanho');
  assert.equal(grava(M('g1'), A.ana, ed({ gif: gif({ t: 'outro título' }) })), false, 'muda o título');
  assert.equal(grava(M('g1'), A.ana, ed({ gif: gif({ s: undefined }) })), false, 'tira o quadro parado');
  assert.equal(grava(M('g1'), A.ana, ed({ gif: undefined })), false, 'tira o GIF');
  assert.equal(grava(M('s1'), A.ana, ed({ gif: gif() }, semGif)), false, 'põe GIF numa mensagem que não tinha');
  assert.equal(grava(M('s1') + '/gif', A.ana, gif()), false, 'nem gravando só o filho gif');
  assert.equal(grava(M('g1') + '/gif/u', A.ana, 'https://static.klipy.com/ii/troca.gif'), false, 'nem trocando só a URL');
  const tomb = o => Object.assign({ uid: comGif.uid, ts: comGif.ts, apagada: true }, o || {});
  assert.equal(grava(M('g1'), A.ana, tomb()), true, 'apaga sem o GIF');
  assert.equal(grava(M('g1'), A.ana, tomb({ gif: gif() })), false, 'apagada não guarda o GIF');
});
test('GIF: o contador da função (gif_uso) é fechado para o navegador', () => {
  reset(); DB.kanban.cardume.gif_uso = { ana: { h: '2026112410', n: 3 }, _casa: { h: '2026112410', n: 10 } };
  for (const k of ['ana', 'adm', 'caio', 'gil']) {
    assert.equal(lê('kanban/cardume/gif_uso', A[k]), false, 'não lê a lista: ' + k);
    assert.equal(lê('kanban/cardume/gif_uso/' + A[k].uid, A[k]), false, 'não lê o próprio: ' + k);
    assert.equal(grava('kanban/cardume/gif_uso/' + A[k].uid, A[k], { h: '2026112410', n: 0 }), false, 'não zera o próprio: ' + k);
    assert.equal(grava('kanban/cardume/gif_uso/_casa', A[k], null), false, 'não apaga o teto da casa: ' + k);
  }
});

// ↩️ Responder (etapa 4, 24/11/2026): `resp` = id da mensagem respondida (só na criação, do MESMO canal, existente, imutável; apagar não guarda).
// O aviso de resposta reusa o índice privado de menções com r = true: só vale se a mensagem nova responde mesmo uma mensagem da pessoa avisada.
test('responder: resp só na criação, para mensagem existente do mesmo canal; imutável; apagar não guarda', () => {
  reset(); const ts = Date.now() - 2000;
  põe('orig', msg({ uid: 'bru', ts })); DB.kanban.cardume.msgs.outro = { o1: msg({ uid: 'bru', ts }) };
  assert.equal(grava(M('r1'), A.ana, msg({ resp: 'orig' })), true, 'responde uma mensagem do canal');
  assert.equal(grava(M('r1'), A.ana, msg({ resp: 'naoexiste' })), false, 'mensagem que não existe');
  assert.equal(grava(M('r1'), A.ana, msg({ resp: 'o1' })), false, 'mensagem de OUTRO canal');
  assert.equal(grava(M('r1'), A.ana, msg({ resp: 'r1' })), false, 'responder a si mesma (mesmo id)');
  assert.equal(grava(M('r1'), A.ana, msg({ resp: '../outro/o1' })), false, 'id com caminho');
  assert.equal(grava(M('r1'), A.ana, msg({ resp: 7 })), false, 'id número');
  const rr = msg({ uid: 'ana', ts, resp: 'orig' }); põe('r2', rr);
  const ed = o => Object.assign({}, rr, { texto: 'corrigido', editado: Date.now() }, o || {});
  assert.equal(grava(M('r2'), A.ana, ed()), true, 'edita o texto mantendo o resp');
  assert.equal(grava(M('r2'), A.ana, ed({ resp: undefined })), false, 'tirar o resp na edição');
  põe('outra', msg({ uid: 'bru', ts }));
  assert.equal(grava(M('r2'), A.ana, ed({ resp: 'outra' })), false, 'trocar o resp');
  põe('s1', msg({ uid: 'ana', ts }));
  assert.equal(grava(M('s1'), A.ana, Object.assign({}, msg({ uid: 'ana', ts }), { texto: 'x', editado: Date.now(), resp: 'orig' })), false, 'pôr resp numa mensagem que não tinha');
  assert.equal(grava(M('r2'), A.ana, { uid: 'ana', ts, apagada: true }), true, 'apaga sem o resp');
  assert.equal(grava(M('r2'), A.ana, { uid: 'ana', ts, apagada: true, resp: 'orig' }), false, 'apagada não guarda o resp');
});
test('aviso de resposta (r = true): só para o autor da mensagem respondida', () => {
  reset(); const ts = Date.now() - 2000;
  põe('orig', msg({ uid: 'bru', ts })); põe('rep', msg({ uid: 'ana', ts, resp: 'orig' })); põe('sem', msg({ uid: 'ana', ts }));
  DB.kanban.cardume.membros.dados.car = true; const MN = (u, id) => `kanban/cardume/mencoes/${u}/${id}`;
  const rec = o => Object.assign({ c: 'dados', m: 'rep', de: 'ana', ts: Date.now(), n: 'n9', r: true }, o || {});
  assert.equal(up(A.ana, { [MN('bru', 'y1')]: rec() }), true, 'avisa o Bruno, autor da mensagem respondida');
  assert.equal(up(A.ana, { [MN('car', 'y1')]: rec() }), false, 'avisar como "resposta" alguém que não foi respondido');
  assert.equal(up(A.ana, { [MN('bru', 'y1')]: rec({ m: 'sem' }) }), false, 'r numa mensagem que não é resposta');
  assert.equal(up(A.ana, { [MN('bru', 'y1')]: rec({ r: false }) }), false, 'r só pode ser true');
  assert.equal(up(A.ana, { [MN('bru', 'y1')]: rec({ r: undefined }) }), true, 'sem r é uma menção comum (como antes)');
  DB.kanban.cardume.mencoes = { bru: { y1: Object.assign(rec(), { ts: Date.now() - 1000 }) } };
  assert.equal(up(A.bru, { [MN('bru', 'y1') + '/lida']: true }), true, 'o Bruno marca como lida');
  assert.equal(up(A.bru, { [MN('bru', 'y1')]: Object.assign({}, DB.kanban.cardume.mencoes.bru.y1, { r: null, lida: true }) }), false, 'não tira o r');
});

// 😀 Reações — docs/ideias/cardume-v0-banco.md › "Reagir com emoji". Uma por pessoa: reacoes/{canal}/{msgId}/{uid} = emoji da lista
// fechada (a mesma do Maré). Cada um só escreve a própria folha; ninguém grava o mapa inteiro; ADM só apaga.
const RXP = (uid, id, sq) => `kanban/cardume/reacoes/${sq || 'dados'}/${id || 'm1'}/${uid}`;
const REACT_PAGINA = (() => { const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'cardume-dev.html'), 'utf8'); const m = src.match(/const REACT_EMOJIS = (\[[^\]]*\])/); return m ? JSON.parse(m[1].replace(/'/g, '"')) : []; })();
test('reações: a lista da página é a mesma do Maré e cada emoji passa nas regras (❤️ com o seletor; ❤ sem ele não)', () => {
  const mare = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'kanban-dev.html'), 'utf8').match(/const REACT_EMOJIS=(\[[^\]]*\])/);
  assert.deepEqual(REACT_PAGINA, JSON.parse(mare[1].replace(/'/g, '"')), 'Concha e Maré com a mesma lista');
  assert.equal(REACT_PAGINA.length, 5);
  reset(); põe('m1', msg({ uid: 'bru' }));
  for (const e of REACT_PAGINA) assert.equal(grava(RXP('ana'), A.ana, e), true, 'passa: ' + e + ' ' + [...e].map(c => c.codePointAt(0).toString(16)));
  assert.equal(grava(RXP('ana'), A.ana, '❤'), false, '❤ sem U+FE0F não é o ❤️ da lista');
  assert.equal(grava(RXP('ana'), A.ana, '😈'), false, 'fora da lista');
  assert.equal(grava(RXP('ana'), A.ana, '<img src=x onerror=alert(1)>'), false);
  assert.equal(grava(RXP('ana'), A.ana, true), false, 'tem de ser o emoji (string)');
  assert.equal(grava(RXP('ana'), A.ana, { e: '👍' }), false);
});
test('reações: membro reage, troca e tira a própria; não mexe na dos outros nem grava o mapa', () => {
  reset(); põe('m1', msg({ uid: 'bru' }));
  assert.equal(lê('kanban/cardume/reacoes/dados', A.ana), true, 'membro lê');
  assert.equal(lê('kanban/cardume/reacoes/dados', A.adm), true, 'ADM lê');
  assert.equal(lê('kanban/cardume/reacoes/dados', A.gil), false, 'fora do canal não lê quem reagiu');
  assert.equal(lê('kanban/cardume/reacoes', A.adm), false, 'ninguém lê todos os canais de uma vez');
  assert.equal(grava(RXP('ana'), A.ana, '👍'), true, 'reage');
  DB.kanban.cardume.reacoes = { dados: { m1: { ana: '👍', bru: '🎉' } } };
  assert.equal(grava(RXP('ana'), A.ana, '❤️'), true, 'troca');
  assert.equal(grava(RXP('ana'), A.ana, null), true, 'tira a própria');
  assert.equal(grava(RXP('bru'), A.ana, null), false, 'não tira a dos outros');
  assert.equal(grava(RXP('bru'), A.ana, '👀'), false, 'não troca a dos outros');
  assert.equal(grava(RXP('bru'), A.ana, '👍'), false, 'não reage em nome de outro');
  assert.equal(grava('kanban/cardume/reacoes/dados/m1', A.ana, { ana: '👍', bru: '👀' }), false, 'não grava o mapa da mensagem (o furo do Maré)');
  assert.equal(grava('kanban/cardume/reacoes/dados', A.adm, null), false, 'nem o ADM apaga o canal inteiro pelo navegador');
  assert.equal(update(RULES, DB, A.ana, { [RXP('ana')]: '👀', [RXP('bru')]: null }), false, 'update multi-caminho não passa pela folha alheia');
  assert.equal(grava(RXP('bru'), A.adm, null), true, 'ADM tira (moderação)');
  assert.equal(grava(RXP('adm'), A.adm, '👍'), false, 'ADM fora do canal não reage');
});
test('reações: fora do canal, intruso, mensagem apagada/inexistente e canal vencido barram; tirar a própria sempre vale', () => {
  reset(); põe('m1', msg({ uid: 'bru' })); põe('m2', { uid: 'bru', ts: Date.now() - 1000, apagada: true });
  assert.equal(grava(RXP('gil'), A.gil, '👍'), false, 'da squad, mas fora do canal');
  for (const k of ['forasteiro', 'arezzo', 'intruso']) assert.equal(grava(RXP(A[k].uid), A[k], '👍'), false, 'barra: ' + k);
  assert.equal(grava(RXP('ana', 'm2'), A.ana, '👍'), false, 'mensagem apagada');
  assert.equal(grava(RXP('ana', 'zz'), A.ana, '👍'), false, 'mensagem inexistente');
  assert.equal(grava(RXP('ana', 'm.1'), A.ana, '👍'), false, 'id fora do padrão');
  DB.kanban.cardume.reacoes = { dados: { m2: { ana: '👍' } } };
  assert.equal(grava(RXP('ana', 'm2'), A.ana, null), true, 'tira a própria mesmo com a mensagem apagada');
  DB.kanban.cardume.membros.dados.ana = null; DB.kanban.cardume.reacoes.dados.m1 = { ana: '👍' };
  assert.equal(grava(RXP('ana'), A.ana, null), true, 'tira a própria depois de sair do canal');
  assert.equal(grava(RXP('ana'), A.ana, '🎉'), false, '...mas não reage mais');
  reset(); existe('t-velho', tema({ criado: Date.now() - 10 * 864e5, fim: Date.now() - 864e5 }), { gil: true, ana: true });
  DB.kanban.cardume.msgs['t-velho'] = { m1: { uid: 'gil', ts: Date.now() - 2 * 864e5, texto: 'oi' } };
  assert.equal(grava(RXP('ana', 'm1', 't-velho'), A.ana, '👍'), false, 'canal temático vencido');
  reset(); DB.kanban.cardume.membros['t-fantasma'] = { ana: true }; DB.kanban.cardume.msgs['t-fantasma'] = { m1: { uid: 'ana', ts: Date.now(), texto: 'x' } };
  assert.equal(grava(RXP('ana', 'm1', 't-fantasma'), A.ana, '👍'), false, 'temático sem canal criado');
});

// ═══ #️⃣ #tags (25/11/2026, docs/ideias/cardume-v0-banco.md › "#tags nas mensagens") ═══
// Índice tags/{canal}/{tag}/{msgId} = ts da mensagem, gravado no MESMO update dela; tags_ult/{canal}/{tag} = último uso (serverTimestamp).
const TG = (tag, id, sq) => `kanban/cardume/tags/${sq || 'dados'}/${tag}/${id || 'k1'}`;
const TU = (tag, sq) => `kanban/cardume/tags_ult/${sq || 'dados'}/${tag}`;
const envio = (ator, id, texto, tags, extra) => { const ts = Date.now(); const m = { [M(id)]: { uid: ator.uid, ts, texto }, [`kanban/cardume/ultima/dados`]: { ts, uid: ator.uid, id } };
  tags.forEach(t => { m[TG(t, id)] = ts; m[TU(t)] = ts; }); return Object.assign(m, extra || {}); };

test('#tags: enviar com a tag no mesmo update; a regra confere que o texto tem a tag (minúsculas, acento vale)', () => {
  reset();
  assert.equal(update(RULES, DB, A.ana, envio(A.ana, 'k1', 'Subiu o #Banner da #BlackFriday', ['banner', 'blackfriday'])), true, 'mensagem + índice + último uso');
  assert.equal(update(RULES, DB, A.ana, envio(A.ana, 'k1', 'Saiu a #Promoção de hoje', ['promoção'])), true, 'acento na chave (minúsculas como escrito)');
  assert.equal(update(RULES, DB, A.ana, envio(A.ana, 'k1', 'sem tag nenhuma', ['banner'])), false, 'tag que não está no texto');
  assert.equal(update(RULES, DB, A.ana, envio(A.ana, 'k1', 'oi #Banner', ['Banner'])), false, 'chave com maiúscula');
  assert.equal(update(RULES, DB, A.ana, envio(A.ana, 'k1', 'oi #a b', ['a b'])), false, 'chave com espaço');
  const longa = 'a'.repeat(33);
  assert.equal(update(RULES, DB, A.ana, envio(A.ana, 'k1', 'oi #' + longa, [longa])), false, 'chave com mais de 32');
  const m = envio(A.ana, 'k1', 'oi #banner', []); m[TG('banner')] = Date.now() - 5000;
  assert.equal(update(RULES, DB, A.ana, m), false, 'valor diferente do ts da mensagem');
  assert.equal(update(RULES, DB, A.gil, envio(A.gil, 'k1', 'oi #banner', ['banner'])), false, 'fora do canal');
  for (const k of ['forasteiro', 'arezzo', 'intruso']) assert.equal(update(RULES, DB, A[k], envio(A[k], 'k1', 'oi #banner', ['banner'])), false, 'barra: ' + k);
  const s = envio(A.ana, 'k1', 'oi #banner', ['banner']); s[`kanban/cardume/tags_ult/dados/banner`] = Date.now() - 120000;
  assert.equal(update(RULES, DB, A.ana, s), false, 'último uso no passado (não é serverTimestamp)');
});

test('#tags: só indexa a própria mensagem, viva e de canal ativo', () => {
  reset(); const ts = Date.now() - 1000;
  põe('b1', msg({ uid: 'bru', ts, texto: 'proposta #banner' })); põe('a1', msg({ ts, texto: 'minha #banner' })); põe('x1', { uid: 'ana', ts, apagada: true });
  assert.equal(grava(TG('banner', 'b1'), A.ana, ts), false, 'pôr a mensagem de outra pessoa na tag');
  assert.equal(grava(TG('banner', 'a1'), A.ana, ts), true, 'a própria (ex.: edição que acrescentou a tag)');
  assert.equal(grava(TG('banner', 'x1'), A.ana, ts), false, 'mensagem apagada');
  assert.equal(grava(TG('banner', 'zz'), A.ana, ts), false, 'mensagem inexistente');
  assert.equal(grava(TG('banner', 'a1'), A.ana, 'texto'), false, 'valor tem de ser número');
  reset(); existe('t-velho', tema({ criado: Date.now() - 10 * 864e5, fim: Date.now() - 864e5 }), { ana: true });
  DB.kanban.cardume.msgs['t-velho'] = { a1: { uid: 'ana', ts, texto: 'oi #banner' } };
  assert.equal(grava(TG('banner', 'a1', 't-velho'), A.ana, ts), false, 'canal temático vencido');
});

test('#tags: tirar a entrada é do autor ou do ADM; editar e apagar levam a diferença no mesmo update', () => {
  reset(); const ts = Date.now() - 1000;
  põe('a1', msg({ ts, texto: 'oi #a' })); DB.kanban.cardume.tags = { dados: { a: { a1: ts } } }; DB.kanban.cardume.tags_ult = { dados: { a: ts } };
  assert.equal(grava(TG('a', 'a1'), A.bru, null), false, 'outro membro não tira');
  assert.equal(grava(TG('a', 'a1'), A.adm, null), true, 'ADM tira (moderação)');
  assert.equal(grava(TG('a', 'a1'), A.ana, null), true, 'o autor tira');
  const agora = Date.now();
  assert.equal(update(RULES, DB, A.ana, { [M('a1') + '/texto']: 'oi #b', [M('a1') + '/editado']: agora, [TG('a', 'a1')]: null, [TG('b', 'a1')]: ts, [TU('b')]: agora }), true, 'edição troca #a por #b');
  assert.equal(update(RULES, DB, A.ana, { [M('a1') + '/texto']: 'oi', [M('a1') + '/editado']: agora, [TG('b', 'a1')]: ts }), false, 'edição não põe tag que saiu do texto');
  assert.equal(update(RULES, DB, A.ana, { [M('a1')]: { uid: 'ana', ts, apagada: true }, [TG('a', 'a1')]: null }), true, 'apagar tira a entrada junto');
  assert.equal(update(RULES, DB, A.ana, { [M('a1')]: { uid: 'ana', ts, apagada: true }, [TG('a', 'a1')]: ts }), false, 'mensagem apagada não fica na tag');
});

test('#tags: tags_ult só com entrada da tag; ninguém além do ADM apaga; leitura só de membro e ADM', () => {
  reset(); const ts = Date.now() - 1000; põe('a1', msg({ ts, texto: 'oi #a' }));
  assert.equal(grava(TU('a'), A.ana, Date.now()), false, 'sem nenhuma entrada da tag');
  DB.kanban.cardume.tags = { dados: { a: { a1: ts } } };
  assert.equal(grava(TU('a'), A.ana, Date.now()), true, 'com entrada');
  assert.equal(grava(TU('a'), A.gil, Date.now()), false, 'fora do canal');
  DB.kanban.cardume.tags_ult = { dados: { a: ts } };
  assert.equal(grava(TU('a'), A.ana, null), false, 'membro não apaga');
  assert.equal(grava(TU('a'), A.adm, null), true, 'ADM apaga');
  for (const no of ['tags', 'tags_ult']) {
    for (const k of ['ana', 'bru', 'adm', 'caio']) assert.equal(lê(`kanban/cardume/${no}/dados`, A[k]), true, no + ' lê: ' + k);
    for (const k of ['gil', 'forasteiro', 'arezzo', 'intruso']) assert.equal(lê(`kanban/cardume/${no}/dados`, A[k]), false, no + ' NÃO lê: ' + k);
    assert.equal(lê(`kanban/cardume/${no}`, A.adm), false, no + ': ninguém lê todos os canais de uma vez');
  }
});

// ═══ 🔔 Avisos de mensagem nova (25/11/2026): preferências PRIVADAS de cada pessoa + trava fechada da função ═══
test('avisos: só a própria pessoa lê e grava; níveis mencoes/nada, prazo no futuro (até ~1 ano); apagar = voltar a todas', () => {
  reset(); const AV = (u, c) => `kanban/cardume/avisos/${u || 'ana'}/${c || 'dados'}`;
  assert.equal(grava(AV(), A.ana, { nivel: 'mencoes', ate: Date.now() + 8 * 3600e3 }), true, '🔕 por 8 h');
  assert.equal(grava(AV(), A.ana, { nivel: 'nada' }), true, '🚫 sempre');
  assert.equal(grava(AV(), A.ana, null), true, 'voltar a todas');
  assert.equal(grava(AV(), A.ana, { nivel: 'todas' }), false, 'nível fora da lista');
  assert.equal(grava(AV(), A.ana, { nivel: 'nada', ate: Date.now() - 1000 }), false, 'prazo no passado');
  assert.equal(grava(AV(), A.ana, { nivel: 'nada', ate: Date.now() + 500 * 864e5 }), false, 'prazo além de ~1 ano');
  assert.equal(grava(AV(), A.ana, { nivel: 'nada', x: 1 }), false, 'campo extra');
  assert.equal(grava(AV('ana', 'a.b'), A.ana, { nivel: 'nada' }), false, 'canal fora do padrão');
  assert.equal(grava(AV('ana'), A.bru, { nivel: 'nada' }), false, 'ninguém mexe no aviso de outra pessoa');
  assert.equal(grava(AV('ana'), A.adm, { nivel: 'nada' }), false, 'nem o ADM');
  assert.equal(lê('kanban/cardume/avisos/ana', A.ana), true);
  for (const k of ['bru', 'adm', 'forasteiro', 'intruso']) assert.equal(lê('kanban/cardume/avisos/ana', A[k]), false, 'NÃO lê: ' + k);
  assert.equal(lê('kanban/cardume/avisos', A.adm), false, 'ninguém lê as preferências de todo mundo');
});

test('seguidas e vendo: privados; #tag com a mesma chave das tags; sinal de vida só com serverTimestamp', () => {
  reset(); const SG = t => `kanban/cardume/seguidas/ana/${t}`, VD = (u, c) => `kanban/cardume/vendo/${u || 'ana'}/${c || 'dados'}`;
  assert.equal(grava(SG('banner'), A.ana, Date.now()), true);
  assert.equal(grava(SG('promoção'), A.ana, Date.now()), true, 'acento');
  assert.equal(grava(SG('Banner'), A.ana, Date.now()), false, 'maiúscula');
  assert.equal(grava(SG('a b'), A.ana, Date.now()), false, 'espaço');
  assert.equal(grava(SG('banner'), A.ana, true), false, 'valor tem de ser número');
  assert.equal(grava(SG('banner'), A.bru, Date.now()), false, 'outra pessoa');
  assert.equal(grava(SG('banner'), A.ana, null), true, 'deixar de seguir');
  assert.equal(grava(VD(), A.ana, Date.now()), true);
  assert.equal(grava(VD(), A.ana, Date.now() - 120000), false, 'sinal velho');
  assert.equal(grava(VD(), A.ana, Date.now() + 120000), false, 'sinal no futuro (prenderia os avisos)');
  assert.equal(grava(VD('ana'), A.bru, Date.now()), false, 'calar o aviso de outra pessoa');
  assert.equal(grava(VD(), A.ana, null), true, 'saiu da conversa');
  for (const no of ['seguidas', 'vendo']) for (const k of ['bru', 'adm']) assert.equal(lê(`kanban/cardume/${no}/ana`, A[k]), false, no + ' NÃO lê: ' + k);
  for (const k of ['ana', 'adm', 'caio']) { assert.equal(lê('kanban/cardume/aviso_env/ana', A[k]), false, 'trava da função fechada: ' + k); assert.equal(grava('kanban/cardume/aviso_env/ana/dados', A[k], Date.now()), false, 'trava: ' + k); }
});

// ═══ 📁 Seções na lista de canais (25/11/2026): organização PESSOAL, privada ═══
test('seções: só a própria pessoa lê e grava; canal só aponta para seção que existe; nada de campo solto', () => {
  reset(); const SC = 'kanban/cardume/secoes/ana';
  const sec = { s: { sfav: { n: '⭐ Favoritos', o: 0 }, sproj: { n: 'Projetos', o: 1 } }, c: { dados: 'sfav' }, r: { squads: true, sproj: true } };
  assert.equal(grava(SC, A.ana, sec), true, 'estrutura completa');
  assert.equal(grava(SC, A.bru, sec), false, 'outra pessoa');
  assert.equal(grava(SC, A.adm, sec), false, 'nem o ADM');
  assert.equal(grava(SC, A.ana, { s: { sfav: { n: 'F', o: 0 } }, c: { dados: 'snaoexiste' } }), false, 'canal apontando para seção que não existe');
  assert.equal(grava(SC, A.ana, { s: { sfav: { n: '', o: 0 } } }), false, 'nome vazio');
  assert.equal(grava(SC, A.ana, { s: { sfav: { n: 'x'.repeat(31), o: 0 } } }), false, 'nome com mais de 30');
  assert.equal(grava(SC, A.ana, { s: { 'Fav!': { n: 'F', o: 0 } } }), false, 'id de seção fora do padrão');
  assert.equal(grava(SC, A.ana, { s: { sfav: { n: 'F', o: 0, cor: 'x' } } }), false, 'campo extra na seção');
  assert.equal(grava(SC, A.ana, { r: { qualquer: true } }), false, 'recolhida com chave estranha');
  assert.equal(grava(SC, A.ana, { outra: 1 }), false, 'nó solto');
  DB.kanban.cardume.secoes = { ana: sec };
  assert.equal(update(RULES, DB, A.ana, { [SC + '/s/sproj']: null, [SC + '/c/prf']: 'sproj' }), false, 'apagar a seção e apontar para ela no mesmo update');
  assert.equal(update(RULES, DB, A.ana, { [SC + '/s/sfav']: null, [SC + '/c/dados']: null, [SC + '/r/sfav']: null }), true, 'apagar a seção leva os canais dela junto');
  assert.equal(lê(SC, A.ana), true);
  for (const k of ['bru', 'adm', 'forasteiro']) assert.equal(lê(SC, A[k]), false, 'NÃO lê: ' + k);
});

// ═══ 🧵 Assuntos dentro do canal (25/11/2026) ═══
const AS = (aid, sq) => `kanban/cardume/assuntos/${sq || 'dados'}/${aid || 'abf'}`;
const assunto = o => Object.assign({ n: 'banner BF', por: 'ana', criado: Date.now() }, o || {});
test('assuntos: membro cria (por = ele, sem fim); só membro e ADM leem; fora do canal, forjar autor, encerrar na criação e campo extra barram', () => {
  reset();
  assert.equal(grava(AS(), A.ana, assunto()), true, 'membro cria');
  assert.equal(grava(AS(), A.gil, assunto({ por: 'gil' })), false, 'da squad, fora do canal');
  assert.equal(grava(AS(), A.ana, assunto({ por: 'bru' })), false, 'forjar quem criou');
  assert.equal(grava(AS(), A.ana, assunto({ fim: Date.now() })), false, 'já nascer encerrado');
  assert.equal(grava(AS(), A.ana, assunto({ n: '' })), false, 'sem nome');
  assert.equal(grava(AS(), A.ana, assunto({ n: 'x'.repeat(61) })), false, 'nome longo');
  assert.equal(grava(AS(), A.ana, assunto({ cor: 'x' })), false, 'campo extra');
  assert.equal(grava(AS('Abf'), A.ana, assunto()), false, 'id fora do padrão');
  assert.equal(grava(AS(), A.ana, assunto({ criado: Date.now() - 120000 })), false, 'criado no passado');
  for (const k of ['ana', 'bru', 'adm']) assert.equal(lê('kanban/cardume/assuntos/dados', A[k]), true, 'lê: ' + k);
  for (const k of ['gil', 'forasteiro']) assert.equal(lê('kanban/cardume/assuntos/dados', A[k]), false, 'NÃO lê: ' + k);
});

test('assuntos: renomear/encerrar é de quem criou (ainda no canal) ou do gestor; reabrir também; só o ADM apaga', () => {
  reset(); const cri = Date.now() - 864e5;
  DB.kanban.usuarios.bru.squads = { dados: true }; DB.kanban.usuarios.bru.squads_roles = { dados: 'po' };
  DB.kanban.cardume.membros.dados.cai = true;
  DB.kanban.cardume.assuntos = { dados: { abf: assunto({ criado: cri }) } };
  assert.equal(grava(AS(), A.ana, assunto({ criado: cri, n: 'banner da BF' })), true, 'quem criou renomeia');
  assert.equal(grava(AS(), A.ana, assunto({ criado: cri, fim: Date.now() })), true, 'quem criou encerra');
  assert.equal(grava(AS(), A.caio, assunto({ criado: cri, n: 'outro' })), true, 'ADM');
  assert.equal(grava(AS(), A.bru, assunto({ criado: cri, fim: Date.now() })), true, 'PO da squad (gestor)');
  DB.kanban.cardume.membros.dados.int = null; DB.kanban.cardume.membros.dados.gil = true;
  assert.equal(grava(AS(), A.gil, assunto({ criado: cri, n: 'meu agora' })), false, 'outro membro não renomeia');
  assert.equal(grava(AS(), A.ana, assunto({ criado: cri, por: 'gil' })), false, 'trocar quem criou');
  assert.equal(grava(AS(), A.ana, assunto({ criado: cri + 1 })), false, 'trocar criado');
  DB.kanban.cardume.assuntos.dados.abf.fim = Date.now() - 1000;
  assert.equal(grava(AS(), A.ana, assunto({ criado: cri })), true, 'reabrir (tirar o fim)');
  DB.kanban.cardume.membros.dados.ana = null;
  assert.equal(grava(AS(), A.ana, assunto({ criado: cri, n: 'saí mas renomeio' })), false, 'quem criou e saiu do canal perde o direito');
  assert.equal(grava(AS(), A.bru, null), false, 'gestor não apaga o nó');
  assert.equal(grava(AS(), A.adm, null), true, 'ADM apaga');
});

test('mensagem no assunto: a só na criação, para assunto aberto do mesmo canal; imutável; encerrado barra nova, edição e reação; apagar guarda o a', () => {
  reset(); const ts = Date.now() - 1000;
  DB.kanban.cardume.assuntos = { dados: { abf: assunto({ criado: ts - 864e5 }), afim: assunto({ criado: ts - 864e5, fim: ts - 500 }) } };
  const nova = (aid, extra) => { const t = Date.now(); return Object.assign({ [M('k1')]: { uid: 'ana', ts: t, texto: 'oi', a: aid }, ['kanban/cardume/ultima/dados']: { ts: t, uid: 'ana', id: 'k1' }, ['kanban/cardume/ultima_a/dados/' + aid]: { ts: t, uid: 'ana', id: 'k1' } }, extra || {}); };
  assert.equal(update(RULES, DB, A.ana, nova('abf')), true, 'mensagem + não lidas do canal e do assunto');
  assert.equal(update(RULES, DB, A.ana, nova('azz')), false, 'assunto que não existe');
  assert.equal(update(RULES, DB, A.ana, nova('afim')), false, 'assunto encerrado');
  const t2 = Date.now();
  assert.equal(update(RULES, DB, A.ana, { [AS('anovo')]: assunto({ criado: t2 }), [M('k2')]: { uid: 'ana', ts: t2, texto: 'primeira', a: 'anovo' }, ['kanban/cardume/ultima/dados']: { ts: t2, uid: 'ana', id: 'k2' } }), true, 'criar o assunto e a 1ª mensagem no mesmo update');
  assert.equal(update(RULES, DB, A.ana, { [M('k3')]: { uid: 'ana', ts: t2, texto: 'geral' }, ['kanban/cardume/ultima_a/dados/abf']: { ts: t2, uid: 'ana', id: 'k3' } }), false, 'não lida do assunto apontando para mensagem de geral');
  assert.equal(update(RULES, DB, A.ana, { [M('k3')]: { uid: 'ana', ts: t2, texto: 'geral' }, ['kanban/cardume/ultima_a/dados/_geral']: { ts: t2, uid: 'ana', id: 'k3' } }), true, 'geral marca _geral');
  põe('m1', msg({ ts, a: 'abf' })); põe('m2', msg({ ts, a: 'afim', uid: 'bru' })); põe('m3', msg({ ts, a: 'afim' }));
  const ag = Date.now();
  assert.equal(grava(M('m1'), A.ana, { uid: 'ana', ts, texto: 'editado', editado: ag, a: 'abf' }), true, 'editar no assunto aberto');
  assert.equal(grava(M('m1'), A.ana, { uid: 'ana', ts, texto: 'editado', editado: ag, a: 'afim' }), false, 'mudar de assunto ao editar');
  assert.equal(grava(M('m1'), A.ana, { uid: 'ana', ts, texto: 'editado', editado: ag }), false, 'tirar o assunto ao editar');
  assert.equal(grava(M('m3'), A.ana, { uid: 'ana', ts, texto: 'editado', editado: ag, a: 'afim' }), false, 'editar no assunto encerrado');
  assert.equal(grava(M('m1'), A.ana, { uid: 'ana', ts, apagada: true, a: 'abf' }), true, 'apagar guarda o a');
  assert.equal(grava(M('m1'), A.ana, { uid: 'ana', ts, apagada: true }), false, 'apagar sem o a (iria para geral)');
  assert.equal(grava(RXP('ana', 'm2'), A.ana, '👍'), false, 'reagir no assunto encerrado');
  DB.kanban.cardume.reacoes = { dados: { m2: { ana: '👍' } } };
  assert.equal(grava(RXP('ana', 'm2'), A.ana, null), true, 'tirar a própria reação sempre vale');
});

test('lidas_a: privado; _geral ou id de assunto; número', () => {
  reset(); const L = (u, a) => `kanban/cardume/lidas_a/${u || 'ana'}/dados/${a || 'abf'}`;
  assert.equal(grava(L(), A.ana, Date.now()), true);
  assert.equal(grava(L('ana', '_geral'), A.ana, Date.now()), true);
  assert.equal(grava(L('ana', 'x.y'), A.ana, Date.now()), false, 'chave estranha');
  assert.equal(grava(L(), A.ana, 'ontem'), false, 'não-número');
  assert.equal(grava(L('ana'), A.bru, Date.now()), false, 'outra pessoa');
  assert.equal(lê('kanban/cardume/lidas_a/ana', A.bru), false);
});

test('avisos_a (aviso por assunto): privado; seguir ou mencoes; prazo no futuro; ninguém mexe no de outra pessoa', () => {
  reset(); const AA = (u, a) => `kanban/cardume/avisos_a/${u || 'ana'}/dados/${a || 'abf'}`;
  assert.equal(grava(AA(), A.ana, { nivel: 'seguir' }), true, '🔔 seguir');
  assert.equal(grava(AA(), A.ana, { nivel: 'mencoes', ate: Date.now() + 8 * 3600e3 }), true, '🔕 por 8 h');
  assert.equal(grava(AA(), A.ana, null), true, 'voltar a "como o canal"');
  assert.equal(grava(AA(), A.ana, { nivel: 'nada' }), false, '"nada" é só do canal');
  assert.equal(grava(AA(), A.ana, { nivel: 'seguir', ate: Date.now() - 1 }), false, 'prazo no passado');
  assert.equal(grava(AA(), A.ana, { nivel: 'seguir', x: 1 }), false, 'campo extra');
  assert.equal(grava(AA('ana', '_geral'), A.ana, { nivel: 'seguir' }), false, 'geral não é assunto');
  assert.equal(grava(AA('ana'), A.bru, { nivel: 'mencoes' }), false, 'outra pessoa');
  assert.equal(grava(AA('ana'), A.adm, { nivel: 'mencoes' }), false, 'nem o ADM');
  assert.equal(lê('kanban/cardume/avisos_a/ana', A.ana), true);
  for (const k of ['bru', 'adm']) assert.equal(lê('kanban/cardume/avisos_a/ana', A[k]), false, 'NÃO lê: ' + k);
});

// ═══ 😀 Emoji do canal e do assunto (25/11/2026): só da lista da página; o canal oficial ganha o emoji também por PO/Org da squad ═══
test('emoji do canal: quem administra muda (inclusive PO/Org no oficial, que no resto só o ADM edita); membro comum, fora da lista e canal inexistente não', () => {
  reset(); const E = (c) => `kanban/cardume/canais/${c || 'dados'}/e`;
  DB.kanban.usuarios.bru.squads = { dados: true }; DB.kanban.usuarios.bru.squads_roles = { dados: 'po' };
  assert.equal(grava(E(), A.bru, '📊'), true, 'PO da squad no oficial');
  assert.equal(grava(E(), A.adm, '🔥'), true, 'ADM');
  assert.equal(grava(E(), A.ana, '📊'), false, 'membro comum');
  assert.equal(grava(E(), A.bru, '🦄'), false, 'emoji fora da lista');
  assert.equal(grava(E(), A.bru, 'LOL'), false, 'texto');
  assert.equal(grava('kanban/cardume/canais/dados/nome', A.bru, 'Outro nome'), false, 'PO continua sem mexer no resto do oficial');
  DB.kanban.usuarios.bru.squads.prf = true; DB.kanban.usuarios.bru.squads_roles.prf = 'po';
  assert.equal(grava(E('prf'), A.bru, '📊'), false, 'PO não cria canal pelo emoji (canal ainda não ativado)');
  reset(); existe('t-bf-ab12', tema({ dono: 'ana' }), { ana: true, bru: true });
  assert.equal(grava(E('t-bf-ab12'), A.ana, '🖤'), true, 'dona do temático');
  assert.equal(grava(E('t-bf-ab12'), A.bru, '🖤'), false, 'membro do temático');
});

test('emoji do assunto: quem cria já escolhe; quem criou ou gestor troca; só da lista', () => {
  reset(); const ag = Date.now();
  assert.equal(grava('kanban/cardume/assuntos/dados/abf', A.ana, { n: 'banner', por: 'ana', criado: ag, e: '🎨' }), true, 'criar com emoji');
  assert.equal(grava('kanban/cardume/assuntos/dados/abf', A.ana, { n: 'banner', por: 'ana', criado: ag, e: '🦄' }), false, 'fora da lista');
  DB.kanban.cardume.assuntos = { dados: { abf: { n: 'banner', por: 'ana', criado: ag - 1000 } } };
  assert.equal(grava('kanban/cardume/assuntos/dados/abf/e', A.ana, '📈'), true, 'quem criou troca');
  DB.kanban.cardume.membros.dados.gil = true;
  assert.equal(grava('kanban/cardume/assuntos/dados/abf/e', A.gil, '📈'), false, 'outro membro');
});

// ═══ ✏️ Editar só nos primeiros 15 min (pedido do Caio, 25/11/2026, "igual o WhatsApp") ═══
test('editar: só até 15 min depois de enviar (ts e editado são do servidor); apagar continua valendo depois', () => {
  reset(); const ag = Date.now();
  põe('m1', msg({ ts: ag - 14 * 60000 })); põe('m2', msg({ ts: ag - 16 * 60000 }));
  assert.equal(grava(M('m1'), A.ana, msg({ ts: ag - 14 * 60000, texto: 'corrigido', editado: ag })), true, 'aos 14 min edita');
  assert.equal(grava(M('m2'), A.ana, msg({ ts: ag - 16 * 60000, texto: 'corrigido', editado: ag })), false, 'aos 16 min não edita');
  assert.equal(grava(M('m2') + '/texto', A.ana, 'só o texto'), false, 'nem gravando só o filho');
  assert.equal(grava(M('m2'), A.ana, { uid: 'ana', ts: ag - 16 * 60000, apagada: true }), true, 'apagar a própria depois dos 15 min continua valendo');
});

// ═══ ⏩ Encaminhar (25/11/2026): mensagem nova no destino com enc = {c, m, de, ts, n}; conteúdo igual ao da original ═══
test('encaminhar: membro da origem copia a original (texto/GIF iguais, nome do canal de origem); forjar conteúdo, autoria, nome ou origem barra', () => {
  reset(); const ts0 = Date.now() - 864e5;
  DB.kanban.cardume.canais.prf = { nome: 'Performance' }; DB.kanban.cardume.membros.prf = { ana: true, bru: true };
  DB.kanban.cardume.msgs.prf = { o1: { uid: 'bru', ts: ts0, texto: 'segredo da squad' }, o2: { uid: 'bru', ts: ts0, gif: { u: 'https://static.klipy.com/a.gif', w: 10, h: 10, t: 'risada' } }, oap: { uid: 'bru', ts: ts0, apagada: true }, oenc: { uid: 'ana', ts: ts0, texto: 'já encaminhada', enc: { c: 'dados', m: 'x', de: 'gil', ts: ts0, n: 'dados' } } };
  const env = (o, extra) => { const t = Date.now(); return Object.assign({ [M('f1')]: Object.assign({ uid: 'ana', ts: t }, o), ['kanban/cardume/ultima/dados']: { ts: t, uid: 'ana', id: 'f1' } }, extra || {}); };
  const enc = o => Object.assign({ c: 'prf', m: 'o1', de: 'bru', ts: ts0, n: 'Performance' }, o || {});
  assert.equal(update(RULES, DB, A.ana, env({ texto: 'segredo da squad', enc: enc() })), true, 'encaminha texto');
  assert.equal(update(RULES, DB, A.ana, env({ gif: { u: 'https://static.klipy.com/a.gif', w: 10, h: 10, t: 'risada' }, enc: enc({ m: 'o2' }) })), true, 'encaminha GIF com a legenda');
  assert.equal(update(RULES, DB, A.ana, env({ texto: 'texto inventado', enc: enc() })), false, 'texto diferente do original');
  assert.equal(update(RULES, DB, A.ana, env({ gif: { u: 'https://static.klipy.com/a.gif', w: 10, h: 10, t: 'legenda inventada' }, enc: enc({ m: 'o2' }) })), false, 'legenda do GIF diferente');
  assert.equal(update(RULES, DB, A.ana, env({ texto: 'segredo da squad', enc: enc({ de: 'gil' }) })), false, 'autoria forjada');
  assert.equal(update(RULES, DB, A.ana, env({ texto: 'segredo da squad', enc: enc({ ts: ts0 + 1 }) })), false, 'hora diferente');
  assert.equal(update(RULES, DB, A.ana, env({ texto: 'segredo da squad', enc: enc({ n: 'Outro nome' }) })), false, 'nome do canal de origem diferente do atual');
  assert.equal(update(RULES, DB, A.ana, env({ enc: enc({ m: 'oap', de: 'bru' }), texto: 'x' })), false, 'original apagada');
  assert.equal(update(RULES, DB, A.ana, env({ texto: 'já encaminhada', enc: enc({ m: 'oenc', de: 'ana' }) })), false, 'encaminhar uma encaminhada (v1)');
  assert.equal(update(RULES, DB, A.ana, env({ texto: 'segredo da squad', resp: 'x', enc: enc() })), false, 'com resposta junto');
  assert.equal(update(RULES, DB, A.ana, env({ texto: 'segredo da squad', enc: enc({ c: 'dados' }) })), false, 'origem = o próprio canal');
  DB.kanban.cardume.membros.dados.gil = true; DB.kanban.cardume.msgs.prf.o1 = { uid: 'bru', ts: ts0, texto: 'segredo da squad' };
  const envG = (o) => { const t = Date.now(); return { [M('f2')]: Object.assign({ uid: 'gil', ts: t }, o), ['kanban/cardume/ultima/dados']: { ts: t, uid: 'gil', id: 'f2' } }; };
  assert.equal(update(RULES, DB, A.gil, envG({ texto: 'segredo da squad', enc: enc() })), false, 'quem NÃO é da origem não encaminha (nem sabendo o texto)');
  DB.kanban.usuarios.adm.squads = {}; DB.kanban.cardume.membros.dados.adm = true;
  const envA = (o) => { const t = Date.now(); return { [M('f3')]: Object.assign({ uid: 'adm', ts: t }, o), ['kanban/cardume/ultima/dados']: { ts: t, uid: 'adm', id: 'f3' } }; };
  assert.equal(update(RULES, DB, A.adm, envA({ texto: 'segredo da squad', enc: enc() })), false, 'nem o ADM que não é membro da origem');
});

test('encaminhada: não se edita; apagar não guarda a origem', () => {
  reset(); const ts = Date.now() - 1000, ag = Date.now();
  põe('f1', { uid: 'ana', ts, texto: 'oi', enc: { c: 'prf', m: 'o1', de: 'bru', ts: ts - 9e5, n: 'Performance' } });
  assert.equal(grava(M('f1'), A.ana, { uid: 'ana', ts, texto: 'mudei', editado: ag, enc: { c: 'prf', m: 'o1', de: 'bru', ts: ts - 9e5, n: 'Performance' } }), false, 'editar encaminhada');
  assert.equal(grava(M('f1') + '/texto', A.ana, 'mudei'), false, 'nem só o texto');
  assert.equal(update(RULES, DB, A.ana, { [M('f1') + '/texto']: 'mudei', [M('f1') + '/editado']: ag }), false, 'edição normal (texto + editado, dentro dos 15 min) numa encaminhada');
  põe('n1', { uid: 'ana', ts, texto: 'minha' });
  assert.equal(update(RULES, DB, A.ana, { [M('n1') + '/texto']: 'mudei', [M('n1') + '/editado']: ag }), true, '(controle) a mesma edição numa mensagem normal passa');
  assert.equal(grava(M('f1'), A.ana, { uid: 'ana', ts, apagada: true }), true, 'apagar');
  assert.equal(grava(M('f1'), A.ana, { uid: 'ana', ts, apagada: true, enc: { c: 'prf', m: 'o1', de: 'bru', ts: ts - 9e5, n: 'Performance' } }), false, 'apagar guardando a origem');
});

// 📌 Fixar no canal (26/11/2026) — docs/ideias/cardume-v0-banco.md › "Fixar no canal". fixadas/{canal}/{msgId} = { por, em }.
// Decisões do Caio: só GESTORES fixam e desafixam (ADM, PO/Org da squad no oficial; dona/co-admin no temático); a limpeza pula a fixada.
const FX = (id, sq) => `kanban/cardume/fixadas/${sq || 'dados'}/${id || 'm1'}`;
const fx = (por, o) => Object.assign({ por, em: Date.now(), t: 'topo' }, o || {});
const resetFx = () => {
  reset();
  Object.assign(DB.kanban.usuarios, {
    pos: { role: 'membro', squads: { dados: true }, squads_roles: { dados: 'po' } },    // PO da squad, membro do canal
    pon: { role: 'membro', squads: { dados: true }, squads_roles: { dados: 'po' } },    // PO da squad, FORA do canal
  });
  DB.kanban.cardume.membros.dados.pos = true;
  põe('m1', msg()); põe('m2', msg({ uid: 'bru' }));
};
A.pos = mk('pos', 'pos@ciahering.com.br'); A.pon = mk('pon', 'pon@ciahering.com.br');

test('📌 fixadas: leitura igual à das mensagens (membro e ADM)', () => {
  resetFx(); DB.kanban.cardume.fixadas = { dados: { m1: fx('pos') } };
  assert.equal(lê('kanban/cardume/fixadas/dados', A.ana), true, 'membro vê as fixadas');
  assert.equal(lê('kanban/cardume/fixadas/dados', A.adm), true, 'ADM vê');
  assert.equal(lê('kanban/cardume/fixadas/dados', A.gil), false, 'fora do canal não vê');
  assert.equal(lê('kanban/cardume/fixadas/dados', A.pon), false, 'PO da squad fora do canal não vê (como as mensagens)');
  assert.equal(lê('kanban/cardume/fixadas', A.adm), false, 'ninguém lê todos os canais de uma vez');
});

test('📌 fixar: só gestor (que lê o canal) fixa, mensagem viva do próprio canal, só criar', () => {
  resetFx();
  assert.equal(grava(FX('m1'), A.pos, fx('pos')), true, 'PO da squad, membro do canal, fixa');
  assert.equal(grava(FX('m2'), A.adm, fx('adm')), true, 'ADM fixa');
  assert.equal(grava(FX('m2'), A.ana, fx('ana')), false, 'membro que não é gestor NÃO fixa (decisão do Caio)');
  assert.equal(grava(FX('m2'), A.pon, fx('pon')), false, 'PO da squad fora do canal não fixa (não lê o canal)');
  assert.equal(grava(FX('m2'), A.pos, fx('ana')), false, 'por forjado');
  assert.equal(grava(FX('m2'), A.pos, fx('pos', { em: Date.now() + 120000 })), false, 'hora no futuro');
  assert.equal(grava(FX('m2'), A.pos, fx('pos', { nota: 'x' })), false, 'campo extra');
  assert.equal(grava(FX('zz'), A.pos, fx('pos')), false, 'mensagem que não existe');
  põe('ap', { uid: 'ana', ts: Date.now(), apagada: true });
  assert.equal(grava(FX('ap'), A.pos, fx('pos')), false, 'mensagem apagada');
  DB.kanban.cardume.msgs.prf = { o1: msg() };
  assert.equal(grava(FX('o1'), A.pos, fx('pos')), false, 'mensagem de OUTRO canal não fixa aqui');
  DB.kanban.cardume.fixadas = { dados: { m1: fx('pos', { em: Date.now() - 5000 }) } };
  assert.equal(grava(FX('m1'), A.pos, fx('pos')), false, 'não regrava uma fixada existente com outra hora (só criar, tirar ou trocar o tipo)');
  assert.equal(grava(FX('m1'), A.adm, fx('adm')), false, 'nem o ADM regrava com outro autor');
});

test('📌 desafixar: gestor e ADM tiram; membro só tira fixada órfã (mensagem apagada), inclusive no MESMO update do tombstone', () => {
  resetFx(); DB.kanban.cardume.fixadas = { dados: { m1: fx('pos'), m2: fx('pos') } };
  assert.equal(grava(FX('m1'), A.ana, null), false, 'membro não desafixa uma fixada viva');
  assert.equal(grava(FX('m1'), A.gil, null), false, 'fora do canal não mexe');
  assert.equal(grava(FX('m1'), A.pos, null), true, 'gestor desafixa');
  assert.equal(grava(FX('m2'), A.adm, null), true, 'ADM desafixa');
  // a autora apaga a própria mensagem fixada: tombstone + tirar a fixada no MESMO update (a regra olha o estado DEPOIS da escrita)
  resetFx(); DB.kanban.cardume.fixadas = { dados: { m1: fx('pos') } }; const ts = DB.kanban.cardume.msgs.dados.m1.ts;
  assert.equal(update(RULES, DB, A.ana, { [M('m1')]: { uid: 'ana', ts, apagada: true }, [FX('m1')]: null }), true, 'apagar + desafixar juntos');
  assert.equal(update(RULES, DB, A.ana, { [FX('m1')]: null }), false, '(controle) sem o tombstone, a membro não desafixa');
  // depois, em escrita separada (outra aba ainda via a fixada): qualquer membro limpa a órfã
  resetFx(); põe('ap', { uid: 'bru', ts: Date.now(), apagada: true }); DB.kanban.cardume.fixadas = { dados: { ap: fx('pos'), sumiu: fx('pos') } };
  assert.equal(grava(FX('ap'), A.ana, null), true, 'membro limpa fixada de mensagem apagada');
  assert.equal(grava(FX('sumiu'), A.ana, null), true, 'membro limpa fixada de mensagem que não existe mais');
  assert.equal(grava(FX('ap'), A.gil, null), false, 'fora do canal, nem a órfã');
});

test('📌 temático: dona e co-admin fixam; canal vencido não fixa', () => {
  resetFx();
  const t = 't-black-friday', agora = Date.now();
  DB.kanban.cardume.canais[t] = tema({ criado: agora - 864e5 });
  DB.kanban.cardume.membros[t] = { gil: true, ana: true, bru: true };
  DB.kanban.cardume.admins = { [t]: { bru: true } };
  DB.kanban.cardume.msgs[t] = { t1: msg(), t2: msg() };
  assert.equal(grava(FX('t1', t), A.gil, fx('gil')), true, 'dona fixa');
  assert.equal(grava(FX('t2', t), A.bru, fx('bru')), true, 'co-admin fixa');
  assert.equal(grava(FX('t2', t), A.ana, fx('ana')), false, 'membro comum do temático não fixa');
  DB.kanban.cardume.canais[t].fim = agora - 1000;
  assert.equal(grava(FX('t2', t), A.gil, fx('gil')), false, 'canal vencido não fixa');
  assert.equal(grava(FX('t2', t), A.adm, fx('adm')), false, 'nem o ADM fixa em canal vencido');
});

test('📌 tipos: topo ou regra, obrigatório; o gestor troca o tipo sem mudar quem fixou nem quando', () => {
  resetFx();
  assert.equal(grava(FX('m1'), A.pos, fx('pos', { t: 'regra' })), true, 'fixar como regra');
  assert.equal(grava(FX('m2'), A.pos, { por: 'pos', em: Date.now() }), false, 'sem tipo não fixa');
  assert.equal(grava(FX('m2'), A.pos, fx('pos', { t: 'banner' })), false, 'tipo fora da lista');
  const antes = fx('bru', { em: Date.now() - 5000, t: 'topo' }); DB.kanban.cardume.fixadas = { dados: { m1: antes } };
  assert.equal(grava(FX('m1'), A.pos, Object.assign({}, antes, { t: 'regra' })), true, 'gestor move do topo para as regras');
  assert.equal(grava(FX('m1'), A.adm, Object.assign({}, antes, { t: 'regra' })), true, 'ADM também');
  assert.equal(grava(FX('m1'), A.ana, Object.assign({}, antes, { t: 'regra' })), false, 'membro comum não troca');
  assert.equal(grava(FX('m1'), A.pos, Object.assign({}, antes, { t: 'regra', por: 'pos' })), false, 'trocar não muda quem fixou');
  assert.equal(grava(FX('m1'), A.pos, Object.assign({}, antes, { t: 'regra', em: Date.now() })), false, 'trocar não muda quando');
  assert.equal(grava(FX('m1') + '/t', A.pos, 'regra'), true, 'trocar só o campo t');
  assert.equal(grava(FX('m1') + '/t', A.ana, 'regra'), false, 'membro não troca nem só o campo');
  põe('m1', { uid: 'ana', ts: Date.now(), apagada: true });
  assert.equal(grava(FX('m1'), A.pos, Object.assign({}, antes, { t: 'regra' })), false, 'mensagem apagada: só tirar, não trocar');
});

// Revisão cruzada do Codex (26/11/2026): três reforços pequenos.
test('revisão 26/11: a janela de 15 min da edição é fechada pelo relógio do servidor (não só pela hora gravada em editado)', () => {
  reset(); const agora = Date.now(), ts = agora - 900000 - 30000;   // passou 30 s dos 15 min
  põe('w1', { uid: 'ana', ts, texto: 'oi' });
  assert.equal(update(RULES, DB, A.ana, { [M('w1') + '/texto']: 'mudei', [M('w1') + '/editado']: ts + 899000 }), false, 'editado "dentro" dos 15 min, mas o servidor já passou do limite');
  assert.equal(grava(M('w1'), A.ana, { uid: 'ana', ts, apagada: true }), true, 'apagar continua valendo');
  põe('w2', { uid: 'ana', ts: agora - 60000, texto: 'oi' });
  assert.equal(update(RULES, DB, A.ana, { [M('w2') + '/texto']: 'mudei', [M('w2') + '/editado']: agora }), true, '(controle) dentro da janela, edita');
});

test('revisão 26/11: encaminhar copia também largura/altura do GIF e não leva assunto nem card', () => {
  reset(); const ts0 = Date.now() - 864e5;
  DB.kanban.cardume.canais.prf = { nome: 'Performance' }; DB.kanban.cardume.membros.prf = { ana: true, bru: true };
  DB.kanban.cardume.msgs.prf = { o1: { uid: 'bru', ts: ts0, texto: 'segredo' }, o2: { uid: 'bru', ts: ts0, gif: { u: 'https://static.klipy.com/a.gif', w: 10, h: 10, t: 'risada' } } };
  DB.kanban.cardume.assuntos = { dados: { abc: { n: 'Campanha', por: 'ana', ts: ts0 } } };
  const env = (o) => { const t = Date.now(); return { [M('f1')]: Object.assign({ uid: 'ana', ts: t }, o), ['kanban/cardume/ultima/dados']: { ts: t, uid: 'ana', id: 'f1' } }; };
  const enc = o => Object.assign({ c: 'prf', m: 'o1', de: 'bru', ts: ts0, n: 'Performance' }, o || {});
  const gif = o => Object.assign({ u: 'https://static.klipy.com/a.gif', w: 10, h: 10, t: 'risada' }, o || {});
  assert.equal(update(RULES, DB, A.ana, env({ gif: gif(), enc: enc({ m: 'o2' }) })), true, '(controle) GIF igual');
  assert.equal(update(RULES, DB, A.ana, env({ gif: gif({ w: 4096, h: 4096 }), enc: enc({ m: 'o2' }) })), false, 'tamanho do GIF diferente da original');
  assert.equal(update(RULES, DB, A.ana, env({ texto: 'segredo', a: 'abc', enc: enc() })), false, 'encaminhada dentro de um assunto (a tela manda para o geral)');
  assert.equal(update(RULES, DB, A.ana, env({ texto: 'segredo', card: 'c1', cardSq: 'dados', enc: enc() })), false, 'encaminhada com card');
});

test('revisão 26/11: fixar (ou trocar o tipo) na mesma gravação que apaga a mensagem é recusado', () => {
  resetFx(); DB.kanban.cardume.msgs.dados.p1 = { uid: 'pos', ts: Date.now() - 1000, texto: 'minha' };
  const ts = DB.kanban.cardume.msgs.dados.p1.ts;
  assert.equal(update(RULES, DB, A.pos, { [M('p1')]: { uid: 'pos', ts, apagada: true }, [FX('p1')]: fx('pos') }), false, 'apagar e fixar juntos deixaria a fixada apontando para mensagem apagada');
  DB.kanban.cardume.fixadas = { dados: { p1: fx('pos', { em: Date.now() - 5000 }) } }; const antes = DB.kanban.cardume.fixadas.dados.p1;
  assert.equal(update(RULES, DB, A.pos, { [M('p1')]: { uid: 'pos', ts, apagada: true }, [FX('p1') + '/t']: 'regra' }), false, 'apagar e trocar o tipo juntos');
  assert.equal(update(RULES, DB, A.pos, { [M('p1')]: { uid: 'pos', ts, apagada: true }, [FX('p1')]: null }), true, '(controle) apagar e desafixar juntos continua valendo');
  void antes;
});
