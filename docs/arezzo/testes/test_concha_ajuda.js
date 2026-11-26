// 🐚 Concha — ❓ Ajuda (25/11/2026): botão no topo, 13 tópicos desenhados pelo renderTexto (sem innerHTML), busca sem acento, "?" da barra abre
// o tópico de escrever, Sonar com a aba Ajuda; os exemplos de @ e # não viram menção nem etiqueta. Só leitura.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_ajuda.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const seed = () => ({ kanban: { usuarios: { ana: { role: 'membro' } }, usuarios_publicos: { ana: { nome: 'Ana Lima', email: 'ana@ciahering.com.br' } },
  cardume: { canais: { dados: { nome: 'Dados' } }, membros: { dados: { ana: true } }, meus: { ana: { dados: true } }, msgs: { dados: {} } } } });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 400))); };
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(chromeRoot) ? path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed());
  await ctx.addInitScript(() => { window.__limitarConsultas = true; localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb);
  await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(900);
  const n0 = await p.evaluate(() => (window.__escritas || []).length);
  t('❓ no topo depois do login', await p.evaluate(() => !document.getElementById('b-ajuda').hidden), 0);
  // computador (1280): índice + leitura
  await p.click('#b-ajuda'); await p.waitForTimeout(150);
  const tops = await p.evaluate(() => [...document.querySelectorAll('.ajuda-indice button')].map(b => b.textContent));
  t('tela larga: índice com 18 tópicos, de "O que é" a "Atalhos", e o 1º aberto à direita', tops.length === 18 && /O que é a Concha/.test(tops[0]) && /Atalhos/.test(tops[17]) && await p.evaluate(() => document.querySelector('.ajuda-artigo').dataset.id === 'concha'), tops);
  t('a janela usa a tela (≥ 1000 px de largura em 1280)', await p.evaluate(() => document.querySelector('.ajuda-md').getBoundingClientRect().width >= 1000), await p.evaluate(() => document.querySelector('.ajuda-md').getBoundingClientRect().width));
  t('foco na busca ao abrir', await p.evaluate(() => document.activeElement.type === 'search'), 0);
  await p.click('.ajuda-indice [data-id="tags"]'); await p.waitForTimeout(100);
  t('o texto vem formatado (negrito, lista) e os exemplos de # e @ NÃO viram etiqueta nem menção', await p.evaluate(() => { const l = document.querySelector('.ajuda-artigo'); return !!l.querySelector('strong') && !!l.querySelector('li') && !l.querySelector('button.tag') && !l.querySelector('.mencao') && /#banner/.test(l.textContent) && /As #tags aparecem/.test(l.textContent); }), 0);
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(100);
  t('↓ no índice passa para o próximo tópico', await p.evaluate(() => document.querySelector('.ajuda-artigo').dataset.id === 'assuntos'), await p.evaluate(() => document.querySelector('.ajuda-artigo').dataset.id));
  await p.fill('.ajuda-md input[type=search]', 'silenci'); await p.waitForTimeout(100);
  const vis = await p.evaluate(() => [...document.querySelectorAll('.ajuda-indice button')].filter(b => !b.hidden).map(b => b.dataset.id));
  t('busca "silenci" filtra o índice e abre o primeiro', vis.includes('avisos') && vis.includes('tags') && !vis.includes('card') && await p.evaluate(v => document.querySelector('.ajuda-artigo').dataset.id === v[0], vis), vis);
  await p.fill('.ajuda-md input[type=search]', 'promocao'); await p.waitForTimeout(100);
  t('sem acento: "promocao" acha o tópico de busca', await p.evaluate(() => !document.querySelector('.ajuda-indice [data-id="busca"]').hidden), 0);
  await p.fill('.ajuda-md input[type=search]', 'xyzqw'); await p.waitForTimeout(100);
  t('sem resultado: avisa', await p.evaluate(() => !document.querySelector('.ajuda-md > p.subtitulo').hidden), 0);
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  t('Esc fecha', await p.evaluate(() => document.getElementById('ov').hidden), 0);
  await p.click('#b-fmt-ajuda'); await p.click('#b-fmt-ajuda-tudo'); await p.waitForTimeout(200);
  t('"?" da barra › "Ver a Ajuda completa" abre no tópico de escrever', await p.evaluate(() => document.querySelector('.ajuda-artigo').dataset.id === 'escrever'), 0);
  await p.keyboard.press('Escape');
  await p.keyboard.press('Control+k'); await p.waitForTimeout(300); await p.fill('#msn-in', 'a: assunto'); await p.waitForTimeout(450);
  const so = await p.evaluate(() => [...document.querySelectorAll('#msn-lista [data-i]')].map(e => e.textContent));
  t('Sonar, aba Ajuda ("a: assunto"): acha "Assuntos dentro do canal"', so.some(x => /Assuntos dentro do canal/.test(x)), so);
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  t('Enter abre a Ajuda no tópico', await p.evaluate(() => (document.querySelector('.ajuda-artigo') || {}).dataset?.id === 'assuntos'), 0);
  await p.keyboard.press('Escape');
  // celular (390): sanfona
  await p.setViewportSize({ width: 390, height: 780 }); await p.waitForTimeout(200);
  await p.click('#b-ajuda'); await p.waitForTimeout(150);
  t('celular: sanfona com 18 tópicos', await p.evaluate(() => document.querySelectorAll('.ajuda-lista details').length === 18 && !document.querySelector('.ajuda-indice')), 0);
  await p.fill('.ajuda-md input[type=search]', 'silenci'); await p.waitForTimeout(100);
  t('celular: a busca filtra e abre', await p.evaluate(() => document.getElementById('ajuda-avisos').open && document.getElementById('ajuda-card').hidden), 0);
  await p.keyboard.press('Escape');
  t('a Ajuda não grava nada', (await p.evaluate(() => (window.__escritas || []).length)) === n0, 0);
  t('sem erro de JS', !errs.length, errs);
  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
