// functions/rules/__tests__/okrRules.test.js
//
// Regras de kanban/okr (Radar) — endurecidas em 2026-10-16. Antes havia UM `.write` para o nó inteiro: qualquer conta @ciahering
// escrevia em tudo, então "só o autor edita/apaga o comentário do Marco" e "só quem gere o OKR configura o Data Studio" eram
// restrições SÓ de tela (um console aberto passava por cima). Agora cada filho tem a sua regra:
//   marco_comments  → só o AUTOR cria/edita/apaga o próprio comentário; ADM (role 'adm' ou o e-mail do Caio) apaga o de qualquer um;
//                     apagar a conversa inteira (cascata ao excluir um Objetivo) só ADM — ou qualquer um se ela já está vazia.
//   datastudio      → ADM, PO, Organizador ou Gestor OKR (gestorOkr:true).
//   demais filhos   → como antes (qualquer conta Google @ciahering).
// LIMITE conhecido: a regra só enxerga `role` GLOBAL. Quem é PO/Organizador só dentro de uma squad (usuarios/{uid}/squads_roles)
// passa na tela, mas não aqui — a regra não consegue varrer um mapa. Se virar problema real, o caminho é um flag próprio (como gestorOkr).
// Mudou as regras? `npm test`. Criou um NÓ NOVO em kanban/okr? Declare-o em database.rules.json (o último teste falha se faltar).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { check, validate } = require('../rulesSim');

const ROOT = path.join(__dirname, '..', '..', '..');
const RULES = JSON.parse(fs.readFileSync(path.join(ROOT, 'database.rules.json'), 'utf8'));
const mk = (uid, email, prov) => ({ uid, token: { email, firebase: { sign_in_provider: prov } } });
const A = {
  membro: mk('int1', 'a@ciahering.com.br', 'google.com'),
  outro: mk('int2', 'b@ciahering.com.br', 'google.com'),
  po: mk('po1', 'p@ciahering.com.br', 'google.com'),
  org: mk('org1', 'o@ciahering.com.br', 'google.com'),
  gestor: mk('g1', 'g@ciahering.com.br', 'google.com'),
  adm: mk('adm1', 'adm@ciahering.com.br', 'google.com'),
  caio: mk('caio', 'caio.soares@ciahering.com.br', 'google.com'),
  forasteiro: mk('out1', 'qualquer@gmail.com', 'google.com'),
  arezzo: mk('az1', 'b@arezzo.com.br', 'microsoft.com'),
  visualizador: mk('v1', 'viewer@gmail.com', 'google.com'),
};
const cmt = (id, uid, extra) => Object.assign({ id, uid, author: 'Fulano', foto: '', text: 'olá', ts: '2026-10-14T10:00:00.000Z' }, extra || {});
const DB = { kanban: {
  usuarios: {
    int1: { role: 'membro' }, int2: { role: 'membro' }, po1: { role: 'po' }, org1: { role: 'organizador' },
    g1: { role: 'membro', gestorOkr: true }, adm1: { role: 'adm' }, caio: { role: 'membro' }, az1: { role: 'membro' },
  },
  painel_viewers: { 'viewer@gmail,com': true },
  okr: { marco_comments: { m1: { cA: cmt('cA', 'int1'), cB: cmt('cB', 'int2') } }, datastudio: { r1: { id: 'r1', titulo: 'Painel' } } },
} };
const pode = (ator, p, val) => check(RULES, DB, 'write', p, A[ator], val) && validate(RULES, DB, p, A[ator], val);
const lista = (...n) => n;

