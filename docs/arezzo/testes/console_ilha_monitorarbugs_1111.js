// 🏝️ /monitorarbugs da Ilha (11/11/2026) — cole no console (F12) do kanban-dev.html logado, com a ilha LIGADA. Testa os 4 consertos
// com as funções reais da página e desfaz tudo o que mexeu no fim.
(async () => {
  const linhas = []; function registraTesteIlha(teste, passou, detalhe){ linhas.push({ teste, '': passou ? '✅' : '❌', detalhe: detalhe || '' }); }
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const p = _ilhaPrefs(); if (!p.on) { console.error('❌ Ligue a ilha antes: ⏲ Timers → 🏝️ Ilha Dinâmica.'); return; }
  const antes = JSON.stringify(p);
  try {
    // A) 📌 sem véu
    _ilhaAbrir(); await espera(300); _ilha.fixada = true; _ilhaRender();
    registraTesteIlha('A) com o 📌 o véu sai (quadro clicável)', !document.getElementById('ilha-veu')?.classList.contains('on'));
    _ilha.fixada = false; _ilhaRender();
    registraTesteIlha('A) sem o 📌 o véu volta', !!document.getElementById('ilha-veu')?.classList.contains('on'));
    // B) Esc com janela por cima
    _ilha.fixada = true; const c0 = (typeof cards !== 'undefined' && cards[0]) ? cards[0].id : null;
    if (c0) { openCard(c0); await espera(400); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await espera(400);
      registraTesteIlha('B) Esc fecha o card de cima e a ilha fica aberta', !document.getElementById('card-ov').classList.contains('open') && _ilha.aberta, 'card '+c0); }
    else registraTesteIlha('B) Esc com card por cima', true, 'pulado: quadro sem cards');
    _ilhaFechar(false);
    // C) escuta do agente com entrega imediata
    const orig = window._onValue, mods = Object.assign({}, p.mods);
    window._onValue = (ref, cb, ...r) => { if (/agente_analisando/.test(String(ref && (ref.p || ref.path || ref._path) || ref))) { cb({ val: () => ({ teste: { squad: ACTIVE_SQUAD, cardId: 'x', desde: new Date().toISOString() } }) }); return () => {}; } return orig(ref, cb, ...r); };
    try { p.mods.agente = false; _ilhaRender(); p.mods.agente = true; _ilhaRender(); registraTesteIlha('C) 1ª entrega imediata da escuta do agente não se perde', _ilhaAgAnalisando().length >= 1); }
    finally { window._onValue = orig; p.mods = mods; _ilhaRender(); }
    // D) desligar o módulo principal
    p.mods.agenda = true; p.principal = 'agenda'; _ilhaRender(); _ilhaAbrir(); await espera(200);
    _ilha.abaAtual = 'ajustes'; _ilhaPainel(); const cx = document.getElementById(['ilha-cfg-mod', 'agenda'].join('-'))   // id montado pela própria ilha ao abrir ⚙ Ajustes;
    if (cx) { cx.checked = false; cx.dispatchEvent(new Event('change', { bubbles: true })); await espera(200);
      registraTesteIlha('D) desligar o módulo principal volta a principal para Timer', _ilhaPrefs().principal === 'timer', _ilhaPrefs().principal); }
    _ilhaFechar(false);
  } finally {
    Object.assign(_ilha.p, JSON.parse(antes)); _ilhaSalvar(); _ilha.fixada = false; _ilhaRender();
  }
  window._resultadosTeste = linhas; console.table(linhas);
})();
