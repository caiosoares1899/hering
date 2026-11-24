// 🐚 Concha — rodada /melhoriauiux "vidro e mar" (24/11/2026): mar com os peixes do Oceano (na preferência 🐟 de lá), vidro translúcido,
// ações da mensagem numa pílula flutuante alcançável pelo teclado e, no celular, só na mensagem tocada. 3 temas × 1280/390, sem rolagem lateral.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_ui.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const pub = (uid, nome, init) => ({ uid, nome, init, email: uid + '@ciahering.com.br', squads: { dados: true } });
const agora = Date.now();
const seed = () => {
  const msgs = {};
  [['bru', 'Bom dia, time! Alguém conseguiu olhar o painel de vendas da Black Friday?'], ['car', 'Mas o tempo de carregamento do checkout ficou em **4,2 s** no pico — precisamos ver isso com calma antes de sexta'], ['ana', 'Vou abrir um card pra isso. @Bruno Reis você consegue puxar os logs?'], ['bru', 'Consigo sim <b>até</b> o fim da tarde 🚀']]
    .forEach(([u, t], i) => { msgs['-Nx' + i] = { uid: u, ts: agora - (60 - i * 12) * 60000, texto: t }; });
  return { kanban: {
    usuarios: { ana: { role: 'membro', squads: { dados: true } } },
    usuarios_publicos: { ana: pub('ana', 'Ana Lima', 'AL'), bru: pub('bru', 'Bruno Reis', 'BR'), car: pub('car', 'Carla Dias de Albuquerque Monteiro Siqueira', 'CD') },
    cardume: { canais: { dados: { nome: 'Dados' }, prf: { nome: 'Performance e Conversão do E-commerce Hering' } }, membros: { dados: { ana: true, bru: true, car: true }, prf: { ana: true } }, meus: { ana: { dados: true, prf: true } }, msgs: { dados: msgs }, ultima: { dados: { ts: agora - 20 * 60000, uid: 'bru', id: '-Nx3' } } },
  } };
};
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 400))); };

