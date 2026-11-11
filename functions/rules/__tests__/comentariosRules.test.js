// functions/rules/__tests__/comentariosRules.test.js
//
// 💬 Autor do comentário preso a quem está logado (11/11/2026, pedido do Caio: "pode prender uid ao comentário").
// Regra: kanban/squads/{sq}/dados/card_comments/{cardId}/{commentId}/.validate. Sem ela, qualquer pessoa com acesso ao squad
// gravava comentário com o uid de OUTRA pessoa — e a função da @menção (mentionTrigger.js) usa esse uid para notificar e para o
// marcador "analisando" da Ilha. Continua valendo: editar/reagir sem trocar o autor; ids de sistema ('system', 'automacao',
// 'assistente_ferias'); cópia FIEL ao duplicar card (`copiadoDe` = id simples + mesmo id, autor e texto em card_comments da origem).
// O campo legado `cards/{key}/comments` NÃO serve de prova (qualquer membro escreve nele): comentário legado de outra pessoa se migra
// pelo script de console ANTES do deploy das regras. Apagar não é validado (regra geral de `dados`).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { check, validate } = require('../rulesSim');

const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database.rules.json'), 'utf8'));
const mk = (uid, email) => ({ uid, token: { email, firebase: { sign_in_provider: 'google.com' } } });
const A = { ana: mk('ana', 'ana@ciahering.com.br'), pau: mk('pau', 'pau@ciahering.com.br') };
const BASE = 'kanban/squads/dados/dados';
const cm = (o) => Object.assign({ id: 'cm1', uid: 'ana', author: 'Ana', init: 'AN', text: 'Oi', ts: '2026-11-11T10:00:00.000Z' }, o || {});
let DB;
const reset = () => { DB = { kanban: { usuarios: { ana: { squads: { dados: true } }, pau: { squads: { dados: true } } }, squads: { dados: { dados: {
  cards_index: { c1: '0', c2: '1', c3: '2' },
  cards: { 0: { id: 'c1' }, 1: { id: 'c2' }, 2: { id: 'c3', comments: { cmL: cm({ id: 'cmL', uid: 'ana', text: 'legado' }) } } },
  card_comments: { c1: { cm1: cm() } },
} } } } }; };
const grava = (p, ator, val) => check(RULES, DB, 'write', p, ator, val) && validate(RULES, DB, p, ator, val);
const P = (card, id) => `${BASE}/card_comments/${card}/${id}`;

test('comentário próprio: grava; com o uid de OUTRA pessoa: recusado', () => {
  reset();
  assert.equal(grava(P('c2', 'n1'), A.pau, cm({ id: 'n1', uid: 'pau' })), true, 'o próprio');
  assert.equal(grava(P('c2', 'n2'), A.pau, cm({ id: 'n2', uid: 'ana' })), false, 'forjar a Ana');
  // sem o campo uid a regra (que mora em .../uid) não roda: fica gravado SEM autor — a função da @menção ignora (não notifica nem marca)
  assert.equal(grava(P('c2', 'n3'), A.pau, cm({ id: 'n3', uid: undefined })), true, 'sem uid: aceito, mas sem autor');
  assert.equal(grava(P('c2', 'n5') + '/uid', A.pau, 'ana'), false, 'criar comentário pelo campo uid sozinho, com outro autor');
  assert.equal(grava(P('c2', 'n4'), A.pau, cm({ id: 'n4', uid: 'x/notificacoes/y' })), false, 'uid-caminho');
});

