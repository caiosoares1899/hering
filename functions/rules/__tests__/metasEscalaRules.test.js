// functions/rules/__tests__/metasEscalaRules.test.js
//
// Regras novas de 2026-10-12 — 🗓️ Escala (kanban/escala/{data}/{squad}/{uid}) e 🐟 Metas e desafios (kanban/metas_digital[_dev], metas_squads[_dev], metas_log[_dev]).
// Avaliadas pelo simulador (rulesSim.js: .read/.write com a cascata do Firebase + .validate do nó escrito e descendentes) sobre as expressões REAIS do database.rules.json.
// O projeto não tem emulador — este teste é o que impede publicar (firebase deploy --only database) uma regra que nega o que o app faz, ou libera o que não devia.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { check, validate } = require('../rulesSim');

const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database.rules.json'), 'utf8'));
const mk = (uid, email, prov) => ({ uid, token: { email, firebase: { sign_in_provider: prov || 'google.com' } } });
const A = {
  forasteiro: mk('out1', 'qualquer@gmail.com'),
  ana: mk('ana', 'ana@ciahering.com.br'),              // membro da squad dev
  bia: mk('bia', 'bia@ciahering.com.br'),              // membro de OUTRA squad (dados)
  pau: mk('pau', 'pau@ciahering.com.br'),              // PO da squad dev (squads_roles.dev = po)
  olga: mk('olga', 'olga@ciahering.com.br'),           // Organizadora da dev
  lia: mk('lia', 'lia@ciahering.com.br'),              // 'po' GLOBAL (role) sem squads_roles da dev, mas é PO só da squad dados
  adm: mk('adm', 'adm@ciahering.com.br'),              // role adm
  caio: mk('caio', 'caio.soares@ciahering.com.br'),
  arezzo: mk('az1', 'x@arezzo.com.br', 'microsoft.com'),
};
const DB = { kanban: { usuarios: {
  ana: { role: 'membro', squads: { dev: true }, squads_roles: { dev: 'membro' } },
  bia: { role: 'membro', squads: { dados: true }, squads_roles: { dados: 'membro' } },
  pau: { role: 'membro', squads: { dev: true }, squads_roles: { dev: 'po' } },
  olga: { role: 'membro', squads: { dev: true }, squads_roles: { dev: 'organizador' } },
  lia: { role: 'po', squads: { dados: true }, squads_roles: { dados: 'po' } },
  adm: { role: 'adm' },
} } };
const pode = (op, p, ator, val) => check(RULES, DB, op, p, ator, val) && (op === 'read' || validate(RULES, DB, p, ator, val));

