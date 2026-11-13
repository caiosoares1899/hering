// functions/rules/__tests__/ganttInscritosRules.test.js
//
// 🔔 Inscrição nos avisos de mudança dos calendários do Gantt (13/11/2026): kanban/gantt_inscritos{,_dev}/{cal}/{uid} = { em, onde }.
// Cada pessoa da Hering (Google) liga/desliga SÓ a própria inscrição e só lê a própria; calendário tem que ser um dos 4; nem o
// visualizador externo do Painel nem quem é de fora lê a lista de inscritos (a função lê como admin).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { check, validate } = require('../rulesSim');

const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database.rules.json'), 'utf8'));
const mk = (uid, email, prov) => ({ uid, token: { email, firebase: { sign_in_provider: prov || 'google.com' } } });
const A = { ana: mk('ana', 'ana@ciahering.com.br'), bia: mk('bia', 'bia@ciahering.com.br'), adm: mk('adm', 'adm@ciahering.com.br'),
  senha: mk('ana', 'ana@ciahering.com.br', 'password'), fora: mk('out1', 'qualquer@gmail.com'), vis: mk('vis1', 'visita@gmail.com'), arezzo: mk('az1', 'x@arezzo.com.br', 'microsoft.com') };
let DB;
const reset = () => { DB = { kanban: { usuarios: { adm: { role: 'adm' }, ana: { role: 'membro' }, bia: { role: 'membro' } }, painel_viewers: { 'visita@gmail,com': true } } }; };
const lê = (p, ator) => check(RULES, DB, 'read', p, ator);
const grava = (p, ator, val) => check(RULES, DB, 'write', p, ator, val) && validate(RULES, DB, p, ator, val);
const ins = (o) => Object.assign({ em: 1790000000000, onde: 'mare' }, o || {});

for (const suf of ['', '_dev']) {
  const P = (cal, uid) => `kanban/gantt_inscritos${suf}/${cal}/${uid}`;
  test(`gantt_inscritos${suf}: cada um liga/desliga só a própria inscrição`, () => {
    reset();
    assert.equal(grava(P('outlet', 'ana'), A.ana, ins()), true, 'Ana se inscreve');
    assert.equal(grava(P('outlet', 'ana'), A.ana, ins({ onde: 'radar' })), true, 'pelo Radar também');
    assert.equal(grava(P('outlet', 'ana'), A.ana, null), true, 'Ana se desinscreve');
    assert.equal(grava(P('outlet', 'bia'), A.ana, ins()), false, 'Ana NÃO inscreve a Bia');
    assert.equal(grava(P('outlet', 'bia'), A.adm, ins()), false, 'nem o ADM inscreve outra pessoa');
    assert.equal(grava(P('outlet', 'ana'), A.senha, ins()), false, 'login que não é Google não grava');
    assert.equal(grava(P('outlet', 'out1'), A.fora, ins()), false, 'fora da Hering não grava');
    assert.equal(grava(P('outlet', 'az1'), A.arezzo, ins()), false, 'Arezzo (Microsoft) não grava');
  });
  test(`gantt_inscritos${suf}: calendário e formato validados`, () => {
    reset();
    assert.equal(grava(P('digital', 'ana'), A.ana, ins()), false, 'a aba consolidada não é calendário');
    assert.equal(grava(P('xpto', 'ana'), A.ana, ins()), false, 'calendário inexistente');
    assert.equal(grava(P('marca', 'ana'), A.ana, ins({ onde: 'email' })), false, 'onde fora de mare|radar');
    assert.equal(grava(P('marca', 'ana'), A.ana, { onde: 'mare' }), false, 'sem em');
    assert.equal(grava(P('marca', 'ana'), A.ana, ins({ extra: 1 })), false, 'campo extra');
    for (const c of ['marca', 'comercial', 'mktplace', 'outlet']) assert.equal(grava(P(c, 'ana'), A.ana, ins()), true, c);
  });
  test(`gantt_inscritos${suf}: só a própria inscrição é legível — lista, de outra pessoa, externo e de fora não`, () => {
    reset(); DB.kanban[`gantt_inscritos${suf}`] = { outlet: { ana: ins(), bia: ins() } };
    assert.equal(lê(P('outlet', 'ana'), A.ana), true, 'Ana lê a própria');
    assert.equal(lê(P('outlet', 'bia'), A.ana), false, 'Ana NÃO lê a da Bia');
    assert.equal(lê(`kanban/gantt_inscritos${suf}/outlet`, A.ana), false, 'ninguém lista os inscritos');
    assert.equal(lê(`kanban/gantt_inscritos${suf}`, A.adm), false, 'nem o ADM pela tela');
    assert.equal(lê(P('outlet', 'vis1'), A.vis), false, 'visualizador externo do Painel não lê');
    assert.equal(lê(`kanban/gantt_inscritos${suf}`, A.vis), false, 'visualizador externo não lista');
    assert.equal(lê(`kanban/gantt_inscritos${suf}`, A.fora), false, 'fora da Hering não lê');
  });
}
