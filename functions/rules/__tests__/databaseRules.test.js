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
const { check, validate } = require('../rulesSim');

const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database.rules.json'), 'utf8'));
const mk = (uid, email, prov) => ({ uid, token: { email, firebase: { sign_in_provider: prov } } });
const ATOR = {
  forasteiro: mk('out1', 'qualquer@gmail.com', 'google.com'),
  membro: mk('int1', 'a@ciahering.com.br', 'google.com'),
  po: mk('po1', 'p@ciahering.com.br', 'google.com'),
  organizador: mk('org1', 'o@ciahering.com.br', 'google.com'),
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
    int1: { role: 'membro', squads: { dados: true } }, org1: { role: 'membro', squads: { dados: true }, squads_roles: { dados: 'organizador' } }, po1: { role: 'po' }, adm1: { role: 'adm' }, az1: { role: 'membro' },
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
  ['interruptores de notificação (notif_config): a empresa e o visualizador leem', 'read', 'kanban/notif_config', undefined, { visualizador: 1, membro: 1, po: 1, forasteiro: 0, freela_cadastrado: 0, arezzo_provedor_errado: 0 }],
  ['interruptores de notificação: só PO/ADM (e o Caio) escrevem — membro, externo e visualizador não', 'write', 'kanban/notif_config/mention', { sino: false, push: false, por: 'x', em: '2026-10-10T10:00:00Z' },
    { membro: 0, freela_cadastrado: 0, forasteiro: 0, visualizador: 0, arezzo_provedor_errado: 0, po: 1, adm: 1, caio: 1 }],
  ['"lido" do feed (notif_feed_seen): a empresa escreve, o externo não (ele guarda no navegador)', 'write', 'kanban/notif_feed_seen/u1', { ts: 'x' }, { visualizador: 0, forasteiro: 0, membro: 1 }],
  ['presença do OKR (okr_presence): o visualizador externo escreve SÓ a própria (uid dele); a empresa escreve; forasteiro/freela não', 'write', 'kanban/painel/okr_presence/v1', { ts: 1, nome: 'Ext' },
    { visualizador: 1, membro: 1, forasteiro: 0, freela_cadastrado: 0, freela_novo: 0 }],
  ['presença do OKR: o visualizador NÃO escreve a presença de OUTRA pessoa', 'write', 'kanban/painel/okr_presence/int1', { ts: 1, nome: 'Fake' }, { visualizador: 0, forasteiro: 0, membro: 1 }],
  ['presença do OKR: abrir a escrita pro visualizador não vaza pro resto de kanban/painel', 'write', 'kanban/painel/comunicados_x', { a: 1 }, { visualizador: 0, forasteiro: 0, membro: 1 }],
  ['trava de edição do Objetivo (okr/obj_locks): a empresa escreve (segura/solta); o visualizador externo só lê', 'write', 'kanban/okr/obj_locks/o1', { uid: 'int1', who: 'A', ts: 1 }, { membro: 1, visualizador: 0, forasteiro: 0, freela_cadastrado: 0 }],
  ['acesso do visualizador (painel_viewers/{email}/acesso): ele escreve SÓ o próprio registro; membro da empresa não (só o ADM mexe na lista); forasteiro/freela não', 'write', 'kanban/painel_viewers/viewer@gmail,com/acesso', { ultimo: 1, uid: 'v1', pagina: 'okr' },
    { visualizador: 1, membro: 0, adm: 1, forasteiro: 0, freela_cadastrado: 0, freela_novo: 0 }],
  ['acesso do visualizador: NÃO escreve o registro de OUTRO visualizador (nem cria entrada na lista)', 'write', 'kanban/painel_viewers/outro@gmail,com/acesso', { ultimo: 1, uid: 'v1' }, { visualizador: 0, forasteiro: 0, membro: 0, adm: 1 }],
  ['acesso do visualizador: NÃO consegue se autorizar (escrever a própria entrada na lista)', 'write', 'kanban/painel_viewers/forasteiro@gmail,com', { email: 'forasteiro@gmail.com' }, { visualizador: 0, forasteiro: 0, membro: 0, po: 0, adm: 1, caio: 1 }],
  ['autorizar um visualizador externo (acesso de leitura ao Painel/Radar a alguém de fora): só ADM/Caio — antes qualquer funcionário podia convidar um e-mail de fora', 'write', 'kanban/painel_viewers/novo@gmail,com', { email: 'novo@gmail.com', nome: 'Novo' },
    { forasteiro: 0, freela_cadastrado: 0, visualizador: 0, membro: 0, po: 0, adm: 1, caio: 1 }],
  ['remover um visualizador externo também é só ADM/Caio', 'write', 'kanban/painel_viewers/viewer@gmail,com', null,
    { forasteiro: 0, visualizador: 0, membro: 0, po: 0, adm: 1, caio: 1 }],
  ['calendário do OKR (okr/calendario/eventos): a empresa escreve (ADM/organizador — a regra fina é da tela); o visualizador externo e o forasteiro NÃO', 'write', 'kanban/okr/calendario/eventos/e1', { id: 'e1', titulo: 'x', data: '2026-10-08' }, { membro: 1, visualizador: 0, forasteiro: 0, freela_cadastrado: 0 }],
  ['calendário do OKR — anotações pós-reunião e vínculo com a apresentação (okr/calendario/notas|vinculos): a empresa escreve; o visualizador externo NÃO', 'write', 'kanban/okr/calendario/notas/e1/2026-10-08/n1', { texto: 'ata', autorUid: 'u1', ts: 'x' }, { membro: 1, visualizador: 0, forasteiro: 0, freela_cadastrado: 0 }],
  ['calendário do OKR: o visualizador externo lê (só acompanha); o forasteiro não', 'read', 'kanban/okr/calendario/eventos', undefined, { visualizador: 1, membro: 1, forasteiro: 0 }],
  ['trava de edição do Objetivo: o visualizador externo lê (vê o selo 🔒)', 'read', 'kanban/okr/obj_locks', undefined, { visualizador: 1, membro: 1, forasteiro: 0 }],
  ['visualizador externo lê o diretório magro (usuarios_publicos) — é de onde vêm nome/foto no OKR', 'read', 'kanban/usuarios_publicos', undefined, { visualizador: 1, forasteiro: 1, membro: 1 }],
  ['ler usuarios_publicos (diretório magro — segue aberto, é o que o login dos freelas usa)', 'read', 'kanban/usuarios_publicos', undefined,
    { forasteiro: 1, freela_novo: 1, membro: 1 }],
  // Auditoria de segurança de 18/10/2026: `kanban/config` era gravável por qualquer @ciahering, e a lista `adm_emails` decide quem é ADM no backup completo
  // (restaurar dados) e no Agente do Radar — qualquer funcionário podia se incluir nela. Agora só ADM (e o Caio) gravam a lista; o resto de `config` segue aberto.
  ['gravar a lista de ADMs (config/adm_emails): só ADM e o Caio — membro, PO, externo e visualizador não', 'write', 'kanban/config/adm_emails', ['alguem@ciahering.com.br'],
    { forasteiro: 0, freela_cadastrado: 0, freela_novo: 0, visualizador: 0, arezzo_provedor_errado: 0, arezzo: 0, membro: 0, po: 0, adm: 1, caio: 1 }],
  ['gravar UM item da lista de ADMs também é só ADM/Caio (não dá para contornar escrevendo o índice)', 'write', 'kanban/config/adm_emails/3', 'alguem@ciahering.com.br',
    { forasteiro: 0, freela_cadastrado: 0, visualizador: 0, membro: 0, po: 0, adm: 1, caio: 1 }],
  ['os outros ajustes de config seguem abertos à empresa (links da Hering) — e fechados a externo/visualizador', 'write', 'kanban/config/links_hering/l1', { id: 'l1', titulo: 'x', url: 'https://example.com' },
    { forasteiro: 0, freela_cadastrado: 0, freela_novo: 0, visualizador: 0, membro: 1, po: 1, adm: 1, caio: 1, arezzo: 1 }],
  ['fila de aprovação do Google Agenda (config/gcal_queue) continua aberta a qualquer da empresa', 'write', 'kanban/config/gcal_queue/q1', { id: 'q1' },
    { forasteiro: 0, freela_cadastrado: 0, visualizador: 0, membro: 1, po: 1, adm: 1, caio: 1, arezzo: 1 }],
  ['config segue legível para a empresa e o visualizador (a lista de ADMs é lida por todas as páginas)', 'read', 'kanban/config/adm_emails', undefined,
    { forasteiro: 0, freela_cadastrado: 0, visualizador: 1, membro: 1, po: 1, adm: 1, caio: 1, arezzo: 1 }],
  // Idem (achado 7): a lista `externos` do squad dá a um e-mail de fora o direito de entrar no squad e GRAVAR nele. A regra tinha `DOM || role po/adm`, ou seja, qualquer
  // funcionário podia autorizar um externo. Agora só ADM/Caio, PO (global) e PO/Organizador daquele squad (é o que a tela de ⚙ Config → Equipe já exige).
  ['autorizar um EXTERNO no squad (squads/dados/externos): só ADM/Caio/PO — membro comum não; externo e visualizador não', 'write', 'kanban/squads/dados/externos/novo@gmail,com', { email: 'novo@gmail.com', nome: 'N' },
    { forasteiro: 0, freela_cadastrado: 0, freela_novo: 0, visualizador: 0, membro: 0, po: 1, organizador: 1, adm: 1, caio: 1 }],
  ['remover um externo do squad: idem (e o PO/Organizador do próprio squad pelo squads_roles)', 'write', 'kanban/squads/dados/externos/freela@gmail,com', null,
    { forasteiro: 0, freela_cadastrado: 0, visualizador: 0, membro: 0, po: 1, adm: 1, caio: 1 }],
];

