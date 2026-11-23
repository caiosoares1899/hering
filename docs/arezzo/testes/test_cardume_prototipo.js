// Rodar na raiz: python3 -m http.server 8957
// Depois: node docs/arezzo/testes/test_cardume_prototipo.js
// BASE_URL, CHROME e PLAYWRIGHT_MODULE podem substituir os caminhos do molde da Ilha.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const home = require('node:os').homedir();
const base = process.env.BASE_URL || 'http://127.0.0.1:8957';
const saida = path.join(__dirname, '../../capturas/cardume-prototipo');
const temas = { abrolhos: null, lencois: 'light', entardecer: 'sunset' };
const url = new URL('/docs/demo/cardume-prototipo.html', base).href;

let falhas = 0;
async function verificar(nome, rodar) {
  try {
    await rodar();
    console.log('✅ ' + nome);
  } catch (erro) {
    falhas++;
    console.error('❌ ' + nome, erro);
  }
}

async function cenario(browser, largura, rodar) {
  const contexto = await browser.newContext({
    viewport: { width: largura, height: largura === 390 ? 844 : 900 },
    isMobile: largura === 390,
    hasTouch: largura === 390,
    reducedMotion: 'reduce',
    serviceWorkers: 'block'
  });
  const rede = [];
  const erros = [];
  contexto.on('request', req => {
    const pedido = new URL(req.url());
    if (pedido.origin !== new URL(base).origin && !['fonts.googleapis.com', 'fonts.gstatic.com'].includes(pedido.hostname)) {
      rede.push(req.url());
    }
  });
  const pagina = await contexto.newPage();
  pagina.on('pageerror', erro => erros.push(erro.message));
  pagina.setDefaultTimeout(4000);
  try {
    const resposta = await pagina.goto(url);
    assert.ok(resposta?.ok(), 'O servidor deve entregar o protótipo');
    await rodar(pagina);
    assert.deepEqual(erros, [], 'Erros de JavaScript');
    assert.deepEqual(rede, [], 'Pedidos fora do protótipo e do Google Fonts');
  } finally {
    await contexto.close();
  }
}

const canal = (pagina, nome) => pagina.getByRole('button', { name: new RegExp('^# ' + nome + ',') });
const previa = pagina => pagina.getByRole('button', { name: /Validar base de receita/ });
const thread = pagina => pagina.locator('#thread-ativa');

async function testarMobile(pagina) {
  const conversa = pagina.getByRole('heading', { name: '# dados', exact: true });
  assert.equal(await conversa.isVisible(), false);
  await canal(pagina, 'dados').tap();
  assert.equal(await conversa.isVisible(), true);
  await previa(pagina).tap();
  assert.equal(await conversa.isVisible(), false);
  assert.equal(await thread(pagina).isVisible(), true);
  return async () => {
    await pagina.getByRole('button', { name: 'Fechar thread' }).tap();
    assert.equal(await thread(pagina).isVisible(), false);
    assert.equal(await conversa.isVisible(), true);
    assert.equal(await previa(pagina).evaluate(no => no === document.activeElement), true);
    await pagina.getByRole('button', { name: 'Voltar aos canais' }).tap();
    assert.equal(await canal(pagina, 'dados').isVisible(), true);
    assert.equal(await conversa.isVisible(), false);
  };
}

