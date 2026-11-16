// Maré dev → Ilha Dinâmica → Avisos. Só leitura: não altera dados nem marca lidas.
(() => {
  const lista = document.getElementById('notif-list');
  if(!lista || !lista.closest('.ilha-sino')){ console.warn('Abra Ilha Dinâmica → Avisos antes de rodar.'); return []; }
  const itens = [...lista.querySelectorAll('.notif-item')], gruposFamiliaTeste = [...lista.querySelectorAll('.ilha-notif-grupo')];
  const familias = ['pessoal','calendario','radar','sistema'];
  const esperados = ['sistema','calendario','resto'].filter(f=>itens.some(n=>f==='resto' ? !['sistema','calendario'].includes(n.dataset.familia) : n.dataset.familia===f));
  const testes = [
    ['Catálogo completo com família e rótulo', MareNotif.TIPOS.every(t=>familias.includes(t.familia) && t.rotulo && MareNotif.aparencia(t.id).familia===t.familia)],
    ['Itens preservados do sino', itens.length===_ilha.notifs.length],
    ['Famílias com faixa, selo e rótulo', itens.every(n=>familias.includes(n.dataset.familia) && parseFloat(getComputedStyle(n).borderLeftWidth)>=3 && n.querySelector('.notif-familia') && n.querySelector('.notif-tipo'))],
    ['Ordem dos gruposFamiliaTeste e nenhum grupo vazio', JSON.stringify(gruposFamiliaTeste.map(h=>h.dataset.grupo))===JSON.stringify(esperados)],
    ['Contagem de não lidas preservada', itens.filter(n=>n.classList.contains('unread')).length===_ilhaNaoLidas()]
  ].map(([teste,ok])=>({teste,resultado:ok?'✅':'❌'}));
  window._resultadosTeste = testes; console.table(testes); return testes;
})();
