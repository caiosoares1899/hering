// functions/spotify/__tests__/radioSuggest.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const { suggestTrack, _resetOwnerTokenCache } = require('../radioSuggestCore');

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

test.beforeEach(() => { _resetOwnerTokenCache(); });

test('adiciona a faixa na playlist usando o token da CONTA DONA (refresh_token fixo, não por uid)', async () => {
  const db = makeFakeDb({ kanban: { spotify_radio_owner_secret: { refresh_token: 'owner-rt' } } });
  const calls = [];
  global.fetch = async (url, opts) => {
    calls.push(String(url));
    if (String(url).includes('accounts.spotify.com/api/token')) {
      assert.ok(String(opts.body).includes('refresh_token=owner-rt'));
      return { ok: true, json: async () => ({ access_token: 'owner-at', expires_in: 3600 }) };
    }
    if (String(url).includes('/playlists/plId123/items')) {
      assert.equal(opts.headers.Authorization, 'Bearer owner-at');
      assert.deepEqual(JSON.parse(opts.body), { uris: ['spotify:track:xyz'] });
      return { ok: true, json: async () => ({ snapshot_id: 'abc' }) };
    }
    throw new Error('URL inesperada: ' + url);
  };

  const result = await suggestTrack(db, 'fake-secret', 'plId123', 'spotify:track:xyz');
  assert.deepEqual(result, { snapshot_id: 'abc' });
});

test('usa o endpoint /playlists/{id}/items (não /tracks — renomeado na migração de fev/2026 da Web API)', async () => {
  const db = makeFakeDb({ kanban: { spotify_radio_owner_secret: { refresh_token: 'owner-rt' } } });
  let calledUrl = null;
  global.fetch = async (url) => {
    if (String(url).includes('accounts.spotify.com/api/token')) {
      return { ok: true, json: async () => ({ access_token: 'owner-at', expires_in: 3600 }) };
    }
    calledUrl = String(url);
    return { ok: true, json: async () => ({ snapshot_id: 'abc' }) };
  };

  await suggestTrack(db, 'fake-secret', 'plId123', 'spotify:track:xyz');
  assert.equal(calledUrl, 'https://api.spotify.com/v1/playlists/plId123/items');
});

test('trata 201 (status real de sucesso do Spotify pra esse endpoint) como sucesso, não só 200', async () => {
  const db = makeFakeDb({ kanban: { spotify_radio_owner_secret: { refresh_token: 'owner-rt' } } });
  global.fetch = async (url) => {
    if (String(url).includes('accounts.spotify.com/api/token')) {
      return { ok: true, json: async () => ({ access_token: 'owner-at', expires_in: 3600 }) };
    }
    // fetch() real do Node marca res.ok=true pra qualquer 2xx, incluindo
    // 201 — reproduzido aqui explicitamente pra não depender de o mock
    // "esquecer" e cair num default enganoso.
    return { ok: true, status: 201, json: async () => ({ snapshot_id: 'abc' }) };
  };

  const result = await suggestTrack(db, 'fake-secret', 'plId123', 'spotify:track:xyz');
  assert.deepEqual(result, { snapshot_id: 'abc' });
});

test('lança radio_owner_not_connected quando não existe refresh_token gravado', async () => {
  const db = makeFakeDb({ kanban: {} });
  global.fetch = async () => { throw new Error('não devia nem tentar chamar o Spotify'); };

  await assert.rejects(() => suggestTrack(db, 'fake-secret', 'plId123', 'spotify:track:xyz'), /radio_owner_not_connected/);
});

test('rotaciona o refresh_token no banco quando o Spotify manda um novo', async () => {
  const db = makeFakeDb({ kanban: { spotify_radio_owner_secret: { refresh_token: 'owner-rt-velho' } } });
  global.fetch = async (url) => {
    if (String(url).includes('accounts.spotify.com/api/token')) {
      return { ok: true, json: async () => ({ access_token: 'owner-at', expires_in: 3600, refresh_token: 'owner-rt-novo' }) };
    }
    if (String(url).includes('/items')) {
      return { ok: true, json: async () => ({}) };
    }
    throw new Error('URL inesperada: ' + url);
  };

  await suggestTrack(db, 'fake-secret', 'plId123', 'spotify:track:xyz');
  assert.equal(db._data().kanban.spotify_radio_owner_secret.refresh_token, 'owner-rt-novo');
});

