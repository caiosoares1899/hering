// 🐚 /monitorarbugs na Concha (25/11/2026). Três achados, cada um reproduzido pela tela real (Firebase falso):
//  A. "Criar canal" sem trava: o id leva sufixo novo a cada chamada — duplo clique com o banco lento criava 2 canais temáticos.
//  B. emoji do seletor 😀 não entrava no rascunho do canal (só o evento input grava): recarregar perdia o que foi escrito com ele.
//  C. tirada do canal aberto, a pessoa seguia escutando as mensagens dele (a escuta só era trocada, nunca solta).
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_monitorarbugs_1125.js
// Contra a versão da main (deve falhar em A, B e C): git show main:cardume-dev.html > /tmp/x.html; PAGINA_HTML=/tmp/x.html node …
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const base = process.env.BASE_URL || 'http://127.0.0.1:8941', PAGE = process.env.PAGE || 'cardume-dev.html';
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const pub = (uid, nome, init) => ({ uid, nome, init, email: uid + '@ciahering.com.br', squads: { dados: true } });
const agora = Date.now();
const seed = () => ({ kanban: {
  usuarios: { ana: { role: 'membro', squads: { dados: true } }, bru: { role: 'membro', squads: { dados: true } } },
  usuarios_publicos: { ana: pub('ana', 'Ana Lima', 'AL'), bru: pub('bru', 'Bruno Reis', 'BR') },
  cardume: {
    canais: { dados: { nome: 'Dados' }, prf: { nome: 'Performance' } }, membros: { dados: { ana: true, bru: true }, prf: { ana: true, bru: true } }, meus: { ana: { dados: true, prf: true } },
    msgs: { dados: { '-Nm1': { uid: 'bru', ts: agora - 60000, texto: 'oi' } }, prf: { '-Np1': { uid: 'bru', ts: agora - 60000, texto: 'bom dia' } } },
  },
} });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 400))); };

(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(chromeRoot) ? path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed());
  await ctx.addInitScript(() => { window.__limitarConsultas = true; localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); });
  if (process.env.PAGINA_HTML) { const html = fs.readFileSync(process.env.PAGINA_HTML, 'utf8'); await ctx.route(u => new URL(u).pathname.endsWith('/' + PAGE), r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html })); }
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/' + PAGE + '?c=dados'); await p.waitForFunction(() => !!window.__authCb);
  await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(900);
  const S = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__store.kanban)));
  const externo = mapa => p.evaluate(m => { window.__onDisc = m; window.__simDisconnect(); }, mapa);   // gravação de outra pessoa (dispara as escutas)

  // A. duplo clique em "Criar canal" com o banco lento (300 ms)
  await p.evaluate(() => { window.__setDelay = () => 300; });
  await p.click('#b-novo'); await p.fill('.md input:not([type])', 'Black Friday');
  await p.evaluate(() => { const b = document.querySelector('.md button[type="submit"]'); b.click(); b.click(); });
  await p.waitForTimeout(900); await p.evaluate(() => { window.__setDelay = null; });
  const temas = Object.keys((await S()).cardume.canais || {}).filter(k => k.startsWith('t-'));
  t('A. duplo clique em "Criar canal" cria UM canal só', temas.length === 1, temas);

  // B. emoji do seletor entra no rascunho do canal
  await p.click('[data-canal="dados"]'); await p.waitForTimeout(300);
  await p.fill('#entrada', 'Bora '); await p.click('#b-emoji'); await p.click('#emojis button[aria-label="festa"]'); await p.waitForTimeout(100);
  const rasc = await p.evaluate(() => localStorage.getItem('cardume_rascunho_ana_dados'));
  t('B. emoji escolhido no 😀 fica no rascunho (recarregar não perde)', rasc === 'Bora 🎉', rasc);

  // C. tirada do canal aberto: não segue recebendo as mensagens dele
  await p.click('[data-canal="prf"]'); await p.waitForTimeout(300);
  t('C0. (pré-condição) canal Performance aberto com 1 mensagem', (await p.evaluate(() => window.__cardume.estado)).msgs === 1, await p.evaluate(() => window.__cardume.estado));
  await externo({ 'kanban/cardume/membros/prf/ana': 'remove', 'kanban/cardume/meus/ana/prf': 'remove' }); await p.waitForTimeout(300);
  await externo({ 'kanban/cardume/msgs/prf/-Np2': ['set', { uid: 'bru', ts: Date.now(), texto: 'segredo depois que a Ana saiu' }] }); await p.waitForTimeout(300);
  const est = await p.evaluate(() => window.__cardume.estado);
  t('C. tirada do canal, a mensagem nova não chega para ela', est.msgs === 0 && !(await p.evaluate(() => document.body.innerText.includes('segredo'))), est);
  t('C2. a tela diz que ela não está mais no canal', await p.evaluate(() => /Você não está neste canal/.test(document.getElementById('log').innerText)), await p.evaluate(() => document.getElementById('log').innerText));

  t('sem erro de página', !errs.length, errs);
  await b.close();
  console.log(`\n${ok ? '✅' : '❌'} ${total} verificações`); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
