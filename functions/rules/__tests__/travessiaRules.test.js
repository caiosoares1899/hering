// functions/rules/__tests__/travessiaRules.test.js
//
// ⛵ Travessia (kanban/travessia/*) — Baú, faróis (série + encontros), humor privado, ciclo de avaliação com indicação de pares e TRAVA DE DEVOLUTIVA.
// Avaliado pelo simulador (rulesSim.js) sobre as expressões REAIS do database.rules.json (o projeto não tem emulador). É dado sensível: este teste é o que impede
// publicar uma regra que deixe alguém ler o que não devia (ex.: o avaliado ler a avaliação do líder antes da devolutiva, ou o ADM ler notas de gente).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { check, validate } = require('../rulesSim');

const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database.rules.json'), 'utf8'));
const mk = (uid, email, prov) => ({ uid, token: { email, firebase: { sign_in_provider: prov || 'google.com' } } });
const A = {
  ana: mk('ana', 'ana@ciahering.com.br'),          // avaliada (liderada do Pau)
  pau: mk('pau', 'pau@ciahering.com.br'),          // líder direto da Ana
  gil: mk('gil', 'gil@ciahering.com.br'),          // gerente (lidera o Pau)
  bia: mk('bia', 'bia@ciahering.com.br'),          // colega da Ana (par indicado e aprovado)
  cae: mk('cae', 'cae@ciahering.com.br'),          // colega da Ana (par NÃO aprovado)
  dani: mk('dani', 'dani@ciahering.com.br'),       // RH da Travessia
  adm: mk('adm', 'adm@ciahering.com.br'),          // ADM técnico (role adm) — NÃO lê conteúdo de gente
  caio: mk('caio', 'caio.soares@ciahering.com.br'),
  forasteiro: mk('out1', 'qualquer@gmail.com'),
  arezzo: mk('az1', 'x@arezzo.com.br', 'microsoft.com'),
};
const CID = 'c2026s2';
const base = () => ({ kanban: {
  usuarios: { adm: { role: 'adm' }, ana: { role: 'membro' }, pau: { role: 'membro' } },
  travessia: {
    papeis: { dani: 'rh' },
    vinculos: { ana: { liderUid: 'pau', gerenteUid: 'gil' }, pau: { liderUid: 'gil' } },
    ciclos: { [CID]: { nome: 'Ciclo 2026/2', status: 'coleta', ts: 1 } },
    avaliacoes: { [CID]: { ana: {
      pares: { bia: { aprovado: true, por: 'avaliado', ts: 1 }, cae: { aprovado: false, por: 'avaliado', ts: 1 } },
      auto: { q1: 'minha auto', ts: 1 }, lider: { q1: 'avaliação do líder', ts: 1 },
      resp_pares: { bia: { q1: 'feedback da Bia', ts: 1 } },
      devolutiva: { texto: 'síntese', liberada: false, ts: 1 },
    } } },
  },
} });
let DB = base();
const reset = () => { DB = base(); };
const lê = (p, ator) => check(RULES, DB, 'read', p, ator);
const grava = (p, ator, val) => check(RULES, DB, 'write', p, ator, val) && validate(RULES, DB, p, ator, val);
const T = 'kanban/travessia/';
const quem = (ks) => ks.map(k => A[k]);

test('papéis: só o ADM concede RH; a própria pessoa lê o seu', () => {
  reset();
  assert.equal(grava(T + 'papeis/dani', A.adm, 'rh'), true);
  assert.equal(grava(T + 'papeis/dani', A.caio, 'rh'), true);
  assert.equal(grava(T + 'papeis/ana', A.ana, 'rh'), false, 'ninguém se dá RH');
  assert.equal(grava(T + 'papeis/ana', A.dani, 'rh'), false, 'nem o RH concede RH');
  assert.equal(lê(T + 'papeis/dani', A.dani), true); assert.equal(lê(T + 'papeis/dani', A.ana), false);
  assert.equal(grava(T + 'papeis/ana', A.adm, 'qualquer'), false, 'valor inválido');
  assert.equal(lê(T + 'papeis', A.adm), true, 'o ADM lista quem tem o papel'); assert.equal(lê(T + 'papeis', A.ana), false); assert.equal(lê(T + 'papeis', A.dani), false);
});

