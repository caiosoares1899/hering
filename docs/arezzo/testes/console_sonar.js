/* 🔍 Sonar — conferência rápida (SÓ LEITURA: não grava nada no banco nem no aparelho).
   Como usar: abra oceano(-dev).html ou kanban(-dev).html?squad=<seu squad>, logado, espere carregar, abra o console (Cmd+Option+J / F12), cole e dê Enter. */
(() => {
  const dev = /-dev\.html/.test(location.pathname);
  const out = [], ok = (c, txt, extra) => out.push({ok: c ? '✅' : '❌', item: txt, detalhe: extra === undefined ? '' : String(extra)});
  const S = window.MareSonar;
  ok(!!S, 'Módulo do Sonar carregado (window.MareSonar)');
  const tag = [...document.scripts].map(s => s.getAttribute('src') || '').find(s => /mare-sonar(-dev)?\.js/.test(s)) || '';
  ok(dev ? /mare-sonar-dev\.js\?v=\d+/.test(tag) : /^mare-sonar\.js\?v=\d+/.test(tag), 'Arquivo do módulo certo para esta página (' + (dev ? 'dev' : 'prod') + ')', tag);
  const chave = 'oceano_sonar_radar' + (dev ? '_dev' : ''), outra = 'oceano_sonar_radar' + (dev ? '' : '_dev');
  let c = null; try { c = JSON.parse(localStorage.getItem(chave) || 'null'); } catch (e) {}
  if (c && c.t) {
    const min = Math.round((Date.now() - c.t) / 60000), n = Object.keys((c.v && c.v.objs) || {}).length, m = ((c.v && c.v.marcos) || []).length;
    ok(min <= 180, 'Cópia do Radar neste aparelho com menos de 3 h', 'há ' + min + ' min · ' + n + ' Objetivos · ' + m + ' Marcos · ' + (localStorage.getItem(chave).length / 1024).toFixed(1) + ' KB');
  } else ok(true, 'Ainda não há cópia do Radar neste aparelho (é criada na 1ª busca que pede o Radar)');
  ok(true, 'Cópia do outro ambiente (' + (dev ? 'prod' : 'dev') + ') neste navegador: ' + (localStorage.getItem(outra) ? 'existe (normal se você usa os dois)' : 'não existe'));
  const rec = Object.keys(localStorage).filter(k => /sonar_recentes/.test(k));
  ok(true, 'Recentes guardados neste aparelho', rec.map(k => k + ': ' + ((() => { try { return JSON.parse(localStorage.getItem(k)).length; } catch (e) { return '?'; } })()) + ' itens').join(' · ') || 'nenhum');
  if (S) {
    ok(S._separaMeus(['minha', 'meta']).meus === true, '"minha" ativa o filtro de responsável');
    ok(S._paginaOk('okr.html?okr=x') && !S._paginaOk('javascript:alert(1)'), 'Só abre páginas da família');
    ok(S._linkOk('javascript:alert(1)') === '', 'Link "javascript:" é recusado');
  }
  console.table(out);
  return out.filter(x => x.ok === '❌').length ? 'Há itens ❌ — mande o print da tabela.' : 'Sonar OK neste aparelho.';
})();
