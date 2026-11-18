// 🎲 Monte Carlo · fase 0: prova que console_monte_carlo_cobertura.js classifica as entregas, não grava nada e não expõe dado de card ou pessoa.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(os.homedir(), 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const ROOT = path.resolve(__dirname, '../../..');
function chrome() { if (process.env.CHROME) return process.env.CHROME; const r = path.join(os.homedir(), 'hering-tools/chrome'), arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-')); return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'); }
const tipos = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': tipos[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let falhas = 0; const t = (n, ok, d) => { if (!ok) falhas++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 400))); };
const ADM = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana ADM', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const noon = n => { const x = new Date(); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - n); return x.toISOString(); };
const fim = (id, n, extra) => { const at = noon(n); return Object.assign({ id, title: 'SEGREDO-TITULO', owner: 'PESSOA-X', col: 'done', flow: { doneAt: at, log: [{ from: 'progress', to: 'done', at }] } }, extra); };
const r5 = noon(5);
const cards = [
  fim('ID-SECRETO-1', 3), fim('v2', 3, { archived: true }), fim('v3', 10),
  { id: 'v4', title: 'x', col: 'done', flow: { doneAt: r5, log: [{ from: 'progress', to: 'done', at: noon(7) }, { from: 'done', to: 'progress', at: noon(6) }, { from: 'progress', to: 'done', at: r5 }] } },
  fim('v2', 3),
  { id: 'aberto', col: 'progress', flow: { log: [] } }, { id: 'arq-aberto', col: 'todo', archived: true, flow: { log: [] } },
  fim('canc', 3, { col: 'cancel' }),
  { id: 'imp', col: 'done', flow: { doneAt: noon(4), imported: true, log: [] } }, { id: 'sem-ev', col: 'done', flow: { doneAt: noon(4), log: [] } },
  { id: 'legado', col: 'done', doneAt: noon(4) }, { id: 'ruim', col: 'done', flow: { doneAt: 'xx', log: [] } },
  { id: 'criado', col: 'done', flow: { doneAt: noon(4), log: [{ from: '—', to: 'done', at: noon(4) }] } },
  { id: 'reset', col: 'done', flow: { doneAt: noon(8), resetAt: noon(8), log: [] } },
  fim('pai', 4, { childCardIds: ['v3'] }), fim('antigo', 25), fim('hoje', 0),
  { id: 'entre', col: 'done', flow: { doneAt: noon(4), log: [{ from: 'cancel', to: 'done', at: noon(4) }] } },
];
const seed = () => ({ kanban: { usuarios: { ana: { uid: 'ana', nome: 'Ana ADM', email: ADM.email, inscrito: true, init: 'AA', role: 'adm', squads: { dados: true } } }, usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana ADM', init: 'AA' } }, config: { adm_emails: [ADM.email] },
  squads: { dados: { dados: { columns: [{ id: 'todo', name: 'A Fazer' }, { id: 'progress', name: 'Em Progresso' }, { id: 'done', name: 'Concluído' }, { id: 'cancel', name: 'Cancelado' }], cards, flow_baseline: { at: noon(20), by: 'painel' }, config: { flow: { doneCols: ['done', 'cancel'] } } } } } } });
(async () => {
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
  const BASE = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch({ executablePath: chrome(), headless: true });
  try {
    const abrir = async pagina => { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed());
      const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.goto(BASE + '/' + pagina); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(u => window.__authCb(u), ADM); await p.waitForTimeout(3000); return { ctx, p, errs }; };
    { const { ctx, p } = await abrir('painel-dev.html'); const avisos = []; p.on('console', m => { if (m.type() === 'warning') avisos.push(m.text()); });
      const r = await p.evaluate(fs.readFileSync(path.join(__dirname, 'console_monte_carlo_cobertura.js'), 'utf8')); await p.waitForTimeout(100);
      t('no painel-dev, que não carrega o squad, manda abrir o painel.html', r === null && avisos.some(a => a.includes('painel.html')), avisos); await ctx.close(); }
    const { ctx, p, errs } = await abrir('painel.html');
    t('o painel.html carrega o squad com os arquivados e a data do corte', await p.evaluate(() => squadData.dados && squadData.dados.cards.length === 18 && !!squadData.dados.flowBaseline), await p.evaluate(() => Object.keys(squadData)));
    await p.evaluate(() => { window.__log.length = 0; });
    const src = fs.readFileSync(path.join(__dirname, 'console_monte_carlo_cobertura.js'), 'utf8');
    const r = await p.evaluate(src);
    const D = r.descartes;
    t('conta as 4 entregas válidas, incluindo a arquivada', r.entregasValidas === 4 && r.cards.arquivadosEntregues === 1, r);
    t('reabertura não vira entrega extra e fica registrada', r.reaberturasNasValidas === 1, r.reaberturasNasValidas);
    t('card aberto e card arquivado fora do fim não contam', r.cards.arquivados === 2 && r.cards.emColunaDeFim === 15, r.cards);
    t('cancelamento fica separado da entrega', D.cancelados === 1 && r.colunasDeFim.find(c => c.nome === 'Cancelado').contaComoEntrega === false, r.colunasDeFim);
    t('importado, sem evento, sem data e data inválida são descartados', D.importados === 1 && D.semEventoDeEntrega === 1 && D.semData === 1 && D.dataInvalida === 1, D);
    t('criado no fim, carimbo do reset e movido entre fins são descartados', D.criadosNoFim === 1 && D.carimboDoReset === 1 && D.movidosEntreFins === 1, D);
    t('agregador, antes do corte, hoje e duplicado são descartados', D.agregadores === 1 && D.antesDoCorte === 1 && D.diaDeHoje === 1 && D.duplicados === 1, D);
    t('dias sem entrega entram como zero, começando depois do corte', r.diario.length === 19 && r.diario.filter(x => x.entregas).length === 3 && r.diario.reduce((s, x) => s + x.entregas, 0) === 4, r.diario);
    t('avisa que o histórico não atinge os pisos e que a contagem foi zerada', r.alertas.some(a => a.includes('pisos')) && r.alertas.some(a => a.includes('zerada')) && r.atende.entregas === false, r.alertas);
    const json = JSON.stringify(r);
    t('a saída não traz título, id de card ou pessoa', !/SEGREDO|PESSOA|ID-SECRETO|Ana ADM|ana@/.test(json), json.slice(0, 200));
    const escritas = await p.evaluate(() => window.__log.filter(l => ['set', 'update', 'remove', 'transaction'].includes(l[0])));
    t('não grava nada no banco', escritas.length === 0, escritas);
    t('sem erro de JS', !errs.length, errs);
    await ctx.close();
  } finally { await b.close(); srv.close(); }
  console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo.'); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