test('vínculos (organograma): a empresa lê; só ADM e RH gravam; ninguém lidera a si mesmo', () => {
  reset();
  quem(['ana', 'pau', 'bia', 'adm']).forEach(a => assert.equal(lê(T + 'vinculos', a), true));
  quem(['forasteiro', 'arezzo']).forEach(a => assert.equal(lê(T + 'vinculos', a), false));
  assert.equal(grava(T + 'vinculos/bia', A.adm, { liderUid: 'pau' }), true);
  assert.equal(grava(T + 'vinculos/bia', A.dani, { liderUid: 'pau', gerenteUid: 'gil' }), true, 'RH');
  assert.equal(grava(T + 'vinculos/bia', A.pau, { liderUid: 'pau' }), false, 'o líder não se atribui liderados');
  assert.equal(grava(T + 'vinculos/ana', A.ana, { liderUid: 'ana' }), false, 'a pessoa não escolhe o próprio líder');
  assert.equal(grava(T + 'vinculos/bia', A.adm, { liderUid: 'bia' }), false, 'liderar a si mesmo');
  assert.equal(grava(T + 'vinculos/bia', A.adm, { liderUid: 'pau', extra: 1 }), false, 'campo extra');
});

test('Baú: só o dono grava; dono, líder e gerente leem; colega, RH e ADM NÃO', () => {
  reset();
  const item = { tipo: 'card', titulo: 'Modelo de churn', ts: 1, ref: 'dados/c123', link: 'kanban.html#c123' };
  assert.equal(grava(T + 'bau/ana/i1', A.ana, item), true);
  assert.equal(grava(T + 'bau/ana/i1', A.pau, item), false, 'o líder não escreve no Baú da pessoa');
  assert.equal(grava(T + 'bau/ana/i1', A.bia, item), false);
  DB.kanban.travessia.bau = { ana: { i1: item } };
  assert.equal(lê(T + 'bau/ana', A.ana), true); assert.equal(lê(T + 'bau/ana', A.pau), true); assert.equal(lê(T + 'bau/ana', A.gil), true);
  ['bia', 'dani', 'adm', 'caio', 'forasteiro', 'arezzo'].forEach(k => assert.equal(lê(T + 'bau/ana', A[k]), false, k));
  assert.equal(grava(T + 'bau/ana/i2', A.ana, { tipo: 'invalido', titulo: 'x', ts: 1 }), false, 'tipo inválido');
  assert.equal(grava(T + 'bau/ana/i2', A.ana, { tipo: 'manual', titulo: 'x'.repeat(161), ts: 1 }), false, 'título longo');
  assert.equal(grava(T + 'bau/ana/i2', A.ana, { tipo: 'manual', titulo: 'x', ts: 1, intruso: 1 }), false, 'campo extra');
  assert.equal(grava(T + 'bau/ana/i3', A.ana, { tipo: 'kudo', titulo: 'Estrela', ts: 1, texto: 'valeu!', squad: 'dados' }), true);
});

