// 🗓️ Escala (escala-dev.html) — resumo do dia e cadastro (pedidos do time + /melhoriauiux, 23/11/2026):
// ➕ Cadastrar no resumo do dia, ✏️ por pessoa, dias da semana movendo De/Até, quarta–sexta da Black Friday em laranja,
// título/botão de edição, tipo na prévia, foco devolvido, alvos de toque e sem rolagem lateral.
// PAGE=escala.html testa a prod depois da promoção.
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js');
const PAGE = process.env.PAGE || 'escala-dev.html';
const G = (uid, nome) => ({ uid, email: uid + '@ciahering.com.br', displayName: nome, photoURL: '', providerData: [{ providerId: 'google.com' }] });
const ANA = G('ana', 'Ana Lima'), PAU = G('pau', 'Paulo PO');
const pad = n => String(n).padStart(2, '0'), iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const add = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const seg = (() => { const h = new Date(); return add(h, -((h.getDay() + 6) % 7)); })();
const D = i => iso(add(seg, i));
const bfDe = ano => { const p = (4 - new Date(ano, 10, 1).getDay() + 7) % 7; return new Date(ano, 10, 1 + p + 21 + 1); };
const seed = () => ({ kanban: {
  usuarios_publicos: {
    ana: { uid: 'ana', nome: 'Ana Lima', init: 'AL', email: 'ana@ciahering.com.br', role: 'membro', squads: { dados: true }, squads_roles: { dados: 'membro' } },
    bru: { uid: 'bru', nome: 'Bruno Reis', init: 'BR', email: 'bru@ciahering.com.br', role: 'membro', squads: { dados: true }, squads_roles: { dados: 'membro' } },
    pau: { uid: 'pau', nome: 'Paulo PO', init: 'PP', email: 'pau@ciahering.com.br', role: 'po', squads: { dados: true }, squads_roles: { dados: 'po' } },
  },
  escala: { [D(0)]: { dados: { ana: { t: 'trab', i: '09:00', f: '18:00', por: 'ana', ts: 1 }, bru: { t: 'plant', por: 'pau', ts: 1 } } } },
}});

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + JSON.stringify(d))); };
  const open = async (user, qs, vp, touch) => {
    const ctx = await b.newContext({ viewport: vp || { width: 1280, height: 900 }, hasTouch: !!touch, isMobile: !!touch }); await fake.install(ctx, seed());
    const p = await ctx.newPage(); fake.hookFiltros(p); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto('http://localhost:8941/' + PAGE + (qs || '')); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(x => window.__authCb(x), user); await p.waitForTimeout(600); return { ctx, p, errs };
  };
  const val = (p, id) => p.evaluate(i => document.getElementById(i).value, id);
  const txt = (p, sel) => p.evaluate(s => (document.querySelector(s)?.innerText || '').replace(/\s+/g, ' ').trim(), sel);

  // ── resumo do dia (membro) ──
  { const { ctx, p, errs } = await open(ANA, '?squad=dados&semana=' + D(0));
    await p.click('th.dia[data-dia="' + D(2) + '"]'); await p.waitForSelector('.md');
    t('dia vazio: diz quem é a squad, orienta o cadastro e não oferece JPG vazio',
      /Quem está no dia — \S/.test(await txt(p, '.md .sub')) && /Cadastrar escala/.test(await txt(p, '.md .state')) && !(await p.$('#d-jpg')), await txt(p, '.md'));
    t('dia: botão ➕ Cadastrar escala (primário)', await p.evaluate(() => { const x = document.getElementById('d-cad'); return !!x && x.classList.contains('primary'); }), 0);
    t('foco vai para o título do modal', await p.evaluate(() => document.activeElement && document.activeElement.id === 'ov-t'), 0);
    await p.click('#d-cad'); await p.waitForSelector('#c-de');
    t('➕ do dia abre o cadastro com aquele dia em De/Até e o dia marcado',
      (await val(p, 'c-de')) === D(2) && (await val(p, 'c-ate')) === D(2) && (await p.evaluate(() => [...document.querySelectorAll('#c-dsem [aria-pressed="true"]')].map(x => x.textContent).join())) === 'Qua',
      [await val(p, 'c-de'), await val(p, 'c-ate')]);
    t('dia sem escala: título "Cadastrar" e botão "Cadastrar"', /Cadastrar escala/.test(await txt(p, '.md h2')) && (await txt(p, '#c-salvar')) === 'Cadastrar', await txt(p, '.md h2'));
    await p.click('#c-dsem [data-ds="3"]');
    t('marcar Qui leva o "Até" para a quinta da mesma semana', (await val(p, 'c-de')) === D(2) && (await val(p, 'c-ate')) === D(3), [await val(p, 'c-de'), await val(p, 'c-ate')]);
    await p.click('#c-dsem [data-ds="2"]');
    t('desmarcar Qua leva o "De" para a quinta', (await val(p, 'c-de')) === D(3) && (await val(p, 'c-ate')) === D(3), [await val(p, 'c-de'), await val(p, 'c-ate')]);
    await p.click('[data-t="plant"]');
    t('prévia diz o tipo escolhido', /🔥 Plantão · 1 dia ·/.test(await txt(p, '#c-prev')), await txt(p, '#c-prev'));
    t('🗑 Limpar período longe do botão principal (depois do espaço)', await p.evaluate(() => { const a = [...document.querySelectorAll('.md .acoes > *')].map(x => x.id || x.className); return a.indexOf('grow') < a.indexOf('c-limpar') && a.indexOf('c-salvar') < a.indexOf('grow'); }), 0);
    await p.keyboard.press('Escape');
    // período maior que uma semana não mexe nas datas
    await p.click('#b-cad'); await p.waitForSelector('#c-de');
    await p.fill('#c-de', D(0)); await p.fill('#c-ate', D(13)); await p.evaluate(() => document.getElementById('c-de').dispatchEvent(new Event('input')));
    await p.click('#c-dsem [data-ds="5"]');
    t('período de 2 semanas: marcar Sáb não mexe em De/Até', (await val(p, 'c-de')) === D(0) && (await val(p, 'c-ate')) === D(13), [await val(p, 'c-de'), await val(p, 'c-ate')]);
    await p.keyboard.press('Escape');
    // dia com gente: membro só edita a própria linha
    await p.click('th.dia[data-dia="' + D(0) + '"]'); await p.waitForSelector('.lista-dia');
    const eds = await p.evaluate(() => [...document.querySelectorAll('[data-edit]')].map(x => x.dataset.edit));
    t('membro: ✏️ só na própria linha', eds.join() === 'ana', eds);
    await p.click('[data-edit="ana"]'); await p.waitForSelector('#c-de');
    t('✏️ abre "Editar escala" com o que já existe e botão "Salvar"', /Editar escala/.test(await txt(p, '.md h2')) && (await txt(p, '#c-salvar')) === 'Salvar' && (await val(p, 'c-i')) === '09:00', await txt(p, '.md h2'));
    await p.keyboard.press('Escape');
    t('sem erro de JS (dia, membro)', !errs.length, errs); await ctx.close(); }

  // ── PO: ✏️ em todo mundo; quinta e sexta da Black Friday em laranja ──
  { const h = new Date(); let bf = bfDe(h.getFullYear()); if (add(bf, 7) < h) bf = bfDe(h.getFullYear() + 1);   // mesma virada do proximaBF()
    const semBF = add(bf, -((bf.getDay() + 6) % 7));
    const { ctx, p, errs } = await open(PAU, '?squad=dados&semana=' + D(0));
    await p.click('th.dia[data-dia="' + D(0) + '"]'); await p.waitForSelector('.lista-dia');
    t('PO: ✏️ em todas as linhas', (await p.evaluate(() => document.querySelectorAll('[data-edit]').length)) === 2, 0);
    await p.click('[data-edit="bru"]'); await p.waitForSelector('#c-uid');
    t('PO: ✏️ do Bruno abre a escala do Bruno', (await val(p, 'c-uid')) === 'bru', await val(p, 'c-uid'));
    await p.keyboard.press('Escape');
    await ctx.close();
    const o2 = await open(PAU, '?squad=dados&semana=' + iso(semBF));
    const marc = await o2.p.evaluate(() => [...document.querySelectorAll('th.dia.bfdia')].map(x => x.dataset.dia));
    t('semana da BF: quarta, quinta e sexta marcadas em laranja', marc.join() === [iso(add(bf, -2)), iso(add(bf, -1)), iso(bf)].join(), marc);
    const rot = await o2.p.evaluate(() => [...document.querySelectorAll('th.dia.bfdia .bfmark')].map(x => x.textContent));
    t('rótulos: quarta e quinta "esquenta", só a sexta diz BLACK FRIDAY', /ESQUENTA/.test(rot[0] || '') && /ESQUENTA/.test(rot[1] || '') && /BLACK FRIDAY/.test(rot[2] || '') && !/BLACK FRIDAY/.test((rot[0] || '') + (rot[1] || '')), rot);
    t('sem erro de JS (PO)', !errs.length && !o2.errs.length, errs.concat(o2.errs)); await o2.ctx.close(); }

  // ── celular com toque: alvos e rolagem ──
  { const { ctx, p, errs } = await open(ANA, '?squad=dados&semana=' + D(0), { width: 390, height: 800 }, true);
    await p.click('#b-cad'); await p.waitForSelector('#c-de');
    const m = await p.evaluate(() => ({
      sobra: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      chip: Math.round(document.querySelector('#c-dsem .chip').getBoundingClientRect().height),
      campo: getComputedStyle(document.getElementById('c-de')).fontSize,
    }));
    t('celular: sem rolagem lateral, dia da semana ≥ 44 px, campo 16 px (sem zoom do iOS)', m.sobra <= 0 && m.chip >= 44 && m.campo === '16px', m);
    t('sem erro de JS (celular)', !errs.length, errs); await ctx.close(); }

  await b.close(); console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1);
})();
