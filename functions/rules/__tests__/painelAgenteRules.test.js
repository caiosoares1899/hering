// functions/rules/__tests__/painelAgenteRules.test.js
//
// Regras do chat do 🤖 Agente Ágil no Painel (docs/AGENTE_AGIL_PAINEL.md §5 e §6): kanban/agente_painel[_dev]/{uid}/{msgId}.
// A promessa é "conversa PRIVADA por pessoa". O risco que este teste existe para impedir: kanban/painel libera `.read` a visualizadores
// EXTERNOS e `.write` a qualquer interno, e no Realtime Database a permissão de um nó pai vale para os filhos (não dá para retirá-la no
// filho) — por isso o chat NÃO pode morar em kanban/painel e `kanban/` em si não pode ter regra de leitura/escrita.
//   • só o DONO lê o próprio nó; outro interno, o ADM, o visualizador externo, conta de fora e quem não logou NÃO leem;
//   • só o dono cria mensagem no próprio nó, com role 'user' e texto de 1 a 2000 caracteres; nunca a resposta do agente (role 'agente');
//   • *_processed (idempotência do gatilho) é só do servidor (Admin SDK ignora regras).
// Mudou as regras? `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { check, validate } = require('../rulesSim');

const ROOT = path.join(__dirname, '..', '..', '..');
const RULES = JSON.parse(fs.readFileSync(path.join(ROOT, 'database.rules.json'), 'utf8'));
const mk = (uid, email, prov) => ({ uid, token: { email, firebase: { sign_in_provider: prov } } });
const A = {
  dono: mk('int1', 'a@ciahering.com.br', 'google.com'),
  outro: mk('int2', 'b@ciahering.com.br', 'google.com'),
  adm: mk('adm1', 'adm@ciahering.com.br', 'google.com'),
  caio: mk('caio', 'caio.soares@ciahering.com.br', 'google.com'),
  forasteiro: mk('out1', 'qualquer@gmail.com', 'google.com'),
  arezzo: mk('az1', 'b@arezzo.com.br', 'microsoft.com'),
  visualizador: mk('v1', 'viewer@gmail.com', 'google.com'),
  semLogin: null,
};
const DB = { kanban: {
  usuarios: { int1: { role: 'membro' }, int2: { role: 'membro' }, adm1: { role: 'adm' }, caio: { role: 'membro' } },
  painel_viewers: { 'viewer@gmail,com': true },
  agente_painel: { int1: { m1: { role: 'user', text: 'oi', ts: '2026-11-06T10:00:00.000Z' }, m2: { role: 'agente', text: 'olá', ts: '2026-11-06T10:00:05.000Z' } } },
  agente_painel_dev: { int1: { m1: { role: 'user', text: 'oi', ts: '2026-11-06T10:00:00.000Z' } } },
} };
const msg = (extra) => Object.assign({ role: 'user', text: 'onde está o gargalo?', ts: '2026-11-06T10:00:00.000Z', ctx: { aba: 'fluxo', filtro: 'ger-digital', periodo: 15 } }, extra || {});
const le = (ator, p) => check(RULES, DB, 'read', p, A[ator]);
const grava = (ator, p, val) => check(RULES, DB, 'write', p, A[ator], val) && validate(RULES, DB, p, A[ator], val);
const NOS = ['agente_painel', 'agente_painel_dev'];

test('o pai NÃO é permissivo: kanban/ e kanban/painel não podem cobrir o chat (a herança de regra vazaria a conversa)', () => {
  assert.equal(RULES.rules.kanban['.read'], undefined, 'kanban/ não pode ter .read (vazaria TODOS os filhos)');
  assert.equal(RULES.rules.kanban['.write'], undefined, 'kanban/ não pode ter .write');
  for (const n of NOS) assert.equal(String(RULES.rules.kanban[n]['.read']), 'false', `${n}: leitura no nível do nó tem de ser false (só o filho $uid libera)`);
});

test('LER: só o dono lê a própria conversa — outro interno, o ADM, o visualizador externo, conta de fora e sem login não leem', () => {
  for (const n of NOS) {
    assert.equal(le('dono', `kanban/${n}/int1`), true, 'dono deve ler');
    assert.equal(le('dono', `kanban/${n}/int1/m1`), true, 'dono lê cada mensagem');
    for (const ator of ['outro', 'adm', 'caio', 'forasteiro', 'arezzo', 'visualizador', 'semLogin']) {
      assert.equal(le(ator, `kanban/${n}/int1`), false, `${ator} NÃO deve ler o nó de int1 (${n})`);
      assert.equal(le(ator, `kanban/${n}/int1/m1`), false, `${ator} NÃO deve ler a mensagem de int1 (${n})`);
    }
    for (const ator of ['dono', 'outro', 'adm', 'visualizador', 'forasteiro']) assert.equal(le(ator, `kanban/${n}`), false, `${ator} NÃO lista todos os usuários (${n})`);
  }
});

