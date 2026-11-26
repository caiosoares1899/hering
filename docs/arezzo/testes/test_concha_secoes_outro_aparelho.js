// 🐚 Concha — 📁 seções: salvar o modal que ficou aberto NÃO recria a seção apagada em outro aparelho (revisão do Codex, 26/11/2026).
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_secoes_outro_aparelho.js   (PAGINA_HTML=<arquivo> para a versão antiga)
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const base = process.env.BASE_URL || 'http://127.0.0.1:8941', pagina = process.env.PAGINA_HTML || 'cardume-dev.html';
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const seed = () => ({ kanban: { usuarios: { ana: { role: 'membro', squads: { dados: true } } }, usuarios_publicos: { ana: { nome: 'Ana Lima', email: 'ana@ciahering.com.br' } },
  cardume: { canais: { dados: { nome: 'Dados' }, prf: { nome: 'Performance' } }, membros: { dados: { ana: true }, prf: { ana: true } }, meus: { ana: { dados: true, prf: true } },
    secoes: { ana: { s: { sproj: { n: 'Projetos', o: 0 }, sfav: { n: '⭐ Favoritos', o: 1 } }, c: { prf: 'sproj' } } } } } });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 400))); };
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const cr = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(cr) ? path.join(cr, fs.readdirSync(cr).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed());
  await ctx.addInitScript(() => { localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const toasts = []; await p.exposeFunction('__toast', m => toasts.push(m));
  await p.goto(base + '/' + pagina + '?c=dados'); await p.waitForFunction(() => !!window.__authCb);
  await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(900);
  await p.evaluate(() => { const tt = document.getElementById('toast'); new MutationObserver(() => { if (!tt.hidden) window.__toast(tt.textContent); }).observe(tt, { attributes: true, childList: true, characterData: true, subtree: true }); });
  await p.click('#b-secoes'); await p.waitForTimeout(200);
  // outro aparelho apaga "Projetos" (e devolve o canal ao padrão) com este modal aberto
  await p.evaluate(() => window._update(window._ref(window._db, 'kanban/cardume/secoes/ana'), { 's/sproj': null, 'c/prf': null })); await p.waitForTimeout(200);
  await p.fill('.md input[aria-label="Nome da seção 2"]', '⭐ Favoritos da Ana');   // a pessoa renomeia outra e salva
  await p.click('.md button[type=submit]'); await p.waitForTimeout(400);
  const sec = await p.evaluate(() => JSON.parse(JSON.stringify(window.__store.kanban.cardume.secoes.ana)));
  t('a seção apagada no outro aparelho NÃO volta', !sec.s.sproj, sec.s);
  t('a renomeada aqui foi salva', sec.s.sfav && sec.s.sfav.n === '⭐ Favoritos da Ana', sec.s);
  t('nenhum canal ficou apontando para a seção apagada', !Object.values(sec.c || {}).includes('sproj'), sec.c);
  t('o aviso diz que ela ficou de fora', toasts.some(m => /Projetos.*apagada em outro aparelho/.test(m)), toasts);
  t('sem erro de JS', !errs.length, errs);
  await b.close(); console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
