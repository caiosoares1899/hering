// functions/rules/__tests__/guardiaoRules.test.js
//
// 🛡️ Marcador de incidente "resolvido" do Guardião (kanban/cards_guardiao/{squad}/resolvidos/{chave}): só ADM (role adm ou o e-mail do Caio) ou PO/Organizador DO squad grava; grava uma vez
// (não sobrescreve nem apaga: é trilha de auditoria); `uid` tem de ser o de quem grava. Todo o resto de cards_guardiao segue sendo só do servidor (o `_status` do pulso também).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { check, validate } = require('../rulesSim');

const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database.rules.json'), 'utf8'));
const mk = (uid, email, prov) => ({ uid, token: { email, name: 'Fulano', firebase: { sign_in_provider: prov || 'google.com' } } });   // name = displayName do login Google (o que a tela grava em `por`)
const A = { adm: mk('adm1', 'adm@ciahering.com.br'), caio: mk('caio', 'caio.soares@ciahering.com.br'), poDados: mk('po1', 'po1@ciahering.com.br'), poPrf: mk('po2', 'po2@ciahering.com.br'),
  orgDados: mk('org1', 'org1@ciahering.com.br'), poRoleSquad: mk('po3', 'po3@ciahering.com.br'), membro: mk('m1', 'm1@ciahering.com.br'), poSemInscricao: mk('po4', 'po4@ciahering.com.br'),
  forasteiro: mk('out1', 'qualquer@gmail.com'), arezzo: mk('az1', 'x@arezzo.com.br', 'microsoft.com') };
const DB = { kanban: { usuarios: {
  adm1: { role: 'adm' }, caio: { role: 'membro' }, po1: { role: 'po', squads: { dados: true } }, po2: { role: 'po', squads: { prf: true } }, org1: { role: 'organizador', squads: { dados: true } },
  po3: { role: 'membro', squads: { dados: true }, squads_roles: { dados: 'po' } }, m1: { role: 'membro', squads: { dados: true } }, po4: { role: 'po', squads: {} } },
  cards_guardiao: { dados: { incidentes: { k1: { cardId: 'c1', acao: 'sem_espelho' } }, resolvidos: { velho: { por: 'X', uid: 'adm1', em: '2026-11-01T00:00:00Z' } } } } } };
const P = (sq, k) => `kanban/cards_guardiao/${sq}/resolvidos/${k}`;
const reg = (uid, extra) => Object.assign({ por: 'Fulano', uid, em: '2026-11-06T10:00:00.000Z' }, extra || {});
const grava = (p, ator, val) => check(RULES, DB, 'write', p, ator, val) && validate(RULES, DB, p, ator, val);

test('quem pode resolver: ADM, Caio, PO/Organizador do squad (role global ou squads_roles) — e só no squad dele', () => {
  assert.equal(grava(P('dados', 'k1'), A.adm, reg('adm1')), true, 'ADM');
  assert.equal(grava(P('prf', 'k9'), A.adm, reg('adm1')), true, 'ADM em qualquer squad');
  assert.equal(grava(P('dados', 'k1'), A.caio, reg('caio')), true, 'Caio');
  assert.equal(grava(P('dados', 'k1'), A.poDados, reg('po1')), true, 'PO do squad');
  assert.equal(grava(P('dados', 'k1'), A.orgDados, reg('org1')), true, 'Organizador do squad');
  assert.equal(grava(P('dados', 'k1'), A.poRoleSquad, reg('po3')), true, 'PO só dentro do squad (squads_roles)');
  assert.equal(grava(P('dados', 'k1'), A.poPrf, reg('po2')), false, 'PO de OUTRO squad não resolve o de dados');
  assert.equal(grava(P('dados', 'k1'), A.poSemInscricao, reg('po4')), false, 'PO sem inscrição no squad');
  assert.equal(grava(P('dados', 'k1'), A.membro, reg('m1')), false, 'membro comum');
  assert.equal(grava(P('dados', 'k1'), A.forasteiro, reg('out1')), false, 'de fora');
  assert.equal(grava(P('dados', 'k1'), A.arezzo, reg('az1')), false, 'conta Microsoft');
});

test('trilha de auditoria: grava uma vez; não sobrescreve, não apaga, uid é o de quem grava, formato fechado', () => {
  assert.equal(grava(P('dados', 'velho'), A.adm, reg('adm1')), false, 'não sobrescreve um resolvido');
  assert.equal(grava(P('dados', 'velho'), A.adm, null), false, 'não apaga');
  assert.equal(grava(P('dados', 'k2'), A.adm, reg('outro-uid')), false, 'uid forjado');
  assert.equal(grava(P('dados', 'k2'), A.adm, { por: 'x', uid: 'adm1' }), false, 'sem "em"');
  assert.equal(grava(P('dados', 'k2'), A.adm, reg('adm1', { extra: 1 })), false, 'campo extra');
  assert.equal(grava(P('dados', 'k2'), A.adm, reg('adm1', { por: 'x'.repeat(81) })), false, 'nome grande demais');
  assert.equal(grava(P('dados', 'k2'), A.adm, reg('adm1', { em: 123 })), false, '"em" tem de ser texto');
});

test('"Resolvido por" não se forja: `por` tem de ser o nome ou o e-mail do login de quem grava (auditoria 09/11/2026, K2)', () => {
  assert.equal(grava(P('dados', 'k3'), A.poDados, reg('po1', { por: 'Caio Soares' })), false, 'PO não atribui a resolução a outra pessoa');
  assert.equal(grava(P('dados', 'k3'), A.adm, reg('adm1', { por: 'Outra Pessoa' })), false, 'nem o ADM');
  assert.equal(grava(P('dados', 'k3'), A.poDados, reg('po1', { por: A.poDados.token.email })), true, 'sem nome no login, a tela grava o e-mail');
  assert.equal(grava(P('dados', 'k3'), A.poDados, reg('po1')), true, 'o próprio nome do login');
});

test('o resto de cards_guardiao continua só do servidor (incidentes, ultimo, restauracoes, janela, o pulso _status)', () => {
  for (const p of ['kanban/cards_guardiao/dados/incidentes/zz', 'kanban/cards_guardiao/dados/ultimo', 'kanban/cards_guardiao/dados/restauracoes/c1', 'kanban/cards_guardiao/dados/janela', 'kanban/cards_guardiao/_status', 'kanban/cards_guardiao/_status/resolvidos/k1']) {
    for (const a of ['adm', 'caio', 'poDados', 'membro']) assert.equal(grava(p, A[a], { x: 1 }), false, `${a} não grava em ${p}`);
  }
});

test('leitura de cards_guardiao segue aberta à empresa (e fechada a quem é de fora)', () => {
  for (const p of ['kanban/cards_guardiao', 'kanban/cards_guardiao/dados/resolvidos', 'kanban/cards_guardiao/_status']) {
    assert.equal(check(RULES, DB, 'read', p, A.membro), true, 'empresa lê ' + p);
    assert.equal(check(RULES, DB, 'read', p, A.forasteiro), false, 'de fora não lê ' + p);
  }
});
