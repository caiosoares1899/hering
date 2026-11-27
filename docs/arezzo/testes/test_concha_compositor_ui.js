// Boot real da Concha com Firebase simulado. BASE_URL aponta para o servidor local.
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
  const abrir = async (opts, tema, quantidade) => {
    const ctx = await b.newContext(Object.assign({ viewport: { width: 1280, height: 860 } }, opts)); const dados = seed();
    const canal = dados.kanban.cardume;
    if (quantidade === 0) canal.msgs.dados = {};
    if (quantidade === 60) for (let i = 0; i < 56; i++) {
      canal.msgs.dados['extra' + i] = { uid: 'car', ts: agora - 50000 + i,
        texto: 'Acompanhamento 🚀 <b>literal</b> ' + 'Texto longo para a conversa. '.repeat(9) };
    }
    await fake.install(ctx, dados);
    await ctx.addInitScript(t => localStorage.setItem('concha_tema', t), tema);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/cardume-dev.html?c=dados'); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(x => window.__authCb(x), ANA); await p.waitForTimeout(900);
    return { ctx, p, errs };
  };


  try {
    for (const [tema, atributo] of [['abrolhos', null], ['lencois', 'light'], ['vice', 'vice']]) {
      for (const largura of [1280, 390]) {
        for (const quantidade of [0, 4, 60]) {
          const toque = largura === 390;
          const { ctx, p, errs } = await abrir({ viewport: { width: largura, height: toque ? 800 : 900 }, hasTouch: toque, reducedMotion: 'reduce' }, tema, quantidade);
          const medidas = await p.evaluate(() => {
            const botoes = [...document.querySelectorAll('.barra-fmt button:not([hidden]), #b-enviar')];
            const caixas = botoes.map(b => b.getBoundingClientRect());
            return {
              tema: document.documentElement.getAttribute('data-theme'),
              semRolagem: document.documentElement.scrollWidth <= innerWidth,
              altura: Math.min(...caixas.map(c => c.height)),
              largura: Math.min(...caixas.map(c => c.width)),
              cabe: caixas.every(c => c.left >= 0 && c.right <= innerWidth),
              campo: parseFloat(getComputedStyle(document.querySelector('#entrada')).fontSize),
              literal: document.querySelector('#log').textContent.includes('<b>literal</b>'),
              injecao: [...document.querySelectorAll('#log b')].some(b => b.textContent === 'literal'),
            };
          });
          t(tema + ' ' + largura + ' px, ' + quantidade + ' mensagens', medidas.tema === atributo &&
            medidas.semRolagem && medidas.cabe && medidas.campo >= 16 && !errs.length &&
            (!toque || medidas.altura >= 44 && medidas.largura >= 44) &&
            (quantidade !== 60 || medidas.literal && !medidas.injecao), { medidas, errs });
          if (process.env.CAPTURAS && quantidade === 60) {
            await p.screenshot({ path: path.join(process.env.CAPTURAS, tema + '-' + largura + '.png') });
          }
          await ctx.close();
        }
      }
    }
  } finally {
    await b.close();
  }
  console.log((ok ? '✅ ' : '❌ ') + total + ' cenários');
  process.exitCode = ok ? 0 : 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