test('faróis: série definida pelo líder; encontros registrados pela pessoa ou pelo líder (cada um apaga só o que registrou)', () => {
  reset();
  assert.equal(grava(T + 'serie/ana', A.pau, { cad: 'quinzenal', tipo: 'acomp', ts: 1 }), true);
  assert.equal(grava(T + 'serie/ana', A.ana, { cad: 'semanal', ts: 1 }), false, 'a pessoa não define a cadência');
  assert.equal(grava(T + 'serie/ana', A.pau, { cad: 'diaria', ts: 1 }), false, 'cadência inválida');
  const enc = (por) => ({ data: '2026-10-15', tipo: 'acomp', por, ts: 1 });
  assert.equal(grava(T + 'encontros/ana/e1', A.pau, enc('pau')), true, 'líder registra');
  assert.equal(grava(T + 'encontros/ana/e2', A.ana, enc('ana')), true, 'pessoa registra');
  assert.equal(grava(T + 'encontros/ana/e3', A.pau, enc('ana')), false, 'não registra em nome do outro');
  assert.equal(grava(T + 'encontros/ana/e4', A.bia, enc('bia')), false, 'colega');
  assert.equal(grava(T + 'encontros/ana/e5', A.gil, enc('gil')), false, 'gerente só lê');
  assert.equal(grava(T + 'encontros/ana/e6', A.pau, { data: '15/10/2026', por: 'pau', ts: 1 }), false, 'data fora do formato');
  DB.kanban.travessia.encontros = { ana: { e1: enc('pau'), e2: enc('ana') } };
  assert.equal(grava(T + 'encontros/ana/e1', A.ana, null), false, 'a pessoa não apaga o registro do líder');
  assert.equal(grava(T + 'encontros/ana/e1', A.pau, null), true);
  assert.equal(grava(T + 'encontros/ana/e2', A.ana, null), true);
  // 🔐 Auditoria de regras (05/11/2026): a pessoa avaliada não "assume" o registro do líder trocando o `por` — e depois o apaga.
  assert.equal(grava(T + 'encontros/ana/e1', A.ana, enc('ana')), false, 'a Ana NÃO sobrescreve o encontro do Pau trocando o autor');
  assert.equal(grava(T + 'encontros/ana/e2', A.pau, enc('pau')), false, 'nem o líder sobrescreve o registro que a Ana fez');
  assert.equal(grava(T + 'encontros/ana/e1', A.pau, Object.assign(enc('pau'), { nota: 'ajuste' })), true, 'quem registrou segue podendo editar o próprio');
  assert.equal(grava(T + 'encontros/ana/e9', A.ana, enc('ana')), true, 'e registrar um novo continua valendo');
  ['ana', 'pau', 'gil'].forEach(k => assert.equal(lê(T + 'encontros/ana', A[k]), true, k));
  ['bia', 'dani', 'adm', 'forasteiro'].forEach(k => assert.equal(lê(T + 'encontros/ana', A[k]), false, k));
});

test('humor: o registro é privado (só a pessoa lê, nem o líder); o líder só enxerga a cópia (humor_comp), que a própria pessoa grava', () => {
  reset();
  const h = { n: 4, ts: 1, nota: 'dia bom' };
  assert.equal(grava(T + 'humor/ana/2026-10-22', A.ana, h), true);
  assert.equal(grava(T + 'humor/ana/2026-10-22', A.pau, h), false, 'o líder não grava o humor dos outros');
  assert.equal(grava(T + 'humor/ana/2026-10-22', A.ana, { n: 6, ts: 1 }), false, 'nota fora de 1 a 5');
  assert.equal(grava(T + 'humor/ana/2026-10-22', A.ana, { n: 0, ts: 1 }), false);
  assert.equal(grava(T + 'humor/ana/22-10-2026', A.ana, h), false, 'dia fora do formato');
  assert.equal(grava(T + 'humor/ana/2026-10-22', A.ana, { n: 3, ts: 1, nota: 'x'.repeat(141) }), false);
  DB.kanban.travessia.humor = { ana: { '2026-10-22': h } };
  assert.equal(lê(T + 'humor/ana', A.ana), true);
  ['pau', 'gil', 'bia', 'dani', 'adm', 'caio', 'forasteiro', 'arezzo'].forEach(k => assert.equal(lê(T + 'humor/ana', A[k]), false, 'humor privado: ' + k));
  assert.equal(grava(T + 'humor_comp/ana/2026-10-22', A.ana, h), true, 'a pessoa compartilha');
  assert.equal(grava(T + 'humor_comp/ana/2026-10-22', A.pau, h), false, 'o líder não compartilha por ela');
  DB.kanban.travessia.humor_comp = { ana: { '2026-10-22': h } };
  assert.equal(lê(T + 'humor_comp/ana', A.pau), true, 'líder lê o compartilhado');
  ['gil', 'bia', 'dani', 'adm', 'forasteiro'].forEach(k => assert.equal(lê(T + 'humor_comp/ana', A[k]), false, 'compartilhado só com o líder direto: ' + k));
  assert.equal(grava(T + 'humor_comp/ana/2026-10-22', A.ana, null), true, 'descompartilhar');
});

