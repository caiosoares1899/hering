// Contact sheet das transições da Apresentação do Radar (controle de qualidade de movimento, GUIA_UI_UX §2.4).
// Para cada slide, navega e "busca" instantes fixos da entrada: pausa todas as animações CSS e põe currentTime = t
// (a ideia do seek(t): o quadro de 120 ms é sempre o mesmo, sem depender de timer). Junta tudo numa imagem só.
// Olhe os quadros do MEIO (60–260 ms): é onde aparece texto sobreposto, bloco solto antes do título, salto de layout.
// A contagem dos números (rAF) não pausa junto: números diferentes entre quadros são do método, não da página.
// Uso: python3 -m http.server 8941 &  PW_MODULE=... CHROME_PATH=... node docs/arezzo/testes/contact_transicao_apresentacao.js [saida.png]
const { chromium } = require(process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js'); const { seed } = require('./seed_apresentacao.js');
const SAIDA = process.argv[2] || require('path').join(__dirname, '../../capturas/contact_transicao_apresentacao.png');
const TS = [0, 60, 120, 180, 260, 360, 480, 700];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } }); await fake.install(ctx, seed()); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8941/okr-apresentacao.slide.html'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana' }); await p.waitForTimeout(1800);
  const shots = [];
  for (const [nome, de, para] of [['capa', 1, 0], ['torre', 0, 1], ['gerência', 1, 2], ['panorama', 2, -1]]) {
    for (const t of TS) {
      await p.evaluate(de => window._okrGoTo(de), de); await p.waitForTimeout(800);
      await p.evaluate(([para, t]) => { window._okrGoTo(para < 0 ? document.querySelectorAll('.slide').length - 1 : para); document.getAnimations().forEach(a => { a.pause(); a.currentTime = t; }); }, [para, t]);
      shots.push({ nome, t, img: (await p.screenshot()).toString('base64') });
    }
  }
  const pg = await ctx.newPage(); await pg.setViewportSize({ width: TS.length * 240, height: 4 * 160 });
  await pg.setContent(`<body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(${TS.length},240px);font:11px sans-serif;color:#fff">${shots.map(s => `<div><img src="data:image/png;base64,${s.img}" style="width:240px;height:135px;display:block"><div style="height:25px;padding:3px">${s.nome} · ${s.t} ms</div></div>`).join('')}</body>`);
  await pg.screenshot({ path: SAIDA }); console.log('contact sheet: ' + SAIDA + (errs.length ? '  erros: ' + errs.join(' | ') : ''));
  await b.close(); process.exit(errs.length ? 1 : 0);
})();
