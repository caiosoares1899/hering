// 🔔 Sino unificado no Radar com boot real e Firebase falso.
// Na raiz: python3 -m http.server 8941 → node docs/arezzo/testes/test_sino_radar.js
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
const externo = { ...user, email: 'externo@example.com' };
const texto = '<img src=x onerror="window.__xss=1">';
const reuniao = 'https://example.com/reuniao';
const notaViewer = '👁 Modo visualização: avisos e novidades das torres. Menções e prazos são só pra quem tem usuário.';
const iso = minutos => new Date(Date.now() - minutos * 60000).toISOString();
const dataEvento = iso(0).slice(0, 10);
const dataNota = iso(2880).slice(0, 10);
const pessoal = (type, title, campos) => ({ type, title, ts: iso(5), read: false, ...campos });
const aviso = (tipo, titulo, campos) => ({ tipo, titulo, ts: iso(10), torres: ['*'], autorUid: 'sistema', ...campos });
const perfil = { uid: user.uid, nome: user.displayName, email: user.email, torre: 'digital', role: 'membro', squads: { dados: true }, dicas: { off: { radar: true } } };
const mural = aviso('aviso', 'Aviso do Mural', { corpo: 'Comunicado de teste' });
const seed = () => ({ kanban: {
  painel_viewers: { 'externo@example,com': true },
  usuarios_publicos: { teste: { uid: user.uid, nome: user.displayName } },
  usuarios: { teste: { ...perfil, notificacoes: {
    card: pessoal('assigned', texto, { sub: texto, cardId: 'c1', squad: 'dados' }),
    kudos: pessoal('kudos', 'Estrela do Mar', { squad: 'dados' }),
    intake: pessoal('intake', 'Solicitação nova', { squad: 'dados', cardId: 'c2' }),
    reuniao: pessoal('reuniao', 'Reunião externa', { meetingLink: reuniao }),
    sistema: pessoal('backup_falhou', 'Falha no backup'),
    prazo: pessoal('okr_prazo', 'Lembrete de prazo', { noTTLDelete: true }),
    // ids próprios: o Sino junta pessoal e feed com o MESMO id (é a cópia pessoal de um aviso, como a do Mural)
    'p-evento': pessoal('okr_reuniao', 'Convite de reunião', { okrEventoId: 'e1', okrEventoData: dataEvento }),
    gantt: pessoal('gantt_cal', 'Calendário atualizado', { cal: 'outlet' }),
    chat: pessoal('okr_agente', 'Resposta do Agente'),
    notas: pessoal('okr_mencao', 'Menção nas anotações', { okrNotaData: dataNota }),
    'p-objetivo': pessoal('okr_editado', 'Objetivo editado', { okrObjId: 'o1' }),
    mural: pessoal('mural', 'Cópia do aviso', { read: true }),
    rascunho: pessoal('rascunho', 'Só no Painel'),
  } } },
  okr: {
    mural: { mural },
    objetivos: { o1: { id: 'o1', titulo: 'Objetivo de teste', torre: 'digital' } },
    calendario: { eventos: { e1: { id: 'e1', titulo: 'Evento de teste', tipo: 'reuniao', data: dataEvento, torre: 'digital' } } },
    reuniao_notas: { [dataNota]: { n1: { texto: 'Anotação de teste', autorUid: 'sistema', ts: iso(1440) } } },
  },
  notif_feed_seen: { teste: { ts: iso(60) } },
  notif_feed: {
    mural: aviso('mural', mural.titulo, { muralId: 'mural' }),
    objetivo: aviso('obj_criado', texto, { objId: 'o1' }),
    evento: aviso('okr_evento', 'Evento no feed', { eventoId: 'e1', evData: dataEvento }),
  },
} });

const botao = '#okr-bell-btn';
const painel = '.mn-sino-pop';
const selo = botao + ' .mn-sino-n';
const item = id => painel + ' [data-mn-id="' + id + '"]';
const caminhoPessoais = 'kanban/usuarios/teste/notificacoes';

