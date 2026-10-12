// 🐟 Metas e desafios do Digital no Painel (painel-dev → aba 📊 Dados): ADM/editor de Dados cria, edita, atualiza e exclui; os demais só veem. Playwright + fakefb.
// PAGE=painel.html testa a prod depois da promoção (aí os caminhos NÃO têm _dev).
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js'); const S = require('./seed_metas.js');
const PAGE = process.env.PAGE || 'painel-dev.html', SFX = /-dev/.test(PAGE) ? '_dev' : '';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + JSON.stringify(d).slice(0, 400))); };
  const seed = admin => {
    const base = S.seed('po', { semMarcoFresco: true }).kanban;
    const users = { ana: { uid: 'ana', nome: 'Ana ADM', email: 'ana@ciahering.com.br', inscrito: true, init: 'AA', role: 'adm', squads: { dev: true } }, bob: { uid: 'bob', nome: 'Bob Membro', email: 'bob@ciahering.com.br', inscrito: true, init: 'BB', role: 'membro', squads: { dev: true } } };
    return { kanban: Object.assign({}, base, { usuarios: users, usuarios_publicos: Object.assign({}, users, base.usuarios_publicos), config: { adm_emails: ['ana@ciahering.com.br'] } }) };
  };
  const abre = async (uid, o) => {
    o = o || {}; const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const sd = seed(); if (o.mut) o.mut(sd); await fake.install(ctx, sd); if (o.init) await ctx.addInitScript(o.init);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto('http://localhost:8941/' + PAGE); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), S.U(uid, uid === 'ana' ? 'Ana ADM' : 'Bob Membro')); await p.waitForTimeout(2500);
    await p.evaluate(() => { window._pollSquadDados = () => {}; window._pollSquadSnapshots = () => {}; swPtab('dados'); }); await p.waitForTimeout(600);
    return { ctx, p, errs };
  };
  const store = (p, path) => p.evaluate(pa => { let o = window.__store; pa.split('/').forEach(k => { o = o == null ? o : o[k]; }); return o == null ? null : JSON.parse(JSON.stringify(o)); }, path);
  const vis = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.offsetParent !== null; }, sel);
  const txt = (p, sel) => p.evaluate(s => (document.querySelector(s)?.innerText || '').replace(/\s+/g, ' ').trim(), sel);

  { const { ctx, p, errs } = await abre('ana');
    t('ADM vê o bloco 🐟 Metas e desafios do Digital na aba Dados, com os botões de criar', await vis(p, '#dados-metas') && await vis(p, '#dados-metas-bar') && /O mar tá pra peixe/i.test(await txt(p, '#dados-metas')), await txt(p, '#dados-metas'));
    const cards = await p.evaluate(() => [...document.querySelectorAll('#dados-metas-lista .mm-card .mm-card-t > b')].map(x => x.textContent));
    t('lista as metas/desafios do Digital (as 2 do seed) com ⚙ Editar e ✏️ Atualizar', cards.length === 2 && cards.includes('Black Friday 2026 — Captação do Digital') && (await p.evaluate(() => document.querySelectorAll('#dados-metas-lista [data-mm-act="edit"]').length)) === 2 && (await p.evaluate(() => document.querySelectorAll('#dados-metas-lista [data-mm-act="reg"]').length)) === 2, cards);
    const rk = await p.evaluate(() => [...document.querySelectorAll('#dados-metas-squads .mm-rk')].map(r => r.innerText.replace(/\s+/g, ' ').trim()));
    t('ranking das metas das squads (só as marcadas "visão global"): 3 squads, em ordem de %', rk.length === 3 && /93%/.test(rk[0]) && /42%/.test(rk[1]) && /30%/.test(rk[2]), rk);
    // criar meta global
    await p.evaluate(() => dadosMetaNova('meta')); await p.waitForTimeout(500);
    t('"Nova meta global" abre o formulário do Digital (sem a opção de visão global, que é só de squad) e oferece quem preenche (ADMs/editores)', /Digital inteiro/.test(await txt(p, '.mm-md')) && !(await p.evaluate(() => !!document.getElementById('mm-f-g'))) && (await p.evaluate(() => document.querySelectorAll('#mm-resp [data-u]').length)) >= 1, await txt(p, '.mm-md'));
    await p.fill('#mm-f-t', 'Black Friday — meta de pedidos'); await p.click('#mm-fmt [data-f="num"]'); await p.fill('#mm-f-s', 'pedidos'); await p.fill('#mm-f-a', '250000'); await p.click('#mm-bf');
    const bf = await p.evaluate(() => [document.getElementById('mm-f-d1').value, document.getElementById('mm-f-d2').value]);
    t('atalho "🔥 Black Friday" preenche o período (segunda da semana → Cyber Monday)', /^\d{4}-11-\d{2}$/.test(bf[0]) && bf[1] > bf[0], bf);
    await p.selectOption('#mm-f-lem', 'cada'); await p.selectOption('#mm-l-c', '2'); await p.click('#mm-resp [data-u="ana"]');
    await p.click('#mm-f-ok'); await p.waitForTimeout(700);
    const dg = await store(p, 'kanban/metas_digital' + SFX); const id = Object.keys(dg).find(k => dg[k].titulo === 'Black Friday — meta de pedidos'); const m = dg[id];
    t('grava em kanban/metas_digital' + SFX + ' (e só lá): escopo, formato, alvo, período, lembrete a cada 2 h, responsável', m && m.escopo === 'digital' && m.tipo === 'meta' && m.fmt === 'num' && m.alvo === 250000 && m.lembrete.modo === 'cada' && m.lembrete.cada === 2 && m.responsaveis.join() === 'ana' && m.global === false && !(await store(p, 'kanban/metas_squads/dev')), m);
    t('a lista já mostra a nova meta (3) — ao vivo', (await p.evaluate(() => document.querySelectorAll('#dados-metas-lista .mm-card').length)) === 3, 0);
    // atualizar valor e marco
    await p.click('#dados-metas-lista .mm-card[data-mm-id="' + id + '"] [data-mm-act="reg"]'); await p.fill('#mm-r-v', '60000'); await p.click('#mm-r-ok'); await p.waitForTimeout(700);
    const m2 = await store(p, 'kanban/metas_digital' + SFX + '/' + id);
    t('ADM atualiza o valor pelo Painel: grava atual, marco (24 % → 20) e histórico', m2.atual === 60000 && m2.marco === 20 && !!(await store(p, 'kanban/metas_log' + SFX + '/' + id)), m2);
    t('o popup 🐟 do marco aparece no Painel também (20 %)', await vis(p, '.mm-fish') && /20%/.test(await txt(p, '.mm-fish')), await txt(p, '.mm-fish-ov')); await p.click('.mm-fish .go'); await p.waitForTimeout(500);
    // editar e excluir
    await p.click('#dados-metas-lista .mm-card[data-mm-id="h"] [data-mm-act="edit"]'); await p.waitForTimeout(500); await p.fill('#mm-f-t', 'Dia 27: 1,2 milhão de peças'); await p.click('#mm-f-ok'); await p.waitForTimeout(600);
    const h = await store(p, 'kanban/metas_digital' + SFX + '/h');
    t('editar um desafio muda o nome e preserva o valor atual e o dia', h.titulo === 'Dia 27: 1,2 milhão de peças' && h.atual === 310000 && h.inicio === h.fim, h);
    await p.click('#dados-metas-lista .mm-card[data-mm-id="h"] [data-mm-act="edit"]'); await p.waitForTimeout(400); await p.click('#mm-f-rm'); await p.waitForTimeout(600);
    t('excluir (com confirmação) remove a meta do banco', !(await store(p, 'kanban/metas_digital' + SFX + '/h')), 0);
    t('sem erro de JS (Painel, ADM)', !errs.length, errs); await ctx.close(); }
  { const { ctx, p } = await abre('bob');
    t('quem não é ADM nem editor de Dados vê as metas, mas SEM botões de criar/editar/atualizar', await vis(p, '#dados-metas-lista') && !(await vis(p, '#dados-metas-bar')) && (await p.evaluate(() => document.querySelectorAll('#dados-metas-lista .mm-card').length)) === 2 && !(await p.evaluate(() => !!document.querySelector('#dados-metas-lista [data-mm-act="edit"], #dados-metas-lista [data-mm-act="reg"]'))), 0);
    await p.evaluate(() => dadosMetaNova('meta')); await p.waitForTimeout(300);
    t('mesmo chamando a função na mão, não abre o formulário', !(await vis(p, '.mm-md')), 0); await ctx.close(); }
  { const { ctx, p } = await abre('ana', { mut: s => { delete s.kanban['metas_digital' + SFX]; delete s.kanban['metas_squads' + SFX]; } });
    t('sem nenhuma meta: mensagem de vazio com o caminho de criar', /Nenhuma meta do Digital ainda/.test(await txt(p, '#dados-metas-lista')), await txt(p, '#dados-metas-lista')); await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1);
})();
