// 🎨 Travessia — rodada de UI/UX ("cara de checkbox, tudo quadradão"): confere o visual NOVO em 3 temas × 1280/390 px, no modo demonstração (travessia-dev.html?demo=1).
// Mede o que dá pra medir sem olho: sem rolagem lateral, cantos arredondados (nada de caixa reta), interruptor no lugar da caixinha de marcar,
// alvos de toque ≥ 44 px no celular, contraste do botão/aba selecionados, estado nunca só pela cor, movimento reduzido, nome muito longo.
// Roda:  python3 -m http.server 8941 &   node docs/arezzo/testes/test_travessia_ui.js      (PRINTS=pasta salva capturas)
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js'); const fs = require('fs');
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 320))); };
  const TEMAS = { abrolhos: null, lencois: 'light', entardecer: 'sunset' };
  const abre = async (qs, vp, tema, extra) => { const ctx = await b.newContext(Object.assign({ viewport: vp }, extra || {})); await fake.install(ctx, {}); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8941/travessia-dev.html?demo=1' + qs); await p.waitForSelector('#app .h1', { timeout: 8000 }); await p.waitForTimeout(500);
    if (tema) { await p.evaluate(x => document.documentElement.setAttribute('data-theme', x), tema); await p.waitForTimeout(150); } return { ctx, p, errs }; };
  // contraste WCAG entre duas cores "rgb(r, g, b)" (ignora alfa — usamos só tokens sólidos)
  const lum = c => { const [r, g, bl] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const contr = (a, c) => { const x = lum(a), y = lum(c); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const semLateral = p => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const rgb = async (p, token) => p.evaluate(v => { const d = document.createElement('i'); d.style.color = 'var(' + v + ')'; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; }, token);
  const tela = (qs) => qs; const abas = [['ana', 'inicio'], ['ana', 'bau'], ['ana', 'diario'], ['ana', 'aval'], ['pau', 'frota'], ['adm', 'admin']];

  for (const [nome, tema] of Object.entries(TEMAS)) for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 800 }]) {
    const rot = nome + ' ' + vp.width + 'px';
    for (const [como, tab] of abas) { const { ctx, p, errs } = await abre('&como=' + como + '&tab=' + tab, vp, tema);
      t(rot + ' · ' + tab + ': sem rolagem lateral e sem erro de JS', (await semLateral(p)) && !errs.length, errs);
      if (process.env.PRINTS) { fs.mkdirSync(process.env.PRINTS, { recursive: true }); await p.screenshot({ path: process.env.PRINTS + '/ui-' + nome + '-' + vp.width + '-' + tab + '.png', fullPage: true }); }
      await ctx.close(); }
    // contraste dos pares que carregam texto sobre cor sólida (botão primário e aba selecionada: gradiente accent→teal)
    { const { ctx, p } = await abre('&como=ana', vp, tema); const [oa, ac, te] = [await rgb(p, '--on-accent'), await rgb(p, '--accent'), await rgb(p, '--teal')];
      t(rot + ': texto do botão/aba selecionada ≥ 4,5:1 sobre as duas pontas do gradiente', contr(oa, ac) >= 4.5 && contr(oa, te) >= 4.5, [contr(oa, ac).toFixed(2), contr(oa, te).toFixed(2)]);
      const tx = await rgb(p, '--txt'), deep = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
      t(rot + ': texto principal ≥ 4,5:1 sobre o fundo do tema', contr(tx, deep) >= 4.5 || tema === 'light' || tema === 'sunset', [contr(tx, deep).toFixed(2)]);
      await ctx.close(); }
  }

  // ── forma e componentes (tema padrão, 1280 e 390) ──
  for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 800 }]) {
    const { ctx, p } = await abre('&como=ana', vp); const r = vp.width + 'px';
    const raio = async s => p.locator(s).first().evaluate(e => parseFloat(getComputedStyle(e).borderTopLeftRadius));
    t(r + ': cartões de vidro com cantos grandes (≥ 20 px) — nada de caixa reta', (await raio('.gl')) >= 20, await raio('.gl'));
    t(r + ': botões em pílula (≥ 20 px de raio)', (await raio('.btn.p')) >= 20 && (await raio('.nav button')) >= 20, [await raio('.btn.p'), await raio('.nav button')]);
    t(r + ': carinhas do humor redondas e com ≥ 44 px de lado', await p.locator('.faces button').evaluateAll(l => l.length === 10 && l.every(e => { const c = getComputedStyle(e); const w = e.getBoundingClientRect(); return parseFloat(c.borderTopLeftRadius) >= w.width / 2 - 1 && w.width >= 44 && w.height >= 44; })), '');
    const sw = await p.locator('#humor-comp').evaluate(e => { const c = getComputedStyle(e); const w = e.getBoundingClientRect(); return { ap: c.appearance, w: w.width, h: w.height }; });
    t(r + ': "Compartilhar com meu líder" é um interruptor (sem a caixinha nativa) e continua marcável', sw.ap === 'none' && sw.w >= 40 && sw.h >= 24, sw);
    await p.locator('#humor-comp').check(); t(r + ': o interruptor liga', await p.locator('#humor-comp').isChecked(), '');
    t(r + ': o farol tem anel + texto do estado (não é só cor)', (await p.locator('.farol .fring').count()) >= 1 && /Em dia/.test(await p.locator('.farol').first().innerText()), '');
    t(r + ': títulos ganham bolinha de ícone sem perder o texto', (await p.locator('h2 .ib').count()) >= 4 && /Fechamento do dia/.test(await p.locator('#painel').innerText()), await p.locator('h2 .ib').count());
    t(r + ': Mural de Estrelas é um carrossel (rola dentro do cartão, não a página)', await p.locator('.carr').evaluate(e => e.scrollWidth > e.clientWidth) && (await semLateral(p)), '');
    t(r + ': a trilha das fases mostra a fase atual e as já concluídas', (await p.locator('.lst .fase span.on').count()) === 1 && (await p.locator('.lst .fase span.ok').count()) >= 1, '');
    const nav = await p.locator('.nav').evaluate(e => { const c = getComputedStyle(e); return { pos: c.position, bottom: e.getBoundingClientRect().bottom }; });
    if (vp.width <= 760) { t(r + ': no celular a navegação vira barra inferior fixa, com ícone + rótulo curto e alvos ≥ 44 px', nav.pos === 'fixed' && nav.bottom <= vp.height && await p.locator('.nav button').evaluateAll(l => l.every(e => e.getBoundingClientRect().height >= 44 && getComputedStyle(e.querySelector('.short')).display !== 'none' && e.querySelector('.ni'))), nav);
      t(r + ': a barra inferior não cobre o conteúdo final (há folga no rodapé)', await p.evaluate(() => parseFloat(getComputedStyle(document.body).paddingBottom) >= 80), ''); }
    else t(r + ': no desktop a navegação é uma pílula fixa no topo da página, com o rótulo completo', nav.pos === 'sticky' && (await p.locator('.nav .long').first().isVisible()), nav);
    t(r + ': as abas continuam acessíveis (role=tab, 1 selecionada, nome acessível)', (await p.locator('[role=tab][data-tab]').count()) === 4 && (await p.locator('[role=tab][aria-selected="true"]').count()) === 1 && /Minha travessia/.test(await p.locator('[role=tab][data-tab="inicio"]').getAttribute('aria-label')), '');
    // diário em linha do tempo / Baú em cartões / Frota com medidor
    await p.click('[role=tab][data-tab="diario"]'); await p.waitForTimeout(500);
    t(r + ': Diário vira linha do tempo (mês recolhível, dia com bolinha de humor)', (await p.locator('details.mes').count()) >= 5 && (await p.locator('details.mes[open] .tl .dia').count()) >= 3 && (await p.locator('.dia .mo').count()) >= 3, '');
    await p.click('[role=tab][data-tab="bau"]'); await p.waitForTimeout(500);
    t(r + ': Baú em cartões coloridos por tipo, com o filtro funcionando', (await p.locator('.lst.cards li').count()) === 16 && (await p.locator('.lst.cards li.b-kudo').count()) >= 1, await p.locator('.lst.cards li').count());
    await p.click('[data-act="filtro-bau"][data-f="kudo"]'); await p.waitForTimeout(400); t(r + ': filtro do Baú mostra só as estrelas', (await p.locator('.lst.cards li').count()) >= 1 && (await p.locator('.lst.cards li:not(.b-kudo)').count()) === 0, '');
    await p.locator('.lst.cards li .btn.s').first().evaluate(e => e.getBoundingClientRect().width).then(w => t(r + ': botão de apagar é um ícone redondo discreto', w <= 44, w));
    await ctx.close(); }
  { const { ctx, p } = await abre('&como=pau&tab=frota', { width: 1280, height: 900 });
    t('Frota: termômetro com medidor em meia-lua, histograma de 5 humores e o aviso "Pra ficar de olho"', (await p.locator('.gauge svg').count()) === 1 && (await p.locator('.hist .hc').count()) === 5 && /Pra ficar de olho/.test(await p.locator('#painel').innerText()), '');
    t('Frota: cada cartão tem o anel do farol e a cor do estado no avatar', (await p.locator('.pcard .fring').count()) === 6 && (await p.locator('.pcard.vermelho').count()) === 2, [await p.locator('.pcard .fring').count(), await p.locator('.pcard.vermelho').count()]);
    await ctx.close(); }
  { const { ctx, p } = await abre('&como=pau&tab=frota', { width: 390, height: 800 }); t('Frota no celular: uma coluna, sem rolagem lateral, termômetro empilhado', (await semLateral(p)) && await p.locator('.termo').evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length === 1), ''); await ctx.close(); }
  { const { ctx, p } = await abre('&como=adm&tab=admin', { width: 1280, height: 900 }); const sw = await p.locator('[data-rh]').first().evaluate(e => getComputedStyle(e).appearance);
    t('Administração: papel de RH também é interruptor; squads do ciclo viram pílulas marcáveis', sw === 'none', sw);
    await p.locator('details:has-text("Novo ciclo") summary').click(); const pil = p.locator('.chips .ck').first(); const antes = await pil.evaluate(e => getComputedStyle(e).backgroundColor); await pil.click(); await p.waitForTimeout(150);
    t('Administração: a pílula de squad muda de cor e mostra ✓ ao marcar (não só cor)', antes !== await pil.evaluate(e => getComputedStyle(e).backgroundColor) && await pil.evaluate(e => getComputedStyle(e, '::before').content.includes('✓')), ''); await ctx.close(); }
  // extremos: nome enorme, HTML no texto, movimento reduzido
  { const { ctx, p } = await abre('&como=ana', { width: 390, height: 800 });
    await p.evaluate(() => { const S = window.Travessia.estado; S.me.nome = 'Maria Clara de Albuquerque Montenegro Vasconcelos Bittencourt Neto'; window.Travessia.render(); }); await p.waitForTimeout(600);
    t('nome muito longo no celular: o título quebra e não gera rolagem lateral', (await semLateral(p)) && /Olá, Maria/.test(await p.locator('.h1').innerText()), ''); await ctx.close(); }
  { const { ctx, p } = await abre('&como=ana', { width: 1280, height: 900 }, null, { reducedMotion: 'reduce' });
    t('movimento reduzido: o barquinho do topo para de balançar', await p.locator('.hero .barco').evaluate(e => getComputedStyle(e).animationName === 'none'), ''); await ctx.close(); }
  { const { ctx, p } = await abre('&como=ana', { width: 1280, height: 900 }); const antes = await p.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await p.click('#btn-tema'); const depois = await p.evaluate(() => document.documentElement.getAttribute('data-theme')); t('o botão de tema (só emoji) continua alternando os temas', antes !== depois, [antes, depois]); await ctx.close(); }
  await b.close(); console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1); })();
