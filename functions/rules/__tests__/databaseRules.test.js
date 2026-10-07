// functions/rules/__tests__/databaseRules.test.js
//
// Matriz ator × operação do database.rules.json, avaliada pelo simulador (rulesSim.js), que roda
// as expressões REAIS do arquivo com a cascata de .read/.write do Firebase. Criada na rodada
// /monitorarbugs "áreas sensíveis" de 2026-10-05, ao fechar: leitura do nó `usuarios` (e-mails,
// notificações e tokens de push de todo mundo) e criação de notificação na caixa de qualquer pessoa
// por QUALQUER conta autenticada (inclusive de fora da empresa), `feedback` e `access_log` abertos.
// Mudou as regras? Rode `npm test` — se um cenário aqui quebrar, foi de propósito ou foi regressão.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { check } = require('../rulesSim');

const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database.rules.json'), 'utf8'));
const mk = (uid, email, prov) => ({ uid, token: { email, firebase: { sign_in_provider: prov } } });
const ATOR = {
  forasteiro: mk('out1', 'qualquer@gmail.com', 'google.com'),
  membro: mk('int1', 'a@ciahering.com.br', 'google.com'),
  po: mk('po1', 'p@ciahering.com.br', 'google.com'),
  adm: mk('adm1', 'adm@ciahering.com.br', 'google.com'),
  caio: mk('caio', 'caio.soares@ciahering.com.br', 'google.com'),
  arezzo: mk('az1', 'b@arezzo.com.br', 'microsoft.com'),
  arezzo_provedor_errado: mk('az2', 'c@arezzo.com.br', 'google.com'),
  freela_cadastrado: mk('ext1', 'freela@gmail.com', 'google.com'),
  freela_novo: mk('ext2', 'novo@gmail.com', 'google.com'),
  visualizador: mk('v1', 'viewer@gmail.com', 'google.com'),
};
const DB = { kanban: {
  usuarios: {
    int1: { role: 'membro', squads: { dados: true } }, po1: { role: 'po' }, adm1: { role: 'adm' }, az1: { role: 'membro' },
    ext1: { role: 'convidado', squads: { dados: true } },
    victim: { role: 'membro', fcm_tokens: { t1: { token: 'tok' } }, notificacoes: { n0: { type: 'mention', title: 'segredo' } } },
  },
  painel_viewers: { 'viewer@gmail,com': true },
  squads: { dados: { externos: { 'freela@gmail,com': true } } },
} };
const notif = (type) => Object.assign({ id: 'n1', title: 'Oi', sub: 'x', ts: '2026-10-05T10:00:00Z', read: false }, type === undefined ? {} : { type });

