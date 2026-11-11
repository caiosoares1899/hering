// functions/rules/__tests__/papelRules.test.js
//
// 🛡️ Papéis (11/11/2026 — achados C1/C2 da /auditoriaseguranca do Antigravity, PR #1701):
//  C1: um PO gravava `role: 'adm'` em qualquer cadastro (inclusive o dele) e rebaixava ADM — e `role === 'adm'` destrava
//      config/adm_emails, painel_viewers, agente_agil_orquestrador etc. Agora o papel GLOBAL só muda por ADM/Caio (fora os caminhos
//      de cadastro: nascer membro/convidado e convidado → membro pela própria pessoa). No papel POR SQUAD (squads_roles), o PO segue
//      atribuindo membro/convidado/organizador/po, mas não 'adm' e não mexe em quem é 'adm'.
//  C2: qualquer pessoa gravava `gestorOkr: true` no próprio cadastro (destrava okr/datastudio). Agora só ADM/Caio mudam.
// Cuidado do Caio: NÃO travar os externos (freelancers) — o 1º login deles cria o cadastro com role 'convidado' e o squad.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { check, validate } = require('../rulesSim');

const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database.rules.json'), 'utf8'));
const mk = (uid, email) => ({ uid, token: { email, firebase: { sign_in_provider: 'google.com' } } });
const A = { po: mk('po1', 'p@ciahering.com.br'), adm: mk('adm1', 'adm@ciahering.com.br'), caio: mk('caio', 'caio.soares@ciahering.com.br'),
  ana: mk('ana', 'ana@ciahering.com.br'), conv: mk('conv1', 'c@ciahering.com.br'), novo: mk('novo1', 'n@ciahering.com.br'),
  freela: mk('ext1', 'freela@gmail.com') };
let DB;
const reset = () => { DB = { kanban: { usuarios: {
  po1: { role: 'po' }, adm1: { role: 'adm' }, caio: { role: 'adm' }, ana: { role: 'membro', squads: { dados: true }, squads_roles: { dados: 'membro', site: 'adm' } },
  conv1: { role: 'convidado' },
}, squads: { dados: { externos: { 'freela@gmail,com': true } } } } }; };
const grava = (p, ator, val) => check(RULES, DB, 'write', p, ator, val) && validate(RULES, DB, p, ator, val);
const U = (uid, campo) => `kanban/usuarios/${uid}` + (campo ? '/' + campo : '');

test('C1: PO NÃO se promove nem promove ninguém a ADM, e não rebaixa ADM', () => {
  reset();
  assert.equal(grava(U('po1', 'role'), A.po, 'adm'), false, 'PO → adm no próprio cadastro');
  assert.equal(grava(U('ana', 'role'), A.po, 'adm'), false, 'PO promove a Ana a adm');
  assert.equal(grava(U('adm1', 'role'), A.po, 'membro'), false, 'PO rebaixa o ADM');
  assert.equal(grava(U('ana', 'role'), A.po, 'po'), false, 'PO mexe no papel GLOBAL de outra pessoa');
  assert.equal(grava(U('ana'), A.po, { role: 'adm', squads: { dados: true } }), false, 'PO regrava o cadastro inteiro com role adm');
});

test('C1: ADM e Caio mudam o papel global (addAdmEmail / removeAdmEmail)', () => {
  reset();
  assert.equal(grava(U('ana', 'role'), A.adm, 'adm'), true, 'ADM promove');
  assert.equal(grava(U('ana', 'role'), A.caio, 'adm'), true, 'Caio promove');
  assert.equal(grava(U('adm1', 'role'), A.adm, 'membro'), true, 'ADM rebaixa ADM');
});

test('cadastro continua: nasce membro/convidado; convidado vira membro sozinho; ninguém se promove além disso', () => {
  reset();
  assert.equal(grava(U('novo1'), A.novo, { role: 'membro', nome: 'Novo', email: 'n@ciahering.com.br' }), true, '1º login nasce membro');
  assert.equal(grava(U('conv1', 'role'), A.conv, 'membro'), true, 'convidado → membro pela própria pessoa');
  assert.equal(grava(U('ana', 'role'), A.ana, 'po'), false, 'membro se faz PO');
  assert.equal(grava(U('ana', 'role'), A.ana, 'adm'), false, 'membro se faz ADM');
  assert.equal(grava(U('ana'), A.ana, { role: 'membro', squads: { dados: true }, nome: 'Ana 2' }), true, 'regrava o próprio cadastro sem mudar o papel');
  assert.equal(grava(U('ana'), A.po, { role: 'membro', squads: { dados: true } }), true, 'PO regrava cadastro de outra pessoa mantendo o papel (Painel → adicionar ao squad)');
});

test('papel POR SQUAD: PO atribui membro/convidado/organizador/po, mas não adm e não mexe em quem é adm', () => {
  reset();
  ['membro', 'convidado', 'organizador', 'po'].forEach(r => assert.equal(grava(U('ana', 'squads_roles/dados'), A.po, r), true, 'PO → ' + r));
  assert.equal(grava(U('ana', 'squads_roles/dados'), A.po, 'adm'), false, 'PO → adm no squad');
  assert.equal(grava(U('ana', 'squads_roles/site'), A.po, 'membro'), false, 'PO rebaixa adm do squad');
  assert.equal(grava(U('ana', 'squads_roles/dados'), A.po, null), true, 'PO tira a pessoa do squad');
  assert.equal(grava(U('ana', 'squads_roles/dados'), A.adm, 'adm'), true, 'ADM → adm no squad');
  assert.equal(grava(U('ana', 'squads_roles/dados'), A.ana, 'po'), false, 'membro se faz PO no squad');
});

test('C2: gestorOkr só por ADM/Caio (toggleGestorOkr); ninguém se dá sozinho', () => {
  reset();
  assert.equal(grava(U('ana', 'gestorOkr'), A.ana, true), false, 'a própria pessoa');
  assert.equal(grava(U('ana'), A.ana, { role: 'membro', squads: { dados: true }, gestorOkr: true }), false, 'a própria pessoa regravando o cadastro inteiro');
  assert.equal(grava(U('ana', 'gestorOkr'), A.po, true), false, 'PO');
  assert.equal(grava(U('ana', 'gestorOkr'), A.adm, true), true, 'ADM');
  assert.equal(grava(U('ana', 'gestorOkr'), A.adm, null), true, 'ADM tira (null)');
});

test('freelancer: 1º login cria o próprio cadastro como convidado no squad em que é externo', () => {
  reset();
  assert.equal(grava(U('ext1'), A.freela, { role: 'convidado', nome: 'Freela', email: 'freela@gmail.com', squads: { dados: true } }), true, 'cadastro do freelancer');
  assert.equal(grava(U('ext1', 'role'), A.freela, 'adm'), false, 'freelancer se faz ADM');
  assert.equal(grava(U('ext1', 'gestorOkr'), A.freela, true), false, 'freelancer se faz gestor OKR');
});
