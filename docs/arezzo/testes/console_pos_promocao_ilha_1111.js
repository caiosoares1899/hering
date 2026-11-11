// Cole no console do kanban.html de PRODUÇÃO, já logado, depois do merge.
// Só leitura: abre e fecha Minhas preferências, sem alterar opções nem gravar dados.
(function conferirIlhaPromocao1111() {
  const resultadosIlha1111 = [];
  function registrarIlhaPromocao1111(teste, passou, detalhe) {
    resultadosIlha1111.push({ teste, resultado: passou ? '✅' : '❌', detalhe: detalhe || '' });
  }

  const versaoIlha1111 = document.querySelector('.version')?.textContent || '';
  registrarIlhaPromocao1111('Página v8.30.943', versaoIlha1111.includes('v8.30.943'), versaoIlha1111.trim());
  registrarIlhaPromocao1111('_ilhaPrefs disponível', typeof _ilhaPrefs === 'function');
  registrarIlhaPromocao1111('_ilhaIntroAbrir disponível', typeof _ilhaIntroAbrir === 'function');
  registrarIlhaPromocao1111('_ilhaPrefsLigar disponível', typeof _ilhaPrefsLigar === 'function');
  registrarIlhaPromocao1111('MareTimer disponível', typeof MareTimer === 'object');
  const popupTimersIlha1111 = document.querySelector('#tm-pop');
  registrarIlhaPromocao1111('⏲ Timers sem botão da Ilha', !!popupTimersIlha1111 && !popupTimersIlha1111.querySelector('#ilha-ligar'));
  registrarIlhaPromocao1111('Script mare-dicas.js?v=14 carregado', !!document.querySelector('script[src*="mare-dicas.js?v=14"]'));
  registrarIlhaPromocao1111('MareDicas disponível', typeof MareDicas !== 'undefined' && MareDicas !== null);

  try {
    if (typeof openMinhasPrefs !== 'function' || typeof closeOv !== 'function') {
      registrarIlhaPromocao1111('Ilha em Minhas preferências', false, 'Abrir/fechar preferências indisponível.');
    } else {
      try {
        openMinhasPrefs();
        registrarIlhaPromocao1111('Ilha em Minhas preferências', !!document.querySelector('#minhasprefs-body #ilha-ligar'));
      } finally {
        closeOv('minhasprefs-ov');
      }
    }
  } catch (erroIlha1111) {
    registrarIlhaPromocao1111('Abrir/conferir/fechar preferências', false, erroIlha1111.message);
  }
  window._resultadosTeste = resultadosIlha1111;
  console.table(window._resultadosTeste);
})();
