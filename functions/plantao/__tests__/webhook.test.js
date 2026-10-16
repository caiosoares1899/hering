// functions/plantao/__tests__/webhook.test.js — o GitHub avisa que a PR do bug abriu: assinatura, quem pode, o que grava, validação desfeita ao mexer na PR.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { processarPR, extrairScript, assinaturaOk, REPO } = require('../webhook');

const AGORA = new Date('2026-10-20T15:00:00Z');
const ID = 'bug_ferias_1760000000001', BRANCH = 'antigravity/bug-1760000000001', URL = `https://github.com/${REPO}/pull/1500`;
const SCRIPT = "console.table([{teste:'Salvar responde', ok: typeof saveCard==='function'}]); // script de exemplo";
const corpo = (s) => '## Resumo\n- conserto\n\n## Script de teste\n```javascript\n' + s + '\n```\n\nAgent: antigravity';
const ficha = (o) => Object.assign({ estado: 'em_analise', criadoEm: 1, atualizadoEm: 1, tentativas: 0, impacto: '🟠 Atrapalha muito', resumo: 'Salvar não responde', cardId: 'c_ferias_1760000000001', entregas: 1 }, o || {});
const db = (f, extra) => makeFakeDb({ kanban: Object.assign({ plantao: f ? { [ID]: f } : {}, usuarios_publicos: { adm1: { role: 'adm' }, adm2: { role: 'adm' }, mem: { role: 'membro' } }, usuarios: { adm1: {}, adm2: {}, mem: {} } }, extra || {}) });
const evento = (o) => Object.assign({ action: 'opened', repository: { full_name: REPO }, sender: { login: 'caiosoares1899' },
  pull_request: { html_url: URL, body: corpo(SCRIPT), user: { login: 'caiosoares1899' }, head: { ref: BRANCH, sha: 'a'.repeat(40), repo: { full_name: REPO } } } }, o || {});
const pr = (o) => (d, e) => processarPR({ db: d, evento: 'pull_request', p: e || evento(o), agora: AGORA });

test('PR aberta com script: ficha vira "testando", guarda PR, sha e script; avisa os ADMs (só eles, com cardId)', async () => {
  const d = db(ficha()); const r = await processarPR({ db: d, evento: 'pull_request', p: evento(), agora: AGORA });
  assert.deepEqual([r.ok, r.estado, r.comScript, r.avisados], [true, 'testando', true, 2]);
  const f = d._data().kanban.plantao[ID]; assert.equal(f.prUrl, URL); assert.equal(f.scriptTeste, SCRIPT); assert.equal(f.prSha, 'a'.repeat(40)); assert.equal(f.estado, 'testando');
  const n = d._data().kanban.usuarios.adm1.notificacoes['plantao_pr_' + ID + '_aaaaaaa']; assert.equal(n.type, 'plantao_bug'); assert.equal(n.cardId, 'c_ferias_1760000000001'); assert.match(n.title, /pronta para testar/);
  assert.equal(d._data().kanban.usuarios.mem.notificacoes, undefined);
});

test('PR sem bloco de script: estado "pr_aberto" e aviso diferente', async () => {
  const d = db(ficha()); const e = evento(); e.pull_request.body = '## Resumo\nsó isso';
  const r = await processarPR({ db: d, evento: 'pull_request', p: e, agora: AGORA });
  assert.deepEqual([r.estado, r.comScript], ['pr_aberto', false]); assert.match(d._data().kanban.usuarios.adm1.notificacoes['plantao_pr_' + ID + '_aaaaaaa'].title, /sem script/);
});

test('extrairScript: aceita js/javascript/simples, ignora o que vem antes do título e blocos curtos', () => {
  assert.equal(extrairScript(corpo(SCRIPT)), SCRIPT);
  assert.equal(extrairScript('## Script de teste\n```js\n' + SCRIPT + '\n```'), SCRIPT);
  assert.equal(extrairScript('## Script de teste\n```\n' + SCRIPT + '\n```'), SCRIPT);
  assert.equal(extrairScript('```js\n' + SCRIPT + '\n```\nsem título'), null);
  assert.equal(extrairScript('## Script de teste\n```js\nx\n```'), null, 'bloco curto demais');
  assert.equal(extrairScript(null), null);
  assert.equal(extrairScript(corpo('x'.repeat(30000))).length, 20000);
});

