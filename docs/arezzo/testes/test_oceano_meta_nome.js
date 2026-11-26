// 🌊 Oceano — a entrada de meta lançada pelo Oceano grava o NOME de quem lançou (26/11/2026, achado na exportação da meta de Novembro:
// as entradas do Oceano saíam com nome vazio, porque o objeto do login não tem `nome`). Rodar: python3 -m http.server 8941 →
// node docs/arezzo/testes/test_oceano_meta_nome.js   (PAGINA=oceano.html para ver o comportamento antigo)
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const base = process.env.BASE_URL || 'http://127.0.0.1:8941', pagina = process.env.PAGINA || 'oceano-dev.html';
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const cr = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(cr) ? path.join(cr, fs.readdirSync(cr).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const ctx = await b.newContext(); await fake.install(ctx, { kanban: { usuarios: { cai: { role: 'adm', nome: 'Caio', squads: { dados: true } } }, config: { adm_emails: ['cai@ciahering.com.br'] } } });
  await ctx.addInitScript(() => {   // guarda as opções que a página passa ao MareMetas.ligar
    let real; Object.defineProperty(window, 'MareMetas', { configurable: true, get: () => real, set: v => { real = v; if (v && v.ligar && !v.__espiao) { const o = v.ligar; v.ligar = function (el, opts) { window.__metasOpts = opts; return o.apply(this, arguments); }; v.__espiao = 1; } } });
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/' + pagina); await p.waitForFunction(() => !!window.__authCb);
  await p.evaluate(() => window.__authCb({ uid: 'cai', email: 'cai@ciahering.com.br', displayName: 'Caio Soares', photoURL: '', providerData: [{ providerId: 'google.com' }] }));
  await p.waitForFunction(() => window.__metasOpts && typeof window.__metasOpts.user === 'function', null, { timeout: 15000 }).catch(() => {});
  const u = await p.evaluate(() => window.__metasOpts && window.__metasOpts.user());
  const ok = !!u && u.uid === 'cai' && u.nome === 'Caio Soares';
  console.log((ok ? '✅ ' : '❌ ') + 'o Oceano entrega ao módulo de Metas {uid, nome} de quem está logado' + (ok ? '' : '  ← ' + JSON.stringify(u)));
  console.log(errs.length ? '❌ erros de JS: ' + errs.join(' | ') : '✅ sem erro de JS');
  await b.close(); process.exit(ok && !errs.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
