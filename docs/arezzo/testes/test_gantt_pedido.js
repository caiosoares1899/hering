// 📣 Pedir atualização de um calendário do Gantt (13/11/2026): destinatários por calendário (Comercial Hering → squads app + site;
// Marketplace → mktplace; Outlet → outlet; Marca → Caio), sem repetir, sem quem pediu, sem conta de fora; 2º pedido no mesmo dia recusado
// como nas regras (só CRIAR aviso na caixa alheia); o aviso abre o 📤 Atualizar planilha. Maré, Radar e Painel.
// Servir a raiz em BASE_URL (padrão http://127.0.0.1:8949); node docs/arezzo/testes/test_gantt_pedido.js
const fs = require('node:fs'); const path = require('node:path'); const home = require('node:os').homedir();
const pwPath = process.env.PLAYWRIGHT_MODULE || (fs.existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const { chromium } = require(pwPath); const fake = require('./fakefb');
function resolveChrome() { if (process.env.CHROME) return process.env.CHROME; if (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) return '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const r = path.join(home, 'hering-tools/chrome'); const arm = fs.readdirSync(r).find(n => n.startsWith('mac_arm-')); return path.join(r, arm, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'); }
const base = process.env.BASE_URL || 'http://127.0.0.1:8949'; const FIXO = '2026-11-12T13:00:00'; const SQ = 'site';
const P = (nome, email, squads) => ({ nome, email, init: nome.slice(0, 2).toUpperCase(), role: 'membro', squads });
const PUBS = { mem: P('Mel Membro', 'mem@ciahering.com.br', { site: true, app: true }), ana: P('Ana App', 'ana@ciahering.com.br', { app: true }),
  bia: P('Bia Site', 'bia@ciahering.com.br', { site: true, app: true }), caio: P('Caio Soares', 'caio.soares@ciahering.com.br', { dados: true }),
  ext: P('Free Lancer', 'free@gmail.com', { app: true }), carl: P('Carla Mkt', 'carla@ciahering.com.br', { mktplace: true }),
  oto: P('Otto Outlet', 'otto@ciahering.com.br', { outlet: true }), crm: P('Cris CRM', 'cris@ciahering.com.br', { 'outlet-crm': true }) };
const seed = () => ({ kanban: {
  config: { adm_emails: ['adm@ciahering.com.br'] }, okr: { objetivos: {}, marcos: {}, tags: {} },
  usuarios: Object.fromEntries(Object.entries(PUBS).map(([k, u]) => [k, Object.assign({ uid: k, inscrito: true }, u, k === 'mem' ? { notificacoes: { gantt_pedido_outlet_x_20261112: { id: 'gantt_pedido_outlet_x_20261112', type: 'gantt_pedido', title: '📣 Otto pediu', sub: '', cal: 'outlet', dev: true, read: false, ts: '2026-11-12T12:00:00.000Z' } } } : {})])),
  usuarios_publicos: Object.fromEntries(Object.entries(PUBS).map(([k, u]) => [k, Object.assign({ uid: k }, u)])),
  squads: { [SQ]: { dados: { columns: [{ id: 'doing', name: 'Fazendo' }], tags: [], cards_index: {}, cards: {} } } },
  calendarios_gantt_dev: { outlet: { meta: { atualizadoEm: 1, porNome: 'X', arquivo: 'o.xlsx' }, linhas: { out_crm: { rot: 'CRM', ordem: 1 } }, barras: { o1: { linha: 'out_crm', ini: '2026-11-12', fim: '2026-11-12', txt: 'O' } } } },
} });