// Duas edições das regras, mesma matriz (ver docs/arezzo/MARE_SO_HERING.md):
//  • database.rules.json (MODO ATUAL, "só Hering", 2026-10-08): só @ciahering.com.br via Google — a conta Arezzo/Microsoft NUNCA passa (arezzo: 0 em tudo);
//  • docs/arezzo/database.rules.com-arezzo.json (ARQUIVADA, pra religar a integração): a matriz como foi escrita (arezzo: 1 onde a empresa passa).
const RULES_COM_AREZZO = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'docs', 'arezzo', 'database.rules.com-arezzo.json'), 'utf8'));
for (const [modo, regras] of [['só Hering', RULES], ['arquivada com Arezzo', RULES_COM_AREZZO]]) {
  for (const [desc, op, p, nv, esperado] of CASOS) {
    test(`[${modo}] ${desc}`, () => {
      for (const [nome, ok] of Object.entries(esperado)) {
        const permitido = (modo === 'só Hering' && nome === 'arezzo') ? false : !!ok;
        assert.equal(check(regras, DB, op, p, ATOR[nome], nv), permitido, `${nome} em ${op} ${p}: esperado ${permitido ? 'permitido' : 'negado'}`);
      }
    });
  }
}

// Casos cujo veredito depende também do `.validate` (papel gravado nas fichas de usuário): check (.write) E validate (.validate) têm de passar.
const CASOS_VALIDADOS = [
  // Achado 8: `usuarios/{uid}/squads_roles` era gravável pela própria pessoa e as funções (backup completo, lembretes, agente) tratam como PAPEL — dava para virar "PO" do squad
  // sozinho. Agora segue a mesma regra do `role`: só PO/ADM/Caio promovem; a pessoa só grava 'membro'/'convidado' no 1º registro (e sobe de convidado para membro).
  ['virar PO de um squad sozinho (escrever o próprio squads_roles = po) — era possível', 'write', 'kanban/usuarios/int1/squads_roles/dados', 'po',
    { membro: 0, forasteiro: 0, freela_cadastrado: 0, po: 1, adm: 1, caio: 1 }],   // (a própria pessoa — `membro` aqui é o dono do registro int1 — NÃO consegue; PO/ADM/Caio sim)
  ['organizador não se promove a PO escrevendo o próprio squads_roles', 'write', 'kanban/usuarios/org1/squads_roles/dados', 'po',
    { organizador: 0, adm: 1, caio: 1 }],
  ['PO/ADM promovem alguém a organizador do squad (fluxo da tela de Equipe)', 'write', 'kanban/usuarios/int1/squads_roles/dados', 'organizador',
    { membro: 0, po: 1, adm: 1, caio: 1 }],
  ['1º registro: a própria pessoa grava squads_roles = membro/convidado (onboarding continua igual)', 'write', 'kanban/usuarios/ext2/squads_roles/dados', 'convidado',
    { freela_novo: 1, forasteiro: 0 }],
  ['remover o próprio squads_roles (sair do squad) continua permitido', 'write', 'kanban/usuarios/int1/squads_roles/dados', null,
    { membro: 1 }],
];
for (const [modo, regras] of [['só Hering', RULES], ['arquivada com Arezzo', RULES_COM_AREZZO]]) {
  for (const [desc, op, p, nv, esperado] of CASOS_VALIDADOS) {
    test(`[${modo}] ${desc}`, () => {
      for (const [nome, ok] of Object.entries(esperado)) {
        const permitido = (modo === 'só Hering' && nome === 'arezzo') ? false : !!ok;
        const real = check(regras, DB, op, p, ATOR[nome], nv) && (op === 'read' || validate(regras, DB, p, ATOR[nome], nv));
        assert.equal(real, permitido, `${nome} em ${op} ${p}: esperado ${permitido ? 'permitido' : 'negado'}`);
      }
    });
  }
}

