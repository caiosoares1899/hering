// functions/rules/__tests__/genieRules.test.js
//
// 🐙 Polvo · Pergunte aos dados — kanban/genie/** é fechado para todo cliente (só o Admin SDK grava).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { check, validate } = require('../rulesSim');

const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database.rules.json'), 'utf8'));
const mk = (uid, email, prov) => ({ uid, token: { email, firebase: { sign_in_provider: prov || 'google.com' } } });

const ATORES = {
  ana: mk('ana', 'ana@ciahering.com.br'),
  bia: mk('bia', 'bia@ciahering.com.br'),
  po: mk('po', 'po@ciahering.com.br'),
  adm: mk('adm', 'adm@ciahering.com.br'),
  caio: mk('caio', 'caio.soares@ciahering.com.br'),
  ext: mk('ext', 'fulano@gmail.com'),
  senha: mk('pwd', 'ana2@ciahering.com.br', 'password'),
  anon: null,
};

const DB = () => ({
  kanban: {
    usuarios: {
      adm: { role: 'adm' },
      po: { role: 'po' },
      ana: { role: 'membro' },
      bia: { role: 'membro' },
      caio: { role: 'adm' },
    },
    painel_viewers: { 'fulano@gmail,com': true },
    genie: {
      conversas: {
        ana: { c1: { ts: '2026-11-27T15:00:00Z', ultima_msg: 'm1', msgs: { m1: true } } },
      },
      uso: {
        ana: { h: '2026112715', n: 2 },
        _casa: { h: '2026112715', n: 2 },
      },
    },
  },
});

const CAMINHOS = [
  'kanban/genie',
  'kanban/genie/conversas/ana',
  'kanban/genie/conversas/ana/c1',
  'kanban/genie/uso/ana',
  'kanban/genie/uso/_casa',
];

const grava = (rules, p, ator, val) => check(rules, DB(), 'write', p, ator, val) && validate(rules, DB(), p, ator, val);

test('🐙 genie: nenhum cliente (dona, outra conta, PO, ADM, Caio, externo, anônimo) lê ou grava kanban/genie/**', () => {
  for (const [nome, ator] of Object.entries(ATORES)) {
    for (const p of CAMINHOS) {
      assert.equal(check(RULES, DB(), 'read', p, ator), false, `${nome} não deve ler ${p}`);
      assert.equal(grava(RULES, p, ator, { teste: true }), false, `${nome} não deve gravar ${p}`);
      assert.equal(grava(RULES, p, ator, null), false, `${nome} não deve apagar ${p}`);
    }
  }
});

test('🐙 genie: sabotagem abrindo leitura para logados derruba a verificação', () => {
  const sabotada = JSON.parse(JSON.stringify(RULES));
  sabotada.rules.kanban.genie['.read'] = 'auth != null';
  assert.equal(check(sabotada, DB(), 'read', 'kanban/genie/conversas/ana/c1', ATORES.ana), true);
});