test('diário do fechamento: PRIVADO (só a pessoa lê e grava); aceita humor, texto ou os dois; limites de tamanho', () => {
  reset();
  const dia = '2026-10-22'; const d = { n: 4, texto: 'Dia produtivo, fechei a análise.', ts: 1 };
  assert.equal(grava(T + 'diario/ana/' + dia, A.ana, d), true);
  assert.equal(grava(T + 'diario/ana/' + dia, A.ana, { texto: 'só texto', ts: 1 }), true, 'só texto');
  assert.equal(grava(T + 'diario/ana/' + dia, A.ana, { n: 2, ts: 1 }), true, 'só humor');
  assert.equal(grava(T + 'diario/ana/' + dia, A.ana, { ts: 1 }), false, 'sem humor nem texto');
  assert.equal(grava(T + 'diario/ana/' + dia, A.ana, { n: 6, ts: 1 }), false, 'humor fora de 1 a 5');
  assert.equal(grava(T + 'diario/ana/' + dia, A.ana, { texto: 'x'.repeat(1501), ts: 1 }), false, 'texto enorme');
  assert.equal(grava(T + 'diario/ana/22-10-2026', A.ana, d), false, 'dia fora do formato');
  assert.equal(grava(T + 'diario/ana/' + dia, A.ana, { ...d, extra: 1 }), false, 'campo extra');
  ['pau', 'gil', 'bia', 'dani', 'adm', 'caio', 'forasteiro', 'arezzo'].forEach(k => assert.equal(grava(T + 'diario/ana/' + dia, A[k], d), false, 'ninguém grava no diário alheio: ' + k));
  DB.kanban.travessia.diario = { ana: { [dia]: d } };
  assert.equal(lê(T + 'diario/ana', A.ana), true);
  ['pau', 'gil', 'bia', 'dani', 'adm', 'caio', 'forasteiro', 'arezzo'].forEach(k => assert.equal(lê(T + 'diario/ana', A[k]), false, 'diário privado: ' + k));
  assert.equal(grava(T + 'diario/ana/' + dia, A.ana, null), true, 'a pessoa apaga o próprio registro');
});

test('ciclos: todos leem o básico; só ADM/RH criam e mudam a fase', () => {
  reset();
  const c = { nome: 'Ciclo 2027/1', status: 'preparacao', ts: 1, participantes: { ana: true }, prazos: { auto: '2027-03-10' }, perguntas: { auto: { q1: 'O que você entregou?' } } };
  assert.equal(grava(T + 'ciclos/c2027s1', A.dani, c), true); assert.equal(grava(T + 'ciclos/c2027s1', A.adm, c), true);
  ['ana', 'pau', 'bia'].forEach(k => assert.equal(grava(T + 'ciclos/c2027s1', A[k], c), false, k));
  assert.equal(grava(T + 'ciclos/c2027s1', A.dani, { ...c, status: 'sei-la' }), false, 'fase inválida');
  assert.equal(lê(T + 'ciclos/' + CID, A.ana), true); assert.equal(lê(T + 'ciclos/' + CID, A.forasteiro), false);
});

const AV = (p) => T + `avaliacoes/${CID}/ana/` + p;
test('indicação de pares: o avaliado SUGERE (sempre não aprovado); só o líder aprova; não indica a si mesmo', () => {
  reset();
  assert.equal(grava(AV('pares/cae'), A.ana, { aprovado: false, por: 'avaliado', ts: 1 }), true, 'sugerir');
  assert.equal(grava(AV('pares/cae'), A.ana, { aprovado: true, por: 'avaliado', ts: 1 }), false, 'o avaliado não aprova a própria indicação');
  DB.kanban.travessia.avaliacoes[CID].ana.pares.cae = { aprovado: false, por: 'avaliado', ts: 1 };
  assert.equal(grava(AV('pares/cae'), A.ana, null), true, 'o avaliado retira a sugestão que ainda não foi aprovada');
  assert.equal(grava(AV('pares/bia'), A.ana, null), false, 'mas não retira um par já aprovado');
  assert.equal(grava(AV('pares/bia'), A.pau, null), true, 'o líder pode retirar');
  reset();
  assert.equal(grava(AV('pares/ana'), A.ana, { aprovado: false, por: 'avaliado', ts: 1 }), false, 'indicar a si mesmo');
  assert.equal(grava(AV('pares/cae'), A.pau, { aprovado: true, por: 'avaliado', ts: 1 }), true, 'o líder aprova');
  assert.equal(grava(AV('pares/cae'), A.bia, { aprovado: true, por: 'lider', ts: 1 }), false, 'colega não aprova');
  assert.equal(grava(AV('pares/cae'), A.gil, { aprovado: true, por: 'lider', ts: 1 }), false, 'gerente só lê');
  // depois de aprovado, o avaliado não pode retirar nem trocar (só o líder)
  assert.equal(grava(AV('pares/bia'), A.ana, { aprovado: false, por: 'avaliado', ts: 1 }), false, 'não volta atrás depois da aprovação');
  ['ana', 'pau', 'gil', 'bia'].forEach(k => assert.equal(lê(AV('pares/bia'), A[k]), true, k));
  ['cae', 'dani', 'adm', 'forasteiro'].forEach(k => assert.equal(lê(AV('pares/bia'), A[k]), false, k));
  assert.equal(lê(AV('pares/cae'), A.cae), true, 'o indicado enxerga a própria situação');
  DB.kanban.travessia.ciclos[CID].status = 'encerrado';
  assert.equal(grava(AV('pares/cae'), A.ana, { aprovado: false, por: 'avaliado', ts: 1 }), false, 'ciclo encerrado');
});

