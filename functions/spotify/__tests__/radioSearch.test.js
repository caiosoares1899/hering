// functions/spotify/__tests__/radioSearch.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const { searchTracks, _resetAppTokenCache } = require('../radioSearchCore');

test.beforeEach(() => { _resetAppTokenCache(); });

test('busca faixas via client_credentials (sem token de usuário nenhum) e mapeia a menor imagem', async () => {
  const calls = [];
  global.fetch = async (url, opts) => {
    calls.push(String(url));
    if (String(url).includes('accounts.spotify.com/api/token')) {
      assert.ok(String(opts.body).includes('grant_type=client_credentials'), 'usa client_credentials, não refresh_token/authorization_code');
      return { ok: true, json: async () => ({ access_token: 'app-token', expires_in: 3600 }) };
    }
    if (String(url).includes('/v1/search')) {
      assert.equal(opts.headers.Authorization, 'Bearer app-token');
      return {
        ok: true,
        json: async () => ({
          tracks: {
            items: [
              { uri: 'spotify:track:1', id: '1', name: 'Track A', artists: [{ name: 'Artist A' }], album: { name: 'Album A', images: [{ url: 'big.jpg' }, { url: 'small.jpg' }] }, duration_ms: 200000 },
            ],
          },
        }),
      };
    }
    throw new Error('URL inesperada: ' + url);
  };

  const tracks = await searchTracks('fake-secret', 'alguma musica');
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].name, 'Track A');
  assert.equal(tracks[0].artist, 'Artist A');
  assert.equal(tracks[0].albumArt, 'small.jpg', 'pega a MENOR imagem (última do array)');
  assert.equal(tracks[0].uri, 'spotify:track:1');
});

test('reusa o token app-only em cache entre buscas (não bate no /token de novo)', async () => {
  let tokenCalls = 0;
  global.fetch = async (url) => {
    if (String(url).includes('accounts.spotify.com/api/token')) {
      tokenCalls++;
      return { ok: true, json: async () => ({ access_token: 'app-token', expires_in: 3600 }) };
    }
    if (String(url).includes('/v1/search')) {
      return { ok: true, json: async () => ({ tracks: { items: [] } }) };
    }
    throw new Error('URL inesperada: ' + url);
  };

  await searchTracks('fake-secret', 'a');
  await searchTracks('fake-secret', 'b');
  assert.equal(tokenCalls, 1, 'segunda busca reusa o token cacheado');
});

test('propaga erro quando a busca falha', async () => {
  global.fetch = async (url) => {
    if (String(url).includes('accounts.spotify.com/api/token')) {
      return { ok: true, json: async () => ({ access_token: 'app-token', expires_in: 3600 }) };
    }
    if (String(url).includes('/v1/search')) {
      return { ok: false, status: 500 };
    }
    throw new Error('URL inesperada: ' + url);
  };

  await assert.rejects(() => searchTracks('fake-secret', 'a'), /http_500/);
});