test('ESCREVER: só o dono cria mensagem no próprio nó; ninguém escreve no nó de outra pessoa (nem o ADM)', () => {
  for (const n of NOS) {
    assert.equal(grava('dono', `kanban/${n}/int1/m9`, msg()), true, 'dono cria no próprio nó');
    for (const ator of ['outro', 'adm', 'caio', 'forasteiro', 'arezzo', 'visualizador', 'semLogin']) assert.equal(grava(ator, `kanban/${n}/int1/m9`, msg()), false, `${ator} NÃO escreve no nó de int1 (${n})`);
    assert.equal(grava('dono', `kanban/${n}/int2/m9`, msg()), false, 'dono NÃO escreve no nó do outro uid');
    assert.equal(grava('visualizador', `kanban/${n}/v1/m9`, msg()), false, 'visualizador externo NÃO escreve nem no próprio caminho');
    assert.equal(grava('forasteiro', `kanban/${n}/out1/m9`, msg()), false, 'conta de fora NÃO escreve nem no próprio caminho');
  }
});

test('VALIDAR: a mensagem do cliente é sempre role "user", texto de 1 a 2000 caracteres, sem campos extras', () => {
  const p = 'kanban/agente_painel/int1/m9';
  assert.equal(grava('dono', p, msg({ role: 'agente' })), false, 'o cliente NÃO se passa pelo agente');
  assert.equal(grava('dono', p, msg({ role: 'system' })), false);
  assert.equal(grava('dono', p, msg({ text: '' })), false, 'texto vazio');
  assert.equal(grava('dono', p, msg({ text: 'x'.repeat(2001) })), false, 'texto > 2000');
  assert.equal(grava('dono', p, msg({ text: 'x'.repeat(2000) })), true, 'texto no limite passa');
  assert.equal(grava('dono', p, msg({ text: 42 })), false, 'texto não-string');
  assert.equal(grava('dono', p, msg({ ts: 123 })), false, 'ts não-string');
  assert.equal(grava('dono', p, Object.assign(msg(), { extra: 'x' })), false, 'campo extra');
  assert.equal(grava('dono', p, msg({ ctx: { aba: 'fluxo', hack: 1 } })), false, 'campo extra no contexto');
  assert.equal(grava('dono', p, msg({ ctx: { aba: 'x'.repeat(31) } })), false, 'aba longa');
  assert.equal(grava('dono', p, msg({ ctx: { aba: 'fluxo', periodo: 365 } })), false, 'período fora de 1..90');
  assert.equal(grava('dono', p, msg({ ctx: { filtro: 'ger-digital' } })), false, 'contexto sem aba');
  assert.equal(grava('dono', p, { role: 'user', text: 'oi', ts: '2026-11-06T10:00:00.000Z' }), true, 'sem contexto é válido');
});

test('NÃO reescreve o que já existe (inclusive a resposta do agente) e o dono pode apagar a própria conversa', () => {
  assert.equal(grava('dono', 'kanban/agente_painel/int1/m1', msg({ text: 'editado' })), false, 'o dono não edita mensagem já gravada');
  assert.equal(grava('dono', 'kanban/agente_painel/int1/m2', msg({ text: 'forjado' })), false, 'o dono não reescreve a resposta do agente');
  assert.equal(check(RULES, DB, 'write', 'kanban/agente_painel/int1/m1', A.dono, null), true, 'o dono pode apagar a própria mensagem');
  assert.equal(check(RULES, DB, 'write', 'kanban/agente_painel/int1/m1', A.adm, null), false, 'o ADM não apaga a conversa alheia');
});

test('*_processed e *_uso (cota diária): ninguém lê nem escreve pelo cliente (só o Admin SDK do gatilho)', () => {
  for (const n of ['agente_painel_processed', 'agente_painel_processed_dev', 'agente_painel_uso', 'agente_painel_uso_dev']) {
    for (const ator of ['dono', 'outro', 'adm', 'caio', 'visualizador', 'forasteiro', 'semLogin']) {
      assert.equal(le(ator, `kanban/${n}/int1/m1`), false, `${ator} NÃO lê ${n}`);
      assert.equal(grava(ator, `kanban/${n}/int1/m1`, true), false, `${ator} NÃO escreve ${n}`);
    }
  }
});