async function testarLayout(pagina, tema, atributo, largura) {
  await pagina.getByLabel('Tema').selectOption(tema);
  assert.equal(await pagina.locator('html').getAttribute('data-theme'), atributo);
  let voltarMobile;
  if (largura === 390) {
    assert.equal(await pagina.evaluate(() => document.documentElement.clientWidth), 390);
    voltarMobile = await testarMobile(pagina);
    assert.ok(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(await pagina.evaluate(() => [...document.querySelectorAll('button, select, textarea')]
      .filter(no => no.getClientRects().length)
      .every(no => no.offsetHeight >= 44 && no.offsetWidth >= 44)), 'Alvos de toque de 44 px');
    assert.equal(await pagina.getByRole('textbox', { name: 'Resposta na thread' })
      .evaluate(no => getComputedStyle(no).fontSize), '16px');
  } else {
    await previa(pagina).click();
    for (const seletor of ['.lateral', '.conversa', '#thread-ativa']) {
      assert.equal(await pagina.locator(seletor).isVisible(), true);
    }
    const caixas = await Promise.all(['.lateral', '.conversa', '.thread'].map(seletor => pagina.locator(seletor).boundingBox()));
    assert.ok(caixas[0].x < caixas[1].x && caixas[1].x < caixas[2].x, 'Três colunas');
  }
  await pagina.screenshot({ path: path.join(saida, tema + '-' + largura + '.png') });
  if (voltarMobile) await voltarMobile();
}

async function testarConversa(pagina) {
  const campo = pagina.getByRole('textbox', { name: 'Mensagem do canal' });
  const log = pagina.getByRole('log', { name: 'Mensagens do canal' });
  assert.equal(await log.getByText('Hoje', { exact: true }).count(), 1);
  assert.equal(await log.getByText('Ontem', { exact: true }).count(), 1);

  await campo.fill('Primeira linha');
  await campo.press('Shift+Enter');
  assert.equal(await campo.inputValue(), 'Primeira linha\n');
  assert.equal(await log.getByText('Primeira linha', { exact: true }).count(), 0);
  await campo.press('Enter');
  const propria = log.locator('.propria').filter({ hasText: 'Primeira linha' });
  await propria.waitFor();
  assert.equal(await campo.inputValue(), '');

  await campo.fill('@');
  await campo.press('ArrowDown');
  await campo.press('Tab');
  assert.equal(await campo.inputValue(), '@Bruno Reis ');
  await campo.fill('@An');
  await campo.press('Enter');
  assert.equal(await campo.inputValue(), '@Ana Lima ');
  await campo.fill('@');
  await campo.press('Escape');
  assert.equal(await pagina.getByRole('listbox').isVisible(), false);
  assert.equal(await campo.evaluate(no => no === document.activeElement), true);

  await campo.fill('/');
  assert.equal(await pagina.getByRole('listbox', { name: 'Sugestões de escrita' }).getByRole('option').count(), 3);
  await campo.fill('/card criar Teste');
  await campo.press('Enter');
  const novoCard = pagina.getByRole('button', { name: /^Teste A fazer/ });
  await novoCard.waitFor();
  assert.ok(await log.locator('.grupo').filter({ has: novoCard }).getByText('🤖 Agente Ágil', { exact: true }).isVisible());
  assert.equal(await novoCard.getByText('💬 0 na thread').count(), 1);

  await campo.fill('/quem');
  await campo.press('Enter');
  await log.getByText('Hoje na Escala da squad', { exact: true }).waitFor();
  assert.ok(await log.getByText('Bruno Reis · 🔥 plantão', { exact: true }).isVisible());
  await campo.fill('/resumo');
  await campo.press('Enter');
  const resumo = log.getByText('O próximo passo é compartilhar o resultado', { exact: false });
  await resumo.waitFor();
  assert.equal((await resumo.textContent()).split('\n').length, 3);

  const card = previa(pagina);
  assert.equal(await card.getByText('💬 3 na thread').count(), 1);
  await card.click();
  const resposta = pagina.getByRole('textbox', { name: 'Resposta na thread' });
  await resposta.fill('Conferência concluída');
  await resposta.press('Enter');
  await thread(pagina).getByText('Conferência concluída', { exact: true }).waitFor();
  assert.equal(await card.getByText('💬 4 na thread').count(), 1);
  await resposta.press('Escape');
  assert.equal(await thread(pagina).isVisible(), false);
  assert.equal(await card.evaluate(no => no === document.activeElement), true);

  const menu = propria.getByRole('button', { name: 'Ações da mensagem' });
  await menu.click();
  await propria.getByRole('button', { name: /Editar/ }).click();
  const edicao = propria.getByRole('textbox', { name: 'Editar mensagem' });
  await edicao.fill('Edição cancelada');
  await edicao.press('Escape');
  assert.equal(await menu.evaluate(no => no === document.activeElement), true);
  assert.equal(await propria.getByText('Primeira linha', { exact: true }).count(), 1);
  await menu.click();
  await propria.getByRole('button', { name: /Editar/ }).click();
  await edicao.fill('Linha revisada');
  await edicao.press('Enter');
  const revisada = log.locator('.propria').filter({ hasText: 'Linha revisada' });
  assert.ok(await revisada.getByText('(editada)').isVisible());
  await revisada.getByRole('button', { name: 'Ações da mensagem' }).click();
  await revisada.getByRole('button', { name: /Apagar/ }).click();
  assert.equal(await revisada.getByText('Apagar esta mensagem?').count(), 1);
  await revisada.getByRole('button', { name: 'Confirmar exclusão' }).click();
  assert.equal(await revisada.count(), 0);

  const payload = '<img src=x onerror=alert(1)>';
  await campo.fill(payload);
  await campo.press('Enter');
  assert.equal(await log.getByText(payload, { exact: true }).count(), 1);
  assert.equal(await log.locator('img').count(), 0);

  assert.match(await canal(pagina, 'prf').getAttribute('aria-label'), /2 não lidas/);
  await canal(pagina, 'prf').click();
  assert.match(await canal(pagina, 'prf').getAttribute('aria-label'), /0 não lidas/);
  await canal(pagina, 'dados').click();
  await pagina.getByRole('button', { name: 'Simular mensagem nova' }).click();
  assert.match(await canal(pagina, 'prf').getAttribute('aria-label'), /1 não lida, com menção a você/);
  assert.equal(await canal(pagina, 'prf').locator('.selo.mencao').count(), 1);
  assert.match(await canal(pagina, 'dados').getAttribute('aria-label'), /0 não lidas/);
  await canal(pagina, 'prf').click();
  assert.match(await canal(pagina, 'prf').getAttribute('aria-label'), /0 não lidas$/);
  assert.ok(await log.getByText('@você, pode conferir as notas', { exact: false }).isVisible());
}

async function main() {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || path.join(chromeRoot,
    fs.readdirSync(chromeRoot).find(nome => nome.startsWith('mac_arm-')),
    'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
  fs.mkdirSync(saida, { recursive: true });
  const browser = await chromium.launch({ executablePath: chrome });
  try {
    for (const [tema, atributo] of Object.entries(temas)) {
      for (const largura of [1280, 390]) {
        await verificar(tema + ' em ' + largura + ' px', () => cenario(browser, largura,
          pagina => testarLayout(pagina, tema, atributo, largura)));
      }
    }
    await verificar('Conversa no canal e na thread', () => cenario(browser, 1280, testarConversa));
  } finally {
    await browser.close();
  }
  if (falhas) process.exitCode = 1;
}

main().catch(erro => {
  console.error('❌ Falha ao executar o teste do Cardume', erro);
  process.exitCode = 1;
});
