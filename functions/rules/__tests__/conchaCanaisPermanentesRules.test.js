// functions/rules/__tests__/conchaCanaisPermanentesRules.test.js
//
// 📢 Canais permanentes da Concha (26/11/2026, R3, PR #2011): Geral (`geral`) e #oceano (`oceano`).
// Toda conta Google @ciahering.com.br lê; publicação, assuntos, fixadas, reações, tags e encaminhamento PARA eles
// são exclusivos de ADM (`role === 'adm'` ou e-mail do Caio). PO global com squad `geral`/`oceano` forjada e membro
// forjado em `membros/geral` NÃO ganham escrita.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { check, validate, update } = require('../rulesSim');

const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database.rules.json'), 'utf8'));
const mk = (uid, email, prov) => ({ uid, token: { email, firebase: { sign_in_provider: prov || 'google.com' } } });
const A = {
  comum: mk('ana', 'ana@ciahering.com.br'),
  adm: mk('adm', 'adm@ciahering.com.br'),
  caio: mk('cai', 'caio.soares@ciahering.com.br'),
  pog: mk('pog', 'pog@ciahering.com.br'),                  // PO global com squads/squads_roles forjados para geral e oceano
  forjado: mk('bru', 'bru@ciahering.com.br'),              // membro forjado em membros/geral e membros/oceano
  forasteiro: mk('out1', 'qualquer@gmail.com'),
  intruso: mk('int', 'int@ciahering.com.br', 'password'),
};
const CANAIS = ['geral', 'oceano'];
let DB;
const reset = () => { DB = { kanban: {
  usuarios: {
    adm: { role: 'adm' },
    ana: { role: 'membro', squads: { dados: true } },
    bru: { role: 'membro', squads: { dados: true } },
    pog: { role: 'po', squads: { geral: true, oceano: true }, squads_roles: { geral: 'po', oceano: 'po' } },
  },
  cardume: {
    canais: { dados: { nome: 'Dados' } },
    membros: { dados: { ana: true, adm: true, bru: true }, geral: { bru: true }, oceano: { bru: true } },
    msgs: {
      dados: { d1: { uid: 'ana', ts: Date.now() - 864e5, texto: 'aviso da squad' } },
      geral: { g1: { uid: 'adm', ts: Date.now() - 5000, texto: 'Bem-vindos ao Geral' } },
      oceano: { o1: { uid: 'adm', ts: Date.now() - 5000, texto: 'Atualização do Oceano\n\n🤖 Agente Ágil' } },
    },
    ultima: {
      geral: { ts: Date.now() - 5000, uid: 'adm', id: 'g1' },
      oceano: { ts: Date.now() - 5000, uid: 'adm', id: 'o1' },
    },
    fixadas: {
      geral: { g1: { por: 'adm', em: Date.now() - 4000, t: 'topo' } },
      oceano: { o1: { por: 'adm', em: Date.now() - 4000, t: 'topo' } },
    },
    assuntos: {
      geral: { a1: { n: 'Avisos', por: 'adm', criado: Date.now() - 9000 } },
      oceano: { a1: { n: 'Novidades', por: 'adm', criado: Date.now() - 9000 } },
    },
  },
} }; };
const lê = (p, ator) => check(RULES, DB, 'read', p, ator);
const grava = (p, ator, val) => check(RULES, DB, 'write', p, ator, val) && validate(RULES, DB, p, ator, val);
const up = (ator, mapa) => update(RULES, DB, ator, mapa);

test('📢 Geral e #oceano: toda conta Hering Google lê; forasteiro e login sem Google não leem', () => {
  reset();
  for (const c of CANAIS) {
    for (const no of ['msgs', 'ultima', 'ultima_a', 'assuntos', 'fixadas', 'reacoes', 'tags', 'tags_ult']) {
      for (const k of ['comum', 'adm', 'caio', 'pog', 'forjado']) assert.equal(lê(`kanban/cardume/${no}/${c}`, A[k]), true, `${k} lê ${no}/${c}`);
      for (const k of ['forasteiro', 'intruso']) assert.equal(lê(`kanban/cardume/${no}/${c}`, A[k]), false, `${k} NÃO lê ${no}/${c}`);
    }
  }
});

test('📢 Geral e #oceano: ADM (role adm e e-mail do Caio) publica, edita, apaga, fixa e cria assunto', () => {
  reset();
  for (const c of CANAIS) {
    for (const k of ['adm', 'caio']) {
      const t = Date.now(), uid = A[k].uid, mid = 'm_' + k;
      assert.equal(up(A[k], {
        [`kanban/cardume/msgs/${c}/${mid}`]: { uid, ts: t, texto: 'Comunicado oficial\n\n🤖 Agente Ágil' },
        [`kanban/cardume/ultima/${c}`]: { ts: t, uid, id: mid },
        [`kanban/cardume/ultima_a/${c}/_geral`]: { ts: t, uid, id: mid },
      }), true, `${k} publica em ${c}`);
      assert.equal(grava(`kanban/cardume/assuntos/${c}/a${k}`, A[k], { n: 'Release', por: uid, criado: t }), true, `${k} cria assunto em ${c}`);
      const refId = c === 'geral' ? 'g1' : 'o1';
      assert.equal(grava(`kanban/cardume/fixadas/${c}/${refId}/t`, A[k], 'regra'), true, `${k} move fixada em ${c}`);
    }
  }
});

