// 🏝️ Ilha Dinâmica — 12/11/2026 (pedido do Caio): (1) padrão "sempre visível" (antes "só com ação": a pessoa ligava, via a introdução e a pílula
// sumia por não haver nada acontecendo); quem já tinha ligado com o padrão antigo passa a "sempre" uma vez; a introdução explica e deixa escolher.
// (2) o painel aberto usa a altura da tela: o Resumo com todos os módulos cabe sem rolagem em 1280×1000.
// Rodar: python3 -m http.server 8961 --directory . (na raiz) e `node docs/arezzo/testes/test_ilha_sempre.js` (BASE_URL troca o servidor).
const fs = require('fs'), path = require('path'), home = require('os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const cr = path.join(home, 'hering-tools/chrome'), chrome = process.env.CHROME || path.join(cr, fs.readdirSync(cr).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8961', out = path.join(__dirname, '..', '..', 'capturas', 'ilha-sempre');
const U = { uid: 'eve', email: 'eve@ciahering.com.br', displayName: 'Eve Martins', photoURL: '', providerData: [{ providerId: 'google.com' }] };
// sem timer e sem notificação: no modo antigo ("só com ação") a pílula ficaria oculta
const seed = () => ({ kanban: {
  usuarios: { eve: { uid: 'eve', nome: 'Eve Martins', email: U.email, init: 'EM', role: 'adm', inscrito: true, squads: { site: true } } },
  usuarios_publicos: { eve: { uid: 'eve', nome: 'Eve Martins', init: 'EM' } }, config: { adm_emails: ['eve@ciahering.com.br'] },
  squads_meta: { site: { label: 'Squad Site' } },
  squads: { site: { dados: { columns: [{ id: 'doing', name: 'Fazendo' }], cards_index: { c1: 'k1' }, cards: { k1: { id: 'c1', title: 'Banner', col: 'doing' } } } } },
  vtex_saude: { ok: true, ultimoOkEm: new Date().toISOString(), abertos: 0, incidentes: [] }, github_saude: { ok: true, ultimoOkEm: new Date().toISOString(), abertos: 0, incidentes: [] }, firebase_saude: { ok: true, ultimoOkEm: new Date().toISOString(), abertos: 0, incidentes: [] },
  okr: { objetivos: { o1: { id: 'o1', torre: 'digital', titulo: 'Meta', responsaveis: ['eve'] } }, calendario: { eventos: {} } } } });
(async () => {
  const b = await chromium.launch({ executablePath: chrome }); let n = 0, f = 0;
  const t = (nome, ok, d) => { n++; if (!ok) f++; console.log((ok ? '✅ ' : '❌ ') + nome + (ok ? '' : ' → ' + String(JSON.stringify(d)).slice(0, 300))); };
  fs.mkdirSync(out, { recursive: true });
  const abrir = async (w, h, prefs) => { const ctx = await b.newContext({ viewport: { width: w, height: h } }); await fake.install(ctx, seed()); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/kanban-dev.html?squad=site'); await p.waitForFunction(() => !!window.__authCb);
    if (prefs) await p.evaluate(v => localStorage.setItem('mare_ilha_eve_dev', JSON.stringify(v)), prefs);
    await p.evaluate(u => window.__authCb(u), U); await p.waitForTimeout(3500);
    await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open'))); return { ctx, p, errs }; };
  const estado = p => p.evaluate(() => document.getElementById('ilha').dataset.estado);

  // 1) pessoa nova: liga pelas preferências, passa pela introdução e a pílula continua lá
  { const { ctx, p, errs } = await abrir(1280, 1000);
    t('padrão novo: "sempre visível"', await p.evaluate(() => _ilhaPrefs().modo === 'sempre'));
    await p.evaluate(() => openMinhasPrefs()); await p.waitForTimeout(300); await p.click('#ilha-ligar'); await p.waitForTimeout(300);
    await p.click('[data-ii="proximo"]'); await p.waitForTimeout(150);
    t('introdução (passo 2) diz que o padrão é sempre visível e que dá para escolher', /sempre visível<\/b> \(padrão\)/.test(await p.locator('.ii-caixa').innerHTML()) && /próximo passo/.test(await p.locator('.ii-caixa').innerText()));
    await p.click('[data-ii="proximo"]'); await p.waitForTimeout(150); await p.click('[data-ii="proximo"]'); await p.waitForTimeout(150);
    const r = await p.evaluate(() => [...document.querySelectorAll('[data-ii-modo]')].map(i => [i.value, i.checked]));
    t('passo 4: escolha "Quando a pílula aparece" com Sempre marcado', r.length === 3 && r.find(x => x[0] === 'sempre')[1], r);
    await p.locator('[data-ii="proximo"]').click(); await p.waitForTimeout(150);
    await p.locator('[data-ii="proximo"]').click().catch(() => {}); await p.waitForTimeout(400);
    await p.evaluate(() => { const o = document.getElementById('ilha-intro'); if (o && o.classList.contains('open')) _ilhaIntroFechar(true); }); await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open'))); await p.waitForTimeout(400);
    const e = await estado(p);
    t('depois da introdução, sem nada acontecendo, a ilha continua visível (não oculta)', ['repouso', 'aberta'].includes(e) && await p.locator('#ilha-btn').isVisible(), e);
    // 2) painel aberto: Resumo inteiro sem rolagem
    await p.evaluate(() => { const pp = _ilhaPrefs(); window.__ilhaMods().forEach(m => { pp.mods[m.id] = true; }); _ilhaSalvar(); _ilhaRender(); }); await p.waitForTimeout(300);
    if ((await estado(p)) !== 'aberta') await p.click('#ilha-btn'); await p.waitForTimeout(600);
    await p.evaluate(() => { _ilha.abaAtual = 'resumo'; _ilhaPainel(); }); await p.waitForTimeout(300);
    const sc = await p.evaluate(() => { const c = [...document.querySelectorAll('#ilha-painel *')].filter(el => { const s = getComputedStyle(el); return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 2; }); const r = document.querySelector('.ilha-centro').getBoundingClientRect(); return { rolam: c.map(x => x.className), base: Math.round(r.bottom), tiles: document.querySelectorAll('.ilha-tile').length }; });
    t('1280×1000: o Resumo com todos os módulos cabe sem rolagem e dentro da tela', sc.rolam.length === 0 && sc.base <= 1000 && sc.tiles >= 6, sc);
    await p.screenshot({ path: path.join(out, 'resumo-1280x1000.png') });
    t('sem erro de JS', !errs.length, errs); await ctx.close(); }
  // 3) tela baixa: rola dentro do painel em vez de sair da tela
  { const { ctx, p } = await abrir(1280, 640, { on: true, introVista: true, ux: 3, modo: 'sempre', mods: { agenda: true, agente: true, status: true, fav: true, op: true } });
    await p.click('#ilha-btn'); await p.waitForTimeout(600);
    const r = await p.evaluate(() => Math.round(document.querySelector('.ilha-centro').getBoundingClientRect().bottom));
    t('1280×640: o painel não passa do fim da tela (rola por dentro)', r > 0 && r <= 640, r); await ctx.close(); }
  // 4) migração: quem ligou ontem com o padrão antigo passa a "sempre"; quem já escolheu depois da mudança fica como escolheu
  { const { ctx, p } = await abrir(1280, 900, { on: true, introVista: true, ux: 2, modo: 'acao' });
    t('migração: "só com ação" (padrão antigo, ux 2) vira "sempre" uma vez', await p.evaluate(() => _ilhaPrefs().modo === 'sempre' && JSON.parse(localStorage.getItem('mare_ilha_eve_dev')).ux === 3) && (await estado(p)) === 'repouso'); await ctx.close(); }
  { const { ctx, p } = await abrir(1280, 900, { on: true, introVista: true, ux: 3, modo: 'acao' });
    t('escolha feita depois da mudança (ux 3) é respeitada: continua "só com ação" e a pílula some sem ação', await p.evaluate(() => _ilhaPrefs().modo === 'acao') && (await estado(p)) === 'oculta'); await ctx.close(); }
  { const { ctx, p } = await abrir(1280, 900, { on: true, introVista: true, modo: 'mouse' });
    t('quem escolheu "ao passar o mouse" não é mexido', await p.evaluate(() => _ilhaPrefs().modo === 'mouse')); await ctx.close(); }
  await b.close(); console.log(`\n${n - f}/${n} ok`); process.exit(f ? 1 : 0);
})();
