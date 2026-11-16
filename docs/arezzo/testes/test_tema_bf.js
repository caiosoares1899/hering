// 🔥 Semana Black Friday (kanban-dev, 16/11/2026): o tema BF é o padrão de todo mundo de seg a dom da BF (Brasília),
// sem gravar mare_theme; quem sai fica fora até domingo; virada com a aba aberta; fita OFERTA sem cobrir "seu card".
// Boot real + Firebase falso; a data é fingida com page.clock.setFixedTime (Date.now/new Date; timers seguem normais).
// Uso: node docs/arezzo/testes/test_tema_bf.js   (sobe o próprio servidor) · PAGINA=kanban testa o prod
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), os = require('node:os');
const PW = process.env.PLAYWRIGHT_MODULE || (fs.existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : path.join(os.homedir(), 'hering-tools/playwright/node_modules/playwright'));
const { chromium } = require(PW);
const fake = require('./fakefb');
const ROOT = path.resolve(__dirname, '../../..'), PAG = process.env.PAGINA || 'kanban-dev';
function chrome() {
  if (process.env.CHROME) return process.env.CHROME;
  if (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) return '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const r = path.join(os.homedir(), 'hering-tools/chrome'), arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-'));
  return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
}
const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana Teste', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const old = new Date(Date.now() - 40 * 864e5).toISOString();
const seed = () => ({ kanban: {
  usuarios: { ana: { uid: 'ana', nome: 'Ana Teste', email: U.email, init: 'AT', role: 'membro', inscrito: true, squads: { site: true } } },
  usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana Teste', init: 'AT', role: 'membro', squads: { site: true } } },
  config: { adm_emails: [] }, squads_meta: {},
  squads: { site: { dados: { columns: [{ id: 'todo', name: 'A fazer' }, { id: 'done', name: 'Concluído', isDone: true }],
    cards_index: { c1: 'k1', c2: 'k2', c3: 'k3', c4: 'k4' },
    cards: {
      k1: { id: 'c1', title: 'Crítico e meu — título que não pode ficar embaixo da fita', col: 'todo', priority: 'critical', owner: 'AT', created: 'AT', createdAt: '2026-11-01' },
      k2: { id: 'c2', title: 'Crítico e contínuo', col: 'todo', priority: 'critical', continuo: true, created: 'AT', createdAt: '2026-11-01' },
      k3: { id: 'c3', title: 'Crítico sozinho', col: 'todo', priority: 'critical', created: 'AT', createdAt: '2026-11-01' },
      k4: { id: 'c4', title: 'Normal', col: 'todo', priority: 'medium', created: 'AT', createdAt: '2026-11-01' },
    } } } } } });
