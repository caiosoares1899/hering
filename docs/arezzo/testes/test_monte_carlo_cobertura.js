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
  { id: 'vv', col: 'done', flow: { doneAt: noon(4), log: [{ from: 'progress', to: 'valid', at: noon(6) }, { from: 'valid', to: 'done', at: noon(4) }] } },
  { id: 'em-validacao', col: 'valid', flow: { doneAt: noon(2), log: [{ from: 'progress', to: 'valid', at: noon(2) }] } },
];
const seed = () => ({ kanban: { usuarios: { ana: { uid: 'ana', nome: 'Ana ADM', email: ADM.email, inscrito: true, init: 'AA', role: 'adm', squads: { dados: true } } }, usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana ADM', init: 'AA' } }, config: { adm_emails: [ADM.email] },
  squads: { dados: { dados: { columns: [{ id: 'todo', name: 'A Fazer' }, { id: 'progress', name: 'Em Progresso' }, { id: 'valid', name: 'Validação' }, { id: 'done', name: 'Concluído' }, { id: 'cancel', name: 'Cancelado' }], cards, flow_baseline: { at: noon(20), by: 'painel' }, config: { flow: { doneCols: ['valid', 'done', 'cancel'] } } } } } } });
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
    t('o painel.html carrega o squad com os arquivados e a data do corte', await p.evaluate(() => squadData.dados && squadData.dados.cards.length === 19 && !!squadData.dados.flowBaseline), await p.evaluate(() => Object.keys(squadData)));
    await p.evaluate(() => { window.__log.length = 0; });
    const src = fs.readFileSync(path.join(__dirname, 'console_monte_carlo_cobertura.js'), 'utf8');
    const r = await p.evaluate(src);
    const A = r.cenarios.ultimaColuna, B = r.cenarios.primeiraChegada, C = r.descartesComuns;
    const dias = o => Object.keys(o).sort();
    t('Validação → Concluído conta como entrega, na data em que chegou em Concluído', A.entregasValidas === 5 && A.entregasPorDia[noon(4).slice(0, 10)] === 1, A);
    t('card ainda em Validação não conta no cenário da última coluna', A.descartes.aindaNaoChegou === 1, A.descartes);
    t('no outro cenário, a entrega vale a primeira chegada a uma coluna de fim', B.entregasValidas === 6 && B.entregasPorDia[noon(6).slice(0, 10)] === 1 && B.entregasPorDia[noon(2).slice(0, 10)] === 1 && !B.entregasPorDia[noon(4).slice(0, 10)], B);
    t('a entrega arquivada é contada', A.arquivadasEntregues === 1 && B.arquivadasEntregues === 1, [A.arquivadasEntregues, B.arquivadasEntregues]);
    t('reabertura não vira entrega extra e fica registrada', A.reaberturasNasValidas === 1, A.reaberturasNasValidas);
    t('card aberto e card arquivado fora do fim não contam', r.cards.arquivados === 2 && r.cards.emColunaDeFim === 16, r.cards);
    t('cancelamento fica separado da entrega', C.cancelados === 1 && r.colunasDeFim.find(c => c.nome === 'Cancelado').contaComoEntrega === false, r.colunasDeFim);
    t('sem data, data inválida, carimbo do reset, agregador e duplicado são descartados', C.semData === 1 && C.dataInvalida === 1 && C.carimboDoReset === 1 && C.agregadores === 1 && C.duplicados === 1, C);
    t('importado, sem evento e criado no fim são descartados', A.descartes.importados === 1 && A.descartes.semEventoDeEntrega === 1 && A.descartes.criadosNoFim === 1, A.descartes);
    t('antes do corte e dia de hoje são descartados', A.descartes.antesDoCorte === 1 && A.descartes.diaDeHoje === 1, A.descartes);
    t('dias sem entrega entram como zero, começando depois do corte', A.janela.diasComparaveis === 19 && A.janela.diasSemEntrega === 19 - dias(A.entregasPorDia).length, A.janela);
    t('avisa que há dois cenários, que os pisos não foram atingidos e que a contagem foi zerada', r.alertas.some(a => a.includes('dois cenários')) && r.alertas.some(a => a.includes('pisos')) && r.alertas.some(a => a.includes('zerada')), r.alertas);
    const json = JSON.stringify(r);
    t('a saída não traz título, id de card ou pessoa', !/SEGREDO|PESSOA|ID-SECRETO|Ana ADM|ana@/.test(json), json.slice(0, 200));
    const escritas = await p.evaluate(() => window.__log.filter(l => ['set', 'update', 'remove', 'transaction'].includes(l[0])));
    t('não grava nada no banco', escritas.length === 0, escritas);
    t('sem erro de JS', !errs.length, errs);
    await ctx.close();
  } finally { await b.close(); srv.close(); }
  console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo.'); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
