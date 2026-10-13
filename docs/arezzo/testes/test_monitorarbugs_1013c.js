// /monitorarbugs (13/10, 3ª rodada — Intake). (1) Painel → ⚙ Config do board gravava `agil_cfg` com set() de um objeto novo: apagava
// `intakeEnabled` (pedidos desligados pelo PO voltavam a ser aceitos pelo link público!), `intakeCampos` e `bfBannerMsg`.
// (2) Pedido interno aceitava prazo desejado no passado (o formulário é novalidate, o `min` do campo não barra).
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana ADM', photoURL: '', providerData: [{ providerId: 'google.com' }] };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + JSON.stringify(d).slice(0, 300))); };
  const store = (p, path) => p.evaluate(pa => { let o = window.__store; pa.split('/').forEach(k => { o = o == null ? o : o[k]; }); return o == null ? null : JSON.parse(JSON.stringify(o)); }, path);
  const cfg = { sprintNum: '3', sprintDays: '14', wip: '3', capacity: '80', intakeEnabled: false, bfBannerMsg: 'Bora BF!', intakeCampos: { tags: { on: true, req: false }, prazo: { on: true, req: true } } };
  { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await fake.install(ctx, { kanban: { usuarios: { ana: { uid: 'ana', nome: 'Ana ADM', email: 'ana@ciahering.com.br', inscrito: true, init: 'AA', role: 'adm', squads: { dados: true } } }, usuarios_publicos: { ana: { uid: 'ana', nome: 'Ana ADM', init: 'AA' } }, config: { adm_emails: ['ana@ciahering.com.br'] }, squads: { dados: { dados: { agil_cfg: cfg } } } } });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8941/painel-dev.html'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(2500);
    await p.evaluate(() => { cfgSquadId = 'dados'; document.getElementById('cfg-sprint-num').value = '4'; document.getElementById('cfg-wip').value = '5'; saveCfg(); }); await p.waitForTimeout(500);
    const a = await store(p, 'kanban/squads/dados/dados/agil_cfg');
    t('o que o Painel edita mudou (sprint 4, WIP 5)', a && a.sprintNum === '4' && a.wip === '5', a);
    t('os pedidos desligados pelo PO CONTINUAM desligados (intakeEnabled:false)', a && a.intakeEnabled === false, a);
    t('os campos do pedido interno escolhidos pelo PO continuam (intakeCampos)', a && a.intakeCampos && a.intakeCampos.prazo && a.intakeCampos.prazo.req === true, a);
    t('o aviso da Black Friday continua (bfBannerMsg)', a && a.bfBannerMsg === 'Bora BF!', a);
    t('sem erro de JS (Painel)', !errs.length, errs); await ctx.close(); }
  { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const G = { uid: 'eve', email: 'eve@ciahering.com.br', displayName: 'Eve Souza', photoURL: '', providerData: [{ providerId: 'google.com' }] };
    await fake.install(ctx, { kanban: { squads_meta: { dev: { label: 'Dev', emoji: '🧪' } }, squads: { dev: { dados: { agil_cfg: { intakeEnabled: true } } } } } });
    const p = await ctx.newPage(); await p.goto('http://localhost:8941/intake-dev.html?squad=dev'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), G); await p.waitForSelector('#intake-int', { state: 'visible' });
    await p.fill('#i-titulo', 'Banner'); await p.fill('#i-descricao', 'Detalhes'); await p.selectOption('#i-sqdem-sel', 'App'); await p.fill('#i-prazo', '2020-01-01');
    await p.click('#i-submit'); await p.waitForTimeout(600);
    t('prazo desejado no passado é recusado com aviso (e nada é gravado)', /prazo/i.test(await p.textContent('#msg')) && !(await store(p, 'kanban/squads/dev/dados/intake_pending')), await p.textContent('#msg'));
    await p.fill('#i-prazo', ''); await p.click('#i-submit'); await p.waitForTimeout(600);
    t('sem prazo, o pedido segue normalmente', !!(await store(p, 'kanban/squads/dev/dados/intake_pending')), 0);
    await ctx.close(); }
  console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); await b.close(); process.exit(ok ? 0 : 1);
})();