test('reusa o access_token em cache entre sugestões (não bate no /token de novo)', async () => {
  const db = makeFakeDb({ kanban: { spotify_radio_owner_secret: { refresh_token: 'owner-rt' } } });
  let tokenCalls = 0;
  global.fetch = async (url) => {
    if (String(url).includes('accounts.spotify.com/api/token')) {
      tokenCalls++;
      return { ok: true, json: async () => ({ access_token: 'owner-at', expires_in: 3600 }) };
    }
    if (String(url).includes('/items')) {
      return { ok: true, json: async () => ({}) };
    }
    throw new Error('URL inesperada: ' + url);
  };

  await suggestTrack(db, 'fake-secret', 'plId123', 'spotify:track:a');
  await suggestTrack(db, 'fake-secret', 'plId123', 'spotify:track:b');
  assert.equal(tokenCalls, 1, 'segunda sugestão reusa o token cacheado');
});

test('propaga erro quando adicionar a faixa falha (ex: playlist não editável pela conta dona)', async () => {
  const db = makeFakeDb({ kanban: { spotify_radio_owner_secret: { refresh_token: 'owner-rt' } } });
  global.fetch = async (url) => {
    if (String(url).includes('accounts.spotify.com/api/token')) {
      return { ok: true, json: async () => ({ access_token: 'owner-at', expires_in: 3600 }) };
    }
    if (String(url).includes('/items')) {
      return { ok: false, status: 403, text: async () => 'Forbidden' };
    }
    // Diagnóstico de propriedade (GET /me e GET /playlists/{id}) — não
    // mockado nesse teste de propósito, só confirma que o erro original
    // ainda propaga mesmo se o diagnóstico falhar (ver teste seguinte
    // pro caso feliz do diagnóstico).
    throw new Error('URL inesperada: ' + url);
  };

  await assert.rejects(() => suggestTrack(db, 'fake-secret', 'plId123', 'spotify:track:xyz'), /add_track_failed: http_403/);
});

test('em 403, roda o diagnóstico de propriedade (GET /me + GET playlist) com o token certo, sem afetar o erro original', async () => {
  const db = makeFakeDb({ kanban: { spotify_radio_owner_secret: { refresh_token: 'owner-rt' } } });
  const diagCalls = [];
  global.fetch = async (url, opts) => {
    if (String(url).includes('accounts.spotify.com/api/token')) {
      return { ok: true, json: async () => ({ access_token: 'owner-at', expires_in: 3600 }) };
    }
    if (String(url).includes('/playlists/plId123/items')) {
      return { ok: false, status: 403, text: async () => 'Forbidden' };
    }
    if (String(url) === 'https://api.spotify.com/v1/me') {
      diagCalls.push({ url: String(url), auth: opts.headers.Authorization });
      return { ok: true, json: async () => ({ id: 'owner-account-id', display_name: 'Dono Real' }) };
    }
    if (String(url).includes('/v1/playlists/plId123?fields=')) {
      diagCalls.push({ url: String(url), auth: opts.headers.Authorization });
      return { ok: true, json: async () => ({ name: 'Rádio dev', owner: { id: 'outra-conta-id', display_name: 'Outra Pessoa' }, collaborative: false }) };
    }
    throw new Error('URL inesperada: ' + url);
  };

  await assert.rejects(() => suggestTrack(db, 'fake-secret', 'plId123', 'spotify:track:xyz'), /add_track_failed: http_403/);
  assert.equal(diagCalls.length, 2, 'chamou GET /me e GET /playlists/{id} pro diagnóstico');
  assert.ok(diagCalls.every((c) => c.auth === 'Bearer owner-at'), 'diagnóstico usa o mesmo token da conta dona, não um token diferente');
});

test('diagnóstico de propriedade falhando (rede fora) não impede o erro original de propagar', async () => {
  const db = makeFakeDb({ kanban: { spotify_radio_owner_secret: { refresh_token: 'owner-rt' } } });
  global.fetch = async (url) => {
    if (String(url).includes('accounts.spotify.com/api/token')) {
      return { ok: true, json: async () => ({ access_token: 'owner-at', expires_in: 3600 }) };
    }
    if (String(url).includes('/playlists/plId123/items')) {
      return { ok: false, status: 403, text: async () => 'Forbidden' };
    }
    throw new Error('rede caiu no diagnóstico');
  };

  await assert.rejects(() => suggestTrack(db, 'fake-secret', 'plId123', 'spotify:track:xyz'), /add_track_failed: http_403/);
});
