// functions/agente-agil-orquestrador/__tests__/agenteMarcador.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const {
  resolveAgentesResponsaveis,
  agentesExternosDoSquad,
  montarComentarioMarcador,
  marcarAgenteResponsavel,
} = require('../agenteMarcador');

function withMockFetch(impl, fn) {
  return async () => {
    const original = global.fetch;
    global.fetch = impl;
    try {
      await fn();
    } finally {
      global.fetch = original;
    }
  };
}

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

// ── Agentes externos (2026-09-01) ────────────────────────────────────────
const AGENTE_EXTERNO_VTEX = { nome: 'Agente VM Vtex', init: 'AVV', avatarEmoji: '🔌', webhookUrl: 'https://vtex.example.com/hook', squads: { dev: true } };

test('agentesExternosDoSquad: só entra quem tem squads[squadId]===true E init preenchido', () => {
  const raw = {
    vtex: AGENTE_EXTERNO_VTEX,
    databricks: { nome: 'Databricks', descricao: 'manda dados', squads: { dev: true } }, // sem init -> só contexto, não vira responsável
    outroSquad: { nome: 'Outro', init: 'OUT', squads: { dados: true } }, // não habilitado em dev
  };
  const lista = agentesExternosDoSquad(raw, 'dev');
  assert.equal(lista.length, 1);
  assert.equal(lista[0].id, 'vtex');
  assert.equal(lista[0].init, 'AVV');
  assert.equal(lista[0].webhookUrl, 'https://vtex.example.com/hook');
});

test('agentesExternosDoSquad: sem registro nenhum -> lista vazia, não quebra', () => {
  assert.deepEqual(agentesExternosDoSquad(null, 'dev'), []);
  assert.deepEqual(agentesExternosDoSquad({}, 'dev'), []);
});

function seedDbComExterno({ squadId = 'dev', agentesDecorativos = {}, agentesExternos = {} } = {}) {
  return makeFakeDb({
    kanban: {
      squads: { [squadId]: { dados: { agentes: agentesDecorativos } } },
      config: { agentesExternos },
    },
  });
}

test(
  'marcarAgenteResponsavel: agente externo responsável, squad habilitado e com webhook -> posta cc E chama o webhook',
  withMockFetch(
    async (url, opts) => {
      assert.equal(url, 'https://vtex.example.com/hook');
      const body = JSON.parse(opts.body);
      assert.equal(body.especialista, 'vtex');
      assert.ok(body.mensagem.includes('moveu para Em andamento'));
      return { ok: true, status: 200 };
    },
    async () => {
      const db = seedDbComExterno({ agentesExternos: { vtex: AGENTE_EXTERNO_VTEX } });
      let textoComentario = null;
      const comentarioTool = { handler: async (input) => { textoComentario = input.texto; } };
      const resultado = await marcarAgenteResponsavel(db, {
        squadId: 'dev', cardId: 'c1', card: { owner: 'AVV' }, acoes: ['moveu para Em andamento'], comentarioTool, dryRun: false,
      });
      assert.equal(resultado.posted, true);
      assert.ok(textoComentario.includes('🔌 Agente VM Vtex'));
      assert.equal(resultado.webhooks.length, 1);
      assert.equal(resultado.webhooks[0].especialista, 'vtex');
      assert.equal(resultado.webhooks[0].ok, true);
    }
  )
);

test('marcarAgenteResponsavel: agente externo responsável fora de NOTIFICAR_ESPECIALISTA_SQUADS -> cc postado, webhook NÃO chamado', async () => {
  const db = seedDbComExterno({
    squadId: 'dados',
    agentesExternos: { vtex: { ...AGENTE_EXTERNO_VTEX, squads: { dados: true } } },
  });
  let fetchChamado = false;
  const original = global.fetch;
  global.fetch = async () => { fetchChamado = true; return { ok: true, status: 200 }; };
  try {
    const comentarioTool = { handler: async () => {} };
    const resultado = await marcarAgenteResponsavel(db, {
      squadId: 'dados', cardId: 'c1', card: { owner: 'AVV' }, acoes: ['moveu para Em andamento'], comentarioTool, dryRun: false,
    });
    assert.equal(resultado.posted, true);
    assert.deepEqual(resultado.webhooks, []);
    assert.equal(fetchChamado, false);
  } finally {
    global.fetch = original;
  }
});

test('marcarAgenteResponsavel: agente externo responsável sem webhookUrl cadastrado -> cc postado, webhook pulado (sem erro)', async () => {
  const db = seedDbComExterno({
    agentesExternos: { vtex: { ...AGENTE_EXTERNO_VTEX, webhookUrl: '' } },
  });
  const comentarioTool = { handler: async () => {} };
  const resultado = await marcarAgenteResponsavel(db, {
    squadId: 'dev', cardId: 'c1', card: { owner: 'AVV' }, acoes: ['moveu para Em andamento'], comentarioTool, dryRun: false,
  });
  assert.equal(resultado.posted, true);
  assert.deepEqual(resultado.webhooks, []);
});

test('marcarAgenteResponsavel: mistura agente decorativo + agente externo responsáveis no mesmo card -> um comentário só, com os dois', async () => {
  const db = seedDbComExterno({
    agentesDecorativos: { ag1: { id: 'ag1', nome: 'Claude Code', init: 'CC', avatarEmoji: '✨' } },
    agentesExternos: { vtex: { ...AGENTE_EXTERNO_VTEX, webhookUrl: '' } },
  });
  let textoComentario = null;
  const comentarioTool = { handler: async (input) => { textoComentario = input.texto; } };
  const resultado = await marcarAgenteResponsavel(db, {
    squadId: 'dev', cardId: 'c1', card: { owner: 'CC', participants: ['AVV'] }, acoes: ['moveu para Em andamento'], comentarioTool, dryRun: false,
  });
  assert.equal(resultado.posted, true);
  assert.ok(textoComentario.includes('✨ Claude Code'));
  assert.ok(textoComentario.includes('🔌 Agente VM Vtex'));
});

test('marcarAgenteResponsavel: dryRun -> não chama nem o comentário nem o webhook do agente externo', async () => {
  const db = seedDbComExterno({ agentesExternos: { vtex: AGENTE_EXTERNO_VTEX } });
  let fetchChamado = false;
  const original = global.fetch;
  global.fetch = async () => { fetchChamado = true; return { ok: true, status: 200 }; };
  try {
    const comentarioTool = { handler: async () => {} };
    const resultado = await marcarAgenteResponsavel(db, {
      squadId: 'dev', cardId: 'c1', card: { owner: 'AVV' }, acoes: ['moveu para Em andamento'], comentarioTool, dryRun: true,
    });
    assert.equal(resultado.posted, false);
    assert.equal(resultado.reason, 'dry_run');
    assert.equal(fetchChamado, false);
  } finally {
    global.fetch = original;
  }
});
