// ADM: abrir oceano-dev.html → F12 → Console. Só leitura; execute durante a espera e novamente após carregar.
(() => {
  const resultados = [], verificar = (teste, ok) => resultados.push({teste, resultado:ok?'✅':'❌'});
  const meta=document.getElementById('col-meta'), mural=document.getElementById('mural-wrap');
  verificar('Página de desenvolvimento do Oceano', /oceano-dev\.html$/.test(location.pathname));
  verificar('Blocos da home existem', !!meta && !!mural);
  if(meta && mural) {
    const metaEspera=meta.getAttribute('aria-busy')==='true', muralEspera=mural.getAttribute('aria-busy')==='true';
    verificar('Meta reserva espaço ou já encerrou a espera', !metaEspera || meta.getBoundingClientRect().height>=300);
    verificar('Mural reserva espaço ou já encerrou a espera', !muralEspera || mural.getBoundingClientRect().height>0);
    verificar('Meta: conteúdo substitui o esqueleto', metaEspera || !document.querySelector('.meta-esqueleto'));
    verificar('Mural: conteúdo substitui o esqueleto', muralEspera || !mural.querySelector('.mural-esqueleto') || getComputedStyle(mural).display==='none');
    verificar('Estado recolhido do Mural respeita o botão', getComputedStyle(mural).display==='none' || document.getElementById('mural-corpo').hidden===(document.getElementById('mural-hd').getAttribute('aria-expanded')!=='true'));
  }
  verificar('Sem rolagem lateral', document.documentElement.scrollWidth<=innerWidth+1);
  console.table(resultados);
  return resultados;
})();
