// Abra um card no kanban-dev.html e cole no Console. Só leitura; não grava no Firebase.
(() => {
  const panel = document.querySelector('#card-ov.open .card-panel');
  if (!panel) { console.warn('Abra um card no Maré dev antes de rodar o teste.'); return []; }
  const toque = matchMedia('(hover:none) and (pointer:coarse)').matches;
  const controles = [...panel.querySelectorAll('#m-checklist button,#m-checklist .cl-group-handle,.panel-hd .x-btn')]
    .filter(el => el.getBoundingClientRect().width > 0);
  const testes = [
    ['Modal sem rolagem lateral', panel.scrollWidth <= panel.clientWidth + 1],
    ['Ações do cabeçalho com nome acessível', [...panel.querySelectorAll('.panel-hd .x-btn')].every(el => !!el.getAttribute('aria-label'))],
    ['Nomes dos checklists identificados', [...panel.querySelectorAll('.cl-group-title')].every(el => !!el.getAttribute('aria-label'))],
    ['Alvos de toque com pelo menos 44 px (quando em toque)', !toque || controles.every(el => { const r = el.getBoundingClientRect(); return r.width >= 43.9 && r.height >= 43.9; })]
  ].map(([teste, passou]) => ({ teste, resultado: passou ? '✅' : '❌' }));
  console.table(testes);
  return testes;
})();
