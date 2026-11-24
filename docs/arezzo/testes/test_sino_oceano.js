// 🔔 Sino unificado no Oceano com boot real e Firebase falso.
// Na raiz: python3 -m http.server 8941 → node docs/arezzo/testes/test_sino_oceano.js
// BASE_URL, CHROME e PLAYWRIGHT_MODULE substituem os padrões de ~/hering-tools.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const home = require('node:os').homedir();
const fake = require('./fakefb.js');

const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const user = {
  uid: 'teste', email: 'teste@ciahering.com.br', displayName: 'Pessoa de Teste',
  providerData: [{ providerId: 'google.com' }],
};
const iso = minutos => new Date(Date.now() - minutos * 60000).toISOString();
const texto = '<img src=x onerror="window.__xss=1">';
const reuniao = 'https://example.com/reuniao';
const bugMeu = 'nf_bug_bug_ferias_meu_em_analise';
const bugOutro = 'nf_bug_bug_ferias_outro_resolvido';
const bugAusente = 'nf_bug_bug_ferias_ausente_resolvido';
const perfil = role => ({ uid: user.uid, role, squads: { dados: true }, oceano: { abrir: 'aqui' } });
const pessoal = (type, title, campos) => ({ type, title, ts: iso(5), read: false, ...campos });
const aviso = (tipo, titulo, campos) => ({ tipo, titulo, ts: iso(10), torres: ['*'], autorUid: 'sistema', ...campos });
const relato = uid => ({
  uid, origem: 'assistente_ferias', status: 'em_analise', criadoEm: Date.now(),
  kanbanCardId: 'c_existente', kanbanColId: 'col_existente', kanbanSchemaV: 3,
});
const seed = role => ({ kanban: {
  usuarios: { teste: { ...perfil(role), notificacoes: {
    card: pessoal('assigned', texto, { sub: texto, cardId: 'c1', squad: 'dados' }),
    kudos: pessoal('kudos', 'Estrela do Mar', { squad: 'dados' }),
    intake: pessoal('intake', 'Solicitação nova', { squad: 'dados', cardId: 'c2' }),
    reuniao: pessoal('reuniao', 'Reunião externa', { meetingLink: reuniao }),
    sistema: pessoal('backup_falhou', 'Falha no backup'),
    mural: pessoal('mural', 'Cópia do aviso', { read: true }),
    rascunho: pessoal('rascunho', 'Só no Painel'),
  } } },
  feedback: { bug_ferias_meu: relato('teste'), bug_ferias_outro: relato('outro') },
  notif_feed_seen: { teste: { ts: iso(60) } },
  notif_feed: {
    mural: aviso('mural', 'Aviso do Mural', { muralId: 'm1' }),
    objetivo: aviso('obj_criado', 'Objetivo novo', { objId: 'o1' }),
    [bugMeu]: aviso('ferias_bug_status', 'Meu bug'),
    [bugOutro]: aviso('ferias_bug_status', 'Bug de outra pessoa'),
    [bugAusente]: aviso('ferias_bug_status', 'Bug sem relato'),
  },
} });

const botao = '#btn-sino';
const painel = '.mn-sino-pop';
const selo = botao + ' .mn-sino-n';
const item = id => painel + ' [data-mn-id="' + id + '"]';
const confirmar = mensagem => console.log('✅ ' + mensagem);

async function abrirOceano(browser, role) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, hasTouch: true, serviceWorkers: 'block' });
  await fake.install(ctx, seed(role));
  // Os iframes recebem o destino real do roteador, com conteúdo local mínimo para isolar o teste.
  await ctx.route(/\/(kanban|okr)-dev\.html(?:\?|$)/, route => route.fulfill({ contentType: 'text/html', body: '<title>Produto de teste</title>' }));
  await ctx.addInitScript(() => {
    window.__aberturasSino = [];
    window.open = (...args) => { window.__aberturasSino.push(args); return {}; };
  });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', error => erros.push(error.message));
  await page.goto(base + '/oceano-dev.html?ferias=1');
  await page.waitForFunction(() => !!window.__authCb);
  await page.evaluate(u => window.__authCb(u), user);
  // O fake não aplica equalTo(uid). Assim, a lista também recebe o relato de outra pessoa
  // e o teste exige que o filtro do Sino faça a checagem de dono.
  const quantidade = role === 'adm' ? '8' : '7';
  await page.waitForFunction(({ selo, quantidade }) => document.querySelector(selo)?.textContent === quantidade, { selo, quantidade });
  return { page, ctx, erros };
}

