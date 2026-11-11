// 🏝️ Validação do painel aberto da Ilha (redesenho de 11/11/2026). Cole no console (F12) do kanban-dev.html logado, com a ilha
// LIGADA (⏲ Timers → 🏝️ Ilha Dinâmica). Só lê a tela: abre o painel, confere e fecha. Teste também no celular e no tema claro.
(async () => {
  const r = [], ok = (o, c, d) => r.push({ o, '': c ? '✅' : '❌', detalhe: d || '' });
  if (typeof _ilhaAbrir !== 'function') { console.error('❌ Abra no kanban-dev.html.'); return; }
  if (!_ilhaPrefs().on) { console.error('❌ Ligue a ilha antes: ⏲ Timers → 🏝️ Ilha Dinâmica.'); return; }
  _ilhaAbrir(); await new Promise(f => setTimeout(f, 400));
  const pn = document.getElementById('ilha-painel'), a = pn.getBoundingClientRect();
  ok('painel inteiro na tela', a.left >= 0 && a.right <= innerWidth && a.bottom <= innerHeight + 1, Math.round(a.left) + '→' + Math.round(a.right) + ' de ' + innerWidth);
  ok('botões nas laterais (ou na faixa de baixo, no celular)', !!document.querySelector('.ilha-trilho.esq .ilha-aba') && !!document.querySelector('.ilha-trilho.dir .ilha-aba[data-aba="ajustes"]'));
  const abas = [...document.querySelectorAll('#ilha-painel .ilha-aba')].map(x => x.dataset.aba); const lateral = [];
  for (const id of abas) { document.querySelector(`#ilha-painel .ilha-aba[data-aba="${id}"]`).click(); await new Promise(f => setTimeout(f, 120)); const c = document.querySelector('#ilha-painel .ilha-corpo'); if (c && (c.scrollWidth > c.clientWidth + 1 || c.scrollLeft)) lateral.push(id); }
  ok('nenhuma aba rola para o lado', !lateral.length, lateral.join(', ') || abas.length + ' abas conferidas');
  document.querySelector('#ilha-painel .ilha-aba[data-aba="resumo"]').click(); await new Promise(f => setTimeout(f, 120));
  const tiles = [...document.querySelectorAll('#ilha-painel .ilha-tile')].map(x => x.dataset.ir);
  ok('Resumo com um bloco por módulo ligado', tiles.length >= 2, tiles.join(', '));
  ok('sem botão dentro de botão', !document.querySelector('#ilha-painel button button, #ilha-painel [role="button"] button'));
  ok('página sem rolagem lateral', document.documentElement.scrollWidth <= innerWidth);
  _ilhaFechar(false);
  console.table(r);
})();
