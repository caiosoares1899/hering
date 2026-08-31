// functions/agente-agil-orquestrador/__tests__/notificarEspecialistaExterno.test.js
//
// Cobertura do handler real de notificar_especialista_externo (tools/
// notificarEspecialistaExterno.js) — lê o webhookUrl de kanban/config/
// agentesExternos/{especialista} (cadastrado em painel.html) e faz um POST
// de verdade. `fetch` é substituído por um mock local (Node global) em
// cada teste que precisa dele, sempre restaurado no finally — sem tocar
// rede nenhuma de verdade.
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFakeDb } = require('../../agente-agil/__tests__/fakeDb');
const {
  notificarEspecialistaExternoSchema,
  makeFakeNotificarEspecialistaExternoHandler,
  makeRealNotificarEspecialistaExternoHandler,
} = require('../tools/notificarEspecialistaExterno');

function seedDb(agentesExternos = {}) {
  return makeFakeDb({
    kanban: { config: { agentesExternos } },
  });
}

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

test('notificarEspecialistaExternoSchema exige especialista e mensagem não vazios', () => {
  assert.equal(notificarEspecialistaExternoSchema.safeParse({}).success, false);
  assert.equal(notificarEspecialistaExternoSchema.safeParse({ especialista: 'databricks' }).success, false);
  assert.equal(notificarEspecialistaExternoSchema.safeParse({ especialista: 'databricks', mensagem: 'oi' }).success, true);
});

test('fake handler: simulado, não chama fetch nenhum', async () => {
  const handler = makeFakeNotificarEspecialistaExternoHandler();
  const result = await handler({ especialista: 'databricks', mensagem: 'teste' });
  assert.equal(result.ok, true);
  assert.equal(result.simulated, true);
});

test('especialista sem webhookUrl cadastrado — erro claro, não tenta chamar fetch', async () => {
  const db = seedDb({ databricks: { descricao: 'faz análise de mídia', webhookUrl: '' } });
  const handler = makeRealNotificarEspecialistaExternoHandler({ db, squadId: 'dev', cardId: 'c9', dryRun: false });

  const result = await handler({ especialista: 'databricks', mensagem: 'card concluído' });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'webhook_nao_configurado');
});

test('especialista inexistente no cadastro — mesmo erro de webhook não configurado', async () => {
  const db = seedDb({});
  const handler = makeRealNotificarEspecialistaExternoHandler({ db, squadId: 'dev', cardId: 'c9', dryRun: false });

  const result = await handler({ especialista: 'inexistente', mensagem: 'card concluído' });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'webhook_nao_configurado');
});

test('URL cadastrada não é http(s) — recusa, não chama fetch', async () => {
  const db = seedDb({ databricks: { webhookUrl: 'ftp://exemplo.com/x' } });
  const handler = makeRealNotificarEspecialistaExternoHandler({ db, squadId: 'dev', cardId: 'c9', dryRun: false });

  const result = await handler({ especialista: 'databricks', mensagem: 'card concluído' });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'webhook_url_invalida');
});

test('dryRun (default): monta o payload mas não chama fetch de verdade', async () => {
  const db = seedDb({ databricks: { webhookUrl: 'https://exemplo.com/webhook' } });
  const handler = makeRealNotificarEspecialistaExternoHandler({ db, squadId: 'dev', cardId: 'c9' });

  const result = await handler({ especialista: 'databricks', mensagem: 'card concluído' });

  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.wouldHaveExecuted.especialista, 'databricks');
  assert.equal(result.wouldHaveExecuted.mensagem, 'card concluído');
  assert.equal(result.wouldHaveExecuted.cardId, 'c9');
});

test(
  'dryRun:false — chama o webhook de verdade (POST, JSON) e devolve sucesso em 2xx',
  withMockFetch(
    async (url, opts) => {
      assert.equal(url, 'https://exemplo.com/webhook');
      assert.equal(opts.method, 'POST');
      assert.equal(opts.headers['Content-Type'], 'application/json');
      const body = JSON.parse(opts.body);
      assert.equal(body.especialista, 'databricks');
      assert.equal(body.mensagem, 'card concluído');
      assert.equal(body.cardId, 'c9');
      assert.equal(body.squadId, 'dev');
      return { ok: true, status: 200 };
    },
    async () => {
      const db = seedDb({ databricks: { webhookUrl: 'https://exemplo.com/webhook' } });
      const handler = makeRealNotificarEspecialistaExternoHandler({ db, squadId: 'dev', cardId: 'c9', dryRun: false });

      const result = await handler({ especialista: 'databricks', mensagem: 'card concluído' });

      assert.equal(result.ok, true);
      assert.equal(result.dryRun, false);
    }
  )
);

test(
  'webhook responde HTTP não-2xx — ok:false, erro claro, não lança exceção',
  withMockFetch(
    async () => ({ ok: false, status: 500 }),
    async () => {
      const db = seedDb({ databricks: { webhookUrl: 'https://exemplo.com/webhook' } });
      const handler = makeRealNotificarEspecialistaExternoHandler({ db, squadId: 'dev', cardId: 'c9', dryRun: false });

      const result = await handler({ especialista: 'databricks', mensagem: 'card concluído' });

      assert.equal(result.ok, false);
      assert.equal(result.error, 'webhook_http_error');
      assert.equal(result.status, 500);
    }
  )
);

test(
  'fetch lança exceção de rede — ok:false, erro claro, não propaga a exceção',
  withMockFetch(
    async () => {
      throw new Error('network down');
    },
    async () => {
      const db = seedDb({ databricks: { webhookUrl: 'https://exemplo.com/webhook' } });
      const handler = makeRealNotificarEspecialistaExternoHandler({ db, squadId: 'dev', cardId: 'c9', dryRun: false });

      const result = await handler({ especialista: 'databricks', mensagem: 'card concluído' });

      assert.equal(result.ok, false);
      assert.equal(result.error, 'webhook_falhou');
    }
  )
);

test(
  'fetch aborta (timeout) — ok:false, erro específico de timeout',
  withMockFetch(
    async (url, opts) => {
      return new Promise((resolve, reject) => {
        opts.signal.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    },
    async () => {
      const db = seedDb({ databricks: { webhookUrl: 'https://exemplo.com/webhook' } });
      const handler = makeRealNotificarEspecialistaExternoHandler({ db, squadId: 'dev', cardId: 'c9', dryRun: false });
      // Aborta na hora (não espera os 8s de verdade) — dispara o abort
      // manualmente pra não deixar o teste lento.
      const originalAbortController = global.AbortController;
      global.AbortController = class extends originalAbortController {
        constructor() {
          super();
          setTimeout(() => this.abort(), 5);
        }
      };
      try {
        const result = await handler({ especialista: 'databricks', mensagem: 'card concluído' });
        assert.equal(result.ok, false);
        assert.equal(result.error, 'webhook_timeout');
      } finally {
        global.AbortController = originalAbortController;
      }
    }
  )
);
