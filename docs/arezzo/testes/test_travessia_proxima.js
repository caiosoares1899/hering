// 🧭 Travessia — cartão "Próxima ação" (T4 da consultoria de 09/11/2026): UMA pendência no topo da Minha travessia, com verbo e botão.
// Confere a ordem (devolutiva > pedido de par > autoavaliação > indicar pares > 1:1 atrasado > Baú parado), o "nada pendente = sem cartão",
// e o cartão de verdade no modo demonstração (1280 e 390 px, 3 temas, botão leva à aba / ao campo do 1:1, sem rolagem lateral).
// Rodar: python3 -m http.server 8954 (na raiz) e `node docs/arezzo/testes/test_travessia_proxima.js` (BASE_URL troca o servidor).
const fs = require('fs'), path = require('path'), home = require('os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const cr = path.join(home, 'hering-tools/chrome'), chrome = process.env.CHROME || path.join(cr, fs.readdirSync(cr).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8954', out = path.join(__dirname, '..', '..', 'capturas', 'travessia-proxima');
(async () => {
  const b = await chromium.launch({ executablePath: chrome }); let falhas = 0, total = 0;
  const t = (n, c, d) => { total++; if (!c) falhas++; console.log((c ? '✅ ' : '❌ ') + n + (c ? '' : ' → ' + JSON.stringify(d).slice(0, 300))); };
  const abre = async (qs, vp, tema) => { const ctx = await b.newContext({ viewport: vp }); await fake.install(ctx, {}); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/travessia-dev.html?demo=1' + qs); await p.waitForSelector('#app .h1', { timeout: 8000 }); await p.waitForTimeout(600);
    if (tema) { await p.evaluate(x => document.documentElement.setAttribute('data-theme', x), tema); await p.waitForTimeout(150); } return { ctx, p, errs }; };

  // ── 1) a função pura: ordem e textos ──
  { const { ctx, p } = await abre('&como=ana', { width: 1280, height: 900 });
    const r = await p.evaluate(() => {
      const P = window.Travessia.proximaAcao; const hoje = '2026-11-11'; const agora = Date.parse('2026-11-10T10:00:00');
      const cic = (status, extra) => Object.assign({ nome: 'Ciclo 2026', status, participantes: { ana: true }, ts: 1 }, extra || {});
      const auto4 = { q1: 'a', q2: 'b', q3: 'c', q4: 'd' }; const bauOk = { x: { ts: agora } };
      const base = o => P(Object.assign({ me: 'ana', ciclos: {}, avals: {}, pedidos: [], respPar: {}, um: null, temLider: true, bau: bauOk, hoje, nomes: u => ({ bia: 'Bia Souza' })[u] || u }, o));
      const verm = { farol: { cor: 'vermelho', ic: '🔴', dias: 19 } };
      return {
        nada: base({}),
        devol: base({ ciclos: { c1: cic('encerrado') }, avals: { c1: { devol: { liberada: true, texto: 'x' }, ciente: null, pares: {} } }, pedidos: [{ cid: 'c2', avaliado: 'bia' }] }),
        devolCiente: base({ ciclos: { c1: cic('encerrado') }, avals: { c1: { devol: { liberada: true }, ciente: { ts: 1 }, pares: {} } } }),
        devolTrancada: base({ ciclos: { c1: cic('devolutiva') }, avals: { c1: { devol: null, pares: {} } } }),
        par: base({ ciclos: { c2: cic('coleta', { participantes: {} }) }, pedidos: [{ cid: 'c2', avaliado: 'bia' }], um: verm }),
        parRespondido: base({ ciclos: { c2: cic('coleta', { participantes: {} }) }, pedidos: [{ cid: 'c2', avaliado: 'bia' }], respPar: { 'c2:bia': { q1: 'ok' } } }),
        parForaColeta: base({ ciclos: { c2: cic('preparacao', { participantes: {} }) }, pedidos: [{ cid: 'c2', avaliado: 'bia' }] }),
        autoVazia: base({ ciclos: { c1: cic('coleta') }, avals: { c1: { auto: null, pares: {} } } }),
        autoFalta2: base({ ciclos: { c1: cic('coleta') }, avals: { c1: { auto: { q1: 'a', q2: 'b', ts: 1 }, pares: {} } } }),
        autoFalta1: base({ ciclos: { c1: cic('coleta') }, avals: { c1: { auto: { q1: 'a', q2: 'b', q3: 'c', ts: 1 }, pares: {} } } }),
        autoCompleta: base({ ciclos: { c1: cic('coleta') }, avals: { c1: { auto: auto4, pares: {} } } }),
        pares: base({ ciclos: { c1: cic('preparacao') }, avals: { c1: { pares: { bia: { aprovado: false } } } } }),
        paresOk: base({ ciclos: { c1: cic('preparacao') }, avals: { c1: { pares: { bia: {}, cae: {} } } } }),
        semAval: base({ ciclos: { c1: cic('coleta') }, avals: {} }),
        umAtras: base({ um: verm }),
        umAmarelo1: base({ um: { farol: { cor: 'amarelo', ic: '🟡', dias: 1 } } }),
        umVerde: base({ um: { farol: { cor: 'verde', ic: '🟢', dias: 3 } } }),
        umSemLider: base({ um: verm, temLider: false }),
        bauVazio: base({ bau: {} }),
        bauParado: base({ bau: { x: { ts: Date.parse('2026-10-15T10:00:00') } } }),
        bauRecente: base({ bau: { x: { ts: Date.parse('2026-10-25T10:00:00') } } }),
      };
    });
    t('nada pendente → sem cartão (null)', r.nada === null, r.nada);
    t('devolutiva liberada e sem ciência vem antes de tudo (até de pedido de par)', r.devol && r.devol.ic === '🔓' && r.devol.tab === 'aval' && /Ciclo 2026 foi liberada/.test(r.devol.txt) && r.devol.btn === 'Ler agora', r.devol);
    t('devolutiva com ciência registrada ou ainda trancada não vira cartão', r.devolCiente === null && r.devolTrancada === null, [r.devolCiente, r.devolTrancada]);
    t('pedido de par em coleta vem antes do 1:1 atrasado e usa o nome', r.par && r.par.txt === 'Bia Souza conta com o seu feedback.' && r.par.btn === 'Responder', r.par);
    t('pedido já respondido ou fora da coleta não vira cartão', r.parRespondido === null && r.parForaColeta === null, [r.parRespondido, r.parForaColeta]);
    t('autoavaliação aberta e vazia: "Começar"', r.autoVazia && r.autoVazia.btn === 'Começar' && /está aberta/.test(r.autoVazia.txt), r.autoVazia);
    t('autoavaliação pela metade: "Faltam 2 respostas" / "Falta 1 resposta"', r.autoFalta2 && r.autoFalta2.txt === 'Faltam 2 respostas na sua autoavaliação.' && r.autoFalta1.txt === 'Falta 1 resposta na sua autoavaliação.' && r.autoFalta1.btn === 'Continuar', [r.autoFalta2, r.autoFalta1]);
    t('autoavaliação completa não vira cartão', r.autoCompleta === null, r.autoCompleta);
    t('preparação com menos de 2 pares indicados: "Indicar"', r.pares && r.pares.btn === 'Indicar' && r.paresOk === null, [r.pares, r.paresOk]);
    t('ciclo sem a avaliação carregada (leitura negada) não quebra', r.semAval === null, r.semAval);
    t('1:1 vermelho/amarelo: "Seu último 1:1 foi há 19 dias." e foca o campo da data', r.umAtras && r.umAtras.txt === 'Seu último 1:1 foi há 19 dias.' && r.umAtras.foco === 'enc-d' && !r.umAtras.tab && r.umAmarelo1.txt === 'Seu último 1:1 foi há 1 dia.', [r.umAtras, r.umAmarelo1]);
    t('1:1 em dia, ou sem líder definido, não vira cartão', r.umVerde === null && r.umSemLider === null, [r.umVerde, r.umSemLider]);
    t('Baú vazio / parado há 3 semanas → cartão; recente → nada', r.bauVazio && r.bauVazio.txt === 'Seu Baú está vazio.' && r.bauParado && /3 semanas/.test(r.bauParado.txt) && r.bauParado.tab === 'bau' && r.bauRecente === null, [r.bauVazio, r.bauParado, r.bauRecente]);
    await ctx.close(); }

  // ── 2) o cartão de verdade (demo): 3 temas × 1280/390 ──
  fs.mkdirSync(out, { recursive: true });
  const TEMAS = { abrolhos: null, lencois: 'light', entardecer: 'sunset' };
  for (const [nome, tema] of Object.entries(TEMAS)) for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 800 }]) {
    const rot = nome + ' ' + vp.width + 'px'; const { ctx, p, errs } = await abre('&como=ana', vp, tema);
    const info = await p.evaluate(() => { const c = document.querySelector('#painel .prox'); if (!c) return null; const bt = c.querySelector('.btn'); const r = bt.getBoundingClientRect();
      const primeiro = document.querySelector('#painel .stack > *') === c; return { txt: c.innerText, btn: bt.textContent, h: r.height, w: r.width, primeiro, tab: bt.dataset.tab || '', act: bt.dataset.act || '' }; });
    t(rot + ': cartão no topo da Minha travessia, com texto e botão ≥ 44 px', info && info.primeiro && /Próxima ação/i.test(info.txt) && info.h >= 44, info);
    t(rot + ': sem rolagem lateral e sem erro de JS', (await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)) && !errs.length, errs);
    await p.screenshot({ path: path.join(out, nome + '-' + vp.width + '.png'), fullPage: false });
    if (nome === 'abrolhos' && vp.width === 1280 && info) {
      await p.click('#painel .prox .btn'); await p.waitForTimeout(500);
      const dep = await p.evaluate(() => ({ tab: window.Travessia.estado.tab, foco: document.activeElement && document.activeElement.id }));
      t('o botão leva aonde promete (' + (info.tab ? 'aba ' + info.tab : 'campo ' + info.act) + ')', info.tab ? dep.tab === info.tab : dep.foco === 'enc-d', [info, dep]);
    }
    await ctx.close(); }

  // ── 3) quem não tem nada pendente não vê cartão; outras pessoas da demo não quebram ──
  for (const como of ['bia', 'cae', 'pau', 'dan', 'adm']) { const { ctx, p, errs } = await abre('&como=' + como, { width: 1280, height: 900 });
    const n = await p.locator('#painel .prox').count(); const txt = n ? await p.locator('#painel .prox b').innerText() : '(sem cartão)';
    t('demo ' + como + ': no máximo 1 cartão, sem erro — ' + txt, n <= 1 && !errs.length, errs); await ctx.close(); }

  await b.close(); console.log(`\n${total - falhas}/${total} ok`); process.exit(falhas ? 1 : 0);
})();