// ═══════════════ 🗓️ ESCALA ═══════════════
const ESC = (uid, o) => Object.assign({ t: 'trab', por: uid, ts: 1760000000000 }, o || {});
const E = 'kanban/escala/2026-11-27/dev/ana';   // a entrada da Ana na squad dev
test('Escala: leitura só pra conta Google @ciahering', () => {
  ['ana', 'bia', 'pau', 'adm', 'caio'].forEach(k => assert.equal(check(RULES, DB, 'read', 'kanban/escala', A[k]), true, k));
  ['forasteiro', 'arezzo'].forEach(k => assert.equal(check(RULES, DB, 'read', 'kanban/escala', A[k]), false, k));
  assert.equal(check(RULES, DB, 'read', 'kanban/escala/2026-11-27', A.ana), true);
});
test('Escala: a pessoa grava a PRÓPRIA entrada na squad dela — e só nela', () => {
  assert.equal(pode('write', E, A.ana, ESC('ana')), true);
  assert.equal(pode('write', 'kanban/escala/2026-11-27/dev/bia', A.ana, ESC('ana')), false, 'entrada de outra pessoa');
  assert.equal(pode('write', 'kanban/escala/2026-11-27/dados/ana', A.ana, ESC('ana')), false, 'squad onde ela não está inscrita');
  assert.equal(pode('write', 'kanban/escala/2026-11-27/dev/bia', A.bia, ESC('bia')), false, 'bia não é da dev');
  assert.equal(pode('write', E, A.forasteiro, ESC('out1')), false);
  assert.equal(pode('write', E, A.arezzo, ESC('az1')), false);
});
test('Escala: PO/Organizador DA SQUAD, ADM e o e-mail fixo gravam pelos outros; PO de outra squad não', () => {
  assert.equal(pode('write', E, A.pau, ESC('pau')), true, 'PO da dev');
  assert.equal(pode('write', E, A.olga, ESC('olga')), true, 'Organizadora da dev');
  assert.equal(pode('write', E, A.adm, ESC('adm')), true, 'ADM');
  assert.equal(pode('write', E, A.caio, ESC('caio')), true, 'e-mail fixo');
  assert.equal(pode('write', E, A.bia, ESC('bia')), false, 'membro de outra squad');
});
test('Escala: papel por squad vence o role global (PO global que é membro nesta squad não vira gestor)', () => {
  const db = JSON.parse(JSON.stringify(DB)); db.kanban.usuarios.lia.squads_roles.dev = 'membro';   // squads_roles da dev existe e é 'membro'
  assert.equal(check(RULES, db, 'write', E, A.lia, ESC('lia')) && validate(RULES, db, E, A.lia, ESC('lia')), false);
  const db2 = JSON.parse(JSON.stringify(DB)); db2.kanban.usuarios.lia.squads_roles = {};   // sem squads_roles: o role global ('po') vale (compatibilidade)
  assert.equal(check(RULES, db2, 'write', E, A.lia, ESC('lia')) && validate(RULES, db2, E, A.lia, ESC('lia')), true);
});
test('Escala: apagar (null) segue a mesma permissão de gravar', () => {
  assert.equal(pode('write', E, A.ana, null), true);
  assert.equal(pode('write', 'kanban/escala/2026-11-27/dev/bia', A.ana, null), false);
  assert.equal(pode('write', 'kanban/escala/2026-11-27/dev/bia', A.pau, null), true);
});
test('Escala: validação do formato (tipo, horário, observação, autor, data, campo extra)', () => {
  const ok = o => pode('write', E, A.ana, ESC('ana', o));
  assert.equal(ok(), true);
  ['trab', 'plant', 'folga'].forEach(t => assert.equal(ok({ t }), true, t));
  assert.equal(ok({ t: 'ferias' }), false, 'tipo desconhecido');
  assert.equal(ok({ i: '09:00', f: '18:30' }), true);
  assert.equal(ok({ i: '9:00' }), false); assert.equal(ok({ i: '24:00' }), false); assert.equal(ok({ f: '12:60' }), false); assert.equal(ok({ i: 900 }), false);
  assert.equal(ok({ n: 'sobreaviso até 23h' }), true);
  assert.equal(ok({ n: 'x'.repeat(141) }), false); assert.equal(ok({ n: 'x'.repeat(140) }), true);
  assert.equal(ok({ por: 'bia' }), false, 'autor tem que ser quem grava');
  assert.equal(ok({ ts: 'ontem' }), false);
  assert.equal(ok({ extra: 1 }), false, 'campo extra');
  assert.equal(pode('write', 'kanban/escala/27-11-2026/dev/ana', A.ana, ESC('ana')), false, 'data fora do formato AAAA-MM-DD');
  assert.equal(pode('write', 'kanban/escala/2026-11-27/dev/ana', A.ana, { t: 'trab' }), false, 'sem por/ts');
});
test('Escala: pausas no meio do dia (campo p: até 3 intervalos saída-volta)', () => {
  const ok = o => pode('write', E, A.ana, ESC('ana', o));
  assert.equal(ok({ i: '09:00', f: '18:00', p: '12:00-13:00' }), true);
  assert.equal(ok({ i: '09:00', f: '18:00', p: '10:30-10:45;12:00-13:00;15:00-15:15' }), true, '3 pausas');
  assert.equal(ok({ p: '10:30-10:45;12:00-13:00;15:00-15:15;16:00-16:10' }), false, '4 pausas passam do limite');
  assert.equal(ok({ p: '12:00' }), false); assert.equal(ok({ p: '12:00-25:00' }), false); assert.equal(ok({ p: '12:00-13:00;' }), false); assert.equal(ok({ p: 5 }), false); assert.equal(ok({ p: '12h-13h' }), false);
});
test('Escala: gravação em lote (update por vários dias) segue valendo dia a dia', () => {
  ['2026-11-26', '2026-11-27', '2026-11-28'].forEach(d => assert.equal(pode('write', `kanban/escala/${d}/dev/ana`, A.ana, ESC('ana')), true, d));
});

