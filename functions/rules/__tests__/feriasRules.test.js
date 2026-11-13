// functions/rules/__tests__/feriasRules.test.js
//
// 🏖️ Calendário geral de férias / modo férias (13/11/2026, docs/ideias/modo-ferias.md):
// kanban/ferias{,_dev}/{uid}/{id} = { ini, fim, obs?, em, por }.
// Todo login Google @ciahering lê; cada um grava/apaga SÓ as próprias férias; o ADM (role 'adm' ou o e-mail do Caio)
// corrige/apaga as de qualquer um. O PO NÃO (é o furo que usuarios/{uid} tem — ver escalados#gantt-favorita-autoria).
// Visualizador externo do Painel, gmail, login por senha e Microsoft/Arezzo não leem nem gravam.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { check, validate } = require('../rulesSim');

const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database.rules.json'), 'utf8'));
const mk = (uid, email, prov) => ({ uid, token: { email, firebase: { sign_in_provider: prov || 'google.com' } } });
const A = {
  ana: mk('ana', 'ana@ciahering.com.br'), bia: mk('bia', 'bia@ciahering.com.br'),
  po: mk('po1', 'po@ciahering.com.br'), adm: mk('adm', 'adm@ciahering.com.br'), caio: mk('caio', 'caio.soares@ciahering.com.br'),
  admLista: mk('al1', 'lista@ciahering.com.br'),   // só em config.adm_emails, sem role 'adm': NÃO é ADM para a regra (Armadilha 9)
  senha: mk('ana', 'ana@ciahering.com.br', 'password'), fora: mk('out1', 'qualquer@gmail.com'),
  vis: mk('vis1', 'visita@gmail.com'), arezzo: mk('az1', 'x@arezzo.com.br', 'microsoft.com'),
};
let DB;
const reset = () => {
  DB = { kanban: {
    usuarios: { adm: { role: 'adm' }, ana: { role: 'membro' }, bia: { role: 'membro' }, po1: { role: 'po' }, al1: { role: 'membro' }, caio: { role: 'membro' } },
    config: { adm_emails: ['lista@ciahering.com.br'] },
    painel_viewers: { 'visita@gmail,com': true },
  } };
};
const lê = (p, ator) => check(RULES, DB, 'read', p, ator);
const grava = (p, ator, val) => check(RULES, DB, 'write', p, ator, val) && (val === null || validate(RULES, DB, p, ator, val));
const fer = (ator, o) => Object.assign({ ini: '2026-11-20', fim: '2026-12-05', em: 1790000000000, por: ator.uid }, o || {});

