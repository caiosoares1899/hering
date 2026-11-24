// functions/rules/__tests__/cardumeCardRules.test.js
//
// 🐟 Cardume etapa 3 (24/11/2026): "Registrar no card" e a prévia do card colado NÃO têm regra nova. Usam o acesso que a
// pessoa já tem à squad do card. Este teste prova as premissas do desenho (docs/ideias/cardume-v0-banco.md › "Etapa 3"):
// toda conta Google @ciahering.com.br lê e grava os dados de QUALQUER squad (regra de kanban/squads/$sq/dados), então o comentário
// registrado é lido pela Hering inteira, não só pela squad (o aviso da página diz isso). Externo só entra pela própria squad.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { check, validate } = require('../rulesSim');

const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database.rules.json'), 'utf8'));
const mk = (uid, email) => ({ uid, token: { email, firebase: { sign_in_provider: 'google.com' } } });
const A = { ana: mk('ana', 'ana@ciahering.com.br'), gil: mk('gil', 'gil@ciahering.com.br'), adm: mk('adm', 'adm@ciahering.com.br'),
  ext: mk('ext', 'fulano@gmail.com'), extDados: mk('exd', 'beltrano@gmail.com') };
const BASE = 'kanban/squads/dados/dados';
let DB;
const reset = () => { DB = { kanban: {
  usuarios: { ana: { squads: { dados: true } }, gil: { squads: { prf: true } }, adm: { role: 'adm' }, exd: { squads: { dados: true } } },
  squads: { dados: { dados: { cards_index: { c1: '0' }, cards: { 0: { id: 'c1', title: 'Painel de vendas' } }, card_comments: {} } } },
} }; };
const lê = (p, ator) => check(RULES, DB, 'read', p, ator);
const grava = (p, ator, val) => check(RULES, DB, 'write', p, ator, val) && validate(RULES, DB, p, ator, val);
const com = uid => ({ id: 'cx1', uid, author: 'X', init: 'X', foto: '', ts: '2026-11-24T12:00:00.000Z', text: '🐟 Do Cardume · #dados\n\n**Ana** (24/11 11:58): oi', cardume: { c: 'dados', m: '-Nabc' } });

test('prévia: qualquer pessoa da Hering (e o externo marcado na squad) lê o índice e o título; externo de fora, não', () => {
  reset();
  for (const k of ['ana', 'gil', 'adm', 'extDados']) {
    assert.equal(lê(`${BASE}/cards_index/c1`, A[k]), true, 'índice: ' + k);
    assert.equal(lê(`${BASE}/cards/0/title`, A[k]), true, 'título: ' + k);
  }
  assert.equal(lê(`${BASE}/cards_index/c1`, A.ext), false, 'externo de fora: índice');
  assert.equal(lê(`${BASE}/cards/0/title`, A.ext), false, 'externo de fora: título');
});

test('Registrar no card: comentário próprio com o campo cardume grava; externo de fora ou com outro autor, não', () => {
  reset();
  assert.equal(grava(`${BASE}/card_comments/c1/cx1`, A.ana, com('ana')), true, 'membro da squad, o próprio uid');
  assert.equal(grava(`${BASE}/card_comments/c1/cx1`, A.adm, com('adm')), true, 'ADM');
  assert.equal(grava(`${BASE}/card_comments/c1/cx1`, A.gil, com('gil')), true, 'Hering de outra squad (a regra de dados libera a Hering inteira)');
  assert.equal(grava(`${BASE}/card_comments/c1/cx1`, A.ext, com('ext')), false, 'externo de fora');
  assert.equal(grava(`${BASE}/card_comments/c1/cx1`, A.ana, com('gil')), false, 'em nome de outra pessoa');
});