// ═══════════════ 🐟 METAS ═══════════════
const META = o => Object.assign({ titulo: 'Black Friday — Site', tipo: 'meta', fmt: 'brl', alvo: 2000000, inicial: 0, atual: 840000, ativo: true }, o || {});
const SFXS = ['', '_dev'];
test('Metas: leitura só pra @ciahering (digital, squads e histórico, em produção e dev)', () => {
  SFXS.forEach(s => ['metas_digital', 'metas_squads', 'metas_log'].forEach(n => {
    assert.equal(check(RULES, DB, 'read', `kanban/${n}${s}`, A.ana), true, n + s);
    assert.equal(check(RULES, DB, 'read', `kanban/${n}${s}`, A.forasteiro), false, n + s);
    assert.equal(check(RULES, DB, 'read', `kanban/${n}${s}`, A.arezzo), false, n + s);
  }));
  assert.equal(check(RULES, DB, 'read', 'kanban/metas_squads_dev/dev', A.ana), true, 'uma squad só');
});
test('Metas das squads: grava quem é da squad, PO/Organizador, ADM — não membro de outra squad nem forasteiro', () => {
  SFXS.forEach(s => {
    const p = `kanban/metas_squads${s}/dev/m1`;
    assert.equal(pode('write', p, A.ana, META()), true, 'membro da dev' + s);
    assert.equal(pode('write', p, A.pau, META()), true, 'PO da dev' + s);
    assert.equal(pode('write', p, A.olga, META()), true, 'Organizadora da dev' + s);
    assert.equal(pode('write', p, A.adm, META()), true, 'ADM' + s);
    assert.equal(pode('write', p, A.caio, META()), true, 'e-mail fixo' + s);
    assert.equal(pode('write', p, A.bia, META()), false, 'membro de outra squad' + s);
    assert.equal(pode('write', p, A.forasteiro, META()), false, 'forasteiro' + s);
    assert.equal(pode('write', p, A.arezzo, META()), false, 'conta Microsoft' + s);
    assert.equal(pode('write', p, A.ana, null), true, 'excluir (membro) ' + s);
    assert.equal(pode('write', p, A.bia, null), false, 'excluir (outra squad) ' + s);
  });
});
test('Metas das squads: atualizar só o valor (update de campos) funciona — é o que "Atualizar valor" faz', () => {
  const base = 'kanban/metas_squads_dev/dev/m1';
  const db = JSON.parse(JSON.stringify(DB)); db.kanban.metas_squads_dev = { dev: { m1: META() } };
  const w = (p, v, ator) => check(RULES, db, 'write', p, ator, v) && validate(RULES, db, p, ator, v);
  assert.equal(w(base + '/atual', 1250000, A.ana), true);
  assert.equal(w(base + '/marco', 60, A.ana), true);
  assert.equal(w(base + '/atualizadoNome', 'Ana Lima', A.ana), true);
  assert.equal(w(base + '/atual', 'muito', A.ana), false, 'valor não numérico');
  assert.equal(w(base + '/atual', 5, A.bia), false, 'outra squad');
  assert.equal(w(base + '/ativo', false, A.pau), true, 'desativar');
});
test('Metas: validação do formato (título, alvo, tipo, formato, valor)', () => {
  const p = 'kanban/metas_squads_dev/dev/m1', ok = o => pode('write', p, A.ana, META(o));
  assert.equal(ok(), true);
  assert.equal(ok({ titulo: '' }), false); assert.equal(ok({ titulo: 'x'.repeat(101) }), false);
  assert.equal(ok({ alvo: 'mil' }), false);
  assert.equal(ok({ tipo: 'sonho' }), false); assert.equal(ok({ tipo: 'desafio' }), true);
  assert.equal(ok({ fmt: 'eur' }), false); ['brl', 'num', 'pct'].forEach(f => assert.equal(ok({ fmt: f }), true, f));
  assert.equal(ok({ atual: '10' }), false); assert.equal(ok({ atual: undefined }), true, 'sem valor ainda');
  assert.equal(pode('write', p, A.ana, { titulo: 'só título' }), false, 'faltam campos obrigatórios');
});
test('Metas do Digital: qualquer @ciahering grava (a tela restringe a ADM/editores de Dados — mesmo padrão de dados_diarios); forasteiro não', () => {
  SFXS.forEach(s => {
    const p = `kanban/metas_digital${s}/g1`;
    assert.equal(pode('write', p, A.ana, META()), true, s); assert.equal(pode('write', p, A.adm, META()), true, s);
    assert.equal(pode('write', p, A.forasteiro, META()), false, s); assert.equal(pode('write', p, A.arezzo, META()), false, s);
    assert.equal(pode('write', p, A.ana, META({ fmt: 'x' })), false, 'validação vale também aqui');
  });
});
test('Metas: histórico dos valores (metas_log) exige v e t numéricos', () => {
  SFXS.forEach(s => {
    const p = `kanban/metas_log${s}/m1/00000001760000000000_abc`;
    assert.equal(pode('write', p, A.ana, { v: 840000, t: 1760000000000, nome: 'Ana' }), true, s);
    assert.equal(pode('write', p, A.ana, { v: 'x', t: 1 }), false, s); assert.equal(pode('write', p, A.ana, { v: 1 }), false, s);
    assert.equal(pode('write', p, A.forasteiro, { v: 1, t: 1 }), false, s);
  });
});
test('regras: os nós de dev e de produção das Metas têm exatamente o mesmo formato (só muda o sufixo)', () => {
  ['metas_digital', 'metas_squads', 'metas_log'].forEach(n => assert.deepEqual(RULES.rules.kanban[n + '_dev'], RULES.rules.kanban[n], n));
});
