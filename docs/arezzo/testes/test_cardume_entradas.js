// Na raiz, sirva os arquivos com python3 -m http.server 8941.
// Rode node docs/arezzo/testes/test_cardume_entradas.js (BASE_URL, CHROME e PLAYWRIGHT_MODULE são opcionais).
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fake = require('./fakefb.js');

const base = (process.env.BASE_URL || 'http://127.0.0.1:8941').replace(/\/$/, '');
const destino = base + '/cardume-dev.html';
const user = {
  uid: 'teste-cardume', email: 'teste-cardume@ciahering.com.br', displayName: 'Pessoa Teste',
  photoURL: '', providerData: [{providerId: 'google.com'}],
};
const seed = {kanban: {usuarios: {
  [user.uid]: {nome: user.displayName, email: user.email, role: 'membro', squads: {dados: true}},
}}};

async function conferirAbertura(page, link) {
  assert.equal(await link.getAttribute('href'), 'cardume-dev.html');
  assert.equal(await link.getAttribute('target'), '_blank');
  const [popup] = await Promise.all([page.context().waitForEvent('page'), link.click()]);
  await popup.waitForURL(destino);
  await popup.close();
}

(async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROME});
  try {
    const context = await browser.newContext();
    await fake.install(context, seed);
    await context.addInitScript(u => { window.__initialUser = u; }, user);
    // Serve os mesmos HTMLs dev em caminhos de produção, preservando o JS atualizado.
    for (const app of ['oceano', 'okr']) {
      await context.route(base + '/' + app + '.html', async route => {
        const response = await route.fetch({url: base + '/' + app + '-dev.html'});
        await route.fulfill({response});
      });
    }
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const escala = page.locator('#atalhos a[href^="escala"]');
    const atalho = page.getByRole('link', {name: 'Cardume (abre em aba nova)'});
    const produtos = page.getByRole('tab', {name: 'Produtos'});
    const item = page.getByRole('menuitem', {name: 'Cardume Conversa do time'});

    await page.goto(base + '/oceano-dev.html');
    await escala.waitFor({state: 'visible'});
    assert.equal(await escala.locator('xpath=following-sibling::*[1]').getAttribute('href'), 'cardume-dev.html');
    await conferirAbertura(page, atalho);
    console.log('✅ Oceano dev: atalho ao lado da Escala abre o Cardume em aba nova');

    await page.goto(base + '/okr-dev.html');
    await page.locator('#mn-apps-btn').click();
    assert.equal(await produtos.getAttribute('aria-selected'), 'true');
    assert.equal(await item.getAttribute('data-app'), null);
    await conferirAbertura(page, item);
    console.log('✅ Radar dev: tile do Cardume está em Produtos e abre em aba nova');

    await page.goto(base + '/oceano.html');
    await escala.waitFor({state: 'visible'});
    assert.equal(await page.locator('#atalhos a[href="cardume-dev.html"]').count(), 0);

    await page.goto(base + '/okr.html');
    await page.locator('#mn-apps-btn').click();
    assert.equal(await produtos.getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('#mn-apps-pop a[href="cardume-dev.html"]').count(), 0);
    console.log('✅ Caminhos de produção: atalho e tile ausentes mesmo com o código dev');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error('❌ Entradas do Cardume:', error);
  process.exitCode = 1;
});
