// Sirva a raiz em BASE_URL (padrão http://127.0.0.1:8949).
// Rode node docs/arezzo/testes/test_painel_diretorio.js.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const home = require('node:os').homedir();
const fake = require('./fakefb');

const pwPath = process.env.PLAYWRIGHT_MODULE || (fs.existsSync('/opt/node22/lib/node_modules/playwright')
  ? '/opt/node22/lib/node_modules/playwright'
  : path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const base = process.env.BASE_URL || 'http://127.0.0.1:8949';

function resolveChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const linux = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  if (fs.existsSync(linux)) return linux;
  const pasta = path.join(home, 'hering-tools/chrome');
  const arm = fs.readdirSync(pasta).find(n => n.startsWith('mac_arm-'));
  return path.join(pasta, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
}

const membro = {
  nome: 'Pessoa do Squad', email: 'squad@ciahering.com.br', init: 'PS',
  foto: 'https://example.invalid/avatar.png', role: 'membro', squads: { dev: true },
  squads_roles: { dev: 'organizador' }, diretoria: 'rh', gestorOkr: true, torre: 'geral',
};
const legado = { nome: 'Pessoa Legada', init: 'PL', inscrito: true };

function seed(user, role, listado) {
  const cadastro = { uid: user.uid, nome: user.displayName, email: user.email, role };
  return { kanban: {
    // O espelho da própria conta está desatualizado de propósito.
    usuarios_publicos: { sessao: { ...cadastro, role: role === 'adm' ? 'membro' : 'adm' }, membro, legado },
    usuarios: {
      sessao: cadastro,
      membro: {
        ...membro,
        fcm_tokens: { teste: { token: 'token-ficticio' } },
        notif_prefs: { dnd: { on: true } },
        notificacoes: { teste: { type: 'kudos', ts: new Date().toISOString(), read: true } },
      },
      legado,
      soFonte: { nome: 'Só na fonte' },
    },
    painel_viewers: { 'externo@example,invalid': true },
    config: { adm_emails: listado ? [user.email] : [] },
    notif_config: { kudos: { sino: false } },
  } };
}

async function abrir(browser, { role, listado = false, email = 'sessao@ciahering.com.br', externo = false }) {
  const user = {
    uid: externo ? 'externo' : 'sessao', email, displayName: 'Pessoa da Sessão',
    photoURL: '', providerData: [{ providerId: 'google.com' }],
  };
  const context = await browser.newContext();
  try {
    await context.route('https://example.invalid/**', r => r.fulfill({ status: 204 }));
    await fake.install(context, seed(user, role, listado));
    const page = await context.newPage();
    const avisos = [];
    page.on('console', msg => {
      if (msg.type() === 'warning' && msg.text().includes('Falta o papel adm no cadastro')) avisos.push(msg.text());
    });
    await page.goto(base + '/painel-dev.html?tab=notifs', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__authCb);
    await page.evaluate(u => window.__authCb(u), user);
    await page.waitForFunction(() => _guLoadedAt && !_guInflight && _ncAberta() &&
      document.querySelector('#nc-row-kudos input')?.checked === false);
    if (listado) await page.waitForFunction(() => isAdmUser(window._currentUser));

    if (!externo) {
      await page.evaluate(() => {
        cfgSquadId = 'dev';
        loadPcfgUsers();
        loadSquadData('dev');
        ncAtualizar();
      });
      await page.waitForFunction(() => !(_guInflight || _guQueued) &&
        document.querySelector('#pcfg-users-list select') &&
        (squadData.dev?.members || []).some(m => m.init === 'PS'));
    }

    const estado = await page.evaluate(() => {
      const q = s => document.querySelector(s);
      const visivel = s => q(s).getClientRects().length > 0;
      const membros = squadData.dev?.members || [];
      const avatar = document.createElement('div');
      avatar.innerHTML = _painelOwnerAvatarHtml('PS', 'dev');
      const membroConfig = [...q('#pcfg-users-list').children].find(row => row.textContent.includes('Pessoa do Squad'));
      const membroGestao = q('#global-users-list select[aria-label="Diretoria de Pessoa do Squad"]');
      const linhaGestao = membroGestao?.parentElement.parentElement;
      return {
        leituras: window.__log.filter(([op, p]) =>
          (op === 'get' || op === 'onValue') && /^kanban\/usuarios(?:_publicos)?(?:\/|$)/.test(p)),
        viewer: window._isPainelViewer,
        soFonte: !!_globalUsersCache.soFonte,
        membros: membros.map(m => m.name),
        avatar: avatar.querySelector('img')?.getAttribute('src'),
        papelSquad: membroConfig?.querySelector('select')?.value,
        diretoria: [membroGestao?.value, membroGestao?.disabled],
        gestor: [...(linhaGestao?.querySelectorAll('label') || [])]
          .find(label => label.textContent.includes('Gestor OKR'))?.querySelector('input')?.checked,
        torre: _guTorreDe(_globalUsersCache.membro),
        tipos: visivel('#nc-tipos') && !!q('#nc-row-kudos'),
        sino: [q('#nc-row-kudos input').checked, q('#nc-row-kudos input').disabled],
        pessoas: visivel('#nc-secao-pessoas'),
        bloqueio: visivel('#nc-diretorio') ? q('#nc-diretorio').textContent : '',
        semPermissao: visivel('#nc-sem-permissao'),
        resumo: q('#nc-resumo').textContent,
        linhasPessoas: q('#nc-pessoas').textContent,
        uso: q('#nc-row-kudos .nc-uso').textContent,
      };
    });
    return { ...estado, avisos };
  } finally {
    await context.close();
  }
}

function conferirLeituras(rotulo, estado, { adm = false, externo = false, excecao = false } = {}) {
  const leituras = estado.leituras;
  console.log(rotulo + ' __log ' + JSON.stringify(leituras));
  assert.equal(leituras.some(([op, p]) => op === 'get' && p === 'kanban/usuarios'), adm);
  assert.equal(leituras.some(([op, p]) => op === 'get' && p === 'kanban/usuarios/sessao/role'), !externo && !excecao);
  if (!adm) {
    assert.ok(leituras.some(([op, p]) => op === 'get' && p === 'kanban/usuarios_publicos'));
    const privadas = leituras.filter(([, p]) => /^kanban\/usuarios(?:\/|$)/.test(p));
    if (externo) assert.deepEqual(privadas, []);
    else assert.ok(privadas.every(([, p]) => p === 'kanban/usuarios/sessao' || p.startsWith('kanban/usuarios/sessao/')));
  }
}

function conferirCentralDiretorio(estado) {
  assert.equal(estado.tipos, true);
  assert.deepEqual(estado.sino, [false, true]);
  assert.equal(estado.pessoas, false);
  assert.match(estado.bloqueio, /🔒 Os números por pessoa/);
  assert.doesNotMatch(estado.resumo, /Não Perturbe agora|Pessoas com push/);
  assert.equal(estado.linhasPessoas, '');
  assert.equal(estado.uso, '');
}

(async () => {
  const { chromium } = require(pwPath);
  const browser = await chromium.launch({ executablePath: resolveChrome(), headless: true });
  try {
    const po = await abrir(browser, { role: 'po' });
    conferirLeituras('PO', po);
    conferirCentralDiretorio(po);
    assert.ok(po.membros.includes(membro.nome) && po.membros.includes(legado.nome));
    assert.equal(po.avatar, membro.foto);
    assert.equal(po.papelSquad, 'organizador');
    assert.deepEqual(po.diretoria, ['rh', true]);
    assert.deepEqual(po.avisos, []);
    console.log('✅ PO: membros, avatares, papel por squad e catálogo em ?tab=notifs');

    const adm = await abrir(browser, { role: 'adm', listado: true });
    conferirLeituras('ADM', adm, { adm: true });
    assert.equal(adm.soFonte, true);
    assert.equal(adm.papelSquad, 'organizador');
    assert.deepEqual(adm.diretoria, ['rh', false]);
    assert.equal(adm.gestor, true);
    assert.equal(adm.torre, 'geral');
    assert.equal(adm.tipos, true);
    assert.deepEqual(adm.sino, [false, false]);
    assert.equal(adm.pessoas, true);
    assert.equal(adm.bloqueio, '');
    assert.match(adm.resumo, /Pessoas com push/);
    assert.match(adm.linhasPessoas, /📲 1 aparelho/);
    assert.match(adm.linhasPessoas, /🔕 ligado/);
    assert.match(adm.uso, /1 em 1 pessoa · 0 não lidas/);
    console.log('✅ ADM: cadastro completo, gestão e indicadores da Central');

    const listado = await abrir(browser, { listado: true });
    conferirLeituras('adm_emails sem role', listado);
    conferirCentralDiretorio(listado);
    assert.equal(listado.semPermissao, true);
    assert.equal(listado.avisos.length, 1);
    console.log('✅ ADM só pela lista: catálogo, aviso na tela e um console.warn');

    const semLista = await abrir(browser, { role: 'adm' });
    conferirLeituras('ADM fora da lista', semLista, { adm: true });
    assert.equal(semLista.pessoas, true);
    assert.deepEqual(semLista.sino, [false, true]);

    const excecao = await abrir(browser, { email: 'caio.soares@ciahering.com.br' });
    conferirLeituras('Exceção do e-mail', excecao, { adm: true, excecao: true });
    assert.equal(excecao.pessoas, true);

    const externo = await abrir(browser, { externo: true, email: 'externo@example.invalid' });
    conferirLeituras('Externo', externo, { externo: true });
    assert.equal(externo.viewer, true);
    assert.equal(externo.soFonte, false);
    assert.equal(externo.tipos, false);
    console.log('✅ Externo: segue no diretório, em modo visualização');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
