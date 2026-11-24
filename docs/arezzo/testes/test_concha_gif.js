// 🐚 Concha — GIF (KLIPY pela função conchaGifBusca). Desenho: docs/ideias/cardume-v0-banco.md › "GIF na Concha".
// A função e as imagens da KLIPY são simuladas (page.route): nada sai para a rede. Cada escrita da página é conferida nas regras reais.
// Rodar na raiz: python3 -m http.server 8941  →  node docs/arezzo/testes/test_concha_gif.js   (SHOT=1 grava capturas em docs/capturas/concha-gif/)
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const { update: regras } = require('../../../functions/rules/rulesSim.js');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../database.rules.json'), 'utf8'));
const base = process.env.BASE_URL || 'http://127.0.0.1:8941';
const ANA = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Lima', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const agora = Date.now();
const K = n => `https://static.klipy.com/ii/abc/${n}`;
const pub = (uid, nome, init) => ({ uid, nome, init, email: uid + '@ciahering.com.br', squads: { dados: true, prf: true } });
const seed = () => ({ kanban: {
  usuarios: { ana: { role: 'membro', squads: { dados: true, prf: true } }, bru: { role: 'membro', squads: { dados: true } } },
  usuarios_publicos: { ana: pub('ana', 'Ana Lima', 'AL'), bru: pub('bru', 'Bruno Reis', 'BR') },
  cardume: {
    canais: { dados: { nome: 'Dados' }, prf: { nome: 'Performance' } },
    membros: { dados: { ana: true, bru: true }, prf: { ana: true } }, meus: { ana: { dados: true, prf: true } },
    msgs: { dados: {
      '-Nm1': { uid: 'bru', ts: agora - 5 * 60000, gif: { u: K('bom.webp'), s: K('bom.jpg'), w: 220, h: 124, t: 'Bom dia' } },
      '-Nm2': { uid: 'bru', ts: agora - 4 * 60000, texto: 'esse veio de fora', gif: { u: 'https://evil.example/x.gif', w: 10, h: 10 } },
      '-Nm3': { uid: 'bru', ts: agora - 3 * 60000, gif: { u: 'javascript:alert(1)', w: 10, h: 10 } },
    } },
    ultima: { dados: { ts: agora - 3 * 60000, uid: 'bru', id: '-Nm3' } },
  },
} });
const itensFake = q => ({ itens: [
  { id: '1', t: 'Oi ' + q, u: K('oi.webp'), p: K('oi-p.webp'), s: K('oi.jpg'), w: 220, h: 124 },
  { id: '2', t: 'Tchau', u: K('tchau.webp'), p: K('tchau-p.webp'), w: 200, h: 200 },
  { id: '3', t: 'Mal', u: 'https://evil.example/mal.gif', p: 'https://evil.example/mal-p.gif', w: 200, h: 200 },   // servidor comprometido: a página descarta
], temMais: false });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 600))); };
const authDe = u => ({ uid: u.uid, token: { email: u.email, firebase: { sign_in_provider: 'google.com' } } });
function conferirEscritas(escritas, quem) {
  const real = Date.now; const ruins = [];
  for (const e of escritas) {
    const mapa = e.tipo === 'set' ? { [e.p]: e.v } : Object.fromEntries(Object.entries(e.v).map(([k, v]) => [(e.p ? e.p + '/' : '') + k, v]));
    Date.now = () => e.t;
    let r; try { r = regras(RULES, e.antes, authDe(quem), mapa); } finally { Date.now = real; }
    if (!r) ruins.push({ tipo: e.tipo, caminhos: Object.keys(mapa) });
  }
  return ruins;
}
const PNG = Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');

