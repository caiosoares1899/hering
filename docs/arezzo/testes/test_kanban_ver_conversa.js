// Sirva a raiz do repo em BASE_URL e rode este script com Node.
// Usa Firebase falso. CHROME e PLAYWRIGHT_MODULE permitem usar instalações locais.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fake = require('./fakefb.js');
const base = process.env.BASE_URL || 'http://127.0.0.1:8961';

const usuario = {
  uid: 'teste', email: 'teste@ciahering.com.br', displayName: 'Teste',
  providerData: [{ providerId: 'google.com' }],
};
const origem = { c: 'dados', m: '-Nabc' };
const href = 'cardume-dev.html?c=dados&m=-Nabc';
const casos = {
  valido: origem,
  tematico: { c: 't-canal', m: 'm'.repeat(64) },
  esquema: { c: 'javascript:alert(1)', m: '-Nabc' },
  caminho: { c: 'dados', m: '../x' },
  numero: { c: 'dados', m: 123 },
  objeto: { c: { id: 'dados' }, m: '-Nabc' },
  longo: { c: 'd'.repeat(65), m: '-Nabc' },
  vazio: { c: 'dados', m: '' },
  quebra: { c: 'dados\n', m: '-Nabc' },
  campoNumero: 123,
  campoNulo: null,
  antigo: undefined,
};

function seed() {
  const perfil = {
    uid: usuario.uid, email: usuario.email, nome: 'Teste', init: 'TE',
    inscrito: true, role: 'adm', squads: { dados: true },
  };
  const comentarios = Object.fromEntries(Object.entries(casos).map(([id, cardume]) => [
    id, {
      id, uid: usuario.uid, author: 'Teste', init: 'TE',
      text: id === 'valido' ? '🐚 Da Concha · #dados' : 'Comentário ' + id,
      ts: '2026-11-24T12:00:00.000Z',
      ...(cardume === undefined ? {} : { cardume }),
    },
  ]));
  return { kanban: {
    usuarios: { teste: perfil },
    usuarios_publicos: { teste: perfil },
    config: { adm_emails: [usuario.email] },
    squads_meta: { dados: { label: 'Dados' } },
    squads: { dados: { dados: {
      columns: [{ id: 'backlog', name: 'Backlog' }],
      cards_index: { c1: '0' },
      cards: { 0: { id: 'c1', title: 'Card de teste', col: 'backlog' } },
      card_comments: { c1: comentarios },
    } } },
  } };
}

async function abrir(ctx, arquivo) {
  const page = await ctx.newPage();
  await page.goto(base + '/' + arquivo + '?squad=dados');
  await page.waitForFunction(() => typeof window.__authCb === 'function');
  await page.evaluate(u => window.__authCb(u), usuario);
  await page.waitForFunction(() => typeof cards !== 'undefined' && cards.some(c => c.id === 'c1'));
  await page.evaluate(() => openCard('c1'));
  await page.locator('#m-comment-list [data-cid="valido"]').waitFor({ state: 'attached' });
  return page;
}

async function testar() {
  const browser = await chromium.launch({ executablePath: process.env.CHROME });
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await fake.install(ctx, seed());
    const page = await abrir(ctx, 'kanban-dev.html');
    const itens = page.locator('#m-comment-list .comment-item');
    const item = id => itens.filter({ has: page.locator('#ctext-' + id) });
    const link = id => item(id).locator('.comment-cardume-link');

    assert.equal(await itens.count(), Object.keys(casos).length);
    assert.equal(await link('valido').textContent(), '🐚 Ver conversa na Concha');
    assert.equal(await link('valido').getAttribute('href'), href);
    assert.equal(await link('valido').getAttribute('target'), '_blank');
    assert.equal(await link('valido').getAttribute('rel'), 'noopener');
    assert.ok(await page.locator('#ctext-valido + .comment-cardume-link').count());
    assert.ok(await link('valido').evaluate(el => el.getBoundingClientRect().height >= 32));
    assert.equal(await link('tematico').getAttribute('href'), 'cardume-dev.html?c=t-canal&m=' + 'm'.repeat(64));
    for (const id of Object.keys(casos).slice(2)) {
      assert.equal(await link(id).count(), 0, id);
      assert.equal(await item(id).locator('.comment-text').textContent(), 'Comentário ' + id);
    }
    console.log('✅ Link dev, atributos, alvo móvel e comentários sem referência válida');

    await page.evaluate(() => {
      startEditComment('valido');
      document.getElementById('cedit-ta-valido').value = 'Texto editado';
      saveEditComment('valido');
    });
    await page.waitForFunction(async () => {
      const snap = await window._get(window._ref(window._db, FB + '/card_comments/c1/valido'));
      return snap.val()?.text === 'Texto editado';
    });
    await page.evaluate(() => loadComments('c1'));
    assert.equal(await item('valido').locator('.comment-text').textContent(), 'Texto editado');
    assert.equal(await link('valido').getAttribute('href'), href);
    console.log('✅ Editar e recarregar mantém o link');

    const copia = await page.evaluate(() => _duplicarCardObj(cards.find(c => c.id === 'c1')).id);
    await page.waitForFunction(async id => {
      const snap = await window._get(window._ref(window._db, FB + '/card_comments/' + id + '/valido'));
      return snap.val()?.cardume?.m === '-Nabc';
    }, copia);
    await page.evaluate(id => loadComments(id), copia);
    assert.equal(await item('valido').locator('.comment-text').textContent(), 'Texto editado');
    assert.equal(await link('valido').getAttribute('href'), href);
    console.log('✅ Duplicar o card mantém o link');

    // Serve o mesmo código sob a URL de produção para simular uma promoção.
    await ctx.route('**/kanban.html?squad=dados', route => route.fulfill({
      path: path.resolve(__dirname, '../../../kanban-dev.html'),
      contentType: 'text/html',
    }));
    const prod = await abrir(ctx, 'kanban.html');
    assert.equal(await prod.locator('#m-comment-list .comment-item').count(), Object.keys(casos).length);
    assert.equal(await prod.locator('#m-comment-list .comment-cardume-link').count(), 0);
    console.log('✅ O mesmo código suprime o link em kanban.html');
  } finally {
    await browser.close();
  }
}

testar().catch(erro => {
  console.error(erro);
  process.exitCode = 1;
});
