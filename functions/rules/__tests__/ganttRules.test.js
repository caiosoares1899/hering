// functions/rules/__tests__/ganttRules.test.js
//
// 📊 Gantt (13/11/2026): calendários importados no Painel (kanban/calendarios_gantt{,_dev}/{marca|comercial}) — todos da Hering leem,
// SÓ ADM grava; datas-chave da squad (kanban/squads/{sq}/gantt_marcos{,_dev}/{id}) — a squad lê, só PO/Organizador DA PRÓPRIA squad
// (ou ADM) grava; datas-chave globais (kanban/gantt_marcos_globais{,_dev}) — só ADM grava.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { check, validate } = require('../rulesSim');

const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database.rules.json'), 'utf8'));
const mk = (uid, email, prov) => ({ uid, token: { email, firebase: { sign_in_provider: prov || 'google.com' } } });
const A = { adm: mk('adm', 'adm@ciahering.com.br'), po: mk('po', 'po@ciahering.com.br'), org: mk('org', 'org@ciahering.com.br'),
  membro: mk('mem', 'mem@ciahering.com.br'), poOutra: mk('po2', 'po2@ciahering.com.br'), poGlobal: mk('pog', 'pog@ciahering.com.br'),
  forasteiro: mk('out1', 'qualquer@gmail.com'), arezzo: mk('az1', 'x@arezzo.com.br', 'microsoft.com') };
const USUARIOS = {
  adm: { role: 'adm' },
  po: { role: 'membro', squads: { site: true }, squads_roles: { site: 'po' } },
  org: { role: 'membro', squads: { site: true }, squads_roles: { site: 'organizador' } },
  mem: { role: 'membro', squads: { site: true }, squads_roles: { site: 'membro' } },
  po2: { role: 'membro', squads: { app: true }, squads_roles: { app: 'po' } },
  // PO "global" (role antigo) que é PO na squad dele, mas membro comum nesta: o squads_roles da squad manda.
  pog: { role: 'po', squads: { site: true, app: true }, squads_roles: { site: 'membro' } },
};
let DB;
const reset = () => { DB = { kanban: { usuarios: JSON.parse(JSON.stringify(USUARIOS)) } }; };
const lê = (p, ator) => check(RULES, DB, 'read', p, ator);
const grava = (p, ator, val) => check(RULES, DB, 'write', p, ator, val) && validate(RULES, DB, p, ator, val);
const marco = (uid, o) => Object.assign({ titulo: 'Black Friday', ini: '2026-11-27', fim: '2026-11-30', cor: 'red', porUid: uid, porNome: 'Fulano', em: 1790000000000 }, o || {});
const cal = (o) => Object.assign({
  meta: { atualizadoEm: 1790000000000, porNome: 'Adm', arquivo: 'Calendário de Campanhas 2026.xlsx', de: '2026-01-01', ate: '2026-12-31' },
  linhas: { web: { rot: 'Web', ordem: 2 } },
  barras: { b_abc123: { linha: 'web', ini: '2026-10-31', fim: '2026-11-30', txt: 'BLACK FRIDAY' } } }, o || {});

