// 🔎 /monitorarbugs no Gantt (13/11/2026): reproduz os achados ANTES do fix e prova o fix depois.
// A) editar data-chave apagada por outra pessoa com o formulário aberto a RESSUSCITAVA como nova (autor trocado);
// B) excluir uma que já sumiu não dava retorno nenhum; C) balão de nome ficava por cima do card aberto pelo clique na barra;
// D) Painel: 2 .xlsx enviados em sequência — a leitura mais lenta (do 1º) sobrescrevia a prévia do 2º (publicava o arquivo errado).
// Servir a raiz em BASE_URL; node docs/arezzo/testes/test_gantt_monitorarbugs_1113.js   (KANBAN_HTML/PAINEL_HTML = outra versão)
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os'); const home = os.homedir();
const pwPath = process.env.PLAYWRIGHT_MODULE || (fs.existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const { chromium } = require(pwPath); const fake = require('./fakefb'); const X = require('./xlsx_sintetico');
function resolveChrome() { if (process.env.CHROME) return process.env.CHROME; if (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) return '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const r = path.join(home, 'hering-tools/chrome'); const arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-')); return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'); }
const base = process.env.BASE_URL || 'http://127.0.0.1:8949'; const SQ = 'site'; const FIXO = '2026-11-12T13:00:00';
const fl = col => ({ enteredAt: { [col]: '2026-10-20T12:00:00.000Z' }, log: [{ from: '—', to: col, at: '2026-10-20T12:00:00.000Z' }] });
const rota = async (ctx, arq, env) => { if (process.env[env]) { const html = fs.readFileSync(process.env[env], 'utf8'); await ctx.route(u => u.pathname.endsWith('/' + arq), r => r.fulfill({ status: 200, contentType: 'text/html', body: html })); } };

