// 📝 18/11/2026 (Monitor do Painel: "Failed to set the 'innerHTML' property on 'Element': The node to be removed is no longer
// a child of this node. Perhaps it was moved in a 'blur' event handler?" em renderNotaEditor/_renderNotasCurrentView).
// Causa: redesenhar o editor com um bloco em edição remove o textarea focado → o Chrome dispara o blur NA HORA → onBlocoBlur()
// redesenha de novo por dentro → o innerHTML de fora estoura. Este teste redesenha com o bloco focado (o que um snapshot do
// Firebase faz) e confere: sem erro na página, o campo continua focado e o que foi digitado continua lá.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(os.homedir(), 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const ROOT = path.resolve(__dirname, '../../..');
function chrome() { if (process.env.CHROME) return process.env.CHROME; const r = path.join(os.homedir(), 'hering-tools/chrome'), arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-')); return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'); }
const user = { uid: 'ad', email: 'adrian@ciahering.com.br', displayName: 'Adrian Teste', providerData: [{ providerId: 'google.com' }] };
const nota = modo => ({ n1: { id: 'n1', titulo: 'Nota teste', modo, criadoEm: '2026-11-18T10:00:00.000Z',
  blocos: { b1: { id: 'b1', texto: 'primeiro', ordem: 0 }, b2: { id: 'b2', texto: 'segundo', ordem: 1 } } } });
const seed = modo => ({ kanban: {
  usuarios: { ad: { nome: 'Adrian Teste', email: user.email, init: 'AD', role: 'membro', inscrito: true, squads: { site: true } } },
  usuarios_publicos: { ad: { nome: 'Adrian Teste', init: 'AD', role: 'membro', inscrito: true, squads: { site: true } } },
  config: { adm_emails: [] },
  squads: { site: { dados: { columns: [{ id: 'todo', name: 'To Do' }], cards_index: {}, cards: {}, notas_pessoais: { ad: nota(modo) } } } } } });
const tipos = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (process.env.KANBAN_HTML && /kanban-dev\.html$/.test(f)) f = process.env.KANBAN_HTML;
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': tipos[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let falhas = 0; const t = (n, ok, d) => { if (!ok) falhas++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
(async () => {
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok)); const BASE = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch({ executablePath: chrome(), headless: true });
  try {
    for (const modo of ['estruturado', 'livre']) {
      const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed(modo === 'livre' ? 'livre' : undefined));
      await ctx.addInitScript(() => { try { localStorage.setItem('mare_guia_mare_visto', '1'); localStorage.setItem('mare_dicas_off', '1'); localStorage.setItem('bvmd_ad', '1'); } catch (e) {} });
      const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.goto(BASE + '/kanban-dev.html?squad=site'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(u => window.__authCb(u), user);
      await p.waitForTimeout(2500); await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')));
      await p.evaluate(() => { toggleNotas(); }); await p.waitForTimeout(600);
      await p.evaluate(() => { openNota('n1'); focarBloco('b1'); }); await p.waitForTimeout(200);
      await p.keyboard.type(' digitado');
      errs.length = 0;
      // o que um snapshot do Firebase (eco do próprio salvamento ou edição do colega) faz enquanto a pessoa digita
      const r = await p.evaluate(() => { let erro = null; try { _renderNotasCurrentView(); _renderNotasCurrentView(); } catch (e) { erro = e.message; }
        const el = document.activeElement; return { erro, focoId: el && el.id, valor: el && el.value }; });
      await p.waitForTimeout(300);
      t(`[${modo}] redesenhar com o bloco em edição não estoura`, !r.erro && !errs.length, { r, errs });
      t(`[${modo}] o campo continua focado`, r.focoId === 'nb-ta-b1', r.focoId);
      t(`[${modo}] o que foi digitado continua no campo`, String(r.valor || '').includes('digitado'), r.valor);
      // sair do campo de verdade continua voltando o bloco para a visualização
      await p.evaluate(() => document.getElementById('nb-ta-b1')?.blur()); await p.waitForTimeout(200);
      t(`[${modo}] sair do campo volta o bloco para a visualização`, await p.evaluate(() => !document.getElementById('nb-ta-b1')), '');
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo.'); process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
