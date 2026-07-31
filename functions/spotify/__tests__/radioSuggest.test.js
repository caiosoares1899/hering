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
    if (String(url).includes('/playlists/plId123/tracks')) {
      assert.equal(opts.headers.Authorization, 'Bearer owner-at');
      assert.deepEqual(JSON.parse(opts.body), { uris: ['spotify:track:xyz'] });
      return { ok: true, json: async () => ({ snapshot_id: 'abc' }) };
    }
    throw new Error('URL inesperada: ' + url);
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
    if (String(url).includes('/tracks')) {
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
    if (String(url).includes('/tracks')) {
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
    if (String(url).includes('/tracks')) {
      return { ok: false, status: 403, text: async () => 'Forbidden' };
    }
    throw new Error('URL inesperada: ' + url);
  };

  await assert.rejects(() => suggestTrack(db, 'fake-secret', 'plId123', 'spotify:track:xyz'), /add_track_failed: http_403/);
});