(async () => {
  const b = await chromium.launch({ executablePath: resolveChrome(), headless: true }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  // ── Maré
  { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await fake.install(ctx, { kanban: {
      usuarios: { po: { uid: 'po', nome: 'Paula PO', email: 'po@ciahering.com.br', inscrito: true, init: 'PP', role: 'membro', squads: { [SQ]: true }, squads_roles: { [SQ]: 'po' } } },
      usuarios_publicos: { po: { uid: 'po', nome: 'Paula PO', init: 'PP', squads: { [SQ]: true } } },
      squads: { [SQ]: { dados: { columns: [{ id: 'doing', name: 'Fazendo' }], tags: [], cards_index: { c1: 'k1' },
          cards: { k1: { id: 'c1', title: 'Campanha de fim de ano com um título comprido demais para caber', col: 'doing', owner: 'PP', createdAt: '2026-10-20', flow: fl('doing'), inicio: '2026-11-16', fim: '2026-11-18', updatedAt: '2026-10-27T10:00:00.000Z' } } },
        gantt_marcos_dev: { m1: { titulo: 'Black Friday', ini: '2026-11-27', fim: '2026-11-30', cor: 'red', porUid: 'outra', porNome: 'Outra Pessoa', em: 1 } } } } } });
    await rota(ctx, 'kanban-dev.html', 'KANBAN_HTML');
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(f => { const R = Date; const fixed = new R(f).getTime(); class D extends R { constructor(...a) { if (!a.length) super(fixed); else super(...a); } static now() { return fixed; } } window.Date = D; try { localStorage.clear(); } catch (e) {} }, FIXO);
    await p.goto(base + '/kanban-dev.html?squad=' + SQ); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(() => window.__authCb({ uid: 'po', email: 'po@ciahering.com.br', displayName: 'Paula PO', photoURL: '', providerData: [{ providerId: 'google.com' }] })); await p.waitForTimeout(2500);
    await p.evaluate(() => { document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')); toggleGanttView(); }); await p.waitForTimeout(300);
    // A) abre a edição, outra pessoa apaga, tenta salvar
    await p.click('.gantt-mc-chip[data-id="m1"]'); await p.waitForTimeout(150);
    await p.evaluate(() => { delete window.__store.kanban.squads.site.gantt_marcos_dev.m1; _ganttMc.squad = {}; });
    await p.fill('#gantt-mc-titulo', 'Black Friday editada'); await p.click('#gantt-mc-ok'); await p.waitForTimeout(300);
    const st = await p.evaluate(() => JSON.parse(JSON.stringify(window.__store.kanban.squads.site.gantt_marcos_dev || {})));
    t('A. salvar uma data-chave que outra pessoa apagou NÃO a recria (nem troca o autor) e avisa', !st.m1 && await p.evaluate(() => /excluída/.test(document.getElementById('gantt-mc-aviso').textContent)), { st, aviso: await p.evaluate(() => document.getElementById('gantt-mc-aviso').textContent) });
    if (await p.isVisible('#gantt-mc-del')) { await p.click('#gantt-mc-del'); await p.waitForTimeout(200); }   // na versão com o bug o formulário já fechou (ressuscitou)
    t('B. excluir a que já sumiu: avisa em vez de não fazer nada', await p.evaluate(() => /excluída/.test(document.getElementById('gantt-mc-aviso').textContent) || !document.getElementById('gantt-mc-ov').classList.contains('open')));
    await p.evaluate(() => { closeOv('gantt-mc-ov'); const u = document.getElementById('ui-modal-ov'); if (u) u.remove(); }); await p.waitForTimeout(200);
    // C) balão aberto → clique na barra abre o card: o balão some
    await p.mouse.move(2, 2); const bx = await p.locator('.gantt-bar[data-card-id="c1"]').boundingBox();
    await p.mouse.move(bx.x + 20, bx.y + bx.height / 2); await p.waitForTimeout(420);
    const antes = await p.evaluate(() => !!document.querySelector('#gantt-tip.on'));
    await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(400);
    t('C. clicar na barra (abre o card) fecha o balão — não fica por cima do card', antes && await p.evaluate(() => !document.querySelector('#gantt-tip.on')), { antes });
    t('C2. sem erro de JS no Maré', errs.length === 0, errs);
    await ctx.close(); }
  // ── Painel
  { const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gx-')); const arq = (n, abas) => { const f = path.join(tmp, n); fs.writeFileSync(f, X.xlsx(abas)); return f; };
    const LENTO = arq('lento-antigo.xlsx', [X.marca(2026, [{ r: 7, rot: 'WEB', barras: [['2026-11-01', '2026-11-10', 'ARQUIVO ANTIGO']] }])]);
    const RAPIDO = arq('rapido-novo.xlsx', [X.marca(2026, [{ r: 7, rot: 'WEB', barras: [['2026-11-01', '2026-11-10', 'ARQUIVO NOVO']] }])]);
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await fake.install(ctx, { kanban: { squads_meta: { dados: { id: 'dados', label: 'Dados', icon: '📊' } }, usuarios: { ana: { uid: 'ana', nome: 'Ana', email: 'ana@ciahering.com.br', inscrito: true, init: 'AA', role: 'adm', squads: { dados: true } } }, usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana', init: 'AA' } }, config: { adm_emails: ['ana@ciahering.com.br'] } } });
    await rota(ctx, 'painel-dev.html', 'PAINEL_HTML');
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/painel-dev.html'); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(() => window.__authCb({ uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana', photoURL: '', providerData: [{ providerId: 'google.com' }] })); await p.waitForTimeout(2500);
    await p.evaluate(() => { openCfg(SQUADS[0].id); }); await p.click('#pcfg-tab-gantt'); await p.waitForTimeout(400);
    // a leitura do 1º arquivo demora (planilha grande); a do 2º é rápida
    await p.evaluate(() => { const orig = GXL.ler; let n = 0; GXL.ler = async buf => { const r = await orig(buf); if (++n === 1) await new Promise(x => setTimeout(x, 700)); return r; }; });
    await p.setInputFiles('#pcfg-gantt-cards input[data-cal="marca"]', LENTO); await p.waitForTimeout(80);
    await p.setInputFiles('#pcfg-gantt-cards input[data-cal="marca"]', RAPIDO); await p.waitForTimeout(1200);
    const pv = await p.evaluate(() => (document.querySelector('.pg-card[data-cal="marca"] .pg-pv:not(.pg-pv-lendo)') || {}).innerText || '');
    t('D. dois arquivos em sequência: a prévia que fica é a do ÚLTIMO escolhido (não a da leitura que terminou por último)', /rapido-novo/.test(pv) && !/lento-antigo/.test(pv), pv.slice(0, 120));
    t('D2. sem erro de JS no Painel', errs.length === 0, errs);
    await ctx.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1);
})();
