// 🗓️ Escala (escala-dev.html) — pedidos do time (23/11/2026): 👥 mesma escala para várias pessoas (gestor),
// filtro por tipo (✅ / 🔥 / 🏖️) e, na visão de todas as squads, um grupo por horário com quem está nele.
// PAGE=escala.html testa a prod depois da promoção.
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const PAGE = process.env.PAGE || 'escala-dev.html';
const G = (uid, nome) => ({ uid, email: uid + '@ciahering.com.br', displayName: nome, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const PAU = G('pau', 'Paulo PO'), ANA = G('ana', 'Ana Lima');
const pad = n => String(n).padStart(2, '0'), iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const add = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const seg = (() => { const h = new Date(); return add(h, -((h.getDay() + 6) % 7)); })();
const D = i => iso(add(seg, i));
const pub = (uid, nome, init, role) => ({ uid, nome, init, email: uid + '@ciahering.com.br', role, squads: { dados: true }, squads_roles: { dados: role } });
const seed = () => ({ kanban: {
  usuarios_publicos: { ana: pub('ana', 'Ana Lima', 'AL', 'membro'), bru: pub('bru', 'Bruno Reis', 'BR', 'membro'), pau: pub('pau', 'Paulo PO', 'PP', 'po'), car: pub('car', 'Carla Dias', 'CD', 'membro') },
  escala: { [D(1)]: { dados: {
    ana: { t: 'trab', i: '09:00', f: '18:00', por: 'ana', ts: 1 }, car: { t: 'trab', i: '09:00', f: '18:00', por: 'car', ts: 1 },
    bru: { t: 'plant', i: '20:00', f: '23:00', por: 'pau', ts: 1 }, pau: { t: 'folga', por: 'pau', ts: 1 },
  } } },
}});

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + JSON.stringify(d))); };
  const open = async (user, qs) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed());
    const p = await ctx.newPage(); fake.hookFiltros(p); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto('http://localhost:8941/' + PAGE + qs); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(x => window.__authCb(x), user); await p.waitForTimeout(600); return { ctx, p, errs };
  };
  const store = p => p.evaluate(() => JSON.parse(JSON.stringify(window.__store.kanban.escala || {})));

  // ── 👥 várias pessoas (PO) ──
  { const { ctx, p, errs } = await open(PAU, '?squad=dados&semana=' + D(0));
    await p.click('#b-cad'); await p.waitForSelector('#c-mais');
    const chips = await p.$$eval('#c-mais [data-mais]', a => a.map(x => x.dataset.mais));
    t('PO: chips "Toda a squad" + as outras pessoas (sem a do seletor)', chips[0] === '*' && chips.length === 4 && !chips.includes('pau'), chips);
    await p.selectOption('#c-uid', 'ana'); await p.waitForTimeout(80);
    t('trocar a pessoa do seletor tira ela dos chips', !(await p.$$eval('#c-mais [data-mais]', a => a.map(x => x.dataset.mais))).includes('ana'), 0);
    await p.click('#c-mais [data-mais="bru"]'); await p.click('#c-mais [data-mais="car"]');
    t('prévia conta as pessoas a mais', /Ana Lima \+ 2 pessoas/.test(await p.textContent('#c-prev')), await p.textContent('#c-prev'));
    await p.fill('#c-de', D(7)); await p.fill('#c-ate', D(7)); await p.evaluate(() => document.getElementById('c-de').dispatchEvent(new Event('input')));
    // De = Até = segunda seguinte; seg–sex já vêm marcados, então cai 1 dia só
    await p.fill('#c-i', '10:00'); await p.fill('#c-f', '16:00'); await p.click('#c-salvar'); await p.waitForTimeout(600);
    const st = (await store(p))[D(7)]?.dados || {};
    t('grava a MESMA escala para Ana, Bruno e Carla', ['ana', 'bru', 'car'].every(u => st[u] && st[u].i === '10:00' && st[u].f === '16:00' && st[u].por === 'pau') && !st.pau, st);
    t('sem erro de JS (lote)', !errs.length, errs); await ctx.close(); }
  { const { ctx, p } = await open(ANA, '?squad=dados&semana=' + D(0));
    await p.click('#b-cad'); await p.waitForSelector('#c-de');
    t('membro: não vê "mais pessoas"', !(await p.$('#c-mais')), 0); await ctx.close(); }

  // ── filtro por tipo ──
  { const { ctx, p, errs } = await open(PAU, '?squad=dados&semana=' + D(0));
    const naCel = () => p.evaluate(d => ['ana', 'bru', 'pau', 'car'].filter(u => /✅|🔥|🏖/.test(document.querySelector('.cel[data-u="' + u + '"][data-d="' + d + '"]')?.innerText || '')), D(1));
    await p.click('#b-filtros'); await p.waitForSelector('#f-tipos');
    await p.click('#f-tipos [data-ftipo="plant"]'); await p.waitForTimeout(120);
    t('tipo 🔥 Plantão: só o Bruno', (await naCel()).join() === 'bru', await naCel());
    await p.click('#f-tipos [data-ftipo="folga"]'); await p.waitForTimeout(120);
    t('🔥 + 🏖️: Bruno e Paulo; selo 2; URL f_tipo', (await naCel()).join() === 'bru,pau' && (await p.textContent('#f-badge')).trim() === '2' && await p.evaluate(() => new URL(location.href).searchParams.get('f_tipo') === 'plant,folga'), await naCel());
    await p.click('#f-tipos [data-ftipo=""]'); await p.waitForTimeout(120);
    t('"Todos" volta os 4', (await naCel()).length === 4, await naCel());
    t('sem erro de JS (tipo)', !errs.length, errs); await ctx.close(); }

  // ── todas as squads: grupos por horário ──
  { const { ctx, p, errs } = await open(PAU, '?visao=global&semana=' + D(0));
    const g = await p.evaluate(d => [...document.querySelectorAll('.gdia[data-gs="dados"][data-gd="' + d + '"] .turno')].map(x => x.querySelector('.th').textContent + ':' + x.querySelectorAll('.av').length), D(1));
    t('terça em Dados: plantão 20–23 (1) primeiro, depois 09–18 (2); folga fora dos grupos', g.join('|') === '🔥 20:00–23:00:1|09:00–18:00:2', g);
    t('contagem embaixo: 3 no dia · 1 de folga', /3 no dia · 1 de folga/.test(await p.textContent('.gdia[data-gs="dados"][data-gd="' + D(1) + '"] .n')), 0);
    const sobra = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    t('sem rolagem lateral da página (a tabela rola dentro do cartão)', sobra <= 0, sobra);
    t('sem erro de JS (global)', !errs.length, errs); await ctx.close(); }

  await b.close(); console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1);
})();
