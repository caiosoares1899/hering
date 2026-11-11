// ↩ Travessia — humor com aviso antes e desfazer (T8 da consultoria, 11/11/2026; só na Travessia por decisão do Caio).
// "Seu líder vê esta resposta" acima das carinhas; o toque grava na hora, mas o aviso de apoio ao líder (mal/muito mal) só sai depois de 8 s,
// com "Registrado · Desfazer" nesse meio-tempo. Desfazer volta ao humor anterior e cancela o aviso; trocar de carinha vale a última; esconder a aba dispara na hora.
// Rodar: python3 -m http.server 8961 --directory . (na raiz) e `node docs/arezzo/testes/test_travessia_humor_desfazer.js` (BASE_URL troca o servidor).
const fs = require('fs'), path = require('path'), home = require('os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const cr = path.join(home, 'hering-tools/chrome'), chrome = process.env.CHROME || path.join(cr, fs.readdirSync(cr).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8961', out = path.join(__dirname, '..', '..', 'capturas', 'travessia-humor');
(async () => {
  const b = await chromium.launch({ executablePath: chrome }); let falhas = 0, total = 0;
  const t = (n, c, d) => { total++; if (!c) falhas++; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  fs.mkdirSync(out, { recursive: true });
  const abre = async (vp) => { const ctx = await b.newContext({ viewport: vp || { width: 1280, height: 900 } }); await fake.install(ctx, {}); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/travessia-dev.html?demo=1&como=ana'); await p.waitForSelector('#app .h1', { timeout: 8000 }); await p.waitForTimeout(600); return { ctx, p, errs }; };
  // o que está "gravado" na demo: humor de hoje da Ana (privado e compartilhado) e o aviso no sino do líder (Pau)
  const estado = p => p.evaluate(() => { const M = window.Travessia.demoMem.kanban; const d = new Date(); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const tr = M.travessia; return { h: tr.humor.ana && tr.humor.ana[k] ? tr.humor.ana[k].n : null, c: tr.humor_comp.ana && tr.humor_comp.ana[k] ? tr.humor_comp.ana[k].n : null,
      aviso: !!(M.usuarios.pau && M.usuarios.pau.notificacoes && M.usuarios.pau.notificacoes['apoio_ana_' + k]), undo: !!document.getElementById('humor-undo'), pend: window.Travessia.humorPendente() }; });
  const toque = async (p, n) => { await p.click(`[data-act="humor"][data-n="${n}"]`); await p.waitForTimeout(400); };

  // 1) frase acima das carinhas + toque "muito mal" + desfazer
  for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 800 }]) { const r = vp.width + 'px';
    const { ctx, p, errs } = await abre(vp);
    t(r + ': "Seu líder (Pau Reis) vê esta resposta." ACIMA das carinhas', await p.evaluate(() => { const q = document.querySelector('.quem-ve'), f = document.querySelector('.faces'); return !!q && /Pau Reis\) vê esta resposta/.test(q.textContent) && (q.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING) > 0; }), '');
    t(r + ': explicação cita os 8 segundos', await p.evaluate(() => /8 segundos depois do toque/.test(document.querySelector('#painel').textContent)), '');
    const antes = await estado(p);
    await toque(p, 1); const s1 = await estado(p);
    t(r + ': o toque grava na hora (privado e compartilhado) e mostra "Registrado · Desfazer"', s1.h === 1 && s1.c === 1 && s1.undo && s1.pend, s1);
    t(r + ': o aviso ao líder ainda NÃO saiu', !s1.aviso, s1);
    if (vp.width === 390) await p.screenshot({ path: path.join(out, 'desfazer-390.png'), clip: await p.locator('[aria-labelledby="t-hu"]').boundingBox() });
    const bt = await p.locator('#humor-undo .btn').boundingBox(); t(r + ': botão Desfazer com alvo ≥ 44 px de altura', bt && bt.height >= 44, bt);
    await p.click('[data-act="humor-desfazer"]'); await p.waitForTimeout(500);
    const s2 = await estado(p);
    t(r + ': desfazer volta ao humor anterior (privado e compartilhado) e some o botão', s2.h === antes.h && s2.c === antes.c && !s2.undo && !s2.pend, [antes, s2]);
    await p.waitForTimeout(8600); const s3 = await estado(p);
    t(r + ': depois dos 8 s, nenhum aviso ao líder (foi desfeito)', !s3.aviso, s3);
    t(r + ': sem rolagem lateral e sem erro de JS', (await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)) && !errs.length, errs);
    await ctx.close(); }

  // 2) "mal" sem desfazer → aviso sai depois de 8 s (e não antes)
  { const { ctx, p } = await abre(); await toque(p, 2); await p.waitForTimeout(6000); const a = await estado(p);
    t('"mal": aos 6 s ainda sem aviso', !a.aviso && a.undo, a);
    await p.waitForTimeout(3000); const b2 = await estado(p);
    t('"mal": depois dos 8 s o aviso chega ao líder e o "Desfazer" some', b2.aviso && !b2.undo && !b2.pend && b2.h === 2, b2);
    await ctx.close(); }

  // 3) toque errado corrigido na janela: "muito mal" → "bem" = nenhum aviso; desfazer depois de 2 toques volta ao de antes do 1º
  { const { ctx, p } = await abre(); const antes = await estado(p);
    await toque(p, 1); await toque(p, 4); const a = await estado(p);
    t('trocar de carinha na janela: vale a última (bem)', a.h === 4 && a.c === 4 && a.undo, a);
    await p.waitForTimeout(8600); const b3 = await estado(p);
    t('"muito mal" corrigido para "bem" antes dos 8 s: nenhum aviso', !b3.aviso && !b3.pend, b3);
    await toque(p, 1); await toque(p, 2); await p.click('[data-act="humor-desfazer"]'); await p.waitForTimeout(500); const c = await estado(p);
    t('2 toques e desfazer: volta ao que era antes do 1º toque da janela (bem)', c.h === 4 && c.c === 4 && !c.pend, c);
    await p.waitForTimeout(8600); t('…e o aviso não sai', !(await estado(p)).aviso, '');
    void antes; await ctx.close(); }

  // 4) aba escondida/fechada antes dos 8 s: o aviso sai na hora (não se perde)
  { const { ctx, p } = await abre(); await toque(p, 1);
    await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); }); await p.waitForTimeout(400);
    const a = await estado(p); t('aba escondida antes dos 8 s: o aviso sai na hora', a.aviso && !a.pend, a);
    await ctx.close(); }

  // 5) "bem" não gera aviso nunca (regra de antes continua)
  { const { ctx, p } = await abre(); await toque(p, 5); await p.waitForTimeout(8600); const a = await estado(p);
    t('"muito bem": sem aviso depois dos 8 s', !a.aviso && a.h === 5, a); await ctx.close(); }

  await b.close(); console.log(`\n${total - falhas}/${total} ok`); process.exit(falhas ? 1 : 0);
})();