for (const suf of ['', '_dev']) {
  const M = (sq, id) => `kanban/squads/${sq}/gantt_marcos${suf}/${id}`;
  test(`datas-chave da squad${suf}: PO e Organizador da squad criam; membro, PO de outra squad e externos não`, () => {
    reset();
    assert.equal(grava(M('site', 'm1'), A.po, marco('po')), true, 'PO da squad cria');
    assert.equal(grava(M('site', 'm2'), A.org, marco('org')), true, 'Organizador da squad cria');
    assert.equal(grava(M('site', 'm3'), A.adm, marco('adm')), true, 'ADM cria em qualquer squad');
    assert.equal(grava(M('site', 'm4'), A.membro, marco('mem')), false, 'membro comum NÃO cria');
    assert.equal(grava(M('site', 'm5'), A.poOutra, marco('po2')), false, 'PO de OUTRA squad NÃO cria aqui');
    assert.equal(grava(M('site', 'm6'), A.poGlobal, marco('pog')), false, 'role global "po" não vale onde o papel na squad é membro');
    assert.equal(grava(M('site', 'm7'), A.forasteiro, marco('out1')), false, 'fora da Hering NÃO cria');
    assert.equal(grava(M('site', 'm8'), A.arezzo, marco('az1')), false, 'Arezzo NÃO cria');
  });
  test(`datas-chave da squad${suf}: a squad lê; quem não é da empresa nem da squad não`, () => {
    reset(); DB.kanban.squads = { site: { [`gantt_marcos${suf}`]: { m1: marco('po') } } };
    assert.equal(lê(`kanban/squads/site/gantt_marcos${suf}`, A.membro), true, 'membro lê');
    assert.equal(lê(`kanban/squads/site/gantt_marcos${suf}`, A.poOutra), true, 'gente da Hering (outra squad) lê, como os cards');
    assert.equal(lê(`kanban/squads/site/gantt_marcos${suf}`, A.forasteiro), false, 'fora da Hering não lê');
  });
  test(`datas-chave da squad${suf}: autor não se forja, edição mantém o autor, apagar é do PO`, () => {
    reset();
    assert.equal(grava(M('site', 'm1'), A.po, marco('org')), false, 'porUid tem que ser quem cria');
    DB.kanban.squads = { site: { [`gantt_marcos${suf}`]: { m1: marco('po') } } };
    assert.equal(grava(M('site', 'm1'), A.org, marco('po', { titulo: 'Black Friday 🖤' })), true, 'outro PO/Org edita mantendo o autor');
    assert.equal(grava(M('site', 'm1'), A.org, marco('org')), false, 'edição não troca o autor');
    assert.equal(grava(M('site', 'm1'), A.membro, null), false, 'membro NÃO apaga');
    assert.equal(grava(M('site', 'm1'), A.org, null), true, 'Organizador apaga');
  });
  test(`datas-chave da squad${suf}: validação de datas, título, cor e campos extras`, () => {
    reset();
    // fim ≥ início é garantido na tela (comparação de texto entre dois campos não tem precedente nas regras publicadas)
    assert.equal(grava(M('site', 'v2'), A.po, marco('po', { ini: '27/11/2026' })), false, 'data fora do ISO');
    assert.equal(grava(M('site', 'v3'), A.po, marco('po', { titulo: 'x'.repeat(81) })), false, 'título longo');
    assert.equal(grava(M('site', 'v4'), A.po, marco('po', { titulo: '' })), false, 'título vazio');
    assert.equal(grava(M('site', 'v5'), A.po, marco('po', { cor: '#ff0000' })), false, 'cor fora da paleta');
    assert.equal(grava(M('site', 'v6'), A.po, marco('po', { html: '<img>' })), false, 'campo extra');
    const umDia = marco('po', { fim: '2026-11-27' }); delete umDia.cor;
    assert.equal(grava(M('site', 'v7'), A.po, umDia), true, 'um dia só e sem cor vale');
  });
  test(`datas-chave globais${suf}: só ADM grava; a empresa lê`, () => {
    reset(); const G = id => `kanban/gantt_marcos_globais${suf}/${id}`;
    assert.equal(grava(G('g1'), A.adm, marco('adm')), true, 'ADM cria');
    assert.equal(grava(G('g2'), A.po, marco('po')), false, 'PO NÃO cria global');
    assert.equal(grava(G('g3'), A.poGlobal, marco('pog')), false, 'role po NÃO cria global');
    assert.equal(lê(`kanban/gantt_marcos_globais${suf}`, A.membro), true, 'membro lê');
    assert.equal(lê(`kanban/gantt_marcos_globais${suf}`, A.forasteiro), false, 'fora da Hering não lê');
  });
  test(`calendários do Gantt${suf}: só ADM publica; a empresa lê; formato validado`, () => {
    reset(); const C = c => `kanban/calendarios_gantt${suf}/${c}`;
    assert.equal(grava(C('marca'), A.adm, cal()), true, 'ADM publica o de Marca');
    assert.equal(grava(C('comercial'), A.adm, cal()), true, 'ADM publica o Comercial');
    assert.equal(grava(C('marca'), A.po, cal()), false, 'PO NÃO publica');
    assert.equal(grava(C('marca'), A.membro, cal()), false, 'membro NÃO publica');
    assert.equal(grava(C('mktplace'), A.adm, cal()), true, 'ADM publica o Comercial Marketplace');
    assert.equal(grava(C('outlet'), A.adm, cal()), true, 'ADM publica o Comercial Outlet (já liberado)');
    assert.equal(grava(C('mktplace'), A.po, cal()), false, 'PO NÃO publica o Marketplace');
    assert.equal(grava(C('outro'), A.adm, cal()), false, 'só marca|comercial|mktplace|outlet');
    assert.equal(grava(C('marca'), A.adm, cal({ barras: { b_x1: { linha: 'web', ini: '30/11/2026', fim: '2026-12-01', txt: 'X' } } })), false, 'data fora do ISO');
    assert.equal(grava(C('marca'), A.adm, cal({ barras: { b_x1: { linha: 'web', ini: '2026-11-01', fim: '2026-11-02', txt: 'x'.repeat(201) } } })), false, 'texto longo');
    assert.equal(grava(C('marca'), A.adm, cal({ barras: { b_x1: { linha: 'WEB INVÁLIDA', ini: '2026-11-01', fim: '2026-11-02', txt: 'X' } } })), false, 'linha fora do padrão');
    assert.equal(grava(C('marca'), A.adm, cal({ barras: { b_x1: { linha: 'web', ini: '2026-11-01', fim: '2026-11-02', txt: 'X', cor: 'red' } } })), false, 'campo extra na barra');
    assert.equal(lê(`kanban/calendarios_gantt${suf}`, A.membro), true, 'membro lê');
    assert.equal(lê(`kanban/calendarios_gantt${suf}`, A.forasteiro), false, 'fora da Hering não lê');
    // visualizador externo do Painel (painel_viewers) NÃO lê: o Comercial tem cupons e profundidade de desconto
    DB.kanban.painel_viewers = { 'visita@gmail,com': true };
    assert.equal(lê(`kanban/calendarios_gantt${suf}`, mk('vis1', 'visita@gmail.com')), false, 'visualizador do Painel não lê os calendários');
    assert.equal(lê(`kanban/calendarios_gantt${suf}`, A.arezzo), false, 'Arezzo (Microsoft) não lê');
  });
  test(`destaques do Gantt${suf}: só ADM marca cor/⚠️; a empresa lê; formato validado`, () => {
    reset(); const D = (c, id) => `kanban/gantt_destaques${suf}/${c}/${id}`; const d = o => Object.assign({ cor: 'red', alerta: true, porNome: 'Adm', em: 1 }, o || {});
    assert.equal(grava(D('comercial', 'b_abc'), A.adm, d()), true, 'ADM destaca no Comercial');
    assert.equal(grava(D('marca', 'b_abc'), A.adm, d({ alerta: false })), true, 'ADM destaca na Marca');
    assert.equal(grava(D('comercial', 'b_abc'), A.po, d()), false, 'PO NÃO destaca');
    assert.equal(grava(D('comercial', 'b_abc'), A.poGlobal, d()), false, 'role po NÃO destaca');
    assert.equal(grava(D('comercial', 'b_abc'), A.membro, d()), false, 'membro NÃO destaca');
    assert.equal(grava(D('mktplace', 'b_abc'), A.adm, d()), true, 'ADM destaca no Marketplace');
    assert.equal(grava(D('mktplace', 'b_abc'), A.membro, d()), false, 'membro NÃO destaca no Marketplace');
    assert.equal(grava(D('outro', 'b_abc'), A.adm, d()), false, 'só calendários conhecidos');
    assert.equal(grava(D('comercial', 'b_abc'), A.adm, d({ cor: '#ff0000' })), false, 'cor fora da paleta');
    assert.equal(grava(D('comercial', 'b_abc'), A.adm, d({ alerta: 'sim' })), false, 'alerta tem que ser booleano');
    assert.equal(grava(D('comercial', 'b_abc'), A.adm, d({ txt: '<img>' })), false, 'campo extra');
    DB.kanban[`gantt_destaques${suf}`] = { comercial: { b_abc: d() } };
    assert.equal(grava(D('comercial', 'b_abc'), A.adm, null), true, 'ADM tira o destaque');
    assert.equal(grava(D('comercial', 'b_abc'), A.membro, null), false, 'membro NÃO tira');
    assert.equal(lê(`kanban/gantt_destaques${suf}`, A.membro), true, 'membro lê');
    DB.kanban.painel_viewers = { 'visita@gmail,com': true };
    assert.equal(lê(`kanban/gantt_destaques${suf}`, mk('vis1', 'visita@gmail.com')), false, 'visualizador do Painel não lê');
    assert.equal(lê(`kanban/gantt_destaques${suf}`, A.forasteiro), false, 'fora da Hering não lê');
  });
}
