// 🐚 Concha — 🔄 atualização obrigatória (26/11/2026, pedido do Caio: como no Maré). Versão nova no version.json → tela cheia que trava a Concha;
// o rascunho do campo fica guardado, a mensagem em edição vai para uma caixa para copiar e o "apagar" pendente não acontece (avisa).
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_atualizar.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const ag = Date.now();
const seed = () => ({ kanban: { usuarios: { ana: { role: 'membro', squads: { dados: true } } }, usuarios_publicos: { ana: { nome: 'Ana Lima', email: 'ana@ciahering.com.br' } },
  cardume: { canais: { dados: { nome: 'Dados' } }, membros: { dados: { ana: true } }, meus: { ana: { dados: true } },
    msgs: { dados: { k1: { uid: 'ana', ts: ag - 60000, texto: 'texto original' }, k2: { uid: 'ana', ts: ag - 50000, texto: 'para apagar' } } } } } });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 300))); };
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const cr = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(cr) ? path.join(cr, fs.readdirSync(cr).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  for (const [w, h, tema] of [[1280, 860, 'abrolhos'], [390, 844, 'lencois']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' }); await fake.install(ctx, seed());
    let nova = false;
    await ctx.route('**/version.json*', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ cardume_dev: nova ? 'v9.99 · cardume-dev' : null }) }));
    await ctx.addInitScript(tm => { localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off', tema: tm })); }, tema);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(5000);
    t(w + ' px: sem versão nova, nada aparece', await p.evaluate(() => document.getElementById('atualizar-ov').hidden), 0);
    // rascunho no campo + editando k1 + apagando k2 (5 s para desfazer)
    await p.fill('#entrada', 'rascunho que não pode sumir');
    if (w > 500) {
      await p.hover('[data-msg="k1"]'); await p.click('[data-msg="k1"] [aria-label="Editar"]'); await p.waitForTimeout(150);
      await p.fill('[data-msg="k1"] textarea', 'texto editado e ainda não salvo');
    }
    nova = true;
    await p.waitForTimeout(10200);   // o checarAoVoltar só reconsulta 10 s depois da última checagem
    if (w > 500) { await p.hover('[data-msg="k2"]'); await p.click('[data-msg="k2"] [aria-label="Apagar"]'); await p.waitForTimeout(100); }   // apagando (5 s para desfazer) quando a versão nova chega
    await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(800);
    const st = await p.evaluate(() => { const ov = document.getElementById('atualizar-ov'), bt = document.getElementById('atualizar-agora'), r = bt.getBoundingClientRect();
      const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { visivel: !ov.hidden, topo: topo === bt, txt: document.getElementById('atualizar-texto').value, copia: !document.getElementById('atualizar-copia').hidden, d: document.getElementById('atualizar-d').textContent, foco: document.activeElement && document.activeElement.id }; });
    t(w + ' px: versão nova → a tela cheia aparece e o botão "Atualizar agora" está por cima de tudo', st.visivel && st.topo, st);
    t(w + ' px: o rascunho do campo de mensagem está guardado no aparelho', await p.evaluate(() => Object.keys(localStorage).some(k => localStorage.getItem(k) === 'rascunho que não pode sumir')), 0);
    if (w > 500) {
      t('a mensagem em edição vai para a caixa de copiar', st.copia && /texto editado e ainda não salvo/.test(st.txt) && st.foco === 'atualizar-copiar', st);
      t('avisa que a mensagem sendo apagada NÃO será apagada', /NÃO será apagada/.test(st.d), st.d);
    } else t(w + ' px: sem nada a copiar, a caixa fica escondida e o foco vai para "Atualizar agora"', !st.copia && st.foco === 'atualizar-agora', st);
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    t(w + ' px: Esc não fecha a tela', await p.evaluate(() => !document.getElementById('atualizar-ov').hidden), 0);
    for (let i = 0; i < 4; i++) await p.keyboard.press('Tab');
    t(w + ' px: Tab não sai da tela', await p.evaluate(() => document.getElementById('atualizar-ov').contains(document.activeElement)), 0);
    if (w > 500) { await p.waitForTimeout(5500); t('o "apagar" pendente não foi gravado depois da tela', await p.evaluate(() => !window.__store.kanban.cardume.msgs.dados.k2.apagada), 0); }
    await p.screenshot({ path: 'docs/capturas/concha-atualizar/tela-' + w + '.png' });
    const nav = p.waitForNavigation({ timeout: 5000 }).then(() => true).catch(() => false);
    await p.click('#atualizar-agora');
    t(w + ' px: "Atualizar agora" recarrega a página', await nav, 0);
    t(w + ' px: sem erro de JS', !errs.length, errs);
    await ctx.close();
  }
  await b.close(); console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
