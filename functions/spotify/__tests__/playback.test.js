// functions/spotify/__tests__/playback.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const { controlPlayback } = require('../playbackCore');
const { _accessTokenCache } = require('../syncCore');

function makeFakeDb(initial) {
  const data = JSON.parse(JSON.stringify(initial));
  function getAt(p) {
    const parts = p.split('/').filter(Boolean);
    let cur = data;
    for (const part of parts) cur = cur && cur[part];
    return cur;
  }
  function setAt(p, value) {
    const parts = p.split('/').filter(Boolean);
    let cur = data;
    for (let i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }
  return {
    ref(p) {
      return {
        get: async () => ({ val: () => (getAt(p) === undefined ? null : getAt(p)) }),
        set: async (v) => setAt(p, v),
      };
    },
    _data: () => data,
  };
}

test.beforeEach(() => { _accessTokenCache.clear(); });

test('play: usa o token PESSOAL do uid (spotify_secrets/{uid}), não o da conta dona da Rádio', async () => {
  const db = makeFakeDb({ kanban: { spotify_secrets: { uidA: { refresh_token: 'rtA-pessoal' } } } });
  let playCall = null;
  global.fetch = async (url, opts) => {
    if (String(url).includes('accounts.spotify.com/api/token')) {
      assert.ok(String(opts.body).includes('refresh_token=rtA-pessoal'));
      return { ok: true, json: async () => ({ access_token: 'atA', expires_in: 3600 }) };
    }
    if (String(url) === 'https://api.spotify.com/v1/me/player/play') {
      playCall = { method: opts.method, auth: opts.headers.Authorization };
      return { ok: true, status: 204 };
    }
    throw new Error('URL inesperada: ' + url);
  };

  const result = await controlPlayback(db, 'fake-secret', 'uidA', 'play');
  assert.deepEqual(result, { ok: true });
  assert.equal(playCall.method, 'PUT');
  assert.equal(playCall.auth, 'Bearer atA');
});

test('pause: chama PUT /me/player/pause', async () => {
  const db = makeFakeDb({ kanban: { spotify_secrets: { uidA: { refresh_token: 'rtA' } } } });
  let calledUrl = null, calledMethod = null;
  global.fetch = async (url, opts) => {
    if (String(url).includes('accounts.spotify.com/api/token')) {
      return { ok: true, json: async () => ({ access_token: 'atA', expires_in: 3600 }) };
    }
    calledUrl = String(url); calledMethod = opts.method;
    return { ok: true, status: 204 };
  };

  const result = await controlPlayback(db, 'fake-secret', 'uidA', 'pause');
  assert.deepEqual(result, { ok: true });
  assert.equal(calledUrl, 'https://api.spotify.com/v1/me/player/pause');
  assert.equal(calledMethod, 'PUT');
});

test('next: chama POST /me/player/next', async () => {
  const db = makeFakeDb({ kanban: { spotify_secrets: { uidA: { refresh_token: 'rtA' } } } });
  let calledUrl = null, calledMethod = null;
  global.fetch = async (url, opts) => {
    if (String(url).includes('accounts.spotify.com/api/token')) {
      return { ok: true, json: async () => ({ access_token: 'atA', expires_in: 3600 }) };
    }
    calledUrl = String(url); calledMethod = opts.method;
    return { ok: true, status: 204 };
  };

  const result = await controlPlayback(db, 'fake-secret', 'uidA', 'next');
  assert.deepEqual(result, { ok: true });
  assert.equal(calledUrl, 'https://api.spotify.com/v1/me/player/next');
  assert.equal(calledMethod, 'POST');
});

test('lança invalid_action pra uma ação fora de play/pause/next', async () => {
  const db = makeFakeDb({ kanban: {} });
  await assert.rejects(() => controlPlayback(db, 'fake-secret', 'uidA', 'previous'), /invalid_action/);
});

test('devolve not_connected sem chamar o Spotify quando o uid nunca conectou', async () => {
  const db = makeFakeDb({ kanban: { spotify_secrets: {} } });
  global.fetch = async () => { throw new Error('não devia chamar o Spotify pra quem não conectou'); };

  const result = await controlPlayback(db, 'fake-secret', 'uidNuncaConectou', 'play');
  assert.deepEqual(result, { error: 'not_connected' });
});

test('distingue PREMIUM_REQUIRED (reason no corpo) de outros 403', async () => {
  const db = makeFakeDb({ kanban: { spotify_secrets: { uidA: { refresh_token: 'rtA' } } } });
  global.fetch = async (url) => {
    if (String(url).includes('accounts.spotify.com/api/token')) {
      return { ok: true, json: async () => ({ access_token: 'atA', expires_in: 3600 }) };
    }
    return { ok: false, status: 403, json: async () => ({ error: { status: 403, message: 'Player command failed: Premium required', reason: 'PREMIUM_REQUIRED' } }) };
  };

  const result = await controlPlayback(db, 'fake-secret', 'uidA', 'play');
  assert.deepEqual(result, { error: 'premium_required' });
});

test('distingue NO_ACTIVE_DEVICE (reason no corpo, status 404)', async () => {
  const db = makeFakeDb({ kanban: { spotify_secrets: { uidA: { refresh_token: 'rtA' } } } });
  global.fetch = async (url) => {
    if (String(url).includes('accounts.spotify.com/api/token')) {
      return { ok: true, json: async () => ({ access_token: 'atA', expires_in: 3600 }) };
    }
    return { ok: false, status: 404, json: async () => ({ error: { status: 404, message: 'Device not found', reason: 'NO_ACTIVE_DEVICE' } }) };
  };

  const result = await controlPlayback(db, 'fake-secret', 'uidA', 'pause');
  assert.deepEqual(result, { error: 'no_active_device' });
});

test('trata 404 puro (sem reason no corpo) também como no_active_device', async () => {
  const db = makeFakeDb({ kanban: { spotify_secrets: { uidA: { refresh_token: 'rtA' } } } });
  global.fetch = async (url) => {
    if (String(url).includes('accounts.spotify.com/api/token')) {
      return { ok: true, json: async () => ({ access_token: 'atA', expires_in: 3600 }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };

  const result = await controlPlayback(db, 'fake-secret', 'uidA', 'next');
  assert.deepEqual(result, { error: 'no_active_device' });
});

test('distingue escopo insuficiente ("Insufficient client scope") de um 403 genérico', async () => {
  const db = makeFakeDb({ kanban: { spotify_secrets: { uidA: { refresh_token: 'rtA' } } } });
  global.fetch = async (url) => {
    if (String(url).includes('accounts.spotify.com/api/token')) {
      return { ok: true, json: async () => ({ access_token: 'atA', expires_in: 3600 }) };
    }
    return { ok: false, status: 403, json: async () => ({ error: { status: 403, message: 'Insufficient client scope' } }) };
  };

  const result = await controlPlayback(db, 'fake-secret', 'uidA', 'play');
  assert.deepEqual(result, { error: 'insufficient_scope' });
});

test('403 genérico (nem premium nem escopo) cai no fallback playback_failed com detail', async () => {
  const db = makeFakeDb({ kanban: { spotify_secrets: { uidA: { refresh_token: 'rtA' } } } });
  global.fetch = async (url) => {
    if (String(url).includes('accounts.spotify.com/api/token')) {
      return { ok: true, json: async () => ({ access_token: 'atA', expires_in: 3600 }) };
    }
    return { ok: false, status: 403, json: async () => ({ error: { status: 403, message: 'Forbidden' } }) };
  };

  const result = await controlPlayback(db, 'fake-secret', 'uidA', 'play');
  assert.equal(result.error, 'playback_failed');
  assert.ok(result.detail.includes('http_403'));
});

test('reusa o access_token cacheado do syncCore (mesmo cache, não bate no /token de novo)', async () => {
  const db = makeFakeDb({ kanban: { spotify_secrets: { uidA: { refresh_token: 'rtA' } } } });
  let tokenCalls = 0;
  global.fetch = async (url) => {
    if (String(url).includes('accounts.spotify.com/api/token')) {
      tokenCalls++;
      return { ok: true, json: async () => ({ access_token: 'atA', expires_in: 3600 }) };
    }
    return { ok: true, status: 204 };
  };

  await controlPlayback(db, 'fake-secret', 'uidA', 'play');
  await controlPlayback(db, 'fake-secret', 'uidA', 'pause');
  assert.equal(tokenCalls, 1, 'segunda ação reusa o token cacheado (mesmo cache do sync)');
});

test('BUG DE PRODUÇÃO CORRIGIDO: distingue 401 "Permissions missing" (família /me/player/*) como insufficient_scope', async () => {
  // Achado em produção: alguém reconectado (com o escopo novo, de
  // verdade) tomou 401 "Permissions missing" ao tentar usar o controle
  // — não 403 "Insufficient client scope" como as outras partes da Web
  // API. Confirmado que é assim mesmo que o Spotify responde pra essa
  // família de endpoints específica.
  const db = makeFakeDb({ kanban: { spotify_secrets: { uidA: { refresh_token: 'rtA' } } } });
  global.fetch = async (url) => {
    if (String(url).includes('accounts.spotify.com/api/token')) {
      return { ok: true, json: async () => ({ access_token: 'atA', expires_in: 3600 }) };
    }
    return { ok: false, status: 401, json: async () => ({ error: { status: 401, message: 'Permissions missing' } }) };
  };

  const result = await controlPlayback(db, 'fake-secret', 'uidA', 'pause');
  assert.deepEqual(result, { error: 'insufficient_scope' });
});

test('BUG DE PRODUÇÃO CORRIGIDO: persiste o refresh_token novo no banco quando o Spotify rotaciona durante um controle de playback', async () => {
  // Antes desse fix, controlPlayback ignorava tok.newRefreshToken —
  // diferente de _syncOneUser(), que já persistia. Sem persistir, o
  // próximo tick do sync usaria o refresh_token velho, que o Spotify
  // pode já ter invalidado (rotação costuma ser de uso único),
  // derrubando a conexão por invalid_grant sem motivo real.
  const db = makeFakeDb({ kanban: { spotify_secrets: { uidA: { refresh_token: 'rtA-velho' } } } });
  global.fetch = async (url) => {
    if (String(url).includes('accounts.spotify.com/api/token')) {
      return { ok: true, json: async () => ({ access_token: 'atA', expires_in: 3600, refresh_token: 'rtA-novo-rotacionado' }) };
    }
    return { ok: true, status: 204 };
  };

  await controlPlayback(db, 'fake-secret', 'uidA', 'play');
  assert.equal(db._data().kanban.spotify_secrets.uidA.refresh_token, 'rtA-novo-rotacionado');
});