test('regressão: os nós comuns do Radar continuam abertos a qualquer conta @ciahering (e fechados a quem é de fora)', () => {
  const nos = ['objetivos/o1', 'objetivos/o1/tagIds', 'marcos/m1', 'marcos/m1/progresso', 'tags/t1', 'gerencias/g1', 'calendario/e1', 'agente_chat/c1',
    'agente_chat_processed/c1', 'reuniao_notas/d1', 'reuniao_agenda/d1', 'snapshots/s1', 'obj_locks/o1', 'mural/a1', 'apresentacao_live/x'];
  for (const n of nos) {
    for (const ator of lista('membro', 'po', 'adm', 'caio')) assert.equal(pode(ator, 'kanban/okr/' + n, { x: 1 }), true, `${ator} deveria escrever em okr/${n}`);
    for (const ator of lista('forasteiro', 'arezzo', 'visualizador')) assert.equal(pode(ator, 'kanban/okr/' + n, { x: 1 }), false, `${ator} NÃO deveria escrever em okr/${n}`);
  }
});

test('ler o OKR não mudou (conta @ciahering e visualizador cadastrado leem; de fora não)', () => {
  const le = (a) => check(RULES, DB, 'read', 'kanban/okr/objetivos', A[a]);
  assert.equal(le('membro'), true); assert.equal(le('visualizador'), true); assert.equal(le('forasteiro'), false); assert.equal(le('arezzo'), false);
});

test('comentário do Marco — criar: só em nome de si mesmo', () => {
  assert.equal(pode('membro', 'kanban/okr/marco_comments/m1/cN', cmt('cN', 'int1')), true);
  assert.equal(pode('membro', 'kanban/okr/marco_comments/m1/cN', cmt('cN', 'int2')), false, 'comentar como outra pessoa');
  assert.equal(pode('adm', 'kanban/okr/marco_comments/m1/cN', cmt('cN', 'int1')), false, 'nem ADM escreve em nome de outro');
  assert.equal(pode('forasteiro', 'kanban/okr/marco_comments/m1/cN', cmt('cN', 'out1')), false);
  assert.equal(pode('visualizador', 'kanban/okr/marco_comments/m1/cN', cmt('cN', 'v1')), false);
});

test('comentário do Marco — formato (validate)', () => {
  assert.equal(pode('membro', 'kanban/okr/marco_comments/m1/cN', cmt('cN', 'int1', { text: '' })), false, 'texto vazio');
  assert.equal(pode('membro', 'kanban/okr/marco_comments/m1/cN', cmt('cN', 'int1', { text: 'x'.repeat(4001) })), false, 'texto enorme');
  assert.equal(pode('membro', 'kanban/okr/marco_comments/m1/cN', cmt('cN', 'int1', { text: 'x'.repeat(4000) })), true);
  assert.equal(pode('membro', 'kanban/okr/marco_comments/m1/cN', cmt('OUTRO', 'int1')), false, 'id diferente da chave');
  assert.equal(pode('membro', 'kanban/okr/marco_comments/m1/cN', { id: 'cN', uid: 'int1', text: 'oi' }), false, 'sem ts');
  assert.equal(pode('membro', 'kanban/okr/marco_comments/m1/cN', cmt('cN', 'int1', { editadoEm: '2026-10-15T10:00:00.000Z' })), true);
});

test('comentário do Marco — editar: só o autor (como o app grava: text + editadoEm)', () => {
  assert.equal(pode('membro', 'kanban/okr/marco_comments/m1/cA/text', 'corrigido'), true);
  assert.equal(pode('membro', 'kanban/okr/marco_comments/m1/cA/editadoEm', '2026-10-15T10:00:00.000Z'), true);
  assert.equal(pode('membro', 'kanban/okr/marco_comments/m1/cB/text', 'editei o do outro'), false);
  assert.equal(pode('adm', 'kanban/okr/marco_comments/m1/cA/text', 'ADM editando o de outro'), false, 'ADM apaga, não reescreve');
  assert.equal(pode('membro', 'kanban/okr/marco_comments/m1/cA/uid', 'int2'), false, 'passar a autoria adiante');
  assert.equal(pode('forasteiro', 'kanban/okr/marco_comments/m1/cA/text', 'x'), false);
});