(async () => {
  const b = await chromium.launch({ executablePath: resolveChrome(), headless: true }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d ?? null).slice(0, 400))); };
  const abre = async (pagina, qs, manterOverlays) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(([f]) => { const R = Date; const fixed = new R(f).getTime(); class D extends R { constructor(...a) { if (!a.length) super(fixed); else super(...a); } static now() { return fixed; } } window.Date = D; try { localStorage.clear(); } catch (e) {}
      // como as regras: na caixa de OUTRA pessoa só dá para CRIAR o aviso (repetir o mesmo id é negado)
      window.__denySet = (p) => { const m = /^kanban\/usuarios\/([^/]+)\/notificacoes\/([^/]+)$/.exec(p); if (!m || m[1] === 'mem') return false; const u = (window.__store.kanban.usuarios || {})[m[1]]; return !!(u && u.notificacoes && u.notificacoes[m[2]]); };
    }, [FIXO]);
    await p.goto(base + '/' + pagina + (qs || '')); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(() => window.__authCb({ uid: 'mem', email: 'mem@ciahering.com.br', displayName: 'Mel Membro', photoURL: '', providerData: [{ providerId: 'google.com' }] }));
    await p.waitForTimeout(2600); if (!manterOverlays) await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')));
    return { ctx, p, errs };
  };
  const caixas = (p) => p.evaluate(() => Object.fromEntries(Object.entries(window.__store.kanban.usuarios).map(([k, u]) => [k, Object.values(u.notificacoes || {}).filter(n => n.type === 'gantt_pedido' && /^gantt_pedido_(comercial|marca|mktplace|outlet)_mem_/.test(n.id)).map(n => n.cal)])));

  // ── MARÉ ──
  { const { ctx, p, errs } = await abre('kanban-dev.html', '?squad=' + SQ + '&gantt=comercial');
    const toasts = []; await p.exposeFunction('__toastSpy', m => toasts.push(m));
    await p.evaluate(() => { const o = window.showToast; window.showToast = (m, ...r) => { try { window.__toastSpy(String(m)); } catch (e) {} return o && o(m, ...r); }; window.uiConfirm = async () => true; });
    t('M1. botão 📣 Pedir atualização na aba do calendário', await p.evaluate(() => !!document.querySelector('#gantt-filtros .gantt-pedir')));
    // destinatários de PRODUÇÃO (função pura do módulo, mesmos dados): por calendário, sem repetir, sem quem pede, sem conta de fora
    const dest = await p.evaluate(() => { const pubs = window.__store.kanban.usuarios_publicos; const D = c => MareGCal.pedido.destinatarios(c, pubs, 'mem').sort().join(); return { comercial: D('comercial'), marca: D('marca'), mktplace: D('mktplace'), outlet: D('outlet') }; });
    t('M2. destinatários: Hering = app+site (Ana, Bia uma vez; sem Mel, sem freelancer), Marca = Caio, Mkt = Carla, Outlet = Otto (não a CRM)',
      JSON.stringify(dest) === JSON.stringify({ comercial: 'ana,bia', marca: 'caio', mktplace: 'carl', outlet: 'oto' }), dest);
    // no -dev o aviso vai SÓ para quem pediu (a caixa de notificações é a mesma do prod)
    await p.click('#gantt-filtros .gantt-pedir'); await p.waitForTimeout(400);
    let c = await caixas(p);
    t('M3. ambiente de teste: só quem pediu recebe; ninguém das squads reais', c.mem.join() === 'comercial' && !c.ana.length && !c.bia.length, c);
    t('M4. a mensagem diz para quem iria em produção', toasts.some(m => /Ambiente de teste: o aviso foi só para você\. Em produção iria para 2 pessoas: Ana App, Bia Site/.test(m)), toasts);
    const aviso = await p.evaluate(() => Object.values(window.__store.kanban.usuarios.mem.notificacoes).find(n => n.type === 'gantt_pedido' && n.cal === 'comercial'));
    t('M5. o aviso diz quem pediu e qual calendário', /^📣 Mel Membro pediu para atualizar o Calendário Comercial Hering$/.test(aviso.title) && aviso.dev === true, aviso);
    toasts.length = 0; await p.click('#gantt-filtros .gantt-pedir'); await p.waitForTimeout(400);
    c = await caixas(p);
    t('M6. 2º pedido no mesmo dia não regrava (vale para PO/ADM, que as regras deixariam sobrescrever)', c.mem.length === 1 && toasts.some(m => /já tinha o de hoje/.test(m)), { c, toasts });
    await p.evaluate(() => { const n = Object.values(window.__store.kanban.usuarios.mem.notificacoes).find(n => n.cal === 'comercial' && /_mem_/.test(n.id)); n.read = true; });
    await p.click('#gantt-filtros .gantt-pedir'); await p.waitForTimeout(300);
    t('M7. aviso já lido continua lido (não volta como novo)', await p.evaluate(() => Object.values(window.__store.kanban.usuarios.mem.notificacoes).find(n => n.cal === 'comercial' && /_mem_/.test(n.id)).read === true));
    await p.evaluate(() => ganttAba('digital')); await p.waitForTimeout(150);
    t('M8. na 🧭 Digital não há 📣 (pede-se na aba de cada calendário)', await p.evaluate(() => !document.querySelector('#gantt-filtros .gantt-pedir')));
    // aviso recebido: abre o Gantt no calendário e já o 📤
    await p.evaluate(() => { toggleGanttView(); openNotif('gantt_pedido_outlet_x_20261112', '', 'site', '', 'gantt_pedido', 'outlet', ''); }); await p.waitForTimeout(600);
    t('M9. clicar no aviso abre o Gantt no Outlet com o 📤 Atualizar planilha aberto', await p.evaluate(() => boardView === 'gantt' && _ganttAba === 'outlet' && document.getElementById('gantt-up-ov') && document.getElementById('gantt-up-ov').classList.contains('open')));
    t('M10. sem erro de JS', errs.length === 0, errs);
    await ctx.close(); }
  { const { ctx, p, errs } = await abre('kanban-dev.html', '?squad=' + SQ + '&gantt=mktplace&atualizar=1', true);
    await p.waitForTimeout(500);
    t('M11. ?gantt=mktplace&atualizar=1 abre o 📤 do Marketplace (e os parâmetros saem da URL)', await p.evaluate(() => _ganttAba === 'mktplace' && document.getElementById('gantt-up-ov').classList.contains('open') && !/gantt=|atualizar=/.test(location.search)));
    t('M12. sem erro de JS', errs.length === 0, errs);
    await ctx.close(); }

  // ── RADAR ──
  { const { ctx, p, errs } = await abre('okr-dev.html', '?gantt=mktplace');
    await p.evaluate(() => { window.confirm = () => true; });
    await p.click('.mgc-pedir'); await p.waitForTimeout(400);
    const c = await caixas(p);
    t('R1. Radar (teste): o aviso vai só para quem pediu', c.mem.join() === 'mktplace' && !c.carl.length, c);
    t('R2. a linha de aviso mostra quem receberia em produção', /Em produção iria para 1 pessoa: Carla Mkt/.test(await p.textContent('.mgc-det')), await p.textContent('.mgc-det'));
    await p.evaluate(() => _okrGcal.aba('digital')); await p.waitForTimeout(150);
    t('R3. sem 📣 na 🧭 Digital', await p.evaluate(() => !document.querySelector('.mgc-pedir')));
    t('R4. roteador: aviso abre o Maré no 📤', await p.evaluate(() => MareNotif.urlPessoal({ type: 'gantt_pedido', cal: 'outlet' }).url === 'kanban-dev.html?gantt=outlet&atualizar=1'));
    t('R5. sem erro de JS', errs.length === 0, errs);
    await ctx.close(); }

  // ── PAINEL ──
  { const { ctx, p, errs } = await abre('painel-dev.html', '');
    const r = await p.evaluate(() => { const el = [...document.querySelectorAll('[onclick*="gantt_pedido_outlet_x"]')].find(e => /urlPessoal/.test(e.getAttribute('onclick'))); return el ? el.getAttribute('onclick') : null; });
    t('P1. Painel: o aviso no sino leva o calendário até o roteador', !!r && /gantt_pedido/.test(r) && /outlet/.test(r), r);
    t('P2. sem erro de JS', errs.length === 0, errs);
    await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nFALHOU'); process.exit(ok ? 0 : 1);
})();