async function abrirRadar(browser, viewer = false) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, hasTouch: true, serviceWorkers: 'block' });
  await fake.install(ctx, seed());
  await ctx.addInitScript(() => {
    localStorage.setItem('mare_dicas_teste', JSON.stringify({ off: { radar: true } }));
    window.__aberturasSino = [];
    window.open = (url, alvo) => {
      const aba = { url, alvo, opener: window };
      window.__aberturasSino.push(aba);
      return aba;
    };
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const erros = [];
  page.on('pageerror', error => erros.push(error.message));
  await page.goto(base + '/okr-dev.html');
  await page.waitForFunction(() => !!window.__authCb);
  await page.evaluate(u => window.__authCb(u), viewer ? externo : user);
  await page.waitForSelector(botao + '[aria-haspopup="dialog"]');
  return { page, ctx, erros };
}

async function abrirSino(page) {
  if (await page.isHidden(painel)) await page.click(botao);
  await page.waitForSelector(painel, { state: 'visible' });
}

async function clicarItem(page, id) {
  await abrirSino(page);
  await page.click(item(id));
  await page.waitForSelector(painel, { state: 'hidden' });
}

async function conferirRotas(page) {
  for (const id of ['feed:evento', 'pessoal:p-evento']) {
    await clicarItem(page, id);
    await page.waitForSelector('#okr-evd-ov.open');
    assert.match(await page.textContent('#okr-evd-ov'), /Evento de teste/);   // o título do modal é o tipo (🗓️ Reunião); o nome fica no corpo
    assert.equal(await page.evaluate(() => _okrEvdData), dataEvento);
    await page.click('#okr-evd-ov .x-btn');
  }
  await clicarItem(page, 'feed:mural');
  await page.waitForSelector('#okr-mural-pop-ov.open');
  assert.match(await page.textContent('#okr-mural-pop-body'), /Comunicado de teste/);
  assert.ok(await page.isHidden('#okr-mural-n'));
  await page.click('#okr-mural-pop-ov .x-btn');

  for (const id of ['feed:objetivo', 'pessoal:p-objetivo']) {
    await clicarItem(page, id);
    await page.waitForSelector('#okr-obj-ov.open');
    assert.match(await page.textContent('#okr-obj-title'), /Objetivo de teste/);
    await page.click('#okr-obj-ov [onclick="_okrTryCloseObjetivo()"]');
  }
  await clicarItem(page, 'pessoal:gantt');
  await page.waitForSelector('#okr-gcal-host .mgc-aba.on[data-aba="outlet"]');
  await clicarItem(page, 'pessoal:chat');
  await page.waitForSelector('#okr-agente-wrap', { state: 'visible' });
  await page.click('#okr-agente-wrap .x-btn');
  // A data histórica só está disponível depois que o Radar carrega as anotações sob demanda.
  await page.evaluate(() => loadOkrReuniaoNotas());
  await page.waitForFunction(() => _okrNotasPronto);
  await clicarItem(page, 'pessoal:notas');
  await page.waitForSelector('#okr-notas-wrap', { state: 'visible' });
  assert.equal(await page.inputValue('#okr-notas-date-sel'), dataNota);
  assert.match(await page.textContent('#okr-notas-list'), /Anotação de teste/);
  assert.equal(await page.evaluate(() => window.__aberturasSino.length), 0);
  console.log('✅ Evento, Mural, Objetivo, Gantt, chat e anotações abrem no Radar');

  for (const id of ['card', 'kudos', 'intake', 'reuniao']) await clicarItem(page, 'pessoal:' + id);
  assert.deepEqual(await page.evaluate(() => window.__aberturasSino.map(({ url, alvo, opener }) => [url, alvo, opener === null])), [
    ['kanban-dev.html?squad=dados&card=c1', '_blank', true],
    ['kanban-dev.html?squad=dados', '_blank', true],
    ['kanban-dev.html?squad=dados&card=c2', '_blank', true],
    [reuniao, '_blank', true],
  ]);
  console.log('✅ Card, Kudos, Intake e reunião externa pedem uma nova aba');
}

async function conferirTemas(page) {
  const fundos = new Set();
  await page.setViewportSize({ width: 390, height: 800 });
  await abrirSino(page);
  await page.waitForFunction(p => { const r = document.querySelector(p).getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }, painel);   // o resize chega assíncrono
  for (const tema of ['', 'light', 'vice']) {
    const medidas = await page.evaluate(({ tema, painel }) => {
      if (tema) document.documentElement.setAttribute('data-theme', tema);
      else document.documentElement.removeAttribute('data-theme');
      const el = document.querySelector(painel);
      const { left, right } = el.getBoundingClientRect();
      const { backgroundColor, color } = getComputedStyle(el);
      return { left, right, largura: innerWidth, sobra: document.documentElement.scrollWidth - innerWidth, backgroundColor, color };
    }, { tema, painel });
    assert.ok(medidas.left >= 0 && medidas.right <= 390 && medidas.largura === 390 && medidas.sobra <= 0, JSON.stringify(medidas));
    assert.notEqual(medidas.backgroundColor, medidas.color);
    assert.notEqual(medidas.backgroundColor, 'rgba(0, 0, 0, 0)');
    fundos.add(medidas.backgroundColor);
  }
  assert.equal(fundos.size, 3);
  await page.keyboard.press('Escape');
  assert.ok(await page.isHidden(painel));
  assert.equal(await page.evaluate(() => document.activeElement.id), 'okr-bell-btn');
  await page.setViewportSize({ width: 1280, height: 860 });
  console.log('✅ Painel sem rolagem lateral em 390 px nos três temas. Esc devolve o foco');
}

async function conferirMembro(browser) {
  const { page, ctx, erros } = await abrirRadar(browser);
  try {
    await page.waitForFunction(selo => document.querySelector(selo)?.textContent === '13', selo);
    await abrirSino(page);
    assert.equal(await page.locator(selo).count(), 1);
    assert.equal(await page.locator(painel + ' .mn-sino-it').count(), 14);
    assert.equal(await page.locator(item('pessoal:mural')).count(), 0);
    assert.equal(await page.locator(item('feed:mural') + '.mn-nao-lida').count(), 0);
    assert.equal(await page.locator(item('pessoal:rascunho')).count(), 0);
    assert.equal(await page.locator('#okr-mural-n').textContent(), '1');
    assert.ok(await page.isVisible('#okr-mural-n'));
    assert.equal(await page.evaluate(p => window.__log.filter(([tipo, ref]) => tipo === 'onValue' && ref === p).length, caminhoPessoais), 1);
    const familias = await page.locator(painel + ' .mn-sino-fam').allTextContents();
    assert.deepEqual([...new Set(familias)].sort(), ['👤 Pessoal', '📅 Calendário', '🎯 Radar', '🛡️ Sistema'].sort());
    assert.equal(await page.locator(painel + ' .mn-sino-tipo').count(), 14);
    assert.equal(await page.locator(item('pessoal:reuniao') + ' .mn-sino-tipo').textContent(), 'Reunião');
    for (const classe of ['mn-sino-x', 'mn-sino-tudo', 'mn-sino-limpar', 'mn-som', 'mn-dnd-btn']) {
      assert.ok(await page.isVisible(painel + ' .' + classe), classe);
    }
    for (const id of ['pessoal:card', 'feed:objetivo']) assert.equal(await page.textContent(item(id) + ' .mn-sino-tit'), texto);
    assert.equal(await page.textContent(item('pessoal:card') + ' .mn-sino-sub'), texto);
    assert.equal(await page.locator(painel + ' img').count(), 0);
    assert.equal(await page.evaluate(() => window.__xss), undefined);
    console.log('✅ Selo deduplicado, famílias, comandos e texto literal no título e subtítulo');

    await conferirTemas(page);
    await conferirRotas(page);
    await abrirSino(page);
    await page.click(item('x:pessoal:sistema'));
    await page.waitForSelector(item('pessoal:sistema'), { state: 'detached' });
    await page.click(painel + ' .mn-sino-tudo');
    await page.waitForSelector(selo, { state: 'hidden' });
    assert.equal(await page.evaluate(() => window.__store.kanban.usuarios.teste.notificacoes.prazo.read), true);
    await abrirSino(page);
    await page.click(painel + ' .mn-sino-limpar');
    await abrirSino(page);
    await page.waitForSelector(painel + ' .mn-sino-vazio');
    const pessoais = await page.evaluate(() => window.__store.kanban.usuarios.teste.notificacoes);
    assert.deepEqual(Object.keys(pessoais).sort(), ['prazo', 'rascunho']);
    assert.equal(pessoais.prazo.dismissed, true);
    console.log('✅ ✕ remove um item, Marcar tudo zera o selo e Limpar antigas preserva o registro noTTLDelete');
    assert.deepEqual(erros, []);
  } finally {
    await ctx.close();
  }
}

async function conferirViewer(browser) {
  const { page, ctx, erros } = await abrirRadar(browser, true);
  try {
    assert.equal(await page.evaluate(() => window._isPainelViewer), true);
    await abrirSino(page);
    await page.waitForSelector(item('feed:mural'));
    assert.equal(await page.locator(painel + ' .mn-sino-it').count(), 3);
    assert.equal(await page.locator(painel + ' [data-mn-id^="pessoal:"]').count(), 0);
    const nota = painel + ' .mn-ft .mn-sino-nota';
    assert.equal(await page.textContent(nota), notaViewer);
    await page.click(painel + ' .mn-sino-limpar');
    await abrirSino(page);
    await page.waitForSelector(painel + ' .mn-sino-vazio');
    const estado = await page.evaluate(() => ({
      acessos: window.__log.filter(([, ref]) => /^kanban\/(usuarios(?:\/|$)|notif_feed_seen(?:\/|$))/.test(ref)),
      ocultos: JSON.parse(localStorage.getItem('mare_feed_seen_externo@example,com')).ocultos,
    }));
    assert.deepEqual(estado.acessos, []);
    assert.deepEqual(estado.ocultos, { mural: true, objetivo: true, evento: true });

    await page.evaluate(({ botao, texto }) => {
      MareNotif.sino(document.querySelector(botao), { user: window._currentUser, isViewer: true, notaRodape: texto });
    }, { botao, texto });
    assert.equal(await page.textContent(nota), texto);
    assert.equal(await page.locator(nota + ' img').count(), 0);
    assert.equal(await page.evaluate(() => window.__xss), undefined);
    assert.deepEqual(erros, []);
    console.log('✅ Visualizador só usa o feed, limpa pelo localStorage e recebe a nota como texto');
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
    await conferirViewer(browser);
    console.log('TUDO OK');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error('❌', error);
  process.exitCode = 1;
});
