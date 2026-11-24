// Sirva a raiz em BASE_URL (padrão http://127.0.0.1:8941).
// Antes de a #1955 entrar na base: REGRAS=/tmp/regras.json node docs/arezzo/testes/test_espelho_torre.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const home = require('node:os').homedir();
const fake = require('./fakefb.js');
const rulesSim = require('../../../functions/rules/rulesSim.js');

const raiz = path.join(__dirname, '../../..');
const regras = JSON.parse(fs.readFileSync(process.env.REGRAS || path.join(raiz, 'database.rules.json'), 'utf8'));
for (const campo of ['torre', 'gestorOkr']) {
  assert.ok(regras.rules.kanban.usuarios_publicos.$uid[campo]?.['.validate'],
    'Use as regras da fase A (PR #1955) via REGRAS.');
}
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const usuario = (uid, nome) => ({
  uid, displayName: nome, email: uid + '@ciahering.com.br', photoURL: '',
  providerData: [{ providerId: 'google.com' }],
});
const pessoa = usuario('pessoa', 'Pessoa Teste');
const adm = usuario('adm', 'Adm Teste');
const perfil = (u, init, role) => ({
  uid: u.uid, nome: u.displayName, email: u.email, foto: '', init, role,
  inscrito: true, criadoEm: '2026-11-01T00:00:00Z', diretoria: 'digital',
  squads: { dados: true },
});
function seed(pagina) {
  const cadastro = perfil(pessoa, 'PT', 'membro');
  if (pagina === 'kanban') cadastro.gestorOkr = true;
  const administrador = perfil(adm, 'AT', 'adm');
  return { kanban: {
    usuarios: { pessoa: cadastro, adm: administrador },
    usuarios_publicos: { pessoa: { ...cadastro }, adm: { ...administrador } },
    config: { adm_emails: [adm.email] },
    init_registry: { PT: pessoa.uid, AT: adm.uid },
    squads: { dados: { dados: {
      columns: [{ id: 'backlog', name: 'Backlog' }],
    } } },
  } };
}
function mapa(e) {
  if (e.tipo !== 'update') return { [e.p]: e.v };
  return Object.fromEntries(Object.entries(e.v).map(([k, v]) => [e.p ? e.p + '/' + k : k, v]));
}
function conferirEscritas(escritas, quem) {
  assert.ok(escritas.length, 'O Firebase falso registrou escritas');
  const auth = { uid: quem.uid, token: { email: quem.email, firebase: { sign_in_provider: 'google.com' } } };
  for (const e of escritas) {
    const caminhos = mapa(e);
    const relogio = Date.now;
    try {
      Date.now = () => e.t;
      assert.ok(rulesSim.update(regras, e.antes, auth, caminhos),
        'Regras recusaram ' + e.tipo + ' em ' + Object.keys(caminhos).join(', '));
    } finally {
      Date.now = relogio;
    }
  }
  console.log('✅ ' + escritas.length + ' escritas aceitas pelas regras reais');
}
async function conferirEspelho(page, acionar, campo, valor, fluxo) {
  const inicio = await page.evaluate(() => (window.__escritas || []).length);
  await acionar();
  await page.waitForFunction(({ uid, campo, valor }) =>
    (window.__store.kanban.usuarios[uid][campo] ?? null) === valor,
  { uid: pessoa.uid, campo, valor });
  const { escritas, espelho } = await page.evaluate(({ uid, campo, inicio }) => ({
    escritas: window.__escritas.slice(inicio),
    espelho: window.__store.kanban.usuarios_publicos[uid][campo] ?? null,
  }), { uid: pessoa.uid, campo, inicio });
  const fonte = 'kanban/usuarios/' + pessoa.uid + '/' + campo;
  const publico = 'kanban/usuarios_publicos/' + pessoa.uid + '/' + campo;
  const alteracoes = escritas.filter(e => {
    const caminhos = mapa(e);
    return Object.hasOwn(caminhos, fonte) || Object.hasOwn(caminhos, publico);
  });
  assert.equal(alteracoes.length, 1, fluxo + ': deve haver uma única escrita do campo');
  assert.equal(alteracoes[0].tipo, 'update', fluxo + ': operação multipath');
  assert.equal(mapa(alteracoes[0])[fonte], valor, fluxo + ': valor no cadastro');
  assert.equal(mapa(alteracoes[0])[publico], valor, fluxo + ': mesmo valor no payload público');
  assert.equal(espelho, valor, fluxo + ': estado final do diretório');
  console.log('✅ ' + fluxo);
}