test('regressão: kanban/painel continua como era (visualizador lê, interno escreve) — o chat é que ficou fora dele', () => {
  assert.equal(check(RULES, DB, 'read', 'kanban/painel/qualquer', A.visualizador), true);
  assert.equal(check(RULES, DB, 'write', 'kanban/painel/qualquer', A.outro, { x: 1 }), true);
  assert.equal(check(RULES, DB, 'write', 'kanban/painel/qualquer', A.forasteiro, { x: 1 }), false);
});

// ── Interruptores do agente (kanban/config/agente_agil_orquestrador) ──
// kanban/config/$outro tinha `.write` para QUALQUER conta @ciahering: qualquer interno ligava o agente, abria o acesso para "todos" ou subia a cota (e isso valia também para o
// kill switch geral, que só o Console escrevia na prática). Agora só ADM escreve esse nó, e o nó foi tirado do curinga para a regra frouxa não se somar à do ADM.
const CFG = 'kanban/config/agente_agil_orquestrador';
const DBC = { kanban: { usuarios: { int1: { role: 'membro' }, int2: { role: 'membro' }, po1: { role: 'po' }, adm1: { role: 'adm' }, caio: { role: 'membro' } }, painel_viewers: { 'viewer@gmail,com': true }, config: { agente_agil_orquestrador: { enabled: true } } } };
const AC = Object.assign({}, A, { po: mk('po1', 'p@ciahering.com.br', 'google.com') });
const gc = (ator, p, val) => check(RULES, DBC, 'write', p, AC[ator], val) && validate(RULES, DBC, p, AC[ator], val);

test('INTERRUPTORES: só ADM liga/desliga o agente, muda o acesso e a cota — membro, PO, visualizador, conta de fora e sem login NÃO', () => {
  for (const campo of ['painel_enabled', 'painel_acesso', 'painel_limite_dia', 'enabled', 'model_tier_override']) {
    const val = campo === 'painel_enabled' || campo === 'enabled' ? true : campo === 'painel_acesso' ? 'todos' : campo === 'painel_limite_dia' ? 500 : 'opus';
    for (const ator of ['dono', 'outro', 'po', 'forasteiro', 'arezzo', 'visualizador', 'semLogin']) assert.equal(gc(ator, `${CFG}/${campo}`, val), false, `${ator} NÃO deve escrever ${campo}`);
    for (const ator of ['adm', 'caio']) assert.equal(gc(ator, `${CFG}/${campo}`, val), true, `${ator} deve escrever ${campo}`);
  }
  assert.equal(gc('dono', CFG, { enabled: true, painel_enabled: true }), false, 'nem o nó inteiro de uma vez');
});

test('INTERRUPTORES: valores inválidos são recusados até para o ADM (booleano, lista fechada, cota de 1 a 500)', () => {
  assert.equal(gc('adm', `${CFG}/painel_enabled`, 'true'), false, 'string "true" não liga');
  assert.equal(gc('adm', `${CFG}/painel_acesso`, 'qualquer'), false);
  assert.equal(gc('adm', `${CFG}/painel_acesso`, 'gestores'), true);
  assert.equal(gc('adm', `${CFG}/painel_limite_dia`, 0), false);
  assert.equal(gc('adm', `${CFG}/painel_limite_dia`, 501), false);
  assert.equal(gc('adm', `${CFG}/painel_limite_dia`, 30), true);
});

test('INTERRUPTORES: leitura continua como era e os OUTROS nós de config continuam abertos a qualquer interno (regressão)', () => {
  for (const ator of ['dono', 'adm', 'visualizador']) assert.equal(check(RULES, DBC, 'read', `${CFG}/painel_enabled`, AC[ator]), true, `${ator} lê (a gaveta precisa ler)`);
  for (const ator of ['forasteiro', 'arezzo', 'semLogin']) assert.equal(check(RULES, DBC, 'read', `${CFG}/painel_enabled`, AC[ator]), false);
  assert.equal(gc('dono', 'kanban/config/qualquer_outro', { x: 1 }), true, 'config comum segue aberto a internos');
  assert.equal(gc('forasteiro', 'kanban/config/qualquer_outro', { x: 1 }), false);
  assert.equal(gc('dono', 'kanban/config/adm_emails', ['x']), false, 'adm_emails continua só ADM');
});
