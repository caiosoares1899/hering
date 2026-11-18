// 🔐 /monitorarbugs no login Google (18/11/2026). Reproduz ANTES do fix e prova DEPOIS (KANBAN_HTML/PAINEL_HTML = outra versão):
// A) o login por popup guardava o accessToken do LOGIN (sem escopo de agenda) em gcal_token → o ⚙ dizia "autorizada", o ADM não era
//    pedido a autorizar a agenda de verdade e a API respondia 403 "insufficient scopes" ("Sem permissão de acesso a esta agenda");
// B) gcal_token de OUTRA conta (saiu pelo Oceano/Radar/Painel, por inatividade ou logout forçado) era usado pela conta seguinte;
// C) 403 "insufficient scopes" não descartava o token (o ADM ficava preso no erro até o token vencer);
// D) com TODAS as agendas falhando, gcal_cache era sobrescrito por {} (eventos do squad sumiam pra todo mundo) e voltava ok:true.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(os.homedir(), 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const ROOT = path.resolve(__dirname, '../../..');
function chrome() { if (process.env.CHROME) return process.env.CHROME; const r = path.join(os.homedir(), 'hering-tools/chrome'), arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-')); return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'); }
const tipos = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (process.env.KANBAN_HTML && /kanban-dev\.html$/.test(f)) f = process.env.KANBAN_HTML;
  if (process.env.PAINEL_HTML && /painel-dev\.html$/.test(f)) f = process.env.PAINEL_HTML;
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': tipos[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let falhas = 0; const t = (n, ok, d) => { if (!ok) falhas++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
const ADM = { uid: 'ad', email: 'caio.soares@ciahering.com.br', displayName: 'Caio Teste', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const seed = () => ({ kanban: {
  usuarios: { ad: { uid: 'ad', nome: 'Caio Teste', email: ADM.email, init: 'CT', role: 'adm', inscrito: true, squads: { site: true, dados: true } } },
  usuarios_publicos: { ad: { uid: 'ad', nome: 'Caio Teste', init: 'CT', role: 'adm', inscrito: true, squads: { site: true, dados: true } } },
  squads_meta: { dados: { id: 'dados', label: 'Dados', icon: '📊' } }, config: { adm_emails: [ADM.email] },
  squads: { site: { dados: { columns: [{ id: 'todo', name: 'To Do' }], cards_index: {}, cards: {},
    config: { calendars: { cal1: { id: 'cal1', label: 'A' }, cal2: { id: 'cal2', label: 'B' } }, gcal_cache: { e1: { id: 'e1', title: '🗓️ Evento antigo', start: '2026-11-20', end: '2026-11-20', _gcal: true, _calId: 'cal1' } } } } } } } });
// fetch do Google Agenda falso: grava qual token foi usado e responde conforme window.__gcalResp
const stubFetch = () => { const orig = window.fetch; window.__gcalAuth = []; window.fetch = (u, o) => {
  if (String(u).includes('googleapis.com/calendar')) { window.__gcalAuth.push((o && o.headers && o.headers.Authorization) || '');
    const r = typeof window.__gcalResp === 'function' ? window.__gcalResp(String(u)) : (window.__gcalResp || { status: 200, body: { items: [] } }); return Promise.resolve(new Response(JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json' } })); }
  return orig(u, o); }; };
(async () => {
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok)); const BASE = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch({ executablePath: chrome(), headless: true });
  const abrir = async (pagina, ls) => { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed());
    await ctx.addInitScript(o => { try { localStorage.setItem('mare_guia_mare_visto', '1'); localStorage.setItem('mare_dicas_off', '1'); localStorage.setItem('bvmd_ad', '1');
      Object.entries(o || {}).forEach(([k, v]) => localStorage.setItem(k, v)); } catch (e) {} }, ls);
    await ctx.addInitScript(stubFetch);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/' + pagina); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(u => window.__authCb(u), ADM);
    await p.waitForTimeout(2500); return { ctx, p, errs }; };
  const ls = p => p.evaluate(() => ({ tok: localStorage.getItem('gcal_token'), uid: localStorage.getItem('gcal_token_uid') }));
  try {
    // ── Maré
    { const { ctx, p } = await abrir('kanban-dev.html?squad=site');
      t('[A] o login por popup não grava o token do login em gcal_token', !/gcal_token/.test(await p.evaluate(() => String(window._signIn))), '');
      await ctx.close(); }
    { const { ctx, p } = await abrir('kanban-dev.html?squad=site', { gcal_token: 'TOK_DE_OUTRA_CONTA', gcal_token_ts: String(Date.now()), gcal_token_uid: 'outra' });
      const r = await p.evaluate(() => _fetchAndCacheGcalForSquad('site', [{ id: 'cal1', label: 'Agenda' }]).then(x => ({ x, auth: window.__gcalAuth })));
      t('[B] Maré: token de OUTRA conta não é usado', !r.auth.some(a => a.includes('TOK_DE_OUTRA_CONTA')), r);
      t('[B] Maré: token de outra conta é descartado', (await ls(p)).tok === null, await ls(p));
      await ctx.close(); }
    { const { ctx, p } = await abrir('kanban-dev.html?squad=site', { gcal_token: 'TOK_MEU', gcal_token_ts: String(Date.now()), gcal_token_uid: 'ad' });
      const r = await p.evaluate(() => _fetchAndCacheGcalForSquad('site', [{ id: 'cal1', label: 'Agenda' }]).then(x => ({ x, auth: window.__gcalAuth })));
      t('Maré: o próprio token continua valendo', r.auth.some(a => a.includes('TOK_MEU')) && r.x.ok, r);
      const semUser = await p.evaluate(() => { const u = window._currentUser; window._currentUser = null; try { return { v: typeof _gcalToken === 'function' ? _gcalToken() : '(sem _gcalToken)', tok: localStorage.getItem('gcal_token') }; } finally { window._currentUser = u; } });
      t('Maré: sem ninguém logado (boot), não usa nem apaga o token', semUser.v === null && semUser.tok === 'TOK_MEU', semUser);
      await p.evaluate(() => { window.__gcalResp = { status: 403, body: { error: { message: 'Request had insufficient authentication scopes.' } } }; });
      const r2 = await p.evaluate(() => _fetchAndCacheGcalForSquad('site', [{ id: 'cal1', label: 'Agenda' }]).then(() => window._gcalErrors.cal1));
      t('[C] Maré: 403 "insufficient scopes" descarta o token', (await ls(p)).tok === null, { err: r2, ls: await ls(p) });
      await ctx.close(); }
    { const { ctx, p } = await abrir('kanban-dev.html?squad=site', { gcal_token: 'TOK_MEU', gcal_token_ts: String(Date.now()), gcal_token_uid: 'ad' });
      const cache = () => p.evaluate(() => Object.keys((window.__store.kanban.squads.site.dados.config || {}).gcal_cache || {}).sort());
      await p.evaluate(() => { window.__gcalResp = { status: 401, body: {} }; });
      const r = await p.evaluate(() => _fetchAndCacheGcalForSquad('site', [{ id: 'cal1', label: 'A' }]));
      t('[D] Maré: todas as agendas falhando não apaga o cache do squad', JSON.stringify(await cache()) === '["e1"]', await cache());
      t('[D] Maré: e devolve falha (a fila de pedidos fica pra próxima)', r && r.ok === false, r);
      await p.evaluate(() => { window.__gcalResp = u => u.includes('cal2') ? { status: 200, body: { items: [{ id: 'n1', summary: 'Novo', start: { date: '2026-11-21' }, end: { date: '2026-11-22' } }] } } : { status: 401, body: {} }; });
      await p.evaluate(() => _fetchAndCacheGcalForSquad('site', [{ id: 'cal1', label: 'A' }, { id: 'cal2', label: 'B' }]));
      t('[D] Maré: só uma falhou → mantém os eventos antigos dela e grava os novos', JSON.stringify(await cache()) === '["e1","n1"]', await cache());
      await ctx.close(); }
    // ── Painel (agendas globais)
    { const { ctx, p } = await abrir('painel-dev.html', { gcal_token: 'TOK_DE_OUTRA_CONTA', gcal_token_ts: String(Date.now()), gcal_token_uid: 'outra' });
      await p.evaluate(() => { window._pcalCalendars = { c: { id: 'cal1', label: 'Agenda' } }; return carregarPcalAgendasGlobais(); });
      const auth = await p.evaluate(() => window.__gcalAuth);
      t('[B] Painel: token de OUTRA conta não é usado', !auth.some(a => a.includes('TOK_DE_OUTRA_CONTA')), auth);
      await ctx.close(); }
    { const { ctx, p } = await abrir('painel-dev.html', { gcal_token: 'TOK_MEU', gcal_token_ts: String(Date.now()), gcal_token_uid: 'ad' });
      await p.evaluate(() => { window._pcalCalendars = { c: { id: 'cal1', label: 'Agenda' } }; window.__gcalResp = { status: 403, body: { error: { message: 'Request had insufficient authentication scopes.' } } }; return carregarPcalAgendasGlobais(); });
      const auth = await p.evaluate(() => window.__gcalAuth);
      t('Painel: o próprio token é usado', auth.some(a => a.includes('TOK_MEU')), auth);
      t('[C] Painel: 403 "insufficient scopes" descarta o token', (await ls(p)).tok === null, await ls(p));
      await ctx.close(); }
  } finally { await b.close(); srv.close(); }
  console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo.'); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