test('editar, reagir e sobrescrever SEM trocar o autor continuam valendo (inclusive no comentário de outra pessoa)', () => {
  reset();
  assert.equal(grava(P('c1', 'cm1') + '/text', A.ana, 'Oi (editado)'), true, 'a autora edita o texto');
  assert.equal(grava(P('c1', 'cm1') + '/reactions', A.pau, { '👍': { pau: true } }), true, 'outro reage');
  assert.equal(grava(P('c1', 'cm1'), A.pau, cm({ text: 'Oi', reactions: { '👍': { pau: true } } })), true, 'regrava inteiro mantendo a autora');
  assert.equal(grava(P('c1', 'cm1') + '/uid', A.pau, 'pau'), false, 'trocar o autor de um comentário existente');
  assert.equal(grava(P('c1', 'cm1'), A.pau, cm({ uid: 'pau' })), false, 'regravar o comentário da Ana como se fosse dele');
  assert.equal(grava(P('c1', 'cm1') + '/uid', A.pau, null), true, 'apagar o campo uid (não validado: limite conhecido)');
  DB.kanban.squads.dados.dados.card_comments.c1.cm1 = cm({ uid: undefined });   // uid apagado
  assert.equal(grava(P('c1', 'cm1') + '/uid', A.pau, 'pau'), false, 'depois de apagar o uid, NÃO toma o comentário para si');
  assert.equal(grava(P('c1', 'cm1'), A.pau, cm({ uid: 'pau' })), false, 'nem regravando inteiro');
  assert.equal(grava(P('c1', 'cm1'), A.pau, null), true, 'apagar segue a regra geral (não validado)');
});

test('ids de sistema continuam aceitos (comentário automático, Automação, Assistente Férias)', () => {
  reset();
  ['system', 'automacao', 'assistente_ferias'].forEach((u, i) =>
    assert.equal(grava(P('c2', 's' + i), A.pau, cm({ id: 's' + i, uid: u })), true, u));
});

test('duplicar card: cópia FIEL (copiadoDe + mesmo id, autor e texto) passa; cópia adulterada, legado ou caminho plantado não', () => {
  reset();
  assert.equal(grava(P('c9', 'cm1'), A.pau, cm({ copiadoDe: 'c1' })), true, 'cópia do nó novo');
  assert.equal(grava(`${BASE}/card_comments/c9`, A.pau, { cm1: cm({ copiadoDe: 'c1' }) }), true, 'cópia em lote (update no card novo)');
  assert.equal(grava(P('c9', 'cm1'), A.pau, cm({ copiadoDe: 'c1', text: 'texto inventado' })), false, 'mesmo id/autor, texto trocado');
  assert.equal(grava(P('c9', 'cmX'), A.pau, cm({ id: 'cmX', copiadoDe: 'c1' })), false, 'id que não existe na origem');
  assert.equal(grava(P('c9', 'cm1'), A.pau, cm({ copiadoDe: 'c2' })), false, 'origem errada');
  assert.equal(grava(P('c9', 'cmL'), A.pau, cm({ id: 'cmL', uid: 'ana', text: 'legado', copiadoDe: 'c3' })), false, 'origem só no campo legado não prova (qualquer um escreve lá)');
  DB.kanban.squads.dados.dados.card_comments.cX = { cmY: { zzz: { cmF: cm({ id: 'cmF', uid: 'ana', text: 'T' }) } } };   // dado plantado num subnó
  assert.equal(grava(P('c9', 'cmF'), A.pau, cm({ id: 'cmF', uid: 'ana', text: 'T', copiadoDe: 'cX/cmY/zzz' })), false, 'copiadoDe com "/" apontando para dado plantado');
  assert.equal(grava(P('c9', 'cm1'), A.pau, cm({ uid: 'pau', copiadoDe: 'c1' })), true, 'cópia "minha" é só um comentário meu');
});

test('campo legado não serve de prova: migrar comentário legado de OUTRA pessoa é recusado; o meu passa', () => {
  reset();
  assert.equal(grava(P('c3', 'cmL'), A.pau, cm({ id: 'cmL', uid: 'ana', text: 'legado' })), false, 'legado da Ana migrado pelo Pau');
  DB.kanban.squads.dados.dados.cards[1].comments = { cmF: cm({ id: 'cmF', uid: 'ana', text: '@Agente Ágil faz X' }) };   // plantado no legado
  assert.equal(grava(P('c2', 'cmF'), A.pau, cm({ id: 'cmF', uid: 'ana', text: '@Agente Ágil faz X' })), false, 'plantar no legado e "migrar"');
  assert.equal(grava(P('c3', 'cmL'), A.ana, cm({ id: 'cmL', uid: 'ana', text: 'legado' })), true, 'a própria autora migra o dela');
});