const tipos = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
let falhas = 0;
const t = (n, ok, d) => { if (!ok) falhas++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
const SP = s => Date.parse(s + '-03:00');   // horário de Brasília
(async () => {
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok)); const BASE = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch({ executablePath: chrome(), headless: true });
  // abre o Maré na data `quando` com o localStorage `ls` (e sem a marca de saída padrão do fakefb)
  async function abrir(quando, ls, w = 1280, pagina = PAG) {
    const ctx = await b.newContext({ viewport: { width: w, height: 860 } });
    await fake.install(ctx, seed(), { bf: true });
    await ctx.addInitScript(o => { if (sessionStorage.getItem('__ls_ok')) return; sessionStorage.setItem('__ls_ok', '1'); try { localStorage.setItem('mare_guia_mare_visto', '1'); Object.entries(o).forEach(([k, v]) => localStorage.setItem(k, v)); } catch (e) {} }, ls || {});
    const p = await ctx.newPage(); await p.clock.setFixedTime(quando);
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/' + pagina + '.html?squad=site'); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(u => window.__authCb(u), U); await p.waitForTimeout(2300);
    await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')));
    return { ctx, p, errs };
  }
  const tema = p => p.evaluate(() => document.documentElement.getAttribute('data-theme') || 'dark');
  const ls = (p, k) => p.evaluate(k => localStorage.getItem(k), k);
  const recarregar = async p => { await p.reload(); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(u => window.__authCb(u), U); await p.waitForTimeout(1800); };
  try {
    // janela
    { const { ctx, p } = await abrir(SP('2026-11-16T12:00:00'), {});
      const j2 = await p.evaluate(() => { const f = s => window._bfSemanaInfo(Date.parse(s + '-03:00')); const a = [f('2026-11-23T00:00:30'), f('2026-11-22T23:59:30'), f('2026-11-29T23:59:30'), f('2026-11-30T00:00:30'), f('2027-11-24T12:00:00')]; return a.map(x => x.dentro + '|' + x.ini + '..' + x.fim).join(' '); });
      t('janela 2026 = 23/11 a 29/11 (Brasília), bordas certas; 2027 fora (BF_PADRAO_ANOS = [2026])', j2 === 'true|2026-11-23..2026-11-29 false|2026-11-23..2026-11-29 true|2026-11-23..2026-11-29 false|2027-11-22..2027-11-28 false|2027-11-22..2027-11-28', j2);
      await ctx.close(); }
    // dentro da semana: BF no boot, sem gravar mare_theme
    { const { ctx, p, errs } = await abrir(SP('2026-11-24T10:00:00'), { mare_theme: 'light' });
      t('dentro da semana: abre no 🔥 mesmo com Lençóis salvo', await tema(p) === 'blackfriday', await tema(p));
      t('dentro da semana: mare_theme continua "light" (nada gravado)', await ls(p, 'mare_theme') === 'light', await ls(p, 'mare_theme'));
      const txt = await p.evaluate(() => document.getElementById('bf-countdown-txt').textContent);
      t('contador mostra os dias até sexta (sem data fixa no código)', /^🔥 2d 1[34]h pra Black Friday$/.test(txt), txt);
      await p.waitForTimeout(1500);
      t('aviso único da semana gravado', await ls(p, 'mare_bf_aviso_2026') === '1', await ls(p, 'mare_bf_aviso_2026'));
      // fita x selo
      const fita = await p.evaluate(() => { const q = id => document.querySelector('.card[data-id="' + id + '"]') || [...document.querySelectorAll('.card')].find(c => c.textContent.includes(id)); const cs = (el, ps) => el ? getComputedStyle(el, ps) : null;
        const c1 = [...document.querySelectorAll('.card')].find(c => c.textContent.includes('Crítico e meu')), c2 = [...document.querySelectorAll('.card')].find(c => c.textContent.includes('Crítico e contínuo')), c3 = [...document.querySelectorAll('.card')].find(c => c.textContent.includes('Crítico sozinho'));
        void q; return { c1after: cs(c1, '::after').content, c1before: cs(c1, '::before').content, c1left: parseFloat(cs(c1, '::after').left), c1w: c1.getBoundingClientRect().width, c1right: cs(c1, '::after').right, c1radius: cs(c1, '::after').borderTopLeftRadius, c2after: cs(c2, '::after').content, c3after: cs(c3, '::after').content, mine: c1 && c1.classList.contains('card-mine') }; });
      t('crítico + seu: "👤 seu card" continua (::before) e a fita OFERTA vai pro canto (::after no canto direito, sem pílula)', fita.mine && /seu card/.test(fita.c1before) && /OFERTA/.test(fita.c1after) && fita.c1right === '-28px' && Math.abs(fita.c1left - (fita.c1w + 28 - 110)) < 3 && fita.c1radius === '0px', fita);
      t('crítico + contínuo: o estado real (♾️ CONTÍNUO) vence a decoração', /CONTÍNUO/.test(fita.c2after), fita.c2after);
      t('crítico sozinho: fita 🔥 OFERTA', /OFERTA/.test(fita.c3after), fita.c3after);
      const aged = await p.evaluate(() => { const c = [...document.querySelectorAll('.card')].find(x => x.textContent.includes('Crítico sozinho')); c.classList.add('aged-2'); const cs = getComputedStyle(c, '::after'); const r = { content: cs.content, op: cs.opacity }; c.classList.remove('aged-2'); return r; });
      t('crítico + 💤 parado: o 💤 (opacidade .6) vence a fita', /💤/.test(aged.content) && aged.op === '0.6', aged);
      // automático não passa por cima
      await p.evaluate(() => { localStorage.setItem('mare_theme_auto', '1'); _applyAutoTheme(true); document.dispatchEvent(new Event('visibilitychange')); });
      t('🕐 automático (tique/visibilidade) não tira o 🔥 da semana', await tema(p) === 'blackfriday', await tema(p));
      await p.evaluate(() => localStorage.setItem('mare_theme_auto', ''));
      // sair: clique no 🔥
      await p.evaluate(() => onThemeBtnClick()); await p.waitForTimeout(400);
      t('clique no 🔥: volta pro tema da pessoa (Lençóis) e marca a saída da semana', await tema(p) === 'light' && await ls(p, 'mare_bf_sair_2026') === '1', [await tema(p), await ls(p, 'mare_bf_sair_2026')]);
      await recarregar(p);
      t('saída sobrevive ao F5 (continua Lençóis)', await tema(p) === 'light', await tema(p));
      await p.evaluate(() => _bfUpdateCountdown());
      t('o tique do contador não religa o 🔥 de quem saiu', await tema(p) === 'light', await tema(p));
      // voltar pelas Preferências
      await p.evaluate(() => { openMinhasPrefs ? openMinhasPrefs() : null; }).catch(() => {});
      const btn = await p.evaluate(() => { renderMinhasPrefsBody && renderMinhasPrefsBody(); const b = [...document.querySelectorAll('button')].find(x => /🔥 Black Friday/.test(x.textContent)); return !!b; }).catch(e => 'erro ' + e.message);
      t('Minhas Preferências mostra "🔥 Black Friday" na semana', btn === true, btn);
      await p.evaluate(() => toggleBlackFriday());
      t('🔥 Black Friday (prefs) volta pro tema da semana e apaga a saída', await tema(p) === 'blackfriday' && await ls(p, 'mare_bf_sair_2026') === null && await ls(p, 'mare_theme') === 'light', [await tema(p), await ls(p, 'mare_bf_sair_2026'), await ls(p, 'mare_theme')]);
      // "Trocar tema" das Preferências estando no 🔥
      await p.evaluate(() => toggleTheme());
      t('"Trocar tema" no 🔥 = sair pro tema da pessoa (com marca)', await tema(p) === 'light' && await ls(p, 'mare_bf_sair_2026') === '1', [await tema(p), await ls(p, 'mare_bf_sair_2026')]);
      t('sem erro de JS', !errs.length, errs);
      await ctx.close(); }
    // Vice e automático a partir do 🔥 da semana
    { const { ctx, p } = await abrir(SP('2026-11-25T15:00:00'), { mare_theme: 'dark' });
      await p.evaluate(() => toggleViceCity());
      t('Vice (segurar o botão) a partir do 🔥: entra no Vice e marca a saída', await tema(p) === 'vice' && await ls(p, 'mare_bf_sair_2026') === '1', [await tema(p)]);
      await recarregar(p); t('Vice sobrevive ao F5', await tema(p) === 'vice', await tema(p));
      await p.evaluate(() => exitViceCity()); t('sair do Vice volta pro Abrolhos (não pro 🔥)', await tema(p) === 'dark', await tema(p));
      await ctx.close(); }
    { const { ctx, p } = await abrir(SP('2026-11-25T15:00:00'), { mare_theme: 'dark' });
      await p.evaluate(() => toggleThemeAuto());
      t('ligar o 🕐 automático no 🔥 = sai do padrão e aplica a banda (15h → Vice)', await tema(p) === 'vice' && await ls(p, 'mare_bf_sair_2026') === '1', [await tema(p), await ls(p, 'mare_bf_sair_2026')]);
      await ctx.close(); }
    // fora da semana
    { const { ctx, p } = await abrir(SP('2026-11-20T10:00:00'), { mare_theme: 'light' });
      t('antes da semana: tema da pessoa (Lençóis)', await tema(p) === 'light', await tema(p));
      await p.evaluate(() => toggleBlackFriday()); await recarregar(p);
      t('🔥 manual fora da semana sobrevive ao F5 (antes sumia)', await tema(p) === 'blackfriday', await tema(p));
      await p.evaluate(() => onThemeBtnClick()); await p.waitForTimeout(400);
      t('sair do 🔥 manual volta pro Lençóis', await tema(p) === 'light', await tema(p));
      await ctx.close(); }
    // virada com a aba aberta
    { const { ctx, p } = await abrir(SP('2026-11-22T23:59:00'), { mare_theme: 'light' });
      t('domingo 22/11 23:59: ainda Lençóis', await tema(p) === 'light', await tema(p));
      await p.clock.setFixedTime(SP('2026-11-23T00:01:00')); await p.evaluate(() => _bfUpdateCountdown());
      t('aba aberta vira pro 🔥 à 00h de segunda 23/11', await tema(p) === 'blackfriday', await tema(p));
      await p.clock.setFixedTime(SP('2026-11-27T09:00:00')); await p.evaluate(() => _bfUpdateCountdown());
      t('sexta 27/11: "É hoje: Black Friday!"', await p.evaluate(() => document.getElementById('bf-countdown-txt').textContent) === '🔥 É hoje: Black Friday!', await p.evaluate(() => document.getElementById('bf-countdown-txt').textContent));
      await p.clock.setFixedTime(SP('2026-11-28T09:00:00')); await p.evaluate(() => _bfUpdateCountdown());
      t('sábado: "Fim de semana da Black Friday"', /Fim de semana da Black Friday/.test(await p.evaluate(() => document.getElementById('bf-countdown-txt').textContent)), '');
      await p.clock.setFixedTime(SP('2026-11-30T00:01:00')); await p.evaluate(() => _bfUpdateCountdown());
      t('segunda 30/11: aba aberta volta sozinha pro Lençóis', await tema(p) === 'light' && await ls(p, 'mare_theme') === 'light', [await tema(p), await ls(p, 'mare_theme')]);
      await ctx.close(); }
    { const { ctx, p } = await abrir(SP('2026-11-30T09:00:00'), { mare_theme: 'light', mare_bf_sair_2026: '1' });
      t('depois da semana: tema da pessoa (Lençóis)', await tema(p) === 'light', await tema(p)); await ctx.close(); }
    // modo de teste (validação antes da semana) não contamina a semana real
    { const { ctx, p } = await abrir(SP('2026-11-17T10:00:00'), { mare_theme: 'light', mare_bf_semana_teste: '2026-11-20' });
      t('teste: mare_bf_semana_teste simula a semana hoje', await tema(p) === 'blackfriday', await tema(p));
      await p.evaluate(() => onThemeBtnClick()); await p.waitForTimeout(400);
      t('teste: sair grava a chave _teste, nunca a real', await ls(p, 'mare_bf_sair_2026_teste') === '1' && await ls(p, 'mare_bf_sair_2026') === null, [await ls(p, 'mare_bf_sair_2026_teste'), await ls(p, 'mare_bf_sair_2026')]);
      await p.clock.setFixedTime(SP('2026-11-21T10:00:00')); await p.evaluate(() => { localStorage.removeItem('mare_bf_sair_2026_teste'); window.__bfPadrao = true; document.documentElement.setAttribute('data-theme', 'blackfriday'); _bfUpdateCountdown(); });
      t('teste: passou a data-limite → volta sozinho pro tema da pessoa', await tema(p) === 'light', await tema(p));
      await ctx.close(); }
    // celular sem rolagem lateral
    { const { ctx, p } = await abrir(SP('2026-11-24T10:00:00'), {}, 390);
      t('390 px no 🔥: sem rolagem lateral', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), await p.evaluate(() => document.documentElement.scrollWidth));
      t('390 px: o botão de tema do topo some (fica no ⋯), por isso o aviso cita "⋯ → Alternar tema"', await p.evaluate(() => getComputedStyle(document.getElementById('theme-toggle-btn')).display === 'none'), '');
      await p.evaluate(() => _mobileThemeRowClick()); await p.waitForTimeout(300);
      t('390 px: ⋯ → Alternar tema sai do 🔥 e marca a saída', await tema(p) !== 'blackfriday' && await ls(p, 'mare_bf_sair_2026') === '1', [await tema(p), await ls(p, 'mare_bf_sair_2026')]);
      await ctx.close(); }
    // outras páginas não mudam
    if (PAG === 'kanban-dev') for (const pg of ['painel-dev', 'okr-dev']) {
      const ctx = await b.newContext(); await fake.install(ctx, seed(), { bf: true });
      await ctx.addInitScript(() => { try { localStorage.setItem('mare_theme', 'light'); } catch (e) {} });
      const p = await ctx.newPage(); await p.clock.setFixedTime(SP('2026-11-24T10:00:00')); await p.goto(BASE + '/' + pg + '.html'); await p.waitForTimeout(800);
      t(pg + ' na semana: continua no tema salvo (light)', await tema(p) === 'light', await tema(p)); await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(falhas ? `HÁ ${falhas} FALHA(S)` : 'TUDO OK'); process.exitCode = falhas ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; srv.close(); });
