// functions/rules/__tests__/conchaFavoritosRules.test.js
//
// ⭐ Favoritos da Concha (27/11/2026): #tags favoritas (fav_tags/{uid}/{tag}) e mensagens salvas (fav_msgs/{uid}/{canal}/{msgId}).
// Decisões do Caio: ⭐ é um ATALHO separado do 🔔 Seguir (sem push); tudo é privado — só a dona lê e grava, nem o ADM.
// A mensagem salva guarda só os ids (nunca o texto); salvar exige poder ler o canal e a mensagem existir; tirar dos
// favoritos vale SEMPRE (mensagem apagada, limpa pela retenção ou canal que a pessoa deixou).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { check, validate } = require('../rulesSim');

const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database.rules.json'), 'utf8'));
const mk = (uid, email, prov) => ({ uid, token: { email, firebase: { sign_in_provider: prov || 'google.com' } } });
const A = {
  ana: mk('ana', 'ana@ciahering.com.br'),
  bru: mk('bru', 'bru@ciahering.com.br'),
  adm: mk('adm', 'adm@ciahering.com.br'),
  caio: mk('cai', 'caio.soares@ciahering.com.br'),
  ext: mk('ext', 'ext@gmail.com'),
  senha: mk('pwd', 'pwd@ciahering.com.br', 'password'),
};
let DB;
const reset = () => { DB = { kanban: {
  usuarios: { adm: { role: 'adm' }, ana: { role: 'membro' }, bru: { role: 'membro' } },
  cardume: {
    canais: { dados: { nome: 'Dados' }, mkt: { nome: 'Marketing' } },
    membros: { dados: { ana: true, bru: true }, mkt: { bru: true } },
    msgs: {
      dados: { d1: { uid: 'bru', ts: Date.now() - 864e5, texto: 'link útil' }, dx: { uid: 'bru', ts: Date.now() - 864e5, apagada: true } },
      mkt: { k1: { uid: 'bru', ts: Date.now() - 1000, texto: 'só do mkt' } },
      geral: { g1: { uid: 'adm', ts: Date.now() - 1000, texto: 'comunicado' } },
      'eu-ana': { n1: { uid: 'ana', ts: Date.now() - 1000, texto: 'minha nota' } },
      'eu-bru': { n2: { uid: 'bru', ts: Date.now() - 1000, texto: 'nota do bru' } },
    },
    fav_tags: { ana: { deploy: Date.now() - 5000 } },
    fav_msgs: { ana: { dados: { d1: Date.now() - 5000 }, mkt: { velha: Date.now() - 5000 } } },
  },
} }; };
const lê = (p, ator) => check(RULES, DB, 'read', p, ator);
const grava = (p, ator, val) => check(RULES, DB, 'write', p, ator, val) && validate(RULES, DB, p, ator, val);
const T = () => Date.now() - 10;
const FT = (u, t) => `kanban/cardume/fav_tags/${u}/${t}`, FM = (u, c, m) => `kanban/cardume/fav_msgs/${u}/${c}/${m}`;

test('⭐ favoritos: só a dona lê (nem ADM, nem o e-mail do Caio, nem outra conta)', () => {
  reset();
  for (const no of ['fav_tags', 'fav_msgs']) {
    assert.equal(lê(`kanban/cardume/${no}/ana`, A.ana), true, 'a dona lê ' + no);
    for (const k of ['bru', 'adm', 'caio', 'ext', 'senha']) assert.equal(lê(`kanban/cardume/${no}/ana`, A[k]), false, k + ' NÃO lê ' + no);
  }
  assert.equal(lê('kanban/cardume/fav_tags', A.adm), false, 'nem a lista de todo mundo');
  assert.equal(lê('kanban/cardume/fav_msgs', A.caio), false);
});

