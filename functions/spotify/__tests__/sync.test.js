// functions/spotify/__tests__/sync.test.js
//
// Testa a lógica pura de syncCore.js (não o wrapper onSchedule de sync.js
// — ver comentário lá) contra um fetch mockado e um fake db local que
// entende multi-path update() a partir da raiz (db.ref().update({'a/b':
// val})), que é como oauth.js/disconnect.js/syncCore.js escrevem de
// verdade. Não reusa functions/agente-agil/__tests__/fakeDb.js porque
// aquele ref(path).update() faz merge NO path dado, não trata as chaves
// do patch como paths completos a partir da raiz — semânticas diferentes,
// as duas corretas pro que cada conjunto de functions realmente faz.
const test = require('node:test');
const assert = require('node:assert/strict');

const { runSpotifySync, _accessTokenCache } = require('../syncCore');

function makeFakeDb(initial) {
  const data = JSON.parse(JSON.stringify(initial));
  function getAt(p) {
    const parts = p.split('/').filter(Boolean);
    let cur = data;
    for (const part of parts) cur = cur && cur[part];
    return cur;
  }
  const updateCalls = [];
  return {
    ref(p) {
      if (p === undefined) {
        return { update: async (updates) => { updateCalls.push(updates); } };
      }
      return { get: async () => ({ val: () => (getAt(p) === undefined ? null : getAt(p)) }) };
    },
    _updateCalls: updateCalls,
  };
}

test.beforeEach(() => { _accessTokenCache.clear(); });

test('escreve status "tocando" em todos os squads da pessoa + geral, pegando a menor imagem', async () => {
  const db = makeFakeDb({
    kanban: {
      spotify_secrets: { uidA: { refresh_token: 'rtA' } },
      usuarios: { uidA: { squads: { squadX: true, squadY: true } } },
    },
  });
  global.fetch = async (url) => {
    if (String(url).includes('accounts.spotify.com/api/token')) {
      return { ok: true, json: async () => ({ access_token: 'atA', expires_in: 3600 }) };
    }
    if (String(url).includes('currently-playing')) {
      return {
        ok: true, status: 200,
        json: async () => ({
          is_playing: true,
          item: { name: 'Track X', artists: [{ name: 'Artist X' }], album: { images: [{ url: 'big.jpg' }, { url: 'small.jpg' }] } },
        }),
      };
    }
    throw new Error('URL inesperada: ' + url);
  };

  await runSpotifySync(db, 'fake-secret');

  assert.equal(db._updateCalls.length, 1);
  const updates = db._updateCalls[0];
  const statusX = updates['kanban/squads/squadX/dados/spotify_now/uidA'];
  assert.equal(statusX.playing, true);
  assert.equal(statusX.track, 'Track X');
  assert.equal(statusX.artist, 'Artist X');
  assert.equal(statusX.albumArt, 'small.jpg', 'pega a MENOR imagem (última do array)');
  assert.ok(updates['kanban/squads/squadY/dados/spotify_now/uidA'], 'fan-out pro segundo squad também');
  assert.ok(updates['kanban/painel/spotify_now_geral/uidA'], 'escreve no geral também');
});

test('escreve {playing:false} (sem apagar a entrada) quando a API diz 204 nada tocando', async () => {
  const db = makeFakeDb({
    kanban: {
      spotify_secrets: { uidA: { refresh_token: 'rtA' } },
      usuarios: { uidA: { squads: { squadX: true } } },
    },
  });
  global.fetch = async (url) => {
    if (String(url).includes('accounts.spotify.com/api/token')) {
      return { ok: true, json: async () => ({ access_token: 'atA', expires_in: 3600 }) };
    }
    if (String(url).includes('currently-playing')) return { ok: false, status: 204 };
    throw new Error('URL inesperada: ' + url);
  };

  await runSpotifySync(db, 'fake-secret');

  const status = db._updateCalls[0]['kanban/squads/squadX/dados/spotify_now/uidA'];
  assert.equal(status.playing, false);
  assert.equal(status.track, null);
});

test('se autodesconecta de verdade (apaga tudo) quando o refresh_token vem invalid_grant', async () => {
  const db = makeFakeDb({
    kanban: {
      spotify_secrets: { uidA: { refresh_token: 'rtA-revogado' } },
      usuarios: { uidA: { squads: { squadX: true } } },
      painel: {},
    },
  });
  global.fetch = async (url) => {
    if (String(url).includes('accounts.spotify.com/api/token')) {
      return { ok: false, status: 400, json: async () => ({ error: 'invalid_grant' }) };
    }
    throw new Error('não devia nem tentar currently-playing sem access_token');
  };

  await runSpotifySync(db, 'fake-secret');

  const updates = db._updateCalls[0];
  assert.equal(updates['kanban/spotify_secrets/uidA'], null, 'apaga o refresh_token de verdade');
  assert.equal(updates['kanban/usuarios/uidA/spotify_connected'], null);
  assert.equal(updates['kanban/squads/squadX/dados/spotify_now/uidA'], null);
  assert.equal(updates['kanban/painel/spotify_now_geral/uidA'], null);
});

test('não deixa uma pessoa falhando derrubar o tick inteiro (Promise.allSettled)', async () => {
  const db = makeFakeDb({
    kanban: {
      spotify_secrets: { uidBad: { refresh_token: 'rtBad' }, uidGood: { refresh_token: 'rtGood' } },
      usuarios: { uidBad: { squads: { squadX: true } }, uidGood: { squads: { squadX: true } } },
    },
  });
  global.fetch = async (url, opts) => {
    const body = opts && opts.body ? String(opts.body) : '';
    if (String(url).includes('accounts.spotify.com/api/token')) {
      if (body.includes('rtBad')) throw new Error('rede caiu pra essa pessoa');
      return { ok: true, json: async () => ({ access_token: 'atGood', expires_in: 3600 }) };
    }
    if (String(url).includes('currently-playing')) {
      return { ok: true, status: 200, json: async () => ({ is_playing: false, item: null }) };
    }
    throw new Error('URL inesperada: ' + url);
  };

  await runSpotifySync(db, 'fake-secret');

  const updates = db._updateCalls[0] || {};
  assert.ok(updates['kanban/squads/squadX/dados/spotify_now/uidGood'], 'uidGood processado normalmente');
  assert.ok(!updates['kanban/squads/squadX/dados/spotify_now/uidBad'], 'uidBad falhou mas não travou o resto');
});

test('reusa o access_token em cache entre ticks (não bate no /token de novo dentro da validade)', async () => {
  let tokenCalls = 0;
  const db = makeFakeDb({
    kanban: {
      spotify_secrets: { uidA: { refresh_token: 'rtA' } },
      usuarios: { uidA: { squads: { squadX: true } } },
    },
  });
  global.fetch = async (url) => {
    if (String(url).includes('accounts.spotify.com/api/token')) {
      tokenCalls++;
      return { ok: true, json: async () => ({ access_token: 'atA', expires_in: 3600 }) };
    }
    if (String(url).includes('currently-playing')) {
      return { ok: true, status: 200, json: async () => ({ is_playing: false, item: null }) };
    }
    throw new Error('URL inesperada: ' + url);
  };

  await runSpotifySync(db, 'fake-secret');
  await runSpotifySync(db, 'fake-secret');

  assert.equal(tokenCalls, 1, 'segundo tick reusa o access_token cacheado, não bate no /token de novo');
});