test('quem pode: só repo e autor da lista, branch no padrão, sem fork — o resto é ignorado e NADA é gravado', async () => {
  const casos = [
    ['outro repo', { repository: { full_name: 'x/y' } }], ['autor de fora', { sender: { login: 'qualquer' } }],
    ['branch de outro padrão', null, (e) => { e.pull_request.head.ref = 'feature/x'; }], ['fork', null, (e) => { e.pull_request.head.repo.full_name = 'outro/hering'; }],
    ['ação irrelevante', { action: 'closed' }], ['PR de outra pessoa', null, (e) => { e.pull_request.user.login = 'estranho'; }],
    ['URL de outro lugar', null, (e) => { e.pull_request.html_url = 'https://evil.com/pull/1'; }],
  ];
  for (const [nome, o, mut] of casos) {
    const d = db(ficha()); const e = evento(o || {}); if (mut) mut(e);
    const r = await processarPR({ db: d, evento: 'pull_request', p: e, agora: AGORA });
    assert.equal(r.ok, false, nome); assert.equal(d._data().kanban.plantao[ID].estado, 'em_analise', nome); assert.equal(d._data().kanban.usuarios.adm1.notificacoes, undefined, nome);
  }
  assert.equal((await processarPR({ db: db(ficha()), evento: 'issues', p: evento(), agora: AGORA })).ok, false);
});

test('sem ficha, ficha encerrada ou plantão pausado: ignora', async () => {
  assert.equal((await processarPR({ db: db(null), evento: 'pull_request', p: evento(), agora: AGORA })).motivo, 'sem_ficha');
  for (const e of ['em_prod', 'duplicado', 'cancelado']) assert.equal((await processarPR({ db: db(ficha({ estado: e })), evento: 'pull_request', p: evento(), agora: AGORA })).motivo, 'ficha_encerrada', e);
  assert.equal((await processarPR({ db: db(ficha(), { config: { plantao_ativo: false } }), evento: 'pull_request', p: evento(), agora: AGORA })).motivo, 'desligado');
});

test('nova tentativa depois de reprovado: limpa o veredito antigo e volta a "testando"', async () => {
  const d = db(ficha({ estado: 'reprovado', tentativas: 1, prSha: 'b'.repeat(40), prUrl: URL, scriptTeste: 'velho'.repeat(10), resultadoTeste: 'falhou', notaTeste: 'falhou', validadoPor: 'Bia', validadoPorUid: 'bia', validadoEm: 5 }));
  await processarPR({ db: d, evento: 'pull_request', p: evento({ action: 'synchronize' }), agora: AGORA });
  const f = d._data().kanban.plantao[ID]; assert.equal(f.estado, 'testando'); assert.equal(f.scriptTeste, SCRIPT); assert.equal(f.tentativas, 1);
  for (const c of ['resultadoTeste', 'notaTeste', 'validadoPor', 'validadoPorUid', 'validadoEm']) assert.equal(f[c] == null, true, c);
});

test('push na PR DEPOIS de validada desfaz a validação (o ADM testa de novo); o mesmo evento repetido não faz nada', async () => {
  const d = db(ficha({ estado: 'validado', prSha: 'b'.repeat(40), prUrl: URL, scriptTeste: SCRIPT, resultadoTeste: 'ok', validadoPor: 'Bia', validadoPorUid: 'bia', validadoEm: 5 }));
  const r1 = await processarPR({ db: d, evento: 'pull_request', p: evento({ action: 'synchronize' }), agora: AGORA });
  assert.equal(r1.estado, 'testando'); assert.equal(d._data().kanban.plantao[ID].resultadoTeste == null, true);
  const r2 = await processarPR({ db: d, evento: 'pull_request', p: evento({ action: 'synchronize' }), agora: AGORA });
  assert.equal(r2.semMudanca, true);
});

test('editar a PR sem o bloco de script NÃO apaga o script que já estava salvo', async () => {
  const d = db(ficha({ estado: 'testando', prSha: 'a'.repeat(40), prUrl: URL, scriptTeste: SCRIPT }));
  const e = evento({ action: 'edited' }); e.pull_request.body = '## Resumo\nreescrito';
  await processarPR({ db: d, evento: 'pull_request', p: e, agora: AGORA });
  assert.equal(d._data().kanban.plantao[ID].scriptTeste, SCRIPT);
});

test('assinatura do GitHub (HMAC-SHA256): só a válida passa', () => {
  const corpoBruto = Buffer.from('{"a":1}'), seg = 'segredo-teste';
  const boa = 'sha256=' + crypto.createHmac('sha256', seg).update(corpoBruto).digest('hex');
  assert.equal(assinaturaOk(corpoBruto, boa, seg), true);
  for (const h of [undefined, '', 'sha256=' + 'a'.repeat(64), boa.replace('sha256=', 'sha1='), boa.slice(0, -1) + (boa.endsWith('0') ? '1' : '0')]) assert.equal(assinaturaOk(corpoBruto, h, seg), false, String(h));
  assert.equal(assinaturaOk(Buffer.from('{"a":2}'), boa, seg), false, 'corpo alterado');
  assert.equal(assinaturaOk(corpoBruto, boa, ''), false);
});