async function rodar(browser, pagina, quem, passos) {
  const ctx = await browser.newContext();
  try {
    // O modo de várias torres existe no app. Ligue-o só no HTML servido ao teste.
    await ctx.route('**/' + pagina + '-dev.html*', async route => {
      const original = fs.readFileSync(path.join(raiz, pagina + '-dev.html'), 'utf8');
      assert.ok(original.includes('window.MARE_SO_HERING = true;'));
      await route.fulfill({ contentType: 'text/html', body: original.replace(
        'window.MARE_SO_HERING = true;', 'window.MARE_SO_HERING = false;') });
    });
    await fake.install(ctx, seed(pagina));
    if (pagina === 'kanban') await ctx.addInitScript(() => localStorage.setItem('cad_insc', '1'));
    const page = await ctx.newPage();
    await page.goto(base + '/' + pagina + '-dev.html' + (pagina === 'kanban' ? '?squad=dados' : ''));
    await page.waitForFunction(() => !!window.__authCb && !!window._runTransaction && !!window._ref);
    await page.evaluate(async u => {
      // fakefb registra set/update. Capture também transações e remoções com o estado anterior.
      for (const [nome, tipo] of [['_runTransaction', 'transaction'], ['_remove', 'remove']]) {
        const original = window[nome];
        if (!original) continue;
        window[nome] = async function(ref, ...args) {
          const antes = JSON.parse(JSON.stringify(window.__store));
          const t = Date.now();
          const resultado = await original(ref, ...args);
          if (tipo === 'remove' || resultado.committed) {
            (window.__escritas ||= []).push({
              tipo, p: ref.p, v: tipo === 'remove' ? null : resultado.snapshot.val(), antes, t,
            });
          }
          return resultado;
        };
      }
      // O Painel usa a URL da referência real para decidir se recarrega o cache.
      const ref = window._ref;
      window._ref = (...args) => {
        const r = ref(...args);
        r.toString = () => 'https://firebase.test/' + r.p;
        return r;
      };
      await window.__authCb(u);
    }, quem);
    await passos(page);
    conferirEscritas(await page.evaluate(() => window.__escritas || []), quem);
  } finally {
    await ctx.close();
  }
}

(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const chromeDir = fs.existsSync(chromeRoot) && fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-'));
  const chrome = process.env.CHROME || (chromeDir && path.join(chromeRoot, chromeDir,
    'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'));
  const browser = await chromium.launch(chrome ? { executablePath: chrome } : {});
  try {
    await rodar(browser, 'kanban', pessoa, async page => {
      await page.locator('#insc-ov.open #insc-torre').selectOption('comercial');
      await conferirEspelho(page, () => page.locator('#insc-ov button[onclick="confirmarInscricao()"]').click(),
        'torre', 'comercial', 'Inscrição no Maré');
      assert.equal(await page.evaluate(uid => window.__store.kanban.usuarios_publicos[uid].gestorOkr, pessoa.uid),
        true, 'O login do Maré preserva Gestor OKR já espelhado');
    });
    await rodar(browser, 'okr', pessoa, async page => {
      await conferirEspelho(page, () => page.locator('#okr-torre-ov .okr-t-corporativa').click(),
        'torre', 'corporativa', 'Escolha no Radar');
    });
    await rodar(browser, 'painel', adm, async page => {
      await page.waitForFunction(() => window._currentUser && _isAdmPainel() && _guLoadedAt);
      const alvo = pessoa.uid;
      await conferirEspelho(page, () => page.evaluate(uid => setGlobalUserTorre(uid, 'geral'), alvo),
        'torre', 'geral', 'ADM muda torre no Painel');
      await page.waitForFunction(uid => _globalUsersCache[uid]?.torre === 'geral', alvo);
      for (const ligado of [true, false]) {
        const valor = ligado ? true : null;
        await conferirEspelho(page, () => page.evaluate(({ uid, ligado }) => toggleGestorOkr(uid, ligado),
          { uid: alvo, ligado }), 'gestorOkr', valor, ligado ? 'ADM liga Gestor OKR' : 'ADM desliga Gestor OKR');
        await page.waitForFunction(({ uid, valor }) => (_globalUsersCache[uid]?.gestorOkr ?? null) === valor,
          { uid: alvo, valor });
      }
    });
  } finally {
    await browser.close();
  }
})().catch(e => { console.error('❌', e); process.exitCode = 1; });