test('📢 Geral e #oceano: conta comum, PO global forjado e membro forjado NÃO publicam, nem criam assunto, fixada ou reação', () => {
  reset();
  for (const c of CANAIS) {
    const refId = c === 'geral' ? 'g1' : 'o1';
    for (const k of ['comum', 'pog', 'forjado']) {
      const t = Date.now(), uid = A[k].uid;
      assert.equal(up(A[k], {
        [`kanban/cardume/msgs/${c}/x1`]: { uid, ts: t, texto: 'tentativa' },
        [`kanban/cardume/ultima/${c}`]: { ts: t, uid, id: 'x1' },
      }), false, `${k} NÃO publica em ${c}`);
      assert.equal(grava(`kanban/cardume/msgs/${c}/x1`, A[k], { uid, ts: t, texto: 'direto' }), false, `${k} NÃO grava msg solta em ${c}`);
      assert.equal(grava(`kanban/cardume/assuntos/${c}/ax`, A[k], { n: 'X', por: uid, criado: t }), false, `${k} NÃO cria assunto em ${c}`);
      assert.equal(grava(`kanban/cardume/assuntos/${c}/a1/n`, A[k], 'Hackeado'), false, `${k} NÃO renomeia assunto em ${c}`);
      assert.equal(grava(`kanban/cardume/fixadas/${c}/${refId}`, A[k], null), false, `${k} NÃO desafixa em ${c}`);
      assert.equal(grava(`kanban/cardume/reacoes/${c}/${refId}/${uid}`, A[k], '👍'), false, `${k} NÃO reage em ${c}`);
    }
  }
});

test('📢 Geral e #oceano: encaminhar PARA eles só ADM consegue; conta comum é recusada pelo banco', () => {
  reset(); const t = Date.now(), ts0 = DB.kanban.cardume.msgs.dados.d1.ts;
  const enc = { c: 'dados', m: 'd1', de: 'ana', ts: ts0, n: 'Dados' };
  for (const c of CANAIS) {
    assert.equal(up(A.comum, {
      [`kanban/cardume/msgs/${c}/f1`]: { uid: 'ana', ts: t, texto: 'aviso da squad', enc },
      [`kanban/cardume/ultima/${c}`]: { ts: t, uid: 'ana', id: 'f1' },
    }), false, `conta comum NÃO encaminha para ${c}`);
    assert.equal(up(A.forjado, {
      [`kanban/cardume/msgs/${c}/f2`]: { uid: 'bru', ts: t, texto: 'aviso da squad', enc },
      [`kanban/cardume/ultima/${c}`]: { ts: t, uid: 'bru', id: 'f2' },
    }), false, `membro forjado NÃO encaminha para ${c}`);
    assert.equal(up(A.adm, {
      [`kanban/cardume/msgs/${c}/f3`]: { uid: 'adm', ts: t, texto: 'aviso da squad', enc },
      [`kanban/cardume/ultima/${c}`]: { ts: t, uid: 'adm', id: 'f3' },
    }), true, `ADM encaminha para ${c}`);
  }
});

test('📢 Geral e #oceano: ninguém (nem ADM nem PO) grava em canais, membros, admins, abertos ou meus para eles', () => {
  reset();
  for (const c of CANAIS) {
    for (const k of ['comum', 'adm', 'caio', 'pog']) {
      assert.equal(grava(`kanban/cardume/canais/${c}`, A[k], { nome: c }), false, `${k} canais/${c}`);
      assert.equal(grava(`kanban/cardume/membros/${c}/${A[k].uid}`, A[k], true), false, `${k} membros/${c}`);
      assert.equal(grava(`kanban/cardume/admins/${c}/${A[k].uid}`, A[k], true), false, `${k} admins/${c}`);
      assert.equal(grava(`kanban/cardume/abertos/${c}`, A[k], { nome: c }), false, `${k} abertos/${c}`);
      assert.equal(grava(`kanban/cardume/meus/${A[k].uid}/${c}`, A[k], true), false, `${k} meus/${c}`);
    }
  }
});

test('📢 Geral e #oceano: conta comum continua podendo marcar lidas/lidas_a próprias', () => {
  reset(); const t = Date.now();
  for (const c of CANAIS) {
    assert.equal(grava(`kanban/cardume/lidas/ana/${c}`, A.comum, t), true, `lidas em ${c}`);
    assert.equal(grava(`kanban/cardume/lidas_a/ana/${c}/_geral`, A.comum, t), true, `lidas_a em ${c}`);
  }
});

test('📢 controle: canais de squad e Minhas notas continuam com as mesmas regras', () => {
  reset();
  assert.equal(lê('kanban/cardume/msgs/dados', A.comum), true, 'membro lê dados');
  assert.equal(lê('kanban/cardume/msgs/dados', A.adm), true, 'ADM lê dados');
  assert.equal(lê('kanban/cardume/msgs/eu-ana', A.adm), false, 'ADM continua sem ler Minhas notas da Ana');
});
