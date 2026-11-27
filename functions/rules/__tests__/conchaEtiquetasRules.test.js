// functions/rules/__tests__/conchaEtiquetasRules.test.js
//
// 🏷️ Etiquetas por pessoa, por canal (27/11/2026): kanban/cardume/etiquetas/{canal}/{uid} = texto curto (1–24, sem quebra de linha,
// sem espaço nas pontas). Cada um configura a SUA, e só sendo membro de um canal ativo; quem é do canal lê (e o ADM, para moderação);
// tirar a própria vale sempre (inclusive ao sair do canal); o ADM pode apagar a de qualquer um. Fora do Geral, do #oceano e das notas.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { check, validate, update } = require('../rulesSim');

const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database.rules.json'), 'utf8'));
const mk = (uid, email, prov) => ({ uid, token: { email, firebase: { sign_in_provider: prov || 'google.com' } } });
const A = {
  ana: mk('ana', 'ana@ciahering.com.br'), bru: mk('bru', 'bru@ciahering.com.br'), gil: mk('gil', 'gil@ciahering.com.br'),
  adm: mk('adm', 'adm@ciahering.com.br'), po: mk('pox', 'po@ciahering.com.br'), ext: mk('ext', 'ext@gmail.com'), senha: mk('pwd', 'pwd@ciahering.com.br', 'password'),
};
let DB;
const reset = () => { DB = { kanban: {
  usuarios: { adm: { role: 'adm' }, ana: { role: 'membro' }, bru: { role: 'membro' }, gil: { role: 'membro' }, pox: { role: 'po', squads: { dados: true }, squads_roles: { dados: 'po' } } },
  cardume: {
    canais: { dados: { nome: 'Dados' }, 't-bf-ab12': { nome: 'BF', tipo: 'tema', dono: 'ana', acesso: 'aberto', criado: Date.now() - 864e5 * 40, fim: Date.now() - 1000 } },
    membros: { dados: { ana: true, bru: true }, 't-bf-ab12': { ana: true }, geral: { ana: true }, 'eu-ana': { ana: true } },
    meus: { ana: { dados: true, 't-bf-ab12': true }, bru: { dados: true } },
    etiquetas: { dados: { bru: 'Plantão' } },
  },
} }; };
const lê = (p, ator) => check(RULES, DB, 'read', p, ator);
const grava = (p, ator, val) => check(RULES, DB, 'write', p, ator, val) && validate(RULES, DB, p, ator, val);
const E = (c, u) => `kanban/cardume/etiquetas/${c}/${u}`;

test('🏷️ etiquetas: quem é do canal lê; o ADM lê; fora do canal, não', () => {
  reset();
  for (const k of ['ana', 'bru', 'adm']) assert.equal(lê('kanban/cardume/etiquetas/dados', A[k]), true, k + ' lê');
  for (const k of ['gil', 'ext', 'senha']) assert.equal(lê('kanban/cardume/etiquetas/dados', A[k]), false, k + ' NÃO lê');
  assert.equal(lê('kanban/cardume/etiquetas', A.adm), false, 'nem a árvore inteira');
});

test('🏷️ etiquetas: cada um grava só a sua, sendo membro de canal ativo', () => {
  reset();
  assert.equal(grava(E('dados', 'ana'), A.ana, 'Design'), true, 'membro põe a sua');
  assert.equal(grava(E('dados', 'ana'), A.ana, '🎨 Design & UX'), true, 'emoji e símbolo');
  assert.equal(grava(E('dados', 'bru'), A.ana, 'Estagiário'), false, 'não põe a de outra pessoa');
  assert.equal(grava(E('dados', 'bru'), A.adm, 'Estagiário'), false, 'nem o ADM escreve a de outra pessoa');
  assert.equal(grava(E('dados', 'gil'), A.gil, 'Design'), false, 'quem não é membro');
  assert.equal(grava(E('dados', 'pox'), A.po, 'PO'), false, 'PO da squad que não é membro do canal');
  assert.equal(grava(E('t-bf-ab12', 'ana'), A.ana, 'Dona'), false, 'canal arquivado (fim passou)');
  for (const c of ['geral', 'oceano', 'eu-ana']) assert.equal(grava(E(c, 'ana'), A.ana, 'X'), false, 'sem etiqueta em ' + c);
  for (const k of ['ext', 'senha']) assert.equal(grava(E('dados', A[k].uid), A[k], 'X'), false, k);
});

test('🏷️ etiquetas: formato — 1 a 24 caracteres, sem quebra de linha nem espaço nas pontas, só texto', () => {
  reset();
  assert.equal(grava(E('dados', 'ana'), A.ana, 'x'.repeat(24)), true, '24');
  assert.equal(grava(E('dados', 'ana'), A.ana, 'x'.repeat(25)), false, '25');
  assert.equal(grava(E('dados', 'ana'), A.ana, ''), false, 'vazia');
  assert.equal(grava(E('dados', 'ana'), A.ana, 'a\nb'), false, 'quebra de linha');
  assert.equal(grava(E('dados', 'ana'), A.ana, 'a\rb'), false, '\\r');
  assert.equal(grava(E('dados', 'ana'), A.ana, ' Design'), false, 'espaço no começo');
  assert.equal(grava(E('dados', 'ana'), A.ana, 'Design '), false, 'espaço no fim');
  assert.equal(grava(E('dados', 'ana'), A.ana, 42), false, 'número');
  assert.equal(grava(E('dados', 'ana'), A.ana, { t: 'Design' }), false, 'objeto');
});

test('🏷️ etiquetas: tirar a própria vale sempre (até ao sair do canal, no mesmo update); ADM apaga a de qualquer um', () => {
  reset();
  assert.equal(grava(E('dados', 'bru'), A.bru, null), true, 'tira a sua');
  assert.equal(grava(E('dados', 'bru'), A.ana, null), false, 'outro membro não tira');
  assert.equal(grava(E('dados', 'bru'), A.po, null), false, 'PO não tira');
  assert.equal(grava(E('dados', 'bru'), A.adm, null), true, 'ADM tira (moderação)');
  const sair = { 'kanban/cardume/membros/dados/bru': null, 'kanban/cardume/meus/bru/dados': null, 'kanban/cardume/etiquetas/dados/bru': null };
  assert.equal(update(RULES, DB, A.bru, sair), true, 'sair do canal leva a etiqueta junto');
});
