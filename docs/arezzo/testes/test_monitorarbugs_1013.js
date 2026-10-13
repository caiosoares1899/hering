// /monitorarbugs (13/10) — Escala JPG + módulo de Metas. Cada cenário reproduz um achado real (falha no código antigo, passa no corrigido).
//  1. Esc no formulário de meta fechava também o ⚙ Configurações que está por baixo (o handler do módulo não parava o evento)
//  2. Excluir meta deixava o histórico dos valores órfão (metas_log/{id} só tem .write em {k}: apagar o nó-pai é negado e o erro era engolido)
//  3. "+ Somar ao atual" somava ao valor visto quando o modal abriu (outra pessoa somou nesse meio-tempo = soma perdida; e o marco podia DESCER)
//  4. 99,7 % aparecia como "100%" sem ser meta batida
//  5. Escala JPG: fechar e reabrir o modal reiniciava o contador de chamadas — resposta velha sobrescrevia a imagem do período novo
const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fake = require('./fakefb.js'); const S = require('./seed_metas.js');
const K = process.env.K || 'kanban-dev', SFX = /-dev$/.test(K) ? '_dev' : '';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] }); let ok = true;
  const t = (n, c, d) => { if (!c) ok = false; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : '  ← ' + JSON.stringify(d).slice(0, 400))); };
  const U = S.U('eve', 'Eve Souza');
  const abre = async (papel, o) => {
    o = o || {};
    const seed = S.seed(papel, { semMarcoFresco: true }); if (o.mut) o.mut(seed);
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await fake.install(ctx, seed);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto('http://localhost:8941/' + K + '.html?squad=dev'); await p.waitForFunction(() => !!window.__authCb); await p.evaluate(x => window.__authCb(x), U); await p.waitForTimeout(3000);
    await p.evaluate(() => document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open')));
    return { ctx, p, errs };
  };
  const store = (p, path) => p.evaluate(pa => { let o = window.__store; pa.split('/').forEach(k => { o = o == null ? o : o[k]; }); return o == null ? null : JSON.parse(JSON.stringify(o)); }, path);

  // 1 ─ Esc fecha só o formulário
  { const { ctx, p, errs } = await abre('po');
    await p.evaluate(() => { openCfg('metas'); metasNova('desafio'); }); await p.waitForTimeout(400);
    t('formulário "Novo desafio" aberto por cima do ⚙ Configurações', await p.evaluate(() => !!document.querySelector('.mm-ov') && document.getElementById('cfg-ov').classList.contains('open')), 0);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    t('Esc fecha o formulário…', await p.evaluate(() => !document.querySelector('.mm-ov')), 0);
    t('…e o ⚙ Configurações que estava por baixo CONTINUA aberto', await p.evaluate(() => document.getElementById('cfg-ov').classList.contains('open')), 0);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    t('um 2º Esc (agora sem formulário) fecha o ⚙ Configurações', await p.evaluate(() => !document.getElementById('cfg-ov').classList.contains('open')), 0);
    // vazamento do handler: abrir e cancelar N formulários não deixa ouvintes de Esc pendurados fazendo trabalho
    t('sem erro de JS (Esc)', !errs.length, errs); await ctx.close(); }

  // 2 ─ excluir a meta apaga o histórico (regras: metas_log/{id} só tem .write em {chave})
  { const { ctx, p } = await abre('po');
    await p.evaluate(() => { window.__denySet = (pa, v) => v === null && /^kanban\/metas_log(_dev)?\/[^/]+$/.test(pa); });   // emula as regras: apagar o nó-pai do histórico é NEGADO
    t('antes: a meta "a" tem 14 valores no histórico', Object.keys(await store(p, 'kanban/metas_log' + SFX + '/a') || {}).length === 14, 0);
    await p.evaluate(() => MareMetas.remover(MareMetas.achar('a', 'squad', 'dev'))); await p.waitForTimeout(400);
    t('a meta some', (await store(p, 'kanban/metas_squads' + SFX + '/dev/a')) == null, 0);
    const resto = await store(p, 'kanban/metas_log' + SFX + '/a');
    t('o histórico dos valores também some (nada órfão no banco)', !resto || !Object.keys(resto).length, resto && Object.keys(resto).length);
    await ctx.close(); }

  // 3 ─ somar usa o valor MAIS NOVO; o marco nunca desce
  { const { ctx, p } = await abre('po');
    await p.evaluate(() => toggleDados()); await p.waitForTimeout(500);
    await p.click('#dados-pane .mm-card[data-mm-id="b"] [data-mm-act="reg"]'); await p.waitForTimeout(300);
    await p.click('.mm-md [data-m="somar"]'); await p.fill('#mm-r-v', '20');
    await p.evaluate(sfx => window._set(window._ref(window._db, 'kanban/metas_squads' + sfx + '/dev/b/atual'), 230), SFX); await p.waitForTimeout(300);   // outra pessoa informou 230 enquanto o modal estava aberto
    await p.fill('#mm-r-v', '21'); await p.fill('#mm-r-v', '20');   // a pessoa continua digitando
    t('a prévia já parte do valor mais novo (230 + 20 = 250)', /250/.test(await p.innerText('#mm-r-p')), await p.innerText('#mm-r-p'));
    await p.click('#mm-r-ok'); await p.waitForTimeout(500);
    t('gravou 250 (não 200 = 180 + 20, que apagaria a soma da outra pessoa)', (await store(p, 'kanban/metas_squads' + SFX + '/dev/b/atual')) === 250, await store(p, 'kanban/metas_squads' + SFX + '/dev/b/atual'));
    await ctx.close(); }
  { const { ctx, p } = await abre('po');
    await p.evaluate(() => toggleDados()); await p.waitForTimeout(500);
    await p.click('#dados-pane .mm-hero [data-mm-act="reg"]'); await p.waitForTimeout(300);   // meta "a": 840 mil de 2 mi (42 %, marco 40)
    await p.fill('#mm-r-v', '1300000');                                                          // 65 % → marco 60 …
    await p.evaluate(sfx => window._update(window._ref(window._db, 'kanban'), { ['metas_squads' + sfx + '/dev/a/marco']: 80 }), SFX); await p.waitForTimeout(300);   // …mas outra pessoa já tinha levado o marco a 80
    await p.click('#mm-r-ok'); await p.waitForTimeout(500);
    t('o marco já conquistado (80) não desce pra 60', (await store(p, 'kanban/metas_squads' + SFX + '/dev/a/marco')) === 80, await store(p, 'kanban/metas_squads' + SFX + '/dev/a/marco'));
    await ctx.close(); }

  // 4 ─ 99,7 % não é "100%"
  { const { ctx, p } = await abre('po', { mut: s => { s.kanban['metas_squads' + SFX].dev.a.atual = 1994000; } });
    await p.evaluate(() => toggleDados()); await p.waitForTimeout(500);
    const anel = (await p.innerText('#dados-pane .mm-hero .mm-ring-c')).replace(/\s+/g, ' ').trim(), hero = await p.innerText('#dados-pane .mm-hero');
    t('anel de 99,7 % mostra "99%" (não "100%") e não diz "batida"', /^99%/.test(anel) && !/batida/i.test(hero), anel);
    await ctx.close(); }
  await b.close();

  // 5 ─ Escala: resposta velha do JPG não sobrescreve o período novo
  { const b2 = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
    const pad = n => String(n).padStart(2, '0'), iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const hoje = new Date(), P = { ana: { uid: 'ana', nome: 'Ana Lima', init: 'AL', email: 'ana@ciahering.com.br', role: 'po', squads: { dados: true }, squads_roles: { dados: 'po' } } };
    const seed = { kanban: { usuarios_publicos: P, escala: { [iso(hoje)]: { dados: { ana: { t: 'trab', por: 'ana', ts: 1 } } } } } };
    const ctx = await b2.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }); await fake.install(ctx, seed);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8941/escala-dev.html?squad=dados'); await p.waitForFunction(() => !!window.__authCb);
    await p.evaluate(x => window.__authCb(x), S.U('ana', 'Ana Lima')); await p.waitForTimeout(1200);
    // a 1ª leitura do JPG (semana) demora 900 ms; a seguinte (dia) responde logo
    await p.evaluate(() => { let n = 0; window.__getDelay = pa => (pa === 'kanban/escala' ? (++n === 1 ? 900 : 60) : 0); });
    await p.click('#b-jpg'); await p.waitForTimeout(100);
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);                 // fecha o modal com a leitura ainda pendente
    await p.click('th.dia >> nth=0'); await p.waitForTimeout(150);       // abre o dia…
    await p.click('#d-jpg'); await p.waitForTimeout(1600);                          // …e pede o JPG do dia (modo Dia)
    const modo = await p.evaluate(() => document.querySelector('#j-modo [aria-selected="true"]')?.dataset.m);
    const larg = await p.evaluate(() => { const c = document.querySelector('#j-prev canvas'); return c ? c.width : 0; });
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#j-baixar')]);
    const buf = require('fs').readFileSync(await dl.path());
    let w = 0; for (let i = 2; i < buf.length - 9; i++) if (buf[i] === 0xFF && (buf[i + 1] === 0xC0 || buf[i + 1] === 0xC2)) { w = buf.readUInt16BE(i + 7); break; }
    t('a prévia é a do DIA (860 px de largura ×2)', modo === 'dia' && larg === 1720, { modo, larg });
    t('…e o arquivo baixado também é a imagem do DIA (não a da semana atrasada) e o nome diz "dia"', w === 1720 && /-dia-/.test(dl.suggestedFilename()), { w, nome: dl.suggestedFilename() });
    t('sem erro de JS (Escala)', !errs.length, errs); await ctx.close(); await b2.close(); }

  console.log(ok ? '\nTUDO OK' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1);
})();