async function abrirSino(page) {
  await page.click(botao);
  await page.waitForSelector(painel, { state: 'visible' });
}

async function conferirRotas(page) {
  for (const [id, app, url] of [
    ['pessoal:card', 'kanban', 'kanban-dev.html?squad=dados&card=c1'],
    ['pessoal:kudos', 'kanban', 'kanban-dev.html?squad=dados'],
    ['pessoal:intake', 'kanban', 'kanban-dev.html?squad=dados&card=c2'],
    ['feed:mural', 'okr', 'okr-dev.html?mural=m1'],
    ['feed:objetivo', 'okr', 'okr-dev.html?okr=o1'],
  ]) {
    await abrirSino(page);
    await page.click(item(id));
    const frame = page.locator(`#host.on #host-frames iframe.on[data-app="${app}"]`);
    assert.equal(await frame.getAttribute('src'), url, id);
    await page.click('#host-lobby');
  }
  assert.deepEqual(await page.evaluate(() => window.__aberturasSino), []);
  confirmar('Card, Kudos, Intake, Mural e Objetivo abrem no iframe do Oceano');

  await abrirSino(page);
  await page.click(item('pessoal:reuniao'));
  assert.deepEqual(await page.evaluate(() => window.__aberturasSino), [[reuniao, '_blank', 'noopener']]);
  await abrirSino(page);
  await page.click(item('feed:' + bugMeu));
  await page.waitForSelector('#ferias-ov.open [data-ftab="bugs"][aria-selected="true"]');
  await page.click('[data-fecha="ferias-ov"]');
  confirmar('Reunião abre em aba nova e o aviso de bug abre a aba Bugs do Assistente Férias');
}

async function conferirTemas(page) {
  const fundos = new Set();
  for (const [width, height] of [[1280, 860], [390, 800]]) {
    await page.click(botao);
    await page.setViewportSize({ width, height });
    await abrirSino(page);
    for (const tema of ['', 'light', 'sunset']) {
      const medidas = await page.evaluate(({ tema, painel }) => {
        if (tema) document.documentElement.setAttribute('data-theme', tema);
        else document.documentElement.removeAttribute('data-theme');
        const el = document.querySelector(painel);
        const { left, right } = el.getBoundingClientRect();
        const { backgroundColor, color } = getComputedStyle(el);
        return { left, right, largura: innerWidth, sobra: document.documentElement.scrollWidth - innerWidth, backgroundColor, color };
      }, { tema, painel });
      assert.ok(medidas.left >= 0 && medidas.right <= medidas.largura && medidas.sobra <= 0, JSON.stringify(medidas));
      assert.notEqual(medidas.backgroundColor, medidas.color);
      assert.notEqual(medidas.backgroundColor, 'rgba(0, 0, 0, 0)');
      fundos.add(medidas.backgroundColor);
    }
  }
  assert.equal(fundos.size, 3);
  confirmar('Painel cabe em 1280 e 390 px e usa o fundo dos três temas');
}

