// 🏖️ Férias F2 (13/11/2026): módulo mare-ferias-dev.js + vista 🏖️ Férias no Maré e no Radar.
// Servir a raiz em BASE_URL (padrão http://127.0.0.1:8951); node docs/arezzo/testes/test_ferias_calendario.js
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const home = require('node:os').homedir();
const pwPath = process.env.PLAYWRIGHT_MODULE || (fs.existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const { chromium } = require(pwPath);
const fake = require('./fakefb');

function resolveChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  if (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) return '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const r = path.join(home, 'hering-tools/chrome');
  const arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-'));
  return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
}

const ROOT = path.resolve(__dirname, '../../..');
const cap = process.env.CAPTURE_DIR || '';
const FIXO = '2026-11-13T15:00:00-03:00'; // 15:00 SP

const ANA = { uid: 'ana', nome: 'Ana Teste', email: 'ana@ciahering.com.br', init: 'AT', role: 'membro', squads: { dados: true } };
const BIA = { uid: 'bia', nome: 'Bia Outra', email: 'bia@ciahering.com.br', init: 'BO', role: 'membro', squads: { prf: true } };
const PO  = { uid: 'po1', nome: 'Paulo PO',  email: 'po@ciahering.com.br',  init: 'PP', role: 'po',     squads: { dados: true } };
const ADM = { uid: 'adm', nome: 'Alice ADM', email: 'adm@ciahering.com.br', init: 'AA', role: 'adm',    squads: { dados: true } };
const AL  = { uid: 'al1', nome: 'Lista Adm', email: 'lista@ciahering.com.br', init: 'LA', role: 'membro', squads: { dados: true } };
const VIS = { uid: 'vis1', nome: 'Visitante', email: 'visita@gmail.com',    init: 'VS', role: 'membro', prov: 'password' };

const seed = () => ({
  kanban: {
    okr: { objetivos: {}, marcos: {}, tags: {} },
    config: { adm_emails: ['lista@ciahering.com.br', 'adm@ciahering.com.br'] },
    painel_viewers: { 'visita@gmail,com': true },
    squads_meta: {
      dados: { label: 'Squad Dados e IA', emoji: '📊', active: true },
      prf: { label: 'Marketing de Performance', emoji: '📱', active: true },
    },
    squads: {
      dados: { meta: { label: 'Squad Dados e IA' }, dados: { columns: [{ id: 'c1', title: 'A fazer' }], cards: [] } },
      prf: { meta: { label: 'Marketing de Performance' }, dados: { columns: [{ id: 'c1', title: 'A fazer' }], cards: [] } },
    },
    usuarios: {
      ana: Object.assign({ inscrito: true }, ANA),
      bia: Object.assign({ inscrito: true }, BIA),
      po1: Object.assign({ inscrito: true }, PO),
      adm: Object.assign({ inscrito: true }, ADM),
      al1: Object.assign({ inscrito: true }, AL),
    },
    usuarios_publicos: {
      ana: { uid: 'ana', nome: ANA.nome, init: ANA.init, role: ANA.role, squads: ANA.squads },
      bia: { uid: 'bia', nome: BIA.nome, init: BIA.init, role: BIA.role, squads: BIA.squads },
      po1: { uid: 'po1', nome: PO.nome,  init: PO.init,  role: PO.role,  squads: PO.squads },
      adm: { uid: 'adm', nome: ADM.nome, init: ADM.init, role: ADM.role, squads: ADM.squads },
      al1: { uid: 'al1', nome: AL.nome,  init: AL.init,  role: AL.role,  squads: AL.squads },
    },
    ferias_dev: {
      bia: {
        f1: { ini: '2026-11-10', fim: '2026-11-20', obs: '<img src=x onerror=window.__xss=1>Cobertura: Ana', em: 1790000000000, por: 'bia' },
      },
      po1: {
        f2: { ini: '2026-11-25', fim: '2026-12-02', obs: 'Viagem', em: 1790000000000, por: 'po1' },
      },
    },
  },
});

