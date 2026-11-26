// functions/rules/__tests__/perfisRules.test.js
//
// 👤 Perfil da pessoa (26/11/2026) — kanban/perfis/{uid} = { cargo, tel, niver }, preenchido pela própria pessoa em Oceano › ⚙ Meu perfil e
// mostrado pelo cartão compartilhado (mare-perfil) em Concha, Maré, Radar, Oceano e Sonar.
// Decisões do Caio: telefone é opcional e, preenchido, toda a Hering vê. Por isso o nó é SEPARADO de usuarios_publicos
// (lá a leitura é qualquer conta logada — painel_viewers, externos — e PO/ADM gravam o cadastro dos outros).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { check, validate } = require('../rulesSim');

const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database.rules.json'), 'utf8'));
const mk = (uid, email, prov) => ({ uid, token: { email, firebase: { sign_in_provider: prov || 'google.com' } } });
const A = {
  ana: mk('ana', 'ana@ciahering.com.br'),
  adm: mk('adm', 'adm@ciahering.com.br'),
  po: mk('po', 'po@ciahering.com.br'),
  caio: mk('cai', 'caio.soares@ciahering.com.br'),
  ext: mk('ext', 'fulano@gmail.com'),                       // painel_viewer / conta de fora
  senha: mk('pwd', 'ana2@ciahering.com.br', 'password'),     // e-mail da Hering sem o Google
};
const DB = () => ({ kanban: {
  usuarios: { adm: { role: 'adm' }, po: { role: 'po' }, ana: { role: 'membro' }, cai: { role: 'membro' } },
  painel_viewers: { 'fulano@gmail,com': true },
  perfis: { ana: { cargo: 'Analista de Dados', tel: '+5547999998888', niver: '03-15' } },
} });
const lê = (p, ator) => check(RULES, DB(), 'read', p, ator);
const grava = (p, ator, val) => check(RULES, DB(), 'write', p, ator, val) && validate(RULES, DB(), p, ator, val);

test('👤 perfis: toda a Hering (Google) lê; fora da Hering não', () => {
  for (const k of ['ana', 'adm', 'po', 'caio']) assert.equal(lê('kanban/perfis/ana', A[k]), true, k + ' lê');
  assert.equal(lê('kanban/perfis', A.po), true, 'lista inteira (Sonar/cartão)');
  assert.equal(lê('kanban/perfis/ana', A.ext), false, 'conta de fora (painel_viewer) não lê o telefone');
  assert.equal(lê('kanban/perfis', A.ext), false, 'nem a lista');
  assert.equal(lê('kanban/perfis/ana', A.senha), false, 'sem login Google não lê');
  assert.equal(lê('kanban/perfis/ana', null), false, 'anônimo não lê');
});

test('👤 perfis: só a dona grava e apaga — nem PO, ADM ou o e-mail do Caio', () => {
  assert.equal(grava('kanban/perfis/ana', A.ana, { cargo: 'Coordenadora', tel: '4733334444', niver: '12-31' }), true, 'a dona grava tudo');
  assert.equal(grava('kanban/perfis/ana/tel', A.ana, null), true, 'a dona tira o telefone');
  assert.equal(grava('kanban/perfis/ana', A.ana, null), true, 'a dona apaga o perfil');
  for (const k of ['adm', 'po', 'caio', 'ext']) {
    assert.equal(grava('kanban/perfis/ana/cargo', A[k], 'Estagiária'), false, k + ' troca o cargo de outra pessoa');
    assert.equal(grava('kanban/perfis/ana', A[k], null), false, k + ' apaga o perfil de outra pessoa');
  }
  assert.equal(grava('kanban/perfis/ext', A.ext, { cargo: 'X' }), false, 'conta de fora não cria perfil');
});

test('👤 perfis: formato de cada campo', () => {
  const ok = v => grava('kanban/perfis/ana', A.ana, v);
  assert.equal(ok({ cargo: 'x'.repeat(60) }), true, 'cargo de 60');
  assert.equal(ok({ cargo: 'x'.repeat(61) }), false, 'cargo de 61');
  assert.equal(ok({ cargo: '' }), false, 'cargo vazio (apagar é null)');
  assert.equal(ok({ cargo: 5 }), false, 'cargo número');
  for (const t of ['+5547999998888', '4733334444', '554799999888877']) assert.equal(ok({ tel: t }), true, 'tel ' + t);
  for (const t of ['123456789', '+55 47 99999-8888', 'javascript:alert(1)', '+55479999988881234', '47-3333-4444']) assert.equal(ok({ tel: t }), false, 'tel ' + t);
  for (const n of ['01-01', '02-29', '12-31', '10-30']) assert.equal(ok({ niver: n }), true, 'niver ' + n);
  for (const n of ['13-01', '00-10', '1-5', '2000-03-15', '03-32', '03/15']) assert.equal(ok({ niver: n }), false, 'niver ' + n);
  for (const l of ['caio-soares-123', 'ana_lima', 'abc']) assert.equal(ok({ li: l }), true, 'linkedin ' + l);   // só o identificador de linkedin.com/in/<id>: o link é montado na tela
  for (const l of ['https://linkedin.com/in/ana', 'ab', 'ana/../x', 'javascript:alert(1)', 'ana lima', 'x'.repeat(101)]) assert.equal(ok({ li: l }), false, 'linkedin ' + l);
  assert.equal(ok({ cargo: 'A', bio: 'oi' }), false, 'campo extra não entra');
  assert.equal(ok({ cargo: 'A', foto: 'https://x' }), false, 'nem foto (vem da conta Google)');
});
