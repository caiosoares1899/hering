// functions/rules/__tests__/conchaNotasRules.test.js
//
// 📝 Minhas notas (26/11/2026) — o canal só seu da Concha: id `eu-{uid}`, terceiro tipo de canal (nem oficial, nem temático).
// Decisões do Caio: NINGUÉM além da dona lê (nem o ADM, nem o e-mail do Caio); vem desativado (kanban/cardume/notas/{uid} = true liga).
// A dona é membro e gestora PELO ID — `membros/eu-*` forjado não dá acesso; ninguém grava canais/admins/membros/abertos/tags/tags_ult/meus
// de uma nota. Matriz gerada do próprio JSON: um nó novo com $canal sem a guarda quebra este teste.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { check, validate, update } = require('../rulesSim');

const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database.rules.json'), 'utf8'));
const mk = (uid, email) => ({ uid, token: { email, firebase: { sign_in_provider: 'google.com' } } });
const A = {
  ana: mk('ana', 'ana@ciahering.com.br'),                 // a dona de eu-ana
  adm: mk('adm', 'adm@ciahering.com.br'),                 // ADM por papel
  caio: mk('cai', 'caio.soares@ciahering.com.br'),        // e-mail do Caio (exceção do ADM)
  pog: mk('pog', 'pog@ciahering.com.br'),                 // PO global que se marcou "PO da squad eu-ana" no próprio cadastro
  bru: mk('bru', 'bru@ciahering.com.br'),                 // membro de dados, com membros/eu-ana/bru forjado no banco
  gil: mk('gil', 'gil@ciahering.com.br'),                 // outra conta qualquer
};
const N = 'eu-ana';
let DB;
const reset = () => { DB = { kanban: {
  usuarios: { adm: { role: 'adm' }, ana: { role: 'membro', squads: { dados: true } }, bru: { role: 'membro', squads: { dados: true } },
    pog: { role: 'po', squads: { [N]: true }, squads_roles: { [N]: 'po' } }, gil: { role: 'membro' } },
  cardume: {
    canais: { dados: { nome: 'Dados' } },
    membros: { dados: { ana: true, bru: true }, [N]: { bru: true } },   // o registro forjado (não pode dar acesso)
    msgs: { dados: { d1: { uid: 'bru', ts: Date.now() - 864e5, texto: 'link útil' } }, [N]: { n1: { uid: 'ana', ts: Date.now() - 1000, texto: 'minha nota' } } },
    ultima: { [N]: { ts: Date.now() - 1000, uid: 'ana', id: 'n1' } },
    fixadas: { [N]: { n1: { por: 'ana', em: Date.now() - 500, t: 'topo' } } },
    assuntos: { [N]: { alinks: { n: 'Links', por: 'ana', ts: Date.now() - 2000 } } },
    reacoes: { [N]: { n1: { ana: '👍' } } },
  },
} }; };
const lê = (p, ator) => check(RULES, DB, 'read', p, ator);
const grava = (p, ator, val) => check(RULES, DB, 'write', p, ator, val) && validate(RULES, DB, p, ator, val);
const NOS = Object.keys(RULES.rules.kanban.cardume).filter(k => RULES.rules.kanban.cardume[k] && RULES.rules.kanban.cardume[k].$canal);
const OUTROS = ['adm', 'caio', 'pog', 'bru', 'gil'];

test('📝 notas: a matriz cobre todos os nós com $canal da Concha', () => {
  for (const n of ['canais', 'admins', 'membros', 'msgs', 'ultima', 'abertos', 'reacoes', 'tags', 'tags_ult', 'assuntos', 'ultima_a', 'fixadas']) assert.ok(NOS.includes(n), 'nó ' + n);
});

test('📝 notas: ninguém além da dona LÊ nenhum nó das notas (nem ADM, nem o e-mail do Caio, nem PO forjado, nem membro forjado)', () => {
  reset();
  // `abertos` é a lista pública dos temáticos abertos (lida por toda a Hering); uma nota nunca entra nela (escrita negada abaixo)
  for (const n of NOS.filter(x => x !== 'abertos')) for (const k of OUTROS) assert.equal(lê(`kanban/cardume/${n}/${N}`, A[k]), false, `${k} lê ${n}/${N}`);
  for (const n of ['msgs', 'ultima', 'fixadas', 'assuntos', 'reacoes']) assert.equal(lê(`kanban/cardume/${n}/${N}`, A.ana), true, 'a dona lê ' + n);
  assert.equal(lê(`kanban/cardume/msgs/${N}/n1`, A.adm), false, 'nem uma nota solta');
});

test('📝 notas: ninguém além da dona GRAVA em nó nenhum das notas', () => {
  reset();
  const val = { msgs: { uid: 'X', ts: Date.now(), texto: 'oi' }, fixadas: { por: 'X', em: Date.now(), t: 'topo' }, assuntos: { n: 'A', por: 'X', criado: Date.now() } };
  for (const n of NOS) for (const k of OUTROS) {
    const v = n in val ? Object.assign({}, val[n], val[n].uid ? { uid: A[k].uid } : {}, val[n].por ? { por: A[k].uid } : {}) : true;
    assert.equal(grava(`kanban/cardume/${n}/${N}/z${k}`, A[k], v), false, `${k} grava em ${n}/${N}`);
    assert.equal(grava(`kanban/cardume/${n}/${N}`, A[k], null), false, `${k} apaga ${n}/${N} inteiro`);
  }
  assert.equal(grava(`kanban/cardume/msgs/${N}/n1`, A.adm, { uid: 'ana', ts: DB.kanban.cardume.msgs[N].n1.ts, apagada: true }), false, 'nem o ADM apaga uma nota (moderação não vale aqui)');
  assert.equal(grava(`kanban/cardume/msgs/${N}/n1`, A.adm, null), false, 'nem remove');
});