function startServer() {
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.mp3': 'audio/mpeg' };
  const srv = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const fp = path.join(ROOT, urlPath === '/' ? 'okr-dev.html' : urlPath);
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(fp)] || 'application/octet-stream' });
    fs.createReadStream(fp).pipe(res);
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok({ srv, base: 'http://127.0.0.1:' + srv.address().port })));
}

(async () => {
  const { srv, base } = await startServer();
  const b = await chromium.launch({ executablePath: resolveChrome(), headless: true });
  let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d ?? null).slice(0, 400))); };

  const abre = async (pagePath, vp, user, tema) => {
    const ctx = await b.newContext({ viewport: vp, hasTouch: vp.width < 1000, isMobile: vp.width < 1000 });
    await fake.install(ctx, seed());
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(([f, tm]) => {
      const R = Date; const fixed = new R(f).getTime();
      class D extends R { constructor(...a) { if (!a.length) super(fixed); else super(...a); } static now() { return fixed; } }
      window.Date = D;
      try { localStorage.clear(); if (tm) localStorage.setItem('theme', tm); } catch (e) {}
    }, [FIXO, tema || '']);
    await p.goto(base + pagePath);
    await p.waitForFunction(() => !!window.__authCb);
    const u = user || ANA;
    await p.evaluate(x => window.__authCb(x), { uid: u.uid, email: u.email, displayName: u.nome, photoURL: '', providerData: [{ providerId: u.prov || 'google.com' }] });
    await p.waitForTimeout(2600);
    if (tema) await p.evaluate(tm => { if (tm === 'dark') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', tm); }, tema);
    return { ctx, p, errs };
  };

  // 1. Radar (okr-dev.html): membro comum (Ana) — cadastro, edição, exclusão, fim<ini, >45d, XSS, API ausente(init vs uid), botão sair desabilitado
  {
    const { ctx, p, errs } = await abre('/okr-dev.html', { width: 1280, height: 900 }, ANA);
    await p.evaluate(() => { _okrSetView('calendario'); _okrCalSetVista('ferias'); });
    await p.waitForSelector('#okr-ferias-host .mfer', { timeout: 6000 });

    const foraTxt = await p.textContent('#okr-ferias-host');
    t('A. Radar: vista 🏖️ Férias abre, mostra "Fora agora" (Bia) e "Próximas (60 dias)" (Paulo PO)', /Bia Outra/.test(foraTxt) && /Paulo PO/.test(foraTxt), foraTxt.slice(0, 300));
    t('B. XSS: obs com <img onerror> aparece como texto, sem executar', await p.evaluate(() => !window.__xss && !document.querySelector('#okr-ferias-host img') && /<img src=x/.test(document.getElementById('okr-ferias-host').innerText)));
    t('C. API: MareFerias.ausente("BO", "2026-11-13") === ausente("bia", "2026-11-13")', await p.evaluate(() => {
      const a = MareFerias.ausente('BO', '2026-11-13'), b = MareFerias.ausente('bia', '2026-11-13');
      return !!a && !!b && a.uid === 'bia' && a.ini === b.ini && a.fim === b.fim;
    }));
    t('D. Botão 🧳 Preparar minha saída existe e está desabilitado (F4)', await p.evaluate(() => {
      const btn = [...document.querySelectorAll('#okr-ferias-host button')].find(x => /Preparar minha saída/.test(x.textContent));
      return !!btn && btn.disabled && /breve/i.test(btn.title);
    }));
    t('E. Membro comum não vê botão de editar/excluir nas férias de outra pessoa', await p.evaluate(() => {
      const acts = [...document.querySelectorAll('#okr-ferias-host [data-act="edit"], #okr-ferias-host [data-act="del"]')];
      return acts.every(a => a.dataset.uid === 'ana');
    }));

    // fim < ini recusado
    await p.fill('#okr-ferias-host [data-f="ini"]', '2026-12-10');
    await p.fill('#okr-ferias-host [data-f="fim"]', '2026-12-05');
    await p.click('#okr-ferias-host [data-act="salvar"]');
    await p.waitForTimeout(150);
    t('F. fim < ini é recusado na tela', /não pode ser anterior/i.test(await p.textContent('#okr-ferias-host .mfer-msg.err')));

    // > 45 dias avisa mas salva
    await p.fill('#okr-ferias-host [data-f="ini"]', '2026-11-13');
    await p.fill('#okr-ferias-host [data-f="fim"]', '2027-01-10');
    await p.fill('#okr-ferias-host [data-f="obs"]', 'Licença longa');
    await p.click('#okr-ferias-host [data-act="salvar"]');
    await p.waitForTimeout(200);
    t('G. Período > 45 dias salva e mostra aviso', /acima de 45 dias/i.test(await p.textContent('#okr-ferias-host .mfer-msg.warn')) && await p.evaluate(() => !!MareFerias.ausente('ana', '2026-11-13')));

    // editar e excluir
    await p.click('#okr-ferias-host [data-act="edit"][data-uid="ana"]');
    await p.fill('#okr-ferias-host [data-f="fim"]', '2026-11-18');
    await p.click('#okr-ferias-host [data-act="salvar"]');
    await p.waitForTimeout(200);
    t('H. Editar período próprio funciona', await p.evaluate(() => MareFerias.periodoDe('ana')?.fim === '2026-11-18'));

    await p.click('#okr-ferias-host [data-act="del"][data-uid="ana"]');
    await p.waitForTimeout(150);
    t('I0. Excluir pede confirmação (nada apagado antes)', await p.evaluate(() => MareFerias.periodoDe('ana') !== null) && await p.locator('#_uimp-ok').count() === 1);
    await p.click('#_uimp-cancel'); await p.waitForTimeout(150);
    t('I1. Cancelar mantém o período', await p.evaluate(() => MareFerias.periodoDe('ana') !== null));
    await p.click('#okr-ferias-host [data-act="del"][data-uid="ana"]');
    await p.waitForTimeout(150); await p.click('#_uimp-ok');
    await p.waitForTimeout(200);
    t('I. Excluir período próprio funciona', await p.evaluate(() => MareFerias.periodoDe('ana') === null));

    // filtros pessoa / squad
    await p.selectOption('#okr-ferias-host [data-filtro="squad"]', 'prf');
    await p.waitForTimeout(100);
    t('J. Filtro por squad mostra Bia (prf) e esconde Paulo (dados)', await p.evaluate(() => {
      const tx = document.getElementById('okr-ferias-host').innerText;
      return /Bia Outra/.test(tx) && !/Paulo PO/.test(tx);
    }));
    await p.selectOption('#okr-ferias-host [data-filtro="squad"]', '');
    await p.fill('#okr-ferias-host [data-filtro="pessoa"]', 'Paulo');
    await p.waitForTimeout(100);
    t('K. Filtro por pessoa funciona', await p.evaluate(() => {
      const tx = document.getElementById('okr-ferias-host').innerText;
      return /Paulo PO/.test(tx) && !/Bia Outra/.test(tx);
    }));

    if (cap) { fs.mkdirSync(cap, { recursive: true }); await p.fill('#okr-ferias-host [data-filtro="pessoa"]', ''); await p.waitForTimeout(100); await p.screenshot({ path: path.join(cap, 'radar_ferias_1280.png') }); }
    t('L. Sem erro JS (Radar desktop)', errs.length === 0, errs);
    await ctx.close();
  }

  // 2. PO e "ADM só de config.adm_emails" NÃO editam férias dos outros; ADM real (role==='adm') corrige de outra pessoa
  {
    const { ctx, p } = await abre('/okr-dev.html', { width: 1280, height: 900 }, PO);
    await p.evaluate(() => { _okrSetView('calendario'); _okrCalSetVista('ferias'); });
    await p.waitForSelector('#okr-ferias-host .mfer', { timeout: 6000 });
    t('M. PO não vê seletor de pessoa nem botão de editar férias da Bia', await p.evaluate(() => !document.querySelector('#okr-ferias-host [data-f="alvo"]') && !document.querySelector('#okr-ferias-host [data-act="edit"][data-uid="bia"]')));
    await ctx.close();
  }
  {
    const { ctx, p } = await abre('/okr-dev.html', { width: 1280, height: 900 }, AL);
    await p.evaluate(() => { _okrSetView('calendario'); _okrCalSetVista('ferias'); });
    await p.waitForSelector('#okr-ferias-host .mfer', { timeout: 6000 });
    t('N. Usuário só em config.adm_emails (Armadilha 9) NÃO vê controles de ADM', await p.evaluate(() => !document.querySelector('#okr-ferias-host [data-f="alvo"]') && !document.querySelector('#okr-ferias-host [data-act="edit"][data-uid="bia"]')));
    await ctx.close();
  }
  {
    const { ctx, p } = await abre('/okr-dev.html', { width: 1280, height: 900 }, ADM);
    await p.evaluate(() => { _okrSetView('calendario'); _okrCalSetVista('ferias'); });
    await p.waitForSelector('#okr-ferias-host .mfer', { timeout: 6000 });
    await p.click('#okr-ferias-host [data-act="edit"][data-uid="bia"]');
    await p.fill('#okr-ferias-host [data-f="fim"]', '2026-11-22');
    await p.click('#okr-ferias-host [data-act="salvar"]');
    await p.waitForTimeout(200);
    t('O. ADM (role === "adm") corrige férias de outra pessoa', await p.evaluate(() => MareFerias.ausente('bia', '2026-11-22') !== null));
    await ctx.close();
  }

  // 3. Visualizador externo NÃO vê a vista 🏖️ Férias
  {
    const { ctx, p, errs } = await abre('/okr-dev.html', { width: 1280, height: 900 }, VIS);
    await p.evaluate(() => { _okrSetView('calendario'); });
    await p.waitForTimeout(300);
    t('P. Visualizador externo não vê botão 🏖️ Férias', await p.evaluate(() => ![...document.querySelectorAll('.okr-cal-seg button')].some(b => /Férias/.test(b.textContent))));
    t('Q. Sem erro JS (visualizador)', errs.length === 0, errs);
    await ctx.close();
  }

  // 4. Maré (kanban-dev.html): padrão só minhas squads + chip "Todo o Digital"
  {
    const { ctx, p, errs } = await abre('/kanban-dev.html?squad=dados', { width: 1280, height: 900 }, ANA);
    await p.evaluate(() => { if (typeof closeBoasVindas === 'function') closeBoasVindas(); openCal(); changeCalView('ferias'); });
    await p.waitForSelector('#cal-ferias .mfer', { timeout: 6000 });
    t('R. Maré: começa mostrando só minhas squads (Paulo PO de dados aparece, Bia de prf não)', await p.evaluate(() => {
      const tx = document.getElementById('cal-ferias').innerText;
      return /Paulo PO/.test(tx) && !/Bia Outra/.test(tx);
    }));
    await p.click('#cal-ferias [data-act="todo-digital"]');
    await p.waitForTimeout(150);
    t('S. Maré: chip 🌐 Todo o Digital libera todas as squads (Bia aparece)', await p.evaluate(() => /Bia Outra/.test(document.getElementById('cal-ferias').innerText)));
    if (cap) await p.screenshot({ path: path.join(cap, 'mare_ferias_1280.png') });
    t('T. Sem erro JS (Maré desktop)', errs.length === 0, errs);
    await ctx.close();
  }

  // 5. Celular 390px nos 3 temas (sem overflow horizontal)
  for (const tema of ['dark', 'light', 'vice']) {
    const { ctx, p, errs } = await abre('/okr-dev.html', { width: 390, height: 800 }, ANA, tema);
    await p.evaluate(() => { _okrSetView('calendario'); _okrCalSetVista('ferias'); });
    await p.waitForSelector('#okr-ferias-host .mfer', { timeout: 6000 });
    const m = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth }));
    t(`U. 390 ${tema}: sem rolagem lateral da página`, m.over <= 0, m);
    if (cap) await p.screenshot({ path: path.join(cap, `radar_ferias_390_${tema}.png`), fullPage: false });
    t(`V. 390 ${tema}: sem erro JS`, errs.length === 0, errs);
    await ctx.close();
  }

  await b.close();
  srv.close();
  console.log(ok ? '\nTUDO OK' : '\nFALHOU');
  process.exit(ok ? 0 : 1);
})();
