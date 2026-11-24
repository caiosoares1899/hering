// functions/rules/__tests__/usuariosFaseARules.test.js
//
// 🔒 Fechar a leitura ampla de kanban/usuarios — fase A (docs/ideias/usuarios-leitura-fechar.md, 24/11/2026).
// (1) O diretório público (kanban/usuarios_publicos) ganha `torre` e `gestorOkr`, validados IGUAIS ao cadastro (estado pós-escrita, como a
//     `diretoria`): o espelho é gravável pela própria pessoa, e o Radar mostra controles pelo gestorOkr dos outros — não pode mentir.
// (2) Notificação de OUTRA pessoa: PO/ADM criam ou apagam, mas não regravam uma que existe (reabria um aviso lido). Com isso o createNotif
//     do Maré pode criar com id fixo sem LER a caixa do destinatário — que deixará de ser legível na fase C.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { check, validate, update } = require('../rulesSim');

const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database.rules.json'), 'utf8'));
const mk = (uid, email) => ({ uid, token: { email, firebase: { sign_in_provider: 'google.com' } } });
const A = { ana: mk('ana', 'ana@ciahering.com.br'), bru: mk('bru', 'bru@ciahering.com.br'), po: mk('po1', 'po1@ciahering.com.br'), adm: mk('adm', 'adm@ciahering.com.br') };
let DB;
const notif = o => Object.assign({ id: 'n1', type: 'mention', title: 'Oi', read: false, ts: '2026-11-24T10:00:00.000Z' }, o || {});
const reset = () => { DB = { kanban: {
  usuarios: {
    ana: { role: 'membro', torre: 'digital', squads: { dados: true }, notificacoes: { n1: notif({ read: true }) } },
    bru: { role: 'membro', squads: { dados: true } }, po1: { role: 'po', squads: { dados: true } }, adm: { role: 'adm' },
  },
  usuarios_publicos: { ana: { nome: 'Ana', torre: 'digital' } },
} }; };
const up = (ator, mapa) => update(RULES, DB, ator, mapa);
const grava = (p, ator, val) => check(RULES, DB, 'write', p, ator, val) && validate(RULES, DB, p, ator, val);
const N = (uid, id) => `kanban/usuarios/${uid}/notificacoes/${id}`;

test('espelho da torre: a própria pessoa grava fonte e espelho juntos; espelho diferente da fonte é recusado', () => {
  reset();
  assert.equal(up(A.ana, { 'kanban/usuarios/ana/torre': 'comercial', 'kanban/usuarios_publicos/ana/torre': 'comercial' }), true, 'muda a torre nos dois, num update só');
  reset();
  assert.equal(up(A.ana, { 'kanban/usuarios_publicos/ana/torre': 'comercial' }), false, 'espelho mentindo (fonte continua digital)');
  assert.equal(up(A.ana, { 'kanban/usuarios_publicos/ana/torre': 'digital' }), true, 'espelho igual à fonte');
  assert.equal(up(A.ana, { 'kanban/usuarios/ana/torre': 'x y', 'kanban/usuarios_publicos/ana/torre': 'x y' }), false, 'torre fora do formato');
  assert.equal(up(A.bru, { 'kanban/usuarios_publicos/ana/torre': 'digital' }), false, 'outra pessoa (sem ser PO/ADM) não grava o espelho alheio');
  assert.equal(up(A.adm, { 'kanban/usuarios/ana/torre': 'marca', 'kanban/usuarios_publicos/ana/torre': 'marca' }), true, 'ADM ajusta a torre de alguém nos dois');
});

test('espelho do Gestor OKR: só verdadeiro quando o cadastro diz; só o ADM liga no cadastro', () => {
  reset();
  assert.equal(up(A.ana, { 'kanban/usuarios_publicos/ana/gestorOkr': true }), false, 'a pessoa se dizendo Gestor OKR no diretório');
  assert.equal(up(A.ana, { 'kanban/usuarios/ana/gestorOkr': true, 'kanban/usuarios_publicos/ana/gestorOkr': true }), false, 'nem ligando no próprio cadastro (só ADM)');
  assert.equal(up(A.adm, { 'kanban/usuarios/ana/gestorOkr': true, 'kanban/usuarios_publicos/ana/gestorOkr': true }), true, 'ADM liga nos dois');
  assert.equal(up(A.adm, { 'kanban/usuarios_publicos/ana/gestorOkr': 'sim' }), false, 'só o valor true');
  DB.kanban.usuarios.ana.gestorOkr = true; DB.kanban.usuarios_publicos.ana.gestorOkr = true;
  assert.equal(up(A.adm, { 'kanban/usuarios/ana/gestorOkr': null, 'kanban/usuarios_publicos/ana/gestorOkr': null }), true, 'ADM desliga nos dois');
});

test('notificação de outra pessoa: cria, apaga, mas não regrava (nem PO/ADM)', () => {
  reset();
  assert.equal(grava(N('ana', 'n1'), A.po, notif({ read: false })), false, 'PO regravando uma lida (reabriria)');
  assert.equal(grava(N('ana', 'n1'), A.adm, notif({ read: false })), false, 'ADM também não');
  assert.equal(up(A.po, { [N('ana', 'n1') + '/read']: false }), false, 'nem só o campo read (o .validate da notificação vale também para escrita no filho)');
  assert.equal(up(A.ana, { [N('ana', 'n1') + '/read']: false }), true, 'a dona pode marcar como não lida');
  assert.equal(grava(N('ana', 'n1'), A.bru, notif({ read: false })), false, 'membro comum também não (já era assim)');
  assert.equal(grava(N('ana', 'n2'), A.po, notif({ id: 'n2' })), true, 'PO cria nova');
  assert.equal(grava(N('ana', 'n2'), A.po, notif({ id: 'n2', type: 'painel_broadcast' })), true, 'PO cria comunicado (painel_broadcast)');
  assert.equal(grava(N('ana', 'n2'), A.bru, notif({ id: 'n2', type: 'painel_broadcast' })), false, 'membro comum não cria comunicado');
  assert.equal(grava(N('ana', 'n2'), A.bru, notif({ id: 'n2' })), true, 'membro comum cria nova');
  assert.equal(grava(N('ana', 'n1'), A.adm, null), true, 'ADM apaga');
  assert.equal(grava(N('ana', 'n1'), A.ana, notif({ read: false })), true, 'a dona mexe na própria');
  assert.equal(grava(N('ana', 'n1') + '/read', A.ana, true), true, 'a dona marca como lida');
});