test('📝 notas: a dona escreve, fixa, cria assunto e reage — sem precisar de membros/canais', () => {
  reset(); const t = Date.now();
  assert.equal(update(RULES, DB, A.ana, { [`kanban/cardume/msgs/${N}/n2`]: { uid: 'ana', ts: t, texto: 'outra nota' }, [`kanban/cardume/ultima/${N}`]: { ts: t, uid: 'ana', id: 'n2' } }), true, 'nova nota + ultima');
  DB.kanban.cardume.msgs[N].n2 = { uid: 'ana', ts: t, texto: 'outra nota' };
  assert.equal(grava(`kanban/cardume/fixadas/${N}/n2`, A.ana, { por: 'ana', em: Date.now(), t: 'regra' }), true, 'a dona fixa (é a gestora)');
  assert.equal(grava(`kanban/cardume/assuntos/${N}/aideias`, A.ana, { n: 'Ideias', por: 'ana', criado: Date.now() }), true, 'cria assunto');
  assert.equal(grava(`kanban/cardume/reacoes/${N}/n2/ana`, A.ana, '✅'), true, 'reage à própria nota');
  assert.equal(grava(`kanban/cardume/msgs/eu-gil/x1`, A.ana, { uid: 'ana', ts: Date.now(), texto: 'intrusa' }), false, 'não escreve nas notas de outra pessoa');
});

test('📝 notas: nem a dona grava o cadastro do canal, membros, admins, abertos, #tags ou o espelho "meus"', () => {
  reset();
  assert.equal(grava(`kanban/cardume/canais/${N}`, A.ana, { nome: 'Minhas notas' }), false, 'canais');
  assert.equal(grava(`kanban/cardume/canais/${N}`, A.adm, { nome: 'Minhas notas' }), false, 'canais (nem o ADM "ativa" a nota de alguém)');
  assert.equal(update(RULES, DB, A.ana, { [`kanban/cardume/membros/${N}/ana`]: true, [`kanban/cardume/meus/ana/${N}`]: true }), false, 'membros + meus');
  assert.equal(grava(`kanban/cardume/membros/${N}/gil`, A.adm, true), false, 'ADM não põe ninguém');
  assert.equal(grava(`kanban/cardume/membros/${N}/pog`, A.pog, true), false, 'PO "da squad eu-ana" não se põe');
  assert.equal(grava(`kanban/cardume/tags/${N}/links/n1`, A.ana, Date.now()), false, 'sem #tags nas notas');
  assert.equal(grava(`kanban/cardume/tags_ult/${N}/links`, A.ana, Date.now()), false, 'sem #tags nas notas (tags_ult)');
});

test('📝 notas: encaminhar PARA as notas (só a dona); DAS notas não sai', () => {
  reset(); const t = Date.now(), ts0 = DB.kanban.cardume.msgs.dados.d1.ts;
  const enc = { c: 'dados', m: 'd1', de: 'bru', ts: ts0, n: 'Dados' };
  assert.equal(update(RULES, DB, A.ana, { [`kanban/cardume/msgs/${N}/f1`]: { uid: 'ana', ts: t, texto: 'link útil', enc }, [`kanban/cardume/ultima/${N}`]: { ts: t, uid: 'ana', id: 'f1' } }), true, 'a dona guarda nas notas');
  assert.equal(update(RULES, DB, A.bru, { [`kanban/cardume/msgs/${N}/f2`]: { uid: 'bru', ts: t, texto: 'link útil', enc }, [`kanban/cardume/ultima/${N}`]: { ts: t, uid: 'bru', id: 'f2' } }), false, 'outra pessoa não joga nas notas da Ana');
  const deNota = { c: N, m: 'n1', de: 'ana', ts: DB.kanban.cardume.msgs[N].n1.ts, n: 'Minhas notas' };
  assert.equal(update(RULES, DB, A.ana, { ['kanban/cardume/msgs/dados/f3']: { uid: 'ana', ts: t, texto: 'minha nota', enc: deNota }, ['kanban/cardume/ultima/dados']: { ts: t, uid: 'ana', id: 'f3' } }), false, 'das notas não se encaminha');
});

test('📝 notas: ativar é preferência privada (notas/{uid} = true)', () => {
  reset();
  assert.equal(grava('kanban/cardume/notas/ana', A.ana, true), true, 'liga');
  assert.equal(grava('kanban/cardume/notas/ana', A.ana, null), true, 'desliga');
  assert.equal(grava('kanban/cardume/notas/ana', A.ana, 'sim'), false, 'só true');
  assert.equal(grava('kanban/cardume/notas/gil', A.ana, true), false, 'não liga a de outra pessoa');
  assert.equal(lê('kanban/cardume/notas/ana', A.adm), false, 'ADM não lê');
});

test('📝 os canais de sempre continuam iguais (controle)', () => {
  reset();
  assert.equal(lê('kanban/cardume/msgs/dados', A.adm), true, 'ADM lê o canal da squad');
  assert.equal(lê('kanban/cardume/msgs/dados', A.bru), true, 'membro lê');
  assert.equal(lê('kanban/cardume/msgs/dados', A.gil), false, 'fora não lê');
});
