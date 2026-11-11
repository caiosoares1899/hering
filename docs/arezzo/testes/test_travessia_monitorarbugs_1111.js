// 🧭 Travessia — cultura Hering (11/11/2026, pedido do Caio): as 5 atitudes do A Bordo no 1:1 ("atitude em foco") e na avaliação
// (autoavaliação, par e líder, num nó irmão `atitudes/` para o prod não apagar). Também: resumo do time na Frota, interruptor por ciclo no Admin.
// Roda no modo demonstração (grava só na memória da aba; `window.Travessia.demoMem` mostra o que foi "gravado").
// Rodar: python3 -m http.server 8961 --directory . (na raiz) e `node docs/arezzo/testes/test_travessia_cultura.js` (BASE_URL troca o servidor).
const fs = require('fs'), path = require('path'), home = require('os').homedir();
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || path.join(home, 'hering-tools/playwright/node_modules/playwright'));
const fake = require('./fakefb');
const cr = path.join(home, 'hering-tools/chrome'), chrome = process.env.CHROME || path.join(cr, fs.readdirSync(cr).find(n => n.startsWith('mac_arm-')), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const base = process.env.BASE_URL || 'http://127.0.0.1:8961';
// Regressões: cada cenário abaixo descreve o resultado errado SEM o fix. Não executado no sandbox.
(async () => {
  const b = await chromium.launch({ executablePath: chrome }); let total = 0, falhas = 0;
  const t = (nome, ok) => { total++; if (!ok) falhas++; console.log((ok ? '✅ ' : '❌ ') + nome); };
  const abre = async (como = 'ana', tab = 'inicio') => {
    const ctx = await b.newContext(); await fake.install(ctx, {}); const p = await ctx.newPage();
    await p.goto(base + '/travessia-dev.html?demo=1&como=' + como + '&tab=' + tab);
    await p.waitForSelector('#painel .gl'); return { ctx, p };
  };
  const muda = async (p, tab) => { await p.locator('.nav [data-tab="' + tab + '"]').click(); await p.waitForSelector('#painel .gl'); };
  const render = p => p.evaluate(() => { window.Travessia.estado.cache = {}; return window.Travessia.render(); });
  try {
    // Sem fix: o input ainda não foi guardado (debounce de 600 ms); trocar de aba destrói o nó.
    { const {ctx, p} = await abre('ana', 'aval');
      const q = 'textarea[data-resp="auto"]:not([readonly])';
      await p.locator(q).first().fill('Rascunho imediato de teste');
      await muda(p, 'inicio'); await muda(p, 'aval');
      t('rascunho sobrevive à navegação imediata', await p.locator(q).first().inputValue() === 'Rascunho imediato de teste');
      // Sem fix: apagar uma resposta remove o rascunho; o valor do banco reaparece.
      await p.locator(q).first().fill(''); await muda(p, 'inicio'); await muda(p, 'aval');
      t('rascunho preserva resposta apagada', await p.locator(q).first().inputValue() === '');
      const box = p.locator('.cult-bloco').first();
      await box.locator('textarea').fill('Exemplo independente das respostas');
      await muda(p, 'inicio'); await muda(p, 'aval');
      t('exemplo de atitudes usa rascunho independente', await p.locator('.cult-bloco').first().locator('textarea').inputValue() === 'Exemplo independente das respostas');
      // Readonly: mesmo havendo rascunho, o ciclo fora de coleta mostra o banco.
      await p.evaluate(() => { window.Travessia.estado.ciclos.c2026s2.status = 'encerrado'; return window.Travessia.render(); });
      t('rascunho não altera textarea readonly', await p.locator('textarea[data-resp="auto"]').first().evaluate(e => e.readOnly && e.value === e.defaultValue));
      await ctx.close(); }
    // Sem fix: desmarcar tudo e limpar exemplo retorna antes da gravação, mantendo marcações no banco.
    { const {ctx, p} = await abre('ana', 'aval'); const box = () => p.locator('.cult-bloco').first();
      await box().locator('[data-at="facilita"]').click(); await box().locator('textarea').fill('Um exemplo');
      await box().locator('[data-act="at-salvar"]').click(); await p.waitForTimeout(200);
      for (const el of await box().locator('[aria-pressed="true"]').all()) await el.click();
      await box().locator('textarea').fill(''); await box().locator('[data-act="at-salvar"]').click(); await p.waitForTimeout(200);
      t('salvar vazio limpa atitudes anteriores', await p.evaluate(() => { const a = window.Travessia.demoMem.kanban.travessia.avaliacoes.c2026s2.ana.atitudes.auto; return a && a.ts && !a.at && !a.atx; }));
      await ctx.close(); }
    // Sem fix: enc-inicio e humorPend são reaproveitados pela nova pessoa.
    { const {ctx, p} = await abre();
      await p.locator('[data-at-grupo="enc"] [data-at="legado"]').click();
      await p.locator('[data-act="humor"][data-n="1"]').click(); await p.waitForSelector('[data-act="humor-desfazer"]');
      await p.selectOption('#demo-persona', 'bia'); await p.waitForFunction(() => window.Travessia.estado.me.uid === 'bia' && !!document.querySelector('#enc-d'));
      t('troca de pessoa limpa escolhas em memória', await p.locator('[data-at-grupo="enc"] [aria-pressed="true"]').count() === 0);
      t('troca de pessoa encerra humor pendente', !await p.evaluate(() => window.Travessia.humorPendente()));
      t('aviso continua pertencendo à pessoa original', await p.evaluate(() => Object.keys(window.Travessia.demoMem.kanban.usuarios.pau.notificacoes || {}).some(k => k.startsWith('apoio_ana_'))));
      t('nova pessoa não recebe Desfazer de outra', await p.locator('[data-act="humor-desfazer"]').count() === 0);
      await ctx.close(); }
    // Sem fix: String(undefined), lixo e datas futuras entram na comparação >= lim; constructor é id aceito.
    { const {ctx, p} = await abre('pau', 'frota');
      const conta = () => p.locator('.at-barras li > b').allTextContents(); const antes = await conta();
      await p.evaluate(() => { const enc = window.Travessia.demoMem.kanban.travessia.encontros.ana;
        [undefined, 'zzz', '2099-01-01', '2026-02-31'].forEach((data, i) => enc['invalido' + i] = {data, at: 'facilita', por: 'ana', ts: 1});
        enc.herdado = {data: new Date().toLocaleDateString('sv-SE'), at: 'constructor', por: 'ana', ts: Date.now()}; });
      await render(p); t('Frota ignora datas inválidas e futuras', JSON.stringify(await conta()) === JSON.stringify(antes));
      await p.locator('[data-act="abrir"][data-uid="ana"]').click(); await p.waitForSelector('#detalhe');
      t('id herdado não vira chip de atitude', !/undefined/.test(await p.locator('#detalhe').innerText())); await ctx.close(); }
    // Vizinhos explicitamente pedidos no contrato: ciclo sem participantes e cache sem cultura.
    { const {ctx, p} = await abre();
      t('próxima ação tolera ciclo sem participantes', await p.evaluate(() => { const v = window.Travessia; return v.proximaAcao({me: 'ana', ciclos: {vazio: {status: 'coleta'}}, avals: {}, bau: {}, hoje: '2026-11-11'}).tab === 'bau'; }));
      await p.evaluate(() => { window.Travessia.estado.ciclos.c2026s2.cultura = false; window.Travessia.estado.cache = {}; return window.Travessia.render(); });
      await muda(p, 'aval'); t('cultura desligada não desenha bloco de atitudes', await p.locator('.cult-bloco').count() === 0);
      await ctx.close(); }
  } finally { await b.close(); }
  console.log(`${total - falhas}/${total} ok`); process.exitCode = falhas ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