async function conferirMembro(browser) {
  const { page, ctx, erros } = await abrirOceano(browser, 'membro');
  try {
    await page.evaluate(() => {
      window.__gatilhosSino = [];
      MareDicas.gatilho = gatilho => window.__gatilhosSino.push(gatilho);
    });
    await abrirSino(page);
    assert.equal(await page.locator(selo).textContent(), '7');
    assert.equal(await page.locator(painel + ' .mn-sino-it').count(), 8);
    assert.equal(await page.locator(item('pessoal:mural')).count(), 0);
    assert.equal(await page.locator(item('feed:mural') + '.mn-nao-lida').count(), 0);
    assert.equal(await page.locator(item('pessoal:rascunho')).count(), 0);
    assert.equal(await page.locator(item('feed:' + bugOutro)).count(), 0);
    assert.equal(await page.locator(item('feed:' + bugAusente)).count(), 0);
    assert.equal(await page.locator(item('feed:' + bugMeu)).count(), 1);
    const ouvintes = await page.evaluate(() => window.__log.filter(([tipo, p]) =>
      tipo === 'onValue' && p === 'kanban/usuarios/teste/notificacoes').length);
    assert.equal(ouvintes, 1);
    confirmar('Selo soma as não lidas sem duplicar o Mural e respeita a leitura da cópia pessoal');

    const familias = await page.locator(painel + ' .mn-sino-fam').allTextContents();
    assert.deepEqual([...new Set(familias)].sort(), ['👤 Pessoal', '📅 Calendário', '🎯 Radar', '🛡️ Sistema'].sort());
    assert.equal(await page.locator(painel + ' .mn-sino-tipo').count(), 8);
    assert.equal(await page.locator(item('pessoal:reuniao') + ' .mn-sino-tipo').textContent(), 'Reunião');
    for (const classe of ['mn-sino-tudo', 'mn-sino-limpar', 'mn-som', 'mn-dnd-btn']) {
      assert.ok(await page.isVisible(painel + ' .' + classe), classe);
    }
    assert.equal(await page.locator(item('pessoal:card') + ' .mn-sino-tit').textContent(), texto);
    assert.equal(await page.locator(item('pessoal:card') + ' .mn-sino-sub').textContent(), texto);
    assert.equal(await page.locator(painel + ' img').count(), 0);
    assert.equal(await page.evaluate(() => window.__xss), undefined);
    confirmar('Quatro famílias, rótulos, comandos e rodapé. Título e subtítulo são exibidos como texto');

    await page.click(botao);
    assert.ok(await page.isHidden(painel));
    assert.equal(await page.evaluate(() => window.__gatilhosSino.filter(g => g === 'sino').length), 1);
    await abrirSino(page);
    await conferirTemas(page);
    await page.keyboard.press('Escape');
    assert.ok(await page.isHidden(painel));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'btn-sino');
    confirmar('A dica dispara ao abrir, e Esc fecha o painel e devolve o foco');

    await page.setViewportSize({ width: 1280, height: 860 });
    await conferirRotas(page);
    await abrirSino(page);
    await page.click(painel + ' .mn-sino-tudo');
    await page.waitForSelector(selo, { state: 'hidden' });
    assert.equal(await page.evaluate(() => window.__store.kanban.usuarios.teste.notificacoes.card.read), true);
    assert.equal(await page.evaluate(() => window.__store.kanban.notif_feed_seen.teste.lidos.mural), true);
    if (await page.isHidden(painel)) await abrirSino(page);
    await page.click(item('x:pessoal:sistema'));
    assert.equal(await page.locator(item('pessoal:sistema')).count(), 0);
    await page.click(painel + ' .mn-sino-limpar');
    if (await page.isHidden(painel)) await abrirSino(page);
    await page.waitForSelector(painel + ' .mn-sino-vazio');
    assert.deepEqual(await page.evaluate(() => Object.keys(window.__store.kanban.usuarios.teste.notificacoes)), ['rascunho']);
    confirmar('Marcar tudo zera o selo, ✕ remove um item e Limpar antigas remove os lidos');
    assert.deepEqual(erros, []);
  } finally {
    await ctx.close();
  }
}

async function conferirAdm(browser) {
  const { page, ctx, erros } = await abrirOceano(browser, 'adm');
  try {
    await abrirSino(page);
    assert.equal(await page.locator(item('feed:' + bugOutro)).count(), 1);
    assert.equal(await page.locator(item('feed:' + bugAusente)).count(), 0);
    await page.evaluate(() => window._set(window._ref(window._db, 'kanban/feedback/bug_ferias_outro'), null));
    await page.waitForSelector(item('feed:' + bugOutro), { state: 'detached' });
    assert.equal(await page.locator(selo).textContent(), '7');
    assert.deepEqual(erros, []);
    confirmar('ADM vê o bug alheio enquanto existe e o painel atualiza quando o relato some');
  } finally {
    await ctx.close();
  }
}

(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const chromeDir = fs.existsSync(chromeRoot) && fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-'));
  const chrome = process.env.CHROME || (chromeDir && path.join(chromeRoot, chromeDir, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'));
  const browser = await chromium.launch(chrome ? { executablePath: chrome } : {});
  try {
    await conferirMembro(browser);
    await conferirAdm(browser);
    console.log('TUDO OK');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error('❌', error);
  process.exitCode = 1;
});
