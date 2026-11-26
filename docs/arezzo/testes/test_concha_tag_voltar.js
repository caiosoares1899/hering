// 🐚 Concha — ← Voltar da tela da #tag (26/11/2026, achado do Caio: clicar numa #tag não tinha volta). O botão leva de volta ao canal,
// no assunto e na mensagem de onde a pessoa clicou (destacada).
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_tag_voltar.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const ag = Date.now();
const msgs = {}; for (let i = 0; i < 20; i++) msgs['n' + String(i).padStart(2, '0')] = { uid: 'ana', ts: ag - 9e5 + i * 1000, texto: i === 3 ? 'proposta do #banner' : 'mensagem ' + i };
msgs.s1 = { uid: 'ana', ts: ag - 1e5, texto: 'no assunto, sobre o #banner', a: 'a1' };
const seed = () => ({ kanban: { usuarios: { ana: { role: 'membro', squads: { dados: true } } }, usuarios_publicos: { ana: { nome: 'Ana Lima', email: 'ana@ciahering.com.br' } },
  cardume: { canais: { dados: { nome: 'Dados' } }, membros: { dados: { ana: true } }, meus: { ana: { dados: true } }, msgs: { dados: msgs },
    assuntos: { dados: { a1: { n: 'Campanha', por: 'ana', ts: ag - 2e5 } } },
    tags: { dados: { banner: { n03: msgs.n03.ts, s1: msgs.s1.ts } } }, tags_ult: { dados: { banner: ag } } } } });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 400))); };
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const cr = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(cr) ? path.join(cr, fs.readdirSync(cr).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  for (const [w, h] of [[1280, 860], [390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } }); await fake.install(ctx, seed());
    await ctx.addInitScript(() => { localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(1000);
    await p.click('[data-msg="n03"] button.tag'); await p.waitForTimeout(500);
    const bv = await p.evaluate(() => { const x = document.querySelector('#log .voltar-tag'); return x && x.textContent; });
    t(w + ' px: na tela da #banner aparece "← Voltar para # Dados"', bv === '← Voltar para # Dados', bv);
    await p.click('#log .voltar-tag'); await p.waitForTimeout(600);
    const st = await p.evaluate(() => ({ titulo: document.getElementById('canal-titulo').textContent, tela: document.getElementById('app').dataset.tela, alvo: !!document.querySelector('[data-msg="n03"].destaque') }));
    t(w + ' px: Voltar abre Dados na conversa, com a mensagem de onde saiu destacada', /Dados/.test(st.titulo) && st.tela === 'conversa' && st.alvo, st);
    // dentro de um assunto: volta para o mesmo assunto
    await p.click('#assuntos-barra button[data-aid="a1"]'); await p.waitForTimeout(600);
    await p.click('[data-msg="s1"] button.tag'); await p.waitForTimeout(500);
    await p.click('#log .voltar-tag'); await p.waitForTimeout(700);
    const sa = await p.evaluate(() => ({ a: new URL(location.href).searchParams.get('a'), alvo: !!document.querySelector('[data-msg="s1"].destaque') }));
    t(w + ' px: de dentro de um assunto, volta para o mesmo assunto e mensagem', sa.a === 'a1' && sa.alvo, sa);
    t(w + ' px: sem erro de JS', !errs.length, errs);
    await ctx.close();
  }
  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