test('listas de pares: o avaliado, o líder e o gerente listam; o par só lê o próprio item; resp_pares só o líder e o gerente listam', () => {
  reset();
  ['ana', 'pau', 'gil'].forEach(k => assert.equal(lê(AV('pares'), A[k]), true, 'lista de pares: ' + k));
  ['bia', 'cae', 'dani', 'adm', 'forasteiro'].forEach(k => assert.equal(lê(AV('pares'), A[k]), false, 'lista de pares: ' + k));
  assert.equal(lê(AV('pares/bia'), A.bia), true, 'o par lê só o seu');
  ['pau', 'gil'].forEach(k => assert.equal(lê(AV('resp_pares'), A[k]), true, 'lista de respostas: ' + k));
  ['ana', 'bia', 'dani', 'adm', 'caio'].forEach(k => assert.equal(lê(AV('resp_pares'), A[k]), false, 'lista de respostas: ' + k));
  assert.equal(lê(AV('resp_pares/bia'), A.bia), true, 'o par lê a própria resposta');
});

test('autoavaliação, avaliação do líder e feedback de pares: cada um escreve o seu; o AVALIADO NÃO LÊ o do líder nem o dos pares', () => {
  reset();
  assert.equal(grava(AV('auto'), A.ana, { q1: 'orgulho', ts: 2 }), true);
  assert.equal(grava(AV('auto'), A.pau, { q1: 'x', ts: 2 }), false, 'o líder não escreve a autoavaliação');
  assert.equal(grava(AV('lider'), A.pau, { q1: 'x', ts: 2 }), true);
  assert.equal(grava(AV('lider'), A.ana, { q1: 'x', ts: 2 }), false);
  assert.equal(grava(AV('resp_pares/bia'), A.bia, { q1: 'feedback', ts: 2 }), true, 'par aprovado');
  assert.equal(grava(AV('resp_pares/cae'), A.cae, { q1: 'feedback', ts: 2 }), false, 'par NÃO aprovado');
  assert.equal(grava(AV('resp_pares/bia'), A.cae, { q1: 'feedback', ts: 2 }), false, 'não responde por outro');
  assert.equal(grava(AV('auto'), A.ana, { q1: 'x'.repeat(2501), ts: 2 }), false, 'resposta enorme');
  assert.equal(grava(AV('auto'), A.ana, { q1: 'x', q9: 'fora do modelo', ts: 2 }), false, 'pergunta que não existe');
  // leitura
  ['ana', 'pau', 'gil'].forEach(k => assert.equal(lê(AV('auto'), A[k]), true, 'auto: ' + k));
  ['bia', 'dani', 'adm', 'forasteiro'].forEach(k => assert.equal(lê(AV('auto'), A[k]), false, 'auto: ' + k));
  ['pau', 'gil'].forEach(k => assert.equal(lê(AV('lider'), A[k]), true, 'lider: ' + k));
  ['ana', 'bia', 'dani', 'adm', 'caio'].forEach(k => assert.equal(lê(AV('lider'), A[k]), false, 'avaliação do líder fechada: ' + k));
  ['bia', 'pau', 'gil'].forEach(k => assert.equal(lê(AV('resp_pares/bia'), A[k]), true, 'resp_pares: ' + k));
  ['ana', 'cae', 'dani', 'adm', 'caio'].forEach(k => assert.equal(lê(AV('resp_pares/bia'), A[k]), false, 'o avaliado NÃO vê o feedback dos pares: ' + k));
  // fases: fora da coleta ninguém escreve auto/resp
  DB.kanban.travessia.ciclos[CID].status = 'devolutiva';
  assert.equal(grava(AV('auto'), A.ana, { q1: 'tarde', ts: 3 }), false, 'a coleta acabou');
  assert.equal(grava(AV('resp_pares/bia'), A.bia, { q1: 'tarde', ts: 3 }), false);
  DB.kanban.travessia.ciclos[CID].status = 'preparacao';
  assert.equal(grava(AV('auto'), A.ana, { q1: 'cedo', ts: 3 }), false, 'a coleta ainda não abriu');
});

