// 🚨 Selinho do status da VTEX no topo do Oceano (oceano-dev.html): lê kanban/vtex_saude (escrito pela função vtexStatus) e mostra
// azul "VTEX normal" · vermelho "VTEX: incidente" (link do incidente) · cinza "VTEX: sem leitura" (batimento velho) · some (sem nó / desligado).
// Nunca afirma "normal" sem leitura recente. SUF=-dev (padrão); SUF= testa a prod depois da promoção.
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const SUF = process.env.SUF === undefined ? '-dev' : process.env.SUF;
const U = { uid: 'eve', email: 'eve@ciahering.com.br', displayName: 'Eve', photoURL: '', providerData: [{ providerId: 'google.com' }] };
let ok = true; const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + (JSON.stringify(d === undefined ? null : d) || '').slice(0, 300))); };
const min = (m) => new Date(Date.now() - m * 60000).toISOString();
const seed = (saude) => ({ kanban: { usuarios: { eve: { uid: 'eve', nome: 'Eve', email: 'eve@ciahering.com.br', init: 'EV', role: 'membro', inscrito: true, squads: { dev: true } } }, usuarios_publicos: {}, config: { adm_emails: [] }, squads_meta: {}, comunicados: {}, ...(saude ? { vtex_saude: saude } : {}) } });
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ver = async (saude, w) => {
    const ctx = await b.newContext({ viewport: { width: w || 1280, height: 900 } }); await fake.install(ctx, seed(saude));
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8941/oceano' + SUF + '.html'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(1200);
    const r = await p.evaluate(() => { const e = document.getElementById('vtex-pill'); const cs = getComputedStyle(e); return { visivel: cs.display !== 'none' && e.offsetWidth > 0, cls: e.className, texto: document.getElementById('vtex-tx').textContent, titulo: e.title, href: e.href, txVisivel: getComputedStyle(document.getElementById('vtex-tx')).display !== 'none' }; });
    r.errs = errs; await ctx.close(); return r; };

  let r = await ver(null);
  t('sem o nó vtex_saude (função ainda não publicada): o selinho não aparece', !r.visivel && !r.errs.length, r);
  r = await ver({ desligado: true, em: min(1) });
  t('monitor desligado (vtex_status_off): não aparece', !r.visivel, r);
  r = await ver({ ok: true, ultimoOkEm: min(3), abertos: 0, incidentes: [], falhasSeguidas: 0 });
  t('tudo normal e leitura recente: azul "VTEX normal", com "verificado há 3 min"', r.visivel && r.cls === 'vtex-pill' && r.texto === 'VTEX normal' && /há 3 min/.test(r.titulo) && r.href === 'https://status.vtex.com/', r);
  r = await ver({ ok: true, ultimoOkEm: min(2), abertos: 1, incidentes: [{ titulo: 'Checkout errors', link: 'https://status.vtex.com/incidents/01ABC', estado: 'Investigating' }], falhasSeguidas: 0 });
  t('incidente aberto: vermelho "VTEX: incidente", título lista o incidente e o clique vai pra página dele', r.visivel && /alerta/.test(r.cls) && r.texto === 'VTEX: incidente' && /Checkout errors/.test(r.titulo) && r.href === 'https://status.vtex.com/incidents/01ABC', r);
  r = await ver({ ok: true, ultimoOkEm: min(2), abertos: 1, incidentes: [{ titulo: 'x', link: 'https://evil.example/phish', estado: 'Investigating' }] });
  t('link de incidente fora do status.vtex.com é ignorado (cai na página oficial)', r.href === 'https://status.vtex.com/', r);
  r = await ver({ ok: false, ultimoOkEm: min(45), abertos: 0, incidentes: [], falhasSeguidas: 9, erro: 'HTTP 503' });
  t('batimento velho (45 min): cinza "VTEX: sem leitura" — NUNCA "normal"', r.visivel && /mudo/.test(r.cls) && r.texto === 'VTEX: sem leitura' && /não dá pra afirmar/.test(r.titulo), r);
  r = await ver({ ok: true, ultimoOkEm: min(2), abertos: 1, incidentes: [{ titulo: 'Y', link: 'https://status.vtex.com/incidents/Z' }] }, 390);
  t('no celular só o ponto aparece (texto escondido, ainda acessível pelo título)', r.visivel && !r.txVisivel && /Incidente na VTEX/.test(r.titulo), r);
  r = await ver({ ok: true, abertos: 0 });
  t('nó sem ultimoOkEm (lixo): trata como sem leitura, não como normal', /mudo/.test(r.cls), r);
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1);
})();
