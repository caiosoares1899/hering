// Maré dev → Console. Só mede a toolbar; não altera tela nem banco.
(() => {
  const barra = document.getElementById('main-toolbar');
  if (!barra) throw new Error('Abra o Maré dev com o board visível.');
  const r = barra.getBoundingClientRect();
  const botoes = [...barra.querySelectorAll('button')]
    .map(b => b.getBoundingClientRect()).filter(b => b.width && b.height);
  const topo = Math.min(...botoes.map(b => b.top - r.top));
  const base = Math.min(...botoes.map(b => r.bottom - b.bottom));
  window._resultadosTeste = [
    { teste: 'Folga acima dos botões', resultado: topo >= 3 ? '✅' : '❌', detalhe: topo + ' px' },
    { teste: 'Folga abaixo dos botões', resultado: base >= 3 ? '✅' : '❌', detalhe: base + ' px' },
    { teste: 'Página sem rolagem lateral', resultado: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 ? '✅' : '❌', detalhe: 'A toolbar mantém a própria rolagem horizontal.' }
  ];
  console.table(window._resultadosTeste);
})();