test('TRAVA DE DEVOLUTIVA: o avaliado só lê a devolutiva depois que o líder libera; só o líder grava', () => {
  reset();
  assert.equal(lê(AV('devolutiva'), A.ana), false, 'antes de liberar');
  ['pau', 'gil'].forEach(k => assert.equal(lê(AV('devolutiva'), A[k]), true, k));
  ['bia', 'dani', 'adm', 'caio', 'forasteiro', 'arezzo'].forEach(k => assert.equal(lê(AV('devolutiva'), A[k]), false, k));
  assert.equal(grava(AV('devolutiva'), A.ana, { texto: 'eu me libero', liberada: true, ts: 1 }), false, 'o avaliado não libera o próprio resultado');
  assert.equal(grava(AV('devolutiva'), A.gil, { texto: 'x', liberada: true, ts: 1 }), false, 'gerente não libera (é o líder direto)');
  assert.equal(grava(AV('devolutiva'), A.pau, { texto: 'síntese', liberada: true, liberadaEm: 5, por: 'pau', ts: 1 }), true, 'o líder libera');
  DB.kanban.travessia.avaliacoes[CID].ana.devolutiva.liberada = true;
  assert.equal(lê(AV('devolutiva'), A.ana), true, 'depois de liberada');
  assert.equal(lê(AV('devolutiva'), A.bia), false, 'colega continua sem acesso');
  assert.equal(lê(AV('lider'), A.ana), false, 'mesmo liberada, a avaliação bruta do líder segue fechada');
  assert.equal(lê(AV('resp_pares/bia'), A.ana), false, 'e os feedbacks individuais dos pares também');
  assert.equal(grava(AV('ciente'), A.ana, 99), true, 'a pessoa dá ciência depois de liberada');
  DB.kanban.travessia.avaliacoes[CID].ana.devolutiva.liberada = false;
  assert.equal(grava(AV('ciente'), A.ana, 99), false, 'sem liberar não há ciência');
  assert.equal(lê(AV('devolutiva'), A.ana), false, 'o líder pode recolher a liberação');
});

test('caixa de entrada de pares: o líder escreve ao aprovar; só o indicado lê', () => {
  reset();
  const pedido = { cid: CID, avaliado: 'ana', ts: 1 };
  assert.equal(grava(T + 'pedidos_par/bia/' + CID + '_ana', A.pau, pedido), true, 'líder da Ana');
  assert.equal(grava(T + 'pedidos_par/bia/' + CID + '_ana', A.ana, pedido), false, 'o avaliado não coloca pedido');
  assert.equal(grava(T + 'pedidos_par/bia/' + CID + '_ana', A.gil, pedido), false);
  assert.equal(grava(T + 'pedidos_par/bia/' + CID + '_gil', A.pau, { cid: CID, avaliado: 'gil', ts: 1 }), false, 'líder que não é o do avaliado');
  DB.kanban.travessia.pedidos_par = { bia: { [CID + '_ana']: pedido } };
  assert.equal(grava(T + 'pedidos_par/bia/' + CID + '_ana', A.pau, null), true, 'remove ao desaprovar');
  assert.equal(lê(T + 'pedidos_par/bia', A.bia), true);
  ['ana', 'pau', 'gil', 'dani', 'adm', 'forasteiro'].forEach(k => assert.equal(lê(T + 'pedidos_par/bia', A[k]), false, k));
});

