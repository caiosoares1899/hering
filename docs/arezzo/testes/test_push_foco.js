// 🪟 Push com a página VISÍVEL mas SEM FOCO (reunião: Maré no 2º monitor, foco no Meet) → além do toast, a página mostra o aviso do sistema
// (MareNotif.avisoSistema em mare-notif-dev.js). Com foco: só o toast. Roda o boot real do Maré/Oceano com o Firebase falso.
// Uso:  node docs/arezzo/testes/test_push_foco.js     (SUF= testa a prod depois da promoção)
const fs = require('fs');
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const SUF = process.env.SUF === undefined ? '-dev' : process.env.SUF;
const U = { uid: 'ana', email: 'ana@ciahering.com.br', displayName: 'Ana', photoURL: '', providerData: [{ providerId: 'google.com' }] };
let ok = true; const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + (JSON.stringify(d === undefined ? null : d) || '').slice(0, 300))); };
const seed = { kanban: { usuarios: { ana: { uid: 'ana', nome: 'Ana', email: 'ana@ciahering.com.br', inscrito: true, init: 'AN', role: 'membro', squads: { dev: true } } }, usuarios_publicos: {}, config: { adm_emails: [] }, squads_meta: {}, squads: { dev: { cards: {} } }, comunicados: {} } };
const SITE = 'https://caiosoares1899.github.io/hering/';
const payload = (o) => ({ data: Object.assign({ title: '🤖 Agente Ágil respondeu sua menção', body: 'Resumo do card…', tag: 'mention_c1', url: SITE + 'kanban.html?card=c1', cardId: 'c1' }, o || {}) });

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const abre = async (pagina) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8941/' + pagina + SUF + '.html' + (pagina === 'kanban' ? '?squad=dev' : '')); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(1500);
    await p.evaluate(() => {   // stubs: permissão, foco e o service worker (captura o que seria mostrado)
      window.__avisos = []; window.__perm = 'granted'; window.__foco = false;
      Object.defineProperty(Notification, 'permission', { get: () => window.__perm, configurable: true });
      document.hasFocus = () => window.__foco;
      Object.defineProperty(navigator, 'serviceWorker', { value: { ready: Promise.resolve({ showNotification: (titulo, o) => { window.__avisos.push({ titulo, o }); return Promise.resolve(); } }) }, configurable: true });
    });
    return { ctx, p, errs };
  };
  const chama = (p, pl) => p.evaluate(pl2 => { const r = MareNotif.avisoSistema(pl2); return r; }, pl);
  const avisos = (p) => p.evaluate(() => window.__avisos);

  for (const pagina of ['kanban', 'oceano']) {
    const { ctx, p, errs } = await abre(pagina);
    await chama(p, payload()); await p.waitForTimeout(200);
    let a = await avisos(p);
    t(`${pagina}: janela SEM foco → mostra o aviso do sistema com título, texto, tag e link do push`, a.length === 1 && a[0].titulo === '🤖 Agente Ágil respondeu sua menção' && a[0].o.body === 'Resumo do card…' && a[0].o.tag === 'mention_c1' && a[0].o.data.url === SITE + 'kanban.html?card=c1' && /marinheiro\.png$/.test(a[0].o.icon), a);
    await p.evaluate(() => { window.__avisos = []; window.__foco = true; });
    const r2 = await chama(p, payload()); await p.waitForTimeout(150);
    t(`${pagina}: janela COM foco → só o toast (nenhum aviso do sistema)`, r2 === false && (await avisos(p)).length === 0);
    await p.evaluate(() => { window.__foco = false; window.__perm = 'default'; });
    const r3 = await chama(p, payload()); await p.waitForTimeout(150);
    t(`${pagina}: sem permissão de notificação → não mostra`, r3 === false && (await avisos(p)).length === 0);
    await p.evaluate(() => { window.__perm = 'granted'; });
    await chama(p, payload({ url: 'https://evil.example/phish' })); await p.waitForTimeout(150);
    a = await avisos(p);
    t(`${pagina}: link de fora do site é trocado pelo do Maré (o clique nunca abre endereço alheio)`, a.length === 1 && a[0].o.data.url === SITE + 'kanban.html', a);
    await p.evaluate(() => { window.__avisos = []; });
    await chama(p, { notification: { title: 'Só notification', body: 'corpo' } }); await p.waitForTimeout(150);
    a = await avisos(p);
    t(`${pagina}: payload só com "notification" também funciona (título/corpo, tag padrão)`, a.length === 1 && a[0].titulo === 'Só notification' && a[0].o.body === 'corpo' && a[0].o.tag === 'mare-digital-notif', a);
    t(`${pagina}: sem erro de JS`, !errs.length, errs);
    await ctx.close();
  }

  // o gancho do módulo: quando chega o push na página, toast + aviso (sem foco)
  { const { ctx, p } = await abre('oceano');
    await p.evaluate(() => { window.__avisos = []; window.__cb = null; window._fcmOnMessage = (cb) => { window.__cb = cb; }; });
    await p.evaluate(() => { const st = MareNotif._estado(); MareNotif.rodapeRender(); });
    await p.waitForTimeout(200);
    const tem = await p.evaluate(() => !!window.__cb);
    if (tem) {
      await p.evaluate((pl) => window.__cb(pl), payload()); await p.waitForTimeout(200);
      t('gancho do módulo: push na página sem foco vira aviso do sistema', (await avisos(p)).length === 1);
    } else console.log('ℹ️ gancho do módulo já estava ligado nesta página (pula o cenário do callback)');
    await ctx.close(); }

  // o Maré liga o mesmo aviso no ouvinte próprio
  const src = fs.readFileSync(__dirname + '/../../../kanban' + SUF + '.html', 'utf8');
  t('Maré: o ouvinte do push chama MareNotif.avisoSistema', /_fcmOnMessage\(payload=>\{[^}]*MareNotif\.avisoSistema\(payload\)/.test(src));
  const mod = fs.readFileSync(__dirname + '/../../../mare-notif' + SUF + '.js', 'utf8');
  t('módulo do sino: o ouvinte do push mostra o toast E chama avisoSistema', /_fcmOnMessage\(p=>\{ toast\([^;]*;\s*avisoSistema\(p\); \}\)/.test(mod));
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1);
})();