// [descrição, op, caminho, valor novo, { ator: permitido? }]
const CASOS = [
  ['ler kanban/usuarios inteiro (e-mails, tokens, notificações de todos)', 'read', 'kanban/usuarios', undefined,
    { forasteiro: 0, arezzo_provedor_errado: 0, freela_cadastrado: 0, freela_novo: 0, membro: 1, po: 1, adm: 1, caio: 1, arezzo: 1, visualizador: 0 }],
  ['ler o próprio registro em usuarios', 'read', 'kanban/usuarios/ext1', undefined, { freela_cadastrado: 1 }],
  ['ler o próprio registro no 1º login (ainda não existe)', 'read', 'kanban/usuarios/ext2', undefined, { freela_novo: 1 }],
  ['ler o registro de OUTRA pessoa', 'read', 'kanban/usuarios/victim', undefined, { forasteiro: 0, freela_cadastrado: 0, membro: 1, visualizador: 0 }],
  ['ler as notificações de OUTRA pessoa', 'read', 'kanban/usuarios/victim/notificacoes', undefined, { forasteiro: 0, freela_cadastrado: 0, membro: 1 }],
  ['ler os tokens de push de OUTRA pessoa', 'read', 'kanban/usuarios/victim/fcm_tokens', undefined, { forasteiro: 0, freela_cadastrado: 0 }],
  ['criar notificação (@menção) na caixa de outra pessoa', 'write', 'kanban/usuarios/victim/notificacoes/n1', notif('mention'),
    { forasteiro: 0, freela_novo: 0, visualizador: 0, arezzo_provedor_errado: 0, membro: 1, freela_cadastrado: 1, arezzo: 1, po: 1, adm: 1, caio: 1 }],
  ['criar notificação "painel_broadcast" (aviso geral — só PO/ADM)', 'write', 'kanban/usuarios/victim/notificacoes/n1', notif('painel_broadcast'),
    { forasteiro: 0, freela_cadastrado: 0, membro: 0, arezzo: 0, po: 1, adm: 1, caio: 1 }],
  ['criar notificação SEM type (contornaria o filtro de tipos do push)', 'write', 'kanban/usuarios/victim/notificacoes/n1', notif(undefined),
    { forasteiro: 0, freela_cadastrado: 0, membro: 0, po: 1, adm: 1 }],
  ['sobrescrever notificação já existente de outra pessoa', 'write', 'kanban/usuarios/victim/notificacoes/n0', notif('mention'),
    { forasteiro: 0, freela_cadastrado: 0, membro: 0, po: 1, adm: 1 }],
  ['marcar como lida a própria notificação', 'write', 'kanban/usuarios/int1/notificacoes/n9/read', true, { membro: 1 }],
  ['apagar a própria notificação', 'write', 'kanban/usuarios/ext1/notificacoes/n9', null, { freela_cadastrado: 1 }],
  ['escrever feedback do Mural', 'write', 'kanban/feedback/f1', { texto: 'ok' },
    { forasteiro: 0, visualizador: 0, freela_novo: 0, membro: 1, freela_cadastrado: 1, arezzo: 1 }],
  ['escrever access_log do squad em que está', 'write', 'kanban/squads/dados/access_log/l1', { ts: 1 },
    { forasteiro: 0, visualizador: 0, freela_novo: 0, membro: 1, arezzo: 1, freela_cadastrado: 1 }],
  ['escrever access_log de squad em que o freela NÃO está', 'write', 'kanban/squads/prf/access_log/l1', { ts: 1 }, { freela_cadastrado: 0, membro: 1 }],
  ['freela cria o próprio registro (cadastro)', 'write', 'kanban/usuarios/ext2', { role: 'membro', nome: 'Novo' }, { freela_novo: 1 }],
  ['visualizador externo (painel_viewers) NÃO lê o registro de ninguém em usuarios (e-mail/notificações/tokens)', 'read', 'kanban/usuarios/victim/fcm_tokens', undefined, { visualizador: 0, membro: 1 }],
  ['visualizador externo segue lendo o OKR (só acompanhar)', 'read', 'kanban/okr/objetivos', undefined, { visualizador: 1, membro: 1, forasteiro: 0, freela_cadastrado: 0 }],
  ['visualizador externo NÃO escreve no OKR', 'write', 'kanban/okr/objetivos/o1', { titulo: 'x' }, { visualizador: 0, forasteiro: 0, freela_cadastrado: 0, membro: 1 }],
  ['feed do sino único (notif_feed): empresa e visualizador leem; só a empresa escreve', 'read', 'kanban/notif_feed', undefined, { visualizador: 1, membro: 1, forasteiro: 0, freela_cadastrado: 0 }],
  ['feed do sino único: externo/freela NÃO escrevem evento', 'write', 'kanban/notif_feed/f1', { tipo: 'mural', titulo: 'x' }, { visualizador: 0, forasteiro: 0, freela_cadastrado: 0, membro: 1 }],
  ['"lido" do feed (notif_feed_seen): a empresa escreve, o externo não (ele guarda no navegador)', 'write', 'kanban/notif_feed_seen/u1', { ts: 'x' }, { visualizador: 0, forasteiro: 0, membro: 1 }],
  ['presença do OKR (okr_presence): o visualizador externo escreve SÓ a própria (uid dele); a empresa escreve; forasteiro/freela não', 'write', 'kanban/painel/okr_presence/v1', { ts: 1, nome: 'Ext' },
    { visualizador: 1, membro: 1, forasteiro: 0, freela_cadastrado: 0, freela_novo: 0 }],
  ['presença do OKR: o visualizador NÃO escreve a presença de OUTRA pessoa', 'write', 'kanban/painel/okr_presence/int1', { ts: 1, nome: 'Fake' }, { visualizador: 0, forasteiro: 0, membro: 1 }],
  ['presença do OKR: abrir a escrita pro visualizador não vaza pro resto de kanban/painel', 'write', 'kanban/painel/comunicados_x', { a: 1 }, { visualizador: 0, forasteiro: 0, membro: 1 }],
  ['trava de edição do Objetivo (okr/obj_locks): a empresa escreve (segura/solta); o visualizador externo só lê', 'write', 'kanban/okr/obj_locks/o1', { uid: 'int1', who: 'A', ts: 1 }, { membro: 1, visualizador: 0, forasteiro: 0, freela_cadastrado: 0 }],
  ['acesso do visualizador (painel_viewers/{email}/acesso): ele escreve SÓ o próprio registro; a empresa também; forasteiro/freela não', 'write', 'kanban/painel_viewers/viewer@gmail,com/acesso', { ultimo: 1, uid: 'v1', pagina: 'okr' },
    { visualizador: 1, membro: 1, forasteiro: 0, freela_cadastrado: 0, freela_novo: 0 }],
  ['acesso do visualizador: NÃO escreve o registro de OUTRO visualizador (nem cria entrada na lista)', 'write', 'kanban/painel_viewers/outro@gmail,com/acesso', { ultimo: 1, uid: 'v1' }, { visualizador: 0, forasteiro: 0, membro: 1 }],
  ['acesso do visualizador: NÃO consegue se autorizar (escrever a própria entrada na lista)', 'write', 'kanban/painel_viewers/forasteiro@gmail,com', { email: 'forasteiro@gmail.com' }, { visualizador: 0, forasteiro: 0, membro: 1 }],
  ['trava de edição do Objetivo: o visualizador externo lê (vê o selo 🔒)', 'read', 'kanban/okr/obj_locks', undefined, { visualizador: 1, membro: 1, forasteiro: 0 }],
  ['visualizador externo lê o diretório magro (usuarios_publicos) — é de onde vêm nome/foto no OKR', 'read', 'kanban/usuarios_publicos', undefined, { visualizador: 1, forasteiro: 1, membro: 1 }],
  ['ler usuarios_publicos (diretório magro — segue aberto, é o que o login dos freelas usa)', 'read', 'kanban/usuarios_publicos', undefined,
    { forasteiro: 1, freela_novo: 1, membro: 1 }],
];

for (const [desc, op, p, nv, esperado] of CASOS) {
  test(desc, () => {
    for (const [nome, ok] of Object.entries(esperado)) {
      assert.equal(check(RULES, DB, op, p, ATOR[nome], nv), !!ok, `${nome} em ${op} ${p}: esperado ${ok ? 'permitido' : 'negado'}`);
    }
  });
}

test('1º login do freela: depois de gravar o próprio registro com squad, já consegue escrever feedback/access_log', () => {
  const dbDepois = JSON.parse(JSON.stringify(DB));
  dbDepois.kanban.usuarios.ext2 = { role: 'convidado', squads: { dados: true } };
  assert.equal(check(RULES, dbDepois, 'write', 'kanban/feedback/f1', ATOR.freela_novo, { texto: 'ok' }), true);
  assert.equal(check(RULES, dbDepois, 'write', 'kanban/squads/dados/access_log/l1', ATOR.freela_novo, { ts: 1 }), true);
});