test('comentário do Marco — apagar: o próprio, ou ADM (qualquer um)', () => {
  assert.equal(pode('membro', 'kanban/okr/marco_comments/m1/cA', null), true);
  assert.equal(pode('membro', 'kanban/okr/marco_comments/m1/cB', null), false, 'apagar o de outra pessoa');
  assert.equal(pode('po', 'kanban/okr/marco_comments/m1/cA', null), false, 'PO não apaga o dos outros (só ADM)');
  assert.equal(pode('adm', 'kanban/okr/marco_comments/m1/cA', null), true);
  assert.equal(pode('caio', 'kanban/okr/marco_comments/m1/cB', null), true);
  assert.equal(pode('forasteiro', 'kanban/okr/marco_comments/m1/cA', null), false);
  assert.equal(pode('visualizador', 'kanban/okr/marco_comments/m1/cA', null), false);
});

test('comentário do Marco — conversa inteira (cascata ao excluir um Objetivo)', () => {
  assert.equal(pode('adm', 'kanban/okr/marco_comments/m1', null), true);
  assert.equal(pode('caio', 'kanban/okr/marco_comments/m1', null), true);
  assert.equal(pode('membro', 'kanban/okr/marco_comments/m1', null), false, 'membro não apaga a conversa dos outros');
  assert.equal(pode('membro', 'kanban/okr/marco_comments/m2', null), true, 'conversa vazia: nada a perder (a exclusão do Objetivo não pode falhar por isso)');
  assert.equal(pode('forasteiro', 'kanban/okr/marco_comments/m2', null), false);
  assert.equal(pode('membro', 'kanban/okr/marco_comments/m3', null), true, 'marco sem conversa nenhuma');
  assert.equal(pode('membro', 'kanban/okr/marco_comments/m1', { cZ: cmt('cZ', 'int1') }), false, 'sobrescrever a conversa inteira');
});

test('Data Studio — só ADM, PO, Organizador ou Gestor OKR configuram', () => {
  for (const p of lista('kanban/okr/datastudio/r1', 'kanban/okr/datastudio/r1/ordem', 'kanban/okr/datastudio/r9')) {
    for (const a of lista('adm', 'caio', 'po', 'org', 'gestor')) assert.equal(pode(a, p, p.endsWith('ordem') ? 2 : { id: 'r9', titulo: 'x' }), true, `${a} em ${p}`);
    for (const a of lista('membro', 'outro', 'forasteiro', 'arezzo', 'visualizador')) assert.equal(pode(a, p, p.endsWith('ordem') ? 2 : { id: 'r9', titulo: 'x' }), false, `${a} em ${p}`);
  }
  assert.equal(pode('membro', 'kanban/okr/datastudio/r1', null), false, 'apagar painel');
  assert.equal(pode('gestor', 'kanban/okr/datastudio/r1', null), true);
  assert.equal(check(RULES, DB, 'read', 'kanban/okr/datastudio', A.membro), true, 'todo mundo continua LENDO os painéis');
});

test('cobertura: todo nó de kanban/okr usado no código tem regra de escrita (senão ele perderia a escrita)', () => {
  const okr = RULES.rules.kanban.okr;
  const declarados = new Set(Object.keys(okr).filter(k => !k.startsWith('.')));
  const achados = new Map();
  const varre = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === '__tests__' || e.name === 'docs' || e.name === 'vendor') continue;
      const f = path.join(dir, e.name);
      if (e.isDirectory()) { if (dir === ROOT && !['functions'].includes(e.name)) continue; varre(f); continue; }
      if (!/\.(html|js)$/.test(e.name)) continue;
      const txt = fs.readFileSync(f, 'utf8');
      for (const m of txt.matchAll(/kanban\/okr\/([a-z_]+)/g)) if (!achados.has(m[1])) achados.set(m[1], path.relative(ROOT, f));
    }
  };
  varre(ROOT);
  const faltam = [...achados].filter(([n]) => !declarados.has(n));
  assert.deepEqual(faltam, [], 'nó(s) de kanban/okr sem regra em database.rules.json (adicione "' + (faltam[0] || [''])[0] + '": { ".write": … }): ' + JSON.stringify(faltam));
  for (const n of declarados) assert.ok(okr[n]['.write'] !== undefined || n === 'marco_comments', `okr/${n} sem .write`);
});
