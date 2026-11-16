// functions/rules/__tests__/diretoriaRules.test.js
//
// 🏢 Diretoria por pessoa (16/11/2026, docs/ideias/diretoria-por-pessoa.md — decisões do Caio: a própria pessoa escolhe no
// 1º acesso; o ADM edita pelo Painel; aparece como etiqueta na 👥 Equipe do Maré).
//  - kanban/usuarios/{uid}/diretoria ∈ digital|rh|marca|tecnologia. A pessoa grava a SUA só enquanto está vazia; depois só ADM/Caio
//    (mesmo predicado do gestorOkr: role 'adm' no banco ou o e-mail do Caio — a lista de e-mails do Painel não conta aqui).
//  - kanban/usuarios_publicos/{uid}/diretoria (espelho que a 👥 Equipe lê) só aceita o MESMO valor da fonte.
//  - Resíduo ACEITO e documentado: o .write de usuarios/$uid deixa o titular (e o PO) APAGAR o campo — .validate não roda na
//    exclusão. O efeito é voltar a "Não informada" (e a pessoa escolhe de novo); a diretoria não dá acesso a nada nesta etapa.
//    Se um dia der, endurecer o pai. O teste abaixo deixa o resíduo explícito.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { check, validate } = require('../rulesSim');

const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database.rules.json'), 'utf8'));
const mk = (uid, email) => ({ uid, token: { email, firebase: { sign_in_provider: 'google.com' } } });
const A = { ana: mk('ana', 'ana@ciahering.com.br'), bia: mk('bia', 'bia@ciahering.com.br'), po: mk('po1', 'p@ciahering.com.br'),
  adm: mk('adm1', 'adm@ciahering.com.br'), caio: mk('caio', 'caio.soares@ciahering.com.br'), lista: mk('lst', 'lista@ciahering.com.br') };
let DB;
const reset = () => { DB = { kanban: {
  usuarios: { ana: { role: 'membro' }, bia: { role: 'membro', diretoria: 'rh' }, po1: { role: 'po' }, adm1: { role: 'adm' }, caio: { role: 'membro' }, lst: { role: 'membro' } },
  usuarios_publicos: { ana: { nome: 'Ana' }, bia: { nome: 'Bia', diretoria: 'rh' } } } }; };
const grava = (p, ator, val) => check(RULES, DB, 'write', p, ator, val) && validate(RULES, DB, p, ator, val);
const aplica = (p, val) => { const ks = p.split('/'); let o = DB; ks.slice(0, -1).forEach(k => { o[k] = o[k] || {}; o = o[k]; }); if (val === null) delete o[ks.at(-1)]; else o[ks.at(-1)] = val; };
const U = (uid, campo) => `kanban/usuarios/${uid}` + (campo ? '/' + campo : '');
const P = (uid, campo) => `kanban/usuarios_publicos/${uid}` + (campo ? '/' + campo : '');

test('1º acesso: a própria pessoa escolhe a SUA diretoria enquanto está vazia (as 4 opções)', () => {
  for (const d of ['digital', 'rh', 'marca', 'tecnologia']) { reset(); assert.equal(grava(U('ana', 'diretoria'), A.ana, d), true, d); }
});

test('depois de escolhida, a pessoa NÃO troca sozinha; regravar o cadastro com o mesmo valor continua ok', () => {
  reset();
  assert.equal(grava(U('bia', 'diretoria'), A.bia, 'marca'), false, 'troca rh → marca');
  assert.equal(grava(U('bia'), A.bia, { role: 'membro', diretoria: 'marca' }), false, 'troca regravando o cadastro inteiro');
  assert.equal(grava(U('bia'), A.bia, { role: 'membro', diretoria: 'rh', nome: 'Bia 2' }), true, 'regrava o cadastro mantendo a diretoria');
});

test('ninguém escolhe pelos outros, exceto ADM/Caio; valor fora das 4 é recusado', () => {
  reset();
  assert.equal(grava(U('ana', 'diretoria'), A.bia, 'rh'), false, 'outra pessoa');
  assert.equal(grava(U('ana', 'diretoria'), A.po, 'rh'), false, 'PO');
  assert.equal(grava(U('bia', 'diretoria'), A.po, 'marca'), false, 'PO troca');
  assert.equal(grava(U('bia', 'diretoria'), A.lista, 'marca'), false, 'ADM só pela lista de e-mails (sem role adm no banco)');
  assert.equal(grava(U('bia', 'diretoria'), A.adm, 'marca'), true, 'ADM troca');
  assert.equal(grava(U('ana', 'diretoria'), A.adm, 'tecnologia'), true, 'ADM define de quem não escolheu');
  assert.equal(grava(U('bia', 'diretoria'), A.caio, 'digital'), true, 'Caio troca');
  assert.equal(grava(U('ana', 'diretoria'), A.ana, 'comercial'), false, 'valor fora das 4 (a própria pessoa)');
  assert.equal(grava(U('bia', 'diretoria'), A.adm, 'Digital'), false, 'valor fora das 4 (ADM, maiúscula)');
  assert.equal(grava(U('ana', 'diretoria'), A.ana, 1), false, 'não é texto');
});

test('espelho em usuarios_publicos só com o MESMO valor da fonte (fonte primeiro, espelho depois)', () => {
  reset();
  assert.equal(grava(P('ana', 'diretoria'), A.ana, 'rh'), false, 'espelho antes da fonte');
  assert.equal(grava(U('ana', 'diretoria'), A.ana, 'rh'), true); aplica(U('ana', 'diretoria'), 'rh');
  assert.equal(grava(P('ana', 'diretoria'), A.ana, 'marca'), false, 'espelho diferente da fonte');
  assert.equal(grava(P('ana', 'diretoria'), A.ana, 'rh'), true, 'espelho igual à fonte');
  assert.equal(grava(P('bia', 'diretoria'), A.adm, 'rh'), true, 'ADM reespelha');
  assert.equal(grava(P('bia', 'diretoria'), A.bia, 'tecnologia'), false, 'a pessoa forja a etiqueta pública');
  // login: o fbSet inteiro do espelho continua passando quando NÃO leva a diretoria (ela vai num update à parte)
  assert.equal(grava(P('bia'), A.bia, { nome: 'Bia', init: 'BB' }), true, 'refresh do espelho sem o campo');
});

test('resíduo aceito: o titular e o PO conseguem APAGAR (volta a "Não informada"); o .validate não roda na exclusão', () => {
  reset();
  assert.equal(grava(U('bia', 'diretoria'), A.bia, null), true, 'titular apaga a própria');
  assert.equal(grava(U('bia', 'diretoria'), A.po, null), true, 'PO apaga (tem .write no cadastro)');
  assert.equal(grava(U('bia', 'diretoria'), A.ana, null), false, 'outra pessoa sem papel não apaga');
});
