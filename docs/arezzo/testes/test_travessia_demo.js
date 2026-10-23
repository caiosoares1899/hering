// 🎭 Travessia em MODO DEMONSTRAÇÃO (travessia-dev.html?demo=1): ~2 trimestres de uso FICTÍCIO num banco em memória, sem login e sem tocar no Firebase.
// Confere: nada vai ao banco, cada persona enxerga só o que as regras permitiriam, os números fazem sentido e gravar no demo não persiste. Roda:
//   python3 -m http.server 8941 &   node docs/arezzo/testes/test_travessia_demo.js      (PRINTS=pasta salva capturas)
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js'); const fs = require('fs');
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 320))); };
  const abre = async (qs, vp) => { const ctx = await b.newContext({ viewport: vp || { width: 1280, height: 900 } }); await fake.install(ctx, {}); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8941/travessia-dev.html?demo=1' + (qs || '')); await p.waitForSelector('#app .h1', { timeout: 8000 }); await p.waitForTimeout(500); return { ctx, p, errs }; };
  const txt = p => p.locator('#painel').innerText(); const tabs = p => p.locator('[role=tab][data-tab]').allInnerTexts();
  const aba = async (p, n) => { await p.click(`[role=tab][data-tab="${n}"]`); await p.waitForTimeout(600); };
  const pers = async (p, k) => { await p.selectOption('#demo-persona', k); await p.waitForTimeout(900); };
  { const { ctx, p, errs } = await abre();
    t('abre sem login, com o aviso do modo demonstração e 6 personas', (await p.locator('#demo-bar').isVisible()) && /dados fictícios de 2 trimestres/.test(await p.locator('#demo-bar').innerText()) && (await p.locator('#demo-persona option').count()) === 6 && !(await p.locator('#login').isVisible()), '');
    const io = await p.evaluate(() => (window.__log || []).filter(l => l[0] === 'set' || l[0] === 'get' || l[0] === 'onValue' || l[0] === 'remove' || l[0] === 'update')); t('NADA vai ao Firebase (nenhuma leitura nem escrita registrada)', io.length === 0, io.slice(0, 5));
    t('Ana: 4 abas (sem Frota e sem Administração)', (await tabs(p)).length === 4, await tabs(p));
    t('Ana: farol 🟢 do 1:1 com as folgas descontadas e o último 1:1 de 6 dias', /Em dia/.test(await txt(p)) && /há 6 dias/.test(await txt(p)) && /2 dias de folga descontados/.test(await txt(p)), (await txt(p)).slice(0, 200));
    t('Ana: Mural de Estrelas com 5 e Baú com 16 itens', /Mural de Estrelas\s*5/.test(await txt(p)) && /Meu Baú\s*16/.test(await txt(p)), '');
    t('Ana: o humor de hoje ainda não foi marcado (a demo deixa o dia para você preencher)', (await p.locator('.faces button[aria-pressed="true"]').count()) === 0, '');
    await aba(p, 'bau'); t('Baú: 16 itens dos 4 tipos', (await p.locator('#painel [data-act="bau-del"]').count()) === 16 && /Estrela de/.test(await txt(p)) && /Desafio:/.test(await txt(p)), await p.locator('#painel [data-act="bau-del"]').count());
    await aba(p, 'diario'); const dias = await p.locator('#painel [data-act="dia-del"]').count(); t('Diário: dezenas de dias em ~6 meses, com os meses antigos recolhidos', dias >= 40 && (await p.locator('#painel details').count()) >= 5 && (await p.locator('#painel details[open]').count()) === 1, [dias, await p.locator('#painel details').count()]);
    await aba(p, 'aval'); const av = await txt(p); t('Avaliação: Ciclo 2026/2 em Coleta (autoavaliação parcial, par aguardando aprovação) e Ciclo 2026/1 Encerrado com a devolutiva e a ciência', /Ciclo 2026\/2/.test(av) && /Ciclo 2026\/1/.test(av) && /Aguardando aprovação/.test(av) && /Ótimo ciclo\. Reconhecemos/.test(av) && /Ciência registrada/.test(av), av.slice(0, 200));
    t('Avaliação: a devolutiva do ciclo atual está TRAVADA e o feedback dos pares não aparece', (await p.locator('.trava').count()) === 1 && !/feedback da Bia|Continuar compartilhando conhecimento/.test(await p.locator('#painel textarea').evaluateAll(l => l.map(x => x.value).join('|'))), '');
    t('Avaliação: ela também aparece como par (feedback para a Bia)', /Feedback para Bia Souza/.test(av), '');
    t('sem erro de JS', !errs.length, errs); await ctx.close(); }
  { const { ctx, p } = await abre('&como=pau&tab=frota');
    t('?como=pau&tab=frota abre direto na Frota do líder', /Frota/.test(await txt(p)) && (await p.locator('.pcard').count()) === 6, await p.locator('.pcard').count());
    const f = await txt(p); t('Frota: termômetro com respostas e a contagem de quem compartilha (4 de 6)', /Termômetro do time/.test(f) && /respostas de\s*4\s*de 6 pessoas/.test(f.replace(/\n/g, ' ')), f.slice(0, 300));
    t('Frota: Cauê marcou mal ontem → "Pra ficar de olho"; Bia e Cauê com 🔴 (atrasados), Eduardo 🟡, Ana/Débora/Fabiana 🟢', /Pra ficar de olho/.test(f) && (await p.locator('.pcard', { hasText: 'Cauê Matos' }).innerText()).includes('Atrasado') && (await p.locator('.pcard', { hasText: 'Bia Souza' }).innerText()).includes('Atrasado') && (await p.locator('.pcard', { hasText: 'Eduardo Nunes' }).innerText()).includes('Atenção') && (await p.locator('.pcard', { hasText: 'Ana Lima' }).innerText()).includes('Em dia'), '');
    await p.click('.pcard:has-text("Ana Lima") [data-act="abrir"]'); await p.click('[data-act="sel-aba"][data-k="aval"]'); await p.waitForTimeout(500);
    const d = await p.locator('#detalhe').innerText(); t('o líder vê os DOIS ciclos da Ana (o encerrado só leitura, sem botões de editar)', /Ciclo 2026\/2/.test(d) && /Ciclo 2026\/1/.test(d) && /Ciclo encerrado — só leitura/.test(d), d.slice(0, 200));
    t('o líder NÃO vê o diário da Ana (sem aba)', !/Diário/.test(await p.locator('#detalhe .tabs').innerText()), ''); await ctx.close(); }
  { const { ctx, p } = await abre('&como=gil&tab=frota'); t('Gil (gerente): 2 POs como liderados e o time ampliado só com farol', (await p.locator('.pcard').count()) === 10 && (await p.locator('.pcard [data-act="abrir"]').count()) === 2, await p.locator('.pcard').count()); await ctx.close(); }
  { const { ctx, p } = await abre('&como=dan&tab=admin'); const a = await txt(p); t('Dani (RH): vê Administração com o organograma e os 2 ciclos; NÃO vê o bloco de papel de RH nem o conteúdo de ninguém', /Organograma/.test(a) && /Ciclo 2026\/1/.test(a) && !/Papel de RH da Travessia/.test(a) && !(await tabs(p)).some(x => /Frota/.test(x)), await tabs(p));
    t('organograma completo (11 pessoas com líder)', (await p.locator('select[data-campo="liderUid"]').evaluateAll(l => l.filter(s => s.value).length)) >= 10, ''); await ctx.close(); }
  { const { ctx, p } = await abre('&como=adm&tab=admin'); t('Adm (ADM): vê também o bloco de papel de RH, com a Dani marcada', /Papel de RH da Travessia/.test(await txt(p)) && (await p.locator('[data-rh="dan"]').isChecked()), ''); await ctx.close(); }
  { const { ctx, p } = await abre('&como=bia'); await aba(p, 'aval'); t('Bia (colega): vê o pedido para dar feedback à Ana e o pedido de pares da própria avaliação', /Feedback para Ana Lima/.test(await txt(p)) && /Ciclo 2026\/2/.test(await txt(p)), ''); await ctx.close(); }
  // trocar de persona e gravar no demo não persiste
  { const { ctx, p } = await abre(); await pers(p, 'pau'); t('o seletor troca a pessoa e volta para a primeira aba', /Olá, Pau/.test(await p.locator('.h1').innerText()) && (await tabs(p)).some(x => /Frota/.test(x)), await tabs(p));
    await pers(p, 'ana'); await aba(p, 'diario'); await p.locator('[data-act="dia-n"][data-n="5"]').click(); await p.fill('#dia-txt', 'Teste do modo demonstração'); await p.click('#painel button:has-text("Salvar o dia")'); await p.waitForTimeout(500); t('gravar no demo funciona na tela (o dia aparece no diário)', /Teste do modo demonstração/.test(await txt(p)), '');
    await p.reload(); await p.waitForSelector('#app .h1'); await p.waitForTimeout(600); await aba(p, 'diario'); t('recarregar volta ao início: o que foi gravado no demo NÃO persiste', !/Teste do modo demonstração/.test(await txt(p)), '');
    const io = await p.evaluate(() => (window.__log || []).filter(l => l[0] === 'set' || l[0] === 'remove')); t('mesmo gravando, nenhuma escrita chegou ao Firebase', io.length === 0, io); await ctx.close(); }
  // celular e temas: sem rolagem lateral
  for (const [vp, nome] of [[{ width: 390, height: 800 }, 'cel'], [{ width: 1280, height: 900 }, 'desk']]) for (const [como, tab] of [['ana', 'inicio'], ['ana', 'aval'], ['pau', 'frota'], ['dan', 'admin']]) for (const tema of ['', 'light', 'sunset']) {
    const { ctx, p, errs } = await abre('&como=' + como + '&tab=' + tab, vp); if (tema) for (let i = 0; i < (tema === 'light' ? 1 : 2); i++) await p.click('#btn-tema'); await p.waitForTimeout(300);
    const lat = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); t(`${nome}/${tema || 'escuro'}/${como}-${tab}: sem rolagem lateral e sem erro`, !lat && !errs.length, [lat, errs]);
    if (process.env.PRINTS) { fs.mkdirSync(process.env.PRINTS, { recursive: true }); await p.screenshot({ path: `${process.env.PRINTS}/${nome}_${tema || 'escuro'}_${como}_${tab}.png`, fullPage: true }); } await ctx.close(); }
  await b.close(); console.log(ok ? 'TUDO OK' : 'HÁ FALHAS'); })();
