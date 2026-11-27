// /monitorarbugs 27/11/2026 — menu lateral, Ilha (mare-ilha) e contadores. Rodar: python3 -m http.server 8952 --bind 127.0.0.1 → node docs/arezzo/testes/test_monitorar_2711.js
const fs = require('node:fs'), path = require('node:path'), home = require('node:os').homedir();
const fake = require('./fakefb.js');
const base = process.env.BASE_URL || 'http://127.0.0.1:8952';
const DBURL = 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
const PAU = { uid: 'pau', email: 'pau@ciahering.com.br', displayName: 'Paula', photoURL: '', providerData: [{ providerId: 'google.com' }] };
const ag = Date.now();
const seed = () => ({ kanban: {
  usuarios: { pau: { role: 'adm', squads: { dados: true }, oceano: { ilha: true, tema: 'abrolhos' } } }, config: { adm_emails: ['pau@ciahering.com.br'] },
  usuarios_publicos: { pau: { nome: 'Paula' } },
  timers_ativos: { pau: { tm0001: { sq: 'dados', cardId: 'c1', cardTitle: 'Banner', atividade: 'Revisar banner', tipo: 'cron', status: 'rodando', startedAt: ag - 65000, accMs: 0 } } },
  squads: { dados: { dados: { card_timers: { c1: { tm0001: { uid: 'pau', status: 'rodando', startedAt: ag - 65000, accMs: 0, atividade: 'Revisar banner' } } } } } },
  cardume: { canais: { dados: { nome: 'Dados' } }, membros: { dados: { pau: true } }, meus: { pau: { dados: true } }, msgs: { dados: { m1: { uid: 'pau', ts: ag - 6e4, texto: 'oi' } } } },
} });
let ok = true, total = 0;
const t = (n, c, d) => { total++; if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + String(JSON.stringify(d)).slice(0, 400))); };
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
  const cr = path.join(home, 'hering-tools/chrome');
  const chrome = process.env.CHROME || (fs.existsSync(cr) ? path.join(cr, fs.readdirSync(cr).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') : undefined);
  const b = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const abre = async (url, opts) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } }); await fake.install(ctx, seed(), opts);
    await ctx.addInitScript(() => { localStorage.setItem('oceano_prefs', JSON.stringify({ peixes: 'off' })); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + url); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(x => window.__authCb(x), PAU); await p.waitForTimeout(1500);
    return { ctx, p, errs };
  };

  // G) clique no painel da Ilha não pode se perder no redesenho de cada segundo
  { const { ctx, p, errs } = await abre('/cardume-dev.html?c=dados');
    await p.click('#ilha-slot .mi-main'); await p.waitForTimeout(200);
    const bx = await p.locator('.mi-painel .mi-tm button').boundingBox();
    await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2); await p.mouse.down(); await p.waitForTimeout(1200); await p.mouse.up(); await p.waitForTimeout(400);
    const st = await p.evaluate(() => window.__store.kanban.timers_ativos.pau.tm0001.status);
    t('G · apertar "Pausar" e soltar 1,2 s depois ainda pausa (o relógio não troca o botão embaixo do dedo)', st === 'pausado', st);
    t('sem erro na página', !errs.length, errs);
    await ctx.close(); }

  // J) Oceano não pode regravar a Ilha que a pessoa desligou em outro app
  { const { ctx, p, errs } = await abre('/oceano-dev.html', { oceano: true });
    // E) foco no menu: chega notificação (o menu redesenha) e o foco tem de continuar no mesmo ícone
    await p.focus('#rail [data-rail="okr"]');
    await p.evaluate(async u => { const m = await import(u); await m.set(m.ref(null, 'kanban/usuarios/pau/notificacoes/z1'), { type: 'okr_mencao', title: 'Menção no Radar', ts: new Date().toISOString(), read: false }); }, DBURL);
    await p.waitForTimeout(500);
    t('E · chega notificação enquanto o foco está num ícone do menu: o foco continua nele (e o número aparece)', await p.evaluate(() => document.activeElement && document.activeElement.dataset.rail === 'okr' && !!document.querySelector('#rail [data-rail="okr"] .rail-n')), await p.evaluate(() => document.activeElement && (document.activeElement.dataset.rail || document.activeElement.tagName)));
    await p.evaluate(async u => { const m = await import(u); await m.set(m.ref(null, 'kanban/usuarios/pau/oceano/ilha'), null); }, DBURL);   // desligou na Concha (outra aba)
    await p.click('#btn-eu'); await p.waitForTimeout(300);
    await p.click('#op-tema button[data-tema="lencois"]'); await p.waitForTimeout(900);   // muda o tema no Oceano
    const o = await p.evaluate(() => JSON.parse(JSON.stringify(window.__store.kanban.usuarios.pau.oceano)));
    t('J · mudar o tema no Oceano não religa a Ilha desligada em outro app', o.tema === 'lencois' && !o.ilha, o);
    t('sem erro na página', !errs.length, errs);
    await ctx.close(); }

  await b.close();
  console.log((ok ? '\n✅ ' : '\n❌ ') + total + ' verificações');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