test('ninguém de fora (Gmail, Arezzo) lê nem grava nada em kanban/travessia; o ADM técnico não lê conteúdo de pessoas', () => {
  reset();
  const caminhos = ['bau/ana', 'diario/ana', 'humor/ana', 'humor_comp/ana', 'encontros/ana', 'serie/ana', AV('auto'), AV('lider'), AV('devolutiva'), AV('resp_pares/bia'), 'pedidos_par/bia'].map(p => p.startsWith('kanban') ? p : T + p);
  caminhos.forEach(p => { ['forasteiro', 'arezzo'].forEach(k => assert.equal(lê(p, A[k]), false, k + ' ' + p)); });
  caminhos.filter(p => !/pares\/bia|devolutiva|humor_comp/.test(p) || true).forEach(p => ['adm', 'caio', 'dani'].forEach(k => assert.equal(lê(p, A[k]), false, `${k} não lê ${p}`)));
  // ...mas ADM e RH administram o organograma e os ciclos (sem ler conteúdo)
  assert.equal(grava(T + 'vinculos/bia', A.adm, { liderUid: 'pau' }), true);
  assert.equal(grava(T + 'ciclos/x', A.dani, { nome: 'x', status: 'preparacao', ts: 1 }), true);
});

// 🧭 Cultura da Hering na Travessia (11/11/2026, pedido do Caio): as 5 atitudes (facilita · cardume · bemfeito · acessivel · legado) entram
// no 1:1 (`encontros/{uid}/{id}/at`, uma) e na avaliação, num nó IRMÃO (`avaliacoes/{cid}/{avaliado}/atitudes/{auto|lider|par/{par}}`) — o prod
// regrava auto/lider/resp_pares inteiros com `set`, então campos novos lá dentro seriam apagados. Cada nó copia a leitura e a escrita do seu par.
test('cultura · 1:1: atitude em foco opcional, só os 5 ids', () => {
  reset();
  const e = (o) => Object.assign({ data: '2026-11-10', tipo: 'acomp', por: 'pau', ts: 1 }, o);
  assert.equal(grava(T + 'encontros/ana/e1', A.pau, e({ at: 'cardume' })), true, 'líder registra com atitude');
  assert.equal(grava(T + 'encontros/ana/e2', A.ana, e({ por: 'ana', at: 'legado' })), true, 'a pessoa registra com atitude');
  assert.equal(grava(T + 'encontros/ana/e3', A.pau, e()), true, 'sem atitude continua valendo');
  ['x', 'facilita,cardume', 'facilita/x', 'FACILITA', ''].forEach(v => assert.equal(grava(T + 'encontros/ana/e4', A.pau, e({ at: v })), false, 'inválido: ' + v));
  assert.equal(grava(T + 'encontros/ana/e5', A.pau, e({ at: 3 })), false, 'não-texto');
});