test('⭐ #tag favorita: a dona grava e tira; mesma chave das #tags; ninguém grava pela dona', () => {
  reset();
  assert.equal(grava(FT('ana', 'okr'), A.ana, T()), true, 'favoritar #okr');
  assert.equal(grava(FT('ana', 'deploy'), A.ana, null), true, 'tirar #deploy');
  assert.equal(grava(FT('ana', 'OKR'), A.ana, T()), false, 'maiúscula');
  assert.equal(grava(FT('ana', 'a b'), A.ana, T()), false, 'espaço');
  assert.equal(grava(FT('ana', 'x'.repeat(33)), A.ana, T()), false, '33 letras');
  assert.equal(grava(FT('ana', 'okr'), A.ana, true), false, 'valor não numérico');
  assert.equal(grava(FT('ana', 'okr'), A.ana, { a: 1 }), false, 'objeto');
  for (const k of ['bru', 'adm', 'caio', 'ext', 'senha']) {
    assert.equal(grava(FT('ana', 'okr'), A[k], T()), false, k + ' não favorita pela ana');
    assert.equal(grava(FT('ana', 'deploy'), A[k], null), false, k + ' não tira da ana');
  }
  assert.equal(grava('kanban/cardume/fav_tags/ana', A.ana, { okr: T() }), false, 'gravar a lista inteira de uma vez não vale (só folha)');
});

test('⭐ mensagem salva: só com acesso ao canal e com a mensagem viva; guarda só um número', () => {
  reset();
  assert.equal(grava(FM('ana', 'dados', 'd1'), A.ana, T()), true, 'membro salva');
  assert.equal(grava(FM('ana', 'geral', 'g1'), A.ana, T()), true, 'Geral: toda a Hering lê, então salva');
  assert.equal(grava(FM('ana', 'eu-ana', 'n1'), A.ana, T()), true, 'a própria nota');
  assert.equal(grava(FM('ana', 'mkt', 'k1'), A.ana, T()), false, 'canal em que não está');
  assert.equal(grava(FM('ana', 'eu-bru', 'n2'), A.ana, T()), false, 'nota de outra pessoa');
  assert.equal(grava(FM('adm', 'eu-bru', 'n2'), A.adm, T()), false, 'nem o ADM salva nota alheia');
  assert.equal(grava(FM('adm', 'mkt', 'k1'), A.adm, T()), true, 'ADM lê canais (moderação), então salva');
  assert.equal(grava(FM('ana', 'dados', 'nao-existe'), A.ana, T()), false, 'mensagem que não existe');
  assert.equal(grava(FM('ana', 'dados', 'dx'), A.ana, T()), false, 'mensagem apagada');
  assert.equal(grava(FM('ana', 'dados', 'd1'), A.ana, { texto: 'copiado' }), false, 'não guarda texto');
  assert.equal(grava(FM('ana', 'dados', 'd1'), A.ana, 'oi'), false, 'string');
  assert.equal(grava(FM('ana', 'dados', 'd1'), A.ana, Date.now() + 864e5), false, 'data no futuro');
  assert.equal(grava(FM('ana', 'da.dos', 'd1'), A.ana, T()), false, 'canal fora do ID');
  for (const k of ['bru', 'adm', 'caio', 'ext', 'senha']) assert.equal(grava(FM('ana', 'dados', 'd1'), A[k], T()), false, k + ' não salva pela ana');
  assert.equal(grava('kanban/cardume/fav_msgs/ana/dados', A.ana, { d1: T() }), false, 'só folha');
});

test('⭐ tirar dos salvos vale sempre para a dona (mensagem sumida, canal deixado), nunca para outra pessoa', () => {
  reset();
  assert.equal(grava(FM('ana', 'mkt', 'velha'), A.ana, null), true, 'canal que não lê + mensagem que não existe: tira mesmo assim');
  assert.equal(grava(FM('ana', 'dados', 'd1'), A.ana, null), true);
  for (const k of ['bru', 'adm', 'caio']) assert.equal(grava(FM('ana', 'dados', 'd1'), A[k], null), false, k + ' não tira da ana');
});