test('modo só Hering: o arquivo de regras ativo não menciona Arezzo/Microsoft em lugar nenhum', () => {
  const txt = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database.rules.json'), 'utf8').toLowerCase();
  assert.equal(/arezzo|microsoft/.test(txt), false);
});

test('modo só Hering: conta Arezzo (Microsoft) não lê usuarios, não escreve notificação nem feedback; Hering+Google segue passando', () => {
  const az = ATOR.arezzo;
  assert.equal(check(RULES, DB, 'read', 'kanban/usuarios', az), false);
  assert.equal(check(RULES, DB, 'write', 'kanban/feedback/f1', az, { texto: 'x' }), false);
  assert.equal(check(RULES, DB, 'read', 'kanban/usuarios', ATOR.membro), true);
});

test('1º login do freela: depois de gravar o próprio registro com squad, já consegue escrever feedback/access_log', () => {
  const dbDepois = JSON.parse(JSON.stringify(DB));
  dbDepois.kanban.usuarios.ext2 = { role: 'convidado', squads: { dados: true } };
  assert.equal(check(RULES, dbDepois, 'write', 'kanban/feedback/f1', ATOR.freela_novo, { texto: 'ok' }), true);
  assert.equal(check(RULES, dbDepois, 'write', 'kanban/squads/dados/access_log/l1', ATOR.freela_novo, { ts: 1 }), true);
});
