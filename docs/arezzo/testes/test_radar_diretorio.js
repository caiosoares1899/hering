// Sirva a raiz em BASE_URL (padrão http://127.0.0.1:8949).
// OKR_ANTES pode apontar para uma cópia de okr-dev.html anterior à B4 para comparar a tela.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const home = require('node:os').homedir();
const fake = require('./fakefb');

const pwPath = process.env.PLAYWRIGHT_MODULE || (fs.existsSync('/opt/node22/lib/node_modules/playwright')
  ? '/opt/node22/lib/node_modules/playwright'
  : path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const { chromium } = require(pwPath);
const base = process.env.BASE_URL || 'http://127.0.0.1:8949';
function resolveChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const linux = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  if (fs.existsSync(linux)) return linux;
  const pasta = path.join(home, 'hering-tools/chrome');
  const arm = fs.readdirSync(pasta).find(n => n.startsWith('mac_arm-'));
  return path.join(pasta, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
}

const foto = 'https://example.invalid/avatar.png';
const responsavel = { nome: 'Responsável Teste', email: 'resp@ciahering.com.br', init: 'RT', foto, torre: 'geral' };
const membro = { uid: 'sessao', nome: 'Pessoa Teste', email: 'pessoa@ciahering.com.br',
  role: 'membro', torre: 'geral', gestorOkr: true, squads: { dados: true } };
const espelhoVelho = { ...membro, role: 'po', torre: 'digital', gestorOkr: false, squads: { site: true } };
const externo = { uid: 'externo', nome: 'Visitante Teste', email: 'visitante@example.invalid' };
function seed(proprio, espelho) {
  return { kanban: {
    usuarios: { sessao: proprio, responsavel, semEspelho: { nome: 'Sem Espelho' } },
    usuarios_publicos: { sessao: espelho, responsavel },
    painel_viewers: { 'visitante@example,invalid': true },
    okr: { objetivos: { teste: { id: 'teste', titulo: 'Objetivo Teste',
      torre: 'digital', areaId: 'geral', responsaveis: ['responsavel'] } } },
  } };
}

async function abrir(browser, { proprio = membro, espelho = proprio, user = proprio, html } = {}) {
  const context = await browser.newContext();
  try {
    await context.route('https://example.invalid/**', r => r.fulfill({ status: 204 }));
    await fake.install(context, seed(proprio, espelho));
    if (html) await context.route('**/okr-dev.html?torre=digital', r => r.fulfill({ path: html }));
    const page = await context.newPage();
    const erros = [];
    page.on('pageerror', e => erros.push(e.message));
    await page.goto(base + '/okr-dev.html?torre=digital', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__authCb);
    await page.evaluate(u => window.__authCb({
      uid: u.uid, email: u.email, displayName: u.nome, photoURL: '',
      providerData: [{ providerId: 'google.com' }],
    }), user);
    await page.waitForFunction(() => _okrUsersOk && !_guInflight && _okrLoaded);
    const resultado = await page.evaluate(() => {
      const uid = window._currentUser.uid;
      const avatar = document.querySelector('#okr-objetivos-wrap .okr-avatar');
      return {
        leituras: window.__log.filter(([op, p]) =>
          (op === 'get' || op === 'onValue') && /^kanban\/usuarios(?:_publicos)?(?:\/|$)/.test(p)),
        viewer: window._isPainelViewer,
        semEspelho: !_okrPessoaOptions().some(p => p.uid === 'semEspelho'),
        estado: {
          nome: document.querySelector('#okr-filter-pessoa option[value="responsavel"]')?.textContent,
          avatar: [avatar?.title, avatar?.querySelector('img')?.getAttribute('src')],
          minhaTorre: _okrMinhaTorre(),
          torreResponsavel: _okrTorreDoUsuario('responsavel'),
          gestor: _isGestorOkr(uid),
          po: _isPOouOrgEmAlgumSquad(uid),
          squads: Object.keys(_globalUsersCache[uid]?.squads || {}),
          novo: getComputedStyle(document.getElementById('okr-novo-btn')).display !== 'none',
          edita: _okrCanEdit(okrObjetivos.teste),
        },
      };
    });
    assert.deepEqual(erros, [], 'Erros de JS na página');
    return resultado;
  } finally {
    await context.close();
  }
}

function conferirLeituras(resultado, uid, viewer = false) {
  const { leituras } = resultado;
  console.log(uid + ' __log ' + JSON.stringify(leituras));
  assert.ok(leituras.some(([op, p]) => op === 'get' && p === 'kanban/usuarios_publicos'));
  const privadas = leituras.filter(([, p]) => /^kanban\/usuarios(?:\/|$)/.test(p));
  if (viewer) assert.deepEqual(privadas, []);
  else {
    const proprio = 'kanban/usuarios/' + uid;
    assert.ok(privadas.some(([op, p]) => op === 'get' && p === proprio), 'Faltou ler o cadastro próprio');
    assert.ok(privadas.every(([, p]) => p === proprio || p.startsWith(proprio + '/')), 'Leitura fora do cadastro próprio');
  }
}

(async () => {
  const browser = await chromium.launch({ executablePath: resolveChrome(), headless: true });
  try {
    const atual = await abrir(browser);
    conferirLeituras(atual, membro.uid);
    assert.equal(atual.viewer, false);
    assert.equal(atual.semEspelho, true);
    assert.deepEqual(atual.estado, {
      nome: responsavel.nome, avatar: [responsavel.nome, foto], minhaTorre: 'geral',
      torreResponsavel: 'geral', gestor: true, po: false, squads: ['dados'], novo: true, edita: true,
    });
    if (process.env.OKR_ANTES) {
      const antes = await abrir(browser, { html: process.env.OKR_ANTES });
      assert.deepEqual(atual.estado, antes.estado, 'Paridade com a tela anterior');
    }
    console.log('✅ Interno: nomes, foto, torres e controles de Gestor OKR');

    const velho = await abrir(browser, { espelho: espelhoVelho });
    conferirLeituras(velho, membro.uid);
    assert.deepEqual(velho.estado, atual.estado, 'Papel, torre, squads e Gestor OKR do cadastro próprio');
    const revogado = await abrir(browser, {
      proprio: { ...membro, gestorOkr: undefined }, espelho: { ...membro, role: 'po' },
    });
    assert.equal(revogado.estado.gestor, false);
    assert.equal(revogado.estado.po, false);
    assert.equal(revogado.estado.novo, false);
    assert.equal(revogado.estado.edita, false);
    console.log('✅ Espelho antigo: campos da própria conta prevalecem, inclusive revogação');

    const convidado = await abrir(browser, { user: externo });
    conferirLeituras(convidado, externo.uid, true);
    assert.equal(convidado.viewer, true);
    assert.deepEqual(convidado.estado.avatar, [responsavel.nome, foto]);
    assert.equal(convidado.estado.nome, responsavel.nome);
    assert.equal(convidado.estado.novo, false);
    assert.equal(convidado.estado.edita, false);
    console.log('✅ Externo autorizado: diretório público e visualização');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
