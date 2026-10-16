// functions/rules/__tests__/plantaoRules.test.js — kanban/plantao/{bugId}: a ficha do bug do Plantão (PR, script de teste, validação).
// Só ADM (role 'adm' ou o e-mail do Caio) lê/escreve; membro, PO, forasteiro e visualizador não. O servidor (Admin SDK) ignora regras.
// A validação é o que impede "validar sem prova": estado fora da lista, PR que não é do nosso repositório e validadoPorUid de outra pessoa são recusados.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { check, validate } = require('../rulesSim');

const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database.rules.json'), 'utf8'));
const mk = (uid, email, prov) => ({ uid, token: { email, firebase: { sign_in_provider: prov } } });
const A = {
  adm: mk('adm1', 'andre@ciahering.com.br', 'google.com'), caio: mk('caio', 'caio.soares@ciahering.com.br', 'google.com'),
  po: mk('po1', 'p@ciahering.com.br', 'google.com'), membro: mk('m1', 'm@ciahering.com.br', 'google.com'),
  forasteiro: mk('o1', 'x@gmail.com', 'google.com'), arezzo: mk('az', 'b@arezzo.com.br', 'microsoft.com'),
};
const DB = { kanban: { usuarios: { adm1: { role: 'adm' }, po1: { role: 'po' }, m1: { role: 'membro' }, caio: { role: 'membro' } },
  plantao: { b1: { estado: 'aguardando', criadoEm: 1 } } } };
const pode = (ator, p, val) => check(RULES, DB, 'write', p, A[ator], val) && validate(RULES, DB, p, A[ator], val);
const ficha = (extra) => Object.assign({ estado: 'aguardando', criadoEm: 1760000000000 }, extra || {});
const PR = 'https://github.com/caiosoares1899/hering/pull/1500';

test('ler a fila do plantão: só ADM (e o Caio)', () => {
  const le = (a) => check(RULES, DB, 'read', 'kanban/plantao', A[a]);
  assert.equal(le('adm'), true); assert.equal(le('caio'), true);
  for (const a of ['po', 'membro', 'forasteiro', 'arezzo']) assert.equal(le(a), false, a);
});

test('escrever a ficha: só ADM', () => {
  assert.equal(pode('adm', 'kanban/plantao/b2', ficha()), true);
  assert.equal(pode('caio', 'kanban/plantao/b2', ficha()), true);
  for (const a of ['po', 'membro', 'forasteiro', 'arezzo']) assert.equal(pode(a, 'kanban/plantao/b1/estado', 'validado'), false, `${a} não valida`);
});

test('estado: só os da lista', () => {
  for (const e of ['aguardando', 'em_analise', 'pr_aberto', 'testando', 'reprovado', 'validado', 'em_prod', 'duplicado', 'escalado', 'cancelado']) assert.equal(pode('adm', 'kanban/plantao/b1/estado', e), true, e);
  for (const e of ['ok', 'VALIDADO', '', 'validado ']) assert.equal(pode('adm', 'kanban/plantao/b1/estado', e), false, JSON.stringify(e));
});

test('PR: só link de pull request do nosso repositório', () => {
  assert.equal(pode('adm', 'kanban/plantao/b1/prUrl', PR), true);
  for (const u of ['https://github.com/outra/pessoa/pull/1', 'http://github.com/caiosoares1899/hering/pull/1', 'https://github.com/caiosoares1899/hering/issues/1', 'javascript:alert(1)', PR + '/files']) assert.equal(pode('adm', 'kanban/plantao/b1/prUrl', u), false, u);
});

test('validação: resultado ok|falhou, tentativas 0–3, script ≤ 20 mil, validadoPorUid = quem está gravando', () => {
  assert.equal(pode('adm', 'kanban/plantao/b1/resultadoTeste', 'ok'), true);
  assert.equal(pode('adm', 'kanban/plantao/b1/resultadoTeste', 'talvez'), false);
  assert.equal(pode('adm', 'kanban/plantao/b1/tentativas', 3), true);
  assert.equal(pode('adm', 'kanban/plantao/b1/tentativas', 4), false);
  assert.equal(pode('adm', 'kanban/plantao/b1/tentativas', -1), false);
  assert.equal(pode('adm', 'kanban/plantao/b1/scriptTeste', 'x'.repeat(20000)), true);
  assert.equal(pode('adm', 'kanban/plantao/b1/scriptTeste', 'x'.repeat(20001)), false);
  assert.equal(pode('adm', 'kanban/plantao/b1/validadoPorUid', 'adm1'), true);
  assert.equal(pode('adm', 'kanban/plantao/b1/validadoPorUid', 'outro'), false, 'não dá pra assinar a validação por outra pessoa');
});

test('campo desconhecido é recusado; apagar a ficha é permitido ao ADM', () => {
  assert.equal(pode('adm', 'kanban/plantao/b1/qualquerCoisa', 'x'), false);
  assert.equal(pode('adm', 'kanban/plantao/b1', null), true);
});
