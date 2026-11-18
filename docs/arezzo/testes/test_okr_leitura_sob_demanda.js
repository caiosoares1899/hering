// 📉 18/11/2026 (/otimizaçãoderotina): o Radar só baixa kanban/okr/snapshots e kanban/okr/reuniao_notas quando a tela que usa esses dados abre.
// Comparar com outra versão: OKR_HTML=/caminho/da/versao.html node docs/arezzo/testes/test_okr_leitura_sob_demanda.js
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(os.homedir(), 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const ROOT = path.resolve(__dirname, '../../..');
const achar = d => { for (const n of fs.readdirSync(d)) { const f = path.join(d, n), st = fs.statSync(f); if (n === 'Google Chrome for Testing' && st.isFile()) return f; if (st.isDirectory()) { const x = achar(f); if (x) return x; } } return null; };
const chrome = () => process.env.CHROME || achar(path.join(os.homedir(), 'hering-tools/chrome'));
const user = { uid: 'ad', email: 'adrian@ciahering.com.br', displayName: 'Adrian Teste', providerData: [{ providerId: 'google.com' }] };
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const seed = () => ({ kanban: {
  usuarios: { ad: { nome: 'Adrian Teste', email: user.email, init: 'AD', role: 'adm', inscrito: true, torre: 'digital', squads: { dados: true } } },
  usuarios_publicos: { ad: { nome: 'Adrian Teste', init: 'AD', role: 'adm', inscrito: true, squads: { dados: true } } },
  config: { adm_emails: [user.email] },
  okr: { objetivos: { o1: { id: 'o1', titulo: 'Objetivo de teste', areaId: 'geral', torre: 'digital' } }, marcos: {},
    snapshots: { '2026-11-13': { date: '2026-11-13', resumoGeral: { total: 1, no_prazo: 1 }, objetivos: { o1: { titulo: 'Objetivo de teste', areaId: 'geral', status: 'no_prazo', progressoPct: 40, totalMarcos: 2, marcosConcluidos: 1 } } } },
    reuniao_notas: { [hoje]: { n1: { texto: 'Anotacao da reuniao de teste', autor: 'Adrian Teste', autorUid: 'ad', ts: new Date().toISOString() } } } } } });
const tipos = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (process.env.OKR_HTML && /okr-dev\.html$/.test(f)) f = process.env.OKR_HTML; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let falhas = 0; const t = (n, ok, d) => { if (!ok) falhas++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
(async () => {
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok)); const BASE = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch({ executablePath: chrome(), headless: true });
  const abrir = async () => { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' }); await fake.install(ctx, seed());
    await ctx.addInitScript(() => { try { localStorage.setItem('mare_dicas_off', '1'); } catch (e) {} });
    const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message));
    await p.goto(BASE + '/okr-dev.html'); await p.waitForFunction(() => !!window.__authCb && !!window._onValue);
    await p.evaluate(() => { const orig = window._onValue; window.__lidos = []; window._onValue = (r, ...a) => { window.__lidos.push(String(r && (r.p || r.path || r))); return orig(r, ...a); }; });
    await p.evaluate(u => window.__authCb(u), user); await p.waitForTimeout(2500); return { ctx, p, erros }; };
  const lidos = (p, no) => p.evaluate(n => window.__lidos.filter(x => x.includes(n)).length, no);
  try {
    { const { ctx, p, erros } = await abrir();
      t('abrir o Radar lê os Objetivos normalmente', await lidos(p, 'kanban/okr/objetivos') > 0, await p.evaluate(() => window.__lidos));
      t('abrir o Radar não baixa o histórico semanal', await lidos(p, 'okr/snapshots') === 0, await p.evaluate(() => window.__lidos));
      t('abrir o Radar não baixa as anotações de reunião', await lidos(p, 'okr/reuniao_notas') === 0, await p.evaluate(() => window.__lidos));
      await p.evaluate(() => _okrSetView('historico')); await p.waitForTimeout(900);
      t('abrir o Histórico baixa o histórico', await lidos(p, 'okr/snapshots') === 1, await lidos(p, 'okr/snapshots'));
      const h = await p.evaluate(() => document.getElementById('okr-h-root')?.innerText || '');
      t('o Histórico mostra os dados, sem ficar em "Carregando"', !/Carregando/.test(h) && !/Ainda não há nenhum snapshot/.test(h), h.slice(0, 200));
      await p.evaluate(() => { _okrSetView('objetivos'); _okrSetView('historico'); }); await p.waitForTimeout(500);
      t('voltar ao Histórico não abre outra leitura', await lidos(p, 'okr/snapshots') === 1, await lidos(p, 'okr/snapshots'));
      t('o Histórico não baixa as anotações', await lidos(p, 'okr/reuniao_notas') === 0, '');
      await p.evaluate(() => _okrSetView('notas')); await p.waitForTimeout(900);
      t('abrir Anotações baixa as anotações uma vez', await lidos(p, 'okr/reuniao_notas') === 1, await lidos(p, 'okr/reuniao_notas'));
      t('a aba Anotações mostra a anotação', /Anotacao da reuniao de teste/.test(await p.evaluate(() => document.getElementById('okr-notas-list')?.innerText || '')), '');
      t('nenhum erro de JavaScript', !erros.length, erros);
      await ctx.close(); }
    { const { ctx, p, erros } = await abrir();
      await p.evaluate(d => { okrEventos.ev1 = { id: 'ev1', titulo: 'Reuniao de teste', data: d, torre: 'digital' }; openOkrEvento('ev1', d); }, hoje); await p.waitForTimeout(900);
      t('o detalhe do evento baixa as anotações', await lidos(p, 'okr/reuniao_notas') === 1, await lidos(p, 'okr/reuniao_notas'));
      t('o detalhe do evento oferece vincular a anotação da apresentação', /Há 1 anotação\(ões\) da apresentação neste dia/.test(await p.evaluate(() => document.getElementById('okr-evd-ov')?.innerText || '')), await p.evaluate(() => (document.getElementById('okr-evd-ov')?.innerText || '').slice(0, 300)));
      t('nenhum erro de JavaScript no evento', !erros.length, erros);
      await ctx.close(); }
  } finally { await b.close(); srv.close(); }
  console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo'); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
