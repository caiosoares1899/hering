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