(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const chromeRoot = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(chromeRoot) ? path.join(chromeRoot, fs.readdirSync(chromeRoot).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const shots = process.env.SHOT ? path.join(__dirname, '../../capturas/concha-gif') : null; if (shots) fs.mkdirSync(shots, { recursive: true });
  const pedidos = [], foraDaLista = []; let modo = 'ok';
  async function abrir(opts) {
    const ctx = await b.newContext(Object.assign({ viewport: { width: 1280, height: 860 } }, opts || {})); await fake.install(ctx, seed());
    await ctx.route('https://us-central1-hering-onboarding.cloudfunctions.net/conchaGifBusca**', async r => {
      const u = new URL(r.request().url()); pedidos.push({ q: u.searchParams.get('q'), auth: r.request().headers()['authorization'] || '' });
      if (modo === 'limite') return r.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ erro: 'limite_pessoa' }) });
      if (modo === 'fora') return r.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ erro: 'klipy_falhou' }) });
      if (modo === 'lento') await new Promise(x => setTimeout(x, 900));
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(itensFake(u.searchParams.get('q'))) });
    });
    await ctx.route(/^https:\/\/static[12]?\.klipy\.com\//, r => r.fulfill({ status: 200, contentType: 'image/gif', body: PNG }));
    await ctx.route('https://evil.example/**', r => { foraDaLista.push(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/gif', body: PNG }); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(800);
    return { ctx, p, errs };
  }
  const { ctx, p, errs } = await abrir();
  const store = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__store)));

  // ── mensagens com GIF já gravadas ──
  t('GIF gravado aparece como imagem, com alt', await p.evaluate(u => { const i = document.querySelector('[data-msg="-Nm1"] .msg-gif img'); return !!i && i.src === u && i.alt === 'GIF: Bom dia'; }, K('bom.webp')), 0);
  t('GIF de host de fora (ou javascript:) não vira imagem; a legenda continua', await p.evaluate(() => !document.querySelector('[data-msg="-Nm2"] img') && !document.querySelector('[data-msg="-Nm3"] img') && /esse veio de fora/.test(document.querySelector('[data-msg="-Nm2"]').textContent)), 0);
  t('nenhuma imagem de fora foi pedida ao navegador', !foraDaLista.length, foraDaLista);

  // ── o painel ──
  await p.click('#b-gif'); await p.waitForTimeout(400);
  t('botão GIF abre o painel com "Search KLIPY" e a atribuição', await p.isVisible('#gifs') && (await p.getAttribute('#gifs input', 'placeholder')) === 'Search KLIPY' && /Powered by KLIPY/.test(await p.textContent('#gifs')) && /fora da Hering/.test(await p.textContent('#gifs')), 0);
  t('abre com os GIFs em alta, pedindo com o token da pessoa', pedidos.length === 1 && pedidos[0].q === '' && pedidos[0].auth === 'Bearer fake-id-token-ana', pedidos);
  const ops = await p.$$eval('#gifs .gif-op img', xs => xs.map(x => x.src));
  t('a página descarta item de host de fora mesmo vindo da função', ops.length === 2 && ops.every(s => /^https:\/\/static\.klipy\.com\//.test(s)), ops);
  await p.fill('#gifs input', 'o'); await p.waitForTimeout(500);
  t('1 letra não busca', pedidos.length === 1 && /2 letras/.test(await p.textContent('.gif-estado')), pedidos.map(x => x.q));
  await p.fill('#gifs input', 'Oi'); await p.waitForTimeout(600);
  t('busca depois de digitar (minúsculas)', pedidos.length === 2 && pedidos[1].q === 'oi', pedidos.map(x => x.q));
  await p.fill('#gifs input', 'tchau'); await p.waitForTimeout(80); await p.fill('#gifs input', 'Oi'); await p.waitForTimeout(600);
  t('busca repetida vem do cache da sessão', pedidos.length === 2, pedidos.map(x => x.q));
  await p.fill('#gifs input', 'x'); await p.waitForTimeout(80);
  t('mudou a busca: a grade antiga some na hora (não fica clicável)', (await p.$$('#gifs .gif-op')).length === 0, 0);
  await p.waitForTimeout(500);
  t('…e com 1 letra continua vazia', (await p.$$('#gifs .gif-op')).length === 0 && /2 letras/.test(await p.textContent('.gif-estado')), 0);
  await p.fill('#gifs input', 'Oi'); await p.waitForTimeout(600);
  if (shots) await p.screenshot({ path: path.join(shots, 'painel-1280.png') });

  // ── escolher e enviar sem legenda ──
  await p.click('#gifs .gif-op'); await p.waitForTimeout(150);
  t('escolher: o painel fecha e o GIF aparece no compositor com ✕', await p.isHidden('#gifs') && await p.isVisible('#gif-escolhido img'), 0);
  await p.click('#b-enviar'); await p.waitForTimeout(300);
  let s = await store();
  const novas = Object.entries(s.kanban.cardume.msgs.dados).filter(([k]) => !/^-Nm/.test(k)).map(([k, v]) => Object.assign({ k }, v));
  const g1 = novas.find(m => m.gif && !m.texto);
  t('enviar só com GIF grava {uid, ts, gif} (sem texto) + marcador', !!g1 && g1.gif.u === K('oi.webp') && g1.gif.s === K('oi.jpg') && g1.gif.t === 'Oi oi' && s.kanban.cardume.ultima.dados.id === g1.k, novas);
  t('depois de enviar, o compositor limpa o GIF', await p.isHidden('#gif-escolhido'), 0);
  t('mensagem só de GIF não tem ✏️ Editar', await p.evaluate(k => { const m = document.querySelector('[data-msg="' + k + '"]'); return !!m && !/Editar/.test(m.textContent) && /Apagar/.test(m.textContent); }, g1 && g1.k), 0);

  // ── com legenda e @menção ──
  await p.click('#b-gif'); await p.waitForTimeout(300); await p.click('#gifs .gif-op >> nth=1'); await p.waitForTimeout(100);
  await p.fill('#entrada', 'olha isso @Bruno Reis'); await p.click('#b-enviar'); await p.waitForTimeout(300);
  s = await store();
  const g2 = Object.entries(s.kanban.cardume.msgs.dados).map(([k, v]) => Object.assign({ k }, v)).find(m => m.texto === 'olha isso @Bruno Reis');
  t('GIF com legenda grava texto + gif', !!g2 && g2.gif && g2.gif.u === K('tchau.webp') && !('s' in g2.gif), g2);
  t('a @menção da legenda avisa a pessoa', !!Object.keys((s.kanban.cardume.mencoes || {}).bru || {}).length, s.kanban.cardume.mencoes);

  // ── Registrar no card e trecho ──
  await p.hover('[data-msg="-Nm1"]'); await p.click('[data-msg="-Nm1"] button[aria-label="Registrar no card do Maré"]'); await p.waitForTimeout(200);
  const prev = await p.textContent('.md.registrar .prev-reg');
  t('📝 Registrar no card lista a mensagem de GIF como [GIF: título]', /\*\*Bruno Reis\*\* \([^)]*\): \[GIF: Bom dia\]/.test(prev), prev);
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);

  // ── troca de canal no meio da busca ──
  modo = 'lento'; await p.click('#b-gif'); await p.waitForTimeout(100); await p.fill('#gifs input', 'demora'); await p.waitForTimeout(450);
  await p.click('[data-canal="prf"]'); await p.waitForTimeout(1200);
  t('trocar de canal fecha o painel e não mostra resultado atrasado', await p.isHidden('#gifs') && await p.isHidden('#gif-escolhido'), 0);
  await p.click('[data-canal="dados"]'); await p.waitForTimeout(300); modo = 'ok';
  await p.click('#b-gif'); await p.waitForTimeout(400); await p.click('#gifs .gif-op'); await p.waitForTimeout(100);
  await p.click('[data-canal="prf"]'); await p.waitForTimeout(300);
  t('GIF escolhido num canal não vai para o outro', await p.isHidden('#gif-escolhido'), 0);

  // ── erros ──
  modo = 'limite'; await p.click('#b-gif'); await p.waitForTimeout(100); await p.fill('#gifs input', 'nova busca'); await p.waitForTimeout(700);
  t('limite por pessoa: mensagem clara', /muitos GIFs nesta hora/.test(await p.textContent('.gif-estado')), await p.textContent('.gif-estado'));
  modo = 'fora'; await p.fill('#gifs input', 'outra busca'); await p.waitForTimeout(700);
  t('KLIPY fora do ar: "GIF indisponível agora" (resposta 502 klipy_falhou da função)', /indisponível agora/.test(await p.textContent('.gif-estado')) && pedidos[pedidos.length - 1].q === 'outra busca', await p.textContent('.gif-estado'));
  modo = 'ok'; await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  t('Esc fecha o painel', await p.isHidden('#gifs'), 0);

  const ruins = conferirEscritas(await p.evaluate(() => window.__escritas || []), ANA);
  t('CADA escrita da página passa nas regras reais do banco', !ruins.length, ruins);
  t('sem erro de JS', !errs.length, errs);
  await ctx.close();

  // ── movimento reduzido: quadro parado, anima ao clicar ──
  const R = await abrir({ reducedMotion: 'reduce' });
  const parado = await R.p.evaluate(() => { const bt = document.querySelector('[data-msg="-Nm1"] button.msg-gif'); const i = bt && bt.querySelector('img'); return i ? i.src : ''; });
  t('movimento reduzido: mostra o quadro parado (jpg) num botão', parado === K('bom.jpg'), parado);
  await R.p.click('[data-msg="-Nm1"] button.msg-gif'); await R.p.waitForTimeout(100);
  t('…e anima ao clicar', (await R.p.getAttribute('[data-msg="-Nm1"] .msg-gif img', 'src')) === K('bom.webp'), 0);
  const semS = await R.p.evaluate(async () => { const m = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js'); await m.set(m.ref({}, 'kanban/cardume/msgs/dados/-Nm4'), { uid: 'bru', ts: Date.now(), gif: { u: 'https://static.klipy.com/ii/abc/sem-s.webp', w: 200, h: 200, t: 'Sem quadro' } }); return true; });
  await R.p.waitForTimeout(300);
  const cartao = await R.p.evaluate(() => { const bt = document.querySelector('[data-msg="-Nm4"] button.msg-gif'); return bt ? { img: !!bt.querySelector('img'), txt: bt.textContent } : null; });
  t('movimento reduzido sem quadro parado: cartão "▶ GIF", sem carregar a animação', semS && cartao && !cartao.img && /▶ GIF: Sem quadro/.test(cartao.txt), cartao);
  await R.p.click('[data-msg="-Nm4"] button.msg-gif'); await R.p.waitForTimeout(100);
  t('…e o clique carrega a animação', (await R.p.getAttribute('[data-msg="-Nm4"] .msg-gif img', 'src')) === K('sem-s.webp'), 0);
  await R.p.click('#b-gif'); await R.p.waitForTimeout(400);
  const grade = await R.p.$$eval('#gifs .gif-op', bs => bs.map(b => { const i = b.querySelector('img'); return i ? i.src : 'cartão:' + b.textContent; }));
  t('movimento reduzido no painel: quadro parado (jpg) ou cartão, nunca a prévia animada', grade.length === 2 && grade[0] === K('oi.jpg') && /^cartão:▶ Tchau/.test(grade[1]), grade);
  await R.p.click('#gifs .gif-op >> nth=1'); await R.p.waitForTimeout(100);
  t('movimento reduzido no compositor: sem animação', !(await R.p.$('#gif-escolhido img')) && /▶ GIF: Tchau/.test(await R.p.textContent('#gif-escolhido')), await R.p.textContent('#gif-escolhido'));
  await R.ctx.close();

  // ── celular ──
  const C = await abrir({ viewport: { width: 390, height: 800 } });
  await C.p.click('[data-canal="dados"]').catch(() => {}); await C.p.waitForTimeout(300);
  await C.p.click('#b-gif'); await C.p.waitForTimeout(400);
  const caixa = await C.p.evaluate(() => { const r = document.getElementById('gifs').getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth, sobra: document.documentElement.scrollWidth - innerWidth }; });
  t('celular: o painel cabe na tela, sem rolagem lateral', caixa.l >= 0 && caixa.r <= caixa.w && caixa.sobra <= 0, caixa);
  if (shots) await C.p.screenshot({ path: path.join(shots, 'painel-390.png') });
  t('sem erro de JS (celular e movimento reduzido)', !C.errs.length && !R.errs.length, C.errs.concat(R.errs));
  await b.close();
  console.log(ok ? `TUDO OK (${total} verificações)` : 'FALHOU');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
