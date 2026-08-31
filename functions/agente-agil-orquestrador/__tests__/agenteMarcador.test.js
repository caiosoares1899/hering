// functions/agente-agil-orquestrador/__tests__/agenteMarcador.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const { resolveAgentesResponsaveis, montarComentarioMarcador, marcarAgenteResponsavel } = require('../agenteMarcador');

const AGENTES = [
  { id: 'ag1', nome: 'Claude Code', init: 'CC', avatarEmoji: '✨' },
  { id: 'ag2', nome: 'Agente Fictício (exemplo)', init: 'AF', avatarEmoji: '🤖' },
];

test('resolveAgentesResponsaveis acha agente pelo owner', () => {
  const card = { owner: 'CC' };
  assert.deepEqual(resolveAgentesResponsaveis(card, AGENTES), [AGENTES[0]]);
});

test('resolveAgentesResponsaveis acha agente pelos participants', () => {
  const card = { owner: 'ANA', participants: ['BRU', 'AF'] };
  assert.deepEqual(resolveAgentesResponsaveis(card, AGENTES), [AGENTES[1]]);
});

test('resolveAgentesResponsaveis acha os dois se owner E participant forem agentes diferentes', () => {
  const card = { owner: 'CC', participants: ['AF'] };
  const resultado = resolveAgentesResponsaveis(card, AGENTES);
  assert.equal(resultado.length, 2);
});

test('resolveAgentesResponsaveis: card sem nenhum agente -> lista vazia', () => {
  assert.deepEqual(resolveAgentesResponsaveis({ owner: 'ANA', participants: ['BRU'] }, AGENTES), []);
});

test('resolveAgentesResponsaveis: sem agentes cadastrados no squad -> lista vazia, não quebra', () => {
  assert.deepEqual(resolveAgentesResponsaveis({ owner: 'CC' }, []), []);
  assert.deepEqual(resolveAgentesResponsaveis({ owner: 'CC' }, null), []);
});

test('resolveAgentesResponsaveis: card vazio/sem owner nem participants -> lista vazia', () => {
  assert.deepEqual(resolveAgentesResponsaveis({}, AGENTES), []);
  assert.deepEqual(resolveAgentesResponsaveis(null, AGENTES), []);
});

test('montarComentarioMarcador formata 1 agente', () => {
  assert.equal(montarComentarioMarcador([AGENTES[0]]), '📎 cc: ✨ Claude Code — responsável por este card.');
});

test('montarComentarioMarcador formata múltiplos agentes, separados por vírgula', () => {
  assert.equal(montarComentarioMarcador(AGENTES), '📎 cc: ✨ Claude Code, 🤖 Agente Fictício (exemplo) — responsável por este card.');
});

test('montarComentarioMarcador: lista vazia -> null (nada pra postar)', () => {
  assert.equal(montarComentarioMarcador([]), null);
  assert.equal(montarComentarioMarcador(null), null);
});

test('marcarAgenteResponsavel: sem ações (nada mudou) -> não posta, nem chega a ler o Firebase', async () => {
  const db = makeFakeDb({});
  let handlerChamado = false;
  const comentarioTool = { handler: async () => { handlerChamado = true; } };
  const resultado = await marcarAgenteResponsavel(db, { squadId: 'dev', cardId: 'c1', card: { owner: 'CC' }, acoes: [], comentarioTool, dryRun: false });
  assert.deepEqual(resultado, { posted: false, reason: 'no_actions' });
  assert.equal(handlerChamado, false);
});

test('marcarAgenteResponsavel: card sem agente responsável -> não posta', async () => {
  const db = makeFakeDb({ kanban: { squads: { dev: { dados: { agentes: { ag1: AGENTES[0] } } } } } });
  let handlerChamado = false;
  const comentarioTool = { handler: async () => { handlerChamado = true; } };
  const resultado = await marcarAgenteResponsavel(db, { squadId: 'dev', cardId: 'c1', card: { owner: 'ANA' }, acoes: ['moveu para Concluído'], comentarioTool, dryRun: false });
  assert.deepEqual(resultado, { posted: false, reason: 'no_agent_responsible' });
  assert.equal(handlerChamado, false);
});

test('marcarAgenteResponsavel: card com agente responsável e algo mudou -> posta via comentarioTool.handler', async () => {
  const db = makeFakeDb({ kanban: { squads: { dev: { dados: { agentes: { ag1: AGENTES[0] } } } } } });
  let chamadaComTexto = null;
  const comentarioTool = { handler: async (input) => { chamadaComTexto = input; } };
  const resultado = await marcarAgenteResponsavel(db, { squadId: 'dev', cardId: 'c1', card: { owner: 'CC' }, acoes: ['moveu para Concluído'], comentarioTool, dryRun: false });
  assert.equal(resultado.posted, true);
  assert.deepEqual(chamadaComTexto, { type: 'comentario', texto: '📎 cc: ✨ Claude Code — responsável por este card.' });
});

test('marcarAgenteResponsavel: dryRun -> calcula o texto mas NÃO chama o handler (não escreve de verdade)', async () => {
  const db = makeFakeDb({ kanban: { squads: { dev: { dados: { agentes: { ag1: AGENTES[0] } } } } } });
  let handlerChamado = false;
  const comentarioTool = { handler: async () => { handlerChamado = true; } };
  const resultado = await marcarAgenteResponsavel(db, { squadId: 'dev', cardId: 'c1', card: { owner: 'CC' }, acoes: ['moveu para Concluído'], comentarioTool, dryRun: true });
  assert.equal(resultado.posted, false);
  assert.equal(resultado.reason, 'dry_run');
  assert.ok(resultado.texto);
  assert.equal(handlerChamado, false);
});

test('marcarAgenteResponsavel: falha ao ler o Firebase não derruba o fluxo (melhor esforço)', async () => {
  const db = { ref: () => ({ get: async () => { throw new Error('boom'); } }) };
  const resultado = await marcarAgenteResponsavel(db, { squadId: 'dev', cardId: 'c1', card: { owner: 'CC' }, acoes: ['moveu para Concluído'], comentarioTool: { handler: async () => {} }, dryRun: false });
  assert.equal(resultado.posted, false);
  assert.equal(resultado.reason, 'error');
});