(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(chromeRoot) ? path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const abrir = async (opts, prefs, extra) => {
    const ctx = await b.newContext(Object.assign({ viewport: { width: 1280, height: 860 } }, opts)); await fake.install(ctx, seed());
    await ctx.addInitScript(pr => { if (pr) localStorage.setItem('oceano_prefs', JSON.stringify(pr)); }, prefs || null);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    if (extra) await extra(p);
    await p.goto(base + '/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(900);
    return { ctx, p, errs };
  };
  const peixes = p => p.evaluate(() => [document.querySelectorAll('#fwrap > div').length, document.querySelectorAll('#bwrap > .bubble').length]);

  // ── 3 temas × 2 tamanhos ──
  for (const tema of ['abrolhos', 'lencois', 'entardecer']) for (const [w, h] of [[1280, 860], [390, 800]]) {
    const { ctx, p, errs } = await abrir({ viewport: { width: w, height: h } }, { tema, peixes: 'normal' });
    const r = await p.evaluate(() => {
      const cs = getComputedStyle(document.querySelector('.conversa')).backgroundColor, a = +(cs.match(/[\d.]+\)$/) || ['1'])[0].replace(')', '');
      return { lateral: document.documentElement.scrollWidth > innerWidth, alfa: a, blur: getComputedStyle(document.getElementById('app')).backdropFilter, bodyBg: getComputedStyle(document.body).backgroundImage };
    });
    t(`${tema} ${w}px: sem rolagem lateral e sem erro de JS`, !r.lateral && !errs.length, { r, errs });
    t(`${tema} ${w}px: a conversa é vidro (translúcida, o mar aparece) e o .app desfoca`, r.alfa < .5 && /blur/.test(r.blur) && r.bodyBg === 'none', r);
    const [nf, nb] = await peixes(p);
    t(`${tema} ${w}px: peixes e bolhas como no Oceano (${w < 769 ? '4 e 8' : '8 e 16'})`, w < 769 ? nf === 4 && nb === 8 : nf === 8 && nb === 16, [nf, nb]);
    await ctx.close();
  }

  // ── preferência 🐟 do Oceano e "reduzir movimento" ──
  { const { ctx, p } = await abrir({}, { peixes: 'poucos' }); const [nf, nb] = await peixes(p); t('🐟 "Poucos" no Oceano: metade (4 e 8)', nf === 4 && nb === 8, [nf, nb]); await ctx.close(); }
  { const { ctx, p } = await abrir({}, { peixes: 'off' }); const [nf, nb] = await peixes(p); t('🐟 "Desligados" no Oceano: mar calmo (nenhum)', nf === 0 && nb === 0, [nf, nb]); await ctx.close(); }
  { const { ctx, p } = await abrir({ reducedMotion: 'reduce' }); const [nf] = await peixes(p); t('"Reduzir movimento" sem preferência salva: começa sem peixes', nf === 0, nf); await ctx.close(); }
  { const { ctx, p } = await abrir({}, { peixes: 'normal' });
    const r = await p.evaluate(() => { const f = document.querySelector('#fwrap > div'); const cs = getComputedStyle(document.getElementById('fwrap')); return { pe: cs.pointerEvents, z: +cs.zIndex, alvo: document.elementFromPoint(640, 400).closest('#fwrap,#bwrap') }; });
    t('peixes atrás do conteúdo e sem comer clique', r.pe === 'none' && r.z < 0 && !r.alvo, r);
    await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); }); await p.waitForTimeout(50);
    t('aba escondida: o cardume pausa (data-anim-paused)', await p.evaluate(() => document.documentElement.hasAttribute('data-anim-paused')), 0);
    await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
    // ── computador: pílula de ações ──
    const op = () => p.evaluate(() => getComputedStyle(document.querySelector('[data-msg="-Nx1"] .acoes-msg')).opacity);
    t('em repouso, as ações da mensagem ficam escondidas', await op() === '0', await op());
    await p.hover('[data-msg="-Nx1"]'); await p.waitForTimeout(250);
    t('ao passar o mouse, aparecem numa pílula flutuante', await op() === '1', await op());
    await p.mouse.move(5, 5); await p.waitForTimeout(250);
    await p.evaluate(() => document.querySelector('[data-msg="-Nx1"] .acoes-msg button').focus()); await p.waitForTimeout(250);
    t('pelo teclado (Tab) as ações são alcançáveis e aparecem (antes ficavam em display:none)', await op() === '1' && await p.evaluate(() => document.activeElement.closest('.acoes-msg') !== null), await op());
    t('HTML no texto aparece como texto', /<b>até<\/b>/.test(await p.textContent('[data-msg="-Nx3"] .texto')), await p.textContent('[data-msg="-Nx3"] .texto'));
    await ctx.close(); }

  // ── celular (toque): ações só na mensagem tocada ──
  { const { ctx, p, errs } = await abrir({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true }, { peixes: 'off' });
    const vis = id => p.evaluate(i => getComputedStyle(document.querySelector('[data-msg="' + i + '"] .acoes-msg')).display !== 'none', id);
    t('celular: nenhuma mensagem mostra as ações em repouso (antes: 4 botões em cada uma)', !(await vis('-Nx0')) && !(await vis('-Nx1')) && !(await vis('-Nx2')), 0);
    await p.tap('[data-msg="-Nx1"] .texto'); await p.waitForTimeout(120);
    t('tocar numa mensagem mostra as ações dela, e só dela', await vis('-Nx1') && !(await vis('-Nx0')), 0);
    const alt = await p.evaluate(() => [...document.querySelectorAll('[data-msg="-Nx1"] .acoes-msg button')].map(x => x.getBoundingClientRect().height));
    t('alvos de toque das ações ≥ 44 px', alt.length && alt.every(h => h >= 44), alt);
    await p.tap('[data-msg="-Nx2"] .texto'); await p.waitForTimeout(120);
    t('tocar em outra troca a mensagem com ações', await vis('-Nx2') && !(await vis('-Nx1')), 0);
    await p.tap('[data-msg="-Nx2"] .texto'); await p.waitForTimeout(120);
    t('tocar de novo esconde', !(await vis('-Nx2')), 0);
    await p.tap('[data-msg="-Nx0"] .texto'); await p.waitForTimeout(120);
    await p.tap('[data-msg="-Nx0"] >> text=↩️ Responder'); await p.waitForTimeout(150);
    t('…e o ↩️ Responder funciona pelo toque', await p.isVisible('#resp-barra') && /Bruno Reis/.test(await p.textContent('#resp-barra')), 0);
    t('ajuda do campo fala de toque, não de Enter/Shift', await p.isVisible('.so-toque') && !(await p.isVisible('.so-teclado')), 0);
    t('celular sem rolagem lateral nem erro de JS', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)) && !errs.length, errs);
    await ctx.close(); }

  await b.close();
  console.log(ok ? `TUDO OK (${total} verificações)` : 'FALHOU');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