test('cultura · avaliação: atitudes da autoavaliação, do par e do líder com as MESMAS regras de leitura/escrita do nó de cada um', () => {
  reset();
  const AT = T + 'avaliacoes/' + CID + '/ana/atitudes/';
  // autoavaliação: só a Ana grava (em coleta); Ana, líder e gerente leem; o par não
  assert.equal(grava(AT + 'auto', A.ana, { at: 'cardume,bemfeito', atx: 'liderei a migração junto com o time', ts: 1 }), true);
  assert.equal(grava(AT + 'auto', A.ana, { at: 'facilita', ts: 1 }), true, 'uma atitude');
  assert.equal(grava(AT + 'auto', A.ana, { at: 'facilita,cardume,legado', ts: 1 }), false, 'no máximo 2');
  assert.equal(grava(AT + 'auto', A.ana, { at: 'facilita,x', ts: 1 }), false, 'id desconhecido');
  assert.equal(grava(AT + 'auto', A.ana, { atx: 'x'.repeat(1201), ts: 1 }), false, 'exemplo > 1200');
  assert.equal(grava(AT + 'auto', A.ana, { at: 'facilita' }), false, 'sem ts');
  assert.equal(grava(AT + 'auto', A.ana, { at: 'facilita', outro: 1, ts: 1 }), false, 'campo fora da lista');
  assert.equal(grava(AT + 'auto', A.pau, { at: 'facilita', ts: 1 }), false, 'o líder não escreve a autoavaliação');
  ['ana', 'pau', 'gil'].forEach(k => assert.equal(lê(AT + 'auto', A[k]), true, k + ' lê a auto'));
  ['bia', 'dani', 'adm'].forEach(k => assert.equal(lê(AT + 'auto', A[k]), false, k + ' não lê a auto'));
  // par: só o par APROVADO grava, em coleta; o AVALIADO NÃO lê o que o par marcou
  assert.equal(grava(AT + 'par/bia', A.bia, { at: 'acessivel', atx: 'escuta o atendimento toda semana', ts: 1 }), true, 'par aprovado');
  assert.equal(grava(AT + 'par/cae', A.cae, { at: 'acessivel', ts: 1 }), false, 'par não aprovado');
  assert.equal(grava(AT + 'par/bia', A.cae, { at: 'acessivel', ts: 1 }), false, 'outro no lugar do par');
  assert.equal(lê(AT + 'par/bia', A.ana), false, 'a avaliada NÃO lê a atitude que o par marcou');
  assert.equal(lê(AT + 'par', A.ana), false, 'nem a lista');
  ['pau', 'gil'].forEach(k => assert.equal(lê(AT + 'par', A[k]), true, k + ' lê a lista dos pares (como em resp_pares)'));
  assert.equal(lê(AT + 'par', A.bia), false, 'o par não lê a lista dos outros pares');
  ['bia', 'pau', 'gil'].forEach(k => assert.equal(lê(AT + 'par/bia', A[k]), true, k + ' lê a do par'));
  // líder: só o líder direto grava; a avaliada NÃO lê (nem a atitude a desenvolver)
  assert.equal(grava(AT + 'lider', A.pau, { at: 'cardume', atd: 'facilita', atx: 'precisa dizer mais não', ts: 1 }), true);
  assert.equal(grava(AT + 'lider', A.pau, { atd: 'facilita,legado,cardume', ts: 1 }), false, 'a desenvolver: no máximo 2');
  assert.equal(grava(AT + 'lider', A.gil, { at: 'cardume', ts: 1 }), false, 'o gerente lê mas não escreve');
  assert.equal(lê(AT + 'lider', A.ana), false, 'a avaliada não lê a avaliação de atitudes do líder');
  ['pau', 'gil'].forEach(k => assert.equal(lê(AT + 'lider', A[k]), true, k + ' lê a do líder'));
  assert.equal(grava(AT + 'outra', A.ana, { at: 'facilita', ts: 1 }), false, 'nó desconhecido em atitudes');
  ['forasteiro', 'arezzo', 'adm', 'caio', 'dani'].forEach(k => ['auto', 'lider', 'par/bia', ''].forEach(n => assert.equal(lê(AT + n, A[k]), false, k + ' não lê atitudes/' + n)));
  ['forasteiro', 'arezzo'].forEach(k => assert.equal(grava(AT + 'auto', A[k], { at: 'facilita', ts: 1 }), false, k + ' não grava'));
  // fases: fora da coleta, auto e par não gravam; encerrado, o líder também não
  DB.kanban.travessia.ciclos[CID].status = 'devolutiva';
  assert.equal(grava(AT + 'auto', A.ana, { at: 'facilita', ts: 2 }), false, 'auto fora da coleta');
  assert.equal(grava(AT + 'par/bia', A.bia, { at: 'facilita', ts: 2 }), false, 'par fora da coleta');
  assert.equal(grava(AT + 'lider', A.pau, { at: 'facilita', ts: 2 }), true, 'líder na devolutiva');
  DB.kanban.travessia.ciclos[CID].status = 'encerrado';
  assert.equal(grava(AT + 'lider', A.pau, { at: 'facilita', ts: 3 }), false, 'líder com ciclo encerrado');
});

test('cultura · ciclo: marcador "cultura" (booleano), só ADM/RH', () => {
  reset();
  const c = (o) => Object.assign({ nome: 'Ciclo 2027/1', status: 'preparacao', ts: 1 }, o);
  assert.equal(grava(T + 'ciclos/c27', A.dani, c({ cultura: true })), true, 'RH cria com atitudes');
  assert.equal(grava(T + 'ciclos/' + CID + '/cultura', A.dani, true), true, 'RH liga no ciclo em andamento');
  assert.equal(grava(T + 'ciclos/' + CID + '/cultura', A.adm, false), true, 'ADM desliga');
  assert.equal(grava(T + 'ciclos/' + CID + '/cultura', A.dani, 'sim'), false, 'não-booleano');
  assert.equal(grava(T + 'ciclos/' + CID + '/cultura', A.pau, true), false, 'líder não mexe no ciclo');
});
