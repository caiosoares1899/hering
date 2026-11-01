// functions/rules/__tests__/timersRules.test.js
//
// ⏱️ Timer e Produtividade do card (2026-11): índice dos timers ATIVOS por pessoa em kanban/timers_ativos/{uid}/{tid}. Só o dono lê o seu (ninguém vê "quem está fazendo o quê agora");
// o dono grava; quem criou o timer PARA OUTRA pessoa pode criá-lo (e apagá-lo enquanto ainda está "novo"); a empresa inteira não consegue forjar o tempo de ninguém.
// O registro completo (com histórico) mora em squads/*/dados/card_timers/{cardId}/{tid}, sob a regra geral de `dados` (empresa), como os comentários dos cards.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { check, validate } = require('../rulesSim');

const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database.rules.json'), 'utf8'));
const mk = (uid, email, prov) => ({ uid, token: { email, firebase: { sign_in_provider: prov || 'google.com' } } });
const A = { ana: mk('ana', 'ana@ciahering.com.br'), pau: mk('pau', 'pau@ciahering.com.br'), gil: mk('gil', 'gil@ciahering.com.br'),
  forasteiro: mk('out1', 'qualquer@gmail.com'), arezzo: mk('az1', 'x@arezzo.com.br', 'microsoft.com') };
let DB = { kanban: { usuarios: {}, timers_ativos: {} } };
const reset = () => { DB = { kanban: { usuarios: {}, timers_ativos: {} } }; };
const lê = (p, ator) => check(RULES, DB, 'read', p, ator);
const grava = (p, ator, val) => check(RULES, DB, 'write', p, ator, val) && validate(RULES, DB, p, ator, val);
const P = (uid, tid) => `kanban/timers_ativos/${uid}/${tid}`;
const reg = (o) => Object.assign({ sq: 'dados', cardId: 'c1', atividade: 'Revisão do layout', tipo: 'cron', status: 'rodando', startedAt: 1790000000000, accMs: 0 }, o || {});

test('o dono cria, pausa e apaga o próprio timer; os outros não mexem no dele', () => {
  reset();
  assert.equal(grava(P('ana', 't_abc123'), A.ana, reg()), true, 'dono cria');
  DB.kanban.timers_ativos.ana = { t_abc123: reg() };
  assert.equal(grava(P('ana', 't_abc123'), A.ana, reg({ status: 'pausado', accMs: 5000 })), true, 'dono pausa');
  assert.equal(grava(P('ana', 't_abc123'), A.ana, null), true, 'dono apaga (encerrou)');
  assert.equal(grava(P('ana', 't_abc123'), A.pau, reg({ status: 'pausado' })), false, 'outro NÃO pausa o timer da Ana');
  assert.equal(grava(P('ana', 't_abc123'), A.pau, null), false, 'outro NÃO apaga o timer da Ana');
  assert.equal(grava(P('ana', 't_novo99'), A.pau, reg()), false, 'outro NÃO cria um timer rodando "em nome" da Ana');
});

test('privacidade: só o dono lê o índice dele (ninguém lista quem está fazendo o quê agora)', () => {
  reset(); DB.kanban.timers_ativos = { ana: { t_abc123: reg() } };
  assert.equal(lê('kanban/timers_ativos/ana', A.ana), true);
  assert.equal(lê(P('ana', 't_abc123'), A.ana), true);
  ['pau', 'gil', 'forasteiro', 'arezzo'].forEach(k => assert.equal(lê('kanban/timers_ativos/ana', A[k]), false, 'não lê: ' + k));
  assert.equal(lê('kanban/timers_ativos', A.ana), false, 'ninguém lê a lista inteira');
});

test('timer criado PARA outra pessoa: o criador cria em "novo" (com porUid) e só apaga enquanto não foi iniciado', () => {
  reset();
  const novo = reg({ status: 'novo', porUid: 'pau', porNome: 'Pau' }); delete novo.startedAt;
  assert.equal(grava(P('ana', 't_para1'), A.pau, novo), true, 'o Pau cria um timer pra Ana');
  assert.equal(grava(P('ana', 't_para2'), A.pau, reg({ status: 'novo', porUid: 'gil' })), false, 'porUid tem que ser o próprio criador (não dá pra forjar outro autor)');
  DB.kanban.timers_ativos = { ana: { t_para1: novo } };
  assert.equal(grava(P('ana', 't_para1'), A.pau, null), true, 'o criador desfaz enquanto está "novo"');
  assert.equal(grava(P('ana', 't_para1'), A.ana, reg({ status: 'rodando', porUid: 'pau', porNome: 'Pau' }), true), true, 'quem recebeu inicia (é o dono)');
  DB.kanban.timers_ativos = { ana: { t_para1: reg({ status: 'rodando', porUid: 'pau' }) } };
  assert.equal(grava(P('ana', 't_para1'), A.pau, null), false, 'depois de iniciado, o criador NÃO controla mais');
  assert.equal(grava(P('ana', 't_para1'), A.pau, reg({ status: 'pausado', porUid: 'pau' })), false, 'nem pausa');
});

test('validação: tipo, status, tamanho da atividade, duração e id', () => {
  reset();
  assert.equal(grava(P('ana', 't_ok1234'), A.ana, reg({ tipo: 'timer', durMs: 25 * 60000, status: 'novo' })), true);
  assert.equal(grava(P('ana', 't_ok1234'), A.ana, reg({ tipo: 'foo' })), false, 'tipo inválido');
  assert.equal(grava(P('ana', 't_ok1234'), A.ana, reg({ status: 'encerrado' })), false, 'encerrado não fica no índice (some)');
  assert.equal(grava(P('ana', 't_ok1234'), A.ana, reg({ atividade: 'x'.repeat(121) })), false, 'atividade grande demais');
  assert.equal(grava(P('ana', 't_ok1234'), A.ana, reg({ durMs: 0 })), false, 'duração zero');
  assert.equal(grava(P('ana', 't_ok1234'), A.ana, reg({ durMs: 90000000 })), false, 'mais de 24 h');
  assert.equal(grava(P('ana', 't_ok1234'), A.ana, reg({ accMs: -1 })), false, 'tempo negativo');
  const semCard = reg(); delete semCard.cardId; assert.equal(grava(P('ana', 't_ok1234'), A.ana, semCard), false, 'sem cardId');
  assert.equal(grava(P('ana', 'x'), A.ana, reg()), false, 'id curto demais');
  assert.equal(grava(P('ana', 't_ok1234'), A.forasteiro, reg()), false, 'fora da empresa');
  assert.equal(grava(P('az1', 't_ok1234'), A.arezzo, reg()), false, 'conta Microsoft/Arezzo não grava (modo só Hering)');
});
