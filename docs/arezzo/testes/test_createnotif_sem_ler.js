// 🔒 createNotif sem ler a caixa de outra pessoa (docs/ideias/usuarios-leitura-fechar.md › B6, 24/11/2026).
// Para outra pessoa, o Maré grava direto (sem get nem transação); as regras recusam regravar uma notificação que já existe, e o
// PERMISSION_DENIED é o "já existe" esperado — em silêncio, sem reabrir como não lida. Para a própria pessoa, segue a transação.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_createnotif_sem_ler.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const U = (uid, n) => ({ uid, email: uid + '@ciahering.com.br', displayName: n, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const seed = () => ({ kanban: {
  usuarios: {
    ana: { uid: 'ana', nome: 'Ana ADM', email: 'ana@ciahering.com.br', inscrito: true, init: 'AA', role: 'adm', squads: { dev: true } },
    bia: { uid: 'bia', nome: 'Bia Souza', email: 'bia@ciahering.com.br', inscrito: true, init: 'BS', role: 'membro', squads: { dev: true } },
  },
  usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana ADM', init: 'AA' }, bia: { uid: 'bia', nome: 'Bia Souza', init: 'BS' } },
  config: { adm_emails: ['ana@ciahering.com.br'] }, squads_meta: {}, squads: { dev: { cards: {} } },
} });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 400))); };

(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(chromeRoot) ? path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); await fake.install(ctx, seed());
  // as regras novas: quem não é o dono não regrava uma notificação existente (nem PO/ADM)
  await ctx.addInitScript(() => {
    window.__denySet = (p, v) => {
      const m = /^kanban\/usuarios\/([^/]+)\/notificacoes\/([^/]+)/.exec(p); if (!m) return false;
      const eu = 'ana';   // quem está logada neste teste
      if (m[1] === eu || v === null) return false;
      const atual = ((((window.__store.kanban || {}).usuarios || {})[m[1]] || {}).notificacoes || {})[m[2]];
      return !!atual;
    };
  });
  await ctx.route('https://www.google.com/s2/favicons**', r => r.abort());
  const p = await ctx.newPage(); const errs = [], avisos = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (/createNotif/.test(m.text())) avisos.push(m.text()); });
  await p.goto(base + '/kanban-dev.html?squad=dev'); await p.waitForFunction(() => !!window.__authCb);
  await p.evaluate(x => window.__authCb(x), U('ana', 'Ana ADM')); await p.waitForTimeout(2800);
  const log = () => p.evaluate(() => window.__log.filter(l => /usuarios\/bia\/notificacoes\//.test(l[1])).map(l => l[0]));
  const ler = c => p.evaluate(c => c.split('/').reduce((a, k) => (a == null ? undefined : a[k]), window.__store), c);

  await p.evaluate(() => { window.__log.length = 0; _recentNotifs.clear(); createNotif('bia', 'mention', '@BS', 'x', 'c1', 'fixo1'); });
  await p.waitForTimeout(300);
  const l1 = await log();
  t('para outra pessoa: grava direto, sem get nem transação na caixa dela', l1.includes('set') && !l1.includes('get') && !l1.includes('transaction'), l1);
  t('a notificação foi criada não lida', (await ler('kanban/usuarios/bia/notificacoes/fixo1/read')) === false, await ler('kanban/usuarios/bia/notificacoes/fixo1'));
  await p.evaluate(() => { window.__store.kanban.usuarios.bia.notificacoes.fixo1.read = true; });   // a Bia leu (no aparelho dela)
  await p.evaluate(() => { window.__log.length = 0; _recentNotifs.clear(); createNotif('bia', 'mention', '@BS', 'x', 'c1', 'fixo1'); });
  await p.waitForTimeout(300);
  const l2 = await log();
  t('mesmo id de novo: continua sem ler a caixa dela', !l2.includes('get') && !l2.includes('transaction'), l2);
  t('…e a lida NÃO reabre (a regra recusa regravar)', (await ler('kanban/usuarios/bia/notificacoes/fixo1/read')) === true, await ler('kanban/usuarios/bia/notificacoes/fixo1'));
  t('a recusa esperada fica em silêncio (sem aviso de falha)', !avisos.some(a => /write failed/.test(a)), avisos);

  await p.evaluate(() => { window.__log.length = 0; _recentNotifs.clear(); createNotif('ana', 'mention', '@AA', 'x', 'c1', 'fixo2'); });
  await p.waitForTimeout(300);
  const l3 = await p.evaluate(() => window.__log.filter(l => /usuarios\/ana\/notificacoes\/fixo2/.test(l[1])).map(l => l[0]));
  t('para a própria pessoa: segue a transação (lê a própria caixa)', l3.includes('transaction'), l3);
  t('sem erro de JS', !errs.length, errs);
  await b.close();
  console.log(ok ? `TUDO OK (${total} verificações)` : 'FALHOU');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