for (const suf of ['', '_dev']) {
  const N = `kanban/ferias${suf}`;
  const P = (uid, id) => `${N}/${uid}/${id || 'f1'}`;
  const semear = () => { DB.kanban[`ferias${suf}`] = { ana: { f1: fer(A.ana) }, bia: { f1: fer(A.bia) } }; };

  test(`ferias${suf}: cada um grava, edita e apaga só as próprias`, () => {
    reset();
    assert.equal(grava(P('ana'), A.ana, fer(A.ana)), true, 'Ana cadastra');
    assert.equal(grava(P('ana'), A.ana, fer(A.ana, { obs: 'cobertura: Bia' })), true, 'com observação');
    assert.equal(grava(P('ana', 'f2'), A.ana, fer(A.ana, { ini: '2027-01-02', fim: '2027-01-02' })), true, 'um dia só, outro período');
    semear();
    assert.equal(grava(P('ana'), A.ana, null), true, 'Ana apaga as dela');
    assert.equal(grava(P('bia'), A.ana, fer(A.ana)), false, 'Ana NÃO cadastra férias da Bia');
    assert.equal(grava(P('bia'), A.ana, null), false, 'Ana NÃO apaga férias da Bia');
    assert.equal(grava(`${N}/bia`, A.bia, null), false, 'nem a própria pessoa apaga o nó inteiro de uma vez (só item a item)');
  });

  test(`ferias${suf}: ADM corrige/apaga de qualquer um; PO e "ADM só da lista" não`, () => {
    reset(); semear();
    assert.equal(grava(P('bia'), A.adm, fer(A.adm, { fim: '2026-12-10' })), true, 'ADM corrige a da Bia (por = o ADM)');
    assert.equal(grava(P('bia', 'f9'), A.adm, fer(A.adm)), true, 'ADM cadastra para a Bia');
    assert.equal(grava(P('bia'), A.adm, null), true, 'ADM apaga a da Bia');
    assert.equal(grava(P('ana'), A.caio, fer(A.caio)), true, 'o e-mail do Caio vale como ADM');
    semear();
    assert.equal(grava(P('bia'), A.po, fer(A.po)), false, 'PO NÃO grava férias de outro');
    assert.equal(grava(P('bia'), A.po, null), false, 'PO NÃO apaga férias de outro');
    assert.equal(grava(P('bia'), A.admLista, fer(A.admLista)), false, 'quem só está em config.adm_emails NÃO é ADM aqui');
    assert.equal(grava(P('bia'), A.admLista, null), false, 'idem para apagar');
    assert.equal(grava(`${N}/bia`, A.adm, null), false, 'nem o ADM apaga o nó da pessoa inteiro');
    assert.equal(grava(N, A.adm, null), false, 'nem o ADM apaga o nó de férias inteiro');
  });

  test(`ferias${suf}: login que não é Google da Hering não grava`, () => {
    reset();
    assert.equal(grava(P('ana'), A.senha, fer(A.senha)), false, 'Ana por senha');
    assert.equal(grava(P('out1'), A.fora, fer(A.fora)), false, 'gmail');
    assert.equal(grava(P('vis1'), A.vis, fer(A.vis)), false, 'visualizador externo do Painel');
    assert.equal(grava(P('az1'), A.arezzo, fer(A.arezzo)), false, 'Arezzo (Microsoft)');
  });

  test(`ferias${suf}: leitura só para Google da Hering`, () => {
    reset(); semear();
    assert.equal(lê(N, A.ana), true, 'Ana lê o calendário inteiro');
    assert.equal(lê(P('bia'), A.ana), true, 'e as férias da Bia');
    assert.equal(lê(N, A.po), true, 'PO lê');
    assert.equal(lê(N, A.vis), false, 'visualizador externo do Painel NÃO lê');
    assert.equal(lê(N, A.fora), false, 'gmail NÃO lê');
    assert.equal(lê(N, A.senha), false, 'login por senha NÃO lê');
    assert.equal(lê(N, A.arezzo), false, 'Arezzo NÃO lê');
    assert.equal(lê('kanban', A.ana), false, 'a regra nova não abre kanban/ inteiro');
  });

  test(`ferias${suf}: formato validado`, () => {
    reset();
    const ok = (o, msg) => assert.equal(grava(P('ana'), A.ana, fer(A.ana, o)), true, msg);
    const nao = (o, msg) => assert.equal(grava(P('ana'), A.ana, Object.assign(fer(A.ana), o)), false, msg);
    ok({}, 'base válida');
    nao({ ini: '20/11/2026' }, 'data fora de AAAA-MM-DD');
    nao({ fim: '2026-13-01' }, 'mês 13');
    nao({ fim: '2026-11-32' }, 'dia 32');
    nao({ ini: 20261120 }, 'data numérica');
    nao({ ini: '2026-11-20T00:00' }, 'com hora');
    nao({ obs: 'x'.repeat(141) }, 'obs acima de 140');
    nao({ obs: 7 }, 'obs não-texto');
    nao({ em: '1790000000000' }, 'em como texto');
    nao({ por: 'bia' }, 'por diferente de quem grava');
    nao({ cor: 'red' }, 'campo extra');
    assert.equal(grava(P('ana'), A.ana, { ini: '2026-11-20', em: 1, por: 'ana' }), false, 'sem fim');
    assert.equal(grava(P('ana'), A.ana, { ini: '2026-11-20', fim: '2026-11-21', por: 'ana' }), false, 'sem em');
    assert.equal(grava(P('ana', 'a/b'), A.ana, fer(A.ana)), false, 'id com barra (vira outro caminho)');
    assert.equal(grava(P('ana', 'x'.repeat(41)), A.ana, fer(A.ana)), false, 'id longo demais');
    assert.equal(grava(P('ana', 'id com espaço'), A.ana, fer(A.ana)), false, 'id com espaço');
  });
}
